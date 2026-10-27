import { describe, expect, it } from 'vitest';
import { noteDePosition } from '../../src/music/manche';
import { CASE_MAX_MODE2, NIVEAUX, caseMaxDuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';

describe('positionsDuNiveau', () => {
  it('suit le contenu des niveaux de la spec §5.4', () => {
    expect(NIVEAUX.map((n) => positionsDuNiveau(n.niveau).length)).toEqual([6, 24, 36, 30, 48, 48, 78]);
  });

  it('niveau 1 : les six cordes à vide', () => {
    expect(positionsDuNiveau(1).map((p) => noteDePosition(p).libelle)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it.each([
    [2, 5],
    [4, 7],
    [6, 12],
  ] as const)('niveau %i : notes naturelles des cases 0 à %i', (niveau, caseMax) => {
    const p = positionsDuNiveau(niveau);
    expect(p.every((x) => x.case <= caseMax && !noteDePosition(x).nom.includes('#'))).toBe(true);
    expect(p.some((x) => x.case === caseMax)).toBe(true);
  });

  it('mode 2 : limité à la plage validée par le POC (case 12, E5)', () => {
    expect(CASE_MAX_MODE2).toBe(12);
    for (const { niveau } of NIVEAUX) {
      expect(caseMaxDuNiveau(niveau, 2)).toBeLessThanOrEqual(CASE_MAX_MODE2);
      expect(positionsDuNiveau(niveau, 2).every((p) => p.case <= CASE_MAX_MODE2)).toBe(true);
    }
    expect(Math.max(...positionsDuNiveau(7, 2).map((p) => noteDePosition(p).midi))).toBe(76); // E5
  });
});
