'use strict';
/* Gleichschritt-Test: Dieselbe Partie zweimal rechnen, die Prüfsummen müssen in jeder Runde übereinstimmen.
   Dazu: Siegbedingung – eine Partie endet, sobald alle Gegner besiegt sind, egal wer sie besiegt hat (3 Parteien). */
const { loadSim } = require('./harness');
const X = loadSim();
function hashes(opts, secs) {
  const g = X.createGame(opts), out = [];
  while (!g.over && g.time < secs) { X.stepGame(g); g.ev.length = 0; if (g.tick % 30 === 0) out.push(X.stateHash(g)); }
  return out;
}
let ok = true;
for (const map of ['haven', 'ashfall']) {
  const opts = { map, seed: 99, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }] };
  const a = hashes(opts, 400), b = hashes(opts, 400);
  const same = a.length === b.length && a.every((h, i) => h === b[i]);
  console.log('determinism', map, same ? 'OK' : 'MISMATCH', a.length, 'samples');
  ok = ok && same;
}
/* Sieg mit drei Parteien: P0 und P1 sind ein Team gegen P2; nach Zerstörung von P2 muss die Partie enden */
{
  const g = X.createGame({ map: 'ashfall', seed: 5, players: [{ faction: 'alliance', ai: 3, team: 0 }, { faction: 'mars', ai: 3, team: 0 }, { faction: 'mars', ai: 1, team: 1 }] });
  while (!g.over && g.time < 2400) { X.stepGame(g); g.ev.length = 0; }
  console.log('team victory', g.over ? 'OK winner team ' + g.winTeam + ' at ' + Math.round(g.time) + 's' : 'NOT OVER after 2400s');
  ok = ok && g.over && g.winTeam === 0;
}
/* Sieg durch Dritte: P1 wird von P0 vernichtet, Spieler P2 (Mensch, untätig) muss trotzdem die Partie beenden, sobald P0 auch P2 vernichtet hat –
   und umgekehrt: Stirbt P1 durch P0, obwohl P2 noch lebt, läuft die Partie weiter */
{
  const g = X.createGame({ map: 'ashfall', seed: 8, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 1 }, { faction: 'mars', human: true }] });
  let elim1 = -1;
  while (!g.over && g.time < 3000) { X.stepGame(g); for (const e of g.ev) if (e.t === 'elim' && e.owner === 1) elim1 = g.time; g.ev.length = 0; }
  console.log('third party', 'P1 eliminated at', Math.round(elim1), 'over', g.over, 'winner', g.winner, 'at', Math.round(g.time));
  ok = ok && g.over && g.winner >= 0;
}
console.log(ok ? 'ALL OK' : 'FAILURES');
process.exit(ok ? 0 : 1);
