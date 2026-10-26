// Outils partagés par les tests : états de détection fabriqués à la main.
import type { EtatDetection } from '../src/audio/pitch';
import { frequenceVersNote } from '../src/music/notes';

/** État de détection minimal : silence par défaut, note stable si `frequence` est fournie. */
export function etat(
  tMs: number,
  options: { frequence?: number; nouvelle?: boolean; latence?: number; attaque?: boolean; silence?: boolean } = {},
): EtatDetection {
  const note = options.frequence ? frequenceVersNote(options.frequence) : null;
  return {
    tMs,
    niveauDbfs: note ? -20 : -80,
    silence: options.silence ?? !note,
    attaque: options.attaque ?? false,
    brute: null,
    rejet: null,
    lissee: note,
    stable: note,
    octaveRepliee: false,
    nouvelleNoteStable: options.nouvelle ?? false,
    // Comme dans la chaîne de détection : une nouvelle note avec latence suit une attaque.
    apresAttaque: (options.nouvelle ?? false) && options.latence !== undefined,
    latenceMs: options.latence ?? null,
  };
}
