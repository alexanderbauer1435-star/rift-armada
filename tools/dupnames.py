#!/usr/bin/env python3
"""Fassung 25: Doppelte Namen im Gesamtskript finden. Alle Module landen in einem <script>; eine zweite
»function x« überschreibt die erste still (so traf es shipRole aus sim.js – Formationen stürzten im Browser ab).
python3 tools/dupnames.py → »ALL OK« oder Liste der Doppelten."""
import re, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
order = eval(re.search(r"ORDER = (\[.*?\])", open(os.path.join(ROOT, 'tools', 'build.py')).read()).group(1))
seen = collections.defaultdict(list)
for f in order:
    for i, l in enumerate(open(os.path.join(ROOT, 'src', f), encoding='utf-8')):
        m = re.match(r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', l) or re.match(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', l)
        if m: seen[m.group(1)].append('%s:%d' % (f, i + 1))
dup = {k: v for k, v in seen.items() if len(v) > 1}
for k, v in sorted(dup.items()): print('FAIL doppelt:', k, ', '.join(v))
print('OK   %d Namen geprüft' % len(seen) if not dup else '%d doppelt' % len(dup))
print('ALL OK' if not dup else 'FEHLER'); raise SystemExit(1 if dup else 0)
