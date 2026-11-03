from pathlib import Path

import pytest

pytest.importorskip("matplotlib")

from analyse import abaques
from analyse.recapitulatif import ecrire_recapitulatif
from analyse.scenario import charger_scenario

SCENARIO = charger_scenario(Path(__file__).parent.parent / "scenarios" / "reference.json")


def test_les_trois_figures_et_le_recapitulatif_sont_ecrits(tmp_path):
    abaques.tracer_vitesse_minimale(SCENARIO, 400, tmp_path / "v.png")
    abaques.tracer_postes_sol(SCENARIO, (0, 50), tmp_path / "p.png")
    abaques.tracer_carte_postes(SCENARIO, 300, tmp_path / "c.png")
    ecrire_recapitulatif(SCENARIO, 300, tmp_path / "r.md")
    assert sorted(chemin.name for chemin in tmp_path.iterdir()) == ["c.png", "p.png", "r.md", "v.png"]
