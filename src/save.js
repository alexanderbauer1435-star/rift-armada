/* ===== save.js ===== */
'use strict';
/* =====================================================================
   SPIELSTAND – wandelt eine laufende Partie in reine Daten und zurück. Die Karte entsteht aus Kennung, Parteienzahl und
   Startwert neu; Verweise auf Spieldaten (Schiffstyp, Stationstyp, Waffen) werden als Kennungen abgelegt.
   ===================================================================== */
const SAVE_V = 5, SAVE_KEY = 'ra.save';
function rleEnc(arr, test) { const out = []; let cur = 0, run = 0; for (let i = 0; i < arr.length; i++) { const v = test(arr[i]) ? 1 : 0; if (v === cur) run++; else { out.push(run); cur = v; run = 1; } } out.push(run); return out; }
function rleDec(runs, arr, val) { let i = 0, cur = 0; for (const run of runs) { if (cur) arr.fill(val, i, i + run); i += run; cur ^= 1; } }
function saveGame(g) {
  const enc = v => {
    if (v === undefined || typeof v === 'function') return undefined;
    if (v === null) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : null;
    if (t !== 'object') return v;
    if (ArrayBuffer.isView(v)) return undefined;
    if (Array.isArray(v)) return v.map(x => { const y = enc(x); return y === undefined ? null : y; });
    if (v instanceof Map || v instanceof Set) return undefined;
    if (typeof v.id === 'string' && SHIPS[v.id] === v) return { $u: v.id };
    if (v.role && BLDG[v.f] && BLDG[v.f][v.role] === v) return { $b: [v.f, v.role] };
    if (typeof v.id === 'string' && FACTIONS[v.id] === v) return { $f: v.id };
    for (const l in AI_LEVELS) if (AI_LEVELS[l] === v) return { $c: +l };
    const o = {};
    for (const k in v) { if (k === 'path' || k === 'beams' || k === 'aimA' || k === 'vis' || k === 'visN' || k === 'explored' || k === 'rng') continue; const y = enc(v[k]); if (y !== undefined) o[k] = y; }
    return o;
  };
  return {
    v: SAVE_V, opts: g.opts, rng: g.rng.st.a, tick: g.tick, time: g.time, nextId: g.nextId, over: g.over, winner: g.winner, winTeam: g.winTeam, visStamp: g.visStamp,
    players: g.players.map(p => { const o = enc(p); o.ex = rleEnc(p.explored, v => v); return o; }),
    ships: g.ships.filter(e => !e.dead).map(enc), bldgs: g.bldgs.filter(e => !e.dead).map(enc), nodes: g.nodes.map(n => [n.amount, n.miners]), proj: enc(g.proj), wrecks: enc(g.wrecks), reveals: enc(g.reveals), strikes: enc(g.strikes), log: g.log,
    sites: enc(g.sites), gates: enc(g.gates), events: enc(g.events), flares: enc(g.flares), flareOn: !!g.flareOn, spores: enc(g.spores), wave: enc(g.wave), threat: g.threat, mis: enc(g.mis), fort: enc(g.fort)
  };
}
function loadGame(d) {
  if (!d || d.v !== SAVE_V || !d.opts || !Array.isArray(d.ships)) return null;
  const g = createGame(d.opts);
  if (d.players.length !== g.players.length || d.nodes.length !== g.nodes.length) return null;
  const dec = v => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(dec);
    if (v.$u) return SHIPS[v.$u];
    if (v.$b) return BLDG[v.$b[0]][v.$b[1]];
    if (v.$f) return FACTIONS[v.$f];
    if (v.$c) return AI_LEVELS[v.$c];
    const o = {};
    for (const k in v) o[k] = dec(v[k]);
    return o;
  };
  /* alles verwerfen, was createGame aufgestellt hat */
  for (const b of g.bldgs) navBlock(g.map, b.x, b.y, b.def.r, false);
  g.byId = new Map();
  for (const n of g.nodes) g.byId.set(n.id, n);
  g.ships = d.ships.map(dec); g.bldgs = d.bldgs.map(dec);
  for (const u of g.ships) { if (!u.def) return null; u.path = null; u.beams = null; g.byId.set(u.id, u); }
  for (const b of g.bldgs) { if (!b.def) return null; b.beams = null; g.byId.set(b.id, b); navBlock(g.map, b.x, b.y, b.def.r, true); }
  d.players.forEach((pd, i) => { const p = g.players[i], ex = pd.ex; delete pd.ex; const vis = p.vis, visN = p.visN, explored = p.explored; Object.assign(p, dec(pd)); p.vis = vis; p.visN = visN; p.explored = explored; explored.fill(0); rleDec(ex, explored, 1); p.F = FACTIONS[p.faction]; if (p.ai) p.ai.cfg = AI_LEVELS[p.ai.lvl] || AI_LEVELS[2]; });
  d.nodes.forEach((n, i) => { g.nodes[i].amount = n[0]; g.nodes[i].miners = n[1]; });
  g.proj = dec(d.proj || []); g.wrecks = dec(d.wrecks || []); g.reveals = dec(d.reveals || []); g.strikes = dec(d.strikes || []); g.log = d.log || [];
  /* Stätten und Tore behalten ihre Kennungen aus createGame, nur der Zustand kommt aus dem Spielstand */
  if (Array.isArray(d.sites) && d.sites.length === g.sites.length) d.sites.forEach((sd, i) => Object.assign(g.sites[i], dec(sd)));
  if (Array.isArray(d.gates) && d.gates.length === g.gates.length) d.gates.forEach((gd, i) => Object.assign(g.gates[i], dec(gd)));
  for (const o of g.sites) g.byId.set(o.id, o);
  for (const o of g.gates) g.byId.set(o.id, o);
  g.events = dec(d.events || g.events); g.flares = dec(d.flares || []); g.flareOn = !!d.flareOn; g.spores = dec(d.spores || []);
  if (d.wave) { g.wave = dec(d.wave); g.threat = d.threat; }
  if (d.mis) g.mis = dec(d.mis);
  if (d.fort) g.fort = dec(d.fort);
  g.rng.st.a = d.rng | 0; /* Fassung 22: wie core.js mit Vorzeichen, sonst weicht die Prüfsumme nach dem Laden ab */ g.tick = d.tick; g.time = d.time; g.nextId = d.nextId; g.over = d.over; g.winner = d.winner; g.winTeam = d.winTeam; g.visStamp = d.visStamp || 1;
  g.ev.length = 0;
  updateVision(g);
  for (const p of g.players) if (p.alive) { recalcPower(g, p.id); recalcCp(g, p.id); p.tech = p.tech || {}; recalcTech(g, p); }
  return g;
}
function saveNow() {
  const g = UI.g;
  if (!g || UI.attract || g.over || (UI.kind !== 'skirmish' && UI.kind !== 'sandbox' && UI.kind !== 'waves' && UI.kind !== 'mis' && UI.kind !== 'cq')) return false;
  try {
    const c = R.s2w(R.cssW / 2, R.cssH / 2);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ game: saveGame(g), ui: { cam: [c.x, c.y, R.cam.z], kind: UI.kind, t: Date.now() }, meta: slotMeta(g) }));
    return true;
  } catch (e) { return false; }
}
/* Speicherplätze 1–3 (zusätzlich zur automatischen Sicherung »Fortsetzen«): gleicher Inhalt plus Kurzinfo für die Liste */
const SLOT_KEY = 'ra.slot';
function slotMeta(g) { const P = g.players[g.human >= 0 ? g.human : 0]; return { map: g.map.name, fac: P.faction, t: Math.round(g.time), date: Date.now(), np: g.players.filter(q => !q.neutral && q.team !== 98).length, kind: UI.kind }; }
function saveSlot(n) {
  const g = UI.g;
  if (!g || UI.attract || g.over || (UI.kind !== 'skirmish' && UI.kind !== 'sandbox' && UI.kind !== 'waves')) return false;
  try { const c = R.s2w(R.cssW / 2, R.cssH / 2); localStorage.setItem(SLOT_KEY + n, JSON.stringify({ game: saveGame(g), ui: { cam: [c.x, c.y, R.cam.z], kind: UI.kind, t: Date.now() }, meta: slotMeta(g) })); return true; } catch (e) { return false; }
}
function readSlot(n) { try { const d = JSON.parse(localStorage.getItem(SLOT_KEY + n) || 'null'); return d && d.game ? d : null; } catch (e) { return null; } }
function clearSlot(n) { try { localStorage.removeItem(SLOT_KEY + n); } catch (e) { /* egal */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* egal */ } }
function readSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && d.game ? d : null; } catch (e) { return null; } }
