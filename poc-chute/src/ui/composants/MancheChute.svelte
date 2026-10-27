<script lang="ts" module>
  import type { Question } from '../../quiz/tirage';

  /** Note à l'écran, copiée de la partie à chaque image. */
  export interface NoteAffichee {
    index: number;
    question: Question;
    /** 0 = apparition en haut, 1 = ligne de jeu. */
    progression: number;
  }

  /** Effet vert ou rouge laissé par une note jouée, détruite ou ratée. */
  export interface Effet {
    id: number;
    question: Question;
    progression: number;
    juste: boolean;
  }
</script>

<script lang="ts">
  import { MARQUEURS, NUMEROS_CORDES, type Position } from '../../music/manche';
  import { nomSurDeuxLignes, type Notation } from '../../music/notation';
  import { TEXTES } from '../textes';

  // Manche vertical (spec §6.2) : cordes en colonnes (corde 6 à gauche), cases en lignes de la case 0 en haut à la
  // case maximale du niveau, ligne de jeu en bas. Les notes descendent dans la colonne de leur corde.

  /** Hauteur d'une note en px (voir .note) : à la ligne de jeu, son bas touche la ligne. */
  const HAUTEUR_NOTE_PX = 48;

  interface Props {
    caseMax: number;
    /** De la plus basse (la note attendue) à la plus haute. */
    notes: readonly NoteAffichee[];
    notation: Notation;
    /** Option de mesure : l'étiquette donne aussi la case (spec §6.9). */
    afficherCase?: boolean;
    /** Bonnes cases montrées après une erreur (spec §6.2). */
    rappel?: readonly Position[];
    effets?: readonly Effet[];
  }

  let { caseMax, notes, notation, afficherCase = false, rappel = [], effets = [] }: Props = $props();

  let hauteur = $state(0);
  const cases = $derived(Array.from({ length: caseMax + 1 }, (_, k) => k));

  const pourcent = (valeur: number) => `${valeur * 100}%`;
  /** Centre de la colonne d'une corde ; au niveau 1 (corde non demandée), centre du manche. */
  const centre = (question: Question) =>
    question.cordeDemandee ? pourcent((NUMEROS_CORDES.indexOf(question.position.corde) + 0.5) / 6) : '50%';
  const decalage = (progression: number) =>
    `translate(-50%, ${Math.min(progression, 1) * Math.max(0, hauteur - HAUTEUR_NOTE_PX)}px)`;
  const cle = (p: Position) => `${p.corde}-${p.case}`;
</script>

<div class="manche" role="img" aria-label={TEXTES.manche.nom}>
  <div class="entete" aria-hidden="true">
    <span></span>
    {#each NUMEROS_CORDES as corde (corde)}<span>{corde}</span>{/each}
  </div>
  <div class="corps">
    <div class="numeros" aria-hidden="true">
      {#each cases as numeroCase (numeroCase)}<span>{numeroCase === 0 ? '' : numeroCase}</span>{/each}
    </div>
    <div class="plateau" bind:clientHeight={hauteur}>
      <div class="cases">
        {#each cases as numeroCase (numeroCase)}
          <div class="case" class:sillet={numeroCase === 0}>
            {#if MARQUEURS.includes(numeroCase)}
              <span class="marqueur" class:double={numeroCase === 12}></span>
            {/if}
          </div>
        {/each}
      </div>
      <div class="cordes">
        {#each NUMEROS_CORDES as corde (corde)}<span class="corde"></span>{/each}
      </div>

      {#each rappel as position (cle(position))}
        <div
          class="rappel"
          data-position={cle(position)}
          style:left={pourcent(NUMEROS_CORDES.indexOf(position.corde) / 6)}
          style:top={pourcent(position.case / cases.length)}
          style:height={pourcent(1 / cases.length)}
        ></div>
      {/each}

      <div class="calque" aria-hidden="true">
        {#each notes as note, rang (note.index)}
          {@const nom = nomSurDeuxLignes(note.question.nom, notation)}
          <div
            class="note"
            class:attendue={rang === 0}
            class:large={!note.question.cordeDemandee}
            data-index={note.index}
            style:left={centre(note.question)}
            style:transform={decalage(note.progression)}
          >
            <span class="nom">{nom.haut}</span>
            {#if nom.bas}<span class="secondaire">{nom.bas}</span>{/if}
            {#if afficherCase && note.question.cordeDemandee}
              <span class="secondaire">{TEXTES.manche.caseCourte(note.question.position.case)}</span>
            {/if}
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
    grid-auto-rows: 1fr;
    font-size: 0.75rem;
    color: var(--discret);
    border-bottom: 4px solid transparent;
  }
  .numeros span {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .plateau {
    position: relative;
    overflow: hidden;
    /* Ligne de jeu : les notes doivent être jouées avant de la toucher. */
    border-bottom: 4px solid var(--lien);
  }
  .cases,
  .cordes,
  .calque {
    position: absolute;
    inset: 0;
  }
  .cases {
    display: grid;
    grid-auto-rows: 1fr;
  }
  .case {
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 2px solid var(--frette);
  }
  .case:last-child {
    border-bottom: none;
  }
  .case.sillet {
    border-bottom: 6px solid var(--sillet);
  }
  .marqueur {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--frette);
  }
  .marqueur.double {
    box-shadow: 14px 0 0 var(--frette);
    margin-right: 14px;
  }
  .cordes {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
  }
  .corde {
    justify-self: center;
    width: 2px;
    background: var(--corde);
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
    opacity: 1;
  }
  .note.large {
    min-width: 5rem;
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
    .effet {
      animation-name: none;
    }
  }
</style>
