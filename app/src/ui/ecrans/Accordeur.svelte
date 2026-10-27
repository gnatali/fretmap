<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EtatDetection } from '../../audio/pitch';
  import { Ecoute } from '../../ecoute.svelte';
  import type { EtatApp } from '../../etat.svelte';
  import {
    ACCORDAGES,
    ACCORDAGE_STANDARD,
    ETENDUE_AIGUILLE_CENTS,
    SuiviJustesse,
    cibleAccordeur,
    cordes,
    trouverAccordage,
    zoneEcart,
    type CibleAccordeur,
    type ModeAccordeur,
  } from '../../music/accordages';
  import { libelleAffiche, nomAffiche, nomsAffiches } from '../../music/notation';
  import { A4_MAX_HZ, A4_MIN_HZ, bornerA4, midiVersNote, nomVersMidi } from '../../music/notes';
  import Aiguille from '../composants/Aiguille.svelte';
  import Micro from '../composants/Micro.svelte';
  import { TEXTES } from '../textes';

  // Accordeur (spec §5.3), repris du POC : la hauteur est suivie en continu (note stable de la chaîne de détection,
  // avec la tolérance d'octave), sans attendre de nouvelle attaque.
  interface Props {
    etat: EtatApp;
    onQuitter: () => void;
    /** Écoute du micro (injectable pour les tests). */
    ecoute?: Ecoute;
  }

  let { etat, onQuitter, ecoute: ecouteFournie }: Props = $props();

  // svelte-ignore state_referenced_locally
  const ecoute =
    ecouteFournie ?? new Ecoute(etat.progression.reglages, (seuil) => etat.definirReglage('seuilSilenceDb', seuil));
  const justesse = new SuiviJustesse();

  const reglages = $derived(etat.progression.reglages);
  const notation = $derived(reglages.notation);
  const a4 = $derived(reglages.a4);

  let idAccordage = $state(ACCORDAGE_STANDARD.id);
  let mode = $state<ModeAccordeur>('cordes');
  /** Corde choisie, ou null pour la corde la plus proche. */
  let numeroCorde = $state<number | null>(null);
  let cible = $state.raw<CibleAccordeur | null>(null);
  /** Dernière cible entendue : gardée affichée quand la note n'est plus stable. */
  let derniere = $state.raw<CibleAccordeur | null>(null);
  let juste = $state(false);

  const accordage = $derived(trouverAccordage(idAccordage) ?? ACCORDAGE_STANDARD);
  const cordesAccordage = $derived(cordes(accordage, a4));
  const choisie = $derived(
    mode === 'cordes' && numeroCorde !== null ? cordesAccordage.find((c) => c.numero === numeroCorde) : undefined,
  );
  const visee = $derived(
    cible ?? derniere ?? (choisie ? { libelle: choisie.note, frequence: choisie.frequence } : null),
  );
  const silence = $derived(ecoute.detection?.silence ?? true);

  const nomsAccordage = (notes: readonly string[]) =>
    nomsAffiches(
      notes.map((n) => midiVersNote(nomVersMidi(n)!).nom),
      notation,
    );

  /** Nouvelle cible (accordage, mode, corde ou A4) : l'indicateur « juste » repart de zéro. */
  function changerCible(): void {
    justesse.reinitialiser();
    juste = false;
    cible = null;
    derniere = null;
  }

  function traiter(detection: EtatDetection): void {
    const nouvelle = detection.stable
      ? cibleAccordeur(detection.stable.frequence, { mode, accordage, numeroCorde, a4 })
      : null;
    cible = nouvelle;
    if (nouvelle) derniere = nouvelle;
    const etaitJuste = juste;
    juste = justesse.traiter(nouvelle?.cents ?? null, nouvelle?.libelle ?? null, detection.tMs);
    if (juste && !etaitJuste && reglages.retourSonore) ecoute.bip();
  }

  function definirA4(valeur: number): void {
    if (!Number.isFinite(valeur)) return;
    const borne = bornerA4(valeur);
    etat.definirReglage('a4', borne);
    ecoute.definirA4(borne);
    changerCible();
  }

  function texteEcart(c: CibleAccordeur): string {
    if (juste) return TEXTES.accordeur.juste(c.cents);
    if (zoneEcart(c.cents) === 'juste') return TEXTES.accordeur.centre(c.cents);
    return TEXTES.accordeur.ecart(c.cents, Math.abs(c.cents) > ETENDUE_AIGUILLE_CENTS);
  }

  ecoute.ecouter(traiter);
  onDestroy(() => ecoute.ecouter(null));
</script>

<header class="barre">
  <h1>{TEXTES.accordeur.titre}</h1>
  <button type="button" class="secondaire" onclick={onQuitter}>{TEXTES.arreter}</button>
</header>

<Micro {ecoute} onDemarrer={changerCible} />

<div class="choix">
  <label>
    {TEXTES.accordeur.accordage}
    <select
      value={idAccordage}
      onchange={(e) => {
        idAccordage = e.currentTarget.value;
        changerCible();
      }}
    >
      {#each ACCORDAGES as a (a.id)}
        <option value={a.id}>{TEXTES.accordeur.nomAccordage(a.nom, nomsAccordage(a.notes))}</option>
      {/each}
    </select>
  </label>
  <label>
    {TEXTES.accordeur.mode}
    <select
      value={mode}
      onchange={(e) => {
        mode = e.currentTarget.value as ModeAccordeur;
        changerCible();
      }}
    >
      <option value="cordes">{TEXTES.accordeur.modes.cordes}</option>
      <option value="chromatique">{TEXTES.accordeur.modes.chromatique}</option>
    </select>
  </label>
</div>

{#if mode === 'cordes'}
  <div class="cordes" role="group" aria-label={TEXTES.accordeur.choixCorde}>
    <button
      type="button"
      aria-pressed={numeroCorde === null}
      onclick={() => {
        numeroCorde = null;
        changerCible();
      }}
    >
      <span>{TEXTES.accordeur.auto}</span>
      <small>{TEXTES.accordeur.autoDetail}</small>
    </button>
    {#each cordesAccordage as c (c.numero)}
      <button
        type="button"
        aria-pressed={numeroCorde === c.numero}
        class:detectee={numeroCorde === null && derniere?.corde?.numero === c.numero}
        onclick={() => {
          numeroCorde = c.numero;
          changerCible();
        }}
      >
        <span>{c.numero}</span>
        <small>{libelleAffiche(c.note, notation)}</small>
      </button>
    {/each}
  </div>
{/if}

<div class="cible">
  <strong class="note">{visee ? libelleAffiche(visee.libelle, notation) : '–'}</strong>
  <span>
    {visee
      ? TEXTES.accordeur.cible(visee.frequence)
      : mode === 'cordes'
        ? TEXTES.accordeur.cordeProche
        : TEXTES.accordeur.noteProche}
  </span>
</div>

<Aiguille cents={cible?.cents ?? null} {juste} />

<p class="ecart" class:juste role="status">
  {#if ecoute.statut === 'calibrage'}
    {TEXTES.micro.calibrage}
  {:else if ecoute.statut === 'actif'}
    {cible ? texteEcart(cible) : silence ? TEXTES.accordeur.jouez : TEXTES.accordeur.attente}
  {/if}
</p>

<div class="options">
  <label>
    {TEXTES.accordeur.a4(nomAffiche('A', notation, 4))}
    <input
      type="number"
      min={A4_MIN_HZ}
      max={A4_MAX_HZ}
      step="1"
      value={a4}
      onchange={(e) => definirA4(e.currentTarget.valueAsNumber)}
    />
  </label>
  <label>
    <input
      type="checkbox"
      checked={reglages.retourSonore}
      onchange={(e) => etat.definirReglage('retourSonore', e.currentTarget.checked)}
    />
    {TEXTES.accordeur.bip}
  </label>
</div>

<style>
  .choix,
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  /* Les noms d'accordage sont longs (« Mi La Ré Sol Si Mi (E A D G B E) ») : la liste prend la largeur restante
     et coupe son texte au lieu d'élargir la page. */
  .choix {
    display: grid;
    gap: 0.5rem;
  }
  .choix label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
  .choix select {
    width: 100%;
    min-width: 0;
  }
  select,
  input[type='number'] {
    min-height: 44px;
    max-width: 100%;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
  }
  input[type='number'] {
    width: 5.5rem;
    padding: 0 0.5rem;
  }
  input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
  }
  .cordes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  .cordes button {
    display: grid;
    justify-items: center;
    min-height: 52px;
    padding: 0.25rem;
    font: inherit;
    color: var(--texte);
    background: var(--surface);
    border: 1px solid var(--cadre);
    border-radius: 8px;
    cursor: pointer;
  }
  .cordes button span {
    font-weight: 700;
  }
  .cordes button small {
    font-size: 0.75rem;
    color: var(--discret);
  }
  .cordes button[aria-pressed='true'] {
    border: 2px solid var(--lien);
  }
  .cordes button.detectee {
    background: var(--evidence);
  }
  .cible {
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin: 1rem 0 0.75rem;
  }
  .cible .note {
    font-size: 2.25rem;
  }
  .cible span {
    color: var(--discret);
  }
  .ecart {
    min-height: 1.75rem;
    margin: 0.75rem 0;
    text-align: center;
    font-weight: 600;
  }
  .ecart.juste {
    color: var(--juste);
  }
</style>
