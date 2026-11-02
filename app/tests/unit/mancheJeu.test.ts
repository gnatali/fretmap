import { describe, expect, it } from 'vitest';
import type { Position } from '../../src/music/manche';
import { caseAffichee, placeLibre } from '../../src/ui/composants/MancheJeu.svelte';

/** Positions sur les cases données (la corde ne compte pas). */
const surCases = (...cases: number[]): Position[] => cases.map((c) => ({ corde: 6, case: c }));

describe('placeLibre : la plus longue bande de cases sans nouvelle note, pour le bilan du passage de niveau', () => {
  it('nouvelles notes en bas du manche de 8 cases (cases 6 et 7, niveaux 7 et 8) : cases 0 à 5', () => {
    expect(caseAffichee(7)).toBe(7);
    expect(placeLibre(surCases(6, 7, 7), 7)).toEqual({ debut: 0, part: 6 / 8 });
  });

  it('nouvelles notes en haut du manche (case 1, niveau 2) : cases 2 à 5', () => {
    expect(placeLibre(surCases(1, 1, 1), 5)).toEqual({ debut: 2 / 6, part: 4 / 6 });
  });

  it('nouvelles notes sur les cases 1 et 4 (niveau 5 en normal) : entre elles, cases 2 et 3, pas la seule case 0', () => {
    expect(placeLibre(surCases(1, 1, 4), 5)).toEqual({ debut: 2 / 6, part: 2 / 6 });
  });

  it('bandes de même longueur : la plus haute', () => {
    expect(placeLibre(surCases(2), 4)).toEqual({ debut: 0, part: 2 / 5 });
  });

  it('aucune nouvelle note (manche complet) : tout le manche', () => {
    expect(placeLibre([], 12)).toEqual({ debut: 0, part: 1 });
  });
});
