<script lang="ts" module>
  import type { Question } from '../../quiz/tirage';

  /** Note à l'écran, copiée de la partie à chaque image. */
  export interface NoteAffichee {
    index: number;
    question: Question;
    /** 0 = apparition en haut, 1 = ligne de jeu. */
    progression: number;
    /** Case fausse à l'instant : la note reste en jeu et clignote en rouge. */
    faute?: boolean;
  }

  /** Effet vert ou rouge laissé par une note touchée juste, perdue ou ratée. */
  export interface Effet {
    id: number;
    question: Question;
    progression: number;
    juste: boolean;
  }

  /** Marque laissée sur une case touchée. */
  export type MarqueCase = 'juste' | 'faux';

  /**
   * Paliers du manche affiché : au moins les cases 0 à 5, puis jusqu'à 7 si une note le demande, puis jusqu'à 12
   * (POC « Notes qui tombent », spec §6.2).
   */
  export const PALIERS_MANCHE: readonly number[] = [5, 7, 12];

  /** Dernière case affichée : le premier palier qui contient la case maximale des notes. */
  export function caseAffichee(caseMax: number): number {
    return PALIERS_MANCHE.find((palier) => palier >= caseMax) ?? caseMax;
  }
</script>

<script lang="ts">
  import { MARQUEURS, NUMEROS_CORDES, type Position } from '../../music/manche';
  import { nomSurDeuxLignes, type Notation } from '../../music/notation';
  import { TEXTES } from '../textes';

  // Manche du jeu du mode 1 (spec §5.1), repris de MancheChute du POC « Notes qui tombent » : cordes en colonnes
  // (corde 6 à gauche), cases en lignes de la case 0 en haut à la case 5, 7 ou 12, ligne de jeu en bas. Les notes
  // descendent dans la colonne de leur corde, sur un calque qui laisse passer le doigt : chaque case est un bouton.

  /** Hauteur d'une note en px (voir .note) : à la ligne de jeu, son bas touche la ligne. */
  const HAUTEUR_NOTE_PX = 48;

  interface Props {
    /** Case maximale des notes du niveau ; le manche va jusqu'au palier qui la contient. */
    caseMax: number;
    /** De la plus basse (la note attendue) à la plus haute. */
    notes: readonly NoteAffichee[];
    notation: Notation;
    /** Cases entourées : bonne case après une erreur, nouvelles notes au passage de niveau. */
    rappel?: readonly Position[];
    effets?: readonly Effet[];
    /** Marques par position touchée, clé `${corde}-${case}`. */
    marques?: Record<string, MarqueCase>;
    desactive?: boolean;
    onToucher: (position: Position) => void;
  }

  let {
    caseMax,
    notes,
    notation,
    rappel = [],
    effets = [],
    marques = {},
    desactive = false,
    onToucher,
  }: Props = $props();

  let hauteur = $state(0);
  const derniere = $derived(caseAffichee(caseMax));
  const cases = $derived(Array.from({ length: derniere + 1 }, (_, k) => k));

  const pourcent = (valeur: number) => `${valeur * 100}%`;
  /** Centre de la colonne d'une corde ; corde à vide (corde non demandée), centre du manche. */
  const centre = (question: Question) =>
    question.cordeDemandee ? pourcent((NUMEROS_CORDES.indexOf(question.position.corde) + 0.5) / 6) : '50%';
  const decalage = (progression: number) =>
    `translate(-50%, ${Math.min(progression, 1) * Math.max(0, hauteur - HAUTEUR_NOTE_PX)}px)`;
  const cle = (p: Position) => `${p.corde}-${p.case}`;

  // Navigation au clavier, comme Manche.svelte : une seule case dans l'ordre de tabulation, les flèches la déplacent.
  let focus = $state<Position>({ corde: 6, case: 0 });
  let grille: HTMLDivElement;

  function deplacer(evenement: KeyboardEvent, p: Position): void {
    const index = NUMEROS_CORDES.indexOf(p.corde);
    const cible: Position = { ...p };
    if (evenement.key === 'ArrowLeft') cible.corde = NUMEROS_CORDES[Math.max(0, index - 1)]!;
    else if (evenement.key === 'ArrowRight') cible.corde = NUMEROS_CORDES[Math.min(5, index + 1)]!;
    else if (evenement.key === 'ArrowUp') cible.case = Math.max(0, p.case - 1);
    else if (evenement.key === 'ArrowDown') cible.case = Math.min(derniere, p.case + 1);
    else return;
    evenement.preventDefault();
    focus = cible;
    grille.querySelector<HTMLButtonElement>(`[data-position="${cle(cible)}"]`)?.focus();
  }
</script>

<div class="manche">
  <div class="entete" aria-hidden="true">
    <span></span>
    {#each NUMEROS_CORDES as corde (corde)}<span>{corde}</span>{/each}
  </div>
  <div class="corps">
    <div class="numeros" aria-hidden="true">
      {#each cases as numeroCase (numeroCase)}
        <span>
          {numeroCase === 0 ? '' : numeroCase}
          {#if MARQUEURS.includes(numeroCase)}<span class="marqueur" class:double={numeroCase === 12}></span>{/if}
        </span>
      {/each}
    </div>
    <div class="plateau" bind:clientHeight={hauteur}>
      <div class="cases" role="group" aria-label={TEXTES.manche.nom} bind:this={grille}>
        {#each cases as numeroCase (numeroCase)}
          <div class="ligne" class:sillet={numeroCase === 0}>
            {#each NUMEROS_CORDES as corde (corde)}
              {@const position = { corde, case: numeroCase }}
              {@const marque = marques[cle(position)]}
              <button
                type="button"
                class="case {marque ?? ''}"
                data-position={cle(position)}
                tabindex={focus.corde === corde && focus.case === numeroCase ? 0 : -1}
                disabled={desactive}
                aria-label="{TEXTES.manche.position(corde, numeroCase)}{marque
                  ? `, ${TEXTES.manche.marque[marque]}`
                  : ''}"
                onclick={() => onToucher(position)}
                onfocus={() => (focus = position)}
                onkeydown={(e) => deplacer(e, position)}
              >
                {#if marque}<span class="icone" aria-hidden="true">{marque === 'juste' ? '✓' : '✗'}</span>{/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>

      <div class="calque" aria-hidden="true">
        {#each rappel as position (cle(position))}
          <div
            class="rappel"
            style:left={pourcent(NUMEROS_CORDES.indexOf(position.corde) / 6)}
            style:top={pourcent(position.case / cases.length)}
            style:height={pourcent(1 / cases.length)}
          ></div>
        {/each}
        {#each notes as note, rang (note.index)}
          {@const nom = nomSurDeuxLignes(note.question.nom, notation)}
          <div
            class="note"
            class:attendue={rang === 0}
            class:large={!note.question.cordeDemandee}
            class:faute={note.faute}
            data-index={note.index}
            data-reponse={rang === 0 ? cle(note.question.positionsCorrectes[0]!) : undefined}
            style:left={centre(note.question)}
            style:transform={decalage(note.progression)}
          >
            <span class="nom">{nom.haut}</span>
            {#if nom.bas}<span class="secondaire">{nom.bas}</span>{/if}
            {#if !note.question.cordeDemandee}<span class="secondaire">{TEXTES.manche.aVide.toLowerCase()}</span>{/if}
          </div>
        {/each}
        {#each effets as effet (effet.id)}
          <div
            class="effet"
            class:juste={effet.juste}
            class:faux={!effet.juste}
            style:left={centre(effet.question)}
            style:transform={decalage(effet.progression)}
          >
            {effet.juste ? '✓' : '✗'}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .manche {
    display: flex;
    flex-direction: column;
    height: 100%;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .entete,
  .corps {
    display: grid;
    grid-template-columns: 1.5rem 1fr;
  }
  .entete {
    grid-template-columns: 1.5rem repeat(6, 1fr);
    font-size: 0.8125rem;
    color: var(--discret);
    text-align: center;
    padding-bottom: 0.25rem;
  }
  .corps {
    flex: 1;
    min-height: 0;
  }
  .numeros {
    display: grid;
    grid-auto-rows: minmax(44px, 1fr);
    font-size: 0.75rem;
    color: var(--discret);
    border-bottom: 4px solid transparent;
  }
  .numeros > span {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .marqueur {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--discret);
  }
  .marqueur.double {
    box-shadow: 0 8px 0 var(--discret);
    margin-bottom: 8px;
  }
  .plateau {
    position: relative;
    overflow: hidden;
    /* Ligne de jeu : les notes doivent être touchées avant de l'atteindre. */
    border-bottom: 4px solid var(--lien);
  }
  .cases {
    display: grid;
    grid-auto-rows: minmax(44px, 1fr);
    height: 100%;
  }
  .calque {
    position: absolute;
    inset: 0;
    /* Le doigt traverse les notes qui tombent et atteint la case. */
    pointer-events: none;
  }
  .ligne {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-bottom: 2px solid var(--frette);
  }
  .ligne:last-child {
    border-bottom: none;
  }
  .ligne.sillet {
    border-bottom: 6px solid var(--sillet);
  }
  .case {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0;
    border: none;
    border-radius: 0;
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
  .case:active:not(:disabled) {
    background: var(--evidence);
  }
  .case:disabled {
    cursor: default;
  }
  .case:focus-visible {
    outline: 3px solid var(--lien);
    outline-offset: -3px;
  }
  .icone {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 1rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sur-couleur);
    animation: effacement 600ms ease-out forwards;
  }
  .juste .icone {
    background: var(--juste);
  }
  .faux .icone {
    background: var(--faux);
  }
  .rappel {
    position: absolute;
    width: calc(100% / 6);
    border: 3px solid var(--juste);
    border-radius: 8px;
    background: color-mix(in srgb, var(--juste) 20%, transparent);
  }
  .note,
  .effet {
    position: absolute;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 48px;
    padding: 0 0.25rem;
    border-radius: 24px;
    line-height: 1.05;
    will-change: transform;
  }
  .note {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--texte);
    background: var(--surface);
    border: 2px solid var(--cadre);
    opacity: 0.75;
  }
  .note.attendue {
    border: 3px solid var(--lien);
    background: var(--evidence);
    opacity: 0.95;
  }
  .note.large {
    min-width: 5rem;
  }
  /* Le décalage de chute passe par transform ; la secousse par translate, qui s'y ajoute. */
  .note.faute {
    border-color: var(--faux);
    background: color-mix(in srgb, var(--faux) 20%, var(--surface));
    animation: secousse 300ms ease-in-out;
  }
  @keyframes secousse {
    25% {
      translate: -4px 0;
    }
    75% {
      translate: 4px 0;
    }
  }
  .secondaire {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--discret);
  }
  .effet {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sur-couleur);
    animation: effacement 600ms ease-out forwards;
  }
  .effet.juste {
    background: var(--juste);
  }
  .effet.faux {
    background: var(--faux);
  }
  @keyframes effacement {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 1.4;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .effet,
    .icone,
    .note.faute {
      animation-name: none;
    }
  }
</style>
