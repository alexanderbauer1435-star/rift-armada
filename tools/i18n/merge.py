#!/usr/bin/env python3
"""Erzeugt src/i18n_en.js aus den Übersetzungen in tools/i18n/en/*.json (manual.json zuletzt, überschreibt)."""
import json, os, glob
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(D))
ORDER = ['page', 'ui', 'data1', 'data2', 'mis1', 'mis2', 'conquest', 'manual']
en = {}
files = [os.path.join(D, 'en', n + '.json') for n in ORDER]
files += [f for f in sorted(glob.glob(os.path.join(D, 'en', '*.json'))) if f not in files]
for f in files:
    if not os.path.exists(f): continue
    part = json.load(open(f, encoding='utf-8'))
    for k, v in part.items():
        if k.startswith('//'): continue
        en[k] = v
lines = ['/* ===== i18n_en.js ===== */', "'use strict';",
         '/* Englisches Wörterbuch: deutscher Text → englischer Text. Erzeugt von tools/i18n/merge.py aus tools/i18n/en/*.json –',
         '   Änderungen dort eintragen und neu erzeugen. */', 'const EN = {']
items = list(en.items())
for i, (k, v) in enumerate(items):
    lines.append('  ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) + (',' if i < len(items) - 1 else ''))
lines.append('};')
open(os.path.join(ROOT, 'src', 'i18n_en.js'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(len(en), 'Einträge')
