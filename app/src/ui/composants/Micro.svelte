<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Ecoute } from '../../ecoute.svelte';
  import { TEXTES } from '../textes';

  // Commande du micro d'un écran (mode 2, accordeur) : explication avant la demande d'autorisation, bouton
  // « Démarrer » toujours visible, erreurs, traitements du navigateur restés actifs (spec §3, §7, §9).
  // Quand l'onglet passe en arrière-plan, le micro est coupé et l'écran le signale ; il est aussi coupé
  // quand on quitte l'écran.
  interface Props {
    ecoute: Ecoute;
    /** Appelé juste avant chaque démarrage (reprise d'une question, par exemple). */
    onDemarrer?: () => void;
    /** Appelé quand le micro est coupé parce que l'onglet passe en arrière-plan. */
    onInterruption?: () => void;
  }

  let { ecoute, onDemarrer, onInterruption }: Props = $props();

  let interrompu = $state(false);

  function demarrer(): void {
    interrompu = false;
    onDemarrer?.();
    void ecoute.demarrer();
  }

  function surVisibilite(): void {
    if (!document.hidden || ecoute.statut === 'arrete') return;
    void ecoute.arreter();
    interrompu = true;
    onInterruption?.();
  }

  onMount(() => {
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  });
  onDestroy(() => void ecoute.arreter());
</script>

<section class="micro">
  {#if ecoute.statut === 'arrete'}
    <p>{interrompu ? TEXTES.micro.interrompu : TEXTES.micro.explication}</p>
    <button type="button" class="principal" onclick={demarrer}>{TEXTES.micro.demarrer}</button>
  {:else if ecoute.statut === 'demarrage'}
    <button type="button" class="principal" disabled>{TEXTES.micro.demarrage}</button>
  {:else}
    <button type="button" class="secondaire" onclick={() => void ecoute.arreter()}>{TEXTES.micro.couper}</button>
  {/if}
  {#if ecoute.erreur}<p class="alerte" role="alert">{ecoute.erreur}</p>{/if}
  {#if ecoute.traitementsActifs.length > 0}
    <p class="alerte">
      {TEXTES.micro.traitements(ecoute.traitementsActifs.map((t) => TEXTES.micro.nomsTraitements[t]))}
    </p>
  {/if}
</section>

<style>
  .micro {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
    margin: 0.5rem 0 1rem;
  }
  .micro p {
    margin: 0;
  }
</style>
