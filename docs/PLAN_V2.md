# Égide v2 : de la simulation à la plateforme

Objectif : un outil ludique, à la manière d'un jeu de stratégie en temps réel vu de dessus, capable de prouver la
qualité de ses simulations. Unités et algorithmes se rangent dans des fichiers ; la Terre est un ellipsoïde avec son
relief ; on place les unités et on trace les plans de vol à la souris ; chaque modèle explique sa physique.

## Décisions prises (4 novembre 2026)
- **Vue** : 2,5D vue de dessus d'abord, esprit jeu vidéo (MapLibre GL et deck.gl). Une vue 3D (CesiumJS) viendra ensuite.
- **Modèles réels** : uniquement dans `prive/` (hors git, ou lien vers un dépôt privé). Le catalogue public reste
  notionnel, par classe, avec des ordres de grandeur publics et leurs sources.
- **Ordre** : jalon 0, puis 1, puis les autres. Toutes les idées ci-dessous sont retenues.
- **Arborescence** sans accents (`unites/`, `algos/unites/`) pour éviter les écarts entre macOS, Windows et git.

## Arborescence cible
```
unites/<famille>/<classe>/<unite>.json      catalogue public (notionnel), héritage par herite_de
prive/unites/…   prive/algos/…              catalogue privé, identifiants préfixés « prive/ »
algos/global/<role>/<algo>.js               détection, pistage, allocation, guidage, mouvement, comportement
algos/unites/<chemin de l'unité>/<role>.js  algorithmes propres à une unité
cartes/fonds/  cartes/relief/  cartes/batiments/   sources déclarées (tuiles, MNT, bâti), sans code
scenarios/                                  placements, plans de vol, zones, météo
```

## Jalons et critères de preuve

| Jalon | Contenu | Critère de preuve | État |
|---|---|---|---|
| 0 | Socle géodésique 3D, catalogue minimal, scénario v2 par chemins, migration v1 | Statistiques de la v0.1 retrouvées à moins de 3 σ ; géodésie sur exemples GeographicLib | **fait** |
| 1 | Registre d'algorithmes par rôle, portage du comportement actuel dans `algos/global/`, bibliothèque publique la plus complète possible, fiches générées, explorateur du catalogue | Suite de conformité appliquée à tout algorithme déposé : pur, déterministe, unités cohérentes, invariants | à faire |
| 2 | Globe et carte 2,5D (MapLibre), sources configurables, relief dans le moteur (masquage radar), couverture réelle, tuiles hors ligne (PMTiles) | Sur relief plat, l'horizon calculé retrouve le § 2 | à faire |
| 3 | Éditeur façon jeu de stratégie : palette, glisser-déposer, sélection, groupes Ctrl+1–9, ordres enchaînés, plans de vol, vue en profil, zones dessinées, ordres en direct rejoués | Un raid avec ordres en direct se rejoue à l'identique | à faire |
| 4 | Physique expliquée : niveaux de fidélité, fiches (équations, hypothèses, validité, sources), inspecteur « pourquoi » | Chaque formule codée a sa fiche ; chaque fiche cite le code | à faire |
| 5 | Preuve : convergence en pas de temps, sensibilité (Morris, Sobol), duel A/B, empreinte de reproductibilité, dossier de preuve | Les résultats publiés portent leur empreinte et leur convergence | à faire |
| 6 | Idées ci-dessous, par lots | Selon l'idée | à faire |

## Idées retenues

**Prouver la qualité**
- Test de convergence : diviser le pas de temps jusqu'à stabilité des résultats.
- Analyse de sensibilité (Morris puis Sobol) : quels paramètres pilotent les fuites.
- Duel A/B : même graine, deux configurations en écran partagé, écart chiffré.
- Empreinte : condensé scénario + catalogue + versions d'algorithmes joint à chaque résultat.
- Validation des modèles de mouvement sur trajectoires ADS-B publiques.
- Dossier de preuve généré : hypothèses, résultats avec IC, convergence.

**Réalisme**
- Météo et nuit : vent, plafond, visibilité, effets sur l'IR et la désignation laser.
- Radar à courbes de probabilité de détection : SER, Swerling, fouillis de sol, fausses alarmes.
- Chaîne de commandement : latences de liaison, perte d'un nœud.
- Guerre électronique : brouillage, leurres.
- Logistique : retour à la base pour réarmer, vagues successives.

**Jeu et analyse**
- Brouillard de guerre : vérité terrain contre situation perçue, et l'écart entre les deux comme mesure.
- Équipe rouge automatique : algorithme génétique qui cherche le pire plan d'attaque.
- Optimiseur de déploiement bleu : où placer postes et orbites pour minimiser les fuites.
- Coût-efficacité : coût par interception, ratio d'échange.
- Cartes de chaleur (couverture réelle, couloirs de fuite) et enveloppes de tir.
- Missions défis ; rouge contre bleu à deux joueurs.

**Interopérabilité**
- Export ASTERIX des plots et pistes simulés (UDP) vers un système C2 ou des outils de test d'interfaces radar.
- Import et export KML / GeoJSON.

## Suggestions au fil de l'eau
Nouvelles idées proposées pendant le développement, à trier avec l'utilisateur.

- *Jalon 0* — **Autonomie et sites de lancement** : maintenant que le moteur couvre le globe, les drones peuvent
  partir de sites réels à des centaines de km avec une autonomie, ce qui contraint les routes possibles et donc les
  couloirs d'attaque crédibles.
- *Jalon 0* — **Différentiel de scénario** : joindre à chaque résultat la liste des chemins modifiés par rapport à la
  référence (`bleu.avions.1.nombre : 30 → 50`), pour qu'un chiffre se lise toujours avec ce qui l'a produit.
- *Jalon 0* — **Explorateur du catalogue** : une page qui liste les unités, montre leur arbre d'héritage, leurs
  sources, leur niveau de fidélité et leur état de validation (à faire avec le jalon 1).
- *Jalon 0* — **Théâtres prédéfinis** : choisir le centre du théâtre par un nom de lieu plutôt que par latitude et
  longitude, avec une liste de théâtres d'exemple.
