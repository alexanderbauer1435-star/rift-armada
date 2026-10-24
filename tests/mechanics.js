/* Spielmechanik Runde 16: Konter nach Größenklasse, Flanke/Heck, Bergung, Haltung Vorsichtig, Tarnung */
const { loadSim } = require('./harness.js'); const X = loadSim(), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = () => X.createGame({ map: 'expanse', seed: 4, players: [{ faction: 'alliance', human: true }, { faction: 'brood', ai: 0 }] });
const step = (g, sec) => { const end = g.time + sec; while (g.time < end && !g.over) X.stepGame(g, []); };
/* 1 Konter: Torpedo gegen groß doppelt so stark wie gegen klein (gleiche Panzerung: Brood ohne Schild) */
{
  const g = mk(), L = X.addShip(g, 'leviathan', 1, 2000, 2000, 0), S = X.addShip(g, 'ravager', 1, 2400, 2000, 0);
  L.armorPlus = -(X.SHIPS.leviathan.armor || 0); S.armorPlus = -(X.SHIPS.ravager.armor || 0); const aL = (X.SHIPS.leviathan.armor || 0), aS = (X.SHIPS.ravager.armor || 0);
  const h0 = L.hull, s0 = S.hull;
  C.damage(g, L, 100, 'torp', undefined, 0, L.x + 100, L.y); C.damage(g, S, 100, 'torp', undefined, 0, S.x + 100, S.y);
  const dl = h0 - L.hull, ds = s0 - S.hull;
  ok(Math.abs(dl / ds - 2) < 0.05, 'Torpedo: groß ' + dl.toFixed(0) + ' vs klein ' + ds.toFixed(0) + ' (×' + (dl / ds).toFixed(2) + ')');
  const b0 = S.hull; C.damage(g, S, 100, 'beam', undefined, 0, S.x + 100, S.y); const db = b0 - S.hull;
  ok(db > ds, 'Strahl trifft Kleine härter als Torpedo (' + db.toFixed(0) + ' > ' + ds.toFixed(0) + ')');
}
/* 2 Flanke: Treffer von hinten +25 %, von der Seite +10 % */
{
  const g = mk(), T = X.addShip(g, 'leviathan', 1, 2000, 2000, 0); T.armorPlus = -(X.SHIPS.leviathan.armor || 0);
  const hit = (sx, sy) => { const h = T.hull; C.damage(g, T, 100, 'kin', undefined, 0, sx, sy); return h - T.hull; };
  const front = hit(T.x + 200, T.y), side = hit(T.x, T.y + 200), rear = hit(T.x - 200, T.y);
  ok(Math.abs(rear / front - 1.25) < 0.02 && Math.abs(side / front - 1.1) < 0.02, 'Flanke ×' + (side / front).toFixed(2) + ', Heck ×' + (rear / front).toFixed(2));
  ok(g.ev.some(e => e.t === 'flank'), 'Ereignis bei Hecktreffer');
}
/* 3 Bergung: zerstörtes Schiff hinterlässt bergbares Wrack, Frachter bringt Erz heim */
{
  const g = mk(), s = g.players[0].start, v = X.addShip(g, 'lancer', 1, s.x + 300, s.y - 200, 0);
  C.kill(g, v, null, 0);
  const w = g.wrecks.find(q => q.id === v.id);
  ok(w && w.sal === Math.round(0.25 * (X.SHIPS.lancer.cost.ice + X.SHIPS.lancer.cost.ore)), 'Wrack mit Bergungswert ' + (w && w.sal));
  const tk = g.ships.find(u => u.owner === 0 && u.def.cargo), ore0 = g.players[0].ore, earned0 = g.players[0].stats.earned;
  ok(X.execCmd(g, { t: 'salvage', p: 0, u: [tk.id], w: w.id }) == null && tk.o.t === 'salvage', 'Bergungsbefehl angenommen');
  let got = 0; const P0 = g.players[0]; const e0 = P0.ore; for (let k = 0; k < 90 / X.STEP; k++) { X.stepGame(g, []); for (const e of g.ev) if (e.t === 'deliver' && e.owner === 0 && e.kind === 'ore') got += e.amt; g.ev.length = 0; }
  console.log('     Wrack-Rest', Math.round(w.sal), 'Frachter', tk.o.t, Math.round(tk.cargo), tk.ckind);
  ok(w.sal < 1 || !g.wrecks.includes(w), 'Wrack zerlegt');
  ok(got >= 100, 'Erz geliefert (+' + got + ')');
}
/* 4 Vorsichtig: unter 30 % zur Werft, repariert zurück */
{
  const g = mk(), P = g.players[0], s = P.start;
  const y = X.addBldg(g, 'yard', 0, s.x + 260, s.y - 60, true);
  const u = X.addShip(g, 'lancer', 0, s.x + 900, s.y + 700, 0); u.stance = 3; u.hull = u.hullMax * 0.2;
  step(g, 1);
  ok(u.retreat && u.o.t === 'move' && Math.hypot(u.o.x - y.x, u.o.y - y.y) < 150, 'Rückzug zur Werft');
  step(g, 240);
  ok(u.hull > u.hullMax * 0.9, 'an der Werft repariert (' + Math.round(u.hull / u.hullMax * 100) + ' %)');
  step(g, 40);
  ok(!u.retreat && Math.hypot(u.x - (s.x + 900), u.y - (s.y + 700)) < 400, 'zurück am Ausgangsort');
}
/* 5 Tarnung: für Feinde unsichtbar außer aus der Nähe oder in Geschützreichweite; Angriff hebt sie auf */
{
  const g = mk(), P = g.players[0], s = P.start;
  const w = X.addShip(g, 'wren', 0, 1800, 1800, 0), e = X.addShip(g, 'spitter', 1, 2100, 1800, Math.PI);
  e.stance = 2; w.stance = 2;
  step(g, 0.5);
  ok(C.canSee(g, 1, w), 'ungetarnt sichtbar');
  ok(X.cmdAbility(g, 0, [w.id], 'cloak') == null && w.abT.cloak > 0, 'Tarnung aktiviert');
  step(g, 0.5);
  ok(!C.canSee(g, 1, w), 'getarnt aus 300 Einheiten unsichtbar');
  e.x = 1900; step(g, 0.5);
  ok(C.canSee(g, 1, w), 'aus nächster Nähe entdeckt');
  e.x = 2600; const t = X.addBldg(g, 'turret', 1, 2150, 1800, true); step(g, 0.5);
  ok(C.canSee(g, 1, w), 'Geschütz entdeckt in Waffenreichweite');
  t.hull = 0; C.kill(g, t, null, 0); step(g, 0.5);
  w.stance = 0; X.execCmd(g, { t: 'attack', p: 0, u: [w.id], e: e.id }); step(g, 6);
  ok(!(w.abT.cloak > 0), 'Angriff hebt die Tarnung auf');
}
/* Determinismus über alles */
const h = () => { const g = X.createGame({ map: 'keep', seed: 8, players: [{ faction: 'legion', ai: 3 }, { faction: 'brood', ai: 3 }, { faction: 'mars', ai: 3 }] }); step(g, 400); return X.stateHash(g); };
ok(h() === h(), 'deterministisch (KI mit allen neuen Regeln)');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
