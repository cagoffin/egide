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
