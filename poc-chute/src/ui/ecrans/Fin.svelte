<script lang="ts">
  import type { PartieJournal } from '../../jeu/journal';
  import { casesDeLaNote, noteDePosition, type Position } from '../../music/manche';
  import { caseMaxDuNiveau, contenuNiveau, positionsDuNiveau } from '../../progression/niveaux';
  import { TEXTES, duree, emplacement } from '../textes';

  // Écran de fin (spec §6.7) : résumé de la partie, notes manquées avec leur bonne case.

  interface Props {
    journal: PartieJournal;
    onRejouer: () => void;
    onChanger: () => void;
    onExporter: () => void;
  }

  let { journal, onRejouer, onChanger, onExporter }: Props = $props();

  const resume = $derived(journal.resume);
  const { niveau, notation } = $derived(journal.reglages);

  /** Bonnes positions d'une note demandée, dans la plage du niveau (comme les questions de la partie). */
  function positionsCorrectes(position: Position): Position[] {
    const nom = noteDePosition(position).nom;
    if (!contenuNiveau(niveau).cordeDemandee) {
      return positionsDuNiveau(niveau, 2).filter((p) => noteDePosition(p).nom === nom);
    }
    return casesDeLaNote(nom, position.corde, undefined, caseMaxDuNiveau(niveau, 2)).map((k) => ({
      corde: position.corde,
      case: k,
    }));
  }

  /** Notes fausses, ratées ou trouvées après une fausse note (mode « pénalité »), une ligne par position demandée. */
  const manquees = $derived.by(() => {
    const cordeDemandee = contenuNiveau(niveau).cordeDemandee;
    const vues: string[] = [];
    const lignes: string[] = [];
    for (const note of journal.notes) {
      const cle = `${note.position.corde}-${note.position.case}`;
      const sansErreur = note.resultat === 'juste' && !note.evenements.some((e) => e.type === 'fausse');
      if (sansErreur || vues.includes(cle)) continue;
      vues.push(cle);
      lignes.push(emplacement(note.nom, positionsCorrectes(note.position), cordeDemandee, notation));
    }
    return lignes;
  });
</script>

<header>
  <h1>{TEXTES.fin.titre}</h1>
  {#if journal.interrompue}<p class="arretee">{TEXTES.fin.arretee}</p>{/if}
</header>

<p class="score">{TEXTES.fin.score} : <strong>{resume.score}</strong></p>

<dl class="resume">
  <dt>{TEXTES.fin.justes}</dt>
  <dd class="justes">{resume.justes}</dd>
  <dt>{TEXTES.fin.fausses}</dt>
  <dd class="fausses">{resume.fausses}</dd>
  <dt>{TEXTES.fin.ratees}</dt>
  <dd class="ratees">{resume.ratees}</dd>
  <dt>{TEXTES.fin.meilleureSerie}</dt>
  <dd class="meilleure-serie">{resume.meilleureSerie}</dd>
  <dt>{TEXTES.fin.chute}</dt>
  <dd>
    {TEXTES.fin.chuteValeurs(
      duree(journal.reglages.dureeInitialeMs),
      duree(resume.dureeFinaleMs),
      duree(resume.dureeMinMs),
    )}
  </dd>
  <dt>{TEXTES.fin.tempsReponse}</dt>
  <dd>{resume.tempsReponseMedianMs === null ? '–' : duree(resume.tempsReponseMedianMs)}</dd>
</dl>

<section>
  <h2>{TEXTES.fin.manquees}</h2>
  {#if manquees.length === 0}
    <p>{TEXTES.fin.aucuneManquee}</p>
  {:else}
    <ul class="manquees">
      {#each manquees as ligne (ligne)}<li>{ligne}</li>{/each}
    </ul>
  {/if}
</section>

<div class="boutons">
  <button type="button" class="principal" onclick={onRejouer}>{TEXTES.fin.rejouer}</button>
  <button type="button" class="secondaire" onclick={onChanger}>{TEXTES.fin.changer}</button>
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
  .arretee {
    margin: 0.25rem 0 0;
    color: var(--discret);
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
  .manquees {
    margin: 0;
    padding-left: 1.25rem;
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
