/* Diagnose eines Endspiels zu zweit nach Alle gegen alle: node tools/balance/ffadiag.js [map] [seed] [minuten] [ohneFraktion]
   alle 5 Minuten je lebendem Spieler: Schiffe, Kommandopunkte, Rohstoffe, Gebäude, Türme, Angriffe, Verluste */
const { loadSim } = require('../../tests/harness.js'); const X = loadSim();
const map = process.argv[2] || 'arena', seed = +(process.argv[3] || 22), MIN = +(process.argv[4] || 50), outF = +(process.argv[5] || 4);
const F = ['alliance', 'mars', 'legion', 'nexus', 'brood'].filter((_, k) => k !== outF);
const g = X.createGame({ map, seed, players: F.map((f, k) => ({ faction: f, ai: 3, team: k + 1 })) });
const atk = {}; const lim = MIN * 60 / X.STEP;
for (let k = 0; k < lim && !g.over; k++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'aiattack' || e.type === 'aiattack' || e[0] === 'aiattack') { const o = (e.owner !== undefined ? e.owner : (e.d && e.d.owner)); atk[o] = (atk[o] || 0) + 1; } g.ev.length = 0;
  if (k % Math.round(300 / X.STEP) === 0 && g.time > 60) {
    const rows = g.players.filter(p => !p.neutral && g.bldgs.some(b => !b.dead && b.owner === p.id)).map(p => { const sh = g.ships.filter(u => !u.dead && u.owner === p.id); const bl = g.bldgs.filter(b => !b.dead && b.owner === p.id);
      return p.faction + ' sh' + sh.length + ' war' + sh.filter(u => !u.def.cargo && !u.def.build).length + ' cp' + p.cpUse + '/' + p.cpMax + ' ice' + Math.round(p.ice) + ' ore' + Math.round(p.ore) + ' b' + bl.length + ' tur' + bl.filter(b => b.role === 'turret').length + ' atk' + (atk[p.id] || 0) + ' lost' + p.stats.lost + ' inc' + (p.stats.earned | 0) + (p.ai && p.ai.atk ? ' ATTACKING' : ''); });
    console.log(Math.round(g.time / 60) + 'min | ' + rows.join(' || '));
  } }
console.log('over', g.over, 'winner', g.players[g.winner] && g.players[g.winner].faction);
