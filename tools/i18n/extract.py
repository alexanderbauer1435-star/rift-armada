#!/usr/bin/env python3
"""Sammelt alle (vermutlich) deutschen Anzeigetexte: Zeichenketten der Module (ohne Kommentare) und Texte der Seite.
python3 tools/i18n/extract.py            -> Anzahl je Datei
python3 tools/i18n/extract.py --groups   -> tools/i18n/src/<gruppe>.json (Listen für die Übersetzung)
python3 tools/i18n/extract.py --missing  -> Texte ohne Eintrag in src/i18n_en.js"""
import re, glob, json, os, sys, html
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP = {'core.js', 'fx.js', 'audio.js', 'music.js', 'qr.js', 'ships.js', 'portrait.js', 'i18n.js', 'i18n_en.js', 'render3d.js'}

def js_strings(src):
    """Zeichenketten eines Moduls ohne Kommentare (einfacher Zerleger: Kommentare, '…', "…", `…`)."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"`':
            j, buf = i + 1, []
            while j < n and src[j] != c:
                if src[j] == '\\' and j + 1 < n:
                    nx = src[j + 1]; buf.append('\n' if nx == 'n' else nx); j += 2; continue
                if c != '`' and src[j] == '\n': break
                buf.append(src[j]); j += 1
            out.append(''.join(buf)); i = j + 1; continue
        if c == '/' :
            # Regulärer Ausdruck nach ( , = : [ ! & | ? { } ; oder return
            k = i - 1
            while k >= 0 and src[k] in ' \t': k -= 1
            if k < 0 or src[k] in '(,=:[!&|?{};' or src[max(0, k - 5):k + 1] == 'return':
                j = i + 1; cls = False
                while j < n and src[j] != '\n':
                    if src[j] == '\\': j += 2; continue
                    if src[j] == '[': cls = True
                    elif src[j] == ']': cls = False
                    elif src[j] == '/' and not cls: break
                    j += 1
                i = j + 1; continue
        i += 1
    return out

WORDY = re.compile(r"[A-Za-zÄÖÜäöüß]{2,}")
CODEISH = re.compile(r"rgba?\(|hsla?\(|\d+px|^[#.][\w-]|=>|^\s*\[|^\s*\{(?!\d\})|^\s*\((?![A-ZÄÖÜ])|^[a-z][\w]*$|^[a-z][\w-]*(\s[a-z][\w-]*)*$|^data-|^[\w-]+:[\w#-]|;\s*$|^(?:[a-z-]+:\s*[^;]+;\s*)+$|^\w+\.\w+|^https?:|^[A-Z_]+$|^[A-Z][a-z]+[A-Z]\w*$|\{\s*$|^0x|^[a-z]+\(")
TAG = re.compile(r"<[^>]*>")

def wanted(s):
    t = s.strip()
    if len(t) < 2 or not WORDY.search(t): return False
    if CODEISH.search(t): return False
    plain = TAG.sub(' ', t).strip()
    if not WORDY.search(plain): return False
    if re.search(r"[äöüÄÖÜß»«–…]", plain): return True
    if ' ' in plain.strip(): return True
    return bool(re.match(r"^[A-ZÄÖÜ][\wäöüß-]*[.:!?]?$", plain))

def scan_js():
    res = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'src', '*.js'))):
        name = os.path.basename(f)
        if name in SKIP: continue
        for s in js_strings(open(f, encoding='utf-8').read()):
            if wanted(s): res.setdefault(s, name)
    return res

def page_texts():
    s = open(os.path.join(ROOT, 'src', 'shell.html'), encoding='utf-8').read()
    body = s[s.find('<body'):]
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    body = re.sub(r'<style.*?</style>', '', body, flags=re.S)
    out = {}
    for m in re.finditer(r'>([^<>]+)<', body):
        t = html.unescape(m.group(1)).strip()
        if t and WORDY.search(t): out.setdefault(t, 'shell.html')
    for m in re.finditer(r'\b(?:placeholder|aria-label|title|data-al|data-tip)="([^"]+)"', body):
        t = html.unescape(m.group(1)).strip()
        if t and WORDY.search(t): out.setdefault(t, 'shell.html')
    head = s[:s.find('<body')]
    m = re.search(r'<title>([^<]+)</title>', head)
    return out

GROUPS = {'data': ['data.js'], 'missions': ['missions.js', 'mission.js'], 'conquest': ['conquest.js', 'cqui.js'],
          'ui': ['ui.js', 'campaign.js', 'net.js', 'sim.js', 'waves.js', 'render.js', 'map.js', 'main.js', 'ai.js', 'app.js', 'save.js', 'combat.js'],
          'page': ['shell.html']}

def all_texts():
    d = scan_js()
    for k, v in page_texts().items(): d.setdefault(k, v)
    return d

def en_keys():
    p = os.path.join(ROOT, 'src', 'i18n_en.js')
    if not os.path.exists(p): return set()
    import subprocess
    out = subprocess.run(['node', '-e', "const fs=require('fs');const vm=require('vm');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.EN=EN;',c);process.stdout.write(JSON.stringify(Object.keys(c.EN)))", p], capture_output=True, text=True)
    return set(json.loads(out.stdout))

if __name__ == '__main__':
    d = all_texts()
    if '--groups' in sys.argv:
        os.makedirs(os.path.join(ROOT, 'tools', 'i18n', 'src'), exist_ok=True)
        for g, files in GROUPS.items():
            items = [k for k, v in d.items() if v in files]
            json.dump(items, open(os.path.join(ROOT, 'tools', 'i18n', 'src', g + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
            print(g, len(items), sum(len(x) for x in items))
    elif '--missing' in sys.argv:
        keys = en_keys()
        miss = [(v, k) for k, v in d.items() if k not in keys]
        for v, k in miss: print(v.ljust(14), json.dumps(k, ensure_ascii=False))
        print(len(d), 'Texte,', len(miss), 'ohne Eintrag')
    else:
        from collections import Counter
        print(Counter(d.values())); print(len(d), sum(len(k) for k in d))
