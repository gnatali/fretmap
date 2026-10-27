<script lang="ts" module>
  export type Destination = 'mode1' | 'statistiques';
</script>

<script lang="ts">
  import { TEXTES } from '../textes';

  interface Props {
    niveau: number;
    onAller: (destination: Destination) => void;
  }

  let { niveau, onAller }: Props = $props();

  // Ordre de la spec §7 ; les écrans sans destination arrivent aux phases 4 et 5.
  const entrees: { texte: { titre: string; description: string }; destination?: Destination }[] = [
    { texte: TEXTES.entrees.mode1, destination: 'mode1' },
    { texte: TEXTES.entrees.mode2 },
    { texte: TEXTES.entrees.accordeur },
    { texte: TEXTES.entrees.statistiques, destination: 'statistiques' },
    { texte: TEXTES.entrees.reglages },
  ];
</script>

<header>
  <h1>{TEXTES.titre}</h1>
  <p class="sous-titre">{TEXTES.sousTitre}</p>
  <p class="niveau">{TEXTES.niveauActuel(niveau)}</p>
</header>

<nav aria-label="Écrans">
  <ul>
    {#each entrees as { texte, destination } (texte.titre)}
      <li>
        <button
          type="button"
          disabled={!destination}
          onclick={() => {
            if (destination) onAller(destination);
          }}
        >
          <span class="titre">{texte.titre}</span>
          <span class="description">{texte.description}</span>
          {#if !destination}<span class="etat">{TEXTES.bientot}</span>{/if}
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
    grid-template-columns: 1fr auto;
    gap: 0.125rem 0.75rem;
    padding: 0.875rem 1rem;
    text-align: left;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 10px;
    cursor: pointer;
  }
  button:not(:disabled) {
    border-color: var(--lien);
    border-width: 2px;
  }
  button:disabled {
    cursor: not-allowed;
  }
  .titre {
    font-weight: 600;
    font-size: 1.125rem;
  }
  .description {
    grid-column: 1;
    color: var(--discret);
    font-size: 0.9375rem;
  }
  .etat {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: 0.8125rem;
    color: var(--discret);
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
