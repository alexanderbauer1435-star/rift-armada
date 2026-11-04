/* Fassung 22: Stationen Teil 1 – Schildwall (sperrt Wege, fängt Schüsse), Turmzweige (Flak, Schwergeschütz, Störsender),
   Frühwarnstation (Sicht, Tarnung), Reparaturdock (Reparatur, Rückzugsziel), KI baut sie, Gleichschritt.
   node tests/buildings22a.js */
'use strict';
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec, fn) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
/* leere Testfläche: keine Basen, keine Schiffe; Spieler 0 bekommt Strom */
function arena(f0, f1, pace) {
  const g = X.createGame({ map: 'test', seed: 3, pace: pace || 'tactical', players: [{ faction: f0 || 'alliance', ai: 0 }, { faction: f1 || 'mars', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); for (const b of g.bldgs.slice()) C.removeBldg(g, b); for (const p of g.players) p.nob = true;
  X.addBldg(g, 'reactor', 0, 2400, 900, true); X.addBldg(g, 'reactor', 0, 2500, 900, true); X.addBldg(g, 'reactor', 1, 600, 1700, true);
  C.recalcPower(g, 0); C.recalcPower(g, 1);
  return g;
}
const lvl = (b, lv, spec) => { b.lv = lv; if (spec) b.spec = spec; const l = C.lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield; b.shield = l.shield; b.wcd = l.wpn.map(() => 0); return b; };
/* Wall aus zwei Emittern (Anker ohne Waffen), x = 1600, y 1450 … 1850 */
function wall(g, owner, x, y0, y1) {
  const a = X.addBldg(g, 'wall', owner, x, y0, true), b = X.addBldg(g, 'wall', owner, x, y1, true);
  b.link = a.id; b.fhpMax = C.lvOf(b).field; b.fhp = b.fhpMax; b.fdown = 0; a.fhp = 0; a.fhpMax = C.lvOf(a).field; a.fdown = 0;
  C.recalcPower(g, owner); g.wallDirty = 1; step(g, 0.2);
  return b;
}

/* ---- 1. Schildwall sperrt den Weg für Feinde, nicht für eigene ---- */
{
  const g = arena(); const w = wall(g, 0, 1600, 1450, 1850);
  ok(w.up === 1 && g.wallL.length === 1, 'Wall steht (Emitter–Emitter, Länge ' + Math.round(Math.hypot(w.wx2 - w.wx1, w.wy2 - w.wy1)) + ')');
  const tm1 = g.tm[1], tm0 = g.tm[0];
  const pE = X.findPath(g.map, 0, 1400, 1650, 1800, 1650, tm1), pO = X.findPath(g.map, 0, 1400, 1650, 1800, 1650, tm0);
  const minY = p => Math.min(...p.map(q => Math.abs(q.y - 1650)));
  ok(pE && pE.some(q => Math.abs(q.y - 1650) > 180), 'Wegsuche Feind: um den Wall herum (' + pE.length + ' Punkte)');
  ok(pO && pO.length <= 2 && minY(pO) < 5, 'Wegsuche eigenes Team: gerade hindurch');
  const u = X.addShip(g, 'needle', 1, 1400, 1650, 0); u.stance = 2;
  X.execCmd(g, { t: 'move', p: 1, u: [u.id], x: 1800, y: 1650 });
  let crossIn = false, px = u.x, py = u.y;
  step(g, 40, () => { if ((px - 1600) * (u.x - 1600) <= 0 && px !== u.x) { const y = (py + u.y) / 2; if (y > 1470 && y < 1830) crossIn = true; } px = u.x; py = u.y; });
  ok(!crossIn && hyp(u.x - 1800, u.y - 1650) < 60, 'feindliches Schiff fliegt um den Wall herum und kommt an (' + Math.round(u.x) + ',' + Math.round(u.y) + ')');
  /* direkt auf den Wall gedrückt: wird zurückgeschoben */
  const v = X.addShip(g, 'needle', 1, 1560, 1650, 0); v.stance = 2; let worst = 1e9;
  step(g, 3, () => { v.o = { t: 'idle' }; v.ang = 0; v.v = v.def.speed; worst = Math.min(worst, 1600 - v.x); });
  ok(v.x < 1600 && worst > 0, 'Schiff mit Vollgas gegen das Feld bleibt davor (größte Annäherung ' + Math.round(worst) + ')');
  const o = X.addShip(g, 'wren', 0, 1400, 1650, 0); X.execCmd(g, { t: 'move', p: 0, u: [o.id], x: 1800, y: 1650 }); step(g, 8);
  ok(o.x > 1700 && Math.abs(o.y - 1650) < 80, 'eigenes Schiff fliegt gerade durch den eigenen Wall');
}
function hyp(a, b) { return Math.hypot(a, b); }

/* ---- 2. Schildwall fängt Schüsse (Strahl, Geschoss, Torpedo) und bricht zusammen ---- */
for (const [f1, ship] of [['alliance', 'lancer'], ['mars', 'needle']]) {
  const g = arena('mars', f1); const w = wall(g, 0, 1600, 1450, 1850);
  const tgt = X.addShip(g, 'hedgehog', 0, 1700, 1650, 0); tgt.stance = 2; X.execCmd(g, { t: 'hold', p: 0, u: [tgt.id], on: true }); const h0 = tgt.hull;
  const a = X.addShip(g, ship, 1, 1440, 1650, 0); X.execCmd(g, { t: 'hold', p: 1, u: [a.id], on: true }); g.reveals.push({ x: 1700, y: 1650, r: 400, owner: 1, until: 1e9 });
  let hits = 0; const f0 = w.fhp;
  step(g, 12, gg => { for (const e of gg.ev) if (e.t === 'wallhit') hits++; });
  ok(tgt.hull === h0 && hits > 0, ship + ': Schüsse bleiben im Feld (Feld ' + Math.round(f0) + ' → ' + Math.round(w.fhp) + ', Ziel unversehrt)');
  w.fhp = 5; let down = 0; step(g, 14, gg => { for (const e of gg.ev) if (e.t === 'wallDown') down++; });
  ok(down === 1 && tgt.hull < h0, ship + ': Feld bricht zusammen, danach trifft der Schütze (' + Math.round(h0 - tgt.hull) + ' Schaden)');
  let again = false; step(g, 12, () => { if (w.up === 1 && w.fhp > 0) again = true; }); ok(again, ship + ': Feld startet nach 10 s neu');
}
/* eigene Schüsse gehen durch; Energiemangel schaltet das Feld ab */
{
  const g = arena('alliance', 'mars'); const w = wall(g, 0, 1600, 1450, 1850);
  const e = X.addShip(g, 'hammer', 1, 1720, 1650, Math.PI); e.stance = 2; const h0 = e.hull; g.reveals.push({ x: 1700, y: 1650, r: 400, owner: 0, until: 1e9 });
  const a = X.addShip(g, 'lancer', 0, 1450, 1650, 0); X.execCmd(g, { t: 'hold', p: 0, u: [a.id], on: true });
  step(g, 6); ok(e.hull < h0, 'eigene Strahlen gehen durch den eigenen Wall');
  for (const b of g.bldgs.filter(b => b.role === 'reactor' && b.owner === 0)) C.removeBldg(g, b);
  step(g, 1); ok(!w.up && g.wallL.length === 0, 'ohne Energie fällt der Wall aus');
}

/* ---- 3. Bau über den Befehl: Anker nötig, Länge begrenzt ---- */
{
  const g = X.createGame({ map: 'haven', seed: 5, players: [{ faction: 'alliance', human: true }, { faction: 'mars', ai: 1 }] });
  const P = g.players[0], base = g.bldgs.find(b => b.owner === 0 && b.role === 'base'); P.ice = P.ore = 99999;
  const bld = g.ships.find(u => u.owner === 0 && u.def.build);
  const tx = base.x + 260, ty = base.y;
  ok(X.canPlace(g, 0, 'wall', tx + 250, ty) === 'Kein Turm oder Emitter in Reichweite', 'Schildwall ohne Turm in Reichweite abgelehnt');
  const t = X.addBldg(g, 'turret', 0, tx, ty, true); C.recalcPower(g, 0);
  let spot = null; for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3]) { const x = tx + Math.cos(a) * 300, y = ty + Math.sin(a) * 300; if (!X.canPlace(g, 0, 'wall', x, y)) { spot = { x, y }; break; } }
  ok(!!spot, 'Platz für den Emitter gefunden');
  const r = X.execCmd(g, { t: 'build', p: 0, u: [bld.id], role: 'wall', x: spot.x, y: spot.y, to: t.id });
  const w = g.bldgs.find(b => b.role === 'wall' && b.owner === 0);
  ok(!r && w && w.link === t.id, 'Bauschiff baut Schildwall mit Anker am Turm');
  step(g, 60); ok(w.done && w.up === 1, 'fertig gebaut: Feld steht');
  ok(X.canPlace(g, 0, 'wall', tx + Math.cos(0.3) * 600, ty + Math.sin(0.3) * 600) !== null, 'zu weit vom Anker: abgelehnt');
}

/* ---- 4. Turmzweige ---- */
function towerTest(f, spec, tgtType) {
  const g = arena(f, 'mars', 'fast');
  const t = lvl(X.addBldg(g, 'turret', 0, 1600, 1650, true), 2, spec);
  const e = X.addShip(g, tgtType, 1, 1600 + 250, 1650, Math.PI); e.stance = 2; e.hull = e.hullMax = 1e6; g.reveals.push({ x: 1850, y: 1650, r: 300, owner: 0, until: 1e9 });
  step(g, 10); return 1e6 - e.hull;
}
for (const f of ['alliance', 'mars', 'legion', 'nexus', 'brood']) {
  const sF = towerTest(f, 'flak', 'needle'), sH = towerTest(f, 'heavy', 'needle'), lF = towerTest(f, 'flak', 'hammer'), lH = towerTest(f, 'heavy', 'hammer');
  ok(sF > sH * 1.5 && lH > lF * 1.5, f + ': Flak gegen Kleine ' + Math.round(sF) + ' > Schwer ' + Math.round(sH) + ', Schwer gegen Große ' + Math.round(lH) + ' > Flak ' + Math.round(lF));
}
{
  const g = arena('alliance', 'mars'); const P = g.players[0]; P.ice = P.ore = 9999;
  const t = X.addBldg(g, 'turret', 0, 1600, 1650, true);
  ok(X.execCmd(g, { t: 'upgrade', p: 0, b: t.id, spec: 'bogus' }) === 'Nicht möglich', 'unbekannter Zweig abgelehnt');
  ok(!X.execCmd(g, { t: 'upgrade', p: 0, b: t.id, spec: 'flak' }), 'Ausbau auf II mit Zweig Flak');
  step(g, 25); ok(t.lv === 2 && t.spec === 'flak' && C.lvOf(t).wpn.some(w => w.kind === 'pd'), 'Turm ist Flak II mit Punktverteidigung');
  ok(X.execCmd(g, { t: 'upgrade', p: 0, b: t.id, spec: 'heavy' }) === 'Nicht möglich', 'Zweig nur beim Ausbau von I auf II');
  ok(!X.execCmd(g, { t: 'upgrade', p: 0, b: t.id }), 'Ausbau auf III behält den Zweig'); step(g, 30); ok(t.lv === 3 && t.spec === 'flak', 'Flak III');
  const T2 = X.addBldg(g, 'turret', 0, 1000, 1000, true); X.execCmd(g, { t: 'upgrade', p: 0, b: T2.id }); step(g, 25); ok(T2.lv === 2 && !T2.spec, 'ohne Angabe: Standardturm II');
}
/* Störsender: kein Schaden, Feinde langsamer, kürzere Reichweite */
{
  const run = jam => {
    const g = arena('alliance', 'mars');
    if (jam) lvl(X.addBldg(g, 'turret', 0, 1600, 1650, true), 2, 'jam');
    const tgt = X.addShip(g, 'wren', 0, 1600, 1500, 0); tgt.stance = 2; X.execCmd(g, { t: 'hold', p: 0, u: [tgt.id], on: true }); const h0 = tgt.hull + tgt.shield;
    const a = X.addShip(g, 'needle', 1, 1600, 1500 + 270, 0); X.execCmd(g, { t: 'hold', p: 1, u: [a.id], on: true }); g.reveals.push({ x: 1600, y: 1600, r: 600, owner: 1, until: 1e9 });
    const m = X.addShip(g, 'needle', 1, 1350, 1700, 0); m.stance = 2; X.execCmd(g, { t: 'move', p: 1, u: [m.id], x: 1900, y: 1700 });
    step(g, 1.5); const x0 = m.x; step(g, 2); const v = (m.x - x0) / 2;
    step(g, 6); return { lost: h0 - tgt.hull - tgt.shield, v, jammed: a.jamT > g.time };
  };
  const off = run(false), on = run(true);
  ok(off.lost > 0 && on.lost === 0 && on.jammed, 'Störsender: Needle auf 270 trifft ohne Störung (' + Math.round(off.lost) + '), gestört nicht (Reichweite −20 %)');
  ok(on.v < off.v * 0.8, 'Störsender: Tempo ' + Math.round(off.v) + ' → ' + Math.round(on.v));
  const g = arena(); const t = lvl(X.addBldg(g, 'turret', 0, 1600, 1650, true), 2, 'jam');
  ok(C.lvOf(t).wpn.length === 0 && C.lvOf(t).jam > 300, 'Störsender ohne Waffen, Umkreis ' + C.lvOf(t).jam);
}

/* ---- 5. Frühwarnstation: weite Sicht, deckt Getarnte auf ---- */
{
  const run = radar => {
    const g = arena('alliance', 'mars');
    X.addBldg(g, radar ? 'radar' : 'relay', 0, 1600, 1650, true); C.recalcPower(g, 0);
    const c = X.addShip(g, 'needle', 1, 1600 + 420, 1650, 0); c.stance = 2; c.abT.cloak = 999;
    const far = X.addShip(g, 'needle', 1, 1600, 1650 - 950, 0); far.stance = 2;
    step(g, 0.5); return { cloak: C.canSee(g, 0, c), far: C.canSee(g, 0, far) };
  };
  const a = run(true), b = run(false);
  ok(a.cloak && !b.cloak, 'getarntes Schiff auf 420: mit Frühwarnstation sichtbar, mit Relais nicht');
  ok(a.far && !b.far, 'Schiff auf 950: mit Frühwarnstation sichtbar, mit Relais nicht');
}

/* ---- 6. Reparaturdock: repariert Schiffe und Stationen, Ziel des Rückzugs ---- */
{
  const g = arena('alliance', 'mars'); const d = X.addBldg(g, 'dock', 0, 1600, 1650, true); C.recalcPower(g, 0);
  const s1 = X.addShip(g, 'lancer', 0, 1600 + 150, 1650, 0), s2 = X.addShip(g, 'lancer', 0, 1000, 600, 0);
  for (const u of [s1, s2]) { u.hull = u.hullMax * 0.3; u.sub.drive = 0.2; u.sub.wpn = 0.2; u.stance = 2; }
  const r = X.addBldg(g, 'relay', 0, 1600, 1900, true); r.hull = r.hullMax * 0.5;
  step(g, 10);
  ok(s1.hull > s1.hullMax * 0.5 && s2.hull < s2.hullMax * 0.31, 'Dock: Hülle 30 % → ' + Math.round(s1.hull / s1.hullMax * 100) + ' % in 10 s (fern: ' + Math.round(s2.hull / s2.hullMax * 100) + ' %)');
  ok(s1.sub.drive > s2.sub.drive + 0.3, 'Dock: Subsysteme schneller (' + s1.sub.drive.toFixed(2) + ' gegen ' + s2.sub.drive.toFixed(2) + ')');
  ok(r.hull > r.hullMax * 0.52, 'Dock: Station in der Nähe wird langsam repariert (' + Math.round(r.hull / r.hullMax * 100) + ' %)');
  /* Rückzug: Haltung Vorsichtig, keine Werft – zum Dock */
  const u = X.addShip(g, 'lancer', 0, 2300, 2300, 0); u.stance = 3; u.hull = u.hullMax * 0.2;
  step(g, 1); ok(u.retreat === 1 && u.ryd === d.id, 'vorsichtiges Schiff zieht sich zum Reparaturdock zurück');
  let back = false; step(g, 90, () => { if (!u.retreat && u.hull >= u.hullMax * 0.95) back = true; });
  ok(back, 'repariert und zurück (' + Math.round(u.hull / u.hullMax * 100) + ' %)');
}

/* ---- 7. KI baut die neuen Stationen; Gleichschritt; Speichern und Laden ---- */
{
  const opts = { map: 'haven', seed: 21, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }] };   /* Fassung 24: Schwer gegen Schwer (früherer Druck) */
  const run = () => { const g = X.createGame(opts), hs = []; step(g, 900, gg => { if (gg.tick % 300 === 0) hs.push(X.stateHash(gg)); }); return { g, hs }; };
  const A = run(), B = run();
  ok(A.hs.length > 10 && A.hs.every((h, i) => h === B.hs[i]), 'Gleichschritt (' + A.hs.length + ' Prüfsummen über 900 s)');
  const roles = pi => { const o = {}; for (const b of A.g.bldgs) if (!b.dead && b.owner === pi) o[b.role + (b.spec ? ':' + b.spec : '')] = 1; return Object.keys(o).sort().join(' '); };
  console.log('     KI 0: ' + roles(0) + '\n     KI 1: ' + roles(1));
  const all = A.g.bldgs.filter(b => !b.dead && b.owner <= 1), has = r => all.some(b => b.role === r);
  ok(has('radar') && has('dock'), 'KI (Mittel, Schwer) baut Frühwarnstation und Reparaturdock');
  ok(!has('wall'), 'KI baut keine Schildwälle (Werkzeug des Spielers, ' + all.filter(b => b.role === 'wall').length + ')');   /* Fassung 22 */
  /* Zweigwahl der KI nach dem Gesehenen */
  const g = A.g, me = g.players[0], t0 = g.bldgs.find(b => !b.dead && b.owner === 0 && b.role === 'turret') || g.bldgs.find(b => !b.dead && b.owner === 0) || { x: 800, y: 800 };   /* Fassung 24: Turm kann schon gefallen sein */
  const T = X.addBldg(g, 'turret', 0, t0.x + 900, t0.y + 900, true);
  me.ai.seen = { s: 0.8, m: 0.15, l: 0.05 }; const s1 = C.aiTurretSpec(g, 0, T);
  me.ai.seen = { s: 0.1, m: 0.3, l: 0.6 }; const s2 = C.aiTurretSpec(g, 0, T);
  X.addBldg(g, 'turret', 0, T.x + 120, T.y, true); X.addBldg(g, 'turret', 0, T.x - 120, T.y, true); const s3 = C.aiTurretSpec(g, 0, T);
  ok(s1 === 'flak' && s2 === 'heavy' && s3 === 'jam', 'KI-Zweig: viele Kleine → ' + s1 + ', viele Große → ' + s2 + ', zwei Kampftürme daneben → ' + s3);
}
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
