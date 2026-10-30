---
name: analyser-journal-chute
description: Intégrer et analyser un journal exporté par le POC « Notes qui tombent » (JSON journal-poc-chute-*.json, format fretmap-chute-journal) — à utiliser quand l'utilisateur envoie un tel journal ou demande l'analyse de ses parties.
---
# Analyser un journal du POC « Notes qui tombent »

1. Copier le JSON dans `poc-chute/resultats/` sans le renommer.
2. Lancer le script depuis la racine du dépôt (dépendances du POC installées : `npm ci` dans `poc-chute/`) :
   `node .claude/skills/analyser-journal-chute/scripts/analyse-journal.mjs poc-chute/resultats/<journal>.json`
   - Le script valide les parties avec le chargement de la page (`charger` de `src/jeu/stockage.ts`) et refuse un journal dont une partie est invalide.
   - Il affiche en Markdown, pour chaque partie :
     - le contexte : micro ou simulation, seuil de silence, images, pauses ;
     - en mode classique : le résumé et les événements ;
     - en mode progressif, par niveau :
       - les essais et leurs résultats ;
       - les conditions de passage non remplies, avec les notes le plus souvent sous le seuil ;
       - les notes ratées selon la durée de chute ;
       - le premier essai où le niveau serait passé avec chacune des 9 méthodes (note / niveau). Ce calcul part des réussites notées dans le journal, sans rien recalculer.
   - Il compte aussi les notes de même nom à la suite.
   - Pour rejouer les passages avec d'autres seuils : `--seuilNote=0.6`, `--seuilGlobal=0.7` ou `--essaisMinimum=2`.
3. Analyser :
   - le ressenti de l'utilisateur, à rapprocher des chiffres ;
   - ce qui bloque les passages de niveau ;
   - les notes ratées en cascade et la vitesse ;
   - la méthode qui suit le mieux les progrès (spec §16.2, scénario S5) ;
   - les notes faibles ;
   - l'animation (HC1 : images au-delà de 33 ms) ;
   - les anomalies du micro (aucune note reconnue, anciennes notes).
4. Ajouter une section en tête de `poc-chute/resultats/README.md` : session, tableaux, analyse, décisions. Les réglages à essayer ensuite sont proposés à l'utilisateur, sans les changer d'office. Relire : les chiffres doivent être identiques à la sortie du script.
5. Si l'utilisateur décide de changer une règle : demander les points ouverts (AskUserQuestion), changer le code, la spec (`docs/specs-poc-chute.md`, nouvelle version et annexe) et les tests, en suivant `.claude/rules/poc-chute-code.md`.
6. Mettre à jour l'état du POC dans `CLAUDE.md` et le `README.md` racine si l'avancement change.
7. Commit en français, push sur `main`, vérifier la CI et le déploiement Pages (outils GitHub).
8. Répondre à l'utilisateur : chiffres clés, ce qui bloque, méthodes, décisions et fichiers modifiés.
