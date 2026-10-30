<script lang="ts" module>
  export type Destination = 'mode1' | 'mode2' | 'accordeur' | 'statistiques' | 'reglages';
</script>

<script lang="ts">
  import type { Mode } from '../../progression/modele';
  import { TEXTES } from '../textes';

  interface Props {
    /** Niveau atteint dans chaque mode (mode 1 : niveau du jeu). */
    niveaux: Record<Mode, number>;
    onAller: (destination: Destination) => void;
  }

  let { niveaux, onAller }: Props = $props();

  // Ordre de la spec §7.
  const entrees: Destination[] = ['mode1', 'mode2', 'accordeur', 'statistiques', 'reglages'];
</script>

<header>
  <h1>{TEXTES.titre}</h1>
  <p class="sous-titre">{TEXTES.sousTitre}</p>
  <p class="niveau">{TEXTES.niveauxAtteints(niveaux[1], niveaux[2])}</p>
</header>

<nav aria-label="Écrans">
  <ul>
    {#each entrees as destination (destination)}
      <li>
        <button type="button" onclick={() => onAller(destination)}>
          <span class="titre">{TEXTES.entrees[destination].titre}</span>
          <span class="description">{TEXTES.entrees[destination].description}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>

<p class="poc"><a href="./poc/">{TEXTES.lienPoc}</a></p>

<style>
  header {
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
  }
  .sous-titre {
    margin: 0.25rem 0 0;
    color: var(--discret);
  }
  .niveau {
    margin: 0.5rem 0 0;
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }
  button {
    width: 100%;
    min-height: 44px;
    display: grid;
    gap: 0.125rem;
    padding: 0.875rem 1rem;
    text-align: left;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 2px solid var(--lien);
    border-radius: 10px;
    cursor: pointer;
  }
  .titre {
    font-weight: 600;
    font-size: 1.125rem;
  }
  .description {
    color: var(--discret);
    font-size: 0.9375rem;
  }
  .poc {
    margin-top: 1.5rem;
  }
  .poc a {
    display: inline-block;
    min-height: 44px;
    line-height: 44px;
    color: var(--lien);
  }
</style>
