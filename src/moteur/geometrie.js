// Formules fermées du modèle d'Égide, en unités SI (m, s, m/s). Jumeau de analyse/geometrie.py :
// tests/references.json vérifie que les deux rendent les mêmes valeurs. Chaque fonction cite docs/MODELE.md.

export const G = 9.80665;
// Rayon terrestre effectif (facteur 4/3) : la réfraction standard courbe les ondes vers le sol.
export const RAYON_TERRESTRE_EFFECTIF = (4 / 3) * 6_371_000;

/** Rendre le rayon de virage en palier, en m (MODELE § 3.1). vitesse en m/s, facteurCharge en g (> 1). */
export function rayon_virage(vitesse, facteurCharge) {
  return vitesse ** 2 / (G * Math.sqrt(facteurCharge ** 2 - 1));
}

/** Rendre la portée géométrique de détection limitée par l'horizon, en m (MODELE § 2). */
export function horizon_radar(hauteurAntenne, altitudeCible) {
  return Math.sqrt(2 * RAYON_TERRESTRE_EFFECTIF) * (Math.sqrt(hauteurAntenne) + Math.sqrt(altitudeCible));
}

/** Rendre le temps laissé aux avions pour se mettre à poste, en s (MODELE § 3.2). */
export function delai_disponible(distanceDetection, profondeur, vitesseDrone, delaiReaction) {
  return (distanceDetection + profondeur) / vitesseDrone - delaiReaction;
}

/** Rendre le nombre moyen d'avions pouvant atteindre un point de la zone (MODELE § 3.4). */
export function avions_concentrables(nombreAvions, porteeMiseAPoste, rayonZone) {
  return nombreAvions * Math.min(1, (porteeMiseAPoste / rayonZone) ** 2);
}

/**
 * Rendre la vitesse de mise à poste garantissant `avionsVoulus` sur toute route, en m/s (MODELE § 3.5).
 * Infinity si l'on demande plus d'avions qu'il n'y en a, 0 si la portée de l'arme suffit seule.
 */
export function vitesse_minimale(nombreAvions, avionsVoulus, rayonZone, porteeArme, delai) {
  if (avionsVoulus > nombreAvions) return Infinity;
  return Math.max(0, (rayonZone * Math.sqrt(avionsVoulus / nombreAvions) - porteeArme) / delai);
}

/** Rendre le nombre de postes sol nécessaires pour défendre une cible seule (MODELE § 5). */
export function postes_sol_par_cible(dronesSurCible, probabiliteDestruction, engagementsParPassage) {
  return Math.ceil(dronesSurCible / (probabiliteDestruction * engagementsParPassage));
}

/** Rendre la durée pendant laquelle un drone reste à portée lors d'un passage face à face, en s (MODELE § 4.1). */
export function fenetre_tir(porteeArme, vitesseDrone, vitesseAvion) {
  return (2 * porteeArme) / (vitesseDrone + vitesseAvion);
}

/** Rendre le nombre de tirs utiles d'un avion pendant un passage (MODELE § 4.2). */
export function tirs_par_passage(fenetre, emport, intervalleEntreTirs) {
  return Math.min(emport, Math.floor(fenetre / intervalleEntreTirs));
}
