// Essaim adaptatif : l'essaim apprend de ses pertes, se réaffecte, contourne et esquive (MODELE § 22).
// Aucun import : géodésie en argument ; aucun tirage : la réaction ne consomme pas le hasard du monde.

export const meta = {
  role: "reaction",
  nom: "Essaim adaptatif (pertes partagées)",
  fidelite: "notionnel",
  description: "Chaque drone apprend par le réseau maillé de l'essaim où ses semblables tombent et où ils frappent : il quitte une cible qui tue pour une cible qui laisse passer, contourne les foyers de pertes sur sa route et manœuvre quand une roquette le vise.",
  equations: [
    "ŝ_k = (F_k + 1) / (F_k + P_k + 2) (succession de Laplace)",
    "réaffectation si F_k ≥ 1, ŝ_k − ŝ_c ≥ g et d_k ≤ (1 + a) d_c",
    "y = R asin(sin(d_f / R) sin(α_f − α_w)) ; x = R acos(cos(d_f / R) / cos(y / R))",
    "détour : azimut α_f ∓ asin(ρ / d_f), distance √(d_f² − ρ²), ρ = 1,3 r_d",
    "Pk esquivé = Pk (1 − e) ; progression × (1 − v_e) pendant le vol de la roquette",
    "absorption apprise K̂ = moyenne de P_k sur les cibles frappées ; quota q_k = ⌈(N − F_k + A_k) × 1,5⌉",
  ],
  hypotheses: [
    "Réseau maillé connexe : toute perte et toute frappe sont connues de tout l'essaim après un délai",
    "L'essaim ne voit pas la défense, il n'apprend que par ses pertes",
    "Seuls les foyers autour d'une autre cible (sites défendus fixes) sont contournés",
    "Une cible détruite (F_k ≥ N, MODELE § 23) est rayée : ses drones se reportent sans condition",
    "L'essaim connaît N et ses propres drones en route ; les postes de toutes les cibles absorbent à peu près autant de drones",
    "Approximation sphérique (R = 6 371 km) pour la seule décision de contournement",
    "Esquive agrégée : Pk réduit, sans loi de guidage ni de manœuvre",
  ],
  domaine_validite: "Raids où les pertes se concentrent en quelques foyers (postes sur les cibles, orbites d'avions) ; décisions à l'échelle de la dizaine de kilomètres.",
  references: ["Égide, docs/MODELE.md § 22", "Laplace, Essai philosophique sur les probabilités (1814), règle de succession"],
  parametres: {
    reaction_delai: {unite: "s", aide: "Délai de diffusion d'une perte ou d'une frappe dans l'essaim (rouge.reaction_delai_s)."},
    reaction_pas: {unite: "s", aide: "Période des décisions de réaction (rouge.reaction_pas_s)."},
    reaction_rayon_danger: {unite: "m", aide: "Rayon d'un foyer de pertes (rouge.reaction_rayon_danger_km)."},
    reaction_seuil_pertes: {unite: "", aide: "Pertes à partir desquelles un foyer est tenu pour défendu (rouge.reaction_seuil_pertes)."},
    reaction_allongement_max: {unite: "", aide: "Allongement relatif accepté pour une réaffectation ou un détour (rouge.reaction_allongement_max)."},
    reaction_seuil_gain: {unite: "", aide: "Gain de survie estimée qui déclenche une réaffectation (rouge.reaction_seuil_gain)."},
    reaction_reaffectations_max: {unite: "", aide: "Réaffectations au plus par drone (rouge.reaction_reaffectations_max)."},
    reaction_detours_max: {unite: "", aide: "Détours au plus par drone (rouge.reaction_detours_max)."},
    reaction_esquive_reduction: {unite: "", aide: "Fraction du Pk air retirée par l'esquive (rouge.reaction_esquive_reduction)."},
    reaction_esquive_perte_vitesse: {unite: "", aide: "Fraction de progression perdue pendant l'esquive (rouge.reaction_esquive_perte_vitesse)."},
  },
};

// Rayon de la sphère locale de décision (MODELE § 22.3) : l'écart à l'ellipsoïde est sans effet à 10 km près.
const RAYON_TERRE = 6_371_000;
// Marge des quotas de saturation : ce que l'essaim ignore des cibles neuves et ses pertes en route (MODELE § 23.1).
const MARGE_CIBLE_NEUVE = 1.5;
// Le détour passe à 1,3 r_d du centre du foyer : la branche suivante ne recoupe pas le cercle d'alerte.
const MARGE_DETOUR = 1.3;

/** Rendre la survie estimée au terminal de chaque cible : (F + 1) / (F + P + 2) (MODELE § 22.1). */
export const survies = (bilans) => bilans.map(({frappes, pertes}) => (frappes + 1) / (frappes + pertes + 2));

/** Rendre l'indice de la cible vers laquelle se réaffecter, ou null (MODELE § 22.2). */
/** Rendre vrai si l'essaim sait la cible `k` détruite : F_k ≥ N (MODELE § 23). */
export const est_detruite = (contexte, k) => contexte.frappes_destruction != null && contexte.bilans[k].frappes >= contexte.frappes_destruction;

/** Rendre la cible non détruite de meilleure survie estimée, la plus proche à survie égale, ou null (MODELE § 23). */
function cible_de_repli(contexte, distances, survie) {
  let retenue = null;
  distances.forEach((distance, k) => {
    if (est_detruite(contexte, k)) return;
    if (retenue === null || survie[k] > survie[retenue] || (survie[k] === survie[retenue] && distance < distances[retenue])) retenue = k;
  });
  return retenue;
}

function meilleure_cible(contexte, drone, outils) {
  const {reglages: r, cibles} = contexte;
  const survie = survies(contexte.bilans);
  const distances = cibles.map((cible) => outils.inverse(drone.geo, cible).distance);
  // Sa cible est détruite : il se reporte, même engagé et sans compter ses réaffectations.
  if (est_detruite(contexte, drone.cible)) {
    const repli = cible_de_repli(contexte, distances, survie);
    return repli === null ? null : {cible: repli, motif: "detruite"};
  }
  if (drone.reaffectations >= r.reaction_reaffectations_max) return null;
  const actuelle = distances[drone.cible];
  // Engagé sur sa cible : il n'en change plus.
  if (actuelle <= r.reaction_rayon_danger) return null;
  let retenue = null;
  let meilleure = survie[drone.cible] + r.reaction_seuil_gain;
  distances.forEach((distance, k) => {
    // Brèche avérée seulement : une cible encore jamais frappée n'est pas réputée ouverte ; une détruite ne vaut rien.
    if (k === drone.cible || contexte.bilans[k].frappes === 0 || est_detruite(contexte, k)) return;
    if (distance > (1 + r.reaction_allongement_max) * actuelle) return;
    if (survie[k] >= meilleure) [retenue, meilleure] = [k, survie[k]];
  });
  return retenue === null ? null : {cible: retenue, motif: "breche"};
}

/** Rendre {x, y} (m) : abscisse le long de la branche d'azimut `azimut` et écart latéral (> 0 à droite) d'un point. */
function projeter(distance, azimutPoint, azimut) {
  const ecart = azimutPoint - azimut;
  const y = RAYON_TERRE * Math.asin(Math.sin(distance / RAYON_TERRE) * Math.sin(ecart));
  const x = RAYON_TERRE * Math.acos(Math.min(1, Math.cos(distance / RAYON_TERRE) / Math.cos(y / RAYON_TERRE)));
  return {x: Math.cos(ecart) > 0 ? x : -x, y};
}

/** Rendre le foyer défendu le plus proche sur la branche en cours, hors foyers de sa propre cible, ou null. */
function foyer_sur_le_chemin(contexte, drone, branche, outils) {
  const {reglages: r, foyers, cibles} = contexte;
  let retenu = null;
  for (const [indice, foyer] of foyers.entries()) {
    if (foyer.pertes < r.reaction_seuil_pertes) continue;
    // Seuls les sites défendus fixes valent un détour : les pertes dues aux avions suivent des avions qui bougent.
    const sites = cibles.flatMap((cible, k) => (outils.inverse(foyer.geo, cible).distance <= r.reaction_rayon_danger ? [k] : []));
    if (sites.length === 0 || sites.includes(drone.cible)) continue;
    const {distance, azimut_depart: azimut} = outils.inverse(drone.geo, foyer.geo);
    // Déjà dans le foyer : trop tard pour le contourner.
    if (distance <= r.reaction_rayon_danger) continue;
    const {x, y} = projeter(distance, azimut, branche.azimut_depart);
    if (x <= 0 || x >= branche.distance || Math.abs(y) >= r.reaction_rayon_danger) continue;
    if (!retenu || distance < retenu.distance) retenu = {indice, distance, azimut, y};
  }
  return retenu;
}

/** Rendre le point de détour autour de `foyer` (tangente au cercle ρ), ou null s'il allonge trop la branche. */
function point_de_detour(contexte, drone, branche, foyer, but, outils) {
  const rho = MARGE_DETOUR * contexte.reglages.reaction_rayon_danger;
  // Foyer à droite de la branche (y > 0) : on passe à gauche, et inversement.
  const azimut = foyer.azimut + (foyer.y > 0 ? -1 : 1) * Math.asin(Math.min(1, rho / foyer.distance));
  const point = outils.direct(drone.geo, azimut, Math.sqrt(Math.max(foyer.distance ** 2 - rho ** 2, 0)));
  const allonge = outils.inverse(drone.geo, point).distance + outils.inverse(point, but).distance - branche.distance;
  return allonge > contexte.reglages.reaction_allongement_max * branche.distance ? null : point;
}

/**
 * Rendre la réaction d'un drone, ou null : {cible} pour une réaffectation, {detour, foyer} pour un point de détour
 * à insérer avant le prochain point de route. `contexte` : {reglages (rouge, SI), cibles [geo], foyers
 * [{geo, pertes}], bilans [{pertes, frappes}] par cible, frappes_destruction (N, ou null)} ; `drone` : {geo, cible, route [geo], reaffectations, detours}. Une réaffectation porte son motif :
 * "breche" (cible plus sûre déjà frappée) ou "detruite" (sa cible est détruite, MODELE § 23).
 */
export function reagir(contexte, drone, outils) {
  const choix = meilleure_cible(contexte, drone, outils);
  if (choix !== null) return choix;
  if (drone.detours >= contexte.reglages.reaction_detours_max || drone.route.length === 0) return null;
  const but = drone.route[0];
  const branche = outils.inverse(drone.geo, but);
  const foyer = foyer_sur_le_chemin(contexte, drone, branche, outils);
  if (!foyer) return null;
  const detour = point_de_detour(contexte, drone, branche, foyer, but, outils);
  return detour ? {detour, foyer: foyer.indice} : null;
}

/** Rendre l'absorption apprise K̂ : drones abattus en moyenne près d'une cible déjà frappée, ou null sans brèche. */
function absorption_apprise(bilans) {
  const percees = bilans.filter((b) => b.frappes > 0);
  if (!percees.length) return null;
  return percees.reduce((s, b) => s + b.pertes, 0) / percees.length;
}

/** Rendre le quota de drones de chaque cible (MODELE § 23.1) : 0 si détruite, ⌈(N − F_k + K) × marge⌉ sinon. */
function quotas_saturation(contexte, seuil, absorption) {
  return contexte.bilans.map(({frappes, pertes}, k) => {
    if (frappes >= seuil) return 0;
    // Cible percée : il reste ce qui manque, ses postes ont déjà tiré ; cible neuve : ses postes absorberont K̂.
    const absorbe = frappes > 0 ? Math.max(0, absorption - pertes) : absorption;
    return Math.ceil((seuil - frappes + absorbe) * MARGE_CIBLE_NEUVE);
  });
}

/**
 * Rendre les réaffectations qui évitent la saturation (MODELE § 23.1) : [{index, cible, motif: "saturation"}], où
 * `index` désigne un drone de `drones` (tous ceux de l'essaim pas encore arrivés). Tant qu'aucune cible n'est percée,
 * l'essaim garde sa masse. Ensuite, chaque cible garde ses q_k drones les plus proches ; le surplus comble d'abord les
 * cibles visées en manque, puis part en blocs complets vers les cibles jamais visées où l'essaim a le moins perdu.
 */
export function repartir(contexte, drones, outils) {
  const seuil = contexte.frappes_destruction;
  if (seuil == null) return [];
  const absorption = absorption_apprise(contexte.bilans);
  // Étaler l'essaim à l'aveugle lui ôte la masse qui sature les postes (mesuré : 69 frappes au lieu de 120, raid
  // direct, N = 30) : rien ne bouge avant la première brèche.
  if (absorption === null) return [];
  const quotas = quotas_saturation(contexte, seuil, absorption);
  const distance = (drone, k) => outils.inverse(drone.geo, contexte.cibles[k]).distance;
  const parCible = contexte.cibles.map(() => []);
  drones.forEach((drone, index) => parCible[drone.cible].push({index, d: distance(drone, drone.cible)}));
  const places = quotas.map((q, k) => q - parCible[k].length);
  let surplus = [];
  parCible.forEach((liste, k) => {
    if (places[k] >= 0) return;
    liste.sort((a, b) => a.d - b.d);
    surplus.push(...liste.slice(quotas[k]).map(({index}) => index));
  });
  const choix = [];
  const envoyer = (index, k) => {
    places[k]--;
    places[drones[index].cible]++;
    choix.push({index, cible: k, motif: "saturation"});
  };
  // Cibles en manque, de la plus pleine à la plus vide : chacune prend les drones en surplus les plus proches d'elle.
  const enManque = places.map((p, k) => k).filter((k) => places[k] > 0 && parCible[k].length > 0).sort((a, b) => places[a] - places[b]);
  const cibles = [...enManque, ...cibles_neuves(contexte, places, parCible)];
  for (const k of cibles) {
    if (!surplus.length) break;
    // Un bloc neuf trop petit pour saturer les postes se ferait abattre : on ne l'envoie qu'au complet.
    if (parCible[k].length === 0 && surplus.length < places[k]) break;
    surplus.sort((a, b) => distance(drones[a], k) - distance(drones[b], k));
    const pris = surplus.slice(0, places[k]);
    surplus = surplus.slice(places[k]);
    for (const index of pris) envoyer(index, k);
  }
  return choix;
}

/** Rendre les cibles neuves (jamais visées, ni frappées, ni détruites), de celle où l'essaim a le moins perdu à la plus coûteuse. */
function cibles_neuves(contexte, places, parCible) {
  return contexte.cibles.map((_, k) => k)
    .filter((k) => parCible[k].length === 0 && contexte.bilans[k].frappes === 0 && places[k] > 0)
    .sort((a, b) => contexte.bilans[a].pertes - contexte.bilans[b].pertes || a - b);
}

/** Rendre l'effet de l'esquive d'un drone visé par un tir air : {reduction du Pk, perte de progression} (§ 22.4). */
export const esquive = (reglages) => ({reduction: reglages.reaction_esquive_reduction, perte_vitesse: reglages.reaction_esquive_perte_vitesse});
