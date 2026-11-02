import { describe, expect, it } from 'vitest';
import type { Position } from '../../src/music/manche';
import { caseAffichee, placeLibre } from '../../src/ui/composants/MancheJeu.svelte';

describe('placeLibre : où poser le bilan du passage de niveau sans cacher les nouvelles notes', () => {
  it('nouvelles notes en bas du manche de 8 cases (cases 6 et 7, niveaux 7 et 8) : au-dessus, 6 cases sur 8', () => {
    const nouvelles: Position[] = [
      { corde: 2, case: 6 },
      { corde: 6, case: 7 },
      { corde: 5, case: 7 },
    ];
    expect(caseAffichee(7)).toBe(7);
    expect(placeLibre(nouvelles, 7)).toEqual({ cote: 'haut', part: 6 / 8 });
  });

  it('nouvelles notes en haut du manche (case 1, niveau 2) : en dessous, 4 cases sur 6', () => {
    const nouvelles: Position[] = [
      { corde: 6, case: 1 },
      { corde: 2, case: 1 },
    ];
    expect(placeLibre(nouvelles, 5)).toEqual({ cote: 'bas', part: 4 / 6 });
  });

  it('autant de place des deux côtés : au-dessus', () => {
    expect(placeLibre([{ corde: 3, case: 2 }], 4)).toEqual({ cote: 'haut', part: 2 / 5 });
  });

  it('nouvelles notes au milieu du manche de 13 cases : le côté le plus grand', () => {
    const nouvelles: Position[] = [
      { corde: 6, case: 5 },
      { corde: 4, case: 8 },
    ];
    expect(placeLibre(nouvelles, 12)).toEqual({ cote: 'haut', part: 5 / 13 });
  });

  it('aucune nouvelle note (manche complet) : tout le manche', () => {
    expect(placeLibre([], 12)).toEqual({ cote: 'bas', part: 1 });
  });
});
