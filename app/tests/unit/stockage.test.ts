import { describe, expect, it } from 'vitest';
import { REGLAGES_DEFAUT, jeuInitial, progressionInitiale, type Progression } from '../../src/progression/modele';
import {
  CLE_ILLISIBLE,
  CLE_STOCKAGE,
  charger,
  exporterJson,
  importerJson,
  migrer,
  nomFichierExport,
  sauver,
  type Stockage,
} from '../../src/progression/stockage';
import { stockageMemoire } from './memoire';

const exemple = (): Progression => ({
  ...progressionInitiale(),
  avancement: { 2: { niveauAtteint: 3, dernieresReponses: [true, false, true] } },
  jeu: {
    niveau: 2,
    positions: [...jeuInitial().positions, { corde: 6, case: 1 }, { corde: 2, case: 1 }, { corde: 1, case: 1 }],
    record: { score: 4200, niveau: 3 },
  },
  statistiques: [
    {
      mode: 1,
      corde: 6,
      case: 3,
      tentatives: 4,
      reussites: 3,
      tempsMoyenMs: 1850,
      derniereDate: '2026-10-27T08:00:00.000Z',
    },
    {
      mode: 2,
      corde: 1,
      case: 12,
      tentatives: 1,
      reussites: 1,
      tempsMoyenMs: 2400,
      derniereDate: '2026-10-27T08:01:00.000Z',
    },
  ],
  reglages: { ...REGLAGES_DEFAUT, tolerance: 30, a4: 442, notation: 'francaise' },
});

describe('charger et sauver', () => {
  it('relit ce qui a été sauvé', () => {
    const s = stockageMemoire();
    expect(sauver(s, exemple())).toBe(true);
    expect(charger(s)).toEqual({ progression: exemple(), etat: 'ok' });
  });

  it('part d’une progression neuve si le stockage est vide', () => {
    expect(charger(stockageMemoire())).toEqual({ progression: progressionInitiale(), etat: 'vide' });
  });

  it('signale un stockage indisponible', () => {
    expect(charger(null)).toEqual({ progression: progressionInitiale(), etat: 'indisponible' });
    const bloque: Stockage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(charger(bloque).etat).toBe('indisponible');
    expect(sauver(null, exemple())).toBe(false);
  });

  it('garde une copie du contenu illisible et repart de zéro', () => {
    const s = stockageMemoire({ [CLE_STOCKAGE]: '{ pas du json' });
    expect(charger(s)).toEqual({ progression: progressionInitiale(), etat: 'corrompu' });
    expect(s.donnees[CLE_ILLISIBLE]).toBe('{ pas du json');
  });

  it('traite une version inconnue comme illisible', () => {
    const s = stockageMemoire({ [CLE_STOCKAGE]: JSON.stringify({ ...exemple(), version: 4 }) });
    expect(charger(s).etat).toBe('corrompu');
    expect(s.donnees[CLE_ILLISIBLE]).toBeDefined();
  });

  it('renvoie false si l’écriture échoue (stockage plein)', () => {
    const plein: Stockage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(sauver(plein, exemple())).toBe(false);
  });
});

describe('migrer', () => {
  it('complète les réglages manquants et borne A4', () => {
    const p = migrer({ version: 2, reglages: { tolerance: 20, a4: 500, octaveStricte: 'oui' } });
    expect(p?.reglages).toEqual({ ...REGLAGES_DEFAUT, tolerance: 20, a4: 450 });
    expect(p?.avancement).toEqual(progressionInitiale().avancement);
    expect(p?.statistiques).toEqual([]);
  });

  it('notation absente ou invalide : « les deux » ; une notation connue est gardée', () => {
    expect(migrer({ version: 2, reglages: {} })?.reglages.notation).toBe('les-deux');
    expect(migrer({ version: 2, reglages: { notation: 'allemande' } })?.reglages.notation).toBe('les-deux');
    expect(migrer({ version: 2, reglages: { notation: 'anglo-saxonne' } })?.reglages.notation).toBe('anglo-saxonne');
  });

  it('version 1 : le niveau commun devient le niveau atteint du mode 2, réglages et statistiques gardés', () => {
    const { statistiques, reglages } = exemple();
    const v1 = { version: 1, niveauActuel: 3, scoreParNiveau: {}, statistiques, reglages };
    expect(migrer(v1)).toEqual({
      version: 3,
      avancement: { 2: { niveauAtteint: 3, dernieresReponses: [] } },
      jeu: jeuInitial(),
      statistiques,
      reglages,
    });
    expect(migrer({ ...v1, niveauActuel: 9 })?.avancement[2].niveauAtteint).toBe(1);
  });

  it('version 2 : le jeu du mode 1 commence aux cordes à vide, le reste est gardé (export du 31/10/2026)', () => {
    // Extrait de l'export de l'utilisateur (app/resultats/) : niveau 4 au quiz du mode 1, afficherNotes retiré.
    const v2 = {
      version: 2,
      avancement: { 1: { niveauAtteint: 4, dernieresReponses: [] }, 2: { niveauAtteint: 1, dernieresReponses: [] } },
      statistiques: exemple().statistiques,
      reglages: { ...REGLAGES_DEFAUT, afficherNotes: false, afficherCaseMode2: true, seuilSilenceDb: -67.9 },
    };
    expect(migrer(v2)).toEqual({
      version: 3,
      avancement: { 2: { niveauAtteint: 1, dernieresReponses: [] } },
      jeu: jeuInitial(),
      statistiques: exemple().statistiques,
      reglages: { ...REGLAGES_DEFAUT, afficherCaseMode2: true, seuilSilenceDb: -67.9 },
    });
  });

  it('jeu invalide : cordes à vide, records gardés s’ils sont valides ; notes en double écartées', () => {
    const record = { score: 900, niveau: 4 };
    expect(migrer({ ...exemple(), jeu: { niveau: 0, positions: [], record } })?.jeu).toEqual(jeuInitial(record));
    expect(migrer({ ...exemple(), jeu: 'x' })?.jeu).toEqual(jeuInitial());
    expect(
      migrer({
        ...exemple(),
        jeu: {
          niveau: 3,
          positions: [
            { corde: 6, case: 0 },
            { corde: 6, case: 0 },
            { corde: 7, case: 0 },
            { corde: 5, case: 13 },
          ],
          record: { score: -5, niveau: 2 },
        },
      })?.jeu,
    ).toEqual({ niveau: 3, positions: [{ corde: 6, case: 0 }], record: { score: 0, niveau: 2 } });
  });

  it('écarte les statistiques et avancements invalides, et borne les dernières réponses', () => {
    const valide = exemple().statistiques[0]!;
    const p = migrer({
      ...exemple(),
      avancement: { 2: { niveauAtteint: 2, dernieresReponses: [...Array<boolean>(25).fill(true), 'x', false] } },
      statistiques: [valide, { ...valide, case: 13 }, { ...valide, corde: 0 }, { ...valide, reussites: 9 }, null, 'x'],
    });
    // Niveau 2 : 20 réponses regardées ; les valeurs qui ne sont pas des booléens sont écartées.
    expect(p?.avancement[2]).toEqual({
      niveauAtteint: 2,
      dernieresReponses: [...Array<boolean>(19).fill(true), false],
    });
    expect(p?.statistiques).toEqual([valide]);
    expect(
      migrer({ ...exemple(), avancement: { 2: { niveauAtteint: 9, dernieresReponses: [true] } } })?.avancement,
    ).toEqual({ 2: { niveauAtteint: 1, dernieresReponses: [] } });
    expect(
      migrer({ ...exemple(), avancement: { 2: { niveauAtteint: 7, dernieresReponses: [true] } } })?.avancement,
    ).toEqual({ 2: { niveauAtteint: 7, dernieresReponses: [] } });
  });

  it('refuse ce qui n’est pas une progression', () => {
    expect(migrer(null)).toBeNull();
    expect(migrer([])).toBeNull();
    expect(migrer({ niveauActuel: 2 })).toBeNull();
  });
});

describe('export et import JSON', () => {
  it('retrouve la progression exportée', () => {
    expect(importerJson(exporterJson(exemple()))).toEqual(exemple());
  });

  it('refuse un fichier qui n’est pas une progression', () => {
    expect(importerJson('bonjour')).toBeNull();
    expect(importerJson('{"version":1')).toBeNull();
    expect(importerJson('[]')).toBeNull();
  });

  it('nomme le fichier d’export avec la date du jour', () => {
    expect(nomFichierExport(new Date(2026, 9, 7, 23, 30))).toBe('fretmap-progression-2026-10-07.json');
  });
});
