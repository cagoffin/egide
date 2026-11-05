// Allocation adaptative : la conduite lit la destination des pistes et l'état de ses cibles, et suit l'essaim là où
// il se reporte (MODELE § 23). Même interception analytique que densite_pistes (MODELE § 9.4), autre priorité.

export const meta = {
  role: "allocation",
  nom: "Conduite adaptative (destination, brèches, barrière)",
  fidelite: "notionnel",
  description: "La conduite prédit la cible de chaque piste d'après son cap, n'envoie un avion que s'il intercepte avant l'impact, donne la priorité aux pistes qui visent une cible déjà frappée ou à court de munitions sol, et place les avions sans interception possible en barrière devant les cibles les plus menacées.",
  equations: [
    "cible prédite k* = argmax cos θ_k, cos θ_k = (T_k − P)·V / (|T_k − P| |V|), si θ_k ≤ 20°",
    "délai d'interception t (|D + V t| = v t + r) ≤ min(15 min, |T_k* − P| / |V|)",
    "score = effectif × (1 + w b_k*) / (1 + avions déjà affectés à la cellule du point), b_k = 1 si brèche",
    "brèche : F_k ≥ 1 ou munitions sol restantes < 20 % du stock initial de la cible",
    "barrière : point à 12 km de la cible la plus menacée, vers la piste la plus nombreuse qui la vise",
  ],
  hypotheses: [
    "Extrapolation rectiligne des pistes ; la cible prédite est celle que vise le cap actuel",
    "La conduite connaît sans délai les frappes reçues et les munitions de ses postes (forces propres)",
    "Au plus 3 avions en barrière par cible",
    "Affectation gloutonne, avion par avion",
  ],
  domaine_validite: "Essaims qui se reportent sur des cibles (réactifs) ou concentrés par groupes ; pistes à vitesse constante sur la durée de mise à poste.",
  references: ["Égide, docs/MODELE.md § 23", "Égide, docs/MODELE.md § 9.4 (interception analytique)"],
  parametres: {
    vitesse_mise_a_poste: {unite: "m/s", aide: "Vitesse de ralliement de l'avion."},
    altitude: {unite: "m", aide: "Altitude du groupe."},
  },
};

const CELLULE = 5_000;
// Au-delà de 15 min, l'extrapolation rectiligne d'une piste ne vaut plus rien (comme densite_pistes).
const HORIZON_INTERCEPTION = 900;
// Lecture du cap : plus loin que 4 min de vol, un essaim peut encore éclater ou se reporter ; sa route passe par
// sa cible à 3 km près (rayon d'une cible et de ses postes).
const HORIZON_LECTURE = 240;
const ECART_LATERAL_MAX = 3_000;
const LIMITER_A_L_IMPACT = false;
const BARRIERE_EN_REPLI = true;
const DOCTRINE_COMPACITE = true;
// Poids d'une brèche : une piste qui vise une cible déjà frappée compte triple.
const POIDS_BRECHE = 2;
// Une cible dont les postes n'ont plus que 20 % de leur stock va céder : elle est traitée comme une brèche.
const SEUIL_MUNITIONS = 0.2;
// La barrière se tient à 12 km de la cible : 1,5 portée de roquette, hors de la bulle des postes sol (8 km).
const DISTANCE_BARRIERE = 12_000;
// Une barrière ralliée en 5 min vaut 1/e d'une barrière immédiate : un raid fourmi met ~10 min de la frontière aux cibles.
const CONSTANTE_RALLIEMENT = 300;
const ALTERNATIVES = 3;
// Lecture de la formation (MODELE § 23.2) : à 3 drones par piste de 5 km ou plus, l'essaim vole groupé.
const SEUIL_COMPACITE = 3;
// Une interception à moins d'une minute l'emporte sur la barrière : l'avion est déjà sur le flux.
const DELAI_IMMINENT = 60;

/** Rendre la compacité de l'essaim connu : drones par piste (MODELE § 23.2). */
export const compacite_essaim = (pistes) => (pistes.length ? pistes.reduce((s, p) => s + p.effectif, 0) / pistes.length : 0);
const cle = (p) => `${Math.floor(p.x / CELLULE)},${Math.floor(p.y / CELLULE)},${Math.floor(p.z / CELLULE)}`;

/**
 * Rendre le plus petit délai t ≥ 0 (s) où un avion parti de `position` à `vitesseAvion` est à moins de `portee` de
 * `cible` ({position, vitesse} ECEF) extrapolée en ligne droite, ou null (MODELE § 9.4). Copie de celui de
 * densite_pistes : un algorithme n'importe rien ; à la troisième copie, il ira dans les outils.
 */
function delai_interception(position, cible, vitesseAvion, portee, outils) {
  const D = outils.soustraire(cible.position, position);
  const V = cible.vitesse;
  const c = outils.produit_scalaire(D, D) - portee * portee;
  if (c <= 0) return 0;
  const a = outils.produit_scalaire(V, V) - vitesseAvion ** 2;
  const b = 2 * (outils.produit_scalaire(D, V) - vitesseAvion * portee);
  if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const racines = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
  const delai = a > 0 ? Math.min(...racines) : Math.max(...racines);
  return delai >= 0 ? delai : null;
}

/** Rendre vrai si la cible `c` ({frappes, munitions_sol, munitions_sol_initiales}) est une brèche (MODELE § 23.1). */
export const est_breche = (c) => c.frappes > 0 || (c.munitions_sol_initiales > 0 && c.munitions_sol < SEUIL_MUNITIONS * c.munitions_sol_initiales);

/**
 * Rendre {cible, temps} : l'indice de la cible que vise le cap du drone (ou null) et son temps de vol jusqu'à elle (s).
 * Le cap ne désigne une cible que de près (moins de 4 min de vol) et à moins de 3 km d'écart latéral (MODELE § 23.1).
 */
export function cible_predite(drone, cibles, outils) {
  const vitesse = Math.hypot(drone.vitesse.x, drone.vitesse.y, drone.vitesse.z);
  if (vitesse === 0) return {cible: null, temps: Infinity};
  let meilleure = {cible: null, temps: Infinity, ecart: ECART_LATERAL_MAX};
  cibles.forEach((c, k) => {
    const D = outils.soustraire(c.ecef, drone.ecef);
    const distance = Math.hypot(D.x, D.y, D.z);
    const avance = outils.produit_scalaire(D, drone.vitesse) / vitesse;
    const ecart = Math.sqrt(Math.max(distance ** 2 - avance ** 2, 0));
    if (avance > 0 && avance / vitesse <= HORIZON_LECTURE && ecart <= meilleure.ecart) meilleure = {cible: k, temps: avance / vitesse, ecart};
  });
  return {cible: meilleure.cible, temps: meilleure.temps};
}

/** Rendre les pistes enrichies de leur cible prédite, de leur temps avant impact et de leur poids de menace. */
function lire_pistes(pistes, situation, outils) {
  return pistes.map((piste) => {
    const {cible, temps} = cible_predite(piste.drone, situation.cibles, outils);
    const breche = cible !== null && est_breche(situation.cibles[cible]);
    return {...piste, cible, temps, breche, menace: 1 + (breche ? POIDS_BRECHE : 0)};
  });
}

function meilleure_interception(avion, pistes, affectes, outils) {
  const {vitesse_mise_a_poste: vitesse, arme, altitude} = avion.groupe;
  let meilleur = null;
  const candidats = [];
  for (const piste of pistes) {
    const cible = {position: piste.drone.ecef, vitesse: piste.drone.vitesse};
    const delai = delai_interception(avion.ecef, cible, vitesse, arme.portee, outils);
    if (delai === null || delai > HORIZON_INTERCEPTION || (LIMITER_A_L_IMPACT && delai > piste.temps)) continue;
    const extrapole = outils.ajouter(piste.drone.ecef, piste.drone.vitesse, delai);
    const deja = affectes.get(cle(extrapole)) ?? 0;
    const score = (piste.effectif * piste.menace) / (1 + deja);
    const resume = {score, delai, effectif: piste.effectif, deja_affectes: deja, menace: piste.menace, cible: piste.cible, breche: piste.breche};
    candidats.push(resume);
    if (!meilleur || score > meilleur.score || (score === meilleur.score && delai < meilleur.delai)) {
      // La droite ECEF passe sous la surface (≈ d²/8R) : seul le point au sol compte, l'avion garde son altitude.
      meilleur = {...resume, point: {...outils.depuis_ecef(extrapole), alt: altitude}, cle: cle(extrapole)};
    }
  }
  return {meilleur, candidats};
}

/**
 * Rendre, par cible, le poids des drones qui la menacent (MODELE § 23.3) : les pistes dont le cap la vise, plus la part
 * égale des pistes dont la cible n'est pas encore lisible ; chaque drone compte (1 + w b_k). Et la piste la plus nombreuse
 * qui la vise, pour orienter la barrière.
 */
function menaces_par_cible(pistes, situation) {
  const menaces = situation.cibles.map((c) => ({poids: 0, piste: null, facteur: 1 + (est_breche(c) ? POIDS_BRECHE : 0)}));
  const illisibles = pistes.filter((p) => p.cible === null).reduce((s, p) => s + p.effectif, 0) / Math.max(1, menaces.length);
  for (const piste of pistes) {
    if (piste.cible === null) continue;
    const m = menaces[piste.cible];
    m.poids += piste.effectif * m.facteur;
    if (!m.piste || piste.effectif > m.piste.effectif) m.piste = piste;
  }
  for (const m of menaces) m.poids += illisibles * m.facteur;
  return menaces;
}

/**
 * Rendre la meilleure barrière pour `avion` (MODELE § 23.3), ou null : un point à 12 km de la cible k, sur l'axe de la
 * piste la plus nombreuse qui la vise (vers l'avion si aucune). Score = poids_k / (1 + avions déjà placés sur k)
 * × exp(−t / τ), t le temps de ralliement de l'avion : une barrière lointaine arrive trop tard.
 */
function meilleure_barriere(avion, menaces, enBarriere, situation, outils) {
  let retenue = null;
  menaces.forEach((m, k) => {
    if (m.poids <= 0) return;
    const cible = situation.cibles[k];
    const vers = m.piste ? m.piste.drone.geo : avion.geo;
    const point = {...outils.direct(cible.geo, outils.inverse(cible.geo, vers).azimut_depart, DISTANCE_BARRIERE), alt: avion.groupe.altitude};
    const temps = outils.inverse(avion.geo, point).distance / avion.groupe.vitesse_mise_a_poste;
    const score = (m.poids / (1 + (enBarriere[k] ?? 0))) * Math.exp(-temps / CONSTANTE_RALLIEMENT);
    if (!retenue || score > retenue.score) retenue = {point, cible: k, score, poids: m.poids, temps, deja_affectes: enBarriere[k] ?? 0, breche: est_breche(cible)};
  });
  return retenue;
}

function expliquer(choix, pistesConnues, garde) {
  const {meilleur, candidats} = choix;
  const autres = candidats.filter((c) => c !== meilleur && (c.score !== meilleur?.score || c.delai !== meilleur?.delai))
    .sort((a, b) => b.score - a.score || a.delai - b.delai).slice(0, ALTERNATIVES);
  const retenue = meilleur && {score: meilleur.score, delai: meilleur.delai, effectif: meilleur.effectif, deja_affectes: meilleur.deja_affectes,
    menace: meilleur.menace, cible: meilleur.cible, breche: meilleur.breche};
  return {pistes_connues: pistesConnues, pistes_atteignables: candidats.length, retenue, alternatives: autres, barriere: garde};
}

/**
 * Rendre, pour chaque avion libre et dans leur ordre, {avion, point, explication}. `situation` : {cibles
 * [{geo, ecef, frappes, munitions_sol, munitions_sol_initiales}]}, l'état des cibles que la conduite défend.
 */
export function allouer(avions, pistes, outils, situation) {
  const lues = lire_pistes(pistes, situation, outils);
  const menaces = menaces_par_cible(lues, situation);
  const compacite = compacite_essaim(pistes);
  const groupe = compacite >= SEUIL_COMPACITE;
  const affectes = new Map();
  const enBarriere = [];
  return avions.map((avion) => {
    const choix = meilleure_interception(avion, lues, affectes, outils);
    // Essaim groupé : barrière devant les cibles, sauf interception imminente ; essaim éparpillé : interception libre.
    const enRepli = BARRIERE_EN_REPLI && !choix.meilleur;
    const garde = (DOCTRINE_COMPACITE && groupe) || enRepli ? meilleure_barriere(avion, menaces, enBarriere, situation, outils) : null;
    const imminente = choix.meilleur && choix.meilleur.delai <= DELAI_IMMINENT;
    const doctrine = {compacite, groupe};
    if (garde && !imminente) {
      enBarriere[garde.cible] = (enBarriere[garde.cible] ?? 0) + 1;
      const {point, ...resume} = garde;
      return {avion, point, explication: {...expliquer(choix, pistes.length, resume), doctrine}};
    }
    if (!choix.meilleur) return {avion, point: null, explication: {...expliquer(choix, pistes.length, null), doctrine}};
    affectes.set(choix.meilleur.cle, (affectes.get(choix.meilleur.cle) ?? 0) + 1);
    return {avion, point: choix.meilleur.point, explication: {...expliquer(choix, pistes.length, null), doctrine}};
  });
}
