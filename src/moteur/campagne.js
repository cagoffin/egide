// Campagne Monte-Carlo, partie pure : utilisable sous Node (src/campagne.js) comme dans un Worker du navigateur.
import {bilan, simuler} from "./monde.js";
import {en_v2, lire_chemin, modifier_scenario, resoudre_scenario} from "./scenario.js";
import {resumer} from "./statistiques.js";

export const GRANDEURS = ["fuites", "fuites_max_cible", "detruits_air", "detruits_sol", "tirs_air", "tirs_sol", "duree"];

/**
 * Rendre le résumé statistique de `tirages` raids du scénario `brut`, graines successives depuis la sienne.
 * `fichiers` : catalogue d'unités chargé ; `registre` : algorithmes chargés (voir ids_algos).
 */
export function mener_campagne(brut, tirages, fichiers, registre) {
  const v2 = en_v2(brut);
  const graine = lire_chemin(v2, "simulation.graine");
  const bilans = Array.from({length: tirages}, (_, i) => {
    const scenario = resoudre_scenario(modifier_scenario(v2, {"simulation.graine": graine + i}), fichiers);
    return bilan(simuler(scenario, {registre, journal: false}));
  });
  return Object.fromEntries(GRANDEURS.map((grandeur) => [grandeur, resumer(bilans.map((b) => b[grandeur]))]));
}
