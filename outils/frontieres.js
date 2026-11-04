// Récupère les frontières des pays (Natural Earth, 1:50 000 000, domaine public) et les range, allégées, dans
// cartes/frontieres/pays.json : nom français, code ISO, polygones en degrés arrondis au millième (≈ 100 m).
// L'auto-configuration (jalon 11) s'en sert pour choisir une zone par pays, hors ligne ensuite.
//
//   node outils/frontieres.js
import {mkdirSync, renameSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {RACINE} from "../src/moteur/catalogue_node.js";

export const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

const arrondir = (x) => Math.round(x * 1000) / 1000;

/** Rendre les anneaux d'une géométrie GeoJSON (Polygon ou MultiPolygon), contours extérieurs seulement, arrondis. */
export function anneaux(geometrie) {
  const polygones = geometrie.type === "Polygon" ? [geometrie.coordinates] : geometrie.type === "MultiPolygon" ? geometrie.coordinates : [];
  return polygones.map((p) => p[0].map(([lon, lat]) => [arrondir(lon), arrondir(lat)]))
    .map((anneau) => anneau.filter((point, i) => i === 0 || point[0] !== anneau[i - 1][0] || point[1] !== anneau[i - 1][1]))
    .filter((anneau) => anneau.length >= 4);
}

/** Rendre le fichier des pays à partir de la collection GeoJSON de Natural Earth. */
export function pays_depuis_geojson(collection) {
  const pays = collection.features.map((f) => ({
    nom: f.properties.NAME_FR ?? f.properties.NAME ?? f.properties.ADMIN,
    iso: f.properties.ISO_A3 !== "-99" ? f.properties.ISO_A3 : f.properties.ADM0_A3,
    anneaux: anneaux(f.geometry),
  })).filter((p) => p.anneaux.length).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return {
    _aide: {
      _: "Frontieres des pays, allegees : Natural Earth 1:50m (domaine public), produites par node outils/frontieres.js.",
      pays: "Liste de {nom, iso, anneaux} ; chaque anneau est une liste de [lon, lat] en degres (contours exterieurs).",
    },
    source: SOURCE,
    attribution: "Made with Natural Earth — domaine public",
    pays,
  };
}

async function principal() {
  const reponse = await fetch(SOURCE);
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${SOURCE}`);
  const contenu = pays_depuis_geojson(await reponse.json());
  const dossier = join(RACINE, "cartes", "frontieres");
  mkdirSync(dossier, {recursive: true});
  const chemin = join(dossier, "pays.json");
  writeFileSync(`${chemin}.tmp`, JSON.stringify(contenu));
  renameSync(`${chemin}.tmp`, chemin);
  console.log(`→ ${chemin} : ${contenu.pays.length} pays`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await principal();
