import { describe, expect, it } from 'vitest';
import { positionsDepart } from '../../src/jeu/difficulte';
import type { ContexteJournal } from '../../src/jeu/journal';
import { DIFFICULTES, REGLAGES_DIFFICULTE, reglagesDe, type Difficulte } from '../../src/jeu/niveauxDifficulte';
import { Partie, TIRAGES_AVANT_RETOUR, type EvenementPartie } from '../../src/jeu/partie';
import {
  REGLAGES_PROGRESSIF_DEFAUT,
  niveauVitessePleine,
  plafondVitesse,
  type ReglagesProgressif,
} from '../../src/jeu/reglages';
import { noteDePosition, positions, type Position } from '../../src/music/manche';

const DATE = new Date('2026-10-30T19:00:00.000Z');
const CONTEXTE: ContexteJournal = {
  navigateur: 'test',
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
  options: { hasard?: () => number; niveau?: number; positions?: Position[]; difficulte?: Difficulte } = {},
) {
  return new Partie(
    { ...REGLAGES_PROGRESSIF_DEFAUT, ...reglages },
    { debutMs: 0, date: DATE, notation: 'les-deux', hasard: () => 0, ...options },
  );
}

const resultats = (evenements: EvenementPartie[]) =>
  evenements.filter((e): e is Extract<EvenementPartie, { type: 'resultat' }> => e.type === 'resultat');

const memePosition = (a: Position, b: Position) => a.corde === b.corde && a.case === b.case;

/** Touche la bonne case de la note attendue (la première acceptée), ou une case fausse. */
function toucher(partie: Partie, juste: boolean, tMs: number): EvenementPartie[] {
  const question = partie.attendue?.question;
  if (!question) return [];
  const correctes = question.positionsCorrectes;
  const position = juste ? correctes[0]! : positions().find((p) => !correctes.some((q) => memePosition(p, q)))!;
  return partie.toucher(position, tMs);
}

/**
 * Joue juste, vite, jusqu'au passage de niveau : toutes les 500 ms, la note suivante apparaît et est jouée aussitôt.
 * @returns l'instant et l'événement du passage
 */
function jouerJusquAuPassage(partie: Partie, t0 = 0, maximum = 400) {
  let t = t0;
  for (let i = 0; i < maximum; i++) {
    t += 500;
    const evenements = [...partie.avancer(t), ...toucher(partie, true, t)];
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
    expect(partie.attendue!.question).toMatchObject({ nom: 'E', position: { corde: 6, case: 0 } });
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
    expect(partie.journal(CONTEXTE)).toMatchObject({ niveauDepart: 2, positionsDepart: notes });
  });
});

describe('cordes à vide', () => {
  it('ne donnent que le nom : toute corde à vide de ce nom est acceptée, l’essai va à la position tirée', () => {
    const partie = nouvelle();
    expect(partie.attendue!.question).toMatchObject({
      cordeDemandee: false,
      positionsCorrectes: [
        { corde: 6, case: 0 },
        { corde: 1, case: 0 },
      ],
    });
    // Mi tiré sur la corde 6, touché sur la corde 1 : juste.
    const [resultat] = resultats(partie.toucher({ corde: 1, case: 0 }, 1000));
    expect(resultat).toMatchObject({ resultat: 'juste', touchee: { corde: 1, case: 0 }, tempsReponseMs: 1000 });
    expect(partie.essaisDe({ corde: 6, case: 0 })).toBe(1);
    expect(partie.essaisDe({ corde: 1, case: 0 })).toBe(0);
  });

  it('une autre case qui donne la même note n’est pas une corde à vide : case fausse', () => {
    const partie = nouvelle();
    partie.toucher({ corde: 6, case: 0 }, 500);
    partie.avancer(600);
    // La (A) à vide : la case 5 de la corde 6 donne aussi La, mais la question demande la corde à vide.
    expect(partie.attendue!.question.nom).toBe('A');
    expect(partie.toucher({ corde: 6, case: 5 }, 800)).toMatchObject([{ type: 'fausse', fausses: 1 }]);
    expect(resultats(partie.toucher({ corde: 5, case: 0 }, 1000))).toMatchObject([{ resultat: 'juste' }]);
  });

  it('les autres notes donnent la corde : toute case de cette corde qui donne la note est acceptée', () => {
    const notes: Position[] = [{ corde: 5, case: 12 }];
    const partie = nouvelle({}, { niveau: 3, positions: notes });
    expect(partie.attendue!.question).toMatchObject({
      nom: 'A',
      cordeDemandee: true,
      positionsCorrectes: [
        { corde: 5, case: 0 },
        { corde: 5, case: 12 },
      ],
    });
    expect(resultats(partie.toucher({ corde: 5, case: 0 }, 900))).toMatchObject([{ resultat: 'juste' }]);
  });
});

describe('notes jouées', () => {
  it('une note juste rapporte des points selon son score d’essai et fait monter la vitesse', () => {
    const partie = nouvelle();
    // 1 s après l'apparition : rapide, score 1. 100 × 1 × (1 + 0) = 100 ; vitesse 0,1.
    expect(resultats(toucher(partie, true, 1000))).toMatchObject([
      { resultat: 'juste', points: 100, serie: 1, scoreEssai: 1 },
    ]);
    expect(partie.vitesse).toBeCloseTo(0.1);
    expect(partie.dureeChuteMs).toBeCloseTo(30_000);

    // 3,75 s depuis que la note est demandée : rapidité 0,5, score 0,75.
    partie.avancer(1050);
    const [deuxieme] = resultats(toucher(partie, true, 4800));
    expect(deuxieme!.scoreEssai).toBeCloseTo(0.75);
    expect(deuxieme!.points).toBe(83); // 100 × 0,75 × (1 + 0,1) = 82,5
    expect(partie.score).toBe(183);
    expect(partie.vitesse).toBeCloseTo(0.1 + 0.1 * 0.75);
  });

  it('la vitesse ne dépasse pas le plafond du niveau : 30 % au niveau 1', () => {
    const partie = nouvelle();
    expect(partie.plafond).toBe(0.3);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
    }
    expect(partie.vitesse).toBe(0.3);
    expect(partie.dureeChuteMs).toBeCloseTo(10_000);
    expect(partie.journal(CONTEXTE).resume.vitesseMax).toBe(0.3);
  });

  it('une case fausse coûte 50 points et ralentit, la note reste ; à la 3e, elle est perdue (−150)', () => {
    const partie = nouvelle();
    toucher(partie, true, 1000);
    partie.avancer(1100);
    partie.score = 1000;
    expect(toucher(partie, false, 1200)).toMatchObject([
      { type: 'fausse', penalite: 50, fausses: 1, tempsReponseMs: 100, touchee: { corde: 6, case: 0 } },
    ]);
    expect(partie.score).toBe(950);
    expect(partie.serie).toBe(0);
    expect(partie.vitesse).toBeCloseTo(0.085);
    expect(partie.attendue!.index).toBe(2);
    toucher(partie, false, 1300);
    const [perdue] = resultats(toucher(partie, false, 1400));
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
      touchee: { corde: 6, case: 0 },
      fausses: [
        { tMs: 1200, position: { corde: 6, case: 0 }, penalite: 50 },
        { tMs: 1300, position: { corde: 6, case: 0 }, penalite: 50 },
        { tMs: 1400, position: { corde: 6, case: 0 }, penalite: 0 },
      ],
    });
    expect(journal.resume).toMatchObject({ essais: 2, justes: 1, fausses: 3, perdues: 1, ratees: 0 });
  });

  it('une note qui arrive en bas est ratée (−150), à la vitesse atteinte', () => {
    const partie = nouvelle();
    toucher(partie, true, 1000); // vitesse 0,1 : 30 s de chute
    const evenements: EvenementPartie[] = [];
    for (let t = 1100; t <= 31_200; t += 100) evenements.push(...partie.avancer(t));
    expect(resultats(evenements)).toMatchObject([
      { resultat: 'ratee', points: -100, note: { index: 2 }, touchee: null },
    ]);
    expect(partie.score).toBe(0);
  });
});

describe('tirage', () => {
  it('un nom de note ne revient qu’après 2 notes d’un autre nom, même au passage de niveau', () => {
    const partie = nouvelle({ essaisMinimum: 1, seuilNote: 0.3, seuilGlobal: 0.3 }, { hasard: hasardFixe(3) });
    let t = 0;
    for (let i = 0; i < 500; i++) {
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
      if (partie.enPause) partie.continuer(t);
    }
    const journal = partie.journal(CONTEXTE);
    expect(journal.passages.length).toBeGreaterThanOrEqual(3);
    const noms = journal.essais.map((e) => e.nom);
    expect(noms.length).toBeGreaterThan(300);
    for (let i = 2; i < noms.length; i++) expect(new Set(noms.slice(i - 2, i + 1)).size).toBe(3);
  });
});

describe('tirage après un passage de niveau', () => {
  it('toutes les notes du niveau repartent du poids maximal : chacune est vite rejouée 3 fois', () => {
    // Au niveau 2, notes tirées jusqu'à 3 essais pour chacune des 9 notes, sur 40 parties : 33 en moyenne (27 à 45).
    // Les cordes à vide repartent de zéro comme les 3 nouvelles notes (version 3.10).
    const tirages: number[] = [];
    for (let graine = 1; graine <= 40; graine++) {
      const partie = nouvelle({}, { hasard: hasardFixe(graine) });
      let { t } = jouerJusquAuPassage(partie);
      partie.continuer(t);
      const essais = new Map<string, number>();
      const cle = (p: Position) => `${p.corde}-${p.case}`;
      let n = 0;
      // Jusqu'à 3 essais pour chacune des 9 notes du niveau 2 (ou jusqu'au passage suivant, qui les demande).
      while (n < 300 && (essais.size < 9 || [...essais.values()].some((k) => k < 3))) {
        t += 500;
        const evenements = [...partie.avancer(t), ...toucher(partie, true, t)];
        for (const e of evenements) {
          if (e.type === 'resultat') {
            const p = e.note.question.position;
            essais.set(cle(p), (essais.get(cle(p)) ?? 0) + 1);
            n++;
          }
        }
        if (evenements.some((e) => e.type === 'niveau')) break;
      }
      tirages.push(n);
    }
    expect(Math.min(...tirages)).toBeGreaterThanOrEqual(27);
    expect(tirages.reduce((somme, n) => somme + n, 0) / tirages.length).toBeLessThan(36);
    expect(Math.max(...tirages)).toBeLessThanOrEqual(50);
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
  it('quand chaque note et l’ensemble sont réussis au plafond de vitesse : bonus, notes ajoutées, attente, vitesse 0', () => {
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
    // Les essais et les réussites repartent de zéro : toutes les notes du niveau 2 sont à valider (version 3.10).
    expect(partie.essaisDe({ corde: 6, case: 0 })).toBe(0);
    expect(partie.reussiteDe({ corde: 6, case: 0 })).toBe(0);
    expect(partie.notesValidees).toBe(0);
    expect(partie.reussiteGlobale).toBe(0);
    expect(partie.plafond).toBe(0.35);
    expect(partie.enPause).toBe(true);
    expect(partie.notes).toHaveLength(0);
    expect(toucher(partie, true, t + 100)).toEqual([]);
    // Passage : rien ne bouge tant que « Continuer » n'est pas choisi, même longtemps après.
    expect(partie.avancer(t + 60_000)).toEqual([]);
    expect(partie.notes).toHaveLength(0);
    expect(partie.attendue).toBeNull();
    // Puis la note suivante apparaît, immobile.
    partie.continuer(t + 60_000);
    expect(partie.enPause).toBe(false);
    partie.avancer(t + 60_000);
    expect(partie.attendue).toMatchObject({ progression: 0 });
    partie.avancer(t + 120_000);
    expect(partie.attendue!.progression).toBe(0);

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
      const evenements = [...partie.avancer(t), ...toucher(partie, true, t)];
      expect(evenements.some((e) => e.type === 'niveau')).toBe(false);
    }
    expect(partie.reussiteGlobale).toBe(1);
    expect(jouerJusquAuPassage(partie, t).niveau).toMatchObject({ niveau: 2 });
  });

  it('facile : notes naturelles seulement, même reprise avec des notes altérées', () => {
    const naturelle = (q: Position) => !noteDePosition(q).nom.includes('#');
    // Niveau 5 d'une partie en normal : cordes à vide et cases 1 à 3, avec La# (corde 5, case 1).
    const niveau5 = positions(0, 3).filter((q) => naturelle(q) || memePosition(q, { corde: 5, case: 1 }));
    const facile = nouvelle(
      { essaisMinimum: 1 },
      { hasard: hasardFixe(3), niveau: 5, positions: niveau5, difficulte: 'facile' },
    );
    expect(facile.positions).toHaveLength(niveau5.length - 1);
    expect(facile.positions.every(naturelle)).toBe(true);
    const { niveau } = jouerJusquAuPassage(facile);
    expect(niveau).toMatchObject({ niveau: 6 });
    expect(niveau.type === 'niveau' && niveau.ajoutees.every(naturelle)).toBe(true);
    expect(facile.positions.every(naturelle)).toBe(true);
    // Les autres difficultés gardent La# et en ajoutent d'autres.
    expect(nouvelle({}, { niveau: 5, positions: niveau5, difficulte: 'normal' }).positions).toHaveLength(
      niveau5.length,
    );
  });

  it('facile : toutes les notes naturelles du manche validées, un dernier bonus sans note ajoutée', () => {
    const naturelles = positions().filter((q) => !noteDePosition(q).nom.includes('#'));
    const partie = nouvelle(
      { essaisMinimum: 1, vitesseDepart: 0.1, seuilNote: 0.3, seuilGlobal: 0.3 },
      { hasard: hasardFixe(7), positions: naturelles, difficulte: 'facile' },
    );
    expect(jouerJusquAuPassage(partie).niveau).toMatchObject({ niveau: 2, ajoutees: [] });
  });

  it('tout le manche validé : un dernier bonus sans note ajoutée, puis plus de passage', () => {
    const partie = nouvelle(
      { essaisMinimum: 1, vitesseDepart: 0.1, seuilNote: 0.3, seuilGlobal: 0.3 },
      { hasard: hasardFixe(7), positions: positions() },
    );
    const { t, niveau } = jouerJusquAuPassage(partie);
    expect(niveau).toMatchObject({ niveau: 2, ajoutees: [] });
    partie.continuer(t);
    expect(() => jouerJusquAuPassage(partie, t, 100)).toThrow('Pas de passage de niveau');
  });
});

describe('difficulté', () => {
  /** Partie dans une difficulté, avec ses réglages (et des réglages en plus). */
  const enDifficulte = (difficulte: Difficulte, autres: Partial<ReglagesProgressif> = {}, graine = 1) =>
    new Partie(
      { ...reglagesDe(difficulte), ...autres },
      { debutMs: 0, date: DATE, notation: 'les-deux', hasard: hasardFixe(graine), difficulte },
    );

  /**
   * Joue juste, `delaiMs` après l'apparition de chaque note, jusqu'au passage de niveau ou à `maximum` notes ;
   * true si passage. Avec `fauteToutes`, une case fausse avant la bonne case une note sur `fauteToutes`.
   */
  function passe(partie: Partie, delaiMs: number, maximum = 300, fauteToutes = 0): boolean {
    let t = 0;
    for (let i = 1; i <= maximum; i++) {
      partie.avancer(t); // La note suivante apparaît.
      t += delaiMs;
      partie.avancer(t);
      if (fauteToutes && i % fauteToutes === 0) toucher(partie, false, t - 100);
      if (toucher(partie, true, t).some((e) => e.type === 'niveau')) return true;
    }
    return false;
  }

  it('règle la vitesse, les essais par note, la rapidité et les seuils ; le normal garde les réglages du POC', () => {
    for (const d of DIFFICULTES)
      expect(reglagesDe(d)).toEqual({ ...REGLAGES_PROGRESSIF_DEFAUT, ...REGLAGES_DIFFICULTE[d] });
    expect(reglagesDe('normal')).toEqual(REGLAGES_PROGRESSIF_DEFAUT);
    expect(DIFFICULTES.map((d) => reglagesDe(d).essaisMinimum)).toEqual([2, 3, 4, 5]);
    expect(DIFFICULTES.map((d) => reglagesDe(d).delaiNoteBonMs)).toEqual([2500, 1500, 1000, 1500]);
    expect(DIFFICULTES.map((d) => reglagesDe(d).seuilGlobal)).toEqual([0.6, 0.8, 0.9, 0.8]);
    // Plafond de vitesse : chute de 15 s, 10 s, 7,5 s et 7,5 s au niveau 1 (vitesse max : 3 s).
    expect(DIFFICULTES.map((d) => plafondVitesse(1, reglagesDe(d)))).toEqual([0.2, 0.3, 0.4, 0.4]);
    expect(DIFFICULTES.map((d) => plafondVitesse(2, reglagesDe(d)))).toEqual([0.23, 0.35, 0.47, 0.47]);
    expect(nouvelle().difficulte).toBe('normal');
    expect(enDifficulte('hardcore').journal(CONTEXTE).difficulte).toBe('hardcore');
  });

  it('une note toutes les 2,85 s passe en facile et en normal, pas en difficile (réponses en 1 s exigées)', () => {
    // Vitesse lente (60 s de chute) : une seule note à l'écran. Rapidité en normal (6 − 2,85) / 4,5 = 0,7 : score
    // 0,85 ≥ 80 % ; en facile (8 − 2,85) / 5,5 = 0,94 : score 0,97 ; en difficile (4 − 2,85) / 3 = 0,38 : score
    // 0,69 < 90 %.
    const lente = { vitesseDepart: 0.05 };
    expect(passe(enDifficulte('facile', lente), 2850)).toBe(true);
    expect(passe(enDifficulte('normal', lente), 2850)).toBe(true);
    expect(passe(enDifficulte('difficile', lente), 2850)).toBe(false);
    expect(passe(enDifficulte('difficile', lente), 1000)).toBe(true);
  });

  it('hardcore : une note est acquise après 4 réponses propres sur 5 essais de suite, et le reste jusqu’au passage', () => {
    const partie = enDifficulte('hardcore');
    expect(partie.notesValidees).toBe(0);
    let t = 0;
    let max = 0;
    let validees = 0;
    for (let i = 0; i < 400 && !partie.enPause; i++) {
      partie.avancer(t);
      t += 500;
      partie.avancer(t);
      validees = partie.notesValidees;
      toucher(partie, true, t);
      if (partie.enPause) break;
      expect(partie.notesValidees).toBeGreaterThanOrEqual(max);
      max = Math.max(max, partie.notesValidees);
    }
    expect(partie.niveau).toBe(2);
    // Juste avant le passage, au moins 5 des 6 cordes à vide étaient acquises (la dernière l'est au passage).
    expect(validees).toBeGreaterThanOrEqual(5);
    // Au niveau 2, tout repart à zéro, notes acquises comprises : les 9 notes sont à valider (version 3.10).
    const journal = partie.journal(CONTEXTE);
    for (const p of positionsDepart()) {
      expect(journal.bilanNotes.find((b) => b.position.corde === p.corde && b.position.case === 0)).toMatchObject({
        essais: 0,
        validee: false,
      });
    }
    expect(partie.notesValidees).toBe(0);
    expect(journal.resume.notesValidees).toBe(0);
  });

  it('hardcore : une case fausse de temps en temps n’empêche pas de passer', () => {
    // Une case fausse toutes les 7 notes : chaque note finit par avoir 4 réponses propres sur 5 essais de suite.
    expect(passe(enDifficulte('hardcore'), 500, 400, 7)).toBe(true);
  });

  it('hardcore : des notes justes mais lentes (2 s) ne passent pas le niveau, qui passe en normal', () => {
    expect(passe(enDifficulte('normal'), 2000)).toBe(true);
    expect(passe(enDifficulte('hardcore'), 2000)).toBe(false);
  });

  it('hardcore : une note pas encore acquise est tirée plus souvent (poids maximal)', () => {
    // Niveau 3 (12 notes) : La (corde 5) est toujours jouée en 2 s, jamais acquise ; les autres en 0,5 s, vite
    // acquises. Sans cette priorité, La serait tirée environ 1 fois sur 12 (7 à 10 % selon le hasard) ; avec, 17 à
    // 19 %.
    const c = (corde: Position['corde'], numeroCase: number): Position => ({ corde, case: numeroCase });
    const niveau3 = [...positionsDepart(), c(6, 1), c(2, 1), c(1, 1), c(5, 2), c(4, 2), c(3, 2)];
    const partie = new Partie(reglagesDe('hardcore'), {
      debutMs: 0,
      date: DATE,
      notation: 'les-deux',
      hasard: hasardFixe(1),
      difficulte: 'hardcore',
      niveau: 3,
      positions: niveau3,
    });
    const estLa = (p: Position) => p.corde === 5 && p.case === 0;
    let t = 0;
    for (let i = 0; i < 400; i++) {
      partie.avancer(t);
      const attendue = partie.attendue?.question.position;
      t += attendue && estLa(attendue) ? 2000 : 500;
      partie.avancer(t);
      toucher(partie, true, t);
    }
    expect(partie.niveau).toBe(3);
    const essais = partie.journal(CONTEXTE).essais.slice(150);
    expect(essais.filter((e) => estLa(e.position)).length / essais.length).toBeGreaterThan(0.14);
  });
});

describe('note ratée qui revient', () => {
  it('après une case fausse, la note revient au 3e tirage suivant, marquée dans le journal', () => {
    const partie = nouvelle({}, { hasard: hasardFixe(5) });
    let t = 0;
    // Quelques notes justes, puis une case fausse sur la note attendue avant de la jouer juste.
    for (let i = 0; i < 4; i++) {
      partie.avancer(t);
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
    }
    partie.avancer(t);
    const ratee = partie.attendue!;
    t += 500;
    partie.avancer(t);
    toucher(partie, false, t);
    toucher(partie, true, t + 100);
    t += 100;
    const suivantes: Position[] = [];
    for (let i = 0; i < TIRAGES_AVANT_RETOUR; i++) {
      partie.avancer(t);
      suivantes.push(partie.attendue!.question.position);
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
    }
    expect(TIRAGES_AVANT_RETOUR).toBe(3);
    expect(suivantes[2]).toEqual(ratee.question.position);
    expect(suivantes.slice(0, 2)).not.toContainEqual(ratee.question.position);
    const essais = partie.journal(CONTEXTE).essais;
    expect(essais.at(-1)).toMatchObject({ position: ratee.question.position, revient: true });
    expect(essais.filter((e) => e.revient)).toHaveLength(1);
  });

  it('une note jouée juste du premier coup ne revient pas plus tôt', () => {
    const partie = nouvelle({}, { hasard: hasardFixe(5) });
    let t = 0;
    for (let i = 0; i < 30; i++) {
      partie.avancer(t);
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
    }
    expect(partie.journal(CONTEXTE).essais.some((e) => e.revient)).toBe(false);
  });
});
