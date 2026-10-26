# Spécifications de l'application d'apprentissage du manche

Document destiné à Claude Code. Il décrit l'application à construire à partir du POC validé. Lire l'intégralité avant de commencer.

Nom du dépôt GitHub : à confirmer (proposition : `fretmap`).

---

## 1. Contexte

Le POC a validé la détection de hauteur dans le navigateur sur **Android avec une guitare acoustique**. Il reste à construire l'application d'apprentissage autour de cette base.

L'application aide à apprendre les notes du manche de guitare, avec trois fonctions :

- **Mode 1 (sans guitare)** : un manche virtuel est affiché. L'utilisateur doit toucher la case où se trouve une note demandée.
- **Mode 2 (avec guitare)** : l'application demande une note. L'utilisateur la joue, le micro identifie le son, et la note est validée ou refusée.
- **Accordeur** : aide à accorder les six cordes, réutilisé depuis le POC.

L'objectif pédagogique est la mémorisation des notes case par case, pas seulement la reconnaissance d'une note jouée.

---

## 2. Périmètre

### Inclus (version 1)
- Mode 1 : manche virtuel, quiz, score, série de bonnes réponses
- Mode 2 : détection de la note jouée sur cordes à vide et frettes 1 à 5, validation
- Accordeur (accordages standard, drop D, demi-ton plus bas, DADGAD)
- Niveaux de difficulté (voir 5.4)
- Progression sauvegardée localement (`localStorage`)
- Interface en français, responsive, utilisable au pouce sur téléphone
- Déploiement statique sur GitHub Pages en HTTPS

### Exclu (hors version 1)
- Comptes utilisateurs et synchronisation en ligne
- Backend ou base de données
- Accords, notes multiples, harmoniques étendues
- Mode multijoueur ou classement
- Application native (iOS, Android) : la version web suffit pour la v1
- Compatibilité iOS Safari (à évaluer ensuite, les autorisations audio y sont plus strictes)

---

## 3. Contraintes issues du POC

Ces points sont des acquis du POC et ne doivent pas être remis en cause sans raison.

- **Plateforme de référence** : Android, navigateur Chrome. Tester en priorité sur ce couple.
- **Instrument de référence** : guitare acoustique, jouée seule, une corde à la fois.
- **Micro** : désactiver `echoCancellation`, `noiseSuppression` et `autoGainControl` dans `getUserMedia`.
- **Démarrage audio** : l'`AudioContext` est créé uniquement après un clic utilisateur (bouton « Démarrer »).
- **HTTPS** : requis pour le micro. GitHub Pages le fournit.
- **Constantes à reprendre du POC** : fenêtre d'analyse de 4096 échantillons, clarté minimale, seuil de silence, tolérance en cents, durée de stabilité de 100 ms.

> Les valeurs exactes validées pendant le POC doivent être reportées ici depuis `SYNTHESE.md` avant le démarrage. Elles remplacent les valeurs initiales de la spécification POC.

---

## 4. Stack technique

| Élément | Choix |
|---|---|
| Langage | TypeScript |
| Build | Vite |
| Interface | Vanilla TypeScript et DOM, ou Svelte si la complexité de l'état le justifie (à trancher au début de la phase 1) |
| Audio | Web Audio API, `pitchy` pour la détection (comme dans le POC) |
| Tests unitaires | Vitest |
| Tests end-to-end | Playwright (écrans principaux, mode 1 uniquement, le micro n'est pas testable en CI) |
| Lint et format | ESLint et Prettier |
| Déploiement | GitHub Actions vers GitHub Pages |
| Stockage | `localStorage` (progression, réglages) |

Pas de backend, pas de framework lourd, pas de service tiers.

---

## 5. Fonctionnalités

### 5.1 Mode 1 : manche virtuel et quiz

**Manche**
- Affichage de 6 cordes et de 15 cases (0 à 14), avec marqueurs aux cases 3, 5, 7, 9, 12 et 15.
- Affichage des notes sur les cases, masquable (une option par niveau).
- Cordes à vide visibles à gauche, cases cliquables au pouce (zone minimale de 44 px de haut).
- Orientation : affichage en portrait (manche vertical) par défaut, en paysage possible.

**Quiz**
- Tirage aléatoire d'une note et d'une corde selon le niveau choisi.
- L'utilisateur touche la case correspondante. Une note peut apparaître sur plusieurs cases : toutes les cases correctes sont acceptées pour une question donnée, à condition de définir le comportement exact (voir 5.4, option « une seule position » ou « toutes les positions »).
- Retour immédiat : vert si juste, rouge si faux, avec affichage de la bonne case.
- Score de session, série de bonnes réponses, pourcentage de réussite.
- Passage automatique à la question suivante après 1 seconde.

**Statistiques par note**
- Pour chaque couple (corde, case) : nombre de tentatives, nombre de réussites, temps de réponse moyen.
- Les notes les moins maîtrisées reviennent plus souvent (tirage pondéré).

### 5.2 Mode 2 : jouer la note

**Déroulement**
1. Affichage de la note demandée (nom, et corde/case proposée si l'option est active).
2. L'utilisateur joue la note sur sa guitare.
3. Détection stable pendant 100 ms, dans la tolérance.
4. Validation : écran vert avec la note détectée et l'écart en cents. Passage à la note suivante après 1 seconde.
5. Si la note est fausse : affichage de la note jouée, pas de pénalité immédiate. Trois erreurs consécutives sur la même note déclenchent un rappel de la position sur le manche.

**Tolérance**
- Par défaut : ±30 cents sur la note exacte.
- Octave : configurable. Par défaut, le nom de la note suffit (E2 et E3 sont équivalents). Option « octave stricte » pour les niveaux avancés.

**Plage de notes**
- Cordes à vide et frettes 1 à 5, soit E2 à E5 environ.
- Attention : l'octave erronée est fréquente sur les notes aiguës, voir 9.

**Indicateur en direct**
- Note détectée, fréquence, écart en cents, barre de niveau sonore.
- Message « Jouez la note… » quand le silence est détecté pendant plus de 3 secondes.

### 5.3 Accordeur

Repris du POC, avec les mêmes fonctions :
- Accordages : standard (E A D G B E), demi-ton plus bas, drop D, DADGAD.
- Mode cordes (sélection automatique ou manuelle) et mode chromatique.
- Aiguille de −50 à +50 cents, zone verte à ±5 cents.
- Référence A4 réglable de 430 à 450 Hz.
- Retour visuel quand la corde est juste pendant 300 ms, bip optionnel.

Accessible depuis la page d'accueil, pas seulement depuis un mode.

### 5.4 Niveaux et réglages

**Niveaux** (progression linéaire, déverrouillage automatique)

| Niveau | Contenu | Condition de passage |
|---|---|---|
| 1 | Cordes à vide, notes naturelles (E, A, D, G, B) | 80 % de réussite sur 20 questions |
| 2 | Cordes à vide, toutes les notes (dièses et bémols) | 80 % sur 20 questions |
| 3 | Cases 1 à 5, notes naturelles | 80 % sur 30 questions |
| 4 | Cases 1 à 7, toutes les notes | 80 % sur 30 questions |
| 5 | Manche complet (cases 0 à 12) | Pas de passage, mode libre |

**Réglages** (accessibles en permanence)
- Tolérance en cents (±20 / ±30 / ±50)
- Octave stricte (oui / non)
- Afficher les notes sur le manche (oui / non)
- Référence A4 (430 à 450 Hz)
- Seuil de silence (calibrage automatique : « Mesurer le bruit ambiant » pendant 2 s)
- Retour sonore (oui / non)
- Réinitialiser la progression (avec confirmation)

---

## 6. Modèle de données

Stockage en `localStorage`, clé `fretmap.v1`. Version du schéma dans l'objet pour permettre les migrations.

```ts
type Corde = 1 | 2 | 3 | 4 | 5 | 6;            // 1 = la plus aiguë (E4), 6 = la plus grave (E2)
type Case = number;                             // 0 à 15

interface Statistique {
  corde: Corde;
  case: Case;
  tentatives: number;
  reussites: number;
  tempsMoyenMs: number;
  derniereDate: string;                         // ISO 8601
}

interface Reglages {
  tolerance: 20 | 30 | 50;
  octaveStricte: boolean;
  afficherNotes: boolean;
  a4: number;                                   // 430 à 450
  seuilSilenceDb: number;                       // ex. -45
  retourSonore: boolean;
}

interface Progression {
  version: 1;
  niveauActuel: 1 | 2 | 3 | 4 | 5;
  scoreParNiveau: Record<number, { questions: number; reussites: number }>;
  statistiques: Statistique[];
  reglages: Reglages;
}
```

Règles :
- Les statistiques sont mises à jour à chaque réponse, dans le mode concerné.
- Une migration est prévue dès la v1 (fonction `migrer(progression)`), même vide.
- Un export JSON et un import JSON permettent de sauvegarder la progression manuellement.

---

## 7. Interface et parcours

**Écrans**
1. **Accueil** : boutons Mode 1, Mode 2, Accordeur, Statistiques, Réglages. Affichage du niveau actuel.
2. **Mode 1** : manche, question, score, bouton « Arrêter ».
3. **Mode 2** : note demandée, indicateur en direct, historique des dernières réponses, bouton « Arrêter ».
4. **Accordeur** : aiguille, sélection de corde, accordage, A4.
5. **Statistiques** : tableau des cases (grille 6 × 16) colorées selon le taux de réussite, niveau atteint, séries.
6. **Réglages** : liste des options de 5.4.

**Parcours minimal**
- Au premier lancement : écran d'accueil, accès direct au Mode 1 niveau 1. Aucune inscription, aucun formulaire.
- Mode 2 et accordeur demandent le micro au premier usage, avec un texte explicatif avant la demande de permission.

**Mobile**
- Interface pensée pour Android en portrait. Cibles tactiles d'au moins 44 px.
- Pas de survol (hover) nécessaire pour une action.
- Le bouton « Démarrer » du micro est toujours visible en mode 2.

**Accessibilité**
- Contrastes WCAG AA au minimum.
- Couleur jamais seule : une bonne réponse est aussi signalée par une icône et un texte.
- Mode 1 utilisable au clavier (flèches pour la sélection, Entrée pour valider) sur ordinateur.

---

## 8. Architecture des fichiers

```
fretmap/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .github/workflows/deploy.yml     # Build et déploiement GitHub Pages
├── src/
│   ├── main.ts                      # Point d'entrée et routage simple entre écrans
│   ├── audio/                       # Repris du POC
│   │   ├── micro.ts
│   │   ├── pitch.ts
│   │   └── niveau.ts
│   ├── music/                       # Fonctions pures, testées
│   │   ├── notes.ts                 # Fréquence ↔ MIDI ↔ nom, position manche ↔ note
│   │   ├── accordages.ts
│   │   └── manche.ts                # Calcul de la note d'une case (corde + case)
│   ├── progression/
│   │   ├── stockage.ts              # Lecture et écriture localStorage, migration
│   │   ├── statistiques.ts          # Mise à jour et pondération des tirages
│   │   └── niveaux.ts               # Règles de passage de niveau
│   ├── quiz/
│   │   ├── tirage.ts                # Choix de la question selon le niveau
│   │   └── validation.ts            # Vérification d'une réponse
│   ├── ui/
│   │   ├── accueil.ts
│   │   ├── manche.ts                # Rendu du manche (SVG)
│   │   ├── mode1.ts
│   │   ├── mode2.ts
│   │   ├── accordeur.ts
│   │   ├── statistiques.ts
│   │   ├── reglages.ts
│   │   └── composants.ts            # Boutons, aiguille, barre de niveau
│   └── styles.css
├── tests/
│   ├── unit/                        # Vitest
│   └── e2e/                         # Playwright (mode 1, réglages, stockage)
└── public/
    └── icone.svg
```

Les modules `music/`, `progression/` et `quiz/` ne dépendent pas du DOM : ils doivent être testables sans navigateur.

---

## 9. Points de vigilance

- **Octave erronée** : sur les cordes aiguës, l'algorithme peut détecter l'harmonique. Filtrer par clarté, et proposer l'option « octave non stricte » par défaut.
- **Tolérance réelle** : la valeur de ±30 cents doit être confirmée avec les résultats du POC. Ne pas la modifier sans mesure.
- **Latence** : mesurée dans le POC. Si elle dépasse 300 ms sur Android, réduire la fenêtre d'analyse et le signaler dans la documentation.
- **Permissions micro** : messages d'erreur clairs pour refus, absence de micro, et micro occupé par une autre application.
- **Mise en veille** : quand l'onglet passe en arrière-plan, arrêter le micro et le quiz, puis proposer de reprendre.
- **Perte de progression** : `localStorage` peut être vidé par le navigateur. L'export JSON est donc une fonction visible dans les réglages.
- **Guitare désaccordée** : afficher un rappel vers l'accordeur si le mode 2 échoue plusieurs fois de suite sur la même corde.

---

## 10. Tests

**Unitaires (Vitest)**
- `notes.ts` : conversions fréquence ↔ MIDI ↔ nom, cas limites (A4 à 432 Hz, fréquences hors plage).
- `manche.ts` : pour chaque corde et chaque case, la note calculée est correcte (couvrir les 6 × 16 positions).
- `accordages.ts` : chaque accordage renvoie six notes et les fréquences attendues.
- `validation.ts` : réponse juste, fausse, dans la tolérance, hors tolérance, octave stricte et non stricte.
- `niveaux.ts` : passage de niveau au seuil, pas de passage en dessous, niveau 5 sans fin.
- `stockage.ts` : sauvegarde, lecture, migration, comportement si `localStorage` est vide ou corrompu.

**End-to-end (Playwright)**
- Mode 1 : une question complète, bonne réponse et mauvaise réponse.
- Réglages : modification et persistance après rechargement.
- Export et import JSON.
- Le mode 2 n'est pas testé en CI (pas de micro réel). Il fait l'objet d'une checklist manuelle, voir 11.

**Checklist manuelle (mode 2, à chaque version)**
- [ ] Guitare acoustique, Android, Chrome : cordes à vide validées
- [ ] Frettes 1 à 5 sur les six cordes : au moins 90 % de réussite
- [ ] Silence de 30 s : aucune fausse note affichée
- [ ] Refus du micro : message explicite, pas de blocage
- [ ] Passage en arrière-plan puis retour : micro arrêté, reprise possible

---

## 11. Critères d'acceptation

La version 1 est terminée quand :

- [ ] `npm run dev`, `npm run build` et `npm test` passent sans erreur
- [ ] Le déploiement GitHub Pages se fait automatiquement depuis la branche principale
- [ ] Le mode 1 propose les 5 niveaux, avec score, série et statistiques
- [ ] Le mode 2 valide les notes des cordes à vide et des frettes 1 à 5 sur Android avec guitare acoustique
- [ ] L'accordeur couvre les quatre accordages et la référence A4 réglable
- [ ] La progression survit à un rechargement, et l'export et l'import JSON fonctionnent
- [ ] Les réglages sont persistants et modifient le comportement immédiatement
- [ ] Toute l'interface est en français
- [ ] Les tests unitaires couvrent les modules `music/`, `progression/` et `quiz/`
- [ ] La checklist manuelle du mode 2 est cochée pour la version livrée

---

## 12. Phases de développement

| Phase | Contenu | Livrable |
|---|---|---|
| 1 | Mise en place : dépôt, Vite, TypeScript, lint, CI de déploiement, reprise des modules audio du POC | Page d'accueil déployée |
| 2 | Modèle de données, stockage, modules `music/` testés | Tests unitaires verts |
| 3 | Mode 1 : manche, quiz, score, statistiques | Mode 1 jouable |
| 4 | Mode 2 : détection, validation, indicateur en direct | Mode 2 jouable sur Android |
| 5 | Accordeur complet, réglages, export et import | Accordeur et réglages |
| 6 | Niveaux, pondération des tirages, finitions visuelles, accessibilité | Version 1 candidate |
| 7 | Tests terrain sur Android avec guitare, corrections | Version 1 publiée |

---

## 13. Consignes pour Claude Code

- Commencer par la phase 1 et la phase 2. Ne pas construire l'interface avant que les modules `music/` et `progression/` soient testés.
- Reprendre le code audio du POC sans le modifier, sauf si une constante doit changer. Toute modification est notée dans le commit.
- Garder les textes de l'interface dans un fichier dédié (`src/ui/textes.ts`), pour faciliter une future traduction.
- Ne pas ajouter de fonctionnalité hors périmètre, en particulier comptes, backend et accords.
- Chaque phase se termine par un commit propre et une mise à jour du `README.md`.
- En cas de doute sur une valeur (tolérance, seuil, clarté), la signaler dans la réponse plutôt que de la deviner.
