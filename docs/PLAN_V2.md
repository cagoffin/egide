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
| 1 | Registre d'algorithmes par rôle, portage du comportement actuel dans `algos/global/`, suite de conformité, index du catalogue | Bilans du jalon 0 rendus à l'identique ; conformité appliquée à tout fichier déposé | **socle fait** — pas de bibliothèque publique de modèles d'armes : ces modèles relèvent de `prive/` |
| 2 | Globe et carte 2,5D (MapLibre), sources configurables, relief dans le moteur (masquage radar), couverture réelle, tuiles hors ligne (PMTiles) | Sur relief plat, l'horizon calculé retrouve le § 2 | **fond de carte fait** (MapLibre embarqué, 5 fonds, relief ombré et 3D, bâtiments 3D, globe) ; relief dans le moteur et hors ligne à faire |
| 3 | Éditeur façon jeu de stratégie : palette, glisser-déposer, sélection, groupes Ctrl+1–9, ordres enchaînés, plans de vol, vue en profil, zones dessinées, ordres en direct rejoués | Un raid avec ordres en direct se rejoue à l'identique | **fait** : cibles, orbites, plan de vol, zones, sélection, groupes, envoi, annulation, ordres en cours de raid rejoués, vue en profil |
| 4 | Physique expliquée : niveaux de fidélité, fiches (équations, hypothèses, validité, sources), inspecteur « pourquoi » | Chaque formule codée a sa fiche ; chaque fiche cite le code | **fait** : explorateur `catalogue.html`, inspecteur au clic, renvois au modèle vérifiés |
| 5 | Preuve : convergence en pas de temps, sensibilité (Morris, Sobol), duel A/B, empreinte de reproductibilité, dossier de preuve | Les résultats publiés portent leur empreinte et leur convergence | **outils faits** en ligne de commande (`src/preuve.js` : empreinte, convergence, duel apparié, Morris, dossier) ; Sobol et duel en écran partagé à faire |
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
- *Jalon 5* — **Réglages inertes** : le criblage de Morris montre qu'un réglage peut n'avoir aucun effet (rouge.etalement_s
  ne joue qu'en tactique dispersée). Griser dans l'interface les réglages que l'algorithme en jeu ne lit pas, en
  croisant `meta.parametres` et le scénario.
- *Jalon 5* — **Un générateur par entité** : tirer le hasard de chaque drone et de chaque tireur dans son propre flux
  (graine dérivée de la graine du raid et de l'identifiant), pour que deux variantes d'un duel restent synchronisées
  plus longtemps et que le gain des nombres communs monte.
- *Jalon 5* — **Pas adaptatif vérifié** : choisir automatiquement le plus grand pas qui passe le test de convergence,
  et l'inscrire dans le dossier.
- *Jalon 5* — **Tornade dans l'interface** : afficher le résultat de Morris en diagramme μ*–σ et en tornade, cliquer
  un facteur pour lancer son balayage.

- *Jalon 0* — **Autonomie et sites de lancement** : maintenant que le moteur couvre le globe, les drones peuvent
  partir de sites réels à des centaines de km avec une autonomie, ce qui contraint les routes possibles et donc les
  couloirs d'attaque crédibles.
- *Jalon 0* — **Différentiel de scénario** : joindre à chaque résultat la liste des chemins modifiés par rapport à la
  référence (`bleu.avions.1.nombre : 30 → 50`), pour qu'un chiffre se lise toujours avec ce qui l'a produit.
- *Jalon 0* — **Explorateur du catalogue** : une page qui liste les unités, montre leur arbre d'héritage, leurs
  sources, leur niveau de fidélité et leur état de validation (à faire avec le jalon 1).
- *Jalon 4* — **Équations mises en forme** : rendre les équations des fiches en notation mathématique (KaTeX embarqué
  dans `vendor/`), et les relier aux paragraphes du modèle qu'elles appliquent.
- *Jalon 4* — **Comparer deux fiches** : mettre côte à côte deux unités ou deux algorithmes du même rôle, écarts
  surlignés — utile pour choisir entre un modèle public et un modèle privé.
- *Jalon 3* — **Chronologie des ordres** : une frise sous la barre de lecture qui marque chaque ordre donné, pour le
  retrouver, le déplacer dans le temps ou le supprimer — l'équivalent du journal de partie d'un jeu de stratégie.
- *Jalon 3* — **Zones à effet** : donner aux zones un rôle dans la simulation (couloir d'entrée imposé à l'essaim,
  zone d'exclusion pour les avions), en plus du comptage des incursions.
- *Jalon 3* — **Mini-carte** : une vignette de tout le théâtre dans un coin, avec le cadre de la vue, cliquable pour
  s'y rendre — le réflexe des jeux de stratégie dès qu'on zoome.
- *Jalon 3* — **Sélection par type** : double-cliquer une unité sélectionne toutes celles du même type visibles à
  l'écran (tous les avions IR, toutes les cibles).
- *Jalon 3* — **Formations** : répartir les avions sélectionnés en cercle, en ligne ou en grille autour du point
  visé, avec un espacement réglable, plutôt que de les placer un par un.
- *Jalon 2* — **Export vidéo du raid** : enregistrer la vue animée (carte, scope, bilan) en vidéo ou GIF depuis
  l'interface, pour partager une démonstration sans installer l'outil.
- *Jalon 2* — **Scénario dans l'adresse** : encoder les modifications du scénario dans l'URL, pour partager une
  situation précise d'un simple lien (même graine, même vue de carte).
- *Jalon 2* — **Brouillard de carte** : assombrir ce que les capteurs ne couvrent pas, pour voir d'un coup d'œil les
  zones où l'essaim avance sans être vu (prépare le brouillard de guerre).
- *Jalon 1* — **Fiche de dépôt** : quand la conformité refuse un fichier privé, afficher dans l'interface la règle
  violée et la ligne fautive, pour corriger sans lire les tests.
- *Jalon 0* — **Théâtres prédéfinis** : choisir le centre du théâtre par un nom de lieu plutôt que par latitude et
  longitude, avec une liste de théâtres d'exemple.
