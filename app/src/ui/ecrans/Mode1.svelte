<script lang="ts">
  import type { EtatApp } from '../../etat.svelte';
  import { exporterJournal, nomFichierJournal, type PartieJournal } from '../../jeu/journal';
  import { DIFFICULTES, type Difficulte } from '../../jeu/niveauxDifficulte';
  import type { EvenementPartie, Partie } from '../../jeu/partie';
  import type { RecordJeu } from '../../progression/modele';
  import FinJeu from '../composants/FinJeu.svelte';
  import PartieJeu from '../composants/PartieJeu.svelte';
  import { telecharger } from '../telecharger';
  import { TEXTES } from '../textes';

  // Mode 1 (spec §5.1) : le jeu « Notes qui tombent » au toucher, mode progressif du POC. Départ (reprise au niveau
  // atteint, records, journal), partie, fin. Chaque réponse met à jour la statistique de sa position ; le niveau et
  // les notes sont enregistrés à chaque passage de niveau et à la fin, les records à la fin.

  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
    /** Nombre dans [0, 1[ pour les tirages (injectable pour les tests). */
    hasard?: () => number;
  }

  let { etat, onQuitter, hasard }: Props = $props();

  let phase = $state<'depart' | 'partie' | 'fin'>('depart');
  /** Numéro de la partie : une nouvelle partie recrée l'écran de jeu. */
  let numeroPartie = $state(0);
  let confirmation = $state(false);
  /** Records de la difficulté jouée avant la partie : un niveau validé pendant la partie les met à jour avant la fin. */
  let recordAvant: RecordJeu = { score: 0, niveau: 0 };
  /** Difficulté de la partie en cours, fixée au départ. */
  let difficultePartie = $state<Difficulte>('normal');
  let fin = $state.raw<{ journal: PartieJournal; nouveauRecord: boolean } | null>(null);
  let journalOk = $state(true);
  // svelte-ignore state_referenced_locally
  let partiesJournal = $state(etat.journal().length);

  const jeu = $derived(etat.progression.jeu);
  const recordChoisi = $derived(jeu.records[jeu.difficulte]);
  const notation = $derived(etat.progression.reglages.notation);

  function jouer(): void {
    confirmation = false;
    fin = null;
    difficultePartie = jeu.difficulte;
    recordAvant = { ...jeu.records[difficultePartie] };
    numeroPartie++;
    phase = 'partie';
  }

  function recommencer(): void {
    etat.recommencerJeu();
    jouer();
  }

  /** Statistique de la position : juste sur la case touchée, erreur sur la position tirée (spec §5.1). */
  function surEvenement(evenement: EvenementPartie): void {
    if (evenement.type !== 'resultat' && evenement.type !== 'fausse') return;
    const juste = evenement.type === 'resultat' && evenement.resultat === 'juste';
    etat.enregistrer({
      mode: 1,
      position: juste && evenement.touchee ? evenement.touchee : evenement.note.question.position,
      juste,
      tempsMs: evenement.tempsReponseMs,
      date: new Date(),
    });
  }

  /** Records avec ceux de la partie, dans la difficulté jouée. */
  function records(score: number, niveau: number): Record<Difficulte, RecordJeu> {
    const ancien = jeu.records[difficultePartie];
    const nouveau = { score: Math.max(ancien.score, score), niveau: Math.max(ancien.niveau, niveau) };
    return { ...jeu.records, [difficultePartie]: nouveau };
  }

  function sauver(partie: Partie, score: number): void {
    etat.sauverJeu({
      ...jeu,
      niveau: partie.niveau,
      positions: [...partie.positions],
      records: records(score, partie.niveau),
    });
  }

  /** Niveau validé : la reprise part de là, même si la partie n'est pas terminée. */
  function surNiveau(partie: Partie): void {
    sauver(partie, 0);
  }

  function choisirDifficulte(difficulte: Difficulte): void {
    etat.sauverJeu({ ...jeu, difficulte });
  }

  function surFin(journal: PartieJournal, partie: Partie): void {
    const { score, niveauAtteint, essais } = journal.resume;
    const nouveauRecord = essais > 0 && (score > recordAvant.score || niveauAtteint > recordAvant.niveau);
    sauver(partie, score);
    if (essais > 0) {
      journalOk = etat.ajouterAuJournal(journal);
      partiesJournal = etat.journal().length;
    }
    fin = { journal, nouveauRecord };
    phase = 'fin';
  }

  function exporter(): void {
    const date = new Date();
    telecharger(nomFichierJournal(date), exporterJournal(etat.journal(), date));
  }
</script>

{#if phase === 'partie'}
  {#key numeroPartie}
    <PartieJeu
      niveau={jeu.niveau}
      positions={jeu.positions}
      {notation}
      difficulte={difficultePartie}
      onEvenement={surEvenement}
      onNiveau={surNiveau}
      onFin={surFin}
      onAnnuler={() => (phase = 'depart')}
      {hasard}
    />
  {/key}
{:else if phase === 'fin' && fin}
  <FinJeu
    journal={fin.journal}
    nouveauRecord={fin.nouveauRecord}
    onContinuer={jouer}
    onAccueil={onQuitter}
    onExporter={exporter}
  />
  {#if !journalOk}<p class="alerte">{TEXTES.mode1.journalNonEnregistre}</p>{/if}
{:else}
  <header class="barre">
    <h1>{TEXTES.mode1.titre}</h1>
    <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.retour}</button>
  </header>

  <p class="regles">{TEXTES.mode1.regles}</p>

  <fieldset class="difficultes">
    <legend>{TEXTES.mode1.difficulte}</legend>
    {#each DIFFICULTES as d (d)}
      <label class="difficulte">
        <input
          type="radio"
          name="difficulte"
          value={d}
          checked={jeu.difficulte === d}
          onchange={() => choisirDifficulte(d)}
        />
        <span>
          <strong>{TEXTES.difficultes[d]}</strong>
          <span class="aide">{TEXTES.aidesDifficulte[d]}</span>
        </span>
      </label>
    {/each}
  </fieldset>

  <div class="boutons">
    <button type="button" class="principal" onclick={jouer}>
      {jeu.niveau > 1 ? TEXTES.mode1.reprendre(jeu.niveau, jeu.positions.length) : TEXTES.mode1.commencer}
    </button>
    {#if jeu.niveau > 1}
      <button type="button" class="secondaire" onclick={() => (confirmation = true)}>
        {TEXTES.mode1.recommencer}
      </button>
    {/if}
  </div>

  {#if confirmation}
    <div class="confirmation" role="alertdialog" aria-labelledby="question-recommencer">
      <p id="question-recommencer">{TEXTES.mode1.confirmerRecommencer(jeu.niveau)}</p>
      <div class="boutons">
        <button type="button" class="principal" onclick={recommencer}>{TEXTES.mode1.confirmer}</button>
        <button type="button" class="secondaire" onclick={() => (confirmation = false)}>
          {TEXTES.mode1.annuler}
        </button>
      </div>
    </div>
  {/if}

  <section aria-labelledby="titre-records">
    <h2 id="titre-records">{TEXTES.mode1.records(TEXTES.difficultes[jeu.difficulte])}</h2>
    <p class="records">
      {recordChoisi.niveau > 0
        ? TEXTES.mode1.recordValeurs(recordChoisi.score, recordChoisi.niveau)
        : TEXTES.mode1.aucunRecord}
    </p>
  </section>

  <section aria-labelledby="titre-journal">
    <h2 id="titre-journal">{TEXTES.mode1.journal}</h2>
    <button type="button" class="secondaire" disabled={partiesJournal === 0} onclick={exporter}>
      {TEXTES.mode1.exporter(partiesJournal)}
    </button>
  </section>

  {#if !etat.sauvegardeOk}<p class="alerte">{TEXTES.sauvegardeImpossible}</p>{/if}
{/if}

<style>
  .regles {
    margin: 1rem 0;
  }
  .difficultes {
    margin: 0 0 1rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  legend {
    padding: 0 0.25rem;
    font-weight: 600;
  }
  .difficulte {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 44px;
    cursor: pointer;
  }
  .difficulte input {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: var(--lien);
  }
  .difficulte > span {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }
  .aide {
    font-size: 0.875rem;
    color: var(--discret);
  }
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .confirmation {
    margin-top: 1rem;
    padding: 0.75rem;
    border: 2px solid var(--faux);
    border-radius: 8px;
  }
  .confirmation p {
    margin: 0 0 0.75rem;
  }
  h2 {
    margin: 1.5rem 0 0.5rem;
    font-size: 1.125rem;
  }
  .records {
    margin: 0;
    font-weight: 600;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
