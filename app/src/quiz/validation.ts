// Vérification d'une réponse. Mode 1 : la case touchée (spec §5.1). Le mode 2 s'ajoutera ici en phase 4.
import { casesDeLaNote, type Position } from '../music/manche';
import type { Question } from './tirage';

export interface ResultatMode1 {
  juste: boolean;
  /** Cases de la corde demandée qui donnent la note, dans le niveau (à montrer après une erreur). */
  casesCorrectes: number[];
}

/** Juste si la case touchée est sur la corde demandée et donne la note, à n'importe quelle octave du niveau. */
export function verifierMode1(question: Question, touchee: Position): ResultatMode1 {
  const casesCorrectes = casesDeLaNote(question.nom, question.position.corde, undefined, question.caseMax);
  const juste = touchee.corde === question.position.corde && casesCorrectes.includes(touchee.case);
  return { juste, casesCorrectes };
}
