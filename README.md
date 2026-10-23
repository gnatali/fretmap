# fretmap

Site d'apprentissage des notes du manche de guitare (mode sans guitare, mode avec guitare et accordeur).

Le projet commence par un POC qui vérifie qu'un navigateur peut détecter de façon fiable la hauteur d'une guitare jouée seule.

| Dossier | Contenu |
|---|---|
| [`poc-guitare/`](poc-guitare/) | POC de détection de hauteur et d'accordeur (TypeScript, Vite, pitchy) |
| [`docs/specs-poc-manche-guitare.md`](docs/specs-poc-manche-guitare.md) | Spécifications du POC |
| [`docs/revue-specs.md`](docs/revue-specs.md) | Revue de cohérence des spécifications |

## Avancement du POC

- [x] J1 : Vite et TypeScript, accès micro, niveau sonore, calibrage du silence
- [x] J2 : pitchy, conversion fréquence → note, affichage, latence
- [ ] Validation de la détection sur une vraie guitare (préalable à J3)
- [ ] J3 : accordeur
- [ ] J4 : journal de test, scénarios 1 à 4
- [ ] J5 : scénario 5, `SYNTHESE.md`, décision
