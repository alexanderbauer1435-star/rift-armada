/* ===== editor.js ===== */
'use strict';
/* =====================================================================
   KARTENEDITOR – eigene Karten für Gefecht und Mehrspieler. Das Layout (Format siehe genCustom in map.js) ist reine Daten
   in Karteneinheiten; die Karte entsteht daraus mit dem Gelände-Baukasten aus map.js. Werkzeuge: Startplätze, Eismond,
   Erz, Asteroidengürtel (Linie, nur für kleine Schiffe passierbar), Felswand (Linie, undurchdringlich), Ionennebel,
   Aschewolke, Ruine, große Stätte (Art per Zufall der Partie), Sprungtorpaar, Piratenfestung (höchstens eine). Symmetrie:
   jede Platzierung wird für N Spieler um die Mitte gedreht. Rückgängig, Leeren, Verschieben und Zoomen mit zwei Fingern.
   Laufende Prüfung (edCheck): Erreichbarkeit aller Starts für alle drei Größenklassen (Flutfüllung auf dem Wegsuchraster),
   kein Start in Fels, Gürtel oder Nebel, genug Bauplatz (wie tests/maps.js). Bis zu zehn Karten im Gerät (ra.maps),
   Austausch als Text-Code (RA1: + base64 von kompaktem JSON, Koordinaten in Zehnern).
   Gespeicherte Karten stehen als MAPS['cu_…'] in der Kartenwahl; die Partie trägt das Layout in opts.custom – so bauen
   Spielstand und Mitspieler im Mehrspieler dieselbe Karte nach, auch wenn die Karte dort nicht gespeichert ist.
   ===================================================================== */
const ED_PFX = 'RA' + '1:', ED_KEY = 'ra.maps', ED_DRAFT = 'ra.mapDraft', ED_MAX = 10, ED_KEYS = ['st', 'ice', 'ore', 'bl', 'wl', 'ion', 'ash', 'ru', 'gs', 'gt'];
const ED_ARITY = { st: 2, ice: 3, ore: 2, bl: 4, wl: 4, ion: 3, ash: 3, ru: 2, gs: 2, gt: 4 };
const ED_SIZES = [3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000];
/* Werkzeuge: Kennung, Beschriftung, Farbe, Art (p: Punkt, l: Linie, c: Kreis), Hinweis */
const ED_TOOLS = [
  ['st', 'Start', '#4fa3ff', 'p', 'Tippen setzt einen Startplatz.'],
  ['ice', 'Eismond', '#9fd8ff', 'p', 'Tippen setzt einen Eismond, Tippen auf einen Eismond macht ihn groß oder klein.'],
  ['ore', 'Erz', '#d49a5a', 'p', 'Tippen setzt eine Gruppe Erzasteroiden.'],
  ['bl', 'Gürtel', '#8c8276', 'l', 'Ziehen legt einen Asteroidengürtel: kleine Schiffe kommen langsam durch, mittlere und große nicht.'],
  ['wl', 'Felswand', '#6c655d', 'l', 'Ziehen legt eine Felswand – für niemanden passierbar.'],
  ['ion', 'Ionennebel', '#7a6eff', 'c', 'Tippen oder Ziehen (Radius): Schilde aus, Sicht nur aus der Nähe.'],
  ['ash', 'Aschewolke', '#ff5a3c', 'c', 'Tippen oder Ziehen (Radius): beschädigt die Hülle.'],
  ['ru', 'Ruine', '#9ff0c0', 'p', 'Tippen setzt eine Erbauer-Ruine (nicht näher als 760 an einem Start).'],
  ['gs', 'Große Stätte', '#ffffff', 'p', 'Tippen setzt eine große Stätte – welche, entscheidet jede Partie neu.'],
  ['gt', 'Sprungtore', '#7fe0a8', 'l', 'Ziehen von einem Tor zum anderen setzt ein Torpaar.'],
  ['ft', 'Festung', '#c8324a', 'p', 'Tippen setzt die Piratenfestung (nur eine, am besten in der Mitte).'],
  ['del', 'Entfernen', '#ff5b47', 'p', 'Tippen entfernt das nächste Element (mit Symmetrie auch seine Gegenstücke).']
];
const ED = { L: null, id: null, tool: 'st', sym: true, hist: [], view: null, ptrs: new Map(), drag: null, pinch: null, map: null, probs: [], chkT: 0, open: false, built: false, paused: false, dirty: false, peer: {} };

/* ---------- Layout: Prüfen, Kodieren, Speichern ---------- */
/* Fremdes oder altes Layout auf das Format bringen (begrenzt, ganze Zahlen); null, wenn es keins ist */
function edNorm(L) {
  if (!L || typeof L !== 'object' || Array.isArray(L)) return null;
  const s = clamp(Math.round(+L.s) || 5000, 3000, 7000), np = clamp(Math.round(+L.np) || 2, 2, 8);
  const o = { v: 1, n: typeof L.n === 'string' ? L.n.trim().slice(0, 32) : '', s, np, ft: 0 };
  const num = (v, i, key) => { v = +v; if (!Number.isFinite(v)) return null; if (key === 'ice' && i === 2) return v ? 1 : 0; if ((key === 'ion' || key === 'ash') && i === 2) return clamp(Math.round(v), 80, 700); return clamp(Math.round(v), 0, s); };
  for (const k of ED_KEYS) {
    o[k] = [];
    for (const t of Array.isArray(L[k]) ? L[k].slice(0, CUSTOM_MAX) : []) {
      if (!Array.isArray(t)) continue;
      const a = []; for (let i = 0; i < ED_ARITY[k]; i++) { const v = num(t[i] === undefined && (k === 'ice' || k === 'ion' || k === 'ash') && i === 2 ? (k === 'ice' ? 0 : 220) : t[i], i, k); if (v === null) break; a.push(v); }
      if (a.length === ED_ARITY[k]) o[k].push(a);
    }
  }
  o.st = o.st.slice(0, 8); o.gt = o.gt.slice(0, 8);
  if (Array.isArray(L.ft) && L.ft.length >= 2 && Number.isFinite(+L.ft[0]) && Number.isFinite(+L.ft[1])) o.ft = [clamp(Math.round(+L.ft[0]), 0, s), clamp(Math.round(+L.ft[1]), 0, s)];
  return o;
}
/* Text-Code: RA1: + base64 von JSON, alle Koordinaten und Radien durch 10 (Eismond-Größe bleibt 0/1) */
function edEncode(L) {
  L = edNorm(L); const q = v => Math.round(v / 10), o = { n: L.n, s: q(L.s), np: L.np };
  for (const k of ED_KEYS) if (L[k].length) o[k] = L[k].map(t => t.map((v, i) => k === 'ice' && i === 2 ? v : q(v)));
  if (L.ft) o.ft = L.ft.map(q);
  const json = JSON.stringify(o);
  return ED_PFX + btoa(unescape(encodeURIComponent(json)));
}
function edDecode(code) {
  try {
    let c = String(code || '').replace(/\s+/g, ''); if (/^RA1:/i.test(c)) c = c.slice(4);
    const o = JSON.parse(decodeURIComponent(escape(atob(c)))); if (!o || typeof o !== 'object') return null;
    const m = v => +v * 10, L = { n: o.n, s: m(o.s), np: o.np, ft: Array.isArray(o.ft) ? o.ft.map(m) : 0 };
    for (const k of ED_KEYS) L[k] = Array.isArray(o[k]) ? o[k].map(t => Array.isArray(t) ? t.map((v, i) => k === 'ice' && i === 2 ? v : m(v)) : null) : [];
    return edNorm(L);
  } catch (e) { return null; }
}
function edList() { try { const d = JSON.parse(localStorage.getItem(ED_KEY) || '[]'); return Array.isArray(d) ? d.filter(x => x && typeof x.id === 'string' && /^cu_[a-z0-9]+$/.test(x.id) && edNorm(x.L)).slice(0, ED_MAX) : []; } catch (e) { return []; } }
function edStore(list) { try { localStorage.setItem(ED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
/* Kartenwahl: gespeicherte (und vom Mitspieler empfangene) Karten als MAPS-Einträge */
function edRegister(L, id) {
  L = edNorm(L); if (!L || typeof id !== 'string' || !/^cu_[a-z0-9]{1,16}$/.test(id)) return null;
  MAPS[id] = { name: L.n || 'Eigene Karte', np: [L.np], w: L.s, h: L.s, desc: 'Eigene Karte aus dem Karteneditor.', hidden: true, layout: L, user: 1 };
  return id;
}
function edRegisterAll() {
  for (const k of Object.keys(MAPS)) if (MAPS[k].user && !ED.peer[k]) delete MAPS[k];
  for (const x of edList()) edRegister(x.L, x.id);
  if (typeof MENU !== 'undefined' && typeof MENU.map === 'string' && /^cu_/.test(MENU.map) && !MAPS[MENU.map]) MENU.map = 'haven';
}
/* Kennungen der eigenen Karten in Speicherreihenfolge (für die Kartenwahl im Gefecht und im Mehrspieler) */
function edMapIds(np) { return Object.keys(MAPS).filter(k => MAPS[k].user && (!np || MAPS[k].np.indexOf(np) >= 0)); }
function edLayoutOf(id) { return MAPS[id] && MAPS[id].layout ? MAPS[id].layout : undefined; }
/* Karte vom Mitspieler (Mehrspieler-Lobby): nur für diese Sitzung eintragen */
function edPeerMap(id, L) { if (!L || MAPS[id] && MAPS[id].user && !ED.peer[id]) return; if (edRegister(L, id)) ED.peer[id] = 1; }

/* ---------- Prüfung ---------- */
/* Flutfüllung auf dem Wegsuchraster einer Größenklasse ab einer Zelle (dieselben Regeln wie findPath) */
function edReach(map, cls, x, y) {
  const gw = map.gw, gh = map.gh, nav = map.nav[cls], seen = new Uint8Array(gw * gh), sc = nearestFree(map, cls, (x / NAV) | 0, (y / NAV) | 0);
  if (sc < 0) return seen;
  const q = [sc]; seen[sc] = 1;
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (q.length) {
    const cur = q.pop(), cx = cur % gw, cy = (cur / gw) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx; if (seen[ni] || !navCost(nav, map.fieldG, ni, cls)) continue;
      if (d >= 4 && ((nav[cy * gw + nx] & NAV_BLOCK) || (nav[ny * gw + cx] & NAV_BLOCK))) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return seen;
}
function edReached(map, cls, seen, x, y) { const c = nearestFree(map, cls, (x / NAV) | 0, (y / NAV) | 0); return c >= 0 && seen[c] === 1; }
/* Liste der Probleme: { m: Text oder [Vorlage, …], x, y } (x < 0: ohne Ort). Prüft wie tests/maps.js, dazu jeden Start. */
function edCheck(L0) {
  const L = edNorm(L0), out = [], add = (m, p) => out.push({ m, x: p ? p.x : -1, y: p ? p.y : -1 });
  if (!L) return [{ m: 'Kein gültiges Layout', x: -1, y: -1 }];
  const n = L.st.length;
  if (n !== L.np) add(['Startplätze: {0} von {1} gesetzt', n, L.np]);
  if (n < 2) return out;
  let g;
  try { g = createGame({ map: 'custom', custom: L, seed: 7, players: L.st.map((_, i) => ({ faction: 'alliance', human: i === 0, ai: 0, team: 10 + i })) }); } catch (e) { add('Karte lässt sich nicht bauen'); return out; }
  const map = g.map, CLS = ['Start {0} ist für kleine Schiffe nicht erreichbar', 'Start {0} ist für mittlere Schiffe nicht erreichbar', 'Start {0} ist für große Schiffe nicht erreichbar'];
  map.starts.forEach((s, i) => {
    if (nebAt(map, s.x, s.y) || inField(map, s.x, s.y)) add(['Start {0} liegt in Gürtel oder Nebel', i + 1], s);
    else if (map.rocks.some(r => hyp(r.x - s.x, r.y - s.y) < r.r + 120)) add(['Fels zu nahe an Start {0}', i + 1], s);
    else if (map.nebs.some(o => hyp(o.x - s.x, o.y - s.y) < o.r + 300)) add(['Nebel zu nahe an Start {0}', i + 1], s);
    for (let j = 0; j < i; j++) if (hyp(map.starts[j].x - s.x, map.starts[j].y - s.y) < 900) { add(['Start {0} und {1} liegen zu nahe beieinander', j + 1, i + 1], s); break; }
    let free = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; if (!canPlace(g, i, 'yard', s.x + Math.cos(a) * 170, s.y + Math.sin(a) * 170)) free++; }
    if (free < 6) add(['Zu wenig Bauplatz an Start {0} ({1}/16)', i + 1, free], s);
    if (!map.nodes.some(o => o.kind === 'ice' && hyp(o.x - s.x, o.y - s.y) < 1300)) add(['Kein Eis nahe Start {0}', i + 1], s);
  });
  for (let c = 0; c < 3; c++) {
    const a = map.starts[0], seen = edReach(map, c, a.x, a.y);
    for (let j = 1; j < n; j++) { const b = map.starts[j]; if (!edReached(map, c, seen, b.x, b.y)) add([CLS[c], j + 1], b); }
  }
  for (const o of map.nodes) if (inField(map, o.x, o.y) || nebAt(map, o.x, o.y)) add('Vorkommen in Gürtel oder Nebel', o);
  for (const o of map.sites) if (nebAt(map, o.x, o.y) || map.rocks.some(r => hyp(r.x - o.x, r.y - o.y) < r.r + o.r * 0.8)) add('Stätte in Nebel oder Fels', o);
  for (const p of L.ru.concat(L.gs)) if (map.starts.some(s => hyp(s.x - p[0], s.y - p[1]) < 760)) add('Stätte zu nahe an einem Start – entfällt', { x: p[0], y: p[1] });
  if (map.fort && map.starts.some(s => hyp(s.x - map.fort.x, s.y - map.fort.y) < 1500)) add('Festung zu nahe an einem Start', map.fort);
  if (map.fort) for (const o of map.sites.concat(map.gates)) if (hyp(o.x - map.fort.x, o.y - map.fort.y) < map.fort.r + 400 + o.r) add('Stätte oder Tor in der Festung', o);
  return out;
}

/* ---------- Bearbeiten ---------- */
function edSnap() { return JSON.stringify(ED.L); }
function edPush() { ED.hist.push(edSnap()); if (ED.hist.length > 60) ED.hist.shift(); ED.dirty = true; }
function edEmpty(np, s, n) { const L = { v: 1, n: n || '', s, np, ft: 0 }; for (const k of ED_KEYS) L[k] = []; return L; }
/* Punkt um die Kartenmitte drehen (k-te Kopie bei N Spielern), auf die Karte begrenzt */
function edRot(x, y, k) {
  const s = ED.L.s, c = s / 2, a = k * TAU / ED.L.np, ca = Math.cos(a), sa = Math.sin(a);
  return [clamp(Math.round(c + (x - c) * ca - (y - c) * sa), EDGE, s - EDGE), clamp(Math.round(c + (x - c) * sa + (y - c) * ca), EDGE, s - EDGE)];
}
function edCopies(key, t) {
  const n = ED.sym ? ED.L.np : 1, out = [];
  for (let k = 0; k < n; k++) {
    const a = edRot(t[0], t[1], k);
    if (ED_ARITY[key] === 4) out.push(a.concat(edRot(t[2], t[3], k)));
    else if (ED_ARITY[key] === 3) out.push(a.concat(t[2]));
    else out.push(a);
  }
  /* Kopien, die auf einen Punkt fallen (Mitte), nur einmal */
  return out.filter((q, i) => out.findIndex(r => hyp(r[0] - q[0], r[1] - q[1]) < 30 && (q.length < 4 || hyp(r[2] - q[2], r[3] - q[3]) < 30)) === i);
}
function edMsg(t, cls) { const el = $('edHint'); if (!el) return; el.textContent = t; el.className = cls || ''; }
function edPlace(key, t) {
  const L = ED.L;
  if (key === 'ft') { edPush(); L.ft = [t[0], t[1]]; return edChanged(); }
  let add = edCopies(key, t);
  if (key === 'st') {
    if (L.st.length >= L.np) { edMsg(L_('Alle {0} Startplätze sind gesetzt – erst einen entfernen oder die Spielerzahl erhöhen.', L.np), 'warn'); return; }
    if (L.st.length + add.length > L.np) add = add.slice(0, 1);
  }
  edPush();
  for (const q of add) L[key].push(q);
  edChanged();
}
/* Abstand eines Punkts zu einer Strecke */
function edSeg(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy, k = l ? clamp(((px - x0) * dx + (py - y0) * dy) / l, 0, 1) : 0; return hyp(px - x0 - dx * k, py - y0 - dy * k); }
function edDist(key, t, x, y) {
  if (ED_ARITY[key] === 4) return key === 'gt' ? Math.min(hyp(t[0] - x, t[1] - y), hyp(t[2] - x, t[3] - y)) : edSeg(x, y, t[0], t[1], t[2], t[3]);
  const d = hyp(t[0] - x, t[1] - y);
  return key === 'ion' || key === 'ash' ? Math.max(0, d - t[2] * 0.85) + 20 : d;
}
/* nächstes Element unter einem Punkt: [Schlüssel, Index] */
function edHit(x, y, tol, only) {
  const L = ED.L; let best = null, bd = tol;
  for (const k of only ? [only] : ED_KEYS) L[k].forEach((t, i) => { const d = edDist(k, t, x, y); if (d < bd) { bd = d; best = [k, i]; } });
  if (!only && L.ft && hyp(L.ft[0] - x, L.ft[1] - y) < Math.max(bd, 160)) best = ['ft', 0];
  return best;
}
function edErase(x, y, tol) {
  const L = ED.L, h = edHit(x, y, tol);
  if (!h) { edMsg(L_('Hier ist nichts zum Entfernen.'), 'warn'); return; }
  edPush();
  if (h[0] === 'ft') { L.ft = 0; return edChanged(); }
  const [k, i] = h, t = L[k][i], gone = new Set([i]);
  if (ED.sym) for (let r = 1; r < L.np; r++) {
    const p = edRot(t[0], t[1], r); let bi = -1, bd = tol * 1.5;
    L[k].forEach((q, j) => { if (gone.has(j)) return; const d = edDist(k, q, p[0], p[1]); if (d < bd) { bd = d; bi = j; } });
    if (bi >= 0) gone.add(bi);
  }
  L[k] = L[k].filter((_, j) => !gone.has(j));
  edChanged();
}
function edToggleIce(i) {
  const L = ED.L, t = L.ice[i], big = t[2] ? 0 : 1; edPush(); t[2] = big;
  if (ED.sym) for (let r = 1; r < L.np; r++) { const p = edRot(t[0], t[1], r); for (const q of L.ice) if (hyp(q[0] - p[0], q[1] - p[1]) < 60) q[2] = big; }
  edChanged();
}
function edUndo() { if (!ED.hist.length) { edMsg(L_('Nichts rückgängig zu machen.'), 'warn'); return; } ED.L = JSON.parse(ED.hist.pop()); edSyncTop(); edChanged(true); }
function edClear() { edPush(); ED.L = edEmpty(ED.L.np, ED.L.s, ED.L.n); edChanged(); edMsg(L_('Karte geleert. »Rückgängig« holt alles wieder.'), ''); }
function edSetSize(s) {
  const L = ED.L, k = s / L.s; if (k === 1) return;
  edPush();
  const sc = v => clamp(Math.round(v * k), 0, s);
  for (const key of ED_KEYS) L[key] = L[key].map(t => t.map((v, i) => ED_ARITY[key] === 3 && i === 2 ? v : sc(v)));
  if (L.ft) L.ft = L.ft.map(sc);
  L.s = s; edFit(); edChanged();
}
function edSetNp(np) {
  const L = ED.L; if (np === L.np) return;
  edPush(); L.np = np;
  /* mit Symmetrie: Startplätze neu im Kreis aus dem ersten Start (oder aus der Vorlage) */
  if (ED.sym) { const t = L.st[0] || customDefault(np, L.s).st[0]; L.st = []; for (let k = 0; k < np; k++) L.st.push(edRot(t[0], t[1], k)); }
  edChanged();
}
function edChanged(keepMsg) {
  try { ED.map = generateMap('custom', ED.L.np, 7, null, ED.L); } catch (e) { ED.map = null; }
  ED.probs = []; ED.chkT = Date.now() + 250;
  setTimeout(() => { if (Date.now() >= ED.chkT && ED.open) edRunCheck(); }, 260);
  if (!keepMsg) edMsg('');
  edDraw(); edStatus(true);
  try { localStorage.setItem(ED_DRAFT, JSON.stringify({ L: ED.L, id: ED.id })); } catch (e) { /* Speicher gesperrt */ }
}
function edRunCheck() { try { ED.probs = edCheck(ED.L); } catch (e) { ED.probs = [{ m: 'Prüfung fehlgeschlagen', x: -1, y: -1 }]; } edStatus(); edDraw(); }
function edStatus(busy) {
  const el = $('edStat'); if (!el) return;
  if (busy) { el.className = ''; el.textContent = L_('Prüfe …'); return; }
  const p = ED.probs;
  if (!p.length) { el.className = 'ok'; el.textContent = L_('Karte spielbar: alle Starts erreichbar, genug Bauplatz.'); return; }
  el.className = 'bad'; el.textContent = '⚠ ' + T(p[0].m) + (p.length > 1 ? ' ' + L_('(+{0} weitere)', p.length - 1) : '');
}
/* L als lokaler Name: Layout-Variablen heißen hier L */
function L_(s, ...a) { return L(s, ...a); }

/* ---------- Ansicht: Leinwand mit Verschieben und Zoom ---------- */
function edFit() {
  const cv = $('edCv'); if (!cv) return;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 300, s = ED.L.s, z = Math.min(W, H) / s * 0.94;
  ED.view = { z, ox: (W - s * z) / 2, oy: (H - s * z) / 2, fit: z };
}
function edW(px, py) { const v = ED.view; return { x: (px - v.ox) / v.z, y: (py - v.oy) / v.z }; }
function edDraw() {
  const cv = $('edCv'); if (!cv || !ED.open) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  if (!ED.view) edFit();
  const x = cv.getContext('2d'), v = ED.view, z = v.z, L = ED.L, s = L.s, m = ED.map, px = 1 / z;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#02040a'; x.fillRect(0, 0, W, H);
  x.setTransform(dpr * z, 0, 0, dpr * z, dpr * v.ox, dpr * v.oy);
  x.fillStyle = '#070b18'; x.fillRect(0, 0, s, s);
  x.fillStyle = MV_COL.edge; x.fillRect(0, 0, s, EDGE); x.fillRect(0, s - EDGE, s, EDGE); x.fillRect(0, 0, EDGE, s); x.fillRect(s - EDGE, 0, EDGE, s);
  /* Raster alle 500 und Symmetrieachsen */
  x.strokeStyle = 'rgba(143,227,255,0.07)'; x.lineWidth = px; x.beginPath(); for (let k = 500; k < s; k += 500) { x.moveTo(k, 0); x.lineTo(k, s); x.moveTo(0, k); x.lineTo(s, k); } x.stroke();
  if (ED.sym) { x.strokeStyle = 'rgba(255,184,107,0.18)'; x.setLineDash([8 * px, 8 * px]); x.beginPath(); const t0 = L.st[0] ? Math.atan2(L.st[0][1] - s / 2, L.st[0][0] - s / 2) : -Math.PI / 2; for (let k = 0; k < L.np; k++) { const a = t0 + (k + 0.5) * TAU / L.np; x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.cos(a) * s, s / 2 + Math.sin(a) * s); } x.stroke(); x.setLineDash([]); }
  x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = px; x.beginPath(); x.moveTo(s / 2 - 40, s / 2); x.lineTo(s / 2 + 40, s / 2); x.moveTo(s / 2, s / 2 - 40); x.lineTo(s / 2, s / 2 + 40); x.stroke();
  if (m) {
    for (const n of m.nebs) { const g = x.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r), c = n.kind === 'ash' ? MV_COL.ash : MV_COL.ion; g.addColorStop(0, c); g.addColorStop(0.75, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(n.x, n.y, n.r, 0, TAU); x.fill(); }
    x.fillStyle = MV_COL.field; for (const f of m.fields) { x.beginPath(); x.arc(f.x, f.y, f.r, 0, TAU); x.fill(); }
    x.fillStyle = MV_COL.rock; for (const o of m.rocks) { x.beginPath(); x.arc(o.x, o.y, Math.max(o.r, 1.2 * px), 0, TAU); x.fill(); }
    for (const n of m.nodes) { x.fillStyle = n.kind === 'ice' ? MV_COL.ice : MV_COL.ore; x.beginPath(); x.arc(n.x, n.y, Math.max(n.r, 2.5 * px), 0, TAU); x.fill(); }
    for (const st of m.sites) { const r = Math.max(st.r * 0.9, 4 * px); x.fillStyle = MV_COL.site; x.beginPath(); x.moveTo(st.x, st.y - r); x.lineTo(st.x + r, st.y); x.lineTo(st.x, st.y + r); x.lineTo(st.x - r, st.y); x.closePath(); x.fill(); }
    for (let i = 0; i < m.gates.length; i += 2) { const a = m.gates[i], b = m.gates[i + 1]; x.strokeStyle = 'rgba(127,224,168,0.35)'; x.lineWidth = 1.5 * px; x.setLineDash([10 * px, 8 * px]); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.setLineDash([]); for (const o of [a, b]) { x.strokeStyle = MV_COL.gate; x.lineWidth = Math.max(8, 2.5 * px); x.beginPath(); x.arc(o.x, o.y, o.r, 0, TAU); x.stroke(); } }
    if (m.fort) { const F = m.fort; x.fillStyle = 'rgba(200,50,74,0.3)'; x.beginPath(); x.arc(F.x, F.y, F.r, 0, TAU); x.fill(); x.strokeStyle = '#c8324a'; x.lineWidth = 2 * px; x.setLineDash([12 * px, 8 * px]); x.beginPath(); x.arc(F.x, F.y, F.r + 400, 0, TAU); x.stroke(); x.setLineDash([]); x.fillStyle = '#c8324a'; x.fillRect(F.x - F.r * 0.45, F.y - F.r * 0.3, F.r * 0.9, F.r * 0.6); }
  }
  /* große Stätten aus dem Layout (Art steht erst in der Partie fest): weißer Rand */
  x.strokeStyle = '#ffffff'; x.lineWidth = 1.5 * px; for (const p of L.gs) { x.beginPath(); x.arc(p[0], p[1], 70, 0, TAU); x.stroke(); }
  /* Startplätze mit Nummer und Bauradius */
  L.st.forEach((p, i) => {
    const c = SLOT_COLS[i % SLOT_COLS.length], r = Math.max(64, 9 * px);
    x.strokeStyle = c; x.globalAlpha = 0.35; x.lineWidth = px; x.beginPath(); x.arc(p[0], p[1], 760, 0, TAU); x.stroke(); x.globalAlpha = 1;
    x.fillStyle = c; x.beginPath(); x.arc(p[0], p[1], r, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2 * px; x.stroke();
    x.fillStyle = '#071018'; x.font = 'bold ' + (r * 1.2) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), p[0], p[1] + r * 0.05);
  });
  /* Probleme: roter Ring */
  x.strokeStyle = '#ff5b47'; x.lineWidth = 2.5 * px; for (const p of ED.probs) if (p.x >= 0) { x.beginPath(); x.arc(p.x, p.y, Math.max(110, 14 * px), 0, TAU); x.stroke(); }
  /* Ziehen: Vorschau mit Symmetrie-Kopien */
  const d = ED.drag;
  if (d && d.live) {
    const tool = ED_TOOLS.find(t => t[0] === ED.tool), key = ED.tool;
    const t = tool[3] === 'l' ? [d.a.x, d.a.y, d.b.x, d.b.y] : [d.a.x, d.a.y, edRad(d)];
    x.strokeStyle = tool[2]; x.fillStyle = tool[2]; x.globalAlpha = 0.75;
    for (const q of edCopies(key, t.map(Math.round))) {
      if (tool[3] === 'l') { x.lineWidth = key === 'bl' ? 150 : key === 'wl' ? 40 : 4 * px; x.lineCap = 'round'; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[2], q[3]); x.stroke(); x.lineCap = 'butt'; }
      else { x.globalAlpha = 0.35; x.beginPath(); x.arc(q[0], q[1], q[2], 0, TAU); x.fill(); x.globalAlpha = 0.75; }
    }
    x.globalAlpha = 1;
  }
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function edRad(d) { return clamp(Math.round(hyp(d.b.x - d.a.x, d.b.y - d.a.y)), 80, 700); }

/* ---------- Bedienung ---------- */
function edPt(e) { const r = $('edCv').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function edDown(e) {
  e.preventDefault(); const cv = $('edCv'); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
  const p = edPt(e); ED.ptrs.set(e.pointerId, p);
  if (ED.ptrs.size === 2) {
    const [a, b] = [...ED.ptrs.values()];
    ED.drag = null; ED.pinch = { d: Math.max(10, hyp(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z: ED.view.z, ox: ED.view.ox, oy: ED.view.oy }; edDraw(); return;
  }
  if (ED.ptrs.size === 1 && !ED.pinch) ED.drag = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, a: edW(p.x, p.y), b: edW(p.x, p.y), moved: false, live: false, pan: false };
}
function edMove(e) {
  if (!ED.ptrs.has(e.pointerId)) return;
  const p = edPt(e); ED.ptrs.set(e.pointerId, p);
  const v = ED.view;
  if (ED.pinch && ED.ptrs.size >= 2) {
    const [a, b] = [...ED.ptrs.values()], P = ED.pinch, d = Math.max(10, hyp(a.x - b.x, a.y - b.y)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const z = clamp(P.z * d / P.d, v.fit * 0.6, v.fit * 10), wx = (P.mx - P.ox) / P.z, wy = (P.my - P.oy) / P.z;
    v.z = z; v.ox = mx - wx * z; v.oy = my - wy * z; edDraw(); return;
  }
  const d = ED.drag; if (!d) return;
  if (!d.moved && hyp(p.x - d.sx, p.y - d.sy) > 9) { d.moved = true; const kind = ED_TOOLS.find(t => t[0] === ED.tool)[3]; d.pan = kind === 'p'; d.live = !d.pan; }
  if (!d.moved) return;
  if (d.pan) { v.ox += p.x - d.lx; v.oy += p.y - d.ly; }
  else d.b = edW(p.x, p.y);
  d.lx = p.x; d.ly = p.y; edDraw();
}
function edUp(e) {
  if (!ED.ptrs.has(e.pointerId)) return;
  ED.ptrs.delete(e.pointerId);
  if (ED.pinch) { if (!ED.ptrs.size) ED.pinch = null; return; }
  const d = ED.drag; ED.drag = null; if (!d || e.type === 'pointercancel') { edDraw(); return; }
  const s = ED.L.s, inMap = q => clamp(Math.round(q), EDGE, s - EDGE), tool = ED.tool, kind = ED_TOOLS.find(t => t[0] === tool)[3];
  const a = { x: inMap(d.a.x), y: inMap(d.a.y) }, b = { x: inMap(d.b.x), y: inMap(d.b.y) };
  if (d.pan) { edDraw(); return; }
  if (!d.moved) {
    /* Tippen */
    if (d.a.x < 0 || d.a.y < 0 || d.a.x > s || d.a.y > s) { edDraw(); return; }
    if (tool === 'del') return edErase(d.a.x, d.a.y, Math.max(90, 26 / ED.view.z));
    if (tool === 'ice') { const h = edHit(d.a.x, d.a.y, Math.max(80, 22 / ED.view.z), 'ice'); if (h) return edToggleIce(h[1]); return edPlace('ice', [a.x, a.y, 0]); }
    if (kind === 'c') return edPlace(tool, [a.x, a.y, tool === 'ion' ? 260 : 200]);
    if (kind === 'l') { edMsg(L_('Zum Setzen ziehen: vom Anfang zum Ende.'), 'warn'); edDraw(); return; }
    return edPlace(tool, [a.x, a.y]);
  }
  if (kind === 'c') return edPlace(tool, [a.x, a.y, edRad(d)]);
  if (kind === 'l') { if (hyp(b.x - a.x, b.y - a.y) < 120) { edMsg(L_('Zu kurz – länger ziehen.'), 'warn'); edDraw(); return; } return edPlace(tool, [a.x, a.y, b.x, b.y]); }
  edDraw();
}
function edWheel(e) {
  e.preventDefault(); const p = edPt(e), v = ED.view, w = edW(p.x, p.y), z = clamp(v.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), v.fit * 0.6, v.fit * 10);
  v.z = z; v.ox = p.x - w.x * z; v.oy = p.y - w.y * z; edDraw();
}

/* ---------- Oberfläche ---------- */
const ED_CSS = `#edWin { position: absolute; inset: 0; z-index: 15; background: #04060b; font-size: var(--ui); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); grid-template-areas: "top" "cv" "tools"; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); box-sizing: border-box; }
#edWin[hidden], #edPanel[hidden] { display: none; }
#edWin .key { min-height: max(2.5em, 40px); padding: 0.3em 0.7em; }
.edTop { grid-area: top; display: flex; flex-wrap: wrap; gap: 0.4em; align-items: center; padding: 0.35em 0.5em; border-bottom: 1px solid var(--line); background: var(--panel); scrollbar-width: none; }
.edTop input, .edTop select, #edPanel textarea { background: rgba(4,6,11,0.8); color: var(--txt); border: 1px solid var(--line); border-radius: 8px; font: inherit; font-size: 1em; min-height: max(2.5em, 40px); padding: 0 0.5em; box-sizing: border-box; -webkit-user-select: text; user-select: text; }
.edTop input { width: 9em; flex: 1 1 7em; max-width: 12em; }
.edTop label { color: var(--dim); font-size: 0.85em; display: flex; align-items: center; gap: 0.3em; white-space: nowrap; }
.edCvBox { grid-area: cv; position: relative; min-height: 0; }
#edCv { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; display: block; }
#edStat, #edHint { position: absolute; left: 0.5em; right: 0.5em; font-size: 0.92em; padding: 0.25em 0.6em; border-radius: 8px; background: rgba(5,8,16,0.82); border: 1px solid var(--line); pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#edStat { bottom: 0.4em; color: var(--dim); } #edStat.ok { color: var(--good); border-color: rgba(125,220,107,0.45); } #edStat.bad { color: var(--warn); border-color: rgba(255,194,62,0.5); }
#edHint { top: 0.4em; right: 7.6em; color: var(--dim); white-space: normal; }
.edFab { position: absolute; top: 0.4em; right: 0.5em; display: flex; flex-direction: column; gap: 0.35em; }
#edWin .edFab .key { font-size: 0.8em; min-height: max(2.4em, 38px); min-width: 8.2em; padding: 0.2em 0.5em; background: rgba(12,18,34,0.88); } #edHint:empty { display: none; } #edHint.warn { color: var(--warn); } #edHint.good { color: var(--good); }
.edTools { grid-area: tools; display: flex; gap: 0.3em; padding: 0.35em 0.5em; overflow-x: auto; border-top: 1px solid var(--line); background: var(--panel); scrollbar-width: none; }
.edTools .key { flex: none; flex-direction: column; gap: 0.15em; font-size: 0.8em; min-width: 5.2em; padding: 0.25em 0.4em; }
.edTools .key i { width: 1.1em; height: 1.1em; border-radius: 50%; display: block; box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
.edTools .key.on { border-color: var(--acc2); box-shadow: 0 0 0 1px var(--acc2), 0 0 12px rgba(255,184,107,0.35); }
@media (orientation: landscape) and (max-height: 560px) {
  #edWin { grid-template-rows: auto minmax(0, 1fr); grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "top top" "tools cv"; }
  .edTools { flex-direction: column; overflow-x: hidden; overflow-y: auto; border-top: 0; border-right: 1px solid var(--line); }
  .edTools .key { flex-direction: row; justify-content: flex-start; min-width: 8.6em; min-height: 2.4em; }
}
#edPanel { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; background: rgba(2,4,10,0.8); padding: 0.6em; box-sizing: border-box; }
#edPanel .win { max-height: 100%; overflow: auto; width: min(100%, 34em); box-sizing: border-box; }
#edPanel textarea { width: 100%; min-height: 4.5em; padding: 0.4em; font-size: 0.85em; word-break: break-all; }
.edRow { display: flex; gap: 0.4em; align-items: center; padding: 0.3em 0; border-bottom: 1px solid rgba(143,227,255,0.12); }
.edRow .info { flex: 1; min-width: 0; } .edRow .info b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .edRow .info small { color: var(--dim); }
.edRow.cur .info b { color: var(--acc2); }
.edBtns { display: flex; flex-wrap: wrap; gap: 0.4em; margin: 0.5em 0; }`;
function edEl(tag, cls, txt, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
function edBtn(parent, txt, fn, cls, id) { const b = edEl('button', 'key' + (cls ? ' ' + cls : ''), txt, parent); if (id) b.id = id; b.addEventListener('click', e => { e.stopPropagation(); if (typeof SND !== 'undefined') SND.play('click'); fn(); }); return b; }
function edBuild() {
  const old = $('edWin'); if (old) old.remove();
  if (!$('edCss')) { const st = document.createElement('style'); st.id = 'edCss'; st.textContent = ED_CSS; document.head.appendChild(st); }
  const w = edEl('div'); w.id = 'edWin'; w.hidden = true; w.setAttribute('data-nol', ''); $('menu').parentNode.appendChild(w);
  const top = edEl('div', 'edTop', null, w);
  edBtn(top, '✕', edClose, '', 'edX').title = L_('Zurück');
  const nm = edEl('input', null, null, top); nm.id = 'edName'; nm.maxLength = 32; nm.placeholder = L_('Name der Karte');
  nm.addEventListener('input', () => { ED.L.n = nm.value.slice(0, 32); ED.dirty = true; });
  const lb1 = edEl('label', null, L_('Größe'), top), ss = edEl('select', null, null, lb1); ss.id = 'edSize';
  for (const s of ED_SIZES) { const o = edEl('option', null, s + ' × ' + s, ss); o.value = s; }
  ss.addEventListener('change', () => edSetSize(+ss.value));
  const lb2 = edEl('label', null, L_('Spieler'), top), sp = edEl('select', null, null, lb2); sp.id = 'edNp';
  for (let n = 2; n <= 8; n++) { const o = edEl('option', null, String(n), sp); o.value = n; }
  sp.addEventListener('change', () => edSetNp(+sp.value));
  edBtn(top, L_('Symmetrie'), () => { ED.sym = !ED.sym; $('edSym').classList.toggle('on', ED.sym); edMsg(L_(ED.sym ? 'Symmetrie an: jede Platzierung wird für alle Spieler um die Mitte gedreht.' : 'Symmetrie aus: Platzierungen nur einmal.'), ''); edDraw(); }, ED.sym ? 'on' : '', 'edSym');
  edBtn(top, L_('Karten'), edPanel, 'arm', 'edMaps');
  const box = edEl('div', 'edCvBox', null, w), cv = edEl('canvas', null, null, box); cv.id = 'edCv';
  edEl('div', null, '', box).id = 'edHint'; edEl('div', null, '', box).id = 'edStat';
  /* schwebende Knöpfe rechts oben über der Karte (mit dem Daumen erreichbar) */
  const fab = edEl('div', 'edFab', null, box);
  edBtn(fab, '↶ ' + L_('Rückgängig'), edUndo, '', 'edUndo');
  edBtn(fab, L_('Einpassen'), () => { edFit(); edDraw(); }, '', 'edFitB');
  edBtn(fab, L_('Leeren'), edClear, 'warn', 'edClear');
  cv.addEventListener('pointerdown', edDown); cv.addEventListener('pointermove', edMove); cv.addEventListener('pointerup', edUp); cv.addEventListener('pointercancel', edUp);
  cv.addEventListener('wheel', edWheel, { passive: false }); cv.addEventListener('contextmenu', e => e.preventDefault());
  const tools = edEl('div', 'edTools', null, w); tools.id = 'edTools';
  for (const [id, name, col, , hint] of ED_TOOLS) {
    const b = edBtn(tools, '', () => { ED.tool = id; tools.querySelectorAll('.key').forEach(k => k.classList.toggle('on', k.dataset.t === id)); edMsg(L_(hint), ''); }, ED.tool === id ? 'on' : '');
    b.dataset.t = id; const i = edEl('i', null, null, b); i.style.background = col; edEl('span', null, L_(name), b);
  }
  const pn = edEl('div', null, null, w); pn.id = 'edPanel'; pn.hidden = true;
  if (!ED.rz) { ED.rz = 1; window.addEventListener('resize', () => { if (ED.open) { edFit(); edDraw(); } }); }
  ED.built = true; ED.lang = I18N.lang;
}
function edSyncTop() { $('edName').value = ED.L.n || ''; $('edSize').value = ED.L.s; $('edNp').value = ED.L.np; }
function edOpen() {
  if (!ED.built || !$('edWin') || ED.lang !== I18N.lang) edBuild();
  if (!ED.L) { let d = null; try { d = JSON.parse(localStorage.getItem(ED_DRAFT) || 'null'); } catch (e) { d = null; } const L = d && edNorm(d.L); if (L) { ED.L = L; ED.id = typeof d.id === 'string' ? d.id : null; } else { ED.L = customDefault(4, 5000); ED.L.n = ''; ED.id = null; } }
  ED.open = true; ED.hist = []; ED.view = null;
  $('edWin').hidden = false;
  ED.paused = !!UI.paused; UI.paused = true;   // Hintergrundgefecht ruht, solange der Editor offen ist
  edSyncTop(); edFit(); edChanged();
  edMsg(L_(ED_TOOLS.find(t => t[0] === ED.tool)[4]), '');
}
function edClose() {
  ED.open = false; $('edWin').hidden = true; $('edPanel').hidden = true; UI.paused = ED.paused;
  edRegisterAll(); if (typeof menuRender === 'function') menuRender();
}
/* Kartenliste: speichern, laden, löschen, neu, Code teilen und übernehmen */
function edPanel() {
  const pn = $('edPanel'); pn.textContent = ''; pn.hidden = false;
  const win = edEl('div', 'win', null, pn), list = edList();
  const head = edEl('div', 'row', null, win); head.style.cssText = 'justify-content:space-between;margin-top:0';
  edEl('h2', null, L_('Eigene Karten ({0}/{1})', list.length, ED_MAX), head).style.margin = '0';
  edBtn(head, '✕', () => { pn.hidden = true; });
  if (!list.length) edEl('p', 'fine', L_('Noch keine Karte gespeichert.'), win);
  for (const it of list) {
    const r = edEl('div', 'edRow' + (it.id === ED.id ? ' cur' : ''), null, win), inf = edEl('div', 'info', null, r);
    edEl('b', null, it.L.n || L_('Eigene Karte'), inf); edEl('small', null, L_('{0} Spieler', it.L.np) + ' · ' + it.L.s + ' × ' + it.L.s, inf);
    edBtn(r, L_('Laden'), () => { edPush(); ED.L = edNorm(it.L); ED.id = it.id; ED.dirty = false; edSyncTop(); edFit(); edChanged(); pn.hidden = true; edMsg(L_('{0} geladen.', ED.L.n || L_('Eigene Karte')), 'good'); });
    edBtn(r, '✕', () => { edStore(edList().filter(x => x.id !== it.id)); if (ED.id === it.id) ED.id = null; edRegisterAll(); edPanel(); }).title = L_('Löschen');
  }
  const bt = edEl('div', 'edBtns', null, win);
  edBtn(bt, L_('Speichern'), () => {
    const lst = edList(), L = edNorm(ED.L); if (!L.n) { L.n = L_('Karte {0}', lst.length + 1); ED.L.n = L.n; $('edName').value = L.n; }
    const i = lst.findIndex(x => x.id === ED.id);
    if (i >= 0) lst[i].L = L;
    else { if (lst.length >= ED_MAX) { edPanelMsg(L_('Höchstens zehn Karten – lösche zuerst eine.'), 'warn'); return; } ED.id = 'cu_' + Date.now().toString(36) + ((Math.random() * 1296) | 0).toString(36); lst.push({ id: ED.id, L }); }
    if (!edStore(lst)) { edPanelMsg(L_('Speichern ist auf diesem Gerät nicht möglich.'), 'warn'); return; }
    ED.dirty = false; edRegisterAll(); edPanel(); edPanelMsg(L_('Gespeichert. Die Karte steht jetzt in der Kartenwahl im Gefecht.') + (ED.probs.length ? ' ' + L_('Achtung: Die Prüfung meldet noch Probleme.') : ''), ED.probs.length ? 'warn' : 'good');
  }, 'arm');
  edBtn(bt, L_('Neue Karte'), () => { edPush(); ED.L = customDefault(ED.L.np, ED.L.s); ED.L.n = ''; ED.id = null; edSyncTop(); edFit(); edChanged(); pn.hidden = true; edMsg(L_('Neue Karte aus der Vorlage: Starts im Ring, je ein Eismond und Erz.'), 'good'); });
  const ex = edEl('div', null, null, win); edEl('div', 'secH', L_('Teilen'), ex);
  const ta = edEl('textarea', null, null, ex); ta.readOnly = true; ta.value = edEncode(ED.L); ta.id = 'edCode';
  ta.addEventListener('focus', () => ta.select());
  const b2 = edEl('div', 'edBtns', null, ex);
  edBtn(b2, L_('Code kopieren'), () => { ta.select(); let ok = false; try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).catch(() => {}); ok = true; } else ok = document.execCommand('copy'); } catch (e) { ok = false; } edPanelMsg(L_(ok ? 'Code kopiert.' : 'Kopieren geht hier nicht – Code markieren und von Hand kopieren.'), ok ? 'good' : 'warn'); });
  const im = edEl('div', null, null, win); edEl('div', 'secH', L_('Code übernehmen'), im);
  const tb = edEl('textarea', null, null, im); tb.placeholder = L_('Code hier einfügen'); tb.id = 'edImp';
  const b3 = edEl('div', 'edBtns', null, im);
  edBtn(b3, L_('Übernehmen'), () => { const L = edDecode(tb.value); if (!L) { edPanelMsg(L_('Das ist kein gültiger Karten-Code.'), 'warn'); return; } edPush(); ED.L = L; ED.id = null; edSyncTop(); edFit(); edChanged(); pn.hidden = true; edMsg(L_('{0} übernommen – zum Behalten speichern.', L.n || L_('Eigene Karte')), 'good'); }, '', 'edImpGo');
  edEl('p', 'fine', '', win).id = 'edPMsg';
}
function edPanelMsg(t, cls) { const el = $('edPMsg'); if (el) { el.textContent = t; el.style.color = cls === 'warn' ? 'var(--warn)' : cls === 'good' ? 'var(--good)' : ''; } }
/* Start: eigene Karten eintragen, Knopf im Hauptmenü verbinden (aus main.js boot) */
function initEditor() {
  edRegisterAll();
  const b = $('mEditor'); if (b) b.addEventListener('click', () => { if (typeof SND !== 'undefined') { SND.init(); SND.play('click'); } edOpen(); });
}
