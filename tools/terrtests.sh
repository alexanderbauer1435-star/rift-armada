#!/bin/bash
# Fassung 22 – Kartenleben: die Node-Prüfungen, die Karten und Simulation berühren, nacheinander (Ausgabe je Test in $1, Standard tools/shots)
cd "$(dirname "$0")/.."
OUT="${1:-tools/shots}"; mkdir -p "$OUT"
for t in maps22 maps editor determinism mechanics replay i18n; do
  timeout 2400 node "tests/$t.js" > "$OUT/test-$t.txt" 2>&1
  echo "$t: exit $? · $(tail -n 1 "$OUT/test-$t.txt")"
done
