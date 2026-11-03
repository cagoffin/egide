// Lecture d'un scénario (scenarios/*.json déjà analysé) et conversion en unités SI. Jumeau de analyse/scenario.py.
import {km_vers_m, kmh_vers_ms} from "./unites.js";

/** Clés du scénario en SI, après retrait du suffixe d'unité. Un scénario doit les porter toutes, et seulement elles. */
export const CLES = [
  "zone_rayon", "cibles_nombre", "drones_nombre", "drones_vitesse", "drones_tactique", "drones_concentration_max",
  "drones_etalement", "fourmi_eclatement_rayon", "fourmi_largeur_couloir", "drones_altitude", "radar_hauteur_antenne",
  "radar_portee_max", "delai_reaction", "interception_profondeur", "avions_nombre", "avions_ir_nombre",
  "avions_vitesse", "avions_vitesse_engagement", "avions_facteur_charge_max", "avions_roquettes_par_avion",
  "avions_pas_decision", "roquette_air_portee", "roquette_air_pk", "laser_duree_designation", "ir_cadence",
  "sol_roquettes_nombre", "sol_missiles_nombre", "sol_postes_nombre", "sol_portee", "sol_pk",
  "sol_engagements_par_passage", "simulation_pas", "graine",
];

const CONVERSIONS = [["_kmh", kmh_vers_ms], ["_km", km_vers_m], ["_m", Number], ["_s", Number]];

export class ScenarioInvalide extends Error {}

function convertir(cle, valeur) {
  for (const [suffixe, conversion] of CONVERSIONS) {
    if (cle.endsWith(suffixe)) return [cle.slice(0, -suffixe.length), conversion(valeur)];
  }
  return [cle, valeur];
}

/**
 * Rendre le scénario `brut` (objet JSON, unités d'affichage) converti en SI et figé.
 * Lève ScenarioInvalide si une clé manque, est en trop, ou n'a pas sa phrase dans `_aide`.
 */
export function lire_scenario(brut) {
  const valeurs = Object.entries(brut).filter(([cle]) => !cle.startsWith("_"));
  const sansAide = valeurs.map(([cle]) => cle).filter((cle) => !(cle in (brut._aide ?? {})));
  if (sansAide.length) throw new ScenarioInvalide(`clés sans phrase dans _aide : ${sansAide.join(", ")}`);
  const convertis = Object.fromEntries(valeurs.map(([cle, valeur]) => convertir(cle, valeur)));
  const manquantes = CLES.filter((cle) => !(cle in convertis));
  const enTrop = Object.keys(convertis).filter((cle) => !CLES.includes(cle));
  if (manquantes.length || enTrop.length) {
    throw new ScenarioInvalide(`clés manquantes [${manquantes.join(", ")}], en trop [${enTrop.join(", ")}]`);
  }
  return Object.freeze(convertis);
}

/** Rendre une copie de `brut` où les clés de `modifications` (unités d'affichage) sont remplacées. */
export const modifier_scenario = (brut, modifications) => ({...brut, ...modifications});
