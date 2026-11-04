// Tir guidé laser semi-actif (MODELE § 4.2 et § 8.5).

export const meta = {
  role: "tir",
  nom: "Guidage laser semi-actif",
  fidelite: "notionnel",
  description: "Le tireur désigne la cible jusqu'à l'impact : il ne peut pas tirer de nouveau pendant la désignation.",
  equations: ["vol = occupation = durée de désignation"],
  hypotheses: ["Durée de désignation fixe, quelle que soit la distance", "Désignation jamais interrompue"],
  domaine_validite: "Tirs dans la portée utile ; météo claire (aucun effet de nébulosité modélisé).",
  references: ["Égide, docs/MODELE.md § 4.2", "Principe du guidage laser semi-actif : P. Zarchan, Tactical and Strategic Missile Guidance, AIAA"],
  parametres: {duree_designation: {unite: "s", aide: "Durée de désignation jusqu'à l'impact."}},
};

/** Rendre le temps de vol et le temps pendant lequel le tireur est occupé, en s. */
export function planifier_tir(arme) {
  return {vol: arme.duree_designation, occupation: arme.duree_designation};
}
