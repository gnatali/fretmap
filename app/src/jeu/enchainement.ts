// Copie de poc-chute/src/jeu/ (docs/specs-poc-chute.md §6.8, §16.3). Enchaînement des notes tirées : pas deux notes
// du même nom trop près l'une de l'autre (A2 puis A3, par exemple). Filtre les candidates avant `tirerQuestion`.
import { noteDePosition, type Position } from '../music/manche';
import type { NomNote } from '../music/notes';

/**
 * Noms des dernières notes tirées écartés du tirage suivant : 2, un nom ne revient qu'après au moins 2 notes d'un
 * autre nom (demande de l'utilisateur après le premier journal, annexe B10).
 */
export const NOMS_ECARTES = 2;

/**
 * Candidates sans les noms des `NOMS_ECARTES` dernières notes tirées. S'il n'en reste aucune, seul le dernier nom
 * est écarté, puis aucun. Un nom écarté l'est sur toutes ses positions : celles d'un nom gardé restent toutes.
 * @param nomsRecents noms tirés, du plus ancien au plus récent
 */
export function sansNomsRecents(candidates: readonly Position[], nomsRecents: readonly NomNote[]): Position[] {
  for (let ecartes = Math.min(NOMS_ECARTES, nomsRecents.length); ecartes > 0; ecartes--) {
    const exclus = new Set(nomsRecents.slice(-ecartes));
    const restantes = candidates.filter((p) => !exclus.has(noteDePosition(p).nom));
    if (restantes.length > 0) return restantes;
  }
  return [...candidates];
}

/** Ajoute le nom tiré à la liste des noms récents, réduite aux `NOMS_ECARTES` derniers. */
export function retenirNom(nomsRecents: readonly NomNote[], nom: NomNote): NomNote[] {
  return [...nomsRecents, nom].slice(-NOMS_ECARTES);
}
