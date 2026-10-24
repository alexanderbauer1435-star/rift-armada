/* Piratenfestung (Corsair's Keep): Aufbau, Verteidigung, Nachschub, Schatz für den Eroberer, Determinismus */
const { loadSim } = require('./harness.js'); const X = loadSim();
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (np, seed) => X.createGame({ map: 'keep', seed, players: Array.from({ length: np }, (_, i) => ({ faction: i % 2 ? 'mars' : 'alliance', human: i === 0, ai: i ? 0 : undefined })) });
const step = (g, sec) => { const end = g.time + sec; while (g.time < end && !g.over) X.stepGame(g, []); };
/* Aufbau */
let g = mk(2, 5);
const pi = g.pirate, P = g.players[pi], F = g.map.fort;
ok(pi >= 0 && P.pirate && P.neutral && g.tm[pi] === 97, 'Piraten als eigene Partei (Team 97)');
const pb = g.bldgs.filter(b => b.owner === pi), core = g.byId.get(g.fort.core);
ok(core && core.role === 'base' && core.lv === 3 && Math.hypot(core.x - F.x, core.y - F.y) < 1, 'Kern: Kommandobasis Stufe 3 in der Mitte');
ok(pb.filter(b => b.role === 'turret').length === 6 && pb.filter(b => b.role === 'flak').length === 3, 'sechs Geschütze, drei Flak');
ok(!P.lowPower, 'Festung hat genug Energie');
const garr = () => g.ships.filter(u => !u.dead && u.owner === pi && u.post);
ok(garr().length === g.fort.cap, 'Garnison vollzählig (' + g.fort.cap + ')');
/* ruhig, solange niemand kommt */
step(g, 60);
ok(garr().every(u => Math.hypot(u.x - F.x, u.y - F.y) < 520), 'Garnison bleibt auf Posten');
/* Nachschub: zwei Wachen fallen, nach 100 s ist die Garnison wieder vollzählig */
for (const u of garr().slice(0, 2)) X.ctx.kill(g, u, null, 0);
ok(garr().length === g.fort.cap - 2, 'zwei Wachen gefallen');
step(g, 100);
ok(garr().length === g.fort.cap, 'Nachschub aus dem Kern');
/* Eindringling: ein Kampfschiff vor dem Ring wird angegriffen */
const intr = X.addShip(g, 'hammer', 0, F.x + 600, F.y, Math.PI); intr.o = { t: 'hold' }; intr.hold = true;
step(g, 2);
ok(g.fort.alert && garr().some(u => u.o.t === 'amove' || u.o.t === 'attack' || u.tgt === intr.id), 'Garnison greift Eindringling an');
step(g, 60);
ok(intr.dead || intr.hull < intr.hullMax * 0.5, 'Eindringling schwer getroffen oder zerstört');
step(g, 60);
ok(!g.fort.alert && garr().filter(u => Math.hypot(u.x - u.hx, u.y - u.hy) > 120).length <= 2, 'Garnison kehrt auf Posten zurück');
/* Fall: Kern zerstört von Spieler 1 → Schatz */
const p1 = g.players[1], ice0 = p1.ice, ore0 = p1.ore, rel0 = p1.relics;
X.ctx.kill(g, core, null, 1);
step(g, 2);
ok(g.fort.done && p1.ice >= ice0 + 2000 && p1.ore >= ore0 + 1200 && p1.relics > rel0, 'Schatz für den Eroberer (+2000 Eis, +1200 Erz, Relikte)');

ok(!g.over, 'Partie geht weiter (Piraten zählen nicht für den Sieg)');
/* KI-Partie: läuft, Piraten stören nicht den Sieg */
const g2 = mk(2, 9); g2.players[1].ai = X.ctx.aiInit(2); g2.players[0].ai = X.ctx.aiInit(2); g2.players[0].human = false;
step(g2, 1500);
ok(g2.time > 100, 'KI-Partie auf Corsair\'s Keep läuft (' + Math.round(g2.time) + ' s, vorbei: ' + g2.over + ', Festung: ' + (g2.fort.done ? 'gefallen' : 'steht') + ')');
/* Determinismus */
const h = s => { const a = mk(4, s); step(a, 300); return X.stateHash(a); };
ok(h(4) === h(4), 'deterministisch');
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
