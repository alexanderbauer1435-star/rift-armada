#!/bin/bash
# Werbefilme: alle Aufnahmen (dauert ohne Grafikkarte über eine Stunde), dann Zusammenbau. bash tools/promo28.sh
cd "$(dirname "$0")/.."
B=build/rift-armada.html
node tools/promo_sfx.js $B tools/promo/sfx.wav
( node tools/promo28.js $B h rift,battle,gate,factions,capital,siege; FPS=15 node tools/promo28.js $B h base ) &
node tools/promo28.js $B v rift,battle,factions,capital,gate,siege &
wait
python3 tools/promo28.py
