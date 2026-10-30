// Partie du mode progressif (spec §16) : des cordes à vide au manche entier. Les notes du niveau sont tirées selon leur
// réussite, la vitesse suit la réussite (immobile au départ), et le niveau passe quand chaque note et l'ensemble sont
// réussis à une vitesse donnée ; quelques notes s'ajoutent alors. Même interface que Partie pour l'écran ; le temps
// est passé en paramètre (temps du jeu, sans les pauses).
import type { EtatDetection } from '../../audio/pitch';
import { CASE_MAX, noteDePosition, type Position } from '../../music/manche';
import type { Notation } from '../../music/notation';
import { frequenceVersNote, midiVersFrequence, type NoteDetectee } from '../../music/notes';
import { tirerQuestion, type Question } from '../../quiz/tirage';
import { SuiviMode2 } from '../../quiz/validation';
import { Chute, type NoteEnChute } from '../chute';
import { quantile, type ContexteJournal, type EvenementNoteJournal } from '../journal';
import { OPTIONS_VALIDATION } from '../partie';
import { POINTS_BASE, multiplicateur } from '../points';
import { difficulte, notesAAjouter, positionsDepart } from './difficulte';
import type { EssaiJournal, PartieProgressiveJournal, PassageJournal } from './journal';
import type { ReglagesProgressif } from './reglages';
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

/** Fausses notes sur une même note avant qu'elle disparaisse (« perdue ») : 3 (demande de l'utilisateur, 30/10/2026). */
export const ERREURS_AVANT_PERTE = 3;
/** Pause au passage de niveau, le temps de montrer les nouvelles notes, en ms : 6 s (proposition, spec §16). */
export const DUREE_PAUSE_NIVEAU_MS = 6000;
/** Poids ajouté au tirage par l'échec : poids = 1 + 3 × (1 − réussite), de 1 à 4, comme l'application (spec §16). */
export const POIDS_ECHEC_TIRAGE = 3;

export interface OptionsPartieProgressive {
  /** Instant du début de la partie, sur l'horloge des appels suivants (temps du jeu). */
  debutMs: number;
  date: Date;
  /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
  hasard?: () => number;
  simulation?: boolean;
  /** Niveau et notes de départ (reprise) ; par défaut, niveau 1 aux cordes à vide. */
  niveau?: number;
  positions?: readonly Position[];
  /** Affichage, noté dans le journal. */
  notation: Notation;
  afficherCase: boolean;
}

export type EvenementProgressif =
  /** Fin de l'essai : jouée juste, perdue à la 3e fausse note, ou ratée (arrivée en bas). `points` < 0 : perte. */
  | {
      type: 'resultat';
      note: NoteEnChute;
      resultat: ResultatEssai;
      points: number;
      serie: number;
      scoreEssai: number;
      detectee: NoteDetectee | null;
    }
  /** Fausse note : points retirés, la note reste à jouer. */
  | { type: 'fausse'; note: NoteEnChute; detectee: NoteDetectee; penalite: number; fausses: number }
  | { type: 'ancienneNote'; detectee: NoteDetectee }
  | { type: 'nonReconnue' }
  /** Niveau validé : bonus, notes ajoutées (vide quand tout le manche est validé), pause puis vitesse 0. */
  | { type: 'niveau'; niveau: number; bonus: number; ajoutees: Position[] }
  | { type: 'fin'; interrompue: boolean };

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;

export class PartieProgressive {
  readonly reglages: Readonly<ReglagesProgressif>;
  readonly simulation: boolean;
  score = 0;
  serie = 0;
  meilleureSerie = 0;

  private chute = new Chute();
  private readonly suivi = new SuiviMode2();
  private readonly hasard: () => number;
  private readonly debutMs: number;
  private readonly date: Date;
  private readonly affichage: { notation: Notation; afficherCase: boolean };
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
  private derniereConclue: Question | null = null;
  private dernierT: number;
  private derniereAttaqueMs: number | null = null;
  private erreursAttendue = 0;
  private fausses = 0;
  private evenementsAttendue: EvenementNoteJournal[] = [];
  /** Fin de la pause de passage de niveau (temps du jeu), ou null. */
  private finPauseMs: number | null = null;
  private fini = false;
  private interrompu = false;

  /** La première note apparaît dès la création, immobile. */
  constructor(reglages: ReglagesProgressif, options: OptionsPartieProgressive) {
    this.reglages = { ...reglages };
    this.simulation = options.simulation ?? false;
    this.hasard = options.hasard ?? Math.random;
    this.debutMs = options.debutMs;
    this.dernierT = options.debutMs;
    this.date = options.date;
    this.affichage = { notation: options.notation, afficherCase: options.afficherCase };
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

  /** Dernière case des notes du niveau : le manche affiché s'arrête là. */
  get caseMax(): number {
    return Math.max(...this.notesDuNiveau.map((p) => p.case));
  }

  get vitesse(): number {
    return this.vitesseActuelle;
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
  avancer(tMs: number): EvenementProgressif[] {
    if (this.fini) return [];
    const dtMs = tMs - this.dernierT;
    this.dernierT = tMs;
    const evenements: EvenementProgressif[] = [];
    if (this.finPauseMs !== null) {
      if (tMs < this.finPauseMs) return [];
      this.finPauseMs = null;
    } else {
      for (const note of this.chute.avancer(dtMs, this.dureeChuteMs)) {
        evenements.push(...this.conclure(note, 'ratee', tMs, null, this.derniereAttaqueMs));
        // Un passage de niveau vide la chute : les autres notes arrivées en bas ne comptent plus.
        if (this.finPauseMs !== null) return evenements;
      }
    }
    if (this.chute.apparitionDue()) this.apparaitre(tMs);
    return evenements;
  }

  /** Traite un état de la chaîne de détection, avec les règles du mode 2 (SuiviMode2, spec §6.4). */
  traiterDetection(etat: EtatDetection): EvenementProgressif[] {
    const note = this.attendue;
    if (!note) return [];
    if (etat.attaque) this.derniereAttaqueMs = etat.tMs;
    const evenement = this.suivi.traiter(etat, OPTIONS_VALIDATION);
    if (!evenement) return [];
    if (evenement.type === 'ancienneNote') {
      this.evenementsAttendue.push({ type: 'ancienneNote', tMs: this.relatif(etat.tMs), nom: evenement.note.nom });
      return [{ type: 'ancienneNote', detectee: evenement.note }];
    }
    if (evenement.type === 'nonReconnue') {
      this.evenementsAttendue.push({ type: 'nonReconnue', tMs: this.relatif(etat.tMs) });
      return [{ type: 'nonReconnue' }];
    }
    const tAttaqueMs = evenement.latenceMs !== null ? etat.tMs - evenement.latenceMs : this.derniereAttaqueMs;
    if (!evenement.juste) return this.fausseNote(note, etat.tMs, evenement.note, tAttaqueMs);
    this.chute.retirerAttendue();
    return this.conclure(note, 'juste', etat.tMs, evenement.note, tAttaqueMs);
  }

  /** Mode simulation : joue la note attendue, juste ou un demi-ton au-dessus, sans micro ni latence. */
  jouerSimule(juste: boolean, tMs: number): EvenementProgressif[] {
    const note = this.attendue;
    if (!note) return [];
    const midi = noteDePosition(note.question.position).midi + (juste ? 0 : 1);
    const detectee = frequenceVersNote(midiVersFrequence(midi))!;
    if (!juste) return this.fausseNote(note, tMs, detectee, tMs);
    this.chute.retirerAttendue();
    return this.conclure(note, 'juste', tMs, detectee, tMs);
  }

  arreter(): EvenementProgressif[] {
    if (this.fini) return [];
    this.fini = true;
    this.interrompu = true;
    return [{ type: 'fin', interrompue: true }];
  }

  /** Vrai si le micro n'entend rien depuis plus de 3 s alors qu'une note est attendue (message « Jouez la note… »). */
  silenceProlonge(tMs: number): boolean {
    return this.attendue !== null && this.suivi.silenceProlonge(tMs);
  }

  journal(contexte: ContexteJournal): PartieProgressiveJournal {
    const justes = this.essaisJournal.filter((e) => e.resultat === 'juste');
    const mediane = quantile(
      justes.map((e) => e.delaiNoteMs!),
      0.5,
    );
    return {
      mode: 'progressif',
      debut: this.date.toISOString(),
      navigateur: contexte.navigateur,
      simulation: this.simulation,
      interrompue: this.interrompu,
      reglages: { ...this.reglages, ...this.affichage },
      seuilSilenceDbfs: contexte.seuilSilenceDbfs,
      traitementsActifs: [...contexte.traitementsActifs],
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
      essais: this.essaisJournal.map((e) => ({ ...e, evenements: [...e.evenements] })),
    };
  }

  private relatif(tMs: number): number {
    return Math.round(tMs - this.debutMs);
  }

  /** Nouvelle note du niveau, tirée selon la réussite : une note peu réussie revient jusqu'à 4 fois plus souvent. */
  private apparaitre(tMs: number): void {
    const question = tirerQuestion(
      this.notesDuNiveau,
      {
        caseMax: CASE_MAX,
        cordeDemandee: true,
        poids: (p) => 1 + POIDS_ECHEC_TIRAGE * (1 - this.reussiteDe(p)),
      },
      this.hasard,
      this.derniereTiree,
    );
    this.tirees++;
    this.derniereTiree = question;
    this.chute.ajouter({ index: this.tirees, question, progression: 0, tApparitionMs: tMs, tAttendueMs: null });
    this.rendreAttendue(tMs);
  }

  private rendreAttendue(tMs: number): void {
    const note = this.chute.attendue;
    if (!note || note.tAttendueMs !== null) return;
    note.tAttendueMs = tMs;
    this.suivi.poser(note.question, this.derniereConclue);
    this.derniereAttaqueMs = null;
    this.erreursAttendue = 0;
    this.evenementsAttendue = [];
  }

  private ralentir(): void {
    this.vitesseActuelle *= 1 - this.reglages.ralentissement;
  }

  /** Fausse note : −penaliteFausse (score jamais négatif), série cassée, ralentissement ; perdue à la 3e. */
  private fausseNote(
    note: NoteEnChute,
    tMs: number,
    detectee: NoteDetectee,
    tAttaqueMs: number | null,
  ): EvenementProgressif[] {
    this.fausses++;
    this.erreursAttendue++;
    if (this.erreursAttendue >= ERREURS_AVANT_PERTE) {
      this.chute.retirerAttendue();
      return this.conclure(note, 'perdue', tMs, detectee, tAttaqueMs);
    }
    const penalite = Math.min(this.score, this.reglages.penaliteFausse);
    this.score -= penalite;
    this.serie = 0;
    this.ralentir();
    const { nom, midi, cents } = detectee;
    this.evenementsAttendue.push({ type: 'fausse', tMs: this.relatif(tMs), nom, midi, cents, penalite });
    return [{ type: 'fausse', note, detectee, penalite, fausses: this.erreursAttendue }];
  }

  /** Fin d'un essai (note déjà retirée de la chute) : points, vitesse, réussites, journal, puis passage ou suite. */
  private conclure(
    note: NoteEnChute,
    resultat: ResultatEssai,
    tMs: number,
    detectee: NoteDetectee | null,
    tAttaqueMs: number | null,
  ): EvenementProgressif[] {
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
      this.vitesseActuelle = Math.min(1, vitesse + this.reglages.acceleration * score);
    } else {
      this.serie = 0;
      points = -Math.min(this.score, this.reglages.penalitePerdue);
      this.score += points;
      this.ralentir();
    }
    this.meilleureSerie = Math.max(this.meilleureSerie, this.serie);
    this.vitesseMax = Math.max(this.vitesseMax, this.vitesseActuelle);
    this.essais.push(essai);

    this.essaisJournal.push({
      index: note.index,
      niveau: this.niveauActuel,
      position: { ...position },
      nom: note.question.nom,
      midi: noteDePosition(position).midi,
      tApparitionMs: this.relatif(note.tApparitionMs),
      tAttendueMs: this.relatif(tAttendueMs),
      tResultatMs: this.relatif(tMs),
      tAttaqueMs: tAttaqueMs === null ? null : this.relatif(tAttaqueMs),
      resultat,
      erreurs: essai.erreurs,
      justesse: justesse(essai),
      delaiApparitionMs: essai.delaiApparitionMs === null ? null : Math.round(essai.delaiApparitionMs),
      delaiNoteMs: essai.delaiNoteMs === null ? null : Math.round(essai.delaiNoteMs),
      scoreEssai: Math.round(score * 1000) / 1000,
      vitesse: Math.round(vitesse * 1000) / 1000,
      points,
      serie: this.serie,
      detectee: detectee ? { nom: detectee.nom, midi: detectee.midi, cents: detectee.cents } : null,
      evenements: this.evenementsAttendue,
      reussites: reussitesNote(position, this.essais, this.reglages),
      globales: matriceReussites(this.notesDuNiveau, this.essais, this.reglages),
    });
    this.derniereConclue = note.question;

    const evenements: EvenementProgressif[] = [
      { type: 'resultat', note, resultat, points, serie: this.serie, scoreEssai: score, detectee },
    ];
    if (this.niveauValide()) evenements.push(this.passer(tMs));
    else this.rendreAttendue(tMs);
    return evenements;
  }

  /**
   * Passage de niveau : chaque note a assez d'essais et une réussite ≥ seuilNote, la réussite globale est
   * ≥ seuilGlobal, et la vitesse ≥ vitesseRequise.
   */
  private niveauValide(): boolean {
    const r = this.reglages;
    if (this.mancheComplet || this.vitesseActuelle + 1e-9 < r.vitesseRequise) return false;
    const notesReussies = this.notesDuNiveau.every(
      (p) => this.essaisDe(p) >= r.essaisMinimum && this.reussiteDe(p) + 1e-9 >= r.seuilNote,
    );
    return notesReussies && this.reussiteGlobale + 1e-9 >= r.seuilGlobal;
  }

  private passer(tMs: number): EvenementProgressif {
    const bonus = this.reglages.bonusNiveau * this.niveauActuel;
    this.score += bonus;
    const ajoutees = notesAAjouter(this.notesDuNiveau, this.reglages.notesAjoutees, this.reglages.poidsAlteration);
    if (ajoutees.length === 0) this.mancheComplet = true;
    this.notesDuNiveau = [...this.notesDuNiveau, ...ajoutees];
    this.niveauActuel++;
    this.passages.push({ tMs: this.relatif(tMs), niveau: this.niveauActuel, bonus, ajoutees });
    // Pause : les notes restantes sont retirées sans compter ; la partie reprend à vitesse 0.
    this.chute = new Chute();
    this.vitesseActuelle = 0;
    this.finPauseMs = tMs + DUREE_PAUSE_NIVEAU_MS;
    return { type: 'niveau', niveau: this.niveauActuel, bonus, ajoutees: ajoutees.map((p) => ({ ...p })) };
  }
}
