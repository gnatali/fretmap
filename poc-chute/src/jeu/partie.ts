// Déroulement d'une partie (spec §6.3 à §6.8) : tirage des notes, chute, validation au micro, série, points, vitesse,
// statistiques et journal. Le temps est passé en paramètre, sur l'horloge de l'écoute (performance.now()).
import type { EtatDetection } from '../audio/pitch';
import { noteDePosition, type Position } from '../music/manche';
import type { Notation } from '../music/notation';
import { frequenceVersNote, midiVersFrequence, type NoteDetectee } from '../music/notes';
import { progressionInitiale, type Mode, type Niveau, type Statistique } from '../progression/modele';
import { caseMaxDuNiveau, contenuNiveau, positionsDuNiveau } from '../progression/niveaux';
import { enregistrerReponse, poidsDuMode } from '../progression/statistiques';
import { tirerQuestion, type OptionsTirage, type Question } from '../quiz/tirage';
import { SuiviMode2, type OptionsMode2 } from '../quiz/validation';
import { Chute, type NoteEnChute } from './chute';
import {
  quantile,
  type ContexteJournal,
  type EvenementNoteJournal,
  type NoteJournal,
  type PartieJournal,
  type ResultatNote,
} from './journal';
import { multiplicateur, pointsNote, timingDe, type Timing } from './points';
import { apresResultat, vitesseInitiale, type EtatVitesse } from './vitesse';

/** Notes par partie : 30 (spec §6.7, Q15), à ajuster. */
export const NOTES_PAR_PARTIE = 30;
/** Durée d'affichage de la bonne case après une erreur, en ms : 1,5 s (spec §6.2, Q8), à ajuster. */
export const DUREE_RAPPEL_CASE_MS = 1500;
/** Validation au micro : le demi-ton, octave non stricte, sans réglage dans le POC (spec §3). */
export const OPTIONS_VALIDATION: OptionsMode2 = { tolerance: 50, octaveStricte: false };
/** Le jeu se joue au micro : ses statistiques sont celles du mode 2 du modèle de l'application. */
const MODE: Mode = 2;

/** Choix de l'écran de départ (spec §6.1). */
export interface ReglagesPartie {
  niveau: Niveau;
  dureeInitialeMs: number;
  /** Option de mesure : désactive la vitesse adaptative. */
  vitesseFixe: boolean;
  /** Option de mesure : l'étiquette de la note donne aussi la case (affichage seulement). */
  afficherCase: boolean;
  notation: Notation;
}

export interface OptionsPartie {
  /** Instant du début de la partie, sur l'horloge des appels suivants. */
  debutMs: number;
  /** Date et heure du début (journal, statistiques). */
  date: Date;
  /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
  hasard?: () => number;
  /** Partie jouée au clavier, sans micro (spec §6.9). */
  simulation?: boolean;
}

export type EvenementPartie =
  /** La note attendue est jouée juste, détruite par une fausse note, ou arrivée sur la ligne sans être jouée. */
  | {
      type: 'resultat';
      note: NoteEnChute;
      resultat: ResultatNote;
      timing: Timing | null;
      points: number;
      serie: number;
      /** Note jouée (null pour une note ratée). */
      detectee: NoteDetectee | null;
    }
  /** Première note jouée identique à la note précédente : la corde précédente sonne encore, ignorée une fois. */
  | { type: 'ancienneNote'; detectee: NoteDetectee }
  /** Attaque sans note stable au bout de 1,5 s : ni juste ni fausse. */
  | { type: 'nonReconnue' }
  | { type: 'fin'; interrompue: boolean };

export class Partie {
  readonly reglages: Readonly<ReglagesPartie>;
  readonly simulation: boolean;
  score = 0;
  serie = 0;
  meilleureSerie = 0;

  private readonly chute = new Chute();
  private readonly suivi = new SuiviMode2();
  private readonly candidates: Position[];
  private readonly optionsTirage: Omit<OptionsTirage, 'poids'>;
  private readonly hasard: () => number;
  private readonly debutMs: number;
  private readonly date: Date;
  private vitesse: EtatVitesse;
  private dureeMinMs: number;
  private stats: Statistique[];
  private tirees = 0;
  private conclues = 0;
  private derniereTiree: Question | undefined;
  private derniereConclue: Question | null = null;
  private dernierT: number;
  /** Dernière attaque entendue pendant que la note attendue l'était. */
  private derniereAttaqueMs: number | null = null;
  /** Événements sans effet de la note attendue. */
  private evenementsAttendue: EvenementNoteJournal[] = [];
  private readonly notesJournal: NoteJournal[] = [];
  private fini = false;
  private interrompu = false;

  /** La première note apparaît dès la création. */
  constructor(reglages: ReglagesPartie, statistiques: readonly Statistique[], options: OptionsPartie) {
    this.reglages = { ...reglages };
    this.simulation = options.simulation ?? false;
    this.candidates = positionsDuNiveau(reglages.niveau, MODE);
    this.optionsTirage = {
      caseMax: caseMaxDuNiveau(reglages.niveau, MODE),
      cordeDemandee: contenuNiveau(reglages.niveau).cordeDemandee,
    };
    this.hasard = options.hasard ?? Math.random;
    this.debutMs = options.debutMs;
    this.dernierT = options.debutMs;
    this.date = options.date;
    this.vitesse = vitesseInitiale(reglages.dureeInitialeMs, reglages.vitesseFixe);
    this.dureeMinMs = this.vitesse.dureeMs;
    this.stats = [...statistiques];
    this.apparaitre(options.debutMs);
  }

  /** Notes à l'écran, de la plus basse (la note attendue) à la plus haute. */
  get notes(): readonly NoteEnChute[] {
    return this.chute.notes;
  }

  get attendue(): NoteEnChute | null {
    return this.fini ? null : this.chute.attendue;
  }

  get dureeChuteMs(): number {
    return this.vitesse.dureeMs;
  }

  /** Multiplicateur de la série en cours. */
  get multiplicateur(): number {
    return multiplicateur(this.serie);
  }

  get notesRestantes(): number {
    return NOTES_PAR_PARTIE - this.conclues;
  }

  get terminee(): boolean {
    return this.fini;
  }

  get interrompue(): boolean {
    return this.interrompu;
  }

  /** Statistiques par position mises à jour par la partie, à enregistrer (base du tirage pondéré). */
  get statistiques(): readonly Statistique[] {
    return this.stats;
  }

  /** Fait avancer la chute jusqu'à tMs : notes ratées, puis nouvelle note si une apparition est due. */
  avancer(tMs: number): EvenementPartie[] {
    if (this.fini) return [];
    const dtMs = tMs - this.dernierT;
    this.dernierT = tMs;
    const evenements: EvenementPartie[] = [];
    for (const note of this.chute.avancer(dtMs, this.vitesse.dureeMs)) {
      evenements.push(...this.conclure(note, 'ratee', tMs, null, this.derniereAttaqueMs));
      if (this.fini) return evenements;
    }
    if (this.tirees < NOTES_PAR_PARTIE && this.chute.apparitionDue()) this.apparaitre(tMs);
    return evenements;
  }

  /** Traite un état de la chaîne de détection, avec les règles du mode 2 (SuiviMode2, spec §6.4). */
  traiterDetection(etat: EtatDetection): EvenementPartie[] {
    const note = this.attendue;
    if (!note) return [];
    if (etat.attaque) this.derniereAttaqueMs = etat.tMs;
    const evenement = this.suivi.traiter(etat, OPTIONS_VALIDATION);
    if (!evenement) return [];
    if (evenement.type === 'ancienneNote') {
      this.evenementsAttendue.push({ type: 'ancienneNote', tMs: this.relatif(etat.tMs), nom: evenement.note.nom });
      return [{ type: 'ancienneNote', detectee: evenement.note }];
    }
    if (evenement.type === 'nonReconnue') {
      this.evenementsAttendue.push({ type: 'nonReconnue', tMs: this.relatif(etat.tMs) });
      return [{ type: 'nonReconnue' }];
    }
    const tAttaqueMs = evenement.latenceMs !== null ? etat.tMs - evenement.latenceMs : this.derniereAttaqueMs;
    this.chute.retirerAttendue();
    return this.conclure(note, evenement.juste ? 'juste' : 'fausse', etat.tMs, evenement.note, tAttaqueMs);
  }

  /** Vrai si le micro n'entend rien depuis plus de 3 s alors qu'une note est attendue (message « Jouez la note… »). */
  silenceProlonge(tMs: number): boolean {
    return this.attendue !== null && this.suivi.silenceProlonge(tMs);
  }

  /**
   * Mode simulation (spec §6.9) : joue la note attendue, juste ou un demi-ton au-dessus, sans micro ni latence.
   * Les règles du micro (ancienne note, note non reconnue) ne s'appliquent pas.
   */
  jouerSimule(juste: boolean, tMs: number): EvenementPartie[] {
    const note = this.attendue;
    if (!note) return [];
    const midi = noteDePosition(note.question.position).midi + (juste ? 0 : 1);
    const detectee = frequenceVersNote(midiVersFrequence(midi))!;
    this.chute.retirerAttendue();
    return this.conclure(note, juste ? 'juste' : 'fausse', tMs, detectee, tMs);
  }

  /** Bouton « Arrêter » : la partie est terminée et marquée interrompue. */
  arreter(): EvenementPartie[] {
    if (this.fini) return [];
    this.fini = true;
    this.interrompu = true;
    return [{ type: 'fin', interrompue: true }];
  }

  /** Journal de la partie (spec §6.10), avec ce que fournit l'interface. */
  journal(contexte: ContexteJournal): PartieJournal {
    const justes = this.notesJournal.filter((n) => n.resultat === 'juste');
    const tempsReponse = justes.map((n) => n.tDetectionMs! - n.tAttendueMs);
    const mediane = quantile(tempsReponse, 0.5);
    return {
      debut: this.date.toISOString(),
      navigateur: contexte.navigateur,
      simulation: this.simulation,
      interrompue: this.interrompu,
      reglages: { ...this.reglages },
      seuilSilenceDbfs: contexte.seuilSilenceDbfs,
      traitementsActifs: [...contexte.traitementsActifs],
      images: { ...contexte.images },
      resume: {
        score: this.score,
        justes: justes.length,
        fausses: this.notesJournal.filter((n) => n.resultat === 'fausse').length,
        ratees: this.notesJournal.filter((n) => n.resultat === 'ratee').length,
        meilleureSerie: this.meilleureSerie,
        dureeFinaleMs: Math.round(this.vitesse.dureeMs),
        dureeMinMs: Math.round(this.dureeMinMs),
        tempsReponseMedianMs: mediane === null ? null : Math.round(mediane),
      },
      notes: this.notesJournal.map((n) => ({ ...n, evenements: [...n.evenements] })),
    };
  }

  /** Temps en ms depuis le début de la partie, arrondi. */
  private relatif(tMs: number): number {
    return Math.round(tMs - this.debutMs);
  }

  /** Tire une nouvelle note (pondérée par les statistiques en cours) et la place en haut de la chute. */
  private apparaitre(tMs: number): void {
    const question = tirerQuestion(
      this.candidates,
      { ...this.optionsTirage, poids: poidsDuMode(this.stats, MODE) },
      this.hasard,
      this.derniereTiree,
    );
    this.tirees++;
    this.derniereTiree = question;
    this.chute.ajouter({ index: this.tirees, question, progression: 0, tApparitionMs: tMs, tAttendueMs: null });
    this.rendreAttendue(tMs);
  }

  /** La note la plus basse devient attendue si elle ne l'est pas encore : le suivi du micro repart pour elle. */
  private rendreAttendue(tMs: number): void {
    const note = this.chute.attendue;
    if (!note || note.tAttendueMs !== null) return;
    note.tAttendueMs = tMs;
    this.suivi.poser(note.question, this.derniereConclue);
    this.derniereAttaqueMs = null;
    this.evenementsAttendue = [];
  }

  /** Résultat d'une note déjà retirée de la chute : série, points, vitesse, statistique, journal, note suivante. */
  private conclure(
    note: NoteEnChute,
    resultat: ResultatNote,
    tMs: number,
    detectee: NoteDetectee | null,
    tAttaqueMs: number | null,
  ): EvenementPartie[] {
    const tAttendueMs = note.tAttendueMs ?? tMs;
    const juste = resultat === 'juste';
    const position = note.question.position;
    const dureeChuteMs = this.vitesse.dureeMs;
    const progression = Math.min(note.progression, 1);

    this.serie = juste ? this.serie + 1 : 0;
    this.meilleureSerie = Math.max(this.meilleureSerie, this.serie);
    const timing = juste ? timingDe(progression) : null;
    // Points sur la durée de chute au moment de la validation, avant le changement de vitesse.
    const points = timing ? pointsNote({ timing, dureeChuteMs, position, serie: this.serie }) : 0;
    this.score += points;
    this.vitesse = apresResultat(this.vitesse, juste);
    this.dureeMinMs = Math.min(this.dureeMinMs, this.vitesse.dureeMs);

    // Mise à jour de l'application (enregistrerReponse), sur une progression qui ne porte que les statistiques.
    this.stats = enregistrerReponse(
      { ...progressionInitiale(), statistiques: this.stats },
      {
        mode: MODE,
        position,
        juste,
        tempsMs: tMs - tAttendueMs,
        date: new Date(this.date.getTime() + tMs - this.debutMs),
      },
    ).statistiques;

    this.notesJournal.push({
      index: note.index,
      position: { ...position },
      nom: note.question.nom,
      midi: noteDePosition(position).midi,
      tApparitionMs: this.relatif(note.tApparitionMs),
      tAttendueMs: this.relatif(tAttendueMs),
      tAttaqueMs: tAttaqueMs === null ? null : this.relatif(tAttaqueMs),
      tDetectionMs: detectee ? this.relatif(tMs) : null,
      detectee: detectee ? { nom: detectee.nom, midi: detectee.midi, cents: detectee.cents } : null,
      resultat,
      progression: Math.round(progression * 1000) / 1000,
      dureeChuteMs: Math.round(dureeChuteMs),
      timing,
      points,
      serie: this.serie,
      evenements: this.evenementsAttendue,
    });
    this.conclues++;
    this.derniereConclue = note.question;

    const evenements: EvenementPartie[] = [
      { type: 'resultat', note, resultat, timing, points, serie: this.serie, detectee },
    ];
    if (this.conclues >= NOTES_PAR_PARTIE) {
      this.fini = true;
      evenements.push({ type: 'fin', interrompue: false });
      return evenements;
    }
    // Écran vide : la note suivante apparaîtra au prochain appel à avancer (une image plus tard).
    this.rendreAttendue(tMs);
    return evenements;
  }
}
