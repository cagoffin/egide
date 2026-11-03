// Curseurs du scénario : un par clé réglable, groupés par couche, chacun portant la phrase d'aide du scénario.
import {format_decimal} from "./format.js";

export const REGLAGES = [
  {section: "Menace", cle: "drones_nombre", libelle: "Drones", min: 50, max: 2000, pas: 50},
  {section: "Menace", cle: "drones_vitesse_kmh", libelle: "Vitesse des drones", min: 300, max: 1200, pas: 10},
  {section: "Menace", cle: "drones_concentration_max", libelle: "Drones au plus par cible", min: 20, max: 1000, pas: 10},
  {section: "Menace", cle: "cibles_nombre", libelle: "Cibles", min: 1, max: 20, pas: 1},
  {section: "Menace", cle: "fourmi_eclatement_rayon_km", libelle: "Éclatement (fourmi), du centre", min: 0, max: 150, pas: 5},
  {section: "Menace", cle: "fourmi_largeur_couloir_km", libelle: "Largeur du couloir (fourmi)", min: 1, max: 30, pas: 1},
  {section: "Menace", cle: "drones_etalement_s", libelle: "Étalement des départs (dispersé)", min: 0, max: 600, pas: 10},
  {section: "Avions", cle: "avions_nombre", libelle: "Avions en orbite", min: 0, max: 150, pas: 1},
  {section: "Avions", cle: "avions_ir_nombre", libelle: "Dont guidage IR", min: 0, max: 150, pas: 1},
  {section: "Avions", cle: "avions_vitesse_kmh", libelle: "Vitesse de mise à poste", min: 300, max: 800, pas: 10},
  {section: "Avions", cle: "avions_vitesse_engagement_kmh", libelle: "Vitesse d'engagement", min: 200, max: 600, pas: 10},
  {section: "Avions", cle: "avions_roquettes_par_avion", libelle: "Roquettes par avion", min: 2, max: 24, pas: 1},
  {section: "Avions", cle: "roquette_air_portee_km", libelle: "Portée des roquettes", min: 2, max: 15, pas: 0.5},
  {section: "Avions", cle: "roquette_air_pk", libelle: "Pk par tir air", min: 0.1, max: 1, pas: 0.05},
  {section: "Avions", cle: "laser_duree_designation_s", libelle: "Désignation laser", min: 2, max: 20, pas: 1},
  {section: "Avions", cle: "ir_cadence_s", libelle: "Cadence IR", min: 1, max: 10, pas: 0.5},
  {section: "Sol", cle: "sol_postes_nombre", libelle: "Postes sol-air", min: 0, max: 600, pas: 10},
  {section: "Sol", cle: "sol_roquettes_nombre", libelle: "Roquettes sol", min: 0, max: 5000, pas: 50},
  {section: "Sol", cle: "sol_portee_km", libelle: "Rayon de la bulle", min: 2, max: 20, pas: 0.5},
  {section: "Sol", cle: "sol_pk", libelle: "Pk par tir sol", min: 0.1, max: 1, pas: 0.05},
  {section: "Sol", cle: "sol_engagements_par_passage", libelle: "Tirs par passage", min: 1, max: 20, pas: 1},
  {section: "Détection et conduite", cle: "zone_rayon_km", libelle: "Rayon de la zone", min: 50, max: 300, pas: 10},
  {section: "Détection et conduite", cle: "drones_altitude_m", libelle: "Altitude des drones", min: 20, max: 1000, pas: 10},
  {section: "Détection et conduite", cle: "radar_hauteur_antenne_m", libelle: "Hauteur des antennes", min: 5, max: 100, pas: 5},
  {section: "Détection et conduite", cle: "delai_reaction_s", libelle: "Délai de réaction", min: 0, max: 300, pas: 10},
  {section: "Détection et conduite", cle: "avions_pas_decision_s", libelle: "Replanification", min: 1, max: 30, pas: 1},
];

const UNITES = [["_kmh", "km/h"], ["_km", "km"], ["_m", "m"], ["_s", "s"]];

/** Rendre l'unité d'affichage d'une clé de scénario, lue dans son suffixe (« » si sans unité). */
export const unite = (cle) => UNITES.find(([suffixe]) => cle.endsWith(suffixe))?.[1] ?? "";

const afficher = (cle, valeur) => `${format_decimal(valeur)}${unite(cle) ? ` ${unite(cle)}` : ""}`;

function creer_curseur(reglage, brut, surChangement) {
  const etiquette = document.createElement("label");
  etiquette.className = "reglage";
  etiquette.title = brut._aide?.[reglage.cle] ?? "";
  etiquette.innerHTML = `<span class="libelle">${reglage.libelle}</span><output></output>`;
  const curseur = document.createElement("input");
  Object.assign(curseur, {type: "range", min: reglage.min, max: reglage.max, step: reglage.pas, name: reglage.cle});
  const sortie = etiquette.querySelector("output");
  curseur.addEventListener("input", () => {
    sortie.textContent = afficher(reglage.cle, Number(curseur.value));
    surChangement({[reglage.cle]: Number(curseur.value)});
  });
  etiquette.append(curseur);
  return {etiquette, curseur, sortie};
}

/**
 * Construire les curseurs dans `conteneur` ; `surChangement(modification)` reçoit chaque geste.
 * Rend une fonction `afficher_valeurs(brut)` qui replace les curseurs sur un scénario (préréglage chargé).
 */
export function construire_reglages(conteneur, brut, surChangement) {
  const curseurs = [];
  for (const section of new Set(REGLAGES.map((r) => r.section))) {
    const groupe = document.createElement("details");
    groupe.open = section !== "Détection et conduite";
    groupe.innerHTML = `<summary>${section}</summary>`;
    for (const reglage of REGLAGES.filter((r) => r.section === section)) {
      const curseur = creer_curseur(reglage, brut, surChangement);
      curseurs.push({reglage, ...curseur});
      groupe.append(curseur.etiquette);
    }
    conteneur.append(groupe);
  }
  const afficher_valeurs = (scenario) => {
    for (const {reglage, curseur, sortie} of curseurs) {
      curseur.value = scenario[reglage.cle];
      sortie.textContent = afficher(reglage.cle, scenario[reglage.cle]);
    }
  };
  afficher_valeurs(brut);
  return afficher_valeurs;
}
