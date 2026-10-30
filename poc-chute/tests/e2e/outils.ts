import type { Page } from '@playwright/test';

/**
 * Éléments qui dépassent le bord droit de l'écran (méthode de app/tests/e2e/mode1.spec.ts). La largeur est celle de
 * l'écran émulé, pas window.innerWidth : sur mobile, la page s'élargit d'elle-même quand son contenu déborde.
 */
export async function debordants(page: Page): Promise<string[]> {
  const largeur = page.viewportSize()!.width;
  return page.evaluate(
    (largeur) =>
      [...document.querySelectorAll('main *')]
        .filter((e) => e.getBoundingClientRect().right > largeur + 1)
        .map((e) => e.outerHTML.slice(0, 80)),
    largeur,
  );
}
