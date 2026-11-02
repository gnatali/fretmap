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
   - Il rejoue aussi les passages dans chaque difficulté, avec les règles actuelles : premier essai du niveau où le passage serait validé, avec le code de l'application (`reglagesDe`, `reussiteNote`, `reussiteGlobale`, `acquise` avec `ACQUISE`). Si les règles n'ont pas changé depuis la partie, le rejeu de la difficulté jouée doit donner l'essai réel : sinon, le script ne suit plus `Partie.niveauValide` (`jeu/partie.ts`).
   - La vitesse est recalculée avec les réglages de chaque difficulté (elles n'ont pas le même plafond depuis le 01/11/2026), comme `Partie` : 0 au début du niveau, ralentie à chaque case fausse et note perdue ou ratée, accélérée par chaque note juste. Le script donne l'écart avec la vitesse du journal dans la difficulté jouée : au plus 0,001 (l'arrondi) si ses réglages n'ont pas changé depuis la partie.
   - Chaque niveau est rejoué sur ses seuls essais : essais, réussites et notes acquises repartent de zéro à chaque niveau (version 3.10, 02/11/2026). Pour une partie plus ancienne, où les essais des niveaux précédents comptaient, le rejeu des niveaux 2 et suivants ne redonne donc pas l'essai réel du passage.
   - « non » : pas de passage dans les essais joués à ce niveau. Une difficulté plus exigeante que celle jouée aurait demandé plus d'essais que la partie n'en a.
   - Le rejeu garde les tirages réels : la priorité aux notes non acquises du hardcore (depuis le 01/11/2026) ne se rejoue pas.
   - Le facile ne tire que des notes naturelles (`NATURELLES_SEULES`, depuis le 01/11/2026). Le rejeu porte sur les notes vraiment jouées : pour une partie avec des notes altérées, le rejeu du facile ne vaut que pour ses seuils (le script le signale).
   - Par niveau, il compte les conditions qui manquaient après chaque essai (vitesse sous le plafond, essais minimum, note sous le seuil, note pas encore acquise en hardcore, réussite du niveau) et nomme les notes qui bloquent le plus.
   - Il donne les notes avec des cases fausses.
   - Les notes qui reviennent après une erreur sont marquées `revient` dans le journal (depuis le 31/10/2026).
3. Analyser : ce qui bloque ou accélère les passages, les notes faibles, la vitesse, le ressenti de l'utilisateur.
4. Ajouter une section en tête de `app/resultats/README.md` : session, tableau, analyse, décisions. Les réglages à essayer sont proposés à l'utilisateur, sans les changer d'office.
5. Si l'utilisateur décide de changer une règle : changer le code (`app/src/jeu/`), la spec (`docs/specs-app-apprentissage-manche.md` §5.1, nouvelle version), les décisions (`docs/revue-specs-app.md`) et les tests, en suivant `.claude/rules/app-code.md`.
6. Mettre à jour l'état dans `CLAUDE.md`.
7. Commit en français, push sur `main`, vérifier la CI et le déploiement Pages.
