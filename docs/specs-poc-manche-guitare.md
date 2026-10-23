# Spécifications du POC : apprentissage des notes du manche et accordeur

Document destiné à Claude Code. Il décrit le POC à construire, ses critères d'acceptation et les hypothèses à valider. Lire l'intégralité avant de commencer.

---

## 1. Contexte et objectif

Un site web doit aider à apprendre les notes du manche de guitare. Le produit final comportera deux modes et un accordeur :

- **Mode 1 (sans guitare)** : manche virtuel affiché à l'écran. L'utilisateur doit cliquer sur la case où se trouve une note demandée.
- **Mode 2 (avec guitare)** : l'application demande une note. L'utilisateur la joue sur sa guitare, et la page identifie le son capté par le micro.
- **Accordeur** : aide à accorder les six cordes à vide.

**Objectif du POC** : vérifier qu'un navigateur peut détecter la hauteur d'une guitare jouée seule, avec une précision suffisante, dans des conditions réelles. Le POC ne construit pas l'interface finale. Il répond à une seule question : **le mode 2 et l'accordeur sont-ils fiables avec le matériel visé ?**

---

## 2. Périmètre

### Inclus
- Une page HTML unique, sans backend
- Accès au micro (`getUserMedia`) et Web Audio API
- Détection de la fréquence fondamentale
- Affichage de la note détectée, de sa fréquence et de l'écart en cents
- Accordeur sur les six cordes à vide (accordage standard), avec référence A4 réglable
- Journal de test exportable en CSV et en JSON
- Bouton « Démarrer » déclenchant l'audio (exigence des navigateurs)

### Exclu
- Manche virtuel et mode quiz (hors POC)
- Comptes utilisateurs, sauvegarde en ligne, design final
- Accords, notes multiples, harmoniques étendues
- Compatibilité iOS Safari (à évaluer après le POC)

---

## 3. Stack technique

| Élément | Choix |
|---|---|
| Langage | TypeScript |
| Build et serveur | Vite |
| Framework UI | Aucun (TypeScript et DOM natif) |
| Audio | Web Audio API (`AnalyserNode`, `getUserMedia`) |
| Détection de hauteur | `pitchy` (algorithme McLeod), via npm |
| Tests unitaires | Vitest |
| Environnement | Node.js LTS pour le développement uniquement |

**Repli** : si `pitchy` ne donne pas les résultats attendus (H1 ou H2 non atteints), implémenter une autocorrélation maison dans `src/audio/pitch.ts`, derrière la même interface.

**Contrainte HTTPS** : le micro exige un contexte sécurisé. `localhost` est accepté. Pour tester depuis un téléphone sur le réseau local, utiliser `vite --host --https`.

---

## 4. Architecture des fichiers

```
poc-guitare/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                 # Point d'entrée, branchement de l'UI
│   ├── audio/
│   │   ├── micro.ts            # Démarrage du micro, gestion des permissions
│   │   ├── pitch.ts            # Détection de fréquence (pitchy + lissage)
│   │   └── niveau.ts           # Mesure du volume RMS et seuil de silence
│   ├── music/
│   │   ├── notes.ts            # Conversion fréquence ↔ MIDI ↔ nom de note
│   │   └── accordages.ts       # Définitions des accordages (standard, drop D, etc.)
│   ├── ui/
│   │   ├── accordeur.ts        # Affichage de l'aiguille et sélection de corde
│   │   ├── detection.ts        # Affichage libre de la note détectée
│   │   └── journal.ts          # Saisie des essais et export CSV/JSON
│   └── styles.css
└── tests/
    ├── notes.test.ts
    ├── accordages.test.ts
    └── lissage.test.ts
```

---

## 5. Spécifications fonctionnelles

### 5.1 Démarrage et micro

- Un bouton « Démarrer » appelle `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. Désactiver ces traitements évite que le navigateur déforme le signal de la guitare.
- Créer un `AudioContext` dans le geste utilisateur (exigence des navigateurs).
- Afficher un message clair si la permission est refusée.
- Afficher la fréquence d'échantillonnage réelle (`audioContext.sampleRate`) et la taille de tampon utilisée.
- Bouton « Arrêter » qui libère le flux micro.

### 5.2 Détection de hauteur

- Fenêtre d'analyse : **4096 échantillons** (plage E2 à E5). À 44,1 kHz, cela représente environ 93 ms.
- Analyse à chaque frame (`requestAnimationFrame`) ou toutes les 20 ms environ.
- Algorithme : `pitchy` (`PitchDetector.forFloat32Array`, puis `findPitch`), qui renvoie la fréquence et une clarté entre 0 et 1.
- **Filtrage** :
  - Ignorer toute mesure dont la clarté est inférieure à **0,9** (valeur initiale, à calibrer).
  - Ignorer toute mesure sous le seuil de volume (voir 5.3).
  - Ignorer toute fréquence hors de la plage **70 Hz à 1400 Hz**.
- **Lissage** : moyenne glissante sur les **3 à 5** dernières mesures valides, ou médiane.
- **Stabilité** : une note n'est considérée comme « détectée » que si elle reste dans la même demi-tonalité pendant **100 ms** consécutives.

### 5.3 Seuil de volume et silence

- Calculer le RMS du tampon à chaque analyse.
- Seuil initial : **−45 dBFS** (à calibrer pendant les tests).
- Sous ce seuil : afficher « silence », ne rien mettre à jour sur la note détectée.
- Permettre un calibrage manuel : bouton « Mesurer le bruit ambiant » qui prend la moyenne sur 2 s de silence et fixe le seuil à cette moyenne + 10 dB.

### 5.4 Conversion fréquence → note

Module `music/notes.ts`, fonctions pures :

```ts
midiFloat = 69 + 12 * log2(freq / a4)
midi      = round(midiFloat)
cents     = round((midiFloat - midi) * 100)   // négatif = trop bas
nom       = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((midi % 12) + 12) % 12]
octave    = floor(midi / 12) - 1
```

- `a4` est réglable de 430 à 450 Hz, valeur par défaut 440.
- Afficher : nom de la note avec octave (ex. « E2 »), fréquence mesurée en Hz (une décimale), écart en cents avec signe.

### 5.5 Accordeur

**Accordages** (`music/accordages.ts`) :

| Nom | Cordes (de la 6e à la 1re) |
|---|---|
| Standard | E2 A2 D3 G3 B3 E4 |
| Demi-ton plus bas | D#2 G#2 C#3 F#3 A#3 D#4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| DADGAD | D2 A2 D3 G3 A3 D4 |

**Fonctionnement** :
- **Mode cordes** : l'utilisateur choisit une corde ou laisse l'application sélectionner la corde la plus proche de la fréquence détectée.
- **Mode chromatique** : affiche la note la plus proche, quelle que soit la corde.
- **Aiguille** : barre horizontale de −50 à +50 cents. Zone verte à ±5 cents, orange à ±15 cents, rouge au-delà.
- **Fréquences cibles** recalculées à chaque changement de référence A4.
- **Retour** : indicateur visuel vert quand la corde est juste pendant 300 ms. Un bip optionnel (désactivé par défaut).
- Ne pas afficher l'écart tant que la fréquence n'est pas stable (la corde peut passer par d'autres notes pendant l'accordage).

### 5.6 Affichage libre (détection)

- Écran de détection autonome : note, fréquence, cents, clarté, niveau sonore (barre).
- Historique des 10 dernières notes stables, avec horodatage.

### 5.7 Journal de test

Chaque essai est saisi dans l'interface avant ou pendant le test :

| Champ | Type | Exemple |
|---|---|---|
| `id` | auto | 1 |
| `scenario` | liste (1 à 5) | `1-accordage-calme` |
| `guitare` | texte | `acoustique` |
| `materiel` | texte | `micro intégré portable` |
| `note_attendue` | texte | `E2` |
| `note_detectee` | texte | `E2` |
| `freq_mesuree_hz` | nombre | 82.6 |
| `freq_theorique_hz` | nombre | 82.41 |
| `ecart_cents` | nombre | 4.0 |
| `latence_ms` | nombre | 180 |
| `octave_erronee` | booléen | false |
| `date` | ISO 8601 | 2026-10-23T15:00:00 |

- Boutons « Enregistrer l'essai » (préremplit la note attendue depuis l'accordeur ou la saisie manuelle) et « Exporter CSV » / « Exporter JSON ».
- Stockage dans `localStorage` pour survivre à un rechargement de page.
- Bouton « Vider le journal » avec confirmation.

**Latence** : mesurée comme le délai entre l'attaque (pic de RMS au-dessus du seuil) et le premier affichage stable de la note. Enregistrer dans le journal.

---

## 6. Hypothèses à valider

| # | Hypothèse | Critère de réussite | Mesure |
|---|---|---|---|
| H1 | Détection précise sur les cordes à vide | Écart moyen < 5 cents sur signal propre | Scénario 1 |
| H2 | Détection juste sur toute la plage utile | ≥ 90 % de bonnes notes entre E2 et E5 | Scénarios 1 et 3 |
| H3 | Réponse rapide | Latence < 300 ms après l'attaque | Journal |
| H4 | Pas de fausse détection sur le silence | 0 note affichée sur 30 s de silence | Scénario 4 |
| H5 | Conditions réelles acceptables | ≥ 80 % de bonnes notes en pièce non traitée | Scénarios 2 et 5 |

---

## 7. Protocole de test

**Matériel** : guitare acoustique et guitare électrique ; micro intégré d'un ordinateur portable ; casque avec micro ; interface audio USB si disponible ; téléphone Android (et iOS si possible).

**Scénarios** :
1. **Accordage à vide** : chaque corde, 10 attaques par corde, pièce calme.
2. **Accordage bruyant** : même test avec ventilateur ou conversation en fond.
3. **Frettes 1 à 5** : chaque corde, E2 à E5, 5 essais par note.
4. **Silence** : 30 s sans jouer, fenêtre ouverte.
5. **Jeu naturel** : attaques variées, vibrato léger, arrêts rapides.

**Mesures** : écart en cents, latence, taux de bonne note, taux d'octave erronée, faux positifs sur le silence.

---

## 8. Critères de décision

- **Go** : H1 à H4 validées avec le micro intégré, et H5 validée avec le matériel visé pour le produit.
- **Go conditionnel** : H1 à H4 validées, H5 partiellement validée. Retenir les conditions minimales (casque ou micro USB recommandé) et les documenter.
- **No-go** : H1 ou H2 non atteintes. Options : algorithme YIN maison, aubio.js (WebAssembly), ou abandon du mode 2 au profit du mode 1 seul.

---

## 9. Critères d'acceptation techniques

Le POC est considéré comme terminé quand :

- [ ] `npm run dev` lance l'application sans erreur
- [ ] `npm run build` produit un build sans erreur TypeScript
- [ ] `npm test` passe (tests de conversion, accordages et lissage)
- [ ] Le micro démarre après un clic sur « Démarrer » et s'arrête sur « Arrêter »
- [ ] Le refus de permission affiche un message explicite
- [ ] L'accordeur sélectionne la bonne corde et affiche l'aiguille
- [ ] La référence A4 modifie les fréquences cibles
- [ ] Le journal enregistre, affiche, exporte (CSV, JSON) et vide les essais
- [ ] Les essais survivent à un rechargement de page
- [ ] Le seuil de silence est calibrable depuis l'interface

---

## 10. Tests unitaires attendus

- `notes.test.ts` : 440 Hz → A4 et 0 cent ; 82,41 Hz → E2 ; 466 Hz → A#4 ou Bb4 selon la convention ; fréquences à ±50 cents de chaque note ; valeur hors plage ; A4 à 432 Hz.
- `accordages.test.ts` : chaque accordage renvoie les six bonnes notes et fréquences.
- `lissage.test.ts` : moyenne et médiane sur fenêtre glissante ; comportement avec moins de valeurs que la fenêtre.

Les tests ne dépendent pas du micro. Les modules `music/` sont des fonctions pures.

---

## 11. Livrables

1. Code source dans `poc-guitare/`, avec `README.md` (installation, lancement, utilisation)
2. Journal de test exporté (CSV), rempli pendant les scénarios
3. Note de synthèse (une page, `SYNTHESE.md`) : résultats par hypothèse, décision go / no-go, paramètres retenus (seuil de volume, clarté minimale, fenêtre d'analyse, tolérance), matériel recommandé

---

## 12. Planning indicatif

| Jour | Activité |
|---|---|
| J1 | Mise en place Vite et TypeScript, accès micro, affichage du niveau sonore |
| J2 | Intégration de `pitchy`, conversion fréquence → note, affichage brut, mesure de latence |
| J3 | Accordeur : accordages, sélection de corde, aiguille, A4 réglable |
| J4 | Journal de test, scénarios 1 à 4 |
| J5 | Scénario 5, rédaction de `SYNTHESE.md`, décision |

Durée estimée : 4 à 5 jours à temps partiel.

---

## 13. Risques

| Risque | Impact | Parade |
|---|---|---|
| Micro intégré de mauvaise qualité | Détection instable | Résultat utile : il indique le matériel minimum à recommander |
| Autorisations et autoplay | Audio bloqué | Bouton « Démarrer » obligatoire |
| Latence du tampon audio (20 à 50 ms) | Réponse perçue lente | Mesurer dès J2, réduire la taille de fenêtre si nécessaire |
| Harmoniques sur les cordes aiguës | Octave erronée | Filtrage par clarté, tolérance d'octave en option |
| Guitare désaccordée | Fausses réponses en mode 2 | Accordeur accessible depuis la page principale |

---

## 14. Consignes pour Claude Code

- Commencer par J1 et J2 : c'est là que se décide la faisabilité. Ne pas construire l'accordeur avant d'avoir une détection stable sur une corde.
- Garder les modules `music/` et `audio/pitch.ts` sans dépendance au DOM, pour pouvoir les tester.
- Ne rien ajouter hors périmètre (pas de manche virtuel, pas de mode quiz, pas de backend).
- Documenter dans le code les constantes à calibrer (seuil de silence, clarté minimale, fenêtre d'analyse) avec un commentaire indiquant leur unité et leur valeur initiale.
- Interface et messages en français.
