# fretmap : application

Application d'apprentissage des notes du manche de guitare. Spécification : [`docs/specs-app-apprentissage-manche.md`](../docs/specs-app-apprentissage-manche.md).

En ligne : https://gnatali.github.io/fretmap/ (publiée par `.github/workflows/pages.yml`, avec le POC sous `/poc/`).

## Commandes

| Commande                          | Rôle                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Serveur de développement                                        |
| `npm run build`                   | Vérification des types (`svelte-check`) puis build dans `dist/` |
| `npm test`                        | Tests Vitest (`tests/unit/`)                                    |
| `npm run lint`                    | ESLint (TypeScript et Svelte)                                   |
| `npm run format` / `format:check` | Prettier                                                        |

## Structure

| Dossier            | Contenu                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `src/App.svelte`   | Choix de l'écran affiché                                                                      |
| `src/ui/ecrans/`   | Écrans (accueil pour l'instant)                                                               |
| `src/ui/textes.ts` | Tous les textes de l'interface                                                                |
| `src/audio/`       | Micro, niveau sonore, chaîne de détection : copiés du POC                                     |
| `src/music/`       | Notes et accordages : copiés du POC ; `manche.ts` : note d'une position, positions d'une note |
| `src/progression/` | Modèle de données, stockage (migration, export, import JSON), statistiques                    |
| `tests/unit/`      | Tests des modules copiés (repris du POC) et de l'accueil                                      |

Les modules copiés du POC (`audio/`, `music/notes.ts`, `music/accordages.ts`) portent les valeurs validées par les mesures (spec §3) : ne les modifier que sur nouvelle mesure.

TypeScript reste en 6.0 : `typescript-eslint` et `svelte-check` ne prennent pas encore la version 7.
