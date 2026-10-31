/* Alle gegen alle zu viert, lange: node tools/balance/ffalong.js [map] [spiele] [minuten]
   Meldet je Spiel, wann Spieler ausscheiden und wann das Spiel endet (oder wie viele nach dem Zeitlimit noch leben). */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
const map = process.argv[2] || 'expanse', N = +(process.argv[3] || 4), MIN = +(process.argv[4] || 60);
const F = ['alliance', 'mars', 'legion', 'nexus', 'brood'];
for (let i = 0; i < N; i++) {
  const four = F.filter((_, k) => k !== i % 5);
  const g = X.createGame({ map, seed: 17 + i * 5, players: four.map((f, k) => ({ faction: f, ai: 3, team: k + 1 })) });
  const out = []; const alive = () => g.players.filter(p => g.bldgs.some(b => !b.dead && b.owner === p.id));
  let last = 4; const lim = MIN * 60 / X.STEP;
  for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); g.ev.length = 0; if (k % 150 === 0) { const a = alive().length; if (a < last) { out.push(Math.round(g.time / 60) + 'min:' + a); last = a; } } }
  console.log(JSON.stringify({ map, game: i, factions: four, over: !!g.over, endMin: +(g.time / 60).toFixed(1), aliveAtEnd: alive().map(p => p.faction), drops: out }));
}
