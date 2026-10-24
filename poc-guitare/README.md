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

Version en ligne, mise à jour à chaque push sur la branche par défaut : https://gnatali.github.io/fretmap/ (pratique pour tester sur téléphone).

## Utilisation

1. Cliquer sur **Démarrer** et autoriser le micro. La page affiche la fréquence d'échantillonnage, la fenêtre d'analyse et l'état des traitements du navigateur (qui doivent être désactivés).
2. Sans jouer, cliquer sur **Mesurer le bruit ambiant** : le seuil de silence est fixé au bruit mesuré pendant 2 s + 10 dB.
3. Jouer une note : elle s'affiche quand elle est restée sur le même demi-ton pendant 100 ms. La ligne « Mesure brute » montre chaque mesure de pitchy et la raison d'un éventuel rejet.
4. L'historique garde les 10 dernières notes stables, avec la latence entre l'attaque et l'affichage.
5. **Accordeur** : choisir l'accordage (standard, demi-ton plus bas, drop D, DADGAD) et le mode.
   - *Cordes* : « Auto » vise la corde la plus proche, ou toucher une corde pour la viser. Chaque bouton affiche la fréquence cible, recalculée quand A4 change.
   - *Chromatique* : vise la note la plus proche, quelle que soit la corde.
   - L'aiguille va de −50 à +50 cents : vert à ±5, orange à ±15, rouge au-delà. Au-delà de ±50 cents, le repère reste au bord et le texte indique « beaucoup trop bas/haut ».
   - L'écart n'apparaît qu'une fois la note stable. L'aiguille s'entoure de vert après 300 ms dans la zone verte ; le bip (désactivé par défaut) sonne à ce moment-là.
6. **Journal de test** : renseigner le scénario, la guitare, le matériel et la note attendue.
   - « Note attendue = corde choisie dans l'accordeur » recopie la corde sélectionnée dans l'accordeur.
   - **Enregistrer l'essai** enregistre la note en cours (ou la dernière jouée). Avec « Enregistrer chaque note automatiquement », chaque note est enregistrée quand elle s'arrête : pratique pour les 10 attaques par corde du scénario 1.
   - La fréquence retenue est la médiane des mesures pendant toute la note ; l'écart en cents est calculé par rapport à la note attendue.
   - **Test de silence 30 s** (scénario 4) compte les notes détectées pendant 30 s sans jouer et les enregistre dans `faux_positifs` et `notes_parasites`.
   - Le résumé par scénario donne le taux de bonnes notes, l'écart moyen absolu (sur les bonnes notes), la latence médiane, la part sous 300 ms, les octaves erronées et les faux positifs.
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
│   └── essais.ts       # Mesures, essais, test de silence, CSV/JSON, stockage, résumé (sans DOM)
└── ui/
    ├── accordeur.ts    # Accordeur : choix de corde, aiguille, indicateur « juste », bip
    ├── detection.ts    # Affichage libre de la note détectée
    ├── dom.ts          # Utilitaires d'affichage partagés
    └── journal.ts      # Saisie des essais, test de silence, export CSV/JSON
tests/                  # notes, accordages, lissage, journal, chaîne de détection sur signal synthétique
```

## Format du journal

Colonnes de l'export CSV (séparateur virgule, décimales avec un point) : celles de la spécification §5.7, plus `faux_positifs` et `notes_parasites` pour le scénario 4.

`id, scenario, guitare, materiel, note_attendue, note_detectee, freq_mesuree_hz, freq_theorique_hz, ecart_cents, latence_ms, octave_erronee, faux_positifs, notes_parasites, date`
