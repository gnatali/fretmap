// Réglages du mode progressif (spec §16, annexe B) : valeurs par défaut et bornes. Tous sont réglables sur l'écran
// de départ ; les valeurs par défaut sont des propositions, à ajuster d'après les mesures.
import type { MethodeGlobale, MethodeNote } from './reussite';

export interface ReglagesProgressif {
  /** Méthode de réussite d'une note qui mène le jeu (tirage, passage, affichage). */
  methodeNote: MethodeNote;
  /** Méthode de réussite globale qui mène le jeu. */
  methodeGlobale: MethodeGlobale;
  /** Réussite minimale de chaque note du niveau pour le passer (0 à 1). */
  seuilNote: number;
  /** Réussite globale minimale pour passer le niveau (0 à 1). */
  seuilGlobal: number;
  /**
   * Plafond de vitesse au niveau 1, en part de la vitesse max (0 à 1). La vitesse ne dépasse pas le plafond du niveau,
   * et l'atteindre est une condition du passage.
   */
  vitesseDepart: number;
  /** Hausse du plafond de vitesse à chaque niveau, en part de la vitesse max. */
  vitesseParNiveau: number;
  /** Durée de chute à la vitesse max (« vitesse max »), en ms. */
  dureeChuteMinMs: number;
  /** Notes ajoutées à chaque passage de niveau. */
  notesAjoutees: number;
  /** Derniers essais d'une note pris en compte dans sa réussite (N). */
  essaisNote: number;
  /** Derniers essais, toutes notes confondues, de la méthode globale « derniers » (M). */
  essaisGlobaux: number;
  /** Essais minimum de chaque note du niveau avant de pouvoir le passer. */
  essaisMinimum: number;
  /** Difficulté d'une note altérée (#), en cases ajoutées à sa case. */
  poidsAlteration: number;
  /** Délai depuis la note précédente : rapidité de 1 jusqu'à « bon », de 0 à partir de « lent », en ms. */
  delaiNoteBonMs: number;
  delaiNoteLentMs: number;
  /** Délai après l'apparition de la note en haut de l'écran : même règle, en ms. */
  delaiApparitionBonMs: number;
  delaiApparitionLentMs: number;
  /** Hausse de la vitesse après une note juste, multipliée par son score d'essai (part de la vitesse max). */
  acceleration: number;
  /** Baisse de la vitesse après chaque erreur (fausse note, note perdue ou ratée), en part de la vitesse. */
  ralentissement: number;
  /** Points retirés par une fausse note (la note reste à jouer). */
  penaliteFausse: number;
  /** Points retirés quand la note disparaît sans être jouée juste (3 fausses notes, ou arrivée en bas). */
  penalitePerdue: number;
  /** Points gagnés au passage de niveau, multipliés par le numéro du niveau validé. */
  bonusNiveau: number;
}

/**
 * Valeurs par défaut (propositions du 30/10/2026, spec §16). Plafond de vitesse : 30 % au niveau 1, + 5 % par niveau
 * (réponse de l'utilisateur après le premier journal, annexe B9).
 */
export const REGLAGES_PROGRESSIF_DEFAUT: Readonly<ReglagesProgressif> = {
  methodeNote: 'score',
  methodeGlobale: 'moyenne',
  seuilNote: 0.6,
  seuilGlobal: 0.8,
  vitesseDepart: 0.3,
  vitesseParNiveau: 0.05,
  dureeChuteMinMs: 3000,
  notesAjoutees: 3,
  essaisNote: 5,
  essaisGlobaux: 10,
  essaisMinimum: 3,
  poidsAlteration: 3,
  delaiNoteBonMs: 1500,
  delaiNoteLentMs: 6000,
  delaiApparitionBonMs: 2000,
  delaiApparitionLentMs: 10000,
  acceleration: 0.1,
  ralentissement: 0.15,
  penaliteFausse: 50,
  penalitePerdue: 150,
  bonusNiveau: 500,
};

export type CleNumerique = Exclude<keyof ReglagesProgressif, 'methodeNote' | 'methodeGlobale'>;

/** Bornes et pas de chaque réglage numérique (stockage et curseurs de l'écran de départ). */
export const BORNES_PROGRESSIF: Readonly<Record<CleNumerique, { min: number; max: number; pas: number }>> = {
  seuilNote: { min: 0.3, max: 1, pas: 0.05 },
  seuilGlobal: { min: 0.3, max: 1, pas: 0.05 },
  vitesseDepart: { min: 0.1, max: 1, pas: 0.05 },
  vitesseParNiveau: { min: 0, max: 0.5, pas: 0.05 },
  dureeChuteMinMs: { min: 1000, max: 10000, pas: 500 },
  notesAjoutees: { min: 1, max: 6, pas: 1 },
  essaisNote: { min: 2, max: 20, pas: 1 },
  essaisGlobaux: { min: 5, max: 50, pas: 5 },
  essaisMinimum: { min: 1, max: 10, pas: 1 },
  poidsAlteration: { min: 0, max: 12, pas: 1 },
  delaiNoteBonMs: { min: 500, max: 10000, pas: 500 },
  delaiNoteLentMs: { min: 1000, max: 20000, pas: 500 },
  delaiApparitionBonMs: { min: 500, max: 10000, pas: 500 },
  delaiApparitionLentMs: { min: 1000, max: 30000, pas: 500 },
  acceleration: { min: 0.01, max: 0.5, pas: 0.01 },
  ralentissement: { min: 0, max: 0.5, pas: 0.05 },
  penaliteFausse: { min: 0, max: 200, pas: 10 },
  penalitePerdue: { min: 0, max: 500, pas: 10 },
  bonusNiveau: { min: 0, max: 2000, pas: 100 },
};

/** Valeur ramenée dans ses bornes et sur son pas ; une valeur non finie donne la valeur par défaut. */
export function bornerReglage(cle: CleNumerique, valeur: number): number {
  if (!Number.isFinite(valeur)) return REGLAGES_PROGRESSIF_DEFAUT[cle];
  const { min, max, pas } = BORNES_PROGRESSIF[cle];
  const surLePas = min + Math.round((valeur - min) / pas) * pas;
  // Arrondi à 6 décimales : 0,1 × 6 ne doit pas devenir 0,6000000000000001.
  return Math.round(Math.min(max, Math.max(min, surLePas)) * 1e6) / 1e6;
}

/** Plafond de vitesse d'un niveau : vitesseDepart + (niveau − 1) × vitesseParNiveau, sans dépasser la vitesse max. */
export function plafondVitesse(
  niveau: number,
  reglages: Pick<ReglagesProgressif, 'vitesseDepart' | 'vitesseParNiveau'>,
): number {
  const plafond = reglages.vitesseDepart + (niveau - 1) * reglages.vitesseParNiveau;
  return Math.round(Math.min(1, plafond) * 1e6) / 1e6;
}

/** Premier niveau joué à la vitesse max, ou null si le plafond n'y arrive jamais (hausse nulle). */
export function niveauVitessePleine(
  reglages: Pick<ReglagesProgressif, 'vitesseDepart' | 'vitesseParNiveau'>,
): number | null {
  if (reglages.vitesseDepart >= 1) return 1;
  if (reglages.vitesseParNiveau <= 0) return null;
  return 1 + Math.ceil((1 - reglages.vitesseDepart) / reglages.vitesseParNiveau - 1e-9);
}
