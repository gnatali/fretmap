<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { HorlogeJeu } from '../../jeu/horloge';
  import { MesureImages, type PartieJournal } from '../../jeu/journal';
  import { Partie, type EvenementPartie } from '../../jeu/partie';
  import { AIDE_APRES_ERREUR, NATURELLES_SEULES, reglagesDe, type Difficulte } from '../../jeu/niveauxDifficulte';
  import { noteDePosition, type Position } from '../../music/manche';
  import type { Notation } from '../../music/notation';
  import { TEXTES, consigne, nomPosition, pourcent, retourEssai, retourFausse } from '../textes';
  import MancheJeu, { caseAffichee, type Effet, type MarqueCase, type NoteAffichee } from './MancheJeu.svelte';
  import Picto from './Picto.svelte';

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
    /** Arrêt pendant le compte à rebours du départ (depuis la pause) : rien n'est enregistré. */
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

  /**
   * compte : compte à rebours (départ, reprise après une pause ou après un passage de niveau) ; jeu : la partie tourne ;
   * pause ; niveau : bilan du passage de niveau, la partie attend « Continuer ».
   */
  let phase = $state<'compte' | 'jeu' | 'pause' | 'niveau'>('compte');
  /** Compte à rebours après un passage de niveau : affiché comme au départ, sur le manche visible (sans cache). */
  let compteNiveau = $state(false);
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
  /** Notes du niveau validées pour le passage, sur le nombre de notes du niveau. */
  let notesValidees = $state(0);
  // svelte-ignore state_referenced_locally
  let notesDuNiveau = $state(positions.length);
  let vitesse = $state(0);
  /** Passage de niveau : bilan posé sur le manche jusqu'au clic sur « Continuer ». */
  let passage = $state.raw<{ niveau: number; bonus: number; ajoutees: Position[]; plafond: number } | null>(null);
  /** Nouvelles notes montrées sur leur case, du passage de niveau à la fin du compte à rebours qui suit. */
  let presentees = $state.raw<Position[]>([]);
  let dernierRetour = $state<{ texte: string; juste: boolean } | null>(null);
  /** Cases entourées : bonne case de la note `index` après une erreur. */
  let rappel = $state.raw<{ index: number; positions: readonly Position[]; jusqua: number } | null>(null);
  /** Note qui vient de recevoir une case fausse (clignotement rouge). */
  let faute: { index: number; jusqua: number } | null = null;
  let effets = $state.raw<(Effet & { jusqua: number })[]>([]);
  let numeroEffet = 0;
  let marques = $state.raw<{ cle: string; marque: MarqueCase; jusqua: number }[]>([]);

  const attendue = $derived(notes[0] ?? null);
  /** Écran de pause, en plein écran : en pause, et pendant le compte à rebours de reprise (le manche reste masqué). */
  const ecranPause = $derived(phase === 'pause' || (enPartie && phase === 'compte' && !compteNiveau));
  let boutonReprendre = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    if (phase === 'pause') boutonReprendre?.focus();
  });
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

  /**
   * Fin du compte à rebours après une pause ou un passage de niveau : le temps du jeu repart, la boucle aussi ; après un
   * passage, la partie reprend (première note du niveau) et les nouvelles notes ne sont plus montrées.
   */
  function relancer(): void {
    const t = performance.now();
    horloge.reprendre(t);
    presentees = [];
    compteNiveau = false;
    phase = 'jeu';
    if (partie?.enPause) {
      // Comme au départ, la première note du niveau est là dès la fin du compte à rebours.
      const tJeu = horloge.jeu(t);
      partie.continuer(tJeu);
      traiter(partie.avancer(tJeu), tJeu);
      rafraichir(tJeu);
    }
    boucle = requestAnimationFrame(image);
  }

  /** « Continuer » au passage de niveau : le bilan disparaît, puis le compte à rebours du départ. */
  function continuerNiveau(): void {
    if (phase !== 'niveau') return;
    passage = null;
    compteNiveau = true;
    lancerCompte();
  }

  /**
   * Pause (bouton, touche P, ou onglet en arrière-plan) ; une pause pendant un compte à rebours y revient. Pendant le
   * compte à rebours du départ, la partie n'a pas commencé : seul le compte à rebours s'arrête (l'écran de pause permet
   * alors d'annuler).
   */
  function pauser(arrierePlan: boolean): void {
    // Au passage de niveau, la partie attend déjà « Continuer » : rien à suspendre.
    if (partie?.terminee || phase === 'pause' || phase === 'niveau') return;
    clearTimeout(minuteur);
    if (!partie) {
      phase = 'pause';
      return;
    }
    cancelAnimationFrame(boucle);
    // La reprise qui suit masque le manche, même après un passage de niveau.
    compteNiveau = false;
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
        // Facile : la bonne case s'allume dès la 1re case fausse, jusqu'au résultat de la note.
        if (AIDE_APRES_ERREUR[difficulte]) {
          const { index, question } = evenement.note;
          rappel = { index, positions: question.positionsCorrectes, jusqua: Infinity };
        }
      } else if (evenement.type === 'niveau') {
        // Bilan posé sur le manche, nouvelles notes sur leur case ; la boucle s'arrête jusqu'à « Continuer ».
        const { niveau: nouveau, bonus, ajoutees, plafond } = evenement;
        passage = { niveau: nouveau - 1, bonus, ajoutees, plafond };
        presentees = ajoutees;
        rappel = null;
        dernierRetour = null;
        phase = 'niveau';
        cancelAnimationFrame(boucle);
        // La boucle repartira sans compter l'attente comme une image.
        dernierT = null;
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
    notesValidees = partie.notesValidees;
    notesDuNiveau = partie.positions.length;
    vitesse = partie.vitesse;
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
        <dt>{TEXTES.partie.notes}</dt>
        <dd class="notes-validees" title={TEXTES.partie.notesValidees}>{notesValidees}/{notesDuNiveau}</dd>
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
    <!-- Pas de bouton « Arrêter » pendant le jeu : on arrête depuis l'écran de pause, ou depuis le bilan d'un niveau. -->
    <button
      type="button"
      class="secondaire pause"
      aria-label={TEXTES.partie.pause}
      title={TEXTES.partie.pause}
      disabled={phase === 'niveau' || phase === 'pause'}
      onclick={() => pauser(false)}
    >
      <!-- Symbole « pause » dessiné : deux barres (le caractère ⏸ est trop petit sur Android). -->
      <span class="barres" aria-hidden="true"></span>
    </button>
  </header>

  <p class="consigne" aria-live="polite">{attendue ? consigne(attendue.question, notation) : ''}</p>

  <div class="zone">
    <MancheJeu
      {caseMax}
      {notes}
      {notation}
      rappel={(rappel?.positions ?? []).filter((p) => p.case <= caseAffichee(caseMax))}
      {presentees}
      {effets}
      marques={marquesParCase}
      desactive={phase !== 'jeu'}
      volant={passage && phase === 'niveau' ? bilan : undefined}
      onToucher={toucher}
    />
    {#if phase === 'compte' && !ecranPause}
      <p class="compte" aria-live="assertive">
        <span class="sr-only">{TEXTES.partie.compteARebours}</span>
        {compte}
      </p>
    {/if}
  </div>

  <p
    class="retour"
    class:juste={dernierRetour?.juste}
    class:faux={!!dernierRetour && !dernierRetour.juste}
    role="status"
  >
    {dernierRetour?.texte ?? ''}
  </p>
</div>

{#if ecranPause}
  <!-- Pause et reprise : tout l'écran est couvert (le manche est masqué, pour ne pas chercher la case hors du temps de
       jeu) ; il reprend le score et la progression, avec les pictos lecture (reprendre) et stop (arrêter). -->
  <div class="ecran-pause" role="dialog" aria-modal="true" aria-label={TEXTES.partie.enPause}>
    <div class="contenu-pause">
      <p class="titre-pause">{TEXTES.partie.enPause}</p>
      <dl class="etat-pause">
        <div class="large">
          <dt>{TEXTES.partie.score}</dt>
          <dd class="score">{score} <span class="multiplicateur">×{multiplicateur}</span></dd>
        </div>
        <div>
          <dt>{TEXTES.partie.niveau}</dt>
          <dd class="niveau">{niveau} <span class="difficulte">· {TEXTES.difficultes[difficulte]}</span></dd>
        </div>
        <div>
          <dt>{TEXTES.partie.notes}</dt>
          <dd class="notes-validees" title={TEXTES.partie.notesValidees}>
            {notesValidees}/{notesDuNiveau}
            <span class="barre-notes" aria-hidden="true">
              <span style:width="{notesDuNiveau > 0 ? (100 * notesValidees) / notesDuNiveau : 0}%"></span>
            </span>
          </dd>
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
      {#if phase === 'pause'}
        <div class="commandes">
          <button
            type="button"
            class="principal rond grand"
            aria-label={TEXTES.partie.reprendre}
            title={TEXTES.partie.reprendre}
            bind:this={boutonReprendre}
            onclick={reprendre}
          >
            <Picto nom="lecture" />
          </button>
          <button
            type="button"
            class="secondaire rond grand"
            aria-label={TEXTES.partie.arreter}
            title={TEXTES.partie.arreter}
            onclick={arreter}
          >
            <Picto nom="stop" />
          </button>
        </div>
      {:else}
        <p class="compte-reprise" aria-live="assertive">
          <span class="sr-only">{TEXTES.partie.repriseDans}</span>
          {compte}
        </p>
      {/if}
    </div>
  </div>
{/if}

{#snippet bilan()}
  {#if passage}
    <!-- Passage de niveau : cadre posé sur le manche (MancheJeu), dans la plus longue bande de cases sans nouvelle note ;
         le manche garde sa taille. -->
    <div class="passage" aria-live="polite">
      <p class="titre-passage">{TEXTES.partie.niveauValide(passage.niveau, passage.bonus)}</p>
      {#if passage.ajoutees.length === 0}
        <p>{NATURELLES_SEULES[difficulte] ? TEXTES.partie.naturellesCompletes : TEXTES.partie.mancheComplet}</p>
      {:else}
        <!-- Nouvelles notes : montrées en bulles sur le manche, pas dans le cadre ; nommées ici pour les lecteurs
             d'écran (le calque des bulles est aria-hidden). -->
        <div class="sr-only nouvelles">
          <p>{TEXTES.partie.nouvellesNotes}</p>
          <ul>
            {#each passage.ajoutees as p (`${p.corde}-${p.case}`)}
              <li>{nomPosition(p, noteDePosition(p).nom, notation)}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <p class="plafond">{TEXTES.partie.plafond(pourcent(passage.plafond))}</p>
      <div class="actions-passage">
        <button type="button" class="principal continuer" onclick={continuerNiveau}>
          {TEXTES.partie.continuerNiveau(passage.niveau + 1)}
        </button>
        <button
          type="button"
          class="secondaire rond"
          aria-label={TEXTES.partie.arreter}
          title={TEXTES.partie.arreter}
          onclick={arreter}
        >
          <Picto nom="stop" />
        </button>
      </div>
    </div>
  {/if}
{/snippet}

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
  .pause {
    flex-shrink: 0;
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
  /* Écran de pause : couvre tout l'écran, au-dessus du jeu. */
  .ecran-pause {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    padding: 1.5rem 1rem;
    background: var(--fond);
  }
  .contenu-pause {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    max-width: 30rem;
    text-align: center;
  }
  .contenu-pause p {
    margin: 0;
  }
  .titre-pause {
    font-size: 2rem;
    font-weight: 700;
  }
  .etat-pause {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    width: 100%;
    margin: 0;
    padding: 1rem;
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 12px;
  }
  .etat-pause div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }
  .etat-pause .large {
    grid-column: 1 / -1;
  }
  .etat-pause dt {
    font-size: 0.875rem;
  }
  .etat-pause dd {
    font-size: 1.375rem;
  }
  .etat-pause .score {
    font-size: 2rem;
  }
  .difficulte {
    font-size: 1rem;
    font-weight: 500;
    color: var(--discret);
  }
  .barre-notes {
    display: block;
    width: 6rem;
    height: 6px;
    margin: 0.25rem auto 0;
    overflow: hidden;
    border-radius: 3px;
    background: var(--cadre);
  }
  .barre-notes span {
    display: block;
    height: 100%;
    background: var(--juste);
  }
  .commandes {
    display: flex;
    gap: 2rem;
  }
  /* Bouton rond à picto (lecture, stop) : 44 px au moins (cible tactile), 72 px sur l'écran de pause. */
  .rond {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 11px;
    border-radius: 50%;
  }
  .rond.grand {
    width: 72px;
    height: 72px;
    padding: 18px;
  }
  .secondaire.rond {
    border: 2px solid currentColor;
  }
  .compte-reprise,
  .compte {
    font-size: 4rem;
    font-weight: 700;
    line-height: 72px;
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
  /* Cadre volant : opaque, ombré, jamais plus haut que la place libre du manche (il défile alors). */
  .passage {
    position: relative;
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding: 0.5rem 0.75rem;
    text-align: center;
    background: var(--surface);
    border: 2px solid var(--juste);
    border-radius: 10px;
    box-shadow: 0 4px 16px var(--ombre);
    pointer-events: auto;
  }
  .passage p {
    margin: 0.25rem 0;
  }
  .titre-passage {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--juste);
  }
  .actions-passage {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .continuer {
    min-height: 48px;
    padding: 0 1rem;
  }
  /* Peu de place (bande de 2 cases sur un petit écran) : cadre resserré. */
  @container volant (max-height: 9rem) {
    .passage {
      padding: 0.25rem 0.5rem;
      font-size: 0.875rem;
    }
    .passage p {
      margin: 0.125rem 0;
    }
    .titre-passage {
      font-size: 1.0625rem;
    }
    .actions-passage {
      margin-top: 0.125rem;
    }
  }
  /* Très peu de place : le titre et le bouton seulement ; la vitesse max reste lue par les lecteurs d'écran. */
  @container volant (max-height: 7.5rem) {
    .plafond {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .titre-passage {
      line-height: 1.2;
    }
    .continuer {
      min-height: 44px;
    }
  }
  .consigne,
  .retour {
    margin: 0;
    min-height: 1.5rem;
    text-align: center;
  }
  .consigne {
    /* Une ligne même vide (bilan du passage de niveau) : le manche ne bouge pas. */
    min-height: 1lh;
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
