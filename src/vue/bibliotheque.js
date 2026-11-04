// Bibliothèque de scénarios : ceux du dépôt (scenarios/index.json) et ceux enregistrés dans ce navigateur,
// notamment par l'auto-configuration (MODELE § 20.3). La mémoire du navigateur peut manquer : tout est protégé.
const CLE = "egide.bibliotheque";

/** Rendre les scénarios enregistrés dans ce navigateur ({nom: scénario complet}). */
export function lire_bibliotheque_locale(stockage = globalThis.localStorage) {
  try {
    return JSON.parse(stockage?.getItem(CLE) ?? "{}");
  } catch {
    return {};
  }
}

/** Enregistrer `brut` sous `nom` dans ce navigateur ; rendre faux si le navigateur refuse. */
export function enregistrer_dans_bibliotheque(nom, brut, stockage = globalThis.localStorage) {
  try {
    stockage.setItem(CLE, JSON.stringify({...lire_bibliotheque_locale(stockage), [nom]: brut}));
    return true;
  } catch {
    return false;
  }
}
