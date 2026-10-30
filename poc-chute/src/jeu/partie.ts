// Déroulement d'une partie (spec §6.3 à §6.8) : tirage des notes, chute, validation au micro, série, points, vitesse,
// statistiques et journal. Le temps est passé en paramètre, sur l'horloge de l'écoute (performance.now()).
import type { EtatDetection } from '../audio/pitch';
import { noteDePosition, type Position } from '../music/manche';
import type { Notation } from '../music/notation';
import { frequenceVersNote, midiVersFrequence, type NomNote, type NoteDetectee } from '../music/notes';
import { progressionInitiale, type Mode, type Niveau, type Statistique } from '../progression/modele';
import { caseMaxDuNiveau, contenuNiveau, positionsDuNiveau } from '../progression/niveaux';
import { enregistrerReponse, poidsDuMode } from '../progression/statistiques';
import { tirerQuestion, type OptionsTirage, type Question } from '../quiz/tirage';
import { SuiviMode2, type OptionsMode2 } from '../quiz/validation';
import { Chute, type NoteEnChute } from './chute';
import { retenirNom, sansNomsRecents } from './enchainement';
import {
  quantile,
  type ContexteJournal,
  type EvenementNoteJournal,
  type NoteJournal,
  type PartieJournal,
  type ResultatNote,
} from './journal';
import { PENALITE_FAUSSE_NOTE, multiplicateur, pointsNote, timingDe, type Timing } from './points';
import { apresResultat, vitesseInitiale, type EtatVitesse } from './vitesse';

/** Notes par partie : 30 (spec §6.7, Q15), à ajuster. */
export const NOTES_PAR_PARTIE = 30;
/** Durée d'affichage de la bonne case après une erreur, en ms : 1,5 s (spec §6.2, Q8), à ajuster. */
export const DUREE_RAPPEL_CASE_MS = 1500;
/** Fausses notes sur une même note avant d'afficher la bonne case, en mode « pénalité » : 3, comme le mode 2 de
 * l'application (spec §6.2, choix de l'utilisateur du 28/10/2026), à ajuster. */
export const FAUSSES_AVANT_RAPPEL = 3;
/** Validation au micro : le demi-ton, octave non stricte, sans réglage dans le POC (spec §3). */
export const OPTIONS_VALIDATION: OptionsMode2 = { tolerance: 50, octaveStricte: false };
/** Le jeu se joue au micro : ses statistiques sont celles du mode 2 du modèle de l'application. */
const MODE: Mode = 2;

/**
 * Effet d'une fausse note (spec §6.4) : « penalite » (défaut) retire des points, la note reste à jouer ;
 * « destruction » détruit la note attendue (Q14), on passe à la suivante.
 */
export type RegleFausseNote = 'penalite' | 'destruction';
export const REGLES_FAUSSE_NOTE: readonly RegleFausseNote[] = ['penalite', 'destruction'];

/** Choix de l'écran de départ (spec §6.1). */
export interface ReglagesPartie {
  niveau: Niveau;
  dureeInitialeMs: number;
  /** Option de mesure : désactive la vitesse adaptative. */
  vitesseFixe: boolean;
  /** Option de mesure : l'étiquette de la note donne aussi la case (affichage seulement). */
  afficherCase: boolean;
  notation: Notation;
  fausseNote: RegleFausseNote;
}

export interface OptionsPartie {
  /** Instant du début de la partie, sur l'horloge des appels suivants. */
  debutMs: number;
  /** Date et heure du début (journal, statistiques). */
  date: Date;
  /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
  hasard?: () => number;
  /** Partie jouée au clavier, sans micro (spec §6.9). */
  simulation?: boolean;
}

export type EvenementPartie =
  /** La note attendue est jouée juste, détruite par une fausse note, ou arrivée sur la ligne sans être jouée. */
  | {
      type: 'resultat';
      note: NoteEnChute;
      resultat: ResultatNote;
      timing: Timing | null;
      points: number;
      serie: number;
      /** Note jouée (null pour une note ratée). */
      detectee: NoteDetectee | null;
    }
  /**
   * Mode « pénalité » : fausse note sur la note attendue, qui reste à jouer. `penalite` : points vraiment retirés ;
   * `fausses` : fausses notes sur cette note.
   */
  | { type: 'fausse'; note: NoteEnChute; detectee: NoteDetectee; penalite: number; fausses: number }
  /** Première note jouée identique à la note précédente : la corde précédente sonne encore, ignorée une fois. */
  | { type: 'ancienneNote'; detectee: NoteDetectee }
  /** Attaque sans note stable au bout de 1,5 s : ni juste ni fausse. */
  | { type: 'nonReconnue' }
  | { type: 'fin'; interrompue: boolean };

export class Partie {
  readonly reglages: Readonly<ReglagesPartie>;
  readonly simulation: boolean;
  score = 0;
  serie = 0;
  meilleureSerie = 0;

  private readonly chute = new Chute();
  private readonly suivi = new SuiviMode2();
  private readonly candidates: Position[];
  private readonly optionsTirage: Omit<OptionsTirage, 'poids'>;
  private readonly hasard: () => number;
  private readonly debutMs: number;
  private readonly date: Date;
  private vitesse: EtatVitesse;
  private dureeMinMs: number;
  private stats: Statistique[];
  private tirees = 0;
  private conclues = 0;
  private derniereTiree: Question | undefined;
  /** Noms des dernières notes tirées, écartés du tirage suivant (enchainement.ts). */
  private nomsRecents: NomNote[] = [];
  private derniereConclue: Question | null = null;
  private dernierT: number;
  /** Dernière attaque entendue pendant que la note attendue l'était. */
  private derniereAttaqueMs: number | null = null;
  /** Début du temps de réponse de la note attendue : instant où elle l'est devenue, puis dernière fausse note. */
  private debutReponseMs: number;
  /** Fausses notes sur la note attendue (mode « pénalité »). */
  private faussesAttendue = 0;
  /** Fausses notes de la partie, dans les deux modes (y compris sur une note attendue au moment d'un arrêt). */
  private fausses = 0;
  /** Événements sans effet de la note attendue. */
  private evenementsAttendue: EvenementNoteJournal[] = [];
  private readonly notesJournal: NoteJournal[] = [];
  private fini = false;
  private interrompu = false;

  /** La première note apparaît dès la création. */
  constructor(reglages: ReglagesPartie, statistiques: readonly Statistique[], options: OptionsPartie) {
    this.reglages = { ...reglages };
    this.simulation = options.simulation ?? false;
    this.candidates = positionsDuNiveau(reglages.niveau, MODE);
    this.optionsTirage = {
      caseMax: caseMaxDuNiveau(reglages.niveau, MODE),
      cordeDemandee: contenuNiveau(reglages.niveau).cordeDemandee,
    };
    this.hasard = options.hasard ?? Math.random;
    this.debutMs = options.debutMs;
    this.dernierT = options.debutMs;
    this.debutReponseMs = options.debutMs;
    this.date = options.date;
    this.vitesse = vitesseInitiale(reglages.dureeInitialeMs, reglages.vitesseFixe);
    this.dureeMinMs = this.vitesse.dureeMs;
    this.stats = [...statistiques];
    this.apparaitre(options.debutMs);
  }

  /** Notes à l'écran, de la plus basse (la note attendue) à la plus haute. */
  get notes(): readonly NoteEnChute[] {
    return this.chute.notes;
  }

  get attendue(): NoteEnChute | null {
    return this.fini ? null : this.chute.attendue;
  }

  get dureeChuteMs(): number {
    return this.vitesse.dureeMs;
  }

  /** Dernière case du niveau : le manche affiché s'arrête là. */
  get caseMax(): number {
    return this.optionsTirage.caseMax;
  }

  /** Multiplicateur de la série en cours. */
  get multiplicateur(): number {
    return multiplicateur(this.serie);
  }

  get notesRestantes(): number {
    return NOTES_PAR_PARTIE - this.conclues;
  }

  get terminee(): boolean {
    return this.fini;
  }

  get interrompue(): boolean {
    return this.interrompu;
  }

  /** Statistiques par position mises à jour par la partie, à enregistrer (base du tirage pondéré). */
  get statistiques(): readonly Statistique[] {
    return this.stats;
  }

  /** Fait avancer la chute jusqu'à tMs : notes ratées, puis nouvelle note si une apparition est due. */
  avancer(tMs: number): EvenementPartie[] {
    if (this.fini) return [];
    const dtMs = tMs - this.dernierT;
    this.dernierT = tMs;
    const evenements: EvenementPartie[] = [];
    for (const note of this.chute.avancer(dtMs, this.vitesse.dureeMs)) {
      evenements.push(...this.conclure(note, 'ratee', tMs, null, this.derniereAttaqueMs));
      if (this.fini) return evenements;
    }
    if (this.tirees < NOTES_PAR_PARTIE && this.chute.apparitionDue()) this.apparaitre(tMs);
    return evenements;
  }

  /** Traite un état de la chaîne de détection, avec les règles du mode 2 (SuiviMode2, spec §6.4). */
  traiterDetection(etat: EtatDetection): EvenementPartie[] {
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

  /** Vrai si le micro n'entend rien depuis plus de 3 s alors qu'une note est attendue (message « Jouez la note… »). */
  silenceProlonge(tMs: number): boolean {
    return this.attendue !== null && this.suivi.silenceProlonge(tMs);
  }

  /**
   * Mode simulation (spec §6.9) : joue la note attendue, juste ou un demi-ton au-dessus, sans micro ni latence.
   * Les règles du micro (ancienne note, note non reconnue) ne s'appliquent pas.
   */
  jouerSimule(juste: boolean, tMs: number): EvenementPartie[] {
    const note = this.attendue;
    if (!note) return [];
    const midi = noteDePosition(note.question.position).midi + (juste ? 0 : 1);
    const detectee = frequenceVersNote(midiVersFrequence(midi))!;
    if (!juste) return this.fausseNote(note, tMs, detectee, tMs);
    this.chute.retirerAttendue();
    return this.conclure(note, 'juste', tMs, detectee, tMs);
  }

  /** Bouton « Arrêter » : la partie est terminée et marquée interrompue. */
  arreter(): EvenementPartie[] {
    if (this.fini) return [];
    this.fini = true;
    this.interrompu = true;
    return [{ type: 'fin', interrompue: true }];
  }

  /** Journal de la partie (spec §6.10), avec ce que fournit l'interface. */
  journal(contexte: ContexteJournal): PartieJournal {
    const justes = this.notesJournal.filter((n) => n.resultat === 'juste');
    const tempsReponse = justes.map((n) => n.tDetectionMs! - n.tAttendueMs);
    const mediane = quantile(tempsReponse, 0.5);
    return {
      mode: 'classique',
      debut: this.date.toISOString(),
      navigateur: contexte.navigateur,
      simulation: this.simulation,
      interrompue: this.interrompu,
      reglages: { ...this.reglages },
      seuilSilenceDbfs: contexte.seuilSilenceDbfs,
      traitementsActifs: [...contexte.traitementsActifs],
      images: { ...contexte.images },
      pauses: contexte.pauses.map((p) => ({ ...p })),
      resume: {
        score: this.score,
        justes: justes.length,
        fausses: this.fausses,
        ratees: this.notesJournal.filter((n) => n.resultat === 'ratee').length,
        meilleureSerie: this.meilleureSerie,
        dureeFinaleMs: Math.round(this.vitesse.dureeMs),
        dureeMinMs: Math.round(this.dureeMinMs),
        tempsReponseMedianMs: mediane === null ? null : Math.round(mediane),
      },
      notes: this.notesJournal.map((n) => ({ ...n, evenements: [...n.evenements] })),
    };
  }

  /** Temps en ms depuis le début de la partie, arrondi. */
  private relatif(tMs: number): number {
    return Math.round(tMs - this.debutMs);
  }

  /**
   * Tire une nouvelle note (pondérée par les statistiques en cours, sans le nom des 2 dernières) et la place en haut
   * de la chute.
   */
  private apparaitre(tMs: number): void {
    const question = tirerQuestion(
      sansNomsRecents(this.candidates, this.nomsRecents),
      { ...this.optionsTirage, poids: poidsDuMode(this.stats, MODE) },
      this.hasard,
      this.derniereTiree,
    );
    this.tirees++;
    this.derniereTiree = question;
    this.nomsRecents = retenirNom(this.nomsRecents, question.nom);
    this.chute.ajouter({ index: this.tirees, question, progression: 0, tApparitionMs: tMs, tAttendueMs: null });
    this.rendreAttendue(tMs);
  }

  /** La note la plus basse devient attendue si elle ne l'est pas encore : le suivi du micro repart pour elle. */
  private rendreAttendue(tMs: number): void {
    const note = this.chute.attendue;
    if (!note || note.tAttendueMs !== null) return;
    note.tAttendueMs = tMs;
    this.suivi.poser(note.question, this.derniereConclue);
    this.derniereAttaqueMs = null;
    this.debutReponseMs = tMs;
    this.faussesAttendue = 0;
    this.evenementsAttendue = [];
  }

  /**
   * Fausse note sur la note attendue (spec §6.4). Mode « destruction » : la note est détruite. Mode « pénalité » :
   * elle reste à jouer (le suivi du micro garde la question, comme le mode 2 de l'application) ; le score perd
   * PENALITE_FAUSSE_NOTE, sans descendre sous 0 ; la série est cassée, la chute ralentit et la réponse compte
   * dans les statistiques de la position demandée.
   */
  private fausseNote(
    note: NoteEnChute,
    tMs: number,
    detectee: NoteDetectee,
    tAttaqueMs: number | null,
  ): EvenementPartie[] {
    this.fausses++;
    if (this.reglages.fausseNote === 'destruction') {
      this.chute.retirerAttendue();
      return this.conclure(note, 'fausse', tMs, detectee, tAttaqueMs);
    }
    const penalite = Math.min(this.score, PENALITE_FAUSSE_NOTE);
    this.score -= penalite;
    this.serie = 0;
    this.vitesse = apresResultat(this.vitesse, false);
    this.dureeMinMs = Math.min(this.dureeMinMs, this.vitesse.dureeMs);
    this.enregistrerStatistique(note.question.position, false, tMs, tMs - this.debutReponseMs);
    this.debutReponseMs = tMs;
    this.faussesAttendue++;
    const { nom, midi, cents } = detectee;
    this.evenementsAttendue.push({ type: 'fausse', tMs: this.relatif(tMs), nom, midi, cents, penalite });
    return [{ type: 'fausse', note, detectee, penalite, fausses: this.faussesAttendue }];
  }

  /** Réponse sur la position demandée, avec la règle de l'application (enregistrerReponse, mode 2). */
  private enregistrerStatistique(position: Position, juste: boolean, tMs: number, tempsMs: number): void {
    // Mise à jour de l'application, sur une progression qui ne porte que les statistiques.
    this.stats = enregistrerReponse(
      { ...progressionInitiale(), statistiques: this.stats },
      {
        mode: MODE,
        position,
        juste,
        tempsMs,
        date: new Date(this.date.getTime() + tMs - this.debutMs),
      },
    ).statistiques;
  }

  /** Résultat d'une note déjà retirée de la chute : série, points, vitesse, statistique, journal, note suivante. */
  private conclure(
    note: NoteEnChute,
    resultat: ResultatNote,
    tMs: number,
    detectee: NoteDetectee | null,
    tAttaqueMs: number | null,
  ): EvenementPartie[] {
    const tAttendueMs = note.tAttendueMs ?? tMs;
    const juste = resultat === 'juste';
    const position = note.question.position;
    const dureeChuteMs = this.vitesse.dureeMs;
    const progression = Math.min(note.progression, 1);

    this.serie = juste ? this.serie + 1 : 0;
    this.meilleureSerie = Math.max(this.meilleureSerie, this.serie);
    const timing = juste ? timingDe(progression) : null;
    // Points sur la durée de chute au moment de la validation, avant le changement de vitesse.
    const points = timing ? pointsNote({ timing, dureeChuteMs, position, serie: this.serie }) : 0;
    this.score += points;
    this.vitesse = apresResultat(this.vitesse, juste);
    this.dureeMinMs = Math.min(this.dureeMinMs, this.vitesse.dureeMs);

    // Temps de réponse : depuis la dernière fausse note s'il y en a eu, sinon depuis l'instant où la note est attendue.
    this.enregistrerStatistique(position, juste, tMs, note.tAttendueMs === null ? 0 : tMs - this.debutReponseMs);

    this.notesJournal.push({
      index: note.index,
      position: { ...position },
      nom: note.question.nom,
      midi: noteDePosition(position).midi,
      tApparitionMs: this.relatif(note.tApparitionMs),
      tAttendueMs: this.relatif(tAttendueMs),
      tAttaqueMs: tAttaqueMs === null ? null : this.relatif(tAttaqueMs),
      tDetectionMs: detectee ? this.relatif(tMs) : null,
      detectee: detectee ? { nom: detectee.nom, midi: detectee.midi, cents: detectee.cents } : null,
      resultat,
      progression: Math.round(progression * 1000) / 1000,
      dureeChuteMs: Math.round(dureeChuteMs),
      timing,
      points,
      serie: this.serie,
      evenements: this.evenementsAttendue,
    });
    this.conclues++;
    this.derniereConclue = note.question;

    const evenements: EvenementPartie[] = [
      { type: 'resultat', note, resultat, timing, points, serie: this.serie, detectee },
    ];
    if (this.conclues >= NOTES_PAR_PARTIE) {
      this.fini = true;
      evenements.push({ type: 'fin', interrompue: false });
      return evenements;
    }
    // Écran vide : la note suivante apparaîtra au prochain appel à avancer (une image plus tard).
    this.rendreAttendue(tMs);
    return evenements;
  }
}
