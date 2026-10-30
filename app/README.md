# fretmap : application

Application d'apprentissage des notes du manche de guitare. Spécification : [`docs/specs-app-apprentissage-manche.md`](../docs/specs-app-apprentissage-manche.md).

En ligne : https://gnatali.github.io/fretmap/ (publiée par `.github/workflows/pages.yml`, avec le POC sous `/poc/`).

## Commandes

| Commande                          | Rôle                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Serveur de développement                                                                                    |
| `npm run build`                   | Vérification des types (`svelte-check`) puis build dans `dist/`                                             |
| `npm test`                        | Tests Vitest (`tests/unit/`)                                                                                |
| `npm run lint`                    | ESLint (TypeScript et Svelte)                                                                               |
| `npm run format` / `format:check` | Prettier                                                                                                    |
| `npm run test:e2e`                | Tests Playwright (`tests/e2e/`) sur le build ; en local, `CHROMIUM_PATH` peut désigner un Chromium installé |

## Structure

| Dossier                | Contenu                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `src/App.svelte`       | Choix de l'écran affiché ; `src/etat.svelte.ts` : progression chargée et enregistrée          |
| `src/ecoute.svelte.ts` | Micro, boucle d'analyse, calibrage du silence, écran gardé allumé, bip (mode 2, accordeur)    |
| `src/ui/ecrans/`       | Écrans : accueil, modes 1 et 2, accordeur, statistiques, réglages                             |
| `src/ui/composants/`   | Manche, jeu du mode 1 (manche tactile, partie, fin), micro, aiguille, niveau du quiz, score   |
| `src/jeu/`             | Jeu du mode 1 « Notes qui tombent » au toucher : repris du mode progressif du POC `poc-chute` |
| `src/quiz/`            | Tirage, validation (modes 1 et 2, règles du POC) et score                                     |
| `src/ui/textes.ts`     | Tous les textes de l'interface                                                                |
| `src/audio/`           | Micro, niveau sonore, chaîne de détection : copiés du POC                                     |
| `src/music/`           | Notes et accordages : copiés du POC ; `manche.ts` : note d'une position, positions d'une note |
| `src/progression/`     | Modèle de données, stockage (migration, export, import JSON), statistiques, niveaux           |
| `tests/unit/`          | Tests Vitest : modules (dont ceux repris du POC) et composants                                |
| `tests/e2e/`           | Tests Playwright : modes 1 et 2, accordeur (micro simulé par un WAV, `son.ts`), réglages      |
| `resultats/`           | Exports et journaux envoyés par l'utilisateur, avec leur analyse                              |

Le mode 1 est le jeu « Notes qui tombent » au toucher (spec §5.1) : les notes tombent le long de leur corde, on touche la case. On commence aux cordes à vide ; 3 notes s'ajoutent à chaque niveau validé. Le journal des parties s'exporte depuis l'écran du mode 1 (`journal-mode1-*.json`).

Les modules copiés du POC (`audio/`, `music/notes.ts`, `music/accordages.ts`) portent les valeurs validées par les mesures (spec §3) : ne les modifier que sur nouvelle mesure.

TypeScript reste en 6.0 : `typescript-eslint` et `svelte-check` ne prennent pas encore la version 7.
