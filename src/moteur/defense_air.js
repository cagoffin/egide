// Avions en orbite : orchestration des mises à poste, déplacements et tirs ; les décisions (pistage, allocation,
// mouvement, tir) sont déléguées aux algorithmes du scénario et des unités (MODELE § 8.3 à § 8.5, § 10).
// Chaque avion porte les paramètres de son groupe (type d'avion, arme, altitude) : la flotte peut être hétérogène.
import {algo} from "./algos.js";
import {direct, distance_oblique, produit_scalaire, soustraire, vers_ecef} from "./geodesie.js";
import {parcourir_voisins} from "./grille.js";
import {OUTILS} from "./outils.js";
import {acces_avion} from "./reseau.js";
import {est_actif, plus_proche, resoudre_tir} from "./tir.js";
// Un drone qui se rapproche à moins de 3 portées d'arme fait passer l'avion de la mise à poste à l'engagement.
const PORTEES_ENGAGEMENT = 3;

/** Rendre l'orbite tirée au hasard, uniformément sur le disque défendu. */
function orbite_aleatoire(scenario, groupe, hasard) {
  const {origine, zone_rayon: rayon} = scenario.theatre;
  const distance = rayon * Math.sqrt(hasard.uniforme());
  return {...direct(origine, hasard.uniforme(0, 2 * Math.PI), distance), alt: groupe.altitude};
}

/** Rendre les avions de tous les groupes : orbites placées à la main d'abord, puis tirées au hasard sur le disque. */
export function creer_avions(scenario, hasard) {
  const avions = [];
  for (const groupe of scenario.avions) {
    const placees = groupe.orbites_placees ?? [];
    for (let i = 0; i < groupe.nombre; i++) {
      const orbite = i < placees.length ? {...placees[i]} : orbite_aleatoire(scenario, groupe, hasard);
      avions.push({
        id: avions.length, groupe, orbite, geo: {...orbite}, ecef: vers_ecef(orbite), etat: "orbite", point: null,
        prochain_tir: 0, guidage: groupe.arme.guidage, munitions: groupe.emport_nombre,
      });
    }
  }
  return avions;
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

/**
 * Réaffecter les avions libres (armés, sans drone en approche, joignables par le réseau) par les algorithmes de
 * pistage et d'allocation, sur les seuls drones que la conduite connaît depuis au moins le délai de réaction.
 */
export function planifier_avions(monde) {
  const {conduite} = monde.scenario;
  const connus = monde.drones.filter(
    (drone) => est_actif(drone, monde.t) && drone.connu !== null && monde.t - drone.connu >= conduite.delai_reaction,
  );
  for (const avion of monde.avions) avion.acces = acces_avion(monde.reseau, avion, monde.scenario.avions.indexOf(avion.groupe));
  const pistes = algo(monde.registre, conduite.pistage, "pistage").pister(connus, OUTILS);
  // Un avion sous ordre n'est pas réaffecté par la conduite avant d'avoir rallié son point.
  const libres = monde.avions.filter((avion) => avion.acces && avion.munitions > 0 && !avion.ordre && !drone_approchant(monde, avion));
  for (const {avion, point, explication} of algo(monde.registre, conduite.allocation, "allocation").allouer(libres, pistes, OUTILS)) {
    // L'explication est facultative pour un algorithme d'allocation ; l'inspecteur l'affiche quand elle existe.
    avion.decision = {t: monde.t, point, explication};
    if (point) {
      avion.etat = "ralliement";
      avion.point = point;
    } else if (avion.etat !== "orbite") {
      avion.etat = "retour";
      avion.point = avion.orbite;
    }
  }
}

function deplacer(monde, avion, but, pas) {
  const mouvement = algo(monde.registre, avion.groupe.algos.mouvement, "mouvement");
  const route = [{geo: but, ecef: vers_ecef({...but, alt: avion.geo.alt})}];
  const suivant = mouvement.avancer(avion, route, pas, OUTILS);
  avion.geo = suivant.geo;
  avion.ecef = suivant.ecef;
  return suivant.atteints === 1;
}

/** Déplacer les avions de `dt` s : vers le drone en approche à la vitesse d'engagement, sinon vers leur point. */
export function avancer_avions(monde, dt) {
  for (const avion of monde.avions) {
    const {vitesse_mise_a_poste: vitesse, vitesse_engagement: vitesseEngagement} = avion.groupe;
    const menace = avion.munitions > 0 ? drone_approchant(monde, avion) : null;
    if (menace) {
      avion.etat = "engagement";
      deplacer(monde, avion, menace.geo, vitesseEngagement * dt);
      continue;
    }
    if (avion.etat === "engagement") avion.etat = avion.ordre ? "ralliement" : "poste";
    if (avion.etat !== "ralliement" && avion.etat !== "retour") continue;
    if (deplacer(monde, avion, avion.point, vitesse * dt)) {
      avion.etat = avion.etat === "retour" ? "orbite" : "poste";
      avion.ordre = false;
    }
  }
}

/**
 * Faire tirer chaque avion prêt sur le drone non visé le plus proche à portée (MODELE § 4.2) ; l'algorithme de tir
 * de l'arme donne le temps de vol et la durée pendant laquelle l'avion ne peut plus tirer.
 */
export function tirer_air(monde) {
  for (const avion of monde.avions) {
    const {arme} = avion.groupe;
    if (avion.munitions === 0 || monde.t < avion.prochain_tir) continue;
    const drone = plus_proche(monde, avion.ecef, arme.portee, true);
    if (!drone) continue;
    const tir = algo(monde.registre, arme.algos.tir, "tir");
    const {vol, occupation} = tir.planifier_tir(arme, distance_oblique(avion.ecef, drone.ecef));
    avion.munitions--;
    avion.prochain_tir = monde.t + occupation;
    drone.vise = true;
    monde.compteurs.tirs_air++;
    monde.tirs_en_vol.push({drone, impact: monde.t + vol, pk: arme.pk, origine: {...avion.geo}, tireur: avion.id});
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
    resoudre_tir(monde, tir.drone, tir.pk, "air", tir.origine, tir.tireur);
  }
  monde.tirs_en_vol = restants;
}
