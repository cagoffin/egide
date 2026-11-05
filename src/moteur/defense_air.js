// Avions en orbite : orchestration des mises à poste, déplacements et tirs ; les décisions (pistage, allocation,
// mouvement, tir) sont déléguées aux algorithmes du scénario et des unités (MODELE § 8.3 à § 8.5, § 10).
// Chaque avion porte les paramètres de son groupe (type d'avion, arme, altitude) : la flotte peut être hétérogène.
import {algo} from "./algos.js";
import {ajouter, depuis_ecef, direct, distance_oblique, inverse, produit_scalaire, soustraire, vers_ecef} from "./geodesie.js";
import {parcourir_voisins} from "./grille.js";
import {OUTILS} from "./outils.js";
import {effet_esquive} from "./reaction.js";
import {acces_avion, connu_du_centre} from "./reseau.js";
import {est_actif, journaliser, plus_proche, resoudre_tir} from "./tir.js";
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
        prochain_tir: 0, guidage: groupe.arme.guidage, munitions: groupe.emport_nombre, type: groupe.type_vecteur ?? "avion", perdu: false,
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
 * pistage et d'allocation. Chaque centre affecte les avions qu'il joint le plus vite, sur sa propre situation : les
 * drones qu'il connaît depuis au moins le délai de réaction (MODELE § 18.2).
 */
// EXPÉRIENCE — meutes de défense de point (options dans conduite.*_test).
const SEUIL_CONNUS = 20;

/** Rendre la compacité de l'essaim connu : drones par cellule de 5 km, ou null si trop peu de drones sont connus. */
function compacite(monde) {
  const connus = monde.drones.filter((d) => est_actif(d, monde.t) && d.connu !== null && d.connu <= monde.t);
  if (connus.length < SEUIL_CONNUS) return null;
  const cellules = new Set(connus.map((d) => `${Math.floor(d.ecef.x / 5000)},${Math.floor(d.ecef.y / 5000)},${Math.floor(d.ecef.z / 5000)}`));
  return {valeur: connus.length / cellules.size, connus};
}

/** Rendre la position du membre `j` (sur `n`) de la meute de la cible `k` : anneau, ou échelons sur l'axe d'arrivée. */
function poste_de_meute(monde, k, j, n, axe, altitude) {
  const {conduite} = monde.scenario;
  const cible = monde.cibles[k].geo;
  if (!conduite.meutes_echelon_test || axe === null) return {...direct(cible, (2 * Math.PI * j) / n, conduite.meutes_test), alt: altitude};
  // Échelons tous les 6 km depuis 8 km, alternés de part et d'autre de l'axe à 3 km.
  const profondeur = 8000 + 6000 * Math.floor(j / 2);
  const centre = direct(cible, axe, profondeur);
  return {...direct(centre, axe + (j % 2 ? Math.PI / 2 : -Math.PI / 2), 3000), alt: altitude};
}

/** Placer `avion` dans la meute de la cible `k`, au rang `j` sur `n`. */
function rejoindre_meute(monde, avion, k, j, n, axe) {
  const orbite = poste_de_meute(monde, k, j, n, axe, avion.groupe.altitude);
  Object.assign(avion, {orbite, meute: k});
  if (avion.etat === "orbite" || avion.etat === "poste") Object.assign(avion, {etat: "retour", point: orbite});
}

/** Rendre l'azimut de la cible `k` vers le barycentre des drones connus (axe d'arrivée), ou null. */
function axe_arrivee(monde, k, connus) {
  if (!connus.length) return null;
  const centre = connus.reduce((s, d) => ajouter(s, d.ecef, 1 / connus.length), {x: 0, y: 0, z: 0});
  return inverse(monde.cibles[k].geo, depuis_ecef(centre)).azimut_depart;
}

function former_meutes(monde) {
  const {conduite} = monde.scenario;
  if (!conduite.meutes_test || monde.meutes_formees !== undefined) return;
  const lecture = compacite(monde);
  if (!lecture) return;
  // Doctrine : un essaim éparpillé se combat en interception libre, pas en meutes.
  monde.meutes_formees = !conduite.meutes_doctrine_test || lecture.valeur >= 3;
  monde.compacite_lue = lecture.valeur;
  if (!monde.meutes_formees) return;
  const cibles = monde.cibles;
  const capacite = Math.ceil(monde.avions.length / cibles.length);
  const membres = cibles.map(() => 0);
  const axes = cibles.map((_, k) => axe_arrivee(monde, k, lecture.connus));
  const paires = monde.avions.flatMap((a) => cibles.map((c, k) => ({a, k, d: distance_oblique(a.ecef, c.ecef)}))).sort((x, y) => x.d - y.d);
  const places = new Set();
  for (const {a, k} of paires) {
    if (places.has(a) || membres[k] >= capacite) continue;
    places.add(a);
    rejoindre_meute(monde, a, k, membres[k]++, capacite, axes[k]);
  }
  monde.prochain_redeploiement = monde.t + (conduite.meutes_redeploiement_test ?? Infinity);
}

/** Redéployer les meutes vers les cibles que visent les pistes (cap à moins de 3 km, moins de 4 min), brèches × 3. */
function redeployer_meutes(monde) {
  const {conduite} = monde.scenario;
  if (!monde.meutes_formees || !conduite.meutes_redeploiement_test || monde.t < monde.prochain_redeploiement) return;
  monde.prochain_redeploiement = monde.t + conduite.meutes_redeploiement_test;
  const menace = monde.cibles.map(() => 0);
  const connus = monde.drones.filter((d) => est_actif(d, monde.t) && d.connu !== null && d.connu <= monde.t);
  for (const d of connus) {
    const v = Math.hypot(d.vitesse.x, d.vitesse.y, d.vitesse.z);
    if (!v) continue;
    monde.cibles.forEach((c, k) => {
      const D = soustraire(c.ecef, d.ecef);
      const avance = produit_scalaire(D, d.vitesse) / v;
      const ecart = Math.sqrt(Math.max(produit_scalaire(D, D) - avance ** 2, 0));
      if (avance > 0 && avance / v <= 240 && ecart <= 3000) menace[k] += monde.fuites[k] > 0 ? 3 : 1;
    });
  }
  const total = menace.reduce((s, x) => s + x, 0);
  if (!total) return;
  const libres = monde.avions.filter((a) => a.munitions > 0 && !a.perdu && a.etat !== "engagement" && a.meute !== undefined);
  const voulus = menace.map((m) => Math.round((libres.length * m) / total));
  const presents = monde.cibles.map((_, k) => libres.filter((a) => a.meute === k));
  for (let k = 0; k < monde.cibles.length; k++) {
    while (presents[k].length < voulus[k]) {
      // Prendre l'avion en surplus le plus proche de la cible menacée.
      const donneurs = presents.flatMap((p, i) => (p.length > voulus[i] ? p.map((a) => ({a, i})) : []));
      if (!donneurs.length) break;
      const {a, i} = donneurs.reduce((m, x) => (distance_oblique(x.a.ecef, monde.cibles[k].ecef) < distance_oblique(m.a.ecef, monde.cibles[k].ecef) ? x : m));
      presents[i].splice(presents[i].indexOf(a), 1);
      presents[k].push(a);
      rejoindre_meute(monde, a, k, presents[k].length - 1, Math.max(voulus[k], 1), axe_arrivee(monde, k, connus));
    }
  }
}

export function planifier_avions(monde) {
  former_meutes(monde);
  redeployer_meutes(monde);
  for (const avion of monde.avions) avion.acces = acces_avion(monde.reseau, avion, monde.scenario.avions.indexOf(avion.groupe));
  // Un avion sous ordre (ou dont l'ordre est en route) n'est pas réaffecté avant d'avoir rallié son point.
  const libres = monde.avions.filter((avion) => avion.acces && avion.munitions > 0 && !avion.ordre && !avion.consigne?.ordre && !drone_approchant(monde, avion));
  monde.reseau.centres.forEach((_, c) => {
    const siens = libres.filter((avion) => avion.acces.centre === c);
    if (siens.length) affecter(monde, c, siens);
  });
}

/** Affecter les avions libres `siens` du centre `c` aux pistes des drones qu'il connaît. */
function affecter(monde, c, siens) {
  const {conduite} = monde.scenario;
  const connus = monde.drones.filter((drone) => {
    const connu = connu_du_centre(drone, c);
    return est_actif(drone, monde.t) && connu !== null && monde.t - connu >= conduite.delai_reaction;
  });
  const pistes = algo(monde.registre, conduite.pistage, "pistage").pister(connus, OUTILS);
  // Un centre secondaire peut avoir son propre algorithme d'allocation (déploiement, MODELE § 21.3).
  const allocation = (c > 0 && monde.scenario.reseau.centres[c - 1]?.allocation) || conduite.allocation;
  for (const {avion, point, explication} of algo(monde.registre, allocation, "allocation").allouer(siens, pistes, OUTILS)) {
    // L'explication est facultative pour un algorithme d'allocation ; l'inspecteur l'affiche quand elle existe.
    // Nouvelle mission (l'avion n'était pas déjà en route) : journalisée pour le suivi de l'information (MODELE § 17).
    const nouvelle = Boolean(point && avion.etat !== "ralliement" && !avion.consigne);
    if (nouvelle) {
      journaliser(monde, {type: "mission", avion: avion.id, point, effectif: explication?.retenue?.effectif ?? null, arrivee: monde.t + avion.acces.latence, depuis: avion.acces.sol, centre: c});
    }
    avion.decision = {t: monde.t, point, explication, arrivee: monde.t + avion.acces.latence};
    // La consigne met la latence de la liaison à arriver (MODELE § 15.2) ; sans latence, elle s'applique aussitôt.
    if (avion.acces.latence > 0) avion.consigne = {t: monde.t + avion.acces.latence, point, ordre: false, nouvelle};
    else executer_consigne(avion, point);
  }
}

/** Appliquer une consigne de la conduite : rallier `point`, ou revenir sur l'orbite s'il n'y en a pas. */
function executer_consigne(avion, point) {
  if (point) {
    avion.etat = "ralliement";
    avion.point = point;
  } else if (avion.etat !== "orbite") {
    avion.etat = "retour";
    avion.point = avion.orbite;
  }
}

/** Appliquer les consignes et ordres arrivés à leur avion (après la latence de la liaison). */
export function livrer_consignes(monde) {
  for (const avion of monde.avions) {
    const consigne = avion.consigne;
    if (!consigne || consigne.t > monde.t) continue;
    avion.consigne = null;
    if (avion.munitions === 0) continue;
    // Seule la réception d'une nouvelle mission ou d'un ordre se journalise : pas chaque mise à jour du point.
    if (consigne.point && (consigne.nouvelle || consigne.ordre)) journaliser(monde, {type: "reception", avion: avion.id, ordre: consigne.ordre});
    if (consigne.ordre) Object.assign(avion, {etat: "ralliement", point: {...consigne.point, alt: avion.geo.alt}, ordre: true});
    else executer_consigne(avion, consigne.point);
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
    if (avion.perdu) continue;
    const {vitesse_mise_a_poste: vitesse, vitesse_engagement: vitesseEngagement} = avion.groupe;
    const essai = monde.scenario.conduite.meutes_doctrine_test && !monde.meutes_formees ? null : monde.scenario.conduite.engagement_test;
    const menace = avion.munitions > 0 ? drone_approchant(monde, avion) ?? (essai ? plus_proche(monde, avion.ecef, avion.groupe.arme.portee, false) : null) : null;
    if (menace) {
      // L'avion accroche un drone avec son propre capteur : il le poursuit sans attendre la conduite.
      if (avion.etat !== "engagement" || avion.contact !== menace.id) journaliser(monde, {type: "contact", avion: avion.id, drone: menace.id});
      avion.contact = menace.id;
      avion.etat = "engagement";
      const but = essai ? {...depuis_ecef(ajouter(menace.ecef, menace.vitesse, essai)), alt: avion.geo.alt} : menace.geo;
      deplacer(monde, avion, but, vitesseEngagement * dt);
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
    // Un brouilleur ne tire pas : son effet de zone est résolu par brouiller() (MODELE § 19.3).
    if (avion.munitions === 0 || avion.perdu || arme.type === "brouillage" || monde.t < avion.prochain_tir) continue;
    const drone = plus_proche(monde, avion.ecef, arme.portee, true);
    if (!drone) continue;
    const tir = algo(monde.registre, arme.algos.tir, "tir");
    const {vol, occupation} = tir.planifier_tir(arme, distance_oblique(avion.ecef, drone.ecef));
    avion.munitions--;
    avion.prochain_tir = monde.t + occupation;
    drone.vise = true;
    monde.compteurs.tirs_air++;
    monde.tirs_en_vol.push({drone, impact: monde.t + vol, pk: arme.pk, origine: {...avion.geo}, tireur: avion.id});
    // Un intercepteur à usage unique est son arme : il se perd en frappant (MODELE § 19.2).
    if (avion.groupe.consomme_au_tir) {
      avion.perdu = true;
      monde.compteurs.intercepteurs_perdus++;
    }
  }
}

/**
 * Brouiller (MODELE § 19.3) : chaque drone ennemi actif dans le rayon d'un brouilleur est neutralisé avec la
 * probabilité 1 − exp(−Δt / τ) à chaque pas, τ étant la constante de temps du brouillage. Effet de zone notionnel,
 * sans modèle de signal ni de contre-mesure.
 */
export function brouiller(monde, dt) {
  for (const avion of monde.avions) {
    const {arme} = avion.groupe;
    if (arme.type !== "brouillage" || avion.perdu) continue;
    const probabilite = 1 - Math.exp(-dt / arme.constante_temps);
    parcourir_voisins(monde.index, avion.ecef, arme.portee, (drone) => {
      if (!est_actif(drone, monde.t) || distance_oblique(drone.ecef, avion.ecef) > arme.portee) return;
      if (!monde.hasard.succes(probabilite)) return;
      drone.vivant = false;
      monde.compteurs.neutralises_brouillage++;
      journaliser(monde, {type: "brouillage", tireur: avion.id, drone: drone.id, de: {...avion.geo}, vers: {...drone.geo}});
    });
  }
}

/** Résoudre les tirs air dont la roquette arrive à cet instant ; un drone réactif l'a esquivé (MODELE § 22.4). */
export function resoudre_tirs_en_vol(monde) {
  const {reduction} = effet_esquive(monde);
  const restants = [];
  for (const tir of monde.tirs_en_vol) {
    if (tir.impact > monde.t) {
      restants.push(tir);
      continue;
    }
    tir.drone.vise = false;
    if (monde.essaim && est_actif(tir.drone, monde.t)) monde.compteurs.esquives++;
    const details = monde.essaim ? {esquive: reduction} : {};
    resoudre_tir(monde, tir.drone, tir.pk * (1 - reduction), "air", tir.origine, tir.tireur, details);
  }
  monde.tirs_en_vol = restants;
}
