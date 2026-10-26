// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from '../../src/App.svelte';
import { TEXTES } from '../../src/ui/textes';

describe('accueil', () => {
  it('affiche le titre et les cinq entrées de la spec §7, encore désactivées', () => {
    render(App);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
    const boutons = screen.getAllByRole('button');
    expect(boutons.map((b) => b.querySelector('.titre')?.textContent)).toEqual([
      'Mode 1',
      'Mode 2',
      'Accordeur',
      'Statistiques',
      'Réglages',
    ]);
    expect(boutons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('propose le lien vers le POC, publié sous ./poc/', () => {
    render(App);
    expect(screen.getByRole('link').getAttribute('href')).toBe('./poc/');
  });
});
