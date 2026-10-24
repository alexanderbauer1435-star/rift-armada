/* ===== combat.js ===== */
'use strict';
/* =====================================================================
   BEWEGUNG, WAFFEN, SCHADEN – Schiffe mit Trägheit und Drehrate, Schussfelder, Strahlen, Geschosse, Railguns,
   Torpedos, Punktverteidigung, Schilde gegen Hülle, Panzerung, Schildverbund, Träger mit Jägern.
   ===================================================================== */
const LEASH = 520;                           // wie weit ein wachendes Schiff seinem Ziel folgt
const SEP_ITER = 1;

/* ------------------------------------------------------------------ Hilfen */
function maxRange(def) { let r = 0; for (const w of def.wpn) if (w.kind !== 'pd') r = Math.max(r, w.range); return r; }
/* kürzeste Reichweite der Hauptwaffen: so nah muss ein Schiff heran, damit alle Waffen tragen */
function keepRange(def) { if (def.keep) return def.keep; let r = 1e9; for (const w of def.wpn) if (w.kind !== 'pd') r = Math.min(r, w.range); return r === 1e9 ? 0 : r * 0.8; }
function minRange(def) { let r = 0; for (const w of def.wpn) if (w.minR) r = Math.max(r, w.minR); return r; }
function armed(u) { for (const w of u.def.wpn) if (w.kind !== 'pd') return true; return false; }
function tdist(s, t) { return hyp(t.x - s.x, t.y - s.y) - (t.k === 2 ? t.def.r * 0.8 : t.def.r * 0.5); }
/* Wert eines Ziels bei der Zielwahl: Kampfschiffe vor Frachtern, nahe vor fernen */
function tgtScore(s, t, d) {
  let sc = d;
  if (t.k === 1) { if (!t.def.wpn.length) sc += 160; if (t.def.role === 'fighter') sc += 90; if (t.derelict) sc += 500; }
  else { sc += t.done && lvOf(t).wpn.length ? 0 : 120; if (!t.done) sc += 200; }
  return sc;
}
/* Nächstes feindliches Ziel im Umkreis r (sichtbar), nur Schiffe und Stationen */
function acquire(g, s, r, fn) {
  const pi = s.owner;
  let best = null, bs = 1e9;
  nearShips(g, s.x, s.y, r + 40, u => {
    if (!foes(g, pi, u.owner) || !canSee(g, pi, u)) return false;
    const d = tdist(s, u);
    if (d > r) return false;
    if (fn && !fn(u)) return false;
    const sc = tgtScore(s, u, d);
    if (sc < bs) { bs = sc; best = u; }
    return false;
  });
  for (const b of g.bldgs) {
    if (b.dead || !foes(g, pi, b.owner)) continue;
    const d = tdist(s, b);
    if (d > r || !canSee(g, pi, b)) continue;
    if (fn && !fn(b)) continue;
    const sc = tgtScore(s, b, d);
    if (sc < bs) { bs = sc; best = b; }
  }
  return best;
}
function lostTgt(g, s, t) { return !t || t.dead || t.k === 3 || !canSee(g, s.owner, t); }

/* ------------------------------------------------------------------ Bewegung */
/* Weg zum Ziel folgen: liefert den nächsten Zwischenpunkt (oder null, wenn kein Weg) */
/* Gerade Strecke frei von Stationen und Vorkommen (außer dem Ziel selbst, skip)? Felsen prüft das Raster. */
function clearLine(g, u, tx, ty, skip) {
  const x0 = u.x, y0 = u.y, mid = hyp(tx - x0, ty - y0) / 2 + 80, mx = (x0 + tx) / 2, my = (y0 + ty) / 2;
  for (const b of g.bldgs) { if (b.dead || b.id === skip || hyp(b.x - mx, b.y - my) > mid + b.def.r) continue; if (segCircle(x0, y0, tx, ty, b.x, b.y, b.def.r + 4 + u.def.r * 0.6)) return false; }
  for (const n of g.nodes) { if (n.id === skip || hyp(n.x - mx, n.y - my) > mid + n.r) continue; if (segCircle(x0, y0, tx, ty, n.x, n.y, n.r + u.def.r * 0.7)) return false; }
  for (const n of g.sites) { if (n.id === skip || hyp(n.x - mx, n.y - my) > mid + n.r) continue; if (segCircle(x0, y0, tx, ty, n.x, n.y, n.r + u.def.r * 0.7)) return false; }
  return true;
}
function nextWp(g, u, tx, ty, skip) {
  const m = g.map;
  /* Endanflug: nahe am Ziel direkt hin, auch wenn die Zielzelle im Raster gesperrt ist (Rand eines Vorkommens oder einer
     Station) – sonst steuert das Schiff die nächste freie Zelle an und kommt nie nah genug heran. Die Gerade muss aber
     an allen anderen Stationen und Vorkommen vorbeiführen, sonst verkeilt sich das Schiff zwischen ihnen. */
  if (hyp(u.x - tx, u.y - ty) < 150 && navLosWorld(m, u.cls, u.x, u.y, tx, ty, true) && clearLine(g, u, tx, ty, skip)) { if (!u.path || u.path.tx !== tx || u.path.ty !== ty || u.path.pts.length !== 1) u.path = { pts: [{ x: tx, y: ty }], tx, ty }; u.pi = 0; return u.path.pts[0]; }
  if (!u.path || hyp(u.path.tx - tx, u.path.ty - ty) > 40) {
    const pts = findPath(m, u.cls, u.x, u.y, tx, ty);
    if (pts) pts[pts.length - 1] = { x: tx, y: ty };
    u.path = { pts: pts || [{ x: tx, y: ty }], tx, ty }; u.pi = 0;
  }
  const pts = u.path.pts;
  while (u.pi < pts.length - 1 && hyp(pts[u.pi].x - u.x, pts[u.pi].y - u.y) < 26 + u.def.r) u.pi++;
  return pts[u.pi];
}
/* Steuern: zum Punkt drehen und Schub geben. arrive: am Ziel bremsen. Rückgabe: Abstand zum Punkt */
function steer(g, u, px, py, dt, arrive, spCap) {
  const def = u.def, tf = g.players[u.owner].tfx, dx = px - u.x, dy = py - u.y, d = hyp(dx, dy);
  const want = d > 1 ? datan2(dy, dx) : u.ang;
  u.ang = turnTo(u.ang, want, def.turn * tf.turn * dt * (1 - Math.min(0.5, u.v / Math.max(1, def.speed) * 0.45)));
  const diff = Math.abs(angDiff(want, u.ang));
  let top = def.speed * tf.speed * (u.cls === 0 && inField(g.map, u.x, u.y) ? 0.5 : 1) * (0.3 + 0.7 * u.sub.drive) * (u.abT.grush > 0 || u.abT.lunge > 0 ? 2 : 1) * (u.sprint > 0 ? 1.6 : 1) * (u.frenzy > 0 ? 1.4 : 1) * (u.crus > 0 ? 1.3 : 1) * (u.pull ? 0.5 : 1);
  if (spCap) top = Math.min(top, spCap);
  let goal = diff < 1.1 ? top * (1 - diff * 0.45) : top * 0.25;
  if (arrive) goal = Math.min(goal, Math.sqrt(2 * def.accel * Math.max(0, d - 2)) + 4);
  if (u.v < goal) u.v = Math.min(goal, u.v + def.accel * dt); else u.v = Math.max(goal, u.v - def.accel * 1.6 * dt);
  return d;
}
function brake(u, dt) { u.v = Math.max(0, u.v - u.def.accel * 1.8 * dt); }
function face(u, want, dt) { u.ang = turnTo(u.ang, want, u.def.turn * dt); }
/* Zum Punkt fliegen (mit Wegsuche). Liefert true, wenn angekommen */
function goTo(g, u, tx, ty, dt, tol, spCap, skip) {
  const wp = nextWp(g, u, tx, ty, skip), last = u.pi >= u.path.pts.length - 1;
  const d = steer(g, u, wp.x, wp.y, dt, last, spCap);
  if (last && d <= tol) { brake(u, dt); return true; }
  return false;
}
/* Direkt (ohne Wegsuche) auf ein bewegliches Ziel zu; Felsen blocken → Weg suchen (alle 0,8 s neu) */
function chase(g, u, t, dt, keep) {
  const d = tdist(u, t);
  const want = d - keep;
  if (want <= 0) return true;
  u.pt -= dt;
  const direct = navLosWorld(g.map, u.cls, u.x, u.y, t.x, t.y);
  if (direct) { u.path = null; const r = hyp(t.x - u.x, t.y - u.y), k = want / Math.max(1, r); steer(g, u, u.x + (t.x - u.x) * k, u.y + (t.y - u.y) * k, dt, true); return false; }
  if (u.pt <= 0 || !u.path) { u.path = null; u.pt = 0.8; }
  goTo(g, u, t.x, t.y, dt, keep, 0);
  return false;
}
function navLosWorld(map, cls, x0, y0, x1, y1, soft) { return navLos(map, cls, clamp((x0 / NAV) | 0, 0, map.gw - 1), clamp((y0 / NAV) | 0, 0, map.gh - 1), clamp((x1 / NAV) | 0, 0, map.gw - 1), clamp((y1 / NAV) | 0, 0, map.gh - 1), soft); }
/* Kampfstellung: in Reichweite bleiben, Schussfeld auf das Ziel richten. Breitseitenschiffe drehen die Flanke. */
function engage(g, u, t, dt) {
  const def = u.def, keep = keepRange(def), minR = minRange(def), d = tdist(u, t);
  const want = datan2(t.y - u.y, t.x - u.x);
  if (minR && d < minR * 1.05) {
    /* zu nah: rückwärts wegdrehen und Abstand gewinnen */
    const away = want + Math.PI;
    steer(g, u, u.x + dcos(away) * 200, u.y + dsin(away) * 200, dt, false, def.speed * 0.8);
    return;
  }
  if (d > keep + 12) { chase(g, u, t, dt, keep); return; }
  brake(u, dt);
  if (def.side) {
    /* Flanke: die Seite, die näher an der Zielrichtung liegt */
    const a = angDiff(want, u.ang), side = a >= 0 ? want - Math.PI / 2 : want + Math.PI / 2;
    face(u, side, dt);
  } else face(u, want, dt);
}

/* ------------------------------------------------------------------ Schiffe je Runde */
function updateShip(g, u, dt) {
  CUR_G = g;
  const def = u.def, p = g.players[u.owner], o = u.o, m = g.map;
  /* Aschenebel: Schild aus, Hülle brennt */
  if (inAsh(m, u.x, u.y)) { u.shield = 0; u.sT = 0; u.hull -= u.hullMax * ASH_DMG * dt; if (u.hull <= 0) { kill(g, u, null, -1); return; } }
  else if (u.ion) { u.shield = 0; u.sT = 0; }
  else if (u.shieldMax && u.shield < u.shieldMax) { u.sT += dt; if (u.sT > p.tfx.sdelay) u.shield = Math.min(u.shieldMax, u.shield + def.sreg * p.tfx.sreg * (1 + 0.1 * u.rank) * dt); }
  if (u.beams) { let any = false; for (let i = 0; i < u.beams.length; i++) { const b = u.beams[i]; if (b) { b.t -= dt; if (b.t <= 0) u.beams[i] = null; else any = true; } } if (!any) u.beams = null; }
  if (u.hangar) updateHangar(g, u, dt);
  if (def.role === 'fighter') { fighterStep(g, u, dt); return; }
  if (u.boarding > 0) boardTick(g, u, dt);
  if (u.derelict) { derelictStep(g, u, dt); return; }
  shipUpkeep(g, u, dt);
  if (u.cocoon) { brake(u, dt); u.lx = u.x; u.ly = u.y; return; }
  if ((g.tick + u.id) % 15 === 0 && (def.ab || def.abs)) abilityAuto(g, u);
  const warship = armed(u);
  switch (o.t) {
    case 'eat': {
      /* Grazer frisst ein Wrack: Hülle wird zu Biomasse */
      const t = g.byId.get(o.tid);
      if (!t || t.dead || !t.derelict || !def.eat) { setIdle(u); break; }
      o.x = t.x; o.y = t.y;
      const d = hyp(t.x - u.x, t.y - u.y) - t.def.r - def.r;
      if (d > 26) { const a = datan2(u.y - t.y, u.x - t.x) + ((u.id % 5) - 2) * 0.3, rr = t.def.r + def.r + 8; goTo(g, u, t.x + dcos(a) * rr, t.y + dsin(a) * rr, dt, 10, 0, t.id); break; }
      brake(u, dt); face(u, datan2(t.y - u.y, t.x - u.x), dt);
      const cap = def.cargo * p.tfx.cargo, take = Math.min(cap - u.cargo, 70 * dt, t.hull * 0.5);
      u.cargo += take; u.ckind = 'ice'; t.hull -= take * 2;
      if ((g.tick + u.id) % 10 === 0) ev(g, 'eat', { x: t.x, y: t.y, owner: u.owner, r: t.def.r });
      if (t.hull <= 1) { kill(g, t, null, -1); }
      if (u.cargo >= cap - 0.01 || t.dead) { u.o = { t: 'return', nid: 0, auto: 1 }; u.path = null; }
      break;
    }
    case 'idle': case 'hold': {
      if (warship && u.stance !== 2) {
        /* wachen: Feinde in Sensorreichweite angreifen, dem Ziel aber nicht beliebig weit folgen */
        const t = acquire(g, u, o.t === 'hold' ? maxRange(def) : def.sensor * p.tfx.sensor * (0.4 + 0.6 * u.sub.sensor));
        if (t) { if (o.t === 'hold') u.tgt = t.id; else { u.o = { t: 'attack', tid: t.id, guard: 1 }; u.tgt = t.id; break; } }
        else u.tgt = 0;
      }
      if (o.t === 'idle' && hyp(u.hx - u.x, u.hy - u.y) > 60) { goTo(g, u, u.hx, u.hy, dt, 14, 0); break; }
      brake(u, dt);
      if (!warship && u.def.cargo && g.tick % 30 === 0) { const n = pickNode(g, u.owner, u.x, u.y, 1200) || nearestNode(g, u.x, u.y, null, 1800); if (n) u.o = { t: 'harvest', nid: n.id, auto: 1 }; }
      break;
    }
    case 'explore': {
      /* Erkunden: nächste unerkundete Stelle anfliegen, angekommen oder schon erkundet → nächste; nicht anhalten zum
         Kämpfen (Aufklärer sollen sehen, nicht sterben). Bei unter 45 % Hülle zurück zur Basis und warten. Bekannte feindliche Geschütze und Wächter-Stätten werden umflogen. */
      if (u.hull < u.hullMax * 0.45) { const b = g.bldgs.find(x => !x.dead && x.owner === u.owner && x.role === 'base') || g.bldgs.find(x => !x.dead && x.owner === u.owner); if (b) { u.o = { t: 'move', x: b.x + (u.id % 7 - 3) * 30, y: b.y + b.def.r + 60 }; u.path = null; } else setIdle(u); break; }
      if (o.x === undefined || (g.tick + u.id) % 15 === 0 && exploredAt(g, u.owner, o.x, o.y)) { const q = exploreTarget(g, u); if (!q) { setIdle(u); break; } o.x = q.x; o.y = q.y; u.path = null; }
      if (goTo(g, u, o.x, o.y, dt, 40)) { o.x = undefined; }
      break;
    }
    case 'move': case 'amove': {
      if (o.t === 'amove' && warship && u.stance !== 2 && (g.tick + u.id) % 5 === 0) {
        const t = acquire(g, u, def.sensor * p.tfx.sensor * (0.4 + 0.6 * u.sub.sensor));
        if (t) { u.o = { t: 'attack', tid: t.id, back: o }; u.tgt = t.id; break; }
      }
      if (goTo(g, u, o.x, o.y, dt, 12 + def.r * 0.3, o.sp)) setIdle(u);
      break;
    }
    case 'attack': {
      const t = g.byId.get(o.tid);
      if (lostTgt(g, u, t)) {
        if (o.back) { u.o = o.back; u.path = null; u.tgt = 0; }
        else if (o.guard) { setIdle(u); }
        else if (t && t.dead) setIdle(u);
        else { u.o = { t: 'move', x: o.x, y: o.y }; u.path = null; }
        break;
      }
      u.tgt = t.id; o.x = t.x; o.y = t.y;
      if (o.guard && hyp(u.hx - u.x, u.hy - u.y) > LEASH) { setIdle(u); break; }
      if (!warship) { setIdle(u); break; }
      engage(g, u, t, dt);
      break;
    }
    case 'harvest': {
      let n = g.byId.get(o.nid);
      if (!n || n.amount <= 0) { if (u.mine) { const q = g.byId.get(u.mine); if (q) q.miners--; u.mine = 0; } n = pickNode(g, u.owner, u.x, u.y, 1400) || nearestNode(g, u.x, u.y, null, 1800); if (!n) { setIdle(u); break; } o.nid = n.id; o.auto = 1; u.path = null; }
      const d = hyp(n.x - u.x, n.y - u.y) - n.r - def.r;
      if (d > 24) {
        /* zum Rand des Vorkommens, versetzt je Frachter, damit sie sich nicht stapeln */
        const a = datan2(u.y - n.y, u.x - n.x) + ((u.id % 5) - 2) * 0.25, rr = n.r + def.r + 6;
        goTo(g, u, n.x + dcos(a) * rr, n.y + dsin(a) * rr, dt, 10, 0, n.id);
        if (u.mine) { const q = g.byId.get(u.mine); if (q) q.miners--; u.mine = 0; }
        break;
      }
      brake(u, dt); face(u, datan2(n.y - u.y, n.x - u.x), dt);
      if (!u.mine) { u.mine = n.id; n.miners++; }
      const cap = def.cargo * p.tfx.cargo, take = Math.min(cap * dt / (CARGO_TIME * (def.mineT || 1)), n.amount, cap - u.cargo);
      u.cargo += take; n.amount -= take; u.ckind = n.kind;
      if (u.cargo >= cap - 0.01 || n.amount <= 0) {
        /* Nexus-Harvester im Netz: sofort liefern und weiterarbeiten */
        if (def.net && netCovered(g, u.owner, u.x, u.y, true)) { netDeliver(g, u); if (n.amount <= 0) { u.o = { t: 'idle' }; n.miners--; u.mine = 0; } break; }
        u.o = { t: 'return', nid: n.id }; u.path = null; n.miners--; u.mine = 0;
      }
      break;
    }
    case 'return': {
      if (def.net) { if (netCovered(g, u.owner, u.x, u.y, true)) { netDeliver(g, u); let n = g.byId.get(o.nid); if (!n || n.amount <= 0) n = pickNode(g, u.owner, u.x, u.y, 1400) || nearestNode(g, u.x, u.y, null, 1800); u.o = n ? { t: 'harvest', nid: n.id, auto: o.auto } : { t: 'idle' }; u.path = null; break; } const nb = nearestNetNode(g, u.owner, u.x, u.y); if (!nb) { brake(u, dt); break; } goTo(g, u, nb.x, nb.y, dt, 40, 0, nb.id); break; }
      const ref = nearestRefinery(g, u.owner, u.x, u.y);
      if (!ref) { brake(u, dt); if (g.tick % 60 === 0 && u.cargo <= 0) setIdle(u); break; }
      const d = hyp(ref.x - u.x, ref.y - u.y) - ref.def.r - def.r;
      /* Anflug an den Rand, je Frachter ein anderer Winkel; einmal angedockt zählt die Entladezeit weiter, auch wenn
         Nachbarn das Schiff ein paar Pixel wegschieben */
      if (!u.dk && d > 22) { const a = datan2(u.y - ref.y, u.x - ref.x) + ((u.id % 5) - 2) * 0.3, rr = ref.def.r + def.r + 8; goTo(g, u, ref.x + dcos(a) * rr, ref.y + dsin(a) * rr, dt, 12, 0, ref.id); u.wait = 0; break; }
      brake(u, dt);
      /* Andockplätze: so viele Frachter zugleich wie die Stufe erlaubt */
      if (!u.dk) { if (ref.docks < lvOf(ref).docks) { ref.docks++; u.dk = ref.id; u.wait = 0; } else break; }
      if (d > 60) { ref.docks = Math.max(0, ref.docks - 1); u.dk = 0; u.wait = 0; break; }
      u.wait += dt;
      if (u.wait >= 1.4) {
        const bonus = lvOf(ref).bonus || 1, amt = Math.round(u.cargo * bonus * (p.ai ? p.ai.cfg.inc : 1));
        earn(p, u.ckind, amt); p.haulR += amt / 45;
        u.cargo = 0; ref.docks--; u.dk = 0;
        ev(g, 'deliver', { owner: u.owner, x: ref.x, y: ref.y, kind: u.ckind, amt });
        let n = g.byId.get(o.nid);
        /* selbst gewählte Frachter wählen nach jeder Lieferung neu nach Bedarf, befohlene bleiben bei ihrem Vorkommen */
        if (o.auto || !n || n.amount <= 0) n = pickNode(g, u.owner, ref.x, ref.y, 900) || nearestNode(g, u.x, u.y, null, 1800);
        u.o = n ? { t: 'harvest', nid: n.id, auto: o.auto } : { t: 'idle' };
        u.path = null;
      }
      break;
    }
    case 'board': {
      const t = g.byId.get(o.tid);
      if (!t || t.dead || !u.marines || (t.k === 2 && !def.stationsToo) || !foes(g, u.owner, t.owner) && !t.derelict) { setIdle(u); break; }
      o.x = t.x; o.y = t.y;
      if (tdist(u, t) > ABIL.board.r) { chase(g, u, t, dt, ABIL.board.r - 10); break; }
      brake(u, dt);
      boardTransfer(g, u, t);
      u.o = { t: 'attack', tid: t.id, x: t.x, y: t.y, guard: 1 }; u.tgt = t.id;
      break;
    }
    case 'build': {
      const b = g.byId.get(o.bid);
      if (!b || b.dead || b.done) { setIdle(u); break; }
      const d = hyp(b.x - u.x, b.y - u.y) - b.def.r - def.r;
      if (d > 40) { const a = datan2(u.y - b.y, u.x - b.x), rr = b.def.r + def.r + 24; goTo(g, u, b.x + dcos(a) * rr, b.y + dsin(a) * rr, dt, 12, 0, b.id); }
      else { brake(u, dt); face(u, datan2(b.y - u.y, b.x - u.x), dt); }
      break;
    }
  }
  if (u.dk && o.t !== 'return') { const ref = g.byId.get(u.dk); if (ref) ref.docks = Math.max(0, ref.docks - 1); u.dk = 0; }
  /* Position fortschreiben; festgefahren: Weg neu suchen */
  /* Fortschritt seit der letzten Runde einschließlich Abstoßung: wer mit Schub nicht vorankommt, ist verkeilt */
  const prog = hyp(u.x - u.lx, u.y - u.ly);
  u.lx = u.x; u.ly = u.y;
  if (u.v > 0.01) {
    const nx = u.x + dcos(u.ang) * u.v * dt, ny = u.y + dsin(u.ang) * u.v * dt;
    u.x = clamp(nx, 8, m.w - 8); u.y = clamp(ny, 8, m.h - 8);
    if (u.v > 15 && prog < u.v * dt * 0.2) { u.stuck += dt; if (u.stuck > 1.2) { u.path = null; u.stuck = 0; u.ang += 0.6; u.pt = 0; } } else u.stuck = 0;
  }
  if (def.wpn.length && u.stance !== 2 && u.dis <= 0 && u.truce <= 0) fireAll(g, u, dt);
}
/* Träger: Jäger nachbauen und verwalten */
function hangarMax(g, u) { return u.def.hangar + (u.def.hero ? g.players[u.owner].tfx.drones : 0); }
function updateHangar(g, u, dt) {
  const h = u.hangar;
  h.ids = h.ids.filter(id => { const f = g.byId.get(id); return f && !f.dead; });
  h.n = h.ids.length;
  const want = hangarMax(g, u);
  if (h.n < want) { h.t += dt; if (h.t >= 6) { h.t = 0; const a = u.ang + Math.PI; const f = addShip(g, u.def.drone || 'fighter', u.owner, u.x + dcos(a) * (u.def.r + 8), u.y + dsin(a) * (u.def.r + 8), u.ang); f.par = u.id; f.slot = h.ids.length; h.ids.push(f.id); } }
}
function fighterStep(g, u, dt) {
  const par = g.byId.get(u.par), def = u.def, m = g.map;
  if (!par || par.dead) { u.hull -= u.hullMax * dt / 12; if (u.hull <= 0) { kill(g, u, null, -1); return; } }
  let t = u.tgt ? g.byId.get(u.tgt) : null;
  if (lostTgt(g, u, t) || (par && hyp(t.x - par.x, t.y - par.y) > 420)) { t = null; u.tgt = 0; }
  if (!t && (g.tick + u.id) % 6 === 0) {
    const pt = par && par.tgt ? g.byId.get(par.tgt) : null;
    if (pt && !lostTgt(g, u, pt) && hyp(pt.x - u.x, pt.y - u.y) < 500) t = pt;
    else t = acquire(g, u, par ? 360 : 260);
    if (t) u.tgt = t.id;
  }
  if (t) {
    /* Angriffslauf: auf das Ziel zu, knapp vorbei, wieder herum */
    const d = hyp(t.x - u.x, t.y - u.y);
    if (!u.pass && d < 60) u.pass = 0.9;
    if (u.pass > 0) { u.pass -= dt; const a = datan2(u.y - t.y, u.x - t.x) + 1.2; steer(g, u, t.x + dcos(a) * 150, t.y + dsin(a) * 150, dt, false); }
    else steer(g, u, t.x, t.y, dt, false);
  } else if (par) {
    const a = par.ang + Math.PI + ((u.slot || 0) - 2.5) * 0.5, px = par.x + dcos(a) * (par.def.r + 36), py = par.y + dsin(a) * (par.def.r + 36);
    const d = hyp(px - u.x, py - u.y);
    if (d > 18) steer(g, u, px, py, dt, true, par.v > 2 ? 0 : def.speed); else { u.ang = turnTo(u.ang, par.ang, def.turn * dt); brake(u, dt); }
  } else brake(u, dt);
  if (u.v > 0.01) { u.x = clamp(u.x + dcos(u.ang) * u.v * dt, 8, m.w - 8); u.y = clamp(u.y + dsin(u.ang) * u.v * dt, 8, m.h - 8); }
  fireAll(g, u, dt);
}

/* ------------------------------------------------------------------ Auseinanderschieben
   Überlappende Schiffe stoßen einander ab; Stationen und Felsen schieben Schiffe hinaus. */
function separate(g) {
  const cells = g.cells, used = g.cellsUsed, gw = g.gw2, gh = g.gh2;
  const pairs = (a, b) => {
    for (let i = 0; i < a.length; i++) {
      const u = a[i];
      for (let j = (a === b ? i + 1 : 0); j < b.length; j++) {
        const v = b[j], dx = v.x - u.x, dy = v.y - u.y, rr = (u.def.r + v.def.r) * 0.9, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.5, nx = dx / d, ny = dy / d, wu = v.def.r / (u.def.r + v.def.r), wv = 1 - wu;
        u.x -= nx * push * wu * 2; u.y -= ny * push * wu * 2; v.x += nx * push * wv * 2; v.y += ny * push * wv * 2;
      }
    }
  };
  for (let k = 0; k < used.length; k++) {
    const c = used[k], cx = c % gw, cy = (c / gw) | 0, a = cells[c];
    pairs(a, a);
    if (cx + 1 < gw) { const b = cells[c + 1]; if (b.length) pairs(a, b); }
    if (cy + 1 < gh) { const b = cells[c + gw]; if (b.length) pairs(a, b); if (cx + 1 < gw) { const d = cells[c + gw + 1]; if (d.length) pairs(a, d); } if (cx > 0) { const d = cells[c + gw - 1]; if (d.length) pairs(a, d); } }
  }
  /* Stationen und Felsen */
  for (const b of g.bldgs) {
    if (b.dead) continue;
    const rr = b.def.r + 6;
    nearShips(g, b.x, b.y, rr + 30, u => { const dx = u.x - b.x, dy = u.y - b.y, d = hyp(dx, dy), need = rr + u.def.r * 0.6; if (d < need && d > 0) { u.x += dx / d * (need - d); u.y += dy / d * (need - d); } return false; });
  }
  if (g.tick % 2 === 0) {
    const rocks = g.map.rocks, nodes = g.nodes;
    for (const u of g.ships) {
      if (u.dead || u.def.role === 'fighter') continue;
      const cx = (u.x / NAV) | 0, cy = (u.y / NAV) | 0;
      if (cx < 0 || cy < 0 || cx >= g.map.gw || cy >= g.map.gh) continue;
      const v = g.map.nav[0][cy * g.map.gw + cx];
      if (v & 1) for (const o of rocks) { const dx = u.x - o.x, dy = u.y - o.y, d = hyp(dx, dy), need = o.r + u.def.r * 0.7; if (d < need && d > 0) { u.x += dx / d * (need - d); u.y += dy / d * (need - d); } }
      if (v & 8) { for (const o of nodes) { const dx = u.x - o.x, dy = u.y - o.y, d = hyp(dx, dy), need = o.r + u.def.r * 0.7; if (d < need && d > 0) { u.x += dx / d * (need - d); u.y += dy / d * (need - d); } } for (const o of g.sites) { const dx = u.x - o.x, dy = u.y - o.y, d = hyp(dx, dy), need = o.r + u.def.r * 0.7; if (d < need && d > 0) { u.x += dx / d * (need - d); u.y += dy / d * (need - d); } } }
    }
  }
}

/* ------------------------------------------------------------------ Waffen */
function inArc(s, w, t) {
  if (w.arc >= Math.PI) return true;
  const want = datan2(t.y - s.y, t.x - s.x), mount = s.k === 2 ? 0 : s.ang + w.mount;
  return Math.abs(angDiff(want, mount)) <= w.arc + (t.k === 2 ? 0.15 : 0.05);
}
function dmgMul(s) { return s.k === 1 ? (1 + 0.1 * s.rank) * (s.crus > 0 ? 1.25 : 1) * (s.blessT > FX_TIME(s) ? 1.12 : 1) : 1; }
function FX_TIME(s) { return CUR_G ? CUR_G.time : 0; }
let CUR_G = null;
function techMul(g, s, w) { const tf = g.players[s.owner].tfx; return w.kind === 'beam' ? tf.beam : w.kind === 'kin' ? tf.kin * (w.acid ? tf.acid : 1) : w.kind === 'rail' ? tf.kin * tf.rail : w.kind === 'torp' ? tf.torp : 1; }
function fireAll(g, s, dt) {
  const wpns = s.k === 2 ? lvOf(s).wpn : s.def.wpn, p = g.players[s.owner], slow = (s.k === 2 && p.lowPower ? 1.35 : 1) * (s.k === 2 && p.base2 ? 0.5 : 1);
  for (let i = 0; i < wpns.length; i++) {
    const w = wpns[i];
    s.wcd[i] -= dt;
    if (s.wcd[i] > 0) continue;
    const sub = s.k === 1 ? 1 + 2 * (1 - s.sub.wpn) : 1;
    if (w.kind === 'pd') { if (firePd(g, s, w, i)) s.wcd[i] = w.reload * slow * p.tfx.pdReload * sub * (s.k === 1 && s.abT.flak > 0 ? 0.34 : 1); continue; }
    const bs = s.k === 1 && s.abT.broadside > 0;
    let t = s.tgt ? g.byId.get(s.tgt) : null;
    if (t && (t.dead || t.k === 3 || !foes(g, s.owner, t.owner) || tdist(s, t) > w.range || !(bs || inArc(s, w, t)) || !canSee(g, s.owner, t))) t = null;
    if (!t) {
      if ((g.tick + s.id + i) % 3) continue;
      t = acquire(g, s, w.range, e => (bs || inArc(s, w, e)) && (!w.minR || tdist(s, e) >= w.minR * 0.9));
      if (!t) continue;
      if (s.k === 2) s.tgt = t.id;
    }
    if (w.minR && tdist(s, t) < w.minR * 0.9) continue;
    s.wcd[i] = bs ? 0.15 : w.reload * slow * sub * (w.kind === 'rail' ? p.tfx.railReload : 1) * (w.kind === 'kin' && s.k === 1 && s.abT.flak > 0 ? 0.75 : 1) * (s.k === 1 && s.frenzy > 0 ? 0.7 : 1);
    fireWeapon(g, s, i, w, t);
  }
}
function fireWeapon(g, s, i, w, t) {
  const mul = dmgMul(s) * techMul(g, s, w) * (s.k === 1 && s.abT.overload > 0 && w.kind === 'beam' ? 1.4 : 1);
  if (w.kind === 'beam') {
    if (!s.beams) s.beams = [];
    const was = s.beams[i];
    let m2 = mul;
    /* Verhörstrahl: wächst, solange er auf demselben Ziel bleibt */
    if (w.ramp) { if (s.rampTid === t.id) s.rampT = Math.min(6, s.rampT + 0.12); else { s.rampTid = t.id; s.rampT = 0; } m2 *= 1 + (w.ramp - 1) * (s.rampT / 6); }
    const rec = { tid: t.id, t: 0.16, extra: null };
    /* gebrochener Strahl: weitere Ziele im Schussfeld mit halbem Schaden */
    if (w.split > 1) { const ex = []; nearShips(g, s.x, s.y, w.range + 30, e => { if (e !== t && foes(g, s.owner, e.owner) && e.def.role !== 'fighter' && canSee(g, s.owner, e) && tdist(s, e) <= w.range && inArc(s, w, e)) ex.push(e); return ex.length >= w.split - 1; }); for (const e of ex) damage(g, e, w.dmg * m2 * 0.5, 'beam', s, s.owner, s.x, s.y, w); if (ex.length) rec.extra = ex.map(e => e.id); }
    s.beams[i] = rec;
    if (!was) ev(g, 'shot', { x: s.x, y: s.y, kind: 'beam', owner: s.owner, snd: w.snd });
    damage(g, t, w.dmg * m2, 'beam', s, s.owner, s.x, s.y, w);
    return;
  }
  const sx = s.x, sy = s.y;
  if (w.kind === 'torp') {
    const a = datan2(t.y - sy, t.x - sx);
    g.proj.push({ kind: 'torp', x: sx + dcos(a) * (s.k === 2 ? s.def.r : s.def.r * 0.8), y: sy + dsin(a) * (s.k === 2 ? s.def.r : s.def.r * 0.8), ang: a, sp: w.speed, dmg: w.dmg * mul, owner: s.owner, sid: s.id, tid: t.id, life: w.life, hp: w.hp * g.players[s.owner].tfx.torpHp, turn: w.turn, r: 4 });
    ev(g, 'shot', { x: sx, y: sy, kind: 'torp', owner: s.owner, snd: w.snd });
    return;
  }
  /* Geschoss oder Railgun: auf die vorausberechnete Position zielen */
  let tx = t.x, ty = t.y;
  if (t.k === 1 && t.v > 0) { const d = hyp(t.x - sx, t.y - sy), tf = d / w.speed; tx += dcos(t.ang) * t.v * tf; ty += dsin(t.ang) * t.v * tf; }
  let a = datan2(ty - sy, tx - sx);
  if (w.spread) a += (g.rng() - 0.5) * 2 * w.spread;
  const rail = w.kind === 'rail', r0 = s.k === 2 ? s.def.r * 0.9 : s.def.r * 0.9;
  let pierce = w.pierce || 1, dm = w.dmg * mul;
  if (rail && s.k === 1 && s.abT.pierce > 0) { pierce = 6; dm *= 1.5; s.abT.pierce = 0; ev(g, 'abfx', { x: sx, y: sy, id: 'pierce', owner: s.owner }); }
  /* Brood: Bisse nach dem Sprung doppelt */
  if (w.bite && s.k === 1 && s.abT.lunge > 0) { dm *= 2; s.abT.lunge = 0; }
  const pk = rail ? 'rail' : w.acid ? 'acid' : w.bite ? 'bite' : 'kin';
  g.proj.push({ kind: pk, x: sx + dcos(a) * r0, y: sy + dsin(a) * r0, ang: a, sp: w.speed, dmg: dm, owner: s.owner, sid: s.id, tid: t.id, life: (w.range * 1.3 + 60) / w.speed, pierce, hit: null, r: rail ? 6 : w.acid ? 4 : 3, col: w.col, para: w.para ? 1 : 0 });
  ev(g, 'shot', { x: sx, y: sy, kind: pk, owner: s.owner, snd: w.snd, ang: a, big: w.dmg >= 20 });
}
/* Punktverteidigung: nächster feindlicher Torpedo oder Jäger in Reichweite */
function firePd(g, s, w, i) {
  const pi = s.owner, r2 = w.range * w.range;
  let best = null, bd = 1e9;
  for (const q of g.proj) { if (q.kind !== 'torp' || !foes(g, pi, q.owner)) continue; const dx = q.x - s.x, dy = q.y - s.y, d = dx * dx + dy * dy; if (d < r2 && d < bd) { bd = d; best = q; } }
  if (best) {
    best.hp -= 1;
    ev(g, 'pd', { x: s.x, y: s.y, tx: best.x, ty: best.y, owner: pi, kill: best.hp <= 0 });
    if (best.hp <= 0) { best.dead = true; ev(g, 'hit', { x: best.x, y: best.y, kind: 'torpdie' }); }
    return true;
  }
  let f = null;
  nearShips(g, s.x, s.y, w.range, u => { if (u.def.role === 'fighter' && foes(g, pi, u.owner) && canSee(g, pi, u)) { const d = hyp(u.x - s.x, u.y - s.y); if (d < bd) { bd = d; f = u; } } return false; });
  if (f) { ev(g, 'pd', { x: s.x, y: s.y, tx: f.x, ty: f.y, owner: pi, kill: f.hull <= w.dmg }); damage(g, f, w.dmg, 'pd', s, pi, s.x, s.y); return true; }
  return false;
}

/* ------------------------------------------------------------------ Geschosse */
function updateProj(g, dt) {
  const P = g.proj;
  let w = 0;
  for (let i = 0; i < P.length; i++) {
    const q = P[i];
    if (q.dead) continue;
    q.life -= dt;
    if (q.life <= 0) { if (q.kind === 'torp') ev(g, 'hit', { x: q.x, y: q.y, kind: 'torpdie' }); continue; }
    if (q.kind === 'torp') {
      const t = g.byId.get(q.tid);
      if (t && !t.dead) { const want = datan2(t.y - q.y, t.x - q.x); q.ang = turnTo(q.ang, want, q.turn * dt); if (hyp(t.x - q.x, t.y - q.y) < (t.k === 2 ? t.def.r * 0.9 : t.def.r * 0.8) + 6) { damage(g, t, q.dmg, 'torp', g.byId.get(q.sid), q.owner, q.x, q.y); ev(g, 'hit', { x: q.x, y: q.y, kind: 'torp', ang: q.ang }); continue; } }
      q.x += dcos(q.ang) * q.sp * dt; q.y += dsin(q.ang) * q.sp * dt;
      if (q.x < 0 || q.y < 0 || q.x > g.map.w || q.y > g.map.h) continue;
      P[w++] = q; continue;
    }
    /* Geschoss: Strecke dieser Runde gegen Schiffe und Stationen prüfen */
    const x0 = q.x, y0 = q.y, step = q.sp * dt;
    q.x += dcos(q.ang) * step; q.y += dsin(q.ang) * step;
    let hitAny = false;
    const test = e => {
      if (e.dead || !foes(g, q.owner, e.owner)) return false;
      if (q.hit && q.hit.indexOf(e.id) >= 0) return false;
      const rr = (e.k === 2 ? e.def.r * 0.85 : e.def.r * 0.75) + q.r;
      if (segCircle(x0, y0, q.x, q.y, e.x, e.y, rr)) {
        damage(g, e, q.dmg, q.kind, g.byId.get(q.sid), q.owner, x0, y0);
        if (q.kind === 'acid' && !e.dead) acidOn(g, e, q.dmg, q.owner);
        if (q.para && !e.dead) paraOn(g, e, q.owner);
        ev(g, 'hit', { x: e.x + (x0 - e.x) * 0.5, y: e.y + (y0 - e.y) * 0.5, kind: q.kind, ang: q.ang, sh: e.shield > 0 });
        if (q.kind === 'rail') { (q.hit || (q.hit = [])).push(e.id); q.pierce--; q.dmg *= 0.75; if (q.pierce <= 0) hitAny = true; return hitAny; }
        hitAny = true; return true;
      }
      return false;
    };
    nearShips(g, (x0 + q.x) / 2, (y0 + q.y) / 2, step / 2 + 60, test);
    if (!hitAny) for (const b of g.bldgs) { if (hyp(b.x - q.x, b.y - q.y) > step + b.def.r + 20) continue; if (test(b)) break; }
    if (hitAny) continue;
    /* Felsen schlucken Geschosse */
    const cx = (q.x / NAV) | 0, cy = (q.y / NAV) | 0;
    /* Felsen schlucken Geschosse (Eismonde und Erzbrocken nicht: Vorkommen sollen keine Deckung sein, sonst leidet die kinetische Fraktion) */
    if (cx >= 0 && cy >= 0 && cx < g.map.gw && cy < g.map.gh && (g.map.nav[0][cy * g.map.gw + cx] & 1)) { for (const o of g.map.rocks) if (hyp(o.x - q.x, o.y - q.y) < o.r * 0.85) { ev(g, 'hit', { x: q.x, y: q.y, kind: 'rock' }); hitAny = true; break; } }
    if (hitAny) continue;
    if (q.x < 0 || q.y < 0 || q.x > g.map.w || q.y > g.map.h) continue;
    P[w++] = q;
  }
  P.length = w;
}
function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = x0 + dx * t - cx, py = y0 + dy * t - cy;
  return px * px + py * py <= r * r;
}

/* ------------------------------------------------------------------ Schaden
   Reihenfolge: Zusatzschild der Station (Generator) → eigener Schild → Hülle (mit Panzerung). Schildverbund: Ein
   Bulwark im Umkreis übernimmt 40 % des Schadens, solange sein Schild steht. */
function damage(g, t, amt, kind, src, owner, sx, sy, w, bypass) {
  if (t.dead || amt <= 0) return;
  const lv = t.k === 2 ? lvOf(t) : t.def, p = g.players[t.owner];
  t.sT = 0;
  if (t.k === 1) { if (t.abT.invuln > 0) { shieldHit(g, t, sx, sy); return; } if (t.dome > 0) amt *= 0.5; }
  if (t.marked > g.time && owner >= 0 && g.tm[owner] === t.markT) amt *= 1.3;
  /* Phasenpanzerung (Archiv): jeder fünfte Treffer geht durch das Schiff hindurch */
  if (t.k === 1 && p.tfx.phase) { t.phaseN = (t.phaseN | 0) + 1; if (t.phaseN % 5 === 0) { ev(g, 'phase', { x: t.x, y: t.y, r: t.def.r }); return; } }
  /* Spiegel: wirft Strahlschaden zurück; Anpassung: je Waffenart bis zu 50 % weniger */
  if (t.k === 1 && t.def.reflect && kind === 'beam' && src && !src.dead && src.k === 1 && src !== t) damage(g, src, amt * t.def.reflect, 'beam', null, t.owner, t.x, t.y);
  if (t.adapt) { t.adapt[kind] = (t.adapt[kind] || 0) + 1; amt *= 1 - Math.min(0.5, t.adapt[kind] * 0.012); }
  /* Lichtlanze: ein Teil geht durch den Schild direkt auf die Hülle */
  if (w && w.sp && !bypass && (t.shield > 0 || (t.k === 2 && t.give > 0))) { damage(g, t, amt * w.sp, kind, src, owner, sx, sy, w, true); amt *= 1 - w.sp; if (t.dead) return; }
  if (t.k === 1 && !t.linkSkip && t.type !== 'bulwark' && t.def.role !== 'fighter') {
    let bw = null, bd = 1e9;
    nearShips(g, t.x, t.y, 150, u => { if (u.type === 'bulwark' && u.owner === t.owner && u.shield > 0) { const d = hyp(u.x - t.x, u.y - t.y); if (d <= SHIPS.bulwark.link && d < bd) { bd = d; bw = u; } } return false; });
    if (bw) { bw.linkSkip = 1; damage(g, bw, amt * 0.4, kind, src, owner, sx, sy); bw.linkSkip = 0; amt *= 0.6; }
  }
  const mS = DMG_VS_SHIELD[kind] || 1, mH = DMG_VS_HULL[kind] || 1;
  if (bypass) { /* direkt auf die Hülle */ }
  else if (t.k === 2 && t.give > 0) { const d = amt * mS; if (d <= t.give) { t.give -= d; shieldHit(g, t, sx, sy); return; } amt -= t.give / mS; t.give = 0; }
  if (!bypass && t.shield > 0) { const d = amt * mS; if (d <= t.shield) { t.shield -= d; shieldHit(g, t, sx, sy); return; } amt -= t.shield / mS; t.shield = 0; ev(g, 'shdown', { x: t.x, y: t.y, r: t.def.r }); }
  const armor = kind === 'acid' || kind === 'bite' ? 0 : ((lv.armor || 0) + (t.k === 1 ? p.tfx.armor + (t.armorPlus || 0) : 0)) * (t.k === 1 && !t.shieldMax ? 0.5 + 0.5 * t.sub.shield : 1);
  let d = (armor ? Math.max(amt * 0.35, amt - armor * 0.5) : amt) * mH;
  if (t.k === 1) d = subDamage(g, t, d, src);
  t.hull -= d;
  t.hitT = g.time;
  /* Missionen: Hüllen-Untergrenze (das Schiff wird gestellt, nicht zerstört) */
  if (t.minHull && t.hull < t.minHull) t.hull = t.minHull;
  if (t.k === 2 && p && g.time - p.hurtT > 12 && owner >= 0 && owner !== t.owner) { p.hurtT = g.time; p.hurtX = t.x; p.hurtY = t.y; ev(g, 'attack', { owner: t.owner, x: t.x, y: t.y }); }
  if (t.hull <= 0) { kill(g, t, src, owner); return; }
  if (t.k === 1 && t.crewMax && !t.derelict) { t.crew -= t.crewMax * d / t.hullMax * (t.shieldMax ? 0.45 : 0.25); if (t.crew <= 0) makeDerelict(g, t); }
  else if (t.k === 2 && t.crewMax) t.crew = Math.max(t.crewMax * 0.2, t.crew - t.crewMax * d / t.hullMax * 0.3);
}
function shieldHit(g, t, sx, sy) { if ((g.tick + t.id) % 2 === 0) ev(g, 'shield', { x: t.x, y: t.y, r: t.k === 2 ? t.def.r * 1.1 : t.def.r * 1.25, ang: datan2(sy - t.y, sx - t.x), owner: t.owner }); }

/* ------------------------------------------------------------------ Subsysteme, Crew, Wracks
   Jedes Schiff hat fünf Subsysteme (0..1). Hüllentreffer schwächen eines davon: das anvisierte (Angriffsbefehl mit
   Subsystem) kräftig, sonst zufällig und leicht. Wirkung: Antrieb → Tempo, Waffen → Nachladen, Schilde → Aufladung
   (Mars: Panzerung), Sensoren → Sichtweite, Lebenserhaltung → Crew schwindet. Ohne Crew treibt das Schiff als Wrack. */
function subDamage(g, t, d, src) {
  /* Gepanzerte Hüllen (ohne Schild) nehmen jeden Treffer auf der Hülle; damit ihre Subsysteme nicht sofort leiden,
     geht dort nur ein kleiner Teil hinein */
  const pts = t.hullMax * SUB_FRAC, arm = t.shieldMax ? 1 : 0.4;
  const aimed = src && src.k === 1 && src.o && src.o.t === 'attack' && src.o.tid === t.id && src.o.sub;
  if (aimed) { t.sub[aimed] = Math.max(0, t.sub[aimed] - d * SUB_HIT * (t.shieldMax ? 1 : 0.7) / pts); return d * 0.6; }
  const id = SUBS[(g.tick + t.id) % 5];
  t.sub[id] = Math.max(0, t.sub[id] - d * 0.2 * arm / pts);
  return d;
}
function nearOwnYard(g, u, r) { for (const b of g.bldgs) if (!b.dead && b.done && b.owner === u.owner && (b.role === 'yard' || b.role === 'base') && hyp(b.x - u.x, b.y - u.y) <= r + b.def.r) return true; return false; }
function shipUpkeep(g, u, dt) {
  /* Abklingzeiten und laufende Wirkungen */
  for (const id in u.abcd) if (u.abcd[id] > 0) u.abcd[id] -= dt;
  for (const id in u.abT) if (u.abT[id] > 0) { u.abT[id] -= dt; if (u.abT[id] <= 0) abilityEnd(g, u, id); else abilityTick(g, u, id, dt); }
  if (u.dis > 0) u.dis -= dt;
  if (u.truce > 0) u.truce -= dt;
  if (u.crus > 0) u.crus -= dt;
  if (u.pull) { u.pull.t -= dt; if (u.pull.t <= 0) u.pull = null; else { const dx = u.pull.x - u.x, dy = u.pull.y - u.y, d = hyp(dx, dy); if (d > 40) { u.x += dx / d * u.pull.sp * dt; u.y += dy / d * u.pull.sp * dt; } if (u.pull.dmg) damage(g, u, u.pull.dmg * dt, 'beam', null, u.pull.owner, u.pull.x, u.pull.y); } }
  if (u.def.bless && (g.tick + u.id) % 15 === 0) nearShips(g, u.x, u.y, u.def.bless, e => { if (e.owner === u.owner && e !== u) e.blessT = g.time + 0.6; return false; });
  if (u.sprint > 0) u.sprint -= dt;
  if (u.frenzy > 0) u.frenzy -= dt;
  if (u.dome > 0) u.dome -= dt;
  if ((g.tick + u.id) % 10) return;
  const step = dt * 10;
  /* Selbstreparatur der Subsysteme, an Werft oder Basis fünfmal so schnell */
  const yard = nearOwnYard(g, u, 160), rate = SUB_REPAIR * (yard ? 5 : 1) * step;
  for (const id of SUBS) if (u.sub[id] < 1) u.sub[id] = Math.min(1, u.sub[id] + rate);
  /* Lebenserhaltung: unter 50 % schwindet die Crew */
  if (u.sub.life < 0.5 && u.crewMax) { u.crew -= u.crewMax * (0.5 - u.sub.life) * 0.1 * step; if (u.crew <= 0) { makeDerelict(g, u); return; } }
  else if (u.crew < u.crewMax && yard) u.crew = Math.min(u.crewMax, u.crew + u.crewMax * 0.03 * step);
  /* Marines auffüllen an der Werft */
  if (u.def.marines) { const mx = Math.round(u.def.marines * g.players[u.owner].tfx.marines); if (u.marines < mx && yard) u.marines = Math.min(mx, u.marines + 3 * step); }
  /* Bauschiffe besetzen eigene Wracks in der Nähe neu */
  if (u.def.build) nearShips(g, u.x, u.y, 90, w => { if (w.derelict && w.owner === u.owner && w !== u) { recrewShip(g, w, 0); return true; } return false; });
}
function makeDerelict(g, u) {
  if (u.derelict) return;
  u.derelict = true; u.crew = 0; u.shield = 0; u.beams = null; u.tgt = 0; u.o = { t: 'idle' }; u.path = null; u.hx = u.x; u.hy = u.y; u.derT = g.time;
  g.players[u.owner].shipCount -= u.def.cp;
  for (const id in u.abT) u.abT[id] = 0;
  if (u.mine) { const n = g.byId.get(u.mine); if (n) n.miners = Math.max(0, n.miners - 1); u.mine = 0; }
  if (u.dk) { const ref = g.byId.get(u.dk); if (ref) ref.docks = Math.max(0, ref.docks - 1); u.dk = 0; }
  ev(g, 'derelict', { x: u.x, y: u.y, owner: u.owner, name: u.def.name, id: u.id });
}
function derelictStep(g, u, dt) {
  brake(u, dt);
  /* nach zwei Minuten ohne Besatzung zerfällt das Wrack langsam */
  if (g.time - u.derT > 120) { u.hull -= u.hullMax * 0.01 * dt; if (u.hull <= 0) { kill(g, u, null, -1); return; } }
  if (u.v > 0.01) { u.x = clamp(u.x + dcos(u.ang) * u.v * dt, 8, g.map.w - 8); u.y = clamp(u.y + dsin(u.ang) * u.v * dt, 8, g.map.h - 8); }
  u.lx = u.x; u.ly = u.y;
  if (inAsh(g.map, u.x, u.y)) { u.hull -= u.hullMax * ASH_DMG * dt; if (u.hull <= 0) kill(g, u, null, -1); }
}
/* Marines übersetzen: auf Wracks sofortige Übernahme, sonst Kampf gegen die Crew (boardTick in sim.js) */
function boardTransfer(g, u, t) {
  const n = u.marines;
  if (n <= 0) return false;
  u.marines = 0; u.abcd.board = ABIL.board.cd;
  if (t.boardBy >= 0 && g.tm[t.boardBy] !== g.tm[u.owner]) t.boarding = Math.max(0, t.boarding - n * 0.5);
  else { t.boarding += n; t.boardBy = u.owner; }
  ev(g, 'board', { x: t.x, y: t.y, fx: u.x, fy: u.y, owner: u.owner, n });
  if (t.k === 1 && t.derelict && t.boarding > 0) { t.crew = 0; boardTick(g, t, 0); }
  return true;
}

/* ------------------------------------------------------------------ Spezialfähigkeiten
   abilityUse: Auslösen (true, wenn es gezündet hat). abilityTick: je Runde, solange die Wirkung läuft. abilityEnd: Nachwirkung. */
function nearAllies(g, u, r, fn) { const out = []; nearShips(g, u.x, u.y, r, e => { if (!e.dead && g.tm[e.owner] === g.tm[u.owner] && e.def.role !== 'fighter' && !e.derelict && (fn ? fn(e) : true)) out.push(e); return false; }); return out; }
function nearFoes(g, u, r, fn) { const out = []; nearShips(g, u.x, u.y, r, e => { if (!e.dead && foes(g, u.owner, e.owner) && e.def.role !== 'fighter' && canSee(g, u.owner, e) && (fn ? fn(e) : true)) out.push(e); return false; }); out.sort((a, b) => hyp(a.x - u.x, a.y - u.y) - hyp(b.x - u.x, b.y - u.y)); return out; }
function hurtFrac(e) { return e.hull / e.hullMax; }
function abilityUse(g, u, id, t) {
  const A = ABIL[id], p = g.players[u.owner];
  if (!A || u.abcd[id] > 0 || u.derelict) return false;
  let ok = true;
  switch (id) {
    case 'pulse': g.reveals.push({ x: u.x, y: u.y, r: A.r, owner: u.owner, until: g.time + A.dur }); break;
    case 'reveal': g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: Math.max(g.map.w, g.map.h), owner: u.owner, until: g.time + A.dur }); break;
    case 'overload': u.abT.overload = A.dur; break;
    case 'surge': { const al = nearAllies(g, u, A.r); for (const e of al) if (e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.25); for (const b of g.bldgs) if (!b.dead && b.owner === u.owner && b.shieldMax && hyp(b.x - u.x, b.y - u.y) <= A.r + b.def.r) b.shield = Math.min(b.shieldMax, b.shield + b.shieldMax * 0.25); break; }
    case 'resupply': { if (!u.hangar) return false; const h = u.hangar; if (h.n >= u.def.hangar) return false; while (h.ids.length < u.def.hangar) { const a = u.ang + Math.PI + (h.ids.length - 3) * 0.3; const f = addShip(g, 'fighter', u.owner, u.x + dcos(a) * (u.def.r + 8), u.y + dsin(a) * (u.def.r + 8), u.ang); f.par = u.id; f.slot = h.ids.length; h.ids.push(f.id); } h.n = h.ids.length; break; }
    case 'repair': { let best = null, bf = 0.999; const cand = nearAllies(g, u, A.r, e => e.owner === u.owner); cand.push(u); for (const e of cand) { const f = hurtFrac(e); if (f < bf) { bf = f; best = e; } } for (const b of g.bldgs) if (!b.dead && b.done && b.owner === u.owner && hyp(b.x - u.x, b.y - u.y) <= A.r + b.def.r) { const f = hurtFrac(b); if (f < bf) { bf = f; best = b; } } if (!best) return false; u.abx = best.id; u.abT.repair = A.dur; break; }
    case 'grush': { u.abT.grush = A.dur; if (u.def.flag) for (const e of nearAllies(g, u, 260)) if (e !== u) { e.abT.grush = A.dur; } break; }
    case 'flak': u.abT.flak = A.dur; break;
    case 'pierce': u.abT.pierce = A.dur; break;
    case 'broadside': u.abT.broadside = A.dur; break;
    case 'board': { if (!t || t.dead || t.k === 3 || !u.marines || (t.k === 1 && !t.crewMax)) return false; if (t.k === 2 && !u.def.stationsToo) return false; if (!foes(g, u.owner, t.owner) && !t.derelict) return false; u.o = { t: 'board', tid: t.id, x: t.x, y: t.y }; u.path = null; u.tgt = t.id; return true; }
    case 'fieldyard': u.abT.fieldyard = A.dur; break;
    case 'truce': u.abT.truce = A.dur; break;
    case 'mark': { const f = nearFoes(g, u, A.r, e => e.cls >= 1); if (!f.length) return false; f[0].marked = g.time + A.dur; f[0].markT = g.tm[u.owner]; u.abx = f[0].id; break; }
    case 'invuln': u.abT.invuln = A.dur; break;
    case 'lance': { const f = nearFoes(g, u, A.r); let tg = f[0] || null; if (!tg) for (const b of g.bldgs) if (!b.dead && foes(g, u.owner, b.owner) && canSee(g, u.owner, b) && hyp(b.x - u.x, b.y - u.y) <= A.r + b.def.r && (!tg || hyp(b.x - u.x, b.y - u.y) < hyp(tg.x - u.x, tg.y - u.y))) tg = b; if (!tg) return false; damage(g, tg, 700 * p.tfx.beam, 'beam', u, u.owner, u.x, u.y); u.abx = tg.id; ev(g, 'lance', { x: u.x, y: u.y, tx: tg.x, ty: tg.y, owner: u.owner }); break; }
    case 'barrage': { const f = nearFoes(g, u, A.r); let tg = f[0] || null; if (!tg) for (const b of g.bldgs) if (!b.dead && foes(g, u.owner, b.owner) && canSee(g, u.owner, b) && hyp(b.x - u.x, b.y - u.y) <= A.r + b.def.r) { tg = b; break; } if (!tg) return false; for (let i = 0; i < 8; i++) { const a = datan2(tg.y - u.y, tg.x - u.x) + (g.rng() - 0.5) * 0.16; g.proj.push({ kind: 'kin', x: u.x + dcos(a) * u.def.r, y: u.y + dsin(a) * u.def.r, ang: a, sp: 700 + i * 20, dmg: 60 * p.tfx.kin, owner: u.owner, sid: u.id, tid: tg.id, life: (A.r * 1.3 + 60) / 700, pierce: 1, hit: null, r: 5, col: '#ffb070' }); } ev(g, 'shot', { x: u.x, y: u.y, kind: 'kin', owner: u.owner, snd: 'cannon', ang: u.ang, big: true }); break; }
    case 'massboard': { const f = nearFoes(g, u, A.r, e => e.k === 1 && e.crewMax > 0).slice(0, 3); if (!f.length) return false; const n = Math.round(120 * p.tfx.marines / f.length); for (const e of f) { if (e.boardBy >= 0 && g.tm[e.boardBy] !== g.tm[u.owner]) e.boarding = Math.max(0, e.boarding - n * 0.5); else { e.boarding += n; e.boardBy = u.owner; } ev(g, 'board', { x: e.x, y: e.y, fx: u.x, fy: u.y, owner: u.owner, n }); if (e.derelict) { e.crew = 0; boardTick(g, e, 0); } } break; }
    case 'sprint': for (const e of nearAllies(g, u, A.r)) e.sprint = A.dur; u.sprint = A.dur; break;
    case 'dome': for (const e of nearAllies(g, u, A.r)) e.dome = A.dur; u.dome = A.dur; u.abT.dome = A.dur; break;
    /* Runde 3 */
    case 'blink': jumpShip(g, u, A.r); ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r }); break;
    case 'fleetjump': { const al = nearAllies(g, u, A.r); for (const e of al) if (e !== u) { jumpShip(g, e, 500, u.ang); ev(g, 'jump', { x: e.x, y: e.y, owner: e.owner, r: e.def.r }); } jumpShip(g, u, 500); ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r }); break; }
    case 'revive': { let best = null, bd = 1e9; nearShips(g, u.x, u.y, A.r, e => { if (e.derelict && e.owner === u.owner && e.def.hero) { const d = hyp(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } } return false; }); if (!best) return false; recrewShip(g, best, 0.5); break; }
    case 'crusade': for (const e of nearAllies(g, u, A.r)) e.crus = A.dur; u.crus = A.dur; break;
    case 'timejump': { const al = nearAllies(g, u, A.r); al.push(u); for (const e of al) { if (e.snapH > e.hull) e.hull = Math.min(e.hullMax, e.snapH); if (e.snapS > e.shield) e.shield = Math.min(e.shieldMax, e.snapS); ev(g, 'heal', { x: e.x, y: e.y, r: e.def.r, owner: u.owner }); } break; }
    case 'bind': { if (!t || t.dead || t.k === 3 || !foes(g, u.owner, t.owner)) return false; if (t.k === 2 && !u.def.stationsToo) return false; if (tdist(u, t) > A.r) return false; const at = (u.def.bindAt || 0.25) + p.tfx.bindAt; if (t.hull / t.hullMax > at) return false; captureEntity(g, t, t.owner, u.owner); ev(g, 'bound', { x: t.x, y: t.y, owner: u.owner, fx: u.x, fy: u.y }); break; }
    case 'massbind': { const at = 0.4 + p.tfx.bindAt; const f = nearFoes(g, u, A.r, e => e.hull / e.hullMax <= at && e.k === 1); if (!f.length) return false; for (const e of f) { captureEntity(g, e, e.owner, u.owner); ev(g, 'bound', { x: e.x, y: e.y, owner: u.owner, fx: u.x, fy: u.y }); } break; }
    case 'shardstorm': { const f = nearFoes(g, u, A.r); if (!f.length) return false; for (let i = 0; i < 12; i++) { const tg = f[i % f.length], a = datan2(tg.y - u.y, tg.x - u.x) + (g.rng() - 0.5) * 0.2; g.proj.push({ kind: 'kin', x: u.x + dcos(a) * u.def.r, y: u.y + dsin(a) * u.def.r, ang: a, sp: 680 + i * 15, dmg: 36 * p.tfx.beam, owner: u.owner, sid: u.id, tid: tg.id, life: (A.r * 1.3 + 60) / 680, pierce: 1, hit: null, r: 4, col: '#e6d2ff' }); } ev(g, 'shot', { x: u.x, y: u.y, kind: 'kin', owner: u.owner, snd: 'cannon', ang: u.ang, big: true }); break; }
    case 'gravwell': { const f = nearFoes(g, u, A.r); if (!f.length) return false; for (const e of f) e.pull = { x: u.x, y: u.y, t: A.dur, sp: 60, dmg: 0, owner: u.owner }; u.abT.gravwell = A.dur; break; }
    case 'singularity': { const f = nearFoes(g, u, A.r); if (!f.length) return false; for (const e of f) e.pull = { x: u.x, y: u.y, t: A.dur, sp: 90, dmg: 40, owner: u.owner }; u.abT.singularity = A.dur; break; }
    /* Runde 4: The Brood */
    case 'lunge': u.abT.lunge = A.dur; break;
    case 'carpet': g.spores.push({ x: u.x, y: u.y, r: A.r, owner: u.owner, t: 25, heal: 0.02, hurt: 0.015 }); break;
    case 'devour': { const f = nearFoes(g, u, A.r, e => e.k === 1 && e.def.cls !== 'l' && e.hull / e.hullMax < 0.6 && !e.def.flag); if (!f.length) return false; const e = f[0]; u.hull = Math.min(u.hullMax, u.hull + e.hullMax * 0.4); p.ice += Math.round((e.def.cost.ice + e.def.cost.ore) * 0.3); p.stats.earned += Math.round((e.def.cost.ice + e.def.cost.ore) * 0.3); ev(g, 'devour', { x: e.x, y: e.y, r: e.def.r, owner: u.owner, tx: u.x, ty: u.y }); kill(g, e, u, u.owner); break; }
    case 'callswarm': { const n = u.def.flag ? 3 : 1; for (let i = 0; i < n; i++) { const a = u.ang + Math.PI + (i - 1) * 0.6; const s = addShip(g, 'swarm', u.owner, u.x + dcos(a) * (u.def.r + 16), u.y + dsin(a) * (u.def.r + 16), u.ang); if (u.o.t === 'attack') { s.o = { t: 'attack', tid: u.o.tid, x: u.o.x, y: u.o.y }; s.tgt = u.o.tid; } else if (u.o.t === 'move' || u.o.t === 'amove') s.o = { t: 'amove', x: u.o.x, y: u.o.y }; } break; }
    case 'frenzy': for (const e of nearAllies(g, u, A.r)) e.frenzy = A.dur; u.frenzy = A.dur; break;
    case 'plague': { const f = nearFoes(g, u, A.r, e => e.k === 1); if (!f.length) return false; for (const e of f) { paraOn(g, e, u.owner); ev(g, 'hit', { x: e.x, y: e.y, kind: 'acid', ang: 0 }); } break; }
    case 'molt': u.hull = Math.min(u.hullMax, u.hull + u.hullMax * 0.5); u.acid = null; u.para = null; ev(g, 'heal', { x: u.x, y: u.y, r: u.def.r, owner: u.owner }); break;
    case 'mutSwarm': case 'mutSpit': case 'mutRav': case 'mutLeech': case 'mutMaw': {
      const to = SHIPS[A.mut]; if (!to || u.cocoon) return false;
      if (to.yard > 1 && !g.bldgs.some(b => !b.dead && b.owner === u.owner && b.role === 'yard' && b.done && b.lv >= to.yard)) return false;
      if (to.tier > 1 && labLevel(g, u.owner) < to.tier - 1) return false;
      const c = { ice: Math.max(0, shipCost(p, to).ice - shipCost(p, u.def).ice), ore: 0 };
      if (!canPay(p, c)) return false;
      if (p.cpUse + p.queued + to.cp - u.def.cp > p.cpMax) return false;
      pay(p, c);
      u.cocoon = { to: A.mut, t: A.dur * p.tfx.mutT, t0: A.dur * p.tfx.mutT }; u.o = { t: 'idle' }; u.hx = u.x; u.hy = u.y; u.path = null; u.tgt = 0; u.beams = null;
      break;
    }
    case 'netpulse': { for (const b of g.bldgs) if (!b.dead && b.owner === u.owner && hyp(b.x - u.x, b.y - u.y) <= A.r + b.def.r) { b.hull = Math.min(b.hullMax, b.hull + b.hullMax * 0.25); b.forceNet = g.time + 30; if (b.off) { b.off = false; } ev(g, 'heal', { x: b.x, y: b.y, r: b.def.r, owner: u.owner }); } recalcPower(g, u.owner); recalcCp(g, u.owner); break; }
    default: ok = false;
  }
  if (!ok) return false;
  u.abcd[id] = A.cd * ((id === 'blink' || id === 'fleetjump') ? p.tfx.jumpCd : (id === 'bind' || id === 'massbind') ? p.tfx.bindCd : id === 'devour' ? p.tfx.devourCd : 1);
  ev(g, 'ability', { x: u.x, y: u.y, id, owner: u.owner, r: A.r || 0, uid: u.id, dur: A.dur });
  return true;
}
function abilityTick(g, u, id, dt) {
  switch (id) {
    case 'repair': { const e = g.byId.get(u.abx); if (!e || e.dead || hyp(e.x - u.x, e.y - u.y) > ABIL.repair.r + 80) { u.abT.repair = 0; break; } e.hull = Math.min(e.hullMax, e.hull + e.hullMax * 0.025 * dt); if (e.k === 1) for (const s of SUBS) e.sub[s] = Math.min(1, e.sub[s] + 0.05 * dt); if ((g.tick + u.id) % 12 === 0) ev(g, 'heal', { x: e.x, y: e.y, r: e.def.r, owner: u.owner }); break; }
    case 'fieldyard': { for (const e of nearAllies(g, u, ABIL.fieldyard.r)) { e.hull = Math.min(e.hullMax, e.hull + e.hullMax * 0.03 * dt); for (const s of SUBS) e.sub[s] = Math.min(1, e.sub[s] + 0.06 * dt); if ((g.tick + e.id) % 20 === 0 && e.hull < e.hullMax) ev(g, 'heal', { x: e.x, y: e.y, r: e.def.r, owner: u.owner }); } break; }
    case 'truce': { nearShips(g, u.x, u.y, ABIL.truce.r, e => { if (foes(g, u.owner, e.owner)) e.truce = Math.max(e.truce, 0.2); return false; }); break; }
    case 'grush': break;
  }
}
function abilityEnd(g, u, id) {
  if (id === 'overload') u.dis = 3;
  if (id === 'grush' && !g.players[u.owner].tfx.grushFree && u.crewMax) { u.crew -= u.crewMax * 0.05; if (u.crew <= 0) makeDerelict(g, u); }
}
/* KI und Auto-Einsatz: Fähigkeiten zünden, wenn es sich lohnt. Für menschliche Spieler nur, wenn das Schiff auf Auto steht. */
function abilityAuto(g, u) {
  const p = g.players[u.owner];
  if (!p.ai && !u.auto) return;
  const o = u.o, t = o.t === 'attack' ? g.byId.get(o.tid) : null, near = t && !t.dead ? tdist(u, t) : 1e9, fighting = near < maxRange(u.def) + 40;
  for (const id of shipAbils(g, u)) {
    if (u.abcd[id] > 0 || u.abT[id] > 0) continue;
    let go = false;
    switch (id) {
      case 'pulse': go = o.t === 'idle' || o.t === 'amove' || fighting; break;
      case 'reveal': go = g.time > 240; break;
      case 'overload': case 'pierce': case 'lance': case 'barrage': case 'mark': go = fighting; break;
      case 'broadside': go = fighting && near < 300; break;
      case 'surge': go = u.shield < u.shieldMax * 0.4 || nearAllies(g, u, ABIL.surge.r, e => e.shieldMax && e.shield < e.shieldMax * 0.3).length > 0; break;
      case 'resupply': go = !!u.hangar && u.hangar.n <= u.def.hangar / 2; break;
      case 'repair': go = hurtFrac(u) < 0.6 || nearAllies(g, u, ABIL.repair.r, e => hurtFrac(e) < 0.5).length > 0; break;
      case 'grush': go = o.t === 'attack' && near > 300 && near < 900 && (u.crew > u.crewMax * 0.6 || g.players[u.owner].tfx.grushFree); break;
      case 'sprint': go = (o.t === 'attack' || o.t === 'amove') && near > 350; break;
      case 'flak': go = fighting || g.proj.some(q => q.kind === 'torp' && foes(g, u.owner, q.owner) && hyp(q.x - u.x, q.y - u.y) < 260); break;
      case 'fieldyard': go = nearAllies(g, u, ABIL.fieldyard.r, e => hurtFrac(e) < 0.65).length > 0; break;
      case 'truce': go = hurtFrac(u) < 0.4 && nearFoes(g, u, ABIL.truce.r).length > 0; break;
      case 'invuln': go = hurtFrac(u) < 0.35 && nearFoes(g, u, 400).length > 0; break;
      case 'massboard': go = nearFoes(g, u, ABIL.massboard.r).length >= 2; break;
      case 'dome': go = fighting || nearFoes(g, u, 300).length > 0; break;
      case 'board': { if (!u.marines || (o.t !== 'attack' && o.t !== 'idle')) break; const f = nearFoes(g, u, 220, e => e.k === 1 && (e.derelict || e.crew < u.marines * 1.6)); if (f.length) abilityUse(g, u, 'board', f[0]); break; }
      case 'blink': go = o.t === 'attack' && near > 360 && near < 700; break;
      case 'fleetjump': go = (o.t === 'attack' || o.t === 'amove') && near > 500 && near < 1200 && nearAllies(g, u, ABIL.fleetjump.r).length >= 3; break;
      case 'revive': { let any = false; nearShips(g, u.x, u.y, ABIL.revive.r, e => { if (e.derelict && e.owner === u.owner && e.def.hero) any = true; return any; }); go = any; break; }
      case 'crusade': go = fighting && nearAllies(g, u, ABIL.crusade.r).length >= 2; break;
      case 'timejump': go = hurtFrac(u) < 0.5 || nearAllies(g, u, ABIL.timejump.r, e => hurtFrac(e) < 0.4).length >= 2; break;
      case 'bind': { const at = (u.def.bindAt || 0.25) + p.tfx.bindAt; const f = nearFoes(g, u, ABIL.bind.r, e => (e.k === 1 || u.def.stationsToo) && e.hull / e.hullMax <= at); if (f.length) abilityUse(g, u, 'bind', f[0]); break; }
      case 'massbind': go = nearFoes(g, u, ABIL.massbind.r, e => e.hull / e.hullMax <= 0.4 + p.tfx.bindAt).length >= 2; break;
      case 'shardstorm': case 'gravwell': go = fighting; break;
      case 'singularity': go = nearFoes(g, u, ABIL.singularity.r).length >= 3; break;
      case 'lunge': go = o.t === 'attack' && near > 200 && near < 700; break;
      case 'carpet': go = fighting && nearAllies(g, u, 200).length >= 2; break;
      case 'devour': go = nearFoes(g, u, ABIL.devour.r, e => e.k === 1 && e.def.cls !== 'l' && e.hull / e.hullMax < 0.6 && !e.def.flag).length > 0; break;
      case 'callswarm': go = fighting || (o.t === 'idle' && u.def.flag && nearFoes(g, u, 500).length > 0) || (!u.def.flag && o.t !== 'idle'); break;
      case 'frenzy': go = fighting && nearAllies(g, u, ABIL.frenzy.r).length >= 3; break;
      case 'plague': go = nearFoes(g, u, ABIL.plague.r).length >= 2; break;
      case 'molt': go = hurtFrac(u) < 0.35; break;
      case 'mutSwarm': case 'mutSpit': case 'mutRav': case 'mutLeech': case 'mutMaw': break;
      case 'netpulse': go = g.bldgs.some(b => !b.dead && b.owner === u.owner && (b.off || b.hull < b.hullMax * 0.5) && hyp(b.x - u.x, b.y - u.y) <= ABIL.netpulse.r); break;
    }
    if (go) abilityUse(g, u, id, t);
  }
}

/* ------------------------------------------------------------------ Runde 3: Sprünge, Erwecken, Netzlieferung */
function jumpShip(g, u, dist, ang) {
  const a = ang === undefined ? u.ang : ang, m = g.map;
  let x = clamp(u.x + dcos(a) * dist, EDGE + 20, m.w - EDGE - 20), y = clamp(u.y + dsin(a) * dist, EDGE + 20, m.h - EDGE - 20);
  const c = nearestFree(m, u.cls, (x / NAV) | 0, (y / NAV) | 0);
  if (c >= 0) { x = (c % m.gw) * NAV + NAV / 2; y = ((c / m.gw) | 0) * NAV + NAV / 2; }
  ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r, from: 1 });
  u.x = x; u.y = y; u.path = null; u.hx = x; u.hy = y; u.lx = x; u.ly = y;
  if (u.o.t === 'move' || u.o.t === 'amove') u.path = null;
}
function recrewShip(g, w, hullFrac) {
  w.derelict = false; w.dormant = 0; w.crew = Math.max(w.crew, w.crewMax * 0.3); w.sub.life = Math.max(w.sub.life, 0.6);
  if (hullFrac) w.hull = Math.max(w.hull, w.hullMax * hullFrac);
  g.players[w.owner].shipCount += w.def.cp;
  setIdle(w);
  ev(g, 'recrew', { x: w.x, y: w.y, owner: w.owner, hero: w.hero, name: w.def.name });
}
function netDeliver(g, u) {
  const p = g.players[u.owner];
  let bonus = 1;
  for (const b of g.bldgs) if (!b.dead && b.owner === u.owner && b.role === 'refinery' && b.done && !b.off) bonus = Math.max(bonus, lvOf(b).bonus || 1);
  const amt = Math.round(u.cargo * bonus * (p.ai ? p.ai.cfg.inc : 1));
  earn(p, u.ckind, amt); p.haulR += amt / 45;
  ev(g, 'deliver', { owner: u.owner, x: u.x, y: u.y, kind: u.ckind, amt, net: 1 });
  u.cargo = 0;
}
function nearestNetNode(g, pi, x, y) {
  let best = null, bd = 1e9;
  for (const b of g.bldgs) { if (b.dead || b.owner !== pi || !b.done || b.off) continue; const d = hyp(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
  for (const u of g.ships) { if (u.dead || u.owner !== pi || !u.def.node || u.derelict) continue; const d = hyp(u.x - x, u.y - y); if (d < bd) { bd = d; best = u; } }
  return best;
}

/* ------------------------------------------------------------------ Erkunden
   Ziel = unerkundete Sichtzelle mit der kleinsten Bewertung: Entfernung, Abzug in Flugrichtung (weniger Zickzack),
   Aufschlag nahe den Zielen anderer eigener Erkunder (sie verteilen sich), Aschenebel und Rand gemieden. Alles erkundet:
   eine zufällige weit entfernte Stelle (Patrouille). Deterministisch (g.rng), damit es im Mehrspieler gleich läuft. */
function exploredAt(g, pi, x, y) { const p = g.players[pi], cx = clamp((x / VIS) | 0, 0, g.vw - 1), cy = clamp((y / VIS) | 0, 0, g.vh - 1); return !!p.explored[cy * g.vw + cx]; }
function exploreTarget(g, u) {
  const p = g.players[u.owner], ex = p.explored, vw = g.vw, vh = g.vh, m = g.map, hx = dcos(u.ang), hy = dsin(u.ang);
  const others = []; for (const s of g.ships) if (s !== u && !s.dead && s.owner === u.owner && s.o.t === 'explore' && s.o.x !== undefined) others.push(s.o);
  /* Gefahren meiden: bekannte feindliche Geschützstationen (auf erkundetem Grund) und große Stätten mit Wächtern */
  const danger = [];
  for (const b of g.bldgs) if (!b.dead && foes(g, u.owner, b.owner) && exploredAt(g, u.owner, b.x, b.y)) { const w = lvOf(b).wpn; if (w.length) danger.push([b.x, b.y, b.def.r + Math.max(...w.map(q => q.range)) + 220]); }
  for (const st of g.sites) if (st.kind !== 'ruin') danger.push([st.x, st.y, st.r + 380]);
  let best = null, bs = 1e18;
  for (let cy = 0; cy < vh; cy += 2) for (let cx = 0; cx < vw; cx += 2) {
    if (ex[cy * vw + cx]) continue;
    const x = (cx + 0.5) * VIS, y = (cy + 0.5) * VIS;
    if (inAsh(m, x, y)) continue;
    let bad = false; for (const d of danger) if (hyp(d[0] - x, d[1] - y) < d[2]) { bad = true; break; } if (bad) continue;
    const dx = x - u.x, dy = y - u.y, d = Math.sqrt(dx * dx + dy * dy);
    let sc = d - (dx * hx + dy * hy) * 0.35;
    for (const o of others) { const e = hyp(o.x - x, o.y - y); if (e < 700) sc += (700 - e) * 1.5; }
    if (sc < bs) { bs = sc; best = { x, y }; }
  }
  if (best) return best;
  for (let k = 0; k < 8; k++) { const x = EDGE + 150 + g.rng() * (m.w - 2 * EDGE - 300), y = EDGE + 150 + g.rng() * (m.h - 2 * EDGE - 300); if (hyp(x - u.x, y - u.y) > 900 && !inAsh(m, x, y)) return { x, y }; }
  return null;
}
