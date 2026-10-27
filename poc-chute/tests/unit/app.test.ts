// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import './resize-observer';
import App from '../../src/App.svelte';
import { CLE_STOCKAGE } from '../../src/jeu/stockage';
import { TEXTES } from '../../src/ui/textes';
import { stockageMemoire } from './memoire';

describe('écran de départ', () => {
  it('sans simulation, le jeu au micro n’est pas encore ouvert : lien vers la simulation', () => {
    render(App, { stockage: stockageMemoire(), simulation: false });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
    expect((screen.getByRole('button', { name: TEXTES.depart.demarrer }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: TEXTES.depart.lienSimulation }).getAttribute('href')).toBe('?simulation');
  });

  it('enregistre chaque réglage dès qu’il change', async () => {
    const stockage = stockageMemoire();
    render(App, { stockage, simulation: true });
    await fireEvent.change(screen.getByLabelText(TEXTES.depart.niveau), { target: { value: '5' } });
    await fireEvent.input(screen.getByRole('slider'), { target: { value: '4500' } });
    await fireEvent.click(screen.getByLabelText(TEXTES.depart.vitesseFixe));
    expect(JSON.parse(stockage.donnees[CLE_STOCKAGE]!).reglages).toMatchObject({
      niveau: 5,
      dureeInitialeMs: 4500,
      vitesseFixe: true,
    });
    expect(screen.getByText('4,5 s')).toBeTruthy();
  });

  it('« Arrêter » pendant le compte à rebours revient au départ sans rien enregistrer', async () => {
    const stockage = stockageMemoire();
    render(App, { stockage, simulation: true });
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.depart.demarrerSimulation }));
    expect(document.querySelector('.compte')!.textContent).toContain('3');
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TEXTES.titre);
    expect(screen.getByRole('button', { name: TEXTES.depart.exporter(0) })).toBeTruthy();
  });
});
