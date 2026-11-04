// Dossier de preuve en Markdown (MODELE § 14.5) : ce qu'un lecteur doit avoir pour juger et refaire un résultat.
// Partie pure : reçoit des résultats déjà calculés, ne lance aucune simulation.
import {unite_brute} from "./catalogue.js";
import {GRANDEURS} from "./campagne.js";

const LIBELLES = {
  fuites: "Frappes (drones arrivés)", fuites_max_cible: "Frappes sur la cible la plus touchée", detruits_air: "Détruits par les avions",
  detruits_sol: "Détruits par le sol", tirs_air: "Tirs air", tirs_sol: "Tirs sol", duree: "Durée du raid (s)",
};

const nombre = (x, chiffres = 1) => (x === null || x === undefined ? "—" : Number.isFinite(x) ? x.toFixed(chiffres) : "∞");
const valeur = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));
const tableau = (entetes, lignes) => [`| ${entetes.join(" | ")} |`, `|${entetes.map(() => "---").join("|")}|`, ...lignes.map((l) => `| ${l.join(" | ")} |`)].join("\n");

function section_empreinte({empreinte}) {
  const parties = Object.entries(empreinte.parties).map(([cle, h]) => `\`${cle}\` ${h.slice(0, 16)}`).join(" · ");
  return `## Empreinte\n\n\`${empreinte.empreinte}\`\n\n${parties}\n\nDeux résultats de même empreinte, mêmes graines et mêmes tirages sont identiques au bit près.`;
}

function section_differentiel({differentiel}) {
  if (differentiel.length === 0) return "## Écarts au scénario de référence\n\nAucun : c'est le scénario de référence.";
  return `## Écarts au scénario de référence\n\n${tableau(["Chemin", "Référence", "Ici"], differentiel.map((d) => [`\`${d.chemin}\``, valeur(d.avant), valeur(d.apres)]))}`;
}

function section_modeles({fichiers, registre, empreinte}) {
  const unites = Object.keys(fichiers).filter((id) => !id.split("/").at(-1).startsWith("_")).sort().map((id) => {
    const u = unite_brute(id, fichiers);
    return [`\`${id}\``, u.nom ?? "", u.fidelite ?? "", (u.sources ?? []).join(" ; ")];
  });
  const algos = empreinte.algos.map((id) => {
    const {meta} = registre[id];
    return [`\`${id}\``, meta.fidelite, meta.hypotheses.join(" ; ")];
  });
  return [
    "## Modèles en jeu",
    tableau(["Unité", "Nom", "Fidélité", "Sources"], unites),
    tableau(["Algorithme", "Fidélité", "Hypothèses"], algos),
  ].join("\n\n");
}

function section_resultats({tirages, resume}) {
  const lignes = GRANDEURS.map((g) => [LIBELLES[g], `${nombre(resume[g].moyenne)} ± ${nombre(resume[g].ic95)}`, nombre(resume[g].ecart_type)]);
  return `## Résultats\n\n${tirages} raids, graines successives. Moyenne ± demi-largeur de l'IC à 95 %.\n\n${tableau(["Grandeur", "Moyenne ± IC 95 %", "Écart-type"], lignes)}`;
}

function section_convergence({convergence}) {
  if (!convergence) return "## Convergence en pas de temps\n\nNon évaluée.";
  const entetes = ["Pas (s)", ...GRANDEURS.map((g) => LIBELLES[g]), "Conforme"];
  const lignes = convergence.lignes.map((l) => [
    l.pas_s === convergence.pas_s ? `**${l.pas_s}**` : String(l.pas_s),
    ...GRANDEURS.map((g) => `${nombre(l.resume[g].moyenne)} (z ${nombre(l.ecarts[g].z, 1)})`),
    l.conforme ? "oui" : "**non**",
  ]);
  const verdict = convergence.converge ? "**Le pas du scénario a convergé.**" : "**Le pas du scénario n'a pas convergé : le réduire.**";
  return [
    "## Convergence en pas de temps",
    `${convergence.tirages} raids par pas, mêmes graines ; z : écart apparié au pas le plus fin (${convergence.pas_reference_s} s). Conforme si z ≤ 3 ou écart ≤ 1 %.`,
    tableau(entetes, lignes),
    verdict,
  ].join("\n\n");
}

/** Rendre le dossier de preuve en Markdown à partir de résultats calculés (voir src/preuve.js). */
export function dossier_markdown(donnees) {
  const entete = [
    `# Dossier de preuve — ${donnees.nom}`,
    `Produit le ${donnees.date} par Égide ${donnees.version} (Node ${donnees.node}).`,
    `Reproduire : \`${donnees.commande}\``,
  ].join("\n\n");
  const limites = "## Limites connues\n\nVoir docs/MODELE.md § 7 : drones sans contre-mesures ni évitement, radar parfait dans sa couverture, relief non pris en compte par le moteur. Modèles notionnels : ordres de grandeur, pas des performances de systèmes réels.";
  return [entete, section_empreinte(donnees), section_differentiel(donnees), section_resultats(donnees), section_convergence(donnees), section_modeles(donnees), limites].join("\n\n") + "\n";
}
