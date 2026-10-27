// Score de session (spec §5.1) : questions, bonnes réponses, série en cours et meilleure série.

export interface Score {
  questions: number;
  bonnes: number;
  serie: number;
  meilleureSerie: number;
}

export const SCORE_INITIAL: Readonly<Score> = { questions: 0, bonnes: 0, serie: 0, meilleureSerie: 0 };

export function noter(score: Score, juste: boolean): Score {
  const serie = juste ? score.serie + 1 : 0;
  return {
    questions: score.questions + 1,
    bonnes: score.bonnes + (juste ? 1 : 0),
    serie,
    meilleureSerie: Math.max(score.meilleureSerie, serie),
  };
}

/** Taux de réussite en pourcentage entier ; null avant la première question. */
export function pourcentage(score: Score): number | null {
  return score.questions ? Math.round((score.bonnes / score.questions) * 100) : null;
}
