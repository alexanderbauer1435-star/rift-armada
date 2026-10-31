#!/usr/bin/env python3
"""Fügt die Module aus src/ in fester Reihenfolge zu einer einzelnen HTML-Datei zusammen.
python3 tools/build.py [Fassung]  – ohne Angabe die Nummer aus VERSION. Schreibt build/Rift-Armada-NN.html und
build/rift-armada.html (gleicher Inhalt, fester Name für die Android-App)."""
import sys, os, re, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ORDER = ['core.js', 'data.js', 'i18n.js', 'i18n_en.js', 'i18n_more.js', 'map.js', 'terrain.js', 'mapview.js', 'sim.js', 'combat.js', 'ai.js', 'waves.js', 'mission.js', 'missions.js', 'conquest.js', 'ships.js', 'fx.js', 'render3d.js', 'render.js', 'audio.js', 'music.js', 'sfx.js', 'portrait.js', 'ui.js', 'terrui.js', 'editor.js', 'campaign.js', 'cqui.js', 'save.js', 'app.js', 'qr.js', 'net.js', 'feedback.js', 'hudplus.js', 'play.js', 'replay.js', 'progress.js', 'main.js']
def build(version):
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8').read()
    font = open(os.path.join(SRC, 'font.css'), encoding='utf-8').read()
    js = '\n'.join(open(os.path.join(SRC, f), encoding='utf-8').read() for f in ORDER)
    bid = '%d-%s' % (version, hashlib.sha1(js.encode('utf-8')).hexdigest()[:10])
    out = shell.replace('/*FONT*/', font).replace('<!--SCRIPT-->', '<script>window.RA_OFFLINE = 1; window.RA_VERSION = %d; window.RA_BUILD = "%s";</script>\n<script>\n%s\n</script>' % (version, bid, js))
    out = out.replace('Rift Armada · Fassung %V%', 'Rift Armada · Fassung %d' % version)
    name = 'Rift-Armada-%02d.html' % version
    path = os.path.join(ROOT, 'build', name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(out)
    open(os.path.join(ROOT, 'build', 'rift-armada.html'), 'w', encoding='utf-8').write(out)
    print(path, len(out), 'bytes', out.count('\n'), 'lines')
    return path
if __name__ == '__main__':
    build(int(sys.argv[1]) if len(sys.argv) > 1 else int(open(os.path.join(ROOT, 'VERSION')).read().strip()))
