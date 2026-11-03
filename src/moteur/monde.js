// La simulation : état du monde, boucle à pas fixe, bilan (MODELE § 8). Pur : ni DOM, ni réseau, ni horloge.
import {avancer_avions, creer_avions, planifier_avions, resoudre_tirs_en_vol, tirer_air} from "./defense_air.js";
import {creer_postes, tirer_sol} from "./defense_sol.js";
import {horizon_radar} from "./geometrie.js";
import {indexer_drones} from "./grille.js";
import {creer_hasard} from "./hasard.js";
import {avancer_drones, creer_drones, detecter_drones} from "./menace.js";
import {distance, point_polaire} from "./vecteurs.js";

// Les drones naissent 20 km avant la couverture radar : ils ne sont pas vus dès leur apparition.
const MARGE_APPARITION = 20_000;
// Garde-fou : un raid dure quelques minutes ; au-delà de 2 h, la simulation boucle sur un défaut.
const DUREE_MAXIMALE = 7_200;
const ESSAIS_PLACEMENT = 10_000;

/** Rendre les positions des cibles, tirées dans 70 % du rayon et espacées d'au moins un cinquième du rayon. */
export function placer_cibles(scenario, hasard) {
  const cibles = [];
  let ecartMinimal = scenario.zone_rayon / 5;
  for (let essai = 0; cibles.length < scenario.cibles_nombre; essai++) {
    // Zone trop petite pour l'écart demandé : on le réduit plutôt que de boucler sans fin.
    if (essai > 0 && essai % ESSAIS_PLACEMENT === 0) ecartMinimal /= 2;
    const candidate = point_polaire(0.7 * scenario.zone_rayon * Math.sqrt(hasard.uniforme()), hasard.uniforme(0, 2 * Math.PI));
    if (cibles.every((cible) => distance(cible, candidate) >= ecartMinimal)) cibles.push(candidate);
  }
  return cibles;
}

/** Rendre un monde neuf. `journal` : tenir la liste des évènements (rejeu), inutile en campagne. */
export function creer_monde(scenario, {journal = true} = {}) {
  const hasard = creer_hasard(scenario.graine);
  const cibles = placer_cibles(scenario, hasard);
  const detection = Math.min(horizon_radar(scenario.radar_hauteur_antenne, scenario.drones_altitude), scenario.radar_portee_max);
  const rayonDetection = scenario.zone_rayon + detection;
  return {
    scenario, hasard, t: 0, cibles, rayonDetection,
    drones: creer_drones(scenario, cibles, hasard, rayonDetection + MARGE_APPARITION),
    avions: creer_avions(scenario, hasard),
    postes: creer_postes(scenario, cibles),
    tirs_en_vol: [],
    fuites: cibles.map(() => 0),
    compteurs: {tirs_air: 0, tirs_sol: 0, detruits_air: 0, detruits_sol: 0},
    evenements: journal ? [] : null,
    prochaine_decision: 0,
    index: new Map(),
  };
}

/** Faire avancer le monde d'un pas de temps. L'ordre compte : on bouge, on voit, on décide, on tire. */
export function avancer_monde(monde) {
  const {scenario} = monde;
  monde.t += scenario.simulation_pas;
  avancer_drones(monde, scenario.simulation_pas);
  monde.index = indexer_drones(monde.drones, monde.t);
  detecter_drones(monde);
  if (monde.t >= monde.prochaine_decision) {
    planifier_avions(monde);
    monde.prochaine_decision = monde.t + scenario.avions_pas_decision;
  }
  avancer_avions(monde, scenario.simulation_pas);
  resoudre_tirs_en_vol(monde);
  tirer_sol(monde);
  tirer_air(monde);
}

/** Rendre vrai quand plus aucun drone ne vole et qu'aucun tir n'est en vol. */
export const est_termine = (monde) => monde.tirs_en_vol.length === 0 && monde.drones.every((drone) => !drone.vivant || drone.arrive);

/** Rendre le monde au terme du raid. */
export function simuler(scenario, options) {
  const monde = creer_monde(scenario, options);
  while (!est_termine(monde)) {
    if (monde.t > DUREE_MAXIMALE) throw new Error(`raid non terminé après ${DUREE_MAXIMALE} s : défaut de simulation`);
    avancer_monde(monde);
  }
  return monde;
}

/** Rendre le bilan chiffré d'un monde : fuites, destructions, tirs, munitions restantes, durée. */
export function bilan(monde) {
  return {
    fuites: monde.fuites.reduce((somme, n) => somme + n, 0),
    fuites_max_cible: Math.max(...monde.fuites),
    ...monde.compteurs,
    munitions_air_restantes: monde.avions.reduce((somme, avion) => somme + avion.munitions, 0),
    munitions_sol_restantes: monde.postes.reduce((somme, poste) => somme + poste.munitions, 0),
    duree: monde.t,
  };
}
