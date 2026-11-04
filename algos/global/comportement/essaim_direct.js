// Essaim en groupes directs (MODELE § 8.2). Aucun import : géodésie et hasard arrivent en arguments.

export const meta = {
  role: "comportement",
  nom: "Essaim en groupes directs",
  fidelite: "notionnel",
  description: "Chaque groupe arrive d'un cap tiré au hasard, en vague serrée, et vole droit sur sa cible.",
  equations: ["départ = point à rayon_apparition dans l'azimut du groupe, décalé latéralement de U(−1 km, 1 km)"],
  hypotheses: ["Le groupe ne réagit pas à la défense", "Un cap par groupe, tiré uniformément sur 360°"],
  domaine_validite: "Raids saturants sans coordination entre groupes.",
  references: ["Égide, docs/MODELE.md § 8.2"],
  parametres: {},
};

// Dispersion latérale du groupe : quelques km, pour une vague serrée.
const DISPERSION_GROUPE = 2_000;

/** Rendre le départ, la route et l'instant de départ d'un drone visant `cible`. */
export function planifier_drone(contexte, cible, hasard, outils) {
  const decalage = hasard.uniforme(-DISPERSION_GROUPE / 2, DISPERSION_GROUPE / 2);
  const position = outils.point_radial(contexte.origine, contexte.caps[cible], contexte.rayon_apparition, decalage);
  return {position, route: [contexte.cibles[cible]], depart: 0};
}
