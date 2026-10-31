'use strict';
/* Fassung 22 – Kartenleben: sprengbare Felsen geben den Weg frei, wandernde Gefahren laufen deterministisch, neutrale
   Stationen werden übernommen und sind umkämpft, Deckung im Trümmerfeld, Zufallskarte fair und erreichbar (2–8 Spieler),
   Gleichschritt und Spielstand.
   node tests/maps22.js */
const { loadSim } = require('./harness');
const X = loadSim(['save.js']), C = X.ctx, vm = require('vm');
const G = n => vm.runInContext(n, C);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const two = (map, extra) => Object.assign({ map, seed: 11, players: [{ faction: 'alliance', human: true }, { faction: 'mars' }] }, extra || {});
const step = (g, s) => { const n = Math.round(s / X.STEP); for (let i = 0; i < n; i++) { X.stepGame(g); g.ev.length = 0; } };
const plen = (map, cls, a, b) => { const p = X.findPath(map, cls, a.x, a.y, b.x, b.y); if (!p) return 1e9; let l = 0, x = a.x, y = a.y; for (const q of p) { l += Math.hypot(q.x - x, q.y - y); x = q.x; y = q.y; } const end = p[p.length - 1]; return Math.hypot(end.x - b.x, end.y - b.y) > 60 ? 1e9 : l; };

/* ---------- 1. Sprengbare Felsen ---------- */
{
  const g = X.createGame(two('maelstrom'));
  const plugs = g.rocks.filter(e => e.plug);
  ok(plugs.length >= 10 && g.rocks.length > plugs.length, 'Maelstrom: ' + plugs.length + ' Pfropfen, ' + g.rocks.length + ' sprengbare Felsen');
  /* eine Lücke: die Pfropfen, die dem ersten am nächsten liegen */
  const p0 = plugs[0], gap = plugs.filter(e => Math.hypot(e.x - p0.x, e.y - p0.y) < 260);
  let cx = 0, cy = 0; for (const e of gap) { cx += e.x / gap.length; cy += e.y / gap.length; }
  const last = gap.reduce((a, e) => Math.hypot(e.x - cx, e.y - cy) > Math.hypot(a.x - cx, a.y - cy) ? e : a, gap[0]);
  const dx = last.x - cx, dy = last.y - cy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
  const A = { x: cx + nx * 260, y: cy + ny * 260 }, B = { x: cx - nx * 260, y: cy - ny * 260 };
  const mid = gap.reduce((a, e) => Math.hypot(e.x - cx, e.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? e : a, gap[0]);
  const bit1 = (cls, e) => g.map.nav[cls][((e.y / 32) | 0) * g.map.gw + ((e.x / 32) | 0)] & 1;
  const before = plen(g.map, 1, A, B), blockedBefore = gap.every(e => bit1(0, e) && bit1(2, e));
  /* Kanonenfeuer (Schaden über damage()) zerlegt die Pfropfen */
  for (const e of gap) { let k = 0; while (!e.dead && k++ < 100) X.damage(g, e, 200, 'kin', null, 0, e.x, e.y); }
  const after = plen(g.map, 1, A, B);
  /* die äußeren Pfropfen grenzen an die Wandfelsen (deren Rand bleibt gesperrt), die inneren werden frei */
  const inner = gap.slice().sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy)).slice(0, gap.length - 2);
  ok(blockedBefore && gap.every(e => e.dead) && inner.every(e => !bit1(0, e) && !bit1(1, e)) && !bit1(2, mid), 'Pfropfen zerstört: Rasterzellen frei (' + gap.length + ' Felsen, Mitte auch für große Schiffe)');
  ok(after < before * 0.6 && after < 1e8, 'Weg durch die gesprengte Lücke kürzer: ' + Math.round(before) + ' → ' + Math.round(after));
  ok(g.wrecks.filter(w => w.rock).length === gap.length && g.wrecks.every(w => !w.rock || w.sal > 0), 'Erzbrocken zum Bergen hinterlassen (' + g.wrecks.filter(w => w.rock).reduce((s, w) => s + w.sal, 0) + ' Erz)');
  ok(gap.every(e => !g.byId.get(e.id) && g.map.rocks[e.ri].gone), 'gesprengte Felsen aus Kennungen und Karte entfernt');
  /* Strahlen machen halben Schaden, Punktabwehr keinen */
  const r1 = g.rocks.find(e => !e.dead && !e.plug), h0 = r1.hp; X.damage(g, r1, 40, 'beam', null, 0, r1.x, r1.y); const h1 = r1.hp; X.damage(g, r1, 40, 'pd', null, 0, r1.x, r1.y);
  ok(Math.abs(h0 - h1 - 20) < 1e-9 && r1.hp === h1, 'Strahl halber Schaden, Punktabwehr keiner');
}
{
  /* Angriffsbefehl auf einen Fels: Schiffe zerstören ihn, Bergung bringt Erz */
  const g = X.createGame(two('maelstrom'));
  const e = g.rocks.find(r => r.plug), s = g.players[0].start;
  const us = []; for (let i = 0; i < 4; i++) us.push(X.addShip(g, 'paladin', 0, e.x + 300 + i * 30, e.y + 200, 0));
  /* Platz für die Schiffe: in die nächste freie Zelle stellen */
  for (const u of us) { const c = C.nearestFree(g.map, 1, (u.x / 32) | 0, (u.y / 32) | 0); u.x = (c % g.map.gw + 0.5) * 32; u.y = (((c / g.map.gw) | 0) + 0.5) * 32; }
  const r = X.execCmd(g, { t: 'attack', p: 0, u: us.map(u => u.id), e: e.id });
  let gone = -1; for (let i = 0; i < 30 * 90 && gone < 0; i++) { X.stepGame(g); for (const v of g.ev) if (v.t === 'rockGone' && v.id === e.id) gone = g.time; g.ev.length = 0; }
  ok(r === null && gone > 0, 'Angriffsbefehl »Angreifen« auf einen Felspfropfen: nach ' + Math.round(gone) + ' s gesprengt');
  void s;
  /* Kinetische Geschosse treffen Felsen */
  const g2 = X.createGame(two('maelstrom')), e2 = g2.rocks.find(q => !q.dead && !q.plug), hp0 = e2.hp;
  g2.proj.push({ kind: 'kin', x: e2.x - 60, y: e2.y, ang: 0, sp: 600, dmg: 30, owner: 0, sid: 0, tid: 0, life: 2, pierce: 1, hit: null, r: 3 });
  for (let i = 0; i < 10; i++) { X.stepGame(g2); g2.ev.length = 0; }
  ok(e2.hp < hp0, 'Kanonengeschoss im Fels: Schaden ' + Math.round(hp0 - e2.hp));
  /* Artilleriesplitter */
  const e3 = g2.rocks.find(q => !q.dead && !q.plug && q !== e2), hp3 = e3.hp;
  C.rocksSplash(g2, e3.x + 10, e3.y, 60, 100, 0);
  ok(e3.hp < hp3, 'Artillerieeinschlag trifft Felsen im Umkreis');
}
{
  /* KI sprengt Pfropfen auf dem Weg zum Gegner (Maelstrom: jede Wand trennt die Nachbarn) */
  /* Ob sich das Sprengen lohnt, hängt vom Spielverlauf ab (nur wenn der Umweg deutlich länger ist): erster Startwert mit Sprengung zählt */
  let n = 0, sd = 0;
  for (const seed of [1, 3, 6, 4]) {
    const g = X.createGame({ map: 'maelstrom', seed, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }, { faction: 'legion', ai: 3 }] });
    for (let i = 0; i < 30 * 900 && !g.over; i++) { X.stepGame(g); for (const v of g.ev) if (v.t === 'rockGone' && v.plug) n++; g.ev.length = 0; }
    if (n > 0) { sd = seed; break; }
  }
  ok(n > 0, 'KI sprengt Felspfropfen (' + n + ' in 15 min, Startwert ' + sd + ')');
}

/* ---------- 2. Wandernde Gefahren ---------- */
{
  const g0 = X.createGame(two('expanse'));
  ok(!g0.hazards.length, 'ohne Schalter keine Gefahren (Missionen, alte Spielstände, Tests)');
  const g = X.createGame(two('expanse', { hazards: true })), g2 = X.createGame(two('expanse', { hazards: true }));
  ok(g.hazards.length === 2 && g.hazards.some(h => h.kind === 'storm') && g.hazards.some(h => h.kind === 'well'), 'Open Expanse: Ionensturm und Gravitationsschacht');
  const trace = gg => { const out = []; for (let i = 0; i < 30 * 120; i++) { X.stepGame(gg); gg.ev.length = 0; if (i % 300 === 0) out.push(gg.hazards.map(h => h.x.toFixed(6) + ',' + h.y.toFixed(6)).join('|')); } return out.join(';'); };
  const t1 = trace(g), t2 = trace(g2);
  ok(t1 === t2, 'Bahnen deterministisch (2 Partien, 120 s)');
  const moved = Math.hypot(g.hazards[0].x - X.createGame(two('expanse', { hazards: true })).hazards[0].x, g.hazards[0].y - X.createGame(two('expanse', { hazards: true })).hazards[0].y);
  ok(moved > 100, 'Gefahr wandert (' + Math.round(moved) + ' Einheiten in 120 s)');
  for (const h of g.hazards) ok(h.x > 0 && h.y > 0 && h.x < g.map.w && h.y < g.map.h, h.kind + ' bleibt auf der Karte');
  /* Sturm: Schiff darin wie im Ionennebel */
  const st = g.hazards.find(h => h.kind === 'storm'), u = X.addShip(g, 'paladin', 0, st.x, st.y, 0);
  C.updateVision(g);
  ok(u.ion === true, 'im Ionensturm: Schilde aus, Nahsicht (u.ion)');
  /* Schacht: zieht an und beschädigt im Kern */
  const w = g.hazards.find(h => h.kind === 'well'), v = X.addShip(g, 'paladin', 0, w.x + 300, w.y, 0), d0 = 300;
  v.o = { t: 'hold' }; v.hold = true;
  for (let i = 0; i < 30 * 4; i++) { X.stepGame(g); g.ev.length = 0; }
  const d1 = Math.hypot(v.x - w.x, v.y - w.y);
  ok(d1 < d0 - 40, 'Gravitationsschacht zieht an: ' + d0 + ' → ' + Math.round(d1));
  const c = X.addShip(g, 'paladin', 0, w.x, w.y, 0), hs = c.hull + c.shield; c.o = { t: 'hold' }; c.hold = true;
  for (let i = 0; i < 30 * 3; i++) { X.stepGame(g); g.ev.length = 0; }
  ok(c.dead || c.hull + c.shield < hs, 'im Kern Schaden');
  /* Warnung, wenn eine Gefahr der Basis nahe kommt */
  const g3 = X.createGame(two('expanse', { hazards: true }));
  let warn = 0; for (let i = 0; i < 30 * 20; i++) { X.stepGame(g3); for (const e of g3.ev) if (e.t === 'hazNear') warn++; g3.ev.length = 0; }
  const quiet = warn === 0, h3 = g3.hazards[0];
  /* eine Raffinerie in die Bahn stellen: die nächste Prüfung meldet die Gefahr, danach eine Minute Ruhe */
  X.addBldg(g3, 'refinery', 0, h3.x + 500, h3.y, true);
  const got = []; for (let i = 0; i < 30 * 50; i++) { X.stepGame(g3); for (const e of g3.ev) if (e.t === 'hazNear') got.push(e); g3.ev.length = 0; }
  ok(quiet && got.length >= 1 && got.every(e => e.owner === 0) && got.filter(e => e.kind === h3.kind).length === 1, 'Meldung, wenn eine Gefahr Basis, Werft oder Raffinerie nahe kommt (einmal je Minute, nicht beim Start)');
}

/* ---------- 3. Neutrale Stationen ---------- */
{
  const g = X.createGame(two('expanse'));
  const ops = g.sites.filter(s => G('OUTPOST')[s.kind]);
  ok(ops.length >= 2 && ops.length <= 3, 'Open Expanse 2 Spieler: ' + ops.length + ' neutrale Stationen (' + ops.map(s => s.kind).join(', ') + ')');
  const s0 = g.players[0].start, s1 = g.players[1].start;
  ok(ops.every(s => Math.abs(Math.hypot(s.x - s0.x, s.y - s0.y) - Math.hypot(s.x - s1.x, s.y - s1.y)) < 2), 'Stationen gleich weit von beiden Starts');
  const st = ops.find(s => s.kind === 'refplat') || ops[0];
  const a = X.addShip(g, 'longshot', 0, st.x + st.r + 60, st.y, 0); a.o = { t: 'hold' }; a.hold = true;
  step(g, 8); const half = st.prog;
  step(g, 8.5);
  ok(half > 0.4 && half < 0.7 && st.owner === 0, 'übernommen nach ~15 s (Fortschritt nach 8 s: ' + Math.round(half * 100) + ' %)');
  /* umkämpft: Feind daneben, Fortschritt des Feindes steht */
  const b = X.addShip(g, 'longshot', 1, st.x - st.r - 60, st.y, Math.PI); b.o = { t: 'hold' }; b.hold = true; b.stance = 2; a.stance = 2;
  step(g, 3);
  ok(st.cont === 1 && st.owner === 0 && st.prog === 0, 'umkämpft, solange beide Seiten daneben stehen');
  X.removeShip(g, a); step(g, 6); const pb = st.prog; step(g, 10);
  ok(pb > 0.2 && st.owner === 1, 'Gegner allein: übernimmt nach 15 s (' + Math.round(pb * 100) + ' % nach 6 s)');
  /* Wirkung: Raffinerie gibt Einkommen, Werft repariert, Relais erlaubt Bauen */
  if (st.kind === 'refplat') { const i0 = g.players[1].ice; step(g, 5); ok(g.players[1].ice - i0 >= 18, 'Raffinerieplattform: Einkommen ' + Math.round(g.players[1].ice - i0) + ' Eis in 5 s'); }
  const rel = ops.find(s => s.kind === 'relayst');
  if (rel) { rel.owner = 0; const far = X.canPlace(g, 0, 'turret', rel.x + rel.r + 120, rel.y); ok(far === null, 'Relaisstation: Bauradius um die Station (' + far + ')'); }
}
{
  const g = X.createGame(two('maelstrom', { players: [{ faction: 'alliance', human: true }, { faction: 'mars' }, { faction: 'nexus' }] }));
  const dk = g.sites.find(s => s.kind === 'drydock');
  if (dk) { dk.owner = 0; const u = X.addShip(g, 'paladin', 0, dk.x + dk.r + 80, dk.y, 0); u.o = { t: 'hold' }; u.hold = true; u.hull = u.hullMax * 0.5; step(g, 4); ok(u.hull > u.hullMax * 0.55, 'Reparaturwerft repariert (' + Math.round(u.hull / u.hullMax * 100) + ' % nach 4 s)'); }
  else ok(false, 'Maelstrom 3 Spieler: Reparaturwerft vorhanden');
}

/* ---------- 4. Deckung ---------- */
{
  const g = X.createGame(two('haven'));
  const d = g.map.debris[0];
  ok(g.map.debris.length >= 2, "Haven's Reach: " + g.map.debris.length + ' Trümmerfelder');
  const inC = X.addShip(g, 'paladin', 0, d.x, d.y, 0), out = X.addShip(g, 'paladin', 0, d.x + d.r + 400, d.y, 0), src = X.addShip(g, 'paladin', 1, d.x, d.y - d.r - 300, 0);
  C.updateVision(g);
  ok(inC.cov === true && !out.cov, 'Schiff im Trümmerfeld: In Deckung');
  for (const kind of ['kin', 'torp', 'rail', 'beam']) {
    inC.hull = out.hull = 5000; inC.shield = out.shield = 0; inC.hullMax = out.hullMax = 5000;
    X.damage(g, inC, 100, kind, src, 1, inC.x + 200, inC.y); X.damage(g, out, 100, kind, src, 1, out.x + 200, out.y);
    const lc = 5000 - inC.hull, lo = 5000 - out.hull;
    if (kind === 'beam') ok(Math.abs(lc - lo) < 1e-6 * lo, 'Strahl: keine Deckung (' + lc.toFixed(1) + ' / ' + lo.toFixed(1) + ')');
    else ok(lo > 0 && Math.abs(lc / lo - 0.75) < 0.02, kind + ': Schaden in Deckung −25 % (' + lc.toFixed(1) + ' / ' + lo.toFixed(1) + ')');
  }
  /* Sicht: Feind sieht in die Deckung nur auf 70 % seiner Reichweite */
  const g2 = X.createGame(two('haven')), d2 = g2.map.debris[0], tgt = X.addShip(g2, 'paladin', 0, d2.x, d2.y, 0);
  const sens = X.SHIPS.paladin.sensor, obs = X.addShip(g2, 'paladin', 1, d2.x, d2.y - sens * 0.85, 0);
  C.updateVision(g2);
  const seenCov = C.canSee(g2, 1, tgt);
  tgt.x = d2.x + d2.r + 300; obs.x = tgt.x; obs.y = tgt.y - sens * 0.85; C.updateVision(g2);
  const seenOpen = C.canSee(g2, 1, tgt);
  ok(!seenCov && seenOpen, 'Sicht in die Deckung −30 % (bei 85 % Reichweite: in Deckung unsichtbar, im Freien sichtbar)');
  obs.x = d2.x; obs.y = d2.y - sens * 0.5; tgt.x = d2.x; tgt.y = d2.y; C.updateVision(g2);
  ok(C.canSee(g2, 1, tgt), 'aus der Nähe (50 %) auch in Deckung sichtbar');
  /* Tempo −20 % */
  const g3 = X.createGame(two('haven')), d3 = g3.map.debris[0], m1 = X.addShip(g3, 'paladin', 0, d3.x, d3.y, 0);
  C.updateVision(g3);
  const top = u => { u.v = 0; u.ang = 0; for (let i = 0; i < 300; i++) C.steer(g3, u, u.x + 5000, u.y, X.STEP, false); return u.v; };
  const vc = top(m1); m1.cov = false; const vo = top(m1);
  ok(Math.abs(vc / vo - 0.8) < 0.02, 'Tempo im Trümmerfeld −20 % (' + vc.toFixed(1) + ' / ' + vo.toFixed(1) + ')');
}

/* ---------- 5. Zufallskarte ---------- */
{
  const key = m => JSON.stringify([m.starts, m.nodes.map(n => [n.x, n.y, n.amount]), m.rocks.map(o => [o.x, o.y, o.r]), m.nebs, m.fields, m.sites.map(s => [s.kind, s.x, s.y]), m.debris]);
  for (let np = 2; np <= 8; np++) {
    let bad = 0, reach = 0, minN = 1e9, maxN = 0, mirN = 0, plugN = 0, opN = 0;
    for (const ms of [1, 2, 3, 77, 4242, 99991]) {
      const m = X.generateMap('random', np, 5, 'normal', undefined, ms);
      if (C.mapReachable(m)) reach++;
      /* gleiche Vorkommen je Start: jedes Vorkommen dem nächsten Start zuordnen (Gleichstand teilen) */
      const sum = m.starts.map(() => 0);
      for (const n of m.nodes) { const ds = m.starts.map(s => Math.hypot(s.x - n.x, s.y - n.y)), dm = Math.min(...ds), near = ds.map((d, i) => d - dm < 1 ? i : -1).filter(i => i >= 0); for (const i of near) sum[i] += n.amount / near.length; }
      const lo = Math.min(...sum), hi = Math.max(...sum);
      if (hi - lo > hi * 0.01) bad++;
      minN = Math.min(minN, m.nodes.length); maxN = Math.max(maxN, m.nodes.length);
      if (m.rand.mir) mirN++; plugN += m.rocks.some(o => o.plug) ? 1 : 0; opN += m.sites.some(s => G('OUTPOST')[s.kind]) ? 1 : 0;
      /* Starts im Kreis um die Mitte, alle gleich weit */
      const rs = m.starts.map(s => Math.hypot(s.x - m.w / 2, s.y - m.h / 2));
      if (Math.max(...rs) - Math.min(...rs) > 1) bad++;
      /* derselbe Startwert: dieselbe Karte */
      if (key(m) !== key(X.generateMap('random', np, 9, 'normal', undefined, ms))) bad++;
    }
    const a = X.generateMap('random', np, 5, 'normal', undefined, 11), b = X.generateMap('random', np, 5, 'normal', undefined, 12);
    ok(reach === 6 && !bad && key(a) !== key(b), np + ' Spieler: 6 Startwerte erreichbar, Vorkommen je Start gleich, gleicher Startwert = gleiche Karte, anderer = andere (' + minN + '–' + maxN + ' Vorkommen, Spiegelung ' + mirN + '/6, Pfropfen ' + plugN + '/6, Stationen ' + opN + '/6)');
  }
  /* opts.seed ohne mseed (Mehrspieler: der Startwert der Lobby) */
  const g1 = X.createGame({ map: 'random', seed: 321, players: [{ faction: 'alliance', ai: 2 }, { faction: 'mars', ai: 2 }] });
  ok(g1.map.mseed === 321 && JSON.stringify(g1.map.nodes) === JSON.stringify(X.generateMap('random', 2, 321).nodes), 'ohne mseed bestimmt opts.seed die Zufallskarte (Lobby »Neu würfeln«)');
}

/* ---------- 6. Gleichschritt, Spielstand ---------- */
{
  const opts = { map: 'random', mseed: 2026, seed: 17, hazards: true, players: [{ faction: 'alliance', ai: 3 }, { faction: 'mars', ai: 3 }, { faction: 'brood', ai: 3 }] };
  const run = () => { const g = X.createGame(JSON.parse(JSON.stringify(opts))), out = []; while (!g.over && g.time < 420) { X.stepGame(g); g.ev.length = 0; if (g.tick % 30 === 0) out.push(X.stateHash(g)); } return out; };
  const a = run(), b = run();
  ok(a.length > 100 && a.every((h, i) => h === b[i]), 'Gleichschritt: Zufallskarte mit Gefahren, 3 KI, 420 s');
  /* Spielstand: gesprengter Fels bleibt gesprengt, Station gehört weiter ihrem Besitzer, gleiche Prüfsumme danach */
  const g = X.createGame({ map: 'maelstrom', seed: 5, hazards: true, players: [{ faction: 'alliance', ai: 2 }, { faction: 'mars', ai: 2 }] });
  step(g, 30);
  const e = g.rocks.find(r => r.plug); X.damage(g, e, 1e6, 'kin', null, 0, e.x, e.y);
  const half = g.rocks.find(r => !r.dead && !r.plug); X.damage(g, half, half.hpMax * 0.5, 'kin', null, 0, half.x, half.y);
  const op = g.sites.find(s => G('OUTPOST')[s.kind]); if (op) op.owner = 1;
  const raw = JSON.stringify(C.saveGame(g)), h = C.loadGame(JSON.parse(raw));
  const navSame = h && [0, 1, 2].every(c => h.map.nav[c].every((v, i) => v === g.map.nav[c][i]));
  ok(h && h.rocks[g.rocks.indexOf(e)].dead && h.map.rocks[e.ri].gone && !h.byId.get(e.id) && navSame, 'Spielstand: gesprengter Fels bleibt gesprengt, Raster wie vor dem Speichern');
  ok(h && Math.abs(h.rocks[g.rocks.indexOf(half)].hp - half.hp) < 1e-9 && h.byId.get(half.id) === h.rocks[g.rocks.indexOf(half)], 'Spielstand: angeschlagener Fels behält seine Hülle');
  ok(!op || h.sites[g.sites.indexOf(op)].owner === 1, 'Spielstand: Station behält ihren Besitzer');
  /* zweimal derselbe Spielstand geladen: beide laufen im Gleichschritt (Mehrspieler-Abgleich, Fortsetzen) */
  const h2 = C.loadGame(JSON.parse(raw));
  let same = true; for (let i = 0; i < 30 * 60; i++) { X.stepGame(h); X.stepGame(h2); h.ev.length = 0; h2.ev.length = 0; if (i % 30 === 0 && X.stateHash(h) !== X.stateHash(h2)) same = false; }
  ok(same && X.stateHash(h) === X.stateHash(h2), 'geladener Stand läuft im Gleichschritt (zweimal geladen, 60 s)');
}
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
