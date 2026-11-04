// La simulation : état du monde, boucle à pas fixe, bilan (MODELE § 8 et § 9). Pur : ni DOM, ni réseau, ni horloge.
import {avancer_avions, creer_avions, planifier_avions, resoudre_tirs_en_vol, tirer_air} from "./defense_air.js";
import {creer_postes, tirer_sol} from "./defense_sol.js";
import {direct, inverse, vers_ecef} from "./geodesie.js";
import {horizon_radar} from "./geometrie.js";
import {indexer_drones} from "./grille.js";
import {creer_hasard} from "./hasard.js";
import {avancer_drones, creer_drones, detecter_drones} from "./menace.js";

// Les drones naissent 20 km avant la couverture radar : ils ne sont pas vus dès leur apparition.
const MARGE_APPARITION = 20_000;
// Garde-fou : un raid dure quelques minutes ; au-delà de 2 h, la simulation boucle sur un défaut.
const DUREE_MAXIMALE = 7_200;
const ESSAIS_PLACEMENT = 10_000;

/** Rendre les cibles ({geo, ecef}), tirées dans 70 % du rayon et espacées d'au moins un cinquième du rayon. */
export function placer_cibles(scenario, hasard) {
  const {origine, zone_rayon: rayon, cibles_nombre: nombre} = scenario.theatre;
  const cibles = [];
  let ecartMinimal = rayon / 5;
  for (let essai = 0; cibles.length < nombre; essai++) {
    // Zone trop petite pour l'écart demandé : on le réduit plutôt que de boucler sans fin.
    if (essai > 0 && essai % ESSAIS_PLACEMENT === 0) ecartMinimal /= 2;
    const distance = 0.7 * rayon * Math.sqrt(hasard.uniforme());
    const candidate = direct(origine, hasard.uniforme(0, 2 * Math.PI), distance);
    if (cibles.every((cible) => inverse(cible.geo, candidate).distance >= ecartMinimal)) {
      cibles.push({geo: candidate, ecef: vers_ecef(candidate)});
    }
  }
  return cibles;
}

/** Rendre un monde neuf pour un scénario résolu. `journal` : tenir la liste des évènements (rejeu), inutile en campagne. */
export function creer_monde(scenario, {journal = true} = {}) {
  const hasard = creer_hasard(scenario.simulation.graine);
  const cibles = placer_cibles(scenario, hasard);
  const detection = Math.min(horizon_radar(scenario.radar.hauteur_antenne, scenario.rouge.altitude), scenario.radar.portee_max);
  const rayonDetection = scenario.theatre.zone_rayon + detection;
  return {
    scenario, hasard, t: 0, cibles, rayonDetection,
    drones: creer_drones(scenario, cibles.map((cible) => cible.geo), hasard, rayonDetection + MARGE_APPARITION),
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
  const {simulation, conduite} = monde.scenario;
  monde.t += simulation.pas;
  avancer_drones(monde, simulation.pas);
  monde.index = indexer_drones(monde.drones, monde.t);
  detecter_drones(monde);
  if (monde.t >= monde.prochaine_decision) {
    planifier_avions(monde);
    monde.prochaine_decision = monde.t + conduite.pas_decision;
  }
  avancer_avions(monde, simulation.pas);
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
