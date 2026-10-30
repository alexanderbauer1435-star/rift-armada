/* ===== map.js ===== */
'use strict';
/* =====================================================================
   KARTEN – Weltraumkarten aus festen Vorlagen mit Zufall je Partie, Navigationsraster und Wegsuche.
   Eine Karte besteht aus: Startplätzen, Ressourcenfeldern (Eismonde, Erzasteroiden), Asteroidenfeldern (dichte
   Bereiche: kleine Schiffe langsam, mittlere und große gar nicht), einzelnen Felsen (für niemanden passierbar)
   und dem Aschenebel am Rand (beschädigt die Hülle, schaltet Schilde ab).
   Karten mit gerader Parteienzahl sind punktgespiegelt: Startplatz k und k + np/2 finden dieselbe Umgebung vor.
   ===================================================================== */
const NAV = 32;                               // Rasterzelle der Wegsuche in Pixeln
const EDGE = 110;                             // Breite des Aschenebels am Kartenrand
const CLS_IDX = { f: 0, s: 0, m: 1, l: 2 };   // Größenklasse → Navigationsraster
const NODE_ICE = 18000, NODE_ORE = 8400;
const NODE_REGROW = 0.0005, NODE_REGROW_CAP = 0.6;   // Nachwachsen je Sekunde (Anteil am Anfangswert) und Obergrenze

const MAPS = {
  haven: { name: "Haven's Reach", np: [2], w: 3200, h: 3200, desc: 'Zwei Ecktaschen mit je zwei Zugängen, ein Eismond in der Mitte, eine Stätte und ein flackerndes Tor. Für den Einstieg.' },
  twingates: { name: 'Twin Gates', np: [2], w: 3800, h: 2600, desc: 'Jede Basis in einer Tasche mit einem Zugang, dazwischen Nebelwände. Zwei Tore verbinden die Hinterhöfe.' },
  ashfall: { name: 'Ashfall Corridor', np: [2, 3, 4], w: 4400, h: 2600, desc: 'Langer Korridor, Engstellen aus Asteroiden mit einer Aschewolke in der Lücke, eine Stätte in der Mitte.' },
  shattered: { name: 'Shattered Moon', np: [2, 4], w: 4400, h: 4400, desc: 'Ein zerbrochener Mond als Trümmerring um die große Stätte, Ecktaschen für die Basen, Ionennebel in den Trümmern.' },
  crown: { name: 'Nebula Crown', np: [2, 3, 4], w: 4000, h: 4000, desc: 'Ein Kranz aus Ionennebel um die Mitte, vier offene Pforten. Die Basen sitzen in Ecktaschen mit zwei Zugängen.' },
  narrows: { name: 'The Narrows', np: [2], w: 4600, h: 2400, desc: 'Drei Bahnen zwischen den Basen: kurz durch Aschewolken, mittig durch die Engstelle mit der Stätte, lang und still über den Süden.' },
  arena: { name: 'Rift Arena', np: [2, 3, 4, 5, 6, 7, 8], w: 5200, h: 5200, desc: 'Bis zu acht Basen im Ring, jede in einer Tasche mit zwei Zugängen; Nebel zwischen den Nachbarn, Felder und die Stätte in der Mitte.' },
  expanse: { name: 'Open Expanse', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np], desc: 'Offene Weite ohne Taschen: die Basen im Ring, Vorkommen überall verstreut, nur kleine Felder und Nebelflecken. Angriffe kommen von allen Seiten.' },
  bastions: { name: 'Iron Bastions', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np] + 800, desc: 'Jede Basis hinter einem undurchdringlichen Asteroidengürtel mit einem einzigen schmalen Zugang. Ein zweiter Felsring schützt die große Stätte in der Mitte – überall Engpässe.' },
  maelstrom: { name: 'Maelstrom', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np], desc: 'Felswände trennen die Basen voneinander, jeder Weg führt durch die Mitte. Dort liegen die reichsten Vorkommen und die große Stätte – hier tobt die Schlacht.' },
  keep: { name: "Corsair's Keep", np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np] + 400, desc: 'In der Mitte eine Piratenfestung hinter einem Felsring mit engen Pforten: Geschütze, Flak und eine Garnison, die sich nachbaut. Wer den Kern zerstört oder entert, bekommt den Piratenschatz.' },
  pinwheel: { name: 'Pinwheel', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np] + 200, desc: 'Gekrümmte Felswände drehen sich wie ein Windrad aus der Mitte. Jede Basis liegt am Ende ihres Arms; Nachbarn erreicht man durch eine Lücke in der Wand oder über die Mitte.' },
  archipelago: { name: 'Archipelago', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np] + 200, desc: 'Viele kleine Asteroideninseln mit Vorkommen und Ruinen, jede mit drei Durchfahrten. Kleine Schiffe schlüpfen durch die Gürtel, große müssen die Kanäle nehmen.' },
  storm: { name: 'Ion Storm', np: [2, 3, 4, 5, 6, 7, 8], dim: np => RING_DIM[np], desc: 'Ein breiter Ionensturm umschließt die Mitte: Schilde aus, Sicht nur aus der Nähe, darin Aschenester. Wer hindurch will, fliegt blind – Hinterhalte sind hier die Regel.' },
  quarantine: { name: 'Quarantine Line', np: [1, 2, 3, 4], w: 3800, h: 3800, desc: 'Das Siegel in der Mitte, die Basen im Ring darum, Risse am Rand. Nur für Wellen.', waves: true }
};
const MAP_ORDER = ['haven', 'twingates', 'ashfall', 'shattered', 'crown', 'narrows', 'arena', 'expanse', 'bastions', 'maelstrom', 'keep', 'pinwheel', 'archipelago', 'storm'];
/* Ringkarten wachsen mit der Spielerzahl (Kantenlänge je Spielerzahl) */
const RING_DIM = [0, 3600, 4000, 4600, 5000, 5600, 6000, 6400, 6800];
const RING_STYLE = { expanse: 'expanse', bastions: 'bastions', maelstrom: 'maelstrom', keep: 'keep', pinwheel: 'spiral', archipelago: 'archipelago', storm: 'storm' };
/* Große Stätten: je Karte werden 1–2 aus dem Pool gezogen */
const SITE_POOL = ['citadel', 'archive', 'warden', 'forge'];
const SITE_DEF = {
  ruin: { name: 'Erbauer-Ruine', r: 34, desc: 'Scannen bringt Relikte, ein Technikfragment, eine aufgedeckte Karte – oder eine Falle mit Wächterdrohnen. Schiff daneben stellen.' },
  citadel: { name: 'Die Zitadelle', r: 72, desc: 'Wächter besiegen, dann 60 Sekunden mit genug Kampfkraft halten. Belohnung: der Erbauer-Sentinel, einmal pro Karte.' },
  archive: { name: 'Das Archiv', r: 62, desc: '45 Sekunden halten. Belohnung: eine von drei Erbauer-Technologien, nur auf dieser Karte.' },
  warden: { name: 'Der Wächter', r: 84, desc: 'Schlafende Riesenmaschine. Wer sie weckt, hat sie am Hals – wer sie zerstört, bekommt sechs Relikte.' },
  forge: { name: 'Sternenschmiede', r: 64, desc: '30 Sekunden halten. Solange deine Schiffe hier stehen: +60 Energie, Superwaffe lädt doppelt so schnell.' }
};
/* leere Prüfkarte (nur für Tests, nicht im Menü) */
MAPS.test = { name: 'Testfläche', np: [2], w: 3200, h: 3200, desc: '', hidden: true };
/* KARTENEDITOR (editor.js): eigene Karten. 'custom' baut die Karte aus einem gespeicherten Layout (opts.custom bzw. MAPS[id].layout);
   ohne Layout entsteht die Vorlage des Editors (customDefault). Gespeicherte Karten trägt editor.js als MAPS['cu_…'] ein. */
MAPS.custom = { name: 'Eigene Karte', np: [2, 3, 4, 5, 6, 7, 8], w: 5000, h: 5000, desc: 'Eigene Karte aus dem Karteneditor.', hidden: true, custom: true };

function mapFor(id, np) {
  const m = MAPS[id] || MAPS.haven;
  return m.np.indexOf(np) >= 0 ? id : MAP_ORDER.find(k => MAPS[k].np.indexOf(np) >= 0) || 'haven';
}

/* Hilfen beim Aufbau: Punktspiegelung und Abstandsprüfung */
function mirror(map, p) { return { x: map.w - p.x, y: map.h - p.y }; }
function farFrom(list, x, y, d) { for (const o of list) if (hyp(o.x - x, o.y - y) < d + (o.r || 0)) return false; return true; }

/* ---------- Generator ---------- */
/* Kartengröße: klein, normal, groß – die Karte wird nach dem Aufbau gestreckt (Lagen, Gürtel- und Nebelradien), Felsen,
   Vorkommen, Stätten und Tore behalten ihre Größe. So bleiben Taschen und Korridore erhalten, nur die Wege werden länger. */
const MAP_SIZES = { small: 0.85, normal: 1, large: 1.3 };
function generateMap(id, np, seed, size, layout) {
  const def = MAPS[id] || MAPS.haven, rng = makeRng((seed || 1) * 2654435761 + hashStr(id));
  /* KARTENEDITOR: eigene Karte aus dem Layout (opts.custom oder dem eingetragenen MAPS-Eintrag), Größenwahl gilt hier nicht */
  const lay = layout || def.layout || (def.custom ? customDefault(np) : null);
  if (lay) { const m = { id: 'custom', name: def.name, w: 5000, h: 5000, np, starts: [], nodes: [], rocks: [], fields: [], nebs: [], sites: [], gates: [], seed, size: 'normal' }; genCustom(m, lay, makeRng((seed || 1) * 2654435761 + hashStr('custom'))); buildNav(m); return m; }
  const dim = def.dim ? def.dim(np) : null, W0 = dim || def.w, H0 = dim || def.h;
  const map = { id, name: def.name, w: W0, h: H0, np, starts: [], nodes: [], rocks: [], fields: [], nebs: [], sites: [], gates: [], seed, size: size || 'normal' };
  if (id === 'ashfall') genAshfall(map, np, rng);
  else if (id === 'crown') genCrown(map, np, rng);
  else if (id === 'narrows') genNarrows(map, rng);
  else if (id === 'twingates') genTwinGates(map, rng);
  else if (id === 'shattered') genShattered(map, np, rng);
  else if (id === 'quarantine') genQuarantine(map, np, rng);
  else if (id === 'test') { map.starts = [{ x: 400, y: 2800, ang: -Math.PI / 4 }, { x: 2800, y: 400, ang: Math.PI * 0.75 }]; iceMoon(map, 700, 2800, rng); iceMoon(map, 2500, 400, rng); site(map, 'ruin', 1200, 1200); site(map, 'ruin', 2000, 2000); site(map, 'archive', 1000, 2200); site(map, 'citadel', 2200, 1300); gatePair(map, 900, 600, 2600, 2600, 'dead'); }
  else if (id === 'arena') genArena(map, np, rng);
  else if (RING_STYLE[id]) genRing(map, np, rng, RING_STYLE[id]);
  else genHaven(map, rng);
  const k = MAP_SIZES[size] || 1;
  if (k !== 1 && id !== 'test') {
    map.w = Math.round(W0 * k); map.h = Math.round(H0 * k);
    for (const key of ['starts', 'nodes', 'rocks', 'fields', 'nebs', 'sites', 'gates', 'rifts']) for (const o of map[key] || []) { o.x *= k; o.y *= k; if (key === 'fields' || key === 'nebs') o.r *= k; else if (key === 'rocks') o.r *= Math.sqrt(k); }
    if (map.fort) { map.fort.x *= k; map.fort.y *= k; }
  }
  buildNav(map);
  return map;
}
/* ---------- KARTENEDITOR: Karte aus einem Layout (Felder siehe editor.js, Koordinaten in Karteneinheiten) ----------
   { n: Name, s: Seitenlänge 3000–7000, np, st: Starts [[x, y]], ice: [[x, y, groß]], ore: [[x, y]], bl: Gürtel [[x0, y0, x1, y1]],
     wl: Felswände [[x0, y0, x1, y1]], ion/ash: Nebel [[x, y, r]], ru: Ruinen [[x, y]], gs: große Stätten [[x, y]] (Art per Zufall der Partie),
     gt: Torpaare [[x0, y0, x1, y1]], ft: Piratenfestung [x, y] oder 0 }. Fremde Layouts (Import, Mehrspieler) werden hier begrenzt. */
const CUSTOM_MAX = 300;
function genCustom(map, L, rng) {
  L = L && typeof L === 'object' ? L : {};
  const s0 = +L.s, s = Number.isFinite(s0) ? clamp(Math.round(s0), 3000, 7000) : 5000;
  map.w = map.h = s; if (typeof L.n === 'string' && L.n.trim()) map.name = L.n.trim().slice(0, 32);
  const arr = a => Array.isArray(a) ? a.slice(0, CUSTOM_MAX).filter(Array.isArray) : [];
  const c = v => { v = +v; return Number.isFinite(v) ? clamp(v, 0, s) : s / 2; }, rad = v => { v = +v; return Number.isFinite(v) ? clamp(v, 80, 700) : 220; };
  for (const p of arr(L.st).slice(0, 8)) { const x = c(p[0]), y = c(p[1]); map.starts.push({ x, y, ang: datan2(s / 2 - y, s / 2 - x) }); }
  for (const p of arr(L.ice)) iceMoon(map, c(p[0]), c(p[1]), rng, !!p[2]);
  for (const p of arr(L.ore)) oreCluster(map, c(p[0]), c(p[1]), rng, 3);
  for (const p of arr(L.bl)) belt(map, [[c(p[0]), c(p[1])], [c(p[2]), c(p[3])]], 150, rng, null);
  for (const p of arr(L.wl)) wall(map, [[c(p[0]), c(p[1])], [c(p[2]), c(p[3])]], rng, null, 26);
  for (const p of arr(L.ion)) nebula(map, c(p[0]), c(p[1]), rad(p[2]), 'ion');
  for (const p of arr(L.ash)) nebula(map, c(p[0]), c(p[1]), rad(p[2]), 'ash');
  for (const p of arr(L.ru)) site(map, 'ruin', c(p[0]), c(p[1]));
  for (const p of arr(L.gs)) site(map, SITE_POOL[(rng() * SITE_POOL.length) | 0], c(p[0]), c(p[1]));
  for (const p of arr(L.gt).slice(0, 8)) gatePair(map, c(p[0]), c(p[1]), c(p[2]), c(p[3]), 'dead');
  if (Array.isArray(L.ft) && L.ft.length >= 2) map.fort = { x: c(L.ft[0]), y: c(L.ft[1]), r: 330 };
}
/* Vorlage des Editors: Starts im Ring, je Start ein Eismond und Erz Richtung Mitte, eine große Stätte in der Mitte */
function customDefault(np, size) {
  np = clamp(np | 0 || 2, 2, 8);
  const s = clamp(size || RING_DIM[np], 3000, 7000), cx = s / 2, R = s / 2 - 650, a0 = np === 2 ? -0.75 * Math.PI : -Math.PI / 2;
  const L = { v: 1, n: '', s, np, st: [], ice: [], ore: [], bl: [], wl: [], ion: [], ash: [], ru: [], gs: [[cx, cx]], gt: [], ft: 0 };
  const at = (a, r, side) => [Math.round(cx + Math.cos(a) * r - Math.sin(a) * side), Math.round(cx + Math.sin(a) * r + Math.cos(a) * side)];
  for (let i = 0; i < np; i++) { const a = a0 + i * TAU / np; L.st.push(at(a, R, 0)); L.ice.push(at(a, R - 480, 260).concat(0)); L.ore.push(at(a, R - 480, -260)); }
  return L;
}
/* Stätten und Tore */
/* Stätten entstehen nie nahe eines Starts (Fallen und Wächter würden sonst die Startbasis treffen) */
function site(map, kind, x, y, extra) { if (map.starts.some(s => hyp(s.x - x, s.y - y) < 760)) return; map.sites.push(Object.assign({ kind, x, y, r: SITE_DEF[kind].r }, extra || {})); }
function gatePair(map, x0, y0, x1, y1, state) { const n = map.gates.length; map.gates.push({ x: x0, y: y0, r: 58, pair: n + 1, state: state || 'dead' }, { x: x1, y: y1, r: 58, pair: n, state: state || 'dead' }); }
/* 1–2 große Stätten aus dem Pool, an gespiegelten Plätzen zwischen den Spielern */
function bigSites(map, spots, rng, n) {
  const pool = SITE_POOL.slice();
  for (let i = 0; i < n && spots[i]; i++) { const k = pool.splice((rng() * pool.length) | 0, 1)[0]; site(map, k, spots[i].x, spots[i].y); }
}
/* Erzasteroiden-Gruppe um einen Punkt: 2–3 Brocken, die zusammen ein Erzvorkommen sind */
function oreCluster(map, x, y, rng, n) {
  n = n || 3;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = i === 0 ? 0 : 55 + rng() * 40;
    map.nodes.push({ x: x + dcos(a) * d, y: y + dsin(a) * d, r: 26 + rng() * 10, kind: 'ore', amount: Math.round(NODE_ORE / n), ang: rng() * TAU });
  }
}
function iceMoon(map, x, y, rng, big) {
  map.nodes.push({ x, y, r: big ? 78 : 58, kind: 'ice', amount: big ? NODE_ICE * 1.5 : NODE_ICE, ang: rng() * TAU, seed: (rng() * 1e6) | 0 });
}
/* Asteroidenfeld: dichter Bereich plus einzelne größere Felsen darin */
function field(map, x, y, r, rng, dens) {
  map.fields.push({ x, y, r });
  const n = Math.round(r * r / 2600 * (dens || 1));
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.9;
    map.rocks.push({ x: x + dcos(a) * d, y: y + dsin(a) * d, r: 9 + rng() * 15, ang: rng() * TAU, seed: (rng() * 1e6) | 0 });
  }
}
/* ---------- Gelände-Baukasten für Taschen und Korridore ----------
   belt: Asteroidengürtel entlang einer Linie (Punkte [[x, y], …]), aus überlappenden Feldern der Breite w; mittlere und
   große Schiffe kommen nicht hindurch, kleine langsam. gaps: Lücken als Anteile [0..1] der Linienlänge (mit Breite gw),
   dort bleibt der Gürtel offen – das sind die Korridore.
   wall: Felswand aus dicht gesetzten Felsen – für niemanden passierbar.
   nebula: Nebelzone (kind 'ion': Schilde aus, Sensoren blind, Schiffe darin nur aus der Nähe zu sehen; 'ash': wie der
   Aschenebel am Rand, Hüllenschaden). Zonen sind Kreise, cloud() setzt sie entlang einer Linie. */
function pathLen(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }
function pathAt(pts, t) {
  const total = pathLen(pts); let d = t * total;
  for (let i = 1; i < pts.length; i++) { const l = hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= l || i === pts.length - 1) { const k = l ? Math.min(1, d / l) : 0; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k }; } d -= l; }
  return { x: pts[0][0], y: pts[0][1] };
}
function inGap(gaps, t, total) { if (!gaps) return false; for (const [at, gw] of gaps) if (Math.abs(t - at) * total < (gw || 160) / 2) return true; return false; }
function belt(map, pts, w, rng, gaps, dens) {
  const total = pathLen(pts), r = w / 2, step = r * 0.7, n = Math.max(1, Math.round(total / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n; if (inGap(gaps, t, total)) continue;
    const p = pathAt(pts, t), jx = (rng() - 0.5) * r * 0.5, jy = (rng() - 0.5) * r * 0.5;
    map.fields.push({ x: p.x + jx, y: p.y + jy, r: r * (0.95 + rng() * 0.3) });
    const k = Math.round(r * r / 2600 * (dens === undefined ? 0.7 : dens) * 0.9);
    for (let j = 0; j < k; j++) { const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.85; map.rocks.push({ x: p.x + jx + dcos(a) * d, y: p.y + jy + dsin(a) * d, r: 9 + rng() * 15, ang: rng() * TAU, seed: (rng() * 1e6) | 0 }); }
  }
}
function wall(map, pts, rng, gaps, size) {
  const total = pathLen(pts), rr = size || 26, n = Math.max(1, Math.round(total / (rr * 1.5)));
  for (let i = 0; i <= n; i++) {
    const t = i / n; if (inGap(gaps, t, total)) continue;
    const p = pathAt(pts, t);
    map.rocks.push({ x: p.x + (rng() - 0.5) * rr * 0.6, y: p.y + (rng() - 0.5) * rr * 0.6, r: rr * (0.8 + rng() * 0.4), ang: rng() * TAU, seed: (rng() * 1e6) | 0 });
  }
}
function nebula(map, x, y, r, kind) { map.nebs.push({ x, y, r, kind: kind || 'ion' }); }
function cloud(map, pts, w, kind, rng) {
  const total = pathLen(pts), r = w / 2, n = Math.max(1, Math.round(total / (r * 0.8)));
  for (let i = 0; i <= n; i++) { const p = pathAt(pts, i / n); nebula(map, p.x + (rng() - 0.5) * r * 0.4, p.y + (rng() - 0.5) * r * 0.4, r * (0.8 + rng() * 0.4), kind); }
}
/* Tasche um einen Startplatz: Gürtel im Bogen um die Basis (Radius R), offen an den Winkeln in open (Mitte, Breite) */
function pocket(map, s, R, a0, a1, rng, open, w) {
  const pts = [], n = Math.max(4, Math.round(Math.abs(a1 - a0) * R / 120));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([s.x + Math.cos(a) * R, s.y + Math.sin(a) * R]); }
  const gaps = (open || []).map(([ang, gw]) => [(ang - a0) / (a1 - a0), gw || 220]);
  belt(map, pts, w || 150, rng, gaps);
}
/* Streufelsen: Zierde und kleine Hindernisse, nie nahe an Starts oder Ressourcen */
function scatter(map, n, rng, avoid) {
  for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
    const x = EDGE + 60 + rng() * (map.w - 2 * EDGE - 120), y = EDGE + 60 + rng() * (map.h - 2 * EDGE - 120);
    const q0 = mirror(map, { x, y });
    if (!farFrom(avoid, x, y, 260) || !farFrom(map.rocks, x, y, 40) || !farFrom(avoid, q0.x, q0.y, 260) || !farFrom(map.rocks, q0.x, q0.y, 40)) continue;
    const p = { x, y, r: 10 + rng() * 14, ang: rng() * TAU, seed: (rng() * 1e6) | 0 }, q = mirror(map, p);
    map.rocks.push(p, Object.assign({}, p, q, { seed: (rng() * 1e6) | 0 }));
    k += 2;
  }
}
/* Spiegelbild aller Elemente der ersten Hälfte anhängen */
function mirrorAll(map, from) {
  for (const key of ['nodes', 'rocks', 'fields', 'nebs']) {
    const a = map[key], n = a.length;
    for (let i = from[key] || 0; i < n; i++) { const o = a[i], q = mirror(map, o); a.push(Object.assign({}, o, q, { seed: ((o.seed || 0) * 7 + 13) % 1000003 })); }
  }
}
function genHaven(map, rng) {
  /* Zwei Taschen in den Ecken unten links / oben rechts: ein Gürtelbogen schließt die Basis ab, offen nur an zwei
     Stellen – der Diagonale zur Mitte und einem Seitenweg am unteren bzw. oberen Rand. Die Mitte ist offen. */
  const w = map.w, h = map.h;
  const s0 = { x: 560, y: h - 560, ang: -Math.PI / 4 };
  map.starts = [s0, Object.assign(mirror(map, s0), { ang: s0.ang + Math.PI })];
  const mark = { nodes: map.nodes.length, rocks: map.rocks.length, fields: map.fields.length, nebs: map.nebs.length };
  /* Startgebiet in der Tasche: Eismond und Erz */
  iceMoon(map, s0.x + 330, s0.y - 60, rng);
  oreCluster(map, s0.x - 20, s0.y - 340, rng, 3);
  /* Tasche: Bogen mit Radius 820, von unten rechts (0,62) bis links oben (−2,32), die Enden liegen im Aschenebel; Lücken: Diagonale (−0,78) und Seitenweg (−0,05) */
  pocket(map, s0, 820, 0.62, -2.32, rng, [[-0.78, 260], [-0.05, 220]], 150);
  /* Vor der Tasche: zweiter Eismond am Diagonalkorridor, Erz am Seitenweg – wer ausbaut, muss hinaus */
  iceMoon(map, s0.x + 820, s0.y - 820 + 300, rng);
  oreCluster(map, s0.x + 1250, s0.y - 180, rng, 3);
  oreCluster(map, s0.x + 300, s0.y - 1250, rng, 2);
  /* Ionennebel am Seitenweg: Hinterhalt für den, der die Flanke nimmt */
  nebula(map, s0.x + 1500, s0.y - 60, 190, 'ion');
  /* Mitte: zwei Felder lenken den Verkehr an den Eismond */
  field(map, w * 0.5 - 420, h * 0.5 - 520, 150, rng);
  mirrorAll(map, mark);
  /* Mitte: großer Eismond, umkämpft */
  iceMoon(map, w / 2, h / 2, rng, true);
  /* Ruinen an den Korridormündungen, eine große Stätte neben der Mitte, ein flackerndes Tor zwischen den Flanken */
  for (const r of [{ x: s0.x + 1120, y: s0.y - 1180 }, { x: s0.x + 160, y: s0.y - 1500 }]) { site(map, 'ruin', r.x, r.y); const q = mirror(map, r); site(map, 'ruin', q.x, q.y); }
  bigSites(map, [{ x: w / 2 + 720, y: h / 2 + 720 }, { x: w / 2 - 720, y: h / 2 - 720 }], rng, 1 + (rng() < 0.4 ? 1 : 0));
  gatePair(map, w * 0.5 - 1100, h * 0.5 - 60, w * 0.5 + 1100, h * 0.5 + 60, 'flicker');
  scatter(map, 28, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs));
}
/* Quarantine Line: Siegel in der Mitte, 1–4 Basen im Ring (900), Vorkommen je Basis, Risse an den Rändern, Gürtel zwischen Rand und Mitte */
function genQuarantine(map, np, rng) {
  const w = map.w, h = map.h, cx = w / 2, cy = h / 2, R = 980;
  map.starts = [];
  for (let i = 0; i < np; i++) { const a = Math.PI / 2 + i / np * TAU; map.starts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, ang: a + Math.PI }); }
  for (const s of map.starts) {
    const a = datan2(s.y - cy, s.x - cx);
    iceMoon(map, s.x + Math.cos(a + 1.1) * 330, s.y + Math.sin(a + 1.1) * 330, rng);
    oreCluster(map, s.x + Math.cos(a - 1.1) * 320, s.y + Math.sin(a - 1.1) * 320, rng, 3);
    iceMoon(map, s.x + Math.cos(a) * 440, s.y + Math.sin(a) * 440, rng);
  }
  /* Gemeinsame Vorkommen am Siegel */
  oreCluster(map, cx + 420, cy - 420, rng, 3); oreCluster(map, cx - 420, cy + 420, rng, 3);
  if (np < 4) { iceMoon(map, cx - 500, cy - 500, rng); iceMoon(map, cx + 500, cy + 500, rng); }
  /* Risse: Mitten der Ränder, später auch Ecken */
  map.rifts = [{ x: cx, y: EDGE + 140 }, { x: w - EDGE - 140, y: cy }, { x: cx, y: h - EDGE - 140 }, { x: EDGE + 140, y: cy }, { x: EDGE + 200, y: EDGE + 200 }, { x: w - EDGE - 200, y: EDGE + 200 }, { x: w - EDGE - 200, y: h - EDGE - 200 }, { x: EDGE + 200, y: h - EDGE - 200 }];
  /* Gürtelstücke zwischen Rand und Ring: die Brood muss durch Lücken */
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2, d = 1550; field(map, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 150, rng, 0.9); }
  for (const r of [{ x: cx + 700, y: cy }, { x: cx - 700, y: cy }]) site(map, 'ruin', r.x, r.y);
  scatter(map, 30, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.rifts.map(r => ({ x: r.x, y: r.y, r: 160 }))));
}
function genTwinGates(map, rng) {
  /* Breite Karte: jede Basis in einer Tasche mit genau einem Zugang zur Mitte; der zweite Weg führt durch die Tore.
     Zwischen den Taschen ein Band aus Ionennebel – wer hindurch will, verliert Schilde und Sicht. */
  const w = map.w, h = map.h;
  const s0 = { x: 520, y: h - 520, ang: -Math.PI / 4 };
  map.starts = [s0, Object.assign(mirror(map, s0), { ang: s0.ang + Math.PI })];
  const mark = { nodes: map.nodes.length, rocks: map.rocks.length, fields: map.fields.length, nebs: map.nebs.length };
  iceMoon(map, s0.x + 320, s0.y - 40, rng);
  oreCluster(map, s0.x - 40, s0.y - 330, rng, 3);
  iceMoon(map, s0.x + 150, s0.y - 900, rng);
  /* Tasche: Bogen von rechts (0,4) bis oben (−2,0), eine Lücke zur Mitte (−0,5) */
  pocket(map, s0, 1150, 0.4, -2.0, rng, [[-0.5, 280]], 160);
  /* Erz außerhalb der Tasche, am Korridor und beim hinteren Tor */
  oreCluster(map, s0.x + 1350, s0.y - 250, rng, 3);
  oreCluster(map, s0.x + 600, s0.y - 1650, rng, 2);
  /* Nebelband zwischen Tasche und Mitte, mit Aschekern */
  cloud(map, [[s0.x + 1900, s0.y + 150], [s0.x + 1550, s0.y - 900]], 240, 'ion', rng);
  nebula(map, s0.x + 1750, s0.y - 400, 110, 'ash');
  site(map, 'ruin', s0.x + 1500, s0.y - 1300);
  site(map, 'ruin', s0.x + 80, s0.y - 1700);
  mirrorAll(map, mark);
  /* Mitte: umkämpfter Eismond und die großen Stätten dahinter */
  iceMoon(map, w / 2, h / 2, rng, true);
  bigSites(map, [{ x: w / 2 + 760, y: h / 2 - 300 }, { x: w / 2 - 760, y: h / 2 + 300 }], rng, 2);
  /* Zwei Tore: eines in jeder Tasche hinten, verbunden mit einem Tor hinter der Nebelwand der Gegenseite */
  gatePair(map, s0.x + 60, s0.y - 1300, w - s0.x - 1150, h - s0.y + 950, 'dead');
  gatePair(map, w - s0.x - 60, h - s0.y + 1300, s0.x + 1150, s0.y - 950, 'dead');
  scatter(map, 26, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs));
}
function genShattered(map, np, rng) {
  const w = map.w, h = map.h, e = 600;
  map.starts = np === 2 ? [{ x: e, y: h - e, ang: -Math.PI / 4 }, { x: w - e, y: e, ang: Math.PI * 0.75 }] : [{ x: e, y: h - e, ang: -Math.PI / 4 }, { x: w - e, y: e, ang: Math.PI * 0.75 }, { x: w - e, y: h - e, ang: Math.PI * -0.75 }, { x: e, y: e, ang: Math.PI / 4 }];
  const mark = { nodes: map.nodes.length, rocks: map.rocks.length, fields: map.fields.length, nebs: map.nebs.length };
  /* linke untere Ecke, dann gespiegelt; die anderen beiden Ecken bekommen dieselbe Umgebung gedreht */
  const corners = np === 2 ? [map.starts[0]] : [map.starts[0], map.starts[3]];
  for (const s of corners) {
    const sy = s.y > h / 2 ? -1 : 1;
    iceMoon(map, s.x + 330, s.y + sy * 80, rng);
    oreCluster(map, s.x - 20, s.y + sy * 340, rng, 3);
    iceMoon(map, s.x + 950, s.y + sy * 600, rng);
    oreCluster(map, s.x + 1300, s.y + sy * 120, rng, 2);
    site(map, 'ruin', s.x + 600, s.y + sy * 1200);
  }
  /* Taschen: jede Ecke bekommt einen Gürtelbogen mit zwei Lücken (zur Mitte und zur Seite) */
  for (const s of corners) { const sy = s.y > h / 2 ? -1 : 1, base = sy < 0 ? -Math.PI / 4 : Math.PI / 4; pocket(map, s, 900, base + 1.5, base - 1.5, rng, [[base, 280], [base - 0.95, 200]], 150); }
  if (np === 2) { iceMoon(map, 1000, 700, rng); oreCluster(map, 700, 1100, rng, 3); nebula(map, 1300, 1300, 230, 'ion'); }
  /* Ionennebel in den Trümmern: Hinterhalte am Mondring */
  nebula(map, w / 2 - 1250, h / 2 + 150, 200, 'ion');
  /* der zerbrochene Mond: Ring aus Feldern um die Mitte, Lücken an vier Stellen */
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8, d = 760; field(map, w / 2 + dcos(a) * d, h / 2 + dsin(a) * d, 210, rng, 1.0); }
  oreCluster(map, w / 2 - 520, h / 2, rng, 3);
  site(map, 'ruin', w / 2, h / 2 - 1250);
  mirrorAll(map, mark);
  /* Mitte: die große Stätte im Mond, dazu ein Eismond */
  bigSites(map, [{ x: w / 2, y: h / 2 }], rng, 1);
  iceMoon(map, w / 2 + 300, h / 2 + 300, rng, true);
  gatePair(map, w / 2 - 1500, h / 2 - 1500, w / 2 + 1500, h / 2 + 1500, 'flicker');
  scatter(map, 36, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates));
}
function genAshfall(map, np, rng) {
  const w = map.w, h = map.h;
  /* Starts: zwei an den Enden; drei oder vier auch in den Ecken */
  const e = 520;
  if (np <= 2) map.starts = [{ x: e, y: h / 2, ang: 0 }, { x: w - e, y: h / 2, ang: Math.PI }];
  else map.starts = [{ x: e, y: h - 640, ang: 0 }, { x: w - e, y: h - 640, ang: Math.PI }, { x: w - e, y: 640, ang: Math.PI }, { x: e, y: 640, ang: 0 }].slice(0, np);
  if (np === 3) { map.starts = [{ x: e, y: h / 2, ang: 0 }, { x: w - e, y: h - 640, ang: Math.PI }, { x: w - e, y: 640, ang: Math.PI }]; }
  const mark = { nodes: map.nodes.length, rocks: map.rocks.length, fields: map.fields.length, nebs: map.nebs.length };
  /* linke Hälfte, dann gespiegelt */
  for (const s of map.starts.filter(s => s.x < w / 2)) {
    iceMoon(map, s.x + 300, s.y + (s.y < h / 2 ? 240 : -240), rng);
    oreCluster(map, s.x + 80, s.y + (s.y < h / 2 ? -300 : 300) * 0.9, rng, 3);
  }
  /* Engstelle bei einem Drittel: zwei Asteroidenwände, dazwischen eine Lücke; mitten in der Lücke eine Aschewolke,
     an der man sich entscheiden muss: hindurch (Schaden) oder außen herum (länger, durch den Gürtel) */
  const cx = w * 0.36;
  belt(map, [[cx, EDGE + 60], [cx, h / 2 - 330]], 220, rng, null, 1.1);
  belt(map, [[cx, h / 2 + 330], [cx, h - EDGE - 60]], 220, rng, null, 1.1);
  nebula(map, cx, h / 2, 130, 'ash');
  /* Felswand hinter der Basis: die Tasche ist nur von vorn zu erreichen */
  if (np <= 2) wall(map, [[w * 0.2, EDGE + 40], [w * 0.2, h / 2 - 380]], rng); if (np <= 2) wall(map, [[w * 0.2, h / 2 + 380], [w * 0.2, h - EDGE - 40]], rng);
  /* Ionennebel in der Mitte zwischen den Engstellen: der stille Weg */
  nebula(map, w * 0.5 - 330, h * 0.5 + 900, 180, 'ion');
  /* Ausbau zwischen Start und Engstelle */
  iceMoon(map, w * 0.22, h * 0.26, rng);
  oreCluster(map, w * 0.24, h * 0.74, rng, 3);
  oreCluster(map, w * 0.44, h * 0.5 + 520, rng, 2);
  mirrorAll(map, mark);
  /* Mitte: Eismond und Erz, umkämpft; dazu Ruinen, eine große Stätte und ein totes Tor über die Engstellen */
  iceMoon(map, w / 2, h / 2, rng, true);
  oreCluster(map, w / 2, h / 2 - 560, rng, 3);
  for (const r of [{ x: w * 0.3, y: h * 0.5 + 300 }, { x: w * 0.15, y: h * 0.5 }]) { site(map, 'ruin', r.x, r.y); const q = mirror(map, r); site(map, 'ruin', q.x, q.y); }
  site(map, 'ruin', w / 2, h / 2 + 700);
  bigSites(map, [{ x: w / 2, y: h * 0.18 }, { x: w / 2, y: h * 0.82 }], rng, 1 + (rng() < 0.5 ? 1 : 0));
  gatePair(map, w * 0.36, h * 0.5 + 420, w * 0.64, h * 0.5 - 420, 'dead');
  scatter(map, 40, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates));
}

/* Nebula Crown: Kranz aus Ionennebel um die Mitte mit vier Pforten (Achsen), Ecktaschen mit zwei Zugängen, Aschewolken an den
   Rändern zwischen den Ecken; die Mitte mit großer Stätte und großem Eismond */
function genCrown(map, np, rng) {
  const w = map.w, h = map.h, cx = w / 2, cy = h / 2, e = 620;
  const corners = [{ x: e, y: h - e, ang: -Math.PI / 4 }, { x: w - e, y: e, ang: Math.PI * 0.75 }, { x: w - e, y: h - e, ang: Math.PI * -0.75 }, { x: e, y: e, ang: Math.PI / 4 }];
  map.starts = corners.slice(0, np);
  for (const s of corners) {
    const base = datan2(cy - s.y, cx - s.x), sx = s.x < cx ? 1 : -1, sy = s.y < cy ? 1 : -1;
    iceMoon(map, s.x + sx * 340, s.y - sy * 40, rng);
    oreCluster(map, s.x - sx * 30, s.y + sy * 340, rng, 3);
    pocket(map, s, 880, base + 1.55, base - 1.55, rng, [[base, 280], [base - 0.85 * sx * sy, 210]], 150);
    /* Ausbau vor der Tasche */
    iceMoon(map, s.x + sx * 1250, s.y + sy * 150, rng);
    oreCluster(map, s.x + sx * 300, s.y + sy * 1150, rng, 3);
    site(map, 'ruin', s.x + sx * 1500, s.y + sy * 300);
  }
  /* Aschewolken an den Rändern zwischen den Ecken, mit Erz dahinter */
  for (const [x, y] of [[cx, EDGE + 320], [cx, h - EDGE - 320], [EDGE + 320, cy], [w - EDGE - 320, cy]]) { nebula(map, x, y, 220, 'ash'); nebula(map, x + (y === cy ? 0 : 300), y + (y === cy ? 300 : 0), 150, 'ash'); }
  oreCluster(map, cx, EDGE + 700, rng, 2); oreCluster(map, cx, h - EDGE - 700, rng, 2);
  /* Der Kranz: Ionennebel im Ring, offen an den vier Achsen */
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; if (Math.abs(((a + Math.PI / 4) % (Math.PI / 2)) - Math.PI / 4) < 0.2) continue; nebula(map, cx + Math.cos(a) * 760, cy + Math.sin(a) * 760, 170 + rng() * 40, 'ion'); }
  /* Felsen in den Pforten: die Öffnung wird zur Engstelle */
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; wall(map, [[cx + Math.cos(a) * 700 + Math.cos(a + Math.PI / 2) * 120, cy + Math.sin(a) * 700 + Math.sin(a + Math.PI / 2) * 120], [cx + Math.cos(a) * 820 + Math.cos(a + Math.PI / 2) * 120, cy + Math.sin(a) * 820 + Math.sin(a + Math.PI / 2) * 120]], rng, null, 22); }
  /* Mitte */
  bigSites(map, [{ x: cx, y: cy }], rng, 1);
  iceMoon(map, cx + 380, cy - 380, rng, true); iceMoon(map, cx - 380, cy + 380, rng, true);
  oreCluster(map, cx - 300, cy - 300, rng, 3); oreCluster(map, cx + 300, cy + 300, rng, 3);
  gatePair(map, cx - 1500, cy, cx + 1500, cy, 'flicker');
  scatter(map, 40, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs));
}
/* The Narrows: Basen an den Enden hinter einer Felswand mit einem Tor; dahinter drei Bahnen, getrennt durch lange Gürtel:
   Norden kurz mit Aschewolken, Mitte mit der Engstelle und der Stätte, Süden lang und still mit Ionennebel und Eis */
function genNarrows(map, rng) {
  const w = map.w, h = map.h;
  const s0 = { x: 520, y: h / 2, ang: 0 };
  map.starts = [s0, Object.assign(mirror(map, s0), { ang: Math.PI })];
  const mark = { nodes: map.nodes.length, rocks: map.rocks.length, fields: map.fields.length, nebs: map.nebs.length };
  iceMoon(map, s0.x + 60, s0.y - 380, rng);
  oreCluster(map, s0.x + 60, s0.y + 380, rng, 3);
  /* Felswand mit einem Tor in der Mitte */
  wall(map, [[s0.x + 560, EDGE + 40], [s0.x + 560, h / 2 - 190]], rng);
  wall(map, [[s0.x + 560, h / 2 + 190], [s0.x + 560, h - EDGE - 40]], rng);
  /* zwei lange Gürtel trennen die Bahnen, je eine Lücke in der Mitte der Bahn */
  belt(map, [[s0.x + 800, h / 3], [w / 2, h / 3]], 160, rng, [[0.55, 200]], 0.8);
  belt(map, [[s0.x + 800, h * 2 / 3], [w / 2, h * 2 / 3]], 160, rng, [[0.55, 200]], 0.8);
  /* Norden: Aschewolken, dahinter Erz */
  cloud(map, [[s0.x + 900, EDGE + 260], [s0.x + 1300, EDGE + 300]], 220, 'ash', rng);
  oreCluster(map, s0.x + 1550, EDGE + 380, rng, 3);
  /* Mitte: Ruine und Erz vor der Engstelle */
  site(map, 'ruin', s0.x + 1150, h / 2 + 80);
  oreCluster(map, s0.x + 1450, h / 2 - 220, rng, 2);
  /* Süden: Eismond, Ionennebel */
  iceMoon(map, s0.x + 1000, h - EDGE - 380, rng);
  nebula(map, s0.x + 1400, h - EDGE - 330, 210, 'ion');
  mirrorAll(map, mark);
  /* Mitte: Engstelle aus zwei Feldern, dazwischen die Stätte; Nord und Süd mit eigenem Vorkommen */
  field(map, w / 2, h / 2 - 480, 190, rng, 1.0); field(map, w / 2, h / 2 + 480, 190, rng, 1.0);
  bigSites(map, [{ x: w / 2, y: h / 2 }], rng, 1);
  iceMoon(map, w / 2, EDGE + 330, rng, true);
  oreCluster(map, w / 2, h - EDGE - 330, rng, 3);
  gatePair(map, w / 2 - 1000, h - EDGE - 620, w / 2 + 1000, EDGE + 620, 'dead');
  scatter(map, 24, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs));
}

/* Rift Arena: 2–8 Startplätze im Ring. Jede Basis in einer Tasche (Bogen zur Mitte, offen in Richtung Mitte und zu einer
   Seite), die Rückseite schließen zwei Felswände bis zum Kartenrand. Zwischen den Nachbarn Ionennebel, vor der Mitte
   Felder, die Lanen bilden; in der Mitte die große Stätte, Eismonde und Erz. */
function genArena(map, np, rng) {
  const w = map.w, h = map.h, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) / 2 - 760, chord = 2 * R0 * Math.sin(Math.PI / Math.max(2, np));
  const Rp = Math.min(820, chord * 0.42);
  map.starts = [];
  for (let i = 0; i < np; i++) { const a = -Math.PI / 2 + i / np * TAU; map.starts.push({ x: cx + Math.cos(a) * R0, y: cy + Math.sin(a) * R0, ang: a + Math.PI }); }
  map.starts.forEach((s, i) => {
    const base = datan2(cy - s.y, cx - s.x), side = i % 2 ? 1 : -1, rot = (d, ang) => ({ x: s.x + Math.cos(ang) * d, y: s.y + Math.sin(ang) * d });
    /* Vorkommen in der Tasche */
    let p = rot(Rp * 0.42, base + 1.25); iceMoon(map, p.x, p.y, rng);
    p = rot(Rp * 0.42, base - 1.25); oreCluster(map, p.x, p.y, rng, 3);
    /* Tasche mit zwei Zugängen, Rückseite mit Felswänden bis zum Rand geschlossen */
    pocket(map, s, Rp, base + 2.0, base - 2.0, rng, [[base, 280], [base + 0.9 * side, 210]], 140);
    for (const e of [base + 2.0, base - 2.0]) { const q = rot(Rp, e), dir = datan2(q.y - cy, q.x - cx); wall(map, [[q.x, q.y], [cx + Math.cos(dir) * (Math.min(w, h) / 2 + 200), cy + Math.sin(dir) * (Math.min(w, h) / 2 + 200)]], rng); }
    /* Ausbau vor der Tasche */
    const tight = np >= 6;
    p = rot(Rp + 300, base + (tight ? 0.12 : 0.35) * side); iceMoon(map, p.x, p.y, rng);
    p = rot(Rp + 260, base - (tight ? 0.4 : 0.75) * side); oreCluster(map, p.x, p.y, rng, 2);
    p = rot(Rp + 560, base - (tight ? 0.22 : 0.1) * side); site(map, 'ruin', p.x, p.y);
    /* Ionennebel zwischen diesem Start und dem nächsten */
    const mid = -Math.PI / 2 + (i + 0.5) / np * TAU; nebula(map, cx + Math.cos(mid) * R0 * 0.92, cy + Math.sin(mid) * R0 * 0.92, np >= 5 ? 150 : 210, 'ion');
    /* Feld vor der Mitte, zwischen den Zugängen der Nachbarn (bei vielen Spielern wird es zu eng) */
    if (np <= 4) field(map, cx + Math.cos(mid) * R0 * 0.42, cy + Math.sin(mid) * R0 * 0.42, 180, rng, 1.0);
  });
  /* Mitte */
  bigSites(map, [{ x: cx, y: cy }], rng, 1);
  for (let k = 0; k < (np <= 4 ? 2 : 4); k++) { const a = Math.PI / 4 + k / (np <= 4 ? 2 : 4) * TAU; iceMoon(map, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, rng, true); }
  for (let k = 0; k < 2; k++) { const a = -Math.PI / 4 + k * Math.PI; oreCluster(map, cx + Math.cos(a) * 420, cy + Math.sin(a) * 420, rng, 3); }
  /* zwei flackernde Tore zwischen den Nebeln, gegenüber */
  const ga = -Math.PI / 2 + 0.5 / np * TAU; gatePair(map, cx + Math.cos(ga) * R0 * 0.62, cy + Math.sin(ga) * R0 * 0.62, cx - Math.cos(ga) * R0 * 0.62, cy - Math.sin(ga) * R0 * 0.62, 'flicker');
  scatter(map, 30, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs));
}

/* ---------- Ringkarten für 2–8 Spieler ----------
   Gleiche Umgebung für jeden Startplatz: Inhalt eines Sektors wird in Polarkoordinaten (Abstand zur Mitte, Winkel zur
   Achse des Spielers) beschrieben und für alle Sektoren gedreht. Die Karte wächst mit der Spielerzahl (RING_DIM).
   expanse:   offen – keine Taschen, Vorkommen verstreut, kleine Felder, Nebelflecken.
   bastions:  jede Basis hinter einem undurchdringlichen Gürtel (Felder + Felswand) mit einem schmalen Zugang zur Mitte,
              Felswände zwischen den Sektoren mit je einer Lücke, die Mitte hinter einem Felsring mit engen Pforten.
   maelstrom: Felswände von der Mitte bis zum Rand trennen die Sektoren – Nachbarn erreicht man nur durch die Mitte, wo die
              reichsten Vorkommen und die große Stätte liegen. */
function genRing(map, np, rng, style) {
  const w = map.w, cx = w / 2, cy = w / 2, half = Math.PI / np, a0 = np === 2 ? -0.75 * Math.PI : -Math.PI / 2;
  const axis = i => a0 + i * TAU / np, Rp = 580;
  /* Abstand der Basen zur Mitte: so weit draußen, dass um jede Basis ihr Rand (margin) bis zur Kante frei bleibt */
  let cmax = 0; for (let i = 0; i < np; i++) cmax = Math.max(cmax, Math.abs(Math.cos(axis(i))), Math.abs(Math.sin(axis(i))));
  const margin = style === 'bastions' ? EDGE + Rp + 110 : style === 'maelstrom' ? 700 : 620, R0 = (w / 2 - margin) / cmax;
  const P = (i, r, d) => ({ x: cx + Math.cos(axis(i) + d) * r, y: cy + Math.sin(axis(i) + d) * r });
  const each = fn => { for (let i = 0; i < np; i++) fn(i); };
  for (let i = 0; i < np; i++) { const p = P(i, R0, 0); map.starts.push({ x: p.x, y: p.y, ang: axis(i) + Math.PI }); }
  /* Seitenversatz vor Ort in Einheiten statt Winkel (gleich groß bei jeder Spielerzahl) */
  const at = (i, r, side) => P(i, r, side / Math.max(r, 1));
  const rEdge = w / 2 * 1.5;
  /* Heimvorkommen */
  each(i => { let p = at(i, R0 - 60, 330); iceMoon(map, p.x, p.y, rng); p = at(i, R0 - 60, -330); oreCluster(map, p.x, p.y, rng, 3); });
  if (style === 'expanse') {
    each(i => {
      let p = at(i, R0 * 0.62, 260); iceMoon(map, p.x, p.y, rng);
      p = at(i, R0 * 0.66, -320); oreCluster(map, p.x, p.y, rng, 3);
      p = P(i, R0 * 0.82, half); if (np <= 4) { iceMoon(map, p.x, p.y, rng); } else oreCluster(map, p.x, p.y, rng, 2);
      p = P(i, R0 * 0.55, half); site(map, 'ruin', p.x, p.y);
      p = P(i, R0 * 0.38, half * 0.5); field(map, p.x, p.y, 130, rng, 0.9);
      p = P(i, R0 * 0.9, half * 0.55); nebula(map, p.x, p.y, 150, 'ion');
    });
    bigSites(map, [{ x: cx, y: cy }], rng, 1);
    for (let k = 0; k < Math.min(np, 4); k++) { const a = a0 + (k + 0.5) / Math.min(np, 4) * TAU; oreCluster(map, cx + Math.cos(a) * 430, cy + Math.sin(a) * 430, rng, 2); }
  } else if (style === 'bastions') {
    const Rc = 560;
    each(i => {
      const s = map.starts[i], base = axis(i) + Math.PI;
      /* undurchdringlicher Ring: Gürtel plus Felswand auf derselben Linie, eine schmale Lücke zur Mitte */
      const pts = []; for (let k = 0; k <= 40; k++) { const a = base + k / 40 * TAU; pts.push([s.x + Math.cos(a) * Rp, s.y + Math.sin(a) * Rp]); }
      belt(map, pts, 140, rng, [[0, 230], [1, 230]], 0.45);
      wall(map, pts, rng, [[0, 200], [1, 200]], 24);
      /* vor dem Tor: Ausbau */
      const rOut = R0 - Rp - 260;
      let p = at(i, rOut, 330); iceMoon(map, p.x, p.y, rng);
      p = at(i, rOut - 40, -330); oreCluster(map, p.x, p.y, rng, 2);
      /* zwischen den Sektoren eine Felswand vom Mittelring bis zum Rand, mit einer Lücke auf halbem Weg */
      const b = axis(i) + half, r1 = Rc + 200, r2 = rEdge, rg = (Rc + R0) / 2 + 120;
      wall(map, [[cx + Math.cos(b) * r1, cy + Math.sin(b) * r1], [cx + Math.cos(b) * r2, cy + Math.sin(b) * r2]], rng, [[(rg - r1) / (r2 - r1), 230]], 26);
      belt(map, [[cx + Math.cos(b) * r1, cy + Math.sin(b) * r1], [cx + Math.cos(b) * Math.min(r2, R0 + 300), cy + Math.sin(b) * Math.min(r2, R0 + 300)]], 100, rng, [[(rg - r1) / (Math.min(r2, R0 + 300) - r1), 260]], 0.3);
      p = P(i, (Rc + R0 - Rp) / 2, half * 0.45); site(map, 'ruin', p.x, p.y);
      p = P(i, R0 * 0.8, half * 0.62); nebula(map, p.x, p.y, 140, 'ion');
    });
    /* Mitte hinter einem Felsring mit engen Pforten auf den Achsen */
    const pts = [], gaps = [];
    for (let k = 0; k <= 48; k++) { const a = a0 + k / 48 * TAU; pts.push([cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc]); }
    for (let i = 0; i <= np; i++) gaps.push([i / np, 200]);
    belt(map, pts, 120, rng, gaps.map(([t]) => [t, 230]), 0.45); wall(map, pts, rng, gaps, 22);
    bigSites(map, [{ x: cx, y: cy }], rng, 1);
    for (let k = 0; k < 2; k++) { const a = a0 + half + k * Math.PI; iceMoon(map, cx + Math.cos(a) * 330, cy + Math.sin(a) * 330, rng, true); }
  } else if (style === 'keep') {
    /* Piratenfestung in der Mitte hinter einem Felsring mit engen Pforten zwischen den Sektoren */
    const Rf = 780;
    each(i => {
      const s = map.starts[i], base = axis(i) + Math.PI;
      pocket(map, s, 560, base + 1.9, base - 1.9, rng, [[base + 0.5, 230], [base - 0.5, 230]], 130);
      let p = at(i, R0 * 0.66, 300); iceMoon(map, p.x, p.y, rng);
      p = at(i, R0 * 0.68, -320); oreCluster(map, p.x, p.y, rng, 3);
      p = P(i, (Rf + R0) / 2 + 80, half); site(map, 'ruin', p.x, p.y);
      p = P(i, (Rf + R0) / 2 - 60, half * 0.55); nebula(map, p.x, p.y, 130, 'ion');
      p = P(i, (Rf + R0) / 2 - 40, -half * 0.6); oreCluster(map, p.x, p.y, rng, 3);
      p = P(i, R0 * 0.9, half * 0.75); oreCluster(map, p.x, p.y, rng, 2);
    });
    /* Erz in der Schatzkammer */
    for (let k = 0; k < 2; k++) { const a = a0 + k * Math.PI + 0.3 + Math.PI / 2; oreCluster(map, cx + Math.cos(a) * 540, cy + Math.sin(a) * 540, rng, 3); }
    const pts = [], gaps = [], ng = Math.max(np, 3);
    for (let k = 0; k <= 56; k++) { const a = a0 + k / 56 * TAU; pts.push([cx + Math.cos(a) * Rf, cy + Math.sin(a) * Rf]); }
    for (let k = 0; k < ng; k++) { const t = (k + 0.5) / ng; gaps.push([t, 230]); }
    belt(map, pts, 150, rng, gaps.map(([t]) => [t, 270]), 0.5); wall(map, pts, rng, gaps, 26);
    /* Schatzkammer: zwei große Eismonde innerhalb des Rings, unter den Geschützen */
    for (let k = 0; k < 2; k++) { const a = a0 + k * Math.PI + 0.3; iceMoon(map, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, rng, true); }
    map.fort = { x: cx, y: cy, r: 330 };
  } else if (style === 'spiral') {
    /* Windrad: gekrümmte Felswände aus der Mitte, je eine Lücke auf halbem Weg; die Basis liegt am Ende ihres Arms */
    const r0 = 620, tw = r => 1.0 * ((r - r0) / (R0 - r0) - 1), Q = (i, r, d) => P(i, r, d + tw(r));
    each(i => {
      const b = half, pts = [];
      for (let r = r0; r <= rEdge; r += 90) { const p = Q(i, r, b); pts.push([p.x, p.y]); }
      const L = pathLen(pts), rg = (r0 + R0) / 2, gt = (rg - r0) / (rEdge - r0);
      wall(map, pts, rng, [[gt, 230]], 26); belt(map, pts.slice(0, Math.ceil((R0 + 300 - r0) / 90)), 120, rng, [[gt * L / pathLen(pts.slice(0, Math.ceil((R0 + 300 - r0) / 90))), 270]], 0.45);
      let p = Q(i, R0 * 0.66, 0.22 * half); iceMoon(map, p.x, p.y, rng);
      p = Q(i, R0 * 0.62, -0.3 * half); oreCluster(map, p.x, p.y, rng, 3);
      p = Q(i, R0 * 0.42, 0); oreCluster(map, p.x, p.y, rng, 2);
      p = Q(i, rg, half * 0.7); site(map, 'ruin', p.x, p.y);
      p = Q(i, R0 * 0.8, -half * 0.55); nebula(map, p.x, p.y, 120, 'ion');
    });
    bigSites(map, [{ x: cx, y: cy }], rng, 1);
    for (let k = 0; k < 2; k++) { const a = a0 + half + k * Math.PI; iceMoon(map, cx + Math.cos(a) * 380, cy + Math.sin(a) * 380, rng, true); }
  } else if (style === 'archipelago') {
    /* Inseln: Gürtelringe (für kleine Schiffe passierbar) mit zwei Durchfahrten, darin Vorkommen oder eine Ruine */
    const isle = (x, y, R, open, fill) => {
      const pts = []; for (let k = 0; k <= 28; k++) { const a = open + k / 28 * TAU; pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); }
      belt(map, pts, 110, rng, [[0, 210], [0.5, 210], [1, 210]], 0.7);
      if (fill === 'ice') iceMoon(map, x, y, rng); else if (fill === 'ore') oreCluster(map, x, y, rng, 3); else if (fill) site(map, fill, x, y);
    };
    each(i => {
      const s = map.starts[i], base = axis(i) + Math.PI;
      pocket(map, s, 580, base + 1.9, base - 1.9, rng, [[base + 0.6, 230], [base - 0.6, 230]], 120);
      let p = P(i, R0 * 0.64, half * 0.55); isle(p.x, p.y, 270, axis(i), 'ice');
      p = P(i, R0 * 0.64, -half * 0.55); isle(p.x, p.y, 270, axis(i) + 0.6, 'ore');
      p = P(i, R0 * 0.4, half); isle(p.x, p.y, 240, axis(i) + Math.PI / 2, 'ruin');
      p = P(i, R0 * 0.86, half); field(map, p.x, p.y, 120, rng, 0.8);
    });
    const ng = Math.max(np, 3), pts = [], Rc = 520;
    for (let k = 0; k <= 40; k++) { const a = a0 + k / 40 * TAU; pts.push([cx + Math.cos(a) * Rc, cy + Math.sin(a) * Rc]); }
    belt(map, pts, 120, rng, Array.from({ length: ng + 1 }, (_, k) => [k / ng, 230]), 0.7);
    bigSites(map, [{ x: cx, y: cy }], rng, 1);
    for (let k = 0; k < 2; k++) { const a = a0 + half + k * Math.PI; oreCluster(map, cx + Math.cos(a) * 320, cy + Math.sin(a) * 320, rng, 2); }
  } else if (style === 'storm') {
    /* Ionensturm: breites Nebelband um die Mitte, kleine Aschenester darin; Vorkommen davor und dahinter */
    const rs = R0 * 0.52, bw = Math.max(260, R0 * 0.26);
    each(i => {
      let p = at(i, R0 * 0.8, 380); iceMoon(map, p.x, p.y, rng);
      p = at(i, R0 * 0.82, -380); oreCluster(map, p.x, p.y, rng, 3);
      p = P(i, R0 * 0.24, half * 0.5); iceMoon(map, p.x, p.y, rng);
      p = P(i, R0 * 0.27, -half * 0.5); oreCluster(map, p.x, p.y, rng, 2);
      p = P(i, R0 * 0.82, half); site(map, 'ruin', p.x, p.y);
      p = P(i, rs, half * 0.5); nebula(map, p.x, p.y, 110, 'ash');
    });
    const n = Math.max(10, Math.round(TAU * rs / (bw * 0.75)));
    for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU; nebula(map, cx + Math.cos(a) * rs, cy + Math.sin(a) * rs, bw * (0.55 + 0.1 * Math.sin(k * 2.3)), 'ion'); }
    bigSites(map, [{ x: cx, y: cy }], rng, 1);
  } else {
    /* maelstrom */
    const rIn = Math.max(1000, R0 * 0.44);
    each(i => {
      const s = map.starts[i], base = axis(i) + Math.PI;
      /* Trennwand zum Nachbarn: von der Mitte bis zum Rand, ohne Lücke */
      const b = axis(i) + half;
      wall(map, [[cx + Math.cos(b) * rIn, cy + Math.sin(b) * rIn], [cx + Math.cos(b) * rEdge, cy + Math.sin(b) * rEdge]], rng, null, 28);
      belt(map, [[cx + Math.cos(b) * (rIn + 150), cy + Math.sin(b) * (rIn + 150)], [cx + Math.cos(b) * (R0 + 500), cy + Math.sin(b) * (R0 + 500)]], 160, rng, null, 0.6);
      /* kleine Tasche, zwei Zugänge Richtung Mitte */
      pocket(map, s, 600, base + 1.7, base - 1.7, rng, [[base + 0.55, 220], [base - 0.55, 220]], 130);
      /* auf dem Weg zur Mitte */
      let p; if (R0 - 880 >= rIn + 200) { p = at(i, R0 - 880, 0); oreCluster(map, p.x, p.y, rng, 2); }
      p = at(i, R0 * 0.62, 420); nebula(map, p.x, p.y, 130, 'ion');
      /* die reiche Mitte: je Sektor ein großer Eismond und Erz an der Grenze, Ruine vor dem Spieler */
      p = P(i, rIn * 0.62, half); iceMoon(map, p.x, p.y, rng, true);
      p = P(i, rIn * 0.42, 0); oreCluster(map, p.x, p.y, rng, 3);
    });
    /* Deckung in der Mitte: kleine Felder, nur wo kein Vorkommen ist (zweiter Durchlauf, damit alle Sektoren gleich sind) */
    const fp = [0, 1].map(k => ({ r: rIn * (k ? 0.7 : 0.92), d: half * (k ? 0.45 : 0.5) })).filter(f => { for (let i = 0; i < np; i++) { const p = P(i, f.r, f.d); if (!farFrom(map.nodes, p.x, p.y, 190)) return false; } return true; });
    for (const f of fp.slice(0, 1)) each(i => { const p = P(i, f.r, f.d); field(map, p.x, p.y, 110, rng, 0.9); });
    site(map, 'forge', cx, cy);
    if (np >= 3) each(i => { const p = P(i, rIn * 0.78, 0); if (i % 2 === 0 || np % 2) site(map, 'ruin', p.x, p.y); });
  }
  /* Streufelsen, für alle Sektoren gleich */
  const avoid = map.starts.concat(map.nodes, map.fields, map.sites, map.gates, map.nebs, map.fort ? [{ x: map.fort.x, y: map.fort.y, r: 800 }] : []), n = style === 'expanse' ? 6 : 3;
  for (let k = 0, t = 0; k < n && t < 200; t++) {
    const r = 500 + rng() * (R0 + 300 - 500), d = (rng() * 2 - 1) * half * 0.9, rr = 10 + rng() * 14;
    const ps = []; for (let i = 0; i < np; i++) ps.push(P(i, r, d));
    if (!ps.every(p => p.x > EDGE + 80 && p.y > EDGE + 80 && p.x < w - EDGE - 80 && p.y < w - EDGE - 80 && farFrom(avoid, p.x, p.y, 260) && farFrom(map.rocks, p.x, p.y, 40))) continue;
    for (const p of ps) map.rocks.push({ x: p.x, y: p.y, r: rr, ang: rng() * TAU, seed: (rng() * 1e6) | 0 });
    k++;
  }
  map.rocks = map.rocks.filter(o => o.x > -40 && o.y > -40 && o.x < w + 40 && o.y < w + 40);
  map.fields = map.fields.filter(o => o.x > -o.r && o.y > -o.r && o.x < w + o.r && o.y < w + o.r);
}

/* ---------- Navigationsraster ----------
   Drei Raster (klein, mittel, groß). Zelle blockiert: Fels (mit Rand nach Klasse), Ressourcenfeld, Rand, dichtes Feld
   (nur mittel und groß). Gebäude werden zur Laufzeit eingetragen (navBlock). */
function buildNav(map) {
  const gw = Math.ceil(map.w / NAV), gh = Math.ceil(map.h / NAV);
  map.gw = gw; map.gh = gh;
  map.nav = [new Uint8Array(gw * gh), new Uint8Array(gw * gh), new Uint8Array(gw * gh)];
  map.fieldG = new Uint8Array(gw * gh); map.nebG = new Uint8Array(gw * gh);
  const pad = [10, 22, 32];
  const stamp = (o, extra, cls, val) => {
    const r = o.r + extra, x0 = Math.max(0, ((o.x - r) / NAV) | 0), x1 = Math.min(gw - 1, ((o.x + r) / NAV) | 0), y0 = Math.max(0, ((o.y - r) / NAV) | 0), y1 = Math.min(gh - 1, ((o.y + r) / NAV) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const dx = (cx + 0.5) * NAV - o.x, dy = (cy + 0.5) * NAV - o.y;
      if (dx * dx + dy * dy <= r * r) map.nav[cls][cy * gw + cx] |= val;
    }
  };
  for (let c = 0; c < 3; c++) {
    for (const o of map.rocks) stamp(o, pad[c], c, 1);
    for (const o of map.nodes) stamp(o, pad[c] + 4, c, 8);
    for (const o of map.sites) stamp(o, pad[c] + 4, c, 8);
    if (c > 0) for (const o of map.fields) stamp(o, 0, c, 1);
    const nav = map.nav[c], m = Math.max(1, Math.round((EDGE - 30) / NAV));
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) if (cx < m || cy < m || cx >= gw - m || cy >= gh - m) nav[cy * gw + cx] |= 4;
  }
  for (const o of map.fields) {
    const x0 = Math.max(0, ((o.x - o.r) / NAV) | 0), x1 = Math.min(gw - 1, ((o.x + o.r) / NAV) | 0), y0 = Math.max(0, ((o.y - o.r) / NAV) | 0), y1 = Math.min(gh - 1, ((o.y + o.r) / NAV) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const dx = (cx + 0.5) * NAV - o.x, dy = (cy + 0.5) * NAV - o.y; if (dx * dx + dy * dy <= o.r * o.r) map.fieldG[cy * gw + cx] = 1; }
  }
  /* Piratenfestung: Gefahrenzone (Bit 32) – die Wegsuche führt außen herum, solange das Ziel nicht in der Festung liegt */
  if (map.fort) for (let c = 0; c < 3; c++) stamp({ x: map.fort.x, y: map.fort.y, r: map.fort.r + 400 }, 0, c, 32);
  /* Nebel: 1 Ionennebel, 2 Aschewolke; Aschewolken kosten in der Wegsuche wie der Rand (Bit 4), Ionennebel etwas (Bit 16) */
  for (const o of map.nebs || []) {
    const v = o.kind === 'ash' ? 2 : 1, x0 = Math.max(0, ((o.x - o.r) / NAV) | 0), x1 = Math.min(gw - 1, ((o.x + o.r) / NAV) | 0), y0 = Math.max(0, ((o.y - o.r) / NAV) | 0), y1 = Math.min(gh - 1, ((o.y + o.r) / NAV) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const dx = (cx + 0.5) * NAV - o.x, dy = (cy + 0.5) * NAV - o.y; if (dx * dx + dy * dy <= o.r * o.r) { const i = cy * gw + cx; map.nebG[i] = Math.max(map.nebG[i], v); for (let c = 0; c < 3; c++) map.nav[c][i] |= v === 2 ? 4 : 16; } }
  }
}
/* Gebäude ins Raster eintragen (val 2) oder austragen; mit Rand, damit Schiffe nicht an der Hülle entlangschaben */
function navBlock(map, x, y, r, on) {
  const gw = map.gw, gh = map.gh;
  for (let c = 0; c < 3; c++) {
    const rr = r + [8, 18, 28][c], x0 = Math.max(0, ((x - rr) / NAV) | 0), x1 = Math.min(gw - 1, ((x + rr) / NAV) | 0), y0 = Math.max(0, ((y - rr) / NAV) | 0), y1 = Math.min(gh - 1, ((y + rr) / NAV) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const dx = (cx + 0.5) * NAV - x, dy = (cy + 0.5) * NAV - y;
      if (dx * dx + dy * dy <= rr * rr) { if (on) map.nav[c][cy * gw + cx] |= 2; else map.nav[c][cy * gw + cx] &= ~2; }
    }
  }
}
function inField(map, x, y) { const cx = (x / NAV) | 0, cy = (y / NAV) | 0; return cx >= 0 && cy >= 0 && cx < map.gw && cy < map.gh && map.fieldG[cy * map.gw + cx] === 1; }
function nebAt(map, x, y) { const cx = (x / NAV) | 0, cy = (y / NAV) | 0; return cx >= 0 && cy >= 0 && cx < map.gw && cy < map.gh ? map.nebG[cy * map.gw + cx] : 0; }
function inAsh(map, x, y) { return x < EDGE || y < EDGE || x > map.w - EDGE || y > map.h - EDGE || nebAt(map, x, y) === 2; }
function inIon(map, x, y) { return nebAt(map, x, y) === 1; }
const ION_SEE = 150;                         // Sichtweite im und in den Ionennebel hinein
const NAV_BLOCK = 1 | 2 | 8;                 // Fels, Station, Vorkommen
function navFree(map, cls, x, y) { const cx = (x / NAV) | 0, cy = (y / NAV) | 0; return cx >= 0 && cy >= 0 && cx < map.gw && cy < map.gh && map.nav[cls][cy * map.gw + cx] === 0; }
/* Rand (Aschenebel) zählt für die Wegsuche nicht als Sperre, sondern als teure Zelle: Wer dorthin geschickt wird, fliegt
   hin; die Suche umgeht ihn aber. Felsen und Gebäude (1, 2) sperren. */
function navCost(nav, fieldG, i, cls) { const v = nav[i]; if (v & NAV_BLOCK) return 0; let c = 1; if (v & 4) c += 6; if (v & 16) c += 0.8; if (v & 32) c += 8; if (cls === 0 && fieldG[i]) c += 1.2; return c; }

/* Nächste freie Zelle um ein Ziel (Spirale), damit ein Befehl auf einen Felsen trotzdem ein Ziel findet */
function nearestFree(map, cls, cx, cy) {
  const gw = map.gw, gh = map.gh, nav = map.nav[cls];
  cx = clamp(cx, 0, gw - 1); cy = clamp(cy, 0, gh - 1);
  if (!(nav[cy * gw + cx] & NAV_BLOCK)) return cy * gw + cx;
  /* keine eingeschlossene Einzelzelle (z. B. zwischen Basis und Vorkommen) wählen: mindestens zwei freie Nachbarn */
  const free = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && !(nav[y * gw + x] & NAV_BLOCK);
  const openN = (x, y) => free(x + 1, y) + free(x - 1, y) + free(x, y + 1) + free(x, y - 1);
  for (let r = 1; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      if (!(nav[y * gw + x] & NAV_BLOCK) && openN(x, y) >= 2) return y * gw + x;
    }
  }
  return -1;
}
/* Sichtlinie im Raster (für das Glätten der Wege) */
/* soft: nur Felsen sperren (Bit 1), nicht Stationen und Vorkommen-Ränder (Bit 2) – für den Endanflug an eine Station */
/* Fassung 22: tm (Team des Schiffs, sonst −1) – feindliche Schildwälle (map.wallG, Team + 1) sperren wie Felsen */
function wallBlk(wg, i, tm) { const w = wg[i]; return w !== 0 && w !== tm + 1; }
function navLos(map, cls, x0, y0, x1, y1, soft, tm) {
  const wg = tm >= 0 && map.wallG ? map.wallG : null;
  /* soft: Stationen und Vorkommen dürfen nur in den letzten zwei Zellen vor dem Ziel im Weg liegen (Rand des
     Ziels selbst); sonst würde der Endanflug zwischen fremden Stationen hindurch zielen und sich verkeilen */
  const nav = map.nav[cls], gw = map.gw, fg = map.fieldG;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    const v = nav[y0 * gw + x0];
    if (v & 1) return false;
    if (!soft && (v & NAV_BLOCK)) return false;
    if (soft && (v & NAV_BLOCK) && Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) > 2) return false;
    if (cls === 0 && fg[y0 * gw + x0]) return false;           // durch ein Feld nicht abkürzen (die Suche hat es umgangen)
    if (wg && wallBlk(wg, y0 * gw + x0, tm)) return false;
    if (v & 4) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
const _nvG = new Float32Array(0), NAV_WORK = { g: null, from: null, closed: null, stamp: 0, size: 0 };
/* A*-Wegsuche im Raster der Klasse cls von (x0,y0) nach (x1,y1), Weltkoordinaten. Liefert Wegpunkte (Welt) oder null.
   Das Ziel darf blockiert sein (nächste freie Zelle). Begrenzt auf 9000 ausgewertete Zellen. */
function findPath(map, cls, x0, y0, x1, y1, tm) {
  const gw = map.gw, gh = map.gh, N = gw * gh, nav = map.nav[cls], fg = map.fieldG, wg = tm >= 0 && map.wallG ? map.wallG : null;
  const Wk = NAV_WORK;
  if (Wk.size !== N) { Wk.g = new Float32Array(N); Wk.from = new Int32Array(N); Wk.closed = new Int32Array(N); Wk.size = N; Wk.stamp = 0; }
  const stamp = ++Wk.stamp, g = Wk.g, from = Wk.from, closed = Wk.closed;
  let sc = nearestFree(map, cls, (x0 / NAV) | 0, (y0 / NAV) | 0), tc = nearestFree(map, cls, (x1 / NAV) | 0, (y1 / NAV) | 0);
  if (sc < 0 || tc < 0) return null;
  const tx = tc % gw, ty = (tc / gw) | 0;
  if (sc === tc) return [{ x: x1, y: y1 }];
  const open = new Heap();
  const h = i => { const x = i % gw, y = (i / gw) | 0, dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx > dy ? dx + 0.41 * dy : dy + 0.41 * dx); };
  g[sc] = 0; from[sc] = -1; closed[sc] = 0;
  open.push(h(sc), sc);
  const seen = new Map(); seen.set(sc, 0);
  let found = false, n = 0, best = sc, bestH = h(sc);
  while (open.size && n < 9000) {
    const cur = open.pop();
    if (closed[cur] === stamp) continue;
    closed[cur] = stamp; n++;
    if (cur === tc) { found = true; break; }
    const hc = h(cur); if (hc < bestH) { bestH = hc; best = cur; }
    const cx = cur % gw, cy = (cur / gw) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + [1, -1, 0, 0, 1, 1, -1, -1][d], ny = cy + [0, 0, 1, -1, 1, -1, 1, -1][d];
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (closed[ni] === stamp) continue;
      const c = navCost(nav, fg, ni, cls);
      if (!c) continue;
      if (wg && (wallBlk(wg, ni, tm) || (d >= 4 && (wallBlk(wg, cy * gw + nx, tm) || wallBlk(wg, ny * gw + cx, tm))))) continue;
      /* diagonal nicht an Ecken vorbeischneiden */
      if (d >= 4 && ((nav[cy * gw + nx] & NAV_BLOCK) || (nav[ny * gw + cx] & NAV_BLOCK))) continue;
      const ng = seen.get(cur) + c * (d >= 4 ? 1.4142 : 1);
      const old = seen.get(ni);
      if (old !== undefined && old <= ng) continue;
      seen.set(ni, ng); from[ni] = cur;
      open.push(ng + h(ni), ni);
    }
  }
  const end = found ? tc : best;
  if (end === sc) return null;
  /* Zellen zurückverfolgen, dann glätten (Sichtlinie) */
  const cells = [];
  for (let i = end; i !== -1 && cells.length < 4000; i = (i === sc ? -1 : from[i])) cells.push(i);
  cells.reverse();
  const out = [];
  let k = 0;
  while (k < cells.length - 1) {
    let j = cells.length - 1;
    const ax = cells[k] % gw, ay = (cells[k] / gw) | 0;
    while (j > k + 1 && !navLos(map, cls, ax, ay, cells[j] % gw, (cells[j] / gw) | 0, false, wg ? tm : -1)) j--;
    out.push({ x: (cells[j] % gw + 0.5) * NAV, y: (((cells[j] / gw) | 0) + 0.5) * NAV });
    k = j;
  }
  if (found) { out[out.length - 1] = { x: x1, y: y1 }; }
  return out.length ? out : null;
}
