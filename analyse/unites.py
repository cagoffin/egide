"""Conversions entre unites d'affichage (km, km/h, min) et unites SI du modele.

Seules les frontieres (lecture du scenario, affichage) convertissent : le calcul reste en SI.
"""

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
