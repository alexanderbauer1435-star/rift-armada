#!/usr/bin/env python3
"""Action-Trailer Fassung 29 »The Gates Went Silent«: setzt die Aufnahmen von tools/promo29.js (tools/promo/a-<szene>/)
zum Film store/promo/rift-armada-action-trailer.mp4 zusammen (1920x1080, 30 Bilder je Sekunde).
Teil 1 Kinoteil im Breitbild mit Sprecher und Untertiteln, Teil 2 Spielansicht mit Bedienleisten, Teil 3 Aufruf.
Sprecher: Wave-Dateien je Satz in tools/promo/vo/ (tools/promo_vo.py), Musik und Geräusche wie in promo28.py.
python3 tools/promo29.py [stills]"""
import os, sys, json, subprocess, wave, importlib.util
import numpy as np
from scipy import signal
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_sp = importlib.util.spec_from_file_location('promo28', os.path.join(ROOT, 'tools', 'promo28.py')); m = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(m)
PR, OUT, FPS, SR = m.PR, m.OUT, m.FPS, m.SR
ENC = [x if x != '17' else '20' for x in m.ENC]   # etwas kleiner als die kurzen Filme: 85 s bewegtes Bild
WORK = os.path.join(PR, 'work', 'action'); VO = os.path.join(PR, 'vo'); W, H = 1920, 1080; BAR = 138   # Breitbild 2,39:1
CYAN, WHITE = m.CYAN, m.WHITE
FCOL = {'alliance': (95, 184, 255), 'mars': (255, 122, 74), 'legion': (242, 193, 78), 'nexus': (201, 160, 255), 'brood': (139, 224, 74)}
# Hintergründe der Karten aus den neuen Aufnahmen
_bd = m.backdrop; _MAP = {'rift': ('k4rift', 100), 'capital': ('k6legion', 40)}
m.backdrop = lambda w, h, tag, name, k, dim=0.38, blur=10: _bd(w, h, 'a', _MAP[name][0], _MAP[name][1], dim, blur)

# ---------- Schnittplan ----------
VOTXT = json.load(open(os.path.join(VO, 'meta.json'))) if os.path.exists(os.path.join(VO, 'meta.json')) else {'dur': {}, 'text': {}}
def vd(k): return VOTXT['dur'].get(k, 2.0)
PLAN = [
    # (Art, Name, Start, Dauer, Optionen)
    ('cine', 'k1gate', 0, 5.0, {'fin': 1.0, 'vo': [('vo1', 0.7)], 'snd': 'gate'}),
    ('cine', 'k2flyby', 0, 4.5, {'vo': [('vo2', 0.5)], 'label': ('THE ALLIANCE', 'alliance'), 'snd': 'flyby'}),
    ('cine', 'k3debris', 0, 5.0, {'mid': 'NO SURVIVORS. NO SIGNAL.', 'snd': 'debris'}),
    ('cine', 'k4rift', 0, 5.0, {'vo': [('vo3', 1.2)], 'label': ('THE BROOD', 'brood'), 'big': 1, 'drive': 1, 'sfx': (['warp', 'acid', 'acid', 'beam', 'sboom'], 2.0)}),
    ('cine', 'k5clash', 0, 5.0, {'sfx': (m.BATTLE + ['acid', 'beam', 'beam'], 4.2)}),
    ('cine', 'k6mars', 0, 2.6, {'vo': [('vo4a', 0.15)], 'label': ('MARTIAN REPUBLIC', 'mars'), 'sfx': (['cannon', 'cannon', 'rail', 'boom'], 3.5)}),
    ('cine', 'k6legion', 0, 2.6, {'vo': [('vo4b', 0.15)], 'label': ('GOLDEN LEGION', 'legion'), 'snd': 'choir'}),
    ('cine', 'k6nexus', 0, 2.8, {'vo': [('vo4c', 0.25)], 'label': ('THE NEXUS', 'nexus'), 'sfx': (['warp'], 1.2)}),
    ('cine', 'k7fall', 0, 6.0, {'vo': [('vo5a', 0.25), ('vo5b', 0.25 + vd('vo5a') + 0.35)], 'sfx': (m.BATTLE + ['beam', 'acid'], 3.6), 'boom': 2.4, 'fout': 0.9, 'white': 1, 'stop': 1}),
    ('card', 'title', 0, 3.2, {'big': 1, 'drive': 1, 'fin': 0.5, 'white': 1}),
    ('hud', 's1base', 0, 5.0, {'cap': ['BUILD YOUR BASE']}),
    ('hud', 's2cmd', 0, 6.0, {'cap': ['COMMAND ENTIRE FLEETS'], 'sfx': (m.BATTLE, 3.0, 2.6)}),
    ('card', 'factions', 0, 2.8, {'fin': 0.2, 'fout': 0.2}),
    ('hud', 's3fac', 0, 3.6, {'cap': ['FIVE WAYS TO FIGHT'], 'sfx': (m.BATTLE + ['lance', 'acid'], 3.4)}),
    ('hud', 's4jump', 0, 4.0, {'cap': ['SEIZE THE JUMP GATES'], 'sfx': (['warp'], 1.0)}),
    ('hud', 's5arty', 0, 2.8, {'cap': ['LONG-RANGE ARTILLERY'], 'sfx': (['cannon', 'boom', 'bboom', 'rail'], 2.6)}),
    ('hud', 's6cap', 0, 2.8, {'cap': ['CAPITAL SHIPS'], 'sfx': (['beam', 'lance', 'acid', 'sboom', 'bigboom'], 2.6)}),
    ('card', 'menu', 0, 3.6, {'fin': 0.2, 'fout': 0.2}),
    ('hud', 's7waves', 0, 3.2, {'cap': ['NO ADS. PLAYS OFFLINE.'], 'sfx': (['acid', 'cannon', 'rail', 'sboom'], 2.6), 'fout': 0.3}),
    ('card', 'end', 0, 9.5, {'big': 1, 'end': 1, 'fout': 1.2, 'vo': [('vo6', 0.9)]}),
]

# ---------- Schrift ----------
def cine_overlay(o, dur):
    """Breitbildbalken, Fraktionsname unten links, Mittelzeile, Untertitel des Sprechers im unteren Balken (als eigene Bilder je Satz)"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, BAR], fill=(0, 0, 0, 255)); d.rectangle([0, H - BAR, W, H], fill=(0, 0, 0, 255))
    if o.get('label'):
        txt, f = o['label']; fn = m.font(m.FB, 54); x = 110; y = H - BAR - 120
        d.rectangle([x, y + 4, x + 8, y + 58], fill=FCOL[f] + (255,)); m.spaced(d, (x + 28, y), txt, fn, WHITE + (255,), 8)
    if o.get('mid'):
        im.alpha_composite(m.band(W, H, H - BAR - 250, H - BAR - 10, 170)); d = ImageDraw.Draw(im)   # dunkles Band, sonst verliert sich die Zeile in hellen Wracks
        fn = m.font(m.FS, 62); m.spaced(d, (W / 2, H - BAR - 160), o['mid'], fn, WHITE + (255,), 14, 'm')
    return im
def sub_image(txt):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); fn = m.font(m.FS, 44)
    m.spaced(d, (W / 2, H - BAR + 40), txt, fn, (225, 232, 240, 255), 2, 'm', False); return im

def card(name):
    if name == 'title': return m.card_title(W, H, False, 'a', 'REAL-TIME SPACE STRATEGY  ·  ANDROID')
    if name == 'factions': return m.card_factions(W, H, False)
    if name == 'menu': return m.card_menu(W, H, False, ['CAMPAIGN  ·  SORTIES  ·  DAILY CHALLENGE'])
    return m.card_end(W, H, False, 'a', 'LINKS IN THE DESCRIPTION')

# ---------- Bild ----------
def run(a): subprocess.run(a, check=True)
def seg(out, kind, name, start, dur, o):
    n = int(round(dur * FPS)); src = os.path.join(PR, 'a-' + name); a = ['ffmpeg', '-loglevel', 'error', '-y']; ins = 0; fc = []
    if kind == 'card':
        p = out + '.card.png'; card(name).convert('RGB').save(p); a += ['-framerate', str(FPS), '-i', p]; fc.append(f"[0:v]format=yuv420p,loop=-1:1,trim=duration={dur},setsar=1[b0]"); ins = 1
    else:
        have = len([f for f in os.listdir(src) if f.endswith('.jpg')]); assert start + n <= have, (name, start, n, have)
        a += ['-framerate', str(FPS), '-start_number', str(start), '-i', os.path.join(src, '%04d.jpg')]; ins = 1
        if kind == 'hud':
            a += ['-framerate', str(FPS), '-start_number', str(start), '-i', os.path.join(src, '%04d.png')]; ins = 2
            fc.append(f"[0:v]scale={W}:{H}:flags=lanczos,unsharp=5:5:0.45,eq=contrast=1.05:saturation=1.1[g];[1:v]scale={W}:{H}:flags=lanczos[h];[g][h]overlay=format=auto,setsar=1[b0]")
        else:
            fc.append(f"[0:v]scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6,eq=contrast=1.1:saturation=1.12:gamma=0.97,vignette=PI/4.6,setsar=1[b0]")
    cur = 'b0'; k = 0
    def over(img, t0, t1, fade=0.3):
        nonlocal cur, ins, k
        p = f"{out}.ov{k}.png"; img.save(p); a.extend(['-i', p]); k += 1
        f = f"[{ins}:v]format=rgba,loop=-1:1,trim=duration={dur}"
        if fade: f += f",fade=t=in:st={t0}:d={fade}:alpha=1,fade=t=out:st={max(t0 + 0.1, t1 - fade)}:d={fade}:alpha=1"
        fc.append(f + f"[o{k}]"); fc.append(f"[{cur}][o{k}]overlay=shortest=1[b{k}]"); cur = f"b{k}"; ins += 1
    if kind == 'cine':
        ov = cine_overlay(o, dur)
        if o.get('label') or o.get('mid'):
            bars = cine_overlay({}, dur); over(bars, 0, dur, 0)
            txt = Image.new('RGBA', (W, H), (0, 0, 0, 0)); txt.alpha_composite(ov); d = ImageDraw.Draw(txt); d.rectangle([0, 0, W, BAR], fill=(0, 0, 0, 0)); d.rectangle([0, H - BAR, W, H], fill=(0, 0, 0, 0))
            over(txt, 0.35 if not o.get('mid') else 0.9, dur - 0.15, 0.3)
        else: over(ov, 0, dur, 0)
        for key, at in o.get('vo', []): over(sub_image(VOTXT['text'].get(key, key)), at, min(dur, at + vd(key) + 0.25), 0.15)
    elif kind == 'hud' and o.get('cap'): over(m.top_overlay(W, H, o['cap']), 0.3, dur - 0.2, 0.3)
    f = f"[{cur}]format=yuv420p"; col = 'white' if o.get('white') else 'black'
    if o.get('fin'): f += f",fade=t=in:st=0:d={o['fin']}:color={col}"
    if o.get('fout'): f += f",fade=t=out:st={dur - o['fout']}:d={o['fout']}:color={col}"
    fc.append(f + "[v]")
    a += ['-filter_complex', ';'.join(fc), '-map', '[v]', '-frames:v', str(n)] + ENC + [out + '.tmp.mp4']; run(a); os.replace(out + '.tmp.mp4', out)

# ---------- Ton ----------
def load_vo(key):
    """Satz laden, auf 48 kHz bringen, etwas Fülle, leichter Hall"""
    w = wave.open(os.path.join(VO, key + '.wav')); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768.0
    x = signal.resample_poly(x, SR, sr); x = m.hp(x, 75); x = x + 0.35 * m.lp(x, 220)
    x = x / max(1e-6, np.abs(x).max()); x = np.tanh(x * 1.6) / np.tanh(1.6)                 # sanft verdichten
    rs = np.random.RandomState(9); n = int(SR * 1.4); ir = rs.randn(n) * np.exp(-np.arange(n) / SR * 4.2); ir = m.lp(ir, 5000); ir[:int(SR * 0.012)] = 0
    wet = signal.fftconvolve(x, ir)[:len(x) + n]; wet /= max(1e-6, np.abs(wet).max()); out = np.zeros(len(x) + n); out[:len(x)] += x; out[:len(wet)] += wet * 0.13
    return out / np.abs(out).max()
def noise_shape(dur, f0, f1, seed, env):
    t = np.arange(int(SR * dur)) / SR; x = m.bp(np.random.RandomState(seed).randn(len(t)), f0, f1); return x / max(1e-6, np.abs(x).max()) * env(t / dur)
def snd_gate(dur):
    """Tor: heller Summton, der bei 78 % der Szene absackt und erlischt"""
    t = np.arange(int(SR * dur)) / SR; k = t / dur; f = np.where(k < 0.4, 196, np.where(k < 0.78, 196 - 30 * (k - 0.4) / 0.38, 166 * np.exp(-(k - 0.78) * 14)))
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3.01 * ph)
    fl = np.where((k > 0.4) & (k < 0.78), 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 9 * t) + np.sin(2 * np.pi * 14.3 * t)), 1.0)
    env = np.where(k < 0.78, 1.0, np.exp(-(k - 0.78) * 10)) * np.minimum(1, t / 0.6); return m.lp(x * fl * env, 1800) * 0.5
def snd_flyby(dur):
    """Vorbeiflug: Triebwerksgrollen, das anschwillt und im Ton absinkt"""
    t = np.arange(int(SR * dur)) / SR; k = t / dur; env = np.exp(-((k - 0.52) / 0.3) ** 2)
    low = m.lp(np.random.RandomState(4).randn(len(t)), 120); low /= np.abs(low).max(); f = 62 - 14 * k; tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    hiss = m.bp(np.random.RandomState(6).randn(len(t)), 900, 3200); hiss /= np.abs(hiss).max(); return (low * 0.9 + tone * 0.35 + hiss * 0.18 * env) * env
def snd_debris(dur):
    """Trümmerfeld: fast still, einzelnes Metallknarren"""
    out = np.zeros(int(SR * dur)); rs = np.random.RandomState(8)
    for at in (0.7, 2.1, 3.6):
        d = 0.9; t = np.arange(int(SR * d)) / SR; f = rs.uniform(170, 260) * (1 + 0.25 * np.sin(2 * np.pi * rs.uniform(2, 4) * t)); x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
        x = m.bp(x, 300, 1400); i = int(at * SR); out[i:i + len(x)] += x[:len(out) - i] * 0.5
    return out
def snd_choir(dur):
    """Legion: kurzer Chorakkord (gestapelte Sinus mit Schwebung)"""
    t = np.arange(int(SR * dur)) / SR; x = sum(np.sin(2 * np.pi * f * (1 + d) * t) for f in (146.8, 220, 293.7, 440) for d in (-0.004, 0, 0.005)); env = np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 0.6)
    return m.lp(x / 12, 2400) * env * (0.8 + 0.2 * np.sin(2 * np.pi * 5.2 * t))
SND = {'gate': snd_gate, 'flyby': snd_flyby, 'debris': snd_debris, 'choir': snd_choir}

def intro_music(buf, t1):
    """bis zum ersten großen Schlag: tiefe Einzeltöne und ein langsamer Herzschlag über der Fläche"""
    for k, at in enumerate(np.arange(1.0, t1 - 1.2, 2.14)):
        d = 2.6; t = np.arange(int(SR * d)) / SR; f = m.MIDI([50, 57, 53, 48, 50, 45][k % 6]); x = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) + 0.15 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * 1.7) * np.minimum(1, t / 0.01)
        m.add(buf, x, at, 0.16, 0.3 if k % 2 else -0.3); m.add(buf, x, at + 0.535, 0.05, -0.3 if k % 2 else 0.3)
    kt = np.arange(int(SR * 0.5)) / SR; thump = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-kt * 25)) / SR) * np.exp(-kt * 8)
    for at in np.arange(9.5, t1 - 0.3, 1.07): m.add(buf, thump, at, 0.32); m.add(buf, thump, at + 0.27, 0.2)

def build():
    os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    t = 0.0; lst = []; marks = []
    for i, (kind, name, start, dur, o) in enumerate(PLAN):
        out = os.path.join(WORK, '%02d.mp4' % i); seg(out, kind, name, start, dur, o); marks.append((t, dur, kind, name, o)); lst.append(out); t += dur; print('%5.1f  %s' % (t - dur, name), flush=True)
    total = t; lf = os.path.join(WORK, 'list.txt'); open(lf, 'w').write(''.join("file '%s'\n" % p for p in lst))
    run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-c', 'copy', os.path.join(WORK, 'video.mp4')])
    audio(marks, total)
    dst = os.path.join(OUT, 'rift-armada-action-trailer.mp4')
    run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(WORK, 'video.mp4'), '-i', os.path.join(WORK, 'audio.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', dst + '.tmp.mp4']); os.replace(dst + '.tmp.mp4', dst)
    print('fertig', '%.1f s' % total, '%.1f MB' % (os.path.getsize(dst) / 1e6))

def audio(marks, total):
    """Musik in zwei Teilen (Kinoteil bis zur Stille vor dem Titel, dann Spielteil), Geräusche je Szene, Sprecher darüber; die Musik weicht dem Sprecher"""
    tT = next(a for a, d, k, nm, o in marks if nm == 'title'); tE = next(a for a, d, k, nm, o in marks if nm == 'end'); tD = next(a for a, d, k, nm, o in marks if o.get('drive'))
    cuts = [a for a, d, k, nm, o in marks if a > tD and not o.get('big')]; n = int((total + 0.5) * SR)
    A = m.music(tT + 0.2, tD, tT - 0.9, [c for c in cuts if c < tT - 0.5], [tD]); intro_music(A, tD); m.add(A, m.riser(2.6), tD - 2.6, 0.45); m.add(A, m.riser(1.6), tT - 2.0, 0.3)
    k = int((tT - 0.75) * SR); e = int((tT - 0.15) * SR); A[:, k:e] *= np.linspace(1, 0, e - k) ** 2; A[:, e:] = 0
    B = m.music(total - tT + 0.5, 0.0, tE - tT, [c - tT for c in cuts if c > tT + 0.5], [0.0, tE - tT]); m.add(B, m.riser(2.4), tE - tT - 2.4, 0.5)
    mus = np.zeros((2, n)); mus[:, :A.shape[1]] += A[:, :n]; i = int(tT * SR); L = min(B.shape[1], n - i); mus[:, i:i + L] += B[:, :L]
    fx = np.zeros((2, n)); bank = m.sfx_bank(); vo = np.zeros((2, n)); duck = np.ones(n)
    for idx, (a, d, kind, nm, o) in enumerate(marks):
        if o.get('sfx'): s = o['sfx']; m.scatter(fx, bank, a + (s[2] if len(s) > 2 else 0), a + d, s[0], s[1], 60 + idx, 0.42 if kind == 'hud' else 0.5)
        if o.get('snd'): m.add(fx, SND[o['snd']](d), a, {'gate': 0.22, 'choir': 0.3}.get(o['snd'], 0.5))
        if o.get('boom'):
            for nm2, g, dl in (('bigboom', 1.0, 0), ('bboom', 0.9, 0.12), ('boom', 0.6, 0.5), ('sboom', 0.5, 0.9)): s = bank[nm2]; i = int((a + o['boom'] + dl) * SR); L = min(s.shape[1], n - i); fx[:, i:i + L] += s[:, :L] * g
            m.add(fx, m.hit(1.5), a + o['boom'], 0.9)
        for key, at in o.get('vo', []):
            p = os.path.join(VO, key + '.wav')
            if not os.path.exists(p): continue
            x = load_vo(key); m.add(vo, x, a + at, 0.95); i0 = int((a + at - 0.2) * SR); i1 = min(n, int((a + at + vd(key) + 0.3) * SR)); r = int(0.18 * SR)
            duck[i0:i1] = np.minimum(duck[i0:i1], 0.42); duck[i0 - r:i0] = np.minimum(duck[i0 - r:i0], np.linspace(1, 0.42, r)); duck[i1:i1 + r] = np.minimum(duck[i1:i1 + r], np.linspace(0.42, 1, len(duck[i1:i1 + r])))
    k = int((tT - 0.7) * SR); e = int((tT - 0.1) * SR); fx[:, k:e] *= np.linspace(1, 0, e - k); fx[:, e:int(tT * SR)] = 0   # Stille vor dem Titel
    buf = mus * duck + fx * (0.55 + 0.45 * duck) + vo * 1.15
    m.write_wav(os.path.join(WORK, 'audio.wav'), buf, total)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'audio':
        t = 0.0; marks = []
        for kind, name, start, dur, o in PLAN: marks.append((t, dur, kind, name, o)); t += dur
        os.makedirs(WORK, exist_ok=True); audio(marks, t); print('Ton', t)
    else: build()
