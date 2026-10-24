/* Balance-Matrix: jede Fraktion gegen jede (KI Schwer, beide Seiten, mehrere Startwerte) auf offenen und geschützten Karten.
   node tools/balance/matrix.js [tag] [maps] [seeds] → Siegquote je Fraktion, mittlere Spieldauer, Unentschieden (Zeitlimit) */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
const tag = process.argv[2] || 'run', maps = (process.argv[3] || 'expanse,bastions').split(','), seeds = +(process.argv[4] || 3);
const F = ['alliance', 'mars', 'legion', 'nexus', 'brood'], LIM = 1800;
const win = {}, games = {}, dur = [], pair = {}; let draws = 0, n = 0;
for (const f of F) { win[f] = 0; games[f] = 0; }
for (const map of maps) for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) for (let s = 1; s <= seeds; s++) for (const sw of [0, 1]) {
  const a = sw ? F[j] : F[i], b = sw ? F[i] : F[j];
  const g = X.createGame({ map, seed: s * 7 + i * 3 + j, players: [{ faction: a, ai: 3, team: 1 }, { faction: b, ai: 3, team: 2 }] });
  const lim = LIM / X.STEP; for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; }
  games[a]++; games[b]++; n++;
  if (!g.over) { draws++; continue; }
  const wf = g.players[g.winner] ? g.players[g.winner].faction : null; if (wf) { win[wf]++; const key = [F[i], F[j]].join('-'); pair[key] = pair[key] || { [F[i]]: 0, [F[j]]: 0 }; pair[key][wf]++; }
  dur.push(g.time);
}
const out = { tag, maps, seeds, games: n, draws, avgMin: +(dur.reduce((s, x) => s + x, 0) / Math.max(1, dur.length) / 60).toFixed(1), winrate: Object.fromEntries(F.map(f => [f, +(win[f] / games[f]).toFixed(2)])), pair };
console.log(JSON.stringify(out));
require('fs').writeFileSync(__dirname + '/result-' + tag + '.json', JSON.stringify(out, null, 1));
