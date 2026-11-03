import {test} from "node:test";
import assert from "node:assert/strict";
import {mener_campagne} from "../src/campagne.js";
import {bilan, creer_monde, simuler} from "../src/moteur/monde.js";
import {distance} from "../src/moteur/vecteurs.js";
import {REFERENCE, scenario} from "./aide_scenario.js";
import {modifier_scenario} from "../src/moteur/scenario.js";

const SANS_DEFENSE = {avions_nombre: 0, avions_ir_nombre: 0, sol_postes_nombre: 0};
const PETIT = {drones_nombre: 200, drones_concentration_max: 50};

test("déterminisme : une même graine rejoue exactement le même raid", () => {
  const premier = bilan(simuler(scenario(PETIT), {journal: false}));
  const second = bilan(simuler(scenario(PETIT), {journal: false}));
  assert.deepEqual(premier, second);
});

test("sans aucune défense, tous les drones frappent leur cible", () => {
  for (const tactique of ["direct", "disperse", "fourmi"]) {
    const resultat = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE, drones_tactique: tactique}), {journal: false}));
    assert.equal(resultat.fuites, 200, tactique);
  }
});

test("défense sol seule : le MODELE § 5 se retrouve (tirs par poste et destructions = tirs × Pk)", () => {
  // Une vague de 100 drones sur une cible, 10 postes à 8 engagements par passage. La simulation à pas discret
  // place un tir à l'entrée et un à l'arrivée de la bulle : 8 à 9 tirs par poste, jamais moins.
  const brut = modifier_scenario(REFERENCE, {
    ...SANS_DEFENSE, cibles_nombre: 1, drones_nombre: 100, drones_concentration_max: 100,
    drones_tactique: "direct", sol_postes_nombre: 10, sol_roquettes_nombre: 10_000,
  });
  const resume = mener_campagne(brut, 30);
  assert.ok(resume.tirs_sol.moyenne >= 80 && resume.tirs_sol.moyenne <= 90, `tirs ${resume.tirs_sol.moyenne}`);
  const attendu = resume.tirs_sol.moyenne * 0.7;
  assert.ok(Math.abs(resume.detruits_sol.moyenne - attendu) <= resume.detruits_sol.ic95 + 1, `détruits ${resume.detruits_sol.moyenne}`);
});

test("fourmi : tout l'essaim entre par un même couloir et éclate au même endroit", () => {
  const largeur = 6_000;
  const monde = creer_monde(scenario({drones_tactique: "fourmi"}));
  const eclatements = monde.drones.map((drone) => drone.route[0]);
  const reference = eclatements[0];
  assert.ok(eclatements.every((point) => distance(point, reference) <= largeur));
  assert.ok(monde.drones.every((drone) => drone.route.length === 2));
});

test("défense aérienne : les avions détruisent des drones sans dépasser leur emport", () => {
  const resultat = bilan(simuler(scenario({...PETIT, sol_postes_nombre: 0, avions_nombre: 10, avions_ir_nombre: 4}), {journal: false}));
  assert.ok(resultat.detruits_air > 0);
  assert.ok(resultat.tirs_air <= 10 * REFERENCE.avions_roquettes_par_avion);
  assert.equal(resultat.fuites + resultat.detruits_air, 200);
});

test("journal : chaque destruction et chaque impact sont tracés pour le rejeu", () => {
  const monde = simuler(scenario({...PETIT}));
  const resultat = bilan(monde);
  const destructions = monde.evenements.filter((e) => e.type === "tir" && e.detruit).length;
  const impacts = monde.evenements.filter((e) => e.type === "impact").length;
  assert.equal(destructions, resultat.detruits_air + resultat.detruits_sol);
  assert.equal(impacts, resultat.fuites);
});
