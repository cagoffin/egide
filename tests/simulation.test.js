import {test} from "node:test";
import assert from "node:assert/strict";
import {mener_campagne} from "../src/moteur/campagne.js";
import {inverse} from "../src/moteur/geodesie.js";
import {avancer_monde, bilan, creer_monde, simuler} from "../src/moteur/monde.js";
import {modifier_scenario} from "../src/moteur/scenario.js";
import {FICHIERS, REFERENCE, REGISTRE, scenario} from "./aide_scenario.js";

const SANS_DEFENSE = {"bleu.avions.0.nombre": 0, "bleu.avions.1.nombre": 0, "bleu.sol.nombre": 0};
const PETIT = {"rouge.nombre": 200, "rouge.concentration_max": 50};

test("déterminisme : une même graine rejoue exactement le même raid", () => {
  assert.deepEqual(bilan(simuler(scenario(PETIT), {registre: REGISTRE, journal: false})), bilan(simuler(scenario(PETIT), {registre: REGISTRE, journal: false})));
});

test("sans aucune défense, tous les drones frappent leur cible", () => {
  for (const tactique of ["direct", "disperse", "fourmi"]) {
    const resultat = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE, "rouge.tactique": tactique}), {registre: REGISTRE, journal: false}));
    assert.equal(resultat.fuites, 200, tactique);
  }
});

test("défense sol seule : le MODELE § 5 se retrouve (tirs par poste et destructions = tirs × Pk)", () => {
  // Une vague de 100 drones sur une cible, 10 postes à 8 engagements par passage. Le pas discret place un tir à
  // l'entrée et un à l'arrivée de la bulle : 8 à 9 tirs par poste, jamais moins.
  const brut = modifier_scenario(REFERENCE, {
    ...SANS_DEFENSE, "theatre.cibles_nombre": 1, "rouge.nombre": 100, "rouge.concentration_max": 100,
    "rouge.tactique": "direct", "bleu.sol.nombre": 10, "bleu.sol.munitions": 10_000,
  });
  const resume = mener_campagne(brut, 30, FICHIERS, REGISTRE);
  assert.ok(resume.tirs_sol.moyenne >= 80 && resume.tirs_sol.moyenne <= 90, `tirs ${resume.tirs_sol.moyenne}`);
  const attendu = resume.tirs_sol.moyenne * 0.7;
  assert.ok(Math.abs(resume.detruits_sol.moyenne - attendu) <= resume.detruits_sol.ic95 + 1, `détruits ${resume.detruits_sol.moyenne}`);
});

test("fourmi : tout l'essaim entre par un même couloir et éclate au même endroit", () => {
  const monde = creer_monde(scenario({"rouge.tactique": "fourmi"}), {registre: REGISTRE});
  const eclatements = monde.drones.map((drone) => drone.route[0].geo);
  assert.ok(eclatements.every((point) => inverse(point, eclatements[0]).distance <= 6_001));
  assert.ok(monde.drones.every((drone) => drone.route.length === 2));
});

test("défense aérienne : les avions détruisent des drones sans dépasser leur emport", () => {
  const resultat = bilan(simuler(scenario({...PETIT, "bleu.sol.nombre": 0, "bleu.avions.0.nombre": 4, "bleu.avions.1.nombre": 6}), {registre: REGISTRE, journal: false}));
  assert.ok(resultat.detruits_air > 0);
  assert.ok(resultat.tirs_air <= 10 * 12);
  assert.equal(resultat.fuites + resultat.detruits_air, 200);
});

test("journal : chaque destruction et chaque impact sont tracés pour le rejeu", () => {
  const monde = simuler(scenario(PETIT), {registre: REGISTRE});
  const resultat = bilan(monde);
  const destructions = monde.evenements.filter((e) => e.type === "tir" && e.detruit).length;
  assert.equal(destructions, resultat.detruits_air + resultat.detruits_sol);
  assert.equal(monde.evenements.filter((e) => e.type === "impact").length, resultat.fuites);
});

test("géographie : le même raid se joue ailleurs sur le globe, y compris à cheval sur l'antiméridien", () => {
  const ailleurs = bilan(simuler(scenario({...PETIT, "theatre.origine_lat_deg": -40, "theatre.origine_lon_deg": 179.5}), {registre: REGISTRE, journal: false}));
  assert.equal(ailleurs.fuites + ailleurs.detruits_air + ailleurs.detruits_sol, 200);
});

test("éditeur : cibles et orbites placées à la main sont prises telles quelles, les autres tirées au hasard", () => {
  const monde = creer_monde(scenario({
    "theatre.cibles_placees": [{lat_deg: 47.1, lon_deg: 2.6}, {lat_deg: 46.9, lon_deg: 2.2}], "theatre.cibles_nombre": 4,
    "bleu.avions.0.orbites_placees": [{lat_deg: 47.3, lon_deg: 2.4}],
  }), {registre: REGISTRE});
  assert.equal(monde.cibles.length, 4);
  assert.ok(Math.abs(monde.cibles[1].geo.lat - (46.9 * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(monde.avions[0].orbite.lon - (2.4 * Math.PI) / 180) < 1e-12);
  assert.equal(monde.avions[0].orbite.alt, 1000);
});

test("éditeur : des cibles placées en nombre supérieur au réglage l'emportent", () => {
  const placees = [0, 1, 2].map((i) => ({lat_deg: 47 + i * 0.2, lon_deg: 2.5}));
  assert.equal(scenario({"theatre.cibles_placees": placees, "theatre.cibles_nombre": 1}).theatre.cibles_nombre, 3);
});

test("plan de vol : l'essaim passe par chaque point du plan avant de rejoindre ses cibles", () => {
  const plan = [{lat_deg: 49.2, lon_deg: 0.8}, {lat_deg: 48.4, lon_deg: 1.4}, {lat_deg: 47.6, lon_deg: 2.0}];
  const monde = creer_monde(scenario({...PETIT, "rouge.tactique": "plan_de_vol", "rouge.plan_de_vol": plan}), {registre: REGISTRE});
  for (const drone of monde.drones) {
    assert.equal(drone.route.length, 3);
    // Chaque point de passage du drone est à moins d'une demi-largeur de colonne (3 km) du point du plan.
    plan.slice(1).forEach((p, i) => assert.ok(inverse(drone.route[i].geo, {lat: (p.lat_deg * Math.PI) / 180, lon: (p.lon_deg * Math.PI) / 180}).distance <= 3_001));
  }
  const resultat = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE, "rouge.tactique": "plan_de_vol", "rouge.plan_de_vol": plan}), {registre: REGISTRE, journal: false}));
  assert.equal(resultat.fuites, 200);
});

const ZONE = {nom: "Z", type: "protegee", points: [{lat_deg: 47.4, lon_deg: 1.8}, {lat_deg: 47.4, lon_deg: 3.2}, {lat_deg: 46.6, lon_deg: 3.2}, {lat_deg: 46.6, lon_deg: 1.8}]};

test("zones : chaque drone entré dans une zone protégée y compte une fois ; sans zone, le bilan garde sa forme", () => {
  const sansZone = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE}), {registre: REGISTRE, journal: false}));
  assert.equal("incursions" in sansZone, false);
  const avecZones = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE, "theatre.zones": [ZONE, {...ZONE, nom: "A", type: "annotation"}]}), {registre: REGISTRE, journal: false}));
  assert.equal(avecZones.incursions.length, 2);
  assert.ok(avecZones.incursions[0] > 0 && avecZones.incursions[0] <= 200);
  assert.equal(avecZones.incursions[1], 0, "une annotation ne compte rien");
});

test("zones : appartenance juste pour un carré de 1° autour du centre, dans le plan tangent", async () => {
  const {preparer_zone, contient} = await import("../src/moteur/zones.js");
  const {geo_deg, vers_ecef} = await import("../src/moteur/geodesie.js");
  const zone = preparer_zone(scenario({"theatre.zones": [ZONE]}).theatre.zones[0]);
  assert.equal(contient(zone, vers_ecef(geo_deg(47, 2.5, 100))), true);
  assert.equal(contient(zone, vers_ecef(geo_deg(47.5, 2.5, 100))), false);
  assert.equal(contient(zone, vers_ecef(geo_deg(47, 3.3, 100))), false);
});

test("ordres : à l'instant dit, les avions cités rallient le point, puis la conduite les reprend ; rejeu identique", () => {
  const ordre = {t_s: 300, avions: [0, 1, 2], lat_deg: 47.9, lon_deg: 1.2};
  const s = scenario({...PETIT, "bleu.ordres": [ordre]});
  const monde = creer_monde(s, {registre: REGISTRE});
  while (monde.t < 300) avancer_monde(monde);
  assert.ok([0, 1, 2].every((id) => monde.avions[id].ordre && monde.avions[id].etat !== "orbite"));
  assert.ok(monde.evenements.some((e) => e.type === "ordre" && e.avions.length === 3));
  // L'avion 0 finit par rallier le point (à quelques centaines de m près, sa route est recalculée à chaque pas),
  // puis la conduite le reprend : l'ordre est levé.
  const point = s.ordres[0].point;
  let plusPres = Infinity;
  while (monde.avions[0].ordre && monde.t < 7_200) {
    avancer_monde(monde);
    plusPres = Math.min(plusPres, inverse(monde.avions[0].geo, point).distance);
  }
  assert.equal(monde.avions[0].ordre, false);
  assert.ok(plusPres < 500, `au plus près : ${plusPres} m`);
  assert.deepEqual(bilan(simuler(s, {registre: REGISTRE, journal: false})), bilan(simuler(s, {registre: REGISTRE, journal: false})));
});

test("radars placés : la disposition frontière matérialisée détecte comme la frontière ; sans radar proche, rien n'est vu", async () => {
  const {sites_frontiere} = await import("../src/moteur/radars.js");
  const en_degres = (g) => ({lat_deg: (g.lat * 180) / Math.PI, lon_deg: (g.lon * 180) / Math.PI});
  const reference = scenario(PETIT);
  const sites = sites_frontiere(reference).map(en_degres);
  assert.ok(sites.length >= 3);
  const places = scenario({...PETIT, "bleu.radar.disposition": "sites", "bleu.radar.sites": sites});
  assert.equal(places.radar.algos.detection, "global/detection/sites_radar");
  const monde = simuler(places, {registre: REGISTRE, journal: false});
  assert.ok(monde.drones.every((d) => d.detection !== null), "chaque drone qui franchit la frontière est vu");
  const loin = scenario({...PETIT, "bleu.radar.disposition": "sites", "bleu.radar.sites": [{lat_deg: 60, lon_deg: 2.5}]});
  const aveugle = simuler(loin, {registre: REGISTRE, journal: false});
  assert.ok(aveugle.drones.every((d) => d.detection === null), "un radar à 1 400 km ne voit rien");
  assert.ok(bilan(aveugle).fuites > bilan(monde).fuites, "sans pistes, la conduite ne guide personne : plus de frappes");
  assert.throws(() => scenario({"bleu.radar.disposition": "sites"}), /au moins un radar/);
  assert.throws(() => scenario({"bleu.radar.disposition": "partout"}), /disposition/);
});
