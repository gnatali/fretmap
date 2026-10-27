<script lang="ts">
  import {
    ETENDUE_AIGUILLE_CENTS,
    TOLERANCE_JUSTE_CENTS,
    TOLERANCE_PROCHE_CENTS,
    zoneEcart,
  } from '../../music/accordages';
  import { TEXTES } from '../textes';

  // Aiguille de l'accordeur (spec §5.3) : de −50 à +50 cents, zone verte à ±5, orange à ±15. Au-delà de ±50,
  // le repère reste au bord ; le texte de l'écran dit « beaucoup trop bas / trop haut ».
  interface Props {
    /** Écart à la note visée, en cents ; null sans note stable (repère masqué). */
    cents: number | null;
    /** Restée dans la zone verte assez longtemps. */
    juste: boolean;
  }

  let { cents, juste }: Props = $props();

  /** Position horizontale (0 à 100 %) d'un écart sur l'aiguille. */
  const position = (ecart: number) => {
    const borne = Math.max(-ETENDUE_AIGUILLE_CENTS, Math.min(ETENDUE_AIGUILLE_CENTS, ecart));
    return ((borne + ETENDUE_AIGUILLE_CENTS) / (2 * ETENDUE_AIGUILLE_CENTS)) * 100;
  };
  const o1 = position(-TOLERANCE_PROCHE_CENTS);
  const v1 = position(-TOLERANCE_JUSTE_CENTS);
  const v2 = position(TOLERANCE_JUSTE_CENTS);
  const o2 = position(TOLERANCE_PROCHE_CENTS);
  const fond =
    `linear-gradient(to right, var(--zone-loin) 0 ${o1}%, var(--zone-proche) ${o1}% ${v1}%, ` +
    `var(--zone-juste) ${v1}% ${v2}%, var(--zone-proche) ${v2}% ${o2}%, var(--zone-loin) ${o2}% 100%)`;
</script>

<div class="aiguille" class:juste style:background={fond} role="img" aria-label={TEXTES.accordeur.aiguille}>
  <span class="centre"></span>
  {#if cents !== null}
    <span class="repere {zoneEcart(cents)}" style:left="{position(cents)}%"></span>
  {/if}
</div>

<style>
  .aiguille {
    --zone-loin: color-mix(in srgb, var(--faux) 30%, var(--surface));
    --zone-proche: color-mix(in srgb, var(--orange) 35%, var(--surface));
    --zone-juste: color-mix(in srgb, var(--juste) 45%, var(--surface));
    position: relative;
    height: 3rem;
    border-radius: 8px;
    border: 2px solid var(--cadre);
  }
  .aiguille.juste {
    border-color: var(--juste);
    box-shadow: 0 0 0 2px var(--juste);
  }
  .centre {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: var(--discret);
  }
  .repere {
    position: absolute;
    top: -0.25rem;
    bottom: -0.25rem;
    width: 6px;
    border-radius: 3px;
    transform: translateX(-50%);
    background: var(--texte);
  }
  .repere.juste {
    background: var(--juste);
  }
</style>
