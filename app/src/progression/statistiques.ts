// Statistiques par position : mise à jour à chaque réponse (spec §5.1, §6). La pondération des tirages vient en phase 6.
import type { Position } from '../music/manche';
import type { Mode, Progression, Statistique } from './modele';

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
