import { describe, expect, it } from 'vitest';
import { positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';

describe('tirerQuestion', () => {
  const cordesAVide = positionsDuNiveau(1);

  it('tire une position de la liste et donne sa note', () => {
    expect(tirerQuestion(cordesAVide, 0, () => 0)).toEqual({ position: { corde: 6, case: 0 }, nom: 'E', caseMax: 0 });
    expect(tirerQuestion(cordesAVide, 0, () => 0.999).position).toEqual({ corde: 1, case: 0 });
  });

  it('ne repose pas la question précédente', () => {
    const q = tirerQuestion(cordesAVide, 0, () => 0, { corde: 6, case: 0 });
    expect(q.position).toEqual({ corde: 5, case: 0 });
    for (let i = 0; i < 50; i++) {
      const precedente = cordesAVide[i % 6]!;
      expect(tirerQuestion(cordesAVide, 0, Math.random, precedente).position).not.toEqual(precedente);
    }
  });

  it('garde la seule position possible', () => {
    expect(tirerQuestion([{ corde: 3, case: 2 }], 2, () => 0.5, { corde: 3, case: 2 }).nom).toBe('A');
  });

  it('refuse une liste vide', () => {
    expect(() => tirerQuestion([], 0)).toThrow();
  });
});
