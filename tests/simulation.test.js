import {test} from "node:test";
import assert from "node:assert/strict";
import {mener_campagne} from "../src/moteur/campagne.js";
import {inverse} from "../src/moteur/geodesie.js";
import {bilan, creer_monde, simuler} from "../src/moteur/monde.js";
import {modifier_scenario} from "../src/moteur/scenario.js";
import {FICHIERS, REFERENCE, scenario} from "./aide_scenario.js";

const SANS_DEFENSE = {"bleu.avions.0.nombre": 0, "bleu.avions.1.nombre": 0, "bleu.sol.nombre": 0};
const PETIT = {"rouge.nombre": 200, "rouge.concentration_max": 50};

test("déterminisme : une même graine rejoue exactement le même raid", () => {
  assert.deepEqual(bilan(simuler(scenario(PETIT), {journal: false})), bilan(simuler(scenario(PETIT), {journal: false})));
});

test("sans aucune défense, tous les drones frappent leur cible", () => {
  for (const tactique of ["direct", "disperse", "fourmi"]) {
    const resultat = bilan(simuler(scenario({...PETIT, ...SANS_DEFENSE, "rouge.tactique": tactique}), {journal: false}));
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
  const resume = mener_campagne(brut, 30, FICHIERS);
  assert.ok(resume.tirs_sol.moyenne >= 80 && resume.tirs_sol.moyenne <= 90, `tirs ${resume.tirs_sol.moyenne}`);
  const attendu = resume.tirs_sol.moyenne * 0.7;
  assert.ok(Math.abs(resume.detruits_sol.moyenne - attendu) <= resume.detruits_sol.ic95 + 1, `détruits ${resume.detruits_sol.moyenne}`);
});

test("fourmi : tout l'essaim entre par un même couloir et éclate au même endroit", () => {
  const monde = creer_monde(scenario({"rouge.tactique": "fourmi"}));
  const eclatements = monde.drones.map((drone) => drone.route[0].geo);
  assert.ok(eclatements.every((point) => inverse(point, eclatements[0]).distance <= 6_001));
  assert.ok(monde.drones.every((drone) => drone.route.length === 2));
});

test("défense aérienne : les avions détruisent des drones sans dépasser leur emport", () => {
  const resultat = bilan(simuler(scenario({...PETIT, "bleu.sol.nombre": 0, "bleu.avions.0.nombre": 4, "bleu.avions.1.nombre": 6}), {journal: false}));
  assert.ok(resultat.detruits_air > 0);
  assert.ok(resultat.tirs_air <= 10 * 12);
  assert.equal(resultat.fuites + resultat.detruits_air, 200);
});

test("journal : chaque destruction et chaque impact sont tracés pour le rejeu", () => {
  const monde = simuler(scenario(PETIT));
  const resultat = bilan(monde);
  const destructions = monde.evenements.filter((e) => e.type === "tir" && e.detruit).length;
  assert.equal(destructions, resultat.detruits_air + resultat.detruits_sol);
  assert.equal(monde.evenements.filter((e) => e.type === "impact").length, resultat.fuites);
});

test("géographie : le même raid se joue ailleurs sur le globe, y compris à cheval sur l'antiméridien", () => {
  const ailleurs = bilan(simuler(scenario({...PETIT, "theatre.origine_lat_deg": -40, "theatre.origine_lon_deg": 179.5}), {journal: false}));
  assert.equal(ailleurs.fuites + ailleurs.detruits_air + ailleurs.detruits_sol, 200);
});
