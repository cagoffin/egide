// Campagne Monte-Carlo sous Node : rejoue un scénario sur N graines et résume chaque grandeur avec son IC à 95 %.
//
//   node src/campagne.js                                        # scénario de référence, 50 tirages
//   node src/campagne.js --tirages 200 --drones_tactique direct --avions_nombre 20
//   node src/campagne.js --balayer avions_nombre=0,20,50,100     # une campagne par valeur
//
// Toute clé du scénario (unités d'affichage) se surcharge par --cle valeur. Résultats : resultats/campagnes/*.json
import {mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {bilan, simuler} from "./moteur/monde.js";
import {lire_scenario, modifier_scenario} from "./moteur/scenario.js";
import {resumer} from "./moteur/statistiques.js";

const GRANDEURS = ["fuites", "fuites_max_cible", "detruits_air", "detruits_sol", "tirs_air", "tirs_sol", "duree"];

function lire_arguments(liste) {
  const options = {scenario: "scenarios/reference.json", tirages: 50, sortie: "resultats/campagnes", balayer: null};
  const modifications = {};
  for (let i = 0; i < liste.length; i += 2) {
    const cle = liste[i].replace(/^--/, "");
    const valeur = liste[i + 1];
    if (cle in options) options[cle] = cle === "tirages" ? Number(valeur) : valeur;
    else modifications[cle] = Number.isNaN(Number(valeur)) ? valeur : Number(valeur);
  }
  return {options, modifications};
}

/** Rendre le résumé statistique de `tirages` raids du scénario `brut`, graines successives depuis la sienne. */
export function mener_campagne(brut, tirages) {
  const bilans = Array.from({length: tirages}, (_, i) => {
    const scenario = lire_scenario(modifier_scenario(brut, {graine: brut.graine + i}));
    return bilan(simuler(scenario, {journal: false}));
  });
  return Object.fromEntries(GRANDEURS.map((grandeur) => [grandeur, resumer(bilans.map((b) => b[grandeur]))]));
}

function afficher(libelle, resume) {
  const cellules = GRANDEURS.map((g) => `${g} ${resume[g].moyenne.toFixed(1)} ± ${resume[g].ic95.toFixed(1)}`);
  console.log(`${libelle.padEnd(28)} ${cellules.join(" | ")}`);
}

function enregistrer(dossier, contenu) {
  mkdirSync(dossier, {recursive: true});
  const chemin = join(dossier, `campagne-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  // Écriture atomique : un fichier interrompu ne se fait jamais passer pour un résultat.
  writeFileSync(`${chemin}.tmp`, JSON.stringify(contenu, null, 2));
  renameSync(`${chemin}.tmp`, chemin);
  return chemin;
}

function principal() {
  const {options, modifications} = lire_arguments(process.argv.slice(2));
  const brut = modifier_scenario(JSON.parse(readFileSync(options.scenario, "utf-8")), modifications);
  const [cleBalayee, liste] = options.balayer ? options.balayer.split("=") : [null, null];
  const valeurs = cleBalayee ? liste.split(",").map(Number) : [null];
  const resultats = valeurs.map((valeur) => {
    const variante = cleBalayee ? modifier_scenario(brut, {[cleBalayee]: valeur}) : brut;
    const resume = mener_campagne(variante, options.tirages);
    afficher(cleBalayee ? `${cleBalayee} = ${valeur}` : "scénario", resume);
    return {valeur, resume};
  });
  const chemin = enregistrer(options.sortie, {scenario: brut, tirages: options.tirages, cle_balayee: cleBalayee, resultats});
  console.log(`→ ${chemin}`);
}

// Lancé en ligne de commande (et non importé par un test) : un chemin avec espaces doit encore correspondre.
if (import.meta.url === pathToFileURL(process.argv[1]).href) principal();
