/* =====================================================================
   MARTIAN REPUBLIC – Stationen. Formensprache: Mars baut in Asteroiden. Unter jeder Station liegt ein Felsbrocken
   (verschobene Ikosphäre mit Kratern, rotbraun-grau), oben plan gefräst; der Rand der Fräsfläche bleibt als
   zackiger Felskragen stehen, die Station sitzt also im Fels wie in einer Mulde. Darauf und hinein gebaut:
   verschraubte Stahlmodule mit kleinen Fasen (wie die Schiffsrümpfe), Achteck-Bauten mit schrägen Wänden
   (Brutalismus), offenes Fachwerk, Rohrleitungen, Kühlrippen mit Restglut, Warnstreifen, rostrote Akzente,
   Bohrtürme und Förderanlagen, Scheinwerfer und warme, orangefarbene Fensterbänder. Teamfarbe (M.trim) als
   Dachstreifen und Leuchten, damit man die Gebäude eines Spielers auch von oben erkennt. Waffen wie auf den
   Schiffen: Autokanonen, Railguns, PDC-Türme. Ruhige Animation: Schüsseln und Ringe drehen langsam,
   Positionslichter leuchten stetig oder pulsieren sacht.
   Mitte im Ursprung, oben +Y, Deckhöhe y ≈ 0, Grundfläche im Kreis d.r.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerB, loft, oct, cyl, at, mesh, rng, uvScale } from '../kit.js';
import { xm, mm, bar, beam, truss, hazUV, hazBar, hazBeam, pdc, cannon, rail, radPanel, finArray, lamp, oct2, flat, dfont } from '../factions/mars.js';

const PI = Math.PI, HP = PI / 2, TAU = PI * 2, V3 = THREE.Vector3;
const UVS = 1 / 16;   /* Plattengröße der Rumpftextur auf Stationen (wie auf den Schiffen) */

function cnv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------ Zusatzmaterialien (einmal je Materialsatz) */
const SC = new WeakMap();
function sm(M) {
  let S = SC.get(M); if (S) return S;
  const basic = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  const rust = M.hull.clone(); rust.color = new THREE.Color('#c27052');
  const rust2 = M.hull2.clone(); rust2.color = new THREE.Color('#e08a66');
  S = {
    rust, rust2,
    deck: Object.assign(M.hull2.clone(), { color: new THREE.Color('#e2c4a6'), roughness: 0.85, metalness: 0.25 }),
    bay: basic('#ff9a4a', 0.72),
    team: new THREE.MeshBasicMaterial({ color: M.trim.color.clone().multiplyScalar(1.9) }),
    flood: basic('#ffe2b8', 2.2),
    plasma: basic('#b4dcff', 1.75),
    plasmaSoft: basic('#7fb4ff', 1.1),
    melt: basic('#ff7a2a', 1.7),
    coil: basic('#9fd0ff', 1.9),
    coilDim: basic('#8cc4ff', 1.05),
    coilHot: basic('#e4f2ff', 2.1),
    ice: xm(M).ice,
    cable: new THREE.MeshStandardMaterial({ color: '#1c1a18', metalness: 0.3, roughness: 0.8 })
  };
  SC.set(M, S); return S;
}

/* ------------------------------------------------------------ Rauschen (für Asteroiden) */
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1911520717); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0; for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; r += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return r * 2 - 1;
}
function fbm(x, y, z, s, n = 4) { let a = 0.5, f = 1, t = 0; for (let i = 0; i < n; i++) { t += a * vnoise(x * f, y * f, z * f, s + i * 31); a *= 0.5; f *= 2.07; } return t; }

/* ------------------------------------------------------------ Asteroid
   Ikosphäre (einmal je Form zwischengespeichert), Rauschen + Krater (Mulde mit Wall), oben plan gefräst mit
   stehen gebliebenem, zackigem Felskragen; optional weitere Schnittebenen (Werft: gespaltener Fels).
   Farben je Ecke (rostrot/grau, Kraterböden dunkel, Fräsfläche staubig hell), Körnung als Textur. */
const RC = {};
function rockMat() {
  return RC._mat || (RC._mat = (() => {
    const r = rng(77), S = 256;
    const c = cnv(S, S, (x) => {
      x.fillStyle = '#c4bdb5'; x.fillRect(0, 0, S, S);
      const wrap = (f) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
      for (let i = 0; i < 420; i++) { const cx = r() * S, cy = r() * S, rx = 3 + r() * 16, ry = rx * (0.4 + r() * 0.6), rot = r() * 3, v = 120 + r() * 120 | 0, a = 0.2 + r() * 0.35; wrap((dx, dy) => { x.fillStyle = `rgba(${v},${v - 6},${v - 12},${a})`; x.beginPath(); x.ellipse(cx + dx, cy + dy, rx, ry, rot, 0, 7); x.fill(); }); }
      for (let i = 0; i < 140; i++) { const cx = r() * S, cy = r() * S, cr = 1 + r() * 4; wrap((dx, dy) => { x.fillStyle = 'rgba(40,34,30,0.55)'; x.beginPath(); x.arc(cx + dx, cy + dy, cr, 0, 7); x.fill(); x.fillStyle = 'rgba(235,225,212,0.35)'; x.beginPath(); x.arc(cx + dx + cr * 0.35, cy + dy + cr * 0.35, cr * 0.55, 0, 7); x.fill(); }); }
      x.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const pts = [[r() * S, r() * S]]; for (let k = 0; k < 5; k++) pts.push([pts[k][0] + (r() - 0.5) * 40, pts[k][1] + (r() - 0.5) * 40]); const lw = 0.6 + r() * 1.2; wrap((dx, dy) => { x.strokeStyle = 'rgba(30,26,22,0.5)'; x.lineWidth = lw; x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px + dx, py + dy) : x.moveTo(px + dx, py + dy)); x.stroke(); }); }
      const d = x.getImageData(0, 0, S, S), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 34; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
    });
    return new THREE.MeshStandardMaterial({ map: ctex(c), bumpMap: ctex(c, false), bumpScale: 1.6, vertexColors: true, metalness: 0.05, roughness: 0.93 });
  })());
}
function rockGeo(o) {
  const key = JSON.stringify(o); if (RC[key]) return RC[key];
  let g = new THREE.IcosahedronGeometry(1, o.det || 12); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-5);
  const p = g.attributes.position, n = p.count, r = rng(o.seed), v = new V3();
  const cr = []; for (let i = 0; i < (o.craters ?? 7); i++) { const a = r() * TAU, y = -0.45 + r() * 0.85, s = Math.sqrt(1 - y * y); cr.push({ d: new V3(Math.cos(a) * s, y, Math.sin(a) * s), rad: 0.1 + r() * 0.2, dep: 0.6 + r() * 0.5 }); }
  const cRust = new THREE.Color('#74412e'), cGrey = new THREE.Color('#58534e'), cDark = new THREE.Color('#3a3330'), cDust = new THREE.Color('#8a7f74'), tmp = new THREE.Color();
  const col = new Float32Array(n * 3), amp = o.amp ?? 0.2;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 1 + fbm(v.x * 1.3, v.y * 1.3, v.z * 1.3, o.seed, 3) * amp + fbm(v.x * 3.6, v.y * 3.6, v.z * 3.6, o.seed + 2, 3) * amp * 0.38 + fbm(v.x * 9, v.y * 9, v.z * 9, o.seed + 5, 2) * 0.03, shade = 1;
    const crev = vnoise(v.x * 11, v.y * 11, v.z * 11, o.seed + 13); if (crev > 0.45) { h -= (crev - 0.45) * 0.05; shade *= 1 - (crev - 0.45) * 0.9; }
    for (const c of cr) {
      const t = Math.acos(clamp(v.dot(c.d), -1, 1)) / c.rad; if (t > 1.6) continue;
      if (t < 1) { h -= c.dep * c.rad * 0.32 * (1 - t * t); shade *= 0.72 + 0.28 * t; }
      const w = Math.exp(-(((t - 1) / 0.24) ** 2)); h += c.dep * c.rad * 0.11 * w; shade *= 1 + 0.2 * w;
    }
    let x = v.x * h * o.rx, y = v.y * h * o.ry + (o.cy || 0), z = v.z * h * o.rz, cut = 0;
    /* plan gefräste Oberseite mit Felskragen */
    if (o.top !== undefined && y > o.top) {
      const rho = Math.hypot(x / o.rx, z / o.rz), t = clamp((rho - (o.rimIn ?? 0.62)) / ((o.rimOut ?? 0.9) - (o.rimIn ?? 0.62)), 0, 1);
      const nz = clamp(0.45 + 0.8 * vnoise(v.x * 4, v.y * 4, v.z * 4, o.seed + 9) + 0.35 * vnoise(v.x * 13, v.y * 13, v.z * 13, o.seed + 4), 0, 1.2);
      y = o.top + (o.rim || 0) * t * t * (3 - 2 * t) * nz + vnoise(x * 0.25, 1, z * 0.25, o.seed + 3) * 0.12 * (1 - t); cut = 1 - t * 0.6;
    }
    /* weitere Schnittebenen: {n: [x, y, z] (nach außen), d} – was jenseits liegt, wird auf die Ebene gelegt */
    for (const pl of o.planes || []) { const s = x * pl.n[0] + y * pl.n[1] + z * pl.n[2] - pl.d; if (s > 0) { x -= s * pl.n[0]; y -= s * pl.n[1]; z -= s * pl.n[2]; cut = Math.max(cut, 0.8); } }
    p.setXYZ(i, x, y, z);
    const m = clamp(0.42 + fbm(v.x * 2.2 + 3, v.y * 2.2, v.z * 2.2, o.seed + 21, 3) * 1.8, 0, 1), dk = clamp(fbm(v.x * 4.5, v.y * 4.5 + 7, v.z * 4.5, o.seed + 33, 2) * 2.2, 0, 0.7);
    tmp.copy(cGrey).lerp(cRust, m).lerp(cDark, dk).lerp(cDust, cut * 0.7).multiplyScalar(shade * clamp(0.85 + (h - 1) * 1.6, 0.5, 1.2) * (v.y < -0.4 ? 0.8 : 1));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g = g.toNonIndexed();
  /* Texturkoordinaten je Dreieck nach seiner Hauptrichtung (Würfelprojektion), 9 Einheiten je Kachel */
  const P = g.attributes.position, uv = new Float32Array(P.count * 2), a = new V3(), b = new V3(), c = new V3(), k = 1 / 9;
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    const nn = b.clone().sub(a).cross(c.clone().sub(a)), ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (let j = 0; j < 3; j++) { const q = [a, b, c][j]; const [u, w] = ax >= ay && ax >= az ? [q.z, q.y] : ay >= az ? [q.x, q.z] : [q.x, q.y]; uv[(i + j) * 2] = u * k; uv[(i + j) * 2 + 1] = w * k; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return (RC[key] = g);
}
function rock(o) { return mesh(rockGeo(o), rockMat()); }
/* kleiner Felsbrocken (liegt auf oder steckt im Fels) */
function boulder(s, seed, sy = 0.7) { return rock({ rx: s, ry: s * sy, rz: s * (0.8 + (seed % 5) * 0.08), seed, det: 3, craters: 1, amp: 0.35 }); }

/* ------------------------------------------------------------ Zusammenbacken
   wie bake der Schiffe, aber mit den Kennzeichen der Stationen als Grenzen (aim, charge, chargeAt, berth, dock)
   und mit Eckfarben (Fels). */
const ANIMB = ['flame', 'blink', 'spin', 'pulse', 'orbit', 'bob', 'sway', 'turret', 'aim', 'charge', 'chargeAt', 'berth', 'dock'];
function bakeB(root) {
  const isB = o => o === root || ANIMB.some(k => o.userData[k] !== undefined && o.userData[k] !== false);
  const owner = o => { let p = o.parent; while (p && !isB(p)) p = p.parent; return p; };
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh || isB(o) || o.children.length || (o.material.transparent && !o.material.depthWrite)) return;
    const b = owner(o); if (!buckets.has(b)) buckets.set(b, new Map());
    const mm2 = buckets.get(b), k = o.material.uuid; if (!mm2.has(k)) mm2.set(k, { mat: o.material, items: [] });
    mm2.get(k).items.push(o);
  });
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const [b, mm2] of buckets) {
    inv.copy(b.matrixWorld).invert();
    for (const { mat, items } of mm2.values()) {
      if (items.length < 2) continue;
      const keepCol = items.every(o => o.geometry.attributes.color);
      let shadow = false;
      const geos = items.map(o => {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv' && !(keepCol && n === 'color')) g.deleteAttribute(n);
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
/* registerB mit Mars-Materialsatz und Backen */
const regB = (role, fn) => registerB('mars', role, (M0, d, lv) => bakeB(fn(mm(M0), d, lv)));

/* ------------------------------------------------------------ Grundformen */
/* Kasten mit kleiner Fase an allen Kanten (64 Dreiecke); fw/fh verjüngen die Vorderseite (+Z) */
function sl(w, h, d, mat, c = Math.min(w, h, d) * 0.15, fw = 1, fh = 1) {
  c = Math.min(c, w / 2 - 0.02, h / 2 - 0.02, d / 2 - 0.02, w * fw / 2 - 0.02, h * fh / 2 - 0.02);
  const S = (z, W, Hh, cc) => ({ z, pts: oct(Math.max(0.05, W), Math.max(0.05, Hh), cc) });
  return loft([S(-d / 2, w - 2 * c, h - 2 * c, 0.02), S(-d / 2 + c, w, h, c), S(d / 2 - c, w * fw, h * fh, c), S(d / 2, w * fw - 2 * c, h * fh - 2 * c, 0.02)], mat, { uv: UVS });
}
/* Kasten, dessen Unterkante auf y liegt */
const slab0 = (w, h, d, mat, x, y, z, c) => at(sl(w, h, d, mat, c), x, y + h / 2, z);
/* Drehkörper mit n Facetten (flach schattiert), prof = [[r, y], …] wie kit.lathe (außen unten → oben, Deckel nach innen) */
function prism(prof, mat, n = 8, phi0 = PI / n) {
  let geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), n, phi0).toNonIndexed(); geo.computeVertexNormals();
  let rmax = 0, len = 0; prof.forEach(([r, y], i) => { rmax = Math.max(rmax, r); if (i) len += Math.hypot(r - prof[i - 1][0], y - prof[i - 1][1]); });
  uvScale(geo, Math.max(0.1, TAU * rmax * UVS), Math.max(0.1, len * UVS));
  return mesh(geo, mat);
}
/* Ring (Querschnitt Rechteck) als Prisma, optional mit Warnstreifen */
function ring(ri, ro, y0, y1, mat, n = 8, haz = 0) { const m = prism([[ri, y0], [ro, y0], [ro, y1], [ri, y1], [ri, y0]], mat, n); if (haz) hazUV(m.geometry, haz); return m; }
/* Zylinder zwischen zwei Punkten (Rohr, Mast) */
function tubeAB(a, b, r, mat, seg = 8) { const A = new V3(...a), B = new V3(...b), dd = B.clone().sub(A); const m = cyl(r, r, dd.length(), mat, seg); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), dd.normalize()); return m; }
/* Rohrleitung über mehrere Punkte mit Flanschen an den Knicken */
function pipe(g, pts, r, mat, fl) { for (let i = 0; i < pts.length - 1; i++) g.add(tubeAB(pts[i], pts[i + 1], r, mat, 8)); if (fl) for (let i = 0; i < pts.length; i++) g.add(at(sl(r * 2.8, r * 2.8, r * 2.8, fl, r * 0.6), ...pts[i])); }
/* Fensterband: Ebene mit Normale +Z; rows = 1 (Schlitz) oder 2 (zwei Reihen) */
function win(M, len, h = 0.5, dens = 0.6, rows = 1) {
  const geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv, v0 = rows > 1 ? 0.6 : 0.835;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 22 * dens, v0 + uv.getY(i) * (0.9 - v0));
  return mesh(geo, M.windows, false);
}
/* Fensterband auf den Seiten eines n-Prismas (Umkreisradius R) */
function prismWin(g, M, R, y, h, n = 8, frac = 0.62, rows = 1, skip = []) {
  const ap = R * Math.cos(PI / n), side = 2 * R * Math.sin(PI / n);
  for (let k = 0; k < n; k++) { if (skip.includes(k)) continue; const a = k * TAU / n, w = win(M, side * frac, h, 0.6, rows); w.position.set(Math.sin(a) * (ap + 0.04), y, Math.cos(a) * (ap + 0.04)); w.rotation.y = a; g.add(w); }
}
/* Fensterband an einer Kastenseite: x, y, z Mitte, Blickrichtung a (0 = +Z) */
function winAt(g, M, len, h, x, y, z, a, rows = 1, dens = 0.6) { const w = win(M, len, h, dens, rows); w.position.set(x, y, z); w.rotation.y = a; g.add(w); return w; }
/* Aufschrift, flach auf einer Oberseite, Schriftoben nach −Z (liest sich aus der Spielkamera), yaw dreht */
const LB = new Map();
function label(txt, w, h, col = '#e6dccb') {
  let m = LB.get(txt + col);
  if (!m) {
    const c = cnv(512, 128, (x, cw, ch) => { x.fillStyle = col; x.font = dfont(txt); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, cw / 2, ch / 2 + 4); });
    m = new THREE.MeshStandardMaterial({ map: ctex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, metalness: 0.2, roughness: 0.6 }); LB.set(txt + col, m);
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}
function onTop(o, x, y, z, yaw = 0) { o.rotation.order = 'YXZ'; o.rotation.set(-HP, yaw, 0); o.position.set(x, y, z); return o; }
function topLabel(g, txt, x, y, z, h, yaw = 0, col) { g.add(onTop(label(txt, h * 4.4, h, col), x, y + 0.04, z, yaw)); }
function topEmblem(g, M, x, y, z, r, yaw = 0) { g.add(onTop(new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), xm(M).emblem), x, y + 0.05, z, yaw)); }
/* Lampe (stetig) und sacht pulsierendes Licht */
function lampAt(g, M, x, y, z, r = 0.3) { g.add(at(lamp(M, r), x, y, z)); }
function beacon(g, mat, x, y, z, r = 0.35, speed = 1.1) { const m = mesh(new THREE.SphereGeometry(r, 8, 6), mat, false); m.position.set(x, y, z); m.userData.pulse = { amp: 0.28, speed }; g.add(m); return m; }
/* Scheinwerfer: Gehäuse mit Leuchtscheibe, Blick nach +Z (gekippt um tilt) */
function flood(M, S, s = 1, tilt = 0.5) {
  const g = new THREE.Group(), h = new THREE.Group();
  h.add(sl(s * 1.4, s * 0.9, s * 0.9, M.dark, s * 0.15));
  h.add(at(bar(s * 1.1, s * 0.6, s * 0.06, S.flood), 0, 0, s * 0.46));
  h.rotation.x = tilt; h.position.y = s * 0.9; g.add(h);
  g.add(at(bar(s * 0.25, s * 0.9, s * 0.25, M.dark), 0, s * 0.45, -s * 0.2));
  return g;
}
/* kleine Aufbauten aus scharfen Quadern auf einer Fläche */
function greeb(M, g, x0, x1, z0, z1, y, n, seed, size = 1, mats) { const r = rng(seed); for (let i = 0; i < n; i++) { const w = size * (0.4 + r()), dd = size * (0.5 + r() * 1.5), h = size * (0.2 + r() * 0.5); const mt = mats ? mats[r() * mats.length | 0] : r() < 0.35 ? M.dark : M.hull2; g.add(at(bar(w, h, dd, mt), x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0))); } }
/* Objekt bei Winkel a (0 = +Z, π/2 = +X) im Abstand dist aufstellen, lokales +Z zeigt nach außen */
function place(g, o, a, dist, y = 0) { o.position.set(Math.sin(a) * dist, y, Math.cos(a) * dist); o.rotation.y = a; g.add(o); return o; }
const pol = (a, dist, y = 0) => [Math.sin(a) * dist, y, Math.cos(a) * dist];
/* Geschütz der Schiffe als Stationsgeschütz: schwenkt über userData.aim statt sway */
function aimed(o, phase, base = 0) { delete o.userData.sway; o.userData.aim = { phase, base }; return o; }
/* Container: Wellblech-Kasten mit Rahmen */
function container(M, S, w, h, d, kind) { const g = new THREE.Group(), mat = [S.rust, M.hull2, M.hull, S.rust2][kind % 4]; g.add(at(sl(w, h, d, mat, 0.08), 0, h / 2, 0)); for (const s of [-1, 1]) g.add(at(bar(w + 0.08, h + 0.08, 0.16, M.dark), 0, h / 2, s * (d / 2 - 0.08))); return g; }
/* Ankerstrebe vom Bauwerk schräg in den Fels mit Fußplatte */
function anchor(g, M, a, b, t = 0.7) { g.add(beam(a, b, t, M.dark)); g.add(at(sl(t * 2.6, t * 1.2, t * 2.6, M.hull2, t * 0.3), b[0], b[1], b[2])); }
/* Gittermast entlang +Y: vier Eckstiele (Fuß w0, Kopf w1), Riegel, Diagonalen */
function lattice(M, h, w0, w1, bays, t = 0.2, mat = M.dark) {
  const g = new THREE.Group(), P = (sx, sz, y) => { const w = (w0 + (w1 - w0) * y / h) / 2; return [sx * w, y, sz * w]; };
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [sx, sz] of C) g.add(beam(P(sx, sz, 0), P(sx, sz, h), t * 1.5, mat));
  for (let i = 0; i <= bays; i++) { const y = h * i / bays; for (let k = 0; k < 4; k++) { const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4]; g.add(beam(P(ax, az, y), P(bx, bz, y), t, mat)); } }
  for (let i = 0; i < bays; i++) { const y0 = h * i / bays, y1 = h * (i + 1) / bays; for (let k = 0; k < 4; k++) { const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4], f = (i + k) % 2; g.add(beam(P(f ? ax : bx, f ? az : bz, y0), P(f ? bx : ax, f ? bz : az, y1), t * 0.8, mat)); } }
  return g;
}

/* ------------------------------------------------------------ Module */
/* Wohn-/Betriebsmodul entlang +Z (0 … len), Boden y = 0: Kasten mit Dachplatten, Teamstreifen, Fenstern beidseitig */
function module(M, w, h, len, o = {}) {
  const g = new THREE.Group(), X = xm(M);
  g.add(slab0(w, h, len, o.mat || M.hull, 0, 0, len / 2, 0.45));
  const n = Math.max(1, Math.round(len / 6)), L = (len - 1.2 - (n - 1) * 0.45) / n;
  for (let i = 0; i < n; i++) g.add(slab0(w - 1.2, 0.4, L, M.hull2, 0, h - 0.05, 0.6 + L / 2 + i * (L + 0.45), 0.12));
  if (o.team !== false) g.add(at(bar(Math.min(1.1, w * 0.12), 0.12, len - 1.6, M.trim), 0, h + 0.41, len / 2));
  for (const s of [-1, 1]) winAt(g, M, len - 2.4, o.rows > 1 ? 2.4 : 0.55, s * (w / 2 + 0.03), h * (o.rows > 1 ? 0.5 : 0.6), len / 2, s * HP, o.rows || 1);
  g.add(at(hazBar(M, w + 0.1, 0.6, 0.5, 0.25), 0, h * 0.2, len - 0.3));
  return g;
}
/* Tank liegend entlang Z: Zylinder mit gewölbten Böden (Achteck), Spannbänder, Sattel */
function tankH(M, S, r, len, mat = M.hull) {
  const g = new THREE.Group(), prof = [];
  for (let i = 0; i <= 3; i++) { const a = -HP + i / 3 * HP; prof.push([Math.cos(a) * r, -len / 2 + Math.sin(a) * r * 0.5]); }
  for (let i = 0; i <= 3; i++) { const a = i / 3 * HP; prof.push([Math.cos(a) * r, len / 2 + Math.sin(a) * r * 0.5]); }
  const body = prism(prof, mat, 10); body.rotation.x = HP; g.add(body);
  for (const z of [-len * 0.32, 0, len * 0.32]) g.add(at(cyl(r * 1.05, r * 1.05, 0.5, M.dark, 10), 0, 0, z, 0, 0, PI / 10));
  for (const z of [-len * 0.3, len * 0.3]) g.add(at(sl(r * 1.6, r * 0.9, 1.0, M.dark, 0.2), 0, -r * 0.75, z));
  return g;
}
/* Kugeltank auf Beinen mit Äquatorband */
function tankS(M, S, r, mat = M.hull) {
  const g = new THREE.Group();
  const P = []; for (let i = 0; i <= 6; i++) { const a = -HP + i / 6 * PI; P.push([Math.cos(a) * r + 0.001, Math.sin(a) * r]); }
  g.add(at(prism(P, mat, 12), 0, r * 1.15, 0));
  g.add(at(ring(r * 0.98, r * 1.04, -0.35, 0.35, M.dark, 12), 0, r * 1.15, 0));
  for (let k = 0; k < 4; k++) { const a = k * HP + PI / 4; g.add(beam([Math.sin(a) * r * 0.62, r * 1.15, Math.cos(a) * r * 0.62], [Math.sin(a) * r * 0.75, 0, Math.cos(a) * r * 0.75], r * 0.12, M.dark)); }
  g.add(at(cyl(r * 0.18, r * 0.18, 0.6, M.dark, 6), 0, r * 2.15 + 0.2, 0, HP));
  return g;
}
/* Kühlrippenfeld flach liegend, Spannweite nach oben */
function radField(M, n, span, len, gap) { return finArray(M, n, span, len, gap); }

/* ===================================================================== GEBÄUDE */

/* KOMMANDOBASIS – das größte Gebäude: großer Asteroid, darauf ein zweistufiger Achteck-Sockel (Zikkurat) mit
   Kommandoturm und ausladender Brücke (Fensterkranz, Teamkreuz auf dem Dach). Vier Flügel auf den Diagonalen
   (Hangar mit leuchtendem Tor, Wohntrakt, Hütte mit Schloten, Lager mit Tanks), vorn ein Landefeld mit Hoheitszeichen,
   hinten ein Bohrturm, seitlich Kühlrippenfelder.
   Stufe I unbewaffnet. Stufe II: Turm höher, Wallmauer vorn/hinten mit zwei Bastionen und Autokanonen, zweite
   Schüssel. Stufe III: geschlossener Wall mit Tor und Teamlichtern, vier Bastionen, Railgun auf dem Brückendach,
   zwei PDC-Türme, Turm noch höher. */
regB('base', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M), R = rng(5 + lv);
  g.add(rock({ rx: 57, ry: 32, rz: 55, cy: -17, top: 0, rim: 6, rimIn: 0.68, rimOut: 0.88, seed: 11, det: 16, craters: 11 }));
  /* Deck */
  g.add(prism([[0.01, -0.6], [31, -0.6], [31, 0.7], [0.01, 0.7]], S.deck, 8));
  g.add(ring(30.2, 31.3, 0.2, 0.95, X.hazard, 8, 0.5));
  /* Zikkurat */
  g.add(prism([[0.01, 0.7], [23, 0.7], [23, 4.6], [20.5, 7.4], [0.01, 7.4]], M.hull, 8));
  prismWin(g, M, 23, 2.7, 1.6, 8, 0.7, 2);
  g.add(ring(20.2, 20.9, 7.3, 7.7, M.dark, 8));
  g.add(prism([[0.01, 7.4], [14.5, 7.4], [14.5, 10.4], [12.8, 11.9], [0.01, 11.9]], M.hull2, 8));
  prismWin(g, M, 14.5, 8.9, 0.6, 8, 0.6, 1);
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; greeb(M, g, Math.sin(a) * 17 - 1.5, Math.sin(a) * 17 + 1.5, Math.cos(a) * 17 - 1.5, Math.cos(a) * 17 + 1.5, 7.4, 3, 30 + k, 1.1); }
  /* Turm und Brücke */
  const T = lv === 1 ? 25 : lv === 2 ? 29 : 32;
  g.add(prism([[0.01, 11.9], [6.2, 11.9], [5.2, 13.5], [5.2, T - 6], [0.01, T - 6]], M.hull, 8));
  for (let y = 15; y < T - 7; y += 3.2) g.add(ring(5.15, 5.6, y, y + 0.5, M.dark, 8));
  prismWin(g, M, 5.2, (13.5 + T - 6) / 2, T - 20.5, 8, 0.28, 2, [0, 2, 4, 6]);
  g.add(prism([[0.01, T - 6], [6.4, T - 6], [9.0, T - 3.6], [9.0, T - 1.1], [8.0, T], [0.01, T]], M.hull2, 8));
  prismWin(g, M, 9.0, T - 2.35, 1.5, 8, 0.8, 2);
  g.add(ring(8.95, 9.35, T - 3.75, T - 3.35, M.dark, 8));
  /* Teamkreuz auf dem Brückendach, Lichter an den Ecken */
  for (const ry of [0, HP]) { const b = bar(1.1, 0.14, 13.5, M.trim); b.position.set(0, T + 0.07, 0); b.rotation.y = ry + PI / 8; g.add(b); }
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; g.add(at(lamp(M, 0.28), ...pol(a, 8.6, T + 0.2))); }
  if (lv < 3) { g.add(at(cyl(2.2, 2.6, 1.2, M.dark, 8), 0, T + 0.6, 0, HP)); g.add(at(cyl(0.7, 0.7, 2.2, M.hull2, 8), 0, T + 2.2, 0, HP)); }
  /* Antennen und Schüssel auf dem Sockel */
  const mast = (x, z, h) => { g.add(at(cyl(0.18, 0.32, h, M.dark, 6), x, 11.9 + h / 2, z, HP)); for (let i = 1; i <= 2; i++) g.add(at(bar(1.8 - i * 0.4, 0.12, 0.12, M.dark), x, 11.9 + h * (0.45 + i * 0.2), z)); beacon(g, M.red, x, 11.9 + h + 0.25, z, 0.3, 0.9); };
  mast(...pol(-PI / 8 * 3, 10).filter((_, i) => i !== 1), 9); mast(...pol(PI / 8 * 5, 10.5).filter((_, i) => i !== 1), 6);
  const dish1 = dish(M, 3.2, 0.5); dish1.position.set(...pol(PI / 8 * 3, 9.5, 11.9)); g.add(dish1);
  if (lv >= 2) { const dish2 = dish(M, 2.4, 0.7); dish2.position.set(...pol(-PI / 8 * 5, 9.8, 11.9)); g.add(dish2); }
  /* Flügel auf den Diagonalen */
  const wing = (k) => { const a = PI / 4 + k * HP, w = new THREE.Group(); place(g, w, a, 17.5, 0.7); return w; };
  { /* Hangar (vorn rechts): breiter Kasten, Tor nach außen, Leuchtbucht */
    const w = wing(0); w.add(module(M, 12, 8, 22, {}));
    w.add(at(bar(8.4, 5.6, 0.2, S.bay), 0, 3.4, 22.05));
    for (let i = -3; i <= 3; i++) w.add(at(bar(0.22, 5.6, 0.3, M.dark), i * 1.2, 3.4, 22.1));
    w.add(at(bar(8.4, 0.25, 0.3, M.dark), 0, 4.6, 22.1));
    for (const s of [-1, 1]) w.add(at(hazBar(M, 0.9, 7.2, 0.7, 0.3), s * 4.9, 3.8, 22.1));
    w.add(at(hazBar(M, 10.6, 0.8, 0.7, 0.3), 0, 6.9, 22.1));
    for (const s of [-1, 1]) w.add(at(flood(M, S, 0.8, 0.3), s * 5.4, 8.4, 21.2));
    greeb(M, w, -4, 4, 3, 18, 8.4, 6, 41, 1.2);
  }
  { /* Wohntrakt (hinten rechts): zwei Geschosse, viele Fenster */
    const w = wing(1); w.add(module(M, 9, 5.5, 22, { rows: 2 }));
    const up = module(M, 6.5, 3.4, 15, { team: false }); up.position.set(0, 5.9, 3); w.add(up);
    w.add(at(sl(3, 2.4, 3, M.hull2, 0.3), 0, 10.6, 6)); w.add(at(cyl(1.2, 1.2, 0.5, M.dark, 8), 0, 11.9, 6, HP));
  }
  { /* Hütte (hinten links): Erzschmelze mit zwei Schloten, Glut im Schlitz, Rippen */
    const w = wing(2); w.add(module(M, 10, 6.5, 22, { mat: M.hull2 }));
    for (const z of [7, 14]) { w.add(at(cyl(1.4, 1.1, 7, M.dark, 8), 2.2, 9.5, z, HP)); w.add(at(cyl(1.5, 1.5, 0.5, M.hull2, 8), 2.2, 12.9, z, HP)); w.add(at(cyl(1.0, 1.0, 0.1, S.melt, 8), 2.2, 13.16, z, HP)); }
    for (const s of [-1, 1]) w.add(at(bar(0.1, 0.5, 14, S.melt), s * 5.06, 1.6, 11));
    const f = finArray(M, 4, 3.2, 6, 1.3); f.position.set(-2.6, 6.9, 15); w.add(f);
  }
  { /* Lager (vorn links): Tanks auf Sätteln, Container */
    const w = wing(3); w.add(slab0(11, 1.2, 22, M.hull2, 0, 0, 11, 0.3));
    for (const x of [-2.7, 2.7]) w.add(at(tankH(M, S, 2.3, 14, M.hull), x, 3.6, 9));
    pipe(w, [[-2.7, 6.3, 2.5], [-2.7, 7, 0.4], [2.7, 7, 0.4], [2.7, 6.3, 2.5]], 0.35, M.dark);
    for (const [x, y, k] of [[-3.4, 1.2, 0], [-0.8, 1.2, 1], [1.8, 1.2, 3], [-2.1, 3.6, 2]]) w.add(at(container(M, S, 2.4, 2.4, 5.6, k), x, y, 18.8));
  }
  /* Verbindungsgänge zwischen Flügeln und Sockel sind die Flügelwurzeln; Rohre über den Sockelrand */
  for (let k = 0; k < 4; k++) { const a = k * HP + PI / 4 + 0.32; pipe(g, [pol(a, 20, 3.6), pol(a, 28, 3.6), pol(a, 30.5, 0.9)], 0.45, M.dark); }
  /* Landefeld vorn mit Hoheitszeichen */
  { const pz = 34; g.add(at(prism([[0.01, 0.4], [8, 0.4], [8, 1.3], [0.01, 1.3]], M.hull2, 8), 0, 0, pz)); g.add(at(ring(7.2, 8.05, 1.2, 1.38, X.hazard, 8, 0.35), 0, 0, pz));
    topEmblem(g, M, 0, 1.36, pz, 4.2);
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; beacon(g, S.team, pz * 0 + Math.sin(a) * 7.6, 1.55, pz + Math.cos(a) * 7.6, 0.24, 0.8 + (k % 2) * 0.1); }
  }
  topLabel(g, 'MCRN ARES', 0, 0.7, 27.2, 1.5);
  /* Bohrturm hinten: Gittermast über einer Bohrung, Bohrgestänge, Rohrbock */
  { const p = pol(PI, 31, 0.7), dr = new THREE.Group(); dr.position.set(p[0], 0.7, p[2]);
    dr.add(slab0(8, 1.2, 8, M.hull2, 0, 0, 0, 0.3)); dr.add(at(ring(1.2, 2.0, 1.2, 1.9, X.hazard, 8, 0.3), 0, 0, 0));
    const l = lattice(M, 16, 6, 1.8, 5, 0.22); l.position.y = 1.2; dr.add(l);
    dr.add(at(sl(2.6, 1.2, 2.6, M.hull2, 0.3), 0, 17.6, 0)); dr.add(at(cyl(0.35, 0.35, 15, X.steel, 6), 0, 9, 0, HP));
    dr.add(at(sl(1.6, 1.4, 1.6, M.dark, 0.3), 0, 10, 0)); beacon(dr, M.red, 0, 18.5, 0, 0.3, 0.7);
    for (let i = 0; i < 4; i++) dr.add(at(cyl(0.3, 0.3, 6, X.steel, 6), -3.2 + i * 0.7, 1.6 + i % 2 * 0.6, -1.5 + i * 0.4));
    g.add(dr); }
  /* Kühlrippenfelder seitlich */
  for (const s of [-1, 1]) { const f = finArray(M, lv >= 2 ? 6 : 4, 5, 10, 1.7); f.position.set(s * 31, 0.7, 0); g.add(f); g.add(at(slab0(lv >= 2 ? 11 : 7.5, 0.6, 11, M.dark, 0, 0, 0, 0.2), s * 31, 0.1, 0)); }
  /* Lampen am Deckrand */
  for (let k = 0; k < 16; k++) { const a = k * TAU / 16 + PI / 16; g.add(at(lamp(M, 0.3), ...pol(a, 30.8, 1.3))); }
  /* Felsanker am Deckrand (in die Flanke) */
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8 + 0.2; anchor(g, M, pol(a, 30.5, 0.2), pol(a, 41, -4.5), 0.6); }

  /* Wall und Bastionen */
  if (lv >= 2) {
    const seg = (k, gate) => {
      const a = k * PI / 4, L = 2 * 45.5 * Math.tan(PI / 8) + 1.3, w = new THREE.Group(); place(g, w, a, 45.5, 0);
      const parts = gate ? [[-L / 2, -6.5], [6.5, L / 2]] : [[-L / 2, L / 2]];
      for (const [x0, x1] of parts) { const ww = new THREE.Group(); ww.position.x = (x0 + x1) / 2; ww.rotation.y = HP; w.add(ww);
        ww.add(at(sl(3.2, 11.4, x1 - x0, M.hull, 0.5), 0, -0.3, 0)); ww.add(at(sl(1.6, 0.6, x1 - x0 - 0.6, M.hull2, 0.2), -0.8, 5.6, 0));
        ww.add(at(hazBar(M, 3.3, 0.7, x1 - x0 - 0.2, 0.35), 0, 0.6, 0));
        if (lv >= 3) ww.add(at(bar(0.25, 0.25, x1 - x0 - 1.5, S.team), 0.9, 5.55, 0)); }
      if (gate) for (const s of [-1, 1]) { w.add(at(sl(3.4, 13, 3.4, M.hull2, 0.5), s * 6.6, 1, 0)); w.add(at(lamp(M, 0.35), s * 6.6, 7.8, 0)); }
    };
    const segs = lv >= 3 ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 4];
    for (const k of segs) seg(k, k === 1);
    const nb = lv >= 3 ? [0, HP, PI, -HP] : [0, PI];
    nb.forEach((a, i) => {
      const p = pol(a, 47.5), b = new THREE.Group(); b.position.set(p[0], 0, p[2]); g.add(b);
      b.add(prism([[0.01, -8], [5.4, -8], [6.9, -4.5], [6.9, 7.2], [6.1, 8.6], [0.01, 8.6]], M.hull2, 8));
      b.add(ring(6.85, 7.15, 5.6, 6.4, X.hazard, 8, 0.3));
      prismWin(b, M, 6.9, 3.4, 0.5, 8, 0.5);
      for (let k = 0; k < 4; k++) b.add(at(lamp(M, 0.28), ...pol(a + k * HP + PI / 4, 6.4, 8.8)));
      const c = aimed(cannon(M, 2.5, 2, 3.4, 20 + i, M.hull), i * 1.7, a); c.position.y = 8.6; b.add(c);
    });
  }
  /* Stufe III: Railgun auf dem Brückendach, zwei PDC-Türme auf dem Sockel */
  if (lv >= 3) {
    const rg = new THREE.Group(); rg.position.y = T;
    rg.add(at(cyl(3.2, 3.6, 1.0, M.dark, 8), 0, 0.5, 0, HP));
    const h = new THREE.Group(); h.position.y = 1.0; rg.add(h);
    h.add(loft([{ z: -4.2, pts: oct2(4.6, 5.6, 2.4, 0.5, 1.2) }, { z: 2.4, pts: oct2(4.8, 5.6, 2.6, 0.5, 1.3) }, { z: 3.8, pts: oct2(3.0, 4.6, 1.8, 0.4, 0.9) }], M.hull, { uv: UVS }));
    const rl = rail(M, 22, 1.25, 2.6); rl.position.set(0, 1.7, 2.6); h.add(rl);
    for (const s of [-1, 1]) h.add(at(cyl(0.5, 0.5, 5, M.dark, 8), s * 2.0, 1.6, -1.6));
    h.add(at(hazBar(M, 4.7, 0.5, 0.6, 0.25), 0, 2.2, -4.0));
    rg.userData.aim = { phase: 0.6, base: 0 }; g.add(rg);
    for (const s of [-1, 1]) { const p = pdc(M, 1.7, 7); aimed(p, s * 1.3 + 2, s * HP); p.position.set(s * 11.6, 11.9, -4); g.add(p); }
  }
  return g;
});

/* Schüssel (Parabolspiegel) auf Gabelmontierung, neigt sich um tilt aus der Senkrechten, schwenkt langsam */
function dish(M, r, tilt = 0.6, speed = 0.15) {
  const g = new THREE.Group(), X = xm(M);
  g.add(at(cyl(r * 0.28, r * 0.36, r * 0.5, M.dark, 8), 0, r * 0.25, 0, HP));
  const yoke = new THREE.Group(); yoke.position.y = r * 0.5; g.add(yoke);
  yoke.add(at(sl(r * 0.5, r * 0.3, r * 0.5, M.hull2, r * 0.08), 0, r * 0.15, 0));
  for (const s of [-1, 1]) yoke.add(at(sl(r * 0.14, r * 0.85, r * 0.3, M.hull2, r * 0.04), s * r * 0.42, r * 0.55, 0));
  const head = new THREE.Group(); head.position.y = r * 0.8; head.rotation.x = -tilt; yoke.add(head);
  const P = []; for (let i = 0; i <= 5; i++) { const t = i / 5; P.push([r * t, r * 0.32 * t * t]); }
  const back = P.slice().reverse().map(([rr, y]) => [rr * 0.98, y - r * 0.06]);
  head.add(prism([...P, [r * 1.02, r * 0.32 + 0.02], ...back], M.hull, 16, 0));
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; head.add(beam([Math.sin(a) * r * 0.85, r * 0.28, Math.cos(a) * r * 0.85], [0, r * 0.82, 0], r * 0.035, M.dark)); }
  head.add(at(cyl(r * 0.09, r * 0.12, r * 0.22, M.dark, 6), 0, r * 0.86, 0, HP));
  head.add(at(cyl(r * 0.2, r * 0.2, r * 0.12, M.dark, 8), 0, 0.02, 0, HP));
  yoke.userData.sway = { axis: 'y', amp: 0.9, speed, phase: r };
  return g;
}

/* WERFT – gespaltener Asteroid: zwei Felshälften, dazwischen das Trockendock. Die Bruchflächen sind mit
   Stahlplatten verkleidet (Galerien, Fenster, Warnkante), oben laufen Kranschienen, Portalkräne spannen sich
   über das Dock, hinten schließt die Kopfwand mit Leitstand ab, unten tragen Kielböcke das Schiff.
   Auf den Felsrändern Hallen, Tanks und Container. Der Bauplatz (berth) liegt in der Mitte des Docks.
   Stufe I: kurzes Dock (Schiffe bis 55), ein Kran, eine Halle. Stufe II: Dock bis 75, zwei Kräne,
   Schweißarme, zweite Halle, Kühlrippen. Stufe III: Dock bis 90, drei Kräne, Turmdrehkräne auf dem Rand,
   Teamlichter an den Dockkanten, mehr Kielböcke und Lichter. */
regB('yard', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M), W = 24, TOP = 0, BY = -5;
  const z0 = lv === 1 ? -25 : lv === 2 ? -31 : -36, z1 = lv === 1 ? 25 : lv === 2 ? 32 : 37, L = z1 - z0, zm = (z0 + z1) / 2, BL = lv === 1 ? 55 : lv === 2 ? 75 : 90;
  const RK = { rx: 44, ry: 29, rz: 41, cy: -16, top: TOP, rim: 3.5, rimIn: 0.84, rimOut: 0.98, seed: 23, det: 13, craters: 8, amp: 0.17 };
  for (const s of [-1, 1]) g.add(rock(Object.assign({}, RK, { planes: [{ n: [-s, 0, 0], d: -W }] })));
  /* Bauplatz */
  const berth = new THREE.Group(); berth.position.set(0, BY, z0 + 4 + BL / 2); berth.userData.berth = { len: BL }; g.add(berth);
  for (const s of [-1, 1]) {
    /* Verkleidung der Bruchfläche, Galerie, Fenster, Warnkante */
    const n = Math.round(L / 8), pl = (L - (n - 1) * 0.4) / n;
    for (let i = 0; i < n; i++) { const z = z0 + pl / 2 + i * (pl + 0.4); g.add(at(sl(1.0, 15, pl, i % 3 === 1 ? M.hull : M.hull2, 0.3), s * (W - 0.5), TOP - 7.6, z)); }
    g.add(at(hazBar(M, 1.1, 0.8, L, 0.35), s * (W - 0.55), TOP - 0.5, zm));
    winAt(g, M, L - 6, 0.55, s * (W - 1.03), TOP - 2.4, zm, -s * HP);
    winAt(g, M, L - 10, 0.55, s * (W - 1.03), TOP - 9.2, zm, -s * HP);
    g.add(at(sl(2.4, 0.5, L - 2, M.dark, 0.1), s * (W - 2.1), TOP - 10.4, zm));
    for (let z = z0 + 4; z < z1 - 2; z += 8) g.add(beam([s * (W - 3.2), TOP - 10.4, z], [s * (W - 1), TOP - 13.5, z], 0.3, M.dark));
    /* Kranschienen auf dem Felsrand */
    g.add(at(sl(3.6, 0.8, L + 4, M.hull2, 0.25), s * (W + 1.6), TOP + 0.2, zm));
    for (const x of [W + 0.6, W + 2.6]) g.add(at(bar(0.5, 0.45, L + 4, M.dark), s * x, TOP + 0.82, zm));
    /* Scheinwerfer an der Dockkante, schräg ins Dock */
    for (let z = z0 + 6; z < z1; z += 14) { const f = flood(M, S, 1.0, 0.75); f.position.set(s * (W + 0.3), TOP + 0.6, z + 3); f.rotation.y = -s * HP; g.add(f); }
    if (lv >= 3) g.add(at(bar(0.25, 0.25, L - 2, S.team), s * (W + 3.6), TOP + 0.75, zm));
  }
  /* Kielböcke unter dem Schiff */
  const nc = lv * 2 + 1;
  for (let i = 0; i < nc; i++) {
    const z = z0 + 7 + i * (L - 14) / (nc - 1);
    g.add(at(sl(2 * W + 2, 2.4, 2.4, M.hull2, 0.3), 0, BY - 15.5, z));
    g.add(at(hazBar(M, 2 * W - 4, 0.35, 2.5, 0.3), 0, BY - 14.2, z));
    for (const s of [-1, 1]) { g.add(at(sl(2.6, 3.4, 2.8, M.dark, 0.35), s * 4.4, BY - 12.8, z)); g.add(at(sl(3.4, 0.6, 3.4, M.hull, 0.15), s * 4.4, BY - 10.8, z)); }
  }
  /* Kopfwand mit Leitstand */
  { const b = new THREE.Group(); b.position.z = z0; g.add(b);
    b.add(at(sl(2 * W + 1.5, 26, 6, M.hull, 0.6), 0, TOP - 11, -3));
    for (const y of [-3.2, -9.6, -16]) winAt(b, M, 2 * W - 10, 2.2, 0, TOP + y, 0.03, 0, 2);
    b.add(at(hazBar(M, 2 * W + 1.6, 0.9, 6.1, 0.4), 0, TOP + 1.2, -3));
    b.add(at(bar(2 * W - 6, 0.14, 1.2, M.trim), 0, TOP + 2.07, -3));
    b.add(at(sl(12, 6, 6, M.hull2, 0.6, 0.9, 0.9), 0, TOP + 5, -3.2)); winAt(b, M, 9, 1.4, 0, TOP + 6, -0.17, 0, 2);
    b.add(at(sl(6, 0.6, 4, M.dark, 0.2), 0, TOP + 8.3, -3.4));
    const dd = dish(M, 2.4, 0.6); dd.position.set(-9, TOP + 2, -3); b.add(dd);
    b.add(at(cyl(0.2, 0.35, 10, M.dark, 6), 9, TOP + 7, -3, HP)); beacon(b, M.red, 9, TOP + 12.2, -3, 0.32, 0.8);
    for (const s of [-1, 1]) lampAt(b, M, s * 5.5, TOP + 8.2, -0.6, 0.3);
  }
  /* Portalkräne */
  const H = 22;
  const crane = (z, seed) => {
    const c = new THREE.Group(), r = rng(seed); c.position.z = z; g.add(c);
    for (const s of [-1, 1]) {
      c.add(at(sl(4.2, 1.6, 7, M.dark, 0.3), s * (W + 1.6), TOP + 1.8, 0));
      for (const dz of [-2.8, 2.8]) c.add(beam([s * (W + 1.6), TOP + 2.4, dz], [s * (W + 0.8), H, dz * 0.3], 0.8, M.hull2));
      c.add(beam([s * (W + 1.6), TOP + 6, -2.4], [s * (W + 1.6), TOP + 6, 2.4], 0.5, M.dark));
      c.add(at(sl(3, 2.4, 3.4, M.hull2, 0.35), s * (W + 0.8), H, 0));
    }
    const tr = truss(M, 2 * W + 4, 2.8, 2.6, 12, M.dark, 0.26); tr.rotation.y = HP; tr.position.y = H + 2.3; c.add(tr);
    c.add(at(sl(2 * W + 4, 0.5, 3.2, M.hull2, 0.15), 0, H + 3.85, 0));
    c.add(at(bar(2 * W - 4, 0.12, 0.9, M.trim), 0, H + 4.16, 0));
    for (const s of [-1, 1]) c.add(at(hazBar(M, 4, 0.55, 3.3, 0.35), s * (W - 1.5), H + 4.2, 0));
    const tx = (r() - 0.5) * 22;
    c.add(at(sl(4.4, 2.4, 4.2, M.hull, 0.3), tx, H + 0.5, 0));
    const hook = new THREE.Group(); hook.position.set(tx, H - 0.7, 0);
    for (const x of [-0.6, 0.6]) hook.add(at(bar(0.14, 4.6, 0.14, M.dark), x, -2.3, 0));
    hook.add(at(hazBar(M, 2.2, 1.2, 2.2, 0.25), 0, -5.1, 0));
    hook.userData.sway = { axis: 'z', amp: 0.05, speed: 0.45, phase: seed }; c.add(hook);
    c.add(at(sl(3.2, 2.6, 3.2, M.hull2, 0.3), -(W - 3), H - 1.6, 2.6)); winAt(c, M, 2.4, 0.9, -(W - 3), H - 1.4, 4.22, 0, 1, 1.2);
    for (const s of [-1, 1]) lampAt(c, M, s * (W + 0.8), H + 1.5, 1.9, 0.3);
  };
  (lv === 1 ? [-4] : lv === 2 ? [-14, 13] : [-22, 1, 23]).forEach((z, i) => crane(z, 3 + i * 7));
  /* Felsränder: Hallen, Tanks, Container, Rippen */
  const hall = (s, za, len, rows) => { const h = module(M, 8.4, 6.5, len, { rows }); h.position.set(s * 33.2, TOP, za); g.add(h); for (let z = za + 3; z < za + len - 2; z += 7) g.add(at(sl(3, 2.2, 3, M.dark, 0.3), s * 31.5, TOP + 6.8, z)); };
  hall(1, -28, 22, 2);
  { const t = new THREE.Group(); t.position.set(-33, TOP, -14); g.add(t);
    for (const x of [-2.6, 2.6]) t.add(at(tankH(M, S, 2.3, 13, x < 0 ? M.hull : S.rust), x, 3.1, 0));
    t.add(at(sl(9.6, 0.8, 16, M.dark, 0.2), 0, 0.4, 0)); pipe(t, [[2.6, 5.5, 6], [2.6, 6.4, 9], [8.4, 6.4, 9], [8.4, 1.2, 9]], 0.35, M.dark); }
  for (const [x, y, z, k] of [[-31, 0, 3, 0], [-34, 0, 3, 1], [-31, 2.6, 3, 2], [-37, 0, 3.4, 3]]) g.add(at(container(M, S, 2.6, 2.6, 6, k), x, TOP + y, z));
  if (lv >= 2) {
    hall(1, -2, 20, 1); hall(-1, 10, 18, 1);
    for (const s of [-1, 1]) { const f = finArray(M, 4, 4, 7, 1.5); f.position.set(s * 33, TOP, s > 0 ? 24 : -30); g.add(f); }
    /* Schweißarme an den Dockwänden */
    for (const s of [-1, 1]) for (const z of [-12, 10]) {
      const A = [s * (W - 1.2), BY + 4, z], B = [s * (W - 5.5), BY + 9, z + 1.5], C = [s * (W - 7.5), BY + 7, z + 3];
      g.add(at(sl(2.4, 2.4, 2.4, M.dark, 0.4), ...A)); g.add(beam(A, B, 0.8, M.hull2)); g.add(hazBeam(M, B, C, 0.6, 0.25)); g.add(at(sl(1, 1, 1, M.dark, 0.2), ...B));
      beacon(g, S.melt, C[0], C[1], C[2], 0.32, 3.1);
    }
  }
  if (lv >= 3) {
    hall(-1, -31, 9, 1);
    /* Turmdrehkräne auf dem Felsrand, Ausleger schwenkt langsam über das Dock */
    for (const [x, z, ph] of [[34, -30, 0], [-34, -20, 2], [34, 19, 4]]) {
      const tc = new THREE.Group(); tc.position.set(x, TOP, z); g.add(tc);
      tc.add(at(sl(4, 1.2, 4, M.hull2, 0.3), 0, 0.6, 0)); const l = lattice(M, 18, 2.2, 2.2, 6, 0.18); l.position.y = 1.2; tc.add(l);
      const jib = new THREE.Group(); jib.position.y = 19.4; jib.rotation.y = x > 0 ? -HP : HP;
      const tj = truss(M, 20, 1.6, 1.6, 8, M.hull2, 0.16); tj.position.set(0, 0, 6); jib.add(tj);
      jib.add(at(sl(2.6, 2.2, 3.0, S.rust, 0.3), 0, 0.2, -3.6)); jib.add(at(sl(2, 1.6, 2, M.hull, 0.3), 0, -0.2, 0));
      jib.add(at(bar(0.1, 5, 0.1, M.dark), 0, -3.3, 14)); jib.add(at(hazBar(M, 1.2, 0.8, 1.2, 0.2), 0, -6, 14));
      jib.userData.sway = { axis: 'y', amp: 0.5, speed: 0.12, phase: ph, base: jib.rotation.y }; tc.add(jib);
      beacon(tc, M.red, 0, 20.6, 0, 0.3, 0.7);
    }
    for (const s of [-1, 1]) for (const z of [-26, 28]) { const A = [s * (W - 1.2), BY + 4, z], B = [s * (W - 5.5), BY + 9, z + 1.5], C = [s * (W - 7.5), BY + 7, z + 3]; g.add(at(sl(2.4, 2.4, 2.4, M.dark, 0.4), ...A)); g.add(beam(A, B, 0.8, M.hull2)); g.add(hazBeam(M, B, C, 0.6, 0.25)); beacon(g, S.melt, C[0], C[1], C[2], 0.32, 2.7); }
  }
  topLabel(g, 'DOCK ' + ['I', 'II', 'III'][lv - 1], 30.6, TOP + 0.6, z0 - 3, 1.4, HP);
  return g;
});

/* RAFFINERIE – runder Fels mit Prozessturm in der Mitte (Kolonne, Fackel), Kugeltanks auf Beinen, Rohrbrücken.
   Am Felsrand je Andockplatz eine Pier mit zwei Klammerarmen und Schlauch; der Frachter liegt tangential daneben.
   Stufe I: ein Andockplatz, zwei Tanks, Brecherhalle. Stufe II: zwei Andockplätze, vier Tanks, zweite Halle.
   Stufe III: drei Andockplätze, Schmelze mit glühendem Kern und umlaufendem Förderring (verarbeitet mit Aufschlag). */
regB('refinery', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M);
  g.add(rock({ rx: 36, ry: 22, rz: 35, cy: -11, top: 0, rim: 2.6, rimIn: 0.64, rimOut: 0.84, seed: 31, det: 13, craters: 8 }));
  const docks = lv === 1 ? [HP] : lv === 2 ? [HP, -HP] : [HP, HP + TAU / 3, HP - TAU / 3];
  /* Deck um den Prozessturm */
  g.add(prism([[0.01, -0.4], [12.5, -0.4], [12.5, 0.8], [0.01, 0.8]], S.deck, 8));
  g.add(ring(11.9, 12.7, 0.3, 1.0, X.hazard, 8, 0.35));
  for (const a of docks) {
    const k = new THREE.Group(); k.userData.dock = true; const p = pol(a, 35.6, 8); k.position.set(p[0], p[1], p[2]); k.rotation.y = a + HP; g.add(k);
    const pr = new THREE.Group(); place(g, pr, a, 21, 0);
    pr.add(slab0(17, 3.6, 7, M.hull2, 0, -0.6, 0, 0.45)); pr.add(at(hazBar(M, 17.1, 0.6, 7.1, 0.3), 0, 2.4, 0));
    pr.add(slab0(8, 2.6, 5, S.rust, 0, 3, -0.6, 0.4)); pr.add(at(sl(6, 1.2, 3.4, M.dark, 0.3, 0.7, 1), 0, 6.2, -0.6));
    for (const s of [-1, 1]) {
      const A = [s * 6.5, 3.6, 2.2], B = [s * 7.4, 8.6, 6.4], C = [s * 7.4, 8.2, 10.1];
      pr.add(at(sl(2.4, 2.4, 2.4, M.dark, 0.4), A[0], A[1] + 0.6, A[2])); pr.add(beam(A, B, 1.1, M.hull2)); pr.add(hazBeam(M, B, C, 0.85, 0.3));
      pr.add(beam([A[0] - s * 0.6, A[1] + 1.2, A[2] - 0.4], [B[0] - s * 0.6, B[1] + 0.4, B[2] - 0.8], 0.3, M.dark));
      pr.add(at(sl(1.4, 1.4, 1.4, M.dark, 0.3), ...B)); pr.add(at(sl(2.2, 2.6, 0.7, M.dark, 0.2), C[0], C[1], C[2] + 0.3));
      lampAt(pr, M, s * 8.2, 3.4, 3.2, 0.3);
    }
    pipe(pr, [[0, 4.2, 1.8], [0, 7, 5], [0, 8.6, 9.6]], 0.55, M.dark); pr.add(at(cyl(0.9, 0.9, 0.9, X.hazard, 8), 0, 8.6, 9.8));
    beacon(pr, S.team, 0, 4.3, 3.4, 0.38, 0.9);
    pipe(g, [pol(a, 12.5, 1.6), pol(a, 17.6, 1.6)], 0.5, M.dark, M.hull2);
    pipe(g, [pol(a + 0.12, 12.5, 2.6), pol(a + 0.1, 17.6, 2.6)], 0.4, M.dark);
  }
  /* Prozessturm: Achtecksockel, Kolonne mit Bühnen, Fackel */
  g.add(prism([[0.01, 0.8], [6.4, 0.8], [6.4, 6.5], [5.2, 8], [0.01, 8]], M.hull, 8));
  prismWin(g, M, 6.4, 4.2, 1.8, 8, 0.6, 2);
  g.add(at(bar(0.9, 0.12, 9, M.trim), 0, 8.06, 0));
  const col = (x, z, r, h) => { g.add(at(cyl(r, r, h, M.hull2, 10), x, h / 2, z, HP)); for (let y = 4; y < h - 1; y += 4.2) { g.add(at(cyl(r + 0.9, r + 0.9, 0.3, M.dark, 10), x, y, z, HP)); } g.add(at(cyl(r * 0.7, r, 1.4, M.dark, 10), x, h + 0.7, z, HP)); };
  col(2.4, -1.5, 1.6, lv >= 2 ? 22 : 19); col(-2.4, 1.8, 1.2, 15);
  { const fx = -2.6, fz = -2.4, fh = lv >= 3 ? 24 : 21; g.add(at(cyl(0.45, 0.6, fh, M.dark, 6), fx, fh / 2, fz, HP)); g.add(at(cyl(0.8, 0.8, 0.6, M.hull2, 8), fx, fh, fz, HP));
    const fl = mesh(new THREE.ConeGeometry(0.75, 2.6, 8), S.melt, false); fl.position.set(fx, fh + 1.6, fz); fl.userData.pulse = { amp: 0.18, speed: 2.2 }; g.add(fl); }
  /* Kugeltanks und Brecherhallen je Stufe (außerhalb der Pierbereiche) */
  const tanks = lv === 1 ? [[-HP + 0.55, 18, 5.3], [-HP - 0.55, 18, 5.3]] : lv === 2 ? [[0.55, 18, 4.6], [-0.55, 18, 4.6], [PI + 0.55, 18, 4.6], [PI - 0.55, 18, 4.6]] : [[-HP, 18.5, 4.8], [HP + PI / 3 + 0.02, 18.2, 4.2], [-HP - PI / 3 + 0.4, 15.5, 3.4], [-HP + PI / 3 - 0.4, 15.5, 3.4], [PI / 6 - 0.02, 18.2, 4.2]];
  tanks.forEach(([a, dd, r], i) => { const t = tankS(M, S, r, i % 3 === 1 ? S.rust : M.hull); place(g, t, a, dd, 0); g.add(at(bar(r * 0.5, 0.12, r * 1.6, M.trim), ...pol(a, dd, r * 2.3 + 0.15))); pipe(g, [pol(a, dd - r * 0.9, 1.4), pol(a, 7, 1.4)], 0.42, M.dark); });
  const crusher = (a) => { const c = new THREE.Group(); place(g, c, a, 9.5, 0.8); c.add(slab0(7, 7.5, 6, M.hull2, 0, 0, 2, 0.5)); c.add(at(sl(4.6, 2.6, 4.6, S.rust, 0.4, 0.75, 1), 0, 8.7, 2)); winAt(c, M, 5.2, 0.5, 3.53, 4.5, 2, HP); winAt(c, M, 5.2, 0.5, -3.53, 4.5, 2, -HP); const tr = truss(M, 9, 2, 1.6, 4, M.dark, 0.18); tr.position.set(0, 7, 8.5); tr.rotation.x = -0.32; c.add(tr); c.add(at(bar(1.4, 0.2, 9, S.rust2), 0, 7.95, 8.5, -0.32)); };
  if (lv === 1) { crusher(HP); const f = finArray(M, 4, 4.5, 7, 1.5); f.position.set(-2, 0.8, 17); g.add(f); const f2 = finArray(M, 4, 4.5, 7, 1.5); f2.position.set(-2, 0.8, -17); g.add(f2); }
  if (lv === 2) { crusher(HP); crusher(-HP); }
  if (lv >= 3) {
    /* Schmelze: glühende Wanne um den Turm, Förderring mit Kübeln dreht langsam */
    g.add(ring(7.2, 10.8, 0.8, 2.4, M.hull2, 16)); g.add(ring(7.8, 10.2, 2.3, 2.45, S.melt, 16));
    for (let k = 0; k < 8; k++) g.add(at(sl(0.6, 1.2, 3.8, M.dark, 0.15), ...pol(k * PI / 4 + PI / 8, 9, 2.6)).rotateY(k * PI / 4 + PI / 8));
    const cv = new THREE.Group(); cv.position.y = 3.4; cv.userData.spin = { axis: 'y', speed: 0.18 }; g.add(cv);
    cv.add(ring(10.9, 11.8, -0.3, 0.3, M.dark, 24));
    for (let k = 0; k < 16; k++) cv.add(at(sl(1.4, 1.0, 1.6, k % 2 ? S.rust : M.hull2, 0.2), ...pol(k * TAU / 16, 11.35, 0.65)).rotateY(k * TAU / 16));
    for (let k = 0; k < 4; k++) g.add(at(sl(0.8, 3.2, 0.8, M.dark, 0.15), ...pol(k * HP + PI / 4, 11.35, 1.6)));
  }
  for (let k = 0; k < 8; k++) lampAt(g, M, ...pol(k * PI / 4 + PI / 8, 12.6, 1.4), 0.26);
  topLabel(g, 'RAF ' + (lv * 7 + 12), 0, 0.8, 10.2, 1.2, 0);
  return g;
});

/* REAKTOR – Tokamak auf dem Fels: offener Ringkanal, darin das hell leuchtende Plasma, darüber Spulenbögen;
   in der Mitte der Zentralsolenoid mit leuchtendem Kern. Kühlrippen, Pumpen, Leitstand, Stromschiene zum Rand.
   Stufe I: kleiner Ring mit 8 Spulen, zwei Rippenfelder. Stufe II: größerer Ring, 12 Spulen, vier
   Kühlarme, Kühlmitteltanks. Stufe III: 16 Spulen, sechs lange Kühlarme, drei kreisende Feldbögen über dem Ring. */
regB('reactor', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M);
  g.add(rock({ rx: 27, ry: 17.5, rz: 26, cy: -8.8, top: 0, rim: 2.4, rimIn: 0.66, rimOut: 0.86, seed: 41, det: 12, craters: 7 }));
  const Rt = lv === 1 ? 8.0 : lv === 2 ? 9.2 : 10.2, nC = lv === 1 ? 8 : lv === 2 ? 12 : 16, y0 = 2.0, y1 = 5.4, ri = Rt - 2.4, ro = Rt + 2.4;
  g.add(prism([[0.01, -0.3], [ro + 3, -0.3], [ro + 3, 1.2], [ro + 2.2, y0], [0.01, y0]], S.deck, 16));
  g.add(ring(ro + 2.7, ro + 3.15, 0.1, 1.0, X.hazard, 16, 0.3));
  /* Ringkanal: Außen- und Innenwand, Boden */
  g.add(prism([[ro, y0], [ro + 0.9, y0], [ro + 0.9, y1 - 0.6], [ro + 0.4, y1], [ro, y1], [ro, y0]], M.hull, 32));
  g.add(prism([[ri - 0.9, y0], [ri, y0], [ri, y1], [ri - 0.4, y1], [ri - 0.9, y1 - 0.6], [ri - 0.9, y0]], M.hull, 32));
  g.add(ring(ri, ro, y0, y0 + 0.3, M.dark, 32));
  const pl = mesh(new THREE.TorusGeometry(Rt, 1.05, 8, 64), S.plasma, false); pl.rotation.x = HP; pl.position.y = 3.6; g.add(pl);
  const ph = mesh(new THREE.TorusGeometry(Rt, 1.55, 6, 48), S.plasmaSoft, false); ph.rotation.x = HP; ph.position.y = 3.5; ph.material = S.plasmaSoft; ph.userData.pulse = { amp: 0.025, speed: 1.6 }; g.add(ph);
  /* Spulenbögen */
  for (let i = 0; i < nC; i++) {
    const c = new THREE.Group(); place(g, c, i / nC * TAU + PI / nC, Rt, 0);
    for (const s of [-1, 1]) c.add(at(sl(1.6, 5.4, 1.0, S.rust, 0.2), 0, y0 + 2.4, s * 2.95));
    c.add(at(sl(1.7, 1.2, 7.0, S.rust, 0.3), 0, y1 + 1.5, 0)); c.add(at(bar(1.0, 0.2, 5.2, M.dark), 0, y1 + 2.15, 0));
    c.add(at(sl(1.2, 0.6, 1.2, M.dark, 0.15), 0, y1 + 2.4, -2.8));
  }
  /* Zentralsolenoid: Käfig aus Streben um einen leuchtenden Kern */
  const ch = lv === 1 ? 10 : lv === 2 ? 11.5 : 13;
  g.add(at(cyl(ri - 1.2, ri - 0.9, 1.2, M.hull2, 12), 0, y0 + 0.6, 0, HP));
  g.add(at(cyl(0.95, 0.95, ch - 2, S.coilHot, 10), 0, (ch + y0) / 2 + 0.4, 0, HP));
  for (let k = 0; k < 8; k++) g.add(at(sl(0.5, ch - 2.6, 0.7, M.dark, 0.12), ...pol(k * PI / 4, 1.8, (ch + y0) / 2 + 0.4)).rotateY(k * PI / 4));
  for (let y = y0 + 2.4; y < ch; y += 2.6) g.add(at(ring(1.4, 2.4, y, y + 0.5, M.hull2, 8), 0, 0, 0));
  g.add(prism([[0.01, ch], [2.8, ch], [2.8, ch + 0.8], [1.6, ch + 1.6], [0.01, ch + 1.6]], M.hull, 8));
  beacon(g, M.red, 0, ch + 2.1, 0, 0.32, 0.7);
  /* Leitstand und Stromschiene */
  { const c = new THREE.Group(); place(g, c, PI * 0.85, ro + 4.2, 0); c.add(module(M, 6.5, 4.2, 8.5, { rows: 1 })); c.add(at(cyl(0.18, 0.18, 4, M.dark, 6), 1.8, 6.6, 6, HP)); }
  { const a = -0.35, c = new THREE.Group(); place(g, c, a, ro + 3.4, 0); c.add(slab0(3, 1.6, 8, M.dark, 0, 0, 4, 0.3)); c.add(at(bar(0.6, 0.15, 7, M.trim), 0, 1.68, 4)); c.add(slab0(5, 4, 4, M.hull2, 0, 0, 9.5, 0.4)); for (const s of [-1, 1]) c.add(at(cyl(0.6, 0.6, 2.4, M.dark, 8), s * 1.4, 5.2, 9.5, HP)); beacon(c, S.team, 0, 4.4, 11.6, 0.34, 1); }
  /* Kühlung */
  const arm = (a, n) => { const c = new THREE.Group(); place(g, c, a, ro + 3.6, 0); c.add(slab0(2.2, 1.4, n * 1.6 + 1, M.dark, 0, 0, n * 0.8 + 0.5, 0.3)); const f = finArray(M, n, 3.6, 5.4, 1.6); f.rotation.y = HP; f.position.set(0, 1.2, n * 0.8 + 0.5); c.add(f); c.add(at(hazBar(M, 2.3, 0.5, 0.6, 0.25), 0, 1.0, 0.4)); lampAt(c, M, 0, 1.8, n * 1.6 + 1.2, 0.26); };
  if (lv === 1) { for (const s of [-1, 1]) { const f = finArray(M, 4, 4, 6, 1.5); f.position.set(s * 17, 0, 0); g.add(f); g.add(at(slab0(7, 0.5, 7, M.dark, 0, 0, 0, 0.2), s * 17, -0.3, 0)); pipe(g, [[s * (ro + 3), 1.2, 2], [s * 14, 1.2, 2]], 0.4, M.dark); } }
  if (lv === 2) [PI / 4, -PI / 4, HP + PI / 4 + 0.15, -HP - PI / 4].forEach(a => arm(a, 5));
  if (lv >= 3) [PI / 6, -PI / 6, HP, PI - PI / 6 + 0.2, -HP, PI + PI / 6].forEach(a => arm(a, 5));
  if (lv >= 2) for (const a of [PI * 0.62, -PI * 0.62]) { const t = tankS(M, S, 2.2, M.hull2); place(g, t, a, ro + 6.4, 0); }
  if (lv >= 3) {
    const fa = new THREE.Group(); fa.userData.spin = { axis: 'y', speed: 0.35 }; g.add(fa);
    for (let k = 0; k < 3; k++) { const arc = mesh(new THREE.TorusGeometry(Rt + 0.2, 0.22, 4, 20, 1.15), S.coil, false); arc.rotation.set(HP, 0, k * TAU / 3); arc.position.y = y1 + 3.6; fa.add(arc); }
    for (let k = 0; k < 6; k++) { const p = pol(k * PI / 3 + PI / 6, Rt, y1 + 2.5); g.add(at(cyl(0.22, 0.22, 1.6, M.dark, 6), p[0], p[1] + 0.3, p[2], HP)); }
  }
  for (let k = 0; k < 8; k++) lampAt(g, M, ...pol(k * PI / 4, ro + 2.9, 1.5), 0.24);
  return g;
});

/* LABOR – Forschung und Ortung: Achteck-Laborbau mit Radom, große Parabolschüssel, Antennenmasten, eine kleine
   Kernbohranlage (Gesteinsproben). Stufe I: Laborbau, eine große Schüssel, ein Mast. Stufe II: zwei weitere
   Schüsseln, zweiter Mast, Radom größer. Stufe III: Interferometer-Ring um die Anlage (dreht langsam, mit
   Teamlichtern), dritter Mast, Sensorkugel mit Teamband. */
regB('lab', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M), a0 = PI * 0.75;
  g.add(rock({ rx: 30.5, ry: 19, rz: 29.5, cy: -9.5, top: 0, rim: 2.8, rimIn: 0.68, rimOut: 0.88, seed: 53, det: 12, craters: 8 }));
  g.add(prism([[0.01, -0.3], [13, -0.3], [13, 0.9], [0.01, 0.9]], S.deck, 8));
  g.add(ring(12.5, 13.3, 0.4, 1.1, X.hazard, 8, 0.3));
  /* Laborbau */
  g.add(prism([[0.01, 0.9], [10, 0.9], [10, 6.0], [9.0, 7.0], [0.01, 7.0]], M.hull, 8)); prismWin(g, M, 10, 3.8, 2.4, 8, 0.66, 2);
  for (let k = 0; k < 8; k++) g.add(at(sl(3.4, 1.4, 1.2, M.hull2, 0.2), ...pol(k * PI / 4, 9.6, 7.3)).rotateY(k * PI / 4));
  g.add(prism([[0.01, 7.0], [6.6, 7.0], [6.6, 10.2], [5.8, 11.0], [0.01, 11.0]], M.hull2, 8)); prismWin(g, M, 6.6, 8.8, 0.55, 8, 0.6, 1);
  greeb(M, g, -8, 8, -8, 8, 7.0, 10, 17, 1.3);
  for (let k = 0; k < 8; k++) g.add(at(bar(0.7, 0.12, 2.4, M.trim), ...pol(k * PI / 4 + PI / 8, 8.0, 7.06)).rotateY(k * PI / 4 + PI / 8));
  { const rr = lv === 1 ? 3.4 : 4.3, P = []; for (let i = 0; i <= 6; i++) { const a = i / 6 * HP; P.push([Math.cos(a) * rr + 0.001, Math.sin(a) * rr]); }
    g.add(at(prism([[rr, -0.6], ...P], lv >= 3 ? M.hull : M.hull2, 14, 0), 0, 11.6, 0));
    if (lv >= 3) g.add(at(ring(rr - 0.05, rr + 0.12, 0.2, 0.9, M.trim, 14), 0, 11.6, 0)); }
  /* Schüsseln */
  const dishAt = (a, dist, r, tilt, sp) => { const p = pol(a, dist, 0); const base = new THREE.Group(); base.position.set(p[0], 0, p[2]); g.add(base); base.add(prism([[0.01, -0.5], [r * 0.55, -0.5], [r * 0.55, 0.8], [r * 0.45, 1.2], [0.01, 1.2]], M.hull2, 8)); const dd = dish(M, r, tilt, sp); dd.position.y = 1.2; base.add(dd); lampAt(base, M, r * 0.5, 1.3, 0, 0.22); };
  dishAt(a0, 20, 9.5, 0.55, 0.12);
  if (lv >= 2) { dishAt(a0 + TAU / 3, 20.5, 6.6, 0.7, 0.18); dishAt(a0 - TAU / 3, 20.5, 6.6, 0.45, 0.16); }
  /* Masten */
  const mastAt = (a, dist, h) => { const p = pol(a, dist, 0), m = new THREE.Group(); m.position.set(p[0], 0, p[2]); g.add(m); m.add(slab0(3, 0.8, 3, M.hull2, 0, -0.2, 0, 0.2)); const l = lattice(M, h, 2.0, 0.6, Math.round(h / 3), 0.14); l.position.y = 0.6; m.add(l); for (let i = 1; i <= 3; i++) m.add(at(bar(2.6 - i * 0.5, 0.1, 0.1, M.dark), 0, 0.6 + h * (0.5 + i * 0.13), 0)); m.add(at(cyl(0.08, 0.08, 3, M.dark, 4), 0, h + 2.1, 0, HP)); beacon(m, M.red, 0, h + 3.7, 0, 0.26, 0.75); };
  mastAt(a0 + PI, 19, 15);
  if (lv >= 2) mastAt(a0 + PI / 3, 23, 11);
  if (lv >= 3) mastAt(a0 - PI / 3, 23, 12);
  /* Kernbohranlage und Probenlager */
  { const p = pol(a0 + PI + 0.95, 20), b = new THREE.Group(); b.position.set(p[0], 0, p[2]); b.rotation.y = a0; g.add(b);
    b.add(slab0(5.2, 0.8, 5.2, M.hull2, 0, -0.2, 0, 0.2)); const l = lattice(M, 8, 3.2, 1.2, 3, 0.16); l.position.y = 0.6; b.add(l);
    b.add(at(cyl(0.22, 0.22, 7.6, X.steel, 6), 0, 4.4, 0, HP)); b.add(at(sl(1.4, 0.9, 1.4, M.dark, 0.2), 0, 8.9, 0)); b.add(at(ring(0.5, 1.3, 0.6, 1.1, X.hazard, 8, 0.2), 0, 0, 0));
    for (let i = 0; i < 3; i++) b.add(at(container(M, S, 1.8, 1.8, 3.6, i + 1), 4.2, 0.6 + (i === 2 ? 1.8 : 0), -1.2 + (i % 2) * 2.4 - (i === 2 ? 1.2 : 0))); }
  /* Stufe III: Interferometer-Ring */
  if (lv >= 3) {
    for (let k = 0; k < 6; k++) { const p = pol(k * PI / 3 + PI / 6, 28.2, 0); g.add(at(sl(1.4, 3.6, 1.4, M.dark, 0.25), p[0], 1.6, p[2])); }
    const rg = new THREE.Group(); rg.position.y = 3.6; rg.userData.spin = { axis: 'y', speed: 0.07 }; g.add(rg);
    rg.add(ring(27.6, 28.8, -0.35, 0.35, M.hull2, 48));
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; const p = pol(a, 28.2, 0.35); rg.add(at(sl(1.4, 0.5, 2.2, M.dark, 0.15), p[0], p[1] + 0.25, p[2]).rotateY(a)); rg.add(at(cyl(0.07, 0.07, 2.4, M.dark, 4), p[0], 1.8, p[2], HP)); if (k % 2 === 0) { const b = mesh(new THREE.SphereGeometry(0.26, 8, 6), S.team, false); b.position.set(p[0], 3.1, p[2]); rg.add(b); } }
  }
  for (let k = 0; k < 8; k++) lampAt(g, M, ...pol(k * PI / 4 + PI / 8, 13.2, 1.4), 0.24);
  topLabel(g, 'MCRN SCI', 0, 0.9, -11.5, 1.1, PI * 0);
  for (const [x, y, z, k] of [[6, 0.9, 9.5, 1], [8.6, 0.9, 9.5, 2]]) g.add(at(container(M, S, 2.2, 2.2, 4.4, k), x, y, z));
  return g;
});

/* GESCHÜTZPLATTFORM – kleiner Fels mit gepanzertem Achteck-Barbettenring; darauf ein schwerer Drehturm
   (aim), Rohre nach vorn. Daneben Munitionsbunker mit Förderband, Feuerleitmast mit drehendem Radar.
   Stufe I: eine Zwillings-Autokanone. Stufe II: zwei Autokanonen auf breitem Drehteller.
   Stufe III: zwei Autokanonen und eine Railgun in der Mitte, Kondensatorbank hinten. */
regB('turret', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M);
  g.add(rock({ rx: 18, ry: 12, rz: 17.5, cy: -6, top: 0, rim: 1.8, rimIn: 0.66, rimOut: 0.88, seed: 61, det: 10, craters: 6 }));
  g.add(prism([[0.01, -3], [10.2, -3], [11.0, -0.6], [11.0, 1.9], [9.9, 3.0], [0.01, 3.0]], M.hull2, 8));
  g.add(ring(10.95, 11.2, 0.4, 1.2, X.hazard, 8, 0.3));
  prismWin(g, M, 11.0, 1.65, 0.45, 8, 0.4, 1, [0, 4]);
  g.add(ring(6.7, 7.7, 3.0, 3.35, M.dark, 16));
  for (let k = 0; k < 4; k++) g.add(at(bar(0.8, 0.12, 2.6, M.trim), ...pol(k * HP + PI / 4, 8.9, 3.06)).rotateY(k * HP + PI / 4));
  for (let k = 0; k < 8; k++) lampAt(g, M, ...pol(k * PI / 4 + PI / 8, 10.4, 3.2), 0.22);
  /* Drehturm */
  const h = new THREE.Group(); h.position.y = 3.35; h.userData.aim = { phase: 0.3, base: 0 }; g.add(h);
  const wid = lv === 1 ? 6.0 : 6.6;
  h.add(prism([[0.01, 0], [wid, 0], [wid, 0.9], [wid - 0.6, 1.4], [0.01, 1.4]], M.hull, 8));
  h.add(at(sl(lv === 1 ? 7 : 10, 2.6, 3.4, M.hull2, 0.4), 0, 2.4, -4.6)); h.add(at(hazBar(M, lv === 1 ? 7.1 : 10.1, 0.5, 3.5, 0.3), 0, 2.2, -4.6));
  h.add(at(bar(0.9, 0.12, 3.0, M.trim), lv === 1 ? 2.4 : 3.6, 3.76, -4.6)); h.add(at(bar(0.9, 0.12, 3.0, M.trim), lv === 1 ? -2.4 : -3.6, 3.76, -4.6));
  const can = (x, s, seed) => { const c = cannon(M, s, 2, 3.6, seed, M.hull); delete c.userData.sway; delete c.userData.turret; c.position.set(x, 1.4, 0.6); h.add(c); };
  if (lv === 1) can(0, 2.7, 11);
  else if (lv === 2) { can(-3.1, 2.3, 12); can(3.1, 2.3, 13); }
  else { can(-4.0, 2.15, 12); can(4.0, 2.15, 13);
    h.add(at(sl(2.6, 2.2, 7, M.hull, 0.35, 0.8, 0.9), 0, 2.5, -0.4));
    const rl = rail(M, 15, 1.05, 2.4); rl.position.set(0, 3.3, 2.2); h.add(rl);
    for (const s of [-1, 1]) { h.add(at(cyl(0.6, 0.6, 3.0, M.dark, 8), s * 1.4, 4.3, -4.6, 0, HP)); h.add(at(bar(0.12, 0.25, 2.6, X.railGlow), s * 1.4, 4.95, -4.6, 0, HP)); }
  }
  /* Munitionsbunker mit Förderband, Feuerleitmast */
  { const b = new THREE.Group(); place(g, b, PI + 0.5, 13.6, 0); b.add(slab0(6, 2.8, 4.4, M.hull, 0, -0.4, 0, 0.4)); b.add(at(hazBar(M, 6.1, 0.5, 4.5, 0.25), 0, 1.6, 0)); b.add(at(bar(5, 0.12, 0.8, M.trim), 0, 2.46, 0)); winAt(b, M, 3.4, 0.4, 0, 1.1, 2.23, 0); }
  pipe(g, [pol(PI + 0.5, 11.6, 1.6), pol(PI + 0.4, 9.6, 2.4)], 0.42, M.dark);
  { const m = new THREE.Group(); const p = pol(-1.05, 14.2, 0); m.position.set(p[0], 0, p[2]); g.add(m); m.add(slab0(2.6, 0.8, 2.6, M.hull2, 0, -0.2, 0, 0.2)); const l = lattice(M, 6.5, 1.8, 0.8, 3, 0.12); l.position.y = 0.6; m.add(l);
    const rd = new THREE.Group(); rd.position.y = 7.4; rd.userData.spin = { axis: 'y', speed: 0.9 }; rd.add(at(sl(4.6, 0.9, 0.5, M.hull2, 0.12), 0, 0.3, 0)); rd.add(at(bar(0.3, 0.6, 0.3, M.dark), 0, -0.3, 0)); m.add(rd); beacon(m, M.red, 0, 8.4, 0, 0.2, 0.7); }
  return g;
});

/* FLAKPLATTFORM – Achteckdeck auf dem Fels, außen auf Sponsons die PDC-Türme (Gatling, schwenken einzeln),
   in der Mitte der Feuerleitturm bzw. die Kanone. Stufe I: zwei PDC und Feuerleitradar. Stufe II: drei PDC
   und eine leichte Autokanone. Stufe III: vier PDC und eine mittlere Autokanone, Radar auf eigenem Mast. */
regB('flak', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M);
  g.add(rock({ rx: 21, ry: 14, rz: 20.5, cy: -7, top: 0, rim: 2, rimIn: 0.66, rimOut: 0.88, seed: 71, det: 11, craters: 6 }));
  g.add(prism([[0.01, -1], [13.2, -1], [13.2, 1.0], [12.4, 1.6], [0.01, 1.6]], M.hull2, 8));
  g.add(ring(13.15, 13.4, -0.2, 0.6, X.hazard, 8, 0.3));
  for (let k = 0; k < 4; k++) g.add(at(sl(6.4, 0.3, 6.4, k % 2 ? M.hull : S.deck, 0.1), ...pol(k * HP + PI / 4, 5.6, 1.75)).rotateY(PI / 4));
  const n = lv + 1, a0 = lv === 2 ? PI / 3 : PI / 4;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * TAU / n, sp = new THREE.Group(), p = pol(a, 14.2, 0); sp.position.set(p[0], 0, p[2]); g.add(sp);
    sp.add(prism([[0.01, -4], [3.0, -4], [3.6, -1.5], [3.6, 2.2], [3.0, 2.8], [0.01, 2.8]], M.hull, 8));
    sp.add(ring(3.55, 3.75, 1.0, 1.6, X.hazard, 8, 0.2));
    sp.add(at(sl(2.6, 1.2, 4, M.dark, 0.2), ...pol(a + PI, 3.6, 1.4)).rotateY(a));
    lampAt(sp, M, ...pol(a + HP, 3.4, 2.9), 0.2); lampAt(sp, M, ...pol(a - HP, 3.4, 2.9), 0.2);
    const pd = aimed(pdc(M, 2.3, 20 + i), i * 1.9, a); pd.position.y = 2.8; sp.add(pd);
  }
  /* Mitte */
  if (lv === 1) {
    g.add(prism([[0.01, 1.6], [4.2, 1.6], [4.2, 4.6], [3.4, 5.4], [0.01, 5.4]], M.hull, 8)); prismWin(g, M, 4.2, 3.4, 0.5, 8, 0.6);
    const l = lattice(M, 5, 2.2, 1, 2, 0.14); l.position.y = 5.4; g.add(l);
    const rd = new THREE.Group(); rd.position.y = 10.8; rd.userData.spin = { axis: 'y', speed: 0.9 }; rd.add(at(sl(6, 1.1, 0.6, M.hull2, 0.15), 0, 0.2, 0)); rd.add(at(bar(0.4, 0.8, 0.4, M.dark), 0, -0.5, 0)); g.add(rd);
    beacon(g, M.red, 0, 11.9, 0, 0.24, 0.7);
  } else {
    g.add(prism([[0.01, 1.6], [4.6, 1.6], [4.6, 3.6], [4.0, 4.2], [0.01, 4.2]], M.hull, 8)); prismWin(g, M, 4.6, 2.7, 0.45, 8, 0.6);
    const c = aimed(cannon(M, lv === 2 ? 1.9 : 2.5, lv === 2 ? 1 : 2, lv === 2 ? 3.6 : 3.4, 33 + lv, M.hull), 0.9, 0); c.position.y = 4.2; g.add(c);
    const m = new THREE.Group(); const p = pol(PI, 9.6, 1.6); m.position.set(p[0], p[1], p[2]); g.add(m); const l = lattice(M, 6, 1.6, 0.8, 2, 0.12); m.add(l);
    const rd = new THREE.Group(); rd.position.y = 6.8; rd.userData.spin = { axis: 'y', speed: 0.9 }; rd.add(at(sl(4.6, 0.9, 0.5, M.hull2, 0.12), 0, 0.2, 0)); m.add(rd); beacon(m, M.red, 0, 7.6, 0, 0.2, 0.7);
  }
  /* Munitionskästen und Teamstreifen auf dem Deck */
  for (let k = 0; k < 4; k++) { const a = k * HP; if (lv >= 2 && a === PI) continue; g.add(at(sl(2.4, 1.2, 1.6, S.rust, 0.2), ...pol(a, 9.2, 2.2)).rotateY(a)); }
  for (let k = 0; k < 4; k++) g.add(at(bar(0.7, 0.1, 5.5, M.trim), ...pol(k * HP, 11.4, 1.66)).rotateY(k * HP));
  return g;
});

/* KOMMANDORELAIS – Gittermast auf dem Fels mit Richtfunk-Ringen (drehen langsam, gegenläufig) und Leuchtfeuer
   an der Spitze; quer über den Fels zwei Phased-Array-Felder, Abspannseile, Gerätehaus.
   Stufe I: ein Antennenring. Stufe II: zwei Ringe und eine Richtschüssel. Stufe III: drei Ringe, höherer Mast. */
regB('relay', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M), H = lv === 3 ? 19 : 17;
  g.add(rock({ rx: 17.5, ry: 12, rz: 17, cy: -6, top: 0, rim: 1.8, rimIn: 0.66, rimOut: 0.88, seed: 83, det: 10, craters: 6 }));
  g.add(prism([[0.01, -1], [4.6, -1], [4.6, 1.4], [3.8, 2.0], [0.01, 2.0]], M.hull, 8)); g.add(ring(4.55, 4.8, 0.2, 0.9, X.hazard, 8, 0.25));
  const l = lattice(M, H, 3.6, 1.0, Math.round(H / 2.6), 0.17); l.position.y = 2; g.add(l);
  g.add(at(cyl(0.12, 0.2, 3.5, M.dark, 6), 0, H + 3.6, 0, HP));
  g.add(at(sl(1.6, 0.8, 1.6, M.hull2, 0.2), 0, H + 2.3, 0));
  beacon(g, S.team, 0, H + 5.6, 0, 0.42, 0.8);
  /* Ringe */
  const rings = [[H * 0.62, 7.6, 1], [H * 0.84, 5.4, -1], [H * 0.4, 9.8, 1]].slice(0, lv);
  rings.forEach(([y, r, dir], i) => {
    const w = (3.6 + (1.0 - 3.6) * (y - 2) / H) / 2, rg = new THREE.Group(); rg.position.y = y; rg.userData.spin = { axis: 'y', speed: 0.22 * dir }; g.add(rg);
    rg.add(ring(r - 0.3, r + 0.3, -0.25, 0.25, M.hull2, 24));
    rg.add(ring(w + 0.1, w + 0.7, -0.4, 0.4, M.dark, 8));
    for (let k = 0; k < 4; k++) { const a = k * HP + PI / 4; rg.add(beam(pol(a, w + 0.6, 0), pol(a, r - 0.2, 0), 0.22, M.dark)); }
    const nd = 6 + i * 2;
    for (let k = 0; k < nd; k++) { const a = k * TAU / nd; const p = pol(a, r, 0); rg.add(at(bar(0.12, 2.6, 0.12, M.dark), p[0], 1.2, p[2])); rg.add(at(sl(0.7, 0.5, 0.7, M.hull, 0.1), p[0], 0.3, p[2])); if (k % 2 === 0) { const b = mesh(new THREE.SphereGeometry(0.17, 6, 4), S.team, false); b.position.set(p[0], 2.6, p[2]); rg.add(b); } }
  });
  /* Phased-Array-Felder (quer) */
  for (const s of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(s * 12.5, 0, 0); f.rotation.z = -s * 0.42; g.add(f);
    f.add(at(sl(0.8, 7.8, 13, M.hull2, 0.2), 0, 4.3, 0));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) f.add(at(bar(0.25, 1.2, 1.3, (i + j) % 3 ? M.dark : M.hull), s * 0.5, 1.4 + i * 1.45, -5.6 + j * 1.6));
    f.add(at(bar(0.12, 0.2, 12.4, M.trim), s * 0.47, 8.0, 0));
    for (const z of [-4.6, 4.6]) g.add(beam([s * 10.6, 0.2, z], [s * 13.8, 3.6, z], 0.5, M.dark));
    g.add(at(sl(4.4, 0.8, 14, M.hull2, 0.2), s * 11.7, 0.1, 0));
  }
  /* Abspannseile, Gerätehaus */
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + PI / 6; anchor(g, M, [Math.sin(a) * 1, H * 0.9 + 2, Math.cos(a) * 1], pol(a, 15.5, 0.3), 0.12); }
  { const b = new THREE.Group(); place(g, b, PI, 7.8, 0); b.add(module(M, 6.4, 3.6, 7.5, {})); for (let i = 0; i < 2; i++) b.add(at(container(M, S, 2, 2, 4, i + 1), 5.2, 1, 2 + i * 0.3 - i * 4.2)); }
  if (lv >= 2) { const dd = dish(M, 3.0, 0.7, 0.2); dd.position.set(...pol(0.3, 11.5, 0.4)); g.add(dd); g.add(at(slab0(3.6, 0.6, 3.6, M.hull2, 0, -0.2, 0, 0.2), ...pol(0.3, 11.5, 0))); }
  return g;
});

/* MASSETREIBER – Superwaffe: großer Asteroid, in der Mitte ein Drehsockel, darauf schwenkt die ganze lange
   Beschleunigerschiene (aim): zwei schwere Schienen mit Kiel, Spulenrahmen, die mit der Ladung nacheinander
   aufleuchten (chargeAt), hinten das Ladewerk mit Erztrichter, vorn die Mündung. Das Geschoss (ein Brocken aus
   dem Asteroiden) glüht mit der Ladung (charge). Auf dem Fels Kondensatorbänke, Kühlrippen, Leitbunker – alles
   flach, damit die Schiene darüber schwenken kann.
   Stufe I: 74 lang, 8 Spulen, eine Kondensatorbank. Stufe II: 86 lang, 11 Spulen, Rückenfachwerk, zwei Bänke.
   Stufe III: 98 lang, 14 Spulen, Seilverspannung, drei Bänke, Ladekranz um den Sockel. */
regB('super', (M, d, lv) => {
  const g = new THREE.Group(), X = xm(M), S = sm(M);
  g.add(rock({ rx: 49, ry: 29, rz: 48, cy: -14.5, top: 0, rim: 4, rimIn: 0.66, rimOut: 0.88, seed: 97, det: 15, craters: 10 }));
  const z0 = lv === 1 ? -28 : lv === 2 ? -34 : -42, z1 = lv === 1 ? 44 : lv === 2 ? 50 : 55, nCoil = lv === 1 ? 8 : lv === 2 ? 11 : 14;
  /* Drehsockel */
  g.add(prism([[0.01, -0.5], [16, -0.5], [16, 5.5], [13.2, 10], [0.01, 10]], M.hull, 8));
  prismWin(g, M, 16, 3.2, 1.8, 8, 0.6, 2);
  g.add(ring(15.9, 16.3, 0.4, 1.4, X.hazard, 8, 0.35));
  g.add(ring(11.2, 13.0, 10, 10.9, X.hazard, 24, 0.4));
  const tw = new THREE.Group(); tw.position.y = 10.9; tw.userData.aim = { phase: 0.4, base: 0 }; g.add(tw);
  tw.add(prism([[0.01, 0], [12, 0], [12, 1.6], [11, 2.4], [0.01, 2.4]], M.hull2, 8));
  const piv = 10.6;
  for (const s of [-1, 1]) { tw.add(at(sl(3.6, 10.4, 11, M.hull, 0.6, 1, 0.85), s * 7.0, 2.4 + 5.2, 0)); tw.add(at(hazBar(M, 3.7, 0.6, 11.1, 0.3), s * 7.0, 4, 0)); tw.add(at(cyl(2.4, 2.4, 1.2, M.dark, 8), s * 7.6, piv, 0, 0, HP)); tw.add(at(bar(0.12, 0.8, 7, M.trim), s * 8.85, 6.6, 0)); }
  tw.add(at(cyl(1.4, 1.4, 13.4, M.dark, 8), 0, piv, 0, 0, HP));
  /* Schiene */
  const B = new THREE.Group(); B.position.y = piv; B.rotation.x = -0.1; tw.add(B);
  const L = z1 - z0, zm = (z0 + z1) / 2;
  for (const s of [-1, 1]) { B.add(at(sl(2.4, 4.2, L, M.hull2, 0.5), s * 3.0, 0, zm)); B.add(at(bar(0.35, 0.35, L - 2, X.railGlow), s * 1.78, 0.6, zm)); B.add(at(bar(0.35, 0.35, L - 2, X.railGlow), s * 1.78, -0.6, zm)); B.add(at(hazBar(M, 2.45, 0.5, L - 6, 0.4), s * 3.0, 1.6, zm)); }
  B.add(at(sl(3.6, 0.8, L - 3, M.dark, 0.12), 0, 1.7, zm)); B.add(at(bar(1.0, 0.1, L - 5, X.railGlow), 0, 2.12, zm));
  B.add(at(sl(5.6, 2.2, L - 8, M.hull2, 0.5), 0, -2.9, zm - 2));
  B.add(at(sl(3.2, 2.2, 8, M.hull, 0.4), 0, -2.8, 0));
  for (let i = 0; i < nCoil; i++) {
    const z = z0 + 10 + i * (z1 - 5 - (z0 + 10)) / (nCoil - 1), c = new THREE.Group(); c.position.z = z; B.add(c);
    const fr = ring(4.6, 6.6, -0.9, 0.9, i % 3 === 1 ? M.hull : M.hull2, 8); fr.rotation.x = HP; c.add(fr);
    const gl = ring(4.7, 6.3, -1.0, 1.0, S.coilDim, 8); gl.rotation.x = HP; gl.userData.chargeAt = 0.04 + 0.9 * i / nCoil; c.add(gl);
    const gt = bar(2.0, 0.25, 1.4, S.coil); gt.position.y = 6.75; gt.userData.chargeAt = 0.04 + 0.9 * i / nCoil; c.add(gt);
    for (const s of [-1, 1]) c.add(at(bar(0.6, 0.6, 2.0, M.dark), s * 5.9, -2.8, 0));
    c.add(at(bar(2.6, 0.5, 2.0, M.dark), 0, 6.6, 0));
  }
  /* Ladewerk hinten: Kasten, Trichter mit Gesteinsbrocken, Warnbänder */
  { const zb = z0 - 3; B.add(at(sl(10, 8, 9, M.hull, 0.7), 0, -0.6, zb)); B.add(at(hazBar(M, 10.1, 0.8, 9.1, 0.4), 0, 2.6, zb));
    B.add(at(sl(7.4, 3.2, 6.6, S.rust, 0.5, 1.2, 1), 0, 4.6, zb)); for (let i = 0; i < 5; i++) { const bo = boulder(1.0 + (i % 3) * 0.3, 300 + i); bo.position.set(-2 + (i % 3) * 2, 6.2, zb - 1.6 + (i > 2 ? 2.6 : 0)); B.add(bo); }
    winAt(B, M, 6, 0.5, 5.03, 0, zb, HP); winAt(B, M, 6, 0.5, -5.03, 0, zb, -HP);
    B.add(at(bar(8, 0.14, 0.9, M.trim), 0, 3.42, zb + 3.8)); }
  /* Geschoss im Verschluss: Gesteinsbrocken mit glühender Hülle */
  { const sz = z0 + 4.5, rk = boulder(1.5, 404, 0.9); rk.position.set(0, 0, sz); B.add(rk);
    const sh = mesh(new THREE.SphereGeometry(2.3, 12, 8), S.coilHot, false); sh.position.set(0, 0, sz); sh.userData.charge = true; sh.material = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd0ff').multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }); B.add(sh); }
  /* Mündung */
  { B.add(at(sl(11, 11, 4.4, M.hull2, 1.0, 0.9, 0.9), 0, 0, z1 - 2.2)); const mr = ring(2.6, 3.9, -2.4, 2.4, M.dark, 8); mr.rotation.x = HP; mr.position.z = z1 - 1.5; B.add(mr);
    for (const s of [-1, 1]) B.add(at(hazBar(M, 0.7, 11.1, 4.5, 0.4), s * 5.2, 0, z1 - 2.2)); B.add(at(hazBar(M, 11.1, 0.7, 4.5, 0.4), 0, 5.2, z1 - 2.2));
    const mg = mesh(new THREE.CircleGeometry(2.2, 16), S.coilDim, false); mg.position.z = z1 + 0.06; mg.userData.charge = true; B.add(mg);
    for (const s of [-1, 1]) lampAt(B, M, s * 3.6, 4.6, z1 - 0.2, 0.3); }
  if (lv >= 2) { const tr = truss(M, L - 16, 4.4, 2.4, Math.round((L - 16) / 5), M.dark, 0.26); tr.position.set(0, 8.4, zm + 2); B.add(tr); for (let z = z0 + 10; z < z1 - 8; z += 10) B.add(beam([0, 7.0, z], [0, 7.4, z], 0.6, M.dark)); }
  if (lv >= 3) { const zt = zm + 2 - (L - 16) / 2; B.add(at(sl(2, 5, 2, M.dark, 0.3), 0, 11.5, zt + 3)); for (const s of [-1, 1]) { B.add(beam([s * 0.6, 14, zt + 3], [s * 1.8, 2.5, z1 - 5], 0.18, M.dark)); B.add(beam([s * 0.6, 14, zt + 3], [s * 1.8, 3.0, z0 + 6], 0.18, M.dark)); } }
  /* Kondensatorbänke, Rippen, Bunker (flach, unter dem Schwenkbereich) */
  const bank = (a) => { const b = new THREE.Group(); place(g, b, a, 29, 0); b.add(slab0(16, 1.0, 8, M.hull2, 0, -0.3, 0, 0.3)); for (let i = 0; i < 6; i++) for (const z of [-2, 2]) { const x = -6.5 + i * 2.6; b.add(at(cyl(1.0, 1.0, 5.4, i % 2 ? M.hull : M.dark, 8), x, 3.4, z, HP)); b.add(at(cyl(1.05, 1.05, 0.35, S.coil, 8), x, 4.6, z, HP)); } b.add(at(hazBar(M, 16.1, 0.5, 8.1, 0.4), 0, 0.6, 0)); pipe(b, [[0, 1.2, -4.2], [0, 1.2, -9], [0, 3.6, -12.2]], 0.6, M.dark); };
  bank(2.3); if (lv >= 2) bank(-2.3); if (lv >= 3) bank(0.0);
  for (const a of [HP, -HP]) { const f = finArray(M, lv >= 2 ? 6 : 4, 4.2, 9, 1.6); place(g, f, a, 27, 0); f.rotation.y = a + HP; }
  { const b = new THREE.Group(); place(g, b, PI, 27, 0); b.add(module(M, 7, 4.4, 10, { rows: 1 })); const dd = dish(M, 2.2, 0.6, 0.2); dd.position.set(0, 4.8, 3); b.add(dd); }
  if (lv >= 3) for (let k = 0; k < 8; k++) { const p = pol(k * PI / 4 + PI / 8, 18.4, 0); g.add(at(sl(2.2, 4.4, 2.2, M.dark, 0.3), p[0], 2.2, p[2])); const lt = mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), S.coil, false); lt.position.set(p[0], 4.66, p[2]); lt.userData.chargeAt = (k + 1) / 9; g.add(lt); }
  for (let k = 0; k < 12; k++) lampAt(g, M, ...pol(k * TAU / 12 + 0.13, 16.2, 1.6), 0.26);
  topEmblem(g, M, ...pol(PI * 0.75, 21), 3.4);
  return g;
});

export default regB;
