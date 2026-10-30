// Journal des parties du mode 1 dans localStorage, à part de la progression (pas dans son export) : il ne sert qu'à
// régler le jeu, et il est gros (chaque essai avec toutes les méthodes de réussite).
import type { Stockage } from '../progression/stockage';
import type { PartieJournal } from './journal';

/** Clé du journal, distincte de celle de la progression (fretmap.v1). */
export const CLE_JOURNAL = 'fretmap.journal-mode1.v1';
/**
 * Parties gardées : les 20 dernières (proposition). Une partie de 10 min fait environ 300 essais, soit 300 ko : 20
 * parties tiennent dans les 5 Mo de localStorage.
 */
export const PARTIES_GARDEES = 20;

function estPartie(valeur: unknown): valeur is PartieJournal {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    typeof (valeur as PartieJournal).debut === 'string' &&
    Array.isArray((valeur as PartieJournal).essais)
  );
}

/** Parties du journal, de la plus ancienne à la plus récente ; vide si le stockage est absent ou illisible. */
export function chargerJournal(stockage: Stockage | null): PartieJournal[] {
  try {
    const brut = stockage?.getItem(CLE_JOURNAL);
    if (!brut) return [];
    const parties: unknown = JSON.parse(brut);
    return Array.isArray(parties) ? parties.filter(estPartie) : [];
  } catch {
    return [];
  }
}

/**
 * Ajoute une partie au journal, en ne gardant que les PARTIES_GARDEES dernières. Si le stockage est plein, les plus
 * anciennes sont retirées jusqu'à ce que l'écriture passe.
 * @returns false si la partie n'a pas pu être enregistrée.
 */
export function ajouterPartie(stockage: Stockage | null, partie: PartieJournal): boolean {
  if (!stockage) return false;
  let parties = [...chargerJournal(stockage), partie].slice(-PARTIES_GARDEES);
  while (parties.length > 0) {
    try {
      stockage.setItem(CLE_JOURNAL, JSON.stringify(parties));
      return true;
    } catch {
      parties = parties.slice(1);
    }
  }
  return false;
}
