// Géométrie plane du moteur : positions {x, y} en m, origine au centre de la zone défendue.

/** Rendre la distance entre deux points, en m. */
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Rendre le point à `rayon` du centre dans la direction `angle` (rad). */
export const point_polaire = (rayon, angle) => ({x: rayon * Math.cos(angle), y: rayon * Math.sin(angle)});

/** Rendre `point` décalé de `decalage` m perpendiculairement à la direction `angle`. */
export const decaler_lateralement = (point, angle, decalage) => ({
  x: point.x - decalage * Math.sin(angle),
  y: point.y + decalage * Math.cos(angle),
});

/** Rendre la position atteinte en avançant d'au plus `pas` m vers `but`, et si le but est atteint. */
export function avancer(position, but, pas) {
  const restant = distance(position, but);
  if (restant <= pas) return {x: but.x, y: but.y, atteint: true};
  const fraction = pas / restant;
  return {x: position.x + (but.x - position.x) * fraction, y: position.y + (but.y - position.y) * fraction, atteint: false};
}
