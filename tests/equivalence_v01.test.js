// Critère d'acceptation du jalon 0 : le moteur géodésique retrouve les statistiques du moteur plan de la v0.1.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mener_campagne} from "../src/moteur/campagne.js";
import {modifier_scenario} from "../src/moteur/scenario.js";
import {FICHIERS, REFERENCE} from "./aide_scenario.js";

const V01 = JSON.parse(readFileSync(new URL("./references_v01.json", import.meta.url)));
// z ≤ 3 sur l'écart des moyennes : les graines sont fixées, le test est déterministe (jamais aléatoirement rouge).
const Z_MAXIMAL = 3;

for (const [tactique, attendu] of Object.entries(V01.tactiques)) {
  test(`équivalence v0.1 : tactique ${tactique}, ${V01.tirages} raids, écarts de moyennes sous ${Z_MAXIMAL} σ`, (t) => {
    const obtenu = mener_campagne(modifier_scenario(REFERENCE, {"rouge.tactique": tactique}), V01.tirages, FICHIERS);
    for (const grandeur of Object.keys(attendu)) {
      const [a, b] = [attendu[grandeur], obtenu[grandeur]];
      const sigma = Math.hypot(a.ecart_type / Math.sqrt(a.effectif), b.ecart_type / Math.sqrt(b.effectif));
      const z = Math.abs(a.moyenne - b.moyenne) / sigma;
      t.diagnostic(`${grandeur} : v0.1 ${a.moyenne.toFixed(1)}, v2 ${b.moyenne.toFixed(1)}, z = ${z.toFixed(2)}`);
      assert.ok(z <= Z_MAXIMAL, `${grandeur} : v0.1 ${a.moyenne.toFixed(1)}, v2 ${b.moyenne.toFixed(1)}, z = ${z.toFixed(2)}`);
    }
  });
}
