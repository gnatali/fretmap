// Journal de test : saisie des essais, test de silence, résumé, export CSV/JSON et stockage local.
import type { EtatDetection } from '../audio/pitch';
import {
  DUREE_TEST_SILENCE_MS,
  LATENCE_MAX_MS,
  SCENARIOS,
  SCENARIO_SILENCE,
  SuiviMesure,
  TestSilence,
  chargerEssais,
  creerEssai,
  creerEssaiSilence,
  prochainId,
  resumer,
  sauverEssais,
  versCsv,
  versJson,
  type Essai,
  type Mesure,
} from '../journal/essais';
import { element, formaterCents, formaterHz, formaterNombre } from './dom';

/** Clé de stockage des champs du formulaire, pour les retrouver après un rechargement. */
const CLE_FORMULAIRE = 'poc-guitare.journal.formulaire.v1';

interface Formulaire {
  scenario: string;
  guitare: string;
  materiel: string;
  noteAttendue: string;
  suivreAccordeur: boolean;
  automatique: boolean;
}

export interface DependancesJournal {
  /** Corde choisie dans l'accordeur, ou null. */
  noteVisee: () => string | null;
  a4: () => number;
}

function stockageLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function telecharger(nom: string, contenu: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function horodatageFichier(date: Date): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${d(date.getMonth() + 1)}${d(date.getDate())}-${d(date.getHours())}${d(date.getMinutes())}`;
}

function cellule(texte: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = texte;
  return td;
}

function decrireMesure(mesure: Mesure): string {
  return (
    `${mesure.note} · ${formaterHz(mesure.frequence)}` +
    (mesure.latenceMs !== null ? ` · latence ${Math.round(mesure.latenceMs)} ms` : mesure.apresAttaque ? '' : ' · sans attaque')
  );
}

export class VueJournal {
  private readonly scenario = element<HTMLSelectElement>('journal-scenario');
  private readonly guitare = element<HTMLInputElement>('journal-guitare');
  private readonly materiel = element<HTMLInputElement>('journal-materiel');
  private readonly noteAttendue = element<HTMLInputElement>('journal-note');
  private readonly suivreAccordeur = element<HTMLInputElement>('journal-suivre');
  private readonly automatique = element<HTMLInputElement>('journal-auto');
  private readonly mesure = element('journal-mesure');
  private readonly message = element('journal-message');
  private readonly btnEnregistrer = element<HTMLButtonElement>('journal-enregistrer');
  private readonly btnSilence = element<HTMLButtonElement>('journal-silence');
  private readonly resume = element<HTMLTableSectionElement>('journal-resume');
  private readonly blocResume = element('journal-bloc-resume');
  private readonly lignes = element<HTMLTableSectionElement>('journal-essais');
  private readonly nombre = element('journal-nombre');

  private readonly stockage = stockageLocal();
  private essais: Essai[];
  private readonly suivi = new SuiviMesure();
  /** Dernière mesure terminée (note qui ne sonne plus). */
  private derniere: Mesure | null = null;
  /** Numéro de la dernière mesure enregistrée, pour ne pas l'enregistrer deux fois. */
  private derniereEnregistree = 0;
  private testSilence: TestSilence | null = null;
  private texteMesure = '';

  constructor(private readonly deps: DependancesJournal) {
    for (const s of SCENARIOS) this.scenario.add(new Option(s.nom, s.id));
    element('journal-entete-latence').textContent = `< ${LATENCE_MAX_MS} ms`;
    this.btnSilence.textContent = `Test de silence ${DUREE_TEST_SILENCE_MS / 1000} s`;
    this.restaurerFormulaire();
    this.essais = chargerEssais(this.stockage);
    if (!this.stockage) this.informer('Stockage local indisponible : exportez le journal avant de quitter la page.');

    for (const champ of [this.scenario, this.guitare, this.materiel, this.noteAttendue, this.suivreAccordeur, this.automatique]) {
      champ.addEventListener('change', () => this.sauverFormulaire());
    }
    this.suivreAccordeur.addEventListener('change', () => this.synchroniserNoteAttendue());
    this.btnEnregistrer.addEventListener('click', () => this.enregistrerManuellement());
    this.btnSilence.addEventListener('click', () => (this.testSilence ? this.annulerTestSilence() : this.lancerTestSilence()));
    element('journal-csv').addEventListener('click', () => this.exporter('csv'));
    element('journal-json').addEventListener('click', () => this.exporter('json'));
    element('journal-vider').addEventListener('click', () => this.vider());
    this.lignes.addEventListener('click', (evenement) => {
      const bouton = (evenement.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (bouton) this.supprimer(Number(bouton.dataset.id));
    });

    this.synchroniserNoteAttendue();
    this.afficherEssais();
  }

  /** À appeler à chaque analyse : découpe les notes, enregistre en mode automatique et fait avancer le test de silence. */
  traiter(etat: EtatDetection): void {
    if (this.suivreAccordeur.checked) this.synchroniserNoteAttendue();

    const terminee = this.suivi.traiter(etat, this.noteAttendue.value);
    if (terminee) this.derniere = terminee;

    if (this.testSilence) {
      if (this.testSilence.traiter(etat)) this.terminerTestSilence();
      else this.btnSilence.textContent = `Annuler le test (${Math.ceil(this.testSilence.resteMs(etat.tMs) / 1000)} s)`;
    } else if (terminee && this.automatique.checked) {
      this.enregistrer(terminee, true);
    }

    this.afficherMesure();
  }

  /** Micro démarré ou arrêté : le test de silence n'est possible que micro actif. */
  definirMicroActif(actif: boolean): void {
    this.btnSilence.disabled = !actif;
    if (actif) return;
    if (this.testSilence) {
      this.testSilence = null;
      this.btnSilence.textContent = `Test de silence ${DUREE_TEST_SILENCE_MS / 1000} s`;
      this.informer('Test de silence interrompu : micro arrêté.');
    }
    const terminee = this.suivi.terminer();
    if (terminee) {
      this.derniere = terminee;
      if (this.automatique.checked) this.enregistrer(terminee, true);
    }
    this.afficherMesure();
  }

  private afficherMesure(): void {
    const enCours = this.suivi.enCours();
    const texte = enCours ? `${decrireMesure(enCours)} (en cours)` : this.derniere ? decrireMesure(this.derniere) : '—';
    if (texte !== this.texteMesure) this.mesure.textContent = this.texteMesure = texte;
  }

  private enregistrerManuellement(): void {
    const mesure = this.suivi.enCours() ?? this.derniere;
    if (!mesure) {
      this.informer('Aucune note mesurée : démarrez le micro et jouez une note.');
      return;
    }
    if (mesure.numero <= this.derniereEnregistree) {
      this.informer('Cette note est déjà enregistrée : jouez la note suivante.');
      return;
    }
    this.enregistrer(mesure, false);
  }

  private enregistrer(mesure: Mesure, automatique: boolean): void {
    if (mesure.numero <= this.derniereEnregistree) return;
    if (this.scenario.value === SCENARIO_SILENCE) {
      if (!automatique) this.informer('Pour le scénario 4, utilisez « Test de silence 30 s ».');
      return;
    }
    this.derniereEnregistree = mesure.numero;
    const essai = creerEssai(
      {
        id: prochainId(this.essais),
        scenario: this.scenario.value,
        guitare: this.guitare.value,
        materiel: this.materiel.value,
        a4: this.deps.a4(),
        date: new Date(),
      },
      mesure,
    );
    this.ajouter(essai);
    const type = essai.attaque ? 'Essai' : 'Changement sans attaque';
    const verdict =
      essai.note_attendue === ''
        ? ''
        : essai.note_detectee === essai.note_attendue
          ? ` · ${formaterCents(essai.ecart_cents ?? 0)}`
          : ` · attendu ${essai.note_attendue}${essai.octave_erronee ? ' (octave erronée)' : ''}`;
    this.informer(`${type} n° ${essai.id} enregistré : ${essai.note_detectee}${verdict}.`);
  }

  private lancerTestSilence(): void {
    this.scenario.value = SCENARIO_SILENCE;
    this.sauverFormulaire();
    this.testSilence = new TestSilence(performance.now());
    this.btnSilence.textContent = `Annuler le test (${DUREE_TEST_SILENCE_MS / 1000} s)`;
    this.informer('Test de silence en cours : ne jouez pas, ne touchez pas la guitare.');
  }

  private annulerTestSilence(): void {
    this.testSilence = null;
    this.btnSilence.textContent = `Test de silence ${DUREE_TEST_SILENCE_MS / 1000} s`;
    this.informer('Test de silence annulé.');
  }

  private terminerTestSilence(): void {
    const notes = this.testSilence?.notesParasites ?? [];
    this.testSilence = null;
    this.btnSilence.textContent = `Test de silence ${DUREE_TEST_SILENCE_MS / 1000} s`;
    const essai = creerEssaiSilence(
      {
        id: prochainId(this.essais),
        scenario: SCENARIO_SILENCE,
        guitare: this.guitare.value,
        materiel: this.materiel.value,
        date: new Date(),
      },
      notes,
    );
    this.ajouter(essai);
    this.informer(
      notes.length === 0
        ? `Essai n° ${essai.id} : aucune fausse détection en ${DUREE_TEST_SILENCE_MS / 1000} s.`
        : `Essai n° ${essai.id} : ${notes.length} fausse(s) détection(s) (${notes.join(' ')}).`,
    );
  }

  private ajouter(essai: Essai): void {
    this.essais = [...this.essais, essai];
    this.persister();
  }

  private supprimer(id: number): void {
    if (!window.confirm(`Supprimer l’essai n° ${id} ?`)) return;
    this.essais = this.essais.filter((e) => e.id !== id);
    this.persister();
    this.informer(`Essai n° ${id} supprimé.`);
  }

  private vider(): void {
    if (this.essais.length === 0) return;
    if (!window.confirm(`Vider le journal (${this.essais.length} essais) ? Exportez-le avant si besoin : c’est définitif.`)) return;
    this.essais = [];
    this.persister();
    this.informer('Journal vidé.');
  }

  private exporter(format: 'csv' | 'json'): void {
    if (this.essais.length === 0) {
      this.informer('Le journal est vide.');
      return;
    }
    const nom = `journal-poc-guitare-${horodatageFichier(new Date())}.${format}`;
    if (format === 'csv') telecharger(nom, versCsv(this.essais), 'text/csv;charset=utf-8');
    else telecharger(nom, versJson(this.essais), 'application/json');
  }

  private persister(): void {
    if (!sauverEssais(this.stockage, this.essais)) {
      this.informer('Enregistrement local impossible : exportez le journal pour ne pas perdre les essais.');
    }
    this.afficherEssais();
  }

  private afficherEssais(): void {
    this.nombre.textContent = String(this.essais.length);
    this.lignes.replaceChildren(
      ...[...this.essais].reverse().map((e) => {
        const tr = document.createElement('tr');
        const fausse = e.note_attendue !== '' && e.note_attendue !== 'silence' && e.note_detectee !== e.note_attendue;
        // Les changements sans attaque sont grisés : ils ne comptent pas dans le taux de bonnes notes.
        tr.classList.toggle('sans-attaque', e.attaque === false);
        tr.classList.toggle('fausse', (fausse && e.attaque !== false) || (e.faux_positifs ?? 0) > 0);
        if (e.attaque === false) tr.title = 'Changement de note sans attaque, pendant que la corde résonne';
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.dataset.id = String(e.id);
        supprimer.className = 'discret';
        supprimer.textContent = '×';
        supprimer.setAttribute('aria-label', `Supprimer l’essai n° ${e.id}`);
        const actions = document.createElement('td');
        actions.append(supprimer);
        tr.append(
          cellule(String(e.id)),
          cellule(e.scenario.split('-')[0]!),
          cellule(e.note_attendue || '—'),
          cellule(e.faux_positifs !== null ? `${e.faux_positifs} FP` : e.note_detectee),
          cellule(e.freq_mesuree_hz !== null ? formaterNombre(e.freq_mesuree_hz, 1) : ''),
          cellule(e.ecart_cents !== null ? formaterNombre(e.ecart_cents, 1) : ''),
          cellule(e.latence_ms !== null ? String(e.latence_ms) : e.attaque === false ? 'sans att.' : ''),
          cellule(new Date(e.date).toLocaleTimeString('fr-FR')),
          actions,
        );
        return tr;
      }),
    );

    const resumes = resumer(this.essais);
    this.blocResume.hidden = resumes.length === 0;
    this.resume.replaceChildren(
      ...resumes.map((r) => {
        const tr = document.createElement('tr');
        const pourcent = (part: number) => `${Math.round(part * 100)} %`;
        tr.append(
          cellule(r.scenario.split('-')[0]!),
          cellule(String(r.essais)),
          cellule(r.attaquesEvaluees ? `${r.bonnesNotes}/${r.attaquesEvaluees} (${pourcent(r.bonnesNotes / r.attaquesEvaluees)})` : '—'),
          cellule(r.ecartMoyenAbsCents !== null ? `${formaterNombre(r.ecartMoyenAbsCents, 1)} c` : '—'),
          cellule(r.latenceMedianeMs !== null ? `${r.latenceMedianeMs} ms` : '—'),
          cellule(r.partLatenceOk !== null ? pourcent(r.partLatenceOk) : '—'),
          cellule(String(r.octavesErronees)),
          cellule(String(r.changementsSansAttaque)),
          cellule(r.fauxPositifs !== null ? String(r.fauxPositifs) : '—'),
        );
        return tr;
      }),
    );
  }

  private synchroniserNoteAttendue(): void {
    this.noteAttendue.readOnly = this.suivreAccordeur.checked;
    if (!this.suivreAccordeur.checked) return;
    const note = this.deps.noteVisee() ?? '';
    if (this.noteAttendue.value !== note) this.noteAttendue.value = note;
  }

  private informer(texte: string): void {
    this.message.textContent = texte;
  }

  private restaurerFormulaire(): void {
    try {
      const brut = this.stockage?.getItem(CLE_FORMULAIRE);
      if (!brut) return;
      const f = JSON.parse(brut) as Partial<Formulaire>;
      if (f.scenario && SCENARIOS.some((s) => s.id === f.scenario)) this.scenario.value = f.scenario;
      this.guitare.value = f.guitare ?? '';
      this.materiel.value = f.materiel ?? '';
      this.noteAttendue.value = f.noteAttendue ?? '';
      this.suivreAccordeur.checked = f.suivreAccordeur ?? false;
      this.automatique.checked = f.automatique ?? false;
    } catch {
      // Formulaire illisible : on garde les valeurs par défaut.
    }
  }

  private sauverFormulaire(): void {
    const f: Formulaire = {
      scenario: this.scenario.value,
      guitare: this.guitare.value,
      materiel: this.materiel.value,
      noteAttendue: this.noteAttendue.value,
      suivreAccordeur: this.suivreAccordeur.checked,
      automatique: this.automatique.checked,
    };
    try {
      this.stockage?.setItem(CLE_FORMULAIRE, JSON.stringify(f));
    } catch {
      // Confort uniquement : sans stockage, le formulaire repart vide au rechargement.
    }
  }
}
