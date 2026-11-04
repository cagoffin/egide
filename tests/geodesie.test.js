import {test} from "node:test";
import assert from "node:assert/strict";
import * as g from "../src/moteur/geodesie.js";

const proche = (obtenu, attendu, tolerance, message) =>
  assert.ok(Math.abs(obtenu - attendu) <= tolerance, `${message ?? ""} obtenu ${obtenu}, attendu ${attendu} ± ${tolerance}`);

test("ECEF : un point de l'équateur au méridien d'origine est à un demi-grand axe du centre", () => {
  const p = g.vers_ecef(g.geo_deg(0, 0, 0));
  proche(p.x, 6_378_137, 1e-6);
  proche(p.y, 0, 1e-6);
  proche(p.z, 0, 1e-6);
});
test("ECEF : le pôle Nord est à un demi-petit axe (6 356 752,314 m)", () => {
  proche(g.vers_ecef(g.geo_deg(90, 0, 0)).z, 6_356_752.314245, 1e-5);
});
test("ECEF : l'aller-retour géographique ↔ ECEF est exact au millimètre", () => {
  for (const [lat, lon, alt] of [[48.11, -1.68, 0], [-33.9, 151.2, 120], [70, 179.9, 11_000], [0.001, -179.99, -50], [89.9, 45, 3000]]) {
    const retour = g.depuis_ecef(g.vers_ecef(g.geo_deg(lat, lon, alt)));
    proche(g.vers_degres(retour.lat), lat, 1e-9, "lat");
    proche(g.vers_degres(retour.lon), lon, 1e-9, "lon");
    proche(retour.alt, alt, 1e-3, "alt");
  }
});

// Exemples de la documentation de GeographicLib (C. Karney), référence des calculs géodésiques.
test("Vincenty inverse : JFK → Heathrow = 5 551 759,400 m (exemple GeographicLib)", () => {
  proche(g.inverse(g.geo_deg(40.6, -73.8), g.geo_deg(51.6, -0.5)).distance, 5_551_759.400318679, 0.001);
});
test("Vincenty inverse : Wellington → Salamanque = 19 959 679,267 m, presque aux antipodes (exemple GeographicLib)", () => {
  proche(g.inverse(g.geo_deg(-41.32, 174.81), g.geo_deg(40.96, -5.5)).distance, 19_959_679.26735382, 0.001);
});
test("Vincenty : direct puis inverse retrouvent la distance et l'azimut", () => {
  const depart = g.geo_deg(48.11, -1.68);
  const arrivee = g.direct(depart, g.vers_radians(57), 312_345.6);
  const retour = g.inverse(depart, arrivee);
  proche(retour.distance, 312_345.6, 1e-4);
  proche(g.vers_degres(retour.azimut_depart), 57, 1e-9);
});
test("Vincenty : un degré de latitude à 45° vaut 111 132 m sur WGS84", () => {
  proche(g.inverse(g.geo_deg(44.5, 3), g.geo_deg(45.5, 3)).distance, 111_132, 2);
});

test("repère local : 1 km plein nord se lit (0, 1000, −0,08) — la Terre s'abaisse de d²/2R", () => {
  const origine = g.geo_deg(48.11, -1.68, 0);
  const nord = g.direct(origine, 0, 1000);
  const local = g.vers_enu(origine, g.soustraire(g.vers_ecef(nord), g.vers_ecef(origine)));
  proche(local.e, 0, 1e-6);
  proche(local.n, 1000, 0.01);
  proche(local.u, -0.0785, 0.002);
});
test("repère local : ENU → ECEF est l'inverse d'ECEF → ENU", () => {
  const origine = g.geo_deg(-20, 130, 0);
  const v = {x: 1234.5, y: -987.6, z: 4321};
  const retour = g.depuis_enu(origine, g.vers_enu(origine, v));
  proche(retour.x, v.x, 1e-9);
  proche(retour.y, v.y, 1e-9);
  proche(retour.z, v.z, 1e-9);
});

test("pas_vers : 100 km parcourus par pas de 111 m suivent la géodésique à 0,01 % près", () => {
  const depart = g.geo_deg(48, -2, 100);
  const but = g.direct(depart, g.vers_radians(123), 100_000);
  let position = depart;
  let parcouru = 0;
  for (let i = 0; i < 2000 && !position.atteint; i++) {
    const suivant = g.pas_vers(position, but, 111.1);
    parcouru += g.distance_oblique(g.vers_ecef(position), g.vers_ecef(suivant));
    position = suivant;
  }
  assert.ok(position.atteint);
  proche(parcouru, 100_000, 10);
  proche(position.alt, 100, 1e-9, "altitude constante");
});
test("pas_vers : traverse l'antiméridien sans saut", () => {
  const depart = g.geo_deg(10, 179.99, 0);
  const suivant = g.pas_vers(depart, g.geo_deg(10, -179.9), 2000);
  assert.ok(suivant.lon < 0 && suivant.lon > -Math.PI);
});
