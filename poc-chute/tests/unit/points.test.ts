import { describe, expect, it } from 'vitest';
import { facteurDifficulte, multiplicateur, pointsNote, timingDe } from '../../src/jeu/points';

describe('timing', () => {
  it('Parfait jusqu’au tiers de la chute, Bien jusqu’aux deux tiers, Juste au-delà', () => {
    expect(timingDe(0)).toBe('parfait');
    expect(timingDe(1 / 3)).toBe('parfait');
    expect(timingDe(0.34)).toBe('bien');
    expect(timingDe(2 / 3)).toBe('bien');
    expect(timingDe(0.67)).toBe('juste');
    expect(timingDe(1)).toBe('juste');
  });
});

describe('multiplicateur de série', () => {
  it('×2 à la 10e note juste d’affilée, ×3 à la 20e, ×4 à partir de la 30e', () => {
    expect(multiplicateur(0)).toBe(1);
    expect(multiplicateur(9)).toBe(1);
    expect(multiplicateur(10)).toBe(2);
    expect(multiplicateur(19)).toBe(2);
    expect(multiplicateur(20)).toBe(3);
    expect(multiplicateur(30)).toBe(4);
    expect(multiplicateur(45)).toBe(4);
  });
});

describe('difficulté', () => {
  it('+50 % pour une note altérée, +50 % pour les cases 7 à 12', () => {
    expect(facteurDifficulte({ corde: 6, case: 0 })).toBe(1); // E2
    expect(facteurDifficulte({ corde: 6, case: 2 })).toBe(1.5); // F#2
    expect(facteurDifficulte({ corde: 6, case: 7 })).toBe(1.5); // B2
    expect(facteurDifficulte({ corde: 6, case: 6 })).toBe(1.5); // A#2, case 6
    expect(facteurDifficulte({ corde: 6, case: 9 })).toBe(2); // C#3, case 9
  });
});

describe('points d’une note juste', () => {
  it('exemple de la spec §6.6 : Bien, chute de 4 s, F# en case 2, 12e note d’affilée = 450', () => {
    expect(pointsNote({ timing: 'bien', dureeChuteMs: 4000, position: { corde: 6, case: 2 }, serie: 12 })).toBe(450);
  });

  it('100 points pour une note naturelle, Juste, chute de 5 s, sans série', () => {
    expect(pointsNote({ timing: 'juste', dureeChuteMs: 5000, position: { corde: 5, case: 3 }, serie: 1 })).toBe(100);
  });

  it('chaque facteur multiplie le total', () => {
    const base = { timing: 'juste', dureeChuteMs: 5000, position: { corde: 5, case: 3 }, serie: 1 } as const;
    expect(pointsNote({ ...base, timing: 'parfait' })).toBe(150);
    expect(pointsNote({ ...base, dureeChuteMs: 2500 })).toBe(200);
    expect(pointsNote({ ...base, dureeChuteMs: 10000 })).toBe(50);
    expect(pointsNote({ ...base, position: { corde: 5, case: 4 } })).toBe(150); // C#3
    expect(pointsNote({ ...base, serie: 20 })).toBe(300);
  });

  it('arrondit à l’entier', () => {
    // 100 × 1,5 × 5/6 = 125 ; 100 × 1,2 × 5/6 = 100 ; 100 × 5/7 = 71,4.
    expect(pointsNote({ timing: 'parfait', dureeChuteMs: 6000, position: { corde: 6, case: 0 }, serie: 1 })).toBe(125);
    expect(pointsNote({ timing: 'juste', dureeChuteMs: 7000, position: { corde: 6, case: 0 }, serie: 1 })).toBe(71);
  });
});
