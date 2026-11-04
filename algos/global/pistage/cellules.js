// Regroupement des détections en pistes par cellules de 5 km (MODELE § 8.3).

export const meta = {
  role: "pistage",
  nom: "Pistes par cellules",
  fidelite: "notionnel",
  description: "Les drones détectés sont regroupés par cellules cubiques de 5 km de l'espace géocentrique ; chaque cellule occupée devient une piste pondérée par son effectif.",
  equations: ["piste = cellule ⌊ECEF / 5 km⌋, effectif = nombre de drones de la cellule"],
  hypotheses: ["Association parfaite : la piste porte la position et la vitesse vraies d'un drone de la cellule"],
  domaine_validite: "Planification des mises à poste ; pas de bruit de mesure.",
  references: ["Égide, docs/MODELE.md § 8.3"],
  parametres: {},
};

// 5 km : 22 s de vol d'un drone à 800 km/h, assez fin pour séparer deux groupes.
const CELLULE = 5_000;
const cle = (p) => `${Math.floor(p.x / CELLULE)},${Math.floor(p.y / CELLULE)},${Math.floor(p.z / CELLULE)}`;

/** Rendre les pistes [{drone, effectif}] des drones connus, dans l'ordre de première apparition. */
export function pister(drones) {
  const pistes = new Map();
  for (const drone of drones) {
    const k = cle(drone.ecef);
    const piste = pistes.get(k);
    if (piste) piste.effectif++;
    else pistes.set(k, {drone, effectif: 1});
  }
  return [...pistes.values()];
}
