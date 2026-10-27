import { describe, expect, it } from 'vitest';
import { progressionInitiale } from '../../src/progression/modele';
import { enregistrerReponse, poidsDuMode, poidsPosition, type Reponse } from '../../src/progression/statistiques';

const reponse = (r: Partial<Reponse> = {}): Reponse => ({
  mode: 1,
  position: { corde: 6, case: 3 },
  juste: true,
  tempsMs: 2000,
  date: new Date('2026-10-27T08:00:00Z'),
  ...r,
});

describe('enregistrerReponse', () => {
  it('crée la statistique au premier essai', () => {
    const p = enregistrerReponse(progressionInitiale(), reponse());
    expect(p.statistiques).toEqual([
      {
        mode: 1,
        corde: 6,
        case: 3,
        tentatives: 1,
        reussites: 1,
        tempsMoyenMs: 2000,
        derniereDate: '2026-10-27T08:00:00.000Z',
      },
    ]);
  });

  it('cumule les essais et fait la moyenne des temps', () => {
    let p = enregistrerReponse(progressionInitiale(), reponse({ tempsMs: 1000 }));
    p = enregistrerReponse(p, reponse({ juste: false, tempsMs: 4000 }));
    p = enregistrerReponse(p, reponse({ tempsMs: 1000, date: new Date('2026-10-27T09:00:00Z') }));
    expect(p.statistiques).toHaveLength(1);
    expect(p.statistiques[0]).toMatchObject({
      tentatives: 3,
      reussites: 2,
      tempsMoyenMs: 2000,
      derniereDate: '2026-10-27T09:00:00.000Z',
    });
  });

  it('sépare les modes et les positions', () => {
    let p = enregistrerReponse(progressionInitiale(), reponse());
    p = enregistrerReponse(p, reponse({ mode: 2 }));
    p = enregistrerReponse(p, reponse({ position: { corde: 6, case: 4 } }));
    expect(p.statistiques.map((s) => `${s.mode}:${s.corde}:${s.case}`)).toEqual(['1:6:3', '2:6:3', '1:6:4']);
  });

  it('ne modifie pas la progression d’origine', () => {
    const origine = enregistrerReponse(progressionInitiale(), reponse());
    const copie = structuredClone(origine);
    enregistrerReponse(origine, reponse({ juste: false }));
    expect(origine).toEqual(copie);
  });
});

describe('poids du tirage', () => {
  it('jamais jouée : 2,5 ; toujours réussie : vers 1 ; toujours manquée : vers 4', () => {
    expect(poidsPosition()).toBe(2.5);
    expect(poidsPosition({ tentatives: 10, reussites: 10 })).toBe(1.25);
    expect(poidsPosition({ tentatives: 10, reussites: 0 })).toBe(3.75);
    expect(poidsPosition({ tentatives: 2, reussites: 1 })).toBe(2.5);
  });

  it('se calcule par mode, à partir des statistiques de ce mode', () => {
    let p = progressionInitiale();
    for (let i = 0; i < 10; i++) p = enregistrerReponse(p, reponse({ juste: true }));
    p = enregistrerReponse(p, reponse({ mode: 2, juste: false }));
    const position = { corde: 6, case: 3 } as const;
    expect(poidsDuMode(p.statistiques, 1)(position)).toBeCloseTo(1 + 3 / 12);
    expect(poidsDuMode(p.statistiques, 2)(position)).toBeCloseTo(1 + 3 * (2 / 3));
    expect(poidsDuMode(p.statistiques, 1)({ corde: 1, case: 0 })).toBe(2.5);
  });
});
