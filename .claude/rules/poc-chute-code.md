---
paths:
  - "poc-chute/src/**"
  - "poc-chute/tests/**"
---
# Code du POC « Notes qui tombent »

- Spec : `docs/specs-poc-chute.md` (règles §6, constantes §7, tests §12, phases §13).
- Svelte 5 (runes : `$state`, `$derived`, `$props`), sans SvelteKit, comme `app/`. `App.svelte` choisit l'écran affiché.
- `src/jeu/` : TypeScript pur, sans DOM et sans horloge propre ; le temps est passé en paramètre (pas de `performance.now()`), sur l'horloge de l'écoute (`EtatDetection.tMs`), pour tester sans navigateur. Il ne dépend que de `music/`, `quiz/`, `progression/` et du type `EtatDetection` (`audio/pitch.ts`). C'est le code qui passera dans `app/src/` en cas de Go.
- `Partie` (`jeu/partie.ts`) est le point d'entrée de l'interface : `avancer(t)` à chaque image, `traiterDetection(etat)` et `silenceProlonge(t)` pour le micro, `jouerSimule()` pour le mode simulation, `journal()` en fin de partie ; les données passent par `jeu/stockage.ts`.
- Micro : `App.svelte` crée l'`Ecoute`, la démarre dans le clic (« Démarrer », « Rejouer » : l'`AudioContext` doit naître dans ce geste) et l'arrête à la fin de la partie ; l'écran de partie l'écoute (`ecoute.ecouter`), `ecoute` à null en simulation. Seule exception : la pause en arrière-plan coupe le micro dans l'écran de partie, et « Reprendre » le relance (geste).
- Pause : l'écran fait passer tous les temps donnés à la partie par `HorlogeJeu` (`jeu/horloge.ts`) ; la partie reçoit le temps du jeu, sans les pauses. Tests de composants : `microFactice()` de `tests/unit/micro.ts`.
- Tests de `jeu/` : `hasard = () => 0` rend le tirage déterministe (au niveau 2, E2 et F2 alternent) ; `etat()` de `tests/unit/detection.ts` fabrique les états de détection, `stockageMemoire()` de `tests/unit/memoire.ts` remplace localStorage.
- Copies figées de `app/` (commit `34203e7`), listées dans `poc-chute/README.md` : `src/audio/`, `src/ecoute.svelte.ts`, `src/music/`, `src/quiz/`, `src/progression/`, `src/main.ts`, `src/styles.css`, et leurs tests dans `tests/unit/`. Ne pas les modifier, sauf sur mesure, en le notant dans le commit ; `diff` avec `app/` doit rester vide. Ne pas modifier `app/` ni `poc-guitare/` pour le POC.
- Tous les textes de l'interface sont dans `src/ui/textes.ts`, en français.
- Constantes réglables en majuscules, commentées avec leur valeur initiale et leur origine (§ de la spec, question Q de l'annexe A ou mesure).
- Cibles tactiles d'au moins 44 px, couleurs par les variables de `styles.css` (clair et sombre).
- TypeScript 6.0, pas 7 (comme `app/`).
- Tests : `tests/unit/*.test.ts` (Vitest, node ; `// @vitest-environment jsdom` pour un composant) ; `tests/e2e/*.spec.ts` (Playwright, Pixel 7, `vite preview` sur le port 4174, micro simulé par le WAV de `tests/e2e/son.ts`, dont les notes suivent le déroulé de `micro.spec.ts`). En local : `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.
- Avant de pousser, dans `poc-chute/` : `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run test:e2e`.
