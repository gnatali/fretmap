// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { SessionMicro } from '../../src/audio/micro';
import { DUREE_CALIBRAGE_MS } from '../../src/audio/niveau';
import { Ecoute } from '../../src/ecoute.svelte';
import { EtatApp } from '../../src/etat.svelte';
import { DUREE_JUSTE_MS } from '../../src/music/accordages';
import Accordeur from '../../src/ui/ecrans/Accordeur.svelte';
import { TEXTES } from '../../src/ui/textes';
import { etat, type OptionsEtat } from './detection';
import { stockageMemoire } from './memoire';

const session: SessionMicro = {
  contexte: { sampleRate: 48000 } as AudioContext,
  analyseur: {} as AnalyserNode,
  flux: {} as MediaStream,
  reglagesPiste: {},
  lire: () => {},
  arreter: async () => {},
};

describe('accordeur', () => {
  /** Accordeur avec un micro factice, déjà calibré ; le temps des états de détection est piloté par le test. */
  async function demarrer() {
    const app = new EtatApp(stockageMemoire());
    const ecoute = new Ecoute(app.progression.reglages, (s) => app.definirReglage('seuilSilenceDb', s), {
      demarrerMicro: async () => session,
      planifier: () => 0,
      annuler: () => {},
      garderEcranAllume: async () => null,
    });
    const bip = vi.spyOn(ecoute, 'bip').mockImplementation(() => {});
    render(Accordeur, { etat: app, onQuitter: () => {}, ecoute });
    let t = 0;
    const envoyer = async (ms: number, options: OptionsEtat = {}) => {
      t += ms;
      ecoute.traiterEtat(etat(t, options));
      await tick();
    };
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.micro.demarrer }));
    expect(screen.getByRole('status').textContent?.trim()).toBe(TEXTES.micro.calibrage);
    for (let i = 0; i <= DUREE_CALIBRAGE_MS / 100; i++) await envoyer(100);
    /** La même note tenue pendant `ms` millisecondes, une mesure toutes les 50 ms. */
    const tenir = async (note: string, cents: number, ms: number) => {
      for (let ecoule = 0; ecoule <= ms; ecoule += 50) await envoyer(50, { note, cents });
    };
    return { app, ecoute, bip, envoyer, tenir };
  }

  const statut = () => screen.getByRole('status').textContent?.trim();
  const note = () => document.querySelector('.cible .note')?.textContent;

  it('suit la corde la plus proche et indique « juste » après 300 ms dans la zone verte', async () => {
    const { tenir } = await demarrer();
    expect(statut()).toBe(TEXTES.accordeur.jouez);
    await tenir('E2', 3, DUREE_JUSTE_MS - 100);
    expect(note()).toBe('Mi2 (E2)');
    expect(statut()).toBe('+3 cents');
    expect(document.querySelector('.cible span')?.textContent?.trim()).toBe('cible 82,41 Hz');
    expect(screen.getByRole('button', { name: /^6/ }).classList.contains('detectee')).toBe(true);
    await tenir('E2', 3, 100);
    expect(statut()).toBe('Juste ✓ (+3 cents)');
  });

  it('indique le sens de l’écart, et « beaucoup » au-delà de 50 cents', async () => {
    const { tenir } = await demarrer();
    await tenir('E2', 30, 0);
    expect(statut()).toBe('+30 cents · trop haut');
    await tenir('E2', -70, 0);
    expect(statut()).toBe('−70 cents · beaucoup trop bas');
  });

  it('accorde la corde choisie, même loin de la note jouée', async () => {
    const { tenir } = await demarrer();
    await fireEvent.click(screen.getByRole('button', { name: /^5/ }));
    expect(note()).toBe('La2 (A2)');
    await tenir('E2', 0, 0);
    expect(statut()).toBe('−500 cents · beaucoup trop bas');
  });

  it('change d’accordage et passe en mode chromatique', async () => {
    const { tenir } = await demarrer();
    await fireEvent.change(screen.getByRole('combobox', { name: TEXTES.accordeur.accordage }), {
      target: { value: 'drop-d' },
    });
    expect(screen.getByRole('button', { name: /^6/ }).textContent).toContain('Ré2 (D2)');
    await fireEvent.change(screen.getByRole('combobox', { name: TEXTES.accordeur.mode }), {
      target: { value: 'chromatique' },
    });
    expect(screen.queryByRole('group', { name: TEXTES.accordeur.choixCorde })).toBeNull();
    await tenir('C#3', 4, 0);
    expect(note()).toBe('Do#3 (C#3)');
    expect(statut()).toBe('+4 cents');
  });

  it('enregistre la référence A4 et le retour sonore, et bipe quand la corde devient juste', async () => {
    const { app, bip, tenir } = await demarrer();
    const champ = screen.getByRole('spinbutton');
    await fireEvent.change(champ, { target: { value: '442' } });
    expect(app.progression.reglages.a4).toBe(442);
    await fireEvent.change(champ, { target: { value: '500' } });
    expect(app.progression.reglages.a4).toBe(450);
    await fireEvent.change(champ, { target: { value: '440' } });

    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.accordeur.bip }));
    expect(app.progression.reglages.retourSonore).toBe(true);
    await tenir('A2', 0, DUREE_JUSTE_MS + 100);
    expect(statut()).toBe('Juste ✓ (0 cent)');
    expect(bip).toHaveBeenCalledOnce();
  });
});
