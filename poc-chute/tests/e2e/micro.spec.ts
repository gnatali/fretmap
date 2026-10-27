import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { debordants } from './outils';

// Partie au micro simulé par le fichier de tests/e2e/son.ts : calibrage, compte à rebours, puis E2 (juste),
// E2 (ignoré : la note précédente sonne encore), A2 (fausse) et E2 (juste).
// Math.random renvoie 0 : au niveau 2, les notes attendues sont E, F, puis E.
const NOTE_JUSTE = /^(Parfait|Bien|Juste) ! \+\d+$/;

test('partie au micro : calibrage, note juste, ancienne note, fausse note, journal', async ({ page }) => {
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  await page.getByLabel('Niveau').selectOption('2');
  await page.getByRole('slider').fill('10000');
  await page.getByText('Options de mesure').click();
  await page.getByLabel(/Vitesse fixe/).check();

  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(page.getByText('Ne jouez pas : mesure du bruit ambiant (2 s)…')).toBeVisible();
  await expect(page.locator('.note.attendue[data-index="1"]')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.consigne')).toHaveText('À jouer : Mi (E) · corde 6');
  expect(await debordants(page)).toEqual([]);

  const statut = page.getByRole('status');
  const indicateur = page.getByRole('region', { name: 'Note entendue' });
  await expect(statut).toHaveText(NOTE_JUSTE, { timeout: 10_000 });
  await expect(indicateur).toContainText('Mi2 (E2)');
  await expect(page.locator('.consigne')).toHaveText('À jouer : Fa (F) · corde 6');
  await expect(indicateur).toContainText('la note précédente sonne encore', { timeout: 10_000 });
  await expect(statut).toHaveText('Fausse note : La (A)', { timeout: 10_000 });
  await expect(statut).toHaveText(NOTE_JUSTE, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.getByRole('heading', { name: 'Fin de partie' })).toBeVisible();
  await expect(page.locator('.justes')).toHaveText('2');
  await expect(page.locator('.fausses')).toHaveText('1');
  await expect(page.locator('.ratees')).toHaveText('0');

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  const contenu = JSON.parse(await readFile((await telechargement.path())!, 'utf8'));
  const [partie] = contenu.parties;
  expect(partie).toMatchObject({ simulation: false, interrompue: true, reglages: { niveau: 2, vitesseFixe: true } });
  expect(typeof partie.seuilSilenceDbfs).toBe('number');
  expect(Array.isArray(partie.traitementsActifs)).toBe(true);
  expect(partie.notes.map((n: { resultat: string }) => n.resultat)).toEqual(['juste', 'fausse', 'juste']);
  expect(partie.notes[1]).toMatchObject({ detectee: { nom: 'A' }, evenements: [{ type: 'ancienneNote', nom: 'E' }] });
  for (const note of [partie.notes[0], partie.notes[2]]) {
    expect(note.detectee).toMatchObject({ nom: 'E', midi: 40 });
    expect(note.tAttaqueMs).toBeLessThan(note.tDetectionMs);
  }
});
