// État de l'application : relie l'interface au stockage. Aucune règle métier ici (voir progression/ et quiz/).
import {
  jeuInitial,
  progressionInitiale,
  type Niveau,
  type Progression,
  type ProgressionJeu,
  type Reglages,
} from './progression/modele';
import type { PartieJournal } from './jeu/journal';
import { ajouterPartie, chargerJournal } from './jeu/stockage';
import { avancerNiveau } from './progression/niveaux';
import { enregistrerReponse, type Reponse } from './progression/statistiques';
import { charger, sauver, stockageLocal, type EtatChargement, type Stockage } from './progression/stockage';

export class EtatApp {
  progression: Progression = $state()!;
  readonly chargement: EtatChargement;
  /** Dernière sauvegarde réussie ; false si le stockage est plein ou indisponible. */
  sauvegardeOk = $state(true);

  constructor(private readonly stockage: Stockage | null = stockageLocal()) {
    const lu = charger(stockage);
    this.progression = lu.progression;
    this.chargement = lu.etat;
  }

  /**
   * Enregistre une réponse du mode 2 donnée au niveau `niveau` : statistique de la position et avancement du mode.
   * @returns le niveau débloqué par cette réponse, ou null.
   */
  repondre(reponse: Reponse & { mode: 2 }, niveau: Niveau): Niveau | null {
    const { avancement, debloque } = avancerNiveau(this.progression.avancement[2], niveau, reponse.juste);
    const progression = enregistrerReponse(this.progression, reponse);
    this.progression = { ...progression, avancement: { 2: avancement } };
    this.sauver();
    return debloque;
  }

  /** Enregistre la statistique d'une réponse, sans avancement (jeu du mode 1). */
  enregistrer(reponse: Reponse): void {
    this.progression = enregistrerReponse(this.progression, reponse);
    this.sauver();
  }

  /** Enregistre où reprendre le jeu du mode 1, et ses records (passage de niveau, fin de partie). */
  sauverJeu(jeu: ProgressionJeu): void {
    this.progression = { ...this.progression, jeu: $state.snapshot(jeu) as ProgressionJeu };
    this.sauver();
  }

  /** Parties du journal du mode 1, de la plus ancienne à la plus récente (à part de la progression). */
  journal(): PartieJournal[] {
    return chargerJournal(this.stockage);
  }

  /** @returns false si la partie n'a pas pu être ajoutée au journal (stockage plein ou indisponible). */
  ajouterAuJournal(partie: PartieJournal): boolean {
    return ajouterPartie(this.stockage, partie);
  }

  /** Le jeu du mode 1 repart aux cordes à vide ; les records et les statistiques sont gardés. */
  recommencerJeu(): void {
    this.sauverJeu(jeuInitial(this.progression.jeu.record));
  }

  definirReglage<C extends keyof Reglages>(cle: C, valeur: Reglages[C]): void {
    this.progression = { ...this.progression, reglages: { ...this.progression.reglages, [cle]: valeur } };
    this.sauver();
  }

  /** Remplace toute la progression (import d'un fichier exporté). */
  remplacer(progression: Progression): void {
    this.progression = progression;
    this.sauver();
  }

  /** Repart d'une progression neuve (niveau, scores, statistiques) en gardant les réglages. */
  reinitialiser(): void {
    this.remplacer({ ...progressionInitiale(), reglages: { ...this.progression.reglages } });
  }

  private sauver(): void {
    this.sauvegardeOk = sauver(this.stockage, $state.snapshot(this.progression) as Progression);
  }
}
