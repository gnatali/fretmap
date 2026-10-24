// Accordeur : choix de l'accordage et de la corde, aiguille de −50 à +50 cents, indicateur « juste » et bip.
import type { EtatDetection } from '../audio/pitch';
import {
  ACCORDAGES,
  ACCORDAGE_STANDARD,
  ETENDUE_AIGUILLE_CENTS,
  SuiviJustesse,
  TOLERANCE_JUSTE_CENTS,
  TOLERANCE_PROCHE_CENTS,
  cibleAccordeur,
  cordes,
  trouverAccordage,
  zoneEcart,
  type Accordage,
  type CibleAccordeur,
  type ModeAccordeur,
} from '../music/accordages';
import { element, formaterCents, formaterHz } from './dom';

/**
 * Bip de confirmation : fréquence en Hz, durée en ms et volume (0 à 1).
 * 1760 Hz est hors de la plage de détection (70–1400 Hz) : le bip capté par le micro est ignoré.
 */
const BIP_FREQUENCE_HZ = 1760;
const BIP_DUREE_MS = 80;
const BIP_VOLUME = 0.15;

/** Position horizontale (0 à 100 %) d'un écart en cents sur l'aiguille. */
function position(cents: number): number {
  const borne = Math.max(-ETENDUE_AIGUILLE_CENTS, Math.min(ETENDUE_AIGUILLE_CENTS, cents));
  return ((borne + ETENDUE_AIGUILLE_CENTS) / (2 * ETENDUE_AIGUILLE_CENTS)) * 100;
}

/** Fond de l'aiguille : zones rouge, orange et verte calculées à partir des tolérances. */
function fondAiguille(): string {
  const o1 = position(-TOLERANCE_PROCHE_CENTS);
  const v1 = position(-TOLERANCE_JUSTE_CENTS);
  const v2 = position(TOLERANCE_JUSTE_CENTS);
  const o2 = position(TOLERANCE_PROCHE_CENTS);
  return (
    'linear-gradient(to right, ' +
    `var(--zone-loin) 0 ${o1}%, var(--zone-proche) ${o1}% ${v1}%, var(--zone-juste) ${v1}% ${v2}%, ` +
    `var(--zone-proche) ${v2}% ${o2}%, var(--zone-loin) ${o2}% 100%)`
  );
}

export class VueAccordeur {
  private readonly choixAccordage = element<HTMLSelectElement>('accordeur-accordage');
  private readonly choixMode = element<HTMLSelectElement>('accordeur-mode');
  private readonly caseBip = element<HTMLInputElement>('accordeur-bip');
  private readonly boutonsCordes = element('accordeur-cordes');
  private readonly note = element('accordeur-note');
  private readonly frequenceCible = element('accordeur-cible');
  private readonly aiguille = element('accordeur-aiguille');
  private readonly repere = element('accordeur-repere');
  private readonly ecart = element('accordeur-ecart');

  private accordage: Accordage = ACCORDAGE_STANDARD;
  private mode: ModeAccordeur = 'cordes';
  /** Corde choisie, ou null pour la sélection automatique. */
  private numeroCorde: number | null = null;
  private a4: number;
  private derniereCible: CibleAccordeur | null = null;
  private etaitJuste = false;
  private readonly justesse = new SuiviJustesse();
  private contexteAudio: AudioContext | null = null;

  constructor(a4: number) {
    this.a4 = a4;
    for (const a of ACCORDAGES) this.choixAccordage.add(new Option(`${a.nom} (${a.notes.join(' ')})`, a.id));
    this.aiguille.style.background = fondAiguille();

    this.choixAccordage.addEventListener('change', () => {
      this.accordage = trouverAccordage(this.choixAccordage.value) ?? ACCORDAGE_STANDARD;
      this.changerCible();
    });
    this.choixMode.addEventListener('change', () => {
      this.mode = this.choixMode.value as ModeAccordeur;
      this.changerCible();
    });
    this.boutonsCordes.addEventListener('click', (evenement) => {
      const bouton = (evenement.target as HTMLElement).closest<HTMLButtonElement>('button[data-corde]');
      if (!bouton) return;
      const valeur = bouton.dataset.corde!;
      this.numeroCorde = valeur === 'auto' ? null : Number(valeur);
      this.changerCible();
    });
    this.changerCible();
  }

  /** Cible courante (note attendue), utilisée pour préremplir le journal. */
  get cible(): CibleAccordeur | null {
    return this.derniereCible;
  }

  /** Contexte audio de la session micro, pour le bip (null quand le micro est arrêté). */
  definirContexteAudio(contexte: AudioContext | null): void {
    this.contexteAudio = contexte;
  }

  /** Change la référence A4 : les fréquences cibles sont recalculées. */
  definirA4(a4: number): void {
    if (a4 === this.a4) return;
    this.a4 = a4;
    this.changerCible();
  }

  afficher(etat: EtatDetection): void {
    // Tant que la note n'est pas stable, on n'affiche pas d'écart (la corde peut passer par d'autres notes).
    const cible = etat.stable
      ? cibleAccordeur(etat.stable.frequence, {
          mode: this.mode,
          accordage: this.accordage,
          numeroCorde: this.numeroCorde,
          a4: this.a4,
        })
      : null;

    if (cible) {
      this.derniereCible = cible;
      this.afficherCible(cible);
      this.repere.hidden = false;
      this.repere.style.left = `${position(cible.cents)}%`;
      this.repere.dataset.zone = zoneEcart(cible.cents);
      const horsEchelle = Math.abs(cible.cents) > ETENDUE_AIGUILLE_CENTS;
      const sens = cible.cents < 0 ? 'trop bas' : 'trop haut';
      this.ecart.textContent =
        zoneEcart(cible.cents) === 'juste'
          ? formaterCents(cible.cents)
          : `${formaterCents(cible.cents)} · ${horsEchelle ? `beaucoup ${sens}` : sens}`;
    } else {
      this.repere.hidden = true;
      this.ecart.textContent = etat.silence ? 'Jouez une corde' : '…';
    }

    const juste = this.justesse.traiter(cible?.cents ?? null, cible?.libelle ?? null, etat.tMs);
    this.aiguille.classList.toggle('juste', juste);
    this.ecart.classList.toggle('juste', juste);
    if (juste) this.ecart.textContent = `Juste ✓ (${formaterCents(cible!.cents)})`;
    if (juste && !this.etaitJuste && this.caseBip.checked) this.bip();
    this.etaitJuste = juste;
    this.marquerCordeActive(this.derniereCible?.corde?.numero ?? null);
  }

  arreter(): void {
    this.repere.hidden = true;
    this.aiguille.classList.remove('juste');
    this.ecart.classList.remove('juste');
    this.ecart.textContent = '—';
    this.justesse.reinitialiser();
    this.etaitJuste = false;
    this.contexteAudio = null;
  }

  /** Réaffiche les boutons de corde et la cible après un changement d'accordage, de mode, de corde ou de A4. */
  private changerCible(): void {
    this.justesse.reinitialiser();
    this.etaitJuste = false;
    this.derniereCible = null;
    this.repere.hidden = true;
    this.boutonsCordes.hidden = this.mode === 'chromatique';
    this.boutonsCordes.replaceChildren(
      this.creerBouton('auto', 'Auto', 'Corde la plus proche'),
      ...cordes(this.accordage, this.a4).map((c) =>
        this.creerBouton(String(c.numero), `${c.numero} · ${c.note}`, formaterHz(c.frequence, 2)),
      ),
    );
    const choisie = cordes(this.accordage, this.a4).find((c) => c.numero === this.numeroCorde);
    if (this.mode === 'cordes' && choisie) {
      this.afficherCible({ libelle: choisie.note, frequence: choisie.frequence, cents: 0, corde: choisie });
    } else {
      this.note.textContent = '—';
      this.frequenceCible.textContent = this.mode === 'cordes' ? 'corde la plus proche' : 'note la plus proche';
    }
    this.marquerCordeActive(this.numeroCorde);
  }

  private creerBouton(valeur: string, libelle: string, detail: string): HTMLButtonElement {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.dataset.corde = valeur;
    const titre = document.createElement('span');
    titre.textContent = libelle;
    const sousTitre = document.createElement('small');
    sousTitre.textContent = detail;
    bouton.append(titre, sousTitre);
    return bouton;
  }

  private afficherCible(cible: CibleAccordeur): void {
    this.note.textContent = cible.libelle;
    this.frequenceCible.textContent = `cible ${formaterHz(cible.frequence, 2)}`;
  }

  /** Met en évidence le bouton choisi (ou « Auto ») et, en mode automatique, la corde détectée. */
  private marquerCordeActive(numeroDetecte: number | null): void {
    for (const bouton of this.boutonsCordes.querySelectorAll<HTMLButtonElement>('button[data-corde]')) {
      const valeur = bouton.dataset.corde;
      const choisi = this.numeroCorde === null ? valeur === 'auto' : valeur === String(this.numeroCorde);
      bouton.setAttribute('aria-pressed', String(choisi));
      bouton.classList.toggle('detectee', this.numeroCorde === null && valeur === String(numeroDetecte));
    }
  }

  private bip(): void {
    const contexte = this.contexteAudio;
    if (!contexte) return;
    const oscillateur = contexte.createOscillator();
    const gain = contexte.createGain();
    const debut = contexte.currentTime;
    const fin = debut + BIP_DUREE_MS / 1000;
    oscillateur.frequency.value = BIP_FREQUENCE_HZ;
    gain.gain.setValueAtTime(BIP_VOLUME, debut);
    gain.gain.exponentialRampToValueAtTime(0.001, fin);
    oscillateur.connect(gain).connect(contexte.destination);
    oscillateur.start(debut);
    oscillateur.stop(fin);
  }
}
