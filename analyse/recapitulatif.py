"""Recapitulatif chiffre des abaques, en Markdown : les nombres que les figures montrent."""

import math
import os
import tempfile
from pathlib import Path

from analyse import geometrie
from analyse.dimensionnement import (
    avions_sur_groupe,
    delai_scenario,
    destructions_par_avion,
    postes_sol_totaux,
)
from analyse.scenario import Scenario
from analyse.unites import m_vers_km, ms_vers_kmh

FLOTTES = (10, 20, 30, 50, 80, 100)
AVIONS_VOULUS = (1, 5, 8, 10)


def _ligne_tableau(cellules) -> str:
    return "| " + " | ".join(str(cellule) for cellule in cellules) + " |"


def _section_delais(scenario: Scenario) -> list[str]:
    detection = min(
        geometrie.horizon_radar(scenario.radar_hauteur_antenne, scenario.drones_altitude), scenario.radar_portee_max
    )
    rayon = geometrie.rayon_virage(scenario.avions_vitesse, scenario.avions_facteur_charge_max)
    delai = delai_scenario(scenario)
    return [
        "## Délais et manœuvre",
        f"- Détection à basse altitude : {m_vers_km(detection):.1f} km avant la frontière (MODELE § 2).",
        f"- Temps de mise à poste disponible : {delai:.0f} s, soit {delai / 60:.1f} min (§ 3.2).",
        (
            f"- Virage à {scenario.avions_facteur_charge_max:g} g : rayon {rayon:.0f} m, demi-tour en "
            f"{math.pi * rayon / scenario.avions_vitesse:.0f} s (§ 3.1) — négligeable devant le délai."
        ),
    ]


def _section_engagement(scenario: Scenario) -> list[str]:
    fenetre = geometrie.fenetre_tir(
        scenario.roquette_air_portee, scenario.drones_vitesse, scenario.avions_vitesse_engagement
    )
    emport = scenario.avions_roquettes_par_avion
    engagement_kmh = ms_vers_kmh(scenario.avions_vitesse_engagement)
    return [
        "## Engagement air-air (un passage)",
        f"- Fenêtre de tir face à face, à {engagement_kmh:.0f} km/h : {fenetre:.0f} s (§ 4.1).",
        (
            f"- Tirs utiles : laser {geometrie.tirs_par_passage(fenetre, emport, scenario.laser_duree_designation)}, "
            f"IR {geometrie.tirs_par_passage(fenetre, emport, scenario.ir_cadence)} (§ 4.2)."
        ),
        f"- Destructions attendues par avion moyen : {destructions_par_avion(scenario):.1f} (§ 4.3).",
    ]


def _section_vitesses(scenario: Scenario) -> list[str]:
    delai = delai_scenario(scenario)
    lignes = [
        "## Vitesse minimale de mise à poste (km/h)",
        "k = avions garantis sur une route quelconque ; « — » : impossible (§ 3.5).",
        "",
        _ligne_tableau(["k \\ N", *FLOTTES]),
        _ligne_tableau(["---"] * (len(FLOTTES) + 1)),
    ]
    for voulus in AVIONS_VOULUS:
        vitesses = [
            geometrie.vitesse_minimale(n, voulus, scenario.zone_rayon, scenario.roquette_air_portee, delai)
            for n in FLOTTES
        ]
        lignes.append(
            _ligne_tableau([voulus, *(f"{ms_vers_kmh(v):.0f}" if v != float("inf") else "—" for v in vitesses)])
        )
    return lignes


def _section_postes(scenario: Scenario, concentration: int) -> list[str]:
    uniforme = scenario.drones_nombre // scenario.cibles_nombre
    lignes = ["## Postes sol-air nécessaires (§ 5, § 6.1)", ""]
    lignes.append(
        _ligne_tableau(
            ["concentration par cible", "sans avions", f"{scenario.avions_nombre} avions", "avions sur le groupe"]
        )
    )
    lignes.append(_ligne_tableau(["---"] * 4))
    for libelle, drones in ((f"uniforme ({uniforme})", uniforme), (f"concentrée ({concentration})", concentration)):
        sans = postes_sol_totaux(scenario, drones, 0, scenario.avions_vitesse)
        avec = postes_sol_totaux(scenario, drones, scenario.avions_nombre, scenario.avions_vitesse)
        engages = avions_sur_groupe(scenario, scenario.avions_nombre, scenario.avions_vitesse, drones)
        lignes.append(_ligne_tableau([libelle, sans, avec, f"{engages:.1f}"]))
    stock = scenario.sol_munitions
    besoin = scenario.drones_nombre / scenario.sol_pk
    lignes += ["", f"Munitions sol pour tout l'essaim sans avions : {besoin:.0f} tirs pour un stock de {stock}."]
    return lignes


def ecrire_recapitulatif(scenario: Scenario, concentration: int, chemin: Path) -> None:
    """Ecrire le recapitulatif Markdown dans `chemin`, de facon atomique."""
    lignes = ["# Récapitulatif des abaques", ""]
    for section in (
        _section_delais(scenario),
        _section_engagement(scenario),
        _section_vitesses(scenario),
        _section_postes(scenario, concentration),
    ):
        lignes += [*section, ""]
    descripteur, temporaire = tempfile.mkstemp(suffix=".md", dir=chemin.parent)
    with os.fdopen(descripteur, "w", encoding="utf-8") as fichier:
        fichier.write("\n".join(lignes))
    Path(temporaire).replace(chemin)
