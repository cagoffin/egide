// Effets visuels tirés du journal du monde : traits de tir, éclats de destruction, impacts sur les cibles, et
// circulation de l'information (MODELE § 17) : détections qui remontent au CDC, missions qui descendent aux avions,
// contacts pris par les capteurs des avions. Leur durée est en temps réel (ms) : lisible même en lecture ×16.

const DUREES = {trait: 350, eclat: 700, impact: 1600, message: 1100, contact: 900, reception: 700};

/** Position d'un nœud du réseau dans le monde (« conduite », « radar:<i> »). */
const position_noeud = (monde, noeud) => (noeud === "conduite" ? monde.reseau.centre : monde.reseau.radars[Number(noeud.slice(6))]);

/**
 * Transformer les évènements d'information d'un même lot en effets : les détections sont regroupées par radar (une
 * impulsion « n drones » vers le CDC, ou une croix si l'information n'ira nulle part).
 */
function effets_information(lot, monde, maintenant) {
  const effets = [];
  const parRadar = new Map();
  for (const e of lot.filter((x) => x.type === "detection" && x.radar >= 0)) {
    const groupe = parRadar.get(e.radar) ?? {n: 0, perdu: 0};
    groupe.n++;
    if (e.connu === null) groupe.perdu++;
    parRadar.set(e.radar, groupe);
  }
  for (const [radar, {n, perdu}] of parRadar) {
    const de = monde.reseau.radars[radar];
    if (de) effets.push({type: "message", sens: "montee", de, vers: monde.reseau.centre, n, perdu: perdu === n, debut: maintenant});
  }
  for (const e of lot) {
    const avion = monde.avions[e.avion];
    if (e.type === "mission" && avion) effets.push({type: "message", sens: "descente", de: position_noeud(monde, e.depuis), vers: {...avion.geo}, n: e.effectif, debut: maintenant});
    if (e.type === "reception" && avion) effets.push({type: "reception", position: {...avion.geo}, debut: maintenant});
    if (e.type === "contact" && avion && monde.drones[e.drone]) effets.push({type: "contact", de: {...avion.geo}, vers: {...monde.drones[e.drone].geo}, debut: maintenant});
  }
  return effets;
}

/** Rendre une file d'effets vide, positionnée au début du journal. */
export const creer_effets = () => ({liste: [], curseur: 0});

/** Transformer les évènements du journal pas encore vus en effets, datés de `maintenant` (ms). */
export function absorber(effets, monde, maintenant) {
  const evenements = monde.evenements ?? [];
  effets.liste.push(...effets_information(evenements.slice(effets.curseur), monde, maintenant));
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
