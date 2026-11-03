// Worker du balayage : mène les campagnes hors du fil d'affichage, une valeur après l'autre.
import {mener_campagne} from "../moteur/campagne.js";
import {modifier_scenario} from "../moteur/scenario.js";

self.addEventListener("message", ({data}) => {
  const {brut, cle, valeurs, tirages} = data;
  valeurs.forEach((valeur, indice) => {
    const resume = mener_campagne(modifier_scenario(brut, {[cle]: valeur}), tirages);
    self.postMessage({type: "point", indice, valeur, resume});
  });
  self.postMessage({type: "fin"});
});
