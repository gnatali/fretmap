// Démarrage du micro, gestion des permissions et lecture des échantillons.

export interface SessionMicro {
  contexte: AudioContext;
  analyseur: AnalyserNode;
  flux: MediaStream;
  /** Réglages réellement appliqués par le navigateur à la piste audio. */
  reglagesPiste: MediaTrackSettings;
  /** Copie les derniers échantillons (taille = fftSize) dans `tampon`. */
  lire(tampon: Float32Array<ArrayBuffer>): void;
  arreter(): Promise<void>;
}

export class ErreurMicro extends Error {}

function messageErreur(erreur: unknown): string {
  const nom = erreur instanceof DOMException ? erreur.name : '';
  switch (nom) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès au micro refusé. Autorisez le micro pour ce site dans les réglages du navigateur, puis cliquez de nouveau sur « Démarrer ».';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Aucun micro utilisable n’a été trouvé. Branchez un micro puis réessayez.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Le micro est inaccessible : il est peut-être utilisé par une autre application.';
    default:
      return `Impossible de démarrer le micro : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
  }
}

/**
 * Démarre le micro. Doit être appelé depuis un geste utilisateur (clic sur « Démarrer ») :
 * l'AudioContext est créé avant toute attente pour rester dans ce geste.
 */
export async function demarrerMicro(tailleFenetre: number): Promise<SessionMicro> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new ErreurMicro('Le micro exige une page sécurisée : ouvrez la page via https:// ou http://localhost.');
  }

  const contexte = new AudioContext();
  let flux: MediaStream;
  try {
    // Les traitements du navigateur sont désactivés : ils déforment le signal d'une guitare.
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (erreur) {
    await contexte.close();
    throw new ErreurMicro(messageErreur(erreur));
  }
  await contexte.resume();

  const source = contexte.createMediaStreamSource(flux);
  const analyseur = contexte.createAnalyser();
  analyseur.fftSize = tailleFenetre;
  // Pas de connexion vers la sortie : on évite le larsen.
  source.connect(analyseur);

  const piste = flux.getAudioTracks()[0];
  return {
    contexte,
    analyseur,
    flux,
    reglagesPiste: piste ? piste.getSettings() : {},
    lire: (tampon) => analyseur.getFloatTimeDomainData(tampon),
    arreter: async () => {
      source.disconnect();
      flux.getTracks().forEach((t) => t.stop());
      await contexte.close();
    },
  };
}
