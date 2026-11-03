import {test} from "node:test";
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
  assert.ok([1, 2, 5].includes(longueur_ronde(CAMERA, 120) / 10 ** Math.floor(Math.log10(longueur_ronde(CAMERA, 120)))));
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
