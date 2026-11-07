#!/usr/bin/env python3
"""Store-Bilder Fassung 25: Überschriften je Sprache auf die Szenen aus tools/storeshots25.js setzen.
python3 tools/storecaps25.py → store/graphics/shot25-<n>-<lang>.jpg (1920×1080) und store/graphics/feature25-1024x500[-lang].png
Schrift: Barlow Condensed (SIL OFL 1.1), latin + latin-ext (Polnisch) aus tools/fonts/."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(ROOT, 'store', 'graphics'); RAW = os.path.join(G, 'raw25'); FD = os.path.join(ROOT, 'tools', 'fonts')

CAPS = {
 'de': [('Raumschlachten in Echtzeit', 'Strahlen, Torpedos, Railguns – du führst die Flotte'),
        ('Baue deine Basis aus', 'Stationen in drei Stufen: Werften, Reaktoren, Verteidigung'),
        ('Sprungtore verbinden die Front', 'Erobere die Tore und springe quer über die Karte'),
        ('Die Brood bricht durch die Risse', 'Rift Survival: Welle um Welle, allein oder im Team'),
        ('Fünf Fraktionen, fünf Spielweisen', 'Kristallschiffe, lebende Schiffe, Schlachtkreuzer und mehr')],
 'en': [('Real-time space battles', 'Beams, torpedoes, railguns – you command the fleet'),
        ('Build up your base', 'Stations in three tiers: shipyards, reactors, defences'),
        ('Jump gates connect the front', 'Capture the gates and jump across the map'),
        ('The Brood breaks through the rifts', 'Rift Survival: wave after wave, alone or as a team'),
        ('Five factions, five ways to play', 'Crystal ships, living ships, battlecruisers and more')],
 'fr': [('Batailles spatiales en temps réel', 'Rayons, torpilles, canons électriques – vous menez la flotte'),
        ('Développez votre base', 'Stations sur trois niveaux : chantiers, réacteurs, défenses'),
        ('Les portes de saut relient le front', 'Prenez les portes et sautez à travers la carte'),
        ('La Brood surgit des failles', 'Rift Survival : vague après vague, seul ou en équipe'),
        ('Cinq factions, cinq styles de jeu', 'Vaisseaux de cristal, vaisseaux vivants, croiseurs et plus')],
 'es': [('Batallas espaciales en tiempo real', 'Rayos, torpedos, cañones de riel: tú diriges la flota'),
        ('Amplía tu base', 'Estaciones en tres niveles: astilleros, reactores, defensas'),
        ('Los portales de salto unen el frente', 'Conquista los portales y salta por todo el mapa'),
        ('La Brood irrumpe por las grietas', 'Rift Survival: oleada tras oleada, solo o en equipo'),
        ('Cinco facciones, cinco estilos', 'Naves de cristal, naves vivas, cruceros de batalla y más')],
 'it': [('Battaglie spaziali in tempo reale', 'Raggi, siluri, cannoni a rotaia – comandi tu la flotta'),
        ('Espandi la tua base', 'Stazioni su tre livelli: cantieri, reattori, difese'),
        ('I portali di salto uniscono il fronte', 'Conquista i portali e salta da un capo all’altro della mappa'),
        ('La Brood irrompe dalle fratture', 'Rift Survival: ondata dopo ondata, da solo o in squadra'),
        ('Cinque fazioni, cinque stili di gioco', 'Navi di cristallo, navi viventi, incrociatori e altro')],
 'pt': [('Batalhas espaciais em tempo real', 'Raios, torpedos, canhões elétricos – você comanda a frota'),
        ('Expanda sua base', 'Estações em três níveis: estaleiros, reatores, defesas'),
        ('Portais de salto ligam a frente', 'Conquiste os portais e salte pelo mapa inteiro'),
        ('A Brood irrompe pelas fendas', 'Rift Survival: onda após onda, sozinho ou em equipe'),
        ('Cinco facções, cinco estilos', 'Naves de cristal, naves vivas, cruzadores e mais')],
 'pl': [('Bitwy kosmiczne w czasie rzeczywistym', 'Promienie, torpedy, działa szynowe – dowodzisz flotą'),
        ('Rozbudowuj swoją bazę', 'Stacje na trzech poziomach: stocznie, reaktory, obrona'),
        ('Wrota skokowe łączą front', 'Zdobywaj wrota i skacz przez całą mapę'),
        ('Brood przebija się przez szczeliny', 'Rift Survival: fala za falą, solo lub w drużynie'),
        ('Pięć frakcji, pięć stylów gry', 'Kryształowe statki, żywe statki, krążowniki i więcej')]}

class Face:
    """Schrift mit Rückfall: Zeichen, die latin nicht hat, kommen aus latin-ext."""
    def __init__(self, w, size):
        self.f = [ImageFont.truetype(os.path.join(FD, 'bc-%s-%s.ttf' % (s, w)), size) for s in ('latin', 'latin-ext')]
        self.cm = [TTFont(os.path.join(FD, 'bc-%s-%s.ttf' % (s, w))).getBestCmap() for s in ('latin', 'latin-ext')]
    def font(self, ch): return self.f[0] if ord(ch) in self.cm[0] or ord(ch) not in self.cm[1] else self.f[1]
    def width(self, d, text, sp=0):
        return sum(d.textlength(c, font=self.font(c)) + sp for c in text) - (sp if text else 0)
    def draw(self, d, xy, text, fill, sp=0):
        x, y = xy
        for c in text:
            d.text((x, y), c, font=self.font(c), fill=fill); x += d.textlength(c, font=self.font(c)) + sp

def caption(img, title, sub):
    W, H = img.size
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    # dunkler Verlauf oben für Lesbarkeit
    for y in range(320):
        a = int(225 * (1 - y / 320) ** 1.4); d.line([(0, y), (W, y)], fill=(2, 4, 10, a))
    img = Image.alpha_composite(img.convert('RGBA'), ov)
    d = ImageDraw.Draw(img)
    T = Face('700', 92); S = Face('600', 44)
    x0, y0 = 70, 52
    # Akzentstrich in Spielfarbe
    d.rectangle([x0, y0 + 14, x0 + 8, y0 + 168], fill=(143, 227, 255, 255))
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    T.draw(gd, (x0 + 34, y0), title.upper(), (143, 227, 255, 180), sp=3)
    glow = glow.filter(ImageFilter.GaussianBlur(14)); img = Image.alpha_composite(img, glow); d = ImageDraw.Draw(img)
    T.draw(d, (x0 + 34, y0), title.upper(), (255, 255, 255, 255), sp=3)
    S.draw(d, (x0 + 36, y0 + 118), sub, (190, 214, 230, 255), sp=0.5)
    return img

TAG = {'de': 'Weltraum-Echtzeitstrategie · fünf Fraktionen · offline', 'en': 'Space real-time strategy · five factions · offline',
       'fr': 'Stratégie spatiale en temps réel · cinq factions · hors ligne', 'es': 'Estrategia espacial en tiempo real · cinco facciones · sin conexión',
       'it': 'Strategia spaziale in tempo reale · cinque fazioni · offline', 'pt': 'Estratégia espacial em tempo real · cinco facções · offline',
       'pl': 'Kosmiczna strategia czasu rzeczywistego · pięć frakcji · offline'}
def feature(lang):
    """Vorstellungsgrafik 1024×500: Sterne und Nebel, drei Großkampfschiffe verschiedener Fraktionen, Symbol, Name, Zeile."""
    import random
    W, H = 1024, 500; r = random.Random(25)
    img = Image.new('RGBA', (W, H), (3, 5, 12, 255)); d = ImageDraw.Draw(img)
    neb = Image.new('RGBA', (W, H), (0, 0, 0, 0)); nd = ImageDraw.Draw(neb)
    nd.ellipse([520, -120, 1180, 380], fill=(90, 50, 150, 110)); nd.ellipse([-200, 260, 420, 700], fill=(30, 90, 140, 90))
    img = Image.alpha_composite(img, neb.filter(ImageFilter.GaussianBlur(90))); d = ImageDraw.Draw(img)
    for _ in range(260):
        x, y, a = r.randrange(W), r.randrange(H), r.randrange(70, 255); s = r.choice([1, 1, 1, 2]); d.rectangle([x, y, x + s - 1, y + s - 1], fill=(220, 232, 255, a))
    B = os.path.join(ROOT, 'src', 'boot')
    def ship(name, w, x, y, dim=1.0):
        im = Image.open(os.path.join(B, name + '.webp')).convert('RGBA'); im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
        if dim < 1: im = Image.eval(im, lambda v: v).point(lambda v: v) ; im.putalpha(im.getchannel('A').point(lambda a: int(a * dim)))
        img.alpha_composite(im, (x, y))
    ship('sovereign', 270, 735, 22, 0.7); ship('matriarch', 240, 790, 360, 0.8); ship('olympus', 470, 530, 175)
    icon = Image.open(os.path.join(ROOT, 'store', 'graphics', 'icon-512.png')).convert('RGBA').resize((132, 132), Image.LANCZOS)
    m = Image.new('L', icon.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 131, 131], 30, fill=255); icon.putalpha(m)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([54, 92, 54 + 140, 92 + 140], 34, fill=(143, 227, 255, 120))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(18))); img.alpha_composite(icon, (58, 96))
    d = ImageDraw.Draw(img); T = Face('700', 78); S = Face('600', 27)
    T.draw(d, (58, 250), 'RIFT ARMADA', (255, 255, 255, 255), sp=8)
    words = TAG[lang]; lines = [words] if S.width(d, words) < 470 else [words[:words.index(' · ') ], words[words.index(' · ') + 3:]]
    for i, ln in enumerate(lines): S.draw(d, (60, 344 + i * 34), ln, (169, 184, 214, 255))
    d.rectangle([60, 350 + len(lines) * 34, 380, 353 + len(lines) * 34], fill=(255, 179, 92, 255))
    return img.convert('RGB')

def main():
    scenes = [Image.open(os.path.join(RAW, 'scene-%d.png' % n)).convert('RGBA').resize((1920, 1080), Image.LANCZOS) for n in range(1, 6)]
    for lang, caps in CAPS.items():
        for n, (t, s) in enumerate(caps, 1):
            caption(scenes[n - 1], t, s).convert('RGB').save(os.path.join(G, 'shot25-%d-%s.jpg' % (n, lang)), quality=92, optimize=True)
    for lang in TAG: feature(lang).save(os.path.join(G, 'feature25-1024x500%s.png' % ('' if lang == 'de' else '-' + lang)), optimize=True)
    print('Store-Bilder:', len(CAPS) * 5, '+ Vorstellungsgrafiken:', len(TAG))

if __name__ == '__main__':
    main()
