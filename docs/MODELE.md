# Modèle mathématique d'Égide

Référence de toutes les formules codées. Le code cite le paragraphe (`MODELE § 3.4`) ; une hypothèse
entre ici avant d'entrer dans le code. Unités SI dans les équations ; g = 9,806 65 m/s².

## 1 · Repère et scénario
- Territoire : disque de rayon R ; cibles fixes réparties dans le disque.
- Drones : vitesse constante v_d, altitude h_d, trajectoire inconnue du défenseur jusqu'à détection.
- Le défenseur connaît la position des drones dès qu'ils entrent en couverture radar (§ 2), sans
  connaître leur destination.

## 2 · Détection : horizon radar
Portée géométrique entre une antenne à h_r et une cible à h_d (atmosphère standard, rayon terrestre
effectif 4/3) :

  d_h = √(2 k R_T) · (√h_r + √h_d) ≈ 4,12 km · (√h_r[m] + √h_d[m])

Portée de détection : d_det = min(d_h, portée instrumentée). Exemple : 20 m / 100 m → ≈ 60 km.

## 3 · Avions : mise à poste
### 3.1 Virage
Rayon en palier au facteur de charge n : r = v² / (g √(n² − 1)). Demi-tour : t = π r / v.
À 500 km/h et 5 g : r ≈ 400 m, t ≈ 9 s — négligeable devant les délais du § 3.2.

### 3.2 Délai disponible
Un drone détecté à d_det de la frontière (§ 2) et intercepté à la profondeur p dans la zone
(clé `interception_profondeur_km`) laisse :

  t = (d_det + p) / v_d − t_réaction

### 3.3 Portée de mise à poste
Un avion ne poursuit pas (v_a < v_d) : il doit se placer sur la route avant le passage. Il peut agir sur
tout point à moins de ρ = v_a · t + r_arme de sa position au moment de l'ordre.

### 3.4 Avions concentrables
Hypothèse : N avions répartis uniformément sur le disque de rayon R (orbites jointives). Le nombre
d'avions pouvant atteindre un point donné est en moyenne :

  k = N · min(1, (ρ / R)²)

C'est un majorant pour un point proche du bord (une partie du disque de rayon ρ sort de la zone).

### 3.5 Vitesse minimale de mise à poste
Inversion de § 3.4 pour garantir k avions sur une route quelconque :

  v_min = (R √(k / N) − r_arme) / t,   ramenée à 0 si négative, infinie si k > N.

## 4 · Engagement air-air
### 4.1 Fenêtre de tir
Pendant un passage face à face, un avion dispose d'une fenêtre T_f = 2 r_arme / (v_d + v_e), où v_e est
sa **vitesse d'engagement** (une fois à poste), distincte de la vitesse de mise à poste v_a du § 3.
Sans cette distinction, accélérer la mise à poste raccourcirait la fenêtre et ferait paradoxalement
remonter le besoin en postes sol au-delà de 600 km/h.
### 4.2 Tirs utiles par passage
- Laser : n_L = min(emport, ⌊T_f / t_désignation⌋) — un tir attend l'impact du précédent.
- IR : n_IR = min(emport, ⌊T_f / t_cadence⌋).
### 4.3 Destructions attendues
E = n · Pk ; un drone reçoit au plus un tir à la fois (pas de double tir dans ce modèle de base).

## 5 · Défense sol (sans avions)
Un poste réalise e engagements utiles par passage de vague dans sa bulle.
- Tirs nécessaires pour n drones visant une cible : n / Pk.
- Postes nécessaires par cible : P = ⌈ n / (Pk · e) ⌉ ; total = somme sur les cibles.
- Dimensionnement robuste : n = concentration maximale que l'attaquant peut porter sur une cible
  inconnue, et non n_total / nombre_de_cibles.

## 6 · Attrition multicouche (approximation analytique)
Survivants après les couches successives i : S_{i+1} = S_i − min(S_i, capacité_i · Pk_i).
### 6.1 Partage des avions entre groupes et pré-attrition
Pour porter c drones sur une cible, l'essaim forme G = min(cibles, ⌈n_total / c⌉) groupes simultanés.
Les avions se partagent entre eux : un groupe reçoit A = min(k, N / G) avions (k du § 3.4).
Pré-attrition d'un groupe : A · E (E du § 4.3, un seul passage par avion). Chaque cible est
dimensionnée pour c drones moins cette pré-attrition, car on ignore laquelle sera visée.

La simulation (étape 2) remplace cette approximation et doit la retrouver quand l'essaim est
uniformément réparti.

## 7 · Limites connues
- Couverture radar sans relief : continue le long de la frontière, à l'horizon du § 2 (le relief arrive au jalon 2).
- Pas de contre-mesures, pas de leurres, pas de manœuvre d'évitement des drones.
- Radar parfait dans sa couverture (pas de fausse alarme ni de perte de piste).
- Pas de rechargement des avions pendant le raid.

## 8 · Simulation multi-agents (étape 2, `src/moteur/`)
### 8.1 Temps et hasard
Pas fixe `simulation_pas_s` (0,5 s). Tout tirage passe par un générateur à graine (`hasard.js`) : une graine
rejoue un raid à l'identique. Une campagne (`src/campagne.js`) enchaîne les graines `graine`, `graine + 1`, …
et résume chaque grandeur par sa moyenne et son intervalle de confiance à 95 % (1,96 σ / √N).

### 8.2 Menace
Répartition sur les cibles : § 6.1 (G groupes de taille égale, cibles tirées au hasard). Les drones naissent
20 km avant la couverture radar et volent à vitesse constante, sans réagir à la défense.
- `direct` : chaque groupe arrive d'un cap tiré au hasard, en vague serrée (±1 km), et va droit sur sa cible.
- `disperse` : chaque drone a son propre cap et part à un instant tiré dans `drones_etalement_s`.
- `fourmi` : tout l'essaim entre par un même cap, en colonne de 4 km sur `fourmi_largeur_couloir_km`, jusqu'au
  point d'éclatement à `fourmi_eclatement_rayon_km` du centre, puis chaque drone rejoint sa cible.

Un drone qui atteint sa cible la frappe (fuite) ; il n'y a pas de rayon létal autour de la cible.

### 8.3 Détection et planification
Un drone est vu dès qu'il entre dans le disque de rayon R + d_det (§ 2) ; il n'est utilisable par la conduite
qu'après `delai_reaction_s`. Toutes les `avions_pas_decision_s`, la conduite :
1. regroupe les drones vus en pistes (cellules de 5 km), chacune pondérée par son effectif ;
2. extrapole chaque piste en ligne droite — elle ignore la destination et le point d'éclatement ;
3. pour chaque avion libre (armé, sans drone en approche), calcule le plus petit délai t tel que
   |D + V t| ≤ v_a t + r_arme (racine du trinôme, `delai_interception`), dans un horizon de 15 min ;
4. envoie l'avion au point extrapolé qui maximise effectif / (1 + avions déjà envoyés dans la même cellule).

### 8.4 Mouvement des avions
Mise à poste à `avions_vitesse_kmh` (ligne droite ; le virage, § 3.1, est négligé). Dès qu'un drone se
rapproche à moins de 3 portées d'arme, l'avion passe en engagement et vole vers lui à
`avions_vitesse_engagement_kmh`. Sans cible restante, il se replanifie ou revient à son orbite.

### 8.5 Tirs
- Air : sur le drone non visé le plus proche à portée. Laser : impact après `laser_duree_designation_s`, l'avion
  ne tire pas entre-temps. IR : impact après le vol de la roquette (700 m/s), tir suivant après `ir_cadence_s`.
  Un drone visé n'est pas visé une seconde fois avant l'impact.
- Sol : postes sur les cibles, stock partagé à parts égales ; tir sur le drone le plus proche dans la bulle,
  résultat immédiat ; cadence = (r_sol / v_d) / e, pour réaliser les e engagements du § 5 pendant la traversée.

### 8.6 Écart attendu avec les formules fermées
Le pas discret place un tir à l'entrée de la bulle et un à l'arrivée sur la cible : un poste réalise 8 à 9 tirs
là où le § 5 en compte 8. Les tests d'acceptation (`tests/simulation.test.js`) vérifient cette fourchette et
que les destructions valent tirs × Pk à l'intervalle de confiance près.

## 9 · Géodésie et scénario v2 (jalon 0)
### 9.1 Scénario v2 et catalogue
Un scénario (`scenarios/*.json`, format 2) cite ses unités par identifiant ; chaque unité est un fichier de
`unites/` (public, notionnel) ou de `prive/unites/` (hors git, identifiant préfixé `prive/`). Une unité hérite des
clés de son parent (`herite_de`) ; toute clé porte sa phrase d'aide chez elle ou chez un ancêtre. Le scénario peut
remplacer une valeur d'unité (`surcharges`, `surcharges_emport`). La résolution rend un scénario en SI où chaque groupe
porte ses propres paramètres : la flotte peut être hétérogène. Toute valeur se modifie par son chemin
(`bleu.avions.1.nombre`, `rouge.surcharges.vitesse_kmh`), que ce soit dans l'interface, un balayage ou la ligne de commande.
Un scénario v1 (clés plates de la v0.1) est migré à la lecture ; la migration est vérifiée par les tests.

### 9.2 Ellipsoïde et repères
WGS84 : a = 6 378 137 m, f = 1/298,257 223 563. Une position est (φ, λ, h) en radians et mètres ; sa position
géocentrique (ECEF) est gardée en cache. Deux distances, chacune à sa place :
- **oblique** (ligne droite ECEF) pour tout ce que mesure un capteur ou ce que couvre une arme : portées, bulles sol ;
- **géodésique** (Vincenty, sur l'ellipsoïde) pour la couverture radar autour du centre et le placement des entités.

Vincenty est vérifié sur les exemples publiés de GeographicLib (JFK → Heathrow, Wellington → Salamanque, ce dernier
presque antipodal) à mieux que le millimètre. La méthode ne converge pas pour des points exactement antipodaux : elle
lève alors une erreur plutôt que de rendre une valeur fausse.

### 9.3 Mouvement à altitude constante
À chaque pas, la direction du but est recalculée dans le plan tangent local (Est, Nord, Haut) et le mobile avance de
v·Δt horizontalement, par les rayons de courbure méridien M et normal N :
Δφ = Δn / (M + h), Δλ = Δe / ((N + h) cos φ). Recalculer la direction à chaque pas fait suivre la géodésique : sur
100 km par pas de 111 m, la longueur parcourue diffère de la géodésique de moins de 10 m (test).

### 9.4 Interception en trois dimensions
Le trinôme du § 8.3 se résout en ECEF, vecteurs à trois composantes. L'extrapolation rectiligne d'une piste suit la
corde et passe sous la surface d'environ d²/8R (≈ 785 m à 200 km) : on ne garde que la latitude et la longitude du
point extrapolé, et l'avion y vole à l'altitude de son groupe. Les portées d'arme sont des distances obliques : un avion
à 1 000 m atteint un drone à 100 m jusqu'à √(8² − 0,9²) ≈ 7,95 km de distance au sol.

### 9.5 Index spatial
Cases cubiques de 12 km en ECEF, sans singularité aux pôles ni à l'antiméridien. Une recherche parcourt les cases du
cube englobant, ou les cases occupées quand elles sont moins nombreuses. 12 km est le compromis mesuré entre essaim
compact et essaim dispersé ; la taille des cases ne change aucun résultat, seulement le temps de calcul.

### 9.6 Équivalence avec la v0.1
Le moteur plan de la v0.1 a été figé en statistiques (`tests/references_v01.json`, 20 raids par tactique). Le moteur
géodésique doit les retrouver à moins de 3 σ sur l'écart des moyennes des frappes et des destructions air et sol
(`tests/equivalence_v01.test.js`), alors que la géométrie diffère (ellipsoïde, avions à 1 000 m, azimuts comptés depuis
le nord). Les graines étant fixées, ce test est déterministe.

### 9.7 Affichage
Le scope projette les positions en azimutale équidistante sphérique autour du centre (rayon moyen 6 371 008,8 m) :
les distances au centre sont exactes à 0,5 % près jusqu'à 300 km, et les anneaux restent des cercles. Cette projection
ne sert qu'à l'affichage ; aucun calcul du moteur ne l'utilise.

## 10 · Registre d'algorithmes (jalon 1)
### 10.1 Principe
Le moteur orchestre (ordre des étapes, index spatial, tirage du Pk, journal) ; chaque décision est confiée à un
algorithme désigné par une unité (`algos` du fichier d'unité, fusionné rôle par rôle avec ses ancêtres) ou par le
scénario (`rouge.tactique`, `bleu.conduite.pistage`, `bleu.conduite.allocation`). Un algorithme est un module ES de
`algos/global/<rôle>/` ou `algos/unites/…`, ou de `prive/algos/…` (identifiant préfixé `prive/`).

### 10.2 Contrat d'un algorithme
- Il exporte `meta` : rôle, nom, fidélité, description, équations, hypothèses, domaine de validité, références (au
  moins une) et paramètres lus (clé SI, unité, aide).
- Il exporte les fonctions de son rôle (`src/moteur/algos.js`, `ROLES`).
- Il n'importe rien et n'appelle ni hasard global, ni horloge, ni réseau : géodésie et générateur à graine lui sont
  passés en arguments. Il est donc pur, déterministe, et indépendant de son dossier.

| Rôle | Porté par | Fonctions |
|---|---|---|
| comportement | scénario (`rouge.tactique`) | `planifier_drone(contexte, cible, hasard, outils)` |
| mouvement | unité (drone, avion) | `avancer(mobile, route, distance, outils)` |
| detection | unité (radar) | `preparer(scenario, radar, outils)`, `detecte(etat, drone, outils)` |
| pistage | scénario (`bleu.conduite.pistage`) | `pister(drones, outils)` |
| allocation | scénario (`bleu.conduite.allocation`) | `allouer(avions, pistes, outils)` |
| tir | unité (arme) | `planifier_tir(arme, distance)` |
| tir_sol | unité (poste) | `cadence(poste, vitesse_cible)` |

### 10.3 Preuve du portage
Les huit algorithmes de `algos/global/` sont le comportement du jalon 0 sorti du moteur. Quatre raids de référence
(trois tactiques, plus un petit raid à cheval sur l'antiméridien) rendent exactement les bilans du jalon 0
(`tests/portage_j0.test.js`).

### 10.4 Conformité automatique
`tests/conformite.test.js` s'applique à tout fichier déposé, public ou privé, sans test écrit à la main : fiche
complète, rangement sous le bon rôle, aucune dépendance cachée, algorithmes cités existants et du bon rôle,
paramètres lus présents dans l'unité, déterminisme et invariants par rôle (un mouvement ne va jamais plus loin que
demandé ni ne change d'altitude ; un pistage compte chaque drone dans une seule piste ; un comportement mène chaque
drone sur sa cible). Les index `unites/index.json` et `algos/index.json` sont régénérés par `node outils/indexer.js`.

## 11 · Fond de carte (jalon 2)
La carte n'entre dans aucun calcul : elle sert de fond à l'affichage. Le moteur garde sa géodésie (§ 9) ; le scope se
dessine sur un canevas transparent posé sur la carte MapLibre, chaque position géographique passant par la projection
de la carte (`src/vue/ecran.js`). Anneaux, frontière, couverture et bulles sont tracés en polygones géodésiques
(sommets calculés par Vincenty direct), donc justes sur toute projection : Mercator, globe, vue inclinée.
La barre d'échelle donne la taille au sol d'un pixel au centre de la vue ; en vue inclinée ou sur le globe, elle ne
vaut que près du centre.

Les sources (fonds, relief, bâtiments) sont des fichiers de `cartes/` au format de `cartes/_format.json`, chacun avec
son attribution et ses conditions d'usage ; la conformité vérifie leurs clés et la présence de l'attribution.

## 12 · Éditeur et plan de vol (jalon 3)
### 12.1 Positions placées
Le scénario peut fixer des cibles (`theatre.cibles_placees`) et des orbites d'avions (`bleu.avions[].orbites_placees`)
en {lat_deg, lon_deg}. Les éléments placés passent d'abord ; le complément jusqu'au nombre demandé est tiré au hasard
comme avant (§ 8). Le nombre de cibles ne descend jamais sous le nombre de cibles placées.

### 12.2 Gestes de l'éditeur
Chaque geste devient des modifications par chemin du scénario (`src/vue/edition.js`, pur et testé), exactement comme
un curseur : l'annulation, l'export, les réglages enregistrés et la reproductibilité par la graine valent donc pour
l'édition. Déplacer un élément fige toutes les cibles, ou toutes les orbites de son groupe : rien d'autre ne bouge à
la relecture. Un déplacement est une translation géodésique : chaque élément garde sa distance et son azimut par
rapport au point de référence (barycentre de la sélection pour l'envoi au clic droit), donc la formation est conservée.

### 12.3 Comportement « plan de vol »
L'essaim suit les points de passage dessinés, en colonne de largeur `fourmi_largeur_couloir_km` et de 4 km de
profondeur ; chaque drone garde son décalage latéral, mesuré perpendiculairement au tronçon, à chaque point. Après le
dernier point, il rejoint sa cible. Le premier point est le départ : s'il est dans la couverture radar, l'essaim est vu
d'emblée.

### 12.4 Ordres en cours de raid
En pause à l'instant t, l'éditeur passe en mode ordres : on sélectionne des avions et on les envoie à un point. L'ordre
est enregistré dans le scénario (`bleu.ordres` : instant, numéros d'avions, point), puis le raid est recalculé depuis
le début et rejoué jusqu'à t. Au premier pas où l'instant de l'ordre est atteint, les avions cités encore armés passent
en ralliement vers le point, à leur altitude ; la conduite ne les réaffecte plus avant leur arrivée, mais ils engagent
toujours un drone qui les approche, puis reprennent leur route. Arrivés, ils redeviennent libres. Comme toute
modification, l'ordre se rejoue à l'identique avec la même graine.

### 12.5 Zones
Une zone est un polygone de sommets géographiques. Une zone « protégée » compte, toutes les 2 s, les drones actifs qui
s'y trouvent (chaque drone une seule fois) : c'est le nombre d'incursions, ajouté au bilan quand le scénario a des zones.
L'appartenance se teste dans le plan tangent au barycentre de la zone (lancer de rayon), ce qui reste juste pour des
zones de quelques centaines de km. Une zone « annotation » ne sert qu'à l'affichage.

### 12.6 Vue en profil
Le plan de vol est échantillonné tous les km le long des géodésiques (600 échantillons au plus) ; sous chaque
échantillon, l'altitude du relief est lue dans les tuiles terrarium de `cartes/relief/` au zoom 10 (environ 150 m par
pixel) : altitude = R × 256 + V + B / 256 − 32 768. Le profil trace l'altitude de vol de l'essaim au-dessus du relief.
Sans réseau, il se replie sur l'altitude de vol seule. Le moteur, lui, ne tient pas encore compte du relief.

## 13 · Physique expliquée (jalon 4)
### 13.1 Fiches
Chaque unité et chaque algorithme a sa fiche dans l'explorateur (`catalogue.html`) : niveau de fidélité, équations,
hypothèses, domaine de validité, sources ou références, paramètres (avec, pour une unité, l'ancêtre qui fixe chaque
valeur), lien vers le fichier de code ou de données, et ce qui l'utilise. Les fiches sont tirées des fichiers eux-mêmes
(`meta` des algorithmes, `_aide` et `sources` des unités) : elles ne peuvent pas diverger du code.

### 13.2 Inspecteur « pourquoi »
Un clic sur une entité ouvre son inspection, mise à jour en direct :
- avion : état, position, vitesse, munitions, et la dernière décision de la conduite — piste retenue, score
  effectif / (1 + avions déjà envoyés), délai d'interception, pistes connues et atteignables, trois meilleures
  alternatives écartées. L'algorithme d'allocation rend cette explication avec sa décision, sans la modifier (les
  bilans de référence restent exacts, `tests/portage_j0.test.js`) ;
- drone : état, détection, distance et temps restants, chaque tir subi avec son Pk et son issue, et la probabilité de
  survivre à ces tirs, Π(1 − Pk) ;
- cible : postes, munitions, frappes, et la cadence de tir déduite du § 5.

### 13.3 Preuve des renvois
Le code renvoie au modèle par « MODELE § x » ; `tests/conformite.test.js` vérifie que chaque renvoi du code, des
algorithmes et des analyses désigne une section existante de ce document.

## 14 · Outils de preuve (jalon 5)
### 14.1 Empreinte de reproductibilité
Un résultat n'a de valeur que si on peut le refaire. Chaque résultat des outils de preuve porte une empreinte :
SHA-256 de quatre parties, chacune hachée à part pour dire ce qui a changé entre deux résultats :
- `scenario` : le scénario v2 complet, en JSON canonique (clés triées, blocs `_aide` retirés) ;
- `unites` : les fichiers d'unités chargés, bases et emports compris ;
- `algos` : pour chaque algorithme que le scénario fait tourner, sa fiche `meta` et le code de chacune de ses fonctions ;
- `moteur` : le code de `src/moteur/`.

Le hasard ne dépend que de la graine (§ 8.1, mulberry32) : deux résultats de même empreinte, mêmes graines et mêmes
tirages sont identiques au bit près. Le résultat porte aussi ses écarts au scénario de référence, chemin par chemin.

### 14.2 Convergence en pas de temps
Le moteur avance par pas fixe Δt (0,5 s par défaut : 111 m pour un drone à 800 km/h). Un résultat ne doit pas dépendre
de ce choix. La campagne est rejouée à plusieurs pas, sur les mêmes graines, et chaque pas est comparé au plus fin
tirage par tirage : différence moyenne d̄, écart-type s_d, écart réduit apparié z = |d̄| / (s_d / √n). Un pas est
conforme si, pour chaque grandeur, z ≤ 3 (écart indiscernable du hasard) ou |d̄| ≤ 1 % de la valeur au pas fin
(écart réel mais négligeable : la durée du raid, par exemple, se mesure à un pas près).

### 14.3 Duel A/B à nombres aléatoires communs
Comparer deux variantes d'un scénario (une tactique contre une autre, 30 avions contre 40) sur les mêmes graines :
le tirage i de A et le tirage i de B partent de la même graine. Les différences sont alors appariées : leur variance
est Var(A) + Var(B) − 2 Cov(A, B), plus petite que celle de deux campagnes indépendantes dès que les deux variantes
réagissent dans le même sens au même hasard. Le gain des nombres communs, (Var A + Var B) / Var(B − A), dit combien de
tirages indépendants il faudrait de plus pour la même précision. Verdict : « B > A » ou « B < A » si z > 3,
« indiscernable » sinon. Un seul générateur sert tout le raid : dès que les variantes divergent, leurs tirages se
désynchronisent, et le gain baisse — il est mesuré, jamais supposé.

### 14.4 Criblage de sensibilité de Morris
Quels réglages pèsent vraiment sur une grandeur ? La méthode de Morris (Morris 1991 ; Campolongo, Cariboni et
Saltelli 2007) répond avec r (k + 1) évaluations pour k facteurs. Chaque facteur est ramené à [0, 1] sur sa plage
[min, max], sur une grille de p niveaux (p pair) ; le pas vaut Δ = p / (2(p − 1)). Une trajectoire part d'un point de
la moitié basse de la grille et augmente chaque facteur de Δ à son tour, dans un ordre tiré au hasard. L'effet
élémentaire du facteur i est EEᵢ = (y(x + Δᵢeᵢ) − y(x)) / Δᵢ, Δᵢ étant le pas réellement fait après arrondi d'un
facteur entier : il se lit comme la variation de la grandeur quand le facteur parcourt toute sa plage. Sur r
trajectoires :
- μ* = moyenne des |EEᵢ| : l'influence du facteur, qui sert au classement ;
- μ = moyenne des EEᵢ : le sens de l'effet ;
- σ = écart-type des EEᵢ : grand devant μ*, l'effet dépend des autres facteurs (non-linéarité, interactions).

Chaque point est la moyenne de quelques raids aux mêmes graines. Le bruit de Monte-Carlo d'un effet élémentaire est
estimé par 1,96 √2 σ̄_moyenne / Δ : un μ* en dessous ne se distingue pas du hasard. Morris classe ; une décomposition
de variance (Sobol) chiffrera ensuite la part de chaque facteur.

### 14.5 Dossier de preuve
`node src/preuve.js dossier` écrit un dossier Markdown : empreinte, écarts au scénario de référence, résultats avec
leur IC à 95 %, convergence en pas de temps, unités et algorithmes en jeu (fidélité, sources, hypothèses), limites
connues et commande pour le reproduire.

## 15 · Radars placés et réseau (jalon 6)
### 15.1 Disposition des radars
Deux dispositions, au choix du scénario (`bleu.radar.disposition`) :
- **frontière** (référence, § 2) : des radars jalonnent la frontière ; un drone est vu dès qu'il entre à moins de
  d = min(horizon radar, portée max) de la zone. Pour l'affichage et l'édition, cette couverture est matérialisée par
  n = ⌈2π R / (√3 d)⌉ radars (3 au moins) répartis sur le cercle de la zone : deux voisins sont à √3 d au plus l'un de
  l'autre, si bien que tout drone qui franchit la frontière passe à moins de d de l'un d'eux ;
- **sites** : chaque radar est placé sur la carte (`bleu.radar.sites`). Un drone est vu dès qu'il est dans la portée
  d'au moins un site, en distance oblique entre positions ECEF : ‖P_drone − P_site‖² ≤ d² + (h_drone − h_antenne)².
  Les drones apparaissent au-delà de la couverture la plus lointaine et, au moins, de la frontière.

Dans l'éditeur, déplacer, ajouter ou supprimer un radar fait passer le scénario en disposition « sites » en y
inscrivant la position de tous les radars affichés. La détection reste mémorisée : un drone vu une fois reste pisté.

### 15.2 Réseau d'information
Le réseau dit ce que la conduite sait et qui elle peut joindre (`bleu.reseau`). Ses nœuds : le centre de conduite
(« conduite », au centre du théâtre sauf position donnée), chaque radar (« radar:<i> », R<i+1>) et chaque groupe
d'avions (« avions:<g> »). Une liaison relie deux nœuds par un moyen du catalogue (`unites/liaisons/`) : famille
(filaire, radio, satellite, optique), latence de bout en bout λ, portée P et, pour les moyens à vue directe, une
hauteur d'antenne au sol h. La portée effective entre deux extrémités de hauteurs h₁ et h₂ vaut
P_eff = min(P, √(2 k R_T) (√h₁ + √h₂)), k = 4/3, pour un moyen à vue directe, P sinon.

- **Mode complet** (référence) : tout le monde parle avec tout le monde, sans délai. La conduite apprend chaque
  détection à l'instant même ; chaque avion est joignable. Les bilans sont ceux d'avant le réseau, à l'identique
  (`tests/portage_j0.test.js`).
- **Mode liaisons** : seules les liaisons listées portent l'information, dans les deux sens.
  - Les liaisons entre nœuds au sol sont actives si leurs extrémités sont à moins de P_eff ; la latence d'un radar
    jusqu'à la conduite est celle du plus court chemin par liaisons actives (relais possibles), infinie sans chemin.
  - Un drone vu par le radar i à l'instant t est connu de la conduite à t + λ_i ; un radar non relié voit pour
    rien. Le radar qui voit est désigné par l'algorithme de détection (`detecte_par`) ou, à défaut, est le plus proche.
  - Le délai de réaction de la conduite court à partir de l'instant où elle connaît le drone.
  - Un avion est joignable s'il est à portée d'au moins une liaison entre son groupe et un nœud au sol relié à la
    conduite, à l'altitude de l'avion. Un avion hors liaison n'est plus affecté : il finit sa mission en cours, puis
    reste où il est ; ses propres capteurs d'arme engagent toujours les drones qui passent à sa portée.

Dans l'éditeur, l'outil Liaison relie deux nœuds (radar, centre de conduite, avion pour son groupe) par le moyen
choisi ; depuis le réseau complet, la première liaison matérialise d'abord le réseau par défaut (chaque radar à la
conduite au fil, la conduite à chaque groupe par radio). « Réseau complet » y revient. Le centre de conduite se
déplace comme une unité. Limites de ce premier lot : la latence des ordres vers les avions, le débit, le brouillage
et les liaisons entre drones ne sont pas encore modélisés (docs/PLAN_V2.md, jalon 7).

### 15.3 Interface centrée sur la carte
La carte (ou le scope) occupe tout l'écran. Le reste flotte par-dessus et se replie : barre de tactique et d'édition
en haut, rail de panneaux à gauche (scénario, calques, balayage, profil, aide ; un à la fois, touches 1 à 5), bilan
compact en haut à droite avec ses détails repliés, inspecteur dessous, lecture en bas. Les **calques** affichent ou
masquent chaque famille d'entités (avions IR, avions laser, radars, couverture, bulles sol, drones détectés ou non,
plots, plan de vol, tirs, cibles, zones, anneaux) ; une entité masquée ne se survole, ne s'inspecte ni ne s'édite.
C'est un filtre d'affichage : la simulation n'en dépend pas.

### 15.4 Pannes, centre de conduite visé, vue du PC
- **Latence des consignes** : une décision de la conduite, ou un ordre donné dans l'éditeur, part du centre de
  conduite et n'atteint l'avion qu'après la latence de son accès (§ 15.2) ; un avion injoignable ne la reçoit pas.
  Un ordre en route a priorité sur les décisions suivantes de la conduite.
- **Pannes datées** (`bleu.reseau.pannes`) : à l'instant t, un radar cesse de voir, une liaison cesse de porter
  l'information, ou le centre de conduite cesse de fonctionner (plus rien n'est connu, plus personne n'est affecté) ;
  une durée la rend temporaire, sinon elle est définitive. Le réseau est recalculé à chaque changement. Dans
  l'éditeur, en cours de raid, Suppr met hors service le radar, le PC ou la liaison sélectionnés, à cet instant.
  Après la panne du PC, un drone vu pendant la panne n'est connu qu'à son retour, s'il est encore vu.
- **Centre de conduite visé** (`bleu.reseau.conduite_ciblee`) : il devient une cible de plus de l'essaim, la
  dernière, défendue par des postes sol comme les autres ; à la première frappe, il est détruit pour de bon.
- **Vue du PC** : l'écran ne montre que les drones que la conduite connaît, et les pistes de son algorithme de
  pistage ; la vérité terrain reste à un bouton (V). Les positions affichées sont les positions vraies des drones
  connus : le retard de mise à jour des pistes n'est pas encore représenté.

## 16 · Relief dans le moteur (jalon 2)
### 16.1 Terrain
Un terrain est une unité du catalogue (`unites/terrains/`) : grille régulière en latitude et longitude, au pas de 1
à 2 km, d'altitudes du sol en mètres (entiers 16 bits encodés en base64), avec ses sources. Le scénario le cite par
`theatre.terrain` (null : Terre lisse, comportement d'avant). `node outils/terrain.js` le fabrique depuis les tuiles
terrarium (décodeur PNG sans dépendance, `outils/png.js`), ou en relief synthétique pour les essais
(`terrains/crete_notionnelle` : crête de 1 500 m à 170 km au nord du centre, juste au-delà de la frontière, et massif de 1 200 m au sud-est, qui aveuglent vers l'extérieur les radars voisins). Une fois
fabriqué, le terrain est un fichier : le moteur travaille hors ligne. L'altitude en un point est interpolée entre
les quatre nœuds voisins ; hors de la grille, elle vaut 0.

### 16.2 Masque d'horizon des radars
Pour chaque radar, d'altitude d'antenne z_a = z_sol + h_antenne, le moteur calcule une fois, dans 360 secteurs de
1°, l'angle de site du relief à chaque pas de distance jusqu'à la portée d :
θ(s) = (z_sol(s) − z_a) / s − s / (2 k R_T), k = 4/3, et son maximum courant M(s). Un drone à la distance s, volant à
h_drone au-dessus du sol (suivi de terrain : l'altitude des drones est alors une hauteur sol), est vu si
θ_drone(s) > M(s), c'est-à-dire s'il dépasse tout le relief qui le précède. Avec un terrain, chaque radar voit selon
son masque (en disposition frontière, les radars matérialisés du § 15.1, chacun dans sa portée d) ; un drone est vu
dès qu'un radar en état le voit. La couverture réelle (portée vue dans chaque secteur) remplace les cercles à l'écran.
Le calcul passe par le repère ENU du radar (distance et azimut à mieux que 0,1 % jusqu'à 100 km).

### 16.3 Vue directe des liaisons
Une liaison à vue directe (radio, optique) entre deux antennes d'altitudes z₁ et z₂ distantes de D passe si, en
chaque point à s du premier, z_sol(s) < z₁ + (z₂ − z₁) s / D − s (D − s) / (2 k R_T) (rayon droit, Terre de rayon
effectif). Le test s'applique aux liaisons entre nœuds au sol et à l'accès de chaque avion (altitude de vol au-dessus
de l'ellipsoïde).
