/* Fassung 21: Belagerungsartillerie – zerstört Türme aus sicherer Entfernung, ist selbst schnell zerstört */
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); g.ev.length = 0; } };
const ART = { alliance: 'catapult', mars: 'mortar', legion: 'ballista', nexus: 'lodestar', brood: 'boomer' };
for (const f of Object.keys(ART)) {
  const g = X.createGame({ map: 'test', seed: 3, pace: 'tactical', players: [{ faction: f, ai: 0 }, { faction: 'mars', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  const t = X.addBldg(g, 'turret', 1, 1600, 1600, true); t.lv = 2; const l = C.lvOf(t); t.hull = t.hullMax = l.hull; t.shieldMax = l.shield; t.shield = t.shieldMax; t.wcd = l.wpn.map(() => 0);
  C.recalcPower(g, 1);
  for (let x = 0; x < g.vw; x++) for (let y = 0; y < g.vh; y++) g.players[0].explored[y * g.vw + x] = 1;
  const a = [X.addShip(g, ART[f], 0, 2500, 1600, Math.PI), X.addShip(g, ART[f], 0, 2500, 1660, Math.PI)];
  X.execCmd(g, { t: 'attack', p: 0, u: a.map(u => u.id), e: t.id });
  const t1 = g.time; while (!t.dead && g.time - t1 < 150) { X.stepGame(g); g.ev.length = 0; }
  ok(t.dead && a.every(u => !u.dead), f + ': zwei ' + ART[f] + ' zerstören einen Turm Stufe II aus der Ferne, unbeschädigt (' + Math.round(g.time - t1) + ' s, Turm ' + (t.dead ? 'zerstört' : Math.round(t.hull) + ' Hülle') + ')');
  /* verwundbar: eine einzige Korvette erledigt eine Artillerie schnell */
  const v = X.addShip(g, 'needle', 1, 2200, 1600, 0); X.execCmd(g, { t: 'attack', p: 1, u: [v.id], e: a[0].id }); const t0 = g.time;
  while (!a[0].dead && g.time - t0 < 60) { X.stepGame(g); g.ev.length = 0; }
  ok(a[0].dead && g.time - t0 < 40, f + ': eine Needle zerstört die Artillerie in ' + Math.round(g.time - t0) + ' s');
}
/* trifft keine Schiffe */
{ const g = X.createGame({ map: 'test', seed: 3, players: [{ faction: 'mars', ai: 0 }, { faction: 'alliance', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); for (const b of g.bldgs.slice()) { b.hull = 0; C.removeBldg(g, b); }
  const m = X.addShip(g, 'mortar', 0, 1000, 1000, 0), e = X.addShip(g, 'bulwark', 1, 1700, 1000, Math.PI); e.stance = 2; const h0 = e.hull;
  step(g, 30); ok(e.hull === h0 && !g.proj.some(q => q.kind === 'art'), 'Artillerie schießt nicht auf Schiffe'); }
const h = () => { const g = X.createGame({ map: 'keep', seed: 8, players: [{ faction: 'legion', ai: 3 }, { faction: 'brood', ai: 3 }, { faction: 'mars', ai: 3 }] }); step(g, 600); return X.stateHash(g); };
ok(h() === h(), 'deterministisch');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
