// Copie de poc-chute/src/jeu/ (spec du POC, docs/specs-poc-chute.md). Notes qui tombent (§6.3) : progression dans le temps, apparitions, notes arrivées sur la ligne de jeu.
import type { Question } from '../quiz/tirage';

/** Part de la chute parcourue entre deux apparitions : 1/3, soit 3 ou 4 notes à l'écran (spec §6.3), à ajuster. */
export const ESPACEMENT_APPARITION = 1 / 3;
/**
 * Durée maximale d'une image prise en compte, en ms : 100. Une image plus longue (onglet en arrière-plan, ralentissement)
 * compte pour 100 ms, pour que les notes ne sautent pas toutes à la ligne d'un coup (spec §6.3).
 */
export const DT_MAX_MS = 100;

export interface NoteEnChute {
  /** Rang de la note dans la partie, à partir de 1. */
  readonly index: number;
  readonly question: Question;
  /** 0 = apparition en haut, 1 = ligne de jeu. */
  progression: number;
  readonly tApparitionMs: number;
  /** Instant où la note est devenue la note attendue (la plus basse) ; null avant. */
  tAttendueMs: number | null;
}

/**
 * File des notes à l'écran, de la plus basse (la note attendue) à la plus haute. La vitesse est commune à toutes les
 * notes : un changement de durée s'applique à toutes, et une note ne peut pas en dépasser une autre.
 */
export class Chute {
  private readonly file: NoteEnChute[] = [];
  /** Part de chute parcourue depuis la dernière apparition, même si cette note a déjà disparu. */
  private depuisApparition = Infinity;

  get notes(): readonly NoteEnChute[] {
    return this.file;
  }

  get attendue(): NoteEnChute | null {
    return this.file[0] ?? null;
  }

  /**
   * Fait avancer toutes les notes de dt / durée de chute.
   * @returns les notes arrivées sur la ligne de jeu (ratées), retirées de la file, de la plus basse à la plus haute.
   */
  avancer(dtMs: number, dureeMs: number): NoteEnChute[] {
    const pas = Math.min(Math.max(dtMs, 0), DT_MAX_MS) / dureeMs;
    for (const note of this.file) note.progression += pas;
    this.depuisApparition += pas;
    const ratees: NoteEnChute[] = [];
    while (this.file.length > 0 && this.file[0]!.progression >= 1) ratees.push(this.file.shift()!);
    return ratees;
  }

  /** Une nouvelle note doit apparaître : l'écran est vide, ou la précédente apparition remonte à un tiers de chute. */
  apparitionDue(): boolean {
    return this.file.length === 0 || this.depuisApparition >= ESPACEMENT_APPARITION;
  }

  ajouter(note: NoteEnChute): void {
    this.file.push(note);
    this.depuisApparition = 0;
  }

  /** Retire la note attendue (jouée ou détruite). */
  retirerAttendue(): NoteEnChute | null {
    return this.file.shift() ?? null;
  }
}
