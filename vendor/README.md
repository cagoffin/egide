# Bibliothèques embarquées

Copiées telles quelles depuis leur paquet npm, pour que l'outil fonctionne sans CDN et sans étape de compilation.

| Bibliothèque | Version | Licence | Fichiers |
|---|---|---|---|
| MapLibre GL JS | 6.14.0 | BSD-3-Clause (`maplibre-gl/LICENSE.txt`) | `maplibre-gl.mjs`, `maplibre-gl-worker.mjs`, `maplibre-gl.css` |

Mise à jour : `npm pack maplibre-gl@<version>`, puis recopier les mêmes fichiers depuis `package/dist/`.
