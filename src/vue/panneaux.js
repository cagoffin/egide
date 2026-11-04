// Panneaux repliables : le rail d'icônes ouvre un tiroir à la fois, par-dessus la carte. Le panneau ouvert est
// mémorisé dans le navigateur (si celui-ci le permet) pour être rouvert au retour.
const CLE = "egide.panneau";

function lire_ouvert() {
  try {
    return localStorage.getItem(CLE) || null;
  } catch {
    return null;
  }
}

function memoriser_ouvert(id) {
  try {
    if (id) localStorage.setItem(CLE, id);
    else localStorage.removeItem(CLE);
  } catch {
    // Mémoire refusée (navigation privée) : le panneau ne sera simplement pas rouvert.
  }
}

/**
 * Brancher le rail `rail` sur les tiroirs `[data-tiroir]` de `racine`. `sur_ouverture(id)` est appelé quand un
 * tiroir s'ouvre. Rendre {ouvrir(id), basculer(id), fermer(), ouvert()}.
 */
export function brancher_panneaux(racine, rail, sur_ouverture = () => {}) {
  let courant = null;
  const tiroirs = [...racine.querySelectorAll("[data-tiroir]")];
  const ouvrir = (id) => {
    courant = tiroirs.some((t) => t.dataset.tiroir === id) ? id : null;
    for (const tiroir of tiroirs) tiroir.hidden = tiroir.dataset.tiroir !== courant;
    rail.querySelectorAll("[data-panneau]").forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.panneau === courant)));
    memoriser_ouvert(courant);
    if (courant) sur_ouverture(courant);
  };
  const basculer = (id) => ouvrir(courant === id ? null : id);
  rail.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-panneau]");
    if (bouton) basculer(bouton.dataset.panneau);
  });
  racine.addEventListener("click", (e) => e.target.closest("[data-action='fermer_tiroir']") && ouvrir(null));
  ouvrir(lire_ouvert());
  return {ouvrir, basculer, fermer: () => ouvrir(null), ouvert: () => courant, ids: () => tiroirs.map((t) => t.dataset.tiroir)};
}
