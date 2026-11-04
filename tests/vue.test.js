import {test} from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {creer_camera, deplacer, longueur_ronde, vers_ecran, vers_monde, zoomer} from "../src/vue/camera.js";
import {format_distance, format_duree, format_intervalle} from "../src/vue/format.js";
import {pas_rond} from "../src/vue/graphique.js";

const CAMERA = creer_camera(800, 600, 300_000);

test("caméra : le centre du monde tombe au centre du canevas, nord en haut", () => {
  assert.deepEqual(vers_ecran(CAMERA, {x: 0, y: 0}), {x: 400, y: 300});
  assert.ok(vers_ecran(CAMERA, {x: 0, y: 100_000}).y < 300);
});
test("caméra : écran → monde est l'inverse de monde → écran", () => {
  const point = {x: 12_345, y: -67_890};
  const retour = vers_monde(CAMERA, vers_ecran(CAMERA, point));
  assert.ok(Math.abs(retour.x - point.x) < 1e-6 && Math.abs(retour.y - point.y) < 1e-6);
});
test("caméra : le zoom garde fixe le point sous le curseur", () => {
  const curseur = {x: 120, y: 450};
  const avant = vers_monde(CAMERA, curseur);
  const apres = vers_monde(zoomer(CAMERA, 2.5, curseur), curseur);
  assert.ok(Math.abs(avant.x - apres.x) < 1e-6 && Math.abs(avant.y - apres.y) < 1e-6);
});
test("caméra : glisser vers la droite montre ce qui était à gauche", () => {
  assert.ok(deplacer(CAMERA, 100, 0).centre.x < 0);
});
test("caméra : la barre d'échelle prend une longueur ronde", () => {
  assert.ok([1, 2, 5].includes(longueur_ronde(1 / CAMERA.echelle, 120) / 10 ** Math.floor(Math.log10(longueur_ronde(1 / CAMERA.echelle, 120)))));
});

test("format : durées en minutes:secondes", () => {
  assert.equal(format_duree(725.4), "12:05");
  assert.equal(format_duree(-3), "0:00");
});
test("format : distances en m sous le km, en km au-delà", () => {
  assert.equal(format_distance(800), "800 m");
  assert.equal(format_distance(12_500), "12,5 km");
});
test("format : moyenne et intervalle de confiance à la française", () => {
  assert.equal(format_intervalle({moyenne: 187.24, ic95: 10.51}), "187,2 ± 10,5");
});

test("graphique : graduations rondes, 4 à 8 intervalles", () => {
  for (const maximum of [7, 712.8, 1000, 3.2, 58_000]) {
    const pas = pas_rond(maximum);
    const intervalles = Math.ceil(maximum / pas);
    assert.ok(intervalles >= 2 && intervalles <= 8, `${maximum} → pas ${pas}`);
    assert.ok([1, 2, 5].includes(Math.round(pas / 10 ** Math.floor(Math.log10(pas)))), `${pas}`);
  }
});

import {projeter} from "../src/vue/camera.js";
import {aide_chemin, valeur_effective} from "../src/vue/chemins.js";
import {direct, geo_deg} from "../src/moteur/geodesie.js";
import {FICHIERS, REFERENCE} from "./aide_scenario.js";

test("projection : la distance au centre est conservée à 0,5 % près jusqu'à 300 km", () => {
  const origine = geo_deg(47, 2.5);
  for (const azimut of [0, 1, 2.5, 4]) {
    const point = direct(origine, azimut, 300_000);
    const plan = projeter(origine, point);
    assert.ok(Math.abs(Math.hypot(plan.x, plan.y) - 300_000) < 1500);
  }
});
test("projection : le nord est en haut, l'est à droite", () => {
  const origine = geo_deg(47, 2.5);
  assert.ok(projeter(origine, direct(origine, 0, 10_000)).y > 9_000);
  assert.ok(projeter(origine, direct(origine, Math.PI / 2, 10_000)).x > 9_000);
});
test("chemins : une surcharge absente affiche la valeur de l'unité, une présente l'emporte", () => {
  assert.equal(valeur_effective(REFERENCE, FICHIERS, "rouge.surcharges.vitesse_kmh"), 800);
  assert.equal(valeur_effective(REFERENCE, FICHIERS, "bleu.avions.0.surcharges_emport.portee_km"), 8);
  assert.equal(valeur_effective(REFERENCE, FICHIERS, "bleu.avions.1.nombre"), 30);
});
test("chemins : l'aide vient du scénario, d'un tableau du scénario ou du fichier d'unité", () => {
  assert.match(aide_chemin(REFERENCE, FICHIERS, "rouge.concentration_max"), /meme cible/);
  assert.match(aide_chemin(REFERENCE, FICHIERS, "bleu.avions.1.nombre"), /groupe/);
  assert.match(aide_chemin(REFERENCE, FICHIERS, "bleu.avions.1.surcharges_emport.duree_designation_s"), /designation/);
});

import {bornes_disque, style_carte} from "../src/vue/carte_style.js";

const SOURCES = Object.fromEntries(
  JSON.parse(readFileSync(new URL("../cartes/index.json", import.meta.url))).map(({id}) => [id, JSON.parse(readFileSync(new URL(`../cartes/${id}.json`, import.meta.url)))]),
);

test("carte : le style empile fond, ombrage et bâtiments selon les réglages, avec leurs attributions", () => {
  const style = style_carte(SOURCES, {fond: "fonds/osm", ombrage: true, relief_3d: false, batiments: true, globe: false});
  assert.deepEqual(style.layers.map((c) => c.id), ["fond-uni", "fond", "ombrage", "batiments"]);
  assert.match(style.sources.fond.attribution, /OpenStreetMap/);
  assert.equal(style.terrain, undefined);
  assert.equal(style.projection.type, "mercator");
});
test("carte : fond « aucun » et globe — rien à télécharger pour le fond, projection globe", () => {
  const style = style_carte(SOURCES, {fond: "fonds/aucun", ombrage: false, relief_3d: true, batiments: false, globe: true});
  assert.equal(style.sources.fond, undefined);
  assert.equal(style.terrain.source, "relief_3d");
  assert.equal(style.projection.type, "globe");
});
test("carte : les bornes du disque de 200 km encadrent le centre et s'élargissent en longitude avec la latitude", () => {
  const [[o, s], [e, n]] = bornes_disque(geo_deg(47, 2.5), 200_000);
  assert.ok(o < 2.5 && e > 2.5 && s < 47 && n > 47);
  const [[o2], [e2]] = bornes_disque(geo_deg(65, 2.5), 200_000);
  assert.ok(e2 - o2 > e - o);
});

import {barycentre, dans_rectangle, element_sous, en_degres, modifications_ajout_cible, modifications_ajout_passage, modifications_deplacement, modifications_suppression, translater} from "../src/vue/edition.js";
import {creer_monde} from "../src/moteur/monde.js";
import {inverse} from "../src/moteur/geodesie.js";
import {REGISTRE, scenario} from "./aide_scenario.js";

const MONDE = creer_monde(scenario(), {registre: REGISTRE});

test("édition : une translation garde distance et azimut par rapport au point de référence", () => {
  const de = geo_deg(47, 2.5), vers = geo_deg(48, 3), point = direct(de, 1, 20_000);
  const deplace = translater(point, de, vers);
  assert.ok(Math.abs(inverse(vers, deplace).distance - 20_000) < 1e-3);
});
test("édition : le barycentre de deux points symétriques est le milieu", () => {
  const b = barycentre([geo_deg(47, 2), geo_deg(47, 3)]);
  assert.ok(Math.abs(b.lon - (2.5 * Math.PI) / 180) < 1e-9);
});
test("édition : déplacer une cible fige toutes les cibles et ne bouge qu'elle", () => {
  const de = MONDE.cibles[2].geo;
  const vers = direct(de, 0, 10_000);
  const m = modifications_deplacement(MONDE, REFERENCE, ["cible:2"], de, vers);
  assert.equal(m["theatre.cibles_placees"].length, MONDE.cibles.length);
  assert.deepEqual(m["theatre.cibles_placees"][0], en_degres(MONDE.cibles[0].geo));
  assert.ok(Math.abs(m["theatre.cibles_placees"][2].lat_deg - en_degres(vers).lat_deg) < 1e-6);
  assert.equal(Object.keys(m).some((k) => k.startsWith("bleu")), false);
});
test("édition : déplacer un avion fige les orbites de son seul groupe", () => {
  const avion = MONDE.avions[25];
  const m = modifications_deplacement(MONDE, REFERENCE, [`avion:${avion.id}`], avion.orbite, direct(avion.orbite, 1, 5_000));
  assert.deepEqual(Object.keys(m), ["bleu.avions.1.orbites_placees"]);
  assert.equal(m["bleu.avions.1.orbites_placees"].length, 30);
});
test("édition : ajouter une cible, un point de passage ; supprimer en gardant au moins une cible", () => {
  assert.equal(modifications_ajout_cible(MONDE, geo_deg(47, 2.5))["theatre.cibles_nombre"], MONDE.cibles.length + 1);
  const passage = modifications_ajout_passage(REFERENCE, geo_deg(49, 1));
  assert.equal(passage["rouge.tactique"], "plan_de_vol");
  assert.deepEqual(passage["rouge.plan_de_vol"], [{lat_deg: 49, lon_deg: 1}]);
  const toutes = MONDE.cibles.map((_, i) => `cible:${i}`);
  assert.deepEqual(modifications_suppression(MONDE, REFERENCE, toutes), {});
  assert.equal(modifications_suppression(MONDE, REFERENCE, ["cible:0"])["theatre.cibles_nombre"], MONDE.cibles.length - 1);
});
test("édition : sélection au rectangle et au clic, dans le repère écran", () => {
  const elements = [{cle: "a", geo: {x: 10, y: 10}}, {cle: "b", geo: {x: 50, y: 80}}];
  const versEcran = (g) => g;
  assert.deepEqual(dans_rectangle(elements, versEcran, {x0: 60, y0: 90, x1: 0, y1: 0}), ["a", "b"]);
  assert.deepEqual(dans_rectangle(elements, versEcran, {x0: 0, y0: 0, x1: 20, y1: 20}), ["a"]);
  assert.equal(element_sous(elements, versEcran, {x: 52, y: 77}).cle, "b");
  assert.equal(element_sous(elements, versEcran, {x: 200, y: 200}), null);
});

import {elements_editables, modifications_ajout_zone, modifications_ordre} from "../src/vue/edition.js";

test("édition : une zone s'ajoute, se sélectionne par son barycentre, se déplace d'un bloc et se supprime", () => {
  const points = [geo_deg(47.2, 2.2), geo_deg(47.2, 2.8), geo_deg(46.8, 2.5)];
  const ajout = modifications_ajout_zone(REFERENCE, points);
  assert.equal(ajout["theatre.zones"][0].type, "protegee");
  const brut = {...REFERENCE, theatre: {...REFERENCE.theatre, zones: ajout["theatre.zones"]}};
  const zone = elements_editables(MONDE, brut).find((e) => e.cle === "zone:0");
  const vers = direct(zone.geo, 0, 20_000);
  const deplacee = modifications_deplacement(MONDE, brut, ["zone:0"], zone.geo, vers)["theatre.zones"][0];
  assert.ok(deplacee.points.every((p, i) => p.lat_deg > ajout["theatre.zones"][0].points[i].lat_deg));
  assert.deepEqual(modifications_suppression(MONDE, brut, ["zone:0"])["theatre.zones"], []);
});
test("ordres : en mode ordres, seuls les avions sont éditables ; l'ordre porte l'instant et les numéros", () => {
  assert.ok(elements_editables(MONDE, REFERENCE, "ordres").every((e) => e.type === "avion"));
  const monde = {...MONDE, t: 412.5};
  const m = modifications_ordre(REFERENCE, monde, ["avion:3", "avion:7", "cible:1"], geo_deg(47.5, 2));
  assert.deepEqual(m["bleu.ordres"], [{t_s: 412.5, avions: [3, 7], lat_deg: 47.5, lon_deg: 2}]);
  assert.deepEqual(modifications_ordre(REFERENCE, monde, ["cible:1"], geo_deg(47.5, 2)), {});
});

import {altitude_terrarium, echantillonner_chemin, tuile_de} from "../src/vue/relief.js";

test("relief : décodage terrarium — (128, 0, 0) vaut le niveau de la mer, (130, 196, 128) vaut 708,5 m", () => {
  assert.equal(altitude_terrarium(128, 0, 0), 0);
  assert.equal(altitude_terrarium(130, 196, 128), 708.5);
});
test("relief : tuile et pixel Web Mercator — (0°, 0°) au coin de la tuile centrale, Paris en tuile (518, 352) au zoom 10", () => {
  assert.deepEqual(tuile_de(geo_deg(0, 0), 1), {x: 1, y: 1, px: 0, py: 0});
  const paris = tuile_de(geo_deg(48.8566, 2.3522), 10);
  assert.deepEqual([paris.x, paris.y], [518, 352]);
});
test("relief : l'échantillonnage d'un chemin couvre toute sa longueur et marque chaque point de passage", () => {
  const points = [geo_deg(47, 1), direct(geo_deg(47, 1), 1, 50_000)];
  points.push(direct(points[1], 2.5, 30_000));
  const e = echantillonner_chemin(points, 1_000);
  // Vincenty direct puis inverse : cohérents au dixième de millimètre près, pas au-delà.
  assert.ok(Math.abs(e.at(-1).distance - 80_000) < 1e-3);
  assert.deepEqual(e.filter((x) => x.passage !== null).map((x) => x.passage), [0, 1, 2]);
});
