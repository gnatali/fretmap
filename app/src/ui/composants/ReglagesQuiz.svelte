<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Niveau } from '../../progression/modele';
  import { NIVEAUX } from '../../progression/niveaux';
  import { TEXTES } from '../textes';

  // Au-dessus d'un quiz (modes 1 et 2) : niveau au choix jusqu'à la phase 6, puis l'aide propre au mode
  // (afficher les notes, afficher la case), aussi réglable dans l'écran Réglages.
  interface Props {
    niveau: Niveau;
    onNiveau: (niveau: Niveau) => void;
    children?: Snippet;
  }

  let { niveau, onNiveau, children }: Props = $props();
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
