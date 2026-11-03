// Plots radar : position de chaque drone relevée à chaque tour d'antenne, comme sur un écran de situation aérienne.

// 4 s : ordre de grandeur d'une rotation de radar de surveillance basse altitude.
export const PERIODE_ROTATION = 4;
// Six plots d'historique : 24 s de trajectoire, assez pour lire le cap et la vitesse d'un coup d'œil.
export const HISTORIQUE = 6;

/** Rendre un historique de plots vide. */
export const creer_traces = () => ({prochain: 0, plots: new Map()});

/** Relever la position des drones en vol si un tour d'antenne s'est écoulé ; oublier ceux qui ne volent plus. */
export function echantillonner(traces, monde) {
  if (monde.t < traces.prochain) return;
  traces.prochain = monde.t + PERIODE_ROTATION;
  for (const drone of monde.drones) {
    if (!drone.vivant || drone.arrive || monde.t < drone.depart) {
      traces.plots.delete(drone.id);
      continue;
    }
    const plots = traces.plots.get(drone.id) ?? [];
    plots.push({...drone.position});
    if (plots.length > HISTORIQUE) plots.shift();
    traces.plots.set(drone.id, plots);
  }
}
