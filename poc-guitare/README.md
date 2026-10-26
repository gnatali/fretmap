# POC guitare : détection de hauteur

Page unique, sans backend, qui capte le micro et affiche la note jouée sur une guitare, sa fréquence et l'écart en cents.
Objectif : vérifier que la détection est assez fiable pour le mode « avec guitare » et l'accordeur (voir [les spécifications](../docs/specs-poc-manche-guitare.md)).

## Installation

Node.js LTS (22.12 ou plus) est nécessaire pour le développement uniquement.

```sh
cd poc-guitare
npm install
```

## Lancement

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement sur http://localhost:5173 |
| `npm run dev:https` | Serveur HTTPS accessible depuis le réseau local (téléphone). Le certificat est auto-signé : accepter l'avertissement du navigateur. |
| `npm test` | Tests unitaires (Vitest), sans micro |
| `npm run build` | Vérification TypeScript et build dans `dist/` |

Le micro exige un contexte sécurisé : `localhost` ou HTTPS.

Version en ligne, mise à jour à chaque push sur la branche par défaut : https://gnatali.github.io/fretmap/poc/ (pratique pour tester sur téléphone).

## Campagne de test guidée

La section **Campagne de test guidée**, en haut de la page, déroule les scénarios du protocole (§7) avec un seul bouton :

1. Renseigner **Guitare** et **Matériel**, choisir les scénarios et le nombre d'attaques (durée estimée affichée), puis **Lancer la campagne**. Le micro démarre s'il est arrêté.
2. **Préparation** : accorder la guitare sur un accordeur de référence, puis **Continuer**. Le bruit ambiant est mesuré pendant 2 s (ne pas jouer).
3. Les étapes s'enchaînent seules. Chaque note à jouer s'affiche en grand avec l'endroit où la jouer (« Corde 4, case 3 · F3 » ; au scénario 5, seulement la position : « Corde 3 · Case 2 »), un compteur (2 / 3) et le résultat de la dernière attaque (✓ E2 +2 cents · 190 ms, ✗ E3 au lieu de E2, ✗ non détectée). L'étape suivante démarre dès que le compte est atteint.
4. **Continuer** n'apparaît que lorsqu'une pause est nécessaire : avant le silence (scénario 4, 30 s avec compte à rebours) et avant le scénario bruyant (scénario 2, placé en dernier pour n'allumer la source de bruit qu'une fois).
5. À la fin, **Exporter CSV / JSON**.

| Ordre | Scénario | Contenu par défaut |
|---|---|---|
| 1 | 1 · cordes à vide, calme | 6 cordes × 10 attaques |
| 2 | 3 · cases 1 à 5 | 6 cordes × 5 cases × 3 attaques (F2 à A4) |
| 3 | 6 · aigus, cases 6 à 12 | cordes 2 et 1 × 7 cases × 3 attaques (F4 à B4, A#4 à E5) : plage jusqu'à E5 (point I1) |
| 4 | 5 · jeu naturel | 20 positions au hasard (corde et case, cases 0 à 5), une attaque chacune ; la note n'est pas affichée avant le jeu |
| 5 | 4 · silence | 30 s |
| 6 | 2 · cordes à vide, bruit | 6 cordes × 10 attaques |

Règles de comptage :
- une répétition = une note jouée (nouvelle note stable après une attaque) ; les changements sans attaque sont enregistrés mais ne comptent pas ;
- à chaque changement de corde, la consigne demande d'étouffer la corde précédente ; si la première note jouée d'une étape est encore la note de l'étape précédente (corde qui sonne encore), elle est ignorée une fois, non comptée et non enregistrée, comme le fera le mode 2 ; ensuite, elle compte comme une erreur ;
- une attaque sans note stable après 1,5 s est enregistrée « non détectée » et compte comme une erreur, sauf en scénario 2 où le bruit peut déclencher une fausse attaque (enregistrée, non comptée) ;
- **Passer l'étape** saute la note en cours ; **Arrêter** met fin à la campagne (les essais restent dans le journal) ;
- si la page est rechargée, **Reprendre la campagne** repart du début de l'étape en cours ; si le micro est arrêté, l'étape reprend à son début après **Démarrer**.

Pendant la campagne, les sections Réglages, Accordeur et Historique sont masquées pour garder l'écran lisible sur téléphone.

## Utilisation libre

1. Cliquer sur **Démarrer** et autoriser le micro. La page affiche la fréquence d'échantillonnage, la fenêtre d'analyse et l'état des traitements du navigateur (qui doivent être désactivés).
2. Sans jouer, cliquer sur **Mesurer le bruit ambiant** : le seuil de silence est fixé au bruit mesuré pendant 2 s + 10 dB.
3. Jouer une note : elle s'affiche quand elle est restée sur le même demi-ton pendant 100 ms. La ligne « Mesure brute » montre chaque mesure de pitchy et la raison d'un éventuel rejet.
   Avec la **tolérance d'octave** (activée par défaut dans les réglages), une mesure à une ou deux octaves de la note jouée est ramenée à cette note tant qu'aucune nouvelle attaque n'a lieu : pendant la résonance, la fondamentale peut s'éteindre avant les harmoniques 2 ou 4, et la détection sautait sinon d'une octave (E2 → E3) ou de deux (B3 → B5).
4. L'historique garde les 10 dernières notes stables, avec la latence entre l'attaque et l'affichage. Une note apparue sans nouvelle attaque (changement pendant la résonance) est marquée « sans attaque ».
5. **Accordeur** : choisir l'accordage (standard, demi-ton plus bas, drop D, DADGAD) et le mode.
   - *Cordes* : « Auto » vise la corde la plus proche, ou toucher une corde pour la viser. Chaque bouton affiche la fréquence cible, recalculée quand A4 change.
   - *Chromatique* : vise la note la plus proche, quelle que soit la corde.
   - L'aiguille va de −50 à +50 cents : vert à ±5, orange à ±15, rouge au-delà. Au-delà de ±50 cents, le repère reste au bord et le texte indique « beaucoup trop bas/haut ».
   - L'écart n'apparaît qu'une fois la note stable. L'aiguille s'entoure de vert après 300 ms dans la zone verte ; le bip (désactivé par défaut) sonne à ce moment-là.
6. **Journal de test** : renseigner le scénario, la guitare, le matériel et la note attendue.
   - « Note attendue = corde choisie dans l'accordeur » recopie la corde sélectionnée dans l'accordeur.
   - **Enregistrer l'essai** enregistre la note en cours (ou la dernière jouée). Avec « Enregistrer chaque note automatiquement », chaque note est enregistrée quand elle s'arrête : pratique pour les 10 attaques par corde du scénario 1.
   - La fréquence retenue est la médiane des mesures pendant toute la note ; l'écart en cents est calculé par rapport à la note attendue, figée au début de la note.
   - Chaque essai indique s'il suit une attaque (`attaque = true` : la note jouée) ou s'il s'agit d'un changement de note pendant la résonance (`attaque = false`, grisé dans la liste).
   - **Test de silence 30 s** (scénario 4) compte les notes détectées pendant 30 s sans jouer et les enregistre dans `faux_positifs` et `notes_parasites`.
   - Le résumé par scénario donne, sur les notes jouées (après une attaque), le taux de bonnes notes, l'écart moyen absolu, la latence médiane, la part sous 300 ms et les octaves erronées ; il compte à part les changements sans attaque et les faux positifs.
   - Les essais sont gardés dans le navigateur (`localStorage`) ; **Exporter CSV / JSON** les télécharge, **Vider le journal** les efface après confirmation.
7. **Arrêter** libère le micro.

## Paramètres à calibrer

Toutes les constantes sont documentées (unité et valeur initiale) dans le code :

| Paramètre | Valeur initiale | Fichier | Réglable dans l'interface |
|---|---|---|---|
| Seuil de silence | −45 dBFS | `src/audio/niveau.ts` | oui |
| Clarté minimale | 0,9 | `src/audio/pitch.ts` | oui |
| Fenêtre d'analyse | 4096 échantillons | `src/audio/pitch.ts` | non |
| Plage acceptée | 70 à 1400 Hz | `src/audio/pitch.ts` | non |
| Lissage | médiane sur 5 mesures | `src/audio/pitch.ts` | mode oui, taille non |
| Durée de stabilité | 100 ms | `src/audio/pitch.ts` | non |
| Tolérance d'octave | activée, une ou deux octaves, ±50 cents | `src/audio/pitch.ts` | activation oui |
| Détection d'attaque | hausse de 6 dB sur 100 ms | `src/audio/niveau.ts` | non |
| Référence A4 | 440 Hz (430 à 450) | `src/music/notes.ts` | oui |
| Zones de l'accordeur | ±5 cents (vert), ±15 cents (orange) | `src/music/accordages.ts` | non |
| Durée « juste » | 300 ms | `src/music/accordages.ts` | non |

## Structure

```
src/
├── main.ts             # Point d'entrée, branchement de l'UI
├── audio/
│   ├── micro.ts        # Démarrage du micro, permissions
│   ├── pitch.ts        # pitchy, filtres, lissage, stabilité, latence (sans DOM)
│   └── niveau.ts       # RMS, seuil de silence, détection d'attaque (sans DOM)
├── music/
│   ├── notes.ts        # Fréquence ↔ MIDI ↔ nom de note (fonctions pures)
│   └── accordages.ts   # Accordages, corde la plus proche, cible et justesse de l'accordeur (fonctions pures)
├── journal/
│   ├── campagne.ts     # Programme et machine à états de la campagne guidée (sans DOM)
│   └── essais.ts       # Mesures, essais, test de silence, CSV/JSON, stockage, résumé (sans DOM)
└── ui/
    ├── accordeur.ts    # Accordeur : choix de corde, aiguille, indicateur « juste », bip
    ├── campagne.ts     # Campagne guidée : réglages, carte de consigne, reprise
    ├── detection.ts    # Affichage libre de la note détectée
    ├── dom.ts          # Utilitaires d'affichage partagés
    └── journal.ts      # Saisie des essais, test de silence, export CSV/JSON
tests/                  # notes, accordages, lissage, journal, campagne, chaîne de détection sur signal synthétique
```

## Format du journal

Colonnes de l'export CSV (séparateur virgule, décimales avec un point) : celles de la spécification §5.7, plus `attaque` (la note suit une attaque) et, pour le scénario 4, `faux_positifs` et `notes_parasites`.

`id, scenario, guitare, materiel, note_attendue, note_detectee, freq_mesuree_hz, freq_theorique_hz, ecart_cents, latence_ms, attaque, octave_erronee, faux_positifs, notes_parasites, date`

Un journal enregistré avant l'ajout de la colonne `attaque` est complété au chargement : une note avec latence suit une attaque.
