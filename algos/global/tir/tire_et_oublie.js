// Tir « tire et oublie » : autodirecteur autonome (MODELE § 4.2 et § 8.5).

export const meta = {
  role: "tir",
  nom: "Tire et oublie",
  fidelite: "notionnel",
  description: "L'arme se guide seule après le départ : le tireur peut tirer de nouveau après sa cadence, et le temps de vol vaut la distance sur la vitesse moyenne.",
  equations: ["vol = distance / vitesse moyenne", "occupation = cadence"],
  hypotheses: ["Vitesse moyenne constante", "Accrochage acquis au départ"],
  domaine_validite: "Autodirecteurs IR ou radar actif dans leur portée utile.",
  references: ["Égide, docs/MODELE.md § 4.2", "P. Zarchan, Tactical and Strategic Missile Guidance, AIAA"],
  parametres: {
    vitesse: {unite: "m/s", aide: "Vitesse moyenne de l'arme."},
    cadence: {unite: "s", aide: "Intervalle minimal entre deux tirs."},
  },
};

/** Rendre le temps de vol et le temps pendant lequel le tireur est occupé, en s. */
export function planifier_tir(arme, distance) {
  return {vol: distance / arme.vitesse, occupation: arme.cadence};
}
