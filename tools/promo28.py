#!/usr/bin/env python3
"""Werbefilme Fassung 28: setzt aus den Aufnahmen von tools/promo28.js (tools/promo/<h|v>-<szene>/) drei Filme zusammen:
store/promo/rift-armada-trailer-beta.mp4 (quer 1920x1080), -short.mp4 und -reel.mp4 (hoch 1080x1920).
Schrift und Karten mit PIL, Musik mit numpy erzeugt, Spielgeräusche aus tools/promo/sfx.wav (tools/promo_sfx.js).
python3 tools/promo28.py [trailer|short|reel ...]"""
import os, sys, json, subprocess, wave
import numpy as np
from scipy import signal
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PR = os.path.join(ROOT, 'tools', 'promo'); WORK = os.path.join(PR, 'work'); OUT = os.path.join(ROOT, 'store', 'promo')
FB = os.path.join(ROOT, 'tools', 'fonts', 'bc-latin-700.ttf'); FS = os.path.join(ROOT, 'tools', 'fonts', 'bc-latin-600.ttf')
FPS = 30; SR = 48000; SRCFPS = {'base': 15}   # die Szene mit Bedienleisten braucht echte Bildschirmfotos und ist mit 15 Bildern je Sekunde aufgenommen
ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-video_track_timescale', '15360']
CYAN = (110, 205, 255); WHITE = (255, 255, 255); GOLD = (255, 200, 90)
FAC = [('alliance', 'archipelago', 'THE ALLIANCE', (95, 184, 255)), ('mars', 'olympus', 'MARTIAN REPUBLIC', (255, 122, 74)), ('legion', 'sovereign', 'GOLDEN LEGION', (242, 193, 78)),
       ('nexus', 'facet', 'THE NEXUS', (201, 160, 255)), ('brood', 'leviathan', 'THE BROOD', (139, 224, 74))]

def run(a): subprocess.run(a, check=True)
def font(f, s): return ImageFont.truetype(f, int(s))
def spaced(d, xy, txt, fnt, fill, sp=0, anchor='l', shadow=True):
    """Text mit Sperrung; anchor l/m/r bezogen auf x."""
    ws = [d.textlength(c, font=fnt) for c in txt]; tot = sum(ws) + sp * (len(txt) - 1); x, y = xy
    if anchor == 'm': x -= tot / 2
    elif anchor == 'r': x -= tot
    for c, w in zip(txt, ws):
        if shadow: d.text((x + 3, y + 4), c, font=fnt, fill=(0, 0, 0, 170))
        d.text((x, y), c, font=fnt, fill=fill); x += w + sp
    return tot
def twidth(txt, fnt, sp=0):
    d = ImageDraw.Draw(Image.new('RGBA', (8, 8))); return sum(d.textlength(c, font=fnt) for c in txt) + sp * (len(txt) - 1)
def fit(txt, f, size, sp, maxw):
    while twidth(txt, font(f, size), sp * size) > maxw and size > 20: size -= 2
    return size

def band(W, H, y0, y1, a=150):
    """weiches dunkles Band hinter der Schrift"""
    g = np.zeros((H, W, 4), np.uint8); yy = np.arange(H); m = np.clip(1 - np.abs((yy - (y0 + y1) / 2) / ((y1 - y0) / 2 + 1e-6)), 0, 1) ** 0.8
    g[:, :, 3] = (m * a)[:, None].astype(np.uint8); return Image.fromarray(g, 'RGBA')

def overlay(W, H, lines, vert, badge=True, sub=None, top=False):
    """Bauchbinde: quer unten links, hoch im oberen Drittel mittig"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); u = W / 1080 if vert else H / 1080
    size = (96 if vert else 92) * u; sp = 0.045; maxw = W * (0.86 if vert else 0.8)
    size = min(fit(l, FB, size, sp, maxw) for l in lines); f = font(FB, size); lh = size * 1.08; th = lh * len(lines) + (size * 0.62 if sub else 0)
    if vert:
        y = H * 0.19; im.alpha_composite(band(W, H, int(y - 150 * u), int(y + th + 150 * u), 175)); d = ImageDraw.Draw(im)
        d.rectangle([W / 2 - 60 * u, y - 30 * u, W / 2 + 60 * u, y - 30 * u + 6 * u], fill=CYAN + (255,))
        for i, l in enumerate(lines): spaced(d, (W / 2, y + i * lh), l, f, WHITE + (255,), sp * size, 'm')
        if sub: fs = font(FS, size * 0.42); spaced(d, (W / 2, y + len(lines) * lh + 8 * u), sub, fs, CYAN + (255,), 0.12 * size * 0.42, 'm')
    else:
        y = H * 0.15 if top else H * 0.86 - th; x = W * 0.06; im.alpha_composite(band(W, H, int(y - 170 * u), int(y + th + 190 * u), 190)); d = ImageDraw.Draw(im)
        d.rectangle([x, y - 26 * u, x + 120 * u, y - 26 * u + 6 * u], fill=CYAN + (255,))
        for i, l in enumerate(lines): spaced(d, (x, y + i * lh), l, f, WHITE + (255,), sp * size)
        if sub: fs = font(FS, size * 0.42); spaced(d, (x, y + len(lines) * lh + 8 * u), sub, fs, CYAN + (255,), 0.12 * size * 0.42)
    if badge: stamp(im, W, H, vert)
    return im

def stamp(im, W, H, vert):
    """kleine Marke »CLOSED BETA«: quer oben rechts, hoch oben mittig"""
    d = ImageDraw.Draw(im); u = W / 1080 if vert else H / 1080; fs = font(FB, 34 * u); t = 'RIFT ARMADA  ·  CLOSED BETA'; sp = 5 * u; w = twidth(t, fs, sp)
    x = (W - w) / 2 if vert else W - w - 70 * u; y = (H * 0.105 if vert else 54 * u); p = 18 * u
    d.rounded_rectangle([x - p * 1.4, y - p * 0.7, x + w + p * 1.4, y + 34 * u + p * 0.9], radius=10 * u, fill=(6, 12, 22, 170), outline=CYAN + (230,), width=max(2, int(2 * u)))
    spaced(d, (x, y), t, fs, WHITE + (255,), sp, shadow=False)

def frame(tag, name, k):
    p = os.path.join(PR, tag + '-' + name, '%04d.jpg' % k); return Image.open(p).convert('RGB')
def backdrop(W, H, tag, name, k, dim=0.38, blur=10):
    im = frame(tag, name, k); s = max(W / im.width, H / im.height); im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H)).filter(ImageFilter.GaussianBlur(blur))
    return Image.fromarray((np.asarray(im).astype(np.float32) * dim).astype(np.uint8)).convert('RGBA')
def icon(size):
    ic = Image.open(os.path.join(ROOT, 'store', 'graphics', 'icon-512.png')).convert('RGBA').resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255); ic.putalpha(m); return ic

def card_title(W, H, vert, tag, sub):
    im = backdrop(W, H, tag, 'rift', 150, 0.3, 14); d = ImageDraw.Draw(im); u = W / 1080 if vert else H / 1080
    size = fit('RIFT ARMADA', FB, (230 if vert else 250) * u, 0.09, W * 0.88); f = font(FB, size); y = H * (0.36 if vert else 0.33)
    spaced(d, (W / 2, y), 'RIFT ARMADA', f, WHITE + (255,), 0.09 * size, 'm')
    d.rectangle([W / 2 - 150 * u, y + size * 1.22, W / 2 + 150 * u, y + size * 1.22 + 6 * u], fill=CYAN + (255,))
    fs = font(FS, 54 * u); spaced(d, (W / 2, y + size * 1.22 + 40 * u), sub, fs, CYAN + (255,), 9 * u, 'm'); return im

def card_text(W, H, vert, lines, col=WHITE):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255)); d = ImageDraw.Draw(im); u = W / 1080 if vert else H / 1080
    size = min(fit(l, FS, 78 * u, 0.1, W * 0.86) for l in lines); f = font(FS, size); y = H / 2 - size * 1.2 * len(lines) / 2
    for i, l in enumerate(lines): spaced(d, (W / 2, y + i * size * 1.2), l, f, col + (255,), 0.1 * size, 'm', False)
    return im

def card_factions(W, H, vert):
    im = Image.new('RGBA', (W, H), (4, 7, 13, 255)); d = ImageDraw.Draw(im); u = W / 1080 if vert else H / 1080
    f = font(FB, 120 * u); spaced(d, (W / 2, H * (0.07 if vert else 0.09)), 'FIVE FACTIONS', f, WHITE + (255,), 10 * u, 'm')
    fn = font(FB, 40 * u)
    if vert:
        rh = H * 0.145; y0 = H * 0.2
        for i, (_, ship, nm, col) in enumerate(FAC):
            s = Image.open(os.path.join(ROOT, 'src', 'boot', ship + '.webp')).convert('RGBA'); k = min(W * 0.62 / s.width, rh * 0.82 / s.height); s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
            cy = y0 + i * rh + rh / 2; x = W * 0.06 if i % 2 == 0 else W * 0.94 - s.width; im.alpha_composite(s, (int(x), int(cy - s.height / 2)))
            d = ImageDraw.Draw(im); tx = W * 0.94 if i % 2 == 0 else W * 0.06; spaced(d, (tx, cy - 22 * u), nm, fn, col + (255,), 4 * u, 'r' if i % 2 == 0 else 'l')
    else:
        cw = W / 5
        for i, (_, ship, nm, col) in enumerate(FAC):
            s = Image.open(os.path.join(ROOT, 'src', 'boot', ship + '.webp')).convert('RGBA'); k = min(cw * 0.9 / s.width, H * 0.3 / s.height); s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
            cx = cw * (i + 0.5); im.alpha_composite(s, (int(cx - s.width / 2), int(H * 0.5 - s.height / 2)))
            d = ImageDraw.Draw(im); d.rectangle([cx - 50 * u, H * 0.705, cx + 50 * u, H * 0.705 + 5 * u], fill=col + (255,)); spaced(d, (cx, H * 0.73), nm, fn, col + (255,), 4 * u, 'm')
    return im

def card_end(W, H, vert, tag, where):
    im = backdrop(W, H, tag, 'capital', 60, 0.26, 16); d = ImageDraw.Draw(im); u = W / 1080 if vert else H / 1080
    isz = int((230 if vert else 190) * u); y = H * (0.13 if vert else 0.075); im.alpha_composite(icon(isz), (int(W / 2 - isz / 2), int(y))); d = ImageDraw.Draw(im); y += isz + 34 * u
    f1 = font(FB, 64 * u); spaced(d, (W / 2, y), 'RIFT ARMADA', f1, WHITE + (255,), 10 * u, 'm'); y += 104 * u
    s2 = fit('NOW IN CLOSED BETA', FB, (150 if vert else 150) * u, 0.05, W * 0.9); f2 = font(FB, s2); spaced(d, (W / 2, y), 'NOW IN CLOSED BETA', f2, CYAN + (255,), 0.05 * s2, 'm'); y += s2 * 1.2
    f3 = font(FS, 56 * u); spaced(d, (W / 2, y), 'TESTERS WANTED  ·  ANDROID  ·  FREE', f3, WHITE + (255,), 5 * u, 'm'); y += 120 * u
    steps = ['Join the tester group', 'Opt in on Google Play', 'Install and play']; fn = font(FB, 50 * u); ft = font(FS, 50 * u)
    if vert:
        for i, s in enumerate(steps):
            yy = y + i * 96 * u; w = twidth(s, ft, 2 * u) + 86 * u; x = W / 2 - w / 2
            d.ellipse([x, yy, x + 62 * u, yy + 62 * u], outline=CYAN + (255,), width=max(2, int(3 * u))); spaced(d, (x + 31 * u, yy + 1 * u), str(i + 1), fn, CYAN + (255,), 0, 'm', False); spaced(d, (x + 86 * u, yy + 2 * u), s, ft, WHITE + (255,), 2 * u)
        y += 3 * 96 * u + 30 * u
    else:
        ws = [twidth(s, ft, 2 * u) + 86 * u for s in steps]; gap = 70 * u; x = W / 2 - (sum(ws) + gap * 2) / 2
        for i, s in enumerate(steps):
            d.ellipse([x, y, x + 62 * u, y + 62 * u], outline=CYAN + (255,), width=max(2, int(3 * u))); spaced(d, (x + 31 * u, y + 1 * u), str(i + 1), fn, CYAN + (255,), 0, 'm', False); spaced(d, (x + 86 * u, y + 2 * u), s, ft, WHITE + (255,), 2 * u); x += ws[i] + gap
        y += 120 * u
    f4 = font(FB, 60 * u); w = twidth(where, f4, 6 * u); p = 30 * u
    d.rounded_rectangle([W / 2 - w / 2 - p * 1.5, y - p * 0.5, W / 2 + w / 2 + p * 1.5, y + 60 * u + p * 1.1], radius=16 * u, fill=CYAN + (255,)); spaced(d, (W / 2, y), where, f4, (5, 12, 22, 255), 6 * u, 'm', False)
    return im

def card_menu(W, H, vert, lines):
    """Einsatzseite aus dem Spiel (tools/promo_menu.js): quer als Ausschnitt mit Zeile darunter, hoch die sechs Karten in zwei Spalten"""
    shot = Image.open(os.path.join(PR, 'menu-h.jpg')).convert('RGB'); u = W / 1080 if vert else H / 1080
    bg = shot.resize((W, H) if not vert else (int(H * 16 / 9), H), Image.LANCZOS)
    if vert: bg = bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H))
    im = Image.fromarray((np.asarray(bg.filter(ImageFilter.GaussianBlur(18))).astype(np.float32) * 0.45).astype(np.uint8)).convert('RGBA')
    if vert:
        k = (W - 80) / 710; a = shot.crop((250, 360, 960, 645)); b = shot.crop((960, 360, 1670, 502)); y = int(H * 0.36)
        for c in (a, b): c = c.resize((int(c.width * k), int(c.height * k)), Image.LANCZOS); im.paste(c, (40, y)); y += c.height
        d = shot.crop((250, 752, 1670, 872)); kd = (W - 80) / d.width; d = d.resize((int(d.width * kd), int(d.height * kd)), Image.LANCZOS); im.paste(d, (40, y + 24))
        im.alpha_composite(overlay(W, H, lines, True))
    else:
        c = shot.crop((0, 190, 1920, 890)); im.paste(c, (0, 40)); d = ImageDraw.Draw(im); size = fit(lines[0], FB, 92 * u, 0.045, W * 0.8); f = font(FB, size); y = H * 0.83; x = W * 0.06
        d.rectangle([x, y - 26 * u, x + 120 * u, y - 20 * u], fill=CYAN + (255,)); spaced(d, (x, y), lines[0], f, WHITE + (255,), 0.045 * size); stamp(im, W, H, False)
    return im

# ---------- Bild ----------
def seg_clip(out, W, H, tag, name, start, dur, ov, fin=0.0, fout=0.0):
    n = int(round(dur * FPS)); src = os.path.join(PR, tag + '-' + name); have = len([f for f in os.listdir(src) if f.endswith('.jpg')]); sf = SRCFPS.get(name, FPS)
    assert start + n * sf // FPS <= have, (name, start, n, have)
    vf = f"[0:v]fps={FPS},scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5,eq=contrast=1.07:saturation=1.12,vignette=PI/5"
    if fin: vf += f",fade=t=in:st=0:d={fin}"
    if fout: vf += f",fade=t=out:st={dur - fout}:d={fout}"
    a = ['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(sf), '-start_number', str(start), '-i', os.path.join(src, '%04d.jpg')]
    if ov is not None:
        p = out + '.png'; ov.save(p); a += ['-i', p]
        vf += f"[b];[1:v]format=rgba,loop=-1:1,trim=duration={dur},fade=t=in:st=0.25:d=0.35:alpha=1,fade=t=out:st={dur - 0.45}:d=0.3:alpha=1[o];[b][o]overlay=shortest=1,format=yuv420p[v]"
    else: vf += ",format=yuv420p[v]"
    a += ['-filter_complex', vf, '-map', '[v]', '-frames:v', str(n)] + ENC + [out + '.tmp.mp4']; run(a); os.replace(out + '.tmp.mp4', out)

def seg_card(out, im, dur, fin=0.4, fout=0.4):
    p = out + '.png'; im.convert('RGB').save(p); vf = f"format=yuv420p,loop=-1:1,trim=duration={dur}"
    if fin: vf += f",fade=t=in:st=0:d={fin}"
    if fout: vf += f",fade=t=out:st={dur - fout}:d={fout}"
    run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', p, '-vf', vf, '-frames:v', str(int(round(dur * FPS)))] + ENC + [out + '.tmp.mp4']); os.replace(out + '.tmp.mp4', out)

# ---------- Ton ----------
def lp(x, fc, o=2): b, a = signal.butter(o, fc / (SR / 2)); return signal.lfilter(b, a, x)
def hp(x, fc, o=2): b, a = signal.butter(o, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def bp(x, f0, f1): b, a = signal.butter(2, [f0 / (SR / 2), f1 / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def saw(f, t, det=0.0): return sum(signal.sawtooth(2 * np.pi * f * (1 + d) * t + ph) for d, ph in ((-det, 0.3), (0, 1.1), (det, 2.3))) / 3
def add(buf, x, at, g=1.0, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1] or i < 0: return
    n = min(len(x), buf.shape[1] - i); buf[0, i:i + n] += x[:n] * g * (1 - max(0, pan)); buf[1, i:i + n] += x[:n] * g * (1 + min(0, pan))
def hit(big=1.0):
    t = np.arange(int(SR * 2.2)) / SR; f = 38 + 70 * np.exp(-t * 18); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    nz = lp(np.random.RandomState(3).randn(len(t)), 900) * np.exp(-t * 9) * 0.8; return np.tanh((x + nz) * 1.6 * big)
def braam(f0, dur):
    t = np.arange(int(SR * dur)) / SR; x = saw(f0, t, 0.006) + 0.7 * saw(f0 * 2, t, 0.008) + 0.4 * saw(f0 * 1.5, t, 0.004)
    env = np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - dur * 0.35) * 2.2); return np.tanh(lp(x, 1100) * 2.4) * env
def riser(dur):
    t = np.arange(int(SR * dur)) / SR; nz = np.random.RandomState(5).randn(len(t)); out = np.zeros(len(t)); k = 8; seg = len(t) // k
    for i in range(k): a, b = i * seg, (i + 1) * seg if i < k - 1 else len(t); fc = 300 * (14 ** (i / (k - 1))); out[a:b] = bp(nz, fc * 0.7, min(fc * 1.4, 20000))[a:b]
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (t / dur * 2)) / SR) * 0.25; return (out * 0.8 + tone) * (t / dur) ** 2
MIDI = lambda m: 440 * 2 ** ((m - 69) / 12)
CH = [[38, 45, 50, 53, 57], [34, 46, 50, 53, 58], [41, 48, 53, 57, 60], [36, 48, 52, 55, 60]]   # Dm, B, F, C

def music(dur, drive0, drive1, cuts, big, bpm=112):
    """dur gesamt; Antrieb (Bass, Schlagwerk, Arpeggio) von drive0 bis drive1; cuts: Schnitte mit kleinem Schlag; big: große Schläge"""
    n = int(dur * SR); buf = np.zeros((2, n)); t = np.arange(n) / SR; beat = 60 / bpm; bar = beat * 4
    # Fläche
    pad = np.zeros(n); nb = int(dur / bar) + 1
    for b in range(nb):
        ch = CH[b % 4]; a = int(b * bar * SR); e = min(n, int((b + 1) * bar * SR) + int(0.4 * SR))
        if a >= n: break
        tt = np.arange(e - a) / SR; x = sum(saw(MIDI(m), tt, 0.004) for m in ch[:4]) / 4; env = np.minimum(1, tt / 0.5) * np.minimum(1, (tt[-1] - tt) / 0.4 + 0.001); pad[a:e] += x * env
    pad = lp(pad, 1100) * 0.22; sw = 0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t); buf[0] += pad * (0.8 + 0.2 * sw); buf[1] += pad * (1.0 - 0.2 * sw)
    sub = np.sin(2 * np.pi * MIDI(26) * t) * 0.10 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * t)); buf += sub
    # Antrieb
    rs = np.random.RandomState(11); e8 = beat / 2; k0 = int(np.ceil(drive0 / e8)); k1 = int(drive1 / e8)
    tb = np.arange(int(SR * e8 * 0.95)) / SR; kick_t = np.arange(int(SR * 0.35)) / SR; kick = np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-kick_t * 30)) / SR) * np.exp(-kick_t * 9)
    hat = hp(rs.randn(int(SR * 0.05)), 7000) * np.exp(-np.arange(int(SR * 0.05)) / SR * 90)
    tp = np.arange(int(SR * 0.5)) / SR
    for k in range(k0, k1):
        at = k * e8; b = int(at / bar); ch = CH[b % 4]; ramp = min(1, (at - drive0) / (bar * 2) + 0.35); full = at - drive0 > bar * 2
        x = lp(saw(MIDI(ch[0]), tb, 0.003), 420 + 500 * ramp) * np.exp(-tb * 7) * np.minimum(1, tb / 0.004); add(buf, x, at, 0.34 * ramp * (1.0 if k % 2 == 0 else 0.7))
        if k % 2 == 0 and full: add(buf, kick, at, 0.55)
        if full: add(buf, hat, at + (0 if k % 2 else e8 / 2), 0.05, 0.3)
        if full:
            for j in range(2):
                m = ch[1:][(k * 2 + j) * 3 % 4] + 12; x = lp(signal.square(2 * np.pi * MIDI(m) * tp, 0.3), 2600) * np.exp(-tp * 11) * np.minimum(1, tp / 0.003)
                add(buf, x, at + j * e8 / 2, 0.055, 0.5 if (k + j) % 2 else -0.5); add(buf, x, at + j * e8 / 2 + beat * 0.75, 0.022, -0.5 if (k + j) % 2 else 0.5)
    h = hit()
    for c in cuts: add(buf, h, c, 0.5)
    for c in big: add(buf, hit(1.4), c, 0.95); add(buf, braam(MIDI(26), 3.2), c, 0.5)
    return buf

def sfx_bank():
    w = wave.open(os.path.join(PR, 'sfx.wav')); d = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).T / 32768.0; names = json.load(open(os.path.join(PR, 'sfx.wav.json')))
    bank = {nm: d[:, int(i * 3 * SR):int((i * 3 + 2.9) * SR)] for i, nm in enumerate(names)}
    return {nm: x / max(1e-6, np.abs(x).max()) * 0.7 for nm, x in bank.items()}   # alle gleich laut, die Mischung regelt scatter
def scatter(buf, bank, t0, t1, kinds, rate, seed, g=0.5):
    rs = np.random.RandomState(seed); t = t0 + 0.2
    while t < t1 - 0.3:
        nm = kinds[rs.randint(len(kinds))]; s = bank[nm]; i = int(t * SR); n = min(s.shape[1], buf.shape[1] - i, int((t1 - t + 0.8) * SR)); pan = rs.uniform(-0.5, 0.5); gg = g * rs.uniform(0.5, 1.0)
        fade = np.ones(n); k = min(n, int(0.5 * SR)); fade[-k:] = np.linspace(1, 0, k)
        buf[0, i:i + n] += s[0, :n] * gg * (1 - max(0, pan)) * fade; buf[1, i:i + n] += s[1, :n] * gg * (1 + min(0, pan)) * fade; t += rs.exponential(1 / rate)

def write_wav(path, buf, dur):
    n = int(dur * SR); buf = buf[:, :n].copy(); k = int(0.05 * SR); buf[:, :k] *= np.linspace(0, 1, k); k = int(1.6 * SR); buf[:, -k:] *= np.linspace(1, 0, k) ** 1.5
    buf = np.tanh(buf * 1.25); buf /= max(1e-9, np.abs(buf).max()) / 0.89
    w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf.T * 32767).astype(np.int16).tobytes()); w.close()

# ---------- Schnittpläne ----------
BATTLE = ['beam', 'cannon', 'rail', 'auto', 'torp', 'sboom', 'boom', 'shdown']
def plan(kind):
    if kind == 'trailer':
        W, H, v, tg = 1920, 1080, False, 'h'
        return W, H, v, [
            ('card', card_text(W, H, v, ['THE GATES WENT SILENT.', 'THEN SOMETHING CAME THROUGH.']), 3.4, {}),
            ('clip', 'rift', 0, 6.0, ['THE RIFT IS OPEN.'], {'sfx': (['warp', 'acid', 'cannon', 'rail', 'sboom'], 1.6), 'fin': 0.5, 'big': 1, 'pos': 'top'}),
            ('card', card_title(W, H, v, tg, 'REAL-TIME SPACE STRATEGY  ·  ANDROID'), 3.2, {'big': 1, 'drive': 1}),
            ('clip', 'battle', 0, 8.0, ['COMMAND ENTIRE FLEETS'], {'sfx': (BATTLE, 3.2)}),
            ('card', card_factions(W, H, v), 4.4, {}),
            ('clip', 'factions', 0, 7.0, ['EVERY FACTION', 'FIGHTS ITS OWN WAR'], {'sfx': (BATTLE + ['lance', 'acid'], 3.2)}),
            ('clip', 'gate', 0, 6.0, ['SEIZE THE JUMP GATES.', 'STRIKE FROM ANYWHERE.'], {'sfx': (['warp'], 0.9)}),
            ('clip', 'base', 0, 5.0, None, {'top': ['BUILD. EXPAND. UPGRADE.']}),
            ('card', card_menu(W, H, v, ['CAMPAIGN  ·  SORTIES  ·  DAILY CHALLENGE']), 4.4, {'fin': 0.25, 'fout': 0.25}),
            ('clip', 'capital', 0, 5.6, ['NO ADS. NO PAY-TO-WIN.', 'PLAYS OFFLINE.'], {'sfx': (['beam', 'lance', 'acid', 'sboom', 'bigboom'], 2.4), 'fout': 0.35}),
            ('card', card_end(W, H, v, tg, 'LINKS IN THE DESCRIPTION'), 9.0, {'big': 1, 'end': 1, 'fout': 1.2}),
        ]
    W, H, v, tg = 1080, 1920, True, 'v'
    if kind == 'short':
        return W, H, v, [
            ('clip', 'rift', 48, 4.4, ['THE RIFT', 'IS OPEN.'], {'sfx': (['warp', 'acid', 'cannon', 'sboom'], 1.8), 'big': 1, 'drive': 1}),
            ('clip', 'battle', 30, 5.0, ['COMMAND', 'ENTIRE FLEETS'], {'sfx': (BATTLE, 3.4)}),
            ('card', card_factions(W, H, v), 3.2, {'fin': 0.2, 'fout': 0.2}),
            ('clip', 'factions', 40, 4.2, ['5 FACTIONS.', 'ONE GALAXY.'], {'sfx': (BATTLE + ['lance', 'acid'], 3.4)}),
            ('clip', 'capital', 12, 4.2, ['A FULL SPACE RTS', 'ON YOUR PHONE'], {'sfx': (['beam', 'lance', 'acid', 'sboom', 'bigboom'], 2.6)}),
            ('clip', 'gate', 60, 3.2, ['NO ADS.', 'PLAYS OFFLINE.'], {'sfx': (['warp'], 0.9), 'fout': 0.25}),
            ('card', card_end(W, H, v, tg, 'LINK IN DESCRIPTION'), 6.5, {'big': 1, 'end': 1, 'fout': 0.8}),
        ]
    return W, H, v, [
        ('clip', 'capital', 8, 4.2, ['A FULL', 'SPACE RTS.'], {'sfx': (['beam', 'lance', 'acid', 'sboom', 'bigboom'], 2.6), 'big': 1, 'drive': 1}),
        ('clip', 'battle', 110, 4.2, ['IN YOUR', 'POCKET.'], {'sfx': (BATTLE, 3.4)}),
        ('clip', 'factions', 70, 3.8, ['5 FACTIONS.', 'NO ADS.'], {'sfx': (BATTLE + ['lance', 'acid'], 3.4)}),
        ('card', card_menu(W, H, v, ['CAMPAIGN. SORTIES.', 'DAILY CHALLENGE.']), 3.4, {'fin': 0.2, 'fout': 0.25}),
        ('card', card_end(W, H, v, tg, 'LINK IN BIO'), 6.4, {'big': 1, 'end': 1, 'fout': 0.8}),
    ]

def top_overlay(W, H, lines):
    """Zeile oben links (für die Szene mit Bedienleisten, die unten liegen)"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); u = H / 1080; size = 84 * u; f = font(FB, size); y = H * 0.095; x = W * 0.06
    im.alpha_composite(band(W, H, int(y - 110 * u), int(y + size * 1.1 * len(lines) + 110 * u), 200)); d = ImageDraw.Draw(im); d.rectangle([x, y - 26 * u, x + 120 * u, y - 20 * u], fill=CYAN + (255,))
    for i, l in enumerate(lines): spaced(d, (x, y + i * size * 1.08), l, f, WHITE + (255,), 0.045 * size)
    return im

def build(kind, name):
    W, H, v, segs = plan(kind); wd = os.path.join(WORK, kind); os.makedirs(wd, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    t = 0.0; lst = []; cuts = []; big = []; drive0 = None; drive1 = None; sfx = []
    for i, s in enumerate(segs):
        out = os.path.join(wd, '%02d.mp4' % i); o = s[-1]; dur = s[2] if s[0] == 'card' else s[3]
        if s[0] == 'card': seg_card(out, s[1], dur, o.get('fin', 0.4), o.get('fout', 0.4))
        else:
            ov = top_overlay(W, H, o['top']) if o.get('top') else overlay(W, H, s[4], v, top=o.get('pos') == 'top') if s[4] else None
            seg_clip(out, W, H, 'v' if v else 'h', s[1], s[2], dur, ov, o.get('fin', 0), o.get('fout', 0))
            if o.get('sfx'): sfx.append((t, t + dur, o['sfx'][0], o['sfx'][1], i))
        if o.get('big'): big.append(t)
        elif i: cuts.append(t)
        if o.get('drive') and drive0 is None: drive0 = t
        if o.get('end'): drive1 = t
        lst.append(out); t += dur
    total = t; lf = os.path.join(wd, 'list.txt'); open(lf, 'w').write(''.join("file '%s'\n" % p for p in lst))
    run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-c', 'copy', os.path.join(wd, 'video.mp4')])
    buf = music(total + 0.5, drive0 if drive0 is not None else 0, drive1 if drive1 is not None else total, cuts, big)
    if drive1: add(buf, riser(2.4), drive1 - 2.4, 0.5)
    bank = sfx_bank(); fx = np.zeros_like(buf)
    for a, b, kinds, rate, sd in sfx: scatter(fx, bank, a, b, kinds, rate, 40 + sd, 0.42)
    buf += fx; wav = os.path.join(wd, 'audio.wav'); write_wav(wav, buf, total)
    dst = os.path.join(OUT, name); run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(wd, 'video.mp4'), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', dst + '.tmp.mp4']); os.replace(dst + '.tmp.mp4', dst)
    print(name, '%.1f s' % total, '%.1f MB' % (os.path.getsize(dst) / 1e6))

NAMES = {'trailer': 'rift-armada-trailer-beta.mp4', 'short': 'rift-armada-short-beta.mp4', 'reel': 'rift-armada-reel-beta.mp4'}
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'cards':
        os.makedirs(WORK, exist_ok=True)
        for k in ('trailer', 'short'):
            W, H, v, segs = plan(k)
            for i, s in enumerate(segs):
                if s[0] == 'card': s[1].convert('RGB').save(os.path.join(WORK, 'card-%s-%02d.jpg' % (k, i)), quality=88)
        sys.exit(0)
    for k in (sys.argv[1:] or ['trailer', 'short', 'reel']): build(k, NAMES[k])
