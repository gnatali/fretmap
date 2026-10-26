# fretmap

Site d'apprentissage des notes du manche de guitare (mode sans guitare, mode avec guitare et accordeur).

Le projet commence par un POC qui vérifie qu'un navigateur peut détecter de façon fiable la hauteur d'une guitare jouée seule.

| Dossier | Contenu |
|---|---|
| [`poc-guitare/`](poc-guitare/) | POC de détection de hauteur et d'accordeur (TypeScript, Vite, pitchy) |
| [`docs/specs-poc-manche-guitare.md`](docs/specs-poc-manche-guitare.md) | Spécifications du POC |
| [`docs/revue-specs.md`](docs/revue-specs.md) | Revue de cohérence des spécifications |
| [`poc-guitare/SYNTHESE.md`](poc-guitare/SYNTHESE.md) | Synthèse du POC : résultats par hypothèse et décision |

## Démo en ligne

Le POC est publié automatiquement sur GitHub Pages à chaque push sur la branche par défaut :
**https://gnatali.github.io/fretmap/**

La page est servie en HTTPS : le micro fonctionne aussi depuis un téléphone, sans certificat auto-signé.
Le workflow est `.github/workflows/pages.yml`. Il exige une activation unique : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

## Avancement du POC

- [x] J1 : Vite et TypeScript, accès micro, niveau sonore, calibrage du silence
- [x] J2 : pitchy, conversion fréquence → note, affichage, latence
- [x] Validation de la détection sur une vraie guitare (six cordes à vide reconnues, téléphone Android)
- [x] J3 : accordeur
- [x] J4 : journal de test
- [x] Campagne de test guidée (tous les scénarios avec un seul bouton)
- [x] Scénarios 1 à 4 (campagne du 26/10, micro intégré d'un téléphone Android)
- [x] Scénario 5 refait (positions au hasard) : 20/20
- [x] `SYNTHESE.md` : décision **Go**
- [x] Accordeur validé sur la guitare
- [ ] Scénario 6 : cases 6 à 12, jusqu'à E5 (plage du produit, point I1)
