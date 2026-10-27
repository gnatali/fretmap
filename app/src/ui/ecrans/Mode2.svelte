<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EtatDetection } from '../../audio/pitch';
  import { Ecoute } from '../../ecoute.svelte';
  import type { EtatApp } from '../../etat.svelte';
  import { nomAffiche } from '../../music/notation';
  import type { NoteDetectee } from '../../music/notes';
  import type { Niveau } from '../../progression/modele';
  import { caseMaxDuNiveau, contenuNiveau, positionsDuNiveau } from '../../progression/niveaux';
  import { poidsDuMode } from '../../progression/statistiques';
  import { SCORE_INITIAL, noter } from '../../quiz/score';
  import { tirerQuestion, type Question } from '../../quiz/tirage';
  import { SuiviMode2, type EvenementMode2 } from '../../quiz/validation';
  import BarreNiveau from '../composants/BarreNiveau.svelte';
  import Manche from '../composants/Manche.svelte';
  import Micro from '../composants/Micro.svelte';
  import ReglagesQuiz from '../composants/ReglagesQuiz.svelte';
  import ScoreSession from '../composants/ScoreSession.svelte';
  import { TEXTES } from '../textes';

  /** Délai avant la question suivante après une note juste (spec §5.2). */
  const DELAI_SUIVANTE_MS = 1000;
  /** Erreurs consécutives sur une question avant le rappel de la position sur le manche (spec §5.2). */
  const ERREURS_AVANT_RAPPEL = 3;
  /** Réponses gardées dans l'historique affiché. */
  const TAILLE_HISTORIQUE = 5;

  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
    /** Nombre dans [0, 1[ pour les tirages (injectable pour les tests). */
    hasard?: () => number;
    /** Écoute du micro (injectable pour les tests). */
    ecoute?: Ecoute;
  }

  let { etat, onQuitter, hasard = Math.random, ecoute: ecouteFournie }: Props = $props();

  // svelte-ignore state_referenced_locally
  const ecoute =
    ecouteFournie ?? new Ecoute(etat.progression.reglages, (seuil) => etat.definirReglage('seuilSilenceDb', seuil));
  const suivi = new SuiviMode2();

  // Comme en mode 1 : niveau atteint dans ce mode, ou niveau inférieur pour s'entraîner.
  // svelte-ignore state_referenced_locally
  let niveau = $state<Niveau>(etat.progression.avancement[2].niveauAtteint);
  const premiere = nouvelleQuestion();
  suivi.poser(premiere);
  let question = $state<Question>(premiere);
  let score = $state({ ...SCORE_INITIAL });
  let retour = $state<{ type: 'juste' | 'faux' | 'info'; texte: string } | null>(null);
  let erreursConsecutives = $state(0);
  let historique = $state<{ id: number; juste: boolean; texte: string }[]>([]);
  let entendue = $state.raw<NoteDetectee | null>(null);
  let silenceProlonge = $state(false);
  /** Message du dernier niveau débloqué pendant la session. */
  let annonce = $state<string | null>(null);
  /** Après une note juste, le temps d'afficher le retour : les détections sont ignorées. */
  let enAttente = false;
  let numeroReponse = 0;
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  const reglages = $derived(etat.progression.reglages);
  const notation = $derived(reglages.notation);
  const libelle = (note: NoteDetectee) => nomAffiche(note.nom, notation, note.octave);

  function nouvelleQuestion(precedente?: Question): Question {
    const poids = poidsDuMode(etat.progression.statistiques, 2);
    return tirerQuestion(positionsDuNiveau(niveau, 2), { ...contenuNiveau(niveau), poids }, hasard, precedente);
  }

  /** Nouvelle question ; la précédente sert à ne pas la reposer et à ignorer sa note encore sonore. */
  function suivante(precedente?: Question): void {
    clearTimeout(minuteur);
    minuteur = undefined;
    question = nouvelleQuestion(precedente);
    suivi.poser(question, precedente ?? null);
    retour = null;
    erreursConsecutives = 0;
    enAttente = false;
  }

  function traiter(detection: EtatDetection): void {
    if (detection.stable) entendue = detection.stable;
    if (enAttente) return;
    const evenement = suivi.traiter(detection, {
      tolerance: reglages.tolerance,
      octaveStricte: reglages.octaveStricte,
    });
    silenceProlonge = suivi.silenceProlonge(detection.tMs);
    if (evenement) appliquer(evenement);
  }

  function appliquer(evenement: EvenementMode2): void {
    if (evenement.type === 'nonReconnue') {
      retour = { type: 'info', texte: TEXTES.mode2.nonReconnue };
      return;
    }
    if (evenement.type === 'ancienneNote') {
      retour = { type: 'info', texte: TEXTES.mode2.ancienneNote(libelle(evenement.note)) };
      return;
    }
    // Chaque note jouée est une réponse, juste ou fausse ; la question reste posée jusqu'à la bonne note.
    const { juste, note, tempsMs } = evenement;
    score = noter(score, juste);
    // Le micro ne vérifie pas la corde : la réponse est comptée sur la position demandée (spec §5.2).
    const debloque = etat.repondre({ mode: 2, position: question.position, juste, tempsMs, date: new Date() }, niveau);
    if (debloque) annonce = TEXTES.quiz.debloque(debloque, TEXTES.niveaux[debloque]!);
    historique = [
      {
        id: ++numeroReponse,
        juste,
        texte: TEXTES.mode2.reponse(juste, libelle(note), nomAffiche(question.nom, notation)),
      },
      ...historique,
    ].slice(0, TAILLE_HISTORIQUE);
    if (juste) {
      retour = { type: 'juste', texte: TEXTES.mode2.juste(libelle(note), note.centsExacts) };
      if (reglages.retourSonore) ecoute.bip();
    } else {
      retour = { type: 'faux', texte: TEXTES.mode2.faux(libelle(note)) };
      erreursConsecutives++;
    }
    // Question suivante après une note juste, ou quand le niveau suivant vient d'être débloqué : il commence alors.
    if (juste || debloque) {
      enAttente = true;
      const precedente = question;
      minuteur = setTimeout(() => {
        if (debloque) niveau = debloque;
        suivante(precedente);
      }, DELAI_SUIVANTE_MS);
    }
  }

  ecoute.ecouter(traiter);
  onDestroy(() => {
    clearTimeout(minuteur);
    ecoute.ecouter(null);
  });
</script>

<header class="barre">
  <h1>{TEXTES.mode2.titre}</h1>
  <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.arreter}</button>
</header>

{#if annonce}<p class="annonce" aria-live="polite">{annonce}</p>{/if}

<ReglagesQuiz
  {niveau}
  avancement={etat.progression.avancement[2]}
  onNiveau={(n) => {
    niveau = n;
    annonce = null;
    suivante();
  }}
>
  <label>
    <input
      type="checkbox"
      checked={reglages.afficherCaseMode2}
      onchange={(e) => etat.definirReglage('afficherCaseMode2', e.currentTarget.checked)}
    />
    {TEXTES.mode2.afficherCase}
  </label>
</ReglagesQuiz>

<Micro
  {ecoute}
  onDemarrer={() => suivi.poser(question)}
  onInterruption={() => {
    if (enAttente) suivante(question);
  }}
/>

<p class="question" aria-live="polite">
  {TEXTES.mode2.question} <strong class="nom">{nomAffiche(question.nom, notation)}</strong>
  {#if question.cordeDemandee}
    {TEXTES.mode2.surLaCorde} <strong>{question.position.corde}</strong>{#if reglages.afficherCaseMode2},
      <strong>{TEXTES.mode2.caseDemandee(question.position.case)}</strong>{/if}
  {:else}
    {TEXTES.mode2.aVide}
  {/if}
</p>
<p class="consigne">{TEXTES.mode2.consigne}</p>

<p class="retour {retour?.type ?? ''}" role="status">
  {#if ecoute.statut === 'calibrage'}
    {TEXTES.micro.calibrage}
  {:else if retour}
    {#if retour.type !== 'info'}<span aria-hidden="true">{retour.type === 'juste' ? '✓' : '✗'}</span>{/if}
    {retour.texte}
  {:else if silenceProlonge && ecoute.statut === 'actif'}
    {TEXTES.mode2.jouez}
  {/if}
</p>

{#if erreursConsecutives >= ERREURS_AVANT_RAPPEL}
  <p class="rappel">
    {TEXTES.mode2.rappel(
      nomAffiche(question.nom, notation),
      question.positionsCorrectes,
      question.cordeDemandee,
      question.position.corde,
    )}
  </p>
  <Manche
    caseMax={caseMaxDuNiveau(niveau, 2)}
    {notation}
    cordeEnEvidence={question.cordeDemandee ? question.position.corde : null}
    marques={Object.fromEntries(question.positionsCorrectes.map((p) => [`${p.corde}-${p.case}`, 'attendue' as const]))}
    desactive
    onToucher={() => {}}
  />
{/if}

{#if ecoute.statut !== 'arrete'}
  <section class="direct" aria-label={TEXTES.mode2.enDirect}>
    <p class="entendue">
      <span class="etiquette">{TEXTES.mode2.enDirect}</span>
      <strong class:ancienne={!ecoute.detection?.stable}
        >{entendue ? libelle(entendue) : TEXTES.mode2.aucuneNote}</strong
      >
      {#if entendue}
        <span>{TEXTES.mode2.frequence(entendue.frequence)}</span>
        <span>{TEXTES.mode2.cents(entendue.centsExacts)}</span>
      {/if}
    </p>
    <BarreNiveau niveauDbfs={ecoute.detection?.niveauDbfs ?? null} seuilDbfs={ecoute.seuilDbfs} />
  </section>
{/if}

<ScoreSession {score} />

{#if historique.length > 0}
  <h2 class="historique-titre">{TEXTES.mode2.historique}</h2>
  <ol class="historique">
    {#each historique as r (r.id)}
      <li class:juste={r.juste} class:faux={!r.juste}>
        <span aria-hidden="true">{r.juste ? '✓' : '✗'}</span>
        {r.texte}
      </li>
    {/each}
  </ol>
{/if}

{#if !etat.sauvegardeOk}<p class="alerte">{TEXTES.sauvegardeImpossible}</p>{/if}

<style>
  .question {
    margin: 0.5rem 0 0;
    font-size: 1.25rem;
  }
  .nom {
    font-size: 1.75rem;
  }
  .consigne {
    margin: 0.25rem 0 0;
    font-size: 0.9375rem;
    color: var(--discret);
  }
  .retour {
    min-height: 1.75rem;
    margin: 0.5rem 0;
    font-weight: 600;
  }
  .retour.juste {
    color: var(--juste);
  }
  .retour.faux {
    color: var(--faux);
  }
  .rappel {
    margin: 0 0 0.5rem;
  }
  .direct {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 10px;
  }
  .entendue {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
    margin: 0;
  }
  .etiquette {
    width: 100%;
    font-size: 0.875rem;
    color: var(--discret);
  }
  .entendue strong {
    font-size: 1.5rem;
  }
  .entendue strong.ancienne {
    color: var(--discret);
  }
  .historique-titre {
    margin: 1rem 0 0.25rem;
    font-size: 1rem;
  }
  .historique {
    margin: 0;
    padding-left: 1.25rem;
  }
  .historique .juste span {
    color: var(--juste);
  }
  .historique .faux span {
    color: var(--faux);
  }
</style>
