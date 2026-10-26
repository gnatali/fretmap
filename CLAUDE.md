# fretmap : mémo pour reprendre le projet

Site d'apprentissage des notes du manche de guitare. Le produit final aura trois parties (voir `docs/specs-poc-manche-guitare.md` §1) :
- mode 1, sans guitare : un manche virtuel ;
- mode 2, avec guitare : la page demande une note, l'utilisateur la joue, la page la reconnaît ;
- un accordeur.

## Où en est le projet

- **Le POC est terminé, avec la décision Go.** Les conclusions sont dans `poc-guitare/SYNTHESE.md` : résultats par hypothèse, paramètres retenus, matériel recommandé et enseignements pour le produit. Le détail des mesures est dans `poc-guitare/resultats/README.md`.
- **Reste à faire pour le POC** : jouer le scénario 6 de la campagne (cases 6 à 12 des cordes 2 et 1, jusqu'à E5), puis compléter H2 dans la synthèse et dans `resultats/README.md`. L'utilisateur envoie le journal JSON exporté ; il faut le copier dans `poc-guitare/resultats/` avec sa version CSV.
- **Décisions prises** :
  - le produit va jusqu'à E5 (point I1) ;
  - le matériel validé est le micro intégré d'un téléphone Android (« micro intégré portable » dans les journaux) ;
  - l'accordeur est validé sur une guitare ;
  - la guitare électrique est hors périmètre ;
  - les ordinateurs et l'iPhone n'ont pas été testés.
- **Points de spécification** : voir `docs/revue-specs.md` et l'issue GitHub #1. I1 et I7 sont décidés ; les autres points sont des recommandations, appliquées dans le POC.
- **Pas encore de spécification du produit final** (modes 1 et 2, interface). Il faut la demander à l'utilisateur avant de commencer.

## Ce que le produit doit reprendre du POC

- `poc-guitare/src/music/` (notes, accordages) et `poc-guitare/src/audio/` (micro, niveau, chaîne de détection) sont réutilisables tels quels. Ils sont sans DOM et testés.
- Pour le mode 2, se fier à la **première note stable après une attaque** (`EtatDetection.apresAttaque`). Si cette note est celle de la consigne précédente, l'ignorer une fois : c'est la corde précédente qui sonne encore (voir `Campagne.traiterNote`).
- La tolérance d'octave doit rester activée.
- Le seuil de silence se calibre sans jouer : mesure du bruit ambiant + 10 dB.

## Conventions

- Tout est écrit en français : code, commentaires, documents, messages de commit, échanges avec l'utilisateur.
- Les pushs se font directement sur `main`, qui est la branche par défaut. Ne pas ouvrir de PR sans demande.
- Chaque push sur `main` lance la CI (`.github/workflows/ci.yml`) et le déploiement GitHub Pages (`pages.yml`), visible sur https://gnatali.github.io/fretmap/. Le déploiement exige que la source Pages soit réglée sur « GitHub Actions ».
- Commandes, à lancer dans `poc-guitare/` :
  - `npm test` (Vitest) ;
  - `npm run build` (tsc puis Vite) ;
  - `npm run dev:https` pour tester depuis un téléphone. Vite n'a pas d'option `--https` : le script passe par `@vitejs/plugin-basic-ssl`.
- Piège pitchy : `clarityThreshold` est la constante k de McLeod, pas un filtre. Le filtre de clarté (0,9) est appliqué à part, dans `rejetMesure`.
