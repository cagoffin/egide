// Lecture du catalogue et des algorithmes sous Node (campagnes, tests) : fichiers relatifs à la racine du dépôt.
import {existsSync, readdirSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {join, relative} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {charger_algos} from "./algos.js";
import {charger_unites} from "./catalogue.js";
import {ids_unites} from "./scenario.js";

export const RACINE = fileURLToPath(new URL("../../", import.meta.url));

/** Rendre le JSON du fichier `chemin`, relatif à la racine du dépôt. */
export const lire_fichier = async (chemin) => JSON.parse(await readFile(join(RACINE, chemin), "utf-8"));

/** Rendre les fichiers du catalogue dont le scénario `brut` a besoin. */
export const charger_unites_scenario = (brut) => charger_unites(ids_unites(brut), lire_fichier);

/** Rendre le module de l'algorithme au `chemin` relatif à la racine du dépôt. */
export const importer_module = (chemin) => import(pathToFileURL(join(RACINE, chemin)).href);

function fichiers_sous(dossier, extension) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, {recursive: true}).filter((f) => f.endsWith(extension)).map((f) => join(dossier, f));
}

/** Rendre les identifiants de tous les algorithmes publics et privés présents sur le disque. */
export function ids_algos_disque() {
  const publics = fichiers_sous(join(RACINE, "algos"), ".js").map((f) => relative(join(RACINE, "algos"), f));
  const prives = fichiers_sous(join(RACINE, "prive", "algos"), ".js").map((f) => `prive/${relative(join(RACINE, "prive", "algos"), f)}`);
  return [...publics, ...prives].filter((f) => !f.endsWith("index.json")).map((f) => f.replace(/\\/g, "/").replace(/\.js$/, "")).sort();
}

/** Rendre les identifiants de toutes les unités publiques et privées présentes sur le disque. */
export function ids_unites_disque() {
  const publiques = fichiers_sous(join(RACINE, "unites"), ".json").map((f) => relative(join(RACINE, "unites"), f));
  const privees = fichiers_sous(join(RACINE, "prive", "unites"), ".json").map((f) => `prive/${relative(join(RACINE, "prive", "unites"), f)}`);
  return [...publiques, ...privees].filter((f) => !f.endsWith("index.json")).map((f) => f.replace(/\\/g, "/").replace(/\.json$/, "")).sort();
}

/** Rendre le registre de tous les algorithmes présents sur le disque, validés. */
export const charger_tous_algos = () => charger_algos(ids_algos_disque(), importer_module);
