// Lecture du catalogue sous Node (campagnes, tests) : fichiers relatifs à la racine du dépôt.
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {charger_unites} from "./catalogue.js";
import {ids_unites} from "./scenario.js";

export const RACINE = fileURLToPath(new URL("../../", import.meta.url));

/** Rendre le JSON du fichier `chemin`, relatif à la racine du dépôt. */
export const lire_fichier = async (chemin) => JSON.parse(await readFile(new URL(chemin, `file://${RACINE}`), "utf-8"));

/** Rendre les fichiers du catalogue dont le scénario `brut` a besoin. */
export const charger_unites_scenario = (brut) => charger_unites(ids_unites(brut), lire_fichier);
