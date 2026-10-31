/* Balance-Matrix: jede Fraktion gegen jede (KI Schwer, beide Seiten, mehrere Startwerte) auf offenen und geschützten Karten.
   node tools/balance/matrix.js [tag] [maps] [seeds] → Siegquote je Fraktion, mittlere Spieldauer, Unentschieden (Zeitlimit) */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
if (process.env.AIOPT) Object.assign(X.ctx.AI_OPT, JSON.parse(process.env.AIOPT));
const tag = process.argv[2] || 'run', maps = (process.argv[3] || 'expanse,bastions').split(','), seeds = +(process.argv[4] || 3);
const F = ['alliance', 'mars', 'legion', 'nexus', 'brood'], LIM = 1800, MODE = process.env.MODE || '1v1';
const win = {}, games = {}, dur = [], pair = {}; let draws = 0, n = 0;
for (const f of F) { win[f] = 0; games[f] = 0; }
if (MODE === '2v2') for (const map of maps) for (let s = 1; s <= seeds; s++) for (let out = 0; out < 5; out++) { const four = F.filter((_, k) => k !== out); for (const [x, y] of [[0, 1], [0, 2], [0, 3]]) {
  const t1 = [four[x], four[y]], t2 = four.filter(f => !t1.includes(f));
  const g = X.createGame({ map, seed: s * 31 + out * 7 + x + y, players: [{ faction: t1[0], ai: 3, team: 1 }, { faction: t2[0], ai: 3, team: 2 }, { faction: t1[1], ai: 3, team: 1 }, { faction: t2[1], ai: 3, team: 2 }] });
  const lim = LIM / X.STEP; for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; }
  for (const f of four) games[f]++; n++;
  if (!g.over) { draws++; continue; }
  const wt = g.winTeam === 1 ? t1 : g.winTeam === 2 ? t2 : []; for (const f of wt) win[f]++; dur.push(g.time);
} }
if (MODE === '1v1') for (const map of maps) for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) if (!process.env.ONLYF || F[i] === process.env.ONLYF || F[j] === process.env.ONLYF) for (let s = 1; s <= seeds; s++) for (const sw of [0, 1]) {
  const a = sw ? F[j] : F[i], b = sw ? F[i] : F[j];
  const g = X.createGame({ map, seed: s * 7 + i * 3 + j, players: [{ faction: a, ai: 3, team: 1 }, { faction: b, ai: 3, team: 2 }] });
  const lim = LIM / X.STEP; for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; }
  games[a]++; games[b]++; n++;
  if (!g.over) { draws++; continue; }
  const wf = g.players[g.winner] ? g.players[g.winner].faction : null; if (wf) { win[wf]++; const key = [F[i], F[j]].join('-'); pair[key] = pair[key] || { [F[i]]: 0, [F[j]]: 0 }; pair[key][wf]++; }
  dur.push(g.time);
}
/* Alle gegen alle zu viert (MODE=ffa4): je vier der fünf Fraktionen, jede eigene Mannschaft, Startplätze rotiert */
if (MODE === 'ffa4') for (const map of maps) for (let s = 1; s <= seeds; s++) for (let out = 0; out < 5; out++) for (let rot = 0; rot < 2; rot++) {
  const four = F.filter((_, k) => k !== out); if (rot) four.push(four.shift(), four.shift());
  const g = X.createGame({ map, seed: s * 17 + out * 5 + rot, players: four.map((f, k) => ({ faction: f, ai: 3, team: k + 1 })) });
  const lim = LIM / X.STEP; for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; }
  for (const f of four) games[f]++; n++;
  if (!g.over) { draws++; continue; }
  const wf = g.players[g.winner] ? g.players[g.winner].faction : null; if (wf) win[wf]++; dur.push(g.time);
}
/* Schwierigkeitsstufen (MODE=lvl, LV="1,3"): jede Fraktionspaarung, Stufe A gegen Stufe B, beide Seiten; Ergebnis: Siegquote der Stufe A */
const lvlRes = { a: 0, b: 0, games: 0 };
if (MODE === 'lvl') { const [la, lb] = (process.env.LV || '1,3').split(',').map(Number);
  for (const map of maps) for (let i = 0; i < F.length; i++) for (let j = 0; j < F.length; j++) if (i !== j) for (let s = 1; s <= seeds; s++) {
    const g = X.createGame({ map, seed: s * 11 + i * 3 + j, players: [{ faction: F[i], ai: la, team: 1 }, { faction: F[j], ai: lb, team: 2 }] });
    const lim = LIM / X.STEP; for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; }
    lvlRes.games++; n++; if (!g.over) { draws++; continue; } dur.push(g.time); if (g.winner === 0) lvlRes.a++; else lvlRes.b++;
  }
  lvlRes.levels = [la, lb]; }
const out = { tag, maps, seeds, games: n, draws, avgMin: +(dur.reduce((s, x) => s + x, 0) / Math.max(1, dur.length) / 60).toFixed(1), winrate: Object.fromEntries(F.map(f => [f, +(win[f] / Math.max(1, games[f])).toFixed(2)])), pair, lvl: MODE === 'lvl' ? lvlRes : undefined };
console.log(JSON.stringify(out));
require('fs').writeFileSync(__dirname + '/result-' + tag + '.json', JSON.stringify(out, null, 1));
