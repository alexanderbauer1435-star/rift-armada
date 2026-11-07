#!/usr/bin/env python3
"""Fügt die Module aus src/ in fester Reihenfolge zu einer einzelnen HTML-Datei zusammen.
python3 tools/build.py [Fassung]  – ohne Angabe die Nummer aus VERSION. Schreibt build/Rift-Armada-NN.html und
build/rift-armada.html (gleicher Inhalt, fester Name für die Android-App)."""
import sys, os, re, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ORDER = ['core.js', 'data.js', 'i18n.js', 'i18n_en.js', 'i18n_more.js', 'map.js', 'terrain.js', 'mapview.js', 'sim.js', 'combat.js', 'ai.js', 'waves.js', 'mission.js', 'missions.js', 'conquest.js', 'ships.js', 'fx.js', 'render3d.js', 'render.js', 'audio.js', 'music.js', 'sfx.js', 'portrait.js', 'ui.js', 'terrui.js', 'editor.js', 'campaign.js', 'cqui.js', 'save.js', 'app.js', 'qr.js', 'net.js', 'feedback.js', 'hudplus.js', 'play.js', 'replay.js', 'progress.js', 'main.js']
FACS = [('alliance', 'The Alliance', '#5fb8ff', 'rgba(170,230,255,0.95)', ['archipelago', 'haven', 'wren'], 'Archipelago · Haven · Wren'),
        ('mars', 'Martian Republic', '#ff7a4a', 'rgba(255,190,110,0.95)', ['olympus', 'hammer', 'wasp'], 'Olympus · Hammer · Wasp'),
        ('legion', 'Golden Legion', '#f2c14e', 'rgba(255,230,160,0.95)', ['sovereign', 'basilica', 'herald'], 'Last Sovereign · Basilica · Herald'),
        ('nexus', 'The Nexus', '#c9a0ff', 'rgba(220,190,255,0.95)', ['facet', 'monolith', 'shard'], 'Prime Facet · Monolith · Shard'),
        ('brood', 'The Brood', '#8be04a', 'rgba(190,255,120,0.95)', ['matriarch', 'leviathan', 'larva'], 'Brood Matriarch · Leviathan · Larva')]
def boot_html():
    """Fassung 25: Startbild (src/boot.html) mit eingebetteten Schiffsbildern (src/boot/*.webp) und Sternschichten."""
    import base64, random
    h = open(os.path.join(SRC, 'boot.html'), encoding='utf-8').read()
    img = lambda n: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(SRC, 'boot', n + '.webp'), 'rb').read()).decode()
    rnd = random.Random(25)
    def stars(n, size, col):
        base = [(rnd.randrange(2000), rnd.randrange(1600)) for _ in range(n)]
        return ', '.join('%dpx %dpx 0 %s %s' % (x + k * 2000, y, size, col) for k in range(4) for (x, y) in base)
    h = h.replace('{{STARS1}}', stars(70, '0px', '#9fb6d6')).replace('{{STARS2}}', stars(45, '0.5px', '#cfe3ff')).replace('{{STARS3}}', stars(22, '1px', '#ffffff'))
    fac = ''
    for k, (f, name, fc, eg, ships, names) in enumerate(FACS):
        fac += '<div class="fg" data-f="%s" style="--k:%d;--fc:%s;--eg:%s">' % (f, k, fc, eg)
        fac += '<div class="ship b2"><img src="%s" alt=""></div><div class="ship s1"><img src="%s" alt=""></div><div class="ship b1"><img src="%s" alt=""></div>' % (img(ships[1]), img(ships[2]), img(ships[0]))
        fac += '<div class="fl"><b>%s</b><small>%s</small></div></div>\n' % (name, names)
    h = h.replace('{{FACTIONS}}', fac).replace('{{IMG:icon}}', img('icon'))
    return h
def build(version):
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8').read()
    font = open(os.path.join(SRC, 'font.css'), encoding='utf-8').read()
    js = '\n'.join(open(os.path.join(SRC, f), encoding='utf-8').read() for f in ORDER)
    bid = '%d-%s' % (version, hashlib.sha1(js.encode('utf-8')).hexdigest()[:10])
    out = shell.replace('/*FONT*/', font).replace('<!--SCRIPT-->', '<script>window.RA_OFFLINE = 1; window.RA_VERSION = %d; window.RA_BUILD = "%s";</script>\n<script>\ntry { window.__bootP && window.__bootP(0.78); } catch (e) {}\n%s\n</script>' % (version, bid, js))
    out = out.replace('<body>', '<body>\n' + boot_html(), 1)   # Fassung 25: Startbild als erstes im Körper
    out = out.replace('%V%', str(version))   # auch in den Übersetzungen (sonst stand dort »Version %V%«)
    name = 'Rift-Armada-%02d.html' % version
    path = os.path.join(ROOT, 'build', name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(out)
    open(os.path.join(ROOT, 'build', 'rift-armada.html'), 'w', encoding='utf-8').write(out)
    print(path, len(out), 'bytes', out.count('\n'), 'lines')
    return path
if __name__ == '__main__':
    build(int(sys.argv[1]) if len(sys.argv) > 1 else int(open(os.path.join(ROOT, 'VERSION')).read().strip()))
