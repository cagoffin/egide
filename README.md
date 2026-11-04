# Égide

Simulation de défense du territoire face à un essaim de drones rapides, jouable comme un jeu de stratégie vu de
dessus et assez rigoureuse pour en prouver les résultats. Le défenseur dispose de radars, de centres de détection et
de contrôle reliés par un réseau de liaisons, de postes sol-air sur les cibles, d'avions en orbite armés de roquettes
guidées et de drones défensifs ; l'attaquant choisit sa tactique, ou suit le plan de vol que vous dessinez, sur la
vraie Terre et son relief. Une auto-configuration propose la répartition des moyens pour un pays ou une zone.

![L'interface en lecture : attaque « fourmi », les avions convergent sur l'essaim, le bilan évolue en direct](docs/images/interface.gif)

> Scénario notionnel : ordres de grandeur publics, aucune performance réelle de système identifié. Le dépôt public
> ne contient que des modèles notionnels ; les modèles de systèmes réels se rangent dans un catalogue privé
> (`prive/`, ignoré par git) que l'outil charge de la même façon.

## Ce que fait Égide

- **Répond à deux questions** : à quelle vitesse les avions doivent-ils se mettre à poste, selon leur nombre, pour
  intercepter un essaim dont on ignore la route ? Combien de postes sol-air faudrait-il sans eux ?
- **Simule sur la vraie Terre** : ellipsoïde WGS84, distances géodésiques, relief qui masque radars et liaisons radio.
- **Modélise l'information** : chaque centre (CDC) ne sait que ce que ses radars lui transmettent, par des liaisons
  qui ont une latence, une portée et qui peuvent tomber en panne ; il n'affecte que les avions qu'il joint et ne
  désigne les drones qu'aux batteries qu'il joint. On voit l'information circuler, et le journal la raconte.
- **Configure seul** : menaces, moyens disponibles, un pays ou une zone, et l'outil propose la répartition qui
  minimise les frappes, vérifiée en simulation.
- **Se joue à la souris** : placer cibles, radars et avions, relier les unités, dessiner le plan de vol de l'essaim et
  des zones protégées, donner des ordres et couper des liaisons en plein raid.
- **S'explique** : chaque unité et chaque algorithme a sa fiche (équations, hypothèses, sources, code) ; un clic sur une
  entité dit pourquoi elle fait ce qu'elle fait.
- **Se prouve** : graines fixées, intervalles de confiance, empreinte de reproductibilité, convergence en pas de temps,
  duels à nombres aléatoires communs, criblage de sensibilité, et plus de 200 tests qui s'appliquent d'eux-mêmes à tout
  nouveau modèle.

## Lancer

macOS : double-clic sur `lancer.command`. Windows : `lancer.bat`. La page s'ouvre sur http://127.0.0.1:8766.
Rien à installer : JavaScript sans compilation, bibliothèques embarquées dans `vendor/`.

## En bref

Scénario de référence (1 000 drones à 800 km/h, 10 cibles, 200 postes sol, 50 avions à 500 km/h), 30 raids par
tactique, moyenne et intervalle de confiance à 95 % :

| Tactique de l'essaim | Frappes sans avions | Frappes avec 50 avions | Détruits par les avions |
|---|---|---|---|
| Groupes directs | 650 ± 21 | 395 ± 27 | 257 |
| Dispersés | 524 ± 8 | **187 ± 11** | 407 |
| Fourmi (couloir compact puis éclatement) | 668 ± 19 | 401 ± 25 | 272 |

- Les avions divisent les frappes par 1,6 à 2,8. La tactique fourmi est la plus efficace pour l'attaquant : le couloir
  compact sature chaque avion sur un passage, et l'éclatement tardif oblige la flotte à se partager.
- Face aux groupes compacts, la limite est la cadence de tir par passage, pas le stock de munitions.
- Avec 50 avions, garantir 5 avions sur une route quelconque demande ~350 km/h ; 8 avions, ~465 km/h ; 10, ~525 km/h.

Le dossier de preuve du scénario de référence (`node src/preuve.js dossier`) redonne 403 ± 26 frappes en tactique
fourmi, et montre que le pas de temps de 0,5 s a convergé alors que celui de 1 s ne l'a pas.

## L'écran

La carte occupe tout l'écran ; le reste flotte par-dessus et se replie.

- **En haut** : la tactique de l'essaim, l'éditeur, la Vue du CDC (ce que sait le centre), le catalogue.
- **À gauche** : un rail de panneaux, un à la fois (touches 1 à 7) — Scénario, Calques, Balayage, Profil, Journal,
  Auto-configuration, Aide.
- **À droite** : le bilan en quatre chiffres, ses détails repliés, et l'inspecteur au clic sur une entité.
- **En bas** : la lecture (×0,25 à ×16, frise, graine) et, en édition, la barre d'outils.

Symbologie inspirée d'APP-6 : dôme bleu plein pour un avion IR, creux pour un avion laser, cadre bleu pour un radar
(R1, R2…) et pour les centres (CDC), losange, triangle ou cercle bleu pour les drones défensifs armés, intercepteurs et
brouilleurs, demi-losange rouge pour un drone détecté (gris s'il ne l'est pas),
carré pour une cible, cercle ocre pour une bulle sol qui pâlit à mesure qu'elle s'épuise.

Le panneau **Calques** choisit le fond de carte (sombre, OpenStreetMap, plan ou photographies IGN, relief ombré ou
3D, bâtiments 3D, globe ; chaque source est un fichier de `cartes/`) et affiche ou masque chaque famille d'entités.
Ce qui est masqué ne se survole, ne s'inspecte ni ne s'édite.

![Le panneau Calques : fond de carte et quinze familles d'entités, chacune avec sa pastille de légende](docs/images/calques.png)

### Trois tactiques adverses

<table>
<tr>
<td width="50%"><img src="docs/images/eclatement.gif" alt="Tactique fourmi, vue zoomée : le couloir éclate et les avions convergent"></td>
<td width="50%"><img src="docs/images/direct.gif" alt="Groupes directs : chaque groupe arrive d'un cap différent sur sa cible"></td>
</tr>
<tr>
<td><b>Fourmi</b>, vue zoomée : tout l'essaim entre par un même couloir, éclate, puis se répartit sur ses cibles pendant que les avions convergent.</td>
<td><b>Groupes directs</b> : chaque groupe arrive d'un cap tiré au hasard, en vague serrée, droit sur sa cible.</td>
</tr>
<tr>
<td colspan="2" align="center"><img src="docs/images/disperse.gif" alt="Dispersés : un anneau de drones isolés converge sur toute la zone" width="60%"></td>
</tr>
<tr>
<td colspan="2"><b>Dispersés</b> : chaque drone vient seul, de n'importe quel cap, départs étalés. La plus facile à défendre : les avions trouvent des cibles partout. La quatrième tactique, <b>plan de vol</b>, suit l'itinéraire que vous dessinez.</td>
</tr>
</table>

### Avec ou sans couche aérienne

Même raid fourmi, même graine, en fin de raid :

<table>
<tr>
<td width="50%"><img src="docs/images/fin_de_raid.png" alt="Fin de raid avec 50 avions : 469 frappes"></td>
<td width="50%"><img src="docs/images/sans_avions.png" alt="Fin de raid sans avions : 713 frappes"></td>
</tr>
<tr><td>Avec 50 avions : <b>469 frappes</b>.</td><td>Sans avions : <b>713 frappes</b>.</td></tr>
</table>

## Éditer à la souris

« Éditer » met le raid en pause au début et ouvre la barre d'outils :

- **Sélection** (S) : glisser pour déplacer cibles, avions, radars, CDC, points de passage ou zones ; rectangle ou
  Maj+clic pour sélectionner ; clic droit pour envoyer la sélection en gardant sa formation ; Ctrl+1 à 9 forme un
  groupe, 1 à 9 le rappelle ; Suppr efface ; Ctrl+Z annule.
- **Cible** (C), **Radar** (R) et **CDC** (K) : un clic, une unité. Toucher un radar fait passer la couverture « frontière » en
  radars placés un à un, chacun avec sa portée.
- **Liaison** (L) : un clic sur une unité (radar, CDC, avion, ou cible pour ses postes sol), un clic sur l'autre,
  avec le moyen choisi dans la liste (filaire, radio, satellite, optique). « Réseau complet » y revient.
- **Plan de vol** (P) : l'essaim suit le tracé en colonne, puis chaque drone rejoint sa cible ; le panneau Profil
  trace son altitude au-dessus du relief réel.
- **Zone** (Z) : un clic par sommet, double-clic ou Entrée pour fermer ; une zone protégée compte les incursions.

![Éditeur : un radar déplacé, un radar ajouté (R11), une zone protégée et un plan de vol de trois points sélectionnés](docs/images/editeur.png)

**En plein raid**, en pause, « Éditer » passe en mode ordres : sélectionnez des avions puis clic droit pour les
envoyer depuis le CDC ; sélectionnez un radar, le CDC ou une liaison puis Suppr pour le mettre hors service. Tout est
enregistré dans le scénario avec son instant, et le raid se rejoue à l'identique.

![Ordres à 7:00 : avions envoyés au nord-ouest, radar R4 mis hors service (croix rouge), liaison optique de R1 hors de portée](docs/images/ordres.png)

Chaque geste devient une modification du scénario, comme un curseur : l'annulation, l'export JSON, les réglages
enregistrés et la reproductibilité par la graine valent pour tout ce que vous placez à la main.

## Réseau d'information

Par défaut, tout le monde parle avec tout le monde, sans délai. Dès la première liaison tracée, le réseau devient
explicite : chaque radar relié au CDC (au fil par défaut), le CDC relié à chaque groupe d'avions (par radio), et vos
liaisons en plus.

- La conduite n'apprend un drone qu'après la latence du chemin depuis le radar qui le voit ; un radar non relié voit
  pour rien.
- Ses consignes, comme vos ordres, n'arrivent à l'avion qu'après la latence de sa liaison ; un avion hors de portée
  radio n'est plus affecté (croix rouge).
- Les pannes se datent ; le CDC peut devenir une cible de l'essaim (panneau Scénario), détruit à la première frappe.
- Le synoptique trace chaque liaison selon son moyen et sa latence ; une liaison coupée est barrée en rouge.

![Réseau en liaisons : fil depuis la plupart des radars, satellite depuis R10, liaison optique de R1 trop longue ; l'inspecteur du CDC liste liaisons et radars non reliés](docs/images/reseau.png)

**Vue du CDC** (V) : l'écran ne montre plus que ce que sait la conduite — les drones qu'elle connaît, regroupés en
pistes par son algorithme de pistage. La vérité terrain revient au même bouton.

![Vue du CDC : les pistes de la conduite, avec leur effectif](docs/images/vue_pc.png)

## Circulation de l'information

Qui voit quoi, qui informe qui, quand : impulsion bleue d'un radar vers le CDC avec le nombre de drones signalés
(rouge et arrêtée si le radar n'est pas relié), impulsion blanche du CDC vers l'avion qu'il envoie, cercle blanc à la
réception de la mission, tirets jaunes quand un avion accroche un drone avec son propre capteur.

![Dispersés, de 2:45 à 3:35 : les radars signalent les drones au CDC, puis, le délai de réaction écoulé, la salve des missions part vers les avions](docs/images/information.gif)

Le panneau **Journal** raconte la même histoire en phrases, filtrable ; l'inspecteur d'un drone en donne la chaîne
complète : vu par tel radar, connu du CDC, délai de réaction, accroché, tiré.

![Journal de l'information et chaîne du drone 999 : vu par R10 à 1:58, connu du CDC aussitôt, actionnable à 3:28, accroché par l'avion 31, détruit à 5:40](docs/images/journal.png)

## Centres de détection et de contrôle

Le CDC reçoit les radars, en fait des pistes, envoie les avions qu'il contrôle et désigne les drones aux postes sol
qu'il joint. On peut en ajouter d'autres (outil CDC) : chacun a sa propre situation, échange ses pistes par le
réseau, contrôle les avions qu'il joint le plus vite, et reprend ceux d'un centre qui tombe. Un poste sol désigné
tire dès que le drone entre dans sa bulle ; seul, il doit d'abord l'acquérir (10 s, notionnel).

![Un second centre au sud-ouest, relié par radio aux postes de C2 : son inspecteur liste les radars qu'il reçoit et les postes qu'il désigne](docs/images/cdc.png)

| Scénario de référence en liaisons, 8 raids | Détruits au sol | Frappes |
|---|---|---|
| Postes sol reliés au CDC | 312 | 432 ± 52 |
| Postes sol seuls | 231 | 515 ± 42 |

## Drones défensifs

Trois familles notionnelles, rangées comme les avions et soumises aux mêmes règles (mission du centre, mise à poste,
accroche, engagement) : **drones armés** (deux charges de courte portée), **intercepteurs à usage unique** (ils
percutent leur cible et se perdent), **brouilleurs** (effet de zone : neutralisation à taux constant dans un rayon,
sans modèle de signal). Curseurs « Drones défensifs » du panneau Scénario.

![Drones armés (losanges), intercepteurs (triangles) et brouilleurs (cercles et leur rayon) au contact de l'essaim ; le bilan compte les drones neutralisés par brouillage et les intercepteurs perdus](docs/images/drones_defensifs.png)

| Ajoutés aux 50 avions, tactique fourmi, 6 raids | Frappes |
|---|---|
| Référence | 404 ± 51 |
| + 100 drones armés | 390 ± 52 |
| + 200 intercepteurs | 364 ± 51 |
| + 30 brouilleurs | 134 ± 98 (paramètre de brouillage notionnel, à calibrer) |

## Auto-configuration

Le panneau **Auto** demande les menaces à considérer, les moyens disponibles et la zone (un pays, d'après Natural
Earth, ou une zone dessinée), puis construit le scénario : zone protégée, cibles et centres bien répartis, radars
le long de la frontière, avions et drones défensifs placés selon trois paramètres de répartition. Une recherche en
simulation garde la répartition qui minimise les frappes, toutes menaces confondues, et la compare à une répartition
uniforme avec son intervalle de confiance. Le résultat s'applique, se range dans la bibliothèque ou s'exporte.

<table>
<tr>
<td width="50%"><img src="docs/images/autoconfig.png" alt="Le panneau Auto sur la Belgique : essais successifs et répartition retenue"></td>
<td width="50%"><img src="docs/images/autoconfig_scenario.png" alt="Le scénario obtenu : frontière belge en zone protégée, radars au-delà, cibles et drones répartis"></td>
</tr>
</table>

```sh
node outils/frontieres.js                                     # une fois : frontières Natural Earth (domaine public)
node src/autoconfig.js --pays FRA --menaces fourmi:1000,direct:1000 --radars 30 --cibles 12 --centres 3 \
  --postes 400 --munitions 2000 --avions 20,30,40,0,10 --tirages 3     # écrit scenarios/auto_france.json
```

La liste **Bibliothèque** du panneau Scénario charge les scénarios du dépôt (`scenarios/`) et ceux rangés dans le
navigateur.

## Relief

Un terrain du catalogue (`unites/terrains/`), choisi dans le panneau Scénario, donne au moteur le relief du théâtre :
chaque radar a son masque d'horizon, un drone qui vole bas derrière une crête n'est pas vu, et les liaisons radio et
optiques exigent la vue directe. L'écran trace la couverture réelle de chaque radar.

![Relief de démonstration : une crête au nord et un massif au sud-est entament la couverture de R1, R2, R10 et R5](docs/images/relief.png)

Le dépôt livre un relief synthétique de démonstration. Pour le vrai relief d'un théâtre, depuis un poste qui a le réseau :

```sh
node outils/terrain.js --nom centre_france --lat 47 --lon 2.5 --rayon_km 320 --pas_km 1
node outils/indexer.js
```

Le terrain est ensuite un fichier : le moteur travaille hors ligne.

## Comprendre : fiches et inspecteur

Un clic sur une entité ouvre l'**inspecteur**, mis à jour en direct : pour un avion, pourquoi la conduite l'a envoyé
là (piste retenue, score, délai, alternatives écartées) et par quelle liaison elle le joint ; pour un drone, chaque
tir subi, sa probabilité de survie Π(1 − Pk) et la cause de sa perte ; pour une cible, sa défense ; pour un radar, sa
portée, son masquage par le relief et sa latence jusqu'au CDC ; pour le CDC, l'état de tout le réseau.

![Inspecteur : l'avion 42 a été envoyé sur une piste de 519 drones, au score 519, contre 116 pour l'alternative](docs/images/inspecteur.png)

Le lien **Catalogue** ouvre l'explorateur : une fiche par unité (fidélité, lignée, sources, paramètres avec l'ancêtre
qui les fixe, algorithmes) et par algorithme (équations, hypothèses, domaine de validité, références, code, utilisateurs).

<table>
<tr>
<td width="50%"><img src="docs/images/catalogue_unite.png" alt="Fiche d'unité : turbopropulseur IR, lignée et paramètres hérités"></td>
<td width="50%"><img src="docs/images/catalogue_algo.png" alt="Fiche d'algorithme : essaim fourmi, équations et hypothèses"></td>
</tr>
</table>

## Balayage

Le panneau **Balayage** fait varier un réglage, rejoue le raid sur plusieurs graines par valeur et trace chaque
grandeur avec son intervalle de confiance, calculé en arrière-plan.

![Balayage du nombre d'avions laser : détruits par les avions, au sol, frappes, avec intervalles de confiance](docs/images/balayage.png)

<img src="docs/images/mobile.png" alt="L'interface sur un écran de téléphone" width="280">

## Étendre : unités, algorithmes, cartes

```
unites/<famille>/<classe>/<unite>.json    une unité par fichier, héritage par herite_de, chaque clé documentée
unites/liaisons/<moyen>.json              moyens de communication : latence, portée, vue directe
unites/terrains/<terrain>.json            reliefs : grilles d'altitudes (node outils/terrain.js)
unites/vecteurs/drones_defensifs/…        drones armés, intercepteurs, brouilleurs
algos/global/<rôle>/<algo>.js             un algorithme par module : fiche « meta » + fonctions du rôle, sans import
cartes/fonds|relief|batiments/<source>.json   une source de carte par fichier, attribution obligatoire
prive/unites/…  prive/algos/…             votre catalogue privé (ignoré par git), identifiants préfixés « prive/ »
scenarios/                                scénarios JSON, chaque clé documentée
```

Après tout ajout : `node outils/indexer.js`. La suite de conformité vérifie d'elle-même tout fichier déposé, public ou
privé : fiche complète, rôle tenu, aucune dépendance cachée, paramètres présents, invariants du rôle. Les rôles et
leurs fonctions sont décrits dans [docs/MODELE.md § 10](docs/MODELE.md).

## En ligne de commande

```sh
node src/campagne.js                                            # scénario de référence, 50 raids
node src/campagne.js --tirages 200 --rouge.tactique direct      # toute valeur se règle par son chemin
node src/campagne.js --rouge.surcharges.vitesse_kmh 600         # y compris une valeur d'unité
node src/campagne.js --balayer bleu.avions.1.nombre=0,10,30,60  # une campagne par valeur
uv run --with matplotlib python -m analyse.abaques              # abaques analytiques et récapitulatif
```

<table>
<tr>
<td width="50%"><img src="docs/images/vitesse_minimale.png" alt="Vitesse minimale de mise à poste selon le nombre d'avions"></td>
<td width="50%"><img src="docs/images/postes_sol.png" alt="Postes sol nécessaires selon la concentration adverse"></td>
</tr>
<tr>
<td>Vitesse minimale de mise à poste pour garantir k avions sur une route quelconque.</td>
<td>Postes sol nécessaires selon la concentration adverse, sans avions puis avec 20, 50 et 100 avions.</td>
</tr>
</table>

## Prouver

Chaque résultat des outils de preuve porte son **empreinte** (SHA-256 du scénario, des unités, des algorithmes en
jeu et du code du moteur) et ses écarts au scénario de référence : deux résultats de même empreinte et de mêmes
graines sont identiques au bit près.

```sh
node src/preuve.js dossier                                   # dossier Markdown : résultats, convergence, modèles, limites
node src/preuve.js convergence --pas 2,1,0.5,0.25 --tirages 10
node src/preuve.js duel --variante rouge.tactique=direct     # A contre B, mêmes graines, écart et verdict
node src/preuve.js morris --facteur bleu.avions.1.nombre=0:60 --facteur bleu.sol.nombre=0:200
node src/preuve.js empreinte
```

- **Convergence** : la campagne rejouée à plusieurs pas de temps, chaque pas comparé au plus fin tirage par tirage.
- **Duel A/B** : deux variantes sur les mêmes graines ; différence appariée, intervalle de confiance, gain des
  nombres aléatoires communs mesuré.
- **Morris** : classement des réglages par influence (μ*, μ, σ) et seuil de bruit ; il a révélé, par exemple, que
  l'étalement des départs n'a aucun effet hors tactique dispersée.

## Rigueur

- Unités SI et géodésie WGS84 dans tout le calcul ; Vincenty vérifié sur les exemples de GeographicLib au millimètre.
- Hasard à graine : une graine rejoue un raid à l'identique, ordres et pannes compris.
- Chaque formule codée cite son paragraphe de [docs/MODELE.md](docs/MODELE.md), et un test vérifie que chaque renvoi existe.
- Formules fermées en Python et en JavaScript, vérifiées l'une contre l'autre ; simulation confrontée aux formules.
- Chaque refonte prouvée : le moteur géodésique retrouve les statistiques de la v0.1, le passage aux algorithmes en
  fichiers redonne les bilans exacts, et le réseau complet sans relief laisse ces bilans inchangés.
- Limites connues : drones sans contre-mesures ni évitement, radar parfait dans sa portée, pas encore de débit ni de
  brouillage sur les liaisons, drones défensifs et brouillage notionnels, auto-configuration par recherche locale
  (MODELE § 7, § 15 à § 20).

## Documentation

- [docs/MODELE.md](docs/MODELE.md) : toutes les équations et hypothèses.
- [docs/PLAN_V2.md](docs/PLAN_V2.md) : feuille de route, jalons, idées et suggestions retenues.

## Tests

```sh
npm test                 # rapide
npm run test:complet     # ajoute l'équivalence avec la v0.1 (~2 min)
pytest -q tests
ruff check analyse tests
```
