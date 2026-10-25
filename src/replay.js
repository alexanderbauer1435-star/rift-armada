/* ===== replay.js ===== */
'use strict';
/* WIEDERHOLUNG UND ZEITLEISTE – Die Simulation ist deterministisch: Startoptionen (mit Saat) und die Befehlsliste g.log
   (Takt, Befehl, …) genügen, um eine Partie exakt nachzuspielen. Die KI rechnet dabei von selbst wieder dasselbe.
   rpCreate(opts, log) baut die Partie neu auf; rpFeed(g) speist vor jedem Takt die Befehle dieses Takts ein.
   Im Spiel: »Wiederholung« am Ende einer Partie zeigt alles ohne Nebel, mit Pause, Tempo 1×–16× und Zeitleiste zum
   Springen (zurück = neu rechnen bis zur Stelle). Dazu zeichnet die Partie alle 10 s Flottenwert und Einnahmen je
   Partei auf; der Endbildschirm zeigt beides als Verlauf. Die letzte Partie bleibt auf dem Gerät (ra.replay). */
function rpCreate(opts, log) { const g = createGame(JSON.parse(JSON.stringify(opts))); g.rp = { log, i: 0 }; return g; }
function rpFeed(g) {
  const r = g.rp; if (!r) return;
  const L0 = r.log;
  while (r.i < L0.length && L0[r.i] <= g.tick) { const t = L0[r.i], c = L0[r.i + 1]; r.i += 2; if (t === g.tick) execCmd(g, JSON.parse(JSON.stringify(c))); }
}
/* Takt für Takt wie im Spiel: erst die Befehle dieses Takts, dann der Schritt */
function rpStep(g) { rpFeed(g); stepGame(g); }
/* Eine Partie lässt sich nur nachspielen, wenn ihre Befehle ab Takt 0 vorliegen und kein Skript außerhalb der Simulation
   eingreift (Kampagne, Feldzug und Mehrspieler-Wiederaufnahme sind ausgenommen) */
function rpPossible(g, kind) { return !!(g && g.opts && Array.isArray(g.log) && !g.opts.mis && !g.cq && !g.loadedMid && (kind === 'skirmish' || kind === 'waves' || kind === 'mp')); }

/* ---------------- Verlauf (Flottenwert und Einnahmen je Partei, alle 10 s Spielzeit) ---------------- */
const RP = { hist: null, histT: -1, view: null, play: true, speed: 2, busy: false };
function rpSample(g) {
  if (!g || UI.kind === 'replay') return;
  if (!RP.hist || RP.histG !== g) { RP.hist = []; RP.histG = g; RP.histT = -99; }
  if (g.time - RP.histT < 10) return; RP.histT = g.time;
  const row = { t: Math.round(g.time), p: [] };
  for (const p of g.players) {
    if (p.neutral || p.pirate || p.threat) { row.p.push(null); continue; }
    let fleet = 0; for (const u of g.ships) if (!u.dead && !u.derelict && u.owner === p.id && armed(u)) fleet += (u.def.cost.ice || 0) + (u.def.cost.ore || 0);
    row.p.push({ fleet, earned: Math.round(p.stats.earned || 0) });
  }
  RP.hist.push(row);
}
function rpChart(cv, key, title) {
  const h = RP.hist; if (!h || h.length < 2) return false;
  const dpr = devicePixelRatio || 1, W = cv.clientWidth || 300, H = cv.clientHeight || 120; cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  const g = UI.g, n = g.players.length, val = (row, i) => { const q = row.p[i]; if (!q) return null; if (key === 'fleet') return q.fleet; const j = h.indexOf(row); if (j < 1) return 0; const prev = h[j - 1].p[i]; return prev ? (q.earned - prev.earned) * 60 / Math.max(1, row.t - h[j - 1].t) : 0; };
  let mx = 1; for (const r of h) for (let i = 0; i < n; i++) { const v = val(r, i); if (v > mx) mx = v; }
  const t1 = h[h.length - 1].t || 1, L0 = 34, T0 = 18, Wp = W - L0 - 6, Hp = H - T0 - 16;
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(232,238,244,0.75)'; ctx.fillText(title, L0, 12);
  ctx.strokeStyle = 'rgba(143,227,255,0.18)'; ctx.lineWidth = 1;
  for (let k = 0; k <= 2; k++) { const y = T0 + Hp * k / 2; ctx.beginPath(); ctx.moveTo(L0, y); ctx.lineTo(L0 + Wp, y); ctx.stroke(); ctx.fillText(fmt(Math.round(mx * (1 - k / 2))), 0, y + 4); }
  ctx.fillText(clock(t1), L0 + Wp - 28, H - 2);
  for (let i = 0; i < n; i++) {
    const p = g.players[i]; if (p.neutral || p.pirate || p.threat) continue;
    ctx.strokeStyle = pcolor(p); ctx.lineWidth = i === UI.me ? 2.5 : 1.5; ctx.beginPath(); let first = true;
    for (const r of h) { const v = val(r, i); if (v === null) continue; const x = L0 + Wp * r.t / t1, y = T0 + Hp * (1 - v / mx); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return true;
}
function rpEndCharts() {
  const box = $('endCharts'); if (!box) return;
  box.hidden = !(RP.hist && RP.hist.length >= 2);
  if (box.hidden) return;
  requestAnimationFrame(() => { rpChart($('chFleet'), 'fleet', L('Flottenwert')); rpChart($('chInc'), 'inc', L('Einnahmen pro Minute')); });
}
/* ---------------- Letzte Partie sichern ---------------- */
function rpStore(g, kind) {
  if (!rpPossible(g, kind)) return false;
  try { localStorage.setItem('ra.replay', JSON.stringify({ v: window.RA_BUILD || window.RA_VERSION || 'dev', opts: g.opts, log: g.log, end: g.tick, me: UI.me, kind, at: Date.now() })); return true; } catch (e) { return false; }
}
function rpLoadLast() { try { const d = JSON.parse(localStorage.getItem('ra.replay') || 'null'); if (d && d.v === (window.RA_BUILD || window.RA_VERSION || 'dev')) return d; } catch (e) { /* nichts */ } return null; }

/* ---------------- Betrachter ---------------- */
function rpStart(d) {
  if (!d) return;
  const g = rpCreate(d.opts, d.log);
  resetUi();
  RP.view = { d, end: d.end || 1 }; RP.play = true; RP.speed = 2;
  UI.g = g; UI.me = -1; UI.P = null; UI.attract = false; UI.kind = 'replay'; UI.opts = d.opts; UI.speed = RP.speed; UI.endShown = true;
  $('menu').hidden = true; $('end').hidden = true;
  R.setGame(g, -1);
  $('hud').hidden = false; document.body.classList.add('replay'); $('rpBar').hidden = false;
  layout();
  R.cam.z = clamp(Math.min(R.cssW, R.cssH) / 700, 0.4, 1);
  const s = g.players[d.me >= 0 ? d.me : 0].start; R.center(s.x, s.y);
  rpBarUpdate(); SND.init();
}
function rpStop() { RP.view = null; document.body.classList.remove('replay'); $('rpBar').hidden = true; }
/* Springen: vorwärts weiterrechnen, rückwärts neu aufbauen; in Häppchen, damit die Seite nicht einfriert */
function rpSeek(tick) {
  if (!RP.view || RP.busy) return;
  let g = UI.g;
  if (tick < g.tick) { g = rpCreate(RP.view.d.opts, RP.view.d.log); UI.g = g; R.setGame(g, -1); }
  RP.busy = true; $('rpTime').textContent = L('Spule …');
  const chunk = () => {
    if (UI.g !== g || !RP.view) { RP.busy = false; return; }
    const lim = Math.min(tick, RP.view.end); let n = 0;
    while (g.tick < lim && !g.over && n < 900) { rpStep(g); g.ev.length = 0; n++; }
    if (g.tick < lim && !g.over) { $('rpSeek').value = Math.round(1000 * g.tick / RP.view.end); setTimeout(chunk, 0); }
    else { RP.busy = false; rpBarUpdate(); }
  };
  chunk();
}
function rpBarUpdate() {
  if (!RP.view) return; const g = UI.g;
  if (!RP.busy) { $('rpSeek').value = Math.round(1000 * g.tick / RP.view.end); $('rpTime').textContent = clock(g.time) + ' / ' + clock(RP.view.end * STEP); }
  $('rpPlay').textContent = RP.play ? '❚❚' : '▶';
  document.querySelectorAll('#rpSpeed button').forEach(b => b.classList.toggle('on', +b.dataset.s === RP.speed));
}
function rpInit() {
  /* vor jedem Schritt die Befehle des Takts einspeisen (nur wenn eine Wiederholung läuft) */
  const step0 = stepGame; stepGame = function (g) { if (g.rp) rpFeed(g); return step0(g); };
  const cons = UI.consume; UI.consume = function (evs) { if (UI.kind === 'replay') { if (typeof sfxEvents === 'function') { try { sfxEvents(UI.g, RP.view && RP.view.d.me >= 0 ? RP.view.d.me : 0, evs); } catch (e) { /* nur Ton */ } } return; } return cons.call(this, evs); };
  const hu = hudUpdate; hudUpdate = function () { if (UI.kind === 'replay') { rpTick(); return; } hu(); rpSample(UI.g); };
  const se = showEnd; showEnd = function () { const was = UI.endShown; se(); if (!was && UI.endShown && !UI.g.mis) { rpStore(UI.g, UI.kind); $('eReplay').hidden = !rpPossible(UI.g, UI.kind); rpEndCharts(); } };
  $('eReplay').addEventListener('click', () => { const d = rpLoadLast(); if (d) rpStart(d); else toast(L('Keine Wiederholung vorhanden'), 'warn'); });
  $('rpPlay').addEventListener('click', () => { RP.play = !RP.play; UI.paused = !RP.play; rpBarUpdate(); });
  for (const s of [1, 2, 4, 8, 16]) { const b = document.createElement('button'); b.textContent = s + '×'; b.dataset.s = s; b.addEventListener('click', () => { RP.speed = s; UI.speed = s; rpBarUpdate(); }); $('rpSpeed').appendChild(b); }
  $('rpSeek').addEventListener('change', e => { if (RP.view) rpSeek(Math.round(+e.target.value / 1000 * RP.view.end)); });
  $('rpQuit').addEventListener('click', () => { rpStop(); toMenu(); });
  if ($('mReplay')) $('mReplay').addEventListener('click', () => { const d = rpLoadLast(); if (d) { $('loadWin').hidden = true; rpStart(d); } else toast(L('Noch keine Partie aufgezeichnet'), 'warn'); });
}
function rpTick() {
  const g = UI.g; if (!RP.view || !g) return;
  if (g.tick >= RP.view.end || g.over) { if (RP.play) { RP.play = false; UI.paused = true; toast(L('Ende der Wiederholung')); } }
  rpBarUpdate();
}
