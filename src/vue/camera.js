// Passage monde (m, nord en haut) ↔ écran (px, y vers le bas), zoom et déplacement. Pur, testé.

/** Rendre une caméra qui montre un disque de `rayonVisible` m dans un canevas `largeur` × `hauteur` px. */
export function creer_camera(largeur, hauteur, rayonVisible) {
  return {largeur, hauteur, echelle: Math.min(largeur, hauteur) / (2 * rayonVisible), centre: {x: 0, y: 0}};
}

/** Rendre la position écran (px) d'un point du monde (m). */
export const vers_ecran = (camera, point) => ({
  x: camera.largeur / 2 + (point.x - camera.centre.x) * camera.echelle,
  y: camera.hauteur / 2 - (point.y - camera.centre.y) * camera.echelle,
});

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
