import { describe, expect, it } from 'vitest';
import {
  Campagne,
  DELAI_NON_DETECTION_MS,
  DUREE_ANNONCE_MS,
  OPTIONS_DEFAUT,
  construireProgramme,
  estimerDureeMinutes,
  type Etape,
  type Evenement,
  type OptionsCampagne,
} from '../src/journal/campagne';
import { DUREE_TEST_SILENCE_MS } from '../src/journal/essais';
import { midiVersFrequence, nomVersMidi } from '../src/music/notes';
import { etat } from './outils';

const options = (o: Partial<OptionsCampagne> = {}): OptionsCampagne => ({ ...OPTIONS_DEFAUT, graine: 42, ...o });
const notes = (programme: Etape[], scenario: string) =>
  programme.flatMap((e) => (e.type === 'note' && e.scenario === scenario ? [e.note] : []));
const frequence = (note: string) => midiVersFrequence(nomVersMidi(note)!);
const types = (evenements: Evenement[]) => evenements.map((e) => e.type);

describe('construireProgramme', () => {
  it('enchaîne préparation, calibrage, scénarios 1, 3, 5, 4 puis 2, et fin', () => {
    const p = construireProgramme(options());
    const resume = p
      .filter((e) => e.type !== 'note')
      .map((e) => `${e.type}:${'scenario' in e && e.scenario ? e.scenario.split('-')[0] : ''}`);
    expect(resume).toEqual(['pause:', 'calibrage:', 'annonce:1', 'annonce:3', 'annonce:5', 'pause:4', 'silence:4', 'pause:2', 'fin:']);
    expect(notes(p, '1-accordage-calme')).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(notes(p, '2-accordage-bruyant')).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(p.filter((e) => e.type === 'note' && e.scenario === '1-accordage-calme').every((e) => e.type === 'note' && e.repetitions === 10)).toBe(true);
  });

  it('scénario 3 : cases 1 à 5 des six cordes', () => {
    const s3 = construireProgramme(options()).filter((e) => e.type === 'note' && e.scenario === '3-frettes-1-5');
    expect(s3).toHaveLength(30);
    expect(s3[0]).toMatchObject({ note: 'F2', indication: 'Corde 6, case 1', repetitions: 3 });
    expect(s3[4]).toMatchObject({ note: 'A2', indication: 'Corde 6, case 5' });
    expect(s3[24]).toMatchObject({ note: 'E4', indication: 'Corde 2, case 5' });
    expect(s3[29]).toMatchObject({ note: 'A4', indication: 'Corde 1, case 5' });
    expect(s3[0]!.consigne).toMatch(/^Étouffez la corde précédente/);
    expect(s3[1]!.consigne).not.toMatch(/Étouffez/);
  });

  it('scénario 5 : positions au hasard (corde et case), note cachée, tirage reproductible', () => {
    const s5 = (graine: number) =>
      construireProgramme(options({ graine })).filter(
        (e): e is Extract<Etape, { type: 'note' }> => e.type === 'note' && e.scenario === '5-jeu-naturel',
      );
    const a = s5(42);
    expect(a).toHaveLength(20);
    expect(a.map((e) => e.note)).toEqual(s5(42).map((e) => e.note));
    expect(a.map((e) => e.note)).not.toEqual(s5(7).map((e) => e.note));
    const ouvertes: Record<string, number> = { '6': 40, '5': 45, '4': 50, '3': 55, '2': 59, '1': 64 };
    for (const [i, e] of a.entries()) {
      const corde = /^Corde ([1-6])$/.exec(e.indication)?.[1];
      const numeroCase = e.enGrand === 'À vide' ? 0 : Number(/^Case ([1-5])$/.exec(e.enGrand)?.[1]);
      expect(corde, e.indication).toBeDefined();
      expect(Number.isInteger(numeroCase), e.enGrand).toBe(true);
      expect(nomVersMidi(e.note)).toBe(ouvertes[corde!]! + numeroCase);
      expect(e.enGrand).not.toBe(e.note);
      if (i > 0) expect(e.note).not.toBe(a[i - 1]!.note);
    }
  });

  it('scénarios 1 et 3 : la note est affichée en grand', () => {
    const p = construireProgramme(options());
    for (const e of p) if (e.type === 'note' && e.scenario !== '5-jeu-naturel') expect(e.enGrand).toBe(e.note);
  });

  it('ne garde que les scénarios choisis', () => {
    const p = construireProgramme(options({ scenarios: [4] }));
    expect(p.map((e) => e.type)).toEqual(['pause', 'calibrage', 'pause', 'silence', 'fin']);
  });

  it('estime la durée', () => {
    expect(estimerDureeMinutes(construireProgramme(options()))).toBeGreaterThan(5);
    expect(estimerDureeMinutes(construireProgramme(options({ scenarios: [4] })))).toBe(1);
  });
});

describe('Campagne', () => {
  /** Campagne réduite au scénario 1 avec 2 attaques par corde, menée jusqu'à la première note (E2). */
  function campagneS1(scenarios: OptionsCampagne['scenarios'] = [1]) {
    const c = new Campagne(construireProgramme(options({ scenarios, repetitionsCordes: 2 })));
    expect(types(c.demarrer(0))).toEqual(['etape']);
    expect(c.etape?.type).toBe('pause');
    expect(c.contexte()).toBeNull();
    expect(types(c.traiter(etat(5000)))).toEqual([]);
    expect(types(c.continuer(5000))).toEqual(['etape', 'calibrer']);
    expect(types(c.continuer(5100))).toEqual([]);
    expect(types(c.calibrageTermine(7000))).toEqual(['etape']);
    expect(c.etape?.type).toBe('annonce');
    expect(c.resteMs(8000)).toBe(DUREE_ANNONCE_MS - 1000);
    expect(types(c.traiter(etat(7000 + DUREE_ANNONCE_MS)))).toEqual(['etape']);
    return c;
  }

  it('attend Continuer sur les pauses, puis passe seul le calibrage et l’annonce', () => {
    const c = campagneS1();
    expect(c.etape).toMatchObject({ type: 'note', note: 'E2' });
    expect(c.contexte()).toEqual({ scenario: '1-accordage-calme', noteAttendue: 'E2' });
  });

  it('compte une répétition par note jouée, ignore les changements sans attaque, puis passe à la corde suivante', () => {
    const c = campagneS1();
    const e2 = frequence('E2');
    c.traiter(etat(20_000, { attaque: true, silence: false }));
    const r1 = c.traiter(etat(20_200, { frequence: e2, nouvelle: true, latence: 200 }));
    expect(r1[0]).toMatchObject({ type: 'resultat', attendue: 'E2', detectee: 'E2', juste: true, latenceMs: 200 });
    expect(c.repetitionsFaites).toBe(1);
    // Saut d'octave pendant la résonance : pas d'attaque, pas compté.
    expect(c.traiter(etat(20_800, { frequence: e2 * 2, nouvelle: true }))).toEqual([]);
    expect(c.repetitionsFaites).toBe(1);
    c.traiter(etat(22_000, { attaque: true, silence: false }));
    const r2 = c.traiter(etat(22_200, { frequence: frequence('F2'), nouvelle: true, latence: 200 }));
    expect(r2[0]).toMatchObject({ type: 'resultat', detectee: 'F2', juste: false, cents: null });
    expect(r2[1]).toMatchObject({ type: 'etape' });
    expect(c.etape).toMatchObject({ type: 'note', note: 'A2' });
    expect(c.progression().part).toBeCloseTo(2 / 12, 5);
  });

  it('ignore une fois la note précédente encore sonore au début d’une étape, puis la compte comme erreur', () => {
    const c = campagneS1();
    const joue = (t: number, note: string) => {
      c.traiter(etat(t, { attaque: true, silence: false }));
      return c.traiter(etat(t + 200, { frequence: frequence(note), nouvelle: true, latence: 200 }));
    };
    joue(20_000, 'E2');
    joue(22_000, 'E2');
    expect(c.etape).toMatchObject({ note: 'A2' });
    expect(joue(24_000, 'E2')).toEqual([{ type: 'ancienneNote', attendue: 'A2', detectee: 'E2' }]);
    expect(c.repetitionsFaites).toBe(0);
    expect(joue(26_000, 'E2')[0]).toMatchObject({ type: 'resultat', juste: false, detectee: 'E2' });
    expect(joue(28_000, 'A2')[0]).toMatchObject({ type: 'resultat', juste: true });
    expect(c.etape).toMatchObject({ note: 'D3' });
    expect(joue(30_000, 'A2')[0]).toMatchObject({ type: 'ancienneNote' });
  });

  it('ne considère pas comme encore sonore une note séparée par une pause', () => {
    const c = new Campagne(construireProgramme(options({ scenarios: [1, 2], repetitionsCordes: 1 })));
    c.demarrer(0);
    c.continuer(0);
    c.calibrageTermine(2000);
    while (c.etape?.type !== 'pause') c.passer(3000);
    c.continuer(3000);
    expect(c.etape).toMatchObject({ scenario: '2-accordage-bruyant', note: 'E2' });
    c.traiter(etat(4000, { attaque: true, silence: false }));
    const r = c.traiter(etat(4200, { frequence: frequence('E4'), nouvelle: true, latence: 200 }));
    expect(r[0]).toMatchObject({ type: 'resultat', juste: false, detectee: 'E4' });
  });

  it('compte une attaque sans note comme non détectée en scénario 1', () => {
    const c = campagneS1();
    c.traiter(etat(20_000, { attaque: true, silence: false }));
    expect(c.traiter(etat(20_000 + DELAI_NON_DETECTION_MS - 20, { silence: false }))).toEqual([]);
    const r = c.traiter(etat(20_000 + DELAI_NON_DETECTION_MS, { silence: false }));
    expect(r[0]).toEqual({ type: 'nonDetectee', note: { scenario: '1-accordage-calme', noteAttendue: 'E2' }, comptee: true });
    expect(c.repetitionsFaites).toBe(1);
  });

  it('en scénario 2, signale la non-détection sans la compter', () => {
    const c = new Campagne(construireProgramme(options({ scenarios: [2], repetitionsCordes: 2 })));
    c.demarrer(0);
    c.continuer(0);
    c.calibrageTermine(2000);
    expect(c.etape?.type).toBe('pause');
    c.continuer(3000);
    expect(c.contexte()).toEqual({ scenario: '2-accordage-bruyant', noteAttendue: 'E2' });
    c.traiter(etat(4000, { attaque: true, silence: false }));
    const r = c.traiter(etat(4000 + DELAI_NON_DETECTION_MS, { silence: false }));
    expect(r).toEqual([{ type: 'nonDetectee', note: { scenario: '2-accordage-bruyant', noteAttendue: 'E2' }, comptee: false }]);
    expect(c.repetitionsFaites).toBe(0);
  });

  it('test de silence : compte les notes pendant 30 s puis enchaîne', () => {
    const c = new Campagne(construireProgramme(options({ scenarios: [4] })));
    c.demarrer(0);
    c.continuer(0);
    c.calibrageTermine(2000);
    c.continuer(3000);
    expect(c.etape?.type).toBe('silence');
    expect(c.contexte()).toEqual({ scenario: '4-silence', noteAttendue: '' });
    c.traiter(etat(10_000, { frequence: 220, nouvelle: true }));
    expect(c.resteMs(13_000)).toBe(DUREE_TEST_SILENCE_MS - 10_000);
    const r = c.traiter(etat(3000 + DUREE_TEST_SILENCE_MS));
    expect(types(r)).toEqual(['silenceTermine', 'etape', 'fin']);
    expect(r[0]).toEqual({ type: 'silenceTermine', notes: ['A3'] });
    expect(c.terminee).toBe(true);
    expect(c.progression().part).toBe(1);
  });

  it('passer, reprendre et fin', () => {
    const c = campagneS1();
    c.traiter(etat(20_000, { attaque: true, silence: false }));
    c.traiter(etat(20_200, { frequence: frequence('E2'), nouvelle: true, latence: 200 }));
    expect(types(c.reprendreEtape(21_000))).toEqual(['etape']);
    expect(c.repetitionsFaites).toBe(0);
    for (let i = 0; i < 5; i++) c.passer(21_000);
    expect(c.etape).toMatchObject({ type: 'note', note: 'E4' });
    expect(types(c.passer(21_000))).toEqual(['etape', 'fin']);
    expect(c.passer(21_000)).toEqual([]);
    const reprise = new Campagne(c.programme);
    reprise.demarrer(0, 4);
    expect(reprise.etape).toMatchObject({ type: 'note', note: 'A2' });
  });
});
