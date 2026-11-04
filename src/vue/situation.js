// Situation perçue (MODELE § 15.4) : ce que sait le centre de conduite, par opposition à la vérité terrain.
import {algo} from "../moteur/algos.js";
import {OUTILS} from "../moteur/outils.js";
import {est_actif} from "../moteur/tir.js";

/** Rendre vrai si la conduite connaît `drone` à l'instant du monde (l'information lui est parvenue). */
export const connu_du_pc = (monde, drone) => drone.connu !== null && drone.connu <= monde.t;

/** Rendre les pistes que la conduite tient à l'instant du monde, par son algorithme de pistage. */
export function pistes_connues(monde) {
  const connus = monde.drones.filter((drone) => est_actif(drone, monde.t) && connu_du_pc(monde, drone));
  return algo(monde.registre, monde.scenario.conduite.pistage, "pistage").pister(connus, OUTILS);
}

/** Rendre le résumé de la situation perçue : drones en vol, drones connus du PC, pistes. */
export function resume_situation(monde) {
  const enVol = monde.drones.filter((drone) => est_actif(drone, monde.t));
  return {en_vol: enVol.length, connus: enVol.filter((drone) => connu_du_pc(monde, drone)).length, pistes: pistes_connues(monde).length};
}
