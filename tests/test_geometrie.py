import json
import math
from pathlib import Path

import pytest

from analyse import geometrie

REFERENCES = json.loads((Path(__file__).parent / "references.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("cas", REFERENCES["cas"], ids=lambda cas: f"{cas['fonction']}-{cas['attendu']}")
def test_rend_la_valeur_de_reference(cas):
    obtenu = getattr(geometrie, cas["fonction"])(*cas["arguments"])
    assert obtenu == pytest.approx(cas["attendu"], rel=REFERENCES["tolerance_relative"])


def test_vitesse_minimale_infinie_quand_on_veut_plus_avions_que_disponibles():
    assert geometrie.vitesse_minimale(5, 6, 150_000, 8_000, 360) == math.inf


def test_vitesse_minimale_nulle_quand_la_portee_arme_couvre_la_cellule():
    assert geometrie.vitesse_minimale(1000, 1, 150_000, 8_000, 360) == 0


def test_avions_concentrables_plafonnes_au_nombre_avions():
    assert geometrie.avions_concentrables(50, 400_000, 150_000) == 50
