// Résume un journal JSON exporté par le mode 1 de l'application (format fretmap-mode1-journal), en Markdown, rejoue les
// passages de niveau dans chaque difficulté (facile, normal, difficile, hardcore) avec les règles actuelles, et compte
// les conditions qui bloquent le passage dans la difficulté jouée.
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
const { ACQUISE, DIFFICULTES, reglagesDe } = await charger(
  "src/jeu/niveauxDifficulte.ts",
);
const { plafondVitesse } = await charger("src/jeu/reglages.ts");
const { acquise, reussiteNote, reussiteGlobale, scoreEssai } = await charger(
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
 * Vitesse après un essai, comme Partie : chaque case fausse la ralentit (sauf la 3e, qui perd la note), une note juste
 * l'accélère de `acceleration × score` jusqu'au plafond, une note perdue ou ratée la ralentit.
 */
function vitesseApres(vitesse, brut, essai, r, plafond) {
  const ralentissements = brut.resultat === "perdue" ? brut.fausses.length - 1 : brut.fausses.length;
  let v = vitesse * (1 - r.ralentissement) ** Math.max(0, ralentissements);
  if (brut.resultat === "juste") return { avant: v, apres: Math.min(plafond, v + r.acceleration * scoreEssai(essai, r)) };
  return { avant: v, apres: v * (1 - r.ralentissement) };
}

/**
 * Conditions de passage après chaque essai du niveau, dans la difficulté, comme Partie.niveauValide : vitesse au
 * plafond, chaque note validée (essais minimum, réussite ≥ seuilNote, acquise en hardcore : ACQUISE), réussite du
 * niveau. Les essais des niveaux précédents de la partie comptent. La vitesse est recalculée avec les réglages de la
 * difficulté, à partir de 0 au début du niveau (comme après un passage) : la vitesse du journal ne suit que la
 * difficulté jouée, et un plafond plus haut ne serait jamais atteint.
 * @returns le premier essai du niveau où le passage serait validé (null si jamais), les conditions manquantes après
 *   chaque essai, et le plus grand écart entre la vitesse recalculée et celle du journal (avant chaque résultat)
 */
function rejouer(difficulte, niveau, positions, essaisAvant, essaisNiveau) {
  const r = reglagesDe(difficulte);
  const plafond = plafondVitesse(niveau, r);
  const regle = { ...ACQUISE, delaiBonMs: r.delaiNoteBonMs };
  const essais = essaisAvant.map(brutVersEssai);
  const manques = [];
  let passage = null;
  let vitesse = 0;
  let ecartVitesse = 0;
  for (let i = 0; i < essaisNiveau.length; i++) {
    const e = essaisNiveau[i];
    const essai = brutVersEssai(e);
    essais.push(essai);
    const { avant, apres } = vitesseApres(vitesse, e, essai, r, plafond);
    ecartVitesse = Math.max(ecartVitesse, Math.abs(avant - e.vitesse));
    vitesse = apres;
    const manque = {
      vitesse: vitesse + 1e-9 < plafond,
      essaisMinimum: positions.filter((p) => essais.filter((x) => cle(x.position) === cle(p)).length < r.essaisMinimum),
      seuilNote: positions.filter((p) => reussiteNote(r.methodeNote, p, essais, r) + 1e-9 < r.seuilNote),
      hardcore: difficulte === "hardcore" ? positions.filter((p) => !acquise(p, essais, regle)) : [],
      niveau: reussiteGlobale(r.methodeGlobale, r.methodeNote, positions, essais, r) + 1e-9 < r.seuilGlobal,
    };
    manques.push(manque);
    const ok =
      !manque.vitesse &&
      !manque.niveau &&
      !manque.essaisMinimum.length &&
      !manque.seuilNote.length &&
      !manque.hardcore.length;
    if (ok && passage === null) passage = i + 1;
  }
  return { passage, manques, ecartVitesse };
}

const nomDe = (partie, k) => {
  const e = partie.essais.find((x) => cle(x.position) === k);
  const [corde, numeroCase] = k.split("-");
  return `${e?.nom ?? "?"} corde ${corde} case ${numeroCase}`;
};

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
  const blocages = [];
  let ecartVitesse = 0;
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
    const rejeu = DIFFICULTES.map((d) => rejouer(d, niveau, positions, avant, essais).passage ?? "non");
    // Conditions manquantes dans la difficulté jouée, sur les essais du niveau.
    const joue = rejouer(partie.difficulte ?? "normal", niveau, positions, avant, essais);
    const { manques } = joue;
    ecartVitesse = Math.max(ecartVitesse, joue.ecartVitesse);
    const sous = {};
    for (const m of manques) for (const p of [...m.seuilNote, ...m.hardcore]) sous[cle(p)] = (sous[cle(p)] ?? 0) + 1;
    blocages.push(
      `- Niveau ${niveau} (${manques.length} essais) : vitesse sous le plafond ${manques.filter((m) => m.vitesse).length}, ` +
        `essais minimum ${manques.filter((m) => m.essaisMinimum.length).length}, ` +
        `note sous le seuil ${manques.filter((m) => m.seuilNote.length).length}, ` +
        (partie.difficulte === "hardcore"
          ? `note pas encore acquise ${manques.filter((m) => m.hardcore.length).length}, `
          : "") +
        `réussite du niveau ${manques.filter((m) => m.niveau).length}. Notes qui bloquent le plus : ` +
        (Object.entries(sous)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([k, n]) => `${nomDe(partie, k)} (${n})`)
          .join(", ") || "aucune") +
        ".",
    );
    console.log(
      `| ${niveau} | ${positions.length} | ${essais.length} | ${s(duree)} | ` +
        `${essais.reduce((t, e) => t + e.fausses.length, 0)} | ${essais.filter((e) => e.resultat === "perdue").length} | ` +
        `${essais.filter((e) => e.resultat === "ratee").length} | ${s(quantile(delais, 0.5))} | ` +
        `${passage ? essais.length : "non"} | ${rejeu.join(" | ")} |`,
    );
    if (passage) positions = [...positions, ...passage.ajoutees];
  }

  // Contrôle du rejeu : avec les réglages de vitesse de la partie, la vitesse recalculée égale celle du journal.
  console.log(
    `\nVitesse recalculée dans la difficulté jouée, avec les réglages actuels : écart maximal ${ecartVitesse.toFixed(3)} ` +
      "avec le journal (au plus 0.001, l'arrondi du journal, si ces réglages n'ont pas changé depuis la partie).",
  );

  // Facile : notes naturelles seulement depuis le 01/11/2026 (NATURELLES_SEULES). Le rejeu suit les notes jouées.
  const alterees = new Set(partie.essais.filter((e) => e.nom.includes("#")).map((e) => e.nom));
  if (alterees.size > 0) {
    console.log(
      `\nNotes altérées jouées (${[...alterees].join(", ")}) : le facile ne les tire plus. ` +
        "Son rejeu porte sur les notes jouées : il ne vaut que pour ses seuils.",
    );
  }

  console.log(
    "\nConditions manquantes après chaque essai, dans la difficulté jouée, avec les règles actuelles (nombre d'essais où elle manquait) :\n",
  );
  console.log(blocages.join("\n"));

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
