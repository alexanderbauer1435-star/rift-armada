/* ===== music.js ===== */
'use strict';
/* =====================================================================
   MUSIK – im Code komponiert und mit vorab berechneten Instrumentenklängen gespielt (WebAudio, keine Dateien)

   Instrumente: Jeder Klang wird einmal als kurzes Tonbeispiel (AudioBuffer) berechnet – Streicher, Blech, Horn, Chor,
   Harmonium, Bass, Tuba, gezupfte Saiten (Karplus-Strong), Santur, Ney, Glocken, Klavier, Pauken und Trommeln – und beim
   Spielen nur noch über die Abspielgeschwindigkeit in die richtige Tonhöhe gebracht. Das kostet je Ton zwei, drei
   Knoten statt einer Kette aus Oszillatoren und Filtern. Alle Klänge entstehen aus festem Zufall, also jedes Mal gleich.

   Stücke: je Fraktion ein Thema mit Leitmotiv in mehreren Teilen (A, B, Überleitung C), dazu das Menüthema und kurze
   Stücke für Sieg und Niederlage. Jede Stimme hat je Stufe eine Lautstärke: Ruhe (0) – Flächen, Bass, das Motiv leise;
   Spannung (1) – dazu Begleitfiguren, Pauken, das Motiv voll; Gefecht (2) – volles Schlagwerk, Blech, Becken.
   MUS.want (0 … 1, aus musMood) wählt die Stufe; hinauf geht es zum nächsten Takt, hinab erst nach drei ruhigen Takten.
   Runde 18: MUS.heat (0 … 1, aus der Kampfdichte in sfx.js) lässt Schlagwerk und Bass innerhalb der Stufe stufenlos
   anschwellen (eigener Pegel S.perc) und hebt das Ganze leicht an; beim Sprung ins Gefecht schlägt das Becken sofort.
   MUS.duck senkt die Musik während einer Sprachmeldung ab.

   Für Prüfungen und Hörproben rechnet MUS.render dasselbe Stück in einem OfflineAudioContext.
   ===================================================================== */
const MUS = { out: null, dry: null, rev: null, on: false, vol: 0.45, want: 0, heat: 0, duck: 1, name: '', S: null, bank: new Map(), need: null, ready: false, sting: null };

/* ------------------------------------------------------------------ Klangerzeugung (rein rechnerisch) */
const MUS_RND = { s: 1 };
function musRnd() { MUS_RND.s = (MUS_RND.s * 1103515245 + 12345) >>> 0; return MUS_RND.s / 4294967296; }
const musHz = m => 440 * Math.pow(2, (m - 69) / 12);
const musCents = c => Math.pow(2, c / 1200);
const MUS_WT = new Map();
/* eine Schwingung mit n Obertönen der Stärke amp(k) als Tabelle (2048 Werte, bandbegrenzt) */
function musTable(key, n, amp) {
  const k0 = key + '|' + n;
  let t = MUS_WT.get(k0);
  if (t) return t;
  const N = 2048;
  t = new Float32Array(N + 1);
  for (let k = 1; k <= n; k++) {
    const a = amp(k);
    if (!a) continue;
    const w = 2 * Math.PI * k / N;
    for (let i = 0; i < N; i++) t[i] += a * Math.sin(w * i);
  }
  let mx = 0;
  for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(t[i]));
  for (let i = 0; i < N; i++) t[i] /= mx || 1;
  t[N] = t[0];
  MUS_WT.set(k0, t);
  return t;
}
/* Schwingung aus einer Tabelle in out addieren; vib: [Rate Hz, Tiefe Cent, Einsatz s] */
function musOsc(out, sr, tb, f, amp, ph, vib, from, to) {
  const N = 2048, a = from || 0, b = to || out.length;
  let p = ph || 0;
  const inc = f / sr;
  for (let i = a; i < b; i++) {
    let d = inc;
    if (vib) { const t = i / sr; if (t > vib[2]) d = inc * (1 + vib[1] * 0.000578 * Math.min(1, (t - vib[2]) / 0.35) * Math.sin(6.2832 * vib[0] * t)); }
    const q = p * N, i0 = q | 0, fr = q - i0;
    out[i] += amp * (tb[i0] + (tb[i0 + 1] - tb[i0]) * fr);
    p += d;
    if (p >= 1) p -= 1;
  }
}
/* Biquad-Filter (RBJ) auf x, an Ort und Stelle: 'lp', 'hp', 'bp' (Spitze 0 dB) */
function musFilter(x, sr, type, f0, Q) {
  const w = 2 * Math.PI * Math.min(f0, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
function musNoise(n) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = musRnd() * 2 - 1; return o; }
/* Hüllkurve an Ort und Stelle: Anstieg a (s), dann exponentiell zur Haltestufe s mit Zeitkonstante d; tail: Ausklang
   über die letzten 0,05 s, damit kein Beispiel hart abbricht */
function musEnv(x, sr, a, s, d) {
  const n = x.length, na = Math.max(1, a * sr), tail = Math.min(n, Math.round(0.05 * sr));
  for (let i = 0; i < n; i++) {
    let e = i < na ? Math.sin(i / na * Math.PI / 2) : s + (1 - s) * Math.exp(-(i - na) / sr / d);
    if (i > n - tail) e *= (n - i) / tail;
    x[i] *= e;
  }
  return x;
}
/* Abklingen (Schlagwerk, Saiten): e^(−t/τ), sehr kurzer Anstieg */
function musDecay(x, sr, tau, att) {
  const na = Math.max(1, (att || 0.002) * sr), tail = Math.min(x.length, Math.round(0.03 * sr));
  for (let i = 0; i < x.length; i++) { let e = Math.min(1, i / na) * Math.exp(-i / sr / tau); if (i > x.length - tail) e *= (x.length - i) / tail; x[i] *= e; }
  return x;
}
function musNorm(x, peak) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = (peak || 0.9) / (m || 1); for (let i = 0; i < x.length; i++) x[i] *= k; return x; }
const musSaw = (f, sr, roll) => musTable('saw' + (roll || 40), Math.min(80, Math.floor(sr / 2 / f) - 1), k => Math.exp(-k / (roll || 40)) / k);
const musDark = (f, sr, roll) => musTable('dark' + roll, Math.min(60, Math.floor(sr / 2 / f) - 1), k => Math.exp(-k / roll) / k);
const musOdd = (f, sr) => musTable('odd', Math.min(40, Math.floor(sr / 2 / f) - 1), k => (k % 2 ? 1 / (k * k) : 0));
/* gezupfte Saite (Karplus-Strong): Grundton genau sr / n, damit die Stimmung stimmt */
function musString(sr, n, len, damp, soft) {
  const o = new Float32Array(len), buf = musNoise(n);
  if (soft) { musFilter(buf, sr, 'lp', soft, 0.7); musNorm(buf, 1); }
  for (let i = 0, j = 0; i < len; i++) {
    const a = buf[j], b = buf[(j + 1) % n];
    o[i] = a;
    buf[j] = (a + b) * 0.5 * damp;
    j = (j + 1) % n;
  }
  return o;
}
/* Teiltöne (frei gestimmt) mit eigenem Abklingen: parts = [[Verhältnis, Stärke, τ], …] */
function musPartials(sr, f, len, parts, detune) {
  const o = new Float32Array(len);
  for (const [r, a, tau] of parts) for (const dc of detune || [0]) {
    const w = 2 * Math.PI * f * r * musCents(dc) / sr, ph = musRnd() * 6.28;
    for (let i = 0; i < len; i++) o[i] += a * Math.sin(w * i + ph) * Math.exp(-i / sr / tau);
  }
  return o;
}

/* ------------------------------------------------------------------ Instrumente
   zones: Grundtöne der Tonbeispiele (MIDI); dur: Länge in s; g: Pegel; rel: Ausklang nach Tonende (s); send: Anteil Hall;
   pan: Stereolage; drum: ohne Tonhöhe. gen(sr, f, n, m) rechnet ein Beispiel der Frequenz f (n Werte). */
const MUS_INST = {
  strings: { sr: 22050, zones: [48, 60, 72], dur: 3.4, g: 0.36, rel: 0.5, send: 0.42, pan: 0.18, gen(sr, f, n) {
    const o = new Float32Array(n), tb = musSaw(f, sr, 26);
    [[-11, 0.1], [-4, 0.55], [4, 0.3], [11, 0.8]].forEach(([dc, ph], i) => musOsc(o, sr, tb, f * musCents(dc), 0.25, ph, [5.0 + i * 0.23, 7, 0.3]));
    musFilter(o, sr, 'lp', Math.min(5200, f * 10), 0.6);
    return musEnv(musNorm(o), sr, 0.38, 0.9, 1.2);
  } },
  stac: { sr: 22050, zones: [55, 67], dur: 0.5, g: 0.32, rel: 0.06, send: 0.25, pan: -0.15, gen(sr, f, n) {
    const o = new Float32Array(n), tb = musSaw(f, sr, 24);
    [-8, 0, 7].forEach((dc, i) => musOsc(o, sr, tb, f * musCents(dc), 0.33, i * 0.31));
    musFilter(o, sr, 'lp', Math.min(5600, f * 9), 0.7);
    return musDecay(musNorm(o), sr, 0.11, 0.012);
  } },
  brass: { sr: 22050, zones: [55, 67], dur: 2.6, g: 0.34, rel: 0.16, send: 0.3, pan: 0.06, gen(sr, f, n) {
    /* Blechsatz: dunkel ansetzen, im Anstoß aufhellen (Filter-Hüllkurve als Überblendung zweier Tabellen) */
    const dk = new Float32Array(n), br = new Float32Array(n), d = musDark(f, sr, 3), b = musSaw(f, sr, 18);
    for (const [dc, ph] of [[-6, 0.2], [6, 0.7]]) { musOsc(dk, sr, d, f * musCents(dc), 0.5, ph, [5.6, 9, 0.28]); musOsc(br, sr, b, f * musCents(dc), 0.5, ph, [5.6, 9, 0.28]); }
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr, k = t < 0.05 ? t / 0.05 : 0.62 + 0.38 * Math.exp(-(t - 0.05) / 0.18); o[i] = dk[i] * (1 - k) + br[i] * k; }
    musFilter(o, sr, 'lp', Math.min(6500, f * 12), 0.7);
    musNorm(o);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] *= t < 0.035 ? t / 0.035 : 0.92 + 0.12 * Math.exp(-(t - 0.035) / 0.12); }
    return musEnv(o, sr, 0.001, 1, 1);
  } },
  horn: { sr: 22050, zones: [50, 62], dur: 2.6, g: 0.36, rel: 0.2, send: 0.38, pan: -0.08, gen(sr, f, n) {
    const o = new Float32Array(n), d = musDark(f, sr, 2.4);
    for (const [dc, ph] of [[-4, 0.1], [4, 0.6]]) musOsc(o, sr, d, f * musCents(dc), 0.5, ph, [5.0, 6, 0.3]);
    musFilter(o, sr, 'lp', Math.min(3000, f * 6), 0.6);
    return musEnv(musNorm(o), sr, 0.07, 0.95, 1);
  } },
  choir: { sr: 22050, zones: [45, 57], dur: 3.4, g: 0.4, rel: 0.55, send: 0.5, pan: 0.12, gen(sr, f, n) {
    /* Männerchor auf »a«: Summer durch vier Formanten */
    const src = new Float32Array(n), tb = musSaw(f, sr, 60);
    [-10, -2, 6, 12].forEach((dc, i) => musOsc(src, sr, tb, f * musCents(dc), 0.25, i * 0.27, [4.8 + i * 0.3, 13, 0.18]));
    const o = new Float32Array(n);
    for (const [fc, q, a] of [[700, 6, 1], [1150, 9, 0.62], [2600, 14, 0.26], [3300, 16, 0.12]]) {
      const c = Float32Array.from(src); musFilter(c, sr, 'bp', fc, q);
      for (let i = 0; i < n; i++) o[i] += a * c[i];
    }
    const br = musFilter(musNoise(n), sr, 'bp', 900, 1.2); for (let i = 0; i < n; i++) o[i] += br[i] * 0.02;
    return musEnv(musNorm(o), sr, 0.45, 0.92, 1.4);
  } },
  drone: { sr: 22050, zones: [38, 50], dur: 3.4, g: 0.3, rel: 0.6, send: 0.35, pan: 0, gen(sr, f, n) {
    /* Harmonium: Rechteck-nah, näselnd */
    const o = new Float32Array(n), tb = musTable('harm', Math.min(50, Math.floor(sr / 2 / f) - 1), k => (k % 2 ? 1 / k : 0.45 / k) * Math.exp(-k / 30));
    [[-5, 0.1], [5, 0.4]].forEach(([dc, ph]) => musOsc(o, sr, tb, f * musCents(dc), 0.5, ph, [3.8, 4, 0.5]));
    const nas = Float32Array.from(o); musFilter(nas, sr, 'bp', 1100, 3);
    for (let i = 0; i < n; i++) o[i] = o[i] * 0.6 + nas[i] * 0.9;
    musFilter(o, sr, 'lp', 3800, 0.6);
    return musEnv(musNorm(o), sr, 0.6, 0.95, 1.5);
  } },
  pad: { sr: 22050, zones: [52, 64], dur: 3.6, g: 0.34, rel: 0.8, send: 0.55, pan: 0.2, gen(sr, f, n) {
    const o = new Float32Array(n), tb = musOdd(f, sr), sw = musSaw(f, sr, 14);
    [[-7, 0.2], [0, 0.6], [8, 0.9]].forEach(([dc, ph], i) => { musOsc(o, sr, tb, f * musCents(dc), 0.3, ph, [0.35 + i * 0.07, 9, 0]); musOsc(o, sr, sw, f * musCents(dc), 0.07, ph); });
    musFilter(o, sr, 'lp', Math.min(2400, f * 5), 0.6);
    return musEnv(musNorm(o), sr, 0.8, 0.95, 2);
  } },
  bass: { sr: 22050, zones: [33, 45], dur: 1.8, g: 0.5, rel: 0.09, send: 0.05, pan: 0, gen(sr, f, n) {
    const o = new Float32Array(n), sine = musTable('sin', 1, () => 1), sw = musSaw(f, sr, 20);
    musOsc(o, sr, sine, f, 0.62, 0); musOsc(o, sr, sw, f * musCents(-4), 0.3, 0.3); musOsc(o, sr, sw, f * musCents(4), 0.3, 0.7);
    musFilter(o, sr, 'lp', Math.min(950, f * 5), 0.8);
    musNorm(o);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] *= Math.min(1, t / 0.008) * (0.55 + 0.45 * Math.exp(-t / 0.35)) * Math.exp(-t / 3); }
    return musEnv(o, sr, 0.001, 1, 1);
  } },
  tuba: { sr: 22050, zones: [33, 45], dur: 1.8, g: 0.5, rel: 0.1, send: 0.12, pan: 0, gen(sr, f, n) {
    const o = new Float32Array(n), d = musDark(f, sr, 2.2);
    musOsc(o, sr, d, f, 0.7, 0, [5, 4, 0.4]); musOsc(o, sr, musTable('sin', 1, () => 1), f, 0.35, 0);
    musFilter(o, sr, 'lp', Math.min(1200, f * 6), 0.7);
    musNorm(o);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] *= Math.min(1, t / 0.04) * (0.7 + 0.3 * Math.exp(-t / 0.25)) * Math.exp(-t / 2.5); }
    return musEnv(o, sr, 0.001, 1, 1);
  } },
  pluck: { sr: 22050, zones: [57, 69], ks: 0.9965, soft: 0, dur: 1.4, g: 0.3, rel: 0.05, send: 0.25, pan: -0.25 },
  oud: { sr: 22050, zones: [38, 50], ks: 0.9945, soft: 1800, dur: 1.6, g: 0.42, rel: 0.06, send: 0.2, pan: 0.05 },
  santur: { sr: 22050, zones: [62, 74], dur: 2, g: 0.3, rel: 0.12, send: 0.35, pan: 0.22, gen(sr, f, n) {
    const o = musPartials(sr, f, n, [[1, 1, 1.4], [2.003, 0.55, 0.7], [3.008, 0.32, 0.45], [4.015, 0.2, 0.3], [5.03, 0.12, 0.22]], [0, 3.5]);
    const h = musFilter(musNoise(Math.round(sr * 0.012)), sr, 'bp', 3200, 1.2);
    for (let i = 0; i < h.length; i++) o[i] += h[i] * 0.5 * (1 - i / h.length);
    return musDecay(musNorm(o), sr, 4, 0.001);
  } },
  ney: { sr: 22050, zones: [62, 74], dur: 2.6, g: 0.36, rel: 0.18, send: 0.45, pan: -0.1, gen(sr, f, n) {
    /* Ney: fast reiner Ton mit Atemgeräusch, Vibrato nach dem Einsatz */
    const o = new Float32Array(n), tb = musTable('ney', 3, k => [1, 0.12, 0.05][k - 1]);
    musOsc(o, sr, tb, f, 0.8, 0, [4.6, 11, 0.25]);
    const br = musFilter(musNoise(n), sr, 'bp', f * 1.02, 2.2), br2 = musFilter(musNoise(n), sr, 'bp', f * 2.1, 3);
    for (let i = 0; i < n; i++) { const t = i / sr, b = 0.16 + 0.45 * Math.exp(-t / 0.08); o[i] += (br[i] * 1.1 + br2[i] * 0.5) * b; }
    return musEnv(musNorm(o), sr, 0.09, 0.95, 1);
  } },
  bell: { sr: 22050, zones: [72], dur: 4, g: 0.26, rel: 0.4, send: 0.45, pan: 0.3, gen(sr, f, n) {
    const o = musPartials(sr, f, n, [[1, 1, 3.2], [2.0, 0.55, 2.4], [2.76, 0.45, 1.8], [5.4, 0.22, 1.0], [8.93, 0.1, 0.55]], [0]);
    return musDecay(musNorm(o), sr, 20, 0.001);
  } },
  piano: { sr: 22050, zones: [57, 69], dur: 2.6, g: 0.3, rel: 0.25, send: 0.32, pan: -0.18, gen(sr, f, n) {
    const parts = [];
    for (let k = 1; k <= 9; k++) parts.push([k * Math.sqrt(1 + 0.0004 * k * k), 1 / Math.pow(k, 1.25), 2.4 / (1 + 0.38 * k)]);
    const o = musPartials(sr, f, n, parts, [-1.5, 1.5]);
    const h = musFilter(musNoise(Math.round(sr * 0.01)), sr, 'lp', 2200, 0.7);
    for (let i = 0; i < h.length; i++) o[i] += h[i] * 0.3 * (1 - i / h.length);
    return musDecay(musNorm(o), sr, 6, 0.002);
  } },
  timp: { sr: 22050, zones: [45], dur: 2.2, g: 0.55, rel: 0.2, send: 0.3, pan: 0, gen(sr, f, n) {
    const o = new Float32Array(n);
    for (const [r, a, tau] of [[1, 1, 1.5], [1.5, 0.55, 1.1], [1.99, 0.35, 0.85], [2.44, 0.2, 0.6], [2.9, 0.12, 0.45]]) {
      let ph = musRnd() * 6.28;
      for (let i = 0; i < n; i++) { const t = i / sr, ff = f * r * (1 + 0.015 * Math.exp(-t / 0.06)); ph += 6.2832 * ff / sr; o[i] += a * Math.sin(ph) * Math.exp(-t / tau); }
    }
    const th = musFilter(musNoise(Math.round(sr * 0.04)), sr, 'lp', 320, 0.7);
    for (let i = 0; i < th.length; i++) o[i] += th[i] * 0.8 * (1 - i / th.length);
    return musDecay(musNorm(o), sr, 9, 0.002);
  } },
  /* Schlagwerk ohne Tonhöhe */
  gran: { drum: 1, sr: 22050, dur: 1.4, g: 0.6, send: 0.25, pan: 0, gen(sr, f, n) {
    const o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 6.2832 * (44 + 16 * Math.exp(-t / 0.12)) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.45); }
    const th = musFilter(musNoise(Math.round(sr * 0.12)), sr, 'lp', 190, 0.7);
    for (let i = 0; i < th.length; i++) o[i] += th[i] * 0.9 * Math.exp(-i / sr / 0.05);
    return musDecay(musNorm(o), sr, 9, 0.003);
  } },
  kick: { drum: 1, sr: 22050, dur: 0.6, g: 0.55, send: 0.06, pan: 0, gen(sr, f, n) {
    const o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 6.2832 * (46 + 70 * Math.exp(-t / 0.035)) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.2); }
    const c = musFilter(musNoise(Math.round(sr * 0.005)), sr, 'hp', 1800, 0.7); for (let i = 0; i < c.length; i++) o[i] += c[i] * 0.4;
    return musDecay(musNorm(o), sr, 9, 0.001);
  } },
  snare: { drum: 1, sr: 32000, dur: 0.5, g: 0.42, send: 0.2, pan: 0.08, gen(sr, f, n) {
    const o = new Float32Array(n), nb = musFilter(musNoise(n), sr, 'bp', 1900, 0.7), nh = musFilter(musNoise(n), sr, 'hp', 5200, 0.7);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] = Math.sin(6.2832 * 185 * t) * 0.5 * Math.exp(-t / 0.06) + nb[i] * 1.2 * Math.exp(-t / 0.12) + nh[i] * 0.7 * Math.exp(-t / 0.15); }
    return musDecay(musNorm(o), sr, 9, 0.001);
  } },
  hat: { drum: 1, sr: 32000, dur: 0.15, g: 0.18, send: 0.08, pan: -0.3, gen(sr, f, n) {
    const o = musPartials(sr, 1, n, [[3140, 0.3, 0.05], [4410, 0.25, 0.04], [5180, 0.25, 0.04], [6870, 0.2, 0.035], [9120, 0.2, 0.03]]);
    const nz = musFilter(musNoise(n), sr, 'hp', 7000, 0.7);
    for (let i = 0; i < n; i++) o[i] = o[i] * 0.4 + nz[i];
    musFilter(o, sr, 'hp', 6000, 0.7);
    return musDecay(musNorm(o), sr, 0.035, 0.0005);
  } },
  crash: { drum: 1, sr: 32000, dur: 2.6, g: 0.26, send: 0.35, pan: 0.25, gen(sr, f, n) {
    const o = musPartials(sr, 1, n, [[2870, 0.2, 1.3], [3510, 0.2, 1.2], [4630, 0.18, 1.0], [5970, 0.15, 0.9], [7410, 0.12, 0.8], [8820, 0.1, 0.7]]);
    const nz = musFilter(musNoise(n), sr, 'hp', 3500, 0.6);
    for (let i = 0; i < n; i++) o[i] = o[i] * 0.5 + nz[i] * Math.exp(-i / sr / 1.0);
    return musDecay(musNorm(o), sr, 1.4, 0.003);
  } },
  tom: { drum: 1, sr: 22050, dur: 0.7, g: 0.45, send: 0.2, pan: -0.1, gen(sr, f, n) {
    const o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 6.2832 * (78 + 30 * Math.exp(-t / 0.08)) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.25); }
    const th = musFilter(musNoise(Math.round(sr * 0.05)), sr, 'lp', 600, 0.7); for (let i = 0; i < th.length; i++) o[i] += th[i] * 0.5 * (1 - i / th.length);
    return musDecay(musNorm(o), sr, 9, 0.001);
  } },
  dum: { drum: 1, sr: 22050, dur: 0.7, g: 0.55, send: 0.2, pan: 0, gen(sr, f, n) {
    /* Daf, tiefer Schlag in die Mitte */
    const o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 6.2832 * (66 + 10 * Math.exp(-t / 0.05)) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.3); }
    const sk = musFilter(musNoise(Math.round(sr * 0.08)), sr, 'lp', 320, 0.7); for (let i = 0; i < sk.length; i++) o[i] += sk[i] * 0.7 * Math.exp(-i / sr / 0.03);
    return musDecay(musNorm(o), sr, 9, 0.001);
  } },
  tak: { drum: 1, sr: 32000, dur: 0.2, g: 0.36, send: 0.18, pan: 0.15, gen(sr, f, n) {
    const o = musFilter(musNoise(n), sr, 'bp', 2600, 1.2);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] = o[i] * Math.exp(-t / 0.03) + Math.sin(6.2832 * 980 * t) * 0.35 * Math.exp(-t / 0.025); }
    return musDecay(musNorm(o), sr, 9, 0.0005);
  } },
  jingle: { drum: 1, sr: 32000, dur: 0.3, g: 0.16, send: 0.2, pan: -0.2, gen(sr, f, n) {
    const o = new Float32Array(n);
    for (const off of [0, 0.008, 0.019]) {
      const s0 = Math.round(off * sr), p = musPartials(sr, 1, n - s0, [[4200, 0.4, 0.07], [5600, 0.35, 0.06], [6900, 0.3, 0.05], [8300, 0.25, 0.05], [9700, 0.2, 0.04]]);
      for (let i = 0; i < p.length; i++) o[i + s0] += p[i] * (1 - off * 20);
    }
    return musDecay(musNorm(o), sr, 9, 0.0005);
  } },
  shaker: { drum: 1, sr: 32000, dur: 0.18, g: 0.14, send: 0.12, pan: 0.3, gen(sr, f, n) {
    const o = musFilter(musNoise(n), sr, 'bp', 5600, 0.8);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] *= Math.min(1, t / 0.012) * Math.exp(-Math.max(0, t - 0.012) / 0.045); }
    return musNorm(o);
  } }
};
/* gezupfte Instrumente: Karplus-Strong mit ganzzahliger Verzögerung; der Grundton des Beispiels ist sr / (n − 0,5) */
for (const id of ['pluck', 'oud']) MUS_INST[id].ks = MUS_INST[id].ks || 0.996;

/* eine Zone eines Instruments berechnen (fester Zufall je Instrument und Zone) */
function musMakeZone(id, zi) {
  const d = MUS_INST[id], sr = d.sr, n = Math.round(d.dur * sr), m = d.drum ? 60 : d.zones[zi];
  MUS_RND.s = 7 + id.length * 977 + id.charCodeAt(0) + zi * 131;
  let data, base = m;
  if (d.ks) {
    /* die Mittelung zweier Nachbarwerte verkürzt die Schleife um einen halben Wert: Periode per − 0,5 */
    const per = Math.round(sr / musHz(m) + 0.5);
    base = 69 + 12 * Math.log2(sr / (per - 0.5) / 440);
    data = musString(sr, per, n, d.ks, d.soft);
    if (id === 'oud') musFilter(data, sr, 'lp', 2600, 0.7);
    musDecay(musNorm(data), sr, 9, 0.001);
  } else data = d.gen(sr, musHz(m), n, m);
  for (let i = 0; i < data.length; i++) if (!(data[i] === data[i])) data[i] = 0;
  return { m: base, data };
}
const musZones = id => (MUS_INST[id].drum ? 1 : MUS_INST[id].zones.length);
function musInst(id) {
  let ins = MUS.bank.get(id);
  if (!ins) { ins = { id, d: MUS_INST[id], zones: [] }; MUS.bank.set(id, ins); }
  while (ins.zones.length < musZones(id)) ins.zones.push(musMakeZone(id, ins.zones.length));
  return ins;
}
/* AudioBuffer zu einer Zone (je Kontext einmal) */
function musBuf(ctx, z, sr) {
  if (z.buf && z.ctx === ctx) return z.buf;
  let b;
  try { b = new AudioBuffer({ length: z.data.length, sampleRate: sr, numberOfChannels: 1 }); } catch (e) { b = ctx.createBuffer(1, z.data.length, sr); }
  b.getChannelData(0).set(z.data);
  z.buf = b; z.ctx = ctx;
  return b;
}

/* ------------------------------------------------------------------ Notenschrift
   Akkorde: »Dm«, »Bb«, »A7«, »Dsus4«; Motive: »D4:4 A4:4 D5:6 E5:2 | …« (Ton:Dauer in Sechzehnteln, r = Pause, | = Takt);
   Muster: 16 Zeichen je Takt, X betont, x normal, o leise, . nichts. */
const MUS_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MUS_Q = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], '5': [0, 7] };
function musChord(s) {
  let pc = MUS_PC[s[0]], i = 1;
  if (s[1] === '#') { pc++; i++; } else if (s[1] === 'b') { pc--; i++; }
  return { pc: (pc + 12) % 12, iv: MUS_Q[s.slice(i)] || MUS_Q[''] };
}
function musNote(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  return 12 * (+m[3] + 1) + MUS_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function musMotif(s) {
  return s.split('|').map(bar => {
    const out = [];
    let st = 0;
    for (const tok of bar.trim().split(/\s+/)) {
      if (!tok) continue;
      const [nm, du] = tok.split(':'), d = +du;
      if (nm !== 'r') out.push([st, musNote(nm), d]);
      st += d;
    }
    return out;
  });
}
const musPat = s => (s || '').split('').map(c => (c === 'X' ? 1 : c === 'x' ? 0.8 : c === 'o' ? 0.5 : 0));
/* Ton eines Akkords in einem Lagenbereich: k = 0 Grundton, 1 Terz, 2 Quinte, 3 Oktave …; lo = unterste Note */
function musTone(ch, k, lo) {
  const iv = ch.iv, n = iv.length, o = Math.floor(k / n), j = k % n;
  let m = ch.pc + iv[j] + 12 * o;
  const r = ((ch.pc - lo) % 12 + 12) % 12;
  return lo + r + (m - ch.pc);
}

/* ------------------------------------------------------------------ Stücke */
const MUS_THEMES = {
  /* Alliance: hoffnungsvoll in D-Dur mit Wendung nach h-Moll, Streicherfläche, Glocken, im Gefecht Blech und Pauken */
  alliance: { bpm: 100, form: ['A', 'A', 'B', 'C'],
    sec: {
      A: { ch: 'D A Bm G D A G A', mo: 'D4:4 F#4:4 A4:6 B4:2 | A4:8 E4:4 F#4:4 | D4:4 F#4:4 B4:6 A4:2 | G4:4 F#4:4 E4:8 | D4:4 F#4:4 A4:6 D5:2 | C#5:4 B4:2 A4:2 E4:8 | G4:4 B4:4 D5:4 B4:4 | A4:12 r:4' },
      B: { ch: 'Bm G D A Bm G Em A', mo: 'B4:8 D5:4 F#5:4 | G5:6 F#5:2 D5:8 | F#5:4 E5:4 D5:4 C#5:4 | E5:12 r:4 | B4:8 D5:4 F#5:4 | G5:4 B5:4 A5:8 | G5:4 F#5:4 E5:8 | A5:16' },
      C: { ch: 'G D Em A', mo: 'G4:8 B4:8 | A4:16 | E4:8 G4:8 | A4:8 C#5:4 E5:4' } },
    layers: [
      { k: 'pad', i: 'pad', lo: 50, v: [0.36, 0.42, 0.46] },
      { k: 'pad', i: 'strings', lo: 57, v: [0, 0.22, 0.32] },
      { k: 'bass', i: 'bass', lo: 38, v: [0.45, 0.55, 0.65], pat: ['x...............', 'x.......x.....x.', 'x.x.x.x.x.x.x.xx'], seq: [0, 0, 2, 0, 3, 0, 2, 0] },
      { k: 'arp', i: 'piano', lo: 62, v: [0.2, 0.3, 0.36], pat: 'x.x.x.x.x.x.x.x.', seq: [0, 2, 3, 2, 0, 3, 2, 3], dur: 2, vars: [0, 1] },
      { k: 'arp', i: 'stac', lo: 62, v: [0, 0.28, 0.4], pat: 'xxxxxxxxxxxxxxxx', seq: [0, 2, 3, 2], dur: 1, vars: [2] },
      { k: 'motif', i: 'bell', oct: 0, v: [0.3, 0, 0], bars: [0, 1, 2, 3], secs: 'A' },
      { k: 'motif', i: 'horn', oct: 0, v: [0, 0.42, 0.3], vars: [0, 2] },
      { k: 'motif', i: 'strings', oct: 12, v: [0, 0.32, 0.26], vars: [1] },
      { k: 'motif', i: 'brass', oct: 0, v: [0, 0, 0.58], vars: [0, 1] },
      { k: 'motif', i: 'choir', oct: 0, v: [0, 0, 0.45], vars: [2] },
      { k: 'drum', i: 'timp', tone: 38, v: [0, 0.5, 0.72], pat: ['', 'X...............', 'X.......x...x.x.'] },
      { k: 'drum', i: 'snare', v: [0, 0, 0.45], pat: ['', '', 'o...x...o..ox.x.'], fill: '............xxxx' },
      { k: 'drum', i: 'kick', v: [0, 0.4, 0.66], pat: ['', 'x...............', 'x.......x.......'] },
      { k: 'drum', i: 'hat', v: [0.12, 0.18, 0.26], pat: ['..o...o...o...o.', 'o.o.o.o.o.o.o.o.', 'x.o.x.o.x.o.x.o.'] },
      { k: 'hit', i: 'crash', v: [0, 0, 0.45] }
    ] },
  /* Mars: karg und entschlossen in c-Moll, tiefe Tuba, gezupfte Figuren, Marschtrommel, im Gefecht Blech und Tom */
  mars: { bpm: 104, form: ['A', 'B', 'A', 'C'],
    sec: {
      A: { ch: 'Cm Cm Ab Bb Cm Fm G Cm', mo: 'C4:4 Eb4:2 D4:2 C4:4 G3:4 | C4:4 Eb4:4 G4:8 | Ab4:4 G4:2 F4:2 Eb4:4 C4:4 | Bb3:4 D4:4 F4:8 | C4:4 Eb4:2 D4:2 C4:4 G4:4 | Ab4:4 F4:4 C5:8 | B4:4 G4:4 D4:4 B3:4 | C4:12 r:4' },
      B: { ch: 'Fm Cm Ab Eb Fm Cm G G', mo: 'F4:6 G4:2 Ab4:4 F4:4 | G4:6 F4:2 Eb4:4 C4:4 | Ab4:4 C5:4 Eb5:8 | Bb4:4 G4:4 Eb4:8 | F4:4 Ab4:4 C5:6 Bb4:2 | G4:4 Eb4:4 C5:8 | B4:8 D5:8 | G4:4 B4:4 D5:8' },
      C: { ch: 'Cm Ab Fm G', mo: 'C4:16 | Ab4:8 Eb4:8 | F4:8 Ab4:8 | G4:16' } },
    layers: [
      { k: 'drone', i: 'drone', notes: [36, 43, 48], v: [0.28, 0.3, 0.34] },
      { k: 'pad', i: 'choir', lo: 48, v: [0.2, 0.3, 0.38] },
      { k: 'bass', i: 'tuba', lo: 36, v: [0.5, 0.6, 0.7], pat: ['x.......x.......', 'x...x...x...x...', 'x...x...x.x.x...'], seq: [0, 0, 2, 0] },
      { k: 'arp', i: 'pluck', lo: 55, v: [0, 0.26, 0.32], pat: ['', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'], seq: [0, 1, 2, 1], dur: 1, vars: [0, 2] },
      { k: 'arp', i: 'pluck', lo: 60, v: [0, 0.28, 0.34], pat: ['', 'x...x.x.x...x.x.', 'x.xxx.xxx.xxx.xx'], seq: [0, 2, 1, 2], dur: 1, vars: [1] },
      { k: 'motif', i: 'horn', oct: -12, v: [0.32, 0, 0], bars: [0, 1, 2, 3] },
      { k: 'motif', i: 'horn', oct: 0, v: [0, 0.44, 0.3], vars: [0, 2] },
      { k: 'motif', i: 'strings', oct: 0, v: [0, 0.36, 0.26], vars: [1] },
      { k: 'motif', i: 'brass', oct: -12, v: [0, 0, 0.6], vars: [0, 1] },
      { k: 'motif', i: 'brass', oct: 0, v: [0, 0, 0.5], vars: [2] },
      { k: 'drum', i: 'snare', v: [0, 0.32, 0.5], pat: ['', 'o.......o.......', 'x..ox.x.x..ox.xx'], fill: '........x.x.xxxx' },
      { k: 'drum', i: 'gran', v: [0, 0.42, 0.7], pat: ['', 'x.......x.......', 'X.......X.......'] },
      { k: 'drum', i: 'tom', v: [0, 0, 0.42], pat: ['', '', '............x.x.'], fill: '........x.x.xxxx' },
      { k: 'drum', i: 'hat', v: [0.1, 0.16, 0.24], pat: ['..o...o...o...o.', 'o.o.o.o.o.o.o.o.', 'x.o.x.o.x.o.x.o.'] },
      { k: 'hit', i: 'crash', v: [0, 0, 0.45] }
    ] },
  /* Golden Legion: feierlich in F-Dur mit Orgel, Chor und Glocken, im Gefecht Blech und Pauken – eine Kathedrale im All */
  legion: { bpm: 92, form: ['A', 'B', 'A', 'C'],
    sec: {
      A: { ch: 'F C Dm Bb F C Bb C', mo: 'F4:4 A4:4 C5:6 Bb4:2 | A4:8 G4:4 E4:4 | D4:4 F4:4 A4:6 G4:2 | F4:4 D4:4 Bb3:8 | F4:4 A4:4 C5:4 F5:4 | E5:4 C5:4 G4:8 | Bb4:4 D5:4 F5:4 D5:4 | C5:12 r:4' },
      B: { ch: 'Dm Bb F C Dm Bb Gm C', mo: 'D5:8 F5:4 A5:4 | Bb5:6 A5:2 F5:8 | A5:4 G5:4 F5:4 E5:4 | G5:12 r:4 | D5:8 F5:4 A5:4 | Bb5:4 D6:4 C6:8 | Bb5:4 A5:4 G5:8 | C6:16' },
      C: { ch: 'Bb F Gm C', mo: 'Bb4:8 D5:8 | C5:16 | G4:8 Bb4:8 | C5:8 E5:4 G5:4' } },
    layers: [
      { k: 'pad', i: 'choir', lo: 48, v: [0.34, 0.4, 0.46] },
      { k: 'pad', i: 'pad', lo: 55, v: [0.16, 0.24, 0.3] },
      { k: 'bass', i: 'tuba', lo: 36, v: [0.42, 0.52, 0.62], pat: ['x...............', 'x.......x.......', 'x...x...x...x.x.'], seq: [0, 0, 2, 0] },
      { k: 'arp', i: 'bell', lo: 67, v: [0.22, 0.3, 0.34], pat: 'x...x...x...x...', seq: [0, 2, 3, 2], dur: 2, vars: [0, 1] },
      { k: 'arp', i: 'piano', lo: 60, v: [0, 0.26, 0.34], pat: 'x.x.x.x.x.x.x.x.', seq: [0, 2, 3, 2, 0, 3, 2, 3], dur: 2, vars: [2] },
      { k: 'motif', i: 'choir', oct: 0, v: [0.34, 0, 0], bars: [0, 1, 2, 3], secs: 'A' },
      { k: 'motif', i: 'horn', oct: 0, v: [0, 0.44, 0.3], vars: [0, 2] },
      { k: 'motif', i: 'strings', oct: 12, v: [0, 0.3, 0.26], vars: [1] },
      { k: 'motif', i: 'brass', oct: 0, v: [0, 0, 0.6], vars: [0, 1] },
      { k: 'motif', i: 'choir', oct: 12, v: [0, 0, 0.42], vars: [2] },
      { k: 'drum', i: 'timp', tone: 41, v: [0, 0.5, 0.72], pat: ['', 'X...............', 'X.......x.x.....'] },
      { k: 'drum', i: 'snare', v: [0, 0, 0.42], pat: ['', '', 'o.......o..ox...'], fill: '............xxxx' },
      { k: 'drum', i: 'kick', v: [0, 0.36, 0.6], pat: ['', 'x...............', 'x.......x.......'] },
      { k: 'drum', i: 'hat', v: [0.1, 0.16, 0.24], pat: ['......o.......o.', 'o...o...o...o...', 'x.o.x.o.x.o.x.o.'] },
      { k: 'hit', i: 'crash', v: [0, 0, 0.45] }
    ] },
  /* Nexus: gläsern und fremd in a-Moll mit lydischem Schimmer, Glocken-Arpeggien, Drone, im Gefecht pulsierend */
  nexus: { bpm: 112, form: ['A', 'A', 'B', 'C'],
    sec: {
      A: { ch: 'Am F C G Am F D E', mo: 'A4:4 C5:4 E5:4 B4:4 | A4:8 G4:4 E4:4 | F4:4 A4:4 C5:6 B4:2 | G4:4 B4:4 D5:8 | A4:4 C5:4 E5:4 A5:4 | F5:4 E5:2 D5:2 C5:8 | D5:4 F#5:4 A5:4 F#5:4 | E5:12 r:4' },
      B: { ch: 'F G Am Em F G Dm E', mo: 'F5:8 A5:4 C6:4 | G5:6 F5:2 D5:8 | E5:4 C5:4 A4:4 B4:4 | E5:12 r:4 | F5:8 A5:4 C6:4 | G5:4 B5:4 D6:8 | F5:4 E5:4 D5:8 | E5:16' },
      C: { ch: 'Am Em F E', mo: 'A4:16 | E5:8 B4:8 | F4:8 A4:8 | E5:16' } },
    layers: [
      { k: 'drone', i: 'drone', notes: [33, 45, 52], v: [0.26, 0.3, 0.34] },
      { k: 'pad', i: 'pad', lo: 57, v: [0.3, 0.36, 0.4] },
      { k: 'bass', i: 'bass', lo: 33, v: [0.4, 0.5, 0.6], pat: ['x.......x.......', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'], seq: [0, 0, 2, 0] },
      { k: 'arp', i: 'bell', lo: 69, v: [0.26, 0.32, 0.36], pat: 'x.x.x.x.x.x.x.x.', seq: [0, 2, 3, 4, 3, 2], dur: 1, vars: [0, 1, 2] },
      { k: 'arp', i: 'stac', lo: 64, v: [0, 0.24, 0.36], pat: ['', 'x..x..x.x..x..x.', 'xxxxxxxxxxxxxxxx'], seq: [0, 3, 2, 3], dur: 1, vars: [2] },
      { k: 'motif', i: 'bell', oct: 0, v: [0.3, 0, 0], bars: [0, 1, 2, 3], secs: 'A' },
      { k: 'motif', i: 'strings', oct: 0, v: [0, 0.4, 0.3], vars: [0, 2] },
      { k: 'motif', i: 'choir', oct: 0, v: [0, 0.3, 0.3], vars: [1] },
      { k: 'motif', i: 'brass', oct: 0, v: [0, 0, 0.5], vars: [0, 1] },
      { k: 'motif', i: 'strings', oct: 12, v: [0, 0, 0.4], vars: [2] },
      { k: 'drum', i: 'kick', v: [0, 0.4, 0.66], pat: ['', 'x...x...x...x...', 'x.x.x...x.x.x...'] },
      { k: 'drum', i: 'hat', v: [0.14, 0.2, 0.28], pat: ['o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'x.o.x.o.x.o.x.oo'] },
      { k: 'drum', i: 'snare', v: [0, 0, 0.4], pat: ['', '', '....x.......x...'], fill: '............x.xx' },
      { k: 'hit', i: 'crash', v: [0, 0, 0.4] }
    ] },
  /* The Brood: kriechend in d-Moll mit tiefen Drones, Tom-Pulsen, gleitenden Streichern; im Gefecht treibende Trommeln und Blech */
  brood: { bpm: 100, form: ['A', 'A', 'B', 'C'],
    sec: {
      A: { ch: 'Dm Dm Bb A Dm Gm Bb A', mo: 'D4:6 F4:2 E4:4 D4:4 | A3:8 D4:4 F4:4 | Bb3:4 D4:4 F4:6 E4:2 | A3:4 C#4:4 E4:8 | D4:4 F4:4 A4:4 G4:4 | G4:6 F4:2 D4:8 | Bb3:4 F4:4 D5:8 | C#5:4 A4:4 E4:8' },
      B: { ch: 'Gm Dm Bb A Gm Dm Eb A', mo: 'G4:8 Bb4:4 D5:4 | A4:6 F4:2 D4:8 | Bb4:4 D5:4 F5:4 D5:4 | C#5:12 r:4 | G4:8 Bb4:4 D5:4 | A4:4 F4:4 D4:8 | Eb4:4 G4:4 Bb4:8 | A4:16' },
      C: { ch: 'Dm Bb Gm A', mo: 'D4:16 | Bb3:8 D4:8 | G4:8 Bb4:8 | A4:16' } },
    layers: [
      { k: 'drone', i: 'drone', notes: [26, 38, 45], v: [0.34, 0.36, 0.4] },
      { k: 'pad', i: 'strings', lo: 50, v: [0.22, 0.3, 0.36] },
      { k: 'bass', i: 'tuba', lo: 38, v: [0.44, 0.54, 0.64], pat: ['x.......x.......', 'x..x....x..x....', 'x..x..x.x..x..x.'], seq: [0, 0, 2, 0] },
      { k: 'arp', i: 'pluck', lo: 50, v: [0, 0.22, 0.3], pat: ['', 'x..x..x.x..x..x.', 'x.xx.xx.x.xx.xx.'], seq: [0, 2, 1, 2], dur: 1, vars: [0, 2] },
      { k: 'motif', i: 'strings', oct: -12, v: [0.3, 0, 0], bars: [0, 1, 2, 3], secs: 'A' },
      { k: 'motif', i: 'horn', oct: 0, v: [0, 0.4, 0.3], vars: [0, 2] },
      { k: 'motif', i: 'choir', oct: 0, v: [0, 0.3, 0.26], vars: [1] },
      { k: 'motif', i: 'brass', oct: -12, v: [0, 0, 0.56], vars: [0, 1] },
      { k: 'motif', i: 'strings', oct: 12, v: [0, 0, 0.4], vars: [2] },
      { k: 'drum', i: 'tom', v: [0.24, 0.4, 0.56], pat: ['x.......x.......', 'x..x....x..x....', 'x..x..x.x..x..xx'], fill: '........x.xx.xxx' },
      { k: 'drum', i: 'gran', v: [0, 0.3, 0.6], pat: ['', 'x...............', 'X.......X.......'] },
      { k: 'drum', i: 'snare', v: [0, 0, 0.4], pat: ['', '', '....x.......x...'], fill: '............xxxx' },
      { k: 'drum', i: 'hat', v: [0.08, 0.14, 0.22], pat: ['......o.........', 'o...o...o...o...', 'x.o.x.o.x.o.x.o.'] },
      { k: 'hit', i: 'crash', v: [0, 0, 0.45] }
    ] },
  /* Hauptmenü: weit und ruhig in e-Moll, Fläche, Glocken, Klavier */
  menu: { bpm: 80, form: ['A', 'B'], lvl: 1,
    sec: {
      A: { ch: 'Em C G D Em C Am B7', mo: 'E4:4 G4:4 B4:8 | C5:4 B4:4 G4:8 | D4:4 G4:4 B4:8 | A4:8 F#4:8 | E4:4 G4:4 B4:8 | E5:8 C5:8 | A4:4 B4:4 C5:8 | B4:8 D#4:8' },
      B: { ch: 'C D Em Em C D B7 B7', mo: 'G4:8 E4:8 | F#4:8 A4:8 | B4:12 r:4 | E4:4 F#4:4 G4:8 | C5:8 G4:8 | A4:8 F#4:8 | D#4:8 F#4:8 | B4:16' } },
    layers: [
      { k: 'pad', i: 'pad', lo: 52, v: [0.4, 0.4, 0.4] },
      { k: 'bass', i: 'bass', lo: 33, v: [0.4, 0.45, 0.5], pat: ['x...............', 'x.......x.......', 'x.......x.......'], seq: [0, 2] },
      { k: 'arp', i: 'piano', lo: 57, v: [0.2, 0.24, 0.28], pat: 'x.x.x.x.x.x.x.x.', seq: [0, 1, 2, 3, 2, 1, 2, 3], dur: 2 },
      { k: 'motif', i: 'bell', oct: 0, v: [0.22, 0.26, 0.3], bars: [0, 2, 4, 6] },
      { k: 'motif', i: 'horn', oct: -12, v: [0, 0.26, 0.3] },
      { k: 'drum', i: 'kick', v: [0, 0.3, 0.4], pat: ['', 'x.......x.......', 'x.......x.......'] },
      { k: 'drum', i: 'shaker', v: [0.1, 0.14, 0.18], pat: 'o.o.o.o.o.o.o.o.' }
    ] },
  win: { bpm: 112, form: ['A'], once: true, lvl: 2,
    sec: { A: { ch: 'D G D', mo: 'D4:2 F#4:2 A4:2 D5:10 | B4:4 D5:4 G5:8 | F#5:16' } },
    layers: [
      { k: 'pad', i: 'strings', lo: 50, v: [0.5, 0.5, 0.5] },
      { k: 'motif', i: 'brass', oct: 0, v: [0.7, 0.7, 0.7] },
      { k: 'motif', i: 'horn', oct: -12, v: [0.45, 0.45, 0.45] },
      { k: 'drum', i: 'timp', tone: 38, v: [0.7, 0.7, 0.7], pat: 'X.......x.x.x.x.' },
      { k: 'hit', i: 'crash', v: [0.5, 0.5, 0.5] }
    ] },
  lose: { bpm: 72, form: ['A'], once: true, lvl: 1,
    sec: { A: { ch: 'Em Am B7 Em', mo: 'B4:4 A4:4 G4:4 F#4:4 | E4:8 C5:8 | B4:8 D#4:8 | E4:16' } },
    layers: [
      { k: 'pad', i: 'strings', lo: 48, v: [0.42, 0.42, 0.42] },
      { k: 'motif', i: 'horn', oct: 0, v: [0.5, 0.5, 0.5] },
      { k: 'bass', i: 'bass', lo: 33, v: [0.45, 0.45, 0.45], pat: 'x.......x.......', seq: [0] },
      { k: 'drum', i: 'timp', tone: 38, v: [0.45, 0.45, 0.45], pat: 'X...............' }
    ] }
};
/* Stück vorbereiten: Akkorde und Motive einmal übersetzen */
function musPrep(th) {
  if (th.ready) return th;
  for (const k in th.sec) {
    const s = th.sec[k];
    s.chords = s.ch.split(/\s+/).map(musChord);
    s.motif = musMotif(s.mo);
    s.bars = s.chords.length;
    /* Motivtöne je Takt nach Schritt, für schnellen Zugriff */
    s.at = s.motif.map(b => { const m = new Map(); for (const n of b) m.set(n[0], n); return m; });
  }
  for (const L of th.layers) {
    if (Array.isArray(L.pat)) L.pp = L.pat.map(musPat); else if (L.pat) { const p = musPat(L.pat); L.pp = [p, p, p]; }
    if (L.fill) L.fp = musPat(L.fill);
  }
  th.inst = [...new Set(th.layers.map(L => L.i))];
  th.bassI = new Set(th.layers.filter(L => L.k === 'bass').map(L => L.i));
  th.ready = true;
  return th;
}

/* ------------------------------------------------------------------ Spielen */
/* Klangkette eines Kontexts: trocken + Hall in den Ausgang */
function musChain(ctx, dest) {
  const out = ctx.createGain(), dry = ctx.createGain(), rev = ctx.createGain(), conv = ctx.createConvolver();
  /* Hall: 1,6 s Nachhall aus abklingendem Rauschen; der Hallweg ist einkanalig (vor der Stereolage), das spart die
     Hälfte der Faltung */
  const sr = ctx.sampleRate, len = Math.round(sr * 1.6), ir = ctx.createBuffer(2, len, sr);
  MUS_RND.s = 4711;
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) { const t = i / sr; d[i] = (musRnd() * 2 - 1) * Math.exp(-t / 0.45) * (t < 0.012 ? t / 0.012 : 1) * 0.55; }
  }
  conv.buffer = ir;
  rev.channelCount = 1; rev.channelCountMode = 'explicit';
  rev.gain.value = 0.55;
  dry.connect(out); rev.connect(conv); conv.connect(out); out.connect(dest);
  return { out, dry, rev };
}
/* Kanal je Instrument (einmal je Sitzung): Stereolage und Hallanteil hier statt an jedem Ton */
function musBus(S, id, d) {
  const B = S.bus || (S.bus = {});
  let b = B[id];
  if (b) return b;
  const ctx = S.ctx;
  b = ctx.createGain();
  /* Schlagwerk und Bass über den Schwellpegel (MUS.heat) */
  const to = S.perc && (d.drum || S.th.bassI.has(id)) ? S.perc : S.dry;
  if (d.pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = d.pan; b.connect(pn); pn.connect(to); }
  else b.connect(to);
  if (d.send) { const sg = ctx.createGain(); sg.gain.value = d.send; b.connect(sg); sg.connect(S.rev); }
  return (B[id] = b);
}
/* einen Ton spielen: Instrument id, MIDI m (bei Schlagwerk egal), Dauer s, Stärke v; je Ton nur Quelle + Pegel */
function musPlay(S, t, id, m, dur, v) {
  const ins = musInst(id), d = ins.d, ctx = S.ctx;
  let z = ins.zones[0];
  if (!d.drum) for (const q of ins.zones) if (Math.abs(q.m - m) < Math.abs(z.m - m)) z = q;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = musBuf(ctx, z, d.sr);
  if (!d.drum) src.playbackRate.value = Math.pow(2, (m - z.m) / 12);
  const vol = v * d.g, end = d.drum ? t + d.dur : t + Math.min(dur, d.dur / src.playbackRate.value - 0.05), rel = d.rel || 0.05;
  g.gain.setValueAtTime(vol, t);
  if (!d.drum) { g.gain.setValueAtTime(vol, end); g.gain.setTargetAtTime(0, end, rel / 3); }
  src.connect(g);
  g.connect(musBus(S, id, d));
  src.start(t);
  src.stop(d.drum ? t + d.dur : end + rel * 2 + 0.05);
}
/* eine Sitzung: ein Stück in einem Kontext, ab Zeit t0 */
function musSession(ctx, chain, name, t0) {
  const th = musPrep(MUS_THEMES[name]);
  /* eigene Pegel je Sitzung: Beim Wechsel des Stücks klingt das alte kurz aus, statt mit dem neuen zu überlappen */
  const dry = ctx.createGain(), rev = ctx.createGain(), perc = ctx.createGain();
  dry.connect(chain.dry); rev.connect(chain.rev); perc.connect(dry); perc.gain.value = 0.72;
  return { ctx, dry, rev, perc, ph: 0, th, name, next: t0, step: 0, si: 0, sb: 0, cycle: 0, var: 0, lvl: th.lvl !== undefined ? th.lvl : 0, low: 0, want: 0, done: false, prev: null };
}
/* Taktanfang: Teil weiterschalten, Stufe wählen */
function musBar(S) {
  const th = S.th;
  let sec = th.sec[th.form[S.si]];
  if (S.sb >= sec.bars) {
    S.sb = 0; S.si++;
    if (S.si >= th.form.length) { if (th.once) { S.done = true; return null; } S.si = 0; S.cycle++; }
    sec = th.sec[th.form[S.si]];
    /* Abwandlung je Durchgang: 0 wie geschrieben, 1 Melodie in anderer Lage und Farbe, 2 andere Besetzung */
    S.var = (S.cycle + S.si) % 3;
  }
  if (th.lvl === undefined) {
    const tg = S.want >= 0.75 ? 2 : S.want >= 0.35 ? 1 : 0;
    if (tg > S.lvl) { S.rise = tg === 2; S.lvl = tg; S.low = 0; }
    else if (tg < S.lvl) { S.rise = false; if (++S.low >= 3) { S.lvl--; S.low = 0; } }
    else S.low = 0;
  }
  return sec;
}
/* Schritt (Sechzehntel) zur Zeit t planen */
function musStep(S, t) {
  const th = S.th, spb = 60 / th.bpm / 4;
  let sec = th.sec[th.form[S.si]];
  if (S.step === 0) { sec = musBar(S); if (!sec) return; }
  const b = S.sb, ch = sec.chords[b], st = S.step, lv = S.lvl, last = b === sec.bars - 1, secName = th.form[S.si];
  const hum = () => (Math.random() - 0.5) * 0.008;
  for (const L of th.layers) {
    const v = L.v[lv];
    if (!v) continue;
    if (L.secs && L.secs.indexOf(secName) < 0) continue;
    if (L.vars && L.vars.indexOf(S.var) < 0) continue;
    if (L.bars && L.bars.indexOf(b) < 0) continue;
    if (L.k === 'pad') {
      if (st !== 0) continue;
      const iv = ch.iv.length > 3 ? ch.iv : ch.iv.concat([12]);
      for (let k = 0; k < iv.length; k++) musPlay(S, t, L.i, musTone(ch, k, L.lo), spb * 16 + 0.35, v * (k ? 0.8 : 1));
    } else if (L.k === 'drone') {
      if (st !== 0) continue;
      for (const m of L.notes) musPlay(S, t, L.i, m, spb * 16 + 0.4, v);
    } else if (L.k === 'hit') {
      if (st !== 0 || (b !== 0 && !S.rise)) continue;
      musPlay(S, t, L.i, L.tone ? musTone(ch, 0, L.tone) + 12 : 60, 3, v);
    } else if (L.k === 'motif') {
      const n = sec.at[b] && sec.at[b].get(st);
      if (n) musPlay(S, t, L.i, n[1] + (L.oct || 0), n[2] * spb * 0.97, v * (st % 4 === 0 ? 1 : 0.88));
    } else {
      const pp = last && L.fp ? L.fp : L.pp[lv];
      const a = pp && pp[st];
      if (!a) continue;
      if (L.k === 'drum') {
        const m = L.tone ? musTone(ch, 0, L.tone) : 60;
        musPlay(S, t + hum(), L.i, m, 0.5, v * a * (0.92 + Math.random() * 0.16));
      } else {
        /* bass, arp: Akkordtöne nach seq, je Treffer der nächste */
        const key = L.i + L.lo, cnt = (S.cnt || (S.cnt = {}))[key] = ((S.cnt[key] || 0) + 1);
        const k = L.seq[(cnt - 1) % L.seq.length];
        const dur = L.k === 'bass' ? Math.max(1, (pp.indexOf(0, st + 1) < 0 ? 16 : nextHit(pp, st)) - st) * spb * 0.95 : (L.dur || 1) * spb * 0.9;
        musPlay(S, t + (L.k === 'arp' ? hum() * 0.5 : 0), L.i, musTone(ch, k, L.lo), dur, v * a);
      }
    }
  }
  if (S.step === 0 && b === 0 && th.form[S.si] !== S.prev) S.prev = th.form[S.si];
  if (S.step === 0) S.rise = false;
}
function nextHit(pp, st) { for (let i = st + 1; i < 16; i++) if (pp[i]) return i; return 16; }
/* Schritte bis zur Zeit until planen */
function musAdvance(S, until) {
  const spb = 60 / S.th.bpm / 4;
  while (!S.done && S.next < until) {
    musStep(S, S.next);
    S.next += spb;
    if (++S.step >= 16) { S.step = 0; S.sb++; }
  }
}

/* ------------------------------------------------------------------ Steuerung aus dem Spiel */
MUS.init = function (ctx, dest) {
  if (MUS.out) return;
  const ch = musChain(ctx, dest);
  MUS.out = ch.out; MUS.dry = ch.dry; MUS.rev = ch.rev;
  MUS.out.gain.value = 0;
};
/* Instrumente eines Stücks nach und nach vorbereiten: Zone für Zone, solange das Zeitbudget (ms) reicht */
function musWarm(th, ms) {
  const t0 = performance.now();
  for (const id of th.inst) {
    let ins = MUS.bank.get(id);
    if (!ins) { ins = { id, d: MUS_INST[id], zones: [] }; MUS.bank.set(id, ins); }
    while (ins.zones.length < musZones(id)) {
      if (performance.now() - t0 > ms) return false;
      ins.zones.push(musMakeZone(id, ins.zones.length));
    }
  }
  return true;
}
MUS.tick = function () {
  const c = SND.ctx;
  if (!c || !MUS.out || c.state !== 'running') return;
  const playing = MUS.on && SND.on;
  const h = clamp(MUS.heat || 0, 0, 1);
  const target = playing ? MUS.vol * 0.55 * (1 + 0.14 * h) * MUS.duck * (typeof UI !== 'undefined' && UI.paused ? 0.35 : 1) : 0;
  MUS.out.gain.setTargetAtTime(target, c.currentTime, MUS.duck < 1 ? 0.15 : 0.6);
  const S = MUS.S;
  if (S && S.perc && Math.abs(S.ph - h) > 0.02) { S.ph = h; S.perc.gain.setTargetAtTime(0.72 + 0.48 * h, c.currentTime, 1.4); }
  if (!S || !MUS.on) return;
  if (!musWarm(S.th, 6)) return;
  if (S.next < c.currentTime) S.next = c.currentTime + 0.06;
  S.want = MUS.want;
  musAdvance(S, c.currentTime + 0.35);
  if (S.done) { MUS.S = null; if (S.th.once) MUS.on = false; }
};
/* laufendes Stück ausblenden (die schon geplanten Töne verklingen leise) */
function musFade(S) {
  if (!S) return;
  const t = S.ctx.currentTime;
  try { S.dry.gain.setTargetAtTime(0, t, 0.12); S.rev.gain.setTargetAtTime(0, t + 0.3, 0.4); } catch (e) { /* egal */ }
  S.done = true;
}
/* now: Instrumente sofort berechnen (beim Laden eines Gefechts, wenn ohnehin der Hinweis »lädt« steht) */
MUS.start = function (name, now) {
  if (!MUS_THEMES[name]) name = 'alliance';
  if (MUS.on && MUS.name === name && MUS.S) return;
  musFade(MUS.S);
  MUS.name = name; MUS.on = true; MUS.want = 0; MUS.heat = 0;
  const c = SND.ctx;
  MUS.S = c && MUS.out ? musSession(c, { dry: MUS.dry, rev: MUS.rev }, name, c.currentTime + 0.1) : null;
  if (now && MUS.S) musWarm(MUS.S.th, 1e9);
};
/* Sieg/Niederlage: das laufende Stück klingt aus, das kurze Stück folgt */
MUS.sting = function (kind) {
  const c = SND.ctx;
  musFade(MUS.S);
  MUS.name = kind; MUS.on = true;
  MUS.S = c && MUS.out ? musSession(c, { dry: MUS.dry, rev: MUS.rev }, kind, c.currentTime + 0.25) : null;
};
MUS.stop = function () { musFade(MUS.S); MUS.on = false; MUS.S = null; MUS.name = ''; };
MUS.setVol = function (v) { MUS.vol = clamp(v, 0, 1); };
/* Sitzung nachholen, wenn der Klang erst nach MUS.start freigegeben wurde (erste Berührung) */
MUS.resume = function () { if (MUS.on && !MUS.S && MUS.name && SND.ctx && MUS.out) MUS.S = musSession(SND.ctx, { dry: MUS.dry, rev: MUS.rev }, MUS.name, SND.ctx.currentTime + 0.1); };

/* ------------------------------------------------------------------ Prüfung und Hörprobe
   plan: [[Sekunde, want], …]; liefert ein AudioBuffer (Stereo, sr) */
MUS.render = function (name, plan, seconds, sr) {
  const ctx = new OfflineAudioContext(2, Math.round(seconds * sr), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  const ch = musChain(ctx, comp);
  ch.out.gain.value = 0.55;
  const S = musSession(ctx, ch, name, 0.05), spb = 60 / S.th.bpm / 4;
  for (const id of S.th.inst) musInst(id);
  /* wie im Spiel nur knapp voraus planen: alle halbe Sekunde anhalten, die nächsten Töne anlegen, weiter */
  let i = 0;
  const plan2 = until => {
    while (!S.done && S.next < Math.min(until, seconds - 0.2)) {
      while (i + 1 < plan.length && plan[i + 1][0] <= S.next) i++;
      S.want = plan.length ? plan[i][1] : 0;
      musAdvance(S, S.next + spb * 0.5);
    }
  };
  plan2(0.6);
  for (let t = 0.5; t < seconds - 0.1; t += 0.5) ctx.suspend(t).then(() => { plan2(t + 0.6); ctx.resume(); });
  return ctx.startRendering();
};

