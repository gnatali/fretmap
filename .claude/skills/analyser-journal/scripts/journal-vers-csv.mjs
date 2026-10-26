// Convertit un journal JSON exporté par le POC en CSV (même format que l'export de la page), à côté du JSON.
// Usage, depuis la racine du dépôt : node .claude/skills/analyser-journal/scripts/journal-vers-csv.mjs <journal.json>...
// Réutilise chargerEssais et versCsv de poc-guitare/src/journal/essais.ts, chargé par Vite (dépendances du POC requises).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const poc = join(dirname(fileURLToPath(import.meta.url)), '../../../../poc-guitare');
const fichiers = process.argv.slice(2);
if (fichiers.length === 0) {
  console.error('Usage : node journal-vers-csv.mjs <journal.json>...');
  process.exit(1);
}

const vite = await import(pathToFileURL(createRequire(join(poc, 'package.json')).resolve('vite')).href);
const { module: essais } = await vite.runnerImport(join(poc, 'src/journal/essais.ts'), { root: poc, configFile: false, logLevel: 'error' });

for (const fichier of fichiers) {
  const texte = readFileSync(fichier, 'utf8');
  const brut = JSON.parse(texte);
  // chargerEssais valide chaque essai et complète les champs absents des anciens journaux (attaque).
  const liste = essais.chargerEssais({ getItem: () => texte, setItem: () => {} });
  if (!Array.isArray(brut) || liste.length !== brut.length) {
    console.error(`${fichier} : ${liste.length} essais valides sur ${Array.isArray(brut) ? brut.length : 0}, conversion annulée.`);
    process.exitCode = 1;
    continue;
  }
  const sortie = fichier.replace(/\.json$/i, '') + '.csv';
  writeFileSync(sortie, essais.versCsv(liste));
  console.log(`${sortie} : ${liste.length} essais, ${liste.length + 1} lignes avec l'en-tête.`);
}
