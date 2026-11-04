// Fabrique de scénarios pour les tests : le scénario de référence, modifié par chemins, résolu avec le catalogue,
// et le registre de tous les algorithmes du disque.
import {readFileSync} from "node:fs";
import {charger_unites} from "../src/moteur/catalogue.js";
import {charger_tous_algos, ids_unites_disque, lire_fichier} from "../src/moteur/catalogue_node.js";
import {modifier_scenario, resoudre_scenario} from "../src/moteur/scenario.js";

export const REFERENCE = JSON.parse(readFileSync(new URL("../scenarios/reference.json", import.meta.url)));
// Tout le catalogue public et privé : un test peut citer n'importe quelle unité (moyens de liaison, par exemple).
export const FICHIERS = await charger_unites(ids_unites_disque(), lire_fichier);
export const REGISTRE = await charger_tous_algos();

/** Rendre le scénario de référence modifié par `modifications` ({chemin: valeur}), résolu en SI. */
export const scenario = (modifications = {}) => resoudre_scenario(modifier_scenario(REFERENCE, modifications), FICHIERS);
