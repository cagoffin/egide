"""Dimensionnement analytique d'un scenario : compose les formules fermees de geometrie (MODELE § 3 a § 6)."""

import math

from analyse import geometrie
from analyse.scenario import Scenario


def delai_scenario(scenario: Scenario) -> float:
    """Rendre le temps de mise a poste laisse par le scenario, en s (MODELE § 2 et § 3.2)."""
    detection = min(
        geometrie.horizon_radar(scenario.radar_hauteur_antenne, scenario.drones_altitude), scenario.radar_portee_max
    )
    return geometrie.delai_disponible(
        detection, scenario.interception_profondeur, scenario.drones_vitesse, scenario.delai_reaction
    )


def destructions_par_avion(scenario: Scenario) -> float:
    """Rendre l'esperance de destructions d'un avion moyen de la flotte en un passage (MODELE § 4.3).

    La flotte melange guidage IR et laser dans la proportion du scenario. L'avion tire a sa vitesse
    d'engagement : la vitesse de mise a poste ne raccourcit pas la fenetre de tir.
    """
    fenetre = geometrie.fenetre_tir(
        scenario.roquette_air_portee, scenario.drones_vitesse, scenario.avions_vitesse_engagement
    )
    emport = scenario.avions_roquettes_par_avion
    tirs_ir = geometrie.tirs_par_passage(fenetre, emport, scenario.ir_cadence)
    tirs_laser = geometrie.tirs_par_passage(fenetre, emport, scenario.laser_duree_designation)
    part_ir = scenario.avions_ir_nombre / scenario.avions_nombre if scenario.avions_nombre else 0.0
    return (part_ir * tirs_ir + (1 - part_ir) * tirs_laser) * scenario.roquette_air_pk


def groupes_simultanes(scenario: Scenario, concentration: int) -> int:
    """Rendre le nombre de groupes que forme l'essaim pour porter `concentration` drones par cible (MODELE § 6.1)."""
    return min(scenario.cibles_nombre, math.ceil(scenario.drones_nombre / concentration))


def avions_sur_groupe(scenario: Scenario, nombre_avions: int, vitesse_avion: float, concentration: int) -> float:
    """Rendre le nombre d'avions engagés sur un groupe : portee de mise a poste, plafonnee par le partage (§ 6.1)."""
    if nombre_avions == 0:
        return 0.0
    portee = vitesse_avion * delai_scenario(scenario) + scenario.roquette_air_portee
    atteignables = geometrie.avions_concentrables(nombre_avions, portee, scenario.zone_rayon)
    return min(atteignables, nombre_avions / groupes_simultanes(scenario, concentration))


def postes_sol_totaux(scenario: Scenario, concentration: int, nombre_avions: int, vitesse_avion: float) -> int:
    """Rendre le nombre total de postes sol pour tenir `concentration` drones sur chaque cible (MODELE § 5, § 6.1).

    Chaque cible est dimensionnee pour la concentration maximale, car on ignore laquelle sera visee ;
    les avions pre-attritent le groupe avant la defense terminale.
    """
    attrition = avions_sur_groupe(scenario, nombre_avions, vitesse_avion, concentration) * destructions_par_avion(
        scenario
    )
    survivants = max(0.0, concentration - attrition)
    par_cible = geometrie.postes_sol_par_cible(survivants, scenario.sol_pk, scenario.sol_engagements_par_passage)
    return scenario.cibles_nombre * par_cible
