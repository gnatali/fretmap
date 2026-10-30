import { describe, expect, it } from 'vitest';
import { positions, type Position } from '../../src/music/manche';
import { difficulte, notesAAjouter, positionsDepart } from '../../src/jeu/difficulte';

const p = (corde: Position['corde'], numeroCase: number): Position => ({ corde, case: numeroCase });

describe('difficulte', () => {
  it('vaut la case, plus le poids d’une altération pour une note altérée', () => {
    expect(difficulte(p(6, 0), 3)).toBe(0);
    expect(difficulte(p(6, 1), 3)).toBe(1); // F
    expect(difficulte(p(5, 1), 3)).toBe(4); // A#
    expect(difficulte(p(5, 1), 0)).toBe(1);
    expect(difficulte(p(1, 12), 3)).toBe(12); // E
  });
});

describe('positionsDepart', () => {
  it('donne les 6 cordes à vide, de la corde 6 à la corde 1', () => {
    expect(positionsDepart()).toEqual([p(6, 0), p(5, 0), p(4, 0), p(3, 0), p(2, 0), p(1, 0)]);
  });
});

describe('notesAAjouter', () => {
  it('ajoute les notes les plus proches de la difficulté moyenne du niveau', () => {
    // Moyenne 0 : les notes naturelles de la case 1 (F corde 6, C corde 2, F corde 1).
    const niveau2 = notesAAjouter(positionsDepart(), 3, 3);
    expect(niveau2).toEqual([p(6, 1), p(2, 1), p(1, 1)]);
    // Moyenne 1/3 : les notes naturelles de la case 2 (B, E, A).
    expect(notesAAjouter([...positionsDepart(), ...niveau2], 3, 3)).toEqual([p(5, 2), p(4, 2), p(3, 2)]);
  });

  it('suit le poids des altérations et le nombre demandé', () => {
    // Sans poids, A# (corde 5) et D# (corde 4) sont à la case 1 comme les naturelles.
    expect(notesAAjouter(positionsDepart(), 6, 0)).toEqual([p(6, 1), p(5, 1), p(4, 1), p(3, 1), p(2, 1), p(1, 1)]);
    expect(notesAAjouter(positionsDepart(), 1, 3)).toEqual([p(6, 1)]);
  });

  it('ne rend rien quand tout le manche est dans le niveau', () => {
    expect(notesAAjouter(positions(), 3, 3)).toEqual([]);
    expect(notesAAjouter(positions().slice(1), 3, 3)).toEqual([p(6, 0)]);
  });
});
