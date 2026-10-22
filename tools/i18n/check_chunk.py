#!/usr/bin/env python3
"""Prüft eine Übersetzung: python3 tools/i18n/check_chunk.py <name>  (chunks/<name>.json gegen en/<name>.json)"""
import json, re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]
src = json.load(open(os.path.join(D, 'chunks', name + '.json'), encoding='utf-8'))
en = json.load(open(os.path.join(D, 'en', name + '.json'), encoding='utf-8'))
bad = 0
for s in src:
    if s not in en: print('FEHLT', json.dumps(s, ensure_ascii=False)); bad += 1; continue
    t = en[s]
    if not isinstance(t, str) or not t.strip(): print('LEER', json.dumps(s, ensure_ascii=False)); bad += 1; continue
    ph = lambda x: sorted(re.findall(r'\{\d\}', x))
    if ph(s) != ph(t): print('PLATZHALTER', json.dumps(s, ensure_ascii=False), '->', json.dumps(t, ensure_ascii=False)); bad += 1
    tags = lambda x: sorted(re.findall(r'</?[a-z0-9]+', x))
    if tags(s) != tags(t): print('TAGS', json.dumps(s, ensure_ascii=False)); bad += 1
    if re.search(r'[äöüÄÖÜß»«]', t) and not re.search(r'Neu-Tharsis|Ägis', t): print('DEUTSCH?', json.dumps(t, ensure_ascii=False))
extra = [k for k in en if k not in src]
if extra: print(len(extra), 'zusätzliche Schlüssel (werden ignoriert)')
print(name, len(src), 'Texte,', bad, 'Fehler')
sys.exit(1 if bad else 0)
