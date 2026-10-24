// Affichage libre de la note détectée : note, fréquence, cents, clarté, niveau et historique.
import type { EtatDetection } from '../audio/pitch';
import type { NoteDetectee } from '../music/notes';
import { element, formaterCents, formaterHz, formaterNombre } from './dom';

/** Nombre de notes stables conservées dans l'historique. */
const TAILLE_HISTORIQUE = 10;
/** Plage affichée par la barre de niveau, en dBFS. */
const NIVEAU_MIN_DBFS = -90;
const NIVEAU_MAX_DBFS = 0;

const RAISONS: Record<string, string> = {
  silence: 'silence',
  clarte: 'clarté insuffisante',
  plage: 'hors plage 70–1400 Hz',
};

function pourcentageNiveau(dbfs: number): number {
  const p = (dbfs - NIVEAU_MIN_DBFS) / (NIVEAU_MAX_DBFS - NIVEAU_MIN_DBFS);
  return Math.min(100, Math.max(0, p * 100));
}

export class VueDetection {
  private readonly note = element('note-stable');
  private readonly statut = element('statut');
  private readonly frequence = element('mesure-frequence');
  private readonly cents = element('mesure-cents');
  private readonly clarte = element('mesure-clarte');
  private readonly brute = element('mesure-brute');
  private readonly latence = element('mesure-latence');
  private readonly barre = element('niveau-barre');
  private readonly repereSeuil = element('niveau-seuil');
  private readonly niveauTexte = element('niveau-texte');
  private readonly historique = element<HTMLOListElement>('historique');
  private derniereNote: NoteDetectee | null = null;

  afficher(etat: EtatDetection, seuilDbfs: number): void {
    this.barre.style.width = `${pourcentageNiveau(etat.niveauDbfs)}%`;
    this.barre.classList.toggle('silence', etat.silence);
    this.repereSeuil.style.left = `${pourcentageNiveau(seuilDbfs)}%`;
    this.niveauTexte.textContent = `${formaterNombre(etat.niveauDbfs, 1)} dBFS (seuil ${formaterNombre(seuilDbfs, 1)})`;

    this.clarte.textContent = etat.brute ? formaterNombre(etat.brute.clarte, 2) : '—';
    this.brute.textContent = etat.brute
      ? `${formaterHz(etat.brute.frequence)}${etat.rejet ? ` (rejetée : ${RAISONS[etat.rejet]})` : ''}`
      : '—';

    // Sous le seuil ou sans note stable, on ne met pas à jour la note affichée : elle est grisée.
    if (etat.stable) {
      this.derniereNote = etat.stable;
      this.note.textContent = etat.stable.libelle;
      this.frequence.textContent = formaterHz(etat.stable.frequence);
      this.cents.textContent = formaterCents(etat.stable.cents);
    }
    this.note.classList.toggle('ancienne', !etat.stable && this.derniereNote !== null);
    this.statut.textContent = etat.silence
      ? 'silence'
      : etat.stable
        ? 'note stable'
        : etat.rejet
          ? RAISONS[etat.rejet]!
          : 'en attente de stabilité';

    if (etat.nouvelleNoteStable && etat.stable) this.ajouterHistorique(etat.stable, etat.latenceMs);
    if (etat.latenceMs !== null) this.latence.textContent = `${Math.round(etat.latenceMs)} ms`;
  }

  private ajouterHistorique(note: NoteDetectee, latenceMs: number | null): void {
    const li = document.createElement('li');
    const heure = document.createElement('span');
    heure.className = 'heure';
    heure.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 1,
    });
    const texte = document.createTextNode(
      `${note.libelle} · ${formaterHz(note.frequence)} · ${formaterCents(note.cents)}` +
        (latenceMs !== null ? ` · latence ${Math.round(latenceMs)} ms` : ''),
    );
    li.append(heure, texte);
    this.historique.prepend(li);
    while (this.historique.children.length > TAILLE_HISTORIQUE) this.historique.lastElementChild?.remove();
  }

  arreter(): void {
    this.statut.textContent = 'Micro arrêté';
    this.barre.style.width = '0';
    this.niveauTexte.textContent = '— dBFS';
    this.clarte.textContent = '—';
    this.brute.textContent = '—';
  }
}
