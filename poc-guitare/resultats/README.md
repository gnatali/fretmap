# Résultats des tests

Journaux exportés depuis la page, en JSON (export d'origine) et en CSV (livrable §11).

## Session du 26/10/2026 à 22:47, scénario 5 : `journal-poc-guitare-20261026-2247`

Guitare acoustique, micro intégré du portable. Campagne réduite au scénario 5 (jeu naturel), avec la version qui affiche la corde et la case à jouer (cases 0 à 5) et la règle « corde précédente encore sonore ».

| Mesure | Valeur |
|---|---|
| Notes jouées | 20, sans changement sans attaque ni non-détection |
| Bonnes notes | **20/20 (100 %)**, aucune erreur d'octave |
| Latence | médiane 183 ms, de 117 à 217 ms, 20 sur 20 sous 300 ms |
| Écart moyen absolu | 5,4 cents (notes jouées en case, avec vibrato : l'écart traduit le jeu, pas la détection) |
| Notes couvertes | de E2 à G4 |

Avec la session de 19:54 (98 % en bruit de fond), **H5 est validée**. Sur 20 notes toutes justes, la borne basse de l'intervalle de confiance à 95 % est d'environ 84 %. Le journal n'enregistre pas la corde et la case jouées, seulement la note attendue.

## Session du 26/10/2026 à 19:54, campagne guidée : `journal-poc-guitare-20261026-1954`

Guitare acoustique, micro intégré d'un ordinateur portable. 252 essais enregistrés par la campagne guidée, avec la tolérance d'octave activée. **Le scénario 5 (13 essais) est exclu de cette analyse** et devra être refait.

Les taux portent sur les notes jouées, c'est-à-dire la première détection après une attaque.

| Scénario | Notes jouées | Bonnes notes | Écart moyen absolu | Latence médiane | < 300 ms | Octaves erronées | Changements sans attaque |
|---|---|---|---|---|---|---|---|
| 1 · cordes à vide, calme | 60 | 57/60 (95 %) | 3,0 cents | 196 ms | 60/60 | 0 | 14 |
| 3 · cases 1 à 5, six cordes (F2 à A4) | 90 | 87/90 (96,7 %), dont 1 non détectée | 6,0 cents | 200 ms | 89/89 | 0 | 11 |
| 2 · cordes à vide, bruit | 60 | 59/60 (98,3 %) | 3,9 cents | 200 ms | 60/60 | 0 | 3 |
| 4 · silence 30 s | — | — | — | — | — | — | 0 faux positif |

### Hypothèses

| # | Critère | Résultat | État |
|---|---|---|---|
| H1 | Écart moyen < 5 cents | 3,0 cents (scénario 1). Écart-type par corde entre 0,3 et 1,3 cent ; les décalages propres à chaque corde (A2 −6,6, G3 +3,9…) se retrouvent en scénario 2, avec une légère dérive : ils viennent de l'accordage | Validée |
| H2 | ≥ 90 % de bonnes notes | 144/150 (96 %) sur les scénarios 1 et 3, de E2 à A4 | Validée jusqu'à A4 ; E5 non testé (point I1) |
| H3 | Latence < 300 ms | 209 sur 209 sous 300 ms ; médiane 196 à 200 ms, maximum 283 ms | Validée |
| H4 | 0 note sur 30 s de silence | 0 faux positif | Validée (un seul test) |
| H5 | ≥ 80 % en conditions réelles | 98,3 % en bruit (scénario 2) | Validée pour le bruit ; le scénario 5 reste à refaire |

D'après les critères du §8, ces résultats donnent un **Go provisoire** avec le micro intégré du portable. Limites : une seule guitare (acoustique), un seul appareil, et E5 n'est pas couvert.

Dans le scénario 3, les cases 1 à 4 de la corde 6 sortent nettement trop hautes (F2 +30 cents, G2 +20, G#2 +12). Ce sont des bonnes notes : l'écart vient de la pression du doigt et de la justesse de la guitare près du sillet, pas de la détection.

### Les 7 erreurs à l'attaque

- **4 au changement de corde** (essais 30, 50, 69 et 109, corrigés depuis : consigne d'étouffer la corde précédente, et première note ignorée une fois si c'est encore la note précédente). La page détecte la note de l'étape précédente : A2 au lieu de D3, G3 au lieu de B3, B3 au lieu de E4, D3 au lieu de D#3. Pour au moins trois d'entre elles, la corde précédente sonne encore quand la nouvelle est attaquée, et la première détection prend l'ancienne note. En mode 2, ce sera une vraie situation d'usage.
- 1 non-détection (F2, corde 6 case 1) et 2 notes trop hautes sur cordes graves (F#2 → G2, E2 → G2), avec des latences courtes (116 ms) qui laissent penser à une détection prise sur le transitoire de l'attaque.

### Les 28 changements sans attaque

- **La tolérance d'octave fonctionne** : il n'y a plus aucun saut E2 → E3 ou F2 → F3, contre 15 lors de la session précédente.
- **Environ 15 changements vers 94 à 106 Hz** (A2 → G#2 à −62 cents, G2/A#2/F#2 → G#2, E2 → F#2) pendant que la note s'éteint. Ces fréquences correspondent à la résonance de caisse d'une guitare acoustique (environ 95 à 110 Hz) : quand la corde s'éteint, c'est la caisse qui domine.
- **5 sauts de deux octaves**, B3 → B5 (harmonique 4). La tolérance d'octave ne couvrait qu'une octave ; elle en couvre deux depuis.
- Quelques décalages d'un demi-ton vers le bas sur des notes jouées en case (F3 → E3, C4 → B3, F4 → E4).

## Session du 26/10/2026 à 19:03, avant correctifs : `journal-poc-guitare-20261026-1903`

Guitare acoustique, micro intégré d'un ordinateur portable. 127 essais enregistrés automatiquement : scénarios 1, 2 et 3. Le scénario 4 (silence) n'a pas été joué.

Session enregistrée avant trois changements de la page : la note attendue est désormais figée au début de chaque note, la tolérance d'octave est activée par défaut, et le journal distingue les notes jouées (`attaque = true`) des changements sans attaque. Ci-dessous, une note « jouée » est un essai avec latence.

### Chiffres bruts du journal

| Scénario | Essais | Bonnes notes | Octaves erronées | Écart moyen absolu | Latence médiane | Latences < 300 ms |
|---|---|---|---|---|---|---|
| 1 · six cordes à vide, calme | 43 | 32/43 (74 %) | 7 | 5,3 cents | 198 ms | 32/33 |
| 2 · six cordes à vide, bruit | 37 | 27/37 (73 %) | 4 | 6,7 cents | 200 ms | 27/27 |
| 3 · cases 1 à 5 de la corde 6 (F2 à A2) | 47 | 34/47 (72 %) | 4 | 9,0 cents | 167 ms | 31/31 |

Ces taux de bonnes notes mélangent trois choses différentes. Les 34 erreurs se répartissent ainsi :

| Origine | Essais | Explication |
|---|---|---|
| Changement de note sans attaque | 26 | Pendant que la corde résonne, la note stable change sans nouvelle attaque : 15 sauts à l'octave supérieure (E2 → E3 : 12, F2 → F3 : 3) et 11 décalages d'un demi-ton (surtout G2 → G#2 et A2 → G#2). En mode automatique, chaque changement devient un essai. Ces essais n'ont pas de latence. |
| Bug du journal (corrigé) | 6 | La note attendue était lue à la fin de la note, donc après le passage à la corde suivante dans l'accordeur : la dernière note de chaque série était comparée à la corde suivante (essais 18, 63, 71, 76, 100 et 115). |
| Erreur de détection à l'attaque | 2 | Essai 29 (G3 attendu, A2 détecté) et essai 81 (F2 attendu, F3 détecté). |

### Première détection après chaque attaque

C'est ce que voit l'utilisateur en mode 2 quand il joue la note demandée. Calcul sur les 91 essais avec latence, hors les 6 essais faussés par le bug :

| Scénario | Notes justes | Latence médiane | Latences < 300 ms |
|---|---|---|---|
| 1 · calme | 31/32 (97 %) | 191 ms | 32/32 |
| 2 · bruit | 24/24 (100 %) | 200 ms | 24/24 |
| 3 · cases 1 à 5 | 28/29 (97 %) | 167 ms | 29/29 |

### Précision

Sur les bonnes notes, l'écart moyen par corde est le même en pièce calme et en bruit, et varie très peu d'une attaque à l'autre :

| Corde | Écart moyen (calme / bruit) | Écart-type |
|---|---|---|
| A2 | −10,6 / −10,3 cents | 0,4 à 0,6 |
| D3 | −3,9 / −4,1 cents | 0,2 à 0,6 |
| G3 | +2,6 / +1,5 cents | 0,5 à 1,0 |
| B3 | −4,8 / −5,3 cents | 0,4 à 0,5 |
| E4 | −1,1 / −1,7 cents | 0,3 à 0,5 |
| E2 | −0,6 / −11,4 cents | 8 à 11 |

L'écart diffère d'une corde à l'autre mais reste stable pour une même corde : il vient de l'accordage de la guitare (corde A2 basse d'environ 10 cents), pas de la détection. Un biais de l'algorithme décalerait toutes les cordes du même nombre de cents. De A2 à E4, la détection est précise à environ 1 cent. E2 fait exception : ses valeurs s'étalent de −20 à +22 cents.

### Hypothèses (état provisoire)

| # | Critère | Résultat | État |
|---|---|---|---|
| H1 | Écart moyen < 5 cents | 5,3 cents au total, mais surtout dû à l'accordage ; dispersion ≤ 1 cent de A2 à E4, 8 à 11 cents sur E2 | Non conclu : guitare non accordée sur une référence |
| H2 | ≥ 90 % de bonnes notes | 97 % à l'attaque (59/61), 73 % en comptant les changements sans attaque | Validée à l'attaque, de E2 à E4 seulement |
| H3 | Latence < 300 ms | Médiane 167 à 200 ms ; 90 latences sur 91 sous 300 ms, la dernière à 300 ms exactement | Validée avec le micro intégré |
| H4 | 0 note sur 30 s de silence | Non mesuré dans cette session | À faire |
| H5 | ≥ 80 % de bonnes notes en conditions réelles | 100 % à l'attaque (24/24), 73 % en comptant les changements sans attaque | Validée à l'attaque, sur la partie bruit uniquement |

### Point faible identifié

Sur les cordes graves (E2, F2), avec le micro intégré, la détection saute souvent à l'octave supérieure pendant que la corde résonne : 15 fois sur 127 essais. C'est le risque « harmoniques, octave erronée » de la spécification (§13). En mode 2, la première détection après l'attaque est juste ; mais l'accordeur et l'affichage libre montrent la mauvaise octave au bout de quelques instants.

Réponse : tolérance d'octave, activée par défaut depuis. À vérifier lors de la prochaine session : les changements sans attaque sur E2 et F2 doivent quasiment disparaître.
