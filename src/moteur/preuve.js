// Outils de preuve (MODELE § 14) : empreinte de reproductibilité, différentiel de scénario, convergence en pas de
// temps, duel A/B à nombres aléatoires communs. Le criblage de sensibilité est dans sensibilite.js. Node et navigateur.
import {ids_algos} from "./algos.js";
import {bilans_campagne, GRANDEURS, resumer_bilans} from "./campagne.js";
import {en_v2, lire_chemin, modifier_scenario, resoudre_scenario} from "./scenario.js";
import {resumer} from "./statistiques.js";

/** Seuil d'écart, en écarts-types de la différence, au-delà duquel deux estimations sont déclarées distinctes. */
export const SEUIL_Z = 3;

/** Rendre le JSON de `valeur` à clés triées, sans les blocs `_aide` : deux contenus égaux ont le même texte. */
export function json_canonique(valeur) {
  if (Array.isArray(valeur)) return `[${valeur.map(json_canonique).join(",")}]`;
  if (valeur && typeof valeur === "object") {
    const cles = Object.keys(valeur).filter((c) => c !== "_aide" && valeur[c] !== undefined).sort();
    return `{${cles.map((c) => `${JSON.stringify(c)}:${json_canonique(valeur[c])}`).join(",")}}`;
  }
  return JSON.stringify(valeur);
}

/** Rendre le SHA-256 hexadécimal du texte `texte` (WebCrypto, présent sous Node ≥ 20 et dans les navigateurs). */
export async function sha256(texte) {
  const octets = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, "0")).join("");
}

/** Rendre le texte qui identifie un module d'algorithme : sa fiche et le code de chacune de ses fonctions. */
function texte_algo(module) {
  const fonctions = Object.keys(module).filter((n) => typeof module[n] === "function").sort();
  return json_canonique({meta: module.meta, code: Object.fromEntries(fonctions.map((n) => [n, module[n].toString()]))});
}

/**
 * Rendre l'empreinte de reproductibilité d'un résultat : SHA-256 du scénario, des fichiers d'unités, des algorithmes
 * qu'il fait tourner et de `extras` (code du moteur, par exemple), plus l'empreinte de chaque partie.
 * Deux résultats de même empreinte et de mêmes tirages sont identiques au bit près.
 */
export async function empreinte(brut, fichiers, registre, extras = {}) {
  const v2 = en_v2(brut);
  const ids = ids_algos(resoudre_scenario(v2, fichiers)).sort();
  const textes = {
    scenario: json_canonique(v2),
    unites: json_canonique(fichiers),
    algos: json_canonique(Object.fromEntries(ids.map((id) => [id, texte_algo(registre[id])]))),
    ...Object.fromEntries(Object.entries(extras).map(([cle, texte]) => [cle, String(texte)])),
  };
  const parties = {};
  for (const cle of Object.keys(textes).sort()) parties[cle] = await sha256(textes[cle]);
  return {empreinte: await sha256(json_canonique(parties)), parties, algos: ids};
}

/** Rendre les feuilles {chemin: valeur} d'un scénario, chemins pointés, sans les blocs `_aide`. */
export function feuilles(valeur, prefixe = "", sortie = {}) {
  if (valeur && typeof valeur === "object") {
    const cles = Array.isArray(valeur) ? valeur.map((_, i) => String(i)) : Object.keys(valeur).filter((c) => c !== "_aide");
    if (cles.length === 0) sortie[prefixe] = Array.isArray(valeur) ? [] : {};
    for (const cle of cles) feuilles(valeur[cle], prefixe ? `${prefixe}.${cle}` : cle, sortie);
  } else {
    sortie[prefixe] = valeur;
  }
  return sortie;
}

/** Rendre la liste triée des chemins dont la valeur diffère entre `base` et `variante`, avec les deux valeurs. */
export function differentiel(base, variante) {
  const a = feuilles(en_v2(base));
  const b = feuilles(en_v2(variante));
  const chemins = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return chemins
    .filter((c) => json_canonique(a[c]) !== json_canonique(b[c]))
    .map((chemin) => ({chemin, avant: a[chemin] ?? null, apres: b[chemin] ?? null}));
}

/** Rendre l'écart réduit |mA − mB| / √(σA²/nA + σB²/nB) entre deux résumés indépendants (0 si tous deux exacts). */
export function ecart_reduit(a, b) {
  const erreur = Math.sqrt(a.ecart_type ** 2 / a.effectif + b.ecart_type ** 2 / b.effectif);
  const ecart = Math.abs(a.moyenne - b.moyenne);
  if (erreur === 0) return ecart === 0 ? 0 : Infinity;
  return ecart / erreur;
}

/** Tolérance pratique : un écart inférieur à cette fraction de la valeur de référence est jugé négligeable. */
export const TOLERANCE_RELATIVE = 0.01;

/**
 * Comparer deux listes de bilans tirées sur les mêmes graines (tirage i contre tirage i), grandeur par grandeur :
 * moyennes, différence moyenne B − A avec son IC à 95 %, écart réduit apparié, corrélation et gain des nombres
 * aléatoires communs (variance de A − B si indépendants, rapportée à celle mesurée). MODELE § 14.3.
 */
export function comparer_apparies(bilansA, bilansB) {
  if (bilansA.length !== bilansB.length) throw new Error("comparaison appariée : effectifs différents");
  return Object.fromEntries(GRANDEURS.map((g) => {
    const a = resumer(bilansA.map((b) => b[g]));
    const b = resumer(bilansB.map((x) => x[g]));
    const difference = resumer(bilansB.map((x, i) => x[g] - bilansA[i][g]));
    const erreur = difference.ecart_type / Math.sqrt(difference.effectif);
    const z = erreur === 0 ? (difference.moyenne === 0 ? 0 : Infinity) : Math.abs(difference.moyenne) / erreur;
    const varianceIndependante = a.ecart_type ** 2 + b.ecart_type ** 2;
    const covariance = (varianceIndependante - difference.ecart_type ** 2) / 2;
    const produit = a.ecart_type * b.ecart_type;
    return [g, {
      a, b, difference, z,
      correlation: produit === 0 ? null : covariance / produit,
      gain_nombres_communs: difference.ecart_type === 0 ? null : varianceIndependante / difference.ecart_type ** 2,
      verdict: z <= SEUIL_Z ? "indiscernable" : difference.moyenne > 0 ? "B > A" : "B < A",
    }];
  }));
}

/** Rendre la variante de `brut` dont chaque chemin de `modifications` a reçu sa valeur. */
const variante = (brut, modifications) => modifier_scenario(en_v2(brut), modifications);

/**
 * Convergence en pas de temps (MODELE § 14.2) : rejouer la campagne à chaque pas de `pas`, sur les mêmes graines, et
 * comparer chacun au plus fin. Le pas du scénario converge si, pour chaque grandeur, l'écart au plus fin est non
 * significatif (z ≤ SEUIL_Z) ou négligeable (≤ TOLERANCE_RELATIVE de la valeur de référence).
 */
export function convergence(brut, pas, tirages, fichiers, registre) {
  const pasScenario = lire_chemin(en_v2(brut), "simulation.pas_s");
  const liste = [...new Set([...pas, pasScenario])].sort((x, y) => y - x);
  const bilans = liste.map((p) => bilans_campagne(variante(brut, {"simulation.pas_s": p}), tirages, fichiers, registre));
  const fin = bilans.at(-1);
  const lignes = liste.map((p, i) => {
    const comparaison = comparer_apparies(fin, bilans[i]);
    const ecarts = Object.fromEntries(GRANDEURS.map((g) => {
      const {difference, a, z} = comparaison[g];
      const negligeable = Math.abs(difference.moyenne) <= TOLERANCE_RELATIVE * Math.abs(a.moyenne);
      return [g, {ecart: difference.moyenne, relatif: a.moyenne === 0 ? null : difference.moyenne / a.moyenne, z, conforme: z <= SEUIL_Z || negligeable}];
    }));
    return {pas_s: p, resume: resumer_bilans(bilans[i]), ecarts, conforme: Object.values(ecarts).every((e) => e.conforme)};
  });
  return {pas_s: pasScenario, pas_reference_s: liste.at(-1), tirages, lignes, converge: lignes.find((l) => l.pas_s === pasScenario).conforme};
}

/** Duel A/B (MODELE § 14.3) : le scénario `brut` (A) contre sa variante `modifications` (B), mêmes graines. */
export function duel(brut, modifications, tirages, fichiers, registre) {
  const b = variante(brut, modifications);
  const comparaison = comparer_apparies(bilans_campagne(brut, tirages, fichiers, registre), bilans_campagne(b, tirages, fichiers, registre));
  return {tirages, differentiel: differentiel(brut, b), comparaison};
}


