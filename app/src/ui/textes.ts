// Tous les textes de l'interface (spec §13) : un seul fichier pour faciliter une future traduction.

/** « à la case 4 », « aux cases 0 et 12 ». */
function listeCases(cases: readonly number[]): string {
  if (cases.length === 1) return `à la case ${cases[0]}`;
  return `aux cases ${cases.slice(0, -1).join(', ')} et ${cases.at(-1)}`;
}

/** « Corde 5, case 3 », « Corde 6, à vide ». */
function position(corde: number, numeroCase: number): string {
  return numeroCase === 0 ? `Corde ${corde}, à vide` : `Corde ${corde}, case ${numeroCase}`;
}

export const TEXTES = {
  titre: 'fretmap',
  sousTitre: 'Apprendre les notes du manche de guitare',
  bientot: 'Bientôt disponible',
  lienPoc: 'Essayer la détection de notes (POC)',
  niveauActuel: (niveau: number) => `Niveau actuel : ${niveau}`,
  entrees: {
    mode1: { titre: 'Mode 1', description: 'Trouver la note sur le manche, sans guitare' },
    mode2: { titre: 'Mode 2', description: 'Jouer la note demandée sur sa guitare' },
    accordeur: { titre: 'Accordeur', description: 'Accorder les six cordes' },
    statistiques: { titre: 'Statistiques', description: 'Réussite case par case' },
    reglages: { titre: 'Réglages', description: 'Tolérance, affichage, progression' },
  },
  arreter: 'Arrêter',
  retour: 'Retour',
  sauvegardeImpossible: 'Progression non enregistrée : le stockage du navigateur est plein ou indisponible.',
  mode1: {
    titre: 'Mode 1',
    niveau: 'Niveau',
    nomNiveau: (niveau: number, description: string) => `${niveau} · ${description}`,
    afficherNotes: 'Afficher les notes',
    question: 'Trouvez',
    surLaCorde: 'sur la corde',
    juste: 'Juste',
    faux: (nom: string, cases: readonly number[]) => `Faux : ${nom} est ${listeCases(cases)}`,
    score: (bonnes: number, questions: number) => `${bonnes} / ${questions}`,
    pourcentage: (p: number | null) => (p === null ? '–' : `${p} %`),
    serie: (serie: number, meilleure: number) => `Série ${serie} (meilleure : ${meilleure})`,
  },
  niveaux: {
    1: 'Cordes à vide',
    2: 'Cases 0 à 5, notes naturelles',
    3: 'Cases 0 à 5, toutes les notes',
    4: 'Cases 0 à 7',
    5: 'Manche complet (0 à 12)',
  } as Record<number, string>,
  manche: {
    nom: 'Manche',
    corde: (corde: number) => `Corde ${corde}`,
    position,
    marque: { juste: 'bonne réponse', faux: 'mauvaise réponse', attendue: 'bonne case' },
    aVide: 'À vide',
  },
  statistiques: {
    titre: 'Statistiques',
    mode1: 'Mode 1 : réussite par position',
    aucune: 'Aucune réponse enregistrée pour l’instant : jouez au mode 1.',
    tentatives: (n: number) => `${n} réponse${n > 1 ? 's' : ''}`,
    reussite: (p: number) => `${p} % de réussite`,
    tempsMoyen: (ms: number) => `temps moyen ${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`,
    cellule: (corde: number, numeroCase: number, taux: number | null, tentatives: number) =>
      `${position(corde, numeroCase)} : ${
        taux === null ? 'pas encore jouée' : `${taux} % sur ${tentatives} réponse${tentatives > 1 ? 's' : ''}`
      }`,
    legende: 'Rouge : moins de 50 %. Orange : moins de 80 %. Vert : 80 % ou plus. Gris : pas encore jouée.',
  },
} as const;
