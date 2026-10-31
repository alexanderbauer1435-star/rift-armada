/* Erkunden: ein Aufklärer deckt in 240 s einen großen Teil der Karte auf, zwei teilen sich die Arbeit, deterministisch */
const { loadSim } = require('./harness.js'); const X = loadSim();
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
function run(n, seed) {
  const g = X.createGame({ map: 'haven', seed, pace: 'fast', players: [{ faction: 'alliance', human: true }, { faction: 'mars', ai: 0 }] });
  const s = g.players[0].start, us = [];
  for (let i = 0; i < n; i++) us.push(X.addShip(g, 'wren', 0, s.x + 60 * i, s.y - 80, 0));
  const r = X.execCmd(g, { t: 'explore', p: 0, u: us.map(u => u.id) });
  const ex0 = g.players[0].explored.reduce((a, b) => a + b, 0);
  while (g.time < 240) X.stepGame(g, []);
  const ex = g.players[0].explored.reduce((a, b) => a + b, 0), tot = g.vw * g.vh;
  return { r, frac: ex / tot, frac0: ex0 / tot, hash: X.stateHash(g), orders: us.map(u => u.dead ? 'dead' : u.o.t) };
}
const a = run(1, 3), b = run(2, 3), c = run(2, 3);
console.log(JSON.stringify({ one: a.frac.toFixed(2), two: b.frac.toFixed(2), start: a.frac0.toFixed(2), orders: b.orders }));
ok(a.r == null, 'Befehl angenommen');
ok(a.frac > a.frac0 + 0.25, 'ein Erkunder deckt in 240 s mindestens 25 % zusätzlich auf (' + Math.round((a.frac - a.frac0) * 100) + ' %)');
ok(b.frac > a.frac + 0.05 || (a.frac > 0.9 && b.frac >= a.frac), 'zwei Erkunder schaffen mehr als einer (oder beide fast alles)');
ok(b.hash === c.hash, 'deterministisch (gleicher Zustand bei gleichem Startwert)');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
