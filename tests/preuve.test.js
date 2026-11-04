// Outils de preuve (MODELE § 14) : empreinte, différentiel, comparaison appariée, convergence, duel, Morris, dossier.
import assert from "node:assert/strict";
import test from "node:test";
import {GRANDEURS} from "../src/moteur/campagne.js";
import {dossier_markdown} from "../src/moteur/dossier.js";
import {comparer_apparies, convergence, differentiel, duel, empreinte, json_canonique, sha256} from "../src/moteur/preuve.js";
import {modifier_scenario} from "../src/moteur/scenario.js";
import {effets_morris, morris, pas_morris, plan_morris, valeur_facteur} from "../src/moteur/sensibilite.js";
import {lire_arguments, lire_facteur, lire_modifications} from "../src/preuve.js";
import {FICHIERS, REFERENCE, REGISTRE} from "./aide_scenario.js";

const PETIT = modifier_scenario(REFERENCE, {"rouge.nombre": 120, "rouge.concentration_max": 40, "bleu.sol.nombre": 40});
const bilan_constant = (valeur) => Object.fromEntries(GRANDEURS.map((g) => [g, valeur]));

test("JSON canonique : indépendant de l'ordre des clés, sans les blocs _aide", () => {
  assert.equal(json_canonique({b: 1, a: [2, {d: 3, c: 4}], _aide: "x"}), json_canonique({a: [2, {c: 4, d: 3}], b: 1}));
  assert.equal(json_canonique({b: 1, a: 2}), '{"a":2,"b":1}');
});

test("SHA-256 : vecteur de test FIPS 180-2 « abc »", async () => {
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("empreinte : stable, et seule la partie modifiée change", async () => {
  const a = await empreinte(REFERENCE, FICHIERS, REGISTRE, {moteur: "v"});
  assert.deepEqual(await empreinte(structuredClone(REFERENCE), FICHIERS, REGISTRE, {moteur: "v"}), a);
  const scenario = await empreinte(modifier_scenario(REFERENCE, {"bleu.sol.nombre": 199}), FICHIERS, REGISTRE, {moteur: "v"});
  assert.notEqual(scenario.empreinte, a.empreinte);
  assert.notEqual(scenario.parties.scenario, a.parties.scenario);
  assert.equal(scenario.parties.unites, a.parties.unites);
  const id = "vecteurs/drones/drone_reaction_notionnel";
  const fichiers = {...FICHIERS, [id]: {...FICHIERS[id], vitesse_kmh: 801}};
  const unites = await empreinte(REFERENCE, fichiers, REGISTRE, {moteur: "v"});
  assert.notEqual(unites.parties.unites, a.parties.unites);
  assert.equal(unites.parties.scenario, a.parties.scenario);
  const tir = "global/tir_sol/cadence_par_passage";
  const registre = {...REGISTRE, [tir]: {...REGISTRE[tir], cadence: () => 1}};
  const algos = await empreinte(REFERENCE, FICHIERS, registre, {moteur: "v"});
  assert.notEqual(algos.parties.algos, a.parties.algos);
  assert.ok(a.algos.includes(tir));
  assert.notEqual((await empreinte(REFERENCE, FICHIERS, REGISTRE, {moteur: "w"})).parties.moteur, a.parties.moteur);
});

test("différentiel : vide contre soi-même, exactement les chemins modifiés sinon", () => {
  assert.deepEqual(differentiel(REFERENCE, REFERENCE), []);
  const variante = modifier_scenario(REFERENCE, {"bleu.avions.1.nombre": 10, "rouge.tactique": "direct"});
  assert.deepEqual(differentiel(REFERENCE, variante), [
    {chemin: "bleu.avions.1.nombre", avant: 30, apres: 10},
    {chemin: "rouge.tactique", avant: "fourmi", apres: "direct"},
  ]);
});

test("comparaison appariée : identique, décalage constant, gain des nombres communs", () => {
  const a = [1, 5, 9, 4, 7].map(bilan_constant);
  assert.ok(Object.values(comparer_apparies(a, a)).every((r) => r.z === 0 && r.verdict === "indiscernable"));
  const decale = comparer_apparies(a, a.map((b) => bilan_constant(b.fuites + 10)));
  assert.equal(decale.fuites.difference.moyenne, 10);
  assert.equal(decale.fuites.z, Infinity);
  assert.equal(decale.fuites.verdict, "B > A");
  assert.ok(Math.abs(decale.fuites.correlation - 1) < 1e-12);
  const bruite = comparer_apparies(a, a.map((b, i) => bilan_constant(b.fuites + [1, -1, 1, -1, 0][i])));
  assert.ok(bruite.fuites.gain_nombres_communs > 10, "variantes très corrélées : la différence appariée est bien plus précise");
  assert.throws(() => comparer_apparies(a, a.slice(1)));
});

test("duel : une variante vide redonne exactement A (mêmes graines)", () => {
  const resultat = duel(PETIT, {}, 3, FICHIERS, REGISTRE);
  assert.deepEqual(resultat.differentiel, []);
  for (const r of Object.values(resultat.comparaison)) {
    assert.equal(r.difference.moyenne, 0);
    assert.equal(r.difference.ecart_type, 0);
  }
});

test("convergence : le pas fin est sa propre référence, chaque pas porte ses écarts", () => {
  const resultat = convergence(PETIT, [1], 3, FICHIERS, REGISTRE);
  assert.deepEqual(resultat.lignes.map((l) => l.pas_s), [1, 0.5]);
  assert.equal(resultat.pas_reference_s, 0.5);
  const fin = resultat.lignes.at(-1);
  assert.ok(GRANDEURS.every((g) => fin.ecarts[g].z === 0 && fin.ecarts[g].conforme));
  assert.equal(typeof resultat.converge, "boolean");
});

test("plan de Morris : k + 1 points, un facteur bouge de Δ à chaque pas, tout reste dans [0, 1]", () => {
  const delta = pas_morris(4);
  assert.equal(delta, 2 / 3);
  for (const {ordre, points} of plan_morris(5, 8, 4, 7)) {
    assert.equal(points.length, 6);
    assert.deepEqual([...ordre].sort(), [0, 1, 2, 3, 4]);
    ordre.forEach((i, etape) => {
      const changes = points[etape].map((x, j) => points[etape + 1][j] - x);
      changes.forEach((d, j) => assert.ok(Math.abs(d - (j === i ? delta : 0)) < 1e-12));
    });
    assert.ok(points.flat().every((x) => x >= 0 && x <= 1 + 1e-12));
  }
  assert.throws(() => plan_morris(2, 1, 3, 1));
});

test("effets de Morris sur une fonction connue : y = 3 x₀ + 0 x₁ + x₂²", () => {
  const facteurs = ["x0", "x1", "x2"].map((chemin) => ({chemin, min: 0, max: 1}));
  const plan = plan_morris(3, 20, 4, 3);
  const y = (p) => 3 * p[0] + p[2] ** 2;
  const sorties = plan.map(({points}) => points.map((p) => bilan_constant(y(p))));
  const effets = Object.fromEntries(effets_morris(facteurs, plan, sorties).fuites.map((e) => [e.chemin, e]));
  assert.ok(Math.abs(effets.x0.mu_etoile - 3) < 1e-9 && effets.x0.sigma < 1e-9, "effet linéaire : μ* exact, σ nul");
  assert.equal(effets.x1.mu_etoile, 0);
  assert.ok(effets.x2.sigma > 0, "effet non linéaire : σ > 0");
  assert.equal(valeur_facteur({min: 0, max: 60, entier: true}, 1 / 3), 20);
});

test("Morris de bout en bout : r (k + 1) évaluations, le nombre d'avions pèse sur les frappes", () => {
  const facteurs = [{chemin: "bleu.avions.1.nombre", min: 0, max: 60, entier: true}, {chemin: "theatre.cibles_nombre", min: 4, max: 10, entier: true}];
  const resultat = morris(modifier_scenario(PETIT, {"bleu.avions.0.nombre": 0}), facteurs, {trajectoires: 2, tirages: 1}, FICHIERS, REGISTRE);
  assert.equal(resultat.evaluations, 6);
  const avions = resultat.effets.detruits_air.find((e) => e.chemin === "bleu.avions.1.nombre");
  assert.ok(avions.mu > 0, "plus d'avions, plus de drones détruits en vol");
});

test("ligne de commande : options, modifications, facteurs, variantes", () => {
  const {outil, options, modifications, facteurs} = lire_arguments(["morris", "--tirages", "4", "--rouge.tactique", "direct", "--facteur", "bleu.sol.nombre=0:200"]);
  assert.equal(outil, "morris");
  assert.equal(options.tirages, 4);
  assert.deepEqual(modifications, {"rouge.tactique": "direct"});
  assert.deepEqual(facteurs, [{chemin: "bleu.sol.nombre", min: 0, max: 200, entier: true}]);
  assert.equal(lire_facteur("a=0.5:2").entier, false);
  assert.throws(() => lire_facteur("a=3:1"));
  assert.deepEqual(lire_modifications("rouge.tactique=direct,bleu.avions.1.nombre=10"), {"rouge.tactique": "direct", "bleu.avions.1.nombre": 10});
});

test("dossier de preuve : empreinte, écarts, résultats, convergence, modèles", async () => {
  const trace = await empreinte(PETIT, FICHIERS, REGISTRE);
  const resume = Object.fromEntries(GRANDEURS.map((g) => [g, {moyenne: 1, ic95: 0.5, ecart_type: 1, effectif: 3}]));
  const texte = dossier_markdown({nom: "essai", date: "d", version: "0", node: "22", commande: "node src/preuve.js dossier", empreinte: trace,
    differentiel: differentiel(REFERENCE, PETIT), tirages: 3, resume, convergence: null, fichiers: FICHIERS, registre: REGISTRE});
  for (const attendu of [trace.empreinte, "## Écarts au scénario de référence", "`rouge.nombre`", "## Résultats", "1.0 ± 0.5", "Non évaluée", "notionnel", "## Limites connues"]) {
    assert.ok(texte.includes(attendu), `manque « ${attendu} »`);
  }
});
