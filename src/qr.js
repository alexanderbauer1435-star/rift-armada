/* ===== qr.js ===== */
'use strict';
/* =====================================================================
   QR-CODE – Erzeugung nach ISO/IEC 18004 (Byte-Modus, Versionen 1–40, Fehlerkorrektur L/M/Q/H).
   Für die Verbindungscodes im Mehrspieler: Das andere Gerät liest den Code mit seiner Kamera (oder der
   Kamera-App) und bekommt den Text. qrMake(text, 'M') liefert { size, mod: Uint8Array(size*size) } mit 1 = dunkel.
   ===================================================================== */
const QR_ECC = { L: [1, 0], M: [0, 1], Q: [3, 2], H: [2, 3] };          // [Formatbits, Tabellenzeile]
const QR_EC_CW = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const QR_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
function qrRawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
  return r;
}
function qrDataCw(v, row) { return Math.floor(qrRawModules(v) / 8) - QR_EC_CW[row][v] * QR_BLOCKS[row][v]; }
function qrAlign(v) {
  if (v === 1) return [];
  const na = Math.floor(v / 7) + 2, size = v * 4 + 17, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2, out = [6];
  for (let pos = size - 7; out.length < na; pos -= step) out.splice(1, 0, pos);
  return out;
}
/* Reed-Solomon über GF(256) mit dem Polynom 0x11D */
function qrMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
function qrDivisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = qrMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = qrMul(root, 2);
  }
  return r;
}
function qrRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < div.length; i++) r[i] ^= qrMul(div[i], f); }
  return r;
}
function qrUtf8(s) { if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s)); const out = []; for (const ch of unescape(encodeURIComponent(s))) out.push(ch.charCodeAt(0)); return out; }
function qrMake(text, ecl) {
  const [fbits, row] = QR_ECC[ecl || 'M'], bytes = qrUtf8(text);
  /* kleinste Version, in die die Daten passen */
  let v = 1, need = 0;
  for (; v <= 40; v++) { need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8; if (need <= qrDataCw(v, row) * 8) break; }
  if (v > 40) return null;
  const cap = qrDataCw(v, row) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
  /* Blöcke mit Fehlerkorrektur, verschränkt */
  const nb = QR_BLOCKS[row][v], ecl2 = QR_EC_CW[row][v], raw = Math.floor(qrRawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
  const div = qrDivisor(ecl2), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecl2 + (i < nShort ? 0 : 1)); k += dat.length;
    const ec = qrRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ec));
  }
  const cw = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl2 || j >= nShort) cw.push(b[i]); });
  /* Matrix: Funktionsmuster, dann Daten im Zickzack */
  const size = v * 4 + 17, mod = new Uint8Array(size * size), fn = new Uint8Array(size * size);
  const set = (x, y, d) => { mod[y * size + x] = d ? 1 : 0; fn[y * size + x] = 1; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = qrAlign(v), na = al.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = mask => {
    const d = (fbits << 3) | mask;
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); }
  }
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y * size + x] && i < cw.length * 8) { mod[y * size + x] = (cw[i >>> 3] >>> (7 - (i & 7))) & 1; i++; }
    }
  }
  /* Maske mit der kleinsten Strafpunktzahl */
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y * size + x] && MASKS[m](x, y)) mod[y * size + x] ^= 1; };
  const penalty = () => {
    let p = 0, dark = 0;
    const line = get => {
      let run = 1, prev = get(0), hist = [];
      for (let k = 1; k <= size; k++) {
        const c = k < size ? get(k) : -1;
        if (c === prev) run++;
        else { if (run >= 5) p += run - 2; hist.push(run); run = 1; prev = c; }
      }
      /* Muster 1:1:3:1:1 wie ein Suchmuster */
      for (let k = 2; k + 2 < hist.length; k++) { const n = hist[k] / 3; if (n >= 1 && hist[k - 2] === n && hist[k - 1] === n && hist[k + 1] === n && hist[k + 2] === n) p += 40; }
    };
    for (let y = 0; y < size; y++) line(x => mod[y * size + x]);
    for (let x = 0; x < size; x++) line(y => mod[y * size + x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y * size + x]; if (c === mod[y * size + x + 1] && c === mod[(y + 1) * size + x] && c === mod[(y + 1) * size + x + 1]) p += 3; }
    for (let k = 0; k < mod.length; k++) dark += mod[k];
    const tot = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1) * 10;
    return p;
  };
  let best = 0, bp = Infinity;
  for (let m = 0; m < 8; m++) { apply(m); format(m); const pn = penalty(); if (pn < bp) { bp = pn; best = m; } apply(m); }
  apply(best); format(best);
  return { size, mod, version: v };
}
/* auf ein Canvas zeichnen: dunkle Module auf hellem Grund, mit Ruhezone von vier Modulen */
function qrDraw(cv, q, px) {
  const n = q.size + 8, k = Math.max(1, Math.floor(px / n)), x = cv.getContext('2d');
  cv.width = cv.height = n * k;
  x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#000';
  for (let y = 0; y < q.size; y++) for (let xx = 0; xx < q.size; xx++) if (q.mod[y * q.size + xx]) x.fillRect((xx + 4) * k, (y + 4) * k, k, k);
}

