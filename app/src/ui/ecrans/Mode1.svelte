<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EtatApp } from '../../etat.svelte';
  import type { Position } from '../../music/manche';
  import { NOTATIONS, nomAffiche, type Notation } from '../../music/notation';
  import type { Niveau } from '../../progression/modele';
  import { NIVEAUX, contenuNiveau, positionsDuNiveau } from '../../progression/niveaux';
  import { SCORE_INITIAL, noter, pourcentage } from '../../quiz/score';
  import { tirerQuestion, type Question } from '../../quiz/tirage';
  import { verifierMode1 } from '../../quiz/validation';
  import Manche, { type Marque } from '../composants/Manche.svelte';
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

<div class="reglages">
  <label>
    {TEXTES.mode1.niveau}
    <select bind:value={niveau} onchange={() => suivante()}>
      {#each NIVEAUX as n (n.niveau)}
        <option value={n.niveau}>{TEXTES.mode1.nomNiveau(n.niveau, TEXTES.niveaux[n.niveau]!)}</option>
      {/each}
    </select>
  </label>
  <label>
    {TEXTES.mode1.notation}
    <select value={notation} onchange={(e) => etat.definirReglage('notation', e.currentTarget.value as Notation)}>
      {#each NOTATIONS as n (n)}
        <option value={n}>{TEXTES.notations[n]}</option>
      {/each}
    </select>
  </label>
  <label class="case-a-cocher">
    <input
      type="checkbox"
      checked={etat.progression.reglages.afficherNotes}
      onchange={(e) => etat.definirReglage('afficherNotes', e.currentTarget.checked)}
    />
    {TEXTES.mode1.afficherNotes}
  </label>
</div>

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

<p class="score">
  <span>{TEXTES.mode1.score(score.bonnes, score.questions)}</span>
  <span>{TEXTES.mode1.pourcentage(pourcentage(score))}</span>
  <span>{TEXTES.mode1.serie(score.serie, score.meilleureSerie)}</span>
</p>

{#if !etat.sauvegardeOk}<p class="alerte">{TEXTES.sauvegardeImpossible}</p>{/if}

<style>
  .barre {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .reglages {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  select {
    min-height: 44px;
    max-width: 100%;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  .case-a-cocher input {
    width: 1.25rem;
    height: 1.25rem;
  }
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
  .score {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin-top: 1rem;
    color: var(--discret);
  }
</style>
