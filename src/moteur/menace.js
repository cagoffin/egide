// L'essaim : répartition sur les cibles, tactiques d'approche, déplacement sur l'ellipsoïde (MODELE § 6.1, § 8.2, § 9).
import {avancer_horizontalement, decaler_lateralement, direct, direct_avec_azimut, inverse, vers_ecef} from "./geodesie.js";
import {melanger} from "./hasard.js";
import {est_actif, journaliser} from "./tir.js";

// Dispersion autour du cap d'un groupe 'direct' : quelques km, pour que le groupe arrive en vague serrée.
const DISPERSION_GROUPE = 2_000;
// Profondeur de la colonne 'fourmi' : l'essaim compact s'étire sur quelques km le long du couloir.
const PROFONDEUR_COLONNE = 4_000;

/** Rendre l'indice de cible de chaque drone : au plus `concentration_max` par cible (MODELE § 6.1). */
export function repartir_drones(scenario, hasard) {
  const {rouge, theatre} = scenario;
  const groupes = Math.min(theatre.cibles_nombre, Math.ceil(rouge.nombre / rouge.concentration_max));
  const visees = melanger([...Array(theatre.cibles_nombre).keys()], hasard).slice(0, groupes);
  return Array.from({length: rouge.nombre}, (_, i) => visees[i % groupes]);
}

/** Rendre le point à `distance` du centre dans l'azimut `azimut`, décalé latéralement de `decalage` m. */
function point_radial(origine, azimut, distance, decalage) {
  const {position, azimut: local} = direct_avec_azimut(origine, azimut, distance);
  return decaler_lateralement(position, local, decalage);
}

const TACTIQUES = {
  direct(contexte, cible, hasard) {
    const decalage = hasard.uniforme(-DISPERSION_GROUPE / 2, DISPERSION_GROUPE / 2);
    const position = point_radial(contexte.origine, contexte.caps[cible], contexte.rayonApparition, decalage);
    return {position, route: [contexte.cibles[cible]], depart: 0};
  },
  disperse(contexte, cible, hasard) {
    const position = direct(contexte.origine, hasard.uniforme(0, 2 * Math.PI), contexte.rayonApparition);
    return {position, route: [contexte.cibles[cible]], depart: hasard.uniforme(0, contexte.rouge.etalement)};
  },
  fourmi(contexte, cible, hasard) {
    const {rouge, capFourmi: azimut, origine} = contexte;
    const decalage = hasard.uniforme(-rouge.fourmi_largeur_couloir / 2, rouge.fourmi_largeur_couloir / 2);
    const entree = contexte.rayonApparition + hasard.uniforme(0, PROFONDEUR_COLONNE);
    const eclatement = point_radial(origine, azimut, rouge.fourmi_eclatement_rayon, decalage);
    return {position: point_radial(origine, azimut, entree, decalage), route: [eclatement, contexte.cibles[cible]], depart: 0};
  },
};

/** Rendre les drones de l'essaim, placés à `rayonApparition` m du centre selon la tactique du scénario. */
export function creer_drones(scenario, cibles, hasard, rayonApparition) {
  const {rouge, theatre} = scenario;
  const fabrique = TACTIQUES[rouge.tactique];
  const contexte = {
    rouge, cibles, rayonApparition, origine: theatre.origine,
    caps: cibles.map(() => hasard.uniforme(0, 2 * Math.PI)),
    capFourmi: hasard.uniforme(0, 2 * Math.PI),
  };
  return repartir_drones(scenario, hasard).map((cible, id) => {
    const {position, route, depart} = fabrique(contexte, cible, hasard);
    const geo = {...position, alt: rouge.altitude};
    // Chaque point de route garde son ECEF à l'altitude du drone : un pas ne coûte qu'un changement de repère.
    const points = route.map((point) => ({geo: point, ecef: vers_ecef({...point, alt: rouge.altitude})}));
    return {
      id, cible, vivant: true, arrive: false, vise: false, detection: null, depart, route: points,
      geo, ecef: vers_ecef(geo), vitesse: {x: 0, y: 0, z: 0},
    };
  });
}

/** Faire avancer le drone de `pas` m le long de sa route, à altitude constante (MODELE § 9.3). */
function avancer_drone(drone, pas) {
  let reste = pas;
  while (reste > 0 && drone.route.length) {
    const but = drone.route[0];
    const {ecart, position} = avancer_horizontalement(drone.geo, drone.ecef, but.ecef, reste);
    if (position) {
      drone.geo = position;
      drone.ecef = vers_ecef(position);
      return;
    }
    drone.geo = {lat: but.geo.lat, lon: but.geo.lon, alt: drone.geo.alt};
    drone.ecef = but.ecef;
    reste -= ecart;
    drone.route.shift();
  }
}

/** Faire avancer chaque drone actif de `dt` s ; un drone au bout de sa route frappe sa cible. */
export function avancer_drones(monde, dt) {
  const pas = monde.scenario.rouge.vitesse * dt;
  for (const drone of monde.drones) {
    if (!est_actif(drone, monde.t)) continue;
    const avant = drone.ecef;
    avancer_drone(drone, pas);
    drone.vitesse = {x: (drone.ecef.x - avant.x) / dt, y: (drone.ecef.y - avant.y) / dt, z: (drone.ecef.z - avant.z) / dt};
    if (drone.route.length === 0) {
      drone.arrive = true;
      monde.fuites[drone.cible]++;
      journaliser(monde, {type: "impact", cible: drone.cible});
    }
  }
}

/** Marquer l'instant où chaque drone entre dans la couverture radar : distance géodésique au centre (MODELE § 2). */
export function detecter_drones(monde) {
  for (const drone of monde.drones) {
    if (drone.detection !== null || !est_actif(drone, monde.t)) continue;
    if (inverse(monde.scenario.theatre.origine, drone.geo).distance <= monde.rayonDetection) drone.detection = monde.t;
  }
}
