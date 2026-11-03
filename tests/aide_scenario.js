// Fabrique de scénarios pour les tests : le scénario de référence, modifié en unités d'affichage.
import {readFileSync} from "node:fs";
import {lire_scenario, modifier_scenario} from "../src/moteur/scenario.js";

export const REFERENCE = JSON.parse(readFileSync(new URL("../scenarios/reference.json", import.meta.url)));
export const scenario = (modifications = {}) => lire_scenario(modifier_scenario(REFERENCE, modifications));
