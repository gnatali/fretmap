# Résultats de l'application

Exports et journaux envoyés par l'utilisateur, et leur analyse, du plus récent au plus ancien. Les journaux du mode 1 (`journal-mode1-*.json`) s'analysent avec le skill `analyser-journal-mode1`.

## Réussite des notes remise à zéro à chaque niveau (02/11/2026, spec version 3.10)

À la demande de l'utilisateur, les essais, les réussites et les notes acquises (hardcore) repartent de zéro à chaque passage de niveau : toutes les notes du niveau, anciennes comme nouvelles, sont à valider de nouveau, avec les mêmes règles (choix de l'utilisateur, `docs/revue-specs-app.md` N37). Avant, une note validée le restait : le niveau 2 commençait à 6/9.

- Les niveaux s'allongent avec le nombre de notes : en normal, au moins 18, 27, 45 et 72 essais aux niveaux 1, 2, 4 et 7 (3 essais par note), contre environ 28 par niveau dans les parties du 01/11.
- Simulation (`partie.test.ts`) : après le passage au niveau 2, il faut 33 notes en moyenne (27 à 45) pour que les 9 notes aient leurs 3 essais.
- Rejeu du journal de 23 h 51 avec cette règle (script du skill) :
  - niveau 1 inchangé (partie 12 : 13, 27, 31 et 33 essais) ;
  - aux niveaux suivants, la plupart des parties s'arrêtent avant que la nouvelle règle ne soit remplie (« non ») : leurs tirages favorisaient les nouvelles notes, et les niveaux duraient environ 25 essais ;
  - seule la partie 12, aux niveaux longs, donne des valeurs.

| Partie 12, niveau (essais joués) | Facile | Normal | Difficile | Hardcore             |
| -------------------------------- | ------ | ------ | --------- | -------------------- |
| 1 (59)                           | 13     | 27     | 31        | 33                   |
| 2 (51)                           | 39     | non    | non       | non                  |
| 3 (112)                          | 54     | 68     | 85        | non                  |
| 4 (368)                          | 84     | 131    | 148       | 329 (au lieu de 318) |

- **À mesurer** au prochain journal : la durée des niveaux avec cette règle, dans chaque difficulté.

## Journal du mode 1 du 01/11/2026, 23 h 51 (`journal-mode1-20261101-2351.json`)

**Session** : 12 parties, dont les 4 du journal de 21 h 09 (ci-dessous). Parties 5 à 8 : en facile, le soir du 31/10 (versions 3.1 à 3.4), niveaux 1 → 7, 7 → 7, 1 → 2 et 1 → 3. Parties 9 à 12 : le 01/11 à partir de 22 h 56, avec la version 3.4, une par difficulté (tableau). Remarques de l'utilisateur : la différence de difficulté n'est pas assez marquée ; impossible d'avancer en hardcore. Images : médiane et p95 de 16,7 ms.

| Partie | Difficulté | Niveaux | Essais | Cases fausses | Perdues | Ratées | Délai médian | Durée de jeu (jusqu'au dernier essai)                  |
| ------ | ---------- | ------- | ------ | ------------- | ------- | ------ | ------------ | ------------------------------------------------------ |
| 9      | Facile     | 1 → 5   | 98     | 8             | 0       | 0      | 1,2 s        | 3 min 0 s                                              |
| 10     | Normal     | 1 → 7   | 166    | 16            | 0       | 0      | 1,4 s        | 5 min 39 s                                             |
| 11     | Difficile  | 1 → 6   | 128    | 14            | 0       | 0      | 1,2 s        | 3 min 37 s                                             |
| 12     | Hardcore   | 1 → 4   | 590    | 36            | 0       | 0      | 1,3 s        | 19 min 12 s, dont 9 min 37 s au niveau 4 (et 3 pauses) |

### Facile, normal et difficile : le même jeu

- Rejeu avec les règles de la version 3.4 : dans les parties 9 à 11, les trois difficultés font passer chaque niveau au même essai. Dans la partie 12, le rejeu sans la note acquise aussi (27, 28, 27 et 28 essais).
- Ce qui décide du passage : le minimum de 3 essais par note et le plafond de vitesse. Au passage, la réussite du niveau est de 93 à 100 %, au-dessus des seuils (60, 80 et 90 %) ; score d'essai moyen de 0,93 à 0,95 ; aucune note perdue ni ratée.
- La vitesse, les essais par note et la rapidité exigée étaient les mêmes dans toutes les difficultés : seuls les seuils les distinguaient.
- Exiger des réponses en 1 s en difficile (réussite du niveau au moment des passages réels, parties 9 à 11) : avec une rapidité nulle à 6 s, elle ne baisse que de 1 à 3 points ; nulle à 4 s, elle tombe à 0,86 à 0,90 aux niveaux 4 à 6.

### Hardcore bloqué au niveau 4

- Niveaux 1 à 3 en 59, 51 et 112 essais. Niveau 4 : 368 essais sans passer, 14 notes acquises sur 15 ; Fa corde 4 case 3 ne l'a jamais été.
- **Règle des 5 de suite** (justes du premier coup, en 1,5 s au plus) : Fa 4/3 n'est propre et rapide que 8 fois sur 21 (38 %, délai médian 1,7 s), meilleure série 3. Essais de la note nécessaires en moyenne (simulation) :

| Réponses propres et rapides | 38 % | 50 % | 60 % | 75 % |
| --------------------------- | ---- | ---- | ---- | ---- |
| 5 de suite                  | 203  | 63   | 30   | 13   |
| 4 sur 5                     | 33   | 16   | 10   | 7    |

- Part des réponses propres et rapides par case (partie 12) : 75 % aux cases 0 et 1, 54 % à la case 2, 60 % à la case 3. Le seuil de 1,5 s tombe au milieu des temps sur les nouvelles notes, et la part baissera plus loin sur le manche.
- **Tirage** : au niveau 4, Fa 4/3 n'a été tirée que 21 fois sur 368 (5,7 %, moins que 1 sur 15), contre 33 fois pour Fa 6/1 et Ré 4/0, déjà acquises. Le poids suit la réussite (le score), haute pour une note juste mais un peu lente.
- Les notes acquises ne sont pas gardées d'une partie à l'autre : en reprenant au niveau 4, il faut acquérir de nouveau les 15 notes (solution proposée, non retenue).

Variantes de la note acquise rejouées sur la partie 12, avec les tirages réels (essai du niveau où il passerait) :

| Note acquise                        | Niveau 1 | Niveau 2 | Niveau 3 | Niveau 4 |
| ----------------------------------- | -------- | -------- | -------- | -------- |
| 5 de suite en ≤ 1,5 s (version 3.5) | 59       | 51       | 112      | non      |
| **4 sur 5 en ≤ 1,5 s** (retenue)    | 33       | 40       | 95       | 318      |
| 5 de suite en ≤ 2 s                 | 59       | 40       | 95       | 318      |
| 3 de suite en ≤ 1,5 s               | 33       | 40       | 37       | 227      |

### Décisions (choix de l'utilisateur, spec version 3.6)

- **Difficultés** : vitesse, essais par note et rapidité selon la difficulté (`REGLAGES_DIFFICULTE`) :

| Réglage                            | Facile      | Normal (inchangé) | Difficile    | Hardcore     |
| ---------------------------------- | ----------- | ----------------- | ------------ | ------------ |
| Chute au niveau 1 (plafond)        | 15 s (20 %) | 10 s (30 %)       | 7,5 s (40 %) | 7,5 s (40 %) |
| Montée du plafond par niveau       | 3 %         | 5 %               | 7 %          | 7 %          |
| Essais minimum par note            | 2           | 3                 | 4            | 5            |
| Rapidité : 1 jusqu'à, 0 à          | 2,5 s, 8 s  | 1,5 s, 6 s        | 1 s, 4 s     | 1,5 s, 6 s   |
| Réussite de chaque note, du niveau | 40 %, 60 %  | 60 %, 80 %        | 60 %, 90 %   | 60 %, 80 %   |

- **Hardcore** : une note est acquise avec 4 réponses propres sur 5 essais de suite (`ACQUISE`), et une note pas encore acquise a le poids de tirage maximal (simulation sur un niveau de 12 notes, une note toujours lente : 17 à 19 % des tirages au lieu de 7 à 10 %).
- Non retenu : notes acquises gardées d'une partie à l'autre ; erreurs tolérées selon la difficulté.
- Rejeu avec les règles de la version 3.6 (vitesse recalculée avec le plafond de chaque difficulté) :
  - partie 10 (normal, réglages inchangés) : passages réels retrouvés (22, 27, 25, 25, 40 et 27 essais), vitesse recalculée égale à celle du journal ;
  - partie 12 : les difficultés s'échelonnent enfin.

| Partie 12, niveau | Facile | Normal | Difficile | Hardcore |
| ----------------- | ------ | ------ | --------- | -------- |
| 1                 | 13     | 27     | 31        | 33       |
| 2                 | 14     | 28     | 37        | 40       |
| 3                 | 18     | 27     | 30        | 95       |
| 4                 | 12     | 28     | 117       | 318      |

- Parties 9 à 11 : le facile passe plus tôt (partie 9 : 14, 13, 20 et 22 essais au lieu de 21, 19, 33 et 25) ; le difficile ne passe dans aucun niveau joué (il demande plus d'essais que la partie n'en a).
- **À mesurer** au prochain journal : le temps passé par niveau dans chaque difficulté, et le niveau 4 du hardcore avec le tirage des notes non acquises.

## Nouvelle règle de rapidité, évaluée sur les journaux (31/10/2026, spec version 3.4)

Demande de l'utilisateur : la rapidité d'un essai est le délai entre le moment où la note est demandée (elle devient la note attendue) et la bonne réponse ; l'apparition de la note pendant que la note précédente n'est pas encore jouée ne compte pas. Avant : moyenne de cette rapidité (1 jusqu'à 1,5 s, 0 à 6 s) et de la rapidité depuis l'apparition (1 jusqu'à 2 s, 0 à 10 s). Seuils gardés : 1,5 s et 6 s.

Rejeu des 632 essais des 4 parties (`journal-mode1-20261031-2109.json`), avec les règles de la version 3.2 :

- **Score moyen inchangé** : 0,898 avec les deux règles.
  - 434 notes justes sur 632 étaient demandées dès leur apparition (une seule note à l'écran) : la nouvelle règle les note un peu moins bien, car le seuil de 2 s à 10 s après apparition était plus large.
  - Les 198 autres attendaient déjà à l'écran (médiane 1,5 s, jusqu'à 5,7 s) : la nouvelle règle ne leur compte plus cette attente.
- **Passages** (essai du niveau où le passage serait validé, règle actuelle → nouvelle) : identiques, sauf deux.

| Partie, niveau              | Facile     | Normal     | Difficile  | Hardcore   |
| --------------------------- | ---------- | ---------- | ---------- | ---------- |
| 1 (normal), niveau 1        | 21 → 21    | 21 → 21    | 21 → non   | non → non  |
| 3 (facile), niveau 5        | 82 → 64    | 153 → 153  | 153 → 153  | non → non  |
| Les 10 autres niveaux joués | identiques | identiques | identiques | identiques |

- Le facile profite de la nouvelle règle quand les notes s'empilent (vitesse plus haute aux niveaux 5 et plus) : au niveau 5 de la partie 3, 18 essais de moins.
- Le difficile devient un peu plus strict sur les notes jouées seules à l'écran (niveau 1 : réponses entre 1,5 s et 2 s moins bien notées).
- Le hardcore ne change pas : la note acquise regardait déjà le seul délai depuis que la note est demandée (≤ 1,5 s).

## Journaux du mode 1 du 31/10/2026, 21 h 05 et 21 h 09 (`journal-mode1-20261031-2109.json`)

**Session** : le journal de 21 h 09 contient 4 parties ; celui de 21 h 05 (non gardé) en est un sous-ensemble (parties 1 à 3). La partie 1 est celle du journal de 1 h 08 ci-dessous. Remarques de l'utilisateur : le hardcore ne progresse pas ; le facile n'est pas assez facile. Images : médiane et p95 de 16,7 ms dans toutes les parties.

| Partie      | Difficulté | Niveaux         | Essais | Cases fausses | Perdues | Ratées | Délai médian | Durée de jeu (jusqu'au dernier essai) |
| ----------- | ---------- | --------------- | ------ | ------------- | ------- | ------ | ------------ | ------------------------------------- |
| 2 (8 h 03)  | Facile     | 1 → 5           | 144    | 18            | 1       | 0      | 1,3 s        | 5 min 27 s                            |
| 3 (19 h 57) | Facile     | 5 → 6 (reprise) | 187    | 34            | 0       | 3      | 1,9 s        | 6 min 37 s                            |
| 4 (20 h 05) | Hardcore   | 1 → 1           | 195    | 15            | 0       | 0      | 0,9 s        | 3 min 43 s                            |

**Hardcore : le niveau 1 ne passe jamais.**

- 82 % des 195 réponses sont justes du premier coup et rapides (≤ 1,5 s). Chaque corde à vide a fait des séries de 8 à 12 réponses propres.
- Mais la règle (version 3.1) demandait les 5 derniers essais propres de **chaque** note **au même moment** : environ 30 réponses propres d'affilée, quand la plus longue série propre de la partie est de 28. Une seule erreur sur une note la remettait à zéro pendant que les autres perdaient la leur.
- Rejeu avec la règle « note acquise » (5 réponses propres de suite à un moment de la partie) : niveau passé à l'essai 63. Avec 3 réponses : essai 56. En gardant la règle et un seuil de 2 s : essai 167.

**Facile : le seuil du niveau ne change rien.**

- La réussite du niveau était presque toujours au-dessus de 60 %. Le rejeu en facile (version 3.1) donne les mêmes passages qu'en normal.
- Ce qui bloquait : une note faible. Au niveau 5 de la partie 3 (153 essais, 5 min 12 s), Ré à vide est restée sous 60 % pendant 145 essais : 8 cases fausses en 12 essais, presque toujours sur Sol à vide. Une bonne case après une erreur vaut 0,44 ; avec 5 essais pris en compte, la note ne remontait pas.
- Rejeu du niveau 5 : seuil par note à 40 %, 82 essais au lieu de 153 ; bonne case après une erreur à 0,75, 87 ; les deux et sans condition de vitesse, 64. Le niveau 5 de la partie 2 passerait à l'essai 34.

**Erreurs** : surtout des voisines.

- À vide, la corde voisine : Ré → Sol 12 fois, La → Ré 8, Si → Sol 6, Si → Mi aigu 4.
- Avec la corde donnée, la case voisine : 27 cases fausses sur 37 à ±1 case.
- Notes faibles : Ré à vide, La corde 3 case 2 (5 cases fausses en 10 essais), Ré corde 2 case 3, Si corde 5 case 2, Si corde 3 case 4 (3 en 3).

### Décisions (31/10/2026, spec version 3.2, `docs/revue-specs-app.md` N24 à N27)

- **Hardcore** : une note est acquise après 5 réponses de suite justes du premier coup et en 1,5 s au plus, et le reste pour la partie ; le niveau passe quand toutes ses notes sont acquises (et les autres conditions).
- **Facile** : 40 % par note (60 % pour le niveau) ; la bonne case s'allume dès la 1re case fausse.
- **Toutes les difficultés** : compteur « Notes » (validées sur le total du niveau) pendant la partie, notes « à travailler » en fin de partie ; une note ratée revient 3 tirages plus tard (`revient` dans le journal).
- **À suivre** : jouer en facile et en hardcore avec ces règles, puis envoyer le journal. Les confusions de cordes voisines à vide sont à surveiller avec la note qui revient.

## Journal du mode 1 du 31/10/2026, 1 h 08 (`journal-mode1-20261031-0108.json`)

**Session** : première partie du jeu « Notes qui tombent » au toucher (spec version 3.0), en normal, sur le même téléphone Android (Chrome 156). 3 min 39 s de jeu jusqu'au dernier essai, plus une pause de 19 s, arrêtée juste après le passage au niveau 5. Images : médiane et p95 de 16,7 ms, aucune au-delà de 33 ms.

| Niveau | Notes | Essais | Durée | Cases fausses | Perdues | Ratées | Délai médian |
| ------ | ----- | ------ | ----- | ------------- | ------- | ------ | ------------ |
| 1      | 6     | 21     | 31 s  | 5             | 1       | 0      | 1,1 s        |
| 2      | 9     | 29     | 55 s  | 1             | 0       | 0      | 1,6 s        |
| 3      | 12    | 21     | 36 s  | 3             | 0       | 0      | 1,6 s        |
| 4      | 15    | 40     | 79 s  | 10            | 0       | 0      | 1,6 s        |

Résumé : 111 essais, 110 justes, 19 cases fausses, une note perdue (Si à vide, au 2e essai de la partie), aucune note ratée ; meilleure série 38 ; vitesse max 45 % ; score 25 896.

- **Répétition** : 111 essais en moins de 5 min, contre 104 réponses en une session de quiz. Chaque note a eu 3 à 12 essais ; les 3 notes ajoutées au niveau 5 n'ont pas été jouées (partie arrêtée).
- **Les niveaux passent vite** : entre 21 et 40 essais. La condition qui décide est celle de chaque note (3 essais, 60 %) et la vitesse ; la réussite du niveau était déjà au-dessus de 80 %.
- **Notes faibles** : les cordes à vide de Ré (4 cases fausses en 11 essais) et de Si (3 en 11), puis Sol à vide, Do corde 2 case 1, Mi corde 4 case 2, Si corde 5 case 2 et Fa corde 4 case 3 (2 chacune). La corde 4 (Ré) reste la plus faible, comme dans l'export du quiz.

**Rejeu des passages dans chaque difficulté** (essai du niveau où le passage serait validé ; « non » : pas dans les essais joués) :

| Niveau | Réel (normal) | Facile | Normal | Difficile | Hardcore |
| ------ | ------------- | ------ | ------ | --------- | -------- |
| 1      | 21            | 21     | 21     | 21        | non      |
| 2      | 29            | 29     | 29     | 29        | non      |
| 3      | 21            | 21     | 21     | 21        | non      |
| 4      | 40            | 40     | 40     | non       | non      |

- Le rejeu en normal retrouve les passages réels.
- **Facile** ne passe pas plus tôt ici : la réussite du niveau n'était pas la condition qui manquait.
- **Difficile** aurait gardé le niveau 4, où se trouvent 10 des 19 cases fausses.
- **Hardcore** demande au moins 5 essais par note (30 au niveau 1), tous sans erreur et en moins de 1,5 s : aucun niveau n'aurait passé dans ces essais.

### Décisions (31/10/2026, spec version 3.1, `docs/revue-specs-app.md` N21 à N23)

- Choix de la difficulté au départ du mode 1 : facile (niveau à 60 %), normal (80 %), difficile (90 %), hardcore (chaque note : 5 derniers essais justes du premier coup, en 1,5 s au plus).
- Records par difficulté ; niveau et notes atteints communs.

## Export de la progression du 31/10/2026 (`fretmap-progression-2026-10-31.json`)

**Session** : quiz du mode 1 (version 2.7 de la spec), le 30/10 de 23 h 13 à 23 h 19 environ (dates des dernières réponses), plus quelques réponses au mode 2 le 27/10. Niveau 4 atteint au mode 1.

**Mode 1** : 104 réponses, 93 justes (89 %), sur 29 positions des cases 0 à 5.

| Case       | Positions | Réponses | Réussite | Temps moyen |
| ---------- | --------- | -------- | -------- | ----------- |
| 0 (à vide) | 6         | 54       | 94 %     | 3,0 s       |
| 1          | 3         | 5        | 100 %    | 2,3 s       |
| 2          | 5         | 9        | 78 %     | 3,5 s       |
| 3          | 6         | 14       | 100 %    | 3,7 s       |
| 4          | 4         | 10       | 70 %     | 8,2 s       |
| 5          | 5         | 12       | 75 %     | 2,7 s       |

- **Trop peu de répétition** : la moitié des réponses porte sur les 6 cordes à vide. Les 50 autres se répartissent sur 23 positions, soit environ 2 essais par position ; 13 positions n'ont qu'1 ou 2 essais. Le niveau 2 ouvre d'un coup 17 positions, le niveau 3 en ouvre 30, et le passage (80 % sur les 20 ou 30 dernières réponses) ne demande pas que chaque note soit sue.
- **Points faibles** : la corde 4 (Ré : 6,6 s en moyenne à vide, 11 s en case 3, une erreur en case 4) et la case 4 (70 %, 8,2 s ; Si, corde 3, case 4 : 5 sur 7, 9,5 s). Temps médian par position : 2,6 s.
- **Peu d'enjeu** : 1 s d'attente entre les questions, un score de session seulement, pas de record.

### Décisions (31/10/2026, spec version 3.0, `docs/revue-specs-app.md` N15 à N20)

- Le mode 1 devient le jeu « Notes qui tombent » au toucher, repris du mode progressif du POC : 3 notes ajoutées par niveau, 3 essais minimum par note et poids de tirage maximal avant, 60 % par note et 80 % pour le niveau, vitesse plafonnée par niveau, points, série, bonus. Le 2e journal du POC (30/10, 18 h 39) a donné 253 essais en 8 min, du niveau 1 au niveau 6, avec 1 % de notes ratées.
- Réglages : ceux du POC par défaut. Les seuils de rapidité (rapide à 1,5 s, lent à 6 s depuis la note précédente) vont avec le temps médian du quiz (2,6 s) et le délai médian du POC à la guitare (1,4 à 1,7 s).
- Départ aux cordes à vide (un niveau connu passe vite : 34 s pour le niveau 1 dans le POC) ; statistiques gardées.
- **Prochaine étape** : jouer quelques parties, puis exporter le journal (« Exporter le journal », écran du mode 1, `journal-mode1-*.json`) et l'ajouter ici pour régler la vitesse, les seuils et le nombre de notes ajoutées.
