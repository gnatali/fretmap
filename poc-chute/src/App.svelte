<script lang="ts">
  import { SEUIL_SILENCE_DBFS_DEFAUT } from './audio/niveau';
  import { Ecoute, type DependancesEcoute } from './ecoute.svelte';
  import { estProgressive, exporterJournal, nomFichierExport, type JournalPartie } from './jeu/journal';
  import { Partie, type ReglagesPartie } from './jeu/partie';
  import { positionsDepart } from './jeu/progressif/difficulte';
  import { PartieProgressive } from './jeu/progressif/partie-progressive';
  import {
    ajouterPartie,
    charger,
    enregistrer,
    stockageLocal,
    viderJournal,
    type DonneesPoc,
    type Stockage,
  } from './jeu/stockage';
  import { bornerDuree } from './jeu/vitesse';
  import { A4_DEFAUT_HZ } from './music/notes';
  import { caseMaxDuNiveau } from './progression/niveaux';
  import Depart from './ui/ecrans/Depart.svelte';
  import Fin from './ui/ecrans/Fin.svelte';
  import FinProgressif from './ui/ecrans/FinProgressif.svelte';
  import EcranPartie, { type ConfigEcran, type Jeu, type OptionsJeu } from './ui/ecrans/Partie.svelte';
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
  /** Partie lancée : ce que l'écran affiche avant la première note, et la création du jeu. */
  let lancement = $state.raw<{ config: ConfigEcran; creerJeu: (options: OptionsJeu) => Jeu } | null>(null);
  let derniere = $state.raw<JournalPartie | null>(null);

  function sauver(nouvelles: DonneesPoc): void {
    donnees = nouvelles;
    enregistrer(stockage, nouvelles);
  }

  async function lancer(partie: NonNullable<typeof lancement>): Promise<void> {
    // Appel synchrone jusqu'à la création de l'AudioContext, encore dans le clic.
    const demarrage = simulation ? null : ecoute.demarrer();
    lancement = partie;
    numeroPartie++;
    ecran = 'partie';
    await demarrage;
    // Refus ou micro introuvable : retour au départ, où le message s'affiche.
    if (ecoute.erreur) ecran = 'depart';
  }

  /** Mode classique : 30 notes du niveau choisi (spec §6). */
  function demarrerClassique(): Promise<void> {
    const reglages = donnees.reglages;
    return lancer({
      config: {
        mode: 'classique',
        notation: reglages.notation,
        afficherCase: reglages.afficherCase,
        caseMax: caseMaxDuNiveau(reglages.niveau, 2),
        dureeChuteMs: bornerDuree(reglages.dureeInitialeMs),
      },
      creerJeu: (options) => new Partie(reglages, donnees.statistiques, options),
    });
  }

  /** Mode progressif (spec §16) : reprise au niveau enregistré (réussites remises à zéro) ou cordes à vide. */
  function demarrerProgressif(reprise: boolean): Promise<void> {
    const depart = reprise && donnees.progressif ? donnees.progressif : { niveau: 1, positions: positionsDepart() };
    const { notation, afficherCase } = donnees.reglages;
    const reglages = donnees.reglagesProgressif;
    return lancer({
      config: {
        mode: 'progressif',
        notation,
        afficherCase,
        caseMax: Math.max(...depart.positions.map((p) => p.case)),
        niveau: depart.niveau,
      },
      creerJeu: (options) =>
        new PartieProgressive(reglages, {
          ...options,
          niveau: depart.niveau,
          positions: depart.positions,
          notation,
          afficherCase,
        }),
    });
  }

  /** Niveau du mode progressif enregistré à chaque passage, pour reprendre plus tard. */
  function enregistrerProgression(jeu: PartieProgressive): void {
    sauver({ ...donnees, progressif: { niveau: jeu.niveau, positions: jeu.positions.map((p) => ({ ...p })) } });
  }

  function annuler(): void {
    void ecoute.arreter();
    ecran = 'depart';
  }

  function terminer(journal: JournalPartie, jeu: Jeu): void {
    void ecoute.arreter();
    const suite: DonneesPoc =
      jeu instanceof PartieProgressive
        ? { ...donnees, progressif: { niveau: jeu.niveau, positions: jeu.positions.map((p) => ({ ...p })) } }
        : { ...donnees, statistiques: [...jeu.statistiques] };
    sauver(ajouterPartie(suite, journal));
    derniere = journal;
    ecran = 'fin';
  }

  function exporter(): void {
    const maintenant = new Date();
    telecharger(nomFichierExport(maintenant), exporterJournal(donnees.parties, maintenant));
  }
</script>

<main>
  {#if ecran === 'partie' && lancement}
    {#key numeroPartie}
      <EcranPartie
        config={lancement.config}
        creerJeu={lancement.creerJeu}
        ecoute={simulation ? null : ecoute}
        {hasard}
        onFin={terminer}
        onAnnuler={annuler}
        onNiveau={enregistrerProgression}
      />
    {/key}
  {:else if ecran === 'fin' && derniere}
    {#if estProgressive(derniere)}
      <FinProgressif
        journal={derniere}
        onContinuer={() => demarrerProgressif(true)}
        onReglages={() => (ecran = 'depart')}
        onExporter={exporter}
      />
    {:else}
      <Fin
        journal={derniere}
        onRejouer={demarrerClassique}
        onChanger={() => (ecran = 'depart')}
        onExporter={exporter}
      />
    {/if}
  {:else}
    <Depart
      modeJeu={donnees.modeJeu}
      reglages={donnees.reglages}
      reglagesProgressif={donnees.reglagesProgressif}
      progression={donnees.progressif}
      {simulation}
      erreurMicro={ecoute.erreur}
      parties={donnees.parties.length}
      onMode={(modeJeu) => sauver({ ...donnees, modeJeu })}
      onReglages={(reglages: ReglagesPartie) => sauver({ ...donnees, reglages })}
      onReglagesProgressif={(reglagesProgressif) => sauver({ ...donnees, reglagesProgressif })}
      onDemarrer={demarrerClassique}
      onDemarrerProgressif={demarrerProgressif}
      onExporter={exporter}
      onVider={() => sauver(viderJournal(donnees))}
    />
  {/if}
</main>
