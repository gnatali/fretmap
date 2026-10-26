import { describe, expect, it } from 'vitest';
import { FenetreGlissante, mediane, moyenne } from '../../src/audio/pitch';

describe('moyenne et médiane', () => {
  it('calcule la moyenne', () => {
    expect(moyenne([1, 2, 3, 4])).toBe(2.5);
  });

  it('calcule la médiane (impair et pair)', () => {
    expect(mediane([5, 1, 3])).toBe(3);
    expect(mediane([4, 1, 3, 2])).toBe(2.5);
  });

  it('renvoie NaN sur une liste vide', () => {
    expect(moyenne([])).toBeNaN();
    expect(mediane([])).toBeNaN();
  });
});

describe('FenetreGlissante', () => {
  it('moyenne glissante sur les N dernières valeurs', () => {
    const f = new FenetreGlissante(3, 'moyenne');
    [10, 20, 30, 40].forEach((v) => f.ajouter(v));
    expect(f.nombre).toBe(3);
    expect(f.valeur()).toBe(30);
  });

  it('médiane glissante : ignore une valeur aberrante (erreur d’octave)', () => {
    const f = new FenetreGlissante(5, 'mediane');
    [110, 110.2, 220, 109.9, 110.1].forEach((v) => f.ajouter(v));
    expect(f.valeur()).toBe(110.1);
    const m = new FenetreGlissante(5, 'moyenne');
    [110, 110.2, 220, 109.9, 110.1].forEach((v) => m.ajouter(v));
    expect(m.valeur()).toBeCloseTo(132.04, 2);
  });

  it('avec moins de valeurs que la fenêtre, utilise les valeurs disponibles', () => {
    const f = new FenetreGlissante(5, 'moyenne');
    expect(f.valeur()).toBeNull();
    f.ajouter(100);
    expect(f.valeur()).toBe(100);
    f.ajouter(110);
    expect(f.valeur()).toBe(105);
    f.mode = 'mediane';
    expect(f.valeur()).toBe(105);
  });

  it('se vide', () => {
    const f = new FenetreGlissante(3);
    f.ajouter(1);
    f.vider();
    expect(f.valeur()).toBeNull();
    expect(f.nombre).toBe(0);
  });

  it('refuse une taille invalide', () => {
    expect(() => new FenetreGlissante(0)).toThrow();
  });
});
