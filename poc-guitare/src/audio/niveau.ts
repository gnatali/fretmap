// Mesure du volume (RMS), seuil de silence et détection d'attaque. Fonctions pures, sans DOM.

/** Seuil de silence initial, en dBFS. Valeur initiale −45 dBFS, à calibrer pendant les tests. */
export const SEUIL_SILENCE_DBFS_DEFAUT = -45;
/** Marge ajoutée au bruit ambiant mesuré pour fixer le seuil, en dB. Valeur initiale 10 dB. */
export const MARGE_CALIBRAGE_DB = 10;
/** Durée de mesure du bruit ambiant, en ms. Valeur initiale 2000 ms. */
export const DUREE_CALIBRAGE_MS = 2000;
/** Niveau plancher renvoyé pour un signal nul, en dBFS. */
export const PLANCHER_DBFS = -120;

/**
 * Hausse de niveau qui signale une nouvelle attaque alors que la corde sonne encore, en dB.
 * Valeur initiale 6 dB, à calibrer.
 */
export const HAUSSE_ATTAQUE_DB = 6;
/** Fenêtre sur laquelle on cherche le minimum de niveau avant une hausse, en ms. Valeur initiale 100 ms. */
export const FENETRE_ATTAQUE_MS = 100;
/** Délai minimal entre deux attaques, en ms. Valeur initiale 150 ms. */
export const REFRACTAIRE_ATTAQUE_MS = 150;

/** Valeur efficace (RMS) d'un tampon d'échantillons dans [−1, 1]. */
export function rms(tampon: ArrayLike<number>): number {
  if (tampon.length === 0) return 0;
  let somme = 0;
  for (let i = 0; i < tampon.length; i++) {
    const v = tampon[i]!;
    somme += v * v;
  }
  return Math.sqrt(somme / tampon.length);
}

/** Conversion d'une valeur RMS en dBFS (0 dBFS = pleine échelle), bornée par PLANCHER_DBFS. */
export function rmsVersDbfs(valeurRms: number): number {
  if (!(valeurRms > 0)) return PLANCHER_DBFS;
  return Math.max(PLANCHER_DBFS, 20 * Math.log10(valeurRms));
}

export function dbfsVersRms(dbfs: number): number {
  return 10 ** (dbfs / 20);
}

/**
 * Seuil de silence calculé à partir de mesures de bruit ambiant (en dBFS).
 * La moyenne est faite sur les valeurs RMS linéaires (et non sur les dB), puis on ajoute la marge.
 */
export function seuilDepuisBruit(mesuresDbfs: readonly number[], marge: number = MARGE_CALIBRAGE_DB): number {
  if (mesuresDbfs.length === 0) return SEUIL_SILENCE_DBFS_DEFAUT;
  const moyenneRms = mesuresDbfs.reduce((s, db) => s + dbfsVersRms(db), 0) / mesuresDbfs.length;
  return rmsVersDbfs(moyenneRms) + marge;
}

/**
 * Détecte l'attaque d'une note à partir du niveau mesuré à chaque analyse.
 * Une attaque est signalée quand le niveau franchit le seuil de silence,
 * ou quand il monte d'au moins HAUSSE_ATTAQUE_DB par rapport au minimum récent (corde rejouée
 * alors qu'elle sonne encore).
 */
export class DetecteurAttaque {
  private historique: { t: number; db: number }[] = [];
  private derniereAttaque = Number.NEGATIVE_INFINITY;

  /** @returns true si une attaque est détectée à l'instant `tMs`. */
  traiter(niveauDbfs: number, seuilDbfs: number, tMs: number): boolean {
    const precedents = this.historique.filter((h) => tMs - h.t <= FENETRE_ATTAQUE_MS);
    this.historique = [...precedents, { t: tMs, db: niveauDbfs }];

    if (niveauDbfs < seuilDbfs) return false;
    if (tMs - this.derniereAttaque < REFRACTAIRE_ATTAQUE_MS) return false;

    const precedent = precedents[precedents.length - 1];
    const franchitSeuil = !precedent || precedent.db < seuilDbfs;
    const minimumRecent = Math.min(...precedents.map((h) => h.db));
    const hausse = precedents.length > 0 && niveauDbfs - minimumRecent >= HAUSSE_ATTAQUE_DB;

    if (franchitSeuil || hausse) {
      this.derniereAttaque = tMs;
      return true;
    }
    return false;
  }

  reinitialiser(): void {
    this.historique = [];
    this.derniereAttaque = Number.NEGATIVE_INFINITY;
  }
}
