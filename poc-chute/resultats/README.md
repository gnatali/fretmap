# Résultats du POC « Notes qui tombent »

Journaux exportés par la page (« Exporter le journal ») et leur analyse, du plus récent au plus ancien. Chaque journal est analysé avec le skill `analyser-journal-chute` (`.claude/skills/analyser-journal-chute/`). Protocole : spec §9 ; règles du mode progressif : spec §16.

## Journal du 30/10/2026, 18 h 39 (`journal-poc-chute-20261030-1839.json`)

**Session** : même téléphone, même micro et même guitare que le journal précédent. Deux parties en mode progressif, avec la version 2.2 de la spec : plafond de vitesse par niveau, un nom de note ne revient qu'après 2 autres, manche affiché jusqu'à la case 5 au moins.
- **Partie 1** : arrêtée avant la première note. Elle avait des réglages d'essai : 95 % pour le niveau, + 50 % de vitesse max par niveau, chute de 2 s.
- **Partie 2** : réglages par défaut. Elle va du niveau 1 au niveau 6 en 8 min 17 s de jeu, plus une pause de 31 s. Elle est arrêtée juste après le passage au niveau 6.

Images : médiane 16,6 à 16,7 ms, p95 16,8 ms, aucune au-delà de 33 ms (HC1).

| Niveau | Notes | Plafond | Essais | Durée | Justes | Fausses notes | Ratées | Délai médian |
|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 30 % | 22 | 34 s | 22 | 1 | 0 | 1,4 s |
| 2 | 9 | 35 % | 47 | 1 min 19 s | 47 | 3 | 0 | 1,5 s |
| 3 | 12 | 40 % | 61 | 1 min 57 s | 61 | 6 | 0 | 1,5 s |
| 4 | 15 | 45 % | 61 | 2 min 2 s | 60 | 7 | 1 | 1,7 s |
| 5 | 18 | 50 % | 62 | 2 min | 60 | 10 | 2 | 1,6 s |

Chaque niveau a été passé, sans note perdue.

**Effet des changements de la version 2.1** (comparaison avec la partie 5 du journal précédent) :

| | Journal précédent | Ce journal |
|---|---|---|
| Notes ratées | 50 sur 394 (13 %) | 3 sur 253 (1 %) |
| Fausses notes par note | 0,19 | 0,11 |
| Même nom à la suite | 23 | 0 |
| Délai médian depuis la note précédente | 1,1 s | 1,6 s |
| Niveau atteint | 3, en 7 min | 6, en 8 min |

Les deux changements ont l'effet voulu :
- **Plafond de vitesse** : avec 6 à 10 s de chute, les notes ne s'empilent plus et ne sont plus ratées en cascade. Le joueur prend un peu plus de temps par note, et se trompe moins.
- **Notes variées** : plus aucune note de même nom à la suite.

**Ce qui allonge les niveaux.** À partir du niveau 2, il manque toujours une seule note, et c'est une nouvelle note. Une nouvelle note sort souvent au début, car une note sans essai a le poids de tirage maximal : 1 + 3 × (1 − réussite) = 4. Après un premier essai réussi, son poids retombe vers 1, et elle ne sort plus qu'une fois sur 9 à 18 environ, selon le nombre de notes du niveau. Le niveau attend alors son 3e essai (`essaisMinimum`) :

| Niveau | Note en retard | Ses essais (rang dans le niveau) | Niveau passé à l'essai |
|---|---|---|---|
| 2 | Fa, corde 6, case 1 | 2, 35, 47 | 47 |
| 3 | La, corde 3, case 2 | 13, 21, 35, 38, 42, 61 | 61 |
| 4 | Sol, corde 6, case 3 | 5, 25, 61 | 61 |
| 5 | La#, corde 5, case 1 | 2, 29, 62 | 62 |

Au niveau 3, le retard a une autre cause : La (corde 3, case 2) est sortie souvent, mais ses fausses notes la gardaient sous 60 %.

**Notes faibles** :
- La, corde 3, case 2 : 7 fausses notes en 16 essais ;
- Do, corde 2, case 1, et Si, corde 2 à vide : 3 fausses notes chacune, en 22 et 19 essais.

**Méthodes** : les 9 combinaisons valident les niveaux au même essai, à deux exceptions près :
- « temps » valide le niveau 3 à l'essai 42 au lieu de 61 ;
- « taux » ne valide jamais le niveau 4, à cause des fausses notes de La (corde 3, case 2).

### Décisions (30/10/2026, spec version 2.3, annexe B13)
- **Tirage** : une note qui n'a pas encore ses `essaisMinimum` essais garde le poids maximal (4) jusqu'à les avoir. En simulation, sur 40 parties, les 3 nouvelles notes du niveau 2 ont leurs 3 essais en 23 notes en moyenne, au lieu de 37.
- **Réglages** : garder les valeurs par défaut pour la prochaine session, et continuer au niveau 6 (vitesse max de 55 %).

## Journal du 30/10/2026 (`journal-poc-chute-20261030-1559.json`)

**Session** : téléphone Android 10, Chrome 156, micro intégré, guitare acoustique. Ce journal est antérieur à la campagne S1 à S5 : ce sont les premiers essais.
- **28/10, mode classique** : 4 parties au niveau 2, vitesse fixe.
- **30/10, mode progressif** : 2 parties, version 2.0 de la spec. L'utilisateur a choisi un seuil par note de 80 % (60 % par défaut). La 2e partie reprend au niveau 3, avec une chute la plus courte de 2 s et une vitesse requise de 40 %.

Images : médiane 16,6 à 16,7 ms, p95 16,8 ms, presque aucune au-delà de 33 ms. L'animation tient (HC1).

### Mode classique (28/10)

| Partie | Chute | Fausse note | Notes | Justes | Fausses | Ratées | Temps de réponse médian |
|---|---|---|---|---|---|---|---|
| 1 | 6 s fixe | destruction | 30 | 8 | 8 | 14 | 2,7 s |
| 2 | 10 s fixe | destruction | 30 | 28 | 2 | 0 | 3,0 s |
| 3 | 10 s fixe | destruction | 21 (arrêtée) | 20 | 1 | 0 | 3,1 s |
| 4 | 6 s fixe | pénalité | 20 (arrêtée) | 0 | 0 | 20 | – |

- Au niveau 2, une chute de 6 s était trop rapide pour un temps de réponse de 3 s : 3 notes sont à l'écran, et une note attendue n'a plus qu'environ 2 s quand elle devient la plus basse. Avec 10 s, 28 notes justes sur 30.
- **Partie 4** : aucune note reconnue. 12 notes sont ratées alors qu'une attaque a été entendue, et 2 notes sont non reconnues. Le seuil de silence est très bas (−71,8 dBFS, pièce très calme). La partie a été arrêtée après 40 s. La cause reste à demander à l'utilisateur.

### Mode progressif (30/10)

| Partie | Niveau | Notes | Essais | Durée | Justes | Fausses notes | Perdues | Ratées | Délai médian | Passé |
|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 1 | 6 | 30 | 38 s | 30 | 3 | 0 | 0 | 1,1 s | oui |
| 5 | 2 | 9 | 297 | 6 min 14 s | 258 | 57 | 1 | 38 | 1,0 s | oui |
| 5 | 3 | 12 | 67 | 1 min 35 s | 54 | 15 | 1 | 12 | 1,3 s | non |
| 6 | 3 (reprise, chute de 2 s) | 12 | 130 | 2 min 24 s | 80 | 17 | 0 | 50 | 1,0 s | non |

**Ce qui bloquait le passage.** Le script rejoue les conditions après chaque essai :
- **Vitesse** : rarement en cause. Elle n'était insuffisante qu'après 7 % des essais du niveau 2, et 15 % du niveau 3.
- **Seuil des notes** : il y avait presque toujours au moins une note sous 80 %. Le plus souvent, Do (corde 2, case 1) et Si (corde 2 à vide), deux notes voisines.
- **Notes ratées** : la vitesse montait seule à 100 % (chute de 3 s), donc plusieurs notes se trouvaient à l'écran et étaient ratées en cascade : 38 au niveau 2. Une note ratée vaut 0. Avec un seuil de 80 % sur les 5 derniers essais, une note ratée une fois doit ensuite être jouée parfaitement 4 fois.
- **Plus la chute est courte, plus il y a de notes ratées** :
  - partie 6 : 44 % des notes ratées sous 4 s de chute, contre 20 % entre 4 et 6 s ;
  - parties 5 et 6 : aucune note ratée au-dessus de 8 s de chute, mais sur seulement 22 essais.

**Comparaison des méthodes** (niveau 2 de la partie 5, premier essai où le niveau serait passé) :

| Seuil par note | score | taux | temps |
|---|---|---|---|
| 80 % (choisi) | essai 297 (374 s) | essai 297 (374 s) | essai 135 (190 s) |
| 60 % (défaut) | essai 127 (180 s) | essai 143 (198 s) | essai 115 (168 s) |

- **Méthode globale** : la moyenne, la moyenne pondérée et les derniers essais donnent presque le même essai. Ici, ce sont les notes qui décident, pas le niveau.
- **« taux »** ne valide jamais le niveau 1 à 80 % : une seule fausse note parmi les 5 derniers essais suffit à passer sous le seuil.
- **« temps »** passe plus tôt, car il ne regarde que la rapidité des notes justes.
- **Seuil** : au seuil par défaut de 60 %, la méthode « score » aurait validé le niveau 2 deux fois plus vite.

**Notes de même nom à la suite** : 23 fois (dont 3 fois 3 de suite) sur 394 notes dans la partie 5, 11 fois sur 130 dans la partie 6, et 10 fois sur 101 dans les parties classiques.

### Décisions (30/10/2026, spec version 2.1, annexe B9 à B11)
- **Plafond de vitesse par niveau** : 30 % de la vitesse max au niveau 1, puis + 5 % par niveau (réglables). Pour passer, il faut atteindre ce plafond, et le réglage « vitesse requise » disparaît. Au niveau 2, la chute la plus courte passe de 3 s à 8,6 s.
- **Notes variées** : un nom de note ne revient qu'après 2 notes d'un autre nom, dans les deux modes.
- **À essayer à la prochaine session** :
  - revenir au seuil par note par défaut (60 %), ou à 70 % ;
  - continuer au niveau 3 (plafond de 40 %, soit 7,5 s de chute avec une chute la plus courte de 3 s).
