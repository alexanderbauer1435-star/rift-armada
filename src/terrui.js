/* ===== terrui.js ===== */
'use strict';
/* =====================================================================
   KARTENLEBEN – Darstellung und Bedienung (Fassung 22): Trümmerfelder, wandernde Gefahren, Risse in sprengbaren Felsen,
   Erzbrocken, neutrale Stationen (2D), Minikarte, Bodenmarken im 3D-Modus, Meldungen, Auswahlkarte, Einstellungen im
   Gefecht (Gefahren, Zufallskarte). Die Simulation steht in terrain.js.
   ===================================================================== */
/* ---------- Einstellungen ---------- */
function hazOn(mapId, v) { return v === 'on' ? true : v === 'off' ? false : hazDefault(mapId); }
function randSeedMenu() { if (!(MENU.mseed > 0)) MENU.mseed = 1 + ((Math.random() * 999999) | 0); return MENU.mseed; }
function terrSetup(mapId) {
  segInit('hazSeg', [['auto', 'Karte'], ['on', 'An'], ['off', 'Aus']], () => MENU.haz || 'auto', v => { MENU.haz = v; savePrefs(); setupRender(); });
  const sk = MENU.mode === 'skirmish';
  $('rowHaz').hidden = !sk;
  $('rowRand').hidden = !sk || mapId !== 'random';
  if (sk) setText('hazInfo', hazOn(mapId, MENU.haz) ? L(HAZ_MAPS[mapId] === 'storm' ? 'Ein Ionensturm zieht über die Karte.' : HAZ_MAPS[mapId] === 'well' ? 'Ein Gravitationsschacht wandert über die Karte.' : 'Ein Ionensturm und ein Gravitationsschacht ziehen über die Karte.') : '');
  if (sk && mapId === 'random') setText('randInfo', L('Startwert {0}', randSeedMenu()));
  if (!UI.randOn) { UI.randOn = 1; $('randRoll').addEventListener('click', () => { MENU.mseed = 1 + ((Math.random() * 999999) | 0); savePrefs(); SND.play('click'); setupRender(); }); }
}
/* ---------- Meldungen ---------- */
function terrUiEvent(g, e, me, mine) {
  switch (e.t) {
    case 'hazNear': if (mine) { toast(L(e.kind === 'storm' ? 'Ionensturm nähert sich deiner Basis: Schilde fallen aus, Sicht nur aus der Nähe' : 'Gravitationsschacht nähert sich deiner Basis: er zieht Schiffe an, sein Kern zerreißt Hüllen'), 'warn', 5000); R.ping(e.x, e.y, e.kind === 'storm' ? '#c9a0ff' : '#ffb86b'); SND.play('alert'); } break;
    case 'stCap':
      if (mine) { toast(L('{0} übernommen', L(e.name)), 'good', 4000); SND.play('upgrade'); }
      else if (e.prev === me) { toast(L('{0} verloren an {1}', L(e.name), pname(e.owner)), 'bad', 4000); R.ping(e.x, e.y); }
      else if (isFoe(e.owner)) { toast(L('{0} übernimmt {1}', pname(e.owner), L(e.name)), 'warn', 3500); R.ping(e.x, e.y); }
      hudSel(); break;
    case 'rockGone': R.miniBase = null; if (visAt(g, me, e.x, e.y)) SND.play('bigboom', e.x, e.y); if (mine && e.plug && performance.now() - (UI.plugT || 0) > 8000) { UI.plugT = performance.now(); toast(L('Felspfropfen gesprengt: der Weg ist frei'), 'good', 3500); } break;
  }
}
/* ---------- Auswahlkarte und Tipps ---------- */
function rockTip(o) { return '<h4>' + esc(L(o.def.name)) + '</h4><p>' + esc(L('Sprengbar: Kampfschiffe wählen und den Felsen antippen. Gibt die Engstelle frei und hinterlässt Erz zum Bergen.')) + '</p><p class="fine">' + L('Hülle') + ' ' + Math.max(0, Math.round(o.hp)) + ' / ' + o.hpMax + '</p>'; }
function outpostCard(so) {
  const g = UI.g;
  let h = '<div class="sub">' + (so.cont ? '<span style="color:var(--bad)">' + L('Umkämpft') + '</span>' : so.owner >= 0 ? L('Gehört {0}', pname(so.owner)) : L('Neutral: 15 s ohne Feinde daneben halten')) + '</div>';
  if (so.kind === 'refplat' && so.owner >= 0) h += '<div class="sub">' + L('+{0} Eis und +{1} Erz je Sekunde', OUTPOST.refplat.inc.ice, OUTPOST.refplat.inc.ore) + '</div>';
  void g; return h;
}
function coverLine(u) { return u.cov ? '<div class="sub" style="color:var(--acc2)">' + L('In Deckung: −25 % Schaden durch Geschosse, Feinde sehen dich erst näher, Tempo −20 %.') + '</div>' : ''; }

/* ---------- 2D: Trümmerfelder, Gefahren ---------- */
const DEB_SPR = new Map();
function debrisSprite(d) {
  const key = d.seed + '|' + Math.round(d.r);
  let c = DEB_SPR.get(key); if (c) return c;
  const s = 2, R = d.r, W = Math.ceil(R * 2 * s);
  c = document.createElement('canvas'); c.width = c.height = W;
  const x = c.getContext('2d'), rng = makeRng(d.seed * 31 + 7);
  x.scale(s, s); x.translate(R, R);
  /* Staubschleier: kühles Grau-Blau, zum Rand weich */
  const gr = x.createRadialGradient(0, 0, R * 0.15, 0, 0, R); gr.addColorStop(0, 'rgba(120,140,165,0.20)'); gr.addColorStop(0.7, 'rgba(90,105,125,0.12)'); gr.addColorStop(1, 'rgba(70,80,95,0)');
  x.fillStyle = gr; x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
  /* Wrackteile: Plattenstücke, Träger, zerrissene Rumpfsegmente */
  const n = Math.round(R * R / 900);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, dd = Math.sqrt(rng()) * R * 0.9, px = Math.cos(a) * dd, py = Math.sin(a) * dd, k = rng();
    x.save(); x.translate(px, py); x.rotate(rng() * TAU);
    const sz = 3 + rng() * (k < 0.12 ? 14 : 7), tone = 70 + (rng() * 60) | 0;
    x.fillStyle = 'rgb(' + tone + ',' + (tone + 6) + ',' + (tone + 14) + ')'; x.strokeStyle = 'rgba(10,14,20,0.8)'; x.lineWidth = 0.6;
    if (k < 0.3) { x.fillRect(-sz, -sz * 0.18, sz * 2, sz * 0.36); x.strokeRect(-sz, -sz * 0.18, sz * 2, sz * 0.36); for (let j = -2; j <= 2; j++) { x.beginPath(); x.moveTo(j * sz * 0.4, -sz * 0.18); x.lineTo(j * sz * 0.4 + sz * 0.2, sz * 0.18); x.stroke(); } }
    else { x.beginPath(); x.moveTo(-sz, -sz * 0.5); x.lineTo(sz * 0.6, -sz * 0.7); x.lineTo(sz, sz * 0.2); x.lineTo(-sz * 0.3, sz * 0.6); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(-sz * 0.6, -sz * 0.45, sz * 0.9, sz * 0.18); }
    if (k > 0.94) { x.fillStyle = 'rgba(255,190,120,0.8)'; x.beginPath(); x.arc(0, 0, 1.2, 0, TAU); x.fill(); }
    x.restore();
  }
  DEB_SPR.set(key, c);
  return c;
}
function terrBack2D(ctx, g, inV, lowZ) {
  const m = g.map, cam = R.cam;
  for (const d of m.debris || []) if (inV(d.x, d.y, d.r)) { const c = debrisSprite(d); ctx.drawImage(c, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2); if (!lowZ) { ctx.strokeStyle = 'rgba(160,185,215,0.22)'; ctx.lineWidth = 1 / cam.z; ctx.setLineDash([3 / cam.z, 7 / cam.z]); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
  for (const h of g.hazards || []) {
    if (!inV(h.x, h.y, h.r + 40)) continue;
    const t = R.time;
    if (h.kind === 'storm') {
      for (let k = 0; k < (lowZ ? 2 : 4); k++) {
        const a = t * 0.35 + k * 1.7, cx = h.x + Math.cos(a) * h.r * 0.22, cy = h.y + Math.sin(a * 1.2) * h.r * 0.22, rr = h.r * (1.05 - k * 0.17);
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(170,150,255,0.30)'); gr.addColorStop(0.55, 'rgba(95,80,210,0.26)'); gr.addColorStop(1, 'rgba(50,40,140,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(200,180,255,0.35)'; ctx.lineWidth = 2 / cam.z; ctx.setLineDash([10 / cam.z, 10 / cam.z]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      /* Blitze */
      if (R.detail > 0 && Math.random() < 0.18) { const a0 = Math.random() * TAU, d0 = Math.random() * h.r * 0.7; let x = h.x + Math.cos(a0) * d0, y = h.y + Math.sin(a0) * d0; ctx.strokeStyle = 'rgba(230,220,255,0.85)'; ctx.lineWidth = 1.6 / cam.z; ctx.beginPath(); ctx.moveTo(x, y); for (let i = 0; i < 5; i++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; ctx.lineTo(x, y); } ctx.stroke(); }
    } else {
      const gr = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(h.core / h.r * 0.6, 'rgba(10,4,20,0.85)'); gr.addColorStop(h.core / h.r, 'rgba(120,60,30,0.35)'); gr.addColorStop(1, 'rgba(60,30,60,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { const a = -t * (1.4 + k * 0.5) + k * 2.1, rr = h.core * (1.05 + k * 0.35); ctx.strokeStyle = k ? 'rgba(200,120,255,0.28)' : 'rgba(255,170,90,0.55)'; ctx.lineWidth = (4 - k) / cam.z; ctx.beginPath(); ctx.arc(h.x, h.y, rr, a, a + 2.4); ctx.stroke(); ctx.beginPath(); ctx.arc(h.x, h.y, rr, a + Math.PI, a + Math.PI + 1.6); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,170,110,0.25)'; ctx.lineWidth = 1.2 / cam.z; ctx.setLineDash([6 / cam.z, 9 / cam.z]); ctx.lineDashOffset = t * 30; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (R.detail > 1 && Math.random() < 0.5) { const a = Math.random() * TAU; fxSpark(h.x + Math.cos(a) * h.r * 0.9, h.y + Math.sin(a) * h.r * 0.9, 1, 20, '#ffb070', 0.4); }
    }
  }
}
/* Risse in angeschlagenen Felsen; Pfropfen und sprengbare Felsen markiert, solange Kampfschiffe gewählt sind */
function wantBlast() { return typeof UI !== 'undefined' && !UI.attract && UI.g && [...UI.sel].some(id => { const u = UI.g.byId.get(id); return u && !u.dead && u.owner === UI.me && armed(u); }); }
function crackPath(ctx, o, k) {
  const rng = makeRng((o.seed || 1) * 13 + 5), n = 2 + Math.round(k * 5);
  for (let i = 0; i < n; i++) {
    let a = rng() * TAU, x = Math.cos(a) * o.r * 0.15, y = Math.sin(a) * o.r * 0.15;
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) { a += (rng() - 0.5) * 1.1; const st = o.r * (0.22 + rng() * 0.2); x += Math.cos(a) * st; y += Math.sin(a) * st; ctx.lineTo(x, y); }
  }
}
function terrRocks2D(ctx, g, inV) {
  const cam = R.cam, hint = cam.z > 0.4 && wantBlast();
  for (const e of g.rocks || []) {
    if (e.dead || !inV(e.x, e.y, e.r)) continue;
    const o = g.map.rocks[e.ri], k = o.dmg || 0;
    if (hint || e.plug && cam.z > 0.55) { ctx.strokeStyle = e.plug ? 'rgba(255,184,107,0.5)' : 'rgba(255,184,107,0.3)'; ctx.lineWidth = 1.2 / cam.z; ctx.setLineDash([4 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (k <= 0.02) continue;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0);
    ctx.beginPath(); ctx.arc(0, 0, o.r * 0.92, 0, TAU); ctx.clip();
    ctx.beginPath(); crackPath(ctx, o, k);
    ctx.strokeStyle = 'rgba(10,8,6,0.85)'; ctx.lineWidth = 2.2; ctx.stroke();
    if (k > 0.4) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,' + (150 - k * 80 | 0) + ',60,' + (0.3 + 0.5 * k) + ')'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
    if (g.time - e.hitT < 0.15 && R.detail > 0 && Math.random() < 0.5) fxSpark(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, 1, 30, '#ffd27a', 0.4);
  }
}
/* Erzbrocken eines gesprengten Felsens */
function terrRubble2D(ctx, w, g) {
  const left = w.until - g.time, rng = makeRng(w.id * 17 + 3), n = 7;
  ctx.save(); ctx.globalAlpha = clamp(left / 20, 0, 0.9); ctx.translate(w.x, w.y);
  for (let i = 0; i < n; i++) { const a = rng() * TAU, d = rng() * (w.r || 20) * 1.2, s = 3 + rng() * 5; ctx.fillStyle = i % 3 ? '#5e554b' : '#b07a3e'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * d - s, Math.sin(a) * d); ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d - s * 0.8); ctx.lineTo(Math.cos(a) * d + s, Math.sin(a) * d + s * 0.3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
/* ---------- 2D: neutrale Stationen (Zeichnung wie die Stätten) ---------- */
const OP_C = { hull: '#8a96a6', hi: '#dfe7f2', lo: '#3c4552', dark: '#5d6876', line: '#151b23', glow: '#8fe3ff' };
function drawOutpost(ctx, st, t, vis) {
  const C = OP_C, r = st.r, k = st.kind, own = st.owner >= 0 ? pcol(st.owner) : '#8fe3ff';
  /* Grundplattform: Achteck mit Rand */
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); } ctx.closePath(); hull(ctx, C, r * 0.62);
  plate(ctx, C, -r * 0.3, -r * 0.3, r * 0.6, r * 0.6, 0.5);
  if (k === 'relayst') {
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; ctx.save(); ctx.rotate(a); rrect(ctx, r * 0.4, -r * 0.06, r * 0.62, r * 0.12, 2); hull(ctx, C, r * 0.06); ctx.fillStyle = own; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); circ(ctx, r * 1.02, 0, 2.6); ctx.fill(); ctx.globalAlpha = 1; ctx.restore(); }
    ctx.save(); ctx.rotate(t * 0.4); ctx.beginPath(); ctx.arc(0, 0, r * 0.32, -1.1, 1.1); ctx.lineWidth = 4; ctx.strokeStyle = C.hi; ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = C.line; ctx.stroke(); ctx.restore();
  } else if (k === 'refplat') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; circ(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.24); hull(ctx, C, r * 0.24); ctx.fillStyle = 'rgba(255,184,107,0.55)'; circ(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.09); ctx.fill(); }
    ctx.save(); ctx.rotate(-t * 0.6); for (let i = 0; i < 2; i++) { ctx.rotate(Math.PI); rrect(ctx, r * 0.15, -r * 0.05, r * 0.85, r * 0.1, 2); hull(ctx, C, r * 0.05); } ctx.restore();
  } else {
    /* Reparaturwerft: offene Klammer (Dock) mit Kran */
    ctx.save(); ctx.rotate(-Math.PI / 2);
    for (const s of [-1, 1]) { rrect(ctx, -r * 0.2, s * r * 0.55 - r * 0.1, r * 1.05, r * 0.2, 3); hull(ctx, C, r * 0.1); for (let j = 0; j < 4; j++) plate(ctx, C, -r * 0.1 + j * r * 0.24, s * r * 0.55 - r * 0.06, r * 0.18, r * 0.12, j % 2 ? -1 : 0.3); }
    const kx = r * 0.15 + (Math.sin(t * 0.8) * 0.5 + 0.5) * r * 0.6; ctx.fillStyle = C.dark; ctx.fillRect(kx - 3, -r * 0.6, 6, r * 1.2); ctx.fillStyle = '#ffd27a'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); circ(ctx, kx, 0, 2.4); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  /* Besitzer: Lichter in seiner Farbe; Nabe */
  ctx.fillStyle = own; light(ctx, 0, 0, 3.2, own);
  if (st.cont && vis) { ctx.strokeStyle = 'rgba(255,91,71,' + (0.45 + 0.35 * Math.sin(t * 8)) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r + 16, 0, TAU); ctx.stroke(); }
}
/* ---------- Minikarte ---------- */
function terrMiniBase(x, m, sx, sy) { for (const d of m.debris || []) { x.fillStyle = 'rgba(150,170,200,0.25)'; x.beginPath(); x.arc(d.x * sx, d.y * sy, d.r * sx, 0, TAU); x.fill(); } }
function terrMini(ctx, g, sx, sy) {
  for (const h of g.hazards || []) {
    ctx.globalAlpha = 0.75; ctx.strokeStyle = h.kind === 'storm' ? '#b4a0ff' : '#ffb070'; ctx.lineWidth = 1.5;
    if (h.kind === 'storm') { ctx.fillStyle = 'rgba(140,120,255,0.3)'; ctx.beginPath(); ctx.arc(h.x * sx, h.y * sy, Math.max(4, h.r * sx), 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(h.x * sx, h.y * sy, Math.max(4, h.r * sx), 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffb070'; ctx.beginPath(); ctx.arc(h.x * sx, h.y * sy, 1.6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
/* ---------- 3D: Bodenmarken (Gefahren, Risse, Erzbrocken, umkämpfte Stationen) ---------- */
function terrOverlay3D(g, inV, lowZ) {
  const ring = (x, y, r, col, w, o) => RA3D.ring(x, y, r, col, w || 1, o), disc = (x, y, r, col, a) => RA3D.disc(x, y, r, col, a), t = R.time;
  for (const h of g.hazards || []) {
    if (!inV(h.x, h.y, h.r + 40)) continue;
    if (h.kind === 'storm') { for (let k = 0; k < 3; k++) { const a = t * 0.35 + k * 1.7; disc(h.x + Math.cos(a) * h.r * 0.2, h.y + Math.sin(a * 1.2) * h.r * 0.2, h.r * (1 - k * 0.2), k ? '#5a48d0' : '#8f7cff', 0.16); } ring(h.x, h.y, h.r, '#c8b4ff', 2, { dash: 1, alpha: 0.4 }); }
    else { disc(h.x, h.y, h.r, '#1a0c22', 0.45); disc(h.x, h.y, h.core, '#000000', 0.8); for (let k = 0; k < 3; k++) { const a = -t * (1.4 + k * 0.5) + k * 2.1, rr = h.core * (1.05 + k * 0.35); ring(h.x, h.y, rr, k ? '#c878ff' : '#ffaa5a', 4 - k, { a0: a, a1: a + 2.4, alpha: k ? 0.35 : 0.7 }); ring(h.x, h.y, rr, k ? '#c878ff' : '#ffaa5a', 4 - k, { a0: a + Math.PI, a1: a + Math.PI + 1.6, alpha: k ? 0.35 : 0.7 }); } ring(h.x, h.y, h.r, '#ffaa6e', 1.2, { dash: 1, alpha: 0.3 }); }
  }
  for (const d of g.map.debris || []) if (!lowZ && inV(d.x, d.y, d.r)) ring(d.x, d.y, d.r, '#a0b9d7', 1, { dash: 1, alpha: 0.25 });
  const hint = R.cam.z > 0.4 && wantBlast();
  for (const e of g.rocks || []) {
    if (e.dead || !inV(e.x, e.y, e.r)) continue;
    if (hint || e.plug && R.cam.z > 0.55) ring(e.x, e.y, e.r + 5, '#ffb86b', 1.2, { dash: 1, alpha: e.plug ? 0.5 : 0.3 });
    const k = g.map.rocks[e.ri].dmg || 0;
    if (k > 0.02) { const rng = makeRng(e.id * 7 + 1); for (let i = 0; i < 2 + Math.round(k * 4); i++) { const a = rng() * TAU; ring(e.x, e.y, e.r * (0.55 + rng() * 0.35), k > 0.4 ? '#ff8a3c' : '#2a221c', 1.6, { a0: a, a1: a + 0.5 + rng() * 0.6, alpha: 0.5 + 0.4 * k }); } }
  }
  for (const w of g.wrecks) if (w.rock && inV(w.x, w.y, 40) && R.seen(w.x, w.y)) { disc(w.x, w.y, (w.r || 20) * 1.1, '#6a5c4c', 0.5); ring(w.x, w.y, (w.r || 20) * 0.8, '#d49a5a', 2, { dash: 1, alpha: 0.6 }); }
  for (const st of g.sites) if (st.cont && OUTPOST[st.kind] && inV(st.x, st.y, st.r + 30)) ring(st.x, st.y, st.r + 16, '#ff5b47', 2.5, { alpha: 0.45 + 0.35 * Math.sin(t * 8) });
}
