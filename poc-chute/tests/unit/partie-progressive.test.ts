import { describe, expect, it } from 'vitest';
import type { ContexteJournal } from '../../src/jeu/journal';
import { positionsDepart } from '../../src/jeu/progressif/difficulte';
import {
  DUREE_PAUSE_NIVEAU_MS,
  PartieProgressive,
  type EvenementProgressif,
} from '../../src/jeu/progressif/partie-progressive';
import {
  REGLAGES_PROGRESSIF_DEFAUT,
  niveauVitessePleine,
  plafondVitesse,
  type ReglagesProgressif,
} from '../../src/jeu/progressif/reglages';
import { positions, type Position } from '../../src/music/manche';
import { etat } from './detection';

const DATE = new Date('2026-10-30T19:00:00.000Z');
const CONTEXTE: ContexteJournal = {
  navigateur: 'test',
  seuilSilenceDbfs: -50,
  traitementsActifs: [],
  images: { nombre: 0, medianeMs: null, p95Ms: null, partAuDelaDe33Ms: null },
  pauses: [],
};

/** Hasard reproductible (mulberry32). */
function hasardFixe(graine = 1): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nouvelle(
  reglages: Partial<ReglagesProgressif> = {},
  options: { hasard?: () => number; niveau?: number; positions?: Position[] } = {},
) {
  return new PartieProgressive(
    { ...REGLAGES_PROGRESSIF_DEFAUT, ...reglages },
    { debutMs: 0, date: DATE, notation: 'les-deux', afficherCase: false, hasard: () => 0, ...options },
  );
}

const resultats = (evenements: EvenementProgressif[]) =>
  evenements.filter((e): e is Extract<EvenementProgressif, { type: 'resultat' }> => e.type === 'resultat');

/**
 * Joue juste, vite, jusqu'au passage de niveau : toutes les 500 ms, la note suivante apparaît et est jouée aussitôt.
 * @returns l'instant et l'événement du passage
 */
function jouerJusquAuPassage(partie: PartieProgressive, t0 = 0, maximum = 400) {
  let t = t0;
  for (let i = 0; i < maximum; i++) {
    t += 500;
    const evenements = [...partie.avancer(t), ...partie.jouerSimule(true, t)];
    const niveau = evenements.find((e) => e.type === 'niveau');
    if (niveau) return { t, niveau };
  }
  throw new Error('Pas de passage de niveau');
}

describe('départ', () => {
  it('commence aux cordes à vide, au niveau 1, à vitesse 0 : la note reste immobile', () => {
    const partie = nouvelle();
    expect(partie.niveau).toBe(1);
    expect(partie.positions).toEqual(positionsDepart());
    expect(partie.caseMax).toBe(0);
    expect(partie.vitesse).toBe(0);
    expect(partie.dureeChuteMs).toBe(Infinity);
    expect(partie.attendue!.question).toMatchObject({ nom: 'E', position: { corde: 6, case: 0 }, cordeDemandee: true });
    expect(partie.avancer(60_000)).toEqual([]);
    expect(partie.notes).toHaveLength(1);
    expect(partie.attendue!.progression).toBe(0);
  });

  it('reprend au niveau et avec les notes donnés', () => {
    const notes = [...positionsDepart(), { corde: 6, case: 1 } as Position];
    const partie = nouvelle({}, { niveau: 2, positions: notes });
    expect(partie.niveau).toBe(2);
    expect(partie.positions).toEqual(notes);
    expect(partie.caseMax).toBe(1);
    expect(partie.journal(CONTEXTE)).toMatchObject({ mode: 'progressif', niveauDepart: 2, positionsDepart: notes });
  });
});

describe('notes jouées', () => {
  it('une note juste rapporte des points selon son score d’essai et fait monter la vitesse', () => {
    const partie = nouvelle();
    // 1 s après l'apparition : rapide, score 1. 100 × 1 × (1 + 0) = 100 ; vitesse 0,1.
    expect(resultats(partie.jouerSimule(true, 1000))).toMatchObject([
      { resultat: 'juste', points: 100, serie: 1, scoreEssai: 1 },
    ]);
    expect(partie.vitesse).toBeCloseTo(0.1);
    expect(partie.dureeChuteMs).toBeCloseTo(30_000);

    // 3,75 s : rapidités 0,5 (depuis la note précédente) et 0,78125 (après apparition), score 0,8203125.
    partie.avancer(1050);
    const [deuxieme] = resultats(partie.jouerSimule(true, 4800));
    expect(deuxieme!.scoreEssai).toBeCloseTo(0.8203125);
    expect(deuxieme!.points).toBe(90); // 100 × 0,8203 × (1 + 0,1)
    expect(partie.score).toBe(190);
    expect(partie.vitesse).toBeCloseTo(0.1 + 0.1 * 0.8203125);
  });

  it('la vitesse ne dépasse pas le plafond du niveau : 30 % au niveau 1', () => {
    const partie = nouvelle();
    expect(partie.plafond).toBe(0.3);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += 500;
      partie.avancer(t);
      partie.jouerSimule(true, t);
    }
    expect(partie.vitesse).toBe(0.3);
    expect(partie.dureeChuteMs).toBeCloseTo(10_000);
    expect(partie.journal(CONTEXTE).resume.vitesseMax).toBe(0.3);
  });

  it('une fausse note coûte 50 points et ralentit, la note reste ; à la 3e, elle est perdue (−150)', () => {
    const partie = nouvelle();
    partie.jouerSimule(true, 1000);
    partie.avancer(1100);
    partie.score = 1000;
    expect(partie.jouerSimule(false, 1200)).toMatchObject([{ type: 'fausse', penalite: 50, fausses: 1 }]);
    expect(partie.score).toBe(950);
    expect(partie.serie).toBe(0);
    expect(partie.vitesse).toBeCloseTo(0.085);
    expect(partie.attendue!.index).toBe(2);
    partie.jouerSimule(false, 1300);
    const [perdue] = resultats(partie.jouerSimule(false, 1400));
    expect(perdue).toMatchObject({ resultat: 'perdue', points: -150, note: { index: 2 } });
    expect(partie.score).toBe(750);
    expect(partie.attendue).toBeNull();
    partie.avancer(1500);
    expect(partie.attendue!.index).toBe(3);

    const journal = partie.journal(CONTEXTE);
    expect(journal.essais[1]).toMatchObject({
      resultat: 'perdue',
      erreurs: 3,
      justesse: 0,
      points: -150,
      delaiNoteMs: null,
      evenements: [{ type: 'fausse', penalite: 50 }, { type: 'fausse' }],
    });
    expect(journal.resume).toMatchObject({ essais: 2, justes: 1, fausses: 3, perdues: 1, ratees: 0 });
  });

  it('une note qui arrive en bas est ratée (−150), à la vitesse atteinte', () => {
    const partie = nouvelle();
    partie.jouerSimule(true, 1000); // vitesse 0,1 : 30 s de chute
    const evenements: EvenementProgressif[] = [];
    for (let t = 1100; t <= 31_200; t += 100) evenements.push(...partie.avancer(t));
    expect(resultats(evenements)).toMatchObject([{ resultat: 'ratee', points: -100, note: { index: 2 } }]);
    expect(partie.score).toBe(0);
  });

  it('au micro : ancienne note ignorée une fois, puis la bonne note', () => {
    const partie = nouvelle();
    partie.traiterDetection(etat(500, { note: 'E2', nouvelle: true }));
    partie.avancer(600);
    expect(partie.attendue!.question.nom).toBe('A');
    expect(partie.traiterDetection(etat(800, { note: 'E2', nouvelle: true }))).toMatchObject([
      { type: 'ancienneNote' },
    ]);
    expect(resultats(partie.traiterDetection(etat(1200, { note: 'A2', nouvelle: true })))).toMatchObject([
      { resultat: 'juste' },
    ]);
    expect(partie.journal(CONTEXTE).essais[1]!.evenements).toEqual([{ type: 'ancienneNote', tMs: 800, nom: 'E' }]);
  });
});

describe('tirage', () => {
  it('un nom de note ne revient qu’après 2 notes d’un autre nom, même au passage de niveau', () => {
    const partie = nouvelle({ essaisMinimum: 1, seuilNote: 0.3, seuilGlobal: 0.3 }, { hasard: hasardFixe(3) });
    let t = 0;
    for (let i = 0; i < 500; i++) {
      t += 500;
      partie.avancer(t);
      partie.jouerSimule(true, t);
      if (partie.enPause) t += DUREE_PAUSE_NIVEAU_MS;
    }
    const journal = partie.journal(CONTEXTE);
    expect(journal.passages.length).toBeGreaterThanOrEqual(3);
    const noms = journal.essais.map((e) => e.nom);
    expect(noms.length).toBeGreaterThan(300);
    for (let i = 2; i < noms.length; i++) expect(new Set(noms.slice(i - 2, i + 1)).size).toBe(3);
  });
});

describe('tirage des nouvelles notes', () => {
  it('une note sans ses essais minimum garde le poids maximal : les nouvelles notes sont vite jouées 3 fois', () => {
    // Au niveau 2, notes tirées entre le passage et le 3e essai de chacune des 3 nouvelles notes, sur 40 parties :
    // 23 en moyenne (au plus 35) ; 37 en moyenne (jusqu'à 85) quand le poids retombait après un premier essai.
    const nouvelles: Position[] = [
      { corde: 6, case: 1 },
      { corde: 2, case: 1 },
      { corde: 1, case: 1 },
    ];
    const tirages: number[] = [];
    for (let graine = 1; graine <= 40; graine++) {
      const partie = nouvelle({}, { hasard: hasardFixe(graine) });
      let { t } = jouerJusquAuPassage(partie);
      t += DUREE_PAUSE_NIVEAU_MS;
      let n = 0;
      while (!nouvelles.every((p) => partie.essaisDe(p) >= 3)) {
        t += 500;
        partie.avancer(t);
        partie.jouerSimule(true, t);
        n++;
      }
      tirages.push(n);
    }
    expect(tirages.reduce((somme, n) => somme + n, 0) / tirages.length).toBeLessThan(28);
    expect(Math.max(...tirages)).toBeLessThanOrEqual(40);
  });
});

describe('plafond de vitesse', () => {
  it('30 % au niveau 1, + 5 % par niveau, 100 % au niveau 15 (réglages par défaut)', () => {
    const r = REGLAGES_PROGRESSIF_DEFAUT;
    expect([1, 2, 3, 5, 9, 15, 20].map((n) => plafondVitesse(n, r))).toEqual([0.3, 0.35, 0.4, 0.5, 0.7, 1, 1]);
    expect(niveauVitessePleine(r)).toBe(15);
    expect(niveauVitessePleine({ vitesseDepart: 0.3, vitesseParNiveau: 0.1 })).toBe(8);
    expect(niveauVitessePleine({ vitesseDepart: 1, vitesseParNiveau: 0 })).toBe(1);
    expect(niveauVitessePleine({ vitesseDepart: 0.5, vitesseParNiveau: 0 })).toBeNull();
  });

  it('une reprise au niveau 3 plafonne à 40 %', () => {
    const notes = [...positionsDepart(), { corde: 6, case: 1 } as Position];
    expect(nouvelle({}, { niveau: 3, positions: notes }).plafond).toBe(0.4);
  });
});

describe('passage de niveau', () => {
  it('quand chaque note et l’ensemble sont réussis au plafond de vitesse : bonus, notes ajoutées, pause, vitesse 0', () => {
    const partie = nouvelle({}, { hasard: hasardFixe() });
    const { t, niveau } = jouerJusquAuPassage(partie);
    expect(niveau).toEqual({
      type: 'niveau',
      niveau: 2,
      bonus: 500,
      ajoutees: [
        { corde: 6, case: 1 },
        { corde: 2, case: 1 },
        { corde: 1, case: 1 },
      ],
      plafond: 0.35,
    });
    // Chaque corde à vide a été jouée au moins 3 fois (essais minimum).
    const journal = partie.journal(CONTEXTE);
    for (const p of positionsDepart()) {
      expect(
        journal.essais.filter((e) => e.position.corde === p.corde && e.position.case === 0).length,
      ).toBeGreaterThanOrEqual(3);
    }
    expect(journal.resume.vitesseMax).toBe(0.3);

    expect(partie.niveau).toBe(2);
    expect(partie.positions).toHaveLength(9);
    expect(partie.caseMax).toBe(1);
    expect(partie.vitesse).toBe(0);
    expect(partie.plafond).toBe(0.35);
    expect(partie.enPause).toBe(true);
    expect(partie.notes).toHaveLength(0);
    expect(partie.jouerSimule(true, t + 100)).toEqual([]);
    // Pause de passage : rien ne bouge, puis la note suivante apparaît, immobile.
    expect(partie.avancer(t + DUREE_PAUSE_NIVEAU_MS - 1)).toEqual([]);
    expect(partie.notes).toHaveLength(0);
    partie.avancer(t + DUREE_PAUSE_NIVEAU_MS);
    expect(partie.enPause).toBe(false);
    expect(partie.attendue).not.toBeNull();

    expect(journal.passages).toEqual([{ tMs: t, niveau: 2, bonus: 500, ajoutees: niveau.ajoutees, plafond: 0.35 }]);
    expect(Object.keys(journal.essais[0]!.globales)).toEqual(['score', 'taux', 'temps']);
    expect(journal.essais[0]!.reussites).toMatchObject({ score: 1, taux: 1, temps: 1 });
    expect(journal.resume).toMatchObject({ niveauDepart: 1, niveauAtteint: 2 });
  });

  it('pas de passage tant que la vitesse n’a pas atteint le plafond du niveau', () => {
    // Accélération minimale : 0,01 par note ; il faut 30 notes justes pour atteindre le plafond de 30 %.
    const partie = nouvelle({ acceleration: 0.01 }, { hasard: hasardFixe() });
    let t = 0;
    for (let i = 0; i < 28; i++) {
      t += 500;
      const evenements = [...partie.avancer(t), ...partie.jouerSimule(true, t)];
      expect(evenements.some((e) => e.type === 'niveau')).toBe(false);
    }
    expect(partie.reussiteGlobale).toBe(1);
    expect(jouerJusquAuPassage(partie, t).niveau).toMatchObject({ niveau: 2 });
  });

  it('tout le manche validé : un dernier bonus sans note ajoutée, puis plus de passage', () => {
    const partie = nouvelle(
      { essaisMinimum: 1, vitesseDepart: 0.1, seuilNote: 0.3, seuilGlobal: 0.3 },
      { hasard: hasardFixe(7), positions: positions() },
    );
    const { t, niveau } = jouerJusquAuPassage(partie);
    expect(niveau).toMatchObject({ niveau: 2, ajoutees: [] });
    expect(() => jouerJusquAuPassage(partie, t + DUREE_PAUSE_NIVEAU_MS, 100)).toThrow('Pas de passage de niveau');
  });
});
