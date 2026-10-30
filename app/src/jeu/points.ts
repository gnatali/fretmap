// Points du jeu du mode 1 (spec §5.1, barème du mode progressif du POC « Notes qui tombent », docs/specs-poc-chute.md
// §6.6 et §16.3) : base et multiplicateur de série.

/** Points d'une note juste avant les facteurs : 100 (POC, spec §6.6). */
export const POINTS_BASE = 100;
/** Notes justes d'affilée par palier du multiplicateur : 10 (POC, spec §6.6). */
export const PALIER_SERIE = 10;
/** Multiplicateur de série maximal : ×4 (POC, spec §6.6). */
export const MULTIPLICATEUR_MAX = 4;

/** Multiplicateur d'une série (la note jouée comprise) : ×2 à la 10e note juste d'affilée, ×3 à la 20e, ×4 à la 30e. */
export function multiplicateur(serie: number): number {
  return Math.min(MULTIPLICATEUR_MAX, 1 + Math.floor(serie / PALIER_SERIE));
}
