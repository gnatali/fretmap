// Journal de test : mesures, essais, test de silence, export et stockage. Fonctions pures, sans DOM.
import { mediane, type EtatDetection } from '../audio/pitch';
import { ecartCents, midiVersFrequence, midiVersNote, nomVersMidi } from '../music/notes';

export const SCENARIOS = [
  { id: '1-accordage-calme', nom: '1 · Cordes à vide, pièce calme' },
  { id: '2-accordage-bruyant', nom: '2 · Cordes à vide, bruit de fond' },
  { id: '3-frettes-1-5', nom: '3 · Frettes 1 à 5' },
  { id: '4-silence', nom: '4 · Silence (30 s)' },
  { id: '5-jeu-naturel', nom: '5 · Jeu naturel' },
  { id: '6-aigus-cases-6-12', nom: '6 · Aigus, cases 6 à 12 (jusqu’à E5)' },
] as const;

export const SCENARIO_SILENCE = '4-silence';
/**
 * Scénarios bruyants : une attaque sans note stable peut venir du bruit (éclat de voix) et non de la guitare ;
 * elle y est comptée à part, pas comme une erreur.
 */
export const SCENARIOS_BRUIT: readonly string[] = ['2-accordage-bruyant'];

/** Durée du test de silence (scénario 4, H4), en ms. Valeur 30 s. */
export const DUREE_TEST_SILENCE_MS = 30_000;
/** Latence maximale visée (H3), en ms. */
export const LATENCE_MAX_MS = 300;

export interface Essai {
  id: number;
  scenario: string;
  guitare: string;
  materiel: string;
  note_attendue: string;
  note_detectee: string;
  freq_mesuree_hz: number | null;
  freq_theorique_hz: number | null;
  /** Écart entre la fréquence mesurée et la fréquence théorique de la note attendue, en cents. */
  ecart_cents: number | null;
  latence_ms: number | null;
  /**
   * Vrai si la note suit une attaque (note jouée : ce que verra l'utilisateur en mode 2), faux si elle est apparue
   * pendant que la corde résonnait, sans nouvelle attaque ; null pour le test de silence.
   */
  attaque: boolean | null;
  /** Même nom de note que la note attendue, mais pas la même octave. */
  octave_erronee: boolean | null;
  /** Scénario 4 : nombre de notes détectées pendant le silence. */
  faux_positifs: number | null;
  /** Scénario 4 : notes détectées pendant le silence, séparées par des espaces. */
  notes_parasites: string;
  /** Date ISO 8601 (UTC). */
  date: string;
}

/** Ordre des colonnes de l'export CSV. */
export const CHAMPS: readonly (keyof Essai)[] = [
  'id',
  'scenario',
  'guitare',
  'materiel',
  'note_attendue',
  'note_detectee',
  'freq_mesuree_hz',
  'freq_theorique_hz',
  'ecart_cents',
  'latence_ms',
  'attaque',
  'octave_erronee',
  'faux_positifs',
  'notes_parasites',
  'date',
];

/** Ce qui est attendu au moment où une note commence : scénario en cours et note demandée. */
export interface ContexteNote {
  scenario: string;
  /** Note attendue (« E2 », « Bb4 »…), vide si inconnue. */
  noteAttendue: string;
}

/** Une note jouée, de sa première détection stable jusqu'au silence ou à l'attaque suivante. */
export interface Mesure extends ContexteNote {
  numero: number;
  note: string;
  midi: number;
  /** Médiane des fréquences lissées pendant toute la durée stable de la note, en Hz. */
  frequence: number;
  latenceMs: number | null;
  /** La note suit une attaque (et non un changement pendant que la corde résonne). */
  apresAttaque: boolean;
}

function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/**
 * Découpe le flux de détection en mesures, une par note jouée.
 * La fréquence retenue est la médiane sur toute la note, moins sensible à l'attaque que la première valeur stable.
 */
export class SuiviMesure {
  private courante: Omit<Mesure, 'frequence'> & { frequences: number[] } | null = null;
  private compteur = 0;

  /**
   * @param contexte scénario et note attendue à cet instant ; ils sont figés au début de chaque note, pour qu'un
   * changement de corde ou d'étape pendant que la note sonne ne soit pas attribué à cette note.
   * @returns la mesure qui vient de se terminer, ou null.
   */
  traiter(etat: EtatDetection, contexte: ContexteNote = { scenario: '', noteAttendue: '' }): Mesure | null {
    if (etat.nouvelleNoteStable && etat.stable) {
      const terminee = this.terminer();
      this.courante = {
        numero: ++this.compteur,
        note: etat.stable.libelle,
        midi: etat.stable.midi,
        frequences: [etat.stable.frequence],
        latenceMs: etat.latenceMs,
        apresAttaque: etat.apresAttaque,
        scenario: contexte.scenario,
        noteAttendue: contexte.noteAttendue,
      };
      return terminee;
    }
    if (etat.stable && this.courante && etat.stable.midi === this.courante.midi) {
      this.courante.frequences.push(etat.stable.frequence);
      return null;
    }
    if (etat.silence || etat.attaque) return this.terminer();
    return null;
  }

  /** Mesure en cours (la note sonne encore), sans la terminer. */
  enCours(): Mesure | null {
    const c = this.courante;
    if (!c) return null;
    const { frequences, ...reste } = c;
    return { ...reste, frequence: mediane(frequences) };
  }

  terminer(): Mesure | null {
    const mesure = this.enCours();
    this.courante = null;
    return mesure;
  }
}

/** Compte les notes stables détectées pendant le test de silence. */
export class TestSilence {
  private readonly notes: string[] = [];

  constructor(
    readonly debutMs: number,
    readonly dureeMs: number = DUREE_TEST_SILENCE_MS,
  ) {}

  /** @returns true quand la durée du test est écoulée. */
  traiter(etat: EtatDetection): boolean {
    if (etat.tMs - this.debutMs >= this.dureeMs) return true;
    if (etat.nouvelleNoteStable && etat.stable) this.notes.push(etat.stable.libelle);
    return false;
  }

  resteMs(tMs: number): number {
    return Math.max(0, this.dureeMs - (tMs - this.debutMs));
  }

  get notesParasites(): readonly string[] {
    return this.notes;
  }
}

/** Contexte d'enregistrement d'un essai ; le scénario et la note attendue viennent de la note elle-même. */
export interface ContexteEssai {
  id: number;
  guitare: string;
  materiel: string;
  a4: number;
  date: Date;
}

/** Note attendue au format du journal : « Bb4 » devient « A#4 » ; un texte non reconnu est gardé tel quel. */
function normaliserNote(note: string): string {
  const midi = nomVersMidi(note);
  return midi === null ? note.trim() : midiVersNote(midi).libelle;
}

/** Essai pour une note jouée. L'écart est calculé par rapport à la note attendue au début de la note. */
export function creerEssai(contexte: ContexteEssai, mesure: Mesure): Essai {
  const midiAttendu = nomVersMidi(mesure.noteAttendue);
  const freqTheorique = midiAttendu === null ? null : midiVersFrequence(midiAttendu, contexte.a4);
  return {
    id: contexte.id,
    scenario: mesure.scenario,
    guitare: contexte.guitare.trim(),
    materiel: contexte.materiel.trim(),
    note_attendue: normaliserNote(mesure.noteAttendue),
    note_detectee: mesure.note,
    freq_mesuree_hz: arrondir(mesure.frequence, 2),
    freq_theorique_hz: freqTheorique === null ? null : arrondir(freqTheorique, 2),
    ecart_cents: freqTheorique === null ? null : arrondir(ecartCents(mesure.frequence, freqTheorique), 1),
    latence_ms: mesure.latenceMs === null ? null : Math.round(mesure.latenceMs),
    attaque: mesure.apresAttaque,
    octave_erronee:
      midiAttendu === null ? null : mesure.midi !== midiAttendu && (mesure.midi - midiAttendu) % 12 === 0,
    faux_positifs: null,
    notes_parasites: '',
    date: contexte.date.toISOString(),
  };
}

/**
 * Essai pour une attaque restée sans note stable (corde non reconnue) : la note détectée est vide.
 * Il compte comme une erreur, sauf dans les scénarios bruyants (voir resumer).
 */
export function creerEssaiNonDetecte(contexte: Omit<ContexteEssai, 'a4'>, note: ContexteNote): Essai {
  return {
    id: contexte.id,
    scenario: note.scenario,
    guitare: contexte.guitare.trim(),
    materiel: contexte.materiel.trim(),
    note_attendue: normaliserNote(note.noteAttendue),
    note_detectee: '',
    freq_mesuree_hz: null,
    freq_theorique_hz: null,
    ecart_cents: null,
    latence_ms: null,
    attaque: true,
    octave_erronee: null,
    faux_positifs: null,
    notes_parasites: '',
    date: contexte.date.toISOString(),
  };
}

/** Essai du scénario 4 : nombre de notes détectées pendant le silence. */
export function creerEssaiSilence(contexte: Omit<ContexteEssai, 'a4'>, notes: readonly string[]): Essai {
  return {
    id: contexte.id,
    scenario: SCENARIO_SILENCE,
    guitare: contexte.guitare.trim(),
    materiel: contexte.materiel.trim(),
    note_attendue: 'silence',
    note_detectee: '',
    freq_mesuree_hz: null,
    freq_theorique_hz: null,
    ecart_cents: null,
    latence_ms: null,
    attaque: null,
    octave_erronee: null,
    faux_positifs: notes.length,
    notes_parasites: notes.join(' '),
    date: contexte.date.toISOString(),
  };
}

export function prochainId(essais: readonly Essai[]): number {
  return essais.reduce((max, e) => Math.max(max, e.id), 0) + 1;
}

function celluleCsv(valeur: Essai[keyof Essai]): string {
  if (valeur === null) return '';
  const texte = String(valeur);
  return /[",\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Export CSV (séparateur virgule, décimales avec point, RFC 4180). */
export function versCsv(essais: readonly Essai[]): string {
  const lignes = [CHAMPS.join(','), ...essais.map((e) => CHAMPS.map((c) => celluleCsv(e[c])).join(','))];
  return `${lignes.join('\r\n')}\r\n`;
}

export function versJson(essais: readonly Essai[]): string {
  return `${JSON.stringify(essais, null, 2)}\n`;
}

/** Clé de stockage du journal dans localStorage. */
export const CLE_JOURNAL = 'poc-guitare.journal.v1';

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

function estEssai(valeur: unknown): valeur is Essai {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const e = valeur as Record<string, unknown>;
  return typeof e.id === 'number' && typeof e.scenario === 'string' && typeof e.date === 'string';
}

/**
 * Complète un essai enregistré avant l'ajout du champ `attaque` : une note avec latence suit forcément une attaque.
 */
function completerEssai(essai: Essai): Essai {
  if (typeof essai.attaque === 'boolean' || essai.attaque === null) return essai;
  return { ...essai, attaque: essai.faux_positifs !== null ? null : essai.latence_ms !== null };
}

/** Lit le journal ; renvoie une liste vide si le stockage est indisponible ou illisible. */
export function chargerEssais(stockage: Stockage | null): Essai[] {
  try {
    const brut = stockage?.getItem(CLE_JOURNAL);
    if (!brut) return [];
    const donnees: unknown = JSON.parse(brut);
    return Array.isArray(donnees) ? donnees.filter(estEssai).map(completerEssai) : [];
  } catch {
    return [];
  }
}

/** @returns false si l'écriture a échoué (stockage indisponible ou plein). */
export function sauverEssais(stockage: Stockage | null, essais: readonly Essai[]): boolean {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_JOURNAL, JSON.stringify(essais));
    return true;
  } catch {
    return false;
  }
}

export interface ResumeScenario {
  scenario: string;
  essais: number;
  /** Notes jouées (après une attaque) dont la note attendue est connue : base de H2 et H5. */
  attaquesEvaluees: number;
  bonnesNotes: number;
  /** Moyenne des écarts absolus sur les bonnes notes jouées, en cents (H1). */
  ecartMoyenAbsCents: number | null;
  latenceMedianeMs: number | null;
  /** Part des latences mesurées sous LATENCE_MAX_MS (H3), de 0 à 1. */
  partLatenceOk: number | null;
  /** Erreurs d'octave sur les notes jouées. */
  octavesErronees: number;
  /** Changements de note pendant que la corde résonne, sans nouvelle attaque (instabilité de l'affichage). */
  changementsSansAttaque: number;
  /** Attaques restées sans note stable (comptées comme erreurs, sauf en scénario bruyant). */
  nonDetectees: number;
  fauxPositifs: number | null;
}

/**
 * Résumé par scénario, pour juger les hypothèses H1 à H5.
 * Les taux portent sur les notes jouées (première détection après une attaque, ou attaque non détectée) ;
 * les changements sans attaque sont comptés à part.
 */
export function resumer(essais: readonly Essai[]): ResumeScenario[] {
  const scenarios = [...new Set(essais.map((e) => e.scenario))].sort();
  return scenarios.map((scenario) => {
    const liste = essais.filter((e) => e.scenario === scenario);
    const jouees = liste.filter((e) => e.attaque === true);
    const nonDetectees = jouees.filter((e) => e.note_detectee === '');
    const bruit = SCENARIOS_BRUIT.includes(scenario);
    const evaluees = jouees.filter(
      (e) => e.note_attendue !== '' && e.note_attendue !== 'silence' && !(bruit && e.note_detectee === ''),
    );
    const bonnes = evaluees.filter((e) => e.note_detectee === e.note_attendue);
    const ecarts = bonnes.map((e) => e.ecart_cents).filter((v): v is number => v !== null);
    const latences = jouees.map((e) => e.latence_ms).filter((v): v is number => v !== null);
    const silences = liste.filter((e) => e.faux_positifs !== null);
    return {
      scenario,
      essais: liste.length,
      attaquesEvaluees: evaluees.length,
      bonnesNotes: bonnes.length,
      ecartMoyenAbsCents: ecarts.length ? arrondir(ecarts.reduce((s, v) => s + Math.abs(v), 0) / ecarts.length, 1) : null,
      latenceMedianeMs: latences.length ? Math.round(mediane(latences)) : null,
      partLatenceOk: latences.length ? latences.filter((v) => v < LATENCE_MAX_MS).length / latences.length : null,
      octavesErronees: jouees.filter((e) => e.octave_erronee === true).length,
      changementsSansAttaque: liste.filter((e) => e.attaque === false).length,
      nonDetectees: nonDetectees.length,
      fauxPositifs: silences.length ? silences.reduce((s, e) => s + (e.faux_positifs ?? 0), 0) : null,
    };
  });
}
