---
paths:
  - "app/src/**"
  - "app/tests/**"
---
# Code de l'application

- Svelte 5 (runes : `$state`, `$derived`, `$props`), sans SvelteKit. `App.svelte` choisit l'écran affiché.
- La logique métier est en TypeScript pur dans `music/`, `progression/`, `quiz/` et `audio/` ; `music/`, `progression/` et `quiz/` ne touchent pas au DOM. Les composants (`ui/ecrans/`, `ui/composants/`) affichent l'état et transmettent les actions.
- Tous les textes de l'interface sont dans `ui/textes.ts`.
- `audio/`, `music/notes.ts` et `music/accordages.ts` sont des copies du POC (seul Prettier les a reformatés). Ne les modifier que sur mesure, en le notant dans le commit.
- TypeScript 6.0, pas 7 : `typescript-eslint` et `svelte-check` ne prennent pas encore TypeScript 7.
- Tests dans `tests/unit/*.test.ts` (environnement node) ; un test de composant commence par `// @vitest-environment jsdom` et utilise `@testing-library/svelte`.
- Cibles tactiles d'au moins 44 px, couleurs par variables de `styles.css` (clair et sombre, contrastes AA).
- Tests de bout en bout dans `tests/e2e/*.spec.ts` (Playwright, profil téléphone Pixel 7, sur `vite preview`). En local, lancer avec `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` si le Chromium de `@playwright/test` n'est pas installé.
- Avant de pousser : `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run test:e2e`.
