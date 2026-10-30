import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { debordants } from './outils';

// Parties du mode classique au clavier (mode simulation, spec §6.9) : Espace = note juste, F = fausse note.

interface Options {
  niveau?: string;
  dureeMs?: number;
  vitesseFixe?: boolean;
  /** Règle de la fausse note ; « penalite » par défaut. */
  fausseNote?: 'penalite' | 'destruction';
}

/** Ouvre le POC en simulation, règle la partie, la démarre et attend la première note (après 3 s de compte à rebours). */
async function demarrer(
  page: Page,
  { niveau = '2', dureeMs = 10000, vitesseFixe = false, fausseNote = 'penalite' }: Options = {},
) {
  await page.goto('/?simulation');
  await page.getByLabel('Mode de jeu').selectOption('classique');
  await page.getByLabel('Niveau').selectOption(niveau);
  await page.getByRole('slider').fill(String(dureeMs));
  await page.getByLabel('Fausse note').selectOption(fausseNote);
  if (vitesseFixe) {
    await page.getByText('Options de mesure').click();
    await page.getByLabel(/Vitesse fixe/).check();
  }
  await page.getByRole('button', { name: 'Démarrer (simulation)' }).click();
  await expect(page.locator('.note.attendue[data-index="1"]')).toBeVisible({ timeout: 6000 });
}

test('partie complète au clavier : 30 notes justes jusqu’à l’écran de fin', async ({ page }) => {
  await demarrer(page);
  for (let i = 1; i <= 30; i++) {
    // La note suivante apparaît à l'image qui suit la précédente : on l'attend avant de jouer.
    await expect(page.locator(`.note.attendue[data-index="${i}"]`)).toBeVisible();
    await page.keyboard.press('Space');
  }
  await expect(page.getByRole('heading', { name: 'Fin de partie' })).toBeVisible();
  await expect(page.locator('.justes')).toHaveText('30');
  await expect(page.locator('.meilleure-serie')).toHaveText('30');
  await expect(page.getByText('Aucune note à revoir.')).toBeVisible();

  await page.getByRole('button', { name: 'Rejouer' }).click();
  await expect(page.locator('.note.attendue[data-index="1"]')).toBeVisible({ timeout: 6000 });
});

test('mode « destruction » : fausse note, note juste, arrêt et export du journal', async ({ page }) => {
  await demarrer(page, { dureeMs: 8000, fausseNote: 'destruction' });
  await page.keyboard.press('f');
  await expect(page.getByRole('status')).toContainText('Fausse note');
  // Une erreur ralentit la chute de 15 % : 8 s → 9,2 s.
  await expect(page.locator('.chute')).toHaveText('9,2 s');
  await expect(page.locator('.note.attendue[data-index="2"]')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toContainText('Parfait');
  await expect(page.locator('.restantes')).toHaveText('28');

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.getByText('Partie arrêtée avant la fin.')).toBeVisible();
  await expect(page.locator('.fausses')).toHaveText('1');
  await expect(page.locator('.justes')).toHaveText('1');
  await expect(page.locator('.manquees li')).toHaveCount(1);

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/^journal-poc-chute-\d{8}-\d{4}\.json$/);
  const contenu = JSON.parse(await readFile((await telechargement.path())!, 'utf8'));
  expect(contenu).toMatchObject({ format: 'fretmap-chute-journal', version: 1 });
  expect(contenu.parties).toHaveLength(1);
  const [partie] = contenu.parties;
  expect(partie).toMatchObject({
    simulation: true,
    interrompue: true,
    reglages: { niveau: 2, dureeInitialeMs: 8000, fausseNote: 'destruction' },
  });
  expect(partie.notes.map((n: { resultat: string }) => n.resultat)).toEqual(['fausse', 'juste']);
  expect(partie.images.nombre).toBeGreaterThan(0);
});

test('mode « pénalité » (défaut) : la fausse note coûte 50 points, la note reste à jouer', async ({ page }) => {
  await demarrer(page, { dureeMs: 8000 });
  // Note 1 juste, Parfait à 8 s de chute : 100 × 1,5 × 5/8 = 94.
  await page.keyboard.press('Space');
  await expect(page.locator('.score')).toHaveText('94');
  await expect(page.locator('.note.attendue[data-index="2"]')).toBeVisible();

  await page.keyboard.press('f');
  // Tirage au hasard : la note jouée est un demi-ton au-dessus de la note attendue, quelle qu'elle soit.
  await expect(page.getByRole('status')).toHaveText(/^Fausse note : .+ · −50$/);
  await expect(page.locator('.score')).toHaveText('44');
  await expect(page.locator('.chute')).toHaveText('9,2 s');
  await expect(page.locator('.note.attendue[data-index="2"]')).toBeVisible();
  await expect(page.locator('.rappel')).toHaveCount(0);
  // À la 3e fausse note sur la même note, la bonne case reste affichée jusqu'au résultat.
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await expect(page.locator('.rappel')).toHaveCount(1);
  await expect(page.locator('.score')).toHaveText('0');
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toContainText('+');
  await expect(page.locator('.rappel')).toHaveCount(0);
  await expect(page.locator('.restantes')).toHaveText('28');

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.locator('.justes')).toHaveText('2');
  await expect(page.locator('.fausses')).toHaveText('3');
  await expect(page.locator('.manquees li')).toHaveCount(1);

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  const [partie] = JSON.parse(await readFile((await telechargement.path())!, 'utf8')).parties;
  expect(partie.reglages.fausseNote).toBe('penalite');
  expect(partie.notes.map((n: { resultat: string }) => n.resultat)).toEqual(['juste', 'juste']);
  expect(partie.notes[1].evenements.map((e: { type: string }) => e.type)).toEqual(['fausse', 'fausse', 'fausse']);
});

test('pause : manche masqué, notes ignorées, reprise après le compte à rebours', async ({ page }) => {
  await demarrer(page);
  await page.keyboard.press('p');
  const cache = page.getByRole('group', { name: 'Pause' });
  await expect(cache).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled();
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  await expect(page.locator('.restantes')).toHaveText('30');

  await cache.getByRole('button', { name: 'Reprendre' }).click();
  await expect(cache).toBeHidden({ timeout: 6000 });
  await page.keyboard.press('Space');
  await expect(page.locator('.restantes')).toHaveText('29');

  await page.getByRole('button', { name: 'Arrêter' }).click();
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  const [partie] = JSON.parse(await readFile((await telechargement.path())!, 'utf8')).parties;
  expect(partie.pauses).toHaveLength(1);
  // 1 s de pause, plus les 3 s du compte à rebours de reprise.
  expect(partie.pauses[0]).toMatchObject({ arrierePlan: false });
  expect(partie.pauses[0].dureeMs).toBeGreaterThanOrEqual(4000);
});

test('une note qui touche la ligne sans être jouée est ratée', async ({ page }) => {
  await demarrer(page, { dureeMs: 1000, vitesseFixe: true });
  await expect(page.getByRole('status')).toHaveText('Ratée', { timeout: 5000 });
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.locator('.ratees')).not.toHaveText('0');
  await expect(page.locator('.justes')).toHaveText('0');
});

test('les réglages sont repris à la visite suivante', async ({ page }) => {
  await page.goto('/?simulation');
  await page.getByLabel('Mode de jeu').selectOption('classique');
  await page.getByLabel('Niveau').selectOption('5');
  await page.getByRole('slider').fill('4500');
  await page.getByLabel('Notation des notes').selectOption('francaise');
  await page.reload();
  await expect(page.getByLabel('Niveau')).toHaveValue('5');
  await expect(page.getByRole('slider')).toHaveValue('4500');
  await expect(page.locator('.duree')).toHaveText('4,5 s');
  await expect(page.getByLabel('Notation des notes')).toHaveValue('francaise');
});

test('vider le journal après confirmation', async ({ page }) => {
  await demarrer(page);
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.getByRole('button', { name: 'Changer de niveau' }).click();
  await expect(page.getByRole('button', { name: 'Exporter le journal (1 partie)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Vider le journal' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Effacer' }).click();
  await expect(page.getByRole('status')).toHaveText('Journal vidé.');
  await expect(page.getByRole('button', { name: 'Exporter le journal (0 partie)' })).toBeDisabled();
});

test('aucun écran ne déborde horizontalement, même sur un petit téléphone (360 px)', async ({ page }) => {
  for (const largeur of [412, 360]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/?simulation');
    expect(await debordants(page), `départ à ${largeur} px`).toEqual([]);
    await demarrer(page, { niveau: '7' });
    expect(await debordants(page), `partie à ${largeur} px`).toEqual([]);
    await page.getByRole('button', { name: 'Arrêter' }).click();
    await expect(page.getByRole('heading', { name: 'Fin de partie' })).toBeVisible();
    expect(await debordants(page), `fin à ${largeur} px`).toEqual([]);
  }
});
