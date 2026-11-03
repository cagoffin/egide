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
Un drone détecté à d_det de la frontière et intercepté à la profondeur p dans la zone laisse :

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
Pendant un passage, un avion dispose d'une fenêtre T_f ≈ 2 r_arme / v_rel (géométrie de croisement).
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
La simulation (étape 2) remplace cette approximation et doit la retrouver quand l'essaim est
uniformément réparti.

## 7 · Limites connues
- Pas de contre-mesures, pas de leurres, pas de manœuvre d'évitement des drones.
- Radar parfait dans sa couverture (pas de fausse alarme ni de perte de piste).
- Pas de rechargement des avions pendant le raid.
