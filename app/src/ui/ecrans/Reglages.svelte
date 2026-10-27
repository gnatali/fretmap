<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Ecoute } from '../../ecoute.svelte';
  import type { EtatApp } from '../../etat.svelte';
  import { NOTATIONS, nomAffiche, type Notation } from '../../music/notation';
  import { A4_MAX_HZ, A4_MIN_HZ, bornerA4 } from '../../music/notes';
  import { TOLERANCES, type Progression, type Tolerance } from '../../progression/modele';
  import { exporterJson, importerJson, nomFichierExport } from '../../progression/stockage';
  import { TEXTES } from '../textes';

  // Réglages (spec §5.4) : chaque changement est enregistré et s'applique tout de suite. Export et import de la
  // progression en JSON, réinitialisation avec confirmation (les réglages sont gardés).
  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
    /** Écoute du micro pour la mesure du bruit ambiant (injectable pour les tests). */
    ecoute?: Ecoute;
  }

  let { etat, onQuitter, ecoute: ecouteFournie }: Props = $props();

  // svelte-ignore state_referenced_locally
  const ecoute =
    ecouteFournie ?? new Ecoute(etat.progression.reglages, (seuil) => etat.definirReglage('seuilSilenceDb', seuil));

  const reglages = $derived(etat.progression.reglages);
  /** Seuil mesuré pendant cette visite de l'écran, pour le confirmer. */
  let seuilMesure = $state<number | null>(null);
  /** Confirmation en attente : import d'un fichier lu, ou réinitialisation. */
  let confirmation = $state<{ type: 'import'; progression: Progression } | { type: 'reinitialiser' } | null>(null);
  let message = $state<{ texte: string; erreur: boolean } | null>(null);
  let choixFichier: HTMLInputElement;

  // La mesure du bruit démarre le micro, qui calibre pendant 2 s ; dès que le seuil est fixé, le micro est coupé.
  $effect(() => {
    if (ecoute.statut !== 'actif') return;
    seuilMesure = ecoute.seuilDbfs;
    void ecoute.arreter();
  });
  onDestroy(() => void ecoute.arreter());

  function mesurer(): void {
    seuilMesure = null;
    void ecoute.demarrer();
  }

  function exporter(): void {
    const json = exporterJson($state.snapshot(etat.progression) as Progression);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichierExport(new Date());
    lien.click();
    URL.revokeObjectURL(url);
  }

  async function lireFichier(fichier: File | undefined): Promise<void> {
    if (!fichier) return;
    message = null;
    const progression = importerJson(await fichier.text());
    choixFichier.value = '';
    if (progression) confirmation = { type: 'import', progression };
    else message = { texte: TEXTES.reglages.importInvalide, erreur: true };
  }

  function confirmer(): void {
    if (confirmation?.type === 'import') {
      etat.remplacer(confirmation.progression);
      message = { texte: TEXTES.reglages.importFait, erreur: false };
    } else if (confirmation?.type === 'reinitialiser') {
      etat.reinitialiser();
      message = { texte: TEXTES.reglages.reinitialisationFaite, erreur: false };
    }
    confirmation = null;
  }
</script>

<header class="barre">
  <h1>{TEXTES.reglages.titre}</h1>
  <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.retour}</button>
</header>

<section>
  <h2>{TEXTES.reglages.affichage}</h2>
  <label class="champ">
    {TEXTES.reglages.notation}
    <select
      value={reglages.notation}
      onchange={(e) => etat.definirReglage('notation', e.currentTarget.value as Notation)}
    >
      {#each NOTATIONS as n (n)}
        <option value={n}>{TEXTES.notations[n]}</option>
      {/each}
    </select>
  </label>
  <label class="ligne">
    <input
      type="checkbox"
      checked={reglages.afficherNotes}
      onchange={(e) => etat.definirReglage('afficherNotes', e.currentTarget.checked)}
    />
    {TEXTES.reglages.afficherNotes}
  </label>
</section>

<section>
  <h2>{TEXTES.reglages.mode2}</h2>
  <fieldset>
    <legend>{TEXTES.reglages.tolerance}</legend>
    {#each TOLERANCES as t (t)}
      <label class="ligne">
        <input
          type="radio"
          name="tolerance"
          value={t}
          checked={reglages.tolerance === t}
          onchange={() => etat.definirReglage('tolerance', t as Tolerance)}
        />
        {TEXTES.reglages.tolerances[t]}
      </label>
    {/each}
  </fieldset>
  <label class="ligne">
    <input
      type="checkbox"
      checked={reglages.octaveStricte}
      onchange={(e) => etat.definirReglage('octaveStricte', e.currentTarget.checked)}
    />
    {TEXTES.reglages.octaveStricte}
  </label>
  <label class="ligne">
    <input
      type="checkbox"
      checked={reglages.afficherCaseMode2}
      onchange={(e) => etat.definirReglage('afficherCaseMode2', e.currentTarget.checked)}
    />
    {TEXTES.reglages.afficherCaseMode2}
  </label>
</section>

<section>
  <h2>{TEXTES.reglages.microEtSon}</h2>
  <label class="champ">
    {TEXTES.reglages.a4(nomAffiche('A', reglages.notation, 4))}
    <input
      type="number"
      min={A4_MIN_HZ}
      max={A4_MAX_HZ}
      step="1"
      value={reglages.a4}
      onchange={(e) => {
        const v = e.currentTarget.valueAsNumber;
        if (Number.isFinite(v)) etat.definirReglage('a4', bornerA4(v));
        e.currentTarget.value = String(reglages.a4);
      }}
    />
  </label>
  <p class="detail">{TEXTES.reglages.seuil(reglages.seuilSilenceDb)}</p>
  {#if ecoute.statut === 'arrete'}
    <button type="button" class="secondaire" onclick={mesurer}>{TEXTES.reglages.mesurer}</button>
  {:else}
    <p role="status">{TEXTES.reglages.mesureEnCours}</p>
  {/if}
  {#if seuilMesure !== null}<p role="status">{TEXTES.reglages.mesureFaite(seuilMesure)}</p>{/if}
  {#if ecoute.erreur}<p class="alerte" role="alert">{ecoute.erreur}</p>{/if}
  <label class="ligne">
    <input
      type="checkbox"
      checked={reglages.retourSonore}
      onchange={(e) => etat.definirReglage('retourSonore', e.currentTarget.checked)}
    />
    {TEXTES.reglages.retourSonore}
  </label>
</section>

<section>
  <h2>{TEXTES.reglages.progression}</h2>
  <p class="detail">{TEXTES.reglages.conseilExport}</p>
  <div class="boutons">
    <button type="button" class="secondaire" onclick={exporter}>{TEXTES.reglages.exporter}</button>
    <button type="button" class="secondaire" onclick={() => choixFichier.click()}>{TEXTES.reglages.importer}</button>
    <input
      bind:this={choixFichier}
      class="cache"
      type="file"
      accept="application/json,.json"
      tabindex="-1"
      aria-label={TEXTES.reglages.importer}
      onchange={(e) => void lireFichier(e.currentTarget.files?.[0])}
    />
    <button
      type="button"
      class="secondaire"
      onclick={() => {
        message = null;
        confirmation = { type: 'reinitialiser' };
      }}
    >
      {TEXTES.reglages.reinitialiser}
    </button>
  </div>
  {#if confirmation}
    <div class="confirmation" role="alertdialog" aria-labelledby="question-confirmation">
      <p id="question-confirmation">
        {confirmation.type === 'import' ? TEXTES.reglages.confirmerImport : TEXTES.reglages.confirmerReinitialisation}
      </p>
      <div class="boutons">
        <button type="button" class="principal" onclick={confirmer}>
          {confirmation.type === 'import' ? TEXTES.reglages.remplacer : TEXTES.reglages.effacer}
        </button>
        <button type="button" class="secondaire" onclick={() => (confirmation = null)}>
          {TEXTES.reglages.annuler}
        </button>
      </div>
    </div>
  {/if}
  {#if message}
    <p class:alerte={message.erreur} role={message.erreur ? 'alert' : 'status'}>{message.texte}</p>
  {/if}
</section>

{#if !etat.sauvegardeOk}<p class="alerte">{TEXTES.sauvegardeImpossible}</p>{/if}

<style>
  section {
    margin-top: 1.25rem;
  }
  h2 {
    font-size: 1.125rem;
    margin: 0 0 0.5rem;
  }
  fieldset {
    margin: 0 0 0.25rem;
    padding: 0;
    border: none;
  }
  legend {
    padding: 0;
    margin-bottom: 0.25rem;
  }
  /* Case à cocher ou bouton radio : le texte passe à la ligne à côté de la case, pas dessous. */
  .ligne,
  .champ {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  /* Libellé suivi d'une liste ou d'un nombre : le champ passe dessous si la place manque. */
  .champ {
    flex-wrap: wrap;
  }
  input[type='checkbox'],
  input[type='radio'] {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
  }
  select,
  input[type='number'] {
    min-height: 44px;
    max-width: 100%;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  input[type='number'] {
    width: 5.5rem;
    padding: 0 0.5rem;
  }
  .detail {
    margin: 0.25rem 0 0.5rem;
    color: var(--discret);
    font-size: 0.9375rem;
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .confirmation {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--cadre);
    border-radius: 8px;
    background: var(--surface);
  }
  .confirmation p {
    margin: 0 0 0.5rem;
  }
</style>
