// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './resize-observer';
import { EtatApp } from '../../src/etat.svelte';
import { CLE_JOURNAL } from '../../src/jeu/stockage';
import { jeuInitial, recordsVides } from '../../src/progression/modele';
import { CLE_STOCKAGE } from '../../src/progression/stockage';
import Mode1 from '../../src/ui/ecrans/Mode1.svelte';
import { TEXTES } from '../../src/ui/textes';
import { stockageMemoire } from './memoire';

// Jeu du mode 1 au toucher, sur l'horloge des faux minuteurs (performance.now() et requestAnimationFrame compris).
// Hasard nul : au niveau 1, Mi (E), corde 6 ou corde 1 à vide, puis La (A).

describe('mode 1 : notes qui tombent au toucher', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
    });
  });
  afterEach(() => vi.useRealTimers());

  function afficher(preparer?: (etat: EtatApp) => void, hasard: () => number = () => 0) {
    const stockage = stockageMemoire();
    const etat = new EtatApp(stockage);
    preparer?.(etat);
    const onQuitter = vi.fn();
    render(Mode1, { etat, onQuitter, hasard });
    return { stockage, etat, onQuitter };
  }

  const texte = (selecteur: string) => document.querySelector(selecteur)?.textContent?.replace(/\s+/g, ' ').trim();
  const caseDuManche = (position: string) =>
    document.querySelector<HTMLButtonElement>(`.case[data-position="${position}"]`)!;
  /** Bonne case de la note attendue, donnée par le manche. */
  const reponse = () => document.querySelector<HTMLElement>('.note.attendue')!.dataset.reponse!;

  async function commencer() {
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.commencer }));
    expect(texte('.compte')).toContain('3');
    await vi.advanceTimersByTimeAsync(3000);
  }

  it('compte à rebours, note immobile, case juste : points, statistique sur la case touchée', async () => {
    const { etat } = afficher();
    await commencer();
    expect(texte('.consigne')).toBe('Mi (E) · à vide');
    expect(reponse()).toBe('6-0');
    await vi.advanceTimersByTimeAsync(5000);
    expect(document.querySelectorAll('.note')).toHaveLength(1);

    // Corde 1 à vide : Mi aussi, accepté ; la statistique va à la case touchée.
    await fireEvent.click(caseDuManche('1-0'));
    expect(texte('.retour')).toMatch(/^(Parfait|Bien|Juste) ! \+\d+$/);
    expect(Number(texte('.score')?.split(' ')[0])).toBeGreaterThan(0);
    expect(etat.progression.statistiques).toMatchObject([{ mode: 1, corde: 1, case: 0, tentatives: 1, reussites: 1 }]);
    expect(document.querySelector('.case.juste[data-position="1-0"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(50);
    expect(texte('.consigne')).toBe('La (A) · à vide');
  });

  it('case fausse : −50, la note reste ; à la 3e, perdue, et la bonne case est montrée', async () => {
    const { etat } = afficher();
    await commencer();
    await fireEvent.click(caseDuManche(reponse()));
    await vi.advanceTimersByTimeAsync(50);
    await fireEvent.click(caseDuManche('6-3'));
    expect(texte('.retour')).toBe(`${TEXTES.partie.fausse} · −50`);
    expect(document.querySelector('.case.faux[data-position="6-3"]')).not.toBeNull();
    expect(texte('.consigne')).toBe('La (A) · à vide');
    // En normal, pas d'aide après une case fausse.
    expect(document.querySelectorAll('.rappel')).toHaveLength(0);
    await fireEvent.click(caseDuManche('6-3'));
    await fireEvent.click(caseDuManche('6-3'));
    expect(texte('.retour')).toContain('Perdue : La (A) est la corde 5, à vide');
    expect(document.querySelectorAll('.rappel')).toHaveLength(1);
    // 3 erreurs sur la position tirée (corde 5 à vide).
    expect(etat.progression.statistiques.find((s) => s.corde === 5)).toMatchObject({ tentatives: 3, reussites: 0 });
  });

  it('facile : la bonne case s’allume dès la 1re case fausse, jusqu’à la bonne réponse', async () => {
    afficher((e) => e.sauverJeu({ ...e.progression.jeu, difficulte: 'facile' }));
    await commencer();
    await fireEvent.click(caseDuManche(reponse()));
    await vi.advanceTimersByTimeAsync(50);
    await fireEvent.click(caseDuManche('6-3'));
    const rappels = document.querySelectorAll<HTMLElement>('.rappel');
    expect(rappels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(document.querySelectorAll('.rappel')).toHaveLength(1);
    await fireEvent.click(caseDuManche('5-0'));
    await vi.advanceTimersByTimeAsync(50);
    expect(document.querySelectorAll('.rappel')).toHaveLength(0);
  });

  it('compteur des notes validées : 0/6 au départ, puis il augmente', async () => {
    let n = 0;
    afficher(undefined, () => (n++ * 0.37) % 1);
    await commencer();
    expect(texte('.notes-validees')).toBe('0/6');
    // Chaque note demande 3 essais : le compteur monte avant le passage de niveau.
    for (let i = 0; i < 30 && texte('.notes-validees') === '0/6'; i++) {
      await fireEvent.click(caseDuManche(reponse()));
      await vi.advanceTimersByTimeAsync(400);
    }
    expect(texte('.notes-validees')).toMatch(/^[1-6]\/6$/);
  });

  it('pause : le manche est masqué et ne répond plus, puis reprise après un compte à rebours', async () => {
    afficher();
    await commencer();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.pause }));
    expect(screen.getByRole('group', { name: TEXTES.partie.enPause })).toBeTruthy();
    expect(caseDuManche('6-0').disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.reprendre }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(caseDuManche('6-0').disabled).toBe(false);
  });

  it('passage de niveau : bilan, nouvelles notes entourées, progression enregistrée', async () => {
    // Hasard qui tourne : avec un hasard nul, Mi serait toujours tiré sur la corde 6, jamais sur la corde 1.
    let n = 0;
    const { etat, stockage } = afficher(undefined, () => (n++ * 0.37) % 1);
    await commencer();
    for (let i = 0; i < 100 && etat.progression.jeu.niveau === 1; i++) {
      await fireEvent.click(caseDuManche(reponse()));
      await vi.advanceTimersByTimeAsync(400);
    }
    expect(etat.progression.jeu.niveau).toBe(2);
    expect(etat.progression.jeu.positions).toHaveLength(9);
    expect(stockage.donnees[CLE_STOCKAGE]).toContain('"niveau":2');
    expect(texte('.titre-passage')).toBe(TEXTES.partie.niveauValide(1, 500));
    expect(document.querySelectorAll('.rappel')).toHaveLength(3);
    expect(caseDuManche('6-1').disabled).toBe(true);
  });

  it('arrêt : fin de partie, nouveau record, journal enregistré ; puis départ au niveau atteint', async () => {
    const { etat, stockage } = afficher();
    await commencer();
    await fireEvent.click(caseDuManche(reponse()));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.fin.titre);
    expect(screen.getByText(TEXTES.fin.nouveauRecord)).toBeTruthy();
    expect(texte('.difficulte')).toBe('Normal');
    expect(etat.progression.jeu.records.normal.score).toBeGreaterThan(0);
    expect(etat.progression.jeu.records.normal.niveau).toBe(1);
    expect(etat.progression.jeu.records.facile).toEqual({ score: 0, niveau: 0 });
    const journal = JSON.parse(stockage.donnees[CLE_JOURNAL]!) as unknown[];
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ interrompue: true, difficulte: 'normal', resume: { essais: 1, justes: 1 } });

    // Une partie sans meilleur score ni meilleur niveau n'est pas un record.
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.fin.continuer(1) }));
    await vi.advanceTimersByTimeAsync(3000);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(screen.queryByText(TEXTES.fin.nouveauRecord)).toBeNull();
  });

  it('départ : reprise au niveau atteint, records, recommencer aux cordes à vide après confirmation', async () => {
    const records = { ...recordsVides(), normal: { score: 1200, niveau: 3 } };
    const { etat } = afficher((e) =>
      e.sauverJeu({
        niveau: 3,
        positions: [...jeuInitial().positions, { corde: 6, case: 1 }],
        difficulte: 'normal',
        records,
      }),
    );
    expect(screen.getByText(TEXTES.mode1.recordValeurs(1200, 3))).toBeTruthy();
    expect(screen.getByRole('button', { name: TEXTES.mode1.reprendre(3, 7) })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.recommencer }));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.annuler }));
    expect(etat.progression.jeu.niveau).toBe(3);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.recommencer }));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.confirmer }));
    expect(etat.progression.jeu).toEqual(jeuInitial({ records }));
    expect(texte('.compte')).toContain('3');
  });

  it('difficulté : choix enregistré, records et record battu propres à chaque difficulté', async () => {
    const records = { ...recordsVides(), normal: { score: 5000, niveau: 4 } };
    const { etat } = afficher((e) => e.sauverJeu({ ...jeuInitial({ records }) }));
    expect(screen.getByRole('radio', { name: /^Normal/ })).toHaveProperty('checked', true);
    expect(screen.getByText(TEXTES.mode1.recordValeurs(5000, 4))).toBeTruthy();

    await fireEvent.click(screen.getByRole('radio', { name: /^Facile/ }));
    expect(etat.progression.jeu.difficulte).toBe('facile');
    expect(screen.getByRole('heading', { name: TEXTES.mode1.records('Facile') })).toBeTruthy();
    expect(screen.getByText(TEXTES.mode1.aucunRecord)).toBeTruthy();

    // Un premier score en facile est un record en facile, sans toucher au record du mode normal.
    await commencer();
    await fireEvent.click(caseDuManche(reponse()));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(texte('.difficulte')).toBe('Facile');
    expect(screen.getByText(TEXTES.fin.nouveauRecord)).toBeTruthy();
    expect(etat.progression.jeu.records.facile.niveau).toBe(1);
    expect(etat.progression.jeu.records.normal).toEqual({ score: 5000, niveau: 4 });
  });

  it('arrêter pendant le compte à rebours ramène au départ sans rien enregistrer', async () => {
    const { stockage } = afficher();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.mode1.commencer }));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(screen.getByRole('button', { name: TEXTES.mode1.commencer })).toBeTruthy();
    expect(stockage.donnees[CLE_JOURNAL]).toBeUndefined();
  });
});
