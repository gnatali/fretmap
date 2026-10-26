# Résultats des tests

Journaux exportés depuis la page, en JSON (export d'origine) et en CSV (livrable §11).

## Session du 26/10/2026 : `journal-poc-guitare-20261026-1903`

Guitare acoustique, micro intégré d'un ordinateur portable. 127 essais enregistrés automatiquement : scénarios 1, 2 et 3. Le scénario 4 (silence) n'a pas été joué.

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
