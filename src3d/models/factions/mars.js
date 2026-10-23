/* =====================================================================
   MARTIAN REPUBLIC – Formensprache: brutalistisch, kantig, funktional. Facettierte Rümpfe mit kleinen Fasen
   (keine Rundungen), gestapelte Panzerplatten mit sichtbaren Fugen, offenes Fachwerk, Kühlrippen mit Restglut,
   am Heck ein Fusions-Fackelantrieb (weiß-blauer Strahl mit Schockdiamanten). Railguns als lange Läufe mit
   Schienen und Spulenringen, PDC-Türme (Mehrlauf, schwenken), Warnstreifen, rote Akzente sparsam,
   bernsteinfarbene Positionslichter, Rumpfnummern »MCRN …«.
   Bug +Z, oben +Y, Länge = data len.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { register, loft, oct, ngon, cyl, at, engine, antenna, dish, navLight, strip, decal, mesh, rng, PAL } from '../kit.js';

const PI = Math.PI, HP = PI / 2;
let UV = 1 / 24;   /* Plattengröße der Rumpftextur, je Schiff gesetzt */

/* ------------------------------------------------------------ eigene Materialien (einmal je Materialsatz) */
function cnv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const XC = new WeakMap();
function xm(M) {
  let X = XC.get(M); if (X) return X;
  const basic = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  const additive = (c, k, map, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  /* Strahlverlauf: hell an der Düse, seitlich weich ausgeblendet */
  const fade = ctex(cnv(32, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const s = x.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, w, h);
  }));
  /* nahtlose Warnstreifen (45°, Periode teilt die Kachel in beiden Richtungen) */
  const hz = cnv(64, 64, (x) => {
    x.fillStyle = '#e3b21f'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#1a1917';
    for (let k = -3; k < 3; k++) { x.beginPath(); x.moveTo(k * 32, 0); x.lineTo(k * 32 + 16, 0); x.lineTo(k * 32 + 80, 64); x.lineTo(k * 32 + 64, 64); x.fill(); }
    const r = rng(7); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(30,25,20,${0.08 + r() * 0.2})`; x.fillRect(r() * 64, r() * 64, 1 + r() * 4, 1 + r() * 2); }
  });
  /* Kühlrippe: Lamellen, Glut an der Wurzel (v = 0) */
  const radMap = cnv(64, 128, (x) => { x.fillStyle = '#2b2725'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 64; i += 8) { x.fillStyle = '#3e3935'; x.fillRect(i + 2, 0, 4, 128); x.fillStyle = '#1e1b19'; x.fillRect(i, 0, 1, 128); } x.fillStyle = '#1e1b19'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 60, 64, 2); });
  const radEm = cnv(64, 128, (x) => { const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, '#ff9440'); g.addColorStop(0.18, '#d24a18'); g.addColorStop(0.55, '#3a0c04'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 64, 128); x.fillStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < 64; i += 8) x.fillRect(i, 0, 2, 128); });
  /* Eis: Risse und Bläschen */
  const iceMap = cnv(128, 128, (x) => { x.fillStyle = '#dff3ff'; x.fillRect(0, 0, 128, 128); const r = rng(3); x.strokeStyle = 'rgba(90,150,200,0.55)'; for (let i = 0; i < 26; i++) { x.lineWidth = 0.5 + r() * 1.5; x.beginPath(); let px = r() * 128, py = r() * 128; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 50; py += (r() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; x.beginPath(); x.arc(r() * 128, r() * 128, 0.5 + r() * 2, 0, 7); x.fill(); } });
  /* Hoheitszeichen: roter Ring, weißer Berg (Olympus Mons) */
  const emb = cnv(128, 128, (x) => { x.fillStyle = '#c8402a'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.fillStyle = '#1d1b19'; x.beginPath(); x.arc(64, 64, 47, 0, 7); x.fill(); x.fillStyle = '#ece3d3'; x.beginPath(); x.moveTo(24, 86); x.lineTo(52, 44); x.lineTo(60, 52); x.lineTo(70, 38); x.lineTo(104, 86); x.closePath(); x.fill(); x.fillStyle = '#c8402a'; x.fillRect(24, 92, 80, 7); });
  X = {
    fade,
    torchDisc: basic('#e9f1ff', 3.4),
    core: additive('#eef4ff', 1.9, fade),
    diamond: additive('#d6e6ff', 1.4, null, 0.55),
    hotRim: basic('#ff7a2a', 2.2),
    railGlow: basic('#9fd0ff', 2.4),
    lens: basic('#ff4a2a', 3.2),
    beam: additive('#ff6a2a', 2.2, fade),
    bay: basic('#ffb070', 1.6),
    hazard: new THREE.MeshStandardMaterial({ map: ctex(hz), metalness: 0.3, roughness: 0.6 }),
    rad: new THREE.MeshStandardMaterial({ map: ctex(radMap), emissiveMap: ctex(radEm), emissive: '#ffffff', emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.65 }),
    ice: new THREE.MeshStandardMaterial({ map: ctex(iceMap), color: '#cfeaff', metalness: 0.05, roughness: 0.35, emissive: '#3d9be0', emissiveIntensity: 0.55, transparent: true, opacity: 0.9 }),
    emblem: new THREE.MeshStandardMaterial({ map: ctex(emb), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, metalness: 0.2, roughness: 0.6 })
  };
  X.steel = new THREE.MeshStandardMaterial({ color: '#b3aea6', metalness: 0.85, roughness: 0.3, bumpMap: M.hull.bumpMap, bumpScale: 0.3 });
  XC.set(M, X); return X;
}
/* Materialsatz der Fraktion mit korrekt eingefärbten Rumpftexturen.
   kit.tint() nimmt new THREE.Color(hex) – das liefert lineare Werte – und schreibt sie als sRGB-Bytes in die Leinwand;
   die Textur wird dann noch einmal als sRGB dekodiert. Dunkle Paletten (Mars) werden dadurch fast schwarz
   (Rumpf-Mittel 57,46,36 statt 138,125,112). Hier wird aus derselben Plattenleinwand (bumpMap) neu eingefärbt,
   mit der Palettenfarbe leicht zum Geschützmetall-Grau hin entsättigt. */
function tintS(src, col, contrast = 0.6) {
  const s = {}; col.getRGB(s, THREE.SRGBColorSpace);
  return cnv(src.width, src.height, (x) => {
    x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, src.width, src.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const l = Math.max(0.25, 1 + (p[i] / 180 - 1) * contrast); p[i] = Math.min(255, s.r * 255 * l); p[i + 1] = Math.min(255, s.g * 255 * l); p[i + 2] = Math.min(255, s.b * 255 * l); }
    x.putImageData(d, 0, 0);
  });
}
const MMC = new WeakMap();
function mm(M0) {
  let M = MMC.get(M0); if (M) return M;
  const P = PAL.mars, pc = M0.hull.bumpMap.image;
  /* Palettenfarbe zum Geschützmetall-Grau hin mischen (lift hebt die Helligkeit des Graus) */
  const gun = (hex, k, lift) => new THREE.Color(hex).lerp(new THREE.Color('#7c7c7e').multiplyScalar(lift), k);
  const v = (m, col, o) => { const c = m.clone(); c.map = ctex(tintS(pc, col)); c.color = new THREE.Color(1, 1, 1); Object.assign(c, o); return c; };
  const dark = M0.dark.clone(); dark.color = new THREE.Color(P.dark).lerp(new THREE.Color('#3d3c3b'), 0.6); dark.metalness = 0.65; dark.roughness = 0.62; dark.bumpMap = null;
  M = Object.assign({}, M0, {
    hull: v(M0.hull, gun(P.hull, 0.45, 1.05), { metalness: 0.35, roughness: 0.74 }),
    hull2: v(M0.hull2, gun(P.hull2, 0.4, 0.78), { metalness: 0.45, roughness: 0.7 }),
    dark
  });
  MMC.set(M0, M); return M;
}
/* register mit Mars-Materialsatz */
const reg = (id, fn) => register(id, M0 => bake(fn(mm(M0))));

/* ------------------------------------------------------------ Grundformen */
/* Achteck-Querschnitt mit unterschiedlicher Breite oben (wt) und unten (wb): ergibt schräge Flanken */
function oct2(wt, wb, h, c, dy = 0) {
  c = Math.min(c, Math.min(wt, wb) / 2 - 0.01, h / 2 - 0.01);
  return [[wb / 2, -h / 2 + c], [wt / 2, h / 2 - c], [wt / 2 - c, h / 2], [-wt / 2 + c, h / 2], [-wt / 2, h / 2 - c], [-wb / 2, -h / 2 + c], [-wb / 2 + c, -h / 2], [wb / 2 - c, -h / 2]].map(([x, y]) => [x, y + dy]);
}
const norm = ([z, wt, wb = wt, h, c, dy = 0]) => [z, wt, wb, h, c === undefined ? Math.min(wt, wb, h) * 0.2 : c, dy];
/* Rumpf: prof = [[z, wt, wb, h, c?, dy?], …] von hinten nach vorn */
function H(prof, mat, opts = {}) { return loft(prof.map(norm).map(([z, wt, wb, h, c, dy]) => ({ z, pts: oct2(wt, wb, h, c, dy) })), mat, Object.assign({ uv: UV }, opts)); }
/* Querschnitt des Profils an Stelle z (linear interpoliert) */
function profAt(P, z) { const Q = P.map(norm); if (z <= Q[0][0]) return Q[0].slice(); for (let i = 0; i < Q.length - 1; i++) { const a = Q[i], b = Q[i + 1]; if (z <= b[0]) { const t = (z - a[0]) / (b[0] - a[0]); return a.map((v, k) => v + (b[k] - v) * t); } } return Q[Q.length - 1].slice(); }
/* rechte Flanke des Profils auf Höhe y: x und Neigung a */
function side(P, z, y) { const [, wt, wb, h, c, dy] = profAt(P, z); const y0 = -h / 2 + c + dy, y1 = h / 2 - c + dy, t = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); return { x: wb / 2 + (wt - wb) / 2 * t, a: Math.atan2((wt - wb) / 2, y1 - y0) }; }
const topY = (P, z) => { const q = profAt(P, z); return q[3] / 2 + q[5]; };
const botY = (P, z) => { const q = profAt(P, z); return -q[3] / 2 + q[5]; };
/* Ring um das Profil (Panzergürtel, Warnstreifen) */
function band(P, z, len, grow, mat, haz = 0) {
  const f = (zz) => { const q = profAt(P, zz); return [zz, q[1] + grow * 2, q[2] + grow * 2, q[3] + grow * 2, q[4] + grow * 0.8, q[5]]; };
  const m = H([f(z - len / 2), f(z + len / 2)], mat); if (haz) hazUV(m.geometry, haz); return m;
}
/* Kasten mit kleiner Fase an allen Kanten (64 Dreiecke); fw/fh verjüngen die Vorderseite */
function slab(w, h, d, mat, c = Math.min(w, h, d) * 0.2, fw = 1, fh = 1) {
  c = Math.min(c, w / 2 - 0.02, h / 2 - 0.02, d / 2 - 0.02, w * fw / 2 - 0.02, h * fh / 2 - 0.02);
  const S = (z, W, Hh, cc) => ({ z, pts: oct(Math.max(0.05, W), Math.max(0.05, Hh), cc) });
  return loft([S(-d / 2, w - 2 * c, h - 2 * c, 0.02), S(-d / 2 + c, w, h, c), S(d / 2 - c, w * fw, h * fh, c), S(d / 2, w * fw - 2 * c, h * fh - 2 * c, 0.02)], mat, { uv: UV });
}
/* scharfkantiger Quader (12 Dreiecke, gemeinsame Geometrie) */
const UB = new THREE.BoxGeometry(1, 1, 1);
function bar(w, h, d, mat) { const m = mesh(UB, mat); m.scale.set(w, h, d); return m; }
/* Träger zwischen zwei Punkten */
function beam(a, b, t, mat, t2 = t) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); const m = bar(t, t2, d.length(), mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); return m; }
/* Fachwerk entlang Z: vier Gurte, Rahmen, Diagonalen */
function truss(M, len, w, h, bays, mat = M.dark, t = 0.22) {
  const g = new THREE.Group(), z0 = -len / 2, dz = len / bays;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(bar(t * 1.5, t * 1.5, len, mat), sx * w / 2, sy * h / 2, 0));
  for (let i = 0; i <= bays; i++) { const z = z0 + i * dz; g.add(at(bar(w, t, t, mat), 0, h / 2, z)); g.add(at(bar(w, t, t, mat), 0, -h / 2, z)); g.add(at(bar(t, h, t, mat), w / 2, 0, z)); g.add(at(bar(t, h, t, mat), -w / 2, 0, z)); }
  for (let i = 0; i < bays; i++) {
    const za = z0 + i * dz, zb = za + dz, f = i % 2 ? 1 : -1;
    for (const sx of [-1, 1]) g.add(beam([sx * w / 2, -f * h / 2, za], [sx * w / 2, f * h / 2, zb], t, mat));
    for (const sy of [-1, 1]) g.add(beam([-f * w / 2, sy * h / 2, za], [f * w / 2, sy * h / 2, zb], t, mat));
  }
  return g;
}
/* Warnstreifen-UVs: ebene Projektion je Flächenrichtung, Streifenbreite sw */
function hazUV(geo, sw = 0.4) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2), k = 1 / (sw * 4);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
function hazBar(M, w, h, d, sw = 0.35) { const g = hazUV(new THREE.BoxGeometry(w, h, d), sw); return mesh(g, xm(M).hazard); }
/* Träger mit Warnstreifen zwischen zwei Punkten */
function hazBeam(M, a, b, t, sw = 0.3) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); const m = hazBar(M, t, t, d.length(), sw); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); return m; }
/* Objekt entlang einer Richtung ausrichten (+Z zeigt nach dir) */
function aim(o, dir) { o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize()); return o; }
/* Zusammenbacken: alle ruhenden Meshes je Material zu einem Mesh verschmelzen (weniger Draw Calls fürs Handy).
   Grenzen sind die Wurzel und jeder Knoten mit Animations- oder Turm-Kennzeichen: was darunter hängt, wird relativ
   zu diesem Knoten verschmolzen, damit Drehen/Schwenken/Flackern weiter funktioniert. Abziehbilder und additive
   Strahlen (depthWrite aus) bleiben einzeln. */
const ANIM = ['flame', 'blink', 'spin', 'pulse', 'orbit', 'bob', 'sway', 'turret'];
function bake(root) {
  const isB = o => o === root || ANIM.some(k => o.userData[k]);
  const owner = o => { let p = o.parent; while (p && !isB(p)) p = p.parent; return p; };
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh || isB(o) || o.children.length || (o.material.transparent && !o.material.depthWrite)) return;
    const b = owner(o); if (!buckets.has(b)) buckets.set(b, new Map());
    const mm = buckets.get(b), k = o.material.uuid; if (!mm.has(k)) mm.set(k, { mat: o.material, items: [] });
    mm.get(k).items.push(o);
  });
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const [b, mm] of buckets) {
    inv.copy(b.matrixWorld).invert();
    for (const { mat, items } of mm.values()) {
      if (items.length < 2) continue;
      let shadow = false;
      const geos = items.map(o => {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        rel.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(rel);
        if (rel.determinant() < 0) { const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; for (let i = 0; i < p.count; i += 3) for (const a of [p, n, u]) { const s = a.itemSize; for (let c = 0; c < s; c++) { const t = a.array[(i + 1) * s + c]; a.array[(i + 1) * s + c] = a.array[(i + 2) * s + c]; a.array[(i + 2) * s + c] = t; } } }
        shadow = shadow || o.castShadow; o.parent.remove(o); return g;
      });
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = shadow; m.receiveShadow = true; b.add(m);
    }
  }
  return root;
}
/* an einer Stelle mit Ausrichtung anbringen (rz dreht »oben« zur Seite) */
function mount(g, o, x, y, z, rz = 0, rx = 0) { const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(rx, 0, rz); h.add(o); g.add(h); return h; }

/* ------------------------------------------------------------ Module */
const DIA = new THREE.OctahedronGeometry(1, 0);
/* Fusions-Fackel: Düse mit Spulenringen, glühender Rand, heller Kernstrahl mit Schockdiamanten. Öffnung bei z = −1.5 r */
function torch(M, r, plume = r * 9) {
  const X = xm(M), g = new THREE.Group(), len = r * 1.5;
  g.add(engine(M, r, len, plume, X.torchDisc));
  const rim = mesh(new THREE.TorusGeometry(r * 1.06, r * 0.07, 4, 20), X.hotRim, false); rim.position.z = -len; g.add(rim);
  for (const t of [0.4, 0.75]) { const c = mesh(new THREE.TorusGeometry(r * (0.75 + 0.35 * t * t), r * 0.11, 4, 8), M.dark); c.position.z = -len * t; c.rotation.z = PI / 8; g.add(c); }
  const pl = new THREE.Group(); pl.position.z = -len * 0.5; pl.userData.flame = true;
  const L = plume * 0.8, cg = new THREE.CylinderGeometry(r * 0.5, r * 0.08, L, 12, 1, true); cg.translate(0, -L / 2, 0); cg.rotateX(HP);
  const core = new THREE.Mesh(cg, X.core); core.renderOrder = 3; pl.add(core);
  for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(DIA, X.diamond), k = 1 - i * 0.17; d.scale.set(r * 0.34 * k, r * 0.34 * k, r * 0.75); d.position.z = -r * (1.3 + i * 1.7); d.renderOrder = 3; pl.add(d); }
  g.add(pl);
  return g;
}
/* PDC: kleiner Mehrlaufturm (Gatling, dreht), schwenkt */
function pdc(M, s = 1, seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  g.add(at(cyl(s * 0.75, s * 0.95, s * 0.4, M.dark, 8), 0, s * 0.2, 0, HP));
  const head = new THREE.Group(); head.position.y = s * 0.78;
  head.add(slab(s * 1.15, s * 0.8, s * 1.25, M.hull2, s * 0.16, 0.8, 0.85));
  const cl = new THREE.Group(); cl.position.set(0, 0, s * 0.55);
  for (let k = 0; k < 4; k++) { const a = k * HP + PI / 4; cl.add(at(cyl(s * 0.075, s * 0.075, s * 1.6, M.dark, 5), Math.cos(a) * s * 0.16, Math.sin(a) * s * 0.16, s * 0.85)); }
  cl.add(at(cyl(s * 0.3, s * 0.3, s * 0.4, M.dark, 8), 0, 0, s * 0.2)); cl.add(at(cyl(s * 0.27, s * 0.27, s * 0.12, M.dark, 8), 0, 0, s * 1.5));
  cl.userData.spin = { axis: 'z', speed: 5 };
  head.add(cl); head.rotation.x = -0.25; g.add(head);
  g.userData.sway = { axis: 'y', amp: 0.8, speed: 0.4 + r() * 0.5, phase: r() * 6 }; g.userData.turret = true;
  return g;
}
/* Autokanone: kantiges Gehäuse, n Rohre mit Mündungsbremse */
function cannon(M, s = 1, n = 2, blen = 3, seed = 1, mat = M.hull2) {
  const g = new THREE.Group(), r = rng(seed);
  g.add(at(cyl(s * 1.2, s * 1.35, s * 0.45, M.dark, 8), 0, s * 0.22, 0, HP));
  const head = new THREE.Group(); head.position.y = s * 0.42;
  head.add(loft([{ z: -s * 1.3, pts: oct2(s * 1.7, s * 2.2, s * 1.1, s * 0.22, s * 0.55) }, { z: s * 0.5, pts: oct2(s * 1.8, s * 2.2, s * 1.1, s * 0.22, s * 0.55) }, { z: s * 1.25, pts: oct2(s * 1.1, s * 1.8, s * 0.65, s * 0.15, s * 0.38) }], mat, { uv: UV }));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * s * 0.66;
    head.add(at(cyl(s * 0.25, s * 0.23, s * 0.7, M.dark, 8), x, s * 0.42, s * 1.45));
    head.add(at(cyl(s * 0.13, s * 0.12, s * blen, M.dark, 6), x, s * 0.42, s * (1.5 + blen / 2)));
    head.add(at(bar(s * 0.34, s * 0.3, s * 0.5, M.dark), x, s * 0.42, s * (1.55 + blen)));
  }
  head.add(at(bar(s * 0.12, s * 0.12, s * 0.9, M.dark), s * 0.75, s * 1.2, -s * 0.6));
  g.add(head);
  g.userData.sway = { axis: 'y', amp: 0.45, speed: 0.25 + r() * 0.3, phase: r() * 6 }; g.userData.turret = true;
  return g;
}
/* Spinal-Railgun entlang +Z (z = 0 … len): zwei Schienen, Leuchtspalt, Spulenringe, Mündung */
function rail(M, len, s = 1, step = 3.2) {
  const g = new THREE.Group(), X = xm(M);
  for (const y of [-1, 1]) g.add(at(slab(s * 1.3, s * 0.5, len, M.dark, s * 0.12), 0, y * s * 0.5, len / 2));
  g.add(at(strip(M, s * 0.34, s * 0.3, len * 0.99, X.railGlow), 0, 0, len / 2));
  const n = Math.max(2, Math.round(len / (s * step)));
  for (let i = 0; i < n - 1; i++) g.add(at(slab(s * 1.9, s * 1.9, s * 0.5, i % 3 === 1 ? M.hull : M.hull2, s * 0.4), 0, 0, (i + 0.5) * len / n));
  g.add(at(slab(s * 2.1, s * 2.1, s * 1.3, M.hull2, s * 0.4, 0.86, 0.86), 0, 0, len - s * 0.65));
  g.add(at(bar(s * 0.5, s * 0.5, s * 0.1, X.railGlow), 0, 0, len + 0.01));
  return g;
}
/* Railgun-Turm: flaches Gehäuse mit einem langen Schienenlauf */
function railTurret(M, s = 1, blen = 10, seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  g.add(at(cyl(s * 1.6, s * 1.8, s * 0.5, M.dark, 8), 0, s * 0.25, 0, HP));
  const head = new THREE.Group(); head.position.y = s * 0.5;
  head.add(loft([{ z: -s * 2.2, pts: oct2(s * 2.4, s * 3.0, s * 1.3, s * 0.3, s * 0.65) }, { z: s * 1.0, pts: oct2(s * 2.6, s * 3.0, s * 1.4, s * 0.3, s * 0.7) }, { z: s * 1.9, pts: oct2(s * 1.6, s * 2.4, s * 0.9, s * 0.2, s * 0.5) }], M.hull, { uv: UV }));
  const b = rail(M, blen * s, s * 0.55, 2.6); b.position.set(0, s * 0.7, s * 1.2); head.add(b);
  for (const x of [-1, 1]) head.add(at(cyl(s * 0.28, s * 0.28, s * 2.4, M.dark, 8), x * s * 1.05, s * 0.75, -s * 0.6));
  g.add(head);
  g.userData.sway = { axis: 'y', amp: 0.3, speed: 0.18 + r() * 0.2, phase: r() * 6 }; g.userData.turret = true;
  return g;
}
/* Kühlrippe: Fläche mit Glut an der Wurzel (y = 0), Spannweite +Y, Länge Z, Holm an der Spitze */
function radPanel(M, span, len, t = 0.16) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(t, span, len); geo.translate(0, span / 2, 0);
  g.add(mesh(geo, xm(M).rad));
  g.add(at(bar(t * 2.4, t * 2.4, len + t * 2, M.dark), 0, span, 0));
  g.add(at(bar(t * 2.4, span, t * 2.4, M.dark), 0, span / 2, len / 2)); g.add(at(bar(t * 2.4, span, t * 2.4, M.dark), 0, span / 2, -len / 2));
  return g;
}
/* Flügel aus Kühlrippe: Seite s, Pfeilung sw (Spitze nach hinten), V-Stellung dh */
function wing(M, span, len, sw, dh, s) { const p = radPanel(M, span, len); p.rotation.x = -sw; const a = new THREE.Group(); a.add(p); a.rotation.z = -s * (HP - dh); return a; }
/* Rippenfeld: n senkrechte Rippen nebeneinander */
function finArray(M, n, span, len, gap) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const f = radPanel(M, span, len); f.position.x = (i - (n - 1) / 2) * gap; g.add(f); } g.add(at(bar(gap * (n - 1) + 0.6, 0.3, len * 0.9, M.dark), 0, 0.15, 0)); return g; }
/* Schrift für Abziehbilder: lange Namen kleiner, damit sie auf die 512er-Leinwand von kit.decal passen */
const dfont = txt => `bold ${txt.length > 9 ? 50 : 72}px "Barlow Condensed", sans-serif`;
/* Rumpfnummer beidseitig auf der Flanke des Profils */
/* Flankenrichtung des Profils an z: x, Neigung a und Verjüngung (Gierwinkel) yaw */
function flank(P, z, y) { const q = side(P, z, y), k = (side(P, z + 0.5, y).x - side(P, z - 0.5, y).x); return { x: q.x, a: q.a, yaw: Math.atan(k) }; }
function nums(g, txt, P, z, y, h, out = 0.02, col = '#e6dccb') {
  const q = flank(P, z, y);
  for (const s of [-1, 1]) { const d = decal(txt, h * 4.4, h, col, dfont(txt)); d.rotation.order = 'ZYX'; d.rotation.set(0, s * (HP + q.yaw), -s * q.a); d.position.set(s * (q.x + out), y, z); g.add(d); }
}
function numAt(g, txt, x, y, z, h, a = 0, col = '#e6dccb') { for (const s of [-1, 1]) { const d = decal(txt, h * 4.4, h, col, dfont(txt)); d.rotation.order = 'ZYX'; d.rotation.set(0, s * HP, -s * a); d.position.set(s * x, y, z); g.add(d); } }
function emblem(M, g, x, y, z, r, a = 0) { for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), xm(M).emblem); m.rotation.order = 'ZYX'; m.rotation.set(0, s * HP, -s * a); m.position.set(s * x, y, z); g.add(m); } }
/* Fensterschlitze (eine Reihe), Ebene mit Normale +X wie decal */
function slits(M, len, h = 0.3, dens = 1) {
  const geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 22 * dens, 0.835 + uv.getY(i) * 0.065);
  const m = mesh(geo, M.windows, false); m.rotation.y = HP; return m;
}
function slitsBoth(M, g, P, z, y, len, h, dens) { const q = flank(P, z, y); for (const s of [-1, 1]) { const m = slits(M, len, h, dens); m.rotation.order = 'ZYX'; m.rotation.set(0, s * (HP + q.yaw), -s * q.a); m.position.set(s * (q.x + 0.02), y, z); g.add(m); } }
/* Leuchtlinie: schmaler bernsteinfarbener Lichtstreifen entlang einer Kante */
const glowLine = (M, w, h, len) => strip(M, w, h, len, M.glowSoft);
/* Lampe (ruhig) und Positionslicht (blinkt) */
const lamp = (M, r) => mesh(new THREE.SphereGeometry(r, 6, 4), M.light, false);
function lights(M, g, pts, r = 0.18, rate = 1) { for (const [x, y, z] of pts) g.add(at(navLight(M, r, 'light', rate), x, y, z)); }
/* kleine Aufbauten aus scharfen Quadern */
function greeb(M, g, x0, x1, z0, z1, y, n, seed, size = 1) { const r = rng(seed); for (let i = 0; i < n; i++) { const w = size * (0.4 + r()), d = size * (0.5 + r() * 1.5), h = size * (0.15 + r() * 0.45); g.add(at(bar(w, h, d, r() < 0.35 ? M.dark : M.hull2), x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0))); } }
/* Panzerplatten entlang Z mit Fugen, auf der Flanke des Profils (beidseitig) */
function flankPlates(M, g, P, y, h, z0, z1, n, gap, t = 0.4, mat = M.hull2) {
  const L = (z1 - z0 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) { const z = z0 + L / 2 + i * (L + gap), q = side(P, z, y); for (const s of [-1, 1]) { const p = slab(t, h, L, mat, Math.min(t, h) * 0.3); p.position.set(s * (q.x + t * 0.5), y, z); p.rotation.z = -s * q.a; g.add(p); } }
}
/* Panzerplatten auf dem Rücken */
function topPlates(M, g, P, z0, z1, n, gap, w, t = 0.45, mat = M.hull2, inset = 0) {
  const L = (z1 - z0 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) { const z = z0 + L / 2 + i * (L + gap); g.add(at(slab(w, t, L, mat, t * 0.35, 0.95), 0, topY(P, z) + t / 2 - inset, z)); }
}
/* PDC-Satz: einmal bauen, für jede Stelle klonen (gleiche Geometrie), Phase neu würfeln */
function pdcs(M, g, list, s = 1, seed = 1) { const r = rng(seed), proto = bake(pdc(M, s, seed)); for (const [x, y, z, rz] of list) { const c = proto.clone(); c.userData.sway = Object.assign({}, proto.userData.sway, { phase: r() * 6, speed: 0.35 + r() * 0.5 }); mount(g, c, x, y, z, rz || 0); } }
/* Ecken eines Profils für PDC-Montage: Fasenmitte und Ausrichtung */
function corner(P, z, sx, sy) { const [, wt, wb, h, c, dy] = profAt(P, z); const w = sy > 0 ? wt : wb; return [sx * (w / 2 - c / 2), sy * (h / 2 - c / 2) + dy, z, -sx * (sy > 0 ? PI / 4 : 3 * PI / 4)]; }
/* Antriebsblock-Streben zur Düse */
function struts(M, g, r, z, k = 4, len = 2, mat = M.dark) { for (let i = 0; i < k; i++) { const a = i / k * PI * 2 + PI / 4; g.add(beam([Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, z], [Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, z - len], r * 0.14, mat)); } }

/* flach auf eine Oberseite legen: Leserichtung R, Schriftoben U (Normale = R × U) */
function flat(o, R, U) { const N = new THREE.Vector3().crossVectors(R, U); o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, N)); return o; }
/* Rumpfnummer auf dem Rücken: beidseitig längs (Schriftoben nach außen) oder mittig quer */
function topNum(g, txt, x, y, z, h, center = false, col = '#e6dccb') {
  const V = THREE.Vector3;
  if (center) { const d = decal(txt, h * 4.4, h, col, dfont(txt)); flat(d, new V(1, 0, 0), new V(0, 0, -1)); d.position.set(0, y, z); g.add(d); return; }
  for (const s of [-1, 1]) { const d = decal(txt, h * 4.4, h, col, dfont(txt)); flat(d, new V(0, 0, s), new V(s, 0, 0)); d.position.set(s * x, y, z); g.add(d); }
}

/* ===================================================================== SCHIFFE */

/* NEEDLE – Korvette: flacher Keil mit Kantenschneiden, Rückengrat mit Cockpit, Fackel, zwei Torpedorohre, Heckflossen */
reg('needle', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-10, 7.0, 7.0, 2.9, 1.05], [-2, 5.5, 5.5, 2.7, .95], [5, 3.9, 3.9, 2.3, .8, -.1], [11, 2.0, 2.0, 1.4, .5, -.35], [15, .25, .25, .3, .1, -.5]];
  g.add(H(P, M.hull));
  /* Rückengrat mit Cockpit */
  const PS = [[-10.4, 2.0, 2.8, 1.3, .3, 1.95], [1.5, 1.9, 2.6, 1.2, .3, 1.9], [6.5, .9, 1.6, .5, .15, 1.3]];
  g.add(H(PS, M.hull2));
  g.add(at(slab(1.5, .22, 2.4, M.glass, .06, .7), 0, 2.2, 4.0, .16));
  g.add(at(bar(1.1, .05, .3, M.trim), 0, 2.55, 1.4));
  /* Rückenplatten links und rechts vom Grat */
  for (const s of [-1, 1]) for (const [z, l] of [[-8.0, 3.6], [-4.0, 3.6], [-.2, 3.2]]) { const w = 1.25 - Math.max(0, z + 2) * .05; g.add(at(slab(w, .3, l, M.hull2, .1, .94), s * (1.25 + w / 2 + .1), topY(P, z) + .1, z)); }
  /* Kantenschneiden entlang der Chine */
  for (const s of [-1, 1]) for (const [z0, z1] of [[-9.6, -3.6], [-3.0, 2.8], [3.4, 9.2]]) {
    const xa = side(P, z0, 0).x, xb = side(P, z1, 0).x, L = Math.hypot(xb - xa, z1 - z0);
    const b = slab(.7, .42, L, M.hull2, .12, 1, .7); b.position.set(s * ((xa + xb) / 2 + .2), 0, (z0 + z1) / 2); b.rotation.y = s * Math.atan2(xb - xa, z1 - z0); g.add(b);
  }
  /* Torpedorohre unter dem Rumpf */
  for (const s of [-1, 1]) {
    const t = new THREE.Group();
    t.add(at(cyl(.55, .55, 11, M.hull2, 8), 0, 0, 0, 0, 0, PI / 8));
    const hz = mesh(hazUV(new THREE.CylinderGeometry(.62, .62, .7, 8, 1).rotateX(HP), .25), X.hazard); hz.position.z = 5.2; hz.rotation.z = PI / 8; t.add(hz);
    t.add(at(mesh(new THREE.CircleGeometry(.45, 8), M.dark, false), 0, 0, 5.56, 0, 0, PI / 8));
    const tip = mesh(new THREE.ConeGeometry(.3, .55, 8).rotateX(HP), M.trim); tip.position.z = 5.35; t.add(tip);
    for (const z of [-3.5, 1.5]) t.add(at(slab(1.35, 1.0, .45, M.dark, .2), 0, .2, z));
    t.position.set(s * 1.55, -1.75, 0); g.add(t);
  }
  /* Antriebsblock, Warnband, Fackel */
  const PD = [[-14, 4.2, 4.2, 3.2, .8], [-12.4, 5.2, 5.2, 3.8, 1.0], [-10, 7.0, 7.0, 2.9, 1.05]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -12.0, .55, .06, X.hazard, .22));
  const e = torch(M, 1.5, 16); e.position.z = -14; g.add(e); struts(M, g, 1.5, -14, 4, 1.4);
  /* Heckflossen (Kühlrippen) nach außen geneigt */
  for (const s of [-1, 1]) {
    const f = wing(M, 3.6, 4.0, .3, HP - .5, s); f.position.set(s * 2.2, 1.35, -10.2); g.add(f);
    const tip = navLight(M, .2, 'light', 1.2); tip.position.set(0, 3.7, -.4); f.children[0].add(tip);
  }
  /* Autokanone auf dem Grat */
  const c = cannon(M, .62, 1, 3.2, 3); c.position.set(0, 2.6, -2.2); g.add(c);
  topNum(g, 'MCRN 2217', 1.975, topY(P, -4) + .27, -4, .5);
  for (const s of [-1, 1]) { const xa = side(P, -9, 0).x, xb = side(P, 8, 0).x, L = Math.hypot(xb - xa, 17); const l = glowLine(M, .08, .08, L); l.position.set(s * ((xa + xb) / 2 + .55), -.23, -.5); l.rotation.y = s * Math.atan2(xb - xa, 17); g.add(l); }
  lights(M, g, [[0, -.6, 14.7], [3.75, 0, -9.6], [-3.75, 0, -9.6]], .16, .8);
  return g;
});

/* WASP – Torpedo-Korvette: Kopf mit zwei schweren Rohren, offene Fachwerk-Taille, Kühlflügel, gestreifter Hinterleib, Nachbrenner */
reg('wasp', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const PH = [[3.6, 3.6, 3.0, 2.8, .5, .3], [9.5, 3.4, 2.8, 2.6, .5, .2], [14.5, 1.4, 1.0, 1.0, .2, -.2]];
  g.add(H(PH, M.hull));
  topPlates(M, g, PH, 4, 9.5, 2, .35, 2.4, .35);
  g.add(at(slab(1.7, .26, 1.7, M.glass, .08, .8), 0, 1.13, 11.4, .235));
  for (const s of [-1, 1]) {
    const t = new THREE.Group();
    t.add(at(cyl(1.0, 1.0, 11, M.hull2, 8), 0, 0, 0, 0, 0, PI / 8));
    const hz = mesh(hazUV(new THREE.CylinderGeometry(1.08, 1.08, .8, 8, 1).rotateX(HP), .3), X.hazard); hz.position.z = 5.1; hz.rotation.z = PI / 8; t.add(hz);
    t.add(at(mesh(new THREE.CircleGeometry(.85, 8), M.dark, false), 0, 0, 5.52, 0, 0, PI / 8));
    const tip = mesh(new THREE.ConeGeometry(.55, 1.0, 8).rotateX(HP), M.trim); tip.position.z = 5.2; t.add(tip);
    for (const z of [-3.2, 1.2]) t.add(at(slab(2.35, 2.35, .55, M.dark, .35), 0, 0, z));
    t.add(at(cyl(.7, .9, 1.2, M.dark, 8), 0, 0, -6.1));
    t.position.set(s * 2.35, -.3, 8.6); g.add(t);
  }
  /* Taille */
  const tr = truss(M, 7.6, 1.9, 1.9, 4, M.dark, .2); tr.position.z = -.1; g.add(tr);
  g.add(at(cyl(.45, .45, 7.6, M.hull2, 8), 0, 0, -.1));
  for (const s of [-1, 1]) g.add(at(cyl(.16, .16, 7.6, M.trim, 6), s * .5, .55, -.1));
  /* Flügel: zwei Paar Kühlflächen */
  for (const s of [-1, 1]) {
    const w1 = wing(M, 7.2, 2.6, .55, .3, s); w1.position.set(s * .9, .5, .6); g.add(w1);
    const w2 = wing(M, 5.0, 2.0, .7, -.3, s); w2.position.set(s * .9, -.5, -.6); g.add(w2);
    const l = navLight(M, .2, 'light', 1.4); l.position.set(0, 7.2, -1.3); w1.children[0].add(l);
  }
  /* Hinterleib mit Warnstreifen-Ringen */
  const PA = [[-13, 3.8, 3.8, 3.8, .9], [-10.5, 5.6, 5.6, 5.4, 1.2], [-6, 5.2, 5.2, 5.0, 1.1], [-3.6, 2.8, 2.8, 2.6, .6]];
  g.add(H(PA, M.hull));
  for (const z of [-9.4, -7.2]) g.add(band(PA, z, 1.0, .08, X.hazard, .3));
  g.add(band(PA, -5.0, .5, .1, M.dark));
  topPlates(M, g, PA, -12.2, -4.4, 1, 0, 2.2, .35, M.hull2);
  /* Nachbrenner: Hauptfackel plus vier Zusatzdüsen und Glutring */
  const e = torch(M, 1.7, 18); e.position.z = -13; g.add(e);
  for (let k = 0; k < 4; k++) { const a = PI / 4 + k * HP, d = engine(M, .45, .7, 5, X.torchDisc); d.position.set(Math.cos(a) * 2.15, Math.sin(a) * 2.15, -12.4); g.add(d); }
  const ring = mesh(new THREE.TorusGeometry(2.15, .14, 4, 16), X.hotRim, false); ring.position.z = -12.9; g.add(ring);
  nums(g, 'MCRN 3306', PA, -6.3 + 3.5, 0, .5);
  lights(M, g, [[0, 2.1, -12], [0, -2.1, -12]], .16, .9);
  return g;
});

/* HEDGEHOG – Abwehrfregatte: hoher Kasten, drei Reihen Panzerplatten, zwei PDC-Kragen mit je sechs Türmen, zwei Autokanonen */
reg('hedgehog', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-13, 7.4, 7.4, 9.6, .8], [10, 7.4, 7.4, 9.6, .8], [14.5, 6.2, 7.0, 8.0, .7, -.5], [17.6, 4.4, 6.0, 5.6, .6, -1.1]];
  g.add(H(P, M.hull));
  /* Panzer: drei Reihen je Flanke, Rücken */
  for (const [y, m] of [[3.0, M.hull2], [0, M.hull], [-3.0, M.hull2]]) { flankPlates(M, g, P, y, 2.6, -12.4, -8.6, 1, 0, .45, m); flankPlates(M, g, P, y, 2.6, -4.6, 4.6, 2, .5, .45, m); }
  topPlates(M, g, P, -12.4, -8.6, 1, 0, 5.2, .45); topPlates(M, g, P, -4.6, 4.6, 2, .5, 5.2, .45);
  g.add(at(slab(4.4, .7, 22, M.hull2, .2), 0, -5.1, -1));
  /* PDC-Kragen: Ring, Warnkanten, sechs Türme auf Sockeln */
  const K = []; for (const z of [7.6, -6.6]) {
    g.add(band(P, z, 2.6, .55, M.hull2)); for (const dz of [-1.45, 1.45]) g.add(band(P, z + dz, .3, .6, X.hazard, .18));
    const w = 3.7 + .55, h = 4.8 + .55;
    for (const s of [-1, 1]) { K.push([s * (w - .7), h - .7, z, -s * PI / 4], [s * w, 0, z, -s * HP], [s * (w - .7), -(h - .7), z, -s * 3 * PI / 4]); }
  }
  for (const [x, y, z, rz] of K) { const p = mount(g, slab(1.6, .5, 1.8, M.dark, .15), x, y, z, rz); p.children[0].position.y = .15; }
  pdcs(M, g, K.map(([x, y, z, rz]) => [x - Math.sin(rz) * .4, y + Math.cos(rz) * .4, z, rz]), 1.15, 9);
  /* Bug: schräge Panzerstirn mit Schlitzen */
  g.add(at(slab(5.6, 3.6, .8, M.hull2, .25), 0, 1.2, 15.9, -.55));
  g.add(at(bar(4.0, .3, .1, M.glass), 0, 2.4, 15.5, -.55)); g.add(at(bar(4.6, .12, .12, M.trim), 0, 3.05, 15.1, -.55));
  /* Autokanonen: Rücken vorn und Bauch vorn */
  const c1 = cannon(M, 1.2, 2, 3.6, 2); c1.position.set(0, 4.8, 12); g.add(c1);
  const c2 = cannon(M, 1.2, 2, 3.6, 4); mount(g, c2, 0, -5.3, 12, PI);
  /* Antrieb: Block, Warnband, Fackel; Kühlflächen seitlich */
  const PD = [[-17, 5.6, 5.6, 7.2, .7], [-14.6, 6.6, 6.6, 8.6, .8], [-13, 7.4, 7.4, 9.6, .8]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -14.2, .6, .08, X.hazard, .3));
  const e = torch(M, 2.0, 17); e.position.z = -17; g.add(e); struts(M, g, 2.0, -17, 4, 1.8);
  for (const s of [-1, 1]) { const r = radPanel(M, 6.0, 5.0); r.rotation.z = -s * HP; r.position.set(s * 3.1, 0, -15.3); g.add(r); const l = navLight(M, .22, 'light', 1); l.position.set(0, 6.1, 2.5); r.add(l); }
  /* Antennen-Stacheln */
  for (const [x, z, a, h] of [[1.4, -11, .3, 5], [-1.4, -10, -.4, 4], [.8, 1.5, .15, 3.5], [-.8, -2, -.2, 3]]) { const an = antenna(M, h, .12); an.position.set(x, 4.8, z); an.rotation.z = -a; g.add(an); }
  greeb(M, g, -2.6, 2.6, -12.5, -9, 5.25, 8, 4, .9);
  numAt(g, 'MCRN 1931', 4.2, 0, 1.15, .7);
  emblem(M, g, 4.15, 3.0, -10.5, 1.0);
  return g;
});

/* LONGSHOT – kleine Railgun-Fregatte: kompakter Rumpf, langer freiliegender Lauf, Zielfernrohr, Kondensatorbänke */
reg('longshot', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-15.5, 4.6, 3.8, 4.2, .6], [-3, 5.0, 4.0, 4.4, .65], [2, 3.6, 3.2, 3.4, .55, -.1], [4.5, 2.6, 2.6, 2.6, .45]];
  g.add(H(P, M.hull));
  const rg = rail(M, 19.5, 1.0, 3.0); rg.position.z = .5; g.add(rg);
  g.add(at(slab(2.6, .6, 4.5, M.hull2, .2, .8), 0, 1.1, 3.4)); g.add(at(slab(2.6, .6, 4.5, M.hull2, .2, .8), 0, -1.1, 3.4));
  topPlates(M, g, P, -14.6, -3.4, 3, .4, 3.6, .45);
  flankPlates(M, g, P, .6, 1.8, -14.6, -2.6, 3, .4, .35);
  /* Zielfernrohr */
  const sc = new THREE.Group();
  sc.add(at(cyl(.5, .5, 8, M.hull2, 8), 0, 0, 0, 0, 0, PI / 8)); sc.add(at(cyl(.62, .66, 1.2, M.dark, 8), 0, 0, 4.3, 0, 0, PI / 8));
  sc.add(at(mesh(new THREE.CircleGeometry(.48, 8), X.lens, false), 0, 0, 4.92)); sc.add(at(slab(.5, .9, .8, M.dark, .1), 0, -.7, -2.4)); sc.add(at(slab(.5, .9, .8, M.dark, .1), 0, -.7, 1.8));
  sc.add(at(bar(.08, .5, 3, M.trim), 0, .45, -1));
  sc.position.set(0, 3.25, -2.5); g.add(sc);
  /* Kondensatorbänke unten seitlich */
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const c = cyl(.42, .42, 2.8, M.dark, 8); c.position.set(s * 1.9, -2.0, -12.4 + k * 3.3); g.add(c); g.add(at(bar(.95, .14, .3, X.hazard), s * 1.9, -1.6, -11.2 + k * 3.3)); }
  /* Antrieb */
  const PD = [[-19, 3.6, 3.6, 3.4, .6], [-17, 4.6, 4.4, 4.3, .7], [-15.5, 4.6, 3.8, 4.2, .6]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -16.6, .45, .06, X.hazard, .22));
  const e = torch(M, 1.35, 13); e.position.z = -19; g.add(e); struts(M, g, 1.35, -19, 4, 1.2);
  for (const s of [-1, 1]) { const w = wing(M, 4.6, 4.0, .35, -.35, s); w.position.set(s * 1.9, -.7, -12.4); g.add(w); const l = navLight(M, .18, 'light', 1.1); l.position.set(0, 4.6, -.8); w.children[0].add(l); }
  nums(g, 'MCRN 5508', P, -8.6, .6, .55, .36);
  return g;
});

/* SPEAR – Railgun-Kreuzer: lange Lanze aus Modulen, Spinal-Railgun weit vor dem Bug, Fachwerk-Mittelteil mit Kühlflächen-Kreuz */
reg('spear', M => {
  UV = 1 / 16; const g = new THREE.Group(), X = xm(M);
  const PC = [[-1, 6.6, 5.4, 5.8, .7], [12, 6.4, 5.2, 5.6, .7], [17.5, 4.2, 3.8, 4.0, .55, -.2]];
  g.add(H(PC, M.hull));
  const rg = rail(M, 22, 1.6, 3.0); rg.position.z = 13.2; g.add(rg);
  for (const y of [-1, 1]) g.add(at(slab(3.6, .7, 5, M.hull2, .25, .7), 0, y * 1.75, 18.5));
  topPlates(M, g, PC, 0, 12, 3, .4, 4.2, .45);
  flankPlates(M, g, PC, -1.2, 2.0, 0, 12, 3, .4, .4);
  slitsBoth(M, g, PC, 7.5, 1.4, 6, .32, 1.2);
  const c = cannon(M, .9, 2, 2.8, 5); c.position.set(0, topY(PC, 14) + .45, 14); g.add(c);
  /* Mittelteil: Kern im offenen Fachwerk, Kühlflächen-Kreuz */
  const PR = [[-17, 4.2, 4.2, 4.2, .5], [-1, 4.2, 4.2, 4.2, .5]];
  g.add(H(PR, M.hull2));
  const tr = truss(M, 16, 6.4, 5.6, 5, M.dark, .3); tr.position.z = -9; g.add(tr);
  /* X-Kühlflächen an den Fachwerkecken, leicht nach hinten gepfeilt */
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const dx = sx * Math.cos(.55), dy = sy * Math.sin(.55), r = radPanel(M, 9.5, 9); r.children[0].rotation.x = 0; r.rotation.z = Math.atan2(-dx, dy); r.position.set(sx * 3.2, sy * 2.8, -9.5); g.add(r);
    const l = navLight(M, .3, 'light', .9); l.position.set(0, 9.6, 4.4); r.add(l);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(hazBar(M, 1.0, 1.0, 9.6, .25), sx * 3.2, sy * 2.8, -9.5));
  /* Kondensatorsektion */
  const PK = [[-26, 7.2, 7.2, 6.6, .9], [-17, 7.2, 7.2, 6.6, .9], [-16, 5.6, 5.6, 5.0, .7]];
  g.add(H(PK, M.hull));
  for (const z of [-23.4, -21, -18.6]) g.add(band(PK, z, .8, .14, M.dark));
  g.add(band(PK, -25.3, .7, .1, X.hazard, .3));
  /* Antrieb */
  const PD = [[-34.5, 7.4, 7.4, 6.6, 1.0], [-31, 8.6, 8.6, 7.6, 1.1], [-26, 8.0, 8.0, 7.2, 1.0]];
  g.add(H(PD, M.hull2));
  topPlates(M, g, PD, -33, -26.5, 2, .5, 5.2, .55);
  flankPlates(M, g, PD, 0, 3.4, -33, -26.5, 2, .5, .5, M.hull);
  const e = torch(M, 2.6, 22); e.position.z = -34.5; g.add(e); struts(M, g, 2.6, -34.5, 4, 2.2);
  for (const s of [-1, 1]) { const d = torch(M, .8, 7); d.position.set(s * 3.4, 2.4, -34.4); g.add(d); }
  /* PDCs */
  pdcs(M, g, [corner(PC, 3, 1, 1), corner(PC, 3, -1, 1), corner(PC, 3, 1, -1), corner(PC, 3, -1, -1), corner(PD, -29, 1, 1), corner(PD, -29, -1, -1)], .95, 4);
  g.add(at(bar(.14, .8, 7, M.trim), 0, topY(PC, 5) + .6, 5));
  nums(g, 'MCRN 4471', PC, 6, -1.2, .9, .42);
  for (const s of [-1, 1]) { const q = side(PC, 6, .6); g.add(at(glowLine(M, .08, .1, 11.5), s * (q.x + .05), .6, 6)); }
  emblem(M, g, side(PK, -21, 1.6).x + .16, 1.6, -22.2, 1.3);
  lights(M, g, [[0, 4.0, -31], [0, -4.0, -31], [0, 1.3, 35.3]], .22, .8);
  return g;
});

/* HAMMER – Schlachtschiff: breiter Plattenblock, Hammerkopf-Bug, Breitseiten-Galerien, gestufter Aufbau */
reg('hammer', M => {
  UV = 1 / 17; const g = new THREE.Group(), X = xm(M);
  const P = [[-32, 15, 15, 11, 1.6], [-6, 17, 17, 12.4, 1.8], [24, 17, 17, 12.4, 1.8], [27, 15.6, 15.6, 11.4, 1.6]];
  g.add(H(P, M.hull));
  /* Hammerkopf */
  const PB = [[26.5, 23, 23, 9.6, 1.6], [31, 27, 27, 10, 1.8], [37.5, 27, 27, 10, 1.8], [41, 21, 21, 7.4, 1.5]];
  g.add(H(PB, M.hull2));
  for (const y of [-2.6, 0, 2.6]) g.add(at(slab(18, 2.2, 1.2, M.hull, .3, .94, .9), 0, y, 41.2));
  for (const s of [-1, 1]) { g.add(at(slab(1.2, 8.6, 9, M.hull, .3), s * 13.9, 0, 34)); g.add(at(hazBar(M, .3, 8.6, .6), s * 14.55, 0, 30.2)); g.add(at(slab(5.5, .5, 8, M.hull, .15), s * 9, 5.25, 34)); }
  topNum(g, '7701', 0, 5.02, 34.3, 3.2, true);
  /* Breitseiten-Galerien mit Autokanonen auf Sockeln, Panzerreihen darüber und darunter */
  for (const s of [-1, 1]) g.add(at(bar(1.4, 3.6, 44, M.dark), s * 8.3, .4, -3));
  const proto = bake(cannon(M, 1.35, 2, 3.8, 8, M.hull)), r = rng(5);
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const z = -20 + k * 8.6; g.add(at(slab(1.2, 2.6, 3.6, M.hull2, .2), s * 9.1, .4, z)); const c = proto.clone(); c.userData.sway = Object.assign({}, proto.userData.sway, { phase: r() * 6 }); mount(g, c, s * 9.6, .4, z, -s * HP); }
  flankPlates(M, g, P, 4.0, 3.0, -30, 24, 6, .6, .7);
  flankPlates(M, g, P, -3.6, 3.0, -30, 24, 6, .6, .7, M.hull);
  /* Rückenaufbau in Stufen */
  const T1 = [[-28, 11, 12, 2.6, .6, 7.5], [18, 11, 12, 2.6, .6, 7.5], [22, 7, 9, 2.0, .5, 7.2]];
  g.add(H(T1, M.hull2));
  const T2 = [[-26, 7, 8.4, 3.2, .6, 10.3], [-7, 7, 8.4, 3.2, .6, 10.3], [-4, 4.8, 6.6, 2.4, .5, 10.0]];
  g.add(H(T2, M.hull));
  const TW = [[-24, 5, 6, 4.2, .7, 13.9], [-15, 5, 6, 4.2, .7, 13.9], [-13, 3.6, 5, 3.0, .5, 13.6]];
  g.add(H(TW, M.hull2));
  slitsBoth(M, g, TW, -18.5, 14.3, 7, .5, 1.2); g.add(at(bar(3.4, .5, .1, M.glass), 0, 14.4, -12.96));
  g.add(band(TW, -21.5, .7, .06, M.trim));
  const a = antenna(M, 7, .2); a.position.set(1.2, 16, -21); g.add(a); const d = dish(M, 2.2); d.position.set(-1.2, 16, -19); g.add(d);
  /* schwere Rückentürme */
  for (const [z, y] of [[14, 8.8], [4, 11.9]]) { const c = cannon(M, 2.6, 2, 4.4, z | 0, M.hull); c.position.set(0, y, z); g.add(c); }
  const cv = cannon(M, 1.9, 2, 4, 21, M.hull); mount(g, cv, 0, -8.4, 14, PI);
  topPlates(M, g, T1, 17, 21.5, 1, 0, 6, .5);
  greeb(M, g, -5, 5, -27, -26, 8.8, 6, 3, 1.2);
  /* Kiel */
  g.add(H([[-28, 9, 6, 2.4, .5, -7.2], [20, 9, 6, 2.4, .5, -7.2], [24, 6, 4, 1.6, .4, -6.8]], M.hull2));
  /* PDCs an den Ecken */
  pdcs(M, g, [corner(P, 22, 1, 1), corner(P, 22, -1, 1), corner(P, 22, 1, -1), corner(P, 22, -1, -1), corner(P, -29, 1, 1), corner(P, -29, -1, 1), corner(P, -29, 1, -1), corner(P, -29, -1, -1)], 1.3, 6);
  /* Antrieb: drei Fackeln, Rippenfelder */
  const PD = [[-41, 14, 14, 10, 1.8], [-36, 16, 16, 11.4, 2.0], [-32, 15, 15, 11, 1.6]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -35, .8, .1, X.hazard, .4));
  for (const [x, rr] of [[0, 3.4], [-5.4, 2.3], [5.4, 2.3]]) { const e = torch(M, rr, rr * 7.5); e.position.set(x, 0, -41); g.add(e); }
  for (const sy of [-1, 1]) { const f = finArray(M, 5, 3.4, 7, 1.7); f.position.set(0, sy * 5.6, -36.5); if (sy < 0) f.rotation.z = PI; g.add(f); }
  numAt(g, 'MCRN 7701', 14.52, 0, 35.5, 1.5);
  for (const s of [-1, 1]) for (const y of [-1.25, 2.05]) g.add(at(glowLine(M, .1, .1, 42), s * 8.95, y, -3));
  emblem(M, g, side(P, -26, 0).x + .72, 4.0, -26, 1.2);
  lights(M, g, [[13.5, 4.8, 37], [-13.5, 4.8, 37], [13.5, -4.8, 37], [-13.5, -4.8, 37], [0, 6.9, -40]], .35, .7);
  return g;
});

/* OLYMPUS – Flaggschiff: hoher, gestufter Rumpf, zwei Spinal-Railguns, vier Railgun-Türme, Kommandoturm mit Zielmarkierer, Kühlflügel */
reg('olympus', M => {
  UV = 1 / 17; const g = new THREE.Group(), X = xm(M);
  const P = [[-34, 12, 11, 16, 1.8], [16, 13, 11.6, 16, 2.0], [30, 9.6, 8.4, 12, 1.6, -1.6], [40, 6.4, 5.6, 6.6, 1.0, -2.4]];
  g.add(H(P, M.hull));
  /* zwei Spinal-Railguns aus dem Bug */
  for (const s of [-1, 1]) { const rg = rail(M, 20, 1.25, 3.0); rg.position.set(s * 1.7, -2.6, 26); g.add(rg); }
  g.add(at(slab(7.2, 1.2, 4, M.hull2, .3, .8), 0, -.4, 40.5));
  /* Aufbau: Deck, Kommandoturm, Zielmarkierer */
  const T1 = [[-30, 9, 11, 2.6, .5, 9.3], [6, 9, 11, 2.6, .5, 9.3], [10, 6, 9, 2, .4, 9.0]];
  g.add(H(T1, M.hull2));
  const TW = [[-27, 6, 7, 6, .8, 13.6], [-15, 6, 7, 6, .8, 13.6], [-12, 4, 6, 4.2, .6, 13.0]];
  g.add(H(TW, M.hull));
  slitsBoth(M, g, TW, -18.5, 14.6, 6, .5, 1.2); g.add(at(bar(3.6, .6, .1, M.glass), 0, 13.5, -11.96));
  g.add(band(TW, -24.5, .9, .06, M.trim));
  const dd = dish(M, 2.8); dd.position.set(0, 16.6, -23); g.add(dd);
  const tgt = new THREE.Group(); tgt.add(at(slab(1.4, 1.4, 2.6, M.hull2, .25), 0, 0, 0)); tgt.add(at(cyl(.45, .5, 1, M.dark, 8), 0, 0, 1.6)); tgt.add(at(mesh(new THREE.CircleGeometry(.4, 8), X.lens, false), 0, 0, 2.11));
  tgt.add(at(cyl(.12, .12, 2.4, M.dark, 6), 0, -1.2, 0, HP)); tgt.position.set(0, 18.6, -16.5); tgt.userData.sway = { axis: 'y', amp: .6, speed: .3 }; g.add(tgt);
  const a = antenna(M, 8, .22); a.position.set(2.2, 16.6, -26); g.add(a); const a2 = antenna(M, 6, .2); a2.position.set(-2.2, 16.6, -26.5); g.add(a2);
  /* Kiel-Flosse */
  g.add(H([[-30, 4, 2.4, 5, .5, -10], [4, 4, 2.4, 5, .5, -10], [12, 2, 1.2, 2.4, .3, -8.6]], M.hull2));
  /* Railgun-Türme */
  const rt = bake(railTurret(M, 1.5, 9, 3)), r = rng(8);
  for (const [z, y, flip] of [[1, 10.6, 0], [20, topY(P, 20), 0], [-2, -8, 1], [20, botY(P, 20), 1]]) { const c = rt.clone(); c.userData.sway = Object.assign({}, rt.userData.sway, { phase: r() * 6 }); mount(g, c, 0, y, z, flip ? PI : 0); }
  /* Breitseiten-Autokanonen auf Sockeln und Panzerreihen */
  const cp = bake(cannon(M, 1.25, 2, 3.4, 13, M.hull));
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const z = -24 + k * 11, q = side(P, z, .8), c = cp.clone(); c.userData.sway = Object.assign({}, cp.userData.sway, { phase: r() * 6 }); g.add(at(slab(1.0, 2.6, 3.4, M.hull2, .2), s * (q.x + .3), .8, z)); mount(g, c, s * (q.x + .75), .8, z, -s * HP); }
  flankPlates(M, g, P, 5.0, 3.6, -32, 14, 5, .6, .7);
  flankPlates(M, g, P, -4.2, 3.4, -32, 14, 5, .6, .7, M.hull2);
  /* schwere PDCs */
  pdcs(M, g, [corner(P, 12, 1, 1), corner(P, 12, -1, 1), corner(P, 12, 1, -1), corner(P, 12, -1, -1), corner(P, -31, 1, 1), corner(P, -31, -1, 1), corner(P, -31, 1, -1), corner(P, -31, -1, -1)], 1.4, 12);
  /* Antrieb: fünf Fackeln, große Kühlflügel */
  const PD = [[-44, 12, 12, 14, 2.0], [-38, 14, 13, 16.6, 2.2], [-34, 12, 11, 16, 1.8]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -37, 1, .1, X.hazard, .45));
  const e = torch(M, 3.6, 30); e.position.z = -44; g.add(e);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const t = torch(M, 2.0, 15); t.position.set(sx * 3.8, sy * 4.2, -43.8); g.add(t); }
  for (const s of [-1, 1]) { const w = radPanel(M, 14, 12); w.rotation.z = -s * HP; w.position.set(s * 6.2, 0, -26); g.add(w); const l = navLight(M, .4, 'light', .8); l.position.set(0, 14.2, 6); w.add(l); g.add(at(hazBar(M, 1.6, 1.4, 12.4, .4), s * 6.6, 0, -26)); }
  nums(g, 'MCRN OLYMPUS', P, 23, .9, 2.6, .05);
  for (const s of [-1, 1]) { const q = side(P, -9, 2.75); const l = glowLine(M, .1, .12, 44); l.position.set(s * (q.x + .03), 2.75, -9); l.rotation.z = -s * q.a; g.add(l); }
  emblem(M, g, side(P, -6, 9.8).x, 9.8, -6, 1.6);
  return g;
});

/* PROSPECTOR – Bauschiff: Industrieblock, großer Bohrkopf vorn (dreht), Greifarme mit Fräsen, Schneidlaser, Erzrahmen */
reg('prospector', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-12, 7.4, 7.4, 6.0, .8], [3, 7.4, 7.4, 6.0, .8], [5.5, 6.0, 6.0, 5.0, .7]];
  g.add(H(P, M.hull));
  flankPlates(M, g, P, 0, 3.2, -11.4, 2.4, 3, .5, .4, M.hull2);
  /* Erzrahmen oben mit Behältern */
  const tr = truss(M, 13, 6.4, 1.6, 5, M.dark, .22); tr.position.set(0, 3.8, -4.5); g.add(tr);
  for (const [x, z] of [[-1.7, -8], [1.7, -8], [-1.7, -2.4], [1.7, -2.4]]) { g.add(at(slab(2.8, 2.2, 4.6, M.hull2, .25), x, 5.7, z)); g.add(at(hazBar(M, 2.86, .4, 4.66, .2), x, 6.4, z)); }
  /* Kran mit Greifer, schwenkt */
  const cr = new THREE.Group(); cr.add(at(cyl(.8, .8, .8, M.dark, 8), 0, 0, 0, HP)); cr.add(beam([0, .4, 0], [0, 2.4, 6], .45, M.hull2)); cr.add(beam([0, 2.4, 6], [0, .4, 7], .3, M.dark)); cr.add(at(hazBar(M, 1.2, .3, .6, .15), 0, .3, 7.1));
  cr.position.set(2.4, 6.8, -11); cr.userData.sway = { axis: 'y', amp: .5, speed: .35 }; g.add(cr);
  /* Portal und Bohrmotor */
  for (const s of [-1, 1]) { g.add(at(slab(1.2, 7.4, 1.6, M.hull2, .25), s * 4.0, 0, 6.2)); g.add(at(hazBar(M, 1.26, 7.4, .3, .3), s * 4.0, 0, 7.05)); }
  for (const y of [-1, 1]) g.add(at(slab(9.2, 1.2, 1.6, M.hull2, .25), 0, y * 3.7, 6.2));
  g.add(at(cyl(3.0, 2.8, 3.6, M.hull2, 8), 0, 0, 7.4, 0, 0, PI / 8));
  g.add(at(mesh(hazUV(new THREE.CylinderGeometry(2.85, 2.85, .6, 8, 1).rotateX(HP), .3), X.hazard), 0, 0, 9.0, 0, 0, PI / 8));
  /* Bohrkopf: facettierter Stahlkegel mit Zahnwendel */
  const drill = new THREE.Group();
  drill.add(loft([{ z: 0, pts: ngon(8, 2.7, 2.7) }, { z: 2.6, pts: ngon(8, 2.3, 2.3) }, { z: 6.2, pts: ngon(8, 1.0, 1.0) }, { z: 8.4, pts: ngon(8, .1, .1) }], X.steel, { uv: 1 / 8 }));
  /* zweigängige Wendel aus Schneidzähnen, dazu zwei Ringe Hartmetallzähne an der Basis */
  const rad = z => z < 2.6 ? 2.7 - z / 2.6 * .4 : z < 6.2 ? 2.3 - (z - 2.6) / 3.6 * 1.3 : Math.max(.1, 1.0 - (z - 6.2) / 2.2 * .9);
  for (let h = 0; h < 2; h++) for (let i = 0; i < 18; i++) { const t = i / 18, a = t * PI * 3.2 + h * PI, z = .5 + t * 7.0, rr = rad(z) + .12; const tooth = slab(.5, .55, 1.0, M.dark, .12, .6, .6); tooth.position.set(Math.cos(a) * rr, Math.sin(a) * rr, z); tooth.rotation.set(-.35 * Math.sin(a), .35 * Math.cos(a), a + HP); drill.add(tooth); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; const c = bar(.4, .5, .5, M.hull2); c.position.set(Math.cos(a) * 2.75, Math.sin(a) * 2.75, .15); c.rotation.z = a; drill.add(c); }
  drill.position.z = 9.3; drill.userData.spin = { axis: 'z', speed: 2.5 }; g.add(drill);
  /* Greifarme mit Fräsen */
  for (const s of [-1, 1]) {
    const A = [s * 3.8, -2.6, 3.5], B = [s * 6.0, -3.0, 8.4], C = [s * 4.6, -2.8, 12.6];
    g.add(at(slab(1.4, 1.4, 1.6, M.dark, .3), A[0], A[1], A[2]));
    g.add(beam(A, B, .8, M.hull2)); g.add(hazBeam(M, B, C, .65, .3));
    g.add(beam([A[0] - s * .4, A[1] + .6, A[2]], [B[0] - s * .4, B[1] + .6, B[2] - .6], .22, M.dark));
    g.add(at(slab(1.2, 1.2, 1.2, M.dark, .25), B[0], B[1], B[2]));
    const gr = new THREE.Group(); gr.add(cyl(.9, .9, 1.4, X.steel, 8)); for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; gr.add(at(bar(.3, .3, 1.2, M.dark), Math.cos(a) * .95, Math.sin(a) * .95, 0, 0, 0, a)); }
    gr.add(at(mesh(new THREE.ConeGeometry(.7, 1.4, 8).rotateX(HP), X.steel), 0, 0, 1.4)); gr.userData.spin = { axis: 'z', speed: -3 * s };
    gr.position.set(C[0], C[1], C[2] + .6); g.add(gr);
  }
  /* Schneidlaser oben vorn */
  const lz = new THREE.Group(); lz.add(at(slab(1.6, 1.2, 2.4, M.hull2, .25), 0, 0, 0)); lz.add(at(cyl(.4, .32, 2.4, M.dark, 8), 0, 0, 2.2)); lz.add(at(mesh(new THREE.CircleGeometry(.3, 8), X.lens, false), 0, 0, 3.41));
  const bg = new THREE.CylinderGeometry(.16, .05, 7, 8, 1, true); bg.translate(0, -3.5, 0); bg.rotateX(-HP); const bm = new THREE.Mesh(bg, X.beam); bm.position.z = 3.4; bm.userData.flame = true; bm.renderOrder = 3; lz.add(bm);
  lz.position.set(0, 3.7, 4.6); lz.rotation.x = .12; g.add(lz);
  /* Antrieb: zwei Fackeln */
  const PD = [[-17, 6.2, 6.2, 5.2, .7], [-12, 7.0, 7.0, 5.8, .8]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -12.6, .6, .08, X.hazard, .3));
  for (const s of [-1, 1]) { const e = torch(M, 1.2, 10); e.position.set(s * 1.7, 0, -17); g.add(e); }
  /* Arbeitslichter */
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(lamp(M, .25), sx * 4.0, sy * 3.9, 7.1));
  lights(M, g, [[0, 7.4, -4.5], [3.8, -3.1, -11.5], [-3.8, -3.1, -11.5]], .2, 1.3);
  nums(g, 'MCRN 0412', P, -4.5, 0, .7, .52);
  return g;
});

/* ICE HAULER – gepanzerter Frachter: Eisblöcke in Käfigsegmenten, Seitenpanzer mit Fugen, schwerer Antrieb */
reg('icehauler', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const PB = [[8.6, 7, 7, 6.4, .9, .2], [12.5, 6.4, 6.0, 5.8, .8, .1], [16, 3.4, 3.0, 3.0, .5, -.3]];
  g.add(H(PB, M.hull));
  g.add(at(slab(5.2, 1.6, 2.6, M.hull2, .3, .8, .8), 0, 1.2, 15.2, -.35));
  slitsBoth(M, g, PB, 12.0, 1.6, 4, .3, 1.5); g.add(at(bar(3.2, .3, .1, M.glass), 0, 2.1, 14.6));
  g.add(band(PB, 9.6, .5, .08, X.hazard, .25));
  /* Rückgrat */
  const tr = truss(M, 18.4, 1.6, 1.6, 6, M.dark, .2); g.add(tr);
  /* Eisblöcke 3 × 2 × 2 */
  for (const z of [-6, 0, 6]) for (const x of [-1.75, 1.75]) for (const y of [-1.75, 1.75]) g.add(at(slab(3.2, 3.2, 5.0, X.ice, .35), x, y, z));
  /* Käfig: Rahmen, Längsträger, Gitter oben */
  for (const z of [-9, -3, 3, 9]) { for (const s of [-1, 1]) { g.add(at(bar(.6, 7.8, .6, M.hull2), s * 3.6, 0, z)); g.add(at(bar(7.8, .6, .6, M.hull2), 0, s * 3.6, z)); } for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(hazBar(M, .9, .9, .7, .15), sx * 3.6, sy * 3.6, z)); }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.add(at(bar(.7, .7, 18.6, M.dark), sx * 3.6, sy * 3.6, 0));
  for (const z of [-6, 0, 6]) for (const dz of [-1.5, 1.5]) g.add(at(bar(7.2, .3, .35, M.dark), 0, 3.65, z + dz));
  /* Seitenpanzer und Bodenplatten je Segment */
  /* Seitenpanzer oben und unten, dazwischen ein Spalt, durch den das Eis leuchtet */
  for (const z of [-6, 0, 6]) { for (const s of [-1, 1]) { for (const y of [-2.15, 2.15]) g.add(at(slab(.7, 2.6, 5.0, M.hull2, .22), s * 4.05, y, z)); g.add(at(bar(.08, 2.0, .25, M.trim), s * 4.42, 2.15, z + 2.1)); } g.add(at(slab(6.4, .6, 5.0, M.hull2, .2), 0, -4.05, z)); }
  /* Antrieb */
  const PD = [[-16, 6, 6, 5.6, .9], [-12, 7.4, 7.4, 7, 1.0], [-9.2, 7.6, 7.6, 7.2, 1.0]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -11.4, .6, .08, X.hazard, .3));
  const e = torch(M, 1.9, 15); e.position.z = -16; g.add(e); struts(M, g, 1.9, -16, 4, 1.6);
  for (const s of [-1, 1]) { const d = torch(M, .7, 6); d.position.set(s * 2.7, -1.6, -15.6); g.add(d); }
  const fa = finArray(M, 3, 2.4, 3.6, 1.2); fa.position.set(0, 3.55, -13); g.add(fa);
  for (const z of [-9, 9]) lights(M, g, [[4.0, 4.0, z], [-4.0, 4.0, z]], .2, .8);
  nums(g, 'MCRN 1180', PB, 11.4, -.6, .62, .02);
  return g;
});

/* BOARDER – Enterschiff: gedrungener Truppenträger, Breschenkragen mit Glutring, vier Klammerarme */
reg('boarder', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-11, 7.0, 5.8, 5.8, .8], [2, 7.6, 6.2, 6.2, .85], [7.6, 6.8, 5.8, 5.8, .8]];
  g.add(H(P, M.hull));
  topPlates(M, g, P, -10.4, 6.4, 3, .45, 5.0, .5);
  g.add(at(bar(.6, .4, 15, M.dark), 0, 3.6, -2.2));
  /* Marine-Luken */
  for (const z of [-6.8, -1.6, 3.6]) { const q = side(P, z, 0); for (const s of [-1, 1]) { const h = new THREE.Group(); h.add(at(slab(.35, 3.0, 3.0, M.dark, .08), 0, 0, 0)); h.add(at(hazBar(M, .38, .34, 3.3, .18), 0, 1.65, 0)); h.add(at(hazBar(M, .38, .34, 3.3, .18), 0, -1.65, 0)); h.add(at(lamp(M, .12), .2, 1.1, 1.3)); h.position.set(s * (q.x + .1), 0, z); h.rotation.z = -s * q.a; g.add(h); } }
  /* Breschenkragen */
  g.add(at(cyl(3.0, 2.6, 5.8, M.hull2, 8), 0, 0, 10.4, 0, 0, PI / 8));
  g.add(at(mesh(hazUV(new THREE.CylinderGeometry(2.7, 2.75, .8, 8, 1).rotateX(HP), .3), X.hazard), 0, 0, 12.0, 0, 0, PI / 8));
  const ringM = mesh(new THREE.TorusGeometry(2.3, .32, 4, 8), X.hotRim, false); ringM.position.z = 13.35; ringM.rotation.z = PI / 8; g.add(ringM);
  g.add(at(mesh(new THREE.CircleGeometry(2.1, 8), M.dark, false), 0, 0, 13.31, 0, 0, PI / 8));
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + PI / 8; g.add(at(bar(.4, .4, .8, M.dark), Math.cos(a) * 2.55, Math.sin(a) * 2.55, 13.5)); }
  /* Klammerarme */
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * HP, cx = Math.cos(a), cy = Math.sin(a), A = [cx * 3.0, cy * 3.0, 8.4], B = [cx * 5.0, cy * 5.0, 12.4], C = [cx * 3.2, cy * 3.2, 16.6];
    g.add(at(slab(1.5, 1.5, 1.7, M.dark, .3), A[0], A[1], A[2]));
    g.add(beam(A, B, .85, M.hull2)); g.add(beam([A[0] * .8, A[1] * .8, A[2] + .4], [B[0] * .85, B[1] * .85, B[2] - .5], .26, M.dark));
    g.add(at(slab(1.1, 1.1, 1.1, M.dark, .2), B[0], B[1], B[2]));
    g.add(hazBeam(M, B, C, .7, .25));
    const claw = slab(.85, .85, 1.8, M.dark, .15, .3, .3); claw.position.set(C[0] - cx * .3, C[1] - cy * .3, C[2] + .5); aim(claw, [-cx * .8, -cy * .8, 1]); g.add(claw);
  }
  /* Autokanone, Antrieb */
  const c = cannon(M, .9, 2, 2.8, 6); c.position.set(0, topY(P, -7) + .5, -7); g.add(c);
  const PD = [[-15.5, 5.0, 5.0, 4.6, .7], [-11, 7.0, 5.8, 5.8, .8]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -13, .5, .06, X.hazard, .22));
  const e = torch(M, 1.7, 13); e.position.z = -15.5; g.add(e); struts(M, g, 1.7, -15.5, 4, 1.3);
  for (const s of [-1, 1]) { const f = finArray(M, 2, 2.4, 3.4, .9); f.position.set(s * 1.8, topY(PD, -13), -13); g.add(f); }
  numAt(g, 'MCRN 3352', side(P, 6.6, 1.9).x + .02, 1.9, 6.4, .5, side(P, 6.6, 1.9).a);
  lights(M, g, [[3.0, 3.0, 8.2], [-3.0, 3.0, 8.2], [3.0, -3.0, 8.2], [-3.0, -3.0, 8.2]], .2, 1.6);
  return g;
});

/* DROPSHIP – Marine-Träger: Rumpf mit Rampenbucht, je Seite sechs Enterkapseln auf Gestellen */
reg('dropship', M => {
  UV = 1 / 15; const g = new THREE.Group(), X = xm(M);
  const P = [[-17, 7.6, 6.4, 6.6, .9], [8, 8.0, 6.6, 6.8, .95], [15, 6.0, 5.2, 5.6, .8, -.2], [20.5, 3.6, 3.2, 3.0, .5, -.6]];
  g.add(H(P, M.hull));
  topPlates(M, g, P, -16, 7, 4, .45, 4.8, .5);
  g.add(at(slab(4.4, .7, 5, M.dark, .2), 0, -3.6, 6));
  /* Bugrampe: leuchtende Bucht, Brücke */
  g.add(at(bar(2.8, 1.8, .2, X.bay), 0, -.9, 20.1)); g.add(at(hazBar(M, 3.2, .3, .3, .15), 0, .2, 20.2));
  const ramp = slab(2.8, .25, 3.2, M.hull2, .08); ramp.position.set(0, -2.2, 21.3); ramp.rotation.x = .55; g.add(ramp); g.add(at(glowLine(M, 2.4, .05, .1), 0, -1.72, 20.4));
  for (const s of [-1, 1]) g.add(beam([s * 1.2, -1.7, 20.0], [s * 1.2, -2.9, 22.4], .14, M.dark));
  g.add(at(slab(4.2, .8, 4.2, M.hull2, .2, .8), 0, 2.6, 13.5, -.1)); g.add(at(bar(3.0, .35, .1, M.glass), 0, 2.6, 15.62));
  /* Enterkapsel: heller Rumpf, Stahl-Bohrspitze, Warnband, roter Streifen, Triebwerk */
  const pod = new THREE.Group();
  const PP = [[-3.4, 1.8, 1.8, 1.8, .4], [2.4, 2.0, 2.0, 2.0, .45], [3.2, 1.5, 1.5, 1.5, .35]];
  pod.add(H(PP, M.hull));
  pod.add(loft([{ z: 3.2, pts: ngon(8, .9, .9, PI / 8) }, { z: 5.0, pts: ngon(8, .1, .1, PI / 8) }], X.steel, { uv: 1 / 6 }));
  pod.add(band(PP, 1.3, .55, .05, X.hazard, .15));
  pod.add(band(PP, -2.2, .4, .05, M.dark));
  const pe = engine(M, .55, .6, 2, X.torchDisc); pe.position.z = -3.4; pod.add(pe);
  pod.add(at(bar(.14, .1, 2.8, M.trim), 0, 1.0, -.4));
  for (const s of [-1, 1]) {
    for (const y of [-1.7, 1.7]) {
      g.add(at(bar(.55, .55, 24, M.dark), s * 4.7, y, -1));
      for (const z of [9.5, 1.5, -6.5]) { const p = pod.clone(); p.position.set(s * 5.9, y, z); g.add(p); g.add(at(bar(1.8, .45, .7, M.hull2), s * 4.6, y, z)); }
    }
    g.add(at(slab(.7, 4.2, .7, M.hull2, .15), s * 4.7, 0, 11.4)); g.add(at(slab(.7, 4.2, .7, M.hull2, .15), s * 4.7, 0, -12.4));
  }
  /* Bewaffnung */
  pdcs(M, g, [[0, topY(P, 17) + .02, 17, 0]], .95, 3);
  const c = cannon(M, 1.0, 2, 2.8, 7); c.position.set(0, topY(P, -9) + .5, -9); g.add(c);
  /* Antrieb */
  const PD = [[-22, 6.4, 6.4, 6.0, .8], [-17, 7.6, 6.4, 6.6, .9]];
  g.add(H(PD, M.hull2)); g.add(band(PD, -19, .6, .08, X.hazard, .3));
  for (const s of [-1, 1]) { const e = torch(M, 1.5, 12); e.position.set(s * 1.8, 0, -22); g.add(e); }
  const fa = finArray(M, 3, 2.2, 3.6, 1.1); fa.position.set(0, topY(PD, -20), -20); g.add(fa);
  nums(g, 'MCRN 6024', P, 14, .6, .6, .02);
  lights(M, g, [[6, 2.8, 13.0], [-6, 2.8, 13.0], [6, -2.8, -10.2], [-6, -2.8, -10.2]], .2, 1.1);
  return g;
});

export default register;

export { xm, mm, tintS, bar, beam, truss, hazUV, hazBar, hazBeam, pdc, cannon, rail, radPanel, finArray, torch, lamp, glowLine, oct2, flat, dfont, mount, aim };
