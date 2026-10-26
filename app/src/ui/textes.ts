// Tous les textes de l'interface (spec §13) : un seul fichier pour faciliter une future traduction.

export const TEXTES = {
  titre: 'fretmap',
  sousTitre: 'Apprendre les notes du manche de guitare',
  bientot: 'Bientôt disponible',
  lienPoc: 'Essayer la détection de notes (POC)',
  entrees: {
    mode1: { titre: 'Mode 1', description: 'Trouver la note sur le manche, sans guitare' },
    mode2: { titre: 'Mode 2', description: 'Jouer la note demandée sur sa guitare' },
    accordeur: { titre: 'Accordeur', description: 'Accorder les six cordes' },
    statistiques: { titre: 'Statistiques', description: 'Réussite case par case' },
    reglages: { titre: 'Réglages', description: 'Tolérance, affichage, progression' },
  },
} as const;
