<script lang="ts">
  import { EtatApp } from './etat.svelte';
  import type { Stockage } from './progression/stockage';
  import Accordeur from './ui/ecrans/Accordeur.svelte';
  import Accueil, { type Destination } from './ui/ecrans/Accueil.svelte';
  import Mode1 from './ui/ecrans/Mode1.svelte';
  import Mode2 from './ui/ecrans/Mode2.svelte';
  import Reglages from './ui/ecrans/Reglages.svelte';
  import Statistiques from './ui/ecrans/Statistiques.svelte';

  interface Props {
    /** Stockage de la progression ; localStorage par défaut (injectable pour les tests). */
    stockage?: Stockage | null;
  }

  let { stockage }: Props = $props();

  // svelte-ignore state_referenced_locally
  const etat = new EtatApp(stockage);

  // Routage simple entre écrans (spec §7).
  type Ecran = 'accueil' | Destination;
  let ecran = $state<Ecran>('accueil');
  const accueil = () => (ecran = 'accueil');
</script>

<main>
  {#if ecran === 'mode1'}
    <Mode1 {etat} onQuitter={accueil} />
  {:else if ecran === 'mode2'}
    <Mode2 {etat} onQuitter={accueil} />
  {:else if ecran === 'accordeur'}
    <Accordeur {etat} onQuitter={accueil} />
  {:else if ecran === 'statistiques'}
    <Statistiques {etat} onQuitter={accueil} />
  {:else if ecran === 'reglages'}
    <Reglages {etat} onQuitter={accueil} />
  {:else}
    <Accueil niveau={etat.progression.niveauActuel} onAller={(d) => (ecran = d)} />
  {/if}
</main>
