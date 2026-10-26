// Définitions des accordages, choix de la corde et logique de l'accordeur. Fonctions pures, sans DOM.
import { A4_DEFAUT_HZ, ecartCents, frequenceVersNote, midiVersFrequence, nomVersMidi } from './notes';

/** Écart toléré pour considérer la note juste (zone verte), en cents. Valeur initiale ±5 cents. */
export const TOLERANCE_JUSTE_CENTS = 5;
/** Limite de la zone orange, en cents. Valeur initiale ±15 cents. */
export const TOLERANCE_PROCHE_CENTS = 15;
/** Étendue de l'aiguille de part et d'autre de la cible, en cents. */
export const ETENDUE_AIGUILLE_CENTS = 50;
/** Durée passée dans la zone verte avant d'indiquer « juste », en ms. Valeur initiale 300 ms. */
export const DUREE_JUSTE_MS = 300;

export interface Accordage {
  id: string;
  nom: string;
  /** Notes des cordes à vide, de la 6e (grave) à la 1re (aiguë). */
  notes: readonly [string, string, string, string, string, string];
}

export interface Corde {
  /** Numéro de corde : 6 = grave, 1 = aiguë. */
  numero: number;
  note: string;
  midi: number;
  /** Fréquence cible en Hz, calculée à partir de la référence A4. */
  frequence: number;
}

export const ACCORDAGES: readonly Accordage[] = [
  { id: 'standard', nom: 'Standard', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'demi-ton-bas', nom: 'Demi-ton plus bas', notes: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
  { id: 'drop-d', nom: 'Drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'dadgad', nom: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
];

export const ACCORDAGE_STANDARD = ACCORDAGES[0]!;

export function trouverAccordage(id: string): Accordage | undefined {
  return ACCORDAGES.find((a) => a.id === id);
}

/** Cordes d'un accordage avec leurs fréquences cibles pour la référence A4 donnée (de la 6e à la 1re). */
export function cordes(accordage: Accordage, a4: number = A4_DEFAUT_HZ): Corde[] {
  return accordage.notes.map((note, i) => {
    const midi = nomVersMidi(note);
    if (midi === null) throw new Error(`Note invalide dans l'accordage ${accordage.id} : ${note}`);
    return { numero: 6 - i, note, midi, frequence: midiVersFrequence(midi, a4) };
  });
}

/** Corde dont la fréquence cible est la plus proche, mesurée en cents (échelle logarithmique). */
export function cordeLaPlusProche(
  frequence: number,
  accordage: Accordage,
  a4: number = A4_DEFAUT_HZ,
): { corde: Corde; cents: number } | null {
  if (!(frequence > 0) || !Number.isFinite(frequence)) return null;
  let meilleure: { corde: Corde; cents: number } | null = null;
  for (const corde of cordes(accordage, a4)) {
    const cents = ecartCents(frequence, corde.frequence);
    if (!meilleure || Math.abs(cents) < Math.abs(meilleure.cents)) meilleure = { corde, cents };
  }
  return meilleure;
}

export type Zone = 'juste' | 'proche' | 'loin';

/** Zone de l'aiguille : verte (juste), orange (proche) ou rouge (loin). */
export function zoneEcart(cents: number): Zone {
  const ecart = Math.abs(cents);
  if (ecart <= TOLERANCE_JUSTE_CENTS) return 'juste';
  if (ecart <= TOLERANCE_PROCHE_CENTS) return 'proche';
  return 'loin';
}

export type ModeAccordeur = 'cordes' | 'chromatique';

export interface OptionsAccordeur {
  mode: ModeAccordeur;
  accordage: Accordage;
  /** Corde choisie (6 à 1), ou null pour la sélection automatique de la corde la plus proche. */
  numeroCorde: number | null;
  a4: number;
}

export interface CibleAccordeur {
  /** Note visée, ex. « E2 ». */
  libelle: string;
  /** Fréquence visée, en Hz. */
  frequence: number;
  /** Écart de la fréquence mesurée à la cible, en cents (peut dépasser ±50 en mode cordes). */
  cents: number;
  /** Corde visée en mode cordes, null en mode chromatique. */
  corde: Corde | null;
}

/** Cible de l'accordeur pour une fréquence mesurée (stable), selon le mode et la corde choisie. */
export function cibleAccordeur(frequence: number, options: OptionsAccordeur): CibleAccordeur | null {
  const { mode, accordage, numeroCorde, a4 } = options;
  if (mode === 'chromatique') {
    const note = frequenceVersNote(frequence, a4);
    if (!note) return null;
    return { libelle: note.libelle, frequence: midiVersFrequence(note.midi, a4), cents: note.centsExacts, corde: null };
  }
  if (!(frequence > 0) || !Number.isFinite(frequence)) return null;
  const choisie = numeroCorde === null ? undefined : cordes(accordage, a4).find((c) => c.numero === numeroCorde);
  if (choisie) {
    return {
      libelle: choisie.note,
      frequence: choisie.frequence,
      cents: ecartCents(frequence, choisie.frequence),
      corde: choisie,
    };
  }
  const proche = cordeLaPlusProche(frequence, accordage, a4);
  if (!proche) return null;
  return { libelle: proche.corde.note, frequence: proche.corde.frequence, cents: proche.cents, corde: proche.corde };
}

/**
 * Indique si la note est restée dans la zone verte pendant `dureeMs` consécutives, sur la même cible.
 * Le temps est fourni par l'appelant pour rester testable.
 */
export class SuiviJustesse {
  private depuis: number | null = null;
  private cle: string | null = null;

  constructor(readonly dureeMs: number = DUREE_JUSTE_MS) {}

  /** @param cents écart à la cible, ou null sans note stable. @param cle identifiant de la cible (ex. « E2 »). */
  traiter(cents: number | null, cle: string | null, tMs: number): boolean {
    const dansZone = cents !== null && cle !== null && zoneEcart(cents) === 'juste';
    if (!dansZone) {
      this.depuis = null;
    } else if (this.depuis === null || cle !== this.cle) {
      this.depuis = tMs;
    }
    this.cle = cle;
    return this.depuis !== null && tMs - this.depuis >= this.dureeMs;
  }

  reinitialiser(): void {
    this.depuis = null;
    this.cle = null;
  }
}
