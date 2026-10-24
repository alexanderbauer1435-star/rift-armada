/* Kostenduelle: jedes Kampfschiff gegen jedes andere, beide Seiten mit gleichem Budget (Baukosten Eis + Erz), offenes All,
   ohne KI-Wirtschaft (Schiffe greifen selbst an). Ergebnis je Schiff: mittlerer Vorsprung (eigener Restwert − fremder
   Restwert, −1..1) und je Größenklasse des Gegners. node tools/balance/duel.js [budget] [tag] */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
const BUDGET = +(process.argv[2] || 3000), tag = process.argv[3] || 'duel';
const cost = d => (d.cost.ice || 0) + (d.cost.ore || 0);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ships = (ONLY || Object.keys(X.SHIPS)).filter(k => true) && Object.keys(X.SHIPS).filter(k => { const d = X.SHIPS[k]; return d.role === 'war' && d.f !== 'guardian' && cost(d) > 0 && !d.flag && d.wpn.some(w => w.kind !== 'pd') && (!ONLY || ONLY.includes(k)); });
function fight(a, b, seed) {
  const g = X.createGame({ map: 'test', seed, players: [{ faction: X.SHIPS[a].f, ai: 0 }, { faction: X.SHIPS[b].f, ai: 0 }] });
  for (const u of g.ships.slice()) X.ctx.removeShip(g, u); g.sites.length = 0; g.gates.length = 0;
  for (const bd of g.bldgs.slice()) { bd.hull = 0; X.ctx.removeBldg(g, bd); }
  for (const p of g.players) p.nob = true;
  const cx = 1600, cy = 1600, side = (t, pi) => { const n = Math.max(1, Math.round(BUDGET / cost(X.SHIPS[t]))), out = []; for (let i = 0; i < n; i++) { const u = X.addShip(g, t, pi, cx + (pi ? 380 : -380) + ((i % 4) - 1.5) * 40 * (pi ? 1 : -1), cy + (Math.floor(i / 4) - 1) * 50 + (i % 2) * 20, pi ? Math.PI : 0); u.o = { t: 'amove', x: cx + (pi ? -900 : 900), y: cy }; u.auto = true; out.push(u); } return out; };
  const A = side(a, 0), B = side(b, 1), v0A = A.length * cost(X.SHIPS[a]), v0B = B.length * cost(X.SHIPS[b]);
  const val = us => us.reduce((s, u) => s + (u.dead || u.derelict ? 0 : cost(u.def) * u.hull / u.hullMax), 0);
  const lim = 150 / X.STEP; for (let k = 0; k < lim; k++) { X.stepGame(g, []); g.ev.length = 0; if (val(A) <= 0 || val(B) <= 0) break; }
  return val(A) / v0A - val(B) / v0B;
}
const res = {}; for (const s of ships) res[s] = { sum: 0, n: 0, vs: { s: [0, 0], m: [0, 0], l: [0, 0] } };
for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
  const a = ships[i], b = ships[j];
  const r = (fight(a, b, 1) - fight(b, a, 2)) / 2;
  res[a].sum += r; res[a].n++; res[b].sum -= r; res[b].n++;
  res[a].vs[X.SHIPS[b].cls][0] += r; res[a].vs[X.SHIPS[b].cls][1]++; res[b].vs[X.SHIPS[a].cls][0] -= r; res[b].vs[X.SHIPS[a].cls][1]++;
}
const rows = ships.map(s => ({ s, f: X.SHIPS[s].f, cls: X.SHIPS[s].cls, cost: cost(X.SHIPS[s]), score: +(res[s].sum / res[s].n).toFixed(3), vsS: +(res[s].vs.s[0] / Math.max(1, res[s].vs.s[1])).toFixed(2), vsM: +(res[s].vs.m[0] / Math.max(1, res[s].vs.m[1])).toFixed(2), vsL: +(res[s].vs.l[0] / Math.max(1, res[s].vs.l[1])).toFixed(2) })).sort((p, q) => q.score - p.score);
for (const r of rows) console.log(r.f.padEnd(9), r.s.padEnd(13), r.cls, String(r.cost).padStart(5), 'score', String(r.score).padStart(7), 'vs s', r.vsS, 'm', r.vsM, 'l', r.vsL);
const byF = {}; for (const r of rows) (byF[r.f] = byF[r.f] || []).push(r.score);
console.log('Fraktion (Mittel):', Object.entries(byF).map(([f, a]) => f + ' ' + (a.reduce((s, x) => s + x, 0) / a.length).toFixed(3)).join(' · '));
require('fs').writeFileSync(__dirname + '/' + tag + '.json', JSON.stringify(rows, null, 1));
