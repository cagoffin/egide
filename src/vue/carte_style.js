// Style MapLibre et réglages de carte, sans dépendre de MapLibre : pur, testé sous Node (jalon 2).
import {direct, vers_degres} from "../moteur/geodesie.js";
import {COULEURS} from "./couleurs.js";

const CLE_REGLAGES = "egide.carte";
// Fond IGN par défaut : service Géoplateforme sans clé ; les tuiles CARTO renvoient désormais « API KEY REQUIRED ».
export const REGLAGES_DEFAUT = {fond: "fonds/ign_ortho", ombrage: true, relief_3d: false, batiments: false, globe: false};

/** Rendre les réglages de carte mémorisés dans ce navigateur, ou ceux par défaut. */
export function lire_reglages_carte() {
  try {
    return {...REGLAGES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? "{}")};
  } catch {
    // Navigation privée ou stockage bloqué : réglages par défaut, sans mémoire.
    return {...REGLAGES_DEFAUT};
  }
}

/** Mémoriser les réglages de carte dans ce navigateur (sans effet si le stockage est refusé). */
export function memoriser_reglages_carte(reglages) {
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
  } catch {
    // Mémoire refusée : la carte garde ses réglages jusqu'au rechargement.
  }
}

function source_maplibre(source) {
  const commun = {attribution: source.attribution, maxzoom: source.zoom_max, tileSize: source.taille_tuile};
  if (source.type === "raster-dem") return {type: "raster-dem", tiles: source.tuiles, encoding: source.encodage, ...commun};
  if (source.type === "vector") return source.tilejson ? {type: "vector", url: source.tilejson, attribution: source.attribution} : {type: "vector", tiles: source.tuiles, ...commun};
  return {type: "raster", tiles: source.tuiles, ...commun};
}

const premiere = (sources, prefixe) => Object.keys(sources).find((id) => id.startsWith(prefixe));

/**
 * Rendre le style MapLibre pour `reglages` ({fond, ombrage, relief_3d, batiments, globe}) et les `sources` chargées
 * ({identifiant « fonds/osm » : contenu du fichier}). Pur : testé sans navigateur.
 */
export function style_carte(sources, reglages) {
  const style = {version: 8, projection: {type: reglages.globe ? "globe" : "mercator"}, sources: {}, layers: [
    {id: "fond-uni", type: "background", paint: {"background-color": COULEURS.fond}},
  ]};
  const fond = sources[reglages.fond];
  if (fond && fond.type !== "aucun") {
    style.sources.fond = source_maplibre(fond);
    // Fond légèrement éteint : les entités du scope doivent rester ce qu'on voit d'abord.
    style.layers.push({id: "fond", type: "raster", source: "fond", paint: {"raster-saturation": -0.35, "raster-opacity": 0.9}});
  }
  const relief = sources[premiere(sources, "relief/")];
  if (relief && reglages.ombrage) {
    style.sources.relief = source_maplibre(relief);
    style.layers.push({id: "ombrage", type: "hillshade", source: "relief", paint: {
      "hillshade-shadow-color": "#0a1016", "hillshade-highlight-color": "#3d5166", "hillshade-exaggeration": 0.45,
    }});
  }
  if (relief && reglages.relief_3d) {
    // MapLibre recommande une source distincte pour le relief 3D et l'ombrage.
    style.sources.relief_3d = source_maplibre(relief);
    style.terrain = {source: "relief_3d", exaggeration: 1.5};
  }
  const batiments = sources[premiere(sources, "batiments/")];
  if (batiments && reglages.batiments) {
    style.sources.batiments = source_maplibre(batiments);
    style.layers.push({id: "batiments", type: "fill-extrusion", source: "batiments", "source-layer": batiments.couche, minzoom: 13, paint: {
      "fill-extrusion-color": "#34465a", "fill-extrusion-opacity": 0.85,
      "fill-extrusion-height": ["coalesce", ["get", batiments.hauteur], 6],
    }});
  }
  return style;
}

/** Rendre les bornes [[ouest, sud], [est, nord]] (degrés) du disque de `rayon` m autour de `origine`. */
export function bornes_disque(origine, rayon) {
  const points = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((azimut) => direct(origine, azimut, rayon));
  const lons = points.map((p) => vers_degres(p.lon));
  const lats = points.map((p) => vers_degres(p.lat));
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

