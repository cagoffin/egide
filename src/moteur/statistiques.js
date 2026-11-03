// Statistiques des campagnes Monte-Carlo : toute moyenne s'affiche avec son intervalle de confiance.

/** Rendre moyenne, écart-type (non biaisé), demi-largeur de l'intervalle de confiance à 95 % et effectif. */
export function resumer(valeurs) {
  const effectif = valeurs.length;
  const moyenne = valeurs.reduce((somme, v) => somme + v, 0) / effectif;
  const variance = effectif > 1 ? valeurs.reduce((somme, v) => somme + (v - moyenne) ** 2, 0) / (effectif - 1) : 0;
  const ecartType = Math.sqrt(variance);
  // 1,96 : quantile de la loi normale ; valable dès quelques dizaines de tirages (théorème central limite).
  return {moyenne, ecart_type: ecartType, ic95: (1.96 * ecartType) / Math.sqrt(effectif), effectif};
}
