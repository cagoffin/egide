// Entités du scope en symbologie inspirée d'APP-6 : ami en dôme (plein = IR, creux = laser), hostile en
// demi-losange, cibles en carré ; bulle de défense sol dont l'opacité suit les munitions restantes.
import {chemin_cercle, ecran as projeter_ecran} from "./ecran.js";
import {COULEURS} from "./couleurs.js";
import {avancement} from "./effets.js";

const TAILLE = 6;

/** Tracer les bulles sol et les cibles, avec le nombre de drones arrivés et l'éclair des impacts récents. */
export function dessiner_cibles(ctx, camera, monde, effets, maintenant) {
  const {sol} = monde.scenario;
  const munitionsInitiales = monde.postes.length ? sol.munitions : 0;
  monde.cibles.forEach((cible, indice) => {
    const ecran = projeter_ecran(camera, cible.geo);
    const postes = monde.postes.filter((poste) => poste.cible === indice);
    if (postes.length) {
      const restantes = postes.reduce((somme, poste) => somme + poste.munitions, 0);
      const part = restantes / (munitionsInitiales / monde.cibles.length);
      ctx.fillStyle = `rgba(184, 134, 11, ${0.05 + 0.13 * part})`;
      ctx.strokeStyle = COULEURS.sol;
      ctx.lineWidth = 1;
      chemin_cercle(ctx, camera, cible.geo, sol.portee, 36);
      ctx.fill();
      ctx.stroke();
    }
    const frappe = effets.liste.some((effet) => effet.type === "impact" && effet.cible === indice);
    ctx.fillStyle = frappe ? COULEURS.hostile : COULEURS.fond;
    ctx.strokeStyle = COULEURS.texte;
    ctx.lineWidth = 1.5;
    ctx.fillRect(ecran.x - 5, ecran.y - 5, 10, 10);
    ctx.strokeRect(ecran.x - 5, ecran.y - 5, 10, 10);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = COULEURS.texte;
    ctx.fillText(`C${indice + 1}`, ecran.x + 9, ecran.y - 6);
    if (monde.fuites[indice]) {
      ctx.fillStyle = COULEURS.hostile;
      ctx.fillText(`${monde.fuites[indice]} frappes`, ecran.x + 9, ecran.y + 9);
    }
  });
  dessiner_impacts(ctx, camera, monde, effets, maintenant);
}

function dessiner_impacts(ctx, camera, monde, effets, maintenant) {
  for (const effet of effets.liste) {
    if (effet.type !== "impact") continue;
    const progres = avancement(effet, maintenant);
    const ecran = projeter_ecran(camera, monde.cibles[effet.cible].geo);
    ctx.strokeStyle = `rgba(229, 87, 75, ${1 - progres})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ecran.x, ecran.y, 8 + 36 * progres, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

/** Tracer les drones en vol : plots d'historique estompés, puis le symbole hostile (gris tant que non détecté). */
export function dessiner_drones(ctx, camera, monde, traces) {
  for (const [, plots] of traces.plots) {
    plots.forEach((plot, rang) => {
      const ecran = projeter_ecran(camera, plot);
      ctx.fillStyle = `rgba(229, 87, 75, ${0.12 + (0.4 * rang) / plots.length})`;
      ctx.fillRect(ecran.x - 1, ecran.y - 1, 2, 2);
    });
  }
  for (const drone of monde.drones) {
    if (!drone.vivant || drone.arrive || monde.t < drone.depart) continue;
    const ecran = projeter_ecran(camera, drone.geo);
    ctx.fillStyle = drone.detection === null ? COULEURS.inconnu : COULEURS.hostile;
    ctx.beginPath();
    ctx.moveTo(ecran.x, ecran.y - TAILLE * 0.8);
    ctx.lineTo(ecran.x + TAILLE * 0.8, ecran.y);
    ctx.lineTo(ecran.x - TAILLE * 0.8, ecran.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Tracer les avions : dôme ami, ligne pointillée vers le point de mise à poste, estompés une fois vides. */
export function dessiner_avions(ctx, camera, monde) {
  for (const avion of monde.avions) {
    const ecran = projeter_ecran(camera, avion.geo);
    ctx.globalAlpha = avion.munitions === 0 ? 0.35 : 1;
    if (avion.etat === "ralliement" && avion.point) {
      const but = projeter_ecran(camera, avion.point);
      ctx.strokeStyle = COULEURS.ami;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ecran.x, ecran.y);
      ctx.lineTo(but.x, but.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.arc(ecran.x, ecran.y + 3, TAILLE + 1, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COULEURS.ami;
    ctx.fillStyle = COULEURS.ami;
    if (avion.guidage === "ir") ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Tracer les tirs (trait de la couleur du tireur) et les éclats des destructions. */
export function dessiner_tirs(ctx, camera, effets, maintenant) {
  for (const effet of effets.liste) {
    const progres = avancement(effet, maintenant);
    const couleur = effet.couche === "air" ? "74, 152, 232" : "184, 134, 11";
    if (effet.type === "trait") {
      const de = projeter_ecran(camera, effet.de);
      const vers = projeter_ecran(camera, effet.vers);
      ctx.strokeStyle = `rgba(${couleur}, ${0.9 * (1 - progres)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(de.x, de.y);
      ctx.lineTo(vers.x, vers.y);
      ctx.stroke();
    } else if (effet.type === "eclat") {
      const ecran = projeter_ecran(camera, effet.position);
      ctx.strokeStyle = `rgba(255, 241, 204, ${1 - progres})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ecran.x, ecran.y, 2 + 12 * progres, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
}
