<script lang="ts" module>
  export type Marque = 'juste' | 'faux' | 'attendue';
</script>

<script lang="ts">
  import { MARQUEURS, NUMEROS_CORDES, noteDePosition, type NumeroCorde, type Position } from '../../music/manche';
  import { TEXTES } from '../textes';

  interface Props {
    caseMax: number;
    afficherNotes?: boolean;
    /** Corde de la question, mise en évidence. */
    cordeEnEvidence?: NumeroCorde | null;
    /** Marques par position, clé `${corde}-${case}`. */
    marques?: Record<string, Marque>;
    desactive?: boolean;
    onToucher: (position: Position) => void;
  }

  let {
    caseMax,
    afficherNotes = false,
    cordeEnEvidence = null,
    marques = {},
    desactive = false,
    onToucher,
  }: Props = $props();

  const ICONES: Record<Marque, string> = { juste: '✓', faux: '✗', attendue: '●' };
  const cle = (corde: NumeroCorde, numeroCase: number) => `${corde}-${numeroCase}`;
  const cases = $derived(Array.from({ length: caseMax + 1 }, (_, k) => k));

  // Navigation au clavier (spec §7) : une seule case dans l'ordre de tabulation, les flèches déplacent le focus.
  let focus = $state<Position>({ corde: 6, case: 0 });
  let grille: HTMLDivElement;

  function deplacer(evenement: KeyboardEvent, p: Position): void {
    const index = NUMEROS_CORDES.indexOf(p.corde);
    const cible: Position = { ...p };
    if (evenement.key === 'ArrowLeft') cible.corde = NUMEROS_CORDES[Math.max(0, index - 1)]!;
    else if (evenement.key === 'ArrowRight') cible.corde = NUMEROS_CORDES[Math.min(5, index + 1)]!;
    else if (evenement.key === 'ArrowUp') cible.case = Math.max(0, p.case - 1);
    else if (evenement.key === 'ArrowDown') cible.case = Math.min(caseMax, p.case + 1);
    else return;
    evenement.preventDefault();
    focus = cible;
    grille.querySelector<HTMLButtonElement>(`[data-position="${cle(cible.corde, cible.case)}"]`)?.focus();
  }
</script>

<div class="manche" role="group" aria-label={TEXTES.manche.nom} bind:this={grille}>
  <div class="ligne entete" aria-hidden="true">
    <span class="numero"></span>
    {#each NUMEROS_CORDES as corde (corde)}
      <span class="corde-numero" class:evidence={corde === cordeEnEvidence}>{corde}</span>
    {/each}
  </div>
  {#each cases as numeroCase (numeroCase)}
    <div class="ligne" class:sillet={numeroCase === 0}>
      <span class="numero" aria-hidden="true">
        {numeroCase === 0 ? '' : numeroCase}
        {#if MARQUEURS.includes(numeroCase)}<span class="marqueur" class:double={numeroCase === 12}></span>{/if}
      </span>
      {#each NUMEROS_CORDES as corde (corde)}
        {@const marque = marques[cle(corde, numeroCase)]}
        {@const note = noteDePosition({ corde, case: numeroCase }).nom}
        <button
          type="button"
          class="case {marque ?? ''}"
          class:evidence={corde === cordeEnEvidence}
          data-position={cle(corde, numeroCase)}
          tabindex={focus.corde === corde && focus.case === numeroCase ? 0 : -1}
          disabled={desactive}
          aria-label="{TEXTES.manche.position(corde, numeroCase)}{afficherNotes ? `, ${note}` : ''}{marque
            ? `, ${TEXTES.manche.marque[marque]}`
            : ''}"
          onclick={() => onToucher({ corde, case: numeroCase })}
          onfocus={() => (focus = { corde, case: numeroCase })}
          onkeydown={(e) => deplacer(e, { corde, case: numeroCase })}
        >
          {#if marque}<span class="icone" aria-hidden="true">{ICONES[marque]}</span>
          {:else if afficherNotes}<span class="note" aria-hidden="true">{note}</span>{/if}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .manche {
    display: grid;
    gap: 0;
    user-select: none;
  }
  .ligne {
    display: grid;
    grid-template-columns: 2rem repeat(6, minmax(44px, 1fr));
    border-bottom: 2px solid var(--frette);
  }
  .ligne.entete {
    border-bottom: none;
  }
  .ligne.sillet {
    border-bottom: 6px solid var(--sillet);
  }
  .numero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 0.8125rem;
    color: var(--discret);
  }
  .marqueur {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--discret);
  }
  .marqueur.double {
    box-shadow: 0 10px 0 var(--discret);
    margin-bottom: 10px;
  }
  .corde-numero {
    text-align: center;
    font-size: 0.8125rem;
    color: var(--discret);
    padding-bottom: 0.25rem;
  }
  .corde-numero.evidence {
    color: var(--texte);
    font-weight: 700;
  }
  .case {
    position: relative;
    min-height: 48px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }
  /* La corde : un trait vertical au centre de chaque case. */
  .case::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 50%;
    width: 2px;
    transform: translateX(-50%);
    background: var(--corde);
  }
  .case.evidence {
    background: var(--evidence);
  }
  .case:disabled {
    cursor: default;
  }
  .case:focus-visible {
    outline: 3px solid var(--lien);
    outline-offset: -3px;
  }
  .note,
  .icone {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: var(--surface);
    border: 1px solid var(--cadre);
  }
  .icone {
    font-size: 1.125rem;
    color: var(--sur-couleur);
    border: none;
  }
  .juste .icone,
  .attendue .icone {
    background: var(--juste);
  }
  .faux .icone {
    background: var(--faux);
  }
</style>
