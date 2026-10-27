# Spécifications du POC : notes qui tombent

Document destiné à Claude Code. Il décrit le POC du jeu « Notes qui tombent », ses règles, les hypothèses à valider et le protocole de test. Lire l'intégralité avant de commencer.

**Version 1.1** (27/10/2026). Version 1 : rédigée à partir des réponses de l'utilisateur à 20 questions (annexe A). Version 1.1 (phase 2) : stockage séparé du journal (`stockage.ts`), durée d'image plafonnée, apparition immédiate sur un écran vide, temps de réponse médian dans le résumé. Les valeurs chiffrées des règles (vitesse, points, seuils des hypothèses) sont des propositions, à ajuster à la relecture ou après les mesures.

---

## 1. Contexte et objectif

L'application (`app/`) fait apprendre les notes du manche en deux modes : toucher la case sur un manche virtuel (mode 1) ou jouer la note demandée à la guitare (mode 2, au micro). Le premier POC (`poc-guitare/`) a validé la détection de hauteur note par note : 96,9 % de bonnes notes de E2 à E5, latence médiane de 183 à 200 ms après l'attaque ([`poc-guitare/SYNTHESE.md`](../poc-guitare/SYNTHESE.md)).

Ce POC teste un **jeu** : le manche est affiché avec ses cordes, et les notes à jouer descendent du haut vers le bas de l'écran. Le joueur doit jouer chaque note à la guitare avant qu'elle n'atteigne le bas. Le jeu a des délais, une vitesse qui s'adapte et des points.

**Objectif du POC** (Q1) : répondre à deux questions.
1. **Technique** : la détection au micro tient-elle dans un jeu en temps réel, avec une animation fluide et une file de notes ?
2. **Pédagogie** : ce format aide-t-il à mémoriser le manche, et donne-t-il envie de rejouer ?

En cas de Go, le jeu devient le **mode 3 de l'application** (Q20). Le code est donc organisé pour y être repris.

---

## 2. Périmètre

### Inclus
- Une page web statique, dans un nouveau dossier `poc-chute/` (Q3), déployée sur GitHub Pages sous https://gnatali.github.io/fretmap/poc-chute/
- Entrée par la guitare et le micro seulement (Q2)
- Téléphone Android, Chrome, en **portrait** (Q4)
- Manche vertical avec chute des notes le long des cordes (Q5)
- File de notes, vitesse adaptative, points, fin après un nombre fixe de notes
- Tirage des notes dans les 7 niveaux de l'application, pondéré par les statistiques par position
- Journal des parties exportable en JSON (Q19)
- Options de mesure et mode simulation (sans micro), pour les tests

### Exclu
- Réponse au toucher (manche virtuel), affichage en paysage, ordinateur, iPhone
- Son pendant la partie : ni musique, ni bip, ni métronome (Q17)
- Guitare électrique, accords, notes au-delà de E5
- Déblocage des niveaux, comptes, classement, meilleurs scores
- Accordeur : le joueur accorde sa guitare avec celui de l'application avant de jouer
- Modification de `app/` ou de `poc-guitare/`

---

## 3. Acquis repris

Ces points viennent du premier POC et de l'application. Ils ne sont pas remis en cause ici.

- **Micro** : `echoCancellation`, `noiseSuppression` et `autoGainControl` désactivés et vérifiés, `AudioContext` créé au clic sur « Démarrer », HTTPS (spec de l'application, §3).
- **Détection** : valeurs validées du premier POC (fenêtre de 4096 échantillons, clarté 0,9, médiane de 5 mesures, stabilité de 100 ms, détection d'attaque, tolérance d'octave), dans `audio/` de l'application.
- **Calibrage** : 2 s de mesure du bruit ambiant au démarrage du micro, consigne « ne jouez pas ».
- **Règles du mode 2** (`SuiviMode2`, `app/src/quiz/validation.ts`) : seule compte la première note stable après une attaque ; une note identique à la note précédente est ignorée une fois (corde précédente encore sonore) ; une attaque sans note stable au bout de 1,5 s est « non reconnue » et ne compte pas.
- **Validation** : tolérance d'un demi-ton (±50 cents), octave non stricte (le nom de la note suffit). Le micro ne peut pas vérifier la corde : la corde affichée est une consigne, les statistiques vont à la position demandée.
- **Écran allumé** : verrou de veille (Screen Wake Lock) pendant l'écoute, comme en mode 2.
- **Référence A4** : 440 Hz, sans réglage dans le POC.

---

## 4. Stack technique

Le même outillage que `app/`, pour que le code passe dans l'application sans réécriture.

| Élément | Choix |
|---|---|
| Langage | TypeScript 6.0 |
| Build | Vite, `base: './'` (chemins relatifs, comme l'application), publié sous `/fretmap/poc-chute/` |
| Interface | Svelte 5 (runes), sans SvelteKit |
| Audio | Web Audio API, `pitchy` (comme l'application) |
| Rendu de la chute | Composants Svelte en DOM, position en `transform: translateY` calculée à chaque `requestAnimationFrame` ; repli sur Canvas 2D si l'hypothèse HC1 (fluidité) échoue |
| Tests | Vitest (logique), Playwright (profil Pixel 7, mode simulation) |
| Lint et format | ESLint (`eslint-plugin-svelte`), Prettier (`prettier-plugin-svelte`) |
| Stockage | `localStorage`, clé `fretmap-chute.v1` |
| Déploiement | Job ajouté à `.github/workflows/pages.yml` (copie de `poc-chute/dist` dans `site/poc-chute`) ; job CI ajouté à `ci.yml` |

---

## 5. Architecture des fichiers

```
poc-chute/
  index.html, package.json, vite.config.ts, svelte.config.js, tsconfig.json, eslint.config.js, playwright.config.ts
  README.md                  installation, lancement, utilisation
  SYNTHESE.md                après la campagne : résultats par hypothèse, décision
  resultats/                 journaux de la campagne
  src/
    main.ts, styles.css      copies de l'application (démarrage, variables de couleur claires et sombres)
    App.svelte               choix de l'écran : départ, partie, fin
    ecoute.svelte.ts         copie de app/src/ecoute.svelte.ts (classe Ecoute)
    audio/                   copie de app/src/audio/ (micro, niveau, pitch)
    music/                   copie de app/src/music/ (manche, notes, notation, accordages)
    quiz/                    copie de app/src/quiz/tirage.ts (tirerQuestion) et validation.ts (SuiviMode2)
    progression/             copie de app/src/progression/modele.ts (types), niveaux.ts (NIVEAUX, positionsDuNiveau,
                             CASE_MAX_MODE2) et statistiques.ts (poidsPosition, poidsDuMode)
    jeu/                     nouveau, TypeScript pur, sans DOM
      chute.ts               file de notes, progression dans le temps, apparitions, notes ratées
      vitesse.ts             durée de chute adaptative
      points.ts              barème
      partie.ts              déroulement d'une partie : note attendue, résultats, série, fin
      journal.ts             format du journal, mesures d'images, export
      stockage.ts            localStorage : réglages, seuil, statistiques par position, journal des parties
    ui/
      textes.ts              tous les textes de l'interface
      ecrans/                Depart.svelte, Partie.svelte, Fin.svelte
      composants/            MancheChute.svelte (manche, notes qui tombent, ligne de jeu), Indicateur.svelte
  tests/
    unit/*.test.ts
    e2e/*.spec.ts
```

- Les copies sont **figées** et **identiques** à l'application (commit `34203e7`), code inutilisé compris : `diff` avec `app/` reste vide, ce qui facilite le retour dans l'application. Elles ne suivent pas les changements de l'application pendant le POC. Les tests unitaires de ces modules sont copiés avec eux. Liste dans `poc-chute/README.md`.
- `jeu/` ne dépend que de `music/`, `quiz/` et `progression/` (et du type `EtatDetection` de `audio/pitch.ts`). Il reçoit le temps en paramètre (pas d'appel à `performance.now()`), pour être testé sans navigateur. C'est le dossier qui passera dans `app/src/` en cas de Go.

---

## 6. Spécifications fonctionnelles

### 6.1 Écran de départ
- Choix du niveau, parmi les 7 niveaux de l'application, tous ouverts (Q16). Rappel du contenu du niveau (ex. « Cases 0 à 5, notes naturelles »).
- Durée de chute initiale : curseur de 1 à 10 s, par pas de 0,5 s, 6 s par défaut (Q11).
- Notation des notes : anglo-saxonne, française, les deux (défaut), comme dans l'application.
- **Options de mesure**, repliées par défaut : « Afficher la case » et « Vitesse fixe » (6.9).
- Bouton « Démarrer » : démarre le micro, puis le calibrage (2 s), puis la partie après un compte à rebours de 3 s.
- Bouton « Exporter le journal » et « Vider le journal » (avec confirmation).
- Les choix sont enregistrés et repris à la visite suivante.

### 6.2 Affichage de la partie
- Le **manche vertical** de l'application occupe l'écran (Q5) : 6 cordes en colonnes (corde 6 à gauche), cases en lignes de la case 0 en haut à la case maximale du niveau, marqueurs aux cases 3, 5, 7, 9 et 12. Pas de notes écrites sur les cases.
- La **ligne de jeu** est en bas, sous la dernière case.
- En haut : score, série et multiplicateur, nombre de notes restantes, durée de chute actuelle.
- Chaque **note qui tombe** descend dans la colonne de sa corde (Q5). Son étiquette donne le **nom de la note** dans la notation choisie ; la corde est donnée par la colonne ; **la case est à trouver** (Q6). La chute ne révèle pas la case : la note passe devant toutes les cases de la corde.
- **Niveau 1** (cordes à vide) : la question ne donne pas la corde (règle de l'application). La note tombe au centre du manche, sur toute la largeur.
- La **note attendue** (la plus basse, 6.3) est mise en évidence (contour épais) ; les autres sont atténuées.
- **Indicateur** en bas de l'écran : note détectée et écart en cents (Q8), niveau sonore, message « Jouez la note… » après 3 s de silence et « Note non reconnue, rejouez » (règle du mode 2).
- **Retours** à chaque résultat (Q8) :
  - note juste : la note devient verte et s'efface, avec la qualité du timing (« Parfait », « Bien », « Juste ») et les points gagnés ;
  - fausse note ou note ratée : la note devient rouge et s'efface, avec la note jouée s'il y en a une ;
  - après une erreur, la **bonne case** s'affiche 1,5 s sur le manche (toutes les cases de la corde qui donnent la note).
- Bouton « Arrêter » : met fin à la partie (enregistrée comme interrompue).

### 6.3 Chute et délai
- **Progression** : chaque note a une progression `p` de 0 (apparition en haut) à 1 (ligne de jeu). À chaque image, `p` augmente de `dt / durée de chute actuelle`. La vitesse est **commune** à toutes les notes à l'écran : un changement de vitesse s'applique à toutes en même temps, et une note ne peut pas en dépasser une autre. Une image de plus de 100 ms (`DT_MAX_MS`, onglet en arrière-plan) compte pour 100 ms : les notes ne sautent pas toutes à la ligne d'un coup.
- **Apparition** : la première note apparaît au début de la partie ; une nouvelle note apparaît quand la précédente a parcouru un tiers de la chute (`ESPACEMENT_APPARITION`), ou tout de suite si l'écran est vide (le joueur a joué toutes les notes) : le jeu suit son rythme, sans temps mort. Il y a donc au plus 3 ou 4 notes à l'écran.
- **File, dans l'ordre** (Q7) : seule la note la plus basse est **attendue**. Quand elle disparaît (jouée, détruite ou ratée), la suivante devient attendue.
- **Délai** (Q9) : une note peut être jouée dès qu'elle est attendue et jusqu'à ce qu'elle touche la ligne. Il n'y a pas de fenêtre de rythme.
- **Qualité du timing** : selon la progression au moment de la validation : Parfait si `p ≤ 1/3`, Bien si `p ≤ 2/3`, Juste au-delà.
- **Note ratée** (Q12) : elle touche la ligne (`p = 1`) sans avoir été jouée. Elle rapporte 0 point, casse la série et ralentit la chute (6.5).
- **Temps de réponse** (statistiques et journal) : de l'instant où la note devient attendue (ou apparaît, si elle apparaît plus tard) jusqu'à la détection.

### 6.4 Validation au micro
- La partie s'appuie sur `SuiviMode2`, sans modification. Quand une note devient attendue, `poser(question, précédente)` est appelé, avec la note qui vient de disparaître comme précédente.
- **Note juste** (événement `reponse`, `juste`) : la note est validée.
- **Fausse note** (événement `reponse`, pas `juste`) (Q14) : la note attendue est **détruite**. C'est une erreur, avec le même effet qu'une note ratée : 0 point, série cassée, ralentissement.
- **Ancienne note** (événement `ancienneNote`) : ignorée une fois, sans effet, notée dans le journal. C'est la protection contre la corde précédente qui sonne encore, plus importante ici puisqu'une fausse note détruit la note.
- **Non reconnue** (événement `nonReconnue`) : message affiché, sans effet sur la note, noté dans le journal.
- **Latence** (Q18) : pas de compensation. La note est validée à l'instant de la détection, même si l'attaque a eu lieu juste avant que la note touche la ligne. Le journal enregistre l'instant de l'attaque et celui de la détection, pour compter les notes perdues à cause de la latence (HC3).
- **Statistiques** : chaque note juste ou en erreur (fausse ou ratée) met à jour la statistique de la **position demandée** (tentatives, réussites, temps de réponse moyen), comme en mode 2.

### 6.5 Vitesse adaptative
Q10 : la vitesse s'adapte au joueur pour le garder à sa limite ; Q11 : la plage de vitesses du jeu sera décidée sur les mesures.

- **Départ** : la durée de chute choisie sur l'écran de départ.
- **Accélération** : après 5 notes justes d'affilée (`NOTES_AVANT_ACCELERATION`), durée × 0,9 (`FACTEUR_ACCELERATION`). Le décompte repart de zéro.
- **Ralentissement** : après chaque erreur (fausse note ou note ratée), durée × 1,15 (`FACTEUR_RALENTISSEMENT`), et le décompte d'accélération repart de zéro.
- **Bornes** : 1 à 10 s (`DUREE_CHUTE_MIN_MS`, `DUREE_CHUTE_MAX_MS`).
- Option de mesure « Vitesse fixe » : la durée ne change pas pendant la partie.

### 6.6 Points
Q13 : tous les bonus proposés sont retenus.

Points d'une note juste, arrondis à l'entier :

```
points = 100 × timing × vitesse × difficulté × multiplicateur
```

| Facteur | Valeur |
|---|---|
| Timing | Parfait × 1,5 ; Bien × 1,2 ; Juste × 1 |
| Vitesse | 5 s / durée de chute au moment de la validation (× 0,5 à 10 s, × 1 à 5 s, × 2 à 2,5 s, × 5 à 1 s) |
| Difficulté | 1 + 0,5 si la note est altérée (#) + 0,5 si la case demandée est entre 7 et 12 (× 1 à × 2) |
| Multiplicateur de série | min(4, 1 + ⌊série / 10⌋), la série comptant la note jouée : × 2 à la 10e note juste d'affilée, × 3 à la 20e, × 4 à la 30e |

- Exemple : note juste, Bien, chute de 4 s, F# en case 2, 12e note juste d'affilée : 100 × 1,2 × 1,25 × 1,5 × 2 = 450 points.
- Une erreur rapporte 0 point et remet la série à zéro. Pas de points retirés.

### 6.7 Fin de partie
- La partie compte **30 notes** (Q15, `NOTES_PAR_PARTIE`) et se termine quand la 30e est jouée, détruite ou ratée.
- Écran de fin :
  - score ;
  - notes justes, fausses et ratées ;
  - meilleure série ;
  - durée de chute de départ, de fin et la plus courte atteinte ;
  - temps de réponse médian ;
  - les positions ratées, avec leur bonne case.
- Boutons « Rejouer » (mêmes réglages), « Changer de niveau » et « Exporter le journal ».

### 6.8 Tirage des notes
- Positions du niveau choisi : `positionsDuNiveau(niveau, 2)` (plage bornée par `CASE_MAX_MODE2`).
- Tirage pondéré (Q16) : `tirerQuestion` avec les poids de `poidsPosition`, calculés sur les statistiques par position **propres au POC** (pas celles de l'application). Les positions les moins maîtrisées reviennent plus souvent.
- Pas deux fois la même position d'affilée (règle de `tirerQuestion`). Au niveau 1, le tirage porte sur les noms de note (règle de l'application).

### 6.9 Options de mesure et simulation
- **Afficher la case** : l'étiquette de la note donne aussi la case (« Sol · case 5 »). Le joueur n'a plus à chercher : la partie mesure la détection et la latence seules (enseignement du scénario 5 du premier POC).
- **Vitesse fixe** : désactive la vitesse adaptative (6.5).
- **Mode simulation** (`?simulation` dans l'adresse) : pas de micro ; la touche Espace ou un bouton « Jouer la note » valide la note attendue, la touche F joue une fausse note. Sert au développement et aux tests de bout en bout. Les parties simulées sont marquées dans le journal.

### 6.10 Données et journal
- `localStorage`, clé `fretmap-chute.v1`, avec un numéro de version de schéma :
  - réglages de l'écran de départ et dernier seuil de silence mesuré ;
  - statistiques par position (tentatives, réussites, temps de réponse moyen), pour le tirage ;
  - journal des 50 dernières parties (`PARTIES_GARDEES`).
- **Export JSON** (Q19) : fichier `journal-poc-chute-AAAAMMJJ-HHMM.json`, avec toutes les parties gardées. Les temps sont en millisecondes depuis le début de la partie.

```json
{
  "format": "fretmap-chute-journal",
  "version": 1,
  "exporteLe": "2026-10-28T19:30:00.000Z",
  "parties": [
    {
      "debut": "2026-10-28T19:05:12.000Z",
      "navigateur": "Mozilla/5.0 (Linux; Android 14; …) Chrome/…",
      "simulation": false,
      "interrompue": false,
      "reglages": { "niveau": 5, "dureeInitialeMs": 6000, "vitesseFixe": false, "afficherCase": false, "notation": "les-deux" },
      "seuilSilenceDbfs": -52.3,
      "traitementsActifs": [],
      "images": { "nombre": 5400, "medianeMs": 16.7, "p95Ms": 18.2, "partAuDelaDe33Ms": 0.004 },
      "resume": { "score": 8450, "justes": 26, "fausses": 2, "ratees": 2, "meilleureSerie": 14, "dureeFinaleMs": 3900, "dureeMinMs": 3500, "tempsReponseMedianMs": 1850 },
      "notes": [
        {
          "index": 1,
          "position": { "corde": 5, "case": 3 },
          "nom": "C",
          "midi": 48,
          "tApparitionMs": 0,
          "tAttendueMs": 0,
          "tAttaqueMs": 2310,
          "tDetectionMs": 2495,
          "detectee": { "nom": "C", "midi": 48, "cents": -6 },
          "resultat": "juste",
          "progression": 0.42,
          "dureeChuteMs": 6000,
          "timing": "bien",
          "points": 100,
          "serie": 1,
          "evenements": [{ "type": "nonReconnue", "tMs": 1200 }]
        }
      ]
    }
  ]
}
```

- `resultat` : `juste`, `fausse` ou `ratee`. `tAttaqueMs` : dernière attaque entendue pendant que la note était attendue (null si aucune). `progression` et `dureeChuteMs` : au moment du résultat. `evenements` : `ancienneNote` et `nonReconnue`, qui ne comptent pas. `tDetectionMs` et `detectee` sont null pour une note ratée, `timing` pour toute note qui n'est pas juste. `tempsReponseMedianMs` : médiane des temps de réponse des notes justes (de l'instant où la note est attendue à la détection).
- `images` : durées entre deux `requestAnimationFrame` pendant la partie (médiane, 95e centile, part au-delà de 33 ms). Le micro tourne en même temps : c'est la mesure de HC1.

---

## 7. Constantes

Dans `src/jeu/`, nommées en majuscules et commentées avec leur valeur initiale et leur origine. Toutes sont « à ajuster » d'après les mesures.

| Constante | Valeur initiale | Origine |
|---|---|---|
| `NOTES_PAR_PARTIE` | 30 | Q15 |
| `DUREE_CHUTE_DEFAUT_MS` | 6000 | Q11, proposition |
| `DUREE_CHUTE_MIN_MS`, `DUREE_CHUTE_MAX_MS` | 1000, 10000 | Q11 |
| `ESPACEMENT_APPARITION` | 1/3 de la chute | proposition |
| `NOTES_AVANT_ACCELERATION` | 5 | Q10, proposition |
| `FACTEUR_ACCELERATION` | 0,9 | Q10, proposition |
| `FACTEUR_RALENTISSEMENT` | 1,15 | Q12, proposition |
| `SEUILS_TIMING` | 1/3, 2/3 de la chute | Q9, proposition |
| `POINTS_BASE` | 100 | Q13 |
| `BONUS_TIMING` | 1,5 ; 1,2 ; 1 | Q13, proposition |
| `DUREE_REFERENCE_VITESSE_MS` | 5000 | Q13, proposition |
| `BONUS_ALTEREE`, `BONUS_CASES_HAUTES` | 0,5 ; 0,5 (cases 7 à 12) | Q13, proposition |
| `CASE_HAUTE_MIN` | 7 | Q13, proposition |
| `PALIER_SERIE`, `MULTIPLICATEUR_MAX` | 10, 4 | Q13, proposition |
| `DUREE_RAPPEL_CASE_MS` | 1500 | Q8, proposition |
| `PARTIES_GARDEES` | 50 | proposition |
| `DT_MAX_MS` | 100 | proposition (version 1.1) |

---

## 8. Hypothèses à valider

Seuils proposés, à confirmer à la relecture.

| # | Hypothèse | Critère de réussite | Mesure |
|---|---|---|---|
| HC1 | L'animation reste fluide avec le micro actif | Médiane ≥ 55 images/s (≤ 18 ms) et moins de 5 % d'images au-delà de 33 ms, sur toutes les parties | Journal (`images`) |
| HC2 | La détection est fiable en jeu | Case affichée : ≥ 95 % de notes justes au premier essai, et au plus 1 note détruite à tort par partie (fausse note alors que la case était affichée) | Scénario S1 |
| HC3 | La latence ne gâche pas le jeu | Médiane de l'attaque à la validation < 300 ms ; < 5 % des notes ratées alors que l'attaque a eu lieu avant la ligne | Scénarios S1 à S3 |
| HC4 | La vitesse adaptative trouve la limite du joueur | La durée de chute varie de moins de ±20 % sur les 10 dernières notes d'une partie ; relever la plage jouée par niveau (pour fixer la plage du mode 3, Q11) | Scénarios S2 et S3 |
| HC5 | Le jeu aide à mémoriser le manche | Entre le 1er et le 5e jour, au même niveau : temps de réponse médian en baisse d'au moins 20 %, ou réussite en hausse d'au moins 10 points ; et ressenti positif de l'utilisateur (plaisir, envie de rejouer), noté dans la synthèse | Scénario S4 |

---

## 9. Protocole de test

**Matériel** : le téléphone Android et la guitare acoustique du premier POC, guitare accordée avec l'accordeur de l'application, pièce calme.

**Scénarios** :
1. **S1, détection en jeu** : options « Afficher la case » et « Vitesse fixe » à 5 s, niveau 7, 3 parties.
2. **S2, jeu facile** : niveau 2, vitesse adaptative, départ à 6 s, 3 parties.
3. **S3, jeu difficile** : niveau 5, vitesse adaptative, départ à 6 s, 3 parties.
4. **S4, pédagogie** : une partie par jour pendant 5 jours, au même niveau (le niveau 5, ou celui où l'utilisateur fait encore des erreurs), vitesse adaptative, départ à 6 s. À la fin, l'utilisateur note son ressenti : plaisir, difficulté, envie de rejouer, impression d'apprendre.

Exporter le journal après chaque série de parties et l'ajouter à `poc-chute/resultats/`. L'analyse se fait comme pour le premier POC ; un skill d'analyse propre à ce journal sera écrit avec le premier journal reçu.

---

## 10. Critères de décision

- **Go** : HC1 à HC3 validées et HC5 positive. Le jeu devient le mode 3 de l'application, avec les réglages tirés de HC4.
- **Go conditionnel** : HC1 à HC3 validées, HC5 mitigée. Mode 3 proposé comme entraînement ; revoir le barème, l'espacement ou la vitesse de départ avant de l'intégrer.
- **No-go** :
  - HC1 en échec : refaire le rendu en Canvas 2D et remesurer ;
  - HC2 ou HC3 en échec : note qui attend sur la ligne jusqu'à être jouée (pas d'échec par le temps), ou mode 3 au toucher, sans micro.

---

## 11. Critères d'acceptation techniques

Le POC est prêt pour la campagne quand :

- [ ] `npm run lint`, `npm run format:check`, `npm test`, `npm run build` et `npm run test:e2e` passent dans `poc-chute/`, en CI comme en local
- [ ] Le POC est publié sur https://gnatali.github.io/fretmap/poc-chute/ sans changer l'application ni le premier POC
- [ ] Le micro démarre au clic sur « Démarrer », calibre 2 s, puis la partie commence ; un refus d'autorisation affiche un message explicite
- [ ] Les notes tombent le long de leur corde, dans l'ordre, avec la note attendue mise en évidence
- [ ] Note juste, fausse note, note ratée, ancienne note et note non reconnue suivent 6.3 et 6.4
- [ ] La vitesse s'adapte (6.5) et les points suivent le barème (6.6)
- [ ] La partie s'arrête à 30 notes et affiche l'écran de fin
- [ ] Le journal survit à un rechargement, s'exporte en JSON au format de 6.10, et se vide après confirmation
- [ ] Le mode simulation permet de jouer une partie complète sans micro

---

## 12. Tests

**Unitaires** (`tests/unit/`, sans navigateur ni micro ; `jeu/` reçoit le temps en paramètre) :
- `chute.test.ts` : progression en fonction du temps ; apparition au tiers de la chute ; note ratée à `p = 1` ; un changement de vitesse s'applique à toutes les notes, sans dépassement.
- `vitesse.test.ts` : accélération après 5 notes justes ; ralentissement après une erreur ; bornes de 1 et 10 s ; vitesse fixe.
- `points.test.ts` : exemple de 6.6 ; chaque facteur seul ; paliers du multiplicateur (9e, 10e, 20e, 30e note).
- `partie.test.ts` : la fausse note détruit la note attendue ; ancienne note ignorée une fois ; note non reconnue sans effet ; statistiques sur la position demandée ; fin à 30 notes ; partie interrompue.
- `journal.test.ts` : format de l'export, mesures d'images (médiane, 95e centile, part au-delà de 33 ms), limite de 50 parties, relecture après rechargement.

**De bout en bout** (`tests/e2e/`, Playwright, profil Pixel 7, mode simulation) : une partie complète au niveau 2 jusqu'à l'écran de fin ; une note ratée quand on ne joue pas ; une fausse note par la touche F ; l'export télécharge un JSON valide.

---

## 13. Phases de développement

Une phase par session, avec push et vérification de la CI et du déploiement Pages à chaque fois.

| Phase | Contenu |
|---|---|
| 1 | Squelette de `poc-chute/` (outillage de `app/`), copies des modules, jobs CI et Pages, règle `.claude/rules/poc-chute-code.md`, ligne d'état dans `CLAUDE.md` |
| 2 | `src/jeu/` (chute, vitesse, points, partie, journal) et tests unitaires |
| 3 | Écrans en portrait (départ, partie, fin), animation, mode simulation, tests de bout en bout |
| 4 | Branchement du micro (`Ecoute`, `SuiviMode2`), indicateur, retours, mesures d'images, export du journal |
| 5 | Campagne sur Android (S1 à S4), analyse des journaux, `SYNTHESE.md`, décision |

---

## 14. Risques

| Risque | Impact | Parade |
|---|---|---|
| Détection et animation se partagent le processeur | Saccades, latence en hausse | Mesure des images dans chaque partie (HC1) ; fenêtre de 2048 échantillons en réserve ; Canvas 2D en repli |
| Corde précédente encore sonore | Note détruite à tort | Règle de l'ancienne note ; consigne d'étouffer la corde ; compter les cas dans S1 |
| Le joueur regarde sa guitare pour trouver la case | Notes ratées, frustration | Départ lent (6 s), vitesse qui ralentit après chaque erreur |
| Vitesse adaptative qui oscille | Jeu irrégulier | Facteurs modérés, HC4 ; option de vitesse fixe |
| Latence d'entrée du téléphone, non mesurée | Notes validées trop tard | Attaque et détection enregistrées (HC3) |
| Six colonnes en portrait | Notes étroites | 44 px par corde au minimum, étiquettes courtes (notation sur deux lignes, comme l'application) |

---

## 15. Consignes pour Claude Code

- Commencer par la logique (`jeu/`) et le mode simulation : le jeu doit se jouer au clavier avant de brancher le micro.
- Ne modifier ni `app/` ni `poc-guitare/`. Les modules copiés de l'application restent identiques à l'original ; une modification sur mesure est notée dans le commit.
- Garder `jeu/` sans DOM et sans horloge propre : le temps est passé en paramètre.
- Tous les textes de l'interface dans `ui/textes.ts`, en français ; cibles tactiles d'au moins 44 px ; couleurs par variables (clair et sombre).
- Documenter chaque constante de 7 avec sa valeur initiale et son origine.
- Ne rien ajouter hors périmètre (pas de son, pas de déblocage de niveaux, pas de meilleurs scores).

---

## Annexe A : les 20 questions (27/10/2026)

| # | Question | Réponse de l'utilisateur |
|---|---|---|
| Q1 | Que doit prouver le POC ? | Les deux : faisabilité au micro et intérêt pédagogique |
| Q2 | Comment le joueur répond-il ? | Guitare et micro |
| Q3 | Où construire le POC ? | Nouveau dossier |
| Q4 | Appareil et orientation | Android en portrait |
| Q5 | Disposition du manche et de la chute | Cordes verticales, chute le long des cordes |
| Q6 | Information donnée par la note | Nom et corde, case à trouver |
| Q7 | Notes à l'écran | File, jouées dans l'ordre |
| Q8 | Retours visuels | Couleur et effet, note détectée, qualité du timing, position révélée après une erreur |
| Q9 | Quand jouer la note | Pendant toute la chute |
| Q10 | Évolution de la vitesse | Adaptative |
| Q11 | Plage de temps de chute | À mesurer dans le POC |
| Q12 | Note qui atteint le bas | Série cassée et ralentissement |
| Q13 | Calcul des points | Base et multiplicateur de série, bonus de timing, de vitesse et de difficulté |
| Q14 | Fausse note | Erreur, la note est détruite |
| Q15 | Fin de partie | Nombre de notes fixe |
| Q16 | Origine des notes | Niveaux de l'application et tirage pondéré |
| Q17 | Son pendant la partie | Silence |
| Q18 | Latence | Mesurer, sans compenser |
| Q19 | Mesures | Journal JSON exportable |
| Q20 | Suite | Mode 3 de l'application |

**Choix ajoutés à la rédaction, à valider à la relecture** :
- Une fausse note a le même effet qu'une note ratée : série cassée et ralentissement (Q12 et Q14).
- Les statistiques par position sont gardées, car le tirage pondéré en a besoin (Q16), sans écran de statistiques.
- Options de mesure « Afficher la case » et « Vitesse fixe », et mode simulation pour les tests.
- Le ressenti est noté par l'utilisateur dans la synthèse ; pas de questionnaire dans la page (Q19).
- Vitesse commune à toutes les notes à l'écran ; nouvelle note au tiers de la chute ; 30 notes par partie ; valeurs du barème de 6.6.
- Tolérance d'un demi-ton, octave non stricte et A4 à 440 Hz, sans réglage.
