import {test} from "node:test";
import assert from "node:assert/strict";
import {creer_hasard, melanger} from "../src/moteur/hasard.js";
import {resumer} from "../src/moteur/statistiques.js";
import {delai_interception as delai} from "../algos/global/allocation/densite_pistes.js";
import {OUTILS} from "../src/moteur/outils.js";
import {repartir_drones} from "../src/moteur/menace.js";
import {scenario} from "./aide_scenario.js";

test("hasard : une même graine rejoue la même suite", () => {
  const a = creer_hasard(7), b = creer_hasard(7);
  assert.deepEqual([a.uniforme(), a.uniforme(), a.entier(10)], [b.uniforme(), b.uniforme(), b.entier(10)]);
});
test("hasard : moyenne d'une loi uniforme proche de 1/2", () => {
  const hasard = creer_hasard(1);
  const tirages = Array.from({length: 20_000}, () => hasard.uniforme());
  assert.ok(Math.abs(resumer(tirages).moyenne - 0.5) < 0.01);
});
test("melanger : permutation des mêmes éléments", () => {
  assert.deepEqual(melanger([1, 2, 3, 4, 5], creer_hasard(3)).sort(), [1, 2, 3, 4, 5]);
});

test("statistiques : moyenne, écart-type et IC à 95 %", () => {
  const resume = resumer([1, 2, 3]);
  assert.equal(resume.moyenne, 2);
  assert.equal(resume.ecart_type, 1);
  assert.ok(Math.abs(resume.ic95 - 1.96 / Math.sqrt(3)) < 1e-12);
});

test("répartition : au plus la concentration maximale par cible, en ceil(n / c) groupes", () => {
  const cibles = repartir_drones(scenario({"rouge.concentration_max": 300}), creer_hasard(1));
  const parCible = Object.values(Object.groupBy(cibles, (c) => c)).map((groupe) => groupe.length);
  assert.equal(parCible.length, 4);
  assert.ok(parCible.every((n) => n <= 300));
});

const DRONE_DE_FACE = {position: {x: 50_000, y: 0, z: 0}, vitesse: {x: -222.222, y: 0, z: 0}};
test("délai d'interception : drone de face à 50 km, rapprochement à 361 m/s, portée 8 km → 116 s", () => {
  assert.ok(Math.abs(delai({x: 0, y: 0, z: 0}, DRONE_DE_FACE, 138.889, 8_000, OUTILS) - 42_000 / 361.111) < 0.01);
});
test("délai d'interception : invariant par rotation du repère 3D", () => {
  const c = Math.SQRT1_2;
  const tourne = {position: {x: 0, y: 50_000 * c, z: 50_000 * c}, vitesse: {x: 0, y: -222.222 * c, z: -222.222 * c}};
  assert.ok(Math.abs(delai({x: 0, y: 0, z: 0}, tourne, 138.889, 8_000, OUTILS) - 42_000 / 361.111) < 0.01);
});
test("délai d'interception : nul quand le drone est déjà à portée", () => {
  const drone = {position: {x: 5_000, y: 0, z: 1_000}, vitesse: {x: 222, y: 0, z: 0}};
  assert.equal(delai({x: 0, y: 0, z: 0}, drone, 138.889, 8_000, OUTILS), 0);
});
test("délai d'interception : impossible quand le drone, plus rapide, s'éloigne", () => {
  const drone = {position: {x: 50_000, y: 0, z: 0}, vitesse: {x: 222.222, y: 0, z: 0}};
  assert.equal(delai({x: 0, y: 0, z: 0}, drone, 138.889, 8_000, OUTILS), null);
});
