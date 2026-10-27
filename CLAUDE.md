# fretmap

Site d'apprentissage des notes du manche de guitare : mode 1 sans guitare (manche virtuel), mode 2 avec guitare (la page reconnaît la note jouée), accordeur. Spécification de l'application : `docs/specs-app-apprentissage-manche.md` (version 2, mise en cohérence avec le POC dans `docs/revue-specs-app.md`).

## État
- **POC terminé, décision Go** : `poc-guitare/SYNTHESE.md` (conclusions), `poc-guitare/resultats/README.md` (mesures).
- **Application** : phases 1 à 6 faites (mode 1, mode 2 au micro sur les cases 0 à 12, accordeur, statistiques, réglages, export et import JSON, 7 niveaux débloqués automatiquement et séparément par mode, tirage pondéré). Données : schéma version 2 (`progression/modele.ts`, migration dans `stockage.ts`). **Prochaine étape : phase 7** : essais sur Android avec la guitare (checklist manuelle, spec §10) et corrections.
- **POC « Notes qui tombent »** (futur mode 3) : spec `docs/specs-poc-chute.md` (version 1.3). Phases 1 à 4 faites : `poc-chute/` (outillage et copies figées de `app/`, CI, Pages sous `/poc-chute/`), logique du jeu dans `src/jeu/`, écrans, jeu au micro (et au clavier avec `?simulation`). **Prochaine étape : phase 5** : campagne sur Android (scénarios S1 à S4, spec §9), puis analyse des journaux (un skill d'analyse sera écrit avec le premier journal reçu).
- **Journaux du POC** : quand l'utilisateur envoie un journal, suivre le skill `analyser-journal`.
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
