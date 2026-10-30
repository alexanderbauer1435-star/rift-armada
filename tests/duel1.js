'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['core.js', 'data.js', 'i18n.js', 'map.js', 'terrain.js', 'sim.js', 'combat.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(src + '\nthis.X = { createGame, stepGame, addShip, cmdMove, SHIPS, STEP };', ctx);
const X = ctx.X;
const a = process.argv[2] || 'lancer', b = process.argv[3] || 'hedgehog';
const g = X.createGame({ map: 'test', seed: 3, players: [{ faction: X.SHIPS[a].f }, { faction: X.SHIPS[b].f }] });
for (const u of g.ships) u.dead = true; g.deadFlag = true;
const A = X.addShip(g, a, 0, 1200, 1600, 0), B = X.addShip(g, b, 1, 2000, 1600, Math.PI);
X.cmdMove(g, [A], 1900, 1600, true); X.cmdMove(g, [B], 1300, 1600, true);
let shots = { 0: 0, 1: 0 }, hits = { 0: 0, 1: 0 };
while (g.tick < 60 * 30 && !A.dead && !B.dead) {
  X.stepGame(g);
  for (const e of g.ev) { if (e.t === 'shot' && e.kind !== 'beam') shots[e.owner]++; if (e.t === 'hit' && (e.kind === 'kin' || e.kind === 'torp')) hits[e.kind === 'kin' ? 1 : 1]++; }
  g.ev.length = 0;
  if (g.tick % 30 === 0) console.log('t' + (g.tick / 30), 'A', Math.round(A.hull), Math.round(A.shield), 'd', Math.round(Math.hypot(A.x - B.x, A.y - B.y)), 'v', Math.round(A.v), 'o', A.o.t, '| B', Math.round(B.hull), Math.round(B.shield), 'v', Math.round(B.v), 'o', B.o.t, 'shots', shots[1], 'hits', hits[1]);
}
console.log('A dead', A.dead, 'B dead', B.dead, 't', g.time.toFixed(1));
