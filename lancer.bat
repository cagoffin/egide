@echo off
rem Lance Egide en local (Windows) : double-clic.
cd /d "%~dp0"
start "" http://127.0.0.1:8766
python -m http.server 8766 --bind 127.0.0.1
