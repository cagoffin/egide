"""Formules fermees du modele d'Egide, en unites SI (m, s, m/s).

Chaque fonction cite son paragraphe de docs/MODELE.md. Le jumeau JavaScript est src/moteur/geometrie.js :
tests/references.json verifie que les deux rendent les memes valeurs.
"""

import math

G = 9.80665
# Rayon terrestre effectif (facteur 4/3) : la refraction standard courbe les ondes vers le sol.
RAYON_TERRESTRE_EFFECTIF = 4 / 3 * 6_371_000


def rayon_virage(vitesse: float, facteur_charge: float) -> float:
    """Rendre le rayon de virage en palier, en m (MODELE § 3.1).

    Args:
        vitesse: vitesse vraie, en m/s.
        facteur_charge: facteur de charge n, en g ; doit depasser 1.
    """
    return vitesse**2 / (G * math.sqrt(facteur_charge**2 - 1))


def horizon_radar(hauteur_antenne: float, altitude_cible: float) -> float:
    """Rendre la portee geometrique de detection limitee par l'horizon, en m (MODELE § 2)."""
    return math.sqrt(2 * RAYON_TERRESTRE_EFFECTIF) * (math.sqrt(hauteur_antenne) + math.sqrt(altitude_cible))


def delai_disponible(
    distance_detection: float, profondeur: float, vitesse_drone: float, delai_reaction: float
) -> float:
    """Rendre le temps laisse aux avions pour se mettre a poste, en s (MODELE § 3.2)."""
    return (distance_detection + profondeur) / vitesse_drone - delai_reaction


def avions_concentrables(nombre_avions: int, portee_mise_a_poste: float, rayon_zone: float) -> float:
    """Rendre le nombre moyen d'avions pouvant atteindre un point de la zone (MODELE § 3.4)."""
    return nombre_avions * min(1.0, (portee_mise_a_poste / rayon_zone) ** 2)


def vitesse_minimale(
    nombre_avions: int, avions_voulus: int, rayon_zone: float, portee_arme: float, delai: float
) -> float:
    """Rendre la vitesse de mise a poste garantissant `avions_voulus` sur toute route, en m/s (MODELE § 3.5).

    Rend `math.inf` si l'on demande plus d'avions qu'il n'y en a, 0 si la portee de l'arme suffit seule.
    """
    if avions_voulus > nombre_avions:
        return math.inf
    return max(0.0, (rayon_zone * math.sqrt(avions_voulus / nombre_avions) - portee_arme) / delai)


def postes_sol_par_cible(drones_sur_cible: int, probabilite_destruction: float, engagements_par_passage: int) -> int:
    """Rendre le nombre de postes sol necessaires pour defendre une cible seule (MODELE § 5)."""
    return math.ceil(drones_sur_cible / (probabilite_destruction * engagements_par_passage))


def fenetre_tir(portee_arme: float, vitesse_drone: float, vitesse_avion: float) -> float:
    """Rendre la duree pendant laquelle un drone reste a portee lors d'un passage face a face, en s (MODELE § 4.1)."""
    return 2 * portee_arme / (vitesse_drone + vitesse_avion)


def tirs_par_passage(fenetre: float, emport: int, intervalle_entre_tirs: float) -> int:
    """Rendre le nombre de tirs utiles d'un avion pendant un passage (MODELE § 4.2)."""
    return min(emport, math.floor(fenetre / intervalle_entre_tirs))
