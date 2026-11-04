// Régénère unites/index.json et algos/index.json, lus par l'interface (palette, explorateur) qui ne peut pas lister
// un dossier. `node outils/indexer.js` ; tests/conformite.test.js échoue si un index est périmé.
import {readFileSync, renameSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {charger_algos} from "../src/moteur/algos.js";
import {unite_brute} from "../src/moteur/catalogue.js";
import {RACINE, ids_algos_disque, ids_unites_disque, importer_module} from "../src/moteur/catalogue_node.js";

/** Rendre le contenu de l'index des unités publiques : identifiant, nom, famille, fidélité, unité instanciable. */
export function index_unites() {
  const ids = ids_unites_disque().filter((id) => !id.startsWith("prive/"));
  const fichiers = Object.fromEntries(ids.map((id) => [id, JSON.parse(readFileSync(join(RACINE, "unites", `${id}.json`), "utf-8"))]));
  return ids.map((id) => {
    const unite = unite_brute(id, fichiers);
    return {id, nom: unite.nom, famille: id.split("/")[0], fidelite: unite.fidelite, base: id.split("/").at(-1).startsWith("_")};
  });
}

/** Rendre le contenu de l'index des algorithmes publics : identifiant, nom, rôle, fidélité. */
export async function index_algos() {
  const ids = ids_algos_disque().filter((id) => !id.startsWith("prive/"));
  const registre = await charger_algos(ids, importer_module);
  return ids.map((id) => ({id, nom: registre[id].meta.nom, role: registre[id].meta.role, fidelite: registre[id].meta.fidelite}));
}

function ecrire(chemin, contenu) {
  // Écriture atomique : un index à moitié écrit ne remplace jamais le précédent.
  writeFileSync(`${chemin}.tmp`, `${JSON.stringify(contenu, null, 2)}\n`);
  renameSync(`${chemin}.tmp`, chemin);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ecrire(join(RACINE, "unites", "index.json"), index_unites());
  ecrire(join(RACINE, "algos", "index.json"), await index_algos());
  console.log("Index régénérés : unites/index.json, algos/index.json");
}
