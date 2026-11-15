'use strict';
/* Einsätze (Fassung 27): jeder Einsatz startet, läuft ohne Fehler und endet. Ohne Befehle des Spielers geht er nicht mit
   drei Sternen aus; mit einfacher Steuerung (eigene Missionshilfe oder »nächsten Feind angreifen«) ist er zu gewinnen,
   und er dauert höchstens elf Minuten. Gleicher Start → gleicher Verlauf. node tests/sorties.js [id] */
const { loadSim } = require('./harness');
const X = loadSim(), C = X.ctx;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const only = process.argv[2];
function attackNearest(g) {
  const h = g.human, t = g.tm[h];
  for (const u of g.ships) {
    if (u.dead || u.owner !== h || !u.def.wpn.length || u.convoy || (u.o.t !== 'idle' && u.o.t !== 'hold')) continue;
    let best = null, bd = 1e9;
    for (const e of g.ships) if (!e.dead && !e.derelict && g.tm[e.owner] !== t && e.def.role !== 'fighter') { const d = X.hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
    if (best) { u.hold = false; u.o = { t: 'amove', x: best.x, y: best.y }; u.path = null; }
  }
}
function run(id, mode) {
  const def = X.MISSIONS[id], g = X.createGame(X.misOpts(id, 2, {}, def.f));
  let radios = 0;
  while (!g.over && g.time < 720) {
    X.stepGame(g);
    for (const e of g.ev) if (e.t === 'radio') radios++;
    g.ev.length = 0;
    if (mode && g.tick % 30 === 0) { if (def.auto) def.auto(g, g.mis); else attackNearest(g); }
  }
  const own = g.ships.filter(u => !u.dead && u.owner === g.human).length;
  return { g, res: g.mis.res, t: Math.round(g.time), stars: X.sortieStars(g), radios, own, why: g.mis.why, goals: g.mis.goals.map(q => q.id + ':' + q.st + (q.n ? '(' + q.v + '/' + q.n + ')' : '')).join(' '), hash: X.stateHash(g) };
}
for (const id of X.SORTIES.filter(i => !only || i === only)) {
  const def = X.MISSIONS[id];
  let a, b, c;
  try { a = run(id, 0); b = run(id, 1); c = run(id, 1); } catch (e) { ok(false, id + ' läuft: ' + e.stack.split('\n').slice(0, 5).join('\n')); continue; }
  ok(def.tease && def.mins && X.misGoalDefs(a.g).filter(d => d.side).length === 2, id + ' ' + def.name + ': Kartentext, Dauer und genau zwei Nebenziele');
  ok(a.stars < 3 && a.radios > 0, id + ' ohne Befehle: Ergebnis ' + a.res + ' nach ' + a.t + ' s, Sterne ' + a.stars + (a.why ? ' (' + a.why + ')' : '') + ' | ' + a.goals);
  ok(b.res === 1 && b.t <= 660, id + ' mit einfacher Steuerung: Ergebnis ' + b.res + ' nach ' + b.t + ' s, Sterne ' + b.stars + ', eigene Schiffe ' + b.own + (b.why ? ' (' + b.why + ')' : '') + ' | ' + b.goals);
  ok(b.hash === c.hash, id + ' gleicher Verlauf bei gleichem Start');
}
/* Tageseinsatz: Erschwernisse (Fassung 28) */
if (!only) for (const id of ['e1', 'e3', 'e6']) {
  const def = X.MISSIONS[id], n = X.createGame(X.misOpts(id, 2, {}, def.f)), m = X.createGame(X.misOpts(id, 2, {}, def.f, { mut: 'both', day: 1 }));
  for (let i = 0; i < 40; i++) { X.stepGame(n); X.stepGame(m); }
  const own = g => g.ships.filter(u => !u.dead && u.owner === g.human && !u.convoy && u.def.role !== 'fighter').length, foe = g => g.ships.find(u => u.owner === 1 && !u.dead);
  ok(own(m) === own(n) - 1 && Math.abs(foe(m).hullMax / foe(n).hullMax - 1.3) < 0.01 && m.opts.sdaily === 1 && m.mis.mut === 'both', id + ' Tageseinsatz »both«: ein Schiff weniger (' + own(n) + ' → ' + own(m) + '), Gegner 30 % zäher');
  if (id === 'e6') ok(m.ships.filter(u => u.type === 'catapult' && !u.dead).length === 3, 'e6 »lean« lässt die Catapults stehen');
}
console.log(fails ? 'FAILURES ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
