---
paths:
  - "CLAUDE.md"
  - ".claude/**"
---
# Rédaction et modularité de CLAUDE.md

## Où mettre quoi
- `CLAUDE.md` racine : moins de 200 lignes (viser une page), uniquement ce qui vaut pour toute session : état du projet, décisions prises, contraintes fortes, commandes. Il pointe vers les règles et les skills, sans les recopier.
- `.claude/rules/<sujet>.md` : règles propres à des fichiers ou dossiers, avec un en-tête YAML `paths:` (globs depuis la racine du dépôt). Ne pas restreindre par chemin ce qu'il faut savoir avant que les fichiers existent (ex. ce que le produit reprend du POC) : le laisser à la racine.
- `.claude/skills/<nom>/SKILL.md` : procédures en plusieurs étapes, avec un en-tête `name` et `description` (dire quand l'utiliser). Les scripts d'aide vont dans `scripts/` du skill ; ils réutilisent le code du projet au lieu de le recopier et sont vérifiés sur les données existantes avant le commit.

## Rédaction
- En français, phrases courtes, une règle par puce.
- Uniquement des faits vérifiés dans le code, les documents ou auprès de l'utilisateur ; rien de supposé.
- Pas de doublon : renvoyer vers la source (`SYNTHESE.md`, `resultats/README.md`, `docs/revue-specs.md`) plutôt que recopier des chiffres.
- Tenir `CLAUDE.md` à jour quand l'état change (tâche terminée, décision prise).

## Restructuration
- Avant de réorganiser ces fichiers : inventaire des règles, classement (racine, règle par chemin, skill), puis montrer l'arborescence et le contenu proposés à l'utilisateur. Ne rien écrire ni supprimer avant son accord.
- Après : `npm test` et `npm run build` dans `poc-guitare/`, commit en français, push sur `main`.
