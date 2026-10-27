// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from '../../src/App.svelte';
import { TEXTES } from '../../src/ui/textes';
import { stockageMemoire } from './memoire';

describe('accueil', () => {
  it('affiche le titre, le niveau et les cinq entrées de la spec §7', () => {
    render(App, { stockage: stockageMemoire() });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
    expect(screen.getByText(TEXTES.niveauActuel(1))).toBeTruthy();
    const boutons = screen.getAllByRole('button');
    expect(boutons.map((b) => b.querySelector('.titre')?.textContent)).toEqual([
      'Mode 1',
      'Mode 2',
      'Accordeur',
      'Statistiques',
      'Réglages',
    ]);
    expect(boutons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, false, true, false, true]);
  });

  it('propose le lien vers le POC, publié sous ./poc/', () => {
    render(App, { stockage: stockageMemoire() });
    expect(screen.getByRole('link').getAttribute('href')).toBe('./poc/');
  });

  it('ouvre les modes 1 et 2 et les statistiques, puis revient à l’accueil', async () => {
    render(App, { stockage: stockageMemoire() });
    for (const mode of [TEXTES.mode1.titre, TEXTES.mode2.titre]) {
      await fireEvent.click(screen.getByText(mode, { selector: '.titre' }));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(mode);
      await fireEvent.click(screen.getByRole('button', { name: TEXTES.arreter }));
    }
    await fireEvent.click(screen.getByText('Statistiques', { selector: '.titre' }));
    expect(screen.getByText(TEXTES.statistiques.aucune(1))).toBeTruthy();
    expect(screen.getByText(TEXTES.statistiques.aucune(2))).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.retour }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
  });
});
