// États de détection fabriqués à la main pour les tests du mode 2 (comme tests/outils.ts du POC).
import type { EtatDetection } from '../../src/audio/pitch';
import { frequenceVersNote, midiVersFrequence, nomVersMidi } from '../../src/music/notes';

export interface OptionsEtat {
  /** Note stable (« E2 ») ou fréquence en Hz. */
  note?: string | number;
  /** Écart ajouté à la note, en cents. */
  cents?: number;
  nouvelle?: boolean;
  attaque?: boolean;
  /** Avec `nouvelle` : la note suit une attaque (vrai par défaut) et sa latence. */
  apresAttaque?: boolean;
  latence?: number;
  silence?: boolean;
  niveauDbfs?: number;
}

/** État de détection minimal : silence sans note, note stable si `note` est fournie. */
export function etat(tMs: number, options: OptionsEtat = {}): EtatDetection {
  const { note: n, cents = 0 } = options;
  const frequence = n === undefined ? null : typeof n === 'number' ? n : midiVersFrequence(nomVersMidi(n)!);
  const note = frequence === null ? null : frequenceVersNote(frequence * 2 ** (cents / 1200));
  const nouvelle = options.nouvelle ?? false;
  const apresAttaque = nouvelle && (options.apresAttaque ?? true);
  return {
    tMs,
    niveauDbfs: options.niveauDbfs ?? (note ? -20 : -80),
    silence: options.silence ?? !note,
    attaque: options.attaque ?? false,
    brute: null,
    rejet: null,
    lissee: note,
    stable: note,
    octaveRepliee: false,
    nouvelleNoteStable: nouvelle,
    apresAttaque,
    latenceMs: apresAttaque ? (options.latence ?? 200) : null,
  };
}
