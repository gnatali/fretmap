# fretmap : POC « Notes qui tombent »

Jeu où les notes descendent le long des cordes du manche et se jouent à la guitare, au micro. Spécification : [`docs/specs-poc-chute.md`](../docs/specs-poc-chute.md). En cas de Go, le jeu devient le mode 3 de l'application.

En ligne : https://gnatali.github.io/fretmap/poc-chute/ (publié par `.github/workflows/pages.yml`).

État : phases 1 à 3 faites (squelette, logique du jeu, écrans). Le jeu se joue **au clavier** en mode simulation ; le micro arrive en phase 4 (spec §13).

## Utilisation

- https://gnatali.github.io/fretmap/poc-chute/?simulation : partie au clavier, sans micro. **Espace** (ou « Jouer la note ») = note juste, **F** (ou « Fausse note ») = fausse note.
- Sans `?simulation`, le bouton Démarrer reste désactivé jusqu'au branchement du micro.
- Écran de départ : niveau, durée de chute au départ, notation, options de mesure (afficher la case, vitesse fixe), export et vidage du journal. Les choix sont gardés.
- Partie : 30 notes, compte à rebours de 3 s, bouton « Arrêter ». Écran de fin : résumé, notes manquées avec leur bonne case, « Rejouer ».

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

## Interface (`src/ui/`)

| Fichier                            | Rôle                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/App.svelte`                   | Choix de l'écran, données chargées et enregistrées (`jeu/stockage.ts`), export du journal                    |
| `ui/ecrans/Depart.svelte`          | Réglages de la partie, démarrage, journal                                                                    |
| `ui/ecrans/Partie.svelte`          | Compte à rebours, boucle `requestAnimationFrame`, barre du haut, consigne, retours, touches de la simulation |
| `ui/ecrans/Fin.svelte`             | Résumé, notes manquées, Rejouer                                                                              |
| `ui/composants/MancheChute.svelte` | Manche vertical, notes qui tombent, ligne de jeu, bonne case après une erreur, effets                        |
| `ui/textes.ts`                     | Tous les textes, et leur mise en forme (durée, consigne, retour, emplacement)                                |

Propres au POC aussi : `playwright.config.ts`, `tests/e2e/`, et les tests de `src/jeu/` et `src/ui/` dans `tests/unit/`.
