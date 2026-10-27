import type { Page } from '@playwright/test';

/** Éléments qui dépassent le bord droit de la fenêtre (même méthode que app/tests/e2e/mode1.spec.ts). */
export async function debordants(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .map((e) => e.outerHTML.slice(0, 80)),
  );
}
