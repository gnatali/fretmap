---
paths:
  - "poc-guitare/src/**/*.ts"
  - "poc-guitare/tests/**/*.ts"
---
# Code du POC

- `src/music/`, `src/audio/` et `src/journal/` ne touchent pas au DOM : ils restent testables avec Vitest. Le DOM est dans `src/ui/`.
- Les constantes réglables sont nommées en majuscules et commentées avec leur valeur initiale et leur origine (§ de la spec ou mesure).
- pitchy : `clarityThreshold` est la constante k de McLeod (choix du pic de la NSDF), pas un filtre. Le filtre de clarté (0,9) est dans `rejetMesure`. `clarityThreshold = 0` lève une erreur.
- Tests : `tests/*.test.ts` ; utiliser `etat()` de `tests/outils.ts` pour construire un `EtatDetection`. Lancer `npm test` et `npm run build` avant chaque push.
