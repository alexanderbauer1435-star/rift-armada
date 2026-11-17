#!/usr/bin/env python3
"""Sprecher für den Action-Trailer: erzeugt je Satz eine Wave-Datei in tools/promo/vo/ mit dem frei nutzbaren
Sprachmodell Kokoro (Apache-2.0; pip install kokoro-onnx soundfile; Modell und Stimmen von
github.com/thewh1teagle/kokoro-onnx/releases, model-files-v1.0). Die Stimme ist künstlich erzeugt.
python3 tools/promo_vo.py <Ordner mit kokoro-v1.0.onnx und voices-v1.0.bin> [Stimme=bm_george] [Tempo=0.86]"""
import sys, os, json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
LINES = [('vo1', "For a hundred years, the gates held the worlds together."), ('vo2', "Then, one by one, they went silent."), ('vo3', "Something had come through."),
         ('vo4a', "Mars armed itself."), ('vo4b', "The Legion marched."), ('vo4c', "The Nexus watched."), ('vo5a', "Now everyone wants the Rift."), ('vo5b', "And the Rift wants everyone."),
         ('vo6', "Rift Armada. The closed beta is open. Join the fight.")]
md = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else 'bm_george'; speed = float(sys.argv[3]) if len(sys.argv) > 3 else 0.86
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'promo', 'vo'); os.makedirs(out, exist_ok=True)
k = Kokoro(os.path.join(md, 'kokoro-v1.0.onnx'), os.path.join(md, 'voices-v1.0.bin')); dur = {}
for n, t in LINES:
    s, sr = k.create(t, voice=voice, speed=speed, lang='en-gb' if voice.startswith('b') else 'en-us')
    a = np.abs(s); idx = np.where(a > 0.01 * a.max())[0]; s = s[max(0, idx[0] - int(0.02 * sr)):idx[-1] + int(0.08 * sr)]   # Stille vorn und hinten weg
    sf.write(os.path.join(out, n + '.wav'), s, sr, subtype='PCM_16'); dur[n] = round(len(s) / sr, 2)
json.dump({'voice': voice, 'sr': sr, 'dur': dur, 'text': dict(LINES)}, open(os.path.join(out, 'meta.json'), 'w'), indent=1); print(voice, dur)
