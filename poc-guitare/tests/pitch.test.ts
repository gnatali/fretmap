// Tests de la chaîne de détection sur des signaux synthétiques (sans micro).
// Ils ne remplacent pas les scénarios réels : ils vérifient que pitchy et les filtres
// se comportent correctement sur un signal propre de type corde pincée.
import { describe, expect, it } from 'vitest';
import { ChaineDetection, SuiviStabilite, TAILLE_FENETRE, rejetMesure, replierOctave } from '../src/audio/pitch';
import { midiVersFrequence } from '../src/music/notes';

/** Signal de corde pincée simplifié : fondamentale faible, harmoniques en 1/k, décroissance exponentielle. */
function cordeSynthetique(frequence: number, sampleRate: number, longueur: number, debut = 0, amplitude = 0.3) {
  const tampon = new Float32Array(longueur);
  const harmoniques = [0.4, 1, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1];
  for (let i = 0; i < longueur; i++) {
    const t = (debut + i) / sampleRate;
    let v = 0;
    harmoniques.forEach((a, k) => {
      if ((k + 1) * frequence < sampleRate / 2) v += a * Math.sin(2 * Math.PI * (k + 1) * frequence * t);
    });
    tampon[i] = (amplitude * v * Math.exp(-t * 1.5)) / 2;
  }
  return tampon;
}

/** Bruit blanc déterministe (générateur congruentiel). */
function bruit(longueur: number, amplitude: number, graine = 1) {
  const tampon = new Float32Array(longueur);
  let x = graine;
  for (let i = 0; i < longueur; i++) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    tampon[i] = amplitude * (x / 4294967296 - 0.5) * 2;
  }
  return tampon;
}

describe('détection sur signal synthétique', () => {
  for (const sampleRate of [44100, 48000]) {
    it(`détecte chaque demi-ton de E2 à E5 à < 5 cents (${sampleRate} Hz)`, () => {
      for (let midi = 40; midi <= 76; midi++) {
        const chaine = new ChaineDetection(TAILLE_FENETRE);
        const f = midiVersFrequence(midi);
        const tampon = cordeSynthetique(f, sampleRate, TAILLE_FENETRE);
        let etat = chaine.traiter(tampon, sampleRate, 0);
        for (let t = 20; t <= 120; t += 20) etat = chaine.traiter(tampon, sampleRate, t);
        expect(etat.rejet, `MIDI ${midi}`).toBeNull();
        expect(etat.stable?.midi, `MIDI ${midi}`).toBe(midi);
        expect(Math.abs(etat.stable!.centsExacts), `MIDI ${midi}`).toBeLessThan(5);
      }
    });
  }

  it('ne détecte aucune note sur le silence numérique ni sur un bruit faible', () => {
    const chaine = new ChaineDetection(TAILLE_FENETRE);
    for (const tampon of [new Float32Array(TAILLE_FENETRE), bruit(TAILLE_FENETRE, 0.005)]) {
      const etat = chaine.traiter(tampon, 44100, 0);
      expect(etat.silence).toBe(true);
      expect(etat.stable).toBeNull();
    }
  });

  it('rejette un bruit blanc fort par la clarté', () => {
    const chaine = new ChaineDetection(TAILLE_FENETRE);
    for (let t = 0; t <= 200; t += 20) {
      const etat = chaine.traiter(bruit(TAILLE_FENETRE, 0.3, t + 7), 44100, t);
      expect(etat.silence).toBe(false);
      expect(etat.stable).toBeNull();
    }
  });
});

describe('filtres', () => {
  it('rejette la clarté insuffisante et la plage 70–1400 Hz', () => {
    expect(rejetMesure({ frequence: 110, clarte: 0.95 }, 0.9)).toBeNull();
    expect(rejetMesure({ frequence: 110, clarte: 0.85 }, 0.9)).toBe('clarte');
    expect(rejetMesure({ frequence: 60, clarte: 0.99 }, 0.9)).toBe('plage');
    expect(rejetMesure({ frequence: 1500, clarte: 0.99 }, 0.9)).toBe('plage');
  });
});

describe('SuiviStabilite', () => {
  it('ne déclare une note stable qu’après 100 ms sur le même demi-ton', () => {
    const s = new SuiviStabilite(100);
    expect(s.traiter(40, 0)).toEqual({ stable: false, nouvelle: false });
    expect(s.traiter(40, 80)).toEqual({ stable: false, nouvelle: false });
    expect(s.traiter(40, 100)).toEqual({ stable: true, nouvelle: true });
    expect(s.traiter(40, 120)).toEqual({ stable: true, nouvelle: false });
  });

  it('repart de zéro quand le demi-ton change', () => {
    const s = new SuiviStabilite(100);
    s.traiter(40, 0);
    expect(s.traiter(41, 90).stable).toBe(false);
    expect(s.traiter(41, 150).stable).toBe(false);
    expect(s.traiter(41, 190)).toEqual({ stable: true, nouvelle: true });
  });

  it('signale de nouveau la même note après une réinitialisation (nouvelle attaque)', () => {
    const s = new SuiviStabilite(100);
    s.traiter(40, 0);
    s.traiter(40, 100);
    s.reinitialiser();
    s.traiter(40, 500);
    expect(s.traiter(40, 600)).toEqual({ stable: true, nouvelle: true });
  });
});

describe('latence', () => {
  it('mesure le délai entre l’attaque et la première note stable', () => {
    const sampleRate = 44100;
    const chaine = new ChaineDetection(TAILLE_FENETRE);
    chaine.traiter(new Float32Array(TAILLE_FENETRE), sampleRate, 0);
    const tampon = cordeSynthetique(110, sampleRate, TAILLE_FENETRE);
    let latence: number | null = null;
    for (let t = 20; t <= 400 && latence === null; t += 20) {
      const etat = chaine.traiter(tampon, sampleRate, t);
      if (t === 20) expect(etat.attaque).toBe(true);
      latence = etat.latenceMs;
    }
    expect(latence).toBe(100);
  });
});

describe('tolérance d’octave', () => {
  it('replierOctave ramène une mesure à ±50 cents de l’octave de la référence', () => {
    expect(replierOctave(164.8, 82.4)).toBeCloseTo(82.4, 5);
    expect(replierOctave(41.2, 82.4)).toBeCloseTo(82.4, 5);
    expect(replierOctave(164.8 * 2 ** (40 / 1200), 82.4)).toBeCloseTo(82.4 * 2 ** (40 / 1200), 5);
    expect(replierOctave(164.8 * 2 ** (60 / 1200), 82.4)).toBe(164.8 * 2 ** (60 / 1200));
    expect(replierOctave(123.5, 82.4)).toBe(123.5);
  });

  it('replierOctave couvre deux octaves (harmonique 4), mais pas l’harmonique 3', () => {
    expect(replierOctave(987.8, 246.9)).toBeCloseTo(246.95, 2);
    expect(replierOctave(61.7, 246.9)).toBeCloseTo(246.8, 2);
    expect(replierOctave(740.8, 246.9)).toBe(740.8);
    expect(replierOctave(987.8, 246.9, 50, 1)).toBe(987.8);
  });

  const sampleRate = 44100;
  const e2 = cordeSynthetique(82.41, sampleRate, TAILLE_FENETRE);
  const e3 = cordeSynthetique(164.81, sampleRate, TAILLE_FENETRE);

  /** E2 stable, puis le signal passe à E3 sans nouvelle attaque (fondamentale qui disparaît pendant la résonance). */
  function sautOctave(toleranceOctave: boolean) {
    const chaine = new ChaineDetection(TAILLE_FENETRE, { toleranceOctave });
    chaine.traiter(new Float32Array(TAILLE_FENETRE), sampleRate, 0);
    const etats = [];
    for (let t = 20; t <= 200; t += 20) etats.push(chaine.traiter(e2, sampleRate, t));
    for (let t = 220; t <= 600; t += 20) etats.push(chaine.traiter(e3, sampleRate, t));
    return etats;
  }

  it('sans tolérance, le saut d’octave devient une nouvelle note stable sans attaque', () => {
    const etats = sautOctave(false);
    const nouvelles = etats.filter((e) => e.nouvelleNoteStable);
    expect(etats.slice(10).some((e) => e.attaque)).toBe(false);
    expect(nouvelles.map((e) => [e.stable?.libelle, e.apresAttaque])).toEqual([
      ['E2', true],
      ['E3', false],
    ]);
  });

  it('avec tolérance, la note jouée reste affichée pendant toute la résonance', () => {
    const etats = sautOctave(true);
    expect(etats.filter((e) => e.nouvelleNoteStable).map((e) => e.stable?.libelle)).toEqual(['E2']);
    expect(etats.at(-1)?.stable?.libelle).toBe('E2');
    expect(Math.abs(etats.at(-1)!.stable!.centsExacts)).toBeLessThan(5);
    expect(etats.at(-1)?.octaveRepliee).toBe(true);
  });

  it('après une nouvelle attaque, l’octave jouée est bien reconnue', () => {
    const chaine = new ChaineDetection(TAILLE_FENETRE);
    chaine.traiter(new Float32Array(TAILLE_FENETRE), sampleRate, 0);
    for (let t = 20; t <= 200; t += 20) chaine.traiter(e2, sampleRate, t);
    chaine.traiter(new Float32Array(TAILLE_FENETRE), sampleRate, 220);
    let derniere = null;
    for (let t = 240; t <= 500; t += 20) {
      const etat = chaine.traiter(e3, sampleRate, t);
      if (etat.nouvelleNoteStable) derniere = etat;
    }
    expect(derniere?.stable?.libelle).toBe('E3');
    expect(derniere?.apresAttaque).toBe(true);
  });
});
