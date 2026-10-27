// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionMicro } from '../../src/audio/micro';
import { DUREE_CALIBRAGE_MS } from '../../src/audio/niveau';
import { Ecoute } from '../../src/ecoute.svelte';
import { EtatApp } from '../../src/etat.svelte';
import { avancementInitial, progressionInitiale } from '../../src/progression/modele';
import { CLE_STOCKAGE, exporterJson } from '../../src/progression/stockage';
import Reglages from '../../src/ui/ecrans/Reglages.svelte';
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

describe('réglages', () => {
  afterEach(() => vi.restoreAllMocks());

  function afficher() {
    const stockage = stockageMemoire();
    const app = new EtatApp(stockage);
    const ecoute = new Ecoute(app.progression.reglages, (s) => app.definirReglage('seuilSilenceDb', s), {
      demarrerMicro: async () => session,
      planifier: () => 0,
      annuler: () => {},
      garderEcranAllume: async () => null,
    });
    render(Reglages, { etat: app, onQuitter: () => {}, ecoute });
    return { app, stockage, ecoute };
  }

  it('enregistre chaque réglage dès qu’il change', async () => {
    const { app, stockage } = afficher();
    await fireEvent.change(screen.getByRole('combobox', { name: TEXTES.reglages.notation }), {
      target: { value: 'francaise' },
    });
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.reglages.afficherNotes }));
    await fireEvent.click(screen.getByRole('radio', { name: TEXTES.reglages.tolerances[20] }));
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.reglages.octaveStricte }));
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.reglages.afficherCaseMode2 }));
    await fireEvent.click(screen.getByRole('checkbox', { name: TEXTES.reglages.retourSonore }));
    // La notation choisie s'applique aussitôt, jusque dans le libellé de la référence.
    const a4 = screen.getByRole('spinbutton', { name: TEXTES.reglages.a4('La4') });
    await fireEvent.change(a4, { target: { value: '432' } });
    expect(app.progression.reglages).toMatchObject({
      notation: 'francaise',
      afficherNotes: true,
      tolerance: 20,
      octaveStricte: true,
      afficherCaseMode2: true,
      retourSonore: true,
      a4: 432,
    });
    expect(JSON.parse(stockage.donnees[CLE_STOCKAGE]!).reglages.tolerance).toBe(20);
    await fireEvent.change(a4, { target: { value: '420' } });
    expect(app.progression.reglages.a4).toBe(430);
  });

  it('mesure le bruit ambiant, enregistre le seuil et coupe le micro', async () => {
    const { app, ecoute } = afficher();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.mesurer }));
    expect(screen.getByText(TEXTES.reglages.mesureEnCours)).toBeTruthy();
    for (let t = 0; t <= DUREE_CALIBRAGE_MS; t += 100) ecoute.traiterEtat(etat(t, { niveauDbfs: -62 }));
    await tick();
    await waitFor(() => expect(ecoute.statut).toBe('arrete'));
    expect(app.progression.reglages.seuilSilenceDb).toBe(-52);
    expect(screen.getByText(TEXTES.reglages.mesureFaite(-52))).toBeTruthy();
    expect(screen.getByText(TEXTES.reglages.seuil(-52))).toBeTruthy();
  });

  it('exporte la progression dans un fichier JSON daté', async () => {
    const { app } = afficher();
    let contenu: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      contenu = blob;
      return 'blob:progression';
    });
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^fretmap-progression-\d{4}-\d{2}-\d{2}\.json$/);
      expect(this.href).toBe('blob:progression');
    });
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.exporter }));
    expect(clic).toHaveBeenCalledOnce();
    expect(JSON.parse(await contenu!.text())).toEqual(JSON.parse(exporterJson(app.progression)));
  });

  it('importe une progression exportée après confirmation, et refuse un autre fichier', async () => {
    const { app } = afficher();
    const champ = screen.getByLabelText(TEXTES.reglages.importer, { selector: 'input' });

    await fireEvent.change(champ, { target: { files: [new File(['bonjour'], 'autre.json')] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(TEXTES.reglages.importInvalide));

    const fichier = { ...progressionInitiale(), avancement: { 1: avancementInitial(3), 2: avancementInitial(2) } };
    await fireEvent.change(champ, { target: { files: [new File([exporterJson(fichier)], 'p.json')] } });
    await waitFor(() => expect(screen.getByText(TEXTES.reglages.confirmerImport)).toBeTruthy());
    expect(app.progression.avancement[1].niveauAtteint).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.remplacer }));
    expect(app.progression.avancement).toEqual(fichier.avancement);
    expect(screen.getByText(TEXTES.reglages.importFait)).toBeTruthy();
  });

  it('réinitialise la progression après confirmation, en gardant les réglages', async () => {
    const { app } = afficher();
    app.repondre({ mode: 1, position: { corde: 6, case: 0 }, juste: true, tempsMs: 900, date: new Date() }, 1);
    app.definirReglage('notation', 'anglo-saxonne');
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.reinitialiser }));
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.annuler }));
    expect(app.progression.statistiques).toHaveLength(1);

    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.reinitialiser }));
    expect(screen.getByText(TEXTES.reglages.confirmerReinitialisation)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: TEXTES.reglages.effacer }));
    expect(app.progression.statistiques).toEqual([]);
    expect(app.progression.reglages.notation).toBe('anglo-saxonne');
    expect(screen.getByText(TEXTES.reglages.reinitialisationFaite)).toBeTruthy();
  });
});
