import { describe, expect, it } from 'vitest';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';

describe('tirerQuestion avec la corde (niveaux 2 à 5)', () => {
  const candidates = positionsDuNiveau(5);
  const options = contenuNiveau(5);

  it('tire une position et accepte ses cases sur la même corde', () => {
    const q = tirerQuestion(candidates, options, () => 0);
    expect(q).toEqual({
      position: { corde: 6, case: 0 },
      nom: 'E',
      cordeDemandee: true,
      positionsCorrectes: [
        { corde: 6, case: 0 },
        { corde: 6, case: 12 },
      ],
    });
    expect(tirerQuestion(candidates, options, () => 0.999).position).toEqual({ corde: 1, case: 12 });
  });

  it('ne repose pas la position précédente', () => {
    const premiere = tirerQuestion(candidates, options, () => 0);
    expect(tirerQuestion(candidates, options, () => 0, premiere).position).toEqual({ corde: 6, case: 1 });
    for (let i = 0; i < 50; i++) {
      const q = tirerQuestion(candidates, options);
      expect(tirerQuestion(candidates, options, Math.random, q).position).not.toEqual(q.position);
    }
  });

  it('garde la seule position possible et refuse une liste vide', () => {
    const seule = tirerQuestion([{ corde: 3, case: 2 }], options, () => 0.5);
    expect(tirerQuestion([{ corde: 3, case: 2 }], options, () => 0.5, seule).nom).toBe('A');
    expect(() => tirerQuestion([], options)).toThrow();
  });
});

describe('tirerQuestion sans la corde (niveau 1)', () => {
  const candidates = positionsDuNiveau(1);
  const options = contenuNiveau(1);

  it('demande une note et accepte toutes les cordes à vide qui la donnent', () => {
    const e = tirerQuestion(candidates, options, () => 0);
    expect(e.nom).toBe('E');
    expect(e.cordeDemandee).toBe(false);
    expect(e.positionsCorrectes).toEqual([
      { corde: 6, case: 0 },
      { corde: 1, case: 0 },
    ]);
    expect(tirerQuestion(candidates, options, () => 0.5).positionsCorrectes).toEqual([{ corde: 4, case: 0 }]);
  });

  it('tire les cinq notes à parts égales et ne répète pas la précédente', () => {
    const noms = Array.from({ length: 5 }, (_, i) => tirerQuestion(candidates, options, () => i / 5).nom);
    expect(noms).toEqual(['E', 'A', 'D', 'G', 'B']);
    for (let i = 0; i < 50; i++) {
      const q = tirerQuestion(candidates, options);
      expect(tirerQuestion(candidates, options, Math.random, q).nom).not.toBe(q.nom);
    }
  });
});
