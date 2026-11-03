# Plan d'Égide

## Étape 1 — Abaques analytiques (`analyse/`)
- `geometrie` : formules MODELE § 2 à § 5, en Python et en JS, mêmes valeurs de référence.
- `abaques.py` : courbes v_min = f(N) pour k = 1, 5, 8, 10 ; postes sol = f(concentration).
- Livrable : figures PNG dans `resultats/abaques/` et tableau récapitulatif.

## Étape 2 — Simulation multi-agents 2D (`src/moteur/`)
- Lot 1 : générateur aléatoire à graine, entités (drone, avion, poste, radar), pas de temps fixe.
- Lot 2 : comportements adverses paramétrables : direct, dispersé, « fourmi » (couloir compact puis
  éclatement à distance réglable des cibles).
- Lot 3 : affectation défensive (ordre de mise à poste au plus proche capable d'arriver avant le passage).
- Lot 4 : engagements (§ 4, § 5), stocks, Pk tirés au hasard.
- Lot 5 : campagnes Monte-Carlo sous Node (`node src/campagne.js`), sortie JSON, intervalles de confiance.
- Critère d'acceptation : en essaim uniforme, la simulation retrouve § 6 à l'intervalle de confiance près.

## Étape 3 — Interface graphique (`index.html`, `src/vue/`)
- Carte canvas animée : couvertures radar, orbites, bulles sol, traînées des drones, tirs et impacts.
- Curseurs à effet immédiat sur toutes les clés du scénario ; préréglages enregistrables.
- Rejeu : lecture, pause, ×0,25 à ×16, retour en arrière ; graine affichée.
- Tableau de bord vivant : drones restants, munitions, fuites par cible, avions engagés.
- Mode « balayage » : courbe postes sol nécessaires vs nombre d'avions, calculée en arrière-plan.
