import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('réglages : modification et persistance après rechargement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await page.getByRole('combobox', { name: 'Notation des notes' }).selectOption('anglo-saxonne');
  await page.getByRole('radio', { name: '±30 cents' }).check();
  await page.getByRole('checkbox', { name: /^Octave stricte/ }).check();

  await page.reload();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('combobox', { name: 'Notation des notes' })).toHaveValue('anglo-saxonne');
  await expect(page.getByRole('radio', { name: '±30 cents' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Octave stricte/ })).toBeChecked();

  // La notation s'applique aux autres écrans.
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await page.getByRole('button', { name: 'Commencer aux cordes à vide' }).click();
  await expect(page.locator('.consigne')).toHaveText(/^[A-G]#? · à vide$/, { timeout: 5000 });
});

test('progression : export JSON, réinitialisation puis import', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  // Une réponse juste au mode 1 (niveau 1, question E).
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await page.getByRole('button', { name: 'Commencer aux cordes à vide' }).click();
  await expect(page.locator('.consigne')).toHaveText('Mi (E) · à vide', { timeout: 5000 });
  await page.getByRole('button', { name: 'Corde 6, à vide', exact: true }).click();
  await expect(page.locator('.retour')).toContainText('!');
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.getByRole('button', { name: 'Accueil' }).click();

  await page.getByRole('button', { name: /^Réglages/ }).click();
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la progression' }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^fretmap-progression-\d{4}-\d{2}-\d{2}\.json$/);
  const contenu = await readFile((await fichier.path())!, 'utf8');
  expect(JSON.parse(contenu).statistiques).toHaveLength(1);

  await page.getByRole('button', { name: 'Réinitialiser la progression' }).click();
  await page.getByRole('button', { name: 'Effacer' }).click();
  await expect(page.getByText('Progression réinitialisée.')).toBeVisible();

  await page
    .getByLabel('Importer une progression', { exact: true })
    .and(page.locator('input'))
    .setInputFiles({ name: 'progression.json', mimeType: 'application/json', buffer: Buffer.from(contenu) });
  await page.getByRole('button', { name: 'Remplacer' }).click();
  await expect(page.getByText('Progression importée.')).toBeVisible();

  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: /^Statistiques/ }).click();
  await expect(page.getByRole('region', { name: /^Mode 1/ }).getByText('1 réponse', { exact: false })).toBeVisible();
});
