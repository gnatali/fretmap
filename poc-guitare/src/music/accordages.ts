// Définitions des accordages et choix de la corde la plus proche. Fonctions pures, sans DOM.
import { A4_DEFAUT_HZ, ecartCents, midiVersFrequence, nomVersMidi } from './notes';

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
