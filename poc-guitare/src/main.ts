// Point d'entrée : branchement du micro, de la chaîne de détection et de l'interface.
import { demarrerMicro, ErreurMicro, type SessionMicro } from './audio/micro';
import { DUREE_CALIBRAGE_MS, seuilDepuisBruit } from './audio/niveau';
import { ChaineDetection, TAILLE_FENETRE, type ModeLissage } from './audio/pitch';
import { bornerA4 } from './music/notes';
import { VueAccordeur } from './ui/accordeur';
import { VueCampagne } from './ui/campagne';
import { VueDetection } from './ui/detection';
import { element, formaterNombre } from './ui/dom';
import { VueJournal } from './ui/journal';

const btnDemarrer = element<HTMLButtonElement>('btn-demarrer');
const btnArreter = element<HTMLButtonElement>('btn-arreter');
const btnCalibrer = element<HTMLButtonElement>('btn-calibrer');
const etatMicro = element('etat-micro');
const erreurMicro = element('erreur-micro');
const etatCalibrage = element('etat-calibrage');
const infoSampleRate = element('info-sample-rate');
const infoTampon = element('info-tampon');
const infoTraitements = element('info-traitements');
const reglageA4 = element<HTMLInputElement>('reglage-a4');
const reglageSeuil = element<HTMLInputElement>('reglage-seuil');
const reglageClarte = element<HTMLInputElement>('reglage-clarte');
const reglageLissage = element<HTMLSelectElement>('reglage-lissage');
const reglageOctave = element<HTMLInputElement>('reglage-octave');

const chaine = new ChaineDetection(TAILLE_FENETRE);
const vue = new VueDetection();
const accordeur = new VueAccordeur(chaine.reglages.a4);
const journal = new VueJournal({
  noteVisee: () => accordeur.noteVisee,
  a4: () => chaine.reglages.a4,
  campagne: () => campagne.enCours,
});
const campagne = new VueCampagne({
  journal,
  demarrerMicro: demarrer,
  microActif: () => session !== null,
  calibrer: lancerCalibrage,
});
const tampon = new Float32Array(TAILLE_FENETRE);

let session: SessionMicro | null = null;
let boucle = 0;
/** Mesures de niveau en cours de calibrage (dBFS) et fonction à appeler à la fin, ou null hors calibrage. */
let calibrage: { debut: number; mesures: number[]; fin?: () => void } | null = null;

function lireReglages(): void {
  chaine.reglages.a4 = bornerA4(reglageA4.valueAsNumber);
  const seuil = reglageSeuil.valueAsNumber;
  if (Number.isFinite(seuil)) chaine.reglages.seuilSilenceDbfs = seuil;
  const clarte = reglageClarte.valueAsNumber;
  if (Number.isFinite(clarte)) chaine.reglages.clarteMin = Math.min(1, Math.max(0, clarte));
  chaine.reglages.modeLissage = reglageLissage.value as ModeLissage;
  chaine.reglages.toleranceOctave = reglageOctave.checked;
  accordeur.definirA4(chaine.reglages.a4);
}

function analyser(): void {
  if (!session) return;
  session.lire(tampon);
  const maintenant = performance.now();
  const etat = chaine.traiter(tampon, session.contexte.sampleRate, maintenant);

  if (calibrage) {
    calibrage.mesures.push(etat.niveauDbfs);
    if (maintenant - calibrage.debut >= DUREE_CALIBRAGE_MS) terminerCalibrage();
  }

  vue.afficher(etat, chaine.reglages.seuilSilenceDbfs);
  accordeur.afficher(etat);
  // Le journal d'abord : il fige le contexte de la note avant que la campagne passe à l'étape suivante.
  journal.traiter(etat);
  campagne.traiter(etat);
  boucle = requestAnimationFrame(analyser);
}

/** Mesure le bruit ambiant pendant DUREE_CALIBRAGE_MS puis fixe le seuil de silence ; `fin` est appelée ensuite. */
function lancerCalibrage(fin?: () => void): void {
  calibrage = { debut: performance.now(), mesures: [], fin };
  btnCalibrer.disabled = true;
  etatCalibrage.textContent = `Mesure du bruit ambiant pendant ${DUREE_CALIBRAGE_MS / 1000} s : ne jouez pas…`;
}

function terminerCalibrage(): void {
  if (!calibrage) return;
  const seuil = Math.round(seuilDepuisBruit(calibrage.mesures) * 10) / 10;
  const fin = calibrage.fin;
  calibrage = null;
  reglageSeuil.value = String(seuil);
  lireReglages();
  etatCalibrage.textContent = `Seuil fixé à ${formaterNombre(seuil, 1)} dBFS (bruit ambiant + 10 dB).`;
  btnCalibrer.disabled = !session;
  fin?.();
}

/**
 * Démarre le micro. À appeler depuis un clic : le contexte audio est créé avant toute attente.
 * @returns true si le micro est actif.
 */
async function demarrer(): Promise<boolean> {
  btnDemarrer.disabled = true;
  erreurMicro.hidden = true;
  etatMicro.textContent = 'Demande d’accès au micro…';
  try {
    session = await demarrerMicro(TAILLE_FENETRE);
  } catch (erreur) {
    erreurMicro.textContent = erreur instanceof ErreurMicro ? erreur.message : String(erreur);
    erreurMicro.hidden = false;
    etatMicro.textContent = 'Micro arrêté.';
    btnDemarrer.disabled = false;
    return false;
  }

  const sampleRate = session.contexte.sampleRate;
  infoSampleRate.textContent = `${sampleRate} Hz`;
  infoTampon.textContent = `${TAILLE_FENETRE} échantillons (${formaterNombre((TAILLE_FENETRE / sampleRate) * 1000, 1)} ms)`;
  const { echoCancellation, noiseSuppression, autoGainControl } = session.reglagesPiste;
  const afficherReglage = (v: boolean | string | undefined) =>
    v === undefined ? 'inconnu' : typeof v === 'string' ? v : v ? 'actif' : 'désactivé';
  infoTraitements.textContent =
    `annulation d’écho ${afficherReglage(echoCancellation)}, réduction de bruit ${afficherReglage(noiseSuppression)}, ` +
    `gain automatique ${afficherReglage(autoGainControl)}`;

  etatMicro.textContent = 'Micro actif.';
  btnArreter.disabled = false;
  btnCalibrer.disabled = false;
  chaine.reinitialiser();
  lireReglages();
  accordeur.definirContexteAudio(session.contexte);
  journal.definirMicroActif(true);
  boucle = requestAnimationFrame(analyser);
  campagne.definirMicroActif(true);
  return true;
}

async function arreter(): Promise<void> {
  cancelAnimationFrame(boucle);
  calibrage = null;
  etatCalibrage.textContent = '';
  const s = session;
  session = null;
  btnArreter.disabled = true;
  btnCalibrer.disabled = true;
  await s?.arreter();
  vue.arreter();
  accordeur.arreter();
  journal.definirMicroActif(false);
  campagne.definirMicroActif(false);
  etatMicro.textContent = 'Micro arrêté.';
  btnDemarrer.disabled = false;
}

btnDemarrer.addEventListener('click', () => void demarrer());
btnArreter.addEventListener('click', () => void arreter());
btnCalibrer.addEventListener('click', () => lancerCalibrage());
for (const reglage of [reglageA4, reglageSeuil, reglageClarte, reglageLissage, reglageOctave]) {
  reglage.addEventListener('change', lireReglages);
}
