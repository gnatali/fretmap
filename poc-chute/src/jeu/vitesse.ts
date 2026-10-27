// Durée de chute adaptative (spec §6.5) : la vitesse suit le joueur pour le garder à sa limite.
// Toutes les valeurs sont des propositions, à ajuster d'après les mesures (hypothèse HC4).

/** Durée de chute de départ, de l'apparition à la ligne de jeu, en ms. 6 s (spec §6.1, Q11). */
export const DUREE_CHUTE_DEFAUT_MS = 6000;
/** Bornes de la durée de chute, en ms : 1 à 10 s (spec §6.5, Q11). */
export const DUREE_CHUTE_MIN_MS = 1000;
export const DUREE_CHUTE_MAX_MS = 10000;
/** Notes justes d'affilée avant d'accélérer. 5 (spec §6.5, Q10), à ajuster. */
export const NOTES_AVANT_ACCELERATION = 5;
/** Facteur appliqué à la durée de chute après NOTES_AVANT_ACCELERATION notes justes. 0,9 (spec §6.5), à ajuster. */
export const FACTEUR_ACCELERATION = 0.9;
/** Facteur appliqué à la durée de chute après une erreur (fausse note ou note ratée). 1,15 (spec §6.5, Q12), à ajuster. */
export const FACTEUR_RALENTISSEMENT = 1.15;

export interface EtatVitesse {
  /** Durée de chute actuelle, commune à toutes les notes à l'écran, en ms. */
  dureeMs: number;
  /** Notes justes depuis la dernière accélération ou la dernière erreur. */
  justesDAffilee: number;
  /** Option de mesure « vitesse fixe » : la durée ne change pas pendant la partie. */
  fixe: boolean;
}

/** Limite une durée de chute aux bornes ; une valeur non finie donne la durée par défaut. */
export function bornerDuree(dureeMs: number): number {
  if (!Number.isFinite(dureeMs)) return DUREE_CHUTE_DEFAUT_MS;
  return Math.min(DUREE_CHUTE_MAX_MS, Math.max(DUREE_CHUTE_MIN_MS, dureeMs));
}

export function vitesseInitiale(dureeMs: number = DUREE_CHUTE_DEFAUT_MS, fixe = false): EtatVitesse {
  return { dureeMs: bornerDuree(dureeMs), justesDAffilee: 0, fixe };
}

/** Vitesse après le résultat d'une note : accélère après une série de notes justes, ralentit après chaque erreur. */
export function apresResultat(vitesse: EtatVitesse, juste: boolean): EtatVitesse {
  if (vitesse.fixe) return vitesse;
  if (!juste) {
    return { ...vitesse, dureeMs: bornerDuree(vitesse.dureeMs * FACTEUR_RALENTISSEMENT), justesDAffilee: 0 };
  }
  const justesDAffilee = vitesse.justesDAffilee + 1;
  if (justesDAffilee < NOTES_AVANT_ACCELERATION) return { ...vitesse, justesDAffilee };
  return { ...vitesse, dureeMs: bornerDuree(vitesse.dureeMs * FACTEUR_ACCELERATION), justesDAffilee: 0 };
}
