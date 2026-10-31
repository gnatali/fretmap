---
name: analyser-journal-mode1
description: Intégrer et analyser un journal exporté par le mode 1 de l'application (JSON journal-mode1-*.json, format fretmap-mode1-journal) — à utiliser quand l'utilisateur envoie un tel journal ou demande l'analyse de ses parties du mode 1.
---
# Analyser un journal du mode 1

1. Copier le JSON dans `app/resultats/` sans le renommer.
2. Lancer le script depuis la racine du dépôt (dépendances de l'application installées : `npm ci` dans `app/`) :
   `node .claude/skills/analyser-journal-mode1/scripts/analyse-journal.mjs app/resultats/<journal>.json`
   - Il affiche en Markdown, pour chaque partie : difficulté, résumé, images, pauses.
   - Par niveau : notes, essais, durée, cases fausses, notes perdues et ratées, délai médian.
   - Il rejoue aussi les passages dans chaque difficulté : premier essai du niveau où le passage serait validé, avec le code de l'application (`reglagesDe`, `reussiteNote`, `reussiteGlobale`, `sansFaute`). Le rejeu de la difficulté jouée doit donner l'essai réel : sinon, le script ne suit plus `jeu/partie.ts`.
   - Il donne les notes avec des cases fausses.
3. Analyser : ce qui bloque ou accélère les passages, les notes faibles, la vitesse, le ressenti de l'utilisateur.
4. Ajouter une section en tête de `app/resultats/README.md` : session, tableau, analyse, décisions. Les réglages à essayer sont proposés à l'utilisateur, sans les changer d'office.
5. Si l'utilisateur décide de changer une règle : changer le code (`app/src/jeu/`), la spec (`docs/specs-app-apprentissage-manche.md` §5.1, nouvelle version), les décisions (`docs/revue-specs-app.md`) et les tests, en suivant `.claude/rules/app-code.md`.
6. Mettre à jour l'état dans `CLAUDE.md`.
7. Commit en français, push sur `main`, vérifier la CI et le déploiement Pages.
