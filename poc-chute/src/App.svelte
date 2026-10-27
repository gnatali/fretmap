<script lang="ts">
  import { exporterJournal, nomFichierExport, type PartieJournal } from './jeu/journal';
  import type { ReglagesPartie } from './jeu/partie';
  import {
    ajouterPartie,
    charger,
    enregistrer,
    stockageLocal,
    viderJournal,
    type DonneesPoc,
    type Stockage,
  } from './jeu/stockage';
  import type { Statistique } from './progression/modele';
  import Depart from './ui/ecrans/Depart.svelte';
  import Fin from './ui/ecrans/Fin.svelte';
  import EcranPartie from './ui/ecrans/Partie.svelte';
  import { telecharger } from './ui/telecharger';

  interface Props {
    /** Stockage des données du POC ; localStorage par défaut (injectable pour les tests). */
    stockage?: Stockage | null;
    /** Partie au clavier, sans micro : `?simulation` dans l'adresse (spec §6.9). */
    simulation?: boolean;
    /** Nombre dans [0, 1[ pour le tirage (injectable pour les tests). */
    hasard?: () => number;
  }

  let {
    stockage = stockageLocal(),
    simulation = new URLSearchParams(window.location.search).has('simulation'),
    hasard,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  let donnees = $state.raw<DonneesPoc>(charger(stockage));
  // Routage simple entre les trois écrans (spec §6.1, §6.2, §6.7).
  let ecran = $state<'depart' | 'partie' | 'fin'>('depart');
  /** Change à chaque partie : « Rejouer » recrée l'écran de jeu. */
  let numeroPartie = $state(0);
  let derniere = $state.raw<PartieJournal | null>(null);

  function sauver(nouvelles: DonneesPoc): void {
    donnees = nouvelles;
    enregistrer(stockage, nouvelles);
  }

  function demarrer(): void {
    numeroPartie++;
    ecran = 'partie';
  }

  function terminer(journal: PartieJournal, statistiques: readonly Statistique[]): void {
    sauver(ajouterPartie({ ...donnees, statistiques: [...statistiques] }, journal));
    derniere = journal;
    ecran = 'fin';
  }

  function exporter(): void {
    const maintenant = new Date();
    telecharger(nomFichierExport(maintenant), exporterJournal(donnees.parties, maintenant));
  }
</script>

<main>
  {#if ecran === 'partie'}
    {#key numeroPartie}
      <EcranPartie
        reglages={donnees.reglages}
        statistiques={donnees.statistiques}
        {simulation}
        {hasard}
        onFin={terminer}
        onAnnuler={() => (ecran = 'depart')}
      />
    {/key}
  {:else if ecran === 'fin' && derniere}
    <Fin journal={derniere} onRejouer={demarrer} onChanger={() => (ecran = 'depart')} onExporter={exporter} />
  {:else}
    <Depart
      reglages={donnees.reglages}
      {simulation}
      parties={donnees.parties.length}
      onReglages={(reglages: ReglagesPartie) => sauver({ ...donnees, reglages })}
      onDemarrer={demarrer}
      onExporter={exporter}
      onVider={() => sauver(viderJournal(donnees))}
    />
  {/if}
</main>
