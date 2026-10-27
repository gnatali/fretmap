import { describe, expect, it } from 'vitest';
import { noteDePosition } from '../../src/music/manche';
import { NIVEAUX, positionsDuNiveau } from '../../src/progression/niveaux';

describe('positionsDuNiveau', () => {
  it('suit le contenu des niveaux de la spec §5.4', () => {
    expect(NIVEAUX.map((n) => positionsDuNiveau(n.niveau).length)).toEqual([6, 24, 36, 48, 78]);
  });

  it('niveau 1 : les six cordes à vide', () => {
    expect(positionsDuNiveau(1).map((p) => noteDePosition(p).libelle)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it('niveau 2 : notes naturelles des cases 0 à 5', () => {
    const p = positionsDuNiveau(2);
    expect(p.every((x) => x.case <= 5 && !noteDePosition(x).nom.includes('#'))).toBe(true);
  });
});
