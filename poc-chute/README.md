# fretmap : POC « Notes qui tombent »

Jeu où les notes descendent le long des cordes du manche et se jouent à la guitare, au micro. Spécification : [`docs/specs-poc-chute.md`](../docs/specs-poc-chute.md). En cas de Go, le jeu devient le mode 3 de l'application.

En ligne : https://gnatali.github.io/fretmap/poc-chute/ (publié par `.github/workflows/pages.yml`).

État : phases 1 (squelette, copies de l'application, CI et Pages) et 2 (logique du jeu dans `src/jeu/`, sans interface) faites. Les écrans arrivent en phase 3, le micro en phase 4 (spec §13).

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

## Logique du jeu (`src/jeu/`)

TypeScript pur, sans DOM ; le temps est passé en paramètre. Règles : spec §6.3 à §6.10, constantes : §7.

| Module        | Rôle                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partie.ts`   | Déroulement d'une partie (`Partie`) : tirage pondéré, chute, validation au micro (`SuiviMode2`) ou simulée, série, points, vitesse, statistiques, fin à 30 notes, journal |
| `chute.ts`    | File des notes à l'écran : progression commune, apparitions au tiers de la chute, notes ratées                                                                            |
| `vitesse.ts`  | Durée de chute adaptative (accélère après 5 notes justes, ralentit après une erreur)                                                                                      |
| `points.ts`   | Barème : timing, vitesse, difficulté, multiplicateur de série                                                                                                             |
| `journal.ts`  | Format du journal exporté, mesure des images (HC1), nom du fichier                                                                                                        |
| `stockage.ts` | `localStorage` (`fretmap-chute.v1`) : réglages, seuil, statistiques par position, 50 dernières parties                                                                    |

Propres au POC aussi : `src/App.svelte`, `src/ui/`, `playwright.config.ts`, `tests/e2e/`, et les tests de `src/jeu/` dans `tests/unit/`.
