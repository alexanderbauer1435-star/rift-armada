/* ===== ships.js ===== */
'use strict';
/* =====================================================================
   FORMEN – Schiffe und Stationen als Vektorzeichnungen, je Fraktion eine eigene Formsprache.
   Alliance: weiße Rümpfe, Ringe um eine Mittelachse, türkise Triebwerke. Mars: graue Nadeln mit roten Kanten, lange
   blaue Fackeln. Alle Schiffe zeigen nach +x (Bug rechts), der Ursprung ist die Mitte. Spielerfarbe = Zierstreifen.
   Die Zeichnungen landen in Bildspeichern (sprite), Drehung und Skalierung macht die Darstellung.
   ===================================================================== */
const SPR_CACHE = new Map();
function sprite(key, w, h, draw) {
  let c = SPR_CACHE.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const ctx = c.getContext('2d');
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  c._ox = w / 2; c._oy = h / 2;
  SPR_CACHE.set(key, c);
  if (SPR_CACHE.size > 400) { const k = SPR_CACHE.keys().next().value; SPR_CACHE.delete(k); }
  return c;
}
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function fillStroke(ctx, fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
/* Farben je Fraktion; col = Spielerfarbe. hi/lo: helle und dunkle Kante des Rumpfs für die Schattierung */
function shipCols(f, col) {
  if (col === 'wreck') return { hull: '#3a3d44', hi: '#4a4d54', lo: '#24262b', dark: '#2a2c31', line: '#15161a', trim: '#4a4038', trim2: '#4a4038', glow: '#333', win: '#333', flesh: '#3d3438', bone: '#55504a', gold: '#4a4038' };
  const F = FACTIONS[f];
  if (f === 'alliance') return { hull: '#dfe7ee', hi: '#ffffff', lo: '#93a5b6', dark: '#a9b8c6', line: '#44586c', trim: col, trim2: F.trim, glow: F.glow, win: '#a8f4ff' };
  if (f === 'legion') return { hull: '#e9d8ad', hi: '#fff6dc', lo: '#9d7f3c', dark: '#c9a85a', line: '#5a4315', trim: col, trim2: F.trim, glow: F.glow, win: '#e0c8ff', gold: '#f2c14e' };
  if (f === 'nexus') return { hull: '#efe9fb', hi: '#ffffff', lo: '#a98fd6', dark: '#cbb8ec', line: '#5a3f8f', trim: col, trim2: F.trim, glow: F.glow, win: '#ffffff' };
  if (f === 'brood') return { hull: '#6f4d85', hi: '#b48ccc', lo: '#33203f', dark: '#4e3560', line: '#1a0f22', trim: col, trim2: '#2e8b3a', glow: '#d6ff6a', win: '#b4ff3c', flesh: '#c46a8a', bone: '#d9c9b0' };
  if (f === 'guardian') return { hull: '#8fa39b', hi: '#d2e6dc', lo: '#4a5c55', dark: '#67786f', line: '#1f2a26', trim: col, trim2: F.trim, glow: F.glow, win: '#b8ffd8' };
  return { hull: '#8d9096', hi: '#c0c4cb', lo: '#45484f', dark: '#5f636a', line: '#1b1d21', trim: col, trim2: F.trim, glow: F.glow, win: '#ffd27a' };
}
/* Legion: Spitzbogen (gotischer Bogen) und Zierspitze. Nexus: Kristallfacette (Vieleck mit heller Kante). */
function arch(ctx, C, x, y, w, h) { ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h * 0.1); ctx.quadraticCurveTo(x - w / 2, y - h / 2, x, y - h / 2); ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h * 0.1); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); ctx.fillStyle = '#2a1f4d'; ctx.fill(); ctx.strokeStyle = C.gold || C.trim; ctx.lineWidth = 0.9; ctx.stroke(); ctx.fillStyle = C.win; ctx.globalAlpha = 0.6; ctx.fillRect(x - w * 0.18, y - h * 0.25, w * 0.36, h * 0.55); ctx.globalAlpha = 1; }
function spire(ctx, C, x, y, len, w, ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); poly(ctx, [0, -w / 2, len, 0, 0, w / 2]); hull(ctx, C, w / 2); ctx.fillStyle = C.gold || C.trim; ctx.fillRect(len * 0.55, -w * 0.18, len * 0.3, w * 0.36); ctx.restore(); }
function facet(ctx, C, pts, bright) { poly(ctx, pts); const g = ctx.createLinearGradient(pts[0], pts[1], pts[4] !== undefined ? pts[4] : pts[2], pts[5] !== undefined ? pts[5] : pts[3]); g.addColorStop(0, bright ? C.hi : C.hull); g.addColorStop(1, C.lo); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.9; ctx.stroke(); }
function core(ctx, C, x, y, r) { ctx.fillStyle = C.glow; ctx.globalAlpha = 0.35; circ(ctx, x, y, r * 2); ctx.fill(); ctx.globalAlpha = 1; circ(ctx, x, y, r); ctx.fillStyle = C.trim2; ctx.fill(); circ(ctx, x, y, r * 0.5); ctx.fillStyle = '#fff'; ctx.fill(); }
/* ---- Zeichenhilfen ----
   hull: Pfad mit Verlauf quer zur Achse füllen (hell oben, dunkel unten) und dunkel umranden – wirkt wie ein runder Körper
   plate: Panzerplatte (Mars) · panel: Fugenlinie · light: leuchtendes Fenster · ring3d: Ring mit Licht von oben (Alliance)
   nozzle: Triebwerksdüse · barrelS: kurzes Geschützrohr · stripe: Zierstreifen in Spielerfarbe */
function hull(ctx, C, w, y0) {
  const gr = ctx.createLinearGradient(0, (y0 || 0) - w, 0, (y0 || 0) + w);
  gr.addColorStop(0, C.hi); gr.addColorStop(0.42, C.hull); gr.addColorStop(1, C.lo);
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.3; ctx.stroke();
}
function plate(ctx, C, x, y, w, h, shade) { rrect(ctx, x, y, w, h, 1.2); ctx.fillStyle = shade < 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,' + (0.08 + 0.1 * (shade || 0)) + ')'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); }
function panel(ctx, C, x0, y0, x1, y1) { ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1; }
function light(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.globalAlpha = 0.35; circ(ctx, x, y, r * 2.2); ctx.fill(); ctx.globalAlpha = 1; circ(ctx, x, y, r); ctx.fill(); ctx.fillStyle = '#fff'; circ(ctx, x, y, r * 0.45); ctx.fill(); }
function windows(ctx, C, x0, y, n, dx) { for (let i = 0; i < n; i++) { ctx.fillStyle = C.win; ctx.fillRect(x0 + i * dx, y - 0.6, 1.4, 1.2); } }
function ring3d(ctx, C, x, y, r, w) {
  ctx.lineWidth = w; ctx.strokeStyle = C.lo; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.hi; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = C.trim; ctx.lineWidth = Math.max(1, w * 0.45); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, r + w / 2, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r - w / 2, 0, TAU); ctx.stroke();
}
function nozzle(ctx, C, x, y, r) { circ(ctx, x, y, r); ctx.fillStyle = '#1c1e24'; ctx.fill(); ctx.strokeStyle = C.hi; ctx.lineWidth = 0.9; ctx.stroke(); circ(ctx, x, y, r * 0.5); ctx.fillStyle = C.glow; ctx.fill(); }
function barrelS(ctx, C, x, y, len, w, ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); rrect(ctx, 0, -w / 2, len, w, w / 3); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); ctx.fillStyle = C.hi; ctx.fillRect(len - 1.5, -w / 2, 1.5, w); ctx.restore(); }
function stripe(ctx, C, pts) { poly(ctx, pts); ctx.fillStyle = C.trim; ctx.fill(); }
function turretS(ctx, C, x, y, r, ang) { circ(ctx, x, y, r); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); barrelS(ctx, C, x, y, r * 1.6, r * 0.6, ang || 0); circ(ctx, x, y, r * 0.4); ctx.fillStyle = C.hi; ctx.fill(); }

/* ------------------------------------------------------------------ Schiffe (Bug nach +x, Ursprung Mitte) */
/* The Brood: organische Formen. blob: geschlossene weiche Kurve durch Punkte (Chitin-Rumpf mit Fleischverlauf),
   ridge: Chitinkamm, eye: leuchtendes Auge, tendril: Fühler/Tentakel, sac: Säuredrüse, maw: Maul mit Zähnen */
function smoothPath(ctx, pts) {
  const n = pts.length / 2;
  const P = i => [pts[((i % n) + n) % n * 2], pts[((i % n) + n) % n * 2 + 1]];
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    if (i === 0) ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
}
function blob(ctx, C, pts, w, flesh) {
  smoothPath(ctx, pts);
  const gr = ctx.createLinearGradient(0, -(w || 10), 0, (w || 10));
  gr.addColorStop(0, C.hi); gr.addColorStop(0.45, flesh ? C.flesh : C.hull); gr.addColorStop(1, C.lo);
  ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
}
function ridge(ctx, C, x0, y0, x1, y1, n, h) { for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k, ang = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; poly(ctx, [x, y, x + Math.cos(ang) * h, y + Math.sin(ang) * h, x + Math.cos(ang - 0.4) * h * 0.45, y + Math.sin(ang - 0.4) * h * 0.45]); ctx.fillStyle = C.bone; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.stroke(); } }
function eye(ctx, C, x, y, r) { ctx.fillStyle = C.glow; ctx.globalAlpha = 0.35; circ(ctx, x, y, r * 2.4); ctx.fill(); ctx.globalAlpha = 1; circ(ctx, x, y, r); ctx.fillStyle = C.win; ctx.fill(); circ(ctx, x + r * 0.25, y, r * 0.42); ctx.fillStyle = '#0d1a08'; ctx.fill(); }
function tendril(ctx, C, x, y, len, ang, w, wave) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.quadraticCurveTo(len * 0.5, -w / 2 + (wave || 0), len, 0); ctx.quadraticCurveTo(len * 0.5, w / 2 + (wave || 0), 0, w / 2); ctx.closePath(); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore(); }
function sac(ctx, C, x, y, r) { const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#f2ffb0'); gr.addColorStop(0.6, C.win); gr.addColorStop(1, '#4e7a1a'); circ(ctx, x, y, r); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); }
function maw(ctx, C, x, y, r, open) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.55 + 0.3 * (open || 0.5)), 0, 0, TAU); ctx.fillStyle = '#2a0c18'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = C.bone; for (let i = -2; i <= 2; i++) { const px = i * r * 0.4; poly(ctx, [px - r * 0.12, -r * 0.5, px, -r * 0.1, px + r * 0.12, -r * 0.5]); ctx.fill(); poly(ctx, [px - r * 0.12, r * 0.5, px, r * 0.1, px + r * 0.12, r * 0.5]); ctx.fill(); } ctx.restore(); }
function legs(ctx, C, x, y, n, len, spread, w) { for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1) - 0.5; for (const sgn of [-1, 1]) tendril(ctx, C, x + k * spread, y * sgn, len, sgn * (0.9 + k * 0.5), w, sgn * 2); } }
const SHIP_DRAW = {
  /* ---- Alliance: weiße Rümpfe, Ringe um die Achse, türkise Fenster ---- */
  wren(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -12, s * 5 - 2, 9, 4, 1.5); hull(ctx, C, 2.5, s * 5); nozzle(ctx, C, -12, s * 5, 1.6); }
    poly(ctx, [14, 0, 4, -4.5, -9, -4.5, -11, 0, -9, 4.5, 4, 4.5]); hull(ctx, C, 5);
    stripe(ctx, C, [14, 0, 7, -2.2, 7, 2.2]);
    ring3d(ctx, C, -2, 0, 6, 2.2);
    light(ctx, 9, 0, 1.1, C.win);
    panel(ctx, C, 2, -4, 2, 4);
  },
  lancer(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -17, s * 8.5 - 3, 15, 6, 2); hull(ctx, C, 3.2, s * 8.5); nozzle(ctx, C, -17, s * 8.5, 2.4); plate(ctx, C, -12, s * 8.5 - 1.5, 6, 3, -1); }
    poly(ctx, [19, 0, 15, -3.5, -4, -5, -15, -4, -17, 0, -15, 4, -4, 5, 15, 3.5]); hull(ctx, C, 5.5);
    stripe(ctx, C, [8, -3.2, 12, -3.2, 12, 3.2, 8, 3.2]);
    panel(ctx, C, -8, -4.5, -8, 4.5); panel(ctx, C, 1, -5, 1, 5);
    ring3d(ctx, C, -3, 0, 10.5, 2.6);
    circ(ctx, 14, 0, 4.2); hull(ctx, C, 4.2);
    light(ctx, 17, 0, 1.4, C.trim2);
    windows(ctx, C, -1, -2.2, 4, 2.2);
  },
  bulwark(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -24, s * 13 - 3.5, 20, 7, 2.5); hull(ctx, C, 3.5, s * 13); nozzle(ctx, C, -24, s * 13, 2.8); plate(ctx, C, -18, s * 13 - 2, 8, 4, 1); }
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 11.5, 0, 0, TAU); hull(ctx, C, 11.5);
    plate(ctx, C, -20, -4, 40, 8, 1);
    panel(ctx, C, -12, -11, -12, 11); panel(ctx, C, 12, -11, 12, 11);
    ring3d(ctx, C, 10, 0, 13, 3); ring3d(ctx, C, -10, 0, 13, 3);
    stripe(ctx, C, [20, -5, 25, -2.5, 25, 2.5, 20, 5]);
    rrect(ctx, -5, -3, 10, 6, 2); hull(ctx, C, 3);
    light(ctx, 23, 0, 1.6, C.trim2);
    windows(ctx, C, -4, -1.2, 4, 2.4);
    for (const s of [-1, 1]) light(ctx, 0, s * 8.5, 1, C.win);
  },
  haven(ctx, C) {
    for (const [y, r] of [[-15, 3.2], [15, 3.2], [0, 2.6]]) { rrect(ctx, -41, y - r, 26, r * 2, r * 0.7); hull(ctx, C, r, y); nozzle(ctx, C, -41, y, r); }
    rrect(ctx, -38, -7, 58, 14, 5); hull(ctx, C, 7);
    panel(ctx, C, -20, -7, -20, 7); panel(ctx, C, -6, -7, -6, 7);
    stripe(ctx, C, [-30, -3, -16, -3, -16, 3, -30, 3]);
    circ(ctx, 10, 0, 27); hull(ctx, C, 27);
    /* Hangarschächte oben und unten auf der Scheibe */
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { rrect(ctx, -2 + i * 7, s * 17 - 2, 5, 4, 1); ctx.fillStyle = '#1a2230'; ctx.fill(); light(ctx, 0.5 + i * 7, s * 17, 0.7, C.win); }
    ring3d(ctx, C, 10, 0, 19.5, 3.4);
    circ(ctx, 10, 0, 9); hull(ctx, C, 9);
    stripe(ctx, C, [10, -9, 30, -3, 30, 3, 10, 9]);
    light(ctx, 10, 0, 2.2, C.trim2);
    windows(ctx, C, 14, -4, 4, 3); windows(ctx, C, 14, 4, 4, 3);
  },
  pathfinder(ctx, C) {
    rrect(ctx, -17, -4, 10, 8, 2); hull(ctx, C, 4); nozzle(ctx, C, -17, 0, 2.6);
    rrect(ctx, -12, -8, 26, 16, 3.5); hull(ctx, C, 8);
    plate(ctx, C, -9, -6, 8, 12, -1); plate(ctx, C, 2, -6, 8, 12, 1);
    ring3d(ctx, C, -2, 0, 9.5, 2.4);
    for (const s of [-1, 1]) { poly(ctx, [12, s * 7, 19, s * 5, 19, s * 2.5, 12, s * 2.5]); hull(ctx, C, 2, s * 5); light(ctx, 18, s * 3.7, 0.9, C.trim2); }
    light(ctx, 9, 0, 1.2, C.win);
  },
  hauler(ctx, C) {
    rrect(ctx, -15, -2.5, 30, 5, 2); hull(ctx, C, 2.5); nozzle(ctx, C, -15, 0, 2.2);
    for (const x of [-7, 4]) { circ(ctx, x, 0, 6.5); hull(ctx, C, 6.5); panel(ctx, C, x, -6.5, x, 6.5); }
    circ(ctx, 13, 0, 3.6); hull(ctx, C, 3.6);
    stripe(ctx, C, [-13, -1.2, -10, -1.2, -10, 1.2, -13, 1.2]);
    light(ctx, 14.5, 0, 1, C.win);
  },
  fighter(ctx, C) { poly(ctx, [6.5, 0, -4, -4, -2.5, 0, -4, 4]); hull(ctx, C, 3.5); light(ctx, 2, 0, 0.6, C.win); },
  /* ---- Mars: graue Nadeln mit Platten, roten Kanten und Nieten, gelbe Fenster ---- */
  needle(ctx, C) {
    poly(ctx, [-8, -3.5, -14, -9, -16, -9, -13, -3.5]); hull(ctx, C, 2, -6); poly(ctx, [-8, 3.5, -14, 9, -16, 9, -13, 3.5]); hull(ctx, C, 2, 6);
    poly(ctx, [17, 0, 6, -3.6, -12, -3.6, -15, 0, -12, 3.6, 6, 3.6]); hull(ctx, C, 3.6);
    plate(ctx, C, -10, -2.6, 6, 5.2, -1); plate(ctx, C, -3, -2.6, 6, 5.2, 1);
    for (const s of [-1, 1]) { rrect(ctx, 4, s * 2 - 1, 6, 2, 0.5); ctx.fillStyle = '#15171b'; ctx.fill(); }
    stripe(ctx, C, [10, -1.8, 15, -0.8, 15, 0.8, 10, 1.8]);
    nozzle(ctx, C, -15, 0, 2.6);
    light(ctx, 1, 0, 0.9, C.win);
  },
  hedgehog(ctx, C) {
    poly(ctx, [19, 0, 9, -6, -15, -6, -18, 0, -15, 6, 9, 6]); hull(ctx, C, 6);
    plate(ctx, C, -13, -4.5, 7, 9, -1); plate(ctx, C, -5, -4.5, 7, 9, 1); plate(ctx, C, 3, -4.5, 6, 9, -1);
    for (let i = 0; i < 6; i++) { const x = -11 + i * 4.4, s = i % 2 ? -1 : 1; barrelS(ctx, C, x, s * 5.5, 5, 1.8, s * Math.PI / 2); }
    turretS(ctx, C, 3, 0, 3.2, 0); turretS(ctx, C, -8, 0, 2.6, 0);
    stripe(ctx, C, [11, -3.2, 16, -1.4, 16, 1.4, 11, 3.2]);
    nozzle(ctx, C, -18, 0, 3.2);
    windows(ctx, C, 10, -2, 3, 2); windows(ctx, C, 10, 2, 3, 2);
  },
  spear(ctx, C) {
    poly(ctx, [-20, 6, -32, 15, -35, 15, -27, 6]); hull(ctx, C, 3, 10); poly(ctx, [-20, -6, -30, -12, -33, -12, -27, -6]); hull(ctx, C, 3, -9);
    poly(ctx, [36, 0, 24, -5.5, -30, -6.5, -34, 0, -30, 6.5, 24, 5.5]); hull(ctx, C, 6.5);
    for (let x = -26; x < 22; x += 8) plate(ctx, C, x, -4.5, 7, 9, (x / 8) % 2 ? -1 : 1);
    rrect(ctx, -12, -9, 22, 18, 3); hull(ctx, C, 9);
    plate(ctx, C, -9, -6, 16, 12, -1);
    /* Railgun-Schiene oben mit Spulen */
    rrect(ctx, -28, -9.5, 60, 3, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke();
    for (let x = -24; x < 30; x += 6) { ctx.fillStyle = x % 12 ? C.trim2 : C.trim; ctx.fillRect(x, -10.2, 2.5, 4.4); }
    light(ctx, 33, -8, 1.2, C.trim2);
    stripe(ctx, C, [20, -4, 30, -1.5, 30, 1.5, 20, 4]);
    nozzle(ctx, C, -34, 0, 4.2);
    windows(ctx, C, -4, -2.5, 4, 2.5); light(ctx, 2, 1.5, 1, C.win);
  },
  hammer(ctx, C) {
    poly(ctx, [41, 0, 31, -12, -34, -14, -40, 0, -34, 14, 31, 12]); hull(ctx, C, 14);
    for (let i = 0; i < 6; i++) { const x = -30 + i * 11; plate(ctx, C, x, -12, 10, 24, i % 2 ? -1 : 1); panel(ctx, C, x + 5, -12, x + 5, 12); }
    /* Nieten entlang der Plattenkanten */
    ctx.fillStyle = C.hi; for (let i = 0; i < 6; i++) for (const y of [-10.5, 10.5]) ctx.fillRect(-28 + i * 11, y - 0.6, 1.2, 1.2);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) turretS(ctx, C, -22 + i * 12, s * 9.5, 3.2, s * Math.PI / 2);
    rrect(ctx, -8, -7, 24, 14, 3); hull(ctx, C, 7);
    plate(ctx, C, -5, -4.5, 18, 9, 1);
    stripe(ctx, C, [24, -8, 34, -3, 34, 3, 24, 8]);
    for (const y of [-6, 6]) nozzle(ctx, C, -39, y, 3.6);
    windows(ctx, C, -3, -2, 5, 3); light(ctx, 12, 0, 1.4, C.win); light(ctx, 36, 0, 1.5, C.trim2);
  },
  prospector(ctx, C) {
    circ(ctx, -11, 0, 6); hull(ctx, C, 6);
    rrect(ctx, -14, -8, 24, 16, 3); hull(ctx, C, 8);
    plate(ctx, C, -11, -6, 9, 12, -1); plate(ctx, C, 0, -6, 8, 12, 1);
    ctx.fillStyle = C.hi; for (let x = -10; x < 8; x += 4) for (const y of [-6.5, 6.5]) ctx.fillRect(x, y - 0.6, 1.2, 1.2);
    poly(ctx, [10, -6, 21, 0, 10, 6]); hull(ctx, C, 6);
    for (let i = 0; i < 3; i++) panel(ctx, C, 12 + i * 3, -4 + i * 1.3, 12 + i * 3, 4 - i * 1.3);
    stripe(ctx, C, [-6, -2, 4, -2, 4, 2, -6, 2]);
    nozzle(ctx, C, -16, 0, 2.8);
    light(ctx, 6, 0, 1, C.win);
  },
  icehauler(ctx, C) {
    rrect(ctx, -16, -6.5, 26, 13, 6); hull(ctx, C, 6.5);
    for (const x of [-10, -2, 6]) { ctx.strokeStyle = C.trim; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, -6.5); ctx.lineTo(x, 6.5); ctx.stroke(); panel(ctx, C, x + 1.5, -6.5, x + 1.5, 6.5); }
    poly(ctx, [9, -4.5, 17, -2.5, 17, 2.5, 9, 4.5]); hull(ctx, C, 4);
    nozzle(ctx, C, -16, 0, 2.8);
    light(ctx, 14, 0, 1, C.win);
  },
  /* ---- Runde 2: Enterschiffe, Flaggschiffe, Doktrin-Schiffe ---- */
  boarder(ctx, C) {
    /* gedrungener Rumpf mit zwei Enterröhren vorn und Truppenkabinen an den Flanken */
    for (const s of [-1, 1]) { rrect(ctx, -10, s * 7 - 3, 16, 6, 2); hull(ctx, C, 3, s * 7); plate(ctx, C, -7, s * 7 - 2, 10, 4, -1); windows(ctx, C, -6, s * 7, 4, 2.2); }
    poly(ctx, [15, 0, 8, -5, -13, -5, -16, 0, -13, 5, 8, 5]); hull(ctx, C, 5);
    plate(ctx, C, -11, -3.5, 7, 7, 1); plate(ctx, C, -3, -3.5, 7, 7, -1);
    for (const s of [-1, 1]) { rrect(ctx, 9, s * 3 - 1.2, 8, 2.4, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); ctx.fillStyle = C.trim; ctx.fillRect(15.5, s * 3 - 1.2, 1.5, 2.4); }
    turretS(ctx, C, 3, 0, 2.4, 0);
    stripe(ctx, C, [-14, -2, -11, -2, -11, 2, -14, 2]);
    nozzle(ctx, C, -16, 0, 2.6);
    light(ctx, 7, 0, 0.9, C.win);
  },
  archipelago(ctx, C) {
    /* Flaggschiff der Alliance: lange Spindel mit drei Ringen, Doppelbug, Werftkran hinten */
    for (const [y, r] of [[-18, 3.4], [18, 3.4], [0, 3]]) { rrect(ctx, -44, y - r, 24, r * 2, r * 0.7); hull(ctx, C, r, y); nozzle(ctx, C, -44, y, r); }
    rrect(ctx, -40, -9, 76, 18, 6); hull(ctx, C, 9);
    panel(ctx, C, -26, -9, -26, 9); panel(ctx, C, -8, -9, -8, 9); panel(ctx, C, 12, -9, 12, 9);
    stripe(ctx, C, [-36, -4, -20, -4, -20, 4, -36, 4]);
    ring3d(ctx, C, -22, 0, 17, 3.2); ring3d(ctx, C, 0, 0, 21, 3.6); ring3d(ctx, C, 20, 0, 15, 3);
    /* Feldwerft: Kranbalken oben und unten */
    for (const s of [-1, 1]) { rrect(ctx, -30, s * 23 - 2, 36, 4, 2); hull(ctx, C, 2, s * 23); for (let x = -26; x < 4; x += 8) { ctx.fillStyle = C.win; ctx.fillRect(x, s * 23 - 0.8, 1.6, 1.6); } }
    for (const s of [-1, 1]) { poly(ctx, [36, s * 8, 46, s * 4, 46, s * 1.5, 34, s * 2.5]); hull(ctx, C, 2.5, s * 5); light(ctx, 44, s * 3, 1, C.trim2); }
    circ(ctx, 30, 0, 7); hull(ctx, C, 7);
    sphere(ctx, C, 0, 0, 6, C.trim);
    light(ctx, 33, 0, 1.6, C.trim2);
    windows(ctx, C, -16, -5, 5, 3); windows(ctx, C, -16, 5, 5, 3);
  },
  olympus(ctx, C) {
    /* Flaggschiff der Republik: breiter Keil mit zwei Railgun-Schienen auf den Flanken, Kommandoturm, vier Düsen */
    poly(ctx, [44, 0, 30, -14, -36, -17, -43, 0, -36, 17, 30, 14]); hull(ctx, C, 17);
    for (let i = 0; i < 7; i++) { const x = -33 + i * 10.5; plate(ctx, C, x, -14, 9.5, 28, i % 2 ? -1 : 1); panel(ctx, C, x + 4.7, -14, x + 4.7, 14); }
    ctx.fillStyle = C.hi; for (let i = 0; i < 7; i++) for (const y of [-12.5, 12.5]) ctx.fillRect(-31 + i * 10.5, y - 0.6, 1.2, 1.2);
    /* Railgun-Schienen beidseits */
    for (const s of [-1, 1]) { rrect(ctx, -30, s * 16 - 1.5, 56, 3, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); for (let x = -26; x < 24; x += 6) { ctx.fillStyle = x % 12 ? C.trim2 : C.trim; ctx.fillRect(x, s * 16 - 2.2, 2.5, 4.4); } light(ctx, 27, s * 16, 1.1, C.trim2); }
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) turretS(ctx, C, -14 + i * 18, s * 9.5, 3.4, s * Math.PI / 2);
    rrect(ctx, -10, -8, 28, 16, 4); hull(ctx, C, 8);
    plate(ctx, C, -7, -5.5, 22, 11, 1);
    rrect(ctx, 0, -4, 12, 8, 2); hull(ctx, C, 4);
    stripe(ctx, C, [28, -9, 38, -3, 38, 3, 28, 9]);
    for (const y of [-9, -3, 3, 9]) nozzle(ctx, C, -42, y, 2.8);
    windows(ctx, C, -5, -2.5, 6, 3); light(ctx, 8, 0, 1.4, C.win); light(ctx, 39, 0, 1.5, C.trim2);
  },
  aegis(ctx, C) {
    /* Charter Guard: Scheibe mit Kuppelprojektoren an sechs Armen */
    for (const s of [-1, 1]) { rrect(ctx, -22, s * 11 - 3, 18, 6, 2.5); hull(ctx, C, 3, s * 11); nozzle(ctx, C, -22, s * 11, 2.6); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.save(); ctx.rotate(a); rrect(ctx, 14, -2, 10, 4, 1.5); hull(ctx, C, 2); ctx.restore(); light(ctx, Math.cos(a) * 25, Math.sin(a) * 25, 1.2, C.glow); }
    circ(ctx, 0, 0, 17); hull(ctx, C, 17);
    ring3d(ctx, C, 0, 0, 12, 3);
    sphere(ctx, C, 0, 0, 7, '#bcd8ea');
    stripe(ctx, C, [17, -3, 24, -1.2, 24, 1.2, 17, 3]);
    light(ctx, 0, 0, 2, C.glow);
    windows(ctx, C, -6, -9, 4, 3);
  },
  beacon(ctx, C) {
    /* Explorer Corps: kleiner Rumpf unter einer großen Sensorschüssel */
    rrect(ctx, -13, -3.5, 26, 7, 3); hull(ctx, C, 3.5); nozzle(ctx, C, -13, 0, 2.2);
    ring3d(ctx, C, -2, 0, 5, 1.8);
    ctx.save(); ctx.beginPath(); ctx.arc(2, 0, 12, -1.3, 1.3); ctx.closePath(); hull(ctx, C, 9); ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(2, 0, 4 * k, -1.3, 1.3); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.strokeStyle = C.trim; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(13, 0); ctx.stroke();
    light(ctx, 13, 0, 1.4, C.trim2);
    light(ctx, -6, 0, 0.9, C.win);
  },
  reckoning(ctx, C) {
    /* Hardliners: Kreuzer mit langer Erbauer-Lanze auf der Achse */
    for (const s of [-1, 1]) { rrect(ctx, -25, s * 10 - 3.2, 18, 6.4, 2.5); hull(ctx, C, 3.2, s * 10); nozzle(ctx, C, -25, s * 10, 2.6); plate(ctx, C, -20, s * 10 - 2, 8, 4, -1); }
    poly(ctx, [22, 0, 16, -6, -18, -7, -23, 0, -18, 7, 16, 6]); hull(ctx, C, 7);
    panel(ctx, C, -8, -6.5, -8, 6.5); panel(ctx, C, 6, -6, 6, 6);
    ring3d(ctx, C, -6, 0, 12, 2.8);
    /* Lanze: dunkler Balken mit leuchtenden Ringen, ragt über den Bug hinaus */
    rrect(ctx, 4, -2.2, 26, 4.4, 1.5); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke();
    for (let x = 8; x < 28; x += 5) { ctx.fillStyle = x % 10 ? C.glow : C.trim; ctx.fillRect(x, -2.8, 1.6, 5.6); }
    light(ctx, 30, 0, 1.8, C.glow);
    stripe(ctx, C, [-16, -4, -10, -4, -10, 4, -16, 4]);
    windows(ctx, C, -4, -4.5, 4, 2.4); windows(ctx, C, -4, 4.5, 4, 2.4);
  },
  longshot(ctx, C) {
    /* Navy Doctrine: schlanke Fregatte, Railgun-Schiene über die ganze Länge */
    poly(ctx, [-12, 4, -19, 9, -21, 9, -16, 4]); hull(ctx, C, 2, 6); poly(ctx, [-12, -4, -19, -9, -21, -9, -16, -4]); hull(ctx, C, 2, -6);
    poly(ctx, [21, 0, 12, -4.5, -17, -5, -20, 0, -17, 5, 12, 4.5]); hull(ctx, C, 5);
    plate(ctx, C, -14, -3.5, 7, 7, -1); plate(ctx, C, -6, -3.5, 7, 7, 1); plate(ctx, C, 2, -3.5, 6, 7, -1);
    rrect(ctx, -15, -6.5, 34, 2.4, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke();
    for (let x = -12; x < 18; x += 5) { ctx.fillStyle = x % 10 ? C.trim2 : C.trim; ctx.fillRect(x, -7, 2, 3.4); }
    light(ctx, 19, -5.3, 1, C.trim2);
    stripe(ctx, C, [12, -2.4, 18, -1, 18, 1, 12, 2.4]);
    nozzle(ctx, C, -20, 0, 2.8);
    light(ctx, 4, 1, 0.9, C.win);
  },
  dropship(ctx, C) {
    /* Marines: breiter Transporter, vier Landekapseln an den Flanken, Enterrampe vorn */
    poly(ctx, [18, 0, 12, -8, -16, -9, -21, 0, -16, 9, 12, 8]); hull(ctx, C, 9);
    plate(ctx, C, -13, -6, 9, 12, -1); plate(ctx, C, -3, -6, 9, 12, 1);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const x = -12 + i * 10; rrect(ctx, x, s * 9 - 2.5, 7, 5, 2); hull(ctx, C, 2.5, s * 9); light(ctx, x + 3.5, s * 9, 0.8, C.win); }
    ctx.fillStyle = C.hi; for (let x = -14; x < 8; x += 4) for (const y of [-7.5, 7.5]) ctx.fillRect(x, y - 0.6, 1.2, 1.2);
    rrect(ctx, 10, -4, 10, 8, 2); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = C.trim; ctx.fillRect(17, -4, 2, 8);
    turretS(ctx, C, 2, 0, 2.6, 0);
    stripe(ctx, C, [-19, -3, -15, -3, -15, 3, -19, 3]);
    for (const y of [-4, 4]) nozzle(ctx, C, -20, y, 2.4);
    windows(ctx, C, 4, -3, 3, 2.2);
  },
  wasp(ctx, C) {
    /* Torch Raiders: Nadel mit großer Fackel, zwei Torpedorohre unter kurzen Flügeln */
    for (const s of [-1, 1]) { poly(ctx, [-4, s * 3, -11, s * 9, -14, s * 9, -9, s * 3]); hull(ctx, C, 2, s * 6); rrect(ctx, -6, s * 7 - 1.2, 9, 2.4, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); light(ctx, 3, s * 7, 0.7, C.trim2); }
    poly(ctx, [16, 0, 7, -3.2, -11, -3.4, -14, 0, -11, 3.4, 7, 3.2]); hull(ctx, C, 3.4);
    plate(ctx, C, -9, -2.4, 6, 4.8, -1); plate(ctx, C, -2, -2.4, 6, 4.8, 1);
    stripe(ctx, C, [9, -1.8, 14, -0.7, 14, 0.7, 9, 1.8]);
    nozzle(ctx, C, -14, 0, 3);
    light(ctx, 2, 0, 0.9, C.win);
  },
  /* ---- Golden Legion: Gold und Elfenbein, Kathedralenschiffe mit Spitzbögen, Zierspitzen, violette Lichter ---- */
  restorer(ctx, C) {
    rrect(ctx, -16, -4, 10, 8, 2); hull(ctx, C, 4); nozzle(ctx, C, -16, 0, 2.6);
    rrect(ctx, -11, -8, 24, 16, 4); hull(ctx, C, 8);
    arch(ctx, C, -3, 0, 7, 10);
    for (const s of [-1, 1]) { spire(ctx, C, 8, s * 6, 10, 3.5, s * 0.5); light(ctx, 16, s * 10, 0.8, C.win); }
    stripe(ctx, C, [-9, -1.5, -3, -1.5, -3, 1.5, -9, 1.5]);
    light(ctx, 9, 0, 1.1, C.win);
  },
  gleaner(ctx, C) {
    rrect(ctx, -15, -2.5, 30, 5, 2); hull(ctx, C, 2.5); nozzle(ctx, C, -15, 0, 2.2);
    for (const x of [-7, 4]) { rrect(ctx, x - 6, -6.5, 12, 13, 4); hull(ctx, C, 6.5); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 6, -6.5); ctx.lineTo(x - 6, 6.5); ctx.moveTo(x + 6, -6.5); ctx.lineTo(x + 6, 6.5); ctx.stroke(); }
    spire(ctx, C, 10, 0, 7, 4, 0);
    light(ctx, 14, 0, 1, C.win);
  },
  cherub(ctx, C) { poly(ctx, [6, 0, -3, -4, -1, 0, -3, 4]); hull(ctx, C, 3); ctx.fillStyle = C.gold; ctx.fillRect(-1, -0.8, 3, 1.6); light(ctx, 2.5, 0, 0.7, C.win); },
  herald(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -13, s * 5 - 1.8, 9, 3.6, 1.5); hull(ctx, C, 1.8, s * 5); nozzle(ctx, C, -13, s * 5, 1.5); }
    poly(ctx, [15, 0, 6, -4, -9, -4, -11, 0, -9, 4, 6, 4]); hull(ctx, C, 4);
    arch(ctx, C, -3, 0, 6, 7);
    for (const s of [-1, 1]) spire(ctx, C, 3, s * 4, 9, 2.6, s * 0.9);
    stripe(ctx, C, [8, -1.8, 14, -0.6, 14, 0.6, 8, 1.8]);
    light(ctx, 11, 0, 1, C.win);
  },
  paladin(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -18, s * 8 - 2.6, 14, 5.2, 2); hull(ctx, C, 2.6, s * 8); nozzle(ctx, C, -18, s * 8, 2.2); }
    poly(ctx, [20, 0, 15, -4, -6, -5.5, -16, -4.5, -18, 0, -16, 4.5, -6, 5.5, 15, 4]); hull(ctx, C, 5.5);
    arch(ctx, C, -8, 0, 7, 9); arch(ctx, C, 1, 0, 6, 8);
    for (const s of [-1, 1]) spire(ctx, C, 6, s * 5, 12, 3, s * 0.8);
    /* Lanze auf der Achse */
    rrect(ctx, 8, -1.5, 14, 3, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); ctx.fillStyle = C.gold; ctx.fillRect(12, -2, 2, 4); ctx.fillRect(17, -2, 2, 4);
    light(ctx, 22, 0, 1.3, C.win);
    windows(ctx, C, -13, -2.2, 3, 2.2);
  },
  bastion(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -25, s * 13 - 3.5, 20, 7, 2.5); hull(ctx, C, 3.5, s * 13); nozzle(ctx, C, -25, s * 13, 2.8); }
    ctx.beginPath(); ctx.ellipse(0, 0, 27, 12, 0, 0, TAU); hull(ctx, C, 12);
    for (let i = 0; i < 3; i++) arch(ctx, C, -14 + i * 12, 0, 8, 12);
    for (const s of [-1, 1]) { spire(ctx, C, -10, s * 11, 14, 4, s * 1.2); spire(ctx, C, 10, s * 11, 11, 3.5, s * 1.0); }
    ring3d(ctx, C, 0, 0, 14, 2.6);
    stripe(ctx, C, [19, -5, 26, -2, 26, 2, 19, 5]);
    light(ctx, 24, 0, 1.6, C.win);
  },
  inquisitor(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -26, s * 9 - 3, 16, 6, 2.5); hull(ctx, C, 3, s * 9); nozzle(ctx, C, -26, s * 9, 2.6); }
    poly(ctx, [24, 0, 18, -5, -20, -6.5, -25, 0, -20, 6.5, 18, 5]); hull(ctx, C, 6.5);
    arch(ctx, C, -12, 0, 7, 10); arch(ctx, C, -2, 0, 7, 9);
    spire(ctx, C, -16, -7, 16, 3.5, -1.3); spire(ctx, C, -16, 7, 16, 3.5, 1.3);
    /* Verhörstrahl-Projektor: Ring mit Linse */
    ring3d(ctx, C, 14, 0, 6, 2.2); core(ctx, C, 14, 0, 2.4);
    light(ctx, 26, 0, 1.2, C.win);
    windows(ctx, C, -8, -3.2, 4, 2.5);
  },
  reliquary(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -23, s * 9 - 3, 16, 6, 2.5); hull(ctx, C, 3, s * 9); nozzle(ctx, C, -23, s * 9, 2.6); }
    rrect(ctx, -20, -8, 40, 16, 5); hull(ctx, C, 8);
    /* Reliquienschrein: Kuppel in der Mitte, vier Zierspitzen */
    sphere(ctx, C, 0, 0, 8, C.gold);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; spire(ctx, C, Math.cos(a) * 10, Math.sin(a) * 7, 12, 3, a); }
    arch(ctx, C, -13, 0, 6, 9); arch(ctx, C, 13, 0, 6, 9);
    core(ctx, C, 0, 0, 2.2);
    light(ctx, 22, 0, 1.2, C.win);
  },
  basilica(ctx, C) {
    for (const [y, r] of [[-18, 3.4], [18, 3.4], [-6, 2.6], [6, 2.6]]) { rrect(ctx, -46, y - r, 24, r * 2, r * 0.7); hull(ctx, C, r, y); nozzle(ctx, C, -46, y, r); }
    poly(ctx, [44, 0, 34, -12, -36, -14, -44, 0, -36, 14, 34, 12]); hull(ctx, C, 14);
    for (let i = 0; i < 5; i++) arch(ctx, C, -28 + i * 13, 0, 9, 16);
    for (const s of [-1, 1]) { spire(ctx, C, -30, s * 12, 22, 5, s * 1.25); spire(ctx, C, -6, s * 13, 18, 4.5, s * 1.15); spire(ctx, C, 18, s * 11, 16, 4, s * 0.9); }
    ring3d(ctx, C, 8, 0, 11, 3); sphere(ctx, C, 8, 0, 6, C.gold);
    rrect(ctx, 30, -2.5, 16, 5, 1.5); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); for (let x = 33; x < 44; x += 4) { ctx.fillStyle = x % 8 < 4 ? C.glow : C.gold; ctx.fillRect(x, -3.2, 1.8, 6.4); }
    light(ctx, 46, 0, 1.8, C.win);
    windows(ctx, C, -20, -4, 6, 4); windows(ctx, C, -20, 4, 6, 4);
  },
  sovereign(ctx, C) {
    for (const [y, r] of [[-16, 3.4], [16, 3.4], [0, 3]]) { rrect(ctx, -46, y - r, 26, r * 2, r * 0.7); hull(ctx, C, r, y); nozzle(ctx, C, -46, y, r); }
    poly(ctx, [46, 0, 38, -8, 10, -12, -34, -12, -44, 0, -34, 12, 10, 12, 38, 8]); hull(ctx, C, 12);
    for (let i = 0; i < 4; i++) arch(ctx, C, -30 + i * 12, 0, 8, 14);
    for (const s of [-1, 1]) { spire(ctx, C, -36, s * 10, 26, 5, s * 1.3); spire(ctx, C, -12, s * 11, 20, 4.5, s * 1.2); spire(ctx, C, 14, s * 10, 18, 4, s * 1.0); spire(ctx, C, 30, s * 7, 14, 3.5, s * 0.7); }
    /* Thron: großer Ring mit Kern (Seraph) */
    ring3d(ctx, C, 16, 0, 10, 3); core(ctx, C, 16, 0, 3.2);
    stripe(ctx, C, [34, -5, 44, -1.5, 44, 1.5, 34, 5]);
    light(ctx, 46, 0, 1.8, C.win);
    windows(ctx, C, -24, -3.5, 7, 3.6); windows(ctx, C, -24, 3.5, 7, 3.6);
  },
  sanctum(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -24, s * 11 - 3, 18, 6, 2.5); hull(ctx, C, 3, s * 11); nozzle(ctx, C, -24, s * 11, 2.6); }
    rrect(ctx, -20, -10, 44, 20, 6); hull(ctx, C, 10);
    for (let i = 0; i < 3; i++) arch(ctx, C, -12 + i * 12, 0, 8, 13);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) spire(ctx, C, -14 + i * 12, s * 10, 10, 3, s * Math.PI / 2);
    sphere(ctx, C, 0, 0, 6, C.gold); core(ctx, C, 0, 0, 1.8);
    light(ctx, 23, 0, 1.4, C.win);
  },
  zealot(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -16, s * 5 - 2, 10, 4, 1.5); hull(ctx, C, 2, s * 5); nozzle(ctx, C, -16, s * 5, 1.8); }
    poly(ctx, [12, 0, 4, -5, -12, -5, -14, 0, -12, 5, 4, 5]); hull(ctx, C, 5);
    arch(ctx, C, -5, 0, 6, 8);
    for (const s of [-1, 1]) spire(ctx, C, -8, s * 4.5, 12, 3, s * 1.1);
    /* Lanzenbug */
    poly(ctx, [24, 0, 10, -3.2, 10, 3.2]); ctx.fillStyle = C.gold; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); light(ctx, 22, 0, 1.2, C.glow);
    light(ctx, 6, 0, 0.9, C.win);
  },
  oracle(ctx, C) {
    rrect(ctx, -14, -3.5, 26, 7, 3); hull(ctx, C, 3.5); nozzle(ctx, C, -14, 0, 2.2);
    sphere(ctx, C, 2, 0, 9, '#d8c6ff');
    ring3d(ctx, C, 2, 0, 11, 1.6);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2 + 0.5; spire(ctx, C, 2 + Math.cos(a) * 10, Math.sin(a) * 10, 8, 2.6, a); }
    core(ctx, C, 2, 0, 2.6);
    light(ctx, 13, 0, 1, C.win);
  },
  /* ---- The Nexus: weiß-violette Kristalle, Facetten, leuchtender Kern, keine Triebwerke (Gleiten) ---- */
  seed(ctx, C) {
    facet(ctx, C, [-15, 0, -6, -8, 10, -6, 16, 0, 10, 6, -6, 8], true);
    facet(ctx, C, [-4, -4, 6, -3, 8, 0, 6, 3, -4, 4], false);
    for (const s of [-1, 1]) facet(ctx, C, [-8, s * 6, -2, s * 12, 4, s * 7], false);
    core(ctx, C, 1, 0, 2.4);
    ctx.fillStyle = C.glow; ctx.globalAlpha = 0.5; circ(ctx, -14, 0, 2.5); ctx.fill(); ctx.globalAlpha = 1;
  },
  harvester(ctx, C) {
    facet(ctx, C, [-14, -3, -14, 3, 6, 6, 14, 0, 6, -6], true);
    for (const s of [-1, 1]) facet(ctx, C, [-10, s * 3, -4, s * 10, 4, s * 9, 6, s * 4], false);
    facet(ctx, C, [6, -3, 14, 0, 6, 3, 2, 0], false);
    core(ctx, C, -2, 0, 2);
  },
  shard(ctx, C) {
    facet(ctx, C, [12, 0, -4, -5, -11, -2, -11, 2, -4, 5], true);
    facet(ctx, C, [2, -2, 8, 0, 2, 2, -3, 0], false);
    core(ctx, C, -4, 0, 1.6);
  },
  prism(ctx, C) {
    facet(ctx, C, [22, 0, 6, -9, -16, -10, -22, -3, -22, 3, -16, 10, 6, 9], true);
    facet(ctx, C, [6, -9, 14, 0, 6, 9, 0, 0], false);
    facet(ctx, C, [-16, -10, -6, -4, -16, 2], false); facet(ctx, C, [-16, 10, -6, 4, -16, -2], false);
    for (const s of [-1, 1]) facet(ctx, C, [-4, s * 8, 2, s * 15, 8, s * 9], false);
    core(ctx, C, -4, 0, 3);
    ctx.strokeStyle = C.glow; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.globalAlpha = 1;
  },
  monolith(ctx, C) {
    facet(ctx, C, [40, 0, 28, -14, -24, -16, -38, -6, -38, 6, -24, 16, 28, 14], true);
    facet(ctx, C, [28, -14, 40, 0, 28, 14, 14, 0], false);
    facet(ctx, C, [-24, -16, -8, -8, -24, 0], false); facet(ctx, C, [-24, 16, -8, 8, -24, 0], false);
    facet(ctx, C, [-8, -8, 12, -5, 14, 0, 12, 5, -8, 8, -12, 0], false);
    for (const s of [-1, 1]) { facet(ctx, C, [-6, s * 14, 0, s * 26, 10, s * 15], false); facet(ctx, C, [-26, s * 12, -22, s * 22, -14, s * 13], false); }
    core(ctx, C, 0, 0, 4.5);
    for (const s of [-1, 1]) core(ctx, C, -20, s * 8, 1.6);
    ctx.strokeStyle = C.glow; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(38, -1); ctx.moveTo(4, 2); ctx.lineTo(38, 1); ctx.stroke(); ctx.globalAlpha = 1;
  },
  binder(ctx, C) {
    facet(ctx, C, [20, 0, 8, -7, -14, -8, -20, 0, -14, 8, 8, 7], true);
    for (const s of [-1, 1]) { facet(ctx, C, [4, s * 6, 12, s * 14, 18, s * 10, 14, s * 4], false); }
    facet(ctx, C, [-14, -8, -4, -3, -14, 2], false); facet(ctx, C, [-14, 8, -4, 3, -14, -2], false);
    core(ctx, C, -2, 0, 3); ring3d(ctx, C, -2, 0, 5.5, 1.4);
  },
  lattice(ctx, C) {
    facet(ctx, C, [14, 0, 4, -6, -12, -5, -14, 0, -12, 5, 4, 6], true);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; facet(ctx, C, [Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a + 0.3) * 12, Math.sin(a + 0.3) * 12, Math.cos(a - 0.3) * 12, Math.sin(a - 0.3) * 12], false); }
    core(ctx, C, 0, 0, 3);
    ctx.strokeStyle = C.glow; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5; circ(ctx, 0, 0, 13); ctx.stroke(); ctx.globalAlpha = 1;
  },
  mirror(ctx, C) {
    facet(ctx, C, [16, 0, 8, -10, -16, -12, -22, 0, -16, 12, 8, 10], true);
    /* Spiegelfläche: große helle Facette vorn */
    facet(ctx, C, [20, -9, 24, 0, 20, 9, 8, 5, 8, -5], true);
    facet(ctx, C, [-16, -12, -6, -5, -16, 0], false); facet(ctx, C, [-16, 12, -6, 5, -16, 0], false);
    core(ctx, C, -4, 0, 3);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(23, 0); ctx.lineTo(20, 8); ctx.stroke(); ctx.globalAlpha = 1;
  },
  facet(ctx, C) {
    facet(ctx, C, [43, 0, 30, -16, -20, -18, -40, -8, -40, 8, -20, 18, 30, 16], true);
    facet(ctx, C, [30, -16, 43, 0, 30, 16, 16, 0], false);
    facet(ctx, C, [-20, -18, -2, -9, -20, 0], false); facet(ctx, C, [-20, 18, -2, 9, -20, 0], false);
    facet(ctx, C, [-2, -9, 16, -6, 18, 0, 16, 6, -2, 9, -8, 0], false);
    for (const s of [-1, 1]) { facet(ctx, C, [0, s * 16, 6, s * 30, 16, s * 17], false); facet(ctx, C, [-30, s * 10, -30, s * 24, -18, s * 16], false); facet(ctx, C, [-14, s * 17, -8, s * 28, 0, s * 18], false); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.strokeStyle = C.glow; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 14); ctx.stroke(); ctx.globalAlpha = 1; }
    core(ctx, C, 0, 0, 6); ring3d(ctx, C, 0, 0, 10, 2);
    for (const s of [-1, 1]) core(ctx, C, -26, s * 10, 2);
  },
  conduit(ctx, C) {
    facet(ctx, C, [20, 0, 8, -8, -16, -9, -22, 0, -16, 9, 8, 8], true);
    for (const s of [-1, 1]) facet(ctx, C, [2, s * 7, 10, s * 16, 20, s * 11, 14, s * 5], false);
    facet(ctx, C, [-16, -9, -4, -3, -16, 3], false); facet(ctx, C, [-16, 9, -4, 3, -16, -3], false);
    core(ctx, C, -2, 0, 3.2); ring3d(ctx, C, -2, 0, 6.5, 1.6); ring3d(ctx, C, -2, 0, 10, 1);
  },
  spire(ctx, C) {
    facet(ctx, C, [16, 0, 6, -8, -16, -9, -22, 0, -16, 9, 6, 8], true);
    facet(ctx, C, [-4, -6, 2, -24, 8, -6], false); facet(ctx, C, [-4, 6, 2, 24, 8, 6], false);
    facet(ctx, C, [-16, -9, -6, -4, -16, 2], false); facet(ctx, C, [-16, 9, -6, 4, -16, -2], false);
    core(ctx, C, 0, 0, 3.4);
    ctx.strokeStyle = C.glow; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5; circ(ctx, 0, 0, 18); ctx.stroke(); ctx.globalAlpha = 1;
    core(ctx, C, 2, -22, 1.2); core(ctx, C, 2, 22, 1.2);
  },
  colossus(ctx, C) {
    facet(ctx, C, [56, 0, 40, -22, -30, -26, -54, -10, -54, 10, -30, 26, 40, 22], true);
    facet(ctx, C, [40, -22, 56, 0, 40, 22, 22, 0], false);
    facet(ctx, C, [-30, -26, -8, -12, -30, 0], false); facet(ctx, C, [-30, 26, -8, 12, -30, 0], false);
    facet(ctx, C, [-8, -12, 20, -8, 24, 0, 20, 8, -8, 12, -14, 0], false);
    for (const s of [-1, 1]) { facet(ctx, C, [0, s * 24, 8, s * 42, 20, s * 25], false); facet(ctx, C, [-24, s * 22, -20, s * 38, -8, s * 24], false); facet(ctx, C, [-44, s * 14, -44, s * 30, -30, s * 20], false); }
    core(ctx, C, 0, 0, 8); ring3d(ctx, C, 0, 0, 14, 2.6);
    for (const s of [-1, 1]) { core(ctx, C, -36, s * 14, 2.6); core(ctx, C, 10, s * 22, 2); }
    ctx.strokeStyle = C.glow; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(54, -1); ctx.moveTo(8, 3); ctx.lineTo(54, 1); ctx.stroke(); ctx.globalAlpha = 1;
  },
  /* ---- Erbauer-Wächter: grüne Maschinen ---- */
  /* ---- The Brood ---- */
  swarmling(ctx, C) { blob(ctx, C, [6, 0, 1, -3, -4, -2, -5, 0, -4, 2, 1, 3], 3); eye(ctx, C, 2.5, 0, 0.9); for (const sg of [-1, 1]) tendril(ctx, C, -3, sg * 1.5, 4, sg * 2.4, 1.2, 0); },
  swarm(ctx, C) { const P = [[0, 0], [-7, -6], [-7, 6], [6, -5], [6, 5], [-1, 10]]; for (const [x, y] of P) { ctx.save(); ctx.translate(x, y); SHIP_DRAW.swarmling(ctx, C); ctx.restore(); } },
  larva(ctx, C) { blob(ctx, C, [9, 0, 4, -4, -3, -4, -9, -2, -9, 2, -3, 4, 4, 4], 4); ridge(ctx, C, -7, -3, 5, -3, 4, 1.6); eye(ctx, C, 5, -1.2, 1); eye(ctx, C, 5, 1.2, 1); maw(ctx, C, 8.5, 0, 1.6, 0.3); },
  seeder(ctx, C) {
    blob(ctx, C, [14, 0, 8, -7, -4, -9, -14, -6, -17, 0, -14, 6, -4, 9, 8, 7], 9);
    blob(ctx, C, [-2, -4, 6, -3, 8, 0, 6, 3, -2, 4, -6, 0], 4, true);
    for (const sg of [-1, 1]) { tendril(ctx, C, -10, sg * 6, 10, sg * 2.1, 2.5, sg * 2); sac(ctx, C, -6, sg * 6.5, 2.4); }
    ridge(ctx, C, -12, -4, 10, -5, 6, 2); eye(ctx, C, 10, -2, 1.3); eye(ctx, C, 10, 2, 1.3);
  },
  grazer(ctx, C) {
    blob(ctx, C, [12, 0, 7, -8, -5, -9, -13, -5, -14, 0, -13, 5, -5, 9, 7, 8], 9);
    sac(ctx, C, -4, -3, 3.2); sac(ctx, C, -4, 3.5, 3); sac(ctx, C, 2, 0, 2.6);
    maw(ctx, C, 10, 0, 3.4, 0.8);
    for (const sg of [-1, 1]) tendril(ctx, C, 8, sg * 5, 7, sg * 0.5, 1.8, sg * 1.5);
    ridge(ctx, C, -12, -4, 4, -7, 5, 1.8);
  },
  spitter(ctx, C) {
    blob(ctx, C, [13, 0, 6, -5, -4, -6, -12, -4, -14, 0, -12, 4, -4, 6, 6, 5], 6);
    sac(ctx, C, -3, 0, 4); sac(ctx, C, 4, -2.5, 1.8); sac(ctx, C, 4, 2.5, 1.8);
    for (const sg of [-1, 1]) tendril(ctx, C, -11, sg * 3, 7, Math.PI + sg * 0.5, 1.6, sg);
    ctx.fillStyle = C.dark; poly(ctx, [11, -2, 15, 0, 11, 2]); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke();
    eye(ctx, C, 8, -3, 1); eye(ctx, C, 8, 3, 1); ridge(ctx, C, -10, -3, 2, -4.5, 4, 1.6);
  },
  ravager(ctx, C) {
    blob(ctx, C, [16, 0, 9, -7, -2, -8, -12, -6, -17, -2, -17, 2, -12, 6, -2, 8, 9, 7], 8);
    ridge(ctx, C, -14, -4, 8, -6, 7, 2.6); ridge(ctx, C, -14, 4, 8, 6, 7, -2.6);
    blob(ctx, C, [4, -3, 10, -2, 10, 2, 4, 3, 0, 0], 3, true);
    legs(ctx, C, -2, 7, 3, 9, 14, 2.2);
    maw(ctx, C, 13, 0, 4, 1); eye(ctx, C, 9, -4, 1.2); eye(ctx, C, 9, 4, 1.2);
  },
  leech(ctx, C) {
    blob(ctx, C, [14, 0, 8, -4, -2, -5, -10, -3, -15, 0, -10, 3, -2, 5, 8, 4], 5);
    for (let i = 0; i < 5; i++) { const x = -9 + i * 4; ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, -4.5 + Math.abs(i - 2) * 0.4); ctx.lineTo(x, 4.5 - Math.abs(i - 2) * 0.4); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const sg of [-1, 1]) { tendril(ctx, C, 8, sg * 3, 9, sg * 0.35, 1.4, sg * 2); tendril(ctx, C, -12, sg * 2, 6, Math.PI + sg * 0.6, 1.4, sg); }
    sac(ctx, C, -4, 0, 2.6); ctx.fillStyle = '#ff9ad6'; ctx.globalAlpha = 0.6; circ(ctx, -4, 0, 1.4); ctx.fill(); ctx.globalAlpha = 1;
    eye(ctx, C, 11, 0, 1.3);
  },
  sporer(ctx, C) {
    blob(ctx, C, [15, 0, 10, -9, -3, -12, -15, -8, -19, 0, -15, 8, -3, 12, 10, 9], 12);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; sac(ctx, C, -4 + Math.cos(a) * 6, Math.sin(a) * 6.5, 2.4); }
    sac(ctx, C, -4, 0, 3.6);
    for (const sg of [-1, 1]) { tendril(ctx, C, -14, sg * 6, 9, Math.PI + sg * 0.4, 2, sg * 2); }
    ridge(ctx, C, 0, -10, 12, -5, 5, 2); ridge(ctx, C, 0, 10, 12, 5, 5, -2);
    eye(ctx, C, 11, -3, 1.3); eye(ctx, C, 11, 3, 1.3);
  },
  acidmaw(ctx, C) {
    blob(ctx, C, [20, 0, 12, -9, -2, -11, -14, -8, -22, -3, -22, 3, -14, 8, -2, 11, 12, 9], 11);
    sac(ctx, C, -8, -4, 4.5); sac(ctx, C, -8, 4, 4.5); sac(ctx, C, 0, 0, 3.4);
    ridge(ctx, C, -18, -6, 8, -9, 8, 2.6); ridge(ctx, C, -18, 6, 8, 9, 8, -2.6);
    maw(ctx, C, 15, 0, 5.5, 1); legs(ctx, C, -6, 10, 2, 8, 12, 2.2);
    eye(ctx, C, 10, -5, 1.4); eye(ctx, C, 10, 5, 1.4);
  },
  leviathan(ctx, C) {
    blob(ctx, C, [40, 0, 30, -12, 10, -17, -12, -18, -32, -12, -42, -4, -42, 4, -32, 12, -12, 18, 10, 17, 30, 12], 18);
    blob(ctx, C, [8, -8, 24, -5, 24, 5, 8, 8, 0, 0], 6, true);
    ridge(ctx, C, -36, -8, 22, -14, 12, 4); ridge(ctx, C, -36, 8, 22, 14, 12, -4);
    for (let i = 0; i < 4; i++) { sac(ctx, C, -24 + i * 9, -11 + (i % 2) * 2, 3.2); sac(ctx, C, -24 + i * 9, 11 - (i % 2) * 2, 3.2); }
    legs(ctx, C, -16, 16, 4, 16, 30, 3.2);
    for (const sg of [-1, 1]) tendril(ctx, C, -38, sg * 6, 18, Math.PI + sg * 0.35, 3.5, sg * 4);
    maw(ctx, C, 32, 0, 9, 1); eye(ctx, C, 24, -9, 2); eye(ctx, C, 24, 9, 2); eye(ctx, C, 16, -12, 1.3); eye(ctx, C, 16, 12, 1.3);
  },
  matriarch(ctx, C) {
    blob(ctx, C, [38, 0, 30, -14, 12, -20, -10, -22, -30, -16, -45, -6, -45, 6, -30, 16, -10, 22, 12, 20, 30, 14], 20);
    blob(ctx, C, [-6, -12, 14, -9, 20, 0, 14, 9, -6, 12, -14, 0], 10, true);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; sac(ctx, C, 2 + Math.cos(a) * 8, Math.sin(a) * 7, 3); }
    sac(ctx, C, 2, 0, 4.5);
    ridge(ctx, C, -40, -10, 24, -16, 14, 4.5); ridge(ctx, C, -40, 10, 24, 16, 14, -4.5);
    legs(ctx, C, -12, 20, 5, 18, 40, 3.4);
    for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) tendril(ctx, C, -42, sg * (3 + i * 5), 20 - i * 3, Math.PI + sg * (0.2 + i * 0.25), 3, sg * 4);
    maw(ctx, C, 30, 0, 8, 0.8); eye(ctx, C, 22, -10, 2.2); eye(ctx, C, 22, 10, 2.2); eye(ctx, C, 14, -15, 1.4); eye(ctx, C, 14, 15, 1.4); eye(ctx, C, 30, -6, 1.2); eye(ctx, C, 30, 6, 1.2);
  },
  broodmother(ctx, C) {
    blob(ctx, C, [16, 0, 10, -10, -4, -13, -16, -10, -21, 0, -16, 10, -4, 13, 10, 10], 13);
    blob(ctx, C, [-14, -5, -4, -8, 2, 0, -4, 8, -14, 5, -17, 0], 7, true);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; ctx.save(); ctx.translate(-8 + Math.cos(a) * 5, Math.sin(a) * 6); ctx.scale(0.6, 0.6); SHIP_DRAW.swarmling(ctx, C); ctx.restore(); }
    ridge(ctx, C, -4, -12, 12, -6, 6, 2.4); ridge(ctx, C, -4, 12, 12, 6, 6, -2.4);
    legs(ctx, C, 0, 12, 3, 10, 16, 2.4);
    eye(ctx, C, 12, -4, 1.5); eye(ctx, C, 12, 4, 1.5);
  },
  plaguebearer(ctx, C) {
    blob(ctx, C, [18, 0, 10, -8, -4, -10, -15, -7, -20, 0, -15, 7, -4, 10, 10, 8], 10);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; sac(ctx, C, -4 + Math.cos(a) * 7, Math.sin(a) * 6, 2.2); ctx.fillStyle = '#ff9ad6'; ctx.globalAlpha = 0.5; circ(ctx, -4 + Math.cos(a) * 7, Math.sin(a) * 6, 1.1); ctx.fill(); ctx.globalAlpha = 1; }
    for (const sg of [-1, 1]) { tendril(ctx, C, 10, sg * 6, 10, sg * 0.4, 2, sg * 2); tendril(ctx, C, -16, sg * 4, 8, Math.PI + sg * 0.5, 1.8, sg); }
    eye(ctx, C, 13, -3, 1.3); eye(ctx, C, 13, 3, 1.3);
  },
  behemoth(ctx, C) {
    blob(ctx, C, [38, 0, 28, -14, 6, -18, -16, -18, -36, -12, -44, -5, -44, 5, -36, 12, -16, 18, 6, 18, 28, 14], 18);
    for (let i = 0; i < 4; i++) { ridge(ctx, C, -34 + i * 2, -12 + i * 2.5, 20 + i * 2, -16 + i * 2.5, 10, 5 - i); }
    ridge(ctx, C, -34, 12, 22, 16, 12, -5);
    blob(ctx, C, [12, -6, 26, -4, 26, 4, 12, 6, 6, 0], 5, true);
    legs(ctx, C, -14, 17, 4, 14, 32, 3.6);
    for (let i = 0; i < 3; i++) { const x = 30 - i * 7; ctx.fillStyle = C.bone; poly(ctx, [x, -6 - i, x + 9, -2, x, -1]); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); poly(ctx, [x, 6 + i, x + 9, 2, x, 1]); ctx.fill(); ctx.stroke(); }
    maw(ctx, C, 31, 0, 7, 0.6); eye(ctx, C, 20, -10, 1.8); eye(ctx, C, 20, 10, 1.8);
  },
  drone(ctx, C) {
    poly(ctx, [13, 0, 4, -6, -9, -7, -13, 0, -9, 7, 4, 6]); hull(ctx, C, 7);
    for (const s of [-1, 1]) { poly(ctx, [-2, s * 6, -8, s * 13, -11, s * 12, -6, s * 6]); hull(ctx, C, 2, s * 9); }
    ring3d(ctx, C, 0, 0, 4.5, 1.6); core(ctx, C, 0, 0, 1.8);
    panel(ctx, C, 6, -4, 6, 4);
  },
  warden(ctx, C) {
    circ(ctx, 0, 0, 40); hull(ctx, C, 40);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.save(); ctx.rotate(a); rrect(ctx, 30, -7, 30, 14, 4); hull(ctx, C, 7); plate(ctx, C, 34, -4.5, 20, 9, -1); ctx.restore(); core(ctx, C, Math.cos(a) * 58, Math.sin(a) * 58, 2.2); }
    ring3d(ctx, C, 0, 0, 30, 4); ring3d(ctx, C, 0, 0, 18, 3);
    ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.stroke(); } ctx.globalAlpha = 1;
    core(ctx, C, 0, 0, 8);
    rrect(ctx, 34, -3, 24, 6, 2); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke(); light(ctx, 58, 0, 2, C.glow);
  },
  sentinel(ctx, C) {
    for (const s of [-1, 1]) { rrect(ctx, -34, s * 12 - 3, 20, 6, 2.5); hull(ctx, C, 3, s * 12); nozzle(ctx, C, -34, s * 12, 2.6); }
    poly(ctx, [38, 0, 26, -9, -24, -11, -32, 0, -24, 11, 26, 9]); hull(ctx, C, 11);
    for (let i = 0; i < 4; i++) plate(ctx, C, -22 + i * 11, -8, 10, 16, i % 2 ? -1 : 1);
    ring3d(ctx, C, 8, 0, 9, 2.6); core(ctx, C, 8, 0, 3);
    rrect(ctx, 24, -2.5, 16, 5, 1.5); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); light(ctx, 40, 0, 1.6, C.glow);
    windows(ctx, C, -18, -3, 5, 3);
  }
};
/* Bildspeicher eines Schiffstyps in Spielerfarbe bei Maßstab s (Pixel je Weltpixel); SHIP_VIS vergrößert die Zeichnung
   gegenüber dem Rumpfradius der Simulation, damit Schiffe am Handy nicht winzig wirken */
const SHIP_VIS = 1.15;
/* Veredelung eines fertigen Bildspeichers: Kantenschatten unten rechts, Kantenlicht oben links, Glanzband und ein
   feines Plattenmuster quer über den Rumpf – alles aus der eigenen Alphamaske, wirkt deshalb auf jede Form */
function finishSprite(c, lightCol, k) {
  const w = c.width, h = c.height, ctx = c.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const t = tmp.getContext('2d');
  t.drawImage(c, 0, 0);
  /* Maske in einer Farbe */
  const tint = col => { t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, w, h); t.globalCompositeOperation = 'source-over'; };
  const body = document.createElement('canvas'); body.width = w; body.height = h; body.getContext('2d').drawImage(c, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  /* 1. dunkle Kante: Maske nach unten rechts versetzt, darüber der Rumpf → bleibt als Schattenkante sichtbar */
  tint('rgba(0,0,0,0.55)');
  ctx.drawImage(tmp, k * 1.2, k * 1.2);
  /* 2. Lichtkante: helle Maske nach oben links versetzt */
  t.clearRect(0, 0, w, h); t.drawImage(body, 0, 0); tint(lightCol);
  ctx.drawImage(tmp, -k * 0.9, -k * 0.9);
  /* 3. der Rumpf selbst */
  ctx.drawImage(body, 0, 0);
  /* 4. innerhalb des Rumpfs: Glanzband, Verlaufslicht, feines Plattenmuster */
  ctx.globalCompositeOperation = 'source-atop';
  const g1 = ctx.createLinearGradient(0, 0, w, h);
  g1.addColorStop(0, 'rgba(255,255,255,0.16)'); g1.addColorStop(0.45, 'rgba(255,255,255,0)'); g1.addColorStop(1, 'rgba(0,0,30,0.22)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createLinearGradient(0, h * 0.2, w * 0.6, h * 0.9);
  g2.addColorStop(0.3, 'rgba(255,255,255,0)'); g2.addColorStop(0.45, 'rgba(255,255,255,0.13)'); g2.addColorStop(0.5, 'rgba(255,255,255,0.2)'); g2.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 5 * k) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h * 0.4, h); ctx.stroke(); }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function shipSprite(type, f, col, s) {
  const def = SHIPS[type] || { len: 14 }, size = Math.ceil(def.len * 1.3 * SHIP_VIS * s) + 8;
  return sprite('u|' + type + '|' + col + '|' + s, size, size, ctx => {
    ctx.scale(s * SHIP_VIS, s * SHIP_VIS); ctx.lineJoin = 'round'; SHIP_DRAW[type](ctx, shipCols(f, col));
    if (col !== 'wreck') finishSprite(ctx.canvas, f === 'alliance' ? 'rgba(220,245,255,0.75)' : f === 'brood' ? 'rgba(214,255,106,0.45)' : 'rgba(255,225,200,0.6)', s);
  });
}
/* Triebwerkspositionen (hinten) je Typ: [x, y, Stärke] */
const ENGINES = {
  wren: [[-12, -5, 0.7], [-12, 5, 0.7]], lancer: [[-17, -8.5, 0.9], [-17, 8.5, 0.9]], bulwark: [[-24, -13, 1], [-24, 13, 1]], haven: [[-41, -15, 1], [-41, 15, 1], [-41, 0, 0.8]],
  pathfinder: [[-17, 0, 0.9]], hauler: [[-15, 0, 0.8]], fighter: [[-4, 0, 0.5]],
  needle: [[-15, 0, 1.4]], hedgehog: [[-18, 0, 1.3]], spear: [[-34, 0, 1.6]], hammer: [[-39, -6, 1.5], [-39, 6, 1.5]], prospector: [[-16, 0, 1]], icehauler: [[-16, 0, 1]],
  boarder: [[-16, 0, 1.2]], archipelago: [[-44, -18, 1], [-44, 18, 1], [-44, 0, 0.8]], olympus: [[-42, -9, 1.3], [-42, -3, 1.3], [-42, 3, 1.3], [-42, 9, 1.3]], aegis: [[-22, -11, 0.9], [-22, 11, 0.9]], beacon: [[-13, 0, 0.7]],
  reckoning: [[-25, -10, 0.9], [-25, 10, 0.9]], longshot: [[-20, 0, 1.3]], dropship: [[-20, -4, 1.1], [-20, 4, 1.1]], wasp: [[-14, 0, 1.9]],
  restorer: [[-16, 0, 0.9]], gleaner: [[-15, 0, 0.8]], cherub: [[-3, 0, 0.4]], herald: [[-13, -5, 0.6], [-13, 5, 0.6]], paladin: [[-18, -8, 0.8], [-18, 8, 0.8]], bastion: [[-25, -13, 1], [-25, 13, 1]],
  inquisitor: [[-26, -9, 0.9], [-26, 9, 0.9]], reliquary: [[-23, -9, 0.9], [-23, 9, 0.9]], basilica: [[-46, -18, 1], [-46, 18, 1], [-46, -6, 0.8], [-46, 6, 0.8]], sovereign: [[-46, -16, 1], [-46, 16, 1], [-46, 0, 0.8]],
  sanctum: [[-24, -11, 0.9], [-24, 11, 0.9]], zealot: [[-16, -5, 0.8], [-16, 5, 0.8]], oracle: [[-14, 0, 0.7]],
  seed: [[-15, 0, 0.6]], harvester: [[-14, 0, 0.6]], shard: [[-11, 0, 0.5]], prism: [[-22, 0, 0.8]], monolith: [[-38, 0, 1.1]], binder: [[-20, 0, 0.7]], lattice: [[-14, 0, 0.6]], mirror: [[-22, 0, 0.8]], facet: [[-40, 0, 1.2]], conduit: [[-22, 0, 0.7]], spire: [[-22, 0, 0.7]], colossus: [[-54, 0, 1.4]],
  swarmling: [], swarm: [], larva: [[-9, 0, 0.3]], seeder: [[-17, 0, 0.5]], grazer: [[-14, 0, 0.5]], spitter: [[-14, 0, 0.5]], ravager: [[-17, 0, 0.6]], leech: [[-15, 0, 0.4]], sporer: [[-19, 0, 0.6]], acidmaw: [[-22, 0, 0.7]],
  leviathan: [[-42, -4, 0.9], [-42, 4, 0.9]], matriarch: [[-45, -6, 0.9], [-45, 6, 0.9]], broodmother: [[-21, 0, 0.6]], plaguebearer: [[-20, 0, 0.6]], behemoth: [[-44, -5, 0.9], [-44, 5, 0.9]],
  drone: [[-13, 0, 0.8]], warden: [[-40, -12, 1], [-40, 12, 1]], sentinel: [[-34, -12, 1], [-34, 12, 1]]
};

/* ------------------------------------------------------------------ Stationen
   drawBldg(ctx, role, f, lv, col, t, b): ganz gezeichnet (statische und bewegte Teile), Ursprung Mitte, Welt-Maßstab.
   Mars baut in Asteroiden: unter jeder Station liegt ein Felsbrocken; Alliance baut weiße Ringmodule. */
/* Asteroid unter einer Mars-Station: beleuchtet von oben links, Oberfläche aus Rauschen, Krater, Tag-Nacht-Grenze.
   Als Bildspeicher je Größe und Startwert, weil die Station jede Runde neu gezeichnet wird. */
function rockPoly(ctx, r, seed) {
  const s = 2, size = Math.ceil(r * 2.4 * s);
  const c = sprite('rock|' + Math.round(r) + '|' + seed, size, size, x => {
    x.scale(s, s);
    const rng = makeRng(seed), n = 12;
    x.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.8 + rng() * 0.32); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath();
    const gr = x.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r * 1.1);
    gr.addColorStop(0, '#9a8468'); gr.addColorStop(0.6, '#5e4d3f'); gr.addColorStop(1, '#2a221c');
    x.fillStyle = gr; x.fill();
    x.save(); x.clip();
    if (typeof noiseCanvas === 'function') { x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.85; x.drawImage(noiseCanvas(256, 9), -r * 1.15, -r * 1.15, r * 2.3, r * 2.3); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    for (let i = 0; i < 6; i++) { const a = rng() * TAU, d = rng() * r * 0.75, cr = r * (0.06 + rng() * 0.1), cx = Math.cos(a) * d, cy = Math.sin(a) * d; x.beginPath(); x.arc(cx, cy, cr, 0, TAU); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fill(); x.beginPath(); x.arc(cx + cr * 0.22, cy + cr * 0.22, cr * 0.8, 0, TAU); x.fillStyle = 'rgba(255,235,210,0.16)'; x.fill(); x.beginPath(); x.arc(cx - cr * 0.1, cy - cr * 0.1, cr * 0.55, 0, TAU); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fill(); }
    const tg = x.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(0.7, 'rgba(0,0,0,0.1)'); tg.addColorStop(1, 'rgba(0,0,0,0.7)');
    x.fillStyle = tg; x.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    x.restore();
    x.strokeStyle = '#1b1512'; x.lineWidth = 1.4; x.stroke();
  });
  const w = c.width / s;
  ctx.drawImage(c, -w / 2, -w / 2, w, w);
}
function bldgCols(f, col) {
  if (f === 'brood') return { hull: '#6f4d85', hi: '#b48ccc', lo: '#33203f', dark: '#4e3560', line: '#1a0f22', trim: col, trim2: '#2e8b3a', glow: '#d6ff6a', win: '#b4ff3c', flesh: '#c46a8a', bone: '#d9c9b0' };
  if (f === 'alliance') return { hull: '#dfe7ee', hi: '#ffffff', lo: '#93a5b6', dark: '#a9b8c6', line: '#44586c', trim: col, trim2: '#4f8fc8', glow: '#8fe3ff', win: '#a8f4ff' };
  if (f === 'legion') return { hull: '#e9d8ad', hi: '#fff6dc', lo: '#9d7f3c', dark: '#c9a85a', line: '#5a4315', trim: col, trim2: '#8e5bd6', glow: '#c9a0ff', win: '#e0c8ff', gold: '#f2c14e' };
  if (f === 'nexus') return { hull: '#efe9fb', hi: '#ffffff', lo: '#a98fd6', dark: '#cbb8ec', line: '#5a3f8f', trim: col, trim2: '#7a4fd0', glow: '#eadcff', win: '#ffffff' };
  return { hull: '#8d9096', hi: '#c0c4cb', lo: '#45484f', dark: '#5f636a', line: '#1b1d21', trim: col, trim2: '#c23e2a', glow: '#ffb070', win: '#ffd27a' };
}
/* Kristallsockel des Nexus: Splitterkranz unter der Station, nach außen zeigend */
function crystalBase(ctx, C, r, seed, t) {
  const rng = makeRng(seed), n = 7 + (seed % 4);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + rng() * 0.3, l = r * (0.75 + rng() * 0.45), w = r * (0.18 + rng() * 0.14), r0 = r * 0.3; ctx.save(); ctx.rotate(a); poly(ctx, [r0, -w, l, 0, r0, w, r0 * 0.6, 0]); const g = ctx.createLinearGradient(r0, 0, l, 0); g.addColorStop(0, C.lo); g.addColorStop(0.6, C.hull); g.addColorStop(1, C.hi); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore(); }
  ctx.fillStyle = C.glow; ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2 + seed); circ(ctx, 0, 0, r * 0.5); ctx.fill(); ctx.globalAlpha = 1;
}
/* Goldener Sockel der Legion: wiederhergestellte Erbauer-Plattform mit Zierspitzen */
function goldBase(ctx, C, r, seed) {
  const n = 8;
  ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); } ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#3a2f55'); g.addColorStop(1, '#1d1733'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.6; ctx.stroke();
  for (let i = 0; i < n; i++) { const a = i / n * TAU; spire(ctx, C, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.22, r * 0.09, a); }
  ctx.strokeStyle = C.gold; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5; circ(ctx, 0, 0, r * 0.7); ctx.stroke(); ctx.globalAlpha = 1;
}
/* Ring aus Segmenten, dreht sich; hell oben, dunkel unten wie ring3d */
function ringDash(ctx, r, n, w, a0, C, colTop) {
  const seg = r * TAU / n;
  ctx.setLineDash([seg * 0.58, seg * 0.42]); ctx.lineDashOffset = -a0 * r;
  ctx.lineWidth = w; ctx.strokeStyle = C.lo; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = colTop || C.hi; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, r + w / 2, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r - w / 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
/* schattierte Kugel (Tanks, Kuppeln) */
function sphere(ctx, C, x, y, r, tint) {
  const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  gr.addColorStop(0, C.hi); gr.addColorStop(0.5, tint || C.hull); gr.addColorStop(1, C.lo);
  circ(ctx, x, y, r); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.1; ctx.stroke();
}
function spoke(ctx, C, a, r0, r1, w) { ctx.save(); ctx.rotate(a); rrect(ctx, r0, -w / 2, r1 - r0, w, w / 3); hull(ctx, C, w / 2); ctx.restore(); }
/* Nester der Brood: Membran mit Adern unter jeder Station, darauf organische Formen je Rolle; alles pulsiert */
function membrane(ctx, C, r, seed, t) {
  const rng = makeRng(seed), n = 14, pulse = 1 + 0.02 * Math.sin(t * 1.5 + seed);
  ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.82 + rng() * 0.2) * pulse; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#5a3a6a'); g.addColorStop(0.7, '#33203f'); g.addColorStop(1, '#1d1026');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = C.flesh; ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
  for (let i = 0; i < 7; i++) { const a = rng() * TAU, l = r * (0.5 + rng() * 0.4); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15); ctx.quadraticCurveTo(Math.cos(a + 0.4) * l * 0.5, Math.sin(a + 0.4) * l * 0.5, Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawNest(ctx, C, role, lv, t, b, R) {
  const pulse = 1 + 0.05 * Math.sin(t * 2.2 + lv), aim = b && b.aimA !== undefined ? b.aimA : 0, ch = b ? b.charge : 0.5;
  const dome = (x, y, r, flesh) => { const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, C.hi); g.addColorStop(0.55, flesh ? C.flesh : C.hull); g.addColorStop(1, C.lo); circ(ctx, x, y, r); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.1; ctx.stroke(); };
  const spitTube = (x, y, len, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.quadraticCurveTo(len * 0.6, -4, len, -1.5); ctx.lineTo(len, 1.5); ctx.quadraticCurveTo(len * 0.6, 4, 0, 3.5); ctx.closePath(); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = C.win; circ(ctx, len, 0, 1.4); ctx.fill(); ctx.restore(); };
  switch (role) {
    case 'base': {
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.03; tendril(ctx, C, Math.cos(a) * 30, Math.sin(a) * 30, 28 + (lv - 1) * 6, a, 7, 4 * Math.sin(t + i)); }
      if (lv >= 2) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; sac(ctx, C, Math.cos(a) * 44, Math.sin(a) * 44, 4 + lv); }
      dome(0, 0, 34 * pulse, true);
      ctx.strokeStyle = C.lo; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.quadraticCurveTo(Math.cos(a + 0.3) * 20, Math.sin(a + 0.3) * 20, Math.cos(a) * 32, Math.sin(a) * 32); ctx.stroke(); } ctx.globalAlpha = 1;
      if (lv >= 3) ridge(ctx, C, -30, -20, 30, -20, 8, 5);
      const nT = lv >= 3 ? 6 : lv >= 2 ? 2 : 0;
      for (let i = 0; i < nT; i++) { const a = i / nT * TAU + Math.PI / 2, x = Math.cos(a) * 48, y = Math.sin(a) * 48; dome(x, y, 6); spitTube(x, y, 11, aim); }
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + t * 0.4; eye(ctx, C, Math.cos(a) * 14, Math.sin(a) * 14, 2.2); }
      ctx.fillStyle = C.glow; ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.2); circ(ctx, 0, 0, 8 * pulse); ctx.fill(); ctx.globalAlpha = 1; circ(ctx, 0, 0, 3.5); ctx.fillStyle = '#fff'; ctx.fill();
      break;
    }
    case 'yard': {
      const L = lv === 1 ? 40 : lv === 2 ? 48 : 54;
      smoothPath(ctx, [-L / 2, -16, 0, -22, L / 2, -16, L / 2 + 6, 0, L / 2, 16, 0, 22, -L / 2, 16, -L / 2 - 6, 0]); ctx.fillStyle = '#2a0c18'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = C.flesh; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; smoothPath(ctx, [-L / 2 + 4, -12, 0, -17, L / 2 - 4, -12, L / 2, 0, L / 2 - 4, 12, 0, 17, -L / 2 + 4, 12, -L / 2, 0]); ctx.stroke(); ctx.globalAlpha = 1;
      const nE = lv + 2;
      for (let i = 0; i < nE; i++) { const x = -L / 2 + 10 + i * (L - 20) / Math.max(1, nE - 1), y = (i % 2 ? 5 : -5), k = (Math.sin(t * 1.3 + i * 1.7) + 1) / 2; dome(x, y, 5 + 2 * k); ctx.fillStyle = C.win; ctx.globalAlpha = 0.3 + 0.5 * k; circ(ctx, x, y, 2.5); ctx.fill(); ctx.globalAlpha = 1; }
      for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) tendril(ctx, C, -L / 2 + 8 + i * L / 3, sg * 20, 9, sg * Math.PI / 2, 3.5, 2 * Math.sin(t * 2 + i));
      if (lv >= 3) { ridge(ctx, C, -L / 2, -24, L / 2, -24, 8, 4); ridge(ctx, C, -L / 2, 24, L / 2, 24, 8, -4); }
      break;
    }
    case 'refinery': {
      const n = lv + 1;
      for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2, d = n === 2 ? 11 : 16; dome(Math.cos(a) * d, Math.sin(a) * d, 13 - lv, true); }
      for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2; tendril(ctx, C, Math.cos(a) * 22, Math.sin(a) * 22, 14, a, 5, 3 * Math.sin(t * 1.5 + i)); }
      dome(0, 0, 9 * pulse);
      ctx.fillStyle = C.win; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3); circ(ctx, 0, 0, 4); ctx.fill(); ctx.globalAlpha = 1;
      if (lv >= 3) { ctx.strokeStyle = C.glow; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 15; circ(ctx, 0, 0, 30); ctx.stroke(); ctx.setLineDash([]); }
      break;
    }
    case 'reactor': {
      const n = 3 + lv * 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.1, k = 0.8 + 0.2 * Math.sin(t * 3 + i); sac(ctx, C, Math.cos(a) * 14, Math.sin(a) * 14, (4 + lv) * k); }
      dome(0, 0, 10 * pulse, true);
      ctx.fillStyle = C.glow; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4); circ(ctx, 0, 0, 6 * pulse); ctx.fill(); ctx.globalAlpha = 1; circ(ctx, 0, 0, 2.5); ctx.fillStyle = '#fff'; ctx.fill();
      break;
    }
    case 'lab': {
      /* Cortex: zwei Gehirnhälften mit Furchen, ab Stufe 2 Nervenstränge, Stufe 3 Augenkranz */
      for (const sg of [-1, 1]) { smoothPath(ctx, [sg * 2, -14, sg * 14, -10, sg * 16, 0, sg * 14, 10, sg * 2, 14, sg * 1, 0]); const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, C.hi); g.addColorStop(0.5, C.flesh); g.addColorStop(1, C.lo); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.1; ctx.stroke(); ctx.strokeStyle = C.lo; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sg * 4, -10 + i * 6); ctx.quadraticCurveTo(sg * 9, -8 + i * 6, sg * 13, -11 + i * 6); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; tendril(ctx, C, Math.cos(a) * 15, Math.sin(a) * 15, 14, a, 3, 3 * Math.sin(t * 2 + i)); sac(ctx, C, Math.cos(a) * 29, Math.sin(a) * 29, 3); }
      if (lv >= 3) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.15; eye(ctx, C, Math.cos(a) * 22, Math.sin(a) * 22, 1.6); }
      eye(ctx, C, 0, 0, 2.6);
      break;
    }
    case 'turret': {
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, rr = 15 * (i % 2 ? 0.85 : 1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); hull(ctx, C, 15);
      circ(ctx, 0, 0, 9); ctx.fillStyle = '#4e7a1a'; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.fillStyle = C.win; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3); circ(ctx, 0, 0, 6 * pulse); ctx.fill(); ctx.globalAlpha = 1;
      const nB = lv >= 2 ? 2 : 1;
      for (let i = 0; i < nB; i++) spitTube(Math.cos(aim + (i ? 0.5 : -0.5) * (nB - 1)) * 4, Math.sin(aim + (i ? 0.5 : -0.5) * (nB - 1)) * 4, lv >= 3 ? 20 : 15, aim + (nB > 1 ? (i ? 0.25 : -0.25) : 0));
      if (lv >= 3) spitTube(0, 0, 24, aim);
      break;
    }
    case 'spore': {
      const r = lv === 1 ? 15 : lv === 2 ? 18 : 21;
      for (let i = 0; i < 6 + lv * 2; i++) { const a = i / (6 + lv * 2) * TAU + t * 0.1, d = r * (0.9 + 0.3 * Math.sin(t * 1.5 + i)); ctx.fillStyle = C.win; ctx.globalAlpha = 0.5; circ(ctx, Math.cos(a) * d, Math.sin(a) * d, 1.6); ctx.fill(); ctx.globalAlpha = 1; }
      dome(0, 0, r * pulse);
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.4, d = r * 0.55; sac(ctx, C, Math.cos(a) * d, Math.sin(a) * d, r * 0.18); }
      ctx.fillStyle = C.glow; ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2.5); circ(ctx, 0, 0, r * 0.45); ctx.fill(); ctx.globalAlpha = 1;
      break;
    }
    case 'relay': {
      tendril(ctx, C, -16, 0, 32, 0, 5, 0);
      for (let i = 0; i < lv + 1; i++) { const x = -12 + i * 24 / lv; sac(ctx, C, x, 0, 3.5 + (Math.sin(t * 4 + i) > 0.3 ? 1 : 0)); }
      dome(0, 0, 7 * pulse, true);
      const bl = (Math.sin(t * 4) > 0.3) ? 1 : 0.35;
      ctx.globalAlpha = bl; eye(ctx, C, 0, 0, 2.4); ctx.globalAlpha = 1;
      break;
    }
    case 'super': {
      /* Brutsturm: Eierkranz um einen Mutterleib, Eier glühen mit der Ladung, aus dem Leib wachsen Tentakel */
      const n = 8 + lv * 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.02; tendril(ctx, C, Math.cos(a) * 20, Math.sin(a) * 20, 30, a, 5, 4 * Math.sin(t * 1.2 + i)); }
      for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.02, lit = i / n < ch; dome(Math.cos(a) * 42, Math.sin(a) * 42, 7); if (lit) { ctx.fillStyle = C.win; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + i); circ(ctx, Math.cos(a) * 42, Math.sin(a) * 42, 3.5); ctx.fill(); ctx.globalAlpha = 1; } }
      dome(0, 0, 22 * pulse, true);
      ridge(ctx, C, -18, -14, 18, -14, 6, 4);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + t * 0.3; eye(ctx, C, Math.cos(a) * 11, Math.sin(a) * 11, 2); }
      ctx.fillStyle = C.glow; ctx.globalAlpha = 0.3 + 0.5 * ch; circ(ctx, 0, 0, 7 + 4 * ch); ctx.fill(); ctx.globalAlpha = 1;
      break;
    }
  }
}
/* Das Siegel: Erbauer-Tor, das sich nie öffnen darf – grüne Ringe, acht Pfeiler, innen ein verriegelter Wirbel; mit der
   Hülle wird das Licht schwächer, ab Stufe 2 Lanzentürme */
function drawSeal(ctx, lv, t, b) {
  const C = SITE_C, r = 78, hp = b ? b.hull / b.hullMax : 1;
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.92 : 1), Math.sin(a) * r * (i % 2 ? 0.92 : 1)); } ctx.closePath();
  const g0 = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g0.addColorStop(0, '#3c4a44'); g0.addColorStop(1, '#141c18'); ctx.fillStyle = g0; ctx.fill(); ctx.strokeStyle = C.hi; ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.save(); ctx.rotate(a); rrect(ctx, r * 0.62, -r * 0.08, r * 0.34, r * 0.16, 3); hull(ctx, C, r * 0.08); ctx.restore(); light(ctx, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 1.8, hp > 0.35 ? C.glow : '#ff8a6a'); }
  ringDash(ctx, r * 0.58, 20, r * 0.09, t * 0.05, C, C.hi);
  if (lv >= 2) ringDash(ctx, r * 0.72, 24, r * 0.05, -t * 0.08, C, C.glow);
  const k = 0.35 + 0.65 * hp, gr = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.48);
  gr.addColorStop(0, 'rgba(255,255,255,' + (0.7 * k) + ')'); gr.addColorStop(0.45, 'rgba(120,230,200,' + (0.5 * k) + ')'); gr.addColorStop(1, 'rgba(120,230,200,0)');
  circ(ctx, 0, 0, r * 0.48); ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = 'rgba(159,240,192,' + (0.5 * k) + ')'; ctx.lineWidth = 1.4;
  for (let q = 0; q < 3; q++) { ctx.beginPath(); for (let i = 0; i <= 32; i++) { const a = i / 32 * TAU, rr = r * (0.14 + q * 0.1) + Math.sin(a * 6 + t * (1 + q * 0.5)) * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); }
  /* Riegel: vier Balken über dem Wirbel */
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i / 4 * TAU + t * 0.02); rrect(ctx, r * 0.1, -r * 0.035, r * 0.36, r * 0.07, 2); hull(ctx, C, r * 0.035); ctx.restore(); }
  core(ctx, C, 0, 0, 4);
  if (lv >= 2) { const aim = b && b.aimA !== undefined ? b.aimA : 0; for (let i = 0; i < (lv >= 3 ? 4 : 2); i++) { const a = i / (lv >= 3 ? 4 : 2) * TAU, x = Math.cos(a) * r * 0.82, y = Math.sin(a) * r * 0.82; turretS(ctx, C, x, y, 5, aim); } }
}
function drawBldg(ctx, role, f, lv, col, t, b) {
  if (role === 'seal') { drawSeal(ctx, lv, t, b); return; }
  const C = bldgCols(f, col), mars = f === 'mars', R = BLDG[f][role].r;
  if (f === 'brood') { membrane(ctx, C, R * 0.98, hashStr(role) + lv * 17, t); drawNest(ctx, C, role, lv, t, b, R); return; }
  if (mars) rockPoly(ctx, R * 0.98, hashStr(role) + lv * 17);
  else if (f === 'nexus') crystalBase(ctx, C, R * 0.98, hashStr(role) + lv, t);
  else if (f === 'legion') goldBase(ctx, C, R * 0.98, hashStr(role) + lv);
  const aim = b && b.aimA !== undefined ? b.aimA : 0;
  switch (role) {
    case 'base': {
      /* Ringe: 1 (Stufe 1), gegenläufiger 2. (Stufe 2), 3. mit Leuchtkranz (Stufe 3) */
      if (lv >= 3) { ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 3); ctx.strokeStyle = C.glow; ctx.lineWidth = 5; circ(ctx, 0, 0, 63); ctx.stroke(); ctx.globalAlpha = 1; ringDash(ctx, 62, 18, 3.5, t * 0.22, C, C.trim); }
      if (lv >= 2) { for (let i = 0; i < 4; i++) spoke(ctx, C, i / 4 * TAU + Math.PI / 4, 24, 52, 5); ringDash(ctx, 53, 14, 5, -t * 0.3, C); }
      ringDash(ctx, 42, 10, 5, t * 0.4, C);
      circ(ctx, 0, 0, 30); hull(ctx, C, 30);
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.stroke(); } ctx.globalAlpha = 1;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.1; ctx.fillStyle = C.win; ctx.fillRect(Math.cos(a) * 22 - 1, Math.sin(a) * 22 - 1, 2, 2); }
      ring3d(ctx, C, 0, 0, 13, 3);
      sphere(ctx, C, 0, 0, 8, C.trim);
      circ(ctx, 0, 0, 3.5); ctx.fillStyle = C.glow; ctx.fill(); circ(ctx, 0, 0, 1.6); ctx.fillStyle = '#fff'; ctx.fill();
      /* Türme ab Stufe 2 */
      const nT = lv >= 3 ? 4 : lv >= 2 ? 2 : 0;
      for (let i = 0; i < nT; i++) { const a = i / nT * TAU + (nT === 2 ? Math.PI / 2 : Math.PI / 4), x = Math.cos(a) * 53, y = Math.sin(a) * 53; turretS(ctx, C, x, y, 4.5, aim); }
      if (lv >= 3) barrelS(ctx, C, 0, 0, 19, 5, aim);
      break;
    }
    case 'yard': {
      const L = lv === 1 ? 44 : lv === 2 ? 54 : 58, h = 22;
      rrect(ctx, -L / 2 - 6, -h - 8, 10, 2 * h + 16, 3); hull(ctx, C, 5);
      for (const s of [-1, 1]) { rrect(ctx, -L / 2, s * h - 4, L, 8, 3); hull(ctx, C, 4, s * h); for (let x = -L / 2 + 6; x < L / 2; x += 8) panel(ctx, C, x, s * h - 4, x, s * h + 4); for (let x = -L / 2 + 4; x < L / 2; x += 12) { ctx.fillStyle = C.win; ctx.fillRect(x, s * h - 0.8, 1.6, 1.6); } }
      if (lv >= 3) for (const s of [-1, 1]) { rrect(ctx, -L / 2, s * (h + 12) - 3, L, 6, 3); hull(ctx, C, 3, s * (h + 12)); }
      plate(ctx, C, -L / 2 - 4, -h - 4, 6, 2 * h + 8, -1);
      light(ctx, -L / 2 - 1, 0, 1.6, C.trim2);
      /* Kräne: einer, ab Stufe 2 zwei, laufen auf den Schienen */
      const nC = lv >= 2 ? 2 : 1;
      for (let i = 0; i < nC; i++) { const x = -L / 2 + 10 + ((Math.sin(t * 0.7 + i * 2) + 1) / 2) * (L - 20); ctx.strokeStyle = C.trim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h); ctx.stroke(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 1.5, -h); ctx.lineTo(x - 1.5, h); ctx.stroke(); circ(ctx, x, 0, 3.2); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke(); light(ctx, x, 0, 1, C.win); }
      break;
    }
    case 'refinery': {
      const pipe = (x, y) => { ctx.strokeStyle = C.lo; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke(); ctx.strokeStyle = C.hi; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke(); };
      if (lv === 1) { pipe(26, 0); light(ctx, 27, 0, 1.4, C.trim2); sphere(ctx, C, 0, 0, 18); stripe(ctx, C, [-18, -2, 18, -2, 18, 2, -18, 2]); ring3d(ctx, C, 0, 0, 18, 1.5); }
      else if (lv === 2) { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; pipe(Math.cos(a) * 30, Math.sin(a) * 30); light(ctx, Math.cos(a) * 31, Math.sin(a) * 31, 1.3, C.trim2); } for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; sphere(ctx, C, Math.cos(a) * 16, Math.sin(a) * 16, 13); } sphere(ctx, C, 0, 0, 7, C.trim); }
      else { ringDash(ctx, 24, 5, 5, t * 0.15, C); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; pipe(Math.cos(a) * 36, Math.sin(a) * 36); light(ctx, Math.cos(a) * 37, Math.sin(a) * 37, 1.3, C.trim2); sphere(ctx, C, Math.cos(a) * 24, Math.sin(a) * 24, 11); } sphere(ctx, C, 0, 0, 10, C.trim); ctx.strokeStyle = C.glow; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 20; circ(ctx, 0, 0, 17); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
      break;
    }
    case 'reactor': {
      const pulse = 0.8 + 0.2 * Math.sin(t * (2 + lv));
      if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; ctx.save(); ctx.rotate(a); rrect(ctx, 10, -3, lv >= 3 ? 20 : 16, 6, 2); hull(ctx, C, 3); plate(ctx, C, 13, -2, lv >= 3 ? 14 : 10, 4, -1); ctx.restore(); }
      if (lv >= 3) { ctx.strokeStyle = C.glow; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * TAU / 3; ctx.beginPath(); ctx.arc(0, 0, 24, a, a + 1.1); ctx.stroke(); } ctx.globalAlpha = 1; }
      circ(ctx, 0, 0, 13); hull(ctx, C, 13);
      ring3d(ctx, C, 0, 0, 10, 2);
      ctx.globalAlpha = 0.5; circ(ctx, 0, 0, 10 * pulse); ctx.fillStyle = C.glow; ctx.fill(); ctx.globalAlpha = 1;
      circ(ctx, 0, 0, 7 * pulse); ctx.fillStyle = C.glow; ctx.fill();
      circ(ctx, 0, 0, 3.5 * pulse); ctx.fillStyle = '#ffffff'; ctx.fill();
      break;
    }
    case 'lab': {
      circ(ctx, 0, 0, 14); hull(ctx, C, 14);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.1; ctx.fillStyle = C.win; ctx.fillRect(Math.cos(a) * 10 - 0.8, Math.sin(a) * 10 - 0.8, 1.6, 1.6); }
      const dish = (x, y, r, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.arc(0, 0, r, -1.1, 1.1); ctx.closePath(); hull(ctx, C, r * 0.8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.8, 0); ctx.strokeStyle = C.trim; ctx.lineWidth = 2; ctx.stroke(); light(ctx, r * 0.8, 0, 0.9, C.trim2); ctx.restore(); };
      if (lv === 1) dish(0, 0, 13, t * 0.5);
      else { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; dish(Math.cos(a) * 18, Math.sin(a) * 18, 10, t * 0.5 + i); } }
      if (lv >= 3) { ringDash(ctx, 31, 12, 3, t * 0.6, C, C.trim); sphere(ctx, C, 0, 0, 6, C.trim); circ(ctx, 0, 0, 2.5); ctx.fillStyle = C.glow; ctx.fill(); }
      break;
    }
    case 'turret': {
      circ(ctx, 0, 0, 15); hull(ctx, C, 15);
      if (lv >= 3) ring3d(ctx, C, 0, 0, 12, 2.5);
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke(); } ctx.globalAlpha = 1;
      const nB = lv >= 2 ? 2 : 1, len = lv >= 3 ? 24 : 18;
      ctx.save(); ctx.rotate(aim);
      rrect(ctx, -7, -6.5, 14, 13, 3); hull(ctx, C, 6.5);
      for (let i = 0; i < nB; i++) barrelS(ctx, C, 2, nB > 1 ? (i ? 4 : -4) : 0, len, lv >= 3 ? 5 : 4, 0);
      ctx.restore();
      sphere(ctx, C, 0, 0, 4.5, C.trim);
      break;
    }
    case 'flak': {
      rrect(ctx, -16, -16, 32, 32, 6); hull(ctx, C, 16);
      plate(ctx, C, -13, -13, 12, 12, -1); plate(ctx, C, 1, 1, 12, 12, -1); plate(ctx, C, 1, -13, 12, 12, 1); plate(ctx, C, -13, 1, 12, 12, 1);
      const n = lv >= 3 ? 4 : 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.PI / 4, x = Math.cos(a) * 10, y = Math.sin(a) * 10, wob = aim + Math.sin(t * 6 + i) * 0.08; circ(ctx, x, y, 4.5); hull(ctx, C, 4.5, y); barrelS(ctx, C, x + Math.cos(wob + Math.PI / 2) * 1.5, y + Math.sin(wob + Math.PI / 2) * 1.5, 9, 2.2, wob); barrelS(ctx, C, x - Math.cos(wob + Math.PI / 2) * 1.5, y - Math.sin(wob + Math.PI / 2) * 1.5, 9, 2.2, wob); }
      if (lv >= 2) turretS(ctx, C, 0, 0, 5, aim);
      else light(ctx, 0, 0, 1.6, C.win);
      break;
    }
    case 'shield': {
      const r = lv === 1 ? 17 : lv === 2 ? 21 : 24;
      sphere(ctx, C, 0, 0, r, '#bcd8ea');
      ctx.strokeStyle = C.glow; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      for (let k = 0; k < 2 + lv; k++) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + k * 0.3 + t * 0.2, rr = r * (0.35 + k * 0.2); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (lv >= 3) ring3d(ctx, C, 0, 0, r * 0.45, 2.2);
      circ(ctx, 0, 0, 5); ctx.fillStyle = C.glow; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 4); ctx.fill(); ctx.globalAlpha = 1;
      circ(ctx, 0, 0, 2.5); ctx.fillStyle = '#fff'; ctx.fill();
      break;
    }
    case 'super': {
      const ch = b ? b.charge : 0.5;
      if (f === 'legion') {
        /* Sunbreaker: Spiegelkranz, der ein Sonnenfragment bündelt; die Spiegel neigen sich mit der Ladung zur Mitte */
        const n = 10;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.05; ctx.save(); ctx.rotate(a); ctx.translate(40, 0); ctx.rotate(Math.PI + (1 - ch) * 0.6); ctx.beginPath(); ctx.arc(0, 0, 11, -1.0, 1.0); ctx.closePath(); hull(ctx, C, 8); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35 + 0.4 * ch; ctx.beginPath(); ctx.arc(0, 0, 6, -0.9, 0.9); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.restore(); }
        ringDash(ctx, 28, 12, 4, -t * 0.2, C, C.gold);
        if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; spire(ctx, C, Math.cos(a) * 20, Math.sin(a) * 20, 34, 6, a); }
        const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, 22); gr.addColorStop(0, 'rgba(255,255,255,' + (0.9 * ch) + ')'); gr.addColorStop(0.4, 'rgba(255,200,90,' + (0.7 * ch) + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
        circ(ctx, 0, 0, 22); ctx.fillStyle = gr; ctx.fill();
        sphere(ctx, C, 0, 0, 9 + 3 * ch, '#ffd27a');
        if (lv >= 3) { ctx.strokeStyle = C.glow; ctx.lineWidth = 3; ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 3); circ(ctx, 0, 0, 50); ctx.stroke(); ctx.globalAlpha = 1; }
        break;
      }
      if (f === 'nexus') {
        /* Resonanz: Kristallkrone, Ringe pulsieren mit der Ladung */
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.save(); ctx.rotate(a); facet(ctx, C, [14, -6, 46, 0, 14, 6, 10, 0], i % 2 === 0); ctx.restore(); }
        for (let k = 0; k < 3; k++) { const rr = 18 + k * 10 + 4 * Math.sin(t * 2 + k) * ch; ctx.strokeStyle = C.glow; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.25 + 0.5 * ch; circ(ctx, 0, 0, rr); ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 8 + t * 0.1; core(ctx, C, Math.cos(a) * 30, Math.sin(a) * 30, 2.2); }
        core(ctx, C, 0, 0, 6 + 4 * ch); ring3d(ctx, C, 0, 0, 12, 2.4);
        if (lv >= 3) { ctx.strokeStyle = C.trim2; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 20; circ(ctx, 0, 0, 50); ctx.stroke(); ctx.setLineDash([]); }
        break;
      }
      if (!mars) {
        /* Exodus-Tor: großer Ring mit acht Emittern, innen wabert das Tor je nach Ladung */
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.save(); ctx.rotate(a); rrect(ctx, 34, -4, 16, 8, 3); hull(ctx, C, 4); plate(ctx, C, 38, -2.5, 9, 5, -1); ctx.restore(); light(ctx, Math.cos(a) * 51, Math.sin(a) * 51, 1.4, ch >= 1 ? C.glow : C.trim2); }
        ringDash(ctx, 40, 16, 6, t * 0.25, C);
        if (lv >= 2) ringDash(ctx, 30, 12, 3.5, -t * 0.4, C, C.trim);
        if (lv >= 3) { ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 3); ctx.strokeStyle = C.glow; ctx.lineWidth = 4; circ(ctx, 0, 0, 52); ctx.stroke(); ctx.globalAlpha = 1; }
        const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, 27);
        gr.addColorStop(0, 'rgba(255,255,255,' + (0.5 * ch) + ')'); gr.addColorStop(0.5, 'rgba(143,227,255,' + (0.55 * ch) + ')'); gr.addColorStop(1, 'rgba(143,227,255,0)');
        circ(ctx, 0, 0, 27); ctx.fillStyle = gr; ctx.fill();
        ctx.strokeStyle = C.glow; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.35 + 0.5 * ch;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = 10 + k * 6 + Math.sin(a * 5 + t * (2 + k) + k) * 2 * ch; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ring3d(ctx, C, 0, 0, 9, 2.4);
      } else {
        /* Massetreiber: lange Beschleunigerschiene über dem Asteroiden, Spulen leuchten mit der Ladung auf, Zielturm */
        const L = lv === 1 ? 92 : lv === 2 ? 104 : 116;
        ctx.save(); ctx.rotate(aim);
        rrect(ctx, -L / 2 + 10, -7, L, 14, 4); hull(ctx, C, 7);
        for (let x = -L / 2 + 14; x < L / 2 + 2; x += 9) { plate(ctx, C, x, -5, 7, 10, (x / 9) % 2 ? -1 : 1); }
        rrect(ctx, -L / 2 + 8, -3, L + 6, 6, 1.5); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.9; ctx.stroke();
        const nCoil = Math.floor(L / 8);
        for (let i = 0; i < nCoil; i++) { const x = -L / 2 + 12 + i * 8, lit = i / nCoil < ch; ctx.fillStyle = lit ? (i % 2 ? C.glow : '#ffffff') : C.lo; ctx.fillRect(x, -4.4, 3, 8.8); }
        light(ctx, L / 2 + 14, 0, ch >= 1 ? 2.4 : 1.4, ch >= 1 ? '#ffffff' : C.trim2);
        /* Magazin hinten */
        rrect(ctx, -L / 2 - 2, -11, 16, 22, 4); hull(ctx, C, 11); plate(ctx, C, -L / 2 + 1, -8, 10, 16, -1);
        ctx.restore();
        if (lv >= 2) for (let i = 0; i < 2; i++) { const a = i * Math.PI + Math.PI / 2; turretS(ctx, C, Math.cos(a) * 30, Math.sin(a) * 30, 4, aim); }
        circ(ctx, 0, 0, 16); hull(ctx, C, 16);
        plate(ctx, C, -12, -12, 24, 24, 1);
        ctx.fillStyle = C.hi; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.fillRect(Math.cos(a) * 13 - 0.7, Math.sin(a) * 13 - 0.7, 1.4, 1.4); }
        sphere(ctx, C, 0, 0, 6, C.trim);
        if (lv >= 3) { ctx.strokeStyle = C.glow; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * 25; circ(ctx, 0, 0, 48); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      }
      break;
    }
    case 'relay': {
      rrect(ctx, -17, -2.5, 34, 5, 2); hull(ctx, C, 2.5);
      circ(ctx, 0, 0, 10); hull(ctx, C, 10);
      for (let i = 0; i < lv; i++) ringDash(ctx, 12 + i * 4, 6, 2, -t * (0.8 + i * 0.3), C, C.trim);
      for (const x of [-16, 16]) light(ctx, x, 0, 1, C.trim2);
      const bl = (Math.sin(t * 4) > 0.3) ? 1 : 0.35;
      ctx.globalAlpha = bl; light(ctx, 0, 0, 2.2, C.glow); ctx.globalAlpha = 1;
      break;
    }
  }
}

/* ------------------------------------------------------------------ Stätten und Tore der Erbauer (grün-türkises Leuchten, graues Erbauer-Metall)
   drawSite(ctx, st, t, vis): Ursprung Mitte. drawGate(ctx, gt, t, col): Ring mit Wirbel je Zustand. */
const SITE_C = { hull: '#7c8f86', hi: '#cfe3d9', lo: '#3c4a44', dark: '#5a6b63', line: '#17201c', trim: '#3fb37f', trim2: '#3fb37f', glow: '#9ff0c0', win: '#b8ffd8', gold: '#9ff0c0' };
function drawSite(ctx, st, t, vis) {
  const C = SITE_C, r = st.r, k = st.kind, rng = makeRng(st.seed + 3);
  if (k === 'ruin') {
    /* zerbrochene Plattform: Trümmerplatten, ein halber Ring, Leuchtpunkte solange ungescannt */
    for (let i = 0; i < 5; i++) { const a = rng() * TAU, d = rng() * r * 0.7, w = r * (0.3 + rng() * 0.3), h = r * (0.15 + rng() * 0.2); ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(rng() * TAU); rrect(ctx, -w / 2, -h / 2, w, h, 2); hull(ctx, C, h / 2); ctx.restore(); }
    ctx.strokeStyle = C.lo; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0.4, 3.6); ctx.stroke(); ctx.strokeStyle = C.hi; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0.5, 3.5); ctx.stroke();
    if (!st.scanned) { const bl = 0.4 + 0.4 * Math.sin(t * 2.5 + st.seed); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.7; ctx.globalAlpha = bl; light(ctx, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 1.6, C.glow); } ctx.globalAlpha = 1; }
    else { ctx.fillStyle = 'rgba(0,0,0,0.25)'; circ(ctx, 0, 0, r * 0.5); ctx.fill(); }
    return;
  }
  if (k === 'citadel') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.save(); ctx.rotate(a); rrect(ctx, r * 0.55, -r * 0.12, r * 0.42, r * 0.24, 4); hull(ctx, C, r * 0.12); plate(ctx, C, r * 0.62, -r * 0.08, r * 0.28, r * 0.16, -1); ctx.restore(); }
    ringDash(ctx, r * 0.72, 18, r * 0.1, t * 0.08, C, C.hi);
    circ(ctx, 0, 0, r * 0.5); hull(ctx, C, r * 0.5);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.fillStyle = C.win; ctx.fillRect(Math.cos(a) * r * 0.38 - 1, Math.sin(a) * r * 0.38 - 1, 2, 2); }
    ring3d(ctx, C, 0, 0, r * 0.26, 4);
    core(ctx, C, 0, 0, r * 0.1 + 2);
    return;
  }
  if (k === 'archive') {
    circ(ctx, 0, 0, r * 0.95); hull(ctx, C, r * 0.95);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; spire(ctx, C, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.3, r * 0.12, a); }
    sphere(ctx, C, 0, 0, r * 0.55, '#8fc9b4');
    ctx.strokeStyle = C.glow; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; for (let k2 = 0; k2 < 3; k2++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * (0.15 + k2 * 0.15), t * 0.3 + k2, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    core(ctx, C, 0, 0, r * 0.12);
    return;
  }
  if (k === 'warden') {
    /* Sockel der schlafenden Maschine: breite Platte mit Leitungen */
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.9 : 1), Math.sin(a) * r * (i % 2 ? 0.9 : 1)); } ctx.closePath(); hull(ctx, C, r);
    ctx.strokeStyle = C.glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.stroke(); } ctx.globalAlpha = 1;
    ring3d(ctx, C, 0, 0, r * 0.55, 5);
    return;
  }
  if (k === 'forge') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; ctx.save(); ctx.rotate(a); rrect(ctx, r * 0.4, -r * 0.14, r * 0.55, r * 0.28, 5); hull(ctx, C, r * 0.14); nozzle(ctx, C, r * 0.92, 0, r * 0.1); ctx.restore(); }
    ringDash(ctx, r * 0.5, 10, r * 0.12, -t * 0.3, C, C.hi);
    const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.45); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,200,90,0.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    circ(ctx, 0, 0, r * 0.45); ctx.fillStyle = gr; ctx.fill();
    sphere(ctx, C, 0, 0, r * 0.2 + 2 * Math.sin(t * 3), '#ffd27a');
    return;
  }
}
function drawGate(ctx, gt, t, ownerCol) {
  const C = SITE_C, r = gt.r, active = gt.state === 'active', flick = gt.state === 'flicker', open = active ? gt.mode !== 'lance' : flick ? (t % 50) < 8 : false;
  /* Wirbel innen */
  if (open || (active && gt.mode === 'lance')) {
    const col = active && gt.mode === 'lance' ? '255,120,80' : active && gt.mode === 'lock' ? '255,200,100' : '120,230,200';
    const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.85); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.4, 'rgba(' + col + ',0.5)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    circ(ctx, 0, 0, r * 0.85); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = 'rgba(' + col + ',0.7)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU, rr = r * (0.25 + k * 0.18) + Math.sin(a * 4 + t * (3 + k)) * 3; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); }
  } else if (flick) { ctx.strokeStyle = 'rgba(120,230,200,' + (0.15 + 0.1 * Math.sin(t * 7)) + ')'; ctx.lineWidth = 2; circ(ctx, 0, 0, r * 0.5); ctx.stroke(); }
  /* Ring mit acht Emittern */
  ringDash(ctx, r * 0.95, 16, r * 0.14, t * (open ? 0.5 : 0.05), C, active ? ownerCol : C.hi);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.save(); ctx.rotate(a); rrect(ctx, r * 0.92, -r * 0.09, r * 0.22, r * 0.18, 3); hull(ctx, C, r * 0.09); ctx.restore(); light(ctx, Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 1.5, active ? ownerCol : open ? C.glow : C.lo); }
  if (active && gt.mode === 'lance') { ctx.strokeStyle = '#ff8a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * gt.charge); ctx.stroke(); }
}
/* Fassung 21: Belagerungsartillerie – Rumpf eines verwandten Schiffs, darüber ein schwerer Mörser mit langem Lauf */
function siegeGun(ctx, C, x, len, w) {
  circ(ctx, x, 0, w * 1.15); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.9; ctx.stroke();
  rrect(ctx, x, -w * 0.45, len, w * 0.9, w * 0.3); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.hi; ctx.lineWidth = 0.6; ctx.stroke();
  rrect(ctx, x + len - 3, -w * 0.6, 4, w * 1.2, 1); ctx.fillStyle = C.lo; ctx.fill();
  for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? C.trim : C.trim2; ctx.fillRect(x + 4 + k * (len - 10) / 3, -w * 0.5, 2, w); }
  circ(ctx, x, 0, w * 0.55); ctx.fillStyle = C.trim; ctx.fill();
  light(ctx, x + len + 1, 0, 1, C.glow);
}
function siegeDraw(base, k, gx, glen, gw) { return (ctx, C) => { ctx.save(); ctx.scale(k, k); SHIP_DRAW[base](ctx, C); ctx.restore(); siegeGun(ctx, C, gx, glen, gw); }; }
SHIP_DRAW.catapult = siegeDraw('lancer', 1.2, -6, 30, 4.2);
SHIP_DRAW.mortar = siegeDraw('hedgehog', 1.15, -8, 26, 5);
SHIP_DRAW.ballista = siegeDraw('paladin', 1.1, -6, 32, 4);
SHIP_DRAW.lodestar = siegeDraw('prism', 1.0, -8, 30, 4.2);
SHIP_DRAW.boomer = (ctx, C) => { ctx.save(); ctx.scale(1.3, 1.3); SHIP_DRAW.spitter(ctx, C); ctx.restore(); circ(ctx, -4, 0, 7.5); ctx.fillStyle = C.flesh || C.hull; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); circ(ctx, -4, 0, 4); ctx.fillStyle = C.glow; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1; light(ctx, -4, 0, 2, C.glow); };
Object.assign(ENGINES, { catapult: [[-21, -10, 0.8], [-21, 10, 0.8]], mortar: [[-21, 0, 1.2]], ballista: [[-20, -9, 0.7], [-20, 9, 0.7]], lodestar: [[-22, 0, 0.8]], boomer: [] });
/* Fassung 22: Unterstützer – Rumpf eines verwandten Schiffs (vergrößert), dazu je Rolle ein Aufbau:
   Minenleger: Minenschienen am Heck mit Minen in Reihe · Reparaturschiff: zwei Kranarme mit Schweißköpfen und ein
   Reparaturkreuz · Truppentransporter: Truppenkapseln an beiden Flanken und eine Rampe am Bug. Brood: Eiersäcke, Fühler, Kapsel. */
function supMineRack(ctx, C, x0, n, dy, r) {
  for (const s of [-1, 1]) {
    rrect(ctx, x0 - 2, s * dy - r * 1.1, n * r * 2.4 + 2, r * 2.2, r * 0.6); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke();
    for (let i = 0; i < n; i++) { const x = x0 + r + i * r * 2.4; circ(ctx, x, s * dy, r); ctx.fillStyle = C.lo; ctx.fill(); ctx.strokeStyle = C.hi; ctx.lineWidth = 0.6; ctx.stroke(); circ(ctx, x, s * dy, r * 0.42); ctx.fillStyle = i === 0 ? C.trim : C.trim2; ctx.fill(); }
  }
}
function supArms(ctx, C, x, dy, len) {
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(x, s * dy); ctx.rotate(s * -0.45);
    rrect(ctx, 0, -1.4, len, 2.8, 1); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.6; ctx.stroke();
    circ(ctx, 0, 0, 2.6); ctx.fillStyle = C.lo; ctx.fill(); ctx.stroke();
    ctx.translate(len, 0); ctx.rotate(s * 0.9); rrect(ctx, 0, -1.1, len * 0.6, 2.2, 1); ctx.fillStyle = C.hull; ctx.fill(); ctx.stroke();
    light(ctx, len * 0.6 + 1, 0, 1.3, '#9fffcf');
    ctx.restore();
  }
}
function supCross(ctx, C, x, y, s) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s, y - s * 0.35, s * 2, s * 0.7); ctx.fillRect(x - s * 0.35, y - s, s * 0.7, s * 2); ctx.fillStyle = C.trim; ctx.fillRect(x - s * 0.7, y - s * 0.18, s * 1.4, s * 0.36); ctx.fillRect(x - s * 0.18, y - s * 0.7, s * 0.36, s * 1.4); }
function supPods(ctx, C, x0, n, dy, w) {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + 2.5);
    rrect(ctx, x, s * dy - 3.4, w, 6.8, 2.2); hull(ctx, C, 3.4, s * dy);
    ctx.fillStyle = C.trim; ctx.fillRect(x + w * 0.3, s * dy - 0.8, w * 0.4, 1.6);
  }
}
function supRamp(ctx, C, x, w) { poly(ctx, [x, -w, x + 7, -w * 0.6, x + 7, w * 0.6, x, w]); ctx.fillStyle = C.dark; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.8; ctx.stroke(); for (let i = 0; i < 3; i++) panel(ctx, C, x + 2 + i * 1.8, -w * 0.7, x + 2 + i * 1.8, w * 0.7); }
function supDraw(base, k, extra) { return (ctx, C) => { ctx.save(); ctx.scale(k, k); SHIP_DRAW[base](ctx, C); ctx.restore(); extra(ctx, C); }; }
/* Minenleger */
SHIP_DRAW.tripwire = supDraw('lancer', 1.12, (ctx, C) => { supMineRack(ctx, C, -22, 3, 9, 2.4); light(ctx, -8, 0, 1.4, C.glow); });
SHIP_DRAW.caltrop = supDraw('hedgehog', 1.1, (ctx, C) => { supMineRack(ctx, C, -24, 3, 10, 2.6); ctx.fillStyle = C.trim; ctx.fillRect(-4, -1.2, 10, 2.4); });
SHIP_DRAW.censer = supDraw('paladin', 1.05, (ctx, C) => { supMineRack(ctx, C, -22, 3, 9.5, 2.4); arch(ctx, C, -2, 0, 7, 10); ctx.fillStyle = C.gold || C.trim; ctx.fill(); light(ctx, -2, -1, 1.5, C.glow); });
SHIP_DRAW.geode = supDraw('prism', 1.0, (ctx, C) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = -20 + i * 6, y = s * 10; facet(ctx, C, [x - 2.6, y, x, y - 2.8 * s, x + 2.6, y, x, y + 2.8 * s], i === 1); } core(ctx, C, -6, 0, 1.6); });
SHIP_DRAW.clutch = supDraw('spitter', 1.35, (ctx, C) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) sac(ctx, C, -20 + i * 6.5, s * (8 + (i % 2) * 1.5), 3.1); eye(ctx, C, 8, 0, 1.4); });
/* Reparaturschiffe */
SHIP_DRAW.mender = supDraw('pathfinder', 1.3, (ctx, C) => { supArms(ctx, C, 6, 6, 10); supCross(ctx, C, -8, 0, 4); });
SHIP_DRAW.anvil = supDraw('prospector', 1.3, (ctx, C) => { supArms(ctx, C, 6, 7, 11); supCross(ctx, C, -9, 0, 4); });
SHIP_DRAW.hospitaller = supDraw('restorer', 1.32, (ctx, C) => { supArms(ctx, C, 5, 6, 10); ctx.strokeStyle = C.gold || C.trim; ctx.lineWidth = 1.6; circ(ctx, -8, 0, 6); ctx.stroke(); supCross(ctx, C, -8, 0, 3.6); });
SHIP_DRAW.lumen = supDraw('seed', 1.38, (ctx, C) => { for (const s of [-1, 1]) facet(ctx, C, [2, s * 6, 14, s * 13, 16, s * 10, 6, s * 4], true); core(ctx, C, -6, 0, 2.6); light(ctx, 16, 11.5, 1.2, '#9fffcf'); light(ctx, 16, -11.5, 1.2, '#9fffcf'); });
SHIP_DRAW.nurse = supDraw('grazer', 1.4, (ctx, C) => { for (const s of [-1, 1]) tendril(ctx, C, 8, s * 5, 16, s * 0.55, 2.4, 0.4); sac(ctx, C, -8, 0, 5.2); eye(ctx, C, 12, 0, 1.4); });
/* Truppentransporter */
SHIP_DRAW.envoy = supDraw('hauler', 1.45, (ctx, C) => { supPods(ctx, C, -14, 3, 12, 6.5); supRamp(ctx, C, 19, 5); });
SHIP_DRAW.breacher = supDraw('boarder', 1.32, (ctx, C) => { supPods(ctx, C, -16, 3, 12.5, 6.5); for (const s of [-1, 1]) { poly(ctx, [18, s * 3, 27, s * 1.2, 18, s * 6]); ctx.fillStyle = C.hi; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 0.7; ctx.stroke(); } });
SHIP_DRAW.templar = supDraw('herald', 1.55, (ctx, C) => { supPods(ctx, C, -14, 3, 12, 6.2); spire(ctx, C, 18, 0, 9, 4); ctx.fillStyle = C.gold || C.trim; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8); });
SHIP_DRAW.assimilator = supDraw('binder', 1.12, (ctx, C) => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = -16 + i * 7, y = s * 12; facet(ctx, C, [x - 3, y, x, y - 3.4 * s, x + 3, y, x, y + 3.4 * s], i % 2 === 0); light(ctx, x, y, 0.8, C.glow); } });
SHIP_DRAW.parasitepod = supDraw('leech', 1.42, (ctx, C) => { sac(ctx, C, -6, 0, 7); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { circ(ctx, -12 + i * 6, s * 7.5, 1.6); ctx.fillStyle = '#ff9ad6'; ctx.fill(); } });
Object.assign(ENGINES, { tripwire: [[-20, -9, 0.9], [-20, 9, 0.9]], caltrop: [[-21, 0, 1.3]], censer: [[-19, -8, 0.8], [-19, 8, 0.8]], geode: [[-22, 0, 0.8]], clutch: [[-19, 0, 0.6]],
  mender: [[-22, 0, 1]], anvil: [[-21, 0, 1.2]], hospitaller: [[-21, 0, 1]], lumen: [[-21, 0, 0.7]], nurse: [[-20, 0, 0.6]],
  envoy: [[-22, 0, 1]], breacher: [[-21, 0, 1.4]], templar: [[-20, -8, 0.8], [-20, 8, 0.8]], assimilator: [[-22, 0, 0.8]], parasitepod: [[-21, 0, 0.5]] });
/* Mine je Fraktion (Ursprung Mitte, Weltmaßstab, Radius etwa 6): armed = geschärft (Warnlicht blinkt) */
function drawMine(ctx, f, col, t, armed) {
  const C = shipCols(f, col), bl = armed ? 0.55 + 0.45 * Math.sin(t * 4) : 0.15;
  if (f === 'brood') { sac(ctx, C, 0, 0, 5.2); circ(ctx, 0, 0, 2); ctx.fillStyle = C.trim; ctx.fill(); }
  else if (f === 'nexus') { facet(ctx, C, [-6, 0, 0, -6, 6, 0, 0, 6], true); facet(ctx, C, [-3, 0, 0, -3, 3, 0, 0, 3], false); }
  else if (f === 'legion') { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; poly(ctx, [Math.cos(a) * 7, Math.sin(a) * 7, Math.cos(a + 0.3) * 3.5, Math.sin(a + 0.3) * 3.5, Math.cos(a - 0.3) * 3.5, Math.sin(a - 0.3) * 3.5]); ctx.fillStyle = C.gold; ctx.fill(); } circ(ctx, 0, 0, 3.8); hull(ctx, C, 3.8); }
  else { const spikes = f === 'mars' ? 8 : 4; ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; for (let i = 0; i < spikes; i++) { const a = i / spikes * TAU + 0.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.stroke(); } circ(ctx, 0, 0, 5); hull(ctx, C, 5); ctx.strokeStyle = C.trim; ctx.lineWidth = 1.2; circ(ctx, 0, 0, 3.3); ctx.stroke(); }
  if (bl > 0.5) light(ctx, 0, 0, 1.3, f === 'brood' ? '#d6ff6a' : '#ff5b47');
}
