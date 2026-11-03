#!/bin/bash
# Alle Prüfungen einer Fassung: node-Tests und Browser-Tests. bash tools/regress.sh 11
V=${1:-11}; F=build/Rift-Armada-$(printf %02d $V).html
cd "$(dirname "$0")/.."
fail=0
run() { echo "== $*"; if ! "$@" > /tmp/ra-regress.log 2>&1; then echo "FEHLER: $*"; tail -15 /tmp/ra-regress.log; fail=1; else grep -E "^(OK|FAIL|ALL OK|FAILS)" /tmp/ra-regress.log | tail -4; fi; }
for t in determinism maps editor explore fort mechanics artillery replay round2 round3 waves tutorial ships22a ships22b ships22c buildings22a buildings22b maps22 play22 crip23; do run node tests/$t.js; done
run node tests/campaign.js all 900
run node tests/conquest.js 600
for s in artshot shot shot2 shot3 shot4 shot5 shot6 shot7 shot8 interact mp edshot edmp play22 crip23shot dmg24shot ultra24shot; do run node tools/$s.js $F; done
run node tests/i18n.js
run node tools/i18n/scan.js $F
exit $fail
