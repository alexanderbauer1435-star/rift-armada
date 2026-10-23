/* =====================================================================
   Rift Armada – natürliche Kartenobjekte: Eismonde, Erzasteroiden, Felsen, Asteroidenfelder und der Aschenebel
   am Kartenrand. Alles prozedural (keine Bilddateien), Materialien und Geometrien werden zwischengespeichert,
   weil eine Karte 20 Vorkommen und bis zu 300 Felsen enthält.
   Grundform aller Brocken: Ikosphäre, je Ecke mit fbm-Rauschen verschoben, Krater (Mulde mit Wall), bei Erz
   zusätzlich ebene Bruchflächen; Farben je Ecke. Die Oberflächentextur (Körnung, Eisrisse, Erzadern) wird im
   Shader dreiseitig projiziert (Triplanar, nach der Normalen gemischt) – keine Nähte, keine Texturkoordinaten.
   Dafür sind die Geometrien in Spieleinheiten gebacken (Textur-Kachel in Einheiten).
   Eis: hellblau-weiß, Risse und Spalten, Frostflecken, kalter Dunstsaum (Sprite), feiner Partikelring.
   Erz: rostbraun, kantig, Bernsteinadern nur in Aderzonen (Ader-Anteil je Ecke × Adermuster) und wenige
   glitzernde Nuggets. Fels: grau, flach schattiert, sechs Grundformen, je Startwert gedreht und gestaucht.
   Feld: Staubschleier (dunkle Flächen in der Ebene, drehen langsam), Instanzwolke aus Splittern, Stäubchen.
   Asche: Rahmen aus Nebelstreifen (innen weich, außen dicht), Schwaden und glimmende Flocken.
   Mitte im Ursprung, oben +Y, Grundfläche im Kreis mit Radius o.r. Animation ruhig: spin, sway, bob, pulse.
   ===================================================================== */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerW, rng } from '../kit.js';

const PI = Math.PI, TAU = PI * 2, V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function cnv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const C = {}; const once = (k, f) => C[k] || (C[k] = f());

/* ------------------------------------------------------------ Rauschen */
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1911520717); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0; for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; r += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return r * 2 - 1;
}
function fbm(x, y, z, s, n = 4) { let a = 0.5, f = 1, t = 0; for (let i = 0; i < n; i++) { t += a * vnoise(x * f, y * f, z * f, s + i * 31); a *= 0.5; f *= 2.07; } return t; }
/* Grat-Rauschen: 1 nahe der Nulllinie → schmale Linien (Spalten, Adern) */
const ridge = (x, y, z, s) => 1 - Math.abs(vnoise(x, y, z, s));

/* ------------------------------------------------------------ Texturen (alle kachelbar, Kachelgröße in Einheiten siehe TILE) */
const TILE = { rock: 10, ore: 16, ice: 44 };
/* Körnung für Fels und Erz: neutral hell (Farbe kommt aus den Ecken), Sprenkel, Gruben, feine Risse, Rauschen */
function grainCanvas(seed, S = 256) {
  const r = rng(seed);
  return cnv(S, S, (x) => {
    x.fillStyle = '#bcbab7'; x.fillRect(0, 0, S, S);
    const wrap = (f) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
    for (let i = 0; i < 420; i++) { const cx = r() * S, cy = r() * S, rx = 3 + r() * 16, ry = rx * (0.4 + r() * 0.6), rot = r() * 3, v = 110 + r() * 130 | 0, a = 0.2 + r() * 0.35; wrap((dx, dy) => { x.fillStyle = `rgba(${v},${v},${v - 3},${a})`; x.beginPath(); x.ellipse(cx + dx, cy + dy, rx, ry, rot, 0, 7); x.fill(); }); }
    for (let i = 0; i < 160; i++) { const cx = r() * S, cy = r() * S, cr = 1 + r() * 5; wrap((dx, dy) => { x.fillStyle = 'rgba(34,32,30,0.6)'; x.beginPath(); x.arc(cx + dx, cy + dy, cr, 0, 7); x.fill(); x.fillStyle = 'rgba(235,232,226,0.35)'; x.beginPath(); x.arc(cx + dx + cr * 0.35, cy + dy + cr * 0.35, cr * 0.55, 0, 7); x.fill(); }); }
    x.lineCap = 'round';
    for (let i = 0; i < 30; i++) { const pts = [[r() * S, r() * S]]; for (let k = 0; k < 5; k++) pts.push([pts[k][0] + (r() - 0.5) * 44, pts[k][1] + (r() - 0.5) * 44]); const lw = 0.8 + r() * 1.6; wrap((dx, dy) => { x.strokeStyle = 'rgba(28,26,24,0.55)'; x.lineWidth = lw; x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px + dx, py + dy) : x.moveTo(px + dx, py + dy)); x.stroke(); }); }
    const d = x.getImageData(0, 0, S, S), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 40; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
  });
}
/* Eishaut (Kachel 44 Einheiten, 512 px → 1 px ≈ 0,09 Einheiten): helles Blauweiß, Frostflecken, dunkelblaue
   Spalten mit hellem Saum, feine Risse, einige weiße Spiegelrisse, Körnung */
function iceCanvas(seed, S = 512) {
  const r = rng(seed);
  return cnv(S, S, (x) => {
    x.fillStyle = '#d6e6f2'; x.fillRect(0, 0, S, S);
    const wrap = (f) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
    for (let i = 0; i < 140; i++) { const cx = r() * S, cy = r() * S, rr = 14 + r() * 70, blue = r() < 0.4; wrap((dx, dy) => { const g = x.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, rr); g.addColorStop(0, blue ? 'rgba(140,180,220,0.4)' : 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(cx + dx - rr, cy + dy - rr, rr * 2, rr * 2); }); }
    for (let i = 0; i < 900; i++) { const cx = r() * S, cy = r() * S, cr = 0.8 + r() * 2.6, v = 150 + r() * 105 | 0; wrap((dx, dy) => { x.fillStyle = `rgba(${v},${v + 8},${Math.min(255, v + 20)},0.35)`; x.beginPath(); x.arc(cx + dx, cy + dy, cr, 0, 7); x.fill(); }); }
    x.lineCap = 'round'; x.lineJoin = 'round';
    const crack = (n, col, lw0, lw1, len, halo) => {
      for (let i = 0; i < n; i++) {
        const pts = [[r() * S, r() * S]]; let a = r() * TAU; const k = 4 + (r() * 7 | 0);
        for (let j = 0; j < k; j++) { a += (r() - 0.5) * 0.9; const l = len * (0.5 + r()); pts.push([pts[j][0] + Math.cos(a) * l, pts[j][1] + Math.sin(a) * l]); }
        const lw = lw0 + r() * lw1;
        const stroke = (w, c) => wrap((dx, dy) => { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], j) => j ? x.lineTo(px + dx, py + dy) : x.moveTo(px + dx, py + dy)); x.stroke(); });
        if (halo) stroke(lw * 2.6, 'rgba(255,255,255,0.35)');
        stroke(lw, col);
        if (r() < 0.6) { const q = pts[1 + (r() * (pts.length - 2) | 0)], b = a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.8), l = len * (0.4 + r() * 0.8); wrap((dx, dy) => { x.strokeStyle = col; x.lineWidth = lw * 0.6; x.beginPath(); x.moveTo(q[0] + dx, q[1] + dy); x.lineTo(q[0] + Math.cos(b) * l + dx, q[1] + Math.sin(b) * l + dy); x.stroke(); }); }
      }
    };
    crack(5, 'rgba(45,80,130,0.8)', 7, 6, 56, true);
    crack(22, 'rgba(70,110,160,0.6)', 2.5, 3, 30, false);
    crack(26, 'rgba(90,130,175,0.45)', 1, 1.5, 22, false);
    crack(14, 'rgba(255,255,255,0.75)', 1.2, 1.6, 20, false);
    const d = x.getImageData(0, 0, S, S), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
  });
}
/* Adermuster für Erz (Leuchttextur, Kachel 16 Einheiten): verzweigte Bernsteinlinien mit Glutsaum auf Schwarz */
function veinCanvas(seed, S = 256) {
  const r = rng(seed);
  return cnv(S, S, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const wrap = (f) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
    x.lineCap = 'round'; x.lineJoin = 'round';
    /* vier lange, leicht gewundene Adern mit Glutsaum, dazu kurze Seitenäste */
    for (let i = 0; i < 4; i++) {
      const pts = [[r() * S, r() * S]]; let a = r() * TAU;
      for (let j = 0; j < 14; j++) { a += (r() - 0.5) * 0.9; const l = 18 + r() * 24; pts.push([pts[j][0] + Math.cos(a) * l, pts[j][1] + Math.sin(a) * l]); }
      const draw = (lw, col) => wrap((dx, dy) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); pts.forEach(([px, py], j) => j ? x.lineTo(px + dx, py + dy) : x.moveTo(px + dx, py + dy)); x.stroke(); });
      draw(22, 'rgba(255,110,30,0.14)'); draw(10, 'rgba(255,150,50,0.4)'); draw(4.5, 'rgba(255,200,110,0.9)'); draw(1.8, '#fff0c0');
      for (let k = 0; k < 5; k++) { const q = pts[1 + (r() * (pts.length - 2) | 0)], b = a + (r() - 0.5) * 2.5, l = 10 + r() * 22; wrap((dx, dy) => { x.strokeStyle = 'rgba(255,180,80,0.8)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(q[0] + dx, q[1] + dy); x.lineTo(q[0] + Math.cos(b) * l + dx, q[1] + Math.sin(b) * l + dy); x.stroke(); }); }
    }
    for (let i = 0; i < 50; i++) { const cx = r() * S, cy = r() * S, cr = 1.2 + r() * 2.4; wrap((dx, dy) => { x.fillStyle = r() < 0.5 ? '#ffe2a8' : '#ffb050'; x.beginPath(); x.arc(cx + dx, cy + dy, cr, 0, 7); x.fill(); }); }
  });
}
/* weicher Fleck (weiß, Alpha ausgefranst, höchstens ≈ 0,4) – Staub, Nebelschwaden; Farbe kommt aus dem Material */
function blobCanvas(seed, S = 256) {
  const r = rng(seed);
  return cnv(S, S, (x) => {
    x.clearRect(0, 0, S, S);
    const R = S * 0.5;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, R); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.55, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.7) * R * 0.66, cx = S / 2 + Math.cos(a) * d, cy = S / 2 + Math.sin(a) * d, rr = R * (0.1 + r() * 0.28);
      const gg = x.createRadialGradient(cx, cy, 0, cx, cy, rr); gg.addColorStop(0, `rgba(255,255,255,${0.04 + r() * 0.08})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gg; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
  });
}
/* weicher Punkt für Partikel */
function dotCanvas() { return cnv(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }); }
/* Dunstsaum (Sprite): schmaler Lichtring, innen und außen weich – nur außerhalb der Mondscheibe sichtbar */
function hazeCanvas() { return cnv(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0)'); g.addColorStop(0.905, 'rgba(255,255,255,0.5)'); g.addColorStop(0.95, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }); }
/* Nebelstreifen des Aschenebels: entlang u kachelbar, in v innen (0) durchsichtig → außen (1) dicht, mit Schlieren */
function bandCanvas(seed, dense) {
  const r = rng(seed), W = 512, H = 128;
  return cnv(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    /* CanvasTexture spiegelt in v: Canvas-Unterkante = v 0 (innen, durchsichtig), Oberkante = v 1 (außen, dicht) */
    const g = x.createLinearGradient(0, H, 0, 0);
    if (dense) { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(0.55, 'rgba(255,255,255,0.85)'); g.addColorStop(0.85, 'rgba(255,255,255,0.97)'); g.addColorStop(1, 'rgba(255,255,255,0.6)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(0.65, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* Schlieren: gestreckte weiche Löcher, in u umlaufend, zum Innenrand hin stärker */
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) { const cx = r() * W, cy = r() * H, rx = 20 + r() * 60, ry = 4 + r() * 14; for (const dx of [-W, 0, W]) { const gg = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, rx); gg.addColorStop(0, `rgba(0,0,0,${(dense ? 0.3 : 0.55) * (0.4 + r() * 0.6) * (cy / H)})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.save(); x.translate(cx + dx, cy); x.scale(1, ry / rx); x.translate(-(cx + dx), -cy); x.fillRect(cx + dx - rx, cy - rx, rx * 2, rx * 2); x.restore(); } }
    x.globalCompositeOperation = 'source-over';
  });
}
const T = {
  grain: () => once('t.grain', () => { const c = grainCanvas(77); return { map: ctex(c), bump: ctex(c, false) }; }),
  ice: () => once('t.ice', () => { const c = iceCanvas(9); return { map: ctex(c), bump: ctex(c, false) }; }),
  vein: () => once('t.vein', () => ctex(veinCanvas(5))),
  blob: (i) => once('t.blob' + i, () => { const t = ctex(blobCanvas(20 + i)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }),
  dot: () => once('t.dot', () => ctex(dotCanvas())),
  haze: () => once('t.haze', () => { const t = ctex(hazeCanvas()); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }),
  band: (dense) => once('t.band' + dense, () => { const t = ctex(bandCanvas(dense ? 3 : 4, dense)); t.wrapT = THREE.ClampToEdgeWrapping; return t; })
};

/* ------------------------------------------------------------ Triplanar-Material
   Ersetzt in MeshStandardMaterial die Abtastung von map, bumpMap und emissiveMap durch eine Projektion aus
   drei Richtungen in Objektkoordinaten (Kachel = tile Einheiten), nach der Normalen gemischt. extra.fs/vs/em:
   zusätzliche Shader-Stücke (Erz: Ader-Anteil je Ecke). */
const BUMP_TP = `#ifdef USE_BUMPMAP
uniform sampler2D bumpMap; uniform float bumpScale;
float tpH(vec3 p) { vec3 w = tpW(); return texture2D(bumpMap, p.zy * TPK).x * w.x + texture2D(bumpMap, p.xz * TPK).x * w.y + texture2D(bumpMap, p.xy * TPK).x * w.z; }
vec2 dHdxy_fwd() { vec3 dpx = dFdx(vTP), dpy = dFdy(vTP); float Hll = bumpScale * tpH(vTP); return vec2(bumpScale * tpH(vTP + dpx) - Hll, bumpScale * tpH(vTP + dpy) - Hll); }
vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz)); vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX); float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); return normalize(abs(fDet) * surf_norm - vGrad); }
#endif`;
function triplanar(m, tile, extra = {}) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP; varying vec3 vTN;' + (extra.vs || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = position; vTN = normal;' + (extra.vs2 || ''));
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n#define TPK ${(1 / tile).toFixed(6)}\nvarying vec3 vTP; varying vec3 vTN;${extra.fs || ''}\nvec3 tpW() { vec3 w = pow(abs(vTN), vec3(4.0)); return w / (w.x + w.y + w.z); }\nvec4 tpTex(sampler2D t, vec3 p, float k) { vec3 w = tpW(); return texture2D(t, p.zy * k) * w.x + texture2D(t, p.xz * k) * w.y + texture2D(t, p.xy * k) * w.z; }`)
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n diffuseColor *= tpTex(map, vTP, TPK);\n#endif')
      .replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\n totalEmissiveRadiance *= tpTex(emissiveMap, vTP, TPK).rgb;\n#endif' + (extra.em || ''))
      .replace('#include <bumpmap_pars_fragment>', BUMP_TP);
  };
  m.customProgramCacheKey = () => 'tp' + tile + (extra.key || '');
  return m;
}

/* ------------------------------------------------------------ Materialien (je eines, geteilt) */
const MAT = {
  rock: () => once('m.rock', () => triplanar(new THREE.MeshStandardMaterial({ map: T.grain().map, bumpMap: T.grain().bump, bumpScale: 0.9, vertexColors: true, flatShading: true, metalness: 0.04, roughness: 0.94 }), TILE.rock)),
  ore: () => once('m.ore', () => triplanar(new THREE.MeshStandardMaterial({ map: T.grain().map, bumpMap: T.grain().bump, bumpScale: 1.6, vertexColors: true, metalness: 0.1, roughness: 0.86, emissiveMap: T.vein(), emissive: new THREE.Color('#ff9a3a'), emissiveIntensity: 1.15 }), TILE.ore,
    /* Adern nur dort, wo die Ecke einen Ader-Anteil trägt (Attribut vein 0…1) */
    { vs: 'attribute float vein; varying float vVein;', vs2: 'vVein = vein;', fs: 'varying float vVein;', em: '\ntotalEmissiveRadiance *= vVein;', key: 'vein' })),
  nugget: () => once('m.nugget', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(1.35) })),
  ice: () => once('m.ice', () => triplanar(new THREE.MeshStandardMaterial({ map: T.ice().map, bumpMap: T.ice().bump, bumpScale: 1.4, vertexColors: true, metalness: 0.0, roughness: 0.34, emissive: new THREE.Color('#163a66'), emissiveIntensity: 0.26, envMapIntensity: 1.4 }), TILE.ice)),
  ring: () => once('m.ring', () => new THREE.PointsMaterial({ size: 1.5, map: T.dot(), color: '#dff2ff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })),
  haze: () => once('m.haze', () => new THREE.SpriteMaterial({ map: T.haze(), color: new THREE.Color('#8fc8ff').multiplyScalar(0.6), transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending })),
  shard: () => once('m.shard', () => new THREE.MeshStandardMaterial({ color: '#56514b', flatShading: true, metalness: 0.05, roughness: 0.92 })),
  speck: () => once('m.speck', () => new THREE.PointsMaterial({ size: 1.1, map: T.dot(), color: '#7a746c', transparent: true, opacity: 0.4, depthWrite: false, sizeAttenuation: true })),
  dust: (i, col, add) => once('m.dust' + i + col + add, () => new THREE.MeshBasicMaterial({ map: T.blob(i), color: col, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })),
  band: (dense, col, add) => once('m.band' + dense + col + add, () => new THREE.MeshBasicMaterial({ map: T.band(dense), color: col, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })),
  puff: (i, col, add) => once('m.puff' + i + col + add, () => new THREE.SpriteMaterial({ map: T.blob(i), color: col, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })),
  flake: () => once('m.flake', () => new THREE.PointsMaterial({ size: 3, map: T.dot(), color: new THREE.Color('#ff9a4a').multiplyScalar(1.1), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
};

/* ------------------------------------------------------------ Brocken
   o = { kind: 'rock' | 'ore' | 'ice', seed, det, amp, craters, rx, ry, rz, cuts, R, fit }
   Ikosphäre Stufe det, verschoben und eingefärbt, dann auf Radius R gebracht (fit 'xz': größter Abstand in
   der XZ-Ebene = R, sonst größter Abstand im Raum). Ergebnis zwischengespeichert: position, normal, color
   (+ vein bei Erz), userData.rmax und rmaxXZ. */
const GEO = {};
const PAL = {
  rock: { a: new THREE.Color('#605c58'), b: new THREE.Color('#8e8983'), d: new THREE.Color('#2e2b29'), f: new THREE.Color('#7a736b') },
  ore: { a: new THREE.Color('#6a4224'), b: new THREE.Color('#a86a3c'), d: new THREE.Color('#2c1c13'), f: new THREE.Color('#6b5f55'), v: new THREE.Color('#c48c48') },
  ice: { a: new THREE.Color('#d2e5f3'), b: new THREE.Color('#f6fcff'), d: new THREE.Color('#6a9ac8'), f: new THREE.Color('#a9c9e2') }
};
function asteroidGeo(o) {
  const key = JSON.stringify(o); if (GEO[key]) return GEO[key];
  let g = new THREE.IcosahedronGeometry(1, o.det); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-5);
  const p = g.attributes.position, n = p.count, r = rng((o.seed | 0) * 7 + 11), v = new V3(), seed = (o.seed | 0) & 0xffff, P = PAL[o.kind], tmp = new THREE.Color();
  const dir = () => { const a = r() * TAU, y = -1 + r() * 2, s = Math.sqrt(1 - y * y); return new V3(Math.cos(a) * s, y, Math.sin(a) * s); };
  const cr = []; for (let i = 0; i < o.craters; i++) cr.push({ d: dir(), rad: 0.09 + r() * 0.2, dep: 0.5 + r() * 0.6 });
  const pl = []; for (let i = 0; i < (o.cuts || 0); i++) pl.push({ n: dir(), d: 0.62 + r() * 0.2 });
  const col = new Float32Array(n * 3), cutF = new Float32Array(n), vein = new Float32Array(n), amp = o.amp;
  const ice = o.kind === 'ice', ore = o.kind === 'ore';
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 1 + fbm(v.x * 1.5, v.y * 1.5, v.z * 1.5, seed, 3) * amp + fbm(v.x * 3.8, v.y * 3.8, v.z * 3.8, seed + 2, 3) * amp * 0.45 + fbm(v.x * 9, v.y * 9, v.z * 9, seed + 5, 2) * (ice ? 0.01 : 0.045), shade = 1, deep = 0;
    if (ice) {
      /* Spalten: Gratlinien, etwas dunkler und tiefer, dazu weiche blaue Felder */
      const c1 = ridge(v.x * 2.4, v.y * 2.4, v.z * 2.4, seed + 13), c2 = ridge(v.x * 5.5 + 2, v.y * 5.5, v.z * 5.5, seed + 17);
      const k = smooth(0.93, 0.995, c1) + 0.5 * smooth(0.95, 0.995, c2);
      h -= k * 0.012; deep = clamp(k, 0, 1) * 0.7 + 0.45 * smooth(0.1, 0.5, fbm(v.x * 2, v.y * 2 + 9, v.z * 2, seed + 19, 3)); shade *= 1 - k * 0.12;
    } else {
      const crev = vnoise(v.x * 11, v.y * 11, v.z * 11, seed + 13); if (crev > 0.45) { h -= (crev - 0.45) * 0.06; shade *= 1 - (crev - 0.45) * 0.9; }
    }
    for (const c of cr) {
      const t = Math.acos(clamp(v.dot(c.d), -1, 1)) / c.rad; if (t > 1.6) continue;
      if (t < 1) { h -= c.dep * c.rad * (ice ? 0.38 : 0.34) * (1 - t * t); shade *= (ice ? 0.74 : 0.7) + (ice ? 0.26 : 0.3) * t; deep = Math.max(deep, (1 - t) * 0.8); }
      const w = Math.exp(-(((t - 1) / 0.24) ** 2)); h += c.dep * c.rad * (ice ? 0.16 : 0.12) * w; shade *= 1 + 0.22 * w;
    }
    let x = v.x * h * o.rx, y = v.y * h * o.ry, z = v.z * h * o.rz, cut = 0;
    for (const q of pl) { const s = x * q.n.x + y * q.n.y + z * q.n.z - q.d; if (s > 0) { x -= s * q.n.x; y -= s * q.n.y; z -= s * q.n.z; cut = 1; } }
    p.setXYZ(i, x, y, z); cutF[i] = cut;
    /* Farbe je Ecke */
    const m = clamp(0.5 + fbm(v.x * 2.2 + 3, v.y * 2.2, v.z * 2.2, seed + 21, 3) * 1.7, 0, 1), dk = clamp(fbm(v.x * 4.5, v.y * 4.5 + 7, v.z * 4.5, seed + 33, 2) * 2.2, 0, 0.7);
    tmp.copy(P.a).lerp(P.b, m);
    if (ice) { tmp.lerp(P.d, clamp(deep, 0, 1) * 0.8).lerp(P.f, dk * 0.4); tmp.multiplyScalar(shade * clamp(0.92 + (h - 1) * 1.2, 0.75, 1.1)); }
    else {
      tmp.lerp(P.d, dk);
      if (ore) { const vz = smooth(0.86, 0.985, ridge(v.x * 2.6, v.y * 2.6 + 5, v.z * 2.6, seed + 41)) * smooth(-0.1, 0.35, vnoise(v.x * 1.4, v.y * 1.4, v.z * 1.4, seed + 47)); vein[i] = vz; tmp.lerp(P.v, vz * 0.5); }
      tmp.lerp(P.f, cut * 0.75);
      tmp.multiplyScalar(shade * clamp(0.85 + (h - 1) * 1.6, 0.5, 1.2) * (v.y < -0.4 ? 0.85 : 1));
    }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  /* auf Zielradius bringen */
  let rmax = 0, rmaxXZ = 0;
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i); rmax = Math.max(rmax, v.length()); rmaxXZ = Math.max(rmaxXZ, Math.hypot(v.x, v.z)); }
  const k = o.R / (o.fit === 'xz' ? rmaxXZ : rmax); g.scale(k, k, k);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('cut', new THREE.BufferAttribute(cutF, 1));
  if (ore) g.setAttribute('vein', new THREE.BufferAttribute(vein, 1));
  g.computeVertexNormals();
  g = g.toNonIndexed();
  /* Bruchflächen: Dreiecke, die ganz auf einer Schnittebene liegen, bekommen harte Flächennormalen */
  const Pp = g.attributes.position, N = g.attributes.normal, Cu = g.attributes.cut, a = new V3(), b = new V3(), c = new V3();
  for (let i = 0; i < Pp.count; i += 3) {
    if (Cu.getX(i) < 0.5 || Cu.getX(i + 1) < 0.5 || Cu.getX(i + 2) < 0.5) continue;
    a.fromBufferAttribute(Pp, i); b.fromBufferAttribute(Pp, i + 1); c.fromBufferAttribute(Pp, i + 2);
    const nn = b.sub(a).cross(c.sub(a)).normalize(); for (let j = 0; j < 3; j++) N.setXYZ(i + j, nn.x, nn.y, nn.z);
  }
  g.deleteAttribute('cut');
  g.userData.rmax = rmax * k; g.userData.rmaxXZ = rmaxXZ * k;
  return GEO[key] = g;
}
const mk = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };

/* ------------------------------------------------------------ Eismond
   Leicht abgeplattete Kugel (Ikosphäre Stufe 15, 5 120 Dreiecke), bläulich-weiß, Spalten und Krater,
   dazu ein Dunstsaum (Sprite, nur am Rand sichtbar) und ein enger Ring aus Eispartikeln. Der Körper füllt
   0,955 r, Ring und Dunst reichen bis 1,08 r. Dreht langsam um eine leicht geneigte Achse. */
registerW('ice', (M, o) => {
  const g = new THREE.Group(), R = o.r, big = !!o.big, seed = o.seed | 0;
  const geo = asteroidGeo({ kind: 'ice', seed, det: 15, amp: big ? 0.04 : 0.05, craters: big ? 11 : 8, rx: 1, ry: 0.9, rz: 1, cuts: 0, R: R * 0.955, fit: 'xz' });
  const tilt = new THREE.Group(); tilt.rotation.z = 0.16; tilt.rotation.x = 0.08; g.add(tilt);
  const body = mk(geo, MAT.ice()); body.rotation.y = seed % 7 * 0.9; body.userData.spin = { axis: 'y', speed: big ? 0.018 : 0.026 }; tilt.add(body);
  /* Partikelring in der Äquatorebene, innen dichter */
  const r = rng(seed + 3), n = big ? 560 : 440, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = R * (0.975 + Math.pow(r(), 1.6) * 0.105), y = (r() - 0.5) * R * 0.025 * (1 + r()); pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * d; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ring = new THREE.Points(rg, MAT.ring()); ring.userData.spin = { axis: 'y', speed: 0.05 }; tilt.add(ring);
  /* Dunstsaum */
  const hz = new THREE.Sprite(MAT.haze()); hz.scale.set(R * 2.16, R * 2.16, 1); g.add(hz);
  return g;
});

/* ------------------------------------------------------------ Erzasteroid
   Unregelmäßiger, gestauchter Brocken (Stufe 7, 1 280 Dreiecke) mit zwei bis drei ebenen Bruchflächen,
   Kratern, Bernsteinadern (nur in Aderzonen) und wenigen glitzernden Nuggets. Je Startwert andere Form. */
registerW('ore', (M, o) => {
  const g = new THREE.Group(), R = o.r, seed = o.seed | 0, r = rng(seed * 3 + 5);
  const geo = asteroidGeo({ kind: 'ore', seed, det: 7, amp: 0.26 + (seed % 5) * 0.025, craters: 4 + seed % 3, rx: 1, ry: 0.7 + (seed % 4) * 0.08, rz: 0.78 + (seed % 3) * 0.1, cuts: 2 + seed % 2, R: R * 0.97, fit: 'all' });
  const tilt = new THREE.Group(); tilt.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); g.add(tilt);
  const body = mk(geo, MAT.ore()); body.rotation.y = r() * TAU; body.userData.spin = { axis: 'y', speed: 0.03 + r() * 0.03 }; tilt.add(body);
  /* Nuggets: kleine leuchtende Oktaeder auf Ecken mit hohem Ader-Anteil */
  const P = geo.attributes.position, V = geo.attributes.vein, N = geo.attributes.normal, cand = [];
  for (let i = 0; i < P.count; i += 3) if (V.getX(i) > 0.55) cand.push(i);
  const ng = once('g.nugget', () => new THREE.OctahedronGeometry(1, 0));
  for (let k = 0; k < Math.min(8, cand.length); k++) {
    const i = cand[(k * 7919 + 3) % cand.length], m = new THREE.Mesh(ng, MAT.nugget()), s = 0.6 + r() * 0.6;
    m.position.set(P.getX(i) + N.getX(i) * 0.3, P.getY(i) + N.getY(i) * 0.3, P.getZ(i) + N.getZ(i) * 0.3); m.scale.setScalar(s); m.rotation.set(r() * 3, r() * 3, 0);
    body.add(m);
  }
  return g;
});

/* ------------------------------------------------------------ Fels
   Sechs Grundformen (Stufe 3, 320 Dreiecke, gebacken auf Radius 16), nach Startwert gewählt, gedreht und
   ungleich gestaucht. Statisch (bis 300 Stück je Karte). */
registerW('rock', (M, o) => {
  const g = new THREE.Group(), seed = o.seed | 0, r = rng(seed * 13 + 3), R = o.r, vr = seed % 6;
  const geo = asteroidGeo({ kind: 'rock', seed: 100 + vr, det: 3, amp: 0.22 + vr * 0.03, craters: 3, rx: 1, ry: 0.85, rz: 0.9, cuts: vr > 3 ? 1 : 0, R: 16, fit: 'all' });
  const m = mk(geo, MAT.rock());
  const sy = 0.7 + r() * 0.3, sz = 0.78 + r() * 0.22, k = R * 0.98 / 16;
  m.scale.set(k, k * sy, k * sz); m.rotation.set((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5);
  g.add(m);
  return g;
});

/* ------------------------------------------------------------ Asteroidenfeld
   Dichter Trümmerbereich mit Radius o.r: Staubschleier aus dunklen Flächen (drehen langsam), eine Instanzwolke
   aus Splittern (bis 320 × 8 Dreiecke) und feine Stäubchen als Punkte. Die Splitterwolke treibt als Ganzes
   langsam (spin an der Untergruppe). */
registerW('field', (M, o) => {
  const g = new THREE.Group(), R = o.r, seed = o.seed | 0, r = rng(seed * 101 + 7);
  const pg = once('g.plane', () => { const q = new THREE.PlaneGeometry(1, 1); q.rotateX(-PI / 2); return q; });
  const plane = (i, col, size, x, z, y, add, spin) => { const m = new THREE.Mesh(pg, MAT.dust(i, col, add)); m.scale.setScalar(size); m.position.set(x, y, z); m.rotation.y = r() * TAU; m.userData.spin = { axis: 'y', speed: spin }; m.renderOrder = add ? 3 : 2; g.add(m); return m; };
  /* Grundschleier: zwei große Flecken füllen die Fläche, darüber kleinere Schwaden in verschiedenen Grautönen */
  plane(0, '#524e49', R * 2.4, 0, 0, -2, false, 0.005);
  plane(1, '#605a53', R * 2.1, 0, 0, -1.5, false, -0.007);
  for (let i = 0; i < 9; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.7; plane(2 + i % 4, ['#3c3936', '#66615a', '#4e4a45', '#2f2d2b'][i % 4], R * (0.7 + r() * 0.6), Math.cos(a) * d, Math.sin(a) * d, (r() - 0.5) * 3, false, (r() - 0.5) * 0.03); }
  for (let i = 0; i < 3; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.5; plane(3 + i, '#1a1a20', R * (0.6 + r() * 0.5), Math.cos(a) * d, Math.sin(a) * d, 2 + r() * 2, true, (r() - 0.5) * 0.02); }
  /* Splitterwolke */
  const drift = new THREE.Group(); drift.userData.spin = { axis: 'y', speed: 0.004 }; g.add(drift);
  const sg = once('g.shard', () => { const q = new THREE.OctahedronGeometry(1, 0), p = q.attributes.position, rr = rng(31); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.7 + rr() * 0.6), p.getY(i) * (0.7 + rr() * 0.5), p.getZ(i) * (0.8 + rr() * 0.7)); q.computeVertexNormals(); return q; });
  const n = Math.round(clamp(R * R / 85, 120, 320)), im = new THREE.InstancedMesh(sg, MAT.shard(), n), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new V3(), scl = new V3(), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.96, s = 0.8 + Math.pow(r(), 2.6) * 3.6;
    pos.set(Math.cos(a) * d, (r() - 0.5) * R * 0.05, Math.sin(a) * d); e.set(r() * TAU, r() * TAU, r() * TAU); q.setFromEuler(e); scl.set(s, s * (0.75 + r() * 0.4), s * (0.8 + r() * 0.5));
    mat.compose(pos, q, scl); im.setMatrixAt(i, mat);
    const v = 0.25 + r() * 0.45; im.setColorAt(i, col.setRGB(v, v * 0.97, v * 0.93));
  }
  im.castShadow = true; im.receiveShadow = true; drift.add(im);
  /* Stäubchen */
  const ns = 700, pp = new Float32Array(ns * 3);
  for (let i = 0; i < ns; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R; pp[i * 3] = Math.cos(a) * d; pp[i * 3 + 1] = (r() - 0.5) * R * 0.08; pp[i * 3 + 2] = Math.sin(a) * d; }
  const sp = new THREE.BufferGeometry(); sp.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pts = new THREE.Points(sp, MAT.speck()); pts.userData.spin = { axis: 'y', speed: -0.003 }; drift.add(pts);
  return g;
});

/* ------------------------------------------------------------ Aschenebel
   Rahmen am Kartenrand: je Kante drei flache Streifen (dunkles Rotbraun, Aschegrau mit Schlieren, additive
   Glut; innen bei |X| = w/2 − r weich beginnend, am Kartenrand halbdicht, 200 weiter außen dicht), darüber
   Schwaden als Sprites (atmen leicht, heben und senken sich) und glimmende Flocken (Punkte, treiben auf und ab).
   o.w, o.h = Kartengröße, o.r = Streifenbreite. */
registerW('ash', (M, o) => {
  const g = new THREE.Group(), W = o.w, H = o.h, E = o.r || 110, OUT = 200, D = E + OUT, r = rng((o.seed | 0) + 1);
  const pg = once('g.plane', () => { const q = new THREE.PlaneGeometry(1, 1); q.rotateX(-PI / 2); return q; });
  /* Streifen 1 × 1 (nach dem Drehen: v 0 = innen bei +Z, v 1 = außen bei −Z), Textur in u gekachelt */
  const strip = (len, dense, col, add, y, rep, off) => {
    const m = new THREE.Mesh(pg, MAT.band(dense, col, add).clone()); m.material.map = m.material.map.clone(); m.material.map.repeat.set(rep, 1); m.material.map.offset.x = off; m.material.map.needsUpdate = true;
    m.scale.set(len, 1, D); m.position.y = y; m.renderOrder = add ? 4 : 1; return m;
  };
  /* Kante: Mitte x, z, Drehung um Y (lokal −Z = außen), Länge bis zur Außenecke (die Ecken überlappen) */
  const edges = [[0, -(H / 2 - E) - D / 2, 0, W + 2 * OUT], [0, (H / 2 - E) + D / 2, PI, W + 2 * OUT], [-(W / 2 - E) - D / 2, 0, PI / 2, H + 2 * OUT], [(W / 2 - E) + D / 2, 0, -PI / 2, H + 2 * OUT]];
  for (const [x, z, ry, len] of edges) {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry; g.add(h);
    h.add(strip(len, true, '#2a1512', false, -6, Math.round(len / 600), r()));
    h.add(strip(len, false, '#4a2a24', false, -4, Math.round(len / 380), r()));
    h.add(strip(len, true, '#33302e', false, -2, Math.round(len / 450), r()));
    const glow = strip(len, false, '#4a1c0c', true, 2, Math.round(len / 420), r()); glow.userData.sway = { axis: 'x', speed: 0.11, amp: 0.012, phase: r() * 6 }; h.add(glow);
  }
  /* Schwaden: zufälliger Punkt im Rahmen (innen bis 0,7 E, außen bis 0,9 OUT) */
  const band = (a) => {
    const side = a % 4, t = r(), d = -E * 0.7 + r() * (E * 0.7 + OUT * 0.9);
    if (side === 0) return [-W / 2 + t * W, H / 2 + d]; if (side === 1) return [-W / 2 + t * W, -H / 2 - d]; if (side === 2) return [W / 2 + d, -H / 2 + t * H]; return [-W / 2 - d, -H / 2 + t * H];
  };
  const nPuff = Math.round((W + H) / 70);
  for (let i = 0; i < nPuff; i++) {
    const [x, z] = band(i), kind = i % 6, add = kind === 5, s = 100 + r() * 160;
    const col = add ? '#4a1a0a' : ['#5a322a', '#4a3a36', '#3e2420', '#524842', '#3a1c18'][kind];
    const sp = new THREE.Sprite(MAT.puff(kind, col, add)); sp.scale.setScalar(s); sp.position.set(x, 6 + r() * 16, z);
    sp.userData.pulse = { amp: 0.05, speed: 0.15 + r() * 0.15, base: s }; sp.userData.bob = { amp: 2 + r() * 2, speed: 0.12 + r() * 0.1, y0: sp.position.y }; sp.renderOrder = add ? 5 : 3; g.add(sp);
  }
  /* glimmende Ascheflocken */
  const nf = Math.round((W + H) / 10), pp = new Float32Array(nf * 3);
  for (let i = 0; i < nf; i++) { const [x, z] = band(i); pp[i * 3] = x; pp[i * 3 + 1] = 3 + r() * 14; pp[i * 3 + 2] = z; }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const fl = new THREE.Points(fg, MAT.flake()); fl.userData.bob = { amp: 3, speed: 0.25, y0: 0 }; g.add(fl);
  return g;
});
