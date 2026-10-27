import { expect, test, type Page } from '@playwright/test';

/** Numéro de corde de la question affichée (« Trouvez E sur la corde 6 »). */
async function cordeDemandee(page: Page): Promise<number> {
  const texte = await page.locator('.question').innerText();
  return Number(/corde (\d)/.exec(texte)?.[1]);
}

test('mode 1 : une bonne réponse, une mauvaise, puis les statistiques après rechargement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mode 1');

  // Niveau 1 : cordes à vide, la bonne case est la case 0 de la corde demandée.
  const premiere = await cordeDemandee(page);
  await page.getByRole('button', { name: `Corde ${premiere}, à vide`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Juste');

  await expect(page.getByRole('status')).toHaveText('', { timeout: 3000 });
  const seconde = await cordeDemandee(page);
  const autre = seconde === 1 ? 2 : 1;
  await page.getByRole('button', { name: `Corde ${autre}, à vide`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Faux');
  await expect(page.locator('.score')).toContainText('1 / 2');

  await page.reload();
  await page.getByRole('button', { name: /^Statistiques/ }).click();
  await expect(page.getByText('2 réponses')).toBeVisible();
  await expect(page.getByRole('cell', { name: `Corde ${premiere}, à vide : 100 %` })).toBeVisible();
});

test('accueil : pas de défilement horizontal sur téléphone', async ({ page }) => {
  await page.goto('/');
  for (const nom of [/^Mode 1/, /^Statistiques/]) {
    await page.getByRole('button', { name: nom }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Arrêter|Retour/ }).click();
  }
});
