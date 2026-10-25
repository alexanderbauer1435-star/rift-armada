'use strict';
/* Karteneditor: eigenes Layout bauen, prüfen (edCheck), als Code hin und zurück, Partie daraus rechnen, Erreichbarkeit
   aller Starts für alle drei Größenklassen, Spielstand speichern und laden (die Karte entsteht aus opts.custom neu),
   Gleichschritt (zwei Partien und eine über JSON wie im Mehrspieler gleich), Vorschau = Partie.
   node tests/editor.js */
const { loadSim } = require('./harness');
const X = loadSim(['editor.js', 'save.js']), C = X.ctx;
C.btoa = s => Buffer.from(s, 'binary').toString('base64'); C.atob = s => Buffer.from(s, 'base64').toString('binary');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
/* Vier Spieler in den Ecken, alles viermal um die Mitte gedreht (wie die Symmetrie des Editors) */
const S = 5000, c = S / 2, r10 = v => Math.round(v / 10) * 10;
const rot = (k, a, r, side) => { const t = a + k * Math.PI / 2; return [r10(c + Math.cos(t) * r - Math.sin(t) * (side || 0)), r10(c + Math.sin(t) * r + Math.cos(t) * (side || 0))]; };
const L = { v: 1, n: 'Testkarte', s: S, np: 4, st: [], ice: [], ore: [], bl: [], wl: [], ion: [], ash: [], ru: [], gs: [], gt: [], ft: [c, c] };
const A = -0.75 * Math.PI, B = -0.5 * Math.PI;   // Startachse und Achse zwischen zwei Starts
for (let k = 0; k < 4; k++) {
  L.st.push(rot(k, A, 1850));
  L.ice.push(rot(k, A, 1370, 260).concat(k % 2));
  L.ore.push(rot(k, A, 1370, -260));
  L.wl.push(rot(k, B, 1500).concat(rot(k, B, 2300)));          // Felswand zum Rand zwischen den Nachbarn
  L.bl.push(rot(k, A, 1000, -300).concat(rot(k, A, 1000, 300))); // Gürtel quer vor der Basis
  L.ion.push(rot(k, B, 1150, 380).concat(180));
  L.ash.push(rot(k, B, 900).concat(150));
  L.ru.push(rot(k, A, 800, 420));
  if (k % 2 === 0) L.gs.push(rot(k, B, 1300));
}
L.gt.push(rot(0, A, 1250, 0).concat(rot(2, A, 1250, 0)));
/* 1. Prüfung */
const probs = C.edCheck(L);
ok(probs.length === 0, 'edCheck: Testkarte ohne Probleme' + (probs.length ? ': ' + probs.map(p => JSON.stringify(p.m)).join(' | ') : ''));
/* Negativfälle: Start eingemauert, Start im Nebel, zu wenige Starts */
{
  const bad = JSON.parse(JSON.stringify(L)), s0 = bad.st[0];
  for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2; bad.wl.push([r10(s0[0] + Math.cos(a0) * 420), r10(s0[1] + Math.sin(a0) * 420), r10(s0[0] + Math.cos(a1) * 420), r10(s0[1] + Math.sin(a1) * 420)]); }
  const p = C.edCheck(bad), txt = p.map(q => JSON.stringify(q.m)).join(' ');
  ok(/kleine Schiffe nicht erreichbar/.test(txt) && /große Schiffe nicht erreichbar/.test(txt), 'eingemauerter Start: nicht erreichbar (' + p.length + ' Meldungen)');
  const neb = JSON.parse(JSON.stringify(L)); neb.ion.push([neb.st[1][0], neb.st[1][1], 300]);
  ok(C.edCheck(neb).some(q => /Gürtel oder Nebel/.test(JSON.stringify(q.m))), 'Start im Nebel wird gemeldet');
  const few = JSON.parse(JSON.stringify(L)); few.st.pop();
  ok(C.edCheck(few).some(q => /Startplätze/.test(JSON.stringify(q.m))), 'fehlender Startplatz wird gemeldet');
  const belt = JSON.parse(JSON.stringify(L)); const s1 = belt.st[1];
  for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI * 2, a1 = (k + 1) / 10 * Math.PI * 2; belt.bl.push([r10(s1[0] + Math.cos(a0) * 480), r10(s1[1] + Math.sin(a0) * 480), r10(s1[0] + Math.cos(a1) * 480), r10(s1[1] + Math.sin(a1) * 480)]); }
  const pb = C.edCheck(belt).map(q => JSON.stringify(q.m)).join(' ');
  ok(!/kleine Schiffe nicht erreichbar/.test(pb) && /mittlere Schiffe nicht erreichbar/.test(pb), 'Gürtelring: kleine Schiffe kommen durch, mittlere nicht');
}
/* 2. Code hin und zurück */
const code = C.edEncode(L), back = C.edDecode(code);
ok(/^RA1:/.test(code) && JSON.stringify(back) === JSON.stringify(C.edNorm(L)), 'Code hin und zurück gleich (' + code.length + ' Zeichen)');
ok(C.edDecode('RA1:kaputt') === null && C.edDecode('') === null, 'ungültiger Code wird abgelehnt');
const weird = C.edNorm({ s: 99999, np: 12, st: [[1e9, -5], 'x', [1]], ion: [[100, 100, 5]], ft: [1, 2, 3] });
ok(weird.s === 7000 && weird.np === 8 && weird.st.length === 1 && weird.st[0][0] === 7000 && weird.ion[0][2] === 80, 'fremdes Layout wird begrenzt');
/* 3. Vorschau (eingetragene Karte) = Partie (opts.custom) */
C.edRegister(L, 'cu_test');
const pv = X.generateMap('cu_test', 4, 11), opts = { map: 'cu_test', custom: C.edNorm(L), seed: 11, players: [{ faction: 'alliance', ai: 2 }, { faction: 'mars', ai: 2 }, { faction: 'legion', ai: 2 }, { faction: 'nexus', ai: 2 }] };
const g = X.createGame(opts);
ok(JSON.stringify(pv.rocks) === JSON.stringify(g.map.rocks) && pv.nodes.length === g.map.nodes.length && pv.sites.length === g.map.sites.length, 'Vorschau und Partie gleich (' + g.map.rocks.length + ' Felsen, ' + g.map.nodes.length + ' Vorkommen, ' + g.map.sites.length + ' Stätten, ' + g.map.gates.length + ' Tore)');
ok(g.map.name === 'Testkarte' && g.map.w === S && g.map.fort && g.pirate >= 0 && g.fort, 'Name, Größe und Piratenfestung übernommen');
ok(g.map.sites.length === L.ru.length + L.gs.length && g.map.gates.length === 2, 'alle Stätten und das Torpaar vorhanden');
/* 4. Erreichbarkeit mit findPath (Ziel wirklich erreicht) für alle drei Klassen */
{
  let bad = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (let cls = 0; cls < 3; cls++) {
    const a = g.map.starts[i], b = g.map.starts[j], p = X.findPath(g.map, cls, a.x, a.y, b.x, b.y);
    if (!p || !p.length || p[p.length - 1].x !== b.x || p[p.length - 1].y !== b.y) { bad++; console.log('     kein Weg Klasse ' + cls + ' von ' + i + ' nach ' + j); }
  }
  ok(!bad, 'findPath: alle Starts erreichbar für klein, mittel, groß');
}
/* 5. Partie rechnen, speichern, laden, weiterrechnen */
for (let i = 0; i < 30 * 90; i++) { X.stepGame(g); g.ev.length = 0; }
ok(!g.over && g.ships.filter(u => !u.dead && u.owner < 4).length > 8 && g.bldgs.filter(b => !b.dead && b.owner < 4).length > 8, '90 s gerechnet: ' + g.ships.length + ' Schiffe, ' + g.bldgs.length + ' Stationen');
const saved = JSON.parse(JSON.stringify(C.saveGame(g)));
delete X.MAPS.cu_test;   // Karte auf diesem Gerät gelöscht – der Spielstand muss sie aus opts.custom bauen
const g2 = C.loadGame(saved);
ok(!!g2 && g2.map.name === 'Testkarte' && g2.map.rocks.length === g.map.rocks.length, 'Spielstand geladen, Karte aus opts.custom');
ok(g2 && X.stateHash(g2) === X.stateHash(g), 'Prüfsumme nach dem Laden gleich');
/* Weiterspielen: geladene Wege werden neu gesucht (path = null) – darum nicht bitgleich zur durchgehenden Partie (gilt für alle
   Karten), aber die Partie läuft auf derselben Karte normal weiter */
for (let i = 0; i < 30 * 30 && g2; i++) { X.stepGame(g2); g2.ev.length = 0; }
ok(g2 && !g2.over && g2.players.slice(0, 4).every(p => p.alive) && g2.ships.filter(u => !u.dead && u.owner < 4).length > 8 && g2.fort && !g2.fort.done, 'geladene Partie läuft 30 s weiter (Festung steht)');
/* 6. Gleichschritt: zweimal dieselbe Partie, einmal mit Optionen über JSON (wie im Mehrspieler) */
{
  const a = X.createGame(opts), b = X.createGame(JSON.parse(JSON.stringify(opts)));
  let same = true;
  for (let i = 0; i < 30 * 60; i++) { X.stepGame(a); X.stepGame(b); a.ev.length = 0; b.ev.length = 0; if (i % 30 === 0 && X.stateHash(a) !== X.stateHash(b)) { same = false; break; } }
  ok(same, 'Gleichschritt mit eigener Karte (60 s)');
}
/* 7. Vorlage für jede Spielerzahl ohne Probleme */
{
  const bad = [];
  for (let np = 2; np <= 8; np++) { const p = C.edCheck(X.ctx.customDefault(np)); if (p.length) bad.push(np + ': ' + p.map(q => JSON.stringify(q.m)).join(' | ')); }
  ok(!bad.length, 'Vorlage 2–8 Spieler ohne Probleme' + (bad.length ? ' – ' + bad.join(' ; ') : ''));
}
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
