// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtatApp } from '../../src/etat.svelte';
import { CLE_STOCKAGE } from '../../src/progression/stockage';
import Mode1 from '../../src/ui/ecrans/Mode1.svelte';
import { TEXTES } from '../../src/ui/textes';
import { stockageMemoire } from './memoire';

describe('mode 1', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function demarrer() {
    const stockage = stockageMemoire();
    const etat = new EtatApp(stockage);
    // Hasard nul : niveau 1, première question = corde 6 à vide (E).
    render(Mode1, { etat, onQuitter: () => {}, hasard: () => 0 });
    return { stockage, etat };
  }

  const question = () => document.querySelector('.question')?.textContent?.replace(/\s+/g, ' ').trim();
  const caseDuManche = (nom: string) => screen.getByRole('button', { name: new RegExp(`^${nom}`) });

  it('valide la bonne case, enregistre la réponse et passe à la question suivante après 1 s', async () => {
    const { stockage, etat } = demarrer();
    expect(question()).toBe('Trouvez E sur la corde 6');
    await fireEvent.click(caseDuManche('Corde 6, à vide'));
    expect(screen.getByRole('status').textContent).toContain(TEXTES.mode1.juste);
    expect(document.querySelector('.score')?.textContent).toContain('1 / 1');
    expect(etat.progression.statistiques).toMatchObject([{ mode: 1, corde: 6, case: 0, tentatives: 1, reussites: 1 }]);
    expect(stockage.donnees[CLE_STOCKAGE]).toContain('"reussites":1');

    await vi.advanceTimersByTimeAsync(1000);
    // La question précédente n'est pas reposée : corde 5 à vide (A).
    expect(question()).toBe('Trouvez A sur la corde 5');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('signale une erreur et montre la bonne case', async () => {
    demarrer();
    await fireEvent.click(caseDuManche('Corde 5, à vide'));
    expect(screen.getByRole('status').textContent).toContain(TEXTES.mode1.faux('E', [0]));
    expect(caseDuManche('Corde 6, à vide').getAttribute('aria-label')).toContain(TEXTES.manche.marque.attendue);
    expect(document.querySelector('.score')?.textContent).toContain('0 / 1');
  });

  it('ignore les touchers pendant le retour', async () => {
    const { etat } = demarrer();
    await fireEvent.click(caseDuManche('Corde 6, à vide'));
    await fireEvent.click(caseDuManche('Corde 5, à vide'));
    expect(etat.progression.statistiques[0]?.tentatives).toBe(1);
  });

  it('change de niveau', async () => {
    demarrer();
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(screen.getAllByRole('button', { name: /^Corde 1, case/ })).toHaveLength(12);
  });
});
