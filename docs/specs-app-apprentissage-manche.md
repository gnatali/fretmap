# Spécifications de l'application d'apprentissage du manche

Document destiné à Claude Code. Il décrit l'application à construire à partir du POC validé. Lire l'intégralité avant de commencer.

**Version 2** : mise en cohérence avec les résultats du POC. Les changements et leur justification sont dans [`revue-specs-app.md`](revue-specs-app.md). Les passages marqués **(à confirmer)** attendent une décision de l'utilisateur avant la phase 1.

Dépôt GitHub : `gnatali/fretmap` (existant, avec le POC dans `poc-guitare/`).

---

## 1. Contexte

Le POC a validé la détection de hauteur dans le navigateur sur **Android avec une guitare acoustique** (décision Go, voir [`poc-guitare/SYNTHESE.md`](../poc-guitare/SYNTHESE.md)). Il reste à construire l'application d'apprentissage autour de cette base.

L'application aide à apprendre les notes du manche de guitare, avec trois fonctions :

- **Mode 1 (sans guitare)** : un manche virtuel est affiché. L'utilisateur doit toucher la case où se trouve une note demandée.
- **Mode 2 (avec guitare)** : l'application demande une note. L'utilisateur la joue, le micro identifie le son, et la note est validée ou refusée.
- **Accordeur** : aide à accorder les six cordes, réutilisé depuis le POC.

L'objectif pédagogique est la mémorisation des notes case par case, pas seulement la reconnaissance d'une note jouée.

---

## 2. Périmètre

### Inclus (version 1)
- Mode 1 : manche virtuel (cases 0 à 12), quiz, score, série de bonnes réponses
- Mode 2 : détection de la note jouée et validation, cases 0 à 12 (E2 à E5) ; limité aux cases 0 à 5 (E2 à A4) tant que le scénario 6 du POC n'a pas validé H2 jusqu'à E5
- Accordeur (accordages standard, drop D, demi-ton plus bas, DADGAD)
- Niveaux de difficulté (voir 5.4), communs aux deux modes
- Progression sauvegardée localement (`localStorage`)
- Interface en français, responsive, utilisable au pouce sur téléphone
- Déploiement statique sur GitHub Pages en HTTPS

### Exclu (hors version 1)
- Comptes utilisateurs et synchronisation en ligne
- Backend ou base de données
- Accords, notes multiples, harmoniques étendues
- Mode multijoueur ou classement
- Application native (iOS, Android) : la version web suffit pour la v1
- Compatibilité iOS Safari (à évaluer ensuite, les autorisations audio y sont plus strictes ; non testée dans le POC)
- Guitare électrique : non testée dans le POC, hors périmètre de validation
- Mode 2 sur ordinateur : il peut fonctionner, mais n'est pas validé (le POC n'a testé qu'un téléphone Android)
- Notes au-delà de E5 (cases 13 et plus)

---

## 3. Contraintes issues du POC

Ces points sont des acquis du POC et ne doivent pas être remis en cause sans raison (nouvelle mesure).

- **Plateforme de référence** : Android, navigateur Chrome **(à confirmer : le navigateur n'est pas enregistré dans les journaux du POC)**. Tester en priorité sur ce couple, micro intégré du téléphone.
- **Instrument de référence** : guitare acoustique, jouée seule, une corde à la fois.
- **Micro** : désactiver `echoCancellation`, `noiseSuppression` et `autoGainControl` dans `getUserMedia`, et vérifier dans les réglages effectifs de la piste que c'est bien le cas.
- **Démarrage audio** : l'`AudioContext` est créé uniquement après un clic utilisateur (bouton « Démarrer »), avant toute opération asynchrone.
- **HTTPS** : requis pour le micro. GitHub Pages le fournit.

**Valeurs validées par le POC** (source : `poc-guitare/SYNTHESE.md` et les constantes de `poc-guitare/src/`) :

| Paramètre | Valeur | Constante du POC |
|---|---|---|
| Fenêtre d'analyse | 4096 échantillons (85 ms à 48 kHz) ; 2048 en réserve si la latence augmente | `TAILLE_FENETRE` |
| Clarté minimale | 0,9 (filtre appliqué après pitchy ; `clarityThreshold` de pitchy est la constante k de McLeod, pas ce filtre) | `CLARTE_MIN_DEFAUT` |
| Plage acceptée | 70 à 1400 Hz | `FREQ_MIN_HZ`, `FREQ_MAX_HZ` |
| Lissage | médiane de 5 mesures, vidé à chaque attaque et en silence | `TAILLE_LISSAGE` |
| Stabilité | 100 ms sur le même demi-ton | `DUREE_STABILITE_MS` |
| Détection d'attaque | passage au-dessus du seuil, ou hausse de 6 dB en 100 ms ; 150 ms entre deux attaques | `HAUSSE_ATTAQUE_DB`, `FENETRE_ATTAQUE_MS`, `REFRACTAIRE_ATTAQUE_MS` |
| Tolérance d'octave | une mesure à 1 ou 2 octaves (±50 cents) de la note en cours lui est ramenée, tant qu'aucune nouvelle attaque n'a lieu ; activée en permanence | `TOLERANCE_OCTAVE_CENTS`, `OCTAVES_TOLERANCE` |
| Seuil de silence | bruit ambiant mesuré pendant 2 s + 10 dB ; −45 dBFS par défaut | `DUREE_CALIBRAGE_MS`, `MARGE_CALIBRAGE_DB`, `SEUIL_SILENCE_DBFS_DEFAUT` |
| Non-détection | attaque sans note stable au bout de 1,5 s | `DELAI_NON_DETECTION_MS` |
| Accordeur | vert à ±5 cents, orange à ±15 ; « juste » après 300 ms ; aiguille de −50 à +50 cents | `TOLERANCE_JUSTE_CENTS`, `TOLERANCE_PROCHE_CENTS`, `DUREE_JUSTE_MS` |
| Référence A4 | 430 à 450 Hz, 440 par défaut | `A4_MIN_HZ`, `A4_MAX_HZ` |

**Performances mesurées** (guitare acoustique, téléphone Android) : écart moyen 3,0 cents sur cordes à vide ; 96 % de bonnes notes de E2 à A4 ; latence médiane de 183 à 200 ms, maximum 283 ms ; aucune fausse note sur 30 s de silence ; 98 % en bruit de fond et 100 % en jeu naturel.

---

## 4. Stack technique

| Élément | Choix |
|---|---|
| Langage | TypeScript |
| Build | Vite |
| Interface | Vanilla TypeScript et DOM, ou Svelte si la complexité de l'état le justifie (à trancher au début de la phase 1) |
| Audio | Web Audio API, `pitchy` pour la détection (comme dans le POC) |
| Tests unitaires | Vitest |
| Tests end-to-end | Playwright : écrans principaux et mode 1 ; mode 2 avec un micro simulé par fichier audio (voir 10) |
| Lint et format | ESLint et Prettier |
| Déploiement | GitHub Actions vers GitHub Pages |
| Stockage | `localStorage` (progression, réglages) |

Pas de backend, pas de framework lourd, pas de service tiers.

---

## 5. Fonctionnalités

### 5.1 Mode 1 : manche virtuel et quiz

**Manche**
- Affichage de 6 cordes et de 13 positions (case 0 à vide, cases 1 à 12), avec marqueurs aux cases 3, 5, 7, 9 et 12 **(à confirmer)**.
- Affichage des notes sur les cases, masquable (une option par niveau).
- Cordes à vide visibles à gauche, cases cliquables au pouce (zone minimale de 44 px de haut).
- Orientation : affichage en portrait (manche vertical) par défaut, en paysage possible.

**Quiz**
- Tirage d'une position (corde, case) parmi celles du niveau ; la question affiche la note de cette position et la corde.
- L'utilisateur touche la case. Toute case de la corde demandée qui donne la note est acceptée : sur une corde, une note revient toutes les 12 cases (une corde à vide et sa case 12, par exemple).
- Retour immédiat : vert si juste, rouge si faux, avec affichage de la bonne case.
- Score de session, série de bonnes réponses, pourcentage de réussite.
- Passage automatique à la question suivante après 1 seconde.

**Statistiques par note**
- Pour chaque mode et chaque couple (corde, case) : nombre de tentatives, nombre de réussites, temps de réponse moyen.
- Les notes les moins maîtrisées reviennent plus souvent (tirage pondéré).

### 5.2 Mode 2 : jouer la note

**Ce que le micro peut vérifier** : la hauteur jouée, donc le nom de la note, et l'octave si l'option « octave stricte » est active. Il ne peut pas vérifier la corde : une même note se joue à plusieurs endroits (B4 = corde 2 case 12 = corde 1 case 7). La corde affichée est une consigne ; les statistiques sont attribuées à la position demandée.

**Déroulement**
1. Affichage de la question : la note et la corde ; l'utilisateur cherche la case. L'option « afficher la case » (aide) montre la position complète.
2. Calibrage au démarrage du micro : 2 s de mesure du bruit ambiant, avec la consigne « ne jouez pas ».
3. L'utilisateur joue la note. Consigne affichée : étouffer la corde précédente avant de jouer.
4. Seule compte la **première note stable après une attaque** (stable 100 ms sur le même demi-ton). Les changements de note pendant la résonance, sans nouvelle attaque, sont ignorés.
5. Si cette première note est celle de la question précédente (corde précédente qui sonne encore), elle est ignorée une fois ; ensuite, elle compte comme une erreur.
6. Validation : écran vert avec la note détectée et l'écart en cents. Passage à la note suivante après 1 seconde.
7. Si la note est fausse : affichage de la note jouée, pas de pénalité immédiate. Trois erreurs consécutives sur la même question déclenchent un rappel de la position sur le manche.
8. Une attaque sans note stable au bout de 1,5 s affiche « Note non reconnue, rejouez » et ne compte pas comme une erreur.

**Tolérance**
- Par défaut : la note est juste si elle tombe sur le bon demi-ton (±50 cents), comme dans le POC **(à confirmer)**. Le POC a mesuré des notes justes jouées jusqu'à +30 cents près du sillet.
- Options « justesse » : ±30 ou ±20 cents, pour les niveaux avancés.
- Octave : par défaut, le nom de la note suffit (E2 et E3 sont équivalents). Option « octave stricte ».

**Plage de notes**
- Cases 0 à 12, soit E2 à E5.
- Tant que le scénario 6 du POC (cases 6 à 12) n'a pas validé H2 jusqu'à E5, le mode 2 se limite aux cases 0 à 5 (E2 à A4). Une constante unique fixe cette limite.

**Indicateur en direct**
- Note détectée, fréquence, écart en cents, barre de niveau sonore.
- Message « Jouez la note… » quand le silence est détecté pendant plus de 3 secondes.

### 5.3 Accordeur

Repris du POC, avec les mêmes fonctions :
- Accordages : standard (E A D G B E), demi-ton plus bas, drop D, DADGAD.
- Mode cordes (sélection automatique ou manuelle) et mode chromatique.
- Aiguille de −50 à +50 cents, zone verte à ±5 cents, orange à ±15. Au-delà de ±50 cents, le repère reste au bord et le texte indique « beaucoup trop bas / trop haut ».
- Référence A4 réglable de 430 à 450 Hz.
- Retour visuel quand la corde est juste pendant 300 ms, bip optionnel.
- La hauteur est suivie en continu pendant que l'on tourne la mécanique, sans attendre de nouvelle attaque, avec la tolérance d'octave.

Accessible depuis la page d'accueil, pas seulement depuis un mode.

### 5.4 Niveaux et réglages

**Niveaux** (progression linéaire, déverrouillage automatique, communs aux deux modes) **(à confirmer)**

| Niveau | Contenu | Condition de passage |
|---|---|---|
| 1 | Cordes à vide (E, A, D, G, B, E) | 80 % de réussite sur 20 questions |
| 2 | Cases 0 à 5, notes naturelles | 80 % sur 20 questions |
| 3 | Cases 0 à 5, toutes les notes | 80 % sur 30 questions |
| 4 | Cases 0 à 7, toutes les notes | 80 % sur 30 questions |
| 5 | Manche complet (cases 0 à 12) | Pas de passage, mode libre |

En mode 2, un niveau dont les positions dépassent la plage validée (5.2) est limité à cette plage.

Les notes sont affichées en dièses (A#, convention du POC).

**Réglages** (accessibles en permanence)
- Tolérance du mode 2 : demi-ton (défaut) / ±30 / ±20 cents
- Octave stricte (oui / non)
- Afficher les notes sur le manche (oui / non)
- Afficher la case en mode 2 (oui / non)
- Référence A4 (430 à 450 Hz)
- Seuil de silence : « Mesurer le bruit ambiant » (2 s, sans jouer), fait aussi au démarrage du micro
- Retour sonore (oui / non)
- Exporter / importer la progression (JSON)
- Réinitialiser la progression (avec confirmation)

---

## 6. Modèle de données

Stockage en `localStorage`, clé `fretmap.v1`. Version du schéma dans l'objet pour permettre les migrations.

```ts
type Corde = 1 | 2 | 3 | 4 | 5 | 6;            // 1 = la plus aiguë (E4), 6 = la plus grave (E2)
type Case = number;                             // 0 à 12
type Mode = 1 | 2;

interface Statistique {
  mode: Mode;
  corde: Corde;                                 // en mode 2 : corde demandée
  case: Case;                                   // en mode 2 : case de la position demandée
  tentatives: number;
  reussites: number;
  tempsMoyenMs: number;                         // en mode 2, inclut la latence de détection (environ 200 ms)
  derniereDate: string;                         // ISO 8601
}

interface Reglages {
  tolerance: 50 | 30 | 20;                      // 50 = demi-ton (défaut)
  octaveStricte: boolean;
  afficherNotes: boolean;
  afficherCaseMode2: boolean;
  a4: number;                                   // 430 à 450
  seuilSilenceDb: number;                       // mesuré ; −45 par défaut
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
- Les statistiques sont mises à jour à chaque réponse, dans le mode concerné. Une attaque « non reconnue » (5.2) n'est pas une réponse.
- Une migration est prévue dès la v1 (fonction `migrer(progression)`), même vide.
- Un export JSON et un import JSON permettent de sauvegarder la progression manuellement.

---

## 7. Interface et parcours

**Écrans**
1. **Accueil** : boutons Mode 1, Mode 2, Accordeur, Statistiques, Réglages. Affichage du niveau actuel.
2. **Mode 1** : manche, question, score, bouton « Arrêter ».
3. **Mode 2** : question, indicateur en direct, historique des dernières réponses, bouton « Arrêter ».
4. **Accordeur** : aiguille, sélection de corde, accordage, A4.
5. **Statistiques** : tableau des positions (grille 6 × 13, par mode) colorées selon le taux de réussite, niveau atteint, séries.
6. **Réglages** : liste des options de 5.4.

**Parcours minimal**
- Au premier lancement : écran d'accueil, accès direct au Mode 1 niveau 1. Aucune inscription, aucun formulaire.
- Mode 2 et accordeur demandent le micro au premier usage, avec un texte explicatif avant la demande de permission, puis la consigne de calibrage (« ne jouez pas pendant 2 s »).

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

L'application est dans `app/`, à côté du POC qui reste la référence de mesure **(à confirmer)**. GitHub Pages publie l'application à la racine du site et le POC sous `/poc/` : le workflow `.github/workflows/pages.yml` existant est adapté, `ci.yml` lance les tests des deux projets.

```
fretmap/
├── .github/workflows/
│   ├── ci.yml                       # Existant : tests et build (POC et application)
│   └── pages.yml                    # Existant : déploiement, à adapter (application + POC sous /poc/)
├── docs/                            # Spécifications et revues
├── poc-guitare/                     # POC, inchangé (campagne de mesure, scénario 6)
└── app/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.ts                  # Point d'entrée et routage simple entre écrans
    │   ├── audio/                   # Copié du POC sans modification
    │   │   ├── micro.ts
    │   │   ├── pitch.ts             # ChaineDetection : attaque, lissage, stabilité, tolérance d'octave
    │   │   └── niveau.ts
    │   ├── music/                   # Fonctions pures, testées
    │   │   ├── notes.ts             # Copié du POC : fréquence ↔ MIDI ↔ nom
    │   │   ├── accordages.ts        # Copié du POC
    │   │   └── manche.ts            # Note d'une position (corde + case), positions d'une note
    │   ├── progression/
    │   │   ├── stockage.ts          # Lecture et écriture localStorage, migration
    │   │   ├── statistiques.ts      # Mise à jour et pondération des tirages
    │   │   └── niveaux.ts           # Règles de passage de niveau
    │   ├── quiz/
    │   │   ├── tirage.ts            # Choix de la question selon le niveau
    │   │   └── validation.ts        # Réponse du mode 1 ; mode 2 : règles de Campagne.traiterNote du POC
    │   ├── ui/
    │   │   ├── textes.ts            # Tous les textes de l'interface
    │   │   ├── accueil.ts
    │   │   ├── manche.ts            # Rendu du manche (SVG)
    │   │   ├── mode1.ts
    │   │   ├── mode2.ts
    │   │   ├── accordeur.ts
    │   │   ├── statistiques.ts
    │   │   ├── reglages.ts
    │   │   └── composants.ts        # Boutons, aiguille, barre de niveau
    │   └── styles.css
    ├── tests/
    │   ├── unit/                    # Vitest
    │   └── e2e/                     # Playwright
    └── public/
        └── icone.svg
```

Les modules `music/`, `progression/` et `quiz/` ne dépendent pas du DOM : ils doivent être testables sans navigateur.

Les règles de validation du mode 2 (première note stable après une attaque, note précédente ignorée une fois, non-détection au bout de 1,5 s) sont dans `poc-guitare/src/journal/campagne.ts` (`Campagne.traiterNote`) : les reprendre dans `quiz/validation.ts` avec leurs tests (`poc-guitare/tests/campagne.test.ts`).

---

## 9. Points de vigilance

- **Octave erronée** : dans le POC, les sauts d'octave venaient des cordes graves pendant la résonance (E2 → E3) et de l'harmonique 4 (B3 → B5), pas de l'attaque. La tolérance d'octave les supprime : aucune erreur d'octave à l'attaque sur 230 notes. Elle doit rester activée ; l'option « octave stricte » est donc possible.
- **Tolérance réelle** : le POC validait sur le demi-ton. Les notes justes jouées près du sillet ont atteint +30 cents (pression du doigt, justesse de la guitare). Ne pas resserrer la tolérance par défaut sans nouvelle mesure.
- **Corde précédente** : au changement de corde, la corde précédente qui sonne encore a causé 4 des 7 erreurs d'une session du POC. Consigne d'étouffer, et note précédente ignorée une fois (5.2).
- **Résonance de caisse** : vers 95 à 110 Hz sur une guitare acoustique, elle domine quand la corde s'éteint. D'où la règle « première note après l'attaque ».
- **Latence** : mesurée dans le POC sur Android : médiane de 183 à 200 ms, maximum 283 ms, sans la latence d'entrée du matériel. Si elle dépasse 300 ms sur un appareil, réduire la fenêtre d'analyse à 2048 et le signaler dans la documentation.
- **Calibrage** : un seuil de silence mesuré pendant que l'on joue est trop haut et bloque toute détection. La consigne « ne jouez pas » est obligatoire.
- **Permissions micro** : messages d'erreur clairs pour refus, absence de micro, et micro occupé par une autre application (repris de `ErreurMicro` du POC).
- **Mise en veille** : quand l'onglet passe en arrière-plan, arrêter le micro et le quiz, puis proposer de reprendre.
- **Perte de progression** : `localStorage` peut être vidé par le navigateur. L'export JSON est donc une fonction visible dans les réglages.
- **Guitare désaccordée** : afficher un rappel vers l'accordeur si le mode 2 échoue plusieurs fois de suite sur la même corde, ou si l'écart moyen des notes justes d'une corde dépasse 20 cents.

---

## 10. Tests

**Unitaires (Vitest)**
- `notes.ts` : conversions fréquence ↔ MIDI ↔ nom, cas limites (A4 à 432 Hz, fréquences hors plage). Les tests du POC sont repris.
- `manche.ts` : pour chaque corde et chaque case, la note calculée est correcte (couvrir les 6 × 13 positions).
- `accordages.ts` : chaque accordage renvoie six notes et les fréquences attendues.
- `validation.ts` : mode 1 (juste, fausse, case équivalente sur la même corde) ; mode 2 (dans la tolérance, hors tolérance, octave stricte et non stricte, première note après l'attaque, changement sans attaque ignoré, note précédente ignorée une fois, non-détection).
- `niveaux.ts` : passage de niveau au seuil, pas de passage en dessous, niveau 5 sans fin, limite de plage du mode 2.
- `stockage.ts` : sauvegarde, lecture, migration, comportement si `localStorage` est vide ou corrompu.

**End-to-end (Playwright)**
- Mode 1 : une question complète, bonne réponse et mauvaise réponse.
- Réglages : modification et persistance après rechargement.
- Export et import JSON.
- Mode 2 : Chromium avec un micro simulé par un fichier WAV (`--use-fake-device-for-media-stream`, `--use-file-for-fake-audio-capture`). Le fichier commence par au moins 2 s de silence (calibrage), puis contient une note juste et une note fausse. Méthode utilisée pendant le POC.

**Checklist manuelle (mode 2, à chaque version)**
- [ ] Guitare acoustique, Android, Chrome : campagne guidée du POC (scénarios 1, 3 et 6), au moins 90 % de bonnes notes ; journal analysé avec le skill `analyser-journal`
- [ ] Silence de 30 s (scénario 4) : aucune fausse note affichée
- [ ] Mode 2 de l'application : une série complète au niveau 3
- [ ] Refus du micro : message explicite, pas de blocage
- [ ] Passage en arrière-plan puis retour : micro arrêté, reprise possible

---

## 11. Critères d'acceptation

La version 1 est terminée quand :

- [ ] `npm run dev`, `npm run build` et `npm test` passent sans erreur dans `app/`
- [ ] Le déploiement GitHub Pages se fait automatiquement depuis `main`, application à la racine du site et POC sous `/poc/`
- [ ] Le mode 1 propose les 5 niveaux, avec score, série et statistiques
- [ ] Le mode 2 valide les notes des cases 0 à 12 (ou 0 à 5 si le scénario 6 n'a pas validé E5) sur Android avec guitare acoustique
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
| 0 | Confirmer les points marqués « à confirmer » (voir `revue-specs-app.md`) ; jouer le scénario 6 du POC | Spécification figée |
| 1 | Mise en place dans `app/` : Vite, TypeScript, lint, adaptation de `ci.yml` et `pages.yml`, copie des modules `audio/` et `music/` du POC avec leurs tests | Page d'accueil déployée, POC toujours en ligne sous `/poc/` |
| 2 | Modèle de données, stockage, `music/manche.ts` testé | Tests unitaires verts |
| 3 | Mode 1 : manche, quiz, score, statistiques | Mode 1 jouable |
| 4 | Mode 2 : détection, validation, indicateur en direct, test end-to-end avec micro simulé | Mode 2 jouable sur Android |
| 5 | Accordeur complet, réglages, export et import | Accordeur et réglages |
| 6 | Niveaux, pondération des tirages, finitions visuelles, accessibilité | Version 1 candidate |
| 7 | Tests terrain sur Android avec guitare (checklist), corrections | Version 1 publiée |

---

## 13. Consignes pour Claude Code

- Ne pas commencer avant que les points « à confirmer » soient tranchés.
- Commencer par la phase 1 et la phase 2. Ne pas construire l'interface avant que les modules `music/` et `progression/` soient testés.
- Reprendre le code audio du POC sans le modifier, sauf si une constante doit changer. Toute modification est notée dans le commit et justifiée par une mesure.
- Ne pas modifier `poc-guitare/` : il reste l'outil de mesure (campagne guidée).
- Garder les textes de l'interface dans un fichier dédié (`src/ui/textes.ts`), pour faciliter une future traduction.
- Ne pas ajouter de fonctionnalité hors périmètre, en particulier comptes, backend et accords.
- Chaque phase se termine par un commit propre et une mise à jour du `README.md`.
- En cas de doute sur une valeur (tolérance, seuil, clarté), la signaler dans la réponse plutôt que de la deviner.
