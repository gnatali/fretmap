---
paths:
  - "poc-chute/src/**"
  - "poc-chute/tests/**"
---
# Code du POC « Notes qui tombent »

- Spec : `docs/specs-poc-chute.md` (règles §6, constantes §7, tests §12, phases §13).
- Svelte 5 (runes : `$state`, `$derived`, `$props`), sans SvelteKit, comme `app/`. `App.svelte` choisit l'écran affiché.
- `src/jeu/` : TypeScript pur, sans DOM et sans horloge propre ; le temps est passé en paramètre (pas de `performance.now()`), pour tester sans navigateur. C'est le code qui passera dans `app/src/` en cas de Go.
- Copies figées de `app/` (commit `34203e7`), listées dans `poc-chute/README.md` : `src/audio/`, `src/ecoute.svelte.ts`, `src/music/`, `src/quiz/`, `src/progression/`, `src/main.ts`, `src/styles.css`, et leurs tests dans `tests/unit/`. Ne pas les modifier, sauf sur mesure, en le notant dans le commit ; `diff` avec `app/` doit rester vide. Ne pas modifier `app/` ni `poc-guitare/` pour le POC.
- Tous les textes de l'interface sont dans `src/ui/textes.ts`, en français.
- Constantes réglables en majuscules, commentées avec leur valeur initiale et leur origine (§ de la spec, question Q de l'annexe A ou mesure).
- Cibles tactiles d'au moins 44 px, couleurs par les variables de `styles.css` (clair et sombre).
- TypeScript 6.0, pas 7 (comme `app/`).
- Tests : `tests/unit/*.test.ts` (Vitest, node ; `// @vitest-environment jsdom` pour un composant) ; `tests/e2e/*.spec.ts` (Playwright, Pixel 7, `vite preview` sur le port 4174). En local : `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.
- Avant de pousser, dans `poc-chute/` : `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run test:e2e`.
