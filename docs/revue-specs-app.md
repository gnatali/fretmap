# Revue des spécifications de l'application

Revue de [`specs-app-apprentissage-manche.md`](specs-app-apprentissage-manche.md) (version 1, fournie le 26/10/2026) au regard des résultats du POC ([`poc-guitare/SYNTHESE.md`](../poc-guitare/SYNTHESE.md)). Les corrections sont reportées dans la version 2 de la spécification.

**Points tranchés le 26/10/2026** : toutes les propositions sont acceptées, l'interface sera en Svelte (tableau en fin de document).

## Écarts avec les résultats du POC

| # | § | Constat | Correction (version 2) |
|---|---|---|---|
| P1 | §3 | Les constantes « à reprendre du POC » ne sont pas chiffrées, et la liste mélange des valeurs du POC (fenêtre, stabilité) avec une « tolérance en cents » que le POC n'avait pas pour le mode 2. | Tableau des valeurs validées (fenêtre, clarté, plage, lissage, stabilité, attaque, tolérance d'octave, seuil de silence, délai de non-détection, accordeur). |
| P2 | §5.2, §2, §11 | « Cordes à vide et frettes 1 à 5, soit E2 à E5 environ » : faux. Les cases 0 à 5 vont de E2 à **A4**. Le POC a décidé (point I1) que le produit va jusqu'à E5, soit la case 12 de la corde 1. | Le mode 2 couvre les cases 0 à 12 (E2 à E5), sous réserve du scénario 6 du POC (cases 6 à 12) ; jusque-là, il est limité aux cases 0 à 5. |
| P3 | §9, §5.2 | « L'octave erronée est fréquente sur les notes aiguës » : ce n'est pas ce que le POC a mesuré. Les sauts d'octave venaient des cordes graves pendant la résonance (E2 → E3, F2 → F3) et de l'harmonique 4 (B3 → B5). Avec la tolérance d'octave, il n'y a eu aucune erreur d'octave à l'attaque (230 notes). Le filtre de clarté ne règle pas ce problème. | §9 réécrit : tolérance d'octave obligatoire ; l'option « octave stricte » est possible techniquement. |
| P4 | §5.2, §5.4, §9 | Tolérance de ±30 cents par défaut, ±20 en option. Le POC a mesuré des notes justes jouées jusqu'à +30 cents (F2 corde 6 case 1 : +30, G2 : +20, G#2 : +12), à cause de la pression du doigt et de la justesse de la guitare près du sillet, et jusqu'à 13 cents avec un vibrato léger. Avec ±30, une partie de ces notes serait refusée ; avec ±20, davantage. Le POC validait sur le demi-ton (nom de la note). | Par défaut : le demi-ton (±50 cents), comme dans le POC. ±30 et ±20 deviennent des options « justesse » pour les niveaux avancés. **Confirmé.** |
| P5 | §5.2 | « Détection stable pendant 100 ms » ne suffit pas : pendant la résonance, la note stable change sans nouvelle attaque (résonance de caisse vers 95 à 110 Hz, harmoniques), et au changement de corde la corde précédente sonne encore (4 des 7 erreurs de la session de 19:54). | Règles du POC reprises : seule compte la première note stable après une attaque ; la note de la question précédente est ignorée une fois ; une attaque sans note au bout de 1,5 s affiche « note non reconnue » sans compter d'erreur. |
| P6 | §5.2, §6 | Le micro identifie une hauteur, pas une position. Il ne peut pas vérifier la corde jouée (B4 = corde 2 case 12 = corde 1 case 7), ni l'octave quand l'octave n'est pas stricte. | La spécification le dit : la corde est une consigne. Les statistiques du mode 2 sont attribuées à la position demandée. |
| P7 | §3 | « Android, navigateur Chrome » : les journaux du POC n'enregistrent pas le navigateur. | Laissé tel quel. **Confirmé** : le POC a été fait avec Chrome. |
| P8 | §10, §4 | « Le micro n'est pas testable en CI. » Pendant le POC, la campagne a été testée dans Chromium avec un fichier WAV en guise de micro (`--use-fake-device-for-media-stream`, `--use-file-for-fake-audio-capture`). | Test end-to-end du mode 2 avec des sons enregistrés ou synthétiques. La checklist manuelle reste nécessaire. |
| P9 | §5.4, §7 | Le calibrage du seuil de silence n'a pas de moment défini. Le POC a montré qu'une mesure faite pendant qu'on joue fixe un seuil trop haut et bloque toute détection. | Calibrage de 2 s au démarrage du micro, avec la consigne « ne jouez pas » ; relançable depuis les réglages. |
| P10 | §9 | Latence : la condition « si elle dépasse 300 ms sur Android » est déjà mesurée. Médiane de 183 à 200 ms, maximum 283 ms, 229 sur 229 sous 300 ms, avec une fenêtre de 4096 échantillons. La latence d'entrée du matériel n'est pas comprise dans ces chiffres. | Valeurs reportées ; la fenêtre de 2048 reste une réserve. |
| P11 | §2 | Les exclusions ne citent pas ce que le POC n'a pas validé : la guitare électrique (hors périmètre), les ordinateurs (mode 2) et l'iPhone. | Ajouté aux exclusions et aux limites. |
| P12 | §5.2 | Affichage de la question. Le POC a montré qu'afficher la corde et la case rend le jeu fluide, mais teste alors la détection et non la connaissance du manche. | Par défaut, la question donne la note et la corde, et l'utilisateur cherche la case ; l'option « afficher la case » sert d'aide. |
| P13 | §5.3 | Accordeur : la zone orange (±15 cents) n'est pas mentionnée ; enseignement du POC : suivre la hauteur en continu, sans attendre d'attaque, avec la tolérance d'octave. | Ajouté. |
| P14 | §8 | Les règles de validation du mode 2 sont dans `poc-guitare/src/journal/campagne.ts` (`Campagne.traiterNote`), pas dans `audio/`. | §8 indique où les reprendre (`quiz/validation.ts`). |

## Incohérences internes

| # | § | Constat | Correction (version 2) |
|---|---|---|---|
| I1 | §5.1, §6, §7, §10 | Nombre de cases incohérent : « 15 cases (0 à 14) » avec un marqueur en case 15, `Case` de 0 à 15, une grille 6 × 16 et des tests sur 6 × 16 positions, alors que le niveau 5 s'arrête à la case 12. | Cases 0 à 12 partout (6 × 13 positions), marqueurs aux cases 3, 5, 7, 9 et 12 : c'est la plage du niveau 5 et la limite du mode 2 (E5). **Confirmé.** |
| I2 | §5.4 | Niveau 2 « cordes à vide, toutes les notes (dièses et bémols) » : impossible en accordage standard, les six cordes à vide sont E, A, D, G, B, E, déjà couvertes par le niveau 1. | Niveaux revus : 1 cordes à vide ; 2 cases 0 à 5, notes naturelles ; 3 cases 0 à 5, toutes les notes ; 4 cases 0 à 7 ; 5 cases 0 à 12. **Confirmé.** |
| I3 | §5.1 | Renvoi à une option « une seule position / toutes les positions » qui n'existe pas en 5.4. | Règle fixée : la question donne une note et une corde ; toute case de cette corde qui donne cette note est acceptée (case 0 et case 12 pour une corde à vide). |
| I4 | §6 | Statistiques « mises à jour dans le mode concerné », mais le modèle n'a pas de champ mode. | Champ `mode: 1 \| 2` ajouté à `Statistique`. |
| I5 | §5.4 | Dièses et bémols : aucune convention d'affichage. Le POC affiche en dièses. | Affichage en dièses (A#) en v1. |
| I6 | §5.1, §5.2, §2 | Le mode 2 est limité aux « frettes 1 à 5 » alors que les niveaux montent à la case 12 ; on ne sait pas si les niveaux valent pour les deux modes. | Niveaux communs aux deux modes ; un niveau dont les positions dépassent la plage validée du mode 2 y est limité à cette plage. |
| I7 | en-tête, §8, §12 | Dépôt « à confirmer » et `deploy.yml` : le dépôt `gnatali/fretmap` existe, avec `ci.yml` et `pages.yml`, et GitHub Pages publie actuellement le POC. L'arborescence place l'application à la racine du dépôt, où se trouvent déjà `poc-guitare/` et `docs/`. | Application dans `app/` ; Pages publie l'application à la racine du site et le POC sous `/poc/`. **Confirmé.** |
| I8 | §10 | Checklist manuelle « frettes 1 à 5, au moins 90 % » sans outil de mesure. | La campagne guidée du POC sert d'outil (scénarios 1, 3, 6 et 4) ; son journal est analysé avec le skill `analyser-journal`. |
| I9 | §6 | `tolerance: 20 \| 30 \| 50` sans valeur par défaut. | Défaut 50 (voir P4). |

## Décisions du 26/10/2026

| # | Question | Décision |
|---|---|---|
| P4 | Tolérance par défaut du mode 2 | Demi-ton (±50 cents) ; ±30 et ±20 en option |
| P7 | Navigateur utilisé pendant le POC | Chrome |
| I1 | Nombre de cases du manche | Cases 0 à 12 |
| I2 | Contenu des niveaux | Cordes à vide ; 0–5 naturelles ; 0–5 toutes ; 0–7 ; 0–12 |
| I7 | Emplacement de l'application dans le dépôt | `app/`, POC publié sous `/poc/` |
| P2 | Mode 2 au-delà de la case 5 | Ouvert après le scénario 6 du POC (H2 jusqu'à E5), à jouer avant la phase 4 |
| §4 | Interface | Svelte (sans SvelteKit) |

## Décisions du 27/10/2026

| # | Question | Décision |
|---|---|---|
| N1 | Notation des notes affichées | Réglage anglo-saxonne / française / les deux ; « les deux » par défaut (« Mi (E) ») |
| N2 | Numéro d'octave en notation française | Le même qu'en anglo-saxon (Mi2 = E2) |
| N3 | Niveaux | Sept : cordes à vide ; 0–5, 0–7 et 0–12, chacun en notes naturelles puis toutes les notes |
| N4 | Conditions de passage | Niveaux 1 et 2 : 80 % sur 20 questions ; 3 à 6 : 80 % sur 30 ; 7 : mode libre |
| N5 | Notation avant l'écran Réglages | Implémentée dès la phase 3, avec un choix provisoire dans le mode 1 |
