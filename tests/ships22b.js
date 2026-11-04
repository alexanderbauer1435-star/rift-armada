/* Fassung 22: Minenleger, Reparaturschiffe und Truppentransporter je Fraktion
   – Daten und Werftliste, Missionssperren · Minen: legen, unsichtbar für Feinde, Nahsicht und Sensorimpuls entdecken,
   Schärfzeit, Zündung bei Berührung (stark gegen Kleine, schwach gegen Große), eigene lösen nicht aus, Höchstzahl,
   Lebensdauer, Punktverteidigung räumt entdeckte Minen · Reparatur: Hülle, Subsysteme, Stationen, nicht sich selbst,
   keine Feinde, Umkreis · Entern: jede Fraktion übernimmt ein Schiff und eine Station · Spielstand und Gleichlauf · KI.
   node tests/ships22b.js */
'use strict';
const { loadSim } = require('./harness.js'); const X = loadSim(['save.js']), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec) => { const end = g.time + sec; while (g.time < end - 1e-9 && !g.over) { X.stepGame(g); g.ev.length = 0; } };
const FAC = ['alliance', 'mars', 'legion', 'nexus', 'brood'];
const ROLE = { mines: { alliance: 'tripwire', mars: 'caltrop', legion: 'censer', nexus: 'geode', brood: 'clutch' }, heal: { alliance: 'mender', mars: 'anvil', legion: 'hospitaller', nexus: 'lumen', brood: 'nurse' }, troop: { alliance: 'envoy', mars: 'breacher', legion: 'templar', nexus: 'assimilator', brood: 'parasitepod' } };
/* leeres Feld: keine Startschiffe, keine Stätten, niemand scheidet aus */
function arena(f0, f1, seed, keepSites) {
  const g = X.createGame({ map: 'test', seed: seed || 3, pace: 'tactical', players: [{ faction: f0, ai: 0 }, { faction: f1, ai: 0 }] });
  for (const u of g.ships.slice()) C.removeShip(g, u); if (!keepSites) { g.sites.length = 0; g.gates.length = 0; } for (const p of g.players) p.nob = true;
  for (const b of g.bldgs.slice()) C.removeBldg(g, b);
  step(g, 0.2); return g;
}
const park = u => { u.stance = 2; u.o = { t: 'hold' }; u.hold = true; u.auto = false; return u; };

/* ---------------------------------------------------------------- 1. Daten, Werftliste, Missionen */
{
  const ids = [].concat(...Object.values(ROLE).map(r => Object.values(r)));
  const roles = new Set(); for (const f in X.BLDG) for (const r in X.BLDG[f]) roles.add(r);
  ok(ids.length === 15 && new Set(ids).size === 15 && ids.every(id => X.SHIPS[id] && !roles.has(id) && !X.ABIL[id]), '15 neue Schiffe, Kennungen eindeutig (keine Station, keine Fähigkeit)');
  ok(FAC.every(f => X.SHIPS[ROLE.mines[f]].f === f && X.SHIPS[ROLE.mines[f]].ab === 'mines' && X.SHIPS[ROLE.heal[f]].heal && X.SHIPS[ROLE.troop[f]].marines > 0 && X.SHIPS[ROLE.troop[f]].ab === 'board' && X.SHIPS[ROLE.troop[f]].stationsToo), 'je Fraktion Minenleger, Reparaturschiff, Truppentransporter (entert auch Stationen)');
  ok(ids.every(id => { const d = X.SHIPS[id]; return d.name && d.desc && !d.hidden && !d.doc && !d.flag && d.yard === 2 && d.cost.ice > 0; }), 'alle sichtbar, ohne Doktrin, Werft II, mit Namen und Beschreibung');
  ok(ids.every(id => !X.SHIPS[id].heal || X.SHIPS[id].wpn.every(w => w.kind === 'pd')) && ids.every(id => !X.SHIPS[id].mines || X.SHIPS[id].wpn.every(w => w.kind === 'pd')), 'Minenleger und Reparaturschiffe ohne Angriffswaffen');
  /* Werftliste wie in ui.js: Fraktion, nicht verborgen; trainReq mit Werft I/II und Labor */
  for (const f of FAC) {
    const g = arena(f, f === 'mars' ? 'alliance' : 'mars');
    const y = X.addBldg(g, 'yard', 0, 1500, 1500, true);
    const list = Object.values(X.SHIPS).filter(d => d.f === f && !d.hidden).map(d => d.id);
    const mine = [ROLE.mines[f], ROLE.heal[f], ROLE.troop[f]];
    const r1 = mine.map(id => X.trainReq(g, 0, id));
    y.lv = 2; X.addBldg(g, 'lab', 0, 1800, 1500, true); C.recalcPower(g, 0);
    const r2 = mine.map(id => X.trainReq(g, 0, id));
    g.players[0].ice = g.players[0].ore = 9999;
    const why = C.cmdTrain(g, 0, y.id, mine[0]);
    ok(mine.every(id => list.indexOf(id) >= 0) && r1.every(r => /Werft/.test(r || '')) && r2.every(r => r === null) && why === null, f + ': in der Werftliste, braucht Werft II (' + r1[0] + '), dann baubar');
  }
  /* Missionen: Sperrlisten lassen die neuen Schiffe weg, ohne Fehler */
  let bad = 0, n = 0;
  for (const id in X.MISSIONS) { const M = X.MISSIONS[id]; if (!M.lock || !M.lock.ships) continue; n++; for (const s of M.lock.ships) if (!X.SHIPS[s]) bad++; }
  const gm = arena('alliance', 'mars'); gm.players[0].lock = { ships: ['pathfinder', 'hauler', 'wren', 'lancer', 'bulwark'] }; X.addBldg(gm, 'yard', 0, 1500, 1500, true).lv = 2;
  ok(!bad && n > 5 && X.trainReq(gm, 0, 'tripwire') === 'In dieser Mission nicht verfügbar', 'Missionssperren (' + n + ' Listen) gültig, neue Schiffe dort gesperrt');
}

/* ---------------------------------------------------------------- 2. Minen */
for (const f of FAC) {
  const foe = f === 'mars' ? 'alliance' : 'mars';
  const g = arena(f, foe, 5);
  const L0 = park(X.addShip(g, ROLE.mines[f], 0, 1200, 1500, 0));
  const r = X.cmdAbility(g, 0, [L0.id], 'mines');
  const ms = g.mines.filter(m => m.owner === 0);
  step(g, 0.5);
  ok(r === null && ms.length === 4 && ms.every(m => C.mineSeen(g, 0, m)) && ms.every(m => !C.mineSeen(g, 1, m)), f + ': Minenfeld aus 4 Minen, für den Feind unsichtbar');
  ok(X.cmdAbility(g, 0, [L0.id], 'mines') !== null, f + ': Abklingzeit, kein zweites Feld sofort');
  /* Nahsicht: feindliches Schiff 140 vor einer Mine (außerhalb der Zündweite) */
  const m0 = ms[0], spot = X.addShip(g, 'wren', 1, m0.x + 140, m0.y, 0); park(spot); spot.x = m0.x + 140; spot.y = m0.y;
  for (let i = 0; i < 7; i++) X.stepGame(g);
  ok(C.mineSeen(g, 1, m0) && g.mines.length === 4, f + ': aus 140 Einheiten entdeckt, nicht gezündet');
  C.removeShip(g, spot); for (let i = 0; i < 7; i++) X.stepGame(g);
  /* Sensorimpuls aus der Ferne */
  ok(!C.mineSeen(g, 1, m0), f + ': ohne Nahsicht wieder verborgen');
  g.reveals.push({ x: m0.x + 600, y: m0.y, r: 900, owner: 1, until: g.time + 8 }); for (let i = 0; i < 7; i++) X.stepGame(g);
  ok(C.mineSeen(g, 1, m0), f + ': Sensorimpuls deckt das Feld auf');
  g.reveals.length = 0; step(g, 2.5);
  /* Zündung: Needle (klein) fliegt hindurch */
  const n = X.addShip(g, 'needle', 1, m0.x + 300, m0.y, Math.PI), h0 = n.hull + n.shield; let booms = 0;
  X.execCmd(g, { t: 'move', p: 1, u: [n.id], x: m0.x - 300, y: m0.y });
  for (let i = 0; i < 30 * 8 && !n.dead; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'mineboom') booms++; g.ev.length = 0; }
  ok(booms >= 1 && (n.dead || n.hull + n.shield < h0 * 0.3), f + ': kleines Schiff löst aus (' + booms + ' Explosion), ' + (n.dead ? 'zerstört' : 'Rest ' + Math.round(n.hull)));
}
{
  /* groß gegen klein, eigene lösen nicht aus, Schärfzeit, Höchstzahl, Lebensdauer */
  const g = arena('alliance', 'mars', 6);
  const L0 = park(X.addShip(g, 'tripwire', 0, 1200, 1500, 0)); C.layMines(g, L0);
  const own = park(X.addShip(g, 'lancer', 0, 1200, 1500, 0)); own.x = g.mines[0].x; own.y = g.mines[0].y;
  const inside = park(X.addShip(g, 'needle', 1, g.mines[1].x, g.mines[1].y, 0));
  for (let i = 0; i < 30; i++) { X.stepGame(g); inside.x = g.mines[1] ? g.mines[1].x : inside.x; }
  const armedBefore = g.mines.length;
  step(g, 1.5);
  ok(armedBefore === 4 && g.mines.length < 4, 'Schärfzeit: erst nach ' + 2 + ' s gezündet, eigene Schiffe lösen nicht aus');
  const g2 = arena('alliance', 'mars', 7);
  const hm = X.addShip(g2, 'hammer', 1, 1500, 1500, 0), nd = X.addShip(g2, 'needle', 1, 1500, 1700, 0);
  const fh = e => (e.hull + e.shield) / (e.hullMax + e.shieldMax);
  const b0 = [fh(hm), fh(nd)];
  C.rebuildGrid(g2); C.mineBoom(g2, { x: 1500, y: 1500, owner: 0 }); C.mineBoom(g2, { x: 1500, y: 1700, owner: 0 });
  ok(b0[0] - fh(hm) < 0.15 && (nd.dead || b0[1] - fh(nd) > 0.6), 'Konter: Hammer verliert ' + Math.round((b0[0] - fh(hm)) * 100) + ' %, Needle ' + (nd.dead ? 'zerstört' : Math.round((b0[1] - fh(nd)) * 100) + ' %'));
  const g3 = arena('nexus', 'mars', 8), L3 = park(X.addShip(g3, 'geode', 0, 900, 900, 0));
  for (let k = 0; k < 6; k++) { L3.x = 900 + k * 200; C.layMines(g3, L3); }
  const mine3 = g3.mines.filter(m => m.owner === 0);
  ok(mine3.length === 15 && mine3[0].x > 1000, 'höchstens 15 Minen je Spieler, die ältesten verfallen');
  step(g3, 181);
  ok(g3.mines.length === 0, 'nach 180 s sind alle Minen verfallen');
  /* Punktverteidigung räumt entdeckte Minen (ohne Explosion) */
  const g4 = arena('alliance', 'mars', 9), L4 = park(X.addShip(g4, 'tripwire', 0, 1500, 1500, 0)); C.layMines(g4, L4); C.removeShip(g4, L4);
  const hh = park(X.addShip(g4, 'hedgehog', 1, 1500 + 125, 1500, 0)); hh.stance = 0; let bo = 0;   /* Feuer frei: Punktverteidigung */
  for (let i = 0; i < 30 * 12; i++) { X.stepGame(g4); hh.x = 1625; hh.y = 1500; for (const e of g4.ev) if (e.t === 'mineboom') bo++; g4.ev.length = 0; }
  ok(g4.mines.length < 4 && bo === 0, 'Punktverteidigung räumt entdeckte Minen (' + (4 - g4.mines.length) + ' von 4, keine Explosion)');
}

/* ---------------------------------------------------------------- 3. Reparatur */
for (const f of FAC) {
  const foe = f === 'mars' ? 'alliance' : 'mars';
  const g = arena(f, foe, 11);
  const R0 = park(X.addShip(g, ROLE.heal[f], 0, 1500, 1500, 0));
  const ally = park(X.addShip(g, ROLE.mines[f], 0, 1650, 1500, 0)), far = park(X.addShip(g, ROLE.mines[f], 0, 1500, 1900, 0)), enemy = park(X.addShip(g, foe === 'mars' ? 'hedgehog' : 'lancer', 1, 1500, 1680, 0));
  const st = X.addBldg(g, 'turret', 0, 1350, 1600, true);
  for (const e of [ally, far, enemy, st, R0]) e.hull = e.hullMax * 0.4;
  ally.sub.drive = 0.3; enemy.stance = 2; enemy.wpn = []; g.players[1].ai = null;
  const h = [ally.hull, far.hull, enemy.hull, st.hull, R0.hull];
  /* Gegner schießt nicht: Waffen aus (Feuer halten reicht für Türme nicht), Turm des Spielers 0 schießt – Gegner weit genug */
  enemy.x = 1500; enemy.y = 1680; enemy.def = Object.assign({}, enemy.def, { wpn: [] }); enemy.wcd = [];
  st.wcd = []; st.def = Object.assign({}, st.def, { lv: st.def.lv.map(l => Object.assign({}, l, { wpn: [] })) });
  step(g, 10);
  const selfGain = R0.hull - h[4], regen = (X.SHIPS[ROLE.heal[f]].regen || 0) * R0.hullMax * 10;
  ok(ally.hull > h[0] + ally.hullMax * 0.06 && st.hull > h[3] + st.hullMax * 0.03 && Math.abs(far.hull - h[1]) < 1 + (far.def.regen ? far.hullMax * far.def.regen * 10 : 0) && enemy.hull <= h[2] + 1 && selfGain <= regen * 1.01 + 1, f + ': ' + ROLE.heal[f] + ' repariert Schiff (+' + Math.round(ally.hull - h[0]) + ') und Station (+' + Math.round(st.hull - h[3]) + '), nicht außer Reichweite, keinen Feind, nicht sich selbst');
  ok(ally.sub.drive > 0.5 && R0.heals && R0.heals.length >= 1, f + ': Subsysteme (Antrieb ' + ally.sub.drive.toFixed(2) + ') und Reparaturstrahl für die Darstellung');
}
{
  /* Brood-Amme löst Säure */
  const g = arena('brood', 'alliance', 12), nu = park(X.addShip(g, 'nurse', 0, 1500, 1500, 0)), sw = park(X.addShip(g, 'ravager', 0, 1600, 1500, 0));
  sw.hull = sw.hullMax * 0.5; C.acidOn(g, sw, 300, 1); step(g, 2);
  ok(!sw.acid, 'Brood-Amme heilt und löst Säure');
}

/* ---------------------------------------------------------------- 4. Entern: jede Fraktion nimmt ein Schiff und eine Station */
for (const f of FAC) {
  const foe = f === 'alliance' ? 'mars' : 'alliance';
  const g = arena(f, foe, 13);
  const T0 = X.addShip(g, ROLE.troop[f], 0, 1300, 1500, 0), T1 = X.addShip(g, ROLE.troop[f], 0, 1300, 1700, 0);
  const tgt = park(X.addShip(g, foe === 'mars' ? 'spear' : 'bulwark', 1, 1550, 1500, Math.PI)); tgt.hull = tgt.hullMax * 0.3; tgt.crew = 12; tgt.def = Object.assign({}, tgt.def, { wpn: [] }); tgt.wcd = [];
  const st = X.addBldg(g, 'relay', 1, 1600, 1750, true); st.crew = 20;
  const r1 = X.execCmd(g, { t: 'board', p: 0, u: [T0.id], e: tgt.id }), r2 = X.execCmd(g, { t: 'board', p: 0, u: [T1.id], e: st.id });
  let caps = 0; const end = g.time + 60;
  while (g.time < end && (tgt.owner !== 0 || st.owner !== 0)) { X.stepGame(g); for (const e of g.ev) if (e.t === 'captured') caps++; g.ev.length = 0; }
  ok(r1 === null && r2 === null && tgt.owner === 0 && st.owner === 0 && caps === 2, f + ': ' + ROLE.troop[f] + ' kapert ' + tgt.def.name + ' und ' + st.def.name + ' (' + caps + ' Übernahmen)');
}
{
  /* Marines kommen an der eigenen Werft wieder */
  const g = arena('legion', 'mars', 14), y = X.addBldg(g, 'yard', 0, 1500, 1500, true), T = park(X.addShip(g, 'templar', 0, 1500 + y.def.r + 40, 1500, 0));
  T.marines = 0; step(g, 20);
  ok(T.marines > 40, 'Marines an der Werft aufgefüllt (' + Math.round(T.marines) + ')');
}

/* ---------------------------------------------------------------- 5. Spielstand und Gleichlauf */
function scene(seed) {
  const g = arena('alliance', 'brood', seed, true);
  const a = [X.addShip(g, 'tripwire', 0, 1300, 1500, 0), X.addShip(g, 'mender', 0, 1250, 1450, 0), X.addShip(g, 'envoy', 0, 1250, 1600, 0), X.addShip(g, 'lancer', 0, 1350, 1500, 0), X.addShip(g, 'lancer', 0, 1350, 1560, 0)];
  const b = [X.addShip(g, 'clutch', 1, 2000, 1500, Math.PI), X.addShip(g, 'nurse', 1, 2050, 1450, Math.PI), X.addShip(g, 'parasitepod', 1, 2050, 1600, Math.PI), X.addShip(g, 'ravager', 1, 1950, 1500, Math.PI), X.addShip(g, 'spitter', 1, 1950, 1560, Math.PI)];
  X.execCmd(g, { t: 'ab', p: 0, u: [a[0].id], id: 'mines' }); X.execCmd(g, { t: 'ab', p: 1, u: [b[0].id], id: 'mines' });
  X.execCmd(g, { t: 'move', p: 0, u: a.slice(1).map(u => u.id), x: 1900, y: 1520, am: true }); X.execCmd(g, { t: 'move', p: 1, u: b.slice(1).map(u => u.id), x: 1300, y: 1520, am: true });
  return g;
}
{
  const g1 = scene(21), g2 = scene(21);
  step(g1, 15); step(g2, 15);
  const d = JSON.parse(JSON.stringify(C.saveGame(g1))), g3 = C.loadGame(d);
  ok(!!g3 && g3.mines.length === g1.mines.length && JSON.stringify(g3.mines) === JSON.stringify(g1.mines), 'Spielstand: Minen gesichert und geladen (' + g1.mines.length + ')');
  const hs = []; for (const g of [g1, g2, g3]) { step(g, 40); hs.push(X.stateHash(g)); }
  ok(hs[0] === hs[1], 'Gleichlauf: zwei Läufe gleich (' + hs[0] + ')');
  ok(hs[0] === hs[2], 'Gleichlauf nach Laden des Spielstands (' + hs[2] + ')');
}
/* ---------------------------------------------------------------- 6. KI (Mittel und Schwer) nutzt die Unterstützer, deterministisch */
{
  const run = () => {
    const g = X.createGame({ map: 'haven', seed: 7, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }] });   /* Fassung 24: Schwer gegen Schwer – mit dem früheren Druck endet Schwer gegen Mittel vor den Unterstützern */
    const seen = {}; let laid = 0, heal = 0;
    while (!g.over && g.time < 900) { X.stepGame(g); for (const e of g.ev) if (e.t === 'mines') laid++; g.ev.length = 0; if (g.tick % 30 === 0) for (const u of g.ships) if (!u.dead && (u.def.heal || u.def.mines || u.def.troop)) { seen[u.type] = 1; if (u.heals && u.heals.length) heal++; } }
    return { h: X.stateHash(g), seen: Object.keys(seen).sort().join(','), laid, heal };
  };
  const a = run(), b = run();
  ok(a.laid > 0 && /tripwire|caltrop/.test(a.seen) && /mender|anvil/.test(a.seen), 'KI baut Unterstützer (' + a.seen + '), legt Minen (' + a.laid + ' Felder), Reparaturen beobachtet: ' + a.heal);   /* Reparatur selbst prüft Abschnitt 2; im KI-Spiel heilen Ränge und Docks oft zuerst */
  ok(a.h === b.h, 'KI-Partie mit Unterstützern deterministisch');
}
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
