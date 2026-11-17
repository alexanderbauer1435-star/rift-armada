#!/usr/bin/env python3
"""Fassung 30: Geräusche aus freien Sample-Paketen (CC0) aufbereiten. Liest die entpackten Pakete aus einem Ordner
(kenney/, digital/, lentikula/), schneidet Stille weg, kürzt, blendet aus, gleicht die Lautstärke an und schreibt
src/snd/<klang>_<n>.mp3 samt src/snd/map.json. tools/build.py bettet sie ein, src/audio.js spielt sie statt der errechneten
Klänge; fehlt ein Klang hier, bleibt der errechnete. Quellen und Lizenzen: src/snd/CREDITS.md.
python3 tools/snd30.py <Ordner mit den entpackten Paketen>"""
import os, sys, json, subprocess, glob
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'src', 'snd'); SR = 44100
K = 'kenney/Audio/'; L = 'lentikula/'; D = 'digital/**/'
# Klang → (Quellen, längste Dauer in s, Zielpegel (Spitze bei voller Lautstärke), Einblenden in s)
MAP = {
    'beam':    ([K + 'laserLarge_00%d.ogg' % i for i in range(5)], 0.60, 0.16, 0),
    'pd':      ([K + 'laserSmall_00%d.ogg' % i for i in range(5)], 0.22, 0.05, 0),
    'rail':    ([L + 'Laser Rifle %d.wav' % i for i in (1, 2, 3)], 0.85, 0.30, 0),
    'lance':   ([L + 'Laser Beam %d.wav' % i for i in (1, 2)], 1.20, 0.24, 0),
    'hit':     ([K + 'impactMetal_00%d.ogg' % i for i in range(5)], 0.35, 0.07, 0),
    'sboom':   ([K + 'explosionCrunch_00%d.ogg' % i for i in (0, 1, 2)], 0.60, 0.24, 0),
    'boom':    ([K + 'explosionCrunch_00%d.ogg' % i for i in (3, 4)] + [K + 'lowFrequency_explosion_000.ogg'], 1.10, 0.34, 0),
    'bigboom': ([K + 'lowFrequency_explosion_000.ogg', K + 'lowFrequency_explosion_001.ogg'], 1.80, 0.50, 0),
    'bboom':   ([K + 'lowFrequency_explosion_001.ogg'], 2.00, 0.60, 0),
    'shield':  ([K + 'forceField_00%d.ogg' % i for i in range(5)], 0.45, 0.07, 0),
    'acid':    ([K + 'slime_000.ogg', K + 'slime_001.ogg'], 0.40, 0.08, 0),
    'bite':    ([K + 'slime_001.ogg', K + 'slime_000.ogg'], 0.22, 0.08, 0),
    'torp':    ([K + 'thrusterFire_00%d.ogg' % i for i in (0, 1, 2)], 0.80, 0.13, 0.03),
    'warp':    ([D + 'phaseJump%d.mp3' % i for i in (1, 2, 3)], 0.90, 0.10, 0),
}
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def shape(x, maxd, fin):
    a = np.abs(x); idx = np.where(a > 0.02 * a.max())[0]; x = x[max(0, idx[0] - int(0.004 * SR)):idx[-1] + 1]      # Stille vorn und hinten weg
    n = min(len(x), int(maxd * SR)); x = x[:n].copy(); k = min(n, int((0.12 if n == int(maxd * SR) else 0.02) * SR)); x[-k:] *= np.linspace(1, 0, k) ** 1.5
    if fin: k = int(fin * SR); x[:k] *= np.linspace(0, 1, k)
    return x / max(1e-9, np.abs(x).max()) * 0.9
def feat(x):
    sp = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / SR); return len(x) / SR, float((sp * f).sum() / max(1e-9, sp.sum())), float(np.sqrt((x ** 2).mean()))
def main(src):
    for f in glob.glob(os.path.join(OUT, '*.mp3')): os.remove(f)
    out = {}; total = 0
    for name, (files, maxd, peak, fin) in MAP.items():
        ent = []
        for i, pat in enumerate(files):
            hit = glob.glob(os.path.join(src, pat), recursive=True); assert hit, pat
            x = shape(load(hit[0]), maxd, fin); fn = '%s_%d.mp3' % (name, i); p = os.path.join(OUT, fn)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '80k', p], input=x.astype(np.float32).tobytes(), check=True)
            d, c, r = feat(x); ent.append(fn); total += os.path.getsize(p); print('%-8s %-34s %.2f s  Schwerpunkt %5.0f Hz  rms %.3f' % (name, os.path.basename(hit[0]), d, c, r))
        out[name] = {'f': ent, 'g': round(peak / 0.81, 3), 'd': maxd}
    json.dump(out, open(os.path.join(OUT, 'map.json'), 'w'), indent=1); print(len(out), 'Klänge,', sum(len(v['f']) for v in out.values()), 'Dateien,', total // 1024, 'KB')
if __name__ == '__main__': main(sys.argv[1])
