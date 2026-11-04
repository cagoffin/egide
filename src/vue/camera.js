// Passage monde ↔ écran. Le monde est vu en projection azimutale équidistante autour du centre du théâtre :
// les distances au centre sont exactes, les anneaux de distance restent des cercles. Pur, testé.

// Rayon moyen de la Terre (IUGG) : la projection sert l'affichage, la sphère suffit (écart < 0,5 % à 300 km).
const RAYON_MOYEN = 6_371_008.8;

/** Rendre le point plan {x vers l'est, y vers le nord} (m) d'une position géographique (rad), autour de `origine`. */
export function projeter(origine, {lat, lon}) {
  const dLon = lon - origine.lon;
  const cosC = Math.sin(origine.lat) * Math.sin(lat) + Math.cos(origine.lat) * Math.cos(lat) * Math.cos(dLon);
  const c = Math.acos(Math.min(1, Math.max(-1, cosC)));
  if (c < 1e-12) return {x: 0, y: 0};
  const k = c / Math.sin(c);
  return {
    x: RAYON_MOYEN * k * Math.cos(lat) * Math.sin(dLon),
    y: RAYON_MOYEN * k * (Math.cos(origine.lat) * Math.sin(lat) - Math.sin(origine.lat) * Math.cos(lat) * Math.cos(dLon)),
  };
}

/** Rendre une caméra centrée sur `origine` (géo) qui montre un disque de `rayonVisible` m dans `largeur` × `hauteur` px. */
export function creer_camera(largeur, hauteur, rayonVisible, origine = {lat: 0, lon: 0}) {
  return {largeur, hauteur, origine, echelle: Math.min(largeur, hauteur) / (2 * rayonVisible), centre: {x: 0, y: 0}};
}

/** Rendre la position écran (px) d'un point du monde (m). */
export const vers_ecran = (camera, point) => ({
  x: camera.largeur / 2 + (point.x - camera.centre.x) * camera.echelle,
  y: camera.hauteur / 2 - (point.y - camera.centre.y) * camera.echelle,
});

/** Rendre la position écran (px) d'une position géographique. */
export const geo_vers_ecran = (camera, geo) => vers_ecran(camera, projeter(camera.origine, geo));

/** Rendre le point du monde (m) sous une position écran (px). */
export const vers_monde = (camera, ecran) => ({
  x: camera.centre.x + (ecran.x - camera.largeur / 2) / camera.echelle,
  y: camera.centre.y - (ecran.y - camera.hauteur / 2) / camera.echelle,
});

/** Rendre la caméra zoomée de `facteur` en gardant fixe le point du monde sous `ecran`. */
export function zoomer(camera, facteur, ecran) {
  const fixe = vers_monde(camera, ecran);
  const echelle = camera.echelle * facteur;
  return {
    ...camera,
    echelle,
    centre: {
      x: fixe.x - (ecran.x - camera.largeur / 2) / echelle,
      y: fixe.y + (ecran.y - camera.hauteur / 2) / echelle,
    },
  };
}

/** Rendre la caméra décalée d'un glissement écran de (dx, dy) px. */
export const deplacer = (camera, dx, dy) => ({
  ...camera,
  centre: {x: camera.centre.x - dx / camera.echelle, y: camera.centre.y + dy / camera.echelle},
});

/** Rendre la longueur « ronde » (1, 2 ou 5 × 10^n m) dont le tracé à l'écran approche `largeurVisee` px. */
export function longueur_ronde(camera, largeurVisee) {
  const brute = largeurVisee / camera.echelle;
  const puissance = 10 ** Math.floor(Math.log10(brute));
  const facteur = [5, 2, 1].find((f) => f * puissance <= brute) ?? 1;
  return facteur * puissance;
}
