// Barème (spec §6.6, Q13) : points = base × timing × vitesse × difficulté × multiplicateur de série.
// Toutes les valeurs sont des propositions, à ajuster après les premières parties.
import { noteDePosition, type Position } from '../music/manche';

/** Qualité du timing, d'après la part de la chute parcourue quand la note est validée (spec §6.3). */
export type Timing = 'parfait' | 'bien' | 'juste';

/** Progression maximale pour « Parfait », puis pour « Bien » : 1/3 et 2/3 de la chute (spec §6.3, Q9). */
export const SEUILS_TIMING = { parfait: 1 / 3, bien: 2 / 3 } as const;
/** Points d'une note juste avant les facteurs. 100 (spec §6.6). */
export const POINTS_BASE = 100;
/** Facteur de timing : ×1,5 / ×1,2 / ×1 (spec §6.6). */
export const BONUS_TIMING: Readonly<Record<Timing, number>> = { parfait: 1.5, bien: 1.2, juste: 1 };
/** Durée de chute qui donne un facteur de vitesse de 1, en ms : 5 s (spec §6.6). Plus rapide, la note vaut plus. */
export const DUREE_REFERENCE_VITESSE_MS = 5000;
/** Bonus de difficulté d'une note altérée (#) : +50 % (spec §6.6). */
export const BONUS_ALTEREE = 0.5;
/** Bonus de difficulté des cases hautes (CASE_HAUTE_MIN à 12) : +50 % (spec §6.6). */
export const BONUS_CASES_HAUTES = 0.5;
/** Première case « haute » : 7 (spec §6.6). */
export const CASE_HAUTE_MIN = 7;
/** Notes justes d'affilée par palier du multiplicateur : 10 (spec §6.6). */
export const PALIER_SERIE = 10;
/** Multiplicateur de série maximal : ×4 (spec §6.6). */
export const MULTIPLICATEUR_MAX = 4;

/** Timing d'une note validée à cette progression (0 = apparition, 1 = ligne de jeu). */
export function timingDe(progression: number): Timing {
  if (progression <= SEUILS_TIMING.parfait) return 'parfait';
  if (progression <= SEUILS_TIMING.bien) return 'bien';
  return 'juste';
}

/** Multiplicateur d'une série (la note jouée comprise) : ×2 à la 10e note juste d'affilée, ×3 à la 20e, ×4 à la 30e. */
export function multiplicateur(serie: number): number {
  return Math.min(MULTIPLICATEUR_MAX, 1 + Math.floor(serie / PALIER_SERIE));
}

/** Facteur de difficulté de la position demandée : ×1 à ×2. */
export function facteurDifficulte(position: Position): number {
  const alteree = noteDePosition(position).nom.includes('#');
  return 1 + (alteree ? BONUS_ALTEREE : 0) + (position.case >= CASE_HAUTE_MIN ? BONUS_CASES_HAUTES : 0);
}

export interface NoteJuste {
  timing: Timing;
  /** Durée de chute au moment de la validation, en ms. */
  dureeChuteMs: number;
  /** Position demandée. */
  position: Position;
  /** Série, la note jouée comprise. */
  serie: number;
}

/** Points d'une note juste, arrondis à l'entier. Une erreur ne rapporte rien et ne retire rien. */
export function pointsNote({ timing, dureeChuteMs, position, serie }: NoteJuste): number {
  const vitesse = DUREE_REFERENCE_VITESSE_MS / dureeChuteMs;
  return Math.round(POINTS_BASE * BONUS_TIMING[timing] * vitesse * facteurDifficulte(position) * multiplicateur(serie));
}
