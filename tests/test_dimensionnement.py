import dataclasses
from pathlib import Path

import pytest

from analyse import dimensionnement
from analyse.scenario import charger_scenario
from analyse.unites import kmh_vers_ms

SCENARIO = charger_scenario(Path(__file__).parent.parent / "scenarios" / "reference.json")


def test_delai_du_scenario_de_reference_proche_de_sept_minutes():
    assert dimensionnement.delai_scenario(SCENARIO) == pytest.approx(403.4, abs=0.5)


def test_sans_avions_chaque_cible_dimensionnee_pour_la_concentration():
    assert dimensionnement.postes_sol_totaux(SCENARIO, 100, 0, SCENARIO.avions_vitesse) == 10 * 18


def test_les_avions_ne_font_jamais_augmenter_le_besoin_sol():
    for concentration in (50, 100, 300, 500):
        sans = dimensionnement.postes_sol_totaux(SCENARIO, concentration, 0, SCENARIO.avions_vitesse)
        avec = dimensionnement.postes_sol_totaux(SCENARIO, concentration, 50, SCENARIO.avions_vitesse)
        assert avec <= sans


def test_mise_a_poste_plus_rapide_ne_degrade_jamais_le_besoin_sol():
    """La fenetre de tir dependait de la vitesse de mise a poste : au-dela de 600 km/h le besoin sol
    remontait. Elle depend desormais de la seule vitesse d'engagement (MODELE § 4.1)."""
    besoins = [dimensionnement.postes_sol_totaux(SCENARIO, 300, 50, kmh_vers_ms(v)) for v in range(300, 801, 20)]
    assert besoins == sorted(besoins, reverse=True)


def test_un_essaim_disperse_partage_les_avions_entre_les_groupes():
    disperse = dimensionnement.avions_sur_groupe(SCENARIO, 50, kmh_vers_ms(700), 100)
    concentre = dimensionnement.avions_sur_groupe(SCENARIO, 50, kmh_vers_ms(700), 500)
    assert disperse == pytest.approx(50 / 10)
    assert concentre > disperse


def test_flotte_sans_avion_ir_ne_compte_que_les_tirs_laser():
    laser_seul = dataclasses.replace(SCENARIO, avions_ir_nombre=0)
    assert dimensionnement.destructions_par_avion(laser_seul) == pytest.approx(5 * SCENARIO.roquette_air_pk)
