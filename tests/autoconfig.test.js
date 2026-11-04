// Auto-configuration (MODELE § 20) : géométrie de zone, construction du scénario, recherche de la répartition.
import assert from "node:assert/strict";
import test from "node:test";
import {construire, optimiser, UNIFORME} from "../src/moteur/autoconfig.js";
import {direct, geo_deg, inverse, vers_degres} from "../src/moteur/geodesie.js";
import {creer_hasard} from "../src/moteur/hasard.js";
import {resoudre_scenario} from "../src/moteur/scenario.js";
import {centre_zone, dans_zone, echantillonner_contour, perimetre, points_repartis, sommets, zone_preparee} from "../src/moteur/zone.js";
import {anneau_principal} from "../src/autoconfig.js";
import {FICHIERS, REFERENCE, REGISTRE} from "./aide_scenario.js";

const C = geo_deg(47, 2.5);
const en_deg = (p) => ({lat_deg: vers_degres(p.lat), lon_deg: vers_degres(p.lon)});
const HEXAGONE = [0, 1, 2, 3, 4, 5].map((k) => en_deg(direct(C, (k * Math.PI) / 3 + 0.2, k % 2 ? 160_000 : 120_000)));
const DEMANDE = {zone: {nom: "Hexagone", points: HEXAGONE}, menaces: [{tactique: "fourmi", nombre: 120}],
  moyens: {radars: 8, centres: 2, postes: 40, munitions_sol: 200, avions: [4, 4, 6, 0, 0], cibles: 5}};

test("zone : contour régulier, périmètre, points intérieurs bien répartis", () => {
  const geos = sommets(HEXAGONE);
  const contour = echantillonner_contour(geos, 12);
  assert.equal(contour.length, 12);
  const pas = contour.map((p, i) => inverse(p, contour[(i + 1) % 12]).distance);
  assert.ok(Math.max(...pas) / Math.min(...pas) < 1.6, "espacement à peu près régulier (les coins raccourcissent la corde)");
  // Les cordes entre échantillons coupent les coins : leur somme reste à moins de 10 % du périmètre.
  assert.ok(Math.abs(perimetre(geos) - pas.reduce((s, x) => s + x, 0)) / perimetre(geos) < 0.1);
  const zone = zone_preparee(geos);
  const points = points_repartis(geos, 6, creer_hasard(3));
  assert.equal(points.length, 6);
  assert.ok(points.every((p) => dans_zone(zone, p)));
  const ecarts = points.flatMap((p, i) => points.slice(i + 1).map((q) => inverse(p, q).distance));
  assert.ok(Math.min(...ecarts) > 40_000, "pas d'agglutinement");
  assert.ok(dans_zone(zone, centre_zone(geos)));
});

test("construire : théâtre sur la zone, zone protégée, cibles dedans, radars sur le contour, orbites par groupe", () => {
  const brut = construire(REFERENCE, DEMANDE, {avions: 0.6, drones: 0.1, radars: 0}, 60_000);
  const s = resoudre_scenario(brut, FICHIERS);
  assert.equal(brut.theatre.zones.length, 1);
  assert.equal(s.theatre.cibles_placees.length, 5);
  const zone = zone_preparee(sommets(HEXAGONE));
  assert.ok(s.theatre.cibles_placees.every((c) => dans_zone(zone, c)));
  assert.equal(s.radar.disposition, "sites");
  assert.equal(s.radar.sites.length, 8);
  assert.deepEqual(s.avions.map((g) => g.orbites_placees.length), [4, 4, 6, 0, 0]);
  assert.equal(s.reseau.centres.length, 1);
  assert.ok(s.theatre.zone_rayon >= 160_000);
  const pousses = resoudre_scenario(construire(REFERENCE, DEMANDE, {avions: 0.6, drones: 0.1, radars: 0.5}, 60_000), FICHIERS);
  const ecart = inverse(s.radar.sites[0], pousses.radar.sites[0]).distance;
  assert.ok(Math.abs(ecart - 30_000) < 100, "radars poussés vers l'extérieur de la moitié de leur portée");
  assert.deepEqual(resoudre_scenario(construire(REFERENCE, DEMANDE, UNIFORME, 60_000), FICHIERS).avions.map((g) => g.orbites_placees.length), [0, 0, 0, 0, 0]);
});

test("optimiser : essais suivis, meilleure répartition au moins aussi bonne que le départ, comparaison appariée", () => {
  const suivi = [];
  const r = optimiser(REFERENCE, DEMANDE, {tirages: 1, fichiers: FICHIERS, registre: REGISTRE, progression: (fait, total) => suivi.push([fait, total])});
  assert.equal(suivi.at(-1)[0], suivi.at(-1)[1], "tous les essais prévus faits");
  assert.ok(r.meilleur <= r.essais[1].frappes, "jamais pire que le départ");
  assert.ok(Number.isFinite(r.comparaison.difference.moyenne));
  assert.equal(r.brut.nom, "Auto-configuration — Hexagone");
});

test("pays : l'anneau principal est le plus étendu (la métropole, pas une île)", () => {
  const ile = [[55, -21], [55.8, -21], [55.8, -20.8], [55, -20.8], [55, -21]];
  const grand = [[-4, 43], [8, 43], [8, 51], [-4, 51], [-4, 43]];
  assert.deepEqual(anneau_principal({anneaux: [ile, grand]}), grand);
});
