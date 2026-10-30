// Journal des parties (spec §6.10) : format exporté en JSON, mesure de la fluidité (HC1), nom du fichier d'export.
import type { Position } from '../music/manche';
import type { Pause } from './horloge';
import type { PartieProgressiveJournal } from './progressif/journal';
import type { NomNote } from '../music/notes';
import type { ReglagesPartie } from './partie';
import type { Timing } from './points';

export const FORMAT_JOURNAL = 'fretmap-chute-journal';
export const VERSION_JOURNAL = 1;
/** Image jugée lente au-delà de cette durée, en ms : 33, soit moins de 30 images/s (spec §8, HC1). */
export const SEUIL_IMAGE_LENTE_MS = 33;

/**
 * Résultat d'une note : jouée juste, détruite par une fausse note (mode « destruction »), ou arrivée sur la ligne
 * sans être jouée.
 */
export type ResultatNote = 'juste' | 'fausse' | 'ratee';

/**
 * Événements de la note attendue avant son résultat : ancienne note et note non reconnue (sans effet), fausse note
 * en mode « pénalité » (la note reste à jouer ; `penalite` : points vraiment retirés).
 */
export type EvenementNoteJournal =
  | { type: 'ancienneNote'; tMs: number; nom: NomNote }
  | { type: 'nonReconnue'; tMs: number }
  | { type: 'fausse'; tMs: number; nom: NomNote; midi: number; cents: number; penalite: number };

/** Une note de la partie. Les temps sont en ms depuis le début de la partie. */
export interface NoteJournal {
  index: number;
  /** Position demandée. */
  position: Position;
  nom: NomNote;
  /** Note MIDI de la position demandée. */
  midi: number;
  tApparitionMs: number;
  tAttendueMs: number;
  /** Attaque de la note jouée ; pour une note ratée, dernière attaque entendue pendant qu'elle était attendue. */
  tAttaqueMs: number | null;
  /** Null pour une note ratée. */
  tDetectionMs: number | null;
  detectee: { nom: NomNote; midi: number; cents: number } | null;
  resultat: ResultatNote;
  /** Part de la chute parcourue au moment du résultat (0 à 1). */
  progression: number;
  /** Durée de chute au moment du résultat, en ms. */
  dureeChuteMs: number;
  /** Null si la note n'est pas juste. */
  timing: Timing | null;
  points: number;
  /** Série après cette note. */
  serie: number;
  evenements: EvenementNoteJournal[];
}

/** Durées entre deux images pendant la partie, micro actif (spec §6.10, HC1). Null sans image. */
export interface MesuresImages {
  nombre: number;
  medianeMs: number | null;
  p95Ms: number | null;
  /** Part des images au-delà de SEUIL_IMAGE_LENTE_MS (0 à 1). */
  partAuDelaDe33Ms: number | null;
}

export interface ResumePartie {
  score: number;
  justes: number;
  /** Fausses notes jouées : notes détruites, plus fausses notes du mode « pénalité ». */
  fausses: number;
  ratees: number;
  meilleureSerie: number;
  dureeFinaleMs: number;
  dureeMinMs: number;
  /** Médiane des temps de réponse des notes justes (de l'instant où la note est attendue à la détection). */
  tempsReponseMedianMs: number | null;
}

/** Ce que la partie ne connaît pas : fourni par l'interface (phase 4). */
export interface ContexteJournal {
  navigateur: string;
  seuilSilenceDbfs: number | null;
  /** Traitements audio que le navigateur a laissés actifs malgré la demande. */
  traitementsActifs: string[];
  images: MesuresImages;
  /** Pauses de la partie ; les temps du journal sont ceux du jeu, sans les pauses (spec §6.2). */
  pauses: Pause[];
}

/** Partie du mode classique (30 notes). Les parties enregistrées avant le mode progressif n'ont pas `mode`. */
export interface PartieJournal extends ContexteJournal {
  mode?: 'classique';
  /** ISO 8601. */
  debut: string;
  simulation: boolean;
  interrompue: boolean;
  reglages: ReglagesPartie;
  resume: ResumePartie;
  notes: NoteJournal[];
}

export interface ExportJournal {
  format: typeof FORMAT_JOURNAL;
  version: typeof VERSION_JOURNAL;
  /** ISO 8601. */
  exporteLe: string;
  parties: JournalPartie[];
}

/** Une partie du journal, classique ou progressive. */
export type JournalPartie = PartieJournal | PartieProgressiveJournal;

export function estProgressive(partie: JournalPartie): partie is PartieProgressiveJournal {
  return partie.mode === 'progressif';
}

/** Quantile q (0 à 1) par interpolation linéaire entre les valeurs triées ; null sans valeur. */
export function quantile(valeurs: readonly number[], q: number): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const rang = (triees.length - 1) * q;
  const bas = Math.floor(rang);
  const haut = Math.ceil(rang);
  return triees[bas]! + (triees[haut]! - triees[bas]!) * (rang - bas);
}

const arrondir = (valeur: number, decimales: number) => Math.round(valeur * 10 ** decimales) / 10 ** decimales;

/** Durées entre deux images (requestAnimationFrame) pendant une partie. */
export class MesureImages {
  private readonly durees: number[] = [];

  ajouter(dureeMs: number): void {
    if (Number.isFinite(dureeMs) && dureeMs >= 0) this.durees.push(dureeMs);
  }

  resultat(): MesuresImages {
    const mediane = quantile(this.durees, 0.5);
    const p95 = quantile(this.durees, 0.95);
    const lentes = this.durees.filter((d) => d > SEUIL_IMAGE_LENTE_MS).length;
    return {
      nombre: this.durees.length,
      medianeMs: mediane === null ? null : arrondir(mediane, 1),
      p95Ms: p95 === null ? null : arrondir(p95, 1),
      partAuDelaDe33Ms: this.durees.length === 0 ? null : arrondir(lentes / this.durees.length, 4),
    };
  }
}

/** Contenu du fichier d'export : toutes les parties gardées. */
export function exporterJournal(parties: readonly JournalPartie[], date: Date): string {
  const contenu: ExportJournal = {
    format: FORMAT_JOURNAL,
    version: VERSION_JOURNAL,
    exporteLe: date.toISOString(),
    parties: [...parties],
  };
  return JSON.stringify(contenu, null, 2);
}

/** Nom du fichier d'export, en heure locale : « journal-poc-chute-20261028-1930.json ». */
export function nomFichierExport(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  const jour = `${date.getFullYear()}${deux(date.getMonth() + 1)}${deux(date.getDate())}`;
  return `journal-poc-chute-${jour}-${deux(date.getHours())}${deux(date.getMinutes())}.json`;
}
