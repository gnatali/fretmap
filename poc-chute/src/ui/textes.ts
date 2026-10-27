// Tous les textes de l'interface du POC : un seul fichier, comme dans l'application.
import type { EvenementPartie } from '../jeu/partie';
import type { Timing } from '../jeu/points';
import type { Position } from '../music/manche';
import { nomAffiche, type Notation } from '../music/notation';
import type { NomNote } from '../music/notes';
import type { Question } from '../quiz/tirage';

type Resultat = Extract<EvenementPartie, { type: 'resultat' }>;

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Liste « a, b et c ». */
function liste(elements: readonly string[]): string {
  if (elements.length <= 1) return elements.join('');
  return `${elements.slice(0, -1).join(', ')} et ${elements.at(-1)}`;
}

export const TEXTES = {
  titre: 'Notes qui tombent',
  sousTitre: 'Jouez à la guitare les notes qui descendent le long des cordes, avant qu’elles touchent le bas.',
  lienSpec: 'Lire la spécification du POC',
  lienApplication: 'Retour à l’application',
  depart: {
    niveau: 'Niveau',
    dureeChute: 'Durée de chute au départ',
    notation: 'Notation des notes',
    optionsMesure: 'Options de mesure',
    afficherCase: 'Afficher la case sur les notes',
    vitesseFixe: 'Vitesse fixe (sans accélération ni ralentissement)',
    demarrer: 'Démarrer',
    demarrerSimulation: 'Démarrer (simulation)',
    aideSimulation: 'Mode simulation, sans micro : Espace = note juste, F = fausse note.',
    microBientot: 'Le jeu au micro arrive à la prochaine étape du POC. En attendant, on peut jouer au clavier.',
    lienSimulation: 'Jouer au clavier (simulation)',
    journal: 'Journal des parties',
    exporter: (parties: number) => `Exporter le journal (${pluriel(parties, 'partie')})`,
    vider: 'Vider le journal',
    confirmerVider: 'Effacer les parties du journal ? Les réglages et les statistiques sont gardés.',
    effacer: 'Effacer',
    annuler: 'Annuler',
    journalVide: 'Journal vidé.',
  },
  niveaux: {
    1: 'Cordes à vide',
    2: 'Cases 0 à 5, notes naturelles',
    3: 'Cases 0 à 5, toutes les notes',
    4: 'Cases 0 à 7, notes naturelles',
    5: 'Cases 0 à 7, toutes les notes',
    6: 'Cases 0 à 12, notes naturelles',
    7: 'Cases 0 à 12, toutes les notes',
  } as Record<number, string>,
  nomNiveau: (niveau: number, description: string) => `${niveau} · ${description}`,
  notations: {
    'les-deux': 'Les deux : Mi (E)',
    francaise: 'Française : Mi',
    'anglo-saxonne': 'Anglo-saxonne : E',
  } as Record<Notation, string>,
  partie: {
    score: 'Score',
    serie: 'Série',
    restantes: 'Restantes',
    chute: 'Chute',
    arreter: 'Arrêter',
    jouer: 'Jouer la note',
    fausse: 'Fausse note',
    compteARebours: 'Départ dans',
  },
  manche: {
    nom: 'Manche',
    aVide: 'à vide',
    caseCourte: (numeroCase: number) => `c. ${numeroCase}`,
  },
  timings: { parfait: 'Parfait', bien: 'Bien', juste: 'Juste' } as Record<Timing, string>,
  fin: {
    titre: 'Fin de partie',
    arretee: 'Partie arrêtée avant la fin.',
    score: 'Score',
    justes: 'Notes justes',
    fausses: 'Fausses notes',
    ratees: 'Notes ratées',
    meilleureSerie: 'Meilleure série',
    chute: 'Durée de chute',
    chuteValeurs: (depart: string, fin: string, min: string) =>
      `${depart} au départ, ${fin} à la fin, ${min} au plus court`,
    tempsReponse: 'Temps de réponse médian',
    manquees: 'Notes manquées',
    aucuneManquee: 'Aucune note manquée.',
    rejouer: 'Rejouer',
    changer: 'Changer de niveau',
    exporter: 'Exporter le journal',
  },
};

/** Durée en secondes, une décimale : « 6,0 s ». */
export function duree(ms: number): string {
  const secondes = (ms / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${secondes} s`;
}

/** Note à jouer : « À jouer : Sol (G) · corde 3 », avec « · case 5 » si demandé ; au niveau 1, « corde à vide ». */
export function consigne(question: Question, notation: Notation, afficherCase: boolean): string {
  const nom = nomAffiche(question.nom, notation);
  if (!question.cordeDemandee) return `À jouer : ${nom} · corde ${TEXTES.manche.aVide}`;
  const { corde, case: numeroCase } = question.position;
  return `À jouer : ${nom} · corde ${corde}${afficherCase ? ` · case ${numeroCase}` : ''}`;
}

/** Retour d'un résultat : « Parfait ! +125 », « Fausse note : La (A) », « Ratée ». */
export function retour(resultat: Resultat, notation: Notation): string {
  if (resultat.resultat === 'juste') return `${TEXTES.timings[resultat.timing ?? 'juste']} ! +${resultat.points}`;
  if (resultat.resultat === 'fausse' && resultat.detectee) {
    return `${TEXTES.partie.fausse} : ${nomAffiche(resultat.detectee.nom, notation)}`;
  }
  return 'Ratée';
}

/**
 * Où se trouve une note : « Sol (G) · corde 3 : case 0 », « Mi (E) · corde 6 : cases 0 et 12 » ;
 * sans corde demandée (niveau 1), « Mi (E) : corde 6 ou 1, à vide ».
 */
export function emplacement(
  nom: NomNote,
  positions: readonly Position[],
  cordeDemandee: boolean,
  notation: Notation,
): string {
  const note = nomAffiche(nom, notation);
  if (!cordeDemandee) {
    return `${note} : corde ${positions.map((p) => p.corde).join(' ou ')}, ${TEXTES.manche.aVide}`;
  }
  const cases = positions.map((p) => String(p.case));
  return `${note} · corde ${positions[0]!.corde} : ${cases.length > 1 ? 'cases' : 'case'} ${liste(cases)}`;
}
