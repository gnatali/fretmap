// Difficulté du jeu du mode 1 (spec §5.1, choix de l'utilisateur du 31/10/2026) : elle ne change que la condition de
// passage de niveau. Facile, normal et difficile règlent la réussite minimale du niveau ; hardcore demande que chaque
// note soit jouée plusieurs fois de suite sans erreur et vite.
import { REGLAGES_PROGRESSIF_DEFAUT, type ReglagesProgressif } from './reglages';

export type Difficulte = 'facile' | 'normal' | 'difficile' | 'hardcore';
export const DIFFICULTES: readonly Difficulte[] = ['facile', 'normal', 'difficile', 'hardcore'];
export const DIFFICULTE_DEFAUT: Difficulte = 'normal';

/**
 * Hardcore : derniers essais de chaque note qui doivent être justes du premier coup et rapides (délai depuis la note
 * précédente ≤ `delaiNoteBonMs`, 1,5 s) pour passer le niveau : 5 (demande de l'utilisateur, 31/10/2026).
 */
export const ESSAIS_HARDCORE = 5;

/** Réussite minimale du niveau (`seuilGlobal`) : 60 % en facile, 80 % en normal (le POC), 90 % en difficile. */
export const SEUILS_GLOBAUX: Readonly<Record<Difficulte, number>> = {
  facile: 0.6,
  normal: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
  difficile: 0.9,
  hardcore: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
};

export function estDifficulte(valeur: unknown): valeur is Difficulte {
  return DIFFICULTES.includes(valeur as Difficulte);
}

/** Réglages du jeu pour une difficulté ; en hardcore, chaque note doit avoir au moins ESSAIS_HARDCORE essais. */
export function reglagesDe(difficulte: Difficulte): ReglagesProgressif {
  return {
    ...REGLAGES_PROGRESSIF_DEFAUT,
    seuilGlobal: SEUILS_GLOBAUX[difficulte],
    ...(difficulte === 'hardcore' ? { essaisMinimum: ESSAIS_HARDCORE } : {}),
  };
}
