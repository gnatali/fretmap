<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EtatApp } from '../../etat.svelte';
  import type { Position } from '../../music/manche';
  import { nomAffiche } from '../../music/notation';
  import type { Niveau } from '../../progression/modele';
  import { contenuNiveau, positionsDuNiveau } from '../../progression/niveaux';
  import { SCORE_INITIAL, noter } from '../../quiz/score';
  import { tirerQuestion, type Question } from '../../quiz/tirage';
  import { verifierMode1 } from '../../quiz/validation';
  import Manche, { type Marque } from '../composants/Manche.svelte';
  import ReglagesQuiz from '../composants/ReglagesQuiz.svelte';
  import ScoreSession from '../composants/ScoreSession.svelte';
  import { TEXTES } from '../textes';

  /** Délai avant la question suivante (spec §5.1). */
  const DELAI_SUIVANTE_MS = 1000;

  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
    /** Nombre dans [0, 1[ pour les tirages (injectable pour les tests). */
    hasard?: () => number;
  }

  let { etat, onQuitter, hasard = Math.random }: Props = $props();

  // Niveau au choix jusqu'à la phase 6 (déverrouillage automatique).
  // svelte-ignore state_referenced_locally
  let niveau = $state<Niveau>(etat.progression.niveauActuel);
  const caseMax = $derived(contenuNiveau(niveau).caseMax);
  let question = $state<Question>(nouvelleQuestion());
  let debut = performance.now();
  let score = $state({ ...SCORE_INITIAL });
  let marques = $state<Record<string, Marque>>({});
  let retour = $state<{ juste: boolean; texte: string } | null>(null);
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const notation = $derived(etat.progression.reglages.notation);

  function nouvelleQuestion(precedente?: Question): Question {
    return tirerQuestion(positionsDuNiveau(niveau), contenuNiveau(niveau), hasard, precedente);
  }

  /** Nouvelle question ; sans reposer la précédente quand on reste au même niveau. */
  function suivante(precedente?: Question): void {
    clearTimeout(minuteur);
    minuteur = undefined;
    question = nouvelleQuestion(precedente);
    marques = {};
    retour = null;
    debut = performance.now();
  }

  function toucher(touchee: Position): void {
    if (retour) return;
    const tempsMs = performance.now() - debut;
    const { juste, positionsCorrectes } = verifierMode1(question, touchee);
    marques = juste
      ? { [`${touchee.corde}-${touchee.case}`]: 'juste' }
      : {
          ...Object.fromEntries(positionsCorrectes.map((p) => [`${p.corde}-${p.case}`, 'attendue' as const])),
          [`${touchee.corde}-${touchee.case}`]: 'faux',
        };
    retour = {
      juste,
      texte: juste
        ? TEXTES.mode1.juste
        : TEXTES.mode1.faux(nomAffiche(question.nom, notation), positionsCorrectes, question.cordeDemandee),
    };
    score = noter(score, juste);
    // Juste : la position touchée est connue (E sur la corde 1, ou la case 12) ; faux : la position tirée.
    etat.repondre({ mode: 1, position: juste ? touchee : question.position, juste, tempsMs, date: new Date() });
    const precedente = question;
    minuteur = setTimeout(() => suivante(precedente), DELAI_SUIVANTE_MS);
  }

  onDestroy(() => clearTimeout(minuteur));
</script>

<header class="barre">
  <h1>{TEXTES.mode1.titre}</h1>
  <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.arreter}</button>
</header>

<ReglagesQuiz
  {niveau}
  onNiveau={(n) => {
    niveau = n;
    suivante();
  }}
>
  <label>
    <input
      type="checkbox"
      checked={etat.progression.reglages.afficherNotes}
      onchange={(e) => etat.definirReglage('afficherNotes', e.currentTarget.checked)}
    />
    {TEXTES.mode1.afficherNotes}
  </label>
</ReglagesQuiz>

<p class="question" aria-live="polite">
  {TEXTES.mode1.question} <strong class="nom">{nomAffiche(question.nom, notation)}</strong>
  {#if question.cordeDemandee}{TEXTES.mode1.surLaCorde} <strong>{question.position.corde}</strong>{/if}
</p>

<p class="retour" class:juste={retour?.juste} class:faux={retour && !retour.juste} role="status">
  {#if retour}<span aria-hidden="true">{retour.juste ? '✓' : '✗'}</span> {retour.texte}{/if}
</p>

<Manche
  {caseMax}
  afficherNotes={etat.progression.reglages.afficherNotes}
  {notation}
  cordeEnEvidence={question.cordeDemandee ? question.position.corde : null}
  {marques}
  onToucher={toucher}
/>

<ScoreSession {score} />

{#if !etat.sauvegardeOk}<p class="alerte">{TEXTES.sauvegardeImpossible}</p>{/if}

<style>
  .question {
    margin: 0.5rem 0 0;
    font-size: 1.25rem;
  }
  .nom {
    font-size: 1.75rem;
  }
  .retour {
    min-height: 1.75rem;
    margin: 0.25rem 0 0.5rem;
    font-weight: 600;
  }
  .retour.juste {
    color: var(--juste);
  }
  .retour.faux {
    color: var(--faux);
  }
</style>
