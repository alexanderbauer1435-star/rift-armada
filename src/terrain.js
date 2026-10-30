/* ===== terrain.js ===== */
'use strict';
/* =====================================================================
   KARTENLEBEN (Fassung 22) – alles, was die Karte selbst während der Partie tut:
   1. Sprengbare Asteroiden: kleine Felsen und die Pfropfen in Engstellen der Ringkarten haben Hüllenpunkte (Objekte k = 6
      in g.rocks, Verweis auf map.rocks[ri]). Angriffsbefehl, Kanonen-, Railgun-, Torpedo- und Artillerietreffer zermürben
      sie; zerstört gibt der Fels seine Rasterzellen frei (Wege werden neu gesucht) und hinterlässt Erzbrocken zum Bergen.
   2. Wandernde Gefahren (opts.hazards): ein Ionensturm (wie Ionennebel: Schilde aus, Sicht nur aus der Nähe) und ein
      Gravitationsschacht (zieht Schiffe an, beschädigt im Kern). Bahnen sind reine Funktionen der Spielzeit – nichts zu
      speichern, im Gleichschritt überall gleich.
   3. Neutrale Stationen (Stätten mit eigener Art): Relaisstation (Sicht und Bauradius), Raffinerieplattform (Einkommen),
      Reparaturwerft (repariert Schiffe). 15 s ohne Feinde halten = übernehmen; Feinde daneben = umkämpft.
   4. Trümmerfelder (map.debris): Deckung – −25 % Schaden durch Geschosse (Kanone, Railgun, Artillerie, Torpedo, Säure,
      Biss), feindliche Sensoren sehen hinein nur auf 70 % ihrer Reichweite, Tempo −20 %.
   5. Zufallskarte: symmetrische, faire Karte für 2–8 Spieler aus einem Startwert (opts.mseed, sonst opts.seed).
   ===================================================================== */

/* ---------- 1. Sprengbare Asteroiden ---------- */
const ROCK_SMALL = 13;                       // Felsen bis zu diesem Radius sind sprengbar
const ROCK_HP = r => Math.round(140 + r * 26), PLUG_HP = 1500;
const ROCK_LOOT = { small: 70, plug: 260 };  // Erz im Brocken (Bergung mit Frachtern)
const ROCK_KMUL = { beam: 0.5, acid: 0.5, pd: 0, bite: 0.6 };
/* Felsen markieren (nach dem Aufbau, vor der Größenstreckung): kleine Felsen und Pfropfen bekommen Hüllenpunkte */
function markRocks(map) {
  for (const o of map.rocks) { if (o.plug) o.hp = PLUG_HP; else if (o.r <= ROCK_SMALL) o.hp = ROCK_HP(o.r); }
}
/* Pfropfen in einer Lücke: Felsen quer über die Lücke einer Wand (Mitte at, Breite gw entlang der Linie pts) */
function plugGap(map, pts, at, gw, rng) {
  const total = pathLen(pts), n = Math.max(3, Math.round(gw / 44));
  for (let k = 0; k < n; k++) {
    const t = at + ((k + 0.5) / n - 0.5) * gw / total, p = pathAt(pts, clamp(t, 0, 1));
    map.rocks.push({ x: p.x + (rng() - 0.5) * 8, y: p.y + (rng() - 0.5) * 8, r: 25 + rng() * 3, ang: rng() * TAU, seed: (rng() * 1e6) | 0, plug: 1 });
  }
}
/* Rasterzellen um einen Punkt neu stempeln (Bit 1: Felsen, bei mittel/groß auch Felder) */
function navRestamp(map, x, y, R) {
  const gw = map.gw, gh = map.gh, pad = [10, 22, 32];
  const x0 = Math.max(0, ((x - R) / NAV) | 0), x1 = Math.min(gw - 1, ((x + R) / NAV) | 0), y0 = Math.max(0, ((y - R) / NAV) | 0), y1 = Math.min(gh - 1, ((y + R) / NAV) | 0);
  for (let c = 0; c < 3; c++) { const nav = map.nav[c]; for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) nav[cy * gw + cx] &= ~1; }
  const stamp = (o, extra, cls) => {
    const r = o.r + extra, a0 = Math.max(x0, ((o.x - r) / NAV) | 0), a1 = Math.min(x1, ((o.x + r) / NAV) | 0), b0 = Math.max(y0, ((o.y - r) / NAV) | 0), b1 = Math.min(y1, ((o.y + r) / NAV) | 0);
    for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) { const dx = (cx + 0.5) * NAV - o.x, dy = (cy + 0.5) * NAV - o.y; if (dx * dx + dy * dy <= r * r) map.nav[cls][cy * gw + cx] |= 1; }
  };
  for (const o of map.rocks) { if (o.gone || Math.abs(o.x - x) > R + o.r + 40 || Math.abs(o.y - y) > R + o.r + 40) continue; for (let c = 0; c < 3; c++) stamp(o, pad[c], c); }
  for (const o of map.fields) { if (Math.abs(o.x - x) > R + o.r || Math.abs(o.y - y) > R + o.r) continue; stamp(o, 0, 1); stamp(o, 0, 2); }
}
function rockEntity(g, o, i) {
  const e = { k: 6, id: g.nextId++, x: o.x, y: o.y, r: o.r, ri: i, hp: o.hp, hpMax: o.hp, owner: -1, plug: !!o.plug, dead: false, hitT: -9, def: { name: o.plug ? 'Felspfropfen' : 'Asteroid', r: o.r, wpn: [], cls: 'rock' } };
  g.rocks.push(e); g.byId.set(e.id, e);
  return e;
}
/* Treffer auf einen Felsen (aus damage(), Geschossen und Artillerie) */
function rockHit(g, e, amt, kind, owner) {
  if (e.dead || !(amt > 0)) return;
  const k = ROCK_KMUL[kind] !== undefined ? ROCK_KMUL[kind] : 1;
  if (!k) return;
  e.hp -= amt * k; e.hitT = g.time;
  const o = g.map.rocks[e.ri]; if (o) o.dmg = clamp(1 - e.hp / e.hpMax, 0, 1);
  if (e.hp <= 0) rockBreak(g, e, owner);
}
/* Fels entfernen: Raster frei, Wege neu suchen (ohne Wrack und Meldung – auch beim Laden) */
function rockRemove(g, e) {
  if (e.dead && g.map.rocks[e.ri] && g.map.rocks[e.ri].gone) return;
  e.dead = true; e.hp = 0; g.byId.delete(e.id);
  const o = g.map.rocks[e.ri]; if (!o) return;
  o.gone = 1; o.dmg = 1;
  navRestamp(g.map, o.x, o.y, o.r + 40);
  for (const u of g.ships) if (!u.dead) { u.path = null; u.pt = 0; }
  g.rockN = (g.rockN || 0) + 1;
}
function rockBreak(g, e, owner) {
  rockRemove(g, e);
  /* Erzbrocken: ein Wrack ohne Schiffstyp (rock), Frachter bergen es wie ein Wrack */
  g.wrecks.push({ x: e.x, y: e.y, ang: (e.id % 7) * 0.9, type: null, rock: 1, owner: -1, until: g.time + 300, id: e.id, sal: e.plug ? ROCK_LOOT.plug : ROCK_LOOT.small, r: e.r });
  if (g.wrecks.length > 60) g.wrecks.shift();
  ev(g, 'rockGone', { x: e.x, y: e.y, r: e.r, plug: e.plug ? 1 : 0, owner, id: e.id });
  ev(g, 'hit', { x: e.x, y: e.y, kind: 'torp', art: 1 });
}
/* Artillerie: Splitter treffen auch sprengbare Felsen im Umkreis */
function rocksSplash(g, x, y, R, dmg, owner) {
  for (const e of g.rocks) { if (e.dead) continue; const d = hyp(e.x - x, e.y - y); if (d <= R + e.r) rockHit(g, e, dmg * (d < e.r + 20 ? 1 : 0.5), 'art', owner); }
}
/* Geschoss im Fels: sprengbare Felsen nehmen den Treffer */
function rockStruck(g, o, q) {
  if (!o.eid) return;
  const e = g.byId.get(o.eid);
  if (e && e.k === 6) rockHit(g, e, q.dmg, q.kind, q.owner);
}

/* ---------- 2. Wandernde Gefahren ---------- */
/* Vorgabe je Karte (Gefecht: Schalter »Karte«); sonst beide */
const HAZ_MAPS = { expanse: 'both', storm: 'well', maelstrom: 'well', archipelago: 'storm', arena: 'storm', pinwheel: 'well', random: 'both' };
const HAZ_DEF = { storm: { r: 330 }, well: { r: 420, core: 115, pull: 52, dmg: 0.035 } };
const HAZ_WARN = 1050;                       // Abstand zur Basis, ab dem gewarnt wird
function hazDefault(mapId) { return !!HAZ_MAPS[mapId]; }
function hazSetup(g) {
  g.hazards = []; g.hazWarn = {};
  const o = g.opts;
  if (!o.hazards || o.mis || o.mode || o.sandbox) return;
  const kind = HAZ_MAPS[g.map.id] || 'both', rng = makeRng(((g.map.seed || 1) * 977 + 31) >>> 0);
  if (kind !== 'well') g.hazards.push({ kind: 'storm', r: HAZ_DEF.storm.r, ph: rng() * TAU, w: TAU / (320 + rng() * 120), ph2: rng() * TAU, w2: TAU / (170 + rng() * 60), A0: 0.5, A1: 0.17, x: 0, y: 0 });
  if (kind !== 'storm') g.hazards.push({ kind: 'well', r: HAZ_DEF.well.r, core: HAZ_DEF.well.core, ph: rng() * TAU, w: -TAU / (280 + rng() * 100), ph2: rng() * TAU, w2: TAU / (140 + rng() * 50), A0: 0.33, A1: 0.13, x: 0, y: 0 });
  hazMove(g);
}
function hazMove(g) {
  const m = g.map, cx = m.w / 2, cy = m.h / 2, R = Math.min(m.w, m.h) / 2;
  for (const h of g.hazards) { const a = h.ph + h.w * g.time, k = h.A0 + h.A1 * dsin(h.ph2 + h.w2 * g.time); h.x = cx + dcos(a) * R * k; h.y = cy + dsin(a) * R * k; }
}
function inStorm(g, x, y) { for (const h of g.hazards) if (h.kind === 'storm' && hyp(h.x - x, h.y - y) < h.r) return true; return false; }
function updateHazards(g, dt) {
  hazMove(g);
  if (g.tick & 1) return;
  const step = dt * 2;
  for (const h of g.hazards) {
    if (h.kind !== 'well') continue;
    /* Sog: zur Mitte, stärker je näher; im Kern Hüllenschaden (Schild zuerst) */
    nearShips(g, h.x, h.y, h.r, u => {
      const dx = h.x - u.x, dy = h.y - u.y, d = hyp(dx, dy);
      if (d > 3) { const k = 1 - d / h.r, s = HAZ_DEF.well.pull * (0.3 + 0.7 * k) * step * (u.def.cls === 'l' ? 0.6 : u.def.cls === 'm' ? 0.8 : 1); u.x += dx / d * Math.min(s, d); u.y += dy / d * Math.min(s, d); }
      if (d < h.core && !u.dead) damage(g, u, u.hullMax * HAZ_DEF.well.dmg * step, 'grav', null, -1, h.x, h.y);
      return false;
    });
  }
  /* Warnung, wenn eine Gefahr einer Basis nahe kommt (einmal je Minute und Gefahr) */
  if (g.tick % 30 !== 0) return;
  for (const p of g.players) {
    if (!p.alive || p.neutral) continue;
    for (let i = 0; i < g.hazards.length; i++) {
      const h = g.hazards[i], key = p.id * 8 + i;
      if (g.time - (g.hazWarn[key] || -999) < 60) continue;
      let near = false;
      for (const b of g.bldgs) if (!b.dead && b.owner === p.id && (b.role === 'base' || b.role === 'yard' || b.role === 'refinery') && hyp(b.x - h.x, b.y - h.y) < HAZ_WARN + h.r) { near = true; break; }
      if (near) { g.hazWarn[key] = g.time; ev(g, 'hazNear', { owner: p.id, kind: h.kind, x: h.x, y: h.y }); }
    }
  }
}

/* ---------- 3. Neutrale Stationen ---------- */
const OUTPOST = {
  relayst: { name: 'Relaisstation', r: 44, see: 1150, desc: 'Neutrale Relaisstation. 15 Sekunden ohne Feinde daneben halten, dann gehört sie dir: weite Sicht und Bauradius um die Station.' },
  refplat: { name: 'Raffinerieplattform', r: 48, see: 420, inc: { ice: 4, ore: 2 }, desc: 'Neutrale Raffinerieplattform. 15 Sekunden ohne Feinde daneben halten: laufendes Einkommen, solange sie dir gehört.' },
  drydock: { name: 'Reparaturwerft', r: 50, see: 420, heal: 0.025, desc: 'Neutrale Reparaturwerft. 15 Sekunden ohne Feinde daneben halten: repariert danach deine Schiffe und die deiner Verbündeten in der Nähe.' }
};
const OP_CAP = 15, OP_RANGE = 200, OP_BUILD = 620, OP_HEAL_R = 260;
for (const k in OUTPOST) SITE_DEF[k] = { name: OUTPOST[k].name, r: OUTPOST[k].r, desc: OUTPOST[k].desc };
const OP_MAPS = { arena: 1, expanse: 1, maelstrom: 1, storm: 1, archipelago: 1, pinwheel: 1, random: 1 };
function outpostStep(g, st, step) {
  const D = OUTPOST[st.kind], pr = presence(g, st.x, st.y, st.r + OP_RANGE);
  st.cont = pr.contested ? 1 : 0;
  const mine = pr.pi >= 0 && st.owner >= 0 && g.tm[pr.pi] === g.tm[st.owner];
  if (pr.contested) { /* umkämpft: Fortschritt steht */ }
  else if (pr.pi < 0 || mine) { if (st.prog > 0) st.prog = Math.max(0, st.prog - step * (mine ? 0.2 : 0.05)); }
  else {
    if (st.by !== pr.pi) { st.by = pr.pi; st.prog = 0; }
    st.prog = Math.min(1, st.prog + step / OP_CAP);
    if (st.prog >= 1) { const prev = st.owner; st.owner = pr.pi; st.prog = 0; st.acc = 0; ev(g, 'stCap', { owner: pr.pi, prev, kind: st.kind, x: st.x, y: st.y, id: st.id, name: st.name }); }
  }
  if (st.owner < 0) return;
  const p = g.players[st.owner];
  if (!p || !p.alive) { st.owner = -1; return; }
  if (D.inc) { st.acc = (st.acc || 0) + step; while (st.acc >= 1) { st.acc -= 1; earn(p, 'ice', D.inc.ice); earn(p, 'ore', D.inc.ore); } }
  if (D.heal) nearShips(g, st.x, st.y, st.r + OP_HEAL_R, u => { if (!u.derelict && g.tm[u.owner] === g.tm[st.owner] && u.hull < u.hullMax) { u.hull = Math.min(u.hullMax, u.hull + u.hullMax * D.heal * step); u.fr = g.time; } return false; });
}
/* Bauradius: eigene Relaisstation erlaubt Bauen in ihrer Nähe */
function outpostBuild(g, pi, x, y) {
  for (const st of g.sites) if (st.kind === 'relayst' && st.owner === pi && hyp(st.x - x, st.y - y) < OP_BUILD) return true;
  return false;
}

/* ---------- 4. Trümmerfelder (Deckung) ---------- */
const COVER_DMG = 0.75, COVER_SEE = 0.7, COVER_SLOW = 0.8;
const COVER_KIND = { kin: 1, rail: 1, art: 1, torp: 1, acid: 1, bite: 1 };
function debris(map, x, y, r) { (map.debris || (map.debris = [])).push({ x, y, r, seed: ((x * 7 + y * 13) | 0) & 0xffff }); }
/* Raster der Trümmerfelder (aus buildNav) */
function debrisGrid(map) {
  const gw = map.gw, gh = map.gh; map.debG = new Uint8Array(gw * gh);
  for (const o of map.debris || []) {
    const x0 = Math.max(0, ((o.x - o.r) / NAV) | 0), x1 = Math.min(gw - 1, ((o.x + o.r) / NAV) | 0), y0 = Math.max(0, ((o.y - o.r) / NAV) | 0), y1 = Math.min(gh - 1, ((o.y + o.r) / NAV) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const dx = (cx + 0.5) * NAV - o.x, dy = (cy + 0.5) * NAV - o.y; if (dx * dx + dy * dy <= o.r * o.r) map.debG[cy * gw + cx] = 1; }
  }
}
function inDebris(map, x, y) { if (!map.debG) return false; const cx = (x / NAV) | 0, cy = (y / NAV) | 0; return cx >= 0 && cy >= 0 && cx < map.gw && cy < map.gh && map.debG[cy * map.gw + cx] === 1; }
/* Sicht (aus updateVision): Deckungstabelle visC je Team (70 % Reichweite), Sicht der Stationen */
function terrVision(g, st) {
  const vw = g.vw, vh = g.vh, cov = g.map.debris && g.map.debris.length;
  if (cov) {
    if (!g.teamVisC) g.teamVisC = {};
    for (const p of g.players) { if (!g.teamVisC[p.team]) g.teamVisC[p.team] = new Int32Array(vw * vh); p.visC = g.teamVisC[p.team]; }
    for (const u of g.ships) {
      if (u.dead) continue;
      u.cov = u.def.role !== 'fighter' && inDebris(g.map, u.x, u.y);
      const p = g.players[u.owner]; let r = u.def.sensor * p.tfx.sensor * (0.4 + 0.6 * u.sub.sensor); if (u.ion) r = Math.min(r, ION_SEE);
      markVis(p.visC, p.explored, vw, vh, st, u.x, u.y, Math.max(ION_SEE, r * COVER_SEE));
    }
    for (const b of g.bldgs) { if (b.dead) continue; const p = g.players[b.owner]; markVis(p.visC, p.explored, vw, vh, st, b.x, b.y, (b.done ? (SENSOR_B[b.role] || 360) : 220) * COVER_SEE); }
    for (const r of g.reveals) { const p = g.players[r.owner]; if (p && p.visC) markVis(p.visC, p.explored, vw, vh, st, r.x, r.y, r.r); }
  }
  for (const s of g.sites) {
    const D = OUTPOST[s.kind]; if (!D || s.owner < 0) continue;
    const p = g.players[s.owner]; if (!p) continue;
    markVis(p.vis, p.explored, vw, vh, st, s.x, s.y, D.see);
    if (p.visN) markVis(p.visN, p.explored, vw, vh, st, s.x, s.y, ION_SEE);
    if (p.visC) markVis(p.visC, p.explored, vw, vh, st, s.x, s.y, D.see * COVER_SEE);
  }
}

/* ---------- Aufbau der Partie, Schritt, Prüfsumme, Spielstand ---------- */
function terrainInit(g) {
  g.rocks = [];
  if (!g.opts.mis) g.map.rocks.forEach((o, i) => { if (o.hp > 0 && !o.gone) o.eid = rockEntity(g, o, i).id; });
  hazSetup(g);
}
function terrainStep(g, dt) {
  if (g.hazards && g.hazards.length) updateHazards(g, dt);
}
function terrHash(g, h) {
  for (const e of g.rocks || []) if (!e.dead && e.hitT > 0) { h = hmix(h, e.id); h = hmix(h, e.hp); }
  return hmix(h, g.rockN || 0);
}
function terrSave(g) { return { rk: (g.rocks || []).map(e => e.dead ? -1 : e.hp), hw: g.hazWarn || {} }; }
function terrLoad(g, d) {
  for (const e of g.rocks || []) g.byId.set(e.id, e);
  if (!d) return;
  if (Array.isArray(d.rk) && d.rk.length === g.rocks.length) d.rk.forEach((v, i) => { const e = g.rocks[i]; if (v === -1) rockRemove(g, e); else if (v < e.hpMax) { e.hp = v; e.hitT = 0.001; const o = g.map.rocks[e.ri]; if (o) o.dmg = clamp(1 - v / e.hpMax, 0, 1); } });
  if (d.hw && typeof d.hw === 'object') g.hazWarn = d.hw;
}

/* ---------- KI: Pfropfen sprengen, neutrale Stationen nehmen ---------- */
function aiTerrain(g, pi, fleet, anchor, toward) {
  const A = g.players[pi].ai, t = g.time;
  if (t - (A.terrT || -99) < 20 || t < 150) return;
  A.terrT = t;
  const free = fleet.filter(u => !u.def.art && (u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am)) && !(A.atk && A.atk.ids.indexOf(u.id) >= 0) && !(A.raid && A.raid.ids && A.raid.ids.indexOf(u.id) >= 0));
  if (free.length < 2) return;
  /* Pfropfen auf dem kürzesten Weg zum Gegner: Umweg über die Lücke deutlich länger als der Weg durch den Pfropfen */
  if (g.rocks.some(e => e.plug && !e.dead)) {
    const pts = findPath(g.map, 1, anchor.x, anchor.y, toward.x, toward.y);
    let len = 0, px = anchor.x, py = anchor.y; if (pts) for (const q of pts) { len += hyp(q.x - px, q.y - py); px = q.x; py = q.y; }
    let best = null, bs = 1e9;
    for (const e of g.rocks) {
      if (!e.plug || e.dead) continue;
      const via = hyp(e.x - anchor.x, e.y - anchor.y) + hyp(toward.x - e.x, toward.y - e.y);
      if (pts && via > len * 0.8) continue;
      if (g.ships.some(s => !s.dead && foes(g, pi, s.owner) && s.def.wpn.length && canSee(g, pi, s) && hyp(s.x - e.x, s.y - e.y) < 700)) continue;
      if (via < bs) { bs = via; best = e; }
    }
    if (best) { const us = free.slice(0, 4); execCmd(g, { t: 'attack', p: pi, u: us.map(u => u.id), e: best.id }); return; }
  }
  /* Station in der Nähe, die nicht dem eigenen Team gehört und an der keine sichtbaren Feinde stehen */
  let st = null, bd = Math.max(g.map.w, g.map.h) * 0.55;
  for (const s of g.sites) {
    if (!OUTPOST[s.kind] || (s.owner >= 0 && g.tm[s.owner] === g.tm[pi])) continue;
    const d = hyp(s.x - anchor.x, s.y - anchor.y); if (d > bd) continue;
    if (g.ships.some(e => !e.dead && foes(g, pi, e.owner) && e.def.wpn.length && canSee(g, pi, e) && hyp(e.x - s.x, e.y - s.y) < 600)) continue;
    bd = d; st = s;
  }
  if (st) { const us = free.slice(0, 3); cmdMove(g, us, st.x + dcos((pi * 1.7) % TAU) * (st.r + 70), st.y + dsin((pi * 1.7) % TAU) * (st.r + 70), true, 'wedge'); }
}

/* ---------- Kartenbau: Stationen, Trümmerfelder, Pfropfen (aus generateMap) ---------- */
/* Drehsymmetrie je Karte: wie oft wird ein Platz um die Mitte gedreht (2 = Punktspiegelung) */
function symK(id, np) {
  if (RING_STYLE[id] || id === 'arena' || id === 'random') return np;
  if (id === 'crown' || id === 'shattered') return 4;
  if (id === 'haven' || id === 'narrows' || id === 'twingates' || (id === 'ashfall' && np === 2)) return 2;
  return 0;
}
function rotK(map, p, k, K) { const a = k * TAU / K, cx = map.w / 2, cy = map.h / 2, c = dcos(a), s = dsin(a), dx = p.x - cx, dy = p.y - cy; return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }; }
/* Platz für ein Objekt mit Radius r frei? (kind: 'deb' Trümmerfeld, 'op' Station) */
function spotFree(map, x, y, r, kind) {
  if (x < EDGE + r + 60 || y < EDGE + r + 60 || x > map.w - EDGE - r - 60 || y > map.h - EDGE - r - 60) return false;
  const op = kind === 'op';
  for (const s of map.starts) if (hyp(s.x - x, s.y - y) < (op ? 900 : 480 + r)) return false;
  for (const n of map.nodes) if (hyp(n.x - x, n.y - y) < n.r + r + (op ? 70 : 10)) return false;
  for (const s of map.sites) if (hyp(s.x - x, s.y - y) < s.r + r + (op ? 160 : 50)) return false;
  for (const gt of map.gates) if (hyp(gt.x - x, gt.y - y) < gt.r + r + 100) return false;
  for (const n of map.nebs) if (hyp(n.x - x, n.y - y) < n.r + (op ? r + 40 : r * 0.5)) return false;
  for (const f of map.fields) if (hyp(f.x - x, f.y - y) < f.r + (op ? r + 30 : r * 0.6)) return false;
  if (op) for (const o of map.rocks) if (hyp(o.x - x, o.y - y) < o.r + r + 30) return false;
  for (const d of map.debris || []) if (hyp(d.x - x, d.y - y) < d.r + r + (op ? 40 : 60)) return false;
  if (map.fort && hyp(map.fort.x - x, map.fort.y - y) < map.fort.r + 600 + r) return false;
  return true;
}
/* Kandidaten (Abstand zur Mitte als Anteil von R, Winkel zur Achse von Start 0) der Reihe nach, alle K Kopien frei */
function symSpot(map, K, R, a0, cands, r, kind) {
  const cx = map.w / 2, cy = map.h / 2;
  for (const [rf, da] of cands) {
    const p0 = { x: cx + dcos(a0 + da) * R * rf, y: cy + dsin(a0 + da) * R * rf }, ps = [];
    for (let k = 0; k < K; k++) ps.push(rotK(map, p0, k, K));
    let ok = true; for (const p of ps) if (!spotFree(map, p.x, p.y, r, kind)) { ok = false; break; }
    /* Kopien dürfen einander nicht überlappen */
    if (ok) for (let i = 0; i < ps.length && ok; i++) for (let j = i + 1; j < ps.length; j++) if (hyp(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < r * 2 + 80) { ok = false; break; }
    if (ok) return ps;
  }
  return null;
}
function terrainGen(map, id, np, seed) {
  const K = symK(id, np);
  if (!K || !map.starts.length) { markRocks(map); return; }
  const cx = map.w / 2, cy = map.h / 2, s0 = map.starts[0], a0 = datan2(s0.y - cy, s0.x - cx), R = hyp(s0.x - cx, s0.y - cy), half = Math.PI / K;
  /* Trümmerfelder: je Sektor eines (Zweierkarten zwei), auf halbem Weg zur Mitte, seitlich versetzt */
  const nd = K <= 2 ? 2 : 1, dr = K <= 2 ? 170 : 150;
  const cands = [];
  for (const rf of [0.55, 0.45, 0.65, 0.38, 0.72, 0.3, 0.8]) for (const f of [0.5, -0.5, 0.3, -0.3, 0.7, -0.7, 0.15, -0.15]) cands.push([rf, half * f]);
  for (let n = 0; n < nd; n++) { const ps = symSpot(map, K, R, a0, cands, dr, 'deb'); if (!ps) break; for (const p of ps) debris(map, p.x, p.y, dr); }
  /* Neutrale Stationen auf ausgewählten Karten: 2–3 Stück, fair verteilt */
  if (OP_MAPS[id]) {
    const kinds = ['relayst', 'refplat', 'drydock'];
    const RF = [0.5, 0.42, 0.58, 0.35, 0.65, 0.3, 0.72, 0.25, 0.78, 0.2];
    let ps = null;
    if (np <= 3) {
      /* auf den Grenzen zwischen den Sektoren (gleich weit von beiden Nachbarn), je Grenze eine andere Art */
      ps = symSpot(map, np, R, a0, RF.map(rf => [rf, half]), 52, 'op');
      if (ps) ps.forEach((p, i) => site(map, kinds[i % 3], p.x, p.y));
      /* Grenze verbaut (Felswand): je Sektor dieselbe Art, seitlich versetzt – gedreht gleich für alle */
      else { const c = []; for (const rf of RF) for (const f of [0.6, -0.6, 0.4, -0.4, 0.8, -0.8, 0.2, -0.2]) c.push([rf, half * f]); ps = symSpot(map, np, R, a0, c, 52, 'op'); const kd = kinds[hashStr(id) % 3]; if (ps) for (const p of ps) site(map, kd, p.x, p.y); }
    } else {
      /* gerade Spielerzahl (4, 6): auf jeder zweiten Grenze dieselbe Art – jeder Start grenzt an genau eine Station */
      if (np % 2 === 0 && np <= 6) { ps = symSpot(map, np / 2, R, a0, RF.map(rf => [rf, half]), 52, 'op'); const kd = kinds[hashStr(id) % 3]; if (ps) for (const p of ps) site(map, kd, p.x, p.y); }
      /* sonst drei Stationen im Ring um die Mitte */
      if (!ps) {
        const c3 = []; for (const rf of [0.3, 0.26, 0.34, 0.22, 0.38, 0.42, 0.46, 0.18, 0.5, 0.55]) for (let k = 0; k < 12; k++) c3.push([rf, half + k * TAU / 36]);
        ps = symSpot(map, 3, R, a0, c3, 52, 'op');
        if (ps) ps.forEach((p, i) => site(map, kinds[i], p.x, p.y));
      }
    }
  }
  markRocks(map);
  void seed;
}

/* ---------- 5. Zufallskarte ---------- */
/* Erreichbarkeit: Flutfüllung je Größenklasse vom ersten Start, alle Starts müssen erreicht werden */
function navFlood(map, cls) {
  const gw = map.gw, gh = map.gh, nav = map.nav[cls], seen = new Uint8Array(gw * gh), s = map.starts[0];
  const c0 = nearestFree(map, cls, (s.x / NAV) | 0, (s.y / NAV) | 0); if (c0 < 0) return seen;
  const st = [c0]; seen[c0] = 1;
  while (st.length) {
    const c = st.pop(), x = c % gw, y = (c / gw) | 0;
    for (let d = 0; d < 4; d++) { const nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const i = ny * gw + nx; if (seen[i] || (nav[i] & NAV_BLOCK)) continue; seen[i] = 1; st.push(i); }
  }
  return seen;
}
function mapReachable(map) {
  for (let c = 0; c < 3; c++) {
    const seen = navFlood(map, c);
    for (const s of map.starts) { const i = nearestFree(map, c, (s.x / NAV) | 0, (s.y / NAV) | 0); if (i < 0 || !seen[i]) return false; }
  }
  return true;
}
/* Ein Versuch: Inhalt für Sektor 0 (Punkte gleich für alle Sektoren gesetzt, Linien gedreht kopiert) */
function genRandomTry(map, np, rng, simple) {
  const w = map.w, cx = w / 2, cy = w / 2, half = Math.PI / np, a0 = np === 2 ? -0.75 * Math.PI : -Math.PI / 2;
  const axis = i => a0 + i * TAU / np;
  let cmax = 0; for (let i = 0; i < np; i++) cmax = Math.max(cmax, Math.abs(Math.cos(axis(i))), Math.abs(Math.sin(axis(i))));
  const R0 = (w / 2 - 640) / cmax, rEdge = w / 2 * 1.5;
  const P = (i, r, d) => ({ x: cx + dcos(axis(i) + d) * r, y: cy + dsin(axis(i) + d) * r });
  const at = (i, r, side) => P(i, r, side / Math.max(r, 1));
  for (let i = 0; i < np; i++) { const p = P(i, R0, 0); map.starts.push({ x: p.x, y: p.y, ang: axis(i) + Math.PI }); }
  const mir = rng() < 0.5;
  map.rand = { mir, np };
  /* Gedrehte Kopie: alles, was für Sektor 0 entstanden ist, exakt in die anderen Sektoren drehen (Vorkommen, Felsen,
     Felder, Nebel, Stätten, Trümmerfelder) – so ist die Karte genau drehsymmetrisch und jeder Start bekommt dasselbe */
  const KEYS = ['nodes', 'rocks', 'fields', 'nebs', 'sites', 'debris'];
  const rot = (o, k) => { const a = k * TAU / np, c = dcos(a), s = dsin(a), dx = o.x - cx, dy = o.y - cy; return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }; };
  const mark = () => { const m = {}; for (const key of KEYS) m[key] = (map[key] || []).length; return m; };
  const copyLines = (mk) => {
    for (const key of KEYS) { const arr = map[key] || (map[key] = []), n = arr.length; for (let k = 1; k < np; k++) for (let j = mk[key]; j < n; j++) { const o = arr[j], q = rot(o, k); arr.push(Object.assign({}, o, q, o.seed !== undefined ? { seed: ((o.seed || 0) * 7 + 13 * k) % 1000003 } : {}, o.ang !== undefined ? { ang: o.ang + k * TAU / np } : {})); } }
  };
  /* Heimvorkommen wie auf den Ringkarten */
  { const mk = mark(); let p = at(0, R0 - 60, 330); iceMoon(map, p.x, p.y, rng); p = at(0, R0 - 60, -330); oreCluster(map, p.x, p.y, rng, 3); copyLines(mk); }
  /* frei für alle Kopien? (Punkt im Sektor 0, Radius rad) */
  const clear = (r, d, rad) => {
    const ds = mir && Math.abs(Math.abs(d) - half) > 0.02 && Math.abs(d) > 0.03 ? [d, -d] : [d];
    for (const dd of ds) for (let i = 0; i < np; i++) {
      const p = P(i, r, dd);
      if (p.x < EDGE + rad + 70 || p.y < EDGE + rad + 70 || p.x > w - EDGE - rad - 70 || p.y > w - EDGE - rad - 70) return false;
      if (!farFrom(map.starts, p.x, p.y, rad + 520)) return false;
      if (!farFrom(map.nodes, p.x, p.y, rad + 70) || !farFrom(map.sites, p.x, p.y, rad + 90) || !farFrom(map.nebs, p.x, p.y, rad + 30) || !farFrom(map.fields, p.x, p.y, rad + 20) || !farFrom(map.debris || [], p.x, p.y, rad + 30)) return false;
      for (const o of map.rocks) if (hyp(o.x - p.x, o.y - p.y) < o.r + rad + 20) return false;
    }
    return true;
  };
  /* Punkt-Inhalt in alle Sektoren (bei Spiegelung auch gespiegelt, außer auf der Achse und auf der Grenze) */
  const put = (r, d, fn) => { const ds = mir && Math.abs(Math.abs(d) - half) > 0.02 && Math.abs(d) > 0.03 ? [d, -d] : [d], mk = mark(); for (const dd of ds) fn(P(0, r, dd)); copyLines(mk); };
  const pick = (rad, rlo, rhi, dlo, dhi, tries) => { for (let k = 0; k < (tries || 14); k++) { const r = R0 * (rlo + rng() * (rhi - rlo)), d = half * (dlo + rng() * (dhi - dlo)) * (mir ? 1 : (rng() < 0.5 ? -1 : 1)); if (clear(r, d, rad)) return [r, d]; } return null; };
  /* Mitte: große Stätte, Schmiede oder offenes Feld mit Vorkommen */
  const center = rng();
  if (center < 0.45) bigSites(map, [{ x: cx, y: cy }], rng, 1);
  else if (center < 0.7) site(map, 'forge', cx, cy);
  else iceMoon(map, cx, cy, rng, true);
  /* Vorkommen auf den Grenzen nahe der Mitte (gleich weit von beiden Nachbarn) */
  { const r = Math.max(420, R0 * (0.24 + rng() * 0.1)); if (clear(r, half, 80)) put(r, half, p => (rng() < 0.5 ? iceMoon(map, p.x, p.y, rng) : oreCluster(map, p.x, p.y, rng, 3))); }
  /* Tasche um die Basis (mit einem oder zwei Zugängen) */
  if (!simple && rng() < 0.45) {
    const mk = mark(), s = map.starts[0], base = axis(0) + Math.PI, Rp = 560 + rng() * 80, two = rng() < 0.65, sd = rng() < 0.5 ? 1 : -1;
    pocket(map, s, Rp, base + 1.9, base - 1.9, rng, two ? [[base + 0.55 * sd, 230], [base - 0.55 * sd, 230]] : [[base, 250]], 130);
    copyLines(mk);
  }
  /* Felswände zwischen den Sektoren mit Lücke (Engstellen), manchmal mit Pfropfen in einer zweiten Lücke */
  const walls = !simple && rng() < 0.55;
  if (walls) {
    const mk = mark(), b = axis(0) + half, rIn = Math.max(700, R0 * (0.3 + rng() * 0.15)), rg = rIn + (R0 - rIn) * (0.25 + rng() * 0.4), pts = [];
    for (let r = rIn; r <= rEdge; r += 80) pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r]);
    const L = pathLen(pts), gt = (rg - rIn) / (rEdge - rIn), plugged = rng() < 0.6, pt = clamp(gt + (rng() < 0.5 ? 1 : -1) * 520 / L, 0.05, 0.95);
    const gaps = [[gt, 240]].concat(plugged && Math.abs(pt - gt) * L > 380 ? [[pt, 240]] : []);
    wall(map, pts, rng, gaps, 26);
    if (gaps.length > 1) plugGap(map, pts, pt, 210, rng);
    copyLines(mk);
  }
  /* Ausbau: Eis und Erz im Sektor */
  let q = pick(80, 0.42, 0.75, 0.2, 0.75); if (q) put(q[0], q[1], p => iceMoon(map, p.x, p.y, rng));
  q = pick(80, 0.4, 0.8, 0.15, 0.8); if (q) put(q[0], q[1], p => oreCluster(map, p.x, p.y, rng, 3));
  if (rng() < 0.5) { q = pick(70, 0.3, 0.6, 0.3, 0.9); if (q) put(q[0], q[1], p => oreCluster(map, p.x, p.y, rng, 2)); }
  /* Ruine auf der Grenze */
  { const r = R0 * (0.5 + rng() * 0.3); if (clear(r, half, 60)) put(r, half, p => site(map, 'ruin', p.x, p.y)); }
  /* Nebel: Ionennebel als Hinterhalt, manchmal eine Aschewolke */
  q = pick(150, 0.45, 0.85, 0.2, 0.9); if (q) { const nr = 115 + Math.round(rng() * 40); put(q[0], q[1], p => nebula(map, p.x, p.y, nr, 'ion')); }
  if (rng() < 0.45) { q = pick(110, 0.3, 0.7, 0.1, 0.9); if (q) put(q[0], q[1], p => nebula(map, p.x, p.y, 105, 'ash')); }
  /* Asteroidenfelder: offene Fläche mit Engstellen */
  const nf = 1 + (rng() < 0.6 ? 1 : 0) + (simple ? -1 : 0);
  for (let k = 0; k < nf; k++) { q = pick(140, 0.3, 0.8, 0.1, 0.95); if (!q) continue; const mk = mark(), p0 = P(0, q[0], q[1]); field(map, p0.x, p0.y, 110 + rng() * 40, rng, 0.9); if (mir && Math.abs(q[1]) > 0.03 && Math.abs(Math.abs(q[1]) - half) > 0.02) { const p1 = P(0, q[0], -q[1]); field(map, p1.x, p1.y, map.fields[map.fields.length - 1].r, rng, 0.9); } copyLines(mk); }
  /* Trümmerfeld als Deckung */
  q = pick(160, 0.35, 0.75, 0.1, 0.8); if (q) put(q[0], q[1], p => debris(map, p.x, p.y, 160));
  /* Streufelsen, für alle Sektoren gleich */
  { const mk = mark(); for (let k = 0, t = 0; k < 4 && t < 120; t++) { const r = 500 + rng() * (R0 - 200), d = (rng() * 2 - 1) * half * 0.9, rr = 10 + rng() * 14; if (!clear(r, d, rr + 140)) continue; const p = P(0, r, d); map.rocks.push({ x: p.x, y: p.y, r: rr, ang: rng() * TAU, seed: (rng() * 1e6) | 0 }); k++; } copyLines(mk); }
  map.rocks = map.rocks.filter(o => o.x > -40 && o.y > -40 && o.x < w + 40 && o.y < w + 40);
}
function genRandom(map, np, rng) {
  for (let k = 0; k < 10; k++) {
    for (const key of ['starts', 'nodes', 'rocks', 'fields', 'nebs', 'sites', 'gates']) map[key] = [];
    map.debris = [];
    genRandomTry(map, np, rng, k >= 6);
    buildNav(map);
    if (mapReachable(map)) { map.rand.tries = k + 1; return; }
  }
}
