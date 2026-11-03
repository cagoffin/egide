// Ce que partagent les couches air et sol : choix du drone visé et tirage du résultat d'un tir (MODELE § 8.5).
import {parcourir_voisins} from "./grille.js";
import {distance} from "./vecteurs.js";

/** Rendre vrai si le drone vole : parti, ni détruit, ni arrivé sur sa cible. */
export const est_actif = (drone, t) => drone.vivant && !drone.arrive && t >= drone.depart;

/**
 * Rendre le drone actif le plus proche de `position` à moins de `portee` m, ou null.
 * `exclureVises` écarte les drones qu'une roquette en vol vise déjà : on ne gaspille pas deux tirs sur un drone.
 */
export function plus_proche(monde, position, portee, exclureVises) {
  let retenu = null;
  let meilleure = portee;
  parcourir_voisins(monde.index, position, portee, (drone) => {
    if (!est_actif(drone, monde.t) || (exclureVises && drone.vise)) return;
    const ecart = distance(drone.position, position);
    if (ecart <= meilleure) {
      meilleure = ecart;
      retenu = drone;
    }
  });
  return retenu;
}

/** Ajouter un évènement au journal du monde, s'il est tenu (le rejeu de l'étape 3 s'en nourrit). */
export function journaliser(monde, evenement) {
  if (monde.evenements) monde.evenements.push({t: monde.t, ...evenement});
}

/** Tirer le résultat d'un tir de probabilité de destruction `pk` sur `drone`, par la couche `couche` ("air" ou "sol"). */
export function resoudre_tir(monde, drone, pk, couche, origine) {
  if (!est_actif(drone, monde.t)) return;
  const detruit = monde.hasard.succes(pk);
  journaliser(monde, {type: "tir", couche, de: origine, vers: {...drone.position}, detruit});
  if (!detruit) return;
  drone.vivant = false;
  monde.compteurs[`detruits_${couche}`]++;
}
