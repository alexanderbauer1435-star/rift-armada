'use strict';
/* Conquest-Test: Sektorkarte (20 Systeme, zusammenhängend, Typen, Logbücher), Feldzüge mit berechneten Schlachten über
   viele Startwerte (alle Enden erreichbar, keine Endlosschleife), gleicher Startwert = gleicher Verlauf, Speichern als JSON,
   Entscheidungen und Ereignisse, und jede Schlachtart einmal in der Simulation (KI am Steuer).
   node tests/conquest.js [sekunden je Schlacht] */
const { loadSim } = require('./harness');
const X = loadSim(), Cx = X.ctx;
const secs = +process.argv[2] || 600;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
/* 1. Sektorkarte */
for (const fac of ['alliance', 'mars', 'legion', 'nexus']) {
  const C = X.cqNew(fac, 2, 1000 + fac.length * 17);
  const comp = new Set(); const stack = [0]; while (stack.length) { const i = stack.pop(); if (comp.has(i)) continue; comp.add(i); for (const j of C.sys[i].links) stack.push(j); }
  const types = {}; for (const s of C.sys) types[s.type] = (types[s.type] || 0) + 1;
  ok(C.sys.length === 20 && comp.size === 20 && C.sys.every(s => s.links.length >= 1) && types.cap === 4 && types.core === 1 && types.yard === 4 && types.relic === 4 && types.gate === 3 && types.mine === 4 && C.sys.filter(s => s.log >= 0).length === 6 && C.sys.filter(s => s.owner === fac).length === 2,
    fac + ': 20 Systeme, zusammenhängend, Typen ' + JSON.stringify(types) + ', 6 Logbücher, Start mit 2 Systemen');
}
/* 2. Feldzüge mit berechneten Schlachten */
function play(C, pol) {
  let t = 0;
  while (!C.over && t++ < 80) {
    while (C.queue.length) {
      const q = C.queue.shift();
      if (q.k === 'chap') { const ch = X.CQ_CHAP[C.fac][q.n - 1]; if (ch.d) X.cqDecide(C, ch.d === 'truce' ? X.CQ_TRUCE : ch.d, pol(q)); }
      else if (q.k === 'event') { const e = X.cqEventDef(C, q); if (e) X.cqDecide(C, Object.assign({}, q, { id: e.d.id }), pol(q)); }
      else if (q.k === 'final') X.cqDecide(C, X.CQ_FINAL, pol(q));
    }
    if (C.over) break;
    const th = C.threats.find(x => C.sys[x.sys].owner === C.fac && (C.sys[x.sys].type === 'cap' || x.pow > 3));
    let sp;
    if (th) sp = X.cqSpec(C, 'defend', th.sys, th.by);
    else {
      const tg = X.cqTargets(C).map(id => C.sys[id]).sort((a, b) => X.cqChance(C, b) - X.cqChance(C, a));
      const core = tg.find(s => s.type === 'core' || s.type === 'secret'), pick = core && X.cqChance(C, core) > 0.35 ? core : tg[0];
      if (!pick || X.cqChance(C, pick) < 0.3) { const m = X.cqMine(C).filter(s => s.fort < 3).sort((a, b) => (b.type === 'cap') - (a.type === 'cap'))[0]; if (m) { X.cqFortify(C, m.id); continue; } }
      if (!pick) break;
      sp = X.cqSpec(C, 'attack', pick.id);
    }
    X.cqResult(C, sp, X.cqAuto(C, sp));
  }
  return C;
}
const ends = {};
let turns = 0, n = 0, maxJson = 0;
for (let seed = 1; seed <= 20; seed++) for (const fac of ['alliance', 'mars', 'legion', 'nexus']) {
  const C = play(X.cqNew(fac, 2, seed * 7919), q => (seed + (q.n || 0)) % 2 ? 'a' : 'b');
  const k = C.over ? C.ending : 'offen'; ends[k] = (ends[k] || 0) + 1; turns += C.turn; n++;
  maxJson = Math.max(maxJson, JSON.stringify(C).length);
  if (C.sys.some(s => !s.owner)) ok(false, 'System ohne Besitzer');
}
ok(ends.seal && ends.open && ends.lost && (ends['offen'] || 0) < n * 0.15, 'Enden über 80 Feldzüge (Normal, berechnet): ' + JSON.stringify(ends) + ', im Schnitt ' + (turns / n).toFixed(1) + ' Runden');
ok(maxJson < 20000, 'Feldzug als JSON klein (' + maxJson + ' Zeichen)');
{
  const pol = q => (q.n || 0) % 2 ? 'a' : 'b';
  const A = play(X.cqNew('legion', 2, 4242), pol), B = play(X.cqNew('legion', 2, 4242), pol);
  ok(JSON.stringify(A) === JSON.stringify(B), 'gleicher Startwert, gleicher Verlauf (Runde ' + A.turn + ', ' + A.ending + ')');
  const C = X.cqNew('nexus', 2, 99); const D = JSON.parse(JSON.stringify(C));
  play(C, pol); play(D, pol);
  ok(JSON.stringify(C) === JSON.stringify(D), 'Feldzug nach JSON-Kopie läuft gleich weiter');
}
{
  /* Herrschaft: alle fremden Hauptwelten in Spielerhand */
  const C = X.cqNew('alliance', 2, 7);
  for (const f of ['mars', 'legion', 'nexus']) { const cap = C.sys.find(s => s.home === f); const sp = X.cqSpec(C, 'attack', cap.id); X.cqResult(C, sp, { win: true, vets: [], flagKills: 0, flagAlive: true }); }
  ok(C.over === 1 && C.ending === 'dom', 'Herrschaft nach drei eroberten Hauptwelten');
  const D = X.cqNew('mars', 2, 8); const cap = D.sys.find(s => s.home === 'mars');
  D.threats.push({ sys: cap.id, by: 'legion', pow: 30, turn: 0 }); D.turn = 2;
  X.cqFortify(D, D.sys.find(s => s.owner === 'mars' && s.type !== 'cap').id);
  ok(D.over === -1 && D.ending === 'lost', 'Niederlage, wenn die eigene Hauptwelt fällt');
  const E = X.cqNew('nexus', 2, 9); const out = X.cqDecide(E, X.CQ_TRUCE, 'a');
  ok(Object.values(E.cease).filter(v => v > 0).length === 3 && out.length === 1, 'Waffenstillstand in der Krise: alle drei nehmen an');
  E.betray.mars = 1; E.cease.mars = 0;
  const sm = E.sys.find(s => s.owner === 'mars' && s.type !== 'cap'); E.cease.legion = 5; const sl = E.sys.find(s => s.owner === 'legion' && s.type !== 'cap');
  X.cqResult(E, X.cqSpec(E, 'attack', sl.id), { win: true, vets: [], flagKills: 0, flagAlive: true });
  ok(E.betray.legion === 1 && E.rel.legion < -50 && !(E.cease.legion > 0), 'Angriff im Waffenstillstand: Verrat wird gemerkt');
  void sm;
}
/* 3. jede Schlachtart in der Simulation */
function pilot(g) {
  if (g.tick % 900) return;
  const h = g.human, t = g.tm[h], cp = us => us.reduce((a, u) => a + (u.def.cp || 1), 0);
  const mine = g.ships.filter(u => !u.dead && !u.derelict && u.owner === h && u.def.role === 'war' && u.def.wpn.length);
  const foe = g.ships.filter(u => !u.dead && !u.derelict && g.tm[u.owner] !== t && u.def.role === 'war' && !g.players[u.owner].neutral);
  const tb = g.bldgs.filter(b => !b.dead && g.tm[b.owner] !== t && !g.players[b.owner].neutral).sort((a, b) => (b.role === 'base') - (a.role === 'base'))[0];
  const tgt = tb || foe[0];
  if (tgt && (cp(mine) >= Math.max(26, cp(foe) * 1.25) || g.time > 700)) for (const u of mine) { u.task = 1; u.hold = false; u.o = { t: 'amove', x: tgt.x, y: tgt.y }; u.path = null; }
}
const C = X.cqNew('alliance', 2, 4242);
C.vets = [{ t: 'lancer', k: 8, h: '' }, { t: 'bulwark', k: 4, h: '' }];
C.flag.kills = 9;
const P = s => C.sys.find(s);
const cases = [
  ['Piraten', X.cqSpec(C, 'attack', P(s => s.owner === 'pir').id)],
  ['Mars mit Erzfeind', Object.assign(X.cqSpec(C, 'attack', P(s => s.owner === 'pir').id), { foe: 'mars', type: 'relic', gar: 2, nem: { who: 'tarn', name: 'Major Ilka Tarn', lvl: 2 } })],
  ['Brood-System', Object.assign(X.cqSpec(C, 'attack', P(s => s.owner === 'pir').id), { foe: 'brood', type: 'gate', gar: 2 })],
  ['Hauptwelt', X.cqSpec(C, 'attack', P(s => s.home === 'legion').id)],
  ['Verteidigung', Object.assign(X.cqSpec(C, 'defend', P(s => s.home === 'alliance').id, 'nexus'), { pow: 3.5, fort: 1, waves: 3 })],
  ['Haupttor', Object.assign(X.cqSpec(C, 'attack', P(s => s.type === 'core').id), { allies: ['mars'] })]
];
C.sys.push({ id: C.sys.length, name: 'Archiv der Erbauer', x: 600, y: 100, type: 'secret', owner: 'guard', gar: 3, fort: 0, log: -1, links: [] });
cases.push(['Archiv', X.cqSpec(C, 'attack', C.sys.length - 1)]);
for (const [name, sp] of cases) {
  let g, err = null;
  try {
    g = X.createGame(X.cqBattleOpts(sp)); g.players[g.human].ai = Cx.aiInit(3);
    while (!g.over && g.time < secs) { X.stepGame(g); g.ev.length = 0; pilot(g); }
  } catch (e) { err = e; }
  const R = err ? null : X.cqBattleResult(g);
  ok(!err && g.mis.goals.length >= 2 && R && Array.isArray(R.vets), name + ' (' + sp.kind + '): läuft ' + (g ? Math.round(g.time) : 0) + ' s, Ergebnis ' + (g ? g.mis.res : '-') + ', Ziele ' + (g ? g.mis.goals.map(q => q.id + ':' + q.st).join(' ') : '') + (err ? '\n' + err.stack.split('\n').slice(0, 4).join('\n') : ''));
}
/* Ergebnis zurück in den Feldzug */
{
  const D = X.cqNew('mars', 2, 31), t = X.cqTargets(D)[0], sp = X.cqSpec(D, 'attack', t);
  const g = X.createGame(X.cqBattleOpts(sp));
  for (const b of g.bldgs) if (!b.dead && b.owner === 1 && b.role === 'base') b.hull = 1;
  g.players[g.human].ai = Cx.aiInit(3);
  for (const b of g.bldgs) if (!b.dead && b.owner === 1 && b.role === 'base') { const u = g.ships.find(x => x.owner === g.human && x.def.role === 'war'); X.ctx.kill(g, b, u, g.human); }
  for (let i = 0; i < 60 && !g.over; i++) X.stepGame(g);
  const R = X.cqBattleResult(g); D.pending = sp;
  X.cqResult(D, sp, R);
  ok(R.win && D.sys[t].owner === 'mars' && !D.pending && D.turn === 2, 'gewonnene Schlacht erobert das System und beendet die Runde');
}
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
