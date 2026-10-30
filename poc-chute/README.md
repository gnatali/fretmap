# fretmap : POC « Notes qui tombent »

Jeu où les notes descendent le long des cordes du manche et se jouent à la guitare, au micro. Spécification : [`docs/specs-poc-chute.md`](../docs/specs-poc-chute.md). En cas de Go, le jeu devient le mode 3 de l'application.

En ligne : https://gnatali.github.io/fretmap/poc-chute/ (publié par `.github/workflows/pages.yml`).

État : phases 1 à 4 faites (squelette, logique du jeu, écrans, micro), puis la règle de la fausse note, la pause et le **mode progressif** (spec §16). Prochaine étape : la campagne sur Android (phase 5, scénarios S1 à S5 de la spec §9).

## Utilisation

Deux modes de jeu, au choix sur l'écran de départ :

- **Progressif** (par défaut, spec §16) : on commence aux cordes à vide, notes immobiles ; la vitesse monte avec la réussite, jusqu'au plafond du niveau (30 % de la vitesse max au niveau 1, + 5 % par niveau) ; quand chaque note et le niveau sont assez réussis à ce plafond, le niveau passe et 3 notes s'ajoutent (montrées sur le manche pendant une pause de 6 s). Une fausse note coûte 50 points, la note reste à jouer ; à la 3e, ou si elle arrive en bas, elle est perdue (−150). La partie dure jusqu'à « Arrêter » ; « Reprendre au niveau N » repart des notes atteintes. Les méthodes de calcul de la réussite et tous les seuils se règlent au départ ; le journal note toutes les méthodes pour les comparer. Une note pas encore jouée 3 fois sort en priorité ; le bilan du passage de niveau s'affiche sous le manche.
- **Classique** (spec §6) : 30 notes d'un niveau de l'application, durée de chute adaptative.

Dans les deux modes :

- Un nom de note ne revient qu'après 2 notes d'un autre nom (pas de La2 puis La3). Le manche affiche les cases 0 à 5, puis jusqu'à 7 ou 12 selon les notes du niveau.

- **À la guitare** (téléphone Android, Chrome, en portrait) : accorder la guitare avec l'accordeur de l'application, choisir le mode et ses réglages, puis démarrer. Le navigateur demande l'accès au micro ; ne pas jouer pendant les 2 s de mesure du bruit ambiant, puis jouer après le compte à rebours de 3 s. L'indicateur du bas montre la note entendue, le niveau sonore et les messages du micro.
- **Au clavier**, pour le développement : https://gnatali.github.io/fretmap/poc-chute/?simulation. **Espace** (ou « Jouer la note ») = note juste, **F** (ou « Fausse note ») = fausse note.
- Écran de départ : mode de jeu et ses réglages, notation, options de mesure (afficher la case, vitesse fixe en mode classique), export et vidage du journal. Les choix sont gardés.
- Mode classique, règle de la fausse note (spec §6.4) : « Coûte 50 points (la note reste à jouer) », par défaut, ou « Détruit la note (on passe à la suivante) ». Dans les deux cas, une fausse note casse la série et ralentit la chute. En mode « pénalité », la bonne case s'affiche après 3 fausses notes sur la même note.
- Partie : boutons « Pause » (ou touche P) et « Arrêter ». Pendant la pause, le manche est masqué et le temps du jeu est gelé. Quand l'onglet passe en arrière-plan, la partie se met en pause et le micro est coupé : « Reprendre » le relance, avec 2 s de mesure du bruit. Écran de fin (mode classique) : résumé, notes à revoir avec leur bonne case, « Rejouer » (nouveau calibrage).
- Après une série de parties : « Exporter le journal », puis ajouter le fichier à `resultats/` (spec §9). L'analyse de chaque journal est dans `resultats/README.md`.

## Commandes

Les mêmes que l'application (`app/`).

| Commande                          | Rôle                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Serveur de développement                                                                                                                                                      |
| `npm run build`                   | Vérification des types (`svelte-check`) puis build dans `dist/`                                                                                                               |
| `npm test`                        | Tests Vitest (`tests/unit/`)                                                                                                                                                  |
| `npm run lint`                    | ESLint (TypeScript et Svelte)                                                                                                                                                 |
| `npm run format` / `format:check` | Prettier                                                                                                                                                                      |
| `npm run test:e2e`                | Tests Playwright (`tests/e2e/`) sur le build, port 4174, micro simulé par le fichier WAV de `tests/e2e/son.ts` ; en local, `CHROMIUM_PATH` peut désigner un Chromium installé |

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
| `stockage.ts` | `localStorage` (`fretmap-chute.v1`) : mode, réglages des deux modes, seuil, statistiques par position, progression, 50 dernières parties                                  |
| `horloge.ts`  | Temps du jeu, sans les pauses                                                                                                                                             |
| `progressif/` | Mode progressif (spec §16) : `reglages` (défauts, bornes), `difficulte` (notes ajoutées), `reussite` (méthodes), `partie-progressive` (`PartieProgressive`), `journal`    |

## Interface (`src/ui/`)

| Fichier                                   | Rôle                                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.svelte`                          | Choix de l'écran, données chargées et enregistrées (`jeu/stockage.ts`), export du journal, micro démarré à chaque partie et arrêté à la fin (`Ecoute`)                                  |
| `ui/ecrans/Depart.svelte`                 | Mode de jeu, réglages, explication du micro, démarrage (reprise du mode progressif), erreur du micro, journal                                                                           |
| `ui/ecrans/Partie.svelte`                 | Les deux modes : calibrage, compte à rebours, boucle `requestAnimationFrame`, pause, détections du micro, barre du haut, consigne, retours, passage de niveau, touches de la simulation |
| `ui/composants/Indicateur.svelte`         | Note entendue et écart en cents, niveau sonore et seuil de silence, messages du micro                                                                                                   |
| `ui/ecrans/Fin.svelte`                    | Mode classique : résumé, notes à revoir, Rejouer                                                                                                                                        |
| `ui/ecrans/FinProgressif.svelte`          | Mode progressif : résumé, niveau atteint, notes du niveau avec leur réussite, Continuer                                                                                                 |
| `ui/composants/ReglagesProgressif.svelte` | Méthodes de réussite et curseurs des réglages du mode progressif                                                                                                                        |
| `ui/composants/MancheChute.svelte`        | Manche vertical, notes qui tombent, ligne de jeu, bonne case après une erreur, effets                                                                                                   |
| `ui/textes.ts`                            | Tous les textes, et leur mise en forme (durée, consigne, retour, emplacement)                                                                                                           |

Propres au POC aussi : `playwright.config.ts`, `tests/e2e/`, et les tests de `src/jeu/` et `src/ui/` dans `tests/unit/`.
