import { describe, expect, it } from 'vitest';
import { Chute, DT_MAX_MS, type NoteEnChute } from '../../src/jeu/chute';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';

const question = tirerQuestion(positionsDuNiveau(2), contenuNiveau(2), () => 0);
let index = 0;
const note = (tApparitionMs = 0): NoteEnChute => ({
  index: ++index,
  question,
  progression: 0,
  tApparitionMs,
  tAttendueMs: null,
});

/** Avance par images de 50 ms pendant une durée, et renvoie les notes ratées. */
function avancerPendant(chute: Chute, dureeTotaleMs: number, dureeChuteMs: number): NoteEnChute[] {
  const ratees: NoteEnChute[] = [];
  for (let t = 0; t < dureeTotaleMs; t += 50) ratees.push(...chute.avancer(50, dureeChuteMs));
  return ratees;
}

describe('Chute', () => {
  it('fait avancer les notes de dt / durée de chute', () => {
    const chute = new Chute();
    chute.ajouter(note());
    avancerPendant(chute, 1500, 6000);
    expect(chute.notes[0]!.progression).toBeCloseTo(0.25);
  });

  it('demande une apparition sur un écran vide, puis au tiers de la chute', () => {
    const chute = new Chute();
    expect(chute.apparitionDue()).toBe(true);
    chute.ajouter(note());
    expect(chute.apparitionDue()).toBe(false);
    avancerPendant(chute, 1950, 6000);
    expect(chute.apparitionDue()).toBe(false);
    avancerPendant(chute, 100, 6000);
    expect(chute.apparitionDue()).toBe(true);
  });

  it('demande tout de suite une apparition si la seule note disparaît avant le tiers', () => {
    const chute = new Chute();
    chute.ajouter(note());
    avancerPendant(chute, 500, 6000);
    chute.retirerAttendue();
    expect(chute.apparitionDue()).toBe(true);
  });

  it('renvoie et retire la note qui touche la ligne de jeu', () => {
    const chute = new Chute();
    const premiere = note();
    chute.ajouter(premiere);
    avancerPendant(chute, 2000, 6000);
    const seconde = note(2000);
    chute.ajouter(seconde);
    expect(avancerPendant(chute, 3950, 6000)).toEqual([]);
    expect(avancerPendant(chute, 100, 6000)).toEqual([premiere]);
    expect(chute.attendue).toBe(seconde);
    expect(seconde.progression).toBeCloseTo(4050 / 6000);
  });

  it('applique un changement de vitesse à toutes les notes, sans dépassement', () => {
    const chute = new Chute();
    const basse = note();
    chute.ajouter(basse);
    avancerPendant(chute, 2000, 6000);
    const haute = note(2000);
    chute.ajouter(haute);
    avancerPendant(chute, 1000, 2000);
    expect(basse.progression - haute.progression).toBeCloseTo(1 / 3);
    expect(chute.notes).toEqual([basse, haute]);
  });

  it('compte une image trop longue pour DT_MAX_MS', () => {
    const chute = new Chute();
    chute.ajouter(note());
    expect(chute.avancer(5000, 1000)).toEqual([]);
    expect(chute.notes[0]!.progression).toBeCloseTo(DT_MAX_MS / 1000);
    chute.avancer(-20, 1000);
    expect(chute.notes[0]!.progression).toBeCloseTo(DT_MAX_MS / 1000);
  });

  it('retire la note attendue, la plus basse', () => {
    const chute = new Chute();
    const premiere = note();
    chute.ajouter(premiere);
    avancerPendant(chute, 2000, 6000);
    const seconde = note(2000);
    chute.ajouter(seconde);
    expect(chute.retirerAttendue()).toBe(premiere);
    expect(chute.attendue).toBe(seconde);
    expect(chute.retirerAttendue()).toBe(seconde);
    expect(chute.retirerAttendue()).toBeNull();
  });
});
