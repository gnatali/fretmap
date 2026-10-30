<script lang="ts">
  import { REGLES_FAUSSE_NOTE, type RegleFausseNote, type ReglagesPartie } from '../../jeu/partie';
  import type { ReglagesProgressif } from '../../jeu/progressif/reglages';
  import { MODES_JEU, type ModeJeu, type ProgressionProgressive } from '../../jeu/stockage';
  import { DUREE_CHUTE_MAX_MS, DUREE_CHUTE_MIN_MS } from '../../jeu/vitesse';
  import { NOTATIONS, type Notation } from '../../music/notation';
  import type { Niveau } from '../../progression/modele';
  import { NIVEAUX } from '../../progression/niveaux';
  import ReglagesProgressifs from '../composants/ReglagesProgressif.svelte';
  import { TEXTES, duree } from '../textes';

  // Écran de départ (spec §6.1, §16) : mode de jeu, puis ses réglages (classique : niveau, durée de chute, règle de
  // la fausse note ; progressif : méthodes et seuils), notation, options de mesure, démarrage (reprise du mode
  // progressif), journal. Chaque choix est enregistré tout de suite par l'appelant.

  /** Pas du curseur de durée de chute, en ms : 0,5 s (spec §6.1). */
  const PAS_DUREE_MS = 500;
  const URL_SPEC = 'https://github.com/gnatali/fretmap/blob/main/docs/specs-poc-chute.md';

  interface Props {
    modeJeu: ModeJeu;
    reglages: ReglagesPartie;
    reglagesProgressif: ReglagesProgressif;
    /** Progression enregistrée du mode progressif, ou null. */
    progression: ProgressionProgressive | null;
    /** Partie au clavier, sans micro (`?simulation`). */
    simulation: boolean;
    /** Échec du dernier démarrage du micro (refus, micro introuvable…). */
    erreurMicro: string | null;
    /** Parties dans le journal. */
    parties: number;
    onMode: (mode: ModeJeu) => void;
    onReglages: (reglages: ReglagesPartie) => void;
    onReglagesProgressif: (reglages: ReglagesProgressif) => void;
    /** Mode classique. */
    onDemarrer: () => void;
    /** Mode progressif : reprise de la progression enregistrée, ou départ aux cordes à vide. */
    onDemarrerProgressif: (reprise: boolean) => void;
    onExporter: () => void;
    onVider: () => void;
  }

  let {
    modeJeu,
    reglages,
    reglagesProgressif,
    progression,
    simulation,
    erreurMicro,
    parties,
    onMode,
    onReglages,
    onReglagesProgressif,
    onDemarrer,
    onDemarrerProgressif,
    onExporter,
    onVider,
  }: Props = $props();

  let confirmation = $state(false);
  let confirmationRecommencer = $state(false);
  let message = $state<string | null>(null);

  function changer<C extends keyof ReglagesPartie>(cle: C, valeur: ReglagesPartie[C]): void {
    onReglages({ ...reglages, [cle]: valeur });
  }

  function vider(): void {
    onVider();
    confirmation = false;
    message = TEXTES.depart.journalVide;
  }
</script>

<header>
  <h1>{TEXTES.titre}</h1>
  <p class="sous-titre">{TEXTES.sousTitre}</p>
</header>

<form class="reglages" onsubmit={(e) => e.preventDefault()}>
  <label>
    {TEXTES.depart.modeJeu}
    <select value={modeJeu} onchange={(e) => onMode(e.currentTarget.value as ModeJeu)}>
      {#each MODES_JEU as mode (mode)}
        <option value={mode}>{TEXTES.modes[mode]}</option>
      {/each}
    </select>
  </label>

  {#if modeJeu === 'progressif'}
    <ReglagesProgressifs reglages={reglagesProgressif} onChange={onReglagesProgressif} />
  {:else}
    <label>
      {TEXTES.depart.niveau}
      <select value={reglages.niveau} onchange={(e) => changer('niveau', Number(e.currentTarget.value) as Niveau)}>
        {#each NIVEAUX as n (n.niveau)}
          <option value={n.niveau}>{TEXTES.nomNiveau(n.niveau, TEXTES.niveaux[n.niveau]!)}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>{TEXTES.depart.dureeChute} : <strong class="duree">{duree(reglages.dureeInitialeMs)}</strong></span>
      <input
        type="range"
        min={DUREE_CHUTE_MIN_MS}
        max={DUREE_CHUTE_MAX_MS}
        step={PAS_DUREE_MS}
        value={reglages.dureeInitialeMs}
        oninput={(e) => changer('dureeInitialeMs', Number(e.currentTarget.value))}
      />
    </label>

    <label>
      {TEXTES.depart.fausseNote}
      <select
        value={reglages.fausseNote}
        onchange={(e) => changer('fausseNote', e.currentTarget.value as RegleFausseNote)}
      >
        {#each REGLES_FAUSSE_NOTE as regle (regle)}
          <option value={regle}>{TEXTES.reglesFausseNote[regle]}</option>
        {/each}
      </select>
    </label>
  {/if}

  <label>
    {TEXTES.depart.notation}
    <select value={reglages.notation} onchange={(e) => changer('notation', e.currentTarget.value as Notation)}>
      {#each NOTATIONS as notation (notation)}
        <option value={notation}>{TEXTES.notations[notation]}</option>
      {/each}
    </select>
  </label>

  <details>
    <summary>{TEXTES.depart.optionsMesure}</summary>
    <label class="case-a-cocher">
      <input
        type="checkbox"
        checked={reglages.afficherCase}
        onchange={(e) => changer('afficherCase', e.currentTarget.checked)}
      />
      {TEXTES.depart.afficherCase}
    </label>
    {#if modeJeu === 'classique'}
      <label class="case-a-cocher">
        <input
          type="checkbox"
          checked={reglages.vitesseFixe}
          onchange={(e) => changer('vitesseFixe', e.currentTarget.checked)}
        />
        {TEXTES.depart.vitesseFixe}
      </label>
    {/if}
  </details>
</form>

<section class="demarrage">
  {#if !simulation}
    <p class="aide">{TEXTES.micro.explication}</p>
    <p class="aide">{TEXTES.depart.accordez}</p>
  {/if}
  {#if modeJeu === 'classique'}
    <button type="button" class="principal" onclick={onDemarrer}>
      {simulation ? TEXTES.depart.demarrerSimulation : TEXTES.depart.demarrer}
    </button>
  {:else if progression}
    <button type="button" class="principal" onclick={() => onDemarrerProgressif(true)}>
      {TEXTES.depart.reprendre(progression.niveau, progression.positions.length, simulation)}
    </button>
    <button type="button" class="secondaire" onclick={() => (confirmationRecommencer = true)}>
      {TEXTES.depart.recommencer}
    </button>
    {#if confirmationRecommencer}
      <div class="confirmation" role="alertdialog" aria-labelledby="question-recommencer">
        <p id="question-recommencer">{TEXTES.depart.confirmerRecommencer(progression.niveau)}</p>
        <div class="boutons">
          <button type="button" class="principal" onclick={() => onDemarrerProgressif(false)}>
            {TEXTES.depart.confirmer}
          </button>
          <button type="button" class="secondaire" onclick={() => (confirmationRecommencer = false)}>
            {TEXTES.depart.annuler}
          </button>
        </div>
      </div>
    {/if}
  {:else}
    <button type="button" class="principal" onclick={() => onDemarrerProgressif(false)}>
      {TEXTES.depart.commencer(simulation)}
    </button>
  {/if}
  {#if simulation}<p class="aide">{TEXTES.depart.aideSimulation}</p>{/if}
  {#if erreurMicro}<p class="alerte" role="alert">{erreurMicro}</p>{/if}
</section>

<section class="journal">
  <h2>{TEXTES.depart.journal}</h2>
  <div class="boutons">
    <button type="button" class="secondaire" disabled={parties === 0} onclick={onExporter}>
      {TEXTES.depart.exporter(parties)}
    </button>
    <button
      type="button"
      class="secondaire"
      disabled={parties === 0}
      onclick={() => {
        confirmation = true;
        message = null;
      }}
    >
      {TEXTES.depart.vider}
    </button>
  </div>
  {#if confirmation}
    <div class="confirmation" role="alertdialog" aria-labelledby="question-vider">
      <p id="question-vider">{TEXTES.depart.confirmerVider}</p>
      <div class="boutons">
        <button type="button" class="principal" onclick={vider}>{TEXTES.depart.effacer}</button>
        <button type="button" class="secondaire" onclick={() => (confirmation = false)}>{TEXTES.depart.annuler}</button>
      </div>
    </div>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
</section>

<ul class="liens">
  <li><a class="lien" href={URL_SPEC}>{TEXTES.lienSpec}</a></li>
  <li><a class="lien" href="../">{TEXTES.lienApplication}</a></li>
</ul>

<style>
  h1 {
    margin: 0;
    font-size: 2rem;
  }
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
  }
  .sous-titre {
    margin: 0.25rem 0 0;
    color: var(--discret);
  }
  .reglages {
    display: grid;
    /* minmax(0, 1fr) : une option longue ne doit pas élargir la colonne au-delà de l'écran (360 px). */
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }
  .reglages > label {
    display: grid;
    gap: 0.25rem;
    font-weight: 600;
  }
  select,
  input[type='range'] {
    min-height: 44px;
    font: inherit;
    font-weight: 400;
  }
  select {
    width: 100%;
    padding: 0 0.5rem;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--lien);
  }
  summary {
    padding: 0.625rem 0;
    cursor: pointer;
    font-weight: 600;
  }
  .case-a-cocher {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  .case-a-cocher input {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
  .demarrage {
    display: grid;
    gap: 0.5rem;
  }
  .demarrage .principal {
    min-height: 52px;
    font-size: 1.125rem;
  }
  .aide {
    margin: 0;
    color: var(--discret);
  }
  .journal {
    margin-top: 2rem;
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .secondaire:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .confirmation {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--faux);
    border-radius: 8px;
  }
  .confirmation p {
    margin: 0 0 0.5rem;
  }
  .liens {
    list-style: none;
    margin: 1.5rem 0 0;
    padding: 0;
  }
  .lien {
    display: inline-block;
    min-height: 44px;
    line-height: 44px;
    color: var(--lien);
  }
</style>
