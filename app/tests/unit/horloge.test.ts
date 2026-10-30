import { describe, expect, it } from 'vitest';
import { HorlogeJeu } from '../../src/jeu/horloge';

describe('HorlogeJeu', () => {
  it('suit le temps réel hors pause, et le gèle pendant une pause', () => {
    const horloge = new HorlogeJeu();
    expect(horloge.jeu(1000)).toBe(1000);
    horloge.pauser(1500);
    expect(horloge.enPause).toBe(true);
    expect(horloge.jeu(1500)).toBe(1500);
    expect(horloge.jeu(4000)).toBe(1500);
    horloge.reprendre(4000);
    expect(horloge.enPause).toBe(false);
    expect(horloge.jeu(4000)).toBe(1500);
    expect(horloge.jeu(4100)).toBe(1600);
  });

  it('cumule plusieurs pauses et les rend relatives au début de la partie', () => {
    const horloge = new HorlogeJeu();
    horloge.pauser(2000);
    horloge.reprendre(3000);
    horloge.pauser(5000, true);
    horloge.reprendre(9000);
    expect(horloge.jeu(10_000)).toBe(5000);
    expect(horloge.pauses(500, 10_000)).toEqual([
      { tMs: 1500, dureeMs: 1000, arrierePlan: false },
      { tMs: 3500, dureeMs: 4000, arrierePlan: true },
    ]);
  });

  it('une pause manuelle devient automatique si l’onglet passe ensuite en arrière-plan', () => {
    const horloge = new HorlogeJeu();
    horloge.pauser(1000);
    horloge.pauser(1200, true);
    // Partie arrêtée pendant la pause : elle compte jusqu'à l'arrêt.
    expect(horloge.pauses(0, 3000)).toEqual([{ tMs: 1000, dureeMs: 2000, arrierePlan: true }]);
  });
});
