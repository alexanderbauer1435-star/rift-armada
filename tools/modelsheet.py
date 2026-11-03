#!/usr/bin/env python3
"""Modellbogen-Tafeln aus den Studiobildern (tools/modelsheet.js): je Fraktion eine Schiffstafel (Aufstellung im
gleichen Maßstab + jedes Schiff formatfüllend) und eine Stationstafel (Stufe 1–3 je Station).
python3 tools/modelsheet.py <ordner>  → <ordner>/tafel-<fraktion>-schiffe.jpg, -stationen.jpg"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops
D = sys.argv[1]; IDX = json.load(open(os.path.join(D, 'index.json')))
NAMES = {'alliance': 'Allianz', 'mars': 'Mars-Republik', 'legion': 'Goldene Legion', 'nexus': 'Nexus', 'brood': 'Brood'}
CLS = {'s': 'klein', 'm': 'mittel', 'l': 'groß'}
BG = (5, 7, 15)
def font(sz, bold=False):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F1, F2, F3 = font(30, True), font(17, True), font(14)
def trim(im, pad=14):
    bg = Image.new(im.mode, im.size, BG); diff = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 18 else 0)
    bb = diff.getbbox()
    if not bb: return im
    x0, y0, x1, y1 = bb; return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
def fit(im, w, h):
    im = im.copy(); im.thumbnail((w, h), Image.LANCZOS); c = Image.new('RGB', (w, h), BG); c.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return c
for f, L in IDX.items():
    fd = os.path.join(D, f)
    # Schiffe
    TW, TH, COLS = 300, 300, 4
    ships = [s for s in L['ships'] if os.path.exists(os.path.join(fd, 's-' + s['id'] + '.png'))]
    rows = (len(ships) + COLS - 1) // COLS
    lu = trim(Image.open(os.path.join(fd, 'lineup.png')).convert('RGB'))
    luw = TW * COLS; lu = fit(lu, luw, 260)
    W, H = luw + 40, 90 + 260 + 40 + rows * (TH + 46) + 30
    sh = Image.new('RGB', (W, H), BG); dr = ImageDraw.Draw(sh)
    dr.text((20, 22), NAMES.get(f, f) + ' – Schiffe', font=F1, fill=(230, 236, 255))
    dr.text((20, 62), 'Oben: alle Schiffe im gleichen Maßstab (wie im Spiel, nach Größe). Darunter: jedes Schiff formatfüllend.', font=F3, fill=(150, 160, 190))
    sh.paste(lu, (20, 90))
    y0 = 90 + 260 + 40
    for i, s in enumerate(ships):
        x, y = 20 + (i % COLS) * TW, y0 + (i // COLS) * (TH + 46)
        im = fit(trim(Image.open(os.path.join(fd, 's-' + s['id'] + '.png')).convert('RGB')), TW - 10, TH - 10)
        sh.paste(im, (x + 5, y)); dr.rectangle((x + 5, y, x + TW - 5, y + TH - 10), outline=(30, 38, 60))
        dr.text((x + 8, y + TH - 6), str(s.get('name') or s['id']), font=F2, fill=(220, 228, 250))
        dr.text((x + 8, y + TH + 15), f"{s['id']} · {CLS.get(s.get('cls'), s.get('cls'))} · {s.get('role')}", font=F3, fill=(130, 140, 170))
    sh.save(os.path.join(D, f'tafel-{f}-schiffe.jpg'), quality=88)
    # Stationen
    sts = [s for s in L['st'] if os.path.exists(os.path.join(fd, f"b-{s['id']}-1.png"))]
    TW, TH = 330, 300
    W, H = 220 + 3 * TW + 20, 90 + len(sts) * (TH + 16) + 20
    sh = Image.new('RGB', (W, H), BG); dr = ImageDraw.Draw(sh)
    dr.text((20, 22), NAMES.get(f, f) + ' – Stationen', font=F1, fill=(230, 236, 255))
    for k in range(3): dr.text((220 + k * TW + 10, 66), 'Stufe ' + 'I' * (k + 1), font=F2, fill=(150, 160, 190))
    for i, s in enumerate(sts):
        y = 90 + i * (TH + 16)
        dr.text((20, y + TH // 2 - 20), str(s.get('name') or s['id']), font=F2, fill=(220, 228, 250))
        dr.text((20, y + TH // 2 + 4), s['id'], font=F3, fill=(130, 140, 170))
        for lv in range(1, 4):
            pth = os.path.join(fd, f"b-{s['id']}-{lv}.png")
            if not os.path.exists(pth): continue
            im = fit(trim(Image.open(pth).convert('RGB')), TW - 10, TH)
            sh.paste(im, (220 + (lv - 1) * TW + 5, y)); dr.rectangle((220 + (lv - 1) * TW + 5, y, 220 + lv * TW - 5, y + TH - 1), outline=(30, 38, 60))
    sh.save(os.path.join(D, f'tafel-{f}-stationen.jpg'), quality=88)
    print(f, len(ships), 'Schiffe,', len(sts), 'Stationen')
