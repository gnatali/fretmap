# Résultats des tests

Journaux exportés depuis la page, en JSON (export d'origine) et en CSV (livrable §11).

## Session du 25/10/2026 : `journal-poc-guitare-20261025-1114`

Téléphone Android, guitare et matériel non renseignés dans le journal. Seules la corde de mi grave (E2) et ses cases 1 à 5 ont été jouées.

| Scénario | Essais | Bonnes notes | Écart moyen absolu | Latence médiane | Latences < 300 ms | Faux positifs |
|---|---|---|---|---|---|---|
| 1 · cordes à vide, calme (E2 seulement) | 8 | 8/8 | 2,0 cents | 219 ms | 8/8 | — |
| 2 · cordes à vide, bruit (E2 seulement) | 14 | 13/14 (93 %) | 3,4 cents | 302 ms | 6/13 | — |
| 3 · cases 1 à 5 de la corde 6 (F2 à A2) | 21 | 21/21 | 2,1 cents | 222 ms | 12/21 | — |
| 4 · silence 30 s | 1 | — | — | — | — | 0 |

Observations :

- Aucune erreur d'octave.
- Scénario 2 : une fausse note (essai 18, F2 au lieu de E2, sans attaque détectée, 0,2 s après la note précédente) ; cinq latences entre 686 et 1654 ms.
- Scénario 3 : latences de 200 à 220 ms pour F2, F#2 et G2, mais de 336 à 554 ms pour G#2 et A2 (cases 4 et 5), de façon systématique.
