// Index spatial des drones actifs, reconstruit à chaque pas : les recherches de voisinage (postes, avions)
// passent de « tous les drones » à « les cases autour ». Sans lui, un raid de 1000 drones prend 15 s au lieu de < 1 s.
import {est_actif} from "./tir.js";

// 8 km : la portée des armes ; une recherche à 3 portées balaie 7 × 7 cases.
const TAILLE_CASE = 8_000;

const cle = (i, j) => i * 100_003 + j;

/** Rendre l'index des drones actifs à l'instant `t`. */
export function indexer_drones(drones, t) {
  const cases = new Map();
  for (const drone of drones) {
    if (!est_actif(drone, t)) continue;
    const k = cle(Math.floor(drone.position.x / TAILLE_CASE), Math.floor(drone.position.y / TAILLE_CASE));
    const contenu = cases.get(k);
    if (contenu) contenu.push(drone);
    else cases.set(k, [drone]);
  }
  return cases;
}

/** Appeler `visiter(drone)` pour chaque drone indexé dans les cases que touche le disque (`position`, `rayon`). */
export function parcourir_voisins(cases, position, rayon, visiter) {
  const iMin = Math.floor((position.x - rayon) / TAILLE_CASE);
  const iMax = Math.floor((position.x + rayon) / TAILLE_CASE);
  const jMin = Math.floor((position.y - rayon) / TAILLE_CASE);
  const jMax = Math.floor((position.y + rayon) / TAILLE_CASE);
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const contenu = cases.get(cle(i, j));
      if (contenu) for (const drone of contenu) visiter(drone);
    }
  }
}
