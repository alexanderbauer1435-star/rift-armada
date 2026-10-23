/* =====================================================================
   Rift Armada – 3D-Baukasten für Schiffe. Alles wird im Code erzeugt (keine Dateien): Materialien mit Plattentexturen,
   Rumpf aus Querschnitten (loft), Module (Triebwerk, Turm, Antenne, Schüssel, Kühlrippen, Fensterbänder, Lichter,
   Aufschriften), organische Teile (Brood) und Kristalle (Nexus).
   Koordinaten: Bug zeigt nach +Z, oben ist +Y, Mitte im Ursprung. Länge in Spieleinheiten (data.js len).
   Animation über userData: flame (Triebwerksflamme), blink (Positionslicht), spin {axis, speed}, pulse {amp, speed},
   orbit {r, speed, y} (kreist um die Elternmitte), bob {amp, speed}.
   ===================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------ Zufall */
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const R0 = rng(4242);

/* ------------------------------------------------------------ Texturen */
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, srgb, rep) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(rep, rep); return t; }
/* Plattenmuster (Graustufen): Platten mit Fugen, Nieten, Lüftungsschlitze. Dient als Helligkeit und als Relief. */
function panelCanvas(seed, density = 1, style = 'plate') {
  const r = rng(seed);
  return canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, w, h);
    if (style === 'organic') {
      for (let i = 0; i < 900; i++) { const v = 120 + r() * 120 | 0; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 30, 4 + r() * 18, r() * 3, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(40,40,40,0.55)'; x.lineCap = 'round';
      for (let i = 0; i < 70; i++) { let px = r() * w, py = r() * h; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 70; py += (r() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); }
      return;
    }
    if (style === 'crystal') {
      for (let i = 0; i < 120; i++) { const v = 150 + r() * 105 | 0; x.fillStyle = `rgba(${v},${v},${v},0.5)`; x.beginPath(); const cx = r() * w, cy = r() * h, s = 10 + r() * 60; x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.5, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.5, cy); x.fill(); }
      x.strokeStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 40; i++) { x.lineWidth = 0.5 + r(); x.beginPath(); x.moveTo(r() * w, r() * h); x.lineTo(r() * w, r() * h); x.stroke(); }
      return;
    }
    const n = Math.round(240 * density);
    for (let i = 0; i < n; i++) {
      const pw = 14 + r() * 110, ph = 10 + r() * 70, px = r() * w, py = r() * h, v = r() < 0.12 ? 95 + r() * 40 : 165 + r() * 70;
      x.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; x.fillRect(px, py, pw, ph);
      x.strokeStyle = 'rgba(30,30,30,0.7)'; x.lineWidth = 1.3; x.strokeRect(px + 0.5, py + 0.5, pw, ph);
      if (r() < 0.25) { x.fillStyle = 'rgba(40,40,40,0.8)'; for (let k = 0; k < 4; k++) { x.fillRect(px + 3, py + 3 + k * 4, 2, 2); x.fillRect(px + pw - 5, py + 3 + k * 4, 2, 2); } }
      if (r() < 0.08) { x.fillStyle = 'rgba(30,30,30,0.85)'; for (let k = 0; k < 6; k++) x.fillRect(px + 4, py + 4 + k * 5, pw * 0.5, 2); }
    }
    /* Abnutzung */
    for (let i = 0; i < 30; i++) { const cx = r() * w, cy = r() * h, g = x.createRadialGradient(cx, cy, 0, cx, cy, 30 + r() * 60); g.addColorStop(0, 'rgba(50,50,50,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  });
}
/* eingefärbte Version des Musters */
function tint(src, color, contrast = 1) {
  const c = new THREE.Color(color);
  return canvas(src.width, src.height, (x) => {
    x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, src.width, src.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const l = Math.pow(p[i] / 180, contrast); p[i] = Math.min(255, c.r * 255 * l); p[i + 1] = Math.min(255, c.g * 255 * l); p[i + 2] = Math.min(255, c.b * 255 * l); }
    x.putImageData(d, 0, 0);
  });
}
/* Fensterreihen (emissiv) */
function windowCanvas(seed, warm = 0.25, col1 = '#bff2ff', col2 = '#ffd9a0') {
  const r = rng(seed);
  return canvas(512, 128, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let row = 0; row < 4; row++) for (let i = 0; i < 64; i++) { if (r() < 0.38) continue; x.fillStyle = r() < warm ? col2 : col1; x.fillRect(i * 8 + 2, 14 + row * 28, 4, 6); } });
}
/* Buntglas (Legion) */
function glassCanvas(seed) {
  const r = rng(seed), cols = ['#c9a0ff', '#ffcf6a', '#ff6a5a', '#6ab0ff', '#ffe9b0'];
  return canvas(256, 256, (x, w, h) => { x.fillStyle = '#100808'; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = cols[r() * cols.length | 0]; x.globalAlpha = 0.5 + r() * 0.5; x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); } x.globalAlpha = 1; });
}
const CACHE = {};
function cached(key, make) { return CACHE[key] || (CACHE[key] = make()); }

/* ------------------------------------------------------------ Materialien je Fraktion */
export const PAL = {
  alliance: { hull: '#e6ecf3', hull2: '#8496ab', dark: '#2f3946', trim: '#3f8cff', glow: '#8fe3ff', plume: '#9fdcff', win: ['#c8f4ff', '#ffe2b0'], light: '#ffffff' },
  mars: { hull: '#8a7d70', hull2: '#4d4843', dark: '#24221f', trim: '#c8402a', glow: '#ffb070', plume: '#cfe0ff', win: ['#ffd27a', '#fff1d0'], light: '#ffb070', hazard: '#e8b923' },
  legion: { hull: '#eadfc6', hull2: '#7a6545', dark: '#2a2016', trim: '#d4a53a', glow: '#ffd27a', plume: '#ffe2a0', win: ['#ffd9a0', '#c9a0ff'], light: '#ffe9b0', gold: '#d9aa3c' },
  nexus: { hull: '#ece6ff', hull2: '#9a86c9', dark: '#2a2140', trim: '#b48cff', glow: '#e4d4ff', plume: '#d8c8ff', win: ['#ffffff', '#d9c8ff'], light: '#f0e8ff' },
  brood: { hull: '#4a2c5a', hull2: '#2b1a35', dark: '#140b18', trim: '#b4ff3c', glow: '#b4ff3c', plume: '#d6ff6a', win: ['#b4ff3c', '#ff9ad6'], light: '#b4ff3c', flesh: '#c46a8a', bone: '#d9c9b0' },
  guardian: { hull: '#8fa39b', hull2: '#4a5c55', dark: '#1f2a26', trim: '#9ff0c0', glow: '#9ff0c0', plume: '#b8ffd8', win: ['#b8ffd8', '#ffffff'], light: '#9ff0c0' }
};
export function mats(f, team) {
  return cached('m|' + f + '|' + (team || ''), () => {
    const P = PAL[f], trim = team || P.trim, style = f === 'brood' ? 'organic' : f === 'nexus' ? 'crystal' : 'plate';
    const pc = panelCanvas(f.length * 77 + 5, f === 'mars' ? 1.3 : 1, style);
    const bump = tex(pc, false, 1);
    const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ map: tex(tint(pc, color, f === 'mars' ? 1.25 : 1), true), bumpMap: bump, bumpScale: 0.6, roughnessMap: bump, metalness: 0.55, roughness: 0.45 }, o));
    const M = {
      hull: std(P.hull, f === 'nexus' ? { metalness: 0.15, roughness: 0.12, transparent: true, opacity: 0.92, emissive: new THREE.Color(P.trim), emissiveIntensity: 0.18 } : f === 'brood' ? { metalness: 0.2, roughness: 0.35 } : {}),
      hull2: std(P.hull2, f === 'brood' ? { metalness: 0.15, roughness: 0.5 } : {}),
      dark: new THREE.MeshStandardMaterial({ color: P.dark, metalness: 0.8, roughness: 0.35, bumpMap: bump, bumpScale: 0.4 }),
      trim: new THREE.MeshStandardMaterial({ color: trim, metalness: 0.4, roughness: 0.3, emissive: trim, emissiveIntensity: 0.35 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(2.3) }),
      glowSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(1.6) }),
      plume: plumeMat(P.plume),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color(P.light).multiplyScalar(4) }),
      red: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(4) }),
      green: new THREE.MeshBasicMaterial({ color: new THREE.Color('#3bff6a').multiplyScalar(4) }),
      glass: new THREE.MeshStandardMaterial({ color: '#0d2a40', metalness: 0.9, roughness: 0.05, emissive: f === 'mars' ? '#7a3b10' : '#1b6b9a', emissiveIntensity: 0.7 }),
      windows: new THREE.MeshStandardMaterial({ color: P.hull2, metalness: 0.5, roughness: 0.5, emissiveMap: tex(windowCanvas(f.length * 13, 0.3, P.win[0], P.win[1]), true), emissive: '#ffffff', emissiveIntensity: 1.2 })
    };
    if (f === 'mars') M.hazard = new THREE.MeshStandardMaterial({ map: tex(canvas(128, 32, (x) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#1a1a1a' : P.hazard; x.beginPath(); x.moveTo(i * 12 - 16, 32); x.lineTo(i * 12, 0); x.lineTo(i * 12 + 12, 0); x.lineTo(i * 12 - 4, 32); x.fill(); } }), true), metalness: 0.3, roughness: 0.6 });
    if (f === 'legion') {
      M.gold = new THREE.MeshStandardMaterial({ color: P.gold, metalness: 1, roughness: 0.22, bumpMap: bump, bumpScale: 0.3 });
      M.stained = new THREE.MeshStandardMaterial({ color: '#221a14', metalness: 0.3, roughness: 0.4, emissiveMap: tex(glassCanvas(9), true), emissive: '#ffffff', emissiveIntensity: 1.6 });
    }
    if (f === 'nexus') {
      M.crystal = new THREE.MeshStandardMaterial({ color: '#efe8ff', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.78, emissive: '#9b6cff', emissiveIntensity: 0.35, flatShading: true, envMapIntensity: 2 });
      M.crystalDark = new THREE.MeshStandardMaterial({ color: '#4b3a7a', metalness: 0.3, roughness: 0.1, emissive: '#5a2fd0', emissiveIntensity: 0.4, flatShading: true });
      M.core = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f2e8ff').multiplyScalar(3.5) });
    }
    if (f === 'brood') {
      const oc = panelCanvas(31, 1, 'organic');
      M.flesh = new THREE.MeshStandardMaterial({ map: tex(tint(oc, P.flesh), true), bumpMap: tex(oc, false), bumpScale: 1, metalness: 0.05, roughness: 0.55, emissive: '#5a1030', emissiveIntensity: 0.25 });
      M.bone = new THREE.MeshStandardMaterial({ color: P.bone, metalness: 0.05, roughness: 0.6, bumpMap: tex(oc, false), bumpScale: 0.5 });
      M.chitin = new THREE.MeshStandardMaterial({ map: tex(tint(oc, P.hull, 1.2), true), bumpMap: tex(oc, false), bumpScale: 0.8, metalness: 0.35, roughness: 0.25 });
      M.acid = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(2.6) });
    }
    return M;
  });
}
function plumeMat(col) {
  const g = canvas(64, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); const sg = x.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = sg; x.fillRect(0, 0, w, h); });
  return new THREE.MeshBasicMaterial({ map: tex(g, true), color: new THREE.Color(col).multiplyScalar(1.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
}

/* ------------------------------------------------------------ Grundformen */
const mk = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
export { mk as mesh };
/* Achteck-Querschnitt: Rechteck w × h mit Fase c (Punkte gegen den Uhrzeigersinn), dy hebt den Querschnitt an */
export function oct(w, h, c = Math.min(w, h) * 0.25, dy = 0) {
  c = Math.min(c, w / 2 - 0.01, h / 2 - 0.01);
  return [[w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c], [-w / 2 + c, -h / 2], [w / 2 - c, -h / 2]].map(([x, y]) => [x, y + dy]);
}
/* Vieleck (n Ecken) mit Radien rx, ry */
export function ngon(n, rx, ry = rx, rot = 0, dy = 0) { const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; p.push([Math.cos(a) * rx, Math.sin(a) * ry + dy]); } return p; }
/* Rumpf aus Querschnitten entlang Z: sections = [{z, pts}] (gleiche Punktzahl). Harte Kanten (flach schattiert),
   außer smooth = true. Deckel an beiden Enden. */
export function loft(sections, mat, opts = {}) {
  const pos = [], uv = [], n = sections[0].pts.length, s = opts.uv || 1 / 36;
  const cen = sec => { let x = 0, y = 0; for (const [a, b] of sec.pts) { x += a; y += b; } return [x / n, y / n]; };
  const tri = (a, b, c, ua, ub, uc, ref) => {
    const v1 = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), v2 = new THREE.Vector3(...c).sub(new THREE.Vector3(...a)), nn = v1.cross(v2);
    const m = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).add(new THREE.Vector3(...c)).multiplyScalar(1 / 3);
    if (nn.dot(m.sub(ref)) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
    pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc);
  };
  for (let i = 0; i < sections.length - 1; i++) {
    const A = sections[i], B = sections[i + 1], ca = cen(A), cb = cen(B);
    let per = 0;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const a = [A.pts[j][0], A.pts[j][1], A.z], b = [A.pts[k][0], A.pts[k][1], A.z], c = [B.pts[k][0], B.pts[k][1], B.z], d = [B.pts[j][0], B.pts[j][1], B.z];
      const el = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const u0 = per * s, u1 = (per + el) * s; per += el;
      const ref = new THREE.Vector3((ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2, (A.z + B.z) / 2);
      tri(a, b, c, [u0, A.z * s], [u1, A.z * s], [u1, B.z * s], ref);
      tri(a, c, d, [u0, A.z * s], [u1, B.z * s], [u0, B.z * s], ref);
    }
  }
  const cap = (S, dir) => { const c = cen(S); const ref = new THREE.Vector3(c[0], c[1], S.z - dir); for (let j = 0; j < n; j++) { const k = (j + 1) % n; tri([c[0], c[1], S.z], [S.pts[j][0], S.pts[j][1], S.z], [S.pts[k][0], S.pts[k][1], S.z], [c[0] * s, c[1] * s], [S.pts[j][0] * s, S.pts[j][1] * s], [S.pts[k][0] * s, S.pts[k][1] * s], ref); } };
  if (opts.capStart !== false) cap(sections[0], 1);
  if (opts.capEnd !== false) cap(sections[sections.length - 1], -1);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opts.smooth) { g = mergeVerts(g); }
  g.computeVertexNormals();
  return mk(g, mat);
}
function mergeVerts(g) {
  /* gleiche Positionen zusammenlegen, damit die Normalen weich werden */
  const p = g.attributes.position, uv = g.attributes.uv, map = new Map(), np = [], nuv = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const key = Math.round(p.getX(i) * 100) + ',' + Math.round(p.getY(i) * 100) + ',' + Math.round(p.getZ(i) * 100);
    let k = map.get(key);
    if (k === undefined) { k = np.length / 3; map.set(key, k); np.push(p.getX(i), p.getY(i), p.getZ(i)); nuv.push(uv.getX(i), uv.getY(i)); }
    idx.push(k);
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(nuv, 2)); o.setIndex(idx); return o;
}
/* Kurzform: Rumpf mit Achteck-Querschnitten. prof = [[z, w, h, c?, dy?], …] von hinten nach vorn */
export function hull(prof, mat, opts) { return loft(prof.map(([z, w, h, c, dy]) => ({ z, pts: oct(w, h, c === undefined ? Math.min(w, h) * 0.28 : c, dy || 0) })), mat, opts); }
/* Kasten mit abgerundeten Kanten (Fase) */
/* Texturmaßstab an die Größe anpassen (gleich große Platten auf großen und kleinen Teilen) */
export function uvScale(g, su, sv = su) { const uv = g.attributes.uv; if (!uv) return g; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
export function box(w, h, d, mat, r = Math.min(w, h, d) * 0.12) { const k = Math.max(0.12, Math.max(w, h, d) / 36); return mk(uvScale(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.05, r)), k), mat); }
/* Zylinder entlang Z */
export function cyl(r1, r2, len, mat, seg = 16, open = false) { const g = uvScale(new THREE.CylinderGeometry(r2, r1, len, seg, 1, open), Math.max(0.1, Math.PI * (r1 + r2) / 36), Math.max(0.1, len / 36)); g.rotateX(Math.PI / 2); return mk(g, mat); }
/* einfacher Kasten ohne Fase (12 Dreiecke) für kleine Teile und Greebles; Texturmaßstab wie box */
export function blk(w, h, d, mat) { const k = Math.max(0.12, Math.max(w, h, d) / 36); return mk(uvScale(new THREE.BoxGeometry(w, h, d), k), mat); }
/* Drehkörper um die Y-Achse: prof = [[r, y], …]. Reihenfolge so, dass die Außenseite links der Laufrichtung liegt:
   außen von unten nach oben, Deckel von außen nach innen, Innenwand von oben nach unten, Boden von innen nach außen.
   hard = true (Standard) gibt harte Kanten an jedem Profilpunkt (Technik); false für weiche Kuppeln. */
export function lathe(prof, mat, seg = 32, opts = {}) {
  const hard = opts.hard !== false, pts = [];
  prof.forEach(([r, y], i) => { const v = new THREE.Vector2(Math.max(0.0001, r), y); pts.push(v); if (hard && i > 0 && i < prof.length - 1) pts.push(v.clone()); });
  const g = new THREE.LatheGeometry(pts, seg, opts.phi0 || 0, opts.phiLen || Math.PI * 2);
  let rmax = 0, y0 = Infinity, y1 = -Infinity; for (const [r, y] of prof) { rmax = Math.max(rmax, r); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  uvScale(g, Math.max(0.1, Math.PI * 2 * rmax / 36), Math.max(0.1, (y1 - y0 + rmax) / 36));
  return mk(g, mat);
}
/* flacher Ring in der XZ-Ebene: Innenradius ri, Außenradius ro, Höhe h, rechteckiger Querschnitt */
export function annulus(ri, ro, h, mat, seg = 48) { return lathe([[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2], [ri, -h / 2]], mat, seg); }
/* Kreis aus n gleichen Teilen: make(i, winkel) liefert ein Objekt, das bei (r, y, 0) in Richtung +X steht und um Y gedreht wird */
export function radial(n, r, make, y = 0, a0 = 0) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2, o = make(i, a); const h = new THREE.Group(); o.position.x += r; o.position.y += y; h.add(o); h.rotation.y = -a; g.add(h); } return g; }
export function sphere(r, mat, ws = 20, hs = 14) { return mk(uvScale(new THREE.SphereGeometry(r, ws, hs), Math.max(0.1, r * 6.28 / 36), Math.max(0.1, r * 3.14 / 36)), mat); }
export function at(o, x, y, z, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
/* Spiegelkopie an der Längsachse (x → −x) */
export function mirror(o) { const c = o.clone(true); c.position.x = -c.position.x; c.scale.x *= -1; c.rotation.y = -c.rotation.y; c.rotation.z = -c.rotation.z; return c; }
/* beidseitig anbringen */
export function both(g, o) { g.add(o); g.add(mirror(o)); return o; }

/* ------------------------------------------------------------ Module */
/* Triebwerk: Düse (Glocke), Glutscheibe, Flamme nach hinten (−Z). r Radius, len Düsenlänge, M = mats */
export function engine(M, r, len = r * 1.4, plume = r * 6, glow = M.glow) {
  const g = new THREE.Group(); plume *= 0.6;
  const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(r * (0.7 + 0.35 * t * t), -t * len)); }
  const bell = new THREE.LatheGeometry(prof, 20); bell.rotateX(-Math.PI / 2); bell.rotateX(Math.PI);
  /* Lathe läuft entlang Y; nach dem Drehen zeigt die Öffnung nach −Z */
  g.add(mk(bell, M.dark));
  const ring = mk(new THREE.TorusGeometry(r * 1.02, r * 0.12, 6, 20), M.hull2); ring.position.z = -len * 0.15; g.add(ring);
  const disc = mk(new THREE.CircleGeometry(r * 0.95, 20), glow, false); disc.rotation.y = Math.PI; disc.position.z = -len * 0.55; g.add(disc);
  if (plume > 0) {
    const pg = new THREE.CylinderGeometry(r * 0.9, r * 0.25, plume, 16, 1, true); pg.translate(0, -plume / 2, 0); pg.rotateX(Math.PI / 2);
    const fl = new THREE.Mesh(pg, M.plume); fl.position.z = -len * 0.55; fl.userData.flame = true; fl.renderOrder = 2; g.add(fl);
  }
  return g;
}
/* Geschützturm: Sockel, Gehäuse, n Rohre entlang +Z */
export function turret(M, s = 3, barrels = 2, long = 2.2, mat = M.hull2) {
  const g = new THREE.Group();
  g.add(at(cyl(s * 1.1, s * 1.2, s * 0.5, M.dark, 14), 0, 0, 0, Math.PI / 2));
  const house = box(s * 1.6, s * 0.9, s * 1.8, mat, s * 0.2); house.position.y = s * 0.6; g.add(house);
  for (let i = 0; i < barrels; i++) { const b = cyl(s * 0.18, s * 0.14, s * long, M.dark, 8); b.position.set((i - (barrels - 1) / 2) * s * 0.45, s * 0.65, s * (0.8 + long / 2)); g.add(b); }
  g.userData.turret = true;
  return g;
}
/* Antenne / Mast */
export function antenna(M, h, r = h * 0.03) { const g = new THREE.Group(); const m = mk(new THREE.CylinderGeometry(r * 0.5, r, h, 6), M.dark); m.position.y = h / 2; g.add(m); for (let i = 1; i <= 2; i++) { const c = mk(new THREE.CylinderGeometry(h * 0.08, h * 0.08, r * 1.2, 8), M.dark); c.position.y = h * (0.35 + i * 0.2); g.add(c); } const tip = mk(new THREE.SphereGeometry(r * 1.6, 8, 6), M.red, false); tip.position.y = h; tip.userData.blink = 1.3; g.add(tip); return g; }
/* Radarschüssel (dreht sich) */
export function dish(M, r) { const g = new THREE.Group(); const d = mk(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), M.hull2); d.material = M.hull2; d.rotation.x = Math.PI; d.position.y = r * 1.1; g.add(d); const st = mk(new THREE.CylinderGeometry(r * 0.08, r * 0.12, r, 6), M.dark); st.position.y = r * 0.5; g.add(st); const f = mk(new THREE.ConeGeometry(r * 0.06, r * 0.6, 6), M.dark); f.position.y = r * 0.55; g.add(f); g.userData.spin = { axis: 'y', speed: 0.6 }; return g; }
/* Kühlrippen (Radiator): Fläche aus Lamellen */
export function radiator(M, w, len, fins = 8, mat = M.hull2) { const g = new THREE.Group(); for (let i = 0; i < fins; i++) { const f = box(w, 0.25, len / fins * 0.75, mat, 0.08); f.position.z = (i - (fins - 1) / 2) * len / fins; g.add(f); } const sp = box(w * 0.12, 0.5, len, M.dark, 0.1); sp.position.x = -w / 2; g.add(sp); return g; }
/* Fensterband (flache Platte mit leuchtenden Fenstern). Material je Fensterdichte, damit Bänder verschiedener Länge
   dieselbe Fenstergröße haben (früher teilten sich alle Bänder eine Wiederholung). */
export function windows(M, len, h = 1.5) {
  const k = Math.max(0.25, Math.round(len / 40 * 4) / 4), key = '_win' + k;
  if (!M[key]) { const m = M.windows.clone(); m.emissiveMap = M.windows.emissiveMap.clone(); m.emissiveMap.repeat.set(k, 1); m.emissiveMap.needsUpdate = true; M[key] = m; }
  return mk(new THREE.PlaneGeometry(len, h), M[key], false);
}
/* Positionslicht, blinkend */
export function navLight(M, r, color = 'light', rate = 1) { const m = mk(new THREE.SphereGeometry(r, 8, 6), M[color] || M.light, false); m.userData.blink = rate; return m; }
/* Leuchtstreifen */
export function strip(M, w, h, len, mat = M.glow) { return mk(new THREE.BoxGeometry(w, h, len), mat, false); }
/* Aufschrift (z. B. Rumpfnummer). Ebene, Normale +X (Seitenwand); für oben rx = −π/2 */
export function decal(text, w, h, color = '#ffffff', font = 'bold 72px "Barlow Condensed", sans-serif') {
  const c = canvas(512, 128, (x, cw, ch) => { x.clearRect(0, 0, cw, ch); x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cw / 2, ch / 2 + 4); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex(c, true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, metalness: 0.2, roughness: 0.6 }));
  m.rotation.y = Math.PI / 2; return m;
}
/* kleine Aufbauten (Greebles) auf einer Fläche: x0..x1, z0..z1 in Höhe y */
export function greebles(M, g, x0, x1, z0, z1, y, n, seed = 1, size = 1.4, mat = M.hull2) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const w = size * (0.4 + r()), d = size * (0.4 + r() * 1.6), h = size * (0.2 + r() * 0.6); const b = box(w, h, d, r() < 0.3 ? M.dark : mat, 0.06); b.position.set(x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0)); g.add(b); }
}
/* Panzerplatten in Reihe (seitlich angesetzt) */
export function platesRow(M, n, w, h, d, gap, mat = M.hull2) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const b = box(w, h, d, mat, 0.15); b.position.z = (i - (n - 1) / 2) * (d + gap); g.add(b); } return g; }

/* ------------------------------------------------------------ Organisch (Brood) */
/* verjüngte Röhre entlang Punkten (Tentakel, Rippen). pts: [[x,y,z],…], r0 → r1 */
export function tube(pts, r0, r1, mat, seg = 24, rad = 10, wobble = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(seg, false), pos = [], idx = [], uv = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i], r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= rad; j++) { const a = j / rad * Math.PI * 2, w = 1 + wobble * Math.sin(a * 3 + t * 9); pos.push(P.x + (Math.cos(a) * N.x + Math.sin(a) * B.x) * r * w, P.y + (Math.cos(a) * N.y + Math.sin(a) * B.y) * r * w, P.z + (Math.cos(a) * N.z + Math.sin(a) * B.z) * r * w); uv.push(j / rad, t * 3); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return mk(g, mat);
}
/* Körper aus Ellipsen-Querschnitten, weich, mit Beulen (noise) */
export function body(prof, mat, opts = {}) {
  /* prof: [[z, rx, ry, dy?], …] */
  const n = opts.n || 18, r = rng(opts.seed || 3), noise = opts.noise || 0;
  const secs = prof.map(([z, rx, ry, dy]) => ({ z, pts: ngon(n, rx, ry, 0, dy || 0).map(([x, y]) => { const k = 1 + (r() - 0.5) * noise; return [x * k, y * k]; }) }));
  return loft(secs, mat, Object.assign({ smooth: true, uv: 1 / 30 }, opts));
}
/* Panzerschuppe aus Chitin: gebogene Platte über dem Rücken */
export function carapace(M, len, w, h, mat = M.chitin) {
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45); g.scale(w, h, len); return mk(g, mat);
}
export function spike(M, len, r, mat = M.bone) { const g = new THREE.ConeGeometry(r, len, 8); g.translate(0, len / 2, 0); return mk(g, mat); }
/* leuchtender Pustel- oder Augenpunkt */
export function orb(M, r, mat = M.acid) { const m = mk(new THREE.SphereGeometry(r, 12, 8), mat, false); m.userData.pulse = { amp: 0.15, speed: 2 + Math.random() * 2 }; return m; }

/* ------------------------------------------------------------ Kristalle (Nexus) */
/* langgezogener Kristall entlang Z: Prisma mit Spitzen an beiden Enden */
export function crystal(M, len, r, sides = 6, mat = M.crystal, tip = 0.3) {
  const pts = ngon(sides, r, r * 0.85, Math.PI / sides);
  const tiny = pts.map(([x, y]) => [x * 0.02, y * 0.02]);
  return loft([{ z: -len / 2, pts: tiny }, { z: -len / 2 + len * tip, pts }, { z: len / 2 - len * tip, pts: pts.map(([x, y]) => [x * 0.92, y * 0.92]) }, { z: len / 2, pts: tiny }], mat, { uv: 1 / 20 });
}
/* Splitter (unregelmäßig) */
export function shard(M, size, seed = 1, mat = M.crystal) {
  const r = rng(seed), g = new THREE.OctahedronGeometry(size, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.5 + r() * 0.6), p.getY(i) * (0.5 + r() * 0.8), p.getZ(i) * (1 + r() * 1.2));
  g.computeVertexNormals(); return mk(g, mat);
}

/* ------------------------------------------------------------ Register */
export const BUILD = {};
/* register('lancer', M => group): M = mats(Fraktion) */
export function register(id, fn) { BUILD[id] = fn; }
/* Stationen: registerB('alliance', 'yard', (M, d, lv) => group), lv = 1, 2 oder 3, d = Eintrag aus stations.json.
   Mitte im Ursprung, oben +Y, Grundfläche im Kreis mit Radius d.r (XZ-Ebene). Kennzeichen für das Spiel:
   userData.aim (Kopf eines Geschützes, dreht um Y zum Ziel), charge (wächst mit der Ladung der Superwaffe),
   chargeAt: x (leuchtet ab Ladung x), berth {len} (Bauplatz der Werft, Bug +Z), dock (Andockplatz, Bug des Frachters +Z). */
export const BUILDB = {};
export function registerB(f, role, fn) { BUILDB[f + ':' + role] = fn; }
/* Kartenobjekte: registerW('ice', (M, o) => group) – o = { kind, r, seed, state, mode, w, h, … } aus der Karte (map.js).
   Mitte im Ursprung, oben +Y, Grundfläche im Kreis mit Radius o.r. M = mats('guardian') für Erbauer-Stätten/Tore,
   natürliche Objekte bringen eigene Materialien mit (zwischenspeichern!). */
export const BUILDW = {};
export function registerW(kind, fn) { BUILDW[kind] = fn; }
/* Ladung der Superwaffe 0…1 auf alle Kennzeichen übertragen */
export function setCharge(root, k) {
  root.traverse(o => { const u = o.userData; if (u.charge) o.scale.setScalar(Math.max(0.02, k) * (u.chargeBase || 1)); if (u.chargeAt !== undefined) o.visible = k >= u.chargeAt; });
}

/* Animation aller Kennzeichen im Baum */
export function animate(root, t, dt) {
  root.traverse(o => {
    const u = o.userData;
    if (u.flame) { const s = 0.8 + Math.sin(t * 37 + o.id) * 0.12 + Math.sin(t * 13 + o.id * 3) * 0.08; o.scale.set(1, 1, s); }
    if (u.blink) o.visible = ((t * u.blink + o.id * 0.137) % 1) < 0.45;
    if (u.spin) o.rotation[u.spin.axis] += u.spin.speed * dt;
    if (u.pulse) { const k = 1 + Math.sin(t * u.pulse.speed + o.id) * u.pulse.amp; o.scale.setScalar(k * (u.pulse.base || 1)); }
    if (u.orbit) { const a = t * u.orbit.speed + (u.orbit.phase || 0); o.position.set(Math.cos(a) * u.orbit.r, (u.orbit.y || 0) + Math.sin(a * 2) * (u.orbit.wob || 0), Math.sin(a) * u.orbit.r * (u.orbit.flat || 1) + (u.orbit.z || 0)); o.rotation.y += dt * 0.8; }
    if (u.bob) { o.position.y = (u.bob.y0 || 0) + Math.sin(t * u.bob.speed + o.id) * u.bob.amp; }
    if (u.sway) { o.rotation[u.sway.axis || 'y'] = (u.sway.base || 0) + Math.sin(t * u.sway.speed + (u.sway.phase || 0)) * u.sway.amp; }
    /* Geschützköpfe schwenken im Betrachter langsam; im Spiel setzt die Zielrichtung den Winkel */
    if (u.aim && !u.aimHold) o.rotation.y = (u.aim.base || 0) + Math.sin(t * 0.35 + (u.aim.phase || 0)) * 1.1;
  });
}

/* ------------------------------------------------------------ Verschmelzen für das Spiel (bake)
   Der Spielrenderer zeigt viele Modelle zugleich; jeder Knoten mit eigenem Material kostet einen Draw-Call.
   bake(root, opts) fasst alle unbewegten Teile unter demselben »lebendigen« Knoten je Material zu einem Mesh
   zusammen. Lebendig sind Knoten mit Kennzeichen (LIVE: flame, blink, spin, pulse, orbit, bob, sway, aim,
   charge, chargeAt, berth, dock) – sie bleiben eigene Knoten und werden in sich verschmolzen, damit animate(),
   setCharge() und das Spiel sie weiter bewegen können. Dazu:
   - Klone eines Materials, die sich nur in Kachelung/Versatz der Textur unterscheiden (windows(), Nebelstreifen),
     werden in die Texturkoordinaten gefaltet und teilen sich ein Material.
   - Einfarbige MeshBasicMaterial (Leuchtteile glow/light/red/green …) werden mit Vertexfarben zu einem Material
     je Mischmodus zusammengelegt (Farbwerte > 1 bleiben für den Bloom erhalten).
   - Sprites ohne Kennzeichen werden zu flachen Quads (opts.face: 'cam' zur festen Spielkamera, 'up' liegend,
     sonst bleiben sie Sprites) und ebenfalls verschmolzen; Punkte (Points) je Material zusammengelegt.
   - Meshes mit Kindern werden zu Gruppen, ihr Körper wandert in den Puffer; leere Gruppen fallen weg.
   opts: { keep: Kennzeichenliste (Standard LIVE), face: 'cam' | 'up' | null, faceDir: Vector3, drop: Liste von
   Kennzeichen, die vor dem Verschmelzen gelöscht werden (z. B. ['pulse', 'bob'] für Nebelschwaden) }.
   Das Ergebnis ist derselbe Wurzelknoten; Draw-Calls je Modell ≈ Anzahl der Materialien + lebendige Knoten. */
export const LIVE = ['flame', 'blink', 'spin', 'pulse', 'orbit', 'bob', 'sway', 'aim', 'charge', 'chargeAt', 'berth', 'dock'];
export function isLive(o, keep = LIVE) { const u = o.userData; for (const k of keep) if (u[k] !== undefined && u[k] !== false) return true; return false; }
const BAKE = { glow: new Map(), quad: new Map(), fold: new Map(), quadGeo: null };
/* Textur-Kennung (Bildquelle) für Material-Signaturen */
const texId = t => t && t.source ? t.source.uuid : t ? t.uuid : '';
/* Signatur: gleiche Signatur → dasselbe Material nach dem Falten der Texturkachelung */
function matSig(m) {
  if (m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && m.customProgramCacheKey() !== '') return 'u|' + m.uuid;
  const base = [m.type, m.transparent ? 1 : 0, m.opacity, m.blending, m.side, m.depthWrite ? 1 : 0, m.depthTest ? 1 : 0, m.toneMapped ? 1 : 0, m.vertexColors ? 1 : 0, m.polygonOffset ? m.polygonOffsetFactor : '', m.alphaTest];
  if (m.isMeshStandardMaterial) return 'std|' + base.join(',') + '|' + m.color.getHex() + '|' + m.emissive.getHex() + '|' + m.emissiveIntensity + '|' + m.metalness + '|' + m.roughness + '|' + (m.flatShading ? 1 : 0) + '|' + m.bumpScale + '|' + m.envMapIntensity + '|' + texId(m.map) + '|' + texId(m.bumpMap) + '|' + texId(m.emissiveMap) + '|' + texId(m.roughnessMap) + '|' + texId(m.metalnessMap) + '|' + texId(m.alphaMap) + '|' + texId(m.normalMap);
  if (m.isMeshBasicMaterial) return 'bas|' + base.join(',') + '|' + (m.map ? m.color.getHex() : 'vc') + '|' + texId(m.map) + '|' + texId(m.alphaMap);
  return 'u|' + m.uuid;
}
/* Texturkachelung des Materials: alle Texturen müssen dieselbe haben, sonst nicht faltbar */
function matTile(m) {
  let rep = null;
  for (const k of ['map', 'bumpMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'normalMap']) {
    const t = m[k]; if (!t) continue;
    const r = [t.repeat.x, t.repeat.y, t.offset.x, t.offset.y];
    if (!rep) rep = r; else if (r.some((v, i) => Math.abs(v - rep[i]) > 1e-6)) return null;
  }
  return rep || [1, 1, 0, 0];
}
/* kanonisches Material je Signatur (Kachelung 1, Versatz 0); einfarbige Basismaterialien → Vertexfarben */
function canonMat(m) {
  if (m.isMeshBasicMaterial && !m.map && !m.alphaMap && !m.vertexColors) {
    const key = ['g', m.transparent ? 1 : 0, m.opacity, m.blending, m.side, m.depthWrite ? 1 : 0, m.depthTest ? 1 : 0, m.toneMapped ? 1 : 0].join(',');
    let c = BAKE.glow.get(key);
    if (!c) { c = m.clone(); c.color.set(1, 1, 1); c.vertexColors = true; c.name = 'bakedGlow'; BAKE.glow.set(key, c); }
    return { mat: c, color: m.color, tile: [1, 1, 0, 0] };
  }
  const tile = matTile(m);
  if (!tile) return { mat: m, color: null, tile: null };
  const sig = matSig(m);
  if (sig.startsWith('u|')) return { mat: m, color: null, tile: null };
  let c = BAKE.fold.get(sig);
  if (!c) {
    if (tile[0] === 1 && tile[1] === 1 && tile[2] === 0 && tile[3] === 0) c = m;
    else {
      c = m.clone();
      for (const k of ['map', 'bumpMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'normalMap']) if (c[k]) { c[k] = c[k].clone(); c[k].repeat.set(1, 1); c[k].offset.set(0, 0); c[k].needsUpdate = true; }
    }
    BAKE.fold.set(sig, c);
  }
  return { mat: c, color: null, tile: c === m ? null : tile };
}
/* Sprite-Material → Quad-Material (zwischengespeichert) */
function quadMat(sm) {
  let q = BAKE.quad.get(sm);
  if (!q) { q = new THREE.MeshBasicMaterial({ map: sm.map, color: sm.color.clone(), transparent: true, opacity: sm.opacity, blending: sm.blending, depthWrite: false, depthTest: sm.depthTest, side: THREE.DoubleSide, toneMapped: sm.toneMapped, fog: false }); BAKE.quad.set(sm, q); }
  return q;
}
export function bake(root, opts = {}) {
  const keep = opts.keep || LIVE, live = o => o === root || isLive(o, keep);
  if (opts.drop) root.traverse(o => { for (const k of opts.drop) delete o.userData[k]; });
  /* Meshes mit Kindern: Körper abtrennen, Knoten wird Gruppe */
  const split = [];
  root.traverse(o => { if ((o.isMesh || o.isSprite) && o.children.length && !o.isInstancedMesh) split.push(o); });
  for (const o of split) {
    const g = new THREE.Group(); g.position.copy(o.position); g.rotation.copy(o.rotation); g.scale.copy(o.scale); g.userData = o.userData; g.name = o.name; g.visible = o.visible;
    for (const c of [...o.children]) g.add(c);
    const body = o.isMesh ? new THREE.Mesh(o.geometry, o.material) : new THREE.Sprite(o.material); body.castShadow = o.castShadow; body.receiveShadow = o.receiveShadow; body.renderOrder = o.renderOrder;
    g.add(body); o.parent.add(g); o.parent.remove(o);
  }
  /* Sprites → Quads */
  if (opts.face) {
    if (!BAKE.quadGeo) BAKE.quadGeo = new THREE.PlaneGeometry(1, 1);
    root.updateMatrixWorld(true);
    const q = []; root.traverse(o => { if (o.isSprite && !live(o)) q.push(o); });
    const dir = opts.faceDir || new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), rq = new THREE.Quaternion();
    for (const s of q) {
      s.matrixWorld.decompose(p, rq, sc);
      const mesh = new THREE.Mesh(BAKE.quadGeo, quadMat(s.material)); mesh.renderOrder = s.renderOrder;
      /* Weltlage: Mitte des Sprites, Größe aus der Skalierung, Blick zur Kamera (cam) oder nach oben (up) */
      const par = s.parent; par.updateMatrixWorld(true); m4.copy(par.matrixWorld).invert();
      mesh.position.copy(p).applyMatrix4(m4);
      const up = opts.face === 'up' ? new THREE.Vector3(0, 1, 0) : dir;
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
      const inv = new THREE.Quaternion(); par.matrixWorld.decompose(new THREE.Vector3(), inv, new THREE.Vector3()); mesh.quaternion.premultiply(inv.invert());
      if (s.material.rotation) mesh.rotateZ(s.material.rotation);
      mesh.scale.set(sc.x, sc.y, 1); mesh.userData = s.userData; mesh.name = s.name;
      par.add(mesh); par.remove(s);
    }
  }
  root.updateMatrixWorld(true);
  /* Eimer: lebendiger Besitzer → (Schlüssel → Liste) */
  const owner = o => { let p = o.parent; while (p && !live(p)) p = p.parent; return p || root; };
  const buckets = new Map(), rm = [];
  root.traverse(o => {
    if (o === root || live(o) || o.isInstancedMesh || o.isLine) return;
    if (!(o.isMesh || o.isPoints)) return;
    if (o.children.length) return;
    let vis = true; for (let p = o.parent; p && p !== root && !live(p); p = p.parent) if (!p.visible) { vis = false; break; }
    if (!o.visible || !vis) { rm.push(o); return; }
    const c = canonMat(o.material), geo = o.geometry;
    if (!geo || !geo.attributes.position) return;
    const attrs = Object.keys(geo.attributes).filter(k => k !== 'color' || !c.color).sort().join(',');
    const key = (o.isPoints ? 'P' : 'M') + '|' + c.mat.uuid + '|' + attrs + '|' + (o.castShadow ? 1 : 0) + '|' + o.renderOrder;
    const b = owner(o); if (!buckets.has(b)) buckets.set(b, new Map());
    const mm = buckets.get(b); if (!mm.has(key)) mm.set(key, { mat: c.mat, items: [], points: o.isPoints, shadow: false, recv: false, order: o.renderOrder });
    const e = mm.get(key); e.items.push({ o, color: c.color, tile: c.tile }); e.shadow ||= o.castShadow; e.recv ||= o.receiveShadow;
  });
  for (const o of rm) o.parent.remove(o);
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [b, mm] of buckets) {
    inv.copy(b.matrixWorld).invert();
    for (const e of mm.values()) {
      const one = e.items.length === 1 && !e.items[0].color && !e.items[0].tile && e.items[0].o.parent === b;
      if (one) continue; /* schon ein einzelnes Mesh direkt am Besitzer */
      /* Attribute des Ergebnisses: alle gemeinsamen (position, normal, uv, color, vein, …); nicht indiziert */
      const first = e.items[0].o.geometry, names = Object.keys(first.attributes).filter(k => k !== 'color' || !e.items[0].color);
      const sizes = {}; for (const k of names) sizes[k] = first.attributes[k].itemSize;
      const wantColor = !!e.items[0].color; if (wantColor) { names.push('color'); sizes.color = 3; }
      const needNormal = !e.points && !names.includes('normal'); if (needNormal) { names.push('normal'); sizes.normal = 3; }
      let total = 0; for (const it of e.items) { const g = it.o.geometry; total += g.index ? g.index.count : g.attributes.position.count; }
      const out = {}; for (const k of names) out[k] = new Float32Array(total * sizes[k]);
      let w = 0;
      for (const it of e.items) {
        const o = it.o, g = o.geometry; if (needNormal && !g.attributes.normal) g.computeVertexNormals();
        rel.multiplyMatrices(inv, o.matrixWorld); n3.getNormalMatrix(rel);
        const flip = !e.points && rel.determinant() < 0, idx = g.index, cnt = idx ? idx.count : g.attributes.position.count, step = e.points ? 1 : 3;
        for (let i = 0; i < cnt; i += step) for (let j = 0; j < step; j++) {
          const vi = idx ? idx.getX(i + (flip ? [0, 2, 1][j] : j)) : i + (flip ? [0, 2, 1][j] : j);
          for (const k of names) {
            const a = g.attributes[k], s = sizes[k], dst = out[k], base = w * s;
            if (k === 'position') { v.fromBufferAttribute(a, vi).applyMatrix4(rel); dst[base] = v.x; dst[base + 1] = v.y; dst[base + 2] = v.z; }
            else if (k === 'normal') { if (a) { v.fromBufferAttribute(a, vi).applyMatrix3(n3).normalize(); dst[base] = v.x; dst[base + 1] = v.y; dst[base + 2] = v.z; } }
            else if (k === 'color' && it.color) { dst[base] = it.color.r; dst[base + 1] = it.color.g; dst[base + 2] = it.color.b; }
            else if (k === 'uv' && it.tile) { dst[base] = a.getX(vi) * it.tile[0] + it.tile[2]; dst[base + 1] = a.getY(vi) * it.tile[1] + it.tile[3]; }
            else if (a) { for (let c = 0; c < s; c++) dst[base + c] = a.array[vi * a.itemSize + c]; }
          }
          w++;
        }
        o.parent.remove(o);
      }
      const geo = new THREE.BufferGeometry();
      for (const k of names) geo.setAttribute(k, new THREE.BufferAttribute(out[k], sizes[k]));
      geo.computeBoundingSphere();
      let m;
      if (e.points) m = new THREE.Points(geo, e.mat);
      else { m = new THREE.Mesh(geo, e.mat); m.castShadow = e.shadow; m.receiveShadow = e.recv; }
      m.renderOrder = e.order; m.name = 'baked'; b.add(m);
    }
  }
  /* leere Gruppen entfernen */
  const prune = o => { for (const c of [...o.children]) { prune(c); if (!c.isMesh && !c.isSprite && !c.isPoints && !c.isLine && !c.children.length && !live(c)) o.remove(c); } };
  prune(root);
  return root;
}
/* Anzahl der Zeichenaufrufe eines Baums (sichtbare Meshes, Sprites, Punkte, Linien) */
export function drawCount(root) { let n = 0; root.traverse(o => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.visible) n++; }); return n; }
