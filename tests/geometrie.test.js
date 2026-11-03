import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as geometrie from "../src/moteur/geometrie.js";

const references = JSON.parse(readFileSync(new URL("./references.json", import.meta.url)));

for (const cas of references.cas) {
  test(`${cas.fonction} rend la valeur de référence ${cas.attendu}${cas.note ? ` (${cas.note})` : ""}`, () => {
    const obtenu = geometrie[cas.fonction](...cas.arguments);
    const ecart = Math.abs(obtenu - cas.attendu) / Math.abs(cas.attendu);
    assert.ok(ecart <= references.tolerance_relative, `obtenu ${obtenu}`);
  });
}

test("vitesse_minimale : infinie quand on veut plus d'avions qu'il n'y en a", () => {
  assert.equal(geometrie.vitesse_minimale(5, 6, 150_000, 8_000, 360), Infinity);
});
test("vitesse_minimale : nulle quand la portée de l'arme couvre déjà la cellule", () => {
  assert.equal(geometrie.vitesse_minimale(1000, 1, 150_000, 8_000, 360), 0);
});
test("avions_concentrables : plafonnés au nombre d'avions", () => {
  assert.equal(geometrie.avions_concentrables(50, 400_000, 150_000), 50);
});
