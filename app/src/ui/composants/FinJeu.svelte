<script lang="ts">
  import type { PartieJournal } from '../../jeu/journal';
  import { TEXTES, duree, nomPosition, pourcent } from '../textes';

  // Fin d'une partie du jeu du mode 1 (spec §5.1), reprise du POC « Notes qui tombent » : résumé, records, notes du
  // niveau de la moins réussie à la mieux réussie, et reprise au niveau atteint.

  interface Props {
    journal: PartieJournal;
    /** La partie a battu le meilleur score ou le plus haut niveau. */
    nouveauRecord: boolean;
    onContinuer: () => void;
    onAccueil: () => void;
    onExporter: () => void;
  }

  let { journal, nouveauRecord, onContinuer, onAccueil, onExporter }: Props = $props();

  const resume = $derived(journal.resume);
  const notes = $derived(
    [...journal.bilanNotes].sort((a, b) => a.reussite - b.reussite || a.difficulte - b.difficulte),
  );
</script>

<header>
  <h1>{TEXTES.fin.titre}</h1>
</header>

{#if nouveauRecord}<p class="record" role="status">{TEXTES.fin.nouveauRecord}</p>{/if}

<p class="score">{TEXTES.fin.score} : <strong>{resume.score}</strong></p>

<dl class="resume">
  <dt>{TEXTES.fin.niveaux}</dt>
  <dd class="niveaux">{TEXTES.fin.niveauxValeurs(resume.niveauDepart, resume.niveauAtteint)}</dd>
  <dt>{TEXTES.fin.reussiteNiveau}</dt>
  <dd class="reussite">{pourcent(resume.reussiteGlobale)}</dd>
  <dt>{TEXTES.fin.essais}</dt>
  <dd class="essais">{resume.essais}</dd>
  <dt>{TEXTES.fin.justes}</dt>
  <dd class="justes">{resume.justes}</dd>
  <dt>{TEXTES.fin.fausses}</dt>
  <dd class="fausses">{resume.fausses}</dd>
  <dt>{TEXTES.fin.perdues}</dt>
  <dd class="perdues">{resume.perdues}</dd>
  <dt>{TEXTES.fin.ratees}</dt>
  <dd class="ratees">{resume.ratees}</dd>
  <dt>{TEXTES.fin.meilleureSerie}</dt>
  <dd class="meilleure-serie">{resume.meilleureSerie}</dd>
  <dt>{TEXTES.fin.vitesseMax}</dt>
  <dd>{pourcent(resume.vitesseMax)}</dd>
  <dt>{TEXTES.fin.delaiMedian}</dt>
  <dd>{resume.delaiNoteMedianMs === null ? '–' : duree(resume.delaiNoteMedianMs)}</dd>
</dl>

<section>
  <h2>{TEXTES.fin.notesDuNiveau}</h2>
  <table class="notes">
    <thead>
      <tr>
        <th scope="col">{TEXTES.fin.colonneNote}</th>
        <th scope="col">{TEXTES.fin.colonneEssais}</th>
        <th scope="col">{TEXTES.fin.colonneReussite}</th>
      </tr>
    </thead>
    <tbody>
      {#each notes as note (`${note.position.corde}-${note.position.case}`)}
        <tr>
          <td>{nomPosition(note.position, note.nom, journal.reglages.notation)}</td>
          <td>{note.essais}</td>
          <td class:faible={note.reussite < journal.reglages.seuilNote}>{pourcent(note.reussite)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<div class="boutons">
  <button type="button" class="principal" onclick={onContinuer}>{TEXTES.fin.continuer(resume.niveauAtteint)}</button>
  <button type="button" class="secondaire" onclick={onAccueil}>{TEXTES.mode1.retour}</button>
  <button type="button" class="secondaire" onclick={onExporter}>{TEXTES.fin.exporter}</button>
</div>

<style>
  h1 {
    margin: 0;
    font-size: 2rem;
  }
  h2 {
    margin: 1.5rem 0 0.5rem;
    font-size: 1.125rem;
  }
  .record {
    margin: 1rem 0 0;
    padding: 0.5rem 0.75rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--juste);
    border: 2px solid var(--juste);
    border-radius: 8px;
  }
  .score {
    margin: 1rem 0;
    font-size: 1.5rem;
  }
  .resume {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    margin: 0;
  }
  dt {
    color: var(--discret);
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
  .notes {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  th,
  td {
    padding: 0.375rem 0.25rem;
    text-align: left;
    border-bottom: 1px solid var(--cadre);
  }
  th {
    font-weight: 600;
    color: var(--discret);
  }
  td:not(:first-child),
  th:not(:first-child) {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .faible {
    color: var(--faux);
    font-weight: 600;
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
