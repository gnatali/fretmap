// Copie de poc-chute/src/jeu/progressif/ (docs/specs-poc-chute.md §16), avec l'option des notes naturelles seulement
// (facile, 01/11/2026). Notes du jeu : difficulté d'une position, notes de départ, notes ajoutées à chaque niveau.
import { CASE_MAX, NUMEROS_CORDES, noteDePosition, positions, type Position } from '../music/manche';

const cle = (p: Position) => `${p.corde}-${p.case}`;

/** La note de la position est altérée (dièse). */
export function estAlteree(position: Position): boolean {
  return noteDePosition(position).nom.includes('#');
}

/**
 * Difficulté d'une position : sa case (une note proche des cordes à vide est plus facile), plus `poidsAlteration`
 * si la note est altérée (les notes naturelles sont plus faciles). Les cordes à vide valent 0.
 */
export function difficulte(position: Position, poidsAlteration: number): number {
  return position.case + (estAlteree(position) ? poidsAlteration : 0);
}

/** Niveau 1 : les 6 cordes à vide, de la corde 6 à la corde 1. */
export function positionsDepart(): Position[] {
  return NUMEROS_CORDES.map((corde) => ({ corde, case: 0 }));
}

/**
 * Positions ajoutées au passage de niveau : les `nombre` positions du manche (cases 0 à 12) absentes du niveau dont
 * la difficulté est la plus proche de la difficulté moyenne du niveau validé. À égalité : la plus facile, puis de la
 * corde 6 à la corde 1, puis la case la plus basse. Avec `naturellesSeules`, les notes altérées ne sont jamais
 * ajoutées. Vide quand tout le manche (ou toutes ses notes naturelles) est dans le niveau.
 */
export function notesAAjouter(
  niveau: readonly Position[],
  nombre: number,
  poidsAlteration: number,
  naturellesSeules = false,
): Position[] {
  const dans = new Set(niveau.map(cle));
  const moyenne =
    niveau.length === 0 ? 0 : niveau.reduce((s, p) => s + difficulte(p, poidsAlteration), 0) / niveau.length;
  return positions(0, CASE_MAX)
    .filter((p) => !dans.has(cle(p)) && !(naturellesSeules && estAlteree(p)))
    .map((p) => ({ p, d: difficulte(p, poidsAlteration) }))
    .sort(
      (a, b) =>
        Math.abs(a.d - moyenne) - Math.abs(b.d - moyenne) ||
        a.d - b.d ||
        NUMEROS_CORDES.indexOf(a.p.corde) - NUMEROS_CORDES.indexOf(b.p.corde) ||
        a.p.case - b.p.case,
    )
    .slice(0, nombre)
    .map(({ p }) => p);
}
