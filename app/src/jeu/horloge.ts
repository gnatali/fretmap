// Copie de poc-chute/src/jeu/ (docs/specs-poc-chute.md §6.2). Temps du jeu (pause) : le temps réel moins la durée des pauses. L'écran fait passer par elle tous les
// temps qu'il donne à la partie : la chute, les délais, les temps de réponse et le journal ne comptent pas les pauses.

/** Une pause, pour le journal : temps du jeu au début (relatif au début de la partie), durée réelle. */
export interface Pause {
  tMs: number;
  dureeMs: number;
  /** Pause automatique : l'onglet est passé en arrière-plan. */
  arrierePlan: boolean;
}

export class HorlogeJeu {
  /** Durée des pauses terminées, en ms. */
  private decalageMs = 0;
  private enCours: { t: number; tJeu: number; arrierePlan: boolean } | null = null;
  private readonly terminees: Pause[] = [];

  get enPause(): boolean {
    return this.enCours !== null;
  }

  /** Temps du jeu à l'instant réel t ; pendant une pause, il reste celui du début de la pause. */
  jeu(t: number): number {
    return (this.enCours ? this.enCours.t : t) - this.decalageMs;
  }

  /** Commence une pause ; déjà en pause, note seulement qu'elle est devenue automatique (arrière-plan). */
  pauser(t: number, arrierePlan = false): void {
    if (this.enCours) {
      this.enCours.arrierePlan ||= arrierePlan;
      return;
    }
    this.enCours = { t, tJeu: this.jeu(t), arrierePlan };
  }

  reprendre(t: number): void {
    if (!this.enCours) return;
    const dureeMs = Math.max(0, t - this.enCours.t);
    this.decalageMs += dureeMs;
    this.terminees.push({ tMs: this.enCours.tJeu, dureeMs, arrierePlan: this.enCours.arrierePlan });
    this.enCours = null;
  }

  /**
   * Pauses pour le journal, en ms arrondies, avec la pause en cours jusqu'à t (partie arrêtée pendant une pause).
   * @param origineMs temps du jeu au début de la partie
   */
  pauses(origineMs: number, t: number): Pause[] {
    const enCours = this.enCours
      ? [{ tMs: this.enCours.tJeu, dureeMs: Math.max(0, t - this.enCours.t), arrierePlan: this.enCours.arrierePlan }]
      : [];
    return [...this.terminees, ...enCours].map((p) => ({
      tMs: Math.round(p.tMs - origineMs),
      dureeMs: Math.round(p.dureeMs),
      arrierePlan: p.arrierePlan,
    }));
  }
}
