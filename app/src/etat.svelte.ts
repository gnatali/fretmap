// État de l'application : relie l'interface au stockage. Aucune règle métier ici (voir progression/ et quiz/).
import { type Progression, type Reglages } from './progression/modele';
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

  repondre(reponse: Reponse): void {
    this.progression = enregistrerReponse(this.progression, reponse);
    this.sauver();
  }

  definirReglage<C extends keyof Reglages>(cle: C, valeur: Reglages[C]): void {
    this.progression = { ...this.progression, reglages: { ...this.progression.reglages, [cle]: valeur } };
    this.sauver();
  }

  private sauver(): void {
    this.sauvegardeOk = sauver(this.stockage, $state.snapshot(this.progression) as Progression);
  }
}
