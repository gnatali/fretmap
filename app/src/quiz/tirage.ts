// Choix de la question (spec §5.1). Tirage uniforme ; la pondération par les statistiques arrive en phase 6.
import { noteDePosition, type Position } from '../music/manche';
import type { NomNote } from '../music/notes';

export interface Question {
  /** Position tirée : c'est elle qui reçoit la statistique. */
  position: Position;
  /** Note demandée, sans octave. */
  nom: NomNote;
  /** Dernière case du niveau : borne les cases acceptées. */
  caseMax: number;
}

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;

/**
 * Tire une question parmi les positions du niveau, sans reposer la précédente si une autre est possible.
 * @param hasard nombre dans [0, 1[ (injectable pour les tests)
 */
export function tirerQuestion(
  candidates: readonly Position[],
  caseMax: number,
  hasard: () => number = Math.random,
  precedente?: Position,
): Question {
  if (candidates.length === 0) throw new Error('Aucune position à tirer');
  const choix =
    precedente && candidates.length > 1 ? candidates.filter((p) => !memePosition(p, precedente)) : candidates;
  const position = choix[Math.min(choix.length - 1, Math.floor(hasard() * choix.length))]!;
  return { position, nom: noteDePosition(position).nom, caseMax };
}
