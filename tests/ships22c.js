/* Fassung 22: Nachrüsten an der Werft und Flottenbefehle der Flaggschiffe */
'use strict';
const vm = require('vm');
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
const K = n => vm.runInContext(n, C);
const REFIT = K('REFIT'), FCMD = K('FCMD');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); g.ev.length = 0; } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b));
/* leere Testkarte: eine Werft (Stufe lv) bei (1000,1000), keine Schiffe, keine Stätten */
function bare(f, lv, f2) {
  const g = X.createGame({ map: 'test', seed: 5, pace: 'fast', players: [{ faction: f, ai: 0 }, { faction: f2 || 'mars', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  const y = X.addBldg(g, 'yard', 0, 1000, 1000, true);
  if (lv > 1) { y.lv = lv; const l = C.lvOf(y); y.hull = y.hullMax = l.hull; }
  C.recalcPower(g, 0); C.recalcCp(g, 0);
  const p = g.players[0]; p.ice = 20000; p.ore = 20000;
  return { g, y, p };
}

/* ---------- 1. Nachrüsten: Kosten, Werte, Grenzen */
{
  const { g, y, p } = bare('alliance', 1);
  const u = X.addShip(g, 'lancer', 0, 1000 + y.def.r + 100, 1000, 0);
  const far = X.addShip(g, 'lancer', 0, 2400, 1000, 0);
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [far.id], id: 'drive' }) === 'Nur nahe einer eigenen Werft', 'fern der Werft: abgelehnt');
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'wpn' }) === 'Benötigt Werft Stufe II', 'Waffen brauchen Werft II');
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'armor' }) === 'Benötigt Werft Stufe II', 'Panzerung braucht Werft II');
  const ice0 = p.ice, ore0 = p.ore, cst = C.refitCost(p, u, 'drive');
  ok(cst.ice === Math.round(u.def.cost.ice * 0.2) && cst.ore === Math.round(u.def.cost.ore * 0.2), 'Kosten Antrieb = 20 % des Schiffs (' + cst.ice + ' / ' + cst.ore + ')');
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'drive' }) === null && u.rfq && u.rfq.id === 'drive', 'Antrieb nachrüsten gestartet');
  ok(p.ice === ice0 - cst.ice && p.ore === ore0 - cst.ore, 'bezahlt');
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'sensor' }) === 'Nachrüstung läuft schon', 'zweite gleichzeitig abgelehnt');
  const T = C.refitTime(u.def);
  ok(T >= 12 && T <= 30, 'Dauer ' + T + ' s');
  step(g, T * 0.5);
  ok(u.rfq && u.rfq.prog > 0.4 && u.rfq.prog < 0.6, 'Fortschritt nach halber Zeit ' + Math.round(u.rfq.prog * 100) + ' %');
  /* wegfliegen: Fortschritt ruht */
  u.x = 2200; u.hx = 2200; const pr = u.rfq.prog; step(g, 3);
  ok(u.rfq && u.rfq.away === 1 && near(u.rfq.prog, pr), 'außer Reichweite: Fortschritt ruht');
  u.x = 1000 + y.def.r + 100; u.hx = u.x; u.y = 1000; u.hy = 1000; X.execCmd(g, { t: 'stop', p: 0, u: [u.id] });
  step(g, T * 0.6 + 1);
  ok(!u.rfq && u.rf && u.rf[0] === 'drive' && near(u.rfS, 1.12), 'Antrieb fertig: Tempo ×1,12');
  /* Tempo messen */
  const top = (sh) => { sh.x = 1000; sh.y = 2000; sh.v = 0; sh.ang = 0; X.execCmd(g, { t: 'move', p: 0, u: [sh.id], x: 3000, y: 2000 }); let mx = 0; for (let i = 0; i < 200; i++) { X.stepGame(g); g.ev.length = 0; mx = Math.max(mx, sh.v); } return mx; };
  const v1 = top(u), v0 = top(far);
  ok(v1 > v0 * 1.08, 'nachgerüstet schneller: ' + Math.round(v1) + ' gegen ' + Math.round(v0));
  /* Sensoren, dann Grenze */
  u.x = 1000 + y.def.r + 100; u.y = 1000; X.execCmd(g, { t: 'stop', p: 0, u: [u.id] }); step(g, 1); u.x = 1000 + y.def.r + 100; u.y = 1000; u.v = 0;
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'drive' }) === 'Schon nachgerüstet', 'gleiche Art zweimal abgelehnt');
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'sensor' }) === null, 'Sensoren gestartet');
  step(g, T + 1);
  ok(u.rf.length === 2 && near(u.rfV, 1.2), 'Sensoren fertig: ×1,2');
  y.lv = 2;
  ok(X.execCmd(g, { t: 'refit', p: 0, u: [u.id], id: 'wpn' }) === 'Höchstens zwei Nachrüstungen je Schiff', 'höchstens zwei je Schiff');
  /* Abbruch erstattet */
  const w = X.addShip(g, 'lancer', 0, 1000, 1000 + y.def.r + 80, 0); const i1 = p.ice;
  X.execCmd(g, { t: 'refit', p: 0, u: [w.id], id: 'wpn' }); ok(p.ice < i1, 'Waffen an Werft II gestartet');
  X.execCmd(g, { t: 'refitCancel', p: 0, u: [w.id] }); ok(!w.rfq && p.ice === i1, 'Abbruch erstattet alles');
  /* Werft zerstört: Abbruch mit Erstattung */
  X.execCmd(g, { t: 'refit', p: 0, u: [w.id], id: 'armor' }); const i2 = p.ice; C.removeBldg(g, y); step(g, 1);
  ok(!w.rfq && p.ice > i2 && !(w.rf && w.rf.length), 'Werft weg: Nachrüstung abgebrochen und erstattet');
}
/* ---------- 2. Panzerung und Waffen: Werte und Schaden */
{
  const { g, y, p } = bare('mars', 2);
  const a = X.addShip(g, 'hammer', 0, 1000 + y.def.r + 60, 1000, 0), b = X.addShip(g, 'hammer', 0, 1000 - y.def.r - 60, 1000, 0);
  const h0 = a.hullMax, ar0 = a.armorPlus || 0;
  ok(C.refitCost(p, a, 'armor').ice === Math.round(a.def.cost.ice * 0.22) && C.refitCost(p, a, 'wpn').ice === Math.round(a.def.cost.ice * 0.25), 'Kosten Panzerung 22 %, Waffen 25 %');
  X.execCmd(g, { t: 'refit', p: 0, u: [a.id], id: 'armor' }); X.execCmd(g, { t: 'refit', p: 0, u: [b.id], id: 'wpn' });
  step(g, C.refitTime(a.def) + 1);
  ok(near(a.hullMax, h0 * 1.15, 1e-6) && a.armorPlus === ar0 + 1, 'Panzerung: Hülle ' + Math.round(h0) + ' → ' + Math.round(a.hullMax) + ', Panzerung +1');
  ok(near(b.rfD, 1.12), 'Waffen: Schaden ×1,12');
  /* Forschung zieht die Hülle neu: Nachrüstung bleibt */
  p.tech.hull = 1; X.recalcTech(g, p);
  ok(near(a.hullMax, a.def.hull * 1.15 * 1.15, 1e-6), 'Hüllenforschung danach: ×1,15 × 1,15 = ' + Math.round(a.hullMax));
  /* Waffenschaden messen: gleicher Schuss mit und ohne Nachrüstung */
  const tgt = (id) => { const e = X.addShip(g, 'olympus', 1, 3000, 3000, 0); e.armorPlus = 0; return e; };
  const shot = (s) => { const e = tgt(); const h = e.hull; const w = s.def.wpn.find(q => q.kind === 'kin' && !q.art); const i = s.def.wpn.indexOf(w); s.x = e.x - 150; s.y = e.y; C.fireWeapon(g, s, i, w, e); for (let k = 0; k < 60; k++) C.updateProj(g, 1 / 30); const d = h - e.hull; C.removeShip(g, e); return d; };
  const plain = X.addShip(g, 'hammer', 0, 500, 500, 0);
  const d1 = shot(b), d0 = shot(plain);
  ok(d0 > 0 && near(d1 / d0, 1.12, 0.03), 'Treffer mit Waffen-Nachrüstung ' + d1.toFixed(1) + ' gegen ' + d0.toFixed(1));
  /* Spielstand: Nachrüstungen und laufende Nachrüstung bleiben erhalten */
  const c = X.addShip(g, 'hammer', 0, 1000, 1000 + y.def.r + 60, 0); X.execCmd(g, { t: 'refit', p: 0, u: [c.id], id: 'drive' }); step(g, 3);
  const L = require('./harness.js').loadSim(['save.js']);
  const sv = JSON.parse(JSON.stringify(vm.runInContext('saveGame', L.ctx)(g)));
  const g2 = vm.runInContext('loadGame', L.ctx)(sv);
  const a2 = g2 && g2.byId.get(a.id), b2 = g2 && g2.byId.get(b.id), c2 = g2 && g2.byId.get(c.id);
  ok(a2 && a2.rf.join() === 'armor' && near(a2.hullMax, a.hullMax) && a2.armorPlus === a.armorPlus, 'Laden: Panzerung erhalten');
  ok(b2 && near(b2.rfD, 1.12) && c2 && c2.rfq && near(c2.rfq.prog, c.rfq.prog), 'Laden: Waffen und laufende Nachrüstung erhalten');
  for (let i = 0; i < 300; i++) { X.stepGame(g); g.ev.length = 0; L.stepGame(g2); g2.ev.length = 0; }
  ok(X.stateHash(g) === L.stateHash(g2) && !c2.rfq && c2.rf[0] === 'drive', 'Laden: läuft gleich weiter, Nachrüstung wird fertig');
}
/* ---------- 3. Flottenbefehle */
const FLAG = {}; for (const id in X.SHIPS) { const d = X.SHIPS[id]; if (d.flag) FLAG[d.f] = id; }
for (const f of ['alliance', 'mars', 'legion', 'nexus', 'brood']) {
  const { g, p } = bare(f, 1);
  const ab = FCMD[f].ab, fl = X.addShip(g, FLAG[f], 0, 1500, 1500, 0);
  ok(X.shipAbils(g, fl).indexOf(ab) >= 0, f + ': Flaggschiff hat ' + X.ABIL[ab].name);
  const war = Object.values(X.SHIPS).filter(d => d.f === f && d.role === 'war' && !d.flag && !d.hidden && !d.doc && d.wpn.length && !d.art);
  const fleet = []; for (let i = 0; i < 6; i++) fleet.push(X.addShip(g, war[i % war.length].id, 0, 1500 + 120 * Math.cos(i), 1500 + 300 + 60 * i, 0));
  const out = X.addShip(g, war[0].id, 0, 1500 + 900, 1500, 0);   /* außerhalb 700 */
  const foe = X.addShip(g, 'hammer', 1, 1500 + 400, 1500, 0);
  step(g, 0.6);
  ok(fleet.every(u => u.faT > g.time === (Math.hypot(u.x - fl.x, u.y - fl.y) <= 400)) && !(out.faT > g.time) && !(foe.faT > g.time), f + ': Aura nur bei eigenen Schiffen im Umkreis 400');
  ok(X.execCmd(g, { t: 'ab', p: 0, u: [fl.id], id: ab }) === null, f + ': Befehl gegeben');
  ok(fleet.every(u => u.fcT > 14 && u.fc === f) && fl.fcT > 14 && !(out.fcT > 0) && !(foe.fcT > 0), f + ': alle eigenen im Umkreis 700 gepuffert, ferne und Feinde nicht');
  ok(fl.abcd[ab] > 85, f + ': Abklingzeit ' + Math.round(fl.abcd[ab]) + ' s');
  const u0 = fleet[0];
  if (f === 'alliance') ok(near(C.fcMul(g, u0, 'sreg'), 2 * (u0.faT > g.time ? 1.25 : 1)), 'alliance: Schildladung ×2');
  if (f === 'mars') { const w = u0.def.wpn.find(q => q.kind === 'kin' || q.kind === 'rail'); ok(near(C.shipMul22(g, u0, w), 1.2 * (u0.faT > g.time ? 1.06 : 1)), 'mars: Kanonen und Railguns ×1,2'); }
  if (f === 'legion' || f === 'nexus') { const w = u0.def.wpn.find(q => q.kind === 'beam'); ok(w && near(C.shipMul22(g, u0, w), FCMD[f].cmd.beam * (u0.faT > g.time ? 1.06 : 1)), f + ': Strahlen ×' + FCMD[f].cmd.beam); }
  if (f === 'brood') { ok(near(C.fcMul(g, u0, 'speed'), 1.2) && near(C.fcMul(g, u0, 'dmg'), 1.15), 'brood: Tempo ×1,2, Schaden ×1,15'); const h = u0.hullMax * 0.5; u0.hull = h; u0.def.regen = 0; step(g, 2); ok(u0.hull > h + u0.hullMax * 0.015, 'brood: heilt ' + ((u0.hull - h) / u0.hullMax * 100).toFixed(1) + ' % in 2 s'); delete u0.def.regen; }
  if (f === 'alliance') {
    /* Treffer wird geteilt: Ziel nimmt weniger, Nachbarn nehmen mit */
    const a = fleet[2], hs = fleet.filter(u => u !== a).map(u => u.hull + u.shield), h0 = a.hull + a.shield;
    C.damage(g, a, 200, 'kin', foe, 1, foe.x, foe.y);
    const lost = h0 - (a.hull + a.shield), others = fleet.filter(u => u !== a).reduce((s, u, i) => s + hs[i] - (u.hull + u.shield), 0);
    ok(others > 0 && lost > 0 && lost < 200, 'alliance: Treffer geteilt (Ziel ' + lost.toFixed(0) + ', Nachbarn ' + others.toFixed(0) + ')');
  }
  if (f === 'nexus') {
    const a = fleet[2]; a.shield = 0; const sh = fleet.filter(u => u !== a).reduce((s, u) => s + u.shield, 0), h0 = a.hull;
    C.damage(g, a, 100, 'beam', foe, 1, foe.x, foe.y);
    const sh1 = fleet.filter(u => u !== a).reduce((s, u) => s + u.shield, 0);
    ok(sh1 < sh && a.hull > h0 - 1, 'nexus: Nachbarschilde springen ein (Hülle unverletzt, Schilde −' + (sh - sh1).toFixed(0) + ')');
  }
  if (f === 'legion') {
    const hero = fleet.find(u => u.def.hero) || fl;
    ok(hero.fcG > g.time, 'legion: Heldenschutz aktiv');
    C.damage(g, hero, 1e6, 'beam', foe, 1, foe.x, foe.y, null, true);
    ok(!hero.dead && hero.hull >= 1, 'legion: Held fällt nicht unter 1 Hülle');
    step(g, 5.5); hero.hull = 50; C.damage(g, hero, 1e6, 'beam', foe, 1, foe.x, foe.y, null, true);
    ok(hero.dead || hero.hull <= 0 || hero.dormant || hero.derelict, 'legion: nach 5 s wieder verwundbar');
  }
  /* Ablauf */
  step(g, 16);
  ok(fleet.filter(u => !u.dead).every(u => !(u.fcT > 0)) && near(C.fcMul(g, fleet[1], 'nothing'), 1), f + ': Befehl nach 15 s abgelaufen');
  /* Aura endet mit dem Flaggschiff */
  C.removeShip(g, fl); step(g, 1.5);
  ok(fleet.filter(u => !u.dead).every(u => !(u.faT > g.time)), f + ': Aura endet mit dem Flaggschiff');
}
/* ---------- 4. KI setzt den Befehl ein, wenn sie mit mindestens sechs Schiffen kämpft */
{
  const g = X.createGame({ map: 'test', seed: 5, pace: 'fast', players: [{ faction: 'mars', ai: 3 }, { faction: 'alliance', ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); g.sites.length = 0; g.gates.length = 0; for (const p of g.players) p.nob = true;
  const fl = X.addShip(g, 'olympus', 0, 1500, 1500, 0); for (let i = 0; i < 5; i++) X.addShip(g, 'hammer', 0, 1400, 1300 + i * 90, 0);
  for (let i = 0; i < 3; i++) X.addShip(g, 'lancer', 1, 1950, 1400 + i * 100, Math.PI);
  g.reveals.push({ x: 1800, y: 1500, r: 900, owner: 0, until: 1e9 });
  let used = false; const end = g.time + 10; while (g.time < end) { X.stepGame(g); for (const e of g.ev) if (e.t === 'ability' && e.id === 'fcBroad') used = true; g.ev.length = 0; }
  ok(used, 'KI: Olympus gibt »Breitseite« mit sechs Schiffen im Gefecht');
}
/* ---------- 5. KI rüstet große Schiffe nach, wenn sie reich ist */
{
  const { g, y } = bare('alliance', 2);
  g.players[0].ai = C.aiInit(3); const P = g.players[0]; P.ice = 9000; P.ore = 9000;
  const big = X.addShip(g, 'archipelago', 0, 1000 + y.def.r + 80, 1000, 0); big.o = { t: 'idle' };
  g.time = 400; C.aiRefit(g, 0, [big]);
  ok(big.rfq && big.rfq.id === 'wpn', 'KI (Schwer): Archipelago rüstet Waffen nach');
  const poor = X.addShip(g, 'archipelago', 0, 1000 - y.def.r - 80, 1000, 0); P.ice = 1000; C.aiRefit(g, 0, [poor]);
  ok(!poor.rfq, 'KI arm: keine Nachrüstung');
}
/* ---------- 6. Gleichlauf mit KI auf Schwer */
const h = () => { const g = X.createGame({ map: 'keep', seed: 8, players: [{ faction: 'alliance', ai: 3 }, { faction: 'brood', ai: 3 }, { faction: 'mars', ai: 3 }] }); g.players.forEach(p => { p.bonusInc = 6; }); step(g, 700); let rf = 0, fc = 0; for (const u of g.ships) { if (u.rf) rf += u.rf.length; } for (const e of g.log) void e; return [X.stateHash(g), rf]; };
const r1 = h(), r2 = h();
ok(r1[0] === r2[0], 'deterministisch (Nachrüstungen in der Partie: ' + r1[1] + ')');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
