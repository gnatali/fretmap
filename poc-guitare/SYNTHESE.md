# Synthèse du POC : détection de hauteur d'une guitare dans le navigateur

**Question posée** : le mode 2 (jouer la note demandée) et l'accordeur sont-ils fiables avec le matériel visé ?
**Réponse** : **Go**. La détection est précise, rapide et stable avec le micro intégré d'un téléphone Android, y compris en jeu naturel, et l'accordeur a été validé sur la guitare. Limites : une seule guitare (acoustique), un seul appareil, et une plage mesurée jusqu'à A4 ; le produit visant E5, le scénario 6 (cases 6 à 12) reste à jouer.

## Conditions de test

- **Sessions de référence** : campagne guidée du 26/10/2026 à 19:54 pour les scénarios 1 à 4 ([journal](resultats/journal-poc-guitare-20261026-1954.csv)), et campagne de 22:47 pour le scénario 5, refait avec l'affichage corde et case ([journal](resultats/journal-poc-guitare-20261026-2247.csv)).
- **Matériel** : guitare acoustique (la campagne demande de l'accorder sur un accordeur de référence avant de commencer), micro intégré d'un téléphone Android (noté « micro intégré portable » dans les journaux), traitements audio du navigateur demandés désactivés.
- **Mesures** : 230 notes jouées (210 pour les scénarios 1 à 3, 20 pour le scénario 5) et un test de silence de 30 s. Les taux portent sur la première détection après l'attaque, c'est-à-dire ce que verra l'utilisateur en mode 2. Le détail est dans [resultats/README.md](resultats/README.md).

## Résultats par hypothèse

| # | Critère | Mesure | État |
|---|---|---|---|
| H1 | Écart moyen < 5 cents sur cordes à vide | 3,0 cents ; dispersion de 0,3 à 1,3 cent par corde. Le reste est l'accordage de la guitare. | ✅ Validée |
| H2 | ≥ 90 % de bonnes notes de E2 à E5 (scénarios 1, 3 et 6) | 144/150 (96 %) de E2 à A4, aucune erreur d'octave. A#4 à E5 : scénario 6 à jouer. | ✅ Validée jusqu'à A4 ; ⏳ E5 |
| H3 | Latence < 300 ms après l'attaque | 209 sur 209 sous 300 ms ; médiane de 196 à 200 ms, maximum 283 ms | ✅ Validée |
| H4 | 0 note sur 30 s de silence | 0 faux positif | ✅ Validée (un seul test) |
| H5 | ≥ 80 % en conditions réelles (scénarios 2 et 5) | Bruit de fond : 59/60 (98 %). Jeu naturel : 20/20 (100 %), latence médiane 183 ms, maximum 217 ms. | ✅ Validée |

## Décision

Selon §8, **Go** : H1 à H4 sont validées avec le micro intégré du téléphone, et H5 aussi avec le même matériel. Sur 20 notes jouées naturellement, toutes justes, la borne basse de l'intervalle de confiance à 95 % est d'environ 84 %, au-dessus du seuil de 80 %.

Points tranchés après la décision :
1. **Plage (I1)** : le produit va jusqu'à E5. Le scénario 6 de la campagne (cases 6 à 12 des cordes 2 et 1, A#4 à E5) complète H2 ; il reste à jouer.
2. **Accordeur** : validé sur la guitare.
3. **Guitare électrique** : non testée, hors du périmètre du POC. Le produit sera validé pour la guitare acoustique ; l'électrique reste un risque (moins de résonance de caisse, harmoniques plus marquées).

## Paramètres retenus

| Paramètre | Valeur | Remarque |
|---|---|---|
| Seuil de silence | Bruit ambiant + 10 dB, mesuré sur 2 s au lancement (−45 dBFS par défaut) | La mesure doit se faire sans jouer : un seuil trop haut bloque toute détection. |
| Clarté minimale | 0,9 | Suffisante : aucune fausse détection en silence |
| Fenêtre d'analyse | 4096 échantillons (85 ms à 48 kHz) | Latence déjà sous 300 ms ; 2048 reste une réserve. |
| Plage acceptée | 70 à 1400 Hz | |
| Lissage et stabilité | Médiane de 5 mesures ; note stable après 100 ms sur le même demi-ton | |
| Détection d'attaque | Passage au-dessus du seuil, ou hausse de 6 dB en 100 ms | Sert à mesurer la latence et à découper les notes. |
| Tolérance d'octave | 1 ou 2 octaves, ±50 cents, tant qu'aucune nouvelle attaque n'a lieu | A supprimé les sauts E2 → E3 ; étendue à 2 octaves pour B3 → B5. |
| Tolérance de justesse (accordeur) | Vert à ±5 cents, orange à ±15 ; « juste » après 300 ms | |

## Matériel recommandé

Le **micro intégré d'un téléphone Android** suffit, dans une pièce calme ou avec un bruit de fond modéré : il n'est pas nécessaire d'exiger un casque ou un micro USB. Le navigateur doit désactiver l'annulation d'écho, la réduction de bruit et le gain automatique ; la page vérifie que c'est bien le cas. Les ordinateurs, l'iPhone et les guitares électriques n'ont pas été testés.

## Enseignements pour le produit

- **Mode 2 : se fier à la première détection après l'attaque.** Les changements de note pendant la résonance (résonance de caisse vers 95 à 110 Hz, harmoniques) ne doivent pas changer la réponse.
- **Mode 2 : ignorer une fois la note précédente encore sonore.** Lors d'un changement de corde, la corde précédente était parfois détectée à la place de la nouvelle (4 des 7 erreurs de la session de 19:54). Avec cette règle et la consigne d'étouffer la corde, le scénario 5 n'a enregistré aucune erreur.
- **Mode 2 : indiquer la corde et la case plutôt que la note** quand on veut mesurer la détection (et non la connaissance du manche) : le jeu est fluide, sans temps de recherche de la note.
- **Accordeur** : validé sur la guitare. Garder la tolérance d'octave, mais suivre les variations de hauteur sans attendre d'attaque.
- **Latence** : la mesure part de l'attaque vue dans le tampon audio. La latence d'entrée du matériel s'y ajoute (non mesurée ici, variable d'un téléphone à l'autre) ; la marge sous 300 ms reste confortable.
