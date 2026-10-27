import { expect, test } from '@playwright/test';

test('la page du POC s’ouvre sans erreur', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Notes qui tombent · fretmap');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notes qui tombent');
  await expect(page.getByRole('link', { name: 'Retour à l’application' })).toHaveAttribute('href', '../');
  expect(erreurs).toEqual([]);
});

test('Démarrer lance le jeu au micro ; « ?simulation » le remplace par le clavier', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeEnabled();
  await expect(page.getByText(/ne jouez pas pendant 2 s/)).toBeVisible();
  await page.goto('/?simulation');
  await expect(page.getByRole('button', { name: 'Démarrer (simulation)' })).toBeEnabled();
});
