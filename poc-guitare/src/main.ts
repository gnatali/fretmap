// Point d'entrée : branchement du micro, de la chaîne de détection et de l'interface.
import { demarrerMicro, ErreurMicro, type SessionMicro } from './audio/micro';
import { DUREE_CALIBRAGE_MS, seuilDepuisBruit } from './audio/niveau';
import { ChaineDetection, TAILLE_FENETRE, type ModeLissage } from './audio/pitch';
import { bornerA4 } from './music/notes';
import { VueDetection } from './ui/detection';

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément introuvable : #${id}`);
  return el as T;
}

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

const chaine = new ChaineDetection(TAILLE_FENETRE);
const vue = new VueDetection();
const tampon = new Float32Array(TAILLE_FENETRE);

let session: SessionMicro | null = null;
let boucle = 0;
/** Mesures de niveau en cours de calibrage (dBFS), ou null hors calibrage. */
let calibrage: { debut: number; mesures: number[] } | null = null;

function lireReglages(): void {
  chaine.reglages.a4 = bornerA4(reglageA4.valueAsNumber);
  const seuil = reglageSeuil.valueAsNumber;
  if (Number.isFinite(seuil)) chaine.reglages.seuilSilenceDbfs = seuil;
  const clarte = reglageClarte.valueAsNumber;
  if (Number.isFinite(clarte)) chaine.reglages.clarteMin = Math.min(1, Math.max(0, clarte));
  chaine.reglages.modeLissage = reglageLissage.value as ModeLissage;
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
  boucle = requestAnimationFrame(analyser);
}

function terminerCalibrage(): void {
  if (!calibrage) return;
  const seuil = Math.round(seuilDepuisBruit(calibrage.mesures) * 10) / 10;
  calibrage = null;
  reglageSeuil.value = String(seuil);
  lireReglages();
  etatCalibrage.textContent = `Seuil fixé à ${String(seuil).replace('.', ',')} dBFS (bruit ambiant + 10 dB).`;
  btnCalibrer.disabled = !session;
}

async function demarrer(): Promise<void> {
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
    return;
  }

  const sampleRate = session.contexte.sampleRate;
  infoSampleRate.textContent = `${sampleRate} Hz`;
  infoTampon.textContent = `${TAILLE_FENETRE} échantillons (${((TAILLE_FENETRE / sampleRate) * 1000).toFixed(1).replace('.', ',')} ms)`;
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
  boucle = requestAnimationFrame(analyser);
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
  etatMicro.textContent = 'Micro arrêté.';
  btnDemarrer.disabled = false;
}

btnDemarrer.addEventListener('click', () => void demarrer());
btnArreter.addEventListener('click', () => void arreter());
btnCalibrer.addEventListener('click', () => {
  calibrage = { debut: performance.now(), mesures: [] };
  btnCalibrer.disabled = true;
  etatCalibrage.textContent = 'Mesure du bruit ambiant pendant 2 s : ne jouez pas…';
});
for (const reglage of [reglageA4, reglageSeuil, reglageClarte, reglageLissage]) {
  reglage.addEventListener('change', lireReglages);
}
