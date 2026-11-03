// Postes sol-air : co-localisés avec les cibles, munitions partagées, cadence tirée du MODELE § 5.
import {plus_proche, resoudre_tir} from "./tir.js";

/** Rendre les postes sol, répartis à parts égales sur les cibles, chacun avec sa part du stock. */
export function creer_postes(scenario, cibles) {
  const nombre = scenario.sol_postes_nombre;
  const stock = scenario.sol_roquettes_nombre + scenario.sol_missiles_nombre;
  return Array.from({length: nombre}, (_, i) => ({
    id: i,
    cible: i % cibles.length,
    position: cibles[i % cibles.length],
    munitions: Math.floor(stock / nombre) + (i < stock % nombre ? 1 : 0),
    prochain_tir: 0,
  }));
}

/**
 * Rendre l'intervalle entre deux tirs d'un poste, en s (MODELE § 5) : un drone traverse la bulle en
 * portée / vitesse secondes, pendant lesquelles le poste doit réaliser ses `sol_engagements_par_passage` tirs.
 */
export const cadence_sol = (scenario) => scenario.sol_portee / scenario.drones_vitesse / scenario.sol_engagements_par_passage;

/** Faire tirer chaque poste prêt sur le drone le plus proche dans sa bulle ; le résultat est immédiat. */
export function tirer_sol(monde) {
  const {scenario} = monde;
  const cadence = cadence_sol(scenario);
  for (const poste of monde.postes) {
    if (poste.munitions === 0 || monde.t < poste.prochain_tir) continue;
    const drone = plus_proche(monde, poste.position, scenario.sol_portee, false);
    if (!drone) continue;
    poste.munitions--;
    poste.prochain_tir = monde.t + cadence;
    monde.compteurs.tirs_sol++;
    resoudre_tir(monde, drone, scenario.sol_pk, "sol", poste.position);
  }
}
