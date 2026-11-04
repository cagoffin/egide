// Inspecteur « pourquoi » (jalon 4) : au clic sur une entité, son état en direct et l'explication de ce qu'elle fait —
// pourquoi un avion va là, ce qu'un drone a subi, comment une cible est défendue. Rendu par des fonctions pures, testées.
import {inverse, vers_degres} from "../moteur/geodesie.js";
import {COULEURS} from "./couleurs.js";
import {ecran} from "./ecran.js";
import {echapper, LIBELLES_FIDELITE} from "./fiches.js";
import {format_decimal, format_duree, format_entier} from "./format.js";
import {ms_vers_kmh} from "../moteur/unites.js";
import {positions_radars} from "../moteur/radars.js";

const ETATS = {orbite: "en orbite", ralliement: "en route vers son point", engagement: "au contact d'un drone",
  poste: "à poste, en attente", retour: "retour vers son orbite"};

const lien_fiche = (genre, id, texte) => `<a href="catalogue.html#${genre}/${encodeURIComponent(id)}" target="_blank" rel="noopener">${echapper(texte)}</a>`;
const fidelite = (niveau) => `<span class="badge fidelite-${niveau}" title="${echapper(LIBELLES_FIDELITE[niveau] ?? "")}">${echapper(niveau)}</span>`;
const ligne = (cle, valeur) => `<tr><th scope="row">${cle}</th><td>${valeur}</td></tr>`;
const position = (geo) => `${vers_degres(geo.lat).toFixed(3).replace(".", ",")}° N, ${vers_degres(geo.lon).toFixed(3).replace(".", ",")}° E`;
const pourcent = (p) => `${format_decimal(100 * p)} %`;

function pourquoi_avion(avion) {
  const decision = avion.decision;
  if (avion.ordre) return `<p>Il exécute un <b>ordre</b> donné dans l'éditeur : il rallie son point, et la conduite ne le réaffecte pas avant son arrivée.</p>`;
  if (!decision?.explication) return "<p>La conduite ne l'a pas encore affecté : aucune piste n'était connue.</p>";
  const {explication: x, t} = decision;
  if (!decision.point) {
    return `<p>À ${format_duree(t)}, ${x.pistes_connues} pistes étaient connues, aucune atteignable en moins de 15 min à sa vitesse : il est revenu vers son orbite.</p>`;
  }
  const r = x.retenue;
  const alternatives = x.alternatives.map((a) => `<li>piste de ${a.effectif} drones, score ${format_decimal(a.score)}, atteinte en ${format_duree(a.delai)}</li>`).join("");
  return `<p>À ${format_duree(t)}, la conduite l'a envoyé intercepter une piste de <b>${r.effectif} drones</b>, atteinte en
    <b>${format_duree(r.delai)}</b>. Score = effectif / (1 + avions déjà envoyés là) = ${r.effectif} / (1 + ${r.deja_affectes}) =
    <b>${format_decimal(r.score)}</b>, le meilleur parmi ${x.pistes_atteignables} pistes atteignables sur ${x.pistes_connues} connues.</p>
    ${alternatives ? `<p>Meilleures alternatives écartées :</p><ul>${alternatives}</ul>` : ""}`;
}

function inspection_avion(avion, monde) {
  const {groupe} = avion;
  const vitesse = avion.etat === "engagement" ? groupe.vitesse_engagement : ["ralliement", "retour"].includes(avion.etat) ? groupe.vitesse_mise_a_poste : 0;
  return `<h3>Avion ${avion.id + 1}</h3>
    <p>${lien_fiche("unite", groupe.id, groupe.nom)} ${fidelite(groupe.fidelite)}</p>
    <table>${[
      ligne("État", avion.munitions === 0 ? "à court de munitions" : ETATS[avion.etat]),
      ligne("Position", position(avion.geo)),
      ligne("Altitude", `${format_entier(avion.geo.alt)} m`),
      ligne("Vitesse", vitesse ? `${format_entier(ms_vers_kmh(vitesse))} km/h` : "en orbite"),
      ligne("Arme", `${lien_fiche("unite", groupe.arme.id, groupe.arme.nom)}, ${avion.munitions} sur ${groupe.emport_nombre}`),
    ].join("")}</table>
    <h4>Pourquoi va-t-il là ?</h4>${pourquoi_avion(avion, monde)}
    <h4>Modèles</h4><ul>
      <li>Mouvement : ${lien_fiche("algo", groupe.algos.mouvement, groupe.algos.mouvement)}</li>
      <li>Tir : ${lien_fiche("algo", groupe.arme.algos.tir, groupe.arme.algos.tir)}</li>
      <li>Allocation : ${lien_fiche("algo", monde.scenario.conduite.allocation, monde.scenario.conduite.allocation)}</li></ul>`;
}

/** Rendre la synthèse des tirs subis par un drone : nombre, Pk, probabilité de survie à ces tirs et issue. */
export function tirs_subis(monde, idDrone) {
  const tirs = (monde.evenements ?? []).filter((e) => e.type === "tir" && e.drone === idDrone);
  const survie = tirs.reduce((p, tir) => p * (1 - tir.pk), 1);
  return {tirs, survie, detruit_par: tirs.find((tir) => tir.detruit) ?? null};
}

function inspection_drone(drone, monde) {
  const {rouge} = monde.scenario;
  const {tirs, survie, detruit_par: fatal} = tirs_subis(monde, drone.id);
  const etat = !drone.vivant ? `détruit à ${format_duree(fatal?.t ?? monde.t)} (${fatal?.couche === "air" ? "par un avion" : "au sol"})`
    : drone.arrive ? "a frappé sa cible" : monde.t < drone.depart ? `part à ${format_duree(drone.depart)}` : "en vol";
  const restant = drone.vivant && !drone.arrive
    ? drone.route.reduce((somme, point, i) => somme + inverse(i ? drone.route[i - 1].geo : drone.geo, point.geo).distance, 0) : 0;
  const detail = tirs.map((tir) => `<li>${format_duree(tir.t)} : tir ${tir.couche === "air" ? "air" : "sol"}, Pk ${format_decimal(tir.pk)} — ${tir.detruit ? "<b>détruit</b>" : "manqué"}</li>`).join("");
  return `<h3>Drone ${drone.id + 1}, vise C${drone.cible + 1}</h3>
    <p>${lien_fiche("unite", rouge.id, rouge.nom)} ${fidelite(rouge.fidelite)}</p>
    <table>${[
      ligne("État", etat),
      ligne("Détecté", drone.detection === null ? "pas encore" : `à ${format_duree(drone.detection)}`),
      ligne("Reste à parcourir", restant ? `${format_decimal(restant / 1000)} km, ${format_duree(restant / rouge.vitesse)}` : "—"),
      ligne("Altitude", `${format_entier(drone.geo.alt)} m`),
    ].join("")}</table>
    <h4>Tirs subis</h4>${tirs.length ? `<ul>${detail}</ul>
      <p>Probabilité de survivre à ces ${tirs.length} tirs : Π(1 − Pk) = <b>${pourcent(survie)}</b>.</p>` : "<p>Aucun pour l'instant.</p>"}
    <h4>Modèles</h4><ul>
      <li>Comportement : ${lien_fiche("algo", rouge.comportement, rouge.comportement)}</li>
      <li>Mouvement : ${lien_fiche("algo", rouge.algos.mouvement, rouge.algos.mouvement)}</li>
      <li>Détection : ${lien_fiche("algo", monde.scenario.radar.algos.detection, monde.scenario.radar.algos.detection)}</li></ul>`;
}

function inspection_cible(indice, monde) {
  const {sol, rouge} = monde.scenario;
  const postes = monde.postes.filter((poste) => poste.cible === indice);
  const munitions = postes.reduce((somme, poste) => somme + poste.munitions, 0);
  const cadence = sol.portee / rouge.vitesse / sol.engagements_par_passage;
  return `<h3>Cible C${indice + 1}</h3>
    <table>${[
      ligne("Position", position(monde.cibles[indice].geo)),
      ligne("Postes sol", `${postes.length} × ${lien_fiche("unite", sol.id, sol.nom)}`),
      ligne("Munitions", `${format_entier(munitions)} restantes`),
      ligne("Frappes reçues", format_entier(monde.fuites[indice])),
    ].join("")}</table>
    <h4>Comment est-elle défendue ?</h4>
    <p>Chaque poste tire sur le drone le plus proche dans sa bulle de ${format_decimal(sol.portee / 1000)} km, un tir toutes les
    ${format_decimal(cadence)} s : un drone met ${format_decimal(sol.portee / rouge.vitesse)} s à traverser la bulle, où le poste
    doit loger ses ${sol.engagements_par_passage} engagements. Pk ${format_decimal(sol.pk)} par tir.</p>
    <h4>Modèles</h4><ul><li>Tir sol : ${lien_fiche("algo", sol.algos.tir_sol, sol.algos.tir_sol)}</li></ul>`;
}

/** Rendre le HTML de l'inspection de `cible` ({type: avion|drone|cible, id}) dans le monde. */
function inspection_radar(indice, monde) {
  const {radar} = monde.scenario;
  const geo = positions_radars(monde.scenario)[indice];
  const site = monde.couverture.sites?.[indice];
  const disposition = radar.disposition === "sites"
    ? "placé dans l'éditeur"
    : "matérialise la couverture « frontière » ; le déplacer dans l'éditeur place tous les radars un à un";
  const vus = monde.drones.filter((d) => d.detection !== null).length;
  return `<h3>Radar R${indice + 1}</h3>
    <p>${lien_fiche("unite", radar.id, radar.nom)} ${fidelite(radar.fidelite)}</p>
    <table>${[
      ligne("Position", position(geo)),
      ligne("Disposition", disposition),
      ligne("Antenne", `${format_entier(radar.hauteur_antenne)} m`),
      ligne("Portée instrumentée", `${format_entier(radar.portee_max / 1000)} km`),
      site ? ligne("Portée contre l'essaim", `${format_entier(site.portee / 1000)} km (horizon radar)`) : "",
      ligne("Détection", lien_fiche("algo", radar.algos.detection, radar.algos.detection)),
    ].join("")}</table>
    <h4>Réseau</h4>
    <p>Relié à toute la défense : chaque détection profite aussitôt à tous (réseau entièrement connecté, docs/MODELE.md § 15.2).
      ${format_entier(vus)} drones détectés depuis le début du raid par l'ensemble des radars.</p>`;
}

export function inspection(cible, monde) {
  if (cible.type === "radar") return inspection_radar(cible.id, monde);
  if (cible.type === "avion") return inspection_avion(monde.avions[cible.id], monde);
  if (cible.type === "drone") return inspection_drone(monde.drones[cible.id], monde);
  return inspection_cible(cible.id, monde);
}

/** Rendre la position géographique de l'entité inspectée, ou null si elle n'est plus visible (drone détruit ou arrivé). */
export function position_inspectee(cible, monde) {
  if (cible.type === "avion") return monde.avions[cible.id]?.geo ?? null;
  if (cible.type === "cible") return monde.cibles[cible.id]?.geo ?? null;
  if (cible.type === "radar") return positions_radars(monde.scenario)[cible.id] ?? null;
  const drone = monde.drones[cible.id];
  return drone && drone.vivant && !drone.arrive ? drone.geo : null;
}

/** Dessiner un double anneau autour de l'entité inspectée. */
export function dessiner_inspection(ctx, camera, cible, monde) {
  const geo = cible && position_inspectee(cible, monde);
  if (!geo) return;
  const p = ecran(camera, geo);
  ctx.strokeStyle = COULEURS.selection;
  ctx.lineWidth = 1.5;
  for (const rayon of [13, 17]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, rayon, 0, 2 * Math.PI);
    ctx.stroke();
  }
}
