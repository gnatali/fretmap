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

type Rectangle = { x: number; y: number; width: number; height: number };

/** Deux rectangles se recouvrent-ils (bords qui se touchent exclus) ? */
const croise = (a: Rectangle, b: Rectangle) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Joue la bonne case de chaque note jusqu'au bilan du passage de niveau. */
async function jouerJusquAuPassage(page: Page): Promise<void> {
  for (let i = 0; i < 150; i++) {
    if (await page.locator('.titre-passage').isVisible()) break;
    await caseDuManche(page, await reponse(page)).click();
    await expect(page.locator('.note.attendue').or(page.locator('.titre-passage'))).toBeVisible();
  }
  await expect(page.locator('.titre-passage')).toBeVisible();
}

/** Le bilan, posé sur le manche, ne cache aucune nouvelle note ; chaque bulle est sur sa case. */
async function verifierBulles(page: Page, nombre: number): Promise<Rectangle[]> {
  const bulles = page.locator('.note.presentee');
  await expect(bulles).toHaveCount(nombre);
  const bilan = (await page.locator('.passage').boundingBox())!;
  const boites: Rectangle[] = [];
  for (const bulle of await bulles.all()) {
    const boite = (await bulle.boundingBox())!;
    expect(croise(boite, bilan)).toBe(false);
    const caseBulle = (await caseDuManche(page, (await bulle.getAttribute('data-position'))!).boundingBox())!;
    expect(Math.abs(boite.x + boite.width / 2 - (caseBulle.x + caseBulle.width / 2))).toBeLessThan(2);
    expect(Math.abs(boite.y + boite.height / 2 - (caseBulle.y + caseBulle.height / 2))).toBeLessThan(6);
    boites.push(boite);
  }
  return boites;
}

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
  const manche = (await page.locator('.plateau').boundingBox())!;
  await jouerJusquAuPassage(page);
  await expect(page.locator('.titre-passage')).toHaveText('Niveau 1 validé ! +500');
  // Nouvelles notes (case 1) : bulles posées sur leur case. Le bilan, posé sur le manche en dessous, n'en cache aucune ;
  // le manche garde sa taille, et rien ne déborde.
  const bulles = page.locator('.note.presentee');
  const boites = await verifierBulles(page, 3);
  const bilan = (await page.locator('.passage').boundingBox())!;
  for (const boite of boites) expect(boite.y + boite.height).toBeLessThanOrEqual(bilan.y);
  await verifierCadre(page, 2);
  expect((await page.locator('.plateau').boundingBox())!).toEqual(manche);
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

/**
 * Reprise d'un niveau de 3 notes (enregistré au niveau 2, en normal) et jeu jusqu'au passage.
 * @returns la position du manche pendant le jeu
 */
async function passageDepuis(page: Page, positions: { corde: number; case: number }[]): Promise<Rectangle> {
  await page.goto('/');
  await page.evaluate((positions) => {
    const jeu = { difficulte: 'normal', niveaux: { normal: { niveau: 2, positions } } };
    localStorage.setItem('fretmap.v1', JSON.stringify({ version: 4, jeu }));
  }, positions);
  await page.reload();
  await page.getByRole('button', { name: /^Mode 1/ }).click();
  await page.getByRole('button', { name: 'Reprendre au niveau 2 (3 notes)' }).click();
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 5000 });
  const manche = (await page.locator('.plateau').boundingBox())!;
  await jouerJusquAuPassage(page);
  return manche;
}

/**
 * Le cadre du bilan ne défile pas, son bouton « Continuer » y est entier, et les nouvelles notes n'y sont pas affichées
 * (elles sont sur le manche ; la liste, masquée, est pour les lecteurs d'écran).
 */
async function verifierCadre(page: Page, niveau: number): Promise<void> {
  const cadre = page.locator('.passage');
  expect(await cadre.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(true);
  const bilan = (await cadre.boundingBox())!;
  const bouton = (await page.getByRole('button', { name: `Continuer au niveau ${niveau}` }).boundingBox())!;
  expect(bouton.y).toBeGreaterThanOrEqual(bilan.y);
  expect(bouton.y + bouton.height).toBeLessThanOrEqual(bilan.y + bilan.height);
  expect(bouton.height).toBeGreaterThanOrEqual(44);
  // Liste dans un bloc réservé aux lecteurs d'écran : 1 px, rogné.
  const liste = (await page.locator('.passage .nouvelles').boundingBox())!;
  expect(liste.width * liste.height).toBeLessThanOrEqual(1);
  await expect(page.locator('.passage .nouvelles ul')).toHaveCount(1);
}

const positionsBulles = (page: Page) =>
  page.locator('.note.presentee').evaluateAll((b) => b.map((e) => e.getAttribute('data-position')));

test('mode 1 : nouvelles notes en bas du manche de 8 cases, bilan posé au-dessus sans les cacher', async ({ page }) => {
  // Captures de l'utilisateur aux niveaux 7 et 8 : nouvelles notes sur les cases 6 et 7, que le bilan cachait. Un
  // niveau de 3 notes des cases 6 et 7 donne le même cas dès le premier passage : nouvelles notes sur la case 6 des
  // cordes 6, 5 et 4, manche de 8 cases.
  await page.setViewportSize({ width: 360, height: 740 });
  const manche = await passageDepuis(page, [
    { corde: 6, case: 7 },
    { corde: 3, case: 6 },
    { corde: 2, case: 7 },
  ]);
  const boites = await verifierBulles(page, 3);
  expect(await positionsBulles(page)).toEqual(['6-6', '5-6', '4-6']);
  await expect(page.locator('.case')).toHaveCount(8 * 6);
  // Le bilan est au-dessus des nouvelles notes, entier ; le manche garde sa taille, et rien ne déborde.
  const bilan = (await page.locator('.passage').boundingBox())!;
  for (const boite of boites) expect(bilan.y + bilan.height).toBeLessThanOrEqual(boite.y);
  await verifierCadre(page, 3);
  expect((await page.locator('.plateau').boundingBox())!).toEqual(manche);
  expect(await debordants(page)).toEqual([]);
  await page.getByRole('button', { name: 'Continuer au niveau 3' }).click();
  await expect(page.locator('.passage')).toHaveCount(0);
  await expect(page.locator('.note.attendue')).toBeVisible({ timeout: 5000 });
});

test('mode 1 : nouvelles notes sur les cases 1 et 4, bilan posé entre elles sur un petit écran', async ({ page }) => {
  // Capture de l'utilisateur au passage du niveau 5 au niveau 6 (normal) : Ré# et Sol# en case 1, Si en case 4, sur le
  // manche de 6 cases. Le cadre, posé sur la seule case 0, était coupé ; il va sur les cases 2 et 3, entre elles.
  await page.setViewportSize({ width: 360, height: 640 });
  const manche = await passageDepuis(page, [
    { corde: 6, case: 0 },
    { corde: 5, case: 1 },
    { corde: 4, case: 4 },
  ]);
  const boites = await verifierBulles(page, 3);
  expect(await positionsBulles(page)).toEqual(['4-1', '3-1', '3-4']);
  await expect(page.locator('.case')).toHaveCount(6 * 6);
  const bilan = (await page.locator('.passage').boundingBox())!;
  const [haut, , bas] = boites as [Rectangle, Rectangle, Rectangle];
  expect(bilan.y).toBeGreaterThanOrEqual(haut.y + haut.height);
  expect(bilan.y + bilan.height).toBeLessThanOrEqual(bas.y);
  await expect(page.locator('.titre-passage')).toBeVisible();
  await verifierCadre(page, 3);
  // Les nouvelles notes restent nommées pour les lecteurs d'écran.
  await expect(page.getByRole('listitem')).toHaveText([
    'Ré# (D#) · corde 4, case 1',
    'Sol# (G#) · corde 3, case 1',
    'Si (B) · corde 3, case 4',
  ]);
  expect((await page.locator('.plateau').boundingBox())!).toEqual(manche);
  expect(await debordants(page)).toEqual([]);
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
