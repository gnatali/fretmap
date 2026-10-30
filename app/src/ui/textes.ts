// Tous les textes de l'interface (spec §13) : un seul fichier pour faciliter une future traduction.
import type { Position } from '../music/manche';
import { nomAffiche, type Notation } from '../music/notation';
import type { NomNote } from '../music/notes';
import type { Question } from '../quiz/tirage';

/** « la corde 6 ou la corde 1 ». */
function listeCordes(cordes: readonly number[]): string {
  return cordes.map((c) => `la corde ${c}`).join(' ou ');
}

/** « à la case 4 », « aux cases 0 et 12 ». */
function listeCases(cases: readonly number[]): string {
  if (cases.length === 1) return `à la case ${cases[0]}`;
  return `aux cases ${cases.slice(0, -1).join(', ')} et ${cases.at(-1)}`;
}

/** Où se trouve une note : « Fa (F) est à la case 1 », « Mi (E) est la corde 6 ou la corde 1, à vide ». */
function emplacement(
  nom: string,
  positions: readonly { corde: number; case: number }[],
  cordeDemandee: boolean,
): string {
  return cordeDemandee
    ? `${nom} est ${listeCases(positions.map((p) => p.case))}`
    : `${nom} est ${listeCordes(positions.map((p) => p.corde))}, à vide`;
}

/** « 1 note », « 9 notes ». */
function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

/** Écart en cents signé : « +3 cents », « −12 cents », « 0 cent ». */
function cents(valeur: number): string {
  const arrondi = Math.round(valeur);
  if (arrondi === 0) return '0 cent';
  return `${arrondi > 0 ? '+' : '−'}${Math.abs(arrondi)} cents`;
}

/** Niveau en dBFS : « −58 dBFS ». */
function dbfs(valeur: number): string {
  const arrondi = Math.round(valeur);
  return `${arrondi < 0 ? '−' : ''}${Math.abs(arrondi)} dBFS`;
}

/** « Corde 5, case 3 », « Corde 6, à vide ». */
function position(corde: number, numeroCase: number): string {
  return numeroCase === 0 ? `Corde ${corde}, à vide` : `Corde ${corde}, case ${numeroCase}`;
}

export const TEXTES = {
  titre: 'fretmap',
  sousTitre: 'Apprendre les notes du manche de guitare',
  lienPoc: 'Essayer la détection de notes (POC)',
  niveauxAtteints: (mode1: number, mode2: number) => `Niveau atteint : ${mode1} en mode 1, ${mode2} en mode 2`,
  entrees: {
    mode1: { titre: 'Mode 1', description: 'Notes qui tombent : touchez la case, sans guitare' },
    mode2: { titre: 'Mode 2', description: 'Jouer la note demandée sur sa guitare' },
    accordeur: { titre: 'Accordeur', description: 'Accorder les six cordes' },
    statistiques: { titre: 'Statistiques', description: 'Réussite case par case' },
    reglages: { titre: 'Réglages', description: 'Tolérance, affichage, progression' },
  },
  arreter: 'Arrêter',
  retour: 'Retour',
  sauvegardeImpossible: 'Progression non enregistrée : le stockage du navigateur est plein ou indisponible.',
  quiz: {
    niveau: 'Niveau',
    nomNiveau: (niveau: number, description: string, verrouille = false) =>
      `${niveau} · ${description}${verrouille ? ' (verrouillé)' : ''}`,
    versNiveau: (suivant: number, taux: number, requises: number, reussites: number, reponses: number) =>
      `Niveau ${suivant} débloqué à ${taux} % de bonnes réponses sur les ${requises} dernières` +
      (reponses ? ` : ${reussites} sur ${reponses} pour l’instant.` : '.'),
    dernierNiveau: 'Dernier niveau : entraînement libre.',
    entrainement: (atteint: number) => `Entraînement : seules les réponses au niveau ${atteint} font progresser.`,
    debloque: (niveau: number, description: string) => `Bravo, niveau ${niveau} débloqué : ${description}.`,
    score: (bonnes: number, questions: number) => `${bonnes} / ${questions}`,
    pourcentage: (p: number | null) => (p === null ? '–' : `${p} %`),
    serie: (serie: number, meilleure: number) => `Série ${serie} (meilleure : ${meilleure})`,
  },
  mode1: {
    titre: 'Mode 1',
    regles:
      'Les notes tombent le long de leur corde : touchez la case qui donne la note avant qu’elle n’arrive en bas. ' +
      'Une corde à vide ne donne que le nom : touchez la corde à vide. Chaque case fausse coûte 50 points ; ' +
      'à la 3e, la note est perdue. La vitesse monte avec la réussite ; quand chaque note est assez réussie, ' +
      'le niveau passe et 3 notes s’ajoutent.',
    commencer: 'Commencer aux cordes à vide',
    reprendre: (niveau: number, notes: number) => `Reprendre au niveau ${niveau} (${pluriel(notes, 'note')})`,
    recommencer: 'Recommencer aux cordes à vide',
    confirmerRecommencer: (niveau: number) =>
      `Repartir des cordes à vide ? Le niveau ${niveau} atteint est remplacé ; les records et les statistiques sont gardés.`,
    confirmer: 'Recommencer',
    annuler: 'Annuler',
    records: 'Records',
    recordValeurs: (score: number, niveau: number) => `${score} points · niveau ${niveau}`,
    aucunRecord: 'Pas encore de partie.',
    journal: 'Journal des parties',
    exporter: (parties: number) => `Exporter le journal (${pluriel(parties, 'partie')})`,
    journalNonEnregistre: 'Partie non enregistrée dans le journal : le stockage du navigateur est plein.',
    retour: 'Accueil',
  },
  partie: {
    score: 'Score',
    niveau: 'Niveau',
    reussite: 'Réussite',
    vitesse: 'Vitesse',
    arreter: 'Arrêter',
    pause: 'Pause',
    enPause: 'Pause',
    reprendre: 'Reprendre',
    compteARebours: 'Départ dans',
    repriseDans: 'Reprise dans',
    niveauValide: (niveau: number, bonus: number) => `Niveau ${niveau} validé ! +${bonus}`,
    nouvellesNotes: 'Nouvelles notes :',
    mancheComplet: 'Tout le manche est validé !',
    repriseNiveau: (secondes: number) => `Reprise dans ${secondes} s, à vitesse 0`,
    plafond: (vitesse: string) => `Vitesse max du niveau : ${vitesse}`,
    qualites: { parfait: 'Parfait', bien: 'Bien', juste: 'Juste' },
    fausse: 'Case fausse',
    perdue: 'Perdue',
    ratee: 'Ratée',
  },
  fin: {
    titre: 'Fin de partie',
    nouveauRecord: 'Nouveau record !',
    score: 'Score',
    niveaux: 'Niveau',
    niveauxValeurs: (depart: number, atteint: number) => (depart === atteint ? `${atteint}` : `${depart} → ${atteint}`),
    essais: 'Notes jouées',
    justes: 'Notes justes',
    fausses: 'Cases fausses',
    perdues: 'Notes perdues (3 cases fausses)',
    ratees: 'Notes ratées',
    meilleureSerie: 'Meilleure série',
    vitesseMax: 'Vitesse la plus haute',
    delaiMedian: 'Temps de réponse médian',
    reussiteNiveau: 'Réussite du niveau',
    notesDuNiveau: 'Notes du niveau',
    colonneNote: 'Note',
    colonneEssais: 'Essais',
    colonneReussite: 'Réussite',
    continuer: (niveau: number) => `Continuer au niveau ${niveau}`,
    exporter: 'Exporter le journal',
  },
  mode2: {
    titre: 'Mode 2',
    afficherCase: 'Afficher la case',
    question: 'Jouez',
    surLaCorde: 'sur la corde',
    /** Niveau 1 : la corde n'est pas donnée. */
    aVide: 'à vide',
    caseDemandee: (numeroCase: number) => (numeroCase === 0 ? 'à vide' : `case ${numeroCase}`),
    consigne: 'Étouffez la corde précédente avant de jouer.',
    juste: (note: string, ecart: number) => `Juste : ${note}, ${cents(ecart)}`,
    faux: (note: string) => `Faux : vous avez joué ${note}`,
    ancienneNote: (note: string) => `${note} : la note précédente sonne encore. Étouffez la corde, puis rejouez.`,
    nonReconnue: 'Note non reconnue, rejouez',
    jouez: 'Jouez la note…',
    rappel: (
      nom: string,
      positions: readonly { corde: number; case: number }[],
      cordeDemandee: boolean,
      corde: number,
    ) => `Rappel : ${cordeDemandee ? `sur la corde ${corde}, ` : ''}${emplacement(nom, positions, cordeDemandee)}`,
    enDirect: 'Note entendue',
    aucuneNote: '–',
    frequence: (hz: number) => `${hz.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Hz`,
    cents,
    niveauSonore: 'Niveau sonore',
    historique: 'Dernières réponses',
    reponse: (juste: boolean, jouee: string, demandee: string) =>
      juste ? `${jouee} (juste)` : `${jouee} au lieu de ${demandee}`,
  },
  accordeur: {
    titre: 'Accordeur',
    accordage: 'Accordage',
    nomAccordage: (nom: string, notes: string) => `${nom} : ${notes}`,
    mode: 'Mode',
    modes: { cordes: 'Cordes', chromatique: 'Chromatique' },
    choixCorde: 'Corde à accorder',
    auto: 'Auto',
    autoDetail: 'la plus proche',
    cible: (hz: number) =>
      `cible ${hz.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Hz`,
    cordeProche: 'corde la plus proche',
    noteProche: 'note la plus proche',
    aiguille: 'Écart à la note visée',
    jouez: 'Jouez une corde',
    attente: '…',
    juste: (ecart: number) => `Juste ✓ (${cents(ecart)})`,
    ecart: (ecart: number, horsEchelle: boolean) =>
      `${cents(ecart)} · ${horsEchelle ? 'beaucoup ' : ''}trop ${ecart < 0 ? 'bas' : 'haut'}`,
    centre: (ecart: number) => cents(ecart),
    a4: (la4: string) => `Référence ${la4} (Hz)`,
    bip: 'Bip quand la corde est juste',
  },
  reglages: {
    titre: 'Réglages',
    affichage: 'Affichage',
    notation: 'Notation des notes',
    mode2: 'Mode 2',
    tolerance: 'Justesse demandée',
    tolerances: { 50: 'Demi-ton (par défaut)', 30: '±30 cents', 20: '±20 cents' } as Record<number, string>,
    octaveStricte: 'Octave stricte (Mi2 et Mi3 ne sont plus équivalents)',
    afficherCaseMode2: 'Afficher la case dans la question',
    microEtSon: 'Micro et son',
    a4: (la4: string) => `Référence ${la4}, de 430 à 450 Hz`,
    seuil: (db: number) => `Seuil de silence : ${dbfs(db)} (bruit ambiant + 10 dB)`,
    mesurer: 'Mesurer le bruit ambiant',
    mesureEnCours: 'Ne jouez pas : mesure du bruit ambiant (2 s)…',
    mesureFaite: (db: number) => `Seuil fixé à ${dbfs(db)}.`,
    retourSonore: 'Retour sonore : bip quand la note ou la corde est juste',
    progression: 'Progression',
    conseilExport: 'Le navigateur peut effacer les données du site : exportez la progression de temps en temps.',
    exporter: 'Exporter la progression',
    importer: 'Importer une progression',
    importInvalide: 'Ce fichier n’est pas une progression fretmap exportée.',
    confirmerImport: 'Remplacer la progression actuelle par celle du fichier ?',
    remplacer: 'Remplacer',
    importFait: 'Progression importée.',
    reinitialiser: 'Réinitialiser la progression',
    confirmerReinitialisation: 'Effacer le niveau, les scores et les statistiques ? Les réglages sont gardés.',
    effacer: 'Effacer',
    reinitialisationFaite: 'Progression réinitialisée.',
    annuler: 'Annuler',
  },
  micro: {
    explication:
      'La page écoute votre guitare avec le micro de l’appareil. Le navigateur va demander l’autorisation ; ' +
      'le son n’est ni enregistré ni envoyé. Au démarrage, ne jouez pas pendant 2 s : mesure du bruit ambiant.',
    demarrer: 'Démarrer le micro',
    couper: 'Couper le micro',
    demarrage: 'Demande d’accès au micro…',
    calibrage: 'Ne jouez pas : mesure du bruit ambiant (2 s)…',
    interrompu: 'Micro coupé : l’application est passée en arrière-plan. Démarrez le micro pour reprendre.',
    traitements: (noms: readonly string[]) =>
      `Le navigateur a laissé actif : ${noms.join(', ')}. La détection peut être moins fiable.`,
    nomsTraitements: {
      echoCancellation: 'l’annulation d’écho',
      noiseSuppression: 'la réduction de bruit',
      autoGainControl: 'le gain automatique',
    },
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
  notations: {
    'les-deux': 'Les deux : Mi (E)',
    francaise: 'Française : Mi',
    'anglo-saxonne': 'Anglo-saxonne : E',
  } as Record<Notation, string>,
  manche: {
    nom: 'Manche',
    corde: (corde: number) => `Corde ${corde}`,
    position,
    marque: { juste: 'bonne réponse', faux: 'mauvaise réponse', attendue: 'bonne case' },
    aVide: 'À vide',
  },
  statistiques: {
    titre: 'Statistiques',
    mode: { 1: 'Mode 1 : réussite par position', 2: 'Mode 2 : réussite par position demandée' },
    aucune: (mode: number) => `Aucune réponse enregistrée pour l’instant : jouez au mode ${mode}.`,
    niveauAtteint: (niveau: number, description: string) => `Niveau atteint : ${niveau} (${description}).`,
    jeu: (niveau: number, notes: number) => `Jeu au niveau ${niveau} (${pluriel(notes, 'note')}).`,
    record: (score: number, niveau: number) => `Record : ${score} points, niveau ${niveau}.`,
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

/** Part de 0 à 1 en pourcentage arrondi : « 65 % ». */
export function pourcent(valeur: number): string {
  return `${Math.round(valeur * 100)} %`;
}

/** Durée en secondes, une décimale : « 1,6 s ». */
export function duree(ms: number): string {
  const secondes = (ms / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${secondes} s`;
}

/** Position : « Fa (F) · corde 6, case 1 », « Mi (E) · corde 6, à vide ». */
export function nomPosition(p: Position, nom: NomNote, notation: Notation): string {
  return `${nomAffiche(nom, notation)} · ${position(p.corde, p.case).toLowerCase()}`;
}

/** Note à toucher : « Sol (G) · corde 3 » ; corde à vide, « Mi (E) · à vide ». */
export function consigne(question: Question, notation: Notation): string {
  const nom = nomAffiche(question.nom, notation);
  return question.cordeDemandee ? `${nom} · corde ${question.position.corde}` : `${nom} · à vide`;
}

/** Qualité d'une note juste, d'après son score d'essai (affichage seulement, comme le POC). */
function qualite(score: number): keyof typeof TEXTES.partie.qualites {
  if (score >= 0.85) return 'parfait';
  if (score >= 0.65) return 'bien';
  return 'juste';
}

/** Retour d'un essai : « Parfait ! +190 », « Perdue : Fa (F) est à la case 1 · −150 », « Ratée : … · −150 ». */
export function retourEssai(
  resultat: { resultat: 'juste' | 'perdue' | 'ratee'; points: number; scoreEssai: number; question: Question },
  notation: Notation,
): string {
  if (resultat.resultat === 'juste')
    return `${TEXTES.partie.qualites[qualite(resultat.scoreEssai)]} ! +${resultat.points}`;
  const { nom, positionsCorrectes, cordeDemandee } = resultat.question;
  const texte = `${resultat.resultat === 'perdue' ? TEXTES.partie.perdue : TEXTES.partie.ratee} : ${emplacement(
    nomAffiche(nom, notation),
    positionsCorrectes,
    cordeDemandee,
  )}`;
  return resultat.points < 0 ? `${texte} · −${-resultat.points}` : texte;
}

/** Case fausse : « Case fausse · −50 », sans pénalité si le score était à 0. */
export function retourFausse(penalite: number): string {
  return penalite > 0 ? `${TEXTES.partie.fausse} · −${penalite}` : TEXTES.partie.fausse;
}
