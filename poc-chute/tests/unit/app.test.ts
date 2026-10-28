// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import './resize-observer';
import App from '../../src/App.svelte';
import { ErreurMicro } from '../../src/audio/micro';
import { DUREE_CALIBRAGE_MS, MARGE_CALIBRAGE_DB } from '../../src/audio/niveau';
import { CLE_STOCKAGE } from '../../src/jeu/stockage';
import { TEXTES } from '../../src/ui/textes';
import { stockageMemoire } from './memoire';
import { microFactice } from './micro';

const titre = () => screen.queryByRole('heading', { level: 1 })?.textContent;

describe('écran de départ', () => {
  it('enregistre chaque réglage dès qu’il change', async () => {
    const stockage = stockageMemoire();
    render(App, { stockage, simulation: true });
    await fireEvent.change(screen.getByLabelText(TEXTES.depart.niveau), { target: { value: '5' } });
    await fireEvent.input(screen.getByRole('slider'), { target: { value: '4500' } });
    await fireEvent.click(screen.getByLabelText(TEXTES.depart.vitesseFixe));
    const fausseNote = screen.getByLabelText(TEXTES.depart.fausseNote) as HTMLSelectElement;
    expect(fausseNote.value).toBe('penalite');
    await fireEvent.change(fausseNote, { target: { value: 'destruction' } });
    expect(JSON.parse(stockage.donnees[CLE_STOCKAGE]!).reglages).toMatchObject({
      niveau: 5,
      dureeInitialeMs: 4500,
      vitesseFixe: true,
      fausseNote: 'destruction',
    });
    expect(screen.getByText('4,5 s')).toBeTruthy();
  });

  it('« Arrêter » pendant le compte à rebours revient au départ sans rien enregistrer', async () => {
    const stockage = stockageMemoire();
    render(App, { stockage, simulation: true });
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.depart.demarrerSimulation }));
    expect(document.querySelector('.compte')!.textContent).toContain('3');
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(titre()).toBe(TEXTES.titre);
    expect(screen.getByRole('button', { name: TEXTES.depart.exporter(0) })).toBeTruthy();
  });
});

describe('démarrage au micro', () => {
  it('Démarrer lance le micro, la mesure du bruit ambiant, puis le compte à rebours ; le seuil est enregistré', async () => {
    const stockage = stockageMemoire();
    const { dependances, analyser } = microFactice();
    render(App, { stockage, simulation: false, micro: dependances });
    expect(screen.getByText(TEXTES.micro.explication)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.depart.demarrer }));
    expect(await screen.findByText(TEXTES.micro.calibrage)).toBeTruthy();
    expect(document.querySelector('.compte')).toBeNull();

    analyser(DUREE_CALIBRAGE_MS / 100 + 1);
    await tick();
    expect(screen.queryByText(TEXTES.micro.calibrage)).toBeNull();
    expect(document.querySelector('.compte')!.textContent).toContain('3');
    // Bruit à −60 dBFS : seuil 10 dB au-dessus, gardé pour la visite suivante.
    expect(JSON.parse(stockage.donnees[CLE_STOCKAGE]!).seuilSilenceDbfs).toBeCloseTo(-60 + MARGE_CALIBRAGE_DB, 1);
    expect(screen.getByRole('meter', { name: TEXTES.indicateur.niveauSonore }).getAttribute('aria-valuenow')).toBe(
      '-60',
    );
  });

  it('un refus d’accès au micro ramène au départ avec le message', async () => {
    const refus = new ErreurMicro('Accès au micro refusé.');
    render(App, { stockage: stockageMemoire(), simulation: false, micro: microFactice(refus).dependances });
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.depart.demarrer }));
    expect((await screen.findByRole('alert')).textContent).toBe('Accès au micro refusé.');
    expect(titre()).toBe(TEXTES.titre);
  });

  it('« Arrêter » pendant la mesure du bruit ambiant revient au départ et coupe le micro', async () => {
    const { dependances, session } = microFactice();
    render(App, { stockage: stockageMemoire(), simulation: false, micro: dependances });
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.depart.demarrer }));
    await screen.findByText(TEXTES.micro.calibrage);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.partie.arreter }));
    expect(titre()).toBe(TEXTES.titre);
    expect(session.arreter).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
