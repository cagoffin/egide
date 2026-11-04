// Fond de la situation : anneaux de distance gradués, frontière, couverture radar, balayage, barre d'échelle.
// Tracés en polygones géodésiques : justes sur le scope comme sur la carte, à plat comme sur le globe.
import {direct} from "../moteur/geodesie.js";
import {longueur_ronde} from "./camera.js";
import {COULEURS} from "./couleurs.js";
import {chemin_cercle, ecran, metres_par_pixel} from "./ecran.js";
import {format_distance} from "./format.js";

const ESPACEMENT_ANNEAUX = 50_000;
const POLICE_PETITE = "11px system-ui, sans-serif";

/** Tracer les anneaux tous les 50 km, la frontière de la zone et la limite de couverture radar basse altitude. */
export function dessiner_anneaux(ctx, camera, monde) {
  const {origine, zone_rayon: zone} = monde.scenario.theatre;
  ctx.lineWidth = 1;
  ctx.font = POLICE_PETITE;
  for (let rayon = ESPACEMENT_ANNEAUX; rayon < monde.rayonDetection; rayon += ESPACEMENT_ANNEAUX) {
    ctx.strokeStyle = COULEURS.grille;
    chemin_cercle(ctx, camera, origine, rayon);
    ctx.stroke();
    const etiquette = ecran(camera, direct(origine, Math.PI / 4, rayon));
    ctx.fillStyle = COULEURS.texte_secondaire;
    ctx.fillText(format_distance(rayon), etiquette.x + 4, etiquette.y - 4);
  }
  ctx.strokeStyle = COULEURS.texte_secondaire;
  ctx.lineWidth = 1.5;
  chemin_cercle(ctx, camera, origine, zone, 144);
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = COULEURS.ami;
  ctx.lineWidth = 1;
  chemin_cercle(ctx, camera, origine, monde.rayonDetection, 144);
  ctx.stroke();
  ctx.setLineDash([]);
  const nord = ecran(camera, direct(origine, 0, monde.rayonDetection));
  ctx.fillStyle = COULEURS.ami;
  ctx.textAlign = "center";
  ctx.fillText("couverture radar", nord.x, nord.y - 8);
  ctx.textAlign = "start";
}

/** Tracer le faisceau tournant du radar : un secteur de 40° qui s'estompe, en azimut vrai. */
export function dessiner_balayage(ctx, camera, monde, angle) {
  const {origine} = monde.scenario.theatre;
  const traine = (40 * Math.PI) / 180;
  const centre = ecran(camera, origine);
  const pas = 12;
  for (let i = 0; i < pas; i++) {
    const a0 = angle - traine + (traine * i) / pas;
    const a1 = a0 + traine / pas;
    const p0 = ecran(camera, direct(origine, a0, monde.rayonDetection));
    const p1 = ecran(camera, direct(origine, a1, monde.rayonDetection));
    ctx.fillStyle = `rgba(74, 152, 232, ${(0.16 * (i + 1)) / pas})`;
    ctx.beginPath();
    ctx.moveTo(centre.x, centre.y);
    ctx.lineTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Tracer la barre d'échelle en bas à gauche, d'une longueur ronde mesurée au centre de la vue. */
export function dessiner_echelle(ctx, camera) {
  const mpp = metres_par_pixel(camera);
  const longueur = longueur_ronde(mpp, 120);
  const pixels = longueur / mpp;
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
