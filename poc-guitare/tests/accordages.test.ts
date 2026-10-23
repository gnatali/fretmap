import { describe, expect, it } from 'vitest';
import { ACCORDAGES, cordeLaPlusProche, cordes, trouverAccordage } from '../src/music/accordages';

const attendus: Record<string, [string, number][]> = {
  standard: [['E2', 82.41], ['A2', 110.0], ['D3', 146.83], ['G3', 196.0], ['B3', 246.94], ['E4', 329.63]],
  'demi-ton-bas': [['D#2', 77.78], ['G#2', 103.83], ['C#3', 138.59], ['F#3', 185.0], ['A#3', 233.08], ['D#4', 311.13]],
  'drop-d': [['D2', 73.42], ['A2', 110.0], ['D3', 146.83], ['G3', 196.0], ['B3', 246.94], ['E4', 329.63]],
  dadgad: [['D2', 73.42], ['A2', 110.0], ['D3', 146.83], ['G3', 196.0], ['A3', 220.0], ['D4', 293.66]],
};

describe('accordages', () => {
  it('définit les quatre accordages de la spécification', () => {
    expect(ACCORDAGES.map((a) => a.id)).toEqual(Object.keys(attendus));
  });

  for (const [id, notes] of Object.entries(attendus)) {
    it(`${id} : six bonnes notes et fréquences, de la 6e à la 1re`, () => {
      const liste = cordes(trouverAccordage(id)!);
      expect(liste).toHaveLength(6);
      liste.forEach((corde, i) => {
        expect(corde.numero).toBe(6 - i);
        expect(corde.note).toBe(notes[i]![0]);
        expect(corde.frequence).toBeCloseTo(notes[i]![1], 1);
      });
    });
  }

  it('recalcule les fréquences cibles quand A4 change', () => {
    const standard = trouverAccordage('standard')!;
    const a432 = cordes(standard, 432);
    expect(a432[0]!.frequence).toBeCloseTo(80.91, 2);
    expect(a432[5]!.frequence).toBeCloseTo(323.63, 2);
  });
});

describe('cordeLaPlusProche', () => {
  const standard = trouverAccordage('standard')!;

  it('choisit la corde la plus proche en cents', () => {
    expect(cordeLaPlusProche(83, standard)?.corde.numero).toBe(6);
    expect(cordeLaPlusProche(108, standard)?.corde.numero).toBe(5);
    expect(cordeLaPlusProche(250, standard)?.corde.numero).toBe(2);
    expect(cordeLaPlusProche(330, standard)?.corde.numero).toBe(1);
  });

  it('renvoie l’écart signé par rapport à la corde cible', () => {
    const r = cordeLaPlusProche(110 * 2 ** (-30 / 1200), standard);
    expect(r?.corde.note).toBe('A2');
    expect(r?.cents).toBeCloseTo(-30, 6);
  });

  it('tient compte de la référence A4', () => {
    const r = cordeLaPlusProche(108, standard, 432);
    expect(r?.corde.note).toBe('A2');
    expect(r?.cents).toBeCloseTo(0, 0);
  });

  it('renvoie null pour une fréquence invalide', () => {
    expect(cordeLaPlusProche(0, standard)).toBeNull();
  });
});
