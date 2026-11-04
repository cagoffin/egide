// Criblage de sensibilité de Morris (MODELE § 14.4) : classer les réglages d'un scénario par influence sur chaque
// grandeur, en quelques dizaines d'évaluations seulement. Partie pure : Node et navigateur.
import {bilans_campagne, GRANDEURS, resumer_bilans} from "./campagne.js";
import {creer_hasard, melanger} from "./hasard.js";
import {en_v2, modifier_scenario} from "./scenario.js";

/** Rendre le pas de Morris Δ = p / (2(p − 1)) d'une grille à `niveaux` niveaux (p pair). */
export const pas_morris = (niveaux) => niveaux / (2 * (niveaux - 1));

/**
 * Rendre `trajectoires` trajectoires de Morris dans [0, 1]^k : un point de base pris sur la moitié basse de la grille,
 * puis chaque facteur augmenté de Δ à son tour, dans un ordre tiré au hasard. k + 1 points par trajectoire.
 */
export function plan_morris(k, trajectoires, niveaux, graine) {
  if (niveaux % 2 !== 0 || niveaux < 2) throw new Error("Morris : nombre de niveaux pair, au moins 2");
  const hasard = creer_hasard(graine);
  const delta = pas_morris(niveaux);
  return Array.from({length: trajectoires}, () => {
    let point = Array.from({length: k}, () => hasard.entier(niveaux / 2) / (niveaux - 1));
    const ordre = melanger([...Array(k).keys()], hasard);
    const points = [point];
    for (const i of ordre) {
      point = point.map((x, j) => (j === i ? x + delta : x));
      points.push(point);
    }
    return {ordre, points};
  });
}

/** Rendre la valeur réelle du facteur {min, max, entier} à la coordonnée réduite `u` de [0, 1]. */
export function valeur_facteur(facteur, u) {
  const valeur = facteur.min + u * (facteur.max - facteur.min);
  return facteur.entier ? Math.round(valeur) : valeur;
}

/** Rendre les modifications {chemin: valeur} d'un point du plan. */
export const modifications_point = (facteurs, point) => Object.fromEntries(facteurs.map((f, i) => [f.chemin, valeur_facteur(f, point[i])]));

/**
 * Rendre, pour chaque grandeur, les statistiques de Morris de chaque facteur : μ (effet moyen), μ* (moyenne des
 * valeurs absolues, l'influence) et σ (dispersion : non-linéarité ou interactions). Un effet élémentaire est
 * (y(x + Δeᵢ) − y(x)) / Δᵢ, Δᵢ étant le pas réellement fait une fois l'arrondi des facteurs entiers appliqué : il se
 * lit comme la variation de la grandeur quand le facteur parcourt toute sa plage.
 */
export function effets_morris(facteurs, plan, sorties) {
  const effets = facteurs.map(() => Object.fromEntries(GRANDEURS.map((g) => [g, []])));
  plan.forEach(({ordre, points}, t) => {
    ordre.forEach((i, etape) => {
      const avant = valeur_facteur(facteurs[i], points[etape][i]);
      const apres = valeur_facteur(facteurs[i], points[etape + 1][i]);
      const delta = (apres - avant) / (facteurs[i].max - facteurs[i].min);
      if (delta === 0) return;
      for (const g of GRANDEURS) effets[i][g].push((sorties[t][etape + 1][g] - sorties[t][etape][g]) / delta);
    });
  });
  return Object.fromEntries(GRANDEURS.map((g) => [g, facteurs.map((f, i) => statistiques_effets(f.chemin, effets[i][g]))
    .sort((a, b) => b.mu_etoile - a.mu_etoile)]));
}

function statistiques_effets(chemin, liste) {
  const n = liste.length;
  const mu = n ? liste.reduce((s, e) => s + e, 0) / n : 0;
  const mu_etoile = n ? liste.reduce((s, e) => s + Math.abs(e), 0) / n : 0;
  const sigma = n > 1 ? Math.sqrt(liste.reduce((s, e) => s + (e - mu) ** 2, 0) / (n - 1)) : 0;
  return {chemin, mu, mu_etoile, sigma, effectif: n};
}

/**
 * Criblage de Morris du scénario `brut` sur `facteurs` ([{chemin, min, max, entier}]). Chaque point est la moyenne de
 * `tirages` raids aux mêmes graines (nombres aléatoires communs). `bruit` : par grandeur, la demi-largeur moyenne de
 * l'IC à 95 % d'un effet élémentaire due au seul hasard ; un μ* en dessous ne se distingue pas du bruit.
 */
export function morris(brut, facteurs, {trajectoires = 6, niveaux = 4, tirages = 3, graine = 1}, fichiers, registre) {
  const v2 = en_v2(brut);
  const plan = plan_morris(facteurs.length, trajectoires, niveaux, graine);
  const resumes = plan.map(({points}) => points.map((point) =>
    resumer_bilans(bilans_campagne(modifier_scenario(v2, modifications_point(facteurs, point)), tirages, fichiers, registre))));
  const sorties = resumes.map((ligne) => ligne.map((r) => Object.fromEntries(GRANDEURS.map((g) => [g, r[g].moyenne]))));
  const delta = pas_morris(niveaux);
  const bruit = Object.fromEntries(GRANDEURS.map((g) => {
    const ics = resumes.flat().map((r) => r[g].ic95);
    return [g, (Math.SQRT2 * ics.reduce((s, x) => s + x, 0)) / ics.length / delta];
  }));
  return {facteurs, options: {trajectoires, niveaux, tirages, graine}, evaluations: plan.length * (facteurs.length + 1), effets: effets_morris(facteurs, plan, sorties), bruit};
}
