// Son du test au micro (spec du POC §13, phase 4) : fichier WAV joué par Chromium à la place du micro
// (--use-file-for-fake-audio-capture), comme dans app/tests/e2e/son.ts, dont la synthèse et le format sont repris.
// Exécuté par Node avant les tests.
/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { midiVersFrequence, nomVersMidi } from '../../src/music/notes';

/** Distinct du fichier de l'application : les deux suites peuvent tourner en même temps. */
export const CHEMIN_SON = join(tmpdir(), 'fretmap-e2e-chute', 'chute.wav');

const FREQUENCE_ECHANTILLONNAGE = 48000;
/** Harmoniques d'une corde pincée simplifiée, comme dans tests/unit/pitch.test.ts. */
const HARMONIQUES = [0.4, 1, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1];

export interface NoteJouee {
  note: string;
  debutS: number;
  dureeS: number;
}

/**
 * Déroulé de tests/e2e/micro.spec.ts, depuis l'ouverture du micro : 2 s de calibrage (bruit de fond seul) et 3 s de
 * compte à rebours, puis, au niveau 2 avec un hasard nul et le mode « pénalité » (notes attendues E, puis F) :
 * E2 juste, E2 ignoré (la note précédente sonne encore), A2 faux (la note F reste à jouer), F2 juste.
 */
export const NOTES_CHUTE: readonly NoteJouee[] = [
  { note: 'E2', debutS: 7.5, dureeS: 1.5 },
  { note: 'E2', debutS: 10, dureeS: 1.5 },
  { note: 'A2', debutS: 12.5, dureeS: 1.5 },
  { note: 'F2', debutS: 15, dureeS: 1.5 },
];
const DUREE_TOTALE_S = 17;

/** Échantillons dans [−1, 1] : bruit de fond vers −70 dBFS et notes pincées. */
export function synthetiser(notes: readonly NoteJouee[], dureeS: number): Float32Array {
  const fe = FREQUENCE_ECHANTILLONNAGE;
  const echantillons = new Float32Array(Math.round(dureeS * fe));
  // Bruit blanc déterministe : sans lui, le calibrage fixerait un seuil au plancher (−110 dBFS).
  let x = 1;
  for (let i = 0; i < echantillons.length; i++) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    echantillons[i] = 5.5e-4 * (x / 4294967296 - 0.5) * 2;
  }
  for (const { note, debutS, dureeS: duree } of notes) {
    const frequence = midiVersFrequence(nomVersMidi(note)!);
    const debut = Math.round(debutS * fe);
    const longueur = Math.round(duree * fe);
    for (let i = 0; i < longueur && debut + i < echantillons.length; i++) {
      const t = i / fe;
      let v = 0;
      HARMONIQUES.forEach((a, k) => {
        if ((k + 1) * frequence < fe / 2) v += a * Math.sin(2 * Math.PI * (k + 1) * frequence * t);
      });
      // Attaque de 5 ms, décroissance exponentielle, extinction sur les 30 dernières millisecondes.
      const enveloppe = Math.min(1, t / 0.005) * Math.exp(-t * 1.5) * Math.min(1, (duree - t) / 0.03);
      echantillons[debut + i]! += 0.15 * v * enveloppe;
    }
  }
  return echantillons;
}

/** Fichier WAV PCM 16 bits mono. */
export function versWav(echantillons: Float32Array): Buffer {
  const donnees = echantillons.length * 2;
  const wav = Buffer.alloc(44 + donnees);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + donnees, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(FREQUENCE_ECHANTILLONNAGE, 24);
  wav.writeUInt32LE(FREQUENCE_ECHANTILLONNAGE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(donnees, 40);
  echantillons.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return wav;
}

/** Préparation globale de Playwright : écrit le son avant le lancement de Chromium, qui le lit au démarrage. */
export default function preparer(): void {
  mkdirSync(dirname(CHEMIN_SON), { recursive: true });
  writeFileSync(CHEMIN_SON, versWav(synthetiser(NOTES_CHUTE, DUREE_TOTALE_S)));
}
