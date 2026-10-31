#!/usr/bin/env python3
"""Neue Texte in alle Sprachen eintragen: python3 tools/i18n/addkeys.py datei.json
   datei.json: { "deutscher Text": { "en": "...", "fr": "...", "es": "...", "it": "...", "pt": "...", "pl": "..." }, ... }
   Schreibt in tools/i18n/<lang>/manual.json und erzeugt die Wörterbücher neu (merge.py)."""
import json, os, sys, subprocess
D = os.path.dirname(os.path.abspath(__file__))
add = json.load(open(sys.argv[1], encoding='utf-8'))
for lg in ['en', 'fr', 'es', 'it', 'pt', 'pl']:
    f = os.path.join(D, lg, 'manual.json')
    d = json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}
    for k, tr in add.items():
        if lg in tr: d[k] = tr[lg]
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, os.path.join(D, 'merge.py')], check=True)
