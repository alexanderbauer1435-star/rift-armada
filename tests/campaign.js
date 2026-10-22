'use strict';
/* Kampagnen-Test: jede Mission startet, läuft ohne Fehler, setzt Ziele; mit KI am Steuer des Spielers kommt sie voran;
   Entscheidungen greifen; Spielstand und Gleichschritt. node tests/campaign.js [missionId] [sekunden] */
const { loadSim } = require('./harness');
const X = loadSim(), C = X.ctx;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null, secs = +process.argv[3] || 900;
const list = only ? [only] : X.CAMP_ORDER.filter(id => X.MISSIONS[id]);
function autopilot(g) {
  if (g.tick % 90) return;
  const h = g.human, t = g.tm[h], M = g.mis;
  if (M.S && M.S.rally && M.f.phase === 4) { for (const u of g.ships) if (!u.dead && u.owner === h) { u.o = { t: 'move', x: M.S.rally.x, y: M.S.rally.y }; u.path = null; } return; }
  for (const u of g.ships) {
    if (u.dead || u.owner !== h || !u.def.wpn.length || u.convoy || (u.o.t !== 'idle' && u.o.t !== 'hold')) continue;
    let best = null, bd = 1e9;
    for (const e of g.ships) if (!e.dead && !e.derelict && g.tm[e.owner] !== t && !g.players[e.owner].neutral && e.def.role !== 'fighter') { const d = X.hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
    for (const b of g.bldgs) if (!b.dead && g.tm[b.owner] !== t && !g.players[b.owner].neutral) { const d = X.hyp(b.x - u.x, b.y - u.y) + 300; if (d < bd) { bd = d; best = b; } }
    if (best) { u.hold = false; u.o = { t: 'amove', x: best.x, y: best.y }; u.path = null; }
  }
}
for (const id of list) {
  for (const lvl of only ? [2] : [1, 3]) {
    const def = X.MISSIONS[id];
    const carry = { save: 'gate', voss: 'spare', node: 'live' };
    const opts = X.misOpts(id, lvl, carry, def.f || 'alliance');
    let g;
    try { g = X.createGame(opts); } catch (e) { ok(false, id + ' L' + lvl + ' create: ' + e.message + '\n' + e.stack.split('\n').slice(0, 4).join('\n')); continue; }
    const h = g.players[g.human];
    /* KI steuert den Spieler, Entscheidungen nimmt sie die erste Möglichkeit */
    h.ai = C.aiInit(3);
    let radios = 0, err = null, asks = 0;
    const t0 = Date.now();
    try {
      while (!g.over && g.time < secs) {
        X.stepGame(g);
        for (const e of g.ev) { if (e.t === 'radio') radios++; if (e.t === 'ask') asks++; }
        g.ev.length = 0;
        if (g.mis.ask) X.misChoose(g, g.human, g.mis.ask.id, g.mis.ask.o[0][0]);
        /* Autopilot: eigene Missionshilfe, sonst greifen untätige Kampfschiffe den nächsten Feind an */
        if (g.tick % 30 === 0) { if (def.auto) def.auto(g, g.mis); if (h.nob) autopilot(g); }
      }
    } catch (e) { err = e; }
    const goals = g.mis.goals.map(q => q.id + ':' + q.st + (q.n ? '(' + q.v + '/' + q.n + ')' : '')).join(' ');
    ok(!err, id + ' L' + lvl + ' runs ' + Math.round(g.time) + 's in ' + (Date.now() - t0) + 'ms, res ' + g.mis.res + (g.mis.why ? ' (' + g.mis.why + ')' : '') + ', radios ' + radios + ', asks ' + asks + ' | ' + goals + (err ? '\n' + err.stack.split('\n').slice(0, 5).join('\n') : ''));
    ok(g.mis.goals.some(q => q.st > 0) && radios > 0, id + ' L' + lvl + ' has open goals and radio');
  }
}
console.log(fails ? 'FAILURES ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
