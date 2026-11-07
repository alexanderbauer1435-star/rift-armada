'use strict';
/* Ausbildung: alle Schritte mit Befehlen wie vom Finger durchspielen; jeder Schritt muss erreichbar sein. */
const { loadSim } = require('./harness');
const X = loadSim(), C = X.ctx;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const g = X.createGame(X.misOpts('tut', 2, {}, undefined));
const pi = g.human, M = g.mis;
const own = t => g.ships.filter(u => !u.dead && u.owner === pi && (!t || u.type === t));
const cmd = c => { c.p = pi; return X.execCmd(g, c); };
const run = s => { for (let i = 0; i < s * 30 && !g.over; i++) X.stepGame(g); g.ev.length = 0; };
const seen = [];
let guard = 0;
while (!g.over && g.time < 1500 && guard++ < 400) {
  run(2);
  const cur = M.goals.find(q => q.st === 1), st = cur ? { id: cur.id } : null;
  if (!st || M.t.next) continue;
  if (seen[seen.length - 1] !== st.id) seen.push(st.id);
  if (st.id === 'move') cmd({ t: 'move', u: own('wren').map(u => u.id), x: 1050, y: 700 });
  else if (st.id === 'shoot') { const t = C.misLive(g, M.tag.t1)[0]; if (t) cmd({ t: 'attack', u: own('wren').map(u => u.id), e: t.id }); }
  else if (st.id === 'group') cmd({ t: 'move', u: C.misLive(g, M.tag.lan).map(u => u.id), x: 1350, y: 1350 });
  else if (st.id === 'amove') cmd({ t: 'move', u: own('lancer').concat(own('wren')).map(u => u.id), x: 2100, y: 1150, am: true });
  else if (st.id === 'yard' || st.id === 'reactor') {
    const b = own('pathfinder')[0], base = g.bldgs.find(x => x.owner === pi && x.role === 'base');
    if (b && b.o.t !== 'build' && !g.bldgs.some(x => !x.dead && x.owner === pi && x.role === st.id)) { for (let a = 0; a < 16; a++) { const x = base.x + Math.cos(a) * 260, y = base.y + Math.sin(a) * 260; if (!X.canPlace(g, pi, st.id, x, y)) { cmd({ t: 'build', u: [b.id], role: st.id, x, y }); break; } } }
  } else if (st.id === 'train') { const y = g.bldgs.find(x => x.owner === pi && x.role === 'yard' && x.done); if (y && !y.q.length) cmd({ t: 'train', b: y.id, id: 'lancer' }); }
  else if (st.id === 'ability') { const l = own('lancer')[0]; if (l) cmd({ t: 'ab', u: [l.id], id: 'overload' }); }
  else if (st.id === 'defend') { const t = C.misLive(g, M.tag.raid)[0]; if (t) cmd({ t: 'move', u: own().filter(u => u.def.role === 'war').map(u => u.id), x: t.x, y: t.y, am: true }); }
  if (st.id === 'group' && M.S.hl !== 'cmd:Auswahl' || st.id === 'yard' && M.S.hl !== 'item:yard') ok(false, 'Hervorhebung passt nicht: ' + M.S.hl);
}
ok(g.over && M.res === 1, 'Ausbildung bestanden in ' + Math.round(g.time) + ' s, Schritte: ' + seen.join(' → '));
ok(seen.length === 11 && seen.includes('selhow'), 'alle elf Schritte durchlaufen (mit Auswahl ändern)');
ok(M.goals.every(q => q.st === 2), 'alle Ziele erfüllt');
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
