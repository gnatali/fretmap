import { describe, expect, it } from 'vitest';
import {
  bornerA4,
  frequenceVersMidiFloat,
  frequenceVersNote,
  midiVersFrequence,
  midiVersNote,
  nomVersMidi,
} from '../src/music/notes';

describe('frequenceVersNote', () => {
  it('440 Hz → A4 et 0 cent', () => {
    const note = frequenceVersNote(440);
    expect(note?.libelle).toBe('A4');
    expect(note?.midi).toBe(69);
    expect(note?.cents).toBe(0);
  });

  it('82,41 Hz → E2', () => {
    const note = frequenceVersNote(82.41);
    expect(note?.libelle).toBe('E2');
    expect(note?.cents).toBe(0);
  });

  it('466 Hz → A#4 (convention en dièses)', () => {
    const note = frequenceVersNote(466);
    expect(note?.libelle).toBe('A#4');
    expect(note?.cents).toBe(-1);
  });

  it('écart positif quand la note est trop haute, négatif quand elle est trop basse', () => {
    expect(frequenceVersNote(445)?.cents).toBe(20);
    expect(frequenceVersNote(435)?.cents).toBe(-20);
  });

  it('reconnaît chaque note de E2 à E6 à ±49 cents', () => {
    for (let midi = 40; midi <= 88; midi++) {
      const f = midiVersFrequence(midi);
      for (const cents of [-49, -25, 0, 25, 49]) {
        const note = frequenceVersNote(f * 2 ** (cents / 1200));
        expect(note?.midi).toBe(midi);
        expect(note?.cents).toBe(cents);
      }
    }
  });

  it('à exactement ±50 cents, arrondit vers la note supérieure', () => {
    const f = midiVersFrequence(69);
    expect(frequenceVersNote(f * 2 ** (50 / 1200))?.libelle).toBe('A#4');
    expect(frequenceVersNote(f * 2 ** (50 / 1200))?.cents).toBe(-50);
    expect(frequenceVersNote(f * 2 ** (-50 / 1200))?.libelle).toBe('A4');
  });

  it('renvoie null pour une fréquence nulle, négative ou non finie', () => {
    for (const f of [0, -82.41, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(frequenceVersNote(f)).toBeNull();
      expect(frequenceVersMidiFloat(f)).toBeNaN();
    }
  });

  it('A4 à 432 Hz : 432 Hz → A4 juste, 440 Hz → A4 +32 cents', () => {
    expect(frequenceVersNote(432, 432)?.cents).toBe(0);
    expect(frequenceVersNote(440, 432)?.libelle).toBe('A4');
    expect(frequenceVersNote(440, 432)?.cents).toBe(32);
    expect(midiVersFrequence(40, 432)).toBeCloseTo(80.91, 2);
  });
});

describe('midiVersNote et nomVersMidi', () => {
  it('octaves et noms', () => {
    expect(midiVersNote(40).libelle).toBe('E2');
    expect(midiVersNote(60).libelle).toBe('C4');
    expect(midiVersNote(59).libelle).toBe('B3');
    expect(midiVersNote(0).libelle).toBe('C-1');
  });

  it('lit dièses et bémols', () => {
    expect(nomVersMidi('E2')).toBe(40);
    expect(nomVersMidi('A#4')).toBe(70);
    expect(nomVersMidi('Bb4')).toBe(70);
    expect(nomVersMidi('d#2')).toBe(39);
    expect(nomVersMidi('B#3')).toBe(60);
    expect(nomVersMidi('Cb4')).toBe(59);
    expect(nomVersMidi('H2')).toBeNull();
    expect(nomVersMidi('')).toBeNull();
  });
});

describe('bornerA4', () => {
  it('limite la référence à 430–450 Hz', () => {
    expect(bornerA4(420)).toBe(430);
    expect(bornerA4(460)).toBe(450);
    expect(bornerA4(442)).toBe(442);
    expect(bornerA4(Number.NaN)).toBe(440);
  });
});
