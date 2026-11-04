// Suite de conformité : s'applique d'elle-même à tout algorithme et toute unité déposés, publics ou privés (prive/).
// Un nouveau fichier n'a besoin d'aucun test écrit à la main pour être vérifié sur ces points.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {chemin_algo, ROLES, ROLES_BRANCHES} from "../src/moteur/algos.js";
import {charger_unites, unite_brute, unite_si} from "../src/moteur/catalogue.js";
import {RACINE, ids_unites_disque, lire_fichier} from "../src/moteur/catalogue_node.js";
import {OUTILS} from "../src/moteur/outils.js";
import {creer_hasard} from "../src/moteur/hasard.js";
import {index_algos, index_unites} from "../outils/indexer.js";
import {REGISTRE, scenario} from "./aide_scenario.js";

// Ce qu'un algorithme n'a pas le droit d'écrire : il reçoit tout en argument et ne dépend que de ses entrées.
const INTERDITS = [/^\s*import\s/m, /\brequire\(/, /Math\.random/, /Date\.now|new Date\b/, /\bfetch\(/, /\bperformance\./];
// Rôles dont l'algorithme est porté par une unité, et donc tenu de trouver ses paramètres dans l'unité.
const ROLES_D_UNITE = ["mouvement", "detection", "tir", "tir_sol"];

const FICHIERS = await charger_unites(ids_unites_disque(), lire_fichier);

for (const [id, module] of Object.entries(REGISTRE)) {
  test(`conformité algorithme ${id} : fiche complète, rôle tenu, aucune dépendance cachée`, () => {
    assert.ok(Object.keys(ROLES).includes(module.meta.role));
    const source = readFileSync(join(RACINE, chemin_algo(id)), "utf-8");
    for (const motif of INTERDITS) assert.ok(!motif.test(source), `${id} contient ${motif}`);
    const dossier = id.replace(/^prive\//, "").split("/");
    if (dossier[0] === "global") assert.equal(dossier[1], module.meta.role, "rangé sous algos/global/<rôle>/");
  });
}

for (const id of ids_unites_disque()) {
  test(`conformité unité ${id} : valide, algorithmes existants, de bon rôle, paramètres présents`, () => {
    const unite = unite_brute(id, FICHIERS);
    if (id.split("/").at(-1).startsWith("_")) return;
    const valeurs = unite_si(id, FICHIERS);
    for (const [role, idAlgo] of Object.entries(unite.algos ?? {})) {
      const module = REGISTRE[idAlgo];
      assert.ok(module, `${id} cite un algorithme absent : ${idAlgo}`);
      assert.equal(module.meta.role, role, `${idAlgo} est rangé sous le rôle ${role}`);
      if (ROLES_D_UNITE.includes(role)) {
        for (const parametre of Object.keys(module.meta.parametres)) assert.ok(parametre in valeurs, `${id} : ${idAlgo} lit « ${parametre} »`);
      }
    }
  });
}

test("conformité : tous les rôles branchés sur le moteur ont au moins un algorithme public", () => {
  const roles = new Set(Object.values(REGISTRE).map((module) => module.meta.role));
  for (const role of ROLES_BRANCHES) assert.ok(roles.has(role), role);
});

test("conformité comportement : même graine, même essaim ; route finissant sur la cible visée", () => {
  const s = scenario();
  const cibles = [OUTILS.geo_deg(47.2, 2.4), OUTILS.geo_deg(46.8, 2.9)];
  const contexte = {rouge: s.rouge, cibles, rayon_apparition: 250_000, origine: s.theatre.origine, caps: [0.3, 2.1], cap_commun: 4};
  for (const [id, module] of Object.entries(REGISTRE).filter(([, m]) => m.meta.role === "comportement")) {
    const tirer = () => [0, 1, 1, 0].map((cible) => module.planifier_drone(contexte, cible, creer_hasard(5), OUTILS));
    assert.deepEqual(tirer(), tirer(), id);
    for (const [i, cible] of [0, 1, 1, 0].entries()) assert.deepEqual(tirer()[i].route.at(-1), cibles[cible], id);
  }
});

test("conformité mouvement : jamais plus loin que demandé, altitude conservée, entrées intactes", () => {
  const depart = OUTILS.geo_deg(47, 2.5, 300);
  const but = OUTILS.direct(depart, 1.2, 5_000);
  const route = Object.freeze([Object.freeze({geo: but, ecef: OUTILS.vers_ecef({...but, alt: 300})})]);
  const mobile = Object.freeze({geo: depart, ecef: OUTILS.vers_ecef(depart)});
  for (const [id, module] of Object.entries(REGISTRE).filter(([, m]) => m.meta.role === "mouvement")) {
    for (const pas of [0, 100, 4_999, 20_000]) {
      const suivant = module.avancer(mobile, route, pas, OUTILS);
      assert.ok(OUTILS.distance_oblique(mobile.ecef, suivant.ecef) <= pas + 1e-6, `${id} pas ${pas}`);
      assert.ok(Math.abs(suivant.geo.alt - 300) < 1e-9, id);
    }
  }
});

test("conformité pistage : chaque drone connu compte dans exactement une piste", () => {
  const drones = Array.from({length: 40}, (_, i) => {
    const geo = OUTILS.direct(OUTILS.geo_deg(47, 2.5, 100), i * 0.3, 1_000 * i);
    return Object.freeze({geo, ecef: OUTILS.vers_ecef(geo), vitesse: {x: 0, y: 0, z: 0}});
  });
  for (const [id, module] of Object.entries(REGISTRE).filter(([, m]) => m.meta.role === "pistage")) {
    assert.equal(module.pister(drones, OUTILS).reduce((somme, piste) => somme + piste.effectif, 0), 40, id);
  }
});

test("index : unites/index.json et algos/index.json sont à jour (sinon : node outils/indexer.js)", async () => {
  assert.deepEqual(JSON.parse(readFileSync(join(RACINE, "unites", "index.json"), "utf-8")), index_unites());
  assert.deepEqual(JSON.parse(readFileSync(join(RACINE, "algos", "index.json"), "utf-8")), await index_algos());
});
