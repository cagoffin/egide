// Pays d'inspiration des unités du catalogue (clé « pays », code ISO 3166 à trois lettres) : nom affiché et couleur
// de pastille des icônes de jeu. Une couleur de classement, pas un emblème : ni drapeau, ni cocarde ; jamais le rouge,
// réservé à la menace détectée.
export const PAYS = {
  AUS: {nom: "Australie", couleur: "#2f8fb5"},
  BLR: {nom: "Biélorussie", couleur: "#6b8f3f"},
  BRA: {nom: "Brésil", couleur: "#2e9e5b"},
  CHE: {nom: "Suisse", couleur: "#7a5a9e"},
  CHN: {nom: "Chine", couleur: "#b58a2c"},
  DEU: {nom: "Allemagne", couleur: "#6b6b6b"},
  FRA: {nom: "France", couleur: "#2f5fb3"},
  GBR: {nom: "Royaume-Uni", couleur: "#3a4f8f"},
  IND: {nom: "Inde", couleur: "#3f9e8f"},
  IRN: {nom: "Iran", couleur: "#3f8f5a"},
  ISR: {nom: "Israël", couleur: "#4b8fd6"},
  ITA: {nom: "Italie", couleur: "#2f8a4d"},
  KOR: {nom: "Corée du Sud", couleur: "#5a6fb8"},
  NLD: {nom: "Pays-Bas", couleur: "#5a7a9e"},
  PRK: {nom: "Corée du Nord", couleur: "#8f3f6b"},
  RUS: {nom: "Russie", couleur: "#7c5aa6"},
  SWE: {nom: "Suède", couleur: "#2d6fa8"},
  TUR: {nom: "Turquie", couleur: "#2f8f8f"},
  UKR: {nom: "Ukraine", couleur: "#c9a227"},
  USA: {nom: "États-Unis", couleur: "#41588f"},
};

/** Rendre la couleur de pastille d'un pays, ou `defaut` pour une unité générique. */
export const couleur_pays = (pays, defaut) => PAYS[pays]?.couleur ?? defaut;
