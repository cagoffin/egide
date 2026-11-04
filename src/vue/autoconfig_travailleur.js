// Worker de l'auto-configuration : la recherche de répartition (des dizaines de raids) tourne hors du fil
// d'affichage. Il charge lui-même tous les algorithmes publics : les menaces en essaient plusieurs.
import {charger_algos} from "../moteur/algos.js";
import {optimiser} from "../moteur/autoconfig.js";

const RACINE = new URL("../../", import.meta.url);

self.addEventListener("message", async ({data}) => {
  const {base, demande, fichiers, tirages} = data;
  try {
    const index = await (await fetch(new URL("algos/index.json", RACINE))).json();
    const registre = await charger_algos(index.map((a) => a.id), (chemin) => import(new URL(chemin, RACINE).href));
    const resultat = optimiser(base, demande, {tirages, fichiers, registre,
      progression: (fait, total, essai) => self.postMessage({type: "essai", fait, total, essai}),
      avancement: (fait, total) => self.postMessage({type: "avancement", fait, total})});
    self.postMessage({type: "fin", resultat});
  } catch (erreur) {
    self.postMessage({type: "erreur", message: erreur.message});
  }
});
