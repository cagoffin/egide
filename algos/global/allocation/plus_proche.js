// Allocation au plus proche : exemple d'algorithme simple, à comparer à l'allocation par densité (MODELE § 10).
// Il sert aussi de modèle à qui veut écrire le sien : fiche « meta », une fonction par rôle, rien d'importé.

export const meta = {
  role: "allocation",
  nom: "Piste la plus proche",
  fidelite: "notionnel",
  description: "Chaque avion libre est envoyé sur la position actuelle de la piste la plus proche de lui, sans extrapoler sa route ni tenir compte des autres avions.",
  equations: ["piste retenue = argmin distance(avion, piste)", "point = position actuelle de la piste, à l'altitude de l'avion"],
  hypotheses: ["Pas d'anticipation : l'avion vise où est la piste, pas où elle sera", "Plusieurs avions peuvent viser la même piste"],
  domaine_validite: "Référence pédagogique : pistes lentes ou proches ; à comparer en duel à l'allocation par densité.",
  references: ["Égide, docs/MODELE.md § 10", "Égide, docs/CATALOGUE.md (exemple d'algorithme)"],
  parametres: {
    vitesse_mise_a_poste: {unite: "m/s", aide: "Vitesse de ralliement de l'avion, pour le délai annoncé."},
    altitude: {unite: "m", aide: "Altitude du groupe : le point visé est pris à cette altitude."},
  },
};

/** Rendre, pour chaque avion libre, {avion, point, explication} : la position de la piste la plus proche, ou null. */
export function allouer(avions, pistes, outils) {
  return avions.map((avion) => {
    const classees = pistes
      .map((piste) => ({piste, distance: outils.distance_horizontale(avion.geo, piste.drone.geo)}))
      .sort((a, b) => a.distance - b.distance);
    const choix = classees[0];
    const explication = {
      pistes_connues: pistes.length, pistes_atteignables: pistes.length,
      retenue: choix && {effectif: choix.piste.effectif, delai: choix.distance / avion.groupe.vitesse_mise_a_poste, score: choix.piste.effectif, deja_affectes: 0},
      alternatives: classees.slice(1, 4).map(({piste, distance}) => ({effectif: piste.effectif, delai: distance / avion.groupe.vitesse_mise_a_poste, score: piste.effectif})),
    };
    if (!choix) return {avion, point: null, explication};
    return {avion, point: {...choix.piste.drone.geo, alt: avion.groupe.altitude}, explication};
  });
}
