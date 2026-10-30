import { describe, expect, it } from 'vitest';
import type { ContexteJournal } from '../../src/jeu/journal';
import {
  FAUSSES_AVANT_RAPPEL,
  NOTES_PAR_PARTIE,
  Partie,
  type EvenementPartie,
  type ReglagesPartie,
} from '../../src/jeu/partie';
import type { Statistique } from '../../src/progression/modele';
import { etat } from './detection';

const DEBUT = 10_000;
const DATE = new Date('2026-10-28T19:00:00.000Z');
const REGLAGES: ReglagesPartie = {
  niveau: 2,
  dureeInitialeMs: 6000,
  vitesseFixe: false,
  afficherCase: false,
  notation: 'les-deux',
  // Règle historique (Q14) : les tests ci-dessous la couvrent ; le mode « pénalité » a son propre bloc.
  fausseNote: 'destruction',
};
const CONTEXTE: ContexteJournal = {
  navigateur: 'test',
  seuilSilenceDbfs: -50,
  traitementsActifs: [],
  images: { nombre: 0, medianeMs: null, p95Ms: null, partAuDelaDe33Ms: null },
  pauses: [],
};

/**
 * Tirage toujours sur la première position possible : au niveau 2, E2 (corde 6, case 0), F2 (case 1) et G2 (case 3)
 * se suivent en boucle, un nom ne revenant qu'après 2 autres (enchainement.ts).
 */
function nouvellePartie(reglages: Partial<ReglagesPartie> = {}, statistiques: Statistique[] = [], simulation = false) {
  return new Partie({ ...REGLAGES, ...reglages }, statistiques, {
    debutMs: DEBUT,
    date: DATE,
    hasard: () => 0,
    simulation,
  });
}

/** Avance par images de 50 ms, de t0 (exclu) à t1 (inclus), et renvoie les événements. */
function avancer(partie: Partie, t0: number, t1: number): EvenementPartie[] {
  const evenements: EvenementPartie[] = [];
  for (let t = t0 + 50; t <= t1; t += 50) evenements.push(...partie.avancer(t));
  return evenements;
}

const resultats = (evenements: EvenementPartie[]) =>
  evenements.filter((e): e is Extract<EvenementPartie, { type: 'resultat' }> => e.type === 'resultat');

/** Joue juste au clavier n notes de suite, une image après l'apparition de chacune. */
function jouerJustes(partie: Partie, n: number, t0 = DEBUT): { t: number; evenements: EvenementPartie[] } {
  const evenements: EvenementPartie[] = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    t += 50;
    evenements.push(...partie.avancer(t), ...partie.jouerSimule(true, t));
  }
  return { t, evenements };
}

describe('début de partie', () => {
  it('la première note apparaît dès le début et devient la note attendue', () => {
    const partie = nouvellePartie();
    expect(partie.notes).toHaveLength(1);
    expect(partie.attendue).toMatchObject({ index: 1, progression: 0, tApparitionMs: DEBUT, tAttendueMs: DEBUT });
    expect(partie.attendue!.question).toMatchObject({ nom: 'E', position: { corde: 6, case: 0 }, cordeDemandee: true });
    expect(partie.notesRestantes).toBe(NOTES_PAR_PARTIE);
    expect(partie.dureeChuteMs).toBe(6000);
    expect(partie.score).toBe(0);
  });

  it('une deuxième note apparaît au tiers de la chute', () => {
    const partie = nouvellePartie();
    avancer(partie, DEBUT, DEBUT + 1950);
    expect(partie.notes).toHaveLength(1);
    avancer(partie, DEBUT + 1950, DEBUT + 2100);
    expect(partie.notes).toHaveLength(2);
    expect(partie.notes[1]!.question.nom).toBe('F');
    expect(partie.attendue!.index).toBe(1);
  });

  it('un nom de note ne revient qu’après 2 notes d’un autre nom, à chaque niveau', () => {
    for (const niveau of [1, 2, 3, 4, 5, 6, 7] as const) {
      let graine = niveau;
      // Hasard reproductible (générateur congruentiel), pour varier le tirage.
      const hasard = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      const partie = new Partie({ ...REGLAGES, niveau }, [], { debutMs: DEBUT, date: DATE, hasard, simulation: true });
      jouerJustes(partie, NOTES_PAR_PARTIE);
      const noms = partie.journal(CONTEXTE).notes.map((n) => n.nom);
      expect(noms).toHaveLength(NOTES_PAR_PARTIE);
      for (let i = 2; i < noms.length; i++) expect(new Set(noms.slice(i - 2, i + 1)).size).toBe(3);
    }
  });
});

describe('validation au micro', () => {
  it('note juste : timing, points, latence, statistique, puis note suivante', () => {
    const partie = nouvellePartie();
    avancer(partie, DEBUT, DEBUT + 1000);
    const evenements = partie.traiterDetection(etat(DEBUT + 1000, { note: 'E2', nouvelle: true, latence: 180 }));
    // 1/6 de la chute : Parfait. 100 × 1,5 × 5/6 = 125.
    expect(evenements).toMatchObject([
      { type: 'resultat', resultat: 'juste', timing: 'parfait', points: 125, serie: 1 },
    ]);
    expect(partie.score).toBe(125);
    expect(partie.notes).toHaveLength(0);
    expect(partie.statistiques).toEqual([
      {
        mode: 2,
        corde: 6,
        case: 0,
        tentatives: 1,
        reussites: 1,
        tempsMoyenMs: 1000,
        derniereDate: '2026-10-28T19:00:01.000Z',
      },
    ]);
    expect(partie.journal(CONTEXTE).notes[0]).toEqual({
      index: 1,
      position: { corde: 6, case: 0 },
      nom: 'E',
      midi: 40,
      tApparitionMs: 0,
      tAttendueMs: 0,
      tAttaqueMs: 820,
      tDetectionMs: 1000,
      detectee: { nom: 'E', midi: 40, cents: 0 },
      resultat: 'juste',
      progression: 0.167,
      dureeChuteMs: 6000,
      timing: 'parfait',
      points: 125,
      serie: 1,
      evenements: [],
    });

    // Écran vide : la note suivante apparaît à l'image suivante et devient attendue.
    avancer(partie, DEBUT + 1000, DEBUT + 1050);
    expect(partie.attendue).toMatchObject({ index: 2, tApparitionMs: DEBUT + 1050, tAttendueMs: DEBUT + 1050 });
    expect(partie.attendue!.question.nom).toBe('F');
  });

  it('fausse note : la note attendue est détruite, la série cassée et la chute ralentie', () => {
    const partie = nouvellePartie();
    jouerJustes(partie, 2);
    expect(partie.serie).toBe(2);
    avancer(partie, DEBUT + 100, DEBUT + 150);
    expect(partie.attendue!.question.nom).toBe('G');
    const evenements = partie.traiterDetection(etat(DEBUT + 500, { note: 'A2', nouvelle: true }));
    expect(evenements).toMatchObject([{ type: 'resultat', resultat: 'fausse', timing: null, points: 0, serie: 0 }]);
    expect(resultats(evenements)[0]!.detectee!.nom).toBe('A');
    expect(partie.notes).toHaveLength(0);
    expect(partie.dureeChuteMs).toBeCloseTo(6900);
    expect(partie.meilleureSerie).toBe(2);
    expect(partie.statistiques.find((s) => s.case === 3)).toMatchObject({ tentatives: 1, reussites: 0 });
  });

  it('note ratée : arrivée sur la ligne sans être jouée', () => {
    const partie = nouvellePartie();
    partie.traiterDetection(etat(DEBUT + 5900, { attaque: true }));
    const evenements = resultats(avancer(partie, DEBUT, DEBUT + 6100));
    expect(evenements).toHaveLength(1);
    expect(evenements[0]).toMatchObject({ resultat: 'ratee', timing: null, points: 0, detectee: null });
    expect(partie.dureeChuteMs).toBeCloseTo(6900);
    // La deuxième note, apparue au tiers de la chute, devient attendue.
    expect(partie.attendue).toMatchObject({ index: 2 });
    expect(partie.attendue!.tAttendueMs).toBeGreaterThanOrEqual(DEBUT + 6000);
    expect(partie.journal(CONTEXTE).notes[0]).toMatchObject({
      resultat: 'ratee',
      progression: 1,
      tAttaqueMs: 5900,
      tDetectionMs: null,
      detectee: null,
    });
  });

  it('la note précédente encore sonore est ignorée une fois, puis comptée fausse', () => {
    const partie = nouvellePartie();
    partie.traiterDetection(etat(DEBUT + 500, { note: 'E2', nouvelle: true }));
    avancer(partie, DEBUT + 500, DEBUT + 550);
    expect(partie.attendue!.question.nom).toBe('F');

    expect(partie.traiterDetection(etat(DEBUT + 600, { note: 'E2', nouvelle: true }))).toMatchObject([
      { type: 'ancienneNote', detectee: { nom: 'E' } },
    ]);
    expect(partie.attendue!.question.nom).toBe('F');
    expect(resultats(partie.traiterDetection(etat(DEBUT + 900, { note: 'E2', nouvelle: true })))).toMatchObject([
      { resultat: 'fausse' },
    ]);
    expect(partie.journal(CONTEXTE).notes[1]!.evenements).toEqual([{ type: 'ancienneNote', tMs: 600, nom: 'E' }]);
  });

  it('une attaque sans note reconnue ne change rien à la note', () => {
    const partie = nouvellePartie();
    expect(partie.traiterDetection(etat(DEBUT + 100, { attaque: true }))).toEqual([]);
    expect(partie.traiterDetection(etat(DEBUT + 1600))).toEqual([{ type: 'nonReconnue' }]);
    expect(partie.attendue!.index).toBe(1);
    expect(resultats(partie.traiterDetection(etat(DEBUT + 2000, { note: 'E3', nouvelle: true })))).toMatchObject([
      { resultat: 'juste' },
    ]);
    expect(partie.journal(CONTEXTE).notes[0]).toMatchObject({
      tAttaqueMs: 1800,
      evenements: [{ type: 'nonReconnue', tMs: 1600 }],
    });
  });

  it('silence de plus de 3 s pendant qu’une note est attendue, compté de nouveau pour la note suivante', () => {
    const partie = nouvellePartie();
    for (let t = DEBUT; t <= DEBUT + 3000; t += 100) partie.traiterDetection(etat(t));
    expect(partie.silenceProlonge(DEBUT + 3000)).toBe(false);
    partie.traiterDetection(etat(DEBUT + 3100));
    expect(partie.silenceProlonge(DEBUT + 3100)).toBe(true);
    partie.traiterDetection(etat(DEBUT + 3200, { note: 'E2', nouvelle: true }));
    expect(partie.silenceProlonge(DEBUT + 3200)).toBe(false);
    avancer(partie, DEBUT + 3200, DEBUT + 3250);
    expect(partie.attendue!.question.nom).toBe('F');
    partie.traiterDetection(etat(DEBUT + 3300));
    expect(partie.silenceProlonge(DEBUT + 6300)).toBe(false);
    expect(partie.silenceProlonge(DEBUT + 6400)).toBe(true);
  });

  it('niveau 1 : la question ne donne pas la corde, E est accepté à l’octave de la corde 1', () => {
    const partie = nouvellePartie({ niveau: 1 });
    expect(partie.attendue!.question).toMatchObject({ nom: 'E', cordeDemandee: false });
    expect(resultats(partie.traiterDetection(etat(DEBUT + 800, { note: 'E4', nouvelle: true })))).toMatchObject([
      { resultat: 'juste' },
    ]);
  });
});

describe('mode « pénalité » : la fausse note coûte des points, la note reste à jouer', () => {
  const penalite = (reglages: Partial<ReglagesPartie> = {}, simulation = false) =>
    nouvellePartie({ fausseNote: 'penalite', ...reglages }, [], simulation);

  it('retire 50 points, casse la série, ralentit la chute et compte la réponse ; la note reste attendue', () => {
    const partie = penalite();
    jouerJustes(partie, 2);
    avancer(partie, DEBUT + 100, DEBUT + 150);
    expect(partie.score).toBe(250);

    const evenements = partie.traiterDetection(etat(DEBUT + 500, { note: 'A2', nouvelle: true }));
    expect(evenements).toMatchObject([{ type: 'fausse', note: { index: 3 }, detectee: { nom: 'A' }, penalite: 50 }]);
    expect(evenements[0]).toMatchObject({ fausses: 1 });
    expect(partie.score).toBe(200);
    expect(partie.serie).toBe(0);
    expect(partie.meilleureSerie).toBe(2);
    expect(partie.dureeChuteMs).toBeCloseTo(6900);
    expect(partie.attendue!.index).toBe(3);
    expect(partie.notesRestantes).toBe(NOTES_PAR_PARTIE - 2);
    expect(partie.statistiques.find((s) => s.case === 3)).toMatchObject({ tentatives: 1, reussites: 0 });

    // Juste ensuite : points à la durée ralentie (100 × 1,5 × 5/6,9), temps de réponse depuis la fausse note.
    const [resultat] = resultats(partie.traiterDetection(etat(DEBUT + 900, { note: 'G2', nouvelle: true })));
    expect(resultat).toMatchObject({ resultat: 'juste', note: { index: 3 }, points: 109, serie: 1 });
    expect(partie.statistiques.find((s) => s.case === 3)).toMatchObject({ tentatives: 2, reussites: 1 });
    const journal = partie.journal(CONTEXTE);
    expect(journal.notes[2]).toMatchObject({
      resultat: 'juste',
      evenements: [{ type: 'fausse', tMs: 500, nom: 'A', midi: 45, cents: 0, penalite: 50 }],
    });
    expect(journal.resume).toMatchObject({ fausses: 1, justes: 3, score: 309 });
  });

  it('le score ne descend pas sous 0 ; la bonne case est due à la 3e fausse note', () => {
    const partie = penalite({}, true);
    expect(partie.jouerSimule(false, DEBUT + 100)).toMatchObject([
      { type: 'fausse', penalite: 0, fausses: 1, detectee: { nom: 'F', midi: 41 } },
    ]);
    partie.jouerSimule(false, DEBUT + 200);
    expect(partie.jouerSimule(false, DEBUT + 300)).toMatchObject([{ type: 'fausse', fausses: FAUSSES_AVANT_RAPPEL }]);
    expect(partie.score).toBe(0);
    expect(partie.attendue!.index).toBe(1);
    // Partie arrêtée sur cette note : ses fausses notes comptent dans le résumé.
    partie.arreter();
    expect(partie.journal(CONTEXTE).resume).toMatchObject({ fausses: 3, justes: 0 });
  });

  it('ignore une fois la note précédente encore sonore, puis compte la fausse note sans détruire', () => {
    const partie = penalite();
    partie.traiterDetection(etat(DEBUT + 500, { note: 'E2', nouvelle: true }));
    avancer(partie, DEBUT + 500, DEBUT + 550);
    expect(partie.traiterDetection(etat(DEBUT + 600, { note: 'E2', nouvelle: true }))).toMatchObject([
      { type: 'ancienneNote' },
    ]);
    expect(partie.traiterDetection(etat(DEBUT + 900, { note: 'E2', nouvelle: true }))).toMatchObject([
      { type: 'fausse', fausses: 1 },
    ]);
    expect(partie.attendue!.question.nom).toBe('F');
    expect(resultats(partie.traiterDetection(etat(DEBUT + 1300, { note: 'F2', nouvelle: true })))).toMatchObject([
      { resultat: 'juste', note: { index: 2 } },
    ]);
    expect(partie.journal(CONTEXTE).notes[1]!.evenements.map((e) => e.type)).toEqual(['ancienneNote', 'fausse']);
  });

  it('une note ratée après des fausses notes finit « ratee »', () => {
    const partie = penalite({ vitesseFixe: true });
    partie.jouerSimule(false, DEBUT + 100);
    const [ratee] = resultats(avancer(partie, DEBUT, DEBUT + 6100));
    expect(ratee).toMatchObject({ resultat: 'ratee', note: { index: 1 } });
    const journal = partie.journal(CONTEXTE);
    expect(journal.notes[0]).toMatchObject({ resultat: 'ratee', evenements: [{ type: 'fausse' }] });
    expect(journal.resume).toMatchObject({ fausses: 1, ratees: 1 });
  });
});

describe('vitesse, série et fin', () => {
  it('accélère après 5 notes justes d’affilée', () => {
    const partie = nouvellePartie();
    jouerJustes(partie, 4);
    expect(partie.dureeChuteMs).toBe(6000);
    jouerJustes(partie, 1, DEBUT + 200);
    expect(partie.dureeChuteMs).toBeCloseTo(5400);
    expect(partie.serie).toBe(5);
  });

  it('garde la durée avec l’option « vitesse fixe »', () => {
    const partie = nouvellePartie({ vitesseFixe: true, dureeInitialeMs: 4000 });
    jouerJustes(partie, 6);
    expect(partie.dureeChuteMs).toBe(4000);
  });

  it('se termine après 30 notes, sans nouveau tirage', () => {
    const partie = nouvellePartie();
    const { t, evenements } = jouerJustes(partie, NOTES_PAR_PARTIE);
    expect(evenements.at(-1)).toEqual({ type: 'fin', interrompue: false });
    expect(partie.terminee).toBe(true);
    expect(partie.notesRestantes).toBe(0);
    expect(partie.multiplicateur).toBe(4);
    expect(partie.avancer(t + 5000)).toEqual([]);
    expect(partie.notes).toHaveLength(0);
    expect(partie.jouerSimule(true, t + 5000)).toEqual([]);

    const { resume, notes } = partie.journal(CONTEXTE);
    expect(notes).toHaveLength(NOTES_PAR_PARTIE);
    expect(resume).toMatchObject({ justes: 30, fausses: 0, ratees: 0, meilleureSerie: 30 });
    expect(resume.score).toBe(notes.reduce((s, n) => s + n.points, 0));
    // Multiplicateur ×2 à partir de la 10e note : à vitesse et position égales, les points doublent.
    expect(notes[9]!.points).toBe(2 * notes[5]!.points);
  });

  it('« Arrêter » termine la partie, marquée interrompue', () => {
    const partie = nouvellePartie();
    jouerJustes(partie, 1);
    expect(partie.arreter()).toEqual([{ type: 'fin', interrompue: true }]);
    expect(partie.terminee).toBe(true);
    expect(partie.interrompue).toBe(true);
    expect(partie.attendue).toBeNull();
    expect(partie.avancer(DEBUT + 1000)).toEqual([]);
    expect(partie.traiterDetection(etat(DEBUT + 1000, { note: 'F2', nouvelle: true }))).toEqual([]);
    expect(partie.arreter()).toEqual([]);
    expect(partie.journal(CONTEXTE)).toMatchObject({ interrompue: true, resume: { justes: 1 } });
  });
});

describe('mode simulation et journal', () => {
  it('une fausse note simulée est un demi-ton au-dessus', () => {
    const partie = nouvellePartie({}, [], true);
    const [resultat] = resultats(partie.jouerSimule(false, DEBUT + 300));
    expect(resultat).toMatchObject({ resultat: 'fausse', detectee: { nom: 'F', midi: 41 } });
    expect(partie.journal(CONTEXTE).simulation).toBe(true);
  });

  it('met à jour les statistiques reçues', () => {
    const existante: Statistique = {
      mode: 2,
      corde: 6,
      case: 0,
      tentatives: 3,
      reussites: 1,
      tempsMoyenMs: 2000,
      derniereDate: '2026-10-27T10:00:00.000Z',
    };
    const partie = nouvellePartie({}, [existante]);
    partie.jouerSimule(true, DEBUT + 1000);
    expect(partie.statistiques).toEqual([
      { ...existante, tentatives: 4, reussites: 2, tempsMoyenMs: 1750, derniereDate: '2026-10-28T19:00:01.000Z' },
    ]);
  });

  it('journal complet de la partie', () => {
    const partie = nouvellePartie();
    partie.jouerSimule(true, DEBUT + 1000);
    partie.avancer(DEBUT + 1050);
    partie.jouerSimule(true, DEBUT + 1550);
    const journal = partie.journal(CONTEXTE);
    expect(journal).toMatchObject({
      debut: '2026-10-28T19:00:00.000Z',
      navigateur: 'test',
      simulation: false,
      interrompue: false,
      reglages: REGLAGES,
      seuilSilenceDbfs: -50,
      traitementsActifs: [],
      images: CONTEXTE.images,
      resume: {
        score: 250,
        justes: 2,
        fausses: 0,
        ratees: 0,
        meilleureSerie: 2,
        dureeFinaleMs: 6000,
        dureeMinMs: 6000,
        tempsReponseMedianMs: 750,
      },
    });
    expect(journal.notes.map((n) => n.nom)).toEqual(['E', 'F']);
  });
});
