import { expect, test, type Page } from '@playwright/test';

/** Cordes à vide de l'accordage standard, par nom de note (niveau 1). */
const CORDES_A_VIDE: Record<string, number[]> = { E: [6, 1], A: [5], D: [4], G: [3], B: [2] };

/** Note demandée par la question, affichée par défaut dans les deux notations (« Trouvez Mi (E) »). */
async function noteDemandee(page: Page): Promise<string> {
  const texte = await page.locator('.question .nom').innerText();
  const m = /^(Do|Ré|Mi|Fa|Sol|La|Si)#? \(([A-G]#?)\)$/.exec(texte);
  expect(m, `notation « les deux » attendue : ${texte}`).not.toBeNull();
  return m![2]!;
}

test('mode 1 : une bonne réponse, une mauvaise, puis les statistiques après rechargement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mode 1');

  // Niveau 1 : la question ne donne que la note ; toute corde à vide qui la donne est juste.
  const premiere = await noteDemandee(page);
  await expect(page.locator('.question')).not.toContainText('corde');
  const corde = CORDES_A_VIDE[premiere]![0]!;
  await page.getByRole('button', { name: `Corde ${corde}, à vide`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Juste');

  await expect(page.getByRole('status')).toHaveText('', { timeout: 3000 });
  const seconde = await noteDemandee(page);
  const fausse = [6, 5, 4, 3, 2, 1].find((c) => !CORDES_A_VIDE[seconde]!.includes(c))!;
  await page.getByRole('button', { name: `Corde ${fausse}, à vide`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Faux');
  await expect(page.locator('.score')).toContainText('1 / 2');

  await page.reload();
  await page.getByRole('button', { name: /^Statistiques/ }).click();
  await expect(page.getByText('2 réponses')).toBeVisible();
  await expect(page.getByRole('cell', { name: `Corde ${corde}, à vide : 100 %` })).toBeVisible();
});

test('aucun écran ne défile horizontalement, même sur un petit téléphone (360 px)', async ({ page }) => {
  for (const largeur of [412, 360]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    for (const nom of [/^Mode 1/, /^Mode 2/, /^Accordeur/, /^Statistiques/, /^Réglages/]) {
      await page.getByRole('button', { name: nom }).click();
      // Aucun élément ne dépasse le bord droit (une liste trop large peut déborder sans faire défiler la page).
      // Largeur de l'écran émulé, pas window.innerWidth : sur mobile, la page s'élargit d'elle-même quand son contenu
      // déborde.
      const debordants = await page.evaluate(
        (ecran) =>
          [...document.querySelectorAll('main *')]
            .filter((e) => e.getBoundingClientRect().right > ecran + 1)
            .map((e) => e.outerHTML.slice(0, 60)),
        page.viewportSize()!.width,
      );
      expect(debordants, `${nom} à ${largeur} px`).toEqual([]);
      await page.getByRole('button', { name: /^(Arrêter|Retour)$/ }).click();
    }
  }
});
