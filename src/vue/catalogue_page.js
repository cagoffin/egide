// Page catalogue.html : index cherchable des unités et des algorithmes publics, et leurs fiches (fiches.js).
import {charger_algos} from "../moteur/algos.js";
import {charger_unites, unite_brute} from "../moteur/catalogue.js";
import {publier_couleurs} from "./couleurs.js";
import {echapper, fiche_algo, fiche_unite, utilisations} from "./fiches.js";

const $ = (selecteur) => document.querySelector(selecteur);

async function lire_json(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${chemin}`);
  return reponse.json();
}

function remplir_index(indexUnites, indexAlgos) {
  const groupes = (elements, cle) => Object.entries(Object.groupBy(elements, (e) => e[cle]));
  $("[data-liste='unites']").innerHTML = groupes(indexUnites, "famille").map(([famille, unites]) => `<li><span class="groupe">${echapper(famille)}</span><ul>
    ${unites.map((u) => `<li data-texte="${echapper(`${u.nom} ${u.id}`.toLowerCase())}"><a href="#unite/${encodeURIComponent(u.id)}" class="${u.base ? "base" : ""}">${echapper(u.base ? `base ${u.id.split("/").at(-1)}` : u.nom)}</a></li>`).join("")}</ul></li>`).join("");
  $("[data-liste='algos']").innerHTML = groupes(indexAlgos, "role").map(([role, algos]) => `<li><span class="groupe">${echapper(role)}</span><ul>
    ${algos.map((a) => `<li data-texte="${echapper(`${a.nom} ${a.id}`.toLowerCase())}"><a href="#algo/${encodeURIComponent(a.id)}">${echapper(a.nom)}</a></li>`).join("")}</ul></li>`).join("");
}

function filtrer(texte) {
  const cherche = texte.trim().toLowerCase();
  document.querySelectorAll(".index-catalogue li[data-texte]").forEach((li) => (li.hidden = Boolean(cherche) && !li.dataset.texte.includes(cherche)));
}

async function demarrer() {
  publier_couleurs(document.documentElement);
  const [indexUnites, indexAlgos, scenario] = await Promise.all([lire_json("unites/index.json"), lire_json("algos/index.json"), lire_json("scenarios/reference.json")]);
  const fichiers = await charger_unites(indexUnites.map((u) => u.id), lire_json);
  const registre = await charger_algos(indexAlgos.map((a) => a.id), (chemin) => import(new URL(chemin, document.baseURI).href));
  const metas = Object.fromEntries(Object.entries(registre).map(([id, module]) => [id, module.meta]));
  const unites = Object.fromEntries(indexUnites.map((u) => [u.id, unite_brute(u.id, fichiers)]));
  const usages = utilisations(unites, scenario);
  remplir_index(indexUnites, indexAlgos);
  const afficher = () => {
    const [genre, id] = decodeURIComponent(location.hash.slice(1)).split(/\/(.*)/s);
    const fiche = $("#fiche");
    if (genre === "unite" && fichiers[id]) fiche.innerHTML = fiche_unite(id, fichiers, metas);
    else if (genre === "algo" && metas[id]) fiche.innerHTML = fiche_algo(id, metas[id], usages[id], fichiers);
    else return;
    document.querySelectorAll(".index-catalogue a").forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === location.hash));
    fiche.scrollTop = 0;
  };
  addEventListener("hashchange", afficher);
  $("[name='recherche']").addEventListener("input", (e) => filtrer(e.target.value));
  afficher();
}

demarrer();
