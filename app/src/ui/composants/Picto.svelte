<script lang="ts">
  // Pictos des commandes du jeu, dessinés en SVG (les caractères ▶ et ■ sont trop petits sur Android) : « lecture »
  // pour reprendre, « stop » pour arrêter. Couleur du texte du bouton ; taille donnée par le bouton (voir .rond).

  interface Props {
    nom: 'lecture' | 'stop';
  }

  let { nom }: Props = $props();
</script>

<svg class="picto" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#if nom === 'lecture'}
    <!-- Triangle décalé vers la droite : son centre de gravité tombe au centre du bouton. -->
    <path d="M8 4.5v15l12-7.5z" />
  {:else}
    <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
  {/if}
</svg>

<style>
  .picto {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
</style>
