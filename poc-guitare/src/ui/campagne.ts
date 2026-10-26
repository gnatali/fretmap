// Campagne de test guidée : réglages, carte de consigne, enchaînement des étapes et reprise après rechargement.
import type { EtatDetection } from '../audio/pitch';
import {
  Campagne,
  OPTIONS_DEFAUT,
  construireProgramme,
  estimerDureeMinutes,
  type Etape,
  type Evenement,
  type NumeroScenario,
  type OptionsCampagne,
} from '../journal/campagne';
import type { ContexteNote } from '../journal/essais';
import { element, formaterCents } from './dom';
import type { VueJournal } from './journal';

/** Clé de stockage de la campagne en cours (options et étape), pour la reprendre après un rechargement. */
const CLE_CAMPAGNE = 'poc-guitare.campagne.v1';
/** Durée du liseré vert ou rouge après chaque note, en ms. */
const DUREE_FLASH_MS = 400;

interface Sauvegarde {
  options: OptionsCampagne;
  index: number;
}

export interface DependancesCampagne {
  journal: VueJournal;
  /** Démarre le micro s'il est arrêté ; doit être appelé depuis un clic. @returns false si le micro est indisponible. */
  demarrerMicro: () => Promise<boolean>;
  microActif: () => boolean;
  /** Lance la mesure du bruit ambiant et appelle `fin` une fois le seuil fixé. */
  calibrer: (fin: () => void) => void;
}

function stockageLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function entier(champ: HTMLInputElement, defaut: number): number {
  const v = Math.round(champ.valueAsNumber);
  return Number.isFinite(v) && v >= Number(champ.min) && v <= Number(champ.max) ? v : defaut;
}

export class VueCampagne {
  private readonly config = element('campagne-config');
  private readonly carte = element('campagne-carte');
  private readonly guitare = element<HTMLInputElement>('journal-guitare');
  private readonly materiel = element<HTMLInputElement>('journal-materiel');
  private readonly repCordes = element<HTMLInputElement>('campagne-rep-cordes');
  private readonly repCases = element<HTMLInputElement>('campagne-rep-cases');
  private readonly notesHasard = element<HTMLInputElement>('campagne-notes-hasard');
  private readonly estimation = element('campagne-estimation');
  private readonly btnLancer = element<HTMLButtonElement>('campagne-lancer');
  private readonly btnReprendre = element<HTMLButtonElement>('campagne-reprendre');
  private readonly erreur = element('campagne-erreur');
  private readonly titre = element('campagne-titre');
  private readonly indication = element('campagne-indication');
  private readonly note = element('campagne-note');
  private readonly consigne = element('campagne-consigne');
  private readonly compteur = element('campagne-compteur');
  private readonly resultat = element('campagne-resultat');
  private readonly barre = element('campagne-barre');
  private readonly avancement = element('campagne-avancement');
  private readonly btnContinuer = element<HTMLButtonElement>('campagne-continuer');
  private readonly btnPasser = element<HTMLButtonElement>('campagne-passer');
  private readonly btnArreter = element<HTMLButtonElement>('campagne-arreter');
  private readonly btnsFin = ['campagne-csv', 'campagne-json', 'campagne-fermer'].map((id) => element<HTMLButtonElement>(id));

  private readonly stockage = stockageLocal();
  private campagne: Campagne | null = null;
  private options: OptionsCampagne | null = null;
  /** Micro coupé pendant la campagne : l'étape en cours reprendra à son début. */
  private enAttenteDuMicro = false;
  /** Dernier texte du compteur, pour ne toucher au DOM qu'en cas de changement (null : à réafficher). */
  private texteCompteur: string | null = null;
  private minuteurFlash = 0;

  constructor(private readonly deps: DependancesCampagne) {
    for (const champ of [this.repCordes, this.repCases, this.notesHasard, ...this.casesScenarios()]) {
      champ.addEventListener('change', () => this.afficherEstimation());
    }
    this.btnLancer.addEventListener('click', () => void this.lancer(null));
    this.btnReprendre.addEventListener('click', () => void this.lancer(this.lireSauvegarde()));
    this.btnContinuer.addEventListener('click', () => this.appliquer(this.campagne?.continuer(performance.now()) ?? []));
    this.btnPasser.addEventListener('click', () => this.appliquer(this.campagne?.passer(performance.now()) ?? []));
    this.btnArreter.addEventListener('click', () => this.arreter(true));
    element('campagne-csv').addEventListener('click', () => this.deps.journal.exporter('csv'));
    element('campagne-json').addEventListener('click', () => this.deps.journal.exporter('json'));
    element('campagne-fermer').addEventListener('click', () => this.arreter(false));
    this.afficherEstimation();
    this.proposerReprise();
  }

  /** Campagne en cours (pour le journal) : contexte de l'étape, null entre deux étapes de jeu. */
  get enCours(): { contexte: ContexteNote | null } | null {
    if (!this.campagne || this.campagne.terminee) return null;
    return { contexte: this.enAttenteDuMicro ? null : this.campagne.contexte() };
  }

  /** À appeler à chaque analyse, après le journal (qui fige le contexte de la note avant un changement d'étape). */
  traiter(etat: EtatDetection): void {
    if (!this.campagne || this.enAttenteDuMicro) return;
    this.appliquer(this.campagne.traiter(etat));
    this.afficherCompteur(etat.tMs);
  }

  definirMicroActif(actif: boolean): void {
    if (!this.campagne || this.campagne.terminee) return;
    if (!actif) {
      this.enAttenteDuMicro = true;
      this.resultat.textContent = 'Micro arrêté : cliquez sur « Démarrer » pour reprendre cette étape.';
      return;
    }
    if (this.enAttenteDuMicro) {
      this.enAttenteDuMicro = false;
      this.resultat.textContent = '';
      this.appliquer(this.campagne.reprendreEtape(performance.now()));
    }
  }

  private async lancer(reprise: Sauvegarde | null): Promise<void> {
    this.erreur.hidden = true;
    const options = reprise?.options ?? this.lireOptions();
    if (!this.guitare.value.trim() || !this.materiel.value.trim()) return this.signaler('Renseignez la guitare et le matériel.');
    if (options.scenarios.length === 0) return this.signaler('Choisissez au moins un scénario.');
    if (!this.deps.microActif() && !(await this.deps.demarrerMicro())) {
      return this.signaler('Le micro n’a pas démarré : voir le message dans la section « Micro ».');
    }
    this.options = options;
    this.campagne = new Campagne(construireProgramme(options));
    this.enAttenteDuMicro = false;
    document.body.classList.add('campagne-active');
    this.config.hidden = true;
    this.carte.hidden = false;
    this.deps.journal.definirCampagneActive(true, true);
    this.appliquer(this.campagne.demarrer(performance.now(), reprise?.index ?? 0));
    this.carte.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Arrête la campagne ; les essais déjà enregistrés restent dans le journal. */
  private arreter(confirmer: boolean): void {
    if (confirmer && this.campagne && !this.campagne.terminee && !window.confirm('Arrêter la campagne ? Les essais enregistrés sont conservés.')) {
      return;
    }
    this.campagne = null;
    this.options = null;
    this.effacerSauvegarde();
    document.body.classList.remove('campagne-active');
    this.carte.hidden = true;
    this.config.hidden = false;
    this.deps.journal.definirCampagneActive(false, this.deps.microActif());
    this.proposerReprise();
  }

  private appliquer(evenements: readonly Evenement[]): void {
    for (const e of evenements) {
      switch (e.type) {
        case 'etape':
          this.afficherEtape(e.etape);
          this.sauvegarder(e.index);
          break;
        case 'resultat':
          this.resultat.textContent = e.juste
            ? `✓ ${e.detectee}${e.cents !== null ? ` ${formaterCents(e.cents)}` : ''}${e.latenceMs !== null ? ` · ${Math.round(e.latenceMs)} ms` : ''}`
            : `✗ ${e.detectee} au lieu de ${e.attendue}`;
          this.flash(e.juste);
          break;
        case 'ancienneNote':
          this.deps.journal.ignorerNoteEnCours();
          this.resultat.textContent = `${e.detectee} sonne encore : étouffez-la et rejouez ${e.attendue} (non compté).`;
          break;
        case 'nonDetectee':
          this.deps.journal.enregistrerNonDetecte(e.note);
          this.resultat.textContent = e.comptee
            ? `✗ ${e.note.noteAttendue} non détectée`
            : 'Attaque sans note (bruit ?) : enregistrée, non comptée.';
          if (e.comptee) this.flash(false);
          break;
        case 'silenceTermine':
          this.deps.journal.enregistrerSilence(e.notes);
          break;
        case 'calibrer':
          this.deps.calibrer(() => this.appliquer(this.campagne?.calibrageTermine(performance.now()) ?? []));
          break;
        case 'fin':
          this.effacerSauvegarde();
          this.deps.journal.definirCampagneActive(false, this.deps.microActif());
          break;
      }
    }
    if (evenements.length) this.afficherAvancement();
  }

  private afficherEtape(etape: Etape): void {
    this.titre.textContent = etape.titre;
    this.consigne.textContent = etape.consigne;
    const estNote = etape.type === 'note';
    this.indication.textContent = estNote ? etape.indication : '';
    this.note.textContent = estNote ? etape.note : '';
    this.indication.hidden = this.note.hidden = !estNote;
    if (etape.type !== 'note') this.resultat.textContent = '';
    this.btnContinuer.hidden = etape.type !== 'pause';
    const fin = etape.type === 'fin';
    this.btnPasser.hidden = this.btnArreter.hidden = fin;
    for (const b of this.btnsFin) b.hidden = !fin;
    this.carte.dataset.type = etape.type;
    this.texteCompteur = null;
    this.afficherCompteur(performance.now());
    if (etape.type === 'pause') this.btnContinuer.focus();
  }

  private afficherCompteur(tMs: number): void {
    const c = this.campagne;
    const e = c?.etape;
    if (!c || !e) return;
    const reste = c.resteMs(tMs);
    const texte =
      e.type === 'note'
        ? `${c.repetitionsFaites} / ${e.repetitions}`
        : e.type === 'calibrage'
          ? 'Mesure en cours…'
          : reste !== null
            ? `${Math.ceil(reste / 1000)} s`
            : '';
    if (texte !== this.texteCompteur) this.compteur.textContent = this.texteCompteur = texte;
  }

  private afficherAvancement(): void {
    const c = this.campagne;
    if (!c) return;
    const { index, total, part } = c.progression();
    this.barre.style.width = `${Math.round(part * 100)}%`;
    this.avancement.textContent = `Étape ${index + 1} sur ${total} · ${Math.round(part * 100)} % des notes`;
  }

  private flash(juste: boolean): void {
    this.carte.classList.remove('flash-juste', 'flash-faux');
    this.carte.classList.add(juste ? 'flash-juste' : 'flash-faux');
    clearTimeout(this.minuteurFlash);
    this.minuteurFlash = window.setTimeout(() => this.carte.classList.remove('flash-juste', 'flash-faux'), DUREE_FLASH_MS);
  }

  private signaler(texte: string): void {
    this.erreur.textContent = texte;
    this.erreur.hidden = false;
  }

  private casesScenarios(): HTMLInputElement[] {
    return [...document.querySelectorAll<HTMLInputElement>('input[name="campagne-scenario"]')];
  }

  private lireOptions(): OptionsCampagne {
    return {
      scenarios: this.casesScenarios()
        .filter((c) => c.checked)
        .map((c) => Number(c.value) as NumeroScenario),
      repetitionsCordes: entier(this.repCordes, OPTIONS_DEFAUT.repetitionsCordes),
      essaisParCase: entier(this.repCases, OPTIONS_DEFAUT.essaisParCase),
      notesAuHasard: entier(this.notesHasard, OPTIONS_DEFAUT.notesAuHasard),
      graine: Math.floor(Math.random() * 2 ** 32),
    };
  }

  private afficherEstimation(): void {
    const options = this.lireOptions();
    if (options.scenarios.length === 0) {
      this.estimation.textContent = 'Aucun scénario choisi.';
      return;
    }
    const programme = construireProgramme(options);
    const attaques = programme.reduce((n, e) => n + (e.type === 'note' ? e.repetitions : 0), 0);
    const duree = `environ ${estimerDureeMinutes(programme)} min`;
    this.estimation.textContent = attaques ? `${attaques} attaques, ${duree}.` : `Aucune note à jouer, ${duree}.`;
  }

  private sauvegarder(index: number): void {
    if (!this.options || this.campagne?.terminee) return;
    try {
      this.stockage?.setItem(CLE_CAMPAGNE, JSON.stringify({ options: this.options, index } satisfies Sauvegarde));
    } catch {
      // Confort uniquement : sans stockage, la campagne ne pourra pas être reprise après un rechargement.
    }
  }

  private lireSauvegarde(): Sauvegarde | null {
    try {
      const brut = this.stockage?.getItem(CLE_CAMPAGNE);
      if (!brut) return null;
      const s = JSON.parse(brut) as Sauvegarde;
      return Array.isArray(s.options?.scenarios) && Number.isInteger(s.index) ? s : null;
    } catch {
      return null;
    }
  }

  private effacerSauvegarde(): void {
    try {
      this.stockage?.removeItem(CLE_CAMPAGNE);
    } catch {
      // Rien à faire : la sauvegarde sera ignorée ou écrasée.
    }
  }

  private proposerReprise(): void {
    const s = this.lireSauvegarde();
    this.btnReprendre.hidden = !s;
    if (s) {
      const total = construireProgramme(s.options).length;
      this.btnReprendre.textContent = `Reprendre la campagne (étape ${s.index + 1} sur ${total})`;
    }
  }
}
