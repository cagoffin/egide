// Index spatial des drones actifs, en cases cubiques de l'espace géocentrique (ECEF) : valable partout sur le globe,
// sans singularité aux pôles ni à l'antiméridien. Reconstruit à chaque pas.
import {est_actif} from "./tir.js";

// 12 km : meilleur compromis mesuré entre les tactiques (8 km : essaim dispersé 30 % plus lent ; 24 km : essaim compact).
const TAILLE_CASE = 12_000;
// Indices de case décalés pour rester positifs : |ECEF| < 6 400 km donne |indice| < 800.
const DECALAGE = 1024;
const BASE = 2048;

const indice = (v) => Math.floor(v / TAILLE_CASE);
// Clé numérique (≤ 2³³) : une clé texte coûtait 80 % du temps de calcul d'un raid.
const cle = (i, j, k) => ((i + DECALAGE) * BASE + (j + DECALAGE)) * BASE + (k + DECALAGE);

/** Rendre l'index des drones actifs à l'instant `t` : {cases: Map(clé → {i, j, k, drones})}. */
export function indexer_drones(drones, t) {
  const cases = new Map();
  for (const drone of drones) {
    if (!est_actif(drone, t)) continue;
    const [i, j, k] = [indice(drone.ecef.x), indice(drone.ecef.y), indice(drone.ecef.z)];
    const n = cle(i, j, k);
    const contenu = cases.get(n);
    if (contenu) contenu.drones.push(drone);
    else cases.set(n, {i, j, k, drones: [drone]});
  }
  return cases;
}

/**
 * Appeler `visiter(drone)` pour chaque drone indexé dans les cases que touche le cube englobant la sphère
 * (`centre` ECEF, `rayon`). Parcourt les cases occupées plutôt que le cube quand elles sont moins nombreuses.
 */
export function parcourir_voisins(cases, centre, rayon, visiter) {
  const [x0, x1, y0, y1, z0, z1] = [centre.x - rayon, centre.x + rayon, centre.y - rayon, centre.y + rayon, centre.z - rayon, centre.z + rayon].map(indice);
  const volume = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
  if (cases.size < volume) {
    for (const {i, j, k, drones} of cases.values()) {
      if (i >= x0 && i <= x1 && j >= y0 && j <= y1 && k >= z0 && k <= z1) for (const drone of drones) visiter(drone);
    }
    return;
  }
  for (let i = x0; i <= x1; i++) {
    for (let j = y0; j <= y1; j++) {
      for (let k = z0; k <= z1; k++) {
        const contenu = cases.get(cle(i, j, k));
        if (contenu) for (const drone of contenu.drones) visiter(drone);
      }
    }
  }
}
