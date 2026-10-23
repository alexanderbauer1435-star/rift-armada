/* ===== cqui.js ===== */
'use strict';
/* =====================================================================
   CONQUEST (Oberfläche) – Auswahl der Fraktion, Sektorkarte des Kessels (Canvas), Systemkarte mit Taten, Berater,
   Bedrohungen, Flotte; Lagebericht, Kapitel, Entscheidungen, Logbücher und Enden als Fenster nacheinander;
   Schlachten als Partie der Art »cq«, danach zurück auf die Karte.
   ===================================================================== */
const CQS = { C: null, sel: -1, t: 0, cv: null, ctx: null, W: 0, H: 0, k: 1, ox: 0, oy: 0, stars: null, evq: [], ev: null, lvl: 2, fac: 'alliance', drawT: 0 };
const CQ_KCOL = { pir: '#c9493c', brood: '#8be04a', seal: '#5f8f7a', guard: '#9ff0c0', '': '#667' };
function cqCol(o) { return FACTIONS[o] && CQ_FACS.indexOf(o) >= 0 ? FACTIONS[o].team : CQ_KCOL[o] || '#888'; }
function cqFN(o) { return L(cqOwnerName(o)); }
function cqWho(C, x) { return x === 'a' ? CQ_ADV[C.fac][0] : x === 'b' ? CQ_ADV[C.fac][1] : x; }
function cqRecLoad() { try { return JSON.parse(localStorage.getItem('ra.cqrec') || '{}') || {}; } catch (e) { return {}; } }
function cqRecAdd(fac, ending) { try { const r = cqRecLoad(); r[fac] = r[fac] || {}; r[fac][ending] = 1; localStorage.setItem('ra.cqrec', JSON.stringify(r)); } catch (e) { /* egal */ } }

/* ------------------------------------------------------------------ Öffnen, Auswahl */
function cqOpen() {
  UI.cqOpen = true;
  $('conq').hidden = false;
  CQS.C = cqLoad();
  if (CQS.C && !CQS.C.over) cqShowMap(); else cqShowSetup();
}
function cqClose() {
  UI.cqOpen = false;
  $('conq').hidden = true; $('cqEv').hidden = true; $('cqMenuWin').hidden = true;
  MUS.start('menu');
  menuRender();
}
function cqShowSetup() {
  $('cqSetup').hidden = false; $('cqMapPane').hidden = true;
  const C = cqLoad();
  $('cqCont').hidden = !(C && !C.over);
  $('cqSaveNote').hidden = !(C && !C.over);
  if (C && !C.over) $('cqSaveNote').textContent = L('Laufender Feldzug: {0}, Runde {1}. Ein neuer Feldzug ersetzt ihn.', cqFN(C.fac), C.turn);
  const fc = $('cqFacs'); fc.textContent = '';
  for (const f of CQ_FACS) {
    const F = FACTIONS[f], b = document.createElement('button');
    b.className = 'card' + (CQS.fac === f ? ' on' : ''); b.style.setProperty('--fc', F.team);
    b.innerHTML = '<h4 style="color:' + F.team + '">' + esc(F.name) + '</h4><p>' + esc(L(CQ_CAPS[f].name)) + ' · ' + esc(L(CHARS[CQ_ADV[f][0]].name)) + ' ' + L('gegen') + ' ' + esc(L(CHARS[CQ_ADV[f][1]].name)) + '</p>';
    b.addEventListener('click', () => { CQS.fac = f; SND.play('click'); cqShowSetup(); });
    fc.appendChild(b);
  }
  segInit('cqLvl', [[1, 'Leicht'], [2, 'Normal'], [3, 'Schwer']], () => CQS.lvl, v => { CQS.lvl = v; });
  const rec = cqRecLoad(), lines = [];
  const ENDN = { dom: 'Herrschaft', seal: 'Siegel', open: 'Jenseits der Tore' };
  for (const f of CQ_FACS) if (rec[f]) lines.push(cqFN(f) + ': ' + Object.keys(rec[f]).filter(k => ENDN[k]).map(k => L(ENDN[k])).join(', '));
  $('cqRec').hidden = !lines.length; $('cqRec').textContent = lines.length ? L('Erreichte Enden') + ' – ' + lines.join(' · ') : '';
}
function cqNewCampaign() {
  CQS.C = cqNew(CQS.fac, CQS.lvl, 1 + ((Math.random() * 1e9) | 0));
  CQS.sel = cqCap(CQS.C, CQS.fac).id;
  cqSave(CQS.C);
  cqShowMap();
}
/* ------------------------------------------------------------------ Karte */
function cqShowMap() {
  const C = CQS.C;
  $('cqSetup').hidden = true; $('cqMapPane').hidden = false;
  $('conq').style.setProperty('--fc', cqCol(C.fac));
  if (CQS.sel < 0 || !C.sys[CQS.sel]) CQS.sel = cqCap(C, C.fac).id;
  CQS.cv = $('cqMap'); CQS.ctx = CQS.cv.getContext('2d');
  cqResize();
  cqPanel();
  MUS.start(C.fac, true);
  /* offene Schlacht aus einer früheren Sitzung */
  if (C.pending) { cqPendingAsk(); return; }
  cqEvNext();
}
function cqResize() {
  const cv = CQS.cv, r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!r.width || !r.height) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  CQS.W = r.width; CQS.H = r.height; CQS.dpr = dpr;
  const k = Math.min(r.width / (CQ_W + 40), r.height / (CQ_H + 30));
  CQS.k = k; CQS.ox = (r.width - CQ_W * k) / 2; CQS.oy = (r.height - CQ_H * k) / 2;
  if (!CQS.stars) { const R = makeRng(4711); CQS.stars = Array.from({ length: 220 }, () => [R() * CQ_W, R() * CQ_H, R()]); }
}
function cqToScreen(x, y) { return [CQS.ox + x * CQS.k, CQS.oy + y * CQS.k]; }
function cqFrame(dt) {
  if (!CQS.C || $('cqMapPane').hidden) return;
  CQS.t += dt;
  if (CQS.t - CQS.drawT < 0.033) return;
  CQS.drawT = CQS.t;
  const cv = CQS.cv, r = cv.getBoundingClientRect();
  if (Math.abs(r.width - CQS.W) > 1 || Math.abs(r.height - CQS.H) > 1) cqResize();
  cqDraw();
}
function cqDraw() {
  const C = CQS.C, c = CQS.ctx, k = CQS.k, t = CQS.t, dpr = CQS.dpr || 1;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#04060d'; c.fillRect(0, 0, CQS.W, CQS.H);
  c.save(); c.translate(CQS.ox, CQS.oy); c.scale(k, k);
  /* Kessel: Nebel, Aschenrand, Sterne */
  const neb = c.createRadialGradient(500, 340, 40, 500, 340, 520);
  neb.addColorStop(0, 'rgba(60,40,90,0.35)'); neb.addColorStop(0.55, 'rgba(25,30,60,0.25)'); neb.addColorStop(0.85, 'rgba(120,40,20,0.22)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = neb; c.beginPath(); c.ellipse(500, 340, 520, 360, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(160,60,30,0.35)'; c.lineWidth = 14; c.beginPath(); c.ellipse(500, 340, 500, 345, 0, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,120,60,0.18)'; c.lineWidth = 2; c.beginPath(); c.ellipse(500, 340, 488, 335, 0, 0, TAU); c.stroke();
  for (const [x, y, b] of CQS.stars) { c.fillStyle = 'rgba(220,230,255,' + (0.15 + 0.5 * b * (0.7 + 0.3 * Math.sin(t * 1.3 + x))) + ')'; c.fillRect(x, y, 1.3, 1.3); }
  /* Verbindungen (Größen in Bildschirmpunkten: u = Welt je Punkt) */
  const u = 1 / k, S = C.sys, targ = new Set(cqTargets(C)), thr = new Set(C.threats.map(x => x.sys));
  for (const [a, b] of C.links) {
    const A = S[a], B = S[b], same = A.owner === B.owner && CQ_FACS.indexOf(A.owner) >= 0;
    c.strokeStyle = same ? prgba(cqCol(A.owner), 0.55) : 'rgba(150,170,200,0.25)'; c.lineWidth = (same ? 2.2 : 1.3) * u;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
  }
  /* Sprungnetz der Tore, wenn der Spieler ein Torsystem hält */
  const myGates = S.filter(s => s.type === 'gate' && s.owner === C.fac);
  if (myGates.length) {
    c.setLineDash([6 * u, 7 * u]); c.lineDashOffset = -t * 14 * u; c.strokeStyle = 'rgba(159,240,192,0.45)'; c.lineWidth = 1.4 * u;
    for (const g0 of myGates) for (const s of S) if (s.type === 'gate' && s.owner !== C.fac) { c.beginPath(); c.moveTo(g0.x, g0.y); c.lineTo(s.x, s.y); c.stroke(); }
    c.setLineDash([]);
  }
  const rad = s => (s.type === 'cap' ? 14 : s.type === 'core' ? 16 : s.type === 'secret' ? 12 : 11) * u;
  /* Bedrohungen: Pfeil vom Angreifer */
  for (const th of C.threats) {
    const s = S[th.sys], from = s.links.map(j => S[j]).find(x => x.owner === th.by) || null;
    if (!from) continue;
    const a = Math.atan2(s.y - from.y, s.x - from.x), pulse = 0.5 + 0.5 * Math.sin(t * 5), ex = s.x - Math.cos(a) * (rad(s) + 8 * u), ey = s.y - Math.sin(a) * (rad(s) + 8 * u);
    c.strokeStyle = c.fillStyle = 'rgba(255,91,71,' + (0.5 + 0.4 * pulse) + ')'; c.lineWidth = 3 * u;
    c.beginPath(); c.moveTo(from.x + Math.cos(a) * rad(from), from.y + Math.sin(a) * rad(from)); c.lineTo(ex, ey); c.stroke();
    c.beginPath(); c.moveTo(ex + Math.cos(a) * 8 * u, ey + Math.sin(a) * 8 * u); c.lineTo(ex + Math.cos(a + 2.5) * 9 * u, ey + Math.sin(a + 2.5) * 9 * u); c.lineTo(ex + Math.cos(a - 2.5) * 9 * u, ey + Math.sin(a - 2.5) * 9 * u); c.closePath(); c.fill();
  }
  /* Systeme */
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const s of S) {
    const r = rad(s), col = cqCol(s.owner), mine = s.owner === C.fac;
    if (s.owner === 'brood') { c.strokeStyle = 'rgba(139,224,74,0.5)'; c.lineWidth = 1.6 * u; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.3 + s.id, w = Math.sin(t * 2 + i) * 3 * u; c.beginPath(); c.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); c.quadraticCurveTo(s.x + Math.cos(a + 0.3) * (r + 7 * u) + w, s.y + Math.sin(a + 0.3) * (r + 7 * u), s.x + Math.cos(a) * (r + 12 * u), s.y + Math.sin(a) * (r + 12 * u)); c.stroke(); } }
    if (s.type === 'core' && C.crisis > 0) { const R2 = r * 3.2, g2 = c.createRadialGradient(s.x, s.y, 2, s.x, s.y, R2); g2.addColorStop(0, 'rgba(180,255,60,' + (0.35 + 0.2 * Math.sin(t * 3)) + ')'); g2.addColorStop(1, 'rgba(80,20,120,0)'); c.fillStyle = g2; c.beginPath(); c.arc(s.x, s.y, R2, 0, TAU); c.fill(); }
    if (mine) { const R2 = r * 2.2, g3 = c.createRadialGradient(s.x, s.y, r * 0.5, s.x, s.y, R2); g3.addColorStop(0, prgba(col, 0.35)); g3.addColorStop(1, prgba(col, 0)); c.fillStyle = g3; c.beginPath(); c.arc(s.x, s.y, R2, 0, TAU); c.fill(); }
    const gl = c.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, 1, s.x, s.y, r);
    gl.addColorStop(0, pshade(col, 0.45)); gl.addColorStop(1, pshade(col, -0.45));
    c.fillStyle = gl; c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.fill();
    c.strokeStyle = mine ? '#ffffff' : 'rgba(0,0,0,0.6)'; c.lineWidth = (mine ? 2 : 1.2) * u; c.stroke();
    if (targ.has(s.id)) { c.strokeStyle = 'rgba(143,227,255,' + (0.45 + 0.35 * Math.sin(t * 4)) + ')'; c.lineWidth = 2 * u; c.setLineDash([5 * u, 4 * u]); c.lineDashOffset = -t * 10 * u; c.beginPath(); c.arc(s.x, s.y, r + 5 * u, 0, TAU); c.stroke(); c.setLineDash([]); }
    if (thr.has(s.id)) { c.strokeStyle = 'rgba(255,91,71,' + (0.6 + 0.4 * Math.sin(t * 6)) + ')'; c.lineWidth = 3 * u; c.beginPath(); c.arc(s.x, s.y, r + 8 * u, 0, TAU); c.stroke(); }
    if (s.id === CQS.sel) { c.strokeStyle = '#ffffff'; c.lineWidth = 2 * u; c.beginPath(); c.arc(s.x, s.y, r + 11 * u, 0, TAU); c.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t; c.beginPath(); c.moveTo(s.x + Math.cos(a) * (r + 13 * u), s.y + Math.sin(a) * (r + 13 * u)); c.lineTo(s.x + Math.cos(a) * (r + 18 * u), s.y + Math.sin(a) * (r + 18 * u)); c.stroke(); } }
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.font = '700 ' + (r * 1.05) + 'px ' + FONT; c.fillText(CQ_TYPES[s.type] ? CQ_TYPES[s.type].icon : '', s.x, s.y + r * 0.06);
    /* Garnison (Punkte) oder Befestigung (Striche) */
    const pips = mine ? s.fort : s.owner === 'seal' ? 0 : s.gar;
    for (let i = 0; i < pips; i++) { const px = s.x - (pips - 1) * 3.5 * u + i * 7 * u, py = s.y + r + 4.5 * u; c.fillStyle = mine ? '#ffb86b' : 'rgba(230,238,246,0.85)'; if (mine) c.fillRect(px - 2.5 * u, py - 1.5 * u, 5 * u, 3 * u); else { c.beginPath(); c.arc(px, py, 1.8 * u, 0, TAU); c.fill(); } }
    if (s.log >= 0 && C.logs.indexOf(s.log) < 0) { const lx = s.x + r * 0.85, ly = s.y - r * 0.85; c.fillStyle = '#c9a0ff'; c.beginPath(); c.moveTo(lx, ly - 4 * u); c.lineTo(lx + 3.5 * u, ly); c.lineTo(lx, ly + 4 * u); c.lineTo(lx - 3.5 * u, ly); c.closePath(); c.fill(); }
    c.font = (s.type === 'cap' || s.type === 'core' ? '700 ' : '600 ') + (11 * u) + 'px ' + FONT;
    const ly = s.y + r + (pips ? 13 : 9) * u;
    c.lineWidth = 3 * u; c.strokeStyle = 'rgba(2,4,10,0.85)'; c.strokeText(L(s.name), s.x, ly);
    c.fillStyle = mine ? '#ffffff' : 'rgba(220,230,240,0.85)'; c.fillText(L(s.name), s.x, ly);
  }
  c.restore();
}
function cqTap(ev) {
  const r = CQS.cv.getBoundingClientRect(), x = (ev.clientX - r.left - CQS.ox) / CQS.k, y = (ev.clientY - r.top - CQS.oy) / CQS.k;
  let best = -1, bd = 40 / Math.max(0.6, CQS.k);
  for (const s of CQS.C.sys) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.id; } }
  if (best >= 0 && best !== CQS.sel) { CQS.sel = best; SND.play('click'); cqPanel(); }
}
/* Seitenleiste: System, Berater, Bedrohungen, Flotte; Kopfzeile */
function cqPanel() {
  const C = CQS.C, s = C.sys[CQS.sel], TY = CQ_TYPES[s.type], targ = cqTargets(C), mine = s.owner === C.fac, th = C.threats.find(x => x.sys === s.id);
  setText('cqTitle', L('Runde {0}', C.turn) + ' · ' + cqFN(C.fac));
  const own = cqMine(C).length, rank = cqFlagRank(C), cease = Object.keys(C.cease).filter(f => C.cease[f] > 0);
  $('cqStats').innerHTML = '<span><b>' + own + '</b>/' + C.sys.length + ' ' + L('Systeme') + '</span><span class="opt">◆ <b>' + C.logs.length + '</b>/' + CQ_LOGS.length + ' ' + L('Logbücher') + '</span><span>⚑ <b>' + esc(L(RANK_NAMES[rank] || 'Rekrut')) + '</b></span><span class="opt">' + L('Veteranen') + ' <b>' + C.vets.length + '</b></span>' + (C.crisis > 0 ? '<span style="color:#8be04a">☣ ' + L('Krise') + '</span>' : '') + (cease.length ? '<span class="cease">' + L('Waffenstillstand') + ': ' + cease.map(f => esc(cqFN(f))).join(', ') + '</span>' : '');
  let h = '<h3><span style="color:' + cqCol(s.owner) + '">' + esc(L(s.name)) + '</span><small>' + esc(L(TY.name)) + '</small></h3>';
  h += '<div class="sub">' + (mine ? L('Dein System') : L('Gehört') + ': ' + esc(L(cqOwnerName(s.owner)))) + (C.cease[s.owner] > 0 ? ' · ' + L('Waffenstillstand') : '') + (s.owner && CQ_FACS.indexOf(s.owner) >= 0 && !mine ? ' · ' + L('Haltung {0}', C.rel[s.owner] > 10 ? L('freundlich') : C.rel[s.owner] < -30 ? L('feindselig') : L('kühl')) : '') + '</div>';
  h += '<div class="bonus">' + esc(L(TY.bonus)) + '</div>';
  if (s.owner !== 'seal') h += '<div class="pips">' + (mine ? '<span>' + L('Befestigung') + ' <b>' + '■'.repeat(s.fort) + '□'.repeat(3 - s.fort) + '</b></span>' : '<span>' + L('Garnison') + ' <b>' + '●'.repeat(s.gar) + '○'.repeat(Math.max(0, 3 - s.gar)) + '</b></span>') + '</div>';
  if (s.log >= 0 && C.logs.indexOf(s.log) < 0) h += '<div class="note">◆ ' + L('Hier liegt ein Logbuch der Erbauer.') + '</div>';
  if (th) h += '<div class="warn">⚠ ' + L('{0} greift an (Stärke {1}). Ohne Abwehr entscheidet die Befestigung.', cqFN(th.by), th.pow.toFixed(1)) + '</div>';
  if (s.type === 'core' && targ.indexOf(s.id) < 0) h += '<div class="note">' + L(C.crisis > 0 ? 'Die Matriarch sammelt ihre Schwärme. Bald ruft das Haupttor – dann ist es von überall erreichbar.' : 'Versiegelt seit der Stille.') + '</div>';
  h += '<div class="acts">';
  if (!C.over) {
    if (targ.indexOf(s.id) >= 0) {
      const p = Math.round(cqChance(C, s) * 100), kind = s.type === 'core' ? 'Das Haupttor stürmen' : s.type === 'secret' ? 'Das Archiv betreten' : 'Angreifen';
      if (C.cease[s.owner] > 0) h += '<div class="warn">' + L('Ein Angriff bricht den Waffenstillstand.') + '</div>';
      h += '<button class="key arm" data-a="atk"><span>' + L(kind) + '</span><small>' + L('Schlacht') + '</small></button>';
      if (s.type !== 'core' && s.type !== 'secret') h += '<button class="key" data-a="auto"><span>' + L('Berechnen') + '</span><small>' + p + ' %</small></button>';
    }
    if (mine && th) { h += '<button class="key arm" data-a="def"><span>' + L('Verteidigen') + '</span><small>' + L('Schlacht') + '</small></button><button class="key" data-a="adef"><span>' + L('Abwehr berechnen') + '</span><small>' + Math.round(cqDefChance(C, th) * 100) + ' %</small></button>'; }
    if (mine && s.fort < 3) h += '<button class="key" data-a="fort"><span>' + L('Befestigen') + '</span><small>' + L('Runde endet') + '</small></button>';
    if (!mine && targ.indexOf(s.id) < 0 && s.type !== 'core') h += '<div class="sub">' + L('Nicht erreichbar: Es grenzt an keines deiner Systeme.') + '</div>';
  }
  h += '</div>';
  const sel = $('cqSel'); sel.innerHTML = h;
  sel.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => cqAct(b.dataset.a)));
  /* Berater */
  const A = CHARS[cqWho(C, 'a')], B = CHARS[cqWho(C, 'b')];
  setText('cqAdvAN', L(A.name).split(' ').slice(-1)[0]); setText('cqAdvBN', L(B.name).split(' ').slice(-1)[0]);
  $('cqInf').style.left = (50 - C.inf * 10) + '%';
  drawPortrait($('cqAdvA'), cqWho(C, 'a'), 1); drawPortrait($('cqAdvB'), cqWho(C, 'b'), 2);
  $('cqAdvFx').textContent = C.inf >= 2 ? L('{0} hat das Ohr der Fraktion: +10 % Hülle und Schilde, leichtere Waffenstillstände.', L(A.name)) : C.inf <= -2 ? L('{0} hat das Ohr der Fraktion: +10 % Waffenschaden.', L(B.name)) : L('Die Berater halten sich die Waage.');
  /* Bedrohungen */
  const tl = $('cqThreats');
  tl.innerHTML = C.threats.length ? '<div class="cqSec">' + L('Bedrohungen') + '</div><ul>' + C.threats.map(x => '<li data-s="' + x.sys + '"><b>⚠ ' + esc(L(C.sys[x.sys].name)) + '</b> ← ' + esc(cqFN(x.by)) + ' (' + x.pow.toFixed(1) + ')</li>').join('') + '</ul>' : '';
  tl.querySelectorAll('[data-s]').forEach(li => li.addEventListener('click', () => { CQS.sel = +li.dataset.s; cqPanel(); }));
  /* Flotte */
  const fl = SHIPS[CQ_FLAG[C.fac]];
  $('cqFleet').innerHTML = '<b>' + esc(fl ? L(fl.name) : '') + '</b> · ' + esc(L(RANK_NAMES[rank] || 'Rekrut')) + ' (' + C.flag.kills + ' ' + L('Abschüsse') + ')<br>' + (C.vets.length ? C.vets.map(v => esc(SHIPS[v.t] ? L(SHIPS[v.t].name) : v.t) + (v.h ? ' ' + esc(qt(L(v.h))) : '') + (XP_RANKS.filter(q => v.k >= q).length ? ' ★' : '')).join(', ') : L('Noch keine Veteranen')) + (C.nem && !C.nem.dead ? '<br><span style="color:var(--bad)">' + L('Erzfeind') + ': ' + esc(L(C.nem.name)) + ' (' + L('Stufe {0}', C.nem.lvl) + ')</span>' : '') + (C.etech ? '<br><span style="color:var(--acc)">' + esc(L(ETECH[C.etech].name)) + '</span>' : '');
  setText('cqHint', C.over ? '' : L('System antippen · Ziele leuchten blau'));
}
function cqDefChance(C, th) { const s = C.sys[th.sys]; return clamp(cqSig((cqPower(C) * 0.7 + 1.2 + s.fort * 0.9 + (s.type === 'cap' ? 2.4 : 0) - th.pow * 0.75 - 1) / 1.2), 0.08, 0.95); }

/* ------------------------------------------------------------------ Taten */
function cqAct(a) {
  const C = CQS.C, s = C.sys[CQS.sel];
  SND.init(); SND.play('order');
  if (a === 'fort') { cqFortify(C, s.id); cqSave(C); cqAfterTurn(); return; }
  if (a === 'atk' || a === 'def') {
    const th = C.threats.find(x => x.sys === s.id);
    const sp = a === 'def' ? cqSpec(C, 'defend', s.id, th.by) : cqSpec(C, 'attack', s.id);
    if (a === 'def') sp.waves = 2 + (th.pow > 4 ? 1 : 0) + (s.type === 'cap' ? 1 : 0);
    C.pending = sp; cqSave(C);
    cqBattle(sp);
    return;
  }
  if (a === 'auto' || a === 'adef') {
    const th = C.threats.find(x => x.sys === s.id);
    const sp = a === 'adef' ? cqSpec(C, 'defend', s.id, th.by) : cqSpec(C, 'attack', s.id);
    const R = cqAuto(C, sp);
    cqResult(C, sp, R);
    C.report.unshift({ k: R.win ? 'good' : 'bad', t: R.win ? 'Berechnete Schlacht gewonnen.' : 'Berechnete Schlacht verloren.' });
    cqSave(C);
    cqAfterTurn();
  }
}
function cqBattle(sp) {
  if (!$('cqEv').hidden && CQS.cur && !CQS.curP) CQS.evq.unshift(CQS.cur);
  CQS.cur = null; $('cqEv').hidden = true; $('cqMenuWin').hidden = true;
  $('conq').hidden = true; UI.cqOpen = false;
  launch(() => beginGame(cqBattleOpts(sp), 'cq'));
}
/* nach einem Zug: Bericht, dann Kapitel und Ereignisse */
function cqAfterTurn() {
  const C = CQS.C;
  if (C.report && C.report.length) CQS.evq.push({ k: 'report', lines: C.report.slice(), turn: C.turn - 1 });
  C.report = [];
  cqPanel();
  cqEvNext();
}
/* offene Schlacht nach Neustart der App */
function cqPendingAsk() {
  const C = CQS.C, sp = C.pending, d = readSave();
  const has = d && d.game && d.ui && d.ui.kind === 'cq' && d.game.opts && d.game.opts.mis && d.game.opts.mis.cq && d.game.opts.mis.cq.sys === sp.sys && d.game.opts.mis.cq.turn === sp.turn;
  cqEvShow({ kind: L('Offene Schlacht'), title: L(sp.name), who: 'hq', body: '<p>' + esc(L('Die Schlacht um {0} ist noch nicht entschieden.', sp.name)) + '</p>', go: has ? L('Fortsetzen') : L('Neu beginnen'), alt: L('Rückzug'),
    onGo: () => { if (has) { $('conq').hidden = true; UI.cqOpen = false; launch(continueGame); } else cqBattle(sp); },
    onAlt: () => { cqResult(C, sp, { win: false, vets: C.vets, flagKills: C.flag.kills, flagAlive: true }); clearSave(); cqSave(C); cqAfterTurn(); } });
}

/* ------------------------------------------------------------------ Fenster: Bericht, Kapitel, Entscheidungen */
function cqEvNext() {
  const C = CQS.C;
  if (!$('cqEv').hidden) return;
  /* erst flüchtige Fenster (Bericht, Folgen), dann die gespeicherte Warteschlange (Kapitel, Ereignisse, Logbücher) */
  let it = CQS.evq.shift();
  CQS.curP = false;
  if (!it && C.queue.length) { it = C.queue[0]; CQS.curP = true; }
  if (!it) { if (C.over) cqEnding(); cqSave(C); cqPanel(); return; }
  CQS.cur = it;
  const fac = C.fac, F = FACTIONS[fac];
  if (it.k === 'report') {
    const IC = { good: '✓', bad: '✗', warn: '⚠', brood: '☣', info: '•', big: '★', own: '⚒' };
    cqEvShow({ kind: L('Lagebericht · Runde {0}', it.turn), title: L('Was geschah'), who: 'hq', body: '<ul class="cqRep">' + it.lines.map(l => '<li class="' + l.k + '"><i>' + (IC[l.k] || '•') + '</i><span>' + esc(T(l.t)) + '</span></li>').join('') + '</ul>' });
  } else if (it.k === 'chap' || it.k === 'event') {
    const ch = it.k === 'chap' ? CQ_CHAP[fac][it.n - 1] : cqEventDef(C, it);
    if (!ch) { cqEvDone(); cqEvNext(); return; }
    const d = ch.d === 'truce' ? CQ_TRUCE : ch.d;
    const body = ch.l.map(([w, txt]) => { const who = cqWho(C, w), P = CHARS[who] || CHARS.hq, Fw = FACTIONS[P.f]; return '<div class="cqLine"><canvas width="80" height="80" data-w="' + who + '"></canvas><div><b style="color:' + (Fw ? Fw.team : '#8fe3ff') + '">' + esc(L(P.name)) + '</b><span>' + esc(T(txt)) + '</span></div></div>'; }).join('');
    cqEvShow({ kind: it.k === 'chap' ? L('Kapitel {0} von 5 · {1}', it.n, L(F.name)) : L('Ereignis'), title: L(ch.t), who: cqWho(C, ch.l[0][0]), body,
      decide: d ? { q: d.q, o: d.o, cb: v => { const out = cqDecide(C, Object.assign({}, it, { id: d.id }), v); cqSave(C); if (out.length) CQS.evq.unshift({ k: 'outcome', lines: out }); } } : null });
  } else if (it.k === 'outcome') {
    cqEvShow({ kind: L('Folgen'), title: L('Entschieden'), who: 'hq', body: '<ul class="cqRep">' + it.lines.map(l => '<li class="good"><i>✓</i><span>' + esc(T(l)) + '</span></li>').join('') + '</ul>' });
  } else if (it.k === 'log') {
    cqEvShow({ kind: L('Erbauer-Logbuch {0} von {1}', C.logs.length, CQ_LOGS.length), title: L('Ein Fragment der Wahrheit'), who: 'echo', body: '<p class="cqLog">' + esc(L(CQ_LOGS[it.n])) + '</p>' + (C.logs.length >= CQ_LOGS.length ? '<p>' + L('Alle Logbücher sind gefunden. Das Archiv der Erbauer liegt offen.') + '</p>' : '') });
  } else if (it.k === 'final') {
    cqEvShow({ kind: L('Das Haupttor'), title: L('Die Entscheidung'), who: cqWho(C, 'a'), body: '<p>' + esc(L('Die Matriarch ist tot. Beide Berater warten auf dein Wort.')) + '</p>',
      decide: { q: CQ_FINAL.q, o: CQ_FINAL.o, cb: v => { cqDecide(C, CQ_FINAL, v); cqSave(C); } } });
  } else { cqEvDone(); cqEvNext(); }
}
/* ein Fenster ist erledigt: gespeicherte Einträge erst jetzt aus der Warteschlange nehmen */
function cqEvDone() { const C = CQS.C; if (CQS.curP && C && C.queue.length) C.queue.shift(); CQS.cur = null; CQS.curP = false; if (C) cqSave(C); }
function cqEvShow(o) {
  const C = CQS.C, P = CHARS[o.who] || CHARS.hq, Fw = FACTIONS[P.f];
  const win = $('cqEv');
  win.style.setProperty('--fc', Fw ? Fw.team : cqCol(C.fac));
  setText('cqEvKind', o.kind); setText('cqEvTitle', o.title);
  $('cqEvBody').innerHTML = o.body || '';
  $('cqEvBody').querySelectorAll('canvas[data-w]').forEach(cv => drawPortrait(cv, cv.dataset.w, 0.8));
  drawPortrait($('cqEvPic'), o.who, 0.5);
  const opts = $('cqEvOpts'); opts.textContent = '';
  $('cqEvQ').hidden = !o.decide; if (o.decide) $('cqEvQ').textContent = T(o.decide.q);
  $('cqEvRow').hidden = !!o.decide;
  if (o.decide) for (const [v, label, desc] of o.decide.o) {
    const b = document.createElement('button'), adv = CHARS[cqWho(C, v)];
    b.className = 'dcard';
    b.innerHTML = '<h4>' + esc(T(label)) + '</h4><p>' + esc(T(desc)) + '</p><div class="by">' + L('Rät') + ': ' + esc(adv ? L(adv.name) : '') + '</div>';
    b.addEventListener('click', () => { SND.play('order'); win.hidden = true; cqEvDone(); o.decide.cb(v); cqPanel(); cqEvNext(); });
    opts.appendChild(b);
  }
  setText('cqEvGo', o.go || L('Weiter'));
  $('cqEvAlt').hidden = !o.alt; if (o.alt) setText('cqEvAlt', o.alt);
  CQS.ev = o;
  win.hidden = false; win.querySelector('.win').scrollTop = 0;
  SND.play(o.decide ? 'alert' : 'radio');
}
function cqEnding() {
  const C = CQS.C, fac = C.fac;
  const TT = { dom: 'Herrschaft', seal: 'Das Siegel', open: 'Jenseits der Tore', lost: 'Niederlage' }[C.ending] || 'Ende';
  const txt = C.ending === 'lost' ? CQ_END.lost : CQ_END[C.ending][fac];
  const A = CHARS[cqWho(C, 'a')], B = CHARS[cqWho(C, 'b')];
  const adv = C.inf >= 2 ? L('Am Ende hörte man auf {0}.', L(A.name)) : C.inf <= -2 ? L('Am Ende hörte man auf {0}.', L(B.name)) : '';
  if (C.ending !== 'lost') cqRecAdd(fac, C.ending);
  const st = C.stats;
  cqEvShow({ kind: L('Ende des Feldzugs · Runde {0}', C.turn), title: L(TT), who: C.ending === 'lost' ? 'foe' : cqWho(C, C.inf >= 0 ? 'a' : 'b'),
    body: '<p class="cqLog" style="border-color:var(--fc)">' + esc(L(txt)) + '</p>' + (adv ? '<p>' + esc(adv) + '</p>' : '') + '<p class="fine">' + L('{0} Schlachten, {1} gewonnen, {2} Systeme erobert, {3} Logbücher.', st.battles, st.won, st.taken, C.logs.length) + '</p>',
    go: L('Neuer Feldzug'), alt: L('Hauptmenü'), onGo: () => { cqClear(); CQS.C = null; cqShowSetup(); }, onAlt: () => { cqClear(); CQS.C = null; cqClose(); } });
  MUS.sting(C.ending === 'lost' ? 'lose' : 'win'); SND.play(C.ending === 'lost' ? 'lose' : 'win');
}

/* ------------------------------------------------------------------ Schlacht: Titel, Ende, Rückzug */
function cqUiStart(g) {
  const S = g.opts.mis.cq, tc = $('misTitle');
  const kind = { attack: 'Angriff auf {0}', defend: 'Verteidigung von {0}', core: 'Sturm auf {0}', secret: '{0}' }[S.kind];
  tc.innerHTML = '<small>' + esc(L('Conquest · Runde {0}', S.turn)) + '</small><b>' + esc(L(kind, L(S.name))) + '</b><span>' + esc(L(CQ_TYPES[S.type] ? CQ_TYPES[S.type].name : '')) + (S.kind === 'attack' || S.kind === 'defend' ? ' · ' + esc(cqFN(S.foe)) : '') + '</span>';
  tc.style.setProperty('--fc', cqCol(S.fac));
}
function cqShowEnd() {
  const g = UI.g, M = g.mis, S = g.opts.mis.cq, won = M.res === 1;
  if (UI.endShown) return;
  UI.endShown = true; UI.endAt = performance.now();
  $('ask').hidden = true; UI.askOpen = false;
  const R = cqBattleResult(g);
  UI.cqR = R;
  $('endTitle').textContent = L(won ? (S.kind === 'defend' ? '{0} gehalten' : '{0} erobert') : (S.kind === 'defend' ? '{0} verloren' : 'Angriff auf {0} gescheitert'), L(S.name)); $('endTitle').className = won ? 'good' : 'bad';
  $('endText').textContent = L('Conquest · Runde {0}', S.turn) + ' · ' + L('Spielzeit {0}', clock(g.time)) + (!won && M.why ? ' · ' + T(M.why) : '');
  const gd = misGoalDefs(g);
  $('endGoals').innerHTML = M.goals.map(q => { const d = gd.find(x => x.id === q.id); if (!q.st) return ''; const ok = q.st === 2; return '<li class="' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? '✓' : '✗') + '</b>' + esc(T(d.t)) + (d.side ? ' <small>(' + L('Nebenziel') + ')</small>' : '') + '</li>'; }).join('');
  const fl = SHIPS[S.flag.t], r0 = XP_RANKS.filter(k => S.flag.kills >= k).length, r1 = XP_RANKS.filter(k => R.flagKills >= k).length;
  $('endChoice').hidden = false;
  $('endChoice').textContent = (R.flagAlive ? L('{0}: {1} Abschüsse', L(fl.name), R.flagKills) + (r1 > r0 ? ' · ' + L('neuer Rang: {0}', L(RANK_NAMES[r1])) : '') : L('{0} wurde schwer getroffen und verliert Erfahrung.', L(fl.name))) + ' · ' + L('Veteranen: {0}', R.vets.length) + (R.nemDead ? ' · ' + L('Der Erzfeind ist gefallen!') : '');
  $('endOutro').hidden = true; $('endOutro').classList.remove('tip');
  $('endMis').hidden = false;
  const st = $('endStats'); st.innerHTML = '<span></span><b>' + L('Abschüsse') + '</b><b>' + L('Verluste') + '</b>' + g.players.filter(p => !p.neutral).map(p => '<span style="color:' + pcolor(p) + '">' + esc(pname(p.id)) + '</span><span>' + p.stats.kills + ' / ' + p.stats.razed + '</span><span>' + p.stats.lost + ' / ' + p.stats.bLost + '</span>').join('');
  $('eNext').hidden = false; setText('eNext', L('Zur Sektorkarte'));
  setText('eAgain', L('Noch einmal')); $('eMenu').hidden = true;
  setTimeout(() => { $('end').hidden = false; MUS.sting(won ? 'win' : 'lose'); SND.play(won ? 'win' : 'lose'); clearSave(); }, won ? 1400 : 1800);
}
/* das Ergebnis in den Feldzug übernehmen (einmal) und zurück zur Karte */
function cqLeave(R) {
  const g = UI.g, S = g && g.opts.mis && g.opts.mis.cq, C = cqLoad();
  if (C && S && C.pending && C.pending.sys === S.sys && C.pending.turn === S.turn) { cqResult(C, S, R); if (C.report.length) CQS.evq.unshift({ k: 'report', lines: C.report.slice(), turn: C.turn - 1 }); C.report = []; cqSave(C); }
  CQS.C = C;
  clearSave();
  $('eMenu').hidden = false;
  toMenu();
  cqOpen();
}
function cqRetreat() {
  const g = UI.g, R = cqBattleResult(g);
  R.win = false;
  cqLeave(R);
}
function initConquest() {
  $('mConq').addEventListener('click', () => { SND.init(); SND.play('click'); cqOpen(); });
  $('cqBack').addEventListener('click', () => { SND.play('click'); cqClose(); });
  $('cqNew').addEventListener('click', () => { SND.init(); SND.play('click'); cqNewCampaign(); });
  $('cqCont').addEventListener('click', () => { SND.play('click'); CQS.C = cqLoad(); if (CQS.C) cqShowMap(); });
  $('cqMap').addEventListener('pointerdown', e => { e.preventDefault(); cqTap(e); });
  $('cqEvGo').addEventListener('click', () => { const o = CQS.ev; $('cqEv').hidden = true; SND.play('click'); cqEvDone(); if (o && o.onGo) o.onGo(); else cqEvNext(); });
  $('cqEvAlt').addEventListener('click', () => { const o = CQS.ev; $('cqEv').hidden = true; SND.play('click'); cqEvDone(); if (o && o.onAlt) o.onAlt(); else cqEvNext(); });
  $('cqMenuB').addEventListener('click', () => { SND.play('click'); const C = CQS.C; $('cqMenuNote').textContent = L('Der Feldzug wird nach jeder Runde gespeichert. {0}, Runde {1}.', cqFN(C.fac), C.turn); $('cqMenuWin').hidden = false; });
  $('cqMResume').addEventListener('click', () => { $('cqMenuWin').hidden = true; });
  $('cqMHelp').addEventListener('click', () => { $('help').hidden = false; });
  $('cqMMain').addEventListener('click', () => { $('cqMenuWin').hidden = true; cqClose(); });
  $('cqMQuit').addEventListener('click', () => { $('cqMenuWin').hidden = true; CQS.C.over = -1; CQS.C.ending = 'lost'; cqSave(CQS.C); cqEnding(); });
  window.addEventListener('resize', () => { if (UI.cqOpen && CQS.cv) setTimeout(cqResize, 60); });
}
