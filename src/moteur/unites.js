// Conversions entre unités d'affichage (km, km/h) et unités SI du moteur. Jumeau de analyse/unites.py.

export const kmh_vers_ms = (vitesseKmh) => (vitesseKmh * 1000) / 3600;
export const ms_vers_kmh = (vitesseMs) => (vitesseMs * 3600) / 1000;
export const km_vers_m = (distanceKm) => distanceKm * 1000;
export const m_vers_km = (distanceM) => distanceM / 1000;
