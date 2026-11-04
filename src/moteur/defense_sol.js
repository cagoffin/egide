// Postes sol-air : co-localisés avec les cibles, munitions partagées ; cadence donnée par l'algorithme tir_sol.
import {algo} from "./algos.js";
import {connu_du_centre} from "./reseau.js";
import {est_actif, plus_proche, resoudre_tir} from "./tir.js";
import {distance_oblique} from "./geodesie.js";
import {parcourir_voisins} from "./grille.js";

/**
 * Rendre le drone actif le plus éloigné dans la bulle, hors de `pris` : celui qui vient d'y entrer, le premier que
 * voit le capteur du poste, et que les postes voisins n'ont pas déjà en acquisition.
 */
function plus_loin(monde, centre, portee, pris) {
  let [retenu, meilleure] = [null, -1];
  parcourir_voisins(monde.index, centre, portee, (drone) => {
    if (!est_actif(drone, monde.t) || pris.has(drone.id)) return;
    const ecart = distance_oblique(drone.ecef, centre);
    if (ecart <= portee && ecart > meilleure) [retenu, meilleure] = [drone, ecart];
  });
  return retenu;
}

/**
 * Rendre vrai si un centre a désigné `drone` au poste : il le connaît, et l'information a eu le temps de parcourir
 * la liaison du centre jusqu'aux postes de la cible (MODELE § 18.3). En réseau complet, il suffit qu'il soit connu.
 */
export function designe(monde, poste, drone) {
  const {reseau} = monde;
  if (reseau.simple) return drone.connu !== null && drone.connu <= monde.t;
  return reseau.latences_sol.some((latences, c) => {
    const connu = connu_du_centre(drone, c);
    return connu !== null && connu + (latences[poste.cible] ?? Infinity) <= monde.t;
  });
}

/**
 * Rendre le drone sur lequel le poste peut tirer maintenant, et s'il lui a été désigné (MODELE § 18.3) : le plus
 * proche de la bulle s'il est désigné ; sinon le poste acquiert seul le drone qui entre dans sa bulle (le plus
 * éloigné, le premier que voit son capteur), le garde tant qu'il y reste, et ne tire qu'après le délai d'acquisition.
 */
function cible_du_poste(monde, poste, sol) {
  const proche = plus_proche(monde, poste.ecef, sol.portee, false);
  if (!proche) return null;
  if (designe(monde, poste, proche)) return {drone: proche, designe: true};
  const enCours = poste.acquisition && monde.drones[poste.acquisition.drone];
  const garde = enCours && est_actif(enCours, monde.t) && distance_oblique(enCours.ecef, poste.ecef) <= sol.portee ? enCours : null;
  // Les postes d'une même cible se répartissent les drones qu'ils acquièrent seuls.
  const pris = new Set(monde.postes.filter((p) => p !== poste && p.cible === poste.cible && p.acquisition).map((p) => p.acquisition.drone));
  const drone = garde ?? plus_loin(monde, poste.ecef, sol.portee, pris) ?? proche;
  if (designe(monde, poste, drone)) return {drone, designe: true};
  if (!garde) poste.acquisition = {drone: drone.id, t: monde.t};
  return monde.t - poste.acquisition.t >= sol.acquisition ? {drone, designe: false} : null;
}

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

/** Faire tirer chaque poste prêt sur le drone le plus proche dans sa bulle ; le résultat est immédiat. */
export function tirer_sol(monde) {
  const {sol, rouge} = monde.scenario;
  const cadence = algo(monde.registre, sol.algos.tir_sol, "tir_sol").cadence(sol, rouge.vitesse);
  for (const poste of monde.postes) {
    if (poste.munitions === 0 || monde.t < poste.prochain_tir) continue;
    const choix = cible_du_poste(monde, poste, sol);
    if (!choix) continue;
    const {drone} = choix;
    poste.munitions--;
    poste.prochain_tir = monde.t + cadence;
    monde.compteurs.tirs_sol++;
    resoudre_tir(monde, drone, sol.pk, "sol", poste.geo, poste.id, {designe: choix.designe});
  }
}
