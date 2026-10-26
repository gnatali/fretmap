// Modèle de données de la progression (spec §6) et valeurs par défaut.
import { SEUIL_SILENCE_DBFS_DEFAUT } from '../audio/niveau';
import type { NumeroCorde } from '../music/manche';
import { A4_DEFAUT_HZ } from '../music/notes';

/** Version du schéma enregistré ; toute évolution passe par `migrer` (progression/stockage.ts). */
export const VERSION_SCHEMA = 1;

export type Mode = 1 | 2;
export type Niveau = 1 | 2 | 3 | 4 | 5;
export const NIVEAU_MAX: Niveau = 5;
export type Tolerance = 50 | 30 | 20;
export const TOLERANCES: readonly Tolerance[] = [50, 30, 20];

export interface Statistique {
  mode: Mode;
  /** En mode 2 : corde demandée (le micro ne peut pas vérifier la corde jouée). */
  corde: NumeroCorde;
  /** En mode 2 : case de la position demandée. */
  case: number;
  tentatives: number;
  reussites: number;
  /** En mode 2, inclut la latence de détection (environ 200 ms). */
  tempsMoyenMs: number;
  /** ISO 8601. */
  derniereDate: string;
}

export interface Reglages {
  /** Tolérance du mode 2 en cents ; 50 = le demi-ton, comme dans le POC (spec §5.2). */
  tolerance: Tolerance;
  octaveStricte: boolean;
  afficherNotes: boolean;
  afficherCaseMode2: boolean;
  /** Référence A4, de 430 à 450 Hz. */
  a4: number;
  /** Seuil de silence en dBFS, mesuré au démarrage du micro. */
  seuilSilenceDb: number;
  retourSonore: boolean;
}

export interface ScoreNiveau {
  questions: number;
  reussites: number;
}

export interface Progression {
  version: typeof VERSION_SCHEMA;
  niveauActuel: Niveau;
  scoreParNiveau: Partial<Record<Niveau, ScoreNiveau>>;
  statistiques: Statistique[];
  reglages: Reglages;
}

export const REGLAGES_DEFAUT: Readonly<Reglages> = {
  tolerance: 50,
  octaveStricte: false,
  // Masquées par défaut : affichées, elles donneraient la réponse du quiz.
  afficherNotes: false,
  // Par défaut, la question du mode 2 donne la note et la corde ; l'utilisateur cherche la case (spec §5.2).
  afficherCaseMode2: false,
  a4: A4_DEFAUT_HZ,
  seuilSilenceDb: SEUIL_SILENCE_DBFS_DEFAUT,
  // Silencieux par défaut, comme le bip de l'accordeur du POC.
  retourSonore: false,
};

export function progressionInitiale(): Progression {
  return {
    version: VERSION_SCHEMA,
    niveauActuel: 1,
    scoreParNiveau: {},
    statistiques: [],
    reglages: { ...REGLAGES_DEFAUT },
  };
}
