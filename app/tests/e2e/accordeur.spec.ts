import { expect, test } from '@playwright/test';

// Micro simulé par le fichier de tests/e2e/son.ts : après le calibrage, un E2 juste tenu 1,5 s.
test('accordeur : calibrage puis corde de mi grave juste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Accordeur/ }).click();
  await page.getByRole('button', { name: 'Démarrer le micro' }).click();
  const statut = page.getByRole('status');
  await expect(statut).toContainText('mesure du bruit ambiant');
  await expect(statut).toContainText('Jouez une corde', { timeout: 5_000 });
  await expect(statut).toContainText('Juste ✓', { timeout: 10_000 });
  await expect(page.locator('.cible .note')).toHaveText('Mi2 (E2)');
  await expect(page.getByRole('button', { name: /^6/ })).toHaveClass(/detectee/);
  // Largeur de l'écran émulé, pas window.innerWidth, que la page élargit d'elle-même sur mobile quand elle déborde.
  const ecran = page.viewportSize()!.width;
  expect(await page.evaluate((ecran) => document.documentElement.scrollWidth <= ecran, ecran)).toBe(true);
});
