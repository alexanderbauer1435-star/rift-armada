'use strict';
/* Messwerkzeug Kampagne: jede Mission mit KI am Steuer des Spielers (wie tests/campaign.js) auf gewählten
   Schwierigkeiten und Kampftempo; gibt Dauer, Ergebnis und Ziele aus. Die Missionen laufen in eigenen Prozessen parallel.
   node tools/balance/missions.js [ids|all] [stufen, z. B. 1,2,3] [max. Sekunden] [tempo]
   Beispiel: node tools/balance/missions.js a1m1,a2m2 1,3 2400 tactical */
const { loadSim } = require('../../tests/harness');
const { fork } = require('child_process');
const arg = process.argv.slice(2);
if (arg[0] === '--one') {
  const [, id, lvl, secs, pace] = arg;
  const X = loadSim(), C = X.ctx, def = X.MISSIONS[id];
  const opts = X.misOpts(id, +lvl, { save: 'gate', voss: 'spare', node: 'live' }, def.f || 'alliance');
  if (pace && pace !== 'tactical') opts.pace = pace;
  const g = X.createGame(opts), h = g.players[g.human];
  h.ai = C.aiInit(+process.env.AIL || 3);
  const marks = [];
  let last = '';
  while (!g.over && g.time < +secs) {
    X.stepGame(g); g.ev.length = 0;
    if (g.mis.ask) X.misChoose(g, g.human, g.mis.ask.id, g.mis.ask.o[0][0]);
    if (g.tick % 30 === 0) { if (def.auto) def.auto(g, g.mis); if (h.nob) autopilot(X, g); }
    const st = g.mis.goals.map(q => q.id + q.st).join(' ');
    if (st !== last) { last = st; for (const q of g.mis.goals) if (q.st === 2 && !marks.some(m => m[0] === q.id)) marks.push([q.id, Math.round(g.time)]); }
  }
  const goals = g.mis.goals.map(q => q.id + ':' + q.st + (q.n ? '(' + q.v + '/' + q.n + ')' : '')).join(' ');
  process.send({ id, lvl: +lvl, t: Math.round(g.time), res: g.mis.res, why: g.mis.why, goals, marks: marks.map(m => m.join('@')).join(' ') });
  process.exit(0);
}
function autopilot(X, g) {
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
const X = loadSim();
const ids = !arg[0] || arg[0] === 'all' ? X.CAMP_ORDER.filter(id => X.MISSIONS[id]) : arg[0].split(',');
const lvls = (arg[1] || '1,2,3').split(',').map(Number), secs = +arg[2] || 2400, pace = arg[3] || 'tactical';
const jobs = []; for (const id of ids) for (const l of lvls) jobs.push([id, l]);
const par = Math.max(1, +process.env.PAR || require('os').cpus().length), out = [];
let run = 0;
function next() {
  if (!jobs.length) { if (!run) done(); return; }
  const [id, l] = jobs.shift(); run++;
  const c = fork(__filename, ['--one', id, String(l), String(secs), pace]);
  c.on('message', m => { out.push(m); console.log(fmt(m)); });
  c.on('exit', () => { run--; next(); });
}
const fmt = m => (m.id + ' L' + m.lvl).padEnd(9) + ' ' + (m.res === 1 ? 'SIEG ' : m.res === 2 ? 'NIEDERL.' : 'offen').padEnd(8) + ' ' + String(Math.floor(m.t / 60)).padStart(2) + ':' + String(m.t % 60).padStart(2, '0') + '  ' + (m.why ? '(' + m.why + ') ' : '') + m.goals + (m.marks ? '  | ' + m.marks : '');
function done() { console.log('---'); out.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.lvl - b.lvl); for (const m of out) console.log(fmt(m)); }
for (let i = 0; i < par; i++) next();
