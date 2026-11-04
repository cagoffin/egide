// Décodeur PNG minimal (8 bits, RVB ou RVBA, non entrelacé) pour lire les tuiles de relief terrarium sous Node,
// sans dépendance : zlib de Node et les cinq filtres de ligne de la norme PNG (RFC 2083 § 6).
import {inflateSync} from "node:zlib";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a, b, c) {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Rendre {largeur, hauteur, canaux, pixels} d'un PNG 8 bits RVB(A) non entrelacé. Lève une erreur sinon. */
export function decoder_png(octets) {
  if (!SIGNATURE.every((o, i) => octets[i] === o)) throw new Error("pas un PNG");
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let [position, largeur, hauteur, canaux] = [8, 0, 0, 0];
  const donnees = [];
  while (position < octets.length) {
    const longueur = vue.getUint32(position);
    const type = String.fromCharCode(...octets.subarray(position + 4, position + 8));
    const corps = octets.subarray(position + 8, position + 8 + longueur);
    if (type === "IHDR") {
      [largeur, hauteur] = [vue.getUint32(position + 8), vue.getUint32(position + 12)];
      const [profondeur, couleur, entrelace] = [corps[8], corps[9], corps[12]];
      if (profondeur !== 8 || ![2, 6].includes(couleur) || entrelace) throw new Error("PNG non pris en charge (8 bits RVB ou RVBA, non entrelacé)");
      canaux = couleur === 2 ? 3 : 4;
    } else if (type === "IDAT") donnees.push(corps);
    else if (type === "IEND") break;
    position += 12 + longueur;
  }
  const brut = inflateSync(Buffer.concat(donnees));
  const ligne = largeur * canaux;
  const pixels = new Uint8Array(ligne * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (ligne + 1)];
    for (let x = 0; x < ligne; x++) {
      const valeur = brut[y * (ligne + 1) + 1 + x];
      const a = x >= canaux ? pixels[y * ligne + x - canaux] : 0;
      const b = y > 0 ? pixels[(y - 1) * ligne + x] : 0;
      const c = x >= canaux && y > 0 ? pixels[(y - 1) * ligne + x - canaux] : 0;
      const predit = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filtre];
      if (predit === undefined) throw new Error(`filtre PNG inconnu ${filtre}`);
      pixels[y * ligne + x] = (valeur + predit) & 255;
    }
  }
  return {largeur, hauteur, canaux, pixels};
}
