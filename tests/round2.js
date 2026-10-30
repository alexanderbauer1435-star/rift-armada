'use strict';
/* Runde-2-Test: Subsysteme, Entern, Fähigkeiten, Doktrinen, Flaggschiffe, Superwaffen – jede Funktion einmal in
   einer kontrollierten Lage auslösen und das Ergebnis prüfen. Beendet mit Code 1, wenn etwas fehlschlägt. */
const { loadSim } = require('./harness');
const X = loadSim();
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (g, secs, fn) => { const t1 = g.time + secs; while (g.time < t1 && !g.over) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
const mk = (opts) => X.createGame(Object.assign({ map: 'test', seed: 3, pace: 'fast', players: [{ faction: 'alliance', ai: 0 }, { faction: 'mars', ai: 0 }] }, opts));
const cx = g => g.map.w / 2, cy = g => g.map.h / 2;
const ship = (g, type, pi, x, y, ang) => X.addShip(g, type, pi, x, y, ang || 0);

/* 1. Subsysteme anvisieren: Antrieb des Ziels sinkt stärker als andere Subsysteme, Ziel wird langsamer */
{
  const g = mk({});
  const t = ship(g, 'hammer', 1, cx(g) + 200, cy(g), Math.PI), a = ship(g, 'lancer', 0, cx(g), cy(g), 0), b = ship(g, 'lancer', 0, cx(g), cy(g) + 400, 0); b.stance = 2;
  t.stance = 2; t.o = { t: 'hold' };
  a.stance = 1; /* ohne Flankenmanöver: stehen bleiben und feuern */
  X.execCmd(g, { p: 0, t: 'attack', u: [a.id], e: t.id, sub: 'drive' });
  run(g, 10);
  ok(t.sub.drive < 0.9 && t.sub.drive < Math.min(t.sub.wpn, t.sub.sensor, t.sub.life), 'Subsystem-Ziel Antrieb beschädigt: drive=' + t.sub.drive.toFixed(2) + ' wpn=' + t.sub.wpn.toFixed(2));
  ok(t.hull > 0 && t.hull < t.hullMax, 'Hülle nimmt weiterhin Schaden');
  /* Selbstreparatur */
  X.removeShip(g, a); X.removeShip(g, b);
  const d0 = t.sub.drive; run(g, 20);
  ok(t.sub.drive > d0 + 0.1, 'Selbstreparatur: ' + d0.toFixed(2) + ' → ' + t.sub.drive.toFixed(2));
}
/* 2. Crew und Wrack: Lebenserhaltung zerstört → Crew schwindet → Wrack; Bauschiff besetzt neu */
{
  const g = mk({});
  const t = ship(g, 'lancer', 0, cx(g), cy(g), 0);
  t.sub.life = 0; t.shield = 0;
  run(g, 60);
  ok(t.derelict, 'Schiff ohne Lebenserhaltung wird zum Wrack (crew=' + Math.round(t.crew) + ')');
  const bld = ship(g, 'pathfinder', 0, cx(g) + 300, cy(g), 0);
  X.execCmd(g, { p: 0, t: 'move', u: [bld.id], x: t.x + 40, y: t.y });
  run(g, 25);
  ok(!t.derelict && t.crew > 0, 'Bauschiff besetzt das Wrack neu (crew=' + Math.round(t.crew) + ')');
}
/* 3. Entern: Boarder gegen Lancer mit geschwächter Crew → Besitzerwechsel */
{
  const g = mk({});
  const t = ship(g, 'lancer', 0, cx(g), cy(g), 0); t.stance = 2; t.crew = 20; t.shield = 0;
  const b1 = ship(g, 'boarder', 1, cx(g) + 150, cy(g), Math.PI), b2 = ship(g, 'boarder', 1, cx(g) + 150, cy(g) + 40, Math.PI);
  b1.auto = b2.auto = false;
  const cp0 = g.players[1].shipCount;
  ok(!X.execCmd(g, { p: 1, t: 'board', u: [b1.id, b2.id], e: t.id }), 'Enterbefehl angenommen');
  let captured = false;
  run(g, 40, g => { for (const e of g.ev) if (e.t === 'captured') captured = true; });
  ok(captured && t.owner === 1, 'Entern: Lancer gehört jetzt Mars (owner=' + t.owner + ', crew=' + Math.round(t.crew) + ')');
  ok(g.players[1].shipCount === cp0 + t.def.cp, 'Kommandopunkte nach Übernahme stimmen');
  ok(b1.marines < 40, 'Marines übergesetzt (' + Math.round(b1.marines) + ' an Bord)');
}
/* 4. Fähigkeiten: jede einmal zünden */
{
  const g = mk({});
  const P = g.players;
  const w = ship(g, 'wren', 0, cx(g), cy(g), 0); w.auto = false;
  ok(!X.cmdAbility(g, 0, [w.id], 'pulse'), 'Sensorimpuls zündet');
  ok(g.reveals.length === 1 && X.cmdAbility(g, 0, [w.id], 'pulse') === 'Nicht bereit', 'Impuls: Aufdeckung aktiv, zweiter Einsatz gesperrt');
  const l = ship(g, 'lancer', 0, cx(g) - 100, cy(g), 0); l.auto = false;
  ok(!X.cmdAbility(g, 0, [l.id], 'overload') && l.abT.overload > 0, 'Lanzenüberladung aktiv');
  run(g, 6.5); ok(l.dis > 0, 'Nach der Überladung Waffen kurz aus (dis=' + l.dis.toFixed(1) + ')');
  const bw = ship(g, 'bulwark', 0, cx(g) - 200, cy(g), 0); bw.auto = false; l.shield = 0;
  X.cmdAbility(g, 0, [bw.id], 'surge'); ok(l.shield > l.shieldMax * 0.2, 'Schildstoß lädt Nachbarschild (' + Math.round(l.shield) + ')');
  const hv = ship(g, 'haven', 0, cx(g) - 300, cy(g), 0); hv.auto = false;
  ok(!X.cmdAbility(g, 0, [hv.id], 'resupply') && hv.hangar.n === 6, 'Nachschub: 6 Jäger sofort');
  const pf = ship(g, 'pathfinder', 0, cx(g) - 60, cy(g) + 80, 0); pf.auto = false; l.hull = l.hullMax * 0.3;
  X.cmdAbility(g, 0, [pf.id], 'repair'); const h0 = l.hull; run(g, 5); ok(l.hull > h0 + l.hullMax * 0.1, 'Notreparatur heilt (' + Math.round(h0) + ' → ' + Math.round(l.hull) + ')');
  const nd = ship(g, 'needle', 1, cx(g) + 600, cy(g), Math.PI); nd.auto = false; const c0 = nd.crew;
  X.cmdAbility(g, 1, [nd.id], 'grush'); run(g, 5); ok(nd.crew < c0, 'G-Rausch kostet Crew (' + c0 + ' → ' + Math.round(nd.crew) + ')');
  const hh = ship(g, 'hedgehog', 1, cx(g) + 650, cy(g), Math.PI); hh.auto = false;
  ok(!X.cmdAbility(g, 1, [hh.id], 'flak') && hh.abT.flak > 0, 'Sperrfeuer aktiv');
  const sp = ship(g, 'spear', 1, cx(g) + 700, cy(g), Math.PI); sp.auto = false;
  ok(!X.cmdAbility(g, 1, [sp.id], 'pierce') && sp.abT.pierce > 0, 'Durchschlag geladen');
  const hm = ship(g, 'hammer', 1, cx(g) + 760, cy(g), Math.PI); hm.auto = false;
  ok(!X.cmdAbility(g, 1, [hm.id], 'broadside') && hm.abT.broadside > 0, 'Breitseite aktiv');
  /* Aegis-Kuppel halbiert Schaden */
  const ag = ship(g, 'aegis', 0, cx(g) - 700, cy(g), 0); ag.auto = false; P[0].doctrine = 'charter'; X.recalcTech(g, P[0]);
  X.cmdAbility(g, 0, [ag.id], 'dome'); ok(ag.dome > 0 && bw.dome === 0, 'Schildkuppel auf Aegis, Bulwark außerhalb');
}
/* 5. Flaggschiffe: nur eines, Doktrin gibt vierte Fähigkeit */
{
  const g = mk({});
  const y = X.addBldg(g, 'yard', 0, cx(g) - 400, cy(g) - 300, true); y.lv = 3; const lab = X.addBldg(g, 'lab', 0, cx(g) - 600, cy(g) - 300, true); lab.lv = 2;
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base');
  g.players[0].ice = 9999; g.players[0].ore = 9999;
  ok(!X.trainReq(g, 0, 'archipelago'), 'Archipelago baubar: ' + X.trainReq(g, 0, 'archipelago'));
  const fs = ship(g, 'archipelago', 0, cx(g), cy(g), 0); fs.auto = false;
  ok(X.trainReq(g, 0, 'archipelago') === 'Nur ein Flaggschiff', 'Zweites Flaggschiff gesperrt');
  ok(X.shipAbils(g, fs).length === 3, 'Flaggschiff ohne Doktrin: 3 Fähigkeiten (Fassung 22: mit Flottenbefehl)');
  base.lv = 2; X.finishUpgrade && 0;
  ok(X.cmdDoctrine(g, 0, 'hardline') === null && g.players[0].doctrine === 'hardline', 'Doktrin Hardliners gewählt');
  ok(X.cmdDoctrine(g, 0, 'charter') === 'Doktrin schon gewählt', 'Doktrin endgültig');
  ok(X.shipAbils(g, fs).indexOf('lance') >= 0, 'Flaggschiff bekommt Lanzenschlag aus der Doktrin');
  ok(Math.abs(g.players[0].tfx.beam - 1.3) < 1e-9, 'Doktrin-Bonus Strahlen +30 %');
  ok(X.trainReq(g, 0, 'reckoning') === null && X.trainReq(g, 0, 'aegis') !== null, 'Doktrin-Schiff Reckoning frei, Aegis gesperrt');
  const foe = ship(g, 'spear', 1, cx(g) + 300, cy(g), Math.PI); foe.stance = 2; run(g, 1); const h0 = foe.hull;
  fs.auto = false; ok(!X.cmdAbility(g, 0, [fs.id], 'lance') && foe.hull < h0 - 300, 'Lanzenschlag trifft (' + Math.round(h0 - foe.hull) + ' Schaden)');
  /* Truce */
  const foe2 = ship(g, 'spear', 1, cx(g) + 280, cy(g) + 60, Math.PI); foe2.stance = 2; run(g, 1); foe2.stance = 0; foe2.o = { t: 'attack', tid: fs.id, x: fs.x, y: fs.y }; fs.stance = 2;
  X.cmdAbility(g, 0, [fs.id], 'truce'); run(g, 2); ok(foe2.truce > 0 && !foe2.dead && fs.hull === fs.hullMax, 'Waffenstillstand: Gegner feuert nicht');
  /* Olympus mark */
  const ol = ship(g, 'olympus', 1, cx(g) + 300, cy(g) + 300, Math.PI); ol.auto = false; run(g, 1);
  ok(!X.cmdAbility(g, 1, [ol.id], 'mark') && fs.marked > g.time, 'Zielmarkierung auf Archipelago');
}
/* 6. Superwaffen: Exodus-Tor versetzt, Massetreiber trifft */
{
  const g = mk({});
  g.players[0].ice = g.players[0].ore = g.players[1].ice = g.players[1].ore = 9999;
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base'); base.lv = 3;
  const lab = X.addBldg(g, 'lab', 0, base.x + 200, base.y + 200, true); lab.lv = 2;
  ok(X.buildReq(g, 0, 'super') === null, 'Exodus-Tor baubar mit Basis III und Labor II: ' + X.buildReq(g, 0, 'super'));
  const base1 = g.bldgs.find(b => b.owner === 1 && b.role === 'base');
  ok(X.buildReq(g, 1, 'super') !== null, 'Massetreiber ohne Voraussetzungen gesperrt: ' + X.buildReq(g, 1, 'super'));
  const gate = X.addBldg(g, 'super', 0, base.x - 200, base.y, true);
  const u1 = ship(g, 'lancer', 0, gate.x + 60, gate.y, 0), u2 = ship(g, 'lancer', 0, gate.x - 60, gate.y, 0), far = ship(g, 'lancer', 0, gate.x + 900, gate.y, 0);
  ok(X.cmdSuper(g, 0, cx(g), cy(g)) === 'Superwaffe noch nicht bereit', 'Tor muss erst laden');
  gate.charge = 1;
  ok(X.cmdSuper(g, 0, cx(g), cy(g)) === null && Math.hypot(u1.x - cx(g), u1.y - cy(g)) < 150 && Math.hypot(far.x - gate.x, 0) > 800, 'Exodus: Schiffe am Tor versetzt, fernes nicht');
  ok(gate.charge === 0, 'Tor entladen');
  const md = X.addBldg(g, 'super', 1, base1.x - 200, base1.y, true); md.charge = 1;
  const tgt = ship(g, 'bulwark', 0, cx(g) + 300, cy(g) + 300, 0); tgt.stance = 2; const h0 = tgt.hull + tgt.shield;
  ok(X.cmdSuper(g, 1, tgt.x, tgt.y) === null && g.strikes.length === 1, 'Massetreiber abgefeuert');
  let struck = false; run(g, 5, g => { for (const e of g.ev) if (e.t === 'strike') struck = true; });
  ok(struck && (tgt.dead || tgt.hull + tgt.shield < h0 - 1000), 'Einschlag: Bulwark schwer getroffen (dead=' + tgt.dead + ')');
  /* Laden */
  run(g, 30); ok(md.charge > 0.1 && md.charge < 0.3, 'Massetreiber lädt (' + md.charge.toFixed(2) + ')');
}
/* 7. KI-Partie mit allem auf Schwer: läuft ohne Fehler, Doktrin wird gewählt */
{
  const g = X.createGame({ map: 'haven', seed: 5, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }] });
  let abil = 0, docs = 0, supers = 0, boards = 0;
  run(g, 900, g => { for (const e of g.ev) { if (e.t === 'ability') abil++; if (e.t === 'doctrineSet') docs++; if (e.t === 'superfire') supers++; if (e.t === 'board') boards++; } });
  console.log('   KI-Partie: abilities', abil, 'doctrines', docs, 'super', supers, 'boards', boards, 'time', Math.round(g.time), 'winner', g.winner);
  ok(abil > 10, 'KI setzt Fähigkeiten ein');
  ok(docs >= 1 || g.over, 'KI wählt Doktrin');
  /* Determinismus mit Runde-2-Inhalt */
  const g2 = X.createGame({ map: 'haven', seed: 5, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }] });
  run(g2, Math.min(900, g.time)); ok(X.stateHash(g) === X.stateHash(g2), 'Determinismus mit Runde-2-Inhalt');
}
console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
