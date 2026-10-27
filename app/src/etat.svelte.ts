// État de l'application : relie l'interface au stockage. Aucune règle métier ici (voir progression/ et quiz/).
import { progressionInitiale, type Niveau, type Progression, type Reglages } from './progression/modele';
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
   * Enregistre une réponse donnée au niveau `niveau` : statistique de la position et avancement du mode.
   * @returns le niveau débloqué par cette réponse, ou null.
   */
  repondre(reponse: Reponse, niveau: Niveau): Niveau | null {
    const { avancement, debloque } = avancerNiveau(this.progression.avancement[reponse.mode], niveau, reponse.juste);
    const progression = enregistrerReponse(this.progression, reponse);
    this.progression = { ...progression, avancement: { ...progression.avancement, [reponse.mode]: avancement } };
    this.sauver();
    return debloque;
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
