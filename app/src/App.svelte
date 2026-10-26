<script lang="ts">
  import Accueil from './ui/ecrans/Accueil.svelte';

  // Routage simple entre écrans (spec §7) : seul l'accueil existe en phase 1.
  type Ecran = 'accueil';
  let ecran = $state<Ecran>('accueil');
</script>

<main>
  {#if ecran === 'accueil'}
    <Accueil />
  {/if}
</main>
