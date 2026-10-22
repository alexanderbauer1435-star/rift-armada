'use strict';
const { loadSim, runGame } = require('./harness');
const X = loadSim();
const seed = +process.argv[2] || 7, lvl = +process.argv[3] || 2, map = process.argv[4] || 'haven', secs = +process.argv[5] || 900;
let last = -1;
const r = runGame(X, { map, seed, players: [{ faction: 'alliance', ai: lvl }, { faction: 'mars', ai: lvl }] }, secs, g => {
  const m = Math.floor(g.time / 60);
  if (m !== last && m % 2 === 0) { last = m; console.log('t=' + m + 'min', g.players.map(p => p.faction.slice(0,3) + ' ice' + Math.round(p.ice) + ' ore' + Math.round(p.ore) + ' ships' + g.ships.filter(u => !u.dead && u.owner === p.id && u.def.role !== 'fighter').length + ' b' + g.bldgs.filter(b => !b.dead && b.owner === p.id).length + ' cp' + p.cpUse + '/' + p.cpMax + ' e' + p.eGen + '/' + p.eUse + (p.alive ? '' : ' DEAD')).join(' | ')); }
});
console.log('over', r.over, 'winner', r.winner, 'time', Math.round(r.time), 'ms', r.ms, 'ticks', r.ticks);
console.log(JSON.stringify(r.players, null, 0));
