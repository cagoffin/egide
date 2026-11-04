// Fond du scope : anneaux de distance gradués, frontière, couverture radar, balayage, barre d'échelle.
import {longueur_ronde, vers_ecran} from "./camera.js";
import {COULEURS} from "./couleurs.js";
import {format_distance} from "./format.js";

const ESPACEMENT_ANNEAUX = 50_000;
const POLICE_PETITE = "11px system-ui, sans-serif";

function cercle(ctx, camera, rayon) {
  const centre = vers_ecran(camera, {x: 0, y: 0});
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, rayon * camera.echelle, 0, 2 * Math.PI);
  ctx.stroke();
}

/** Tracer les anneaux tous les 50 km, la frontière de la zone et la limite de couverture radar basse altitude. */
export function dessiner_anneaux(ctx, camera, monde) {
  ctx.lineWidth = 1;
  ctx.font = POLICE_PETITE;
  ctx.fillStyle = COULEURS.texte_secondaire;
  for (let rayon = ESPACEMENT_ANNEAUX; rayon < monde.rayonDetection; rayon += ESPACEMENT_ANNEAUX) {
    ctx.strokeStyle = COULEURS.grille;
    cercle(ctx, camera, rayon);
    const etiquette = vers_ecran(camera, {x: rayon * Math.SQRT1_2, y: rayon * Math.SQRT1_2});
    ctx.fillText(format_distance(rayon), etiquette.x + 4, etiquette.y - 4);
  }
  ctx.strokeStyle = COULEURS.texte_secondaire;
  ctx.lineWidth = 1.5;
  cercle(ctx, camera, monde.scenario.theatre.zone_rayon);
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = COULEURS.ami;
  ctx.lineWidth = 1;
  cercle(ctx, camera, monde.rayonDetection);
  ctx.setLineDash([]);
  const nord = vers_ecran(camera, {x: 0, y: monde.rayonDetection});
  ctx.fillStyle = COULEURS.ami;
  ctx.textAlign = "center";
  ctx.fillText("couverture radar", nord.x, nord.y - 8);
  ctx.textAlign = "start";
}

/** Tracer le faisceau tournant du radar : un rayon et une traîne de 40° qui s'estompe. */
export function dessiner_balayage(ctx, camera, monde, angle) {
  const centre = vers_ecran(camera, {x: 0, y: 0});
  const rayon = monde.rayonDetection * camera.echelle;
  const traine = (40 * Math.PI) / 180;
  const degrade = ctx.createConicGradient(angle - traine, centre.x, centre.y);
  degrade.addColorStop(0, "rgba(74, 152, 232, 0)");
  degrade.addColorStop(traine / (2 * Math.PI), "rgba(74, 152, 232, 0.16)");
  degrade.addColorStop(traine / (2 * Math.PI) + 0.0001, "rgba(74, 152, 232, 0)");
  ctx.fillStyle = degrade;
  ctx.beginPath();
  ctx.moveTo(centre.x, centre.y);
  ctx.arc(centre.x, centre.y, rayon, angle - traine, angle);
  ctx.closePath();
  ctx.fill();
}

/** Tracer la barre d'échelle en bas à gauche, d'une longueur ronde. */
export function dessiner_echelle(ctx, camera) {
  const longueur = longueur_ronde(camera, 120);
  const pixels = longueur * camera.echelle;
  const x = 16;
  const y = camera.hauteur - 18;
  ctx.strokeStyle = COULEURS.texte;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + pixels, y);
  ctx.lineTo(x + pixels, y - 5);
  ctx.stroke();
  ctx.fillStyle = COULEURS.texte;
  ctx.font = POLICE_PETITE;
  ctx.fillText(format_distance(longueur), x + pixels + 8, y + 3);
}
