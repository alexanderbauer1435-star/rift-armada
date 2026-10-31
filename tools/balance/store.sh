#!/bin/bash
# Messreihe für die Store-Fassung: 1v1 (größer), Alle gegen alle zu viert, Schwierigkeitsstufen. Zwei Prozesse gleichzeitig.
cd "$(dirname "$0")/../.."
B=tools/balance
node $B/matrix.js s1v1 expanse,bastions 2 > $B/s1v1.log 2>&1 &
MODE=ffa4 node $B/matrix.js sffa expanse,arena 1 > $B/sffa.log 2>&1 &
wait
MODE=lvl LV=1,3 node $B/matrix.js slvl13 expanse 1 > $B/slvl13.log 2>&1 &
MODE=lvl LV=1,2 node $B/matrix.js slvl12 bastions 1 > $B/slvl12.log 2>&1 &
wait
for f in s1v1 sffa slvl13 slvl12; do echo "== $f"; tail -1 $B/$f.log | python3 -c "import json,sys;d=json.loads(sys.stdin.read());d.pop('pair',None);print(d)"; done
