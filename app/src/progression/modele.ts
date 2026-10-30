// Modèle de données de la progression (spec §6) et valeurs par défaut.
import { SEUIL_SILENCE_DBFS_DEFAUT } from '../audio/niveau';
import { NUMEROS_CORDES, type NumeroCorde, type Position } from '../music/manche';
import type { Notation } from '../music/notation';
import { A4_DEFAUT_HZ } from '../music/notes';

/**
 * Version du schéma enregistré ; toute évolution passe par `migrer` (progression/stockage.ts).
 * Version 2 : avancement dans les niveaux par mode (les deux modes sont indépendants), à la place de
 * `niveauActuel` et `scoreParNiveau`.
 * Version 3 : le mode 1 devient le jeu « Notes qui tombent » au toucher (`jeu`) ; les 7 niveaux ne servent plus qu'au
 * mode 2 (`avancement[2]`), et le réglage `afficherNotes` disparaît (il donnerait la réponse).
 */
export const VERSION_SCHEMA = 3;
export const MODES: readonly Mode[] = [1, 2];

export type Mode = 1 | 2;
export type Niveau = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const NIVEAU_MAX: Niveau = 7;
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
  afficherCaseMode2: boolean;
  /** Référence A4, de 430 à 450 Hz. */
  a4: number;
  /** Seuil de silence en dBFS, mesuré au démarrage du micro. */
  seuilSilenceDb: number;
  retourSonore: boolean;
  /** Affichage des noms de notes seulement ; les données restent en notation anglo-saxonne. */
  notation: Notation;
}

/** Avancement dans les niveaux d'un mode (spec §5.4). */
export interface AvancementMode {
  /** Plus haut niveau débloqué. */
  niveauAtteint: Niveau;
  /** Résultats des dernières réponses données au niveau atteint, de la plus ancienne à la plus récente. */
  dernieresReponses: boolean[];
}

/** Meilleurs résultats du jeu du mode 1. */
export interface RecordJeu {
  score: number;
  niveau: number;
}

/**
 * Où reprendre le jeu du mode 1 (spec §5.1) : niveau et notes du niveau (les réussites repartent de zéro à chaque
 * partie, comme le mode progressif du POC), et records.
 */
export interface ProgressionJeu {
  niveau: number;
  positions: Position[];
  record: RecordJeu;
}

export interface Progression {
  version: typeof VERSION_SCHEMA;
  /** Avancement dans les 7 niveaux du mode 2 (le mode 1 a son jeu, `jeu`). */
  avancement: { 2: AvancementMode };
  jeu: ProgressionJeu;
  statistiques: Statistique[];
  reglages: Reglages;
}

export const REGLAGES_DEFAUT: Readonly<Reglages> = {
  tolerance: 50,
  octaveStricte: false,
  // Par défaut, la question du mode 2 donne la note et la corde ; l'utilisateur cherche la case (spec §5.2).
  afficherCaseMode2: false,
  a4: A4_DEFAUT_HZ,
  seuilSilenceDb: SEUIL_SILENCE_DBFS_DEFAUT,
  // Silencieux par défaut, comme le bip de l'accordeur du POC.
  retourSonore: false,
  notation: 'les-deux',
};

export function avancementInitial(niveauAtteint: Niveau = 1): AvancementMode {
  return { niveauAtteint, dernieresReponses: [] };
}

/** Le jeu au niveau 1 : les 6 cordes à vide, de la corde 6 à la corde 1 ; records gardés s'ils sont donnés. */
export function jeuInitial(record: RecordJeu = { score: 0, niveau: 0 }): ProgressionJeu {
  return { niveau: 1, positions: NUMEROS_CORDES.map((corde) => ({ corde, case: 0 })), record: { ...record } };
}

export function progressionInitiale(): Progression {
  return {
    version: VERSION_SCHEMA,
    avancement: { 2: avancementInitial() },
    jeu: jeuInitial(),
    statistiques: [],
    reglages: { ...REGLAGES_DEFAUT },
  };
}
