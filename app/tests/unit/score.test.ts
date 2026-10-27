import { describe, expect, it } from 'vitest';
import { SCORE_INITIAL, noter, pourcentage } from '../../src/quiz/score';

describe('score', () => {
  it('compte les questions, les bonnes réponses et les séries', () => {
    const reponses = [true, true, false, true, true, true, false];
    const score = reponses.reduce(noter, SCORE_INITIAL);
    expect(score).toEqual({ questions: 7, bonnes: 5, serie: 0, meilleureSerie: 3 });
    expect(pourcentage(score)).toBe(71);
  });

  it('n’a pas de pourcentage avant la première question', () => {
    expect(pourcentage(SCORE_INITIAL)).toBeNull();
  });
});
