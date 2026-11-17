#!/bin/bash
# Action-Trailer: Sprecher erzeugen, alle Szenen aufnehmen (ohne Grafikkarte etwa zwei Stunden), zusammenbauen.
# bash tools/promo29.sh <Ordner mit dem Kokoro-Sprachmodell>   (siehe tools/promo_vo.py)
cd "$(dirname "$0")/.."
B=build/rift-armada.html
[ -f tools/promo/sfx.wav ] || node tools/promo_sfx.js $B tools/promo/sfx.wav
[ -f tools/promo/menu-h.jpg ] || node tools/promo_menu.js $B
python3 tools/promo_vo.py "$1" || exit 1
node tools/promo29.js $B k1gate,k2flyby,k3debris,k4rift,k5clash,k6mars,k6legion,k6nexus,k7fall &
node tools/promo29.js $B s1base,s2cmd,s3fac,s4jump,s5arty,s6cap,s7waves &
wait
python3 tools/promo29.py
