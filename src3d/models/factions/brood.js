/* =====================================================================
   THE BROOD – lebende Bio-Schiffe. Formensprache: Schichten aus glänzendem Chitin (dunkles Violett) über
   nassem, geädertem Fleisch; segmentierte Leiber, Mandibeln und Kiefer vorn, Trauben säuregrüner Augen und
   Pusteln, Knochenstacheln und -grate, Tentakel und Flossen, die träge schwingen, Leiber, die atmen.
   Antrieb sind pulsierende Leuchtblasen und Flossen am Heck – keine Düsen, kein Metall.
   Teamfarbe läuft durch die leuchtenden Adern im Fleisch und in den Häuten.
   Bug +Z, oben +Y, Länge = data len.
   ===================================================================== */
import * as THREE from 'three';
import { register, mesh, rng, tube } from '../kit.js';

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), MIR = new THREE.Matrix4().makeScale(-1, 1, 1);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------ Texturen */
function cnv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, srgb) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
/* verzweigte Adern, nahtlos kachelbar (jede Strecke wird 9× versetzt gezeichnet) */
function veinCanvas(seed, n, w0, bg = '#000', fg = '255,255,255', pores = 0) {
  const r = rng(seed);
  return cnv(512, 512, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.lineCap = 'round';
    const seg = (x0, y0, x1, y1) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { x.beginPath(); x.moveTo(x0 + ox, y0 + oy); x.lineTo(x1 + ox, y1 + oy); x.stroke(); } };
    const vein = (px, py, a, wd, len, depth) => {
      for (let k = 0; k < len; k++) {
        const nx = px + Math.cos(a) * 11, ny = py + Math.sin(a) * 11;
        x.strokeStyle = `rgba(${fg},0.22)`; x.lineWidth = wd * 2.8; seg(px, py, nx, ny);
        x.strokeStyle = `rgba(${fg},0.95)`; x.lineWidth = wd; seg(px, py, nx, ny);
        px = nx; py = ny; a += (r() - 0.5) * 0.85; wd *= 0.95;
        if (depth < 2 && r() < 0.13) vein(px, py, a + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.7), wd * 0.75, len - k - 3, depth + 1);
        if (wd < 0.35) break;
      }
    };
    for (let i = 0; i < n; i++) vein(r() * w, r() * h, r() * TAU, w0 * (0.6 + r() * 0.8), 16 + (r() * 18 | 0), 0);
    for (let i = 0; i < pores; i++) { const cx = r() * w, cy = r() * h, rr = 2 + r() * 5, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr * 2.5); g.addColorStop(0, `rgba(${fg},0.9)`); g.addColorStop(1, `rgba(${fg},0)`); x.fillStyle = g; x.fillRect(cx - rr * 3, cy - rr * 3, rr * 6, rr * 6); }
  });
}

/* Graustufenmuster in sRGB-Farbe einfärben (kit.tint nimmt lineare Werte als Pixel – dadurch wird Chitin fast schwarz) */
function tintC(src, hex, contrast = 1, hi = null) {
  const h = parseInt(hex.slice(1), 16), c = [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  return cnv(src.width, src.height, (x) => {
    x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, src.width, src.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const l = Math.pow(p[i] / 180, contrast); for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, c[k] * l); }
    x.putImageData(d, 0, 0);
  });
}
/* ------------------------------------------------------------ Zusatzmaterialien (je Materialsatz einmal) */
/* Leuchtadern in Teamfarbe werden direkt in die Textur gemalt (Hintergrund = schwaches Durchscheinen des Fleisches) */
const XC = new WeakMap();
function X(M) {
  let x = XC.get(M); if (x) return x;
  const team = M.trim.emissive.clone(), tc = `${team.r * 255 | 0},${team.g * 255 | 0},${team.b * 255 | 0}`;
  const veins = ctex(veinCanvas(11, 11, 4.2, '#2a0614', tc, 14), true);
  const mveins = ctex(veinCanvas(17, 14, 3.4, '#2a0a30', tc, 0), true);
  const fine = ctex(veinCanvas(23, 16, 1.6, '#000', tc), true);
  const sacT = ctex(veinCanvas(5, 16, 3.6, '#d4d4d4', '30,30,30'), true);
  const oc = M.flesh.bumpMap.image; veins.repeat.set(0.55, 0.55); mveins.repeat.set(0.6, 0.6);
  const chit = M.chitin.clone(); chit.map = ctex(tintC(oc, '#56306a', 1.35), true); chit.vertexColors = true; chit.roughness = 0.2; chit.metalness = 0.25; chit.emissive = new THREE.Color('#ffffff'); chit.emissiveMap = fine; chit.emissiveIntensity = 0.3;
  const fmap = ctex(tintC(oc, '#b04a68', 1.1), true);
  x = {
    flesh: new THREE.MeshStandardMaterial({ map: fmap, bumpMap: M.flesh.bumpMap, bumpScale: 1.1, roughness: 0.3, metalness: 0.04, vertexColors: true, emissive: '#ffffff', emissiveMap: veins, emissiveIntensity: 0.85 }),
    chitin: chit,
    bone: (() => { const m = M.bone.clone(); m.vertexColors = true; m.roughness = 0.42; m.map = ctex(tintC(oc, '#e2d4bc', 0.6), true); return m; })(),
    gum: new THREE.MeshStandardMaterial({ map: M.flesh.map, bumpMap: M.flesh.bumpMap, bumpScale: 1, color: '#9a2038', roughness: 0.28, metalness: 0.05, vertexColors: true, emissive: '#4a0018', emissiveIntensity: 0.8, side: THREE.DoubleSide }),
    socket: new THREE.MeshStandardMaterial({ color: '#0c0410', roughness: 0.15, metalness: 0.5, vertexColors: true }),
    membrane: new THREE.MeshStandardMaterial({ color: '#6a2470', roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.84, side: THREE.DoubleSide, depthWrite: false, vertexColors: true, emissive: '#ffffff', emissiveMap: mveins, emissiveIntensity: 1 }),
    sac: new THREE.MeshStandardMaterial({ color: '#5cff2a', roughness: 0.18, metalness: 0, transparent: true, opacity: 0.9, emissive: new THREE.Color('#9cff3c'), emissiveMap: sacT, emissiveIntensity: 1.25 }),
    sacPink: new THREE.MeshStandardMaterial({ color: '#ff5aa8', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.92, emissive: new THREE.Color('#ff4aa0'), emissiveMap: sacT, emissiveIntensity: 1.1 }),
    acid: M.acid,
    glow: new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(2.2) }),
    crest: (() => { const m = chit.clone(); m.side = THREE.DoubleSide; m.emissiveMap = mveins; m.emissiveIntensity = 0.9; m.color = new THREE.Color(1.15, 1, 1.2); return m; })(),
    egg: new THREE.MeshStandardMaterial({ color: '#b8e890', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.9, emissive: new THREE.Color('#9cff3c'), emissiveMap: sacT, emissiveIntensity: 0.38 }),
    womb: new THREE.MeshStandardMaterial({ color: '#9a4a98', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, emissive: '#ffffff', emissiveMap: mveins, emissiveIntensity: 0.8 }),
    stomach: new THREE.MeshStandardMaterial({ color: '#8cff5a', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, emissive: new THREE.Color('#5cff2a'), emissiveMap: sacT, emissiveIntensity: 0.5 }),
    core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#b4ff3c').multiplyScalar(1.2), transparent: true, opacity: 0.5, depthWrite: false }),
    rock: new THREE.MeshStandardMaterial({ color: '#4c5468', roughness: 0.85, metalness: 0.2, flatShading: true }),
    ice: new THREE.MeshStandardMaterial({ color: '#c6ecff', roughness: 0.1, metalness: 0.1, flatShading: true, emissive: '#2a7ab0', emissiveIntensity: 0.6 }),
    drip: new THREE.MeshBasicMaterial({ color: new THREE.Color('#b4ff3c').multiplyScalar(1.7) })
  };
  XC.set(M, x); return x;
}

/* ------------------------------------------------------------ Geometrie-Bausteine */
function addColor(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) { const v = fn(p.getX(k), p.getY(k), p.getZ(k), k); if (typeof v === 'number') c[k * 3] = c[k * 3 + 1] = c[k * 3 + 2] = v; else { c[k * 3] = v[0]; c[k * 3 + 1] = v[1]; c[k * 3 + 2] = v[2]; } }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
/* Gitterflächen-Bauer: grid(nu, nv, fn) mit fn(u, v) → [x, y, z, farbe, uvU, uvV] */
class Geo {
  constructor() { this.p = []; this.c = []; this.u = []; this.i = []; this.seams = []; }
  grid(nu, nv, fn, o = {}) {
    const b = this.p.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const r = fn(i / nu, j / nv); this.p.push(r[0], r[1], r[2]);
      const c = r[3]; if (typeof c === 'number') this.c.push(c, c, c); else this.c.push(c[0], c[1], c[2]);
      this.u.push(r[4] || 0, r[5] || 0);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i, d = a + nu + 1; if (o.flip) this.i.push(a, a + 1, d, d, a + 1, d + 1); else this.i.push(a, d, a + 1, d, d + 1, a + 1); }
    if (o.wrap) for (let j = 0; j <= nv; j++) this.seams.push([b + j * (nu + 1), b + j * (nu + 1) + nu]);
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i); g.computeVertexNormals();
    const n = g.attributes.normal;
    for (const [a, b] of this.seams) { let x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z); }
    return g;
  }
}
/* Sammelbeutel: viele statische Teile je Material zu einem Mesh verschmelzen (wenige Draw Calls) */
class Bag {
  constructor() { this.m = new Map(); }
  add(geo, mat, mx, sym) { let l = this.m.get(mat); if (!l) this.m.set(mat, l = []); l.push([geo, mx]); if (sym) l.push([geo, MIR.clone().multiply(mx)]); return this; }
  flush(g) { for (const [mat, list] of this.m) g.add(mesh(merge(list), mat)); this.m.clear(); return g; }
}
function merge(list) {
  let nv = 0, ni = 0; for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3), I = new Uint32Array(ni);
  let ov = 0, oi = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g, mx] of list) {
    nm.getNormalMatrix(mx); const flip = mx.determinant() < 0, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color;
    for (let k = 0; k < p.count; k++) {
      const o = ov + k; v.fromBufferAttribute(p, k).applyMatrix4(mx); P[o * 3] = v.x; P[o * 3 + 1] = v.y; P[o * 3 + 2] = v.z;
      v.fromBufferAttribute(n, k).applyMatrix3(nm).normalize(); N[o * 3] = v.x; N[o * 3 + 1] = v.y; N[o * 3 + 2] = v.z;
      if (uv) { U[o * 2] = uv.getX(k); U[o * 2 + 1] = uv.getY(k); }
      if (c) { C[o * 3] = c.getX(k); C[o * 3 + 1] = c.getY(k); C[o * 3 + 2] = c.getZ(k); } else C[o * 3] = C[o * 3 + 1] = C[o * 3 + 2] = 1;
    }
    const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : p.count;
    for (let k = 0; k < cnt; k += 3) { const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, d = idx ? idx[k + 2] : k + 2; I[oi++] = ov + a; I[oi++] = ov + (flip ? d : b); I[oi++] = ov + (flip ? b : d); }
    ov += p.count;
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.BufferAttribute(N, 3)); o.setAttribute('uv', new THREE.BufferAttribute(U, 2)); o.setAttribute('color', new THREE.BufferAttribute(C, 3));
  o.setIndex(new THREE.BufferAttribute(I, 1)); o.computeBoundingSphere(); return o;
}
/* Matrix: Position, Richtung (lokal +Y), Biegerichtung (lokal +Z), Skalierung */
function place(pos, dir, bend, sx, sy = sx, sz = sx) {
  const Y = dir.clone().normalize(); let Z = (bend || V(0, 0, 1)).clone(); Z.sub(Y.clone().multiplyScalar(Z.dot(Y)));
  if (Z.lengthSq() < 1e-6) Z = Math.abs(Y.x) < 0.9 ? V(1, 0, 0).cross(Y) : V(0, 0, 1).cross(Y);
  Z.normalize(); const Xa = new THREE.Vector3().crossVectors(Y, Z);
  return new THREE.Matrix4().makeBasis(Xa, Y, Z).scale(V(sx, sy, sz)).setPosition(pos);
}
const T = (x, y, z, s = 1, sy = s, sz = s) => new THREE.Matrix4().makeScale(s, sy, sz).setPosition(x, y, z);

/* Geometrie-Cache (geteilt von allen Schiffen) */
const GC = {}; const cg = (k, f) => GC[k] || (GC[k] = f());
const coneG = () => cg('cone', () => { const g = new THREE.ConeGeometry(1, 1, 6, 2); g.translate(0, 0.5, 0); return addColor(g, (x, y) => lerp(0.45, 1.2, y)); });
/* gebogener Zahn/Kralle: Spitze nach +Y, Biegung nach +Z */
const fangG = () => cg('fang', () => { const g = new THREE.ConeGeometry(1, 1, 5, 3); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, p.getZ(k) + 0.45 * y * y); } g.computeVertexNormals(); return addColor(g, (x, y) => y < 0.15 ? [0.75, 0.42, 0.45] : lerp(0.85, 1.25, y)); });
const sphG = (w = 12, h = 8) => cg('s' + w + h, () => addColor(new THREE.SphereGeometry(1, w, h), () => 1));
const domeG = () => cg('dome', () => addColor(new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2), (x, y) => lerp(0.5, 1.1, y)));

/* ------------------------------------------------------------ Körperprofil */
/* keys: [[z, rx, ry, dy, dx], …] aufsteigend in z (Heck → Bug); glatte Hermite-Kurve. belly < 1 drückt den Bauch flach,
   dx biegt den Leib seitlich (Wurm). */
function prof(keys, belly = 1) {
  const K = keys.map(k => [k[0], k[1], k[2], k[3] || 0, k[4] || 0]), n = K.length;
  const tan = (k, c) => { const a = K[Math.max(0, k - 1)], b = K[Math.min(n - 1, k + 1)]; return (b[c] - a[c]) / ((b[0] - a[0]) || 1); };
  const f = z => {
    if (z <= K[0][0]) return { rx: K[0][1], ry: K[0][2], dy: K[0][3], dx: K[0][4] };
    if (z >= K[n - 1][0]) return { rx: K[n - 1][1], ry: K[n - 1][2], dy: K[n - 1][3], dx: K[n - 1][4] };
    let k = 0; while (K[k + 1][0] < z) k++;
    const A = K[k], B = K[k + 1], h = B[0] - A[0], t = (z - A[0]) / h, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const c = i => h00 * A[i] + h10 * h * tan(k, i) + h01 * B[i] + h11 * h * tan(k + 1, i);
    return { rx: Math.max(0, c(1)), ry: Math.max(0, c(2)), dy: c(3), dx: c(4) };
  };
  f.belly = belly; f.z0 = K[0][0]; f.z1 = K[n - 1][0]; f.rmax = Math.max(...K.map(k => Math.max(k[1], k[2]))); return f;
}
/* Ellipsoid als Profil (für Blasen, auf die Platten sollen) */
function ellP(cy, rx, ry, rz, cz, n = 9) { const k = []; for (let i = 0; i <= n; i++) { const a = Math.PI * (1 - i / n), z = cz + Math.cos(a) * rz, s = Math.sin(a); k.push([z, rx * s, ry * s, cy]); } return prof(k); }
/* Punkt auf der Profiloberfläche: Winkel a von oben (0) über rechts (π/2) nach unten (π), d = Abstand nach außen */
function onB(P, z, a, d = 0) { const s = P(z), ca = Math.cos(a); return V((s.rx + d) * Math.sin(a) + s.dx, (s.ry + d) * ca * (ca < 0 ? P.belly : 1) + s.dy, z); }
function nrm(P, z, a) { const s = P(z), ca = Math.cos(a); return V(Math.sin(a) / Math.max(0.05, s.rx), ca / Math.max(0.05, s.ry * (ca < 0 ? P.belly : 1)), 0).normalize(); }
const I0 = new THREE.Matrix4();

/* Fleischleib mit Segmentfurchen, sanften Beulen und eingebackener Verschattung */
function fleshGeo(P, o = {}) {
  const z0 = o.z0 ?? P.z0, z1 = o.z1 ?? P.z1, nu = o.nu || 22, nv = o.nv || 44, Ts = o.T || 10, segs = o.segs || [], gd = o.groove ?? 0.1, gw = o.gw ?? 0.5, nz = o.noise ?? 0.035;
  const r = rng(o.seed || 7), s1 = r() * 9, s2 = r() * 9, s3 = r() * 9, uRep = Math.max(1, Math.round(TAU * P.rmax / Ts)), tint = o.tint || [1, 1, 1];
  return new Geo().grid(nu, nv, (u, v) => {
    const z = z0 + (z1 - z0) * v, s = P(z), a = u * TAU, sa = Math.sin(a), ca = Math.cos(a);
    let g = 0; for (const q of segs) g += Math.exp(-(((z - q) / gw) ** 2));
    const k = 1 - gd * g + nz * (Math.sin(a * 3 + z * 0.9 + s1) * 0.6 + Math.sin(a * 5 - z * 1.7 + s2) * 0.4) * (0.5 + 0.5 * Math.sin(z * 0.6 + s3));
    const c = (0.5 + 0.5 * (ca * 0.5 + 0.5)) * (1 - 0.6 * Math.min(1, g));
    return [s.rx * sa * k + s.dx, s.ry * ca * k * (ca < 0 ? P.belly : 1) + s.dy, z, [c * tint[0], c * tint[1], c * tint[2]], u * uRep, z / Ts];
  }, { wrap: true });
}
function fleshB(B, M, P, o) { B.add(fleshGeo(P, o).build(), o.mat || X(M).flesh, I0); }

/* Schale (Panzerplatte, Kiefer): Ausschnitt um den Winkel c ± span zwischen zA (hinten) und zB (vorn).
   Außenseite in go, Innenseite in gi (Geo). Hinterkante gehoben (lift), Mitte mit Grat (ridge), hinten spitz (point).
   Liefert pin(rel, t, d) → Punkt auf der Außenseite (rel −1…1 quer, t 0 vorn … 1 hinten). */
function shell(P, zA, zB, o, go, gi) {
  const c0 = o.c ?? 0, span = o.span ?? 1.8, th = o.th ?? 0.4, gapK = o.gap ?? 0.05, lift = o.lift ?? 0, ridge = o.ridge ?? 0, point = o.point ?? 0, nu = o.nu ?? 14, nv = o.nv ?? 6, Ts = o.T ?? 10;
  const pf = o.prof || (t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.6))), 0.45)), lip = o.lip || [1.55, 1.1, 1.5], base = o.base ?? 1, inC = o.inC ?? 0.3;
  const pt = (rel, t, outer) => {
    const ca = Math.cos(rel * Math.PI / 2), a = c0 + rel * span, z = zB + (zA - point * ca * ca - zB) * t, s = P(z), pr = pf(t) * Math.pow(ca, 0.4);
    let off = gapK * (s.rx + s.ry) * 0.5 + lift * t * t * (0.35 + 0.65 * ca);
    if (outer) off += th * pr + ridge * Math.exp(-((rel / 0.15) ** 2)) * pf(t);
    const cb = Math.cos(a), x = (s.rx + off) * Math.sin(a) + s.dx, y = (s.ry + off) * cb * (cb < 0 ? P.belly : 1) + s.dy;
    let c;
    if (outer) { const e = base * (0.45 + 0.55 * Math.pow(ca, 0.5)), l = sm(0.5, 0.97, t) * Math.pow(ca, 0.7) + 0.6 * Math.exp(-((rel / 0.12) ** 2)) * pf(t) * (ridge > 0 ? 1 : 0); c = [e * (1 + (lip[0] - 1) * l), e * (1 + (lip[1] - 1) * l), e * (1 + (lip[2] - 1) * l)]; }
    else c = inC;
    return [x, y, z, c, rel * span * P.rmax / Ts, z / Ts];
  };
  go.grid(nu, nv, (u, v) => pt(u * 2 - 1, v, true), { flip: true });
  if (gi) gi.grid(o.inRes ? nu : Math.ceil(nu / 2), o.inRes ? nv : Math.max(2, nv >> 1), (u, v) => pt(u * 2 - 1, v, false));
  const pin = (rel, t, d = 0) => { const r = pt(rel, t, true); return V(r[0], r[1], r[2]).addScaledVector(nrm(P, r[2], c0 + rel * span), d); };
  pin.n = (rel, t) => nrm(P, pt(rel, t, true)[2], c0 + rel * span);
  return pin;
}
/* Plattenreihe: n Schuppen von z1 (vorn) nach z0 (hinten), überlappend wie Dachziegel. Liefert die pins. */
function plates(P, z0, z1, n, o, go, each) {
  const L = (z1 - z0) / n, ov = o.ov ?? 0.4, pins = [];
  for (let i = 0; i < n; i++) { const zB = z1 - i * L, zA = zB - L * (1 + ov); pins.push(shell(P, zA, zB, Object.assign({}, o, each ? each(i, n) : {}), go, go)); }
  return pins;
}
/* Plattenreihe direkt in den Beutel (Chitin) */
function armor(B, M, P, z0, z1, n, o, each) { const go = new Geo(), pins = plates(P, z0, z1, n, o, go, each); B.add(go.build(), o.mat || X(M).chitin, I0); return pins; }
function cap(B, M, P, zA, zB, o) { const go = new Geo(), pin = shell(P, zA, zB, o, go, go); B.add(go.build(), o.mat || X(M).chitin, I0); return pin; }
/* Leuchtporen auf Platten (Biolumineszenz): je Platte bei rel-Werten */
function pores(B, M, pins, rels, t, r, mat) {
  const q = rng(pins.length * 31 + rels.length * 7 + Math.round(t * 100));
  for (const pin of pins) for (const r0 of rels) { const n = q() < 0.35 ? 2 : 1; for (let k = 0; k < n; k++) { const s = r * (k ? 0.55 : 0.7 + q() * 0.6), p = pin(r0 + (q() - 0.5) * 0.2 + k * 0.08, t + (q() - 0.5) * 0.25 + k * 0.12, -s * 0.3); B.add(sphG(7, 5), mat || X(M).glow, T(p.x, p.y, p.z, s)); } }
}

/* ------------------------------------------------------------ Organische Teile */
/* Röhre (kit.tube) mit Farbverlauf entlang der Länge (für vertexColors-Materialien) */
function tubeC(pts, r0, r1, mat, seg = 12, rad = 6, wob = 0, c0 = 0.5, c1 = 1.15) {
  const m = tube(pts, r0, r1, mat, seg, rad, wob), n = m.geometry.attributes.position.count, col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const t = Math.floor(k / (rad + 1)) / seg; for (let q = 0; q < 3; q++) col[k * 3 + q] = lerp(typeof c0 === 'number' ? c0 : c0[q], typeof c1 === 'number' ? c1 : c1[q], t); }
  m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); return m;
}
/* Röhre mit frei geformtem Radius rf(v) entlang einer Kurve (Hörner, Schlote, Werfer), Farbverlauf c0 → c1 */
const arr3 = c => typeof c === 'number' ? [c, c, c] : c;
function sweep(pts, rf, nu = 8, nv = 14, c0 = 0.6, c1 = 1.15, Ts = 4, inward = false) {
  const c = new THREE.CatmullRomCurve3(pts.map(v3)), fr = c.computeFrenetFrames(nv, false), L = c.getLength(), A = arr3(c0), C = arr3(c1);
  return new Geo().grid(nu, nv, (u, v) => {
    const j = Math.round(v * nv), p = c.getPointAt(Math.min(1, v)), N = fr.normals[j], Bn = fr.binormals[j], a = u * TAU, r = rf(v, a), ca = Math.cos(a), sa = Math.sin(a);
    return [p.x + (ca * N.x + sa * Bn.x) * r, p.y + (ca * N.y + sa * Bn.y) * r, p.z + (ca * N.z + sa * Bn.z) * r, [lerp(A[0], C[0], v), lerp(A[1], C[1], v), lerp(A[2], C[2], v)], u * 2, v * L / Ts];
  }, { wrap: true, flip: !inward });
}
/* Horn / Rippe / Knochenbogen in den Beutel: Radius r0 → r0·r1, dicker Ansatz */
function horn(B, M, pts, r0, r1 = 0.04, o = {}) { B.add(sweep(pts, v => r0 * lerp(1, r1, Math.pow(v, o.pw ?? 0.85)) * (1 + (o.wob ?? 0) * Math.sin(v * 40)), o.rad ?? 7, o.seg ?? 12, o.c0 ?? [0.55, 0.42, 0.45], o.c1 ?? 1.2).build(), o.mat || X(M).bone, I0, o.sym ?? true); }
/* leuchtende Kiemenschlitze an den Flanken */
function gills(B, M, P, zs, a0, a1, r) { for (const z of zs) for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 6; i++) { const a = s * lerp(a0, a1, i / 6), p = onB(P, z - i * 0.12, a, 0.05); pts.push([p.x, p.y, p.z]); } B.add(tube(pts, r, r, X(M).glow, 8, 5).geometry, X(M).glow, I0); } }
/* Bogen um eine Ellipse (cx, cy) in der Ebene z: a von −a0 bis a0 (0 = oben) */
function arc(cx, cy, z, rx, ry, a0, n = 8, dz = 0) { const p = []; for (let i = 0; i <= n; i++) { const a = -a0 + 2 * a0 * i / n; p.push([cx + Math.sin(a) * rx, cy + Math.cos(a) * ry, z + dz * Math.cos(a)]); } return p; }
/* Pivot-Gruppen für Animation */
function pulseG(child, amp, speed, base = 1) { const p = new THREE.Group(); p.add(child); p.userData.pulse = { amp, speed, base }; return p; }
/* gespiegelte Kopie; Schwingen um y/z wird mitgespiegelt */
function mir(o) {
  const c = o.clone(true); c.position.x = -c.position.x; c.scale.x *= -1; c.rotation.y = -c.rotation.y; c.rotation.z = -c.rotation.z;
  const s = c.userData.sway; if (s && s.axis !== 'x') c.userData.sway = Object.assign({}, s, { base: -s.base, amp: -s.amp });
  return c;
}
function pair(g, o) { g.add(o); g.add(mir(o)); return o; }
const rel = (p, pts) => pts.map(q => [q[0] - p.x, q[1] - p.y, q[2] - p.z]);
const v3 = a => V(a[0], a[1], a[2]);

/* Leuchtblase (Säuredrüse, Antriebsblase): Ellipsoid in Pulsgruppe */
function sac(mat, r, sx = 1, sy = 1, sz = 1, amp = 0.06, speed = 2.2, res = 16) { const m = mesh(sphG(res, Math.max(6, res * 0.7 | 0)), mat); m.scale.set(r * sx, r * sy, r * sz); return pulseG(m, amp, speed); }
function sacAt(g, mat, p, r, s = [1, 1, 1], amp, speed, res) { const q = sac(mat, r, s[0], s[1], s[2], amp, speed, res); q.position.copy(p); g.add(q); return q; }
/* Augen: leuchtende Kugel in dunkler Höhle; im Beutel gesammelt */
function eye(B, M, pos, n, r, lo, sym = true) { const G = lo ? sphG(7, 5) : sphG(9, 6); if (!lo) B.add(G, X(M).socket, T(pos.x - n.x * r * 0.55, pos.y - n.y * r * 0.55, pos.z - n.z * r * 0.55, r * 1.25), sym); B.add(G, M.acid, T(pos.x, pos.y, pos.z, r), sym); }
function eyeCluster(B, M, P, z, a, n, r, seed = 1, spread = 1, lo) {
  const q = rng(seed);
  for (let i = 0; i < n; i++) { const zz = z + (q() - 0.5) * spread * r * 4, aa = a + (q() - 0.5) * spread * r * 3 / Math.max(1, P(z).rx), rr = r * (0.6 + q() * 0.6); eye(B, M, onB(P, zz, aa, -rr * 0.25), nrm(P, zz, aa), rr, lo); }
}
/* Stachel (gerade) / Zahn (gebogen) in den Beutel */
function spike(B, M, pos, dir, len, r, sym = true, mat) { B.add(coneG(), mat || X(M).bone, place(pos, dir, null, r, len, r), sym); }
function fang(B, M, pos, dir, bend, len, r, sym = true) { B.add(fangG(), X(M).bone, place(pos, dir, bend, r, len, r), sym); }
function drip(B, M, p, r) { B.add(sphG(7, 5), X(M).drip, T(p.x, p.y - r * 0.8, p.z, r, r * 2.2, r)); B.add(sphG(7, 5), X(M).drip, T(p.x, p.y - r * 3.6, p.z, r * 0.6)); }
/* Maul vorn: Schlund-Trichter, Lippenwulst, Zahnkranz (1–2 Reihen), leuchtender Rachen */
function maw(M, rx, ry, depth, o = {}) {
  const x = X(M), g = new THREE.Group(), B = new Bag(), n = o.teeth ?? 10, q = rng(o.seed || 5);
  const lp = []; for (let i = 0; i <= 10; i++) { const t = i / 10; lp.push(new THREE.Vector2(Math.max(0.05, (1 - t * 0.85) * (1 + 0.07 * Math.sin(t * 26))), -t * depth)); }
  const lg = new THREE.LatheGeometry(lp, 18); lg.rotateX(Math.PI / 2); addColor(lg, (a, b, z) => lerp(0.9, 0.15, -z / depth));
  B.add(lg, x.gum, T(0, 0, 0, rx, ry, 1));
  if (o.lip !== 0) { const lip = new THREE.TorusGeometry(1, o.lip ?? 0.14, 8, 26); addColor(lip, () => [0.9, 0.7, 0.75]); B.add(lip, x.gum, T(0, 0, 0, rx, ry, 1.2)); }
  for (let row = 0; row < (o.rows ?? 1); row++) for (let i = 0; i < n; i++) {
    const a = (i + row * 0.5) / n * TAU, k = 1 - row * 0.22, ca = Math.cos(a), sa = Math.sin(a), len = (o.tl ?? 0.45) * Math.min(rx, ry) * (0.7 + q() * 0.6) * (1 - row * 0.25);
    const pos = V(ca * rx * k * 0.95, sa * ry * k * 0.95, -row * depth * 0.22), dir = V(-ca * (o.inward ?? 0.9), -sa * (o.inward ?? 0.9), 1);
    fang(B, M, pos, dir, V(-ca, -sa, 0), len, len * 0.22, false);
  }
  B.flush(g);
  const r0 = Math.min(rx, ry) * (o.glow ?? 0.32), gl = mesh(sphG(), x.acid, false); gl.scale.setScalar(r0); gl.position.z = -depth * 0.8; gl.userData.pulse = { amp: 0.25, speed: 3, base: r0 }; g.add(gl);
  return g;
}
/* Kiefer: Schale mit Zahnreihe am Rand. c = π Unterkiefer (Zähne nach oben), c = 0 Oberkiefer (Zähne nach unten). Innen Zahnfleisch. */
function jaw(M, Pj, zA, zB, o = {}) {
  const x = X(M), g = new THREE.Group(), go = new Geo(), gi = new Geo(), B = new Bag(), c0 = o.c ?? Math.PI, up = c0 > 1 ? 1 : -1, q = rng(o.seed || 9);
  const pin = shell(Pj, zA, zB, Object.assign({ c: c0, span: 1.5, th: 0.5, gap: 0, lift: 0, nu: 20, nv: 10, inRes: true, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * (0.04 + 0.96 * t))), 0.3), lip: [1.3, 1.1, 1.3] }, o), go, gi);
  B.add(go.build(), o.mat || x.chitin, I0); B.add(gi.build(), x.gum, I0);
  const n = o.teeth ?? 8, tl = o.tl ?? 1;
  for (let i = 0; i < n; i++) {
    const t = lerp(o.t0 ?? 0.08, o.t1 ?? 0.8, i / Math.max(1, n - 1)), p = pin(1, t), len = tl * (1 - 0.45 * t) * (0.75 + q() * 0.5);
    fang(B, M, p, V(-Math.sign(p.x) * 0.3, up, 0.25), V(-Math.sign(p.x), 0, 0.3), len, len * 0.24);
  }
  for (let i = 0; i < (o.front ?? 0); i++) { const rr = -0.85 + 1.7 * i / Math.max(1, o.front - 1), p = pin(rr, 0.04), len = tl * (0.8 + q() * 0.4) * (o.frontK ?? 1); fang(B, M, p, V(0, up * 0.9, 0.8), V(0, 0, -1), len, len * 0.22, false); }
  B.flush(g); g.userData.pin = pin; return g;
}
/* Mandibel: gebogene Zange aus Röhre mit Sägezähnen innen; schwingt um y (zwicken) */
function mandible(M, root, pts, r0, o = {}) {
  const x = X(M), j = new THREE.Group(); j.position.copy(root);
  const P = rel(root, pts); j.add(tubeC(P, r0, r0 * 0.06, o.mat || x.chitin, o.seg ?? 16, o.rad ?? 8, 0, 0.55, o.tipC ?? [1.7, 1.35, 1.6]));
  if (o.teeth) { const B = new Bag(), c = new THREE.CatmullRomCurve3(P.map(v3)); for (let i = 1; i <= o.teeth; i++) { const t = 0.15 + i / (o.teeth + 1) * 0.7, p = c.getPointAt(t), tg = c.getTangentAt(t); const d = V(-Math.sign(root.x || 1), 0, 0).add(tg.clone().multiplyScalar(0.5)); fang(B, M, p, d, tg, r0 * (1.1 - t * 0.5), r0 * 0.3, false); } B.flush(j); }
  j.userData.sway = { axis: 'y', amp: o.amp ?? 0.12, speed: o.speed ?? 2.4, phase: o.phase ?? 0, base: 0 };
  return j;
}
/* Tentakel / Schwanz, schwingt */
function tentacle(M, root, pts, r0, o = {}) {
  const j = new THREE.Group(); j.position.copy(root);
  j.add(tubeC(rel(root, pts), r0, r0 * (o.r1 ?? 0.08), o.mat || X(M).flesh, o.seg ?? 16, o.rad ?? 8, o.wob ?? 0.12, o.c0 ?? 0.6, o.c1 ?? 1.1));
  if (o.tip) { const e = pts[pts.length - 1], m = mesh(sphG(8, 6), o.tip, false); m.position.set(e[0] - root.x, e[1] - root.y, e[2] - root.z); m.userData.pulse = { amp: 0.2, speed: 3, base: o.tipR ?? r0 * 0.8 }; j.add(m); }
  j.userData.sway = { axis: o.axis || 'y', amp: o.amp ?? 0.2, speed: o.speed ?? 1.4, phase: o.phase ?? 0, base: 0 };
  return j;
}
/* Haut zwischen Knochenstreben (Flügel, Flossen, Kragen). struts: Punktlisten ab gemeinsamer Wurzel; Gruppe sitzt an der Wurzel */
function membrane(M, struts, o = {}) {
  const x = X(M), root = v3(struts[0][0]), g = new THREE.Group(), B = new Bag(), Gm = new Geo(), loc = struts.map(s => rel(root, s)), cs = loc.map(s => new THREE.CatmullRomCurve3(s.map(v3)));
  g.position.copy(root);
  const r = o.r ?? 0.3; for (const s of loc) B.add(tubeC(s, r, r * 0.15, x.bone, o.seg ?? 12, o.rad ?? 6, 0, 0.6, 1.2).geometry, x.bone, I0);
  const sag = o.sag ?? 0.28, nv = o.nv ?? 10, O = V(0, 0, 0);
  for (let i = 0; i < cs.length - 1; i++) { const A = cs[i], C = cs[i + 1]; Gm.grid(o.nu ?? 6, nv, (u, v) => { const p = A.getPointAt(v).lerp(C.getPointAt(v), u); p.lerp(O, Math.sin(Math.PI * u) * v * v * sag); return [p.x, p.y, p.z, lerp(0.7, 1.3, v) * (1 - 0.3 * Math.sin(Math.PI * u) * v), u + i, v * 2]; }); }
  B.flush(g); const mm = mesh(Gm.build(), o.mat || x.membrane, false); mm.renderOrder = 3; g.add(mm);
  if (o.tips) for (const s of loc) { const e = s[s.length - 1], m = mesh(sphG(7, 5), o.tips, false); m.position.set(...e); m.scale.setScalar(o.tipR ?? r * 1.4); g.add(m); }
  if (o.sway) g.userData.sway = Object.assign({ phase: 0, base: 0 }, o.sway);
  return g;
}
/* Speirohr: Trompete mit Muskelringen, Zahnkranz und leuchtendem Schlund, Öffnung nach +Z */
function spitTube(M, r, len, o = {}) {
  const x = X(M), g = new THREE.Group(), B = new Bag(), pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(r * (0.95 - 0.4 * Math.sin(Math.PI * t * 0.85) + 0.8 * Math.pow(t, 4)) * (1 + 0.05 * Math.sin(t * 40)), t * len)); }
  pts.push(new THREE.Vector2(r * 1.5, len + r * 0.12), new THREE.Vector2(r * 1.2, len * 0.97));
  const lg = new THREE.LatheGeometry(pts, 14); lg.rotateX(Math.PI / 2); addColor(lg, (a, b, z) => lerp(0.6, 1.25, z / len)); B.add(lg, o.mat || x.chitin, I0);
  const ip = pts.slice(6).map(v => new THREE.Vector2(v.x * 0.86, v.y)).reverse(), il = new THREE.LatheGeometry(ip, 14); il.rotateX(Math.PI / 2); addColor(il, (a, b, z) => lerp(0.2, 0.9, (z / len - 0.4) / 0.6)); B.add(il, x.gum, I0);
  const d = new THREE.CircleGeometry(r * 0.75, 14); addColor(d, () => 1); B.add(d, x.acid, T(0, 0, len * 0.55));
  const tor = new THREE.TorusGeometry(1, 0.13, 6, 16); addColor(tor, () => [0.9, 0.75, 0.9]);
  for (const t of [0.22, 0.44, 0.64]) { const rr = r * (0.95 - 0.4 * Math.sin(Math.PI * t * 0.85) + 0.8 * Math.pow(t, 4)); B.add(tor, x.chitin, T(0, 0, t * len, rr * 1.04, rr * 1.04, rr * 1.2)); }
  for (let i = 0; i < (o.teeth ?? 7); i++) { const a = i / (o.teeth ?? 7) * TAU, ca = Math.cos(a), sa = Math.sin(a); fang(B, M, V(ca * r * 1.35, sa * r * 1.35, len), V(-ca * 0.5, -sa * 0.5, 1), V(-ca, -sa, 0), r * 0.55, r * 0.14, false); }
  B.flush(g); return g;
}
/* Sporenschlot: gekrümmte, geriffelte Röhre (wie ein Röhrenwurm) mit leuchtendem Schlund und aufsteigenden Sporen (bob) */
function vent(M, h, r, lean = 1, seed = 1) {
  const x = X(M), g = new THREE.Group(), B = new Bag(), q = rng(seed);
  const pts = [[0, -0.6, 0], [0, h * 0.45, -lean * 0.25], [0, h * 0.8, -lean * 0.7], [0, h, -lean]];
  const rf = v => r * (1.9 - 1.25 * Math.pow(v, 0.6) + 0.85 * Math.pow(v, 6)) * (1 + 0.08 * Math.sin(v * 34 + seed));
  B.add(sweep(pts, rf, 10, 16, 0.45, [1.55, 1.2, 1.55], 3).build(), x.chitin, I0);
  B.add(sweep(pts.slice(1), v => rf(0.4 + v * 0.6) * 0.84, 8, 6, 0.15, 0.7, 3, true).build(), x.gum, I0);
  const c = new THREE.CatmullRomCurve3(pts.map(v3)), e = c.getPointAt(1), tg = c.getTangentAt(1);
  const d = new THREE.CircleGeometry(1, 12); d.rotateX(-Math.PI / 2); addColor(d, () => 1);
  B.add(d, x.glow, place(e.clone().addScaledVector(tg, -0.6 * r), tg, null, rf(0.9) * 0.8, 1, rf(0.9) * 0.8));
  const ax = new THREE.Vector3().crossVectors(tg, V(1, 0, 0)).normalize(), ay = new THREE.Vector3().crossVectors(ax, tg).normalize();
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + seed, rd = ax.clone().multiplyScalar(Math.cos(a)).addScaledVector(ay, Math.sin(a)), p = e.clone().addScaledVector(rd, rf(1) * 0.95); fang(B, M, p, rd.clone().multiplyScalar(0.9).addScaledVector(tg, 0.7), rd.clone().negate(), r * 1.1, r * 0.3, false); }
  B.flush(g);
  for (let k = 0; k < 3; k++) { const s = mesh(sphG(7, 5), x.acid, false); s.scale.setScalar(r * (0.34 - k * 0.07)); const p = e.clone().addScaledVector(tg, r * (1.0 + k * 1.4)); s.position.set(p.x + (q() - 0.5) * r, p.y, p.z + (q() - 0.5) * r); s.userData.bob = { amp: r * 0.5, speed: 1.3 + k * 0.5 + q(), y0: p.y }; g.add(s); }
  return g;
}
/* Parasitenwerfer: gebogene Muskelröhre, dicker Ansatz, Muskelwülste, Chitinbänder, ausgestülpte Mündung mit Kapsel */
function launcher(M, len, R, seed = 1) {
  const x = X(M), g = new THREE.Group(), B = new Bag();
  const pts = [[0, -0.6, -0.5], [0, 0.6, len * 0.35], [0, 1.9, len * 0.68], [0, 3.6, len]];
  const rf = v => R * (lerp(2.0, 0.62, sm(0, 0.62, v)) + 0.8 * sm(0.72, 1, v)) * (1 + 0.16 * Math.pow(Math.max(0, Math.sin(v * Math.PI * 8 + 0.6)), 3));
  B.add(sweep(pts, rf, 14, 30, [0.7, 0.6, 0.65], 1.1, 5).build(), x.flesh, I0);
  const c = new THREE.CatmullRomCurve3(pts.map(v3)), tor = new THREE.TorusGeometry(1, 0.2, 6, 16); tor.rotateX(Math.PI / 2); addColor(tor, () => [1.4, 1.1, 1.4]);
  for (const v of [0.18, 0.4, 0.62, 0.84]) { const p = c.getPointAt(v), tg = c.getTangentAt(v); B.add(tor, x.chitin, place(p, tg, null, rf(v) * 1.08, rf(v) * 1.4, rf(v) * 1.08)); spike(B, M, p.clone().add(V(0, rf(v) * 1.05, 0)), V(0, 1, -0.7), R * 0.9, R * 0.2, false); }
  const e = c.getPointAt(1), tg = c.getTangentAt(1);
  B.flush(g);
  const m = maw(M, rf(1) * 0.92, rf(1) * 0.92, 2.4, { teeth: 9, tl: 0.5, glow: 0.01, seed }); m.position.copy(e); m.quaternion.setFromUnitVectors(V(0, 0, 1), tg); g.add(m);
  const pd = sac(x.sac, R * 0.62, 1, 1, 1.4, 0.14, 3 + seed, 12); pd.position.copy(e.clone().addScaledVector(tg, -1.1)); g.add(pd);
  return g;
}
/* Parasitenkapsel im Fleischkelch, Öffnung nach +Y */
function pod(M, r, seed = 1) {
  const x = X(M), g = new THREE.Group(), B = new Bag(), q = rng(seed);
  const cp = [[0.01, -0.3], [0.7, -0.25], [1.1, 0.25], [1.15, 0.7], [0.95, 0.85], [0.8, 0.6]].map(([a, b]) => new THREE.Vector2(a * r, b * r));
  const lg = new THREE.LatheGeometry(cp, 10); addColor(lg, (a, y) => lerp(0.55, 1.3, (y / r + 0.3) / 1.2)); B.add(lg, x.chitin, I0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + q(), ca = Math.cos(a), sa = Math.sin(a); fang(B, M, V(ca * r * 1.0, r * 0.8, sa * r * 1.0), V(ca * 0.2, 1, sa * 0.2), V(-ca, 0, -sa), r * 0.9, r * 0.16, false); }
  B.flush(g);
  const s = sac(x.sac, r * 0.8, 1, 1.45, 1, 0.1, 2 + q() * 2, 12); s.position.y = r * 0.95; g.add(s);
  return g;
}
/* auf Fläche ausrichten: +Y der Gruppe zeigt entlang n */
function stand(o, p, n) { o.position.copy(p); o.quaternion.setFromUnitVectors(UP, n.clone().normalize()); return o; }

/* ===================================================================== LARVA */
/* fette, gekrümmte Made: weiches Fleisch, schmale Rückenschuppen mit Leuchtporen, Ringmaul, Zangen, Fühler, Schwanzblase */
register('larva', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-10, 0, 0, -2.6], [-9.7, 0.9, 0.8, -2.4], [-8.7, 1.9, 1.7, -1.7], [-6.5, 2.9, 2.6, -0.8], [-3.5, 3.6, 3.2, -0.2], [0, 3.9, 3.4, 0], [3.4, 3.6, 3.1, 0.1], [5.4, 2.8, 2.55, 0.2], [6.2, 2.45, 2.25, 0.25], [7.4, 2.7, 2.4, 0.3], [8.6, 2.3, 2.0, 0.25], [9.3, 1.55, 1.4, 0.15]], 0.8);
  fleshB(B, M, P, { segs: [-7.7, -5.4, -3.1, -0.8, 1.6, 4.0, 6.1], groove: 0.13, gw: 0.45, nv: 48, T: 7 });
  const pl = armor(B, M, P, -8, 5.6, 5, { span: 1.3, th: 0.36, lift: 0.38, ridge: 0.22, point: 0.9, T: 7 });
  const hp = cap(B, M, P, 6.0, 9.2, { span: 1.0, th: 0.34, lift: 0.2, ridge: 0.28, point: 0.8, T: 7 });
  pores(B, M, pl, [-0.55, 0.55], 0.55, 0.2);
  for (let i = 0; i < 4; i++) spike(B, M, pl[i + 1](0, 0.15, -0.1), V(0, 1, -0.9), 1.5 - i * 0.15, 0.28, false);
  spike(B, M, hp(0, 0.4, -0.1), V(0, 1, -0.7), 1.1, 0.24, false);
  for (let i = 0; i < 4; i++) { const z = 4.2 - i * 2.72; spike(B, M, onB(P, z, 1.3, 0.4), V(1, 0.3, -0.7), 1.0, 0.2); }
  eyeCluster(B, M, P, 7.9, 1.2, 3, 0.36, 3, 0.8);
  eye(B, M, onB(P, 8.6, 0.55, -0.05), nrm(P, 8.6, 0.55), 0.3);
  B.flush(g);
  for (const z of [-4.5, -1.5, 1.5]) { const p = onB(P, z, 2.35, -0.2); pair(g, tentacle(M, p, [[p.x, p.y, p.z], [p.x + 0.8, p.y - 0.9, p.z - 0.4], [p.x + 0.9, p.y - 1.6, p.z - 1.1]], 0.5, { axis: 'x', amp: 0.25, speed: 3, phase: z, wob: 0.2, seg: 6, rad: 6 })); }
  const m = maw(M, 1.45, 1.3, 2.2, { teeth: 9, tl: 0.6 }); m.position.set(0, 0.15, 9.3); g.add(m);
  pair(g, mandible(M, V(1.2, -0.3, 8.3), [[1.2, -0.3, 8.3], [2.6, -0.4, 9.4], [2.5, -0.5, 11.0], [1.0, -0.6, 11.8]], 0.6, { teeth: 3, seg: 12, rad: 7 }));
  pair(g, tentacle(M, V(0.9, 1.6, 8.3), [[0.9, 1.6, 8.3], [1.8, 2.6, 9.4], [3.0, 3.0, 10.2], [4.0, 2.7, 10.6]], 0.16, { mat: x.chitin, wob: 0, r1: 0.25, amp: 0.25, speed: 1.8, axis: 'z', c1: [1.5, 1.2, 1.5], seg: 10, rad: 5 }));
  sacAt(g, x.sacPink, V(0, -2.2, -9.7), 0.9, [1, 0.9, 1.3], 0.12, 3);
  return g;
});

/* ===================================================================== SWARMLING-SCHWARM */
/* Winzling: Pfeilleib, Schuppen, zwei Flughäute (flattern), Zangen, Stachelschwanz */
function swarmling(M) {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-3.4, 0, 0, 0.4], [-3.0, 0.4, 0.35, 0.35], [-1.8, 0.9, 0.75, 0.15], [0, 1.15, 0.9, 0], [1.4, 1.0, 0.8, 0], [2.0, 0.72, 0.62, 0.05], [2.7, 0.85, 0.7, 0.05], [3.4, 0.55, 0.48, 0], [3.7, 0, 0, -0.05]], 0.8);
  fleshB(B, M, P, { nu: 12, nv: 18, segs: [-1.7, -0.5, 0.7, 2.0], groove: 0.12, gw: 0.25, T: 4, noise: 0.02 });
  const pl = armor(B, M, P, -2.8, 1.9, 3, { span: 1.4, th: 0.16, lift: 0.18, ridge: 0.16, point: 0.55, nu: 10, nv: 4, T: 4 });
  cap(B, M, P, 1.9, 3.55, { span: 1.2, th: 0.15, ridge: 0.2, point: 0.45, lift: 0.08, nu: 10, nv: 4, T: 4 });
  for (const pin of pl) spike(B, M, pin(0, 0.2, -0.05), V(0, 1, -1), 0.6, 0.11, false);
  eye(B, M, onB(P, 3.0, 0.95, -0.05), nrm(P, 3.0, 0.95), 0.22, true); eye(B, M, onB(P, 2.55, 1.35, -0.05), nrm(P, 2.55, 1.35), 0.16, true);
  horn(B, M, [[0, 0.3, -3.1], [0, 0.6, -4.0], [0, 1.3, -4.7]], 0.22, 0.1, { seg: 6, rad: 5, sym: false });
  B.flush(g);
  pair(g, mandible(M, V(0.35, -0.1, 3.2), [[0.35, -0.1, 3.2], [0.95, -0.15, 3.9], [0.8, -0.2, 4.7], [0.15, -0.25, 5.1]], 0.2, { speed: 7, amp: 0.25, seg: 8, rad: 5 }));
  pair(g, membrane(M, [[[0.5, 0.6, 0.7], [2.3, 1.0, 0.3], [4.6, 1.2, -0.9]], [[0.5, 0.6, 0.7], [2.1, 0.8, -0.6], [3.8, 0.7, -2.5]], [[0.5, 0.6, 0.7], [1.2, 0.6, -1.1], [1.5, 0.5, -3.0]]], { r: 0.11, seg: 6, rad: 4, nv: 5, nu: 5, sway: { axis: 'z', amp: 0.45, speed: 9 } }));
  const s = sac(x.sacPink, 0.42, 1, 0.9, 1.3, 0.15, 4, 10); s.position.set(0, 0.1, -3.0); g.add(s);
  return g;
}
register('swarm', M => {
  const g = new THREE.Group(), tpl = swarmling(M);
  const slots = [[0, 1.2, 7.8, 1.1], [-5.6, -0.6, 3.0, 0.95], [5.2, 0.5, 1.4, 1.0], [-7.0, 1.4, -5.6, 0.9], [1.0, -1.3, -4.6, 1.05], [7.2, 0.9, -7.8, 0.88]];
  slots.forEach(([sx, sy, sz, sc], i) => {
    /* Platz in der Formation → Kreisbahn (orbit) → Tier (spin hebt die orbit-Drehung auf, damit es nach vorn schaut; schwebt mit bob) */
    const slot = new THREE.Group(); slot.position.set(sx, sy, sz);
    const piv = new THREE.Group(); piv.userData.orbit = { r: 0.8 + (i % 3) * 0.45, speed: (i % 2 ? 1 : -1) * (0.9 + i * 0.12), phase: i * 1.7, y: 0, wob: 0.45, flat: 0.6 };
    const c = tpl.clone(true); c.scale.setScalar(sc); c.rotation.y = (i - 2.5) * 0.07; c.userData.spin = { axis: 'y', speed: -0.8 }; c.userData.bob = { amp: 0.35, speed: 1.8 + i * 0.27, y0: 0 };
    c.traverse(o => { if (o.userData.sway) o.userData.sway.phase += i * 0.9; });
    piv.add(c); slot.add(piv); g.add(slot);
  });
  return g;
});

/* ===================================================================== SPITTER */
/* Artillerie-Wurm: gebuckelter Hinterleib mit großer Säureblase im Rippenkorb, langer erhobener Hals, Speirohr */
register('spitter', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-14.5, 0, 0, 0.8], [-14.0, 1.1, 1.0, 0.7], [-12, 2.6, 2.3, 0.4], [-8, 3.6, 3.0, 0.1], [-3.5, 3.7, 3.0, 0], [0, 3.0, 2.6, 0.2], [2.5, 2.0, 1.9, 0.7], [5, 1.55, 1.55, 1.5], [7.5, 1.5, 1.5, 2.2], [9.5, 1.75, 1.7, 2.4], [11.2, 2.1, 1.85, 2.2], [12.6, 1.8, 1.55, 1.8], [13.4, 1.1, 1.0, 1.5]], 0.85);
  fleshB(B, M, P, { segs: [-11, -8.5, -6, -3.5, -1, 1.8, 4.3, 6.6, 8.6], groove: 0.12, gw: 0.4, nv: 52, nu: 18, T: 8 });
  const L = armor(B, M, P, -12, 0.5, 4, { c: 1.3, span: 0.7, th: 0.32, lift: 0.3, ridge: 0.12, point: 0.6, T: 8, nu: 10 });
  const R = armor(B, M, P, -12, 0.5, 4, { c: -1.3, span: 0.7, th: 0.32, lift: 0.3, ridge: 0.12, point: 0.6, T: 8, nu: 10 });
  const N = armor(B, M, P, 1.5, 9.8, 4, { span: 1.15, th: 0.26, lift: 0.26, ridge: 0.22, point: 0.6, T: 8, nu: 12 });
  const H = cap(B, M, P, 9.4, 13.3, { span: 1.15, th: 0.36, lift: 0.22, ridge: 0.36, point: 1.0, T: 8 });
  for (const pin of N) spike(B, M, pin(0, 0.25, -0.05), V(0, 1, -0.8), 1.0, 0.2, false);
  spike(B, M, H(0, 0.35, -0.1), V(0, 1, -0.5), 1.6, 0.3, false);
  for (const pin of L) spike(B, M, pin(1, 0.3, -0.05), V(1, -0.3, -0.8), 1.1, 0.22);
  pores(B, M, L, [-0.3, 0.3], 0.5, 0.18); pores(B, M, R, [-0.3, 0.3], 0.5, 0.18);
  eyeCluster(B, M, P, 11.4, 1.3, 4, 0.3, 11, 1);
  eye(B, M, onB(P, 12.4, 0.55, -0.05), nrm(P, 12.4, 0.55), 0.26);
  for (const z of [-9, -6.2, -3.4]) horn(B, M, arc(0, 3.6, z, 3.1, 3.1, 1.85, 10), 0.26, 0.6, { sym: false, c0: 0.7, c1: 1.15, rad: 6 });
  horn(B, M, [[0, 6.8, -10.5], [0, 7.0, -6.2], [0, 6.6, -2.2]], 0.24, 0.5, { sym: false, rad: 6 });
  for (const s of [-1, 1]) B.add(tube([[s * 0.9, 5.0, -2.6], [s * 0.8, 3.6, 1.5], [s * 0.6, 3.6, 6], [s * 0.5, 4.0, 10.2]], 0.28, 0.2, x.sac, 20, 6).geometry, x.sac, I0);
  B.flush(g);
  sacAt(g, x.sac, V(0, 4.3, -6.2), 2.7, [1, 0.88, 1.45], 0.05, 2, 18);
  const t = spitTube(M, 0.85, 3.2); t.position.set(0, 1.55, 12.9); t.rotation.x = 0.08; g.add(t);
  pair(g, mandible(M, V(1.3, 1.1, 12.2), [[1.3, 1.1, 12.2], [2.2, 0.8, 13.6], [1.9, 0.5, 15.0], [0.9, 0.4, 15.6]], 0.36, { teeth: 2, amp: 0.1, speed: 2, seg: 10, rad: 6 }));
  for (const s of [-1, 1]) g.add(tentacle(M, V(s * 1.1, 0.7, -13.4), [[s * 1.1, 0.7, -13.4], [s * 2.2, 0.6, -15], [s * 3.0, 0.1, -16.6]], 0.42, { phase: s, amp: 0.3, speed: 1.6, tip: x.sacPink, tipR: 0.3, seg: 10, rad: 6 }));
  sacAt(g, x.sacPink, V(0, 0.8, -14.6), 0.85, [1, 0.9, 1.2], 0.12, 2.6, 12);
  return g;
});

/* ===================================================================== RAVAGER */
/* Rammbestie: niedriger Keil mit breiten Schultern, hammerartiger Kopfpanzer als Oberkiefer, riesiger Unterkiefer (kaut),
   dicke Hörner und Hauer nach vorn, Schulterdornen */
register('ravager', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-17.5, 0, 0, 0.9], [-16.8, 0.9, 0.8, 0.9], [-14, 2.2, 1.8, 0.8], [-9, 4.0, 2.8, 0.6], [-3, 6.0, 3.4, 0.4], [2, 7.2, 3.7, 0.3], [6, 7.0, 3.5, 0.1], [9, 5.4, 3.0, -0.2], [10.5, 3.8, 2.4, -0.4]], 0.7);
  fleshB(B, M, P, { segs: [-13, -9.5, -6, -2.5, 1, 4.5], groove: 0.1, gw: 0.5, nv: 44, T: 9 });
  const D = armor(B, M, P, -15, 5, 6, { span: 1.5, th: 0.6, lift: 0.6, ridge: 0.5, point: 1.4, T: 9 });
  const F = armor(B, M, P, -12, 4, 4, { c: 1.95, span: 0.42, th: 0.35, lift: 0.3, point: 0.5, T: 9, nu: 8 }); armor(B, M, P, -12, 4, 4, { c: -1.95, span: 0.42, th: 0.35, lift: 0.3, point: 0.5, T: 9, nu: 8 });
  D.forEach((pin, i) => { spike(B, M, pin(0, 0.3, -0.1), V(0, 1, -0.75), 2.2 - i * 0.22, 0.42, false); spike(B, M, pin(0.7, 0.45, -0.1), V(0.7, 0.8, -0.8), 1.1 - i * 0.1, 0.22); });
  pores(B, M, D, [-0.45, 0.45], 0.62, 0.22);
  /* Hammer-Kopfpanzer = Oberkiefer */
  const Pu = prof([[4, 7.4, 3.8, 0.3], [8, 7.7, 3.4, 0], [11.5, 6.8, 2.6, -0.4], [14.5, 4.8, 1.8, -0.8], [16.6, 1.9, 1.0, -1.0], [17.2, 0.2, 0.2, -1.0]]);
  const up = jaw(M, Pu, 4, 17.2, { c: 0, span: 1.95, th: 0.95, ridge: 0.75, lift: 0.5, point: 1.2, teeth: 8, tl: 1.6, t0: 0.12, t1: 0.7, nu: 18, nv: 9, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.3))), 0.4), lip: [1.6, 1.15, 1.55] });
  g.add(up); const U = up.userData.pin;
  /* Stirnhorn, Haupthörner, Wangenhauer */
  horn(B, M, [[0, 4.0, 10.5], [0, 5.2, 13.5], [0, 5.0, 16.4]], 0.9, 0.05, { sym: false });
  horn(B, M, [[4.4, 2.5, 9.5], [6.2, 3.0, 13.5], [5.8, 2.2, 17.6], [3.9, 1.0, 20.6]], 1.35, 0.04);
  horn(B, M, [[6.6, -0.7, 8.0], [8.6, -0.5, 11.5], [8.8, 0.0, 15.0], [7.6, 0.8, 17.6]], 0.95, 0.05);
  for (let i = 0; i < 3; i++) eye(B, M, U(0.6 + i * 0.1, 0.48 + i * 0.06, -0.08), U.n(0.62, 0.5), 0.38 - i * 0.06);
  eye(B, M, U(0.45, 0.28, -0.08), U.n(0.45, 0.28), 0.28);
  /* Schulterdornen, Schwanzstachel */
  spike(B, M, onB(P, 3, 1.5, -0.3), V(1, 0.3, -0.6), 4.2, 0.8);
  spike(B, M, onB(P, -1.5, 1.55, -0.3), V(1, 0.15, -0.8), 3.2, 0.6);
  spike(B, M, onB(P, -6, 1.6, -0.3), V(1, 0.1, -0.9), 2.2, 0.45);
  horn(B, M, [[0, 0.9, -16.5], [0, 1.6, -18.5], [0, 2.8, -20]], 0.55, 0.05, { sym: false });
  /* Klauen unter der Brust */
  for (const z of [3, -1]) { const p = onB(P, z, 2.3, -0.3); horn(B, M, [[p.x, p.y, p.z], [p.x + 1.4, p.y - 1.4, p.z + 1.2], [p.x + 0.6, p.y - 2.2, p.z + 3.2]], 0.55, 0.3, { mat: x.chitin, c0: 0.5, c1: [1.4, 1.1, 1.4], seg: 8, rad: 6 }); fang(B, M, V(p.x + 0.6, p.y - 2.2, p.z + 3.2), V(-0.2, -0.3, 1), V(0, -1, 0), 1.3, 0.3); }
  B.flush(g);
  const m = maw(M, 3.4, 1.9, 4, { teeth: 10, tl: 0.5, lip: 0 }); m.position.set(0, -0.4, 10.2); g.add(m);
  /* Unterkiefer am Gelenk, kaut */
  const Pl = prof([[0, 6.0, 2.4, 0], [3, 5.8, 2.2, 0], [6, 4.6, 1.8, 0.1], [8, 2.9, 1.1, 0.2], [9.2, 0.8, 0.4, 0.25], [9.5, 0.1, 0.1, 0.25]]);
  const lo = jaw(M, Pl, 0, 9.5, { span: 1.55, th: 0.85, ridge: 0.45, teeth: 7, tl: 1.4, t0: 0.1, t1: 0.75, front: 3, frontK: 1.2, nu: 16, nv: 8 });
  const hinge = new THREE.Group(); hinge.position.set(0, -1.5, 7.6); hinge.add(lo); hinge.userData.sway = { axis: 'x', amp: 0.12, speed: 2.2, phase: 0, base: 0.32 }; hinge.rotation.x = 0.32; g.add(hinge);
  for (const s of [-1, 1]) sacAt(g, x.sacPink, V(s * 1.9, 0.3, -15.2), 1.1, [1, 0.85, 1.3], 0.12, 3 + s * 0.4, 12);
  pair(g, membrane(M, [[[1.4, 0.9, -13.5], [3.6, 1.2, -16.5], [5.8, 1.4, -18.4]], [[1.4, 0.9, -13.5], [3.4, 0.8, -17.6], [4.2, 0.6, -19.8]], [[1.4, 0.9, -13.5], [2.0, 0.8, -17.2], [2.2, 0.8, -19.6]]], { r: 0.22, nv: 6, seg: 8, rad: 5, sway: { axis: 'y', amp: 0.15, speed: 1.6 } }));
  return g;
});

/* ===================================================================== LEECH */
/* geringelter Saugwurm in S-Kurve, Neunaugen-Saugscheibe mit Zahnringen, Parasitenkapseln an den Flanken, Schwanzflosse */
register('leech', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-15.5, 0, 0, 0.3, 0.8], [-14.8, 0.8, 0.7, 0.3, 1.2], [-12, 1.8, 1.6, 0.2, 2.0], [-7, 2.5, 2.2, 0.1, 1.4], [-2, 2.9, 2.5, 0, -0.6], [3, 2.9, 2.5, 0, -1.6], [8, 2.6, 2.3, 0, -0.7], [11.5, 2.4, 2.2, 0, 0.3], [13.2, 2.7, 2.5, 0, 0.4], [14.2, 3.1, 2.9, 0, 0.4]], 0.85);
  const segs = []; for (let z = -13; z <= 12.5; z += 1.7) segs.push(z);
  fleshB(B, M, P, { segs, groove: 0.13, gw: 0.33, nv: 70, nu: 18, T: 7 });
  const D = armor(B, M, P, -13, 12.4, 9, { span: 0.95, th: 0.24, lift: 0.24, ridge: 0.2, point: 0.55, T: 7, nu: 10, nv: 5 });
  D.forEach((pin, i) => { if (i % 2 === 0) spike(B, M, pin(0, 0.25, -0.05), V(0, 1, -0.8), 0.9, 0.18, false); });
  pores(B, M, D, [0], 0.6, 0.17);
  /* Saugscheibe: ausgestülpter Trichter mit drei Zahnringen und Augenkranz */
  const S = new THREE.Group(), SB = new Bag();
  const sp = [[3.0, -0.6], [3.6, 0.2], [3.9, 0.85], [3.5, 1.15], [2.8, 0.9], [2.0, 0.55], [1.2, 0.15], [0.55, -0.6], [0.2, -1.6]].map(([a, b]) => new THREE.Vector2(a, b));
  const sl = new THREE.LatheGeometry(sp, 20); sl.rotateX(Math.PI / 2); addColor(sl, (a, b, z) => { const r = Math.hypot(a, b); return r > 3.3 && z > 0.6 ? [1.1, 0.9, 1.0] : lerp(0.25, 0.95, r / 3.4); }); SB.add(sl, x.gum, I0);
  [[2.75, 16, 0.75], [2.0, 12, 0.55], [1.25, 8, 0.4]].forEach(([r, n, l], k) => { for (let i = 0; i < n; i++) { const a = (i + k * 0.5) / n * TAU, ca = Math.cos(a), sa = Math.sin(a), z = 0.95 - k * 0.38; fang(SB, M, V(ca * r, sa * r, z), V(-ca * 0.8, -sa * 0.8, 0.45), V(-ca, -sa, 0), l, l * 0.25, false); } });
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; eye(SB, M, V(Math.cos(a) * 3.55, Math.sin(a) * 3.55, -0.2), V(Math.cos(a), Math.sin(a), -0.2).normalize(), 0.3, false, false); }
  SB.flush(S); const gl = mesh(sphG(), x.acid, false); gl.position.z = -1.2; gl.userData.pulse = { amp: 0.3, speed: 2.6, base: 0.55 }; S.add(gl);
  S.position.set(0.4, 0, 14.1); g.add(S);
  /* Parasitenkapseln */
  [-9.5, -6, -2.5, 1, 4.5, 8].forEach((z, i) => { for (const s of [-1, 1]) { const a = s * (1.55 + (i % 2) * 0.25), p = onB(P, z, a, -0.25), q = pod(M, 0.75 + (i % 3) * 0.12, i * 7 + s); stand(q, p, nrm(P, z, a).add(V(0, 0, -0.35))); g.add(q); } });
  for (const z of [-11, -4.2, 2.8, 9.6]) for (const s of [-1, 1]) spike(B, M, onB(P, z, s * 2.4, -0.1), V(s, -0.6, -0.6), 0.7, 0.15, false);
  B.flush(g);
  g.add(membrane(M, [[[0.8, 0.4, -14.2], [1.0, 2.2, -16.0], [1.2, 3.8, -17.4]], [[0.8, 0.4, -14.2], [1.0, 0.9, -17.2], [1.2, 0.8, -19.0]], [[0.8, 0.4, -14.2], [1.0, -1.0, -16.6], [1.2, -2.6, -17.8]]], { r: 0.2, nv: 8, seg: 8, rad: 5, tips: x.glow, tipR: 0.28, sway: { axis: 'y', amp: 0.3, speed: 1.7 } }));
  return g;
});

/* ===================================================================== SPORER */
/* Manta: breiter flacher Leib, große Flughäute (wogen), gekrümmte Sporenschlote auf dem Rücken, Tentakelschleier darunter */
register('sporer', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-19, 0, 0, 0.8], [-18, 1.4, 0.9, 0.7], [-14, 3.8, 2.2, 0.6], [-7, 6.4, 3.6, 0.4], [1, 7.0, 4.0, 0.2], [8, 6.0, 3.6, 0], [12.5, 4.2, 2.8, -0.2], [15.5, 3.2, 2.2, -0.3], [17.5, 2.6, 1.8, -0.4], [18.6, 1.6, 1.25, -0.4]], 0.55);
  fleshB(B, M, P, { segs: [-14, -10, -6, -2, 2, 6, 10, 14.2], groove: 0.07, gw: 0.6, nv: 48, nu: 26, T: 10 });
  const D = armor(B, M, P, -16, 13, 6, { span: 1.05, th: 0.45, lift: 0.4, ridge: 0.2, point: 1.0, T: 10 });
  const H = cap(B, M, P, 13.2, 18.4, { span: 1.2, th: 0.4, lift: 0.2, ridge: 0.35, point: 1.0, T: 10 });
  pores(B, M, D, [-0.75, 0.75], 0.55, 0.22);
  eyeCluster(B, M, P, 16.4, 1.25, 4, 0.32, 21, 1); eye(B, M, H(0.55, 0.15, 0), H.n(0.55, 0.15), 0.28);
  spike(B, M, H(0, 0.4, -0.1), V(0, 1, -0.6), 1.4, 0.3, false);
  for (const z of [-12, -6, 0, 6]) spike(B, M, onB(P, z, 1.65, -0.2), V(1, 0.2, -0.6), 1.2, 0.22);
  B.flush(g);
  /* Sporenschlote */
  [[0, 3, 6.4, 1.05, 2.4], [0, -3.5, 5.4, 0.95, 2.0], [0, -10, 4.0, 0.8, 1.6], [3.3, 0, 3.8, 0.75, 1.6], [3.0, -7, 3.2, 0.65, 1.4]].forEach(([cx, z, h, r, lean], i) => {
    for (const s of (cx ? [-1, 1] : [1])) { const a = Math.asin(Math.min(0.95, (s * cx) / P(z).rx)), c = vent(M, h, r, lean, i * 3 + s); stand(c, onB(P, z, a, -0.25), V(s * cx * 0.12, 1, 0)); g.add(c); }
  });
  /* Flughäute */
  pair(g, membrane(M, [[[5.4, 0.7, 4.5], [12, 1.4, 4.5], [19.5, 1.9, -1]], [[5.4, 0.7, 1.5], [12, 1.0, -2.5], [17.5, 0.9, -8.5]], [[5.4, 0.7, -2.5], [10, 0.6, -8.5], [12.5, 0.4, -14.5]], [[5.2, 0.7, -6], [7.2, 0.6, -12], [7.4, 0.5, -17]]], { r: 0.32, nv: 10, sag: 0.22, seg: 10, rad: 6, sway: { axis: 'z', amp: 0.13, speed: 1.1 }, tips: x.glow, tipR: 0.35 }));
  /* Tentakelschleier */
  [[6, 0.45], [1, 0.6], [-4, 0.5], [-9, 0.4]].forEach(([z, a], i) => { for (const s of [-1, 1]) { const p = onB(P, z, Math.PI - s * a, -0.2); g.add(tentacle(M, p, [[p.x, p.y, p.z], [p.x + s * 0.3, p.y - 2.2, p.z - 1.2], [p.x + s * 0.6, p.y - 4.2, p.z - 3.4], [p.x + s * 0.4, p.y - 5.4, p.z - 6]], 0.45, { axis: 'x', amp: 0.18, speed: 1.3, phase: i + s, tip: x.glow, tipR: 0.22, seg: 10, rad: 6 })); } });
  const m = maw(M, 1.5, 1.15, 2.4, { teeth: 8, tl: 0.6 }); m.position.set(0, -0.4, 18.5); g.add(m);
  pair(g, mandible(M, V(1.5, -0.5, 17.4), [[1.5, -0.5, 17.4], [2.4, -0.6, 18.8], [2.0, -0.7, 20.2], [0.9, -0.8, 20.6]], 0.42, { teeth: 2, seg: 10, rad: 6 }));
  return g;
});

/* ===================================================================== GRAZER */
/* Fresser: breites Schaufelmaul mit Kammzähnen (Barten), Rechenhauer, riesiger durchscheinender Magen voller Erz und Eis */
register('grazer', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-15.5, 0, 0, 1.5], [-15, 1.2, 1.0, 1.5], [-12, 3.0, 2.4, 1.4], [-6, 4.6, 3.4, 1.4], [0, 5.4, 3.8, 1.2], [5, 5.8, 3.6, 0.9], [8.5, 6.0, 3.0, 0.6], [9.5, 5.8, 2.6, 0.5]], 0.75);
  fleshB(B, M, P, { segs: [-12, -9, -6, -3, 0, 3], groove: 0.08, gw: 0.5, nv: 40, nu: 24, T: 8 });
  const D = armor(B, M, P, -13, 5.5, 5, { span: 1.35, th: 0.4, lift: 0.42, ridge: 0.3, point: 0.9, T: 8 });
  D.forEach((pin, i) => spike(B, M, pin(0, 0.3, -0.05), V(0, 1, -0.9), 1.4 - i * 0.12, 0.26, false));
  pores(B, M, D, [-0.6, 0.6], 0.5, 0.2);
  const Pu = prof([[5, 6.0, 3.4, 0.7], [9.5, 6.3, 3.0, 0.45], [12, 5.9, 2.3, 0.1]]);
  const up = jaw(M, Pu, 5, 12, { c: 0, span: 1.45, th: 0.55, ridge: 0.35, lift: 0.4, teeth: 0, front: 13, tl: 1.1, frontK: 1.1, nu: 16, nv: 7, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.2))), 0.4) });
  g.add(up); const U = up.userData.pin;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) eye(B, M, U(s * (0.42 + i * 0.12), 0.55 + i * 0.08, -0.05), U.n(s * 0.45, 0.6), 0.36 - i * 0.06, false, false);
  horn(B, M, [[5.3, -0.4, 8], [7.2, -0.9, 11], [6.8, -1.3, 14.2], [5.4, -1.2, 15.8]], 0.65, 0.05);
  B.flush(g);
  const m = maw(M, 4.6, 1.9, 5, { teeth: 0, lip: 0, glow: 0.45 }); m.position.set(0, 0.2, 9.4); g.add(m);
  const Pl = prof([[0, 5.6, 2.0, 0], [4, 6.6, 1.8, 0.1], [7.5, 7.0, 1.3, 0.3], [9, 6.9, 1.0, 0.5]]);
  const lo = jaw(M, Pl, 0, 9, { span: 1.45, th: 0.6, ridge: 0.3, teeth: 0, front: 15, tl: 1.2, nu: 16, nv: 7, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * (0.12 + 0.88 * t))), 0.3) });
  const hinge = new THREE.Group(); hinge.position.set(0, -0.9, 6.2); hinge.add(lo); hinge.userData.sway = { axis: 'x', amp: 0.06, speed: 1.3, phase: 0, base: 0.16 }; hinge.rotation.x = 0.16; g.add(hinge);
  /* Magen mit Brocken – breiter als der Leib, damit er von oben zu sehen ist */
  const st = new THREE.Group(), q = rng(77), sx = 6.6, sy = 4.2, sz = 7.8;
  const sm_ = mesh(sphG(20, 14), x.stomach); sm_.scale.set(sx, sy, sz); sm_.renderOrder = 2; st.add(sm_);
  for (let i = 0; i < 10; i++) { const ch = mesh(new THREE.IcosahedronGeometry(1, 0), i % 3 === 0 ? x.ice : x.rock); ch.scale.set(0.9 + q() * 1.2, 0.7 + q() * 0.9, 0.9 + q() * 1.2); ch.position.set((q() - 0.5) * 8, (q() - 0.6) * 3.6, (q() - 0.5) * 10); ch.rotation.set(q() * 3, q() * 3, q() * 3); st.add(ch); }
  st.position.set(0, -1.8, -4.6); st.userData.pulse = { amp: 0.025, speed: 1.1, base: 1 }; g.add(st);
  const bands = new Bag(); for (const z of [-9.4, -4.6, 0.2]) { const k = Math.sqrt(1 - ((z + 4.6) / (sz + 0.3)) ** 2); bands.add(tubeC(arc(0, 1.8, z, (sx + 0.2) * k, (sy + 0.2) * k, 2.2, 12), 0.24, 0.24, x.flesh, 16, 5, 0.1, 0.7, 0.7).geometry, x.flesh, T(0, 0, 0, 1, -1, 1)); } bands.flush(g);
  sacAt(g, x.sacPink, V(0, 1.6, -15.3), 1.0, [1, 0.9, 1.2], 0.12, 2.6, 12);
  pair(g, membrane(M, [[[1.2, 1.8, -13.5], [3.4, 2.6, -16], [5, 3.2, -17]], [[1.2, 1.8, -13.5], [3.0, 1.4, -16.6], [3.6, 1.0, -17.6]]], { r: 0.18, nv: 6, seg: 8, rad: 5, sway: { axis: 'y', amp: 0.2, speed: 1.5 } }));
  pair(g, tentacle(M, V(1.2, 2.6, 8.6), [[1.2, 2.6, 8.6], [2.4, 4.0, 10], [3.8, 4.4, 11.6]], 0.2, { mat: x.chitin, wob: 0, amp: 0.25, speed: 1.6, axis: 'z', c1: [1.5, 1.2, 1.5], seg: 8, rad: 5 }));
  return g;
});

/* ===================================================================== SEEDER */
/* Bauwesen: Käferleib, Knochenfinger halten eine Traube leuchtender Nestsamen, lange Werkzeugtentakel und Fühler, Spinndrüsen */
register('seeder', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-16, 0, 0, 0.6], [-15.3, 1.2, 1.0, 0.6], [-12, 3.2, 2.6, 0.5], [-6, 4.2, 3.2, 0.4], [-0.5, 3.6, 2.8, 0.2], [2.5, 2.4, 2.0, 0.2], [4, 2.6, 2.2, 0.3], [7, 3.0, 2.5, 0.4], [10, 2.7, 2.3, 0.3], [12.5, 2.0, 1.7, 0], [13.8, 1.2, 1.1, -0.2]], 0.8);
  fleshB(B, M, P, { segs: [-12.5, -9.5, -6.5, -3.5, -0.8, 3, 5.6, 8.4, 11], groove: 0.1, gw: 0.4, nv: 50, nu: 20, T: 8 });
  const L = armor(B, M, P, -13.5, 1, 4, { c: 1.45, span: 0.6, th: 0.32, lift: 0.3, point: 0.6, T: 8, nu: 9 }), R = armor(B, M, P, -13.5, 1, 4, { c: -1.45, span: 0.6, th: 0.32, lift: 0.3, point: 0.6, T: 8, nu: 9 });
  pores(B, M, L, [0], 0.5, 0.18); pores(B, M, R, [0], 0.5, 0.18);
  const Th = armor(B, M, P, 3.2, 12.8, 3, { span: 1.35, th: 0.36, lift: 0.3, ridge: 0.3, point: 1.0, T: 8 });
  Th.forEach(pin => spike(B, M, pin(0, 0.3, -0.05), V(0, 1, -0.8), 1.2, 0.24, false));
  eyeCluster(B, M, P, 12.2, 1.15, 4, 0.3, 31, 0.9); eye(B, M, onB(P, 13.0, 0.6, -0.05), nrm(P, 13.0, 0.6), 0.24);
  /* Knochenfinger, die die Samen halten */
  for (const z of [-11.4, -8.6, -5.8, -3.0]) horn(B, M, [[3.4, 2.2, z], [4.9, 5.0, z - 0.2], [3.9, 7.6, z], [1.5, 8.6, z + 0.4]], 0.42, 0.12, { c0: 0.6, c1: 1.2, rad: 6, seg: 10 });
  /* Spinndrüsen */
  for (const s of [-1, 1]) { horn(B, M, [[s * 0.7, 0.6, -15], [s * 1.0, 0.4, -16.6], [s * 1.2, 0.0, -17.6]], 0.32, 0.5, { sym: false, mat: x.chitin, c1: [1.3, 1, 1.3], rad: 6, seg: 6 }); B.add(sphG(8, 6), x.glow, T(s * 1.2, 0.0, -17.7, 0.24)); }
  /* Beine eingeklappt */
  for (const z of [6.5, 2.0, -3.0]) { const p = onB(P, z, 2.2, -0.3); horn(B, M, [[p.x, p.y, p.z], [p.x + 2.4, p.y - 0.3, p.z + 0.8], [p.x + 3.0, p.y - 2.6, p.z - 0.4], [p.x + 2.4, p.y - 3.6, p.z - 1.6]], 0.36, 0.25, { mat: x.chitin, seg: 10, rad: 5, c0: 0.5, c1: [1.4, 1.1, 1.4] }); }
  B.flush(g);
  /* Nestsamen */
  [[0, 5.2, -7.0, 1.9], [2.1, 4.4, -5.0, 1.5], [-2.1, 4.5, -5.4, 1.45], [1.9, 4.6, -9.6, 1.5], [-2.0, 4.4, -9.2, 1.55], [0, 4.8, -3.2, 1.35], [0, 4.6, -11.2, 1.4]].forEach(([ex, ey, ez, r], i) => sacAt(g, i % 3 === 1 ? x.sacPink : x.egg, V(ex, ey, ez), r, [1, 1.05, 1.35], 0.05, 1.2 + i * 0.23, 14));
  const m = maw(M, 1.1, 1.0, 1.8, { teeth: 7, tl: 0.6 }); m.position.set(0, -0.2, 13.8); g.add(m);
  pair(g, tentacle(M, V(1.0, -0.8, 12.4), [[1.0, -0.8, 12.4], [2.4, -1.5, 14.8], [2.2, -0.8, 17.2], [1.0, 0.4, 18.6]], 0.42, { amp: 0.22, speed: 1.2, wob: 0.15, tip: x.glow, tipR: 0.38, seg: 12, rad: 6 }));
  pair(g, tentacle(M, V(0.7, 1.3, 12.8), [[0.7, 1.3, 12.8], [2.0, 3.0, 15.0], [3.7, 3.7, 17.4]], 0.18, { mat: x.chitin, wob: 0, r1: 0.3, axis: 'z', amp: 0.2, speed: 1.7, c1: [1.5, 1.2, 1.5], seg: 10, rad: 5 }));
  for (const s of [-1, 1]) sacAt(g, x.sacPink, V(s * 1.6, -0.2, -14.6), 0.95, [1, 0.85, 1.2], 0.12, 2.6 + s * 0.3, 12);
  return g;
});

/* ===================================================================== ACID MAW */
/* schwerer Säurespeier: breiter Panzerleib, riesige Säuredrüse im Rippenkorb plus zwei Flankendrüsen, breiter Schnabel
   über dem Speischlund, kauender Unterkiefer, gespreizte Mandibeln, zwei Schulter-Speirohre */
register('acidmaw', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-23.5, 0, 0, 0.8], [-22.8, 1.8, 1.4, 0.8], [-19, 5.0, 3.4, 0.6], [-12, 7.6, 4.8, 0.4], [-4, 8.4, 5.2, 0.2], [4, 8.0, 4.9, 0], [10, 6.6, 4.1, 0], [14, 5.6, 3.6, 0], [17, 5.8, 3.8, 0], [19.5, 5.2, 3.4, -0.1], [20.8, 4.4, 2.9, -0.2]], 0.75);
  fleshB(B, M, P, { segs: [-19, -15, -11, -7, -3, 1, 5, 9, 13], groove: 0.09, gw: 0.6, nv: 56, nu: 26, T: 11 });
  const L = armor(B, M, P, -19, 9, 5, { c: 1.5, span: 0.6, th: 0.5, lift: 0.45, ridge: 0.2, point: 0.9, T: 11, nu: 10 });
  const R = armor(B, M, P, -19, 9, 5, { c: -1.5, span: 0.6, th: 0.5, lift: 0.45, ridge: 0.2, point: 0.9, T: 11, nu: 10 });
  const H = cap(B, M, P, 10.5, 17.8, { span: 1.35, th: 0.7, lift: 0.4, ridge: 0.55, point: 1.4, T: 11 });
  cap(B, M, P, 7.5, 12.5, { span: 1.45, th: 0.6, lift: 0.5, ridge: 0.4, point: 1.2, T: 11 });
  L.forEach(pin => spike(B, M, pin(0.9, 0.35, -0.1), V(1, -0.2, -0.8), 1.8, 0.34));
  pores(B, M, L, [-0.4, 0.4], 0.55, 0.24); pores(B, M, R, [-0.4, 0.4], 0.55, 0.24);
  for (const s of [-1, 1]) spike(B, M, H(s * 0.45, 0.45, -0.1), V(s * 0.5, 1, -0.7), 2.4, 0.42, false);
  eyeCluster(B, M, P, 17.8, 1.3, 5, 0.42, 41, 1.1); eye(B, M, H(0.5, 0.12, 0), H.n(0.5, 0.12), 0.4);
  /* Schnabel über dem Schlund */
  const Pb = prof([[15.5, 6.2, 4.2, 0.2], [20, 5.9, 3.5, -0.1], [23, 4.7, 2.4, -0.5], [24.6, 2.0, 1.1, -0.9], [25, 0.2, 0.2, -1.0]]);
  const bk = jaw(M, Pb, 15.5, 25, { c: 0, span: 1.8, th: 0.7, ridge: 0.65, lift: 0.3, teeth: 7, tl: 1.6, t0: 0.1, t1: 0.6, nu: 16, nv: 8 }); g.add(bk);
  /* Rippenkorb über der Hauptdrüse, Säureleitungen */
  const gz = -5, grx = 5.4, gry = 4.2, grz = 9.6, gy = 6.6;
  for (const z of [-12.5, -8.8, -5, -1.2, 2.6]) { const k = Math.sqrt(Math.max(0.05, 1 - ((z - gz) / grz) ** 2)); horn(B, M, arc(0, gy, z, grx * k + 0.6, gry * k + 0.6, 2.0, 12), 0.4, 0.6, { sym: false, c0: 0.7, c1: 1.15, rad: 6 }); }
  for (const z of [-12.5, -8.8, -5, -1.2, 2.6]) { const k = Math.sqrt(Math.max(0.05, 1 - ((z - gz) / grz) ** 2)); spike(B, M, V(0, gy + gry * k + 0.85, z), V(0, 1, -0.5), 1.4 + k, 0.34, false); }
  for (const s of [-1, 1]) horn(B, M, [[s * 2.2, 4.4, 15.5], [s * 3.8, 6.6, 13.2], [s * 4.0, 7.6, 10.0], [s * 3.2, 7.6, 7.6]], 0.75, 0.06, { sym: false });
  for (const s of [-1, 1]) B.add(tube([[s * 1.4, 6.0, 4.0], [s * 1.6, 4.8, 9], [s * 1.2, 4.4, 14], [s * 0.9, 3.8, 18]], 0.45, 0.3, x.sac, 20, 6).geometry, x.sac, I0);
  /* Knochenring um die Flankendrüsen */
  const tr = new THREE.TorusGeometry(1, 0.13, 6, 18); tr.rotateY(Math.PI / 2); addColor(tr, () => 1); B.add(tr, x.bone, T(7.9, 2.6, -8, 1, 2.6, 3.9), true);
  drip(B, M, V(1.2, -2.9, 22), 0.3); drip(B, M, V(-0.9, -2.7, 21.4), 0.24);
  B.flush(g);
  sacAt(g, x.sac, V(0, gy, gz), 1, [grx, gry, grz], 0.04, 1.6, 22);
  sacAt(g, x.sac, V(0, 5.4, 7.0), 1, [3.2, 2.6, 3.8], 0.07, 2.4, 14);
  for (const s of [-1, 1]) sacAt(g, x.sac, V(s * 8.0, 2.6, -8), 1, [1.9, 2.4, 3.6], 0.08, 2.0 + s * 0.3, 14);
  const m = maw(M, 4.6, 2.9, 5.5, { teeth: 12, rows: 2, tl: 0.42, glow: 0.5 }); m.position.set(0, -0.3, 20.8); g.add(m);
  const Pl = prof([[0, 4.8, 2.0, 0], [4, 4.6, 1.8, 0], [6.5, 3.3, 1.2, 0.1], [7.8, 1.0, 0.45, 0.2], [8.1, 0.1, 0.1, 0.2]]);
  const lo = jaw(M, Pl, 0, 8.1, { span: 1.55, th: 0.6, ridge: 0.4, teeth: 6, tl: 1.1, front: 2, nu: 16, nv: 8 });
  const hinge = new THREE.Group(); hinge.position.set(0, -2.1, 16.2); hinge.add(lo); hinge.userData.sway = { axis: 'x', amp: 0.1, speed: 1.6, phase: 0, base: 0.36 }; hinge.rotation.x = 0.36; g.add(hinge);
  pair(g, mandible(M, V(4.8, -0.6, 18.2), [[4.8, -0.6, 18.2], [8.8, -0.9, 21], [8.4, -1.1, 25.2], [4.4, -1.3, 27.0]], 1.35, { teeth: 5, amp: 0.1, speed: 1.8, seg: 12, rad: 7 }));
  for (const s of [-1, 1]) { const t = spitTube(M, 0.65, 3.2); t.position.set(s * 5.4, 3.9, 9.5); t.rotation.set(-0.05, s * 0.08, 0); g.add(t); }
  [-1, 0, 1].forEach(s => g.add(tentacle(M, V(s * 1.6, 0.8 + (s ? 0 : 0.6), -22), [[s * 1.6, 0.8 + (s ? 0 : 0.6), -22], [s * 3.0, 0.8, -24.5], [s * 3.6, 0.2, -27]], 0.7, { phase: s * 1.3, amp: 0.25, speed: 1.3, seg: 10, rad: 6 })));
  for (const s of [-1, 1]) sacAt(g, x.sacPink, V(s * 2.6, -0.4, -21.0), 1.3, [1, 0.85, 1.25], 0.12, 2.4 + s * 0.3, 12);
  return g;
});

/* ===================================================================== LEVIATHAN */
/* Walfresser: gewaltiger Leib, schmaler Panzerkamm über nackten, geäderten Flanken mit Leuchtporen und Kiemenschlitzen,
   aufgerissener Riesenrachen (Rostrum + Unterkiefer mit Leuchtfalten), Leuchtköder an der Stirn, große Brustflossen, Fluke */
register('leviathan', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-40, 0, 0, 1.2], [-39, 2, 1.6, 1.2], [-34, 5.5, 4.2, 1.2], [-26, 10, 7.5, 0.9], [-14, 13.5, 10, 0.5], [0, 15, 11, 0.2], [14, 14.8, 10.8, 0], [24, 13.6, 10, -0.2], [32, 12.6, 9.4, -0.3], [36, 12.2, 9.0, -0.4]], 0.78);
  const segs = []; for (let z = -33; z <= 28; z += 5) segs.push(z);
  fleshB(B, M, P, { segs, groove: 0.06, gw: 1.0, nv: 70, nu: 32, T: 16 });
  const D = armor(B, M, P, -34, 28, 9, { span: 1.05, th: 1.3, lift: 1.3, ridge: 1.0, point: 3.0, T: 16, nu: 14, nv: 7 });
  const FL = armor(B, M, P, -26, 24, 6, { c: 2.05, span: 0.42, th: 0.8, lift: 0.7, point: 1.4, T: 16, nu: 8 }), FR = armor(B, M, P, -26, 24, 6, { c: -2.05, span: 0.42, th: 0.8, lift: 0.7, point: 1.4, T: 16, nu: 8 });
  D.forEach((pin, i) => { spike(B, M, pin(0, 0.25, -0.2), V(0, 1, -0.7), 4.6 - Math.abs(i - 3) * 0.45, 0.85, false); spike(B, M, pin(0.7, 0.4, -0.2), V(0.7, 0.9, -0.8), 2.2, 0.45); });
  pores(B, M, D, [-0.45, 0.45], 0.58, 0.42); pores(B, M, FL, [0], 0.5, 0.45, x.acid); pores(B, M, FR, [0], 0.5, 0.45, x.acid);
  /* Leuchtporen in zwei Reihen auf den nackten Flanken, Kiemenschlitze hinter dem Kopf */
  for (let i = 0; i < 11; i++) { const z = -26 + i * 4.4; for (const a of [1.42, 1.72]) { const p = onB(P, z + (a > 1.5 ? 2.2 : 0), a, -0.1); B.add(sphG(7, 5), x.glow, T(p.x, p.y, p.z, 0.5), true); } }
  gills(B, M, P, [19, 21.6, 24.2, 26.8], 1.05, 1.85, 0.32);
  /* Oberkiefer (Rostrum) */
  const Pu = prof([[29, 13.4, 9.9, -0.1], [36, 12.8, 9.4, -0.4], [41, 11.0, 7.4, -1.0], [44.5, 7.4, 4.6, -1.7], [46, 2.6, 1.8, -2.1], [46.3, 0.3, 0.3, -2.1]]);
  const up = jaw(M, Pu, 29, 46.3, { c: 0, span: 1.85, th: 1.6, ridge: 1.1, lift: 0.9, point: 2.0, teeth: 12, tl: 3.4, t0: 0.06, t1: 0.72, nu: 20, nv: 10, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.25))), 0.4), lip: [1.6, 1.15, 1.55] });
  g.add(up); const U = up.userData.pin;
  [[0.62, 0.38], [0.7, 0.5], [0.66, 0.62]].forEach(([r, t]) => { for (let i = 0; i < 3; i++) eye(B, M, U(r + i * 0.07, t + (i - 1) * 0.03, -0.2), U.n(r, t), 0.75 - i * 0.15, true); });
  for (const s of [-1, 1]) spike(B, M, U(s * 0.35, 0.3, -0.2), V(s * 0.3, 1, 0.2), 2.4, 0.5, false);
  /* Säuredrüsen an den Flanken mit Knochenrand */
  const gl = new THREE.TorusGeometry(1, 0.13, 8, 20); gl.rotateY(Math.PI / 2); addColor(gl, () => 1); B.add(gl, x.bone, T(14.4, 1.6, 15, 1, 3.4, 4.6), true);
  B.flush(g);
  for (const s of [-1, 1]) sacAt(g, x.sac, V(s * 14.6, 1.6, 15), 1, [2.2, 3.2, 4.4], 0.06, 1.8 + s * 0.2, 16);
  const m = maw(M, 10.2, 6.6, 14, { teeth: 16, rows: 2, tl: 0.32, lip: 0.08, glow: 0.3 }); m.position.set(0, -1.4, 36); g.add(m);
  /* Unterkiefer mit Leuchtfalten */
  const Pl = prof([[0, 12.6, 5.0, 0], [6, 12.4, 4.6, 0.2], [11, 10.6, 3.6, 0.5], [15, 7.2, 2.4, 0.9], [17.4, 2.4, 1.0, 1.1], [17.8, 0.3, 0.3, 1.1]]);
  const lo = jaw(M, Pl, 0, 17.8, { span: 1.6, th: 1.4, ridge: 0.6, teeth: 11, tl: 3.0, t0: 0.08, t1: 0.75, front: 3, nu: 20, nv: 10 });
  const LP = lo.userData.pin, lb = new Bag(); for (let k = -3; k <= 3; k++) { const pts = []; for (let i = 0; i <= 10; i++) { const p = LP(k * 0.13, 0.08 + i * 0.075, 0.08); pts.push([p.x, p.y, p.z]); } lb.add(tube(pts, 0.24, 0.24, x.glow, 16, 5).geometry, x.glow, I0); } lb.flush(lo);
  const hinge = new THREE.Group(); hinge.position.set(0, -5.2, 28.5); hinge.add(lo); hinge.userData.sway = { axis: 'x', amp: 0.07, speed: 0.8, phase: 0, base: 0.48 }; hinge.rotation.x = 0.48; g.add(hinge);
  /* Leuchtköder */
  g.add(tentacle(M, V(0, 8.8, 33), [[0, 8.8, 33], [0, 15.5, 37.5], [0, 16, 43.5], [0, 12.4, 48]], 0.65, { axis: 'x', amp: 0.1, speed: 0.9, r1: 0.25, wob: 0.05, mat: x.chitin, c0: 0.6, c1: [1.5, 1.2, 1.5], tip: x.acid, tipR: 1.5 }));
  /* Brustflossen, Schwanzfluke */
  pair(g, membrane(M, [[[11.5, -4, 15], [22, -7, 13], [37, -10, 7]], [[11.5, -4, 15], [22, -7.5, 6], [35, -10, -3]], [[11.5, -4, 15], [19, -7, 1], [28, -8.5, -10]], [[11.5, -4, 15], [14, -5.5, 4], [15, -6.4, -6]]], { r: 0.75, nv: 10, seg: 10, rad: 6, tips: x.glow, tipR: 0.9, sway: { axis: 'z', amp: 0.1, speed: 0.7 } }));
  const fl = new THREE.Group(); fl.position.set(0, 1.2, -38.5);
  const half = membrane(M, [[[0, 0, 0], [8, 0.8, -3.5], [21, 1.8, -6]], [[0, 0, 0], [8, 0.2, -7], [14, 0.2, -12.5]], [[0, 0, 0], [3, 0, -6.5], [3.5, 0, -10]]], { r: 0.85, nv: 8, seg: 10, rad: 6, tips: x.glow, tipR: 0.8 }); fl.add(half); fl.add(mir(half));
  fl.userData.sway = { axis: 'x', amp: 0.14, speed: 0.6, phase: 0, base: 0 }; g.add(fl);
  return g;
});

/* ===================================================================== BROOD MATRIARCH */
/* Königin: gewaltiger Eier-Hinterleib, gepanzerter Brustkorb, zwei Paar große Schwingen, wuchtiger Kopf mit einem Kragen
   aus Kronenstacheln (Kobra-Haube, leuchtende Spitzen), Sichel-Mandibeln, Stirnreihe und Trauben von Augen, Säuredrüsen,
   leuchtende Segmentfugen, Schleppententakel */
register('matriarch', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-46, 0, 0, 3.0], [-45, 2.6, 2.4, 2.9], [-40, 7.2, 6.6, 2.3], [-31, 11.2, 9.6, 1.5], [-21, 12.2, 10.2, 1.0], [-12.5, 10.0, 8.4, 0.8], [-7, 6.2, 5.4, 1.2], [-4, 5.0, 4.6, 1.6], [0, 7.6, 6.2, 2.0], [8, 9.6, 7.4, 2.4], [16, 8.4, 6.6, 2.6], [22, 5.4, 4.6, 2.8], [26, 6.0, 4.6, 3.2], [31, 8.6, 5.8, 3.4], [36, 8.2, 5.2, 3.0], [40, 6.0, 3.8, 2.4], [42.6, 3.8, 2.7, 2.0]], 0.8);
  fleshB(B, M, P, { segs: [-40, -35, -30, -25, -20, -15, -10, -4.5, 4, 12, 20, 24], groove: 0.09, gw: 0.9, nv: 84, nu: 30, T: 16 });
  const A = armor(B, M, P, -42, -8, 6, { span: 1.25, th: 1.0, lift: 1.0, ridge: 0.6, point: 2.0, T: 16, nu: 12 });
  const Tx = armor(B, M, P, -1, 19, 3, { span: 1.7, th: 1.2, lift: 1.0, ridge: 0.8, point: 2.2, T: 16, nu: 16 });
  const H = cap(B, M, P, 27, 42, { span: 1.45, th: 1.1, lift: 0.6, ridge: 1.0, point: 2.0, T: 16 });
  const AL = armor(B, M, P, -38, -12, 4, { c: 1.95, span: 0.4, th: 0.6, lift: 0.5, point: 1.0, T: 16, nu: 8 }), AR = armor(B, M, P, -38, -12, 4, { c: -1.95, span: 0.4, th: 0.6, lift: 0.5, point: 1.0, T: 16, nu: 8 });
  pores(B, M, A, [-0.5, 0, 0.5], 0.6, 0.5); pores(B, M, AL, [0], 0.5, 0.45, x.acid); pores(B, M, AR, [0], 0.5, 0.45, x.acid);
  A.forEach(pin => spike(B, M, pin(0, 0.3, -0.2), V(0, 1, -0.8), 2.6, 0.5, false));
  Tx.forEach(pin => { spike(B, M, pin(0.75, 0.4, -0.2), V(0.8, 0.8, -0.6), 3.4, 0.62); spike(B, M, pin(0, 0.3, -0.2), V(0, 1, -0.7), 2.4, 0.5, false); });
  gills(B, M, P, [-36.5, -31.5, -26.5, -21.5, -16.5], 1.2, 1.9, 0.3);
  for (let i = 0; i < 5; i++) { const r = -0.36 + i * 0.18; eye(B, M, H(r, 0.12 + Math.abs(r) * 0.3, -0.1), H.n(r, 0.15), 0.65, false, false); }
  eyeCluster(B, M, P, 38, 1.25, 5, 0.65, 51, 1.1); eyeCluster(B, M, P, 34, 1.5, 4, 0.6, 52, 1);
  B.flush(g);
  /* Kronenkragen: 13 Stacheln fächern vom Hinterkopf nach oben, außen und hinten, Haut dazwischen, leuchtende Spitzen */
  const crown = [], cr = V(0, 7.6, 31.5);
  for (let i = 0; i < 13; i++) { const a = -1.55 + i * 3.1 / 12, L = 31 - Math.abs(a) * 8, d = V(Math.sin(a) * 1.15, Math.cos(a) * 0.95 + 0.08, -0.72).normalize(); crown.push([[cr.x, cr.y, cr.z], [cr.x + d.x * L * 0.45, cr.y + d.y * L * 0.45 + 0.8, cr.z + d.z * L * 0.4], [cr.x + d.x * L, cr.y + d.y * L, cr.z + d.z * L - 1.5]]); }
  g.add(membrane(M, crown, { r: 1.0, nv: 8, sag: 0.3, seg: 10, rad: 6, mat: x.crest, tips: x.acid, tipR: 1.1 }));
  /* Schwingen */
  pair(g, membrane(M, [[[7, 9, 12], [22, 15, 10], [46, 19, 0]], [[7, 9, 12], [22, 13, 0], [42, 13, -16]], [[7, 9, 12], [18, 10, -8], [30, 8, -30]], [[7, 9, 12], [11, 8.5, -6], [13, 7, -24]]], { r: 0.7, nv: 12, seg: 10, rad: 6, sway: { axis: 'z', amp: 0.09, speed: 0.6 }, tips: x.glow, tipR: 0.7 }));
  pair(g, membrane(M, [[[7, 5, 6], [20, 4, 0], [36, 2, -12]], [[7, 5, 6], [18, 3, -10], [26, 1, -28]], [[7, 5, 6], [11, 3, -12], [13, 1.5, -27]]], { r: 0.55, nv: 10, seg: 10, rad: 6, sway: { axis: 'z', amp: 0.11, speed: 0.7, phase: 1.2 }, tips: x.glow, tipR: 0.55 }));
  [[-36, 2.25], [-30, 2.35], [-24, 2.3], [-18, 2.4], [-33, 2.75], [-27, 2.8], [-21, 2.75]].forEach(([z, a], i) => { for (const s of [-1, 1]) sacAt(g, x.sacPink, onB(P, z, s * a, -0.6), 1.7 - (i > 3 ? 0.3 : 0), [1, 0.85, 1.2], 0.06, 1.4 + i * 0.2, 10); });
  for (const s of [-1, 1]) sacAt(g, x.sac, V(s * 7.2, 5.2, 19.5), 1, [2.2, 2.6, 3.4], 0.07, 2 + s * 0.3, 14);
  const m = maw(M, 3.6, 2.6, 4.5, { teeth: 12, rows: 2, tl: 0.5 }); m.position.set(0, 2.0, 42.5); g.add(m);
  pair(g, mandible(M, V(4.0, 1.4, 40), [[4.0, 1.4, 40], [9.4, 1.1, 43.8], [9.0, 0.8, 48.4], [3.6, 0.6, 51.0]], 1.7, { teeth: 6, amp: 0.1, speed: 1.4, seg: 14, rad: 7 }));
  for (const s of [-1, 1]) { const t = spitTube(M, 0.85, 3.4); t.position.set(s * 3.6, -0.6, 37.6); g.add(t); }
  [[-1.6, 3.6], [1.6, 3.6], [-0.8, 1.6], [0.8, 1.6]].forEach(([tx, ty], i) => g.add(tentacle(M, V(tx, ty, -44.5), [[tx, ty, -44.5], [tx * 2.2, ty - 0.4, -48], [tx * 3.4, ty - 1.4, -51.5], [tx * 3.6, ty - 2.4, -54]], 0.75, { phase: i * 1.1, amp: 0.22, speed: 1.0, tip: x.glow, tipR: 0.45, seg: 12, rad: 6 })));
  return g;
});

/* ===================================================================== BROODMOTHER */
/* Brutmutter wie eine Ameisenkönigin: Kopf und Brust vorn auf Insektenbeinen, dünne Taille, dahinter ein riesiger,
   nach hinten angehobener durchscheinender Brutsack (Gaster) mit Panzerbändern und Schwarmlingen vor leuchtendem Kern,
   Geburtsöffnung am Ende, zwei Schulter-Speirohre */
register('broodmother', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-1.5, 0, 0, 1.4], [-0.8, 1.5, 1.5, 1.3], [1.2, 2.0, 2.0, 1.1], [3.2, 3.6, 3.2, 1.0], [7, 4.8, 3.9, 0.9], [10.5, 4.4, 3.5, 1.1], [13.2, 3.0, 2.6, 1.5], [15.8, 3.8, 3.0, 2.0], [18.8, 3.5, 2.7, 2.0], [20.8, 2.1, 1.7, 1.8]], 0.8);
  fleshB(B, M, P, { segs: [2.4, 5, 8, 11, 13.6, 17], groove: 0.1, gw: 0.45, nv: 40, nu: 20, T: 9 });
  const Th = armor(B, M, P, 3, 12.5, 3, { span: 1.45, th: 0.5, lift: 0.4, ridge: 0.35, point: 1.0, T: 9 });
  const Hd = cap(B, M, P, 14.2, 20.6, { span: 1.3, th: 0.45, lift: 0.25, ridge: 0.4, point: 0.9, T: 9 });
  Th.forEach(pin => { spike(B, M, pin(0, 0.3, -0.05), V(0, 1, -0.7), 1.5, 0.28, false); spike(B, M, pin(0.8, 0.45, -0.05), V(1, 0.5, -0.6), 1.2, 0.22); });
  pores(B, M, Th, [-0.55, 0.55], 0.5, 0.22);
  spike(B, M, Hd(0.35, 0.4, -0.1), V(0.3, 1, -0.6), 1.6, 0.3);
  eyeCluster(B, M, P, 18.4, 1.25, 5, 0.36, 61, 1); eye(B, M, Hd(0.45, 0.12, 0), Hd.n(0.45, 0.12), 0.32);
  /* Insektenbeine */
  [[9.5, 0.25], [6.5, 0], [3.8, -0.3]].forEach(([z, k]) => { const p = onB(P, z, 2.0, -0.3); horn(B, M, [[p.x, p.y, p.z], [p.x + 3.0, p.y + 1.6, p.z + k * 3], [p.x + 5.2, p.y - 1.0, p.z + k * 4], [p.x + 6.0, p.y - 4.6, p.z + k * 5 - 1.2]], 0.5, 0.2, { mat: x.chitin, seg: 12, rad: 6, c0: 0.5, c1: [1.5, 1.2, 1.5] }); });
  B.flush(g);
  /* Gaster: alles in einer atmenden Gruppe, Heck angehoben */
  const ga = new THREE.Group(), GB = new Bag(), sr = [8.6, 7.4, 13.5], Ps = ellP(0, sr[0] + 0.15, sr[1] + 0.15, sr[2] + 0.15, 0, 12);
  const R = armor(GB, M, Ps, -11, 11.5, 6, { span: 0.75, th: 0.7, lift: 0.6, ridge: 0.45, point: 1.2, T: 9, nu: 10 });
  R.forEach(pin => spike(GB, M, pin(0, 0.3, -0.1), V(0, 1, -0.6), 2.0, 0.36, false));
  pores(GB, M, R, [-0.6, 0.6], 0.55, 0.26);
  for (const z of [-9.5, -4.5, 0.5, 5.5]) { const s = Ps(z); horn(GB, M, arc(0, 0, z, s.rx + 0.1, s.ry + 0.1, 2.35, 16), 0.42, 0.8, { sym: false, mat: x.chitin, c0: [1.3, 1.0, 1.3], c1: [1.3, 1.0, 1.3], rad: 6, seg: 16, pw: 1 }); }
  const ring = new THREE.TorusGeometry(1, 0.32, 8, 20); addColor(ring, () => [1.3, 1, 1.3]); GB.add(ring, x.chitin, T(0, 0, -13.4, 2.5, 2.3, 1.6));
  const disc = new THREE.CircleGeometry(2.3, 18); disc.rotateY(Math.PI); addColor(disc, () => 1); GB.add(disc, x.glow, T(0, 0, -13.2, 1, 0.92, 1));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a); fang(GB, M, V(ca * 2.7, sa * 2.5, -13.5), V(ca * 0.4, sa * 0.4, -1), V(-ca, -sa, 0), 1.7, 0.36, false); }
  GB.flush(ga);
  const core = mesh(sphG(14, 10), x.core, false); core.scale.set(5.8, 5.0, 9.6); core.renderOrder = 1; ga.add(core);
  const skin = mesh(sphG(24, 16), x.womb, false); skin.scale.set(...sr); skin.renderOrder = 4; ga.add(skin);
  const tpl = swarmling(M); [[-3.6, 1.6, 4.2, 0.6, 1.0], [3.2, -1.0, 5.0, -0.7, 0.95], [-2.4, -2.4, -3.2, 2.2, 0.9], [3.6, 2.4, -2.8, -2.4, 1.0], [0.2, 0.6, -8.4, 0.3, 0.85]].forEach(([ex, ey, ez, ry, s]) => { const e = tpl.clone(true); e.position.set(ex, ey, ez); e.rotation.set(0.5, ry, 0.9); e.scale.setScalar(s); e.traverse(o => { if (o.userData.sway) o.userData.sway.speed *= 0.3; }); ga.add(e); });
  for (const s of [-1, 1]) sacAt(ga, x.sacPink, V(s * 2.6, -6.6, -5), 1.4, [1, 0.8, 1.3], 0.12, 2.4 + s * 0.3, 12);
  ga.position.set(0, 3.4, -11.2); ga.rotation.x = -0.14; ga.userData.pulse = { amp: 0.025, speed: 1.0, base: 1 }; g.add(ga);
  /* Taille und Haltetentakel */
  const W = new Bag(); horn(W, M, [[0, 1.2, 1.4], [0, 2.0, -0.6], [0, 2.8, -2.6]], 1.6, 1.0, { mat: x.flesh, c0: 0.7, c1: 0.7, wob: 0.06, rad: 8, seg: 6, sym: false });
  for (const s of [-1, 1]) horn(W, M, [[s * 2.6, 2.4, 3], [s * 5.4, 5.4, 0], [s * 6.4, 7.8, -4]], 0.45, 0.35, { mat: x.flesh, c0: 0.6, c1: 0.9, wob: 0.1, rad: 6, seg: 8, sym: false }); W.flush(g);
  const m = maw(M, 1.8, 1.4, 2.4, { teeth: 9, tl: 0.6 }); m.position.set(0, 1.6, 20.7); g.add(m);
  pair(g, mandible(M, V(1.8, 1.2, 19.6), [[1.8, 1.2, 19.6], [3.6, 1.0, 21.4], [3.2, 0.8, 23.6], [1.3, 0.6, 24.6]], 0.6, { teeth: 3, seg: 10, rad: 6 }));
  for (const s of [-1, 1]) { const t = spitTube(M, 0.6, 2.8); t.position.set(s * 3.8, 3.4, 10.5); g.add(t); }
  return g;
});

/* ===================================================================== PLAGUEBEARER */
/* Seuchenträger: buckliger, beuliger Leib, zwei gebogene Muskel-Parasitenwerfer auf den Schultern, aufgeblähte Giftblasen,
   Eiterpusteln, Säuretropfen */
register('plaguebearer', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-22, 0, 0, 0.8], [-21, 1.8, 1.6, 0.8], [-16, 4.8, 4.0, 0.9], [-8, 6.6, 5.4, 1.0], [0, 6.8, 5.4, 0.8], [7, 6.0, 4.8, 0.4], [12, 4.6, 3.8, 0], [15.5, 3.8, 3.2, -0.4], [18.5, 3.2, 2.7, -0.8], [20, 2.4, 2.0, -1.0]], 0.75);
  fleshB(B, M, P, { segs: [-17, -13, -9, -5, -1, 3, 7, 11, 15], groove: 0.08, gw: 0.6, nv: 54, nu: 26, T: 10, noise: 0.08 });
  const L = armor(B, M, P, -17, 6, 4, { c: 1.5, span: 0.55, th: 0.45, lift: 0.4, ridge: 0.15, point: 0.8, T: 10, nu: 10 }); armor(B, M, P, -17, 6, 4, { c: -1.5, span: 0.55, th: 0.45, lift: 0.4, ridge: 0.15, point: 0.8, T: 10, nu: 10 });
  const H = cap(B, M, P, 11.5, 19.6, { span: 1.3, th: 0.5, lift: 0.3, ridge: 0.45, point: 1.2, T: 10 });
  cap(B, M, P, 4, 10.5, { span: 0.7, th: 0.5, lift: 0.45, ridge: 0.4, point: 1.0, T: 10 });
  L.forEach(pin => spike(B, M, pin(0.7, 0.35, -0.1), V(1, 0.1, -0.8), 1.5, 0.28));
  for (const s of [-1, 1]) spike(B, M, H(s * 0.5, 0.5, -0.1), V(s * 0.6, 1, -0.6), 1.6, 0.3, false);
  eyeCluster(B, M, P, 17.8, 1.3, 4, 0.32, 71, 1); eye(B, M, H(0.45, 0.15, 0), H.n(0.45, 0.15), 0.3);
  drip(B, M, V(5.8, -4.6, -7.2), 0.32); drip(B, M, V(-5.6, -4.6, -6.0), 0.28); drip(B, M, V(0.6, -3.3, 18.4), 0.22);
  const q = rng(73); for (let i = 0; i < 22; i++) { const z = -16 + q() * 30, a = (q() < 0.5 ? -1 : 1) * (0.9 + q() * 1.2), p = onB(P, z, a, -0.08); B.add(sphG(7, 5), x.acid, T(p.x, p.y, p.z, 0.18 + q() * 0.2)); }
  B.flush(g);
  /* Werfer auf den Schultern, leicht gespreizt */
  const w = launcher(M, 15, 1.55, 2); w.position.set(4.9, 4.6, 0.5); w.rotation.set(-0.04, 0.07, -0.12); pair(g, w);
  for (const s of [-1, 1]) sacAt(g, x.flesh, V(s * 4.6, 3.8, 0.8), 2.4, [1, 0.75, 1.3], 0.03, 1.2, 12);
  /* Giftblasen */
  [[0, 7.1, -6.5, 3.4, [1.1, 0.9, 1.3]], [3.8, 6.0, -12.5, 2.5, [1, 0.9, 1.2]], [-3.6, 6.3, -11.6, 2.7, [1, 0.9, 1.2]], [0, 5.3, -15.8, 2.0, [1, 0.9, 1.1]], [6.0, -1.8, -7.5, 2.4, [1, 1.15, 1.1]], [-5.8, -2.0, -6.0, 2.2, [1, 1.15, 1.1]], [-6.2, 3.2, -1.5, 1.6, [1, 1, 1]], [6.4, 3.0, -2.5, 1.4, [1, 1, 1]]].forEach(([sx, sy, sz, r, s], i) => sacAt(g, x.sac, V(sx, sy, sz), r, s, 0.07 + (i % 3) * 0.02, 1.2 + i * 0.37, 16));
  const m = maw(M, 2.3, 1.9, 3.2, { teeth: 10, tl: 0.55 }); m.position.set(0, -1.0, 19.9); g.add(m);
  pair(g, mandible(M, V(2.2, -1.6, 18.6), [[2.2, -1.6, 18.6], [3.6, -1.9, 20.6], [3.0, -2.1, 22.6], [1.3, -2.3, 23.2]], 0.55, { teeth: 3, seg: 10, rad: 6 }));
  [-1, 0, 1].forEach(s => g.add(tentacle(M, V(s * 1.6, 0.8, -20.6), [[s * 1.6, 0.8, -20.6], [s * 2.8, 0.2, -23], [s * 3.2, -0.8, -25.4]], 0.6, { phase: s * 1.5, amp: 0.28, speed: 1.2, tip: x.acid, tipR: 0.3, seg: 10, rad: 6 })));
  return g;
});

/* ===================================================================== BEHEMOTH */
/* Titan: gepanzerter Rammkoloss, drei Mäuler (Hauptrachen unter dem Rammschild mit Hörnern, zwei Nebenköpfe an den Schultern),
   Zwillings-Säuredrüsen im Knochenkranz, Schulterdornen */
function sideHead(M, seed) {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const Ph = prof([[-3, 3.6, 3.2, 0.2], [0, 4.6, 3.8, 0], [4, 5.0, 4.0, 0], [8, 4.4, 3.4, -0.2], [10.5, 3.4, 2.5, -0.4]], 0.8);
  fleshB(B, M, Ph, { nu: 18, nv: 16, segs: [1, 3.5, 6], T: 10 });
  const up = jaw(M, prof([[0, 5.2, 4.2, 0.1], [6, 4.8, 3.8, -0.1], [10, 3.8, 2.6, -0.6], [12.2, 1.6, 1.0, -1.0], [12.6, 0.2, 0.2, -1.0]]), 0, 12.6, { c: 0, span: 1.9, th: 1.1, ridge: 0.8, lift: 0.6, point: 1.4, teeth: 6, tl: 1.5, t0: 0.12, t1: 0.65, nu: 14, nv: 8, lip: [1.6, 1.15, 1.55] });
  g.add(up); const U = up.userData.pin;
  for (let i = 0; i < 3; i++) eye(B, M, U(0.62 + i * 0.09, 0.42 + i * 0.07, -0.1), U.n(0.62, 0.45), 0.5 - i * 0.08);
  horn(B, M, [[3.4, 3.2, 7], [4.8, 3.9, 10.5], [4.2, 3.4, 13.6]], 0.75, 0.05, { rad: 6, seg: 8 });
  B.flush(g);
  const m = maw(M, 2.9, 1.9, 3.5, { teeth: 9, tl: 0.5, lip: 0 }); m.position.set(0, -0.6, 10.4); g.add(m);
  const lo = jaw(M, prof([[0, 3.7, 1.7, 0], [3, 3.5, 1.5, 0], [5.4, 2.3, 0.9, 0.1], [6.5, 0.3, 0.3, 0.15]]), 0, 6.5, { span: 1.55, th: 0.7, ridge: 0.4, teeth: 5, tl: 1.1, front: 2, nu: 12, nv: 6 });
  const h = new THREE.Group(); h.position.set(0, -1.9, 6.4); h.add(lo); h.userData.sway = { axis: 'x', amp: 0.13, speed: 1.6, phase: seed, base: 0.4 }; h.rotation.x = 0.4; g.add(h);
  return g;
}
register('behemoth', M => {
  const g = new THREE.Group(), x = X(M), B = new Bag();
  const P = prof([[-42, 0, 0, 2], [-41, 2.6, 2.2, 2], [-36, 6.8, 5.4, 1.8], [-26, 11.2, 8.2, 1.2], [-12, 15.2, 10.4, 0.6], [2, 18.2, 11.4, 0.2], [14, 19.4, 11.6, 0], [22, 17.4, 10.4, -0.3], [27, 13.4, 8.6, -0.6], [29, 10.5, 7.6, -0.8]], 0.7);
  const segs = []; for (let z = -36; z <= 24; z += 6) segs.push(z);
  fleshB(B, M, P, { segs, groove: 0.07, gw: 1.1, nv: 60, nu: 28, T: 16 });
  const D = armor(B, M, P, -37, 21, 8, { span: 1.5, th: 1.8, lift: 1.6, ridge: 1.2, point: 3.4, T: 16, nu: 14, nv: 6 });
  const F1 = armor(B, M, P, -32, 18, 6, { c: 1.62, span: 0.36, th: 1.1, lift: 1.0, ridge: 0.3, point: 1.6, T: 16, nu: 6, nv: 5 }); armor(B, M, P, -32, 18, 6, { c: -1.62, span: 0.36, th: 1.1, lift: 1.0, ridge: 0.3, point: 1.6, T: 16, nu: 6, nv: 5 });
  armor(B, M, P, -28, 14, 5, { c: 2.1, span: 0.32, th: 0.9, lift: 0.8, point: 1.4, T: 16, nu: 6, nv: 5 }); armor(B, M, P, -28, 14, 5, { c: -2.1, span: 0.32, th: 0.9, lift: 0.8, point: 1.4, T: 16, nu: 6, nv: 5 });
  D.forEach((pin, i) => { if (i < 2 || i > 4) spike(B, M, pin(0, 0.25, -0.2), V(0, 1, -0.6), 5.4 - Math.abs(i - 3) * 0.45, 1.05, false); spike(B, M, pin(0.62, 0.4, -0.2), V(0.6, 0.9, -0.7), 2.8, 0.6); });
  F1.forEach(pin => spike(B, M, pin(0.3, 0.4, -0.2), V(1, 0.15, -0.7), 3.0, 0.6));
  pores(B, M, D, [-0.42, 0.42], 0.6, 0.48);
  /* Rammschild (Oberkiefer) mit Hörnern */
  const Pu = prof([[23, 12.8, 9.2, -0.3], [29, 11.6, 8.0, -0.8], [34, 10.2, 6.6, -1.4], [38.5, 7.8, 4.6, -2.0], [41, 4.4, 2.6, -2.4], [42, 0.4, 0.4, -2.5]]);
  const up = jaw(M, Pu, 23, 42, { c: 0, span: 1.9, th: 2.2, ridge: 1.6, lift: 1.0, point: 2.4, teeth: 9, tl: 2.8, t0: 0.08, t1: 0.65, nu: 18, nv: 10, prof: t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.25))), 0.4), lip: [1.6, 1.15, 1.55] });
  g.add(up); const U = up.userData.pin;
  for (let i = 0; i < 3; i++) eye(B, M, U(0.55 + i * 0.1, 0.45 + i * 0.05, -0.15), U.n(0.55, 0.45), 0.8 - i * 0.15);
  horn(B, M, [[6.2, 3.8, 30.5], [9.0, 4.8, 36.5], [8.8, 3.6, 42.5], [6.2, 1.6, 47]], 2.4, 0.04);
  horn(B, M, [[0, 6.6, 33.5], [0, 8.6, 38.5], [0, 8.0, 44]], 1.6, 0.05, { sym: false });
  /* Zwillings-Säuredrüsen im Knochenkranz, über den Platten */
  /* Zwillingsdrüsen hintereinander auf dem Rückgrat, je zwei Knochenspangen mit Dornen */
  for (const [gz, gy] of [[0, 15.6], [-12.5, 15.0]]) for (const dz of [-2, 2]) { const k = Math.sqrt(1 - (dz / 5.6) ** 2); horn(B, M, arc(0, gy, gz + dz, 4.0 * k + 0.5, 3.2 * k + 0.5, 1.75, 12), 0.5, 0.75, { rad: 6, seg: 12, sym: false }); spike(B, M, V(0, gy + 3.2 * k + 0.9, gz + dz), V(0, 1, -0.4), 3.0, 0.55, false); for (const s of [-1, 1]) spike(B, M, V(s * (4.0 * k + 0.5) * Math.sin(1.75), gy + (3.2 * k + 0.5) * Math.cos(1.75), gz + dz), V(s, -0.1, -0.3), 2.2, 0.45, false); }
  /* Schulterdornen */
  spike(B, M, onB(P, 13, 1.4, 1.2), V(1, 0.3, -0.2), 12, 2.1); spike(B, M, onB(P, 3, 1.45, 1.2), V(1, 0.22, -0.45), 10, 1.8); spike(B, M, onB(P, -8, 1.5, 1.0), V(1, 0.15, -0.75), 7.5, 1.4); spike(B, M, onB(P, -19, 1.55, 0.8), V(1, 0.1, -1), 5.5, 1.1);
  pores(B, M, F1, [0], 0.55, 0.5, x.acid);
  B.flush(g);
  sacAt(g, x.sac, V(0, 15.6, 0), 1, [4.0, 3.2, 5.6], 0.05, 1.6, 16); sacAt(g, x.sac, V(0, 15.0, -12.5), 1, [4.0, 3.2, 5.6], 0.05, 1.9, 16);
  const m = maw(M, 8.6, 5.6, 10, { teeth: 14, rows: 2, tl: 0.32, lip: 0.08 }); m.position.set(0, -1.2, 29); g.add(m);
  const lo = jaw(M, prof([[0, 10.6, 4.4, 0], [6, 10, 4, 0.2], [11, 7.6, 3, 0.6], [14.5, 3.8, 1.6, 1.0], [15.6, 0.3, 0.3, 1.0]]), 0, 15.6, { span: 1.6, th: 1.8, ridge: 1.0, teeth: 9, tl: 2.6, front: 3, nu: 18, nv: 10 });
  const h = new THREE.Group(); h.position.set(0, -5.6, 25.5); h.add(lo); h.userData.sway = { axis: 'x', amp: 0.08, speed: 1.2, phase: 0, base: 0.32 }; h.rotation.x = 0.32; g.add(h);
  const sh = sideHead(M, 1); sh.position.set(16.5, -2.6, 21); sh.rotation.y = 0.42; pair(g, sh);
  [[0, 2.6, -42], [-3.4, 0.6, -40], [3.4, 0.6, -40]].forEach(([sx, sy, sz], i) => sacAt(g, x.sacPink, V(sx, sy, sz), 2.0 - (i ? 0.4 : 0), [1, 0.85, 1.25], 0.1, 2 + i * 0.4, 12));
  pair(g, membrane(M, [[[3, 2.4, -38], [8, 3.6, -42], [12, 4.4, -44.5]], [[3, 2.4, -38], [7, 2.4, -43.5], [8.5, 1.8, -46.5]], [[3, 2.4, -38], [4, 1.8, -43], [3.6, 1.2, -46.5]]], { r: 0.5, nv: 6, seg: 8, rad: 5, sway: { axis: 'y', amp: 0.12, speed: 1.0 } }));
  return g;
});

export default register;
export { X, Geo, Bag, merge, place, T, addColor, sphG, coneG, fangG, domeG, prof, ellP, onB, nrm, shell, armor, cap, pores, tubeC, sweep, horn, arc, pulseG, mir, pair, sac, sacAt, eye, spike, fang, drip, maw, jaw, mandible, tentacle, membrane, spitTube, vent, pod, stand, swarmling, veinCanvas, cnv, ctex, tintC, I0 }; /* Bausteine für die Nester (stations/brood.js) */
