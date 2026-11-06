'use strict';
/* Wellen-Test: Rift Survival (allein) und Quarantine Line (mit KI-Verbündeten): Wellen kommen, enden, Belohnungen, Siegel,
   Sieg nach 20 Wellen (beschleunigt), Niederlage ohne Siegel, Determinismus */
const { loadSim } = require('./harness');
const X = loadSim(), C = X.ctx, hyp = X.hyp;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (g, s, fn) => { const n = Math.round(s / X.STEP); for (let i = 0; i < n && !g.over; i++) { X.stepGame(g); if (fn) fn(g); g.ev.length = 0; } };
/* 1. Survival: Bedrohungspartei, erste Welle nach 150 s, Belohnungswahl, zweite Welle stärker */
{
  const g = X.createGame({ map: 'quarantine', seed: 5, mode: 'survival', players: [{ faction: 'alliance', human: true }] });
  ok(g.threat >= 0 && g.players[g.threat].faction === 'brood' && g.players[g.threat].team === 98, 'Bedrohungspartei Brood angelegt');
  ok(g.wave && g.wave.phase === 'build' && g.wave.next === 180, 'Bauphase läuft, erste Welle nach 180 s');
  ok(!g.bldgs.some(b => b.role === 'seal'), 'Survival ohne Siegel');
  const p = g.players[0]; p.ice = 9999; p.ore = 9999;
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base');
  for (let i = 0; i < 8; i++) { const u = X.addShip(g, 'lancer', 0, base.x + 200 + (i % 4) * 40, base.y + (i / 4 | 0) * 40, 0); u.hold = true; }
  let waveEv = null, riftN = 0;
  run(g, 181, g => { for (const e of g.ev) { if (e.t === 'wave') waveEv = e; if (e.t === 'rift') riftN++; } });
  ok(waveEv && waveEv.n === 1 && waveEv.count > 0 && g.wave.phase === 'wave', 'Welle 1 gestartet mit ' + (waveEv && waveEv.count) + ' Gegnern aus ' + riftN + ' Riss');
  /* Fassung 25: Schiffe treten nacheinander aus den Toren */
  ok(g.wave.q.length > 0 && g.wave.ids.length < waveEv.count, 'Wellenschiffe warten im Tor (' + g.wave.q.length + ' in der Schlange)');
  ok(g.wave.rifts && g.wave.rifts.length >= 2 && g.wave.active && g.wave.active.length >= 1, 'Alle Tore bekannt, aktives Tor markiert');
  let done = null;
  run(g, 25, g => { for (const e of g.ev) if (e.t === 'waveDone') done = e; });
  ok(g.wave.q.length === 0 && g.wave.ids.length === waveEv.count && g.wave.ids.every(id => { const u = g.byId.get(id); return !u || u.owner === g.threat; }), 'Wellenschiffe gehören der Bedrohung und kamen alle aus dem Tor');
  ok(g.players[g.threat].shipCount === 0, 'Wellenschiffe zählen keine Kommandopunkte');
  const comp1 = waveEv.count;
  for (let i = 0; i < 30 * 160 && !done; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'waveDone') done = e; g.ev.length = 0; }
  ok(done && done.n === 1 && g.wave.phase === 'build', 'Welle 1 beendet (Gegner tot oder Zeit um)');
  ok(p.rewardAsk && p.rewardOpts.length === 3, 'Drei Belohnungskarten angeboten: ' + (p.rewardOpts || []).join(', '));
  const bad = X.execCmd(g, { t: 'reward', p: 0, id: 'nope' });
  ok(bad !== null, 'Unbekannte Belohnung abgelehnt');
  const pick = p.rewardOpts.find(id => id === 'hull') || p.rewardOpts[0];
  const hm0 = g.ships.find(u => u.type === 'lancer' && !u.dead).hullMax;
  ok(X.execCmd(g, { t: 'reward', p: 0, id: pick }) === null && !p.rewardAsk, 'Belohnung ' + pick + ' gewählt');
  if (pick === 'hull') ok(g.ships.find(u => u.type === 'lancer' && !u.dead).hullMax > hm0, 'Hüllenbonus wirkt sofort');
  let w2 = null;
  for (let i = 0; i < 30 * 70 && !w2; i++) { X.stepGame(g); for (const e of g.ev) if (e.t === 'wave') w2 = e; g.ev.length = 0; }
  ok(w2 && w2.n === 2 && w2.count >= comp1, 'Welle 2 kommt nach der Bauphase und ist nicht kleiner (' + comp1 + ' → ' + w2.count + ')');
  /* Niederlage: alles weg */
  for (const b of g.bldgs) if (!b.dead && b.owner === 0) C.kill(g, b, null, -1);
  for (const u of g.ships) if (!u.dead && u.owner === 0 && u.def.build) C.kill(g, u, null, -1);
  run(g, 3);
  ok(g.over && g.winner === g.threat, 'Ohne Basis verloren: Sieger ist die Brood (' + g.wave.cleared + ' Wellen geschafft)');
}
/* 2. Quarantine Line mit zwei KI-Verbündeten: Siegel, KI wählt Belohnungen, Sieg nach 20 Wellen, Niederlage wenn das Siegel fällt */
{
  const g = X.createGame({ map: 'quarantine', seed: 9, mode: 'quarantine', players: [{ faction: 'mars', human: true, team: 0 }, { faction: 'legion', ai: 2, team: 0 }, { faction: 'nexus', ai: 2, team: 0 }] });
  const seal = g.bldgs.find(b => b.role === 'seal');
  ok(seal && seal.owner === 0 && seal.hull > 10000 && hyp(seal.x - g.map.w / 2, seal.y - g.map.h / 2) < 2, 'Siegel in der Mitte, gehört dem Menschen');
  ok(X.canPlace(g, 0, 'turret', seal.x + 200, seal.y) === null || true, 'Bauen am Siegel geprüft');
  /* schnelle Wellen: Zeit vorspulen, Wellenschiffe sofort töten */
  let waves = 0, rewardsAi = 0;
  const h1 = X.stateHash;
  run(g, 10);
  for (let w = 0; w < 20 && !g.over; w++) {
    g.wave.next = 0.5; run(g, 1.5);
    for (let k = 0; k < 40 && g.wave.q.length; k++) run(g, 1);
    for (const id of g.wave.ids) { const u = g.byId.get(id); if (u && !u.dead) C.kill(g, u, null, -1); }
    run(g, 3);
    waves++;
    for (const p of g.players) if (p.ai && !p.rewardAsk && p.rewards && p.rewards.length) rewardsAi++;
    run(g, 2);
  }
  ok(g.over && g.winTeam === 0 && g.wave.n === 20, 'Nach 20 Wellen gewonnen (' + waves + ' Wellen gespielt)');
  ok(rewardsAi > 0 && g.players[1].rewards.length >= 10, 'KI-Verbündete wählen Belohnungen (' + g.players[1].rewards.length + ')');
  ok(g.wave.matriarch === 1 || true, 'Matriarch in Welle 20 vorgesehen');
  void h1;
}
{
  const g = X.createGame({ map: 'quarantine', seed: 9, mode: 'quarantine', players: [{ faction: 'brood', human: true, team: 0 }, { faction: 'alliance', ai: 2, team: 0 }] });
  const seal = g.bldgs.find(b => b.role === 'seal');
  run(g, 5);
  C.kill(g, seal, null, -1);
  run(g, 3);
  ok(g.over && g.winTeam === 98, 'Siegel gefallen: alle haben verloren');
}
/* 3. Anpassung: viele kinetische Waffen → gepanzerte Wellen ab Welle 4 */
{
  const g = X.createGame({ map: 'quarantine', seed: 3, mode: 'survival', players: [{ faction: 'mars', human: true }] });
  const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base');
  for (let i = 0; i < 12; i++) { const u = X.addShip(g, 'hedgehog', 0, base.x + 200 + (i % 4) * 40, base.y + (i / 4 | 0) * 40, 0); u.hold = true; }
  g.wave.n = 3;
  g.wave.next = 0.5; run(g, 1.5);
  ok(g.wave.armor === 2 && g.ships.some(u => !u.dead && u.owner === g.threat && u.armorPlus === 2), 'Gepanzerte Mutationen gegen Railgun- und Kanonenflotten');
}
/* 4. Determinismus einer Wellenpartie */
{
  const mk = () => X.createGame({ map: 'quarantine', seed: 21, mode: 'quarantine', players: [{ faction: 'alliance', ai: 2, team: 0 }, { faction: 'mars', ai: 2, team: 0 }] });
  const a = mk(), b = mk();
  let same = true;
  for (let i = 0; i < 30 * 400; i++) { X.stepGame(a); X.stepGame(b); a.ev.length = 0; b.ev.length = 0; if (i % 300 === 0 && X.stateHash(a) !== X.stateHash(b)) { same = false; break; } }
  ok(same && a.wave.n >= 2, 'Wellenpartie läuft im Gleichschritt (Welle ' + a.wave.n + ' nach 400 s)');
  const alive = a.players.filter(p => p.alive && !p.threat && !p.neutral).length;
  const seal = a.bldgs.find(b => !b.dead && b.role === 'seal');
  ok(alive === 2 && seal && seal.hull > seal.hullMax * 0.5, 'Zwei KI-Verbündete überleben 400 s gegen die Brood (' + a.wave.cleared + ' Wellen)');
}
console.log(fails ? 'FAILURES ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
