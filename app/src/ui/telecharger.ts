// Téléchargement d'un fichier produit par la page (export du journal), comme l'export de l'application.

/** Propose un fichier au téléchargement. */
export function telecharger(nom: string, contenu: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}
