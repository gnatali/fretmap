// jsdom n'a pas ResizeObserver, qu'utilise bind:clientHeight (MancheChute) : un observateur qui ne fait rien suffit,
// la hauteur reste à 0. À importer en tête des tests de composants.
class ResizeObserverVide {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverVide as unknown as typeof ResizeObserver;
