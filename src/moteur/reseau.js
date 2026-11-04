// Réseau d'information (MODELE § 15.2) : ce que la conduite sait des drones, et quels avions elle peut joindre.
// En mode « complet », tout le monde parle avec tout le monde sans délai : le moteur se comporte comme avant.
import {distance_oblique, inverse, vers_ecef} from "./geodesie.js";
import {horizon_radar} from "./geometrie.js";
import {portee_radar, positions_radars} from "./radars.js";
import {altitude_sol, grille_terrain, masque_horizon, vu_par, vue_directe} from "./terrain.js";

const masques = new Map();

/** Rendre la grille du terrain du scénario, ou null sur Terre lisse. */
export const grille_scenario = (scenario) => (scenario.theatre.terrain ? grille_terrain(scenario.theatre.terrain) : null);

/**
 * Rendre le masque d'horizon de chaque radar contre l'essaim (MODELE § 16.2), mis en mémoire par terrain, positions,
 * hauteur d'antenne et portée : une campagne ne les calcule qu'une fois.
 */
export function masques_radars(scenario) {
  const grille = grille_scenario(scenario);
  if (!grille) return null;
  const radars = positions_radars(scenario);
  const portee = portee_radar(scenario);
  const cle = `${scenario.theatre.terrain.id}|${scenario.radar.hauteur_antenne}|${portee}|${radars.map((r) => `${r.lat},${r.lon}`).join(";")}`;
  if (!masques.has(cle)) {
    if (masques.size > 32) masques.clear();
    masques.set(cle, radars.map((site) => masque_horizon(grille, site, scenario.radar.hauteur_antenne, portee)));
  }
  return masques.get(cle);
}

/** Rendre vrai si deux extrémités au sol (mât de `hauteur`) ou en l'air se voient au-dessus du relief. */
function en_vue(grille, a, za, b, zb, distance) {
  return !grille || vue_directe(grille, a, za, b, zb, distance);
}

/** Rendre la portée d'une liaison entre extrémités de hauteurs `ha` et `hb` : portée du moyen, bornée par l'horizon s'il exige la vue directe. */
export const portee_liaison = (moyen, ha, hb) => (moyen.visibilite_directe ? Math.min(moyen.portee, horizon_radar(ha, hb)) : moyen.portee);

const est_avion = (noeud) => noeud.startsWith("avions:");

/** Rendre la position d'un nœud fixe (« conduite » ou « radar:<i> »), ou undefined s'il n'existe pas. */
function position_fixe(noeud, centre, radars) {
  return noeud === "conduite" ? centre : radars[Number(noeud.slice(6))];
}

/** Rendre les liaisons fixes (entre nœuds au sol) avec leur distance, leur portée et leur état ; `hs` : éléments en panne. */
function liaisons_fixes(reseau, radars, hs, grille) {
  return reseau.liaisons.map((liaison, k) => ({...liaison, k})).filter((l) => !est_avion(l.de) && !est_avion(l.vers)).map((liaison) => {
    const [a, b] = [position_fixe(liaison.de, reseau.centre, radars), position_fixe(liaison.vers, reseau.centre, radars)];
    if (!a || !b) return {...liaison, distance: null, portee: 0, active: false};
    if (hs.has(`liaison:${liaison.k}`) || hs.has(liaison.de) || hs.has(liaison.vers)) return {...liaison, distance: inverse(a, b).distance, portee: 0, active: false, en_panne: true};
    const distance = inverse(a, b).distance;
    const {hauteur_antenne: h, visibilite_directe: vue} = liaison.moyen;
    const portee = portee_liaison(liaison.moyen, h, h);
    const masquee = Boolean(grille && vue && distance <= portee && !en_vue(grille, a, altitude_sol(grille, a) + h, b, altitude_sol(grille, b) + h, distance));
    return {...liaison, distance, portee, masquee, active: distance <= portee && !masquee};
  });
}

/** Rendre {nœud: latence depuis la conduite} par le plus court chemin (Bellman-Ford : le graphe est petit). */
function latences_depuis_conduite(fixes) {
  const latences = new Map([["conduite", 0]]);
  for (let tour = 0; tour <= fixes.length; tour++) {
    let change = false;
    for (const {de, vers, moyen, active} of fixes.filter((l) => l.active)) {
      for (const [x, y] of [[de, vers], [vers, de]]) {
        const candidat = (latences.get(x) ?? Infinity) + moyen.latence;
        if (candidat < (latences.get(y) ?? Infinity)) [change] = [true, latences.set(y, candidat)];
      }
    }
    if (!change) break;
  }
  return latences;
}

/**
 * Préparer le réseau du scénario résolu, les éléments `hs` (« conduite », « radar:<i> », « liaison:<k> ») étant en
 * panne : latence de chaque radar jusqu'à la conduite (Infinity s'il n'y est pas relié ou s'il est en panne), accès
 * de chaque groupe d'avions (point d'accès au sol, moyen, latence), état des liaisons fixes. `simple` : réseau
 * complet sans panne, le moteur prend alors le chemin d'avant le réseau (bilans identiques).
 */
export function preparer_reseau(scenario, hs = new Set()) {
  const {reseau} = scenario;
  const radars = positions_radars(scenario);
  const ecefRadars = radars.map((geo) => vers_ecef(geo));
  const conduite_hs = hs.has("conduite");
  const grille = grille_scenario(scenario);
  // Avec un terrain, chaque radar voit selon son masque : le moteur prend le chemin radar par radar.
  const commun = {centre: reseau.centre, radars, ecefRadars, hs, conduite_hs, grille, masques: masques_radars(scenario),
    hauteur_drones: scenario.rouge.altitude, portee_radars: portee_radar(scenario),
    simple: reseau.mode === "complet" && hs.size === 0 && !grille};
  if (reseau.mode === "complet") {
    const latences_radars = radars.map((_, i) => (conduite_hs || hs.has(`radar:${i}`) ? Infinity : 0));
    return {...commun, mode: "complet", latences_radars, radars_hs: radars.map((_, i) => hs.has(`radar:${i}`)), fixes: [], acces: []};
  }
  const fixes = liaisons_fixes(reseau, radars, hs, grille);
  const latences = conduite_hs ? new Map() : latences_depuis_conduite(fixes);
  const acces = scenario.avions.map((_, g) => reseau.liaisons
    .filter((l, k) => !hs.has(`liaison:${k}`) && (l.de === `avions:${g}` || l.vers === `avions:${g}`))
    .map((l) => {
      const sol = l.de === `avions:${g}` ? l.vers : l.de;
      return {sol, position: position_fixe(sol, reseau.centre, radars), moyen: l.moyen, latence: (latences.get(sol) ?? Infinity) + l.moyen.latence};
    })
    .filter((a) => a.position && Number.isFinite(a.latence)));
  return {...commun, mode: "liaisons", latences_radars: radars.map((_, i) => latences.get(`radar:${i}`) ?? Infinity),
    radars_hs: radars.map((_, i) => hs.has(`radar:${i}`)), fixes, acces};
}

/** Rendre l'accès par lequel la conduite joint `avion` (le plus rapide à portée), ou null s'il est hors liaison. */
export function acces_avion(reseau, avion, indiceGroupe) {
  if (reseau.conduite_hs) return null;
  if (reseau.mode === "complet") return {sol: "conduite", latence: 0};
  let retenu = null;
  for (const acces of reseau.acces[indiceGroupe] ?? []) {
    const {hauteur_antenne: h, visibilite_directe: vue} = acces.moyen;
    const portee = portee_liaison(acces.moyen, h, avion.geo.alt);
    const distance = inverse(acces.position, avion.geo).distance;
    if (distance > portee || (retenu && acces.latence >= retenu.latence)) continue;
    // Le relief peut masquer la liaison radio entre le mât et l'avion (MODELE § 16.3).
    if (vue && reseau.grille && !en_vue(reseau.grille, acces.position, altitude_sol(reseau.grille, acces.position) + h, avion.geo, avion.geo.alt, distance)) continue;
    retenu = acces;
  }
  return retenu;
}

/** Rendre l'indice du radar en état le plus proche de `drone` (-1 s'il n'y en a pas). */
export function radar_le_plus_proche(reseau, drone) {
  let [indice, meilleure] = [-1, Infinity];
  reseau.ecefRadars.forEach((ecef, i) => {
    if (reseau.radars_hs[i]) return;
    const d = distance_oblique(ecef, drone.ecef);
    if (d < meilleure) [indice, meilleure] = [i, d];
  });
  return indice;
}

/**
 * Rendre les indices des radars en état qui voient `drone` : ceux que l'algorithme désigne, sinon le plus proche des
 * radars en état s'il est vu (couverture frontière : la frontière est jalonnée par les radars, MODELE § 15.1).
 */
export function radars_voyants(detection, couverture, reseau, drone, outils) {
  if (reseau.grille) return radars_voyants_relief(detection, couverture, reseau, drone, outils);
  if (detection.detecte_par) return detection.detecte_par(couverture, drone, outils).filter((i) => !reseau.radars_hs[i]);
  if (!detection.detecte(couverture, drone, outils)) return [];
  const indice = radar_le_plus_proche(reseau, drone);
  return indice < 0 ? [] : [indice];
}

/**
 * Avec un terrain : les radars candidats sont ceux que l'algorithme désigne, sinon tous ceux dont la portée contient
 * le drone ; le masque d'horizon de chacun tranche, le drone volant à sa hauteur au-dessus du sol (MODELE § 16.2).
 */
function radars_voyants_relief(detection, couverture, reseau, drone, outils) {
  const portee2 = reseau.portee_radars ** 2;
  const candidats = detection.detecte_par
    ? detection.detecte_par(couverture, drone, outils)
    : reseau.ecefRadars.map((e, i) => ((drone.ecef.x - e.x) ** 2 + (drone.ecef.y - e.y) ** 2 + (drone.ecef.z - e.z) ** 2 <= portee2 + reseau.hauteur_drones ** 2 ? i : -1)).filter((i) => i >= 0);
  return candidats.filter((i) => !reseau.radars_hs[i] && vu_par(reseau.masques[i], reseau.grille, drone.geo, drone.ecef, reseau.hauteur_drones));
}
