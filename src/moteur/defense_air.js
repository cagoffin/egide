// Avions en orbite : planification des mises à poste, déplacement, tirs guidés (MODELE § 3, § 8.3 à § 8.5, § 9.4).
// Chaque avion porte les paramètres de son groupe (type d'avion, arme, altitude) : la flotte peut être hétérogène.
import {ajouter, depuis_ecef, direct, distance_oblique, pas_vers, produit_scalaire, soustraire, vers_ecef} from "./geodesie.js";
import {parcourir_voisins} from "./grille.js";
import {est_actif, plus_proche, resoudre_tir} from "./tir.js";

// Taille des cellules qui regroupent les drones en pistes : 5 km, soit 22 s de vol d'un drone à 800 km/h.
const CELLULE = 5_000;
// Au-delà de 15 min, l'extrapolation rectiligne d'une piste ne vaut plus rien.
const HORIZON_INTERCEPTION = 900;
// Un drone qui se rapproche à moins de 3 portées d'arme fait passer l'avion de la mise à poste à l'engagement.
const PORTEES_ENGAGEMENT = 3;

/** Rendre les avions de tous les groupes, en orbite à des positions uniformes sur le disque défendu. */
export function creer_avions(scenario, hasard) {
  const {origine, zone_rayon: rayon} = scenario.theatre;
  const avions = [];
  for (const groupe of scenario.avions) {
    for (let i = 0; i < groupe.nombre; i++) {
      const distance = rayon * Math.sqrt(hasard.uniforme());
      const orbite = {...direct(origine, hasard.uniforme(0, 2 * Math.PI), distance), alt: groupe.altitude};
      avions.push({
        id: avions.length, groupe, orbite, geo: {...orbite}, ecef: vers_ecef(orbite), etat: "orbite", point: null,
        prochain_tir: 0, guidage: groupe.arme.guidage, munitions: groupe.emport_nombre,
      });
    }
  }
  return avions;
}

/**
 * Rendre le plus petit délai t ≥ 0 (s) tel qu'un avion parti de `position` à `vitesseAvion` soit à moins de `portee`
 * de la position extrapolée en ligne droite de `cible` ({position, vitesse} en ECEF), ou null (MODELE § 8.3).
 * Racine de |D + V t|² = (v t + r)², D = cible − avion, en trois dimensions.
 */
export function delai_interception(position, cible, vitesseAvion, portee) {
  const D = soustraire(cible.position, position);
  const V = cible.vitesse;
  const c = produit_scalaire(D, D) - portee * portee;
  if (c <= 0) return 0;
  const a = produit_scalaire(V, V) - vitesseAvion ** 2;
  const b = 2 * (produit_scalaire(D, V) - vitesseAvion * portee);
  if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const racines = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
  // a > 0 (drone plus rapide) : la condition tient entre les racines ; a < 0 : au-delà de la plus grande.
  const delai = a > 0 ? Math.min(...racines) : Math.max(...racines);
  return delai >= 0 ? delai : null;
}

const cle_cellule = (p) => `${Math.floor(p.x / CELLULE)},${Math.floor(p.y / CELLULE)},${Math.floor(p.z / CELLULE)}`;

function regrouper_pistes(monde) {
  const pistes = new Map();
  for (const drone of monde.drones) {
    const connu = drone.detection !== null && monde.t - drone.detection >= monde.scenario.conduite.delai_reaction;
    if (!est_actif(drone, monde.t) || !connu) continue;
    const cle = cle_cellule(drone.ecef);
    const piste = pistes.get(cle);
    if (piste) piste.effectif++;
    else pistes.set(cle, {drone, effectif: 1});
  }
  return [...pistes.values()];
}

/** Rendre le drone actif le plus proche qui se rapproche de l'avion à moins de 3 portées d'arme, ou null. */
export function drone_approchant(monde, avion) {
  let retenu = null;
  let meilleure = PORTEES_ENGAGEMENT * avion.groupe.arme.portee;
  parcourir_voisins(monde.index, avion.ecef, meilleure, (drone) => {
    if (!est_actif(drone, monde.t)) return;
    const versAvion = soustraire(avion.ecef, drone.ecef);
    const ecart = distance_oblique(avion.ecef, drone.ecef);
    if (ecart <= meilleure && produit_scalaire(versAvion, drone.vitesse) > 0) {
      meilleure = ecart;
      retenu = drone;
    }
  });
  return retenu;
}

function meilleure_interception(avion, pistes, affectes) {
  const {vitesse_mise_a_poste: vitesse, arme, altitude} = avion.groupe;
  let meilleur = null;
  for (const piste of pistes) {
    const cible = {position: piste.drone.ecef, vitesse: piste.drone.vitesse};
    const delai = delai_interception(avion.ecef, cible, vitesse, arme.portee);
    if (delai === null || delai > HORIZON_INTERCEPTION) continue;
    const extrapole = ajouter(piste.drone.ecef, piste.drone.vitesse, delai);
    // Densité de la piste, divisée par les avions déjà envoyés au même endroit : on étale la flotte.
    const score = piste.effectif / (1 + (affectes.get(cle_cellule(extrapole)) ?? 0));
    if (!meilleur || score > meilleur.score || (score === meilleur.score && delai < meilleur.delai)) {
      // La droite ECEF passe sous la surface (≈ d²/8R) : seul le point au sol compte, l'avion garde son altitude.
      meilleur = {point: {...depuis_ecef(extrapole), alt: altitude}, cle: cle_cellule(extrapole), delai, score};
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
    const choix = meilleure_interception(avion, pistes, affectes);
    if (choix) {
      avion.etat = "ralliement";
      avion.point = choix.point;
      affectes.set(choix.cle, (affectes.get(choix.cle) ?? 0) + 1);
    } else if (avion.etat !== "orbite") {
      avion.etat = "retour";
      avion.point = avion.orbite;
    }
  }
}

function deplacer(avion, but, pas) {
  const {atteint, ...suivant} = pas_vers(avion.geo, but, pas);
  avion.geo = suivant;
  avion.ecef = vers_ecef(suivant);
  return atteint;
}

/** Déplacer les avions de `dt` s : vers le drone en approche à la vitesse d'engagement, sinon vers leur point. */
export function avancer_avions(monde, dt) {
  for (const avion of monde.avions) {
    const {vitesse_mise_a_poste: vitesse, vitesse_engagement: vitesseEngagement} = avion.groupe;
    const menace = avion.munitions > 0 ? drone_approchant(monde, avion) : null;
    if (menace) {
      avion.etat = "engagement";
      deplacer(avion, menace.geo, vitesseEngagement * dt);
      continue;
    }
    if (avion.etat === "engagement") avion.etat = "poste";
    if (avion.etat !== "ralliement" && avion.etat !== "retour") continue;
    if (deplacer(avion, avion.point, vitesse * dt)) avion.etat = avion.etat === "retour" ? "orbite" : "poste";
  }
}

/**
 * Faire tirer chaque avion prêt sur le drone non visé le plus proche à portée (MODELE § 4.2) :
 * un tir laser occupe l'avion pendant la désignation ; un tir IR le libère après la cadence.
 */
export function tirer_air(monde) {
  for (const avion of monde.avions) {
    const {arme} = avion.groupe;
    if (avion.munitions === 0 || monde.t < avion.prochain_tir) continue;
    const drone = plus_proche(monde, avion.ecef, arme.portee, true);
    if (!drone) continue;
    const laser = avion.guidage === "laser";
    const vol = laser ? arme.duree_designation : distance_oblique(avion.ecef, drone.ecef) / arme.vitesse;
    avion.munitions--;
    avion.prochain_tir = monde.t + (laser ? arme.duree_designation : arme.cadence);
    drone.vise = true;
    monde.compteurs.tirs_air++;
    monde.tirs_en_vol.push({drone, impact: monde.t + vol, pk: arme.pk, origine: {...avion.geo}});
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
    resoudre_tir(monde, tir.drone, tir.pk, "air", tir.origine);
  }
  monde.tirs_en_vol = restants;
}
