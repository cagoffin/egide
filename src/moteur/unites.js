// Conversions entre unités d'affichage et unités SI du moteur. Jumeau de analyse/unites.py.
// Le suffixe d'une clé de fichier dit son unité ; la clé SI est la même, sans le suffixe.

export const kmh_vers_ms = (vitesseKmh) => (vitesseKmh * 1000) / 3600;
export const ms_vers_kmh = (vitesseMs) => (vitesseMs * 3600) / 1000;
export const km_vers_m = (distanceKm) => distanceKm * 1000;
export const m_vers_km = (distanceM) => distanceM / 1000;

// L'ordre compte : « _kmh » doit être essayé avant « _km » et « _m », « _ms » avant « _s ».
const SUFFIXES = [
  ["_kmh", kmh_vers_ms],
  ["_km", km_vers_m],
  ["_ms", Number],
  ["_m", Number],
  ["_s", Number],
  ["_g", Number],
  ["_deg", (degres) => (degres * Math.PI) / 180],
];

/** Rendre [clé SI, valeur SI] pour une clé de fichier et sa valeur ; une clé sans suffixe connu est rendue telle quelle. */
export function convertir_cle(cle, valeur) {
  for (const [suffixe, conversion] of SUFFIXES) {
    if (cle.endsWith(suffixe)) return [cle.slice(0, -suffixe.length), conversion(valeur)];
  }
  return [cle, valeur];
}

/** Rendre le libellé d'unité d'affichage d'une clé de fichier (« km/h », « km »…), vide si sans unité. */
export function libelle_unite(cle) {
  const libelles = {_kmh: "km/h", _km: "km", _ms: "m/s", _m: "m", _s: "s", _g: "g", _deg: "°"};
  return Object.entries(libelles).find(([suffixe]) => cle.endsWith(suffixe))?.[1] ?? "";
}

/** Rendre une copie de l'objet plat `objet` en unités SI, sans ses clés de documentation (préfixe « _ »). */
export function convertir_objet(objet) {
  return Object.fromEntries(
    Object.entries(objet).filter(([cle]) => !cle.startsWith("_")).map(([cle, valeur]) => convertir_cle(cle, valeur)),
  );
}
