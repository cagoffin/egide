// Essaim « fourmi » : couloir compact puis éclatement (MODELE § 8.2).

export const meta = {
  role: "comportement",
  nom: "Essaim fourmi (couloir puis éclatement)",
  fidelite: "notionnel",
  description: "Tout l'essaim entre par un même couloir étroit, en colonne, jusqu'à un point d'éclatement d'où chaque drone rejoint sa cible.",
  equations: ["entrée = rayon_apparition + U(0, 4 km) sur le cap commun", "éclatement à fourmi_eclatement_rayon du centre, même décalage latéral"],
  hypotheses: ["Cap commun tiré uniformément", "Colonne de 4 km de profondeur", "Pas de réaction à la défense"],
  domaine_validite: "Saturation d'un secteur puis dispersion tardive, pour masquer le nombre et les cibles.",
  references: ["Égide, docs/MODELE.md § 8.2"],
  parametres: {
    fourmi_largeur_couloir: {unite: "m", aide: "Largeur du couloir (rouge.fourmi_largeur_couloir_km)."},
    fourmi_eclatement_rayon: {unite: "m", aide: "Distance au centre du point d'éclatement (rouge.fourmi_eclatement_rayon_km)."},
  },
};

// Profondeur de la colonne : l'essaim compact s'étire sur quelques km le long du couloir.
const PROFONDEUR_COLONNE = 4_000;

/** Rendre le départ, la route (éclatement puis cible) et l'instant de départ d'un drone visant `cible`. */
export function planifier_drone(contexte, cible, hasard, outils) {
  const {rouge, cap_commun: azimut, origine} = contexte;
  const decalage = hasard.uniforme(-rouge.fourmi_largeur_couloir / 2, rouge.fourmi_largeur_couloir / 2);
  const entree = contexte.rayon_apparition + hasard.uniforme(0, PROFONDEUR_COLONNE);
  const eclatement = outils.point_radial(origine, azimut, rouge.fourmi_eclatement_rayon, decalage);
  return {
    position: outils.point_radial(origine, azimut, entree, decalage),
    route: [eclatement, contexte.cibles[cible]],
    depart: 0,
  };
}
