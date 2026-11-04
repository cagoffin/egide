"""Lecture d'un scenario v2 (scenarios/*.json) : resolution par le catalogue, puis vue plate pour les abaques.

Jumeau de src/moteur/scenario.js pour la resolution (sans la migration v1, faite cote JavaScript).
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path

from analyse.catalogue import RACINE, CatalogueInvalideError, charger_unites, unite_si
from analyse.unites import convertir_objet

FORMAT = 2
TACTIQUES = ("direct", "disperse", "fourmi")


class ScenarioInvalideError(ValueError):
    """Le scenario n'est pas au format 2, ou une cle manque, est inconnue ou n'a pas sa phrase dans `_aide`."""


def _valider_aide(objet: dict, chemin: str) -> None:
    aide = objet.get("_aide", {})
    for cle, valeur in objet.items():
        if cle.startswith("_") or cle in {"surcharges", "surcharges_emport"}:
            continue
        if cle not in aide:
            raise ScenarioInvalideError(f"{chemin}{cle} : aucune phrase dans _aide")
        if isinstance(valeur, list):
            for i, element in enumerate(valeur):
                sans_aide = [k for k in element if not k.startswith("_") and f"{cle}[].{k}" not in aide]
                if sans_aide:
                    raise ScenarioInvalideError(f"{chemin}{cle}.{i} : cles sans phrase dans _aide : {sans_aide}")
        elif isinstance(valeur, dict):
            _valider_aide(valeur, f"{chemin}{cle}.")


def ids_unites(brut: dict) -> list[str]:
    """Rendre les identifiants d'unites que cite le scenario."""
    bleu = brut["bleu"]
    return [brut["rouge"]["unite"], *(g["unite"] for g in bleu["avions"]), bleu["sol"]["unite"], bleu["radar"]["unite"]]


def _resoudre_avions(groupes: list, fichiers: dict) -> list[dict]:
    resolus = []
    for groupe in groupes:
        avion = unite_si(groupe["unite"], fichiers, groupe.get("surcharges"))
        arme = unite_si(avion["emport"], fichiers, groupe.get("surcharges_emport"))
        resolus.append({**avion, "nombre": groupe["nombre"], "altitude": float(groupe["altitude_m"]), "arme": arme})
    return resolus


def resoudre_scenario(brut: dict, fichiers: dict) -> dict:
    """Rendre le scenario resolu en unites SI, meme structure que resoudre_scenario() en JavaScript.

    Raises:
        ScenarioInvalideError: format, cle ou unite invalide.
    """
    if brut.get("format") != FORMAT:
        raise ScenarioInvalideError("seul le format 2 est lu ici ; un scenario v1 se migre cote JavaScript")
    _valider_aide(brut, "")
    theatre, rouge, bleu = brut["theatre"], brut["rouge"], brut["bleu"]
    if rouge["tactique"] not in TACTIQUES:
        raise ScenarioInvalideError(f"tactique inconnue « {rouge['tactique']} »")
    try:
        drone = unite_si(rouge["unite"], fichiers, rouge.get("surcharges"))
        reglages_rouge = {cle: valeur for cle, valeur in rouge.items() if cle not in {"unite", "surcharges"}}
        sol = unite_si(bleu["sol"]["unite"], fichiers, bleu["sol"].get("surcharges"))
        return {
            "nom": brut["nom"],
            "theatre": {
                "origine": {
                    "lat": math.radians(theatre["origine_lat_deg"]),
                    "lon": math.radians(theatre["origine_lon_deg"]),
                    "alt": 0,
                },
                **convertir_objet(
                    {"zone_rayon_km": theatre["zone_rayon_km"], "cibles_nombre": theatre["cibles_nombre"]}
                ),
            },
            "rouge": {**drone, "altitude": drone["altitude_croisiere"], **convertir_objet(reglages_rouge)},
            "avions": _resoudre_avions(bleu["avions"], fichiers),
            "sol": {**sol, "nombre": bleu["sol"]["nombre"], "munitions": bleu["sol"]["munitions"]},
            "radar": unite_si(bleu["radar"]["unite"], fichiers, bleu["radar"].get("surcharges")),
            "conduite": convertir_objet(bleu["conduite"]),
            "simulation": convertir_objet(brut["simulation"]),
        }
    except CatalogueInvalideError as erreur:
        raise ScenarioInvalideError(str(erreur)) from erreur


@dataclass(frozen=True)
class Scenario:
    """Vue plate d'un scenario resolu, en SI, pour les formules fermees (flotte homogene en portee et vitesses)."""

    zone_rayon: float
    cibles_nombre: int
    drones_nombre: int
    drones_vitesse: float
    drones_tactique: str
    drones_concentration_max: int
    drones_altitude: float
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
    roquette_air_portee: float
    roquette_air_pk: float
    laser_duree_designation: float
    ir_cadence: float
    sol_munitions: int
    sol_postes_nombre: int
    sol_portee: float
    sol_pk: float
    sol_engagements_par_passage: int


def _commune(groupes: list[dict], lire, libelle: str):
    valeurs = {lire(groupe) for groupe in groupes if groupe["nombre"] > 0} or {lire(groupes[0])}
    if len(valeurs) > 1:
        raise ScenarioInvalideError(f"flotte heterogene en {libelle} : les abaques supposent une valeur commune")
    return valeurs.pop()


def _arme_de_guidage(groupes: list[dict], guidage: str, cle: str) -> float:
    armes = [g["arme"] for g in groupes if g["arme"]["guidage"] == guidage] or [g["arme"] for g in groupes]
    return armes[0][cle]


def aplatir(resolu: dict) -> Scenario:
    """Rendre la vue plate d'un scenario resolu.

    Raises:
        ScenarioInvalideError: les groupes d'avions different en vitesse, emport, portee ou Pk.
    """
    avions, rouge, sol, radar, conduite = (resolu[c] for c in ("avions", "rouge", "sol", "radar", "conduite"))
    return Scenario(
        zone_rayon=resolu["theatre"]["zone_rayon"],
        cibles_nombre=resolu["theatre"]["cibles_nombre"],
        drones_nombre=rouge["nombre"],
        drones_vitesse=rouge["vitesse"],
        drones_tactique=rouge["tactique"],
        drones_concentration_max=rouge["concentration_max"],
        drones_altitude=rouge["altitude"],
        radar_hauteur_antenne=radar["hauteur_antenne"],
        radar_portee_max=radar["portee_max"],
        delai_reaction=conduite["delai_reaction"],
        interception_profondeur=conduite["interception_profondeur"],
        avions_nombre=sum(g["nombre"] for g in avions),
        avions_ir_nombre=sum(g["nombre"] for g in avions if g["arme"]["guidage"] == "ir"),
        avions_vitesse=_commune(avions, lambda g: g["vitesse_mise_a_poste"], "vitesse de mise a poste"),
        avions_vitesse_engagement=_commune(avions, lambda g: g["vitesse_engagement"], "vitesse d'engagement"),
        avions_facteur_charge_max=_commune(avions, lambda g: g["facteur_charge_max"], "facteur de charge"),
        avions_roquettes_par_avion=_commune(avions, lambda g: g["emport_nombre"], "emport"),
        roquette_air_portee=_commune(avions, lambda g: g["arme"]["portee"], "portee d'arme"),
        roquette_air_pk=_commune(avions, lambda g: g["arme"]["pk"], "Pk"),
        laser_duree_designation=_arme_de_guidage(avions, "laser", "duree_designation"),
        ir_cadence=_arme_de_guidage(avions, "ir", "cadence"),
        sol_munitions=sol["munitions"],
        sol_postes_nombre=sol["nombre"],
        sol_portee=sol["portee"],
        sol_pk=sol["pk"],
        sol_engagements_par_passage=sol["engagements_par_passage"],
    )


def charger_scenario(chemin: Path, racine: Path = RACINE) -> Scenario:
    """Rendre la vue plate du scenario v2 lu dans `chemin`, resolu avec le catalogue de `racine`.

    Raises:
        ScenarioInvalideError: scenario ou catalogue invalide.
    """
    brut = json.loads(Path(chemin).read_text(encoding="utf-8"))
    return aplatir(resoudre_scenario(brut, charger_unites(ids_unites(brut), racine)))
