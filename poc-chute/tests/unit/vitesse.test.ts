import { describe, expect, it } from 'vitest';
import {
  DUREE_CHUTE_DEFAUT_MS,
  DUREE_CHUTE_MAX_MS,
  DUREE_CHUTE_MIN_MS,
  apresResultat,
  bornerDuree,
  vitesseInitiale,
  type EtatVitesse,
} from '../../src/jeu/vitesse';

const suite = (vitesse: EtatVitesse, resultats: boolean[]) => resultats.reduce(apresResultat, vitesse);

describe('vitesse adaptative', () => {
  it('part de la durée choisie, 6 s par défaut', () => {
    expect(vitesseInitiale()).toEqual({ dureeMs: DUREE_CHUTE_DEFAUT_MS, justesDAffilee: 0, fixe: false });
    expect(vitesseInitiale(4000).dureeMs).toBe(4000);
  });

  it('accélère de 10 % à la 5e note juste d’affilée, puis repart de zéro', () => {
    const quatre = suite(vitesseInitiale(6000), [true, true, true, true]);
    expect(quatre).toEqual({ dureeMs: 6000, justesDAffilee: 4, fixe: false });
    const cinq = apresResultat(quatre, true);
    expect(cinq.dureeMs).toBeCloseTo(5400);
    expect(cinq.justesDAffilee).toBe(0);
    expect(suite(cinq, [true, true, true, true, true]).dureeMs).toBeCloseTo(4860);
  });

  it('ralentit de 15 % à chaque erreur et remet le décompte à zéro', () => {
    const v = apresResultat(suite(vitesseInitiale(6000), [true, true, true]), false);
    expect(v.dureeMs).toBeCloseTo(6900);
    expect(v.justesDAffilee).toBe(0);
    // Après l'erreur, il faut de nouveau 5 notes justes pour accélérer.
    expect(suite(v, [true, true, true, true]).dureeMs).toBeCloseTo(6900);
  });

  it('reste entre 1 et 10 s', () => {
    expect(apresResultat(vitesseInitiale(9500), false).dureeMs).toBe(DUREE_CHUTE_MAX_MS);
    expect(suite(vitesseInitiale(1050), [true, true, true, true, true]).dureeMs).toBe(DUREE_CHUTE_MIN_MS);
    expect(bornerDuree(200)).toBe(DUREE_CHUTE_MIN_MS);
    expect(bornerDuree(60000)).toBe(DUREE_CHUTE_MAX_MS);
    expect(bornerDuree(Number.NaN)).toBe(DUREE_CHUTE_DEFAUT_MS);
  });

  it('ne change pas avec l’option « vitesse fixe »', () => {
    const fixe = vitesseInitiale(5000, true);
    expect(suite(fixe, [true, true, true, true, true, false])).toBe(fixe);
  });
});
