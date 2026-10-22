'use strict';
/* Armee-Zweikampf mit gleichem Wert: je Fraktion eine gemischte Tier-1/2-Flotte für etwa »budget« Rohstoffe (Eis+Erz),
   Kampf auf freier Fläche, Ergebnis als übriger Flottenwert. Zeigt Unwucht zwischen den Fraktionen unabhängig von der KI.
   node tests/army.js [budget] [fraktionen durch Komma] */
const { loadSim } = require('./harness');
const X = loadSim(), C = X.ctx;
const budget = +process.argv[2] || 4000;
const facs = (process.argv[3] || 'alliance,mars,legion,nexus,brood').split(',');
const MIX = {
  alliance: ['wren', 'lancer', 'lancer', 'bulwark'], mars: ['needle', 'hedgehog', 'hedgehog', 'hedgehog', 'spear'], legion: ['herald', 'paladin', 'paladin', 'bastion'],
  nexus: ['shard', 'shard', 'shard', 'prism', 'binder'], brood: ['swarm', 'swarm', 'spitter', 'ravager', 'leech', 'sporer']
};
function val(d) { return d.cost.ice + d.cost.ore; }
function army(g, f, pi, x, y, ang) {
  const list = MIX[f], out = []; let spent = 0, i = 0;
  while (spent < budget) { const d = X.SHIPS[list[i % list.length]]; if (spent + val(d) > budget + 150) { i++; if (i > 40) break; continue; } const u = X.addShip(g, d.id, pi, x, y + (out.length - 6) * 42, ang); out.push(u); spent += val(d); i++; }
  for (let k = 0; k < 8; k++) C.separate(g);
  return { ships: out, spent };
}
function fight(fa, fb, secs) {
  const g = X.createGame({ map: 'test', seed: 7, players: [{ faction: fa }, { faction: fb }] });
  for (const u of g.ships) u.dead = true;
  g.deadFlag = true;
  const cx = 1600, cy = 1600;
  const A = army(g, fa, 0, cx - 450, cy, 0), B = army(g, fb, 1, cx + 450, cy, Math.PI);
  for (const u of A.ships) u.auto = true; for (const u of B.ships) u.auto = true;
  X.execCmd(g, { t: 'move', p: 0, u: A.ships.map(u => u.id), x: cx + 300, y: cy, am: 1 });
  X.execCmd(g, { t: 'move', p: 1, u: B.ships.map(u => u.id), x: cx - 300, y: cy, am: 1 });
  const maxT = secs / X.STEP;
  while (g.tick < maxT) { X.stepGame(g); g.ev.length = 0; const la = A.ships.filter(u => !u.dead && !u.derelict).length, lb = B.ships.filter(u => !u.dead && !u.derelict).length; if (!la || !lb) break; }
  const left = l => l.filter(u => !u.dead && !u.derelict).reduce((s, u) => s + val(u.def) * (u.hull + u.shield) / (u.hullMax + u.shieldMax), 0);
  return { t: Math.round(g.time), a: Math.round(left(A.ships)), b: Math.round(left(B.ships)), na: A.ships.filter(u => !u.dead && !u.derelict).length, nb: B.ships.filter(u => !u.dead && !u.derelict).length, sa: A.spent, sb: B.spent };
}
const score = {};
for (const f of facs) score[f] = 0;
for (let i = 0; i < facs.length; i++) for (let j = i + 1; j < facs.length; j++) {
  const r1 = fight(facs[i], facs[j], 180), r2 = fight(facs[j], facs[i], 180);
  const wi = (r1.a - r1.b) + (r2.b - r2.a);
  score[facs[i]] += wi; score[facs[j]] -= wi;
  console.log(facs[i].padEnd(8), 'vs', facs[j].padEnd(8), 'left', r1.a, ':', r1.b, '(' + r1.na + ':' + r1.nb + ' ships, ' + r1.t + 's)', ' swapped', r2.b, ':', r2.a, '(' + r2.nb + ':' + r2.na + ', ' + r2.t + 's)');
}
console.log('score (Restwert-Saldo):', Object.entries(score).map(([f, v]) => f + ' ' + Math.round(v)).join(', '));
