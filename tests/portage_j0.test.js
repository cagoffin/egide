// Critère d'acceptation du portage dans algos/global/ : le moteur branché sur le registre rend, raid par raid,
// exactement les bilans du moteur du jalon 0.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bilan, simuler} from "../src/moteur/monde.js";
import {REGISTRE, scenario} from "./aide_scenario.js";

const J0 = JSON.parse(readFileSync(new URL("./references_j0.json", import.meta.url)));

for (const [nom, {modifications, bilan: attendu}] of Object.entries(J0.cas)) {
  test(`portage : le raid « ${nom} » rend exactement le bilan du jalon 0`, () => {
    // Le jalon 0 ne détruisait pas les cibles (MODELE § 23) : on le rejoue sans seuil de destruction.
    const avantDestruction = {...modifications, "theatre.frappes_destruction": null};
    assert.deepEqual(bilan(simuler(scenario(avantDestruction), {registre: REGISTRE, journal: false})), attendu);
  });
}
