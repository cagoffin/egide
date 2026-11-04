// Zones dessinées : un drone actif qui entre dans une zone « protégée » y compte une incursion (MODELE § 12.5).
// Le test d'appartenance se fait dans le plan tangent au barycentre de la zone : juste pour des zones de quelques
// centaines de km, ce que l'on dessine sur un théâtre.
import {depuis_ecef, soustraire, vers_ecef, vers_enu} from "./geodesie.js";
import {est_actif} from "./tir.js";

// Une vérification toutes les 2 s : un drone à 800 km/h y parcourt 450 m, moins que la plus petite zone utile.
export const PERIODE_ZONES = 2;

/** Rendre la zone préparée pour le test d'appartenance : barycentre et sommets en coordonnées locales (m). */
export function preparer_zone(zone) {
  const ecefs = zone.points.map(vers_ecef);
  const moyenne = ecefs.reduce((a, b) => ({x: a.x + b.x, y: a.y + b.y, z: a.z + b.z}));
  const centre = {...depuis_ecef({x: moyenne.x / ecefs.length, y: moyenne.y / ecefs.length, z: moyenne.z / ecefs.length}), alt: 0};
  const ecefCentre = vers_ecef(centre);
  return {...zone, centre, ecefCentre, sommets: ecefs.map((e) => vers_enu(centre, soustraire(e, ecefCentre)))};
}

/** Rendre vrai si le point ECEF est dans la zone préparée (lancer de rayon dans le plan tangent). */
export function contient(zone, ecef) {
  const p = vers_enu(zone.centre, soustraire(ecef, zone.ecefCentre));
  let dedans = false;
  for (let i = 0, j = zone.sommets.length - 1; i < zone.sommets.length; j = i++) {
    const [a, b] = [zone.sommets[i], zone.sommets[j]];
    if (a.n > p.n !== b.n > p.n && p.e < ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e) dedans = !dedans;
  }
  return dedans;
}

/** Compter les incursions : chaque drone actif entré dans une zone protégée y est compté une fois. */
export function compter_incursions(monde) {
  if (monde.t < monde.prochain_controle_zones) return;
  monde.prochain_controle_zones = monde.t + PERIODE_ZONES;
  monde.zones.forEach((zone, i) => {
    if (zone.type !== "protegee") return;
    for (const drone of monde.drones) {
      if (est_actif(drone, monde.t) && !monde.incursions[i].has(drone.id) && contient(zone, drone.ecef)) monde.incursions[i].add(drone.id);
    }
  });
}
