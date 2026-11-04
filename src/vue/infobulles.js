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
  if (survol.type === "conduite") {
    const {reseau} = monde;
    const etat = reseau.mode === "complet" ? "réseau complet : tout le monde est relié, sans délai"
      : `${reseau.fixes.filter((l) => l.active).length} liaisons au sol actives sur ${reseau.fixes.length}`;
    return `Centre de conduite (C2)\n${etat}`;
  }
  if (survol.type === "radar") {
    const {radar} = monde.scenario;
    const site = monde.couverture.sites?.[survol.indice];
    const disposition = radar.disposition === "sites" ? "placé" : "de la couverture frontière (le déplacer le place)";
    const portee = site ? `\nportée contre l'essaim : ${Math.round(site.portee / 1000)} km` : "";
    return `Radar R${survol.indice + 1}, ${disposition}\nantenne à ${radar.hauteur_antenne} m${portee}`;
  }
  const drone = survol.objet;
  const vu = drone.detection === null ? "pas encore détecté" : `détecté depuis ${format_duree(monde.t - drone.detection)}`;
  return `Drone ${drone.id + 1}, vise C${drone.cible + 1}\n${vu}`;
}
