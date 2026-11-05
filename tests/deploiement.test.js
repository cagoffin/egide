// Déploiement unité par unité (MODELE § 21) : radars d'unités différentes, batteries placées, algorithmes par
// groupe et par centre, équipements ; un scénario sans ces clés rend exactement les mêmes bilans qu'avant.
import assert from "node:assert/strict";
import test from "node:test";
import {unite_si} from "../src/moteur/catalogue.js";
import {creer_monde, bilan, simuler} from "../src/moteur/monde.js";
import {portee_site} from "../src/moteur/radars.js";
import {en_v2, ids_unites, modifier_scenario, resoudre_scenario} from "../src/moteur/scenario.js";
import {ids_algos} from "../src/moteur/algos.js";
import {FICHIERS, REFERENCE, REGISTRE, scenario} from "./aide_scenario.js";

const SITES = [{lat_deg: 48.2, lon_deg: 2.5}, {lat_deg: 46, lon_deg: 2.5, unite: "capteurs/radars/radar_longue_portee_notionnel"}, {lat_deg: 47, lon_deg: 4}];

test("surcharges : des algorithmes en surcharge ne remplacent que les rôles cités", () => {
  const base = unite_si("vecteurs/avions/turbopropulseur_ir_notionnel", FICHIERS);
  const fusion = unite_si("vecteurs/avions/turbopropulseur_ir_notionnel", FICHIERS, {algos: {tir: "global/tir/tire_et_oublie"}});
  assert.equal(fusion.algos.mouvement, base.algos.mouvement);
  assert.equal(fusion.algos.tir, "global/tir/tire_et_oublie");
});

test("radars : un site d'unité propre a sa hauteur et sa portée ; les autres gardent celles du radar commun", () => {
  const s = scenario({"bleu.radar.disposition": "sites", "bleu.radar.sites": SITES});
  assert.equal(s.radar.sites_unites[0], null);
  assert.equal(s.radar.sites[1].alt, 40);
  assert.ok(portee_site(s, 1) > portee_site(s, 0), "antenne plus haute : horizon plus loin");
  assert.equal(portee_site(s, 0), portee_site(s, 2));
  const sansPropre = scenario({"bleu.radar.disposition": "sites", "bleu.radar.sites": SITES.map(({lat_deg, lon_deg}) => ({lat_deg, lon_deg}))});
  assert.equal(sansPropre.radar.sites_unites, undefined, "rien de neuf dans le scénario résolu sans unité propre");
  const monde = creer_monde(s, {registre: REGISTRE, journal: false});
  assert.ok(monde.couverture.sites[1].portee > monde.couverture.sites[0].portee);
});

test("batteries placées : un poste de plus chacune, rattaché à la cible la plus proche, avec son unité et ses munitions", () => {
  const brut = modifier_scenario(REFERENCE, {"theatre.cibles_placees": [{lat_deg: 47, lon_deg: 2.5}, {lat_deg: 47.5, lon_deg: 3}], "theatre.cibles_nombre": 2,
    "bleu.sol.nombre": 0, "bleu.sol.munitions": 0,
    "bleu.sol.batteries": [{lat_deg: 47.45, lon_deg: 3, munitions: 40, unite: "sites/postes/batterie_moyenne_portee_notionnelle"}, {lat_deg: 47, lon_deg: 2.55, munitions: 30}]});
  const s = resoudre_scenario(brut, FICHIERS);
  const monde = creer_monde(s, {registre: REGISTRE, journal: false});
  assert.deepEqual(monde.postes.map((p) => [p.cible, p.munitions, p.unite.portee]), [[1, 40, 25000], [0, 30, 8000]]);
  assert.ok(ids_unites(brut).includes("sites/postes/batterie_moyenne_portee_notionnelle"));
  const b = bilan(simuler(s, {registre: REGISTRE, journal: false}));
  assert.ok(b.detruits_sol > 0 && b.detruits_sol <= 70, "les batteries tirent, dans la limite de leurs munitions");
});

test("armement déposé : l'arme citée par la seule surcharge d'un groupe est chargée avec le scénario", () => {
  // Bug : ids_unites ignorait surcharges.emport ; déposer sur un avion une arme que rien d'autre ne cite faisait
  // échouer la résolution sur « unité non chargée » (vu avec un brouilleur du catalogue privé).
  const arme = "effecteurs/drones/charge_impact_notionnelle";
  const brut = modifier_scenario(REFERENCE, {"bleu.avions.0.surcharges": {emport: arme}});
  assert.ok(ids_unites(brut).includes(arme));
});

test("centres : allocation propre à un centre secondaire, chargée avec le scénario", () => {
  const s = scenario({"bleu.reseau.centres": [{nom: "Nord", lat_deg: 48, lon_deg: 2.5, allocation: "global/allocation/plus_proche"}]});
  assert.equal(s.reseau.centres[0].allocation, "global/allocation/plus_proche");
  assert.ok(ids_algos(s).includes("global/allocation/plus_proche"));
  assert.equal(scenario().reseau.centres.length, 0);
});

test("aide : un scénario écrit avant le déploiement reçoit les phrases des nouvelles clés", () => {
  const ancien = structuredClone(REFERENCE);
  delete ancien.bleu.sol._aide.batteries;
  delete ancien.bleu.reseau._aide.equipements;
  const complete = en_v2(ancien);
  assert.ok(complete.bleu.sol._aide.batteries && complete.bleu.reseau._aide.equipements);
  assert.equal(en_v2(REFERENCE), REFERENCE, "rendu tel quel s'il ne manque rien");
  const brut = modifier_scenario(ancien, {"bleu.reseau.equipements": [{noeud: "conduite", moyens: ["liaisons/satellite_notionnelle"]}]});
  assert.doesNotThrow(() => resoudre_scenario(brut, FICHIERS));
  assert.ok(ids_unites(brut).includes("liaisons/satellite_notionnelle"));
});
