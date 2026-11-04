// Fabrique de scénarios pour les tests : le scénario de référence, modifié par chemins, résolu avec le catalogue,
// et le registre de tous les algorithmes du disque.
import {readFileSync} from "node:fs";
import {charger_tous_algos, charger_unites_scenario} from "../src/moteur/catalogue_node.js";
import {modifier_scenario, resoudre_scenario} from "../src/moteur/scenario.js";

export const REFERENCE = JSON.parse(readFileSync(new URL("../scenarios/reference.json", import.meta.url)));
export const FICHIERS = await charger_unites_scenario(REFERENCE);
export const REGISTRE = await charger_tous_algos();

/** Rendre le scénario de référence modifié par `modifications` ({chemin: valeur}), résolu en SI. */
export const scenario = (modifications = {}) => resoudre_scenario(modifier_scenario(REFERENCE, modifications), FICHIERS);
