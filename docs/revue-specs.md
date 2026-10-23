# Revue de cohérence des spécifications du POC

Revue de [`specs-poc-manche-guitare.md`](specs-poc-manche-guitare.md), faite au démarrage du projet (23/10/2026).
Les points sont classés en trois groupes : incohérences à trancher, ambiguïtés pour lesquelles un choix a été fait dans le code, et remarques techniques.

## 1. Incohérences à trancher

| # | Sections | Constat | Proposition |
|---|---|---|---|
| I1 | §6 H2, §7 scénario 3 | H2 vise « ≥ 90 % de bonnes notes entre E2 et E5 », mesuré par les scénarios 1 et 3. Or les frettes 0 à 5 en accordage standard couvrent E2 à **A4** (corde de mi aigu, 5e case). E5 (659 Hz) n'est atteint qu'à la 12e case. | Étendre le scénario 3 aux cases 7 et 12 sur les cordes 1 et 2 (B4, E5), ou ramener H2 à « E2 à A4 ». |
| I2 | §8 | Les trois branches de décision ne couvrent pas le cas « H1 et H2 atteintes, mais H3 ou H4 en échec » : ni Go (exige H1–H4), ni No-go (H1 ou H2 seulement). | Ajouter : H3 en échec → réduire la fenêtre (2048) ou la durée de stabilité puis re-tester ; H4 en échec → relever le seuil de silence ou la clarté minimale puis re-tester. |
| I3 | §3, §8 | Le repli de §3 est « autocorrélation maison » ; les options No-go de §8 sont « YIN maison, aubio.js ». pitchy est déjà une autocorrélation (McLeod) : une autocorrélation maison a peu de chances de faire mieux. | Retenir YIN comme premier repli (§3 et §8 alignés), aubio.js en second. |
| I4 | §2, §7 | iOS Safari est exclu du périmètre, mais le protocole prévoit un test « iOS si possible ». | Garder le test iOS comme information non bloquante, sans correctif dans le POC. |
| I5 | §2, §5.5 | Le périmètre parle de « l'accordage standard », §5.5 définit quatre accordages. | Les quatre accordages sont implémentés dans `music/accordages.ts` (coût nul) ; seul le standard est requis pour les scénarios. |
| I6 | §3 | `vite --host --https` ne fonctionne plus : Vite (depuis la v5) n'a plus d'option CLI `--https`, et `server.https` ne génère plus de certificat. | Script `npm run dev:https` avec `@vitejs/plugin-basic-ssl` (certificat auto-signé). |
| I7 | §5.7, §6 H4, §7 scénario 4 | Le journal décrit un essai par note jouée. Le scénario 4 (30 s de silence) mesure un nombre de faux positifs : aucun champ ne permet de l'enregistrer. | Ajouter un champ `faux_positifs` (nombre) ou un bouton « Test de silence 30 s » qui crée un essai avec `note_attendue = silence` et le nombre de notes détectées. À trancher avant J4. |

## 2. Ambiguïtés : choix faits dans le code

| # | Section | Ambiguïté | Choix retenu |
|---|---|---|---|
| A1 | §5.4, §5.7, §6 H1 | `cents = round(...)` donne un entier, alors que le journal montre `4.0` et que H1 est une moyenne < 5 cents : arrondir avant de moyenner fausse le résultat. | `frequenceVersNote` renvoie `cents` (arrondi, pour l'affichage) et `centsExacts` (pour le journal et les moyennes). |
| A2 | §6 H1 | « Écart moyen » : moyenne signée (les erreurs + et − se compensent) ou absolue ? Écart par rapport à quoi ? Si la guitare n'est pas accordée avec une référence, l'écart mesure l'accordage autant que la détection. | Utiliser la **moyenne des valeurs absolues**. Accorder la guitare avec un accordeur de référence (matériel ou appli) juste avant le scénario 1, et noter sa lecture si possible. |
| A3 | §10 | « Fréquences à ±50 cents de chaque note » : à exactement ±50 cents, l'arrondi est ambigu. | Les tests vérifient ±49 cents ; à +50 cents exactement, la note supérieure est retenue (`Math.round`), ce qui est testé. |
| A4 | §10 | « Valeur hors plage » pour `notes.ts` : la plage 70–1400 Hz relève de la détection, pas de la conversion. | `frequenceVersNote` renvoie `null` pour une fréquence ≤ 0 ou non finie ; le filtre 70–1400 Hz est dans `audio/pitch.ts` (`rejetMesure`). |
| A5 | §10 | « 466 Hz → A#4 ou Bb4 selon la convention » ; §5.4 fixe la convention en dièses. | A#4. La saisie manuelle accepte les bémols (`nomVersMidi('Bb4')`). |
| A6 | §5.3 | « Moyenne sur 2 s » : moyenne des dB ou des RMS ? | Moyenne des RMS linéaires, convertie en dBFS, + 10 dB. |
| A7 | §5.7 | Latence « entre l'attaque (pic de RMS au-dessus du seuil) et le premier affichage stable ». Le pic arrive après l'attaque, et une corde rejouée pendant qu'elle sonne ne repasse pas sous le seuil. | Attaque = franchissement du seuil **ou** hausse de ≥ 6 dB par rapport au minimum des 100 ms précédentes (constante à calibrer). |
| A8 | §5.2 | Lissage « moyenne ou médiane ». La moyenne en Hz est faussée par une seule erreur d'octave. | Médiane par défaut (5 mesures), moyenne disponible dans l'interface. Le lissage est vidé à chaque attaque et en silence pour ne pas mélanger deux notes. |
| A9 | §5.5 | « Corde la plus proche » : en Hz ou en cents ? « Juste pendant 300 ms » : avec quelle tolérance ? | En cents (échelle logarithmique). Juste = dans la zone verte (±5 cents). |
| A10 | §5.5 | En mode cordes, l'écart est calculé par rapport à la corde cible et peut dépasser ±50 cents ; la stabilité (§5.2) est définie par demi-ton de la note la plus proche, qui peut basculer en cours d'accordage. | À traiter en J3 : borner l'aiguille à ±50 cents avec une flèche « trop bas / trop haut » au-delà. |
| A11 | §7 scénario 4 | « Fenêtre ouverte » : fenêtre de la pièce (bruit de rue) ou fenêtre du navigateur ? | À préciser ; la seconde lecture rend la mention inutile, la première en fait un test en conditions bruyantes. |
| A12 | §5.7 | Date ISO 8601 sans fuseau dans l'exemple. | `toISOString()` (UTC, suffixe `Z`). |

## 3. Remarques techniques

- **Deux « clartés » à ne pas confondre.** `PitchDetector.clarityThreshold` de pitchy est la constante *k* de McLeod (choix du pic, défaut 0,9), pas un filtre. Le filtre « clarté ≥ 0,9 » de §5.2 est appliqué sur la clarté renvoyée. *k* reste un levier contre les erreurs d'octave (§13) : plus bas, il favorise l'octave supérieure ; proche de 1, l'octave inférieure.
- **Budget de latence (H3 < 300 ms).** Fenêtre de 4096 échantillons (93 ms, il faut qu'elle soit majoritairement remplie par la nouvelle note) + médiane sur 5 mesures (≈ 3 mesures à ~17 ms) + stabilité 100 ms ≈ 200 à 250 ms, sans compter la latence d'entrée audio. C'est tenable mais serré. Sur signal synthétique (Chromium, fichier audio simulé), la latence mesurée est de 150 à 200 ms.
- **Latence mesurée sous-estimée.** La mesure part de l'attaque *vue dans le tampon* : la latence d'entrée du matériel et du navigateur (20 à 50 ms, §13) n'est pas comptée, et la résolution est celle de `requestAnimationFrame` (~17 ms). Le préciser dans `SYNTHESE.md`.
- **Taille de fenêtre.** 4096 est dimensionné par la note la plus grave, pas par E5 : McLeod a besoin d'environ deux périodes, soit ~29 ms à 70 Hz. Une fenêtre de 2048 (46 ms) suffirait probablement et réduirait la latence ; c'est le premier paramètre à essayer si H3 échoue.
- **Sous le seuil de silence**, la dernière note reste affichée (grisée) : §5.3 demande de « ne rien mettre à jour ». H4 compte donc les *nouvelles* notes stables, pas l'affichage résiduel.
- **Traitements du navigateur.** L'interface affiche les réglages réellement appliqués par le navigateur (`getSettings()`), car certains appareils ignorent `echoCancellation: false`.
- **Séquencement.** §9 liste l'accordeur et le journal dans les critères d'acceptation, §14 interdit de construire l'accordeur avant une détection stable sur une vraie corde. Ce démarrage livre J1 et J2 ; J3 attend la validation avec une guitare réelle.
