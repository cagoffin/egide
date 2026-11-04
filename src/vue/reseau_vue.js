// Synoptique du réseau d'information (MODELE § 15.2) : centre de conduite, liaisons entre radars, conduite et
// groupes d'avions, état de chaque liaison. Positions et libellés purs ; le tracé lit le monde sans le modifier.
import {chemin_cercle, ecran} from "./ecran.js";
import {COULEURS} from "./couleurs.js";
import {format_decimal} from "./format.js";
import {portee_liaison} from "../moteur/reseau.js";
import {positions_radars} from "../moteur/radars.js";

/** Tracer une croix rouge sur chaque élément hors service : radars en panne, CDC en panne ou détruit. */
export function dessiner_pannes(ctx, camera, monde) {
  const {reseau} = monde;
  const points = reseau.radars.filter((_, i) => reseau.radars_hs[i]);
  for (const centre of reseau.centres) if (centre.hs) points.push(centre.geo);
  ctx.strokeStyle = COULEURS.hostile;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  for (const geo of points) {
    const p = ecran(camera, geo);
    ctx.beginPath();
    ctx.moveTo(p.x - 11, p.y - 11);
    ctx.lineTo(p.x + 11, p.y + 11);
    ctx.moveTo(p.x + 11, p.y - 11);
    ctx.lineTo(p.x - 11, p.y + 11);
    ctx.stroke();
  }
}

/** Moyens proposés par défaut quand le réseau passe en liaisons : radars → conduite au fil, conduite → avions par radio. */
export const MOYENS_PAR_DEFAUT = {radars: "liaisons/filaire_notionnelle", avions: "liaisons/radio_vhf_uhf_notionnelle"};

/** Trait de chaque famille de moyens : couleur et pointillé. */
export const TRAITS = {
  filaire: {couleur: "#b7c4d1", tirets: []},
  radio: {couleur: COULEURS.ami, tirets: [7, 4]},
  satellite: {couleur: "#b48ee8", tirets: [2, 4]},
  optique: {couleur: "#e8d36a", tirets: [12, 3, 2, 3]},
};

/** Rendre le barycentre au sol des orbites du groupe d'avions g (point d'ancrage du groupe dans le synoptique). */
function ancrage_groupe(monde, g) {
  const avions = monde.avions.filter((a) => a.groupe === monde.scenario.avions[g]);
  if (!avions.length) return null;
  const somme = avions.reduce((s, a) => ({lat: s.lat + a.orbite.lat, lon: s.lon + a.orbite.lon}), {lat: 0, lon: 0});
  return {lat: somme.lat / avions.length, lon: somme.lon / avions.length, alt: 0};
}

/**
 * Rendre la position d'un nœud du réseau (« conduite », « centre:<k> », « radar:<i> », « avions:<g> »,
 * « sol:<i> »), ou null.
 */
export function position_noeud(monde, noeud) {
  if (noeud === "conduite") return monde.scenario.reseau.centre;
  const [famille, n] = noeud.split(":");
  if (famille === "centre") return monde.scenario.reseau.centres[Number(n)]?.geo ?? null;
  if (famille === "radar") return positions_radars(monde.scenario)[Number(n)] ?? null;
  if (famille === "sol") return monde.cibles[Number(n)]?.geo ?? null;
  return ancrage_groupe(monde, Number(n));
}

/** Rendre le nom lisible d'un nœud : « CDC », « CDC Sud », « R3 », « postes de C4 », « avions IR »… */
export function libelle_noeud(monde, noeud) {
  if (noeud === "conduite") return "CDC";
  const [famille, n] = noeud.split(":");
  if (famille === "centre") return monde.scenario.reseau.centres[Number(n)]?.nom ?? noeud;
  if (famille === "radar") return `R${Number(n) + 1}`;
  if (famille === "sol") return monde.cibles[Number(n)]?.conduite ? "postes du CDC" : `postes de C${Number(n) + 1}`;
  const groupe = monde.scenario.avions[Number(n)];
  return groupe ? `avions ${groupe.nom}` : noeud;
}

/**
 * Rendre les liaisons qui matérialisent le réseau complet : chaque radar au CDC au fil, le CDC à chaque groupe par
 * radio et aux postes sol de chaque cible au fil, chaque autre centre au CDC au fil (MODELE § 18).
 */
export function liaisons_par_defaut(monde) {
  const ciblesDefendues = monde.cibles.map((_, i) => i).filter((i) => monde.postes.some((p) => p.cible === i));
  return [
    ...positions_radars(monde.scenario).map((_, i) => ({de: `radar:${i}`, vers: "conduite", moyen: MOYENS_PAR_DEFAUT.radars})),
    ...monde.scenario.avions.map((_, g) => ({de: "conduite", vers: `avions:${g}`, moyen: MOYENS_PAR_DEFAUT.avions})),
    ...ciblesDefendues.map((i) => ({de: "conduite", vers: `sol:${i}`, moyen: MOYENS_PAR_DEFAUT.radars})),
    ...monde.scenario.reseau.centres.map((_, k) => ({de: `centre:${k}`, vers: "conduite", moyen: MOYENS_PAR_DEFAUT.radars})),
  ];
}

function trait(ctx, type, actif) {
  const style = TRAITS[type] ?? TRAITS.radio;
  ctx.strokeStyle = actif ? style.couleur : COULEURS.hostile;
  ctx.setLineDash(actif ? style.tirets : [3, 3]);
  ctx.lineWidth = actif ? 1.6 : 1.2;
}

/**
 * Tracer les centres de détection et de contrôle : cadre ami et hampe, à la manière d'un poste de commandement
 * (APP-6) ; « CDC » pour le centre principal, le nom des autres en dessous.
 */
function dessiner_centres(ctx, camera, monde) {
  monde.reseau.centres.forEach((centre, c) => {
    const p = ecran(camera, centre.geo);
    ctx.setLineDash([]);
    ctx.fillStyle = COULEURS.fond;
    ctx.strokeStyle = COULEURS.ami;
    ctx.lineWidth = 2;
    ctx.fillRect(p.x - 13, p.y - 7, 26, 14);
    ctx.strokeRect(p.x - 13, p.y - 7, 26, 14);
    ctx.beginPath();
    ctx.moveTo(p.x - 13, p.y + 7);
    ctx.lineTo(p.x - 13, p.y + 16);
    ctx.stroke();
    ctx.fillStyle = COULEURS.ami;
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c === 0 ? "CDC" : `CDC${c + 1}`, p.x, p.y + 4);
    if (c > 0) {
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(centre.nom, p.x, p.y + 20);
    }
    ctx.textAlign = "start";
  });
}

function dessiner_liaison(ctx, camera, a, b, type, actif, texte) {
  const [p, q] = [ecran(camera, a), ecran(camera, b)];
  trait(ctx, type, actif);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const m = {x: (p.x + q.x) / 2, y: (p.y + q.y) / 2};
  if (!actif) {
    ctx.strokeStyle = COULEURS.hostile;
    ctx.beginPath();
    ctx.moveTo(m.x - 5, m.y - 5);
    ctx.lineTo(m.x + 5, m.y + 5);
    ctx.moveTo(m.x + 5, m.y - 5);
    ctx.lineTo(m.x - 5, m.y + 5);
    ctx.stroke();
  }
  if (texte) {
    ctx.fillStyle = actif ? COULEURS.texte_secondaire : COULEURS.hostile;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(texte, m.x + 6, m.y - 4);
  }
}

/**
 * Tracer le synoptique : en réseau complet, un trait discret de chaque radar à la conduite ; en liaisons, chaque
 * liaison fixe avec son moyen et sa latence (rouge barrée si hors de portée), la portée de chaque accès sol-air à
 * l'altitude du groupe, et une croix rouge sur chaque avion que la conduite ne peut pas joindre.
 */
export function dessiner_reseau(ctx, camera, monde) {
  const {reseau} = monde;
  if (reseau.mode === "complet") {
    ctx.globalAlpha = 0.35;
    for (const radar of reseau.radars) dessiner_liaison(ctx, camera, radar, reseau.centre, "filaire", true, "");
    for (const centre of reseau.centres.slice(1)) dessiner_liaison(ctx, camera, centre.geo, reseau.centre, "filaire", true, "");
    ctx.globalAlpha = 1;
  } else {
    for (const l of reseau.fixes) {
      const [a, b] = [position_noeud(monde, l.de), position_noeud(monde, l.vers)];
      if (a && b) dessiner_liaison(ctx, camera, a, b, l.moyen.type, l.active, l.active ? `${format_decimal(l.moyen.latence)} s` : "hors portée");
    }
    dessiner_acces(ctx, camera, monde);
  }
  dessiner_centres(ctx, camera, monde);
}

function dessiner_acces(ctx, camera, monde) {
  monde.reseau.acces.forEach((liste, g) => {
    const groupe = monde.scenario.avions[g];
    const ancre = position_noeud(monde, `avions:${g}`);
    // Une même liaison sert plusieurs centres : on la trace une fois, avec sa latence la plus courte.
    const uniques = new Map();
    for (const a of liste) if (!uniques.has(`${a.sol}|${a.moyen.id}`) || a.latence < uniques.get(`${a.sol}|${a.moyen.id}`).latence) uniques.set(`${a.sol}|${a.moyen.id}`, a);
    for (const acces of uniques.values()) {
      if (ancre) dessiner_liaison(ctx, camera, acces.position, ancre, acces.moyen.type, true, `${format_decimal(acces.latence)} s`);
      const portee = portee_liaison(acces.moyen, acces.moyen.hauteur_antenne, groupe.altitude);
      if (portee > 2_000_000) continue;
      trait(ctx, acces.moyen.type, true);
      ctx.globalAlpha = 0.5;
      chemin_cercle(ctx, camera, acces.position, portee, 96);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  });
  ctx.strokeStyle = COULEURS.hostile;
  ctx.lineWidth = 1.5;
  for (const avion of monde.avions) {
    if (avion.acces !== null || avion.munitions === 0) continue;
    const p = ecran(camera, avion.geo);
    ctx.beginPath();
    ctx.moveTo(p.x + 6, p.y - 10);
    ctx.lineTo(p.x + 12, p.y - 4);
    ctx.moveTo(p.x + 12, p.y - 10);
    ctx.lineTo(p.x + 6, p.y - 4);
    ctx.stroke();
  }
}
