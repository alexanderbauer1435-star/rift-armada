/* Türme gegen Flotten: wie viel Flotte (Vielfaches der Turmkosten) braucht eine Fraktion, um einen Turm Stufe I bzw. II
   zu zerstören? Flotte = Linienschiff der Fraktion, angreifend per Angriffsmarsch. node tools/balance/towers.js */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
const F = ['alliance', 'mars', 'legion', 'nexus', 'brood'], LINE = { alliance: 'lancer', mars: 'hedgehog', legion: 'paladin', nexus: 'prism', brood: 'ravager' };
const cost = c => (c.ice || 0) + (c.ore || 0);
function towerCost(f, lv) { const L = X.BLDG[f].turret.lv; let c = cost(L[0].cost); for (let i = 1; i < lv; i++) c += cost(L[i].cost); return c; }
function trial(tf, lv, af, mult) {
  const g = X.createGame({ map: 'test', seed: 3, players: [{ faction: tf, ai: 0 }, { faction: af, ai: 0 }] });
  for (const u of g.ships.slice()) X.ctx.removeShip(g, u); g.sites.length = 0; g.gates.length = 0;
  for (const p of g.players) p.nob = true;
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base');
  for (const b of g.bldgs.slice()) if (b !== base) X.ctx.removeBldg(g, b);
  const t = X.addBldg(g, 'turret', 0, 1600, 1600, true);
  if (lv > 1) { t.lv = lv; const l = X.ctx.lvOf(t); t.hull = t.hullMax = l.hull; t.shieldMax = l.shield; t.shield = t.shieldMax; t.wcd = l.wpn.map(() => 0); }
  if (tf === 'nexus') for (const b of g.bldgs) { b.off = false; b.forceNet = 1e9; }
  X.ctx.recalcPower(g, 0);
  const ty = LINE[af], n = Math.max(1, Math.round(mult * towerCost(tf, lv) / cost(X.SHIPS[ty].cost)));
  for (let i = 0; i < n; i++) { const u = X.addShip(g, ty, 1, 2350 + (i % 4) * 40, 1450 + Math.floor(i / 4) * 50, Math.PI); u.auto = true; X.execCmd(g, { t: 'attack', p: 1, u: [u.id], e: t.id }); }
  const lim = 120 / X.STEP; for (let k = 0; k < lim && !t.dead; k++) { X.stepGame(g, []); g.ev.length = 0; }
  return t.dead;
}
const out = {};
for (const tf of F) for (const lv of [1, 2]) {
  const row = [];
  for (const af of F) { let need = '>6'; for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6]) if (trial(tf, lv, af, m)) { need = m; break; } row.push(need); }
  out[tf + ' I' + (lv > 1 ? 'I' : '')] = row;
  console.log((tf + ' Stufe ' + lv).padEnd(18), F.map((af, i) => af.slice(0, 4) + ' ×' + row[i]).join('  '));
}
require('fs').writeFileSync(__dirname + '/towers.json', JSON.stringify(out, null, 1));
