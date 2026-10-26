// Détection de fréquence (pitchy, algorithme McLeod), filtrage, lissage et stabilité. Sans DOM.
import { PitchDetector } from 'pitchy';
import { A4_DEFAUT_HZ, ecartCents, frequenceVersNote, type NoteDetectee } from '../music/notes';
import { DetecteurAttaque, SEUIL_SILENCE_DBFS_DEFAUT, rms, rmsVersDbfs } from './niveau';

/** Fenêtre d'analyse, en échantillons. Valeur initiale 4096 (≈ 93 ms à 44,1 kHz, ≈ 85 ms à 48 kHz). */
export const TAILLE_FENETRE = 4096;
/** Clarté minimale renvoyée par pitchy pour accepter une mesure, sans unité (0 à 1). Valeur initiale 0,9. */
export const CLARTE_MIN_DEFAUT = 0.9;
/** Plage de fréquences acceptée, en Hz. Valeurs initiales 70 Hz et 1400 Hz. */
export const FREQ_MIN_HZ = 70;
export const FREQ_MAX_HZ = 1400;
/** Nombre de mesures valides dans la fenêtre de lissage. Valeur initiale 5 (la spec autorise 3 à 5). */
export const TAILLE_LISSAGE = 5;
/** Durée pendant laquelle la note doit rester sur le même demi-ton pour être « détectée », en ms. Valeur initiale 100 ms. */
export const DUREE_STABILITE_MS = 100;
/**
 * Tolérance d'octave : écart maximal autour de l'octave supérieure ou inférieure de la note jouée pour qu'une mesure
 * soit ramenée à cette note, en cents. Valeur initiale 50 cents (un quart de ton de part et d'autre).
 */
export const TOLERANCE_OCTAVE_CENTS = 50;

export type ModeLissage = 'mediane' | 'moyenne';

export function moyenne(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return Number.NaN;
  return valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
}

export function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return Number.NaN;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 1 ? tri[milieu]! : (tri[milieu - 1]! + tri[milieu]!) / 2;
}

/** Fenêtre glissante des dernières mesures valides, résumée par la moyenne ou la médiane. */
export class FenetreGlissante {
  private valeurs: number[] = [];

  constructor(
    readonly taille: number = TAILLE_LISSAGE,
    public mode: ModeLissage = 'mediane',
  ) {
    if (!Number.isInteger(taille) || taille < 1) throw new Error('La taille de la fenêtre doit être un entier ≥ 1');
  }

  ajouter(valeur: number): void {
    this.valeurs.push(valeur);
    if (this.valeurs.length > this.taille) this.valeurs.shift();
  }

  /** Valeur lissée, ou null si la fenêtre est vide. Avec moins de valeurs que la taille, utilise celles disponibles. */
  valeur(): number | null {
    if (this.valeurs.length === 0) return null;
    return this.mode === 'mediane' ? mediane(this.valeurs) : moyenne(this.valeurs);
  }

  get nombre(): number {
    return this.valeurs.length;
  }

  vider(): void {
    this.valeurs = [];
  }
}

/**
 * Suit le demi-ton détecté et signale quand il est resté identique pendant `dureeMs` consécutives.
 * Le temps est fourni par l'appelant pour rester testable.
 */
export class SuiviStabilite {
  private candidat: number | null = null;
  private depuis = 0;
  private stableCourant: number | null = null;

  constructor(readonly dureeMs: number = DUREE_STABILITE_MS) {}

  /**
   * @returns `stable` si le demi-ton est stable à l'instant `tMs`,
   * et `nouvelle` si c'est le premier instant où ce demi-ton devient stable.
   */
  traiter(midi: number, tMs: number): { stable: boolean; nouvelle: boolean } {
    if (midi !== this.candidat) {
      this.candidat = midi;
      this.depuis = tMs;
    }
    const stable = tMs - this.depuis >= this.dureeMs;
    const nouvelle = stable && this.stableCourant !== midi;
    if (stable) this.stableCourant = midi;
    return { stable, nouvelle };
  }

  reinitialiser(): void {
    this.candidat = null;
    this.stableCourant = null;
  }
}

export interface MesureBrute {
  frequence: number;
  clarte: number;
}

export type RaisonRejet = 'silence' | 'clarte' | 'plage';

export interface ReglagesDetection {
  a4: number;
  seuilSilenceDbfs: number;
  clarteMin: number;
  modeLissage: ModeLissage;
  /**
   * Tolérance d'octave (§13) : tant qu'aucune nouvelle attaque n'a lieu, une mesure à l'octave supérieure ou inférieure
   * de la note stable est ramenée à cette note. Évite les sauts d'octave pendant que la corde résonne.
   */
  toleranceOctave: boolean;
}

export interface EtatDetection {
  tMs: number;
  niveauDbfs: number;
  silence: boolean;
  attaque: boolean;
  /** Sortie brute de pitchy (null en cas de silence, l'analyse n'est alors pas faite). */
  brute: MesureBrute | null;
  rejet: RaisonRejet | null;
  /** Note correspondant à la fréquence lissée, avant le critère de stabilité. */
  lissee: NoteDetectee | null;
  /** Note stable à cet instant, ou null. */
  stable: NoteDetectee | null;
  /** Mesure ramenée à l'octave de la note stable par la tolérance d'octave. */
  octaveRepliee: boolean;
  /** Vrai au premier instant où une note devient stable. */
  nouvelleNoteStable: boolean;
  /**
   * Avec nouvelleNoteStable : vrai si la note suit une attaque (note jouée), faux si elle change
   * pendant que la corde résonne, sans nouvelle attaque.
   */
  apresAttaque: boolean;
  /** Délai entre la dernière attaque et cette nouvelle note stable, en ms (null sinon). */
  latenceMs: number | null;
}

/**
 * Ramène une fréquence à la note de référence si elle est à une octave au-dessus ou au-dessous (± tolérance).
 * @returns la fréquence corrigée, ou la fréquence d'origine si elle n'est pas à l'octave.
 */
export function replierOctave(frequence: number, reference: number, toleranceCents = TOLERANCE_OCTAVE_CENTS): number {
  for (const facteur of [2, 0.5]) {
    if (Math.abs(ecartCents(frequence, reference * facteur)) <= toleranceCents) return frequence / facteur;
  }
  return frequence;
}

/** Applique les filtres de clarté et de plage à une mesure brute. */
export function rejetMesure(mesure: MesureBrute, clarteMin: number): RaisonRejet | null {
  if (!(mesure.clarte >= clarteMin)) return 'clarte';
  if (!(mesure.frequence >= FREQ_MIN_HZ && mesure.frequence <= FREQ_MAX_HZ)) return 'plage';
  return null;
}

/**
 * Chaîne complète appliquée à chaque tampon : niveau → attaque → pitchy → filtres → lissage → stabilité.
 * C'est l'interface derrière laquelle un autre algorithme (autocorrélation maison, YIN) pourra être branché.
 */
export class ChaineDetection {
  readonly reglages: ReglagesDetection;
  private readonly detecteur: PitchDetector<Float32Array>;
  private readonly lissage: FenetreGlissante;
  private readonly stabilite = new SuiviStabilite();
  private readonly attaques = new DetecteurAttaque();
  private attaqueEnAttente: number | null = null;
  /** Fréquence de la note stable depuis la dernière attaque, pour la tolérance d'octave (null sans note). */
  private frequenceReference: number | null = null;

  constructor(
    readonly tailleFenetre: number = TAILLE_FENETRE,
    reglages: Partial<ReglagesDetection> = {},
  ) {
    this.reglages = {
      a4: A4_DEFAUT_HZ,
      seuilSilenceDbfs: SEUIL_SILENCE_DBFS_DEFAUT,
      clarteMin: CLARTE_MIN_DEFAUT,
      modeLissage: 'mediane',
      toleranceOctave: true,
      ...reglages,
    };
    this.detecteur = PitchDetector.forFloat32Array(tailleFenetre);
    // Attention : `clarityThreshold` de pitchy est la constante k de McLeod (choix du pic de la NSDF,
    // défaut 0,9), pas un filtre sur la clarté renvoyée. On la laisse à sa valeur par défaut ;
    // le filtre « clarté ≥ 0,9 » de la spécification est appliqué par rejetMesure().
    this.lissage = new FenetreGlissante(TAILLE_LISSAGE, this.reglages.modeLissage);
  }

  traiter(tampon: Float32Array, sampleRate: number, tMs: number): EtatDetection {
    const { a4, seuilSilenceDbfs, clarteMin } = this.reglages;
    this.lissage.mode = this.reglages.modeLissage;
    const niveauDbfs = rmsVersDbfs(rms(tampon));
    const attaque = this.attaques.traiter(niveauDbfs, seuilSilenceDbfs, tMs);
    const etat: EtatDetection = {
      tMs,
      niveauDbfs,
      silence: niveauDbfs < seuilSilenceDbfs,
      attaque,
      brute: null,
      rejet: null,
      lissee: null,
      stable: null,
      octaveRepliee: false,
      nouvelleNoteStable: false,
      apresAttaque: false,
      latenceMs: null,
    };

    if (attaque) {
      // Nouvelle attaque : on ne mélange pas les mesures de la note précédente.
      this.attaqueEnAttente = tMs;
      this.frequenceReference = null;
      this.lissage.vider();
      this.stabilite.reinitialiser();
    }

    if (etat.silence) {
      etat.rejet = 'silence';
      this.lissage.vider();
      this.stabilite.reinitialiser();
      this.attaqueEnAttente = null;
      this.frequenceReference = null;
      return etat;
    }

    const [frequence, clarte] = this.detecteur.findPitch(tampon, sampleRate);
    etat.brute = { frequence, clarte };
    etat.rejet = rejetMesure(etat.brute, clarteMin);
    if (etat.rejet) return etat;

    let mesure = frequence;
    if (this.reglages.toleranceOctave && this.frequenceReference !== null) {
      mesure = replierOctave(frequence, this.frequenceReference);
      etat.octaveRepliee = mesure !== frequence;
    }
    this.lissage.ajouter(mesure);
    etat.lissee = frequenceVersNote(this.lissage.valeur()!, a4);
    if (!etat.lissee) return etat;

    const { stable, nouvelle } = this.stabilite.traiter(etat.lissee.midi, tMs);
    if (stable) etat.stable = etat.lissee;
    if (nouvelle) {
      etat.nouvelleNoteStable = true;
      etat.apresAttaque = this.attaqueEnAttente !== null;
      this.frequenceReference = etat.lissee.frequence;
      if (this.attaqueEnAttente !== null) {
        etat.latenceMs = tMs - this.attaqueEnAttente;
        this.attaqueEnAttente = null;
      }
    }
    return etat;
  }

  reinitialiser(): void {
    this.lissage.vider();
    this.stabilite.reinitialiser();
    this.attaques.reinitialiser();
    this.attaqueEnAttente = null;
    this.frequenceReference = null;
  }
}
