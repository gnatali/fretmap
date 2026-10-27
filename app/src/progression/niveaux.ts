// Contenu des niveaux et passage au niveau suivant (spec §5.4). Chaque mode a son propre avancement.
import { noteDePosition, positions, type Position } from '../music/manche';
import { NIVEAU_MAX, avancementInitial, type AvancementMode, type Mode, type Niveau } from './modele';

/** Taux de réussite demandé sur les dernières réponses pour passer au niveau suivant (spec §5.4). */
export const TAUX_PASSAGE = 0.8;

/**
 * Dernière case jouable en mode 2 : plage validée par le POC (scénario 6, jusqu'à E5 en case 12 de la corde 1).
 * Une seule constante, à baisser si une nouvelle mesure le demande (spec §5.2).
 */
export const CASE_MAX_MODE2 = 12;

export interface ContenuNiveau {
  niveau: Niveau;
  /** Dernière case jouée (la première est toujours la case 0, à vide). */
  caseMax: number;
  /** Notes naturelles seulement (sans dièse). */
  naturelles: boolean;
  /** La question indique la corde. Pas au niveau 1 : avec les cordes à vide, la corde serait la réponse. */
  cordeDemandee: boolean;
  /** Dernières réponses regardées pour passer au niveau suivant ; null : dernier niveau, mode libre. */
  reponsesPourPasser: number | null;
}

export const NIVEAUX: readonly ContenuNiveau[] = [
  { niveau: 1, caseMax: 0, naturelles: false, cordeDemandee: false, reponsesPourPasser: 20 },
  { niveau: 2, caseMax: 5, naturelles: true, cordeDemandee: true, reponsesPourPasser: 20 },
  { niveau: 3, caseMax: 5, naturelles: false, cordeDemandee: true, reponsesPourPasser: 30 },
  { niveau: 4, caseMax: 7, naturelles: true, cordeDemandee: true, reponsesPourPasser: 30 },
  { niveau: 5, caseMax: 7, naturelles: false, cordeDemandee: true, reponsesPourPasser: 30 },
  { niveau: 6, caseMax: 12, naturelles: true, cordeDemandee: true, reponsesPourPasser: 30 },
  { niveau: 7, caseMax: 12, naturelles: false, cordeDemandee: true, reponsesPourPasser: null },
];

export function contenuNiveau(niveau: Niveau): ContenuNiveau {
  return NIVEAUX[niveau - 1]!;
}

/** Dernière case d'un niveau dans un mode : en mode 2, limitée à la plage validée. */
export function caseMaxDuNiveau(niveau: Niveau, mode: Mode = 1): number {
  const { caseMax } = contenuNiveau(niveau);
  return mode === 2 ? Math.min(caseMax, CASE_MAX_MODE2) : caseMax;
}

/** Positions qu'un niveau peut demander dans un mode, de la corde 6 à la corde 1. */
export function positionsDuNiveau(niveau: Niveau, mode: Mode = 1): Position[] {
  const { naturelles } = contenuNiveau(niveau);
  return positions(0, caseMaxDuNiveau(niveau, mode)).filter((p) => !naturelles || !noteDePosition(p).nom.includes('#'));
}

/**
 * Tient compte d'une réponse dans l'avancement d'un mode. Seules comptent les réponses données au niveau atteint
 * (un niveau inférieur sert d'entraînement). Dès que les N dernières réponses atteignent TAUX_PASSAGE, le niveau
 * suivant est débloqué et le décompte repart de zéro.
 * @returns le nouvel avancement, et le niveau débloqué par cette réponse (null sinon).
 */
export function avancerNiveau(
  avancement: AvancementMode,
  niveauJoue: Niveau,
  juste: boolean,
): { avancement: AvancementMode; debloque: Niveau | null } {
  const { niveauAtteint } = avancement;
  const requises = contenuNiveau(niveauAtteint).reponsesPourPasser;
  if (niveauJoue !== niveauAtteint || requises === null) return { avancement, debloque: null };
  const dernieresReponses = [...avancement.dernieresReponses, juste].slice(-requises);
  const reussites = dernieresReponses.filter(Boolean).length;
  if (dernieresReponses.length === requises && reussites >= TAUX_PASSAGE * requises && niveauAtteint < NIVEAU_MAX) {
    const debloque = (niveauAtteint + 1) as Niveau;
    return { avancement: avancementInitial(debloque), debloque };
  }
  return { avancement: { niveauAtteint, dernieresReponses }, debloque: null };
}

/** Où en est le passage au niveau suivant : réponses comptées, réponses requises, réussites. Null au dernier niveau. */
export function etatPassage(
  avancement: AvancementMode,
): { reponses: number; requises: number; reussites: number } | null {
  const requises = contenuNiveau(avancement.niveauAtteint).reponsesPourPasser;
  if (requises === null) return null;
  const dernieres = avancement.dernieresReponses.slice(-requises);
  return { reponses: dernieres.length, requises, reussites: dernieres.filter(Boolean).length };
}
