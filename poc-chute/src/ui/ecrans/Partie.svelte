<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { EtatDetection } from '../../audio/pitch';
  import type { Ecoute } from '../../ecoute.svelte';
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
  import { nomAffiche } from '../../music/notation';
  import type { NoteDetectee } from '../../music/notes';
  import type { Statistique } from '../../progression/modele';
  import { caseMaxDuNiveau } from '../../progression/niveaux';
  import Indicateur from '../composants/Indicateur.svelte';
  import MancheChute, { type Effet, type NoteAffichee } from '../composants/MancheChute.svelte';
  import { TEXTES, consigne, duree, retour } from '../textes';

  // Écran de jeu (spec §6.2 à §6.4) : calibrage du micro, compte à rebours, puis une image par
  // requestAnimationFrame. La partie (jeu/partie.ts) décide de tout ; l'écran copie son état à chaque image,
  // lui transmet les détections du micro et affiche les retours. Le micro est démarré et arrêté par App.svelte.

  /** Compte à rebours avant la première note, en secondes : 3 (spec §6.1). */
  const COMPTE_A_REBOURS_S = 3;
  /** Durée de l'effet vert ou rouge laissé par une note, en ms : 600 (affichage seulement, voir .effet). */
  const DUREE_EFFET_MS = 600;

  interface Props {
    reglages: ReglagesPartie;
    statistiques: readonly Statistique[];
    /** Écoute du micro, déjà démarrée ; null en mode simulation (partie au clavier, spec §6.9). */
    ecoute: Ecoute | null;
    onFin: (journal: PartieJournal, statistiques: readonly Statistique[]) => void;
    /** « Arrêter » avant le début de la partie (calibrage, compte à rebours) : rien n'est enregistré. */
    onAnnuler: () => void;
    /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
    hasard?: () => number;
  }

  let { reglages, statistiques, ecoute, onFin, onAnnuler, hasard }: Props = $props();

  // svelte-ignore state_referenced_locally
  const simulation = ecoute === null;
  const caseMax = $derived(caseMaxDuNiveau(reglages.niveau, 2));
  /** Micro calibré (ou simulation) : le compte à rebours peut partir. */
  const pret = $derived(ecoute === null || ecoute.statut === 'actif');
  let compte = $state(COMPTE_A_REBOURS_S);
  let decompteLance = false;
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
  // Indicateur du micro.
  let entendue = $state.raw<NoteDetectee | null>(null);
  /** Message de la note attendue (non reconnue, ancienne note), effacé à son résultat. */
  let info = $state<string | null>(null);
  let silence = $state(false);

  const attendue = $derived(notes[0] ?? null);
  const message = $derived(info ?? (silence ? TEXTES.indicateur.jouez : null));

  $effect(() => {
    if (!pret || decompteLance) return;
    decompteLance = true;
    minuteur = setTimeout(decompter, 1000);
  });

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

  /**
   * État de la chaîne de détection, après le calibrage : indicateur, puis règles du mode 2 pendant la partie.
   * Le manche et les compteurs suivent à l'image suivante : un seul rendu par image (HC1).
   */
  function surDetection(etat: EtatDetection): void {
    if (etat.stable) entendue = etat.stable;
    if (!partie || partie.terminee) return;
    traiter(partie.traiterDetection(etat), etat.tMs);
    silence = partie.silenceProlonge(etat.tMs);
  }

  function traiter(evenements: EvenementPartie[], t: number): void {
    for (const evenement of evenements) {
      if (evenement.type === 'resultat') {
        const juste = evenement.resultat === 'juste';
        const { question, progression } = evenement.note;
        info = null;
        dernierRetour = { texte: retour(evenement, reglages.notation), juste };
        effets = [...effets, { id: ++numeroEffet, question, progression, juste, jusqua: t + DUREE_EFFET_MS }];
        if (!juste) rappel = { positions: question.positionsCorrectes, jusqua: t + DUREE_RAPPEL_CASE_MS };
      } else if (evenement.type === 'nonReconnue') {
        info = TEXTES.indicateur.nonReconnue;
      } else if (evenement.type === 'ancienneNote') {
        const { nom, octave } = evenement.detectee;
        info = TEXTES.indicateur.ancienneNote(nomAffiche(nom, reglages.notation, octave));
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
      seuilSilenceDbfs: ecoute?.seuilDbfs ?? null,
      traitementsActifs: ecoute ? [...ecoute.traitementsActifs] : [],
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

  /** Onglet en arrière-plan : la partie s'arrête, comme le mode 2 de l'application coupe le micro. */
  function surVisibilite(): void {
    if (document.hidden) arreter();
  }

  onMount(() => {
    ecoute?.ecouter(surDetection);
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  });

  onDestroy(() => {
    ecoute?.ecouter(null);
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
    {#if !pret}
      <p class="preparation" aria-live="polite">
        <span>{ecoute?.statut === 'calibrage' ? TEXTES.micro.calibrage : TEXTES.micro.demarrage}</span>
      </p>
    {:else if compte > 0}
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

  {#if ecoute}
    <Indicateur
      {entendue}
      enCours={!!ecoute.detection?.stable}
      niveauDbfs={ecoute.detection?.niveauDbfs ?? null}
      seuilDbfs={ecoute.seuilDbfs}
      {message}
      notation={reglages.notation}
    />
    {#if ecoute.traitementsActifs.length > 0}
      <p class="alerte">
        {TEXTES.micro.traitements(ecoute.traitementsActifs.map((t) => TEXTES.micro.nomsTraitements[t]))}
      </p>
    {/if}
  {:else}
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
  .compte,
  .preparation {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-weight: 700;
  }
  .compte {
    font-size: 4rem;
  }
  .preparation {
    padding: 0 1rem;
    font-size: 1.125rem;
    text-align: center;
  }
  .preparation span {
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 10px;
  }
  .alerte {
    margin: 0;
    font-size: 0.875rem;
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
