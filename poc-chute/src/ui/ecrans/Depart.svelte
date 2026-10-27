<script lang="ts">
  import type { ReglagesPartie } from '../../jeu/partie';
  import { DUREE_CHUTE_MAX_MS, DUREE_CHUTE_MIN_MS } from '../../jeu/vitesse';
  import { NOTATIONS, type Notation } from '../../music/notation';
  import type { Niveau } from '../../progression/modele';
  import { NIVEAUX } from '../../progression/niveaux';
  import { TEXTES, duree } from '../textes';

  // Écran de départ (spec §6.1) : niveau, durée de chute, notation, options de mesure, démarrage du micro, journal.
  // Chaque choix est enregistré tout de suite par l'appelant.

  /** Pas du curseur de durée de chute, en ms : 0,5 s (spec §6.1). */
  const PAS_DUREE_MS = 500;
  const URL_SPEC = 'https://github.com/gnatali/fretmap/blob/main/docs/specs-poc-chute.md';

  interface Props {
    reglages: ReglagesPartie;
    /** Partie au clavier, sans micro (`?simulation`). */
    simulation: boolean;
    /** Échec du dernier démarrage du micro (refus, micro introuvable…). */
    erreurMicro: string | null;
    /** Parties dans le journal. */
    parties: number;
    onReglages: (reglages: ReglagesPartie) => void;
    onDemarrer: () => void;
    onExporter: () => void;
    onVider: () => void;
  }

  let { reglages, simulation, erreurMicro, parties, onReglages, onDemarrer, onExporter, onVider }: Props = $props();

  let confirmation = $state(false);
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
    <label class="case-a-cocher">
      <input
        type="checkbox"
        checked={reglages.vitesseFixe}
        onchange={(e) => changer('vitesseFixe', e.currentTarget.checked)}
      />
      {TEXTES.depart.vitesseFixe}
    </label>
  </details>
</form>

<section class="demarrage">
  {#if simulation}
    <button type="button" class="principal" onclick={onDemarrer}>{TEXTES.depart.demarrerSimulation}</button>
    <p class="aide">{TEXTES.depart.aideSimulation}</p>
  {:else}
    <p class="aide">{TEXTES.micro.explication}</p>
    <p class="aide">{TEXTES.depart.accordez}</p>
    <button type="button" class="principal" onclick={onDemarrer}>{TEXTES.depart.demarrer}</button>
    {#if erreurMicro}<p class="alerte" role="alert">{erreurMicro}</p>{/if}
  {/if}
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
    max-width: 100%;
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
