/* Fassung 22 – Gebäude Teil 2: Abriss mit Erstattung und Fundament, Andockplätze der Raffinerie, Bauketten (Reihe),
   Ruinen zerstörter Stationen (Bergung, blockierter Platz, Verfall), Spielstand und Gleichlauf */
const { loadSim } = require('./harness.js'); const X = loadSim(['save.js']), C = X.ctx;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const step = (g, sec) => { const end = g.time + sec; while (g.time < end && !g.over) { X.stepGame(g); g.ev.length = 0; } };
const mk = (f) => { const g = X.createGame({ map: 'expanse', seed: 4, pace: 'tactical', players: [{ faction: f || 'alliance', human: true }, { faction: 'mars', ai: 0 }] }); g.players[0].ice = g.players[0].ore = 50000; return g; };
/* freien Bauplatz für role nahe der Basis suchen (Abstand zu weiteren Plätzen in avoid) */
function spot(g, role, avoid, from) {
  const s = from || g.players[0].start;
  for (let d = 160; d < 460; d += 30) for (let a = 0; a < 6.28; a += 0.2) { const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d); if (!X.canPlace(g, 0, role, x, y) && !(avoid || []).some(q => Math.hypot(q.x - x, q.y - y) < 120)) return { x, y }; }
  return null;
}
const builder = g => g.ships.find(u => u.owner === 0 && u.def.build);
const sum = c => c.ice + c.ore;

/* 1 Abriss: 50 % von allem, was bezahlt wurde (alle Stufen), unfertig 80 %; Fundament baut 50 % schneller */
{
  const g = mk(), P = g.players[0], bu = builder(g), at = spot(g, 'turret');
  const D = X.BLDG.alliance.turret;
  ok(X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'turret', x: at.x, y: at.y }) == null, 'Turm gesetzt');
  const t = g.bldgs.find(b => b.role === 'turret' && b.owner === 0);
  C.completeBldg(g, t);
  ok(X.execCmd(g, { t: 'upgrade', p: 0, b: t.id }) == null, 'Ausbau auf II begonnen');
  step(g, D.lv[1].time + 1);
  ok(t.lv === 2, 'Turm Stufe II');
  const paid = { ice: D.lv[0].cost.ice + D.lv[1].cost.ice, ore: D.lv[0].cost.ore + D.lv[1].cost.ore };
  ok(t.paid.ice === paid.ice && t.paid.ore === paid.ore, 'bezahlt gemerkt: ' + t.paid.ice + ' Eis, ' + t.paid.ore + ' Erz');
  const i0 = P.ice, o0 = P.ore; let sold = null;
  ok(X.execCmd(g, { t: 'sell', p: 0, b: t.id }) == null && t.dead, 'abgerissen');
  for (const e of g.ev) if (e.t === 'sold') sold = e;
  ok(P.ice - i0 === Math.floor(paid.ice * 0.5) && P.ore - o0 === Math.floor(paid.ore * 0.5), 'Erstattung 50 % aller Stufen: +' + (P.ice - i0) + ' Eis, +' + (P.ore - o0) + ' Erz');
  ok(sold && sold.ice === P.ice - i0 && sold.ore === P.ore - o0, 'Ereignis nennt die Erstattung');
  ok(!g.wrecks.some(w => w.ruin && w.id === t.id), 'Abriss hinterlässt keine Ruine');
  ok(g.found.length === 1 && g.found[0].role === 'turret', 'Fundament liegt');
  /* unfertig: 80 % */
  const at2 = spot(g, 'reactor', [at]);
  X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'reactor', x: at2.x, y: at2.y });
  const r = g.bldgs.find(b => b.role === 'reactor' && b.owner === 0 && !b.done && !b.dead);
  const i1 = P.ice; X.execCmd(g, { t: 'sell', p: 0, b: r.id });
  ok(P.ice - i1 === Math.floor(X.BLDG.alliance.reactor.lv[0].cost.ice * 0.8), 'unfertig: 80 % zurück');
  /* Basis lässt sich nicht abreißen */
  const base = g.bldgs.find(b => b.role === 'base' && b.owner === 0);
  ok(X.execCmd(g, { t: 'sell', p: 0, b: base.id }) === 'Nicht möglich', 'Kommandobasis nicht abreißbar');
  /* Fundament: gleiche Rolle, gleicher Platz → b.fast; Baufortschritt mit einem Bauschiff daneben 1,5-mal so schnell */
  const prog = (b, sec) => { bu.x = b.x + b.def.r + bu.def.r + 20; bu.y = b.y; bu.v = 0; const p0 = b.prog; step(g, sec); return b.prog - p0; };
  ok(X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'turret', x: at.x + 10, y: at.y - 8 }) == null, 'Neubau am Fundament');
  const t2 = g.bldgs.find(b => b.role === 'turret' && b.owner === 0 && !b.dead);
  ok(t2.fast === 1.5 && !g.found.some(f => f.role === 'turret'), 'Fundament verbraucht, Bau schneller');
  const pf = prog(t2, 4);
  const at3 = spot(g, 'turret', [at, at2]);
  X.execCmd(g, { t: 'sell', p: 0, b: t2.id });
  X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'turret', x: at3.x, y: at3.y });
  const t3 = g.bldgs.find(b => b.role === 'turret' && b.owner === 0 && !b.dead);
  ok(!t3.fast, 'anderer Platz: normal');
  const pn = prog(t3, 4);
  ok(Math.abs(pf / pn - 1.5) < 0.08, 'Fundament: Baufortschritt ×' + (pf / pn).toFixed(2));
  /* Fundament verfällt nach 60 s */
  X.execCmd(g, { t: 'sell', p: 0, b: t3.id });
  step(g, 62);
  X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'turret', x: at3.x, y: at3.y });
  const t4 = g.bldgs.find(b => b.role === 'turret' && b.owner === 0 && !b.dead);
  ok(t4 && !t4.fast && !g.found.length, 'nach 60 s kein Fundament mehr');
  /* andere Rolle am Fundament: kein Bonus */
  X.execCmd(g, { t: 'sell', p: 0, b: t4.id });
  X.execCmd(g, { t: 'build', p: 0, u: [bu.id], role: 'reactor', x: at3.x, y: at3.y });
  const r2 = g.bldgs.find(b => b.role === 'reactor' && b.owner === 0 && !b.dead);
  ok(r2 && !r2.fast, 'andere Rolle: kein Fundament-Bonus');
}

/* 2 Raffinerie: Andockplätze 2 → 3 → 4, Frachter entladen parallel; wartende weichen zu einer freien Raffinerie aus */
{
  for (const f of ['alliance', 'mars', 'legion', 'brood']) { const L = X.BLDG[f].refinery.lv; ok(L[0].docks === 2 && L[1].docks === 3 && L[2].docks === 4, f + ': Andockplätze 2/3/4'); }
  for (const lv of [1, 2, 3]) {
    const g = mk(), P = g.players[0];
    for (const u of g.ships.slice()) if (u.owner === 0 && u.def.cargo) C.removeShip(g, u);
    const ref = g.bldgs.find(b => b.role === 'refinery' && b.owner === 0);
    ref.lv = lv;
    const tk = [];
    for (let i = 0; i < 6; i++) { const a = i * 1.05, u = X.addShip(g, 'hauler', 0, ref.x + Math.cos(a) * 130, ref.y + Math.sin(a) * 130, 0); u.cargo = u.def.cargo; u.ckind = 'ice'; u.o = { t: 'return', nid: 0 }; tk.push(u); }
    let mx = 0, t0 = g.time, done = -1;
    let nd = 0;
    while (g.time - t0 < 40) { X.stepGame(g); mx = Math.max(mx, ref.docks); for (const e of g.ev) if (e.t === 'deliver' && e.owner === 0) nd++; if (done < 0 && nd >= 6) done = g.time - t0; g.ev.length = 0; }
    ok(mx === C.lvOf(ref).docks, 'Raffinerie ' + ['', 'I', 'II', 'III'][lv] + ': höchstens ' + mx + ' Frachter zugleich angedockt, 6 entladen in ' + (done < 0 ? '>30' : done.toFixed(1)) + ' s');
    if (lv === 1) var t1 = done; else if (lv === 3) ok(done > 0 && done < t1, 'Stufe III: weniger Warteschlange (' + done.toFixed(1) + ' s statt ' + t1.toFixed(1) + ' s)');
    void P;
  }
  /* Ausweichen: volle Raffinerie, eine zweite in der Nähe */
  const g = mk();
  for (const u of g.ships.slice()) if (u.owner === 0 && u.def.cargo) C.removeShip(g, u);
  const ref = g.bldgs.find(b => b.role === 'refinery' && b.owner === 0), at = spot(g, 'refinery', [ref], ref);
  const r2 = X.addBldg(g, 'refinery', 0, at.x, at.y, true);
  const tk = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.2, u = X.addShip(g, 'hauler', 0, ref.x + Math.cos(a) * 90, ref.y + Math.sin(a) * 90, 0); u.cargo = u.def.cargo; u.ckind = 'ice'; u.o = { t: 'return', nid: 0 }; tk.push(u); }
  let used2 = false; const t0 = g.time;
  while (g.time - t0 < 20) { X.stepGame(g); if (r2.docks > 0) used2 = true; g.ev.length = 0; }
  ok(used2, 'wartende Frachter weichen zur freien Raffinerie aus');
}

/* 3 Baukette: drei Türme in einer Reihe für ein Bauschiff; ein blockierter Platz wird übersprungen */
{
  const g = mk(), bu = builder(g), def = X.BLDG.alliance.turret, gap = def.r * 2 + 20;
  const a = spot(g, 'turret');
  let pts = null;
  for (let k = 0; k < 64 && !pts; k++) { const ang = k * 0.1, q = [0, 1, 2, 3].map(i => [Math.round(a.x + Math.cos(ang) * gap * i), Math.round(a.y + Math.sin(ang) * gap * i)]); if (q.every(([x, y]) => !X.canPlace(g, 0, 'turret', x, y))) pts = q; }
  ok(!!pts, 'vier freie Plätze in Reihe gefunden');
  /* den dritten Platz verstellen: eine Ruine darauf */
  const blk = { ruin: 1, x: pts[2][0], y: pts[2][1], ang: 0, role: 'turret', f: 'mars', lv: 1, r: 20, owner: 1, until: 1e9, id: 999999, sal: 100, sal0: 100 }; g.wrecks.push(blk);
  const ice0 = g.players[0].ice;
  ok(X.execCmd(g, { t: 'buildrow', p: 0, u: [bu.id], role: 'turret', pts }) == null, 'Reihe angenommen');
  ok(bu.o.t === 'build' && bu.bq && bu.bq.length === 3, 'erster Bau läuft, drei weitere in der Warteschlange');
  ok(g.players[0].ice === ice0 - def.lv[0].cost.ice, 'bezahlt wird je Station beim Baubeginn');
  let skips = 0; const t0 = g.time;
  while (g.time - t0 < 200) { X.stepGame(g); for (const e of g.ev) if (e.t === 'bqskip') skips++; g.ev.length = 0; if (!bu.bq && bu.o.t === 'idle') break; }
  const done = g.bldgs.filter(b => b.owner === 0 && b.role === 'turret' && b.done && !b.dead);
  ok(done.length === 3 && skips === 1, 'drei Türme fertig, ein blockierter Platz übersprungen (' + done.length + ' fertig, ' + skips + ' übersprungen, ' + Math.round(g.time - t0) + ' s)');
  ok(!bu.bq, 'Warteschlange leer');
  void blk;
  /* zwei Bauschiffe teilen sich eine Reihe; ein neuer Befehl bricht die Kette ab */
  const g2 = mk(), b1 = builder(g2), b2 = X.addShip(g2, b1.type, 0, b1.x + 40, b1.y, 0);
  const a2 = spot(g2, 'turret'); let p2 = null;
  for (let k = 0; k < 64 && !p2; k++) { const ang = k * 0.1, q = [0, 1, 2].map(i => [Math.round(a2.x + Math.cos(ang) * gap * i), Math.round(a2.y + Math.sin(ang) * gap * i)]); if (q.every(([x, y]) => !X.canPlace(g2, 0, 'turret', x, y))) p2 = q; }
  X.execCmd(g2, { t: 'buildrow', p: 0, u: [b1.id, b2.id], role: 'turret', pts: p2 });
  ok(b1.o.bid && b1.o.bid === b2.o.bid && g2.bldgs.filter(b => b.role === 'turret' && b.owner === 0).length === 1, 'zwei Bauschiffe bauen gemeinsam am ersten Platz');
  step(g2, 140);
  ok(g2.bldgs.filter(b => b.owner === 0 && b.role === 'turret' && b.done).length === 3, 'zu zweit: drei Türme fertig');
  const g3 = mk(), b3 = builder(g3);
  X.execCmd(g3, { t: 'buildrow', p: 0, u: [b3.id], role: 'turret', pts: p2 });
  X.execCmd(g3, { t: 'move', p: 0, u: [b3.id], x: b3.x + 200, y: b3.y });
  ok(!b3.bq, 'Bewegungsbefehl beendet die Baukette');
  /* Rohstoffe fehlen: das Bauschiff wartet und baut weiter, sobald es reicht */
  const g4 = mk(), b4 = builder(g4), P4 = g4.players[0];
  X.execCmd(g4, { t: 'buildrow', p: 0, u: [b4.id], role: 'turret', pts: p2 });
  P4.ice = 0; P4.ore = 0; P4.bonusInc = 0;
  for (const u of g4.ships.slice()) if (u.owner === 0 && u.def.cargo) C.removeShip(g4, u);
  step(g4, 60);
  ok(b4.bq && b4.bq.length === 2 && b4.bqW === 1, 'ohne Rohstoffe wartet die Kette');
  P4.ice = P4.ore = 5000; step(g4, 120);
  ok(g4.bldgs.filter(b => b.owner === 0 && b.role === 'turret' && b.done).length === 3, 'mit Rohstoffen weiter: drei Türme');
}

/* 4 Ruinen: zerstörte Station → Ruine mit 30 % der Kosten, blockiert den Platz, Frachter bergen sie, Verfall nach 8 min */
{
  const g = mk(), P = g.players[0], at = spot(g, 'reactor'), D = X.BLDG.alliance.reactor;
  const r = X.addBldg(g, 'reactor', 0, at.x, at.y, true);
  C.kill(g, r, null, 1);
  const w = g.wrecks.find(q => q.ruin && q.id === r.id);
  ok(w && w.sal === Math.round(0.3 * (D.lv[0].cost.ice + D.lv[0].cost.ore)) && w.role === 'reactor' && w.f === 'alliance', 'Ruine mit Bergungswert ' + (w && w.sal));
  ok(X.canPlace(g, 0, 'reactor', at.x, at.y) === 'Hier liegt eine Ruine', 'Ruine blockiert den Bauplatz');
  const tk = g.ships.find(u => u.owner === 0 && u.def.cargo);
  ok(X.execCmd(g, { t: 'salvage', p: 0, u: [tk.id], w: w.id }) == null, 'Bergungsbefehl an der Ruine');
  let got = 0; const t0 = g.time;
  while (g.time - t0 < 120 && g.wrecks.includes(w)) { X.stepGame(g); for (const e of g.ev) if (e.t === 'deliver' && e.owner === 0 && e.sal) got += e.amt; g.ev.length = 0; }
  ok(!g.wrecks.includes(w), 'Ruine geborgen und verschwunden (' + Math.round(g.time - t0) + ' s, +' + got + ' Erz)');
  ok(got >= w.sal0 * 0.9, 'Ertrag etwa der Bergungswert');
  ok(!X.canPlace(g, 0, 'reactor', at.x, at.y), 'Platz wieder frei');
  /* Verfall */
  const r2 = X.addBldg(g, 'turret', 0, at.x, at.y, true); C.kill(g, r2, null, 1);
  const w2 = g.wrecks.find(q => q.ruin && q.id === r2.id);
  ok(w2 && Math.abs(w2.until - g.time - 480) < 1, 'Ruine verfällt nach 8 Minuten');
  step(g, 482);
  ok(!g.wrecks.includes(w2), 'nach 8 Minuten weg');
  /* Basis (Stufe I ohne Kosten) hinterlässt trotzdem eine Ruine; Kommando-Wracks-Grenze verdrängt keine Ruinen */
  const g2 = mk(), b2 = g2.bldgs.find(b => b.owner === 1 && b.role === 'refinery'); C.kill(g2, b2, null, 0);
  for (let i = 0; i < 70; i++) { const s = X.addShip(g2, 'lancer', 1, 2000 + i, 2000, 0); C.kill(g2, s, null, 0); }
  ok(g2.wrecks.some(q => q.ruin && q.id === b2.id) && g2.wrecks.length <= 61, 'Schiffswracks verdrängen keine Ruine');
}

/* 5 Spielstand und Gleichlauf: Ruine, Fundament, Baukette, bezahlte Kosten überstehen Speichern/Laden; zwei Läufe gleich */
{
  const run = () => {
    const g = mk('mars'), bu = builder(g), def = X.BLDG.mars.turret, gap = def.r * 2 + 20, a = spot(g, 'turret');
    let pts = null;
    for (let k = 0; k < 64 && !pts; k++) { const ang = k * 0.1, q = [0, 1, 2].map(i => [Math.round(a.x + Math.cos(ang) * gap * i), Math.round(a.y + Math.sin(ang) * gap * i)]); if (q.every(([x, y]) => !X.canPlace(g, 0, 'turret', x, y))) pts = q; }
    const at = spot(g, 'reactor', pts.map(([x, y]) => ({ x, y })));
    const r = X.addBldg(g, 'reactor', 0, at.x, at.y, true), r2 = X.addBldg(g, 'relay', 0, at.x, at.y + 160, true);
    X.execCmd(g, { t: 'buildrow', p: 0, u: [bu.id], role: 'turret', pts });
    step(g, 20);
    C.kill(g, r, null, 1); X.execCmd(g, { t: 'sell', p: 0, b: r2.id });
    step(g, 5);
    return g;
  };
  const g = run(), d = JSON.parse(JSON.stringify(C.saveGame(g))), h = C.loadGame(d);
  ok(!!h && h.wrecks.some(w => w.ruin) && h.found.length === 1 && h.ships.some(u => u.bq && u.bq.length) && h.bldgs.every(b => b.paid), 'Spielstand: Ruine, Fundament, Baukette und Kosten gespeichert');
  ok(X.stateHash(h) === X.stateHash(g), 'geladen gleicher Zustand');
  step(g, 90); step(h, 90);
  ok(X.stateHash(h) === X.stateHash(g), 'nach 90 s weiter gleich (' + X.stateHash(g) + ')');
  const g2 = run(); step(g2, 90);
  ok(X.stateHash(g2) === X.stateHash(g), 'zweiter Lauf identisch');
  ok(g.bldgs.filter(b => b.owner === 0 && b.role === 'turret' && b.done).length === 3, 'Reihe zu Ende gebaut');
}
console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
