// Radars : disposition le long de la frontière ou sites placés (MODELE § 15.1).
import {direct} from "./geodesie.js";
import {horizon_radar} from "./geometrie.js";

/** Rendre la portée au sol d'un radar contre l'essaim : horizon radar borné par la portée instrumentée. */
export const portee_radar = (scenario) => Math.min(horizon_radar(scenario.radar.hauteur_antenne, scenario.rouge.altitude), scenario.radar.portee_max);

/**
 * Rendre les positions des radars qui matérialisent la couverture « frontière » : sur le cercle de la zone, espacés
 * de √3 d au plus, si bien que tout drone qui franchit la frontière passe à moins de d de l'un d'eux. Ce sont ces
 * positions que l'éditeur rend déplaçables ; en déplacer un fait passer le scénario en disposition « sites ».
 */
export function sites_frontiere(scenario) {
  const rayon = scenario.theatre.zone_rayon;
  const nombre = Math.max(3, Math.ceil((2 * Math.PI * rayon) / (Math.sqrt(3) * portee_radar(scenario))));
  return Array.from({length: nombre}, (_, i) => ({...direct(scenario.theatre.origine, (2 * Math.PI * i) / nombre, rayon), alt: scenario.radar.hauteur_antenne}));
}

const memoire = new WeakMap();

/** Rendre les positions des radars du scénario résolu, quelle que soit la disposition (calculées une fois par scénario). */
export function positions_radars(scenario) {
  if (!memoire.has(scenario)) memoire.set(scenario, scenario.radar.disposition === "sites" ? scenario.radar.sites : sites_frontiere(scenario));
  return memoire.get(scenario);
}
