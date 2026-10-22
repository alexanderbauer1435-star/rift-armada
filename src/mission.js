/* ===== mission.js ===== */
'use strict';
/* =====================================================================
   KAMPAGNE »QUARANTINE« – Missionsgerüst. Eine Mission hat eine eigene Karte (map.build auf leerer Fläche), Seiten
   (sides: Fraktion, Name, mit oder ohne Basis, KI-Stufe je Schwierigkeit, Team), Sperren für den Spieler, Ziele, einen
   Aufbau (setup, einmal) und einen Ablauf (step, jede halbe Sekunde). Der Zustand steht als reine Daten in g.mis und wird
   mit dem Spielstand gespeichert; alles läuft über g.rng und die Simulation, auf jedem Gerät gleich.
   Erzählmittel: Funksprüche mit Sprecher (misSay), Kamerafahrten (misCam), Entscheidungen (misAsk → Befehl »choice«).
   Kampagnenwissen, das spätere Missionen verändert (Konvoi oder Tor, Voss verschont, Knoten lebt), kommt als
   opts.mis.carry in die Partie und steht damit auch im Spielstand.
   ===================================================================== */
const MIS_LOCKED = 'In dieser Mission nicht verfügbar';
/* Figuren: Name, Fraktion für Farbe und Porträt */
const CHARS = {
  voss: { name: 'Ilya Voss', role: 'Admiralin der Alliance', f: 'alliance' },
  vossY: { name: 'Leutnant Ilya Voss', role: 'Offizierin des Imperiums', f: 'legion' },
  dal: { name: 'Ratsherr Aren Dal', role: 'Hardliner der Alliance', f: 'alliance' },
  kessler: { name: 'Mara Kessler', role: 'Kommandantin der Republik', f: 'mars' },
  bricks: { name: 'Sgt. »Bricks« Okafor', role: 'Marine der Republik', f: 'mars' },
  seraph: { name: 'Seraph', role: 'KI des Flaggschiffs', f: 'legion' },
  cassius: { name: 'Cassius', role: 'Junge Legion-KI', f: 'legion' },
  facet: { name: 'Prime Facet', role: 'Der älteste Kristall', f: 'nexus' },
  node: { name: 'Knoten K-7', role: 'Abgetrennter Knoten', f: 'nexus' },
  voice: { name: 'Die Stimme', role: 'Signal unbekannter Herkunft', f: 'brood' },
  vex: { name: 'Vex', role: 'Piratenfürst', f: 'mars' },
  echo: { name: 'Das Echo', role: 'Hologramm eines Erbauers', f: 'guardian' },
  emperor: { name: 'Der Kaiser', role: 'Imperium', f: 'legion' },
  marr: { name: 'Ratsfrau Elin Marr', role: 'Diplomatin der Charta', f: 'alliance' },
  hale: { name: 'General Corvin Hale', role: 'Oberbefehlshaber der Flotte', f: 'alliance' },
  kesslerA: { name: 'Mara Kessler', role: 'Flottenadmiralin der Republik', f: 'mars' },
  calder: { name: 'Kommodore Rhys Calder', role: 'Erzfeind', f: 'alliance' },
  tarn: { name: 'Major Ilka Tarn', role: 'Erzfeind', f: 'mars' },
  varo: { name: 'Inquisitor Varo', role: 'Erzfeind', f: 'legion' },
  nullf: { name: 'Facette Null', role: 'Erzfeind', f: 'nexus' },
  hq: { name: 'Leitstelle', role: '', f: '' },
  foe: { name: 'Feindfunk', role: '', f: '' }
};
const MISSIONS = {};
/* Kampagne: Akte mit ihren Missionen (Reihenfolge = Freischaltung) */
const CAMPAIGN = [
  { id: 't', name: 'Ausbildung', f: 'alliance', ms: ['tut'], free: 1 },
  { id: 'p', name: 'Prolog: The Silence', f: 'legion', ms: ['p1'] },
  { id: 'a1', name: 'Akt 1: Haven', f: 'alliance', ms: ['a1m1', 'a1m2', 'a1m3'] },
  { id: 'a2', name: 'Akt 2: The Long Burn', f: 'mars', ms: ['a2m1', 'a2m2'] },
  { id: 'a3', name: 'Akt 3: Awakening', f: 'legion', ms: ['a3m1', 'a3m2'] },
  { id: 'a4', name: 'Akt 4: One Voice', f: 'nexus', ms: ['a4m1', 'a4m2'] },
  { id: 'a5', name: 'Akt 5: Quarantine', f: '', ms: ['a5m1'] },
  { id: 'b', name: 'Bonus: The Hunger', f: 'brood', ms: ['b1'] }
];
const CAMP_ORDER = CAMPAIGN.filter(c => !c.free).reduce((a, c) => a.concat(c.ms), []);

/* ------------------------------------------------------------------ Karte und Aufstellung */
function misMap(id, seed, mis) {
  const def = MISSIONS[id], M = typeof def.map === 'function' ? def.map(mis || {}) : def.map, rng = makeRng((seed || 1) * 2654435761 + hashStr(id));
  const map = { id: 'mission', name: def.name, w: M.w, h: M.h, np: M.starts.length, starts: M.starts.map(s => ({ x: s.x, y: s.y, ang: s.ang || 0 })), nodes: [], rocks: [], fields: [], sites: [], gates: [], seed };
  M.build(map, rng);
  buildNav(map);
  return map;
}
/* Stätte ohne Abstandsprüfung zum Start (Missionen setzen sie gezielt) */
function misSite(map, kind, x, y) { map.sites.push({ kind, x, y, r: SITE_DEF[kind].r }); }
/* Aufstellung: Sitz 0 ist immer der Spieler. fac ersetzt die Fraktion des Spielers (Finale: frei wählbar). */
function misOpts(id, lvl, carry, fac) {
  const def = MISSIONS[id];
  lvl = clamp(lvl | 0, 1, 3);
  const sides = typeof def.sides === 'function' ? def.sides(fac, carry || {}) : def.sides;
  const players = sides.map((s, i) => {
    const o = { faction: i === 0 && fac ? fac : s.f, team: s.team !== undefined ? s.team : i === 0 ? 0 : 1 };
    if (i === 0) o.human = true;
    else if (s.ai) o.ai = Array.isArray(s.ai) ? s.ai[lvl - 1] : s.ai;
    else o.ai = 0;
    if (s.base === false) o.base = false;
    if (s.name) o.name = s.name;
    if (s.color) o.color = s.color;
    return o;
  });
  return { seed: def.seed || 1, players, mis: { id, lvl, carry: JSON.parse(JSON.stringify(carry || {})) } };
}
function lv(g, a, b, c) { const l = g.mis.lvl; return l === 1 ? a : l === 2 ? b : c; }
function misInit(g) {
  const o = g.opts.mis, def = MISSIONS[o.id];
  const M = g.mis = { id: o.id, lvl: clamp(o.lvl | 0, 1, 3), goals: misGoalDefs(g).map(q => ({ id: q.id, st: 0, v: 0, n: q.n || 0 })), tag: {}, t: {}, f: {}, rq: [], res: 0, why: '', ch: {}, ask: null, carry: o.carry || {}, S: {} };
  const h = g.players[g.human];
  if (def.lock) h.lock = { ships: def.lock.ships ? def.lock.ships.slice() : null, bldgs: def.lock.bldgs ? def.lock.bldgs.slice() : null, noDoc: !!def.lock.noDoc };
  def.setup(g, M, M.lvl);
  for (const p of g.players) { recalcPower(g, p.id); recalcCp(g, p.id); }
  if (def.supply !== false) misSupply(g, g.human);
}
/* freier Bauplatz im Ring um eine Station */
function misSpot(g, pi, role, b, r0) { for (let r = r0 || 230; r <= 520; r += 60) for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + 0.35, x = b.x + dcos(a) * r, y = b.y + dsin(a) * r; if (!canPlace(g, pi, role, x, y)) return [x, y]; } return null; }
/* Startversorgung des Spielers: genug Energie und Kommandopunkte, damit keine Mission im Mangel beginnt */
function misSupply(g, pi) {
  const p = g.players[pi], b = g.bldgs.find(x => !x.dead && x.owner === pi && x.role === 'base');
  if (!b || p.nob) return;
  const spot = role => misSpot(g, pi, role, b);
  for (let k = 0; k < 3 && p.eGen < p.eUse + 8 && BLDG[p.faction].reactor; k++) { const s = spot('reactor'); if (!s) break; misBldg(g, pi, 'reactor', s[0], s[1]); recalcPower(g, pi); }
  for (let k = 0; k < 2 && p.cpUse > p.cpMax - 4 && BLDG[p.faction].relay; k++) { const s = spot('relay'); if (!s) break; misBldg(g, pi, 'relay', s[0], s[1]); recalcPower(g, pi); recalcCp(g, pi); }
  for (let k = 0; k < 2 && p.eGen < p.eUse + 4 && BLDG[p.faction].reactor; k++) { const s = spot('reactor'); if (!s) break; misBldg(g, pi, 'reactor', s[0], s[1]); recalcPower(g, pi); }
}
/* Zieldefinitionen einer Mission (bei Conquest-Schlachten aus der Schlachtbeschreibung) */
function misGoalDefs(g) { const o = g.opts.mis, def = MISSIONS[o.id]; return typeof def.goals === 'function' ? def.goals(o) : def.goals; }
/* ------------------------------------------------------------------ Ziele, Funk, Kamera, Entscheidungen, Ende */
function misGoal(g, id) { for (const q of g.mis.goals) if (q.id === id) return q; return null; }
/* st: 0 verborgen, 1 offen, 2 erfüllt, 3 verfehlt */
function misSet(g, id, st, v, n) {
  const q = misGoal(g, id);
  if (!q) return;
  if (v !== undefined) q.v = v;
  if (n !== undefined) q.n = n;
  if (q.st === st) return;
  q.st = st;
  ev(g, 'goal', { id, st });
}
function misOn(g, id) { const q = misGoal(g, id); return !!q && q.st === 1; }
function misDone(g, id) { const q = misGoal(g, id); return !!q && q.st === 2; }
function misSay(g, text, who, delay) {
  const M = g.mis;
  if (delay) { M.rq.push([g.time + delay, text, who || 'hq']); return; }
  ev(g, 'radio', { k: text, who: who || 'hq' });
}
function misCam(g, x, y, z, dur) { ev(g, 'cam', { x, y, z: z || 0, d: dur || 2 }); }
function misReveal(g, x, y, r, dur) { g.reveals.push({ owner: g.human, x, y, r, until: g.time + (dur || 20) }); }
function misAsk(g, id, q, opts, who) { g.mis.ask = { id, q, o: opts, who: who || 'hq' }; ev(g, 'ask', { id }); }
function misChoose(g, pi, id, v) {
  const M = g.mis;
  if (!M || pi !== g.human || !M.ask || M.ask.id !== id || !M.ask.o.some(o => o[0] === v)) return 'Nicht möglich';
  M.ch[id] = v; M.ask = null;
  ev(g, 'chosen', { id, v });
  return null;
}
function misWin(g) {
  const M = g.mis, def = MISSIONS[M.id];
  if (M.res || g.over) return;
  const gd = misGoalDefs(g);
  for (const q of M.goals) { const d = gd.find(x => x.id === q.id); if (!d.side) { if (q.st !== 3) q.st = 2; } else if (q.st <= 1) q.st = d.keep ? 2 : 3; }
  M.res = 1; M.t.end = g.time;
  g.over = true; g.winner = g.human; g.winTeam = g.tm[g.human];
  ev(g, 'over', { winner: g.human, team: g.winTeam, mis: 1 });
}
function misLose(g, why) {
  const M = g.mis;
  if (M.res || g.over) return;
  for (const q of M.goals) if (q.st === 1) q.st = 3;
  M.res = 2; M.why = why || ''; M.t.end = g.time;
  let w = -1;
  for (const p of g.players) if (!p.neutral && g.tm[p.id] !== g.tm[g.human]) { w = p.id; break; }
  g.over = true; g.winner = w; g.winTeam = w >= 0 ? g.tm[w] : -1;
  ev(g, 'over', { winner: w, mis: 1, why: M.why });
}
function misStep(g) {
  const M = g.mis, def = MISSIONS[M.id];
  if (M.res) return;
  for (let i = 0; i < M.rq.length; i++) { const r = M.rq[i]; if (g.time >= r[0]) { M.rq.splice(i--, 1); ev(g, 'radio', { k: r[1], who: r[2] }); } }
  def.step(g, M, M.lvl);
  if (g.over) return;
  /* Grundregel: verloren, wenn der Spieler besiegt ist; ohne Basis, wenn kein Kampfschiff mehr fliegt */
  const h = g.players[g.human];
  if (!h.alive) { misLose(g, 'Die Basis ist gefallen'); return; }
  if (h.nob && !g.ships.some(u => !u.dead && !u.derelict && u.owner === g.human && u.def.role !== 'fighter')) misLose(g, 'Alle Schiffe verloren');
}
/* ------------------------------------------------------------------ Hilfen */
function misIds(list) { return list.filter(e => e).map(e => e.id); }
function misLive(g, ids) { const out = []; for (const id of ids || []) { const e = g.byId.get(id); if (e && !e.dead && !e.derelict) out.push(e); } return out; }
function misCount(g, ids) { return misLive(g, ids).length; }
function misTag(g, name, ents) { const M = g.mis; M.tag[name] = (M.tag[name] || []).concat(misIds(ents)); return ents; }
/* Verband in Reihen aufstellen, Blick in Richtung ang */
function misSpawn(g, owner, list, x, y, ang, opt) {
  const out = [], n = list.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6))), gap = (opt && opt.gap) || 46;
  const a = ang || 0, fx = dcos(a), fy = dsin(a), sx = -fy, sy = fx;
  list.forEach((t, i) => {
    const r = (i / cols) | 0, c = i % cols, off = (c - (Math.min(cols, n - r * cols) - 1) / 2) * gap, back = -r * gap;
    const px = clamp(x + sx * off + fx * back, EDGE + 30, g.map.w - EDGE - 30), py = clamp(y + sy * off + fy * back, EDGE + 30, g.map.h - EDGE - 30);
    const u = addShip(g, t, owner, px, py, a);
    if (opt && opt.hold) { u.o = { t: 'hold' }; u.hold = true; }
    if (opt && opt.hero) u.hero = opt.hero;
    out.push(u);
  });
  return out;
}
/* Station für eine Mission setzen (fertig, optional Stufe) */
function misBldg(g, owner, role, x, y, lvl) {
  const b = addBldg(g, role, owner, x, y, true);
  if (lvl && lvl > 1) { b.lv = lvl; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield * g.players[owner].tfx.shield; b.shield = b.shieldMax; b.wcd = l.wpn.map(() => 0); }
  return b;
}
/* Angriff: untätige Schiffe einer Gruppe fliegen im Angriffsmarsch zum Ziel (Punkt) oder zum nächsten Ziel des Spielerteams */
function misHunt(g, ids, to) {
  const team = g.tm[g.human];
  for (const u of misLive(g, ids)) {
    if (u.o.t !== 'idle' && u.o.t !== 'hold') continue;
    let tx, ty;
    if (to) { tx = to.x; ty = to.y; }
    else {
      let best = null, bd = 1e9;
      for (const b of g.bldgs) if (!b.dead && g.tm[b.owner] === team) { const d = hyp(b.x - u.x, b.y - u.y); if (d < bd) { bd = d; best = b; } }
      for (const s of g.ships) if (!s.dead && !s.derelict && g.tm[s.owner] === team && s.def.role !== 'fighter') { const d = hyp(s.x - u.x, s.y - u.y) + 200; if (d < bd) { bd = d; best = s; } }
      if (!best) continue;
      tx = best.x; ty = best.y;
    }
    u.hold = false; u.o = { t: 'amove', x: tx + (u.id % 7 - 3) * 18, y: ty + (u.id % 5 - 2) * 18 }; u.path = null;
  }
}
/* Schiffe einer Seite in einem Kreis (pred optional) */
function misNear(g, owner, x, y, r, pred) { let n = 0; for (const u of g.ships) if (!u.dead && !u.derelict && u.owner === owner && u.def.role !== 'fighter' && hyp(u.x - x, u.y - y) <= r && (!pred || pred(u))) n++; return n; }
function misTeamNear(g, x, y, r) { const t = g.tm[g.human]; let n = 0; for (const u of g.ships) if (!u.dead && !u.derelict && g.tm[u.owner] === t && u.def.role !== 'fighter' && hyp(u.x - x, u.y - y) <= r) n++; return n; }
function misHas(g, pi, role) { for (const b of g.bldgs) if (b.owner === pi && !b.dead && b.done && b.role === role) return true; return false; }
function misHasLv(g, pi, role, l) { for (const b of g.bldgs) if (b.owner === pi && !b.dead && b.done && b.role === role && b.lv >= l) return true; return false; }
/* Gegnerische KI-Basis in einer Mission befestigen: Kommandobasis ausgebaut (bewaffnet), Türme Richtung Kartenmitte,
   eine Garnison, die die Basis hält, und Rücklagen – damit ein früher Ansturm nicht genügt */
const MIS_GARRISON = { alliance: ['lancer', 'lancer', 'bulwark', 'wren'], mars: ['hedgehog', 'hedgehog', 'spear', 'needle'], legion: ['paladin', 'paladin', 'bastion', 'herald'],
  nexus: ['prism', 'shard', 'shard', 'shard', 'binder'], brood: ['ravager', 'spitter', 'spitter', 'swarm'] };
function misFortify(g, pi, extra) {
  const p = g.players[pi], b = g.bldgs.find(x => !x.dead && x.owner === pi && x.role === 'base');
  if (!b) return [];
  const L = g.mis.lvl, cx = g.map.w / 2, cy = g.map.h / 2, a = datan2(cy - b.y, cx - b.x);
  b.lv = L >= 3 ? 3 : 2; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield * p.tfx.shield; b.shield = b.shieldMax; b.wcd = l.wpn.map(() => 0);
  const role = BLDG[p.faction].turret ? 'turret' : 'flak', nT = 1 + L;
  for (let i = 0; i < nT; i++) { const aa = a + (i - (nT - 1) / 2) * 0.55, x = b.x + dcos(aa) * 230, y = b.y + dsin(aa) * 230; if (!canPlace(g, pi, role, x, y)) misBldg(g, pi, role, x, y, L >= 2 ? 2 : 1); }
  const set = MIS_GARRISON[p.faction] || MIS_GARRISON.alliance, list = [];
  for (let i = 0; i < Math.round(set.length * (0.75 + 0.5 * L)) + (extra || 0); i++) list.push(set[i % set.length]);
  const gar = misSpawn(g, pi, list, b.x + dcos(a) * 330, b.y + dsin(a) * 330, a, { hold: true });
  for (const u of gar) { u.hx = u.x; u.hy = u.y; u.gar = 1; }
  p.ice += [0, 900, 1800, 2800][L]; p.ore += [0, 500, 1000, 1600][L];
  recalcPower(g, pi); recalcCp(g, pi);
  return gar;
}
/* Zielmarken auf Karte und Minikarte (nur Anzeige): Schlüssel, Ort, Radius, Beschriftung */
function misMark(g, key, x, y, r, t) { const M = g.mis; M.marks = M.marks || []; const m = M.marks.find(k => k.key === key); if (m) { m.x = x; m.y = y; m.r = r; m.t = t; } else M.marks.push({ key, x, y, r, t }); }
function misUnmark(g, key) { const M = g.mis; if (M.marks) M.marks = M.marks.filter(m => m.key !== key); }
/* Zeitziel: in M.t[key] steht die Endzeit */
function misLeft(g, M, key) { return Math.max(0, Math.ceil((M.t[key] || 0) - g.time)); }
