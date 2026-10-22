'use strict';
/* Frachter-Test: Jeder Frachter muss regelmäßig abbauen und liefern. Gemessen wird je Frachter die längste Spanne zwischen
   zwei Abbau-Starts (Zustandswechsel nach »harvest+mine«); hängende Frachter (stehen ohne Andocken oder Abbau) werden gemeldet. */
const { loadSim } = require('./harness');
const X = loadSim();
let worst = 0, stuck = 0;
for (const map of ['haven', 'ashfall', 'test']) {
  const g = X.createGame({ map, seed: 11, players: [{ faction: 'alliance', ai: 2 }, { faction: 'mars', ai: 2 }] });
  const trace = new Map(), pos = new Map(), still = new Map();
  let deliveries = 0;
  while (g.time < 360 && !g.over) {
    X.stepGame(g);
    for (const e of g.ev) if (e.t === 'deliver') deliveries++;
    g.ev.length = 0;
    if (g.tick % 30 === 0) for (const u of g.ships) {
      if (u.dead || !u.def.cargo) continue;
      const st = u.o.t + (u.mine ? '+mine' : '') + (u.dk ? '+dock' : '');
      const tr = trace.get(u.id) || []; if (!tr.length || tr[tr.length - 1].st !== st) tr.push({ t: g.time, st }); trace.set(u.id, tr);
      const p = pos.get(u.id);
      if (p && Math.hypot(p.x - u.x, p.y - u.y) < 3 && !u.mine && !u.dk && (u.o.t === 'harvest' || u.o.t === 'return')) { still.set(u.id, (still.get(u.id) || 0) + 1); if (still.get(u.id) === 15) { stuck++; console.log(map, 'STUCK tanker', u.id, u.o.t, 'at', Math.round(u.x), Math.round(u.y)); } }
      else still.set(u.id, 0);
      pos.set(u.id, { x: u.x, y: u.y });
    }
  }
  let mx = 0;
  for (const [, tr] of trace) { let last = tr[0].t; for (const e of tr) if (e.st === 'harvest+mine') { mx = Math.max(mx, e.t - last); last = e.t; } }
  worst = Math.max(worst, mx);
  console.log(map, 'tankers', trace.size, 'longest gap between mining starts', Math.round(mx) + 's', 'deliveries', deliveries);
}
console.log(stuck ? 'STUCK: ' + stuck : 'no stuck tankers', 'worst gap', Math.round(worst) + 's');
process.exit(stuck || worst > 75 ? 1 : 0);
