# fretmap

Site d'apprentissage des notes du manche de guitare (`docs/specs-poc-manche-guitare.md` §1) : mode 1 sans guitare (manche virtuel), mode 2 avec guitare (la page reconnaît la note jouée), accordeur.

## État
- **POC terminé, décision Go** : `poc-guitare/SYNTHESE.md` (conclusions), `poc-guitare/resultats/README.md` (mesures).
- **Reste à faire** : jouer le scénario 6 (cases 6 à 12, cordes 2 et 1, jusqu'à E5) puis compléter H2. Quand l'utilisateur envoie un journal, suivre le skill `analyser-journal`.
- **Décidé** : plage jusqu'à E5 (I1) ; matériel validé = micro intégré d'un téléphone Android ; accordeur validé ; guitare électrique hors périmètre ; ordinateurs et iPhone non testés. Autres points : `docs/revue-specs.md`, issue #1.
- **Pas de spécification du produit final** : la demander à l'utilisateur avant de commencer.

## À reprendre du POC dans le produit
- `poc-guitare/src/music/` et `src/audio/` : sans DOM, testés, réutilisables tels quels.
- Mode 2 : se fier à la première note stable après une attaque (`apresAttaque`) ; ignorer une fois la note de la consigne précédente (`Campagne.traiterNote`).
- Garder la tolérance d'octave ; calibrer le seuil de silence sans jouer (bruit ambiant + 10 dB).

## Règles
- Tout en français : code, commentaires, docs, commits, échanges.
- Modifier `CLAUDE.md` ou `.claude/` : suivre `.claude/rules/claude-md.md` (racine < 200 lignes, règles par chemin, skills).
- Push direct sur `main` (branche par défaut), pas de PR sans demande. Chaque push lance la CI et le déploiement Pages (https://gnatali.github.io/fretmap/, source Pages = « GitHub Actions ») : vérifier les deux.
- Dans `poc-guitare/` : `npm test`, `npm run build` (tsc + Vite), `npm run dev:https` (téléphone ; via `@vitejs/plugin-basic-ssl`, Vite n'a pas d'option `--https`).
