// Croisière à vitesse et altitude constantes le long d'une route (MODELE § 9.3).

export const meta = {
  role: "mouvement",
  nom: "Croisière géodésique",
  fidelite: "cinematique",
  description: "Le mobile avance horizontalement vers le prochain point de route, à altitude constante ; la direction est recalculée à chaque pas dans le plan tangent, ce qui suit la géodésique.",
  equations: ["Δφ = Δn / (M + h)", "Δλ = Δe / ((N + h) cos φ)"],
  hypotheses: ["Virages instantanés (rayon nul)", "Altitude constante", "Vitesse constante"],
  domaine_validite: "Pas de temps courts devant la durée du vol ; virages négligeables devant les distances (rayon de virage ≪ distances parcourues).",
  references: ["Égide, docs/MODELE.md § 9.3", "Rayons de courbure WGS84 : NIMA TR8350.2"],
  parametres: {},
};

/**
 * Rendre la position {geo, ecef} après `distance` m le long de `route` ([{geo, ecef}], ecef à l'altitude du mobile)
 * et le nombre de points de route atteints.
 */
export function avancer(mobile, route, distance, outils) {
  let {geo, ecef} = mobile;
  let reste = distance;
  let atteints = 0;
  while (reste > 0 && atteints < route.length) {
    const but = route[atteints];
    const {ecart, position} = outils.avancer_horizontalement(geo, ecef, but.ecef, reste);
    if (position) return {geo: position, ecef: outils.vers_ecef(position), atteints};
    geo = {lat: but.geo.lat, lon: but.geo.lon, alt: geo.alt};
    ecef = but.ecef;
    reste -= ecart;
    atteints++;
  }
  return {geo, ecef, atteints};
}
