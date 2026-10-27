// Vérification d'une réponse. Mode 1 : la case touchée (spec §5.1). Le mode 2 s'ajoutera ici en phase 4.
import type { Position } from '../music/manche';
import type { Question } from './tirage';

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
