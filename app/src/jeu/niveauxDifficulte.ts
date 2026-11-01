// Difficulté du jeu du mode 1 (spec §5.1, choix de l'utilisateur du 31/10/2026) : elle change la vitesse, les essais
// par note, la rapidité exigée et la réussite minimale (version 3.6, journal du 01/11/2026 : avec les seuils seuls, les
// difficultés passaient chaque niveau au même essai), l'aide et les notes tirées en facile. Hardcore demande en plus
// que chaque note soit acquise (ACQUISE). Chaque difficulté a son niveau et ses notes (progression/modele.ts,
// `ProgressionJeu.niveaux`).
import { REGLAGES_PROGRESSIF_DEFAUT, type ReglagesProgressif } from './reglages';

export type Difficulte = 'facile' | 'normal' | 'difficile' | 'hardcore';
export const DIFFICULTES: readonly Difficulte[] = ['facile', 'normal', 'difficile', 'hardcore'];
export const DIFFICULTE_DEFAUT: Difficulte = 'normal';

/** Réglages qui dépendent de la difficulté ; les autres sont ceux du POC (REGLAGES_PROGRESSIF_DEFAUT). */
export type ReglagesDifficulte = Pick<
  ReglagesProgressif,
  | 'vitesseDepart'
  | 'vitesseParNiveau'
  | 'essaisMinimum'
  | 'delaiNoteBonMs'
  | 'delaiNoteLentMs'
  | 'seuilNote'
  | 'seuilGlobal'
>;

/**
 * Réglages de chaque difficulté (normal : ceux du POC).
 * - Vitesse : plafond du niveau 1 et montée par niveau ; chute de 15 s au niveau 1 en facile, 10 s en normal, 7,5 s
 *   en difficile et en hardcore (version 3.6).
 * - Essais minimum par note : 2, 3, 4, 5 (version 3.6 ; 5 en hardcore depuis la version 3.1).
 * - Rapidité : 1 jusqu'à `delaiNoteBonMs`, 0 à `delaiNoteLentMs` (version 3.6). En difficile, 1 s et 4 s : avec 6 s,
 *   la réussite du niveau ne baissait que de 1 à 3 points sur le journal du 01/11/2026. Le hardcore garde 1,5 s, le
 *   délai d'une réponse rapide pour la note acquise.
 * - Réussite minimale de chaque note (40 % en facile depuis la version 3.2 : une note faible bloquait le niveau 5
 *   pendant 153 essais) et du niveau (60 %, 80 %, 90 %, version 3.1).
 */
export const REGLAGES_DIFFICULTE: Readonly<Record<Difficulte, Readonly<ReglagesDifficulte>>> = {
  facile: {
    vitesseDepart: 0.2,
    vitesseParNiveau: 0.03,
    essaisMinimum: 2,
    delaiNoteBonMs: 2500,
    delaiNoteLentMs: 8000,
    seuilNote: 0.4,
    seuilGlobal: 0.6,
  },
  normal: {
    vitesseDepart: REGLAGES_PROGRESSIF_DEFAUT.vitesseDepart,
    vitesseParNiveau: REGLAGES_PROGRESSIF_DEFAUT.vitesseParNiveau,
    essaisMinimum: REGLAGES_PROGRESSIF_DEFAUT.essaisMinimum,
    delaiNoteBonMs: REGLAGES_PROGRESSIF_DEFAUT.delaiNoteBonMs,
    delaiNoteLentMs: REGLAGES_PROGRESSIF_DEFAUT.delaiNoteLentMs,
    seuilNote: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
    seuilGlobal: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
  },
  difficile: {
    vitesseDepart: 0.4,
    vitesseParNiveau: 0.07,
    essaisMinimum: 4,
    delaiNoteBonMs: 1000,
    delaiNoteLentMs: 4000,
    seuilNote: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
    seuilGlobal: 0.9,
  },
  hardcore: {
    vitesseDepart: 0.4,
    vitesseParNiveau: 0.07,
    essaisMinimum: 5,
    delaiNoteBonMs: REGLAGES_PROGRESSIF_DEFAUT.delaiNoteBonMs,
    delaiNoteLentMs: REGLAGES_PROGRESSIF_DEFAUT.delaiNoteLentMs,
    seuilNote: REGLAGES_PROGRESSIF_DEFAUT.seuilNote,
    seuilGlobal: REGLAGES_PROGRESSIF_DEFAUT.seuilGlobal,
  },
};

/**
 * Note acquise en hardcore (reussite.ts, `acquise`) : `propres` réponses propres (justes du premier coup, en
 * `delaiNoteBonMs` au plus) parmi `sur` essais de suite de la note. Version 3.6 : 4 sur 5 ; avant, 5 de suite, et le
 * journal du 01/11/2026 restait bloqué au niveau 4 (une note propre et rapide 38 % du temps : environ 200 essais de
 * cette note pour en enchaîner 5, environ 33 pour 4 sur 5).
 */
export const ACQUISE = { propres: 4, sur: 5 } as const;

/** Aide : la bonne case s'allume dès la 1re case fausse, jusqu'au résultat de la note ; en facile seulement. */
export const AIDE_APRES_ERREUR: Readonly<Record<Difficulte, boolean>> = {
  facile: true,
  normal: false,
  difficile: false,
  hardcore: false,
};

/** Notes naturelles seulement (sans dièse) : en facile seulement (demande de l'utilisateur du 01/11/2026). */
export const NATURELLES_SEULES: Readonly<Record<Difficulte, boolean>> = {
  facile: true,
  normal: false,
  difficile: false,
  hardcore: false,
};

export function estDifficulte(valeur: unknown): valeur is Difficulte {
  return DIFFICULTES.includes(valeur as Difficulte);
}

/** Réglages du jeu pour une difficulté : ceux du POC, avec REGLAGES_DIFFICULTE. */
export function reglagesDe(difficulte: Difficulte): ReglagesProgressif {
  return { ...REGLAGES_PROGRESSIF_DEFAUT, ...REGLAGES_DIFFICULTE[difficulte] };
}
