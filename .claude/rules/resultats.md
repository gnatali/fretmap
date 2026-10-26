---
paths:
  - "poc-guitare/resultats/**"
  - "poc-guitare/SYNTHESE.md"
---
# Résultats et synthèse

- « micro intégré portable » dans la colonne `materiel` = micro intégré d'un **téléphone Android** (pas un ordinateur).
- Les taux portent sur les notes jouées : première détection après une attaque (`attaque = true`). Les changements sans attaque (résonance de caisse vers 95 à 110 Hz, harmoniques) sont analysés à part.
- Un essai sans `note_detectee` compte comme une erreur, sauf dans `2-accordage-bruyant`.
- Chaque journal est gardé en JSON (export d'origine) et en CSV (livrable §11).
- Ne pas affirmer ce que le journal n'enregistre pas (navigateur, accordage de référence, corde et case jouées).
- La synthèse tient sur une page ; les chiffres doivent être identiques dans `SYNTHESE.md`, `resultats/README.md` et le `README.md` racine.
