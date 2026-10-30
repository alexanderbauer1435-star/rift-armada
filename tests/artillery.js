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
/* Schiffe: ein stehendes wird getroffen, ein fahrendes weicht den langsamen Granaten aus */
for (const moving of [false, true]) {
  const g = X.createGame({ map: 'test', seed: 3, pace: 'tactical', players: [{ faction: 'mars', ai: 0 }, { faction: 'brood', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  const m = X.addShip(g, 'mortar', 0, 1000, 1600, 0), e = X.addShip(g, 'ravager', 1, 1850, 1600, Math.PI); e.stance = 2; const h0 = e.hull + e.shield; g.reveals.push({ x: 1850, y: 1600, r: 700, owner: 0, until: 1e9 });   /* Späher: Schiffe muss man sehen */
  let shots = 0; const end = g.time + 60;
  while (g.time < end && !g.over) { if (moving && (g.tick % 60) === 0) X.execCmd(g, { t: 'move', p: 1, u: [e.id], x: 1850, y: (g.tick / 60) % 2 ? 1300 : 1900 }); X.stepGame(g); for (const q of g.ev) if (q.t === 'shot' && q.owner === 0) shots++; g.ev.length = 0; }
  const lost = h0 - (e.hull + e.shield);
  ok(shots >= 5 && (moving ? lost < h0 * 0.12 : lost > h0 * 0.25), (moving ? 'fahrendes' : 'stehendes') + ' Schiff: ' + shots + ' Schüsse, Verlust ' + Math.round(lost) + ' von ' + Math.round(h0));
}
/* Feuer auf Stelle: nur erkundetes Gebiet, trifft dort stehende Ziele auch ohne Sicht */
{ const g = X.createGame({ map: 'test', seed: 3, pace: 'tactical', players: [{ faction: 'mars', ai: 0 }, { faction: 'brood', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  const m = X.addShip(g, 'mortar', 0, 1000, 1600, 0), e = X.addShip(g, 'ravager', 1, 1850, 1600, Math.PI); e.stance = 2; const h0 = e.hull;
  const P = g.players[0]; P.explored.fill(0);
  ok(X.execCmd(g, { t: 'artpos', p: 0, u: [m.id], x: 1850, y: 1600 }) === 'Nur auf erkundetes Gebiet', 'Feuer auf Stelle nur auf erkundetes Gebiet');
  P.explored.fill(1);
  ok(X.execCmd(g, { t: 'artpos', p: 0, u: [m.id], x: 1850, y: 1600 }) == null && m.o.t === 'artpos', 'Befehl angenommen');
  let shots = 0; const end = g.time + 45; while (g.time < end && !g.over) { X.stepGame(g); for (const q of g.ev) if (q.t === 'shot' && q.owner === 0) shots++; g.ev.length = 0; }
  ok(shots >= 5 && e.hull < h0 * 0.8 && !C.canSee(g, 0, e), 'beschießt die Stelle ohne Sicht: ' + shots + ' Schüsse, Ravager ' + Math.round(e.hull) + '/' + h0); }
const h = () => { const g = X.createGame({ map: 'keep', seed: 8, players: [{ faction: 'legion', ai: 3 }, { faction: 'brood', ai: 3 }, { faction: 'mars', ai: 3 }] }); step(g, 600); return X.stateHash(g); };
ok(h() === h(), 'deterministisch');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
