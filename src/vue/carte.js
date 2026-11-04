// Fond de carte MapLibre (jalon 2) : le style vient de carte_style.js, construit à partir des sources de cartes/ ;
// le scope se dessine par-dessus, sur un canevas transparent calé sur la carte (ecran.js).
import * as maplibregl from "../../vendor/maplibre-gl/maplibre-gl.mjs";
import {bornes_disque, style_carte} from "./carte_style.js";

/** Rendre la carte MapLibre créée dans `conteneur`, ou null si le navigateur n'a pas WebGL. */
export function creer_carte(conteneur, sources, reglages) {
  try {
    const carte = new maplibregl.Map({
      container: conteneur, style: style_carte(sources, reglages), center: [2.5, 47], zoom: 5, maxPitch: 70,
      attributionControl: {compact: true}, fadeDuration: 0,
    });
    carte.addControl(new maplibregl.NavigationControl({visualizePitch: true}), "top-right");
    return carte;
  } catch (erreur) {
    console.warn(`Carte indisponible, retour au scope : ${erreur.message}`);
    return null;
  }
}

/** Cadrer la carte sur le disque de `rayon` m autour de `origine`, sans animation. */
export function cadrer_carte(carte, origine, rayon) {
  carte.fitBounds(bornes_disque(origine, rayon), {padding: 24, duration: 0});
}
