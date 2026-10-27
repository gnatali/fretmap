<script lang="ts">
  import { TEXTES } from '../textes';

  // Niveau sonore du micro, avec un repère au seuil de silence (spec §5.2, indicateur en direct).
  interface Props {
    /** Niveau mesuré en dBFS ; null quand le micro est coupé. */
    niveauDbfs: number | null;
    seuilDbfs: number;
  }

  let { niveauDbfs, seuilDbfs }: Props = $props();

  /** Plage affichée, en dBFS, comme dans le POC. */
  const MIN_DBFS = -90;
  const MAX_DBFS = 0;
  const pourcentage = (dbfs: number) => Math.min(100, Math.max(0, ((dbfs - MIN_DBFS) / (MAX_DBFS - MIN_DBFS)) * 100));
  const valeur = $derived(niveauDbfs === null ? MIN_DBFS : Math.max(MIN_DBFS, Math.round(niveauDbfs)));
</script>

<div
  class="barre-niveau"
  role="meter"
  aria-label={TEXTES.mode2.niveauSonore}
  aria-valuemin={MIN_DBFS}
  aria-valuemax={MAX_DBFS}
  aria-valuenow={valeur}
  aria-valuetext="{valeur} dBFS"
>
  <span class="remplissage" class:silence={valeur < seuilDbfs} style:width="{pourcentage(valeur)}%"></span>
  <span class="seuil" style:left="{pourcentage(seuilDbfs)}%"></span>
</div>

<style>
  .barre-niveau {
    position: relative;
    height: 0.75rem;
    border-radius: 0.375rem;
    background: var(--surface);
    border: 1px solid var(--cadre);
    overflow: hidden;
  }
  .remplissage {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--juste);
  }
  .remplissage.silence {
    background: var(--discret);
  }
  .seuil {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--texte);
  }
</style>
