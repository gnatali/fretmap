import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { debordants } from './outils';

// Partie au micro simulé par le fichier de tests/e2e/son.ts, en mode « pénalité » (défaut) : calibrage, compte à
// rebours, puis E2 (juste), E2 (ignoré : la note précédente sonne encore), A2 (fausse : la note F reste à jouer) et
// F2 (juste). Math.random renvoie 0 : au niveau 2, les notes attendues sont E, puis F.
// Sous charge, le son simulé peut avoir une coupure : la chaîne de détection (copie de l'application) y voit une
// nouvelle attaque et recompte la note qui sonne encore. Le test admet donc des fausses notes de plus, toutes
// pénalisées, mais exige l'ancienne note ignorée, la fausse note La et la note F jouée juste.
const NOTE_JUSTE = /^(Parfait|Bien|Juste) ! \+\d+$/;

test('partie au micro : calibrage, note juste, ancienne note, fausse note pénalisée, journal', async ({ page }) => {
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto('/');
  await page.getByLabel('Mode de jeu').selectOption('classique');
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
  await expect(statut).toHaveText(/^Fausse note : La \(A\)/, { timeout: 10_000 });
  await expect(page.locator('.consigne')).toHaveText('À jouer : Fa (F) · corde 6');
  await expect(statut).toHaveText(NOTE_JUSTE, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Arrêter' }).click();
  await expect(page.getByRole('heading', { name: 'Fin de partie' })).toBeVisible();
  await expect(page.locator('.justes')).toHaveText('2');
  await expect(page.locator('.fausses')).not.toHaveText('0');
  await expect(page.locator('.ratees')).toHaveText('0');
  await expect(page.locator('.manquees li')).toContainText('Fa (F)');

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le journal' }).click(),
  ]);
  const contenu = JSON.parse(await readFile((await telechargement.path())!, 'utf8'));
  const [partie] = contenu.parties;
  expect(partie).toMatchObject({
    simulation: false,
    interrompue: true,
    reglages: { niveau: 2, vitesseFixe: true, fausseNote: 'penalite' },
  });
  expect(typeof partie.seuilSilenceDbfs).toBe('number');
  expect(Array.isArray(partie.traitementsActifs)).toBe(true);
  expect(partie.notes.map((n: { resultat: string }) => n.resultat)).toEqual(['juste', 'juste']);
  expect(partie.notes[0].detectee).toMatchObject({ nom: 'E', midi: 40 });
  const [ancienne, ...fausses] = partie.notes[1].evenements;
  expect(partie.notes[1].detectee).toMatchObject({ nom: 'F', midi: 41 });
  expect(ancienne).toMatchObject({ type: 'ancienneNote', nom: 'E' });
  expect(fausses.length).toBeGreaterThanOrEqual(1);
  expect(fausses.every((e: { type: string }) => e.type === 'fausse')).toBe(true);
  // La première note a rapporté au moins 50 points : la première pénalité est entière.
  expect(fausses.find((e: { nom: string }) => e.nom === 'A')).toBeDefined();
  expect(fausses[0].penalite).toBe(50);
  for (const note of partie.notes) expect(note.tAttaqueMs).toBeLessThan(note.tDetectionMs);
  expect(partie.resume).toMatchObject({ justes: 2, fausses: fausses.length, ratees: 0 });
});
