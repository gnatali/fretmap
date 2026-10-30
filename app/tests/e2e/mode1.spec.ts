import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/** Éléments qui dépassent le bord droit de l'écran émulé (une liste trop large peut déborder sans faire défiler). */
async function debordants(page: Page): Promise<string[]> {
  // Largeur de l'écran émulé, pas window.innerWidth : sur mobile, la page s'élargit d'elle-même quand son contenu
  // déborde.
  return page.evaluate(
    (ecran) =>
      [...document.querySelectorAll('main *')]
        .filter((e) => e.getBoundingClientRect().right > ecran + 1)
        .map((e) => e.outerHTML.slice(0, 60)),
    page.viewportSize()!.width,
  );
}

/** Bonne case de la note attendue (`data-reponse` de la note, pour les tests). */
async function reponse(page: Page): Promise<string> {
  return (await page.locator('.note.attendue').getAttribute('data-reponse'))!;
}

const caseDuManche = (page: Page, position: string) => page.locator(`.case[data-position="${position}"]`);

async function commencer(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mode 1');
  await page.getByRole('button', { name: 'Commencer aux cordes à vide' }).click();
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 5000 });
}

test('mode 1 : case juste, case fausse, fin, record, journal exporté et statistiques', async ({ page }) => {
  await commencer(page);
  // Cordes à vide : la consigne ne donne que le nom.
  await expect(page.locator('.consigne')).toHaveText(/ · à vide$/);
  await caseDuManche(page, await reponse(page)).click();
  await expect(page.locator('.retour')).toHaveText(/^(Parfait|Bien|Juste) ! \+\d+$/);

  // Case 3 de la corde 6 (Sol) : jamais une corde à vide, donc toujours fausse au niveau 1.
  await caseDuManche(page, '6-3').click();
  await expect(page.locator('.retour')).toHaveText(/^Case fausse/);

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fin de partie');
  await expect(page.getByText('Nouveau record !')).toBeVisible();
  await expect(page.locator('.justes')).toHaveText('1');
  await expect(page.locator('.fausses')).toHaveText('1');

  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le journal' }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^journal-mode1-\d{8}-\d{4}\.json$/);
  const journal = JSON.parse(await readFile((await fichier.path())!, 'utf8'));
  expect(journal).toMatchObject({ format: 'fretmap-mode1-journal', version: 1 });
  expect(journal.parties).toHaveLength(1);
  expect(journal.parties[0].resume).toMatchObject({ essais: 1, justes: 1, fausses: 1 });

  // Après rechargement : records au départ, réponses dans les statistiques.
  await page.reload();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.locator('.records')).toHaveText(/^\d+ points · niveau 1$/);
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: /^Statistiques/ }).click();
  await expect(page.getByRole('region', { name: /^Mode 1/ }).getByText('2 réponses', { exact: false })).toBeVisible();
});

test('mode 1 : passage au niveau 2, sans débordement à 360 px, puis reprise au niveau 2', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await commencer(page);
  expect(await debordants(page)).toEqual([]);
  for (let i = 0; i < 150; i++) {
    if (await page.locator('.titre-passage').isVisible()) break;
    await caseDuManche(page, await reponse(page)).click();
    await expect(page.locator('.note.attendue').or(page.locator('.titre-passage'))).toBeVisible();
  }
  await expect(page.locator('.titre-passage')).toHaveText('Niveau 1 validé ! +500');
  await expect(page.locator('.rappel')).toHaveCount(3);
  // Le bilan sous le manche ne cache aucune nouvelle note, et rien ne déborde.
  const bilan = (await page.locator('.passage').boundingBox())!;
  for (const rappel of await page.locator('.rappel').all()) {
    const boite = (await rappel.boundingBox())!;
    expect(boite.y + boite.height).toBeLessThanOrEqual(bilan.y);
  }
  expect(await debordants(page)).toEqual([]);

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.getByRole('button', { name: 'Accueil' }).click();
  await expect(page.getByText('Niveau atteint : 2 en mode 1')).toBeVisible();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('button', { name: 'Reprendre au niveau 2 (9 notes)' })).toBeVisible();
});

test('aucun écran ne défile horizontalement, même sur un petit téléphone (360 px)', async ({ page }) => {
  for (const largeur of [412, 360]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.goto('/');
    for (const nom of [/^Mode 1/, /^Mode 2/, /^Accordeur/, /^Statistiques/, /^Réglages/]) {
      await page.getByRole('button', { name: nom }).click();
      expect(await debordants(page), `${nom} à ${largeur} px`).toEqual([]);
      await page.getByRole('button', { name: /^(Arrêter|Retour)$/ }).click();
    }
  }
});
