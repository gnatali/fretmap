// Contenu des niveaux (spec §5.4). Les conditions de passage et le déverrouillage arrivent en phase 6.
import { noteDePosition, positions, type Position } from '../music/manche';
import type { Niveau } from './modele';

export interface ContenuNiveau {
  niveau: Niveau;
  /** Dernière case jouée (la première est toujours la case 0, à vide). */
  caseMax: number;
  /** Notes naturelles seulement (sans dièse). */
  naturelles: boolean;
  /** La question indique la corde. Pas au niveau 1 : avec les cordes à vide, la corde serait la réponse. */
  cordeDemandee: boolean;
}

export const NIVEAUX: readonly ContenuNiveau[] = [
  { niveau: 1, caseMax: 0, naturelles: false, cordeDemandee: false },
  { niveau: 2, caseMax: 5, naturelles: true, cordeDemandee: true },
  { niveau: 3, caseMax: 5, naturelles: false, cordeDemandee: true },
  { niveau: 4, caseMax: 7, naturelles: true, cordeDemandee: true },
  { niveau: 5, caseMax: 7, naturelles: false, cordeDemandee: true },
  { niveau: 6, caseMax: 12, naturelles: true, cordeDemandee: true },
  { niveau: 7, caseMax: 12, naturelles: false, cordeDemandee: true },
];

export function contenuNiveau(niveau: Niveau): ContenuNiveau {
  return NIVEAUX[niveau - 1]!;
}

/** Positions qu'un niveau peut demander, de la corde 6 à la corde 1. */
export function positionsDuNiveau(niveau: Niveau): Position[] {
  const { caseMax, naturelles } = contenuNiveau(niveau);
  return positions(0, caseMax).filter((p) => !naturelles || !noteDePosition(p).nom.includes('#'));
}
