<script lang="ts">
  import type { EtatApp } from '../../etat.svelte';
  import { CASE_MAX, NUMEROS_CORDES, noteDePosition } from '../../music/manche';
  import { nomAffiche } from '../../music/notation';
  import type { Mode, Statistique } from '../../progression/modele';
  import { TEXTES } from '../textes';

  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
  }

  let { etat, onQuitter }: Props = $props();

  const MODES: readonly Mode[] = [1, 2];

  /** Totaux et statistiques par position d'un mode. */
  function resume(statistiques: readonly Statistique[], mode: Mode) {
    const stats = statistiques.filter((s) => s.mode === mode);
    const tentatives = stats.reduce((n, s) => n + s.tentatives, 0);
    return {
      parPosition: new Map(stats.map((s) => [`${s.corde}-${s.case}`, s])),
      tentatives,
      reussites: stats.reduce((n, s) => n + s.reussites, 0),
      tempsMoyen: tentatives ? stats.reduce((t, s) => t + s.tempsMoyenMs * s.tentatives, 0) / tentatives : 0,
    };
  }

  const resumes = $derived(MODES.map((mode) => ({ mode, ...resume(etat.progression.statistiques, mode) })));
  const notation = $derived(etat.progression.reglages.notation);
  const cases = Array.from({ length: CASE_MAX + 1 }, (_, k) => k);

  function niveau(taux: number | null): string {
    if (taux === null) return 'vide';
    if (taux < 50) return 'faible';
    if (taux < 80) return 'moyen';
    return 'bon';
  }
</script>

<header class="barre">
  <h1>{TEXTES.statistiques.titre}</h1>
  <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.retour}</button>
</header>

{#each resumes as { mode, parPosition, tentatives, reussites, tempsMoyen } (mode)}
  <section aria-labelledby="stats-mode-{mode}">
    <h2 id="stats-mode-{mode}">{TEXTES.statistiques.mode[mode]}</h2>
    {#if tentatives === 0}
      <p>{TEXTES.statistiques.aucune(mode)}</p>
    {:else}
      <p class="totaux">
        {TEXTES.statistiques.tentatives(tentatives)} · {TEXTES.statistiques.reussite(
          Math.round((reussites / tentatives) * 100),
        )} · {TEXTES.statistiques.tempsMoyen(tempsMoyen)}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col"><span class="visuellement-cache">Case</span></th>
            {#each NUMEROS_CORDES as corde (corde)}<th scope="col">{corde}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each cases as numeroCase (numeroCase)}
            <tr>
              <th scope="row">{numeroCase === 0 ? TEXTES.manche.aVide : numeroCase}</th>
              {#each NUMEROS_CORDES as corde (corde)}
                {@const s = parPosition.get(`${corde}-${numeroCase}`)}
                {@const taux = s ? Math.round((s.reussites / s.tentatives) * 100) : null}
                {@const note = noteDePosition({ corde, case: numeroCase })}
                <td
                  class={niveau(taux)}
                  title={nomAffiche(note.nom, notation, note.octave)}
                  aria-label={TEXTES.statistiques.cellule(corde, numeroCase, taux, s?.tentatives ?? 0)}
                >
                  {taux === null ? '·' : taux}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/each}
<p class="legende">{TEXTES.statistiques.legende}</p>

<style>
  h2 {
    font-size: 1.125rem;
    margin: 1rem 0 0.25rem;
  }
  .totaux {
    margin: 0 0 0.75rem;
    color: var(--discret);
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 3px;
    table-layout: fixed;
  }
  th {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--discret);
  }
  th[scope='row'] {
    width: 3.25rem;
    text-align: right;
    padding-right: 0.25rem;
  }
  td {
    height: 2rem;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 4px;
    color: var(--sur-couleur);
  }
  td.vide {
    color: var(--discret);
    background: var(--surface);
    border: 1px solid var(--cadre);
  }
  td.faible {
    background: var(--faux);
  }
  td.moyen {
    background: var(--orange);
  }
  td.bon {
    background: var(--juste);
  }
  .legende {
    font-size: 0.875rem;
    color: var(--discret);
  }
  .visuellement-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
