// Le scope : assemble le fond et les entités dans l'ordre de lecture, et retrouve l'entité sous le curseur.
import {ecran as projeter_ecran} from "./ecran.js";
import {dessiner_anneaux, dessiner_balayage, dessiner_echelle} from "./cadre.js";
import {COULEURS} from "./couleurs.js";
import {dessiner_avions, dessiner_cibles, dessiner_drones, dessiner_tirs} from "./symboles.js";

/**
 * Dessiner une image du scope.
 * `etat` : {monde, traces, effets, maintenant (ms), angle (rad, balayage), balayage (bool), survol (entité ou null)}.
 */
export function dessiner_scope(ctx, camera, etat) {
  const {monde, traces, effets, maintenant} = etat;
  // Sur la carte, le canevas est un calque transparent posé sur le fond MapLibre.
  if (camera.type === "carte") ctx.clearRect(0, 0, camera.largeur, camera.hauteur);
  else {
    ctx.fillStyle = COULEURS.fond;
    ctx.fillRect(0, 0, camera.largeur, camera.hauteur);
  }
  if (etat.balayage) dessiner_balayage(ctx, camera, monde, etat.angle);
  dessiner_anneaux(ctx, camera, monde);
  dessiner_cibles(ctx, camera, monde, effets, maintenant);
  dessiner_drones(ctx, camera, monde, traces);
  dessiner_tirs(ctx, camera, effets, maintenant);
  dessiner_avions(ctx, camera, monde);
  if (etat.survol) dessiner_survol(ctx, camera, etat.survol);
  dessiner_echelle(ctx, camera);
}

function dessiner_survol(ctx, camera, survol) {
  const ecran = projeter_ecran(camera, survol.objet.geo);
  ctx.strokeStyle = COULEURS.texte;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ecran.x, ecran.y, 11, 0, 2 * Math.PI);
  ctx.stroke();
}

function plus_proche_ecran(camera, elements, position, ecran, rayonPx) {
  let retenu = null;
  let meilleure = rayonPx;
  for (const element of elements) {
    const point = projeter_ecran(camera, position(element));
    const ecart = Math.hypot(point.x - ecran.x, point.y - ecran.y);
    if (ecart <= meilleure) {
      meilleure = ecart;
      retenu = element;
    }
  }
  return retenu;
}

/** Rendre l'entité sous la position écran `ecran` : avion, cible ou drone en vol (dans cet ordre), ou null. */
export function trouver_sous_curseur(camera, monde, ecran) {
  const avion = plus_proche_ecran(camera, monde.avions, (a) => a.geo, ecran, 10);
  if (avion) return {type: "avion", objet: avion};
  const indice = monde.cibles.findIndex((cible) => {
    const point = projeter_ecran(camera, cible.geo);
    return Math.abs(point.x - ecran.x) <= 8 && Math.abs(point.y - ecran.y) <= 8;
  });
  if (indice >= 0) return {type: "cible", objet: monde.cibles[indice], indice};
  const enVol = monde.drones.filter((d) => d.vivant && !d.arrive && monde.t >= d.depart);
  const drone = plus_proche_ecran(camera, enVol, (d) => d.geo, ecran, 8);
  return drone ? {type: "drone", objet: drone} : null;
}
