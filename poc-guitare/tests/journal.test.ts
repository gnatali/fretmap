import { describe, expect, it } from 'vitest';
import {
  CLE_JOURNAL,
  SuiviMesure,
  TestSilence,
  chargerEssais,
  creerEssai,
  creerEssaiNonDetecte,
  creerEssaiSilence,
  prochainId,
  resumer,
  sauverEssais,
  versCsv,
  versJson,
  type Essai,
  type Mesure,
} from '../src/journal/essais';
import { etat } from './outils';


const contexte = { id: 1, guitare: 'acoustique', materiel: 'micro intégré', a4: 440, date: new Date('2026-10-24T08:00:00Z') };

describe('SuiviMesure', () => {
  it('découpe une note de sa détection stable au silence, avec la médiane des fréquences', () => {
    const s = new SuiviMesure();
    expect(s.traiter(etat(0, { attaque: true, silence: false }))).toBeNull();
    expect(s.traiter(etat(100, { frequence: 83.5, nouvelle: true, latence: 180 }))).toBeNull();
    s.traiter(etat(120, { frequence: 82.6 }));
    s.traiter(etat(140, { frequence: 82.5 }));
    expect(s.enCours()?.frequence).toBe(82.6);
    const mesure = s.traiter(etat(400));
    expect(mesure).toMatchObject({ numero: 1, note: 'E2', frequence: 82.6, latenceMs: 180, apresAttaque: true });
    expect(s.enCours()).toBeNull();
  });

  it('termine la note précédente à une nouvelle attaque ou à une nouvelle note stable', () => {
    const s = new SuiviMesure();
    s.traiter(etat(0, { frequence: 110, nouvelle: true, latence: 150 }));
    expect(s.traiter(etat(200, { attaque: true, silence: false }))?.note).toBe('A2');
    s.traiter(etat(300, { frequence: 146.8, nouvelle: true }));
    const terminee = s.traiter(etat(320, { frequence: 196, nouvelle: true }));
    expect(terminee?.note).toBe('D3');
    expect(s.enCours()).toMatchObject({ note: 'G3', apresAttaque: false });
  });

  it('fige le scénario et la note attendue au début de la note, même s’ils changent avant la fin', () => {
    const s = new SuiviMesure();
    const a2 = { scenario: '1-accordage-calme', noteAttendue: 'A2' };
    const d3 = { scenario: '3-frettes-1-5', noteAttendue: 'D3' };
    s.traiter(etat(0, { frequence: 110, nouvelle: true, latence: 150 }), a2);
    s.traiter(etat(100, { frequence: 110 }), d3);
    expect(s.traiter(etat(200, { attaque: true, silence: false }), d3)).toMatchObject(a2);
    s.traiter(etat(350, { frequence: 146.8, nouvelle: true, latence: 150 }), d3);
    expect(s.terminer()).toMatchObject(d3);
  });
});

describe('TestSilence', () => {
  it('compte les nouvelles notes stables pendant 30 s', () => {
    const t = new TestSilence(1000);
    expect(t.traiter(etat(2000))).toBe(false);
    expect(t.traiter(etat(5000, { frequence: 60.5, nouvelle: true }))).toBe(false);
    expect(t.traiter(etat(5020, { frequence: 60.5 }))).toBe(false);
    expect(t.traiter(etat(9000, { frequence: 220, nouvelle: true }))).toBe(false);
    expect(t.resteMs(11_000)).toBe(20_000);
    expect(t.traiter(etat(31_000))).toBe(true);
    expect(t.notesParasites).toEqual(['B1', 'A3']);
  });
});

describe('creerEssai', () => {
  const mesure: Mesure = { scenario: '1-accordage-calme', numero: 1, note: 'E2', midi: 40, frequence: 82.6, latenceMs: 180.4, apresAttaque: true, noteAttendue: 'E2' };

  it('calcule fréquence théorique, écart et latence par rapport à la note attendue', () => {
    const e = creerEssai(contexte, mesure);
    expect(e).toMatchObject({
      note_attendue: 'E2',
      note_detectee: 'E2',
      freq_mesuree_hz: 82.6,
      freq_theorique_hz: 82.41,
      ecart_cents: 4.1,
      latence_ms: 180,
      attaque: true,
      octave_erronee: false,
      faux_positifs: null,
      date: '2026-10-24T08:00:00.000Z',
    });
  });

  it('détecte une erreur d’octave', () => {
    const e = creerEssai(contexte, { ...mesure, noteAttendue: 'E3' });
    expect(e.octave_erronee).toBe(true);
    expect(e.ecart_cents).toBeCloseTo(-1196, 0);
    expect(creerEssai(contexte, { ...mesure, noteAttendue: 'F2' }).octave_erronee).toBe(false);
  });

  it('normalise les bémols et tient compte de A4', () => {
    const e = creerEssai({ ...contexte, a4: 432 }, { ...mesure, note: 'A#2', midi: 46, frequence: 114.4, noteAttendue: 'bb2' });
    expect(e.note_attendue).toBe('A#2');
    expect(e.freq_theorique_hz).toBeCloseTo(114.42, 2);
  });

  it('laisse les champs de comparaison vides sans note attendue', () => {
    const e = creerEssai(contexte, { ...mesure, noteAttendue: '' });
    expect(e.freq_theorique_hz).toBeNull();
    expect(e.ecart_cents).toBeNull();
    expect(e.octave_erronee).toBeNull();
  });
});

describe('creerEssaiSilence', () => {
  it('enregistre le nombre et la liste des fausses détections', () => {
    const e = creerEssaiSilence({ ...contexte }, ['B1', 'A3']);
    expect(e).toMatchObject({ note_attendue: 'silence', faux_positifs: 2, notes_parasites: 'B1 A3', latence_ms: null, attaque: null });
  });
});

describe('export', () => {
  const essais: Essai[] = [
    creerEssai({ ...contexte, materiel: 'casque, micro "USB"' }, { scenario: '1-accordage-calme', numero: 1, note: 'E2', midi: 40, frequence: 82.6, latenceMs: 180, apresAttaque: true, noteAttendue: 'E2' }),
    creerEssaiSilence({ ...contexte, id: 2 }, []),
  ];

  it('produit un CSV avec en-tête, échappement et valeurs vides', () => {
    const lignes = versCsv(essais).trimEnd().split('\r\n');
    expect(lignes[0]).toBe(
      'id,scenario,guitare,materiel,note_attendue,note_detectee,freq_mesuree_hz,freq_theorique_hz,ecart_cents,latence_ms,attaque,octave_erronee,faux_positifs,notes_parasites,date',
    );
    expect(lignes[1]).toBe('1,1-accordage-calme,acoustique,"casque, micro ""USB""",E2,E2,82.6,82.41,4.1,180,true,false,,,2026-10-24T08:00:00.000Z');
    expect(lignes[2]).toBe('2,4-silence,acoustique,micro intégré,silence,,,,,,,,0,,2026-10-24T08:00:00.000Z');
  });

  it('produit un JSON relisible', () => {
    expect(JSON.parse(versJson(essais))).toEqual(essais);
  });

  it('calcule le prochain identifiant', () => {
    expect(prochainId([])).toBe(1);
    expect(prochainId(essais)).toBe(3);
  });
});

describe('stockage', () => {
  function stockageMemoire(initial?: string) {
    const donnees = new Map<string, string>(initial ? [[CLE_JOURNAL, initial]] : []);
    return { getItem: (k: string) => donnees.get(k) ?? null, setItem: (k: string, v: string) => void donnees.set(k, v) };
  }

  it('sauve puis recharge le journal', () => {
    const s = stockageMemoire();
    const essai = creerEssaiSilence({ ...contexte }, ['A3']);
    expect(sauverEssais(s, [essai])).toBe(true);
    expect(chargerEssais(s)).toEqual([essai]);
  });

  it('résiste à un stockage absent, illisible ou qui refuse l’écriture', () => {
    expect(chargerEssais(null)).toEqual([]);
    expect(chargerEssais(stockageMemoire('{pas du json'))).toEqual([]);
    expect(chargerEssais(stockageMemoire('[{"id":"x"}]'))).toEqual([]);
    const plein = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(sauverEssais(plein, [])).toBe(false);
    expect(sauverEssais(null, [])).toBe(false);
  });
});

describe('stockage d’un journal ancien', () => {
  it('déduit le champ attaque de la latence pour les essais enregistrés avant son ajout', () => {
    const ancien = [
      { id: 1, scenario: '1-accordage-calme', note_attendue: 'E2', note_detectee: 'E2', latence_ms: 200, faux_positifs: null, date: 'x' },
      { id: 2, scenario: '1-accordage-calme', note_attendue: 'E2', note_detectee: 'E3', latence_ms: null, faux_positifs: null, date: 'x' },
      { id: 3, scenario: '4-silence', note_attendue: 'silence', note_detectee: '', latence_ms: null, faux_positifs: 0, date: 'x' },
    ];
    const s = { getItem: () => JSON.stringify(ancien), setItem: () => undefined };
    expect(chargerEssais(s).map((e) => e.attaque)).toEqual([true, false, null]);
  });
});

describe('resumer', () => {
  it('calcule les taux sur les notes jouées et compte à part les changements sans attaque', () => {
    const m = { scenario: '1-accordage-calme', midi: 40, noteAttendue: 'E2', apresAttaque: true };
    const essais = [
      creerEssai({ ...contexte, id: 1 }, { ...m, numero: 1, note: 'E2', frequence: 82.6, latenceMs: 180 }),
      creerEssai({ ...contexte, id: 2 }, { ...m, numero: 2, note: 'E2', frequence: 82.2, latenceMs: 350 }),
      creerEssai({ ...contexte, id: 3 }, { ...m, numero: 3, note: 'E3', midi: 52, frequence: 164.8, latenceMs: 200 }),
      creerEssai({ ...contexte, id: 4 }, { ...m, numero: 4, note: 'E3', midi: 52, frequence: 164.8, latenceMs: null, apresAttaque: false }),
      creerEssaiSilence({ ...contexte, id: 5 }, ['A3']),
      creerEssaiSilence({ ...contexte, id: 6 }, []),
    ];
    const [s1, s4] = resumer(essais);
    expect(s1).toMatchObject({
      scenario: '1-accordage-calme',
      essais: 4,
      attaquesEvaluees: 3,
      bonnesNotes: 2,
      latenceMedianeMs: 200,
      octavesErronees: 1,
      changementsSansAttaque: 1,
      fauxPositifs: null,
    });
    expect(s1!.ecartMoyenAbsCents).toBe(4.3);
    expect(s1!.partLatenceOk).toBeCloseTo(2 / 3, 5);
    expect(s4).toMatchObject({ scenario: '4-silence', essais: 2, attaquesEvaluees: 0, changementsSansAttaque: 0, fauxPositifs: 1 });
  });
});

describe('attaques non détectées', () => {
  it('creerEssaiNonDetecte enregistre une attaque sans note', () => {
    const e = creerEssaiNonDetecte(contexte, { scenario: '1-accordage-calme', noteAttendue: 'bb2' });
    expect(e).toMatchObject({ note_attendue: 'A#2', note_detectee: '', attaque: true, latence_ms: null, ecart_cents: null });
  });

  it('comptent comme erreurs, sauf dans le scénario bruyant', () => {
    const juste = (scenario: string, id: number) =>
      creerEssai({ ...contexte, id }, { scenario, numero: id, note: 'E2', midi: 40, frequence: 82.4, latenceMs: 200, apresAttaque: true, noteAttendue: 'E2' });
    const rate = (scenario: string, id: number) => creerEssaiNonDetecte({ ...contexte, id }, { scenario, noteAttendue: 'E2' });
    const [s1, s2] = resumer([
      juste('1-accordage-calme', 1),
      rate('1-accordage-calme', 2),
      juste('2-accordage-bruyant', 3),
      rate('2-accordage-bruyant', 4),
    ]);
    expect(s1).toMatchObject({ attaquesEvaluees: 2, bonnesNotes: 1, nonDetectees: 1 });
    expect(s2).toMatchObject({ attaquesEvaluees: 1, bonnesNotes: 1, nonDetectees: 1 });
  });
});
