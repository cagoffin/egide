// Worker du balayage : mène les campagnes hors du fil d'affichage, une valeur après l'autre.
import {mener_campagne} from "../moteur/campagne.js";
import {modifier_scenario} from "../moteur/scenario.js";

self.addEventListener("message", ({data}) => {
  const {brut, fichiers, chemins, valeurs, tirages} = data;
  valeurs.forEach((valeur, indice) => {
    const modifications = Object.fromEntries(chemins.map((chemin) => [chemin, valeur]));
    const resume = mener_campagne(modifier_scenario(brut, modifications), tirages, fichiers);
    self.postMessage({type: "point", indice, valeur, resume});
  });
  self.postMessage({type: "fin"});
});
