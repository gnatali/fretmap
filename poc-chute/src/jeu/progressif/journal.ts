// Journal d'une partie du mode progressif (spec §16) : chaque essai avec ses données brutes et les réussites de toutes
// les méthodes, pour les comparer après coup. Les temps sont ceux du jeu (sans les pauses), en ms depuis le début.
import type { Position } from '../../music/manche';
import type { Notation } from '../../music/notation';
import type { NomNote } from '../../music/notes';
import type { ContexteJournal, EvenementNoteJournal } from '../journal';
import type { ReglagesProgressif } from './reglages';
import type { MethodeGlobale, MethodeNote, ResultatEssai } from './reussite';

export interface EssaiJournal {
  index: number;
  /** Niveau pendant l'essai. */
  niveau: number;
  position: Position;
  nom: NomNote;
  midi: number;
  tApparitionMs: number;
  tAttendueMs: number;
  tResultatMs: number;
  /** Attaque de la bonne note (ou dernière attaque entendue si la note n'est pas juste). */
  tAttaqueMs: number | null;
  resultat: ResultatEssai;
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
  /** Note jouée à la fin de l'essai (null pour une note ratée). */
  detectee: { nom: NomNote; midi: number; cents: number } | null;
  /** Fausses notes (pénalisées), anciennes notes et notes non reconnues pendant l'essai. */
  evenements: EvenementNoteJournal[];
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
  /** Plafond de vitesse du nouveau niveau (part de la vitesse max) ; absent avant la version 2.1 de la spec. */
  plafond?: number;
}

/** Notes du niveau à la fin de la partie, avec leur réussite (méthode choisie). */
export interface BilanNote {
  position: Position;
  nom: NomNote;
  difficulte: number;
  essais: number;
  reussite: number;
}

export interface ResumeProgressif {
  score: number;
  niveauDepart: number;
  niveauAtteint: number;
  essais: number;
  justes: number;
  /** Fausses notes jouées, y compris la 3e d'une note perdue. */
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
}

export interface PartieProgressiveJournal extends ContexteJournal {
  mode: 'progressif';
  /** ISO 8601. */
  debut: string;
  simulation: boolean;
  interrompue: boolean;
  reglages: ReglagesProgressif & { notation: Notation; afficherCase: boolean };
  niveauDepart: number;
  positionsDepart: Position[];
  passages: PassageJournal[];
  resume: ResumeProgressif;
  bilanNotes: BilanNote[];
  essais: EssaiJournal[];
}
