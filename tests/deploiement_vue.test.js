// Éditeur de déploiement (MODELE § 21) : palette et dépôts, purs, sur le scénario de référence.
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {geo_deg} from "../src/moteur/geodesie.js";
import {creer_monde} from "../src/moteur/monde.js";
import {modifier_scenario, resoudre_scenario} from "../src/moteur/scenario.js";
import {elements_editables, modifications_deplacement, modifications_suppression} from "../src/vue/edition.js";
import {MUNITIONS_BATTERIE, famille_de, modifications_depot, palette} from "../src/vue/deploiement.js";
import {FICHIERS, REFERENCE, REGISTRE} from "./aide_scenario.js";

const INDEX = JSON.parse(readFileSync(new URL("../unites/index.json", import.meta.url)));
const monde_de = (brut) => creer_monde(resoudre_scenario(brut, FICHIERS), {registre: REGISTRE, journal: false});
const ICI = geo_deg(47.3, 2.9, 0);

/** Appliquer un dépôt au brut et rendre {brut, monde} : le scénario doit rester valide. */
function deposer(brut, id, options = {}, geo = ICI) {
  const suivant = modifier_scenario(brut, modifications_depot(monde_de(brut), brut, id, geo, options));
  return {brut: suivant, monde: monde_de(suivant)};
}

test("palette : chaque famille liste ses unités du catalogue, sans les classes ; infrastructures en tête", () => {
  const familles = palette(INDEX);
  assert.equal(familles[0].id, "infrastructures");
  const radars = familles.find((f) => f.id === "capteurs").elements.map((e) => e.id);
  assert.ok(radars.includes("capteurs/radars/radar_longue_portee_notionnel"));
  assert.ok(familles.every((f) => f.elements.every((e) => !e.id.split("/").at(-1).startsWith("_"))));
  assert.equal(famille_de("liaisons/satellite_notionnelle").cible, "unite");
});

test("dépôt : radar d'un autre modèle, batterie, site sensible et C2 deviennent des éléments éditables", () => {
  let {brut, monde} = deposer(REFERENCE, "capteurs/radars/radar_longue_portee_notionnel");
  assert.equal(brut.bleu.radar.sites.at(-1).unite, "capteurs/radars/radar_longue_portee_notionnel");
  assert.equal(monde.scenario.radar.sites.at(-1).alt, 40);
  ({brut, monde} = deposer(brut, "capteurs/radars/radar_basse_altitude_notionnel", {}, geo_deg(46.5, 2, 0)));
  assert.equal(brut.bleu.radar.sites.at(-2).unite, "capteurs/radars/radar_longue_portee_notionnel", "un site garde son modèle quand on en ajoute un autre");
  assert.equal(brut.bleu.radar.sites.at(-1).unite, undefined, "le modèle commun n'est pas répété");
  ({brut, monde} = deposer(brut, "sites/postes/batterie_moyenne_portee_notionnelle"));
  assert.deepEqual(brut.bleu.sol.batteries.map((b) => b.munitions), [MUNITIONS_BATTERIE]);
  assert.ok(elements_editables(monde, brut).some((e) => e.cle === "batterie:0"));
  ({brut, monde} = deposer(brut, "special/cible"));
  ({brut, monde} = deposer(brut, "special/centre"));
  assert.equal(brut.bleu.reseau.centres.length, 1);
  assert.equal(monde.scenario.theatre.cibles_placees.length, 11);
});

test("dépôt de vecteurs : un nouveau groupe par modèle, puis le même groupe grossit ; les orbites des autres restent", () => {
  let {brut, monde} = deposer(REFERENCE, "vecteurs/drones_defensifs/drone_arme_notionnel", {quantite: 5});
  const g = brut.bleu.avions.findIndex((x) => x.unite === "vecteurs/drones_defensifs/drone_arme_notionnel");
  assert.equal(brut.bleu.avions[g].nombre, 5);
  assert.equal(brut.bleu.avions[g].orbites_placees.length, 5);
  ({brut, monde} = deposer(brut, "vecteurs/avions/turbopropulseur_ir_notionnel"));
  assert.equal(brut.bleu.avions[0].nombre, 21);
  assert.equal(monde.avions.filter((a) => a.groupe === monde.scenario.avions[0]).length, 21);
  const avant = monde_de(REFERENCE).avions.filter((a) => a.groupe.id === brut.bleu.avions[0].unite).map((a) => a.orbite.lat);
  const apres = monde.avions.filter((a) => a.groupe === monde.scenario.avions[0]).slice(0, 20).map((a) => a.orbite.lat);
  assert.ok(apres.every((lat, i) => Math.abs(lat - avant[i]) < 1e-7), "les 20 avions d'avant restent sur leur orbite (au millionième de degré)");
});

test("dépôt sur une unité : un moyen l'équipe, un armement change l'emport ; hors unité, rien", () => {
  const monde = monde_de(REFERENCE);
  const radar = elements_editables(monde, REFERENCE).find((e) => e.cle === "radar:2");
  const avion = elements_editables(monde, REFERENCE).find((e) => e.type === "avion" && e.indice === 0);
  assert.deepEqual(modifications_depot(monde, REFERENCE, "liaisons/satellite_notionnelle", ICI), {});
  const equipe = modifier_scenario(REFERENCE, modifications_depot(monde, REFERENCE, "liaisons/satellite_notionnelle", ICI, {sous: radar}));
  assert.deepEqual(equipe.bleu.reseau.equipements, [{noeud: "radar:2", moyens: ["liaisons/satellite_notionnelle"]}]);
  const arme = modifier_scenario(REFERENCE, modifications_depot(monde, REFERENCE, "effecteurs/roquettes/roquette_guidee_laser_notionnelle", ICI, {sous: avion}));
  assert.equal(monde_de(arme).scenario.avions[0].arme.id, "effecteurs/roquettes/roquette_guidee_laser_notionnelle");
});

test("déplacer et ôter : batteries, avions, radars avec leur modèle, équipements renumérotés", () => {
  let {brut, monde} = deposer(REFERENCE, "capteurs/radars/radar_longue_portee_notionnel");
  ({brut, monde} = deposer(brut, "sites/postes/batterie_moyenne_portee_notionnelle"));
  const n = brut.bleu.radar.sites.length;
  brut = modifier_scenario(brut, {"bleu.reseau.equipements": [{noeud: "radar:0", moyens: ["liaisons/filaire_notionnelle"]}, {noeud: `radar:${n - 1}`, moyens: ["liaisons/satellite_notionnelle"]}]});
  monde = monde_de(brut);
  const bouge = modifier_scenario(brut, modifications_deplacement(monde, brut, ["batterie:0", `radar:${n - 1}`], ICI, geo_deg(47.4, 2.9, 0)));
  assert.ok(bouge.bleu.sol.batteries[0].lat_deg > 47.35);
  assert.equal(bouge.bleu.radar.sites[n - 1].unite, "capteurs/radars/radar_longue_portee_notionnel");
  const ote = modifier_scenario(brut, modifications_suppression(monde, brut, ["radar:0", "batterie:0", "avion:0", "avion:1"]));
  assert.deepEqual(ote.bleu.reseau.equipements, [{noeud: `radar:${n - 2}`, moyens: ["liaisons/satellite_notionnelle"]}]);
  assert.equal(ote.bleu.radar.sites.at(-1).unite, "capteurs/radars/radar_longue_portee_notionnel");
  assert.deepEqual(ote.bleu.sol.batteries, []);
  assert.equal(ote.bleu.avions[0].nombre, 18);
  assert.doesNotThrow(() => monde_de(ote));
});
