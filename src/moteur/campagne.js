// Campagne Monte-Carlo, partie pure : utilisable sous Node (src/campagne.js) comme dans un Worker du navigateur.
import {bilan, simuler} from "./monde.js";
import {en_v2, lire_chemin, modifier_scenario, resoudre_scenario} from "./scenario.js";
import {resumer} from "./statistiques.js";

export const GRANDEURS = ["fuites", "fuites_max_cible", "detruits_air", "detruits_sol", "tirs_air", "tirs_sol", "duree"];

/**
 * Rendre les bilans de `tirages` raids du scénario `brut`, graines successives depuis la sienne : le tirage i d'une
 * campagne et le tirage i d'une autre partent de la même graine (nombres aléatoires communs, MODELE § 14.3).
 * `fichiers` : catalogue d'unités chargé ; `registre` : algorithmes chargés (voir ids_algos).
 */
export function bilans_campagne(brut, tirages, fichiers, registre) {
  const v2 = en_v2(brut);
  const graine = lire_chemin(v2, "simulation.graine");
  return Array.from({length: tirages}, (_, i) => {
    const scenario = resoudre_scenario(modifier_scenario(v2, {"simulation.graine": graine + i}), fichiers);
    return bilan(simuler(scenario, {registre, journal: false}));
  });
}

/** Rendre {grandeur: résumé statistique} d'une liste de bilans. */
export const resumer_bilans = (bilans) => Object.fromEntries(GRANDEURS.map((g) => [g, resumer(bilans.map((b) => b[g]))]));

/** Rendre le résumé statistique de `tirages` raids du scénario `brut` (voir bilans_campagne). */
export const mener_campagne = (brut, tirages, fichiers, registre) => resumer_bilans(bilans_campagne(brut, tirages, fichiers, registre));
