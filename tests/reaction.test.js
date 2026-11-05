// Essaim réactif (MODELE § 22) : décisions de l'algorithme seul, puis branchement sur le moteur.
import {test} from "node:test";
import assert from "node:assert/strict";
import * as adaptatif from "../algos/global/reaction/essaim_adaptatif.js";
import {geo_deg} from "../src/moteur/geodesie.js";
import {bilan, simuler} from "../src/moteur/monde.js";
import {OUTILS} from "../src/moteur/outils.js";
import {DEFAUTS_REACTION} from "../src/moteur/scenario.js";
import {convertir_objet} from "../src/moteur/unites.js";
import {REGISTRE, scenario} from "./aide_scenario.js";

const REGLAGES = convertir_objet(DEFAUTS_REACTION);
const PETIT = {"rouge.nombre": 200, "rouge.concentration_max": 50};
// Trois cibles sur un parallèle : le drone part de l'ouest et vise la plus lointaine ; la cible du milieu est sur sa route.
const CIBLES = [geo_deg(47, 3), geo_deg(47, 2.5), geo_deg(47.05, 3)];
const DRONE = {geo: geo_deg(47, 1), cible: 0, route: [CIBLES[0]], reaffectations: 0, detours: 0};
const BILANS_NEUTRES = CIBLES.map(() => ({pertes: 0, frappes: 0}));
const contexte = (changements) => ({reglages: REGLAGES, cibles: CIBLES, foyers: [], bilans: BILANS_NEUTRES, ...changements});

test("réaction : un drone quitte une cible qui tue pour une brèche avérée proche", () => {
  const bilans = [{pertes: 20, frappes: 0}, {pertes: 20, frappes: 0}, {pertes: 1, frappes: 5}];
  assert.deepEqual(adaptatif.reagir(contexte({bilans}), DRONE, OUTILS), {cible: 2, motif: "breche"});
});

test("réaction : une cible jamais frappée n'attire pas, même sans perte connue (pas de brèche avérée)", () => {
  const bilans = [{pertes: 20, frappes: 0}, {pertes: 0, frappes: 0}, {pertes: 0, frappes: 0}];
  assert.equal(adaptatif.reagir(contexte({bilans}), DRONE, OUTILS), null);
});

test("réaction : un drone engagé sur sa cible n'en change plus", () => {
  const bilans = [{pertes: 20, frappes: 0}, {pertes: 20, frappes: 0}, {pertes: 1, frappes: 5}];
  const engage = {...DRONE, geo: geo_deg(47, 2.95)};
  assert.equal(adaptatif.reagir(contexte({bilans}), engage, OUTILS), null);
});

test("réaction : le site défendu sur la route est contourné à la tangente, sans allonger de plus que permis", () => {
  // Foyer centré 2 km au nord de la cible du milieu : la branche passe au sud, le détour aussi.
  const foyer = {geo: geo_deg(47.018, 2.5), pertes: 10};
  const choix = adaptatif.reagir(contexte({foyers: [foyer]}), DRONE, OUTILS);
  assert.equal(choix.foyer, 0);
  const ecart = OUTILS.inverse(choix.detour, foyer.geo).distance;
  assert.ok(Math.abs(ecart - 1.3 * REGLAGES.reaction_rayon_danger) < 200, `détour à ${ecart} m du foyer`);
  assert.ok(choix.detour.lat < foyer.geo.lat, "du côté où passe déjà la branche");
});

test("réaction : ni foyer sous le seuil, ni foyer d'avions en rase campagne, ni sa propre cible ne valent un détour", () => {
  const sousSeuil = {geo: geo_deg(47, 2.5), pertes: REGLAGES.reaction_seuil_pertes - 1};
  const campagne = {geo: geo_deg(47, 1.8), pertes: 50};
  const saCible = {geo: geo_deg(47, 3), pertes: 50};
  assert.equal(adaptatif.reagir(contexte({foyers: [sousSeuil, campagne, saCible]}), DRONE, OUTILS), null);
});

test("essaim inerte : sans réaction, ni compteur de réaction, ni évènement, ni drone dérouté", () => {
  const monde = simuler(scenario(PETIT), {registre: REGISTRE, journal: true});
  assert.equal(monde.essaim, null);
  assert.ok(!("reaffectations" in bilan(monde)));
  assert.equal(monde.evenements.filter((e) => e.type === "reaction").length, 0);
});

test("essaim réactif : même graine, même raid ; chaque réaction est journalisée et comptée", () => {
  const reactif = scenario({...PETIT, "rouge.tactique": "disperse", "rouge.reaction": "adaptatif"});
  const [a, b] = [simuler(reactif, {registre: REGISTRE, journal: true}), simuler(reactif, {registre: REGISTRE, journal: false})];
  assert.deepEqual(bilan(a), bilan(b));
  const reactions = a.evenements.filter((e) => e.type === "reaction");
  const compte = bilan(a);
  assert.equal(reactions.length, compte.reaffectations + compte.detours);
  assert.ok(reactions.length > 0, "le raid dispersé déclenche des réactions");
});

test("esquive : un tir air sur un drone réactif porte le Pk de l'arme réduit de reaction_esquive_reduction", () => {
  const monde = simuler(scenario({...PETIT, "rouge.reaction": "adaptatif"}), {registre: REGISTRE, journal: true});
  const tirs = monde.evenements.filter((e) => e.type === "tir" && e.couche === "air");
  assert.ok(tirs.length > 0);
  for (const tir of tirs) {
    const pk = monde.avions[tir.tireur].groupe.arme.pk;
    assert.ok(Math.abs(tir.pk - pk * (1 - REGLAGES.reaction_esquive_reduction)) < 1e-12, `tir de Pk ${tir.pk} pour une arme à ${pk}`);
  }
  assert.equal(bilan(monde).esquives, tirs.length);
});

// Raid direct complet à 30 frappes par cible : quatre groupes de 250 drones, chacun sature sa cible (mesuré).
const SATURE = {"rouge.tactique": "direct", "theatre.frappes_destruction": 30};
const INERTE_SATURE = simuler(scenario(SATURE), {registre: REGISTRE, journal: true});
const REACTIF_SATURE = simuler(scenario({...SATURE, "rouge.reaction": "adaptatif"}), {registre: REGISTRE, journal: true});

test("destruction : une cible n'encaisse jamais plus de N frappes, les drones suivants s'y perdent et sont comptés", () => {
  assert.ok(Math.max(...INERTE_SATURE.fuites) <= 30, `frappes par cible : ${INERTE_SATURE.fuites.join(", ")}`);
  const perdues = INERTE_SATURE.evenements.filter((e) => e.type === "impact" && e.perdue).length;
  assert.equal(bilan(INERTE_SATURE).frappes_perdues, perdues);
  assert.ok(perdues > 0);
  const detruites = INERTE_SATURE.evenements.filter((e) => e.type === "destruction").map((e) => e.cible);
  assert.deepEqual(detruites.sort(), INERTE_SATURE.fuites.flatMap((n, k) => (n >= 30 ? [k] : [])).sort());
});

test("destruction : sans seuil, ni cible détruite ni compteur de frappes perdues", () => {
  const monde = simuler(scenario({...PETIT, "theatre.frappes_destruction": null}), {registre: REGISTRE, journal: true});
  assert.ok(!("frappes_perdues" in bilan(monde)));
  assert.equal(monde.evenements.filter((e) => e.type === "destruction").length, 0);
});

test("destruction : un drone réactif, même engagé, quitte sa cible détruite pour la meilleure cible debout", () => {
  const bilans = [{pertes: 0, frappes: 30}, {pertes: 9, frappes: 1}, {pertes: 1, frappes: 4}];
  const engage = {...DRONE, geo: geo_deg(47, 2.95), reaffectations: REGLAGES.reaction_reaffectations_max};
  assert.deepEqual(adaptatif.reagir(contexte({bilans, frappes_destruction: 30}), engage, OUTILS), {cible: 2, motif: "detruite"});
});

test("destruction : une cible détruite n'est jamais choisie en report, même la plus sûre", () => {
  const bilans = [{pertes: 20, frappes: 0}, {pertes: 0, frappes: 30}, {pertes: 20, frappes: 1}];
  assert.equal(adaptatif.reagir(contexte({bilans, frappes_destruction: 30}), DRONE, OUTILS), null);
});

test("saturation : avant toute brèche, l'essaim garde sa masse (aucune répartition)", () => {
  const drones = Array.from({length: 50}, () => ({...DRONE}));
  assert.deepEqual(adaptatif.repartir(contexte({frappes_destruction: 30}), drones, OUTILS), []);
});

test("saturation : après une brèche, le surplus part en bloc complet vers une cible neuve, les plus proches restent", () => {
  // Cible 0 détruite en ayant perdu 10 drones : K̂ = 10, quota d'une cible neuve ⌈(30 + 10) × 1,5⌉ = 60.
  const bilans = [{pertes: 10, frappes: 30}, {pertes: 0, frappes: 0}, {pertes: 0, frappes: 0}];
  const drones = Array.from({length: 130}, (_, i) => ({...DRONE, cible: 2, geo: geo_deg(47, 1 + i / 1000)}));
  const choix = adaptatif.repartir(contexte({bilans, frappes_destruction: 30}), drones, OUTILS);
  // 70 en surplus, un seul bloc de 60 possible : les 10 restants gardent leur cible.
  assert.equal(choix.length, 60);
  assert.ok(choix.every((c) => c.cible === 1 && c.motif === "saturation"));
  // Restent sur la cible 2 les 60 drones les plus proches d'elle (les plus à l'est).
  assert.ok(choix.every((c) => c.index < 70));
});

test("destruction : l'essaim réactif répartit ses groupes et détruit plus de cibles que l'inerte (raid direct, N = 30)", () => {
  const detruites = (m) => m.fuites.filter((n) => n >= 30).length;
  assert.ok(REACTIF_SATURE.evenements.some((e) => e.type === "reaction" && e.motif === "saturation"));
  assert.ok(detruites(REACTIF_SATURE) > detruites(INERTE_SATURE), `détruites : réactif ${detruites(REACTIF_SATURE)}, inerte ${detruites(INERTE_SATURE)}`);
  assert.ok(bilan(REACTIF_SATURE).frappes_perdues < bilan(INERTE_SATURE).frappes_perdues);
});
