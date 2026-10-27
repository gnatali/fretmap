// Vérification d'une réponse. Mode 1 : la case touchée (spec §5.1). Mode 2 : la note jouée (spec §5.2), avec les
// règles de Campagne.traiterNote du POC (poc-guitare/src/journal/campagne.ts).
import type { EtatDetection } from '../audio/pitch';
import { noteDePosition, type Position } from '../music/manche';
import type { NoteDetectee } from '../music/notes';
import type { Tolerance } from '../progression/modele';
import type { Question } from './tirage';

/** Délai après une attaque sans note stable avant d'afficher « note non reconnue », en ms. 1,5 s, comme dans le POC. */
export const DELAI_NON_DETECTION_MS = 1500;
/** Silence au-delà duquel le mode 2 invite à jouer, en ms (spec §5.2). */
export const DUREE_SILENCE_RAPPEL_MS = 3000;

export interface ResultatMode1 {
  juste: boolean;
  /** Positions acceptées (à montrer après une erreur). */
  positionsCorrectes: Position[];
}

/** Juste si la position touchée est l'une des positions acceptées par la question. */
export function verifierMode1(question: Question, touchee: Position): ResultatMode1 {
  const { positionsCorrectes } = question;
  const juste = positionsCorrectes.some((p) => p.corde === touchee.corde && p.case === touchee.case);
  return { juste, positionsCorrectes };
}

export interface OptionsMode2 {
  /** Écart maximal à la note juste, en cents ; 50 = le demi-ton. */
  tolerance: Tolerance;
  /** L'octave doit être celle d'une position acceptée ; sinon le nom de la note suffit. */
  octaveStricte: boolean;
}

/**
 * Juste si la note jouée est celle d'une position acceptée par la question, dans la tolérance.
 * Le micro ne vérifie que la hauteur : la corde est une consigne (spec §5.2).
 */
export function verifierMode2(question: Question, note: NoteDetectee, options: OptionsMode2): boolean {
  if (Math.abs(note.centsExacts) > options.tolerance) return false;
  return question.positionsCorrectes.some((p) => {
    const attendue = noteDePosition(p);
    return options.octaveStricte ? note.midi === attendue.midi : note.nom === attendue.nom;
  });
}

export type EvenementMode2 =
  /** Note jouée : première note stable après une attaque. */
  | { type: 'reponse'; juste: boolean; note: NoteDetectee; latenceMs: number | null; tempsMs: number }
  /** Première note de la question identique à la question précédente : la corde précédente sonne encore. */
  | { type: 'ancienneNote'; note: NoteDetectee }
  /** Attaque sans note stable au bout de DELAI_NON_DETECTION_MS : ni juste ni fausse. */
  | { type: 'nonReconnue' };

/**
 * Suit le flux de détection pendant une question du mode 2 :
 * - seule compte la première note stable après une attaque ; les changements pendant la résonance sont ignorés ;
 * - si la première note jouée est celle de la question précédente, elle est ignorée une fois ;
 * - une attaque sans note stable au bout de 1,5 s est « non reconnue » et ne compte pas.
 */
export class SuiviMode2 {
  private question: Question | null = null;
  private precedente: Question | null = null;
  private debut: number | null = null;
  private reponses = 0;
  private ancienneIgnoree = false;
  private attaqueSansNote: number | null = null;
  private silenceDepuis: number | null = null;

  /** Nouvelle question ; `precedente` sert à reconnaître la corde précédente encore sonore. */
  poser(question: Question, precedente: Question | null = null): void {
    this.question = question;
    this.precedente = precedente;
    this.debut = null;
    this.reponses = 0;
    this.ancienneIgnoree = false;
    this.attaqueSansNote = null;
    this.silenceDepuis = null;
  }

  traiter(etat: EtatDetection, options: OptionsMode2): EvenementMode2 | null {
    const question = this.question;
    if (!question) return null;
    const t = etat.tMs;
    this.debut ??= t;
    this.silenceDepuis = etat.silence ? (this.silenceDepuis ?? t) : null;
    if (etat.attaque) this.attaqueSansNote = t;

    if (etat.nouvelleNoteStable && etat.stable && etat.apresAttaque) {
      this.attaqueSansNote = null;
      const note = etat.stable;
      const juste = verifierMode2(question, note, options);
      if (!juste && this.reponses === 0 && !this.ancienneIgnoree && note.nom === this.precedente?.nom) {
        this.ancienneIgnoree = true;
        return { type: 'ancienneNote', note };
      }
      this.reponses++;
      const tempsMs = t - this.debut;
      // Après une note fausse, la question reste posée : le temps de la réponse suivante repart de là.
      this.debut = t;
      return { type: 'reponse', juste, note, latenceMs: etat.latenceMs, tempsMs };
    }
    if (this.attaqueSansNote !== null && t - this.attaqueSansNote >= DELAI_NON_DETECTION_MS) {
      this.attaqueSansNote = null;
      return { type: 'nonReconnue' };
    }
    return null;
  }

  /** Vrai si le micro n'entend rien depuis plus de DUREE_SILENCE_RAPPEL_MS (message « Jouez la note… »). */
  silenceProlonge(tMs: number): boolean {
    return this.silenceDepuis !== null && tMs - this.silenceDepuis > DUREE_SILENCE_RAPPEL_MS;
  }
}
