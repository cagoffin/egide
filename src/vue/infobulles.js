// Textes d'infobulle des entités du scope : ce qu'elles sont, ce qu'elles font, avec leurs unités.
import {format_duree} from "./format.js";

const ETATS = {orbite: "en orbite", ralliement: "en route vers son point de mise à poste", engagement: "au contact",
  poste: "à poste, en attente", retour: "retour vers son orbite"};

/** Rendre le texte décrivant l'entité survolée (`survol` rendu par trouver_sous_curseur). */
export function decrire(survol, monde) {
  if (survol.type === "avion") {
    const avion = survol.objet;
    const guidage = avion.guidage === "ir" ? "guidage IR" : "guidage laser";
    const etat = avion.munitions === 0 ? "à court de roquettes" : ETATS[avion.etat];
    return `Avion ${avion.id + 1}, ${guidage}\n${etat}\n${avion.munitions} roquettes restantes`;
  }
  if (survol.type === "cible") {
    const postes = monde.postes.filter((p) => p.cible === survol.indice);
    const munitions = postes.reduce((somme, p) => somme + p.munitions, 0);
    return `Cible C${survol.indice + 1}\n${postes.length} postes sol, ${munitions} munitions\n${monde.fuites[survol.indice]} drones arrivés`;
  }
  const drone = survol.objet;
  const vu = drone.detection === null ? "pas encore détecté" : `détecté depuis ${format_duree(monde.t - drone.detection)}`;
  return `Drone ${drone.id + 1}, vise C${drone.cible + 1}\n${vu}`;
}
