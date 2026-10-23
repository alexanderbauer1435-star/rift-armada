/* =====================================================================
   THE NEXUS – Maschinen-Kristall-Kollektiv. Kein geschlossener Rumpf: Schiffe sind Verbände facettierter Kristalle
   (violett-weiß, durchscheinend, innen leuchtend), von Energie in Formation gehalten: ein heller Kern, schwebende und
   kreisende Splitter, dünne Lichtfäden zwischen den Teilen, geometrische Ringe (Dreieck, Sechseck) und Gitter aus Licht.
   Grundordnung ist die Dreiheit (Teile auf 90°, 210°, 330° um die Längsachse) – 3 Shards → Prism → Monolith → Colossus.
   Antrieb: weiches Feld am Heck (Sechseckscheiben + violetter Schleier), keine Düsen. Teamfarbe: M.trim auf den Ringen.
   Bug +Z, oben +Y, Länge = data len.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { register, loft, ngon, mesh, at, tube, rng } from '../kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);

/* ------------------------------------------------------------ Geometrie-Cache (wiederverwenden statt neu bauen) */
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
function cnv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/* ------------------------------------------------------------ Materialien
   Kristalle bekommen einen Fresnel-Saum: Facetten, die schräg zur Kamera stehen, leuchten auf und werden deckender.
   Das macht aus flachen Flächen geschliffenen, innen glühenden Kristall – ohne teure Transmission. */
function rim(mat, col, pow, alpha = 0) {
  const c = new THREE.Color(col);
  mat.onBeforeCompile = sh => {
    sh.uniforms.nxRim = { value: c };
    sh.fragmentShader = 'uniform vec3 nxRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float nxF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${pow.toFixed(2)});
      totalEmissiveRadiance += nxRim * nxF;
      diffuseColor.a = mix(diffuseColor.a, 1.0, nxF * ${alpha.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => 'nxrim|' + pow + '|' + alpha;
  return mat;
}
const XC = new WeakMap();
function xm(M) {
  let X = XC.get(M); if (X) return X;
  const C = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const radial = stops => cnv(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const haloT = radial([[0, 1], [0.08, 0.85], [0.25, 0.3], [0.55, 0.07], [1, 0]]);
  /* Feldscheibe: helle Kante, weiches Innen, feines Sechseckraster */
  const fieldT = cnv(256, 256, (x, w) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(0.78, 'rgba(255,255,255,0.28)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(0.9, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1.5; const s = 22;
    for (let r = -1; r < 14; r++) for (let q = -1; q < 14; q++) { const cx = q * s * 1.5, cy = r * s * 1.732 + (q % 2) * s * 0.866, d = Math.hypot(cx - 128, cy - 128); if (d > 112) continue; x.beginPath(); for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU; x.lineTo(cx + Math.cos(a) * s * 0.92, cy + Math.sin(a) * s * 0.92); } x.stroke(); }
  });
  /* Spiegelglanz: dunkler Grund mit schrägen Lichtbahnen */
  const streakT = cnv(256, 256, (x, w) => {
    const g = x.createLinearGradient(0, 0, w, w); g.addColorStop(0, '#1c1040'); g.addColorStop(0.5, '#08051a'); g.addColorStop(1, '#241450'); x.fillStyle = g; x.fillRect(0, 0, w, w);
    for (const [p, wd, a] of [[0.2, 18, 0.9], [0.3, 5, 0.7], [0.58, 30, 0.5], [0.66, 4, 0.8], [0.84, 10, 0.6]]) { x.save(); x.translate(w * p, w * p); x.rotate(-Math.PI / 4); const lg = x.createLinearGradient(0, -wd, 0, wd); lg.addColorStop(0, 'rgba(230,215,255,0)'); lg.addColorStop(0.5, `rgba(230,215,255,${a})`); lg.addColorStop(1, 'rgba(230,215,255,0)'); x.fillStyle = lg; x.fillRect(-w, -wd, w * 2, wd * 2); x.restore(); }
  });
  const plume = M.plume.clone(); plume.color = C('#9560ff', 0.9);
  X = {
    /* durchscheinender Kristall (Hauptkörper) und deckende Fassung für kleine Teile */
    cry: rim(new THREE.MeshStandardMaterial({ color: '#d6c8ff', metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.62, emissive: '#6d3cff', emissiveIntensity: 0.3, flatShading: true, envMapIntensity: 1.1, vertexColors: true }), C('#b896ff', 0.8), 2.6, 0.5),
    cryS: rim(new THREE.MeshStandardMaterial({ color: '#d4c4ff', metalness: 0.25, roughness: 0.3, emissive: '#6a38f0', emissiveIntensity: 0.36, flatShading: true, envMapIntensity: 1.5, vertexColors: true }), C('#c8aaff', 0.7), 2.6),
    /* Obsidian: dunkler, spiegelnder Kristall mit schwachem violettem Saum (Monolith, Colossus, Klingen) */
    dark: rim(new THREE.MeshStandardMaterial({ color: '#1d1636', metalness: 0.82, roughness: 0.2, emissive: '#2c1378', emissiveIntensity: 0.35, flatShading: true, envMapIntensity: 2.2, vertexColors: true }), C('#8a5cff', 0.55), 3.4),
    vein: new THREE.MeshBasicMaterial({ color: C('#8a55ff', 1.7) }),                 /* Innenglut, satt violett */
    veinHot: new THREE.MeshBasicMaterial({ color: C('#e2d0ff', 2.2) }),             /* heiße Kanten, blüht */
    beam: new THREE.MeshBasicMaterial(Object.assign({ color: C('#b890ff', 2.0), opacity: 0.9 }, add)),
    beamSoft: new THREE.MeshBasicMaterial(Object.assign({ color: C('#9a6cff', 1.4), opacity: 0.7 }, add)),
    halo: new THREE.SpriteMaterial(Object.assign({ map: haloT, color: C('#a678ff', 0.95) }, add)),
    haloW: new THREE.SpriteMaterial(Object.assign({ map: haloT, color: C('#e8dcff', 0.75) }, add)),
    field: new THREE.MeshBasicMaterial(Object.assign({ map: fieldT, color: C('#a070ff', 1.1), side: THREE.DoubleSide }, add)),
    plume,
    mirror: new THREE.MeshStandardMaterial({ color: '#8c7fd6', metalness: 0.95, roughness: 0.1, envMapIntensity: 0.28, emissive: '#ffffff', emissiveMap: streakT, emissiveIntensity: 1.9, flatShading: true })
  };
  XC.set(M, X); return X;
}

/* ------------------------------------------------------------ Bauteile */
/* Kristall entlang Z: Bipyramide mit n Kanten, Bugspitze (tf) und Heckspitze (tb) als Längenanteil, sq = Höhe/Breite,
   sx = Breite, tw = Verdrehung der Querschnitte (0 = glatte Kanten, 1 = halbe Facette → geschliffene Dreiecksflächen),
   seg > 2 teilt den Körper in Bänder, rip kerbt jedes zweite Band ein (gestufter Obsidian). */
function gemOpts(o) { return { n: o.n || 6, sq: o.sq ?? 0.84, sx: o.sx ?? 1, tf: o.tf ?? 0.34, tb: o.tb ?? 0.22, tw: o.tw ?? 0.6, bt: o.bt ?? 0.04, ft: o.ft ?? 0.03, wf: o.wf ?? 0.88, wb: o.wb ?? 0.8, rot: o.rot || 0, mz: o.mz ?? 0.45, seg: o.seg || 2, rip: o.rip || 0 }; }
function gemProfile(L, r, q) {
  const z1 = -L / 2 + L * q.tb, z3 = L / 2 - L * q.tf, zs = [-L / 2], ss = [q.bt];
  if (q.seg <= 2) { zs.push(z1, z1 + (z3 - z1) * q.mz, z3); ss.push(q.wb, 1, q.wf); }
  else for (let k = 0; k <= q.seg; k++) { const t = k / q.seg; zs.push(z1 + (z3 - z1) * t); ss.push((q.wb + (q.wf - q.wb) * t + (1 - Math.max(q.wb, q.wf)) * Math.sin(Math.PI * t)) * (k % 2 ? 1 - q.rip : 1)); }
  zs.push(L / 2); ss.push(q.ft); return { zs, ss };
}
/* Facettenfarbe: jede Dreiecksfläche bekommt eine eigene Helligkeit und einen Hauch Weiß oder Violett (Vertexfarben) */
function facetCols(g, seed, lo = 0.62) {
  const n = g.attributes.position.count, r = rng(seed), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const v = lo + r() * (1 - lo), t = r(); const col = [v * (0.86 + 0.14 * t), v * (0.8 + 0.2 * t), v]; for (let k = 0; k < 3; k++) c.set(col, (i + k) * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function gemGeo(L, r, o = {}) {
  const q = gemOpts(o), key = 'gem|' + L + '|' + r + '|' + Object.values(q).join('|');
  return geo(key, () => {
    const h = q.tw * Math.PI / q.n, b = Math.PI / q.n + q.rot, { zs, ss } = gemProfile(L, r, q);
    return facetCols(loft(zs.map((z, j) => ({ z, pts: ngon(q.n, r * ss[j] * q.sx, r * ss[j] * q.sq, b + (j % 2 ? 0 : h)) })), null, { uv: 1 / 16 }).geometry, Math.round(L * 7 + r * 13 + q.n));
  });
}
function gem(L, r, mat, o, shadow = true) { return mesh(gemGeo(L, r, o), mat, shadow); }
/* Leuchtkanten eines Kristalls (Kanten ohne Verdrehung): ein zusammengefügtes Netz aus dünnen Stäben */
function gemEdges(X, L, r, o, mat = X.vein, rad = 0.2, every = 1) {
  const q = gemOpts(Object.assign({}, o, { tw: 0 })), { zs, ss } = gemProfile(L, r, q), pts = [], edges = [];
  for (let k = 0; k < q.n; k += every) {
    const a = Math.PI / q.n + q.rot + k / q.n * TAU, base = pts.length;
    zs.forEach((z, j) => pts.push([Math.cos(a) * r * ss[j] * q.sx * 1.012, Math.sin(a) * r * ss[j] * q.sq * 1.012, z]));
    for (let j = 0; j < zs.length - 1; j++) edges.push([base + j, base + j + 1]);
  }
  return mesh(frameGeo('edge|' + L + '|' + r + '|' + Object.values(q).join('|') + '|' + rad + '|' + every, pts, edges, rad), mat, false);
}
/* Energiebänder: Sechseckringe, die in den Kerben eines gestuften Kristalls sitzen */
function gemBands(X, L, r, o, mat = X.beam, t = 0.22) {
  const q = gemOpts(o), { zs, ss } = gemProfile(L, r, q), g = new THREE.Group();
  for (let j = 2; j < zs.length - 2; j += 2) { const m = ring(1, t / (r * ss[j]), mat, q.n, 3); m.scale.set(r * ss[j] * q.sx * 1.02, r * ss[j] * q.sq * 1.02, r * ss[j]); m.rotation.z = Math.PI / q.n + q.rot - Math.PI / 2; m.position.z = zs[j]; g.add(m); }
  return g;
}
/* Splitter: Oktaeder mit Eckenversatz (je Ecke einheitlich, damit die Flächen geschlossen bleiben) */
function fragGeo(seed) {
  seed = seed % 8;
  return geo('frag' + seed, () => {
    const r = rng(seed * 7 + 3), f = { x1: 0.45 + r() * 0.35, x0: 0.45 + r() * 0.35, y1: 0.45 + r() * 0.35, y0: 0.45 + r() * 0.35, z1: 1.3 + r() * 0.9, z0: 0.7 + r() * 0.5 };
    const g = new THREE.OctahedronGeometry(1, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * (x > 0 ? f.x1 : f.x0), y * (y > 0 ? f.y1 : f.y0), z * (z > 0 ? f.z1 : f.z0)); }
    g.computeVertexNormals(); return facetCols(g, seed + 11, 0.7);
  });
}
/* dünne Lichtstäbe zwischen Punkten, zu einer Geometrie verschmolzen */
function frameGeo(key, pts, edges, r, seg = 5) {
  return geo('frame|' + key, () => mergeGeometries(edges.map(([a, b]) => {
    const A = new THREE.Vector3(...pts[a]), B = new THREE.Vector3(...pts[b]), d = B.clone().sub(A), l = d.length();
    const c = new THREE.CylinderGeometry(r, r, l, seg, 1, true); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); c.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return c;
  })));
}
/* kleine Leuchtknoten an Punkten, verschmolzen */
function nodesGeo(key, pts, r) { return geo('nodes|' + key, () => mergeGeometries(pts.map(p => new THREE.OctahedronGeometry(r, 0).translate(...p)))); }
/* einzelner Lichtstrahl von a nach b */
function beam(X, a, b, r = 0.15, mat = X.beam) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  const m = mesh(geo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)), mat, false);
  m.scale.set(r, l, r); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m;
}
/* geometrischer Ring um die Z-Achse: n = 3 Dreieck, 6 Sechseck, ≥ 12 rund; erste Ecke oben */
function ring(R, t, mat, n = 6, rs = 4) { return mesh(geo(`ring|${R}|${t}|${n}|${rs}`, () => new THREE.TorusGeometry(R, t, rs, n).rotateZ(n < 12 ? Math.PI / 2 : 0)), mat, false); }
function spinning(o, axis, speed, z = 0) { const p = new THREE.Group(); p.position.z = z; p.userData.spin = { axis, speed }; p.add(o); return p; }
/* Kern: heller Facettenkörper mit Lichthof, pulsiert */
function core(M, X, r, halo = r * 7, pulse = 0.07, hm = X.halo) {
  const g = new THREE.Group();
  const c = mesh(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), M.core, false); c.scale.setScalar(r); g.add(c);
  if (halo) { const s = new THREE.Sprite(hm); s.scale.setScalar(halo); g.add(s); }
  if (pulse) g.userData.pulse = { amp: pulse, speed: 1.4 + (r * 0.37) % 1 };
  return g;
}
/* Antriebsfeld am Heck: Sechseckscheiben, Lichtring, weicher violetter Schleier nach hinten */
function field(M, X, r, len = r * 2) {
  const g = new THREE.Group();
  const dg = geo('hexdisc', () => new THREE.CircleGeometry(1, 6).rotateZ(Math.PI / 2));
  const d1 = mesh(dg, X.field, false); d1.scale.setScalar(r); g.add(d1);
  const d2 = mesh(dg, X.field, false); d2.scale.setScalar(r * 0.62); d2.position.z = -r * 0.45; d2.rotation.z = Math.PI / 6; g.add(d2);
  g.add(ring(r, r * 0.045, X.beam, 6, 3));
  const pw = new THREE.Group(); pw.scale.set(r * 0.62, r * 0.62, len); pw.position.z = -r * 0.1;
  const pl = new THREE.Mesh(geo('plume', () => { const c = new THREE.CylinderGeometry(1, 0.1, 1, 12, 1, true); c.translate(0, -0.5, 0); c.rotateX(Math.PI / 2); return c; }), X.plume); pl.userData.flame = true; pl.renderOrder = 2; pw.add(pl); g.add(pw);
  return g;
}
/* kreisende Splitter. axis 'z': Bahn um die Längsachse (Splitter zeigen nach vorn), 'y': waagrechte Krone (Splitter stehen) */
function orbiters(M, X, o) {
  const { n = 3, r = 4, z = 0, y = 0, size = 1, speed = 0.5, mat = X.cryS, flat = 1, wob = 0, seed = 1, axis = 'z', phase = 0, lean = 0 } = o;
  const piv = new THREE.Group(); piv.position.set(0, y, z); if (axis === 'z') piv.rotation.x = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const w = new THREE.Group(), f = mesh(fragGeo(seed + i), mat); f.scale.setScalar(size * (0.75 + ((i * 37 + seed) % 10) / 20)); f.rotation.set(-Math.PI / 2, lean, 0); w.add(f);
    const a = phase + i / n * TAU; w.userData.orbit = { r, speed, phase: a, wob, flat }; w.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * flat); piv.add(w);
  }
  return piv;
}
/* Dreiheit: make(i, Winkel) baut ein Teil im Rahmen »außen = +Y«; der Rahmen wird um Z auf den Winkel gedreht */
const TRI = [90, 210, 330], HEX = [90, 150, 210, 270, 330, 30];
function tri(g, make, angles = TRI) { return angles.map((a, i) => { const f = new THREE.Group(); f.rotation.z = (a - 90) * DEG; const o = make(i, a); if (o) f.add(o); g.add(f); return f; }); }
/* Weltposition eines Teils relativ zur Wurzel g (g liegt im Ursprung) */
function wp(g, o) { g.updateMatrixWorld(true); const v = o.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; }
function marker(parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }
/* Haken-Kristall entlang einer Richtung */
function hook(X, at3, dir, L, mat = X.cryS) { const h = gem(L, L * 0.17, mat, { n: 4, tf: 0.6, tb: 0.15, tw: 0 }); h.position.set(at3[0] + dir.x * L * 0.3, at3[1] + dir.y * L * 0.3, at3[2] + dir.z * L * 0.3); h.quaternion.setFromUnitVectors(FWD, dir); return h; }
/* Lichttentakel (Conduit): weiche Kurve aus Licht mit Haken; pts im Rahmen »außen = +Y« */
function tendril(M, X, pts, r0, r1, hookL, sway) {
  const g = new THREE.Group(), o = pts[0], rel = pts.map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
  const t1 = tube(rel, r0, r1, X.beamSoft, 20, 5); t1.castShadow = false; g.add(t1);
  const t2 = tube(rel, r0 * 0.4, r1 * 0.5, X.veinHot, 20, 4); t2.castShadow = false; g.add(t2);
  const e = rel[rel.length - 1], p = rel[rel.length - 2]; g.add(hook(X, e, new THREE.Vector3(e[0] - p[0], e[1] - p[1], e[2] - p[2]).normalize(), hookL));
  g.position.set(...o); if (sway) g.userData.sway = sway;
  return g;
}
/* Lichtklaue (Binder): gerade Glieder aus Licht, Kristallknöchel an den Gelenken, Haken an der Spitze */
function claw(M, X, pts, r, hookL, sway) {
  const g = new THREE.Group(), o = pts[0], rel = pts.map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
  for (let i = 0; i < rel.length - 1; i++) { g.add(beam(X, rel[i], rel[i + 1], r * (1 - i * 0.18))); g.add(beam(X, rel[i], rel[i + 1], r * 0.35 * (1 - i * 0.18), X.veinHot)); }
  for (let i = 1; i < rel.length - 1; i++) { const k = mesh(fragGeo(i + 2), X.cryS); k.scale.setScalar(0.75 - i * 0.1); k.position.set(...rel[i]); k.rotation.set(i, i * 1.7, 0); g.add(k); }
  const e = rel[rel.length - 1], p = rel[rel.length - 2]; g.add(hook(X, e, new THREE.Vector3(e[0] - p[0], e[1] - p[1], e[2] - p[2]).normalize(), hookL));
  g.position.set(...o); if (sway) g.userData.sway = sway;
  return g;
}

/* ------------------------------------------------------------ Grundeinheit SHARD (Länge ≈ 24) */
function shardUnit(M, X, o = {}) {
  const g = new THREE.Group();
  g.add(at(gem(17, 2.4, X.cry, { n: 5, tf: 0.42, tb: 0.2, sq: 0.8 }), 0, 0, 3));
  g.add(at(gem(13, 1.0, X.vein, { n: 4, tf: 0.42, tw: 0 }, false), 0, 0, 3.4));
  /* drei Klingen in Dreiheit, nach hinten gespreizt (Obsidian) */
  tri(g, i => { const b = gem(i ? 9.5 : 7, i ? 1.15 : 0.9, X.dark, { n: 4, sx: 0.36, tf: 0.5, tb: 0.32, tw: 0 }); b.position.set(0, i ? 2.4 : 2.1, -2.6); b.rotation.x = 0.38; return b; });
  const c = core(M, X, 1.1, 7.5); c.position.z = -6.6; g.add(c);
  g.add(spinning(ring(2.5, 0.17, M.trim, 6, 4), 'z', 0.7, -6.6));
  g.add(beam(X, [0, 0, -6.2], [0, 0, -4.6], 0.32));
  if (o.field !== false) g.add(at(field(M, X, 2.1, 4.5), 0, 0, -8.4));
  if (o.orbit !== false) g.add(orbiters(M, X, { n: 3, r: 3.7, z: -6.6, size: 0.6, speed: 0.9, seed: 2 }));
  return { g, core: c, bow: marker(g, 0, 0, 11.5) };
}
/* Prisma-Verband (für Monolith): Dreikant-Kristall mit drei schlanken Splittern, eigener Kern */
function prismCluster(M, X) {
  const g = new THREE.Group(), tri3 = { n: 3, tf: 0.3, tb: 0.18, sq: 1, tw: 0, rot: -30 * DEG };
  g.add(gem(32, 3.3, X.cry, tri3));
  g.add(gemEdges(X, 32, 3.3, tri3, X.veinHot, 0.12));
  g.add(gem(24, 1.0, X.vein, tri3, false));
  tri(g, () => { const b = gem(16, 1.25, X.cryS, { n: 5, tf: 0.44, tb: 0.2 }); b.position.set(0, 4.3, -5); b.rotation.x = 0.12; return b; });
  const c = core(M, X, 1.2, 7); c.position.z = -15.5; g.add(c);
  const rg = ring(7.4, 0.26, M.trim, 3, 4); rg.position.z = -8; g.add(rg);
  return { g, core: c, bow: marker(g, 0, 0, 16) };
}

/* ======================================================================== SHARD */
register('shard', M => shardUnit(M, xm(M)).g);

/* ======================================================================== PRISM – drei Shards um einen Dreikant-Kristall */
register('prism', M => {
  const X = xm(M), g = new THREE.Group(), tri3 = { n: 3, tf: 0.32, tb: 0.18, sq: 1, tw: 0, rot: -30 * DEG };
  g.add(at(gem(30, 3.4, X.cry, tri3), 0, 0, 4));
  g.add(at(gemEdges(X, 30, 3.4, tri3, X.veinHot, 0.14), 0, 0, 4));
  g.add(at(gem(22, 1.0, X.vein, tri3, false), 0, 0, 4));
  const units = [];
  tri(g, () => { const u = shardUnit(M, X, { field: false, orbit: false }); u.g.scale.setScalar(0.72); u.g.position.set(0, 7.2, -3); u.g.rotation.x = 0.1; units.push(u); return u.g; });
  const c = core(M, X, 1.8, 13); c.position.z = -11; g.add(c);
  /* Brechungslinse vorn: Strahl teilt sich auf drei Spitzen */
  const lens = gem(6, 1.7, X.cryS, { n: 4, tf: 0.5, tb: 0.5, tw: 0, sq: 1 }); lens.position.z = 23; lens.userData.spin = { axis: 'z', speed: 1.2 }; g.add(lens);
  const lc = core(M, X, 0.7, 6, 0.15, X.haloW); lc.position.z = 23; g.add(lc);
  for (const u of units) { g.add(beam(X, [0, 0, -11], wp(g, u.core), 0.2)); g.add(beam(X, [0, 0, 23], wp(g, u.bow), 0.12, X.beamSoft)); }
  g.add(beam(X, [0, 0, -9.5], [0, 0, -6.5], 0.4));
  const r1 = ring(11, 0.34, M.trim, 3, 4); r1.position.z = -6; g.add(r1);
  g.add(spinning(ring(9.6, 0.2, X.beam, 3, 3), 'z', -0.25, 7));
  g.add(at(field(M, X, 4.2, 8), 0, 0, -16));
  g.add(orbiters(M, X, { n: 5, r: 12.5, z: -4, size: 0.85, speed: 0.35, seed: 4, wob: 1.2 }));
  return g;
});

/* ======================================================================== MONOLITH – Obsidian-Raute, drei Prisma-Verbände */
register('monolith', M => {
  const X = xm(M), g = new THREE.Group(), mono = { n: 6, sq: 0.9, tf: 0.24, tb: 0.15, tw: 0, wb: 0.86, wf: 0.9, seg: 6, rip: 0.08 };
  g.add(at(gem(62, 7.8, X.dark, mono), 0, 0, 3));
  g.add(at(gemEdges(X, 62, 7.8, mono, X.vein, 0.26), 0, 0, 3));
  g.add(at(gemBands(X, 62, 7.8, mono, X.beam, 0.3), 0, 0, 3));
  /* Kristallaufwuchs auf dem Rücken des Monolithen */
  for (const [x, z, s, ry] of [[1.6, 10, 1, 0.2], [-1.8, 3, 0.8, -0.3], [0.6, -7, 0.65, 0.1]]) { const p = gem(9 * s, 1.5 * s, X.cryS, { n: 5, tf: 0.5 }); p.position.set(x, 7 + s * 0.6, z); p.rotation.set(-0.5, ry, 0); g.add(p); }
  const cl = [];
  tri(g, () => { const c = prismCluster(M, X); c.g.scale.setScalar(0.92); c.g.position.set(0, 15.5, -3); c.g.rotation.x = 0.06; cl.push(c); return c.g; });
  /* Verbindungsstreben und Brückenklinge zum Kern-Kristall */
  tri(g, () => { const s = new THREE.Group(); for (const z of [-14, 10]) s.add(beam(X, [0, 6.6, z], [0, 12.8, z - 1], 0.28)); s.add(at(gem(26, 1.5, X.dark, { n: 4, sx: 0.4, tw: 0 }), 0, 9.6, -2)); return s; });
  const heart = core(M, X, 3, 22, 0.06); heart.position.z = -30.5; g.add(heart);
  const emit = core(M, X, 1.5, 11, 0.12, X.haloW); emit.position.z = 36; g.add(emit);
  g.add(at(gem(8, 1.6, X.veinHot, { n: 4, tf: 0.6, tb: 0.2, tw: 0, rot: 45 * DEG }, false), 0, 0, 33.5));
  for (const c of cl) { g.add(beam(X, [0, 0, -30.5], wp(g, c.core), 0.3)); g.add(beam(X, [0, 0, 36], wp(g, c.bow), 0.15, X.beamSoft)); }
  g.add(spinning(ring(25, 0.5, M.trim, 3, 4), 'z', 0.1, -15));
  g.add(spinning(ring(22, 0.3, X.beam, 3, 3), 'z', -0.14, 13));
  g.add(at(field(M, X, 8, 13), 0, 0, -34));
  g.add(orbiters(M, X, { n: 6, r: 26, z: 6, size: 1.5, speed: 0.18, seed: 1, wob: 2 }));
  return g;
});

/* ======================================================================== COLOSSUS – drei Monolithe zu einem verschmolzen */
register('colossus', M => {
  const X = xm(M), g = new THREE.Group(), mono = { n: 6, sq: 0.9, tf: 0.28, tb: 0.16, tw: 0, wb: 0.86, wf: 0.9, seg: 8, rip: 0.07 };
  const tails = [];
  tri(g, () => {
    const m = new THREE.Group();
    m.add(gem(86, 8.8, X.dark, mono)); m.add(gemEdges(X, 86, 8.8, mono, X.vein, 0.34)); m.add(gemBands(X, 86, 8.8, mono, X.beam, 0.36));
    /* helle Kristallschuppen auf der Außenseite (Erinnerung an die Prismen) */
    for (const [z, s] of [[-14, 1], [2, 0.85], [16, 0.7]]) { const p = gem(20 * s, 2.2 * s, X.cryS, { n: 3, sq: 1, tw: 0, rot: -30 * DEG, tf: 0.4 }); p.position.set(0, 8.4 + 2 * s, z); p.rotation.x = 0.28; m.add(p); }
    m.position.set(0, 12.5, -6); m.rotation.x = 0.11; tails.push(marker(m, 0, 0, -43)); return m;
  });
  /* Schmelznähte: heiße Lichtlinien entlang der Fugen zwischen den Monolithen */
  tri(g, () => beam(X, [0, 5, -38], [0, 1.5, 34], 0.45, X.vein), [30, 150, 270]);
  const heart = core(M, X, 5.5, 46, 0.05); heart.position.z = -10; g.add(heart);
  /* Speerspitze: heller Kristall, der vorn aus der Verschmelzung tritt */
  g.add(at(gem(44, 4.6, X.cry, { n: 6, tf: 0.42, tb: 0.2, tw: 0.6 }), 0, 0, 36)); g.add(at(gem(34, 1.4, X.vein, { n: 4, tw: 0 }, false), 0, 0, 37));
  const emit = core(M, X, 1.8, 14, 0.12, X.haloW); emit.position.z = 58; g.add(emit);
  const rear = core(M, X, 3, 22, 0.08); rear.position.z = -50; g.add(rear);
  for (const t of tails) g.add(beam(X, [0, 0, -50], wp(g, t), 0.45));
  g.add(at(field(M, X, 13, 18), 0, 0, -53));
  g.add(spinning(ring(34, 0.75, M.trim, 3, 4), 'z', 0.07, -30));
  g.add(spinning(ring(30, 0.5, X.beam, 6, 3), 'z', -0.09, 14));
  g.add(orbiters(M, X, { n: 9, r: 42, z: -8, size: 2.8, speed: 0.11, seed: 3, wob: 4, flat: 0.9 }));
  return g;
});

/* ======================================================================== PRIME FACET – der älteste Kristall */
register('facet', M => {
  const X = xm(M), g = new THREE.Group(), big = { n: 8, tf: 0.34, tb: 0.26, sq: 0.86, tw: 0, seg: 4, rip: 0.05 };
  /* der Urkristall: massiger Achtkant mit glühenden Kanten, dunklem Kern und Lichtader */
  g.add(at(gem(64, 12.5, X.cry, big), 0, 0, 3));
  g.add(at(gemEdges(X, 64, 12.5, big, X.veinHot, 0.15), 0, 0, 3));
  g.add(at(gem(52, 2.6, X.vein, { n: 6, tw: 0, tf: 0.34 }, false), 0, 0, 3));
  g.add(at(gem(34, 6.5, X.dark, { n: 8, tw: 0.6 }), 0, 0, -1));
  const heart = core(M, X, 3.6, 30, 0.05, X.haloW); g.add(heart);
  /* Krone: stehende Kristalle kreisen in waagrechter Bahn um das Herz */
  const crown = new THREE.Group(); crown.position.y = 3;
  for (let i = 0; i < 9; i++) { const w = new THREE.Group(), k = gem(12 + (i % 3) * 3, 1.9, X.cryS, { n: 4, tf: 0.45, tb: 0.3, tw: 0.5 }); k.rotation.set(-Math.PI / 2, 0, 0.18); w.add(k); const a = i / 9 * TAU; w.userData.orbit = { r: 29, speed: 0.14, phase: a, wob: 1.2 }; w.position.set(Math.cos(a) * 29, 0, Math.sin(a) * 29); crown.add(w); }
  g.add(crown);
  /* langsam drehende Ringe: zwei gekippte Kronreifen, zwei Sechseck-Kragen */
  const rat = ring(25, 0.85, M.trim, 48, 4); rat.rotation.x = Math.PI / 2 - 0.2; g.add(spinning(rat, 'y', 0.1));
  const rbt = ring(21.5, 0.4, X.beam, 48, 3); rbt.rotation.x = Math.PI / 2 + 0.32; g.add(spinning(rbt, 'y', -0.14));
  g.add(spinning(ring(15.5, 0.4, X.beam, 8, 3), 'z', 0.22, 17));
  /* Heckfächer aus drei Prismen */
  const tail = [];
  tri(g, () => { const p = gem(22, 2.4, X.cry, { n: 3, sq: 1, tw: 0, rot: -30 * DEG, tf: 0.36 }); p.position.set(0, 7.5, -29); p.rotation.x = 0.32; tail.push(marker(p, 0, 0, 5)); return p; }, [90, 210, 330]);
  for (const t of tail) g.add(beam(X, [0, 0, -14], wp(g, t), 0.25));
  const emit = core(M, X, 1.4, 10, 0.12, X.haloW); emit.position.z = 37; g.add(emit);
  g.add(at(field(M, X, 7.5, 12), 0, 0, -36));
  return g;
});

/* ======================================================================== SEED – Bauschiff: Knospe aus drei Schalen um einen Samen */
register('seed', M => {
  const X = xm(M), g = new THREE.Group();
  tri(g, () => { const p = gem(25, 2.9, X.cry, { n: 5, sq: 0.5, tf: 0.34, tb: 0.26, tw: 0.4 }); p.position.set(0, 4.6, 0.5); p.rotation.x = 0.2; return p; });
  tri(g, () => { const p = gem(7, 0.8, X.dark, { n: 4, sx: 0.4, tw: 0 }); p.position.set(0, 7.5, -8); p.rotation.x = 0.5; return p; }, [30, 150, 270]);
  /* Same: Kern in einem drehenden Oktaeder-Gitter */
  const seed = core(M, X, 1.5, 10, 0.12); seed.position.z = 1.5; g.add(seed);
  const op = [[3.2, 0, 0], [-3.2, 0, 0], [0, 3.2, 0], [0, -3.2, 0], [0, 0, 3.8], [0, 0, -3.8]], oe = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
  const cage = new THREE.Group(); cage.add(mesh(frameGeo('seedcage', op, oe, 0.1), X.beam, false)); cage.add(mesh(nodesGeo('seedcage', op, 0.35), M.core, false));
  g.add(spinning(cage, 'y', 0.6, 1.5));
  g.add(at(gem(11, 3.1, X.dark, { n: 6, tf: 0.2, tb: 0.4 }), 0, 0, -9));
  const nz = ring(2.4, 0.18, M.trim, 6, 4); nz.position.z = 13.5; g.add(nz);
  g.add(beam(X, [0, 0, 4], [0, 0, 13.5], 0.12, X.beamSoft));
  /* mitgeführte Knoten (kleine Gitter-Oktaeder), kreisen um das Schiff */
  const piv = new THREE.Group(); piv.position.z = -3; piv.rotation.x = Math.PI / 2;
  const np = op.map(p => p.map(v => v * 0.38));
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Group(); w.add(mesh(frameGeo('seednode', np, oe, 0.07), X.beam, false)); w.add(core(M, X, 0.45, 3.4, 0.2));
    const a = i / 3 * TAU + 0.5; w.userData.orbit = { r: 9.5, speed: 0.4, phase: a, wob: 1 }; w.position.set(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5); piv.add(w);
  }
  g.add(piv);
  g.add(at(field(M, X, 3.3, 6), 0, 0, -14.5));
  return g;
});

/* ======================================================================== HARVESTER – Trichter aus Klingen, Wirbel, Speicher */
register('harvester', M => {
  const X = xm(M), g = new THREE.Group();
  tri(g, () => { const b = gem(13, 1.3, X.cry, { n: 4, sx: 0.32, tf: 0.45, tb: 0.25, tw: 0 }); b.position.set(0, 4.6, 7.5); b.rotation.x = -0.5; return b; }, HEX);
  const base = ring(3.2, 0.3, M.trim, 6, 4); base.position.z = 2.2; g.add(base);
  /* Wirbel: drei sich gegenläufig drehende Sechseckringe, in den Trichter gestaffelt */
  [[2.2, 4.0, 1.4], [3.4, 6.5, -1.1], [4.8, 9.2, 0.8]].forEach(([R, z, s]) => g.add(spinning(ring(R, 0.12, X.beam, 6, 3), 'z', s, z)));
  /* Auflösungsstrahl nach vorn */
  const bw = new THREE.Group(); bw.position.z = 3; bw.scale.set(1.6, 1.6, 13);
  const bm = new THREE.Mesh(geo('beamFwd', () => { const c = new THREE.CylinderGeometry(1, 0.35, 1, 10, 1, true); c.translate(0, -0.5, 0); c.rotateX(-Math.PI / 2); return c; }), X.plume); bm.userData.flame = true; bm.renderOrder = 2; bw.add(bm); g.add(bw);
  const mouth = core(M, X, 0.9, 7, 0.2); mouth.position.z = 3.2; g.add(mouth);
  g.add(orbiters(M, X, { n: 6, r: 2.8, z: 7.5, size: 0.35, speed: 1.6, seed: 6, wob: 1.6, mat: X.veinHot }));
  /* Speicher: klarer Kristalltank mit leuchtendem Gut */
  g.add(at(gem(15, 3.8, X.cry, { n: 6, tf: 0.24, tb: 0.3, tw: 0.5 }), 0, 0, -6));
  const ld = new THREE.Group();
  [[1.2, 0.5, -2], [-1, 0.9, 0.5], [0.2, -1.2, 2], [-0.6, -0.3, -3.5], [1, -0.8, 3.6]].forEach(([x, y, z], i) => { const f = mesh(fragGeo(i), X.vein, false); f.scale.setScalar(0.9); f.position.set(x, y, z); f.rotation.set(i, i * 2, 0); ld.add(f); });
  g.add(spinning(ld, 'z', 0.5, -6));
  tri(g, () => { const s = new THREE.Group(); s.add(beam(X, [0, 3, -2], [0, 3.2, 2.2], 0.16)); s.add(at(gem(9, 0.9, X.dark, { n: 4, sx: 0.5, tw: 0 }), 0, 3.6, -8)); return s; });
  const c = core(M, X, 1, 6); c.position.z = -14; g.add(c);
  g.add(at(field(M, X, 3, 5), 0, 0, -14.5));
  return g;
});

/* ======================================================================== BINDER – Kristallkörper mit drei Lichtklauen */
register('binder', M => {
  const X = xm(M), g = new THREE.Group();
  g.add(at(gem(26, 3.5, X.cry, { n: 6, tf: 0.26, tb: 0.3 }), 0, 0, -4));
  g.add(at(gem(20, 1.0, X.vein, { n: 4, tw: 0 }, false), 0, 0, -4));
  tri(g, () => { const b = gem(14, 1.4, X.dark, { n: 4, sx: 0.36, tf: 0.5, tb: 0.3, tw: 0 }); b.position.set(0, 3.8, -8); b.rotation.x = 0.36; return b; });
  g.add(at(ring(4.4, 0.34, M.trim, 3, 4), 0, 0, 7.5));
  /* Klauen: drei gegliederte Lichtfinger, offen nach vorn, Haken einwärts; öffnen und schließen sich langsam */
  tri(g, i => claw(M, X, [[0, 4.4, 7.5], [0, 8.8, 11], [0, 9.6, 16.5], [0, 7, 20.5]], 0.32, 4.6, { axis: 'x', amp: 0.09, speed: 0.9, phase: i * 2 }));
  const grip = core(M, X, 0.55, 8, 0.3); grip.position.z = 15.5; g.add(grip);
  g.add(beam(X, [0, 0, 8], [0, 0, 15], 0.12, X.beamSoft));
  const c = core(M, X, 1.4, 9); c.position.z = -15; g.add(c);
  g.add(spinning(ring(3, 0.18, X.beam, 6, 3), 'z', 0.8, -15));
  g.add(orbiters(M, X, { n: 3, r: 6.5, z: -6, size: 0.7, speed: 0.6, seed: 3 }));
  g.add(at(field(M, X, 3.2, 5), 0, 0, -17.5));
  return g;
});

/* ======================================================================== CONDUIT – Kristallröhre um einen Lichtkanal, Portal mit sechs Fäden */
register('conduit', M => {
  const X = xm(M), g = new THREE.Group();
  tri(g, i => { const s = gem(30, 1.7, i % 2 ? X.dark : X.cry, { n: 4, tf: 0.24, tb: 0.2, tw: 0, sx: 0.7 }); s.position.set(0, 5, -3); s.rotation.x = 0.07; return s; }, HEX);
  for (const [z, R] of [[-13, 6.8], [-3, 6.3], [7, 5.8]]) { const r = ring(R, 0.26, M.trim, 6, 4); r.position.z = z; g.add(r); }
  g.add(beam(X, [0, 0, -16], [0, 0, 13], 0.55));
  for (const z of [-11, -3, 5]) { const c = core(M, X, z === -3 ? 1.5 : 0.9, z === -3 ? 11 : 6); c.position.z = z; g.add(c); }
  /* Portal vorn, dreht sich, sechs Fäden greifen nach vorn */
  const port = new THREE.Group();
  port.add(ring(7.6, 0.3, X.beam, 6, 3));
  const pd = mesh(geo('hexdisc', () => new THREE.CircleGeometry(1, 6).rotateZ(Math.PI / 2)), X.field, false); pd.scale.setScalar(7.2); port.add(pd);
  tri(port, i => tendril(M, X, [[0, 7.6, 0], [0, 8.3, 4], [0, 7.7, 8.5], [0, 6.2, 12.5], [0, 4.8, 14.5]], 0.28, 0.1, 3, { axis: 'x', amp: 0.12, speed: 1.3, phase: i }), HEX);
  g.add(spinning(port, 'z', 0.25, 14));
  g.add(at(field(M, X, 4, 5), 0, 0, -18));
  return g;
});

/* ======================================================================== MIRROR – drei große Spiegelfacetten öffnen sich nach vorn */
/* Spiegelblatt: flache Raute mit leicht erhabener Mitte (vier Facetten), Rückseite flach; Länge entlang +Z ab z = 0 */
function kiteGeo(w, l, m, h, t = 0.5) {
  return geo('kite|' + w + '|' + l + '|' + m + '|' + h, () => {
    const A = [0, 0, 0], B = [w / 2, 0, l * m], Cc = [0, 0, l], D = [-w / 2, 0, l * m], E = [0, h, l * m * 0.95];
    const lo = p => [p[0], p[1] - t, p[2]], tris = [[E, A, B], [E, B, Cc], [E, Cc, D], [E, D, A], [lo(A), lo(Cc), lo(B)], [lo(A), lo(D), lo(Cc)]];
    for (const [p, q] of [[A, B], [B, Cc], [Cc, D], [D, A]]) tris.push([p, lo(q), q], [p, lo(p), lo(q)]);
    const pos = [], uv = [], ref = new THREE.Vector3(0, -t / 2, l * m);
    for (let [a, b, c] of tris) {
      const n = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a))), mid = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).add(new THREE.Vector3(...c)).multiplyScalar(1 / 3);
      if (n.dot(mid.sub(ref)) < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) { pos.push(...p); uv.push(p[0] / w + 0.5, p[2] / l); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  });
}
register('mirror', M => {
  const X = xm(M), g = new THREE.Group(), W = 15, L = 26, MID = 0.42;
  tri(g, i => {
    const p = new THREE.Group();
    p.add(mesh(kiteGeo(W, L, MID, 2.8), X.mirror));
    /* innere Facette: kleinere Spiegelraute, gekippt; Leuchtkanten außen und innen */
    const inner = mesh(kiteGeo(W * 0.46, L * 0.46, MID, 0.8, 0.3), X.mirror); inner.position.set(0, 1.0, L * 0.34); inner.rotation.x = -0.08; p.add(inner);
    const pts = [[0, 0.05, 0], [W / 2, 0.05, L * MID], [0, 0.05, L], [-W / 2, 0.05, L * MID], [0, 2.85, L * MID * 0.95]], ed = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2]];
    p.add(mesh(frameGeo('mirrorKite', pts, ed, 0.24), X.beam, false));
    p.add(at(navGem(X, 0.7), 0, 0.2, L));
    p.position.set(0, 2.4, -6); p.rotation.x = -0.6; p.userData.sway = { axis: 'x', base: -0.6, amp: 0.05, speed: 0.6, phase: i * 2.1 };
    return p;
  });
  /* Herz im Kelch, Dorn nach vorn */
  const c = core(M, X, 1.7, 14, 0.08, X.haloW); c.position.z = -5; g.add(c);
  g.add(at(gem(22, 1.5, X.cry, { n: 6, tf: 0.5, tb: 0.15 }), 0, 0, 6));
  g.add(at(gem(16, 0.5, X.vein, { n: 4, tw: 0, tf: 0.5 }, false), 0, 0, 6));
  /* Heckkörper, Obsidian, mit Leuchtkanten */
  const rb = { n: 6, tf: 0.2, tb: 0.36, tw: 0, sq: 0.9 };
  g.add(at(gem(20, 3.6, X.dark, rb), 0, 0, -14)); g.add(at(gemEdges(X, 20, 3.6, rb, X.vein, 0.14, 2), 0, 0, -14));
  /* kleine Spiegelkacheln, die das Heck umkreisen */
  const piv = new THREE.Group(); piv.position.z = -14; piv.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const w = new THREE.Group(), t = mesh(geo('hextile', () => new THREE.CylinderGeometry(1.6, 1.6, 0.3, 6)), X.mirror); t.rotation.z = Math.PI / 2; w.add(t); const a = i / 4 * TAU; w.userData.orbit = { r: 7, speed: 0.45, phase: a, wob: 1.2 }; w.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7); piv.add(w); }
  g.add(piv);
  g.add(at(field(M, X, 3.6, 6), 0, 0, -24));
  return g;
});
/* kleiner leuchtender Spitzenkristall */
function navGem(X, r) { const m = mesh(geo('octa', () => new THREE.OctahedronGeometry(1, 0)), X.veinHot, false); m.scale.set(r, r, r * 1.6); return m; }

/* ======================================================================== LATTICE – offenes Gitter, mobiler Netzknoten */
register('lattice', M => {
  const X = xm(M), g = new THREE.Group();
  const hex = (R, z, rot) => [0, 1, 2, 3, 4, 5].map(k => { const a = rot + k / 6 * TAU; return [Math.cos(a) * R, Math.sin(a) * R * 0.86, z]; });
  const F = [0, 0, 15], B = [0, 0, -13], A = hex(4.6, 7, Math.PI / 6), Bm = hex(7.4, -1.5, 0), Cm = hex(4.2, -8.5, Math.PI / 6);
  const pts = [F, B, ...A, ...Bm, ...Cm], iA = k => 2 + k, iB = k => 8 + k, iC = k => 14 + k, ed = [];
  for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6; ed.push([0, iA(k)], [iA(k), iA(k1)], [iA(k), iB(k)], [iA(k), iB(k1)], [iB(k), iB(k1)], [iB(k), iC(k)], [iB(k1), iC(k)], [iC(k), iC(k1)], [iC(k), 1]); }
  const fr = new THREE.Group();
  fr.add(mesh(frameGeo('lattice', pts, ed, 0.12), X.beam, false));
  fr.add(mesh(nodesGeo('latticeS', [F, B, ...A, ...Cm], 0.42), M.core, false));
  /* Hauptknoten am Äquator: kleine Kristalle mit Licht */
  for (const p of Bm) { const n = mesh(fragGeo(1), X.cryS); n.scale.setScalar(0.9); n.position.set(...p); fr.add(n); const s = new THREE.Sprite(X.halo); s.scale.setScalar(4); s.position.set(...p); fr.add(s); }
  g.add(spinning(fr, 'z', 0.12));
  /* schwebender Kern-Kristall in der Mitte */
  const cc = mesh(geo('octa', () => new THREE.OctahedronGeometry(1, 0)), X.cry); cc.scale.set(2.6, 3.2, 3.6);
  g.add(spinning(cc, 'y', 0.5));
  g.add(core(M, X, 1.2, 10, 0.12));
  for (const [ax, R, s] of [['y', 4.8, 0.7], ['x', 5.6, -0.5]]) { const r = ring(R, 0.12, M.trim, 32, 3); r.rotation[ax === 'y' ? 'x' : 'y'] = Math.PI / 2; g.add(spinning(r, ax, s)); }
  g.add(at(field(M, X, 2.6, 4), 0, 0, -13.5));
  return g;
});

/* ======================================================================== SPIRE – bewaffneter Netzknoten: Dreikant-Fachwerk mit Turmkristall */
register('spire', M => {
  const X = xm(M), g = new THREE.Group();
  /* Fachwerk: drei Holme, verjüngt nach vorn, Zickzack-Streben */
  const N = 6, z0 = -17, z1 = 17, pts = [], ed = [];
  for (let s = 0; s <= N; s++) { const t = s / N, z = z0 + (z1 - z0) * t, R = 7 - 5.2 * t; for (let k = 0; k < 3; k++) { const a = (90 + k * 120 + (s % 2) * 60) * DEG; pts.push([Math.cos(a) * R, Math.sin(a) * R, z]); } }
  for (let s = 0; s <= N; s++) for (let k = 0; k < 3; k++) { const i = s * 3 + k; ed.push([i, s * 3 + (k + 1) % 3]); if (s < N) { ed.push([i, (s + 1) * 3 + k]); ed.push([i, (s + 1) * 3 + (k + (s % 2 ? 1 : 2)) % 3]); } }
  g.add(mesh(frameGeo('spire', pts, ed, 0.13), X.beam, false));
  g.add(mesh(nodesGeo('spire', pts, 0.42), M.core, false));
  /* Stufenringe */
  for (let s = 1; s < N; s += 2) { const t = s / N, r = ring((7 - 5.2 * t) * 1.05, 0.24, M.trim, 3, 4); r.position.z = z0 + (z1 - z0) * t; r.rotation.z = Math.PI / 3; g.add(r); }
  /* Waffenkristall vorn, zwei Seitenstrahler */
  g.add(at(gem(12, 1.5, X.cry, { n: 3, sq: 1, tw: 0, tf: 0.5 }), 0, 0, 20));
  const em = core(M, X, 0.8, 7, 0.15, X.haloW); em.position.z = 26; g.add(em);
  for (const s of [-1, 1]) { const w = gem(10, 1.2, X.cryS, { n: 4, tf: 0.5, tw: 0 }); w.position.set(s * 5.4, -1.4, 2); g.add(w); g.add(beam(X, [s * 3.3, -1.6, 2], [s * 5.4, -1.4, 2], 0.14)); const c = core(M, X, 0.45, 3.5, 0.2); c.position.set(s * 5.4, -1.4, 7.4); g.add(c); }
  /* Turm: aufrechter Kristall auf dem Rücken, Knotenlicht an der Spitze, zwei Ringe */
  const tw = gem(10, 1.7, X.cry, { n: 3, sq: 1, tw: 0, tf: 0.42, tb: 0.3 }); tw.rotation.x = -Math.PI / 2; tw.position.set(0, 9.5, -5); g.add(tw);
  g.add(beam(X, [0, 4.2, -5], [0, 6, -5], 0.3));
  const tc = core(M, X, 0.9, 8, 0.15); tc.position.set(0, 16, -5); g.add(tc);
  for (const [y, R, s] of [[7.5, 3.4, 0.6], [11.5, 2.4, -0.8]]) { const r = ring(R, 0.16, X.beam, 6, 3); r.rotation.x = Math.PI / 2; const p = spinning(r, 'y', s); p.position.set(0, y, -5); g.add(p); }
  /* Basis: Kristalltrio + Kern */
  tri(g, () => { const p = gem(14, 2, X.cry, { n: 5, tf: 0.4 }); p.position.set(0, 3.4, -15); p.rotation.x = 0.25; return p; });
  const c = core(M, X, 1.8, 13); c.position.z = -13; g.add(c);
  g.add(at(field(M, X, 4.5, 7), 0, 0, -20));
  return g;
});

/* Hilfsfunktionen für die Stationen (stations/nexus.js) */
export { rim, xm, geo, gem, gemGeo, gemEdges, gemBands, facetCols, fragGeo, frameGeo, nodesGeo, beam, ring, spinning, core, orbiters, tri, field, navGem, hook, claw, tendril, TRI, HEX };
