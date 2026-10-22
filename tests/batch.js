'use strict';
/* Reihe von KI-Partien: Siegquoten je Fraktion und Stufe, Dauer, Fehler.
   node tests/batch.js [stufe] [partienJePaarung] [karte] [sekunden] [fraktionen durch Komma, Vorgabe alle vier] */
const { loadSim, runGame } = require('./harness');
const X = loadSim();
const lvl = +process.argv[2] || 2, n = +process.argv[3] || 4, map = process.argv[4] || 'haven', secs = +process.argv[5] || 1500;
const facs = (process.argv[6] || 'alliance,mars,legion,nexus').split(',');
const wins = {}, played = {}, earned = {};
for (const f of facs) { wins[f] = 0; played[f] = 0; earned[f] = 0; }
let draw = 0, totalMs = 0, games = 0;
for (let i = 0; i < facs.length; i++) for (let j = i + 1; j < facs.length; j++) {
  const a = facs[i], b = facs[j];
  let wa = 0, wb = 0;
  for (let s = 1; s <= n; s++) {
    const flip = s % 2 === 0, pl = flip ? [{ faction: b, ai: lvl }, { faction: a, ai: lvl }] : [{ faction: a, ai: lvl }, { faction: b, ai: lvl }];
    const r = runGame(X, { map, seed: s * 31 + 5 + i * 7 + j * 3, players: pl }, secs);
    const wf = r.winner >= 0 ? pl[r.winner].faction : 'none';
    if (wf === a) wa++; else if (wf === b) wb++; else draw++;
    if (wins[wf] !== undefined) wins[wf]++;
    played[a]++; played[b]++;
    for (const p of r.players) if (earned[p.f] !== undefined) earned[p.f] += p.stats.earned;
    totalMs += r.ms; games++;
    console.log(a, 'vs', b, 'seed', s, 'winner', wf, 'at', Math.round(r.time) + 's', 'ms', r.ms, r.players.map(p => p.f.slice(0, 3) + ' k' + p.stats.kills + ' l' + p.stats.lost + ' earned' + p.stats.earned).join(' | '));
  }
  console.log('  ==', a, wa, ':', wb, b);
}
console.log('level', lvl, 'map', map, 'games', games, 'unfinished', draw, 'avg ms', Math.round(totalMs / games));
for (const f of facs) console.log('  ', f.padEnd(9), 'wins', wins[f], '/', played[f], ' avg earned', Math.round(earned[f] / played[f]));
