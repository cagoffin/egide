// Géométrie d'une zone à défendre (polygone dessiné ou pays) pour l'auto-configuration (MODELE § 20) : centre,
// rayon circonscrit, contour échantillonné à pas régulier, points bien répartis à l'intérieur. Pur, testé.
import {depuis_ecef, direct, geo_deg, inverse, vers_ecef} from "./geodesie.js";
import {contient, preparer_zone} from "./zones.js";

/** Rendre les sommets {lat, lon} (rad) d'une zone donnée en {lat_deg, lon_deg}. */
export const sommets = (points) => points.map((p) => geo_deg(p.lat_deg, p.lon_deg, 0));

/** Rendre le centre de la zone : barycentre des sommets en ECEF, ramené à la surface. */
export function centre_zone(geos) {
  const s = geos.map((g) => vers_ecef({...g, alt: 0})).reduce((a, b) => ({x: a.x + b.x, y: a.y + b.y, z: a.z + b.z}));
  return {...depuis_ecef({x: s.x / geos.length, y: s.y / geos.length, z: s.z / geos.length}), alt: 0};
}

/** Rendre la plus grande distance géodésique du centre à un sommet (m). */
export const rayon_circonscrit = (centre, geos) => Math.max(...geos.map((g) => inverse(centre, g).distance));

/** Rendre la zone préparée pour le test d'appartenance (plan tangent à son barycentre, § 12.5). */
export const zone_preparee = (geos) => preparer_zone({points: geos});

/** Rendre vrai si `geo` est dans la zone préparée. */
export const dans_zone = (zone, geo) => contient(zone, vers_ecef({...geo, alt: 0}));

/** Rendre la longueur du contour fermé (m), le long des géodésiques. */
export const perimetre = (geos) => geos.reduce((s, g, i) => s + inverse(g, geos[(i + 1) % geos.length]).distance, 0);

/** Rendre `n` points du contour fermé, espacés régulièrement le long de son tracé (le premier décalé d'un demi-pas). */
export function echantillonner_contour(geos, n) {
  const segments = geos.map((g, i) => ({de: g, ...inverse(g, geos[(i + 1) % geos.length])}));
  const total = segments.reduce((s, x) => s + x.distance, 0);
  const points = [];
  let [k, cumul] = [0, 0];
  for (let i = 0; i < n; i++) {
    const cible = ((i + 0.5) * total) / n;
    while (k < segments.length - 1 && cumul + segments[k].distance < cible) cumul += segments[k++].distance;
    points.push({...direct(segments[k].de, segments[k].azimut_depart, cible - cumul), alt: 0});
  }
  return points;
}

/**
 * Rendre `n` points intérieurs bien répartis (tirage le plus éloigné des points déjà retenus parmi des candidats
 * tirés au hasard dans la zone) : des cibles ou des centres qui couvrent la zone sans s'agglutiner.
 */
export function points_repartis(geos, n, hasard, candidats = 400) {
  const zone = zone_preparee(geos);
  const centre = centre_zone(geos);
  const rayon = rayon_circonscrit(centre, geos);
  const pool = [];
  for (let essai = 0; pool.length < candidats && essai < candidats * 50; essai++) {
    const g = {...direct(centre, hasard.uniforme(0, 2 * Math.PI), rayon * Math.sqrt(hasard.uniforme())), alt: 0};
    if (dans_zone(zone, g)) pool.push(g);
  }
  if (!pool.length) return [];
  const retenus = [pool.reduce((a, b) => (inverse(centre, a).distance <= inverse(centre, b).distance ? a : b))];
  while (retenus.length < n) {
    let [meilleur, ecart] = [null, -1];
    for (const g of pool) {
      const d = Math.min(...retenus.map((r) => inverse(r, g).distance));
      if (d > ecart) [meilleur, ecart] = [g, d];
    }
    retenus.push(meilleur);
  }
  return retenus.slice(0, n);
}
