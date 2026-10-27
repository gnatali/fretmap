import { describe, expect, it } from 'vitest';
import type { NoteEnChute } from '../../src/jeu/chute';
import type { EvenementPartie } from '../../src/jeu/partie';
import { frequenceVersNote, midiVersFrequence } from '../../src/music/notes';
import type { Niveau } from '../../src/progression/modele';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';
import { TEXTES, consigne, duree, emplacement, retour } from '../../src/ui/textes';

const question = (niveau: Niveau, corde: number, numeroCase: number) => {
  const candidates = positionsDuNiveau(niveau).filter((p) => p.corde === corde && p.case === numeroCase);
  return tirerQuestion(candidates, contenuNiveau(niveau), () => 0);
};

const note: NoteEnChute = { index: 1, question: question(7, 3, 0), progression: 0.2, tApparitionMs: 0, tAttendueMs: 0 };

describe('duree', () => {
  it('affiche des secondes avec une décimale', () => {
    expect(duree(6000)).toBe('6,0 s');
    expect(duree(4500)).toBe('4,5 s');
    expect(duree(1840)).toBe('1,8 s');
  });
});

describe('indicateur', () => {
  it('donne l’écart en cents signé, au singulier pour zéro', () => {
    expect(TEXTES.indicateur.cents(3.4)).toBe('+3 cents');
    expect(TEXTES.indicateur.cents(-12)).toBe('−12 cents');
    expect(TEXTES.indicateur.cents(0.3)).toBe('0 cent');
  });
});

describe('consigne', () => {
  it('donne la note et la corde, pas la case', () => {
    expect(consigne(question(7, 3, 0), 'les-deux', false)).toBe('À jouer : Sol (G) · corde 3');
    expect(consigne(question(7, 5, 3), 'francaise', false)).toBe('À jouer : Do · corde 5');
  });

  it('ajoute la case avec l’option de mesure', () => {
    expect(consigne(question(7, 5, 3), 'anglo-saxonne', true)).toBe('À jouer : C · corde 5 · case 3');
  });

  it('niveau 1 : la corde n’est pas donnée', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    expect(consigne(e, 'les-deux', true)).toBe('À jouer : Mi (E) · corde à vide');
  });
});

describe('retour', () => {
  const base = { type: 'resultat', note, serie: 1 } as const;

  it('note juste : timing et points', () => {
    const juste: Extract<EvenementPartie, { type: 'resultat' }> = {
      ...base,
      resultat: 'juste',
      timing: 'parfait',
      points: 125,
      detectee: null,
    };
    expect(retour(juste, 'les-deux')).toBe('Parfait ! +125');
    expect(retour({ ...juste, timing: 'bien', points: 100 }, 'les-deux')).toBe('Bien ! +100');
  });

  it('fausse note : la note jouée, dans la notation choisie', () => {
    const detectee = frequenceVersNote(midiVersFrequence(57))!;
    const fausse = { ...base, resultat: 'fausse', timing: null, points: 0, detectee } as const;
    expect(retour(fausse, 'les-deux')).toBe('Fausse note : La (A)');
    expect(retour(fausse, 'anglo-saxonne')).toBe('Fausse note : A');
  });

  it('note ratée', () => {
    expect(retour({ ...base, resultat: 'ratee', timing: null, points: 0, detectee: null }, 'les-deux')).toBe('Ratée');
  });
});

describe('emplacement', () => {
  it('donne la corde et la ou les cases', () => {
    expect(emplacement('G', [{ corde: 3, case: 0 }], true, 'les-deux')).toBe('Sol (G) · corde 3 : case 0');
    expect(
      emplacement(
        'E',
        [
          { corde: 6, case: 0 },
          { corde: 6, case: 12 },
        ],
        true,
        'anglo-saxonne',
      ),
    ).toBe('E · corde 6 : cases 0 et 12');
  });

  it('niveau 1 : les cordes à vide qui donnent la note', () => {
    const positions = [
      { corde: 6, case: 0 },
      { corde: 1, case: 0 },
    ] as const;
    expect(emplacement('E', positions, false, 'les-deux')).toBe('Mi (E) : corde 6 ou 1, à vide');
  });
});
