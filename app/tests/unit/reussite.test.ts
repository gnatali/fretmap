import { describe, expect, it } from 'vitest';
import type { Position } from '../../src/music/manche';
import { REGLAGES_PROGRESSIF_DEFAUT } from '../../src/jeu/reglages';
import {
  justesse,
  matriceReussites,
  rapidite,
  reussiteEssais,
  reussiteGlobale,
  reussiteNote,
  scoreEssai,
  type Essai,
} from '../../src/jeu/reussite';

// Réglages par défaut : délai depuis la note précédente bon à 1,5 s, lent à 6 s ; après apparition, 2 s et 10 s ;
// 5 essais par note, 10 pour « derniers », altération = 3 cases.
const P = REGLAGES_PROGRESSIF_DEFAUT;
const E6: Position = { corde: 6, case: 0 };
const A5: Position = { corde: 5, case: 0 };
const AS5: Position = { corde: 5, case: 1 }; // A#, difficulté 4

/** Essai juste, rapide par défaut (1 s depuis la note précédente, 1 s après apparition). */
function juste(position: Position, erreurs = 0, delaiNoteMs = 1000, delaiApparitionMs = 1000): Essai {
  return { position, resultat: 'juste', erreurs, delaiNoteMs, delaiApparitionMs };
}
const ratee = (position: Position, erreurs = 0): Essai => ({
  position,
  resultat: 'ratee',
  erreurs,
  delaiNoteMs: null,
  delaiApparitionMs: null,
});
const perdue = (position: Position): Essai => ({
  position,
  resultat: 'perdue',
  erreurs: 3,
  delaiNoteMs: null,
  delaiApparitionMs: null,
});

describe('rapidité, justesse, score d’essai', () => {
  it('rapidité : 1 jusqu’au temps bon, 0 au temps lent, une droite entre les deux', () => {
    expect(rapidite(1000, 1500, 6000)).toBe(1);
    expect(rapidite(3750, 1500, 6000)).toBe(0.5);
    expect(rapidite(6000, 1500, 6000)).toBe(0);
    expect(rapidite(null, 1500, 6000)).toBe(0);
  });

  it('justesse : 1 du premier coup, divisée par 2 à chaque fausse note, 0 sinon', () => {
    expect(justesse(juste(E6))).toBe(1);
    expect(justesse(juste(E6, 2))).toBe(0.25);
    expect(justesse(ratee(E6))).toBe(0);
    expect(justesse(perdue(E6))).toBe(0);
  });

  it('score d’essai : justesse × (0,5 + 0,5 × rapidité moyenne)', () => {
    expect(scoreEssai(juste(E6), P)).toBe(1);
    // Rapidités 0,5 (3,75 s) et 0 (10 s) : moyenne 0,25, score 0,625 ; après une fausse note, 0,3125.
    expect(scoreEssai(juste(E6, 0, 3750, 10000), P)).toBe(0.625);
    expect(scoreEssai(juste(E6, 1, 3750, 10000), P)).toBe(0.3125);
    expect(scoreEssai(ratee(E6), P)).toBe(0);
  });
});

describe('méthodes de réussite d’une note', () => {
  const essais = [juste(E6), juste(E6, 1, 3750), ratee(E6, 1)];

  it('score : moyenne des scores d’essai', () => {
    // 1 ; 0,5 × (0,5 + 0,5 × 0,75) = 0,4375 ; 0.
    expect(reussiteEssais('score', essais, P)).toBeCloseTo((1 + 0.4375 + 0) / 3);
  });

  it('taux : justes / réponses (fausses notes et notes ratées comptent comme fausses)', () => {
    // Réponses : 1 + (1 fausse + 1 juste) + (1 fausse + la ratée) = 5, dont 2 justes.
    expect(reussiteEssais('taux', essais, P)).toBeCloseTo(2 / 5);
    // Une note perdue ne compte que ses 3 fausses notes.
    expect(reussiteEssais('taux', [juste(E6), perdue(E6)], P)).toBeCloseTo(1 / 4);
  });

  it('temps : rapidité depuis la note précédente, 0 pour un essai qui n’est pas juste', () => {
    expect(reussiteEssais('temps', essais, P)).toBeCloseTo((1 + 0.5 + 0) / 3);
  });

  it('ne prend que les N derniers essais de la note ; 0 sans essai', () => {
    const anciens = Array.from({ length: 5 }, () => ratee(E6));
    expect(reussiteNote('score', E6, [...anciens, ...Array.from({ length: 5 }, () => juste(E6))], P)).toBe(1);
    expect(reussiteNote('score', A5, anciens, P)).toBe(0);
  });
});

describe('méthodes de réussite globale', () => {
  const niveau = [E6, AS5];
  const essais = [juste(E6), juste(E6), ratee(AS5)];

  it('moyenne des notes, et moyenne pondérée par 1 + difficulté', () => {
    expect(reussiteGlobale('moyenne', 'score', niveau, essais, P)).toBe(0.5);
    // E6 : poids 1, réussite 1 ; A#5 : poids 5, réussite 0.
    expect(reussiteGlobale('ponderee', 'score', niveau, essais, P)).toBeCloseTo(1 / 6);
  });

  it('derniers essais : la méthode de note sur les M derniers essais du niveau', () => {
    expect(reussiteGlobale('derniers', 'score', niveau, essais, P)).toBeCloseTo(2 / 3);
    const longue = [...Array.from({ length: 10 }, () => ratee(E6)), ...Array.from({ length: 10 }, () => juste(E6))];
    expect(reussiteGlobale('derniers', 'score', niveau, longue, P)).toBe(1);
  });

  it('matrice de toutes les combinaisons, arrondie (journal)', () => {
    const matrice = matriceReussites(niveau, essais, P);
    expect(Object.keys(matrice)).toEqual(['score', 'taux', 'temps']);
    expect(matrice.score).toEqual({ moyenne: 0.5, ponderee: 0.167, derniers: 0.667 });
    expect(matrice.taux.moyenne).toBe(0.5);
  });
});
