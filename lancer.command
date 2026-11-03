#!/bin/sh
# Lance Egide en local : double-clic dans le Finder (macOS) ou ./lancer.command dans un terminal.
# Les modules ES exigent un service HTTP : un fichier ouvert directement (file://) ne les charge pas.
cd "$(dirname "$0")" || exit 1
(sleep 1 && open "http://127.0.0.1:8766") &
exec python3 -m http.server 8766 --bind 127.0.0.1
