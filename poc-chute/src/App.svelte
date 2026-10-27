<script lang="ts">
  import { SEUIL_SILENCE_DBFS_DEFAUT } from './audio/niveau';
  import { Ecoute, type DependancesEcoute } from './ecoute.svelte';
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
  import { A4_DEFAUT_HZ } from './music/notes';
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
    /** Dépendances de l'écoute du micro : micro, boucle d'analyse, horloge (injectables pour les tests). */
    micro?: Partial<DependancesEcoute>;
  }

  let {
    stockage = stockageLocal(),
    simulation = new URLSearchParams(window.location.search).has('simulation'),
    hasard,
    micro,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  let donnees = $state.raw<DonneesPoc>(charger(stockage));
  // Le micro est démarré au clic sur « Démarrer » ou « Rejouer » (l'AudioContext doit naître dans ce geste), puis
  // arrêté à la fin de la partie : chaque partie a son calibrage (spec §6.1). Référence A4 fixe (spec §3).
  // svelte-ignore state_referenced_locally
  const ecoute = new Ecoute(
    { a4: A4_DEFAUT_HZ, seuilSilenceDb: donnees.seuilSilenceDbfs ?? SEUIL_SILENCE_DBFS_DEFAUT },
    (seuil) => sauver({ ...donnees, seuilSilenceDbfs: seuil }),
    micro,
  );
  // Routage simple entre les trois écrans (spec §6.1, §6.2, §6.7).
  let ecran = $state<'depart' | 'partie' | 'fin'>('depart');
  /** Change à chaque partie : « Rejouer » recrée l'écran de jeu. */
  let numeroPartie = $state(0);
  let derniere = $state.raw<PartieJournal | null>(null);

  function sauver(nouvelles: DonneesPoc): void {
    donnees = nouvelles;
    enregistrer(stockage, nouvelles);
  }

  async function demarrer(): Promise<void> {
    // Appel synchrone jusqu'à la création de l'AudioContext, encore dans le clic.
    const demarrage = simulation ? null : ecoute.demarrer();
    numeroPartie++;
    ecran = 'partie';
    await demarrage;
    // Refus ou micro introuvable : retour au départ, où le message s'affiche.
    if (ecoute.erreur) ecran = 'depart';
  }

  function annuler(): void {
    void ecoute.arreter();
    ecran = 'depart';
  }

  function terminer(journal: PartieJournal, statistiques: readonly Statistique[]): void {
    void ecoute.arreter();
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
        ecoute={simulation ? null : ecoute}
        {hasard}
        onFin={terminer}
        onAnnuler={annuler}
      />
    {/key}
  {:else if ecran === 'fin' && derniere}
    <Fin journal={derniere} onRejouer={demarrer} onChanger={() => (ecran = 'depart')} onExporter={exporter} />
  {:else}
    <Depart
      reglages={donnees.reglages}
      {simulation}
      erreurMicro={ecoute.erreur}
      parties={donnees.parties.length}
      onReglages={(reglages: ReglagesPartie) => sauver({ ...donnees, reglages })}
      onDemarrer={demarrer}
      onExporter={exporter}
      onVider={() => sauver(viderJournal(donnees))}
    />
  {/if}
</main>
