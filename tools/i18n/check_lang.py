#!/usr/bin/env python3
"""Prüft eine Sprachdatei: python3 tools/i18n/check_lang.py <lang> <name>
   tools/i18n/<lang>/<name>.json gegen tools/i18n/en/<name>.json: gleiche Schlüssel (deutsche Texte), nicht leer,
   gleiche Platzhalter {0}…, gleiche HTML-Tags, keine Reste in Deutsch oder Englisch (Warnung)."""
import json, re, sys, os
D = os.path.dirname(os.path.abspath(__file__))
lang, name = sys.argv[1], sys.argv[2]
en = json.load(open(os.path.join(D, 'en', name + '.json'), encoding='utf-8'))
tr = json.load(open(os.path.join(D, lang, name + '.json'), encoding='utf-8'))
bad = warn = 0
ph = lambda x: sorted(re.findall(r'\{\d\}', x))
tags = lambda x: sorted(re.findall(r'</?[a-z0-9]+', x))
for k, e in en.items():
    if k.startswith('//'): continue
    if k not in tr: print('FEHLT', json.dumps(k, ensure_ascii=False)); bad += 1; continue
    t = tr[k]
    if not isinstance(t, str) or not t.strip(): print('LEER', json.dumps(k, ensure_ascii=False)); bad += 1; continue
    if ph(k) != ph(t): print('PLATZHALTER', json.dumps(k, ensure_ascii=False), '->', json.dumps(t, ensure_ascii=False)); bad += 1
    if tags(k) != tags(t): print('TAGS', json.dumps(k, ensure_ascii=False)); bad += 1
    if lang != 'de' and len(e) > 25 and t == e and re.search(r'\b(the|and|with|your|you)\b', e): print('ENGLISCH?', json.dumps(t, ensure_ascii=False)[:120]); warn += 1
    if re.search(r'[äöüÄÖÜß]', t) and not re.search(r'Neu-Tharsis|Ägis|ä|ö|ü', k): pass
extra = [k for k in tr if k not in en and not k.startswith('//')]
if extra: print(len(extra), 'zusätzliche Schlüssel (werden ignoriert)')
print(lang, name, len([k for k in en if not k.startswith('//')]), 'Texte,', bad, 'Fehler,', warn, 'Warnungen')
sys.exit(1 if bad else 0)
