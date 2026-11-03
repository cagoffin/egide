// L'essaim : répartition sur les cibles, tactiques d'approche, déplacement (MODELE § 6.1 et § 8.2).
import {melanger} from "./hasard.js";
import {est_actif, journaliser} from "./tir.js";
import {avancer, decaler_lateralement, distance, point_polaire} from "./vecteurs.js";

// Dispersion autour du cap d'un groupe 'direct' : quelques km, pour que le groupe arrive en vague serrée.
const DISPERSION_GROUPE = 2_000;
// Profondeur de la colonne 'fourmi' : l'essaim compact s'étire sur quelques km le long du couloir.
const PROFONDEUR_COLONNE = 4_000;

/** Rendre l'indice de cible de chaque drone : au plus `drones_concentration_max` par cible (MODELE § 6.1). */
export function repartir_drones(scenario, hasard) {
  const groupes = Math.min(scenario.cibles_nombre, Math.ceil(scenario.drones_nombre / scenario.drones_concentration_max));
  const visees = melanger([...Array(scenario.cibles_nombre).keys()], hasard).slice(0, groupes);
  return Array.from({length: scenario.drones_nombre}, (_, i) => visees[i % groupes]);
}

const TACTIQUES = {
  direct(contexte, cible, hasard) {
    const angle = contexte.caps[cible];
    const entree = point_polaire(contexte.rayonApparition, angle);
    const decalage = hasard.uniforme(-DISPERSION_GROUPE / 2, DISPERSION_GROUPE / 2);
    return {position: decaler_lateralement(entree, angle, decalage), route: [contexte.cibles[cible]], depart: 0};
  },
  disperse(contexte, cible, hasard) {
    const position = point_polaire(contexte.rayonApparition, hasard.uniforme(0, 2 * Math.PI));
    return {position, route: [contexte.cibles[cible]], depart: hasard.uniforme(0, contexte.scenario.drones_etalement)};
  },
  fourmi(contexte, cible, hasard) {
    const {scenario, capFourmi: angle} = contexte;
    const decalage = hasard.uniforme(-scenario.fourmi_largeur_couloir / 2, scenario.fourmi_largeur_couloir / 2);
    const entree = point_polaire(contexte.rayonApparition + hasard.uniforme(0, PROFONDEUR_COLONNE), angle);
    const eclatement = decaler_lateralement(point_polaire(scenario.fourmi_eclatement_rayon, angle), angle, decalage);
    return {position: decaler_lateralement(entree, angle, decalage), route: [eclatement, contexte.cibles[cible]], depart: 0};
  },
};

/** Rendre les drones de l'essaim, placés à `rayonApparition` m du centre selon la tactique du scénario. */
export function creer_drones(scenario, cibles, hasard, rayonApparition) {
  const fabrique = TACTIQUES[scenario.drones_tactique];
  if (!fabrique) throw new Error(`tactique inconnue : ${scenario.drones_tactique} (${Object.keys(TACTIQUES).join(", ")})`);
  const contexte = {
    scenario,
    cibles,
    rayonApparition,
    caps: cibles.map(() => hasard.uniforme(0, 2 * Math.PI)),
    capFourmi: hasard.uniforme(0, 2 * Math.PI),
  };
  return repartir_drones(scenario, hasard).map((cible, id) => ({
    id, cible, vivant: true, arrive: false, vise: false, detection: null, vitesse: {x: 0, y: 0},
    ...fabrique(contexte, cible, hasard),
  }));
}

/** Faire avancer chaque drone actif de `dt` s le long de sa route ; un drone au bout de sa route frappe sa cible. */
export function avancer_drones(monde, dt) {
  const pas = monde.scenario.drones_vitesse * dt;
  for (const drone of monde.drones) {
    if (!est_actif(drone, monde.t)) continue;
    const avant = drone.position;
    let reste = pas;
    while (reste > 0 && drone.route.length) {
      const suivant = avancer(drone.position, drone.route[0], reste);
      reste -= distance(drone.position, suivant);
      drone.position = {x: suivant.x, y: suivant.y};
      if (!suivant.atteint) break;
      drone.route.shift();
    }
    drone.vitesse = {x: (drone.position.x - avant.x) / dt, y: (drone.position.y - avant.y) / dt};
    if (drone.route.length === 0) {
      drone.arrive = true;
      monde.fuites[drone.cible]++;
      journaliser(monde, {type: "impact", cible: drone.cible});
    }
  }
}

/** Marquer l'instant où chaque drone entre dans la couverture radar (MODELE § 2). */
export function detecter_drones(monde) {
  const centre = {x: 0, y: 0};
  for (const drone of monde.drones) {
    if (drone.detection === null && est_actif(drone, monde.t) && distance(drone.position, centre) <= monde.rayonDetection) {
      drone.detection = monde.t;
    }
  }
}
