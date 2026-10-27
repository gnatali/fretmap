import { describe, expect, it } from 'vitest';
import {
  FORMAT_JOURNAL,
  MesureImages,
  VERSION_JOURNAL,
  exporterJournal,
  nomFichierExport,
  quantile,
  type ContexteJournal,
} from '../../src/jeu/journal';
import { Partie } from '../../src/jeu/partie';

describe('quantile', () => {
  it('interpole entre les valeurs triées', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([7], 0.95)).toBe(7);
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantile([0, 10], 0.95)).toBeCloseTo(9.5);
  });
});

describe('MesureImages', () => {
  it('donne nombre, médiane, 95e centile et part des images lentes', () => {
    const mesure = new MesureImages();
    for (let i = 0; i < 19; i++) mesure.ajouter(16.7);
    mesure.ajouter(50);
    // 95e centile : entre la 19e valeur (16,7) et la 20e (50), à 5 % : 18,365.
    expect(mesure.resultat()).toEqual({ nombre: 20, medianeMs: 16.7, p95Ms: 18.4, partAuDelaDe33Ms: 0.05 });
  });

  it('ignore les durées invalides et renvoie null sans image', () => {
    const mesure = new MesureImages();
    mesure.ajouter(Number.NaN);
    mesure.ajouter(-3);
    expect(mesure.resultat()).toEqual({ nombre: 0, medianeMs: null, p95Ms: null, partAuDelaDe33Ms: null });
  });
});

describe('export', () => {
  const contexte: ContexteJournal = {
    navigateur: 'test',
    seuilSilenceDbfs: null,
    traitementsActifs: ['autoGainControl'],
    images: new MesureImages().resultat(),
  };

  it('écrit le format, la version, la date et les parties', () => {
    const partie = new Partie(
      { niveau: 3, dureeInitialeMs: 5000, vitesseFixe: false, afficherCase: true, notation: 'francaise' },
      [],
      { debutMs: 0, date: new Date('2026-10-28T19:00:00.000Z'), hasard: () => 0 },
    );
    partie.jouerSimule(true, 1200);
    const journal = partie.journal(contexte);
    const contenu = JSON.parse(exporterJournal([journal], new Date('2026-10-28T19:30:00.000Z')));
    expect(contenu).toEqual({
      format: FORMAT_JOURNAL,
      version: VERSION_JOURNAL,
      exporteLe: '2026-10-28T19:30:00.000Z',
      parties: [journal],
    });
    expect(contenu.parties[0].traitementsActifs).toEqual(['autoGainControl']);
  });

  it('nomme le fichier avec la date et l’heure locales', () => {
    expect(nomFichierExport(new Date(2026, 9, 28, 9, 5))).toBe('journal-poc-chute-20261028-0905.json');
    expect(nomFichierExport(new Date(2026, 0, 3, 21, 47))).toBe('journal-poc-chute-20260103-2147.json');
  });
});
