/* ===== core.js ===== */
'use strict';
/* =====================================================================
   RIFT ARMADA – GRUNDLAGEN
   Feste Schrittweite der Simulation, Zufall mit offenem Zustand und Rechenfunktionen, die auf jedem Gerät dasselbe
   Ergebnis liefern (übernommen aus RTS – Rapid Tactical Strike). Grundrechenarten und Math.sqrt rechnen nach IEEE 754
   überall gleich; Math.sin, cos, atan2, pow und exp nicht. Die Simulation benutzt darum nur dsin, dcos, datan2 und dexp.
   Die Darstellung darf Math.* benutzen.
   ===================================================================== */
const STEP = 1 / 30;                 // 30 Runden je Sekunde
const TAU = Math.PI * 2;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/* Zufallsgenerator mit offenem Zustand (st.a), damit ein Spielstand ihn mitspeichern kann (mulberry32) */
function makeRng(seed) {
  const st = { a: seed >>> 0 };
  const f = function () {
    st.a = (st.a + 0x6D2B79F5) | 0;
    let t = Math.imul(st.a ^ (st.a >>> 15), 1 | st.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.st = st;
  return f;
}
/* Streuwert eines Textes oder einer Zahl (FNV-1a), für Startwerte aus Kartennamen */
function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
const DM_S = [-1.66666666666666324348e-01, 8.33333333332248946124e-03, -1.98412698298579493134e-04, 2.75573137070700676789e-06, -2.50507602534068634195e-08, 1.58969099521155010221e-10];
const DM_C = [4.16666666666666019037e-02, -1.38888888888741095749e-03, 2.48015872894767294178e-05, -2.75573143513906633035e-07, 2.08757232129817482790e-09, -1.13596475577881948265e-11];
function dtrig(x, c) {
  const k = Math.round(x * 0.63661977236758134308), r = (x - k * 1.57079632673412561417e+00) - k * 6.07710050650619224932e-11, z = r * r;
  const q = (k + c) & 3;
  if (q === 0 || q === 2) { const s = r + r * z * (DM_S[0] + z * (DM_S[1] + z * (DM_S[2] + z * (DM_S[3] + z * (DM_S[4] + z * DM_S[5]))))); return q === 0 ? s : -s; }
  const co = 1 - 0.5 * z + z * z * (DM_C[0] + z * (DM_C[1] + z * (DM_C[2] + z * (DM_C[3] + z * (DM_C[4] + z * DM_C[5])))));
  return q === 1 ? co : -co;
}
function dsin(x) { return dtrig(x, 0); }
function dcos(x) { return dtrig(x, 1); }
const DM_AH = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const DM_AL = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const DM_AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02, -7.69187620504482999495e-02,
  6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
function datan(x) {
  const neg = x < 0;
  if (neg) x = -x;
  let id = -1, xx = x;
  if (x >= 0.4375) {
    if (x < 1.1875) { if (x < 0.6875) { id = 0; xx = (2 * x - 1) / (2 + x); } else { id = 1; xx = (x - 1) / (x + 1); } }
    else if (x < 2.4375) { id = 2; xx = (x - 1.5) / (1 + 1.5 * x); }
    else { id = 3; xx = -1 / x; }
  }
  const z = xx * xx, w = z * z, A = DM_AT;
  const s1 = z * (A[0] + w * (A[2] + w * (A[4] + w * (A[6] + w * (A[8] + w * A[10])))));
  const s2 = w * (A[1] + w * (A[3] + w * (A[5] + w * (A[7] + w * A[9]))));
  const r = id < 0 ? xx - xx * (s1 + s2) : DM_AH[id] - ((xx * (s1 + s2) - DM_AL[id]) - xx);
  return neg ? -r : r;
}
/* wie Math.atan2, für (0, 0) 0; liegt der Punkt genau auf der negativen x-Achse, gilt +π */
function datan2(y, x) {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + Math.PI : datan(y / x) - Math.PI;
  return y > 0 ? Math.PI / 2 : y < 0 ? -Math.PI / 2 : 0;
}
function dexp(x) {
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x * 1.44269504088896338700e+00), hi = x - k * 6.93147180369123816490e-01, lo = k * 1.90821492927058770002e-10, r = hi - lo, t = r * r;
  const c = r - t * (1.66666666666666019037e-01 + t * (-2.77777777770155933842e-03 + t * (6.61375632143793436117e-05 + t * (-1.65339022054652515390e-06 + t * 4.13813679705723846039e-08))));
  let y = 1 - ((lo - (r * c) / (2 - c)) - hi), n = k;
  while (n > 0) { y *= 2; n--; }
  while (n < 0) { y *= 0.5; n++; }
  return y;
}
/* Winkelunterschied im Bereich (-π, π]: Eine Kehrtwende zählt immer als +π, damit sie in jeder Lage in dieselbe Richtung dreht */
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d <= -Math.PI) d += TAU; return d; }
function turnTo(cur, want, max) { const d = angDiff(want, cur); if (Math.abs(d) <= max) return want; return cur + (d > 0 ? max : -max); }
function angNorm(a) { while (a > Math.PI) a -= TAU; while (a <= -Math.PI) a += TAU; return a; }

/* Prüfsumme des Spielzustands (Mehrspieler, Gleichschritt-Test): Gemischt werden die Bits der Zahlen, nicht gerundete Werte */
const _hF = new Float64Array(1), _hI = new Int32Array(_hF.buffer);
function hmix(h, v) {
  _hF[0] = v === v ? v : -1.5e300;
  h = Math.imul(h ^ _hI[0], 16777619);
  return Math.imul(h ^ _hI[1], 16777619);
}

/* Binärer Haufen für die Wegsuche (kleinster Wert zuerst) */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
