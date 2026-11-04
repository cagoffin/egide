// Valeur et aide d'un chemin de scénario, telles que les montre l'interface : une surcharge absente du scénario
// affiche la valeur de l'unité du catalogue, et son aide est celle du fichier d'unité. Pur, testé.
import {unite_brute} from "../moteur/catalogue.js";
import {lire_chemin} from "../moteur/scenario.js";

const SURCHARGE = /^(.*)\.(surcharges|surcharges_emport)\.([^.]+)$/;

function unite_de_surcharge(brut, fichiers, chemin) {
  const [, groupe, nature, cle] = chemin.match(SURCHARGE) ?? [];
  if (!groupe) return null;
  const idUnite = lire_chemin(brut, groupe).unite;
  const unite = unite_brute(nature === "surcharges" ? idUnite : unite_brute(idUnite, fichiers).emport, fichiers);
  return {unite, cle};
}

/** Rendre la valeur affichée au `chemin` : celle du scénario, sinon celle de l'unité pour une surcharge absente. */
export function valeur_effective(brut, fichiers, chemin) {
  const valeur = lire_chemin(brut, chemin);
  if (valeur !== undefined) return valeur;
  const surcharge = unite_de_surcharge(brut, fichiers, chemin);
  return surcharge ? surcharge.unite[surcharge.cle] : undefined;
}

/** Rendre la phrase d'aide d'un chemin : bloc « _aide » du scénario (« avions[].nombre » pour un tableau) ou de l'unité. */
export function aide_chemin(brut, fichiers, chemin) {
  const surcharge = unite_de_surcharge(brut, fichiers, chemin);
  if (surcharge) return surcharge.unite._aide[surcharge.cle] ?? "";
  const segments = chemin.split(".");
  const cle = segments.at(-1);
  const parent = segments.length > 1 ? lire_chemin(brut, segments.slice(0, -1).join(".")) : brut;
  if (parent?._aide?.[cle]) return parent._aide[cle];
  if (/^\d+$/.test(segments.at(-2) ?? "")) {
    const proprietaire = lire_chemin(brut, segments.slice(0, -3).join(".")) ?? brut;
    return proprietaire?._aide?.[`${segments.at(-3)}[].${cle}`] ?? "";
  }
  return "";
}
