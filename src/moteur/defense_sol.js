// Postes sol-air : co-localisés avec les cibles, munitions partagées, cadence tirée du MODELE § 5.
import {plus_proche, resoudre_tir} from "./tir.js";

/** Rendre les postes sol, répartis à parts égales sur les cibles (`cibles` : {geo, ecef}), chacun avec sa part du stock. */
export function creer_postes(scenario, cibles) {
  const {nombre, munitions} = scenario.sol;
  return Array.from({length: nombre}, (_, i) => ({
    id: i,
    cible: i % cibles.length,
    geo: cibles[i % cibles.length].geo,
    ecef: cibles[i % cibles.length].ecef,
    munitions: Math.floor(munitions / nombre) + (i < munitions % nombre ? 1 : 0),
    prochain_tir: 0,
  }));
}

/**
 * Rendre l'intervalle entre deux tirs d'un poste, en s (MODELE § 5) : un drone traverse la bulle en portée / vitesse
 * secondes, pendant lesquelles le poste doit réaliser ses `engagements_par_passage` tirs.
 */
export const cadence_sol = (scenario) => scenario.sol.portee / scenario.rouge.vitesse / scenario.sol.engagements_par_passage;

/** Faire tirer chaque poste prêt sur le drone le plus proche dans sa bulle ; le résultat est immédiat. */
export function tirer_sol(monde) {
  const {sol} = monde.scenario;
  const cadence = cadence_sol(monde.scenario);
  for (const poste of monde.postes) {
    if (poste.munitions === 0 || monde.t < poste.prochain_tir) continue;
    const drone = plus_proche(monde, poste.ecef, sol.portee, false);
    if (!drone) continue;
    poste.munitions--;
    poste.prochain_tir = monde.t + cadence;
    monde.compteurs.tirs_sol++;
    resoudre_tir(monde, drone, sol.pk, "sol", poste.geo);
  }
}
