// Allocation des avions par densité des pistes et interception analytique (MODELE § 8.3 et § 9.4).

export const meta = {
  role: "allocation",
  nom: "Densité des pistes, interception analytique",
  fidelite: "notionnel",
  description: "Chaque avion libre est envoyé au point d'interception le plus rentable : effectif de la piste divisé par les avions déjà envoyés au même endroit. L'interception est le plus petit délai où l'avion, en ligne droite, arrive à portée de la piste extrapolée.",
  equations: ["|D + V t|² = (v t + r)², D = cible − avion (ECEF)", "score = effectif / (1 + avions déjà affectés à la cellule du point)"],
  hypotheses: ["Extrapolation rectiligne des pistes, ignorante de leur destination", "Horizon d'interception de 15 min", "Affectation gloutonne, avion par avion"],
  domaine_validite: "Pistes à vitesse constante sur la durée de mise à poste.",
  references: ["Égide, docs/MODELE.md § 8.3 et § 9.4"],
  parametres: {
    vitesse_mise_a_poste: {unite: "m/s", aide: "Vitesse de ralliement de l'avion."},
    altitude: {unite: "m", aide: "Altitude du groupe."},
  },
};

const CELLULE = 5_000;
// Au-delà de 15 min, l'extrapolation rectiligne d'une piste ne vaut plus rien.
const HORIZON_INTERCEPTION = 900;
const cle = (p) => `${Math.floor(p.x / CELLULE)},${Math.floor(p.y / CELLULE)},${Math.floor(p.z / CELLULE)}`;

/**
 * Rendre le plus petit délai t ≥ 0 (s) tel qu'un avion parti de `position` à `vitesseAvion` soit à moins de `portee`
 * de la position extrapolée en ligne droite de `cible` ({position, vitesse} en ECEF), ou null.
 */
export function delai_interception(position, cible, vitesseAvion, portee, outils) {
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
  // a > 0 (drone plus rapide) : la condition tient entre les racines ; a < 0 : au-delà de la plus grande.
  const delai = a > 0 ? Math.min(...racines) : Math.max(...racines);
  return delai >= 0 ? delai : null;
}

// Alternatives gardées pour l'explication : les trois meilleures suffisent à comprendre un choix.
const ALTERNATIVES = 3;

function meilleure_interception(avion, pistes, affectes, outils) {
  const {vitesse_mise_a_poste: vitesse, arme, altitude} = avion.groupe;
  let meilleur = null;
  const candidats = [];
  for (const piste of pistes) {
    const cible = {position: piste.drone.ecef, vitesse: piste.drone.vitesse};
    const delai = delai_interception(avion.ecef, cible, vitesse, arme.portee, outils);
    if (delai === null || delai > HORIZON_INTERCEPTION) continue;
    const extrapole = outils.ajouter(piste.drone.ecef, piste.drone.vitesse, delai);
    const deja = affectes.get(cle(extrapole)) ?? 0;
    const score = piste.effectif / (1 + deja);
    candidats.push({score, delai, effectif: piste.effectif, deja_affectes: deja});
    if (!meilleur || score > meilleur.score || (score === meilleur.score && delai < meilleur.delai)) {
      // La droite ECEF passe sous la surface (≈ d²/8R) : seul le point au sol compte, l'avion garde son altitude.
      meilleur = {point: {...outils.depuis_ecef(extrapole), alt: altitude}, cle: cle(extrapole), delai, score, effectif: piste.effectif, deja_affectes: deja};
    }
  }
  return {meilleur, candidats, pistes: pistes.length};
}

function expliquer(choix) {
  const {meilleur, candidats, pistes} = choix;
  const autres = candidats.filter((c) => c.score !== meilleur?.score || c.delai !== meilleur?.delai)
    .sort((a, b) => b.score - a.score || a.delai - b.delai).slice(0, ALTERNATIVES);
  return {
    pistes_connues: pistes,
    pistes_atteignables: candidats.length,
    retenue: meilleur && {score: meilleur.score, delai: meilleur.delai, effectif: meilleur.effectif, deja_affectes: meilleur.deja_affectes},
    alternatives: autres,
  };
}

/**
 * Rendre, pour chaque avion libre et dans leur ordre, {avion, point, explication} : son point de mise à poste (ou
 * null) et de quoi comprendre le choix — pistes connues et atteignables, piste retenue, meilleures alternatives.
 */
export function allouer(avions, pistes, outils) {
  const affectes = new Map();
  return avions.map((avion) => {
    const choix = meilleure_interception(avion, pistes, affectes, outils);
    const explication = expliquer(choix);
    if (!choix.meilleur) return {avion, point: null, explication};
    affectes.set(choix.meilleur.cle, (affectes.get(choix.meilleur.cle) ?? 0) + 1);
    return {avion, point: choix.meilleur.point, explication};
  });
}
