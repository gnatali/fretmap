<script lang="ts">
  import { TEXTES } from './ui/textes';

  // Phase 1 (spec §13) : page d'attente ; les écrans de départ, de partie et de fin arrivent en phase 3.
  const URL_SPEC = 'https://github.com/gnatali/fretmap/blob/main/docs/specs-poc-chute.md';
</script>

<main>
  <header>
    <h1>{TEXTES.titre}</h1>
    <p class="sous-titre">{TEXTES.sousTitre}</p>
  </header>

  <p class="statut">{TEXTES.enPreparation}</p>

  <ul class="liens">
    <li><a href={URL_SPEC}>{TEXTES.lienSpec}</a></li>
    <li><a href="../">{TEXTES.lienApplication}</a></li>
  </ul>
</main>

<style>
  h1 {
    margin: 0;
    font-size: 2rem;
  }
  .sous-titre {
    margin: 0.25rem 0 0;
    color: var(--discret);
  }
  .statut {
    margin: 1.5rem 0 0;
    padding: 0.75rem 1rem;
    background: var(--evidence);
    border-radius: 8px;
  }
  .liens {
    list-style: none;
    margin: 1.5rem 0 0;
    padding: 0;
  }
  .liens a {
    display: inline-block;
    min-height: 44px;
    line-height: 44px;
    color: var(--lien);
  }
</style>
