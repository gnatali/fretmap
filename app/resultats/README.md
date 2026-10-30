# Résultats de l'application

Exports et journaux envoyés par l'utilisateur, et leur analyse, du plus récent au plus ancien.

## Export de la progression du 31/10/2026 (`fretmap-progression-2026-10-31.json`)

**Session** : quiz du mode 1 (version 2.7 de la spec), le 30/10 de 23 h 13 à 23 h 19 environ (dates des dernières réponses), plus quelques réponses au mode 2 le 27/10. Niveau 4 atteint au mode 1.

**Mode 1** : 104 réponses, 93 justes (89 %), sur 29 positions des cases 0 à 5.

| Case       | Positions | Réponses | Réussite | Temps moyen |
| ---------- | --------- | -------- | -------- | ----------- |
| 0 (à vide) | 6         | 54       | 94 %     | 3,0 s       |
| 1          | 3         | 5        | 100 %    | 2,3 s       |
| 2          | 5         | 9        | 78 %     | 3,5 s       |
| 3          | 6         | 14       | 100 %    | 3,7 s       |
| 4          | 4         | 10       | 70 %     | 8,2 s       |
| 5          | 5         | 12       | 75 %     | 2,7 s       |

- **Trop peu de répétition** : la moitié des réponses porte sur les 6 cordes à vide. Les 50 autres se répartissent sur 23 positions, soit environ 2 essais par position ; 13 positions n'ont qu'1 ou 2 essais. Le niveau 2 ouvre d'un coup 17 positions, le niveau 3 en ouvre 30, et le passage (80 % sur les 20 ou 30 dernières réponses) ne demande pas que chaque note soit sue.
- **Points faibles** : la corde 4 (Ré : 6,6 s en moyenne à vide, 11 s en case 3, une erreur en case 4) et la case 4 (70 %, 8,2 s ; Si, corde 3, case 4 : 5 sur 7, 9,5 s). Temps médian par position : 2,6 s.
- **Peu d'enjeu** : 1 s d'attente entre les questions, un score de session seulement, pas de record.

### Décisions (31/10/2026, spec version 3.0, `docs/revue-specs-app.md` N15 à N20)

- Le mode 1 devient le jeu « Notes qui tombent » au toucher, repris du mode progressif du POC : 3 notes ajoutées par niveau, 3 essais minimum par note et poids de tirage maximal avant, 60 % par note et 80 % pour le niveau, vitesse plafonnée par niveau, points, série, bonus. Le 2e journal du POC (30/10, 18 h 39) a donné 253 essais en 8 min, du niveau 1 au niveau 6, avec 1 % de notes ratées.
- Réglages : ceux du POC par défaut. Les seuils de rapidité (rapide à 1,5 s, lent à 6 s depuis la note précédente) vont avec le temps médian du quiz (2,6 s) et le délai médian du POC à la guitare (1,4 à 1,7 s).
- Départ aux cordes à vide (un niveau connu passe vite : 34 s pour le niveau 1 dans le POC) ; statistiques gardées.
- **Prochaine étape** : jouer quelques parties, puis exporter le journal (« Exporter le journal », écran du mode 1, `journal-mode1-*.json`) et l'ajouter ici pour régler la vitesse, les seuils et le nombre de notes ajoutées.
