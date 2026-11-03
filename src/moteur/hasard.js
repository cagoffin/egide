// Générateur pseudo-aléatoire à graine : toute la simulation tire ici, jamais dans Math.random,
// pour qu'une graine rejoue un déroulement à l'identique (CLAUDE.md, exigences de rigueur).

/**
 * Rendre un générateur mulberry32 initialisé par `graine`.
 * 32 bits d'état, période 2^32 : largement assez pour des campagnes de quelques milliers de tirages.
 */
export function creer_hasard(graine) {
  let etat = graine >>> 0;
  const suivant = () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    uniforme: (minimum = 0, maximum = 1) => minimum + (maximum - minimum) * suivant(),
    succes: (probabilite) => suivant() < probabilite,
    entier: (borne) => Math.floor(suivant() * borne),
  };
}

/** Rendre une copie mélangée de `elements` (Fisher-Yates). */
export function melanger(elements, hasard) {
  const copie = [...elements];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = hasard.entier(i + 1);
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}
