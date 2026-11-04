// Auto-configuration (MODELE § 20) : à partir des menaces à considérer, des moyens disponibles et d'une zone,
// construire un scénario qui place radars, centres, cibles, avions et drones défensifs, puis chercher par
// simulation la répartition qui minimise les frappes. Partie pure : Node (src/autoconfig.js) et Worker du navigateur.
import {bilans_campagne} from "./campagne.js";
import {direct, inverse, vers_degres} from "./geodesie.js";
import {creer_hasard} from "./hasard.js";
import {comparer_apparies} from "./preuve.js";
import {portee_radar} from "./radars.js";
import {en_v2, modifier_scenario, resoudre_scenario} from "./scenario.js";
import {centre_zone, dans_zone, echantillonner_contour, points_repartis, rayon_circonscrit, sommets, zone_preparee} from "./zone.js";

/** Valeurs essayées pour chaque paramètre de répartition (fractions, voir construire()). */
export const PARAMETRES = {avions: [0.35, 0.6, 0.85], drones: [0.1, 0.5], radars: [0, 0.5]};

/** Répartition de départ de la recherche. */
export const DEPART = {avions: 0.6, drones: 0.1, radars: 0};

/** La répartition de référence : orbites et drones tirés au hasard sur le disque, radars sur le contour. */
export const UNIFORME = {uniforme: true, radars: 0};

const en_deg = (g) => ({lat_deg: Math.round(vers_degres(g.lat) * 1e6) / 1e6, lon_deg: Math.round(vers_degres(g.lon) * 1e6) / 1e6});

/** Rendre la géométrie de la zone de la demande : sommets, centre, rayon circonscrit, contour échantillonnable. */
export function geometrie(demande) {
  const geos = sommets(demande.zone.points);
  const centre = centre_zone(geos);
  return {geos, centre, rayon: rayon_circonscrit(centre, geos), zone: zone_preparee(geos)};
}

/**
 * Rendre les positions fixes de la configuration, qui ne dépendent pas de la stratégie : cibles bien réparties dans
 * la zone, centres (le principal au centre de la zone s'il y est, sinon sur la cible la plus centrale).
 */
export function positions_fixes(demande, g) {
  const {moyens} = demande;
  const cibles = points_repartis(g.geos, moyens.cibles, creer_hasard(demande.graine ?? 7));
  const principal = dans_zone(g.zone, g.centre) ? g.centre : cibles[0];
  const autres = points_repartis(g.geos, Math.max(0, moyens.centres - 1) + 1, creer_hasard((demande.graine ?? 7) + 1)).slice(1);
  return {cibles, principal, autres};
}

/** Rendre les orbites placées des groupes de vecteurs selon la stratégie (null : tirées au hasard par le moteur). */
function orbites(demande, g, fixes, strategie) {
  const {avions} = demande.moyens;
  if (strategie.uniforme) return avions.map(() => null);
  // Avions : sur des rayons du centre vers des points du contour régulièrement espacés, à la fraction `avions`.
  const nAvions = avions.slice(0, 2).reduce((s, n) => s + n, 0);
  const bord = echantillonner_contour(g.geos, Math.max(1, nAvions));
  let k = 0;
  const avionsPlaces = avions.slice(0, 2).map((n) => Array.from({length: n}, () => {
    const p = bord[k++];
    const {distance, azimut_depart: az} = inverse(g.centre, p);
    return en_deg(direct(g.centre, az, strategie.avions * distance));
  }));
  // Drones défensifs : autour des cibles, poussés vers l'extérieur à la fraction `drones` du rayon circonscrit.
  let j = 0;
  const dronesPlaces = avions.slice(2).map((n) => Array.from({length: n}, () => {
    const cible = fixes.cibles[j % fixes.cibles.length];
    const az = inverse(g.centre, cible).azimut_depart + (2 * Math.PI * Math.floor(j / fixes.cibles.length)) / 7;
    j++;
    return en_deg(direct(cible, az, strategie.drones * 0.5 * g.rayon));
  }));
  return [...avionsPlaces, ...dronesPlaces];
}

/**
 * Rendre le scénario construit sur `base` pour la demande et la stratégie : théâtre centré sur la zone, zone
 * protégée, cibles, radars placés sur le contour (poussés vers l'extérieur de la fraction `radars` de leur portée),
 * centres, postes, groupes de vecteurs et leurs orbites. `portee` : portée des radars contre l'essaim (m).
 */
export function construire(base, demande, strategie, portee) {
  const g = geometrie(demande);
  const fixes = positions_fixes(demande, g);
  const {moyens, menaces} = demande;
  const radars = echantillonner_contour(g.geos, moyens.radars).map((p) => {
    const az = inverse(g.centre, p).azimut_depart;
    return en_deg(direct(p, az, strategie.radars * portee));
  });
  const places = orbites(demande, g, fixes, strategie);
  const mods = {
    nom: `Auto-configuration — ${demande.zone.nom}`,
    "theatre.origine_lat_deg": en_deg(g.centre).lat_deg, "theatre.origine_lon_deg": en_deg(g.centre).lon_deg,
    "theatre.zone_rayon_km": Math.ceil(g.rayon / 1000), "theatre.cibles_nombre": moyens.cibles,
    "theatre.cibles_placees": fixes.cibles.map(en_deg),
    "theatre.zones": [{nom: demande.zone.nom, type: "protegee", points: demande.zone.points}],
    "rouge.nombre": menaces[0].nombre, "rouge.tactique": menaces[0].tactique,
    "bleu.radar.disposition": "sites", "bleu.radar.sites": radars,
    "bleu.reseau.centre_lat_deg": en_deg(fixes.principal).lat_deg, "bleu.reseau.centre_lon_deg": en_deg(fixes.principal).lon_deg,
    "bleu.reseau.centres": fixes.autres.map((c, k) => ({nom: `CDC ${k + 2}`, ...en_deg(c)})),
    "bleu.sol.nombre": moyens.postes, "bleu.sol.munitions": moyens.munitions_sol,
  };
  moyens.avions.forEach((n, i) => {
    mods[`bleu.avions.${i}.nombre`] = n;
    mods[`bleu.avions.${i}.orbites_placees`] = places[i] ?? [];
  });
  return modifier_scenario(en_v2(base), mods);
}

/** Rendre les bilans d'un scénario sur toutes les menaces, mêmes graines (nombres aléatoires communs). */
function evaluer(brut, menaces, tirages, fichiers, registre, apres_raid) {
  const bilans = menaces.flatMap((m) => bilans_campagne(modifier_scenario(brut, {"rouge.tactique": m.tactique, "rouge.nombre": m.nombre}), tirages, fichiers, registre, apres_raid));
  return {bilans, frappes: bilans.reduce((s, b) => s + b.fuites, 0) / bilans.length};
}

/**
 * Chercher la meilleure répartition (MODELE § 20.2) : partir de DEPART, essayer tour à tour les valeurs de chaque
 * paramètre (avions, drones s'il y en a, radars) et garder ce qui baisse les frappes moyennes, toutes menaces et
 * graines confondues ; comparer enfin, tirage par tirage, à la répartition uniforme. `progression(fait, total,
 * essai)` suit les essais, `avancement(raids_faits, raids_total)` chaque raid simulé (barre de progression).
 */
export function optimiser(base, demande, {tirages = 4, fichiers, registre, progression = () => {}, avancement = () => {}}) {
  const portee = portee_radar(resoudre_scenario(en_v2(base), fichiers));
  const avecDrones = demande.moyens.avions.slice(2).some((n) => n > 0);
  const essaisPrevus = [UNIFORME, DEPART, ...Object.entries(PARAMETRES).flatMap(([p, valeurs]) => (p === "drones" && !avecDrones ? [] : valeurs.filter((v) => v !== DEPART[p]).map(() => p)))];
  const essais = [];
  const raidsTotal = essaisPrevus.length * demande.menaces.length * tirages;
  let raidsFaits = 0;
  const apres_raid = () => avancement(++raidsFaits, raidsTotal);
  const essayer = (strategie) => {
    const r = {strategie, ...evaluer(construire(base, demande, strategie, portee), demande.menaces, tirages, fichiers, registre, apres_raid)};
    essais.push({strategie, frappes: r.frappes});
    progression(essais.length, essaisPrevus.length, essais.at(-1));
    return r;
  };
  const uniforme = essayer(UNIFORME);
  let meilleur = essayer(DEPART);
  for (const [parametre, valeurs] of Object.entries(PARAMETRES)) {
    if (parametre === "drones" && !avecDrones) continue;
    for (const v of valeurs.filter((x) => x !== DEPART[parametre])) {
      const r = essayer({...meilleur.strategie, [parametre]: v});
      if (r.frappes < meilleur.frappes) meilleur = r;
    }
  }
  return {
    brut: construire(base, demande, meilleur.strategie, portee), strategie: meilleur.strategie, essais,
    uniforme: uniforme.frappes, meilleur: meilleur.frappes,
    comparaison: comparer_apparies(uniforme.bilans, meilleur.bilans).fuites,
  };
}
