# fretmap

Site d'apprentissage des notes du manche de guitare (mode sans guitare, mode avec guitare et accordeur).

Le projet commence par un POC qui vérifie qu'un navigateur peut détecter de façon fiable la hauteur d'une guitare jouée seule.

| Dossier | Contenu |
|---|---|
| [`app/`](app/) | Application (Svelte, TypeScript, Vite) |
| [`poc-guitare/`](poc-guitare/) | POC de détection de hauteur et d'accordeur (TypeScript, Vite, pitchy) |
| [`docs/specs-poc-manche-guitare.md`](docs/specs-poc-manche-guitare.md) | Spécifications du POC |
| [`docs/revue-specs.md`](docs/revue-specs.md) | Revue de cohérence des spécifications |
| [`poc-guitare/SYNTHESE.md`](poc-guitare/SYNTHESE.md) | Synthèse du POC : résultats par hypothèse et décision |
| [`docs/specs-app-apprentissage-manche.md`](docs/specs-app-apprentissage-manche.md) | Spécifications de l'application (version 2.7) |
| [`docs/revue-specs-app.md`](docs/revue-specs-app.md) | Revue des spécifications de l'application au regard du POC, décisions |
| [`poc-chute/`](poc-chute/) | POC du jeu « Notes qui tombent » (Svelte, TypeScript, Vite), futur mode 3 |
| [`docs/specs-poc-chute.md`](docs/specs-poc-chute.md) | Spécifications du POC « Notes qui tombent » |

## Démo en ligne

Publication automatique sur GitHub Pages à chaque push sur la branche par défaut :
- application : **https://gnatali.github.io/fretmap/**
- POC : **https://gnatali.github.io/fretmap/poc/**
- POC « Notes qui tombent » : **https://gnatali.github.io/fretmap/poc-chute/**

Le site est servi en HTTPS : le micro fonctionne aussi depuis un téléphone, sans certificat auto-signé.
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
- [x] Scénario 6 : cases 6 à 12, jusqu'à E5 (plage du produit, point I1) : 42/42, H2 validée de E2 à E5 (186/192)

## Application

- [x] Spécifications revues au regard du POC (version 2)
- [x] Points de la spec tranchés (interface en Svelte)
- [x] Scénario 6 du POC (avant la phase 4) : le mode 2 couvre les cases 0 à 12
- [x] Phase 1 : mise en place de `app/` (Svelte, lint, CI), modules audio et musique repris du POC, accueil déployé
- [x] Phase 2 : modèle de données, stockage `localStorage` (migration, export et import JSON), `music/manche.ts`
- [x] Phase 3 : mode 1 jouable (manche, quiz, score, niveau au choix), écran Statistiques, tests de bout en bout
- [x] Mode 1 : sept niveaux, notation des notes (« Mi (E) » par défaut, française ou anglo-saxonne)
- [x] Phase 4 : mode 2 (micro, calibrage, règles de validation du POC, indicateur en direct), statistiques par mode, test de bout en bout avec un micro simulé
- [ ] Mode 2 essayé sur Android avec la guitare (checklist manuelle, spec §10)
- [x] Phase 5 : accordeur (quatre accordages, cordes et chromatique, référence A4), écran Réglages, export et import JSON, réinitialisation
- [x] Phase 6 : niveaux débloqués automatiquement (par mode, 80 % sur les dernières réponses), tirage pondéré, focus clavier, affichage à 360 px
- [ ] Phase 7 : essais sur Android avec la guitare (checklist manuelle, spec §10), corrections

## POC « Notes qui tombent »

- [x] Spécifications (version 1), à partir de 20 questions
- [x] Phase 1 : squelette de `poc-chute/`, copies figées de l'application, CI et Pages
- [x] Phase 2 : logique du jeu (`src/jeu/`) et tests unitaires
- [x] Phase 3 : écrans en portrait, animation, mode simulation (au clavier), journal, tests de bout en bout
- [ ] Phase 4 : micro (calibrage, détection, indicateur en direct)
- [ ] Phase 5 : campagne sur Android, synthèse, décision
