<script lang="ts">
  import { nomAffiche, type Notation } from '../../music/notation';
  import type { NoteDetectee } from '../../music/notes';
  import { TEXTES } from '../textes';

  // Indicateur en direct, en bas de l'écran de partie (spec §6.2) : dernière note entendue et son écart en cents,
  // niveau sonore avec un repère au seuil de silence, messages du micro. La barre de niveau reprend
  // app/src/ui/composants/BarreNiveau.svelte.
  interface Props {
    /** Dernière note stable entendue, ou null. */
    entendue: NoteDetectee | null;
    /** Vrai si cette note est encore entendue à cet instant ; sinon elle est grisée. */
    enCours: boolean;
    /** Niveau mesuré en dBFS ; null avant la première mesure. */
    niveauDbfs: number | null;
    seuilDbfs: number;
    /** « Jouez la note… », « Note non reconnue, rejouez »… */
    message: string | null;
    notation: Notation;
  }

  let { entendue, enCours, niveauDbfs, seuilDbfs, message, notation }: Props = $props();

  /** Plage affichée, en dBFS, comme dans l'application. */
  const MIN_DBFS = -90;
  const MAX_DBFS = 0;
  const pourcentage = (dbfs: number) => Math.min(100, Math.max(0, ((dbfs - MIN_DBFS) / (MAX_DBFS - MIN_DBFS)) * 100));
  const valeur = $derived(niveauDbfs === null ? MIN_DBFS : Math.max(MIN_DBFS, Math.round(niveauDbfs)));
</script>

<section class="indicateur" aria-label={TEXTES.indicateur.titre}>
  <p class="entendue">
    <span class="etiquette">{TEXTES.indicateur.titre}</span>
    <strong class:ancienne={!enCours}>
      {entendue ? nomAffiche(entendue.nom, notation, entendue.octave) : TEXTES.indicateur.aucune}
    </strong>
    {#if entendue}<span class="cents">{TEXTES.indicateur.cents(entendue.centsExacts)}</span>{/if}
  </p>
  <div
    class="barre-niveau"
    role="meter"
    aria-label={TEXTES.indicateur.niveauSonore}
    aria-valuemin={MIN_DBFS}
    aria-valuemax={MAX_DBFS}
    aria-valuenow={valeur}
    aria-valuetext="{valeur} dBFS"
  >
    <span class="remplissage" class:silence={valeur < seuilDbfs} style:width="{pourcentage(valeur)}%"></span>
    <span class="seuil" style:left="{pourcentage(seuilDbfs)}%"></span>
  </div>
  <p class="message" aria-live="polite">{message ?? ''}</p>
</section>

<style>
  .indicateur {
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 10px;
  }
  .entendue {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    white-space: nowrap;
  }
  .etiquette {
    font-size: 0.875rem;
    color: var(--discret);
  }
  .entendue strong {
    font-size: 1.125rem;
  }
  .entendue strong.ancienne {
    color: var(--discret);
  }
  .cents {
    font-variant-numeric: tabular-nums;
  }
  .barre-niveau {
    position: relative;
    height: 0.625rem;
    border-radius: 0.3125rem;
    background: var(--fond);
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
  /* Deux lignes réservées : le manche ne bouge pas quand un message apparaît. */
  .message {
    min-height: 2.5rem;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.25rem;
  }
</style>
