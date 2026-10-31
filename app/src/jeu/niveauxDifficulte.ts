// Difficulté du jeu du mode 1 (spec §5.1, choix de l'utilisateur du 31/10/2026) : elle change la condition de passage
// de niveau, et l'aide en facile. Facile, normal et difficile règlent la réussite minimale du niveau (et de chaque note
// en facile) ; hardcore demande que chaque note ait été jouée plusieurs fois de suite sans erreur et vite.
import { REGLAGES_PROGRESSIF_DEFAUT, type ReglagesProgressif } from './reglages';

export type Difficulte = 'facile' | 'normal' | 'difficile' | 'hardcore';
export const DIFFICULTES: readonly Difficulte[] = ['facile', 'normal', 'difficile', 'hardcore'];
export const DIFFICULTE_DEFAUT: Difficulte = 'normal';

/**
 * Hardcore : essais de suite, justes du premier coup et rapides (délai depuis la note précédente ≤ `delaiNoteBonMs`,
 * 1,5 s), qui rendent une note acquise pour la partie (reussite.ts, `acquise`) : 5 (demande de l'utilisateur,
 * 31/10/2026).
 */
export const ESSAIS_HARDCORE = 5;

/** Réussite minimale du niveau (`seuilGlobal`) : 60 % en facile, 80 % en normal (le POC), 90 % en difficile. */
export const SEUILS_GLOBAUX: Readonly<Record<Difficulte, number>> = {
  facile: 0.6,
  normal: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
  difficile: 0.9,
  hardcore: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
};

/**
 * Réussite minimale de chaque note (`seuilNote`) : 40 % en facile (2e journal du 31/10/2026 : une seule note faible
 * bloquait le niveau 5 pendant 153 essais), 60 % ailleurs (le POC).
 */
export const SEUILS_NOTE: Readonly<Record<Difficulte, number>> = {
  facile: 0.4,
  normal: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
  difficile: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
  hardcore: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
};

/** Aide : la bonne case s'allume dès la 1re case fausse, jusqu'au résultat de la note ; en facile seulement. */
export const AIDE_APRES_ERREUR: Readonly<Record<Difficulte, boolean>> = {
  facile: true,
  normal: false,
  difficile: false,
  hardcore: false,
};

export function estDifficulte(valeur: unknown): valeur is Difficulte {
  return DIFFICULTES.includes(valeur as Difficulte);
}

/** Réglages du jeu pour une difficulté ; en hardcore, chaque note doit avoir au moins ESSAIS_HARDCORE essais. */
export function reglagesDe(difficulte: Difficulte): ReglagesProgressif {
  return {
    ...REGLAGES_PROGRESSIF_DEFAUT,
    seuilNote: SEUILS_NOTE[difficulte],
    seuilGlobal: SEUILS_GLOBAUX[difficulte],
    ...(difficulte === 'hardcore' ? { essaisMinimum: ESSAIS_HARDCORE } : {}),
  };
}
