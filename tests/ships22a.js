/* Fassung 22: Begleiten, Rückzug bei Schaden je Schiff, Rollenformation, Rangboni, Veteranen im Feldzug, Gleichlauf
   node tests/ships22a.js */
'use strict';
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec, fn) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
const hyp = X.hyp;
function bare(f0, f1) {
  const g = X.createGame({ map: 'test', seed: 5, pace: 'tactical', players: [{ faction: f0 || 'alliance', ai: 0 }, { faction: f1 || 'mars', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  return g;
}

/* ---------------------------------------------------------------- 1. Begleiten */
{
  const g = bare();
  const vip = X.addShip(g, 'bulwark', 0, 1000, 1600, 0), es = [X.addShip(g, 'lancer', 0, 800, 1500, 0), X.addShip(g, 'lancer', 0, 800, 1700, 0)];
  ok(X.execCmd(g, { t: 'escort', p: 0, u: es.map(u => u.id), e: vip.id }) === null && es.every(u => u.o.t === 'escort' && u.o.tid === vip.id), 'Begleitbefehl angenommen');
  ok(X.execCmd(g, { t: 'escort', p: 0, u: [es[0].id], e: X.addShip(g, 'needle', 1, 3000, 3000, 0).id }) === 'Nicht möglich', 'feindliches Schiff lässt sich nicht begleiten');
  X.execCmd(g, { t: 'escort', p: 0, u: es.map(u => u.id), e: vip.id });
  X.execCmd(g, { t: 'move', p: 0, u: [vip.id], x: 2200, y: 1600 });
  let maxD = 0; step(g, 50, () => { if (g.time > 20) for (const u of es) maxD = Math.max(maxD, hyp(u.x - vip.x, u.y - vip.y)); });
  const d = es.map(u => Math.round(hyp(u.x - vip.x, u.y - vip.y)));
  ok(hyp(vip.x - 2200, vip.y - 1600) < 60 && d.every(x => x >= 110 && x <= 300), 'Begleiter folgen in lockerem Ring (Abstand ' + d.join(', ') + ')');
  ok(maxD < 420, 'unterwegs nie weit zurück (größter Abstand ' + Math.round(maxD) + ')');
  ok(hyp(es[0].x - es[1].x, es[0].y - es[1].y) > 80, 'Begleiter auf verschiedenen Ringplätzen');
  /* fern: kein Feind in 450 um das Begleitete → bleiben */
  const far = X.addShip(g, 'needle', 1, 2200, 2500, 0); far.stance = 2; far.o = { t: 'hold' }; far.hold = true;
  g.reveals.push({ x: 2200, y: 2500, r: 400, owner: 0, until: 1e9 });
  step(g, 8);
  ok(es.every(u => u.o.t === 'escort' && !u.o.eid && hyp(u.x - vip.x, u.y - vip.y) < 300), 'ferner Feind (900 weg) wird nicht verfolgt');
  /* nah: Feind beschießt das Begleitete → Begleiter greifen an */
  const foe = X.addShip(g, 'needle', 1, 2500, 1600, Math.PI); X.execCmd(g, { t: 'attack', p: 1, u: [foe.id], e: vip.id });
  let engaged = 0; step(g, 40, () => { if (es.some(u => u.o.eid === foe.id)) engaged = 1; if (foe.dead) g.time += 0; });
  ok(engaged && foe.dead, 'Angreifer in der Nähe wird abgewehrt (' + (foe.dead ? 'zerstört' : 'lebt') + ')');
  step(g, 15);
  ok(es.every(u => u.o.t === 'escort' && hyp(u.x - vip.x, u.y - vip.y) < 320), 'danach zurück an den Ringplatz');
  C.kill(g, vip, null, -1); step(g, 1);
  ok(es.every(u => u.o.t === 'idle'), 'Begleiten endet, wenn das Begleitete fällt');
  /* Station begleiten */
  const b = X.addBldg(g, 'yard', 0, 900, 900, true);
  X.execCmd(g, { t: 'escort', p: 0, u: es.map(u => u.id), e: b.id }); step(g, 30);
  ok(es.every(u => { const dd = hyp(u.x - b.x, u.y - b.y); return dd > 90 && dd < 320; }), 'Station begleiten: Schiffe kreisen um die Werft');
}

/* ---------------------------------------------------------------- 2. Rückzug bei Schaden */
{
  const g = bare();
  const y = X.addBldg(g, 'yard', 0, 600, 1600, true); C.recalcPower(g, 0);
  const a = X.addShip(g, 'lancer', 0, 2200, 1600, 0), n = X.addShip(g, 'lancer', 0, 2200, 1800, 0);
  ok(X.execCmd(g, { t: 'autoRet', p: 0, u: [a.id], on: true }) === null && a.autoRet === 1 && !n.autoRet && a.stance === 0, 'Schalter Rückzug bei Schaden je Schiff, Haltung bleibt Offensiv');
  a.hull = n.hull = a.hullMax * 0.25; step(g, 1);
  ok(a.retreat === 1 && a.o.ret && !n.retreat, 'unter 30 % Hülle: nur das Schiff mit Schalter zieht sich zurück');
  step(g, 40);
  ok(hyp(a.x - y.x, a.y - y.y) < y.def.r + 140, 'an der Werft angekommen (' + Math.round(hyp(a.x - y.x, a.y - y.y)) + ')');
  let back = 0; step(g, 160, () => { if (!back && !a.retreat && a.o.t === 'amove') back = 1; });
  ok(back && a.hull >= a.hullMax * 0.9, 'repariert und auf dem Rückweg (Hülle ' + Math.round(a.hull / a.hullMax * 100) + ' %)');
  X.execCmd(g, { t: 'autoRet', p: 0, u: [a.id], on: false }); a.hull = a.hullMax * 0.2; step(g, 1);
  ok(!a.autoRet && !a.retreat, 'ausgeschaltet: kein Rückzug mehr');
  /* Begleiter mit Rückzug kehren nach der Reparatur zum Begleiten zurück */
  const v = X.addShip(g, 'bulwark', 0, 1400, 1600, 0), e = X.addShip(g, 'lancer', 0, 1400, 1800, 0);
  X.execCmd(g, { t: 'autoRet', p: 0, u: [e.id], on: true }); X.execCmd(g, { t: 'escort', p: 0, u: [e.id], e: v.id }); step(g, 2);
  e.hull = e.hullMax * 0.2; step(g, 1); const ret = e.retreat === 1;
  step(g, 220, () => { if (e.o.t === 'escort') g.time = g.time; });
  ok(ret && e.o.t === 'escort' && e.o.tid === v.id, 'Begleiter: Rückzug, Reparatur, dann wieder Begleiten (' + e.o.t + ')');
}

/* ---------------------------------------------------------------- 3. Rollenformation */
{
  const g = bare('mars');
  const ids = Object.values(X.SHIPS).filter(d => d.f === 'mars' && !d.hidden);
  const pick = (f) => ids.find(f).id;
  const heavy = pick(d => d.role === 'war' && d.cls === 'l' && !d.art), mid = pick(d => d.role === 'war' && d.cls === 'm' && !d.art && d.wpn.some(w => w.kind !== 'pd')), small = pick(d => d.role === 'war' && d.cls === 's' && d.wpn.some(w => w.kind !== 'pd')), art = pick(d => d.art);
  const us = [art, small, mid, heavy, small, mid, heavy, small, art].map((id, i) => X.addShip(g, id, 0, 1000 + (i % 3) * 60, 1500 + Math.floor(i / 3) * 60, 0));
  const gx = 2500, gy = 1560, sl = C.formSlots(us, gx, gy, 'roles');
  let cx = 0, cy = 0; for (const u of us) { cx += u.x; cy += u.y; } cx /= us.length; cy /= us.length;
  const dir = Math.atan2(gy - cy, gx - cx), fx = Math.cos(dir), fy = Math.sin(dir);
  const fwd = i => (sl[i].x - gx) * fx + (sl[i].y - gy) * fy, lat = i => Math.abs(-(sl[i].x - gx) * fy + (sl[i].y - gy) * fx);
  const role = u => C.shipRole(u), idx = r => us.map((u, i) => i).filter(i => role(us[i]) === r);
  const F = idx('front'), M = idx('mid'), B = idx('back'), S = idx('flank');
  ok(F.length === 2 && M.length === 2 && B.length === 2 && S.length === 3, 'Rollen erkannt: ' + [heavy, mid, small, art].join(', '));
  const minF = Math.min(...F.map(fwd)), maxM = Math.max(...M.map(fwd)), minM = Math.min(...M.map(fwd)), maxB = Math.max(...B.map(fwd));
  ok(minF > maxM && minM > maxB, 'Schwere vorn, Mittlere in der Mitte, Artillerie hinten (' + [minF, maxM, minM, maxB].map(Math.round).join(' / ') + ')');
  const maxIn = Math.max(...F.concat(M, B).map(lat)), minS = Math.min(...S.map(lat));
  ok(minS > maxIn, 'Schnelle auf den Flanken (seitlich ' + Math.round(minS) + ' > ' + Math.round(maxIn) + ')');
  const minGap = Math.min(...sl.flatMap((a, i) => sl.slice(i + 1).map(b => hyp(a.x - b.x, a.y - b.y))));
  ok(minGap > 30, 'keine Plätze übereinander (kleinster Abstand ' + Math.round(minGap) + ')');
  X.execCmd(g, { t: 'move', p: 0, u: us.map(u => u.id), x: gx, y: gy, form: 'roles' });
  const slow = Math.min(...us.map(u => u.def.speed));
  ok(us.every(u => u.o.sp === slow), 'Tempo des langsamsten Schiffs (' + slow + ')');
  step(g, 90);
  const arrived = us.filter((u, i) => hyp(u.x - sl[i].x, u.y - sl[i].y) < 60).length;
  ok(arrived >= us.length - 1, 'Formation eingenommen (' + arrived + '/' + us.length + ')');
}

/* ---------------------------------------------------------------- 4. Rangboni */
{
  const b = C.rankBonus(2);
  ok(b.dmg === 20 && b.acc === 30 && b.reload === 10 && b.regen === 10, 'Rang Elite: +20 % Schaden, −30 % Streuung, −10 % Nachladezeit, 10 % Hülle/min');
  /* Feuerrate: gleiches Schiff, Rang 0 und Ass, gleiche Zeit gegen ein Ziel, das nicht zurückschießt */
  const shots = rank => {
    const g = bare('mars', 'alliance');
    const s = X.addShip(g, 'hammer' in X.SHIPS ? 'hammer' : 'needle', 0, 1000, 1600, 0), t = X.addShip(g, 'archipelago', 1, 1250, 1600, Math.PI);
    t.stance = 2; t.hull = t.hullMax = 1e7; t.o = { t: 'hold' }; t.hold = true;
    if (rank) { s.kills = [0, 3, 8, 15][rank]; C.gainXp(g, s, 0); }
    X.execCmd(g, { t: 'attack', p: 0, u: [s.id], e: t.id });
    let n = 0; step(g, 40, gg => { for (const q of gg.ev) if (q.t === 'shot' && q.owner === 0) n++; });
    return { n, rank: s.rank };
  };
  const r0 = shots(0), r3 = shots(3);
  ok(r3.rank === 3 && r3.n > r0.n * 1.1, 'Ass feuert öfter (' + r0.n + ' → ' + r3.n + ' Schüsse in 40 s)');
  /* Streuung: Rang verringert die Abweichung der Geschosse */
  const g = bare('mars'); const ws = Object.values(X.SHIPS).find(d => d.f === 'mars' && d.wpn.some(w => w.spread));
  const u0 = X.addShip(g, ws.id, 0, 1000, 1000, 0), u3 = X.addShip(g, ws.id, 0, 1000, 1400, 0); u3.kills = 15; C.gainXp(g, u3, 0);
  ok(C.rankAcc(u0) === 1 && Math.abs(C.rankAcc(u3) - 0.55) < 1e-9, 'Streuung Ass 55 % (' + ws.id + ')');
  /* Selbstreparatur außer Gefecht nur mit Rang */
  const h = bare('mars'); const v0 = X.addShip(h, 'needle', 0, 1000, 1000, 0), v2 = X.addShip(h, 'needle', 0, 1000, 1300, 0); v2.kills = 8; C.gainXp(h, v2, 0);
  for (const v of [v0, v2]) v.hull = v.hullMax * 0.5;
  step(h, 60);
  const g0 = v0.hull / v0.hullMax - 0.5, g2 = v2.hull / v2.hullMax - 0.5;
  ok(g0 < 0.005 && g2 > 0.06 && g2 < 0.12, 'Elite repariert außer Gefecht ' + (g2 * 100).toFixed(1) + ' % in 60 s, ohne Rang ' + (g0 * 100).toFixed(1) + ' %');
  v2.hull = v2.hullMax * 0.5; v2.hitT = h.time; step(h, 8);
  ok(v2.hull === v2.hullMax * 0.5, 'kurz nach einem Treffer keine Reparatur');
}

/* ---------------------------------------------------------------- 5. Veteranen im Feldzug */
{
  const mk = (type, kills, rank, extra) => Object.assign({ k: 1, id: Math.random(), type, owner: 0, kills, rank, dead: false, derelict: false, def: X.SHIPS[type] }, extra || {});
  const ships = [mk('lancer', 7.64, 1), mk('bulwark', 1.2, 0), mk('wren', 0, 0), mk('lancer', 2, 2), mk('bulwark', 16.2, 3, { cqv: 1 })];
  const R = C.cqBattleResult({ mis: { res: 1, f: { flag: -1, fk: 0 } }, human: 0, ships, byId: new Map() });
  const by = t => R.vets.filter(v => v.t === t).map(v => v.k);
  ok(R.vets.length === 4 && R.vets[0].k === 16.2 && by('lancer').indexOf(7.6) >= 0 && by('lancer').indexOf(8) >= 0 && by('bulwark').indexOf(1.2) >= 0, 'Veteranen behalten Erfahrung genau, Rang nie verloren, erste Erfahrung zieht mit: ' + R.vets.map(v => v.t + ' ' + v.k).join(', '));
  const g = bare(); const u = C.cqVet(g, 0, 'lancer', 1000, 1000, 0, 8, '');
  ok(u.rank === 2 && Math.abs(u.hullMax - X.SHIPS.lancer.hull * 1.2) < 1e-6, 'in der nächsten Schlacht wieder Elite mit +20 % Hülle');
}

/* ---------------------------------------------------------------- 6. KI: Artillerie mit zwei Begleitern, Rollen im Angriff */
{
  const g = bare('mars', 'alliance'); g.players[0].ai = C.aiInit(3);
  const art = Object.values(X.SHIPS).find(d => d.f === 'mars' && d.art).id;
  const al = [X.addShip(g, art, 0, 1000, 1600, 0)].concat([0, 1, 2, 3, 4].map(i => X.addShip(g, 'needle', 0, 1100 + i * 40, 1500, 0)));
  X.addBldg(g, 'turret', 1, 2400, 1600, true);
  for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
  g.time = 10; C.aiSiege(g, 0, al);
  const esc = al.filter(u => u.o.t === 'escort' && u.o.tid === al[0].id);
  ok(esc.length === 2 && esc[0].o.k !== esc[1].o.k, 'KI: Artillerie bekommt zwei Begleiter');
  g.time += 6; C.aiSiege(g, 0, al);
  ok(al.filter(u => u.o.t === 'escort').length === 2, 'KI: nicht mehr als zwei');
}

/* ---------------------------------------------------------------- 7. Gleichlauf */
{
  const run = () => {
    const g = X.createGame({ map: 'haven', seed: 77, players: [{ faction: 'mars', ai: 3 }, { faction: 'alliance', ai: 3 }] });
    let esc = 0, roles = 0;
    step(g, 900, gg => { if (gg.tick % 30 === 0) for (const u of gg.ships) { if (!u.dead && u.o.t === 'escort') esc++; } });
    return { h: X.stateHash(g), esc, ranks: g.ships.filter(u => !u.dead && u.rank).length };
  };
  /* Befehle als Wiedergabe: Begleiten und Rückzug laufen über execCmd und ergeben denselben Zustand */
  const scripted = () => {
    const g = bare(); const v = X.addShip(g, 'bulwark', 0, 1000, 1600, 0), e = [X.addShip(g, 'lancer', 0, 900, 1500, 0), X.addShip(g, 'wren', 0, 900, 1700, 0)];
    const f = [X.addShip(g, 'needle', 1, 2600, 1600, Math.PI), X.addShip(g, 'needle', 1, 2600, 1700, Math.PI)];
    X.addBldg(g, 'yard', 0, 600, 1600, true);
    X.execCmd(g, { t: 'autoRet', p: 0, u: e.map(u => u.id), on: true }); X.execCmd(g, { t: 'escort', p: 0, u: e.map(u => u.id), e: v.id });
    X.execCmd(g, { t: 'move', p: 0, u: [v.id], x: 2200, y: 1650, form: 'roles' }); X.execCmd(g, { t: 'move', p: 1, u: f.map(u => u.id), x: 1200, y: 1600, am: true, form: 'roles' });
    step(g, 120); return X.stateHash(g);
  };
  const a = scripted(), b = scripted();
  ok(a === b, 'Begleiten, Rückzug und Rollen gleichlaufend (' + a + ')');
  const r1 = run(), r2 = run();
  ok(r1.h === r2.h, 'KI-Partie 900 s gleichlaufend (' + r1.h + ', Begleit-Stichproben ' + r1.esc + ', Schiffe mit Rang ' + r1.ranks + ')');
}
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
