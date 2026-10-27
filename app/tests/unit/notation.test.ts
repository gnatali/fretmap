import { describe, expect, it } from 'vitest';
import { NOMS_FRANCAIS, nomAffiche, nomSurDeuxLignes } from '../../src/music/notation';
import { NOMS_NOTES } from '../../src/music/notes';

describe('notation', () => {
  it('nomme les 12 notes en français, en dièses', () => {
    expect(NOMS_NOTES.map((n) => NOMS_FRANCAIS[n])).toEqual([
      'Do',
      'Do#',
      'Ré',
      'Ré#',
      'Mi',
      'Fa',
      'Fa#',
      'Sol',
      'Sol#',
      'La',
      'La#',
      'Si',
    ]);
  });

  it('affiche les 12 notes dans les trois notations', () => {
    for (const nom of NOMS_NOTES) {
      expect(nomAffiche(nom, 'anglo-saxonne')).toBe(nom);
      expect(nomAffiche(nom, 'francaise')).toBe(NOMS_FRANCAIS[nom]);
      expect(nomAffiche(nom, 'les-deux')).toBe(`${NOMS_FRANCAIS[nom]} (${nom})`);
    }
    expect(nomAffiche('C#', 'les-deux')).toBe('Do# (C#)');
  });

  it("garde le même numéro d'octave dans les deux notations", () => {
    expect(nomAffiche('E', 'anglo-saxonne', 2)).toBe('E2');
    expect(nomAffiche('E', 'francaise', 2)).toBe('Mi2');
    expect(nomAffiche('A', 'les-deux', 4)).toBe('La4 (A4)');
    expect(nomAffiche('G#', 'les-deux', 3)).toBe('Sol#3 (G#3)');
  });

  it('sur deux lignes, met le français au-dessus seulement avec « les deux »', () => {
    expect(nomSurDeuxLignes('G#', 'les-deux')).toEqual({ haut: 'Sol#', bas: 'G#' });
    expect(nomSurDeuxLignes('G#', 'francaise')).toEqual({ haut: 'Sol#', bas: null });
    expect(nomSurDeuxLignes('G#', 'anglo-saxonne')).toEqual({ haut: 'G#', bas: null });
  });
});
