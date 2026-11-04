// Cadence d'un poste sol réglée sur ses engagements par passage (MODELE § 5).

export const meta = {
  role: "tir_sol",
  nom: "Cadence par passage",
  fidelite: "notionnel",
  description: "Un drone traverse la bulle du poste en portée / vitesse secondes ; le poste doit y loger ses engagements par passage.",
  equations: ["cadence = (r_sol / v_drone) / engagements_par_passage"],
  hypotheses: ["Résultat du tir immédiat", "Tir sur le drone le plus proche dans la bulle"],
  domaine_validite: "Postes de courte portée face à des drones qui les survolent.",
  references: ["Égide, docs/MODELE.md § 5 et § 8.6"],
  parametres: {
    portee: {unite: "m", aide: "Rayon de la bulle."},
    engagements_par_passage: {unite: "", aide: "Tirs utiles pendant la traversée."},
  },
};

/** Rendre l'intervalle entre deux tirs du poste, en s, face à des cibles volant à `vitesseCible`. */
export function cadence(poste, vitesseCible) {
  return poste.portee / vitesseCible / poste.engagements_par_passage;
}
