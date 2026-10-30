import { describe, expect, it } from 'vitest';
import { NOMS_ECARTES, retenirNom, sansNomsRecents } from '../../src/jeu/enchainement';
import { positionsDepart } from '../../src/jeu/progressif/difficulte';
import type { Position } from '../../src/music/manche';

// Cordes à vide : E2, A2, D3, G3, B3, E4.
const [e2, a2, d3, g3, b3, e4] = positionsDepart() as [Position, Position, Position, Position, Position, Position];

describe('sansNomsRecents', () => {
  it('écarte les noms des 2 dernières notes, sur toutes leurs positions', () => {
    expect(NOMS_ECARTES).toBe(2);
    expect(sansNomsRecents(positionsDepart(), [])).toEqual(positionsDepart());
    expect(sansNomsRecents(positionsDepart(), ['A', 'E'])).toEqual([d3, g3, b3]);
    // Un nom gardé garde toutes ses positions (E2 et E4).
    expect(sansNomsRecents(positionsDepart(), ['A', 'D'])).toEqual([e2, g3, b3, e4]);
  });

  it('n’écarte que le dernier nom s’il ne reste rien, puis aucun', () => {
    expect(sansNomsRecents([e2, a2, e4], ['A', 'E'])).toEqual([a2]);
    expect(sansNomsRecents([e2, e4], ['A', 'E'])).toEqual([e2, e4]);
  });
});

describe('retenirNom', () => {
  it('garde les 2 derniers noms, du plus ancien au plus récent', () => {
    expect(retenirNom([], 'E')).toEqual(['E']);
    expect(retenirNom(['E', 'A'], 'D')).toEqual(['A', 'D']);
  });
});
