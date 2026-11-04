// Radars placés un à un sur la carte : chacun voit à son horizon (MODELE § 15.1).

export const meta = {
  role: "detection",
  nom: "Radars placés",
  fidelite: "notionnel",
  description: "Chaque radar est un site placé sur la carte ; un drone est vu dès qu'il entre dans la portée d'au moins l'un d'eux (distance oblique).",
  equations: [
    "d = min(√(2 k R_T) (√h_r + √h_c), portée max), k = 4/3",
    "vu ⇔ ∃ site : ‖P_drone − P_site‖² ≤ d² + (h_c − h_r)²  (positions ECEF)",
  ],
  hypotheses: ["Radar parfait dans sa portée : ni fausse alarme, ni perte de piste", "Relief ignoré", "Atmosphère standard (k = 4/3)", "Détection partagée par toute la défense (réseau entièrement connecté)"],
  domaine_validite: "Ordres de grandeur de couverture à basse altitude, sites au niveau du sol.",
  references: ["Égide, docs/MODELE.md § 2 et § 15.1", "M. I. Skolnik, Introduction to Radar Systems, 3e éd., McGraw-Hill, 2001 — horizon radar"],
  parametres: {
    hauteur_antenne: {unite: "m", aide: "Hauteur des antennes."},
    portee_max: {unite: "m", aide: "Portée instrumentée."},
    sites: {unite: "", aide: "Positions des radars (scénario : bleu.radar.sites)."},
  },
};

/** Rendre l'état de la couverture : sites en ECEF, seuils de distance, et rayon au-delà duquel rien n'est vu. */
export function preparer(scenario, radar, outils) {
  const portee = Math.min(outils.horizon_radar(radar.hauteur_antenne, scenario.rouge.altitude), radar.portee_max);
  const sites = radar.sites.map((geo) => ({geo, ecef: outils.vers_ecef(geo), portee, seuil2: portee ** 2 + (scenario.rouge.altitude - geo.alt) ** 2}));
  const eloignement = sites.map((site) => outils.inverse(scenario.theatre.origine, site.geo).distance + portee);
  return {origine: scenario.theatre.origine, rayon_couverture: Math.max(scenario.theatre.zone_rayon, ...eloignement), sites};
}

/** Rendre vrai si `drone` est dans la portée d'au moins un site. */
export function detecte(etat, drone) {
  const {x, y, z} = drone.ecef;
  return etat.sites.some(({ecef, seuil2}) => (x - ecef.x) ** 2 + (y - ecef.y) ** 2 + (z - ecef.z) ** 2 <= seuil2);
}
