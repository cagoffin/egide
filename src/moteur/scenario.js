// Scénario v2 : lecture, validation, modification par chemin, résolution en unités SI (MODELE § 9.1).
// Un scénario v1 (clés plates, format absent) est migré automatiquement.
import {CatalogueInvalide, unite_si} from "./catalogue.js";
import {geo_deg} from "./geodesie.js";
import {AIDE} from "./scenario_aide.js";
import {convertir_objet} from "./unites.js";

export const FORMAT = 2;
export const TACTIQUES = ["direct", "disperse", "fourmi"];

export class ScenarioInvalide extends Error {}

const segments = (chemin) => chemin.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s));

/** Rendre la valeur au `chemin` pointé (« bleu.avions.1.nombre ») de `brut`, ou undefined. */
export const lire_chemin = (brut, chemin) => segments(chemin).reduce((noeud, s) => noeud?.[s], brut);

/** Rendre une copie de `brut` où chaque chemin de `modifications` ({chemin: valeur}) porte sa nouvelle valeur. */
export function modifier_scenario(brut, modifications) {
  const copie = structuredClone(brut);
  for (const [chemin, valeur] of Object.entries(modifications)) {
    const [dernier, ...parents] = segments(chemin).reverse();
    const noeud = parents.reverse().reduce((n, s) => (n[s] ??= {}), copie);
    noeud[dernier] = valeur;
  }
  return copie;
}

function valider_aide(objet, chemin) {
  const aide = objet._aide ?? {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (cle.startsWith("_") || cle === "surcharges" || cle === "surcharges_emport") continue;
    if (!(cle in aide)) throw new ScenarioInvalide(`${chemin}${cle} : aucune phrase dans _aide`);
    if (Array.isArray(valeur)) {
      valeur.forEach((element, i) => {
        const sansAide = Object.keys(element).filter((k) => !k.startsWith("_") && !(`${cle}[].${k}` in aide));
        if (sansAide.length) throw new ScenarioInvalide(`${chemin}${cle}.${i} : clés sans phrase dans _aide : ${sansAide.join(", ")}`);
      });
    } else if (valeur && typeof valeur === "object") {
      valider_aide(valeur, `${chemin}${cle}.`);
    }
  }
}

/** Rendre le scénario en format v2, migré s'il est en v1. */
export const en_v2 = (brut) => (brut.format === FORMAT ? brut : migrer_v1(brut));

/** Rendre la liste des identifiants d'unités qu'un scénario cite directement. */
export function ids_unites(brut) {
  const v2 = en_v2(brut);
  return [v2.rouge.unite, ...v2.bleu.avions.map((g) => g.unite), v2.bleu.sol.unite, v2.bleu.radar.unite];
}

function resoudre_avions(groupes, fichiers) {
  return groupes.map((groupe) => {
    const avion = unite_si(groupe.unite, fichiers, groupe.surcharges);
    const arme = unite_si(avion.emport, fichiers, groupe.surcharges_emport);
    if (!["laser", "ir"].includes(arme.guidage)) throw new ScenarioInvalide(`${arme.id} : guidage inconnu « ${arme.guidage} »`);
    return {...avion, nombre: groupe.nombre, altitude: groupe.altitude_m, arme};
  });
}

/**
 * Rendre le scénario résolu et figé, en unités SI, que consomme le moteur : chaque groupe porte les paramètres de
 * son unité (catalogue `fichiers`, voir charger_unites) et ses surcharges. Lève ScenarioInvalide sinon.
 */
export function resoudre_scenario(brutDonne, fichiers) {
  const brut = en_v2(brutDonne);
  valider_aide(brut, "");
  const {theatre, rouge, bleu, simulation} = brut;
  if (!TACTIQUES.includes(rouge.tactique)) throw new ScenarioInvalide(`tactique inconnue « ${rouge.tactique} » (${TACTIQUES.join(", ")})`);
  try {
    const drone = unite_si(rouge.unite, fichiers, rouge.surcharges);
    const {unite: _u, surcharges: _s, ...reglagesRouge} = rouge;
    return structuredClone({
      nom: brut.nom,
      theatre: {
        origine: geo_deg(theatre.origine_lat_deg, theatre.origine_lon_deg, 0),
        ...convertir_objet({zone_rayon_km: theatre.zone_rayon_km, cibles_nombre: theatre.cibles_nombre}),
      },
      rouge: {...drone, altitude: drone.altitude_croisiere, ...convertir_objet(reglagesRouge)},
      avions: resoudre_avions(bleu.avions, fichiers),
      sol: {...unite_si(bleu.sol.unite, fichiers, bleu.sol.surcharges), nombre: bleu.sol.nombre, munitions: bleu.sol.munitions},
      radar: unite_si(bleu.radar.unite, fichiers, bleu.radar.surcharges),
      conduite: convertir_objet(bleu.conduite),
      simulation: convertir_objet(simulation),
    });
  } catch (erreur) {
    if (erreur instanceof CatalogueInvalide) throw new ScenarioInvalide(erreur.message);
    throw erreur;
  }
}

const UNITES_V1 = {
  drone: "vecteurs/drones/drone_reaction_notionnel",
  avion_ir: "vecteurs/avions/turbopropulseur_ir_notionnel",
  avion_laser: "vecteurs/avions/turbopropulseur_laser_notionnel",
  poste: "sites/postes/poste_sol_air_notionnel",
  radar: "capteurs/radars/radar_basse_altitude_notionnel",
};
// La v1 n'avait ni géographie ni altitude d'avion : centre de la France métropolitaine, avions à 1 000 m.
const ORIGINE_V1 = {lat: 47, lon: 2.5};
const ALTITUDE_AVIONS_V1 = 1000;

function groupe_v1(v1, unite, nombre) {
  return {
    unite,
    nombre,
    altitude_m: ALTITUDE_AVIONS_V1,
    surcharges: {
      vitesse_mise_a_poste_kmh: v1.avions_vitesse_kmh,
      vitesse_engagement_kmh: v1.avions_vitesse_engagement_kmh,
      facteur_charge_max_g: v1.avions_facteur_charge_max,
      emport_nombre: v1.avions_roquettes_par_avion,
    },
    surcharges_emport: {
      portee_km: v1.roquette_air_portee_km,
      pk: v1.roquette_air_pk,
      duree_designation_s: v1.laser_duree_designation_s,
      cadence_s: v1.ir_cadence_s,
    },
  };
}

/** Rendre le scénario v2 équivalent à un scénario v1 (clés plates de la v0.1), toutes valeurs reportées en surcharges. */
export function migrer_v1(v1) {
  const avions = [
    groupe_v1(v1, UNITES_V1.avion_ir, v1.avions_ir_nombre),
    groupe_v1(v1, UNITES_V1.avion_laser, v1.avions_nombre - v1.avions_ir_nombre),
  ];
  return {
    _aide: AIDE.racine,
    format: FORMAT,
    nom: "Scénario migré depuis le format v1",
    theatre: {_aide: AIDE.theatre, origine_lat_deg: ORIGINE_V1.lat, origine_lon_deg: ORIGINE_V1.lon, zone_rayon_km: v1.zone_rayon_km, cibles_nombre: v1.cibles_nombre},
    rouge: {
      _aide: AIDE.rouge, unite: UNITES_V1.drone, nombre: v1.drones_nombre, tactique: v1.drones_tactique,
      concentration_max: v1.drones_concentration_max, etalement_s: v1.drones_etalement_s,
      fourmi_eclatement_rayon_km: v1.fourmi_eclatement_rayon_km, fourmi_largeur_couloir_km: v1.fourmi_largeur_couloir_km,
      surcharges: {vitesse_kmh: v1.drones_vitesse_kmh, altitude_croisiere_m: v1.drones_altitude_m},
    },
    bleu: {
      _aide: AIDE.bleu,
      avions,
      sol: {_aide: AIDE.sol, unite: UNITES_V1.poste, nombre: v1.sol_postes_nombre, munitions: v1.sol_roquettes_nombre + v1.sol_missiles_nombre,
        surcharges: {portee_km: v1.sol_portee_km, pk: v1.sol_pk, engagements_par_passage: v1.sol_engagements_par_passage}},
      radar: {_aide: AIDE.radar, unite: UNITES_V1.radar, surcharges: {hauteur_antenne_m: v1.radar_hauteur_antenne_m, portee_max_km: v1.radar_portee_max_km}},
      conduite: {_aide: AIDE.conduite, delai_reaction_s: v1.delai_reaction_s, pas_decision_s: v1.avions_pas_decision_s, interception_profondeur_km: v1.interception_profondeur_km},
    },
    simulation: {_aide: AIDE.simulation, pas_s: v1.simulation_pas_s, graine: v1.graine},
  };
}
