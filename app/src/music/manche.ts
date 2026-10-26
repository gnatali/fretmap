// Manche : note d'une position (corde, case) et positions d'une note. Fonctions pures, sans DOM.
import { ACCORDAGE_STANDARD, cordes, type Accordage } from './accordages';
import { midiVersNote, type NomNote, type Note } from './notes';

/** Dernière case du manche (spec §5.1) : E5 à la case 12 de la corde 1, limite validée par le POC. */
export const CASE_MAX = 12;
/** Cases repérées par un marqueur sur le manche (spec §5.1). */
export const MARQUEURS: readonly number[] = [3, 5, 7, 9, 12];

/** Numéro de corde : 1 = la plus aiguë (E4), 6 = la plus grave (E2). */
export type NumeroCorde = 1 | 2 | 3 | 4 | 5 | 6;
export const NUMEROS_CORDES: readonly NumeroCorde[] = [6, 5, 4, 3, 2, 1];

export interface Position {
  corde: NumeroCorde;
  /** 0 = corde à vide. */
  case: number;
}

export function estNumeroCorde(valeur: unknown): valeur is NumeroCorde {
  return Number.isInteger(valeur) && (valeur as number) >= 1 && (valeur as number) <= 6;
}

export function estCase(valeur: unknown): valeur is number {
  return Number.isInteger(valeur) && (valeur as number) >= 0 && (valeur as number) <= CASE_MAX;
}

function midiAVide(corde: NumeroCorde, accordage: Accordage): number {
  return cordes(accordage).find((c) => c.numero === corde)!.midi;
}

/** Note jouée à une position. Lève une erreur hors du manche (corde 1 à 6, case 0 à CASE_MAX). */
export function noteDePosition(position: Position, accordage: Accordage = ACCORDAGE_STANDARD): Note {
  if (!estNumeroCorde(position.corde) || !estCase(position.case)) {
    throw new Error(`Position hors du manche : corde ${position.corde}, case ${position.case}`);
  }
  return midiVersNote(midiAVide(position.corde, accordage) + position.case);
}

/** Cases d'une corde qui donnent ce nom de note, toutes octaves confondues (une corde à vide et sa case 12). */
export function casesDeLaNote(
  nom: NomNote,
  corde: NumeroCorde,
  accordage: Accordage = ACCORDAGE_STANDARD,
  caseMax: number = CASE_MAX,
): number[] {
  const midi = midiAVide(corde, accordage);
  const cases: number[] = [];
  for (let k = 0; k <= caseMax; k++) if (midiVersNote(midi + k).nom === nom) cases.push(k);
  return cases;
}

/** Toutes les positions entre deux cases incluses, de la corde 6 à la corde 1. */
export function positions(caseMin = 0, caseMax: number = CASE_MAX): Position[] {
  return NUMEROS_CORDES.flatMap((corde) =>
    Array.from({ length: caseMax - caseMin + 1 }, (_, i): Position => ({ corde, case: caseMin + i })),
  );
}
