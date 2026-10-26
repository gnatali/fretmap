---
name: analyser-journal
description: Intégrer et analyser un journal de campagne exporté par le POC (JSON journal-poc-guitare-*.json) — à utiliser quand l'utilisateur envoie un journal ou demande l'analyse d'une session de test.
---
# Analyser un journal de campagne

1. Copier le JSON dans `poc-guitare/resultats/` sans le renommer, puis générer le CSV à côté, depuis la racine du dépôt (dépendances du POC installées : `npm ci` dans `poc-guitare/`) :
   `node .claude/skills/analyser-journal/scripts/journal-vers-csv.mjs poc-guitare/resultats/<journal>.json`
   Le script réutilise `chargerEssais` et `versCsv` de `src/journal/essais.ts` : même format que l'export de la page (RFC 4180, CRLF). Il affiche le nombre d'essais et refuse un journal dont un essai est invalide.
2. Calculer par scénario, sur les notes jouées (voir `.claude/rules/resultats.md`) : bonnes notes, écart moyen absolu en cents, latence médiane et maximale, part sous 300 ms, octaves erronées, changements sans attaque, non-détections, faux positifs (scénario 4).
3. Expliquer chaque erreur à l'attaque (corde précédente encore sonore, transitoire, harmonique) et les changements sans attaque.
4. Ajouter une section en tête de `resultats/README.md` (session, matériel, tableau, analyse).
5. Mettre à jour `SYNTHESE.md` (hypothèses H1 à H5, décision selon §8) et l'avancement du `README.md` racine. Relire : chiffres identiques partout.
6. Commit en français, push sur `main`, vérifier la CI et le déploiement Pages (outils GitHub).
7. Commenter puis fermer les issues que la session termine (avec `state_reason`).
8. Répondre à l'utilisateur : tableau de résultats, verdict par hypothèse, fichiers modifiés.
