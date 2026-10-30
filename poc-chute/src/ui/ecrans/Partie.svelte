<script lang="ts" module>
  import type { Partie } from '../../jeu/partie';
  import type { PartieProgressive } from '../../jeu/progressif/partie-progressive';
  import type { Notation } from '../../music/notation';

  /** Partie en cours : mode classique (30 notes) ou progressif. */
  export type Jeu = Partie | PartieProgressive;

  /** Ce que l'écran affiche avant la création du jeu (barre du haut, manche vide), selon le mode. */
  export type ConfigEcran = { notation: Notation; afficherCase: boolean; caseMax: number } & (
    { mode: 'classique'; dureeChuteMs: number } | { mode: 'progressif'; niveau: number }
  );

  /** Création du jeu à la fin du compte à rebours, sur le temps du jeu. */
  export interface OptionsJeu {
    debutMs: number;
    date: Date;
    hasard?: () => number;
    simulation: boolean;
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { EtatDetection } from '../../audio/pitch';
  import type { Ecoute } from '../../ecoute.svelte';
  import { HorlogeJeu } from '../../jeu/horloge';
  import { MesureImages, type JournalPartie } from '../../jeu/journal';
  import { DUREE_RAPPEL_CASE_MS, FAUSSES_AVANT_RAPPEL, NOTES_PAR_PARTIE, type EvenementPartie } from '../../jeu/partie';
  import {
    DUREE_PAUSE_NIVEAU_MS,
    PartieProgressive as ClassePartieProgressive,
    type EvenementProgressif,
  } from '../../jeu/progressif/partie-progressive';
  import { noteDePosition, type Position } from '../../music/manche';
  import { nomAffiche } from '../../music/notation';
  import type { NoteDetectee } from '../../music/notes';
  import Indicateur from '../composants/Indicateur.svelte';
  import MancheChute, { caseAffichee, type Effet, type NoteAffichee } from '../composants/MancheChute.svelte';
  import { TEXTES, consigne, duree, nomPosition, pourcent, retour, retourFausse, retourProgressif } from '../textes';

  // Écran de jeu (spec §6.2 à §6.4) : calibrage du micro, compte à rebours, puis une image par
  // requestAnimationFrame. La partie (jeu/partie.ts) décide de tout ; l'écran copie son état à chaque image,
  // lui transmet les détections du micro et affiche les retours. Le micro est démarré et arrêté par App.svelte,
  // sauf après une pause en arrière-plan : il est alors coupé ici, et relancé par « Reprendre » (geste).
  // Tous les temps donnés à la partie passent par l'horloge du jeu, qui retire les pauses. Le même écran sert aux
  // deux modes : la barre du haut et le calque de passage de niveau (mode progressif) en dépendent.

  /** Compte à rebours avant la première note, en secondes : 3 (spec §6.1). */
  const COMPTE_A_REBOURS_S = 3;
  /** Durée de l'effet vert ou rouge laissé par une note, en ms : 600 (affichage seulement, voir .effet). */
  const DUREE_EFFET_MS = 600;

  interface Props {
    config: ConfigEcran;
    /** Crée le jeu (classique ou progressif) au début de la partie. */
    creerJeu: (options: OptionsJeu) => Jeu;
    /** Écoute du micro, déjà démarrée ; null en mode simulation (partie au clavier, spec §6.9). */
    ecoute: Ecoute | null;
    onFin: (journal: JournalPartie, jeu: Jeu) => void;
    /** « Arrêter » avant le début de la partie (calibrage, compte à rebours) : rien n'est enregistré. */
    onAnnuler: () => void;
    /** Mode progressif : niveau validé (la progression est enregistrée). */
    onNiveau?: (jeu: PartieProgressive) => void;
    /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
    hasard?: () => number;
  }

  let { config, creerJeu, ecoute, onFin, onAnnuler, onNiveau, hasard }: Props = $props();

  // svelte-ignore state_referenced_locally
  const simulation = ecoute === null;
  const { notation, afficherCase } = $derived(config);
  // svelte-ignore state_referenced_locally
  let caseMax = $state(config.caseMax);
  /** Micro calibré (ou simulation) : le compte à rebours peut partir. */
  const pret = $derived(ecoute === null || ecoute.statut === 'actif');
  /**
   * micro : accès et mesure du bruit ; compte : compte à rebours ; jeu : la partie tourne ; pause. Le départ et la
   * reprise après une pause suivent le même chemin : micro (si besoin), compte, jeu.
   */
  let phase = $state<'micro' | 'compte' | 'jeu' | 'pause'>('micro');
  let compte = $state(COMPTE_A_REBOURS_S);
  /** Micro coupé par une pause en arrière-plan : « Reprendre » le relance. */
  let microCoupe = $state(false);
  let partie: Jeu | null = null;
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
  let score = $state(0);
  let serie = $state(0);
  let multiplicateur = $state(1);
  // Mode classique.
  let restantes = $state(NOTES_PAR_PARTIE);
  // svelte-ignore state_referenced_locally
  let dureeChute = $state(config.mode === 'classique' ? config.dureeChuteMs : 0);
  // Mode progressif.
  // svelte-ignore state_referenced_locally
  let niveau = $state(config.mode === 'progressif' ? config.niveau : 1);
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
  /** Bonne case montrée sur le manche, pour la note `index` (sans échéance après 3 fausses notes sur elle). */
  let rappel = $state.raw<{ index: number; positions: readonly Position[]; jusqua: number } | null>(null);
  /** Mode « pénalité » : note qui vient de recevoir une fausse note (clignotement rouge). */
  let faute: { index: number; jusqua: number } | null = null;
  let effets = $state.raw<(Effet & { jusqua: number })[]>([]);
  let numeroEffet = 0;
  // Indicateur du micro.
  let entendue = $state.raw<NoteDetectee | null>(null);
  /** Message de la note attendue (non reconnue, ancienne note), effacé à son résultat. */
  let info = $state<string | null>(null);
  let silence = $state(false);

  const attendue = $derived(notes[0] ?? null);
  const message = $derived(info ?? (silence ? TEXTES.indicateur.jouez : null));

  // Micro prêt (au départ, ou relancé après une pause en arrière-plan) : compte à rebours.
  $effect(() => {
    if (phase === 'micro' && pret) lancerCompte();
  });

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
    partie = creerJeu({ debutMs: t, date: new Date(), hasard, simulation });
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

  /**
   * Pause (bouton, touche P, ou onglet en arrière-plan). En arrière-plan, le micro est coupé, comme le mode 2 de
   * l'application ; une pause en cours de reprise (mesure du bruit, compte à rebours) revient à la pause.
   */
  function pauser(arrierePlan: boolean): void {
    if (!partie || partie.terminee || phase === 'pause') return;
    clearTimeout(minuteur);
    cancelAnimationFrame(boucle);
    // La boucle repartira sans compter la durée de la pause comme une image (HC1).
    dernierT = null;
    horloge.pauser(performance.now(), arrierePlan);
    phase = 'pause';
    if (arrierePlan && ecoute) {
      microCoupe = true;
      void ecoute.arreter();
    }
  }

  /** « Reprendre » : relance le micro s'il a été coupé (dans le clic), puis le compte à rebours. */
  function reprendre(): void {
    if (phase !== 'pause') return;
    if (microCoupe && ecoute) {
      microCoupe = false;
      void ecoute.demarrer();
      phase = 'micro';
    } else {
      lancerCompte();
    }
  }

  /** Une image : mesure de sa durée (HC1), avance de la chute, retours, copie de l'état. */
  function image(t: number): void {
    if (!partie || phase !== 'jeu') return;
    if (dernierT !== null) mesure.ajouter(t - dernierT);
    dernierT = t;
    const tJeu = horloge.jeu(t);
    traiter(partie.avancer(tJeu), tJeu);
    rafraichir(tJeu);
    if (!partie.terminee) boucle = requestAnimationFrame(image);
  }

  /**
   * État de la chaîne de détection, après le calibrage : indicateur, puis règles du mode 2 pendant la partie.
   * Le manche et les compteurs suivent à l'image suivante : un seul rendu par image (HC1).
   */
  function surDetection(etat: EtatDetection): void {
    if (etat.stable) entendue = etat.stable;
    if (!partie || partie.terminee || phase !== 'jeu') return;
    const tJeu = horloge.jeu(etat.tMs);
    traiter(partie.traiterDetection({ ...etat, tMs: tJeu }), tJeu);
    silence = partie.silenceProlonge(tJeu);
  }

  function traiter(evenements: (EvenementPartie | EvenementProgressif)[], t: number): void {
    for (const evenement of evenements) {
      if (evenement.type === 'resultat') {
        const juste = evenement.resultat === 'juste';
        const { question, progression } = evenement.note;
        info = null;
        const texte = 'timing' in evenement ? retour(evenement, notation) : retourProgressif(evenement, notation);
        dernierRetour = { texte, juste };
        effets = [...effets, { id: ++numeroEffet, question, progression, juste, jusqua: t + DUREE_EFFET_MS }];
        const index = evenement.note.index;
        if (!juste) rappel = { index, positions: question.positionsCorrectes, jusqua: t + DUREE_RAPPEL_CASE_MS };
        else if (rappel?.index === index) rappel = null;
      } else if (evenement.type === 'fausse') {
        // Mode « pénalité » : la note reste en jeu ; la bonne case reste affichée après 3 fausses notes sur elle.
        const { index, question } = evenement.note;
        info = null;
        dernierRetour = {
          texte: retourFausse(evenement.detectee, evenement.penalite, notation),
          juste: false,
        };
        faute = { index, jusqua: t + DUREE_EFFET_MS };
        if (evenement.fausses >= FAUSSES_AVANT_RAPPEL) {
          rappel = { index, positions: question.positionsCorrectes, jusqua: Infinity };
        }
      } else if (evenement.type === 'nonReconnue') {
        info = TEXTES.indicateur.nonReconnue;
      } else if (evenement.type === 'ancienneNote') {
        const { nom, octave } = evenement.detectee;
        info = TEXTES.indicateur.ancienneNote(nomAffiche(nom, notation, octave));
      } else if (evenement.type === 'niveau') {
        // Mode progressif : bilan et nouvelles notes, entourées sur le manche pendant la pause du jeu.
        const { niveau: nouveau, bonus, ajoutees, plafond } = evenement;
        passage = { niveau: nouveau - 1, bonus, ajoutees, plafond, reprise: t + DUREE_PAUSE_NIVEAU_MS };
        rappel = { index: -1, positions: ajoutees, jusqua: t + DUREE_PAUSE_NIVEAU_MS };
        if (partie instanceof ClassePartieProgressive) onNiveau?.(partie);
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
    serie = partie.serie;
    multiplicateur = partie.multiplicateur;
    caseMax = partie.caseMax;
    if (partie instanceof ClassePartieProgressive) {
      niveau = partie.niveau;
      reussite = partie.reussiteGlobale;
      vitesse = partie.vitesse;
      if (passage && !partie.enPause) passage = null;
      if (passage) resteAvantReprise = Math.max(1, Math.ceil((passage.reprise - t) / 1000));
    } else {
      restantes = partie.notesRestantes;
      dureeChute = partie.dureeChuteMs;
    }
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
      pauses: horloge.pauses(debutJeu, performance.now()),
    });
    onFin(journal, partie);
  }

  /** Mode simulation : joue la note attendue, juste ou un demi-ton au-dessus. */
  function jouer(juste: boolean): void {
    if (!partie || partie.terminee || phase !== 'jeu') return;
    const t = horloge.jeu(performance.now());
    traiter(partie.jouerSimule(juste, t), t);
    rafraichir(t);
  }

  function arreter(): void {
    if (!partie) {
      onAnnuler();
      return;
    }
    clearTimeout(minuteur);
    traiter(partie.arreter(), horloge.jeu(performance.now()));
  }

  function touche(evenement: KeyboardEvent): void {
    if (evenement.repeat) return;
    if (evenement.key === 'p' || evenement.key === 'P') {
      if (phase === 'pause') reprendre();
      else pauser(false);
      return;
    }
    if (!simulation) return;
    // Sur un bouton, Espace le déclenche déjà : ne pas jouer deux fois.
    const surBouton = evenement.target instanceof HTMLButtonElement;
    if (evenement.key === ' ' && !surBouton) {
      evenement.preventDefault();
      jouer(true);
    } else if (evenement.key === 'f' || evenement.key === 'F') {
      jouer(false);
    }
  }

  /**
   * Onglet en arrière-plan : pause automatique, micro coupé. Avant la première note (mesure du bruit, compte à
   * rebours du départ), rien n'est encore joué : retour au départ, comme « Arrêter ».
   */
  function surVisibilite(): void {
    if (!document.hidden) return;
    if (partie) pauser(true);
    else arreter();
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
      {#if config.mode === 'classique'}
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
      {:else}
        <div>
          <dt>{TEXTES.partie.score}</dt>
          <dd class="score">{score} <span class="multiplicateur">×{multiplicateur}</span></dd>
        </div>
        <div>
          <dt>{TEXTES.progressif.niveau}</dt>
          <dd class="niveau">{niveau}</dd>
        </div>
        <div>
          <dt>{TEXTES.progressif.reussite}</dt>
          <dd class="reussite">{pourcent(reussite)}</dd>
        </div>
        <div>
          <dt>{TEXTES.progressif.vitesse}</dt>
          <dd class="vitesse">{pourcent(vitesse)}</dd>
        </div>
      {/if}
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

  <div class="zone">
    <MancheChute
      {caseMax}
      {notes}
      {notation}
      {afficherCase}
      rappel={(rappel?.positions ?? []).filter((p) => p.case <= caseAffichee(caseMax))}
      {effets}
    />
    {#if enPartie && phase !== 'jeu'}
      <!-- Pause et reprise : le manche est masqué, pour ne pas chercher la case hors du temps de jeu. -->
      <div class="cache" role="group" aria-label={TEXTES.partie.enPause}>
        {#if phase === 'pause'}
          <p class="titre-cache">{TEXTES.partie.enPause}</p>
          {#if microCoupe}<p>{TEXTES.partie.microCoupe}</p>{/if}
          <button type="button" class="principal" onclick={reprendre}>{TEXTES.partie.reprendre}</button>
        {:else if phase === 'micro'}
          <p aria-live="polite">{ecoute?.statut === 'calibrage' ? TEXTES.micro.calibrage : TEXTES.micro.demarrage}</p>
          {#if ecoute?.erreur}<p class="alerte" role="alert">{ecoute.erreur}</p>{/if}
        {:else}
          <p class="compte-reprise" aria-live="assertive">
            <span class="sr-only">{TEXTES.partie.repriseDans}</span>
            {compte}
          </p>
        {/if}
      </div>
    {:else if phase === 'micro'}
      <p class="preparation" aria-live="polite">
        <span>{ecoute?.statut === 'calibrage' ? TEXTES.micro.calibrage : TEXTES.micro.demarrage}</span>
      </p>
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
      <p class="titre-passage">{TEXTES.progressif.niveauValide(passage.niveau, passage.bonus)}</p>
      {#if passage.ajoutees.length === 0}
        <p>{TEXTES.progressif.mancheComplet}</p>
      {:else}
        <p>{TEXTES.progressif.nouvellesNotes}</p>
        <ul>
          {#each passage.ajoutees as p (`${p.corde}-${p.case}`)}
            <li>{nomPosition(p, noteDePosition(p).nom, notation)}</li>
          {/each}
        </ul>
      {/if}
      <p class="plafond">{TEXTES.progressif.plafond(pourcent(passage.plafond))}</p>
      <p class="reprise">{TEXTES.progressif.repriseDans(resteAvantReprise)}</p>
    </div>
  {/if}

  <p class="consigne" aria-live="polite">
    {attendue ? consigne(attendue.question, notation, afficherCase) : ''}
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
      {notation}
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
  .compte-reprise {
    font-size: 4rem;
    font-weight: 700;
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
