// Petits utilitaires d'affichage partagés par les vues.

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément introuvable : #${id}`);
  return el as T;
}

/** Nombre au format français, avec le nombre de décimales demandé. */
export function formaterNombre(valeur: number, decimales: number): string {
  return valeur.toFixed(decimales).replace('.', ',');
}

export function formaterHz(frequence: number, decimales = 1): string {
  return `${formaterNombre(frequence, decimales)} Hz`;
}

/** Écart en cents arrondi, avec signe (« +12 cents », « −3 cents », « ±0 cents »). */
export function formaterCents(cents: number): string {
  const arrondi = Math.round(cents);
  return `${arrondi > 0 ? '+' : arrondi < 0 ? '−' : '±'}${Math.abs(arrondi)} cents`;
}
