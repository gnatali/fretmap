import { describe, expect, it } from 'vitest';
import { verifierMode1 } from '../../src/quiz/validation';

describe('verifierMode1', () => {
  const c5 = { position: { corde: 5 as const, case: 4 }, nom: 'C#' as const, caseMax: 12 };

  it('accepte la bonne case et refuse les autres', () => {
    expect(verifierMode1(c5, { corde: 5, case: 4 })).toEqual({ juste: true, casesCorrectes: [4] });
    expect(verifierMode1(c5, { corde: 5, case: 5 })).toEqual({ juste: false, casesCorrectes: [4] });
  });

  it('refuse la même note sur une autre corde', () => {
    // C#3 : corde 5 case 4, mais aussi corde 6 case 9.
    expect(verifierMode1(c5, { corde: 6, case: 9 }).juste).toBe(false);
  });

  it('accepte la case 0 et la case 12 d’une corde à vide', () => {
    const e6 = { position: { corde: 6 as const, case: 0 }, nom: 'E' as const, caseMax: 12 };
    expect(verifierMode1(e6, { corde: 6, case: 12 })).toEqual({ juste: true, casesCorrectes: [0, 12] });
    expect(verifierMode1(e6, { corde: 6, case: 0 }).juste).toBe(true);
  });

  it('se limite aux cases du niveau', () => {
    const e6 = { position: { corde: 6 as const, case: 0 }, nom: 'E' as const, caseMax: 5 };
    expect(verifierMode1(e6, { corde: 6, case: 12 })).toEqual({ juste: false, casesCorrectes: [0] });
  });
});
