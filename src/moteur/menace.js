// L'essaim : répartition sur les cibles (MODELE § 6.1), puis comportement et mouvement délégués aux algorithmes
// désignés par le scénario (rouge.tactique) et par l'unité de drone (algos.mouvement).
import {algo} from "./algos.js";
import {vers_ecef} from "./geodesie.js";
import {melanger} from "./hasard.js";
import {OUTILS} from "./outils.js";
import {radars_voyants} from "./reseau.js";
import {est_actif, journaliser} from "./tir.js";

/** Rendre l'indice de cible de chaque drone : au plus `concentration_max` par cible (MODELE § 6.1). */
export function repartir_drones(scenario, hasard) {
  const {rouge, theatre} = scenario;
  const groupes = Math.min(theatre.cibles_nombre, Math.ceil(rouge.nombre / rouge.concentration_max));
  const visees = melanger([...Array(theatre.cibles_nombre).keys()], hasard).slice(0, groupes);
  return Array.from({length: rouge.nombre}, (_, i) => visees[i % groupes]);
}

/**
 * Rendre les drones de l'essaim, placés à `rayonApparition` m du centre par l'algorithme de comportement.
 * Le moteur tire un cap par cible puis un cap commun, quel que soit le comportement : l'ordre des tirages, donc le
 * déroulement d'une graine, ne dépend pas de la tactique choisie.
 */
export function creer_drones(scenario, registre, cibles, hasard, rayonApparition) {
  const {rouge, theatre} = scenario;
  const comportement = algo(registre, rouge.comportement, "comportement");
  const contexte = {
    rouge, cibles, rayon_apparition: rayonApparition, origine: theatre.origine,
    caps: cibles.map(() => hasard.uniforme(0, 2 * Math.PI)),
    cap_commun: hasard.uniforme(0, 2 * Math.PI),
  };
  return repartir_drones(scenario, hasard).map((cible, id) => {
    const {position, route, depart} = comportement.planifier_drone(contexte, cible, hasard, OUTILS);
    const geo = {...position, alt: rouge.altitude};
    // Chaque point de route garde son ECEF à l'altitude du drone : un pas ne coûte qu'un changement de repère.
    const points = route.map((point) => ({geo: point, ecef: vers_ecef({...point, alt: rouge.altitude})}));
    return {
      id, cible, vivant: true, arrive: false, vise: false, detection: null, connu: null, depart, route: points,
      geo, ecef: vers_ecef(geo), vitesse: {x: 0, y: 0, z: 0},
    };
  });
}

/** Faire avancer chaque drone actif de `dt` s par son algorithme de mouvement ; au bout de sa route, il frappe. */
export function avancer_drones(monde, dt) {
  const {rouge} = monde.scenario;
  const mouvement = algo(monde.registre, rouge.algos.mouvement, "mouvement");
  for (const drone of monde.drones) {
    if (!est_actif(drone, monde.t)) continue;
    const avant = drone.ecef;
    const suivant = mouvement.avancer(drone, drone.route, rouge.vitesse * dt, OUTILS);
    drone.geo = suivant.geo;
    drone.ecef = suivant.ecef;
    if (suivant.atteints) drone.route.splice(0, suivant.atteints);
    drone.vitesse = {x: (drone.ecef.x - avant.x) / dt, y: (drone.ecef.y - avant.y) / dt, z: (drone.ecef.z - avant.z) / dt};
    if (drone.route.length === 0) {
      drone.arrive = true;
      monde.fuites[drone.cible]++;
      journaliser(monde, {type: "impact", cible: drone.cible});
    }
  }
}

/**
 * Marquer l'instant où chaque drone est détecté (`detection`) et celui où la conduite l'apprend (`connu`). En réseau
 * complet, c'est le même instant ; en liaisons, l'information part de chaque radar qui le voit et arrive après la
 * latence de son chemin jusqu'à la conduite, jamais si ce radar n'y est pas relié (MODELE § 15.2).
 */
export function detecter_drones(monde) {
  const detection = algo(monde.registre, monde.scenario.radar.algos.detection, "detection");
  const {reseau} = monde;
  for (const drone of monde.drones) {
    if (!est_actif(drone, monde.t)) continue;
    if (reseau.mode === "complet") {
      if (drone.detection === null && detection.detecte(monde.couverture, drone, OUTILS)) [drone.detection, drone.connu] = [monde.t, monde.t];
      continue;
    }
    if (drone.connu !== null && drone.connu <= monde.t) continue;
    const voyants = radars_voyants(detection, monde.couverture, reseau, drone, OUTILS);
    if (!voyants.length) continue;
    drone.detection ??= monde.t;
    for (const i of voyants) {
      const arrivee = monde.t + reseau.latences_radars[i];
      if (arrivee < (drone.connu ?? Infinity)) drone.connu = arrivee;
    }
  }
}
