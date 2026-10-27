# fretmap : POC « Notes qui tombent »

Jeu où les notes descendent le long des cordes du manche et se jouent à la guitare, au micro. Spécification : [`docs/specs-poc-chute.md`](../docs/specs-poc-chute.md). En cas de Go, le jeu devient le mode 3 de l'application.

En ligne : https://gnatali.github.io/fretmap/poc-chute/ (publié par `.github/workflows/pages.yml`).

État : phase 1 (squelette, copies de l'application, CI et Pages). Le jeu arrive aux phases 2 à 4 (spec §13).

## Commandes

Les mêmes que l'application (`app/`).

| Commande                          | Rôle                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Serveur de développement                                                                                               |
| `npm run build`                   | Vérification des types (`svelte-check`) puis build dans `dist/`                                                        |
| `npm test`                        | Tests Vitest (`tests/unit/`)                                                                                           |
| `npm run lint`                    | ESLint (TypeScript et Svelte)                                                                                          |
| `npm run format` / `format:check` | Prettier                                                                                                               |
| `npm run test:e2e`                | Tests Playwright (`tests/e2e/`) sur le build, port 4174 ; en local, `CHROMIUM_PATH` peut désigner un Chromium installé |

## Copies de l'application

Ces fichiers sont copiés **à l'identique** de `app/` au commit `34203e7` (phase 6 de l'application). Ils ne suivent pas les changements de l'application pendant le POC. `diff` avec l'original doit rester vide, sauf modification décidée sur mesure et notée dans le commit.

| Copie                                                                                                  | Rôle dans le POC                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/audio/` (`micro`, `niveau`, `pitch`)                                                              | Micro et chaîne de détection, valeurs validées par le premier POC        |
| `src/ecoute.svelte.ts`                                                                                 | Démarrage du micro, calibrage du silence, boucle d'analyse, écran allumé |
| `src/music/` (`accordages`, `manche`, `notation`, `notes`)                                             | Notes, positions sur le manche, notation française ou anglo-saxonne      |
| `src/quiz/tirage.ts`, `src/quiz/validation.ts`                                                         | Tirage pondéré des positions, règles du mode 2 (`SuiviMode2`)            |
| `src/progression/` (`modele`, `niveaux`, `statistiques`)                                               | Les 7 niveaux, poids du tirage (`poidsPosition`)                         |
| `src/main.ts`, `src/styles.css`, `public/icone.svg`                                                    | Démarrage de la page, couleurs claires et sombres, icône                 |
| `tests/unit/` (tests de ces modules et `detection.ts`)                                                 | Vérifient que les copies fonctionnent dans ce dossier                    |
| Configuration (`tsconfig.json`, `eslint.config.js`, `svelte.config.js`, Prettier, `package-lock.json`) | Même outillage et mêmes versions que l'application                       |

Propres au POC : `src/App.svelte`, `src/ui/`, `playwright.config.ts`, `tests/e2e/` ; `src/jeu/` à partir de la phase 2.
