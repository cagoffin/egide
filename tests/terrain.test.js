// Relief dans le moteur (MODELE § 16) : décodage de la grille, masques d'horizon, vue directe, effet sur un raid.
import assert from "node:assert/strict";
import test from "node:test";
import {deflateSync} from "node:zlib";
import {direct, geo_deg, vers_ecef} from "../src/moteur/geodesie.js";
import {bilan, simuler} from "../src/moteur/monde.js";
import {acces_avion, preparer_reseau} from "../src/moteur/reseau.js";
import {altitude_sol, angle_site, couverture_reelle, grille_terrain, masque_horizon, vu_par, vue_directe} from "../src/moteur/terrain.js";
import {decoder_png} from "../outils/png.js";
import {altitude_terrarium, encoder_altitudes, geometrie_grille, pixel_tuile, relief_synthetique} from "../outils/terrain.js";
import {REGISTRE, scenario} from "./aide_scenario.js";

const CRETE = {"theatre.terrain": "terrains/crete_notionnelle"};
const s = scenario(CRETE);
const grille = grille_terrain(s.theatre.terrain);
const centre = s.theatre.origine;
const au_nord = (km) => direct(centre, 0, km * 1000);

test("terrain : la grille décodée redonne le relief synthétique (plaine, crête au nord, massif au sud-est)", () => {
  assert.ok(Math.abs(altitude_sol(grille, centre) - relief_synthetique(47, 2.5, 47, 2.5)) < 2);
  assert.ok(altitude_sol(grille, au_nord(170)) > 1400, "crête à 170 km au nord");
  assert.ok(Math.abs(altitude_sol(grille, au_nord(-200)) - 150) < 2, "plaine");
  assert.equal(altitude_sol(grille, geo_deg(60, 2.5)), 0, "hors de la grille : niveau de la mer");
});

test("masque d'horizon : derrière la crête, un drone à 100 m du sol est caché ; devant, il est vu", () => {
  const radar = au_nord(150);
  const masque = masque_horizon(grille, radar, 20, 120_000);
  const vu = (geo) => vu_par(masque, grille, geo, vers_ecef({...geo, alt: 100}), 100);
  assert.equal(vu(au_nord(195)), false, "à 25 km derrière la crête");
  assert.equal(vu(au_nord(110)), true, "40 km au sud, en plaine");
  assert.equal(vu(direct(radar, Math.PI / 2, 40_000)), true, "à l'est, en plaine");
  // À 2 000 m au-dessus du sol, juste derrière la crête, on est vu par-dessus.
  assert.equal(vu_par(masque, grille, au_nord(180), vers_ecef({...au_nord(180), alt: 2000}), 2000), true);
  const couverture = couverture_reelle(masque, grille, 100);
  const nord = couverture[0].portee;
  const sud = couverture[180].portee;
  assert.ok(nord < 45_000 && sud > nord, `portée au nord ${nord}, au sud ${sud}`);
  assert.ok(angle_site(100, 0, 10_000) > angle_site(100, 0, 20_000), "courbure : plus loin, plus bas");
});

test("vue directe : la crête coupe la liaison radio vers un avion au nord ; en plaine, elle passe", () => {
  assert.equal(vue_directe(grille, centre, 165, au_nord(200), 1000, 200_000), false);
  assert.equal(vue_directe(grille, centre, 165, au_nord(-100), 1000, 100_000), true);
  // R1 est au nord, sur la frontière : la crête est entre lui et un avion à 40 km au-delà.
  const avec = scenario({...CRETE, "bleu.reseau.mode": "liaisons", "bleu.reseau.liaisons": [
    {de: "radar:0", vers: "conduite", moyen: "liaisons/filaire_notionnelle"}, {de: "radar:0", vers: "avions:1", moyen: "liaisons/radio_vhf_uhf_notionnelle"}]});
  const reseau = preparer_reseau(avec);
  assert.equal(acces_avion(reseau, {geo: {...au_nord(190), alt: 1000}}, 1), null, "masqué par la crête");
  assert.equal(acces_avion(reseau, {geo: {...au_nord(110), alt: 1000}}, 1).sol, "radar:0");
});

test("raid sur relief : sans défense, chaque drone est vu au plus tôt comme sur Terre lisse, et certains plus tard", () => {
  const sans = {"rouge.nombre": 150, "rouge.concentration_max": 15, "rouge.tactique": "disperse", "bleu.avions.0.nombre": 0, "bleu.avions.1.nombre": 0, "bleu.sol.nombre": 0};
  const lisse = simuler(scenario(sans), {registre: REGISTRE, journal: false});
  const relief = simuler(scenario({...sans, ...CRETE}), {registre: REGISTRE, journal: false});
  assert.equal(bilan(relief).fuites, bilan(lisse).fuites, "sans défense, mêmes trajectoires");
  let plus_tard = 0;
  relief.drones.forEach((d, i) => {
    const t0 = lisse.drones[i].detection;
    if (d.detection === null || d.detection > t0) plus_tard++;
    else assert.ok(d.detection >= t0);
  });
  assert.ok(plus_tard > 0, "le relief retarde ou empêche certaines détections");
});

test("outils terrain : PNG relu (cinq filtres), pixel de tuile, encodage, géométrie de grille", () => {
  // PNG RVB 3 × 2 fabriqué à la main, une ligne par filtre : décodage exact attendu.
  const [l, h] = [3, 5];
  const pixels = Uint8Array.from({length: l * h * 3}, (_, k) => (k * 37) % 256);
  const brut = [];
  for (let y = 0; y < h; y++) {
    const filtre = y % 5;
    brut.push(filtre);
    for (let x = 0; x < l * 3; x++) {
      const a = x >= 3 ? pixels[y * l * 3 + x - 3] : 0;
      const b = y > 0 ? pixels[(y - 1) * l * 3 + x] : 0;
      const c = x >= 3 && y > 0 ? pixels[(y - 1) * l * 3 + x - 3] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      brut.push((pixels[y * l * 3 + x] - [0, a, b, (a + b) >> 1, paeth][filtre] + 256) & 255);
    }
  }
  const morceau = (type, corps) => {
    const tete = Buffer.alloc(8);
    tete.writeUInt32BE(corps.length);
    tete.write(type, 4, "latin1");
    return Buffer.concat([tete, corps, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(l, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau("IHDR", ihdr), morceau("IDAT", deflateSync(Buffer.from(brut))), morceau("IEND", Buffer.alloc(0))]);
  assert.deepEqual(decoder_png(new Uint8Array(png)).pixels, pixels);
  assert.equal(altitude_terrarium(128, 0, 0), 0);
  assert.deepEqual(pixel_tuile(0, 0, 1), {x: 1, y: 1, px: 0, py: 0});
  assert.equal(Buffer.from(encoder_altitudes([1, -2, 40000]), "base64").readInt16LE(4), 32767);
  const g = geometrie_grille(47, 2.5, 10, 1);
  assert.equal(g.lignes, 21);
  assert.ok(Math.abs(g.lat_sud + 10 * g.pas_lat - 47) < 1e-12);
});
