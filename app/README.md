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

| Dossier              | Contenu                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `src/App.svelte`     | Choix de l'écran affiché ; `src/etat.svelte.ts` : progression chargée et enregistrée          |
| `src/ui/ecrans/`     | Écrans : accueil, mode 1, statistiques                                                        |
| `src/ui/composants/` | Manche (grille de boutons)                                                                    |
| `src/quiz/`          | Tirage, validation et score du mode 1                                                         |
| `src/ui/textes.ts`   | Tous les textes de l'interface                                                                |
| `src/audio/`         | Micro, niveau sonore, chaîne de détection : copiés du POC                                     |
| `src/music/`         | Notes et accordages : copiés du POC ; `manche.ts` : note d'une position, positions d'une note |
| `src/progression/`   | Modèle de données, stockage (migration, export, import JSON), statistiques, niveaux           |
| `tests/unit/`        | Tests Vitest : modules (dont ceux repris du POC) et composants                                |
| `tests/e2e/`         | Tests Playwright : mode 1, statistiques après rechargement, largeur téléphone                 |

Les modules copiés du POC (`audio/`, `music/notes.ts`, `music/accordages.ts`) portent les valeurs validées par les mesures (spec §3) : ne les modifier que sur nouvelle mesure.

TypeScript reste en 6.0 : `typescript-eslint` et `svelte-check` ne prennent pas encore la version 7.
