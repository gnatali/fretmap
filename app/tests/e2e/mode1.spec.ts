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
  await expect(page.locator('.difficulte')).toHaveText('Normal');
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
  // Nouvelles notes : bulles posées sur leur case. Le bilan sous le manche n'en cache aucune, et rien ne déborde.
  const bulles = page.locator('.note.presentee');
  await expect(bulles).toHaveCount(3);
  const bilan = (await page.locator('.passage').boundingBox())!;
  for (const bulle of await bulles.all()) {
    const boite = (await bulle.boundingBox())!;
    expect(boite.y + boite.height).toBeLessThanOrEqual(bilan.y);
    // Chaque bulle est sur sa case.
    const caseBulle = (await caseDuManche(page, (await bulle.getAttribute('data-position'))!).boundingBox())!;
    expect(Math.abs(boite.x + boite.width / 2 - (caseBulle.x + caseBulle.width / 2))).toBeLessThan(2);
    expect(Math.abs(boite.y + boite.height / 2 - (caseBulle.y + caseBulle.height / 2))).toBeLessThan(6);
  }
  expect(await debordants(page)).toEqual([]);

  // « Continuer » : le bilan disparaît, compte à rebours avec les bulles, puis la première note du niveau 2.
  await page.getByRole('button', { name: 'Continuer au niveau 2' }).click();
  await expect(page.locator('.passage')).toHaveCount(0);
  await expect(page.locator('.compte')).toBeVisible();
  await expect(bulles).toHaveCount(3);
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 5000 });
  await expect(bulles).toHaveCount(0);

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.getByRole('button', { name: 'Accueil' }).click();
  await expect(page.getByText('Niveau atteint : 2 en mode 1')).toBeVisible();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('button', { name: 'Reprendre au niveau 2 (9 notes)' })).toBeVisible();
});

test('mode 1 : difficulté choisie, gardée après rechargement, et record propre à cette difficulté', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await page.getByRole('radio', { name: /^Difficile/ }).check();
  await page.reload();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.getByRole('radio', { name: /^Difficile/ })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Records en difficile' })).toBeVisible();
  await expect(page.locator('.records')).toHaveText('Pas encore de partie.');
  expect(await debordants(page)).toEqual([]);

  await page.getByRole('button', { name: 'Commencer aux cordes à vide' }).click();
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 5000 });
  await caseDuManche(page, await reponse(page)).click();
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.locator('.difficulte')).toHaveText('Difficile');
  await expect(page.getByText('Nouveau record !')).toBeVisible();
  await page.getByRole('button', { name: 'Accueil' }).click();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await expect(page.locator('.records')).toHaveText(/^\d+ points · niveau 1$/);
  await page.getByRole('radio', { name: /^Normal/ }).check();
  await expect(page.locator('.records')).toHaveText('Pas encore de partie.');
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
