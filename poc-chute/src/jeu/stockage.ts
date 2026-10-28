// Données du POC dans localStorage (spec §6.10) : réglages de départ, seuil de silence, statistiques par position
// (tirage pondéré) et journal des dernières parties. Sur le modèle de app/src/progression/stockage.ts.
import { estCase, estNumeroCorde } from '../music/manche';
import { NOTATIONS } from '../music/notation';
import { NIVEAU_MAX, type Niveau, type Statistique } from '../progression/modele';
import type { PartieJournal } from './journal';
import { REGLES_FAUSSE_NOTE, type ReglagesPartie } from './partie';
import { DUREE_CHUTE_DEFAUT_MS, bornerDuree } from './vitesse';

/** Clé du stockage, distincte de celle de l'application (fretmap.v1). */
export const CLE_STOCKAGE = 'fretmap-chute.v1';
/** Copie du contenu illisible trouvé au chargement, pour ne pas perdre un journal en silence. */
export const CLE_ILLISIBLE = 'fretmap-chute.v1.illisible';
export const VERSION_SCHEMA = 1;
/** Parties gardées dans le journal : les 50 dernières (spec §6.10), à ajuster. */
export const PARTIES_GARDEES = 50;

export type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

export interface DonneesPoc {
  version: typeof VERSION_SCHEMA;
  /** Derniers choix de l'écran de départ. */
  reglages: ReglagesPartie;
  /** Dernier seuil de silence mesuré, en dBFS ; null avant la première mesure. */
  seuilSilenceDbfs: number | null;
  /** Statistiques par position du POC (mode 2), distinctes de celles de l'application. */
  statistiques: Statistique[];
  /** Journal des dernières parties, de la plus ancienne à la plus récente. */
  parties: PartieJournal[];
}

export const REGLAGES_DEPART_DEFAUT: Readonly<ReglagesPartie> = {
  niveau: 1,
  dureeInitialeMs: DUREE_CHUTE_DEFAUT_MS,
  vitesseFixe: false,
  afficherCase: false,
  notation: 'les-deux',
  // Mode par défaut depuis le 28/10/2026 (demande de l'utilisateur) : un ancien stockage sans ce champ y passe.
  fausseNote: 'penalite',
};

export function donneesInitiales(): DonneesPoc {
  return {
    version: VERSION_SCHEMA,
    reglages: { ...REGLAGES_DEPART_DEFAUT },
    seuilSilenceDbfs: null,
    statistiques: [],
    parties: [],
  };
}

/** localStorage, ou null s'il est inaccessible (navigation privée, cookies bloqués). */
export function stockageLocal(): Stockage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Brut = Record<string, unknown>;

function estObjet(valeur: unknown): valeur is Brut {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

function estEntierPositif(valeur: unknown): valeur is number {
  return Number.isInteger(valeur) && (valeur as number) >= 0;
}

function estNiveau(valeur: unknown): valeur is Niveau {
  return Number.isInteger(valeur) && (valeur as number) >= 1 && (valeur as number) <= NIVEAU_MAX;
}

function booleen(valeur: unknown, defaut: boolean): boolean {
  return typeof valeur === 'boolean' ? valeur : defaut;
}

function normaliserReglages(valeur: unknown): ReglagesPartie {
  const r = estObjet(valeur) ? valeur : {};
  const d = REGLAGES_DEPART_DEFAUT;
  return {
    niveau: estNiveau(r.niveau) ? r.niveau : d.niveau,
    dureeInitialeMs: typeof r.dureeInitialeMs === 'number' ? bornerDuree(r.dureeInitialeMs) : d.dureeInitialeMs,
    vitesseFixe: booleen(r.vitesseFixe, d.vitesseFixe),
    afficherCase: booleen(r.afficherCase, d.afficherCase),
    notation: NOTATIONS.find((n) => n === r.notation) ?? d.notation,
    fausseNote: REGLES_FAUSSE_NOTE.find((regle) => regle === r.fausseNote) ?? d.fausseNote,
  };
}

function estStatistique(valeur: unknown): valeur is Statistique {
  if (!estObjet(valeur)) return false;
  return (
    valeur.mode === 2 &&
    estNumeroCorde(valeur.corde) &&
    estCase(valeur.case) &&
    estEntierPositif(valeur.tentatives) &&
    estEntierPositif(valeur.reussites) &&
    valeur.reussites <= valeur.tentatives &&
    typeof valeur.tempsMoyenMs === 'number' &&
    Number.isFinite(valeur.tempsMoyenMs) &&
    typeof valeur.derniereDate === 'string'
  );
}

/** Une partie du journal : contrôle léger, le journal est écrit par le POC lui-même. */
function estPartie(valeur: unknown): valeur is PartieJournal {
  return estObjet(valeur) && typeof valeur.debut === 'string' && Array.isArray(valeur.notes);
}

/**
 * Données enregistrées, ou valeurs par défaut. Les valeurs invalides sont remplacées ou écartées ; un contenu
 * illisible (JSON cassé, autre version) est d'abord copié sous CLE_ILLISIBLE.
 */
export function charger(stockage: Stockage | null): DonneesPoc {
  let brut: string | null;
  try {
    brut = stockage?.getItem(CLE_STOCKAGE) ?? null;
  } catch {
    return donneesInitiales();
  }
  if (brut === null) return donneesInitiales();
  let valeur: unknown;
  try {
    valeur = JSON.parse(brut);
  } catch {
    valeur = null;
  }
  if (!estObjet(valeur) || valeur.version !== VERSION_SCHEMA) {
    try {
      stockage?.setItem(CLE_ILLISIBLE, brut);
    } catch {
      // Stockage plein ou refusé : les valeurs par défaut s'appliquent quand même.
    }
    return donneesInitiales();
  }
  const seuil = valeur.seuilSilenceDbfs;
  return {
    version: VERSION_SCHEMA,
    reglages: normaliserReglages(valeur.reglages),
    seuilSilenceDbfs: typeof seuil === 'number' && Number.isFinite(seuil) ? seuil : null,
    statistiques: Array.isArray(valeur.statistiques) ? valeur.statistiques.filter(estStatistique) : [],
    parties: Array.isArray(valeur.parties) ? valeur.parties.filter(estPartie).slice(-PARTIES_GARDEES) : [],
  };
}

/** Enregistre les données ; faux si le stockage est indisponible ou plein. */
export function enregistrer(stockage: Stockage | null, donnees: DonneesPoc): boolean {
  if (!stockage) return false;
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
    return true;
  } catch {
    return false;
  }
}

/** Ajoute une partie au journal, en ne gardant que les PARTIES_GARDEES dernières. */
export function ajouterPartie(donnees: DonneesPoc, partie: PartieJournal): DonneesPoc {
  return { ...donnees, parties: [...donnees.parties, partie].slice(-PARTIES_GARDEES) };
}

/** Vide le journal ; réglages et statistiques sont gardés. */
export function viderJournal(donnees: DonneesPoc): DonneesPoc {
  return { ...donnees, parties: [] };
}
