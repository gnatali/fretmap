// Journal de test : mesures, essais, test de silence, export et stockage. Fonctions pures, sans DOM.
import { mediane, type EtatDetection } from '../audio/pitch';
import { ecartCents, midiVersFrequence, midiVersNote, nomVersMidi } from '../music/notes';

export const SCENARIOS = [
  { id: '1-accordage-calme', nom: '1 · Cordes à vide, pièce calme' },
  { id: '2-accordage-bruyant', nom: '2 · Cordes à vide, bruit de fond' },
  { id: '3-frettes-1-5', nom: '3 · Frettes 1 à 5' },
  { id: '4-silence', nom: '4 · Silence (30 s)' },
  { id: '5-jeu-naturel', nom: '5 · Jeu naturel' },
] as const;

export const SCENARIO_SILENCE = '4-silence';

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
  'octave_erronee',
  'faux_positifs',
  'notes_parasites',
  'date',
];

/** Une note jouée, de sa première détection stable jusqu'au silence ou à l'attaque suivante. */
export interface Mesure {
  numero: number;
  note: string;
  midi: number;
  /** Médiane des fréquences lissées pendant toute la durée stable de la note, en Hz. */
  frequence: number;
  latenceMs: number | null;
  /** Note attendue au moment où la note a commencé (et non quand elle se termine). */
  noteAttendue: string;
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
   * @param noteAttendue note attendue à cet instant ; elle est figée au début de chaque note, pour qu'un changement
   * de corde dans l'accordeur pendant que la note sonne ne soit pas attribué à cette note.
   * @returns la mesure qui vient de se terminer, ou null.
   */
  traiter(etat: EtatDetection, noteAttendue = ''): Mesure | null {
    if (etat.nouvelleNoteStable && etat.stable) {
      const terminee = this.terminer();
      this.courante = {
        numero: ++this.compteur,
        note: etat.stable.libelle,
        midi: etat.stable.midi,
        frequences: [etat.stable.frequence],
        latenceMs: etat.latenceMs,
        noteAttendue,
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

export interface ContexteEssai {
  id: number;
  scenario: string;
  guitare: string;
  materiel: string;
  a4: number;
  date: Date;
}

/** Essai pour une note jouée. L'écart est calculé par rapport à la note attendue au début de la note. */
export function creerEssai(contexte: ContexteEssai, mesure: Mesure): Essai {
  const midiAttendu = nomVersMidi(mesure.noteAttendue);
  const freqTheorique = midiAttendu === null ? null : midiVersFrequence(midiAttendu, contexte.a4);
  return {
    id: contexte.id,
    scenario: contexte.scenario,
    guitare: contexte.guitare.trim(),
    materiel: contexte.materiel.trim(),
    note_attendue: midiAttendu === null ? mesure.noteAttendue.trim() : midiVersNote(midiAttendu).libelle,
    note_detectee: mesure.note,
    freq_mesuree_hz: arrondir(mesure.frequence, 2),
    freq_theorique_hz: freqTheorique === null ? null : arrondir(freqTheorique, 2),
    ecart_cents: freqTheorique === null ? null : arrondir(ecartCents(mesure.frequence, freqTheorique), 1),
    latence_ms: mesure.latenceMs === null ? null : Math.round(mesure.latenceMs),
    octave_erronee:
      midiAttendu === null ? null : mesure.midi !== midiAttendu && (mesure.midi - midiAttendu) % 12 === 0,
    faux_positifs: null,
    notes_parasites: '',
    date: contexte.date.toISOString(),
  };
}

/** Essai du scénario 4 : nombre de notes détectées pendant le silence. */
export function creerEssaiSilence(contexte: Omit<ContexteEssai, 'a4'>, notes: readonly string[]): Essai {
  return {
    id: contexte.id,
    scenario: contexte.scenario,
    guitare: contexte.guitare.trim(),
    materiel: contexte.materiel.trim(),
    note_attendue: 'silence',
    note_detectee: '',
    freq_mesuree_hz: null,
    freq_theorique_hz: null,
    ecart_cents: null,
    latence_ms: null,
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

/** Lit le journal ; renvoie une liste vide si le stockage est indisponible ou illisible. */
export function chargerEssais(stockage: Stockage | null): Essai[] {
  try {
    const brut = stockage?.getItem(CLE_JOURNAL);
    if (!brut) return [];
    const donnees: unknown = JSON.parse(brut);
    return Array.isArray(donnees) ? donnees.filter(estEssai) : [];
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
  /** Essais dont la note attendue est connue (hors silence). */
  notesEvaluees: number;
  bonnesNotes: number;
  /** Moyenne des écarts absolus sur les bonnes notes, en cents (H1). */
  ecartMoyenAbsCents: number | null;
  latenceMedianeMs: number | null;
  /** Part des latences mesurées sous LATENCE_MAX_MS (H3), de 0 à 1. */
  partLatenceOk: number | null;
  octavesErronees: number;
  fauxPositifs: number | null;
}

/** Résumé par scénario, pour juger les hypothèses H1 à H5. */
export function resumer(essais: readonly Essai[]): ResumeScenario[] {
  const scenarios = [...new Set(essais.map((e) => e.scenario))].sort();
  return scenarios.map((scenario) => {
    const liste = essais.filter((e) => e.scenario === scenario);
    const evaluees = liste.filter((e) => e.note_attendue !== '' && e.note_attendue !== 'silence');
    const bonnes = evaluees.filter((e) => e.note_detectee === e.note_attendue);
    const ecarts = bonnes.map((e) => e.ecart_cents).filter((v): v is number => v !== null);
    const latences = liste.map((e) => e.latence_ms).filter((v): v is number => v !== null);
    const silences = liste.filter((e) => e.faux_positifs !== null);
    return {
      scenario,
      essais: liste.length,
      notesEvaluees: evaluees.length,
      bonnesNotes: bonnes.length,
      ecartMoyenAbsCents: ecarts.length ? arrondir(ecarts.reduce((s, v) => s + Math.abs(v), 0) / ecarts.length, 1) : null,
      latenceMedianeMs: latences.length ? Math.round(mediane(latences)) : null,
      partLatenceOk: latences.length ? latences.filter((v) => v < LATENCE_MAX_MS).length / latences.length : null,
      octavesErronees: liste.filter((e) => e.octave_erronee === true).length,
      fauxPositifs: silences.length ? silences.reduce((s, e) => s + (e.faux_positifs ?? 0), 0) : null,
    };
  });
}
