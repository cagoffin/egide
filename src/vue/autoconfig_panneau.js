// Panneau d'auto-configuration (MODELE § 20) : menaces, moyens, zone (pays ou zone dessinée), puis recherche de la
// répartition dans un Worker, résultat comparé à la répartition uniforme, à appliquer ou ranger en bibliothèque.
import {format_decimal, format_entier} from "./format.js";

const TACTIQUES = [["fourmi", "Fourmi"], ["direct", "Groupes directs"], ["disperse", "Dispersés"]];
const MOYENS = [
  ["radars", "Radars", 0], ["centres", "Centres (CDC)", 1], ["cibles", "Cibles à défendre", 1], ["postes", "Postes sol", 0],
  ["munitions_sol", "Munitions sol", 0], ["avions_0", "Avions IR", 0], ["avions_1", "Avions laser", 0], ["avions_2", "Drones armés", 0],
  ["avions_3", "Intercepteurs", 0], ["avions_4", "Brouilleurs", 0],
];

/** Rendre la description lisible d'une stratégie de répartition. */
export function decrire_strategie(s) {
  if (s.uniforme) return "uniforme : orbites tirées au hasard sur le disque du théâtre";
  const pc = (x) => `${Math.round(100 * x)} %`;
  return `avions à ${pc(s.avions)} du chemin du centre vers la frontière, drones défensifs à ${pc(s.drones * 0.5)} du rayon autour des cibles, radars ${s.radars ? `poussés de ${pc(s.radars)} de leur portée au-delà de la frontière` : "sur la frontière"}`;
}

/** Rendre les valeurs par défaut des moyens, lues dans le scénario affiché. */
function moyens_courants(brut) {
  const nb = (i) => brut.bleu.avions[i]?.nombre ?? 0;
  const radars = brut.bleu.radar.disposition === "sites" ? brut.bleu.radar.sites.length : 30;
  return {radars, centres: 1 + (brut.bleu.reseau?.centres?.length ?? 0), cibles: brut.theatre.cibles_nombre, postes: brut.bleu.sol.nombre,
    munitions_sol: brut.bleu.sol.munitions, avions_0: nb(0), avions_1: nb(1), avions_2: nb(2), avions_3: nb(3), avions_4: nb(4)};
}

/**
 * Brancher le panneau `racine`. `ctx` : {brut(), fichiers(), lire_json(chemin), appliquer(brut), enregistrer(nom, brut),
 * exporter(brut)}.
 */
export function brancher_autoconfig(racine, ctx) {
  const $ = (s) => racine.querySelector(s);
  let pays = null;
  let resultat = null;
  let travailleur = null;
  $("[data-zone='menaces']").innerHTML = TACTIQUES.map(([id, nom], i) =>
    `<label class="ligne-menace"><input type="checkbox" name="menace" value="${id}" ${i < 2 ? "checked" : ""}>${nom}<input type="number" name="nombre_${id}" min="10" step="10" value="1000" aria-label="Drones (${nom})"></label>`).join("");
  $("[data-zone='moyens']").innerHTML = MOYENS.map(([id, nom, min]) => `<label>${nom}<input type="number" name="moyen_${id}" min="${min}" step="1"></label>`).join("");
  const remplir = () => {
    const brut = ctx.brut();
    for (const [id, valeur] of Object.entries(moyens_courants(brut))) $(`[name='moyen_${id}']`).value = valeur;
    const zones = brut.theatre.zones ?? [];
    $("[name='zone_dessinee']").innerHTML = zones.length ? zones.map((z, i) => `<option value="${i}">${z.nom}</option>`).join("") : `<option value="">Aucune : outil Zone de l'éditeur</option>`;
  };
  const charger_pays = async () => {
    if (pays) return;
    try {
      pays = (await ctx.lire_json("cartes/frontieres/pays.json")).pays;
      $("#liste-pays").innerHTML = pays.map((p) => `<option value="${p.nom}">${p.iso}</option>`).join("");
    } catch {
      $("[data-champ='autoconfig_etat']").textContent = "Frontières absentes : lancer node outils/frontieres.js, ou utiliser une zone dessinée.";
    }
  };
  racine.querySelectorAll("[name='source_zone']").forEach((r) => r.addEventListener("change", () => r.value === "pays" && charger_pays()));
  $("[data-action='autoconfig']").addEventListener("click", () => lancer());
  $("[data-action='autoconfig_appliquer']").addEventListener("click", () => resultat && ctx.appliquer(resultat.brut));
  $("[data-action='autoconfig_enregistrer']").addEventListener("click", () => resultat && ctx.enregistrer(resultat.brut.nom, resultat.brut));
  $("[data-action='autoconfig_exporter']").addEventListener("click", () => resultat && ctx.exporter(resultat.brut));

  function zone_demandee() {
    const brut = ctx.brut();
    if (racine.querySelector("[name='source_zone']:checked").value === "dessinee") {
      const z = brut.theatre.zones?.[Number($("[name='zone_dessinee']").value)];
      return z ? {nom: z.nom, points: z.points} : null;
    }
    const p = pays?.find((x) => x.nom === $("[name='pays']").value);
    if (!p) return null;
    const anneau = anneau_principal(p);
    return {nom: p.nom, points: anneau.slice(0, -1).map(([lon, lat]) => ({lat_deg: lat, lon_deg: lon}))};
  }

  function lancer() {
    const zone = zone_demandee();
    const etat = $("[data-champ='autoconfig_etat']");
    if (!zone) return void (etat.textContent = "Choisissez une zone : un pays, ou une zone dessinée dans l'éditeur.");
    const menaces = [...racine.querySelectorAll("[name='menace']:checked")].map((c) => ({tactique: c.value, nombre: Number($(`[name='nombre_${c.value}']`).value)}));
    if (!menaces.length) return void (etat.textContent = "Cochez au moins une menace.");
    const v = (id) => Number($(`[name='moyen_${id}']`).value);
    const demande = {zone, menaces, moyens: {radars: v("radars"), centres: v("centres"), cibles: v("cibles"), postes: v("postes"),
      munitions_sol: v("munitions_sol"), avions: [0, 1, 2, 3, 4].map((i) => v(`avions_${i}`))}};
    travailleur?.terminate();
    resultat = null;
    racine.querySelector(".resultat-autoconfig").hidden = true;
    const liste = $("[data-zone='essais']");
    liste.innerHTML = "";
    etat.textContent = "Recherche en cours…";
    travailleur = new Worker(new URL("./autoconfig_travailleur.js", import.meta.url), {type: "module"});
    travailleur.addEventListener("message", ({data}) => {
      if (data.type === "erreur") etat.textContent = `Échec : ${data.message}`;
      if (data.type === "essai") {
        etat.textContent = `Essai ${data.fait} sur ${data.total}…`;
        liste.insertAdjacentHTML("beforeend", `<li><b>${format_decimal(data.essai.frappes)}</b> frappes — ${decrire_strategie(data.essai.strategie)}</li>`);
      }
      if (data.type === "fin") montrer_resultat(data.resultat);
    });
    travailleur.postMessage({base: ctx.brut(), demande, fichiers: ctx.fichiers(), tirages: Number($("[name='tirages_autoconfig']").value)});
  }

  // remplir() : à l'ouverture du panneau, les moyens reprennent ceux du scénario affiché.
  function montrer_resultat(r) {
    resultat = r;
    const d = r.comparaison.difference;
    $("[data-champ='autoconfig_etat']").textContent = "Terminé.";
    $("[data-zone='resultat']").innerHTML = `<p><b>${format_decimal(r.meilleur)}</b> frappes en moyenne avec la répartition retenue, contre
      <b>${format_decimal(r.uniforme)}</b> en répartition uniforme : écart ${format_decimal(d.moyenne)} ± ${format_decimal(d.ic95)} (IC 95 %, ${format_entier(d.effectif)} raids appariés),
      ${r.comparaison.verdict === "indiscernable" ? "pas encore significatif : augmentez les raids par essai" : "significatif"}.</p>
      <p>Retenue : ${decrire_strategie(r.strategie)}.</p>`;
    racine.querySelector(".resultat-autoconfig").hidden = false;
  }  return {remplir};

}

/** Aire approchée d'un anneau [lon, lat] : pour retenir le plus étendu d'un pays. */
const aire = (a) => Math.abs(a.reduce((s, [x1, y1], i) => {
  const [x2, y2] = a[(i + 1) % a.length];
  return s + (x1 * y2 - x2 * y1) * Math.cos(((y1 + y2) / 2) * Math.PI / 180);
}, 0)) / 2;

/** Rendre l'anneau le plus étendu d'un pays (la métropole plutôt qu'une île). */
export const anneau_principal = (p) => p.anneaux.reduce((a, b) => (aire(b) > aire(a) ? b : a));
