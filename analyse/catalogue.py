"""Catalogue d'unites (unites/ et prive/unites/) : chargement, heritage, validation, conversion SI.

Jumeau de src/moteur/catalogue.js : tests/resolution_reference.json verifie que les deux resolvent pareil.
"""

import json
from pathlib import Path

from analyse.unites import convertir_objet

RACINE = Path(__file__).resolve().parent.parent
FIDELITES = ("notionnel", "cinematique", "point_masse", "6ddl")
# Cles dont la valeur est l'identifiant d'une autre unite, a charger avec celle qui la cite.
_REFERENCES = ("herite_de", "emport")


class CatalogueInvalideError(ValueError):
    """Une unite manque, herite en boucle, ou porte une cle non documentee."""


def chemin_unite(identifiant: str, racine: Path = RACINE) -> Path:
    """Rendre le fichier d'une unite : « prive/… » vise le catalogue prive."""
    if identifiant.startswith("prive/"):
        return racine / "prive" / "unites" / f"{identifiant.removeprefix('prive/')}.json"
    return racine / "unites" / f"{identifiant}.json"


def charger_unites(identifiants, racine: Path = RACINE) -> dict:
    """Rendre les fichiers bruts {id: contenu} des unites et de toutes celles qu'elles citent.

    Raises:
        CatalogueInvalideError: un fichier d'unite est introuvable.
    """
    fichiers = {}
    en_attente = list(identifiants)
    while en_attente:
        identifiant = en_attente.pop()
        if identifiant in fichiers:
            continue
        chemin = chemin_unite(identifiant, racine)
        try:
            fichiers[identifiant] = json.loads(chemin.read_text(encoding="utf-8"))
        except FileNotFoundError as erreur:
            raise CatalogueInvalideError(f"unite introuvable : {identifiant} ({chemin})") from erreur
        en_attente += [
            fichiers[identifiant][cle] for cle in _REFERENCES if isinstance(fichiers[identifiant].get(cle), str)
        ]
    return fichiers


def _fusionner(identifiant: str, fichiers: dict, lignee: tuple) -> dict:
    if identifiant in lignee:
        raise CatalogueInvalideError(f"heritage circulaire : {' -> '.join((*lignee, identifiant))}")
    fichier = fichiers.get(identifiant)
    if fichier is None:
        raise CatalogueInvalideError(f"unite non chargee : {identifiant}")
    if "herite_de" not in fichier:
        return {**fichier, "_aide": dict(fichier.get("_aide", {})), "_lignee": [identifiant]}
    parent = _fusionner(fichier["herite_de"], fichiers, (*lignee, identifiant))
    propre = {cle: valeur for cle, valeur in fichier.items() if cle != "herite_de"}
    aide = {**parent["_aide"], **fichier.get("_aide", {})}
    return {**parent, **propre, "_aide": aide, "_lignee": [*parent["_lignee"], identifiant]}


def unite_brute(identifiant: str, fichiers: dict) -> dict:
    """Rendre l'unite fusionnee avec ses ancetres, en unites d'affichage, validee.

    Raises:
        CatalogueInvalideError: cle sans phrase d'aide, fidelite inconnue ou aucune source.
    """
    unite = _fusionner(identifiant, fichiers, ())
    sans_aide = [cle for cle in unite if not cle.startswith("_") and cle not in unite["_aide"]]
    if sans_aide:
        raise CatalogueInvalideError(f"{identifiant} : cles sans phrase dans _aide : {', '.join(sans_aide)}")
    if unite.get("fidelite") not in FIDELITES:
        raise CatalogueInvalideError(f"{identifiant} : fidelite inconnue « {unite.get('fidelite')} »")
    if not unite.get("sources"):
        raise CatalogueInvalideError(f"{identifiant} : aucune source")
    return {**unite, "id": identifiant}


def unite_si(identifiant: str, fichiers: dict, surcharges: dict | None = None) -> dict:
    """Rendre l'unite en unites SI, surcharges appliquees.

    Raises:
        CatalogueInvalideError: une surcharge vise une cle que l'unite ne connait pas.
    """
    brute = unite_brute(identifiant, fichiers)
    surcharges = surcharges or {}
    inconnues = [cle for cle in surcharges if cle not in brute]
    if inconnues:
        raise CatalogueInvalideError(f"{identifiant} : surcharges de cles inconnues : {', '.join(inconnues)}")
    valeurs = convertir_objet({**brute, **surcharges})
    return {"lignee": brute["_lignee"], **valeurs, "id": identifiant}
