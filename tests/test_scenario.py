import json
from pathlib import Path

import pytest

from analyse.scenario import ScenarioInvalideError, charger_scenario

REFERENCE = Path(__file__).parent.parent / "scenarios" / "reference.json"


def test_scenario_de_reference_converti_en_si():
    scenario = charger_scenario(REFERENCE)
    assert scenario.zone_rayon == 150_000
    assert scenario.drones_vitesse == pytest.approx(222.222, rel=1e-4)
    assert scenario.delai_reaction == 90


def _ecrire_variante(tmp_path, modifier):
    brut = json.loads(REFERENCE.read_text(encoding="utf-8"))
    modifier(brut)
    chemin = tmp_path / "variante.json"
    chemin.write_text(json.dumps(brut), encoding="utf-8")
    return chemin


def test_cle_manquante_refusee(tmp_path):
    def retirer(brut):
        del brut["sol_pk"]
        del brut["_aide"]["sol_pk"]

    with pytest.raises(ScenarioInvalideError, match="sol_pk"):
        charger_scenario(_ecrire_variante(tmp_path, retirer))


def test_cle_sans_phrase_aide_refusee(tmp_path):
    with pytest.raises(ScenarioInvalideError, match="_aide"):
        charger_scenario(_ecrire_variante(tmp_path, lambda brut: brut["_aide"].pop("graine")))
