// Écoute du micro : démarrage, boucle d'analyse, calibrage du silence (spec §3, §5.2). Relie audio/ à l'interface ;
// les règles de réponse sont dans quiz/validation.ts. Servira aussi à l'accordeur (phase 5).
import { ErreurMicro, demarrerMicro, type SessionMicro } from './audio/micro';
import { DUREE_CALIBRAGE_MS, seuilDepuisBruit } from './audio/niveau';
import { ChaineDetection, TAILLE_FENETRE, type EtatDetection } from './audio/pitch';

export type StatutEcoute = 'arrete' | 'demarrage' | 'calibrage' | 'actif';

/** Traitements du navigateur qui doivent être désactivés (spec §3). */
export type Traitement = 'echoCancellation' | 'noiseSuppression' | 'autoGainControl';

export interface DependancesEcoute {
  demarrerMicro: (tailleFenetre: number) => Promise<SessionMicro>;
  /** Planifie l'analyse suivante (requestAnimationFrame dans le navigateur). */
  planifier: (rappel: () => void) => number;
  annuler: (id: number) => void;
  maintenant: () => number;
}

const DEPENDANCES_NAVIGATEUR: DependancesEcoute = {
  demarrerMicro,
  planifier: (rappel) => requestAnimationFrame(rappel),
  annuler: (id) => cancelAnimationFrame(id),
  maintenant: () => performance.now(),
};

export interface ReglagesEcoute {
  a4: number;
  /** Seuil de silence de départ, en dBFS ; remplacé par le calibrage au démarrage. */
  seuilSilenceDb: number;
}

export class Ecoute {
  statut = $state<StatutEcoute>('arrete');
  /** Message à afficher si le micro n'a pas pu démarrer. */
  erreur = $state<string | null>(null);
  /** Dernier état de la chaîne de détection (indicateur en direct). */
  detection = $state.raw<EtatDetection | null>(null);
  seuilDbfs = $state(0);
  /** Traitements que le navigateur a laissés actifs malgré la demande. */
  traitementsActifs = $state<Traitement[]>([]);

  private readonly deps: DependancesEcoute;
  private readonly chaine = new ChaineDetection(TAILLE_FENETRE);
  private readonly tampon = new Float32Array(TAILLE_FENETRE);
  private session: SessionMicro | null = null;
  private boucle = 0;
  private calibrage: { debut: number | null; mesures: number[] } | null = null;
  private auditeur: ((etat: EtatDetection) => void) | null = null;
  /** Change à chaque arrêt : un démarrage en cours sait ainsi qu'il a été annulé. */
  private generation = 0;

  /**
   * @param surSeuil appelé avec le seuil mesuré à la fin du calibrage, pour l'enregistrer dans les réglages.
   */
  constructor(
    reglages: ReglagesEcoute,
    private readonly surSeuil: (seuilDbfs: number) => void = () => {},
    deps: Partial<DependancesEcoute> = {},
  ) {
    this.deps = { ...DEPENDANCES_NAVIGATEUR, ...deps };
    this.chaine.reglages.a4 = reglages.a4;
    this.chaine.reglages.seuilSilenceDbfs = reglages.seuilSilenceDb;
    this.seuilDbfs = reglages.seuilSilenceDb;
  }

  /** Reçoit chaque état de détection une fois le calibrage terminé. */
  ecouter(auditeur: ((etat: EtatDetection) => void) | null): void {
    this.auditeur = auditeur;
  }

  /**
   * Démarre le micro puis mesure le bruit ambiant. À appeler depuis un clic : le contexte audio est créé
   * avant toute attente (audio/micro.ts).
   */
  async demarrer(): Promise<void> {
    if (this.statut !== 'arrete') return;
    this.statut = 'demarrage';
    this.erreur = null;
    const generation = this.generation;
    let session: SessionMicro;
    try {
      session = await this.deps.demarrerMicro(TAILLE_FENETRE);
    } catch (erreur) {
      if (generation !== this.generation) return;
      this.erreur = erreur instanceof ErreurMicro ? erreur.message : String(erreur);
      this.statut = 'arrete';
      return;
    }
    // Arrêté pendant la demande d'autorisation (écran quitté, onglet masqué).
    if (generation !== this.generation) {
      await session.arreter();
      return;
    }
    this.session = session;
    const piste = session.reglagesPiste;
    this.traitementsActifs = (['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const).filter(
      (t) => piste[t] === true,
    );
    this.chaine.reinitialiser();
    this.calibrer();
    this.boucle = this.deps.planifier(() => this.analyser());
  }

  /** Mesure le bruit ambiant pendant DUREE_CALIBRAGE_MS (« ne jouez pas »), puis fixe le seuil de silence. */
  calibrer(): void {
    this.calibrage = { debut: null, mesures: [] };
    this.statut = 'calibrage';
  }

  async arreter(): Promise<void> {
    this.generation++;
    this.deps.annuler(this.boucle);
    this.calibrage = null;
    this.detection = null;
    this.statut = 'arrete';
    const session = this.session;
    this.session = null;
    await session?.arreter();
  }

  /** Traite un état de détection : calibrage, puis transmission à l'auditeur. Appelé par la boucle d'analyse. */
  traiterEtat(etat: EtatDetection): void {
    this.detection = etat;
    if (this.calibrage) {
      this.calibrage.debut ??= etat.tMs;
      this.calibrage.mesures.push(etat.niveauDbfs);
      if (etat.tMs - this.calibrage.debut < DUREE_CALIBRAGE_MS) return;
      const seuil = Math.round(seuilDepuisBruit(this.calibrage.mesures) * 10) / 10;
      this.calibrage = null;
      this.chaine.reglages.seuilSilenceDbfs = seuil;
      this.chaine.reinitialiser();
      this.seuilDbfs = seuil;
      this.statut = 'actif';
      this.surSeuil(seuil);
      return;
    }
    this.auditeur?.(etat);
  }

  private analyser(): void {
    const session = this.session;
    if (!session) return;
    session.lire(this.tampon);
    this.traiterEtat(this.chaine.traiter(this.tampon, session.contexte.sampleRate, this.deps.maintenant()));
    if (this.session) this.boucle = this.deps.planifier(() => this.analyser());
  }
}
