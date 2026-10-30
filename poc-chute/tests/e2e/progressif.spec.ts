import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { debordants } from './outils';

// Mode progressif au clavier (simulation, spec §16) : Espace = note juste, F = fausse note.
test('mode progressif : note immobile, passage au niveau 2, note perdue, reprise et journal', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?simulation');
  await expect(page.getByLabel('Mode de jeu')).toHaveValue('progressif');
  expect(await debordants(page)).toEqual([]);
  await page.getByRole('button', { name: 'Commencer aux cordes à vide (simulation)' }).click();

  // Vitesse 0 : la note reste en haut.
  const attendue = page.locator('.note.attendue');
  await expect(attendue).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.niveau')).toHaveText('1');
  await expect(page.locator('.vitesse')).toHaveText('0 %');
  const position = await attendue.getAttribute('style');
  await page.waitForTimeout(800);
  expect(await attendue.getAttribute('style')).toBe(position);
  expect(await debordants(page)).toEqual([]);

  // Notes justes jusqu'au passage : bilan, nouvelles notes entourées sur le manche, reprise à vitesse 0.
  const passage = page.getByText('Niveau 1 validé ! +500');
  for (let i = 0; i < 100 && !(await passage.isVisible()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
  }
  await expect(passage).toBeVisible();
  await expect(page.locator('.passage li')).toHaveText([
    'Fa (F) · corde 6, case 1',
    'Do (C) · corde 2, case 1',
    'Fa (F) · corde 1, case 1',
  ]);
  await expect(page.locator('.rappel')).toHaveCount(3);
  await expect(page.locator('.niveau')).toHaveText('2');
  await expect(passage).toBeHidden({ timeout: 8000 });
  await expect(page.locator('.vitesse')).toHaveText('0 %');

  // Trois fausses notes : la note est perdue.
  await expect(attendue).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.getByRole('status')).toContainText('Fausse note');
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await expect(page.getByRole('status')).toContainText('Perdue');

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.getByRole('heading', { name: 'Fin de partie' })).toBeVisible();
  await expect(page.locator('.niveaux')).toHaveText('1 → 2');
  await expect(page.locator('.perdues')).toHaveText('1');
  await expect(page.locator('.notes tbody tr')).toHaveCount(9);
  expect(await debordants(page)).toEqual([]);

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  const [partie] = JSON.parse(await readFile((await telechargement.path())!, 'utf8')).parties;
  expect(partie).toMatchObject({ mode: 'progressif', simulation: true, niveauDepart: 1 });
  expect(partie.resume).toMatchObject({ niveauAtteint: 2, perdues: 1, fausses: 3 });
  expect(partie.passages).toHaveLength(1);
  expect(partie.essais.length).toBeGreaterThanOrEqual(18);
  expect(Object.keys(partie.essais[0].globales)).toEqual(['score', 'taux', 'temps']);

  // Reprise au niveau atteint.
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre au niveau 2 (9 notes) (simulation)' })).toBeVisible();
});
