import { describe, expect, it } from 'vitest';
import {
  ACCORDAGES,
  SuiviJustesse,
  cibleAccordeur,
  cordeLaPlusProche,
  cordes,
  trouverAccordage,
  zoneEcart,
} from '../../src/music/accordages';

const attendus: Record<string, [string, number][]> = {
  standard: [
    ['E2', 82.41],
    ['A2', 110.0],
    ['D3', 146.83],
    ['G3', 196.0],
    ['B3', 246.94],
    ['E4', 329.63],
  ],
  'demi-ton-bas': [
    ['D#2', 77.78],
    ['G#2', 103.83],
    ['C#3', 138.59],
    ['F#3', 185.0],
    ['A#3', 233.08],
    ['D#4', 311.13],
  ],
  'drop-d': [
    ['D2', 73.42],
    ['A2', 110.0],
    ['D3', 146.83],
    ['G3', 196.0],
    ['B3', 246.94],
    ['E4', 329.63],
  ],
  dadgad: [
    ['D2', 73.42],
    ['A2', 110.0],
    ['D3', 146.83],
    ['G3', 196.0],
    ['A3', 220.0],
    ['D4', 293.66],
  ],
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

describe('zoneEcart', () => {
  it('vert à ±5 cents, orange à ±15 cents, rouge au-delà', () => {
    expect(zoneEcart(0)).toBe('juste');
    expect(zoneEcart(-5)).toBe('juste');
    expect(zoneEcart(5.1)).toBe('proche');
    expect(zoneEcart(-15)).toBe('proche');
    expect(zoneEcart(15.1)).toBe('loin');
    expect(zoneEcart(-120)).toBe('loin');
  });
});

describe('cibleAccordeur', () => {
  const standard = trouverAccordage('standard')!;
  const dropD = trouverAccordage('drop-d')!;

  it('mode cordes automatique : corde la plus proche', () => {
    const c = cibleAccordeur(111, { mode: 'cordes', accordage: standard, numeroCorde: null, a4: 440 });
    expect(c?.libelle).toBe('A2');
    expect(c?.corde?.numero).toBe(5);
    expect(c?.cents).toBeCloseTo(15.67, 1);
  });

  it('mode cordes avec corde choisie : écart par rapport à cette corde, même au-delà de ±50 cents', () => {
    const c = cibleAccordeur(77.78, { mode: 'cordes', accordage: standard, numeroCorde: 6, a4: 440 });
    expect(c?.libelle).toBe('E2');
    expect(c?.cents).toBeCloseTo(-100, 0);
  });

  it('suit l’accordage choisi', () => {
    const c = cibleAccordeur(74, { mode: 'cordes', accordage: dropD, numeroCorde: null, a4: 440 });
    expect(c?.libelle).toBe('D2');
  });

  it('mode chromatique : note la plus proche, quelle que soit la corde', () => {
    const c = cibleAccordeur(466, { mode: 'chromatique', accordage: standard, numeroCorde: 6, a4: 440 });
    expect(c?.libelle).toBe('A#4');
    expect(c?.corde).toBeNull();
    expect(c?.frequence).toBeCloseTo(466.16, 2);
  });

  it('recalcule la cible avec la référence A4', () => {
    const c = cibleAccordeur(108, { mode: 'cordes', accordage: standard, numeroCorde: 5, a4: 432 });
    expect(c?.frequence).toBeCloseTo(108, 2);
    expect(c?.cents).toBeCloseTo(0, 1);
  });

  it('renvoie null pour une fréquence invalide', () => {
    expect(cibleAccordeur(0, { mode: 'cordes', accordage: standard, numeroCorde: null, a4: 440 })).toBeNull();
    expect(cibleAccordeur(-1, { mode: 'chromatique', accordage: standard, numeroCorde: null, a4: 440 })).toBeNull();
  });
});

describe('SuiviJustesse', () => {
  it('indique « juste » après 300 ms consécutives dans la zone verte', () => {
    const s = new SuiviJustesse(300);
    expect(s.traiter(2, 'E2', 0)).toBe(false);
    expect(s.traiter(-3, 'E2', 200)).toBe(false);
    expect(s.traiter(1, 'E2', 300)).toBe(true);
  });

  it('repart de zéro si la note sort de la zone verte, disparaît ou change de cible', () => {
    const s = new SuiviJustesse(300);
    s.traiter(0, 'E2', 0);
    expect(s.traiter(8, 'E2', 200)).toBe(false);
    expect(s.traiter(0, 'E2', 300)).toBe(false);
    expect(s.traiter(0, 'E2', 600)).toBe(true);
    expect(s.traiter(null, null, 650)).toBe(false);
    s.traiter(0, 'E2', 700);
    expect(s.traiter(0, 'A2', 1000)).toBe(false);
    expect(s.traiter(0, 'A2', 1300)).toBe(true);
  });
});
