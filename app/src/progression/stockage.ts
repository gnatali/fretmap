// Lecture et écriture de la progression dans localStorage, migration, export et import JSON (spec §6, §9).
import { estCase, estNumeroCorde } from '../music/manche';
import { NOTATIONS } from '../music/notation';
import { bornerA4 } from '../music/notes';
import {
  NIVEAU_MAX,
  REGLAGES_DEFAUT,
  TOLERANCES,
  VERSION_SCHEMA,
  progressionInitiale,
  type Niveau,
  type Progression,
  type Reglages,
  type ScoreNiveau,
  type Statistique,
} from './modele';

export const CLE_STOCKAGE = 'fretmap.v1';
/** Copie du contenu illisible trouvé au chargement, pour ne pas perdre une progression en silence. */
export const CLE_ILLISIBLE = 'fretmap.v1.illisible';

export type Stockage = Pick<Storage, 'getItem' | 'setItem'>;
export type EtatChargement = 'vide' | 'ok' | 'corrompu' | 'indisponible';

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

function normaliserReglages(valeur: unknown): Reglages {
  const r = estObjet(valeur) ? valeur : {};
  const d = REGLAGES_DEFAUT;
  return {
    tolerance: TOLERANCES.find((t) => t === r.tolerance) ?? d.tolerance,
    octaveStricte: booleen(r.octaveStricte, d.octaveStricte),
    afficherNotes: booleen(r.afficherNotes, d.afficherNotes),
    afficherCaseMode2: booleen(r.afficherCaseMode2, d.afficherCaseMode2),
    a4: typeof r.a4 === 'number' ? bornerA4(r.a4) : d.a4,
    seuilSilenceDb:
      typeof r.seuilSilenceDb === 'number' && Number.isFinite(r.seuilSilenceDb) ? r.seuilSilenceDb : d.seuilSilenceDb,
    retourSonore: booleen(r.retourSonore, d.retourSonore),
    notation: NOTATIONS.find((n) => n === r.notation) ?? d.notation,
  };
}

function estStatistique(valeur: unknown): valeur is Statistique {
  if (!estObjet(valeur)) return false;
  return (
    (valeur.mode === 1 || valeur.mode === 2) &&
    estNumeroCorde(valeur.corde) &&
    estCase(valeur.case) &&
    estEntierPositif(valeur.tentatives) &&
    estEntierPositif(valeur.reussites) &&
    valeur.reussites <= valeur.tentatives &&
    typeof valeur.tempsMoyenMs === 'number' &&
    Number.isFinite(valeur.tempsMoyenMs) &&
    valeur.tempsMoyenMs >= 0 &&
    typeof valeur.derniereDate === 'string'
  );
}

function normaliserScores(valeur: unknown): Progression['scoreParNiveau'] {
  const scores: Progression['scoreParNiveau'] = {};
  if (!estObjet(valeur)) return scores;
  for (const [cle, score] of Object.entries(valeur)) {
    const niveau = Number(cle);
    if (!estNiveau(niveau) || !estObjet(score)) continue;
    if (estEntierPositif(score.questions) && estEntierPositif(score.reussites) && score.reussites <= score.questions) {
      scores[niveau] = { questions: score.questions, reussites: score.reussites } satisfies ScoreNiveau;
    }
  }
  return scores;
}

/**
 * Ramène des données lues (stockage ou import) au schéma courant. Version 1 : validation et valeurs par défaut
 * pour les champs manquants ou invalides. Renvoie null si les données ne sont pas une progression connue.
 */
export function migrer(donnees: unknown): Progression | null {
  if (!estObjet(donnees) || donnees.version !== VERSION_SCHEMA) return null;
  return {
    version: VERSION_SCHEMA,
    niveauActuel: estNiveau(donnees.niveauActuel) ? donnees.niveauActuel : 1,
    scoreParNiveau: normaliserScores(donnees.scoreParNiveau),
    statistiques: Array.isArray(donnees.statistiques)
      ? donnees.statistiques.filter(estStatistique).map((s) => ({ ...s }))
      : [],
    reglages: normaliserReglages(donnees.reglages),
  };
}

function lireJson(texte: string): Progression | null {
  try {
    return migrer(JSON.parse(texte));
  } catch {
    return null;
  }
}

/**
 * Lit la progression. Si le contenu est illisible, il est recopié sous CLE_ILLISIBLE avant de repartir d'une
 * progression neuve ; l'état permet à l'interface de prévenir l'utilisateur.
 */
export function charger(stockage: Stockage | null): { progression: Progression; etat: EtatChargement } {
  let brut: string | null;
  try {
    if (!stockage) throw new Error('stockage indisponible');
    brut = stockage.getItem(CLE_STOCKAGE);
  } catch {
    return { progression: progressionInitiale(), etat: 'indisponible' };
  }
  if (brut === null) return { progression: progressionInitiale(), etat: 'vide' };
  const progression = lireJson(brut);
  if (progression) return { progression, etat: 'ok' };
  try {
    stockage.setItem(CLE_ILLISIBLE, brut);
  } catch {
    // Copie impossible (stockage plein) : la progression neuve ne sera de toute façon pas enregistrée non plus.
  }
  return { progression: progressionInitiale(), etat: 'corrompu' };
}

/** @returns false si l'écriture a échoué (stockage indisponible ou plein). */
export function sauver(stockage: Stockage | null, progression: Progression): boolean {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(progression));
    return true;
  } catch {
    return false;
  }
}

export function exporterJson(progression: Progression): string {
  return `${JSON.stringify(progression, null, 2)}\n`;
}

/** Progression lue dans un fichier exporté ; null si le texte n'en est pas une. */
export function importerJson(texte: string): Progression | null {
  return lireJson(texte);
}

/** Nom du fichier d'export, daté du jour (heure locale) : « fretmap-progression-2026-10-27.json ». */
export function nomFichierExport(date: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  const jour = `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
  return `fretmap-progression-${jour}.json`;
}
