import { describe, expect, it } from 'vitest';
import { REGLAGES_DEFAUT, progressionInitiale, type Progression } from '../../src/progression/modele';
import {
  CLE_ILLISIBLE,
  CLE_STOCKAGE,
  charger,
  exporterJson,
  importerJson,
  migrer,
  sauver,
  type Stockage,
} from '../../src/progression/stockage';
import { stockageMemoire } from './memoire';

const exemple = (): Progression => ({
  ...progressionInitiale(),
  niveauActuel: 3,
  scoreParNiveau: { 1: { questions: 20, reussites: 18 }, 2: { questions: 20, reussites: 17 } },
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
  reglages: { ...REGLAGES_DEFAUT, tolerance: 30, a4: 442, afficherNotes: true },
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
    const s = stockageMemoire({ [CLE_STOCKAGE]: JSON.stringify({ ...exemple(), version: 2 }) });
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
    const p = migrer({ version: 1, reglages: { tolerance: 20, a4: 500, octaveStricte: 'oui' } });
    expect(p?.reglages).toEqual({ ...REGLAGES_DEFAUT, tolerance: 20, a4: 450 });
    expect(p?.niveauActuel).toBe(1);
    expect(p?.statistiques).toEqual([]);
  });

  it('écarte les statistiques, scores et niveaux invalides', () => {
    const valide = exemple().statistiques[0]!;
    const p = migrer({
      ...exemple(),
      niveauActuel: 9,
      scoreParNiveau: {
        1: { questions: 5, reussites: 6 },
        3: { questions: 10, reussites: 7 },
        8: { questions: 1, reussites: 1 },
      },
      statistiques: [valide, { ...valide, case: 13 }, { ...valide, corde: 0 }, { ...valide, reussites: 9 }, null, 'x'],
    });
    expect(p?.niveauActuel).toBe(1);
    expect(p?.scoreParNiveau).toEqual({ 3: { questions: 10, reussites: 7 } });
    expect(p?.statistiques).toEqual([valide]);
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
});
