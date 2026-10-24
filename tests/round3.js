'use strict';
/* Runde-3-Test: Legion (Lanzen durch Schilde, Drohnen, ruhende Helden, Erwecken, Wiederauferstehung, Sprung, Sunbreaker),
   Nexus (Netz, Harvester, Verschmelzen, Übernahme, Spiegel, Resonanz), Karte (Ruinen, Zitadelle, Archiv, Wächter, Tore,
   Sonneneruption) und KI-Partien aller Fraktionen. */
const { loadSim } = require('./harness');
const X = loadSim();
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (g, secs, fn) => { const t1 = g.time + secs; while (g.time < t1 && !g.over) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
const mk = (a, b, opts) => X.createGame(Object.assign({ map: 'test', seed: 3, players: [{ faction: a, ai: 0 }, { faction: b, ai: 0 }] }, opts || {}));
const ship = (g, type, pi, x, y, ang) => X.addShip(g, type, pi, x, y, ang || 0);
const cx = g => g.map.w / 2, cy = g => g.map.h / 2;

/* 1. Lichtlanze: ein Teil geht durch den Schild */
{
  const g = mk('legion', 'alliance');
  const t = ship(g, 'bulwark', 1, cx(g) + 250, cy(g), Math.PI); t.stance = 2; t.hold = true; t.o = { t: 'hold' };
  const a = ship(g, 'paladin', 0, cx(g), cy(g), 0); a.auto = false;
  run(g, 1);
  X.execCmd(g, { p: 0, t: 'attack', u: [a.id], e: t.id });
  run(g, 1.2);
  ok(t.shield > 0 && t.hull < t.hullMax, 'Lanze trifft die Hülle, obwohl der Schild steht (shield ' + Math.round(t.shield) + ', hull ' + Math.round(t.hull) + '/' + t.hullMax + ')');
  run(g, 14);
  ok(a.hero && a.hangar && a.hangar.n >= 1, 'Heldenschiff hat Namen (' + a.hero + ') und Drohnen (' + a.hangar.n + ')');
}
/* 2. Ruhender Held, Erwecken durch Restorer, Wiederauferstehung des Flaggschiffs */
{
  const g = mk('legion', 'mars');
  const h = ship(g, 'herald', 0, cx(g), cy(g), 0); h.auto = false;
  const cp0 = g.players[0].shipCount;
  X.damage(g, h, 99999, 'kin', null, 1, h.x + 50, h.y);
  ok(!h.dead && h.derelict && h.dormant && h.hull > 0, 'Herald fällt nicht, sondern ruht als Wrack');
  ok(g.players[0].shipCount === cp0 - h.def.cp, 'Ruhende Helden kosten keine Kommandopunkte');
  const r = ship(g, 'restorer', 0, cx(g) + 300, cy(g), 0);
  X.execCmd(g, { p: 0, t: 'move', u: [r.id], x: h.x + 40, y: h.y });
  run(g, 20);
  ok(!h.derelict && h.crew > 0, 'Restorer erweckt den Herald (crew ' + Math.round(h.crew) + ')');
  const fs = ship(g, 'sovereign', 0, cx(g) - 300, cy(g), 0); fs.auto = false;
  X.damage(g, fs, 99999, 'kin', null, 1, fs.x + 50, fs.y);
  ok(!fs.dead && !fs.derelict && fs.resUsed && fs.hull > 0 && fs.abT.invuln > 0, 'Last Sovereign steht nach dem Todesstoß wieder auf');
  X.damage(g, fs, 99999, 'kin', null, 1, fs.x + 50, fs.y);
  run(g, 3.5);
  X.damage(g, fs, 99999, 'kin', null, 1, fs.x + 50, fs.y);
  ok(fs.derelict || fs.dead, 'Beim zweiten Mal ruht auch das Flaggschiff');
  /* Sprung */
  const h2 = ship(g, 'herald', 0, cx(g), cy(g) + 400, 0); h2.auto = false;
  const x0 = h2.x; ok(!X.cmdAbility(g, 0, [h2.id], 'blink') && h2.x > x0 + 250, 'Strömungssprung versetzt den Herald (' + Math.round(h2.x - x0) + ')');
  /* Flottensprung */
  const fs2 = ship(g, 'sovereign', 0, cx(g) - 800, cy(g) + 700, 0); fs2.auto = false; const e1 = ship(g, 'paladin', 0, fs2.x - 60, fs2.y + 60, 0); e1.auto = false;
  run(g, 0.1); const ex0 = e1.x; ok(!X.cmdAbility(g, 0, [fs2.id], 'fleetjump') && e1.x > ex0 + 400, 'Flottensprung nimmt den Begleiter mit');
}
/* 3. Sunbreaker */
{
  const g = mk('legion', 'mars');
  g.players[0].ice = g.players[0].ore = 9999;
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base'); base.lv = 3;
  const lab = X.addBldg(g, 'lab', 0, base.x + 200, base.y + 200, true); lab.lv = 2;
  ok(X.buildReq(g, 0, 'super') === null, 'Sunbreaker baubar');
  const sb = X.addBldg(g, 'super', 0, base.x - 200, base.y, true); sb.charge = 1;
  const t = ship(g, 'hammer', 1, cx(g), cy(g), 0); t.stance = 2; const h0 = t.hull;
  ok(X.cmdSuper(g, 0, cx(g), cy(g)) === null && g.flares.length === 1, 'Sterneneruption gezündet');
  run(g, 9);
  ok(t.dead || t.hull < h0 - 500, 'Eruption beschädigt das Schlachtschiff schwer (' + (t.dead ? 'zerstört' : Math.round(h0 - t.hull)) + ')');
}
/* 4. Nexus: Netz, abgeschaltete Stationen, Harvester liefern ins Netz, Verschmelzen, Übernahme, Spiegel, Resonanz */
{
  const g = mk('nexus', 'alliance');
  const p = g.players[0], base = g.bldgs.find(b => b.owner === 0 && b.role === 'base');
  p.ice = p.ore = 9999;
  ok(X.canPlace(g, 0, 'reactor', base.x + 1500, base.y) === 'Außerhalb des Netzes', 'Bauen weit weg vom Netz ist nicht möglich');
  const node = X.addBldg(g, 'relay', 0, base.x + 500, base.y, true), far = X.addBldg(g, 'reactor', 0, base.x + 900, base.y, true);
  run(g, 2);
  ok(!far.off, 'Reaktor hinter dem Knoten ist verbunden');
  X.removeShip; node.dead = true; g.deadFlag = true; node.hull = 0;
  run(g, 2);
  ok(far.off, 'Ohne den Knoten ist der Reaktor abgeschaltet');
  /* Harvester */
  const hv = g.ships.find(u => u.owner === 0 && u.def.cargo);
  let netDel = 0; run(g, 60, g => { for (const e of g.ev) if (e.t === 'deliver' && e.net && e.owner === 0) netDel++; });
  ok(netDel >= 2, 'Harvester liefern ins Netz ohne Rückflug (' + netDel + ' Lieferungen)');
  /* Verschmelzen */
  const sh = [0, 1, 2].map(i => ship(g, 'shard', 0, cx(g) + i * 30, cy(g), 0));
  const cp0 = p.shipCount;
  ok(X.cmdMerge(g, 0, sh.map(u => u.id)) !== null, 'Ohne Wachskammer II und Labor verschmelzen Shards nicht');
  { const y = X.addBldg(g, 'yard', 0, base.x - 250, base.y + 200, true); y.lv = 2; const lab = X.addBldg(g, 'lab', 0, base.x + 200, base.y + 200, true); void lab; }
  ok(X.cmdMerge(g, 0, sh.map(u => u.id)) === null, 'Drei Shards verschmelzen');
  const pr = g.ships.find(u => !u.dead && u.owner === 0 && u.type === 'prism');
  ok(!!pr && sh.every(u => u.dead), 'Ein Prism entsteht, die Shards sind weg');
  ok(p.shipCount === cp0 - 3 + 3, 'Kommandopunkte stimmen nach dem Verschmelzen');
  ok(X.cmdMerge(g, 0, [pr.id]) !== null, 'Einzelnes Schiff verschmilzt nicht');
  /* Übernahme */
  const b = ship(g, 'binder', 0, cx(g) + 300, cy(g) + 300, 0); b.auto = false;
  const v = ship(g, 'lancer', 1, cx(g) + 380, cy(g) + 300, Math.PI); v.stance = 2; v.hull = v.hullMax * 0.2;
  run(g, 1);
  ok(!X.cmdAbility(g, 0, [b.id], 'bind', v.id) && v.owner === 0, 'Binder übernimmt den angeschlagenen Lancer');
  const v2 = ship(g, 'lancer', 1, cx(g) + 380, cy(g) + 360, Math.PI); v2.stance = 2;
  run(g, 1); b.abcd.bind = 0;
  ok(X.cmdAbility(g, 0, [b.id], 'bind', v2.id) !== null && v2.owner === 1, 'Gesunder Lancer lässt sich nicht übernehmen');
  /* Spiegel */
  const m = ship(g, 'mirror', 0, cx(g) - 400, cy(g) - 400, 0); m.stance = 2; m.hold = true; m.o = { t: 'hold' };
  const l = ship(g, 'lancer', 1, cx(g) - 150, cy(g) - 400, Math.PI); l.auto = false;
  run(g, 1); X.execCmd(g, { p: 1, t: 'attack', u: [l.id], e: m.id }); run(g, 4);
  ok(l.shield < l.shieldMax, 'Mirror wirft Strahlschaden zurück (Lancer-Schild ' + Math.round(l.shield) + '/' + l.shieldMax + ')');
  ok(m.adapt && m.adapt.beam > 10, 'Mirror passt sich an Strahlen an (' + m.adapt.beam + ' Treffer)');
  /* Resonanz */
  base.lv = 3; const lab = X.addBldg(g, 'lab', 0, base.x - 300, base.y + 200, true); lab.lv = 2;
  const sw = X.addBldg(g, 'super', 0, base.x - 300, base.y - 250, true); sw.charge = 1;
  const w1 = ship(g, 'wren', 1, cx(g) + 600, cy(g) - 600, 0), w2 = ship(g, 'bulwark', 1, cx(g) + 650, cy(g) - 600, 0);
  ok(X.cmdSuper(g, 0, cx(g) + 620, cy(g) - 600) === null && w1.owner === 0 && w2.owner === 1, 'Resonanz übernimmt die Korvette, nicht den Kreuzer');
}
/* 5. Karte: Ruine scannen, Zitadelle, Archiv, Tor, Wächter, Sonneneruption */
{
  const g = mk('alliance', 'mars', { seed: 4 });
  const p = g.players[0];
  const ruin = g.sites.find(s => s.kind === 'ruin');
  const sc = ship(g, 'lancer', 0, ruin.x + ruin.r + 60, ruin.y, 0); sc.auto = false;
  let res = null; run(g, 16, g => { for (const e of g.ev) if (e.t === 'ruin') res = e.result; });
  ok(ruin.scanned && res, 'Ruine gescannt, Ergebnis: ' + res);
  /* Archiv: 45 s halten */
  const ar = g.sites.find(s => s.kind === 'archive');
  const h1 = ship(g, 'bulwark', 0, ar.x + ar.r + 80, ar.y, 0), h2 = ship(g, 'bulwark', 0, ar.x + ar.r + 80, ar.y + 60, 0); h1.auto = h2.auto = false;
  let won = null; run(g, 50, g => { for (const e of g.ev) if (e.t === 'siteWon') won = e.kind; });
  ok(won === 'archive' && p.etechAsk && p.etechAsk.length === 3, 'Archiv gehalten, drei Erbauer-Technologien zur Wahl: ' + (p.etechAsk || []).join(','));
  const pick = p.etechAsk[0];
  ok(X.cmdEtech(g, 0, pick) === null && p.etech === pick, 'Erbauer-Technologie gewählt: ' + pick);
  /* Zitadelle: Wächter besiegen, dann halten */
  const ci = g.sites.find(s => s.kind === 'citadel');
  const guards = ci.guard.map(id => g.byId.get(id));
  ok(guards.length === 3 && guards.every(u => u && !u.dead && u.owner === g.neutral), 'Drei Wächterdrohnen an der Zitadelle');
  const fleet = [0, 1, 2, 3].map(i => ship(g, 'bulwark', 0, ci.x - 500, ci.y + i * 60 - 90, 0));
  for (const u of fleet) u.auto = false;
  X.execCmd(g, { p: 0, t: 'move', u: fleet.map(u => u.id), x: ci.x, y: ci.y, am: true });
  let sent = false; const cap = g => { for (const e of g.ev) if (e.t === 'siteWon' && e.kind === 'citadel') sent = true; };
  run(g, 90, cap);
  ok(guards.every(u => u.dead), 'Wächterdrohnen besiegt');
  run(g, 110, cap);
  ok(sent && g.ships.some(u => !u.dead && u.type === 'sentinel' && u.owner === 0), 'Zitadelle gehalten: Erbauer-Sentinel erhalten' + (sent ? '' : ' ' + JSON.stringify({ prog: ci.prog, by: ci.by, done: ci.done, pres: X.presence(g, ci.x, ci.y, ci.r + 200), d: fleet.map(u => Math.round(Math.hypot(u.x - ci.x, u.y - ci.y)) + ':' + u.o.t + ':' + u.dead) })));
  /* Tor: aktivieren (Relikte), Durchflug, Lanze, Sperre */
  const gt = g.gates[0], pair = g.byId.get(gt.pair);
  p.relics = 0;
  const gs = [0, 1].map(i => ship(g, 'lancer', 0, gt.x + 120, gt.y + i * 50, 0)); for (const u of gs) { u.auto = false; u.stance = 2; }
  let needRel = false; run(g, 25, g => { for (const e of g.ev) if (e.t === 'gateRelics') needRel = true; });
  ok(needRel && gt.owner < 0, 'Ohne Relikte bleibt das Tor tot');
  p.relics = 5; run(g, 3);
  ok(gt.owner === 0 && gt.state === 'active' && p.relics === 5 - 3, 'Tor aktiviert, Relikte bezahlt');
  const tr = ship(g, 'wren', 0, gt.x - 200, gt.y, 0); tr.auto = false;
  X.execCmd(g, { p: 0, t: 'move', u: [tr.id], x: gt.x, y: gt.y });
  run(g, 8);
  ok(Math.hypot(tr.x - pair.x, tr.y - pair.y) < 200, 'Brücke: Wren kommt am Partnertor heraus');
  const en = ship(g, 'needle', 1, gt.x - 200, gt.y + 100, 0); en.auto = false; en.stance = 2;
  X.execCmd(g, { p: 0, t: 'gate', id: gt.id, mode: 'lock' });
  X.execCmd(g, { p: 1, t: 'move', u: [en.id], x: gt.x, y: gt.y });
  run(g, 8);
  ok(gt.mode === 'lock' && Math.hypot(en.x - gt.x, en.y - gt.y) < 120, 'Sperre: feindliche Needle bleibt vor dem Tor');
  const dummy = ship(g, 'hammer', 1, pair.x + 60, pair.y, 0); dummy.stance = 2; const dh = dummy.hull;
  X.execCmd(g, { p: 0, t: 'gate', id: gt.id, mode: 'lance' });
  let lanced = false; run(g, 125, g => { for (const e of g.ev) if (e.t === 'gateLance') lanced = true; });
  ok(lanced && (dummy.dead || dummy.hull < dh - 500), 'Torlanze trifft am Partnertor');
  /* Sonneneruption: Schiff im Freien nimmt Schaden, im Schatten nicht */
  g.events.length = 0; g.events.push({ kind: 'flare', at: g.time + 26, state: 0 });
  const open = ship(g, 'lancer', 0, 1600, 600, 0), shade = ship(g, 'lancer', 0, g.nodes[0].x + g.nodes[0].r + 40, g.nodes[0].y, 0);
  open.auto = shade.auto = false; open.stance = shade.stance = 2; open.hold = shade.hold = true; open.o = { t: 'hold' }; shade.o = { t: 'hold' };
  let warned = false; run(g, 40, g => { for (const e of g.ev) if (e.t === 'flareWarn') warned = true; });
  ok(warned && open.hull < open.hullMax && shade.hull === shade.hullMax, 'Eruption: Warnung, Schaden im Freien (' + Math.round(open.hull) + '), keiner im Schatten');
  /* Determinismus mit allem */
  const g1 = X.createGame({ map: 'twingates', seed: 9, players: [{ faction: 'legion', ai: 3 }, { faction: 'nexus', ai: 3 }] });
  const g2 = X.createGame({ map: 'twingates', seed: 9, players: [{ faction: 'legion', ai: 3 }, { faction: 'nexus', ai: 3 }] });
  run(g1, 500); run(g2, 500);
  ok(X.stateHash(g1) === X.stateHash(g2) && g1.time === g2.time, 'Determinismus Legion gegen Nexus auf Twin Gates');
}
/* 6. KI-Partien aller Paarungen laufen durch */
{
  const facs = ['alliance', 'mars', 'legion', 'nexus'];
  let games = 0, errs = 0;
  for (let i = 0; i < facs.length; i++) for (let j = i + 1; j < facs.length; j++) {
    const map = ['haven', 'twingates', 'ashfall', 'shattered'][(i + j) % 4];
    try { const g = X.createGame({ map, seed: 11 + i * 3 + j, players: [{ faction: facs[i], ai: 2 }, { faction: facs[j], ai: 2 }] }); run(g, 600); games++; console.log('   ' + facs[i] + ' vs ' + facs[j] + ' on ' + map + ': ' + (g.over ? 'winner ' + g.players[g.winner].faction + ' at ' + Math.round(g.time) : 'running, ' + g.players.slice(0, 2).map(p => p.faction.slice(0, 3) + ' ' + g.ships.filter(u => !u.dead && u.owner === p.id).length + ' ships').join(', '))); }
    catch (e) { errs++; console.log('   ERROR ' + facs[i] + ' vs ' + facs[j] + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')); }
  }
  ok(games === 6 && errs === 0, 'Sechs KI-Paarungen ohne Fehler');
}
console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
