import pytest

from analyse import unites


def test_800_kmh_valent_222_ms():
    assert unites.kmh_vers_ms(800) == pytest.approx(222.222, rel=1e-4)


def test_conversions_de_vitesse_reciproques():
    assert unites.ms_vers_kmh(unites.kmh_vers_ms(537)) == pytest.approx(537)


def test_conversions_de_distance_reciproques():
    assert unites.m_vers_km(unites.km_vers_m(150)) == pytest.approx(150)
