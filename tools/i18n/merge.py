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

# Weitere Sprachen (Fassung 22): tools/i18n/<lang>/*.json → src/i18n_more.js (const LANGS = { fr: {...}, ... })
MORE = ['fr', 'es', 'it', 'pt', 'pl']
out = ['/* ===== i18n_more.js ===== */', "'use strict';",
       '/* Weitere Sprachen: deutscher Text → Übersetzung. Erzeugt von tools/i18n/merge.py aus tools/i18n/<lang>/*.json.',
       '   Fehlende Einträge fallen auf Englisch zurück. */', 'const LANGS = {']
done = []
for lg in MORE:
    d = {}
    lf = [os.path.join(D, lg, n + '.json') for n in ORDER]
    lf += [f for f in sorted(glob.glob(os.path.join(D, lg, '*.json'))) if f not in lf]
    for f in lf:
        if not os.path.exists(f): continue
        for k, v in json.load(open(f, encoding='utf-8')).items():
            if k.startswith('//') or k not in en or not isinstance(v, str) or not v.strip(): continue
            d[k] = v
    if not d: continue
    done.append(lg + ' ' + str(len(d)))
    out.append('  ' + lg + ': {')
    items = list(d.items())
    for i, (k, v) in enumerate(items):
        out.append('    ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) + (',' if i < len(items) - 1 else ''))
    out.append('  },')
out.append('};')
open(os.path.join(ROOT, 'src', 'i18n_more.js'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('weitere Sprachen:', ', '.join(done) or 'keine')
