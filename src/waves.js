/* ===== waves.js ===== */
'use strict';
/* =====================================================================
   WELLEN – Rift Survival (allein, endlos, Highscore) und Quarantine Line (bis zu 4 gegen die Brood, das Siegel halten).
   Die Brood kommt als eigene Partei (team 98, nicht spielbar, keine Stationen) aus Rissen am Kartenrand. Zwischen den
   Wellen eine Bauphase mit Countdown. Nach jeder Welle wählt jeder Spieler eine von drei Belohnungskarten.
   opts.mode: 'survival' | 'quarantine'. Zustand in g.wave.
   ===================================================================== */
const WAVE_BUILD = 60, WAVE_FIRST = 180, WAVE_MAX_T = 150, QUARANTINE_WAVES = 20;
/* Belohnungskarten: fx wie Forschung (Multiplikatoren auf tfx), special für Sonderwirkungen */
const REWARDS = [
  { id: 'hull', name: 'Dicke Rümpfe', desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } },
  { id: 'shield', name: 'Schildzellen', desc: 'Schilde +25 %.', fx: { shield: 1.25 }, need: 'shield' },
  { id: 'armor', name: 'Panzerplatten', desc: 'Panzerung +1.', fx: { armor: 1 }, need: 'armor' },
  { id: 'dmg', name: 'Scharfe Waffen', desc: 'Alle Waffen +12 % Schaden.', fx: { beam: 1.12, kin: 1.12, torp: 1.12, rail: 1.12 } },
  { id: 'rate', name: 'Werftautomatik', desc: 'Werften bauen 30 % schneller.', fx: { rate: 1.3 } },
  { id: 'income', name: 'Nachschub', desc: '+8 Eis und +4 Erz je Sekunde, dauerhaft.', special: 'income' },
  { id: 'cp', name: 'Mehr Kommando', desc: '+10 Kommandopunkte.', special: 'cp' },
  { id: 'base2', name: 'Basis feuert doppelt', desc: 'Die Kommandobasis und alle Türme laden doppelt so schnell.', special: 'base2' },
  { id: 'drones', name: '+1 Drohne', desc: 'Jedes Heldenschiff bekommt eine Begleitdrohne mehr.', fx: { drones: 1 }, need: 'legion' },
  { id: 'regen', name: 'Selbstheilung', desc: 'Alle Schiffe heilen 1 % Hülle je Sekunde.', special: 'regen' },
  { id: 'relics', name: 'Reliktfund', desc: '+6 Relikte sofort.', special: 'relics' },
  { id: 'speed', name: 'Schnelle Triebwerke', desc: 'Schiffe fliegen 15 % schneller.', fx: { speed: 1.15 } },
  { id: 'cash', name: 'Kriegskasse', desc: '+1500 Eis und +800 Erz sofort.', special: 'cash' },
  { id: 'super', name: 'Superwaffe geladen', desc: 'Die Superwaffe ist sofort geladen; ohne Superwaffe: Basis wird sofort repariert.', special: 'super' },
  { id: 'sealheal', name: 'Siegel gefestigt', desc: 'Das Siegel wird um 40 % repariert und bekommt +20 % Hülle.', special: 'seal', need: 'seal' }
];
for (const r of REWARDS) r.fx = r.fx || {};
/* Wellenzusammenstellung: Wert wächst je Welle und je Spielerzahl; alle 5 Wellen ein Leviathan, Welle 20 die Matriarch */
function waveComp(g, n) {
  const np = g.players.filter(p => !p.neutral && !p.threat).length;
  let value = (600 + n * 320) * (0.7 + 0.3 * np);
  const out = [];
  const add = (t, k) => { for (let i = 0; i < k; i++) out.push(t); };
  /* Anpassung: viel kinetische Waffen der Spieler → mehr Panzer (Ravager, Acid Maw); viele Strahlen → Schwärme */
  const w = g.wave.adapt;
  const kin = w.kin / Math.max(1, w.kin + w.beam);
  if (n % 5 === 0 && n > 0) { add('leviathan', 1 + Math.floor(n / 10)); value -= 2000 * (1 + Math.floor(n / 10)); }
  if (n >= QUARANTINE_WAVES && g.opts.mode === 'quarantine' && !g.wave.matriarch) { add('matriarch', 1); g.wave.matriarch = 1; value -= 2200; }
  if (n >= 10 && n % 3 === 0) add('plaguebearer', 1 + Math.floor(n / 12));
  let guard = 0;
  while (value > 0 && guard++ < 200) {
    const r = g.rng();
    let t;
    if (n >= 6 && r < 0.12) t = kin > 0.5 ? 'acidmaw' : 'sporer';
    else if (r < 0.3 + (kin > 0.5 ? 0.15 : 0)) t = 'ravager';
    else if (r < 0.5) t = 'spitter';
    else if (r < 0.6 && n >= 3) t = 'leech';
    else t = 'swarm';
    out.push(t); value -= SHIPS[t].cost.ice;
  }
  return out;
}
function waveRifts(g) {
  const m = g.map;
  if (m.rifts && m.rifts.length) return m.rifts;
  return [{ x: m.w / 2, y: EDGE + 120 }, { x: m.w - EDGE - 120, y: m.h / 2 }, { x: m.w / 2, y: m.h - EDGE - 120 }, { x: EDGE + 120, y: m.h / 2 }];
}
function waveTarget(g) {
  if (g.opts.mode === 'quarantine') { const s = g.bldgs.find(b => !b.dead && b.role === 'seal'); if (s) return s; }
  const h = g.players.find(p => p.human && p.alive) || g.players.find(p => !p.neutral && !p.threat && p.alive);
  const b = h ? g.bldgs.find(b => !b.dead && b.owner === h.id && b.role === 'base') || g.bldgs.find(b => !b.dead && b.owner === h.id) : null;
  return b || { x: g.map.w / 2, y: g.map.h / 2 };
}
function waveSpawn(g) {
  const W = g.wave, tp = g.players[g.threat], comp = waveComp(g, W.n), rifts = waveRifts(g);
  const tgt = waveTarget(g);
  /* mit der Zeit öffnen sich mehr Risse */
  const nR = Math.min(rifts.length, 1 + Math.floor((W.n - 1) / 3));
  const order = rifts.slice().sort((a, b) => hyp(a.x - tgt.x, a.y - tgt.y) - hyp(b.x - tgt.x, b.y - tgt.y));
  const use = [];
  for (let i = 0; i < nR; i++) use.push(order[(W.n + i) % order.length]);
  W.ids = [];
  comp.forEach((t, i) => {
    const r = use[i % use.length], a = g.rng() * TAU, d = 30 + g.rng() * 160;
    const u = addShip(g, t, tp.id, clamp(r.x + dcos(a) * d, 20, g.map.w - 20), clamp(r.y + dsin(a) * d, 20, g.map.h - 20), datan2(tgt.y - r.y, tgt.x - r.x));
    u.nocp = 1; tp.shipCount -= u.def.cp;
    if (W.armor) u.armorPlus = W.armor;
    u.o = { t: 'amove', x: tgt.x + dcos(a) * 120, y: tgt.y + dsin(a) * 120 };
    W.ids.push(u.id);
  });
  W.open = W.open || [];
  for (const r of use) { ev(g, 'rift', { x: r.x, y: r.y, n: W.n }); if (!W.open.some(o => o.x === r.x && o.y === r.y)) W.open.push({ x: r.x, y: r.y }); }
  W.phase = 'wave'; W.t0 = g.time; W.spawned = comp.length;
  ev(g, 'wave', { n: W.n, count: comp.length });
}
function waveAdaptCount(g) {
  const A = g.wave.adapt;
  A.kin = 0; A.beam = 0;
  for (const u of g.ships) { if (u.dead || !g.players[u.owner] || g.players[u.owner].threat || g.players[u.owner].neutral) continue; for (const w of u.def.wpn) { if (w.kind === 'kin' || w.kind === 'rail') A.kin += w.dmg / w.reload; else if (w.kind === 'beam') A.beam += w.dmg / w.reload; } }
  g.wave.armor = A.kin > A.beam * 1.5 && g.wave.n >= 4 ? 2 : 0;
}
function updateWaves(g, dt) {
  const W = g.wave;
  if (!W || g.over) return;
  const tp = g.players[g.threat];
  if (W.phase === 'build') {
    W.next -= dt;
    if (W.next <= 10 && !W.warned) { W.warned = 1; ev(g, 'waveWarn', { n: W.n + 1, s: 10 }); }
    if (W.next <= 0) { W.n++; W.warned = 0; waveAdaptCount(g); waveSpawn(g); }
    return;
  }
  /* laufende Welle: Nachzügler zum Ziel, Ende wenn alle tot oder Zeit um */
  if (g.tick % 60 === 17) {
    const tgt = waveTarget(g);
    let alive = 0;
    for (const id of W.ids) { const u = g.byId.get(id); if (!u || u.dead) continue; alive++; if (u.o.t === 'idle' || u.o.t === 'hold') { const a = g.rng() * TAU; u.o = { t: 'amove', x: tgt.x + dcos(a) * 100, y: tgt.y + dsin(a) * 100 }; u.path = null; } }
    W.alive = alive;
    const over = alive === 0 || g.time - W.t0 > WAVE_MAX_T;
    if (over) {
      if (alive) for (const id of W.ids) { const u = g.byId.get(id); if (u && !u.dead) kill(g, u, null, -1); }
      W.phase = 'build'; W.next = WAVE_BUILD; W.cleared = W.n;
      ev(g, 'waveDone', { n: W.n });
      for (const p of g.players) if (p.alive && !p.neutral && !p.threat) { p.rewardAsk = true; p.rewardOpts = pickRewards(g, p); }
      if (g.opts.mode === 'quarantine' && W.n >= QUARANTINE_WAVES) { g.over = true; const h = g.players.find(p => p.human) || g.players.find(p => !p.neutral && !p.threat); g.winner = h.id; g.winTeam = h.team; ev(g, 'over', { winner: g.winner, team: g.winTeam, waves: W.n }); }
    }
  }
  void tp;
}
function pickRewards(g, p) {
  const has = { shield: SHIPS[CORVETTE[p.faction]].shield > 0, armor: p.faction === 'mars' || p.faction === 'brood', legion: p.faction === 'legion', seal: g.opts.mode === 'quarantine' };
  const pool = REWARDS.filter(r => !r.need || has[r.need]).filter(r => !p.rewards || p.rewards.filter(x => x === r.id).length < 3);
  const out = [];
  while (out.length < 3 && pool.length) { const i = (g.rng() * pool.length) | 0; out.push(pool.splice(i, 1)[0].id); }
  return out;
}
function cmdReward(g, pi, id) {
  const p = g.players[pi];
  if (!p.rewardAsk || !p.rewardOpts || p.rewardOpts.indexOf(id) < 0) return 'Keine Belohnung offen';
  const r = REWARDS.find(x => x.id === id);
  if (!r) return 'Unbekannt';
  p.rewardAsk = false; p.rewardOpts = null;
  (p.rewards || (p.rewards = [])).push(id);
  if (r.special === 'income') p.bonusInc = (p.bonusInc || 0) + 1;
  else if (r.special === 'cp') p.cpBonus = (p.cpBonus || 0) + 10;
  else if (r.special === 'base2') p.base2 = (p.base2 || 0) + 1;
  else if (r.special === 'regen') p.regenAll = (p.regenAll || 0) + 1;
  else if (r.special === 'relics') { p.relics += 6; ev(g, 'relics', { owner: pi, n: 6, why: 'Reliktfund' }); }
  else if (r.special === 'cash') { p.ice += 1500; p.ore += 800; }
  else if (r.special === 'super') { const s = g.bldgs.find(b => !b.dead && b.owner === pi && b.role === 'super' && b.done); if (s) s.charge = 1; else { const b = g.bldgs.find(b => !b.dead && b.owner === pi && b.role === 'base'); if (b) b.hull = b.hullMax; } }
  else if (r.special === 'seal') { const s = g.bldgs.find(b => !b.dead && b.role === 'seal'); if (s) { s.hullMax *= 1.2; s.hull = Math.min(s.hullMax, s.hull + s.hullMax * 0.4); } }
  recalcTech(g, p); recalcCp(g, pi);
  ev(g, 'reward', { owner: pi, id });
  return null;
}
/* KI-Verbündete wählen selbst */
function aiReward(g, p) {
  if (!p.rewardAsk || !p.rewardOpts) return;
  const pref = ['cash', 'income', 'dmg', 'hull', 'shield', 'armor', 'cp', 'rate', 'base2', 'regen', 'speed', 'drones', 'super', 'sealheal', 'relics'];
  const id = pref.find(x => p.rewardOpts.indexOf(x) >= 0) || p.rewardOpts[0];
  cmdReward(g, p.id, id);
}
/* Aufbau einer Wellenpartie: Bedrohungspartei anlegen, Siegel setzen */
function waveSetup(g, opts) {
  const i = g.players.length;
  g.tm.push(98);
  g.players.push({ id: i, faction: 'brood', F: FACTIONS.brood, human: false, ai: null, color: '#8be04a', team: 98, ice: 0, ore: 0, eGen: 0, eUse: 0, lowPower: false, cpUse: 0, cpMax: 9999, alive: true, lab: 0, start: { x: g.map.w / 2, y: EDGE + 100, ang: Math.PI / 2 }, incAcc: 0, haulR: 0, shipCount: 0, queued: 0, lowT: -99, hurtT: -99, hurtX: 0, hurtY: 0, tech: {}, research: null, tfx: Object.assign({}, TFX0), doctrine: null, docAsk: false, relics: 0, heroIdx: 0, neutral: false, threat: true, netT: 0, etech: null, vis: null, explored: new Uint8Array(g.vw * g.vh), stats: { built: 0, lost: 0, kills: 0, bLost: 0, razed: 0, earned: 0, spent: 0 } });
  g.threat = i;
  if (!g.teamVis[98]) { g.teamVis[98] = new Int32Array(g.vw * g.vh); g.teamVisN[98] = new Int32Array(g.vw * g.vh); }
  g.players[i].vis = g.teamVis[98]; g.players[i].visN = g.teamVisN[98];
  g.wave = { n: 0, phase: 'build', next: WAVE_FIRST, t0: 0, ids: [], alive: 0, spawned: 0, cleared: 0, adapt: { kin: 0, beam: 0 }, armor: 0, warned: 0, matriarch: 0 };
  if (opts.mode === 'quarantine') {
    const h = g.players.find(p => p.human) || g.players[0];
    const s = addBldg(g, 'seal', h.id, g.map.w / 2, g.map.h / 2, true);
    s.seal = 1;
  }
}
