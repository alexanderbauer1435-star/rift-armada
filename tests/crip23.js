/* Fassung 23: manövrierunfähig schießen, nicht weiter beschießen, entern, zur Werft schleppen
   node tests/crip23.js */
'use strict';
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec, fn) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
const hyp = X.hyp;
function bare(f0, f1) {
  const g = X.createGame({ map: 'test', seed: 5, pace: 'tactical', players: [{ faction: f0 || 'mars', ai: 0 }, { faction: f1 || 'alliance', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  g.reveals.push({ x: 1500, y: 1500, r: 3000, owner: 0, until: 1e9 }, { x: 1500, y: 1500, r: 3000, owner: 1, until: 1e9 });
  return g;
}
const MARS_WAR = Object.keys(X.SHIPS).filter(k => X.SHIPS[k].f === 'mars' && X.SHIPS[k].role === 'war' && X.SHIPS[k].cls === 'm' && X.SHIPS[k].wpn.some(w => w.kind !== 'pd' && !w.art) && !X.SHIPS[k].marines)[0];

/* 1. Lahmlegen dauert länger als Zerstören, Ziel treibt, Feuer endet */
let tKill = 0, tCrip = 0;
{
  const g = bare();
  const a = [0, 1, 2].map(i => X.addShip(g, MARS_WAR, 0, 1000, 1400 + i * 60, 0)), t = X.addShip(g, 'bulwark', 1, 1500, 1500, Math.PI); t.stance = 2;
  X.execCmd(g, { t: 'attack', p: 0, u: a.map(u => u.id), e: t.id });
  step(g, 120, () => { if (t.dead && !tKill) tKill = g.time; });
  ok(t.dead, 'Zerstören: Ziel fällt nach ' + Math.round(tKill) + ' s');
}
{
  const g = bare();
  const a = [0, 1, 2].map(i => X.addShip(g, MARS_WAR, 0, 1000, 1400 + i * 60, 0)), t = X.addShip(g, 'bulwark', 1, 1500, 1500, Math.PI); t.stance = 2;
  ok(X.execCmd(g, { t: 'fmode', p: 0, u: a.map(u => u.id), v: 1 }) === null && a.every(u => u.fm === 1), 'Feuermodus Lahmlegen gesetzt');
  X.execCmd(g, { t: 'attack', p: 0, u: a.map(u => u.id), e: t.id });
  step(g, 160, () => { if (t.crip && !tCrip) tCrip = g.time; });
  ok(!t.dead && tCrip > 0, 'Lahmlegen: Ziel manövrierunfähig nach ' + Math.round(tCrip) + ' s, Hülle ' + Math.round(t.hull / t.hullMax * 100) + ' %');
  ok(tCrip > tKill * 1.2, 'Lahmlegen dauert länger als Zerstören (' + Math.round(tCrip) + ' gegen ' + Math.round(tKill) + ' s)');
  ok(a.every(u => u.o.t !== 'attack'), 'Angreifer stellen das Feuer ein');
  const x0 = t.x, y0 = t.y, a0 = t.ang, h0 = t.hull; step(g, 10);
  ok(hyp(t.x - x0, t.y - y0) > 40 && Math.abs(t.ang - a0) > 0.3, 'das Wrack treibt und dreht sich (' + Math.round(hyp(t.x - x0, t.y - y0)) + ')');
  ok(t.hull >= h0 - 1, 'niemand schießt von selbst weiter');
  /* 2. entern und zur Werft schleppen */
  const yard = X.addBldg(g, 'yard', 0, 600, 600, true);
  const tr = X.addShip(g, 'dropship', 0, t.x - 150, t.y, 0);
  ok(X.execCmd(g, { t: 'board', p: 0, u: [tr.id], e: t.id }) === null, 'Enterbefehl angenommen');
  let capT = 0; step(g, 40, () => { if (!capT && t.owner === 0) capT = g.time; });
  ok(t.owner === 0, 'Schiff gekapert');
  ok(t.limp && t.o.t === 'move', 'schleppt sich zur Werft');
  const sp = []; step(g, 20, () => sp.push(t.v));
  const top = Math.max(...sp); ok(top > 3 && top < X.SHIPS.bulwark.speed * 0.25, 'nur sehr langsam (' + Math.round(top) + ' von ' + X.SHIPS.bulwark.speed + ')');
  step(g, 400, () => {});
  ok(!t.limp && hyp(t.x - yard.x, t.y - yard.y) < 400, 'an der Werft repariert und wieder voll fahrbereit');
}
/* 3. von selbst wieder flott */
{
  const g = bare(); const t = X.addShip(g, 'bulwark', 1, 1500, 1500, 0); C.cripple(g, t, 0);
  ok(t.crip > 0, 'zufällig lahmgelegt (direkt ausgelöst)');
  step(g, 80); ok(!t.crip && t.sub.drive >= 0.3, 'nach 75 s flickt die Crew das Schiff');
}
/* 4. Zufall im normalen Gefecht: manchmal bleibt ein Wrack mit Crew */
{
  let n = 0, c = 0;
  for (let s = 0; s < 40; s++) {
    const g = bare(); g.rng = (() => { let x = s * 99991 + 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
    const t = X.addShip(g, 'bulwark', 1, 1500, 1500, 0); t.hull = 5; t.shield = 0; X.damage(g, t, 50, 'kin', null, 0, 1400, 1500); n++; if (t.crip) c++;
  }
  ok(c >= 1 && c <= 10, 'Zufallschance im Gefecht: ' + c + ' von ' + n + ' Schiffen bleiben manövrierunfähig');
}
console.log(fail ? fail + ' FEHLER' : 'ALL OK'); process.exit(fail ? 1 : 0);
