'use strict';
/* Zweikampf-Test: n Schiffe des Typs A gegen n des Typs B auf freier Fläche; Überlebende und Restzustand */
const { loadSim } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['core.js', 'data.js', 'i18n.js', 'map.js', 'sim.js', 'combat.js', 'ai.js', 'waves.js', 'mission.js', 'missions.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(src + '\nthis.X = { createGame, stepGame, addShip, cmdMove, SHIPS, STEP };', ctx);
const X = ctx.X;
function duel(a, b, na, nb, secs) {
  const g = X.createGame({ map: 'test', seed: 3, players: [{ faction: X.SHIPS[a].f }, { faction: X.SHIPS[b].f }] });
  for (const u of g.ships) u.dead = true;
  g.deadFlag = true;
  const cx = 1600, cy = 1600, A = [], B = [];
  for (let i = 0; i < na; i++) A.push(X.addShip(g, a, 0, cx - 420, cy + (i - na / 2) * 50, 0));
  for (let i = 0; i < nb; i++) B.push(X.addShip(g, b, 1, cx + 420, cy + (i - nb / 2) * 50, Math.PI));
  X.cmdMove(g, A, cx + 300, cy, true); X.cmdMove(g, B, cx - 300, cy, true);
  const maxT = secs / X.STEP;
  while (g.tick < maxT) { X.stepGame(g); g.ev.length = 0; const la = A.filter(u => !u.dead).length, lb = B.filter(u => !u.dead).length; if (!la || !lb) break; }
  const la = A.filter(u => !u.dead), lb = B.filter(u => !u.dead);
  const hp = l => l.reduce((s, u) => s + u.hull + u.shield, 0);
  return { t: Math.round(g.time), a: la.length, b: lb.length, hpA: Math.round(hp(la)), hpB: Math.round(hp(lb)) };
}
const pairs = process.argv[2] ? [process.argv.slice(2)] : [['wren', 'needle', 3, 3], ['lancer', 'hedgehog', 3, 3], ['lancer', 'needle', 2, 3], ['bulwark', 'spear', 2, 2], ['haven', 'hammer', 1, 1], ['lancer', 'spear', 3, 2], ['bulwark', 'hedgehog', 1, 3], ['wren', 'hedgehog', 4, 2], ['haven', 'hedgehog', 1, 3]];
for (const [a, b, na, nb] of pairs) { const r = duel(a, b, +na || 3, +nb || 3, 120); console.log(na + 'x ' + a + ' vs ' + nb + 'x ' + b, JSON.stringify(r)); }
