// Contenu des niveaux (spec §5.4). Les conditions de passage et le déverrouillage arrivent en phase 6.
import { noteDePosition, positions, type Position } from '../music/manche';
import type { Mode, Niveau } from './modele';

/**
 * Dernière case jouable en mode 2 : plage validée par le POC (scénario 6, jusqu'à E5 en case 12 de la corde 1).
 * Une seule constante, à baisser si une nouvelle mesure le demande (spec §5.2).
 */
export const CASE_MAX_MODE2 = 12;

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

/** Dernière case d'un niveau dans un mode : en mode 2, limitée à la plage validée. */
export function caseMaxDuNiveau(niveau: Niveau, mode: Mode = 1): number {
  const { caseMax } = contenuNiveau(niveau);
  return mode === 2 ? Math.min(caseMax, CASE_MAX_MODE2) : caseMax;
}

/** Positions qu'un niveau peut demander dans un mode, de la corde 6 à la corde 1. */
export function positionsDuNiveau(niveau: Niveau, mode: Mode = 1): Position[] {
  const { naturelles } = contenuNiveau(niveau);
  return positions(0, caseMaxDuNiveau(niveau, mode)).filter((p) => !naturelles || !noteDePosition(p).nom.includes('#'));
}
