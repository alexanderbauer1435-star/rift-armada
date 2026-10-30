/* ===== sim.js ===== */
'use strict';
/* =====================================================================
   SIMULATION – Spielzustand, Befehle, Gebäude, Wirtschaft, Sicht, Sieg
   Feste Schrittweite (30 Hz), keine DOM-Zugriffe, kein Math.random. Bewegung, Waffen und Schaden stehen in combat.js.
   Objekte: k = 1 Schiff, 2 Gebäude, 3 Ressourcenfeld. Jedes hat id, x, y, owner (Felder −1).
   ===================================================================== */
const CELL = 128;                            // Rasterzelle für Nachbarschaftsabfragen
const VIS = 64;                              // Rasterzelle der Sicht
const SENSOR_B = { base: 520, turret: 420, flak: 420, yard: 400, refinery: 360, reactor: 320, lab: 380, shield: 340, relay: 420 };
const ASH_DMG = 0.016;                       // Hüllenverlust je Sekunde im Aschenebel (Anteil)
const YARD_REPAIR = 0.03;                    // Reparatur je Sekunde an der Werft (Anteil der Hülle)

function ev(g, t, o) { o.t = t; g.ev.push(o); }
function lvOf(b) { return b.def.lv[b.lv - 1]; }
function bdef(g, pi, role) { return BLDG[g.players[pi].faction][role]; }
function cost(c) { return c || { ice: 0, ore: 0 }; }
/* Baukosten einer Station für einen Spieler (Nexus-Knoten mit Doktrin billiger) */
/* Schiffskosten eines Spielers (Brood: Schwärme, Großschiffe und Larven je nach Doktrin und Forschung billiger) */
function shipCost(p, def) {
  let m = 1;
  if (def.swarm) m *= p.tfx.swarmCost;
  if (def.cls === 'l' && !def.flag) m *= p.tfx.bigCost;
  if (def.id === 'larva') m *= p.tfx.larvaCost;
  if (m === 1) return def.cost;
  return { ice: Math.round(def.cost.ice * m), ore: Math.round(def.cost.ore * m) };
}
/* Einnahmen gutschreiben: die Brood macht aus allem Biomasse (Eis) */
function earn(p, kind, amt) { if (kind === 'ore' && !p.F.bio) p.ore += amt; else p.ice += amt; p.stats.earned += amt; }
function bcost(p, def) { const c = cost(def.lv[0].cost); if (def.role === 'relay' && p.tfx.nodeCost !== 1) return { ice: Math.round(c.ice * p.tfx.nodeCost), ore: Math.round(c.ore * p.tfx.nodeCost) }; return c; }
function canPay(p, c) { c = cost(c); return p.ice >= c.ice && p.ore >= c.ore; }
function pay(p, c) { c = cost(c); p.ice -= c.ice; p.ore -= c.ore; p.stats.spent += c.ice + c.ore; }
function refund(p, c, f) { c = cost(c); p.ice += Math.floor(c.ice * f); p.ore += Math.floor(c.ore * f); }
function teamOf(g, pi) { return pi < 0 ? -1 : g.tm[pi]; }
function foes(g, a, b) { return a >= 0 && b >= 0 && g.tm[a] !== g.tm[b]; }

/* ------------------------------------------------------------------ Aufbau */
function createGame(opts) {
  /* KARTENEDITOR: opts.custom trägt das Layout einer eigenen Karte (Spielstand und Mehrspieler bauen sie daraus identisch nach) */
  const np = opts.players.length, mapId = opts.mis ? 'mission' : opts.custom ? 'custom' : mapFor(opts.map || 'haven', np);
  const map = opts.mis ? misMap(opts.mis.id, opts.seed || 1, opts.mis) : generateMap(mapId, np, opts.seed || 1, opts.size, opts.custom);
  const g = {
    map, rng: makeRng((opts.seed || 1) * 7919 + 13), tick: 0, time: 0, players: [], ships: [], bldgs: [], nodes: [], proj: [], wrecks: [], ev: [],
    byId: new Map(), nextId: 1, over: false, winner: -1, winTeam: -1, opts, human: -1, tm: [], deadFlag: false, bDied: false, reveals: [], strikes: [], flares: [], sites: [], gates: [], events: [], neutral: -1, spores: [], mines: [], threat: -1, wave: null,
    gw2: Math.ceil(map.w / CELL), gh2: Math.ceil(map.h / CELL), cells: null, cellsUsed: [], visStamp: 1, vw: Math.ceil(map.w / VIS), vh: Math.ceil(map.h / VIS), teamVis: {}, log: []
  };
  g.cells = new Array(g.gw2 * g.gh2);
  for (let i = 0; i < g.cells.length; i++) g.cells[i] = [];
  for (const n of map.nodes) { const o = { k: 3, id: g.nextId++, x: n.x, y: n.y, r: n.r, kind: n.kind, amount: n.amount, max: n.amount, miners: 0, owner: -1, ang: n.ang, seed: n.seed || 0 }; g.nodes.push(o); g.byId.set(o.id, o); }
  for (let i = 0; i < np; i++) {
    const po = opts.players[i], team = po.team !== undefined ? po.team : i;
    g.tm.push(team);
    const p = {
      id: i, faction: po.faction, F: FACTIONS[po.faction], human: !!po.human, ai: null, color: po.color || null, team, name: po.name || null, nob: po.base === false,
      ice: opts.res ? opts.res.ice : START_RES.ice, ore: opts.res ? opts.res.ore : START_RES.ore, eGen: 0, eUse: 0, lowPower: false, cpUse: 0, cpMax: CP_BASE,
      alive: true, lab: 0, start: map.starts[po.start !== undefined && map.starts[po.start] ? po.start : i] || { x: map.w / 2, y: map.h / 2, ang: 0 }, incAcc: 0, haulR: 0, shipCount: 0, queued: 0, lowT: -99, hurtT: -99, hurtX: 0, hurtY: 0, tech: {}, research: null, tfx: Object.assign({}, TFX0), doctrine: null, docAsk: false, relics: 0, heroIdx: 0, neutral: !!po.neutral, netT: 0, etech: null,
      vis: null, explored: new Uint8Array(g.vw * g.vh), stats: { built: 0, lost: 0, kills: 0, bLost: 0, razed: 0, earned: 0, spent: 0 }
    };
    if (po.human) g.human = i;
    if (po.ai) p.ai = aiInit(po.ai);
    g.players.push(p);
  }
  /* Neutrale Partei für Wächter und Fallen (Team 99, mit allen verfeindet) */
  if (map.sites.length || map.gates.length) {
    const i = g.players.length;
    g.tm.push(99);
    g.players.push({ id: i, faction: 'guardian', F: FACTIONS.guardian, human: false, ai: null, color: null, team: 99, ice: 0, ore: 0, eGen: 0, eUse: 0, lowPower: false, cpUse: 0, cpMax: 999, alive: true, lab: 0, start: { x: map.w / 2, y: map.h / 2, ang: 0 }, incAcc: 0, haulR: 0, shipCount: 0, queued: 0, lowT: -99, hurtT: -99, hurtX: 0, hurtY: 0, tech: {}, research: null, tfx: Object.assign({}, TFX0), doctrine: null, docAsk: false, relics: 0, heroIdx: 0, neutral: true, netT: 0, etech: null, vis: null, explored: new Uint8Array(g.vw * g.vh), stats: { built: 0, lost: 0, kills: 0, bLost: 0, razed: 0, earned: 0, spent: 0 } });
    g.neutral = i;
  }
  /* Piraten: eigene Partei (Team 97, mit allen verfeindet, zählt nicht für den Sieg) für die Festung in der Kartenmitte */
  if (map.fort) {
    const i = g.players.length;
    g.tm.push(97);
    g.players.push({ id: i, faction: 'mars', F: FACTIONS.mars, human: false, ai: null, color: PIRATE_COL, name: 'Piraten', team: 97, ice: 0, ore: 0, eGen: 0, eUse: 0, lowPower: false, cpUse: 0, cpMax: 999, alive: true, lab: 0, start: { x: map.fort.x, y: map.fort.y, ang: 0 }, incAcc: 0, haulR: 0, shipCount: 0, queued: 0, lowT: -99, hurtT: -99, hurtX: 0, hurtY: 0, tech: {}, research: null, tfx: Object.assign({}, TFX0), doctrine: null, docAsk: false, relics: 0, heroIdx: 0, neutral: true, pirate: true, netT: 0, etech: null, vis: null, explored: new Uint8Array(g.vw * g.vh), stats: { built: 0, lost: 0, kills: 0, bLost: 0, razed: 0, earned: 0, spent: 0 } });
    g.pirate = i;
  }
  g.pace = PACE[opts.pace] || PACE.tactical;
  g.teamVisN = {};
  for (const p of g.players) { if (!g.teamVis[p.team]) { g.teamVis[p.team] = new Int32Array(g.vw * g.vh); g.teamVisN[p.team] = new Int32Array(g.vw * g.vh); } p.vis = g.teamVis[p.team]; p.visN = g.teamVisN[p.team]; }
  /* Stätten und Tore als Objekte mit Kennung (antippbar) */
  for (const st of map.sites) { const o = { k: 4, id: g.nextId++, kind: st.kind, x: st.x, y: st.y, r: st.r, owner: -1, prog: 0, by: -1, done: false, scanned: false, used: [], guard: [], woke: false, holdT: 0, name: SITE_DEF[st.kind].name, ang: 0, seed: (st.x * 7 + st.y * 13) & 0xffff }; g.sites.push(o); g.byId.set(o.id, o); }
  for (let i = 0; i < map.gates.length; i++) { const gt = map.gates[i]; const o = { k: 5, id: g.nextId++, x: gt.x, y: gt.y, r: gt.r, state: gt.state, owner: -1, mode: 'bridge', prog: 0, by: -1, charge: 0, overload: 0, warnT: 0, pairIdx: gt.pair, pair: 0, name: 'Sprungtor', ang: 0 }; g.gates.push(o); g.byId.set(o.id, o); }
  for (const o of g.gates) o.pair = g.gates[o.pairIdx].id;
  /* Wächter: Drohnen an der Zitadelle, die schlafende Maschine am Wächter */
  if (g.neutral >= 0) for (const st of g.sites) {
    if (st.kind === 'citadel') for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, u = addShip(g, 'drone', g.neutral, st.x + dcos(a) * (st.r + 70), st.y + dsin(a) * (st.r + 70), a); u.hx = u.x; u.hy = u.y; u.o = { t: 'hold' }; u.hold = true; st.guard.push(u.id); }
    if (st.kind === 'warden') { const u = addShip(g, 'warden', g.neutral, st.x, st.y, 0); u.stance = 2; u.o = { t: 'hold' }; u.hold = true; u.asleep = 1; st.guard.push(u.id); }
  }
  if (map.fort) fortSetup(g);
  /* Sonneneruptionen auf den größeren Karten */
  if (mapId !== 'haven' && mapId !== 'test' && mapId !== 'mission') g.events.push({ kind: 'flare', at: 420 + Math.floor(g.rng() * 180), state: 0 });
  /* Startaufstellung: Kommandobasis, Raffinerie am Eismond, zwei Frachter, ein Bauschiff, eine Korvette */
  for (const p of g.players) {
    if (p.neutral || p.nob) continue;
    const s = p.start, dir = s.ang;
    const base = addBldg(g, 'base', p.id, s.x, s.y, true);
    const near = g.nodes.filter(n => n.kind === 'ice').sort((a, b) => hyp(a.x - s.x, a.y - s.y) - hyp(b.x - s.x, b.y - s.y))[0];
    let rx = s.x + dcos(dir) * 200, ry = s.y + dsin(dir) * 200;
    if (near) { const d = hyp(near.x - s.x, near.y - s.y), k = (d - near.r - 120) / d; rx = s.x + (near.x - s.x) * k; ry = s.y + (near.y - s.y) * k; }
    const ref = addBldg(g, 'refinery', p.id, rx, ry, true);
    const spawn = (id, ox, oy) => addShip(g, id, p.id, s.x + ox, s.y + oy, dir);
    const t1 = spawn(TANKER[p.faction], dcos(dir + 1.2) * 110, dsin(dir + 1.2) * 110), t2 = spawn(TANKER[p.faction], dcos(dir - 1.2) * 110, dsin(dir - 1.2) * 110);
    spawn(BUILDER[p.faction], dcos(dir) * 120, dsin(dir) * 120);
    spawn(CORVETTE[p.faction] || 'wren', dcos(dir + 0.5) * 150, dsin(dir + 0.5) * 150);
    if (near) { cmdHarvest(g, [t1], near); t1.o.auto = 1; }
    const nearO = nearestNode(g, s.x, s.y, 'ore', 900);
    cmdHarvest(g, [t2], nearO || near); t2.o.auto = 1;
    recalcPower(g, p.id); recalcCp(g, p.id);
    void base; void ref;
  }
  if (opts.sandbox) sandboxSetup(g);
  if (opts.mode === 'survival' || opts.mode === 'quarantine') waveSetup(g, opts);
  if (opts.mis) misInit(g);
  updateVision(g);
  return g;
}
/* Übungsplatz: der Mensch bekommt Werft III, Labor III, Reaktoren, alle Techniken und die Doktrinwahl; der Gegner
   bekommt Zielscheiben (Schiffe mit »Feuer halten«) und eine kleine Basis mit Turm. Zerstörte Zielscheiben kommen wieder. */
function sandboxSetup(g) {
  const me = g.human >= 0 ? g.players[g.human] : g.players[0], s = me.start, dir = s.ang;
  const put = (role, ox, oy, lv) => { const x = s.x + ox, y = s.y + oy; if (canPlace(g, me.id, role, x, y)) return null; const b = addBldg(g, role, me.id, x, y, true); b.lv = lv || 1; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield * me.tfx.shield; b.shield = b.shieldMax; return b; };
  const base = g.bldgs.find(b => b.owner === me.id && b.role === 'base'); base.lv = 3; const bl = lvOf(base); base.hull = base.hullMax = bl.hull; base.shieldMax = bl.shield; base.shield = bl.shield; base.wcd = bl.wpn.map(() => 0);
  put('yard', dcos(dir + 2.2) * 240, dsin(dir + 2.2) * 240, 3);
  put('lab', dcos(dir - 2.2) * 240, dsin(dir - 2.2) * 240, 3);
  put('reactor', dcos(dir + 2.9) * 300, dsin(dir + 2.9) * 300, 2);
  put('reactor', dcos(dir - 2.9) * 300, dsin(dir - 2.9) * 300, 2);
  put('relay', dcos(dir + 1.4) * 330, dsin(dir + 1.4) * 330, 2);
  for (const t of TECH[me.faction]) me.tech[t.id] = 1;
  me.docAsk = true;
  /* ganze Karte sichtbar */
  g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: Math.max(g.map.w, g.map.h), owner: me.id, until: 1e9 });
  recalcTech(g, me); recalcPower(g, me.id); recalcCp(g, me.id);
  for (const p of g.players) if (p !== me && !p.neutral) { const b = g.bldgs.find(q => q.owner === p.id && q.role === 'base'); if (b) { b.lv = 2; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield; b.shield = b.shieldMax; b.wcd = l.wpn.map(() => 0); } const y = addBldg(g, 'yard', p.id, p.start.x + dcos(p.start.ang + 2) * 220, p.start.y + dsin(p.start.ang + 2) * 220, true); void y; const t = addBldg(g, 'turret', p.id, p.start.x + dcos(p.start.ang) * 230, p.start.y + dsin(p.start.ang) * 230, true); void t; recalcPower(g, p.id); }
  sandboxSpawn(g);
}
function sandboxSpawn(g) {
  const me = g.human >= 0 ? g.human : 0, cx = g.map.w / 2, cy = g.map.h / 2;
  for (const p of g.players) {
    if (p.id === me || !p.alive || p.neutral) continue;
    const have = g.ships.filter(u => !u.dead && u.owner === p.id && u.dummy).length;
    if (have >= 4) continue;
    const list = Object.values(SHIPS).filter(d => d.f === p.faction && d.role === 'war' && !d.hidden && !d.flag && !d.doc && d.wpn.length);
    const a0 = datan2(p.start.y - cy, p.start.x - cx);
    for (let i = have; i < 6; i++) { const d = list[(g.rng() * list.length) | 0], a = a0 + (i - 2.5) * 0.35, r = 260 + (i % 2) * 90; const u = addShip(g, d.id, p.id, cx + dcos(a) * r, cy + dsin(a) * r, a + Math.PI); u.stance = 2; u.o = { t: 'hold' }; u.hold = true; u.auto = false; u.dummy = 1; }
    ev(g, 'sandbox', { owner: p.id });
  }
}

function addShip(g, defId, owner, x, y, ang) {
  const def = SHIPS[defId], p = g.players[owner];
  const u = {
    k: 1, id: g.nextId++, def, type: defId, owner, x, y, ang: ang || 0, v: 0, hull: def.hull * p.tfx.hull, hullMax: def.hull * p.tfx.hull, shield: def.shield * p.tfx.shield, shieldMax: def.shield * p.tfx.shield, sT: 99,
    xp: 0, rank: 0, o: { t: 'idle' }, hx: x, hy: y, wcd: def.wpn.map(() => 0), tgt: 0, cargo: 0, ckind: '', path: null, pi: 0, stuck: 0, grp: 0, stance: 0, hold: false,
    beams: null, dead: false, mine: 0, kills: 0, par: 0, born: g.time, cls: CLS_IDX[def.cls] || 0, wait: 0, pt: 0, fr: 0,
    sub: { drive: 1, wpn: 1, shield: 1, sensor: 1, life: 1 }, crew: def.crew, crewMax: def.crew, marines: def.marines ? Math.round(def.marines * p.tfx.marines) : 0, boarding: 0, boardBy: -1, derelict: false,
    abcd: {}, abT: {}, abx: 0, dis: 0, truce: 0, marked: 0, markT: -1, sprint: 0, dome: 0, auto: true, derT: 0, crus: 0, blessT: 0, pull: null, snapH: 0, snapS: 0, rampT: 0, rampTid: 0, resUsed: 0, adapt: null, acid: null, para: null, cocoon: null, frenzy: 0, until: 0, nocp: 0, hmul: 1
  };
  if (def.swarm && p.tfx.swarm) { u.hmul = (def.swarm + p.tfx.swarm) / def.swarm; u.hull *= u.hmul; u.hullMax *= u.hmul; }
  if (def.hero) { u.hero = HERO_NAMES[(p.heroIdx * 7 + owner * 3) % HERO_NAMES.length]; p.heroIdx++; }
  if (def.adapt) u.adapt = {};
  g.ships.push(u); g.byId.set(u.id, u);
  if (def.role !== 'fighter') { p.shipCount += def.cp; p.stats.built++; }
  if (def.hangar) u.hangar = { n: 0, t: 0, ids: [] };
  return u;
}
function addBldg(g, role, owner, x, y, instant) {
  const def = bdef(g, owner, role), lv = def.lv[0];
  const b = {
    k: 2, id: g.nextId++, def, role, owner, x, y, ang: 0, lv: 1, hull: instant ? lv.hull : lv.hull * 0.08, hullMax: lv.hull, shield: instant ? lv.shield * g.players[owner].tfx.shield : 0, shieldMax: lv.shield * g.players[owner].tfx.shield, sT: 99,
    done: !!instant, prog: instant ? 1 : 0, upg: null, q: [], qp: 0, rally: null, wcd: lv.wpn.map(() => 0), tgt: 0, dead: false, bld: 0, give: 0, givep: 0, bT: 0, beams: null, docks: 0, crew: 60 + def.r, crewMax: 60 + def.r, boarding: 0, boardBy: -1, charge: 0, marked: 0
  };
  g.bldgs.push(b); g.byId.set(b.id, b);
  navBlock(g.map, x, y, def.r, true);
  return b;
}

/* ------------------------------------------------------------------ Raster und Nachbarschaft */
function rebuildGrid(g) {
  const cells = g.cells, used = g.cellsUsed;
  for (let i = 0; i < used.length; i++) cells[used[i]].length = 0;
  used.length = 0;
  const gw = g.gw2, gh = g.gh2;
  for (const u of g.ships) {
    if (u.dead) continue;
    const c = clamp((u.y / CELL) | 0, 0, gh - 1) * gw + clamp((u.x / CELL) | 0, 0, gw - 1);
    if (!cells[c].length) used.push(c);
    cells[c].push(u);
  }
}
/* Schiffe im Umkreis r (Raster), fn(u) → true bricht ab */
function nearShips(g, x, y, r, fn) {
  const gw = g.gw2, gh = g.gh2, x0 = clamp(((x - r) / CELL) | 0, 0, gw - 1), x1 = clamp(((x + r) / CELL) | 0, 0, gw - 1), y0 = clamp(((y - r) / CELL) | 0, 0, gh - 1), y1 = clamp(((y + r) / CELL) | 0, 0, gh - 1);
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const cell = g.cells[cy * gw + cx];
    for (let i = 0; i < cell.length; i++) { const u = cell[i]; if (u.dead) continue; const dx = u.x - x, dy = u.y - y; if (dx * dx + dy * dy <= r2 && fn(u)) return; }
  }
}

/* ------------------------------------------------------------------ Sicht */
function markVis(vis, explored, vw, vh, stamp, x, y, r) {
  const cx = x / VIS, cy = y / VIS, rr = r / VIS, x0 = Math.max(0, (cx - rr) | 0), x1 = Math.min(vw - 1, (cx + rr) | 0), y0 = Math.max(0, (cy - rr) | 0), y1 = Math.min(vh - 1, (cy + rr) | 0), r2 = rr * rr;
  for (let gy = y0; gy <= y1; gy++) { const dy = gy + 0.5 - cy; for (let gx = x0; gx <= x1; gx++) { const dx = gx + 0.5 - cx; if (dx * dx + dy * dy <= r2) { const i = gy * vw + gx; vis[i] = stamp; explored[i] = 1; } } }
}
/* Geschütze, Flak und Kommandobasen entdecken getarnte Schiffe (und Schiffe im Ionennebel) in ihrer Waffenreichweite */
const DETECT_B = { turret: 1, flak: 1, base: 1 };
function updateVision(g) {
  g.visStamp++;
  const st = g.visStamp, vw = g.vw, vh = g.vh;
  /* Ionennebel: wer darin steht, sieht nur ION_SEE weit (u.ion) und wird selbst nur aus der Nähe gesehen (Nahsicht visN) */
  for (const u of g.ships) { if (u.dead) continue; const p = g.players[u.owner]; u.ion = inIon(g.map, u.x, u.y); let r = u.def.sensor * p.tfx.sensor * (0.4 + 0.6 * u.sub.sensor); if (u.ion) r = Math.min(r, ION_SEE); markVis(p.vis, p.explored, vw, vh, st, u.x, u.y, r); if (!p.visN) p.visN = g.teamVisN[p.team] || (g.teamVisN[p.team] = new Int32Array(vw * vh)); markVis(p.visN, p.explored, vw, vh, st, u.x, u.y, ION_SEE); }
  for (let i = g.reveals.length - 1; i >= 0; i--) { const r = g.reveals[i]; if (g.time > r.until) { g.reveals.splice(i, 1); continue; } const p = g.players[r.owner]; markVis(p.vis, p.explored, vw, vh, st, r.x, r.y, r.r); if (p.visN && r.r < 3000) markVis(p.visN, p.explored, vw, vh, st, r.x, r.y, r.r); }
  for (const b of g.bldgs) { if (b.dead) continue; const p = g.players[b.owner]; markVis(p.vis, p.explored, vw, vh, st, b.x, b.y, b.done ? (SENSOR_B[b.role] || 360) : 220); if (!p.visN) p.visN = g.teamVisN[p.team] || (g.teamVisN[p.team] = new Int32Array(vw * vh)); markVis(p.visN, p.explored, vw, vh, st, b.x, b.y, b.done && DETECT_B[b.role] ? Math.max(ION_SEE, maxRange(lvOf(b))) : ION_SEE); }
  /* Verbündete teilen Sicht: dieselbe Tabelle je Team; erkundet nachziehen */
  for (const p of g.players) for (const q of g.players) if (q !== p && q.team === p.team) { const e = p.explored, f = q.explored; for (let i = 0; i < e.length; i++) if (f[i]) e[i] = 1; }
}
function canSee(g, pi, e) {
  if (pi < 0) return true;
  if (e.k !== 3 && e.owner >= 0 && g.tm[e.owner] === g.tm[pi]) return true;
  const p = g.players[pi], vis = e.k === 1 && (e.ion || e.abT.cloak > 0) ? p.visN : p.vis, cx = clamp((e.x / VIS) | 0, 0, g.vw - 1), cy = clamp((e.y / VIS) | 0, 0, g.vh - 1);
  return vis[cy * g.vw + cx] === g.visStamp;
}
function visAt(g, pi, x, y) { const vis = g.players[pi].vis, cx = clamp((x / VIS) | 0, 0, g.vw - 1), cy = clamp((y / VIS) | 0, 0, g.vh - 1); return vis[cy * g.vw + cx] === g.visStamp; }

/* ------------------------------------------------------------------ Energie und Kommandopunkte */
function recalcPower(g, pi) {
  const p = g.players[pi];
  let gen = 0, use = 0;
  for (const b of g.bldgs) { if (b.dead || b.owner !== pi || !b.done || b.off) continue; const e = lvOf(b).energy || 0; if (e > 0) gen += e; else use -= e; }
  gen = Math.round(gen * p.tfx.energy) + (p.forge ? 60 : 0);
  p.eGen = gen; p.eUse = use;
  const low = use > gen;
  if (low && !p.lowPower && g.time - p.lowT > 20) { p.lowT = g.time; ev(g, 'lowpower', { owner: pi }); }
  p.lowPower = low;
}
function recalcCp(g, pi) {
  const p = g.players[pi];
  let max = CP_BASE, use = 0, q = 0;
  for (const b of g.bldgs) { if (b.dead || b.owner !== pi) continue; if (b.done && !b.off) max += lvOf(b).cp || 0; for (const it of b.q) q += SHIPS[it.id].cp; }
  for (const u of g.ships) if (!u.dead && u.owner === pi && u.def.role !== 'fighter') use += u.def.cp;
  p.cpMax = max + (p.cpBonus || 0); p.cpUse = use; p.queued = q;
}
function hasBldg(g, pi, role, needDone) { for (const b of g.bldgs) if (!b.dead && b.owner === pi && b.role === role && (!needDone || b.done)) return b; return null; }
function anyBldg(g, pi) { return hasBldg(g, pi, 'base', false) || g.bldgs.find(b => !b.dead && b.owner === pi) || null; }
function labLevel(g, pi) { const l = hasBldg(g, pi, 'lab', true); return l ? l.lv : 0; }

/* ------------------------------------------------------------------ Bauen */
function buildReq(g, pi, role) {
  const def = bdef(g, pi, role);
  if (!def || def.hidden) return 'Nicht möglich';
  const lk = g.players[pi].lock;
  if (lk && lk.bldgs && lk.bldgs.indexOf(role) < 0) return 'In dieser Mission nicht verfügbar';
  if (def.unique && hasBldg(g, pi, role, false)) return 'Nur einmal möglich';
  if (role !== 'base' && !hasBldg(g, pi, 'base', true)) return 'Benötigt Kommandobasis';
  if (def.req) { let b = null; for (const q of g.bldgs) if (!q.dead && q.owner === pi && q.role === 'base' && q.done && (!b || q.lv > b.lv)) b = q; if (def.req.base && (!b || b.lv < def.req.base)) return 'Benötigt Kommandobasis Stufe ' + ROMAN[def.req.base]; if (def.req.lab && labLevel(g, pi) < def.req.lab) return 'Benötigt Labor Stufe ' + ROMAN[def.req.lab]; }
  return null;
}
/* Platzprüfung: nicht im Aschenebel, nicht auf Felsen, Feldern, Ressourcen oder Gebäuden; nahe an einem eigenen Gebäude */
function canPlace(g, pi, role, x, y) {
  const def = bdef(g, pi, role), r = def.r, m = g.map;
  if (x - r < EDGE || y - r < EDGE || x + r > m.w - EDGE || y + r > m.h - EDGE) return 'Zu nahe am Aschenebel';
  for (const o of m.rocks) if (hyp(o.x - x, o.y - y) < o.r + r + 6) return 'Hier ist ein Asteroid im Weg';
  for (const o of m.fields) if (hyp(o.x - x, o.y - y) < o.r + r * 0.5) return 'Nicht im Asteroidenfeld';
  for (const o of m.nebs || []) if (hyp(o.x - x, o.y - y) < o.r + r * 0.5) return 'Nicht im Nebel';
  for (const o of g.nodes) if (hyp(o.x - x, o.y - y) < o.r + r + 30) return 'Zu nahe am Vorkommen';
  for (const b of g.bldgs) if (!b.dead && hyp(b.x - x, b.y - y) < b.def.r + r + 14) return 'Zu nahe an einer Station';
  for (const o of g.sites) if (hyp(o.x - x, o.y - y) < o.r + r + 20) return 'Zu nahe an einer Stätte';
  for (const o of g.gates) if (hyp(o.x - x, o.y - y) < o.r + r + 40) return 'Zu nahe am Tor';
  const p = g.players[pi];
  /* Außenbasis: überall, unabhängig von Reichweite und Netz – so kommt man an entfernte Vorkommen */
  if (role === 'base') return null;
  if (p.faction === 'nexus') { if (!netCovered(g, pi, x, y, true)) return 'Außerhalb des Netzes'; return null; }
  let ok = false;
  for (const b of g.bldgs) { if (b.dead || b.owner !== pi || !b.done) continue; const d = hyp(b.x - x, b.y - y); if (d < (b.role === 'base' ? BUILD_RANGE_BASE : BUILD_RANGE)) { ok = true; break; } }
  if (!ok) return 'Zu weit von der Basis';
  return null;
}
function cmdBuild(g, pi, uids, role, x, y) {
  const p = g.players[pi], def = bdef(g, pi, role);
  const why = buildReq(g, pi, role) || canPlace(g, pi, role, x, y);
  if (why) return why;
  if (!canPay(p, bcost(p, def))) return 'Nicht genug Rohstoffe';
  const us = uids.map(id => g.byId.get(id)).filter(u => u && !u.dead && u.owner === pi && u.def.build);
  if (!us.length) return 'Kein Bauschiff';
  pay(p, bcost(p, def));
  const b = addBldg(g, role, pi, x, y, false);
  for (const u of us) { u.o = { t: 'build', bid: b.id }; u.path = null; }
  ev(g, 'place', { x, y, owner: pi, id: b.id });
  return null;
}
/* Bauschiff an eine unfertige Station schicken (weiterbauen) */
function cmdResume(g, pi, uids, bid) {
  const b = g.byId.get(bid);
  if (!b || b.dead || b.k !== 2 || b.done || g.tm[b.owner] !== g.tm[pi]) return 'Nicht möglich';
  const us = uids.map(id => g.byId.get(id)).filter(u => u && !u.dead && u.owner === pi && u.def.build);
  if (!us.length) return 'Kein Bauschiff';
  for (const u of us) { u.o = { t: 'build', bid: b.id }; u.path = null; }
  return null;
}
function cmdUpgrade(g, pi, bid) {
  const b = g.byId.get(bid), p = g.players[pi];
  if (!b || b.dead || b.k !== 2 || b.owner !== pi) return 'Nicht möglich';
  if (!b.done) return 'Erst fertigstellen';
  if (b.upg) return 'Ausbau läuft schon';
  if (b.lv >= 3) return 'Höchste Stufe erreicht';
  const nxt = b.def.lv[b.lv];
  if (!canPay(p, nxt.cost)) return 'Nicht genug Rohstoffe';
  pay(p, nxt.cost);
  b.upg = { prog: 0, time: nxt.time };
  return null;
}
function finishUpgrade(g, b) {
  const was = lvOf(b);
  b.lv++;
  const lv = lvOf(b);
  b.hull = b.hull / was.hull * lv.hull; b.hullMax = lv.hull;
  const tf = g.players[b.owner].tfx.shield;
  b.shieldMax = lv.shield * tf; b.shield = Math.min(b.shieldMax, b.shield + (lv.shield - was.shield) * tf);
  b.wcd = lv.wpn.map(() => 0); b.upg = null;
  recalcPower(g, b.owner); recalcCp(g, b.owner);
  ev(g, 'upgrade', { owner: b.owner, id: b.id, lv: b.lv, x: b.x, y: b.y });
  if (b.role === 'base' && b.lv >= 2) askDoctrine(g, b.owner);
}
function askDoctrine(g, pi) { const p = g.players[pi]; if (p.doctrine || p.docAsk || (p.lock && p.lock.noDoc)) return; p.docAsk = true; ev(g, 'doctrine', { owner: pi }); }
function cmdDoctrine(g, pi, id) {
  const p = g.players[pi], d = doctrineDef(p.faction, id);
  if (!d) return 'Nicht möglich';
  if (p.doctrine) return 'Doktrin schon gewählt';
  const b = hasBldg(g, pi, 'base', true);
  if (!b || b.lv < 2) return 'Benötigt Kommandobasis Stufe II';
  p.doctrine = id;
  recalcTech(g, p);
  ev(g, 'doctrineSet', { owner: pi, id });
  return null;
}
function trainReq(g, pi, id) {
  const def = SHIPS[id], p = g.players[pi];
  if (!def || def.f !== p.faction || def.hidden) return 'Nicht möglich';
  if (p.lock && p.lock.ships && p.lock.ships.indexOf(id) < 0) return 'In dieser Mission nicht verfügbar';
  const yard = g.bldgs.some(b => !b.dead && b.owner === pi && b.role === 'yard' && b.done && b.lv >= def.yard);
  if (!yard) return def.yard > 1 ? 'Benötigt Werft Stufe ' + ROMAN[def.yard] : 'Benötigt Werft';
  if (def.tier > 1 && labLevel(g, pi) < def.tier - 1) return 'Benötigt Labor Stufe ' + ROMAN[def.tier - 1];
  if (def.doc && p.doctrine !== def.doc) return 'Benötigt Doktrin ' + doctrineDef(p.faction, def.doc).name;
  if (def.flag) { if (g.ships.some(u => !u.dead && u.owner === pi && u.type === id)) return 'Nur ein Flaggschiff'; if (g.bldgs.some(b => !b.dead && b.owner === pi && b.q.some(q => q.id === id))) return 'Flaggschiff wird schon gebaut'; }
  return null;
}
function cmdTrain(g, pi, bid, id) {
  const b = g.byId.get(bid), p = g.players[pi], def = SHIPS[id];
  if (!b || b.dead || b.k !== 2 || b.owner !== pi || b.role !== 'yard' || !b.done) return 'Nicht möglich';
  const why = trainReq(g, pi, id);
  if (why) return why;
  if (b.lv < def.yard) return 'Benötigt Werft Stufe ' + ROMAN[def.yard];
  if (b.q.length >= 5) return 'Warteschlange voll';
  if (p.cpUse + p.queued + def.cp > p.cpMax) return 'Kommandopunkte reichen nicht';
  const c = shipCost(p, def);
  if (!canPay(p, c)) return 'Nicht genug Rohstoffe';
  pay(p, c);
  b.q.push({ id, c });
  p.queued += def.cp;
  return null;
}
function cmdCancel(g, pi, bid, idx) {
  const b = g.byId.get(bid), p = g.players[pi];
  if (!b || b.dead || b.owner !== pi || !b.q[idx]) return 'Nicht möglich';
  const it = b.q.splice(idx, 1)[0];
  refund(p, it.c || SHIPS[it.id].cost, 1);
  if (idx === 0) b.qp = 0;
  recalcCp(g, pi);
  return null;
}
function cmdRally(g, pi, bid, x, y) {
  const b = g.byId.get(bid);
  if (!b || b.dead || b.owner !== pi) return 'Nicht möglich';
  b.rally = { x, y };
  return null;
}
function cmdSell(g, pi, bid) {
  const b = g.byId.get(bid), p = g.players[pi];
  if (!b || b.dead || b.owner !== pi || b.role === 'base' || b.role === 'seal') return 'Nicht möglich';
  let c = { ice: 0, ore: 0 };
  for (let i = 0; i < b.lv; i++) { const q = cost(b.def.lv[i].cost); c.ice += q.ice; c.ore += q.ore; }
  refund(p, c, b.done ? 0.5 : 0.8);
  removeBldg(g, b);
  ev(g, 'sold', { owner: pi, x: b.x, y: b.y });
  return null;
}

/* ------------------------------------------------------------------ Forschung */
function techDef(f, id) { for (const t of TECH[f]) if (t.id === id) return t; return null; }
function researchReq(g, pi, id) {
  const p = g.players[pi], t = techDef(p.faction, id);
  if (!t) return 'Nicht möglich';
  if (p.tech[id]) return 'Schon erforscht';
  const lab = hasBldg(g, pi, 'lab', true);
  if (!lab) return 'Benötigt Labor';
  if (lab.lv < t.lv) return 'Benötigt Labor Stufe ' + ROMAN[t.lv];
  if (p.research) return 'Forschung läuft schon';
  return null;
}
function cmdResearch(g, pi, id) {
  const p = g.players[pi], why = researchReq(g, pi, id);
  if (why) return why;
  const t = techDef(p.faction, id);
  if (!canPay(p, t.cost)) return 'Nicht genug Rohstoffe';
  pay(p, t.cost);
  p.research = { id, prog: 0, time: t.time, lab: 0 };
  return null;
}
function cmdCancelResearch(g, pi) {
  const p = g.players[pi];
  if (!p.research) return 'Nicht möglich';
  refund(p, techDef(p.faction, p.research.id).cost, 1 - p.research.prog * 0.5);
  p.research = null;
  return null;
}
/* Wirkung aller erforschten Technologien zusammenrechnen; laufende Schiffe und Stationen ziehen nach */
function recalcTech(g, p) {
  const fx = Object.assign({}, TFX0);
  const ADD = { armor: 1, grushFree: 1, drones: 1, bindAt: 1, bregen: 1, phase: 1, swarm: 1 };
  const apply = src => { for (const k in src) { if (ADD[k]) fx[k] += src[k]; else if (k === 'sdelay') fx.sdelay = Math.min(fx.sdelay, src[k]); else if (k === 'linkShare') fx.linkShare = src[k]; else fx[k] *= src[k]; } };
  for (const id in p.tech) { const t = techDef(p.faction, id); if (t) apply(t.fx); }
  if (p.doctrine) { const d = doctrineDef(p.faction, p.doctrine); if (d) apply(d.fx); }
  if (p.etech && ETECH[p.etech]) apply(ETECH[p.etech].fx);
  if (p.rewards) for (const id of p.rewards) { const r = REWARDS.find(x => x.id === id); if (r) apply(r.fx); }
  if (p.mfx) apply(p.mfx);
  p.tfx = fx;
  for (const u of g.ships) { if (u.dead || u.owner !== p.id) continue; const f = (1 + 0.1 * u.rank) * (u.hmul || 1), hm = u.def.hull * fx.hull * f, sm = u.def.shield * fx.shield * f; u.hull = u.hull / u.hullMax * hm; u.hullMax = hm; if (sm !== u.shieldMax) { u.shield = u.shieldMax ? u.shield / u.shieldMax * sm : sm; u.shieldMax = sm; } }
  for (const b of g.bldgs) { if (b.dead || b.owner !== p.id) continue; const sm = lvOf(b).shield * fx.shield * fx.bshield; if (sm !== b.shieldMax) { b.shield = b.shieldMax ? b.shield / b.shieldMax * sm : sm; b.shieldMax = sm; } }
}
function finishResearch(g, p) {
  const id = p.research.id;
  p.research = null;
  p.tech[id] = 1;
  recalcTech(g, p);
  ev(g, 'research', { owner: p.id, id });
}

/* ------------------------------------------------------------------ Befehle an Schiffe */
function shipsOf(g, pi, uids) { const out = []; for (const id of uids) { const u = g.byId.get(id); if (u && u.k === 1 && !u.dead && !u.derelict && u.owner === pi && u.def.role !== 'fighter') out.push(u); } return out; }
function setIdle(u) { u.o = { t: 'idle' }; u.hx = u.x; u.hy = u.y; u.path = null; u.tgt = 0; }
/* Formationsplätze um ein Ziel: kompakter Block quer zur Flugrichtung. Keil: jede Reihe leicht zum V gebogen, die
   größten Schiffe vorn in der Mitte. Linie: eine breite Reihe (ab neun Schiffen zwei). Abstand knapp über Rumpfbreite. */
function formSlots(us, gx, gy, form) {
  const n = us.length;
  if (n === 1) return [{ x: gx, y: gy }];
  let cx = 0, cy = 0, rmax = 0;
  for (const u of us) { cx += u.x; cy += u.y; rmax = Math.max(rmax, u.def.r); }
  cx /= n; cy /= n;
  const dir = datan2(gy - cy, gx - cx), px = -dsin(dir), py = dcos(dir), fx = dcos(dir), fy = dsin(dir), sp = rmax * 2 + 8;
  const sorted = us.slice().sort((a, b) => b.def.r - a.def.r || a.id - b.id), out = new Array(n);
  const cols = form === 'line' ? (n <= 8 ? n : Math.ceil(n / 2)) : Math.max(2, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const row = (i / cols) | 0, col = i % cols, inRow = row === rows - 1 ? n - row * cols : cols;
    /* innerhalb einer Reihe von der Mitte nach außen füllen, damit eine halbe Reihe mittig sitzt */
    const k = ((col % 2 ? 1 : -1) * Math.ceil(col / 2) + (inRow % 2 === 0 ? (col % 2 ? -0.5 : 0.5) : 0)) * sp;
    const back = row * sp * 0.95 + (form === 'line' ? 0 : Math.abs(k) * 0.35);
    out[us.indexOf(sorted[i])] = { x: gx + px * k - fx * back, y: gy + py * k - fy * back };
  }
  return out;
}
function cmdMove(g, us, x, y, am, form) {
  if (!us.length) return;
  const m = g.map;
  x = clamp(x, 20, m.w - 20); y = clamp(y, 20, m.h - 20);
  const slots = formSlots(us, x, y, form);
  let slow = 1e9;
  for (const u of us) slow = Math.min(slow, u.def.speed);
  for (let i = 0; i < us.length; i++) {
    const u = us[i], s = slots[i];
    u.o = { t: am ? 'amove' : 'move', x: s.x, y: s.y, sp: us.length > 1 ? slow : 0, ox: x, oy: y };
    u.path = null; u.tgt = 0; u.hold = false;
  }
}
function cmdAttack(g, us, t, sub) {
  for (const u of us) { if (!u.def.wpn.length) { u.o = { t: 'move', x: t.x, y: t.y }; u.path = null; continue; } u.o = { t: 'attack', tid: t.id, x: t.x, y: t.y, sub: sub && SUBS.indexOf(sub) >= 0 ? sub : undefined }; u.path = null; u.tgt = t.id; u.hold = false; }
}
function cmdStop(g, us) { for (const u of us) { setIdle(u); u.hold = false; } }
function cmdHold(g, us, on) { for (const u of us) { u.hold = !!on; if (on) { u.o = { t: 'hold' }; u.path = null; u.hx = u.x; u.hy = u.y; } else setIdle(u); } }
function cmdStance(g, us, v) { for (const u of us) u.stance = v | 0; }
function cmdGroup(g, us, n) { for (const u of us) u.grp = n | 0; }
function cmdHarvest(g, us, node) {
  for (const u of us) { if (!u.def.cargo) continue; u.o = { t: 'harvest', nid: node.id }; u.path = null; }
}
/* Ausführung eines Befehls (aus der Bedienung, der KI oder dem Mehrspieler). Rückgabe: null oder Text bei Ablehnung */
function execCmd(g, c) {
  const pi = c.p, p = g.players[pi];
  if (!p || !p.alive || g.over) return 'Nicht möglich';
  switch (c.t) {
    case 'move': { const us = shipsOf(g, pi, c.u); if (!us.length) return 'Nicht möglich'; cmdMove(g, us, c.x, c.y, !!c.am, c.form); return null; }
    case 'attack': { const t = g.byId.get(c.e); if (!t || t.dead || t.k === 3) return 'Nicht möglich'; const us = shipsOf(g, pi, c.u); if (!us.length) return 'Nicht möglich'; cmdAttack(g, us, t, c.sub); return null; }
    case 'harvest': { const n = g.byId.get(c.e); if (!n || n.k !== 3) return 'Nicht möglich'; const us = shipsOf(g, pi, c.u).filter(u => u.def.cargo); if (!us.length) return 'Kein Frachter'; cmdHarvest(g, us, n); return null; }
    case 'stop': cmdStop(g, shipsOf(g, pi, c.u)); return null;
    case 'explore': { const us = shipsOf(g, pi, c.u).filter(u => u.def.role !== 'builder' && u.def.role !== 'tanker' && !u.def.node); if (!us.length) return 'Nicht möglich'; for (const u of us) { u.hold = false; u.o = { t: 'explore' }; u.path = null; u.tgt = 0; } return null; }
    case 'hold': cmdHold(g, shipsOf(g, pi, c.u), c.on); return null;
    case 'stance': cmdStance(g, shipsOf(g, pi, c.u), c.v); return null;
    case 'group': cmdGroup(g, shipsOf(g, pi, c.u), c.n); return null;
    case 'build': return cmdBuild(g, pi, c.u, c.role, c.x, c.y);
    case 'resume': return cmdResume(g, pi, c.u, c.b);
    case 'train': return cmdTrain(g, pi, c.b, c.id);
    case 'cancel': return cmdCancel(g, pi, c.b, c.i | 0);
    case 'upgrade': return cmdUpgrade(g, pi, c.b);
    case 'rally': return cmdRally(g, pi, c.b, c.x, c.y);
    case 'sell': return cmdSell(g, pi, c.b);
    case 'research': return cmdResearch(g, pi, c.id);
    case 'cancelResearch': return cmdCancelResearch(g, pi);
    case 'doctrine': return cmdDoctrine(g, pi, c.id);
    case 'auto': { for (const u of shipsOf(g, pi, c.u)) u.auto = !!c.on; return null; }
    case 'reward': return cmdReward(g, c.p, c.id);
    case 'choice': return misChoose(g, c.p, c.id, c.v);
    /* Teamspiel: Rohstoffe an einen Verbündeten senden (höchstens, was man hat) und Kartensignale (Angriff/Hilfe/Sammeln) */
    case 'gift': { const q = g.players[c.to]; if (!q || q === p || !q.alive || q.neutral || q.team !== p.team) return 'Nicht möglich'; const ice = clamp(Math.floor(+c.ice || 0), 0, Math.floor(p.ice)), ore = p.F.bio || q.F.bio ? 0 : clamp(Math.floor(+c.ore || 0), 0, Math.floor(p.ore)); if (!ice && !ore) return 'Nicht genug Rohstoffe'; p.ice -= ice; p.ore -= ore; q.ice += ice; q.ore += ore; ev(g, 'gift', { owner: pi, to: q.id, ice, ore }); return null; }
    case 'ping': { const k = ['atk', 'help', 'go'].indexOf(c.k); if (k < 0) return 'Nicht möglich'; const x = clamp(+c.x || 0, 0, g.map.w), y = clamp(+c.y || 0, 0, g.map.h); ev(g, 'ping', { owner: pi, team: p.team, k: c.k, x, y }); for (const q of g.players) if (q !== p && q.ai && q.alive && !q.neutral && q.team === p.team) q.ai.ping = { k: c.k, x, y, t: g.time, from: pi }; return null; }
    case 'salvage': { const us = shipsOf(g, c.p, c.u).filter(u => u.def.cargo), w = g.wrecks.find(q => q.id === c.w); if (!us.length || !w || !(w.sal > 0)) return 'Nichts zu bergen'; for (const u of us) { if (u.mine) { const n = g.byId.get(u.mine); if (n) n.miners = Math.max(0, n.miners - 1); u.mine = 0; } u.o = { t: 'salvage', wid: w.id }; u.path = null; } return null; }
    case 'eat': { const us = shipsOf(g, c.p, c.u).filter(u => u.def.eat), t = g.byId.get(c.id); if (!us.length || !t || t.k !== 1 || t.dead || !t.derelict) return 'Nicht möglich'; for (const u of us) { if (u.mine) { const n = g.byId.get(u.mine); if (n) n.miners = Math.max(0, n.miners - 1); u.mine = 0; } u.o = { t: 'eat', tid: t.id, x: t.x, y: t.y }; u.path = null; } return null; }
    case 'merge': return cmdMerge(g, pi, c.u);
    case 'gate': return cmdGate(g, pi, c.id, c.mode);
    case 'etech': return cmdEtech(g, pi, c.id);
    case 'ab': return cmdAbility(g, pi, c.u, c.id, c.e);
    case 'super': return cmdSuper(g, pi, c.x, c.y);
    case 'board': { const t = g.byId.get(c.e); if (!t || t.dead || t.k === 3) return 'Nicht möglich'; const us = shipsOf(g, pi, c.u).filter(u => u.def.marines); if (!us.length) return 'Kein Enterschiff'; for (const u of us) { u.o = { t: 'board', tid: t.id, x: t.x, y: t.y }; u.path = null; u.tgt = t.id; } return null; }
  }
  return 'Nicht möglich';
}
/* Befehl aus der Bedienung: direkt ausführen (Mehrspieler: später über die Verbindung, g.net) */
function issueCmd(g, c) { if (g.net) return g.net(c); g.log.push(g.tick, c); return execCmd(g, c); }

/* ------------------------------------------------------------------ Gebäude je Runde */
function nearestNode(g, x, y, kind, maxD) {
  let best = null, bd = maxD || 1e9;
  for (const n of g.nodes) { if (n.amount <= 0 || (kind && n.kind !== kind)) continue; const d = hyp(n.x - x, n.y - y) - n.r; if (d < bd) { bd = d; best = n; } }
  return best;
}
/* Vorkommen für einen Frachter wählen: in Reichweite der Raffinerie das, was die Partei eher braucht (Eis zu Erz etwa 2:1),
   nahe vor fern, wenig belagerte vor vollen */
function pickNode(g, pi, x, y, maxD) {
  const p = g.players[pi], needOre = p.ore * 2.2 < p.ice;
  /* je knapper die fehlende Sorte, desto weiter lohnt der Umweg */
  const pen = needOre ? Math.min(1600, 420 + Math.max(0, 400 - p.ore) * 3) : 420;
  let best = null, bs = 1e9;
  for (const n of g.nodes) {
    /* Fassung 20: fast leere Vorkommen meiden – sie wachsen nur langsam nach (NODE_REGROW), und Frachter, die immer
       wieder zum nachgewachsenen Rest flogen, brachten kaum noch etwas (Erzmangel der KI in den Missionen) */
    if (n.amount <= 0 || n.amount < Math.min(120, n.max * 0.05)) continue;
    /* Schatzkammer der Piraten: nur nach dem Fall der Festung */
    if (g.fort && !g.fort.done && hyp(n.x - g.map.fort.x, n.y - g.map.fort.y) < g.map.fort.r + 420) continue;
    const d = hyp(n.x - x, n.y - y) - n.r;
    if (d > (maxD || 900) + (needOre && n.kind === 'ore' ? 700 : 0)) continue;
    let sc = d + n.miners * 90;
    if (needOre ? n.kind === 'ice' : n.kind === 'ore') sc += pen;
    if (sc < bs) { bs = sc; best = n; }
  }
  return best;
}
function nearestRefinery(g, pi, x, y) {
  let best = null, bd = 1e9;
  for (const b of g.bldgs) { if (b.dead || !b.done || b.role !== 'refinery' || g.tm[b.owner] !== g.tm[pi]) continue; const d = hyp(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function spawnFrom(g, b, id) {
  const def = SHIPS[id], p = g.players[b.owner], r = b.def.r + def.r + 10;
  const ang = b.rally ? datan2(b.rally.y - b.y, b.rally.x - b.x) : (g.rng() - 0.5) * 2 * Math.PI;
  const u = addShip(g, id, b.owner, b.x + dcos(ang) * r, b.y + dsin(ang) * r, ang);
  p.queued = Math.max(0, p.queued - def.cp);
  /* KI: Schlachtschiffe ziehen sich zur Reparatur zurück (Haltung Vorsichtig) */
  if (p.ai && def.role === 'war' && def.cls === 'l') u.stance = 3;
  if (def.cargo) { const n = pickNode(g, b.owner, b.x, b.y, 1400) || nearestNode(g, b.x, b.y, null, 1800); if (n) { cmdHarvest(g, [u], n); u.o.auto = 1; } }
  else if (b.rally) cmdMove(g, [u], b.rally.x, b.rally.y, def.wpn.length > 0);
  ev(g, 'ready', { owner: b.owner, id: u.id, x: u.x, y: u.y, type: id });
  return u;
}
function completeBldg(g, b) {
  b.done = true; b.prog = 1; b.hull = b.hullMax; b.shield = b.shieldMax;
  recalcPower(g, b.owner); recalcCp(g, b.owner);
  ev(g, 'built', { owner: b.owner, id: b.id, x: b.x, y: b.y, role: b.role });
  /* ein Bauschiff, das gebaut hat, wird frei */
  for (const u of g.ships) if (!u.dead && u.o.t === 'build' && u.o.bid === b.id) setIdle(u);
}
function updateBldg(g, b, dt) {
  const p = g.players[b.owner], lv = lvOf(b);
  if (!b.done) {
    /* Bauen: nur, solange ein Bauschiff in Reichweite ist; mehrere beschleunigen, mit sinkendem Nutzen */
    let n = 0;
    for (const u of g.ships) if (!u.dead && u.owner === b.owner && u.def.build && u.o.t === 'build' && u.o.bid === b.id && hyp(u.x - b.x, u.y - b.y) < b.def.r + u.def.r + 60) n++;
    b.bld = n;
    if (n) {
      b.prog = Math.min(1, b.prog + dt / lv.time * (1 + 0.5 * (n - 1)));
      b.hull = Math.max(b.hull, lv.hull * (0.08 + 0.92 * b.prog));
      if (b.prog >= 1) completeBldg(g, b);
    }
    return;
  }
  /* Nexus: vom Netz getrennte Stationen sind abgeschaltet */
  if (b.off) { if (b.shield > 0) b.shield = Math.max(0, b.shield - b.shieldMax * 0.1 * dt); if (b.boarding > 0) boardTick(g, b, dt); return; }
  if (p.tfx.bregen && b.hull < b.hullMax && (g.tick + b.id) % 10 === 0) b.hull = Math.min(b.hullMax, b.hull + b.hullMax * 0.004 * STEP * 10);
  if (b.upg) { b.upg.prog += dt / b.upg.time * (p.lowPower ? 0.5 : 1); if (b.upg.prog >= 1) finishUpgrade(g, b); }
  /* Werft: bauen und angedockte Schiffe reparieren */
  if (b.role === 'yard') {
    if (b.q.length) {
      const it = b.q[0], def = SHIPS[it.id];
      b.qp += dt / def.time * (lv.rate || 1) * p.tfx.rate * (p.lowPower ? 0.5 : 1);
      if (b.qp >= 1) { b.q.shift(); b.qp = 0; spawnFrom(g, b, it.id); }
    }
    if (g.tick % 6 === 0) {
      const rr = b.def.r + 70;
      nearShips(g, b.x, b.y, rr, u => { if (u.owner === b.owner && u.hull < u.hullMax && u.v < 5) { u.hull = Math.min(u.hullMax, u.hull + u.hullMax * YARD_REPAIR * STEP * 6); u.fr = g.time; } return false; });
    }
  }
  /* Raffinerie: belegte Andockplätze nachzählen, damit kein Platz verloren geht (Frachter zerstört, umbefohlen) */
  if (b.role === 'refinery' && g.tick % 15 === 0) { let n = 0; for (const u of g.ships) if (!u.dead && u.dk === b.id) n++; b.docks = n; }
  /* Schildgenerator: Stationen im Umkreis bekommen einen Zusatzschild (give), der eigene Schild bleibt */
  if (b.role === 'shield' && g.tick % 15 === 0) {
    for (const o of g.bldgs) { if (o.dead || o === b || o.owner !== b.owner || !o.done) continue; if (hyp(o.x - b.x, o.y - b.y) <= lv.aura) { if (o.givep < lv.give) o.givep = lv.give; if (o.give < o.givep) o.give = Math.min(o.givep, o.give + lv.give * 0.08); } }
  }
  /* Schild laden */
  if (b.shieldMax && b.shield < b.shieldMax) { b.sT += dt; if (b.sT > p.tfx.sdelay) b.shield = Math.min(b.shieldMax, b.shield + lv.sreg * p.tfx.sreg * g.pace.regen * dt * (p.lowPower ? 0.5 : 1)); }
  /* Labor: Forschung läuft, solange ein fertiges Labor steht */
  if (b.role === 'lab' && p.research && !p.research.lab) { p.research.lab = b.id; }
  if (b.role === 'lab' && p.research && p.research.lab === b.id) { p.research.prog += dt / p.research.time * (p.lowPower ? 0.5 : 1); if (p.research.prog >= 1) finishResearch(g, p); }
  /* Superwaffe laden */
  if (b.role === 'super') { if (b.charge < 1) { b.charge = Math.min(1, b.charge + dt / lv.charge * (p.lowPower ? 0.5 : 1) * p.tfx.superCharge * (p.forge ? 2 : 1)); if (b.charge >= 1) ev(g, 'supercharged', { owner: b.owner, x: b.x, y: b.y, id: b.id }); } }
  /* Entern auf Stationen */
  if (b.boarding > 0) boardTick(g, b, dt);
  /* Waffen */
  if (lv.wpn.length) fireAll(g, b, dt);
}
/* ------------------------------------------------------------------ Superwaffen
   Exodus-Tor (Alliance): versetzt alle eigenen Schiffe im Umkreis des Tors an den Zielpunkt. Massetreiber (Mars): Masse
   fliegt 3,5 Sekunden, dann schwerer Schaden im Zielkreis (jeder, auch eigene). */
function cmdSuper(g, pi, x, y) {
  const b = hasBldg(g, pi, 'super', true), p = g.players[pi];
  if (!b) return 'Keine Superwaffe';
  if (b.charge < 1) return 'Superwaffe noch nicht bereit';
  const lv = lvOf(b), m = g.map;
  x = clamp(x, EDGE, m.w - EDGE); y = clamp(y, EDGE, m.h - EDGE);
  if (p.faction === 'legion') {
    /* Sunbreaker: Sterneneruption im Zielbereich, einige Sekunden lang */
    b.charge = 0;
    g.flares.push({ x, y, r: lv.sr, dmg: lv.dmg, t: lv.dur, owner: pi, t0: lv.dur });
    ev(g, 'superfire', { owner: pi, x, y, kind: 'sunbreak', r: lv.sr });
    return null;
  }
  if (p.faction === 'brood') {
    /* Brutsturm: ein Sturm aus Schwärmen und Ravagern schlüpft am Ziel und lebt 60 Sekunden */
    b.charge = 0;
    const n = lv.packs;
    for (let i = 0; i < n; i++) { const a = i / n * TAU, d = 40 + (i % 3) * 50; const u = addShip(g, i % 3 === 2 ? 'ravager' : 'swarm', pi, clamp(x + dcos(a) * d, 10, m.w - 10), clamp(y + dsin(a) * d, 10, m.h - 10), a); p.shipCount -= u.def.cp; u.nocp = 1; u.until = g.time + 60; u.o = { t: 'amove', x: x + dcos(a) * 500, y: y + dsin(a) * 500 }; }
    ev(g, 'superfire', { owner: pi, x, y, kind: 'broodstorm', r: lv.sr, n });
    return null;
  }
  if (p.faction === 'nexus') {
    /* Resonanz: alle kleinen feindlichen Schiffe im Zielbereich wechseln die Seite */
    const us = g.ships.filter(u => !u.dead && foes(g, pi, u.owner) && u.def.cls === 's' && u.def.role !== 'fighter' && hyp(u.x - x, u.y - y) <= lv.sr);
    b.charge = 0;
    for (const u of us) { captureEntity(g, u, u.owner, pi); u.hull = Math.max(u.hull, u.hullMax * 0.3); }
    ev(g, 'superfire', { owner: pi, x, y, kind: 'resonance', r: lv.sr, n: us.length });
    return null;
  }
  if (p.faction === 'alliance') {
    const us = g.ships.filter(u => !u.dead && u.owner === pi && u.def.role !== 'fighter' && !u.derelict && hyp(u.x - b.x, u.y - b.y) <= lv.sr);
    if (!us.length) return 'Keine Schiffe am Tor';
    b.charge = 0;
    const n = us.length;
    us.forEach((u, i) => { const a = i / n * TAU, d = 30 + Math.sqrt(i) * 28; ev(g, 'exodus', { x: u.x, y: u.y, r: u.def.r, owner: pi, to: 1 }); u.x = clamp(x + dcos(a) * d, 10, m.w - 10); u.y = clamp(y + dsin(a) * d, 10, m.h - 10); u.path = null; u.o = { t: 'idle' }; u.hx = u.x; u.hy = u.y; u.v = 0; ev(g, 'exodus', { x: u.x, y: u.y, r: u.def.r, owner: pi, to: 0 }); });
    ev(g, 'superfire', { owner: pi, x, y, kind: 'exodus', n });
  } else {
    b.charge = 0;
    g.strikes.push({ x, y, t: 3.5, owner: pi, dmg: lv.dmg, r: lv.sr, sx: b.x, sy: b.y });
    ev(g, 'superfire', { owner: pi, x, y, kind: 'strike', sx: b.x, sy: b.y });
  }
  return null;
}
function updateStrikes(g, dt) {
  for (let i = g.strikes.length - 1; i >= 0; i--) {
    const s = g.strikes[i];
    s.t -= dt;
    if (s.t > 0) continue;
    g.strikes.splice(i, 1);
    const hit = e => { const d = hyp(e.x - s.x, e.y - s.y); if (d > s.r + e.def.r) return; const k = 1 - Math.max(0, d - e.def.r) / s.r; damage(g, e, s.dmg * (0.4 + 0.6 * k), 'rail', null, s.owner, s.x, s.y); };
    for (const u of g.ships) if (!u.dead) hit(u);
    for (const b of g.bldgs) if (!b.dead) hit(b);
    ev(g, 'strike', { x: s.x, y: s.y, r: s.r, owner: s.owner });
  }
}
/* Zusatzschilde verfallen, wenn kein Generator mehr in Reichweite ist (alle zwei Sekunden) */
function checkAura(g) {
  for (const o of g.bldgs) {
    if (o.dead || !o.givep) continue;
    let ok = false;
    for (const b of g.bldgs) if (!b.dead && b.role === 'shield' && b.done && b.owner === o.owner && b !== o && hyp(o.x - b.x, o.y - b.y) <= lvOf(b).aura) { ok = true; break; }
    if (!ok) { o.givep = 0; o.give = 0; }
  }
}

/* ------------------------------------------------------------------ Tod und Sieg */
function removeBldg(g, b) {
  if (b.dead) return;
  b.dead = true; g.deadFlag = true; g.bDied = true;
  navBlock(g.map, b.x, b.y, b.def.r, false);
  for (const it of b.q) refund(g.players[b.owner], it.c || SHIPS[it.id].cost, 0.5);
  b.q.length = 0;
  for (const u of g.ships) if (!u.dead && u.o.t === 'build' && u.o.bid === b.id) setIdle(u);
}
function removeShip(g, u) {
  if (u.dead) return;
  u.dead = true; g.deadFlag = true;
  const p = g.players[u.owner];
  if (u.def.role !== 'fighter' && !u.derelict && !u.nocp) p.shipCount -= u.def.cp;
  if (u.mine) { const n = g.byId.get(u.mine); if (n) n.miners = Math.max(0, n.miners - 1); u.mine = 0; }
  if (u.dk) { const ref = g.byId.get(u.dk); if (ref) ref.docks = Math.max(0, ref.docks - 1); u.dk = 0; }
  if (u.hangar) for (const id of u.hangar.ids) { const f = g.byId.get(id); if (f && !f.dead) f.par = 0; }
}
function kill(g, t, src, owner) {
  if (t.dead) return;
  const p = g.players[t.owner];
  if (t.k === 1) {
    /* Flaggschiff der Legion: einmal pro Partie Wiederauferstehung */
    if (t.def.resurrect && !t.resUsed && !t.derelict) { t.resUsed = 1; t.hull = t.hullMax * 0.4; t.shield = t.shieldMax; t.abT.invuln = 3; t.crew = t.crewMax; ev(g, 'resurrect', { x: t.x, y: t.y, owner: t.owner, id: t.id }); return; }
    /* Heldenschiffe der Legion fallen nicht: sie ruhen als Wrack und lassen sich wieder erwecken */
    if (t.def.hero && !t.derelict) { makeDerelict(g, t); t.hull = t.hullMax * 0.1; t.dormant = 1; ev(g, 'dormant', { x: t.x, y: t.y, owner: t.owner, id: t.id, name: t.def.name, hero: t.hero }); return; }
    removeShip(g, t);
    /* Plaguebearer platzt in eine Säurewolke */
    if (t.def.burst) { nearShips(g, t.x, t.y, 130, e => { if (!e.dead && foes(g, t.owner, e.owner)) { damage(g, e, 120, 'acid', null, t.owner, t.x, t.y); acidOn(g, e, 90, t.owner); } return false; }); ev(g, 'burst', { x: t.x, y: t.y, r: 130, owner: t.owner }); }
    /* Matriarch wächst mit jedem Abschuss */
    if (src && !src.dead && src.k === 1 && src.def.grow && t.def.role !== 'fighter' && owner !== t.owner) { const cap = src.def.hull * g.players[src.owner].tfx.hull * 2; if (src.hullMax < cap) { const add = src.def.hull * 0.05; src.hullMax = Math.min(cap, src.hullMax + add); src.hull = Math.min(src.hullMax, src.hull + add); src.hmul = src.hullMax / (src.def.hull * g.players[src.owner].tfx.hull * (1 + 0.1 * src.rank)); } }
    if (t.def.role !== 'fighter') { p.stats.lost++; g.wrecks.push({ x: t.x, y: t.y, ang: t.ang, type: t.type, owner: t.owner, until: g.time + 120, id: t.id, sal: Math.round(SALVAGE * (((t.def.cost || {}).ice || 0) + ((t.def.cost || {}).ore || 0))) }); if (g.wrecks.length > 60) g.wrecks.shift(); }
    ev(g, 'die', { x: t.x, y: t.y, r: t.def.r, owner: t.owner, big: t.def.cls === 'l' || t.def.cls === 'm', type: t.type, id: t.id, ang: t.ang, vx: t.vx || 0, vy: t.vy || 0 });
    if (owner >= 0 && owner !== t.owner && t.def.role !== 'fighter') {
      g.players[owner].stats.kills++;
      const s = src && !src.dead ? src : null;
      if (s && s.k === 1) gainXp(g, s, t.def.cp || 1);
    }
    /* Wächter der Erbauer: Relikte für den Sieger */
    if (t.type === 'warden' && owner >= 0) { const w = g.players[owner]; const n = Math.round(6 * w.tfx.relic); w.relics += n; ev(g, 'relics', { owner: owner, n, x: t.x, y: t.y, why: 'Der Wächter ist gefallen' }); for (const st of g.sites) if (st.kind === 'warden') st.done = true; }
  } else if (t.k === 2) {
    if (g.fort && t.id === g.fort.core && owner >= 0) g.fort.by = owner;
    removeBldg(g, t);
    p.stats.bLost++;
    if (owner >= 0 && owner !== t.owner) g.players[owner].stats.razed++;
    ev(g, 'bdie', { x: t.x, y: t.y, r: t.def.r, owner: t.owner, role: t.role, id: t.id });
    recalcPower(g, t.owner); recalcCp(g, t.owner);
  }
}
function gainXp(g, u, v) {
  u.kills += v * g.players[u.owner].tfx.xp;
  const r = XP_RANKS.filter(k => u.kills >= k).length;
  if (r > u.rank) {
    u.rank = r;
    const f = 1 + 0.1 * r;
    const p = g.players[u.owner], hm = u.def.hull * p.tfx.hull * f * (u.hmul || 1); u.hull = Math.min(hm, u.hull + (hm - u.hullMax)); u.hullMax = hm;
    u.shieldMax = u.def.shield * p.tfx.shield * f * (u.hmul || 1);
    ev(g, 'rank', { owner: u.owner, id: u.id, rank: r, x: u.x, y: u.y });
  }
}
/* Eine Partei ist besiegt, wenn sie keine Station und kein Bauschiff mehr hat; ihre Schiffe gehen verloren */
function checkElim(g) {
  /* Quarantine Line: fällt das Siegel, haben alle verloren */
  if (g.wave && g.opts.mode === 'quarantine' && !g.bldgs.some(b => !b.dead && b.role === 'seal')) { g.over = true; g.winner = g.threat; g.winTeam = 98; ev(g, 'over', { winner: g.threat, team: 98, seal: 1, waves: g.wave.cleared }); return; }
  for (const p of g.players) {
    if (!p.alive || p.neutral || p.threat || p.nob) continue;
    const hasB = g.bldgs.some(b => !b.dead && b.owner === p.id), hasBuilder = g.ships.some(u => !u.dead && u.owner === p.id && u.def.build);
    if (hasB || hasBuilder) continue;
    p.alive = false;
    for (const u of g.ships) if (!u.dead && u.owner === p.id) { removeShip(g, u); ev(g, 'die', { x: u.x, y: u.y, r: u.def.r, owner: u.owner, big: false, type: u.type, id: u.id, quiet: true }); }
    for (const b of g.bldgs) if (!b.dead && b.owner === p.id) removeBldg(g, b);
    ev(g, 'elim', { owner: p.id });
  }
  if (g.mis && g.human >= 0 && !g.players[g.human].alive) { misLose(g, 'Die Basis ist gefallen'); return; }
  const alive = g.players.filter(p => p.alive && !p.neutral && !p.threat);
  if (!alive.length) { g.over = true; g.winner = g.wave ? g.threat : -1; g.winTeam = g.wave ? 98 : -1; ev(g, 'over', { winner: g.winner, waves: g.wave ? g.wave.cleared : undefined }); return; }
  const t = alive[0].team;
  if (g.wave || g.mis) return; /* Wellen und Missionen: Sieg nur über die Wellen oder das Skript */ /* Wellen: Sieg nur über die Wellen */
  if (alive.every(p => p.team === t)) { g.over = true; g.winner = alive[0].id; g.winTeam = t; ev(g, 'over', { winner: g.winner, team: t }); }
}

/* ------------------------------------------------------------------ Prüfsumme und Schritt */
function stateHash(g) {
  let h = 2166136261 | 0;
  h = hmix(h, g.tick); h = hmix(h, g.rng.st.a); h = hmix(h, g.nextId); h = hmix(h, g.proj.length);
  for (const p of g.players) { h = hmix(h, p.ice); h = hmix(h, p.ore); h = hmix(h, p.relics); h = hmix(h, p.alive ? p.shipCount : -1); h = hmix(h, p.research ? p.research.prog : -1); }
  for (const st of g.sites) { h = hmix(h, st.prog || 0); h = hmix(h, st.owner + 2); }
  for (const gt of g.gates) { h = hmix(h, gt.prog || 0); h = hmix(h, gt.owner + 2); h = hmix(h, gt.charge || 0); }
  for (const u of g.ships) if (!u.dead) { h = hmix(h, u.id); h = hmix(h, u.x); h = hmix(h, u.y); h = hmix(h, u.hull); h = hmix(h, u.shield); h = hmix(h, u.crew); h = hmix(h, u.sub.drive + u.sub.wpn * 3 + u.sub.shield * 7 + u.sub.sensor * 11 + u.sub.life * 13); }
  for (const p of g.players) h = hmix(h, p.doctrine ? hashStr(p.doctrine) : 0);
  if (g.wave) { h = hmix(h, g.wave.n); h = hmix(h, g.wave.phase === 'wave' ? 1 : 0); }
  if (g.mis) { for (const q of g.mis.goals) { h = hmix(h, q.st); h = hmix(h, q.v); } h = hmix(h, g.mis.res); }
  for (const b of g.bldgs) if (!b.dead) { h = hmix(h, b.id); h = hmix(h, b.hull); h = hmix(h, b.prog); h = hmix(h, b.q.length); }
  for (const n of g.nodes) h = hmix(h, n.amount);
  /* Fassung 22: Minen */
  h = hmix(h, g.mines.length); for (const m of g.mines) { h = hmix(h, m.id); h = hmix(h, m.t); }
  return h >>> 0;
}
function stepGame(g) {
  if (g.over) return;
  const dt = STEP;
  g.tick++; g.time += dt;
  rebuildGrid(g);
  if (g.tick % 6 === 1) updateVision(g);
  for (const p of g.players) {
    if (!p.alive) continue;
    /* gleitendes Liefer-Einkommen und Notfall-Einkommen der KI */
    p.haulR *= 1 - dt / 45;
    if (p.ai && p.ai.cfg.aid && g.time > 90 && p.haulR < p.ai.cfg.aid) p.incAcc += (p.ai.cfg.aid - p.haulR) * dt;
    if (p.incAcc >= 1) { const a = Math.floor(p.incAcc); p.ice += a; p.incAcc -= a; p.stats.earned += a; }
    if (p.bonusInc && g.tick % 30 === 0) { p.ice += 8 * p.bonusInc; p.ore += 4 * p.bonusInc; p.stats.earned += 12 * p.bonusInc; }
  }
  const bl = g.bldgs, us = g.ships, rev = (g.tick & 1) === 1;
  if (rev) { for (let i = bl.length - 1; i >= 0; i--) if (!bl[i].dead) updateBldg(g, bl[i], dt); }
  else for (let i = 0; i < bl.length; i++) if (!bl[i].dead) updateBldg(g, bl[i], dt);
  if (rev) { for (let i = us.length - 1; i >= 0; i--) if (!us[i].dead) updateShip(g, us[i], dt); }
  else for (let i = 0; i < us.length; i++) if (!us[i].dead) updateShip(g, us[i], dt);
  separate(g);
  updateProj(g, dt);
  if (g.strikes.length) updateStrikes(g, dt);
  if (g.flares.length) updateFlares(g, dt);
  if (g.mines.length) updateMines(g, dt);
  if (g.tick % 5 === 3) updateDots(g, dt * 5);
  if (g.wave) updateWaves(g, dt);
  if (g.mis && g.tick % 15 === 5) misStep(g);
  if (g.tick % 30 === 7) for (const p of g.players) if (p.alive && p.faction === 'nexus') updateNet(g, p);
  if (g.tick % 300 === 150) for (const u of g.ships) if (!u.dead) { u.snapH = u.hull; u.snapS = u.shield; }
  updateSites(g, dt);
  updateFort(g);
  /* Vorkommen wachsen langsam nach (Eis kondensiert, Erz sammelt sich aus Staub): bis 60 % des Anfangswerts, 0,05 % je s */
  if (g.tick % 30 === 11) for (const n of g.nodes) if (n.max && n.amount < n.max * NODE_REGROW_CAP) n.amount = Math.min(n.max * NODE_REGROW_CAP, n.amount + n.max * NODE_REGROW * 30 * STEP);
  if (g.opts.sandbox && g.tick % 1800 === 900) sandboxSpawn(g);
  if (g.tick % 60 === 30) checkAura(g);
  for (let i = g.wrecks.length - 1; i >= 0; i--) if (g.time > g.wrecks[i].until) g.wrecks.splice(i, 1);
  if (g.deadFlag) {
    g.deadFlag = false;
    let w = 0;
    for (let i = 0; i < us.length; i++) { const u = us[i]; if (u.dead) g.byId.delete(u.id); else us[w++] = u; }
    us.length = w;
    w = 0;
    for (let i = 0; i < bl.length; i++) { const b = bl[i]; if (b.dead) g.byId.delete(b.id); else bl[w++] = b; }
    bl.length = w;
    if (g.bDied) { g.bDied = false; for (const p of g.players) if (p.alive) { recalcPower(g, p.id); recalcCp(g, p.id); } }
    checkElim(g);
  }
  if (g.tick % 60 === 0 && !g.over) checkElim(g);
  if (g.tick % 30 === 15) for (const p of g.players) if (p.alive) recalcCp(g, p.id);
  const np = g.players.length, back = ((g.tick / 30) | 0) & 1;
  for (let k = 0; k < np; k++) {
    const p = g.players[back ? np - 1 - k : k];
    if (!p.ai || !p.alive || g.over) continue;
    if (g.time >= p.ai.next) { p.ai.next = g.time + p.ai.cfg.think; aiThink(g, p.id); }
  }
  if (g.ev.length > 6000) g.ev.splice(0, g.ev.length - 3000);
}

/* ------------------------------------------------------------------ Fähigkeiten (Aufruf) und Entern
   Wirkung in combat.js (abilityUse). Fähigkeiten eines Schiffs: def.ab, bei Flaggschiffen def.abs plus die vierte aus der Doktrin. */
function shipAbils(g, u) {
  const list = [];
  if (u.def.ab) list.push(u.def.ab);
  if (u.def.ab2) for (const a of u.def.ab2) list.push(a);
  if (u.def.abs) { for (const a of u.def.abs) list.push(a); const p = g.players[u.owner]; if (p.doctrine) { const d = doctrineDef(p.faction, p.doctrine); if (d && d.flagAb && list.indexOf(d.flagAb) < 0) list.push(d.flagAb); } if (p.etech && ETECH[p.etech].flagAb && list.indexOf(ETECH[p.etech].flagAb) < 0) list.push(ETECH[p.etech].flagAb); }
  return list;
}
function cmdAbility(g, pi, uids, id, eid) {
  const us = shipsOf(g, pi, uids).filter(u => !u.derelict && shipAbils(g, u).indexOf(id) >= 0 && !(u.abcd[id] > 0));
  if (!us.length) return 'Nicht bereit';
  const t = eid ? g.byId.get(eid) : null;
  let n = 0;
  for (const u of us) if (abilityUse(g, u, id, t)) n++;
  return n ? null : (ABIL[id].mut ? 'Mutation nicht möglich: Biomasse, Brutgrube oder Kommandopunkte fehlen' : 'Kein Ziel in Reichweite');
}
/* Marines an Bord kämpfen gegen die Crew; ist sie besiegt, wechselt das Schiff (oder die Station) den Besitzer */
function boardTick(g, t, dt) {
  const att = g.players[t.boardBy], rate = 2.2 * dt * (att ? att.tfx.board : 1);
  if (t.crew > 0) { const k = Math.min(t.crew, t.boarding, rate * Math.max(1, Math.min(t.crew, t.boarding) / 10)); t.crew -= k; t.boarding -= k * 0.8; }
  if (t.boarding <= 0) { t.boarding = 0; t.boardBy = -1; ev(g, 'boardfail', { x: t.x, y: t.y, owner: t.owner }); return; }
  if (t.crew <= 0) {
    t.crew = Math.min(t.crewMax, t.boarding); t.boarding = 0;
    const from = t.owner, to = t.boardBy;
    t.boardBy = -1;
    if (to < 0 || to === from) return;
    captureEntity(g, t, from, to);
  }
}
function captureEntity(g, t, from, to) {
  if (t.k === 1) {
    if (!t.derelict) g.players[from].shipCount -= t.def.cp;
    g.players[to].shipCount += t.def.cp;
    t.owner = to; t.o = { t: 'idle' }; t.hx = t.x; t.hy = t.y; t.path = null; t.tgt = 0; t.grp = 0; t.derelict = false; t.marked = 0; t.truce = 0;
    if (t.mine) { const n = g.byId.get(t.mine); if (n) n.miners = Math.max(0, n.miners - 1); t.mine = 0; }
    if (t.dk) { const ref = g.byId.get(t.dk); if (ref) ref.docks = Math.max(0, ref.docks - 1); t.dk = 0; }
    if (t.hangar) { for (const id of t.hangar.ids) { const f = g.byId.get(id); if (f && !f.dead) removeShip(g, f); } t.hangar.ids = []; t.hangar.n = 0; }
    g.players[to].stats.kills++;
  } else {
    t.owner = to; t.q.length = 0; t.qp = 0; t.rally = null; t.tgt = 0; t.give = 0; t.givep = 0;
    recalcPower(g, from); recalcPower(g, to); recalcCp(g, from); recalcCp(g, to);
    g.players[to].stats.razed++;
  }
  ev(g, 'captured', { x: t.x, y: t.y, from, to, id: t.id, k: t.k, name: t.k === 1 ? t.def.name : t.def.name });
}

/* ------------------------------------------------------------------ Runde 3: Sunbreaker, Netz des Nexus, Verschmelzen */
function updateFlares(g, dt) {
  for (let i = g.flares.length - 1; i >= 0; i--) {
    const f = g.flares[i];
    f.t -= dt;
    if (f.t <= 0) { g.flares.splice(i, 1); continue; }
    if ((g.tick + i) % 3) continue;
    const hit = e => { if (hyp(e.x - f.x, e.y - f.y) > f.r + e.def.r * 0.5) return; damage(g, e, f.dmg * dt * 3, 'beam', null, f.owner, f.x, f.y); };
    for (const u of g.ships) if (!u.dead) hit(u);
    for (const b of g.bldgs) if (!b.dead) hit(b);
  }
}
/* Netzreichweite eines Knotens (Station oder Schiff) */
function netRange(g, p, e) {
  if (e.k === 2) { const lv = lvOf(e); return NET_R * (lv.net || (e.role === 'base' ? 1.2 : 0.7)) * p.tfx.net; }
  return NET_R * 0.8 * p.tfx.net;
}
/* Liegt (x,y) im Netz des Spielers? strict: nur verbundene Knoten zählen */
function netCovered(g, pi, x, y, strict) {
  const p = g.players[pi];
  for (const b of g.bldgs) { if (b.dead || b.owner !== pi || !b.done || (strict && b.off)) continue; if (hyp(b.x - x, b.y - y) <= netRange(g, p, b)) return true; }
  for (const u of g.ships) { if (u.dead || u.owner !== pi || !u.def.node || u.derelict) continue; if (hyp(u.x - x, u.y - y) <= netRange(g, p, u)) return true; }
  return false;
}
/* Verbundenheit: vom Kernknoten aus über Stationen und mobile Knoten; was nicht erreicht wird, ist abgeschaltet */
function updateNet(g, p) {
  const pi = p.id, nodes = [];
  for (const b of g.bldgs) if (!b.dead && b.owner === pi && b.done) nodes.push(b);
  for (const u of g.ships) if (!u.dead && u.owner === pi && u.def.node && !u.derelict) nodes.push(u);
  const base = nodes.find(n => n.k === 2 && n.role === 'base');
  const seen = new Set();
  const stack = [];
  /* jede Kommandobasis ist ein eigener Kern (Außenbasen bilden ein eigenes Netz) */
  for (const n of nodes) if (n.k === 2 && n.role === 'base') { stack.push(n); seen.add(n); }
  while (stack.length) {
    const a = stack.pop(), ra = netRange(g, p, a);
    for (const b of nodes) { if (seen.has(b)) continue; if (hyp(a.x - b.x, a.y - b.y) <= Math.max(ra, netRange(g, p, b))) { seen.add(b); stack.push(b); } }
  }
  let changed = false;
  for (const b of g.bldgs) {
    if (b.dead || b.owner !== pi) continue;
    const off = !!base && !seen.has(b) && b.role !== 'base' && !(b.forceNet > g.time);
    if (off !== !!b.off) { b.off = off; changed = true; if (off) ev(g, 'netoff', { owner: pi, x: b.x, y: b.y, id: b.id }); }
  }
  if (changed) { recalcPower(g, pi); recalcCp(g, pi); }
}
/* Verschmelzen: drei gleiche Kristallschiffe nahe beieinander werden zur nächsten Form */
function cmdMerge(g, pi, uids) {
  const p = g.players[pi], us = shipsOf(g, pi, uids).filter(u => u.def.merge);
  const by = new Map();
  for (const u of us) by.set(u.type, (by.get(u.type) || []).concat(u));
  let done = 0, why = 'Drei gleiche Kristallschiffe wählen';
  for (const [type, list] of by) {
    const next = SHIPS[SHIPS[type].merge];
    if (!next) continue;
    if (next.doc && p.doctrine !== next.doc) { why = 'Benötigt Doktrin ' + doctrineDef(p.faction, next.doc).name; continue; }
    /* Verschmelzen ersetzt nicht die Technik: die nächste Form braucht dieselbe Wachskammer- und Laborstufe wie beim Züchten */
    if (next.yard > 1 && !g.bldgs.some(b => !b.dead && b.owner === pi && b.role === 'yard' && b.done && b.lv >= next.yard)) { why = 'Benötigt Wachskammer Stufe ' + ROMAN[next.yard]; continue; }
    if (next.tier > 1 && labLevel(g, pi) < next.tier - 1) { why = 'Benötigt Labor Stufe ' + ROMAN[next.tier - 1]; continue; }
    while (list.length >= 3) {
      const a = list[0];
      const near = list.filter(u => hyp(u.x - a.x, u.y - a.y) <= ABIL.merge.r * 2.2);
      if (near.length < 3) { why = 'Die Schiffe müssen nahe beieinander sein'; list.shift(); continue; }
      const trio = near.slice(0, 3);
      let cx = 0, cy = 0, hf = 0, xp = 0, ang = 0;
      for (const u of trio) { cx += u.x / 3; cy += u.y / 3; hf += u.hull / u.hullMax / 3; xp += u.kills / 3; ang += u.ang / 3; removeShip(g, u); list.splice(list.indexOf(u), 1); }
      const n = addShip(g, next.id, pi, cx, cy, ang); n.merged = 1;
      const mb = p.tfx.mergeBonus;
      n.hmul = mb; n.hullMax *= mb; n.shieldMax *= mb; n.hull = n.hullMax * Math.max(0.5, hf); n.shield = n.shieldMax * 0.5; n.merged = 1;
      n.kills = xp; n.rank = 0; gainXp(g, n, 0);
      ev(g, 'merge', { x: cx, y: cy, owner: pi, r: next.r, type: next.id, id: n.id });
      done++;
    }
  }
  if (!done) return why;
  recalcCp(g, pi);
  return null;
}

/* ------------------------------------------------------------------ Runde 3: Ruinen, große Stätten, Tore, Ereignisse */
/* Kampfkraft (Kommandopunkte) der Kriegsschiffe eines Spielers im Umkreis; -1 wenn mehrere Teams anwesend */
function presence(g, x, y, r) {
  const cp = new Map();
  let teams = 0, seenT = {};
  nearShips(g, x, y, r, u => { if (u.derelict || u.def.role === 'fighter' || !u.def.wpn.length && !u.def.build) return false; const t = g.tm[u.owner]; if (t === 99) return false; if (!seenT[t]) { seenT[t] = 1; teams++; } cp.set(u.owner, (cp.get(u.owner) || 0) + Math.max(1, u.def.cp)); return false; });
  if (teams > 1) return { pi: -1, cp: 0, contested: true };
  let best = -1, bc = 0;
  for (const [pi, c] of cp) if (c > bc) { bc = c; best = pi; }
  return { pi: best, cp: bc, contested: false };
}
function siteSpeed(g, pi, x, y) {
  const p = g.players[pi];
  let m = p.tfx.site;
  nearShips(g, x, y, 260, u => { if (u.owner === pi && u.def.siteBonus) { m = Math.max(m, u.def.siteBonus); } return false; });
  return m;
}
function grantRelics(g, pi, n, x, y, why) { const p = g.players[pi]; const k = Math.round(n * p.tfx.relic); p.relics += k; ev(g, 'relics', { owner: pi, n: k, x, y, why }); }
/* ------------------------------------------------------------------ Piratenfestung
   Kommandobasis (Stufe 3) als Kern, Geschütze, Flak und Reaktoren im Ring, eine Garnison auf Posten. Die Garnison
   verteidigt (greift an, was der Festung zu nahe kommt, und kehrt dann auf ihre Posten zurück) und wird aus dem Kern
   nachgebaut, solange er steht. Wer den Kern zerstört oder entert, bekommt den Piratenschatz. */
const PIRATE_COL = '#c8324a', FORT_LOOT = { ice: 2000, ore: 1200, relics: 4 };
const FORT_SHIPS = ['needle', 'spear', 'hedgehog', 'needle', 'spear', 'hammer', 'hedgehog', 'longshot', 'needle', 'spear', 'wasp', 'hammer'];
function fortBldg(g, role, x, y, lvl) {
  const b = addBldg(g, role, g.pirate, x, y, true);
  if (lvl > 1) { b.lv = lvl; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield; b.shield = b.shieldMax; b.wcd = l.wpn.map(() => 0); }
  return b;
}
function fortSetup(g) {
  const F = g.map.fort, pi = g.pirate, np = g.players.filter(p => !p.neutral).length;
  const core = fortBldg(g, 'base', F.x, F.y, 3);
  for (let k = 0; k < 2; k++) fortBldg(g, 'reactor', F.x + dcos(k * Math.PI + 0.5) * 150, F.y + dsin(k * Math.PI + 0.5) * 150, 2);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; fortBldg(g, 'turret', F.x + dcos(a) * 250, F.y + dsin(a) * 250, 2); }
  for (let k = 0; k < 3; k++) { const a = (k + 0.5) / 3 * TAU; fortBldg(g, 'flak', F.x + dcos(a) * 200, F.y + dsin(a) * 200, 2); }
  recalcPower(g, pi);
  g.fort = { core: core.id, done: false, cap: 6 + np, spawnT: 0, n: 0, alert: false, by: -1 };
  for (let k = 0; k < g.fort.cap; k++) fortSpawn(g);
}
function fortSpawn(g) {
  const F = g.map.fort, S = g.fort, k = S.n++, a = k * 2.399, d = 340 + (k % 3) * 45;
  const u = addShip(g, FORT_SHIPS[k % FORT_SHIPS.length], g.pirate, F.x + dcos(a) * d, F.y + dsin(a) * d, a);
  u.hx = u.x; u.hy = u.y; u.o = { t: 'hold' }; u.hold = true; u.post = 1;
  return u;
}
function updateFort(g) {
  const S = g.fort; if (!S || S.done || (g.tick % 15) !== 7) return;
  const F = g.map.fort, pi = g.pirate, core = g.byId.get(S.core);
  /* gefallen oder geentert: Schatz für den Eroberer */
  if (!core || core.dead || core.owner !== pi) {
    S.done = true;
    const to = core && !core.dead ? core.owner : S.by;
    if (to >= 0 && !g.players[to].neutral) { const p = g.players[to], rel = Math.round(FORT_LOOT.relics * p.tfx.relic); p.ice += FORT_LOOT.ice; p.ore += FORT_LOOT.ore; p.relics += rel; p.stats.earned += FORT_LOOT.ice + FORT_LOOT.ore; ev(g, 'fortFall', { owner: to, x: F.x, y: F.y, ice: FORT_LOOT.ice, ore: FORT_LOOT.ore, relics: rel }); }
    /* die Garnison zerstreut sich: sie kämpft weiter, aber ohne Posten */
    for (const u of g.ships) if (!u.dead && u.owner === pi) { u.post = 0; u.hold = false; u.o = { t: 'amove', x: F.x + (u.x - F.x) * 2, y: F.y + (u.y - F.y) * 2 }; u.path = null; }
    return;
  }
  const guard = g.ships.filter(u => !u.dead && u.owner === pi && u.post);
  /* Nachschub aus dem Kern */
  if (guard.length < S.cap && g.time > S.spawnT) { S.spawnT = g.time + 45; fortSpawn(g); }
  /* Eindringlinge in der Festungszone */
  let foe = null, fd = F.r + 380;
  for (const u of g.ships) { if (u.dead || u.derelict || u.owner === pi || g.tm[u.owner] >= 97) continue; const d = hyp(u.x - F.x, u.y - F.y); if (d < fd) { fd = d; foe = u; } }
  for (const b of g.bldgs) { if (b.dead || b.owner === pi) continue; const d = hyp(b.x - F.x, b.y - F.y); if (d < fd) { fd = d; foe = b; } }
  if (foe) { S.alert = true; for (const u of guard) if (u.o.t === 'hold' || u.o.t === 'idle' || (u.o.t === 'amove' && g.tick % 90 === 7)) { u.hold = false; u.o = { t: 'amove', x: foe.x + (u.id % 7 - 3) * 20, y: foe.y + (u.id % 5 - 2) * 20 }; u.path = null; } }
  else if (S.alert || g.tick % 150 === 7) {
    S.alert = false;
    for (const u of guard) if (u.o.t !== 'hold' && hyp(u.x - u.hx, u.y - u.hy) > 60) { u.hold = false; u.o = { t: 'move', x: u.hx, y: u.hy }; u.path = null; }
      else if (u.o.t === 'idle') { u.o = { t: 'hold' }; u.hold = true; }
  }
}
function updateSites(g, dt) {
  if ((g.tick % 5) !== 2) return;
  const step = dt * 5;
  for (const st of g.sites) {
    if (st.done) continue;
    if (st.kind === 'ruin') {
      if (st.scanned) continue;
      const pr = presence(g, st.x, st.y, st.r + 110);
      if (pr.contested || pr.pi < 0) { if (st.prog > 0 && pr.pi < 0 && !pr.contested) st.prog = Math.max(0, st.prog - step * 0.05); continue; }
      if (st.by !== pr.pi) { st.by = pr.pi; st.prog = 0; }
      st.prog = Math.min(1, st.prog + step / 10 * siteSpeed(g, pr.pi, st.x, st.y));
      if (st.prog >= 1) { st.scanned = true; st.done = true; st.owner = pr.pi; ruinReward(g, st, pr.pi); }
      continue;
    }
    if (st.kind === 'warden') {
      const w = g.byId.get(st.guard[0]);
      if (!w || w.dead) { st.done = true; continue; }
      if (w.asleep && (w.hull < w.hullMax || w.shield < w.shieldMax * 0.95)) { w.asleep = 0; w.stance = 0; w.hold = false; w.o = { t: 'idle' }; st.woke = true; ev(g, 'wake', { x: w.x, y: w.y, id: w.id }); }
      if (!w.asleep && g.tick % 150 === 2) wardenRoam(g, w);
      continue;
    }
    /* Zitadelle: erst die Wächter, dann halten. Archiv und Schmiede: halten. */
    if (st.kind === 'citadel' && st.guard.some(id => { const u = g.byId.get(id); return u && !u.dead && hyp(u.x - st.x, u.y - st.y) < 600; })) { st.prog = 0; continue; }
    const need = st.kind === 'citadel' ? 6 : 2, time = st.kind === 'citadel' ? 60 : st.kind === 'archive' ? 45 : 30;
    const pr = presence(g, st.x, st.y, st.r + 200);
    if (st.kind === 'forge') st.held = pr.pi >= 0 && !pr.contested && pr.cp >= 1 && st.owner === pr.pi ? pr.pi : -1;
    if (pr.contested || pr.pi < 0 || pr.cp < need) { if (st.prog > 0 && !pr.contested) st.prog = Math.max(0, st.prog - step * 0.03); continue; }
    if (st.kind === 'archive' && st.used.indexOf(pr.pi) >= 0) continue;
    if (st.kind === 'forge' && st.owner === pr.pi) continue;
    if (st.by !== pr.pi) { st.by = pr.pi; st.prog = 0; }
    st.prog = Math.min(1, st.prog + step / time * siteSpeed(g, pr.pi, st.x, st.y));
    if (st.prog >= 1) {
      st.prog = 0; st.owner = pr.pi;
      if (st.kind === 'citadel') { st.done = true; const u = addShip(g, 'sentinel', pr.pi, st.x + st.r + 40, st.y, 0); u.auto = true; ev(g, 'siteWon', { kind: st.kind, owner: pr.pi, x: st.x, y: st.y, id: st.id, name: st.name, reward: 'Erbauer-Sentinel' }); }
      else if (st.kind === 'archive') { st.used.push(pr.pi); const p = g.players[pr.pi]; p.etechAsk = pickEtech(g, pr.pi); ev(g, 'siteWon', { kind: st.kind, owner: pr.pi, x: st.x, y: st.y, id: st.id, name: st.name, reward: 'Erbauer-Technologie' }); if (p.ai) cmdEtech(g, pr.pi, p.etechAsk[(g.rng() * 3) | 0]); }
      else if (st.kind === 'forge') { st.held = pr.pi; ev(g, 'siteWon', { kind: st.kind, owner: pr.pi, x: st.x, y: st.y, id: st.id, name: st.name, reward: 'Energie und Ladung' }); recalcPower(g, pr.pi); }
    }
  }
  /* Schmiede: Wirkung nur, solange der Besitzer sie hält */
  for (const p of g.players) { const held = g.sites.some(st => st.kind === 'forge' && st.held === p.id); if (held !== !!p.forge) { p.forge = held; recalcPower(g, p.id); if (!held && !p.neutral) ev(g, 'siteLost', { owner: p.id, kind: 'forge' }); } }
  updateGates(g, step);
  updateEvents(g, step);
}
function pickEtech(g, pi) {
  const ids = Object.keys(ETECH), out = [];
  while (out.length < 3 && ids.length) out.push(ids.splice((g.rng() * ids.length) | 0, 1)[0]);
  return out;
}
function cmdEtech(g, pi, id) {
  const p = g.players[pi];
  if (!p.etechAsk || p.etechAsk.indexOf(id) < 0) return 'Nicht möglich';
  p.etech = id; p.etechAsk = null;
  recalcTech(g, p); recalcPower(g, pi);
  if (ETECH[id].reveal) { for (let i = 0; i < p.explored.length; i++) p.explored[i] = 1; }
  ev(g, 'etech', { owner: pi, id });
  return null;
}
function ruinReward(g, st, pi) {
  const p = g.players[pi], r = g.rng();
  let bonus = 0;
  nearShips(g, st.x, st.y, 260, u => { if (u.owner === pi && u.def.relicBonus) bonus = 1; return false; });
  if (r < 0.4) { grantRelics(g, pi, 2 + bonus, st.x, st.y, 'Ruine geplündert'); st.result = 'relics'; }
  else if (r < 0.65) { const open = TECH[p.faction].filter(t => !p.tech[t.id] && !(p.research && p.research.id === t.id)); if (open.length) { const t = open[(g.rng() * open.length) | 0]; p.tech[t.id] = 1; recalcTech(g, p); ev(g, 'research', { owner: pi, id: t.id, free: 1 }); st.result = 'tech'; } else { grantRelics(g, pi, 2, st.x, st.y, 'Ruine geplündert'); st.result = 'relics'; } }
  else if (r < 0.85) { g.reveals.push({ x: st.x, y: st.y, r: 1600, owner: pi, until: g.time + 14 }); st.result = 'map'; }
  else { st.result = 'trap'; if (g.neutral >= 0) for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, u = addShip(g, 'drone', g.neutral, st.x + dcos(a) * (st.r + 50), st.y + dsin(a) * (st.r + 50), a); u.hx = u.x; u.hy = u.y; u.o = { t: 'hold' }; u.hold = true; } }
  ev(g, 'ruin', { owner: pi, x: st.x, y: st.y, id: st.id, result: st.result });
}
/* Der erwachte Wächter zieht zur nächsten Station irgendeines Spielers */
function wardenRoam(g, w) {
  if (w.o.t === 'attack') return;
  let best = null, bd = 1e9;
  for (const b of g.bldgs) { if (b.dead || b.owner === w.owner) continue; const d = hyp(b.x - w.x, b.y - w.y); if (d < bd) { bd = d; best = b; } }
  if (best) { w.o = { t: 'amove', x: best.x, y: best.y, am: 1 }; w.path = null; }
}
/* Tore: aktivieren (halten + Relikte), Modi, Durchflug, Lanze, Torsturm */
function gateOpen(g, gt, pi) {
  if (gt.state === 'flicker') return (g.time % 50) < 8;
  if (gt.state !== 'active') return false;
  if (gt.mode === 'lance') return false;
  if (gt.mode === 'lock') return pi === gt.owner || g.tm[pi] === g.tm[gt.owner];
  return true;
}
function updateGates(g, step) {
  for (const gt of g.gates) {
    const pair = g.byId.get(gt.pair);
    /* Aktivierung: halten, dann Relikte zahlen */
    if (gt.state !== 'active' || gt.owner < 0) {
      const pr = presence(g, gt.x, gt.y, gt.r + 180);
      if (!pr.contested && pr.pi >= 0 && pr.cp >= 2 && gt.owner !== pr.pi) {
        if (gt.by !== pr.pi) { gt.by = pr.pi; gt.prog = 0; }
        gt.prog = Math.min(1, gt.prog + step / 20);
        if (gt.prog >= 1) {
          const p = g.players[pr.pi];
          if (p.relics >= RELIC_GATE) { p.relics -= RELIC_GATE; gt.owner = pr.pi; gt.state = 'active'; gt.mode = 'bridge'; gt.prog = 0; gt.charge = 0; ev(g, 'gateOn', { owner: pr.pi, x: gt.x, y: gt.y, id: gt.id }); }
          else if (g.time - gt.warnT > 20) { gt.warnT = g.time; ev(g, 'gateRelics', { owner: pr.pi, x: gt.x, y: gt.y, id: gt.id }); }
        }
      } else if (gt.prog > 0 && !pr.contested && pr.pi < 0) gt.prog = Math.max(0, gt.prog - step * 0.05);
    } else {
      /* Übernahme durch Feinde: halten löscht den Besitzer */
      const pr = presence(g, gt.x, gt.y, gt.r + 180);
      if (!pr.contested && pr.pi >= 0 && foes(g, pr.pi, gt.owner) && pr.cp >= 2) { gt.prog = Math.min(1, gt.prog + step / 20); if (gt.prog >= 1) { ev(g, 'gateLost', { owner: gt.owner, by: pr.pi, x: gt.x, y: gt.y, id: gt.id }); gt.owner = -1; gt.state = 'dead'; gt.prog = 0; gt.by = pr.pi; } }
      else if (gt.prog > 0) gt.prog = Math.max(0, gt.prog - step * 0.1);
      /* Lanze: aufladen, feuern am Partnertor */
      if (gt.mode === 'lance' && pair) {
        gt.charge = Math.min(1, gt.charge + step / 120);
        if (gt.charge >= 0.95 && !gt.warned) { gt.warned = 1; ev(g, 'gateWarn', { x: pair.x, y: pair.y, owner: gt.owner, id: pair.id }); }
        if (gt.charge >= 1) {
          gt.charge = 0; gt.warned = 0; gt.overload++;
          const hit = e => { const d = hyp(e.x - pair.x, e.y - pair.y); if (d > 230 + e.def.r) return; damage(g, e, 1500 * (1 - Math.max(0, d - e.def.r) / 230 * 0.5), 'beam', null, gt.owner, pair.x, pair.y); };
          for (const u of g.ships) if (!u.dead) hit(u);
          for (const b of g.bldgs) if (!b.dead) hit(b);
          ev(g, 'gateLance', { x: pair.x, y: pair.y, fx: gt.x, fy: gt.y, owner: gt.owner });
          if (gt.overload >= 3) { ev(g, 'gateStorm', { x: pair.x, y: pair.y, owner: gt.owner }); if (g.neutral >= 0) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, u = addShip(g, 'drone', g.neutral, pair.x + dcos(a) * 90, pair.y + dsin(a) * 90, a); u.hx = u.x; u.hy = u.y; u.o = { t: 'amove', x: pair.x + dcos(a) * 600, y: pair.y + dsin(a) * 600, am: 1 }; } gt.owner = -1; gt.state = 'dead'; gt.overload = 0; gt.mode = 'bridge'; }
        }
      }
    }
    /* Durchflug */
    if (pair) nearShips(g, gt.x, gt.y, 46, u => { if (u.derelict || u.def.role === 'fighter' || u.gateCd > g.time || g.tm[u.owner] === 99) return false; if (!gateOpen(g, gt, u.owner)) return false; ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r, from: 1 }); const a = u.ang; u.x = pair.x + dcos(a) * 70; u.y = pair.y + dsin(a) * 70; u.lx = u.x; u.ly = u.y; u.path = null; u.gateCd = g.time + 6; if ((u.o.t === 'move' || u.o.t === 'amove') && hyp(u.o.x - gt.x, u.o.y - gt.y) < hyp(u.o.x - pair.x, u.o.y - pair.y)) setIdle(u); else if (u.o.t === 'harvest' || u.o.t === 'return') u.path = null; ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r }); return false; });
  }
}
function cmdGate(g, pi, id, mode) {
  const gt = g.byId.get(id);
  if (!gt || gt.k !== 5) return 'Nicht möglich';
  if (gt.owner !== pi) return 'Nicht dein Tor';
  if (['bridge', 'lock', 'lance'].indexOf(mode) < 0) return 'Nicht möglich';
  gt.mode = mode; gt.charge = 0; gt.warned = 0;
  ev(g, 'gateMode', { owner: pi, id, mode });
  return null;
}
/* Ereignisse: Sonneneruption (angekündigt, Schaden außerhalb des Schattens von Monden, Felsen, Stätten und Stationen) */
function inShadow(g, e) {
  for (const n of g.nodes) if (hyp(n.x - e.x, n.y - e.y) < n.r + 150) return true;
  for (const st of g.sites) if (hyp(st.x - e.x, st.y - e.y) < st.r + 150) return true;
  for (const b of g.bldgs) if (!b.dead && hyp(b.x - e.x, b.y - e.y) < b.def.r + 110) return true;
  const m = g.map, cx = (e.x / NAV) | 0, cy = (e.y / NAV) | 0;
  if (cx >= 0 && cy >= 0 && cx < m.gw && cy < m.gh && (m.nav[0][cy * m.gw + cx] & 1)) return true;
  for (const o of m.rocks) if (hyp(o.x - e.x, o.y - e.y) < o.r + 60) return true;
  return false;
}
function updateEvents(g, step) {
  for (const e of g.events) {
    if (e.kind !== 'flare') continue;
    if (e.state === 0 && g.time >= e.at - 25) { e.state = 1; ev(g, 'flareWarn', { at: e.at }); }
    else if (e.state === 1 && g.time >= e.at) { e.state = 2; e.end = e.at + 12; ev(g, 'flareStart', {}); g.flareOn = true; }
    else if (e.state === 2) {
      for (const u of g.ships) { if (u.dead || u.def.role === 'fighter') continue; if (inShadow(g, u)) continue; u.shield = 0; u.sT = 0; u.hull -= u.hullMax * 0.018 * step; if (u.hull <= 0) kill(g, u, null, -1); }
      if (g.time >= e.end) { e.state = 3; g.flareOn = false; ev(g, 'flareEnd', {}); e.kind = 'flare'; e.at = g.time + 360 + Math.floor(g.rng() * 240); e.state = 0; }
    }
  }
}

/* ------------------------------------------------------------------ Runde 4: The Brood
   Säure (Schaden über Zeit, ohne Panzerung), Parasiten (schlüpfen nach einiger Zeit als Schwarm), Sporenteppiche und
   Sporennester (Brood heilt, Feinde verlieren), Heilung lebender Schiffe und Nester, Mutation (Kokon), zeitlich begrenzte Brut. */
function acidOn(g, t, amt, owner) {
  const p = g.players[owner], m = p ? p.tfx.acid : 1;
  if (!t.acid) t.acid = { d: 0, t: 0, owner };
  t.acid.d = Math.min(t.hullMax * 0.05, t.acid.d + amt * 0.6 * m / 4); t.acid.t = 4; t.acid.owner = owner;
}
function paraOn(g, t, owner) {
  if (t.k !== 1 || t.def.role === 'fighter') return;
  const p = g.players[owner];
  if (!t.para) t.para = { t: 12 * (p ? p.tfx.paraT : 1), owner, n: 0 };
  t.para.n++; t.para.owner = owner;
}
function morphShip(g, u, toId) {
  const def = SHIPS[toId], p = g.players[u.owner], f = (1 + 0.1 * u.rank);
  p.shipCount += def.cp - u.def.cp;
  const frac = u.hull / u.hullMax;
  u.def = def; u.type = toId; u.cls = CLS_IDX[def.cls] || 0; u.hmul = 1;
  u.hullMax = def.hull * p.tfx.hull * f; u.hull = u.hullMax * Math.max(0.5, frac);
  u.wcd = def.wpn.map(() => 0); u.abcd = {}; u.abT = {}; u.cocoon = null; u.beams = null; u.tgt = 0; u.acid = null; u.para = null;
  setIdle(u);
  ev(g, 'morph', { x: u.x, y: u.y, owner: u.owner, r: def.r, id: u.id, name: def.name });
}
function updateDots(g, dt) {
  const all = g.ships;
  for (const u of all) {
    if (u.dead) continue;
    if (u.until && g.time > u.until) { kill(g, u, null, -1); continue; }
    if (u.acid) { const a = u.acid; a.t -= dt; damage(g, u, a.d * dt * g.pace.dmg, 'acid', null, a.owner, u.x, u.y, null, true); if (u.dead) continue; if (a.t <= 0) u.acid = null; }
    if (u.para) { const q = u.para; q.t -= dt; if (q.t <= 0) { const o = g.players[q.owner]; if (o && o.alive) { const s = addShip(g, 'swarm', q.owner, u.x + 20, u.y, u.ang + Math.PI); s.hull = s.hullMax * Math.min(1, 0.4 + 0.2 * q.n); s.o = { t: 'attack', tid: u.id, x: u.x, y: u.y }; s.tgt = u.id; } ev(g, 'hatch', { x: u.x, y: u.y, owner: q.owner, r: u.def.r }); damage(g, u, 60 * q.n, 'acid', null, q.owner, u.x, u.y, null, true); u.para = null; } }
    if (u.dead || u.derelict) continue;
    const p = g.players[u.owner];
    if (u.def.regen && u.hull < u.hullMax) { u.hull = Math.min(u.hullMax, u.hull + u.hullMax * u.def.regen * p.tfx.regen * dt * (p.lowPower ? 0.5 : 1) * g.pace.regen); }
    else if (p.regenAll && u.hull < u.hullMax) u.hull = Math.min(u.hullMax, u.hull + u.hullMax * 0.01 * p.regenAll * dt);
    if (u.cocoon) { const c = u.cocoon; c.t -= dt; if (c.t <= 0) morphShip(g, u, c.to); }
  }
  for (const b of g.bldgs) {
    if (b.dead) continue;
    if (b.acid) { const a = b.acid; a.t -= dt; damage(g, b, a.d * dt * g.pace.dmg, 'acid', null, a.owner, b.x, b.y, null, true); if (b.dead) continue; if (a.t <= 0) b.acid = null; }
    const lv = lvOf(b);
    if (lv.regen && b.done && b.hull < b.hullMax) { const p = g.players[b.owner]; b.hull = Math.min(b.hullMax, b.hull + b.hullMax * lv.regen * p.tfx.regen * dt * (p.lowPower ? 0.5 : 1) * g.pace.regen); }
  }
  /* Sporen: Teppiche und Nester */
  const areas = [];
  for (let i = g.spores.length - 1; i >= 0; i--) { const s = g.spores[i]; s.t -= dt; if (s.t <= 0) { g.spores.splice(i, 1); continue; } areas.push(s); }
  for (const b of g.bldgs) if (!b.dead && b.role === 'spore' && b.done) areas.push({ x: b.x, y: b.y, r: lvOf(b).aura, owner: b.owner, heal: 0.02, hurt: 0.01 });
  for (const s of areas) {
    const tm = g.tm[s.owner];
    nearShips(g, s.x, s.y, s.r, e => { if (e.dead || e.derelict || e.def.role === 'fighter') return false; if (g.tm[e.owner] === tm) { if (e.def.regen) e.hull = Math.min(e.hullMax, e.hull + e.hullMax * (s.heal || 0.02) * dt * g.pace.regen); } else damage(g, e, e.hullMax * (s.hurt || 0.015) * dt * g.pace.dmg, 'acid', null, s.owner, s.x, s.y, null, true); return false; });
    for (const b of g.bldgs) if (!b.dead && g.tm[b.owner] !== tm && hyp(b.x - s.x, b.y - s.y) <= s.r + b.def.r * 0.5) damage(g, b, b.hullMax * 0.004 * dt, 'acid', null, s.owner, s.x, s.y, null, true);
  }
}

/* ------------------------------------------------------------------ Fassung 22: Minenfelder
   Minen sind eigene Objekte in g.mines (nicht in byId): { id, x, y, owner, t Restzeit, arm Schärfzeit, hp }. Feinde sehen
   sie nur über die Nahsicht ihres Teams (visN: Schiffe 150 Einheiten, Sensorimpulse, Geschütze in Waffenreichweite). */
function mineSeen(g, pi, m) {
  if (pi < 0 || g.tm[m.owner] === g.tm[pi]) return true;
  const p = g.players[pi]; if (!p || !p.visN) return false;
  return p.visN[clamp((m.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((m.x / VIS) | 0, 0, g.vw - 1)] === g.visStamp;
}
function layMines(g, u) {
  /* kein zweites Feld auf demselben Fleck */
  let near = 0; for (const m of g.mines) if (m.owner === u.owner && hyp(m.x - u.x, m.y - u.y) < MINE.spread) near++;
  if (near >= MINE.n) return false;
  const a0 = g.rng() * TAU;
  for (let i = 0; i < MINE.n; i++) {
    const a = a0 + i / MINE.n * TAU + (g.rng() - 0.5) * 0.5, r = MINE.spread * (0.55 + 0.45 * g.rng());
    const x = clamp(u.x + dcos(a) * r, EDGE, g.map.w - EDGE), y = clamp(u.y + dsin(a) * r, EDGE, g.map.h - EDGE);
    g.mines.push({ id: g.nextId++, x, y, owner: u.owner, t: MINE.life, arm: MINE.arm, hp: MINE.hp });
  }
  /* höchstens MINE.max je Spieler: die ältesten verfallen */
  let n = 0; for (const m of g.mines) if (m.owner === u.owner) n++;
  for (let i = 0; i < g.mines.length && n > MINE.max; i++) if (g.mines[i].owner === u.owner) { g.mines.splice(i, 1); i--; n--; }
  ev(g, 'mines', { x: u.x, y: u.y, owner: u.owner, r: MINE.spread });
  return true;
}
function mineBoom(g, m) {
  const R0 = MINE.r;
  nearShips(g, m.x, m.y, R0 + 40, e => {
    if (e.dead || !foes(g, m.owner, e.owner)) return false;
    const d = hyp(e.x - m.x, e.y - m.y); if (d > R0 + e.def.r * 0.5) return false;
    const k = d < R0 * 0.35 ? 1 : Math.max(0.5, 1 - 0.5 * (d - R0 * 0.35) / (R0 * 0.65));
    damage(g, e, MINE.dmg * k * (COUNTER.mine[e.def.cls] || 1), 'mine', null, m.owner, m.x, m.y);
    return false;
  });
  ev(g, 'hit', { x: m.x, y: m.y, kind: 'torp', mine: 1 });
  ev(g, 'mineboom', { x: m.x, y: m.y, owner: m.owner, r: R0 });
}
function updateMines(g, dt) {
  let w = 0;
  for (let i = 0; i < g.mines.length; i++) {
    const m = g.mines[i];
    m.t -= dt; if (m.arm > 0) m.arm -= dt;
    if (m.t <= 0 || m.hp <= 0 || !g.players[m.owner].alive) continue;
    let hit = null;
    if (m.arm <= 0) nearShips(g, m.x, m.y, MINE.trig + 40, e => { if (e.dead || e.derelict || e.def.role === 'fighter' || !foes(g, m.owner, e.owner)) return false; if (hyp(e.x - m.x, e.y - m.y) <= MINE.trig + e.def.r * 0.6) { hit = e; return true; } return false; });
    if (hit) { mineBoom(g, m); continue; }
    g.mines[w++] = m;
  }
  g.mines.length = w;
}
