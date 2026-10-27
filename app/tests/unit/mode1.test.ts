// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
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
    // Hasard nul : niveau 1, première question = E (corde 6 ou corde 1, à vide).
    render(Mode1, { etat, onQuitter: () => {}, hasard: () => 0 });
    return { stockage, etat };
  }

  const question = () => document.querySelector('.question')?.textContent?.replace(/\s+/g, ' ').trim();
  const caseDuManche = (nom: string) => screen.getByRole('button', { name: new RegExp(`^${nom}`) });

  it('valide la bonne case, enregistre la réponse et passe à la question suivante après 1 s', async () => {
    const { stockage, etat } = demarrer();
    expect(question()).toBe('Trouvez Mi (E)');
    await fireEvent.click(caseDuManche('Corde 6, à vide'));
    expect(screen.getByRole('status').textContent).toContain(TEXTES.mode1.juste);
    expect(document.querySelector('.score')?.textContent).toContain('1 / 1');
    expect(etat.progression.statistiques).toMatchObject([{ mode: 1, corde: 6, case: 0, tentatives: 1, reussites: 1 }]);
    expect(stockage.donnees[CLE_STOCKAGE]).toContain('"reussites":1');

    await vi.advanceTimersByTimeAsync(1000);
    // La note précédente n'est pas reposée : A.
    expect(question()).toBe('Trouvez La (A)');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('niveau 1 : accepte E sur la corde 1 et compte la réponse sur la position touchée', async () => {
    const { etat } = demarrer();
    await fireEvent.click(caseDuManche('Corde 1, à vide'));
    expect(screen.getByRole('status').textContent).toContain(TEXTES.mode1.juste);
    expect(etat.progression.statistiques).toMatchObject([{ corde: 1, case: 0, reussites: 1 }]);
  });

  it('niveau 1 : ne désigne aucune corde', () => {
    demarrer();
    expect(document.querySelector('.case.evidence')).toBeNull();
  });

  it('signale une erreur et montre les bonnes cases', async () => {
    const { etat } = demarrer();
    await fireEvent.click(caseDuManche('Corde 5, à vide'));
    expect(screen.getByRole('status').textContent).toContain('Faux : Mi (E) est la corde 6 ou la corde 1, à vide');
    for (const corde of [6, 1]) {
      expect(caseDuManche(`Corde ${corde}, à vide`).getAttribute('aria-label')).toContain(
        TEXTES.manche.marque.attendue,
      );
    }
    expect(document.querySelector('.score')?.textContent).toContain('0 / 1');
    // Réponse fausse : comptée sur la position tirée.
    expect(etat.progression.statistiques).toMatchObject([{ corde: 6, case: 0, reussites: 0 }]);
  });

  it('ignore les touchers pendant le retour', async () => {
    const { etat } = demarrer();
    await fireEvent.click(caseDuManche('Corde 6, à vide'));
    await fireEvent.click(caseDuManche('Corde 5, à vide'));
    expect(etat.progression.statistiques[0]?.tentatives).toBe(1);
  });

  it('change de niveau', async () => {
    demarrer();
    await fireEvent.change(screen.getByRole('combobox', { name: TEXTES.quiz.niveau }), { target: { value: '7' } });
    expect(screen.getAllByRole('button', { name: /^Corde 1, case/ })).toHaveLength(12);
    // Au-delà du niveau 1, la question indique la corde, mise en évidence.
    expect(question()).toBe('Trouvez Mi (E) sur la corde 6');
    expect(document.querySelectorAll('.case.evidence')).toHaveLength(13);
  });

  it('suit la notation des réglages', async () => {
    const { etat } = demarrer();
    etat.definirReglage('notation', 'anglo-saxonne');
    await tick();
    expect(question()).toBe('Trouvez E');
    etat.definirReglage('notation', 'francaise');
    await tick();
    expect(question()).toBe('Trouvez Mi');
  });

  it('affiche les notes du manche sur deux lignes avec « les deux »', async () => {
    demarrer();
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.mode1.afficherNotes }));
    const bulle = caseDuManche('Corde 6, à vide').querySelector('.note');
    expect(bulle?.firstChild?.textContent).toBe('Mi');
    expect(bulle?.querySelector('.secondaire')?.textContent).toBe('E');
    expect(caseDuManche('Corde 6, à vide').getAttribute('aria-label')).toBe('Corde 6, à vide, Mi (E)');
  });
});
