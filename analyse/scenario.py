"""Lecture d'un scenario JSON (scenarios/*.json) et conversion en unites SI."""

import json
from dataclasses import dataclass, fields
from pathlib import Path

from analyse.unites import km_vers_m, kmh_vers_ms


class ScenarioInvalideError(ValueError):
    """Le fichier de scenario ne contient pas exactement les cles documentees."""


@dataclass(frozen=True)
class Scenario:
    """Scenario en unites SI : m, s, m/s. Les cles du JSON portent l'unite d'affichage dans leur nom."""

    zone_rayon: float
    cibles_nombre: int
    drones_nombre: int
    drones_vitesse: float
    drones_altitude: float
    drones_tactique: str
    drones_concentration_max: int
    drones_etalement: float
    fourmi_eclatement_rayon: float
    fourmi_largeur_couloir: float
    radar_hauteur_antenne: float
    radar_portee_max: float
    delai_reaction: float
    interception_profondeur: float
    avions_nombre: int
    avions_ir_nombre: int
    avions_vitesse: float
    avions_vitesse_engagement: float
    avions_facteur_charge_max: float
    avions_roquettes_par_avion: int
    avions_pas_decision: float
    roquette_air_portee: float
    roquette_air_pk: float
    laser_duree_designation: float
    ir_cadence: float
    sol_roquettes_nombre: int
    sol_missiles_nombre: int
    sol_postes_nombre: int
    sol_portee: float
    sol_pk: float
    sol_engagements_par_passage: int
    simulation_pas: float
    graine: int


# Suffixe de cle JSON -> conversion vers SI. Une cle sans suffixe connu est deja en SI ou sans unite.
_CONVERSIONS = {"_kmh": kmh_vers_ms, "_km": km_vers_m, "_m": float, "_s": float}


def _convertir(cle: str, valeur: float) -> tuple[str, float]:
    for suffixe, conversion in _CONVERSIONS.items():
        if cle.endswith(suffixe):
            return cle.removesuffix(suffixe), conversion(valeur)
    return cle, valeur


def charger_scenario(chemin: Path) -> Scenario:
    """Rendre le scenario lu dans `chemin`, converti en SI.

    Raises:
        ScenarioInvalideError: une cle manque, est en trop, ou n'a pas sa phrase dans `_aide`.
    """
    brut = json.loads(Path(chemin).read_text(encoding="utf-8"))
    valeurs = {cle: valeur for cle, valeur in brut.items() if not cle.startswith("_")}
    sans_aide = set(valeurs) - set(brut.get("_aide", {}))
    if sans_aide:
        raise ScenarioInvalideError(f"{chemin} : cles sans phrase dans _aide : {sorted(sans_aide)}")
    convertis = dict(_convertir(cle, valeur) for cle, valeur in valeurs.items())
    attendus = {champ.name for champ in fields(Scenario)}
    if set(convertis) != attendus:
        manquantes, en_trop = attendus - set(convertis), set(convertis) - attendus
        raise ScenarioInvalideError(f"{chemin} : manquantes {sorted(manquantes)}, en trop {sorted(en_trop)}")
    return Scenario(**convertis)
