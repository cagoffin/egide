// Curseurs du scénario : un par réglage, groupés par couche. Un réglage agit sur un ou plusieurs chemins du scénario
// (« Vitesse de mise à poste » règle les deux groupes d'avions) ; son aide vient du scénario ou du fichier d'unité.
import {libelle_unite} from "../moteur/unites.js";
import {format_decimal} from "./format.js";

const DEUX_GROUPES = (fin) => [`bleu.avions.0.${fin}`, `bleu.avions.1.${fin}`];

export const REGLAGES = [
  {section: "Menace", id: "drones", chemins: ["rouge.nombre"], libelle: "Drones", min: 50, max: 2000, pas: 50},
  {section: "Menace", id: "vitesse_drones", chemins: ["rouge.surcharges.vitesse_kmh"], libelle: "Vitesse des drones", min: 150, max: 1200, pas: 10},
  {section: "Menace", id: "altitude_drones", chemins: ["rouge.surcharges.altitude_croisiere_m"], libelle: "Altitude des drones", min: 20, max: 1000, pas: 10},
  {section: "Menace", id: "concentration", chemins: ["rouge.concentration_max"], libelle: "Drones au plus par cible", min: 20, max: 1000, pas: 10},
  {section: "Menace", id: "cibles", chemins: ["theatre.cibles_nombre"], libelle: "Cibles", min: 1, max: 20, pas: 1},
  {section: "Menace", id: "eclatement", chemins: ["rouge.fourmi_eclatement_rayon_km"], libelle: "Éclatement (fourmi), du centre", min: 0, max: 150, pas: 5},
  {section: "Menace", id: "couloir", chemins: ["rouge.fourmi_largeur_couloir_km"], libelle: "Largeur du couloir (fourmi)", min: 1, max: 30, pas: 1},
  {section: "Menace", id: "etalement", chemins: ["rouge.etalement_s"], libelle: "Étalement des départs (dispersé)", min: 0, max: 600, pas: 10},
  {section: "Avions", id: "avions_ir", chemins: ["bleu.avions.0.nombre"], libelle: "Avions IR", min: 0, max: 150, pas: 1},
  {section: "Avions", id: "avions_laser", chemins: ["bleu.avions.1.nombre"], libelle: "Avions laser", min: 0, max: 150, pas: 1},
  {section: "Avions", id: "altitude_avions", chemins: DEUX_GROUPES("altitude_m"), libelle: "Altitude des avions", min: 100, max: 6000, pas: 100},
  {section: "Avions", id: "vitesse_mise_a_poste", chemins: DEUX_GROUPES("surcharges.vitesse_mise_a_poste_kmh"), libelle: "Vitesse de mise à poste", min: 300, max: 800, pas: 10},
  {section: "Avions", id: "vitesse_engagement", chemins: DEUX_GROUPES("surcharges.vitesse_engagement_kmh"), libelle: "Vitesse d'engagement", min: 200, max: 600, pas: 10},
  {section: "Avions", id: "emport", chemins: DEUX_GROUPES("surcharges.emport_nombre"), libelle: "Roquettes par avion", min: 2, max: 24, pas: 1},
  {section: "Avions", id: "portee_air", chemins: DEUX_GROUPES("surcharges_emport.portee_km"), libelle: "Portée des roquettes", min: 2, max: 15, pas: 0.5},
  {section: "Avions", id: "pk_air", chemins: DEUX_GROUPES("surcharges_emport.pk"), libelle: "Pk par tir air", min: 0.1, max: 1, pas: 0.05},
  {section: "Avions", id: "designation", chemins: ["bleu.avions.1.surcharges_emport.duree_designation_s"], libelle: "Désignation laser", min: 2, max: 20, pas: 1},
  {section: "Avions", id: "cadence_ir", chemins: ["bleu.avions.0.surcharges_emport.cadence_s"], libelle: "Cadence IR", min: 1, max: 10, pas: 0.5},
  {section: "Sol", id: "postes", chemins: ["bleu.sol.nombre"], libelle: "Postes sol-air", min: 0, max: 600, pas: 10},
  {section: "Sol", id: "munitions_sol", chemins: ["bleu.sol.munitions"], libelle: "Munitions sol", min: 0, max: 5000, pas: 50},
  {section: "Sol", id: "portee_sol", chemins: ["bleu.sol.surcharges.portee_km"], libelle: "Rayon de la bulle", min: 2, max: 20, pas: 0.5},
  {section: "Sol", id: "pk_sol", chemins: ["bleu.sol.surcharges.pk"], libelle: "Pk par tir sol", min: 0.1, max: 1, pas: 0.05},
  {section: "Sol", id: "engagements", chemins: ["bleu.sol.surcharges.engagements_par_passage"], libelle: "Tirs par passage", min: 1, max: 20, pas: 1},
  {section: "Théâtre et conduite", id: "latitude", chemins: ["theatre.origine_lat_deg"], libelle: "Latitude du centre", min: -80, max: 80, pas: 0.5},
  {section: "Théâtre et conduite", id: "longitude", chemins: ["theatre.origine_lon_deg"], libelle: "Longitude du centre", min: -180, max: 180, pas: 0.5},
  {section: "Théâtre et conduite", id: "zone", chemins: ["theatre.zone_rayon_km"], libelle: "Rayon de la zone", min: 50, max: 300, pas: 10},
  {section: "Théâtre et conduite", id: "antennes", chemins: ["bleu.radar.surcharges.hauteur_antenne_m"], libelle: "Hauteur des antennes", min: 5, max: 100, pas: 5},
  {section: "Théâtre et conduite", id: "reaction", chemins: ["bleu.conduite.delai_reaction_s"], libelle: "Délai de réaction", min: 0, max: 300, pas: 10},
  {section: "Théâtre et conduite", id: "replanification", chemins: ["bleu.conduite.pas_decision_s"], libelle: "Replanification", min: 1, max: 30, pas: 1},
];

/** Rendre l'unité d'affichage d'un réglage, lue dans le suffixe de son premier chemin. */
export const unite_reglage = (reglage) => libelle_unite(reglage.chemins[0]);

const afficher = (reglage, valeur) => `${format_decimal(valeur)}${unite_reglage(reglage) ? ` ${unite_reglage(reglage)}` : ""}`;

function creer_curseur(reglage, surChangement) {
  const etiquette = document.createElement("label");
  etiquette.className = "reglage";
  etiquette.innerHTML = `<span class="libelle">${reglage.libelle}</span><output></output>`;
  const curseur = document.createElement("input");
  Object.assign(curseur, {type: "range", min: reglage.min, max: reglage.max, step: reglage.pas, name: reglage.id});
  const sortie = etiquette.querySelector("output");
  curseur.addEventListener("input", () => {
    const valeur = Number(curseur.value);
    sortie.textContent = afficher(reglage, valeur);
    surChangement(Object.fromEntries(reglage.chemins.map((chemin) => [chemin, valeur])));
  });
  etiquette.append(curseur);
  return {etiquette, curseur, sortie};
}

/**
 * Construire les curseurs dans `conteneur` ; `surChangement(modifications)` reçoit chaque geste ({chemin: valeur}).
 * Rend `afficher_valeurs(contexte)` qui replace les curseurs, `contexte` : {valeur(chemin), aide(chemin)}.
 */
export function construire_reglages(conteneur, surChangement) {
  const curseurs = [];
  for (const section of new Set(REGLAGES.map((r) => r.section))) {
    const groupe = document.createElement("details");
    groupe.open = section !== "Théâtre et conduite";
    groupe.innerHTML = `<summary>${section}</summary>`;
    for (const reglage of REGLAGES.filter((r) => r.section === section)) {
      const curseur = creer_curseur(reglage, surChangement);
      curseurs.push({reglage, ...curseur});
      groupe.append(curseur.etiquette);
    }
    conteneur.append(groupe);
  }
  return (contexte) => {
    for (const {reglage, curseur, sortie, etiquette} of curseurs) {
      const valeur = contexte.valeur(reglage.chemins[0]);
      curseur.value = valeur;
      sortie.textContent = afficher(reglage, valeur);
      etiquette.title = contexte.aide(reglage.chemins[0]);
    }
  };
}
