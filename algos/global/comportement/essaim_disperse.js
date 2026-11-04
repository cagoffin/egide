// Essaim dispersé (MODELE § 8.2).

export const meta = {
  role: "comportement",
  nom: "Essaim dispersé",
  fidelite: "notionnel",
  description: "Chaque drone vient seul, d'un cap qui lui est propre, avec un départ tiré dans une fenêtre d'étalement.",
  equations: ["azimut ~ U(0, 2π)", "départ ~ U(0, étalement)"],
  hypotheses: ["Les drones ne se coordonnent pas", "Caps et départs indépendants"],
  domaine_validite: "Harcèlement diffus, recherche des trous de la défense.",
  references: ["Égide, docs/MODELE.md § 8.2"],
  parametres: {etalement: {unite: "s", aide: "Fenêtre des départs (scénario : rouge.etalement_s)."}},
};

/** Rendre le départ, la route et l'instant de départ d'un drone visant `cible`. */
export function planifier_drone(contexte, cible, hasard, outils) {
  const position = outils.direct(contexte.origine, hasard.uniforme(0, 2 * Math.PI), contexte.rayon_apparition);
  return {position, route: [contexte.cibles[cible]], depart: hasard.uniforme(0, contexte.rouge.etalement)};
}
