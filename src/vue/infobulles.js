// Textes d'infobulle des entités du scope : ce qu'elles sont, ce qu'elles font, avec leurs unités.
import {format_duree} from "./format.js";

const ETATS = {orbite: "en orbite", ralliement: "en route vers son point de mise à poste", engagement: "au contact",
  poste: "à poste, en attente", retour: "retour vers son orbite"};

/** Nom affiché de chaque famille de vecteur défensif. */
export const NOMS_VECTEURS = {avion: "Avion", drone_arme: "Drone armé", kamikaze: "Intercepteur", brouilleur: "Brouilleur"};

/** Rendre le texte décrivant l'entité survolée (`survol` rendu par trouver_sous_curseur). */
export function decrire(survol, monde) {
  if (survol.type === "avion" && survol.objet.type && survol.objet.type !== "avion") {
    const avion = survol.objet;
    const etat = avion.munitions === 0 ? "à court de munitions" : ETATS[avion.etat];
    const charge = avion.type === "brouilleur" ? `brouille dans un rayon de ${Math.round(avion.groupe.arme.portee / 100) / 10} km` : `${avion.munitions} charge${avion.munitions > 1 ? "s" : ""} restante${avion.munitions > 1 ? "s" : ""}`;
    return `${NOMS_VECTEURS[avion.type]} ${avion.id + 1}\n${etat}\n${charge}`;
  }
  if (survol.type === "avion") {
    const avion = survol.objet;
    const guidage = avion.guidage === "ir" ? "guidage IR" : "guidage laser";
    const etat = avion.munitions === 0 ? "à court de roquettes" : ETATS[avion.etat];
    return `Avion ${avion.id + 1}, ${guidage}\n${etat}\n${avion.munitions} roquettes restantes`;
  }
  if (survol.type === "cible") {
    const postes = monde.postes.filter((p) => p.cible === survol.indice);
    const munitions = postes.reduce((somme, p) => somme + p.munitions, 0);
    return `Cible C${survol.indice + 1}\n${postes.length} postes sol, ${munitions} munitions\n${monde.fuites[survol.indice]} frappes${seuil_destruction(monde, survol.indice)}`;
  }
  if (survol.type === "conduite" || survol.type === "centre") {
    const {reseau} = monde;
    const c = survol.type === "conduite" ? 0 : survol.indice + 1;
    const etat = reseau.centres[c].hs ? "hors service" : reseau.mode === "complet" ? "réseau complet : tout le monde est relié, sans délai"
      : `${reseau.latences_centres[c].filter(Number.isFinite).length} radars le renseignent`;
    return `${c === 0 ? "Centre de détection et de contrôle (CDC)" : reseau.centres[c].nom}\n${etat}`;
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

/** Rendre la précision « sur N pour la détruire » ou « — détruite » d'une cible (MODELE § 23), ou "" sans seuil. */
function seuil_destruction(monde, k) {
  const seuil = monde.scenario.theatre.frappes_destruction;
  if (seuil === null) return "";
  return monde.fuites[k] >= seuil ? ` — détruite (seuil ${seuil})` : ` sur ${seuil} pour la détruire`;
}
