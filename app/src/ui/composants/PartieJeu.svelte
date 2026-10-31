<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { HorlogeJeu } from '../../jeu/horloge';
  import { MesureImages, type PartieJournal } from '../../jeu/journal';
  import { DUREE_PAUSE_NIVEAU_MS, Partie, type EvenementPartie } from '../../jeu/partie';
  import { reglagesDe, type Difficulte } from '../../jeu/niveauxDifficulte';
  import { noteDePosition, type Position } from '../../music/manche';
  import type { Notation } from '../../music/notation';
  import { TEXTES, consigne, nomPosition, pourcent, retourEssai, retourFausse } from '../textes';
  import MancheJeu, { caseAffichee, type Effet, type MarqueCase, type NoteAffichee } from './MancheJeu.svelte';

  // Partie du jeu du mode 1 (spec §5.1), reprise de l'écran de partie du POC « Notes qui tombent », sans micro :
  // compte à rebours, puis une image par requestAnimationFrame. La partie (jeu/partie.ts) décide de tout ; l'écran
  // copie son état à chaque image, lui transmet les cases touchées et affiche les retours. Tous les temps donnés à la
  // partie passent par l'horloge du jeu, qui retire les pauses.

  /** Compte à rebours avant la première note et après une pause, en secondes : 3 (POC, spec §6.1). */
  const COMPTE_A_REBOURS_S = 3;
  /** Durée de l'effet vert ou rouge laissé par une note, et des marques des cases touchées, en ms : 600. */
  const DUREE_EFFET_MS = 600;
  /** Bonne case montrée après une note perdue ou ratée, en ms : 1,5 s (POC, spec §6.2). */
  const DUREE_RAPPEL_CASE_MS = 1500;

  interface Props {
    /** Niveau et notes de départ (reprise). */
    niveau: number;
    positions: readonly Position[];
    notation: Notation;
    /** Difficulté de la partie : condition de passage de niveau. */
    difficulte: Difficulte;
    /** Chaque événement de la partie (statistiques par position). */
    onEvenement: (evenement: EvenementPartie) => void;
    /** Niveau validé : où reprendre est enregistré. */
    onNiveau: (partie: Partie) => void;
    onFin: (journal: PartieJournal, partie: Partie) => void;
    /** « Arrêter » pendant le compte à rebours du départ : rien n'est enregistré. */
    onAnnuler: () => void;
    /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
    hasard?: () => number;
  }

  let {
    niveau: niveauDepart,
    positions,
    notation,
    difficulte,
    onEvenement,
    onNiveau,
    onFin,
    onAnnuler,
    hasard,
  }: Props = $props();

  /** compte : compte à rebours (départ ou reprise) ; jeu : la partie tourne ; pause. */
  let phase = $state<'compte' | 'jeu' | 'pause'>('compte');
  let compte = $state(COMPTE_A_REBOURS_S);
  let partie: Partie | null = null;
  let enPartie = $state(false);
  const horloge = new HorlogeJeu();
  /** Temps du jeu au début de la partie (origine des pauses du journal). */
  let debutJeu = 0;
  const mesure = new MesureImages();
  let dernierT: number | null = null;
  let boucle = 0;
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  // État copié de la partie à chaque image.
  let notes = $state.raw<NoteAffichee[]>([]);
  // svelte-ignore state_referenced_locally
  let caseMax = $state(Math.max(...positions.map((p) => p.case)));
  let score = $state(0);
  let multiplicateur = $state(1);
  // svelte-ignore state_referenced_locally
  let niveau = $state(niveauDepart);
  let reussite = $state(0);
  let vitesse = $state(0);
  /** Passage de niveau : bilan affiché pendant la pause du jeu (temps du jeu de la reprise). */
  let passage = $state.raw<{
    niveau: number;
    bonus: number;
    ajoutees: Position[];
    plafond: number;
    reprise: number;
  } | null>(null);
  let resteAvantReprise = $state(0);
  let dernierRetour = $state<{ texte: string; juste: boolean } | null>(null);
  /** Cases entourées : bonne case de la note `index` après une erreur, ou nouvelles notes (index −1). */
  let rappel = $state.raw<{ index: number; positions: readonly Position[]; jusqua: number } | null>(null);
  /** Note qui vient de recevoir une case fausse (clignotement rouge). */
  let faute: { index: number; jusqua: number } | null = null;
  let effets = $state.raw<(Effet & { jusqua: number })[]>([]);
  let numeroEffet = 0;
  let marques = $state.raw<{ cle: string; marque: MarqueCase; jusqua: number }[]>([]);

  const attendue = $derived(notes[0] ?? null);
  const marquesParCase = $derived(Object.fromEntries(marques.map((m) => [m.cle, m.marque])));

  function lancerCompte(): void {
    phase = 'compte';
    compte = COMPTE_A_REBOURS_S;
    minuteur = setTimeout(decompter, 1000);
  }

  function decompter(): void {
    compte -= 1;
    if (compte > 0) minuteur = setTimeout(decompter, 1000);
    else if (partie) relancer();
    else commencer();
  }

  function commencer(): void {
    const t = horloge.jeu(performance.now());
    debutJeu = t;
    partie = new Partie(reglagesDe(difficulte), {
      debutMs: t,
      date: new Date(),
      hasard,
      niveau: niveauDepart,
      positions,
      notation,
      difficulte,
    });
    enPartie = true;
    phase = 'jeu';
    rafraichir(t);
    boucle = requestAnimationFrame(image);
  }

  /** Fin du compte à rebours après une pause : le temps du jeu repart, la boucle aussi. */
  function relancer(): void {
    horloge.reprendre(performance.now());
    phase = 'jeu';
    boucle = requestAnimationFrame(image);
  }

  /** Pause (bouton, touche P, ou onglet en arrière-plan) ; une pause pendant le compte à rebours de reprise y revient. */
  function pauser(arrierePlan: boolean): void {
    if (!partie || partie.terminee || phase === 'pause') return;
    clearTimeout(minuteur);
    cancelAnimationFrame(boucle);
    // La boucle repartira sans compter la durée de la pause comme une image.
    dernierT = null;
    horloge.pauser(performance.now(), arrierePlan);
    phase = 'pause';
  }

  function reprendre(): void {
    if (phase === 'pause') lancerCompte();
  }

  /** Une image : mesure de sa durée, avance de la chute, retours, copie de l'état. */
  function image(t: number): void {
    if (!partie || phase !== 'jeu') return;
    if (dernierT !== null) mesure.ajouter(t - dernierT);
    dernierT = t;
    const tJeu = horloge.jeu(t);
    traiter(partie.avancer(tJeu), tJeu);
    rafraichir(tJeu);
    if (!partie.terminee) boucle = requestAnimationFrame(image);
  }

  function toucher(position: Position): void {
    if (!partie || partie.terminee || phase !== 'jeu') return;
    const t = horloge.jeu(performance.now());
    traiter(partie.toucher(position, t), t);
    rafraichir(t);
  }

  function marquer(position: Position, marque: MarqueCase, t: number): void {
    const cle = `${position.corde}-${position.case}`;
    marques = [...marques.filter((m) => m.cle !== cle), { cle, marque, jusqua: t + DUREE_EFFET_MS }];
  }

  function traiter(evenements: EvenementPartie[], t: number): void {
    for (const evenement of evenements) {
      if (evenement.type !== 'fin') onEvenement(evenement);
      if (evenement.type === 'resultat') {
        const juste = evenement.resultat === 'juste';
        const { question, progression, index } = evenement.note;
        dernierRetour = { texte: retourEssai({ ...evenement, question }, notation), juste };
        effets = [...effets, { id: ++numeroEffet, question, progression, juste, jusqua: t + DUREE_EFFET_MS }];
        if (evenement.touchee) marquer(evenement.touchee, juste ? 'juste' : 'faux', t);
        if (!juste) rappel = { index, positions: question.positionsCorrectes, jusqua: t + DUREE_RAPPEL_CASE_MS };
        else if (rappel?.index === index) rappel = null;
      } else if (evenement.type === 'fausse') {
        dernierRetour = { texte: retourFausse(evenement.penalite), juste: false };
        faute = { index: evenement.note.index, jusqua: t + DUREE_EFFET_MS };
        marquer(evenement.touchee, 'faux', t);
      } else if (evenement.type === 'niveau') {
        // Bilan et nouvelles notes, entourées sur le manche pendant la pause du jeu.
        const { niveau: nouveau, bonus, ajoutees, plafond } = evenement;
        passage = { niveau: nouveau - 1, bonus, ajoutees, plafond, reprise: t + DUREE_PAUSE_NIVEAU_MS };
        rappel = { index: -1, positions: ajoutees, jusqua: t + DUREE_PAUSE_NIVEAU_MS };
        if (partie) onNiveau(partie);
      } else if (evenement.type === 'fin') {
        terminer();
      }
    }
  }

  function rafraichir(t: number): void {
    if (!partie) return;
    if (faute && faute.jusqua <= t) faute = null;
    notes = partie.notes.map(({ index, question, progression }) => ({
      index,
      question,
      progression,
      faute: faute?.index === index,
    }));
    score = partie.score;
    multiplicateur = partie.multiplicateur;
    caseMax = partie.caseMax;
    niveau = partie.niveau;
    reussite = partie.reussiteGlobale;
    vitesse = partie.vitesse;
    if (passage && !partie.enPause) passage = null;
    if (passage) resteAvantReprise = Math.max(1, Math.ceil((passage.reprise - t) / 1000));
    if (effets.some((e) => e.jusqua <= t)) effets = effets.filter((e) => e.jusqua > t);
    if (marques.some((m) => m.jusqua <= t)) marques = marques.filter((m) => m.jusqua > t);
    if (rappel && rappel.jusqua <= t) rappel = null;
  }

  function terminer(): void {
    if (!partie) return;
    cancelAnimationFrame(boucle);
    const journal = partie.journal({
      navigateur: navigator.userAgent,
      images: mesure.resultat(),
      pauses: horloge.pauses(debutJeu, performance.now()),
    });
    onFin(journal, partie);
  }

  function arreter(): void {
    clearTimeout(minuteur);
    if (!partie) {
      onAnnuler();
      return;
    }
    traiter(partie.arreter(), horloge.jeu(performance.now()));
  }

  function touche(evenement: KeyboardEvent): void {
    if (evenement.repeat || (evenement.key !== 'p' && evenement.key !== 'P')) return;
    if (phase === 'pause') reprendre();
    else pauser(false);
  }

  /** Onglet en arrière-plan : pause automatique ; avant la première note, retour au départ, comme « Arrêter ». */
  function surVisibilite(): void {
    if (!document.hidden) return;
    if (partie) pauser(true);
    else arreter();
  }

  onMount(() => {
    lancerCompte();
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
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
        <dd class="score">{score} <span class="multiplicateur">×{multiplicateur}</span></dd>
      </div>
      <div>
        <dt>{TEXTES.partie.niveau}</dt>
        <dd class="niveau">{niveau}</dd>
      </div>
      <div>
        <dt>{TEXTES.partie.reussite}</dt>
        <dd class="reussite">{pourcent(reussite)}</dd>
      </div>
      <div>
        <dt>{TEXTES.partie.vitesse}</dt>
        <dd class="vitesse">{pourcent(vitesse)}</dd>
      </div>
    </dl>
    <div class="actions">
      {#if enPartie}
        <button
          type="button"
          class="secondaire pause"
          aria-label={TEXTES.partie.pause}
          title={TEXTES.partie.pause}
          disabled={phase !== 'jeu'}
          onclick={() => pauser(false)}
        >
          <!-- Symbole « pause » dessiné : deux barres (le caractère ⏸ est trop petit sur Android). -->
          <span class="barres" aria-hidden="true"></span>
        </button>
      {/if}
      <button type="button" class="secondaire" onclick={arreter}>{TEXTES.partie.arreter}</button>
    </div>
  </header>

  <p class="consigne" aria-live="polite">{attendue ? consigne(attendue.question, notation) : ''}</p>

  <div class="zone">
    <MancheJeu
      {caseMax}
      {notes}
      {notation}
      rappel={(rappel?.positions ?? []).filter((p) => p.case <= caseAffichee(caseMax))}
      {effets}
      marques={marquesParCase}
      desactive={phase !== 'jeu' || passage !== null}
      onToucher={toucher}
    />
    {#if enPartie && phase !== 'jeu'}
      <!-- Pause et reprise : le manche est masqué, pour ne pas chercher la case hors du temps de jeu. -->
      <div class="cache" role="group" aria-label={TEXTES.partie.enPause}>
        {#if phase === 'pause'}
          <p class="titre-cache">{TEXTES.partie.enPause}</p>
          <button type="button" class="principal" onclick={reprendre}>{TEXTES.partie.reprendre}</button>
        {:else}
          <p class="compte-reprise" aria-live="assertive">
            <span class="sr-only">{TEXTES.partie.repriseDans}</span>
            {compte}
          </p>
        {/if}
      </div>
    {:else if phase === 'compte'}
      <p class="compte" aria-live="assertive">
        <span class="sr-only">{TEXTES.partie.compteARebours}</span>
        {compte}
      </p>
    {/if}
  </div>

  {#if passage && phase === 'jeu'}
    <!-- Passage de niveau : sous le manche, pour ne pas cacher les nouvelles notes entourées. -->
    <div class="passage" aria-live="polite">
      <p class="titre-passage">{TEXTES.partie.niveauValide(passage.niveau, passage.bonus)}</p>
      {#if passage.ajoutees.length === 0}
        <p>{TEXTES.partie.mancheComplet}</p>
      {:else}
        <p>{TEXTES.partie.nouvellesNotes}</p>
        <ul>
          {#each passage.ajoutees as p (`${p.corde}-${p.case}`)}
            <li>{nomPosition(p, noteDePosition(p).nom, notation)}</li>
          {/each}
        </ul>
      {/if}
      <p class="plafond">{TEXTES.partie.plafond(pourcent(passage.plafond))}</p>
      <p class="reprise">{TEXTES.partie.repriseNiveau(resteAvantReprise)}</p>
    </div>
  {:else}
    <p
      class="retour"
      class:juste={dernierRetour?.juste}
      class:faux={!!dernierRetour && !dernierRetour.juste}
      role="status"
    >
      {dernierRetour?.texte ?? ''}
    </p>
  {/if}
</div>

<style>
  .ecran {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    /* Hauteur de la fenêtre moins les marges de main (styles.css). */
    height: calc(100dvh - 3.5rem);
    min-height: 34rem;
  }
  .barre-jeu {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .actions {
    display: flex;
    flex-shrink: 0;
    gap: 0.375rem;
  }
  .pause {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    padding: 0 0.5rem;
  }
  .barres {
    width: 14px;
    height: 16px;
    border-inline: 5px solid currentColor;
  }
  .pause:disabled {
    opacity: 0.55;
  }
  .compteurs {
    /* Les compteurs passent sur deux lignes quand la place manque (grand score sur un écran de 360 px). */
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 0.5rem;
    min-width: 0;
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
    white-space: nowrap;
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
  .cache {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    text-align: center;
    background: var(--fond);
    border: 1px solid var(--cadre);
  }
  .cache p {
    margin: 0;
  }
  .titre-cache {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .cache .principal {
    min-width: 12rem;
    min-height: 52px;
    font-size: 1.125rem;
  }
  .compte-reprise,
  .compte {
    font-size: 4rem;
    font-weight: 700;
  }
  .compte {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    pointer-events: none;
  }
  .passage {
    padding: 0.5rem 1rem;
    text-align: center;
    background: var(--surface);
    border: 2px solid var(--juste);
    border-radius: 10px;
  }
  .passage p,
  .passage ul {
    margin: 0.25rem 0;
  }
  .passage ul {
    padding: 0;
    list-style: none;
    font-weight: 600;
  }
  .titre-passage {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--juste);
  }
  .reprise {
    color: var(--discret);
  }
  .consigne,
  .retour {
    margin: 0;
    min-height: 1.5rem;
    text-align: center;
  }
  .consigne {
    font-size: 1.25rem;
    font-weight: 700;
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
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
