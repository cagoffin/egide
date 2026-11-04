// Worker du balayage : mène les campagnes hors du fil d'affichage, une valeur après l'autre.
// Il charge lui-même les algorithmes : un module ne se transmet pas d'un fil à l'autre.
import {charger_algos, ids_algos} from "../moteur/algos.js";
import {mener_campagne} from "../moteur/campagne.js";
import {modifier_scenario, resoudre_scenario} from "../moteur/scenario.js";

const RACINE = new URL("../../", import.meta.url);
const registre = {};

async function completer_registre(scenario) {
  const manquants = ids_algos(scenario).filter((id) => !(id in registre));
  if (manquants.length) Object.assign(registre, await charger_algos(manquants, (chemin) => import(new URL(chemin, RACINE).href)));
}

self.addEventListener("message", async ({data}) => {
  const {brut, fichiers, chemins, valeurs, tirages} = data;
  for (const [indice, valeur] of valeurs.entries()) {
    const variante = modifier_scenario(brut, Object.fromEntries(chemins.map((chemin) => [chemin, valeur])));
    await completer_registre(resoudre_scenario(variante, fichiers));
    self.postMessage({type: "point", indice, valeur, resume: mener_campagne(variante, tirages, fichiers, registre)});
  }
  self.postMessage({type: "fin"});
});
