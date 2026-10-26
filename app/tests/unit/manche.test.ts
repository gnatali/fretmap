import { describe, expect, it } from 'vitest';
import { trouverAccordage } from '../../src/music/accordages';
import {
  CASE_MAX,
  MARQUEURS,
  casesDeLaNote,
  noteDePosition,
  positions,
  type NumeroCorde,
} from '../../src/music/manche';

// Tableau écrit à la main, indépendant du calcul : cases 0 à 12 de chaque corde, accordage standard.
const MANCHE: Record<NumeroCorde, string> = {
  6: 'E2 F2 F#2 G2 G#2 A2 A#2 B2 C3 C#3 D3 D#3 E3',
  5: 'A2 A#2 B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3',
  4: 'D3 D#3 E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4',
  3: 'G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4',
  2: 'B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4',
  1: 'E4 F4 F#4 G4 G#4 A4 A#4 B4 C5 C#5 D5 D#5 E5',
};

describe('noteDePosition', () => {
  it('donne la note des 6 × 13 positions du manche', () => {
    for (const [corde, ligne] of Object.entries(MANCHE)) {
      const attendues = ligne.split(' ');
      expect(attendues).toHaveLength(CASE_MAX + 1);
      attendues.forEach((note, k) => {
        expect(
          noteDePosition({ corde: Number(corde) as NumeroCorde, case: k }).libelle,
          `corde ${corde}, case ${k}`,
        ).toBe(note);
      });
    }
  });

  it('suit l’accordage choisi', () => {
    expect(noteDePosition({ corde: 6, case: 0 }, trouverAccordage('drop-d')).libelle).toBe('D2');
    expect(noteDePosition({ corde: 6, case: 2 }, trouverAccordage('drop-d')).libelle).toBe('E2');
  });

  it('refuse une position hors du manche', () => {
    expect(() => noteDePosition({ corde: 1, case: 13 })).toThrow();
    expect(() => noteDePosition({ corde: 1, case: -1 })).toThrow();
    expect(() => noteDePosition({ corde: 7 as NumeroCorde, case: 0 })).toThrow();
    expect(() => noteDePosition({ corde: 1, case: 1.5 })).toThrow();
  });
});

describe('casesDeLaNote', () => {
  it('donne toutes les cases d’une corde pour un nom de note', () => {
    expect(casesDeLaNote('E', 6)).toEqual([0, 12]);
    expect(casesDeLaNote('F#', 1)).toEqual([2]);
    expect(casesDeLaNote('C', 5)).toEqual([3]);
  });

  it('respecte la case maximale', () => {
    expect(casesDeLaNote('E', 6, undefined, 5)).toEqual([0]);
    expect(casesDeLaNote('C', 6, undefined, 5)).toEqual([]);
  });
});

describe('positions', () => {
  it('énumère le manche, de la corde 6 à la corde 1', () => {
    const toutes = positions();
    expect(toutes).toHaveLength(78);
    expect(toutes[0]).toEqual({ corde: 6, case: 0 });
    expect(toutes.at(-1)).toEqual({ corde: 1, case: 12 });
    expect(positions(0, 5)).toHaveLength(36);
    expect(positions(0, 0).map((p) => p.corde)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('place les marqueurs sur le manche', () => {
    expect(MARQUEURS.every((k) => k >= 1 && k <= CASE_MAX)).toBe(true);
  });
});
