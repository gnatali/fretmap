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

  // La vitesse monte avec les notes justes, jusqu'au plafond du niveau 1 : 30 %.
  const vitesse = page.locator('.vitesse');
  for (let i = 0; i < 10 && (await vitesse.textContent()) !== '30 %'; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  await expect(vitesse).toHaveText('30 %');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  await expect(vitesse).toHaveText('30 %');

  // Notes justes jusqu'au passage : bilan, nouvelles notes entourées sur le manche, vitesse max du niveau 2, reprise
  // à vitesse 0.
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
  await expect(page.locator('.passage .plafond')).toHaveText('Vitesse max du niveau : 35 %');
  await expect(page.locator('.rappel')).toHaveCount(3);
  // Le cadre du passage est sous le manche : il ne cache aucune nouvelle note entourée.
  const cadre = (await page.locator('.passage').boundingBox())!;
  for (const rappel of await page.locator('.rappel').all()) {
    const boite = (await rappel.boundingBox())!;
    expect(boite.y + boite.height).toBeLessThanOrEqual(cadre.y);
  }
  expect(await debordants(page)).toEqual([]);
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
  expect(partie.passages).toMatchObject([{ niveau: 2, plafond: 0.35 }]);
  expect(partie.resume.vitesseMax).toBe(0.3);
  expect(partie.essais.length).toBeGreaterThanOrEqual(18);
  expect(Object.keys(partie.essais[0].globales)).toEqual(['score', 'taux', 'temps']);

  // Reprise au niveau atteint.
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre au niveau 2 (9 notes) (simulation)' })).toBeVisible();
});

test('passage sur un petit téléphone (360 px) : le cadre ne cache pas les nouvelles notes, rien ne déborde', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 640 });
  // Reprise au niveau 6 (21 notes, jusqu'à la case 4) : son passage ajoute deux notes en case 5, en bas du manche.
  const positions = ['6/0', '5/0', '4/0', '3/0', '2/0', '1/0', '6/1', '2/1', '1/1', '5/2', '4/2', '3/2', '6/3']
    .concat(['5/3', '4/3', '2/3', '1/3', '5/1', '4/1', '3/1', '3/4'])
    .map((p) => ({ corde: Number(p[0]), case: Number(p[2]) }));
  await page.goto('/?simulation');
  await page.evaluate((donnees) => localStorage.setItem('fretmap-chute.v1', JSON.stringify(donnees)), {
    version: 1,
    progressif: { niveau: 6, positions },
  });
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre au niveau 6 (21 notes) (simulation)' }).click();
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 6000 });
  const passage = page.getByText(/^Niveau 6 validé/);
  for (let i = 0; i < 400 && !(await passage.isVisible()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(40);
  }
  await expect(passage).toBeVisible();
  await expect(page.locator('.rappel')).toHaveCount(3);
  const cadre = (await page.locator('.passage').boundingBox())!;
  for (const rappel of await page.locator('.rappel').all()) {
    const boite = (await rappel.boundingBox())!;
    expect(boite.y + boite.height).toBeLessThanOrEqual(cadre.y);
  }
  // Score à 5 chiffres et multiplicateur : les compteurs passent sur deux lignes au besoin.
  expect(Number((await page.locator('.score').textContent())!.split(' ')[0])).toBeGreaterThanOrEqual(10_000);
  expect(await debordants(page)).toEqual([]);
});
