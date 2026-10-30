// Partie du mode 1 (spec §5.1) : le mode progressif du POC « Notes qui tombent » (docs/specs-poc-chute.md §16), joué
// en touchant la case. Des cordes à vide au manche entier : les notes du niveau sont tirées selon leur réussite, la
// vitesse suit la réussite (immobile au départ) jusqu'au plafond du niveau, et le niveau passe quand chaque note et
// l'ensemble sont réussis à ce plafond ; quelques notes s'ajoutent alors. Le temps est passé en paramètre (temps du
// jeu, sans les pauses). Adapté de poc-chute/src/jeu/progressif/partie-progressive.ts : le toucher remplace le micro.
import { CASE_MAX, NUMEROS_CORDES, noteDePosition, type Position } from '../music/manche';
import type { Notation } from '../music/notation';
import type { NomNote } from '../music/notes';
import { tirerQuestion, type Question } from '../quiz/tirage';
import { verifierMode1 } from '../quiz/validation';
import { Chute, type NoteEnChute } from './chute';
import { difficulte, notesAAjouter, positionsDepart } from './difficulte';
import { retenirNom, sansNomsRecents } from './enchainement';
import {
  quantile,
  type ContexteJournal,
  type EssaiJournal,
  type FausseJournal,
  type PartieJournal,
  type PassageJournal,
} from './journal';
import { POINTS_BASE, multiplicateur } from './points';
import { plafondVitesse, type ReglagesProgressif } from './reglages';
import {
  justesse,
  matriceReussites,
  reussiteGlobale,
  reussiteNote,
  reussitesNote,
  scoreEssai,
  type Essai,
  type ResultatEssai,
} from './reussite';

/** Cases fausses touchées sur une même note avant qu'elle disparaisse (« perdue ») : 3, comme le POC (spec §16.2). */
export const ERREURS_AVANT_PERTE = 3;
/** Pause au passage de niveau, le temps de montrer les nouvelles notes, en ms : 6 s (POC, spec §16.4). */
export const DUREE_PAUSE_NIVEAU_MS = 6000;
/**
 * Poids ajouté au tirage par l'échec : poids = 1 + 3 × (1 − réussite), de 1 à 4 (POC, spec §16.3). Une note qui n'a
 * pas encore ses `essaisMinimum` essais a le poids maximal (4), pour que les nouvelles notes soient jouées tout de suite.
 */
export const POIDS_ECHEC_TIRAGE = 3;

export interface OptionsPartie {
  /** Instant du début de la partie, sur l'horloge des appels suivants (temps du jeu). */
  debutMs: number;
  date: Date;
  /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
  hasard?: () => number;
  /** Niveau et notes de départ (reprise) ; par défaut, niveau 1 aux cordes à vide. */
  niveau?: number;
  positions?: readonly Position[];
  /** Affichage, noté dans le journal. */
  notation: Notation;
}

export type EvenementPartie =
  /**
   * Fin de l'essai : touchée juste, perdue à la 3e case fausse, ou ratée (arrivée en bas). `points` < 0 : perte.
   * `tempsReponseMs` : depuis que la note est attendue, ou depuis la dernière case fausse (statistiques).
   */
  | {
      type: 'resultat';
      note: NoteEnChute;
      resultat: ResultatEssai;
      points: number;
      serie: number;
      scoreEssai: number;
      touchee: Position | null;
      tempsReponseMs: number;
    }
  /** Case fausse : points retirés, la note reste à jouer. */
  | { type: 'fausse'; note: NoteEnChute; touchee: Position; penalite: number; fausses: number; tempsReponseMs: number }
  /**
   * Niveau validé : bonus, notes ajoutées (vide quand tout le manche est validé), plafond de vitesse du nouveau niveau ;
   * pause puis vitesse 0.
   */
  | { type: 'niveau'; niveau: number; bonus: number; ajoutees: Position[]; plafond: number }
  | { type: 'fin'; interrompue: boolean };

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;

/**
 * Question d'une position. Une corde à vide ne donne que le nom (au toucher, la corde serait la réponse) : toute corde
 * à vide de ce nom est acceptée (Mi : cordes 6 et 1), comme le niveau 1 du quiz (spec §5.1).
 */
export function questionTouchee(question: Question): Question {
  if (question.position.case !== 0) return question;
  const positionsCorrectes = NUMEROS_CORDES.map((corde) => ({ corde, case: 0 })).filter(
    (p) => noteDePosition(p).nom === question.nom,
  );
  return { ...question, cordeDemandee: false, positionsCorrectes };
}

export class Partie {
  readonly reglages: Readonly<ReglagesProgressif>;
  score = 0;
  serie = 0;
  meilleureSerie = 0;

  private chute = new Chute();
  private readonly hasard: () => number;
  private readonly debutMs: number;
  private readonly date: Date;
  private readonly notation: Notation;
  private readonly niveauDepart: number;
  private readonly positionsDepart: Position[];
  private niveauActuel: number;
  private notesDuNiveau: Position[];
  /** Tout le manche est dans le niveau et validé : plus de passage. */
  private mancheComplet = false;
  /** Vitesse, en part de la vitesse max (0 : notes immobiles). */
  private vitesseActuelle = 0;
  private vitesseMax = 0;
  private readonly essais: Essai[] = [];
  private readonly essaisJournal: EssaiJournal[] = [];
  private readonly passages: PassageJournal[] = [];
  private tirees = 0;
  private derniereTiree: Question | undefined;
  /** Noms des dernières notes tirées, écartés du tirage suivant (enchainement.ts) ; gardés au passage de niveau. */
  private nomsRecents: NomNote[] = [];
  private dernierT: number;
  /** Début de la réponse en cours : la note devenue attendue, ou la dernière case fausse. */
  private debutReponseMs = 0;
  private erreursAttendue = 0;
  private fausses = 0;
  private faussesAttendue: FausseJournal[] = [];
  /** Fin de la pause de passage de niveau (temps du jeu), ou null. */
  private finPauseMs: number | null = null;
  private fini = false;
  private interrompu = false;

  /** La première note apparaît dès la création, immobile. */
  constructor(reglages: ReglagesProgressif, options: OptionsPartie) {
    this.reglages = { ...reglages };
    this.hasard = options.hasard ?? Math.random;
    this.debutMs = options.debutMs;
    this.dernierT = options.debutMs;
    this.date = options.date;
    this.notation = options.notation;
    this.niveauDepart = options.niveau ?? 1;
    this.niveauActuel = this.niveauDepart;
    this.positionsDepart = (options.positions?.length ? options.positions : positionsDepart()).map((p) => ({ ...p }));
    this.notesDuNiveau = this.positionsDepart.map((p) => ({ ...p }));
    this.apparaitre(options.debutMs);
  }

  get notes(): readonly NoteEnChute[] {
    return this.chute.notes;
  }

  get attendue(): NoteEnChute | null {
    return this.fini || this.enPause ? null : this.chute.attendue;
  }

  get niveau(): number {
    return this.niveauActuel;
  }

  /** Notes (positions) du niveau. */
  get positions(): readonly Position[] {
    return this.notesDuNiveau;
  }

  /** Dernière case des notes du niveau : le manche affiché va jusqu'au palier qui la contient. */
  get caseMax(): number {
    return Math.max(...this.notesDuNiveau.map((p) => p.case));
  }

  get vitesse(): number {
    return this.vitesseActuelle;
  }

  /** Plafond de vitesse du niveau : la vitesse ne le dépasse pas, et l'atteindre est une condition du passage. */
  get plafond(): number {
    return plafondVitesse(this.niveauActuel, this.reglages);
  }

  /** Durée de chute à la vitesse actuelle ; infinie à vitesse 0 (note immobile). */
  get dureeChuteMs(): number {
    return this.vitesseActuelle > 0 ? this.reglages.dureeChuteMinMs / this.vitesseActuelle : Infinity;
  }

  get multiplicateur(): number {
    return multiplicateur(this.serie);
  }

  /** Pause de passage de niveau en cours. */
  get enPause(): boolean {
    return this.finPauseMs !== null;
  }

  get terminee(): boolean {
    return this.fini;
  }

  get interrompue(): boolean {
    return this.interrompu;
  }

  /** Réussite globale du niveau (méthodes choisies). */
  get reussiteGlobale(): number {
    const { methodeGlobale, methodeNote } = this.reglages;
    return reussiteGlobale(methodeGlobale, methodeNote, this.notesDuNiveau, this.essais, this.reglages);
  }

  /** Réussite d'une note (méthode choisie). */
  reussiteDe(position: Position): number {
    return reussiteNote(this.reglages.methodeNote, position, this.essais, this.reglages);
  }

  essaisDe(position: Position): number {
    return this.essais.filter((e) => memePosition(e.position, position)).length;
  }

  /** Fait avancer la chute jusqu'à tMs ; pendant la pause de passage, rien ne bouge, puis la note suivante apparaît. */
  avancer(tMs: number): EvenementPartie[] {
    if (this.fini) return [];
    const dtMs = tMs - this.dernierT;
    this.dernierT = tMs;
    const evenements: EvenementPartie[] = [];
    if (this.finPauseMs !== null) {
      if (tMs < this.finPauseMs) return [];
      this.finPauseMs = null;
    } else {
      for (const note of this.chute.avancer(dtMs, this.dureeChuteMs)) {
        evenements.push(...this.conclure(note, 'ratee', tMs, null));
        // Un passage de niveau vide la chute : les autres notes arrivées en bas ne comptent plus.
        if (this.finPauseMs !== null) return evenements;
      }
    }
    if (this.chute.apparitionDue()) this.apparaitre(tMs);
    return evenements;
  }

  /** Case touchée : juste, l'essai est conclu ; fausse, la note reste à jouer (perdue à la 3e). */
  toucher(position: Position, tMs: number): EvenementPartie[] {
    const note = this.attendue;
    if (!note) return [];
    const touchee = { ...position };
    if (!verifierMode1(note.question, touchee).juste) return this.caseFausse(note, tMs, touchee);
    this.chute.retirerAttendue();
    return this.conclure(note, 'juste', tMs, touchee);
  }

  arreter(): EvenementPartie[] {
    if (this.fini) return [];
    this.fini = true;
    this.interrompu = true;
    return [{ type: 'fin', interrompue: true }];
  }

  journal(contexte: ContexteJournal): PartieJournal {
    const justes = this.essaisJournal.filter((e) => e.resultat === 'juste');
    const mediane = quantile(
      justes.map((e) => e.delaiNoteMs!),
      0.5,
    );
    return {
      debut: this.date.toISOString(),
      navigateur: contexte.navigateur,
      interrompue: this.interrompu,
      reglages: { ...this.reglages, notation: this.notation },
      images: { ...contexte.images },
      pauses: contexte.pauses.map((p) => ({ ...p })),
      niveauDepart: this.niveauDepart,
      positionsDepart: this.positionsDepart.map((p) => ({ ...p })),
      passages: this.passages.map((p) => ({ ...p, ajoutees: p.ajoutees.map((q) => ({ ...q })) })),
      resume: {
        score: this.score,
        niveauDepart: this.niveauDepart,
        niveauAtteint: this.niveauActuel,
        essais: this.essaisJournal.length,
        justes: justes.length,
        fausses: this.fausses,
        perdues: this.essaisJournal.filter((e) => e.resultat === 'perdue').length,
        ratees: this.essaisJournal.filter((e) => e.resultat === 'ratee').length,
        meilleureSerie: this.meilleureSerie,
        vitesseMax: Math.round(this.vitesseMax * 1000) / 1000,
        delaiNoteMedianMs: mediane === null ? null : Math.round(mediane),
        reussiteGlobale: Math.round(this.reussiteGlobale * 1000) / 1000,
      },
      bilanNotes: this.notesDuNiveau.map((position) => ({
        position: { ...position },
        nom: noteDePosition(position).nom,
        difficulte: difficulte(position, this.reglages.poidsAlteration),
        essais: this.essaisDe(position),
        reussite: Math.round(this.reussiteDe(position) * 1000) / 1000,
      })),
      essais: this.essaisJournal.map((e) => ({ ...e, fausses: e.fausses.map((f) => ({ ...f })) })),
    };
  }

  private relatif(tMs: number): number {
    return Math.round(tMs - this.debutMs);
  }

  /**
   * Nouvelle note du niveau, tirée selon la réussite (une note peu réussie, ou pas encore assez jouée, revient
   * jusqu'à 4 fois plus souvent), sans le nom des 2 dernières.
   */
  private apparaitre(tMs: number): void {
    const question = questionTouchee(
      tirerQuestion(
        sansNomsRecents(this.notesDuNiveau, this.nomsRecents),
        { caseMax: CASE_MAX, cordeDemandee: true, poids: (p) => this.poidsTirage(p) },
        this.hasard,
        this.derniereTiree,
      ),
    );
    this.tirees++;
    this.derniereTiree = question;
    this.nomsRecents = retenirNom(this.nomsRecents, question.nom);
    this.chute.ajouter({ index: this.tirees, question, progression: 0, tApparitionMs: tMs, tAttendueMs: null });
    this.rendreAttendue(tMs);
  }

  /** Poids de tirage d'une note : maximal tant qu'elle n'a pas ses essais minimum, puis selon sa réussite. */
  private poidsTirage(position: Position): number {
    if (this.essaisDe(position) < this.reglages.essaisMinimum) return 1 + POIDS_ECHEC_TIRAGE;
    return 1 + POIDS_ECHEC_TIRAGE * (1 - this.reussiteDe(position));
  }

  private rendreAttendue(tMs: number): void {
    const note = this.chute.attendue;
    if (!note || note.tAttendueMs !== null) return;
    note.tAttendueMs = tMs;
    this.debutReponseMs = tMs;
    this.erreursAttendue = 0;
    this.faussesAttendue = [];
  }

  private ralentir(): void {
    this.vitesseActuelle *= 1 - this.reglages.ralentissement;
  }

  /** Case fausse : −penaliteFausse (score jamais négatif), série cassée, ralentissement ; perdue à la 3e. */
  private caseFausse(note: NoteEnChute, tMs: number, touchee: Position): EvenementPartie[] {
    this.fausses++;
    this.erreursAttendue++;
    if (this.erreursAttendue >= ERREURS_AVANT_PERTE) {
      this.chute.retirerAttendue();
      return this.conclure(note, 'perdue', tMs, touchee);
    }
    const penalite = Math.min(this.score, this.reglages.penaliteFausse);
    this.score -= penalite;
    this.serie = 0;
    this.ralentir();
    this.faussesAttendue.push({ tMs: this.relatif(tMs), position: touchee, penalite });
    const tempsReponseMs = tMs - this.debutReponseMs;
    this.debutReponseMs = tMs;
    return [{ type: 'fausse', note, touchee, penalite, fausses: this.erreursAttendue, tempsReponseMs }];
  }

  /** Fin d'un essai (note déjà retirée de la chute) : points, vitesse, réussites, journal, puis passage ou suite. */
  private conclure(
    note: NoteEnChute,
    resultat: ResultatEssai,
    tMs: number,
    touchee: Position | null,
  ): EvenementPartie[] {
    const tAttendueMs = note.tAttendueMs ?? tMs;
    const juste = resultat === 'juste';
    const position = note.question.position;
    const essai: Essai = {
      position,
      resultat,
      erreurs: resultat === 'perdue' ? ERREURS_AVANT_PERTE : this.erreursAttendue,
      delaiApparitionMs: juste ? tMs - note.tApparitionMs : null,
      delaiNoteMs: juste ? tMs - tAttendueMs : null,
    };
    const score = scoreEssai(essai, this.reglages);
    const vitesse = this.vitesseActuelle;
    let points: number;
    if (juste) {
      this.serie++;
      points = Math.round(POINTS_BASE * score * (1 + vitesse) * multiplicateur(this.serie));
      this.score += points;
      this.vitesseActuelle = Math.min(this.plafond, vitesse + this.reglages.acceleration * score);
    } else {
      this.serie = 0;
      points = -Math.min(this.score, this.reglages.penalitePerdue);
      this.score += points;
      this.ralentir();
    }
    this.meilleureSerie = Math.max(this.meilleureSerie, this.serie);
    this.vitesseMax = Math.max(this.vitesseMax, this.vitesseActuelle);
    this.essais.push(essai);
    if (resultat === 'perdue' && touchee) {
      this.faussesAttendue.push({ tMs: this.relatif(tMs), position: touchee, penalite: 0 });
    }

    this.essaisJournal.push({
      index: note.index,
      niveau: this.niveauActuel,
      position: { ...position },
      nom: note.question.nom,
      cordeDemandee: note.question.cordeDemandee,
      tApparitionMs: this.relatif(note.tApparitionMs),
      tAttendueMs: this.relatif(tAttendueMs),
      tResultatMs: this.relatif(tMs),
      resultat,
      erreurs: essai.erreurs,
      justesse: justesse(essai),
      delaiApparitionMs: essai.delaiApparitionMs === null ? null : Math.round(essai.delaiApparitionMs),
      delaiNoteMs: essai.delaiNoteMs === null ? null : Math.round(essai.delaiNoteMs),
      scoreEssai: Math.round(score * 1000) / 1000,
      vitesse: Math.round(vitesse * 1000) / 1000,
      points,
      serie: this.serie,
      touchee: touchee ? { ...touchee } : null,
      fausses: this.faussesAttendue,
      reussites: reussitesNote(position, this.essais, this.reglages),
      globales: matriceReussites(this.notesDuNiveau, this.essais, this.reglages),
    });

    const evenements: EvenementPartie[] = [
      {
        type: 'resultat',
        note,
        resultat,
        points,
        serie: this.serie,
        scoreEssai: score,
        touchee,
        tempsReponseMs: tMs - this.debutReponseMs,
      },
    ];
    if (this.niveauValide()) evenements.push(this.passer(tMs));
    else this.rendreAttendue(tMs);
    return evenements;
  }

  /**
   * Passage de niveau : chaque note a assez d'essais et une réussite ≥ seuilNote, la réussite globale est
   * ≥ seuilGlobal, et la vitesse a atteint le plafond du niveau.
   */
  private niveauValide(): boolean {
    const r = this.reglages;
    if (this.mancheComplet || this.vitesseActuelle + 1e-9 < this.plafond) return false;
    const notesReussies = this.notesDuNiveau.every(
      (p) => this.essaisDe(p) >= r.essaisMinimum && this.reussiteDe(p) + 1e-9 >= r.seuilNote,
    );
    return notesReussies && this.reussiteGlobale + 1e-9 >= r.seuilGlobal;
  }

  private passer(tMs: number): EvenementPartie {
    const bonus = this.reglages.bonusNiveau * this.niveauActuel;
    this.score += bonus;
    const ajoutees = notesAAjouter(this.notesDuNiveau, this.reglages.notesAjoutees, this.reglages.poidsAlteration);
    if (ajoutees.length === 0) this.mancheComplet = true;
    this.notesDuNiveau = [...this.notesDuNiveau, ...ajoutees];
    this.niveauActuel++;
    const plafond = this.plafond;
    this.passages.push({ tMs: this.relatif(tMs), niveau: this.niveauActuel, bonus, ajoutees, plafond });
    // Pause : les notes restantes sont retirées sans compter ; la partie reprend à vitesse 0.
    this.chute = new Chute();
    this.vitesseActuelle = 0;
    this.finPauseMs = tMs + DUREE_PAUSE_NIVEAU_MS;
    return { type: 'niveau', niveau: this.niveauActuel, bonus, ajoutees: ajoutees.map((p) => ({ ...p })), plafond };
  }
}
