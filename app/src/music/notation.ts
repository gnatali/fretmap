// Nom affiché d'une note selon la notation choisie (spec §5.4). Affichage seulement : les données restent en
// notation anglo-saxonne (NomNote). L'octave garde le même numéro dans les deux notations (Mi2 = E2).
import type { NomNote } from './notes';

export type Notation = 'anglo-saxonne' | 'francaise' | 'les-deux';
export const NOTATIONS: readonly Notation[] = ['les-deux', 'francaise', 'anglo-saxonne'];

export const NOMS_FRANCAIS: Readonly<Record<NomNote, string>> = {
  C: 'Do',
  'C#': 'Do#',
  D: 'Ré',
  'D#': 'Ré#',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa#',
  G: 'Sol',
  'G#': 'Sol#',
  A: 'La',
  'A#': 'La#',
  B: 'Si',
};

/** « E », « Mi » ou « Mi (E) » ; avec l'octave : « E2 », « Mi2 » ou « Mi2 (E2) ». */
export function nomAffiche(nom: NomNote, notation: Notation, octave?: number): string {
  const suffixe = octave === undefined ? '' : String(octave);
  const anglo = `${nom}${suffixe}`;
  const francais = `${NOMS_FRANCAIS[nom]}${suffixe}`;
  if (notation === 'anglo-saxonne') return anglo;
  if (notation === 'francaise') return francais;
  return `${francais} (${anglo})`;
}

/** Pour les places étroites (bulles du manche) : avec « les deux », le français au-dessus, l'anglo-saxon dessous. */
export function nomSurDeuxLignes(nom: NomNote, notation: Notation): { haut: string; bas: string | null } {
  if (notation === 'les-deux') return { haut: NOMS_FRANCAIS[nom], bas: nom };
  return { haut: nomAffiche(nom, notation), bas: null };
}
