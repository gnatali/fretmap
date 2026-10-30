<script lang="ts">
  import {
    BORNES_PROGRESSIF,
    REGLAGES_PROGRESSIF_DEFAUT,
    bornerReglage,
    type CleNumerique,
    type ReglagesProgressif,
  } from '../../jeu/progressif/reglages';
  import {
    METHODES_GLOBALES,
    METHODES_NOTE,
    type MethodeGlobale,
    type MethodeNote,
  } from '../../jeu/progressif/reussite';
  import { TEXTES, duree, pourcent } from '../textes';

  // Réglages du mode progressif sur l'écran de départ (spec §16) : méthodes de réussite, puis curseurs. Les principaux
  // sont visibles, les autres repliés dans « Réglages avancés ». Chaque changement est enregistré par l'appelant.

  interface Props {
    reglages: ReglagesProgressif;
    onChange: (reglages: ReglagesProgressif) => void;
  }

  let { reglages, onChange }: Props = $props();

  type Format = 'pourcent' | 'duree' | 'nombre' | 'points';
  const FORMATS: Record<CleNumerique, Format> = {
    seuilNote: 'pourcent',
    seuilGlobal: 'pourcent',
    vitesseRequise: 'pourcent',
    dureeChuteMinMs: 'duree',
    notesAjoutees: 'nombre',
    essaisNote: 'nombre',
    essaisGlobaux: 'nombre',
    essaisMinimum: 'nombre',
    poidsAlteration: 'nombre',
    delaiNoteBonMs: 'duree',
    delaiNoteLentMs: 'duree',
    delaiApparitionBonMs: 'duree',
    delaiApparitionLentMs: 'duree',
    acceleration: 'pourcent',
    ralentissement: 'pourcent',
    penaliteFausse: 'points',
    penalitePerdue: 'points',
    bonusNiveau: 'points',
  };
  const PRINCIPAUX: readonly CleNumerique[] = [
    'seuilNote',
    'seuilGlobal',
    'dureeChuteMinMs',
    'vitesseRequise',
    'notesAjoutees',
  ];
  const AVANCES: readonly CleNumerique[] = [
    'essaisNote',
    'essaisMinimum',
    'essaisGlobaux',
    'poidsAlteration',
    'delaiNoteBonMs',
    'delaiNoteLentMs',
    'delaiApparitionBonMs',
    'delaiApparitionLentMs',
    'acceleration',
    'ralentissement',
    'penaliteFausse',
    'penalitePerdue',
    'bonusNiveau',
  ];

  function afficher(cle: CleNumerique, valeur: number): string {
    switch (FORMATS[cle]) {
      case 'pourcent':
        return pourcent(valeur);
      case 'duree':
        return duree(valeur);
      case 'points':
        return TEXTES.progressif.points(valeur);
      default:
        return String(valeur);
    }
  }

  function changer<C extends keyof ReglagesProgressif>(cle: C, valeur: ReglagesProgressif[C]): void {
    onChange({ ...reglages, [cle]: valeur });
  }
</script>

{#snippet curseur(cle: CleNumerique)}
  {@const bornes = BORNES_PROGRESSIF[cle]}
  <label class="curseur">
    <span>{TEXTES.progressif.reglages[cle]} : <strong data-cle={cle}>{afficher(cle, reglages[cle])}</strong></span>
    <input
      type="range"
      min={bornes.min}
      max={bornes.max}
      step={bornes.pas}
      value={reglages[cle]}
      oninput={(e) => changer(cle, bornerReglage(cle, Number(e.currentTarget.value)))}
    />
  </label>
{/snippet}

<div class="reglages-progressif">
  <label>
    {TEXTES.progressif.methodeNote}
    <select value={reglages.methodeNote} onchange={(e) => changer('methodeNote', e.currentTarget.value as MethodeNote)}>
      {#each METHODES_NOTE as methode (methode)}
        <option value={methode}>{TEXTES.progressif.methodesNote[methode]}</option>
      {/each}
    </select>
  </label>
  <label>
    {TEXTES.progressif.methodeGlobale}
    <select
      value={reglages.methodeGlobale}
      onchange={(e) => changer('methodeGlobale', e.currentTarget.value as MethodeGlobale)}
    >
      {#each METHODES_GLOBALES as methode (methode)}
        <option value={methode}>{TEXTES.progressif.methodesGlobales[methode]}</option>
      {/each}
    </select>
  </label>
  {#each PRINCIPAUX as cle (cle)}{@render curseur(cle)}{/each}

  <details>
    <summary>{TEXTES.progressif.avances}</summary>
    <div class="avances">
      {#each AVANCES as cle (cle)}{@render curseur(cle)}{/each}
      <button type="button" class="secondaire" onclick={() => onChange({ ...REGLAGES_PROGRESSIF_DEFAUT })}>
        {TEXTES.progressif.defaut}
      </button>
    </div>
  </details>
</div>

<style>
  .reglages-progressif,
  .avances {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-weight: 600;
  }
  select,
  input[type='range'] {
    min-height: 44px;
    font: inherit;
    font-weight: 400;
  }
  select {
    max-width: 100%;
    padding: 0 0.5rem;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--lien);
  }
  summary {
    padding: 0.625rem 0;
    cursor: pointer;
    font-weight: 600;
  }
  .avances .secondaire {
    justify-self: start;
  }
</style>
