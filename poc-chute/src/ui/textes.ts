// Tous les textes de l'interface du POC : un seul fichier, comme dans l'application.
import type { Traitement } from '../ecoute.svelte';
import type { EvenementPartie, RegleFausseNote } from '../jeu/partie';
import { PENALITE_FAUSSE_NOTE, type Timing } from '../jeu/points';
import type { EvenementProgressif } from '../jeu/progressif/partie-progressive';
import type { CleNumerique } from '../jeu/progressif/reglages';
import type { MethodeGlobale, MethodeNote } from '../jeu/progressif/reussite';
import type { ModeJeu } from '../jeu/stockage';
import type { Position } from '../music/manche';
import { nomAffiche, type Notation } from '../music/notation';
import type { NomNote, NoteDetectee } from '../music/notes';
import type { Question } from '../quiz/tirage';

type Resultat = Extract<EvenementPartie, { type: 'resultat' }>;
type ResultatProgressif = Extract<EvenementProgressif, { type: 'resultat' }>;

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Écart en cents signé : « +3 cents », « −12 cents », « 0 cent » (comme dans l'application). */
function cents(valeur: number): string {
  const arrondi = Math.round(valeur);
  if (arrondi === 0) return '0 cent';
  return `${arrondi > 0 ? '+' : '−'}${Math.abs(arrondi)} cents`;
}

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
  modes: {
    progressif: 'Progressif : des cordes à vide au manche entier',
    classique: 'Classique : 30 notes par partie',
  } as Record<ModeJeu, string>,
  depart: {
    modeJeu: 'Mode de jeu',
    niveau: 'Niveau',
    dureeChute: 'Durée de chute au départ',
    notation: 'Notation des notes',
    fausseNote: 'Fausse note',
    optionsMesure: 'Options de mesure',
    afficherCase: 'Afficher la case sur les notes',
    vitesseFixe: 'Vitesse fixe (sans accélération ni ralentissement)',
    demarrer: 'Démarrer',
    demarrerSimulation: 'Démarrer (simulation)',
    /** Mode progressif : boutons de départ (avec « (simulation) » au clavier). */
    commencer: (simulation: boolean) => `Commencer aux cordes à vide${simulation ? ' (simulation)' : ''}`,
    reprendre: (niveau: number, notes: number, simulation: boolean) =>
      `Reprendre au niveau ${niveau} (${pluriel(notes, 'note')})${simulation ? ' (simulation)' : ''}`,
    recommencer: 'Recommencer aux cordes à vide',
    confirmerRecommencer: (niveau: number) =>
      `Repartir des cordes à vide ? Le niveau ${niveau} atteint sera remplacé à la fin de la partie.`,
    confirmer: 'Recommencer',
    aideSimulation: 'Mode simulation, sans micro : Espace = note juste, F = fausse note, P = pause.',
    accordez: 'Accordez d’abord la guitare avec l’accordeur de l’application.',
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
  reglesFausseNote: {
    penalite: `Coûte ${PENALITE_FAUSSE_NOTE} points (la note reste à jouer)`,
    destruction: 'Détruit la note (on passe à la suivante)',
  } as Record<RegleFausseNote, string>,
  notations: {
    'les-deux': 'Les deux : Mi (E)',
    francaise: 'Française : Mi',
    'anglo-saxonne': 'Anglo-saxonne : E',
  } as Record<Notation, string>,
  partie: {
    score: 'Score',
    serie: 'Série',
    restantes: 'Reste',
    chute: 'Chute',
    arreter: 'Arrêter',
    jouer: 'Jouer la note',
    fausse: 'Fausse note',
    compteARebours: 'Départ dans',
    pause: 'Pause',
    enPause: 'Pause',
    reprendre: 'Reprendre',
    repriseDans: 'Reprise dans',
    microCoupe: 'Micro coupé : l’application est passée en arrière-plan. « Reprendre » le relance (2 s sans jouer).',
  },
  micro: {
    explication:
      'La page écoute votre guitare avec le micro de l’appareil. Le navigateur va demander l’autorisation ; ' +
      'le son n’est ni enregistré ni envoyé. Au démarrage, ne jouez pas pendant 2 s : mesure du bruit ambiant.',
    demarrage: 'Demande d’accès au micro…',
    calibrage: 'Ne jouez pas : mesure du bruit ambiant (2 s)…',
    traitements: (noms: readonly string[]) =>
      `Le navigateur a laissé actif : ${noms.join(', ')}. La détection peut être moins fiable.`,
    nomsTraitements: {
      echoCancellation: 'l’annulation d’écho',
      noiseSuppression: 'la réduction de bruit',
      autoGainControl: 'le gain automatique',
    } as Record<Traitement, string>,
  },
  indicateur: {
    titre: 'Note entendue',
    aucune: '–',
    cents,
    niveauSonore: 'Niveau sonore',
    jouez: 'Jouez la note…',
    nonReconnue: 'Note non reconnue, rejouez',
    ancienneNote: (note: string) => `${note} : la note précédente sonne encore, étouffez la corde.`,
  },
  manche: {
    nom: 'Manche',
    aVide: 'à vide',
    caseCourte: (numeroCase: number) => `c. ${numeroCase}`,
  },
  timings: { parfait: 'Parfait', bien: 'Bien', juste: 'Juste' } as Record<Timing, string>,
  progressif: {
    methodeNote: 'Réussite d’une note',
    methodeGlobale: 'Réussite du niveau',
    methodesNote: {
      score: 'Score d’essai (justesse et rapidité)',
      taux: 'Taux de notes justes',
      temps: 'Temps de réponse',
    } as Record<MethodeNote, string>,
    methodesGlobales: {
      moyenne: 'Moyenne des notes',
      ponderee: 'Moyenne pondérée par la difficulté',
      derniers: 'Derniers essais, toutes notes',
    } as Record<MethodeGlobale, string>,
    reglages: {
      seuilNote: 'Réussite minimale de chaque note',
      seuilGlobal: 'Réussite minimale du niveau',
      dureeChuteMinMs: 'Vitesse max : durée de chute la plus courte',
      vitesseDepart: 'Vitesse max au niveau 1',
      vitesseParNiveau: 'Hausse de la vitesse max par niveau',
      notesAjoutees: 'Notes ajoutées à chaque niveau',
      essaisNote: 'Essais pris en compte pour une note',
      essaisGlobaux: 'Essais pris en compte pour « derniers essais »',
      essaisMinimum: 'Essais minimum de chaque note',
      poidsAlteration: 'Difficulté d’une note altérée, en cases',
      delaiNoteBonMs: 'Réponse rapide jusqu’à (depuis la note précédente)',
      delaiNoteLentMs: 'Réponse lente à partir de (depuis la note précédente)',
      delaiApparitionBonMs: 'Réponse rapide jusqu’à (après apparition)',
      delaiApparitionLentMs: 'Réponse lente à partir de (après apparition)',
      acceleration: 'Accélération par note juste',
      ralentissement: 'Ralentissement par erreur',
      penaliteFausse: 'Pénalité d’une fausse note',
      penalitePerdue: 'Pénalité d’une note perdue ou ratée',
      bonusNiveau: 'Bonus de passage, × numéro du niveau',
    } as Record<CleNumerique, string>,
    avances: 'Réglages avancés',
    defaut: 'Valeurs par défaut',
    points: (n: number) => `${n} points`,
    niveau: 'Niveau',
    reussite: 'Réussite',
    vitesse: 'Vitesse',
    niveauValide: (niveau: number, bonus: number) => `Niveau ${niveau} validé ! +${bonus}`,
    nouvellesNotes: 'Nouvelles notes :',
    mancheComplet: 'Tout le manche est validé !',
    repriseDans: (secondes: number) => `Reprise dans ${secondes} s, à vitesse 0`,
    plafond: (vitesse: string) => `Vitesse max du niveau : ${vitesse}`,
    vitessePleine: (niveau: number | null) =>
      niveau === null ? 'Même vitesse max à tous les niveaux' : `100 % au niveau ${niveau}`,
    perdue: 'Perdue',
    ratee: 'Ratée',
  },
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
    manquees: 'Notes à revoir',
    aucuneManquee: 'Aucune note à revoir.',
    rejouer: 'Rejouer',
    changer: 'Changer de niveau',
    exporter: 'Exporter le journal',
    niveaux: 'Niveau',
    niveauxValeurs: (depart: number, atteint: number) => (depart === atteint ? `${atteint}` : `${depart} → ${atteint}`),
    essais: 'Notes jouées',
    perdues: 'Notes perdues (3 fausses notes)',
    vitesseMax: 'Vitesse la plus haute',
    delaiMedian: 'Temps de réponse médian',
    reussiteNiveau: 'Réussite du niveau',
    notesDuNiveau: 'Notes du niveau',
    colonneNote: 'Note',
    colonneEssais: 'Essais',
    colonneReussite: 'Réussite',
    continuer: (niveau: number) => `Continuer au niveau ${niveau}`,
    reglages: 'Réglages',
  },
};

/** Part de 0 à 1 en pourcentage arrondi : « 65 % ». */
export function pourcent(valeur: number): string {
  return `${Math.round(valeur * 100)} %`;
}

/** Qualité d'une note juste du mode progressif, d'après son score d'essai (affichage seulement). */
function qualite(score: number): Timing {
  if (score >= 0.85) return 'parfait';
  if (score >= 0.65) return 'bien';
  return 'juste';
}

/** Retour d'un essai du mode progressif : « Parfait ! +190 », « Perdue : La (A) · −150 », « Ratée · −150 ». */
export function retourProgressif(resultat: ResultatProgressif, notation: Notation): string {
  const perte = resultat.points < 0 ? ` · −${-resultat.points}` : '';
  if (resultat.resultat === 'juste') return `${TEXTES.timings[qualite(resultat.scoreEssai)]} ! +${resultat.points}`;
  if (resultat.resultat === 'perdue' && resultat.detectee) {
    return `${TEXTES.progressif.perdue} : ${nomAffiche(resultat.detectee.nom, notation)}${perte}`;
  }
  return `${TEXTES.progressif.ratee}${perte}`;
}

/** Position à jouer : « Fa (F) · corde 6, case 1 ». */
export function nomPosition(position: Position, nom: NomNote, notation: Notation): string {
  return `${nomAffiche(nom, notation)} · corde ${position.corde}, case ${position.case}`;
}

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

/** Fausse note en mode « pénalité » : « Fausse note : La (A) · −50 », sans pénalité si le score était à 0. */
export function retourFausse(detectee: NoteDetectee, penalite: number, notation: Notation): string {
  const texte = `${TEXTES.partie.fausse} : ${nomAffiche(detectee.nom, notation)}`;
  return penalite > 0 ? `${texte} · −${penalite}` : texte;
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
