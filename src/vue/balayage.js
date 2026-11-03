// Panneau de balayage : une clé, une liste de valeurs, N raids par valeur, courbes et tableau des résultats.
import {format_decimal, format_intervalle} from "./format.js";
import {SERIES, dessiner_courbes, texte_infobulle} from "./graphique.js";
import {REGLAGES, unite} from "./reglages.js";

const PROPOSITIONS = {
  avions_nombre: "0, 10, 20, 35, 50, 75, 100",
  avions_vitesse_kmh: "350, 400, 450, 500, 550, 600, 650",
  sol_postes_nombre: "0, 50, 100, 200, 300, 400",
  drones_concentration_max: "50, 100, 200, 300, 500, 1000",
  fourmi_eclatement_rayon_km: "0, 30, 60, 90, 120",
};

function libelle_cle(cle) {
  const reglage = REGLAGES.find((r) => r.cle === cle);
  return `${reglage?.libelle ?? cle}${unite(cle) ? ` (${unite(cle)})` : ""}`;
}

function tableau_resultats(points, cle) {
  const entete = `<tr><th>${libelle_cle(cle)}</th>${SERIES.map((s) => `<th>${s.libelle}</th>`).join("")}</tr>`;
  const lignes = points.map((p) => `<tr><td>${format_decimal(p.valeur)}</td>${SERIES.map((s) => `<td>${format_intervalle(p.resume[s.cle])}</td>`).join("")}</tr>`);
  return `<table>${entete}${lignes.join("")}</table>`;
}

/**
 * Brancher le panneau `racine` : `brutCourant()` rend le scénario affiché, `infobulle` l'élément de survol.
 */
export function brancher_balayage(racine, brutCourant, infobulle) {
  const choix = racine.querySelector("[name='cle_balayee']");
  const valeurs = racine.querySelector("[name='valeurs']");
  const tirages = racine.querySelector("[name='tirages']");
  const bouton = racine.querySelector("[data-action='balayer']");
  const etat = racine.querySelector("[data-champ='progression']");
  const courbes = racine.querySelector("[data-zone='courbes']");
  const table = racine.querySelector("[data-zone='table']");
  choix.innerHTML = Object.keys(PROPOSITIONS).map((cle) => `<option value="${cle}">${libelle_cle(cle)}</option>`).join("");
  valeurs.value = PROPOSITIONS[choix.value];
  choix.addEventListener("change", () => (valeurs.value = PROPOSITIONS[choix.value]));
  let travailleur = null;
  bouton.addEventListener("click", () => {
    travailleur?.terminate();
    const cle = choix.value;
    const liste = valeurs.value.split(/[;,\s]+/).filter(Boolean).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const points = [];
    const survol = (point, x, y) => montrer(infobulle, point && texte_infobulle(point, libelle_cle(cle)), x, y);
    travailleur = new Worker(new URL("./balayage_travailleur.js", import.meta.url), {type: "module"});
    travailleur.addEventListener("message", ({data}) => {
      if (data.type === "fin") {
        etat.textContent = `Terminé : ${liste.length} valeurs, ${tirages.value} raids chacune.`;
        return;
      }
      points.push(data);
      points.sort((a, b) => a.valeur - b.valeur);
      etat.textContent = `${points.length} valeurs sur ${liste.length} simulées…`;
      dessiner_courbes(courbes, points, libelle_cle(cle), survol);
      table.innerHTML = tableau_resultats(points, cle);
    });
    etat.textContent = `0 valeur sur ${liste.length} simulée…`;
    travailleur.postMessage({brut: brutCourant(), cle, valeurs: liste, tirages: Number(tirages.value)});
  });
}

/** Afficher `texte` dans l'infobulle près de (x, y), ou la cacher si `texte` est vide. */
export function montrer(infobulle, texte, x, y) {
  infobulle.hidden = !texte;
  if (!texte) return;
  infobulle.textContent = texte;
  const marge = 14;
  const {innerWidth: largeur, innerHeight: hauteur} = window;
  infobulle.style.left = `${Math.min(x + marge, largeur - infobulle.offsetWidth - 8)}px`;
  infobulle.style.top = `${Math.min(y + marge, hauteur - infobulle.offsetHeight - 8)}px`;
}
