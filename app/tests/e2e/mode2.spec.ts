import { expect, test } from '@playwright/test';

// Micro simulé par le fichier de tests/e2e/son.ts : calibrage, puis E2 (juste), D3 (fausse) et A2 (juste).
// Math.random renvoie 0 : niveau 1, la première question est E, la deuxième A.
test('mode 2 : calibrage, une note juste, une fausse, puis les statistiques', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Mode 2/ }).click();
  await expect(page.locator('.question')).toContainText('Jouez Mi (E) à vide');

  await page.getByRole('button', { name: 'Démarrer le micro' }).click();
  const statut = page.getByRole('status');
  await expect(statut).toContainText('mesure du bruit ambiant');
  await expect(page.getByRole('button', { name: 'Couper le micro' })).toBeVisible();

  await expect(statut).toContainText('Juste : Mi2 (E2)', { timeout: 10_000 });
  await expect(page.locator('.question')).toContainText('Jouez La (A) à vide');
  await expect(statut).toContainText('Faux : vous avez joué Ré3 (D3)', { timeout: 10_000 });
  await expect(statut).toContainText('Juste : La2 (A2)', { timeout: 10_000 });
  await expect(page.locator('.score')).toContainText('2 / 3');
  await expect(page.getByRole('listitem')).toHaveCount(3);

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.getByRole('button', { name: /^Statistiques/ }).click();
  const mode2 = page.getByRole('region', { name: /^Mode 2/ });
  await expect(mode2.getByText('3 réponses')).toBeVisible();
  await expect(mode2.getByRole('cell', { name: 'Corde 5, à vide : 50 % sur 2 réponses' })).toBeVisible();
});
