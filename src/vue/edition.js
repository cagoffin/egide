// Logique de l'éditeur, sans DOM : chaque geste devient des modifications par chemin du scénario, comme un curseur.
// L'annulation, l'export, les préréglages et le rejeu marchent donc d'office (MODELE § 12). Pur, testé.
import {depuis_ecef, direct, geo_deg, inverse, vers_degres, vers_ecef} from "../moteur/geodesie.js";
import {positions_radars} from "../moteur/radars.js";

/** Rendre une position géographique en {lat_deg, lon_deg} arrondis au millionième de degré (≈ 0,1 m). */
export const en_degres = (geo) => ({
  lat_deg: Math.round(vers_degres(geo.lat) * 1e6) / 1e6,
  lon_deg: Math.round(vers_degres(geo.lon) * 1e6) / 1e6,
});

/** Rendre le point déplacé comme `de` l'est vers `vers` : même distance et même azimut par rapport au point d'arrivée. */
export function translater(point, de, vers) {
  const {distance, azimut_depart: azimut} = inverse(de, point);
  return {...(distance === 0 ? vers : direct(vers, azimut, distance)), alt: point.alt};
}

/** Rendre le barycentre (au sol) de positions géographiques, calculé en ECEF puis ramené à la surface. */
export function barycentre(points) {
  const somme = points.map((p) => vers_ecef({...p, alt: 0})).reduce((a, b) => ({x: a.x + b.x, y: a.y + b.y, z: a.z + b.z}));
  return {...depuis_ecef({x: somme.x / points.length, y: somme.y / points.length, z: somme.z / points.length}), alt: 0};
}

const points_geo = (points) => (points ?? []).map((p) => geo_deg(p.lat_deg, p.lon_deg, 0));

/**
 * Rendre les éléments éditables, avec leur position : en mode « edition », cibles, orbites d'avions, radars, points
 * du plan de vol et zones (par leur barycentre) ; en mode « ordres », les seuls avions, là où ils sont à cet instant.
 */
export function elements_editables(monde, brut, mode = "edition") {
  if (mode === "ordres") return monde.avions.map((avion) => ({cle: `avion:${avion.id}`, type: "avion", indice: avion.id, geo: avion.geo}));
  return [
    ...monde.cibles.map((cible, indice) => ({cle: `cible:${indice}`, type: "cible", indice, geo: cible.geo})),
    ...monde.avions.map((avion) => ({cle: `avion:${avion.id}`, type: "avion", indice: avion.id, geo: avion.orbite, guidage: avion.guidage})),
    ...positions_radars(monde.scenario).map((geo, indice) => ({cle: `radar:${indice}`, type: "radar", indice, geo})),
    ...points_geo(brut.rouge.plan_de_vol).map((geo, indice) => ({cle: `passage:${indice}`, type: "passage", indice, geo})),
    ...(brut.theatre.zones ?? []).map((zone, indice) => ({cle: `zone:${indice}`, type: "zone", indice, geo: barycentre(points_geo(zone.points))})),
  ];
}

const cibles_en_degres = (monde, deplacer = () => null) => monde.cibles.map((cible, i) => en_degres(deplacer(i) ?? cible.geo));

/**
 * Rendre les modifications qui déplacent les éléments `cles` comme le point `de` l'est vers `vers`.
 * Toutes les cibles et toutes les orbites d'un groupe touché sont figées : rien d'autre ne bouge à la relecture.
 */
export function modifications_deplacement(monde, brut, cles, de, vers) {
  const choisis = new Set(cles);
  const modifications = {};
  const bouge = (cle, geo) => (choisis.has(cle) ? translater(geo, de, vers) : null);
  if (cles.some((c) => c.startsWith("cible:"))) {
    modifications["theatre.cibles_placees"] = cibles_en_degres(monde, (i) => bouge(`cible:${i}`, monde.cibles[i].geo));
    modifications["theatre.cibles_nombre"] = monde.cibles.length;
  }
  monde.scenario.avions.forEach((groupe, g) => {
    const avions = monde.avions.filter((avion) => avion.groupe === groupe);
    if (!avions.some((avion) => choisis.has(`avion:${avion.id}`))) return;
    modifications[`bleu.avions.${g}.orbites_placees`] = avions.map((avion) => en_degres(bouge(`avion:${avion.id}`, avion.orbite) ?? avion.orbite));
  });
  if (cles.some((c) => c.startsWith("radar:"))) Object.assign(modifications, sites_radars(monde, (i, geo) => bouge(`radar:${i}`, geo)));
  if (cles.some((c) => c.startsWith("passage:"))) {
    modifications["rouge.plan_de_vol"] = (brut.rouge.plan_de_vol ?? []).map((p, i) => en_degres(bouge(`passage:${i}`, geo_deg(p.lat_deg, p.lon_deg)) ?? geo_deg(p.lat_deg, p.lon_deg)));
  }
  if (cles.some((c) => c.startsWith("zone:"))) {
    // Une zone se déplace d'un bloc : tous ses sommets subissent la même translation que son barycentre.
    modifications["theatre.zones"] = (brut.theatre.zones ?? []).map((zone, i) => (!choisis.has(`zone:${i}`) ? zone : {
      ...zone, points: points_geo(zone.points).map((p) => en_degres(translater(p, de, vers))),
    }));
  }
  return modifications;
}

/**
 * Rendre les modifications qui inscrivent tous les radars affichés comme sites placés (MODELE § 15.1) : `deplacer(i,
 * geo)` rend la nouvelle position du radar i ou null, `garder(i)` dit s'il reste, `ajouts` s'ajoutent à la fin.
 */
function sites_radars(monde, deplacer = () => null, garder = () => true, ajouts = []) {
  const sites = positions_radars(monde.scenario).map((geo, i) => (garder(i) ? en_degres(deplacer(i, geo) ?? geo) : null)).filter(Boolean);
  return {"bleu.radar.disposition": "sites", "bleu.radar.sites": [...sites, ...ajouts.map(en_degres)]};
}

/** Rendre les modifications qui ajoutent un radar en `geo` (les radars affichés deviennent des sites placés). */
export const modifications_ajout_radar = (monde, geo) => sites_radars(monde, undefined, undefined, [geo]);

/** Rendre les modifications qui ajoutent une zone protégée de sommets `points` (au moins trois). */
export function modifications_ajout_zone(brut, points) {
  const zones = brut.theatre.zones ?? [];
  return {"theatre.zones": [...zones, {nom: `Zone ${zones.length + 1}`, type: "protegee", points: points.map(en_degres)}]};
}

/** Rendre les modifications qui ordonnent aux avions `cles`, à l'instant du monde, de rallier `geo`. */
export function modifications_ordre(brut, monde, cles, geo) {
  const avions = cles.filter((c) => c.startsWith("avion:")).map((c) => Number(c.slice(6)));
  if (!avions.length) return {};
  const ordre = {t_s: monde.t, avions, ...en_degres(geo)};
  return {"bleu.ordres": [...(brut.bleu.ordres ?? []), ordre]};
}

/** Rendre les modifications qui ajoutent une cible en `geo` (les cibles existantes sont figées). */
export function modifications_ajout_cible(monde, geo) {
  const placees = [...cibles_en_degres(monde), en_degres(geo)];
  return {"theatre.cibles_placees": placees, "theatre.cibles_nombre": placees.length};
}

/** Rendre les modifications qui ajoutent un point de passage en fin de plan de vol, et passent l'essaim sur ce plan. */
export function modifications_ajout_passage(brut, geo) {
  return {"rouge.plan_de_vol": [...(brut.rouge.plan_de_vol ?? []), en_degres(geo)], "rouge.tactique": "plan_de_vol"};
}

/** Rendre les modifications qui suppriment cibles, radars, points de passage et zones `cles` (pas les avions). */
export function modifications_suppression(monde, brut, cles) {
  const choisis = new Set(cles);
  const modifications = {};
  if (cles.some((c) => c.startsWith("cible:"))) {
    const restantes = cibles_en_degres(monde).filter((_, i) => !choisis.has(`cible:${i}`));
    // Une zone sans cible n'a pas de sens : on garde au moins une cible.
    if (restantes.length) Object.assign(modifications, {"theatre.cibles_placees": restantes, "theatre.cibles_nombre": restantes.length});
  }
  const radars = positions_radars(monde.scenario);
  // Comme pour les cibles, on garde au moins un radar.
  if (cles.some((c) => c.startsWith("radar:")) && radars.some((_, i) => !choisis.has(`radar:${i}`))) {
    Object.assign(modifications, sites_radars(monde, undefined, (i) => !choisis.has(`radar:${i}`)));
  }
  if (cles.some((c) => c.startsWith("passage:"))) {
    modifications["rouge.plan_de_vol"] = (brut.rouge.plan_de_vol ?? []).filter((_, i) => !choisis.has(`passage:${i}`));
  }
  if (cles.some((c) => c.startsWith("zone:"))) {
    modifications["theatre.zones"] = (brut.theatre.zones ?? []).filter((_, i) => !choisis.has(`zone:${i}`));
  }
  return modifications;
}

/** Rendre les clés des éléments dont la position écran tombe dans le rectangle {x0, y0, x1, y1}. */
export function dans_rectangle(elements, versEcran, rectangle) {
  const [xMin, xMax] = [Math.min(rectangle.x0, rectangle.x1), Math.max(rectangle.x0, rectangle.x1)];
  const [yMin, yMax] = [Math.min(rectangle.y0, rectangle.y1), Math.max(rectangle.y0, rectangle.y1)];
  return elements.filter((e) => {
    const p = versEcran(e.geo);
    return p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;
  }).map((e) => e.cle);
}

/** Rendre l'élément le plus proche du point écran `point` à moins de `rayonPx`, ou null. */
export function element_sous(elements, versEcran, point, rayonPx = 10) {
  let retenu = null;
  let meilleure = rayonPx;
  for (const element of elements) {
    const p = versEcran(element.geo);
    const ecart = Math.hypot(p.x - point.x, p.y - point.y);
    if (ecart <= meilleure) [meilleure, retenu] = [ecart, element];
  }
  return retenu;
}
