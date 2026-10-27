import type { Stockage } from '../../src/progression/stockage';

/** Stockage en mémoire, à la place de localStorage. */
export function stockageMemoire(initial: Record<string, string> = {}): Stockage & { donnees: Record<string, string> } {
  const donnees = { ...initial };
  return {
    donnees,
    getItem: (cle) => donnees[cle] ?? null,
    setItem: (cle, valeur) => {
      donnees[cle] = valeur;
    },
  };
}
