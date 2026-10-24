/* ===== ai.js ===== */
'use strict';
/* =====================================================================
   KI – Wirtschaft aufbauen, ausbreiten, Flotte sammeln, angreifen, verteidigen. Drei Stufen (AI_LEVELS).
   Die KI benutzt dieselben Befehle wie der Spieler (cmdBuild, cmdTrain, cmdMove …) und sieht nur, was ihre Sensoren
   sehen; nur die Startplätze der Gegner kennt sie wie jeder Spieler aus der Kartenübersicht.
   ===================================================================== */
function aiInit(level) { return { lvl: level, cfg: AI_LEVELS[level] || AI_LEVELS[2], next: 2 + level, atk: null, atkT: 0, tur: 0, lastB: -99, exp: 0, retreat: 0 }; }
/* Freien Platz für eine Station um einen Ankerpunkt suchen (Ringe nach außen, deterministisch über g.rng) */
function aiSpot(g, pi, role, ax, ay, r0, r1) {
  for (let r = r0; r <= r1; r += 46) {
    const n = Math.max(6, Math.round(r / 30)), a0 = g.rng() * TAU;
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n, x = ax + dcos(a) * r, y = ay + dsin(a) * r; if (!canPlace(g, pi, role, x, y)) return { x, y }; }
  }
  return null;
}
function aiBuild(g, pi, role, ax, ay, r0, r1) {
  const p = g.players[pi], def = bdef(g, pi, role);
  if (!def || !canPay(p, def.lv[0].cost) || buildReq(g, pi, role)) return false;
  const builders = g.ships.filter(u => !u.dead && u.owner === pi && u.def.build && (u.o.t === 'idle' || u.o.t === 'move'));
  if (!builders.length) return false;
  const s = aiSpot(g, pi, role, ax, ay, r0, r1);
  if (!s) return false;
  const why = cmdBuild(g, pi, [builders[0].id], role, s.x, s.y);
  if (!why) p.ai.lastB = g.time;
  return !why;
}
function aiTrain(g, pi, id) {
  const yards = g.bldgs.filter(b => !b.dead && b.owner === pi && b.role === 'yard' && b.done && b.lv >= SHIPS[id].yard).sort((a, b) => a.q.length - b.q.length);
  if (!yards.length) return false;
  return !cmdTrain(g, pi, yards[0].id, id);
}
function aiEnemyStart(g, pi) {
  const p = g.players[pi];
  let best = null, bd = 1e9;
  for (const q of g.players) { if (!q.alive || q.neutral || q.threat || q.team === p.team) continue; const d = hyp(q.start.x - p.start.x, q.start.y - p.start.y); if (d < bd) { bd = d; best = q.start; } }
  return best;
}
/* Nächstes bekanntes feindliches Ziel: sichtbare Station, sonst der Startplatz des nächsten Gegners */
function aiTarget(g, pi, x, y) {
  let best = null, bd = 1e9;
  /* Teamspiel: Ziele, die ein Verbündeter gerade angreift, sind deutlich attraktiver (gemeinsamer Angriff) */
  const p = g.players[pi], focus = new Set(); for (const q of g.players) if (q !== p && q.alive && !q.neutral && q.team === p.team && q.ai && q.ai.atk && q.ai.atk.tid) focus.add(q.ai.atk.tid);
  for (const b of g.bldgs) { if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].pirate || !g.players[pi].explored[clamp((b.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((b.x / VIS) | 0, 0, g.vw - 1)]) continue; const d = hyp(b.x - x, b.y - y) + (b.role === 'base' ? 300 : 0) + (b.role === 'turret' || b.role === 'flak' ? 200 : 0) - (focus.has(b.id) ? 900 : 0); if (d < bd) { bd = d; best = { x: b.x, y: b.y, id: b.id }; } }
  if (best) return best;
  /* spät im Spiel: versprengte Reste aufspüren (ein letztes Geschütz hält eine Partei sonst ewig am Leben) */
  if (g.time > 600) for (const b of g.bldgs) { if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].neutral) continue; const d = hyp(b.x - x, b.y - y); if (d < bd) { bd = d; best = { x: b.x, y: b.y, id: b.id }; } }
  if (best) return best;
  const s = aiEnemyStart(g, pi);
  return s ? { x: s.x, y: s.y } : null;
}
function aiThink(g, pi) {
  const p = g.players[pi], A = p.ai, cfg = A.cfg, f = p.faction, t = g.time;
  /* Brood: alles ist Biomasse (Eis); Erz-Schwellen gelten dann für Eis */
  const ore = p.F.bio ? p.ice : p.ore;
  const mine = g.bldgs.filter(b => !b.dead && b.owner === pi), base = mine.find(b => b.role === 'base');
  /* Schiffe mit Sonderauftrag (u.task, etwa Wache an einer Kolonie) führt die KI nicht */
  const ships = g.ships.filter(u => !u.dead && !u.derelict && u.owner === pi && u.def.role !== 'fighter' && !u.task && !u.gar);
  const builders = ships.filter(u => u.def.build), tankers = ships.filter(u => u.def.cargo), fleet = ships.filter(u => armed(u));
  const anchor = base || mine[0];
  if (!anchor) return;
  const yards = mine.filter(b => b.role === 'yard' && b.done), refs = mine.filter(b => b.role === 'refinery'), reactors = mine.filter(b => b.role === 'reactor');
  const lab = mine.find(b => b.role === 'lab'), relays = mine.filter(b => b.role === 'relay'), turrets = mine.filter(b => b.role === 'turret' || b.role === 'flak' || b.role === 'spore');
  const building = mine.filter(b => !b.done), toward = aiEnemyStart(g, pi) || { x: g.map.w / 2, y: g.map.h / 2 };
  const dirA = datan2(toward.y - anchor.y, toward.x - anchor.x);
  /* Bauschiff weg: ersetzen, sonst Baustellen weiterbauen */
  if (!builders.length) { if (yards.length) aiTrain(g, pi, BUILDER[f]); }
  else {
    const idle = builders.filter(u => u.o.t === 'idle');
    for (const b of building) if (idle.length && !builders.some(u => u.o.t === 'build' && u.o.bid === b.id)) { cmdResume(g, pi, [idle[0].id], b.id); idle.shift(); }
    /* Legion: ruhende Heldenschiffe wieder erwecken */
    const dorm = g.ships.find(u => !u.dead && u.derelict && u.owner === pi && u.def.hero);
    if (dorm && idle.length && !g.ships.some(u => !u.dead && foes(g, pi, u.owner) && u.def.wpn.length && hyp(u.x - dorm.x, u.y - dorm.y) < 500)) { cmdMove(g, [idle[0]], dorm.x + 30, dorm.y, false); idle.shift(); }
    /* zweites Bauschiff auf Schwer */
    if (cfg.exp >= 3 && builders.length < 2 && t > 240 && yards.length && p.ice > 800) aiTrain(g, pi, BUILDER[f]);
  }
  /* ---- Wirtschaft (höchstens eine Station je Denkpause) ---- */
  let built = false;
  const rich = p.ice > 500 && ore > 250;
  if (!yards.length && !building.some(b => b.role === 'yard')) built = aiBuild(g, pi, 'yard', anchor.x + dcos(dirA) * 60, anchor.y + dsin(dirA) * 60, 150, 320);
  if (!built && p.eUse + 8 >= p.eGen && !building.some(b => b.role === 'reactor')) built = aiBuild(g, pi, 'reactor', anchor.x, anchor.y, 130, 360);
  if (!built && p.cpUse + p.queued + 4 >= p.cpMax && !building.some(b => b.role === 'relay') && relays.length < 4) built = aiBuild(g, pi, 'relay', anchor.x, anchor.y, 140, 380);
  /* Ausbreitung: neue Raffinerie an einem Vorkommen ohne eigene Raffinerie in der Nähe */
  if (!built && t > 60 && !building.some(b => b.role === 'refinery')) {
    const want = refs.length < 1 + Math.min(cfg.exp, 1 + Math.floor(t / 240));
    if (want && rich) {
      let bestN = null, bd = 1e9;
      for (const n of g.nodes) {
        if (n.amount < n.max * 0.3) continue;
        if (refs.some(r => hyp(r.x - n.x, r.y - n.y) < 520)) continue;
        if (g.bldgs.some(b => !b.dead && b.owner !== pi && hyp(b.x - n.x, b.y - n.y) < 480)) continue;
        const hasOre = refs.some(r => g.nodes.some(q => q.kind === 'ore' && q.amount > 0 && hyp(q.x - r.x, q.y - r.y) < 520));
        const d = hyp(n.x - anchor.x, n.y - anchor.y) + (n.kind === 'ore' ? (hasOre ? 150 : -400) : 0);
        if (d < bd) { bd = d; bestN = n; }
      }
      if (bestN) {
        const a = datan2(anchor.y - bestN.y, anchor.x - bestN.x), d = bestN.r + 140;
        built = aiBuild(g, pi, 'refinery', bestN.x + dcos(a) * d, bestN.y + dsin(a) * d, 0, 160);
        /* zu weit von der Basis: erst ein Relais als Brücke */
        const whyP = canPlace(g, pi, 'refinery', bestN.x + dcos(a) * d, bestN.y + dsin(a) * d);
        if (!built && (whyP === 'Zu weit von der Basis' || whyP === 'Außerhalb des Netzes')) {
          let nearest = null, nd = 1e9;
          for (const b of mine) { if (!b.done) continue; const q = hyp(b.x - bestN.x, b.y - bestN.y); if (q < nd) { nd = q; nearest = b; } }
          if (nearest) { const a2 = datan2(bestN.y - nearest.y, bestN.x - nearest.x), rd = f === 'nexus' ? 330 : 380; built = aiBuild(g, pi, 'relay', nearest.x + dcos(a2) * rd, nearest.y + dsin(a2) * rd, 0, 120); }
        }
      }
    }
  }
  if (!built && !lab && yards.length && t > 120 && rich && !building.some(b => b.role === 'lab')) built = aiBuild(g, pi, 'lab', anchor.x - dcos(dirA) * 80, anchor.y - dsin(dirA) * 80, 150, 340);
  /* Verteidigung: Türme vor der Basis und an Raffinerien */
  if (!built && t > 90 && turrets.length < cfg.def * 2 + Math.floor(t / 300) && rich && !building.some(b => b.role === 'turret' || b.role === 'flak' || b.role === 'spore')) {
    const role = f === 'mars' && turrets.length % 3 === 2 ? 'flak' : f === 'brood' && turrets.length % 3 === 2 ? 'spore' : 'turret';
    const at = turrets.length % 2 === 0 || refs.length < 2 ? anchor : refs[turrets.length % refs.length];
    built = aiBuild(g, pi, role, at.x + dcos(dirA) * 120, at.y + dsin(dirA) * 120, 80, 260);
  }
  /* zweite Werft auf Mittel und Schwer */
  if (!built && cfg.exp >= 2 && yards.length === 1 && t > 300 && p.ice > 900 && ore > 500 && !building.some(b => b.role === 'yard')) built = aiBuild(g, pi, 'yard', anchor.x, anchor.y, 180, 380);
  /* Ausbau: Labor, Werft, Basis, Raffinerien */
  if (!built && p.ice > 700 && ore > 450) {
    /* Reihenfolge: Labor II, Basis II (Doktrin), Werft II, Labor III, Werft III, Basis III, Raffinerien, Türme */
    const up = (lab && lab.done && lab.lv < 2 && lab) || (base && base.done && base.lv < 2 && t > 270 && base) || (yards[0] && yards[0].lv < 2 && lab && lab.lv >= 1 && yards[0]) || (lab && lab.done && lab.lv < 3 && t > 480 && lab) || (yards[0] && yards[0].lv < 3 && lab && lab.lv >= 2 && yards[0]) || (base && base.done && base.lv < 3 && t > 660 && base) || refs.find(r => r.done && r.lv < 2 && t > 200) || (cfg.def >= 2 && turrets.find(r => r.done && r.lv < 3 && t > 360)) || null;
    if (up && !up.upg) cmdUpgrade(g, pi, up.id);
  }
  /* Forschung: Wirtschaft zuerst, dann Kampf; immer die günstigste verfügbare */
  if (lab && lab.done && !p.research && p.ice > 450 && ore > 250) {
    const t = TECH[f].find(q => !p.tech[q.id] && q.lv <= lab.lv && canPay(p, q.cost));
    if (t) cmdResearch(g, pi, t.id);
  }
  /* Doktrin: Schwer kontert die Gegnerfraktion (rec), sonst zufällig */
  if (p.docAsk && !p.doctrine) {
    const foe = g.players.find(q => q.alive && !q.neutral && q.team !== p.team), list = DOCTRINES[f];
    let pick = cfg.exp >= 3 && foe ? list.find(d => d.rec === foe.faction) : null;
    if (!pick) pick = list[(g.rng() * list.length) | 0];
    cmdDoctrine(g, pi, pick.id);
  }
  /* Superwaffe (Mittel und Schwer) sobald Basis III und Labor II stehen */
  const sup = mine.find(b => b.role === 'super');
  if (!built && cfg.exp >= 2 && !sup && !buildReq(g, pi, 'super') && p.ice > 1200 && ore > 700) built = aiBuild(g, pi, 'super', anchor.x - dcos(dirA) * 120, anchor.y - dsin(dirA) * 120, 120, 360);
  if (sup && sup.done && sup.charge >= 1) aiSuper(g, pi, sup, fleet);
  /* ---- Frachter ---- */
  const nodesNear = refs.filter(r => r.done).reduce((n, r) => n + g.nodes.filter(q => q.amount > 0 && hyp(q.x - r.x, q.y - r.y) < 520).length, 0);
  const wantT = Math.min(cfg.tankers * Math.max(1, refs.filter(r => r.done).length), 2 + nodesNear * 2);
  if (tankers.length + (p.queued ? 1 : 0) < wantT && yards.length && p.ice > 260) { if (!yards.some(b => b.q.some(q => SHIPS[q.id].cargo))) aiTrain(g, pi, TANKER[f]); }
  /* Brood: Grazer fressen Wracks in der Nähe */
  if (f === 'brood') for (const u of tankers) if (u.o.t === 'idle' || (u.o.t === 'harvest' && u.cargo < 10)) { let best = null, bd = 900; for (const w of g.ships) { if (w.dead || !w.derelict || w.def.hero && w.owner === pi) continue; const d = hyp(w.x - u.x, w.y - u.y); if (d < bd && !g.ships.some(e => !e.dead && foes(g, pi, e.owner) && e.def.wpn.length && hyp(e.x - w.x, e.y - w.y) < 400)) { bd = d; best = w; } } if (best) { execCmd(g, { t: 'eat', p: pi, u: [u.id], id: best.id }); } }
  /* Frachter ohne Arbeit: zum nächsten Vorkommen */
  for (const u of tankers) if (u.o.t === 'idle') { const n = pickNode(g, pi, u.x, u.y, 1600) || nearestNode(g, u.x, u.y, null, 2000); if (n) { cmdHarvest(g, [u], n); u.o.auto = 1; } }
  /* ---- Flotte bauen ---- */
  if (yards.length && (tankers.length >= Math.min(2, wantT) || t > 200)) {
    const labL = labLevel(g, pi), yardL = Math.max(...yards.map(b => b.lv));
    const pool = Object.values(SHIPS).filter(d => d.f === f && (d.role === 'war' || d.role === 'carrier')).filter(d => !d.hidden && d.tier - 1 <= labL && d.yard <= yardL && !d.flag && (!d.doc || d.doc === p.doctrine) && d.wpn.length && d.id !== 'larva');
    const flag = Object.values(SHIPS).find(d => d.f === f && d.flag);
    if (flag && t > 420 && ore > flag.cost.ore + 300 && !trainReq(g, pi, flag.id)) aiTrain(g, pi, flag.id);
    const cheap = pool.filter(d => d.cls === 's'), mid = pool.filter(d => d.cls === 'm'), big = pool.filter(d => d.cls === 'l');
    /* gewichtete Wahl: Unterstützer seltener (aiW) */
    const wpick = list => { let tot = 0; for (const d of list) tot += d.aiW; let r = g.rng() * tot; for (const d of list) { r -= d.aiW; if (r <= 0) return d; } return list[list.length - 1]; };
    const n = fleet.length, pick = () => {
      const r = g.rng();
      if (big.length && r < 0.22 && ore > 800) return wpick(big);
      if (mid.length && r < 0.55 && ore > 450) return wpick(mid);
      /* Korvetten früh, später mehr Fregatten */
      const frig = cheap.filter(d => d.cp >= 2), corv = cheap.filter(d => d.cp < 2);
      if (frig.length && (n > 3 || g.rng() < 0.5)) return wpick(frig);
      return corv.length ? wpick(corv) : cheap[0];
    };
    for (const y of yards) if (y.q.length < (cfg.exp >= 2 ? 2 : 1) && p.cpUse + p.queued < p.cpMax - 1) { const d = pick(); if (d && canPay(p, shipCost(p, d))) cmdTrain(g, pi, y.id, d.id); }
    for (const y of yards) if (!y.rally) cmdRally(g, pi, y.id, anchor.x + dcos(dirA) * 300, anchor.y + dsin(dirA) * 300);
  }
  /* Nexus: Splitter und Prismen verschmelzen, wenn drei beisammen sind */
  if (f === 'nexus' && t > 120) {
    for (const type of ['shard', 'prism', 'monolith']) {
      const list = fleet.filter(u => u.type === type && (u.o.t === 'idle' || u.o.t === 'move'));
      const nx = SHIPS[SHIPS[type].merge];
      if (list.length >= 3 && nx && (!nx.doc || p.doctrine === nx.doc)) { const a = list[0], near = list.filter(u => hyp(u.x - a.x, u.y - a.y) < 180); if (near.length >= 3) cmdMerge(g, pi, near.slice(0, 3).map(u => u.id)); else cmdMove(g, list.slice(0, 3), a.x, a.y, false, 'block'); }
    }
  }
  /* ---- Flotte führen ---- */
  const cpF = fleet.reduce((s, u) => s + u.def.cp, 0);
  const hurt = t - p.hurtT < 20;
  /* Wellen: Belohnung wählen, Flotte zum Siegel oder zur eigenen Basis, nie angreifen */
  if (g.wave) {
    aiReward(g, p);
    const tg = waveTarget(g);
    if (g.wave.phase === 'wave') { if (t - A.defT > 10 || !A.defT) { A.defT = t; const idle = fleet.filter(u => u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am)); if (idle.length) cmdMove(g, idle, tg.x + dcos(dirA) * 160, tg.y + dsin(dirA) * 160, true, 'wedge'); } }
    else if (hurt && fleet.length) { if (t - A.defT > 8 || !A.defT) { A.defT = t; cmdMove(g, fleet, p.hurtX, p.hurtY, true, 'wedge'); } }
    else { const rp = { x: tg.x + dcos(dirA) * 240, y: tg.y + dsin(dirA) * 240 }; const idle = fleet.filter(u => u.o.t === 'idle' && hyp(u.x - rp.x, u.y - rp.y) > 260); if (idle.length) cmdMove(g, idle, rp.x, rp.y, false, 'wedge'); }
    return;
  }
  if (hurt && fleet.length) {
    /* Verteidigung: alle, die nicht gerade weit weg angreifen */
    const def = fleet.filter(u => !A.atk || hyp(u.x - p.hurtX, u.y - p.hurtY) < 1500 || u.o.t === 'idle');
    if (def.length && (t - A.defT > 8 || !A.defT)) { A.defT = t; cmdMove(g, def, p.hurtX, p.hurtY, true, 'wedge'); }
  } else if (!A.atk && fleet.length >= 3 && (() => { for (const q of g.players) if (q !== p && q.alive && !q.neutral && q.team === p.team && t - q.hurtT < 15 && hyp(q.hurtX - anchor.x, q.hurtY - anchor.y) < 2600) { A.help = q; return true; } return false; })()) {
    /* Verbündeter wird angegriffen: zwei Drittel der freien Flotte helfen, der Rest bleibt zu Hause */
    const q = A.help, free = fleet.filter(u => u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am));
    if (free.length && (t - (A.helpT || -99) > 10)) { A.helpT = t; cmdMove(g, free.slice(0, Math.ceil(free.length * 2 / 3)), q.hurtX, q.hurtY, true, 'wedge'); }
  } else if (A.atk) {
    /* laufender Angriff: Ziel prüfen, Rückzug bei schweren Verlusten, nachrücken */
    const alive = fleet.filter(u => A.atk.ids.indexOf(u.id) >= 0), cp = alive.reduce((s, u) => s + u.def.cp, 0);
    if (!alive.length || cp < A.atk.cp * 0.35) { if (alive.length) cmdMove(g, alive, anchor.x + dcos(dirA) * 260, anchor.y + dsin(dirA) * 260, false, 'wedge'); A.atk = null; A.atkT = t; }
    else if (t - A.atk.t0 > 14) {
      const tg = aiTarget(g, pi, alive[0].x, alive[0].y);
      if (!tg) { A.atk = null; }
      else { const idle = alive.filter(u => u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am)); if (idle.length) cmdMove(g, idle, tg.x, tg.y, true, 'wedge'); A.atk.t0 = t; A.atk.tid = tg.id || 0; }
    }
  } else {
    /* ein Gegner ohne Basis und Werft kann sich nicht mehr erholen: dann reicht eine kleine Flotte, um ihn zu erledigen */
    const weakFoe = t > 300 && g.players.some(q => q.alive && !q.neutral && !q.threat && q.team !== p.team && !g.bldgs.some(b => !b.dead && b.owner === q.id && (b.role === 'base' || b.role === 'yard')));
    const ready = t > cfg.first && t - A.atkT > 30 && (cpF >= cfg.army + Math.min(16, Math.floor(t / 150) * 2) || (weakFoe && cpF >= 4));
    if (ready) {
      const tg = aiTarget(g, pi, anchor.x, anchor.y);
      if (tg) { cmdMove(g, fleet, tg.x, tg.y, true, 'wedge'); A.atk = { ids: fleet.map(u => u.id), cp: cpF, t0: t, tid: tg.id || 0 }; ev(g, 'aiattack', { owner: pi }); }
    } else {
      /* sammeln vor der Basis; Verwundete zur Werft */
      const rp = { x: anchor.x + dcos(dirA) * 300, y: anchor.y + dsin(dirA) * 300 };
      const idle = fleet.filter(u => u.o.t === 'idle' && hyp(u.x - rp.x, u.y - rp.y) > 220);
      if (idle.length) cmdMove(g, idle, rp.x, rp.y, false, 'wedge');
      const hurtS = fleet.filter(u => u.hull < u.hullMax * 0.5 && u.o.t === 'idle' && yards.length);
      if (hurtS.length) { const y = yards[0]; cmdMove(g, hurtS, y.x + dcos(dirA) * (y.def.r + 40), y.y + dsin(dirA) * (y.def.r + 40), false, 'line'); }
    }
  }
}

/* Superwaffe einsetzen: Exodus-Tor versetzt die gesammelte Flotte vor ein bekanntes Ziel; Massetreiber trifft die
   dichteste bekannte feindliche Stelle (Stationen bevorzugt) */
function aiSuper(g, pi, sup, fleet) {
  const p = g.players[pi], A = p.ai, lv = lvOf(sup);
  if (p.faction === 'alliance') {
    const near = fleet.filter(u => hyp(u.x - sup.x, u.y - sup.y) <= lv.sr && u.def.cp >= 1);
    const cp = near.reduce((s, u) => s + u.def.cp, 0);
    if (cp < A.cfg.army) { if (!A.gather || g.time - A.gather > 60) { A.gather = g.time; const idle = fleet.filter(u => u.o.t === 'idle'); if (idle.length) cmdMove(g, idle, sup.x, sup.y, false, 'block'); } return; }
    const tg = aiTarget(g, pi, sup.x, sup.y);
    if (!tg) return;
    const a = datan2(p.start.y - tg.y, p.start.x - tg.x);
    if (!cmdSuper(g, pi, tg.x + dcos(a) * 420, tg.y + dsin(a) * 420)) { A.atk = { ids: near.map(u => u.id), cp, t0: g.time - 20 }; ev(g, 'aiattack', { owner: pi }); }
  } else {
    let best = null, bs = 0;
    for (const b of g.bldgs) {
      if (b.dead || !foes(g, pi, b.owner) || !p.explored[clamp((b.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((b.x / VIS) | 0, 0, g.vw - 1)]) continue;
      let sc = 0;
      for (const o of g.bldgs) if (!o.dead && o.owner === b.owner && hyp(o.x - b.x, o.y - b.y) <= lv.sr) sc += o.role === 'base' ? 3 : o.role === 'yard' ? 2 : 1;
      if (sc > bs) { bs = sc; best = b; }
    }
    if (best) cmdSuper(g, pi, best.x, best.y);
  }
}
