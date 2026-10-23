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

## Utilisation

1. Cliquer sur **Démarrer** et autoriser le micro. La page affiche la fréquence d'échantillonnage, la fenêtre d'analyse et l'état des traitements du navigateur (qui doivent être désactivés).
2. Sans jouer, cliquer sur **Mesurer le bruit ambiant** : le seuil de silence est fixé au bruit mesuré pendant 2 s + 10 dB.
3. Jouer une note : elle s'affiche quand elle est restée sur le même demi-ton pendant 100 ms. La ligne « Mesure brute » montre chaque mesure de pitchy et la raison d'un éventuel rejet.
4. L'historique garde les 10 dernières notes stables, avec la latence entre l'attaque et l'affichage.
5. **Arrêter** libère le micro.

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
│   └── accordages.ts   # Accordages et corde la plus proche (fonctions pures)
└── ui/
    └── detection.ts    # Affichage libre de la note détectée
tests/                  # notes, accordages, lissage, chaîne de détection sur signal synthétique
```

`ui/accordeur.ts` (J3) et `ui/journal.ts` (J4) restent à écrire.
