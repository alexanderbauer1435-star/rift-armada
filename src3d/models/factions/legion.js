/* =====================================================================
   GOLDEN LEGION – Formensprache: fliegende Kathedralen und Ritter-Heldenschiffe. Elfenbeinrumpf mit Satteldach und
   Kiel, schwere Goldkanten, Türme mit Spitzhelmen und Fialen, Strebebögen an den Flanken, Spitzbogen- und Rosenfenster
   aus leuchtendem Buntglas, Bug als Rammsporn oder Lichtlanze (Gold + Kristall), Banner und Finnen, Heiligenschein
   hinter den Heldenschiffen, warmes goldweißes Triebwerkslicht. Heldenschiffe tragen Cherub-Begleitdrohnen (Orbit).
   Bug +Z, oben +Y, Länge = data len. Hilfsteile werden je Schlüssel einmal gebaut (Geometrie geteilt); jedes Schiff
   wird je Materialsatz einmal gebaut, statische Teile je Material zusammengefasst und dann nur noch geklont.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { register, hull, box, cyl, sphere, at, both, mirror, engine, turret, antenna, navLight, strip, decal, greebles, mesh, ngon, loft, oct, tube } from '../kit.js';

const PI = Math.PI, TAU = PI * 2;
/* Geometrie-Cache */
const GC = {};
const G = (k, f) => GC[k] || (GC[k] = f());

/* ------------------------------------------------------------ Zusatzmaterialien (je Materialsatz) */
const XM = new WeakMap();
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function xm(M) {
  let X = XM.get(M); if (X) return X;
  const add = (col, k, o) => new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(col).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, o));
  /* Banner: Karmesin, Goldrand, geflügelte Sonne, Schwalbenschwanz (Alpha) */
  const banner = cv(128, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5a0a14'); g.addColorStop(0.5, '#8e1424'); g.addColorStop(1, '#5a0a14');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, h); x.lineTo(w / 2, h * 0.8); x.lineTo(0, h); x.closePath(); x.fill();
    x.strokeStyle = '#e2b54a'; x.lineWidth = 7; x.beginPath(); x.moveTo(5, 4); x.lineTo(w - 5, 4); x.lineTo(w - 5, h - 12); x.lineTo(w / 2, h * 0.8 - 6); x.lineTo(5, h - 12); x.closePath(); x.stroke();
    x.fillStyle = '#f0c75a'; x.beginPath(); x.arc(w / 2, 92, 16, 0, TAU); x.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 18, 92 + Math.sin(a) * 18); x.lineTo(w / 2 + Math.cos(a + 0.12) * 30, 92 + Math.sin(a + 0.12) * 30); x.lineTo(w / 2 + Math.cos(a + 0.25) * 18, 92 + Math.sin(a + 0.25) * 18); x.fill(); }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(w / 2 + s * (28 + k * 8), 84 + k * 5, 6, 20 - k * 3, s * (0.9 + k * 0.15), 0, TAU); x.fill(); }
    x.fillRect(w / 2 - 3, 120, 6, 50); x.fillRect(w / 2 - 14, 132, 28, 6);
  });
  banner.wrapS = banner.wrapT = THREE.ClampToEdgeWrapping;
  /* weicher Lichtkranz (radialer Verlauf) */
  const hz = cv(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,230,170,0)'); g.addColorStop(0.55, 'rgba(255,220,150,0.05)'); g.addColorStop(0.8, 'rgba(255,214,130,0.55)'); g.addColorStop(0.9, 'rgba(255,214,130,0.25)'); g.addColorStop(1, 'rgba(255,214,130,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const glowDot = cv(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,215,140,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const fire = M.plume.clone(); fire.color = new THREE.Color('#ff7a26').multiplyScalar(1.6);
  X = {
    crystal: new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: '#ffc85a', emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.92, flatShading: true }),
    core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2cf').multiplyScalar(3.2) }),
    haze: add('#ffffff', 1.4, { map: hz }),
    dot: add('#ffffff', 1.6, { map: glowDot }),
    shield: add('#ffd98a', 0.55, { opacity: 0.1 }),
    beam: add('#ffd27a', 1.4, { opacity: 0.35 }),
    banner: new THREE.MeshStandardMaterial({ map: banner, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.75, emissive: '#3a0610', emissiveIntensity: 0.6 }),
    fire,
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a2a').multiplyScalar(3) }),
    lens: new THREE.MeshStandardMaterial({ color: '#2a1a08', metalness: 0.9, roughness: 0.04, emissive: '#ffb347', emissiveIntensity: 0.55 }),
    ember: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3a').multiplyScalar(2.6) }),
    crimson: new THREE.MeshStandardMaterial({ color: '#8a1622', metalness: 0.45, roughness: 0.38, emissive: '#3a0610', emissiveIntensity: 0.4, bumpMap: M.hull.bumpMap, bumpScale: 0.4 }),
    spr: new THREE.SpriteMaterial({ map: glowDot, color: new THREE.Color('#ffe2a0').multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  };
  XM.set(M, X); return X;
}

/* ------------------------------------------------------------ Grundformen */
/* gotischer Querschnitt (8 Punkte): Kiel unten, senkrechte Wände, Satteldach */
function gsec(w, h, roof = h * 0.35, keel = h * 0.3, dy = 0) {
  const a = w / 2, b = h / 2;
  return [[a * 0.62, -b], [a, -b * 0.3], [a, b], [0, b + roof], [-a, b], [-a, -b * 0.3], [-a * 0.62, -b], [0, -b - keel]].map(([x, y]) => [x, y + dy]);
}
/* Rumpf aus gotischen Querschnitten: prof = [[z, w, h, roof, keel, dy], …] hinten → vorn */
function ghull(prof, mat, opts) { return loft(prof.map(([z, w, h, roof, keel, dy]) => ({ z, pts: gsec(w, h, roof, keel, dy) })), mat, opts); }
/* Profilwerte bei z (linear zwischen den Stützstellen) */
function profAt(prof, z) { for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; if (z >= a[0] && z <= b[0]) { const t = (z - a[0]) / (b[0] - a[0]); return a.map((v, k) => (v || 0) + (((b[k] || 0) - (v || 0)) * t)); } } return null; }
/* Rumpfbänder: schmale Ringe (etwas größer als der Rumpf) an den Stellen zs – Gliederung wie Spanten */
function bands(g, prof, zs, mat, d = 0.5, grow = 0.3) {
  for (const z of zs) { const p = profAt(prof, z); if (!p) continue; const [, w, h, roof, keel, dy] = p; g.add(ghull([[z - d / 2, w + grow, h + grow, roof + grow * 0.3, keel + grow * 0.3, dy], [z + d / 2, w + grow, h + grow, roof + grow * 0.3, keel + grow * 0.3, dy]], mat)); }
}
/* Teamfarben-Streifen (M.trim) auf dem Dachfirst zwischen z0 und z1 */
function ridge(g, M, P, z0, z1, w = 0.5) {
  const y = z => { const q = profAt(P, z); return q[2] / 2 + q[3] + (q[5] || 0) + 0.08; }, y0 = y(z0), y1 = y(z1);
  g.add(at(blk(w, 0.3, Math.hypot(z1 - z0, y1 - y0), M.trim), 0, (y0 + y1) / 2, (z0 + z1) / 2, -Math.atan2(y1 - y0, z1 - z0)));
}
/* Wandgliederung einer Seitenwand (Normale +X, mit both): Goldgesims oben, Sockelband unten, Lisenen bei zs */
function wallTrim(M, x, y0, y1, z0, z1, zs = []) {
  const g = new THREE.Group(), L = z1 - z0, zc = (z0 + z1) / 2;
  g.add(at(blk(0.34, 0.34, L, M.gold), x + 0.1, y1 - 0.12, zc));
  g.add(at(blk(0.3, 0.45, L, M.hull2), x + 0.08, y0 + 0.22, zc));
  for (const z of zs) { g.add(at(blk(0.3, y1 - y0, 0.5, M.hull), x + 0.1, (y0 + y1) / 2, z)); g.add(at(blk(0.42, 0.3, 0.7, M.gold), x + 0.16, y1 - 0.5, z)); }
  return g;
}
/* einfacher Quader ohne Fase (billig) */
function blk(w, h, d, mat) { return mesh(G('b' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), mat); }
/* Spitzbogen-Umriss (gleichseitiger Bogen), Unterkante y = 0, Mitte x = 0 */
function archPts(w, h, k = 3) {
  const rise = w * 0.866, hs = Math.max(0, h - rise), sy = Math.min(1, h / rise), p = [[-w / 2, 0], [w / 2, 0]];
  for (let i = hs > 0.01 ? 0 : 1; i <= k; i++) { const a = i / k * PI / 3; p.push([-w / 2 + w * Math.cos(a), hs + w * Math.sin(a) * sy]); }
  for (let i = 1; i <= (hs > 0.01 ? k : k - 1); i++) { const a = 2 * PI / 3 + i / k * PI / 3; p.push([w / 2 + w * Math.cos(a), hs + w * Math.sin(a) * sy]); }
  return p;
}
const v2 = (p, dx = 0, dy = 0) => p.map(([x, y]) => new THREE.Vector2(x + dx, y + dy));
function scaleUV(g, k) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return g; }
/* Fensterreihe für eine Seitenwand (Normale +X): Goldmaßwerk (extrudiert, zwei Lanzetten + Okulus) über Buntglas.
   list = [[z, y, w, h], …] (y = Unterkante). Mit both() beidseitig anbringen. */
function glassRow(M, list, f = 0.2) {
  const key = 'gr' + JSON.stringify(list) + f;
  const [gg, gs] = G(key, () => {
    const shapes = [], glass = [];
    for (const [z, y, w, h] of list) {
      const s = new THREE.Shape(v2(archPts(w + f * 2, h + f * 2), -z, y - f));
      if (w > 1.1) {
        const m = Math.max(0.12, w * 0.1), lw = (w - m) / 2, lh = h - w * 0.55;
        s.holes.push(new THREE.Path(v2(archPts(lw, lh), -z - (lw + m) / 2, y)), new THREE.Path(v2(archPts(lw, lh), -z + (lw + m) / 2, y)));
        const oc = new THREE.Path(); oc.absarc(-z, y + lh + w * 0.2 + 0.05, w * 0.2, 0, TAU, false); s.holes.push(oc);
      } else s.holes.push(new THREE.Path(v2(archPts(w, h), -z, y)));
      shapes.push(s); glass.push(new THREE.Shape(v2(archPts(w, h), -z, y)));
    }
    const g1 = new THREE.ExtrudeGeometry(shapes, { depth: 0.14, bevelEnabled: false, curveSegments: 4 }); g1.rotateY(PI / 2);
    const g2 = scaleUV(new THREE.ShapeGeometry(glass, 3), 0.13); g2.rotateY(PI / 2); g2.translate(-0.02, 0, 0);
    return [g1, g2];
  });
  const g = new THREE.Group(); g.add(mesh(gg, M.gold)); g.add(mesh(gs, M.stained, false)); return g;
}
/* gleichmäßige Fensterliste */
const row = (n, z0, z1, y, w, h) => Array.from({ length: n }, (_, i) => [n === 1 ? (z0 + z1) / 2 : z0 + (z1 - z0) * i / (n - 1), y, w, h]);
/* Rosenfenster, Normale +Z */
function rose(M, r, spokes = 8) {
  const g = new THREE.Group();
  g.add(mesh(G('rs' + r, () => new THREE.CircleGeometry(r, 24)), M.stained, false));
  g.add(mesh(G('rr' + r, () => new THREE.TorusGeometry(r, r * 0.1, 5, 28)), M.gold));
  g.add(at(mesh(G('ri' + r, () => new THREE.TorusGeometry(r * 0.4, r * 0.06, 4, 16)), M.gold), 0, 0, 0.03));
  const sg = G('rsp' + r, () => new THREE.BoxGeometry(r * 0.07, r * 0.6, r * 0.08).translate(0, r * 0.7, 0.03));
  for (let i = 0; i < spokes; i++) g.add(at(mesh(sg, M.gold), 0, 0, 0, 0, 0, i / spokes * TAU));
  const pg = G('rp' + r, () => new THREE.TorusGeometry(r * 0.16, r * 0.035, 3, 10));
  for (let i = 0; i < spokes; i++) { const a = (i + 0.5) / spokes * TAU; g.add(at(mesh(pg, M.gold), Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 0.03)); }
  g.add(mesh(G('rb' + r, () => new THREE.SphereGeometry(r * 0.15, 8, 6)), M.gold));
  return g;
}
/* Fiale: kleiner Vierkantpfeiler mit Goldspitze, Fuß bei y = 0 */
function pinnacle(M, r, h, mat) {
  const g = new THREE.Group();
  g.add(mesh(G('pb' + r + ',' + h, () => new THREE.CylinderGeometry(r * 0.8, r, h * 0.45, 4, 1).rotateY(PI / 4).translate(0, h * 0.225, 0)), mat || M.hull));
  g.add(mesh(G('pt' + r + ',' + h, () => new THREE.ConeGeometry(r * 0.85, h * 0.6, 4).rotateY(PI / 4).translate(0, h * 0.7, 0)), M.gold));
  return g;
}
/* Turm mit Spitzhelm: Achteckschaft (Radius r, Höhe h) mit Goldbändern, Lanzettfenstern, Galerie mit vier Fialen,
   Helm (Elfenbein, obere Hälfte Gold) und leuchtender Spitze. Fuß bei y = 0. */
function spire(M, r, h, roofH = r * 4.5, o = {}) {
  const g = new THREE.Group(), n = 8, k = r + ',' + h + ',' + roofH;
  g.add(mesh(G('ss' + k, () => new THREE.CylinderGeometry(r * 0.9, r, h, n, 1, false, -PI / 8).translate(0, h / 2, 0)), o.mat || M.hull));
  const bandG = G('sb' + r, () => new THREE.CylinderGeometry(r * 1.08, r * 1.08, Math.max(0.2, r * 0.22), n, 1, false, -PI / 8));
  g.add(at(mesh(bandG, M.gold), 0, h, 0)); g.add(at(mesh(bandG, M.gold), 0, h * 0.12, 0));
  if (h > r * 2.5) {
    /* Lanzetten auf vier Seiten */
    const wg = G('sw' + k, () => { const ww = r * 0.42, wh = Math.min(h * 0.45, r * 2.4); const s = new THREE.Shape(v2(archPts(ww, wh))); return scaleUV(new THREE.ShapeGeometry(s, 3), 0.3).translate(0, h * 0.42, r * 0.93 * Math.cos(PI / 8) * 0.97 + 0.04); });
    for (let i = 0; i < 4; i++) g.add(at(mesh(wg, M.stained, false), 0, 0, 0, 0, i * PI / 2 + (o.rot || 0), 0));
  }
  /* Galerie: vier Fialen */
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; g.add(at(pinnacle(M, r * 0.2, r * 1.5), Math.sin(a) * r * 0.95, h, Math.cos(a) * r * 0.95)); }
  /* Helm */
  g.add(at(mesh(G('sr' + k, () => new THREE.CylinderGeometry(r * 0.42, r * 0.88, roofH * 0.5, n, 1, false, -PI / 8).translate(0, roofH * 0.25, 0)), o.roofMat || M.hull), 0, h, 0));
  g.add(at(mesh(G('sg' + k, () => new THREE.ConeGeometry(r * 0.42, roofH * 0.5, n, 1, false, -PI / 8).translate(0, roofH * 0.75, 0)), M.gold), 0, h, 0));
  g.add(at(mesh(G('sk' + r, () => new THREE.TorusGeometry(r * 0.45, r * 0.07, 4, 12).rotateX(PI / 2)), M.gold), 0, h + roofH * 0.5, 0));
  const tip = mesh(G('st' + r, () => new THREE.OctahedronGeometry(r * 0.22, 0).scale(1, 2.2, 1)), M.glow, false); tip.position.y = h + roofH + r * 0.25; g.add(tip);
  return g;
}
/* Strebebogen: Bogen vom Pfeilerkopf a = [x, y] (außen) zur Wand b = [x, y] (innen); lokal in z = 0 */
function buttress(M, a, b, r = 0.3, mat) {
  const k = a + '|' + b + '|' + r;
  const geo = G('fb' + k, () => {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.abs(a[0] - b[0]) * 0.22, 0];
    return tube([[a[0], a[1], 0], mid, [b[0], b[1], 0]], r * 1.3, r * 0.8, mat || M.hull, 8, 5).geometry;
  });
  return mesh(geo, mat || M.hull);
}
/* Strebepfeiler mit Fiale: Pfeiler (w × h × d), Fuß bei y = 0 */
function pier(M, w, h, d) {
  const g = new THREE.Group();
  g.add(at(blk(w, h, d, M.hull), 0, h / 2, 0));
  g.add(at(blk(w * 1.15, h * 0.08, d * 1.15, M.gold), 0, h * 0.96, 0));
  g.add(at(pinnacle(M, w * 0.42, w * 2.6), 0, h, 0));
  return g;
}
/* Lichtlanze entlang +Z (Fuß bei z = 0, Spitze bei z = len): Goldschaft, Glutringe, Kristallspitze */
function lance(M, len, r = len * 0.05, rings = 3) {
  const g = new THREE.Group(), X = xm(M), k = len + ',' + r;
  g.add(mesh(G('ls' + k, () => new THREE.CylinderGeometry(r * 0.75, r, len * 0.78, 8).rotateX(PI / 2).translate(0, 0, len * 0.39)), M.gold));
  g.add(mesh(G('lb' + k, () => new THREE.CylinderGeometry(r * 1.9, r * 1.4, len * 0.12, 8).rotateX(PI / 2).translate(0, 0, len * 0.06)), M.gold));
  const rg = G('lr' + k, () => new THREE.TorusGeometry(r * 1.25, r * 0.28, 4, 12));
  for (let i = 0; i < rings; i++) { const c = mesh(rg, M.glowSoft, false); c.position.z = len * (0.38 + (i - (rings - 1) / 2) * 0.16); g.add(c); }
  g.add(mesh(G('lg' + k, () => new THREE.CylinderGeometry(r * 1.5, r * 0.75, len * 0.05, 8).rotateX(PI / 2).translate(0, 0, len * 0.75)), M.gold));
  const tip = mesh(G('lt' + k, () => new THREE.OctahedronGeometry(1, 0).scale(r * 1.3, r * 1.3, len * 0.15).translate(0, 0, len * 0.85)), X.crystal); g.add(tip);
  const core = mesh(G('lc' + k, () => new THREE.OctahedronGeometry(1, 0).scale(r * 0.55, r * 0.55, len * 0.11).translate(0, 0, len * 0.85)), X.core, false); g.add(core);
  return g;
}
/* Heiligenschein (Normale +Z): Leuchtring, Goldring mit Strahlenkranz (dreht langsam), weicher Lichtkranz */
function halo(M, r, rays = 16) {
  const g = new THREE.Group(), X = xm(M);
  g.add(mesh(G('hr' + r, () => new THREE.TorusGeometry(r, r * 0.04, 4, 48)), M.glow, false));
  const rg = new THREE.Group();
  rg.add(mesh(G('hg' + r, () => new THREE.TorusGeometry(r * 1.13, r * 0.03, 4, 40)), M.gold));
  const ray = G('hy' + r, () => new THREE.ConeGeometry(r * 0.045, r * 0.42, 4).translate(0, r * 0.21, 0));
  for (let i = 0; i < rays; i++) { const a = i / rays * TAU, s = mesh(ray, M.gold); s.position.set(Math.cos(a) * r * 1.13, Math.sin(a) * r * 1.13, 0); s.rotation.z = a - PI / 2; if (i % 2) s.scale.set(0.8, 0.5, 0.8); rg.add(s); }
  rg.userData.spin = { axis: 'z', speed: 0.12 }; g.add(rg);
  g.add(mesh(G('hh' + r, () => new THREE.PlaneGeometry(r * 2.5, r * 2.5)), X.haze, false));
  return g;
}
/* Banner (Karmesin, Goldrand), hängt von y = 0 nach unten, Ebene Y-Z (sichtbar von der Seite) */
function banner(M, w, h, phase = 0) {
  const g = new THREE.Group(), X = xm(M);
  const b = mesh(G('bn' + w + ',' + h, () => new THREE.PlaneGeometry(w, h).rotateY(PI / 2).translate(0, -h / 2, 0)), X.banner, false); g.add(b);
  g.add(at(mesh(G('bp' + w, () => new THREE.CylinderGeometry(w * 0.04, w * 0.04, w * 1.25, 6).rotateX(PI / 2)), M.gold), 0, 0, 0));
  g.userData.sway = { axis: 'z', amp: 0.06, speed: 1.1, phase };
  return g;
}
/* Rückenfinne mit Goldkante (Ebene Y-Z) */
function fin(M, len, h, sweep = 0.5, mat) {
  const g = new THREE.Group();
  const geo = G('fn' + len + ',' + h + ',' + sweep, () => { const s = new THREE.Shape(v2([[-len / 2, 0], [len / 2, 0], [len / 2 - len * sweep * 0.3, h * 0.35], [-len / 2 + len * (1 - sweep), h], [-len / 2 - len * 0.1, h * 0.9]])); const e = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); e.translate(0, 0, -0.15); e.rotateY(-PI / 2); return scaleUV(e, 1 / 30); });
  g.add(mesh(geo, mat || M.hull));
  const eg = G('fe' + len + ',' + h + ',' + sweep, () => { const p = [[len / 2, 0], [len / 2 - len * sweep * 0.3, h * 0.35], [-len / 2 + len * (1 - sweep), h], [-len / 2 - len * 0.1, h * 0.9]]; return tube(p.map(([z, y]) => [0, y, -z]), 0.18, 0.12, M.gold, 12, 4).geometry; });
  g.add(mesh(eg, M.gold));
  return g;
}
/* Triebwerk der Legion: Düse mit goldenem Achteck-Kragen */
function lengine(M, r, len = r * 1.3, plume = r * 6) {
  const g = engine(M, r, len, plume);
  g.add(at(mesh(G('ec' + r, () => new THREE.CylinderGeometry(r * 1.32, r * 1.22, r * 0.5, 8, 1, false, PI / 8).rotateX(PI / 2)), M.gold), 0, 0, -len * 0.05));
  return g;
}
/* Namensschild (Seitenwand, Normale +X) */
function nameplate(g, txt, x, y, z, s, side = 1) { const d = decal(txt, s * 5, s, '#f0c860', 'bold 64px "DejaVu Serif", serif'); d.position.set(x, y, z); if (side < 0) d.rotation.y = -PI / 2; g.add(d); }

/* ------------------------------------------------------------ Cherub (Begleitdrohne) */
/* Flügel: Fläche mit gewellter Hinterkante (Federn), Ebene X-Z, Wurzel bei x = 0 */
const wingGeo = () => G('wing', () => {
  const s = new THREE.Shape(v2([[0, 0.9], [1.6, 1.9], [3.6, 2.1], [5.4, 1.2], [6.2, -0.2], [5.2, -0.9], [4.9, -0.5], [4.1, -1.7], [3.8, -1.0], [2.9, -2.4], [2.6, -1.4], [1.6, -2.6], [1.2, -1.4], [0, -0.8]]));
  const e = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }); e.translate(0, 0, -0.08); e.rotateX(PI / 2); return scaleUV(e, 1 / 20);
});
function cherubModel(M) {
  const g = new THREE.Group(), X = xm(M);
  g.add(hull([[-3.2, 0.6, 0.6, 0.2], [-1.6, 2, 1.8, 0.6], [0.8, 2.3, 2.1, 0.7], [2.5, 1.6, 1.6, 0.5], [3.4, 0.5, 0.5, 0.15]], M.hull));
  /* Goldmaske mit Auge */
  g.add(at(mesh(G('chm', () => new THREE.ConeGeometry(1.15, 2.4, 8).rotateX(PI / 2)), M.gold), 0, 0.15, 3.0));
  g.add(at(mesh(G('che', () => new THREE.OctahedronGeometry(0.5, 1)), M.glow, false), 0, 0.35, 3.5));
  g.add(at(mesh(G('chc', () => new THREE.TorusGeometry(1.05, 0.16, 3, 10)), M.gold), 0, 0, 1.9));
  /* Heiligenschein */
  g.add(at(mesh(G('chh', () => new THREE.TorusGeometry(1.15, 0.12, 3, 16)), M.glow, false), 0, 2.0, 1.4, -PI / 2 + 0.45));
  /* vier Flügel: oben groß (Gold, Elfenbein-Deckfedern), unten klein */
  const wg = wingGeo();
  for (const s of [1, -1]) {
    const w1 = mesh(wg, M.gold); w1.scale.set(s, 1, 1); w1.position.set(s * 0.7, 0.6, 0.2); w1.rotation.set(0, s * 0.18, s * 0.42); g.add(w1);
    const w2 = mesh(wg, M.hull); w2.scale.set(s * 0.62, 1, 0.62); w2.position.set(s * 0.8, 0.8, 0.6); w2.rotation.set(0, s * 0.18, s * 0.42); g.add(w2);
    const w3 = mesh(wg, M.gold); w3.scale.set(s * 0.6, 1, 0.55); w3.position.set(s * 0.7, -0.5, -0.6); w3.rotation.set(0, s * 0.5, -s * 0.45); g.add(w3);
  }
  /* Lichtnadel vorn, Schwanzsporn hinten, Triebwerk */
  g.add(at(mesh(G('chn', () => new THREE.CylinderGeometry(0.06, 0.14, 2.6, 6).rotateX(PI / 2)), M.gold), 0, -0.2, 4.6));
  g.add(at(mesh(G('chx', () => new THREE.OctahedronGeometry(1, 0).scale(0.22, 0.22, 0.6)), X.core, false), 0, -0.2, 6.0));
  g.add(at(mesh(G('cht', () => new THREE.ConeGeometry(0.35, 2.4, 4).rotateX(-PI / 2)), M.gold), 0, 0.1, -4.2));
  g.add(thruster(M, 0.42, 2.6, -3.1));
  return g;
}
/* kleines Triebwerk (billig): Goldkegel, Glutscheibe, Flamme nach −Z */
function thruster(M, r, plume, z, x = 0, y = 0) {
  const g = new THREE.Group();
  g.add(mesh(G('thn' + r, () => new THREE.CylinderGeometry(r * 0.8, r * 1.15, r * 1.2, 8, 1, true).rotateX(PI / 2)), M.gold));
  g.add(at(mesh(G('thd' + r, () => new THREE.CircleGeometry(r * 1.05, 8).rotateY(PI)), M.glow, false), 0, 0, -r * 0.4));
  const pg = G('thp' + r + ',' + plume, () => new THREE.CylinderGeometry(r * 0.9, r * 0.2, plume, 8, 1, true).translate(0, -plume / 2, 0).rotateX(PI / 2));
  const fl = new THREE.Mesh(pg, M.plume); fl.position.z = -r * 0.5; fl.userData.flame = true; fl.renderOrder = 2; g.add(fl);
  g.position.set(x, y, z); return g;
}
/* Begleitdrohnen: n Cherubim, kreisen um die Schiffsmitte */
function escorts(g, M, n, r, y, s = 0.3, speed = 0.55) {
  const T = bake(cherubModel(M));
  for (let i = 0; i < n; i++) {
    const c = T.clone(); c.scale.setScalar(s);
    const ph = i / n * TAU + 0.4;
    c.userData.orbit = { r, speed: speed * (i % 2 ? -1 : 1) * (1 + i * 0.05), y: y + (i % 2 ? -1.5 : 1.5), phase: ph, wob: r * 0.05, flat: 0.85 };
    c.position.set(Math.cos(ph) * r, y, Math.sin(ph) * r);
    g.add(c);
  }
}

/* ------------------------------------------------------------ Zusammenfassen und Register */
const ANIM = ['flame', 'blink', 'spin', 'pulse', 'orbit', 'bob', 'sway', 'turret', 'keep'];
/* statische Meshes je Material zu einem Mesh zusammenfassen (weniger Zeichenaufrufe) */
function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map(), rm = [];
  root.traverse(o => {
    if (!o.isMesh || o === root || o.material.transparent || o.renderOrder) return;
    for (let p = o; p && p !== root; p = p.parent) if (ANIM.some(k => p.userData[k])) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); geo.applyMatrix4(m);
    if (m.determinant() < 0) for (const k of ['position', 'normal', 'uv']) { const a = geo.attributes[k], s = a.itemSize; for (let i = 0; i < a.count; i += 3) for (let c = 0; c < s; c++) { const t = a.array[(i + 1) * s + c]; a.array[(i + 1) * s + c] = a.array[(i + 2) * s + c]; a.array[(i + 2) * s + c] = t; } }
    geo.clearGroups();
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(geo); rm.push(o);
  });
  for (const o of rm) o.parent.remove(o);
  for (const [mat, list] of by) { const mm = mesh(mergeGeometries(list, false), mat); root.add(mm); }
  return root;
}
/* je Materialsatz einmal bauen und zusammenfassen, danach klonen (Geometrie wird geteilt) */
function reg(id, fn) {
  const C = new WeakMap();
  register(id, (M, d) => { let t = C.get(M); if (!t) { t = bake(fn(M, d)); C.set(M, t); } return t.clone(); });
}

/* =================================================================== Schiffe */

/* CHERUB – Begleitdrohne: geflügelter Goldkörper, Maske mit Auge, Heiligenschein, Lichtnadel */
reg('cherub', M => cherubModel(M));

/* HERALD – leichtes Heldenschiff, schlanker Ritter: Klingenbug mit Lanze, Schulterplatten, ein Federbusch-Turm */
reg('herald', M => {
  const g = new THREE.Group();
  const P = [[-13, 3.6, 2.6, 0.8, 0.8], [-8, 5.2, 3.2, 1.1, 1.2], [2, 5, 3, 1.2, 1.3], [8, 3.4, 2.2, 0.9, 1], [12.5, 0.6, 0.6, 0.2, 0.3]];
  g.add(ghull(P, M.hull));
  /* Teamstreifen und Kielklinge */
  ridge(g, M, P, 1, 11, 0.35);
  g.add(ghull([[-11, 0.6, 1, 0.1, 1.6, -1.8], [6, 0.6, 1, 0.1, 1.2, -1.6], [11, 0.2, 0.4, 0.1, 0.3, -0.6]], M.gold));
  /* Lichtlanze */
  const l = lance(M, 8, 0.4); l.position.set(0, -0.1, 9.5); g.add(l);
  /* Schulterplatten (Pauldrons) */
  const pg = G('hpld', () => { const s = new THREE.Shape(v2([[0, 1.5], [7.5, -3], [8, -6.5], [6.4, -5.6], [0, -5]])); const e = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.2, bevelSegments: 1 }); e.rotateX(PI / 2); return scaleUV(e, 1 / 30); });
  for (const s of [1, -1]) {
    const p = mesh(pg, M.hull); p.position.set(s * 2.2, 0.6, 1); p.rotation.z = -s * 0.22; p.scale.x = s; g.add(p);
    for (const [k, dy, mat] of [[0.72, 0.42, M.gold], [0.46, 0.78, M.hull]]) { const q = mesh(pg, mat); q.position.set(s * 2.3, 0.6 + dy, 1 - (1 - k) * 1.2); q.rotation.z = -s * 0.22; q.scale.set(s * k, 1, k); g.add(q); }
    const edge = mesh(G('hpe', () => tube([[0.3, 0, 1.5], [4, 0, -0.6], [7.5, 0, -3], [8, 0, -6.5]], 0.22, 0.14, M.gold, 12, 4).geometry), M.gold); edge.position.set(s * 2.2, 0.9, 1); edge.rotation.z = -s * 0.22; edge.scale.x = s; g.add(edge);
    const tipfin = fin(M, 3.2, 2.4, 0.6); tipfin.position.set(s * 9.6, -1.1, -4.5); g.add(tipfin);
    const b = banner(M, 1.4, 4.2, s); b.position.set(s * 9.6, -1.4, -4.6); g.add(b);
    const e = lengine(M, 0.7, 0.9, 4); e.position.set(s * 3.4, 0.3, -6.5); g.add(e);
    g.add(at(mesh(G('hpod', () => new THREE.CylinderGeometry(0.85, 0.7, 4, 8).rotateX(PI / 2)), M.hull), s * 3.4, 0.3, -4.3));
  }
  /* Federbusch-Turm mit Heiligenschein */
  g.add(at(ghull([[-10, 2.4, 1.2, 0.5, 0.1], [-2, 2.2, 1.2, 0.5, 0.1]], M.hull), 0, 2.6, 0));
  both(g, wallTrim(M, 2.5, -0.45, 1.5, -8, 2));
  bands(g, [[-13, 3.6, 2.6, 0.8, 0.8], [-8, 5.2, 3.2, 1.1, 1.2], [2, 5, 3, 1.2, 1.3], [8, 3.4, 2.2, 0.9, 1]], [-12, 4.5], M.gold, 0.45, 0.25);
  /* Ritterhelm mit T-Visier */
  g.add(at(hull([[-2.6, 2.6, 2.2, 0.8], [0.2, 2.9, 2.6, 0.9], [1.6, 2.4, 2.3, 0.8], [2.3, 1.2, 1.4, 0.4]], M.hull), 0, 3.6, 0));
  g.add(at(strip(M, 1.9, 0.22, 0.3), 0, 4.1, 1.95)); g.add(at(strip(M, 0.24, 1.1, 0.3), 0, 3.5, 2.0));
  g.add(at(fin(M, 4.2, 1.2, 0.7, M.gold), 0, 4.8, -0.6));
  const sp = spire(M, 0.95, 2.8, 4.8); sp.position.set(0, 3.6, -6.5); g.add(sp);
  const h = halo(M, 3.2, 14); h.position.set(0, 7.6, -8); h.rotation.x = -0.25; g.add(h);
  both(g, at(glassRow(M, row(4, -6, 1.5, -0.3, 0.75, 1.5), 0.15), 2.56, 0, 0));
  /* Triebwerk */
  const e = lengine(M, 1.4, 1.6, 7); e.position.set(0, 0, -13); g.add(e);
  const ro = rose(M, 1.25, 6); ro.position.set(0, 1.5, -13.05); ro.rotation.y = PI; g.add(ro);
  nameplate(g, 'HERALD', 2.62, 0.9, 6.2, 0.55);
  g.add(at(navLight(M, 0.25, 'light', 0.7), 0, 2.6, 9));
  escorts(g, M, 2, 13, 1.5, 0.28);
  return g;
});

/* Lanzenturm: Goldsockel, Elfenbeingehäuse mit Spitzbug, zwei kurze Lichtlanzen */
function lturret(M, sz = 1.5, n = 2) {
  const g = new THREE.Group();
  g.add(mesh(G('tb' + sz, () => new THREE.CylinderGeometry(sz * 1.05, sz * 1.25, sz * 0.5, 8)), M.gold));
  g.add(at(hull([[-sz, sz * 1.6, sz * 0.9, sz * 0.3], [sz * 0.5, sz * 1.7, sz * 1, sz * 0.3], [sz * 1.2, sz * 0.6, sz * 0.5, sz * 0.15]], M.hull), 0, sz * 0.65, 0));
  for (let i = 0; i < n; i++) { const l = lance(M, sz * 3, sz * 0.17, 1); l.position.set((i - (n - 1) / 2) * sz * 0.8, sz * 0.6, sz * 0.4); g.add(l); }
  g.userData.turret = true;
  return g;
}
/* Wappenschild (Dreiecksschild) mit Kreuz, Normale +Z */
function crest(M, s) {
  const g = new THREE.Group();
  const sg = G('crest', () => { const sh = new THREE.Shape(v2([[-1, 1], [1, 1], [1, 0.1], [0.75, -0.6], [0, -1.25], [-0.75, -0.6], [-1, 0.1]])); return scaleUV(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 1 }), 0.2); });
  const sh = mesh(sg, M.gold); sh.scale.setScalar(s); g.add(sh);
  g.add(at(blk(0.22 * s, 1.9 * s, 0.2 * s, M.hull), 0, -0.1 * s, 0.25 * s)); g.add(at(blk(1.4 * s, 0.22 * s, 0.2 * s, M.hull), 0, 0.35 * s, 0.25 * s));
  return g;
}

/* PALADIN – Heldenfregatte: lange Lichtlanze zwischen gepanzerten Panzerhandschuh-Bugklingen, Zwillingstürme mit
   Heiligenschein, Strebebögen auf Auslegern, Lanzenturm, Banner */
reg('paladin', M => {
  const g = new THREE.Group();
  const P = [[-19, 6, 4, 1.2, 1.2], [-13, 8, 5.6, 2, 1.8], [3, 8, 5.6, 2, 2], [8, 6, 4.2, 1.4, 1.6], [11.5, 2.6, 2.2, 0.6, 0.8]];
  g.add(ghull(P, M.hull));
  bands(g, P, [-17.5, -13, 3], M.gold, 0.5, 0.3);
  both(g, wallTrim(M, 4, -0.84, 2.8, -13, 3, [-11.6, -8.35, -5.1, -1.85, 1.4]));
  g.add(ghull([[-18, 4, 1.4, 0.2, 1.4, -3.4], [8, 3.6, 1.2, 0.2, 1.2, -3.2], [12, 1.2, 0.6, 0.1, 0.4, -2]], M.hull2));
  ridge(g, M, P, -10, 10.5, 0.45);
  /* Panzerhandschuh-Bug: zwei Klingen, dazwischen die Lanze */
  for (const s of [-1, 1]) {
    const b = ghull([[0, 1.8, 3.6, 0.5, 0.7], [4, 1.5, 3, 0.4, 0.5], [7.5, 0.3, 0.6, 0.1, 0.1]], M.hull); b.position.set(s * 2.3, 0, 7); b.rotation.y = -s * 0.1; g.add(b);
    const e = blk(0.25, 0.3, 7, M.gold); e.position.set(s * 2.75, 2.2, 10.5); e.rotation.y = -s * 0.1; g.add(e);
  }
  const l = lance(M, 17, 0.95); l.position.set(0, 0.3, 4); g.add(l);
  /* Seitenschiffe mit Strebepfeilern und Strebebögen */
  for (const s of [-1, 1]) {
    const a = ghull([[-14, 3, 2, 0.5, 0.6], [2, 3, 2, 0.5, 0.6], [6, 0.8, 1, 0.2, 0.2]], M.hull); a.position.set(s * 5.2, -0.6, 0); g.add(a);
    for (const z of [-11, -6, -1]) {
      const p = pier(M, 0.9, 2.2, 1.4); p.position.set(s * 6.3, 0.4, z); g.add(p);
      const fb = buttress(M, [6.1, 2.4], [4, 3.3], 0.28); fb.scale.x = s; fb.position.z = z; g.add(fb);
    }
    const bn = banner(M, 1.6, 5, s * 2); bn.position.set(s * 6.3, -1.4, -6); g.add(bn);
  }
  both(g, at(glassRow(M, row(5, -10, 3, -0.4, 1.2, 2.2)), 4.0, 0, 0));
  /* Zwillingstürme und Heiligenschein */
  for (const s of [-1, 1]) { const t = spire(M, 1.25, 4.6, 6.5); t.position.set(s * 2.3, 2.6, -12); g.add(t); }
  const h = halo(M, 4.4, 16); h.position.set(0, 9.6, -14.5); h.rotation.x = -0.2; g.add(h);
  const ro = rose(M, 1.5, 8); ro.position.set(0, 1.9, -19.05); ro.rotation.y = PI; g.add(ro);
  const t = lturret(M, 1.4); t.position.set(0, 4.2, 4.5); g.add(t);
  /* Triebwerke */
  const e0 = lengine(M, 1.5, 1.8, 9); e0.position.set(0, -1, -19); g.add(e0);
  for (const s of [-1, 1]) { const e = lengine(M, 1.1, 1.4, 7); e.position.set(s * 2.6, -0.2, -18.6); g.add(e); }
  nameplate(g, 'PALADIN', 4.12, 2.7, 6.5, 0.8);
  for (const s of [-1, 1]) g.add(at(navLight(M, 0.3, s < 0 ? 'red' : 'green'), s * 6.8, 0.2, 5.5));
  escorts(g, M, 2, 17, 2, 0.32);
  return g;
});

/* BASTION – Schildfestung: breiter Bergfried mit Zinnen, vier Schildpylonen mit Kristallen, Schildkuppel als
   leuchtendes Rippengewölbe, Breitseiten-Lanzen, Wappenschilde am Bug */
reg('bastion', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-27, 12, 7, 1.4, 2], [-21, 16, 8, 1.8, 2.6], [12, 16, 8, 1.8, 2.6], [20, 12, 8, 1.6, 2.6], [25.5, 5, 7.4, 1.2, 2.4], [28.5, 0.6, 5.6, 0.2, 1.6]];
  g.add(ghull(P, M.hull));
  bands(g, P, [-24, -21, 12, 18], M.gold, 0.6, 0.35);
  ridge(g, M, P, 18, 28, 0.6);
  both(g, wallTrim(M, 8, -1.2, 4, -21, 12));
  /* Flankentürme (Rundtürme) */
  for (const s of [-1, 1]) for (const z of [-11, 6.5]) { g.add(at(mesh(G('bdt', () => new THREE.CylinderGeometry(1.9, 1.9, 9.5, 10)), M.hull), s * 8.6, 0.6, z)); g.add(at(mesh(G('bdr', () => new THREE.ConeGeometry(2.2, 3.4, 10)), M.gold), s * 8.6, 7.05, z)); g.add(at(mesh(G('bdb', () => new THREE.CylinderGeometry(2.05, 2.05, 0.4, 10)), M.gold), s * 8.6, 5.2, z)); }
  g.add(ghull([[-25, 10, 2, 0.3, 2.4, -5.2], [16, 10, 2, 0.3, 2.4, -5.2], [22, 4, 1.2, 0.2, 1, -4]], M.hull2));
  /* Zinnen auf beiden Mauerkronen */
  for (const s of [-1, 1]) for (let z = -19; z <= 11; z += 1.75) if (Math.abs(z + 11) > 2.2 && Math.abs(z - 6.5) > 2.2) g.add(at(blk(0.7, 1.1, 0.95, M.hull), s * 7.65, 4.5, z));
    /* Bergfried: dicker Achteckturm mit Helm, kleine Ecktürme */
  const keep = spire(M, 4, 4.5, 8); keep.position.set(0, 4.6, -6); g.add(keep);
  for (const [x, z] of [[-4.6, -12], [4.6, -12], [-4.6, 2], [4.6, 2]]) { const t = spire(M, 1.1, 2.6, 3.6); t.position.set(x, 4.4, z); g.add(t); }
  const h = halo(M, 5.5, 18); h.position.set(0, 15, -9.5); h.rotation.x = -0.2; g.add(h);
  /* Schildpylonen auf Auslegern */
  const pyl = [];
  for (const sx of [-1, 1]) for (const z of [-15, 13]) {
    const x = sx * 12;
    g.add(at(box(5, 1.4, 2.6, M.hull2, 0.3), sx * 9.6, 0.5, z));
    g.add(at(mesh(G('pyl', () => new THREE.CylinderGeometry(0.5, 1.3, 11, 4, 1).rotateY(PI / 4)), M.hull), x, 2.2, z));
    g.add(at(mesh(G('pyl2', () => new THREE.ConeGeometry(1.3, 4, 4).rotateY(PI / 4).rotateX(PI)), M.hull), x, -5.3, z));
    for (const y of [-2, 2.5, 6.4]) g.add(at(mesh(G('pylb', () => new THREE.CylinderGeometry(1.15, 1.2, 0.4, 4).rotateY(PI / 4)), M.gold), x, y, z));
    const c = mesh(G('pylc', () => new THREE.OctahedronGeometry(1, 0).scale(0.9, 1.8, 0.9)), X.crystal); c.position.set(x, 9.4, z); g.add(c);
    const r = mesh(G('pylr', () => new THREE.TorusGeometry(1.5, 0.12, 4, 20).rotateX(PI / 2)), M.glowSoft, false); r.position.set(x, 9.4, z); r.userData.pulse = { amp: 0.08, speed: 2.4 }; g.add(r);
    pyl.push([x, 9.4, z]);
  }
  /* Rippengewölbe aus Licht zwischen den Pylonen: Diagonalrippen und Schildbögen + zarte Kuppel */
  const rib = (a, b, lift) => { const m = [(a[0] + b[0]) / 2, a[1] + lift, (a[2] + b[2]) / 2]; const q1 = [a[0] * 0.7 + m[0] * 0.3, a[1] + lift * 0.75, a[2] * 0.7 + m[2] * 0.3], q2 = [b[0] * 0.7 + m[0] * 0.3, a[1] + lift * 0.75, b[2] * 0.7 + m[2] * 0.3]; return mesh(tube([a, q1, m, q2, b], 0.16, 0.16, M.glowSoft, 20, 4).geometry, M.glowSoft, false); };
  const [p0, p1, p2, p3] = pyl; /* (-,-15) (-,13) (+,-15) (+,13) */
  for (const [a, b, lift] of [[p0, p3, 8], [p1, p2, 8], [p0, p1, 4], [p2, p3, 4], [p0, p2, 4.5], [p1, p3, 4.5]]) g.add(rib(a, b, lift));
  const dome = mesh(G('bdome', () => new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, PI / 2)), X.shield, false); dome.scale.set(14.5, 9, 18.5); dome.position.set(0, 7.5, -1); g.add(dome);
  /* Breitseiten-Lanzen und Fenster */
  for (const s of [-1, 1]) for (const z of [-17, -4.5, 1, 10.5]) { const l = lance(M, 3.4, 0.32); l.rotation.y = s * PI / 2; l.position.set(s * 7.9, 1.6, z); g.add(l); }
  both(g, at(glassRow(M, [...row(2, -19.5, -15, -0.6, 1.3, 2.4), ...row(2, -7.5, -2, -0.6, 1.3, 2.4)]), 8, 0, 0));
  /* Bug: Wappenschilde, Lanzenturm */
  for (const s of [-1, 1]) { const c = crest(M, 1.8); c.position.set(s * 4.7, 1, 22.5); c.rotation.y = s * 0.95; g.add(c); }
  const t = lturret(M, 1.7); t.position.set(0, 5.6, 15); g.add(t);
  /* Heck: Rosenfenster, vier Triebwerke */
  const ro = rose(M, 2.4, 10); ro.position.set(0, 1.6, -27.05); ro.rotation.y = PI; g.add(ro);
  for (const sx of [-1, 1]) for (const y of [-1.6, 2.6]) { const e = lengine(M, 1.6, 2, 9); e.position.set(sx * 4, y, -27); g.add(e); }
  nameplate(g, 'BASTION', 8.12, 3.2, 14, 1.1);
  escorts(g, M, 3, 26, 3, 0.34);
  return g;
});

/* Mandorla (Spitzoval) als Punktliste, Breite w, Höhe h */
function vesica(w, h, k = 8) {
  const R = (w * w / 4 + h * h / 4) / w, d = R - w / 2, al = Math.asin(h / 2 / R), p = [];
  for (let i = 0; i < k; i++) { const t = -al + 2 * al * i / k; p.push([-d + R * Math.cos(t), R * Math.sin(t)]); }
  for (let i = 0; i < k; i++) { const t = al - 2 * al * i / k; p.push([d - R * Math.cos(t), R * Math.sin(t)]); }
  return p;
}
/* Dornenkranz: dunkelgoldener Ring mit Dornen, innen rote Glut */
function thorns(M, r, n = 14) {
  const g = new THREE.Group(), X = xm(M);
  g.add(mesh(G('tr' + r, () => new THREE.TorusGeometry(r, r * 0.06, 4, 32)), M.hull2));
  g.add(mesh(G('tg' + r, () => new THREE.TorusGeometry(r * 0.9, r * 0.025, 3, 32)), X.eye, false));
  const sp = G('ts' + r, () => new THREE.ConeGeometry(r * 0.07, r * 0.5, 4).translate(0, r * 0.25, 0));
  const rg = new THREE.Group();
  for (let i = 0; i < n; i++) { const a = i / n * TAU, m = mesh(sp, M.gold); m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); m.rotation.z = a - PI / 2 + (i % 2 ? 0.35 : -0.2); if (i % 2) m.scale.y = 0.6; rg.add(m); }
  rg.userData.spin = { axis: 'z', speed: -0.1 }; g.add(rg);
  return g;
}
/* Räuchergefäß-Laterne an Kette */
function censer(M, len) {
  const g = new THREE.Group(), X = xm(M);
  g.add(at(mesh(G('cc' + len, () => new THREE.CylinderGeometry(0.06, 0.06, len, 4)), M.gold), 0, -len / 2, 0));
  g.add(at(mesh(G('ct', () => new THREE.ConeGeometry(0.75, 0.9, 6)), M.gold), 0, -len - 0.1, 0));
  g.add(at(mesh(G('ce', () => new THREE.SphereGeometry(0.5, 8, 6)), X.ember, false), 0, -len - 0.8, 0));
  g.add(at(mesh(G('cb', () => new THREE.ConeGeometry(0.75, 0.9, 6).rotateX(PI)), M.gold), 0, -len - 1.5, 0));
  g.userData.sway = { axis: 'x', amp: 0.12, speed: 0.9, phase: len };
  return g;
}

/* INQUISITOR – Verhörschiff: hohe Klingenform, am Bug ein mandelförmiges Auge (Verhörstrahl) mit glühender Pupille,
   Rippenkäfig aus Spitzbögen über dem Rücken, Kapuzenturm mit Dornenkranz, Räucherlaternen */
reg('inquisitor', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-29, 5, 6, 1.2, 2.6], [-21, 8, 7.4, 1.6, 3.4], [6, 7.4, 7, 1.6, 3.2], [17, 5.6, 6, 1.2, 2.8], [24, 3.6, 4.4, 0.8, 1.8]];
  g.add(ghull(P, M.hull));
  g.add(ghull([[-27, 6, 1.6, 0.2, 2.2, -5.6], [12, 5, 1.6, 0.2, 2, -5], [20, 2, 1, 0.1, 1, -3.8]], M.hull2));
  bands(g, P, [-26, -21, 6], M.gold, 0.4, 0.35);
  ridge(g, M, P, -28, -25, 0.5);
  for (const s of [-1, 1]) g.add(at(blk(0.3, 0.3, 18, M.trim), s * 4.2, 3.75, -3));
  both(g, wallTrim(M, 4, -1.05, 3.5, -21, 3, [-19.6, -15.4, -11.2, -7, -2.8, 1.4]));
  /* Kapuze: dunkle Bronzehaube mit Spitzbogen-Querschnitt, vorn höher – das Auge schaut darunter hervor */
  const hood = (w, h, dy) => [[w / 2, dy], [w / 2, dy + h * 0.45], [w * 0.3, dy + h * 0.82], [0, dy + h], [-w * 0.3, dy + h * 0.82], [-w / 2, dy + h * 0.45], [-w / 2, dy], [0, dy - 0.3]];
  g.add(loft([{ z: -3, pts: hood(4, 2, 3.2) }, { z: 8, pts: hood(7.6, 6, 2.6) }, { z: 20, pts: hood(9, 9, 1) }, { z: 25.4, pts: hood(10, 11.4, -1.6) }], M.hull2));
  g.add(mesh(G('ihe', () => { const q = hood(10.4, 11.9, -1.85).slice(0, 7); return tube(q.map(([x, y]) => [x, y, 25.5]), 0.4, 0.4, M.gold, 24, 5).geometry; }), M.gold));
  g.add(mesh(G('ihr', () => tube([[0, 4.9, -3], [0, 8.7, 8], [0, 10.1, 20], [0, 9.9, 25.6]], 0.3, 0.3, M.gold, 16, 5).geometry), M.gold));
  for (const [z, w, h, dy] of [[4, 6.5, 4.6, 2.85], [10, 7.9, 6.5, 2.35], [15, 8.5, 7.8, 1.7]]) g.add(mesh(G('ihb' + z, () => tube(hood(w + 0.35, h + 0.3, dy - 0.1).slice(0, 7).map(([x, y]) => [x, y, z]), 0.2, 0.2, M.gold, 18, 4).geometry), M.gold));
  for (const s of [-1, 1]) for (const z of [7, 12.5, 17.5]) { const q = z < 10 ? [7.2, 5.8, 2.5] : z < 15 ? [8.2, 7.2, 2] : [8.8, 8.4, 1.4]; g.add(at(mesh(G('ihs', () => scaleUV(new THREE.ShapeGeometry(new THREE.Shape(v2(archPts(0.9, 2.6)))), 0.3).rotateY(PI / 2)), X.eye, false), s * (q[0] / 2 + 0.03), q[2] + q[1] * 0.12, z, 0, s < 0 ? PI : 0)); }
  /* Auge: goldene Mandorla, dunkle Linse, Iris, Pupille, Verhörstrahl */
  const eye = new THREE.Group();
  const outer = new THREE.Shape(v2(vesica(7.6, 10.6))); outer.holes.push(new THREE.Path(v2(vesica(6, 9))));
  eye.add(mesh(G('ifr', () => scaleUV(new THREE.ExtrudeGeometry(outer, { depth: 0.8, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1 }), 0.1)), M.gold));
  eye.add(at(mesh(G('ile', () => new THREE.ShapeGeometry(new THREE.Shape(v2(vesica(6.1, 9.1))))), X.lens), 0, 0, 0.2));
  eye.add(at(mesh(G('iir', () => new THREE.TorusGeometry(2.3, 0.3, 5, 28)), M.gold), 0, 0, 0.4));
  const iris = mesh(G('iig', () => new THREE.TorusGeometry(1.6, 0.22, 4, 28)), M.glow, false); iris.position.z = 0.45; eye.add(iris);
  const pup = mesh(G('ipu', () => new THREE.SphereGeometry(1, 16, 12).scale(0.6, 1.25, 0.5)), X.eye, false); pup.position.z = 0.4; pup.userData.pulse = { amp: 0.12, speed: 2.2 }; eye.add(pup);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; eye.add(at(blk(0.12, 0.8, 0.1, M.glowSoft), Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.35, 0, 0, a + PI / 2)); }
  eye.position.set(0, 3.6, 25.75); eye.rotation.x = -0.28; g.add(eye);
  const beam = mesh(G('ibm', () => new THREE.ConeGeometry(1.4, 6, 12, 1, true).rotateX(-PI / 2).translate(0, 0, 3)), X.beam, false); beam.position.set(0, 3.6, 26.2); beam.rotation.x = -0.28; g.add(beam);
  /* Rippenkäfig mit Reliquie hinter der Kapuze */
  const ribG = G('irib', () => tube(archPts(7.6, 6, 4).slice(2).sort((a, b) => a[0] - b[0]).map(([x, y]) => [x, y, 0]), 0.26, 0.26, M.gold, 16, 4).geometry);
  for (let i = 0; i < 4; i++) { const r = mesh(ribG, M.gold); r.position.set(0, 3.9, -17 + i * 3.6); g.add(r); }
  g.add(at(mesh(G('ispine', () => new THREE.CylinderGeometry(0.2, 0.2, 13, 6).rotateX(PI / 2)), M.gold), 0, 9.95, -11.6));
  const relic = sphere(1.2, M.glow, 14, 10); relic.position.set(0, 7.2, -11.6); relic.userData.pulse = { amp: 0.1, speed: 1.4 }; g.add(relic);
  /* Turm (Bronze) mit Dornenkranz */
  const tw = spire(M, 1.8, 6.5, 9, { mat: M.hull2 }); tw.position.set(0, 5.1, -23); g.add(tw);
  const th = thorns(M, 4.2); th.position.set(0, 15.5, -25.5); th.rotation.x = -0.2; g.add(th);
  for (const s of [-1, 1]) { const f = fin(M, 9, 4, 0.6, M.hull2); f.position.set(s * 1.6, -5.2, -18); f.rotation.z = s * (PI - 0.35); g.add(f); }
  /* Ausleger mit Räucherlaternen, Fenster, Lanzenturm */
  for (const s of [-1, 1]) for (const z of [-13.3, -0.7]) { g.add(at(blk(4.4, 0.6, 0.8, M.hull2), s * 5.6, 3.3, z)); const c = censer(M, 2.5); c.position.set(s * 7.6, 3.1, z); g.add(c); }
  both(g, at(glassRow(M, row(5, -17.5, -0.7, -0.6, 1.3, 3.0)), 4.0, 0, 0));
  const t = lturret(M, 1.4); t.position.set(0, 4.4, -5.8); g.add(t);
  for (const s of [-1, 1]) { const e = lengine(M, 1.5, 1.8, 9); e.position.set(s * 1.6, 0.4, -29); g.add(e); }
  const e0 = lengine(M, 1.1, 1.4, 7); e0.position.set(0, -2.6, -28.6); g.add(e0);
  nameplate(g, 'INQUISITOR', 4.12, -0.2, 12.5, 0.9);
  escorts(g, M, 2, 23, 3, 0.32);
  return g;
});

/* Punktverteidigung: kleine Goldkuppel mit zwei Nadeln */
function pd(M, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(G('pdd' + s, () => new THREE.SphereGeometry(s * 0.8, 8, 4, 0, TAU, 0, PI / 2)), M.gold));
  for (const x of [-0.25, 0.25]) g.add(at(mesh(G('pdn' + s, () => new THREE.CylinderGeometry(s * 0.07, s * 0.1, s * 1.6, 5).rotateX(PI / 2)), M.dark), x * s, s * 0.45, s * 0.8));
  g.userData.turret = true; return g;
}
/* Leuchtpunkt (Sprite) */
function glowSprite(M, size) { const sp = new THREE.Sprite(xm(M).spr); sp.scale.setScalar(size); return sp; }

/* RELIQUARY – trägt den Reliquienschrein: goldenes Schreinhaus mit Buntglas, offener Bogen mit leuchtender Reliquie,
   goldene Klammerbögen, schwebender Kerzenkranz (Aura), Prozessionsbanner */
reg('reliquary', M => {
  const g = new THREE.Group(), X = xm(M);
  g.add(ghull([[-24, 7, 5, 1, 1.6], [-18, 10, 6, 1.2, 2.2], [10, 10, 6, 1.2, 2.4], [18, 7, 5, 1, 2], [23, 3, 2.6, 0.5, 1], [25, 0.8, 0.8, 0.2, 0.2]], M.hull));
  g.add(ghull([[-22, 6, 1.6, 0.2, 1.6, -4.2], [14, 6, 1.6, 0.2, 1.6, -4.2], [19, 2, 0.8, 0.1, 0.6, -3.2]], M.hull2));
  g.add(at(box(9.4, 0.8, 22, M.hull2, 0.3), 0, 3.9, -2));
  g.add(at(blk(9.8, 0.3, 22.4, M.trim), 0, 3.4, -2));
  /* Schrein */
  const sh = new THREE.Group();
  sh.add(at(box(6.4, 5, 11, M.hull, 0.25), 0, 2.5, 0));
  sh.add(at(ghull([[-5.6, 7, 0.4, 2.8, 0.1], [5.6, 7, 0.4, 2.8, 0.1]], M.gold), 0, 5.1, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) sh.add(at(spire(M, 0.7, 4.6, 3.2), x * 3.2, 0, z * 5.5));
  both(sh, at(glassRow(M, row(3, -3.4, 3.4, 1, 1.5, 3)), 3.2, 0, 0));
  const ro = rose(M, 1.4, 8); ro.position.set(0, 2.6, -5.52); ro.rotation.y = PI; sh.add(ro);
  /* offener Bogen vorn mit Reliquie */
  const fr = new THREE.Shape(v2(archPts(5.4, 4.8))); fr.holes.push(new THREE.Path(v2(archPts(4, 4.2), 0, 0.2)));
  sh.add(at(mesh(G('rqa', () => scaleUV(new THREE.ExtrudeGeometry(fr, { depth: 0.4, bevelEnabled: false }), 0.1)), M.gold), 0, 0, 5.5));
  sh.add(at(mesh(G('rqb', () => new THREE.ShapeGeometry(new THREE.Shape(v2(archPts(4, 4.2))))), X.core, false), 0, 0.2, 5.3));
  const rel = mesh(G('rqc', () => new THREE.OctahedronGeometry(1, 0).scale(0.9, 1.7, 0.9)), X.crystal); rel.position.set(0, 2, 6.2); rel.userData.spin = { axis: 'y', speed: 0.8 }; sh.add(rel);
  const sp = glowSprite(M, 9); sp.position.set(0, 2.2, 6.4); sh.add(sp);
  sh.position.set(0, 4.3, -2); g.add(sh);
  /* goldene Klammerbögen */
  for (const s of [-1, 1]) for (const z of [-8, -2, 4]) { const b = buttress(M, [4.7, 4.3], [3.25, 8.6], 0.24, M.gold); b.scale.x = s; b.position.z = z; g.add(b); }
  /* Kerzenkranz (Aura) */
  const crown = new THREE.Group();
  crown.add(mesh(G('rqr', () => new THREE.TorusGeometry(9, 0.18, 4, 64).rotateX(PI / 2)), M.glowSoft, false));
  crown.add(mesh(G('rqh', () => new THREE.RingGeometry(7.5, 10.5, 48).rotateX(-PI / 2)), X.beam, false));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, c = new THREE.Group(); c.add(mesh(G('rqk', () => new THREE.CylinderGeometry(0.22, 0.3, 1.4, 5).translate(0, 0.7, 0)), M.gold)); c.add(at(mesh(G('rqf', () => new THREE.ConeGeometry(0.22, 0.7, 5)), M.glow, false), 0, 1.75, 0)); c.position.set(Math.cos(a) * 9, 0, Math.sin(a) * 9); crown.add(c); }
  crown.position.set(0, 15, -2); crown.userData.spin = { axis: 'y', speed: 0.2 }; g.add(crown);
  /* Prozessionsbanner, Fenster, Punktverteidigung */
  for (const s of [-1, 1]) {
    g.add(at(blk(0.4, 0.4, 20, M.gold), s * 5.6, -1.2, -3));
    for (const z of [-11, -3, 5]) { const b = banner(M, 2, 6, z + s); b.position.set(s * 5.6, -1.2, z); g.add(b); }
    for (const z of [-14, 12]) { const t = pd(M, 1.2); t.position.set(s * 3.6, 4.4, z); g.add(t); }
  }
  both(g, at(glassRow(M, row(6, -16, 9, -0.6, 1.1, 2.4)), 5.0, 0, 0));
  for (const x of [-2.8, 0, 2.8]) { const e = lengine(M, x ? 1.3 : 1.7, 1.8, 8); e.position.set(x, x ? 0.4 : -0.8, -24); g.add(e); }
  g.add(at(crest(M, 1.4), 0, 1.4, 23.6, -0.15));
  nameplate(g, 'RELIQUARY', 5.12, 1.9, 14, 0.9);
  escorts(g, M, 2, 21, 4, 0.32);
  return g;
});

/* BASILICA – Kathedralenschiff: Langhaus mit Satteldach und Obergaden-Buntglas, Seitenschiffe mit sechs Strebebögen je
   Seite, Querschiff mit Rosenfenstern, Vierungsturm (höchster Turm), Doppelturmfassade am Heck, goldener Rammbug mit
   zwei schweren Lanzen, Breitseiten, vier Cherubim */
reg('basilica', M => {
  const g = new THREE.Group();
  g.add(ghull([[-40, 12, 10, 3.4, 3], [-34, 14, 12, 4, 3.6], [18, 14, 12, 4, 3.8], [26, 12, 10, 3.4, 3.4], [33, 8, 7.5, 2.4, 2.8], [38, 4, 4.5, 1.2, 1.8], [41, 1.2, 1.4, 0.3, 0.5]], M.hull));
  g.add(ghull([[-38, 10, 2, 0.4, 3, -7.4], [26, 10, 2, 0.4, 3, -7.4], [34, 4, 1.4, 0.2, 1.4, -5.6]], M.hull2));
  g.add(at(blk(0.6, 0.4, 52, M.trim), 0, 10.1, -8));
  /* goldener Rammsporn und schwere Lanzen */
  g.add(ghull([[28, 5, 3, 0.8, 1.8, -4], [38, 3, 2.2, 0.4, 1.2, -3.4], [45, 0.3, 0.4, 0.1, 0.1, -2.6]], M.gold));
  for (const s of [-1, 1]) { const l = lance(M, 14, 0.75); l.position.set(s * 3.2, -1.2, 31); g.add(l); g.add(at(cyl(1.3, 1.1, 3, M.hull2, 8), s * 3.2, -1.2, 31)); }
  /* Seitenschiffe, Strebepfeiler, Strebebögen, Breitseiten */
  for (const s of [-1, 1]) {
    const a = ghull([[-30, 5, 5.4, 1.2, 1], [14, 5, 5.4, 1.2, 1], [18, 1, 1.4, 0.3, 0.3]], M.hull); a.position.set(s * 9.4, -1.6, 0); g.add(a);
    for (let i = 0; i < 6; i++) {
      const z = -26 + i * 7.4;
      const p = pier(M, 1.3, 4.4, 2); p.position.set(s * 11.6, 0.4, z); g.add(p);
      const fb = buttress(M, [11.3, 4.4], [7.05, 6.4], 0.4); fb.scale.x = s; fb.position.z = z; g.add(fb);
      if (i < 5) { const l = lance(M, 3.4, 0.34); l.rotation.y = s * PI / 2; l.position.set(s * 11.6, -2.2, z + 3.7); g.add(l); }
    }
    const bn = banner(M, 2.8, 9, s); bn.position.set(s * 14.8, -4, 22); g.add(bn);
  }
  /* Obergaden- und Seitenschiff-Fenster */
  both(g, at(glassRow(M, [...row(4, -31, -12, 2.6, 1.5, 3.0), ...row(2, -4, 3, 2.6, 1.5, 3.0), ...row(2, 12, 16, 2.6, 1.5, 3.0)]), 7.0, 0, 0));
  both(g, at(glassRow(M, row(5, -22.3, 7.3, -2.8, 1.4, 2.6)), 11.92, 0, 0));
  /* Querschiff mit Rosenfenstern */
  const tr = ghull([[-15.5, 8, 11, 3.6, 2], [15.5, 8, 11, 3.6, 2]], M.hull); tr.rotation.y = PI / 2; tr.position.set(0, -0.4, 22); g.add(tr);
  for (const s of [-1, 1]) { const r = rose(M, 3, 10); r.position.set(s * 15.55, 1.4, 22); r.rotation.y = s * PI / 2; g.add(r); g.add(at(pinnacle(M, 0.6, 4), s * 15, 5.1, 18.4)); g.add(at(pinnacle(M, 0.6, 4), s * 15, 5.1, 25.6)); }
  /* Vierungsturm, Dachreiter, Doppelturmfassade */
  const ct = spire(M, 3, 6.5, 15); ct.position.set(0, 8.5, 22); g.add(ct);
  const fl = spire(M, 1, 2.5, 6); fl.position.set(0, 9.6, -4); g.add(fl);
  for (const s of [-1, 1]) { const t = spire(M, 2.6, 9, 11); t.position.set(s * 5.4, 5, -35); g.add(t); }
  const h = halo(M, 6.2, 20); h.position.set(0, 25.5, 18.6); h.rotation.x = -0.15; g.add(h);
  const ro = rose(M, 3.4, 12); ro.position.set(0, 4.8, -40.05); ro.rotation.y = PI; g.add(ro);
  /* Triebwerke */
  for (const x of [-4.2, 0, 4.2]) { const e = lengine(M, x ? 2.2 : 2.8, 2.6, 13); e.position.set(x, -2.4, -40); g.add(e); }
  for (const s of [-1, 1]) { const e = lengine(M, 1.9, 2.2, 10); e.position.set(s * 9.4, -1.4, -30); g.add(e); }
  /* Punktverteidigung */
  for (const s of [-1, 1]) for (const z of [-20, 4, 30]) { const t = pd(M, 1.3); t.position.set(s * (z > 28 ? 3.8 : 9.4), z > 28 ? 3.4 : 2.6, z); g.add(t); }
  for (const z of [-14, 8]) { const t = lturret(M, 2); t.position.set(0, 9.8, z); g.add(t); }
  nameplate(g, 'BASILICA', 12.32, -0.2, -24, 1.6);
  escorts(g, M, 4, 42, 6, 0.4, 0.4);
  return g;
});

/* LAST SOVEREIGN – Flaggschiff, das Schiff ist der Kommandant: Schwertform – langer Klingenbug mit leuchtender
   Hohlkehle (schwere Lichtlanze), breite Parierstange mit Ecktürmen und Bannern, Thronturm mit Spitzbogenlehne aus
   Buntglas und Fialenkrone, riesiger Strahlenschein, Knauf aus sieben Triebwerken im Goldring */
reg('sovereign', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-44, 12, 10, 3, 3], [-38, 16, 12, 4, 4], [4, 16, 12, 4, 4.2], [11, 14, 9, 2.4, 3]];
  g.add(ghull(P, M.hull));
  g.add(ghull([[-42, 10, 2, 0.4, 3.4, -7.4], [6, 10, 2, 0.4, 3.4, -7.4], [12, 6, 1.4, 0.2, 1.6, -6]], M.hull2));
  bands(g, P, [-41, -38, -16, 4], M.gold, 0.7, 0.4);
  /* Klinge */
  const B = [[8, 13, 5, 1.6, 1.6], [26, 10, 3.4, 1, 1], [40, 4, 2, 0.5, 0.5], [46, 0.3, 0.3, 0.1, 0.1]];
  g.add(ghull(B, M.hull));
  for (const s of [-1, 1]) g.add(mesh(G('sve' + s, () => tube([[s * 6.6, 0, 8], [s * 5.1, 0, 26], [s * 2.1, 0, 40], [s * 0.2, 0, 46]], 0.38, 0.12, M.gold, 20, 5).geometry), M.gold));
  g.add(mesh(G('svf', () => tube([[0, 4.3, 9], [0, 3.6, 18], [0, 2.75, 26], [0, 1.6, 38], [0, 0.4, 45.6]], 0.32, 0.12, M.glowSoft, 24, 5).geometry), M.glowSoft, false));
  for (const s of [-1, 1]) g.add(at(blk(0.22, 0.22, 26, M.gold), s * 2.2, 3.2, 22, -0.1, -s * 0.09));
  /* Parierstange */
  const gd = ghull([[-25, 1.4, 1.6, 0.4, 0.4], [-20, 4, 4, 1, 1], [-9, 6, 7, 1.6, 1.6], [9, 6, 7, 1.6, 1.6], [20, 4, 4, 1, 1], [25, 1.4, 1.6, 0.4, 0.4]], M.hull); gd.rotation.y = PI / 2; gd.position.set(0, 1, 9); g.add(gd);
  for (const x of [-20, -9, 9, 20]) { const b = ghull([[-0.3, 0, 0, 0, 0], [0.3, 0, 0, 0, 0]].map(([z]) => { const q = profAt([[-25, 1.4, 1.6, 0.4, 0.4], [-20, 4, 4, 1, 1], [-9, 6, 7, 1.6, 1.6], [9, 6, 7, 1.6, 1.6], [20, 4, 4, 1, 1], [25, 1.4, 1.6, 0.4, 0.4]], x); return [z, q[1] + 0.35, q[2] + 0.35, q[3] + 0.1, q[4] + 0.1]; }), M.gold); b.rotation.y = PI / 2; b.position.set(x, 1, 9); g.add(b); }
  for (const s of [-1, 1]) {
    const t = spire(M, 1.7, 4.5, 7.5); t.position.set(s * 19, 3, 9); g.add(t);
    g.add(at(mesh(G('svq', () => new THREE.ConeGeometry(0.8, 5, 6).rotateX(PI / 2)), M.gold), s * 25.5, 1, 10.5, 0, s * 0.5));
    for (const x of [11.5, 15.5]) { const bn = banner(M, 2.4, 8.5, x + s); bn.position.set(s * x, -2.6, 9); g.add(bn); }
    const r = rose(M, 1.6, 8); r.position.set(s * 14, 1.6, 12.05); g.add(r);
  }
  /* Seitenschiffe, Strebebögen, Breitseiten */
  for (const s of [-1, 1]) {
    const a = ghull([[-36, 4, 6, 1, 1], [2, 4, 6, 1, 1], [5, 1, 1.4, 0.3, 0.3]], M.hull); a.position.set(s * 9.8, -2.2, 0); g.add(a);
    for (let i = 0; i < 5; i++) {
      const z = -33 + i * 8;
      const p = pier(M, 1.3, 4.6, 2); p.position.set(s * 11.6, 0.2, z); g.add(p);
      const fb = buttress(M, [11.3, 4.4], [8.05, 6.6], 0.4); fb.scale.x = s; fb.position.z = z; g.add(fb);
      if (i < 4) { const l = lance(M, 3.6, 0.36); l.rotation.y = s * PI / 2; l.position.set(s * 11.7, -2.4, z + 4); g.add(l); }
    }
  }
  both(g, at(glassRow(M, row(6, -35, 1, 1.4, 1.6, 3.4)), 8.0, 0, 0));
  /* Thron: Podest, Spitzbogenlehne (vorn Buntglas, hinten Rose), Armlehnentürme, Fialenkrone, Strahlenschein */
  g.add(ghull([[-31.5, 15.6, 4.4, 1.2, 0.2, 8.2], [-16.5, 15.6, 4.4, 1.2, 0.2, 8.2]], M.hull));
  for (const x of [-7.9, 7.9]) g.add(at(blk(0.4, 0.45, 15.2, M.trim), x, 10.3, -24));
  ridge(g, M, P, -14, 4, 0.7);
  g.add(at(mesh(G('svw', () => scaleUV(new THREE.PlaneGeometry(9, 1.4), 0.4)), M.stained, false), 0, 8.6, -16.45));
  const back = new THREE.Shape(v2(archPts(10, 21)));
  g.add(at(mesh(G('svb', () => scaleUV(new THREE.ExtrudeGeometry(back, { depth: 3, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 }), 1 / 30)), M.hull), 0, 10.4, -31));
  const fr = new THREE.Shape(v2(archPts(8.4, 18.6))); fr.holes.push(new THREE.Path(v2(archPts(6.6, 16.6), 0, 0.9)));
  g.add(at(mesh(G('svbf', () => new THREE.ExtrudeGeometry(fr, { depth: 0.4, bevelEnabled: false, curveSegments: 4 })), M.gold), 0, 10.6, -27.7));
  g.add(at(mesh(G('svbg', () => scaleUV(new THREE.ShapeGeometry(new THREE.Shape(v2(archPts(6.6, 16.6, 4)))), 0.07)), M.stained, false), 0, 11.5, -27.65));
  for (const y of [16, 21]) g.add(at(blk(6.6, 0.35, 0.3, M.gold), 0, 11.5 + y - 10.4, -27.5));
  g.add(at(blk(0.35, 16, 0.3, M.gold), 0, 19.5, -27.5));
  const rb = rose(M, 3, 12); rb.position.set(0, 20, -31.45); rb.rotation.y = PI; g.add(rb);
  { const ap = archPts(10, 21, 4).slice(2); for (let i = 0; i < ap.length; i++) { const [x, y] = ap[i]; const pn = pinnacle(M, 0.55, i === 4 ? 0 : 3.4); if (i === 4) continue; pn.position.set(x * 1.02, 10.4 + y, -29.5); g.add(pn); } }
  const star = mesh(G('svs', () => new THREE.OctahedronGeometry(1, 0).scale(1.3, 2.6, 1.3)), X.crystal); star.position.set(0, 33.6, -29.5); star.userData.spin = { axis: 'y', speed: 0.6 }; g.add(star);
  const sp = glowSprite(M, 9); sp.position.set(0, 33.6, -29.5); g.add(sp);
  for (const s of [-1, 1]) { const t = spire(M, 1.9, 7, 8.5); t.position.set(s * 7.2, 10.4, -22); g.add(t); }
  const h = halo(M, 13, 28); h.position.set(0, 24, -34); h.rotation.x = -0.12; g.add(h);
  /* Türme vorn, Lanzentürme, Punktverteidigung */
  { const t = lturret(M, 2.2); t.position.set(0, 10, -6); g.add(t); }
  { const t = lturret(M, 2); t.position.set(0, 4.6, 16); g.add(t); }
  for (const s of [-1, 1]) for (const z of [-30, -2]) { const t = pd(M, 1.4); t.position.set(s * 6.4, 7.6, z); g.add(t); }
  /* Knauf: sieben Triebwerke im Goldring */
  const e0 = lengine(M, 3.2, 3.4, 16); e0.position.set(0, 0.5, -44); g.add(e0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + PI / 6, e = lengine(M, 1.9, 2.4, 11); e.position.set(Math.cos(a) * 6, 0.5 + Math.sin(a) * 4.4, -43.6); g.add(e); }
  g.add(at(mesh(G('svp', () => new THREE.TorusGeometry(8.6, 0.7, 6, 32).scale(1, 0.78, 1)), M.gold), 0, 0.5, -44.4));
  nameplate(g, 'LAST SOVEREIGN', 11.92, -3.4, -16, 1.5);
  escorts(g, M, 4, 46, 8, 0.45, 0.35);
  return g;
});

/* Kran: Mast, Gitterausleger, Seil mit Goldhaken – schwenkt langsam */
function crane(M, h, len, phase = 0) {
  const g = new THREE.Group();
  g.add(at(blk(1, h, 1, M.hull2), 0, h / 2, 0));
  g.add(at(mesh(G('crj', () => new THREE.CylinderGeometry(1, 1, 1.2, 10)), M.gold), 0, h, 0));
  const boom = new THREE.Group();
  for (const y of [0, 1.2]) boom.add(at(blk(0.35, 0.35, len, M.gold), 0, y, len / 2));
  for (let i = 0; i < Math.floor(len / 1.6); i++) boom.add(at(blk(0.18, 1.5, 0.18, M.hull2), 0, 0.6, 0.8 + i * 1.6, (i % 2 ? 0.7 : -0.7)));
  boom.add(at(blk(0.12, 4, 0.12, M.dark), 0, -2, len - 0.4));
  boom.add(at(mesh(G('crh', () => new THREE.TorusGeometry(0.45, 0.14, 4, 10, PI * 1.3)), M.gold), 0, -4.3, len - 0.4));
  boom.add(at(navLight(M, 0.22, 'light', 0.8), 0, 1.5, len));
  boom.position.y = h + 0.3; boom.rotation.x = -0.32; g.add(boom);
  g.userData.sway = { axis: 'y', amp: 0.35, speed: 0.35, phase, base: 0 };
  return g;
}

/* SANCTUM – mobile Reparatur-Kathedrale (Feldwerft): Kreuzgang aus fünf großen Spitzbögen über dem Werftdeck mit
   herabfallenden Heilstrahlen, zwei Kräne, Kapelle mit Turm und Rosenfenster am Heck */
reg('sanctum', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-27, 10, 6, 1.6, 2], [-21, 13, 7, 1.2, 2.4], [10, 13, 7, 1.2, 2.4], [18, 10, 6, 1.2, 2], [24, 5, 4.4, 0.8, 1.4], [27, 1, 1.2, 0.2, 0.3]];
  g.add(ghull(P, M.hull));
  g.add(ghull([[-25, 9, 2, 0.4, 2.2, -4.8], [14, 9, 2, 0.4, 2.2, -4.8], [20, 3, 1, 0.2, 0.8, -3.6]], M.hull2));
  bands(g, P, [-24, -21, 10, 16], M.gold, 0.5, 0.3);
  /* Werftdeck */
  g.add(at(box(10.6, 0.8, 26, M.dark, 0.25), 0, 4.6, -2));
  for (const s of [-1, 1]) g.add(at(blk(0.4, 0.25, 25, M.trim), s * 4.6, 5.1, -2));
  /* Kreuzgang-Bögen */
  const archG = G('sca', () => { const pts = archPts(13, 12, 5).slice(2).sort((a, b) => a[0] - b[0]); return tube([[-6.5, 0, 0], ...pts.map(([x, y]) => [x, y, 0]), [6.5, 0, 0]].filter((p, i, A) => i === 0 || Math.abs(p[0] - A[i - 1][0]) > 0.01 || Math.abs(p[1] - A[i - 1][1]) > 0.01), 0.55, 0.42, M.hull, 20, 6).geometry; });
  for (let i = 0; i < 5; i++) {
    const z = -13 + i * 5.5;
    g.add(at(mesh(archG, i % 2 ? M.gold : M.hull), 0, 4.6, z));
    for (const s of [-1, 1]) g.add(at(pinnacle(M, 0.45, 2.6), s * 6.5, 4.2, z));
    if (i < 4) { const b = mesh(G('scb', () => new THREE.ConeGeometry(2.2, 9, 12, 1, true).translate(0, -4.5, 0)), X.beam, false); b.position.set(0, 15.4, z + 2.75); g.add(b); g.add(at(mesh(G('sce', () => new THREE.CylinderGeometry(0.6, 0.9, 1, 8)), M.gold), 0, 15.6, z + 2.75)); }
  }
  for (const [x, y] of [[0, 16.6], [-5.6, 11], [5.6, 11]]) g.add(at(blk(x ? 0.4 : 0.5, 0.5, 23, M.gold), x, 4.6 + y - 4.6 + (x ? 0 : -0.5), -2));
  /* Kräne */
  const c1 = crane(M, 7, 13, 0); c1.position.set(5.5, 5, 13); c1.rotation.y = 0.3; g.add(c1);
  const c2 = crane(M, 7, 11, 2); c2.position.set(-5.5, 5, -17); c2.rotation.y = PI - 0.5; g.add(c2);
  /* Kapelle mit Turm am Heck */
  g.add(at(ghull([[-26, 8, 4, 2.4, 0.1], [-19.5, 8, 4, 2.4, 0.1]], M.hull), 0, 5, 0));
  const t = spire(M, 1.7, 5, 7); t.position.set(0, 9, -23); g.add(t);
  const ro = rose(M, 2.2, 10); ro.position.set(0, 6, -27.05); ro.rotation.y = PI; g.add(ro);
  both(g, at(glassRow(M, row(6, -19, 8, -0.8, 1.2, 2.6)), 6.5, 0, 0));
  both(g, wallTrim(M, 6.5, -1.05, 3.5, -21, 10));
  /* Waffen, Triebwerke */
  { const tt = lturret(M, 1.6); tt.position.set(0, 4.5, 18); g.add(tt); }
  for (const s of [-1, 1]) { const q = pd(M, 1.1); q.position.set(s * 5, 4.2, -21); g.add(q); }
  for (const s of [-1, 1]) for (const y of [-1.4, 1.8]) { const e = lengine(M, 1.4, 1.7, 8); e.position.set(s * 3.4, y, -27); g.add(e); }
  nameplate(g, 'SANCTUM', 6.62, -2.6, 13, 0.9);
  return g;
});

/* ZEALOT – Rammschiff: brennende Lanze als Bug in einem goldenen Rammsporn, Dornenreihen, karmesinrote
   Panzerplatten, Kohlebecken auf dem Mast mit wehendem Wimpel, drei große Triebwerke */
reg('zealot', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-17, 4.4, 3.4, 1, 1.2], [-11, 6, 4.2, 1.6, 1.6], [2, 5.4, 4, 1.6, 1.6], [8, 3.8, 3.2, 1.1, 1.2], [11, 1.8, 2.2, 0.5, 0.7]];
  g.add(ghull(P, M.hull));
  bands(g, P, [-14, -11, -4, 2], M.gold, 0.4, 0.28);
  ridge(g, M, P, 2.5, 10.5, 0.4);
  /* Karmesin-Panzer an den Flanken */
  for (const s of [-1, 1]) { const a = ghull([[-10, 1.2, 3.2, 0.3, 0.3], [4, 1.2, 3, 0.3, 0.3], [9, 0.4, 1.6, 0.1, 0.1]], X.crimson); a.position.set(s * 3, 0.2, 0); a.rotation.y = -s * 0.04; g.add(a); }
  /* Rammsporn (Gold) und brennende Lanze */
  g.add(ghull([[6, 5, 4.4, 1.2, 1.4], [11, 3.6, 3.2, 0.8, 1], [15, 0.6, 0.8, 0.2, 0.2]], M.gold));
  const l = lance(M, 10, 1.0); l.position.set(0, 0.2, 9); g.add(l);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, f = new THREE.Mesh(G('zfl', () => new THREE.CylinderGeometry(0.9, 0.05, 9, 8, 1, true).translate(0, -4.5, 0).rotateX(PI / 2)), X.fire); f.position.set(Math.cos(a) * 1.1, 0.2 + Math.sin(a) * 1.1, 18.6 - (i % 2) * 2.5); f.rotation.set(-Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0); f.userData.flame = true; f.renderOrder = 2; g.add(f); }
  for (let i = 0; i < 4; i++) g.add(at(mesh(G('zem', () => new THREE.TorusGeometry(1.05, 0.12, 3, 14)), X.ember, false), 0, 0.2, 11.2 + i * 1.6));
  { const sp = glowSprite(M, 6); sp.material = sp.material.clone(); sp.material.color = new THREE.Color('#ff9a4a').multiplyScalar(1.8); sp.position.set(0, 0.2, 18); g.add(sp); }
  /* Dornen */
  const th = G('zth', () => new THREE.ConeGeometry(0.32, 2.2, 4).rotateX(-PI / 2 + 0.7));
  for (let i = 0; i < 7; i++) { const z = -12 + i * 2.6, q = profAt(P, z); g.add(at(mesh(th, M.gold), 0, q[2] / 2 + q[3] + 0.4, z)); }
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const z = -9 + i * 3.2; g.add(at(mesh(th, M.gold), s * 3.6, 1.8, z, 0, 0, -s * 1.1)); }
  /* Klingenflügel nach hinten */
  const wg = G('zw', () => { const sh = new THREE.Shape(v2([[0, 3], [7.5, -4], [8.4, -8], [6.6, -6.6], [0, -3]])); const e = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.15, bevelSegments: 1 }); e.rotateX(PI / 2); return scaleUV(e, 1 / 30); });
  for (const s of [-1, 1]) { const w = mesh(wg, M.hull); w.scale.x = s; w.position.set(s * 2.6, -0.4, -6); w.rotation.z = s * 0.3; g.add(w); g.add(at(mesh(G('zwe', () => tube([[0.2, 0, 3], [4, 0, -0.5], [7.5, 0, -4], [8.4, 0, -8]], 0.22, 0.12, M.gold, 10, 4).geometry), M.gold), s * 2.6, -0.2, -6, 0, 0, s * 0.3)); g.children[g.children.length - 1].scale.x = s; const b = banner(M, 1.3, 4.6, s * 3); b.position.set(s * 10.4, 2.0, -14); g.add(b); }
  /* Mast mit Kohlebecken und Wimpel */
  g.add(at(mesh(G('zm', () => new THREE.CylinderGeometry(0.22, 0.35, 7, 6).translate(0, 3.5, 0)), M.gold), 0, 3, -7));
  g.add(at(mesh(G('zbr', () => new THREE.CylinderGeometry(1.1, 0.5, 1, 8)), M.gold), 0, 10.2, -7));
  { const f = new THREE.Mesh(G('zbf', () => new THREE.ConeGeometry(0.9, 3, 8, 1, true).translate(0, 1.5, 0)), X.fire); f.position.set(0, 10.4, -7); f.userData.flame = true; f.renderOrder = 2; g.add(f); g.add(at(mesh(G('zbe', () => new THREE.SphereGeometry(0.6, 8, 6)), X.ember, false), 0, 10.9, -7)); }
  { const pn = banner(M, 1.2, 7, 1); pn.rotation.x = PI / 2 - 0.25; pn.position.set(0, 9.2, -7); pn.userData.sway = { axis: 'y', amp: 0.12, speed: 1.6 }; g.add(pn); }
  both(g, at(glassRow(M, row(4, -9, 0, -0.5, 0.8, 1.8), 0.15), 2.82, 0, 0));
  { const t = lturret(M, 1.2); t.position.set(0, 3.6, 2); g.add(t); }
  const e0 = lengine(M, 1.8, 2, 11); e0.position.set(0, 0, -17); g.add(e0);
  for (const s of [-1, 1]) { const e = lengine(M, 1.3, 1.6, 9); e.position.set(s * 3, -0.4, -16); g.add(e); }
  nameplate(g, 'ZEALOT', 3.32, 1.9, -1, 0.7);
  return g;
});

/* ORACLE – Seherschiff: riesige Linse in goldenem Maßwerk (Rosenfenster-Auge) auf einer Gabel, leicht zum Himmel
   geneigt; Antennenkrone mit Lichtspitzen; Astrolab unter dem Kiel */
reg('oracle', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-15, 4, 3, 1, 1], [-9, 6, 4, 1.4, 1.4], [3, 6, 4, 1.4, 1.6], [9, 4, 3, 1, 1.2], [13, 1, 1, 0.3, 0.3]];
  g.add(ghull(P, M.hull));
  bands(g, P, [-12, -9, 3], M.gold, 0.4, 0.25);
  ridge(g, M, P, -14, -11, 0.4); ridge(g, M, P, 7, 12.5, 0.4);
  /* Auge */
  const eye = new THREE.Group();
  eye.add(mesh(G('oel', () => new THREE.CircleGeometry(6.2, 40)), X.lens));
  eye.add(mesh(G('oer', () => new THREE.TorusGeometry(6.4, 0.55, 6, 40)), M.gold));
  eye.add(at(mesh(G('oer2', () => new THREE.TorusGeometry(5.6, 0.12, 3, 40)), M.glowSoft, false), 0, 0, 0.1));
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; eye.add(at(mesh(G('oes', () => new THREE.BoxGeometry(0.2, 2.6, 0.2).translate(0, 4.1, 0.15)), M.gold), 0, 0, 0, 0, 0, a)); }
  eye.add(at(mesh(G('oei', () => new THREE.TorusGeometry(2.6, 0.32, 4, 28)), M.gold), 0, 0, 0.2));
  const iris = mesh(G('oeg', () => new THREE.RingGeometry(1.1, 2.4, 28)), M.glow, false); iris.position.z = 0.15; iris.userData.spin = { axis: 'z', speed: 0.5 }; eye.add(iris);
  const pup = mesh(G('oep', () => new THREE.SphereGeometry(1, 14, 10).scale(1, 1, 0.5)), X.core, false); pup.position.z = 0.2; pup.userData.pulse = { amp: 0.1, speed: 1.5 }; eye.add(pup);
  /* Strahlenkranz außen (Krone der Linse) */
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const r = mesh(G('oec', () => new THREE.ConeGeometry(0.28, 2.4, 4).translate(0, 1.2, 0)), M.gold); r.position.set(Math.cos(a) * 6.9, Math.sin(a) * 6.9, -0.1); r.rotation.z = a - PI / 2; eye.add(r); }
  eye.add(at(mesh(G('oeb', () => new THREE.CylinderGeometry(6.4, 5.2, 2.6, 24, 1, true).rotateX(PI / 2).translate(0, 0, -1.3)), M.hull), 0, 0, 0));
  eye.position.set(0, 7.2, 4.4); eye.rotation.x = -0.5; eye.scale.setScalar(0.8); g.add(eye);
  /* Gabel */
  for (const s of [-1, 1]) { g.add(at(box(1, 6.2, 2.2, M.hull, 0.3), s * 5.7, 4.3, 4, 0, 0, s * 0.08)); g.add(at(mesh(G('ofj', () => new THREE.CylinderGeometry(1, 1, 1.2, 10).rotateZ(PI / 2)), M.gold), s * 5.9, 7.2, 4.4)); }
  g.add(at(box(12, 1.2, 3, M.hull2, 0.3), 0, 1.8, 3.6));
  /* Antennenkrone */
  const crown = new THREE.Group();
  crown.add(mesh(G('ocr', () => new THREE.TorusGeometry(3.2, 0.32, 5, 24).rotateX(PI / 2)), M.gold));
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, hh = i % 2 ? 4.5 : 7; const n = mesh(G('ocn' + hh, () => new THREE.CylinderGeometry(0.06, 0.18, hh, 5).translate(0, hh / 2, 0)), M.gold); n.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); n.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); crown.add(n); const tip = navLight(M, 0.26, 'light', 0.4 + i * 0.05); tip.position.set(Math.cos(a) * (3.2 + hh * 0.18), hh, Math.sin(a) * (3.2 + hh * 0.18)); crown.add(tip); }
  crown.position.set(0, 3.3, -8); g.add(crown);
  g.add(at(spire(M, 1.1, 2.4, 5), 0, 3.3, -8));
  /* Astrolab unter dem Kiel */
  const ast = new THREE.Group();
  ast.add(mesh(G('oas', () => new THREE.SphereGeometry(0.9, 12, 8)), M.glow, false));
  for (let i = 0; i < 2; i++) { const r = mesh(G('oar' + i, () => new THREE.TorusGeometry(2 + i * 0.6, 0.12, 4, 28)), M.gold); const pv = new THREE.Group(); pv.add(r); r.rotation.x = i ? 1.2 : 0.3; pv.userData.spin = { axis: i ? 'y' : 'x', speed: 0.7 - i * 0.3 }; ast.add(pv); }
  ast.position.set(0, -6, -2); g.add(ast);
  g.add(at(mesh(G('oam', () => new THREE.CylinderGeometry(0.15, 0.15, 3, 5)), M.gold), 0, -4, -2));
  both(g, at(glassRow(M, row(3, -8, 0, -0.4, 0.9, 1.7), 0.15), 3.02, 0, 0));
  for (const s of [-1, 1]) { const e = lengine(M, 1.2, 1.5, 7); e.position.set(s * 1.8, 0, -15); g.add(e); }
  nameplate(g, 'ORACLE', 3.12, 1.6, 6.5, 0.6);
  return g;
});

/* RESTORER – Bauschiff: zwei Gelenk-Greifarme (Gold) vor dem Bug, auf dem Rücken die Lade der Erweckung mit zwei
   goldenen Flügeln darüber, Arbeitslichter */
reg('restorer', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-17, 6, 4, 1.2, 1.4], [-11, 8, 5, 1.4, 1.8], [4, 8, 5, 1.4, 1.8], [9, 6, 4, 1.2, 1.4], [12, 2, 2, 0.5, 0.6]];
  g.add(ghull(P, M.hull));
  g.add(ghull([[-16, 6, 1.4, 0.2, 1.4, -3.4], [6, 6, 1.4, 0.2, 1.4, -3.4], [10, 2, 0.8, 0.1, 0.6, -2.6]], M.hull2));
  bands(g, P, [-14, -11, 4], M.gold, 0.45, 0.28);
  ridge(g, M, P, 4.5, 11.5, 0.45);
  both(g, wallTrim(M, 4, -0.75, 2.5, -11, 4));
  /* Greifarme */
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.add(mesh(G('rsh', () => new THREE.SphereGeometry(1.2, 10, 8)), M.gold));
    const a1 = new THREE.Group(); a1.add(at(box(1.4, 1.4, 8, M.hull, 0.3), 0, 0, 4)); a1.add(at(blk(0.3, 1.6, 7, M.gold), 0.65, 0, 4));
    const el = new THREE.Group(); el.position.z = 8; el.add(mesh(G('rel', () => new THREE.SphereGeometry(0.85, 10, 8)), M.gold));
    el.add(at(box(1.1, 1.1, 7, M.hull, 0.25), 0, 0, 3.5)); el.add(at(blk(0.3, 1.25, 6, M.gold), -0.5, 0, 3.5)); 
    for (const [ry, rx] of [[-0.35, 0], [0.35, 0.2], [0, -0.4]]) el.add(at(mesh(G('rcl', () => new THREE.ConeGeometry(0.3, 2.6, 5).rotateX(PI / 2).translate(0, 0, 1.3)), M.gold), 0, 0, 7, rx, ry));
    el.add(at(navLight(M, 0.3, 'light', 0.6), 0, 0.6, 6.8));
    el.rotation.y = s * 0.6; a1.add(el); a1.rotation.y = -s * 0.35; a1.rotation.x = 0.1; arm.add(a1);
    arm.position.set(s * 4.4, -0.4, 6); arm.userData.sway = { axis: 'x', amp: 0.08, speed: 0.6, phase: s };
    g.add(arm);
  }
  { const sp = glowSprite(M, 5); sp.position.set(0, -0.2, 19.5); g.add(sp); const wl = mesh(G('rwl', () => new THREE.TorusGeometry(2.2, 0.16, 4, 24)), M.glowSoft, false); wl.position.set(0, -0.2, 19.5); wl.userData.pulse = { amp: 0.1, speed: 3 }; g.add(wl); }
  /* Lade der Erweckung */
  const ark = new THREE.Group();
  ark.add(at(box(5, 2.6, 8, M.gold, 0.2), 0, 1.3, 0));
  ark.add(at(ghull([[-4.2, 5.4, 0.3, 1.4, 0.1], [4.2, 5.4, 0.3, 1.4, 0.1]], M.hull), 0, 2.8, 0));
  for (const s of [-1, 1]) { ark.add(at(strip(M, 0.1, 0.22, 7, M.glowSoft), s * 2.52, 1.6, 0)); ark.add(at(strip(M, 4.6, 0.22, 0.1, M.glowSoft), 0, 1.6, s * 4.02)); }
  both(ark, at(glassRow(M, row(3, -2.6, 2.6, 0.35, 0.8, 1.5), 0.12), 2.52, 0, 0));
  const wg = wingGeo();
  for (const s of [-1, 1]) { const w = mesh(wg, M.gold); w.scale.set(s * 1.05, 1, 1.25); w.position.set(s * 2.3, 3.3, -1.2); w.rotation.set(0.25, -s * 0.9, s * 1.0); ark.add(w); const f = mesh(G('rkf', () => new THREE.ConeGeometry(0.7, 2.2, 6)), M.gold); f.position.set(s * 2.2, 3.4, -1.6); ark.add(f); }
  const sp = glowSprite(M, 6); sp.position.set(0, 5, 0.5); ark.add(sp);
  ark.position.set(0, 3.3, -5); g.add(ark);
  /* Werklichter, Turm, Fenster */
  g.add(at(spire(M, 0.9, 2.6, 4), 0, 3.4, -13));
  both(g, at(glassRow(M, row(4, -9, 2, -0.3, 0.9, 1.8), 0.15), 4.02, 0, 0));
  for (const s of [-1, 1]) g.add(at(navLight(M, 0.35, 'light', 0.5), s * 4.2, 2.8, 8.5));
  for (const s of [-1, 1]) { const e = lengine(M, 1.4, 1.7, 7); e.position.set(s * 2.2, 0, -17); g.add(e); }
  nameplate(g, 'RESTORER', 4.12, 1.5, -12.5, 0.6);
  return g;
});

/* Sichel (Halbmond), Ebene X-Z */
const sickleGeo = () => G('sickle', () => {
  /* rechte Sichel in Schiffskoordinaten (x, z): Mittellinie als Bogen, Breite nimmt zur Spitze ab */
  const o = [], i2 = [], n = 14;
  for (let k = 0; k <= n; k++) { const t = k / n, a = -0.45 + t * 1.75, w = 1.9 * Math.pow(1 - t, 0.75) + 0.05, cx = -1.8 + Math.cos(a) * 7.4, cz = 8.4 + Math.sin(a) * 7.4; o.push([cx + Math.cos(a) * w / 2, cz + Math.sin(a) * w / 2]); i2.unshift([cx - Math.cos(a) * w / 2, cz - Math.sin(a) * w / 2]); }
  const e = new THREE.ExtrudeGeometry(new THREE.Shape(v2(o.concat(i2))), { depth: 0.4, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 1 }); e.translate(0, 0, -0.2); e.rotateX(PI / 2); return scaleUV(e, 0.1);
});
/* Erzurne (Amphore) auf Drehteil-Profil, Achse Y */
const urnGeo = () => G('urn', () => new THREE.LatheGeometry([[0, -3], [1.4, -2.8], [2.1, -1.6], [2.2, 0], [1.6, 1.6], [0.8, 2.3], [0.9, 2.9], [0, 3]].map(([x, y]) => new THREE.Vector2(x, y)), 10));

/* GLEANER – Sammler: zwei goldene Erntesicheln am Bug, vier Erz-Urnen mit Goldbändern an den Flanken, Reliktsucher */
reg('gleaner', M => {
  const g = new THREE.Group(), X = xm(M);
  const P = [[-15, 6, 4.4, 1.2, 1.6], [-9, 7, 5, 1.4, 1.8], [5, 7, 5, 1.4, 1.8], [10, 5, 4, 1, 1.4], [13, 1.4, 1.4, 0.3, 0.4]];
  g.add(ghull(P, M.hull));
  bands(g, P, [-12, -9, 5], M.gold, 0.45, 0.28);
  ridge(g, M, P, -7, 12, 0.45);
  /* Sicheln */
  for (const s of [-1, 1]) { const sk = mesh(sickleGeo(), M.gold); sk.scale.set(s, 1, 1); sk.position.set(0, -0.2, 0); g.add(sk); g.add(at(box(2.4, 1.4, 3, M.hull2, 0.3), s * 4.1, -0.2, 5.6)); g.add(at(strip(M, 0.2, 0.2, 4, M.glowSoft), s * 4.7, 0.4, 9.6, 0, s * 0.5)); }
  /* Urnen an Auslegern */
  for (const s of [-1, 1]) for (const z of [-8, 1]) {
    g.add(at(blk(2.2, 0.8, 1.2, M.hull2), s * 4.4, 0, z));
    const u = mesh(urnGeo(), M.hull); u.position.set(s * 6.6, 0, z); g.add(u);
    for (const y of [-1.6, 1.6]) g.add(at(mesh(G('ub' + y, () => new THREE.TorusGeometry(y < 0 ? 2.1 : 1.6, 0.16, 4, 14).rotateX(PI / 2)), M.gold), s * 6.6, y, z));
    g.add(at(mesh(G('ug', () => new THREE.CylinderGeometry(0.7, 0.7, 0.4, 10)), M.glow, false), s * 6.6, 3, z));
  }
  /* Reliktsucher: Turm mit kreisender Sonde */
  g.add(at(spire(M, 0.9, 2.4, 4), 0, 3.4, -10));
  const sv = new THREE.Group(); sv.add(at(mesh(G('gsr', () => new THREE.TorusGeometry(2, 0.1, 3, 20).rotateX(PI / 2)), M.gold), 0, 0, 0)); sv.add(at(navLight(M, 0.3, 'light', 0.5), 2, 0, 0)); sv.position.set(0, 7.4, -10); sv.userData.spin = { axis: 'y', speed: 1.2 }; g.add(sv);
  both(g, at(glassRow(M, row(4, -8, 3, -0.4, 0.9, 1.9), 0.15), 3.52, 0, 0));
  for (const s of [-1, 1]) { const e = lengine(M, 1.3, 1.6, 7); e.position.set(s * 2.2, 0, -15); g.add(e); }
  nameplate(g, 'GLEANER', 3.62, 1.7, -11.5, 0.6);
  return g;
});
export { G, xm, gsec, ghull, profAt, bands, ridge, wallTrim, blk, archPts, v2, scaleUV, glassRow, row, rose, pinnacle, spire, buttress, pier, lance, halo, banner, fin, lengine, thruster, crest, vesica, thorns, censer, pd, glowSprite, crane, lturret, cherubModel, escorts, bake, wingGeo, urnGeo, sickleGeo, nameplate };
