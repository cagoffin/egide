"""Conversions entre unites d'affichage (km, km/h, min) et unites SI du modele.

Seules les frontieres (lecture du scenario, affichage) convertissent : le calcul reste en SI.
"""

import math

SECONDES_PAR_HEURE = 3600


def kmh_vers_ms(vitesse_kmh: float) -> float:
    """Rendre une vitesse en m/s."""
    return vitesse_kmh * 1000 / SECONDES_PAR_HEURE


def ms_vers_kmh(vitesse_ms: float) -> float:
    """Rendre une vitesse en km/h."""
    return vitesse_ms * SECONDES_PAR_HEURE / 1000


def km_vers_m(distance_km: float) -> float:
    """Rendre une distance en m."""
    return distance_km * 1000


def m_vers_km(distance_m: float) -> float:
    """Rendre une distance en km."""
    return distance_m / 1000


# L'ordre compte : « _kmh » avant « _km » et « _m », « _ms » avant « _s ». Jumeau de src/moteur/unites.js.
_SUFFIXES = (
    ("_kmh", kmh_vers_ms),
    ("_km", km_vers_m),
    ("_ms", float),
    ("_m", float),
    ("_s", float),
    ("_g", float),
    ("_deg", math.radians),
)


def convertir_cle(cle: str, valeur):
    """Rendre (cle SI, valeur SI) d'apres le suffixe d'unite de `cle` ; une cle sans suffixe connu est rendue telle quelle."""
    for suffixe, conversion in _SUFFIXES:
        if cle.endswith(suffixe):
            return cle.removesuffix(suffixe), conversion(valeur)
    return cle, valeur


def convertir_objet(objet: dict) -> dict:
    """Rendre une copie de l'objet plat `objet` en unites SI, sans ses cles de documentation (prefixe « _ »)."""
    return dict(convertir_cle(cle, valeur) for cle, valeur in objet.items() if not cle.startswith("_"))
