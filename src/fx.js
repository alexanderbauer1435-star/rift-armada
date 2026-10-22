/* ===== fx.js ===== */
'use strict';
/* =====================================================================
   EFFEKTE – Funken, Trümmer, Explosionen, Schildblasen, Torpedospuren, Abwehrfeuer. Ein Vorrat aus wiederverwendeten
   Objekten, damit keine Ruckler durch Speicherbereinigung entstehen. Nur Darstellung, nie Teil der Simulation.
   ===================================================================== */
const FX = { list: [], pool: [], max: 600, time: 0 };
function fxGet() { return FX.pool.pop() || {}; }
function fxAdd(o) {
  if (FX.list.length >= FX.max) { const d = FX.list.shift(); FX.pool.push(d); }
  o.t = 0; FX.list.push(o); return o;
}
function fxSpark(x, y, n, sp, col, life) {
  for (let i = 0; i < n; i++) { const o = fxGet(), a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7); o.k = 'spark'; o.x = x; o.y = y; o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v; o.life = (life || 0.5) * (0.6 + Math.random() * 0.6); o.col = col; o.r = 1 + Math.random() * 1.5; fxAdd(o); }
}
function fxDebris(x, y, n, sp, col) {
  for (let i = 0; i < n; i++) { const o = fxGet(), a = Math.random() * TAU, v = sp * (0.2 + Math.random() * 0.8); o.k = 'debris'; o.x = x; o.y = y; o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v; o.life = 1.2 + Math.random() * 1.6; o.col = col; o.w = 1.5 + Math.random() * 4; o.h = 1 + Math.random() * 2; o.ang = Math.random() * TAU; o.rot = (Math.random() - 0.5) * 6; fxAdd(o); }
}
function fxRing(x, y, r, life, col, w) { const o = fxGet(); o.k = 'ring'; o.x = x; o.y = y; o.r = r; o.life = life; o.col = col; o.w = w || 2; fxAdd(o); }
function fxFlash(x, y, r, life, col) { const o = fxGet(); o.k = 'flash'; o.x = x; o.y = y; o.r = r; o.life = life; o.col = col; fxAdd(o); }
function fxSmoke(x, y, n, r, life) {
  for (let i = 0; i < n; i++) { const o = fxGet(), a = Math.random() * TAU, v = 10 + Math.random() * 25; o.k = 'smoke'; o.x = x + (Math.random() - 0.5) * r; o.y = y + (Math.random() - 0.5) * r; o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v; o.life = (life || 1.2) * (0.6 + Math.random() * 0.8); o.r = r * (0.3 + Math.random() * 0.5); fxAdd(o); }
}
function fxShield(x, y, r, ang, col) { const o = fxGet(); o.k = 'shield'; o.x = x; o.y = y; o.r = r; o.ang = ang; o.life = 0.3; o.col = col; fxAdd(o); }
function fxLine(x0, y0, x1, y1, life, col, w) { const o = fxGet(); o.k = 'line'; o.x = x0; o.y = y0; o.x1 = x1; o.y1 = y1; o.life = life; o.col = col; o.w = w || 1; fxAdd(o); }
function fxText(x, y, txt, col) { const o = fxGet(); o.k = 'text'; o.x = x; o.y = y; o.txt = txt; o.col = col; o.life = 1.4; fxAdd(o); }
/* Wrackhälften eines großen Schiffs: treiben auseinander, glühen an der Bruchkante, verblassen */
function fxHulk(x, y, ang, sprite, w, vx, vy) {
  for (let h = 0; h < 2; h++) {
    const o = fxGet(), s = h ? 1 : -1, sp = 14 + Math.random() * 10;
    o.k = 'hulk'; o.x = x + Math.cos(ang) * s * w * 0.12; o.y = y + Math.sin(ang) * s * w * 0.12; o.ang = ang; o.sp = sprite; o.w = w; o.h = h;
    o.vx = (vx || 0) * 0.4 + Math.cos(ang) * s * sp + (Math.random() - 0.5) * 8; o.vy = (vy || 0) * 0.4 + Math.sin(ang) * s * sp + (Math.random() - 0.5) * 8; o.rot = s * (0.25 + Math.random() * 0.35); o.life = 3.2;
    fxAdd(o);
  }
}
/* verzögerte Nachexplosionen (Stationen brechen in mehreren Schüben auseinander) */
const FX_LATER = [];
function fxLater(x, y, r, delay, big) { FX_LATER.push({ x, y, r, at: FX.time + delay, big }); }
function fxTrail(x, y, col, r) { const o = fxGet(); o.k = 'trail'; o.x = x; o.y = y; o.life = 0.45; o.col = col; o.r = r || 2.2; fxAdd(o); }
/* Vorgezeichnete weiche Flecken: Feuerball (weiß → gelb → orange → rot), Rauchwolke, Lichtpunkt */
const FX_SPR = {};
function fxSprite(kind) {
  if (FX_SPR[kind]) return FX_SPR[kind];
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'), g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  if (kind === 'fire') { g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.18, 'rgba(255,230,150,0.95)'); g.addColorStop(0.42, 'rgba(255,140,60,0.7)'); g.addColorStop(0.7, 'rgba(200,60,30,0.3)'); g.addColorStop(1, 'rgba(120,20,10,0)'); }
  else if (kind === 'smoke') { g.addColorStop(0, 'rgba(70,62,60,0.55)'); g.addColorStop(0.5, 'rgba(60,52,50,0.3)'); g.addColorStop(1, 'rgba(40,35,34,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  FX_SPR[kind] = c;
  return c;
}
function fxFire(x, y, r, life, n) {
  for (let i = 0; i < (n || 1); i++) { const o = fxGet(), a = Math.random() * TAU, d = i ? Math.random() * r * 0.6 : 0; o.k = 'fire'; o.x = x + Math.cos(a) * d; o.y = y + Math.sin(a) * d; o.vx = (Math.random() - 0.5) * 30; o.vy = (Math.random() - 0.5) * 30; o.r = r * (i ? 0.5 + Math.random() * 0.5 : 1); o.life = life * (0.7 + Math.random() * 0.5); fxAdd(o); }
}
/* Explosion nach Größe: Blitz, Feuerbälle, Druckwelle, glühende Funken mit Schweif, Trümmer, Rauch */
function fxExplode(x, y, r, big, col) {
  fxFlash(x, y, r * (big ? 3 : 2.2), big ? 0.35 : 0.22, '#fff2d0');
  fxFire(x, y, r * (big ? 2.6 : 1.9), big ? 0.9 : 0.55, big ? 7 : 4);
  fxRing(x, y, r * (big ? 3.6 : 2.4), big ? 0.8 : 0.5, col || '#ffb060', big ? 3 : 2);
  if (big) fxRing(x, y, r * 5.5, 1.1, 'rgba(255,200,140,0.5)', 6);
  fxSpark(x, y, big ? 44 : 18, big ? 260 : 150, '#ffd27a', big ? 1 : 0.65);
  fxDebris(x, y, big ? 24 : 9, big ? 160 : 95, '#8a8f99');
  fxSmoke(x, y, big ? 12 : 5, r * 1.6, big ? 2.4 : 1.4);
}
function fxStep(dt) {
  FX.time += dt;
  for (let i = FX_LATER.length - 1; i >= 0; i--) { const q = FX_LATER[i]; if (FX.time >= q.at) { FX_LATER.splice(i, 1); fxExplode(q.x, q.y, q.r, q.big, '#ffb060'); } }
  const L = FX.list;
  let w = 0;
  for (let i = 0; i < L.length; i++) {
    const o = L[i];
    o.t += dt;
    if (o.t >= o.life) { FX.pool.push(o); continue; }
    if (o.k === 'hulk') { o.x += o.vx * dt; o.y += o.vy * dt; o.ang += o.rot * dt; o.vx *= 0.99; o.vy *= 0.99; }
    if (o.vx !== undefined && (o.k === 'spark' || o.k === 'debris' || o.k === 'smoke' || o.k === 'fire')) { o.x += o.vx * dt; o.y += o.vy * dt; if (o.k === 'spark') { o.vx *= 0.96; o.vy *= 0.96; } if (o.k === 'debris') { o.ang += o.rot * dt; o.vx *= 0.995; o.vy *= 0.995; } }
    L[w++] = o;
  }
  L.length = w;
}
/* zeichnen in Weltkoordinaten (der Kontext ist schon auf die Kamera gesetzt). Leuchtendes additiv, Rauch und
   Trümmer deckend. */
function fxDraw(ctx, zoom) {
  const L = FX.list, lw = 1 / Math.max(0.6, zoom);
  /* erst das Deckende (Rauch, Trümmer, Text), dann das Leuchtende additiv darüber */
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
    for (let i = 0; i < L.length; i++) {
      const o = L[i], k = o.t / o.life, a = 1 - k;
      switch (o.k) {
        case 'hulk': if (pass) break; {
          const w = o.w, half = w / 2;
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang); ctx.globalAlpha = Math.min(1, a * 2.2);
          ctx.beginPath(); if (o.h) ctx.rect(0, -half, half, w); else ctx.rect(-half, -half, half, w); ctx.clip();
          ctx.drawImage(o.sp, -half, -half, w, w);
          const glow = Math.max(0, 1 - k * 1.8);
          if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.16); gr.addColorStop(0, 'rgba(255,200,120,' + (0.9 * glow) + ')'); gr.addColorStop(0.5, 'rgba(255,110,40,' + (0.5 * glow) + ')'); gr.addColorStop(1, 'rgba(255,60,20,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, w * 0.16, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.restore();
        } break;
        case 'smoke': if (pass) break; { const r = o.r * (0.7 + k * 1.3), sp = fxSprite('smoke'); ctx.globalAlpha = a * 0.9; ctx.drawImage(sp, o.x - r, o.y - r, r * 2, r * 2); } break;
        case 'debris': if (pass) break; ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = o.t < 0.35 ? '#ffb070' : o.t < 0.8 ? '#a0786a' : o.col; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang); ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); ctx.restore(); break;
        case 'text': if (pass) break; ctx.globalAlpha = a; ctx.fillStyle = o.col; ctx.font = 'bold ' + (13 * lw) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(o.txt, o.x, o.y - k * 30); break;
        case 'spark': if (!pass) break; { const l = Math.min(1, Math.hypot(o.vx, o.vy) / 90); ctx.globalAlpha = a; ctx.strokeStyle = o.col; ctx.lineWidth = o.r * 1.4 * lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(o.x - o.vx * 0.06 * l, o.y - o.vy * 0.06 * l); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.lineCap = 'butt'; } break;
        case 'fire': if (!pass) break; { const r = o.r * (0.4 + k * 0.9), sp = fxSprite('fire'); ctx.globalAlpha = a * a * 0.95; ctx.drawImage(sp, o.x - r, o.y - r, r * 2, r * 2); } break;
        case 'ring': if (!pass) break; ctx.globalAlpha = a * 0.9; ctx.strokeStyle = o.col; ctx.lineWidth = o.w * (1 - k * 0.6) * lw; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (0.15 + k * 0.85), 0, TAU); ctx.stroke(); break;
        case 'flash': if (!pass) break; { const r = o.r * (0.6 + k * 0.6), sp = fxSprite('dot'); ctx.globalAlpha = a * 0.9; ctx.drawImage(sp, o.x - r, o.y - r, r * 2, r * 2); } break;
        case 'shield': if (!pass) break; ctx.globalAlpha = a * 0.9; ctx.strokeStyle = o.col; ctx.lineWidth = 3 * lw; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, o.ang - 0.9, o.ang + 0.9); ctx.stroke(); ctx.globalAlpha = a * 0.5; ctx.lineWidth = 8 * lw; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, o.ang - 0.5, o.ang + 0.5); ctx.stroke(); ctx.globalAlpha = a * 0.22; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke(); break;
        case 'line': if (!pass) break; ctx.globalAlpha = a; ctx.strokeStyle = o.col; ctx.lineWidth = o.w * lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x1, o.y1); ctx.stroke(); ctx.lineCap = 'butt'; break;
        case 'trail': if (!pass) break; { const r = o.r * (0.6 + a * 0.8), sp = fxSprite('dot'); ctx.globalAlpha = a * 0.5; ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = a * 0.25; ctx.drawImage(sp, o.x - r * 2.5, o.y - r * 2.5, r * 5, r * 5); } break;
      }
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
