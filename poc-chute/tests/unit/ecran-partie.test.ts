// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './resize-observer';
import { DUREE_CALIBRAGE_MS } from '../../src/audio/niveau';
import { Ecoute } from '../../src/ecoute.svelte';
import type { PartieJournal } from '../../src/jeu/journal';
import { Partie, type ReglagesPartie } from '../../src/jeu/partie';
import EcranPartie from '../../src/ui/ecrans/Partie.svelte';
import { TEXTES } from '../../src/ui/textes';
import { etat, type OptionsEtat } from './detection';
import { microFactice } from './micro';

// Écran de partie au micro : les états de détection sont envoyés par le test, sur l'horloge des faux minuteurs
// (performance.now() et requestAnimationFrame compris). Hasard nul : au niveau 2, E2 puis F2.
const REGLAGES: ReglagesPartie = {
  niveau: 2,
  dureeInitialeMs: 10000,
  vitesseFixe: true,
  afficherCase: false,
  notation: 'les-deux',
  fausseNote: 'destruction',
};

describe('écran de partie au micro', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });
  afterEach(() => vi.useRealTimers());

  /** Micro démarré par l'appelant (App.svelte), puis écran de partie. */
  async function demarrer() {
    const { dependances } = microFactice();
    const ecoute = new Ecoute({ a4: 440, seuilSilenceDb: -45 }, () => {}, {
      ...dependances,
      planifier: () => 0,
      maintenant: () => performance.now(),
    });
    await ecoute.demarrer();
    const fin = vi.fn<(journal: PartieJournal) => void>();
    render(EcranPartie, {
      config: { mode: 'classique', notation: 'les-deux', afficherCase: false, caseMax: 5, dureeChuteMs: 10000 },
      creerJeu: (options) => new Partie(REGLAGES, [], options),
      ecoute,
      onFin: (journal) => fin(journal as PartieJournal),
      onAnnuler: () => {},
      hasard: () => 0,
    });
    const onFin = fin;
    /** Laisse passer `ms` millisecondes, puis transmet l'état de détection de cet instant. */
    const envoyer = async (ms: number, options: OptionsEtat = {}) => {
      await vi.advanceTimersByTimeAsync(ms);
      ecoute.traiterEtat(etat(performance.now(), options));
      await tick();
    };
    /** Attaque, puis note stable 200 ms plus tard. */
    const jouer = async (note: string) => {
      await envoyer(500, { attaque: true, silence: false, niveauDbfs: -20 });
      await envoyer(200, { note, nouvelle: true });
    };
    return { ecoute, onFin, envoyer, jouer };
  }

  const texte = (selecteur: string) => document.querySelector(selecteur)?.textContent?.replace(/\s+/g, ' ').trim();

  it('calibrage, compte à rebours, puis notes jouées, messages du micro et journal', async () => {
    const { ecoute, onFin, envoyer, jouer } = await demarrer();
    expect(texte('.preparation')).toBe(TEXTES.micro.calibrage);
    for (let t = 0; t <= DUREE_CALIBRAGE_MS; t += 100) await envoyer(100, { niveauDbfs: -70 });
    expect(ecoute.statut).toBe('actif');
    expect(texte('.compte')).toContain('3');
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.querySelector('.note.attendue[data-index="1"]')).not.toBeNull();
    expect(texte('.consigne')).toBe('À jouer : Mi (E) · corde 6');

    // Parfait, à 10 s de chute : 100 × 1,5 × 0,5.
    await jouer('E2');
    expect(screen.getByRole('status').textContent).toBe('Parfait ! +75');
    expect(texte('.entendue')).toBe('Note entendue Mi2 (E2) 0 cent');
    await envoyer(20);
    expect(texte('.consigne')).toBe('À jouer : Fa (F) · corde 6');

    // Silence depuis l'état précédent : le message vient au-delà de 3 s.
    for (let i = 0; i < 3; i++) await envoyer(1000);
    expect(texte('.message')).toBe('');
    await envoyer(1000);
    expect(texte('.message')).toBe(TEXTES.indicateur.jouez);

    await envoyer(500, { attaque: true, silence: false, niveauDbfs: -20 });
    await envoyer(1500);
    expect(texte('.message')).toBe(TEXTES.indicateur.nonReconnue);

    await jouer('E2');
    expect(texte('.message')).toBe('Mi2 (E2) : la note précédente sonne encore, étouffez la corde.');
    expect(texte('.consigne')).toBe('À jouer : Fa (F) · corde 6');

    await jouer('A2');
    expect(screen.getByRole('status').textContent).toBe('Fausse note : La (A)');
    expect(texte('.message')).toBe('');

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(onFin).toHaveBeenCalledOnce();
    const journal = onFin.mock.calls[0]![0];
    expect(journal).toMatchObject({
      simulation: false,
      interrompue: true,
      seuilSilenceDbfs: -60,
      traitementsActifs: [],
    });
    expect(journal.notes.map((n) => n.resultat)).toEqual(['juste', 'fausse']);
    expect(journal.notes[1]!.evenements.map((e) => e.type)).toEqual(['nonReconnue', 'ancienneNote']);
    expect(journal.images.nombre).toBeGreaterThan(0);
  });

  /** Calibrage (2 s), puis compte à rebours (3 s) : la partie commence, la note 1 (E) est attendue. */
  async function commencer(envoyer: (ms: number, options?: OptionsEtat) => Promise<void>) {
    for (let t = 0; t <= DUREE_CALIBRAGE_MS; t += 100) await envoyer(100, { niveauDbfs: -70 });
    await vi.advanceTimersByTimeAsync(3000);
  }

  const cache = () => screen.queryByRole('group', { name: TEXTES.partie.enPause });
  const decalage = () => document.querySelector<HTMLElement>('.note[data-index="1"]')!.style.transform;

  it('pause : temps du jeu gelé, manche masqué, notes ignorées ; reprise après 3 s ; touche P', async () => {
    const { onFin, envoyer, jouer } = await demarrer();
    await commencer(envoyer);
    await vi.advanceTimersByTimeAsync(1000);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.pause }));
    expect(cache()).not.toBeNull();
    const avant = decalage();
    await vi.advanceTimersByTimeAsync(5000);
    expect(decalage()).toBe(avant);
    await jouer('E2');
    expect(screen.getByRole('status').textContent).toBe('');

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.reprendre }));
    expect(texte('.compte-reprise')).toContain('3');
    await vi.advanceTimersByTimeAsync(3000);
    expect(cache()).toBeNull();
    // 1,7 s de jeu sur 10 s de chute : Parfait.
    await jouer('E2');
    expect(screen.getByRole('status').textContent).toBe('Parfait ! +75');

    await fireEvent.keyDown(window, { key: 'p' });
    expect(cache()).not.toBeNull();
    await fireEvent.keyDown(window, { key: 'p' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(cache()).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    const journal = onFin.mock.calls[0]![0];
    // Temps du jeu : la pause ne compte pas (1000 ms + attaque 500 ms + note 200 ms).
    expect(journal.notes[0]).toMatchObject({ resultat: 'juste', tDetectionMs: 1700 });
    expect(journal.pauses).toEqual([
      { tMs: 1000, dureeMs: 5000 + 700 + 3000, arrierePlan: false },
      { tMs: 1700, dureeMs: 3000, arrierePlan: false },
    ]);
  });

  it('onglet en arrière-plan : pause automatique, micro coupé ; « Reprendre » mesure le bruit, puis relance', async () => {
    const { ecoute, onFin, envoyer, jouer } = await demarrer();
    await commencer(envoyer);
    await vi.advanceTimersByTimeAsync(1000);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await tick();
    expect(onFin).not.toHaveBeenCalled();
    expect(ecoute.statut).toBe('arrete');
    expect(cache()!.textContent).toContain(TEXTES.partie.microCoupe);

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.reprendre }));
    await tick();
    expect(ecoute.statut).toBe('calibrage');
    expect(cache()!.textContent).toContain(TEXTES.micro.calibrage);
    await commencer(envoyer);
    expect(cache()).toBeNull();
    await jouer('E2');
    expect(screen.getByRole('status').textContent).toBe('Parfait ! +75');

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(onFin.mock.calls[0]![0].pauses).toMatchObject([{ tMs: 1000, arrierePlan: true }]);
  });
});
