/* ===== render.js ===== */
'use strict';
/* =====================================================================
   DARSTELLUNG – Kamera, Sterne mit Parallaxe, Aschenebel, Felder, Felsen, Vorkommen, Stationen, Schiffe, Strahlen,
   Geschosse, Effekte, Nebel des Krieges, Auswahl, Minikarte. Liest nur den Spielzustand, schreibt ihn nie.
   ===================================================================== */
const FONT = '"Barlow Condensed","DIN Alternate",Bahnschrift,"Roboto Condensed","Arial Narrow",sans-serif';
const R = {
  cv: null, ctx: null, mini: null, mctx: null, dpr: 1, W: 0, H: 0, cssW: 0, cssH: 0, cam: { x: 0, y: 0, z: 1 }, g: null, vp: -1,
  time: 0, dt: 0, frameN: 0, padB: 0, padT: 0, qScale: 1, detail: 2, shake: 0, pings: [], hover: 0, stars: null, bg: null, bgKey: '',
  fogCv: null, fogCtx: null, fogImg: null, fogT: 0, miniBase: null, lastAct: null, sprites: new Map(), hot: []
};
R.init = function (cv, mini, cv3) { R.cv = cv; R.ctx = cv.getContext('2d', { alpha: true }); R.mini = mini; R.mctx = mini.getContext('2d'); R.cv3 = cv3 || null; R.mode3d = false; };
/* Darstellung umschalten: '3d' nutzt den 3D-Renderer (render3d.js, window.RA3D) für die Welt, die 2D-Leinwand zeichnet nur noch
   Überlagerungen; '2d' ist die klassische Zeichnung. Liefert den tatsächlich aktiven Modus. */
R.setMode = function (m) {
  const want = m === '3d' && R.cv3 && typeof RA3D !== 'undefined' && RA3D.supported();
  if (want && !R.ok3d) { try { R.ok3d = !!RA3D.init(R.cv3); } catch (e) { R.ok3d = false; } }
  R.mode3d = !!(want && R.ok3d);
  if (R.cv3) R.cv3.hidden = !R.mode3d;
  /* Vignette im 3D-Modus als CSS-Hintergrund der durchsichtigen 2D-Leinwand (kostet keine Zeichenarbeit je Bild) */
  R.cv.style.background = R.mode3d ? 'radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0,2,10,0) 45%, rgba(0,2,10,0.42) 100%)' : '';
  R.vbKey = ''; R.c3x = NaN;
  FX.mute = R.mode3d;
  if (R.mode3d && R.g) { RA3D.setDetail(R.detail); RA3D.setGame(R.g, R.vp); }
  R.bg = null; R.bgKey = '';
  return R.mode3d ? '3d' : '2d';
};
function pcol(o) { const p = R.g && R.g.players[o]; return p ? (p.color || p.F.team) : '#d8d0bd'; }
function isFoeV(o) { const g = R.g; return R.vp >= 0 && o >= 0 && g.tm[o] !== g.tm[R.vp]; }
R.setGame = function (g, vp) {
  R.g = g; R.vp = vp; R.pings.length = 0; R.hot.length = 0; FX.list.length = 0; R.shake = 0; R.lastAct = null;
  R.fogCv = document.createElement('canvas'); R.fogCv.width = g.vw; R.fogCv.height = g.vh; R.fogCtx = R.fogCv.getContext('2d');
  R.fogImg = R.fogCtx.createImageData(g.vw, g.vh); R.fogT = -1;
  R.miniBase = null; R.sprites.clear();
  R.clampCam();
  if (R.mode3d) { RA3D.setDetail(R.detail); RA3D.setGame(g, vp); }
};
R.resize = function () {
  const cv = R.cv, r = cv.getBoundingClientRect();
  const dp = Math.min(window.devicePixelRatio || 1, 2);
  /* 2D: Auflösung nach Qualität; 3D: die 2D-Leinwand trägt nur Texte und Balken (volle Schärfe, höchstens DPR 2), die
     WebGL-Auflösung regelt der 3D-Renderer selbst nach der Bildzeit (ohne R.qScale) */
  R.dpr = R.mode3d ? dp : (typeof UI !== 'undefined' && UI.attract ? Math.min(dp, 1) : dp) * R.qScale;
  R.cssW = Math.max(50, r.width); R.cssH = Math.max(50, r.height);
  R.W = cv.width = Math.round(R.cssW * R.dpr); R.H = cv.height = Math.round(R.cssH * R.dpr);
  const mr = R.mini.getBoundingClientRect(), md = Math.min(window.devicePixelRatio || 1, 2);
  if (mr.width > 0) { R.mini.width = Math.round(mr.width * md); R.mini.height = Math.round(mr.height * md); }
  R.bg = null; R.bgKey = '';
  if (R.mode3d) { RA3D.resize(R.cssW, R.cssH, window.devicePixelRatio || 1); R.vbKey = ''; }
  R.clampCam();
};
R.clampCam = function () {
  const g = R.g, cam = R.cam;
  if (!g) return;
  const ew = g.map.w, eh = g.map.h, minZ = Math.max(0.22, Math.min(R.cssW / ew, R.cssH / eh) * (R.mode3d ? 1.5 : 0.95));
  cam.z = clamp(cam.z, minZ, 2.4);
  const vw = R.cssW / cam.z, vh = R.cssH / cam.z, pad = 120 / cam.z, pb = R.padB / cam.z, pt = R.padT / cam.z;
  cam.x = vw >= ew + pad * 2 ? (ew - vw) / 2 : clamp(cam.x, -pad, ew - vw + pad);
  cam.y = vh >= eh + pad * 2 + pb + pt ? (eh - vh) / 2 : clamp(cam.y, -pad - pt, eh - vh + pad + pb);
};
R.center = function (x, y) { R.cam.x = x - R.cssW / R.cam.z / 2; R.cam.y = y - (R.cssH - R.padB * 0.5 + R.padT * 0.5) / R.cam.z / 2; R.clampCam(); };
R.s2w = function (sx, sy) { if (R.mode3d) { R.cam3(); const w = RA3D.unproject(sx, sy); if (w) return w; } return { x: R.cam.x + sx / R.cam.z, y: R.cam.y + sy / R.cam.z }; };
R.w2s = function (x, y) { if (R.mode3d) { R.cam3(); const q = RA3D.project(x, y); if (q) return q; } return { x: (x - R.cam.x) * R.cam.z, y: (y - R.cam.y) * R.cam.z, s: R.cam.z }; };
/* 3D-Kamera aus der 2D-Kamera ableiten: Weltpunkt in der Bildschirmmitte und Zoom */
R.cam3 = function () {
  const cam = R.cam, cx = cam.x + R.cssW / cam.z / 2, cy = cam.y + (R.cssH - R.padB * 0.5 + R.padT * 0.5) / cam.z / 2;
  if (cx === R.c3x && cy === R.c3y && cam.z === R.c3z && R.cssW === R.c3w && R.cssH === R.c3h) return false;
  R.c3x = cx; R.c3y = cy; R.c3z = cam.z; R.c3w = R.cssW; R.c3h = R.cssH;
  RA3D.setCam(cx, cy, cam.z, R.cssW, R.cssH, R.dpr); return true;
};
R.zoomAt = function (sx, sy, f) { const cam = R.cam, X = cam.x + sx / cam.z, Y = cam.y + sy / cam.z; cam.z = clamp(cam.z * f, 0.2, 2.4); cam.x = X - sx / cam.z; cam.y = Y - sy / cam.z; R.clampCam(); };
R.seen = function (x, y) { const g = R.g; if (R.vp < 0) return true; const p = g.players[R.vp]; return !!p.explored[clamp((y / VIS) | 0, 0, g.vh - 1) * g.vw + clamp((x / VIS) | 0, 0, g.vw - 1)]; };
R.visible = function (e) { return R.vp < 0 || canSee(R.g, R.vp, e); };
R.inView = function (x, y, m) { m = m || 0; if (R.mode3d && R.vb) { const b = R.vb; return x + m >= b.x0 && x - m <= b.x1 && y + m >= b.y0 && y - m <= b.y1; } const cam = R.cam; return x + m >= cam.x && x - m <= cam.x + R.cssW / cam.z && y + m >= cam.y && y - m <= cam.y + R.cssH / cam.z; };
R.ping = function (x, y, col) { if (R.pings.length < 12) R.pings.push({ x, y, t: 0, col: col || '#ff5b47' }); };

/* ------------------------------------------------------------------ Hintergrund
   Rauschen (periodisch, kachelt nahtlos) für Nebel, Monde, Asteroiden und den Gasriesen. Nur Darstellung. */
function noiseTile(size, seed, oct, base) {
  const rng = makeRng(seed), out = new Float32Array(size * size);
  let amp = 1, per = base || 8, total = 0;
  for (let o = 0; o < oct; o++) {
    const lat = new Float32Array(per * per);
    for (let i = 0; i < lat.length; i++) lat[i] = rng();
    const cell = size / per;
    for (let y = 0; y < size; y++) {
      const fy = y / cell, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % per;
      for (let x = 0; x < size; x++) {
        const fx = x / cell, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % per;
        const a = lat[y0 * per + x0], b = lat[y0 * per + x1], c = lat[y1 * per + x0], d = lat[y1 * per + x1];
        out[y * size + x] += ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy) * amp;
      }
    }
    total += amp; amp *= 0.5; per *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
/* Graues Rauschen als Bild (für Oberflächen über »overlay«) */
function noiseCanvas(size, seed) {
  const key = 'noise|' + size + '|' + seed;
  let c = R.sprites.get(key);
  if (c) return c;
  const n = noiseTile(size, seed, 4, 6);
  c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let i = 0; i < n.length; i++) { const v = Math.round(n[i] * 255); d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  R.sprites.set(key, c);
  return c;
}
const NEBULA_PAL = {
  haven: [[110, 70, 200], [40, 150, 175], [200, 110, 70]],
  ashfall: [[180, 70, 50], [120, 60, 170], [50, 110, 170]],
  test: [[70, 90, 190], [40, 150, 160], [160, 90, 160]]
};
function starTile(seed, n, maxR, bright) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'), rng = makeRng(seed), list = [];
  for (let i = 0; i < n; i++) {
    const x = rng() * 512, y = rng() * 512, r = 0.4 + rng() * maxR, b = 0.35 + rng() * 0.65, t = rng();
    const col = t < 0.1 ? '170,200,255' : t < 0.18 ? '255,220,180' : t < 0.22 ? '255,180,160' : '255,255,255';
    ctx.fillStyle = 'rgba(' + col + ',' + b + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (bright && r > maxR * 0.8) {
      /* heller Stern: Hof und Beugungsstrahlen */
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      gr.addColorStop(0, 'rgba(' + col + ',0.45)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',0.28)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - r * 4.5, y); ctx.lineTo(x + r * 4.5, y); ctx.moveTo(x, y - r * 4.5); ctx.lineTo(x, y + r * 4.5); ctx.stroke();
      list.push({ x, y, r, col, ph: rng() * TAU });
    }
  }
  c._list = list;
  return c;
}
/* Nebel: drei Farbschichten aus Rauschen, dazu helle Kerne – kachelt nahtlos (periodisches Rauschen) */
function nebulaTile(mapId) {
  const size = 768, pal = NEBULA_PAL[mapId] || NEBULA_PAL.haven;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const n1 = noiseTile(size, 101, 5, 3), n2 = noiseTile(size, 202, 5, 4), n3 = noiseTile(size, 303, 4, 5);
  for (let i = 0; i < size * size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    const add = (col, v, str) => { if (v <= 0) return; const w = Math.min(1, v) * str; r += col[0] * w; g += col[1] * w; b += col[2] * w; a += w; };
    const v1 = (n1[i] - 0.4) * 2.2, v2 = (n2[i] - 0.48) * 2.6, v3 = 1 - Math.abs(n3[i] - 0.5) * 5;
    add(pal[0], v1 * v1 * (v1 > 0 ? 1 : 0), 0.42);
    add(pal[1], v2 * v2 * (v2 > 0 ? 1 : 0), 0.34);
    add(pal[2], v3 * v3 * v3 * (v3 > 0 ? 1 : 0) * Math.max(0, n1[i] - 0.4) * 2, 0.22);
    const o = i * 4;
    if (a > 0) { d[o] = Math.min(255, r / a + 40 * a); d[o + 1] = Math.min(255, g / a + 40 * a); d[o + 2] = Math.min(255, b / a + 40 * a); d[o + 3] = Math.min(255, a * 255); }
  }
  x.putImageData(img, 0, 0);
  return c;
}
/* Gasriese im fernen Hintergrund: Bänder aus Rauschen, Licht von links oben, Ring */
function planetSprite(seed) {
  const key = 'planet|' + seed;
  let c = R.sprites.get(key);
  if (c) return c;
  const S = 520, pr = 170;
  c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'), rng = makeRng(seed), cx = S / 2, cy = S / 2;
  const cols = seed % 2 ? [[210, 150, 90], [150, 90, 60], [240, 200, 150], [110, 70, 60]] : [[120, 150, 200], [70, 90, 150], [190, 210, 230], [60, 70, 110]];
  /* Ring hinten */
  const ring = (front) => { x.save(); x.translate(cx, cy); x.scale(1, 0.28); x.rotate(0); x.beginPath(); x.arc(0, 0, pr * 2.1, front ? 0 : Math.PI, front ? Math.PI : TAU); x.arc(0, 0, pr * 1.35, front ? Math.PI : TAU, front ? 0 : Math.PI, true); x.closePath(); const g = x.createRadialGradient(0, 0, pr * 1.35, 0, 0, pr * 2.1); g.addColorStop(0, 'rgba(220,210,190,0.55)'); g.addColorStop(0.3, 'rgba(180,170,150,0.25)'); g.addColorStop(0.5, 'rgba(230,220,200,0.6)'); g.addColorStop(0.8, 'rgba(160,150,140,0.3)'); g.addColorStop(1, 'rgba(200,190,170,0)'); x.fillStyle = g; x.fill(); x.restore(); };
  ring(false);
  x.save(); x.beginPath(); x.arc(cx, cy, pr, 0, TAU); x.clip();
  x.fillStyle = 'rgb(' + cols[1].join(',') + ')'; x.fillRect(0, 0, S, S);
  const n = noiseTile(256, seed * 7 + 1, 4, 4);
  for (let yy = -pr; yy < pr; yy += 2) {
    const lat = yy / pr, w = Math.sqrt(1 - lat * lat) * pr, v = n[(((yy + pr) / (pr * 2) * 255) | 0) * 256 + 60] , v2 = n[(((yy + pr) / (pr * 2) * 255) | 0) * 256 + 180];
    const t = Math.max(0, Math.min(1, (v - 0.35) * 2)), ca = cols[0], cb = cols[2];
    const rr = ca[0] + (cb[0] - ca[0]) * t, gg = ca[1] + (cb[1] - ca[1]) * t, bb = ca[2] + (cb[2] - ca[2]) * t;
    x.fillStyle = 'rgba(' + (rr | 0) + ',' + (gg | 0) + ',' + (bb | 0) + ',' + (0.5 + v2 * 0.5) + ')';
    x.fillRect(cx - w, cy + yy, w * 2, 2.2);
  }
  /* Wirbel */
  for (let i = 0; i < 4; i++) { const ox = (rng() - 0.5) * pr * 1.2, oy = (rng() - 0.5) * pr * 1.2, rr = pr * (0.08 + rng() * 0.1); x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx + ox, cy + oy, rr * 2, rr * 0.8, 0, 0, TAU); x.stroke(); }
  /* Beleuchtung und Tag-Nacht-Grenze */
  const lg = x.createRadialGradient(cx - pr * 0.5, cy - pr * 0.5, pr * 0.1, cx, cy, pr * 1.05);
  lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(0.45, 'rgba(255,255,255,0)'); lg.addColorStop(0.75, 'rgba(0,0,20,0.45)'); lg.addColorStop(1, 'rgba(0,0,20,0.92)');
  x.fillStyle = lg; x.fillRect(0, 0, S, S);
  x.restore();
  /* Atmosphärensaum */
  x.strokeStyle = 'rgba(' + cols[2].join(',') + ',0.5)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, pr + 1, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  ring(true);
  R.sprites.set(key, c);
  return c;
}
function makeStars() {
  const id = R.g && R.g.map ? R.g.map.id : 'haven';
  R.nebula = nebulaTile(id); R.nebulaId = id;
  R.stars = [[starTile(11, 90, 0.7), 0.1], [starTile(23, 30, 1.0), 0.26], [starTile(37, 8, 1.4, true), 0.5]];
  R.planet = planetSprite(id === 'ashfall' ? 3 : 2);
}
/* Vignette: dunkle Ecken – gibt dem Bild Tiefe und lenkt den Blick zur Mitte */
function drawVignette(ctx) {
  const key = R.W + 'x' + R.H;
  if (!R.vig || R.vigKey !== key) {
    const c = document.createElement('canvas'); c.width = R.W; c.height = R.H;
    const x = c.getContext('2d'), gr = x.createRadialGradient(R.W / 2, R.H / 2, Math.min(R.W, R.H) * 0.35, R.W / 2, R.H / 2, Math.max(R.W, R.H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,2,10,0.42)');
    x.fillStyle = gr; x.fillRect(0, 0, R.W, R.H);
    R.vig = c; R.vigKey = key;
  }
  ctx.drawImage(R.vig, 0, 0);
}
/* Der ganze Hintergrund (Verlauf, Nebel, Gasriese, Sterne) wird nur neu gezeichnet, wenn sich die Kamera bewegt hat;
   sonst kommt er aus dem Zwischenspeicher. Der Nebel entsteht in halber Auflösung, das sieht man bei weichen Schwaden
   nicht, spart aber die Hälfte der Füllarbeit. */
function drawBackground(ctx) {
  const cam = R.cam, s = R.dpr, z = cam.z;
  if (!R.stars || (R.g && R.g.map && R.nebulaId !== R.g.map.id)) makeStars();
  const key = R.W + 'x' + R.H + '|' + cam.x.toFixed(1) + '|' + cam.y.toFixed(1) + '|' + z.toFixed(4) + '|' + R.detail;
  if (R.bgKey !== key) {
    R.bgKey = key;
    if (!R.bgCv || R.bgCv.width !== R.W || R.bgCv.height !== R.H) { R.bgCv = document.createElement('canvas'); R.bgCv.width = R.W; R.bgCv.height = R.H; R.bgCtx = R.bgCv.getContext('2d', { alpha: false }); R.nebCv = document.createElement('canvas'); R.nebCv.width = Math.ceil(R.W / 2); R.nebCv.height = Math.ceil(R.H / 2); R.nebCtx = R.nebCv.getContext('2d'); }
    const x = R.bgCtx, gr = x.createLinearGradient(0, 0, R.W, R.H);
    gr.addColorStop(0, '#030409'); gr.addColorStop(0.5, '#020308'); gr.addColorStop(1, '#040308');
    x.fillStyle = gr; x.fillRect(0, 0, R.W, R.H);
    /* Nebel in halber Auflösung: zwei Lagen derselben Kachel, verschieden schnell und gespiegelt → wirkt tiefer */
    const nx = R.nebCtx, hw = R.nebCv.width, hh = R.nebCv.height;
    nx.clearRect(0, 0, hw, hh);
    for (const [f, al, flip] of (R.detail > 1 ? [[0.05, 0.3, false], [0.09, 0.2, true]] : [[0.06, 0.35, false]])) {
      const T = 384, ox = ((-cam.x * f * z * s / 2) % T + T) % T, oy = ((-cam.y * f * z * s / 2) % T + T) % T;
      nx.save(); nx.globalAlpha = al; if (flip) { nx.translate(hw, 0); nx.scale(-1, 1); } nx.translate(ox - T, oy - T); nx.scale(0.5, 0.5); nx.fillStyle = nx.createPattern(R.nebula, 'repeat'); nx.fillRect(0, 0, (hw + T) * 2, (hh + T) * 2); nx.restore();
    }
    x.drawImage(R.nebCv, 0, 0, hw, hh, 0, 0, R.W, R.H);
    /* Gasriese, weit hinten */
    if (R.planet && R.g) { const f = 0.14, m = R.g.map, px = (m.w * 0.82 - cam.x) * f * z * s + R.W * 0.55, py = (m.h * 0.15 - cam.y) * f * z * s + R.H * 0.1, sz = 420 * s * Math.sqrt(z); x.globalAlpha = 0.9; x.drawImage(R.planet, px - sz / 2, py - sz / 2, sz, sz); x.globalAlpha = 1; }
    for (const [tile, f] of R.stars) {
      const ox = ((-cam.x * f * z * s) % 512 + 512) % 512, oy = ((-cam.y * f * z * s) % 512 + 512) % 512;
      x.save(); x.translate(ox - 512, oy - 512); x.fillStyle = x.createPattern(tile, 'repeat'); x.fillRect(0, 0, R.W + 512, R.H + 512); x.restore();
    }
  }
  ctx.drawImage(R.bgCv, 0, 0);
  /* Funkeln der hellen Sterne – abgeschaltet: der Raum soll ruhig und dunkel sein wie in Armada 2 */
  if (false) {
    const [tile, f] = R.stars[2], ox = ((-cam.x * f * z * s) % 512 + 512) % 512, oy = ((-cam.y * f * z * s) % 512 + 512) % 512;
    ctx.globalCompositeOperation = 'lighter';
    for (const st of tile._list) {
      const a = 0.25 + 0.35 * Math.sin(R.time * (2 + st.r) + st.ph);
      if (a <= 0.3) continue;
      for (let tx = ox - 512 + st.x; tx < R.W + 20; tx += 512) for (let ty = oy - 512 + st.y; ty < R.H + 20; ty += 512) { if (tx < -20 || ty < -20) continue; glowAt(ctx, tx, ty, st.r * 7, 'rgb(' + st.col + ')', a); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
/* Aschenebel am Rand: Verlauf nach innen, mit Schlieren */
function drawAsh(ctx) {
  const m = R.g.map, cam = R.cam, vw = R.cssW / cam.z, vh = R.cssH / cam.z, out = 400, t = R.time;
  const band = (x0, y0, x1, y1, gx0, gy0, gx1, gy1) => {
    const gr = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, 'rgba(120,40,20,0.0)'); gr.addColorStop(0.5, 'rgba(140,50,24,0.35)'); gr.addColorStop(1, 'rgba(60,20,12,0.85)');
    ctx.fillStyle = gr; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  if (cam.x < EDGE) band(-out, -out, EDGE, m.h + out, EDGE, 0, -out, 0);
  if (cam.x + vw > m.w - EDGE) band(m.w - EDGE, -out, m.w + out, m.h + out, m.w - EDGE, 0, m.w + out, 0);
  if (cam.y < EDGE) band(-out, -out, m.w + out, EDGE, 0, EDGE, 0, -out);
  if (cam.y + vh > m.h - EDGE) band(-out, m.h - EDGE, m.w + out, m.h + out, 0, m.h - EDGE, 0, m.h + out);
  /* Schlieren: wandernde Bögen entlang des Randes */
  ctx.strokeStyle = 'rgba(255,120,60,0.08)'; ctx.lineWidth = 18;
  for (let i = 0; i < 6; i++) {
    const ph = t * 0.15 + i * 1.1, y = ((ph * 120) % (m.h + 200)) - 100;
    if (cam.x < EDGE) { ctx.beginPath(); ctx.moveTo(-40, y - 60); ctx.quadraticCurveTo(EDGE * 0.7, y, -40, y + 60); ctx.stroke(); }
    if (cam.x + vw > m.w - EDGE) { ctx.beginPath(); ctx.moveTo(m.w + 40, y - 60); ctx.quadraticCurveTo(m.w - EDGE * 0.7, y, m.w + 40, y + 60); ctx.stroke(); }
    const x = ((ph * 140) % (m.w + 200)) - 100;
    if (cam.y < EDGE) { ctx.beginPath(); ctx.moveTo(x - 60, -40); ctx.quadraticCurveTo(x, EDGE * 0.7, x + 60, -40); ctx.stroke(); }
    if (cam.y + vh > m.h - EDGE) { ctx.beginPath(); ctx.moveTo(x - 60, m.h + 40); ctx.quadraticCurveTo(x, m.h - EDGE * 0.7, x + 60, m.h + 40); ctx.stroke(); }
  }
}
/* Felsen, Vorkommen: Bildspeicher je Objekt (Form aus dem Startwert), beleuchtet von oben links, mit Oberfläche
   aus Rauschen, Kratern (dunkle Innenseite oben links, helle Kante unten rechts) und Tag-Nacht-Grenze */
function rockSprite(o, kind) {
  const sd = (o.seed | 0) || (((o.x * 31 + o.y * 17) | 0) & 0xffff), key = kind + '|' + Math.round(o.r) + '|' + sd;
  let c = R.sprites.get(key);
  if (c) return c;
  const r = o.r, s = 2, size = Math.ceil(r * 2.5 * s);
  c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), rng = makeRng(sd + 7), noise = noiseCanvas(256, 9);
  ctx.translate(size / 2, size / 2); ctx.scale(s, s);
  const crater = (x, y, cr, dark, lite) => {
    ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fillStyle = dark; ctx.fill();
    ctx.beginPath(); ctx.arc(x + cr * 0.22, y + cr * 0.22, cr * 0.8, 0, TAU); ctx.fillStyle = lite; ctx.fill();
    ctx.beginPath(); ctx.arc(x - cr * 0.1, y - cr * 0.1, cr * 0.55, 0, TAU); ctx.fillStyle = dark; ctx.fill();
  };
  if (kind === 'ice') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r);
    gr.addColorStop(0, '#f2fbff'); gr.addColorStop(0.5, '#a9d6f0'); gr.addColorStop(1, '#4b7fa8');
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.55; ctx.drawImage(noise, -r, -r, r * 2, r * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 8; i++) { const a = rng() * TAU, d = rng() * r * 0.75, cr = r * (0.05 + rng() * 0.11); crater(Math.cos(a) * d, Math.sin(a) * d, cr, 'rgba(30,70,110,0.4)', 'rgba(255,255,255,0.35)'); }
    /* Risse im Eis */
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { const a = rng() * TAU, d = rng() * r * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); for (let k = 0; k < 4; k++) { const a2 = a + (rng() - 0.5) * 1.5, l = r * 0.15; ctx.lineTo(Math.cos(a) * d + Math.cos(a2) * l * (k + 1), Math.sin(a) * d + Math.sin(a2) * l * (k + 1)); } ctx.stroke(); }
    /* Tag-Nacht-Grenze */
    const tg = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.3, 0, 0, r * 1.05);
    tg.addColorStop(0, 'rgba(0,10,30,0)'); tg.addColorStop(0.72, 'rgba(0,10,30,0.08)'); tg.addColorStop(1, 'rgba(0,8,25,0.8)');
    ctx.fillStyle = tg; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    /* dünner Lichtsaum auf der beleuchteten Seite, Glanzpunkt */
    ctx.strokeStyle = 'rgba(200,240,255,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.85, Math.PI * 1.8); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,40,70,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    const sp = ctx.createRadialGradient(-r * 0.4, -r * 0.42, 0, -r * 0.4, -r * 0.42, r * 0.3);
    sp.addColorStop(0, 'rgba(255,255,255,0.45)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.fillRect(-r, -r, r * 2, r * 2);
  } else {
    const ore = kind === 'ore', base = ore ? ['#a07a46', '#6a4b2a', '#2e2015'] : ['#7a736c', '#4a443f', '#1f1c1a'];
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.76 + rng() * 0.32); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
    gr.addColorStop(0, base[0]); gr.addColorStop(0.65, base[1]); gr.addColorStop(1, base[2]);
    ctx.fillStyle = gr; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.8; ctx.drawImage(noise, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) { const a = rng() * TAU, d = rng() * r * 0.6, cr = r * (0.07 + rng() * 0.13); crater(Math.cos(a) * d, Math.sin(a) * d, cr, 'rgba(0,0,0,0.32)', 'rgba(255,240,220,0.18)'); }
    if (ore) for (let i = 0; i < 6; i++) { const a = rng() * TAU, d = rng() * r * 0.7, x = Math.cos(a) * d, y = Math.sin(a) * d; ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 0.22); g2.addColorStop(0, 'rgba(255,200,110,0.9)'); g2.addColorStop(0.4, 'rgba(255,150,60,0.35)'); g2.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g2; ctx.fillRect(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffe2a8'; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
    const tg = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(0.7, 'rgba(0,0,0,0.1)'); tg.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = tg; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    ctx.restore();
    ctx.strokeStyle = ore ? '#2a1d10' : '#141210'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,230,0.35)'; ctx.lineWidth = 1; ctx.save(); ctx.clip(); ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = r * 0.99; if (Math.cos(a - Math.PI * 1.25) > 0.2) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke(); ctx.restore();
  }
  c._s = s;
  R.sprites.set(key, c);
  return c;
}
function drawRock(ctx, o, kind, alpha) {
  const c = rockSprite(o, kind), w = c.width / c._s;
  if (R.detail > 1 && R.cam.z > 0.35) glowAt(ctx, o.x + o.r * 0.12, o.y + o.r * 0.16, o.r * 1.45, '#000000', 0.45);
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0);
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(c, -w / 2, -w / 2, w, w);
  ctx.restore();
}
/* ------------------------------------------------------------------ Nebel des Krieges */
function fogUpdate() {
  const g = R.g, p = g.players[R.vp], img = R.fogImg, d = img.data, n = g.vw * g.vh, st = g.visStamp, vis = p.vis, ex = p.explored;
  for (let i = 0; i < n; i++) { const o = i * 4; d[o] = 2; d[o + 1] = 3; d[o + 2] = 8; d[o + 3] = vis[i] === st ? 0 : ex[i] ? 120 : 235; }
  R.fogCtx.putImageData(img, 0, 0);
}
/* ------------------------------------------------------------------ Ereignisse der Simulation → Effekte */
R.wantSalvage = function () { if (typeof UI === 'undefined' || !UI.sel || !UI.g) return false; for (const id of UI.sel) { const u = UI.g.byId.get(id); if (u && !u.dead && u.def.cargo) return true; } return false; };
R.consume = function (evs) {
  const g = R.g;
  for (const e of evs) {
    if (R.mode3d && e.x !== undefined && (R.vp < 0 || visAt(g, R.vp, e.x, e.y) || e.t === 'bdie' || e.t === 'strike' || e.t === 'superfire' || e.t === 'gateLance' || e.t === 'gateStorm' || e.t === 'wake' || e.t === 'breach' || e.t === 'gateDark' || e.t === 'gateOn')) { try { RA3D.event(e, g); } catch (err) { /* Effekt fehlt */ } }
    if (e.x !== undefined && R.vp >= 0 && !visAt(g, R.vp, e.x, e.y) && e.t !== 'bdie' && e.t !== 'attack' && e.t !== 'strike' && e.t !== 'superfire' && e.t !== 'supercharged' && !(e.t === 'captured' && (e.from === R.vp || e.to === R.vp)) && e.t !== 'gateLance' && e.t !== 'gateStorm' && e.t !== 'wake' && e.t !== 'siteWon' && e.t !== 'fortFall' && e.t !== 'gateOn' && e.t !== 'breach' && e.t !== 'gateDark') continue;
    switch (e.t) {
      case 'die': if (!e.quiet) { fxExplode(e.x, e.y, e.r, e.big, pcol(e.owner)); if (e.big && R.detail > 0 && SHIPS[e.type] && !SHIPS[e.type].swarm) { const s = sprScale(), sc = shipSprite(e.type, SHIPS[e.type].f, 'wreck', s); fxHulk(e.x, e.y, e.ang || 0, sc, sc.width / s, e.vx, e.vy); } if (e.big && R.inView(e.x, e.y, 300)) R.shake = Math.max(R.shake, 6); } R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'bdie': fxExplode(e.x, e.y, e.r * 0.8, true, pcol(e.owner)); fxSmoke(e.x, e.y, 14, e.r, 2.5); for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, d = e.r * (0.3 + Math.random() * 0.5); fxLater(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, e.r * (0.35 + 0.15 * i), 0.22 + i * 0.28, i === 2); } if (R.inView(e.x, e.y, 400)) R.shake = Math.max(R.shake, 9); R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'hit':
        if (e.kind === 'torp') fxExplode(e.x, e.y, 10, false, '#ffb060');
        else if (e.kind === 'torpdie') { fxFlash(e.x, e.y, 10, 0.25, '#ffd080'); fxSpark(e.x, e.y, 5, 80, '#ffd27a', 0.3); }
        else if (e.kind === 'rock') fxSpark(e.x, e.y, 4, 60, '#c9b9a0', 0.3);
        else if (e.kind === 'rail') { fxFlash(e.x, e.y, 9, 0.2, '#dff4ff'); fxSpark(e.x, e.y, 8, 140, '#bfe9ff', 0.4); }
        else if (e.kind === 'acid') { fxSpark(e.x, e.y, 5, 50, '#b4ff3c', 0.5); fxFlash(e.x, e.y, 7, 0.15, '#d6ff6a'); }
        else if (e.kind === 'bite') { fxSpark(e.x, e.y, 4, 60, '#ff6a8a', 0.35); }
        else fxSpark(e.x, e.y, 3, 70, '#ffd27a', 0.3);
        break;
      case 'shield': fxShield(e.x, e.y, e.r, e.ang, g.players[e.owner].faction === 'alliance' ? '#8fe3ff' : '#ffd27a'); break;
      case 'shdown': fxRing(e.x, e.y, e.r * 1.4, 0.5, '#8fe3ff', 2); break;
      case 'shot': if (e.kind === 'rail') { fxFlash(e.x, e.y, 10, 0.15, '#dff4ff'); } else if (e.kind === 'kin' && e.big) fxFlash(e.x + Math.cos(e.ang) * 10, e.y + Math.sin(e.ang) * 10, 5, 0.1, '#ffe0a0'); R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'pd': fxLine(e.x, e.y, e.tx, e.ty, 0.12, 'rgba(255,230,140,0.9)', 1); break;
      case 'built': fxRing(e.x, e.y, 60, 0.8, pcol(e.owner), 2); break;
      case 'upgrade': fxRing(e.x, e.y, 70, 1, '#ffffff', 2); fxText(e.x, e.y - 40, L('Stufe {0}', ROMAN[e.lv]), '#ffffff'); break;
      case 'rank': fxText(e.x, e.y - 20, L(RANK_NAMES[e.rank]), '#ffd27a'); break;
      case 'deliver': if (R.detail > 1 && R.cam.z > 0.5) fxText(e.x + (Math.random() - 0.5) * 30, e.y - 30, '+' + e.amt, e.kind === 'ore' ? '#ffb86b' : '#8fe3ff'); break;
      case 'attack': if (R.vp >= 0 && e.owner === R.vp) R.ping(e.x, e.y, '#ff5b47'); break;
      case 'place': fxRing(e.x, e.y, 40, 0.5, '#ffffff', 1.5); break;
      case 'ability': { const A = ABIL[e.id]; fxRing(e.x, e.y, e.r ? Math.min(e.r, 320) : 40, e.r ? 0.9 : 0.5, '#ffb86b', 2); if (e.owner === R.vp) fxText(e.x, e.y - 34, A ? L(A.name) : e.id, '#ffb86b'); R.lastAct = { x: e.x, y: e.y, t: R.time }; break; }
      case 'abfx': fxFlash(e.x, e.y, 16, 0.2, '#dff4ff'); break;
      case 'lance': fxLine(e.x, e.y, e.tx, e.ty, 0.45, 'rgba(255,255,255,0.95)', 5); fxLine(e.x, e.y, e.tx, e.ty, 0.6, 'rgba(143,227,255,0.6)', 14); fxFlash(e.tx, e.ty, 40, 0.4, '#dff4ff'); fxSpark(e.tx, e.ty, 20, 200, '#bfe9ff', 0.6); if (R.inView(e.tx, e.ty, 300)) R.shake = Math.max(R.shake, 5); break;
      case 'board': fxLine(e.fx, e.fy, e.x, e.y, 0.5, 'rgba(255,184,107,0.8)', 2); fxSpark(e.x, e.y, 10, 60, '#ffd27a', 0.6); fxText(e.x, e.y - 24, L('+{0} Marines', Math.round(e.n)), '#ffb86b'); break;
      case 'captured': fxRing(e.x, e.y, 50, 1, pcol(e.to), 3); fxText(e.x, e.y - 30, L('Geentert'), pcol(e.to)); fxSpark(e.x, e.y, 14, 90, '#ffffff', 0.6); break;
      case 'derelict': fxSmoke(e.x, e.y, 6, 12, 2); fxSpark(e.x, e.y, 8, 50, '#ffd27a', 0.5); break;
      case 'recrew': fxRing(e.x, e.y, 30, 0.6, '#7ddc6b', 2); break;
      case 'heal': if (R.detail > 1) fxSpark(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, 2, 25, '#9fffcf', 0.4); break;
      case 'exodus': fxRing(e.x, e.y, e.r * 2.2, 0.6, '#8fe3ff', 2.5); fxFlash(e.x, e.y, e.r * 1.6, 0.35, '#dff4ff'); if (e.to === 0) fxSpark(e.x, e.y, 8, 90, '#bfe9ff', 0.5); break;
      case 'superfire': if (e.kind === 'exodus') { fxRing(e.x, e.y, 140, 1.2, '#8fe3ff', 3); } else if (e.kind === 'broodstorm') { fxRing(e.x, e.y, e.r * 1.4, 1.3, '#b4ff3c', 4); fxSmoke(e.x, e.y, 20, e.r * 0.5, 3); fxSpark(e.x, e.y, 30, 200, '#d6ff6a', 0.8); fxText(e.x, e.y - 50, L('Brutsturm'), '#b4ff3c'); if (R.inView(e.x, e.y, 600)) R.shake = Math.max(R.shake, 8); } else { fxFlash(e.sx, e.sy, 50, 0.4, '#ffe0a0'); if (R.inView(e.sx, e.sy, 400)) R.shake = Math.max(R.shake, 8); } R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'strike': fxExplode(e.x, e.y, e.r * 0.9, true, '#ffb070'); fxRing(e.x, e.y, e.r * 1.5, 1, '#ffd27a', 4); fxSmoke(e.x, e.y, 24, e.r * 0.5, 3); fxDebris(e.x, e.y, 30, 260, '#c9b9a0'); if (R.inView(e.x, e.y, 700)) R.shake = Math.max(R.shake, 16); R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'supercharged': fxRing(e.x, e.y, 80, 1.2, '#ffb86b', 3); break;
      case 'jump': fxRing(e.x, e.y, e.r * 2, 0.5, '#c9a0ff', 2); fxFlash(e.x, e.y, e.r * 1.4, 0.3, '#eadcff'); if (!e.from) fxSpark(e.x, e.y, 8, 90, '#e0c8ff', 0.5); break;
      case 'merge': fxRing(e.x, e.y, e.r * 2.5, 0.9, '#eadcff', 3); fxFlash(e.x, e.y, e.r * 1.8, 0.4, '#ffffff'); fxSpark(e.x, e.y, 20, 140, '#f3e6ff', 0.7); fxText(e.x, e.y - e.r - 20, L('Verschmolzen'), '#eadcff'); break;
      case 'bound': fxLine(e.fx, e.fy, e.x, e.y, 0.6, 'rgba(201,160,255,0.9)', 3); fxRing(e.x, e.y, 50, 0.8, '#c9a0ff', 3); fxText(e.x, e.y - 30, L('Übernommen'), '#c9a0ff'); break;
      case 'dormant': fxSmoke(e.x, e.y, 6, 14, 2); fxRing(e.x, e.y, 40, 1, '#f2c14e', 2); fxText(e.x, e.y - 30, e.hero ? L('{0} ruht', L(e.hero)) : L('ruht'), '#f2c14e'); break;
      case 'resurrect': fxRing(e.x, e.y, 120, 1.2, '#f2c14e', 4); fxFlash(e.x, e.y, 90, 0.5, '#fff6dc'); fxSpark(e.x, e.y, 30, 160, '#f2c14e', 0.9); fxText(e.x, e.y - 40, L('Wiederauferstehung'), '#f2c14e'); break;
      case 'recrew': fxRing(e.x, e.y, 30, 0.6, '#7ddc6b', 2); if (e.hero) fxText(e.x, e.y - 26, L('{0} kehrt zurück', L(e.hero)), '#f2c14e'); break;
      case 'ruin': fxRing(e.x, e.y, 60, 1, e.result === 'trap' ? '#ff5b47' : '#9ff0c0', 2); fxText(e.x, e.y - 40, L(e.result === 'relics' ? 'Relikte' : e.result === 'tech' ? 'Technikfragment' : e.result === 'map' ? 'Karte aufgedeckt' : 'Falle!'), e.result === 'trap' ? '#ff5b47' : '#9ff0c0'); break;
      case 'flank': if (R.vp < 0 || g.tm[e.owner] === g.tm[R.vp]) fxText(e.x, e.y - 34, L('Heck!'), '#ffd36b'); break;
      case 'cloak': fxRing(e.x, e.y, 46, 0.7, '#8fe3ff', 2); break;
      case 'decloak': fxRing(e.x, e.y, 52, 0.6, '#c9e8ff', 2.5); break;
      case 'salvage': fxRing(e.x, e.y, 24, 0.5, '#ffd36b', 1.5); break;
      case 'fortFall': fxRing(e.x, e.y, 260, 1.6, '#ffd36b', 4); fxText(e.x, e.y - 90, L('Piratenschatz'), '#ffd36b'); break;
      case 'siteWon': fxRing(e.x, e.y, 120, 1.3, '#9ff0c0', 3); fxText(e.x, e.y - 60, L(e.reward), '#9ff0c0'); break;
      case 'relics': if (e.x !== undefined) fxText(e.x, e.y - 30, L('+{0} Relikte', e.n), '#c9a0ff'); break;
      case 'gateOn': fxRing(e.x, e.y, 110, 1.2, '#9ff0c0', 3); fxFlash(e.x, e.y, 70, 0.5, '#9ff0c0'); break;
      case 'gateLance': fxLine(e.fx, e.fy, e.x, e.y, 0.6, 'rgba(255,140,100,0.6)', 10); fxExplode(e.x, e.y, 60, true, '#ff8a5a'); fxRing(e.x, e.y, 300, 1.2, '#ff8a5a', 4); if (R.inView(e.x, e.y, 600)) R.shake = Math.max(R.shake, 12); break;
      case 'gateStorm': fxRing(e.x, e.y, 200, 1.5, '#ff5b47', 4); fxSmoke(e.x, e.y, 16, 80, 3); break;
      case 'wake': fxRing(e.x, e.y, 150, 1.5, '#9ff0c0', 4); fxText(e.x, e.y - 70, L('Der Wächter erwacht'), '#9ff0c0'); if (R.inView(e.x, e.y, 600)) R.shake = Math.max(R.shake, 8); break;
      case 'phase': fxRing(e.x, e.y, e.r * 1.6, 0.3, '#ffffff', 1.5); break;
      case 'burst': fxRing(e.x, e.y, e.r, 0.7, '#b4ff3c', 3); fxSmoke(e.x, e.y, 10, e.r * 0.4, 2); fxSpark(e.x, e.y, 16, 120, '#d6ff6a', 0.6); break;
      case 'hatch': fxRing(e.x, e.y, e.r * 1.8, 0.6, '#ff9ad6', 2); fxSpark(e.x, e.y, 10, 80, '#b4ff3c', 0.5); fxText(e.x, e.y - e.r - 14, L('Geschlüpft'), '#ff9ad6'); break;
      case 'devour': fxLine(e.tx, e.ty, e.x, e.y, 0.4, 'rgba(180,255,60,0.7)', 6); fxExplode(e.x, e.y, e.r, false, '#8be04a'); fxText(e.x, e.y - 24, L('Verschlungen'), '#b4ff3c'); break;
      case 'breach': fxRing(e.x, e.y, e.r * 2.4, 1.1, '#ff5b47', 4); fxRing(e.x, e.y, e.r * 1.4, 0.7, '#ffffff', 2); fxFlash(e.x, e.y, e.r * 1.5, 0.5, '#ffd0c0'); fxSpark(e.x, e.y, 26, 220, '#ff9a7a', 0.8); fxText(e.x, e.y - e.r - 30, L('Durchbruch'), '#ff8a6a'); if (R.inView(e.x, e.y, 500)) R.shake = Math.max(R.shake, 7); R.lastAct = { x: e.x, y: e.y, t: R.time }; break;
      case 'gateDark': fxRing(e.x, e.y, 160, 1.4, '#9ff0c0', 3); fxSmoke(e.x, e.y, 10, 60, 2.5); fxText(e.x, e.y - 70, L('Tor erloschen'), '#9ff0c0'); break;
      case 'eat': if (R.detail > 1) fxSpark(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, 2, 30, '#b4ff3c', 0.4); break;
      case 'morph': fxRing(e.x, e.y, e.r * 2.2, 0.8, '#d6ff6a', 3); fxSpark(e.x, e.y, 14, 100, '#b4ff3c', 0.6); fxText(e.x, e.y - e.r - 16, L(e.name), '#d6ff6a'); break;
      case 'netoff': fxText(e.x, e.y - 30, L('Kein Netz'), '#ff5b47'); break;
      case 'flareStart': R.flareT = R.time; break;
    }
  }
};

/* ------------------------------------------------------------------ Bild */
function glowSprite(col) {
  const key = 'glow|' + col;
  let c = R.sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col.replace(')', ',0.55)').replace('rgb(', 'rgba(')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
  R.sprites.set(key, c);
  return c;
}
const GLOW_RGB = { '#8fe3ff': 'rgb(143,227,255)', '#ffb070': 'rgb(255,176,112)', '#ffd27a': 'rgb(255,210,122)', '#ffffff': 'rgb(255,255,255)', '#ff8a5a': 'rgb(255,138,90)', '#9fd0ff': 'rgb(159,208,255)', '#000000': 'rgb(0,0,0)', '#ff5b47': 'rgb(255,91,71)', '#7ddc6b': 'rgb(125,220,107)', '#c9a0ff': 'rgb(201,160,255)' };
/* additives Leuchten: hellt den Untergrund auf statt ihn zu überdecken */
function glowAdd(ctx, x, y, r, col, a) { ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, x, y, r, col, a); ctx.globalCompositeOperation = 'source-over'; }
function glowAt(ctx, x, y, r, col, a) { ctx.globalAlpha = a; ctx.drawImage(glowSprite(GLOW_RGB[col] || col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
function sprScale() { const z = R.cam.z * R.dpr; return z <= 0.6 ? 1 : z <= 1.2 ? 2 : 3; }
function drawShip(ctx, u, alpha) {
  const def = u.def, f = def.f, col = pcol(u.owner), s = sprScale();
  const dmg = u.derelict || def.role === 'fighter' || def.swarm ? 0 : 1 - u.hull / u.hullMax, dl = R.detail > 0 && R.cam.z > 0.3 ? (dmg > 0.7 ? 2 : dmg > 0.4 ? 1 : 0) : 0;
  const c = dl ? dmgSprite(u.type, f, col, s, dl) : shipSprite(u.type, f, u.derelict ? 'wreck' : col, s), w = c.width / s;
  const F = FACTIONS[f], mars = f === 'mars';
  /* Schlagschatten in den Raum: gibt Tiefe vor Nebel und Sternen */
  if (R.detail > 1 && def.role !== 'fighter') glowAt(ctx, u.x + 4, u.y + 5, def.r * 1.5, '#000000', 0.5);
  ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(u.ang);
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  /* Triebwerke: Glühen und bei Mars lange Fackel, Länge nach Fahrt; G-Rausch und Sprint strecken die Flamme */
  const boost = u.abT && u.abT.grush > 0 ? 1.8 : u.sprint > 0 ? 1.4 : 1, k = Math.min(1.6, u.v / Math.max(1, def.speed)) * boost, eng = u.derelict ? [] : (ENGINES[u.type] || []);
  if (k > 0.05 || mars) ctx.globalCompositeOperation = 'lighter';
  if (k > 0.05 || mars) for (const [ex0, ey0, st] of eng) {
    const ex = ex0 * SHIP_VIS, ey = ey0 * SHIP_VIS, flick = 1 + 0.18 * Math.sin(R.time * 37 + u.id * 1.7), len = (mars ? 16 : 7) * st * (0.2 + k) * flick, rr = def.r * 0.42 * st;
    if (mars) {
      /* Fackel: blauer Mantel, weißer Kern */
      ctx.fillStyle = 'rgba(120,180,255,' + (0.3 + 0.45 * k) + ')'; ctx.beginPath(); ctx.moveTo(ex + 1, ey - rr * 0.6); ctx.lineTo(ex - len * 2.4, ey); ctx.lineTo(ex + 1, ey + rr * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(235,245,255,' + (0.5 + 0.4 * k) + ')'; ctx.beginPath(); ctx.moveTo(ex + 1, ey - rr * 0.28); ctx.lineTo(ex - len * 1.3, ey); ctx.lineTo(ex + 1, ey + rr * 0.28); ctx.closePath(); ctx.fill();
      glowAt(ctx, ex - len * 0.5, ey, rr * 1.6 + len * 0.5, '#9fd0ff', 0.45 + 0.35 * k);
    } else {
      /* Alliance: weiches türkises Leuchten, kurzer heller Kern */
      glowAt(ctx, ex - len * 0.4, ey, rr * 2.2 + len * 0.8, F.glow, 0.45 + 0.4 * k);
      ctx.fillStyle = 'rgba(230,255,255,' + (0.5 + 0.4 * k) + ')'; ctx.beginPath(); ctx.ellipse(ex - len * 0.3, ey, len * 0.7 + 1.5, rr * 0.35 + 0.5, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (def.swarm && !u.derelict) {
    /* Schwarm: so viele Winzlinge, wie die Hülle hergibt, wuseln um die Mitte */
    const n = Math.max(1, Math.ceil(def.swarm * (u.hmul || 1) * u.hull / u.hullMax)), cs = shipSprite('swarmling', f, col, s), cw = cs.width / s;
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R.time * 0.9 + u.id, rr = 5 + (i % 3) * 4 + 2 * Math.sin(R.time * 4 + i * 1.3); ctx.save(); ctx.translate(Math.cos(a) * rr * 0.9, Math.sin(a) * rr); ctx.rotate(0.25 * Math.sin(R.time * 5 + i)); ctx.drawImage(cs, -cw / 2, -cw / 2, cw, cw); ctx.restore(); }
  } else {
    ctx.drawImage(c, -w / 2, -w / 2, w, w);
    /* Treffer auf die Hülle: kurzes Aufhellen */
    const hitAgo = R.g.time - (u.hitT || -9);
    if (hitAgo < 0.12 && !u.derelict) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.45 * (1 - hitAgo / 0.12); ctx.drawImage(c, -w / 2, -w / 2, w, w); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.globalCompositeOperation = 'source-over'; }
    /* Schadensbild: Glut und Partikel (die Brandflecken stecken schon im Bild) */
    if (dl) drawDamage(ctx, u, def, dl);
  }
  if (u.cocoon) { const k = 1 - u.cocoon.t / u.cocoon.t0, r = def.r * 1.3 + 4; ctx.fillStyle = 'rgba(111,77,133,0.8)'; ctx.strokeStyle = '#d6ff6a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(214,255,106,' + (0.3 + 0.5 * k) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); }
  ctx.restore();
}
/* Schadensbild: Brandflecken, Risse und Wunden werden einmal je Schiffstyp und Stufe ins Schiffsbild gemalt
   (nur auf der Hülle), dazu im Flug Glut und ab und zu Rauch, Funken oder Säure. Stellen je Typ fest. */
function dmgSpots(type) {
  const def = SHIPS[type], hs = hashStr(type), out = [];
  for (let i = 0; i < 4; i++) {
    const h1 = ((hs >>> (i * 3)) & 31) / 31, h2 = ((hs >>> (i * 3 + 15)) & 31) / 31;
    out.push([(h1 - 0.5) * 2 * def.len * 0.3, (h2 - 0.5) * 2 * def.r * 0.42, def.r * (0.32 + 0.12 * (i % 3))]);
  }
  return out;
}
function dmgSprite(type, f, col, s, lvl) {
  const base = shipSprite(type, f, col, s);
  return sprite('d|' + type + '|' + col + '|' + s + '|' + lvl, base.width, base.height, ctx => {
    ctx.drawImage(base, -base.width / 2, -base.height / 2);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.scale(s * SHIP_VIS, s * SHIP_VIS);
    const spots = dmgSpots(type).slice(0, lvl === 2 ? 4 : 2);
    for (const [x, y, rr] of spots) {
      if (f === 'brood') {
        ctx.fillStyle = 'rgba(30,6,30,0.85)'; ctx.beginPath(); ctx.ellipse(x, y, rr * 0.8, rr * 0.45, x, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(180,255,60,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      } else if (f === 'nexus') {
        ctx.strokeStyle = 'rgba(20,10,40,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - rr, y - rr * 0.3); ctx.lineTo(x - rr * 0.2, y + rr * 0.25); ctx.lineTo(x + rr * 0.3, y - rr * 0.4); ctx.lineTo(x + rr, y + rr * 0.3); ctx.stroke();
        ctx.strokeStyle = 'rgba(234,220,255,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
      } else {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(12,8,6,0.95)'); gr.addColorStop(0.55, 'rgba(30,20,14,0.7)'); gr.addColorStop(1, 'rgba(30,20,14,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - rr * 0.6, y - rr * 0.1); ctx.lineTo(x - rr * 0.1, y + rr * 0.3); ctx.lineTo(x + rr * 0.15, y - rr * 0.25); ctx.lineTo(x + rr * 0.55, y + rr * 0.15); ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,70,0.5)'; ctx.beginPath(); ctx.arc(x, y, rr * 0.18, 0, TAU); ctx.fill();
      }
    }
  });
}
function drawDamage(ctx, u, def, lvl) {
  const f = def.f, sp = dmgSpots(u.type), t = R.time;
  /* Glut an einer Stelle (schwer: an zweien) */
  for (let i = 0; i < lvl; i++) {
    const [x, y, rr] = sp[i];
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.7 + 0.3 * Math.sin(t * 11 + i * 3 + u.id);
    glowAt(ctx, x * SHIP_VIS, y * SHIP_VIS, rr * SHIP_VIS * 0.8 * fl, f === 'brood' ? '#b4ff3c' : f === 'nexus' ? '#c9a0ff' : f === 'legion' ? '#ffd27a' : '#ff7a30', f === 'brood' || f === 'nexus' ? 0.35 : 0.7);
    ctx.globalCompositeOperation = 'source-over';
  }
  /* Partikel: selten, nur bei genug Vorrat */
  if (R.detail > 1 && FX.list.length < FX.max - 150 && Math.random() < (lvl === 2 ? 0.09 : 0.04)) {
    const [x, y, rr] = sp[(Math.random() * (lvl * 2)) | 0], ca = Math.cos(u.ang), sa = Math.sin(u.ang), wx = u.x + (x * ca - y * sa) * SHIP_VIS, wy = u.y + (x * sa + y * ca) * SHIP_VIS;
    if (f === 'brood') fxSpark(wx, wy, 1, 18, '#b4ff3c', 0.6);
    else if (f === 'nexus') fxSpark(wx, wy, 2, 40, '#eadcff', 0.4);
    else { fxSmoke(wx, wy, 1, rr, 1.5); if (lvl === 2 && Math.random() < 0.5) fxSpark(wx, wy, 2, 60, '#ffd27a', 0.35); }
  }
}
function drawBldgAt(ctx, b, alpha) {
  const f = b.def.f, col = pcol(b.owner);
  if (b.tgt && b.def.lv[b.lv - 1].wpn.length) { const t = R.g.byId.get(b.tgt); if (t) { const want = Math.atan2(t.y - b.y, t.x - b.x); b.aimA = b.aimA === undefined ? want : b.aimA + angDiff(want, b.aimA) * Math.min(1, R.dt * 6); } }
  if (R.detail > 1 && R.cam.z >= 0.4) {
    /* Station in einen Zwischenspeicher zeichnen, darin Licht von oben links auftragen, mit Schatten einsetzen */
    const S = Math.min(2, Math.max(1, R.dpr * R.cam.z)), size = Math.ceil(b.def.r * 2.7 * S);
    if (!R.bcv) { R.bcv = document.createElement('canvas'); R.bctx = R.bcv.getContext('2d'); }
    if (R.bcv.width < size) { R.bcv.width = R.bcv.height = size; }
    const x = R.bctx;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, size, size);
    x.setTransform(S, 0, 0, S, size / 2, size / 2); x.lineJoin = 'round';
    drawBldg(x, b.role, f, b.lv, col, R.time, b);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    const g1 = x.createLinearGradient(0, 0, size, size);
    g1.addColorStop(0, 'rgba(255,255,255,0.18)'); g1.addColorStop(0.5, 'rgba(255,255,255,0)'); g1.addColorStop(1, 'rgba(0,0,30,0.3)');
    x.fillStyle = g1; x.fillRect(0, 0, size, size);
    x.globalCompositeOperation = 'source-over';
    glowAt(ctx, b.x + 6, b.y + 8, b.def.r * 1.35, '#000000', 0.55);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(R.bcv, 0, 0, size, size, b.x - size / 2 / S, b.y - size / 2 / S, size / S, size / S);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.save(); ctx.translate(b.x, b.y);
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  drawBldg(ctx, b.role, f, b.lv, col, R.time, b);
  ctx.restore();
}
/* ------------------------------------------------------------------ Fassung 22: Ruinen, Andocklichter, Verbindungen
   Ruine (2D): die Station abgedunkelt, mit Rissen und Brandflecken, einmal je Fraktion/Rolle/Stufe gezeichnet und gemerkt. */
const RUIN_CV = new Map();
function ruinSprite(f, role, lv) {
  const key = f + '|' + role + '|' + lv; let c = RUIN_CV.get(key); if (c) return c;
  const def = BLDG[f] && BLDG[f][role]; if (!def) return null;
  const S = 2, size = Math.ceil(def.r * 2.7 * S); c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.setTransform(S, 0, 0, S, size / 2, size / 2); x.lineJoin = 'round';
  try { drawBldg(x, role, f, lv, '#6b625a', 0, null); } catch (e) { /* Form fehlt */ }
  x.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(22,18,14,0.62)'; x.fillRect(0, 0, size, size);
  let sd = hashStr(key) >>> 0; const rnd = () => { sd = (sd * 1103515245 + 12345) >>> 0; return (sd >>> 8) / 16777216; };
  /* Brandflecken */
  for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = rnd() * def.r * S * 0.7, rr = (0.15 + rnd() * 0.25) * def.r * S, gx = size / 2 + Math.cos(a) * d, gy = size / 2 + Math.sin(a) * d, gr = x.createRadialGradient(gx, gy, 0, gx, gy, rr); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); }
  /* Bruchkanten: Keile herausschneiden, Risse */
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3; i++) { const a = rnd() * TAU, w = 0.25 + rnd() * 0.35; x.beginPath(); x.moveTo(size / 2 + Math.cos(a) * def.r * S * 0.55, size / 2 + Math.sin(a) * def.r * S * 0.55); x.lineTo(size / 2 + Math.cos(a - w) * size, size / 2 + Math.sin(a - w) * size); x.lineTo(size / 2 + Math.cos(a + w * 0.6) * size, size / 2 + Math.sin(a + w * 0.6) * size); x.closePath(); x.fill(); }
  x.lineWidth = 1.6 * S; x.strokeStyle = '#000';
  for (let i = 0; i < 6; i++) { let px = size / 2 + (rnd() - 0.5) * def.r * S, py = size / 2 + (rnd() - 0.5) * def.r * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (rnd() - 0.5) * def.r * S * 0.5; py += (rnd() - 0.5) * def.r * S * 0.5; x.lineTo(px, py); } x.stroke(); }
  x.globalCompositeOperation = 'source-over';
  RUIN_CV.set(key, c); return c;
}
function ruinFade(w, g) { return clamp((w.until - g.time) / 20, 0, 1) * clamp(0.35 + 0.65 * (w.sal0 ? w.sal / w.sal0 : 1), 0.35, 1); }
function drawRuin2D(ctx, w, g) {
  const c = ruinSprite(w.f, w.role, w.lv || 1); if (!c) return;
  const k = ruinFade(w, g), sz = c.width / 2;
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.ang || 0); ctx.globalAlpha = 0.9 * k; ctx.drawImage(c, -sz / 2, -sz / 2, sz, sz); ctx.restore();
  /* Glut in den Trümmern */
  if (R.detail > 1 && k > 0.3 && Math.random() < 0.025) fxSpark(w.x + (Math.random() - 0.5) * w.r, w.y + (Math.random() - 0.5) * w.r, 1, 18, '#ff8a3a', 0.6);
}
/* Andockplätze einer Raffinerie: Lichter im Kreis, grün = belegt, bernstein = frei */
function dockSpots(b) { const n = lvOf(b).docks || 0, out = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i + 0.5) / n * TAU; out.push({ x: b.x + Math.cos(a) * (b.def.r + 6), y: b.y + Math.sin(a) * (b.def.r + 6), on: i < b.docks }); } return out; }
/* Verbindungen der eigenen Stationen (gewählte Station oder Bauvorschau): Netz bzw. Baureichweite als Baum von den
   Kommandobasen aus, Raffinerie ↔ versorgte Vorkommen und anfliegende Frachter, Schildgenerator ↔ geschützte Stationen.
   Liefert Linien { x0, y0, x1, y1, col, a, march }, Kreise { x, y, r, col, a } und Texte – in 2D und 3D gleich gezeichnet. */
const CONN = { key: '', t: -9, tree: null };
function connTree(g, vp) {
  /* Prim vom Kern aus: jeder Knoten hängt am nächsten schon verbundenen, der ihn erreicht */
  const P = g.players[vp], nexus = P.faction === 'nexus', nodes = [];
  for (const b of g.bldgs) if (!b.dead && b.owner === vp && b.done) nodes.push(b);
  if (nexus) for (const u of g.ships) if (!u.dead && u.owner === vp && u.def.node && !u.derelict) nodes.push(u);
  const rng = e => e.k === 2 && e.role === 'base' ? BUILD_RANGE_BASE : BUILD_RANGE;
  const reach = (a, b) => { const d = hyp(a.x - b.x, a.y - b.y); if (nexus) return d <= Math.max(netRange(g, P, a), netRange(g, P, b)); return d < Math.max(rng(a), rng(b)); };
  const n = nodes.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), par = new Int32Array(n).fill(-1), edges = [];
  for (let i = 0; i < n; i++) if (nodes[i].k === 2 && nodes[i].role === 'base') best[i] = 0;
  for (let it = 0; it < n; it++) {
    let k = -1; for (let i = 0; i < n; i++) if (!inT[i] && best[i] < Infinity && (k < 0 || best[i] < best[k])) k = i;
    if (k < 0) break;
    inT[k] = 1; if (par[k] >= 0) edges.push([nodes[par[k]], nodes[k]]);
    for (let i = 0; i < n; i++) if (!inT[i] && reach(nodes[k], nodes[i])) { const d = hyp(nodes[k].x - nodes[i].x, nodes[k].y - nodes[i].y); if (d < best[i]) { best[i] = d; par[i] = k; } }
  }
  return { edges, nodes: nodes.filter((o, i) => inT[i]), loose: nodes.filter((o, i) => !inT[i] && o.k === 2), nexus };
}
function connGather(g, vp, U) {
  const out = { lines: [], rings: [], texts: [] };
  if (vp < 0 || !U || U.attract) return out;
  const sb0 = U.selB ? g.byId.get(U.selB) : null, sb = sb0 && !sb0.dead && sb0.owner === vp ? sb0 : null, pl = U.place, P = g.players[vp];
  if (!sb && !pl) return out;
  const NET = P.faction === 'nexus' ? '#c9a0ff' : '#9ff0c0';
  const L2 = (a, b, col, al, march, ra, rb) => { const d = hyp(b.x - a.x, b.y - a.y); if (d < 1) return; const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, r0 = ra || 0, r1 = rb || 0; if (d <= r0 + r1 + 4) return; out.lines.push({ x0: a.x + ux * r0, y0: a.y + uy * r0, x1: b.x - ux * r1, y1: b.y - uy * r1, col, a: al, march: !!march }); };
  const rOf = e => e.k === 2 ? e.def.r + 4 : e.k === 3 ? e.r + 2 : e.def.r + 3;
  /* Netz / Baureichweite (alle 0,5 s neu) */
  const key = vp + ':' + g.bldgs.length + ':' + g.ships.length;
  if (R.time - CONN.t > 0.5 || R.time < CONN.t || CONN.key !== key) { CONN.t = R.time; CONN.key = key; CONN.tree = connTree(g, vp); }
  const T = CONN.tree;
  for (const [a, b] of T.edges) L2(a, b, NET, sb && (a === sb || b === sb) ? 0.6 : 0.3, false, rOf(a), rOf(b));
  for (const b of T.loose) out.rings.push({ x: b.x, y: b.y, r: b.def.r + 10, col: '#ff5b47', a: 0.55 });
  /* Bauvorschau: woran hängt der neue Platz? */
  if (pl) {
    const pr = BLDG[P.faction][pl.role].r + 4;
    const near = (x, y) => { let best = null, bd = 1e9; for (const e of T.nodes) { const d = hyp(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } } return best; };
    const spots = pl.row && pl.pts ? pl.pts : [{ x: pl.x, y: pl.y, ok: pl.ok, why: pl.why }];
    const far = q => q.why === 'Zu weit von der Basis' || q.why === 'Außerhalb des Netzes';
    if (pl.role !== 'base') for (const q of spots) { const n = near(q.x, q.y); if (n) L2(n, q, far(q) ? '#ff5b47' : NET, far(q) ? 0.6 : 0.45, true, rOf(n), pr); }
    const ql = spots[spots.length - 1];
    if (ql && far(ql)) out.texts.push({ x: ql.x, y: ql.y, txt: L(ql.why), col: '#ff5b47', dy: -pr - 18 });
  }
  /* Raffinerie: versorgte Vorkommen und anfliegende Frachter */
  const refs = [];
  if (sb && sb.role === 'refinery' && sb.done) refs.push(sb);
  if (pl && pl.role === 'refinery') for (const q of (pl.row && pl.pts ? pl.pts : [pl])) refs.push({ x: q.x, y: q.y, k: 2, def: BLDG[P.faction].refinery, ghost: 1 });
  for (const rf of refs) {
    for (const n of g.nodes) if (n.amount > 0 && hyp(n.x - rf.x, n.y - rf.y) - n.r < REF_SERVE && R.seen(n.x, n.y)) L2(rf, n, n.kind === 'ice' ? '#8fe3ff' : '#ffb86b', 0.4, false, rf.def.r + 4, n.r + 2);
    if (!rf.ghost) for (const u of g.ships) if (!u.dead && u.owner === vp && u.def.cargo && u.o.t === 'return') { const tgt = u.dk ? g.byId.get(u.dk) : u.o.ref ? g.byId.get(u.o.ref) : nearestRefinery(g, vp, u.x, u.y); if (tgt === rf) L2(u, rf, '#ffd36b', 0.5, true, u.def.r + 2, rf.def.r + 8); }
  }
  /* Schildgenerator: Umkreis und geschützte Stationen; eine geschützte Station zeigt ihre Generatoren */
  const gens = [];
  if (sb && sb.role === 'shield' && sb.done) gens.push({ g: sb, aura: lvOf(sb).aura });
  if (pl && pl.role === 'shield') for (const q of (pl.row && pl.pts ? pl.pts : [pl])) gens.push({ g: { x: q.x, y: q.y, k: 2, def: BLDG[P.faction].shield }, aura: BLDG[P.faction].shield.lv[0].aura, ghost: 1 });
  for (const G of gens) { if (G.ghost) out.rings.push({ x: G.g.x, y: G.g.y, r: G.aura, col: '#8fe3ff', a: 0.3 }); for (const o of g.bldgs) if (!o.dead && o !== G.g && o.owner === vp && o.done && hyp(o.x - G.g.x, o.y - G.g.y) <= G.aura) L2(G.g, o, '#8fe3ff', 0.45, false, G.g.def.r + 4, o.def.r + 4); }
  if (sb && sb.role !== 'shield' && sb.done) for (const o of g.bldgs) if (!o.dead && o.role === 'shield' && o.done && o.owner === vp && hyp(o.x - sb.x, o.y - sb.y) <= lvOf(o).aura) { L2(o, sb, '#8fe3ff', 0.45, false, o.def.r + 4, sb.def.r + 4); out.rings.push({ x: o.x, y: o.y, r: lvOf(o).aura, col: '#8fe3ff', a: 0.2 }); }
  return out;
}
/* Fundamente (eigene, eben abgerissene Stationen): gestrichelter Kreis mit Restzeit */
function foundList(g, vp) { return vp >= 0 && g.found ? g.found.filter(f => f.owner === vp && f.until > g.time) : []; }
/* Lebens- und Schildbalken über einem Objekt (Weltkoordinaten) */
function drawBars(ctx, e, w) {
  const z = R.cam.z, x = e.x - w / 2, y = e.y - (e.k === 2 ? e.def.r : e.def.r) - 10 / z, h = 3 / z;
  const hull = e.hull / e.hullMax, foe = isFoeV(e.owner);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1 / z, y - 1 / z, w + 2 / z, h + 2 / z + (e.shieldMax || e.give ? h + 1 / z : 0));
  ctx.fillStyle = foe ? '#ff5b47' : hull > 0.5 ? '#7ddc6b' : hull > 0.25 ? '#ffc23e' : '#ff5b47';
  ctx.fillRect(x, y + (e.shieldMax || e.give ? h + 1 / z : 0), w * clamp(hull, 0, 1), h);
  if (e.shieldMax || e.give) { const sm = (e.shieldMax || 0) + (e.givep || 0), sv = (e.shield || 0) + (e.give || 0); ctx.fillStyle = '#8fe3ff'; ctx.fillRect(x, y, w * clamp(sm ? sv / sm : 0, 0, 1), h); }
}
function drawChevrons(ctx, x, y, n, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2 / R.cam.z; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const yy = y - i * 5 / R.cam.z, s = 4 / R.cam.z; ctx.beginPath(); ctx.moveTo(x - s, yy + s * 0.6); ctx.lineTo(x, yy - s * 0.4); ctx.lineTo(x + s, yy + s * 0.6); ctx.stroke(); }
}
function wpnCol(owner) { return FACTIONS[R.g.players[owner].faction].wpn; }
function frame2D(alpha, dt) {
  const g = R.g, ctx = R.ctx, cam = R.cam;
  R.time += dt; R.dt = dt; R.frameN++;
  if (!g) return;
  fxStep(dt);
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 14);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx);
  const sh = R.shake ? [(Math.random() - 0.5) * R.shake, (Math.random() - 0.5) * R.shake] : [0, 0];
  const S = R.dpr * cam.z;
  ctx.setTransform(S, 0, 0, S, (-cam.x + sh[0]) * S, (-cam.y + sh[1]) * S);
  const vw = R.cssW / cam.z, vh = R.cssH / cam.z, x0 = cam.x - 100, y0 = cam.y - 100, x1 = cam.x + vw + 100, y1 = cam.y + vh + 100;
  const inV = (x, y, m) => x + m > x0 && x - m < x1 && y + m > y0 && y - m < y1;
  const m = g.map, vp = R.vp, lowZ = cam.z < 0.45;
  drawAsh(ctx);
  /* Nebelzonen: Ionennebel violett-blau mit treibenden Schlieren, Aschewolken rot-braun glimmend */
  for (const n of m.nebs || []) if (inV(n.x, n.y, n.r)) {
    const ash = n.kind === 'ash', t = R.time * 0.15 + n.x * 0.01;
    for (let k = 0; k < (lowZ ? 1 : 3); k++) {
      const cx = n.x + Math.cos(t + k * 2.1) * n.r * 0.18, cy = n.y + Math.sin(t * 1.3 + k * 2.1) * n.r * 0.18, rr = n.r * (1 - k * 0.22);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      if (ash) { gr.addColorStop(0, 'rgba(255,110,60,0.3)'); gr.addColorStop(0.6, 'rgba(130,45,28,0.3)'); gr.addColorStop(1, 'rgba(90,30,20,0)'); }
      else { gr.addColorStop(0, 'rgba(150,130,255,0.3)'); gr.addColorStop(0.6, 'rgba(80,70,180,0.3)'); gr.addColorStop(1, 'rgba(50,40,120,0)'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
    }
  }
  /* Felder: dichter Bereich als weiche Fläche, darin die Felsen */
  for (const f of m.fields) if (inV(f.x, f.y, f.r)) { const gr = ctx.createRadialGradient(f.x, f.y, f.r * 0.2, f.x, f.y, f.r); gr.addColorStop(0, 'rgba(90,80,70,0.22)'); gr.addColorStop(1, 'rgba(90,80,70,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
  for (const o of m.rocks) if (inV(o.x, o.y, o.r)) drawRock(ctx, o, 'rock');
  for (const n of g.nodes) if (inV(n.x, n.y, n.r)) { drawRock(ctx, n, n.kind, n.amount > 0 ? 1 : 0.45); if (n.miners && R.visible(n)) { ctx.strokeStyle = n.kind === 'ice' ? 'rgba(143,227,255,0.35)' : 'rgba(255,184,107,0.35)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -R.time * 30; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
  /* Stätten und Tore */
  for (const st of g.sites) if (inV(st.x, st.y, st.r + 40) && R.seen(st.x, st.y)) { if (R.detail > 1 && cam.z > 0.35) glowAt(ctx, st.x + st.r * 0.1, st.y + st.r * 0.14, st.r * 1.5, '#000000', 0.45); ctx.save(); ctx.translate(st.x, st.y); drawSite(ctx, st, R.time, R.visible(st)); ctx.restore(); if (st.prog > 0 && !st.done) { ctx.strokeStyle = st.by >= 0 ? pcol(st.by) : '#fff'; ctx.lineWidth = 3 / cam.z; ctx.beginPath(); ctx.arc(st.x, st.y, st.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * st.prog); ctx.stroke(); } if (st.owner >= 0 && st.kind !== 'ruin') { ctx.strokeStyle = pcol(st.owner); ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 6 / cam.z]); ctx.beginPath(); ctx.arc(st.x, st.y, st.r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
  for (const gt of g.gates) if (inV(gt.x, gt.y, gt.r + 40) && R.seen(gt.x, gt.y)) { if (R.detail > 1 && cam.z > 0.35) glowAt(ctx, gt.x + 6, gt.y + 8, gt.r * 1.4, '#000000', 0.4); ctx.save(); ctx.translate(gt.x, gt.y); drawGate(ctx, gt, R.time, gt.owner >= 0 ? pcol(gt.owner) : '#9ff0c0'); ctx.restore(); if (gt.prog > 0) { ctx.strokeStyle = gt.by >= 0 ? pcol(gt.by) : '#fff'; ctx.lineWidth = 3 / cam.z; ctx.beginPath(); ctx.arc(gt.x, gt.y, gt.r + 14, -Math.PI / 2, -Math.PI / 2 + TAU * gt.prog); ctx.stroke(); } }
  /* Sterneneruption des Sunbreakers: brennender Bereich */
  /* Risse der Brood (Wellen): violett-grüne Wunden im Raum, die offenen pulsieren */
  if (g.wave && g.wave.open) for (const r0 of g.wave.open) if (inV(r0.x, r0.y, 200)) {
    const hot = g.wave.phase === 'wave', k = hot ? 1.6 : 0.8, rr = 80 + 10 * Math.sin(R.time * 2 + r0.x);
    ctx.save(); ctx.translate(r0.x, r0.y); ctx.rotate(Math.atan2(g.map.h / 2 - r0.y, g.map.w / 2 - r0.x) + Math.PI / 2);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, rr * 1.6); gr.addColorStop(0, 'rgba(214,255,106,' + (0.35 * k) + ')'); gr.addColorStop(0.5, 'rgba(160,80,200,' + (0.25 * k) + ')'); gr.addColorStop(1, 'rgba(80,20,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, rr * 1.6, rr * 0.7, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#12051c'; ctx.beginPath(); ctx.moveTo(-rr, 0); for (let i = 0; i <= 10; i++) { const x = -rr + i * rr / 5; ctx.lineTo(x, -6 - 10 * Math.sin(i / 10 * Math.PI) * (1 + 0.2 * Math.sin(R.time * 3 + i))); } for (let i = 10; i >= 0; i--) { const x = -rr + i * rr / 5; ctx.lineTo(x, 6 + 10 * Math.sin(i / 10 * Math.PI) * (1 + 0.2 * Math.cos(R.time * 3 + i))); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(214,255,106,' + (0.5 + 0.4 * k * Math.abs(Math.sin(R.time * 3))) + ')'; ctx.lineWidth = 2 / cam.z; ctx.stroke();
    ctx.restore();
    if (hot && R.detail > 1 && Math.random() < 0.4) fxSpark(r0.x + (Math.random() - 0.5) * rr, r0.y + (Math.random() - 0.5) * 30, 1, 40, '#d6ff6a', 0.5);
  }
  /* Sporenteppiche */
  for (const sp of g.spores) if (inV(sp.x, sp.y, sp.r + 40)) { const k = Math.min(1, sp.t / 5); const gr = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r); gr.addColorStop(0, 'rgba(180,255,60,' + (0.22 * k) + ')'); gr.addColorStop(0.7, 'rgba(140,224,74,' + (0.14 * k) + ')'); gr.addColorStop(1, 'rgba(140,224,74,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, TAU); ctx.fill(); if (R.detail > 1 && Math.random() < 0.5) { const a = Math.random() * TAU, d = Math.random() * sp.r; fxSpark(sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d, 1, 12, '#d6ff6a', 0.5); } }
  for (const b of g.bldgs) if (!b.dead && b.role === 'spore' && b.done && inV(b.x, b.y, 400) && R.visible(b)) { const r = lvOf(b).aura; const gr = ctx.createRadialGradient(b.x, b.y, b.def.r, b.x, b.y, r); gr.addColorStop(0, 'rgba(180,255,60,0.16)'); gr.addColorStop(1, 'rgba(140,224,74,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(180,255,60,0.25)'; ctx.lineWidth = 1 / cam.z; ctx.setLineDash([4 / cam.z, 6 / cam.z]); ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  for (const f of g.flares) if (inV(f.x, f.y, f.r + 60)) { const k = f.t / f.t0; ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, 'rgba(255,255,230,' + (0.6 * k) + ')'); gr.addColorStop(0.5, 'rgba(255,170,70,' + (0.45 * k) + ')'); gr.addColorStop(1, 'rgba(255,90,40,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; if (R.detail > 1) { for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, d = Math.random() * f.r; fxSpark(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1, 60, '#ffd27a', 0.4); } } }
  /* Wracks */
  for (const w of g.wrecks) if (w.ruin) { if (inV(w.x, w.y, w.r + 40) && R.seen(w.x, w.y)) drawRuin2D(ctx, w, g); } /* Fassung 22: Ruinen */
  else if (inV(w.x, w.y, 60) && R.seen(w.x, w.y)) { const left = w.until - g.time; ctx.save(); ctx.globalAlpha = clamp(left / 20, 0, 0.55); ctx.translate(w.x, w.y); ctx.rotate(w.ang + Math.sin(w.id) * 0.3); const s = sprScale(), c = shipSprite(w.type, SHIPS[w.type].f, 'wreck', s), ww = c.width / s; ctx.drawImage(c, -ww / 2, -ww / 2, ww, ww); ctx.restore(); }
  /* Stationen */
  for (const b of g.bldgs) {
    if (b.dead || !inV(b.x, b.y, b.def.r + 40)) continue;
    const seen = R.seen(b.x, b.y), vis = R.visible(b);
    if (!seen && vp >= 0) continue;
    if (!b.done) {
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(0, 0, b.def.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = pcol(b.owner); ctx.lineWidth = 3 / cam.z; ctx.beginPath(); ctx.arc(0, 0, b.def.r, -Math.PI / 2, -Math.PI / 2 + TAU * b.prog); ctx.stroke();
      ctx.restore();
      drawBldgAt(ctx, b, 0.25 + 0.7 * b.prog);
      if (b.bld && vis) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = R.time * 2 + i * 2.1; ctx.moveTo(b.x + Math.cos(a) * b.def.r * 0.3, b.y + Math.sin(a) * b.def.r * 0.3); ctx.lineTo(b.x + Math.cos(a + 1) * b.def.r * 0.8, b.y + Math.sin(a + 1) * b.def.r * 0.8); } ctx.stroke(); fxSpark(b.x + (Math.random() - 0.5) * b.def.r, b.y + (Math.random() - 0.5) * b.def.r, 1, 30, '#ffe9a0', 0.3); }
      continue;
    }
    drawBldgAt(ctx, b, vis ? (b.off ? 0.55 : 1) : 0.6);
    if (b.off && vis && !lowZ && (R.frameN % 60) < 40) { ctx.fillStyle = '#ff5b47'; ctx.font = (12 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(L('Kein Netz'), b.x, b.y + b.def.r + 14 / cam.z); }
    /* Werft: das entstehende Schiff als Umriss */
    if (b.role === 'yard' && b.q.length && vis) { const def = SHIPS[b.q[0].id], s = sprScale(), c = shipSprite(def.id, def.f, pcol(b.owner), s), w = c.width / s; ctx.save(); ctx.translate(b.x, b.y); ctx.globalAlpha = 0.15 + 0.6 * b.qp; ctx.drawImage(c, -w / 2, -w / 2, w, w); ctx.restore(); if (R.detail > 1 && Math.random() < 0.3) fxSpark(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 20, 1, 40, '#ffe9a0', 0.25); }
    /* Zusatzschild und Schild der Station bei Treffern: Schimmer */
    if (b.give > 0 && vis) { ctx.strokeStyle = 'rgba(143,227,255,0.18)'; ctx.lineWidth = 2 / cam.z; ctx.beginPath(); ctx.arc(b.x, b.y, b.def.r * 1.15, 0, TAU); ctx.stroke(); }
    if (b.hull < b.hullMax * 0.5 && vis && R.detail > 1 && Math.random() < 0.15) { fxSmoke(b.x + (Math.random() - 0.5) * b.def.r, b.y + (Math.random() - 0.5) * b.def.r, 1, 14, 1.4); if (Math.random() < 0.3) fxSpark(b.x, b.y, 2, 50, '#ffd27a', 0.3); }
    if (b.role === 'super' && vis) { ctx.strokeStyle = b.charge >= 1 ? 'rgba(255,184,107,' + (0.6 + 0.3 * Math.sin(R.time * 5)) + ')' : 'rgba(255,184,107,0.55)'; ctx.lineWidth = 3 / cam.z; ctx.beginPath(); ctx.arc(b.x, b.y, b.def.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, b.charge)); ctx.stroke(); if (b.charge >= 1 && b.owner === vp) glowAt(ctx, b.x, b.y, b.def.r * 1.6, '#ffb070', 0.18 + 0.1 * Math.sin(R.time * 4)); }
    if (b.upg && vis) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / cam.z; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(b.x, b.y, b.def.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * b.upg.prog); ctx.stroke(); ctx.setLineDash([]); }
    /* Fassung 22: Andocklichter der Raffinerie */
    if (b.role === 'refinery' && vis && cam.z > 0.35) for (const d of dockSpots(b)) { if (d.on) glowAt(ctx, d.x, d.y, 9, '#7dff9a', 0.5 + 0.2 * Math.sin(R.time * 4 + d.x)); ctx.fillStyle = d.on ? '#c8ffd6' : 'rgba(255,194,62,0.55)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.on ? 2.6 : 2, 0, TAU); ctx.fill(); }
  }
  /* Bauschiff am Werk: Baustrahl */
  for (const u of g.ships) if (!u.dead && u.o.t === 'build' && R.visible(u)) { const b = g.byId.get(u.o.bid); if (b && !b.done && hyp(u.x - b.x, u.y - b.y) < b.def.r + u.def.r + 70) { ctx.strokeStyle = 'rgba(180,255,220,0.55)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -R.time * 40; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(b.x + Math.cos(R.time * 1.3) * b.def.r * 0.4, b.y + Math.sin(R.time * 1.3) * b.def.r * 0.4); ctx.stroke(); ctx.setLineDash([]); } }
  /* Schiffe */
  for (const u of g.ships) {
    if (u.dead || !inV(u.x, u.y, 60) || !R.visible(u)) continue;
    if (u.o.t === 'harvest' && u.mine && R.detail > 1 && Math.random() < 0.3) { const n = g.byId.get(u.mine); if (n) { ctx.strokeStyle = n.kind === 'ice' ? 'rgba(143,227,255,0.5)' : 'rgba(255,184,107,0.5)'; ctx.lineWidth = 1.2 / cam.z; ctx.beginPath(); ctx.moveTo(u.x, u.y); const a = Math.atan2(u.y - n.y, u.x - n.x) + (Math.random() - 0.5) * 0.3; ctx.lineTo(n.x + Math.cos(a) * n.r * 0.95, n.y + Math.sin(a) * n.r * 0.95); ctx.stroke(); } }
    if (u.abT && u.abT.cloak > 0) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * (0.3 + 0.1 * Math.sin(R.time * 7 + u.id)); drawShip(ctx, u); ctx.globalAlpha = ga; } else drawShip(ctx, u);
    if (R.detail > 1 && !u.derelict && u.v > u.def.speed * 0.45 && (R.frameN + u.id) % 3 === 0 && FX.list.length < FX.max - 80) { const eng = ENGINES[u.type]; if (eng && eng.length) { const e = eng[0], ex = e[0] * SHIP_VIS, ey = e[1] * SHIP_VIS, ca = Math.cos(u.ang), sa = Math.sin(u.ang); fxTrail(u.x + ex * ca - ey * sa, u.y + ex * sa + ey * ca, FACTIONS[u.def.f].glow, u.def.r * 0.28); } }
    if (u.fr && g.time - u.fr < 0.3 && R.detail > 1) fxSpark(u.x + (Math.random() - 0.5) * u.def.r, u.y + (Math.random() - 0.5) * u.def.r, 1, 20, '#9fffcf', 0.3);
    if (u.def.role === 'fighter') continue;
    /* Zustände: Wrack (Funken), Schildkuppel, Unverwundbar, Waffenstillstand, Markierung, Enterkampf */
    if (u.dormant) glowAt(ctx, u.x, u.y, u.def.r * 1.8, '#ffd27a', 0.18 + 0.1 * Math.sin(R.time * 2 + u.id));
    if (u.derelict) { if (R.detail > 1 && Math.random() < 0.04) fxSpark(u.x + (Math.random() - 0.5) * u.def.r, u.y + (Math.random() - 0.5) * u.def.r, 2, 30, '#ffd27a', 0.5); }
    if (u.acid && R.detail > 1 && Math.random() < 0.35) fxSpark(u.x + (Math.random() - 0.5) * u.def.r, u.y + (Math.random() - 0.5) * u.def.r, 1, 15, '#b4ff3c', 0.5);
    if (u.para) { const n = Math.min(4, u.para.n); ctx.fillStyle = '#ff9ad6'; for (let i = 0; i < n; i++) { const a = R.time * 2 + i * TAU / n; ctx.beginPath(); ctx.arc(u.x + Math.cos(a) * u.def.r * 0.8, u.y + Math.sin(a) * u.def.r * 0.8, 2 / cam.z + 0.8, 0, TAU); ctx.fill(); } }
    if (u.dome > 0) { const r = u.def.r * 1.5 + 6; ctx.fillStyle = 'rgba(143,227,255,0.1)'; ctx.strokeStyle = 'rgba(143,227,255,' + (0.35 + 0.15 * Math.sin(R.time * 6)) + ')'; ctx.lineWidth = 1.5 / cam.z; ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    if (u.abT && u.abT.invuln > 0) { ctx.strokeStyle = 'rgba(255,230,160,' + (0.6 + 0.3 * Math.sin(R.time * 10)) + ')'; ctx.lineWidth = 2.5 / cam.z; ctx.beginPath(); ctx.arc(u.x, u.y, u.def.r * 1.4 + 4, 0, TAU); ctx.stroke(); glowAt(ctx, u.x, u.y, u.def.r * 2.2, '#ffd27a', 0.35); }
    if (u.truce > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1 / cam.z; ctx.setLineDash([3 / cam.z, 3 / cam.z]); ctx.beginPath(); ctx.arc(u.x, u.y, u.def.r + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (u.marked > g.time) { const r = u.def.r + 9, a0 = R.time * 2; ctx.strokeStyle = '#ffb86b'; ctx.lineWidth = 2 / cam.z; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(u.x, u.y, r, a0 + i * Math.PI / 2, a0 + i * Math.PI / 2 + 0.8); ctx.stroke(); } }
    if (u.boarding > 0) { const n = Math.min(8, Math.ceil(u.boarding / 12)); ctx.fillStyle = pcol(u.boardBy); for (let i = 0; i < n; i++) { const a = R.time * 3 + i * TAU / n; ctx.beginPath(); ctx.arc(u.x + Math.cos(a) * (u.def.r * 0.7), u.y + Math.sin(a) * (u.def.r * 0.7), 1.6 / cam.z + 0.6, 0, TAU); ctx.fill(); } }
  }
  /* Enterkampf an Stationen */
  for (const b of g.bldgs) if (!b.dead && b.boarding > 0 && inV(b.x, b.y, 80) && R.visible(b)) { const n = Math.min(10, Math.ceil(b.boarding / 12)); ctx.fillStyle = pcol(b.boardBy); for (let i = 0; i < n; i++) { const a = R.time * 2.5 + i * TAU / n; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * (b.def.r * 0.6), b.y + Math.sin(a) * (b.def.r * 0.6), 1.8 / cam.z + 0.6, 0, TAU); ctx.fill(); } }
  /* Strahlen */
  for (const s of g.ships.concat(g.bldgs)) {
    if (s.dead || !s.beams) continue;
    for (let i = 0; i < s.beams.length; i++) {
      const bm = s.beams[i]; if (!bm) continue;
      const t = g.byId.get(bm.tid); if (!t || t.dead) continue;
      if (vp >= 0 && !R.visible(s) && !R.visible(t)) continue;
      const wp = (s.k === 2 ? lvOf(s).wpn : s.def.wpn)[i], col = wp.col || wpnCol(s.owner), a = Math.atan2(t.y - s.y, t.x - s.x), r0 = s.k === 2 ? s.def.r * 0.6 : s.def.r * 0.5;
      if (bm.extra) for (const eid of bm.extra) { const e2 = g.byId.get(eid); if (!e2 || e2.dead) continue; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.strokeStyle = col; ctx.lineWidth = (wp.w || 2) * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e2.x, e2.y); ctx.stroke(); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e2.x, e2.y); ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      const sx = s.x + Math.cos(a) * r0, sy = s.y + Math.sin(a) * r0, jx = (Math.random() - 0.5) * 3, jy = (Math.random() - 0.5) * 3, tx = t.x + jx, ty = t.y + jy;
      const bw = (wp.w || 2), pulse = 0.85 + 0.15 * Math.sin(R.time * 40 + s.id);
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25; ctx.strokeStyle = col; ctx.lineWidth = bw * 5 * pulse; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.lineWidth = bw * 2.4 * pulse; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = bw * 0.7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      glowAt(ctx, sx, sy, bw * 5, col, 0.9); glowAt(ctx, tx, ty, bw * 7 * pulse, col, 0.8);
      ctx.globalCompositeOperation = 'source-over';
      if (R.detail > 1 && Math.random() < 0.4) fxSpark(tx, ty, 1, 60, col, 0.25);
    }
  }
  /* Geschosse */
  for (const q of g.proj) {
    if (!inV(q.x, q.y, 80) || (vp >= 0 && !visAt(g, vp, q.x, q.y))) continue;
    const col = wpnCol(q.owner), dx = Math.cos(q.ang), dy = Math.sin(q.ang);
    ctx.globalCompositeOperation = 'lighter';
    if (q.kind === 'torp') { glowAt(ctx, q.x, q.y, 12, '#ffb070', 0.9); ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, TAU); ctx.fill(); if (R.detail > 1) fxTrail(q.x - dx * 6, q.y - dy * 6, '#ff9a50'); }
    else if (q.kind === 'art') { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,90,60,0.55)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(q.tx, q.ty, q.splash, 0, TAU); ctx.stroke(); ctx.setLineDash([]); const k = 1 - q.left / Math.max(1, q.d0), hgt = Math.sin(k * Math.PI) * Math.min(160, q.d0 * 0.22); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, q.x, q.y - hgt, 14, q.col || '#ffb070', 0.9); ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(q.x, q.y - hgt, 3, 0, TAU); ctx.fill(); }
    else if (q.kind === 'rail') { glowAt(ctx, q.x, q.y, 14, '#9fd0ff', 0.8); ctx.strokeStyle = 'rgba(190,235,255,0.5)'; ctx.lineWidth = 5 / cam.z; ctx.beginPath(); ctx.moveTo(q.x - dx * 70, q.y - dy * 70); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 / cam.z; ctx.beginPath(); ctx.moveTo(q.x - dx * 60, q.y - dy * 60); ctx.lineTo(q.x + dx * 4, q.y + dy * 4); ctx.stroke(); }
    else { ctx.lineCap = 'round'; ctx.strokeStyle = q.col || col; ctx.globalAlpha = 0.5; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(q.x - dx * 14, q.y - dy * 14); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(q.x - dx * 9, q.y - dy * 9); ctx.lineTo(q.x + dx * 1.5, q.y + dy * 1.5); ctx.stroke(); ctx.lineCap = 'butt'; glowAt(ctx, q.x, q.y, 6, q.col || col, 0.5); }
    ctx.globalCompositeOperation = 'source-over';
  }
  fxDraw(ctx, cam.z);
  /* Nebel des Krieges */
  if (vp >= 0) {
    if (R.time - R.fogT > 0.15) { R.fogT = R.time; fogUpdate(); }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.fogCv, 0, 0, g.vw, g.vh, 0, 0, g.vw * VIS, g.vh * VIS);
    ctx.fillStyle = 'rgba(2,3,8,0.92)';
    const far = 2000;
    ctx.fillRect(-far, -far, m.w + far * 2, far); ctx.fillRect(-far, m.h, m.w + far * 2, far); ctx.fillRect(-far, 0, far, m.h); ctx.fillRect(m.w, 0, far, m.h);
  }
  drawOverlay2D(ctx, g, inV, lowZ, vp, dt);
  const U = typeof UI !== 'undefined' ? UI : null;
  /* Bildschirmkoordinaten: Auswahlrahmen, Minikarten-Pings */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (g.flareOn) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,80,' + (0.08 + 0.05 * Math.sin(R.time * 9)) + ')'; ctx.fillRect(0, 0, R.W, R.H); ctx.globalCompositeOperation = 'source-over'; }
  drawVignette(ctx);
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  if (U && U.box) { const b = U.box; ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.fillStyle = 'rgba(140,255,170,0.12)'; ctx.lineWidth = 1; const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
  for (let i = R.pings.length - 1; i >= 0; i--) { const p = R.pings[i]; p.t += dt; if (p.t > 2.4) R.pings.splice(i, 1); }
};
/* Überlagerungen in Weltkoordinaten (2D-Modus): Warnkreise, Aufdeckungen, Missionsmarken, Auswahl, Balken, Vorschau */
function drawOverlay2D(ctx, g, inV, lowZ, vp, dt) {
  const cam = R.cam, m = g.map;
  /* Massetreiber: Warnkreis am Ziel (für alle sichtbar), Masse im Flug */
  for (const st of g.strikes) {
    const k = 1 - st.t / 3.5;
    ctx.strokeStyle = 'rgba(255,91,71,' + (0.5 + 0.4 * Math.sin(R.time * 12)) + ')'; ctx.lineWidth = 2.5 / cam.z; ctx.setLineDash([8 / cam.z, 6 / cam.z]); ctx.lineDashOffset = -R.time * 60; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,91,71,0.8)'; ctx.lineWidth = 3 / cam.z; ctx.beginPath(); ctx.arc(st.x, st.y, st.r * k, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff5b47'; ctx.font = (14 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(st.t) + '', st.x, st.y + 5 / cam.z);
    const px = st.sx + (st.x - st.sx) * k, py = st.sy + (st.y - st.sy) * k - Math.sin(k * Math.PI) * 220;
    if (inV(px, py, 100)) { glowAt(ctx, px, py, 26, '#ffb070', 0.9); ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill(); if (R.detail > 1) { fxTrail(px, py, '#ff9a50'); fxSpark(px, py, 1, 40, '#ffd27a', 0.3); } }
  }
  /* Aufdeckungen des eigenen Teams */
  if (vp >= 0) for (const rv of g.reveals) if (g.tm[rv.owner] === g.tm[vp] && rv.r < 3000 && inV(rv.x, rv.y, rv.r)) { ctx.strokeStyle = 'rgba(143,227,255,0.25)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 8 / cam.z]); ctx.lineDashOffset = R.time * 20; ctx.beginPath(); ctx.arc(rv.x, rv.y, rv.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  /* Bergung und Tarnung (wie in 3D) */
  if (R.wantSalvage()) for (const w of g.wrecks) if (w.sal > 0 && inV(w.x, w.y, 60) && R.seen(w.x, w.y)) { ctx.strokeStyle = 'rgba(255,211,107,0.6)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(w.x, w.y, 34, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffd36b'; ctx.font = (12 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(Math.round(w.sal) + '', w.x, w.y - 40); }
  if (vp >= 0) for (const u of g.ships) if (!u.dead && u.abT.cloak > 0 && g.tm[u.owner] === g.tm[vp] && inV(u.x, u.y, 80)) { ctx.strokeStyle = 'rgba(143,227,255,0.45)'; ctx.lineWidth = 1.2 / cam.z; ctx.setLineDash([5 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(u.x, u.y, u.def.r + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  /* Missionsmarken: Zielorte mit Namen, erfüllte grün */
  if (g.mis && g.mis.marks && vp >= 0) for (const mk of g.mis.marks) {
    if (!inV(mk.x, mk.y, mk.r + 60)) continue;
    const col = mk.done ? '125,220,107' : '255,184,107', pulse = 0.55 + 0.3 * Math.sin(R.time * 3);
    ctx.strokeStyle = 'rgba(' + col + ',' + (mk.done ? 0.5 : pulse) + ')'; ctx.lineWidth = 2 / cam.z;
    ctx.setLineDash([12 / cam.z, 8 / cam.z]); ctx.lineDashOffset = -R.time * 25; ctx.beginPath(); ctx.arc(mk.x, mk.y, mk.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(' + col + ',0.06)'; ctx.beginPath(); ctx.arc(mk.x, mk.y, mk.r, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + R.time * 0.4, r0 = mk.r + 6, r1 = mk.r + 18; ctx.beginPath(); ctx.moveTo(mk.x + Math.cos(a) * r0, mk.y + Math.sin(a) * r0); ctx.lineTo(mk.x + Math.cos(a) * r1, mk.y + Math.sin(a) * r1); ctx.stroke(); }
    if (mk.t && !lowZ) { ctx.fillStyle = 'rgba(' + col + ',0.95)'; ctx.font = '600 ' + (14 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText((mk.done ? '✓ ' : '') + T(mk.t), mk.x, mk.y - mk.r - 10 / cam.z); }
  }
  /* Auswahl, Balken, Rangabzeichen, Stufen */
  const U = typeof UI !== 'undefined' ? UI : null;
  if (U && !U.attract) {
    for (const u of g.ships) {
      if (u.dead || !inV(u.x, u.y, 60) || !R.visible(u)) continue;
      const sel = U.sel.has(u.id);
      if (sel) { ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([5 / cam.z, 4 / cam.z]); ctx.beginPath(); ctx.arc(u.x, u.y, u.def.r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); if (u.o.x !== undefined && (u.o.t === 'move' || u.o.t === 'amove' || u.o.t === 'attack')) { ctx.strokeStyle = u.o.t === 'move' ? 'rgba(140,255,170,0.35)' : 'rgba(255,120,90,0.35)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.o.x, u.o.y); ctx.stroke(); } }
      if (R.hover === u.id && !sel) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(u.x, u.y, u.def.r + 6, 0, TAU); ctx.stroke(); }
      if (!lowZ && u.def.role !== 'fighter' && (sel || u.hull < u.hullMax || u.shield < u.shieldMax || U.showAll)) drawBars(ctx, u, Math.max(18, u.def.r * 2.2));
      if (!lowZ && u.rank) drawChevrons(ctx, u.x + u.def.r + 6, u.y - u.def.r, u.rank, '#ffd27a');
    }
    for (const b of g.bldgs) {
      if (b.dead || !inV(b.x, b.y, 80) || !R.seen(b.x, b.y)) continue;
      const sel = U.selB === b.id;
      if (sel) { ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(b.x, b.y, b.def.r + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); if (b.rally) { ctx.strokeStyle = 'rgba(140,255,170,0.4)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 6 / cam.z, 0, TAU); ctx.stroke(); } if (b.role === 'shield' && b.done) { ctx.strokeStyle = 'rgba(143,227,255,0.35)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(b.x, b.y, lvOf(b).aura, 0, TAU); ctx.stroke(); } }
      if (!lowZ && b.done && (sel || b.hull < b.hullMax || U.showAll || isFoeV(b.owner) && R.visible(b))) drawBars(ctx, b, Math.max(30, b.def.r * 1.6));
      if (!lowZ && b.done) drawChevrons(ctx, b.x, b.y - b.def.r - 4 / cam.z, b.lv, pcol(b.owner));
      if (!b.done && !b.bld && b.owner === vp && (R.frameN % 60) < 30) { ctx.fillStyle = '#ffc23e'; ctx.font = (12 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(L('Bauschiff fehlt'), b.x, b.y - b.def.r - 8 / cam.z); }
    }
    /* Stätte oder Tor gewählt */
    if (U.selS) { const o = g.byId.get(U.selS); if (o) { ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 5 / cam.z]); ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(159,240,192,0.25)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + (o.k === 5 ? 180 : o.kind === 'ruin' ? 110 : 200), 0, TAU); ctx.stroke(); if (o.k === 5 && o.pair) { const q = g.byId.get(o.pair); if (q) { ctx.strokeStyle = 'rgba(159,240,192,0.3)'; ctx.setLineDash([10 / cam.z, 10 / cam.z]); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); } } } }
    /* Netz des Nexus: beim Bauen und bei gewählten Knoten */
    if (vp >= 0 && g.players[vp].faction === 'nexus' && (U.place || U.selB || [...U.sel].some(id => { const u = g.byId.get(id); return u && (u.def.node || u.def.build); }))) {
      const P = g.players[vp];
      ctx.strokeStyle = 'rgba(201,160,255,0.22)'; ctx.fillStyle = 'rgba(201,160,255,0.05)'; ctx.lineWidth = 1 / cam.z;
      for (const b of g.bldgs) if (!b.dead && b.owner === vp && b.done && !b.off && inV(b.x, b.y, 700)) { const rr = netRange(g, P, b); ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.fill(); ctx.stroke(); }
      for (const u of g.ships) if (!u.dead && u.owner === vp && u.def.node && !u.derelict && inV(u.x, u.y, 500)) { const rr = netRange(g, P, u); ctx.beginPath(); ctx.arc(u.x, u.y, rr, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
    /* Reichweiten der Auswahl */
    if (U.showRange) for (const id of U.sel) { const u = g.byId.get(id); if (!u || u.dead) continue; const r = maxRange(u.def); if (r) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, TAU); ctx.stroke(); for (const w of u.def.wpn) if (w.kind !== 'pd' && w.arc < Math.PI) { ctx.strokeStyle = 'rgba(255,200,120,0.3)'; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.arc(u.x, u.y, w.range, u.ang + w.mount - w.arc, u.ang + w.mount + w.arc); ctx.closePath(); ctx.stroke(); } } }
    /* Fassung 22: Verbindungen der gewählten Station / der Bauvorschau (gestrichelt, nur eigene) und Fundamente */
    { const C = connGather(g, vp, U);
      ctx.lineWidth = 1.2 / cam.z;
      for (const l of C.lines) { if (!inV((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, hyp(l.x1 - l.x0, l.y1 - l.y0) / 2 + 40)) continue; ctx.strokeStyle = l.col; ctx.globalAlpha = l.a; ctx.setLineDash([6 / cam.z, 6 / cam.z]); ctx.lineDashOffset = l.march ? -R.time * 30 / cam.z : 0; ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke(); }
      for (const r of C.rings) { if (!inV(r.x, r.y, r.r)) continue; ctx.strokeStyle = r.col; ctx.globalAlpha = r.a; ctx.setLineDash([5 / cam.z, 7 / cam.z]); ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
      for (const t of C.texts) { ctx.fillStyle = t.col; ctx.font = '600 ' + (13 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(t.txt, t.x, t.y + t.dy); }
      for (const f of foundList(g, vp)) if (inV(f.x, f.y, f.r + 20)) { const hot = U.place && U.place.role === f.role; ctx.strokeStyle = hot ? 'rgba(125,255,154,0.8)' : 'rgba(180,255,220,0.4)'; ctx.lineWidth = (hot ? 2 : 1.2) / cam.z; ctx.setLineDash([4 / cam.z, 4 / cam.z]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); if (!lowZ) { ctx.fillStyle = ctx.strokeStyle; ctx.font = (11 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(L('Fundament') + ' ' + Math.ceil(f.until - g.time) + ' s', f.x, f.y + f.r + 13 / cam.z); } }
    }
    /* Bauplatz-Vorschau */
    if (U.place) {
      const pl = U.place, def = BLDG[g.players[vp].faction][pl.role];
      for (const b of g.bldgs) if (!b.dead && b.owner === vp && b.done && inV(b.x, b.y, 800)) { ctx.strokeStyle = 'rgba(140,255,170,0.12)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(b.x, b.y, b.role === 'base' ? BUILD_RANGE_BASE : BUILD_RANGE, 0, TAU); ctx.stroke(); }
      /* Fassung 22: Reihe – je Platz eine Vorschau (rot = wird übersprungen), Summe am Ende */
      if (pl.row && pl.pts) {
        ctx.strokeStyle = 'rgba(140,255,170,0.35)'; ctx.lineWidth = 1 / cam.z; ctx.setLineDash([8 / cam.z, 6 / cam.z]); ctx.beginPath(); ctx.moveTo(pl.ax, pl.ay); ctx.lineTo(pl.x, pl.y); ctx.stroke(); ctx.setLineDash([]);
        for (const q of pl.pts) { ctx.save(); ctx.translate(q.x, q.y); ctx.globalAlpha = q.ok ? 0.5 : 0.18; drawBldg(ctx, pl.role, g.players[vp].faction, 1, pcol(vp), R.time, null); ctx.restore(); ctx.strokeStyle = q.ok ? 'rgba(140,255,170,0.9)' : 'rgba(255,91,71,0.8)'; ctx.lineWidth = 2 / cam.z; ctx.beginPath(); ctx.arc(q.x, q.y, def.r + 4, 0, TAU); ctx.stroke(); }
        const q = pl.pts[pl.pts.length - 1]; ctx.fillStyle = pl.ok ? '#9ff0c0' : '#ff8a7a'; ctx.font = '600 ' + (13 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(pl.n + ' × · ' + costTxt(pl.cost), q.x, q.y + def.r + 20 / cam.z);
      } else {
      ctx.save(); ctx.translate(pl.x, pl.y); ctx.globalAlpha = 0.55; drawBldg(ctx, pl.role, g.players[vp].faction, 1, pcol(vp), R.time, null); ctx.restore();
      ctx.strokeStyle = pl.ok ? 'rgba(140,255,170,0.9)' : 'rgba(255,91,71,0.9)'; ctx.lineWidth = 2 / cam.z; ctx.beginPath(); ctx.arc(pl.x, pl.y, def.r + 4, 0, TAU); ctx.stroke();
      if (pl.fast && !lowZ) { ctx.fillStyle = '#7dff9a'; ctx.font = '600 ' + (12 / cam.z) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(L('Fundament: baut 50 % schneller'), pl.x, pl.y + def.r + 18 / cam.z); }
      }
      if (pl.role === 'shield') { ctx.strokeStyle = 'rgba(143,227,255,0.3)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(pl.x, pl.y, def.lv[0].aura, 0, TAU); ctx.stroke(); }
      if (def.lv[0].wpn.length) { ctx.strokeStyle = 'rgba(255,200,120,0.3)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(pl.x, pl.y, Math.max(...def.lv[0].wpn.map(w => w.range)), 0, TAU); ctx.stroke(); }
    }
    /* Superwaffe: Umkreis am Tor / Zielvorschau */
    if (U.mode === 'super') { const sb = g.byId.get(U.selB); if (sb && sb.role === 'super') { const lv = lvOf(sb); if (g.players[vp].faction === 'alliance') { ctx.strokeStyle = 'rgba(143,227,255,0.45)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([6 / cam.z, 6 / cam.z]); ctx.beginPath(); ctx.arc(sb.x, sb.y, lv.sr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } if (U.superTgt) { const t = U.superTgt; ctx.strokeStyle = 'rgba(255,184,107,0.9)'; ctx.lineWidth = 2 / cam.z; ctx.beginPath(); ctx.arc(t.x, t.y, g.players[vp].faction === 'alliance' ? 60 : lv.sr, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(t.x - 12 / cam.z, t.y); ctx.lineTo(t.x + 12 / cam.z, t.y); ctx.moveTo(t.x, t.y - 12 / cam.z); ctx.lineTo(t.x, t.y + 12 / cam.z); ctx.stroke(); } } }
    /* Entern: Reichweite */
    if (U.mode === 'board') for (const id of U.sel) { const u = g.byId.get(id); if (u && !u.dead && u.def.marines) { ctx.strokeStyle = 'rgba(255,184,107,0.4)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath(); ctx.arc(u.x, u.y, ABIL.board.r + u.def.r, 0, TAU); ctx.stroke(); } }
    /* Zielmarke eines Befehls */
    if (U.mark && R.time - U.mark.t < 0.6) { const k = (R.time - U.mark.t) / 0.6; ctx.strokeStyle = U.mark.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2 / cam.z; ctx.beginPath(); ctx.arc(U.mark.x, U.mark.y, (6 + 18 * (1 - k)) / cam.z, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
}

/* ------------------------------------------------------------------ 3D-Darstellung
   Die Welt zeichnet RA3D (render3d.js); hier bleiben: Kamera ableiten, Nebel des Krieges berechnen, Linien und Kreise am Boden
   als Sofort-Primitive an RA3D geben, danach auf der durchsichtigen 2D-Leinwand die Bildschirm-Überlagerungen (Balken,
   Rangabzeichen, Texte, Auswahlrahmen). */
R.frame = function (alpha, dt) {
  if (!R.mode3d) return frame2D(alpha, dt);
  const g = R.g, ctx = R.ctx, cam = R.cam, vp = R.vp;
  R.time += dt; R.dt = dt; R.frameN++;
  if (!g) return;
  fxStep(dt);
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 14);
  /* Kamera und sichtbarer Weltausschnitt aus den vier Ecken (für inView) – nur bei Kamerawechsel neu */
  if (R.cam3() || !R.vb || R.vbKey !== R.c3w + 'x' + R.c3h) {
    R.vbKey = R.c3w + 'x' + R.c3h;
    const c0 = RA3D.unproject(0, 0), c1 = RA3D.unproject(R.cssW, 0), c2 = RA3D.unproject(0, R.cssH), c3 = RA3D.unproject(R.cssW, R.cssH);
    if (c0 && c1 && c2 && c3) R.vb = { x0: Math.min(c0.x, c1.x, c2.x, c3.x) - 60, x1: Math.max(c0.x, c1.x, c2.x, c3.x) + 60, y0: Math.min(c0.y, c1.y, c2.y, c3.y) - 60, y1: Math.max(c0.y, c1.y, c2.y, c3.y) + 60 };
  }
  if (vp >= 0 && R.time - R.fogT > 0.15) { R.fogT = R.time; fogUpdate(); }
  const inV = (x, y, m) => R.inView(x, y, m), lowZ = cam.z < 0.45;
  R.hud = [];
  drawOverlay3D(g, inV, lowZ, vp);
  RA3D.frame(g, dt, R.time, { vp, seen: R.seen, visible: R.visible, pcol, fog: vp >= 0 ? R.fogCv : null, detail: R.detail, shake: R.shake });
  /* 2D-Leinwand: nur Bildschirm-Überlagerungen */
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, R.W, R.H);
  if (g.flareOn) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,80,' + (0.08 + 0.05 * Math.sin(R.time * 9)) + ')'; ctx.fillRect(0, 0, R.W, R.H); ctx.globalCompositeOperation = 'source-over'; }
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  for (const h of R.hud) {
    const q = RA3D.project(h.x, h.y); if (!q) continue;
    if (h.k === 'bars') bars3D(ctx, h.e, q, h.w);
    else if (h.k === 'chev') { const sc = Math.min(1.4, Math.max(0.7, q.s)); ctx.strokeStyle = h.col; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < h.n; i++) { const yy = q.y + h.dy * sc - i * 5 * sc, sz = 4 * sc; ctx.beginPath(); ctx.moveTo(q.x + h.dx * sc - sz, yy + sz * 0.6); ctx.lineTo(q.x + h.dx * sc, yy - sz * 0.4); ctx.lineTo(q.x + h.dx * sc + sz, yy + sz * 0.6); ctx.stroke(); } }
    else if (h.k === 'text') { ctx.fillStyle = h.col; ctx.font = (h.bold ? '600 ' : '') + (h.size || 13) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(h.txt, q.x, q.y + (h.dy || 0) * Math.min(1.4, Math.max(0.7, q.s))); }
  }
  /* Texte der Effekte (Treffer, Ränge, Lieferungen) */
  for (const o of FX.list) if (o.k === 'text') { const q = RA3D.project(o.x, o.y); if (!q) continue; const k = o.t / o.life; ctx.globalAlpha = 1 - k * k; ctx.fillStyle = o.col; ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(o.txt, q.x, q.y - 14 - k * 26); }
  ctx.globalAlpha = 1;
  const U = typeof UI !== 'undefined' ? UI : null;
  if (U && U.box) { const b = U.box; ctx.strokeStyle = 'rgba(140,255,170,0.9)'; ctx.fillStyle = 'rgba(140,255,170,0.12)'; ctx.lineWidth = 1; const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
  for (let i = R.pings.length - 1; i >= 0; i--) { const p = R.pings[i]; p.t += dt; if (p.t > 2.4) R.pings.splice(i, 1); }
};
/* Lebens- und Schildbalken am Bildschirm (3D): Breite nach Objektgröße und Abstand, mindestens 18 px */
function bars3D(ctx, e, q, w) {
  const sc = Math.min(2, Math.max(0.6, q.s)), W = Math.max(18, Math.min(90, w * sc)), h = 3, x = q.x - W / 2, y = q.y - e.def.r * sc - 12;
  const hull = e.hull / e.hullMax, foe = isFoeV(e.owner), two = e.shieldMax || e.give;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, W + 2, h + 2 + (two ? h + 1 : 0));
  ctx.fillStyle = foe ? '#ff5b47' : hull > 0.5 ? '#7ddc6b' : hull > 0.25 ? '#ffc23e' : '#ff5b47';
  ctx.fillRect(x, y + (two ? h + 1 : 0), W * clamp(hull, 0, 1), h);
  if (two) { const sm = (e.shieldMax || 0) + (e.givep || 0), sv = (e.shield || 0) + (e.give || 0); ctx.fillStyle = '#8fe3ff'; ctx.fillRect(x, y, W * clamp(sm ? sv / sm : 0, 0, 1), h); }
}
/* Überlagerungen am Boden (3D): dieselben Inhalte wie drawOverlay2D, als Kreise/Linien für RA3D und HUD-Einträge */
function drawOverlay3D(g, inV, lowZ, vp) {
  const ring = (x, y, r, col, w, o) => RA3D.ring(x, y, r, col, w || 1, o), line = (x0, y0, x1, y1, col, w, o) => RA3D.line(x0, y0, x1, y1, col, w || 1, o), disc = (x, y, r, col, a) => RA3D.disc(x, y, r, col, a);
  const hud = R.hud, GREEN = '#8cffaa', m = g.map;
  /* Bauschiff am Werk, Frachter beim Abbau, Sporen-Auren, Zusatzschild */
  for (const u of g.ships) if (!u.dead && R.visible(u) && inV(u.x, u.y, 120)) {
    if (u.o.t === 'build') { const b = g.byId.get(u.o.bid); if (b && !b.done && hyp(u.x - b.x, u.y - b.y) < b.def.r + u.def.r + 70) line(u.x, u.y, b.x, b.y, '#b4ffdc', 1.5, { alpha: 0.55 }); }
    if (u.o.t === 'harvest' && u.mine) { const n = g.byId.get(u.mine); if (n && hyp(u.x - n.x, u.y - n.y) < n.r + u.def.r + 40) line(u.x, u.y, n.x, n.y, n.kind === 'ice' ? '#8fe3ff' : '#ffb86b', 1.2, { alpha: 0.5 }); }
  }
  for (const b of g.bldgs) if (!b.dead && b.done && inV(b.x, b.y, 400) && R.visible(b)) {
    if (b.role === 'spore') { disc(b.x, b.y, lvOf(b).aura, '#b4ff3c', 0.1); ring(b.x, b.y, lvOf(b).aura, '#b4ff3c', 1, { dash: 1, alpha: 0.3 }); }
    if (b.give > 0) ring(b.x, b.y, b.def.r * 1.15, '#8fe3ff', 2, { alpha: 0.2 });
    if (b.role === 'refinery' && R.cam.z > 0.35) for (const d of dockSpots(b)) { if (d.on) disc(d.x, d.y, 7, '#7dff9a', 0.25 + 0.1 * Math.sin(R.time * 4 + d.x)); disc(d.x, d.y, d.on ? 2.8 : 2.2, d.on ? '#c8ffd6' : '#ffc23e', d.on ? 0.95 : 0.55); } /* Fassung 22: Andocklichter */
    if (b.role === 'super') ring(b.x, b.y, b.def.r + 4, '#ffb86b', 3, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * Math.min(1, b.charge), alpha: b.charge >= 1 ? 0.6 + 0.3 * Math.sin(R.time * 5) : 0.55 });
    if (b.off && !lowZ && (R.frameN % 60) < 40) hud.push({ k: 'text', x: b.x, y: b.y, txt: L('Kein Netz'), col: '#ff5b47', dy: b.def.r * 0.6 + 14 });
  }
  for (const sp of g.spores) if (inV(sp.x, sp.y, sp.r + 40)) disc(sp.x, sp.y, sp.r, '#b4ff3c', 0.16 * Math.min(1, sp.t / 5));
  /* Bergung: lohnende Wracks markieren, solange Frachter gewählt sind; getarnte eigene Schiffe */
  if (R.wantSalvage()) for (const w of g.wrecks) if (w.sal > 0 && inV(w.x, w.y, 60) && R.seen(w.x, w.y)) { ring(w.x, w.y, 34, '#ffd36b', 1.5, { dash: 1, alpha: 0.6 }); if (!lowZ) hud.push({ k: 'text', x: w.x, y: w.y, txt: Math.round(w.sal) + '', col: '#ffd36b', size: 12, dy: -30 }); }
  if (vp >= 0) for (const u of g.ships) if (!u.dead && u.abT.cloak > 0 && g.tm[u.owner] === g.tm[vp] && inV(u.x, u.y, 80)) ring(u.x, u.y, u.def.r + 12, '#8fe3ff', 1.2, { dash: 1, alpha: 0.45 });
  /* Massetreiber: Warnkreis am Ziel, Masse im Flug */
  for (const st of g.strikes) {
    const k = 1 - st.t / 3.5;
    ring(st.x, st.y, st.r, '#ff5b47', 2.5, { dash: 1, alpha: 0.5 + 0.4 * Math.sin(R.time * 12) }); ring(st.x, st.y, st.r * k, '#ff5b47', 3, { alpha: 0.8 });
    hud.push({ k: 'text', x: st.x, y: st.y, txt: Math.ceil(st.t) + '', col: '#ff5b47', size: 14, dy: 5 });
    const px = st.sx + (st.x - st.sx) * k, py = st.sy + (st.y - st.sy) * k; disc(px, py, 7, '#ffd27a', 0.9);
  }
  if (vp >= 0) for (const rv of g.reveals) if (g.tm[rv.owner] === g.tm[vp] && rv.r < 3000 && inV(rv.x, rv.y, rv.r)) ring(rv.x, rv.y, rv.r, '#8fe3ff', 1.5, { dash: 1, alpha: 0.25 });
  if (g.mis && g.mis.marks && vp >= 0) for (const mk of g.mis.marks) {
    if (!inV(mk.x, mk.y, mk.r + 60)) continue;
    const col = mk.done ? '#7ddc6b' : '#ffb86b', pulse = 0.55 + 0.3 * Math.sin(R.time * 3);
    ring(mk.x, mk.y, mk.r, col, 2, { dash: 1, alpha: mk.done ? 0.5 : pulse }); disc(mk.x, mk.y, mk.r, col, 0.06);
    if (mk.t && !lowZ) hud.push({ k: 'text', x: mk.x, y: mk.y, txt: (mk.done ? '✓ ' : '') + T(mk.t), col, bold: true, size: 14, dy: -mk.r * 0.5 - 10 });
  }
  const U = typeof UI !== 'undefined' ? UI : null;
  if (!U || U.attract) return;
  for (const u of g.ships) {
    if (u.dead || !inV(u.x, u.y, 60) || !R.visible(u)) continue;
    const sel = U.sel.has(u.id);
    if (sel) { ring(u.x, u.y, u.def.r + 6, GREEN, 1.5, { dash: 1, alpha: 0.9 }); if (u.o.x !== undefined && (u.o.t === 'move' || u.o.t === 'amove' || u.o.t === 'attack')) line(u.x, u.y, u.o.x, u.o.y, u.o.t === 'move' ? GREEN : '#ff785a', 1, { alpha: 0.35 }); }
    if (R.hover === u.id && !sel) ring(u.x, u.y, u.def.r + 6, '#ffffff', 1, { alpha: 0.5 });
    if (!lowZ && u.def.role !== 'fighter' && (sel || u.hull < u.hullMax || u.shield < u.shieldMax || U.showAll)) hud.push({ k: 'bars', x: u.x, y: u.y, e: u, w: Math.max(18, u.def.r * 2.2) });
    if (!lowZ && u.rank) hud.push({ k: 'chev', x: u.x, y: u.y, n: u.rank, col: '#ffd27a', dx: u.def.r + 6, dy: -u.def.r });
  }
  for (const b of g.bldgs) {
    if (b.dead || !inV(b.x, b.y, 80) || !R.seen(b.x, b.y)) continue;
    const sel = U.selB === b.id;
    if (sel) { ring(b.x, b.y, b.def.r + 8, GREEN, 1.5, { dash: 1, alpha: 0.9 }); if (b.rally) { line(b.x, b.y, b.rally.x, b.rally.y, GREEN, 1, { alpha: 0.4 }); ring(b.rally.x, b.rally.y, 6, GREEN, 1, { alpha: 0.6 }); } if (b.role === 'shield' && b.done) ring(b.x, b.y, lvOf(b).aura, '#8fe3ff', 1, { alpha: 0.35 }); }
    if (!lowZ && b.done && (sel || b.hull < b.hullMax || U.showAll || isFoeV(b.owner) && R.visible(b))) hud.push({ k: 'bars', x: b.x, y: b.y, e: b, w: Math.max(30, b.def.r * 1.6) });
    if (!lowZ && b.done) hud.push({ k: 'chev', x: b.x, y: b.y, n: b.lv, col: pcol(b.owner), dx: 0, dy: -b.def.r - 4 });
    if (!b.done && !b.bld && b.owner === vp && (R.frameN % 60) < 30) hud.push({ k: 'text', x: b.x, y: b.y, txt: L('Bauschiff fehlt'), col: '#ffc23e', dy: -b.def.r - 8 });
  }
  if (U.selS) { const o = g.byId.get(U.selS); if (o) { ring(o.x, o.y, o.r + 10, GREEN, 1.5, { dash: 1, alpha: 0.9 }); ring(o.x, o.y, o.r + (o.k === 5 ? 180 : o.kind === 'ruin' ? 110 : 200), '#9ff0c0', 1, { alpha: 0.25 }); if (o.k === 5 && o.pair) { const q = g.byId.get(o.pair); if (q) line(o.x, o.y, q.x, q.y, '#9ff0c0', 1, { dash: 1, alpha: 0.3 }); } } }
  if (vp >= 0 && g.players[vp].faction === 'nexus' && (U.place || U.selB || [...U.sel].some(id => { const u = g.byId.get(id); return u && (u.def.node || u.def.build); }))) {
    const P = g.players[vp];
    for (const b of g.bldgs) if (!b.dead && b.owner === vp && b.done && !b.off && inV(b.x, b.y, 700)) { const rr = netRange(g, P, b); disc(b.x, b.y, rr, '#c9a0ff', 0.05); ring(b.x, b.y, rr, '#c9a0ff', 1, { alpha: 0.22 }); }
    for (const u of g.ships) if (!u.dead && u.owner === vp && u.def.node && !u.derelict && inV(u.x, u.y, 500)) { const rr = netRange(g, P, u); disc(u.x, u.y, rr, '#c9a0ff', 0.05); ring(u.x, u.y, rr, '#c9a0ff', 1, { alpha: 0.22 }); }
  }
  if (U.showRange) for (const id of U.sel) { const u = g.byId.get(id); if (!u || u.dead) continue; const r = maxRange(u.def); if (r) { ring(u.x, u.y, r, '#ffffff', 1, { alpha: 0.22 }); for (const w of u.def.wpn) if (w.kind !== 'pd' && w.arc < Math.PI) ring(u.x, u.y, w.range, '#ffc878', 1, { alpha: 0.3, a0: u.ang + w.mount - w.arc, a1: u.ang + w.mount + w.arc }); } }
  /* Fassung 22: Verbindungen, Fundamente */
  { const C = connGather(g, vp, U);
    for (const l of C.lines) if (inV((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, hyp(l.x1 - l.x0, l.y1 - l.y0) / 2 + 40)) line(l.x0, l.y0, l.x1, l.y1, l.col, 1.2, { dash: 6, march: l.march, alpha: l.a });
    for (const r of C.rings) if (inV(r.x, r.y, r.r)) ring(r.x, r.y, r.r, r.col, 1, { dash: 5, alpha: r.a });
    for (const t of C.texts) hud.push({ k: 'text', x: t.x, y: t.y, txt: t.txt, col: t.col, bold: true, size: 13, dy: t.dy * 0.6 });
    for (const f of foundList(g, vp)) if (inV(f.x, f.y, f.r + 20)) { const hot = U.place && U.place.role === f.role; ring(f.x, f.y, f.r, hot ? '#7dff9a' : '#b4ffdc', hot ? 2 : 1.2, { dash: 4, alpha: hot ? 0.8 : 0.4 }); if (!lowZ) hud.push({ k: 'text', x: f.x, y: f.y, txt: L('Fundament') + ' ' + Math.ceil(f.until - g.time) + ' s', col: hot ? '#7dff9a' : '#b4ffdc', size: 11, dy: f.r * 0.6 + 12 }); }
  }
  if (U.place) {
    const pl = U.place, f = g.players[vp].faction, def = BLDG[f][pl.role];
    for (const b of g.bldgs) if (!b.dead && b.owner === vp && b.done && inV(b.x, b.y, 800)) ring(b.x, b.y, b.role === 'base' ? BUILD_RANGE_BASE : BUILD_RANGE, GREEN, 1, { alpha: 0.12 });
    if (pl.row && pl.pts) {
      line(pl.ax, pl.ay, pl.x, pl.y, GREEN, 1, { dash: 8, alpha: 0.35 });
      pl.pts.forEach((q, i) => { RA3D.ghost(f, pl.role, 1, q.x, q.y, !!q.ok, i); ring(q.x, q.y, def.r + 4, q.ok ? GREEN : '#ff5b47', 2, { alpha: q.ok ? 0.9 : 0.7 }); });
      const q = pl.pts[pl.pts.length - 1]; hud.push({ k: 'text', x: q.x, y: q.y, txt: pl.n + ' × · ' + costTxt(pl.cost), col: pl.ok ? '#9ff0c0' : '#ff8a7a', bold: true, size: 13, dy: def.r * 0.6 + 18 });
    } else {
      RA3D.ghost(f, pl.role, 1, pl.x, pl.y, !!pl.ok);
      ring(pl.x, pl.y, def.r + 4, pl.ok ? GREEN : '#ff5b47', 2, { alpha: 0.9 });
      if (pl.fast && !lowZ) hud.push({ k: 'text', x: pl.x, y: pl.y, txt: L('Fundament: baut 50 % schneller'), col: '#7dff9a', bold: true, size: 12, dy: def.r * 0.6 + 16 });
    }
    if (pl.role === 'shield') ring(pl.x, pl.y, def.lv[0].aura, '#8fe3ff', 1, { alpha: 0.3 });
    if (def.lv[0].wpn.length) ring(pl.x, pl.y, Math.max(...def.lv[0].wpn.map(w => w.range)), '#ffc878', 1, { alpha: 0.3 });
  }
  if (U.mode === 'super') { const sb = g.byId.get(U.selB); if (sb && sb.role === 'super') { const lv = lvOf(sb); if (g.players[vp].faction === 'alliance') ring(sb.x, sb.y, lv.sr, '#8fe3ff', 1.5, { dash: 1, alpha: 0.45 }); if (U.superTgt) { const t = U.superTgt, rr = g.players[vp].faction === 'alliance' ? 60 : lv.sr; ring(t.x, t.y, rr, '#ffb86b', 2, { alpha: 0.9 }); line(t.x - 12, t.y, t.x + 12, t.y, '#ffb86b', 2); line(t.x, t.y - 12, t.x, t.y + 12, '#ffb86b', 2); } } }
  if (U.mode === 'board') for (const id of U.sel) { const u = g.byId.get(id); if (u && !u.dead && u.def.marines) ring(u.x, u.y, ABIL.board.r + u.def.r, '#ffb86b', 1, { alpha: 0.4 }); }
  if (U.mark && R.time - U.mark.t < 0.6) { const k = (R.time - U.mark.t) / 0.6; ring(U.mark.x, U.mark.y, (6 + 18 * (1 - k)) / Math.max(0.5, R.cam.z), U.mark.col, 2, { alpha: 1 - k }); }
}

/* ------------------------------------------------------------------ Minikarte */
R.miniToWorld = function (fx, fy) { const m = R.g.map; return { x: fx * m.w, y: fy * m.h }; };
R.drawMini = function () {
  const g = R.g, c = R.mini, ctx = R.mctx, W = c.width, H = c.height;
  if (!g || !W) return;
  const m = g.map, sx = W / m.w, sy = H / m.h;
  if (!R.miniBase || R.miniBase.width !== W) {
    const b = document.createElement('canvas'); b.width = W; b.height = H;
    const x = b.getContext('2d');
    x.fillStyle = '#05070f'; x.fillRect(0, 0, W, H);
    const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(60,20,12,0.6)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,20,12,0.6)');
    x.strokeStyle = 'rgba(120,40,20,0.8)'; x.lineWidth = Math.max(2, EDGE * sx); x.strokeRect(0, 0, W, H);
    for (const n of m.nebs || []) { x.fillStyle = n.kind === 'ash' ? 'rgba(255,90,60,0.4)' : 'rgba(120,110,255,0.35)'; x.beginPath(); x.arc(n.x * sx, n.y * sy, n.r * sx, 0, TAU); x.fill(); }
    for (const f of m.fields) { x.fillStyle = 'rgba(110,100,90,0.35)'; x.beginPath(); x.arc(f.x * sx, f.y * sy, f.r * sx, 0, TAU); x.fill(); }
    for (const o of m.rocks) { x.fillStyle = '#5a554f'; x.beginPath(); x.arc(o.x * sx, o.y * sy, Math.max(1, o.r * sx), 0, TAU); x.fill(); }
    R.miniBase = b;
  }
  ctx.drawImage(R.miniBase, 0, 0);
  for (const n of g.nodes) { ctx.fillStyle = n.amount > 0 ? (n.kind === 'ice' ? '#8fc3e6' : '#c89050') : '#555'; ctx.beginPath(); ctx.arc(n.x * sx, n.y * sy, Math.max(1.5, n.r * sx), 0, TAU); ctx.fill(); }
  const vp = R.vp;
  for (const st of g.sites) { if (vp >= 0 && !R.seen(st.x, st.y)) continue; ctx.strokeStyle = st.kind === 'ruin' ? (st.scanned ? '#556' : '#9ff0c0') : st.owner >= 0 ? pcol(st.owner) : '#9ff0c0'; ctx.lineWidth = 1; const r = st.kind === 'ruin' ? 2.5 : 4; ctx.beginPath(); ctx.arc(st.x * sx, st.y * sy, r, 0, TAU); ctx.stroke(); }
  for (const gt of g.gates) { if (vp >= 0 && !R.seen(gt.x, gt.y)) continue; ctx.strokeStyle = gt.owner >= 0 ? pcol(gt.owner) : gt.state === 'flicker' ? '#9ff0c0' : '#667'; ctx.lineWidth = 1.5; const r = 4; ctx.beginPath(); ctx.moveTo(gt.x * sx - r, gt.y * sy); ctx.lineTo(gt.x * sx, gt.y * sy - r); ctx.lineTo(gt.x * sx + r, gt.y * sy); ctx.lineTo(gt.x * sx, gt.y * sy + r); ctx.closePath(); ctx.stroke(); }
  for (const b of g.bldgs) { if (b.dead || (vp >= 0 && !R.seen(b.x, b.y))) continue; ctx.fillStyle = pcol(b.owner); const r = Math.max(2, b.def.r * sx * 0.9); ctx.fillRect(b.x * sx - r, b.y * sy - r, r * 2, r * 2); }
  for (const u of g.ships) { if (u.dead || u.def.role === 'fighter' || (vp >= 0 && !R.visible(u))) continue; ctx.fillStyle = pcol(u.owner); const r = Math.max(1.2, u.def.r * sx * 0.8); ctx.fillRect(u.x * sx - r, u.y * sy - r, r * 2, r * 2); }
  /* Nebel */
  if (vp >= 0) { ctx.save(); ctx.globalAlpha = 0.75; ctx.imageSmoothingEnabled = false; ctx.drawImage(R.fogCv, 0, 0, W, H); ctx.restore(); }
  if (g.wave && g.wave.open) for (const r0 of g.wave.open) { ctx.strokeStyle = '#b4ff3c'; ctx.globalAlpha = g.wave.phase === 'wave' ? 0.6 + 0.4 * Math.sin(R.time * 8) : 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r0.x * sx - 5, r0.y * sy); ctx.lineTo(r0.x * sx + 5, r0.y * sy); ctx.stroke(); ctx.globalAlpha = 1; }
  if (g.mis && g.mis.marks) for (const mk of g.mis.marks) { ctx.strokeStyle = mk.done ? '#7ddc6b' : '#ffb86b'; ctx.globalAlpha = mk.done ? 0.7 : 0.6 + 0.4 * Math.sin(R.time * 5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mk.x * sx, mk.y * sy, Math.max(4, mk.r * sx), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  for (const st of g.strikes) { ctx.strokeStyle = '#ff5b47'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(R.time * 12); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.x * sx, st.y * sy, Math.max(4, st.r * sx), 0, TAU); ctx.stroke(); }
  for (const p of R.pings) { const k = p.t / 2.4, rr = 3 + (1 - (p.t % 0.8) / 0.8) * 10; ctx.strokeStyle = p.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, rr, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  const cam = R.cam;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
  ctx.strokeRect(cam.x * sx, cam.y * sy, R.cssW / cam.z * sx, R.cssH / cam.z * sy);
};
