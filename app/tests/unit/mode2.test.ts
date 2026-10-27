// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMicro } from '../../src/audio/micro';
import { DUREE_CALIBRAGE_MS } from '../../src/audio/niveau';
import { Ecoute } from '../../src/ecoute.svelte';
import { EtatApp } from '../../src/etat.svelte';
import { avancementInitial } from '../../src/progression/modele';
import { DELAI_NON_DETECTION_MS } from '../../src/quiz/validation';
import Mode2 from '../../src/ui/ecrans/Mode2.svelte';
import { TEXTES } from '../../src/ui/textes';
import { etat } from './detection';
import { stockageMemoire } from './memoire';

const session: SessionMicro = {
  contexte: { sampleRate: 48000 } as AudioContext,
  analyseur: {} as AnalyserNode,
  flux: {} as MediaStream,
  reglagesPiste: {},
  lire: () => {},
  arreter: async () => {},
};

describe('mode 2', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  /** Écran du mode 2 avec un micro factice ; le temps des états de détection est piloté par le test. */
  async function demarrer() {
    const app = new EtatApp(stockageMemoire());
    const ecoute = new Ecoute(app.progression.reglages, (s) => app.definirReglage('seuilSilenceDb', s), {
      demarrerMicro: async () => session,
      planifier: () => 0,
      annuler: () => {},
    });
    // Hasard nul : niveau 1, première question E (cordes 6 et 1), puis A.
    render(Mode2, { etat: app, onQuitter: () => {}, hasard: () => 0, ecoute });
    let t = 0;
    /** Fait passer `ms` millisecondes de détection ; `d` construit l'état au nouvel instant. */
    const envoyer = async (ms: number, d: (t: number) => ReturnType<typeof etat> = (x) => etat(x)) => {
      t += ms;
      ecoute.traiterEtat(d(t));
      await tick();
    };
    /** Attaque puis note stable 200 ms plus tard. */
    const jouer = async (note: string) => {
      await envoyer(1000, (x) => etat(x, { attaque: true, silence: false, niveauDbfs: -20 }));
      await envoyer(200, (x) => etat(x, { note, nouvelle: true }));
    };
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.micro.demarrer }));
    return { app, ecoute, envoyer, jouer };
  }

  const question = () => document.querySelector('.question')?.textContent?.replace(/\s+/g, ' ').trim();
  const statut = () => screen.getByRole('status').textContent?.replace(/\s+/g, ' ').trim();
  const score = () => document.querySelector('.score')?.textContent;

  it('mesure le bruit ambiant, valide la note jouée et passe à la question suivante après 1 s', async () => {
    const { app, ecoute, envoyer, jouer } = await demarrer();
    expect(question()).toBe('Jouez Mi (E) à vide');
    expect(statut()).toBe(TEXTES.micro.calibrage);
    for (let i = 0; i <= DUREE_CALIBRAGE_MS / 100; i++) await envoyer(100, (x) => etat(x, { niveauDbfs: -70 }));
    expect(ecoute.statut).toBe('actif');
    expect(app.progression.reglages.seuilSilenceDb).toBe(ecoute.seuilDbfs);

    await jouer('E2');
    expect(statut()).toBe('✓ Juste : Mi2 (E2), 0 cent');
    expect(score()).toContain('1 / 1');
    expect(app.progression.statistiques).toMatchObject([{ mode: 2, corde: 6, case: 0, tentatives: 1, reussites: 1 }]);
    expect(screen.getByRole('listitem').textContent).toContain('Mi2 (E2) (juste)');

    await vi.advanceTimersByTimeAsync(1000);
    expect(question()).toBe('Jouez La (A) à vide');
    expect(statut()).toBe('');
  });

  it('ignore une fois la note précédente, compte chaque note fausse et rappelle la position après 3 erreurs', async () => {
    const { app, envoyer, jouer } = await demarrer();
    for (let i = 0; i <= DUREE_CALIBRAGE_MS / 100; i++) await envoyer(100);
    await jouer('E2');
    await vi.advanceTimersByTimeAsync(1000);

    // La corde de mi sonne encore : ignorée une fois, sans compter d'erreur.
    await jouer('E2');
    expect(statut()).toBe(TEXTES.mode2.ancienneNote('Mi2 (E2)'));
    expect(score()).toContain('1 / 1');

    await jouer('D3');
    expect(statut()).toBe('✗ Faux : vous avez joué Ré3 (D3)');
    expect(score()).toContain('1 / 2');
    expect(document.querySelector('.manche')).toBeNull();
    await jouer('D3');
    await jouer('E2');
    expect(score()).toContain('1 / 4');
    expect(screen.getByText('Rappel : La (A) est la corde 5, à vide')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Corde 5, à vide/ }).getAttribute('aria-label')).toContain(
      TEXTES.manche.marque.attendue,
    );
    // Statistiques sur la position demandée : A, corde 5 à vide.
    expect(app.progression.statistiques).toContainEqual(
      expect.objectContaining({ mode: 2, corde: 5, case: 0, tentatives: 3, reussites: 0 }),
    );

    await jouer('A2');
    expect(statut()).toBe('✓ Juste : La2 (A2), 0 cent');
    expect(score()).toContain('2 / 5');
  });

  it('signale une note non reconnue sans la compter', async () => {
    const { envoyer } = await demarrer();
    for (let i = 0; i <= DUREE_CALIBRAGE_MS / 100; i++) await envoyer(100);
    await envoyer(100, (x) => etat(x, { attaque: true, silence: false, niveauDbfs: -20 }));
    await envoyer(DELAI_NON_DETECTION_MS, (x) => etat(x, { silence: false, niveauDbfs: -30 }));
    expect(statut()).toBe(TEXTES.mode2.nonReconnue);
    expect(score()).toContain('0 / 0');
  });

  it('affiche la case demandée en option', async () => {
    const { app } = await demarrer();
    // Niveau 3 débloqué en mode 2 seulement : les modes sont indépendants.
    app.remplacer({ ...app.progression, avancement: { ...app.progression.avancement, 2: avancementInitial(3) } });
    await tick();
    const choix = screen.getByRole<HTMLSelectElement>('combobox', { name: TEXTES.quiz.niveau });
    expect(screen.getAllByRole<HTMLOptionElement>('option').filter((o) => !o.disabled)).toHaveLength(3);
    await fireEvent.change(choix, { target: { value: '3' } });
    expect(question()).toBe('Jouez Mi (E) sur la corde 6');
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.mode2.afficherCase }));
    expect(app.progression.reglages.afficherCaseMode2).toBe(true);
    expect(question()).toBe('Jouez Mi (E) sur la corde 6, à vide');
  });

  it('coupe le micro quand l’application passe en arrière-plan', async () => {
    const { ecoute, envoyer } = await demarrer();
    await envoyer(100);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();
    expect(ecoute.statut).toBe('arrete');
    expect(screen.getByText(TEXTES.micro.interrompu)).toBeTruthy();
    expect(screen.getByRole('button', { name: TEXTES.micro.demarrer })).toBeTruthy();
  });
});
