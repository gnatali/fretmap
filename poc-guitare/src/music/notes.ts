// Conversion fréquence ↔ MIDI ↔ nom de note. Fonctions pures, sans DOM.
// Convention : noms en dièses uniquement (A#4 et non Bb4), octave scientifique (A4 = MIDI 69).

/** Référence A4 par défaut, en Hz. */
export const A4_DEFAUT_HZ = 440;
/** Bornes de la référence A4 réglable, en Hz. */
export const A4_MIN_HZ = 430;
export const A4_MAX_HZ = 450;

const MIDI_A4 = 69;

export const NOMS_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NomNote = (typeof NOMS_NOTES)[number];

const BEMOLS: Record<string, NomNote> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

export interface Note {
  /** Numéro MIDI entier de la note la plus proche. */
  midi: number;
  nom: NomNote;
  octave: number;
  /** Nom complet avec octave, ex. « E2 ». */
  libelle: string;
}

export interface NoteDetectee extends Note {
  /** Fréquence analysée, en Hz. */
  frequence: number;
  /** Écart à la note la plus proche, arrondi au cent (négatif = trop bas). */
  cents: number;
  /** Écart non arrondi, en cents, pour les calculs (moyennes, journal). */
  centsExacts: number;
}

/** Limite A4 à la plage réglable [430, 450] Hz. */
export function bornerA4(a4: number): number {
  if (!Number.isFinite(a4)) return A4_DEFAUT_HZ;
  return Math.min(A4_MAX_HZ, Math.max(A4_MIN_HZ, a4));
}

/** Numéro MIDI fractionnaire d'une fréquence. NaN si la fréquence n'est pas strictement positive. */
export function frequenceVersMidiFloat(frequence: number, a4: number = A4_DEFAUT_HZ): number {
  if (!(frequence > 0) || !Number.isFinite(frequence)) return Number.NaN;
  return MIDI_A4 + 12 * Math.log2(frequence / a4);
}

export function midiVersFrequence(midi: number, a4: number = A4_DEFAUT_HZ): number {
  return a4 * 2 ** ((midi - MIDI_A4) / 12);
}

export function midiVersNote(midi: number): Note {
  const nom = NOMS_NOTES[((midi % 12) + 12) % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return { midi, nom, octave, libelle: `${nom}${octave}` };
}

/**
 * Note la plus proche d'une fréquence.
 * Renvoie null pour une fréquence nulle, négative ou non finie (aucune note ne lui correspond).
 * Le filtrage de la plage utile (70–1400 Hz) relève de la détection (audio/pitch.ts), pas de ce module.
 */
export function frequenceVersNote(frequence: number, a4: number = A4_DEFAUT_HZ): NoteDetectee | null {
  const midiFloat = frequenceVersMidiFloat(frequence, a4);
  if (Number.isNaN(midiFloat)) return null;
  const midi = Math.round(midiFloat);
  const centsExacts = (midiFloat - midi) * 100;
  return { ...midiVersNote(midi), frequence, cents: Math.round(centsExacts) || 0, centsExacts };
}

/** Écart en cents entre une fréquence et une fréquence de référence (négatif = trop bas). */
export function ecartCents(frequence: number, reference: number): number {
  return 1200 * Math.log2(frequence / reference);
}

/** Lit un nom de note (« E2 », « F#3 », « Bb4 ») et renvoie son numéro MIDI, ou null si invalide. */
export function nomVersMidi(libelle: string): number | null {
  const m = /^\s*([A-Ga-g])([#b]?)(-?\d+)\s*$/.exec(libelle);
  if (!m) return null;
  const base = m[1]!.toUpperCase() + m[2]!;
  const nom = BEMOLS[base] ?? base;
  const index = NOMS_NOTES.indexOf(nom as NomNote);
  if (index < 0) {
    // Cas E#, B#, Cb, Fb : on les ramène par décalage d'un demi-ton.
    const naturel = NOMS_NOTES.indexOf(m[1]!.toUpperCase() as NomNote);
    const decalage = m[2] === '#' ? 1 : -1;
    return (Number(m[3]) + 1) * 12 + naturel + decalage;
  }
  return (Number(m[3]) + 1) * 12 + index;
}
