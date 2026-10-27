// Choix de la question (spec §5.1). Tirage uniforme ; la pondération par les statistiques arrive en phase 6.
import { casesDeLaNote, noteDePosition, type Position } from '../music/manche';
import type { NomNote } from '../music/notes';

export interface Question {
  /** Position tirée : elle reçoit la statistique d'une réponse fausse. */
  position: Position;
  /** Note demandée, sans octave. */
  nom: NomNote;
  /** La question indique la corde (pas au niveau 1, où la corde serait la réponse). */
  cordeDemandee: boolean;
  /** Toutes les positions acceptées : sur la corde demandée, ou parmi celles du niveau si la corde n'est pas donnée. */
  positionsCorrectes: Position[];
}

export interface OptionsTirage {
  /** Dernière case du niveau : borne les cases acceptées. */
  caseMax: number;
  cordeDemandee: boolean;
}

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;

function choisir<T>(liste: readonly T[], hasard: () => number): T {
  return liste[Math.min(liste.length - 1, Math.floor(hasard() * liste.length))]!;
}

/**
 * Tire une question parmi les positions du niveau, sans reposer la précédente si une autre est possible.
 * Sans corde demandée, le tirage porte sur les noms de note (E, présent sur deux cordes, ne sort pas deux fois plus).
 * @param hasard nombre dans [0, 1[ (injectable pour les tests)
 */
export function tirerQuestion(
  candidates: readonly Position[],
  options: OptionsTirage,
  hasard: () => number = Math.random,
  precedente?: Question,
): Question {
  if (candidates.length === 0) throw new Error('Aucune position à tirer');
  const { caseMax, cordeDemandee } = options;

  if (cordeDemandee) {
    const choix =
      precedente && candidates.length > 1
        ? candidates.filter((p) => !memePosition(p, precedente.position))
        : candidates;
    const position = choisir(choix, hasard);
    const nom = noteDePosition(position).nom;
    const positionsCorrectes = casesDeLaNote(nom, position.corde, undefined, caseMax).map((k) => ({
      corde: position.corde,
      case: k,
    }));
    return { position, nom, cordeDemandee, positionsCorrectes };
  }

  const noms = [...new Set(candidates.map((p) => noteDePosition(p).nom))];
  const nom = choisir(precedente && noms.length > 1 ? noms.filter((n) => n !== precedente.nom) : noms, hasard);
  const positionsCorrectes = candidates.filter((p) => noteDePosition(p).nom === nom);
  return { position: positionsCorrectes[0]!, nom, cordeDemandee, positionsCorrectes };
}
