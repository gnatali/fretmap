import { describe, expect, it } from 'vitest';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import type { Niveau } from '../../src/progression/modele';
import { tirerQuestion, type Question } from '../../src/quiz/tirage';
import {
  DELAI_NON_DETECTION_MS,
  DUREE_SILENCE_RAPPEL_MS,
  SuiviMode2,
  verifierMode1,
  verifierMode2,
  type OptionsMode2,
} from '../../src/quiz/validation';
import { etat } from './detection';

const question = (niveau: Niveau, corde: number, numeroCase: number) => {
  const candidates = positionsDuNiveau(niveau).filter((p) => p.corde === corde && p.case === numeroCase);
  return tirerQuestion(candidates, contenuNiveau(niveau), () => 0);
};

describe('verifierMode1', () => {
  it('accepte la bonne case et refuse les autres', () => {
    const c5 = question(7, 5, 4);
    expect(c5.nom).toBe('C#');
    expect(verifierMode1(c5, { corde: 5, case: 4 })).toEqual({
      juste: true,
      positionsCorrectes: [{ corde: 5, case: 4 }],
    });
    expect(verifierMode1(c5, { corde: 5, case: 5 }).juste).toBe(false);
  });

  it('refuse la même note sur une autre corde quand la corde est demandée', () => {
    // C#3 : corde 5 case 4, mais aussi corde 6 case 9.
    expect(verifierMode1(question(7, 5, 4), { corde: 6, case: 9 }).juste).toBe(false);
  });

  it('accepte la case 0 et la case 12 d’une même corde', () => {
    const e6 = question(7, 6, 0);
    expect(verifierMode1(e6, { corde: 6, case: 12 }).juste).toBe(true);
    expect(verifierMode1(e6, { corde: 6, case: 0 }).juste).toBe(true);
  });

  it('se limite aux cases du niveau', () => {
    expect(verifierMode1(question(3, 6, 0), { corde: 6, case: 12 }).juste).toBe(false);
  });

  it('niveau 1 : E est accepté sur la corde 6 et sur la corde 1, pas sur la corde 5', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    expect(e.nom).toBe('E');
    expect(verifierMode1(e, { corde: 6, case: 0 }).juste).toBe(true);
    expect(verifierMode1(e, { corde: 1, case: 0 }).juste).toBe(true);
    expect(verifierMode1(e, { corde: 5, case: 0 }).juste).toBe(false);
  });
});

const noteJouee = (libelle: string, cents = 0) => etat(0, { note: libelle, cents }).stable!;
const DEFAUT: OptionsMode2 = { tolerance: 50, octaveStricte: false };
const STRICTE: OptionsMode2 = { tolerance: 50, octaveStricte: true };

describe('verifierMode2', () => {
  const c5 = question(7, 5, 4); // C#3

  it('accepte la note demandée et refuse les autres', () => {
    expect(verifierMode2(c5, noteJouee('C#3'), DEFAUT)).toBe(true);
    expect(verifierMode2(c5, noteJouee('D3'), DEFAUT)).toBe(false);
    expect(verifierMode2(c5, noteJouee('C3'), DEFAUT)).toBe(false);
  });

  it('octave non stricte : le nom suffit ; stricte : l’octave doit être celle de la position', () => {
    expect(verifierMode2(c5, noteJouee('C#4'), DEFAUT)).toBe(true);
    expect(verifierMode2(c5, noteJouee('C#4'), STRICTE)).toBe(false);
    expect(verifierMode2(c5, noteJouee('C#3'), STRICTE)).toBe(true);
  });

  it('octave stricte : accepte les octaves de toutes les positions acceptées', () => {
    const e6 = question(7, 6, 0); // E2 à vide, E3 en case 12
    expect(['E2', 'E3', 'E4'].map((n) => verifierMode2(e6, noteJouee(n), STRICTE))).toEqual([true, true, false]);
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0); // cordes 6 (E2) et 1 (E4)
    expect(['E2', 'E3', 'E4'].map((n) => verifierMode2(e, noteJouee(n), STRICTE))).toEqual([true, false, true]);
  });

  it('applique la tolérance en cents', () => {
    const fausse40 = noteJouee('C#3', 40);
    expect(verifierMode2(c5, fausse40, DEFAUT)).toBe(true);
    expect(verifierMode2(c5, fausse40, { ...DEFAUT, tolerance: 30 })).toBe(false);
    const fausse25 = noteJouee('C#3', -25);
    expect(verifierMode2(c5, fausse25, { ...DEFAUT, tolerance: 30 })).toBe(true);
    expect(verifierMode2(c5, fausse25, { ...DEFAUT, tolerance: 20 })).toBe(false);
  });
});

describe('SuiviMode2', () => {
  const attaque = (t: number) => etat(t, { attaque: true, silence: false, niveauDbfs: -20 });
  const jouee = (t: number, note: string, latence = 200) => etat(t, { note, nouvelle: true, latence });
  const c5 = question(7, 5, 4); // C#3

  function suivi(q: Question = c5, precedente: Question | null = null): SuiviMode2 {
    const s = new SuiviMode2();
    s.poser(q, precedente);
    return s;
  }

  it('ne fait rien sans question posée', () => {
    expect(new SuiviMode2().traiter(jouee(0, 'C#3'), DEFAUT)).toBeNull();
  });

  it('compte la première note stable après une attaque et ignore les changements sans attaque', () => {
    const s = suivi();
    expect(s.traiter(attaque(0), DEFAUT)).toBeNull();
    expect(s.traiter(jouee(200, 'C#3', 180), DEFAUT)).toMatchObject({
      type: 'reponse',
      juste: true,
      latenceMs: 180,
      tempsMs: 200,
    });
    // Résonance de caisse, sans nouvelle attaque.
    expect(s.traiter(etat(900, { note: 'A#2', nouvelle: true, apresAttaque: false }), DEFAUT)).toBeNull();
  });

  it('compte chaque note fausse ; la question reste posée et le temps repart de la dernière réponse', () => {
    const s = suivi();
    s.traiter(attaque(0), DEFAUT);
    expect(s.traiter(jouee(300, 'D3'), DEFAUT)).toMatchObject({ type: 'reponse', juste: false, tempsMs: 300 });
    s.traiter(attaque(1000), DEFAUT);
    expect(s.traiter(jouee(1200, 'C#3'), DEFAUT)).toMatchObject({ type: 'reponse', juste: true, tempsMs: 900 });
  });

  it('ignore une fois la note de la question précédente, puis la compte comme erreur', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    const a = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0, e);
    expect([e.nom, a.nom]).toEqual(['E', 'A']);
    const s = suivi(a, e);
    s.traiter(attaque(0), DEFAUT);
    expect(s.traiter(jouee(200, 'E2'), DEFAUT)).toMatchObject({ type: 'ancienneNote' });
    s.traiter(attaque(500), DEFAUT);
    expect(s.traiter(jouee(700, 'E2'), DEFAUT)).toMatchObject({ type: 'reponse', juste: false });
  });

  it('n’ignore la note précédente que si c’est la première note jouée', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    const a = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0, e);
    const s = suivi(a, e);
    s.traiter(attaque(0), DEFAUT);
    expect(s.traiter(jouee(200, 'D3'), DEFAUT)).toMatchObject({ type: 'reponse', juste: false });
    s.traiter(attaque(500), DEFAUT);
    expect(s.traiter(jouee(700, 'E2'), DEFAUT)).toMatchObject({ type: 'reponse', juste: false });
  });

  it('signale une attaque sans note au bout de 1,5 s, une seule fois, sans réponse', () => {
    const s = suivi();
    const son = (t: number) => etat(t, { silence: false, niveauDbfs: -30 });
    s.traiter(attaque(0), DEFAUT);
    expect(s.traiter(son(DELAI_NON_DETECTION_MS - 1), DEFAUT)).toBeNull();
    expect(s.traiter(son(DELAI_NON_DETECTION_MS), DEFAUT)).toEqual({ type: 'nonReconnue' });
    expect(s.traiter(son(DELAI_NON_DETECTION_MS + 500), DEFAUT)).toBeNull();
  });

  it('signale un silence de plus de 3 s, remis à zéro par un son ou une nouvelle question', () => {
    const s = suivi();
    s.traiter(etat(0), DEFAUT);
    s.traiter(etat(DUREE_SILENCE_RAPPEL_MS), DEFAUT);
    expect(s.silenceProlonge(DUREE_SILENCE_RAPPEL_MS)).toBe(false);
    s.traiter(etat(DUREE_SILENCE_RAPPEL_MS + 1), DEFAUT);
    expect(s.silenceProlonge(DUREE_SILENCE_RAPPEL_MS + 1)).toBe(true);
    s.traiter(attaque(4000), DEFAUT);
    expect(s.silenceProlonge(4000)).toBe(false);
    s.traiter(etat(5000), DEFAUT);
    s.poser(c5);
    expect(s.silenceProlonge(9000)).toBe(false);
  });
});
