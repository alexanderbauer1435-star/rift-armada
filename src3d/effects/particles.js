/* =====================================================================
   Rift Armada – 3D-Effekte: Partikelvorräte. Ein Vorrat je Darstellungsart (Sprites additiv, Rauch, Quads/Funken, Ringe,
   Trümmer, Kuppeln, Scheiben) als flache Float32Array-Sätze mit festem Feldaufbau – keine Objekte je Partikel, keine
   Speicherbereinigung. Ist ein Vorrat voll, verdrängt ein neues Partikel das älteste (zyklischer Zeiger). `lim` ist die
   Grenze der Detailstufe, `cap` die Größe des Speichers (höchste Stufe). step() rechnet alle Partikel einen Schritt
   weiter und schreibt sie in die GPU-Puffer (buffers.js).
   ===================================================================== */
import { TILE } from './buffers.js';

export class Pool {
  constructor(cap, F) { this.cap = cap; this.F = F; this.d = new Float32Array(cap * F); this.on = new Uint8Array(cap); this.free = []; for (let i = cap - 1; i >= 0; i--) this.free.push(i); this.lim = cap; this.cur = 0; this.count = 0; }
  /* Index eines freien (oder verdrängten) Platzes, −1 wenn die Stufe nichts erlaubt */
  alloc() {
    if (this.lim <= 0) return -1;
    if (this.count < this.lim && this.free.length) { const i = this.free.pop(); this.on[i] = 1; this.count++; return i; }
    for (let k = 0; k < this.cap; k++) { const i = (this.cur + k) % this.lim; if (this.on[i]) { this.cur = (i + 1) % this.lim; return i; } }
    return -1;
  }
  release(i) { if (this.on[i]) { this.on[i] = 0; this.count--; this.free.push(i); } }
  clear() { this.on.fill(0); this.free.length = 0; for (let i = this.cap - 1; i >= 0; i--) this.free.push(i); this.count = 0; this.cur = 0; }
}

/* Feldaufbau je Vorrat (Offsets) */
export const SP = { x: 0, h: 1, z: 2, vx: 3, vh: 4, vz: 5, t: 6, life: 7, s0: 8, s1: 9, rot: 10, rotv: 11, r: 12, g: 13, b: 14, a0: 15, tile: 16, drag: 17, cmode: 18, fade: 19, F: 20 };
export const QP = { ax: 0, ah: 1, az: 2, bx: 3, bh: 4, bz: 5, vx: 6, vh: 7, vz: 8, t: 9, life: 10, w: 11, r: 12, g: 13, b: 14, a0: 15, mode: 16, kind: 17, drag: 18, tail: 19, F: 20 };
export const RP = { x: 0, h: 1, z: 2, r0: 3, r1: 4, t: 5, life: 6, w: 7, r: 8, g: 9, b: 10, a0: 11, F: 12 };
export const CP = { x: 0, h: 1, z: 2, vx: 3, vh: 4, vz: 5, rx: 6, ry: 7, rz: 8, wx: 9, wy: 10, wz: 11, t: 12, life: 13, s: 14, glow: 15, shade: 16, F: 17 };
export const DP = { x: 0, h: 1, z: 2, r: 3, hx: 4, hz: 5, t: 6, life: 7, cr: 8, cg: 9, cb: 10, F: 11 };
export const KP = { x: 0, h: 1, z: 2, rx: 3, rz: 4, rot: 5, mode: 6, t: 7, life: 8, r: 9, g: 10, b: 11, ph: 12, env: 13, F: 14 };
/* Farbmodi der Sprites */
export const CM = { fixed: 0, fire: 1, flash: 2, smoke: 3, ember: 4 };

/* Feuerfarbe nach Alter k (0 → 1): weiß → gelb → orange → dunkelrot (linear, additiv gezeichnet) */
/* Stützstellen: weiß-gelber Kern → sattes Orange → Orangerot → tiefes Rot → Dunkelbraun. Werte bewusst ≤ 1,4, damit
   ACES die Farbe nicht zu Pastell auswäscht; das Feuer liegt im vormultiplizierten Puffer und deckt beim Abkühlen. */
const FIRE = [[0, 1.4, 1.2, 0.75], [0.07, 1.25, 0.62, 0.14], [0.22, 1.05, 0.3, 0.04], [0.42, 0.6, 0.1, 0.015], [0.65, 0.22, 0.045, 0.012], [1, 0.07, 0.03, 0.02]];
function fireCol(k, out) {
  let i = 1; while (i < FIRE.length - 1 && k > FIRE[i][0]) i++;
  const A = FIRE[i - 1], B_ = FIRE[i], u = Math.max(0, Math.min(1, (k - A[0]) / (B_[0] - A[0])));
  out[0] = A[1] + (B_[1] - A[1]) * u; out[1] = A[2] + (B_[2] - A[2]) * u; out[2] = A[3] + (B_[3] - A[3]) * u;
}
const TMP = [0, 0, 0];

/* Sprites (additiv und Rauch teilen den Aufbau) */
export function stepSprites(P, dt, buf, fireBuf) {
  const d = P.d, F = SP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + SP.t] + dt, life = d[o + SP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + SP.t] = t;
    const k = t / life, drag = d[o + SP.drag];
    if (drag) { const f = Math.exp(-drag * dt); d[o + SP.vx] *= f; d[o + SP.vh] *= f; d[o + SP.vz] *= f; }
    const x = d[o + SP.x] += d[o + SP.vx] * dt, h = d[o + SP.h] += d[o + SP.vh] * dt, z = d[o + SP.z] += d[o + SP.vz] * dt;
    const rot = d[o + SP.rot] += d[o + SP.rotv] * dt;
    const s0 = d[o + SP.s0], s1 = d[o + SP.s1], cm = d[o + SP.cmode], a0 = d[o + SP.a0];
    let s, a, r = d[o + SP.r], g = d[o + SP.g], b = d[o + SP.b];
    if (cm === CM.fire) {
      /* Feuer: wächst schnell, kühlt ab und wird dabei deckend (dunkle Lappen geben dem Ball Form) */
      const e = 1 - (1 - k) * (1 - k), kc = Math.min(1, k + d[o + SP.fade]); s = s0 + (s1 - s0) * Math.sqrt(e); a = a0 * Math.pow(1 - k, 0.9); fireCol(kc, TMP);
      const occ = Math.min(0.85, Math.max(0, (kc - 0.12) * 1.5));
      (fireBuf || buf).write(x, h, z, s, rot, d[o + SP.tile], TMP[0], TMP[1], TMP[2], a, occ);
      continue;
    }
    else if (cm === CM.flash) { s = s0 + (s1 - s0) * k; a = a0 * (1 - k) * (1 - k); }
    else if (cm === CM.smoke) { s = s0 + (s1 - s0) * Math.sqrt(k); a = a0 * Math.min(1, k * 5) * Math.pow(1 - k, 1.4); const dk = 1 - 0.35 * k; r *= dk; g *= dk; b *= dk; }
    else if (cm === CM.ember) { s = s0 + (s1 - s0) * k; a = a0 * Math.pow(1 - k, d[o + SP.fade] || 1); const dk = 1 - 0.5 * k; g *= dk; b *= dk * dk; }
    else { s = s0 + (s1 - s0) * k; a = a0 * Math.pow(1 - k, d[o + SP.fade] || 1); }
    buf.write(x, h, z, s, rot, d[o + SP.tile], r, g, b, a);
  }
}

/* Quads: Linien mit festen Enden (kind 0) oder bewegte Funken (kind 1: B = Ort, A = Ort − v·tail) */
export function stepQuads(P, dt, buf) {
  const d = P.d, F = QP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + QP.t] + dt, life = d[o + QP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + QP.t] = t;
    const k = t / life, kind = d[o + QP.kind];
    let ax = d[o + QP.ax], ah = d[o + QP.ah], az = d[o + QP.az], bx = d[o + QP.bx], bh = d[o + QP.bh], bz = d[o + QP.bz];
    if (kind === 1) {
      const drag = d[o + QP.drag]; if (drag) { const f = Math.exp(-drag * dt); d[o + QP.vx] *= f; d[o + QP.vh] *= f; d[o + QP.vz] *= f; }
      const vx = d[o + QP.vx], vh = d[o + QP.vh], vz = d[o + QP.vz], tail = d[o + QP.tail];
      bx = d[o + QP.bx] += vx * dt; bh = d[o + QP.bh] += vh * dt; bz = d[o + QP.bz] += vz * dt;
      ax = bx - vx * tail; ah = bh - vh * tail; az = bz - vz * tail;
    }
    const a = d[o + QP.a0] * (kind === 1 ? Math.min(1, (1 - k) * 1.6) : Math.pow(1 - k, 1.5)), w = d[o + QP.w] * (kind === 1 ? 1 - 0.3 * k : 1 - 0.4 * k);
    buf.write(ax, ah, az, bx, bh, bz, w, d[o + QP.mode], d[o + QP.r], d[o + QP.g], d[o + QP.b], a);
  }
}

/* Ringe: wachsen von r0 auf r1 (weich auslaufend), verblassen, werden dünner */
export function stepRings(P, dt, buf) {
  const d = P.d, F = RP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + RP.t] + dt, life = d[o + RP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + RP.t] = t;
    const k = t / life, e = 1 - (1 - k) * (1 - k) * (1 - k);
    const r = d[o + RP.r0] + (d[o + RP.r1] - d[o + RP.r0]) * e, w = d[o + RP.w] * (1 - 0.4 * k), a = d[o + RP.a0] * Math.pow(1 - k, 1.6);
    buf.write(d[o + RP.x], d[o + RP.h], d[o + RP.z], r, Math.max(w, r * 0.07), d[o + RP.r], d[o + RP.g], d[o + RP.b], a);
  }
}

/* Trümmer: treiben mit Drehung, glühen anfangs, Grauton je Stück */
export function stepChunks(P, dt, buf) {
  const d = P.d, F = CP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + CP.t] + dt, life = d[o + CP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + CP.t] = t;
    const f = Math.exp(-0.35 * dt); d[o + CP.vx] *= f; d[o + CP.vh] *= f; d[o + CP.vz] *= f;
    const x = d[o + CP.x] += d[o + CP.vx] * dt, h = d[o + CP.h] += d[o + CP.vh] * dt, z = d[o + CP.z] += d[o + CP.vz] * dt;
    const rx = d[o + CP.rx] += d[o + CP.wx] * dt, ry = d[o + CP.ry] += d[o + CP.wy] * dt, rz = d[o + CP.rz] += d[o + CP.wz] * dt;
    const k = t / life, s = d[o + CP.s] * (k > 0.8 ? (1 - k) / 0.2 : 1), glow = d[o + CP.glow] * Math.max(0, 1 - t / 0.9), sh = d[o + CP.shade];
    buf.write(x, h, z, rx, ry, rz, s, s, s, glow, sh, sh * 0.95, sh * 0.9);
  }
}

/* Schildkuppeln: kurz aufblitzen (schnell an, langsam aus) */
export function stepDomes(P, dt, buf) {
  const d = P.d, F = DP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + DP.t] + dt, life = d[o + DP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + DP.t] = t;
    const k = t / life, a = Math.min(1, k * 8) * Math.pow(1 - k, 1.6);
    buf.write(d[o + DP.x], d[o + DP.h], d[o + DP.z], d[o + DP.r], d[o + DP.hx], 0.2, d[o + DP.hz], d[o + DP.cr], d[o + DP.cg], d[o + DP.cb], a);
  }
}

/* Scheiben (ereignisgetrieben: Wirbel, Brutsturm, Bodenleuchten) */
export function stepDiscs(P, dt, buf) {
  const d = P.d, F = KP.F, on = P.on;
  for (let i = 0; i < P.cap; i++) {
    if (!on[i]) continue;
    const o = i * F, t = d[o + KP.t] + dt, life = d[o + KP.life];
    if (t >= life) { P.release(i); continue; }
    d[o + KP.t] = t;
    const k = t / life, env = d[o + KP.env] ? Math.min(1, (1 - k) * 4) : Math.sin(k * Math.PI);
    buf.write(d[o + KP.x], d[o + KP.h], d[o + KP.z], d[o + KP.rx], d[o + KP.rz], d[o + KP.rot], d[o + KP.mode], env, d[o + KP.ph], d[o + KP.r], d[o + KP.g], d[o + KP.b], 1);
  }
}
export { TILE };
