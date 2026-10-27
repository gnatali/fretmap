<script lang="ts">
  import type { Snippet } from 'svelte';
  import { NOTATIONS, type Notation } from '../../music/notation';
  import type { Niveau } from '../../progression/modele';
  import { NIVEAUX } from '../../progression/niveaux';
  import { TEXTES } from '../textes';

  // Réglages au-dessus d'un quiz (modes 1 et 2) : niveau, notation, puis les cases à cocher propres au mode.
  // Provisoire pour la notation : l'écran Réglages la reprendra en phase 5 (spec §5.1).
  interface Props {
    niveau: Niveau;
    onNiveau: (niveau: Niveau) => void;
    notation: Notation;
    onNotation: (notation: Notation) => void;
    children?: Snippet;
  }

  let { niveau, onNiveau, notation, onNotation, children }: Props = $props();
</script>

<div class="reglages">
  <label>
    {TEXTES.quiz.niveau}
    <select value={niveau} onchange={(e) => onNiveau(Number(e.currentTarget.value) as Niveau)}>
      {#each NIVEAUX as n (n.niveau)}
        <option value={n.niveau}>{TEXTES.quiz.nomNiveau(n.niveau, TEXTES.niveaux[n.niveau]!)}</option>
      {/each}
    </select>
  </label>
  <label>
    {TEXTES.quiz.notation}
    <select value={notation} onchange={(e) => onNotation(e.currentTarget.value as Notation)}>
      {#each NOTATIONS as n (n)}
        <option value={n}>{TEXTES.notations[n]}</option>
      {/each}
    </select>
  </label>
  {@render children?.()}
</div>

<style>
  .reglages {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0;
  }
  .reglages :global(label) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  .reglages :global(input[type='checkbox']) {
    width: 1.25rem;
    height: 1.25rem;
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
</style>
