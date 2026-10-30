// Résume un journal JSON exporté par le POC « Notes qui tombent » (format fretmap-chute-journal), en Markdown.
// Usage, depuis la racine du dépôt : node .claude/skills/analyser-journal-chute/scripts/analyse-journal.mjs <journal.json>
// Options du mode progressif, pour rejouer les passages avec d'autres seuils : --seuilNote=0.6, --seuilGlobal=0.7,
// --essaisMinimum=2 (les réussites restent celles du journal).
// Réutilise le code du POC (validation du stockage, plafond de vitesse, méthodes de réussite), chargé par Vite :
// dépendances de poc-chute/ requises (npm ci).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const poc = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../poc-chute",
);
const fichier = process.argv.slice(2).find((a) => !a.startsWith("--"));
const autresSeuils = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => /^--(seuilNote|seuilGlobal|essaisMinimum)=[\d.]+$/.test(a))
    .map((a) => a.slice(2).split("="))
    .map(([cle, valeur]) => [cle, Number(valeur)]),
);
if (!fichier) {
  console.error(
    "Usage : node analyse-journal.mjs <journal.json> [--seuilNote=0.6] [--seuilGlobal=0.8] [--essaisMinimum=3]",
  );
  process.exit(1);
}

const vite = await import(
  pathToFileURL(createRequire(join(poc, "package.json")).resolve("vite")).href
);
const charger = async (chemin) =>
  (
    await vite.runnerImport(join(poc, chemin), {
      root: poc,
      configFile: false,
      logLevel: "error",
    })
  ).module;
const { FORMAT_JOURNAL, estProgressive, quantile } =
  await charger("src/jeu/journal.ts");
const stockage = await charger("src/jeu/stockage.ts");
const { REGLAGES_PROGRESSIF_DEFAUT, plafondVitesse } = await charger(
  "src/jeu/progressif/reglages.ts",
);
const { METHODES_NOTE, METHODES_GLOBALES } = await charger(
  "src/jeu/progressif/reussite.ts",
);

const brut = JSON.parse(readFileSync(fichier, "utf8"));
if (brut.format !== FORMAT_JOURNAL || !Array.isArray(brut.parties)) {
  console.error(`${fichier} : pas un journal ${FORMAT_JOURNAL}.`);
  process.exit(1);
}
// Même validation que le chargement de la page : une partie invalide arrête l'analyse.
const parties = stockage.charger({
  getItem: () =>
    JSON.stringify({ version: stockage.VERSION_SCHEMA, parties: brut.parties }),
  setItem: () => {},
}).parties;
if (parties.length !== brut.parties.length) {
  console.error(
    `${fichier} : ${parties.length} parties valides sur ${brut.parties.length}, analyse annulée.`,
  );
  process.exit(1);
}

const s = (ms) =>
  ms === null || ms === undefined
    ? "–"
    : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const pc = (x) =>
  x === null || x === undefined ? "–" : `${Math.round(x * 100)} %`;
const cle = (p) => `${p.corde}-${p.case}`;
const compter = (liste, f) => liste.filter(f).length;
const tableau = (entetes, lignes) =>
  [
    `| ${entetes.join(" | ")} |`,
    `|${entetes.map(() => "---").join("|")}|`,
    ...lignes.map((l) => `| ${l.join(" | ")} |`),
  ].join("\n");

/** Notes de même nom à la suite : paires et triplets consécutifs. */
function memesNoms(noms) {
  let deux = 0;
  let trois = 0;
  for (let i = 1; i < noms.length; i++) {
    if (noms[i] === noms[i - 1]) deux++;
    if (i >= 2 && noms[i] === noms[i - 1] && noms[i] === noms[i - 2]) trois++;
  }
  return `${deux} fois 2 de suite, ${trois} fois 3 de suite (sur ${noms.length} notes)`;
}

function entete(partie, numero) {
  const pauses = partie.pauses ?? [];
  return [
    `### Partie ${numero} : ${partie.debut} (${estProgressive(partie) ? "progressif" : "classique"})`,
    "",
    `- ${partie.simulation ? "Simulation au clavier" : "Micro"}${partie.interrompue ? ", arrêtée par le joueur" : ""} ; seuil de silence ${partie.seuilSilenceDbfs ?? "–"} dBFS.`,
    `- Images : médiane ${partie.images.medianeMs ?? "–"} ms, p95 ${partie.images.p95Ms ?? "–"} ms, ${pc(partie.images.partAuDelaDe33Ms)} au-delà de 33 ms.`,
    `- Pauses : ${pauses.length}${pauses.length ? ` (${pauses.map((p) => s(p.dureeMs) + (p.arrierePlan ? ", arrière-plan" : "")).join(" ; ")})` : ""}.`,
  ];
}

function classique(partie) {
  const { reglages: r, resume, notes } = partie;
  const evenements = notes.flatMap((n) => n.evenements);
  return [
    `- Réglages : niveau ${r.niveau}, chute ${s(r.dureeInitialeMs)}${r.vitesseFixe ? " (fixe)" : ""}, fausse note « ${r.fausseNote ?? "destruction"} ».`,
    `- Résumé : score ${resume.score}, ${resume.justes} justes, ${resume.fausses} fausses, ${resume.ratees} ratées sur ${notes.length} notes ; temps de réponse médian ${s(resume.tempsReponseMedianMs)}.`,
    `- Événements : ${compter(evenements, (e) => e.type === "ancienneNote")} anciennes notes, ${compter(evenements, (e) => e.type === "nonReconnue")} notes non reconnues, ${compter(notes, (n) => n.detectee === null && n.tAttaqueMs !== null)} notes ratées avec une attaque entendue.`,
    `- Même nom à la suite : ${memesNoms(notes.map((n) => n.nom))}.`,
  ];
}

/**
 * Rejoue les conditions de passage essai par essai, à partir des réussites notées dans le journal (rien n'est
 * recalculé). Vitesse : plafond du niveau (version 2.1), ou vitesse requise des anciens journaux (plafond 100 %).
 */
function progressif(partie) {
  const r = {
    ...REGLAGES_PROGRESSIF_DEFAUT,
    ...partie.reglages,
    ...autresSeuils,
  };
  const ancien = typeof partie.reglages.vitesseRequise === "number";
  const plafond = (niveau) => (ancien ? 1 : plafondVitesse(niveau, r));
  const requise = (niveau) =>
    ancien ? partie.reglages.vitesseRequise : plafond(niveau);
  const lignes = [
    `- Réglages : méthodes « ${r.methodeNote} » et « ${r.methodeGlobale} », seuils ${pc(r.seuilNote)} par note et ${pc(r.seuilGlobal)} pour le niveau, chute la plus courte ${s(r.dureeChuteMinMs)}, ${ancien ? `vitesse requise ${pc(partie.reglages.vitesseRequise)} (sans plafond)` : `plafond ${pc(r.vitesseDepart)} + ${pc(r.vitesseParNiveau)} par niveau`}, ${r.essaisMinimum} essais minimum, ${r.notesAjoutees} notes ajoutées.`,
    `- Résumé : score ${partie.resume.score}, niveau ${partie.resume.niveauDepart} → ${partie.resume.niveauAtteint}, ${partie.resume.essais} essais (${partie.resume.justes} justes, ${partie.resume.fausses} fausses notes, ${partie.resume.perdues} perdues, ${partie.resume.ratees} ratées), délai médian ${s(partie.resume.delaiNoteMedianMs)}.`,
    `- Même nom à la suite : ${memesNoms(partie.essais.map((e) => e.nom))}.`,
    "",
  ];

  // Notes de chaque niveau : départ, puis ajouts des passages.
  const notesDuNiveau = new Map([
    [partie.niveauDepart, partie.positionsDepart],
  ]);
  let courantes = partie.positionsDepart;
  for (const passage of partie.passages) {
    courantes = [...courantes, ...passage.ajoutees];
    notesDuNiveau.set(passage.niveau, courantes);
  }
  const niveaux = [...new Set(partie.essais.map((e) => e.niveau))];
  const resumes = [];
  const blocages = [];
  const tranches = [];
  const methodes = [];
  // Comme dans le jeu, la réussite et les essais d'une note courent sur toute la partie, d'un niveau au suivant.
  const reussites = new Map();
  const nbEssais = new Map();
  for (const niveau of niveaux) {
    const essais = partie.essais.filter((e) => e.niveau === niveau);
    const notes = notesDuNiveau.get(niveau) ?? [];
    const passage = partie.passages.find((p) => p.niveau === niveau + 1);
    const debut = essais[0].tApparitionMs;
    const fin = passage ? passage.tMs : essais.at(-1).tResultatMs;
    const justes = essais.filter((e) => e.resultat === "juste");
    resumes.push([
      niveau,
      notes.length,
      pc(plafond(niveau)),
      essais.length,
      s(fin - debut),
      justes.length,
      essais.reduce((t, e) => t + e.erreurs, 0),
      compter(essais, (e) => e.resultat === "perdue"),
      compter(essais, (e) => e.resultat === "ratee"),
      s(
        quantile(
          justes.map((e) => e.delaiNoteMs),
          0.5,
        ),
      ),
      passage ? `oui, à ${s(passage.tMs)}` : "non",
    ]);

    // Conditions après chaque essai, pour la méthode choisie et pour les 9 combinaisons.
    const premier = {};
    let notesKo = 0;
    let globalKo = 0;
    let vitesseKo = 0;
    const sousLeSeuil = new Map();
    essais.forEach((e, i) => {
      reussites.set(cle(e.position), e.reussites);
      nbEssais.set(cle(e.position), (nbEssais.get(cle(e.position)) ?? 0) + 1);
      const v =
        e.resultat === "juste"
          ? Math.min(plafond(niveau), e.vitesse + r.acceleration * e.scoreEssai)
          : e.vitesse * (1 - r.ralentissement);
      const vitesseOk = v + 1e-9 >= requise(niveau);
      for (const mn of METHODES_NOTE) {
        const faibles = notes.filter(
          (p) =>
            (nbEssais.get(cle(p)) ?? 0) < r.essaisMinimum ||
            (reussites.get(cle(p))?.[mn] ?? 0) + 1e-9 < r.seuilNote,
        );
        for (const mg of METHODES_GLOBALES) {
          const ok =
            faibles.length === 0 &&
            e.globales[mn][mg] + 1e-9 >= r.seuilGlobal &&
            vitesseOk;
          if (ok && !premier[`${mn}/${mg}`])
            premier[`${mn}/${mg}`] =
              `essai ${i + 1} (${s(e.tResultatMs - debut)})`;
        }
        if (mn === r.methodeNote) {
          if (faibles.length) notesKo++;
          for (const p of faibles)
            sousLeSeuil.set(cle(p), (sousLeSeuil.get(cle(p)) ?? 0) + 1);
          if (e.globales[mn][r.methodeGlobale] + 1e-9 < r.seuilGlobal)
            globalKo++;
        }
      }
      if (!vitesseOk) vitesseKo++;
    });
    const pires = [...sousLeSeuil.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, n]) => {
        const essai = essais.find((e) => cle(e.position) === k);
        return `${essai ? essai.nom : "?"} ${k.replace("-", "/")} (${pc(n / essais.length)})`;
      });
    blocages.push([
      niveau,
      pc(notesKo / essais.length),
      pc(globalKo / essais.length),
      pc(vitesseKo / essais.length),
      pires.join(", ") || "–",
    ]);

    // Notes ratées selon la durée de chute au moment de l'essai.
    const bornes = [
      ["immobile", (d) => d === Infinity],
      ["≥ 8 s", (d) => d >= 8000 && d < Infinity],
      ["6 à 8 s", (d) => d >= 6000 && d < 8000],
      ["4 à 6 s", (d) => d >= 4000 && d < 6000],
      ["< 4 s", (d) => d < 4000],
    ];
    for (const [nom, dans] of bornes) {
      const liste = essais.filter((e) =>
        dans(e.vitesse > 0 ? r.dureeChuteMinMs / e.vitesse : Infinity),
      );
      if (liste.length)
        tranches.push([
          niveau,
          nom,
          liste.length,
          pc(compter(liste, (e) => e.resultat === "ratee") / liste.length),
        ]);
    }
    methodes.push([
      niveau,
      ...METHODES_NOTE.flatMap((mn) =>
        METHODES_GLOBALES.map((mg) => premier[`${mn}/${mg}`] ?? "–"),
      ),
    ]);
  }

  lignes.push(
    tableau(
      [
        "Niveau",
        "Notes",
        "Plafond",
        "Essais",
        "Durée",
        "Justes",
        "Fausses",
        "Perdues",
        "Ratées",
        "Délai médian",
        "Passé",
      ],
      resumes,
    ),
    "",
    "Conditions non remplies après chaque essai (méthodes choisies), et notes le plus souvent sous le seuil :",
    "",
    tableau(
      [
        "Niveau",
        "Notes sous le seuil",
        "Niveau sous le seuil",
        "Vitesse insuffisante",
        "Notes les plus souvent faibles",
      ],
      blocages,
    ),
    "",
    "Notes ratées selon la durée de chute au moment de l’essai :",
    "",
    tableau(["Niveau", "Chute", "Essais", "Ratées"], tranches),
    "",
    "Premier essai où le niveau serait passé, pour chaque méthode de note / méthode globale :",
    "",
    tableau(
      [
        "Niveau",
        ...METHODES_NOTE.flatMap((mn) =>
          METHODES_GLOBALES.map((mg) => `${mn} / ${mg}`),
        ),
      ],
      methodes,
    ),
  );
  return lignes;
}

const sortie = [
  `## Journal ${fichier.split("/").at(-1)} (exporté le ${brut.exporteLe})`,
  "",
];
if (Object.keys(autresSeuils).length) {
  sortie.push(
    `Passages rejoués avec ${Object.entries(autresSeuils)
      .map(([c, v]) => `${c} = ${v}`)
      .join(", ")}.`,
    "",
  );
}
sortie.push(
  `${parties.length} parties : ${compter(parties, (p) => !estProgressive(p))} classiques, ${compter(parties, estProgressive)} progressives.`,
  "",
);
parties.forEach((partie, i) => {
  sortie.push(
    ...entete(partie, i + 1),
    ...(estProgressive(partie) ? progressif(partie) : classique(partie)),
    "",
  );
});
console.log(sortie.join("\n"));
