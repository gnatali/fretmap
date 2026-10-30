import { describe, expect, it } from 'vitest';
import {
  FORMAT_JOURNAL,
  MesureImages,
  exporterJournal,
  nomFichierJournal,
  quantile,
  type PartieJournal,
} from '../../src/jeu/journal';
import { CLE_JOURNAL, PARTIES_GARDEES, ajouterPartie, chargerJournal } from '../../src/jeu/stockage';
import type { Stockage } from '../../src/progression/stockage';
import { stockageMemoire } from './memoire';

const partie = (n: number) =>
  ({ debut: `2026-10-31T10:${String(n).padStart(2, '0')}:00.000Z`, essais: [] }) as unknown as PartieJournal;

describe('journal du mode 1', () => {
  it('mesure les images : médiane, 95e centile, part au-delà de 33 ms', () => {
    const mesure = new MesureImages();
    expect(mesure.resultat()).toEqual({ nombre: 0, medianeMs: null, p95Ms: null, partAuDelaDe33Ms: null });
    for (const d of [16, 17, 16, 50, Number.NaN, -1]) mesure.ajouter(d);
    expect(mesure.resultat()).toMatchObject({ nombre: 4, medianeMs: 16.5, partAuDelaDe33Ms: 0.25 });
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('exporte toutes les parties au format fretmap-mode1-journal', () => {
    const date = new Date(2026, 9, 31, 19, 5);
    const contenu = JSON.parse(exporterJournal([partie(1)], date)) as Record<string, unknown>;
    expect(contenu).toEqual({
      format: FORMAT_JOURNAL,
      version: 1,
      exporteLe: date.toISOString(),
      parties: [partie(1)],
    });
    expect(nomFichierJournal(date)).toBe('journal-mode1-20261031-1905.json');
  });

  it('garde les 20 dernières parties, et relit le journal enregistré', () => {
    const s = stockageMemoire();
    expect(chargerJournal(s)).toEqual([]);
    for (let n = 1; n <= PARTIES_GARDEES + 2; n++) expect(ajouterPartie(s, partie(n))).toBe(true);
    const parties = chargerJournal(s);
    expect(parties).toHaveLength(PARTIES_GARDEES);
    expect(parties[0]).toEqual(partie(3));
    expect(chargerJournal(stockageMemoire({ [CLE_JOURNAL]: '{ illisible' }))).toEqual([]);
    expect(chargerJournal(null)).toEqual([]);
  });

  it('stockage plein : retire les plus anciennes parties jusqu’à ce que l’écriture passe', () => {
    const s = stockageMemoire({ [CLE_JOURNAL]: JSON.stringify([partie(1), partie(2), partie(3)]) });
    const limite: Stockage = {
      getItem: s.getItem,
      setItem: (cle, valeur) => {
        if ((JSON.parse(valeur) as unknown[]).length > 2) throw new Error('QuotaExceededError');
        s.setItem(cle, valeur);
      },
    };
    expect(ajouterPartie(limite, partie(4))).toBe(true);
    expect(chargerJournal(s)).toEqual([partie(3), partie(4)]);
    expect(ajouterPartie(null, partie(5))).toBe(false);
  });
});
