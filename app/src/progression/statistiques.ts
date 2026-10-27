// Statistiques par position : mise à jour à chaque réponse et poids des tirages (spec §5.1, §6).
import type { Position } from '../music/manche';
import type { Mode, Progression, Statistique } from './modele';

/**
 * Poids ajouté par le taux d'erreur dans le tirage pondéré. Le taux est lissé, (erreurs + 1) / (tentatives + 2) :
 * une position jamais jouée pèse 1 + 3 × 0,5 = 2,5 ; toujours réussie, son poids tend vers 1 ; toujours manquée,
 * vers 4. Une position mal connue revient donc jusqu'à 4 fois plus souvent qu'une position maîtrisée.
 */
export const POIDS_ERREUR = 3;

/** Poids d'une position dans le tirage, d'après sa statistique (absente : jamais jouée). */
export function poidsPosition(statistique?: Pick<Statistique, 'tentatives' | 'reussites'>): number {
  const tentatives = statistique?.tentatives ?? 0;
  const erreurs = tentatives - (statistique?.reussites ?? 0);
  return 1 + (POIDS_ERREUR * (erreurs + 1)) / (tentatives + 2);
}

/** Fonction de poids des positions pour un mode, d'après les statistiques de ce mode. */
export function poidsDuMode(statistiques: readonly Statistique[], mode: Mode): (position: Position) => number {
  const parPosition = new Map(statistiques.filter((s) => s.mode === mode).map((s) => [`${s.corde}-${s.case}`, s]));
  return (p) => poidsPosition(parPosition.get(`${p.corde}-${p.case}`));
}

export interface Reponse {
  mode: Mode;
  /** Position demandée (en mode 2, le micro ne vérifie que la hauteur). */
  position: Position;
  juste: boolean;
  tempsMs: number;
  date: Date;
}

/** Nouvelle progression avec la statistique de la position mise à jour ; l'originale n'est pas modifiée. */
export function enregistrerReponse(progression: Progression, reponse: Reponse): Progression {
  const { mode, position, juste, tempsMs, date } = reponse;
  const memePosition = (s: Statistique) => s.mode === mode && s.corde === position.corde && s.case === position.case;
  const ancienne = progression.statistiques.find(memePosition);
  const tentatives = (ancienne?.tentatives ?? 0) + 1;
  const nouvelle: Statistique = {
    mode,
    corde: position.corde,
    case: position.case,
    tentatives,
    reussites: (ancienne?.reussites ?? 0) + (juste ? 1 : 0),
    tempsMoyenMs: (ancienne ? ancienne.tempsMoyenMs * ancienne.tentatives + tempsMs : tempsMs) / tentatives,
    derniereDate: date.toISOString(),
  };
  return {
    ...progression,
    statistiques: ancienne
      ? progression.statistiques.map((s) => (s === ancienne ? nouvelle : s))
      : [...progression.statistiques, nouvelle],
  };
}
