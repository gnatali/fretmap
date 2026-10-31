# fretmap

Site d'apprentissage des notes du manche de guitare : mode 1 sans guitare (manche virtuel), mode 2 avec guitare (la page reconnaît la note jouée), accordeur. Spécification de l'application : `docs/specs-app-apprentissage-manche.md` (version 2, mise en cohérence avec le POC dans `docs/revue-specs-app.md`).

## État
- **POC terminé, décision Go** : `poc-guitare/SYNTHESE.md` (conclusions), `poc-guitare/resultats/README.md` (mesures).
- **Application** : phases 1 à 6 faites (mode 2 au micro sur les cases 0 à 12 avec 7 niveaux débloqués automatiquement, accordeur, statistiques, réglages, export et import JSON, tirage pondéré). Phase 6 bis (31/10/2026, spec version 3.0, §5.1) : le **mode 1 est le jeu « Notes qui tombent » au toucher**, repris du mode progressif du POC (`app/src/jeu/`), avec records et journal exportable (`journal-mode1-*.json`), et 4 difficultés au choix (version 3.1 : facile, normal, difficile, hardcore ; records par difficulté). Version 3.2 : hardcore en « note acquise », facile à 40 % par note avec aide après une erreur, compteur des notes validées, note ratée qui revient. Données : schéma version 3 (`progression/modele.ts`, migration dans `stockage.ts`). Export et journaux de l'utilisateur analysés dans `app/resultats/README.md`. **Prochaines étapes** : journaux du mode 1 en facile et en hardcore avec la version 3.2 ; phase 7 : essais sur Android avec la guitare (checklist manuelle, spec §10) et corrections.
- **POC « Notes qui tombent »** (futur mode 3) : spec `docs/specs-poc-chute.md` (version 2.3). Phases 1 à 4 faites : `poc-chute/` (outillage et copies figées de `app/`, CI, Pages sous `/poc-chute/`), logique du jeu dans `src/jeu/`, écrans, jeu au micro (et au clavier avec `?simulation`). Ajouts à la demande de l'utilisateur : règle de la fausse note (« pénalité » par défaut), pause, **mode progressif** (spec §16, mode par défaut ; le jeu d'origine devient le mode classique). Journaux analysés dans `poc-chute/resultats/README.md` : le 1er a mené au plafond de vitesse par niveau et aux notes variées (version 2.1), le 2e en confirme l'effet (niveau 6 atteint, 1 % de notes ratées) et a mené au poids de tirage maximal des notes pas encore assez jouées (version 2.3). **Prochaine étape : phase 5** : campagne sur Android (scénarios S1 à S5, spec §9), puis analyse des journaux.
- **En attente de l'utilisateur** : le prochain journal (reprise au niveau 6, réglages par défaut) pour mesurer l'effet de la version 2.3 (section « Décisions » de `poc-chute/resultats/README.md`) ; les choix de rédaction « à valider » de l'annexe B de la spec.
- **Journaux** : quand l'utilisateur envoie un journal, suivre le skill `analyser-journal` (`journal-poc-guitare-*.json`, premier POC) ou `analyser-journal-chute` (`journal-poc-chute-*.json`, « Notes qui tombent »). Journal du mode 1 de l'application (`journal-mode1-*.json`) : skill `analyser-journal-mode1`.
- **Décisions de l'application** : section « Décisions » de `docs/revue-specs-app.md`.
- **Décisions du POC** : plage jusqu'à E5 (point I1 de `docs/revue-specs.md`), validée par le scénario 6 ; matériel validé = micro intégré d'un téléphone Android ; accordeur validé ; guitare électrique hors périmètre ; ordinateurs et iPhone non testés. Autres points : `docs/revue-specs.md`, issue #1.

## À reprendre du POC dans l'application
Valeurs validées, règles du mode 2 et modules à copier : spec §3, §5.2 et §8. `poc-guitare/` reste l'outil de mesure : ne pas le modifier pour l'application.

## Règles
- Tout en français : code, commentaires, docs, commits, échanges.
- Modifier `CLAUDE.md` ou `.claude/` : suivre `.claude/rules/claude-md.md` (racine < 200 lignes, règles par chemin, skills).
- Push direct sur `main` (branche par défaut), pas de PR sans demande. Chaque push lance la CI et le déploiement Pages (https://gnatali.github.io/fretmap/, source Pages = « GitHub Actions ») : vérifier les deux.
- Commandes de l'application, dans `app/` : `npm run lint`, `npm run format:check`, `npm test`, `npm run build` (svelte-check + Vite), `npm run test:e2e` (Playwright, après le build), `npm run dev`. Code : voir `.claude/rules/app-code.md`.
- Commandes du POC « Notes qui tombent », dans `poc-chute/` : les mêmes que `app/` (e2e sur le port 4174). Code : voir `.claude/rules/poc-chute-code.md`.
- Commandes du POC, dans `poc-guitare/` : `npm test`, `npm run build` (tsc + Vite), `npm run dev:https` (téléphone ; via `@vitejs/plugin-basic-ssl`, Vite n'a pas d'option `--https`).
