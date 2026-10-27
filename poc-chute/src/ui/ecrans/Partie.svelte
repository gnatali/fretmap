<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { MesureImages, type PartieJournal } from '../../jeu/journal';
  import {
    DUREE_RAPPEL_CASE_MS,
    NOTES_PAR_PARTIE,
    Partie,
    type EvenementPartie,
    type ReglagesPartie,
  } from '../../jeu/partie';
  import { bornerDuree } from '../../jeu/vitesse';
  import type { Position } from '../../music/manche';
  import type { Statistique } from '../../progression/modele';
  import { caseMaxDuNiveau } from '../../progression/niveaux';
  import MancheChute, { type Effet, type NoteAffichee } from '../composants/MancheChute.svelte';
  import { TEXTES, consigne, duree, retour } from '../textes';

  // Écran de jeu (spec §6.2 à §6.4) : compte à rebours, puis une image par requestAnimationFrame. La partie
  // (jeu/partie.ts) décide de tout ; l'écran copie son état à chaque image et affiche les retours.

  /** Compte à rebours avant la première note, en secondes : 3 (spec §6.1). */
  const COMPTE_A_REBOURS_S = 3;
  /** Durée de l'effet vert ou rouge laissé par une note, en ms : 600 (affichage seulement, voir .effet). */
  const DUREE_EFFET_MS = 600;

  interface Props {
    reglages: ReglagesPartie;
    statistiques: readonly Statistique[];
    /** Partie jouée au clavier, sans micro (spec §6.9). */
    simulation: boolean;
    onFin: (journal: PartieJournal, statistiques: readonly Statistique[]) => void;
    /** « Arrêter » pendant le compte à rebours : rien n'est enregistré. */
    onAnnuler: () => void;
    /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
    hasard?: () => number;
  }

  let { reglages, statistiques, simulation, onFin, onAnnuler, hasard }: Props = $props();

  const caseMax = $derived(caseMaxDuNiveau(reglages.niveau, 2));
  let compte = $state(COMPTE_A_REBOURS_S);
  let partie: Partie | null = null;
  const mesure = new MesureImages();
  let dernierT: number | null = null;
  let boucle = 0;
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  // État copié de la partie à chaque image.
  let notes = $state.raw<NoteAffichee[]>([]);
  let score = $state(0);
  let serie = $state(0);
  let multiplicateur = $state(1);
  let restantes = $state(NOTES_PAR_PARTIE);
  // svelte-ignore state_referenced_locally
  let dureeChute = $state(bornerDuree(reglages.dureeInitialeMs));
  let dernierRetour = $state<{ texte: string; juste: boolean } | null>(null);
  let rappel = $state.raw<{ positions: readonly Position[]; jusqua: number } | null>(null);
  let effets = $state.raw<(Effet & { jusqua: number })[]>([]);
  let numeroEffet = 0;

  const attendue = $derived(notes[0] ?? null);

  function decompter(): void {
    compte -= 1;
    if (compte > 0) minuteur = setTimeout(decompter, 1000);
    else commencer();
  }

  function commencer(): void {
    const t = performance.now();
    partie = new Partie(reglages, statistiques, { debutMs: t, date: new Date(), hasard, simulation });
    rafraichir(t);
    boucle = requestAnimationFrame(image);
  }

  /** Une image : mesure de sa durée (HC1), avance de la chute, retours, copie de l'état. */
  function image(t: number): void {
    if (!partie) return;
    if (dernierT !== null) mesure.ajouter(t - dernierT);
    dernierT = t;
    traiter(partie.avancer(t), t);
    rafraichir(t);
    if (!partie.terminee) boucle = requestAnimationFrame(image);
  }

  function traiter(evenements: EvenementPartie[], t: number): void {
    for (const evenement of evenements) {
      if (evenement.type === 'resultat') {
        const juste = evenement.resultat === 'juste';
        const { question, progression } = evenement.note;
        dernierRetour = { texte: retour(evenement, reglages.notation), juste };
        effets = [...effets, { id: ++numeroEffet, question, progression, juste, jusqua: t + DUREE_EFFET_MS }];
        if (!juste) rappel = { positions: question.positionsCorrectes, jusqua: t + DUREE_RAPPEL_CASE_MS };
      } else if (evenement.type === 'fin') {
        terminer();
      }
    }
  }

  function rafraichir(t: number): void {
    if (!partie) return;
    notes = partie.notes.map(({ index, question, progression }) => ({ index, question, progression }));
    score = partie.score;
    serie = partie.serie;
    multiplicateur = partie.multiplicateur;
    restantes = partie.notesRestantes;
    dureeChute = partie.dureeChuteMs;
    if (effets.some((e) => e.jusqua <= t)) effets = effets.filter((e) => e.jusqua > t);
    if (rappel && rappel.jusqua <= t) rappel = null;
  }

  function terminer(): void {
    if (!partie) return;
    cancelAnimationFrame(boucle);
    const journal = partie.journal({
      navigateur: navigator.userAgent,
      // Micro branché en phase 4 : seuil et traitements viendront de l'écoute.
      seuilSilenceDbfs: null,
      traitementsActifs: [],
      images: mesure.resultat(),
    });
    onFin(journal, partie.statistiques);
  }

  /** Mode simulation : joue la note attendue, juste ou un demi-ton au-dessus. */
  function jouer(juste: boolean): void {
    if (!partie || partie.terminee) return;
    const t = performance.now();
    traiter(partie.jouerSimule(juste, t), t);
    rafraichir(t);
  }

  function arreter(): void {
    if (!partie) {
      onAnnuler();
      return;
    }
    traiter(partie.arreter(), performance.now());
  }

  function touche(evenement: KeyboardEvent): void {
    if (!simulation || evenement.repeat) return;
    // Sur un bouton, Espace le déclenche déjà : ne pas jouer deux fois.
    const surBouton = evenement.target instanceof HTMLButtonElement;
    if (evenement.key === ' ' && !surBouton) {
      evenement.preventDefault();
      jouer(true);
    } else if (evenement.key === 'f' || evenement.key === 'F') {
      jouer(false);
    }
  }

  onMount(() => {
    minuteur = setTimeout(decompter, 1000);
  });

  onDestroy(() => {
    clearTimeout(minuteur);
    cancelAnimationFrame(boucle);
  });
</script>

<svelte:window onkeydown={touche} />

<div class="ecran">
  <header class="barre-jeu">
    <dl class="compteurs">
      <div>
        <dt>{TEXTES.partie.score}</dt>
        <dd class="score">{score}</dd>
      </div>
      <div>
        <dt>{TEXTES.partie.serie}</dt>
        <dd class="serie">{serie} <span class="multiplicateur">×{multiplicateur}</span></dd>
      </div>
      <div>
        <dt>{TEXTES.partie.restantes}</dt>
        <dd class="restantes">{restantes}</dd>
      </div>
      <div>
        <dt>{TEXTES.partie.chute}</dt>
        <dd class="chute">{duree(dureeChute)}</dd>
      </div>
    </dl>
    <button type="button" class="secondaire" onclick={arreter}>{TEXTES.partie.arreter}</button>
  </header>

  <div class="zone">
    <MancheChute
      {caseMax}
      {notes}
      notation={reglages.notation}
      afficherCase={reglages.afficherCase}
      rappel={rappel?.positions ?? []}
      {effets}
    />
    {#if compte > 0}
      <p class="compte" aria-live="assertive">
        <span class="sr-only">{TEXTES.partie.compteARebours}</span>
        {compte}
      </p>
    {/if}
  </div>

  <p class="consigne" aria-live="polite">
    {attendue ? consigne(attendue.question, reglages.notation, reglages.afficherCase) : ''}
  </p>
  <p
    class="retour"
    class:juste={dernierRetour?.juste}
    class:faux={!!dernierRetour && !dernierRetour.juste}
    role="status"
  >
    {dernierRetour?.texte ?? ''}
  </p>

  {#if simulation}
    <div class="simulation">
      <button type="button" class="principal" onclick={() => jouer(true)}>{TEXTES.partie.jouer}</button>
      <button type="button" class="secondaire" onclick={() => jouer(false)}>{TEXTES.partie.fausse}</button>
    </div>
  {/if}
</div>

<style>
  .ecran {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    /* Hauteur de la fenêtre moins les marges de main (styles.css). */
    height: calc(100dvh - 3.5rem);
    min-height: 26rem;
  }
  .barre-jeu {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .compteurs {
    display: grid;
    grid-template-columns: repeat(4, auto);
    gap: 0.75rem;
    margin: 0;
  }
  .compteurs div {
    display: flex;
    flex-direction: column;
  }
  dt {
    font-size: 0.75rem;
    color: var(--discret);
  }
  dd {
    margin: 0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .multiplicateur {
    font-weight: 500;
    color: var(--discret);
  }
  .zone {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .compte {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 4rem;
    font-weight: 700;
  }
  .consigne,
  .retour {
    margin: 0;
    min-height: 1.5rem;
    text-align: center;
  }
  .consigne {
    font-weight: 600;
  }
  .retour {
    font-weight: 700;
  }
  .retour.juste {
    color: var(--juste);
  }
  .retour.faux {
    color: var(--faux);
  }
  .simulation {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
