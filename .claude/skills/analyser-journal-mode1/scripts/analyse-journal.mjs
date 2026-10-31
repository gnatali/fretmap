// Résume un journal JSON exporté par le mode 1 de l'application (format fretmap-mode1-journal), en Markdown, et
// rejoue les passages de niveau dans chaque difficulté (facile, normal, difficile, hardcore).
// Usage, depuis la racine du dépôt : node .claude/skills/analyser-journal-mode1/scripts/analyse-journal.mjs <journal.json>
// Réutilise le code de l'application (réglages, difficultés, réussite), chargé par Vite : dépendances de app/
// requises (npm ci).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "../../../../app");
const fichier = process.argv[2];
if (!fichier) {
  console.error("Usage : node analyse-journal.mjs <journal.json>");
  process.exit(1);
}

const vite = await import(
  pathToFileURL(createRequire(join(app, "package.json")).resolve("vite")).href
);
const charger = async (chemin) =>
  (
    await vite.runnerImport(join(app, chemin), {
      root: app,
      configFile: false,
      logLevel: "error",
    })
  ).module;
const { FORMAT_JOURNAL, quantile } = await charger("src/jeu/journal.ts");
const { DIFFICULTES, ESSAIS_HARDCORE, reglagesDe } = await charger(
  "src/jeu/niveauxDifficulte.ts",
);
const { plafondVitesse } = await charger("src/jeu/reglages.ts");
const { reussiteNote, reussiteGlobale, sansFaute } = await charger(
  "src/jeu/reussite.ts",
);

const brut = JSON.parse(readFileSync(fichier, "utf8"));
if (brut.format !== FORMAT_JOURNAL || !Array.isArray(brut.parties)) {
  console.error(`${fichier} : pas un journal ${FORMAT_JOURNAL}.`);
  process.exit(1);
}

const cle = (p) => `${p.corde}-${p.case}`;
const s = (ms) => (ms === null ? "–" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
const pct = (x) => `${Math.round(x * 100)} %`;

const brutVersEssai = (e) => ({
  position: e.position,
  resultat: e.resultat,
  erreurs: e.erreurs,
  delaiApparitionMs: e.delaiApparitionMs,
  delaiNoteMs: e.delaiNoteMs,
});

/**
 * Premier essai du niveau (rang dans le niveau) où le passage serait validé dans la difficulté, d'après les données
 * brutes des essais ; null si jamais. Comme dans partie.ts, les essais des niveaux précédents de la partie comptent
 * dans la réussite des notes ; la vitesse après chaque essai est recalculée.
 */
function passageDans(difficulte, niveau, positions, essaisAvant, essaisNiveau) {
  const r = reglagesDe(difficulte);
  const plafond = plafondVitesse(niveau, r);
  const essais = essaisAvant.map(brutVersEssai);
  for (let i = 0; i < essaisNiveau.length; i++) {
    const e = essaisNiveau[i];
    essais.push(brutVersEssai(e));
    const vitesse =
      e.resultat === "juste"
        ? Math.min(plafond, e.vitesse + r.acceleration * e.scoreEssai)
        : e.vitesse * (1 - r.ralentissement);
    if (vitesse + 1e-9 < plafond) continue;
    const notes = positions.every(
      (p) =>
        essais.filter((x) => cle(x.position) === cle(p)).length >= r.essaisMinimum &&
        reussiteNote(r.methodeNote, p, essais, r) + 1e-9 >= r.seuilNote &&
        (difficulte !== "hardcore" || sansFaute(p, essais, ESSAIS_HARDCORE, r.delaiNoteBonMs)),
    );
    if (notes && reussiteGlobale(r.methodeGlobale, r.methodeNote, positions, essais, r) + 1e-9 >= r.seuilGlobal) {
      return i + 1;
    }
  }
  return null;
}

brut.parties.forEach((partie, n) => {
  const { resume } = partie;
  console.log(`## Partie ${n + 1} (${partie.debut}, difficulté ${partie.difficulte ?? "normal"})\n`);
  console.log(
    `Score ${resume.score}, niveaux ${resume.niveauDepart} → ${resume.niveauAtteint}, ${resume.essais} essais, ` +
      `${resume.justes} justes, ${resume.fausses} cases fausses, ${resume.perdues} perdues, ${resume.ratees} ratées, ` +
      `meilleure série ${resume.meilleureSerie}, vitesse max ${pct(resume.vitesseMax)}, ` +
      `délai médian ${s(resume.delaiNoteMedianMs)}. Images : médiane ${partie.images.medianeMs} ms, ` +
      `p95 ${partie.images.p95Ms} ms. Pauses : ${partie.pauses.length}.\n`,
  );

  // Notes de chaque niveau : celles du départ, puis les ajoutées à chaque passage.
  let positions = partie.positionsDepart;
  const niveaux = [...new Set(partie.essais.map((e) => e.niveau))];
  console.log(
    `| Niveau | Notes | Essais | Durée | Cases fausses | Perdues | Ratées | Délai médian | Passé à l'essai (réel) | ${DIFFICULTES.join(" | ")} |`,
  );
  console.log(`|${" --- |".repeat(9 + DIFFICULTES.length)}`);
  for (const niveau of niveaux) {
    const essais = partie.essais.filter((e) => e.niveau === niveau);
    const passage = partie.passages.find((p) => p.niveau === niveau + 1);
    const duree = essais.at(-1).tResultatMs - essais[0].tApparitionMs;
    const delais = essais.filter((e) => e.delaiNoteMs !== null).map((e) => e.delaiNoteMs);
    const avant = partie.essais.filter((e) => e.niveau < niveau);
    const rejeu = DIFFICULTES.map((d) => passageDans(d, niveau, positions, avant, essais) ?? "non");
    console.log(
      `| ${niveau} | ${positions.length} | ${essais.length} | ${s(duree)} | ` +
        `${essais.reduce((t, e) => t + e.fausses.length, 0)} | ${essais.filter((e) => e.resultat === "perdue").length} | ` +
        `${essais.filter((e) => e.resultat === "ratee").length} | ${s(quantile(delais, 0.5))} | ` +
        `${passage ? essais.length : "non"} | ${rejeu.join(" | ")} |`,
    );
    if (passage) positions = [...positions, ...passage.ajoutees];
  }

  // Notes avec le plus de cases fausses, et délai médian par note.
  const parNote = new Map();
  for (const e of partie.essais) {
    const k = `${e.nom} corde ${e.position.corde} case ${e.position.case}`;
    const v = parNote.get(k) ?? { essais: 0, fausses: 0, delais: [] };
    v.essais++;
    v.fausses += e.fausses.length;
    if (e.delaiNoteMs !== null) v.delais.push(e.delaiNoteMs);
    parNote.set(k, v);
  }
  console.log("\nNotes avec des cases fausses :\n");
  for (const [k, v] of [...parNote].filter(([, v]) => v.fausses > 0).sort((a, b) => b[1].fausses - a[1].fausses)) {
    console.log(`- ${k} : ${v.fausses} en ${v.essais} essais, délai médian ${s(quantile(v.delais, 0.5))}`);
  }
  console.log("");
});
