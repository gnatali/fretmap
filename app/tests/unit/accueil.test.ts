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
    expect(screen.getByText(TEXTES.niveauxAtteints(1, 1))).toBeTruthy();
    const boutons = screen.getAllByRole('button');
    expect(boutons.map((b) => b.querySelector('.titre')?.textContent)).toEqual([
      'Mode 1',
      'Mode 2',
      'Accordeur',
      'Statistiques',
      'Réglages',
    ]);
    expect(boutons.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('propose le lien vers le POC, publié sous ./poc/', () => {
    render(App, { stockage: stockageMemoire() });
    expect(screen.getByRole('link').getAttribute('href')).toBe('./poc/');
  });

  it('ouvre chaque écran puis revient à l’accueil', async () => {
    render(App, { stockage: stockageMemoire() });
    const ecrans = [
      { titre: TEXTES.mode1.titre, sortie: TEXTES.arreter },
      { titre: TEXTES.mode2.titre, sortie: TEXTES.arreter },
      { titre: TEXTES.accordeur.titre, sortie: TEXTES.arreter },
      { titre: TEXTES.statistiques.titre, sortie: TEXTES.retour },
      { titre: TEXTES.reglages.titre, sortie: TEXTES.retour },
    ];
    for (const { titre, sortie } of ecrans) {
      await fireEvent.click(screen.getByText(titre, { selector: '.titre' }));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(titre);
      await fireEvent.click(screen.getByRole('button', { name: sortie }));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
    }
  });

  it('statistiques : un tableau par mode', async () => {
    render(App, { stockage: stockageMemoire() });
    await fireEvent.click(screen.getByText(TEXTES.statistiques.titre, { selector: '.titre' }));
    expect(screen.getByText(TEXTES.statistiques.aucune(1))).toBeTruthy();
    expect(screen.getByText(TEXTES.statistiques.aucune(2))).toBeTruthy();
  });
});
