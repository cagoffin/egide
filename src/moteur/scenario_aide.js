// Phrases d'aide du format de scénario v2. scenarios/reference.json porte les mêmes (vérifié par les tests) :
// un fichier de scénario reste lisible seul, et la migration v1 → v2 produit un document auto-documenté.

export const AIDE = {
  racine: {
    _: "Scenario Egide, format 2 : les unites sont referencees dans le catalogue unites/ (ou prive/unites/). Unites d'affichage indiquees par le suffixe de chaque cle.",
    format: "Version du format de scenario.",
    nom: "Nom affiche du scenario.",
    theatre: "Ou se joue le raid.",
    rouge: "Force attaquante : l'essaim.",
    bleu: "Defense : avions, postes sol, radar, conduite.",
    simulation: "Reglages du calcul.",
  },
  theatre: {
    origine_lat_deg: "Latitude du centre de la zone defendue (WGS84).",
    origine_lon_deg: "Longitude du centre de la zone defendue (WGS84).",
    zone_rayon_km: "Rayon du disque defendu, mesure le long de l'ellipsoide.",
    cibles_nombre: "Nombre de cibles a proteger, tirees au hasard dans 70 % du rayon.",
  },
  rouge: {
    unite: "Identifiant du drone dans le catalogue.",
    nombre: "Taille de l'essaim.",
    tactique: "'direct' (groupes venant chacun d'un cap), 'disperse' (drones isoles, departs etales), 'fourmi' (couloir compact puis eclatement) — MODELE § 8.2.",
    concentration_max: "Nombre maximal de drones portes sur une meme cible ; fixe le nombre de groupes (MODELE § 6.1).",
    etalement_s: "Tactique 'disperse' : duree sur laquelle les departs sont etales.",
    fourmi_eclatement_rayon_km: "Tactique 'fourmi' : distance au centre ou le couloir eclate vers les cibles.",
    fourmi_largeur_couloir_km: "Tactique 'fourmi' : largeur du couloir compact.",
    surcharges: "Valeurs qui remplacent celles de l'unite pour ce scenario (cles et unites du fichier d'unite).",
  },
  bleu: {
    avions: "Groupes d'avions en orbite ; chaque groupe a son type et son effectif.",
    "avions[].unite": "Identifiant de l'avion dans le catalogue.",
    "avions[].nombre": "Nombre d'avions du groupe.",
    "avions[].altitude_m": "Altitude de vol du groupe, en orbite comme en mise a poste.",
    "avions[].surcharges": "Valeurs qui remplacent celles de l'avion pour ce groupe.",
    "avions[].surcharges_emport": "Valeurs qui remplacent celles de son arme pour ce groupe.",
    sol: "Postes sol-air, repartis a parts egales sur les cibles.",
    radar: "Couverture radar : continue le long de la frontiere, a l'horizon du type de radar choisi (MODELE § 2).",
    conduite: "Centre de conduite des avions.",
  },
  sol: {
    unite: "Identifiant du poste dans le catalogue.",
    nombre: "Nombre de postes sol-air.",
    munitions: "Stock total de munitions sol, partage a parts egales entre les postes.",
    surcharges: "Valeurs qui remplacent celles du poste pour ce scenario.",
  },
  radar: {
    unite: "Identifiant du radar dans le catalogue.",
    surcharges: "Valeurs qui remplacent celles du radar pour ce scenario.",
  },
  conduite: {
    delai_reaction_s: "Duree detection -> decision -> ordre de mise a poste.",
    pas_decision_s: "Periode de replanification des mises a poste (MODELE § 8.3).",
    interception_profondeur_km: "Profondeur dans la zone ou l'on veut intercepter ; sert aux abaques (MODELE § 3.2).",
  },
  simulation: {
    pas_s: "Pas de temps ; 0,5 s = 111 m parcourus par un drone a 800 km/h.",
    graine: "Graine du generateur aleatoire : meme graine, meme deroulement.",
  },
};
