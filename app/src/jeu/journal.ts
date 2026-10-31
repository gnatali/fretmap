// Journal des parties du mode 1 (spec §5.1, sur le modèle du journal progressif du POC « Notes qui tombent »,
// docs/specs-poc-chute.md §16.6) : chaque essai avec ses données brutes et les réussites de toutes les méthodes, pour
// régler le jeu après coup. Les temps sont ceux du jeu (sans les pauses), en ms depuis le début de la partie.
import type { Position } from '../music/manche';
import type { Notation } from '../music/notation';
import type { NomNote } from '../music/notes';
import type { Pause } from './horloge';
import type { Difficulte } from './niveauxDifficulte';
import type { ReglagesProgressif } from './reglages';
import type { MethodeGlobale, MethodeNote, ResultatEssai } from './reussite';

export const FORMAT_JOURNAL = 'fretmap-mode1-journal';
export const VERSION_JOURNAL = 1;
/** Image jugée lente au-delà de cette durée, en ms : 33, soit moins de 30 images/s (POC, HC1). */
export const SEUIL_IMAGE_LENTE_MS = 33;

/** Case fausse touchée pendant l'essai (la note reste à jouer ; `penalite` : points vraiment retirés). */
export interface FausseJournal {
  tMs: number;
  position: Position;
  penalite: number;
}

export interface EssaiJournal {
  index: number;
  /** Niveau pendant l'essai. */
  niveau: number;
  /** Position tirée : elle reçoit l'essai. */
  position: Position;
  nom: NomNote;
  /** La question donnait la corde (pas pour une corde à vide). */
  cordeDemandee: boolean;
  tApparitionMs: number;
  tAttendueMs: number;
  tResultatMs: number;
  resultat: ResultatEssai;
  /** Note ratée qui revient (partie.ts, TIRAGES_AVANT_RETOUR) ; absent avant le 31/10/2026. */
  revient?: boolean;
  erreurs: number;
  justesse: number;
  delaiApparitionMs: number | null;
  delaiNoteMs: number | null;
  scoreEssai: number;
  /** Vitesse au moment du résultat, avant son changement (part de la vitesse max). */
  vitesse: number;
  /** Points gagnés (note juste) ou perdus (note perdue ou ratée, négatifs). */
  points: number;
  serie: number;
  /** Case touchée à la fin de l'essai (null pour une note ratée). */
  touchee: Position | null;
  /** Cases fausses touchées avant le résultat. */
  fausses: FausseJournal[];
  /** Réussite de la note après l'essai, par méthode. */
  reussites: Record<MethodeNote, number>;
  /** Réussite globale du niveau après l'essai, pour chaque méthode de note et chaque méthode globale. */
  globales: Record<MethodeNote, Record<MethodeGlobale, number>>;
}

export interface PassageJournal {
  tMs: number;
  /** Nouveau niveau. */
  niveau: number;
  bonus: number;
  ajoutees: Position[];
  /** Plafond de vitesse du nouveau niveau (part de la vitesse max). */
  plafond: number;
}

/** Notes du niveau à la fin de la partie, avec leur réussite (méthode choisie). */
export interface BilanNote {
  position: Position;
  nom: NomNote;
  difficulte: number;
  essais: number;
  reussite: number;
  /** Note validée pour le passage (Partie.noteValidee) ; absent avant le 31/10/2026. */
  validee?: boolean;
}

export interface ResumePartie {
  score: number;
  niveauDepart: number;
  niveauAtteint: number;
  essais: number;
  justes: number;
  /** Cases fausses touchées, y compris la 3e d'une note perdue. */
  fausses: number;
  perdues: number;
  ratees: number;
  meilleureSerie: number;
  /** Vitesse la plus haute atteinte (part de la vitesse max). */
  vitesseMax: number;
  /** Médiane des délais depuis la note précédente des notes justes. */
  delaiNoteMedianMs: number | null;
  /** Réussite globale à la fin (méthodes choisies). */
  reussiteGlobale: number;
  /** Notes du niveau validées à la fin ; absent avant le 31/10/2026. */
  notesValidees?: number;
}

/** Durées entre deux images pendant la partie. Null sans image. */
export interface MesuresImages {
  nombre: number;
  medianeMs: number | null;
  p95Ms: number | null;
  /** Part des images au-delà de SEUIL_IMAGE_LENTE_MS (0 à 1). */
  partAuDelaDe33Ms: number | null;
}

/** Ce que la partie ne connaît pas : fourni par l'écran. */
export interface ContexteJournal {
  navigateur: string;
  images: MesuresImages;
  /** Pauses de la partie ; les temps du journal sont ceux du jeu, sans les pauses. */
  pauses: Pause[];
}

export interface PartieJournal extends ContexteJournal {
  /** ISO 8601. */
  debut: string;
  interrompue: boolean;
  /** Absente des parties jouées avant le choix de la difficulté (normal). */
  difficulte?: Difficulte;
  reglages: ReglagesProgressif & { notation: Notation };
  niveauDepart: number;
  positionsDepart: Position[];
  passages: PassageJournal[];
  resume: ResumePartie;
  bilanNotes: BilanNote[];
  essais: EssaiJournal[];
}

export interface ExportJournal {
  format: typeof FORMAT_JOURNAL;
  version: typeof VERSION_JOURNAL;
  /** ISO 8601. */
  exporteLe: string;
  parties: PartieJournal[];
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
export function exporterJournal(parties: readonly PartieJournal[], date: Date): string {
  const contenu: ExportJournal = {
    format: FORMAT_JOURNAL,
    version: VERSION_JOURNAL,
    exporteLe: date.toISOString(),
    parties: [...parties],
  };
  return `${JSON.stringify(contenu, null, 2)}\n`;
}

/** Nom du fichier d'export, en heure locale : « journal-mode1-20261031-1930.json ». */
export function nomFichierJournal(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  const jour = `${date.getFullYear()}${deux(date.getMonth() + 1)}${deux(date.getDate())}`;
  return `journal-mode1-${jour}-${deux(date.getHours())}${deux(date.getMinutes())}.json`;
}
