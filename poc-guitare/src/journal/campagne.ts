// Campagne de test guidée : programme des étapes et machine à états qui les enchaîne. Sans DOM.
import { DUREE_CALIBRAGE_MS } from '../audio/niveau';
import type { EtatDetection } from '../audio/pitch';
import { ACCORDAGE_STANDARD, cordes } from '../music/accordages';
import { midiVersNote } from '../music/notes';
import { DUREE_TEST_SILENCE_MS, SCENARIOS, SCENARIOS_BRUIT, SCENARIO_SILENCE, TestSilence, type ContexteNote } from './essais';

/** Délai après une attaque sans note stable avant de la compter « non détectée », en ms. Valeur initiale 1,5 s. */
export const DELAI_NON_DETECTION_MS = 1500;
/** Durée d'affichage de l'annonce d'un scénario avant ses premières notes, en ms. */
export const DUREE_ANNONCE_MS = 3000;
/** Durée moyenne d'une attaque (jouer, laisser sonner, préparer la suivante), pour estimer la durée, en s. */
const SECONDES_PAR_ATTAQUE = 2;
/** Cases jouées dans les scénarios 3 et 5. */
const CASES = [1, 2, 3, 4, 5] as const;

export type NumeroScenario = 1 | 2 | 3 | 4 | 5;

export interface OptionsCampagne {
  scenarios: readonly NumeroScenario[];
  /** Attaques par corde à vide (scénarios 1 et 2). */
  repetitionsCordes: number;
  /** Attaques par note (scénario 3). */
  essaisParCase: number;
  /** Notes tirées au hasard (scénario 5). */
  notesAuHasard: number;
  /** Graine du tirage du scénario 5, gardée pour pouvoir reprendre la même campagne. */
  graine: number;
}

export const OPTIONS_DEFAUT: Omit<OptionsCampagne, 'graine'> = {
  scenarios: [1, 2, 3, 4, 5],
  repetitionsCordes: 10,
  essaisParCase: 3,
  notesAuHasard: 20,
};

interface EtapeCommune {
  /** Nom du scénario, ou de la phase (« Préparation »). */
  titre: string;
  consigne: string;
}

export type Etape =
  | (EtapeCommune & { type: 'pause'; scenario: string | null })
  | (EtapeCommune & { type: 'calibrage' })
  | (EtapeCommune & { type: 'annonce'; scenario: string })
  | (EtapeCommune & {
      type: 'note';
      scenario: string;
      /** Où jouer la note : « Corde 6 à vide », « Corde 4, case 3 »… */
      indication: string;
      note: string;
      repetitions: number;
    })
  | (EtapeCommune & { type: 'silence'; scenario: string; dureeMs: number })
  | (EtapeCommune & { type: 'fin' });

export type Evenement =
  | { type: 'etape'; etape: Etape; index: number }
  | { type: 'resultat'; attendue: string; detectee: string; juste: boolean; cents: number | null; latenceMs: number | null }
  | { type: 'nonDetectee'; note: ContexteNote; comptee: boolean }
  | { type: 'silenceTermine'; notes: readonly string[] }
  | { type: 'calibrer' }
  | { type: 'fin' };

function idScenario(numero: NumeroScenario): string {
  return SCENARIOS[numero - 1]!.id;
}

function titreScenario(numero: NumeroScenario): string {
  return `Scénario ${SCENARIOS[numero - 1]!.nom}`;
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même tirage. */
export function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Programme complet de la campagne. L'ordre limite les pauses : le scénario bruyant passe en dernier. */
export function construireProgramme(options: OptionsCampagne): Etape[] {
  const choisis = new Set(options.scenarios);
  const cordesStandard = cordes(ACCORDAGE_STANDARD);
  const etapes: Etape[] = [
    {
      type: 'pause',
      scenario: null,
      titre: 'Préparation',
      consigne:
        'Accordez la guitare avec un accordeur de référence. Installez-vous dans une pièce calme, ' +
        'l’appareil à environ 50 cm de la guitare. Après « Continuer », ne jouez pas pendant 2 s.',
    },
    { type: 'calibrage', titre: 'Mesure du bruit ambiant', consigne: 'Ne jouez pas : mesure du bruit ambiant.' },
  ];

  const cordesAVide = (numero: NumeroScenario): Etape[] =>
    cordesStandard.map((c) => ({
      type: 'note',
      scenario: idScenario(numero),
      titre: titreScenario(numero),
      indication: `Corde ${c.numero} à vide`,
      note: c.note,
      repetitions: options.repetitionsCordes,
      consigne: 'Laissez sonner environ 1 s entre deux attaques.',
    }));

  if (choisis.has(1)) {
    etapes.push(
      {
        type: 'annonce',
        scenario: idScenario(1),
        titre: titreScenario(1),
        consigne: `Jouez chaque corde à vide ${options.repetitionsCordes} fois, de la plus grave à la plus aiguë.`,
      },
      ...cordesAVide(1),
    );
  }

  if (choisis.has(3)) {
    etapes.push({
      type: 'annonce',
      scenario: idScenario(3),
      titre: titreScenario(3),
      consigne: `Jouez chaque note ${options.essaisParCase} fois, cases 1 à 5 de chaque corde.`,
    });
    for (const c of cordesStandard) {
      for (const numeroCase of CASES) {
        etapes.push({
          type: 'note',
          scenario: idScenario(3),
          titre: titreScenario(3),
          indication: `Corde ${c.numero}, case ${numeroCase}`,
          note: midiVersNote(c.midi + numeroCase).libelle,
          repetitions: options.essaisParCase,
          consigne: 'Laissez sonner environ 1 s entre deux attaques.',
        });
      }
    }
  }

  if (choisis.has(5)) {
    etapes.push({
      type: 'annonce',
      scenario: idScenario(5),
      titre: titreScenario(5),
      consigne: 'Jouez chaque note affichée où vous voulez, naturellement : vibrato léger, arrêts rapides.',
    });
    // Toutes les notes jouables sur les cordes à vide et les cases 1 à 5 (E2 à A4).
    const midis = [...new Set(cordesStandard.flatMap((c) => [0, ...CASES].map((k) => c.midi + k)))].sort((a, b) => a - b);
    const hasard = aleatoire(options.graine);
    let precedente: number | null = null;
    for (let i = 0; i < options.notesAuHasard; i++) {
      const candidates = midis.filter((m) => m !== precedente);
      const midi = candidates[Math.floor(hasard() * candidates.length)]!;
      precedente = midi;
      etapes.push({
        type: 'note',
        scenario: idScenario(5),
        titre: titreScenario(5),
        indication: 'Où vous voulez sur le manche',
        note: midiVersNote(midi).libelle,
        repetitions: 1,
        consigne: 'Une seule fois, naturellement.',
      });
    }
  }

  if (choisis.has(4)) {
    etapes.push(
      {
        type: 'pause',
        scenario: idScenario(4),
        titre: titreScenario(4),
        consigne: `Étouffez les cordes avec la main, puis ne touchez plus la guitare pendant ${DUREE_TEST_SILENCE_MS / 1000} s.`,
      },
      {
        type: 'silence',
        scenario: SCENARIO_SILENCE,
        titre: titreScenario(4),
        consigne: 'Silence : ne jouez pas, ne parlez pas.',
        dureeMs: DUREE_TEST_SILENCE_MS,
      },
    );
  }

  if (choisis.has(2)) {
    etapes.push(
      {
        type: 'pause',
        scenario: idScenario(2),
        titre: titreScenario(2),
        consigne: 'Allumez un ventilateur ou lancez une conversation à côté, puis continuez.',
      },
      ...cordesAVide(2),
    );
  }

  etapes.push({
    type: 'fin',
    titre: 'Campagne terminée',
    consigne: choisis.has(2)
      ? 'Éteignez la source de bruit. Exportez le journal pour l’analyse.'
      : 'Exportez le journal pour l’analyse.',
  });
  return etapes;
}

/** Durée estimée de la campagne, en minutes (arrondie à l'unité supérieure). */
export function estimerDureeMinutes(programme: readonly Etape[]): number {
  let secondes = 0;
  for (const e of programme) {
    if (e.type === 'note') secondes += e.repetitions * SECONDES_PAR_ATTAQUE;
    else if (e.type === 'silence') secondes += e.dureeMs / 1000;
    else if (e.type === 'annonce') secondes += DUREE_ANNONCE_MS / 1000;
    else if (e.type === 'calibrage') secondes += DUREE_CALIBRAGE_MS / 1000;
  }
  return Math.ceil(secondes / 60);
}

/**
 * Enchaîne les étapes d'un programme à partir du flux de détection.
 * Une étape « note » compte une répétition par note jouée (nouvelle note stable après une attaque) ou par attaque
 * restée sans note pendant DELAI_NON_DETECTION_MS (sauf en scénario bruyant) ; les changements sans attaque ne
 * comptent pas. Les annonces, le calibrage et le silence passent seuls ; seules les pauses attendent continuer().
 */
export class Campagne {
  private indexCourant = -1;
  private debutEtape = 0;
  private repetitions = 0;
  private attaqueSansNote: number | null = null;
  private silence: TestSilence | null = null;

  constructor(readonly programme: readonly Etape[]) {}

  get index(): number {
    return this.indexCourant;
  }

  get etape(): Etape | null {
    return this.programme[this.indexCourant] ?? null;
  }

  get repetitionsFaites(): number {
    return this.repetitions;
  }

  get terminee(): boolean {
    return this.etape?.type === 'fin';
  }

  /** Démarre la campagne (ou la reprend à l'étape `index`, depuis son début). */
  demarrer(tMs: number, index = 0): Evenement[] {
    return this.aller(Math.max(0, Math.min(index, this.programme.length - 1)), tMs);
  }

  /** Recommence l'étape en cours, par exemple après une coupure du micro. */
  reprendreEtape(tMs: number): Evenement[] {
    return this.aller(this.indexCourant, tMs);
  }

  /** Scénario et note attendue de l'étape en cours ; null hors étape de jeu (rien n'est alors enregistré). */
  contexte(): ContexteNote | null {
    const e = this.etape;
    if (e?.type === 'note') return { scenario: e.scenario, noteAttendue: e.note };
    if (e?.type === 'silence') return { scenario: SCENARIO_SILENCE, noteAttendue: '' };
    return null;
  }

  /** Avancement : étape courante et part des attaques prévues déjà faites ou passées (0 à 1). */
  progression(): { index: number; total: number; part: number } {
    let prevues = 0;
    let faites = 0;
    this.programme.forEach((e, i) => {
      if (e.type !== 'note') return;
      prevues += e.repetitions;
      if (i < this.indexCourant) faites += e.repetitions;
      else if (i === this.indexCourant) faites += this.repetitions;
    });
    return {
      index: this.indexCourant,
      total: this.programme.length,
      part: this.terminee ? 1 : prevues ? faites / prevues : 0,
    };
  }

  /** Temps restant de l'étape en cours si elle est minutée (annonce, silence), en ms. */
  resteMs(tMs: number): number | null {
    const e = this.etape;
    if (e?.type === 'annonce') return Math.max(0, DUREE_ANNONCE_MS - (tMs - this.debutEtape));
    if (e?.type === 'silence') return this.silence?.resteMs(tMs) ?? null;
    return null;
  }

  continuer(tMs: number): Evenement[] {
    return this.etape?.type === 'pause' ? this.aller(this.indexCourant + 1, tMs) : [];
  }

  passer(tMs: number): Evenement[] {
    return this.etape && !this.terminee ? this.aller(this.indexCourant + 1, tMs) : [];
  }

  calibrageTermine(tMs: number): Evenement[] {
    return this.etape?.type === 'calibrage' ? this.aller(this.indexCourant + 1, tMs) : [];
  }

  traiter(etat: EtatDetection): Evenement[] {
    const e = this.etape;
    if (!e) return [];
    const t = etat.tMs;
    switch (e.type) {
      case 'annonce':
        return t - this.debutEtape >= DUREE_ANNONCE_MS ? this.aller(this.indexCourant + 1, t) : [];
      case 'silence':
        if (!this.silence?.traiter(etat)) return [];
        return [{ type: 'silenceTermine', notes: [...this.silence.notesParasites] }, ...this.aller(this.indexCourant + 1, t)];
      case 'note':
        return this.traiterNote(e, etat);
      default:
        return [];
    }
  }

  private traiterNote(e: Extract<Etape, { type: 'note' }>, etat: EtatDetection): Evenement[] {
    const t = etat.tMs;
    if (etat.attaque) this.attaqueSansNote = t;
    if (etat.nouvelleNoteStable && etat.stable && etat.apresAttaque) {
      this.attaqueSansNote = null;
      const juste = etat.stable.libelle === e.note;
      return [
        {
          type: 'resultat',
          attendue: e.note,
          detectee: etat.stable.libelle,
          juste,
          cents: juste ? etat.stable.centsExacts : null,
          latenceMs: etat.latenceMs,
        },
        ...this.compter(e, t),
      ];
    }
    if (this.attaqueSansNote !== null && t - this.attaqueSansNote >= DELAI_NON_DETECTION_MS) {
      this.attaqueSansNote = null;
      const comptee = !SCENARIOS_BRUIT.includes(e.scenario);
      const evenement: Evenement = { type: 'nonDetectee', note: { scenario: e.scenario, noteAttendue: e.note }, comptee };
      return comptee ? [evenement, ...this.compter(e, t)] : [evenement];
    }
    return [];
  }

  private compter(e: Extract<Etape, { type: 'note' }>, tMs: number): Evenement[] {
    this.repetitions++;
    return this.repetitions >= e.repetitions ? this.aller(this.indexCourant + 1, tMs) : [];
  }

  private aller(index: number, tMs: number): Evenement[] {
    this.indexCourant = Math.min(index, this.programme.length - 1);
    this.debutEtape = tMs;
    this.repetitions = 0;
    this.attaqueSansNote = null;
    const etape = this.programme[this.indexCourant]!;
    this.silence = etape.type === 'silence' ? new TestSilence(tMs, etape.dureeMs) : null;
    const evenements: Evenement[] = [{ type: 'etape', etape, index: this.indexCourant }];
    if (etape.type === 'calibrage') evenements.push({ type: 'calibrer' });
    if (etape.type === 'fin') evenements.push({ type: 'fin' });
    return evenements;
  }
}
