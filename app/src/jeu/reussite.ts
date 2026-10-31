// Copie de poc-chute/src/jeu/progressif/ (docs/specs-poc-chute.md §16). Réussite : plusieurs méthodes de calcul, pour
// une note et pour le niveau, à comparer dans le journal. Celles des réglages mènent le jeu ; toutes sont calculées et
// notées à chaque essai.
import type { Position } from '../music/manche';
import { difficulte } from './difficulte';
import type { ReglagesProgressif } from './reglages';

/**
 * Réussite d'une note :
 * - score : moyenne des scores d'essai (justesse et rapidité) ;
 * - taux : part des réponses justes, chaque fausse note et chaque note ratée comptant comme une réponse fausse ;
 * - temps : rapidité de la bonne note depuis la note précédente, 0 pour un essai qui n'est pas juste.
 */
export type MethodeNote = 'score' | 'taux' | 'temps';
export const METHODES_NOTE: readonly MethodeNote[] = ['score', 'taux', 'temps'];

/**
 * Réussite globale :
 * - moyenne : moyenne des réussites des notes du niveau ;
 * - ponderee : même moyenne, chaque note pesant 1 + sa difficulté ;
 * - derniers : la méthode de note appliquée aux derniers essais, toutes notes confondues.
 */
export type MethodeGlobale = 'moyenne' | 'ponderee' | 'derniers';
export const METHODES_GLOBALES: readonly MethodeGlobale[] = ['moyenne', 'ponderee', 'derniers'];

/** Fin d'un essai : jouée juste, perdue à la 3e fausse note, ou ratée (arrivée en bas). */
export type ResultatEssai = 'juste' | 'perdue' | 'ratee';

/** Un essai (une note qui tombe, du début à la fin), réduit à ce qui sert au calcul. */
export interface Essai {
  position: Position;
  resultat: ResultatEssai;
  /** Fausses notes avant le résultat (3 pour une note perdue). */
  erreurs: number;
  /** Bonne note − apparition en haut de l'écran, en ms (null si l'essai n'est pas juste). */
  delaiApparitionMs: number | null;
  /** Bonne note − fin de la note précédente (note devenue attendue), en ms (null si l'essai n'est pas juste). */
  delaiNoteMs: number | null;
}

export type ParametresReussite = Pick<
  ReglagesProgressif,
  | 'essaisNote'
  | 'essaisGlobaux'
  | 'poidsAlteration'
  | 'delaiNoteBonMs'
  | 'delaiNoteLentMs'
  | 'delaiApparitionBonMs'
  | 'delaiApparitionLentMs'
>;

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;
const moyenne = (valeurs: readonly number[]) =>
  valeurs.length === 0 ? 0 : valeurs.reduce((s, v) => s + v, 0) / valeurs.length;

/** Rapidité d'un délai : 1 jusqu'à `bonMs`, 0 à partir de `lentMs`, une droite entre les deux ; 0 sans délai. */
export function rapidite(delaiMs: number | null, bonMs: number, lentMs: number): number {
  if (delaiMs === null) return 0;
  if (delaiMs <= bonMs) return 1;
  if (delaiMs >= lentMs) return 0;
  return (lentMs - delaiMs) / (lentMs - bonMs);
}

/** Justesse (réponse « selon les essais ») : 1 du premier coup, divisée par 2 à chaque fausse note, 0 sinon. */
export function justesse(essai: Essai): number {
  return essai.resultat === 'juste' ? 0.5 ** essai.erreurs : 0;
}

/** Score d'essai de 0 à 1 : justesse × (0,5 + 0,5 × rapidité moyenne des deux délais). Juste mais lent : 0,5. */
export function scoreEssai(essai: Essai, p: ParametresReussite): number {
  const j = justesse(essai);
  if (j === 0) return 0;
  const vite =
    (rapidite(essai.delaiApparitionMs, p.delaiApparitionBonMs, p.delaiApparitionLentMs) +
      rapidite(essai.delaiNoteMs, p.delaiNoteBonMs, p.delaiNoteLentMs)) /
    2;
  return j * (0.5 + 0.5 * vite);
}

/** Méthode de note appliquée à une liste d'essais (sans fenêtre) ; 0 sans essai. */
export function reussiteEssais(methode: MethodeNote, essais: readonly Essai[], p: ParametresReussite): number {
  if (essais.length === 0) return 0;
  switch (methode) {
    case 'score':
      return moyenne(essais.map((e) => scoreEssai(e, p)));
    case 'temps':
      return moyenne(
        essais.map((e) => (e.resultat === 'juste' ? rapidite(e.delaiNoteMs, p.delaiNoteBonMs, p.delaiNoteLentMs) : 0)),
      );
    case 'taux': {
      // Réponses : les fausses notes, plus la bonne note ou la note ratée (une note perdue n'a que ses 3 fausses).
      const reponses = essais.reduce((s, e) => s + e.erreurs + (e.resultat === 'perdue' ? 0 : 1), 0);
      const justes = essais.filter((e) => e.resultat === 'juste').length;
      return reponses === 0 ? 0 : justes / reponses;
    }
  }
}

/** Réussite d'une note : la méthode sur ses `essaisNote` derniers essais (`essais` : ceux de la partie, dans l'ordre). */
export function reussiteNote(
  methode: MethodeNote,
  position: Position,
  essais: readonly Essai[],
  p: ParametresReussite,
): number {
  const siens = essais.filter((e) => memePosition(e.position, position));
  return reussiteEssais(methode, siens.slice(-p.essaisNote), p);
}

/** Réussite globale des notes du niveau ; « derniers » prend les `essaisGlobaux` derniers essais du niveau. */
export function reussiteGlobale(
  methodeGlobale: MethodeGlobale,
  methodeNote: MethodeNote,
  niveau: readonly Position[],
  essais: readonly Essai[],
  p: ParametresReussite,
): number {
  if (niveau.length === 0) return 0;
  if (methodeGlobale === 'derniers') {
    const duNiveau = essais.filter((e) => niveau.some((q) => memePosition(e.position, q)));
    return reussiteEssais(methodeNote, duNiveau.slice(-p.essaisGlobaux), p);
  }
  const reussites = niveau.map((q) => reussiteNote(methodeNote, q, essais, p));
  if (methodeGlobale === 'moyenne') return moyenne(reussites);
  const poids = niveau.map((q) => 1 + difficulte(q, p.poidsAlteration));
  return reussites.reduce((s, r, i) => s + r * poids[i]!, 0) / poids.reduce((s, w) => s + w, 0);
}

/**
 * Note jouée `n` fois de suite sans faute (hardcore) : au moins `n` essais, et ses `n` derniers justes du premier coup
 * (aucune case fausse) en au plus `delaiBonMs` depuis la note précédente.
 */
export function sansFaute(position: Position, essais: readonly Essai[], n: number, delaiBonMs: number): boolean {
  const derniers = essais.filter((e) => memePosition(e.position, position)).slice(-n);
  return (
    derniers.length >= n &&
    derniers.every(
      (e) => e.resultat === 'juste' && e.erreurs === 0 && e.delaiNoteMs !== null && e.delaiNoteMs <= delaiBonMs,
    )
  );
}

const arrondi = (valeur: number) => Math.round(valeur * 1000) / 1000;

/** Réussite d'une note par chaque méthode, arrondie (journal). */
export function reussitesNote(
  position: Position,
  essais: readonly Essai[],
  p: ParametresReussite,
): Record<MethodeNote, number> {
  return Object.fromEntries(METHODES_NOTE.map((m) => [m, arrondi(reussiteNote(m, position, essais, p))])) as Record<
    MethodeNote,
    number
  >;
}

/** Réussite globale pour chaque méthode de note et chaque méthode globale, arrondie (journal). */
export function matriceReussites(
  niveau: readonly Position[],
  essais: readonly Essai[],
  p: ParametresReussite,
): Record<MethodeNote, Record<MethodeGlobale, number>> {
  return Object.fromEntries(
    METHODES_NOTE.map((m) => [
      m,
      Object.fromEntries(METHODES_GLOBALES.map((g) => [g, arrondi(reussiteGlobale(g, m, niveau, essais, p))])),
    ]),
  ) as Record<MethodeNote, Record<MethodeGlobale, number>>;
}
