// Réseau d'information (MODELE § 15.2) : ce que la conduite sait des drones, et quels avions elle peut joindre.
// En mode « complet », tout le monde parle avec tout le monde sans délai : le moteur se comporte comme avant.
import {distance_oblique, inverse, vers_ecef} from "./geodesie.js";
import {horizon_radar} from "./geometrie.js";
import {positions_radars} from "./radars.js";

/** Rendre la portée d'une liaison entre extrémités de hauteurs `ha` et `hb` : portée du moyen, bornée par l'horizon s'il exige la vue directe. */
export const portee_liaison = (moyen, ha, hb) => (moyen.visibilite_directe ? Math.min(moyen.portee, horizon_radar(ha, hb)) : moyen.portee);

const est_avion = (noeud) => noeud.startsWith("avions:");

/** Rendre la position d'un nœud fixe (« conduite » ou « radar:<i> »), ou undefined s'il n'existe pas. */
function position_fixe(noeud, centre, radars) {
  return noeud === "conduite" ? centre : radars[Number(noeud.slice(6))];
}

/** Rendre les liaisons fixes (entre nœuds au sol) avec leur distance, leur portée et leur état ; `hs` : éléments en panne. */
function liaisons_fixes(reseau, radars, hs) {
  return reseau.liaisons.map((liaison, k) => ({...liaison, k})).filter((l) => !est_avion(l.de) && !est_avion(l.vers)).map((liaison) => {
    const [a, b] = [position_fixe(liaison.de, reseau.centre, radars), position_fixe(liaison.vers, reseau.centre, radars)];
    if (!a || !b) return {...liaison, distance: null, portee: 0, active: false};
    if (hs.has(`liaison:${liaison.k}`) || hs.has(liaison.de) || hs.has(liaison.vers)) return {...liaison, distance: inverse(a, b).distance, portee: 0, active: false, en_panne: true};
    const distance = inverse(a, b).distance;
    const portee = portee_liaison(liaison.moyen, liaison.moyen.hauteur_antenne, liaison.moyen.hauteur_antenne);
    return {...liaison, distance, portee, active: distance <= portee};
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
  const commun = {centre: reseau.centre, radars, ecefRadars, hs, conduite_hs, simple: reseau.mode === "complet" && hs.size === 0};
  if (reseau.mode === "complet") {
    const latences_radars = radars.map((_, i) => (conduite_hs || hs.has(`radar:${i}`) ? Infinity : 0));
    return {...commun, mode: "complet", latences_radars, radars_hs: radars.map((_, i) => hs.has(`radar:${i}`)), fixes: [], acces: []};
  }
  const fixes = liaisons_fixes(reseau, radars, hs);
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
    const portee = portee_liaison(acces.moyen, acces.moyen.hauteur_antenne, avion.geo.alt);
    if (inverse(acces.position, avion.geo).distance <= portee && (!retenu || acces.latence < retenu.latence)) retenu = acces;
  }
  return retenu;
}

/**
 * Rendre les indices des radars en état qui voient `drone` : ceux que l'algorithme désigne, sinon le plus proche des
 * radars en état s'il est vu (couverture frontière : la frontière est jalonnée par les radars, MODELE § 15.1).
 */
export function radars_voyants(detection, couverture, reseau, drone, outils) {
  if (detection.detecte_par) return detection.detecte_par(couverture, drone, outils).filter((i) => !reseau.radars_hs[i]);
  if (!detection.detecte(couverture, drone, outils)) return [];
  let [indice, meilleure] = [-1, Infinity];
  reseau.ecefRadars.forEach((ecef, i) => {
    if (reseau.radars_hs[i]) return;
    const d = distance_oblique(ecef, drone.ecef);
    if (d < meilleure) [indice, meilleure] = [i, d];
  });
  return indice < 0 ? [] : [indice];
}
