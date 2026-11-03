# Égide

Simulation de défense du territoire contre un essaim de drones rapides : radars, postes sol-air et
avions en orbite. Ordres de grandeur notionnels.

- Modèle mathématique : [docs/MODELE.md](docs/MODELE.md)
- Plan en trois étapes : [docs/PLAN.md](docs/PLAN.md)
- Scénario de référence : [scenarios/reference.json](scenarios/reference.json)

## Lancer
macOS : double-clic sur `lancer.command` ; Windows : `lancer.bat`.

## Tests
    npm test
    pytest -q tests
    ruff check analyse tests
