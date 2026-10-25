/* Wiederholung: Startoptionen + Befehlsliste spielen eine Partie exakt nach (gleicher Zustands-Hash) */
const { loadSim } = require('./harness.js');
const X = loadSim(), fs = require('fs'), path = require('path'), vm = require('vm');
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'replay.js'), 'utf8').replace(/^const RP = [^\n]*$/m, ''), X.ctx);
const C = X.ctx; let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
for (const [map, seed] of [['expanse', 5], ['bastions', 9]]) {
  const opts = { map, seed, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 2, team: 0 }, { faction: 'brood', ai: 2, team: 1 }] };
  const g = X.createGame(JSON.parse(JSON.stringify(opts)));
  const end = Math.round(420 / X.STEP);
  while (g.tick < end) {
    /* »Spieler«: alle 20 s die Flotte bewegen, Rohstoffe schenken, Signal setzen */
    if (g.tick % 600 === 300) { const us = g.ships.filter(u => !u.dead && u.owner === 0 && X.ctx.armed(u)).map(u => u.id); if (us.length) C.issueCmd(g, { t: 'move', p: 0, u: us, x: g.map.w / 2, y: g.map.h / 2, am: true }); }
    if (g.tick % 900 === 450) C.issueCmd(g, { t: 'gift', p: 0, to: 1, ice: 50, ore: 0 });
    if (g.tick % 1200 === 600) C.issueCmd(g, { t: 'ping', p: 0, k: 'help', x: 1000, y: 1000 });
    X.stepGame(g); g.ev.length = 0;
  }
  const h1 = X.stateHash(g);
  const r = C.rpCreate(opts, g.log);
  while (r.tick < end) { C.rpStep(r); r.ev.length = 0; }
  ok(X.stateHash(r) === h1 && g.log.length > 10, map + ': Wiederholung deckungsgleich (' + g.log.length / 2 + ' Befehle, Takt ' + r.tick + ')');
}
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
