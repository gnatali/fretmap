# fretmap

Site d'apprentissage des notes du manche de guitare : mode 1 sans guitare (manche virtuel), mode 2 avec guitare (la page reconnaît la note jouée), accordeur. Spécification de l'application : `docs/specs-app-apprentissage-manche.md` (version 2, mise en cohérence avec le POC dans `docs/revue-specs-app.md`).

## État
- **POC terminé, décision Go** : `poc-guitare/SYNTHESE.md` (conclusions), `poc-guitare/resultats/README.md` (mesures).
- **Application** : phase 1 faite (`app/` : accueil, modules `audio/` et `music/` copiés du POC). **Prochaine étape : phase 2** (modèle de données, stockage, `music/manche.ts` ; spec §6, §8, §10, §12).
- **Avant la phase 4 (mode 2)** : jouer le scénario 6 du POC (cases 6 à 12, jusqu'à E5) puis compléter H2. Quand l'utilisateur envoie un journal, suivre le skill `analyser-journal`.
- **Décisions de l'application** : section « Décisions » de `docs/revue-specs-app.md`.
- **Décisions du POC** : plage jusqu'à E5 (point I1 de `docs/revue-specs.md`) ; matériel validé = micro intégré d'un téléphone Android ; accordeur validé ; guitare électrique hors périmètre ; ordinateurs et iPhone non testés. Autres points : `docs/revue-specs.md`, issue #1.

## À reprendre du POC dans l'application
Valeurs validées, règles du mode 2 et modules à copier : spec §3, §5.2 et §8. `poc-guitare/` reste l'outil de mesure : ne pas le modifier pour l'application.

## Règles
- Tout en français : code, commentaires, docs, commits, échanges.
- Modifier `CLAUDE.md` ou `.claude/` : suivre `.claude/rules/claude-md.md` (racine < 200 lignes, règles par chemin, skills).
- Push direct sur `main` (branche par défaut), pas de PR sans demande. Chaque push lance la CI et le déploiement Pages (https://gnatali.github.io/fretmap/, source Pages = « GitHub Actions ») : vérifier les deux.
- Commandes de l'application, dans `app/` : `npm run lint`, `npm run format:check`, `npm test`, `npm run build` (svelte-check + Vite), `npm run dev`. Code : voir `.claude/rules/app-code.md`.
- Commandes du POC, dans `poc-guitare/` : `npm test`, `npm run build` (tsc + Vite), `npm run dev:https` (téléphone ; via `@vitejs/plugin-basic-ssl`, Vite n'a pas d'option `--https`).
