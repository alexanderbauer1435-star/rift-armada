/* ===== ui.js ===== */
'use strict';
/* =====================================================================
   BEDIENUNG – Eingabe (Finger, Maus, Tastatur), Auswahl und Befehle, Leisten (HUD), Baumenü, Tooltips über langes
   Drücken, Meldungen, Hauptmenü, Einstellungen, Pause, Abschluss.
   ===================================================================== */
const UI = {
  subAim: '', superTgt: null, docPick: null, abTarget: null, selS: 0, abId: '',
  g: null, me: -1, P: null, sel: new Set(), selB: 0, mode: 'normal', place: null, box: null, boxMode: false, keys: {}, paused: false, endShown: false, attract: true, kind: '', opts: null,
  speed: 1, tab: 'eco', showRange: false, showAll: false, mark: null, mouse: false, cx: 0, cy: 0, hx: 0, hy: 0, onView: false, rect: null, form: 'wedge', lastTap: 0, lastTapId: 0, hovT: 0, tipT: 0, saveAt: 0, alertT: -99, alertPos: null, camTravel: 0, fsOff: false, fsPause: false, mPage: 'home', items: []
};
const SET = { vol: 55, mus: 40, voice: true, scale: 1, speed: 1, bars: 'auto', qual: 'auto', lang: 'de', gfx: '3d' };
const MENU = { faction: 'alliance', map: 'haven', opp: 1, lvl: 2, res: 'normal', oppF: 'random', mode: 'skirmish', allies: 1, allyLvl: 2 };
const SCALES = [0.9, 1, 1.15, 1.3], SPEEDS = [0.75, 1, 1.5, 2];
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString(I18N.lang === 'en' ? 'en-US' : 'de-DE');
function setText(el, s) { if (typeof el === 'string') el = $(el); s = String(s); if (el._t !== s) { el._t = s; el.textContent = s; } }
function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* nicht verfügbar */ } } }
function clock(t) { return Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function issue(c) { c.p = UI.me; return issueCmd(UI.g, c); }
const ids = us => us.map(u => u.id);
function isFoe(o) { return o >= 0 && UI.g.tm[o] !== UI.g.tm[UI.me]; }
function pcolor(p) { return p.color || p.F.team; }
function costTxt(c) { c = c || { ice: 0, ore: 0 }; if (UI.P && UI.P.F && UI.P.F.bio) return (c.ice + c.ore) + ' ' + L('Biomasse'); return (c.ice ? c.ice + ' ' + L('Eis') : '') + (c.ice && c.ore ? ' · ' : '') + (c.ore ? c.ore + ' ' + L('Erz') : ''); }

/* ------------------------------------------------------------------ Meldungen */
function toast(msg, cls, ms) {
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast ' + (cls || ''); el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 420); }, ms || 3200);
}
function showInfo(txt, ms) { const el = $('info'); el.textContent = txt; el.hidden = false; UI.infoT = performance.now() + (ms || 2500); }
/* Tooltip über langes Drücken auf eine Taste */
function tipShow(html) { const t = $('tip'); t.innerHTML = html; t.hidden = false; UI.tipT = performance.now(); }
function tipHide() { $('tip').hidden = true; }
/* Taste mit langem Drücken: kurz = fn, lang = Tooltip (tipHtml) oder alt (altFn) */
function bindHold(el, fn, tipHtml, altFn) {
  let tm = 0, held = false, pid = -1;
  const down = e => { if (e.button > 0) return; pid = e.pointerId; held = false; clearTimeout(tm); tm = setTimeout(() => { held = true; buzz(12); if (altFn) altFn(); else if (tipHtml) tipShow(typeof tipHtml === 'function' ? tipHtml() : tipHtml); }, 420); };
  const up = e => { if (e.pointerId !== pid) return; clearTimeout(tm); pid = -1; if (held) { if (!altFn) setTimeout(tipHide, 2600); return; } if (e.type === 'pointerup') fn(e); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', e => { if (e.pointerId === pid) { clearTimeout(tm); pid = -1; } });
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (tipHtml) tipShow(typeof tipHtml === 'function' ? tipHtml() : tipHtml); setTimeout(tipHide, 2600); });
}

/* ------------------------------------------------------------------ Auswahl */
function selShips() { const g = UI.g, out = []; for (const id of UI.sel) { const u = g.byId.get(id); if (u && !u.dead && u.k === 1) out.push(u); else UI.sel.delete(id); } return out; }
function setSel(us) { UI.sel.clear(); for (const u of us) UI.sel.add(u.id); UI.selB = 0; UI.selS = 0; endMode(); hudSel(); }
function selAdd(us) { for (const u of us) UI.sel.add(u.id); UI.selB = 0; hudSel(); }
function selBldg(b) { UI.sel.clear(); UI.selB = b.id; UI.selS = 0; endMode(); hudSel(); }
function selSite(o) { UI.sel.clear(); UI.selB = 0; UI.selS = o.id; endMode(); hudSel(); }
function desel() { UI.sel.clear(); UI.selB = 0; UI.selS = 0; endMode(); hudSel(); }
function mark(x, y, col) { UI.mark = { x, y, t: R.time, col: col || 'rgba(140,255,170,0.9)' }; }
function endMode() { UI.mode = 'normal'; UI.place = null; UI.superTgt = null; $('view').classList.remove('cu-place', 'cu-attack'); }
/* Was liegt unter dem Punkt? Eigene Schiffe zuerst, dann Feinde, Stationen, Vorkommen */
/* Konter-Hinweis für ein Schiff aus seinen Waffen (Schaden je Sekunde gewichtet): stark/schwach gegen eine Größenklasse */
function counterTxt(def) {
  let tot = 0; const m = { s: 0, m: 0, l: 0 };
  for (const w of def.wpn || []) { if (w.kind === 'pd' || !COUNTER[w.kind]) continue; const d = w.dmg / Math.max(0.05, w.reload); tot += d; for (const c in m) m[c] += d * COUNTER[w.kind][c]; }
  if (!tot) return '';
  let hi = 's', lo = 's'; for (const c in m) { m[c] /= tot; if (m[c] > m[hi]) hi = c; if (m[c] < m[lo]) lo = c; }
  const out = []; if (m[hi] >= 1.1) out.push(L('Stark gegen {0}', L(CLS_NAME[hi]))); if (m[lo] <= 0.9) out.push(L('schwach gegen {0}', L(CLS_NAME[lo])));
  return out.join(' · ');
}
function pickAt(wx, wy) {
  const g = UI.g, z = R.cam.z, slack = 10 / z;
  let best = null, bd = 1e9;
  const test = (e, r, pri) => { const d = hyp(e.x - wx, e.y - wy) - r; if (d < slack && d - pri * 1000 < bd) { bd = d - pri * 1000; best = e; } };
  for (const u of g.ships) { if (u.dead || !R.visible(u) || u.def.role === 'fighter') continue; test(u, u.def.r + 4, u.owner === UI.me ? 2 : 1); }
  for (const b of g.bldgs) { if (b.dead || !R.seen(b.x, b.y)) continue; test(b, b.def.r, b.owner === UI.me ? 0.5 : 0.3); }
  if (!best) { for (const o of g.sites) if (R.seen(o.x, o.y)) test(o, o.r, 0.2); for (const o of g.gates) if (R.seen(o.x, o.y)) test(o, o.r, 0.2); }
  if (!best) for (const n of g.nodes) test(n, n.r, 0);
  return best;
}
function tap(sx, sy) {
  const g = UI.g, w = R.s2w(sx, sy), wx = w.x, wy = w.y;
  if (UI.mode === 'place') { movePlace(sx, sy); return; }
  if (UI.mode === 'amove') { orderMove(selShips(), wx, wy, true); endMode(); return; }
  if (UI.mode === 'rally') { const b = g.byId.get(UI.selB); if (b) { issue({ t: 'rally', b: b.id, x: wx, y: wy }); mark(wx, wy); SND.play('order'); } endMode(); return; }
  if (UI.mode === 'board') { const hit = pickAt(wx, wy); if (hit && (hit.k === 1 || hit.k === 2) && (isFoe(hit.owner) || hit.derelict)) { const r = issue({ t: 'board', u: ids(selShips().filter(u => u.def.marines)), e: hit.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { mark(hit.x, hit.y, '#ffb86b'); SND.play('order'); } endMode(); hudCmds(); } else showInfo(L('Entern: feindliches Schiff antippen'), 1500); return; }
  if (UI.mode === 'super') { UI.superTgt = { x: wx, y: wy }; mark(wx, wy, '#ffb86b'); SND.play('click'); hudCmds(true); return; }
  if (UI.mode === 'abt') { const hit = pickAt(wx, wy); if (hit && (hit.k === 1 || hit.k === 2) && isFoe(hit.owner)) { const r = issue({ t: 'ab', u: ids(selShips()), id: UI.abId, e: hit.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { mark(hit.x, hit.y, '#c9a0ff'); SND.play('order'); } endMode(); hudCmds(); } else showInfo(L('Feindliches Ziel antippen'), 1500); return; }
  const hit = pickAt(wx, wy), us = selShips();
  const now = performance.now(), dbl = hit && hit.id === UI.lastTapId && now - UI.lastTap < 380;
  UI.lastTap = now; UI.lastTapId = hit ? hit.id : 0;
  if (hit && hit.k === 1 && hit.owner === UI.me) {
    if (dbl) { const all = g.ships.filter(u => !u.dead && u.owner === UI.me && u.type === hit.type && R.inView(u.x, u.y, 0)); setSel(all); toast(L('{0} × {1} gewählt', all.length, L(hit.def.name))); }
    else if (UI.keys.ShiftLeft || UI.keys.ShiftRight) { if (UI.sel.has(hit.id)) { UI.sel.delete(hit.id); hudSel(); } else selAdd([hit]); }
    else setSel([hit]);
    SND.play('click'); return;
  }
  if (hit && hit.k === 2 && hit.owner === UI.me && !us.some(u => u.def.build && !hit.done)) { if (us.length && hit.role === 'yard' && us.some(u => u.hull < u.hullMax)) { orderMove(us, hit.x + (us[0].x - hit.x) * 0.3, hit.y + (us[0].y - hit.y) * 0.3, false); showInfo(L('Zur Werft: Reparatur im Umkreis')); return; } selBldg(hit); SND.play('click'); return; }
  if (!us.length) {
    if (hit && (hit.k === 4 || hit.k === 5)) { selSite(hit); SND.play('click'); return; }
    if (hit && hit.k === 3) showInfo(hit.kind === 'ice' ? L('Eismond: {0} Eis', fmt(hit.amount)) : L('Erz: {0}', fmt(hit.amount)));
    else if (hit && hit.k === 1) showInfo((hit.derelict ? L('Wrack') + ': ' : L('Feind') + ': ') + L(hit.def.name) + (hit.crewMax ? ' · ' + L('Crew') + ' ' + Math.round(hit.crew) + '/' + hit.crewMax : ''));
    else if (hit && hit.k === 2) showInfo(L('Feind: {0} Stufe {1}', L(hit.def.name), ROMAN[hit.lv]));
    else { const w = nearWreck(g, wx, wy, 70 / Math.max(0.3, R.cam.z)); if (w && R.seen(w.x, w.y)) showInfo(L('Wrack: {0} bergbar. Frachter wählen und das Wrack antippen.', Math.round(w.sal))); else if (UI.selB) desel(); }
    return;
  }
  order(us, hit, wx, wy);
}
function order(us, hit, wx, wy) {
  if (hit && (hit.k === 4 || hit.k === 5)) { const a = datan2(wy - hit.y, wx - hit.x); orderMove(us, hit.x + dcos(a) * (hit.r + 60), hit.y + dsin(a) * (hit.r + 60), false); showInfo(L(hit.k === 5 ? 'Zum Tor. Durch die Mitte fliegen, um zu springen' : hit.kind === 'ruin' ? 'Zur Ruine: Schiffe daneben scannen sie' : 'Zur Stätte: Kampfschiffe daneben halten sie'), 3000); return; }
  if (hit && hit.k === 3) {
    const tk = us.filter(u => u.def.cargo);
    if (tk.length && hit.amount > 0) { issue({ t: 'harvest', u: ids(tk), e: hit.id }); mark(hit.x, hit.y, '#8fe3ff'); SND.play('order'); if (tk.length < us.length) orderMove(us.filter(u => !u.def.cargo), wx, wy, false); return; }
    orderMove(us, wx, wy, false); return;
  }
  if (!hit) {
    const w = nearWreck(UI.g, wx, wy, 70 / Math.max(0.3, R.cam.z)), tk = us.filter(u => u.def.cargo);
    if (w && tk.length && R.seen(w.x, w.y)) { const r = issue({ t: 'salvage', u: ids(tk), w: w.id }); if (!r) { mark(w.x, w.y, '#ffd36b'); SND.play('order'); showInfo(L('Bergung: {0} zerlegen das Wrack', tk.length)); if (tk.length < us.length) orderMove(us.filter(u => !u.def.cargo), wx, wy, false); return; } }
  }
  if (hit && hit.k === 1 && hit.derelict) {
    const gz = us.filter(u => u.def.eat);
    if (gz.length) { issue({ t: 'eat', u: ids(gz), id: hit.id }); mark(hit.x, hit.y, '#b4ff3c'); SND.play('order'); showInfo(L('Grazer verschlingen das Wrack')); if (gz.length < us.length) orderMove(us.filter(u => !u.def.eat), wx, wy, false); return; }
  }
  if (hit && (hit.k === 1 || hit.k === 2) && isFoe(hit.owner)) {
    const arm = us.filter(u => armed(u));
    if (arm.length) { issue({ t: 'attack', u: ids(arm), e: hit.id, sub: hit.k === 1 && UI.subAim ? UI.subAim : undefined }); mark(hit.x, hit.y, UI.subAim && hit.k === 1 ? '#c9a0ff' : 'rgba(255,120,90,0.9)'); SND.play('order'); if (arm.length < us.length) orderMove(us.filter(u => !armed(u)), wx, wy, false); return; }
    orderMove(us, wx, wy, false); return;
  }
  if (hit && hit.k === 2 && !hit.done && hit.owner === UI.me) {
    const bl = us.filter(u => u.def.build);
    if (bl.length) { issue({ t: 'resume', u: ids(bl), b: hit.id }); mark(hit.x, hit.y); SND.play('order'); if (bl.length < us.length) orderMove(us.filter(u => !u.def.build), wx, wy, false); return; }
  }
  orderMove(us, wx, wy, false);
}
function orderMove(us, x, y, am) {
  if (!us.length) return;
  const r = issue({ t: 'move', u: ids(us), x, y, am, form: UI.form });
  if (r) { toast(L(r), 'warn'); SND.play('err'); return; }
  mark(x, y, am ? 'rgba(255,120,90,0.9)' : undefined); SND.play('order');
}
function finishBox(add) {
  const b = UI.box; UI.box = null;
  if (!b || Math.abs(b.x1 - b.x0) < 6 || Math.abs(b.y1 - b.y0) < 6) return;
  const g = UI.g, a = R.s2w(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)), c = R.s2w(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
  const us = g.ships.filter(u => !u.dead && u.owner === UI.me && u.def.role !== 'fighter' && u.x >= a.x && u.x <= c.x && u.y >= a.y && u.y <= c.y);
  if (!us.length) return;
  /* Kampfschiffe vor Frachtern: Wer Frachter und Flotte zugleich erfasst, meint meistens die Flotte */
  const war = us.filter(u => armed(u));
  const pick = war.length ? war : us;
  if (add) selAdd(pick); else setSel(pick);
  SND.play('click');
}
function grpSelect(i) {
  const us = UI.g.ships.filter(u => !u.dead && u.owner === UI.me && u.grp === i);
  if (!us.length) { toast(L('Gruppe {0} ist leer. Lange drücken speichert die Auswahl.', i)); return; }
  setSel(us); SND.play('click');
  if (UI.grpLast === i && performance.now() - UI.grpT < 500) { let cx = 0, cy = 0; for (const u of us) { cx += u.x; cy += u.y; } R.center(cx / us.length, cy / us.length); }
  UI.grpLast = i; UI.grpT = performance.now();
}
function grpAssign(i) {
  const us = selShips();
  if (!us.length) { toast(L('Erst Schiffe wählen')); return; }
  for (const u of UI.g.ships) if (!u.dead && u.owner === UI.me && u.grp === i && !UI.sel.has(u.id)) u.grp = 0;
  issue({ t: 'group', u: ids(us), n: i });
  toast(L('Gruppe {0} gespeichert: {1} Schiffe', i, us.length), 'good'); SND.play('click'); hudGroups();
}

/* ------------------------------------------------------------------ Bauen */
function startPlace(role) {
  const us = selShips().filter(u => u.def.build);
  if (!us.length) return;
  const why = buildReq(UI.g, UI.me, role);
  if (why) { toast(L(why), 'warn'); SND.play('err'); return; }
  UI.mode = 'place';
  const u = us[0], a = u.ang, d = BLDG[UI.P.faction][role];
  UI.place = { role, x: u.x + dcos(a) * (d.r + u.def.r + 30), y: u.y + dsin(a) * (d.r + u.def.r + 30), ok: false, u: ids(us) };
  checkPlace();
  showInfo(L('Platz antippen oder ziehen, dann »Bauen« bestätigen'), 4000);
  hudCmds();
}
function movePlace(sx, sy) { const w = R.s2w(sx, sy); UI.place.x = w.x; UI.place.y = w.y; checkPlace(); }
function checkPlace() { const p = UI.place; if (!p) return; p.why = canPlace(UI.g, UI.me, p.role, p.x, p.y); p.ok = !p.why; const c = BLDG[UI.P.faction][p.role].lv[0].cost; if (p.ok && !canPay(UI.P, c)) { p.ok = false; p.why = 'Nicht genug Rohstoffe'; } hudCmds(); }
function confirmPlace() {
  const p = UI.place; if (!p) return;
  checkPlace();
  if (!p.ok) { toast(L(p.why), 'warn'); SND.play('err'); return; }
  const r = issue({ t: 'build', u: p.u, role: p.role, x: p.x, y: p.y });
  if (r) { toast(L(r), 'warn'); SND.play('err'); return; }
  SND.play('place'); endMode(); hudCmds();
}

/* ------------------------------------------------------------------ Eingabe */
const PT = new Map();
let gest = null;
function evPos(e) { const r = UI.rect || (UI.rect = $('view').getBoundingClientRect()); return [e.clientX - r.left, e.clientY - r.top]; }
function ptDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function inputReset() { if (gest) clearTimeout(gest.tm); PT.clear(); gest = null; UI.box = null; }
function pinchApply() {
  if (!gest || gest.k !== 'pinch' || !gest.dirty || PT.size < 2) return;
  gest.dirty = false;
  const [a, b] = [...PT.values()], d = ptDist(a, b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  R.cam.x -= (mx - gest.mx) / R.cam.z; R.cam.y -= (my - gest.my) / R.cam.z;
  let ratio = gest.d0 > 20 ? d / gest.d0 : 1;
  ratio = ratio > 1.06 ? ratio / 1.06 : ratio < 0.94 ? ratio / 0.94 : 1;
  R.zoomAt(mx, my, gest.z0 * ratio / R.cam.z);
  gest.mx = mx; gest.my = my;
}
function hoverAt(sx, sy) {
  const g = UI.g;
  if (!g || UI.attract) { R.hover = 0; return; }
  const w = R.s2w(sx, sy), hit = pickAt(w.x, w.y);
  R.hover = hit && (hit.k === 1 || hit.k === 2) ? hit.id : 0;
  const v = $('view');
  v.style.cursor = UI.mode === 'place' ? 'crosshair' : UI.mode === 'amove' || UI.mode === 'rally' ? 'crosshair' : hit && hit.owner === UI.me ? 'pointer' : 'default';
}
function initInput() {
  const cv = $('view');
  window.addEventListener('pointerdown', e => { UI.mouse = e.pointerType === 'mouse'; }, true);
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { UI.mouse = true; UI.cx = e.clientX; UI.cy = e.clientY; } }, { passive: true });
  cv.addEventListener('pointerdown', e => {
    if (!UI.g || UI.attract || UI.paused || UI.endShown) return;
    e.preventDefault();
    SND.init(); tipHide();
    const [x, y] = evPos(e), mouse = e.pointerType === 'mouse';
    if (mouse && (PT.size || e.button > 2)) return;
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ohne Capture weiter */ }
    PT.set(e.pointerId, { x, y, sx: x, sy: y, type: e.pointerType });
    if (mouse) {
      UI.hx = x; UI.hy = y;
      if (e.button === 2) gest = { k: 'rpan', moved: false, ctrl: e.ctrlKey || e.metaKey };
      else if (e.button === 1) gest = { k: 'pan', moved: false };
      else if (UI.mode === 'place') { gest = { k: 'mplace' }; movePlace(x, y); }
      else if (UI.mode !== 'normal') gest = { k: 'mmode' };
      else gest = { k: 'lpend', shift: e.shiftKey };
      return;
    }
    if (PT.size === 1) {
      if (UI.mode === 'place') { gest = { k: 'ghost', moved: false }; movePlace(x, y); }
      else {
        gest = { k: 'pend', moved: false };
        /* Finger still halten: Angriffsmarsch dorthin (mit bewaffneter Auswahl), sonst Zielinfo */
        const gq = gest;
        gq.tm = setTimeout(() => { if (gest !== gq || gq.moved || PT.size !== 1) return; gq.held = true; const us = selShips().filter(u => armed(u)); const w = R.s2w(x, y); const hit = pickAt(w.x, w.y); if (us.length && UI.mode === 'normal' && (!hit || hit.k === 3)) { orderMove(us, w.x, w.y, true); buzz(18); } else if (hit && UI.mode === 'normal') { gq.tip = true; tipShow(objTip(hit)); buzz(10); setTimeout(tipHide, 3800); } }, 480);
      }
    } else if (PT.size === 2) {
      const [a, b] = [...PT.values()];
      if (gest && gest.tm) clearTimeout(gest.tm);
      gest = { k: 'pinch', d0: ptDist(a, b), z0: R.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      UI.box = null;
    }
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = evPos(e), p = PT.get(e.pointerId), mouse = e.pointerType === 'mouse';
    if (mouse) { UI.hx = x; UI.hy = y; }
    if (!p) { if (mouse && !UI.attract && UI.g) { if (UI.mode === 'place') movePlace(x, y); if (performance.now() - UI.hovT > 60) { UI.hovT = performance.now(); hoverAt(x, y); } } return; }
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    if (!gest) return;
    if (gest.k === 'pinch') { gest.dirty = true; return; }
    const far = Math.hypot(x - p.sx, y - p.sy) > (p.type === 'mouse' ? 5 : 11);
    switch (gest.k) {
      case 'pend':
        if (far && !gest.held) { gest.moved = true; clearTimeout(gest.tm); if (UI.boxMode) { gest.k = 'box'; UI.box = { x0: p.sx, y0: p.sy, x1: x, y1: y }; } else gest.k = 'pan'; }
        break;
      case 'lpend': if (far) { UI.box = { x0: p.sx, y0: p.sy, x1: x, y1: y, add: gest.shift }; gest = { k: 'box' }; } break;
      case 'box': UI.box.x1 = x; UI.box.y1 = y; break;
      case 'rpan': if (!gest.moved) { if (!far) break; gest.moved = true; }
      // fällt durch
      case 'pan': R.cam.x -= dx / R.cam.z; R.cam.y -= dy / R.cam.z; UI.camTravel += Math.hypot(dx, dy); R.clampCam(); break;
      case 'ghost': gest.moved = true; movePlace(x, y); break;
      case 'mplace': movePlace(x, y); break;
    }
  });
  const up = e => {
    const p = PT.get(e.pointerId);
    if (!p) return;
    pinchApply();
    PT.delete(e.pointerId);
    if (!gest) return;
    if (gest.k === 'pinch') { gest = PT.size === 0 ? null : { k: 'done' }; return; }
    if (gest.k === 'done') { gest = PT.size === 0 ? null : { k: 'done' }; return; }
    const k = gest.k, moved = gest.moved, held = gest.held, ctrl = gest.ctrl;
    clearTimeout(gest.tm);
    gest = null;
    if (e.type === 'pointercancel') { UI.box = null; return; }
    switch (k) {
      case 'pend': if (!held) tap(p.x, p.y); break;
      case 'lpend': tap(p.x, p.y); break;
      case 'rpan': if (!moved) { const us = selShips(); if (UI.mode === 'place') { endMode(); hudCmds(); break; } if (UI.mode !== 'normal') { endMode(); break; } if (us.length) { const w = R.s2w(p.x, p.y), hit = pickAt(w.x, w.y); if (ctrl) orderMove(us, w.x, w.y, true); else order(us, hit, w.x, w.y); } } break;
      case 'box': finishBox(UI.box && UI.box.add); break;
      case 'ghost': if (!moved) movePlace(p.x, p.y); break;
      case 'mplace': movePlace(p.x, p.y); confirmPlace(); break;
      case 'mmode': tap(p.x, p.y); break;
    }
    if (p.type === 'mouse') hoverAt(p.x, p.y);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    if (!UI.g || UI.attract || UI.paused) return;
    e.preventDefault();
    const [x, y] = evPos(e);
    if (e.ctrlKey) R.zoomAt(x, y, Math.exp(-clamp(e.deltaY, -60, 60) * 0.01));
    else R.zoomAt(x, y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('lostpointercapture', e => { if (PT.has(e.pointerId)) { PT.delete(e.pointerId); if (!PT.size) { gest = null; UI.box = null; } } });
  window.addEventListener('blur', inputReset);
  $('app').addEventListener('contextmenu', e => { if (UI.g && !UI.attract && !(e.target.closest && e.target.closest('textarea,input'))) e.preventDefault(); });
  /* Minikarte: tippen springt, ziehen verschiebt; Rechtsklick schickt die Auswahl */
  const mini = $('mini');
  const miniPos = e => { const r = mini.getBoundingClientRect(), w = R.miniToWorld(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)); return [w.x, w.y]; };
  const jump = e => { if (!UI.g || UI.attract) return; const [x, y] = miniPos(e); R.center(x, y); };
  mini.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button === 2) { const us = selShips(); if (us.length) { const [x, y] = miniPos(e); orderMove(us, x, y, e.ctrlKey); } return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { mini.setPointerCapture(e.pointerId); } catch (er) { /* egal */ } mini._d = true; jump(e);
  });
  mini.addEventListener('pointermove', e => { if (mini._d) jump(e); });
  mini.addEventListener('pointerup', () => { mini._d = false; });
  mini.addEventListener('pointercancel', () => { mini._d = false; });
  mini.addEventListener('contextmenu', e => e.preventDefault());
  /* Tastatur */
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', e => {
    UI.keys[e.code] = true;
    if (!UI.g || UI.attract) return;
    const tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    const k = (e.key || '').toLowerCase(), code = e.code || '', mod = e.ctrlKey || e.metaKey || e.altKey;
    if (MOVE_KEYS.has(code) && !mod) { if (code.startsWith('Arrow')) e.preventDefault(); }
    const dig = /^(?:Digit|Numpad)([1-5])$/.exec(code);
    if (k === 'escape') { if (!$('settings').hidden) closeSettings(); else if (!$('help').hidden) $('help').hidden = true; else if (UI.mode !== 'normal') { endMode(); hudCmds(); } else if (UI.sel.size || UI.selB) desel(); else setPaused(!UI.paused); }
    else if (k === 'p' && !mod) setPaused(!UI.paused);
    else if (UI.paused || UI.endShown) return;
    else if (dig) { const i = +dig[1]; if (e.ctrlKey || e.shiftKey || e.metaKey) grpAssign(i); else grpSelect(i); e.preventDefault(); }
    else if (k === ' ') { jumpAlert(); e.preventDefault(); }
    else if (code === 'Home' || code === 'Backspace') { const b = anyBldg(UI.g, UI.me); if (b) R.center(b.x, b.y); e.preventDefault(); }
    else if (code === 'NumpadAdd' || k === '+') R.zoomAt(R.cssW / 2, R.cssH / 2, 1.15);
    else if (code === 'NumpadSubtract' || k === '-') R.zoomAt(R.cssW / 2, R.cssH / 2, 1 / 1.15);
    else if (k === 'a' && (e.ctrlKey || e.metaKey)) { const all = UI.g.ships.filter(u => u.owner === UI.me && !u.dead && armed(u)); if (all.length) setSel(all); e.preventDefault(); }
    else if (mod) return;
    else if (k === 'h') doStop();
    else if (k === 'g') toggleHold();
    else if (k === 'v') cycleStance();
    else if (k === 'c') cycleForm();
    else if (k === 'a') startAmove();
    else if (k === 'b') { const u = selShips().find(x => x.def.build); if (u) setSel([u]); }
    else if (k === 'r') toggleRange();
    else if (k === 'x') doExplore();
  });
  window.addEventListener('keyup', e => { UI.keys[e.code] = false; });
  window.addEventListener('blur', () => { UI.keys = {}; });
}
function jumpAlert() { const g = UI.g; if (UI.alertPos && g.time - UI.alertT < 30) { R.center(UI.alertPos.x, UI.alertPos.y); return; } const b = anyBldg(g, UI.me); if (b) R.center(b.x, b.y); }

/* ------------------------------------------------------------------ Befehlstasten */
function canExplore(u) { return u.def.role !== 'builder' && u.def.role !== 'tanker' && !u.def.node && u.def.role !== 'fighter'; }
function doExplore() { const us = selShips().filter(canExplore); if (us.length) { const r = issue({ t: 'explore', u: ids(us) }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('order'); hudSel(); } } }
function doStop() { const us = selShips(); if (us.length) { issue({ t: 'stop', u: ids(us) }); SND.play('order'); } }
function toggleHold() { const us = selShips(); if (!us.length) return; const on = !us.every(u => u.hold); issue({ t: 'hold', u: ids(us), on }); toast(L(on ? 'Stellung halten: Die Auswahl bleibt stehen' : 'Stellung aufgehoben')); SND.play('order'); hudCmds(); }
const STANCES = ['Offensiv', 'Defensiv', 'Feuer halten', 'Vorsichtig'], STANCE_HINT = ['Schießt auf jeden Feind in Sicht und verfolgt ihn', 'Schießt nur in Reichweite, verfolgt nicht', 'Schießt nicht', 'Kämpft wie Offensiv, fliegt unter 30 % Hülle zur Werft und kehrt repariert zurück'];
function cycleStance() { const us = selShips(); if (!us.length) return; const v = ((us[0].stance | 0) + 1) % 4; issue({ t: 'stance', u: ids(us), v }); toast(L(STANCES[v]) + ': ' + L(STANCE_HINT[v])); SND.play('click'); hudCmds(); }
function cycleForm() { UI.form = UI.form === 'wedge' ? 'line' : 'wedge'; toast(L(UI.form === 'wedge' ? 'Formation: Keil' : 'Formation: Linie')); SND.play('click'); hudCmds(); }
function startAmove() { const us = selShips().filter(u => armed(u)); if (!us.length) { toast(L('Erst Kampfschiffe wählen')); return; } UI.mode = 'amove'; showInfo(L('Angriffsmarsch: Ziel antippen'), 3000); hudCmds(); }
function toggleRange() { UI.showRange = !UI.showRange; $('bRange').classList.toggle('on', UI.showRange); SND.play('click'); }
function toggleBox() { UI.boxMode = !UI.boxMode; if (UI.boxMode) showInfo(L('Auswahl: Rahmen über Schiffe ziehen'), 2500); hudCmds(); SND.play('click'); }
/* Fähigkeiten der Auswahl: je Kennung einmal, bereit wenn mindestens ein Schiff sie zünden kann */
function selAbils(us) {
  const g = UI.g, m = new Map();
  const cnt = {}; for (const u of us) if (u.def.merge) cnt[u.type] = (cnt[u.type] || 0) + 1;
  if (Object.values(cnt).some(n => n >= 3)) m.set('merge', { id: 'merge', ready: true, cd: 0 });
  for (const u of us) { if (u.derelict) continue; for (const id of shipAbils(g, u)) { const e = m.get(id) || { id, ready: false, cd: 1e9 }; const cd = u.abcd[id] > 0 ? u.abcd[id] : 0; if (!cd) e.ready = true; e.cd = Math.min(e.cd, cd); m.set(id, e); } }
  return [...m.values()];
}
function useAbility(id) {
  const us = selShips();
  if (!us.length) return;
  if (id === 'board') { if (UI.mode === 'board') { endMode(); hudCmds(); return; } UI.mode = 'board'; showInfo(L('Entern: Ziel antippen'), 3000); hudCmds(); SND.play('click'); return; }
  if (id === 'bind') { if (UI.mode === 'abt') { endMode(); hudCmds(); return; } UI.mode = 'abt'; UI.abId = id; showInfo(L('Übernahme: angeschlagenes feindliches Schiff antippen'), 3000); hudCmds(); SND.play('click'); return; }
  if (id === 'merge') { const r = issue({ t: 'merge', u: ids(us) }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('upgrade'); hudSel(); } return; }
  const r = issue({ t: 'ab', u: ids(us), id });
  if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('order'); hudCmds(true); }
}
function toggleAuto() { const us = selShips(); if (!us.length) return; const on = !us.every(u => u.auto); issue({ t: 'auto', u: ids(us), on }); toast(L(on ? 'Auto: Fähigkeiten werden selbst eingesetzt' : 'Auto aus: Fähigkeiten nur auf Befehl')); SND.play('click'); hudCmds(); }
function cycleSub() {
  const list = [''].concat(SUBS), i = (list.indexOf(UI.subAim) + 1) % list.length;
  UI.subAim = list[i];
  toast(UI.subAim ? L('Ziel: {0}', L(SUB_NAMES[UI.subAim])) + ' · ' + L(SUB_HINT[UI.subAim]) : L('Ziel: Hülle'));
  /* laufende Angriffe sofort umstellen */
  const us = selShips().filter(u => u.o.t === 'attack' && u.o.tid);
  const by = new Map(); for (const u of us) { const t = UI.g.byId.get(u.o.tid); if (t && t.k === 1) by.set(t.id, (by.get(t.id) || []).concat(u.id)); }
  for (const [e, u] of by) issue({ t: 'attack', u, e, sub: UI.subAim || undefined });
  SND.play('click'); hudCmds();
}
const SUB_HINT = { drive: 'Das Ziel wird langsam und kann nicht fliehen', wpn: 'Das Ziel lädt dreimal so langsam nach', shield: 'Schilde laden nicht mehr (Mars: Panzerung wirkt schwächer)', sensor: 'Das Ziel sieht kaum noch etwas', life: 'Die Crew schwindet, das Schiff wird zum Wrack' };
function startSuper() {
  const b = UI.selB ? UI.g.byId.get(UI.selB) : null;
  if (!b || b.role !== 'super') return;
  if (b.charge < 1) { toast(L('Lädt: {0} %', Math.round(b.charge * 100)), 'warn'); SND.play('err'); return; }
  UI.mode = 'super'; UI.superTgt = null;
  showInfo(L('{0}: Zielpunkt antippen, dann »Feuern«', L(BLDG[UI.P.faction].super.name)), 4000);
  hudCmds(); SND.play('click');
}
function confirmSuper() {
  const t = UI.superTgt;
  if (!t) { toast(L('Erst einen Zielpunkt antippen'), 'warn'); SND.play('err'); return; }
  const r = issue({ t: 'super', x: t.x, y: t.y });
  if (r) { toast(L(r), 'warn'); SND.play('err'); return; }
  SND.play('super'); endMode(); hudCmds();
}
/* ------------------------------------------------------------------ Doktrin */
function openDoctrine() {
  const P = UI.P, g = UI.g;
  if (!P || P.doctrine) return;
  const foes = g.players.filter(q => q.alive && !q.neutral && q.team !== P.team), foeF = foes.map(q => q.faction);
  $('docIntro').textContent = L('Einmalige Wahl für die ganze Partie. Jede Doktrin bringt dauerhafte Boni, ein exklusives Schiff und die vierte Fähigkeit deines Flaggschiffs.') + (foes.length ? ' ' + L('Gegner: {0}.', foes.map(q => L(q.F.name)).join(', ')) : '');
  const box = $('docCards'); box.textContent = '';
  UI.docPick = null; $('docConfirm').hidden = true;
  for (const d of DOCTRINES[P.faction]) {
    const el = document.createElement('div'); el.className = 'dcard';
    const rec = d.rec && foeF.indexOf(d.rec) >= 0;
    const fname = f => L(FACTIONS[f].name);
    el.innerHTML = (rec ? '<span class="rec">' + L('Empfohlen') + '</span>' : '') + '<h4><span>' + esc(L(d.name)) + '</span><small>' + esc(L(d.tag)) + '</small></h4><div class="style">' + esc(qt(L(d.style))) + '</div><p>' + esc(L(d.desc)) + '</p><ul>' + d.gives.map(x => '<li>' + esc(L(x)) + '</li>').join('') + '</ul>' +
      '<div class="vs"><b>' + L('Stark') + '</b><span>' + (d.strong.length ? d.strong.map(fname).join(', ') + ' – ' : '') + esc(L(d.strongWhy)) + '</span><b class="w">' + L('Schwach') + '</b><span>' + (d.weak.length ? d.weak.map(fname).join(', ') + ' – ' : '') + esc(L(d.weakWhy)) + '</span></div><div class="fit">' + L('Passt zu') + ': ' + esc(L(d.fit)) + '</div>';
    el.addEventListener('click', () => { UI.docPick = d.id; box.querySelectorAll('.dcard').forEach(x => x.classList.toggle('on', x === el)); const c = $('docConfirm'); c.hidden = false; c.textContent = L('{0} festlegen', L(d.name)); SND.play('click'); });
    box.appendChild(el);
  }
  $('doctrine').hidden = false; UI.slow = UI.kind !== 'mp';
}
/* Archiv: eine von drei Erbauer-Technologien, über denselben Kartendialog */
function openEtech() {
  const P = UI.P;
  if (!P || !P.etechAsk) return;
  $('docIntro').textContent = L('Das Archiv gewährt eine Erbauer-Technologie, nur für diese Partie.');
  document.querySelector('#doctrine h2').textContent = L('Erbauer-Technologie wählen');
  const box = $('docCards'); box.textContent = '';
  UI.docPick = null; $('docConfirm').hidden = true; UI.etechMode = true;
  for (const id of P.etechAsk) {
    const d = ETECH[id], el = document.createElement('div'); el.className = 'dcard';
    el.innerHTML = '<h4><span>' + esc(L(d.name)) + '</span><small>' + L('Erbauer') + '</small></h4><p>' + esc(L(d.desc)) + '</p>';
    el.addEventListener('click', () => { UI.docPick = id; box.querySelectorAll('.dcard').forEach(x => x.classList.toggle('on', x === el)); const c = $('docConfirm'); c.hidden = false; c.textContent = L('{0} wählen', L(d.name)); SND.play('click'); });
    box.appendChild(el);
  }
  $('docLater').hidden = true;
  $('doctrine').hidden = false; UI.slow = UI.kind !== 'mp';
}
function closeDoctrine() {
  $('docLater').hidden = false; document.querySelector('#doctrine h2').textContent = L('Doktrin wählen');
  if (UI.etechMode) { UI.etechMode = false; } UI.rewardMode = false; $('doctrine').hidden = true; UI.slow = false; UI.docPick = null; hudCmds(true); }
function confirmDoctrine() {
  if (!UI.docPick) return;
  const r = issue(UI.rewardMode ? { t: 'reward', id: UI.docPick } : UI.etechMode ? { t: 'etech', id: UI.docPick } : { t: 'doctrine', id: UI.docPick });
  if (r) { toast(L(r), 'warn'); SND.play('err'); return; }
  SND.play('upgrade'); closeDoctrine();
}
function cmdBtn(txt, sub, fn, tip, cls) {
  const b = document.createElement('button');
  /* sub: deutscher Name der Taste (Schlüssel für die Ausbildung), angezeigt wird die Übersetzung */
  b.className = 'key ' + (cls || ''); b.innerHTML = esc(txt) + (sub ? '<small>' + esc(L(sub)) + '</small>' : '');
  if (sub) b.dataset.k = 'cmd:' + sub;
  bindHold(b, fn, tip ? () => '<h4>' + esc(txt) + '</h4><p>' + esc(L(tip)) + '</p>' : null);
  return b;
}
function hudCmds(force) {
  const box = $('cmds');
  if (!UI.g || UI.attract) { box.textContent = ''; box._sig = ''; return; }
  const us = selShips(), b = UI.selB ? UI.g.byId.get(UI.selB) : null;
  /* nur neu aufbauen, wenn sich etwas ändert: Ein laufender Fingerdruck soll seine Taste behalten */
  const abs = selAbils(us), so = UI.selS ? UI.g.byId.get(UI.selS) : null;
  const sig = [UI.mode, so ? so.id + ':' + so.owner + ':' + (so.mode || '') + ':' + (so.state || '') : '', UI.boxMode, UI.form, us.length, us.length ? us[0].stance : '', us.every(u => u.hold), us.some(u => armed(u)), b ? b.id + ':' + b.lv + ':' + (b.upg ? 1 : 0) + ':' + b.done + ':' + (b.done && b.lv < 3 && canPay(UI.P, b.def.lv[b.lv].cost)) + ':' + (b.role === 'super' ? (b.charge >= 1 ? 1 : 0) : '') + ':' + (b.role === 'base' && UI.P.docAsk && !UI.P.doctrine ? 1 : 0) : '', UI.place ? UI.place.ok : '', UI.subAim, abs.map(a => a.id + (a.ready ? 1 : 0) + Math.round(a.cd * 2)).join(','), us.length ? us.every(u => u.auto) : '', UI.superTgt ? 1 : 0, refitSig(us)].join('|');
  if (!force && box._sig === sig) return;
  box._sig = sig;
  box.textContent = '';
  if (UI.mode === 'place') {
    const p = UI.place;
    box.appendChild(cmdBtn('✓', 'Bauen', confirmPlace, 'Station hier errichten', p && p.ok ? 'arm' : 'off'));
    box.appendChild(cmdBtn('✕', 'Abbruch', () => { endMode(); hudCmds(); }, 'Bauen abbrechen', 'warn'));
    if (p && !p.ok && p.why) showInfo(L(p.why), 1200);
    return;
  }
  box.appendChild(cmdBtn(UI.boxMode ? '▣' : '▢', 'Auswahl', toggleBox, 'Rahmen ziehen statt Karte verschieben', UI.boxMode ? 'on' : ''));
  if (so && so.k === 5 && so.owner === UI.me && so.state === 'active') {
    for (const [m, ic, nm, tip] of [['bridge', '⇄', 'Brücke', 'Brücke: jeder kann durch das Tor zum Partnertor springen'], ['lock', '⛨', 'Sperre', 'Sperre: nur deine Schiffe und Verbündete springen'], ['lance', '☄', 'Lanze', 'Lanze: lädt zwei Minuten, dann trifft ein Energiestoß alles am Partnertor. Nach dreimal überlastet das Tor (Torsturm).']])
      box.appendChild(cmdBtn(ic, nm, () => { const r = issue({ t: 'gate', id: so.id, mode: m }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudSel(); } }, tip, so.mode === m ? 'on' : ''));
    return;
  }
  /* Fassung 22: Untermenü Nachrüsten */
  if (us.length && UI.mode === 'refit') { refitBtns(box, us, true); return; }
  if (us.length) {
    const war = us.some(u => armed(u));
    if (war) box.appendChild(cmdBtn('➶', 'Vorstoß', startAmove, 'Angriffsmarsch: fliegt zum Ziel und greift alles auf dem Weg an', UI.mode === 'amove' ? 'on' : ''));
    box.appendChild(cmdBtn('■', 'Halt', doStop, 'Anhalten und Befehl aufheben'));
    if (us.some(canExplore)) box.appendChild(cmdBtn('◎', 'Erkunden', doExplore, 'Erkunden: fliegt selbständig unerkundete Gebiete ab, mehrere Erkunder teilen sich die Karte auf; bei schwerem Schaden zurück zur Basis', us.every(u => !canExplore(u) || u.o.t === 'explore') ? 'on' : ''));
    box.appendChild(cmdBtn('⌂', 'Stellung', toggleHold, 'Stellung halten: bleibt stehen, schießt nur in Reichweite', us.every(u => u.hold) ? 'on' : ''));
    if (war) box.appendChild(cmdBtn(['⚔', '🛡', '✋', '↩'][us[0].stance | 0], STANCES[us[0].stance | 0], cycleStance, 'Haltung wechseln: Offensiv, Defensiv, Feuer halten, Vorsichtig (Rückzug zur Reparatur)'));
    if (us.length > 1) box.appendChild(cmdBtn(UI.form === 'wedge' ? '⋀' : '≡', UI.form === 'wedge' ? 'Keil' : 'Linie', cycleForm, 'Formation für Bewegungsbefehle'));
    if (war) box.appendChild(cmdBtn(UI.subAim ? SUB_ICON[UI.subAim] : '◌', UI.subAim ? SUB_NAMES[UI.subAim] : 'Ziel', cycleSub, 'Subsystem anvisieren: Der nächste Angriffsbefehl beschießt gezielt Antrieb, Waffen, Schilde, Sensoren oder Lebenserhaltung des Ziels. Hüllenschaden sinkt dabei.', 'sub' + (UI.subAim ? ' on' : '')));
    for (const a of abs) {
      const A = ABIL[a.id], cdw = a.cd > 0 ? Math.round((1 - a.cd / A.cd) * 100) : 100;
      const el = cmdBtn(A.icon, A.name, () => useAbility(a.id), null, 'ab' + (a.ready ? '' : ' cd') + ((UI.mode === 'board' && a.id === 'board') || (UI.mode === 'abt' && a.id === UI.abId) ? ' on' : ''));
      el.innerHTML = '<span class="big">' + A.icon + '</span><small>' + esc(L(A.short || A.name)) + '</small><i class="cdb" style="width:' + cdw + '%"></i>';
      bindHold(el, () => useAbility(a.id), () => '<h4>' + A.icon + ' ' + esc(L(A.name)) + '</h4><div class="cost">' + (A.mut ? costTxt({ ice: Math.max(0, shipCost(UI.P, SHIPS[A.mut]).ice - shipCost(UI.P, us[0].def).ice), ore: 0 }) + ' · ' + L('Kokon') + ' ' + Math.round(A.dur * UI.P.tfx.mutT) + ' s' : L('Abklingzeit') + ' ' + A.cd + ' s' + (A.dur ? ' · ' + L('Dauer') + ' ' + A.dur + ' s' : '') + (A.r ? ' · ' + L('Umkreis') + ' ' + A.r : '')) + '</div><p>' + esc(L(A.desc)) + '</p>' + (A.mut ? shipTip(SHIPS[A.mut]) : '') + (a.ready ? '' : '<p class="req">' + L('Bereit in {0} s', Math.ceil(a.cd)) + '</p>'));
      box.appendChild(el);
    }
    if (abs.length) box.appendChild(cmdBtn('A', 'Auto', toggleAuto, 'Auto: Das Schiff setzt seine Fähigkeiten selbst ein, wenn es sich lohnt', us.every(u => u.auto) ? 'on' : ''));
    refitBtns(box, us);
  } else if (b && b.owner === UI.me) {
    if (b.role === 'super' && b.done) {
      if (UI.mode === 'super') {
        box.appendChild(cmdBtn('✓', 'Feuern', confirmSuper, b.def.role === 'super' && UI.P.faction === 'alliance' ? 'Alle Schiffe am Tor zum markierten Punkt versetzen' : 'Masse auf den markierten Punkt abfeuern', UI.superTgt ? 'arm' : 'off'));
        box.appendChild(cmdBtn('✕', 'Abbruch', () => { endMode(); hudCmds(); }, 'Zielwahl abbrechen', 'warn'));
      } else box.appendChild(cmdBtn('☄', b.def.name, startSuper, () => '<h4>' + esc(L(b.def.name)) + '</h4><p>' + esc(L(b.def.desc)) + '</p><p class="req">' + (b.charge >= 1 ? L('Bereit. Tippen, dann Ziel auf der Karte wählen.') : L('Lädt: {0} %', Math.round(b.charge * 100))) + '</p>', b.charge >= 1 ? 'arm' : 'off'));
    }
    if (b.role === 'base' && b.done && UI.P.docAsk && !UI.P.doctrine) box.appendChild(cmdBtn('✦', 'Doktrin', openDoctrine, 'Doktrin wählen: dauerhafte Boni, ein Schiff und eine Flaggschiff-Fähigkeit', 'arm'));
    if (b.role === 'base' && b.done && UI.P.etechAsk) box.appendChild(cmdBtn('◈', 'Archiv', openEtech, 'Erbauer-Technologie aus dem Archiv wählen', 'arm'));
    if (b.done && b.lv < 3) { const nx = b.def.lv[b.lv]; box.appendChild(cmdBtn('▲', 'Ausbau ' + ROMAN[b.lv + 1], () => { const r = issue({ t: 'upgrade', b: b.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudSel(); } }, () => '<h4>' + L('Ausbau auf Stufe') + ' ' + ROMAN[b.lv + 1] + '</h4><div class="cost">' + costTxt(nx.cost) + ' · ' + nx.time + ' s</div><p>' + esc(upgradeText(b)) + '</p>', b.upg ? 'off' : canPay(UI.P, nx.cost) ? 'arm' : '')); }
    if (b.role === 'yard' && b.done) box.appendChild(cmdBtn('⚑', 'Sammeln', () => { UI.mode = 'rally'; showInfo(L('Sammelpunkt: Ziel antippen'), 3000); hudCmds(); }, 'Neue Schiffe fliegen zum Sammelpunkt', UI.mode === 'rally' ? 'on' : ''));
    if (b.role !== 'base' && b.role !== 'seal') box.appendChild(cmdBtn('€', 'Verkauf', () => { if (UI.askSell === b.id) { issue({ t: 'sell', b: b.id }); UI.askSell = 0; desel(); } else { UI.askSell = b.id; toast(L('Noch einmal tippen verkauft die Station (halber Preis)'), 'warn'); } }, 'Station abreißen und die Hälfte der Kosten zurückbekommen', 'warn'));
  }
}
/* Was die nächste Stufe bringt, in einem Satz */
function upgradeText(b) {
  const a = b.def.lv[b.lv - 1], n = b.def.lv[b.lv], out = [];
  const sg = v => (v > 0 ? '+' : '') + v;
  if (n.hull !== a.hull) out.push(L('Hülle {0} → {1}', a.hull, n.hull));
  if (n.shield !== a.shield && n.shield) out.push(L('Schild {0} → {1}', a.shield, n.shield));
  if (n.armor !== a.armor && n.armor) out.push(L('Panzerung {0} → {1}', a.armor, n.armor));
  if ((n.energy || 0) !== (a.energy || 0)) out.push(L('Energie {0} → {1}', sg(a.energy), sg(n.energy)));
  if (n.cp !== a.cp) out.push(L('Kommando +{0}', n.cp - a.cp));
  if (n.docks !== a.docks) out.push(L('Andockplätze {0}', n.docks) + (n.bonus > 1 ? ', ' + L('Aufschlag {0} %', Math.round((n.bonus - 1) * 100)) : ''));
  if (n.rate !== a.rate) out.push(L('Baugeschwindigkeit ×{0}', n.rate) + ', ' + L(b.lv + 1 === 2 ? 'Kreuzer möglich' : 'Großschiffe möglich'));
  if (n.wpn.length !== a.wpn.length) out.push(L('{0} Waffen', n.wpn.length) + (n.wpn.some(w => w.kind === 'pd') && !a.wpn.some(w => w.kind === 'pd') ? ', ' + L('Punktverteidigung') : '') + (n.wpn.some(w => w.kind === 'rail') && !a.wpn.some(w => w.kind === 'rail') ? ', Railgun' : ''));
  if (n.aura !== a.aura) out.push(L('Umkreis {0}, Schild {1}', n.aura, n.give));
  if (b.role === 'lab') out.push(L(b.lv + 1 === 2 ? 'Schaltet Großschiffe frei' : 'Höchste Technikstufe'));
  if (b.role === 'base') out.push(L(b.lv + 1 === 2 ? 'Bewaffnet, Andockarme' : 'Schwere Bewaffnung, Abwehr, Leuchtkranz'));
  return out.join(' · ');
}

/* ------------------------------------------------------------------ Baumenü und Auswahlkarte */
function itemBtn(name, c, fn, tipFn, extra) {
  const b = document.createElement('button');
  b.className = 'key item';
  b.innerHTML = '<span class="nm">' + esc(name) + '</span><span class="cost">' + (c ? (UI.P && UI.P.F.bio ? '<b>' + (c.ice + c.ore) + '</b> ' + L('Biomasse') : '<b>' + c.ice + '</b> ' + L('Eis') + ' <b>' + c.ore + '</b> ' + L('Erz')) : '') + '</span>' + (extra || '');
  bindHold(b, fn, tipFn);
  return b;
}
function reqTxt(def) { const r = []; if (def.yard > 1) r.push(L('Werft') + ' ' + ROMAN[def.yard]); if (def.tier > 1) r.push(L('Labor') + ' ' + ROMAN[def.tier - 1]); return r.join(', '); }
function wpnTxt(def) {
  const out = [];
  for (const w of def.wpn) { const k = w.kind === 'beam' ? 'Strahl' : w.kind === 'kin' ? 'Kanone' : w.kind === 'rail' ? 'Railgun' : w.kind === 'torp' ? 'Torpedo' : 'Abwehr'; out.push(L(k) + ' ' + w.range); }
  return out.join(' · ');
}
function shipTip(def) {
  return '<h4>' + esc(L(def.name)) + '</h4><div class="cost">' + costTxt(shipCost(UI.P, def)) + ' · ' + def.time + ' s · ' + def.cp + ' ★</div><p>' + esc(L(def.desc)) + '</p><p class="fine">' + L('Hülle') + ' ' + def.hull + (def.shield ? ' · ' + L('Schild') + ' ' + def.shield : '') + (def.armor ? ' · ' + L('Panzerung') + ' ' + def.armor : '') + ' · ' + L('Tempo') + ' ' + def.speed + (def.wpn.length ? '<br>' + wpnTxt(def) : '') + (counterTxt(def) ? '<br>' + counterTxt(def) : '') + '</p>' + (reqTxt(def) ? '<p class="req">' + L('Benötigt') + ' ' + reqTxt(def) + '</p>' : '');
}
/* Erklärung zu einem Objekt auf der Karte (langes Antippen): Name, Besitzer, Stufe, Funktion, Zustand */
function objTip(o) {
  const g = UI.g, who = o.owner >= 0 && g.players[o.owner] ? (o.owner === UI.me ? L('Du') : pname(o.owner) + (isFoe(o.owner) ? ' · ' + L('Feind') : ' · ' + L('Verbündet'))) : '';
  const col = o.owner >= 0 && g.players[o.owner] ? pcolor(g.players[o.owner]) : '#9ff0c0', hp = e => L('Hülle') + ' ' + Math.round(e.hull) + ' / ' + Math.round(e.hullMax) + (e.shieldMax ? ' · ' + L('Schild') + ' ' + Math.round(e.shield) + ' / ' + Math.round(e.shieldMax) : '');
  if (o.k === 2) { const lv = o.def.lv[o.lv - 1]; return '<h4 style="color:' + col + '">' + esc(L(o.def.name)) + ' · ' + L('Stufe {0}', ROMAN[o.lv]) + '</h4><div class="cost">' + esc(who) + '</div><p>' + esc(L(o.def.desc)) + '</p><p class="fine">' + (o.done ? hp(o) : L('Im Bau') + ' ' + Math.round(o.prog * 100) + ' %') + (lv.energy ? ' · ' + L('Energie') + ' ' + (lv.energy > 0 ? '+' : '') + lv.energy : '') + (lv.wpn.length ? ' · ' + lv.wpn.length + ' ' + L(lv.wpn.length > 1 ? 'Waffen' : 'Waffe') : '') + '</p>'; }
  if (o.k === 1) return '<h4 style="color:' + col + '">' + esc(L(o.def.name)) + '</h4><div class="cost">' + esc(who) + '</div><p>' + esc(L(o.def.desc)) + '</p><p class="fine">' + hp(o) + (counterTxt(o.def) ? '<br>' + counterTxt(o.def) : '') + '</p>';
  if (o.k === 3) return '<h4>' + L(o.kind === 'ice' ? 'Eis' : 'Erz') + '</h4><p>' + L('Vorrat') + ' ' + Math.round(o.amount) + ' / ' + Math.round(o.max) + '</p>';
  if (o.k === 5) return '<h4 style="color:#9ff0c0">' + L('Sprungtor') + '</h4><p>' + L({ dead: 'Erloschen – ein Bauschiff kann es mit Relikten wecken.', flicker: 'Flackert: öffnet sich alle 50 Sekunden kurz.', active: 'Aktiv' }[o.state] || '') + '</p>';
  if (o.kind && SITE_DEF[o.kind]) return '<h4 style="color:#9ff0c0">' + esc(L(SITE_DEF[o.kind].name)) + '</h4><p>' + esc(L(SITE_DEF[o.kind].desc)) + '</p>';
  return '';
}
function bldgTip(def) {
  const l = def.lv[0];
  return '<h4>' + esc(L(def.name)) + '</h4><div class="cost">' + costTxt(l.cost) + ' · ' + l.time + ' s</div><p>' + esc(L(def.desc)) + '</p>' + (def.role === 'base' ? '<p class="fine">' + L('Außenbasis: ein Bauschiff kann weitere Kommandobasen überall auf der Karte errichten, auch fern der eigenen Stationen. Um sie herum lässt sich wieder bauen.') + '</p>' : '') + '<p class="fine">' + L('Hülle') + ' ' + l.hull + (l.shield ? ' · ' + L('Schild') + ' ' + l.shield : '') + (l.armor ? ' · ' + L('Panzerung') + ' ' + l.armor : '') + (l.energy ? ' · ' + L('Energie') + ' ' + (l.energy > 0 ? '+' : '') + l.energy : '') + (l.cp ? ' · ' + L('Kommando') + ' +' + l.cp : '') + '</p>';
}
function hudBuild(force) {
  const box = $('build'), items = $('items'), tabs = $('tabs');
  const us = selShips(), b = UI.selB ? UI.g.byId.get(UI.selB) : null, g = UI.g, P = UI.P;
  const builder = us.find(u => u.def.build);
  let sig = '';
  if (builder && !us.some(u => armed(u))) sig = 'b|' + UI.tab + '|' + Object.values(BLDG[P.faction]).map(d => (buildReq(g, UI.me, d.role) || '') + (canPay(P, d.lv[0].cost) ? 1 : 0)).join(',');
  else if (b && b.owner === UI.me && b.role === 'yard' && b.done) sig = 'y|' + b.id + '|' + b.lv + '|' + b.q.map(q => q.id).join(',') + '|' + Math.round(b.qp * 20) + '|' + Object.values(SHIPS).filter(d => d.f === P.faction).map(d => (trainReq(g, UI.me, d.id) || '') + (canPay(P, shipCost(P, d)) ? 1 : 0)).join(',');
  else if (b && b.owner === UI.me && b.role === 'lab' && b.done) sig = 'l|' + b.id + '|' + b.lv + '|' + (P.research ? P.research.id + Math.round(P.research.prog * 20) : '') + '|' + TECH[P.faction].map(t => (P.tech[t.id] ? 1 : 0) + (canPay(P, t.cost) ? 1 : 0)).join(',');
  if (!force && box._sig === sig) return;
  box._sig = sig;
  items.textContent = ''; tabs.textContent = '';
  if (builder && !us.some(u => armed(u))) {
    box.hidden = false;
    for (const [id, nm] of BLDG_TABS) { const t = document.createElement('button'); t.className = 'key' + (UI.tab === id ? ' on' : ''); t.textContent = L(nm); t.dataset.k = 'tab:' + id; t.addEventListener('click', () => { UI.tab = id; SND.play('click'); hudBuild(true); }); tabs.appendChild(t); }
    const list = Object.values(BLDG[P.faction]).filter(d => d.tab === UI.tab);
    if (!list.length) { const p = document.createElement('p'); p.className = 'fine'; p.textContent = L('Kommt in einer späteren Runde.'); items.appendChild(p); }
    for (const d of list) {
      const why = buildReq(g, UI.me, d.role), afford = canPay(P, bcost(P, d));
      const el = itemBtn(L(d.name), bcost(P, d), () => { if (why) { toast(L(why), 'warn'); SND.play('err'); return; } if (!afford) { toast(L('Nicht genug Rohstoffe für {0}', L(d.name)), 'warn'); SND.play('err'); return; } SND.play('click'); startPlace(d.role); }, () => bldgTip(d), why ? '<span class="lock">' + esc(L(why)) + '</span>' : '');
      if (why || !afford) el.classList.add('off');
      el.dataset.k = 'item:' + d.role;
      items.appendChild(el);
    }
    return;
  }
  if (b && b.owner === UI.me && b.role === 'yard' && b.done) {
    box.hidden = false;
    const list = Object.values(SHIPS).filter(d => d.f === P.faction && !d.hidden);
    for (const d of list) {
      const why = trainReq(g, UI.me, d.id) || (b.lv < d.yard ? 'Benötigt Werft Stufe ' + ROMAN[d.yard] : null), afford = canPay(P, shipCost(P, d)), n = b.q.filter(q => q.id === d.id).length;
      const extra = (n ? '<span class="q">' + n + '</span>' : '') + (b.q.length && b.q[0].id === d.id ? '<span class="pb"><i style="width:' + Math.round(b.qp * 100) + '%"></i></span>' : '') + (why ? '<span class="lock">' + esc(L(why)) + '</span>' : '');
      const el = itemBtn(L(d.name), shipCost(P, d), () => { const r = issue({ t: 'train', b: b.id, id: d.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudBuild(); } }, () => shipTip(d), extra);
      if (why || !afford) el.classList.add('off');
      el.dataset.k = 'item:' + d.id;
      items.appendChild(el);
    }
    if (b.q.length) { const c = document.createElement('button'); c.className = 'key item warn'; c.innerHTML = '<span class="nm">✕ ' + esc(L('Letztes abbrechen')) + '</span>'; bindHold(c, () => { issue({ t: 'cancel', b: b.id, i: b.q.length - 1 }); SND.play('click'); hudBuild(); }, '<h4>' + L('Abbrechen') + '</h4><p>' + L('Nimmt das letzte Schiff aus der Warteschlange, die Kosten kommen zurück.') + '</p>'); items.appendChild(c); }
    return;
  }
  if (b && b.owner === UI.me && b.role === 'lab' && b.done) {
    box.hidden = false;
    const t0 = document.createElement('div'); t0.className = 'fine'; t0.style.margin = '0';
    t0.textContent = P.research ? L('Forschung läuft') + ': ' + L(techDef(P.faction, P.research.id).name) + ' ' + Math.round(P.research.prog * 100) + ' %' : L('Forschung: eine Technologie zugleich. Labor Stufe II und III schalten weitere frei.');
    tabs.appendChild(t0);
    for (const t of TECH[P.faction]) {
      const done = !!P.tech[t.id], why = done ? null : researchReq(g, UI.me, t.id), afford = canPay(P, t.cost), run = P.research && P.research.id === t.id;
      const extra = (done ? '<span class="q">✓</span>' : '') + (run ? '<span class="pb"><i style="width:' + Math.round(P.research.prog * 100) + '%"></i></span>' : '') + (why && !run && why !== 'Forschung läuft schon' ? '<span class="lock">' + esc(L(why)) + '</span>' : '');
      const el = itemBtn(L(t.name), done ? null : t.cost, () => { if (run) { issue({ t: 'cancelResearch' }); SND.play('click'); hudBuild(true); return; } const r = issue({ t: 'research', id: t.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudBuild(true); } }, () => '<h4>' + esc(L(t.name)) + '</h4><div class="cost">' + costTxt(t.cost) + ' · ' + t.time + ' s · ' + L('Labor') + ' ' + ROMAN[t.lv] + '</div><p>' + esc(L(t.desc)) + '</p>' + (run ? '<p class="req">' + L('Tippen bricht die Forschung ab') + '</p>' : ''), extra);
      if (done) el.classList.add('done'); else if (run) el.classList.add('on'); else if (why || !afford) el.classList.add('off');
      items.appendChild(el);
    }
    return;
  }
  box.hidden = true;
}
function hudSel() {
  const card = $('selCard'), us = selShips(), b = UI.selB ? UI.g.byId.get(UI.selB) : null, so = UI.selS ? UI.g.byId.get(UI.selS) : null;
  if (!us.length && !b && !so) { card.hidden = true; card._h = ''; UI.hasSel = false; hudCmds(); hudBuild(); return; }
  card.hidden = false; UI.hasSel = true;
  let h = '';
  if (so) {
    const g = UI.g;
    if (so.k === 5) {
      const pair = g.byId.get(so.pair), st = so.state === 'active' ? L('Aktiv') + ' · ' + L({ bridge: 'Brücke', lock: 'Sperre', lance: 'Lanze' }[so.mode]) : so.state === 'flicker' ? L('Flackernd') + (gateOpen(g, so, UI.me) ? ' · ' + L('offen!') : ' · ' + L('öffnet in {0} s', Math.ceil(50 - (g.time % 50)))) : L('Tot');
      h += '<h3><span>' + L('Sprungtor') + '</span><span>' + (so.owner >= 0 ? esc(pname(so.owner)) : '') + '</span></h3>';
      h += '<div class="sub">' + st + (pair ? ' · ' + L('Partner') + ' ' + Math.round(hyp(pair.x - so.x, pair.y - so.y) / 100) * 100 + ' ' + L('entfernt') : '') + '</div>';
      if (so.prog > 0) h += '<div class="bar prog"><i style="width:' + Math.round(so.prog * 100) + '%"></i></div><div class="sub">' + (so.by >= 0 ? esc(pname(so.by)) : '') + ' ' + L('hält das Tor') + ' ' + Math.round(so.prog * 100) + ' %</div>';
      if (so.state === 'active' && so.mode === 'lance') h += '<div class="bar charge"><i style="width:' + Math.round(so.charge * 100) + '%"></i></div><div class="sub">' + L('Lanze lädt') + ' ' + Math.round(so.charge * 100) + ' % · ' + L('Überlastung') + ' ' + so.overload + '/3</div>';
      h += '<div class="sub desc">' + (so.state === 'flicker' ? L('Öffnet sich alle 50 Sekunden für 8 Sekunden, für jeden. Durch die Mitte fliegen.') : so.state === 'dead' ? L('20 Sekunden mit Kampfschiffen halten und {0} Relikte zahlen, dann gehört es dir.', RELIC_GATE) : L('Dein Tor. Brücke, Sperre oder Lanze wählen. Feinde können es übernehmen, wenn sie es halten.')) + '</div>';
    } else {
      const D = SITE_DEF[so.kind];
      h += '<h3><span>' + esc(L(so.name)) + '</span><span>' + (so.owner >= 0 ? esc(pname(so.owner)) : '') + '</span></h3>';
      if (so.kind === 'ruin') h += '<div class="sub">' + (so.scanned ? L('Gescannt') + (so.result ? ': ' + L({ relics: 'Relikte', tech: 'Technikfragment', map: 'Karte aufgedeckt', trap: 'Falle' }[so.result]) : '') : L('Ungescannt')) + '</div>';
      else if (so.kind === 'citadel') h += '<div class="sub">' + (so.done ? L('Erobert') : so.guard.some(id => { const u = g.byId.get(id); return u && !u.dead; }) ? L('Von Wächterdrohnen bewacht') : L('Frei: 60 s mit 6 ★ Kampfschiffen halten')) + '</div>';
      else if (so.kind === 'warden') h += '<div class="sub">' + (so.done ? L('Zerstört') : so.woke ? L('Erwacht und auf Amoklauf!') : L('Schläft. Wer schießt, weckt ihn.')) + '</div>';
      else if (so.kind === 'forge') h += '<div class="sub">' + (so.held >= 0 ? L('Gehalten von {0}', pname(so.held)) : L('Niemand hält die Schmiede')) + '</div>';
      else if (so.kind === 'archive') h += '<div class="sub">' + (so.used.length ? L('Genutzt von') + ': ' + so.used.map(pname).join(', ') : L('45 s halten')) + '</div>';
      if (so.prog > 0 && !so.done) h += '<div class="bar prog"><i style="width:' + Math.round(so.prog * 100) + '%"></i></div><div class="sub">' + (so.by >= 0 ? esc(pname(so.by)) : '') + ' ' + Math.round(so.prog * 100) + ' %</div>';
      h += '<div class="sub desc">' + esc(L(D.desc)) + '</div>';
    }
  } else if (b) {
    const lv = lvOf(b);
    h += '<h3><span>' + esc(L(b.def.name)) + ' ' + ROMAN[b.lv] + '</span><span>' + (b.owner === UI.me ? '' : esc(pname(b.owner))) + '</span></h3>';
    if (b.label) h += '<div class="sub" style="color:var(--acc2)">' + esc(L(b.label)) + '</div>';
    h += '<div class="bar"><i style="width:' + Math.round(b.hull / b.hullMax * 100) + '%"></i></div><div class="sub">' + L('Hülle') + ' ' + Math.round(b.hull) + ' / ' + Math.round(b.hullMax) + (lv.armor ? ' · ' + L('Panzerung') + ' ' + lv.armor : '') + '</div>';
    if (b.shieldMax || b.give) h += '<div class="bar sh"><i style="width:' + Math.round(((b.shield || 0) + (b.give || 0)) / ((b.shieldMax || 0) + (b.givep || 0)) * 100) + '%"></i></div><div class="sub">' + L('Schild') + ' ' + Math.round((b.shield || 0) + (b.give || 0)) + ' / ' + Math.round((b.shieldMax || 0) + (b.givep || 0)) + '</div>';
    if (!b.done) h += '<div class="bar prog"><i style="width:' + Math.round(b.prog * 100) + '%"></i></div><div class="sub">' + (b.bld ? L('Im Bau') + ' ' + Math.round(b.prog * 100) + ' %' : L('Wartet auf ein Bauschiff')) + '</div>';
    if (b.upg) h += '<div class="bar prog"><i style="width:' + Math.round(b.upg.prog * 100) + '%"></i></div><div class="sub">' + L('Ausbau auf Stufe') + ' ' + ROMAN[b.lv + 1] + ' ' + Math.round(b.upg.prog * 100) + ' %</div>';
    if (b.role === 'yard' && b.q.length) h += '<div class="sub">' + L('Baut') + ': ' + b.q.map(q => L(SHIPS[q.id].name)).join(', ') + '</div>';
    if (b.role === 'refinery' && b.done) h += '<div class="sub">' + L('Andockplätze') + ' ' + b.docks + ' / ' + lv.docks + '</div>';
    if (b.role === 'lab' && b.done && UI.P.research && b.owner === UI.me) h += '<div class="bar prog"><i style="width:' + Math.round(UI.P.research.prog * 100) + '%"></i></div><div class="sub">' + L('Forscht') + ': ' + L(techDef(UI.P.faction, UI.P.research.id).name) + '</div>';
    if (b.role === 'super' && b.done) h += '<div class="bar charge"><i style="width:' + Math.round(b.charge * 100) + '%"></i></div><div class="sub">' + (b.charge >= 1 ? L('Bereit') : L('Lädt') + ' ' + Math.round(b.charge * 100) + ' %') + '</div>';
    if (b.boarding > 0) h += '<div class="sub" style="color:var(--bad)">' + L('Wird geentert') + ': ' + Math.round(b.boarding) + ' ' + L('Marines') + ' · ' + L('Crew') + ' ' + Math.round(b.crew) + '</div>';
    if (b.done && b.owner === UI.me) h += '<div class="sub desc">' + esc(L(b.def.desc)) + '</div>';
  } else if (us.length === 1) {
    const u = us[0], d = u.def;
    h += '<h3><span>' + esc(L(d.name)) + (u.rank ? ' · ' + L(RANK_NAMES[u.rank]) : '') + refitMarks(u) + '</span><span>' + d.cp + ' ★</span></h3>';
    h += '<div class="bar"><i style="width:' + Math.round(u.hull / u.hullMax * 100) + '%"></i></div><div class="sub">' + L('Hülle') + ' ' + Math.round(u.hull) + ' / ' + Math.round(u.hullMax) + (d.armor || u.armorPlus ? ' · ' + L('Panzerung') + ' ' + (d.armor + (u.armorPlus || 0)) : '') + '</div>';
    h += refitCard(u);
    if (u.shieldMax) h += '<div class="bar sh"><i style="width:' + Math.round(u.shield / u.shieldMax * 100) + '%"></i></div><div class="sub">' + L('Schild') + ' ' + Math.round(u.shield) + ' / ' + Math.round(u.shieldMax) + '</div>';
    if (d.cargo) { const cap = Math.round(d.cargo * UI.P.tfx.cargo); h += '<div class="bar prog"><i style="width:' + Math.round(u.cargo / cap * 100) + '%"></i></div><div class="sub">' + L('Fracht') + ' ' + Math.round(u.cargo) + ' / ' + cap + (u.ckind ? ' ' + (u.ckind === 'ore' ? L('Erz') : L('Eis')) : '') + '</div>'; }
    const O = { idle: 'Wartet', hold: 'Hält Stellung', move: 'Fliegt', amove: 'Angriffsmarsch', attack: 'Greift an', harvest: 'Baut ab', return: 'Liefert', build: 'Baut', board: 'Entert', explore: 'Erkundet', salvage: 'Birgt ein Wrack' };
    if (d.cmdr) h += '<div class="cmdr">★ ' + esc(L(d.cmdr)) + '</div>';
    else if (u.hero) h += '<div class="cmdr">' + esc(qt(L(u.hero))) + '</div>';
    if (u.ion) h += '<div class="sub" style="color:var(--acc2)">' + L('Im Ionennebel: Schilde aus, Sicht nur im Nahbereich – für Feinde erst aus der Nähe zu sehen.') + '</div>';
    else if (inAsh(UI.g.map, u.x, u.y)) h += '<div class="sub" style="color:var(--bad)">' + L('Im Aschenebel: Schilde aus, die Hülle nimmt Schaden.') + '</div>';
    if (u.abT.cloak > 0) h += '<div class="sub" style="color:var(--acc2)">' + L('Getarnt: noch {0} s. Ein Angriff hebt die Tarnung auf.', Math.ceil(u.abT.cloak)) + '</div>';
    if (u.retreat) h += '<div class="sub" style="color:var(--acc2)">' + L('Rückzug zur Werft: kehrt nach der Reparatur zurück.') + '</div>';
    if (u.dormant) h += '<div class="sub" style="color:var(--acc2)">' + L('Ruht. Ein Restorer daneben erweckt das Schiff mit allem Rang.') + '</div>';
    if (u.derelict) h += '<div class="sub" style="color:var(--bad)">' + L('Wrack ohne Crew. Ein Bauschiff in der Nähe besetzt es neu.') + '</div>';
    else h += '<div class="sub">' + L(O[u.o.t] || u.o.t) + (u.o.t === 'attack' && u.o.sub ? ' → ' + L(SUB_NAMES[u.o.sub]) : '') + (d.wpn.length ? ' · ' + L(STANCES[u.stance | 0]) : '') + (u.kills ? ' · ' + u.kills + ' ' + L('Abschüsse') : '') + '</div>';
    if (u.crewMax) h += '<div class="crew"><span>' + L('Crew') + ' <b>' + Math.round(u.crew) + '</b>/' + u.crewMax + '</span>' + (d.marines ? '<span>' + L('Marines') + ' <b>' + Math.round(u.marines) + '</b></span>' : '') + (u.boarding > 0 ? '<span style="color:var(--bad)">' + L('Geentert') + ' ' + Math.round(u.boarding) + '</span>' : '') + '</div>';
    if (u.crewMax) h += '<div class="subs">' + SUBS.map(k => { const v = u.sub[k]; return '<span class="' + (v < 0.35 ? 'low' : v < 0.7 ? 'mid' : '') + (UI.subAim === k ? ' aim' : '') + '" title="' + esc(L(SUB_NAMES[k])) + '">' + SUB_ICON[k] + '<i><b style="width:' + Math.round(v * 100) + '%"></b></i></span>'; }).join('') + '</div>';
    if (u.hangar) h += '<div class="sub">' + L(d.drone === 'cherub' ? 'Begleitdrohnen' : 'Jäger') + ' ' + u.hangar.n + ' / ' + hangarMax(UI.g, u) + '</div>';
    if (u.adapt && Object.keys(u.adapt).length) h += '<div class="sub">' + L('Anpassung') + ': ' + Object.keys(u.adapt).map(k => ({ beam: 'Strahl', kin: 'Kanone', rail: 'Railgun', torp: 'Torpedo', pd: 'Abwehr' }[k] || k) + ' −' + Math.round(Math.min(0.5, u.adapt[k] * 0.012) * 100) + ' %').join(', ') + '</div>';
    if (u.abT.overload > 0 || u.abT.grush > 0 || u.abT.flak > 0 || u.abT.broadside > 0 || u.abT.invuln > 0 || u.dome > 0 || u.sprint > 0) h += '<div class="sub" style="color:var(--acc2)">' + L('Fähigkeit aktiv') + '</div>';
    else if (u.dis > 0) h += '<div class="sub" style="color:var(--warn)">' + L('Waffen aus') + ' ' + Math.ceil(u.dis) + ' s</div>';
    if (u.fcT > 0 && FCMD[u.fc]) h += FC_SUB[u.fc] + L('Flottenbefehl') + ': ' + esc(L(ABIL[FCMD[u.fc].ab].name)) + ' · ' + Math.ceil(u.fcT) + ' s</div>';
    else if (u.faT > UI.g.time && !d.flag) h += '<div class="sub" style="color:var(--acc2)">' + L('Im Umkreis des Flaggschiffs') + '</div>';
  } else {
    const by = new Map();
    for (const u of us) { const e = by.get(u.type) || { n: 0, hurt: 0, def: u.def }; e.n++; if (u.hull < u.hullMax * 0.6) e.hurt++; by.set(u.type, e); }
    let hull = 0, hullMax = 0, sh = 0, shMax = 0;
    for (const u of us) { hull += u.hull; hullMax += u.hullMax; sh += u.shield; shMax += u.shieldMax; }
    h += '<h3><span>' + us.length + ' ' + L('Schiffe') + '</span><span>' + us.reduce((s, u) => s + u.def.cp, 0) + ' ★</span></h3>';
    h += '<div class="bar"><i style="width:' + Math.round(hull / hullMax * 100) + '%"></i></div>' + (shMax ? '<div class="bar sh"><i style="width:' + Math.round(sh / shMax * 100) + '%"></i></div>' : '');
    h += '<div class="sellist">' + [...by.entries()].map(([t, e]) => '<button data-t="' + t + '"' + (e.hurt ? ' class="hurt"' : '') + '>' + e.n + ' × ' + esc(L(e.def.name)) + '</button>').join('') + '</div>';
  }
  if (card._h !== h) { card.innerHTML = h; card._h = h; }
  card.querySelectorAll('.sellist button').forEach(el => el.addEventListener('click', () => { const t = el.dataset.t; setSel(selShips().filter(u => u.type === t)); SND.play('click'); }));
  hudCmds(); hudBuild();
}
/* ------------------------------------------------------------------ Fassung 22: Nachrüsten an der Werft (Tasten, Karte) */
function refitMarks(u) { return u.rf && u.rf.length ? ' <b class="rfm">' + u.rf.map(k => REFIT[k].icon).join('') + '</b>' : ''; }
/* Zeile in der Farbe des Flottenbefehls (ganze Tags, damit die Übersetzung sie nicht als Text sammelt) */
const FC_SUB = { alliance: '<div class="sub" style="color:#8fe3ff">', mars: '<div class="sub" style="color:#ffb070">', legion: '<div class="sub" style="color:#f2c14e">', nexus: '<div class="sub" style="color:#c9a0ff">', brood: '<div class="sub" style="color:#b4ff3c">' };
function refitCard(u) {
  let h = '';
  if (u.rf && u.rf.length) h += '<div class="sub">' + L('Nachgerüstet') + ': ' + u.rf.map(k => REFIT[k].icon + ' ' + esc(L(REFIT[k].name))).join(', ') + ' (' + u.rf.length + '/' + REFIT_MAX + ')</div>';
  if (u.rfq) h += '<div class="bar prog"><i style="width:' + Math.round(u.rfq.prog * 100) + '%"></i></div>' + (u.rfq.away ? '<div class="sub" style="color:var(--warn)">' : '<div class="sub">') + L('Nachrüstung') + ': ' + esc(L(REFIT[u.rfq.id].name)) + ' ' + Math.round(u.rfq.prog * 100) + ' %' + (u.rfq.away ? ' · ' + L('zu weit von der Werft') : '') + '</div>';
  return h;
}
function refitSel(us) { const g = UI.g; return us.filter(u => u.owner === UI.me && !u.derelict && u.def.role !== 'fighter' && refitYard(g, u, 1)); }
function refitSig(us) { if (!us.length || !UI.g) return ''; return refitSel(us).map(u => u.id + ':' + (u.rf ? u.rf.join('') : '') + (u.rfq ? 'q' : '')).join(','); }
function refitBtns(box, us, sub) {
  const g = UI.g, near = refitSel(us);
  if (!near.length) { if (sub) { endMode(); hudCmds(true); } return; }
  if (!sub) { const any = near.some(u => REFIT_IDS.some(k => !refitReq(g, u, k))); box.appendChild(cmdBtn('⚒', 'Nachrüsten', () => { UI.mode = 'refit'; SND.play('click'); hudCmds(true); }, 'Nachrüsten an der Werft: Panzerung, Waffen, Antrieb oder Sensoren verbessern (höchstens zwei je Schiff)', 'rf' + (any ? ' arm' : near.some(u => u.rfq) ? ' on' : ''))); return; }
  box.appendChild(cmdBtn('‹', 'Zurück', () => { endMode(); hudCmds(true); }, 'Zurück zu den Befehlen'));
  for (const k of REFIT_IDS) {
    const R0 = REFIT[k], can = near.filter(u => !refitReq(g, u, k));
    const why = can.length ? null : refitReq(g, near[0], k);
    const c = can.length ? refitCost(UI.P, can[0], k) : refitCost(UI.P, near[0], k);
    const el = cmdBtn(R0.icon, R0.name, () => {}, null, 'rf' + (can.length && canPay(UI.P, c) ? ' arm' : ' off'));
    bindHold(el, () => { const r = issue({ t: 'refit', u: ids(near), id: k }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('upgrade'); hudSel(); hudCmds(true); } }, () => '<h4>' + R0.icon + ' ' + L('Nachrüsten') + ': ' + esc(L(R0.name)) + '</h4><div class="cost">' + costTxt(c) + (can.length > 1 ? ' × ' + can.length : '') + ' · ' + refitTime((can[0] || near[0]).def) + ' s</div><p>' + esc(L(R0.desc)) + '</p><p>' + esc(L('Das Schiff muss so lange an der Werft bleiben. Höchstens zwei Nachrüstungen je Schiff, jede Art einmal.')) + '</p>' + (why ? '<p class="req">' + esc(L(why)) + '</p>' : ''));
    box.appendChild(el);
  }
  if (near.some(u => u.rfq)) box.appendChild(cmdBtn('✕', 'Abbruch', () => { issue({ t: 'refitCancel', u: ids(near) }); SND.play('click'); hudSel(); hudCmds(true); }, 'Nachrüstung abbrechen (volle Erstattung)', 'warn'));
}
function pname(pi) { const p = UI.g.players[pi]; if (p.name) return L(p.name); return L(p.F.name) + (p.ai ? ' (' + L('KI') + ')' : ''); }
function hudGroups() { const g = UI.g; if (!g) return; document.querySelectorAll('.grp').forEach(el => { const i = +el.dataset.g; el.classList.toggle('has', g.ships.some(u => !u.dead && u.owner === UI.me && u.grp === i)); }); }
function hudUpdate() {
  const g = UI.g, P = UI.P;
  if (!g || !P || UI.attract) return;
  setText('rIce', fmt(P.ice)); setText('rOre', fmt(P.ore)); const bio = !!P.F.bio; $('resOre').hidden = bio; $('resIce').classList.toggle('bio', bio);
  setText('rEnergy', (P.eGen - P.eUse >= 0 ? '+' : '') + (P.eGen - P.eUse) + ' (' + P.eGen + ')');
  $('resEnergy').classList.toggle('low', P.lowPower);
  setText('rCp', P.cpUse + '/' + P.cpMax);
  setText('rRelic', P.relics); $('resRelic').classList.toggle('zero', !P.relics);
  const W = g.wave; $('resWave').hidden = !W;
  if (W) { setText('rWave', W.phase === 'build' ? L('Welle {0} in {1}', W.n + 1, clock(Math.max(0, W.next))) : L('Welle {0} · {1} Feinde', W.n, W.alive !== undefined ? W.alive : W.spawned)); $('resWave').classList.toggle('hot', W.phase === 'wave' || W.next < 10); }
  $('resCp').classList.toggle('low', P.cpUse + P.queued >= P.cpMax);
  setText('clock', clock(g.time));
  if (UI.hasSel || UI.sel.size || UI.selB) hudSel();
  if ((g.tick % 30) < 4) hudGroups();
  if (UI.infoT && performance.now() > UI.infoT) { $('info').hidden = true; UI.infoT = 0; }
  if (g.mis) misUiHud();
  musMood(g, P);
}
function musMood(g, P) {
  let firing = 0, seen = 0;
  for (const u of g.ships) { if (u.dead) continue; if (u.owner === UI.me) { if (u.beams || u.o.t === 'attack') firing++; } else if (isFoe(u.owner) && canSee(g, UI.me, u)) seen++; }
  const hurt = g.time - P.hurtT < 15;
  MUS.want = Math.max(hurt ? 0.6 : firing || seen ? 0.5 : 0, sfxCombat(g));   /* Runde 18: Kampfdichte aus sfx.js */
}
/* Ereignisse der Simulation → Meldungen und Töne */
UI.consume = function (evs) {
  const g = UI.g, me = UI.me;
  sfxEvents(g, me, evs);   /* Runde 18: Kampfgeräusche, Sprachmeldungen, Kampfdichte (sfx.js) */
  for (const e of evs) {
    const mine = e.owner === me;
    switch (e.t) {
      case 'die': if (!e.quiet) { if (mine && e.type !== 'fighter') { UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; } } break;
      case 'bdie': if (mine) { toast(L('{0} verloren', L(BLDG[g.players[me].faction][e.role].name)), 'bad'); R.ping(e.x, e.y); UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; } break;
      case 'attack': if (mine && g.time - UI.alertT > 10) { UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; toast(L('Basis unter Beschuss! Leertaste oder Minikarte springt hin'), 'bad'); SND.play('alert'); buzz(40); } break;
      case 'built': if (mine) { SND.play('built'); toast(L('{0} fertig', L(BLDG[g.players[me].faction][e.role].name)), 'good', 2200); hudSel(); } break;
      case 'ready': if (mine) { SND.play('ready'); hudBuild(); } break;
      case 'upgrade': if (mine) { SND.play('upgrade'); hudSel(); } break;
      case 'research': if (mine) { SND.play('upgrade'); toast(L(e.free ? 'Geschenkt: {0}' : 'Erforscht: {0}', L(techDef(g.players[me].faction, e.id).name)), 'good', 4000); hudBuild(true); } break;
      case 'lowpower': if (mine) { SND.play('lowpower'); toast(L('Energiemangel: Reaktor bauen'), 'warn'); } break;
      case 'rank': if (mine) SND.play('rank', e.x, e.y); break;
      case 'elim': toast(L('{0} ist besiegt', pname(e.owner)), mine ? 'bad' : 'good', 5000); if (mine) SND.play('lose'); break;
      case 'aiattack': break;
      case 'over': showEnd(); break;
      case 'radio': case 'cam': case 'ask': case 'chosen': case 'goal': case 'breach': case 'gateDark': misUiEvent(e); break;
      case 'place': if (mine) hudSel(); break;
      case 'doctrine': if (mine) { toast(L('Kommandobasis Stufe II: Wähle deine Doktrin'), 'good', 5000); SND.play('ready'); setTimeout(() => { if (UI.g === g && !UI.P.doctrine) openDoctrine(); }, 900); } break;
      case 'doctrineSet': { const d = doctrineDef(g.players[e.owner].faction, e.id); if (mine) toast(L('Doktrin festgelegt: {0}', L(d.name)), 'good', 4000); else if (isFoe(e.owner)) toast(L('{0} wählt die Doktrin {1}', pname(e.owner), L(d.name)), 'warn', 4000); hudBuild(true); hudCmds(true); break; }
      case 'supercharged': if (mine) { SND.play('ready'); toast(L('{0} ist geladen', L(BLDG[g.players[me].faction].super.name)), 'good', 4000); R.ping(e.x, e.y); } else if (isFoe(e.owner)) toast(L('Warnung: Die Superwaffe von {0} ist geladen', pname(e.owner)), 'bad', 4000); break;
      case 'superfire': if (mine) { SND.play('super'); } else if (isFoe(e.owner)) { toast(e.kind === 'strike' ? L('Massetreiber abgefeuert! Einschlag in 3 Sekunden') : L('Exodus-Tor: {0} feindliche Schiffe versetzt', e.n), 'bad', 4000); SND.play('alert'); R.ping(e.x, e.y); UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; buzz(60); } break;
      case 'strike': SND.play('bigboom', e.x, e.y); if (visAt(g, me, e.x, e.y)) buzz(30); break;
      case 'exodus': if (e.to === 0) SND.play('warp', e.x, e.y, 0.6); break;
      case 'ability': if (e.owner === me || visAt(g, me, e.x, e.y)) SND.play('ability', e.x, e.y, mine ? 0.9 : 0.6); break;
      case 'lance': SND.play('lance', e.x, e.y); break;
      case 'board': if (visAt(g, me, e.x, e.y)) SND.play('board', e.x, e.y); break;
      case 'captured': { const nm = L(e.name); if (e.to === me) { toast(L('{0} geentert und übernommen', nm), 'good', 4000); SND.play('rank', e.x, e.y); } else if (e.from === me) { toast(L('{0} wurde geentert und ist verloren', nm), 'bad', 4000); SND.play('lose'); R.ping(e.x, e.y); } hudSel(); break; }
      case 'derelict': if (mine) { toast(L('{0}: Crew verloren, treibt als Wrack', L(e.name)), 'warn', 4000); R.ping(e.x, e.y); } break;
      case 'recrew': if (mine) toast(L('Wrack neu besetzt'), 'good'); break;
      case 'boardfail': if (mine) toast(L('Enterkommando abgewehrt'), 'warn'); break;
      case 'dormant': if (mine) { toast(L('{0} »{1}« ruht als Wrack. Restorer hinschicken!', L(e.name), e.hero || ''), 'warn', 4000); R.ping(e.x, e.y, '#f2c14e'); } break;
      case 'resurrect': if (mine) { toast(L('Der Last Sovereign steht wieder auf'), 'good', 4000); SND.play('upgrade'); } break;
      case 'merge': if (mine) SND.play('upgrade'); hudSel(); break;
      /* Fassung 22: Nachrüsten */
      case 'refit': if (mine && e.st === 1) { SND.play('upgrade'); const u = g.byId.get(e.id); toast(L('Nachrüstung fertig: {0} – {1}', u ? L(u.def.name) : '', L(REFIT[e.k].name)), 'good', 3500); } else if (mine && e.st === -1) toast(L('Nachrüstung abgebrochen: keine Werft mehr'), 'warn'); if (mine) hudCmds(true); break;
      case 'bound': if (mine) { SND.play('rank', e.x, e.y); } else if (isFoe(e.owner)) { toast(L('Der Nexus hat ein Schiff übernommen'), 'bad'); } hudSel(); break;
      case 'netoff': if (mine) { toast(L('Station vom Netz getrennt: Knoten bauen oder reparieren'), 'warn', 4000); R.ping(e.x, e.y, '#ff5b47'); } break;
      case 'relics': if (mine) { toast(L('+{0} Relikte: {1}', e.n, L(e.why)), 'good', 3500); SND.play('ready'); } break;
      case 'ruin': if (mine) { toast(L({ relics: 'Ruine: Relikte geborgen', tech: 'Ruine: Technikfragment – eine Forschung geschenkt', map: 'Ruine: Sternkarte gefunden, Umgebung aufgedeckt', trap: 'Ruine: Falle! Wächterdrohnen erwachen' }[e.result]), e.result === 'trap' ? 'bad' : 'good', 4000); SND.play(e.result === 'trap' ? 'alert' : 'ready'); } break;
      case 'retreat': if (mine && performance.now() - (UI.retT || 0) > 8000) { UI.retT = performance.now(); toast(L('Schwer beschädigt: zieht sich zur Werft zurück'), '', 2500); } break;
      case 'fortFall': if (mine) { toast(L('Piratenfestung erobert! Schatz: +{0} Eis, +{1} Erz, +{2} Relikte', e.ice, e.ore, e.relics), 'good', 6000); SND.play('upgrade'); } else { toast(L('{0} hat die Piratenfestung erobert', pname(e.owner)), isFoe(e.owner) ? 'warn' : 'good', 5000); R.ping(e.x, e.y); } break;
      case 'siteWon': if (mine) { toast(L('{0} gehalten: {1}', L(e.name), L(e.reward)), 'good', 5000); SND.play('upgrade'); if (e.kind === 'archive') setTimeout(() => { if (UI.g === g && UI.P.etechAsk) openEtech(); }, 600); } else if (isFoe(e.owner)) { toast(L('{0} hält {1}', pname(e.owner), L(e.name)), 'warn', 4000); R.ping(e.x, e.y); } break;
      case 'siteLost': if (mine) toast(L('Sternenschmiede verloren'), 'warn'); break;
      case 'gateOn': if (mine) { toast(L('Sprungtor aktiviert. Tor antippen: Brücke, Sperre oder Lanze'), 'good', 5000); SND.play('upgrade'); } else if (isFoe(e.owner)) { toast(L('{0} hat ein Sprungtor aktiviert', pname(e.owner)), 'warn', 4000); R.ping(e.x, e.y); } break;
      case 'gateLost': if (mine) { toast(L('Dein Sprungtor wurde übernommen'), 'bad', 4000); R.ping(e.x, e.y); } break;
      case 'gateRelics': if (mine) { toast(L('Tor gehalten, aber es fehlen Relikte ({0} nötig). Ruinen scannen!', RELIC_GATE), 'warn', 4000); } break;
      case 'gateWarn': if (!mine) { toast(L('Warnung: Torlanze lädt. Weg vom Tor!'), 'bad', 4000); SND.play('alert'); R.ping(e.x, e.y); } break;
      case 'gateLance': SND.play('super'); if (visAt(g, me, e.x, e.y)) buzz(40); break;
      case 'gateStorm': toast(L('Torsturm! Ein Riss spuckt Wächterdrohnen aus'), 'bad', 5000); SND.play('alarm'); R.ping(e.x, e.y); break;
      case 'wake': toast(L('Der Wächter ist erwacht'), 'bad', 5000); SND.play('alarm'); R.ping(e.x, e.y); break;
      case 'wave': toast(L('Welle {0}: {1} Brood-Schiffe brechen durch die Risse', e.n, e.count), 'bad', 5000); SND.play('alarm'); buzz(80); break;
      case 'waveWarn': toast(L('Welle {0} in {1} Sekunden', e.n, e.s), 'warn', 4000); break;
      case 'rift': R.ping(e.x, e.y, '#b4ff3c'); break;
      case 'waveDone': toast(L('Welle {0} abgewehrt', e.n), 'good', 4000); SND.play('upgrade'); if (!g.over) setTimeout(() => { if (UI.g === g && !g.over) openReward(); }, 700); break;
      case 'reward': if (mine) { const d = REWARDS.find(r => r.id === e.id); if (d) toast(L('Belohnung: {0}', L(d.name)), 'good', 3000); } break;
      case 'flareWarn': toast(L('Sonneneruption in 25 Sekunden! Schiffe in den Schatten von Monden, Felsen und Stationen'), 'bad', 7000); SND.play('alarm'); buzz(60); break;
      case 'flareStart': toast(L('Sonneneruption! Im Freien brennen die Schiffe'), 'bad', 4000); break;
      case 'flareEnd': toast(L('Die Eruption ist vorbei'), 'good'); break;
      case 'etech': if (mine) { toast(L('Erbauer-Technologie: {0}', L(ETECH[e.id].name)), 'good', 4000); } break;
    }
  }
};

/* ------------------------------------------------------------------ Abschluss, Pause, Menü */
function showEnd() {
  const g = UI.g, P = UI.P;
  if (g.mis) return misShowEnd();
  if (UI.endShown) return;
  UI.endShown = true; UI.endAt = performance.now();
  $('endMis').hidden = true; $('eNext').hidden = true; setText('eMenu', L('Hauptmenü'));
  let won = g.winTeam === P.team;
  $('endTitle').textContent = won ? L('Sieg') : L('Niederlage'); $('endTitle').className = won ? 'good' : 'bad';
  $('endText').textContent = won ? L('Der Kessel gehört dir. Spielzeit {0}.', clock(g.time)) : L('Deine Flotte ist geschlagen. Spielzeit {0}.', clock(g.time));
  if (g.wave && g.opts.mode === 'survival') { const n = g.wave.cleared, rec = setBestWave(P.faction, n); won = rec; $('endTitle').textContent = L('{0} Wellen überlebt', n); $('endTitle').className = rec ? 'good' : ''; $('endText').textContent = (rec ? L('Neuer Rekord mit {0}!', L(P.F.name)) : L('Rekord mit {0}: Welle {1}.', L(P.F.name), bestWave(P.faction))) + ' ' + L('Spielzeit {0}.', clock(g.time)); }
  else if (g.wave) { $('endText').textContent = won ? L('Das Siegel hält. {0} Wellen der Brood abgewehrt, Spielzeit {1}.', g.wave.n, clock(g.time)) : L('Das Siegel ist gefallen nach {0} Wellen. Die Brood strömt in den Kessel.', g.wave.cleared); }
  const st = $('endStats'); st.innerHTML = '<span></span><b>' + L('Abschüsse') + '</b><b>' + L('Verluste') + '</b>' + g.players.filter(p => !p.neutral).map(p => '<span style="color:' + pcolor(p) + '">' + esc(pname(p.id)) + '</span><span>' + p.stats.kills + ' / ' + p.stats.razed + '</span><span>' + p.stats.lost + ' / ' + p.stats.bLost + '</span>').join('');
  setText('eAgain', L(UI.kind === 'mp' ? 'Zur Lobby' : 'Noch einmal'));
  setTimeout(() => { $('end').hidden = false; MUS.sting(won ? 'win' : 'lose'); SND.play(won ? 'win' : 'lose'); clearSave(); }, won ? 1200 : 1800);
}
function setPaused(p, remote) {
  if (UI.attract || UI.endShown) return;
  const mp = UI.kind === 'mp' && NET.live;
  if (mp && !remote) mpSend({ k: 'pz', on: !!p });
  UI.paused = p;
  $('pause').hidden = !p;
  if (!p) { $('settings').hidden = true; $('help').hidden = true; inputReset(); }
  else if (mp) { $('pNote').hidden = false; $('pNote').textContent = remote ? L('Dein Mitspieler hat pausiert. »Weiter« setzt auf beiden Geräten fort.') : L('Die Pause gilt auch für deinen Mitspieler.'); if (remote) SND.play('click'); }
  else { const ok = saveNow(); $('pNote').hidden = false; $('pNote').textContent = ok ? L('Gespeichert. Im Hauptmenü geht es mit »Fortsetzen« weiter.') : L('Speichern ist hier nicht möglich.'); }
  if (p) { misPauseLog(); if (mp) $('pSaveRow').hidden = true; else pauseSlots(); }
  setText('pQuit', L(mp ? 'Gefecht verlassen' : UI.kind === 'mis' ? 'Kampagne' : UI.kind === 'cq' ? 'Rückzug' : 'Hauptmenü'));
}
/* Einstellungen */
function loadPrefs() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem('ra.prefs') || '{}') || {}; Object.assign(SET, d.set || {}); Object.assign(MENU, d.menu || {}); } catch (e) { /* keine Einstellungen */ }
  if (!d.set || (d.set.lang !== 'de' && d.set.lang !== 'en')) SET.lang = langDefault();
  /* Grafik: Vorgabe 3D; Prüfläufe (Playwright) laufen in 2D, 3D prüft tools/game3d.js mit eigener Einstellung */
  if (!d.set || (d.set.gfx !== '2d' && d.set.gfx !== '3d')) { let wd = false; try { wd = !!navigator.webdriver; } catch (e) { /* kein Browser */ } SET.gfx = wd ? '2d' : '3d'; }
}
function savePrefs() { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: SET, menu: MENU })); } catch (e) { /* Speicher gesperrt */ } }
function applySet() {
  SND.setVol(SET.vol / 100); MUS.setVol(SET.mus / 100);
  document.documentElement.style.setProperty('--ui', (15 * SET.scale) + 'px');
  UI.speed = SET.speed; UI.showAll = SET.bars === 'all';
  R.qScale = SET.qual === 'low' ? 0.6 : 1; R.detail = SET.qual === 'low' ? 1 : 2;
  if (R.cv) { const got = R.setMode(SET.gfx || '3d'); if (got !== (SET.gfx || '3d') && SET.gfx === '3d') SET.gfx3dFailed = true; if (R.mode3d) RA3D.setDetail(R.detail); R.resize(); }
  if (typeof layout === 'function') layout();
}
function segInit(id, opts, get, set) {
  const el = $(id); el.textContent = '';
  for (const [v, txt, sub, cls] of opts) { const b = document.createElement('button'); b.textContent = L(txt); if (sub) { const sm = document.createElement('small'); sm.textContent = sub; b.appendChild(sm); } b.className = (get() === v ? 'on' : '') + (cls ? ' ' + cls : ''); b.addEventListener('click', () => { set(v); SND.play('click'); segInit(id, opts, get, set); }); el.appendChild(b); }
}
function initSettings() {
  const vol = $('sVol'), mus = $('sMus');
  vol.value = SET.vol; mus.value = SET.mus; setText('sVolV', SET.vol + ' %'); setText('sMusV', SET.mus + ' %');
  vol.addEventListener('input', () => { SET.vol = +vol.value; setText('sVolV', SET.vol + ' %'); applySet(); savePrefs(); SND.play('click'); });
  mus.addEventListener('input', () => { SET.mus = +mus.value; setText('sMusV', SET.mus + ' %'); applySet(); savePrefs(); });
  const seg = () => {
    segInit('sScale', [[0.9, 'Klein'], [1, 'Normal'], [1.15, 'Groß'], [1.3, 'Sehr groß']], () => SET.scale, v => { SET.scale = v; applySet(); savePrefs(); });
    segInit('sSpeed', [[0.75, 'Langsam'], [1, 'Normal'], [1.5, 'Schnell'], [2, 'Sehr schnell']], () => SET.speed, v => { SET.speed = v; applySet(); savePrefs(); });
    segInit('sBars', [['auto', 'Bei Schaden'], ['all', 'Immer']], () => SET.bars, v => { SET.bars = v; applySet(); savePrefs(); });
    segInit('sVoice', [[true, 'An'], [false, 'Aus']], () => SET.voice !== false, v => { SET.voice = v; savePrefs(); if (v) VOX.test(); else VOX.stop(); });   /* Runde 18 */
    segInit('sGfx', [['3d', '3D'], ['2d', '2D']], () => SET.gfx || '3d', v => { SET.gfx = v; applySet(); savePrefs(); if (v === '3d' && !R.mode3d) toast(L('3D ist auf diesem Gerät nicht verfügbar – es bleibt bei 2D.'), 'warn', 4000); });
    segInit('sQual', [['auto', 'Hoch'], ['low', 'Sparsam']], () => SET.qual, v => { SET.qual = v; applySet(); savePrefs(); });
    segInit('sLang', [['de', 'Deutsch'], ['en', 'English']], () => SET.lang, v => { SET.lang = v; savePrefs(); setLang(v); langRefresh(); seg(); });
  };
  seg();
  $('sClose').addEventListener('click', closeSettings);
  $('mSettings').addEventListener('click', () => { seg(); $('settings').hidden = false; SND.play('click'); });
  $('pSettings').addEventListener('click', () => { seg(); $('settings').hidden = false; SND.play('click'); });
}
/* nach dem Sprachwechsel: alles neu beschriften, was gerade zu sehen ist */
function langRefresh() {
  menuRender();
  if (UI.mPage === 'setup') setupRender();
  if (UI.mPage === 'camp') campRender();
  if (MISUI.brief && !$('brief').hidden) openBrief(MISUI.brief);
  if (UI.cqOpen) { if (CQS.C && !$('cqMapPane').hidden) cqPanel(); else if (!$('cqSetup').hidden) cqShowSetup(); }
  if (UI.g && !UI.attract) { hudCmds(true); hudBuild(true); hudSel(); MISUI.gh = ''; misUiHud(); if (UI.paused) setPaused(true); }
  applyLang();
}
function closeSettings() { $('settings').hidden = true; SND.play('click'); }
/* Aufstellung im Hauptmenü */
/* Sprachwahl ganz oben im Hauptmenü (dieselbe Einstellung wie unter Einstellungen) */
function homeLang() { if (!$('homeLang')) return; segInit('homeLang', [['de', 'Deutsch'], ['en', 'English']], () => SET.lang, v => { SET.lang = v; savePrefs(); setLang(v); langRefresh(); }); }
function menuPage(p) { UI.mPage = p; $('pHome').hidden = p !== 'home'; $('setup').hidden = p !== 'setup'; $('pCamp').hidden = p !== 'camp'; if (p !== 'camp') closeBrief(); if (p === 'setup') setupRender(); if (p === 'camp') campRender(); }
/* Startplatz-Reihenfolge je Spieler: Platz 0 (du) auf MENU.myStart, falls gesetzt; sonst Zufall bei Spielstart */
function startOrder(np) {
  /* automatisierte Tests (webdriver): fester Platz 1, damit Abläufe reproduzierbar bleiben */
  const auto = typeof navigator !== 'undefined' && navigator.webdriver && MENU.myStart === undefined;
  let mine = MENU.myStart >= 0 && MENU.myStart < np ? MENU.myStart : auto ? 0 : (Math.random() * np) | 0;
  const rest = []; for (let k = 0; k < np; k++) if (k !== mine) rest.push(k);
  return [mine].concat(rest);
}
/* Farben der Startplätze in der Vorschau: bei gewähltem Platz die tatsächliche Verteilung, sonst der Reihe nach */
function previewCols(pm) {
  const list = slotPlayers(), cols = list.map(q => q.color || FACTIONS[q.faction === 'random' ? 'guardian' : q.faction].team);
  if (!(MENU.myStart >= 0 && MENU.myStart < list.length)) return cols;
  const order = startOrder(list.length), out = []; order.forEach((si, i) => { out[si] = cols[i]; }); return out;
}
function startPick(ev) {
  const pm = UI.prevMap, cv = $('mapPrev'); if (!pm || MENU.mode !== 'skirmish') return;
  const r = cv.getBoundingClientRect(), px = (ev.clientX - r.left) * cv.width / r.width, py = (ev.clientY - r.top) * cv.height / r.height;
  const i = mapStartAt(cv, pm, px, py, 28); if (i < 0 || i >= slotPlayers().length) return;
  MENU.myStart = MENU.myStart === i ? -1 : i; savePrefs(); SND.play('click'); setupRender();
}
function setupRender() {
  segInit('modeSeg', [['skirmish', 'Gefecht'], ['survival', 'Rift Survival'], ['quarantine', 'Quarantine Line']], () => MENU.mode, v => { MENU.mode = v; savePrefs(); setupRender(); });
  const wv = MENU.mode !== 'skirmish';
  $('rowMap').hidden = wv; $('rowAllies').hidden = MENU.mode !== 'quarantine';
  setText('setupTitle', L(MENU.mode === 'survival' ? 'Rift Survival' : MENU.mode === 'quarantine' ? 'Quarantine Line' : 'Gefecht'));
  segInit('alliesSeg', [[0, '0'], [1, '1'], [2, '2'], [3, '3']], () => MENU.allies, v => { MENU.allies = v; savePrefs(); setupRender(); });
  segInit('allyLvlSeg', [[1, 'Leicht'], [2, 'Mittel'], [3, 'Schwer']], () => MENU.allyLvl, v => { MENU.allyLvl = v; savePrefs(); });
  const fc = $('facCards'); fc.textContent = '';
  for (const f of PLAYABLE) { const F = FACTIONS[f], c = document.createElement('button'); c.className = 'card' + (MENU.faction === f ? ' on' : ''); c.style.setProperty('--fc', F.team); c.innerHTML = '<h4 style="color:' + F.team + '">' + esc(F.name) + '</h4><p>' + esc(L(F.desc)) + '</p>'; c.addEventListener('click', () => { MENU.faction = f; savePrefs(); SND.play('click'); setupRender(); }); fc.appendChild(c); }
  slotsFix();
  const np = slotPlayers().length, mapId = mapFor(MENU.map, np);
  $('rowSize').hidden = wv || !!MAPS[mapId].layout; $('rowSlots').hidden = wv; $('slotNote').hidden = wv;   /* KARTENEDITOR: eigene Karten ohne Größenwahl */
  /* Karten mit Spielerzahl; Karten, die für die aktuelle Zahl nicht ausgelegt sind, erscheinen gedimmt */
  const npTxt = a => a.every((v, i) => !i || v === a[i - 1] + 1) && a.length > 1 ? a[0] + '–' + a[a.length - 1] : a.join('/');
  /* KARTENEDITOR: eigene Karten (editor.js) hinter den eingebauten */
  segInit('mapSeg', MAP_ORDER.concat(edMapIds()).map(k => [k, MAPS[k].name, npTxt(MAPS[k].np), MAPS[k].np.indexOf(np) < 0 ? 'na' : '']), () => MENU.map, v => { MENU.map = v; savePrefs(); setupRender(); });
  segInit('sizeSeg', [['small', 'Klein'], ['normal', 'Mittel'], ['large', 'Groß']], () => MENU.size || 'normal', v => { MENU.size = v; savePrefs(); setupRender(); });
  if (MENU.mode === 'skirmish') { const n = slotPlayers().length; setText('startNote', MENU.myStart >= 0 && MENU.myStart < n ? L('Dein Startplatz: {0}. Erneut antippen für Zufall.', MENU.myStart + 1) : L('Startplatz: Zufall. Tippe in der Vorschau auf einen Startplatz, um ihn zu wählen.')); } else setText('startNote', '');
  segInit('paceSeg', [['tactical', 'Taktisch'], ['normal', 'Normal'], ['fast', 'Schnell']], () => MENU.pace || 'tactical', v => { MENU.pace = v; savePrefs(); toast(L(v === 'tactical' ? 'Taktisch: lange Gefechte, Zeit für Rückzug, Flanken und Subsysteme' : v === 'normal' ? 'Normal: Gefechte etwa halb so lang wie Taktisch' : 'Schnell: Schiffe fallen in Sekunden')); });
  segInit('resSeg', [['low', 'Knapp'], ['normal', 'Normal'], ['rich', 'Reich']], () => MENU.res, v => { MENU.res = v; savePrefs(); });
  slotsRender();
  setText('slotNote', (mapId !== MENU.map ? L('{0} ist für {1} Spieler nicht ausgelegt – es wird {2} gespielt.', MAPS[MENU.map].name, np, MAPS[mapId].name) + ' ' : '') + L('Tippen wechselt Fraktion, Stärke und Team. Gleiches Team = Verbündete; »–« spielt für sich.'));
  if (MENU.mode === 'survival') setText('mapDesc', L('Allein gegen endlose Wellen der Brood. Nach jeder Welle eine von drei Belohnungen, alle fünf Wellen ein Leviathan. Rekord mit {0}: Welle {1}.', L(FACTIONS[MENU.faction].name), bestWave(MENU.faction)));
  else if (MENU.mode === 'quarantine') setText('mapDesc', L('Gemeinsam das Siegel in der Kartenmitte halten: 20 Wellen der Brood aus immer mehr Rissen, alle fünf ein Leviathan, zuletzt die Matriarch. Fällt das Siegel, haben alle verloren.'));
  else { const pm0 = generateMap(mapId, np, 7, MENU.size); setText('mapDesc', L(MAPS[mapId].desc) + ' · ' + L('{0} Spieler', np) + ' · ' + pm0.w + ' × ' + pm0.h); }
  /* Kartenvorschau: Layout der gewählten Karte (Gefecht) bzw. der Wellenkarte, Startplätze in den Spielerfarben */
  const pm = MENU.mode === 'skirmish' ? generateMap(mapId, np, 7, MENU.size) : MENU.mode === 'quarantine' ? generateMap('quarantine', MENU.allies + 1, 7) : null;
  $('rowPrev').hidden = !pm; $('mapLegend').hidden = !pm;
  UI.prevMap = pm;
  if (!UI.prevPickOn) { $('mapPrev').addEventListener('click', startPick); UI.prevPickOn = 1; }
  if (pm) { const cv = $('mapPrev'), side = Math.round(360 * Math.min(1, pm.w / pm.h)), tall = Math.round(360 * Math.min(1, pm.h / pm.w)); cv.width = side; cv.height = tall; cv.style.aspectRatio = side + ' / ' + tall; mapLayout(cv, pm, { mine: MENU.mode === 'skirmish' && MENU.myStart >= 0 && MENU.myStart < pm.starts.length ? MENU.myStart : -1, starts: MENU.mode === 'skirmish' ? previewCols(pm) : [FACTIONS[MENU.faction].team] }); setText('mapLegend', mapLegend(pm)); }
}
/* ---------- Spielerplätze im Gefecht: Platz 0 bist du, bis zu sieben KI-Plätze mit Fraktion (oder Zufall), Stärke und Team ---------- */
const SLOT_FACS = ['random'].concat(PLAYABLE);
const SLOT_COLS = ['#4fa3ff', '#ff6a3d', '#f2c14e', '#c9a0ff', '#5ddc8a', '#ff7bd1', '#4fe3e3', '#f4f1e6'];
function slotsFix() {
  if (!Array.isArray(MENU.slots) || MENU.slots.length !== 7) MENU.slots = [{ f: MENU.oppF && MENU.oppF !== 'random' && PLAYABLE.indexOf(MENU.oppF) >= 0 ? MENU.oppF : 'random', lvl: MENU.lvl || 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 })));
  if (!MENU.slots.some(q => q.f !== 'off')) MENU.slots[0].f = 'random';
  if (MENU.team === undefined) MENU.team = 0;
}
/* Spielerliste aus den Plätzen: Fraktion »random« wird erst beim Start gezogen; Farben: Fraktionsfarbe, solange jede Fraktion
   nur einmal vorkommt, sonst feste Platzfarben */
function slotPlayers() {
  const list = [{ faction: MENU.faction, human: true, team: MENU.team, slot: 0 }];
  MENU.slots.forEach((q, i) => { if (q.f !== 'off') list.push({ faction: q.f, ai: q.lvl, team: q.team, slot: i + 1 }); });
  const facs = list.map(q => q.faction), dup = list.length > 4 || facs.some((f, i) => f === 'random' || facs.indexOf(f) !== i);
  list.forEach((q, i) => { if (dup) q.color = SLOT_COLS[i]; });
  return list;
}
function slotsRender() {
  const box = $('slots'); box.textContent = '';
  const facName = f => f === 'random' ? L('Zufall') : f === 'off' ? L('Aus') : FACTIONS[f].name.replace('The ', '').replace('Martian ', '').replace('Golden ', '');
  const teamName = t => t ? L('Team') + ' ' + t : '–';
  const row = (who, me) => { const el = document.createElement('div'); el.className = 'slot'; const w = document.createElement('button'); w.textContent = who; w.className = me ? 'me' : ''; w.disabled = true; el.appendChild(w); return el; };
  const btn = (el, cls, txt, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.addEventListener('click', () => { fn(); SND.play('click'); savePrefs(); setupRender(); }); el.appendChild(b); return b; };
  const r0 = row(L('Du'), true); btn(r0, 'fac', facName(MENU.faction), () => {}).disabled = true; btn(r0, 'tm', teamName(MENU.team), () => { MENU.team = (MENU.team + 1) % 5; }); box.appendChild(r0);
  MENU.slots.forEach((q, i) => {
    const el = row(L('KI') + ' ' + (i + 1)); if (q.f === 'off') el.classList.add('off');
    btn(el, 'fac', facName(q.f), () => { const order = ['off'].concat(SLOT_FACS); q.f = order[(order.indexOf(q.f) + 1) % order.length]; });
    if (q.f !== 'off') { btn(el, 'lvl', L(['', 'Leicht', 'Mittel', 'Schwer'][q.lvl]), () => { q.lvl = q.lvl % 3 + 1; }); btn(el, 'tm', teamName(q.team), () => { q.team = (q.team + 1) % 5; }); }
    box.appendChild(el);
  });
}
function bestWave(f) { try { const d = JSON.parse(localStorage.getItem('ra.best') || '{}'); return d[f] || 0; } catch (e) { return 0; } }
function setBestWave(f, n) { try { const d = JSON.parse(localStorage.getItem('ra.best') || '{}'); if (n > (d[f] || 0)) { d[f] = n; localStorage.setItem('ra.best', JSON.stringify(d)); return true; } } catch (e) { /* Speicher gesperrt */ } return false; }
/* Belohnungskarten nach einer Welle: derselbe Kartendialog wie Doktrin und Archiv */
function openReward() {
  const P = UI.P;
  if (!P || !P.rewardAsk || !P.rewardOpts || !$('doctrine').hidden) return;
  $('docIntro').textContent = L('Welle {0} abgewehrt. Wähle eine Belohnung.', UI.g.wave.cleared);
  document.querySelector('#doctrine h2').textContent = L('Belohnung');
  const box = $('docCards'); box.textContent = '';
  UI.docPick = null; $('docConfirm').hidden = true; UI.rewardMode = true;
  for (const id of P.rewardOpts) {
    const d = REWARDS.find(r => r.id === id), el = document.createElement('div'); el.className = 'dcard';
    const n = (P.rewards || []).filter(x => x === id).length;
    el.innerHTML = '<h4><span>' + esc(L(d.name)) + '</span><small>' + (n ? n + '×' : L('Neu')) + '</small></h4><p>' + esc(L(d.desc)) + '</p>';
    el.addEventListener('click', () => { UI.docPick = id; box.querySelectorAll('.dcard').forEach(x => x.classList.toggle('on', x === el)); const c = $('docConfirm'); c.hidden = false; c.textContent = L('{0} nehmen', L(d.name)); SND.play('click'); });
    box.appendChild(el);
  }
  $('docLater').hidden = true;
  $('doctrine').hidden = false; UI.slow = UI.kind !== 'mp';
}
/* Lade-Fenster: automatische Sicherung und drei Plätze mit Karte, Fraktion, Spielzeit und Datum */
function slotLine(d) {
  if (!d) return { t: L('Leer'), s: '' };
  const m = d.meta || {}, F = FACTIONS[m.fac], mins = Math.floor((m.t || 0) / 60), MIN = ' min' + ' · ', date = new Date(m.date || (d.ui && d.ui.t) || Date.now());
  const kind = { skirmish: 'Gefecht', sandbox: 'Übungsplatz', waves: 'Wellen', mis: 'Kampagne', cq: 'Conquest' }[m.kind || (d.ui && d.ui.kind)] || 'Gefecht';
  return { t: (m.map ? L(m.map) : L(kind)) + (F ? ' · ' + L(F.name) : ''), s: L(kind) + ' · ' + mins + MIN + date.toLocaleDateString(I18N.lang === 'en' ? 'en-GB' : 'de-AT') + ' ' + date.toLocaleTimeString(I18N.lang === 'en' ? 'en-GB' : 'de-AT', { hour: '2-digit', minute: '2-digit' }) };
}
function openLoad() {
  const box = $('loadList'); box.textContent = '';
  const add = (title, d, onLoad, onDel) => {
    const row = document.createElement('div'); row.className = 'slotRow' + (d ? '' : ' empty'); const ln = slotLine(d);
    row.innerHTML = '<div class="info"><b></b><small></small></div>'; row.querySelector('b').textContent = title + ' — ' + ln.t; row.querySelector('small').textContent = ln.s;
    if (d) { const b = document.createElement('button'); b.className = 'key arm'; b.textContent = L('Laden'); b.addEventListener('click', () => { $('loadWin').hidden = true; launch(onLoad); }); row.appendChild(b); const x = document.createElement('button'); x.className = 'key'; x.textContent = '✕'; x.title = L('Löschen'); x.addEventListener('click', () => { onDel(); SND.play('click'); openLoad(); menuRender(); }); row.appendChild(x); }
    box.appendChild(row);
  };
  add(L('Automatisch'), readSave(), () => continueGame(), clearSave);
  for (const n of [1, 2, 3]) add(L('Platz {0}', n), readSlot(n), () => continueGame(n), () => clearSlot(n));
  $('loadWin').hidden = false;
}
/* Pausenmenü: Speicherplätze beschriften (belegt mit Spielzeit), Zeile nur, wo Speichern geht */
function pauseSlots() {
  const okKind = UI.kind === 'skirmish' || UI.kind === 'sandbox' || UI.kind === 'waves';
  $('pSaveRow').hidden = !okKind;
  if (!okKind) return;
  for (const n of [1, 2, 3]) { const d = readSlot(n); setText('pSave' + n, L('Platz {0}', n) + (d && d.meta ? ' · ' + Math.floor((d.meta.t || 0) / 60) + ' min' : ' · ' + L('leer'))); }
}
function menuRender() {
  const d = readSave();
  $('mCont').hidden = !(d && d.game);
  homeLang();
  /* Neu hier: Hinweis auf die Ausbildung */
  const n = $('mNote');
  if (typeof CAMP !== 'undefined' && !CAMP.done.tut && !Object.keys(CAMP.done).length && (n.hidden || n.dataset.tut)) { n.dataset.tut = 1; n.hidden = false; n.innerHTML = esc(L('Neu hier?')) + ' <button class="key" id="mTut">' + esc(L('Ausbildung')) + '</button> ' + esc(L('zeigt die Bedienung in zehn Minuten.')); $('mTut').onclick = () => { SND.init(); SND.play('click'); menuPage('camp'); openBrief('tut'); }; }
  else if (n.dataset.tut) { n.hidden = true; delete n.dataset.tut; }
  menuPage(UI.mPage === 'setup' || UI.mPage === 'camp' ? UI.mPage : 'home');
}
function initHudStatic() {
  bindHold($('bPause'), () => setPaused(!UI.paused), null);
  bindHold($('bRange'), toggleRange, () => '<h4>' + L('Reichweiten') + '</h4><p>' + L('Zeigt Reichweite und Schussfeld der gewählten Schiffe.') + '</p>');
  document.querySelectorAll('.grp').forEach(el => bindHold(el, () => grpSelect(+el.dataset.g), null, () => grpAssign(+el.dataset.g)));
  $('pResume').addEventListener('click', () => setPaused(false));
  $('pHelp').addEventListener('click', () => { $('help').hidden = false; });
  $('mHelp').addEventListener('click', () => { $('help').hidden = false; SND.play('click'); });
  $('helpClose').addEventListener('click', () => { $('help').hidden = true; SND.play('click'); });
  $('docLater').addEventListener('click', () => { closeDoctrine(); toast(L('Die Doktrin wählst du später über die Kommandobasis'), '', 3000); SND.play('click'); });
  $('docConfirm').addEventListener('click', confirmDoctrine);
}
