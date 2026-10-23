/* =====================================================================
   Rift Armada – 3D-Effekte (Schnittstelle zum Kern, siehe src3d/SPEC.md »Effekte«).
   init(scene, THREE, kitMats, detail) · event(e, g, view) · frame(g, dt, time, view, cam) · spawn.{smoke, spark, ring, flash}
   · clear() · setDetail(d)
   Spielwelt (x, y) → Three (x, Höhe, y). Strahlen und Geschosse liegen auf Höhe 4, Boden-Effekte knapp über Y = 0.
   Alles liegt in wenigen instanzierten Puffern (buffers.js) und wird je Frame aus den Partikelvorräten (particles.js)
   und den Spielzuständen (s.beams, g.proj, g.strikes, g.flares, g.spores, g.wave.open) neu geschrieben. Partikelbudget
   je Detailstufe: 4 000 / 1 500 / 600; ist ein Vorrat voll, verdrängt Neues das Älteste.
   Ruhig und lesbar: Kerne hell (Bloom ab 1,25), Hüllen und Glühen unter 1, kein Dauerblinken.
   ===================================================================== */
import { useThree, makeAtlas, SpriteBuf, QuadBuf, RingBuf, ChunkBuf, DomeBuf, DiscBuf, TILE, QMODE, DMODE } from './buffers.js';
import { Pool, SP, QP, RP, CP, DP, KP, CM, stepSprites, stepQuads, stepRings, stepChunks, stepDomes, stepDiscs } from './particles.js';

const TAU = Math.PI * 2;
let T = null, root = null, atlas = null;
const B = {};                 /* GPU-Puffer */
const P = {};                 /* Partikelvorräte */
let detail = 2, K = 1;        /* K = Mengenfaktor der Detailstufe */
let later = [];               /* zeitversetzte Wirkungen { at, fn } */
let now = 0;
const H = { beam: 4, proj: 4, ground: 0.3, ring: 0.5, disc: 0.2, dome: 0.5 };
/* Vorräte: [Sprites additiv, Rauch, Quads, Trümmer, Ringe, Kuppeln, Scheiben] */
const CAP = [1400, 360, 1400, 460, 120, 48, 48];
const LIM = { 2: CAP, 1: [520, 140, 520, 170, 60, 32, 32], 0: [200, 56, 200, 64, 30, 16, 16] };
const KF = [0.3, 0.55, 1];
/* Waffenfarbe je Fraktion, wenn die Waffe keine eigene hat (data.js FACTIONS.wpn) */
const WPN_COL = { alliance: '#7ff6ff', mars: '#ffd27a', legion: '#d9b8ff', nexus: '#f3e6ff', brood: '#b4ff3c', guardian: '#b8ffd8' };

/* ------------------------------------------------------------ Farben (CSS-Hex → linear, zwischengespeichert) */
const COLS = new Map();
function col(hex) { let c = COLS.get(hex); if (!c) { const k = new T.Color(hex); c = [k.r, k.g, k.b]; COLS.set(hex, c); } return c; }
const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------ Aufbau */
export function init(scene, THREE, kitMats, d) {
  T = THREE; useThree(THREE);
  atlas = makeAtlas();
  root = new T.Group(); root.name = 'effects'; root.matrixAutoUpdate = false; scene.add(root);
  B.smoke = new SpriteBuf(CAP[1] + 120, atlas, false, 8);
  B.chunk = new ChunkBuf(CAP[3] + 60, 'debris', 0);
  B.rock = new ChunkBuf(40, 'rock', 0);
  B.caps = new ChunkBuf(160, 'capsule', 0);
  B.disc = new DiscBuf(CAP[6] + 80, 5);
  B.ring = new RingBuf(CAP[4] + 40, 6);
  B.quad = new QuadBuf(CAP[2] + 700, 10);
  B.spr = new SpriteBuf(CAP[0] + 600, atlas, true, 11);
  B.dome = new DomeBuf(CAP[5] + 16, 12);
  for (const k in B) root.add(B[k].mesh);
  P.spr = new Pool(CAP[0], SP.F); P.smoke = new Pool(CAP[1], SP.F); P.quad = new Pool(CAP[2], QP.F); P.chunk = new Pool(CAP[3], CP.F);
  P.ring = new Pool(CAP[4], RP.F); P.dome = new Pool(CAP[5], DP.F); P.disc = new Pool(CAP[6], KP.F);
  setDetail(d === undefined ? detail : d);
}
export function setDetail(d) {
  detail = Math.max(0, Math.min(2, d | 0)); K = KF[detail];
  if (!P.spr) return;   /* vor init: nur merken */
  const L = LIM[detail]; P.spr.lim = L[0]; P.smoke.lim = L[1]; P.quad.lim = L[2]; P.chunk.lim = L[3]; P.ring.lim = L[4]; P.dome.lim = L[5]; P.disc.lim = L[6];
}
export function clear() { for (const k in P) P[k].clear(); later = []; }
/* Anzahl lebender Partikel und Draw-Calls (für das Labor und die Leistungsanzeige) */
export function stats() { let n = 0; for (const k in P) n += P[k].count; let dc = 0; for (const k in B) if (B[k].mesh.visible) dc++; return { particles: n, drawCalls: dc, spr: B.spr.n, quad: B.quad.n, smoke: B.smoke.n, chunk: B.chunk.n, ring: B.ring.n, disc: B.disc.n, dome: B.dome.n }; }

/* ------------------------------------------------------------ Partikel erzeugen (Spielkoordinaten x, y) */
function spr(pool, x, h, z, vx, vh, vz, life, s0, s1, c, a0, tile, cmode, drag, mul = 1, rotv = 0, fade = 1) {
  const i = pool.alloc(); if (i < 0) return;
  const d = pool.d, o = i * SP.F;
  d[o + SP.x] = x; d[o + SP.h] = h; d[o + SP.z] = z; d[o + SP.vx] = vx; d[o + SP.vh] = vh; d[o + SP.vz] = vz;
  d[o + SP.t] = 0; d[o + SP.life] = life; d[o + SP.s0] = s0; d[o + SP.s1] = s1; d[o + SP.rot] = Math.random() * TAU; d[o + SP.rotv] = rotv;
  d[o + SP.r] = c[0] * mul; d[o + SP.g] = c[1] * mul; d[o + SP.b] = c[2] * mul; d[o + SP.a0] = a0; d[o + SP.tile] = tile; d[o + SP.drag] = drag; d[o + SP.cmode] = cmode; d[o + SP.fade] = fade;
}
/* Funken: kurze leuchtende Striche, die auseinanderfliegen und abbremsen */
function spark(x, y, n, speed, hex, life = 0.5, h = H.proj, mul = 1.35, up = 0.5) {
  n = Math.round(n * K); const c = col(hex);
  for (let i = 0; i < n; i++) {
    const j = P.quad.alloc(); if (j < 0) return;
    const d = P.quad.d, o = j * QP.F, a = Math.random() * TAU, el = (Math.random() - 0.35) * up, v = speed * rnd(0.35, 1);
    const vx = Math.cos(a) * Math.cos(el) * v, vz = Math.sin(a) * Math.cos(el) * v, vh = Math.sin(el) * v;
    d[o + QP.bx] = x; d[o + QP.bh] = h; d[o + QP.bz] = y; d[o + QP.vx] = vx; d[o + QP.vh] = vh; d[o + QP.vz] = vz;
    d[o + QP.t] = 0; d[o + QP.life] = life * rnd(0.7, 1.3); d[o + QP.w] = rnd(1.4, 2.6);
    d[o + QP.r] = c[0] * mul; d[o + QP.g] = c[1] * mul; d[o + QP.b] = c[2] * mul; d[o + QP.a0] = 1; d[o + QP.mode] = QMODE.tail; d[o + QP.kind] = 1; d[o + QP.drag] = 1.7; d[o + QP.tail] = rnd(0.1, 0.18);
  }
}
/* feste Linie zwischen zwei Punkten (Punktverteidigung, Lanzen, Enterleinen) */
function line(x0, y0, x1, y1, w, hex, life, mode = QMODE.flat, h0 = H.proj, h1 = h0, mul = 1, a0 = 1) {
  const j = P.quad.alloc(); if (j < 0) return;
  const d = P.quad.d, o = j * QP.F, c = col(hex);
  d[o + QP.ax] = x0; d[o + QP.ah] = h0; d[o + QP.az] = y0; d[o + QP.bx] = x1; d[o + QP.bh] = h1; d[o + QP.bz] = y1;
  d[o + QP.t] = 0; d[o + QP.life] = life; d[o + QP.w] = w; d[o + QP.r] = c[0] * mul; d[o + QP.g] = c[1] * mul; d[o + QP.b] = c[2] * mul; d[o + QP.a0] = a0; d[o + QP.mode] = mode; d[o + QP.kind] = 0;
}
function ring(x, y, r, hex, life, w = 3, mul = 1, a0 = 0.9, r0 = r * 0.15) {
  const j = P.ring.alloc(); if (j < 0) return;
  const d = P.ring.d, o = j * RP.F, c = col(hex);
  d[o + RP.x] = x; d[o + RP.h] = H.ring; d[o + RP.z] = y; d[o + RP.r0] = r0; d[o + RP.r1] = r; d[o + RP.t] = 0; d[o + RP.life] = life; d[o + RP.w] = w;
  d[o + RP.r] = c[0] * mul; d[o + RP.g] = c[1] * mul; d[o + RP.b] = c[2] * mul; d[o + RP.a0] = a0;
}
/* kurzer Lichtblitz (weiches Glühen, wächst, verblasst schnell) */
function flash(x, y, r, hex, life, h = H.proj, tile = TILE.glow, mul = 1.1, a0 = 0.9) { spr(P.spr, x, h, y, 0, 0, 0, life, r * 1.0, r * 1.9, col(hex), a0, tile, CM.flash, 0, mul); }
/* weiches Glühen an einem Ort (ruhig, abklingend) */
function glow(x, y, h, s0, s1, hex, life, a0 = 0.6, mul = 1, tile = TILE.glow, fade = 1) { spr(P.spr, x, h, y, 0, 0, 0, life, s0, s1, col(hex), a0, tile, CM.fixed, 0, mul, 0, fade); }
/* Feuerball: ein Kernblob und Lappen, die radial auseinanderdriften; jeder Lappen startet in einer anderen Glutphase
   (fade = Altersversatz), damit der Ball weiß-gelb-orange gefleckt ist statt gleichmäßig weiß */
function fire(x, y, r, life, n, h = H.proj, spread = 0.7) {
  n = Math.max(1, Math.round(n * K)); const c = col('#ffffff');
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, dd = i ? rnd(0.2, 1) * r * spread : 0, el = i ? rnd(-0.3, 0.6) * r * spread : 0;
    const sc = i ? rnd(0.45, 0.85) : 1, v = i ? rnd(18, 50) : 8;
    spr(P.spr, x + Math.cos(a) * dd, h + el, y + Math.sin(a) * dd, Math.cos(a) * v, rnd(4, 20), Math.sin(a) * v, life * rnd(0.7, 1.15), r * 0.5 * sc, r * 1.7 * sc, c, 0.85, TILE.fire, CM.fire, 1.2, 1, rnd(-2, 2), i ? rnd(0, 0.3) : 0);
  }
}
function smoke(x, y, r, n, life = 1.6, h = H.proj, vh = 9) {
  n = Math.round(n * K);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, dd = Math.random() * r * 0.6, v = rnd(8, 26), sh = rnd(0.09, 0.19);
    spr(P.smoke, x + Math.cos(a) * dd, h + rnd(0, r * 0.3), y + Math.sin(a) * dd, Math.cos(a) * v, vh * rnd(0.6, 1.4), Math.sin(a) * v, life * rnd(0.6, 1.4), r * rnd(0.4, 0.7), r * rnd(1.3, 2.2), [sh * 1.05, sh * 0.95, sh * 0.9], rnd(0.5, 0.75), TILE.smoke, CM.smoke, 0.8, 1, rnd(-0.6, 0.6));
  }
}
function debris(x, y, n, speed, r, h = H.proj, glowK = 1) {
  n = Math.round(n * K);
  for (let i = 0; i < n; i++) {
    const j = P.chunk.alloc(); if (j < 0) return;
    const d = P.chunk.d, o = j * CP.F, a = Math.random() * TAU, el = rnd(-0.2, 0.7), v = speed * rnd(0.2, 1);
    d[o + CP.x] = x; d[o + CP.h] = h + rnd(0, r * 0.3); d[o + CP.z] = y;
    d[o + CP.vx] = Math.cos(a) * Math.cos(el) * v; d[o + CP.vh] = Math.sin(el) * v * 0.6; d[o + CP.vz] = Math.sin(a) * Math.cos(el) * v;
    d[o + CP.rx] = Math.random() * TAU; d[o + CP.ry] = Math.random() * TAU; d[o + CP.rz] = Math.random() * TAU;
    d[o + CP.wx] = rnd(-5, 5); d[o + CP.wy] = rnd(-5, 5); d[o + CP.wz] = rnd(-5, 5);
    d[o + CP.t] = 0; d[o + CP.life] = rnd(1.4, 3.2); d[o + CP.s] = rnd(0.6, 1.6) * Math.max(0.6, Math.min(2.2, r / 14)); d[o + CP.glow] = glowK * rnd(0.5, 1); d[o + CP.shade] = rnd(0.07, 0.2);
  }
}
function dome(x, y, r, ang, hex, life = 0.32) {
  const j = P.dome.alloc(); if (j < 0) return;
  const d = P.dome.d, o = j * DP.F, c = col(hex);
  d[o + DP.x] = x; d[o + DP.h] = H.dome; d[o + DP.z] = y; d[o + DP.r] = r; d[o + DP.hx] = Math.cos(ang); d[o + DP.hz] = Math.sin(ang);
  d[o + DP.t] = 0; d[o + DP.life] = life; d[o + DP.cr] = c[0]; d[o + DP.cg] = c[1]; d[o + DP.cb] = c[2];
}
function disc(x, y, rx, rz, rot, mode, life, hex = '#ffffff', env = 0) {
  const j = P.disc.alloc(); if (j < 0) return;
  const d = P.disc.d, o = j * KP.F, c = col(hex);
  d[o + KP.x] = x; d[o + KP.h] = H.disc; d[o + KP.z] = y; d[o + KP.rx] = rx; d[o + KP.rz] = rz; d[o + KP.rot] = rot; d[o + KP.mode] = mode;
  d[o + KP.t] = 0; d[o + KP.life] = life; d[o + KP.r] = c[0]; d[o + KP.g] = c[1]; d[o + KP.b] = c[2]; d[o + KP.ph] = Math.random() * 10; d[o + KP.env] = env;
}
/* Explosion: Blitz, Kern, Feuerbälle, Druckring, Funken, Trümmer, Rauch; Fraktionsfarbe als Akzent im Ring */
function explode(x, y, r, big, hex, h = H.proj, outer = true) {
  const acc = hex || '#ffb060';
  flash(x, y, r * (big ? 1.6 : 1.5), '#fff2d0', big ? 0.22 : 0.18, h + r * 0.3, TILE.glow, 1.0, 0.8);
  spr(P.spr, x, h + r * 0.3, y, 0, 0, 0, big ? 0.22 : 0.16, r * 0.4, r * 1.0, col('#ffffff'), 1, TILE.dot, CM.flash, 0, 1.3);
  fire(x, y, r * (big ? 1.8 : 1.5), big ? 1.1 : 0.7, big ? 12 : 7, h + r * 0.25);
  ring(x, y, r * (big ? 2.6 : 2.4), acc, big ? 0.7 : 0.5, r * 0.12, 1, 0.7);
  if (big && outer) ring(x, y, r * 3.6, '#ffd9b0', 0.9, r * 0.16, 1, 0.3);
  spark(x, y, big ? 40 : 20, big ? 240 : 170, '#ffd27a', big ? 1.0 : 0.7, h + r * 0.2, 1.6, 1.2);
  debris(x, y, big ? 22 : 8, big ? 150 : 90, r, h + r * 0.2);
  smoke(x, y, r * 1.3, big ? 10 : 4, big ? 2.6 : 1.5, h + r * 0.2);
  if (big) later.push({ at: now + rnd(0.25, 0.5), fn: () => { fire(x + rnd(-r, r) * 0.6, y + rnd(-r, r) * 0.6, r * 0.7, 0.7, 3, h + r * 0.4); spark(x, y, 8, 120, '#ffb070', 0.6, h); } });
}
/* Sprühspur (Säure), Glutspur (Torpedo, Masse) */
function trail(x, y, h, hex, size, life, vx, vh, vz, mul = 1, tile = TILE.ember) { spr(P.spr, x, h, y, vx, vh, vz, life, size, size * 0.4, col(hex), 0.7, tile, CM.fixed, 2, mul, 0, 1.2); }

/* ------------------------------------------------------------ öffentliche spawn-Funktionen (Kern: Rauchfahnen, Funken an Wracks) */
export const spawn = {
  smoke(x, y, r, n) { smoke(x, y, r, n || 1, 1.6, H.proj + 2, 10); },
  spark(x, y, n, speed, color) { spark(x, y, n || 3, speed || 60, color || '#ffd27a', 0.45, H.proj + 2); },
  ring(x, y, r, color, dur) { ring(x, y, r, color || '#ffffff', dur || 0.6, 2.5); },
  flash(x, y, r, color, dur) { flash(x, y, r, color || '#ffffff', dur || 0.25); }
};

/* ------------------------------------------------------------ Ereignisse */
const HIT = { beam: ['#bfe9ff', 90, 4], kin: ['#ffb070', 110, 6], rail: ['#dff4ff', 180, 10], torp: ['#ffb060', 120, 10], acid: ['#b4ff3c', 70, 6], bite: ['#ff6a8a', 80, 5], rock: ['#c9b9a0', 80, 5], pd: ['#ffe68c', 60, 3] };
/* Sichtbarkeit wie R.consume: Ereignisse mit Ort nur, wenn der Ort sichtbar ist (Ausnahmen: weithin sichtbare) */
const LOUD = new Set(['bdie', 'attack', 'strike', 'superfire', 'supercharged', 'gateLance', 'gateStorm', 'wake', 'siteWon', 'gateOn', 'breach', 'gateDark']);
export function event(e, g, view) {
  if (!T) return;
  if (e.x !== undefined && view && !LOUD.has(e.t) && !(e.t === 'captured' && (e.from === view.vp || e.to === view.vp))) {
    if (view.visAt ? !view.visAt(e.x, e.y) : (view.seen && view.vp >= 0 && !view.seen(e.x, e.y))) return;
  }
  const pc = o => (view && view.pcol && o !== undefined && o >= 0) ? view.pcol(o) : '#ffffff';
  const shake = k => { if (view && view.shake) view.shake(k); };
  switch (e.t) {
    case 'die': if (!e.quiet) { const r = e.r || 12; explode(e.x, e.y, r, e.big, pc(e.owner), H.proj + r * 0.25); if (e.big) { shake(6); later.push({ at: now + rnd(0.5, 0.9), fn: () => { fire(e.x + rnd(-r, r) * 0.5, e.y + rnd(-r, r) * 0.5, r * 0.5, 0.6, 2, H.proj + r * 0.3); smoke(e.x, e.y, r, 3, 2.2, H.proj + r * 0.3); } }); } } break;
    case 'bdie': {
      const r = e.r || 40, pcol = pc(e.owner);
      explode(e.x, e.y, r * 0.8, true, pcol, H.proj + r * 0.2);
      smoke(e.x, e.y, r, 14, 2.8, H.proj + r * 0.3);
      for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, dd = r * rnd(0.3, 0.8); later.push({ at: now + 0.22 + i * 0.28, fn: () => explode(e.x + Math.cos(a) * dd, e.y + Math.sin(a) * dd, r * (0.35 + 0.15 * i), i === 2, pcol, H.proj + r * 0.3, false) }); }
      for (let i = 0; i < 4; i++) later.push({ at: now + 1 + i * 0.5, fn: () => { fire(e.x + rnd(-r, r) * 0.6, e.y + rnd(-r, r) * 0.6, r * 0.35, 0.8, 2, H.proj + r * 0.3); spark(e.x, e.y, 6, 90, '#ffb070', 0.7, H.proj + r * 0.3); } });
      shake(9); break;
    }
    case 'hit': {
      const k = e.kind || 'kin', hh = H.proj;
      if (k === 'torp') explode(e.x, e.y, 10, false, '#ffb060', hh);
      else if (k === 'torpdie') { flash(e.x, e.y, 9, '#ffd080', 0.25, hh); spark(e.x, e.y, 5, 80, '#ffd27a', 0.3, hh); }
      else { const d = HIT[k] || HIT.kin; spark(e.x, e.y, d[2], d[1], d[0], k === 'acid' ? 0.5 : 0.4, hh, 1.5, 1.4); flash(e.x, e.y, k === 'rail' ? 10 : k === 'beam' ? 6 : 7, d[0], k === 'rail' ? 0.2 : 0.14, hh, k === 'rail' ? TILE.star : TILE.glow, k === 'rail' ? 1.3 : 1.1); }
      break;
    }
    case 'shield': dome(e.x, e.y, e.r || 16, e.ang || 0, pc(e.owner)); break;
    case 'shdown': ring(e.x, e.y, (e.r || 16) * 1.4, '#8fe3ff', 0.5, 2.5); break;
    case 'shot':
      if (e.kind === 'rail') { flash(e.x, e.y, 12, '#dff4ff', 0.15, H.proj, TILE.star, 1.4); glow(e.x, e.y, H.proj, 20, 36, '#9fd0ff', 0.25, 0.5); }
      else if (e.kind === 'kin' && e.big) flash(e.x + Math.cos(e.ang) * 10, e.y + Math.sin(e.ang) * 10, 5, '#ffe0a0', 0.1, H.proj);
      break;
    case 'pd': line(e.x, e.y, e.tx, e.ty, 0.9, '#ffe68c', 0.1, QMODE.grad, H.proj + 2, H.proj, 1.3); spr(P.spr, e.tx, H.proj, e.ty, 0, 0, 0, 0.12, 4, 7, col('#ffe68c'), 0.8, TILE.dot, CM.flash, 0, 1.2); break;
    case 'built': ring(e.x, e.y, 60, pc(e.owner), 0.8, 2.5); break;
    case 'upgrade': ring(e.x, e.y, 70, '#ffffff', 1, 2.5); break;
    case 'place': ring(e.x, e.y, 40, '#ffffff', 0.5, 2); break;
    case 'ability': ring(e.x, e.y, e.r ? Math.min(e.r, 320) : 40, '#ffb86b', e.r ? 0.9 : 0.5, 1.5, 1, 0.5); break;
    case 'abfx': flash(e.x, e.y, 16, '#dff4ff', 0.2, H.proj); break;
    case 'lance': line(e.x, e.y, e.tx, e.ty, 5, '#ffffff', 0.45, QMODE.flat, H.proj, H.proj, 1.6, 0.95); line(e.x, e.y, e.tx, e.ty, 14, '#8fe3ff', 0.6, QMODE.flat, H.proj, H.proj, 1, 0.5); flash(e.tx, e.ty, 40, '#dff4ff', 0.4, H.proj, TILE.star, 1.2); spark(e.tx, e.ty, 20, 200, '#bfe9ff', 0.6, H.proj); shake(5); break;
    case 'board': line(e.fx, e.fy, e.x, e.y, 2, '#ffb86b', 0.5, QMODE.flat, H.proj, H.proj, 1, 0.8); spark(e.x, e.y, 10, 60, '#ffd27a', 0.6, H.proj); break;
    case 'captured': ring(e.x, e.y, 50, pc(e.to), 1, 3); spark(e.x, e.y, 14, 90, '#ffffff', 0.6, H.proj); break;
    case 'derelict': smoke(e.x, e.y, 12, 6, 2, H.proj); spark(e.x, e.y, 8, 50, '#ffd27a', 0.5, H.proj); break;
    case 'recrew': ring(e.x, e.y, 30, '#7ddc6b', 0.6, 2); break;
    case 'heal': if (detail > 1) spark(e.x + rnd(-0.5, 0.5) * (e.r || 10), e.y + rnd(-0.5, 0.5) * (e.r || 10), 2, 25, '#9fffcf', 0.4, H.proj + 3, 1.2, 1.5); break;
    case 'exodus': { const r = e.r || 12; ring(e.x, e.y, r * 2.2, '#8fe3ff', 0.6, 2.5); flash(e.x, e.y, r * 1.6, '#dff4ff', 0.35, H.proj + r * 0.3, TILE.star, 1.3); glow(e.x, e.y, H.proj + r * 0.3, r * 1.2, r * 3, '#8fe3ff', 0.5, 0.5); if (e.to === 0) spark(e.x, e.y, 8, 90, '#bfe9ff', 0.5, H.proj); break; }
    case 'superfire':
      if (e.kind === 'exodus') { disc(e.x, e.y, 150, 150, 0, DMODE.vortex, 1.8, '#ffffff', 0); ring(e.x, e.y, 140, '#8fe3ff', 1.2, 3); glow(e.x, e.y, H.proj + 6, 60, 140, '#8fe3ff', 1.6, 0.35); spark(e.x, e.y, 24, 160, '#bfe9ff', 0.9, H.proj + 4, 1.3, 1.5); }
      else if (e.kind === 'broodstorm') { const r = e.r || 200; disc(e.x, e.y, r * 1.2, r * 1.2, 0, DMODE.storm, 1.8, '#ffffff', 0); ring(e.x, e.y, r * 1.4, '#b4ff3c', 1.3, 4); smoke(e.x, e.y, r * 0.3, 10, 3, H.proj, 14); spark(e.x, e.y, 30, 200, '#d6ff6a', 0.8, H.proj, 1.3, 1.6); for (let i = 0; i < 60 * K; i++) { const a = Math.random() * TAU, dd = Math.random() * r * 0.5; spr(P.spr, e.x + Math.cos(a) * dd, H.proj, e.y + Math.sin(a) * dd, Math.cos(a) * rnd(10, 50), rnd(8, 30), Math.sin(a) * rnd(10, 50), rnd(1.5, 3.5), 4.5, 2, col('#b4ff3c'), 0.9, TILE.ember, CM.fixed, 0.5, 1.3); } shake(8); }
      else if (e.kind === 'strike') { if (e.sx !== undefined) { flash(e.sx, e.sy, 50, '#ffe0a0', 0.4, H.proj + 20, TILE.glow, 1.1); spark(e.sx, e.sy, 12, 120, '#ffd27a', 0.5, H.proj + 20); } shake(8); }
      else if (e.kind === 'sunbreak') { ring(e.x, e.y, (e.r || 260) * 1.1, '#ffb070', 1.4, 5); flash(e.x, e.y, (e.r || 260) * 0.5, '#fff2d0', 0.5, H.proj + 10, TILE.glow, 1.2); shake(6); }
      else { ring(e.x, e.y, (e.r || 200) * 1.2, '#eadcff', 1.2, 3); flash(e.x, e.y, 60, '#ffffff', 0.4, H.proj + 6, TILE.star, 1.2); }
      break;
    case 'strike': { const r = e.r || 150; explode(e.x, e.y, r * 0.45, true, '#ffb070', H.proj, false); ring(e.x, e.y, r * 1.6, '#ff8a5a', 1.3, r * 0.1, 1, 0.5); smoke(e.x, e.y, r * 0.5, 18, 3.2, H.proj, 14); debris(e.x, e.y, 30, 260, 30, H.proj, 1); spark(e.x, e.y, 40, 320, '#ffd27a', 1.1, H.proj, 1.6, 1.5); later.push({ at: now + 0.35, fn: () => fire(e.x, e.y, r * 0.4, 1.2, 6, H.proj + r * 0.15, 0.9) }); shake(16); break; }
    case 'supercharged': ring(e.x, e.y, 80, '#ffb86b', 1.2, 3); break;
    case 'jump': { const r = e.r || 12; ring(e.x, e.y, r * 2, '#c9a0ff', 0.5, 2.5); flash(e.x, e.y, r * 1.4, '#eadcff', 0.3, H.proj + r * 0.3, TILE.star, 1.2); if (!e.from) spark(e.x, e.y, 8, 90, '#e0c8ff', 0.5, H.proj); break; }
    case 'merge': { const r = e.r || 14; ring(e.x, e.y, r * 2.5, '#eadcff', 0.9, 3); flash(e.x, e.y, r * 1.8, '#ffffff', 0.4, H.proj + r * 0.3, TILE.glow, 1.1); spark(e.x, e.y, 20, 140, '#f3e6ff', 0.7, H.proj); break; }
    case 'bound': line(e.fx, e.fy, e.x, e.y, 3, '#c9a0ff', 0.6, QMODE.soft, H.proj, H.proj, 1, 0.9); ring(e.x, e.y, 50, '#c9a0ff', 0.8, 3); break;
    case 'dormant': smoke(e.x, e.y, 14, 6, 2, H.proj + 2); ring(e.x, e.y, 40, '#f2c14e', 1, 2.5); break;
    case 'resurrect': ring(e.x, e.y, 120, '#f2c14e', 1.2, 4); flash(e.x, e.y, 90, '#fff6dc', 0.5, H.proj + 6, TILE.star, 1.1); spark(e.x, e.y, 30, 160, '#f2c14e', 0.9, H.proj, 1.3, 1.6); break;
    case 'ruin': ring(e.x, e.y, 60, e.result === 'trap' ? '#ff5b47' : '#9ff0c0', 1, 2.5); break;
    case 'siteWon': ring(e.x, e.y, 120, '#9ff0c0', 1.3, 3); break;
    case 'gateOn': ring(e.x, e.y, 110, '#9ff0c0', 1.2, 3); flash(e.x, e.y, 70, '#9ff0c0', 0.5, H.proj + 10); break;
    case 'gateLance': line(e.fx, e.fy, e.x, e.y, 10, '#ff8c64', 0.6, QMODE.flat, H.proj + 8, H.proj, 1, 0.6); line(e.fx, e.fy, e.x, e.y, 3, '#fff0e0', 0.45, QMODE.flat, H.proj + 8, H.proj, 1.6, 0.95); explode(e.x, e.y, 60, true, '#ff8a5a', H.proj, false); ring(e.x, e.y, 300, '#ff8a5a', 1.2, 24, 1, 0.45); shake(12); break;
    case 'gateStorm': ring(e.x, e.y, 200, '#ff5b47', 1.5, 5); smoke(e.x, e.y, 80, 16, 3, H.proj, 12); break;
    case 'wake': ring(e.x, e.y, 150, '#9ff0c0', 1.5, 4); shake(8); break;
    case 'phase': ring(e.x, e.y, (e.r || 12) * 1.6, '#ffffff', 0.3, 1.5); break;
    case 'burst': { const r = e.r || 40; ring(e.x, e.y, r, '#b4ff3c', 0.7, 3); smoke(e.x, e.y, r * 0.4, 10, 2, H.proj); spark(e.x, e.y, 16, 120, '#d6ff6a', 0.6, H.proj); break; }
    case 'hatch': ring(e.x, e.y, (e.r || 12) * 1.8, '#ff9ad6', 0.6, 2.5); spark(e.x, e.y, 10, 80, '#b4ff3c', 0.5, H.proj); break;
    case 'devour': line(e.tx, e.ty, e.x, e.y, 6, '#b4ff3c', 0.4, QMODE.tail, H.proj, H.proj, 1, 0.7); explode(e.x, e.y, e.r || 12, false, '#8be04a', H.proj); break;
    case 'breach': { const r = e.r || 40; ring(e.x, e.y, r * 2.4, '#ff5b47', 1.1, 4); ring(e.x, e.y, r * 1.4, '#ffffff', 0.7, 2); flash(e.x, e.y, r * 1.5, '#ffd0c0', 0.5, H.proj + 4, TILE.glow, 1.1); spark(e.x, e.y, 26, 220, '#ff9a7a', 0.8, H.proj, 1.3, 1.5); shake(7); break; }
    case 'gateDark': ring(e.x, e.y, 160, '#9ff0c0', 1.4, 3); smoke(e.x, e.y, 60, 10, 2.5, H.proj, 10); break;
    case 'eat': if (detail > 1) spark(e.x + rnd(-0.5, 0.5) * (e.r || 10), e.y + rnd(-0.5, 0.5) * (e.r || 10), 2, 30, '#b4ff3c', 0.4, H.proj + 2); break;
    case 'morph': ring(e.x, e.y, (e.r || 14) * 2.2, '#d6ff6a', 0.8, 3); spark(e.x, e.y, 14, 100, '#b4ff3c', 0.6, H.proj); break;
    /* rank, deliver, relics, netoff, attack, flareStart: Texte und Pings macht die 2D-Überlagerung */
  }
}

/* ------------------------------------------------------------ Frame */
export function frame(g, dt, time, view, cam) {
  if (!T) return;
  dt = Math.min(dt || 0, 0.1); now = time;
  /* zeitversetzte Wirkungen */
  if (later.length) { let w = 0; for (let i = 0; i < later.length; i++) { const q = later[i]; if (time >= q.at) q.fn(); else later[w++] = q; } later.length = w; }
  for (const k in B) B[k].begin(time);
  stepSprites(P.spr, dt, B.spr); stepSprites(P.smoke, dt, B.smoke); stepQuads(P.quad, dt, B.quad); stepRings(P.ring, dt, B.ring);
  stepChunks(P.chunk, dt, B.chunk); stepDomes(P.dome, dt, B.dome); stepDiscs(P.disc, dt, B.disc);
  if (g) {
    beams(g, dt, time, view);
    projectiles(g, dt, time, view);
    if (g.strikes) strikes(g, dt, time);
    if (g.flares) flares(g, dt, time);
    if (g.spores) spores(g, dt, time, view);
    if (g.wave && g.wave.open) rifts(g, dt, time);
  }
  for (const k in B) B[k].flush();
}

const seenAt = (view, x, y) => !view || view.vp < 0 || (view.visAt ? view.visAt(x, y) : !view.seen || view.seen(x, y));
function wpnColOf(g, s, wp) { if (wp && wp.col) return wp.col; const p = g.players && g.players[s.owner]; return (p && WPN_COL[p.faction]) || '#8fe3ff'; }

/* Strahlen: Kern weiß (hell, blüht leicht), Hülle in Waffenfarbe additiv, weiter Hof, Glühen an Austritt und Ziel */
function beamsOf(list, g, dt, time, view) {
  for (const s of list) {
    if (s.dead || !s.beams) continue;
    for (let i = 0; i < s.beams.length; i++) {
      const bm = s.beams[i]; if (!bm) continue;
      const t = g.byId.get(bm.tid); if (!t || t.dead) continue;
      if (view && view.vp >= 0 && !view.visible(s) && !view.visible(t)) continue;
      const wps = s.k === 2 ? (s.def.lv && s.def.lv[s.lv - 1] ? s.def.lv[s.lv - 1].wpn : null) : s.def.wpn, wp = wps ? wps[i] : null;
      const c = col(wpnColOf(g, s, wp)), bw = (wp && wp.w) || 2, a = Math.atan2(t.y - s.y, t.x - s.x);
      const r0 = s.k === 2 ? s.def.r * 0.6 : s.def.r * 0.5, h0 = s.k === 2 ? H.beam + 6 : H.beam, h1 = H.beam + (t.k === 2 ? 4 : 0);
      const sx = s.x + Math.cos(a) * r0, sy = s.y + Math.sin(a) * r0, tx = t.x + rnd(-1.5, 1.5), ty = t.y + rnd(-1.5, 1.5);
      const pulse = 0.92 + 0.08 * Math.sin(time * 28 + s.id);
      if (bm.extra) for (const eid of bm.extra) { const e2 = g.byId.get(eid); if (!e2 || e2.dead) continue; B.quad.write(sx, h0, sy, e2.x, h1, e2.y, bw * 2.2, QMODE.flat, c[0], c[1], c[2], 0.35); B.quad.write(sx, h0, sy, e2.x, h1, e2.y, bw * 0.5, QMODE.flat, 1.5, 1.5, 1.5, 0.8); B.spr.write(e2.x, h1, e2.y, bw * 6, 0, TILE.glow, c[0], c[1], c[2], 0.6); }
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 6 * pulse, QMODE.flat, c[0], c[1], c[2], 0.16);
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 2.6 * pulse, QMODE.flat, c[0], c[1], c[2], 0.6);
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 0.65, QMODE.flat, 1.6, 1.6, 1.6, 0.95);
      B.spr.write(sx, h0, sy, bw * 7, 0, TILE.glow, c[0], c[1], c[2], 0.8);
      B.spr.write(tx, h1, ty, bw * 9 * pulse, time * 3, TILE.glow, c[0], c[1], c[2], 0.75);
      B.spr.write(tx, h1, ty, bw * 2.5, 0, TILE.dot, 1.4, 1.4, 1.4, 0.8);
      if (detail > 0 && Math.random() < 20 * dt * K) spark(tx, ty, 1, 70, wpnColOf(g, s, wp), 0.3, h1, 1.3, 1.2);
    }
  }
}
function beams(g, dt, time, view) { if (g.ships) beamsOf(g.ships, g, dt, time, view); if (g.bldgs) beamsOf(g.bldgs, g, dt, time, view); }

/* Geschosse aus g.proj: kin Leuchtstrich, rail lange helle Linie mit Nachglühen, torp Kapsel mit Glut und Rauchspur,
   acid Tropfen mit Spritzern, rock glühende Masse, bite kurzer grüner Zahn */
function projectiles(g, dt, time, view) {
  const P_ = g.proj; if (!P_) return;
  const white = col('#fff6dc'), h = H.proj;
  for (const q of P_) {
    if (q.dead || !seenAt(view, q.x, q.y)) continue;
    const dx = Math.cos(q.ang), dy = Math.sin(q.ang), kind = q.kind;
    if (kind === 'torp') {
      const c = col('#ffb070');
      B.caps.write(q.x, h, q.y, 0, Math.PI / 2 - q.ang, 0, 1.1, 1.1, 1.1, 0.35, 0.22, 0.2, 0.19);
      B.spr.write(q.x - dx * 3, h, q.y - dy * 3, 13, 0, TILE.glow, c[0], c[1], c[2], 0.85);
      B.spr.write(q.x - dx * 3.5, h, q.y - dy * 3.5, 3.2, 0, TILE.dot, 1.5, 1.35, 1.1, 0.9);
      B.quad.write(q.x - dx * 34, h, q.y - dy * 34, q.x - dx * 3, h, q.y - dy * 3, 4.5, QMODE.tail, c[0], c[1], c[2], 0.7);
      if (detail > 0 && Math.random() < 30 * dt) { trail(q.x - dx * 6, q.y - dy * 6, h, '#ff9a50', 7, 0.6, rnd(-6, 6), rnd(2, 8), rnd(-6, 6), 0.8, TILE.glow); }
      if (detail > 0 && Math.random() < 14 * dt * K) spr(P.smoke, q.x - dx * 7, h, q.y - dy * 7, rnd(-5, 5), rnd(3, 9), rnd(-5, 5), rnd(0.7, 1.2), 2.5, 9, [0.2, 0.19, 0.18], 0.5, TILE.smoke, CM.smoke, 0.5, 1, rnd(-1, 1));
    } else if (kind === 'rail') {
      const c = col('#9fd0ff');
      B.quad.write(q.x - dx * 70, h, q.y - dy * 70, q.x + dx * 2, h, q.y + dy * 2, 5, QMODE.tail, c[0], c[1], c[2], 0.5);
      B.quad.write(q.x - dx * 60, h, q.y - dy * 60, q.x + dx * 4, h, q.y + dy * 4, 1.6, QMODE.tail, 1.8, 1.8, 1.8, 0.95);
      B.spr.write(q.x, h, q.y, 16, 0, TILE.glow, c[0], c[1], c[2], 0.8);
      B.spr.write(q.x + dx * 2, h, q.y + dy * 2, 5, 0, TILE.dot, 1.7, 1.7, 1.7, 0.9);
      if (detail > 0) { const sp = q.sp || 1600, n = Math.min(4, Math.ceil(sp * dt / 40)); for (let i = 0; i < n; i++) { const b = (i + Math.random()) / n * sp * dt; glow(q.x - dx * b, q.y - dy * b, h, 7, 2, '#bfe9ff', 0.35, 0.45, 1, TILE.ember, 1.3); } }
    } else if (kind === 'rock') {
      const c = col('#ffb070');
      B.rock.write(q.x, h, q.y, time * 2.1, q.ang, time * 1.3, 4, 4, 4, 1, 0.3, 0.26, 0.22);
      B.spr.write(q.x, h, q.y, 26, 0, TILE.glow, c[0], c[1], c[2], 0.85);
      if (detail > 0 && Math.random() < 30 * dt) { trail(q.x - dx * 5, q.y - dy * 5, h, '#ff9a50', 6, 0.5, rnd(-10, 10), rnd(4, 12), rnd(-10, 10), 1, TILE.glow); spark(q.x, q.y, 1, 40, '#ffd27a', 0.3, h); }
    } else if (kind === 'acid') {
      const c = col(q.col || '#b4ff3c');
      B.spr.write(q.x, h, q.y, 7, 0, TILE.glow, c[0], c[1], c[2], 0.7);
      B.spr.write(q.x + dx * 1, h, q.y + dy * 1, 3, q.ang, TILE.dot, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0.95);
      B.quad.write(q.x - dx * 7, h, q.y - dy * 7, q.x, h, q.y, 2.4, QMODE.tail, c[0], c[1], c[2], 0.5);
      if (detail > 0 && Math.random() < 24 * dt * K) trail(q.x - dx * 2, q.y - dy * 2, h, q.col || '#b4ff3c', 2.2, 0.4, rnd(-14, 14), rnd(-4, 10), rnd(-14, 14), 1.2);
    } else {
      /* kin, bite, para: kurzer Leuchtstrich in Waffenfarbe mit hellem Kern und Glutpunkt */
      const c = col(q.col || wpnColOf(g, q, null)), bite = kind === 'bite';
      B.quad.write(q.x - dx * (bite ? 7 : 16), h, q.y - dy * (bite ? 7 : 16), q.x, h, q.y, bite ? 3.4 : 3.2, QMODE.tail, c[0], c[1], c[2], 0.65);
      B.quad.write(q.x - dx * 10, h, q.y - dy * 10, q.x + dx * 1.5, h, q.y + dy * 1.5, 1.2, QMODE.tail, white[0] * 1.4, white[1] * 1.4, white[2] * 1.4, 0.95);
      B.spr.write(q.x, h, q.y, 9, 0, TILE.glow, c[0], c[1], c[2], 0.55);
    }
  }
}

/* Massetreiber: Masse im Flug (g.strikes: sx,sy → x,y in 3,5 s, Bogen nach oben); der Warnkreis bleibt bei der 2D-Überlagerung */
function strikes(g, dt, time) {
  const c = col('#ffb070');
  for (const st of g.strikes) {
    const k = 1 - st.t / 3.5; if (k < 0 || k > 1) continue;
    const px = st.sx + (st.x - st.sx) * k, py = st.sy + (st.y - st.sy) * k, ph = H.proj + Math.sin(k * Math.PI) * 220;
    B.rock.write(px, ph, py, time * 1.7, time * 0.9, 0, 6, 6, 6, 1, 0.3, 0.26, 0.22);
    B.spr.write(px, ph, py, 40, 0, TILE.glow, c[0], c[1], c[2], 0.85);
    B.spr.write(px, ph, py, 10, 0, TILE.dot, 1.5, 1.4, 1.2, 0.9);
    if (detail > 0 && Math.random() < 40 * dt) { trail(px, py, ph, '#ff9a50', 9, 0.6, rnd(-12, 12), rnd(-6, 6), rnd(-12, 12), 1, TILE.glow); spark(px, py, 1, 50, '#ffd27a', 0.35, ph); }
  }
}

/* Sunbreaker-Eruption: brennende Scheibe (Shader) + Korona + aufsteigende Glut */
function flares(g, dt, time) {
  const c = col('#ffb070'), w = col('#fff2d0');
  for (const f of g.flares) {
    const k = Math.max(0, Math.min(1, f.t / f.t0)), fl = 0.95 + 0.05 * Math.sin(time * 19 + f.x);
    B.disc.write(f.x, H.disc + 0.1, f.y, f.r, f.r, 0, DMODE.flare, k, f.x * 0.01, 1, 1, 1, 1);
    B.spr.write(f.x, H.proj + f.r * 0.1, f.y, f.r * 2.6 * fl, time * 0.2, TILE.glow, c[0], c[1], c[2], 0.28 * (0.4 + 0.6 * k));
    B.spr.write(f.x, H.proj + f.r * 0.05, f.y, f.r * 0.8, -time * 0.3, TILE.puff, w[0], w[1], w[2], 0.2 * (0.3 + 0.7 * k));
    if (detail > 0) { const n = Math.min(4, Math.round(90 * dt * K)); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, dd = Math.random() * f.r; spr(P.spr, f.x + Math.cos(a) * dd, H.proj, f.y + Math.sin(a) * dd, rnd(-8, 8), rnd(15, 45), rnd(-8, 8), rnd(0.8, 1.8), 3.5, 1, col('#ffd27a'), 0.9, TILE.ember, CM.ember, 0.3, 1.3); } }
  }
}

/* Sporenteppich: weiche grüne Scheibe (Shader) + schwebende Sporen */
function spores(g, dt, time, view) {
  for (const sp of g.spores) {
    if (!seenAt(view, sp.x, sp.y)) continue;
    const k = Math.min(1, sp.t / 5);
    B.disc.write(sp.x, H.disc, sp.y, sp.r, sp.r, 0, DMODE.spores, k, sp.x * 0.013 + sp.y * 0.007, 1, 1, 1, 0.9);
    if (detail > 0) { const n = Math.min(3, Math.round(sp.r * 0.12 * dt * K * 6)); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, dd = Math.sqrt(Math.random()) * sp.r; spr(P.spr, sp.x + Math.cos(a) * dd, H.ground + rnd(0, 4), sp.y + Math.sin(a) * dd, rnd(-5, 5), rnd(3, 9), rnd(-5, 5), rnd(1.5, 3), 2.2, 1.2, col('#d6ff6a'), 0.75 * k, TILE.ember, CM.fixed, 0.2, 1, 0, 0.8); } }
  }
}

/* Risse (Quarantine): längliche Wunde, quer zur Richtung zur Kartenmitte; bei Welle heller und mit Funken */
function rifts(g, dt, time) {
  const hot = g.wave.phase === 'wave', k = hot ? 1.6 : 0.8, m = g.map || { w: 0, h: 0 };
  for (const r0 of g.wave.open) {
    const rr = 80 + 10 * Math.sin(time * 2 + r0.x), ang = Math.atan2(m.h / 2 - r0.y, m.w / 2 - r0.x) + Math.PI / 2;
    /* Welt-Winkel ang (x → y, im Uhrzeigersinn) → Drehung um Y: −ang; die Scheibe liegt mit ihrer x-Achse entlang der Wunde */
    B.disc.write(r0.x, H.disc + 0.05, r0.y, rr * 1.6, rr * 0.7, -ang, DMODE.rift, k, r0.x * 0.01, 1, 1, 1, 1);
    if (hot && detail > 1 && Math.random() < 24 * dt * K) spark(r0.x + Math.cos(ang) * rnd(-rr, rr), r0.y + Math.sin(ang) * rnd(-rr, rr), 1, 40, '#d6ff6a', 0.5, H.ground, 1.2, 2);
  }
}
