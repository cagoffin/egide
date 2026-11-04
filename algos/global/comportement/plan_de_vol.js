// Essaim suivant un plan de vol dessiné dans l'éditeur, puis éclatement vers les cibles (MODELE § 12).

export const meta = {
  role: "comportement",
  nom: "Plan de vol",
  fidelite: "notionnel",
  description: "Tout l'essaim suit les points de passage dessinés, en colonne d'une largeur donnée ; après le dernier point, chaque drone rejoint sa cible.",
  equations: ["départ = premier point, reculé de U(0, 4 km) le long du premier tronçon et décalé de U(−l/2, l/2)", "chaque point suivant garde le même décalage latéral, mesuré perpendiculairement au tronçon qui y mène"],
  hypotheses: ["Un seul plan pour tout l'essaim", "Pas de réaction à la défense", "Départs simultanés"],
  domaine_validite: "Raids dont l'itinéraire est imposé par l'utilisateur ; sans plan, l'essaim part du centre de la zone.",
  references: ["Égide, docs/MODELE.md § 12"],
  parametres: {
    plan_de_vol: {unite: "rad", aide: "Points de passage (rouge.plan_de_vol)."},
    fourmi_largeur_couloir: {unite: "m", aide: "Largeur de la colonne (rouge.fourmi_largeur_couloir_km)."},
  },
};

// Profondeur de la colonne : l'essaim s'étire sur quelques km derrière le premier point.
const PROFONDEUR_COLONNE = 4_000;

/** Rendre le départ, la route (points de passage décalés, puis cible) et l'instant de départ d'un drone. */
export function planifier_drone(contexte, cible, hasard, outils) {
  const {rouge, cibles, origine} = contexte;
  const plan = rouge.plan_de_vol.length ? rouge.plan_de_vol : [origine];
  const decalage = hasard.uniforme(-rouge.fourmi_largeur_couloir / 2, rouge.fourmi_largeur_couloir / 2);
  const recul = hasard.uniforme(0, PROFONDEUR_COLONNE);
  const suivant = plan[1] ?? cibles[cible];
  const premierCap = outils.inverse(plan[0], suivant).azimut_depart;
  const position = outils.decaler_lateralement(outils.direct(plan[0], premierCap + Math.PI, recul), premierCap, decalage);
  const passages = plan.slice(1).map((point, i) => outils.decaler_lateralement(point, outils.inverse(plan[i], point).azimut_arrivee, decalage));
  return {position, route: [...passages, cibles[cible]], depart: 0};
}
