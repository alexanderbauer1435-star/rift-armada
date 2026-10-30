'use strict';
/* Fassung 22 – Spielhilfen, Simulationsteil:
   · Warteschlange: höchstens 5 je Werft, Kommandopunkte begrenzen, Abbrechen nimmt das gewählte Schiff heraus
   · Befehl 'grally': neue Kampfschiffe treten der Gruppe bei und fliegen zu ihrer Mitte; Frachter nicht; leere Gruppe → Sammelpunkt
   · Pause mit Befehlen: mehrere Befehle im selben Takt (ohne Schritt dazwischen) laufen in der Wiederholung gleich
   node tests/play22.js */
const { loadSim } = require('./harness');
const X = loadSim(['replay.js']);
const C = X.ctx;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const OPTS = { map: 'test', seed: 7, players: [{ faction: 'alliance', human: true }, { faction: 'mars', ai: 0 }], res: { ice: 30000, ore: 20000 }, sandbox: true, pace: 'tactical' };
const step = (g, n) => { for (let i = 0; i < n && !g.over; i++) { X.stepGame(g); g.ev.length = 0; } };
const cmd = (g, c) => { c.p = c.p === undefined ? 0 : c.p; return C.issueCmd(g, c); };
const yardOf = (g, pi) => g.bldgs.find(b => !b.dead && b.owner === pi && b.role === 'yard' && b.done);

/* 1. Warteschlange */
{
  const g = X.createGame(JSON.parse(JSON.stringify(OPTS))), y = yardOf(g, 0), P = g.players[0];
  const res = []; for (let i = 0; i < 7; i++) res.push(cmd(g, { t: 'train', b: y.id, id: 'wren' }));
  ok(res.slice(0, 5).every(r => r === null) && res[5] === 'Warteschlange voll' && y.q.length === 5, 'Werft nimmt 5 an, das 6. wird abgelehnt (' + res[5] + ')');
  const ice0 = P.ice; cmd(g, { t: 'cancel', b: y.id, i: 4 });
  ok(y.q.length === 4 && P.ice > ice0, 'Abbrechen nimmt das letzte heraus und erstattet');
  for (let i = y.q.length - 1; i >= 0; i--) cmd(g, { t: 'cancel', b: y.id, i });
  P.cpMax = P.cpUse + 2;
  const r2 = []; for (let i = 0; i < 5; i++) r2.push(cmd(g, { t: 'train', b: y.id, id: 'wren' }));
  ok(y.q.length === 2 && r2[2] === 'Kommandopunkte reichen nicht', 'Kommandopunkte begrenzen die Warteschlange (' + y.q.length + ')');
}

/* 2. Sammeln bei Gruppe */
{
  const g = X.createGame(JSON.parse(JSON.stringify(OPTS))), y = yardOf(g, 0), P = g.players[0];
  ok(cmd(g, { t: 'grally', n: 9 }) !== null && !P.grally, 'ungültige Gruppe abgelehnt');
  const gx = y.x + 500, gy = y.y - 200;
  const a = X.addShip(g, 'lancer', 0, gx - 30, gy, 0), b = X.addShip(g, 'lancer', 0, gx + 30, gy, 0);
  cmd(g, { t: 'group', u: [a.id, b.id], n: 2 });
  ok(cmd(g, { t: 'grally', n: 2 }) === null && P.grally === 2, 'Befehl grally setzt die Gruppe');
  cmd(g, { t: 'rally', b: y.id, x: y.x - 300, y: y.y });
  cmd(g, { t: 'train', b: y.id, id: 'wren' }); cmd(g, { t: 'train', b: y.id, id: 'hauler' });
  let born = [];
  for (let i = 0; i < 30 * 120 && born.length < 2; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'ready' && e.owner === 0) { const u = g.byId.get(e.id); born.push(u); u._o = JSON.parse(JSON.stringify(u.o)); } g.ev.length = 0; }
  const w = born.find(u => u && u.type === 'wren'), h = born.find(u => u && u.type === 'hauler');
  ok(w && w.grp === 2 && w._o.t === 'amove', 'neues Kampfschiff tritt Gruppe 2 bei, Angriffsmarsch (' + (w && w._o.t) + ')');
  if (w) { const d = Math.hypot(w._o.ox - (a.x + b.x) / 2, w._o.oy - (a.y + b.y) / 2); ok(d < 60, 'Ziel ist die Mitte der Gruppe (Abstand ' + Math.round(d) + ')'); }
  ok(h && !h.grp && h._o.t !== 'amove', 'Frachter bleibt bei seiner Arbeit (' + (h && h._o.t) + ')');
  /* leere Gruppe → Sammelpunkt der Werft */
  cmd(g, { t: 'grally', n: 4 });
  cmd(g, { t: 'train', b: y.id, id: 'wren' });
  let w2 = null;
  for (let i = 0; i < 30 * 120 && !w2; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'ready' && e.owner === 0) w2 = g.byId.get(e.id); g.ev.length = 0; }
  ok(w2 && w2.grp === 4 && w2.o.t === 'amove' && Math.abs(w2.o.ox - (y.x - 300)) < 1, 'leere Gruppe: tritt bei, fliegt zum Sammelpunkt');
  cmd(g, { t: 'grally', n: 0 });
  cmd(g, { t: 'train', b: y.id, id: 'wren' });
  let w3 = null;
  for (let i = 0; i < 30 * 120 && !w3; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'ready' && e.owner === 0) w3 = g.byId.get(e.id); g.ev.length = 0; }
  ok(w3 && !w3.grp, 'grally 0: keine Gruppe');
}

/* 3. Pause mit Befehlen: Befehle im selben Takt, Wiederholung gleich */
{
  const g = X.createGame(JSON.parse(JSON.stringify(OPTS))), y = yardOf(g, 0);
  step(g, 300);
  const t0 = g.tick, war = g.ships.filter(u => u.owner === 0 && !u.dead && u.def.wpn.length && !u.def.cargo && !u.def.build);
  /* „Pause“: mehrere Befehle, kein Schritt dazwischen */
  cmd(g, { t: 'grally', n: 1 });
  if (war.length) cmd(g, { t: 'group', u: war.map(u => u.id), n: 1 });
  for (let i = 0; i < 5; i++) cmd(g, { t: 'train', b: y.id, id: i % 2 ? 'lancer' : 'wren' });
  if (war.length) cmd(g, { t: 'move', u: war.map(u => u.id), x: y.x + 400, y: y.y + 100, am: true, form: 'wedge' });
  ok(g.tick === t0 && g.log.length >= 14 && g.log.filter((v, i) => i % 2 === 0 && v === t0).length >= 7, 'alle Befehle tragen den Takt der Pause (' + t0 + ')');
  step(g, 30 * 60);
  step(g, 1);
  const h1 = X.stateHash(g), tEnd = g.tick;
  const r = C.rpCreate(OPTS, JSON.parse(JSON.stringify(g.log)));
  while (r.tick < tEnd) C.rpStep(r), r.ev.length = 0;
  ok(X.stateHash(r) === h1, 'Wiederholung gleich nach Pausenbefehlen (' + h1 + ')');
  ok(r.players[0].grally === 1 && r.ships.some(u => !u.dead && u.owner === 0 && u.grp === 1 && u.type === 'lancer'), 'auch in der Wiederholung treten neue Schiffe Gruppe 1 bei');
}
console.log(fails ? fails + ' FEHLER' : 'ALL OK');
process.exit(fails ? 1 : 0);
