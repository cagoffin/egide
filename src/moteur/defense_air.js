// Avions en orbite : planification des mises à poste, déplacement, tirs guidés (MODELE § 3 et § 8.3 à § 8.5).
import {parcourir_voisins} from "./grille.js";
import {est_actif, plus_proche, resoudre_tir} from "./tir.js";
import {avancer, distance, point_polaire} from "./vecteurs.js";

// Taille des cellules qui regroupent les drones en pistes : 5 km, soit 22 s de vol d'un drone à 800 km/h.
const CELLULE = 5_000;
// Au-delà de 15 min, l'extrapolation rectiligne d'une piste ne vaut plus rien.
const HORIZON_INTERCEPTION = 900;
// Roquette guidée : ordre de grandeur Mach 2, sert au temps de vol des tirs IR.
const VITESSE_ROQUETTE = 700;
// Un drone qui se rapproche à moins de 3 portées d'arme fait passer l'avion de la mise à poste à l'engagement.
const PORTEES_ENGAGEMENT = 3;

/** Rendre les avions, en orbite à des positions uniformes sur le disque défendu ; les premiers sont en guidage IR. */
export function creer_avions(scenario, hasard) {
  return Array.from({length: scenario.avions_nombre}, (_, id) => {
    const orbite = point_polaire(scenario.zone_rayon * Math.sqrt(hasard.uniforme()), hasard.uniforme(0, 2 * Math.PI));
    return {
      id, orbite, position: {...orbite}, etat: "orbite", point: null, prochain_tir: 0,
      guidage: id < scenario.avions_ir_nombre ? "ir" : "laser", munitions: scenario.avions_roquettes_par_avion,
    };
  });
}

/**
 * Rendre le plus petit délai t ≥ 0 (s) tel qu'un avion parti de `position` à `vitesseAvion` soit à moins de `portee`
 * de la position extrapolée du drone, ou null (MODELE § 8.3). Racine de |D + V t|² = (v t + r)², D = drone − avion.
 */
export function delai_interception(position, drone, vitesseAvion, portee) {
  const dx = drone.position.x - position.x;
  const dy = drone.position.y - position.y;
  const c = dx * dx + dy * dy - portee * portee;
  if (c <= 0) return 0;
  const a = drone.vitesse.x ** 2 + drone.vitesse.y ** 2 - vitesseAvion ** 2;
  const b = 2 * (dx * drone.vitesse.x + dy * drone.vitesse.y - vitesseAvion * portee);
  if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const racines = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
  // a > 0 (drone plus rapide) : la condition tient entre les racines ; a < 0 : au-delà de la plus grande.
  const delai = a > 0 ? Math.min(...racines) : Math.max(...racines);
  return delai >= 0 ? delai : null;
}

const cle_cellule = (point) => `${Math.floor(point.x / CELLULE)},${Math.floor(point.y / CELLULE)}`;
const extrapoler = (drone, delai) => ({x: drone.position.x + drone.vitesse.x * delai, y: drone.position.y + drone.vitesse.y * delai});

function regrouper_pistes(monde) {
  const pistes = new Map();
  for (const drone of monde.drones) {
    const connu = drone.detection !== null && monde.t - drone.detection >= monde.scenario.delai_reaction;
    if (!est_actif(drone, monde.t) || !connu) continue;
    const cle = cle_cellule(drone.position);
    const piste = pistes.get(cle);
    if (piste) piste.effectif++;
    else pistes.set(cle, {drone, effectif: 1});
  }
  return [...pistes.values()];
}

/** Rendre le drone actif le plus proche qui se rapproche de l'avion à moins de 3 portées d'arme, ou null. */
export function drone_approchant(monde, avion) {
  let retenu = null;
  let meilleure = PORTEES_ENGAGEMENT * monde.scenario.roquette_air_portee;
  parcourir_voisins(monde.index, avion.position, meilleure, (drone) => {
    if (!est_actif(drone, monde.t)) return;
    const dx = avion.position.x - drone.position.x;
    const dy = avion.position.y - drone.position.y;
    const ecart = Math.hypot(dx, dy);
    if (ecart <= meilleure && dx * drone.vitesse.x + dy * drone.vitesse.y > 0) {
      meilleure = ecart;
      retenu = drone;
    }
  });
  return retenu;
}

function meilleure_interception(avion, pistes, affectes, scenario) {
  let meilleur = null;
  for (const piste of pistes) {
    const delai = delai_interception(avion.position, piste.drone, scenario.avions_vitesse, scenario.roquette_air_portee);
    if (delai === null || delai > HORIZON_INTERCEPTION) continue;
    const point = extrapoler(piste.drone, delai);
    // Densité de la piste, divisée par les avions déjà envoyés au même endroit : on étale la flotte.
    const score = piste.effectif / (1 + (affectes.get(cle_cellule(point)) ?? 0));
    if (!meilleur || score > meilleur.score || (score === meilleur.score && delai < meilleur.delai)) {
      meilleur = {point, delai, score};
    }
  }
  return meilleur;
}

/** Réaffecter chaque avion libre (armé, sans drone en approche) au point d'interception le plus rentable. */
export function planifier_avions(monde) {
  const pistes = regrouper_pistes(monde);
  const affectes = new Map();
  for (const avion of monde.avions) {
    if (avion.munitions === 0 || drone_approchant(monde, avion)) continue;
    const choix = meilleure_interception(avion, pistes, affectes, monde.scenario);
    if (choix) {
      avion.etat = "ralliement";
      avion.point = choix.point;
      affectes.set(cle_cellule(choix.point), (affectes.get(cle_cellule(choix.point)) ?? 0) + 1);
    } else if (avion.etat !== "orbite") {
      avion.etat = "retour";
      avion.point = avion.orbite;
    }
  }
}

/** Déplacer les avions de `dt` s : vers le drone en approche à la vitesse d'engagement, sinon vers leur point. */
export function avancer_avions(monde, dt) {
  const {avions_vitesse: vitesse, avions_vitesse_engagement: vitesseEngagement} = monde.scenario;
  for (const avion of monde.avions) {
    const menace = avion.munitions > 0 ? drone_approchant(monde, avion) : null;
    if (menace) {
      avion.etat = "engagement";
      const pas = avancer(avion.position, menace.position, vitesseEngagement * dt);
      avion.position = {x: pas.x, y: pas.y};
      continue;
    }
    if (avion.etat === "engagement") avion.etat = "poste";
    if (avion.etat !== "ralliement" && avion.etat !== "retour") continue;
    const pas = avancer(avion.position, avion.point, vitesse * dt);
    avion.position = {x: pas.x, y: pas.y};
    if (pas.atteint) avion.etat = avion.etat === "retour" ? "orbite" : "poste";
  }
}

/**
 * Faire tirer chaque avion prêt sur le drone non visé le plus proche à portée (MODELE § 4.2) :
 * un tir laser occupe l'avion pendant la désignation ; un tir IR le libère après la cadence.
 */
export function tirer_air(monde) {
  const {scenario} = monde;
  for (const avion of monde.avions) {
    if (avion.munitions === 0 || monde.t < avion.prochain_tir) continue;
    const drone = plus_proche(monde, avion.position, scenario.roquette_air_portee, true);
    if (!drone) continue;
    const laser = avion.guidage === "laser";
    const vol = laser ? scenario.laser_duree_designation : distance(avion.position, drone.position) / VITESSE_ROQUETTE;
    avion.munitions--;
    avion.prochain_tir = monde.t + (laser ? scenario.laser_duree_designation : scenario.ir_cadence);
    drone.vise = true;
    monde.compteurs.tirs_air++;
    monde.tirs_en_vol.push({drone, impact: monde.t + vol, origine: {...avion.position}});
  }
}

/** Résoudre les tirs air dont la roquette arrive à cet instant. */
export function resoudre_tirs_en_vol(monde) {
  const restants = [];
  for (const tir of monde.tirs_en_vol) {
    if (tir.impact > monde.t) {
      restants.push(tir);
      continue;
    }
    tir.drone.vise = false;
    resoudre_tir(monde, tir.drone, monde.scenario.roquette_air_pk, "air", tir.origine);
  }
  monde.tirs_en_vol = restants;
}
