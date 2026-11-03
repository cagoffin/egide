import {test} from "node:test";
import assert from "node:assert/strict";
import {creer_hasard, melanger} from "../src/moteur/hasard.js";
import {ScenarioInvalide, lire_scenario} from "../src/moteur/scenario.js";
import {resumer} from "../src/moteur/statistiques.js";
import {delai_interception} from "../src/moteur/defense_air.js";
import {repartir_drones} from "../src/moteur/menace.js";
import {REFERENCE, scenario} from "./aide_scenario.js";

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

test("scénario de référence : converti en SI", () => {
  const s = scenario();
  assert.equal(s.zone_rayon, 150_000);
  assert.ok(Math.abs(s.drones_vitesse - 222.222) < 1e-3);
});
test("scénario : clé manquante refusée", () => {
  const {sol_pk: _, ...sansPk} = REFERENCE;
  assert.throws(() => lire_scenario({...sansPk, _aide: {...REFERENCE._aide}}), ScenarioInvalide);
});
test("scénario : clé sans phrase d'aide refusée", () => {
  const {graine: _, ...aide} = REFERENCE._aide;
  assert.throws(() => lire_scenario({...REFERENCE, _aide: aide}), /_aide/);
});

test("statistiques : moyenne, écart-type et IC à 95 %", () => {
  const resume = resumer([1, 2, 3]);
  assert.equal(resume.moyenne, 2);
  assert.equal(resume.ecart_type, 1);
  assert.ok(Math.abs(resume.ic95 - 1.96 / Math.sqrt(3)) < 1e-12);
});

test("répartition : au plus la concentration maximale par cible, en ceil(n / c) groupes", () => {
  const cibles = repartir_drones(scenario({drones_concentration_max: 300}), creer_hasard(1));
  const parCible = Object.values(Object.groupBy(cibles, (c) => c)).map((groupe) => groupe.length);
  assert.equal(parCible.length, 4);
  assert.ok(parCible.every((n) => n <= 300));
});

test("délai d'interception : drone de face à 50 km, rapprochement à 361 m/s, portée 8 km → 116 s", () => {
  const drone = {position: {x: 50_000, y: 0}, vitesse: {x: -222.222, y: 0}};
  assert.ok(Math.abs(delai_interception({x: 0, y: 0}, drone, 138.889, 8_000) - 42_000 / 361.111) < 0.01);
});
test("délai d'interception : nul quand le drone est déjà à portée", () => {
  const drone = {position: {x: 5_000, y: 0}, vitesse: {x: 222, y: 0}};
  assert.equal(delai_interception({x: 0, y: 0}, drone, 138.889, 8_000), 0);
});
test("délai d'interception : impossible quand le drone, plus rapide, s'éloigne", () => {
  const drone = {position: {x: 50_000, y: 0}, vitesse: {x: 222.222, y: 0}};
  assert.equal(delai_interception({x: 0, y: 0}, drone, 138.889, 8_000), null);
});
