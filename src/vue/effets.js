// Effets visuels tirés du journal du monde : traits de tir, éclats de destruction, impacts sur les cibles.
// Leur durée est en temps réel (ms) : un tir reste lisible même en lecture ×16.

const DUREES = {trait: 350, eclat: 700, impact: 1600};

/** Rendre une file d'effets vide, positionnée au début du journal. */
export const creer_effets = () => ({liste: [], curseur: 0});

/** Transformer les évènements du journal pas encore vus en effets, datés de `maintenant` (ms). */
export function absorber(effets, monde, maintenant) {
  const evenements = monde.evenements ?? [];
  for (; effets.curseur < evenements.length; effets.curseur++) {
    const evenement = evenements[effets.curseur];
    if (evenement.type === "tir") {
      effets.liste.push({type: "trait", couche: evenement.couche, de: evenement.de, vers: evenement.vers, debut: maintenant});
      if (evenement.detruit) effets.liste.push({type: "eclat", couche: evenement.couche, position: evenement.vers, debut: maintenant});
    } else if (evenement.type === "impact") {
      effets.liste.push({type: "impact", cible: evenement.cible, debut: maintenant});
    }
  }
  effets.liste = effets.liste.filter((effet) => maintenant - effet.debut < DUREES[effet.type]);
}

/** Rendre l'avancement (0 à 1) d'un effet à l'instant `maintenant`. */
export const avancement = (effet, maintenant) => Math.min(1, (maintenant - effet.debut) / DUREES[effet.type]);

/** Sauter tout le journal (après un déplacement dans le temps) : rien ne doit exploser rétroactivement. */
export function sauter(effets, monde) {
  effets.curseur = monde.evenements?.length ?? 0;
  effets.liste = [];
}
