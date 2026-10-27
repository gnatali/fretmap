<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { AvancementMode, Niveau } from '../../progression/modele';
  import { NIVEAUX, TAUX_PASSAGE, etatPassage } from '../../progression/niveaux';
  import { TEXTES } from '../textes';

  // Au-dessus d'un quiz (modes 1 et 2) : niveau parmi ceux débloqués dans ce mode, où en est le passage au niveau
  // suivant, puis l'aide propre au mode (afficher les notes, afficher la case), aussi réglable dans l'écran Réglages.
  interface Props {
    niveau: Niveau;
    /** Avancement du mode : niveaux débloqués et dernières réponses au niveau atteint. */
    avancement: AvancementMode;
    onNiveau: (niveau: Niveau) => void;
    children?: Snippet;
  }

  let { niveau, avancement, onNiveau, children }: Props = $props();

  const passage = $derived(etatPassage(avancement));
</script>

<div class="reglages">
  <label class="niveau">
    {TEXTES.quiz.niveau}
    <select value={niveau} onchange={(e) => onNiveau(Number(e.currentTarget.value) as Niveau)}>
      {#each NIVEAUX as n (n.niveau)}
        {@const verrouille = n.niveau > avancement.niveauAtteint}
        <option value={n.niveau} disabled={verrouille}>
          {TEXTES.quiz.nomNiveau(n.niveau, TEXTES.niveaux[n.niveau]!, verrouille)}
        </option>
      {/each}
    </select>
  </label>
  {@render children?.()}
</div>
<p class="avancement">
  {#if niveau < avancement.niveauAtteint}
    {TEXTES.quiz.entrainement(avancement.niveauAtteint)}
  {:else if passage}
    {TEXTES.quiz.versNiveau(
      avancement.niveauAtteint + 1,
      Math.round(TAUX_PASSAGE * 100),
      passage.requises,
      passage.reussites,
      passage.reponses,
    )}
  {:else}
    {TEXTES.quiz.dernierNiveau}
  {/if}
</p>

<style>
  .reglages {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0 0.25rem;
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
  /* Les noms de niveau sont longs : la liste prend la largeur de l'écran et coupe son texte au lieu de déborder. */
  .niveau {
    flex: 1 1 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
  select {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  .avancement {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    color: var(--discret);
  }
</style>
