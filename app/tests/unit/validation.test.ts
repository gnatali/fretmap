import { describe, expect, it } from 'vitest';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';
import { verifierMode1 } from '../../src/quiz/validation';

const question = (niveau: 1 | 2 | 3 | 4 | 5, corde: number, numeroCase: number) => {
  const candidates = positionsDuNiveau(niveau).filter((p) => p.corde === corde && p.case === numeroCase);
  return tirerQuestion(candidates, contenuNiveau(niveau), () => 0);
};

describe('verifierMode1', () => {
  it('accepte la bonne case et refuse les autres', () => {
    const c5 = question(5, 5, 4);
    expect(c5.nom).toBe('C#');
    expect(verifierMode1(c5, { corde: 5, case: 4 })).toEqual({
      juste: true,
      positionsCorrectes: [{ corde: 5, case: 4 }],
    });
    expect(verifierMode1(c5, { corde: 5, case: 5 }).juste).toBe(false);
  });

  it('refuse la même note sur une autre corde quand la corde est demandée', () => {
    // C#3 : corde 5 case 4, mais aussi corde 6 case 9.
    expect(verifierMode1(question(5, 5, 4), { corde: 6, case: 9 }).juste).toBe(false);
  });

  it('accepte la case 0 et la case 12 d’une même corde', () => {
    const e6 = question(5, 6, 0);
    expect(verifierMode1(e6, { corde: 6, case: 12 }).juste).toBe(true);
    expect(verifierMode1(e6, { corde: 6, case: 0 }).juste).toBe(true);
  });

  it('se limite aux cases du niveau', () => {
    expect(verifierMode1(question(3, 6, 0), { corde: 6, case: 12 }).juste).toBe(false);
  });

  it('niveau 1 : E est accepté sur la corde 6 et sur la corde 1, pas sur la corde 5', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    expect(e.nom).toBe('E');
    expect(verifierMode1(e, { corde: 6, case: 0 }).juste).toBe(true);
    expect(verifierMode1(e, { corde: 1, case: 0 }).juste).toBe(true);
    expect(verifierMode1(e, { corde: 5, case: 0 }).juste).toBe(false);
  });
});
