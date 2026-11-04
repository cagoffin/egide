// Fiches du catalogue (jalon 4) : chaque unité et chaque algorithme expliqués — fidélité, équations, hypothèses,
// domaine de validité, sources, lignée, paramètres et code. Rendu en HTML par des fonctions pures, testées.
import {origine_des_cles, unite_brute} from "../moteur/catalogue.js";
import {chemin_algo} from "../moteur/algos.js";
import {chemin_unite} from "../moteur/catalogue.js";
import {libelle_unite} from "../moteur/unites.js";

const META_UNITE = ["nom", "fidelite", "sources", "herite_de", "algos"];
export const LIBELLES_FIDELITE = {
  notionnel: "Notionnel : ordres de grandeur",
  cinematique: "Cinématique : positions et vitesses",
  point_masse: "Point-masse : forces, 3 degrés de liberté",
  "6ddl": "Six degrés de liberté",
};

/** Rendre un texte sûr pour l'insérer en HTML (les fichiers privés ne sont pas sous notre contrôle). */
export const echapper = (texte) => String(texte).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);

const lien_unite = (id, nom) => `<a href="#unite/${encodeURIComponent(id)}">${echapper(nom ?? id)}</a>`;
const lien_algo = (id, nom) => `<a href="#algo/${encodeURIComponent(id)}">${echapper(nom ?? id)}</a>`;
const badge = (classe, texte, titre = "") => `<span class="badge ${classe}" title="${echapper(titre)}">${echapper(texte)}</span>`;
const liste = (elements) => (elements.length ? `<ul>${elements.map((e) => `<li>${e}</li>`).join("")}</ul>` : "<p class=\"vide\">—</p>");

/**
 * Rendre, pour chaque algorithme, ce qui l'utilise : unités (par rôle) et réglages du scénario de référence.
 * `unites` : {id: unité fusionnée} ; `scenario` : scénario v2 brut.
 */
export function utilisations(unites, scenario) {
  const usages = {};
  const noter = (idAlgo, texte) => (usages[idAlgo] ??= []).push(texte);
  for (const [id, unite] of Object.entries(unites)) {
    for (const [role, idAlgo] of Object.entries(unite.algos ?? {})) noter(idAlgo, {unite: id, role});
  }
  const {conduite} = scenario.bleu;
  noter(conduite.pistage, {reglage: "bleu.conduite.pistage"});
  noter(conduite.allocation, {reglage: "bleu.conduite.allocation"});
  return usages;
}

/** Rendre le HTML de la fiche de l'unité `id` (fichiers bruts du catalogue, index des algorithmes {id: meta}). */
export function fiche_unite(id, fichiers, metas) {
  const unite = unite_brute(id, fichiers);
  const origines = origine_des_cles(id, fichiers);
  const parametres = Object.keys(unite).filter((cle) => !cle.startsWith("_") && !META_UNITE.includes(cle) && cle !== "id");
  const lignes = parametres.map((cle) => {
    const valeur = unite[cle];
    const affichee = cle === "emport" ? lien_unite(valeur, fichiers[valeur]?.nom) : `${echapper(valeur)}${libelle_unite(cle) ? ` ${libelle_unite(cle)}` : ""}`;
    const origine = origines[cle] === id ? "elle-même" : lien_unite(origines[cle], fichiers[origines[cle]]?.nom);
    return `<tr><th scope="row"><code>${echapper(cle)}</code></th><td>${affichee}</td><td>${echapper(unite._aide[cle] ?? "")}</td><td>${origine}</td></tr>`;
  });
  const algos = Object.entries(unite.algos ?? {}).map(([role, idAlgo]) => `<tr><th scope="row">${echapper(role)}</th><td>${lien_algo(idAlgo, metas[idAlgo]?.nom)}</td></tr>`);
  return `<header><h2>${echapper(unite.nom)}</h2>
    ${badge(`fidelite-${unite.fidelite}`, unite.fidelite, LIBELLES_FIDELITE[unite.fidelite])}
    <p class="chemin">Fichier : <a href="${echapper(chemin_unite(id))}"><code>${echapper(chemin_unite(id))}</code></a></p></header>
    <section><h3>Lignée</h3><p class="lignee">${unite._lignee.map((a) => (a === id ? `<b>${echapper(unite.nom)}</b>` : lien_unite(a, fichiers[a]?.nom))).join(" → ")}</p></section>
    <section><h3>Sources</h3>${liste(unite.sources.map(echapper))}</section>
    <section><h3>Paramètres</h3><table><thead><tr><th>Clé</th><th>Valeur</th><th>Signification</th><th>Fixé par</th></tr></thead><tbody>${lignes.join("")}</tbody></table></section>
    <section><h3>Algorithmes</h3>${algos.length ? `<table><tbody>${algos.join("")}</tbody></table>` : "<p class=\"vide\">Aucun : l'unité est une base ou une donnée.</p>"}</section>`;
}

/** Rendre le HTML de la fiche de l'algorithme `id`, de fiche `meta`, avec ses `usages` (voir utilisations). */
export function fiche_algo(id, meta, usages = [], fichiers = {}) {
  const parametres = Object.entries(meta.parametres).map(([cle, p]) => `<tr><th scope="row"><code>${echapper(cle)}</code></th><td>${echapper(p.unite || "—")}</td><td>${echapper(p.aide)}</td></tr>`);
  const usage = usages.map((u) => (u.unite ? `${lien_unite(u.unite, fichiers[u.unite]?.nom)} (rôle ${echapper(u.role)})` : `scénario : <code>${echapper(u.reglage)}</code>`));
  return `<header><h2>${echapper(meta.nom)}</h2>
    ${badge("role", meta.role)} ${badge(`fidelite-${meta.fidelite}`, meta.fidelite, LIBELLES_FIDELITE[meta.fidelite])}
    <p class="chemin">Code : <a href="${echapper(chemin_algo(id))}"><code>${echapper(chemin_algo(id))}</code></a></p></header>
    <section><p class="description">${echapper(meta.description)}</p></section>
    <section><h3>Équations</h3>${meta.equations.length ? `<div class="equations">${meta.equations.map((e) => `<p>${echapper(e)}</p>`).join("")}</div>` : "<p class=\"vide\">Aucune : règle de décision.</p>"}</section>
    <section><h3>Hypothèses</h3>${liste(meta.hypotheses.map(echapper))}</section>
    <section><h3>Domaine de validité</h3><p>${echapper(meta.domaine_validite)}</p></section>
    <section><h3>Paramètres lus</h3>${parametres.length ? `<table><thead><tr><th>Clé</th><th>Unité</th><th>Signification</th></tr></thead><tbody>${parametres.join("")}</tbody></table>` : "<p class=\"vide\">Aucun.</p>"}</section>
    <section><h3>Références</h3>${liste(meta.references.map(echapper))}</section>
    <section><h3>Utilisé par</h3>${liste(usage)}</section>`;
}
