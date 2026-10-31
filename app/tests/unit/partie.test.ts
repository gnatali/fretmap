import { describe, expect, it } from 'vitest';
import { positionsDepart } from '../../src/jeu/difficulte';
import type { ContexteJournal } from '../../src/jeu/journal';
import { ESSAIS_HARDCORE, reglagesDe, type Difficulte } from '../../src/jeu/niveauxDifficulte';
import { DUREE_PAUSE_NIVEAU_MS, Partie, TIRAGES_AVANT_RETOUR, type EvenementPartie } from '../../src/jeu/partie';
import {
  REGLAGES_PROGRESSIF_DEFAUT,
  niveauVitessePleine,
  plafondVitesse,
  type ReglagesProgressif,
} from '../../src/jeu/reglages';
import { positions, type Position } from '../../src/music/manche';

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

    // 3,75 s : rapidités 0,5 (depuis la note précédente) et 0,78125 (après apparition), score 0,8203125.
    partie.avancer(1050);
    const [deuxieme] = resultats(toucher(partie, true, 4800));
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
        toucher(partie, true, t);
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
    expect(toucher(partie, true, t + 100)).toEqual([]);
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
      const evenements = [...partie.avancer(t), ...toucher(partie, true, t)];
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

  it('règle la réussite minimale du niveau : 60 %, 80 %, 90 % ; facile : 40 % par note ; hardcore : 5 essais', () => {
    expect(reglagesDe('facile')).toEqual({ ...REGLAGES_PROGRESSIF_DEFAUT, seuilNote: 0.4, seuilGlobal: 0.6 });
    expect(reglagesDe('normal')).toEqual(REGLAGES_PROGRESSIF_DEFAUT);
    expect(reglagesDe('difficile')).toEqual({ ...REGLAGES_PROGRESSIF_DEFAUT, seuilGlobal: 0.9 });
    expect(reglagesDe('hardcore')).toEqual({ ...REGLAGES_PROGRESSIF_DEFAUT, essaisMinimum: ESSAIS_HARDCORE });
    expect(nouvelle().difficulte).toBe('normal');
    expect(enDifficulte('hardcore').journal(CONTEXTE).difficulte).toBe('hardcore');
  });

  it('une note toutes les 3,4 s (score d’essai 0,85) passe en facile et en normal, pas en difficile', () => {
    // Vitesse lente (60 s de chute) : une seule note à l'écran, délais après apparition et depuis la note
    // précédente égaux. Rapidités (6 − 3,4) / 4,5 et (10 − 3,4) / 8 : score 0,5 + 0,5 × 0,7 = 0,85.
    const lente = { vitesseDepart: 0.05 };
    expect(passe(enDifficulte('facile', lente), 3400)).toBe(true);
    expect(passe(enDifficulte('normal', lente), 3400)).toBe(true);
    expect(passe(enDifficulte('difficile', lente), 3400)).toBe(false);
    expect(passe(enDifficulte('difficile', lente), 1000)).toBe(true);
  });

  it('hardcore : une note est acquise après 5 essais de suite justes et rapides, et le reste', () => {
    const partie = enDifficulte('hardcore');
    expect(partie.notesValidees).toBe(0);
    let t = 0;
    let max = 0;
    for (let i = 0; i < 400 && !partie.enPause; i++) {
      partie.avancer(t);
      t += 500;
      partie.avancer(t);
      toucher(partie, true, t);
      expect(partie.notesValidees).toBeGreaterThanOrEqual(max);
      max = Math.max(max, partie.notesValidees);
    }
    expect(partie.niveau).toBe(2);
    const journal = partie.journal(CONTEXTE);
    for (const p of positionsDepart()) {
      expect(journal.bilanNotes.find((b) => b.position.corde === p.corde && b.position.case === 0)).toMatchObject({
        validee: true,
      });
    }
    // Au niveau 2, les cordes à vide restent acquises ; seules les 3 nouvelles notes sont à valider.
    expect(partie.notesValidees).toBe(6);
    expect(journal.resume.notesValidees).toBe(6);
  });

  it('hardcore : une case fausse de temps en temps n’empêche pas de passer', () => {
    // Une case fausse toutes les 7 notes : aucune note n'a ses 5 derniers essais propres en même temps que les autres
    // très longtemps, mais chacune finit par avoir 5 essais propres de suite.
    expect(passe(enDifficulte('hardcore'), 500, 400, 7)).toBe(true);
  });

  it('hardcore : des notes justes mais lentes (2 s) ne passent pas le niveau, qui passe en normal', () => {
    expect(passe(enDifficulte('normal'), 2000)).toBe(true);
    expect(passe(enDifficulte('hardcore'), 2000)).toBe(false);
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
