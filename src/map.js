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
const NODE_ICE = 9000, NODE_ORE = 4200;

const MAPS = {
  haven: { name: "Haven's Reach", np: [2], w: 3200, h: 3200, desc: 'Zwei Ecktaschen mit je zwei Zugängen, ein Eismond in der Mitte, eine Stätte und ein flackerndes Tor. Für den Einstieg.' },
  twingates: { name: 'Twin Gates', np: [2], w: 3800, h: 2600, desc: 'Jede Basis in einer Tasche mit einem Zugang, dazwischen Nebelwände. Zwei Tore verbinden die Hinterhöfe.' },
  ashfall: { name: 'Ashfall Corridor', np: [2, 3, 4], w: 4400, h: 2600, desc: 'Langer Korridor, Engstellen aus Asteroiden mit einer Aschewolke in der Lücke, eine Stätte in der Mitte.' },
  shattered: { name: 'Shattered Moon', np: [2, 4], w: 4400, h: 4400, desc: 'Ein zerbrochener Mond als Trümmerring um die große Stätte, Ecktaschen für die Basen, Ionennebel in den Trümmern.' },
  crown: { name: 'Nebula Crown', np: [2, 3, 4], w: 4000, h: 4000, desc: 'Ein Kranz aus Ionennebel um die Mitte, vier offene Pforten. Die Basen sitzen in Ecktaschen mit zwei Zugängen.' },
  narrows: { name: 'The Narrows', np: [2], w: 4600, h: 2400, desc: 'Drei Bahnen zwischen den Basen: kurz durch Aschewolken, mittig durch die Engstelle mit der Stätte, lang und still über den Süden.' },
  quarantine: { name: 'Quarantine Line', np: [1, 2, 3, 4], w: 3800, h: 3800, desc: 'Das Siegel in der Mitte, die Basen im Ring darum, Risse am Rand. Nur für Wellen.', waves: true }
};
const MAP_ORDER = ['haven', 'twingates', 'ashfall', 'shattered', 'crown', 'narrows'];
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

function mapFor(id, np) {
  const m = MAPS[id] || MAPS.haven;
  return m.np.indexOf(np) >= 0 ? id : MAP_ORDER.find(k => MAPS[k].np.indexOf(np) >= 0) || 'haven';
}

/* Hilfen beim Aufbau: Punktspiegelung und Abstandsprüfung */
function mirror(map, p) { return { x: map.w - p.x, y: map.h - p.y }; }
function farFrom(list, x, y, d) { for (const o of list) if (hyp(o.x - x, o.y - y) < d + (o.r || 0)) return false; return true; }

/* ---------- Generator ---------- */
function generateMap(id, np, seed) {
  const def = MAPS[id] || MAPS.haven, rng = makeRng((seed || 1) * 2654435761 + hashStr(id));
  const map = { id, name: def.name, w: def.w, h: def.h, np, starts: [], nodes: [], rocks: [], fields: [], nebs: [], sites: [], gates: [], seed };
  if (id === 'ashfall') genAshfall(map, np, rng);
  else if (id === 'crown') genCrown(map, np, rng);
  else if (id === 'narrows') genNarrows(map, rng);
  else if (id === 'twingates') genTwinGates(map, rng);
  else if (id === 'shattered') genShattered(map, np, rng);
  else if (id === 'quarantine') genQuarantine(map, np, rng);
  else if (id === 'test') { map.starts = [{ x: 400, y: 2800, ang: -Math.PI / 4 }, { x: 2800, y: 400, ang: Math.PI * 0.75 }]; iceMoon(map, 700, 2800, rng); iceMoon(map, 2500, 400, rng); site(map, 'ruin', 1200, 1200); site(map, 'ruin', 2000, 2000); site(map, 'archive', 1000, 2200); site(map, 'citadel', 2200, 1300); gatePair(map, 900, 600, 2600, 2600, 'dead'); }
  else genHaven(map, rng);
  buildNav(map);
  return map;
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
function navCost(nav, fieldG, i, cls) { const v = nav[i]; if (v & NAV_BLOCK) return 0; let c = 1; if (v & 4) c += 6; if (v & 16) c += 0.8; if (cls === 0 && fieldG[i]) c += 1.2; return c; }

/* Nächste freie Zelle um ein Ziel (Spirale), damit ein Befehl auf einen Felsen trotzdem ein Ziel findet */
function nearestFree(map, cls, cx, cy) {
  const gw = map.gw, gh = map.gh, nav = map.nav[cls];
  cx = clamp(cx, 0, gw - 1); cy = clamp(cy, 0, gh - 1);
  if (!(nav[cy * gw + cx] & NAV_BLOCK)) return cy * gw + cx;
  for (let r = 1; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      if (!(nav[y * gw + x] & NAV_BLOCK)) return y * gw + x;
    }
  }
  return -1;
}
/* Sichtlinie im Raster (für das Glätten der Wege) */
/* soft: nur Felsen sperren (Bit 1), nicht Stationen und Vorkommen-Ränder (Bit 2) – für den Endanflug an eine Station */
function navLos(map, cls, x0, y0, x1, y1, soft) {
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
function findPath(map, cls, x0, y0, x1, y1) {
  const gw = map.gw, gh = map.gh, N = gw * gh, nav = map.nav[cls], fg = map.fieldG;
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
    while (j > k + 1 && !navLos(map, cls, ax, ay, cells[j] % gw, (cells[j] / gw) | 0)) j--;
    out.push({ x: (cells[j] % gw + 0.5) * NAV, y: (((cells[j] / gw) | 0) + 0.5) * NAV });
    k = j;
  }
  if (found) { out[out.length - 1] = { x: x1, y: y1 }; }
  return out.length ? out : null;
}
