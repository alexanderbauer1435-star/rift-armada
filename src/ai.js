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
  for (const b of g.bldgs) { if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].pirate || !g.players[pi].explored[clamp((b.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((b.x / VIS) | 0, 0, g.vw - 1)]) continue; const q = g.players[b.owner], far = !q.neutral && hyp(b.x - q.start.x, b.y - q.start.y) > 1300, d = hyp(b.x - x, b.y - y) + (b.role === 'base' && !far ? 300 : 0) + (b.role === 'turret' || b.role === 'flak' ? 200 : 0) - (focus.has(b.id) ? 900 : 0) - (far && (b.role === 'refinery' || b.role === 'base' || b.role === 'relay') ? 350 : 0); if (d < bd) { bd = d; best = { x: b.x, y: b.y, id: b.id }; } }
  if (best) return best;
  /* spät im Spiel: versprengte Reste aufspüren (ein letztes Geschütz hält eine Partei sonst ewig am Leben) */
  if (g.time > 600) for (const b of g.bldgs) { if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].neutral) continue; const d = hyp(b.x - x, b.y - y); if (d < bd) { bd = d; best = { x: b.x, y: b.y, id: b.id }; } }
  if (best) return best;
  const s = aiEnemyStart(g, pi);
  return s ? { x: s.x, y: s.y } : null;
}
const AI_DOLE = { ice: 8, ore: 4 };
/* Schalter für Messläufe (tools/balance/matrix.js, Umgebung AIOPT='{"caut":0}') */
var AI_OPT = { caut: 1, fit: 1, focus: 1, raid: 1 };
/* Fenster für den ersten Angriff je Stärke (Sekunden): Leicht spät, Schwer früher – innerhalb des Fensters zufällig */
const AI_FIRST = { 1: [540, 900], 2: [420, 780], 3: [300, 600] };
function aiThink(g, pi) {
  const p = g.players[pi], A = p.ai, cfg = A.cfg, f = p.faction, t = g.time;
  /* Brood: alles ist Biomasse (Eis); Erz-Schwellen gelten dann für Eis */
  const ore = p.F.bio ? p.ice : p.ore;
  const mine = g.bldgs.filter(b => !b.dead && b.owner === pi), base = mine.find(b => b.role === 'base');
  /* Notgroschen: hat die KI seit 45 s nichts verdient und ist fast pleite, bekommt sie ein kleines Grundeinkommen
     (etwa ein Frachter in 40 s) – genug, um Frachter und eine Raffinerie neu zu bauen, nicht genug für eine Flotte */
  if (A.earnT === undefined || p.stats.earned > A.earned) { A.earned = p.stats.earned; A.earnT = t; }
  const broke = t - A.earnT > 45 && (p.ice < 400 || (!p.F.bio && p.ore < 250)) && mine.some(b => b.done);
  if (broke) { const dtA = Math.min(5, t - (A.doleT || t)); p.ice += AI_DOLE.ice * dtA; if (!p.F.bio) p.ore += AI_DOLE.ore * dtA; A.dole = (A.dole || 0) + dtA; }
  /* Erz-Notgroschen: viel Eis, aber seit 60 s kein Erz mehr (alle Erzfelder leer) – sonst steht die Flotte still */
  if (!p.F.bio) { if (A.oreT === undefined || p.ore > (A.oreLast || 0) + 1) A.oreT = t; A.oreLast = p.ore; if (!broke && t - A.oreT > 60 && p.ore < 200 && mine.some(b => b.done)) { p.ore += AI_DOLE.ore * Math.min(5, t - (A.doleT || t)); } }
  A.doleT = t;
  /* Schiffe mit Sonderauftrag (u.task, etwa Wache an einer Kolonie) führt die KI nicht */
  const ships = g.ships.filter(u => !u.dead && !u.derelict && u.owner === pi && u.def.role !== 'fighter' && !u.task && !u.gar);
  const builders = ships.filter(u => u.def.build), tankers = ships.filter(u => u.def.cargo), fleet = ships.filter(u => armed(u) && !u.retreat && !u.rfq);
  /* Gefecht (Mittel, Schwer): angeschlagene Schiffe ab Fregatte ziehen sich zur Werft zurück und kommen repariert wieder */
  /* (nicht die Legion: ihre Helden fallen als ruhende Wracks und werden vom Restorer geweckt – Rückzug kostete sie Partien) */
  if (A.lvl >= 2 && AI_OPT.caut && f !== 'legion') for (const u of fleet) if (u.stance === 0 && (u.def.cls !== 's' || u.def.cp >= 2)) u.stance = 3;
  /* Aufklärung: welche Größenklassen hat der Gegner? (gleitendes Mittel über die gesichteten Schiffe) */
  aiScout(g, pi);
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
  /* ausgehungert: an keiner eigenen Raffinerie liegt noch ein ergiebiges Vorkommen – dann hat die Ausbreitung Vorrang
     (sonst gibt eine Fraktion, die alles in Schiffe steckt, nie genug für eine neue Raffinerie aus) */
  const refsNow = mine.filter(b => b.role === 'refinery' && b.done);
  let left = 0; for (const n of g.nodes) if (n.amount > 0 && refsNow.some(r => hyp(n.x - r.x, n.y - r.y) < 560)) left += n.amount;
  const starving = t > 150 && left < 6000;
  if (!yards.length && !building.some(b => b.role === 'yard')) built = aiBuild(g, pi, 'yard', anchor.x + dcos(dirA) * 60, anchor.y + dsin(dirA) * 60, 150, 320);
  if (!built && p.eUse + 8 >= p.eGen && !building.some(b => b.role === 'reactor')) built = aiBuild(g, pi, 'reactor', anchor.x, anchor.y, 130, 360);
  if (!built && p.cpUse + p.queued + 4 >= p.cpMax && !building.some(b => b.role === 'relay') && relays.length < 4) built = aiBuild(g, pi, 'relay', anchor.x, anchor.y, 140, 380);
  /* Ausbreitung: neue Raffinerie an einem Vorkommen ohne eigene Raffinerie in der Nähe */
  if (!built && t > 60 && !building.some(b => b.role === 'refinery')) {
    const want = refs.length < 1 + Math.min(cfg.exp, 1 + Math.floor(t / 240));
    if ((want || starving) && (rich || (starving && p.ice > 150))) {
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
        /* weit weg: lieber eine Außenbasis direkt am Vorkommen (sobald bezahlbar), sonst Relais als Brücke */
        if (!built && (whyP === 'Zu weit von der Basis' || whyP === 'Außerhalb des Netzes') && !building.some(b => b.role === 'base') && canPay(p, bcost(p, bdef(g, pi, 'base')))) {
          const a3 = datan2(anchor.y - bestN.y, anchor.x - bestN.x); built = aiBuild(g, pi, 'base', bestN.x + dcos(a3) * (bestN.r + 230), bestN.y + dsin(a3) * (bestN.r + 230), 0, 200);
        }
        if (!built && (whyP === 'Zu weit von der Basis' || whyP === 'Außerhalb des Netzes') && mine.filter(b => b.role === 'relay').length < 8 && !building.some(b => b.role === 'relay')) {
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
    if (up && !up.upg) cmdUpgrade(g, pi, up.id, up.role === 'turret' && up.lv === 1 && up.def.sp ? aiTurretSpec(g, pi, up) : undefined);
  }
  /* Fassung 22 (Mittel, Schwer): Frühwarnstation, Reparaturdock, Schildwälle an Engstellen vor der Basis */
  if (!built && A.lvl >= 2 && rich) built = aiDefense22(g, pi, mine, anchor, dirA, building, turrets);
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
  /* ---- Bergung: ein Frachter zerlegt ein lohnendes Wrack in der Nähe, wenn dort kein Feind ist ---- */
  if (anchor && (g.tick + pi * 13) % 150 === 0 && !tankers.some(u => u.o.t === 'salvage')) {
    const w = g.wrecks.find(q => q.sal >= 120 && hyp(q.x - anchor.x, q.y - anchor.y) < 1500 && !g.ships.some(e => !e.dead && foes(g, pi, e.owner) && e.def.wpn.length && hyp(e.x - q.x, e.y - q.y) < 600));
    const tk = w && tankers.find(u => u.o.t === 'harvest' && u.cargo < 10 && !u.def.net);
    if (tk) execCmd(g, { t: 'salvage', p: pi, u: [tk.id], w: w.id });
  }
  /* ---- Flotte bauen ---- (ausgehungert: erst sparen, bis die neue Raffinerie steht) */
  if (yards.length && (tankers.length >= Math.min(2, wantT) || t > 200) && !(starving && p.ice < 700 && !building.some(b => b.role === 'refinery'))) {
    const labL = labLevel(g, pi), yardL = Math.max(...yards.map(b => b.lv));
    const pool = Object.values(SHIPS).filter(d => d.f === f && (d.role === 'war' || d.role === 'carrier')).filter(d => !d.hidden && d.tier - 1 <= labL && d.yard <= yardL && !d.flag && (!d.doc || d.doc === p.doctrine) && d.wpn.length && d.id !== 'larva' && !d.art && !d.mines && !d.heal && !d.troop);
    const flag = Object.values(SHIPS).find(d => d.f === f && d.flag);
    if (flag && t > 420 && ore > flag.cost.ore + 300 && !trainReq(g, pi, flag.id)) aiTrain(g, pi, flag.id);
    const cheap = pool.filter(d => d.cls === 's'), mid = pool.filter(d => d.cls === 'm'), big = pool.filter(d => d.cls === 'l');
    /* gewichtete Wahl: Unterstützer seltener (aiW) */
    const wpick = list => { const w = list.map(d => d.aiW * aiFit(A, d)); let tot = 0; for (const x of w) tot += x; let r = g.rng() * tot; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; } return list[list.length - 1]; };
    /* Gegenzusammenstellung: viele große Gegner → mehr Torpedoträger und größere Schiffe; Schwärme → mehr Kleine mit Strahlen */
    const sh = A.seen || { s: 0.4, m: 0.4, l: 0.2 }, bigK = A.lvl >= 2 ? 0.22 + 0.15 * Math.max(0, sh.l - 0.25) : 0.22;
    const n = fleet.length, pick = () => {
      const r = g.rng();
      if (big.length && r < bigK && ore > 800) return wpick(big);
      if (mid.length && r < 0.55 && ore > 450) return wpick(mid);
      /* ab einer kleinen Flotte für größere Schiffe sparen statt nur Kleinzeug zu bauen */
      if ((mid.length && n >= 6 && r < 0.55) || (big.length && n >= 10 && r < bigK)) return null;
      /* Korvetten früh, später mehr Fregatten */
      const frig = cheap.filter(d => d.cp >= 2), corv = cheap.filter(d => d.cp < 2);
      if (frig.length && (n > 3 || g.rng() < 0.5)) return wpick(frig);
      return corv.length ? wpick(corv) : cheap[0];
    };
    for (const y of yards) if (y.q.length < (cfg.exp >= 2 ? 2 : 1) && p.cpUse + p.queued < p.cpMax - 1) { const d = pick(); if (d && canPay(p, shipCost(p, d))) cmdTrain(g, pi, y.id, d.id); }
    /* Belagerung (Mittel, Schwer): sieht die KI viele feindliche Türme, baut sie Artillerie (höchstens 2, später 3) */
    const artD = Object.values(SHIPS).find(d => d.f === f && d.art);
    if (artD && A.lvl >= 2 && yardL >= artD.yard && t > 360 && (g.tick + pi * 11) % 90 < 4) {
      let towers = 0; for (const b of g.bldgs) if (!b.dead && (b.role === 'turret' || b.role === 'flak' || b.role === 'spore') && foes(g, pi, b.owner) && !g.players[b.owner].neutral && artKnownAi(g, pi, b)) towers++;
      const have = ships.filter(u => u.def.art).length + yards.reduce((n, y) => n + y.q.filter(q => SHIPS[q.id].art).length, 0);
      if (towers >= 3 && have < (t > 1200 ? 4 : t > 900 ? 3 : 2) && canPay(p, shipCost(p, artD)) && p.cpUse + p.queued + artD.cp <= p.cpMax) aiTrain(g, pi, artD.id);
    }
    for (const y of yards) if (!y.rally) cmdRally(g, pi, y.id, anchor.x + dcos(dirA) * 300, anchor.y + dsin(dirA) * 300);
  }
  /* Fassung 22: Mittel und Schwer rüsten große Schiffe an der Werft nach, wenn genug Rohstoffe da sind */
  if (A.lvl >= 2 && t > 300) aiRefit(g, pi, ships);
  /* Nexus: Splitter und Prismen verschmelzen, wenn drei beisammen sind */
  if (f === 'nexus' && t > 120) {
    for (const type of ['shard', 'prism', 'monolith']) {
      const list = fleet.filter(u => u.type === type && (u.o.t === 'idle' || u.o.t === 'move'));
      const nx = SHIPS[SHIPS[type].merge];
      if (list.length >= 3 && nx && (!nx.doc || p.doctrine === nx.doc)) { const a = list[0], near = list.filter(u => hyp(u.x - a.x, u.y - a.y) < 180); if (near.length >= 3) cmdMerge(g, pi, near.slice(0, 3).map(u => u.id)); else cmdMove(g, list.slice(0, 3), a.x, a.y, false, 'block'); }
    }
  }
  /* Fassung 22: Minenleger, Reparaturschiffe, Truppentransporter */
  aiSupport(g, pi, ships, fleet, yards, anchor, dirA);
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
  /* Signal eines Verbündeten: »Hilfe« → zwei Drittel der freien Flotte kommen; »Angriff« → gemeinsamer Angriff dort, sobald
     wenigstens die halbe Angriffsstärke bereitsteht; »Sammeln« → freie Schiffe zum Treffpunkt */
  const pg = A.ping; if (pg && t - pg.t > 40) A.ping = null;
  if (A.ping && !hurt && fleet.length) {
    const free = fleet.filter(u => u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am));
    if (pg.k === 'help' && free.length && !pg.done) { pg.done = 1; cmdMove(g, free.slice(0, Math.ceil(free.length * 2 / 3)), pg.x, pg.y, true, 'wedge'); }
    else if (pg.k === 'go' && free.length && !pg.done) { pg.done = 1; cmdMove(g, free, pg.x, pg.y, false, 'wedge'); }
    else if (pg.k === 'atk' && !A.atk && !pg.done && cpF >= cfg.army * 0.5) { pg.done = 1; cmdMove(g, fleet, pg.x, pg.y, true, 'roles'); A.atk = { ids: fleet.map(u => u.id), cp: cpF, t0: t, tid: 0 }; ev(g, 'aiattack', { owner: pi }); }
  }
  /* Artillerie beschießt uns: schnelle Schiffe jagen die Stellung (Mündungsfeuer macht sie sichtbar) */
  if (p.artT && t - p.artT < 8 && fleet.length && t - (A.artHuntT || -99) > 10) {
    A.artHuntT = t; let tg = null, bd = 1e9;
    for (const e of g.ships) { if (e.dead || !e.def.art || !foes(g, pi, e.owner) || !canSee(g, pi, e)) continue; const d = hyp(e.x - p.artX, e.y - p.artY); if (d < bd) { bd = d; tg = e; } }
    const hunters = fleet.filter(u => !u.def.art && (u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am)) && !(A.atk && A.atk.ids.indexOf(u.id) >= 0)).sort((a, b) => b.def.speed - a.def.speed).slice(0, 4);
    if (hunters.length) { if (tg) execCmd(g, { t: 'attack', p: pi, u: hunters.map(u => u.id), e: tg.id }); else cmdMove(g, hunters, p.artX, p.artY, true, 'wedge'); }
  }
  if (!hurt && fleet.length && !g.wave) aiTerrain(g, pi, fleet, anchor, toward);   /* Fassung 22: Pfropfen sprengen, Stationen nehmen */
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
    else {
      if (A.lvl >= 2 && AI_OPT.focus) aiFocus(g, pi, alive);
      aiSiege(g, pi, alive);
      if (t - A.atk.t0 > 14) {
      const tg = aiTarget(g, pi, alive[0].x, alive[0].y);
      if (!tg) { A.atk = null; }
      else { const idle = alive.filter(u => u.o.t === 'idle' || (u.o.t === 'move' && !u.o.am)); if (idle.length) cmdMove(g, idle, tg.x, tg.y, true, 'roles'); A.atk.t0 = t; A.atk.tid = tg.id || 0; }
      }
    }
  } else {
    /* ein Gegner ohne Basis und Werft kann sich nicht mehr erholen: dann reicht eine kleine Flotte, um ihn zu erledigen */
    const weakFoe = t > 300 && g.players.some(q => q.alive && !q.neutral && !q.threat && q.team !== p.team && !g.bldgs.some(b => !b.dead && b.owner === q.id && (b.role === 'base' || b.role === 'yard')));
    /* Persönlichkeit je KI (einmal gewürfelt, deterministisch): erster Angriff früher oder später, Flottengröße, Pause
       zwischen Angriffen. So greift im selben Spiel die eine KI früh an, die andere baut erst in Ruhe auf. */
    if (A.first === undefined) { const w = AI_FIRST[A.lvl] || AI_FIRST[2]; A.first = w[0] + g.rng() * (w[1] - w[0]); A.armyK = 1.2 + g.rng() * 0.6; A.gapK = 0.6 + g.rng() * 1.2; }
    if (A.gap === undefined) A.gap = 40;
    const late = t > 1200 ? 0.6 : 1;   /* Fassung 22: spät im Spiel entschlossener angreifen (gegen Pattsituationen) */
    const ready = t > A.first && t - A.atkT > A.gap * late && (cpF >= Math.min((cfg.army * A.armyK + Math.min(16, Math.floor(t / 150) * 2)) * late, p.cpMax * 0.6) ||   /* Fassung 22: nie mehr verlangen, als die Kommandopunkte erlauben (sonst Patt) */ (weakFoe && cpF >= 4));
    if (ready) {
      const tg = aiTarget(g, pi, anchor.x, anchor.y);
      if (tg) { cmdMove(g, fleet, tg.x, tg.y, true, 'roles'); A.atk = { ids: fleet.map(u => u.id), cp: cpF, t0: t, tid: tg.id || 0 }; A.gap = (40 + g.rng() * 140) * A.gapK; ev(g, 'aiattack', { owner: pi }); }
    } else {
      /* sammeln vor der Basis; Verwundete zur Werft */
      const rp = { x: anchor.x + dcos(dirA) * 300, y: anchor.y + dsin(dirA) * 300 };
      if (A.lvl >= 2 && AI_OPT.raid) aiRaid(g, pi, fleet, anchor, rp);
      const idle = fleet.filter(u => u.o.t === 'idle' && hyp(u.x - rp.x, u.y - rp.y) > 220 && !(A.raid && A.raid.ids.indexOf(u.id) >= 0));
      if (idle.length) cmdMove(g, idle, rp.x, rp.y, false, 'wedge');
      const hurtS = fleet.filter(u => u.hull < u.hullMax * 0.5 && u.o.t === 'idle' && yards.length);
      if (hurtS.length) { const y = yards[0]; cmdMove(g, hurtS, y.x + dcos(dirA) * (y.def.r + 40), y.y + dsin(dirA) * (y.def.r + 40), false, 'line'); }
    }
  }
}

/* Fassung 22: Zweig für einen Turm, der auf Stufe II ausgebaut wird – nach dem, was die KI vom Gegner gesehen hat:
   viele Kleine → Flak, viele Große → Schwergeschütz; stehen schon zwei Kampftürme in der Nähe und noch kein Störsender,
   kommt ein Störsender dazu (er bremst Angreifer im Feuer der anderen) */
function aiTurretSpec(g, pi, b) {
  const A = g.players[pi].ai, sh = A.seen || { s: 0.4, m: 0.4, l: 0.2 };
  let armed = 0, jam = 0;
  for (const o of g.bldgs) if (!o.dead && o.owner === pi && o !== b && o.role === 'turret' && hyp(o.x - b.x, o.y - b.y) < 500) { if (o.spec === 'jam') jam++; else armed++; }
  if (armed >= 2 && !jam) return 'jam';
  if (sh.l > 0.3 && sh.l >= sh.s * 0.8) return 'heavy';
  if (sh.s > 0.45) return 'flak';
  return (b.id % 2) ? 'heavy' : 'flak';
}
function aiDefense22(g, pi, mine, anchor, dirA, building, turrets) {
  const p = g.players[pi], A = p.ai, t = g.time;
  if (building.some(b => b.role === 'radar' || b.role === 'dock' || b.role === 'wall')) return false;
  /* Frühwarnstation: eine, vor der Basis Richtung Gegner */
  if (t > 240 && !mine.some(b => b.role === 'radar')) { if (aiBuild(g, pi, 'radar', anchor.x + dcos(dirA) * 240, anchor.y + dsin(dirA) * 240, 40, 300)) return true; }
  /* Reparaturdock: eines, sobald eine Werft steht und die Flotte wächst */
  if (t > 420 && !mine.some(b => b.role === 'dock') && mine.some(b => b.role === 'yard' && b.done)) { if (aiBuild(g, pi, 'dock', anchor.x + dcos(dirA) * 200, anchor.y + dsin(dirA) * 200, 80, 320)) return true; }
  /* Schildwälle: bis zu cfg.def Stück, je einer an einem fertigen Turm; quer zur Angriffsrichtung, bevorzugt zur Seite, an
     der Felsen oder Feldränder liegen (so schließt der Wall mit dem Turm eine Engstelle) */
  const walls = mine.filter(b => b.role === 'wall');
  if (t < 360 || walls.length >= A.cfg.def - 1 ||   /* Fassung 22: ein Wall weniger – sonst zu viele Patt-Partien */ (g.tick + pi * 17) % 4) return false;
  const anc = turrets.filter(b => b.done && WALL_ANCHOR[b.role] && hyp(b.x - anchor.x, b.y - anchor.y) < 900 && !walls.some(w => w.link === b.id));
  if (!anc.length) return false;
  const builders = g.ships.filter(u => !u.dead && u.owner === pi && u.def.build && (u.o.t === 'idle' || u.o.t === 'move'));
  if (!builders.length || !canPay(p, bcost(p, bdef(g, pi, 'wall'))) || buildReq(g, pi, 'wall')) return false;
  const m = g.map, nav = m.nav[1], pa = dirA + Math.PI / 2;
  let best = null, bs = -1;
  for (const T of anc) for (const sg of [1, -1]) for (const L of [300, 250, 200]) {
    const x = T.x + dcos(pa) * sg * L, y = T.y + dsin(pa) * sg * L;
    if (canPlace(g, pi, 'wall', x, y) || !wallAnchor(g, pi, x, y, T.id)) continue;
    /* Engstelle: hinter dem Emitter (weiter auf derselben Linie) gesperrte Zellen */
    let sc = 0; for (let k = 1; k <= 6; k++) { const qx = x + dcos(pa) * sg * k * 32, qy = y + dsin(pa) * sg * k * 32, cx = (qx / NAV) | 0, cy = (qy / NAV) | 0; if (cx < 0 || cy < 0 || cx >= m.gw || cy >= m.gh || (nav[cy * m.gw + cx] & (1 | 2 | 4))) { sc += 7 - k; } }
    sc += L / 100;
    if (sc > bs) { bs = sc; best = { x, y, to: T.id }; }
    break;
  }
  if (!best) return false;
  const why = cmdBuild(g, pi, [builders[0].id], 'wall', best.x, best.y, best.to);
  if (!why) A.lastB = t;
  return !why;
}
/* Aufklärung: Anteil kleiner, mittlerer, großer Gegnerschiffe in Sicht, langsam gleitend (merkt sich, was es gesehen hat) */
function aiScout(g, pi) {
  const A = g.players[pi].ai; if ((g.tick + pi * 7) % 30 !== 0) return;
  const c = { s: 0, m: 0, l: 0 }; let n = 0;
  for (const u of g.ships) { if (u.dead || u.derelict || !foes(g, pi, u.owner) || g.players[u.owner].neutral || !armed(u) || u.def.role === 'fighter' || !canSee(g, pi, u)) continue; const k = u.def.cls === 'l' ? 'l' : u.def.cls === 'm' ? 'm' : 's'; c[k] += u.def.cp; n += u.def.cp; }
  if (!n) return; const s = A.seen || (A.seen = { s: 0.4, m: 0.4, l: 0.2 }), k = Math.min(0.5, n / 40);
  for (const q of ['s', 'm', 'l']) s[q] += (c[q] / n - s[q]) * k;
}
/* Wie gut passt ein Schiffstyp gegen die gesehene Zusammenstellung? (Konterfaktoren der Waffen, ×0,5 … ×2) */
function aiFit(A, d) {
  if (!A.seen || A.lvl < 2 || !AI_OPT.fit) return 1;
  let sum = 0, wsum = 0;
  for (const w of d.wpn) { if (w.kind === 'pd') continue; const C = COUNTER[w.kind]; if (!C) continue; const v = A.seen.s * C.s + A.seen.m * C.m + A.seen.l * C.l, dm = (w.dmg || 1) / (w.reload || 1); sum += v * dm; wsum += dm; }
  if (!wsum) return 1; const f = sum / wsum;
  return clamp(Math.pow(f, A.lvl >= 3 ? 4 : 2.5), 0.5, 2);
}
/* Zielauswahl im Gefecht: Torpedo- und Railgunschiffe nehmen gemeinsam die Waffen des stärksten großen Gegners ins Visier
   (Untersystem »Waffen«); ist es entwaffnet, geht es mit voller Wucht auf die Hülle */
function aiFocus(g, pi, alive) {
  const A = g.players[pi].ai; if (g.time - (A.focT || 0) < 6) return; A.focT = g.time;
  const c = alive[0]; if (!c) return; let big = null, bs = 0;
  for (const e of g.ships) { if (e.dead || e.derelict || !foes(g, pi, e.owner) || e.def.cls !== 'l' || !armed(e) || !canSee(g, pi, e) || hyp(e.x - c.x, e.y - c.y) > 1100) continue; const sc = e.def.cp * e.sub.wpn * (e.hull / e.hullMax); if (sc > bs) { bs = sc; big = e; } }
  if (!big) return;
  const sub = big.sub.wpn > 0.35 ? 'wpn' : undefined;
  const heavy = alive.filter(u => (u.o.t === 'amove' || u.o.t === 'idle' || (u.o.t === 'attack' && u.o.tid !== big.id)) && u.def.wpn.some(w => w.kind === 'torp' || w.kind === 'rail') && hyp(u.x - big.x, u.y - big.y) < 1000).slice(0, 4);
  if (heavy.length) execCmd(g, { t: 'attack', p: pi, u: heavy.map(u => u.id), e: big.id, sub });
}
/* Überfall: zwischen den großen Angriffen jagen zwei, drei schnelle kleine Schiffe eine abgelegene Raffinerie oder
   Außenbasis des Gegners (oder Frachter dort) und ziehen sich bei Gegenwehr zurück */
function aiRaid(g, pi, fleet, anchor, rp) {
  const p = g.players[pi], A = p.ai, t = g.time;
  if (A.raid) {
    const al = fleet.filter(u => A.raid.ids.indexOf(u.id) >= 0);
    const hurt = al.reduce((s, u) => s + u.hull / u.hullMax, 0) < A.raid.ids.length * 0.5;
    if (!al.length || hurt || t - A.raid.t0 > 120) { if (al.length) cmdMove(g, al, rp.x, rp.y, false, 'wedge'); A.raid = null; A.raidT = t; }
    return;
  }
  if (t < A.first * 0.55 || t - (A.raidT || 0) < 100 + (pi * 37) % 60) return;
  let best = null, bd = 1e9;
  for (const b of g.bldgs) {
    if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].neutral || !(b.role === 'refinery' || b.role === 'relay' || (b.role === 'base' && b.lv < 2))) continue;
    const q = g.players[b.owner]; if (hyp(b.x - q.start.x, b.y - q.start.y) < 1100) continue;
    if (!p.explored[clamp((b.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((b.x / VIS) | 0, 0, g.vw - 1)]) continue;
    if (g.bldgs.some(o => !o.dead && o.owner === b.owner && (o.role === 'turret' || o.role === 'flak' || o.role === 'spore') && hyp(o.x - b.x, o.y - b.y) < 450)) continue;
    const d = hyp(b.x - anchor.x, b.y - anchor.y); if (d < bd) { bd = d; best = b; }
  }
  if (!best) { A.raidT = t; return; }
  const fast = fleet.filter(u => u.def.cls === 's' && u.o.t === 'idle').sort((a, b) => b.def.speed - a.def.speed).slice(0, 3);
  if (fast.length < 2) return;
  cmdMove(g, fast, best.x, best.y, true, 'wedge'); A.raid = { ids: fast.map(u => u.id), t0: t, tid: best.id };
}

/* Fassung 22: Unterstützer. Bau: ein Reparaturschiff je zehn Kampfschiffe; Minenleger (Mittel, Schwer) einer, später
   zwei; Truppentransporter (Mittel, Schwer) erst, wenn angeschlagene Großschiffe des Gegners gesichtet wurden, höchstens
   einer. Führung: Reparaturschiffe folgen dem Schwerpunkt der Flotte, Minenleger verminen abwechselnd die Zugänge der
   Raffinerien und die Front vor der Basis, Transporter entern angeschlagene mittlere und große Schiffe in der Nähe. */
function aiSupport(g, pi, ships, fleet, yards, anchor, dirA) {
  const p = g.players[pi], A = p.ai, f = p.faction, t = g.time;
  const rp = { x: anchor.x + dcos(dirA) * 260, y: anchor.y + dsin(dirA) * 260 };
  const defs = Object.values(SHIPS).filter(d => d.f === f && !d.hidden), dHeal = defs.find(d => d.heal), dMine = defs.find(d => d.mines), dTroop = defs.find(d => d.troop);
  const heals = ships.filter(u => u.def.heal), layers = ships.filter(u => u.def.mines), troops = ships.filter(u => u.def.troop);
  /* Beute: sichtbare, angeschlagene mittlere/große Feindschiffe mit Crew */
  let prey = null, pd = 1e9;
  if ((g.tick + pi * 5) % 4 === 0 || troops.length) for (const e of g.ships) { if (e.dead || e.derelict || !foes(g, pi, e.owner) || g.players[e.owner].neutral || (e.def.cls !== 'l' && e.def.cls !== 'm') || !e.crewMax || e.hull > e.hullMax * 0.5 || e.def.flag || !canSee(g, pi, e)) continue; const d = hyp(e.x - anchor.x, e.y - anchor.y) - (e.def.cls === 'l' ? 600 : 0); if (d < pd) { pd = d; prey = e; } }
  if (prey) A.preyT = t;
  if (yards.length && t - (A.supT || 0) > 8) {
    A.supT = t;
    const yardL = Math.max(...yards.map(b => b.lv)), queued = id => yards.reduce((n, y) => n + y.q.filter(q => q.id === id).length, 0);
    const can = d => d && yardL >= d.yard && !trainReq(g, pi, d.id) && canPay(p, shipCost(p, d)) && p.cpUse + p.queued + d.cp <= p.cpMax;
    if (can(dHeal) && heals.length + queued(dHeal.id) < Math.floor(fleet.length / 10)) aiTrain(g, pi, dHeal.id);
    else if (A.lvl >= 2 && t > 300 && can(dMine) && p.ice > 900 && layers.length + queued(dMine.id) < (A.lvl >= 3 && t > 900 ? 2 : 1)) aiTrain(g, pi, dMine.id);
    else if (A.lvl >= 2 && t > 480 && can(dTroop) && p.ice > 1300 && A.preyT && t - A.preyT < 120 && troops.length + queued(dTroop.id) < 1) aiTrain(g, pi, dTroop.id);
  }
  /* Reparaturschiffe: zum Schwerpunkt der Angriffsflotte (oder der Flotte am Sammelpunkt), etwas dahinter */
  if (heals.length && t - (A.healT || -99) > 4) {
    A.healT = t;
    const grp = A.atk ? fleet.filter(u => A.atk.ids.indexOf(u.id) >= 0) : fleet.filter(u => hyp(u.x - rp.x, u.y - rp.y) < 900);
    let cx = rp.x, cy = rp.y; if (grp.length) { cx = 0; cy = 0; for (const u of grp) { cx += u.x; cy += u.y; } cx /= grp.length; cy /= grp.length; }
    const back = A.atk && grp.length ? datan2(anchor.y - cy, anchor.x - cx) : dirA + Math.PI;
    const tx = cx + dcos(back) * 90, ty = cy + dsin(back) * 90;
    const go = heals.filter(u => (u.o.t === 'idle' || u.o.t === 'move') && hyp(u.x - tx, u.y - ty) > 140);
    if (go.length) cmdMove(g, go, tx, ty, false, 'block');
  }
  /* Minenleger (Mittel, Schwer): ein Auftrag zugleich */
  if (A.lvl >= 2 && layers.length) {
    const job = A.mj, u = job ? g.byId.get(job.id) : null;
    if (job && (!u || u.dead || u.derelict || u.owner !== pi || t - job.t0 > 70)) { A.mj = null; A.mjT = t; }
    else if (job) {
      if (hyp(u.x - job.x, u.y - job.y) < 70) { execCmd(g, { t: 'ab', p: pi, u: [u.id], id: 'mines' }); A.mj = null; A.mjT = t; cmdMove(g, [u], rp.x - dcos(dirA) * 120, rp.y - dsin(dirA) * 120, false); }
      else if (u.o.t === 'idle') cmdMove(g, [u], job.x, job.y, false);
    } else if (t - (A.mjT || -999) > 75) {
      const lay = layers.find(q => !(q.abcd.mines > 0) && (q.o.t === 'idle' || q.o.t === 'move'));
      const spots = [];
      for (const b of g.bldgs) if (!b.dead && b.done && b.owner === pi && b.role === 'refinery') spots.push({ x: b.x + dcos(dirA) * (b.def.r + 170), y: b.y + dsin(dirA) * (b.def.r + 170) });
      spots.push({ x: anchor.x + dcos(dirA) * 520, y: anchor.y + dsin(dirA) * 520 });
      if (lay) for (let k = 0; k < spots.length; k++) {
        const s0 = spots[((A.mjN || 0) + k) % spots.length]; let n = 0;
        for (const m of g.mines) if (m.owner === pi && hyp(m.x - s0.x, m.y - s0.y) < 160) n++;
        if (n >= MINE.n || inAsh(g.map, s0.x, s0.y)) continue;
        A.mjN = (A.mjN || 0) + k + 1; A.mj = { id: lay.id, x: s0.x, y: s0.y, t0: t }; cmdMove(g, [lay], s0.x, s0.y, false); break;
      }
      if (!A.mj) A.mjT = t;
    }
  }
  /* Truppentransporter: angeschlagene mittlere und große Schiffe in Reichweite entern, sonst am Sammelpunkt warten */
  for (const u of troops) {
    if (u.o.t === 'board') continue;
    let best = null, bd = 1600;
    if (u.marines >= u.def.marines * 0.6) for (const e of g.ships) { if (e.dead || e.derelict || !foes(g, pi, e.owner) || g.players[e.owner].neutral || (e.def.cls !== 'l' && e.def.cls !== 'm') || !e.crewMax || e.def.flag || e.hull > e.hullMax * 0.5 || e.crew > u.marines * 1.6 || !canSee(g, pi, e)) continue; const d = hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
    if (best) execCmd(g, { t: 'board', p: pi, u: [u.id], e: best.id });
    else if (u.o.t === 'idle' && hyp(u.x - rp.x, u.y - rp.y) > 300) cmdMove(g, [u], rp.x - dcos(dirA) * 100, rp.y - dsin(dirA) * 100, false);
  }
}
function artKnownAi(g, pi, b) { const p = g.players[pi]; return !!p.explored[clamp((b.y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((b.x / VIS) | 0, 0, g.vw - 1)]; }
/* Belagerung im Angriff: die Artillerie der Angriffsflotte nimmt das nächste bekannte Geschütz in Zielnähe unter Beschuss */
function aiSiege(g, pi, alive) {
  const A = g.players[pi].ai; if (g.time - (A.siegeT || 0) < 5) return; A.siegeT = g.time;
  const arts = alive.filter(u => u.def.art); if (!arts.length) return;
  /* Fassung 22: je Artillerie zwei Begleiter aus der Angriffsflotte (die nächsten freien Kampfschiffe), solange genug da sind */
  let free = alive.filter(u => !u.def.art && armed(u) && u.o.t !== 'escort' && !u.retreat);
  for (const a of arts) {
    if (free.length < 4) break;
    const have = alive.filter(u => u.o.t === 'escort' && u.o.tid === a.id).length; if (have >= 2) continue;
    const pick = free.slice().sort((p, q) => hyp(p.x - a.x, p.y - a.y) - hyp(q.x - a.x, q.y - a.y) || p.id - q.id).slice(0, 2 - have);
    cmdEscort(g, pick, a, have); free = free.filter(u => pick.indexOf(u) < 0);
  }
  const c = alive.find(u => !u.def.art) || arts[0];
  let best = null, bd = 1e9;
  for (const b of g.bldgs) { if (b.dead || !foes(g, pi, b.owner) || g.players[b.owner].neutral || !artKnownAi(g, pi, b)) continue; const d = hyp(b.x - c.x, b.y - c.y) - (b.role === 'turret' || b.role === 'flak' || b.role === 'spore' ? 500 : 0); if (d < bd) { bd = d; best = b; } }
  if (!best) return;
  const idle = arts.filter(u => !(u.o.t === 'attack' && u.o.tid === best.id)); if (idle.length) execCmd(g, { t: 'attack', p: pi, u: idle.map(u => u.id), e: best.id });
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
/* Fassung 22: Nachrüsten – ein großes Kampfschiff nahe der Werft, kein Feind in der Nähe, Rücklage bleibt; höchstens eines je Denkpause */
function aiRefit(g, pi, ships) {
  const p = g.players[pi], bio = !!p.F.bio;
  if (bio ? p.ice < 2600 : p.ice < 1800 || p.ore < 900) return;
  for (const u of ships) {
    if (u.def.cls !== 'l' || u.def.role !== 'war' || u.rfq || (u.rf && u.rf.length >= REFIT_MAX) || u.o.t === 'attack') continue;
    if (nearFoes(g, u, 700).length) continue;
    for (const id of ['wpn', 'armor', 'drive', 'sensor']) {
      if (refitReq(g, u, id)) continue;
      const c = refitCost(p, u, id);
      if (p.ice - c.ice < (bio ? 1600 : 1000) || (!bio && p.ore - c.ore < 500)) continue;
      if (!execCmd(g, { t: 'refit', p: pi, u: [u.id], id })) return;
    }
  }
}
