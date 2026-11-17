/* =====================================================================
   Rift Armada – 3D-Effekte (Schnittstelle zum Kern, siehe src3d/SPEC.md »Effekte«).
   init(scene, THREE, kitMats, detail) · event(e, g, view) · frame(g, dt, time, view, cam) · spawn.{smoke, spark, ring, flash}
   · clear() · setDetail(d)
   Spielwelt (x, y) → Three (x, Höhe, y). Strahlen und Geschosse liegen auf Höhe 4, Boden-Effekte knapp über Y = 0.
   Alles liegt in wenigen instanzierten Puffern (buffers.js) und wird je Frame aus den Partikelvorräten (particles.js)
   und den Spielzuständen (s.beams, g.proj, g.strikes, g.flares, g.spores, g.wave.open) neu geschrieben. Partikelbudget
   je Detailstufe: 4 000 / 1 500 / 600; ist ein Vorrat voll, verdrängt Neues das Älteste.
   Ruhig und lesbar: Kerne hell (Bloom ab 1,25), Hüllen und Glühen unter 1, kein Dauerblinken.
   setPixelRatio(k): Render-Skalierung des Kerns (optional). Größen sind Welteinheiten und skalieren von selbst; die
   Shader lesen die Höhe des Render-Ziels selbst und klammern zu dünne Linien/Partikel (kein Flimmern bei 0,6).
   ===================================================================== */
import { useThree, makeAtlas, SpriteBuf, QuadBuf, RingBuf, ChunkBuf, DomeBuf, DiscBuf, TILE, QMODE, DMODE, SCREEN } from './buffers.js';
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
const CAP = [2100, 540, 2100, 690, 160, 64, 64];   /* Fassung 24: Platz für »Ultra« (Stufe 3) */
const LIM = { 3: CAP, 2: [1400, 360, 1400, 460, 120, 48, 48], 1: [520, 140, 520, 170, 60, 32, 32], 0: [200, 56, 200, 64, 30, 16, 16] };
const KF = [0.3, 0.55, 1, 1.5];
/* Waffenfarbe je Fraktion, wenn die Waffe keine eigene hat (data.js FACTIONS.wpn) */
const WPN_COL = { alliance: '#7ff6ff', mars: '#ffd27a', legion: '#d9b8ff', nexus: '#f3e6ff', brood: '#b4ff3c', guardian: '#b8ffd8' };

/* ------------------------------------------------------------ Farben (CSS-Hex → linear, zwischengespeichert) */
const COLS = new Map();
function col(hex) { let c = COLS.get(hex); if (!c) { const k = new T.Color(hex); c = [k.r, k.g, k.b]; COLS.set(hex, c); } return c; }
const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------ Aufbau */
/* Fassung 24 »Ultra«: Explosionen, Einschläge und Mündungsfeuer hellen die Schiffe ringsum auf. Keine echten
   Punktlichter (die kosteten jeden Bildpunkt jeder Oberfläche acht Lichtberechnungen), sondern höchstens acht
   gedachte Lichtquellen, die entities.js je Schiff in dessen Instanzfarbe einrechnet (glowAt) – fast kostenlos. */
const LT = { n: 8, list: [], on: false };
for (let i = 0; i < 8; i++) LT.list.push({ x: 0, z: 0, r: 1, g: 1, b: 1, t: 1, life: 1, peak: 0, dist: 100, k: 0 });
function lightsSet(on) { LT.on = on; for (const e of LT.list) { e.t = e.life; e.k = 0; } }
function light(x, y, h, hex, peak, dist, life) {
  if (!LT.on) return;
  let best = null, bv = 1e9; for (const e of LT.list) { const left = e.t >= e.life ? 0 : e.peak * Math.pow(1 - e.t / e.life, 2); if (left < bv) { bv = left; best = e; } }
  if (!best || bv > peak) return;
  const c = col(hex); best.r = c[0]; best.g = c[1]; best.b = c[2]; best.x = x; best.z = y; best.dist = dist; best.t = 0; best.life = life; best.peak = peak; void h;
}
function lightsStep(dt) {
  if (!LT.on) return;
  for (const e of LT.list) { if (e.t >= e.life) { e.k = 0; continue; } e.t += dt; const k = Math.min(1, e.t / e.life), rise = Math.min(1, e.t / 0.04); e.k = e.peak * rise * Math.pow(1 - k, 2); }
}
/* Aufhellung an einem Ort (out = [r, g, b], wird addiert) */
export function glowAt(x, y, out) {
  if (!LT.on) return false; let any = false;
  for (const e of LT.list) { if (e.k <= 0.01) continue; const dx = x - e.x, dy = y - e.z, d2 = dx * dx + dy * dy, R = e.dist; if (d2 > R * R) continue; const f = e.k * 0.35 * (1 - Math.sqrt(d2) / R); out[0] += e.r * f; out[1] += e.g * f; out[2] += e.b * f; any = true; }
  return any;
}
export function init(scene, THREE, kitMats, d) {
  T = THREE; useThree(THREE);
  atlas = makeAtlas();
  root = new T.Group(); root.name = 'effects'; root.matrixAutoUpdate = false; scene.add(root);
  B.smoke = new SpriteBuf(CAP[1] + 120, atlas, 'normal', 8);
  B.fire = new SpriteBuf(CAP[0], atlas, 'premul', 9);
  B.chunk = new ChunkBuf(CAP[3] + 60, 'debris', 0);
  B.rock = new ChunkBuf(40, 'rock', 0);
  B.caps = new ChunkBuf(160, 'capsule', 0);
  B.mine = new ChunkBuf(200, 'rock', 0);   /* Fassung 22: Minen */
  B.disc = new DiscBuf(CAP[6] + 80, 5);
  B.ring = new RingBuf(CAP[4] + 40, 6);
  B.quad = new QuadBuf(CAP[2] + 700, 10);
  B.spr = new SpriteBuf(CAP[0] + 600, atlas, 'add', 11);
  B.dome = new DomeBuf(CAP[5] + 16, 12);
  B.rib = new QuadBuf(3200, 9);              /* Fassung 25: Triebwerksbänder */
  B.halo = new SpriteBuf(900, atlas, 'add', 10);   /* Fassung 25: Lichthöfe der Triebwerke */
  for (const k in B) root.add(B[k].mesh);
  P.spr = new Pool(CAP[0], SP.F); P.smoke = new Pool(CAP[1], SP.F); P.quad = new Pool(CAP[2], QP.F); P.chunk = new Pool(CAP[3], CP.F);
  P.ring = new Pool(CAP[4], RP.F); P.dome = new Pool(CAP[5], DP.F); P.disc = new Pool(CAP[6], KP.F);
  setDetail(d === undefined ? detail : d);
}
export function setDetail(d) {
  const dd = Math.max(0, Math.min(3, d | 0)); detail = Math.min(2, dd); K = KF[dd];
  if (T) lightsSet(dd === 3); if (B.dome && B.dome.mesh.material.uniforms) B.dome.mesh.material.uniforms.uRip.value = dd === 3 ? 1 : 0;
  if (!P.spr) return;   /* vor init: nur merken */
  const L = LIM[dd]; P.spr.lim = L[0]; P.smoke.lim = L[1]; P.quad.lim = L[2]; P.chunk.lim = L[3]; P.ring.lim = L[4]; P.dome.lim = L[5]; P.disc.lim = L[6];
}
/* Render-Skalierung des Kerns (0,5…2). Die Mindestbreite gilt in Pixeln des Render-Ziels; bei kleiner Skalierung
   etwas breiter, damit dünne Strahlen und Funken nicht unter einen Pixel fallen und flimmern. */
export function setPixelRatio(k) { k = Math.max(0.25, +k || 1); SCREEN.uMinPx.value = k < 0.9 ? 1.4 : 1.25; }
export function clear() { for (const k in P) P[k].clear(); later = []; clearRiftGates(); }
/* Anzahl lebender Partikel und Draw-Calls (für das Labor und die Leistungsanzeige) */
export function stats() { let n = 0; for (const k in P) n += P[k].count; let dc = 0; for (const k in B) if (B[k].mesh.visible) dc++; return { particles: n, drawCalls: dc, spr: B.spr.n, fire: B.fire.n, quad: B.quad.n, smoke: B.smoke.n, chunk: B.chunk.n, ring: B.ring.n, disc: B.disc.n, dome: B.dome.n }; }

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
    const a = Math.random() * TAU, dd = Math.random() * r * 0.6, v = rnd(8, 26), sh = rnd(0.035, 0.075);
    spr(P.smoke, x + Math.cos(a) * dd, h + rnd(0, r * 0.3), y + Math.sin(a) * dd, Math.cos(a) * v, vh * rnd(0.6, 1.4), Math.sin(a) * v, life * rnd(0.6, 1.4), r * rnd(0.4, 0.7), r * rnd(1.3, 2.2), [sh * 1.2, sh * 0.95, sh * 0.75], rnd(0.5, 0.75), TILE.smoke, CM.smoke, 0.8, 1, rnd(-0.6, 0.6));
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
/* Schildkuppel: trifft ein weiterer Schuss dieselbe Kuppel, wird die vorhandene aufgefrischt statt eine zweite
   darübergelegt (sonst addieren sich bei Dauerfeuer Dutzende Kuppeln zu Weiß) */
function dome(x, y, r, ang, hex, life = 0.32) {
  const D = P.dome.d, F = DP.F;
  for (let i = 0; i < P.dome.cap; i++) {
    if (!P.dome.on[i]) continue; const o = i * F;
    if (Math.abs(D[o + DP.x] - x) < r * 0.3 && Math.abs(D[o + DP.z] - y) < r * 0.3) { D[o + DP.hx] = Math.cos(ang); D[o + DP.hz] = Math.sin(ang); D[o + DP.t] = Math.min(D[o + DP.t], D[o + DP.life] * 0.15); return; }
  }
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

/* ------------------------------------------------------------ Fassung 25: Einstellungen, Lichthöfe, Triebwerksbänder */
const GFX = { halos: true, trails: true, bigBoom: true }, ST = { bloom: false };
export function setGfx(g) { GFX.halos = g.halos !== false; GFX.trails = g.trails !== false; GFX.bigBoom = g.booms !== false; }
export function state(o) { ST.bloom = !!o.bloom; }
/* Lichthof nur ohne Bloom (sonst übernimmt der Bloom das Leuchten) */
const haloOn = () => GFX.halos && !ST.bloom && detail > 0;
const HQ = [], TQ = [];
/* vom Kern (entities) je Bild gemeldet, im nächsten effects.frame geschrieben */
export function engineHalo(x, h, y, size, c, a) { if (haloOn()) HQ.push(x, h, y, size, c[0], c[1], c[2], a); }
export function ribbon(x0, h0, y0, x1, h1, y1, w, c, a) { if (GFX.trails && detail > 0) TQ.push(x0, h0, y0, x1, h1, y1, w, c[0], c[1], c[2], a); }
export function trailsOn() { return GFX.trails && detail > 0; }
export function rgb(hex) { return col(hex); }
function flushQueues() {
  for (let i = 0; i < HQ.length; i += 8) B.halo.write(HQ[i], HQ[i + 1], HQ[i + 2], HQ[i + 3], 0, TILE.glow, HQ[i + 4], HQ[i + 5], HQ[i + 6], HQ[i + 7]);
  for (let i = 0; i < TQ.length; i += 11) B.rib.write(TQ[i], TQ[i + 1], TQ[i + 2], TQ[i + 3], TQ[i + 4], TQ[i + 5], TQ[i + 6], QMODE.flat, TQ[i + 7], TQ[i + 8], TQ[i + 9], TQ[i + 10]);
  HQ.length = 0; TQ.length = 0;
}
/* glühende Trümmerteile, die lange treiben (große Explosionen) */
function embers(x, y, n, speed, r, h) {
  n = Math.round(n * K);
  for (let i = 0; i < n; i++) {
    const j = P.chunk.alloc(); if (j < 0) return;
    const d = P.chunk.d, o = j * CP.F, a = Math.random() * TAU, v = speed * rnd(0.3, 1);
    d[o + CP.x] = x + Math.cos(a) * r * 0.3; d[o + CP.h] = h + rnd(-r * 0.1, r * 0.3); d[o + CP.z] = y + Math.sin(a) * r * 0.3;
    d[o + CP.vx] = Math.cos(a) * v; d[o + CP.vh] = rnd(-3, 3); d[o + CP.vz] = Math.sin(a) * v;
    d[o + CP.rx] = Math.random() * TAU; d[o + CP.ry] = Math.random() * TAU; d[o + CP.rz] = Math.random() * TAU;
    d[o + CP.wx] = rnd(-1.5, 1.5); d[o + CP.wy] = rnd(-1.5, 1.5); d[o + CP.wz] = rnd(-1.5, 1.5);
    d[o + CP.t] = 0; d[o + CP.life] = rnd(5, 9); d[o + CP.s] = rnd(0.8, 2.2) * Math.max(0.8, Math.min(2.6, r / 12)); d[o + CP.glow] = rnd(1.6, 2.6); d[o + CP.shade] = rnd(0.1, 0.2);
  }
}
/* Fassung 25: große Schiffe – Druckwellenring, Nachexplosionen über gut eine Sekunde, glühende Trümmer, die treiben */
function bigBoom(x, y, r, hex, h) {
  ring(x, y, r * 6, '#ffffff', 0.55, r * 0.22, 1.6, 0.8, r * 0.6);
  ring(x, y, r * 4.2, hex || '#ffb060', 1.1, r * 0.35, 1, 0.45, r * 0.4);
  flash(x, y, r * 2.6, '#fff4e0', 0.3, h + r * 0.3, TILE.glow, 1.2, 0.7);
  embers(x, y, 12, 26, r, h);
  for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, dd = r * rnd(0.4, 1.1); later.push({ at: now + 0.25 + i * rnd(0.22, 0.38), fn: () => { explode(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r * rnd(0.35, 0.55), false, hex, h, false); light(x + Math.cos(a) * dd, y + Math.sin(a) * dd, h, '#ffa050', 1.4, 160, 0.35); } }); }
}

/* ------------------------------------------------------------ öffentliche spawn-Funktionen (Kern: Rauchfahnen, Funken an Wracks) */
export const spawn = {
  smoke(x, y, r, n) { smoke(x, y, r, n || 1, 1.6, H.proj + 2, 10); },
  spark(x, y, n, speed, color) { spark(x, y, n || 3, speed || 60, color || '#ffd27a', 0.45, H.proj + 2); },
  ring(x, y, r, color, dur) { ring(x, y, r, color || '#ffffff', dur || 0.6, 2.5); },
  flash(x, y, r, color, dur) { flash(x, y, r, color || '#ffffff', dur || 0.25); },
  /* Fassung 24: Brandherd und kleine Explosion für die Schadensstufen */
  fire(x, y, r) { fire(x, y, r, 0.7, 1, H.proj + 3, 0.5); },
  burst(x, y, r) { flash(x, y, r, '#ffc070', 0.22, H.proj + 3); spark(x, y, 7, 110, '#ffd27a', 0.5, H.proj + 3); smoke(x, y, r * 0.8, 2, 1.4, H.proj + 3, 10); }
};
/* Fassung 24: Mündungsfeuer in Fraktionsfarbe */
const FCOL = { alliance: '#8fd8ff', mars: '#ffb060', legion: '#ffd27a', nexus: '#d2a8ff', brood: '#b4ff3c', guardian: '#8fe8ff' };
function facCol(g, o) { const p = g && g.players && g.players[o]; return (p && FCOL[p.faction]) || '#ffe0a0'; }

/* ------------------------------------------------------------ Fassung 30: eigene Kampfbilder für Brood, Mars und Nexus
   Brood frisst: wer zubeißt, hängt für die Dauer des Bisstakts mit pulsierenden Strängen am Opfer und saugt Brocken ins Maul;
   Säure klatscht auf und frisst nach. Mars schießt heiße Leuchtspur mit Mündungsfeuer und Einschlagsglut. Nexus-Strahlen
   sind Kristalllanzen: Pulsknoten laufen zum Ziel, zwei gezackte Lichtbögen umspielen den Kern. Alles nur Bild, keine Spielwerte. */
const facOf = (g, o) => { const p = g && g.players && g.players[o]; return p ? p.faction : ''; };
const FEED = new Map();          /* Angreifer-Id → { tid, until, rg, k } */
const PREY = new Map();          /* Opfer-Id → bis wann es gepackt ist */
/* Fassung 31: Haltung fürs Modell – der Fresser stößt im Kautakt vor und schwillt beim Schlucken, das Opfer zittert.
   out = [dx, dy, Maßstab]; liefert false, wenn das Schiff weder frisst noch gefressen wird */
export function pose(u, time, out) {
  const f = FEED.get(u.id);
  if (f && time <= f.until) { const t = f.tx !== undefined ? Math.atan2(f.ty - u.y, f.tx - u.x) : u.ang, c = Math.sin(time * 13 + u.id), k = Math.max(0, c) * u.def.r * 0.22; out[0] = Math.cos(t) * k; out[1] = Math.sin(t) * k; out[2] = 1 + 0.07 * Math.max(0, -c); return true; }
  const p = PREY.get(u.id);
  if (p && time <= p && u.def.cls !== 'l') { const a = u.def.cls === 's' ? 1.6 : 0.9; out[0] = Math.sin(time * 47 + u.id) * a; out[1] = Math.cos(time * 53 + u.id * 2) * a; out[2] = 1; return true; }
  return false;
}
const TENT = '#b05ae0', TENT2 = '#ff8fc0';
/* zwei Fangarme greifen von den Flanken des Fressers um das Opfer herum; Saugnäpfe als helle Punkte */
function tentacles(s, t, time, k) {
  const a = Math.atan2(t.y - s.y, t.x - s.x), ca = Math.cos(a), sa = Math.sin(a), h = H.proj + 1.5, tr = t.def ? t.def.r : 12, tc = col(TENT), pc = col(TENT2), seg = detail > 1 && quadRoom() ? 8 : 5;
  for (let j = -1; j <= 1; j += 2) {
    const grip = 0.85 + 0.15 * Math.sin(time * 5 + s.id + j);           /* Zugreifen und Lockern */
    const x0 = s.x + ca * s.def.r * 0.35 - sa * j * s.def.r * 0.55, y0 = s.y + sa * s.def.r * 0.35 + ca * j * s.def.r * 0.55;
    const x2 = t.x + ca * tr * 0.35 * grip - sa * j * tr * 0.75 * grip, y2 = t.y + sa * tr * 0.35 * grip + ca * j * tr * 0.75 * grip;      /* hinter der Mitte des Opfers */
    const bow = (tr * 0.9 + s.def.r * 0.5) * (1.1 + 0.15 * Math.sin(time * 3.3 + j * 2 + s.id)), x1 = (x0 + x2) / 2 - sa * j * bow, y1 = (y0 + y2) / 2 + ca * j * bow;
    let px = x0, py = y0;
    for (let i = 1; i <= seg; i++) { const u = i / seg, v = 1 - u, wob = Math.sin(time * 8 + u * 6 + j + s.id) * 1.4 * k * Math.sin(u * Math.PI);
      const qx = v * v * x0 + 2 * v * u * x1 + u * u * x2 - sa * wob, qy = v * v * y0 + 2 * v * u * y1 + u * u * y2 + ca * wob, w = (5.2 - 3.4 * u) * k;
      B.quad.write(px, h, py, qx, h, qy, w * 1.9, QMODE.flat, tc[0], tc[1], tc[2], 0.28);
      B.quad.write(px, h, py, qx, h, qy, w, QMODE.flat, tc[0] * 1.15, tc[1] * 1.15, tc[2] * 1.15, 0.95);
      B.quad.write(px, h, py, qx, h, qy, w * 0.3, QMODE.flat, pc[0] * 1.3, pc[1] * 1.3, pc[2] * 1.3, 0.9);
      if (i < seg) B.spr.write(qx, h, qy, w * 1.1, 0, TILE.dot, 1.5, 1.1, 1.4, 0.8);
      px = qx; py = qy; }
    B.spr.write(x2, h, y2, 9 * k, time * 3, TILE.glow, pc[0], pc[1], pc[2], 0.75);   /* Griffpunkt glüht */
  }
}
const FLESH = '#ff5f8f', ICHOR = '#b4ff3c', NX = ['#b98cff', '#7fe9ff', '#ff9ae8'];
const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const quadRoom = () => B.quad.n < B.quad.cap * 0.7;
function suck(s, t, time, dt, k) {
  const a = Math.atan2(t.y - s.y, t.x - s.x), d = Math.hypot(t.x - s.x, t.y - s.y);
  const mr = s.def.r * 0.75, tr = Math.min(d * 0.45, (t.def ? t.def.r : 12) * 0.55);
  const mx = s.x + Math.cos(a) * mr, my = s.y + Math.sin(a) * mr, px = t.x - Math.cos(a) * tr, py = t.y - Math.sin(a) * tr;
  const L = Math.hypot(px - mx, py - my); if (L < 2) return;
  const nx = -(py - my) / L, ny = (px - mx) / L, h = H.proj, fc = col(FLESH), gc = col(ICHOR), full = detail > 1 && quadRoom(), n = full ? 3 : detail > 0 ? 2 : 1, seg = full ? 6 : 4;
  const pulse = 0.75 + 0.25 * Math.sin(time * 11 + s.id), amp = (6 + L * 0.12) * k;
  if (detail > 0 && k >= 0.85) tentacles(s, t, time, k);
  const off = (u, side, ph) => Math.sin(u * Math.PI) * (side * amp * 0.9 + Math.sin(time * 9 + ph + u * 5) * amp * 0.6);
  for (let j = 0; j < n; j++) {
    const ph = s.id * 1.7 + j * 2.1, side = j - (n - 1) / 2;
    let x0 = px, y0 = py;
    for (let i = 1; i <= seg; i++) {
      const u = i / seg, o2 = off(u, side, ph), x1 = px + (mx - px) * u + nx * o2, y1 = py + (my - py) * u + ny * o2, w = (2.2 + 2.6 * (1 - u)) * k * pulse;
      B.quad.write(x0, h, y0, x1, h, y1, w * 2.8, QMODE.flat, gc[0], gc[1], gc[2], 0.2);
      B.quad.write(x0, h, y0, x1, h, y1, w, QMODE.flat, fc[0] * 1.25, fc[1] * 1.25, fc[2] * 1.25, 0.85);
      x0 = x1; y0 = y1;
    }
    /* Brocken wandern den Strang entlang ins Maul und werden dabei kleiner */
    for (let b = 0; b < 2; b++) { const u = (time * 1.9 + ph * 0.37 + b * 0.5) % 1, o2 = off(u, side, ph); B.spr.write(px + (mx - px) * u + nx * o2, h, py + (my - py) * u + ny * o2, (9 - 5 * u) * k, 0, TILE.dot, 1.6, 1.15, 0.95, 0.95); }
  }
  B.spr.write(px, h, py, 30 * k * pulse, time * 2, TILE.glow, fc[0], fc[1], fc[2], 0.8);
  /* Sog: Ringe ziehen sich auf die Wunde zusammen */
  if (Math.floor(time / 0.4 + s.id * 0.37) !== Math.floor((time - dt) / 0.4 + s.id * 0.37)) ring(px, py, 3, FLESH, 0.4, 2.2, 1.3, 0.85, 24 * k);            /* Wunde */
  B.spr.write(mx, h, my, 20 * k * (1.55 - pulse), 0, TILE.glow, gc[0], gc[1], gc[2], 0.7);        /* Maul schluckt im Gegentakt */
  if (detail > 0 && Math.random() < 30 * dt * K) { const life = rnd(0.25, 0.45), jx = rnd(-8, 8) * k, jy = rnd(-8, 8) * k; spr(P.spr, px + jx, h, py + jy, (mx - px - jx) / life, rnd(-4, 8), (my - py - jy) / life, life, 5.5 * k, 1.6, col(Math.random() < 0.5 ? FLESH : ICHOR), 0.9, TILE.ember, CM.fixed, 0, 1.3); }
}
function feeding(g, dt, time, view) {
  const vis = (s, t) => !view || view.vp < 0 || !view.visible || view.visible(s) || view.visible(t);
  for (const [sid, f] of FEED) {
    const s = g.byId.get(sid), t = g.byId.get(f.tid);
    if (!s || s.dead || !t || t.dead || time > f.until || time < f.until - 3 || Math.hypot(t.x - s.x, t.y - s.y) > f.rg) { FEED.delete(sid); continue; }
    f.tx = t.x; f.ty = t.y; PREY.set(f.tid, time + 0.3);
    if (vis(s, t)) suck(s, t, time, dt, f.k);
  }
  if (PREY.size > 64) for (const [id, un] of PREY) if (time > un) PREY.delete(id);
  /* Grazer am Wrack */
  if (g.ships) for (const u of g.ships) { if (u.dead || !u.def.eat || !u.o || u.o.t !== 'eat') continue; const t = g.byId.get(u.o.tid); if (!t || t.dead || Math.hypot(t.x - u.x, t.y - u.y) > t.def.r + u.def.r + 40) continue; if (vis(u, t)) suck(u, t, time, dt, 0.9); }
}
function chomp(e) {
  const hh = H.proj, a = e.ang || 0, cx = Math.cos(a), sy = Math.sin(a);
  flash(e.x, e.y, 9, FLESH, 0.16, hh, TILE.glow, 1.3);
  /* zwei Kiefer schnappen zu */
  line(e.x - sy * 10 - cx * 4, e.y + cx * 10 - sy * 4, e.x + cx * 5, e.y + sy * 5, 2.8, '#f4ffd0', 0.14, QMODE.tail, hh, hh, 1.5);
  line(e.x + sy * 10 - cx * 4, e.y - cx * 10 - sy * 4, e.x + cx * 5, e.y + sy * 5, 2.8, '#f4ffd0', 0.14, QMODE.tail, hh, hh, 1.5);
  spark(e.x, e.y, 12, 120, FLESH, 0.5, hh, 1.5, 1.3); spark(e.x, e.y, 5, 70, ICHOR, 0.45, hh);
  ring(e.x, e.y, 15, FLESH, 0.3, 2, 1.3, 0.8, 3); flash(e.x, e.y, 13, '#ffd0e0', 0.1, hh, TILE.star, 1.3);
  if (detail > 0 && Math.random() < 0.55) debris(e.x, e.y, 1, 60, 6, hh, 0.4);
}
function acidSplash(e) {
  const hh = H.proj;
  flash(e.x, e.y, 9, ICHOR, 0.2, hh); spark(e.x, e.y, 7, 80, ICHOR, 0.55, hh, 1.5, 1.4); ring(e.x, e.y, 16, ICHOR, 0.45, 1.6, 1, 0.7, 4);
  if (e.sh) return;
  glow(e.x, e.y, hh, 16, 32, '#7dff2a', 2.2, 0.55); glow(e.x, e.y, hh, 6, 12, '#e8ffb0', 0.5, 0.7); spark(e.x, e.y, 5, 45, '#d6ff6a', 0.8, hh, 1.2, 0.2);   /* ätzender Fleck klingt langsam ab, darüber Blasen und grüner Dampf */
  if (detail > 0 && later.length < 160) for (let i = 0; i < 5; i++) later.push({ at: now + 0.15 + i * 0.3, fn: () => { const x = e.x + rnd(-7, 7), y = e.y + rnd(-7, 7); flash(x, y, 4, '#d6ff6a', 0.14, hh, TILE.dot, 1.3); spr(P.smoke, x, hh, y, rnd(-3, 3), rnd(6, 12), rnd(-3, 3), rnd(0.7, 1.1), 2.5, 9, [0.25, 0.42, 0.12], 0.45, TILE.smoke, CM.smoke, 0.5, 1, rnd(-1, 1)); } });
}
function marsImpact(e) {
  const hh = H.proj;
  /* Fassung 31: Einschlag als kleine Explosion mit Splittern, Glutfleck und Rauch */
  flash(e.x, e.y, 12, '#ffe6b0', 0.14, hh, TILE.glow, 1.4); fire(e.x, e.y, 8, 0.45, 4, hh, 0.7);
  spark(e.x, e.y, 11, 190, '#ffe0a0', 0.4, hh, 1.7, 1.3); spark(e.x, e.y, 4, 80, '#ff7a3a', 0.6, hh);
  if (e.ang !== undefined) { const cx = Math.cos(e.ang), sy = Math.sin(e.ang); for (let j = -1; j <= 1; j += 2) line(e.x, e.y, e.x - cx * 16 - sy * j * 12, e.y - sy * 16 + cx * j * 12, 2, '#ffd9a0', 0.12, QMODE.tail, hh, hh, 1.5); }   /* Abpraller */
  glow(e.x, e.y, hh, 9, 15, '#ff5a1a', 1.2, 0.6);
  if (detail > 0) { smoke(e.x, e.y, 7, 1, 1.4, hh, 8); if (Math.random() < 0.5) debris(e.x, e.y, 1, 80, 5, hh); }
  if (Math.random() < 0.3) light(e.x, e.y, hh, '#ffb060', 0.9, 110, 0.2);
}
function marsMuzzle(e) {
  const cx = Math.cos(e.ang), sy = Math.sin(e.ang), mx = e.x + cx * e.r, my = e.y + sy * e.r, rail = e.kind === 'rail', big = e.big || rail, L = rail ? 34 : big ? 24 : 13, h = H.proj;
  line(mx + cx * L * (big ? 1.7 : 1.2), my + sy * L * (big ? 1.7 : 1.2), mx, my, big ? 10 : 4.5, rail ? '#dff4ff' : '#ffd9a0', big ? 0.11 : 0.08, QMODE.tail, h, h, 1.7);
  if (!big) return;
  /* Fassung 31: Feuerball an der Mündung, Druckring, Pulverdampf, der als Wand stehen bleibt */
  flash(mx + cx * 6, my + sy * 6, 13, rail ? '#dff4ff' : '#ffe0a0', 0.1, h, TILE.glow, 1.6); ring(mx, my, 18, rail ? '#bfe9ff' : '#ffc890', 0.22, 1.6, 1.1, 0.6, 4);
  if (!rail && detail > 0) for (let i = 0; i < 2; i++) { const v = rnd(10, 34), sh = rnd(0.2, 0.3); spr(P.smoke, mx + cx * rnd(2, 14), h + rnd(0, 3), my + sy * rnd(2, 14), cx * v - sy * rnd(-9, 9), rnd(2, 7), sy * v + cx * rnd(-9, 9), rnd(1.3, 2.1), 4, rnd(15, 24), [sh * 1.15, sh, sh * 0.85], 0.42, TILE.smoke, CM.smoke, 1.1, 1, rnd(-1, 1)); }
  if (!rail && Math.random() < 0.4) light(mx, my, h, '#ffb060', 0.8, 120, 0.12);
  /* Mündungsbremse: zwei Stichflammen quer, Pulverdampf */
  line(mx - sy * 11, my + cx * 11, mx, my, 3, rail ? '#9fd0ff' : '#ffb060', 0.09, QMODE.tail, h, h, 1.4); line(mx + sy * 11, my - cx * 11, mx, my, 3, rail ? '#9fd0ff' : '#ffb060', 0.09, QMODE.tail, h, h, 1.4);
  if (detail > 0) spr(P.smoke, mx, h, my, cx * 14 + rnd(-4, 4), rnd(3, 8), sy * 14 + rnd(-4, 4), rnd(0.6, 0.9), 3, 11, [0.3, 0.27, 0.24], 0.4, TILE.smoke, CM.smoke, 0.6, 1, rnd(-1, 1));
  if (rail) { ring(mx, my, 26, '#bfe9ff', 0.3, 2, 1.2, 0.8, 5); line(e.x - cx * e.r * 0.2, e.y - sy * e.r * 0.2, mx, my, 5, '#9fd0ff', 0.2, QMODE.soft, h, h, 1.2, 0.8); }
}
function nexusBeam(sx, h0, sy, tx, h1, ty, bw, time, seed, dt) {
  const dx = tx - sx, dy = ty - sy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, v = col(NX[0]), full = detail > 1 && quadRoom();
  const seg = Math.max(4, Math.min(full ? 9 : 5, Math.round(L / 40))), dh = h1 - h0;
  B.quad.write(sx, h0, sy, tx, h1, ty, bw * 10, QMODE.flat, v[0], v[1], v[2], 0.14);
  B.quad.write(sx, h0, sy, tx, h1, ty, bw * 0.6, QMODE.flat, 1.7, 1.7, 1.8, 0.95);
  /* Fassung 31: am Ziel bricht sich der Strahl in drei farbige Fächer, die langsam kreisen */
  for (let j = 0; j < 3; j++) { const a = time * 2.4 + j * 2.094 + seed, rl = bw * (11 + 5 * Math.sin(time * 9 + j + seed)), c = col(NX[j]); B.quad.write(tx + Math.cos(a) * rl, h1, ty + Math.sin(a) * rl, tx, h1, ty, bw * 1.5, QMODE.tail, c[0] * 1.2, c[1] * 1.2, c[2] * 1.2, 0.75); }
  /* Pulsknoten laufen zum Ziel */
  for (let i = 0; i < seg; i++) { const u0 = i / seg, u1 = (i + 1) / seg, um = (u0 + u1) / 2, w = bw * (1.1 + 2.3 * Math.pow(0.5 + 0.5 * Math.sin(um * L * 0.11 - time * 22 + seed), 3));
    B.quad.write(sx + dx * u0, h0 + dh * u0, sy + dy * u0, sx + dx * u1, h0 + dh * u1, sy + dy * u1, w, QMODE.flat, v[0], v[1], v[2], 0.6); }
  /* gezackte Lichtbögen um den Kern, sechzehnmal je Sekunde neu gewürfelt */
  const fr = Math.floor(time * 16);
  for (let j = 0; j < (full ? 2 : 1); j++) { const c = col(NX[1 + j]); let x0 = sx, y0 = sy, hh0 = h0;
    for (let i = 1; i <= seg; i++) { const u = i / seg, o2 = i === seg ? 0 : (hash(seed + j * 31 + i * 7 + fr * 13) - 0.5) * Math.sin(u * Math.PI) * bw * 7, x1 = sx + dx * u + nx * o2, y1 = sy + dy * u + ny * o2, hh1 = h0 + dh * u;
      B.quad.write(x0, hh0, y0, x1, hh1, y1, Math.max(0.8, bw * 0.45), QMODE.flat, c[0] * 1.3, c[1] * 1.3, c[2] * 1.3, 0.8); x0 = x1; y0 = y1; hh0 = hh1; } }
  /* Kristallglanz wandert den Strahl entlang; Austritt und Einschlag als drehende Sterne */
  for (let b = 0; b < (full ? 3 : 1); b++) { const u = (time * 1.6 + b / 3 + seed * 0.13) % 1; B.spr.write(sx + dx * u, h0 + dh * u, sy + dy * u, bw * 7, time * 4 + b, TILE.star, 1.4, 1.3, 1.6, 0.85); }
  B.spr.write(sx, h0, sy, bw * 8, -time * 3, TILE.star, v[0] * 1.3, v[1] * 1.3, v[2] * 1.3, 0.9);
  B.spr.write(tx, h1, ty, bw * 13 * (0.85 + 0.15 * Math.sin(time * 30 + seed)), time * 5, TILE.star, 1.5, 1.4, 1.7, 0.9);
  B.spr.write(tx, h1, ty, bw * 11, 0, TILE.glow, v[0], v[1], v[2], 0.7);
  if (haloOn()) B.spr.write(tx, h1, ty, bw * 26, 0, TILE.glow, v[0], v[1], v[2], 0.2);
  if (detail > 0 && Math.random() < 24 * dt * K) spark(tx, ty, 1, 90, NX[(Math.random() * 3) | 0], 0.35, h1, 1.4, 1.3);
}

/* ------------------------------------------------------------ Ereignisse */
/* Entität am Ereignisort (Schildereignisse tragen nur die Position des Ziels) */
function targetAt(g, x, y) {
  if (g.ships) for (const u of g.ships) if (u.x === x && u.y === y) return u;
  if (g.bldgs) for (const b of g.bldgs) if (b.x === x && b.y === y) return b;
  return null;
}
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
    case 'die': if (!e.quiet) { const r = e.r || 12; light(e.x, e.y, H.proj, '#ffa050', e.big ? 3.2 : 1.6, e.big ? 320 : 170, e.big ? 1.1 : 0.6); explode(e.x, e.y, r, e.big, pc(e.owner), H.proj + r * 0.25); if (haloOn()) glow(e.x, e.y, H.proj + r * 0.3, r * 4, r * 7, '#ffb060', e.big ? 0.9 : 0.5, 0.32); if (e.big && GFX.bigBoom && detail > 0) bigBoom(e.x, e.y, r, pc(e.owner), H.proj + r * 0.25); if (e.big) { shake(6); later.push({ at: now + rnd(0.5, 0.9), fn: () => { fire(e.x + rnd(-r, r) * 0.5, e.y + rnd(-r, r) * 0.5, r * 0.5, 0.6, 2, H.proj + r * 0.3); smoke(e.x, e.y, r, 3, 2.2, H.proj + r * 0.3); } }); } } break;
    case 'bdie': {
      const r = e.r || 40, pcol = pc(e.owner); light(e.x, e.y, H.proj, '#ff9a48', 4, 420, 1.6);
      explode(e.x, e.y, r * 0.8, true, pcol, H.proj + r * 0.2);
      smoke(e.x, e.y, r, 14, 2.8, H.proj + r * 0.3);
      for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, dd = r * rnd(0.3, 0.8); later.push({ at: now + 0.22 + i * 0.28, fn: () => explode(e.x + Math.cos(a) * dd, e.y + Math.sin(a) * dd, r * (0.35 + 0.15 * i), i === 2, pcol, H.proj + r * 0.3, false) }); }
      for (let i = 0; i < 4; i++) later.push({ at: now + 1 + i * 0.5, fn: () => { fire(e.x + rnd(-r, r) * 0.6, e.y + rnd(-r, r) * 0.6, r * 0.35, 0.8, 2, H.proj + r * 0.3); spark(e.x, e.y, 6, 90, '#ffb070', 0.7, H.proj + r * 0.3); } });
      shake(9); break;
    }
    case 'hit': {
      const k = e.kind || 'kin', hh = H.proj;
      /* Fassung 30: Biss, Säure und Mars-Geschosse haben ihr eigenes Trefferbild */
      if (k === 'bite') { chomp(e); break; }
      if (k === 'acid') { acidSplash(e); break; }
      if (k === 'kin' && !e.sh && e.own !== undefined && facOf(g, e.own) === 'mars') { marsImpact(e); break; }
      if (k === 'rail' && e.ang !== undefined) { const cx = Math.cos(e.ang), sy = Math.sin(e.ang); line(e.x - cx * 18, e.y - sy * 18, e.x + cx * 34, e.y + sy * 34, 3, '#dff4ff', 0.16, QMODE.tail, hh, hh, 1.6); ring(e.x, e.y, 20, '#bfe9ff', 0.3, 1.8, 1.2, 0.7, 4); }
      if (haloOn() && (k === 'torp' || k === 'rail' || Math.random() < 0.35)) glow(e.x, e.y, hh, k === 'torp' ? 34 : 18, k === 'torp' ? 52 : 26, (HIT[k] || HIT.kin)[0], k === 'torp' ? 0.4 : 0.18, 0.25);
      if (k === 'torp') light(e.x, e.y, hh, '#ffb060', 1.4, 160, 0.35); else if (k === 'rail' || (k === 'beam' && Math.random() < 0.3)) light(e.x, e.y, hh, (HIT[k] || HIT.kin)[0], k === 'rail' ? 1.0 : 0.6, 110, 0.18);
      if (k === 'torp') explode(e.x, e.y, 10, false, '#ffb060', hh);
      else if (k === 'torpdie') { flash(e.x, e.y, 9, '#ffd080', 0.25, hh); spark(e.x, e.y, 5, 80, '#ffd27a', 0.3, hh); }
      else { const d = HIT[k] || HIT.kin; spark(e.x, e.y, d[2], d[1], d[0], k === 'acid' ? 0.5 : 0.4, hh, 1.5, 1.4); flash(e.x, e.y, k === 'rail' ? 10 : k === 'beam' ? 6 : 7, d[0], k === 'rail' ? 0.2 : 0.14, hh, k === 'rail' ? TILE.star : TILE.glow, k === 'rail' ? 1.3 : 1.1); }
      break;
    }
    case 'shield': { const t = g ? targetAt(g, e.x, e.y) : null; if (t && (t.derelict || t.dead || (t.k === 1 && !(t.shield > 0) && !(t.abT && t.abT.invuln > 0) && !(t.dome > 0)))) break; dome(e.x, e.y, e.r || 16, e.ang || 0, pc(e.owner)); break; }
    case 'shdown': ring(e.x, e.y, (e.r || 16) * 1.4, '#8fe3ff', 0.5, 2.5); break;
    /* Fassung 22: Schildwall getroffen / zusammengebrochen */
    case 'wallhit': flash(e.x, e.y, 12, '#dff4ff', 0.18, H.proj); spark(e.x, e.y, 3, 70, '#8fe3ff', 0.3, H.proj); break;
    case 'wallDown': ring(e.x, e.y, 110, '#8fe3ff', 0.8, 3); spark(e.x, e.y, 24, 180, '#bfe9ff', 0.7, H.proj); break;
    case 'shot': {
      /* Mündungsfeuer am Bug in Richtung des Schusses (Strahl, Geschoss, Torpedo, Säure) */
      if (e.ang !== undefined && e.r) { const c = e.kind === 'rail' ? '#dff4ff' : e.kind === 'acid' ? '#b4ff3c' : facCol(g, e.owner), mx = e.x + Math.cos(e.ang) * e.r, my = e.y + Math.sin(e.ang) * e.r, s0 = e.big || e.kind === 'torp' ? 9 : e.kind === 'beam' ? 7 : 5;
        flash(mx, my, s0, c, 0.09, H.proj, TILE.glow, 1.5); if (haloOn()) glow(mx, my, H.proj, s0 * 3, s0 * 4.5, c, 0.16, 0.22); if (e.big || e.kind === 'torp' || e.kind === 'rail') light(mx, my, H.proj, c, 0.7, 120, 0.12); if (e.big || e.kind === 'torp') spark(mx, my, 3, 70, c, 0.25, H.proj, 1.4, 0.2); }
    }
      if (e.ang !== undefined && e.r && (e.kind === 'kin' || e.kind === 'rail') && facOf(g, e.owner) === 'mars') marsMuzzle(e);   /* Fassung 30 */
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
    case 'crippled': smoke(e.x, e.y, 10, 5, 2, H.proj); spark(e.x, e.y, 14, 70, '#8fe8ff', 0.6, H.proj); break;
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
    case 'strike': { const r = e.r || 150; light(e.x, e.y, H.proj, '#ffb070', 5, 600, 1.8); explode(e.x, e.y, r * 0.45, true, '#ffb070', H.proj, false); ring(e.x, e.y, r * 1.6, '#ff8a5a', 1.3, r * 0.1, 1, 0.5); smoke(e.x, e.y, r * 0.5, 18, 3.2, H.proj, 14); debris(e.x, e.y, 30, 260, 30, H.proj, 1); spark(e.x, e.y, 40, 320, '#ffd27a', 1.1, H.proj, 1.6, 1.5); later.push({ at: now + 0.35, fn: () => fire(e.x, e.y, r * 0.4, 1.2, 6, H.proj + r * 0.15, 0.9) }); shake(16); break; }
    case 'supercharged': ring(e.x, e.y, 80, '#ffb86b', 1.2, 3); break;
    case 'ready': if (e.rift) { /* Fassung 25: Austritt aus dem Risstor */ flash(e.rx, e.ry, 70, '#d6ff6a', 0.35, H.proj, TILE.glow, 1.4); ring(e.rx, e.ry, 130, '#b4ff3c', 0.7, 3, 1.3, 0.85, 40); spark(e.rx, e.ry, 12, 120, '#d6ff6a', 0.5, H.proj, 1.3, 1.2); }
    { /* Fassung 24: Einsprung frisch gebauter Schiffe */
      const u = g && g.byId ? g.byId.get(e.id) : null; if (!u || !u.def || u.def.role === 'fighter') break;
      const r = u.def.r || 12, a = u.ang, c = facCol(g, e.owner), bx = u.x - Math.cos(a) * Math.max(60, u.def.len * 1.5), by = u.y - Math.sin(a) * Math.max(60, u.def.len * 1.5);
      flash(u.x, u.y, r * 1.6, '#ffffff', 0.25, H.proj, TILE.star, 1.3); ring(u.x, u.y, r * 2.2, c, 0.45, 2);
      line(bx, by, u.x, u.y, r * 0.7, c, 0.4, QMODE.tail, H.proj, H.proj, 1.4, 0.7); break;
    }
    case 'jump': if (e.gate) { gateTransit(e); break; } { const r = e.r || 12; ring(e.x, e.y, r * 2, '#c9a0ff', 0.5, 2.5); flash(e.x, e.y, r * 1.4, '#eadcff', 0.3, H.proj + r * 0.3, TILE.star, 1.2); if (!e.from) spark(e.x, e.y, 8, 90, '#e0c8ff', 0.5, H.proj); break; }
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
    case 'mineboom': ring(e.x, e.y, e.r || 110, '#ffb060', 0.6, 3); break;   /* Fassung 22 */
    case 'morph': ring(e.x, e.y, (e.r || 14) * 2.2, '#d6ff6a', 0.8, 3); spark(e.x, e.y, 14, 100, '#b4ff3c', 0.6, H.proj); break;
    /* rank, deliver, relics, netoff, attack, flareStart: Texte und Pings macht die 2D-Überlagerung */
  }
}

/* ------------------------------------------------------------ Frame */
export function frame(g, dt, time, view, cam) {
  if (!T) return;
  dt = Math.min(dt || 0, 0.1); now = time; lightsStep(dt);
  /* zeitversetzte Wirkungen */
  if (later.length) { let w = 0; for (let i = 0; i < later.length; i++) { const q = later[i]; if (time >= q.at) q.fn(); else later[w++] = q; } later.length = w; }
  for (const k in B) B[k].begin(time);
  flushQueues();
  stepSprites(P.spr, dt, B.spr, B.fire); stepSprites(P.smoke, dt, B.smoke); stepQuads(P.quad, dt, B.quad); stepRings(P.ring, dt, B.ring);
  stepChunks(P.chunk, dt, B.chunk); stepDomes(P.dome, dt, B.dome); stepDiscs(P.disc, dt, B.disc);
  if (g) {
    beams(g, dt, time, view);
    projectiles(g, dt, time, view);
    if (g.strikes) strikes(g, dt, time);
    if (g.flares) flares(g, dt, time);
    if (g.spores) spores(g, dt, time, view);
    if (g.mines && g.mines.length) mines(g, time, view);   /* Fassung 22 */
    heals(g, time, view);
    feeding(g, dt, time, view);   /* Fassung 30 */
    if (g.wave && (g.wave.rifts || g.wave.open)) rifts(g, dt, time);
    VIEW = view; if (g.gates && g.gates.length) gatesLive(g, dt, time);
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
      const wps = s.k === 2 ? (typeof lvOf === 'function' ? lvOf(s).wpn : s.def.lv && s.def.lv[s.lv - 1] ? s.def.lv[s.lv - 1].wpn : null) : s.def.wpn, wp = wps ? wps[i] : null;   /* Fassung 22: Turmzweige */
      const c = col(wpnColOf(g, s, wp)), bw = (wp && wp.w) || 2, a = Math.atan2(t.y - s.y, t.x - s.x);
      const r0 = s.k === 2 ? s.def.r * 0.6 : s.def.r * 0.5, h0 = s.k === 2 ? H.beam + 6 : H.beam, h1 = H.beam + (t.k === 2 ? 4 : 0);
      const sx = s.x + Math.cos(a) * r0, sy = s.y + Math.sin(a) * r0, tx = (bm.wx !== undefined ? bm.wx : t.x) + rnd(-1.5, 1.5), ty = (bm.wy !== undefined ? bm.wy : t.y) + rnd(-1.5, 1.5);   /* Fassung 22: am Schildwall endet der Strahl */
      const pulse = 0.92 + 0.08 * Math.sin(time * 28 + s.id);
      if (bm.extra) for (const eid of bm.extra) { const e2 = g.byId.get(eid); if (!e2 || e2.dead) continue; B.quad.write(sx, h0, sy, e2.x, h1, e2.y, bw * 2.2, QMODE.flat, c[0], c[1], c[2], 0.35); B.quad.write(sx, h0, sy, e2.x, h1, e2.y, bw * 0.5, QMODE.flat, 1.5, 1.5, 1.5, 0.8); B.spr.write(e2.x, h1, e2.y, bw * 6, 0, TILE.glow, c[0], c[1], c[2], 0.6); }
      if (detail > 0 && facOf(g, s.owner) === 'nexus') { nexusBeam(sx, h0, sy, tx, h1, ty, bw, time, s.id * 7 + i, dt); continue; }   /* Fassung 30 */
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 6 * pulse, QMODE.flat, c[0], c[1], c[2], 0.16);
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 2.6 * pulse, QMODE.flat, c[0], c[1], c[2], 0.6);
      B.quad.write(sx, h0, sy, tx, h1, ty, bw * 0.65, QMODE.flat, 1.6, 1.6, 1.6, 0.95);
      B.spr.write(sx, h0, sy, bw * 7, 0, TILE.glow, c[0], c[1], c[2], 0.8);
      B.spr.write(tx, h1, ty, bw * 9 * pulse, time * 3, TILE.glow, c[0], c[1], c[2], 0.75);
      if (haloOn()) { B.quad.write(sx, h0, sy, tx, h1, ty, bw * 14 * pulse, QMODE.flat, c[0], c[1], c[2], 0.05); B.spr.write(tx, h1, ty, bw * 26 * pulse, 0, TILE.glow, c[0], c[1], c[2], 0.22); }
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
      /* Fassung 31: die Bahn glüht als ionisierte Spur nach */
      if (detail > 0) { const b = (q.sp || 1600) * dt + 2; line(q.x - dx * b, q.y - dy * b, q.x, q.y, 3.4, '#7fb8ff', 0.6, QMODE.flat, h, h, 1.2, 0.55); line(q.x - dx * b, q.y - dy * b, q.x, q.y, 1.1, '#ffffff', 0.28, QMODE.flat, h, h, 1.5, 0.9); }
      if (detail > 0) { const sp = q.sp || 1600, n = Math.min(4, Math.ceil(sp * dt / 40)); for (let i = 0; i < n; i++) { const b = (i + Math.random()) / n * sp * dt; glow(q.x - dx * b, q.y - dy * b, h, 7, 2, '#bfe9ff', 0.35, 0.45, 1, TILE.ember, 1.3); } }
    } else if (kind === 'art') {
      /* Belagerungsgranate im Bogen: Höhe nach Flugfortschritt */
      const c = col(q.col || '#ffb070'), k = 1 - q.left / Math.max(1, q.d0), hh = h + Math.sin(k * Math.PI) * Math.min(160, q.d0 * 0.22);
      B.rock.write(q.x, hh, q.y, time * 3, q.ang, time * 2, 2.6, 2.6, 2.6, 1, 0.3, 0.26, 0.22);
      B.spr.write(q.x, hh, q.y, 22, 0, TILE.glow, c[0], c[1], c[2], 0.9);
      if (detail > 0 && Math.random() < 30 * dt) trail(q.x - dx * 4, q.y - dy * 4, hh, q.col || '#ff9a50', 5, 0.5, rnd(-6, 6), rnd(-2, 4), rnd(-6, 6), 0.8, TILE.glow);
    } else if (kind === 'rock') {
      const c = col('#ffb070');
      B.rock.write(q.x, h, q.y, time * 2.1, q.ang, time * 1.3, 4, 4, 4, 1, 0.3, 0.26, 0.22);
      B.spr.write(q.x, h, q.y, 26, 0, TILE.glow, c[0], c[1], c[2], 0.85);
      if (detail > 0 && Math.random() < 30 * dt) { trail(q.x - dx * 5, q.y - dy * 5, h, '#ff9a50', 6, 0.5, rnd(-10, 10), rnd(4, 12), rnd(-10, 10), 1, TILE.glow); spark(q.x, q.y, 1, 40, '#ffd27a', 0.3, h); }
    } else if (kind === 'acid') {
      const c = col(q.col || '#b4ff3c');
      const wob = 1 + 0.25 * Math.sin(time * 22 + q.x * 0.3);   /* Fassung 30: wabernder Klumpen mit Tropfenschweif */
      B.spr.write(q.x, h, q.y, 11 * wob, 0, TILE.glow, c[0], c[1], c[2], 0.75);
      B.spr.write(q.x + dx * 1, h, q.y + dy * 1, 4.4 * wob, q.ang, TILE.dot, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0.95);
      B.spr.write(q.x - dx * 6, h, q.y - dy * 6, 2.6 * (2 - wob), 0, TILE.dot, c[0] * 1.3, c[1] * 1.3, c[2] * 1.3, 0.8);
      B.quad.write(q.x - dx * 13, h, q.y - dy * 13, q.x, h, q.y, 3.2, QMODE.tail, c[0], c[1], c[2], 0.55);
      if (detail > 0 && Math.random() < 24 * dt * K) trail(q.x - dx * 2, q.y - dy * 2, h, q.col || '#b4ff3c', 2.2, 0.4, rnd(-14, 14), rnd(-4, 10), rnd(-14, 14), 1.2);
    } else {
      /* kin, bite, para: kurzer Leuchtstrich in Waffenfarbe mit hellem Kern und Glutpunkt */
      const c = col(q.col || wpnColOf(g, q, null)), bite = kind === 'bite';
      /* Fassung 30 */
      if (bite) {
        if (q.sid) { const s = g.byId.get(q.sid); FEED.set(q.sid, { tid: q.tid, until: now + 1.5, rg: 150 + (s ? s.def.r * 2 : 0), k: s ? Math.max(0.7, Math.min(1.8, s.def.r / 14)) : 1 }); }
        /* zwei Fangzähne, die auf den Biss zulaufen */
        B.quad.write(q.x - dx * 9 - dy * 5, h, q.y - dy * 9 + dx * 5, q.x, h, q.y, 2.6, QMODE.tail, 1.5, 1.6, 1.2, 0.9);
        B.quad.write(q.x - dx * 9 + dy * 5, h, q.y - dy * 9 - dx * 5, q.x, h, q.y, 2.6, QMODE.tail, 1.5, 1.6, 1.2, 0.9);
        B.spr.write(q.x, h, q.y, 10, 0, TILE.glow, c[0], c[1], c[2], 0.6); continue;
      }
      if (q.para) {
        /* Parasit: windet sich im Flug */
        let x0 = q.x, y0 = q.y; for (let i = 1; i <= 4; i++) { const o2 = Math.sin(time * 26 + i * 1.4 + q.x * 0.1) * 3.2, x1 = q.x - dx * i * 5 - dy * o2, y1 = q.y - dy * i * 5 + dx * o2; B.quad.write(x1, h, y1, x0, h, y0, 3 - i * 0.5, QMODE.flat, c[0] * 1.2, c[1] * 1.2, c[2] * 1.2, 0.85); x0 = x1; y0 = y1; }
        B.spr.write(q.x, h, q.y, 11, 0, TILE.glow, c[0], c[1], c[2], 0.7); B.spr.write(q.x, h, q.y, 3.4, 0, TILE.dot, 1.6, 1.3, 1.5, 0.95); continue;
      }
      if (kind === 'kin' && facOf(g, q.owner) === 'mars') {
        /* heiße Leuchtspur, schwere Granaten mit Rauch */
        const big = q.dmg >= 20, hot = col('#ff7a3a'), L = big ? 46 : 26;
        if (big) B.quad.write(q.x - dx * L * 1.2, h, q.y - dy * L * 1.2, q.x, h, q.y, 13, QMODE.tail, hot[0], hot[1], hot[2], 0.18);
        B.quad.write(q.x - dx * L, h, q.y - dy * L, q.x, h, q.y, big ? 6.5 : 3.8, QMODE.tail, hot[0], hot[1], hot[2], 0.8);
        B.quad.write(q.x - dx * L * 0.6, h, q.y - dy * L * 0.6, q.x + dx * 2, h, q.y + dy * 2, big ? 1.8 : 1.2, QMODE.tail, 1.9, 1.7, 1.2, 0.95);
        B.spr.write(q.x, h, q.y, big ? 24 : 11, 0, TILE.glow, hot[0], hot[1], hot[2], 0.75); B.spr.write(q.x + dx, h, q.y + dy, big ? 5.5 : 2.8, 0, TILE.dot, 1.8, 1.6, 1.2, 0.95);
        if (big && detail > 0 && Math.random() < 14 * dt * K) spr(P.smoke, q.x - dx * 8, h, q.y - dy * 8, rnd(-4, 4), rnd(2, 6), rnd(-4, 4), rnd(0.4, 0.7), 1.6, 5, [0.24, 0.22, 0.2], 0.35, TILE.smoke, CM.smoke, 0.5, 1, rnd(-1, 1));
        continue;
      }
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

/* Fassung 22: Minen – kleiner Brocken in Spielerfarbe knapp über dem Boden, geschärft mit blinkendem Warnlicht.
   Sichtbarkeit nach view.mineSeen (eigene immer, feindliche nur entdeckt). */
const MINE_LIGHT = { brood: '#d6ff6a' };
function mines(g, time, view) {
  for (const m of g.mines) {
    if (view && view.vp >= 0 && view.mineSeen && !view.mineSeen(m)) continue;
    const p = g.players[m.owner], c = col((view && view.pcol && view.pcol(m.owner)) || (p && p.color) || '#d8d0bd'), h = H.ground + 2.2 + 0.6 * Math.sin(time * 2 + m.id);
    B.mine.write(m.x, h, m.y, time * 0.6 + m.id, m.id * 0.9, time * 0.4, 2.4, 2.4, 2.4, 0.25, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8);
    if (m.arm <= 0 && Math.sin(time * 4 + m.id) > 0) { const w = col(MINE_LIGHT[p && p.faction] || '#ff5b47'); B.spr.write(m.x, h + 2.6, m.y, 7, 0, TILE.glow, w[0], w[1], w[2], 0.9); B.spr.write(m.x, h + 2.6, m.y, 2.2, 0, TILE.dot, 1.6, 1.6, 1.6, 0.9); }
  }
}
/* Fassung 22: Reparaturstrahl – breite Hülle und dünner Kern in Fraktionsfarbe, ein wandernder Lichtpunkt je Ziel */
const HEAL_COL = { alliance: '#8cffc8', mars: '#ffc870', legion: '#ffe6a0', nexus: '#eadcff', brood: '#d6ff6a' };
function heals(g, time, view) {
  for (const u of g.ships) {
    if (u.dead || !u.heals || !u.heals.length) continue;
    if (view && view.vp >= 0 && !view.visible(u)) continue;
    const p = g.players[u.owner], c = col(HEAL_COL[p && p.faction] || '#8cffc8');
    for (const id of u.heals) {
      const t = g.byId.get(id); if (!t || t.dead) continue;
      const h1 = H.beam + (t.k === 2 ? 4 : 0), k = (time * 1.3 + id * 0.37) % 1;
      B.quad.write(u.x, H.beam, u.y, t.x, h1, t.y, 7, QMODE.flat, c[0], c[1], c[2], 0.14);
      B.quad.write(u.x, H.beam, u.y, t.x, h1, t.y, 1.4, QMODE.flat, c[0], c[1], c[2], 0.7);
      B.spr.write(u.x + (t.x - u.x) * k, H.beam + (h1 - H.beam) * k, u.y + (t.y - u.y) * k, 9, 0, TILE.glow, c[0], c[1], c[2], 0.9);
      B.spr.write(t.x, h1, t.y, (t.k === 2 ? t.def.r * 0.6 : t.def.r) + 8, time, TILE.glow, c[0], c[1], c[2], 0.25 + 0.1 * Math.sin(time * 5 + id));
    }
  }
}

/* Fassung 25: Tor-Durchflug – Eintritt: Schiff wird zur Tormitte gezogen (Lichtstreif), Ereignishorizont schlägt eine
   Welle, Blitz in der Mitte. Austritt am Partnertor: Welle nach außen, Blitz, Funkenkegel in Flugrichtung, Nachglühen.
   Das Tor selbst leuchtet ein paar Sekunden heller (GK). */
const GMC = { bridge: '#8fe3ff', lock: '#ffc46b', lance: '#ff6b5b' };
const GK = new Map(); let VIEW = null;
function gateKick(x, y, v) { const k = x + ',' + y; GK.set(k, Math.min(2, (GK.get(k) || 0) + v)); }
function gateTransit(e) {
  const c = GMC[e.mode] || GMC.bridge, r = e.r || 12, gr = e.gr || 46, h = H.proj;
  gateKick(e.gx, e.gy, 1);
  if (e.from) {
    line(e.x, e.y, e.gx, e.gy, r * 1.2, c, 0.35, QMODE.soft, h, h - 2, 1, 0.9);
    flash(e.gx, e.gy, gr * 1.1, '#ffffff', 0.35, h, TILE.glow, 1.4);
    ring(e.gx, e.gy, gr * 0.15, c, 0.55, gr * 0.06, 1, 0.9, gr * 0.9);
    ring(e.gx, e.gy, gr * 0.9, '#ffffff', 0.4, 2, 1.2, 0.6, gr * 0.2);
    spark(e.gx, e.gy, 14, 60, c, 0.5, h, 0.8, 1.4);
  } else {
    const a = e.ang || 0;
    flash(e.gx, e.gy, gr * 1.3, '#ffffff', 0.4, h, TILE.glow, 1.5);
    ring(e.gx, e.gy, gr * 1.9, c, 0.7, 3, 1.4, 0.9, gr * 0.5);
    ring(e.gx, e.gy, gr * 1.1, '#ffffff', 0.35, 2, 1, 0.7, gr * 0.3);
    line(e.gx, e.gy, e.x, e.y, r * 1.6, c, 0.45, QMODE.soft, h, h, 1, 0.9);
    { const cc = col(c); for (let i = 0; i < Math.round(14 * K); i++) { const aa = a + rnd(-0.45, 0.45), v = rnd(90, 230); spr(P.spr, e.gx, h, e.gy, Math.cos(aa) * v, rnd(-8, 8), Math.sin(aa) * v, rnd(0.35, 0.7), rnd(5, 8), 1.5, cc, 0.9, TILE.glow, 0, 2.2, 1.3); } }
    light(e.gx, e.gy, h, c, 1.6, gr * 4, 0.5);
  }
}
/* Fassung 25: aktive Sprungtore – Ereignishorizont schimmert, Lauflicht über die acht Emitter, Funken werden in die
   Mitte gesogen, ab und zu ein Lichtbogen. Nach einem Durchflug kurz heller. */
function gatesLive(g, dt, time) {
  for (const gt of g.gates) {
    if (gt.state !== 'active' && gt.state !== 'flicker') continue;
    if (VIEW && VIEW.seen && !VIEW.seen(gt.x, gt.y)) continue;
    const key = gt.x + ',' + gt.y, kick = GK.get(key) || 0; if (kick) GK.set(key, Math.max(0, kick - dt * 0.8));
    const on = gt.state === 'active' ? 1 : 0.45, c = col(GMC[gt.mode] || GMC.bridge), k = on * (1 + kick);
    B.disc.write(gt.x, H.disc + 1.6, gt.y, 41, 41, time * 0.4, DMODE.horizon, k, gt.x * 0.01, c[0], c[1], c[2], 1);
    /* Lauflicht: ein heller Punkt wandert über die Emitter */
    const ph = (time * (gt.mode === 'lance' ? 1.4 : 0.9)) % 1, idx = Math.floor(ph * 8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, d = ((i - idx + 8) % 8), aa = d === 0 ? 1 : d === 7 ? 0.45 : d === 6 ? 0.2 : 0.06; if (aa < 0.07 && on < 1) continue;
      B.spr.write(gt.x + Math.cos(a) * 50, 7.5, gt.y - Math.sin(a) * 50, 24 + 18 * aa, 0, TILE.glow, c[0], c[1], c[2], Math.min(1, aa * on * 1.2)); }
    /* eingesogene Funken (aus der Zeit abgeleitet, ohne Teilchenpool) */
    if (detail > 0) for (let i = 0; i < 10; i++) { const f = (time * 0.45 + i / 10) % 1, a = i * 2.39 + gt.x * 0.01 + f * 2.2, rr = 46 * (1 - f);
      B.spr.write(gt.x + Math.cos(a) * rr, 3 + f * 2, gt.y + Math.sin(a) * rr, 7 + 6 * f, 0, TILE.glow, c[0], c[1], c[2], 0.8 * on * Math.sin(f * Math.PI)); }
    if (gt.state === 'active' && detail > 1 && Math.random() < dt * 0.9 * K) { const a = Math.random() * TAU, b = a + rnd(0.6, 1.4); line(gt.x + Math.cos(a) * 46, gt.y + Math.sin(a) * 46, gt.x + Math.cos(b) * 46, gt.y + Math.sin(b) * 46, 1.5, '#ffffff', 0.18, QMODE.soft, 6, 6, 1, 0.9); }
  }
}
/* Fassung 25: Risstore (Wellenmodi) – Ring aus Chitin-Dornen mit dunkler Öffnung und Wirbel. Alle Tore sind von Anfang an
   da (schlafend), vor der Welle erwachen die, aus denen sie kommt, während der Welle dreht der grüne Wirbel. */
const RG = new Map();
let rgGeo = null;
function riftGate(x, y) {
  const key = x + ',' + y; let o = RG.get(key); if (o) return o;
  if (!rgGeo) {
    const spike = new T.ConeGeometry(10, 46, 5); spike.translate(0, 23, 0);
    rgGeo = { spike, torus: new T.TorusGeometry(66, 10, 8, 42).rotateX(Math.PI / 2), mat: new T.MeshStandardMaterial({ color: '#3a2048', roughness: 0.55, metalness: 0.15, emissive: '#12051c' }) };
  }
  const g = new T.Group(); g.position.set(x, 0, y);
  const ring = new T.Mesh(rgGeo.torus, rgGeo.mat); g.add(ring);
  const n = 14, sp = new T.InstancedMesh(rgGeo.spike, rgGeo.mat, n), M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), S = new T.Vector3();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + x * 0.01; P.set(Math.cos(a) * 70, 0, Math.sin(a) * 70); E.set(0, -a, -Math.PI / 2 + 0.25); Q.setFromEuler(E); const k = 0.8 + 0.4 * Math.abs(Math.sin(i * 2.3)); S.set(k, k, k); M.compose(P, Q, S); sp.setMatrixAt(i, M); }
  g.add(sp); root.add(g);
  o = { g, ph: x * 0.013 + y * 0.007 }; RG.set(key, o); return o;
}
export function clearRiftGates() { for (const o of RG.values()) root.remove(o.g); RG.clear(); }
function rifts(g, dt, time) {
  const W = g.wave, list = W.rifts || W.open || [], has = (l, r) => l && l.some(o => o.x === r.x && o.y === r.y);
  for (const r0 of list) {
    const st = W.phase === 'wave' && has(W.active, r0) ? 3 : W.phase === 'build' && has(W.soon, r0) ? 2 : has(W.open, r0) ? 1 : 0;
    const o = riftGate(r0.x, r0.y), k = [0.35, 0.6, 1.0, 1.5][st], pul = st >= 2 ? 0.75 + 0.25 * Math.sin(time * (st === 3 ? 6 : 3) + o.ph) : 1;
    o.g.rotation.y = time * 0.05;
    /* Öffnung: Wirbel (dunkler Grund + Spirale), Hof */
    B.disc.write(r0.x, H.disc + 0.04, r0.y, 58, 58, 0, DMODE.glow, 0.95, 0, 0.02, 0.005, 0.04, 1);
    if (st >= 1) B.disc.write(r0.x, H.disc + 0.08, r0.y, 56, 56, time * (0.3 + 0.5 * k), DMODE.portal, k * pul, o.ph, 1, 1, 1, 1);
    B.disc.write(r0.x, H.disc, r0.y, 165, 165, 0, DMODE.glow, 0.18 * k * pul, 0, st >= 2 ? 0.55 : 0.45, st >= 2 ? 1 : 0.2, st >= 2 ? 0.3 : 0.75, 1);
    /* Leuchtknoten auf dem Ring */
    const on = st >= 2 ? 0.6 + 0.4 * Math.sin(time * 5) : st === 1 ? 0.35 : 0.15;
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + o.ph * 2 - time * 0.05; B.spr.write(r0.x + Math.cos(a) * 66, 9, r0.y + Math.sin(a) * 66, 16, 0, TILE.glow, 0.7, 1, 0.35, on); }
    /* Herzschlag: erwacht langsam, offen schnell; offen dazu grüne Lichtbögen über die Öffnung */
    if (st >= 2) { const per = st === 3 ? 0.9 : 1.6, n = Math.floor((time + o.ph) / per); if (o.beat !== n) { o.beat = n; ring(r0.x, r0.y, st === 3 ? 150 : 110, '#b4ff3c', st === 3 ? 0.9 : 1.1, 3, 1.2, st === 3 ? 0.8 : 0.5, 55); } }
    if (st === 3 && detail > 1 && Math.random() < dt * 3 * K) { const a = Math.random() * TAU, b = a + rnd(1.5, 3); line(r0.x + Math.cos(a) * 56, r0.y + Math.sin(a) * 56, r0.x + Math.cos(b) * 50, r0.y + Math.sin(b) * 50, 2, '#e4ff9a', 0.16, QMODE.soft, 7, 7, 1, 0.9); }
    if (st === 3 && detail > 1 && Math.random() < 24 * dt * K) { const a = Math.random() * TAU; spark(r0.x + Math.cos(a) * 60, r0.y + Math.sin(a) * 60, 1, 40, '#d6ff6a', 0.5, H.ground, 1.2, 2); }
  }
}
