// Préréglages enregistrés dans ce navigateur et export du scénario affiché en JSON.

const CLE_STOCKAGE = "egide.prereglages";

/** Rendre les préréglages enregistrés ({nom: modifications}) ; vide si le stockage est indisponible. */
export function lire_prereglages() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? "{}");
  } catch {
    // Navigation privée ou stockage bloqué : l'outil reste utilisable, sans mémoire.
    return {};
  }
}

/** Enregistrer `modifications` sous `nom` ; rend faux si le navigateur refuse d'enregistrer. */
export function enregistrer_prereglage(nom, modifications) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({...lire_prereglages(), [nom]: modifications}));
    return true;
  } catch {
    return false;
  }
}

/** Faire télécharger `brut` (scénario complet, avec son bloc _aide) sous le nom `nomFichier`. */
export function exporter_scenario(brut, nomFichier) {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(brut, null, 2)}\n`], {type: "application/json"}));
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(lien.href);
}
