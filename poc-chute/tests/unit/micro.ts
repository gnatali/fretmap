// Micro factice pour les tests de composants : session sans appareil, analyses lancées une à une par le test.
import { vi } from 'vitest';
import type { SessionMicro } from '../../src/audio/micro';
import type { DependancesEcoute } from '../../src/ecoute.svelte';

/** Bruit constant capté par le micro factice : valeur RMS 0,001, soit −60 dBFS. */
export const BRUIT_RMS = 0.001;

/**
 * Dépendances de l'écoute (comme dans app/tests/unit/ecoute.test.ts) : le micro démarre, ou échoue avec `refus` ;
 * chaque analyse lit le bruit constant, 100 ms après la précédente.
 */
export function microFactice(refus?: Error) {
  const rappels: (() => void)[] = [];
  let t = 0;
  const session: SessionMicro = {
    contexte: { sampleRate: 48000 } as AudioContext,
    analyseur: {} as AnalyserNode,
    flux: {} as MediaStream,
    reglagesPiste: {},
    lire: (tampon) => tampon.fill(BRUIT_RMS),
    arreter: vi.fn(async () => {}),
  };
  const dependances: Partial<DependancesEcoute> = {
    demarrerMicro: () => (refus ? Promise.reject(refus) : Promise.resolve(session)),
    planifier: (rappel) => rappels.push(rappel),
    annuler: () => {
      rappels.length = 0;
    },
    maintenant: () => (t += 100),
    garderEcranAllume: () => Promise.resolve(null),
  };
  /** Fait tourner n analyses du micro. */
  function analyser(n: number): void {
    for (let i = 0; i < n; i++) rappels.shift()?.();
  }
  return { session, dependances, analyser };
}
