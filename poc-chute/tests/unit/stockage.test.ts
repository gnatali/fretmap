import { describe, expect, it } from 'vitest';
import type { PartieJournal } from '../../src/jeu/journal';
import { MesureImages } from '../../src/jeu/journal';
import { Partie } from '../../src/jeu/partie';
import {
  CLE_ILLISIBLE,
  CLE_STOCKAGE,
  PARTIES_GARDEES,
  REGLAGES_DEPART_DEFAUT,
  ajouterPartie,
  charger,
  donneesInitiales,
  enregistrer,
  viderJournal,
  type DonneesPoc,
} from '../../src/jeu/stockage';
import { PartieProgressive } from '../../src/jeu/progressif/partie-progressive';
import { REGLAGES_PROGRESSIF_DEFAUT } from '../../src/jeu/progressif/reglages';
import type { Statistique } from '../../src/progression/modele';
import { stockageMemoire } from './memoire';

const statistique: Statistique = {
  mode: 2,
  corde: 5,
  case: 3,
  tentatives: 4,
  reussites: 3,
  tempsMoyenMs: 1800,
  derniereDate: '2026-10-28T19:00:00.000Z',
};

/** Journal d'une partie d'une note, commencée à la minute donnée. */
function partieJournal(minute: number): PartieJournal {
  const partie = new Partie(REGLAGES_DEPART_DEFAUT, [], {
    debutMs: 0,
    date: new Date(Date.UTC(2026, 9, 28, 19, minute)),
    hasard: () => 0,
  });
  partie.jouerSimule(true, 900);
  return partie.journal({
    navigateur: 'test',
    seuilSilenceDbfs: -48,
    traitementsActifs: [],
    images: new MesureImages().resultat(),
    pauses: [],
  });
}

describe('chargement', () => {
  it('valeurs par défaut sans stockage ou sans données', () => {
    expect(charger(null)).toEqual(donneesInitiales());
    expect(charger(stockageMemoire())).toEqual(donneesInitiales());
    expect(donneesInitiales()).toMatchObject({
      version: 1,
      reglages: {
        niveau: 1,
        dureeInitialeMs: 6000,
        vitesseFixe: false,
        afficherCase: false,
        notation: 'les-deux',
        fausseNote: 'penalite',
      },
      seuilSilenceDbfs: null,
      statistiques: [],
      parties: [],
    });
  });

  it('relit ce qui a été enregistré', () => {
    const stockage = stockageMemoire();
    const donnees: DonneesPoc = {
      ...donneesInitiales(),
      reglages: {
        niveau: 5,
        dureeInitialeMs: 4500,
        vitesseFixe: true,
        afficherCase: true,
        notation: 'francaise',
        fausseNote: 'destruction',
      },
      seuilSilenceDbfs: -51.5,
      statistiques: [statistique],
      parties: [partieJournal(0)],
    };
    expect(enregistrer(stockage, donnees)).toBe(true);
    expect(charger(stockage)).toEqual(donnees);
  });

  it('copie un contenu illisible avant de repartir des valeurs par défaut', () => {
    const casse = stockageMemoire({ [CLE_STOCKAGE]: '{pas du json' });
    expect(charger(casse)).toEqual(donneesInitiales());
    expect(casse.donnees[CLE_ILLISIBLE]).toBe('{pas du json');

    const autreVersion = JSON.stringify({ version: 2, parties: [] });
    const futur = stockageMemoire({ [CLE_STOCKAGE]: autreVersion });
    expect(charger(futur)).toEqual(donneesInitiales());
    expect(futur.donnees[CLE_ILLISIBLE]).toBe(autreVersion);
  });

  it('ramène les réglages invalides aux valeurs par défaut ou aux bornes', () => {
    const stockage = stockageMemoire({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        reglages: { niveau: 9, dureeInitialeMs: 60000, vitesseFixe: 'oui', notation: 'latine', fausseNote: 'rien' },
        seuilSilenceDbfs: 'fort',
      }),
    });
    expect(charger(stockage)).toEqual({
      ...donneesInitiales(),
      reglages: { ...REGLAGES_DEPART_DEFAUT, dureeInitialeMs: 10000 },
    });
  });

  it('normalise le mode de jeu, les réglages du mode progressif et la progression', () => {
    const stockage = stockageMemoire({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        modeJeu: 'arcade',
        reglagesProgressif: {
          methodeNote: 'temps',
          methodeGlobale: 'autre',
          seuilNote: 0.62,
          dureeChuteMinMs: 99999,
          // Réglage retiré en version 2.1 (remplacé par le plafond de vitesse) : ignoré.
          vitesseRequise: 0.4,
          vitesseParNiveau: 0.12,
          notesAjoutees: 'trois',
        },
        progressif: {
          niveau: 3,
          positions: [
            { corde: 6, case: 0 },
            { corde: 6, case: 0 },
            { corde: 7, case: 0 },
            { corde: 6, case: 1 },
          ],
        },
      }),
    });
    const donnees = charger(stockage);
    expect(donnees.modeJeu).toBe('progressif');
    expect(donnees.reglagesProgressif).toEqual({
      ...REGLAGES_PROGRESSIF_DEFAUT,
      methodeNote: 'temps',
      seuilNote: 0.6,
      dureeChuteMinMs: 10000,
      vitesseParNiveau: 0.1,
    });
    expect(donnees.progressif).toEqual({
      niveau: 3,
      positions: [
        { corde: 6, case: 0 },
        { corde: 6, case: 1 },
      ],
    });
    for (const progressif of [{ niveau: 0, positions: [{ corde: 6, case: 0 }] }, { niveau: 2, positions: [] }, 'non']) {
      const autre = stockageMemoire({ [CLE_STOCKAGE]: JSON.stringify({ version: 1, progressif }) });
      expect(charger(autre).progressif).toBeNull();
    }
  });

  it('relit une partie du mode progressif dans le journal', () => {
    const partie = new PartieProgressive(REGLAGES_PROGRESSIF_DEFAUT, {
      debutMs: 0,
      date: new Date('2026-10-30T19:00:00.000Z'),
      hasard: () => 0,
      notation: 'les-deux',
      afficherCase: false,
    });
    partie.jouerSimule(true, 800);
    const journal = partie.journal({
      navigateur: 'test',
      seuilSilenceDbfs: null,
      traitementsActifs: [],
      images: new MesureImages().resultat(),
      pauses: [],
    });
    const stockage = stockageMemoire();
    const donnees: DonneesPoc = {
      ...donneesInitiales(),
      modeJeu: 'classique',
      progressif: { niveau: 1, positions: [{ corde: 6, case: 0 }] },
      parties: [partieJournal(0), journal],
    };
    enregistrer(stockage, donnees);
    expect(charger(stockage)).toEqual(donnees);
  });

  it('écarte les statistiques et les parties invalides', () => {
    const stockage = stockageMemoire({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        statistiques: [
          statistique,
          { ...statistique, mode: 1 },
          { ...statistique, reussites: 9 },
          { ...statistique, case: 13 },
          'texte',
        ],
        parties: [partieJournal(1), { debut: 3 }, null],
      }),
    });
    const donnees = charger(stockage);
    expect(donnees.statistiques).toEqual([statistique]);
    expect(donnees.parties).toHaveLength(1);
  });
});

describe('journal des parties', () => {
  it(`garde les ${PARTIES_GARDEES} dernières parties`, () => {
    let donnees = donneesInitiales();
    for (let minute = 0; minute < PARTIES_GARDEES + 5; minute++)
      donnees = ajouterPartie(donnees, partieJournal(minute));
    expect(donnees.parties).toHaveLength(PARTIES_GARDEES);
    expect(donnees.parties[0]!.debut).toBe('2026-10-28T19:05:00.000Z');
    expect(donnees.parties.at(-1)!.debut).toBe('2026-10-28T19:54:00.000Z');
  });

  it('vider le journal garde les réglages et les statistiques', () => {
    const donnees: DonneesPoc = { ...donneesInitiales(), statistiques: [statistique], parties: [partieJournal(0)] };
    expect(viderJournal(donnees)).toEqual({ ...donnees, parties: [] });
  });

  it('signale un enregistrement impossible', () => {
    expect(enregistrer(null, donneesInitiales())).toBe(false);
    const plein = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(enregistrer(plein, donneesInitiales())).toBe(false);
  });
});
