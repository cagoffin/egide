// Campagne Monte-Carlo, partie pure : utilisable sous Node (src/campagne.js) comme dans un Worker du navigateur.
import {bilan, simuler} from "./monde.js";
import {lire_scenario, modifier_scenario} from "./scenario.js";
import {resumer} from "./statistiques.js";

export const GRANDEURS = ["fuites", "fuites_max_cible", "detruits_air", "detruits_sol", "tirs_air", "tirs_sol", "duree"];

/** Rendre le résumé statistique de `tirages` raids du scénario `brut`, graines successives depuis la sienne. */
export function mener_campagne(brut, tirages) {
  const bilans = Array.from({length: tirages}, (_, i) => {
    const scenario = lire_scenario(modifier_scenario(brut, {graine: brut.graine + i}));
    return bilan(simuler(scenario, {journal: false}));
  });
  return Object.fromEntries(GRANDEURS.map((grandeur) => [grandeur, resumer(bilans.map((b) => b[grandeur]))]));
}
