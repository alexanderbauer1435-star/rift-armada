/* =====================================================================
   ERBAUER-WÄCHTER – uralte Maschinen der verschwundenen Erbauer, neutral. Formensprache: monolithisch, glatt gedrehte
   Formen wie geschliffener Stein (moosgrünes Grau), eingeschnittene Glyphenlinien, die mintgrün glühen, langsam
   kreisende Ringe mit Inschriften, ein einziges großes Auge. Kein Plattenmuster, keine Nieten – alles wirkt gewachsen,
   nicht gebaut. Bug +Z, oben +Y, Länge = data len.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { register, mesh, at, rng } from '../kit.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

/* ------------------------------------------------------------ Texturen */
/* Stein: helles Grüngrau, weiche Flecken (Moos, Patina), feines Korn, wenige lange Fugen */
function stoneCanvas(seed) {
  const r = rng(seed);
  return canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#b4bfb8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const cx = r() * w, cy = r() * h, rr = 20 + r() * 90, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr), c = r() < 0.45 ? '96,128,92' : r() < 0.6 ? '40,52,46' : '220,228,220'; g.addColorStop(0, `rgba(${c},${0.05 + r() * 0.1})`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
    const d = x.getImageData(0, 0, w, h), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
    x.strokeStyle = 'rgba(30,40,34,0.18)'; x.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const y = (i + 0.3 + r() * 0.4) * h / 5; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    for (let i = 0; i < 7; i++) { const xx = r() * w, y = Math.floor(r() * 5) * h / 5; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + h / 5); x.stroke(); }
  });
}
/* Glyphen (Leuchtkarte): Leiterbahnen mit rechtwinkligen Knicken, Inschriftbänder, Kreiszeichen. Schwarz = kein Leuchten */
function glyphCanvas(seed, density = 1) {
  const r = rng(seed), G = 16;
  return canvas(512, 512, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.lineCap = 'square';
    const col = a => `rgba(170,255,205,${a})`;
    /* Leiterbahnen */
    for (let i = 0; i < 26 * density; i++) {
      let px = Math.floor(r() * 32) * G, py = Math.floor(r() * 32) * G, dir = r() < 0.5 ? 0 : 1; x.strokeStyle = col(0.55 + r() * 0.45); x.lineWidth = r() < 0.3 ? 3 : 2; x.beginPath(); x.moveTo(px, py);
      for (let k = 0, n = 3 + r() * 8; k < n; k++) { const l = (1 + Math.floor(r() * 4)) * G * (r() < 0.5 ? -1 : 1); if (dir) py += l; else px += l; x.lineTo(px, py); if (r() < 0.6) dir = 1 - dir; }
      x.stroke(); x.fillStyle = col(1); x.beginPath(); x.arc(px, py, 3.5, 0, TAU); x.fill();
    }
    /* Inschriftbänder: zwei Linien mit Zeichen dazwischen */
    for (let b = 0; b < 3 * density; b++) {
      const y = Math.floor(r() * 30) * G + 8, x0 = Math.floor(r() * 10) * G, len = (8 + Math.floor(r() * 18)) * G; x.strokeStyle = col(0.8); x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y); x.moveTo(x0, y + 14); x.lineTo(x0 + len, y + 14); x.stroke();
      for (let cx = x0 + 6; cx < x0 + len - 6; cx += 10) { x.beginPath(); const t = r(); if (t < 0.3) { x.moveTo(cx, y + 3); x.lineTo(cx, y + 11); } else if (t < 0.55) { x.moveTo(cx - 3, y + 3); x.lineTo(cx + 3, y + 11); x.moveTo(cx + 3, y + 3); x.lineTo(cx - 3, y + 11); } else if (t < 0.8) { x.arc(cx, y + 7, 3, 0, TAU); } else { x.moveTo(cx - 3, y + 7); x.lineTo(cx + 3, y + 7); x.moveTo(cx, y + 3); x.lineTo(cx, y + 11); } x.stroke(); }
    }
    /* Kreiszeichen */
    for (let i = 0; i < 4 * density; i++) { const cx = r() * w, cy = r() * h, rr = 8 + r() * 16; x.strokeStyle = col(0.9); x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.stroke(); x.beginPath(); x.arc(cx, cy, rr * 0.45, r() * 3, r() * 3 + 4); x.stroke(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; x.beginPath(); x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); x.lineTo(cx + Math.cos(a) * (rr + 7), cy + Math.sin(a) * (rr + 7)); x.stroke(); } }
  });
}
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; }

/* ------------------------------------------------------------ Materialien */
const GC = new WeakMap();
function gm(M) {
  let G = GC.get(M); if (G) return G;
  const sc = stoneCanvas(71), gc = glyphCanvas(5), gc2 = glyphCanvas(23, 0.6);
  const C = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  /* Stein mit Glyphen; rep = Wiederholung der Texturen, glow = Leuchtkraft der Glyphen */
  const stone = (col, rep, glow, glyphs = gc) => new THREE.MeshStandardMaterial({ color: col, map: tex(sc, rep), bumpMap: tex(sc, rep, false), bumpScale: 0.35, roughness: 0.62, metalness: 0.28, emissive: '#ffffff', emissiveMap: glow ? tex(glyphs, rep) : null, emissiveIntensity: glow });
  const haloT = new THREE.CanvasTexture(canvas(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, a] of [[0, 1], [0.1, 0.8], [0.3, 0.25], [0.6, 0.06], [1, 0]]) g.addColorStop(o, `rgba(255,255,255,${a})`); x.fillStyle = g; x.fillRect(0, 0, w, w); }));
  G = {
    stone: stone('#c9d4cc', [2, 2], 1.25),
    stoneBig: stone('#c9d4cc', [3, 2], 1.15, gc2),
    stoneLite: stone('#c9d4cc', [1, 1], 1.35, gc2),
    stoneDark: stone('#7d8f86', [2, 2], 0.9, gc2),
    stoneRing: stone('#aebdb4', [10, 0.5], 1.4),
    stoneFlat: stone('#c9d4cc', [0.05, 0.05], 1.2),         /* für Extrusionen mit Welt-UV */
    plain: stone('#b9c6be', [1, 1], 0),
    deep: new THREE.MeshStandardMaterial({ color: '#16201c', metalness: 0.7, roughness: 0.35 }),
    lens: new THREE.MeshStandardMaterial({ color: '#08120f', metalness: 0.9, roughness: 0.06, emissive: '#1d6e4c', emissiveIntensity: 0.55 }),
    iris: new THREE.MeshBasicMaterial({ color: C('#9ff0c0', 2.6) }),
    irisSoft: new THREE.MeshBasicMaterial({ color: C('#7fe0a8', 1.3) }),
    line: new THREE.MeshBasicMaterial({ color: C('#9ff0c0', 1.8) }),
    halo: new THREE.SpriteMaterial(Object.assign({ map: haloT, color: C('#8ff0b8', 0.9) }, add)),
    field: new THREE.MeshBasicMaterial(Object.assign({ map: haloT, color: C('#7fe8b0', 0.9), side: THREE.DoubleSide }, add)),
    plume: (() => { const p = M.plume.clone(); p.color = C('#8ff0b8', 0.8); return p; })(),
    trim: M.trim
  };
  GC.set(M, G); return G;
}

/* ------------------------------------------------------------ Bauteile */
/* Drehkörper entlang Z aus Profil [[r, z], …] (von hinten nach vorn), sy = Höhenstauchung */
function lathe(prof, mat, seg = 40, sy = 1, sx = 1) {
  const key = 'lathe|' + prof.flat().join(',') + '|' + seg;
  const g = geo(key, () => new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.001), z)), seg).rotateX(Math.PI / 2));
  const m = mesh(g, mat); m.scale.set(sx, sy, 1); return m;
}
/* Ringband um die Z-Achse: Radius R, Breite w (entlang Z), Dicke t; flache Innen- und Außenseiten */
function band(R, w, t, mat, seg = 64) {
  seg = Math.min(seg, 72);
  return mesh(geo(`band|${R}|${w}|${t}|${seg}`, () => new THREE.LatheGeometry([new THREE.Vector2(R - t, -w / 2), new THREE.Vector2(R + t * 0.6, -w / 2), new THREE.Vector2(R + t, -w * 0.3), new THREE.Vector2(R + t, w * 0.3), new THREE.Vector2(R + t * 0.6, w / 2), new THREE.Vector2(R - t, w / 2), new THREE.Vector2(R - t, -w / 2)], seg).rotateX(Math.PI / 2)), mat);
}
/* glühende Linie (Fuge) als dünner Ring */
function lineRing(G, R, t = 0.12, seg = 64) { seg = Math.min(seg, 64); return mesh(geo(`lr|${R}|${t}|${seg}`, () => new THREE.TorusGeometry(R, t, 3, seg)), G.line, false); }
/* gerundeter Block zwischen zwei Punkten (Glieder, Streben) */
function limb(G, a, b, w, h, mat = G.stone) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  const m = mesh(geo('limb', () => new THREE.CapsuleGeometry(0.5, 3, 3, 10)), mat);
  m.scale.set(w, l / 4, h); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m;
}
function halo(G, s) { const h = new THREE.Sprite(G.halo); h.scale.setScalar(s); return h; }
/* Das Auge: dunkle Linse in einer Steinfassung, leuchtende Iris aus Ringen, Lichthof. lid = Lid zur Hälfte geschlossen (schlafend) */
function eye(G, r, o = {}) {
  const g = new THREE.Group();
  g.add(at(band(r * 1.06, r * 0.4, r * 0.1, G.stoneDark, 40), 0, 0, r * 0.3));
  g.add(at(mesh(geo('eyeball', () => new THREE.SphereGeometry(1, 24, 14)), G.lens), 0, 0, 0)); g.children[1].scale.setScalar(r);
  /* Iris: heller Ring + Pupille (eine Geometrie), äußerer Ring + acht Speichen (eine Geometrie) */
  const iris = new THREE.Group(); iris.position.z = r * 0.86;
  iris.add(mesh(geo('irisA', () => mergeGeometries([new THREE.TorusGeometry(0.5, 0.07, 6, 40), new THREE.SphereGeometry(1, 16, 10).scale(0.22, 0.22, 0.1).translate(0, 0, 0.1)])), G.iris, false));
  iris.add(mesh(geo('irisB', () => mergeGeometries([new THREE.TorusGeometry(0.78, 0.035, 4, 40).translate(0, 0, -0.2), ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => { const a = k / 8 * TAU; return new THREE.BoxGeometry(0.035, 0.18, 0.02).rotateZ(a - Math.PI / 2).translate(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.04); })])), G.irisSoft, false));
  iris.children[0].scale.setScalar(r); iris.children[1].scale.setScalar(r);
  iris.userData.pulse = { amp: o.lid ? 0.04 : 0.06, speed: o.lid ? 0.7 : 1.6 };
  g.add(iris);
  const hl = halo(G, r * (o.lid ? 3.2 : 4.5)); hl.position.z = r * 1.05; g.add(hl);
  if (o.lid) {
    /* Lider: obere und untere Schale, halb geschlossen – die Maschine schläft */
    const lidG = geo('lid', () => new THREE.SphereGeometry(1, 24, 8, 0, TAU, 0, Math.PI * 0.5));
    const up = mesh(lidG, G.stone); up.scale.setScalar(r * 1.07); up.rotation.x = -0.12; g.add(up);
    const lo = mesh(lidG, G.stone); lo.scale.setScalar(r * 1.07); lo.rotation.x = Math.PI + 0.5; g.add(lo);
  }
  return g;
}
/* weiches Antriebsfeld am Heck (Mint) */
function field(G, r, len) {
  const g = new THREE.Group();
  const d = mesh(geo('gdisc', () => new THREE.CircleGeometry(1, 32)), G.field, false); d.scale.setScalar(r); g.add(d);
  const pw = new THREE.Group(); pw.scale.set(r * 0.6, r * 0.6, len);
  const pl = new THREE.Mesh(geo('gplume', () => { const c = new THREE.CylinderGeometry(1, 0.15, 1, 16, 1, true); c.translate(0, -0.5, 0); c.rotateX(Math.PI / 2); return c; }), G.plume); pl.userData.flame = true; pl.renderOrder = 2; pw.add(pl); g.add(pw);
  return g;
}
/* Lanze der Erbauer: schlanker, dunkler Schaft mit Glutader, schwebende Glyphenringe (frei, ohne Berührung), Speerspitze */
function lance(G, len, r) {
  const g = new THREE.Group();
  const bar = mesh(geo(`lbar|${len}|${r}`, () => new THREE.CylinderGeometry(r * 0.45, r, len, 12).rotateX(Math.PI / 2)), G.deep); bar.position.z = len / 2; g.add(bar);
  const core = mesh(geo(`lcore|${len}|${r}`, () => new THREE.CylinderGeometry(r * 0.18, r * 0.3, len * 1.02, 6).rotateX(Math.PI / 2)), G.iris, false); core.position.set(0, r * 0.62, len / 2); g.add(core);
  const n = Math.max(3, Math.round(len / (r * 6)));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), z = len * (0.15 + 0.7 * t), R = r * (2.1 - 0.6 * t);
    const rr = new THREE.Group(); rr.position.z = z; rr.userData.spin = { axis: 'z', speed: (i % 2 ? -1 : 1) * 0.8 };
    rr.add(band(R, r * 0.55, r * 0.22, G.stoneRing, 32)); rr.add(at(lineRing(G, R - r * 0.24, r * 0.08, 32), 0, 0, 0)); g.add(rr);
  }
  const tip = mesh(geo(`ltip|${r}`, () => new THREE.OctahedronGeometry(1, 0)), G.iris, false); tip.scale.set(r * 0.9, r * 0.9, r * 3.2); tip.position.z = len + r * 1.6; tip.userData.pulse = { amp: 0.08, speed: 3, base: 1 }; g.add(tip);
  g.add(at(halo(G, r * 9), 0, 0, len + r * 1.5));
  return g;
}
/* Schalenplatte: flache Kuppel (Panzer), Glutfuge am Rand */
function shell(G, sx, sy, sz, mat = G.stone) {
  const g = new THREE.Group();
  const c = mesh(geo('shell', () => new THREE.SphereGeometry(1, 28, 8, 0, TAU, 0, Math.PI * 0.42)), mat); c.scale.set(sx, sy, sz); g.add(c);
  const e = mesh(geo('shellEdge', () => new THREE.TorusGeometry(1, 0.012, 4, 48).rotateX(Math.PI / 2)), G.line, false); const k = Math.sin(Math.PI * 0.42), h = Math.cos(Math.PI * 0.42); e.scale.set(sx * k * 1.005, 1, sz * k * 1.005); e.position.y = sy * h; g.add(e);
  return g;
}

/* ======================================================================== WÄCHTERDROHNE */
register('drone', M => {
  const G = gm(M), g = new THREE.Group();
  /* Körper: glatter, flacher Tropfen, vorn eine Haube um das große Auge */
  g.add(lathe([[0, -13], [0.8, -11.5], [1.9, -8], [3.2, -4], [4.6, 0], [5.3, 3], [5.2, 5.2], [4.7, 6.6]], G.stoneLite, 44, 0.8, 1.05));
  const wl = lineRing(G, 4.65, 0.1, 48); wl.scale.set(1.05, 0.8, 1); g.add(wl);
  g.add(at(eye(G, 4.1), 0, 0.1, 6.4));
  /* Haube: Steinschale über dem Auge wie eine Braue */
  const hood = mesh(geo('dHood', () => new THREE.SphereGeometry(1, 32, 10, 0, TAU, 0, Math.PI * 0.36)), G.stoneDark); hood.scale.set(5.8, 5.2, 5.8); hood.rotation.x = 0.55; hood.position.set(0, -0.2, 5.2); g.add(hood);
  /* Hörnerfinnen: zwei geschwungene Klingen, schräg nach oben-hinten */
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const sh = mesh(geo('dEar', () => { const p = new THREE.Shape([new THREE.Vector2(0, -3), new THREE.Vector2(1.2, 4.5), new THREE.Vector2(0.4, 10), new THREE.Vector2(-0.6, 6.5), new THREE.Vector2(-0.8, -2)]); const x = new THREE.ExtrudeGeometry(p, { depth: 0.9, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.35, bevelSegments: 3 }); x.translate(0, 0, -0.45); return x; }), G.stoneFlat);
    sh.rotation.set(-Math.PI / 2 + 0.3, 0, 0); e.add(sh);
    const ln = mesh(geo('dEarLine', () => new THREE.BoxGeometry(0.16, 0.16, 10)), G.line, false); ln.position.set(0.15, 0.65, -3.4); e.add(ln);
    e.position.set(s * 3.8, 1.8, 1.5); e.rotation.set(0, -s * 0.1, s * 0.85); g.add(e);
  }
  /* Glyphenring als Heiligenschein, gekippt und kreisend */
  const rp = new THREE.Group(); rp.rotation.x = 0.38; rp.position.z = 0.5; const rs = new THREE.Group(); rs.userData.spin = { axis: 'z', speed: 0.45 }; rs.add(band(7.6, 1.2, 0.45, G.stoneRing, 64)); rs.add(lineRing(G, 8.1, 0.09, 64));
  for (let k = 0; k < 3; k++) { const n = mesh(geo('dRingN', () => new THREE.OctahedronGeometry(0.55, 0)), G.iris, false); const a = k / 3 * TAU; n.position.set(Math.cos(a) * 8.4, Math.sin(a) * 8.4, 0); rs.add(n); }
  rp.add(rs); g.add(rp);
  /* Schwanzdorn mit Glutspitze */
  g.add(at(mesh(geo('dTail', () => new THREE.ConeGeometry(1.0, 5, 16).rotateX(-Math.PI / 2)), G.stoneDark), 0, 0, -14.5));
  const tt = mesh(geo('dTip', () => new THREE.OctahedronGeometry(0.6, 0)), G.iris, false); tt.position.z = -17.2; tt.userData.blink = 0.6; g.add(tt);
  /* Zwillingsläufe unter dem Auge */
  for (const s of [-1, 1]) { const b = mesh(geo('dGun', () => new THREE.CylinderGeometry(0.35, 0.45, 5, 10).rotateX(Math.PI / 2)), G.deep); b.position.set(s * 2.2, -3.9, 5.2); g.add(b); const m = mesh(geo('dMz', () => new THREE.SphereGeometry(0.32, 10, 8)), G.iris, false); m.position.set(s * 2.2, -3.9, 7.8); g.add(m); }
  g.add(at(mesh(geo('dChin', () => new THREE.CapsuleGeometry(1.1, 4.2, 4, 12).rotateZ(Math.PI / 2)), G.stoneDark), 0, -3.7, 3.2));
  /* schwebender Kielstein darunter */
  const keel = mesh(geo('dKeel', () => new THREE.OctahedronGeometry(1, 1)), G.stoneDark); keel.scale.set(1.1, 1.6, 3); keel.position.set(0, -6.8, -2); keel.userData.bob = { amp: 0.4, speed: 1.1, y0: -6.8 }; g.add(keel);
  const kl = halo(G, 3); kl.position.set(0, -5.2, -2); g.add(kl);
  g.add(at(field(G, 2.2, 4), 0, 0, -12));
  return g;
});

/* ======================================================================== ERBAUER-SENTINEL – Lanzenschiff mit Sprungring */
register('sentinel', M => {
  const G = gm(M), g = new THREE.Group();
  /* Rumpf: flacher, glatter Spindelkörper */
  g.add(lathe([[0, -33], [2.4, -31], [5.4, -25], [8.2, -15], [9.2, -4], [8.8, 6], [7.2, 14], [5.2, 20], [3.2, 24], [0, 26]], G.stoneBig, 48, 0.58));
  for (const z of [-14, 4]) { const l = lineRing(G, z < 0 ? 8.35 : 9.0, 0.12, 64); l.scale.set(1, 0.58, 1); l.position.z = z; g.add(l); }
  /* Rückenkamm mit Auge auf dem Kopf */
  g.add(at(lathe([[0, -20], [1.6, -18], [2.6, -8], [2.8, 4], [2.2, 10], [0.6, 13]], G.stone, 24, 1.3, 0.8), 0, 4.2, 0));
  g.add(at(eye(G, 2.8), 0, 4.4, 15.2));
  g.add(at(mesh(geo('sBrow', () => new THREE.CapsuleGeometry(1.1, 6, 4, 12).rotateZ(Math.PI / 2)), G.stoneDark), 0, 7, 14.2));
  /* Rückensegel: sichelförmige Steinklinge hinter dem Auge, Leuchtkante */
  const sail = mesh(geo('sSail', () => { const p = new THREE.Shape([new THREE.Vector2(10, 0), new THREE.Vector2(4, 5), new THREE.Vector2(-6, 9.5), new THREE.Vector2(-16, 10.5), new THREE.Vector2(-10, 6), new THREE.Vector2(-4, 2.5), new THREE.Vector2(-8, 0)]); const x = new THREE.ExtrudeGeometry(p, { depth: 0.6, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.3, bevelSegments: 3 }); x.rotateY(-Math.PI / 2); x.translate(0.3, 0, 0); return x; }), G.stoneFlat);
  sail.position.set(0, 6.4, 0); g.add(sail);
  for (const [a, b] of [[[0, 6.4, 10], [0, 11.4, 4]], [[0, 11.4, 4], [0, 15.9, -6]], [[0, 15.9, -6], [0, 16.9, -16]]]) g.add(limbLine(G, a, b, 0.2));
  /* Lanze durch den Bug */
  g.add(at(lance(G, 24, 1.3), 0, -0.6, 19));
  /* Schwingen: gekrümmte Klingen, Leuchtkante */
  for (const s of [-1, 1]) {
    const wgp = new THREE.Group();
    const wg = mesh(geo('sWing', () => { const p = new THREE.Shape([new THREE.Vector2(0, 8), new THREE.Vector2(9, -4), new THREE.Vector2(17, -18), new THREE.Vector2(19, -27), new THREE.Vector2(13, -21), new THREE.Vector2(5, -14), new THREE.Vector2(0, -12)]); const x = new THREE.ExtrudeGeometry(p, { depth: 0.8, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.45, bevelSegments: 3, curveSegments: 4 }); x.rotateX(Math.PI / 2); x.translate(0, 0.4, 0); return x; }), G.stoneFlat);
    wgp.add(wg);
    const le = [[0, 0.5, 8], [9, 0.5, -4], [17, 0.5, -18], [19, 0.5, -27]];
    for (let i = 0; i < 3; i++) wgp.add(limbLine(G, le[i], le[i + 1], 0.22));
    const tipE = mesh(geo('sTipE', () => new THREE.SphereGeometry(0.9, 14, 10)), G.iris, false); tipE.position.set(19, 0.5, -27); tipE.userData.pulse = { amp: 0.15, speed: 2.4 }; wgp.add(tipE); wgp.add(at(halo(G, 6), 19, 0.5, -27));
    wgp.position.set(s * 6.5, -0.6, 2); wgp.scale.x = s; wgp.rotation.z = s * 0.1; g.add(wgp);
  }
  /* Sprungring am Heck: dreht sich, Feld in der Mitte, zwei Streben */
  const jr = new THREE.Group(); jr.position.z = -27;
  const js = new THREE.Group(); js.userData.spin = { axis: 'z', speed: 0.3 }; js.add(band(13.5, 2.4, 0.9, G.stoneRing, 72)); js.add(at(lineRing(G, 12.55, 0.14, 72), 0, 0, 0.9)); js.add(at(lineRing(G, 12.55, 0.14, 72), 0, 0, -0.9));
  for (let k = 0; k < 6; k++) { const n = mesh(geo('sNode', () => new THREE.OctahedronGeometry(0.9, 0)), G.iris, false); const a = k / 6 * TAU; n.position.set(Math.cos(a) * 14.6, Math.sin(a) * 14.6, 0); js.add(n); }
  jr.add(js);
  const jf = mesh(geo('gdisc', () => new THREE.CircleGeometry(1, 32)), G.field, false); jf.scale.setScalar(12.4); jf.material = G.field; jr.add(jf);
  for (const s of [-1, 1]) jr.add(limb(G, [s * 4, 0, 3], [s * 12.6, 0, 0], 1.6, 1.2, G.stoneDark));
  g.add(jr);
  g.add(at(field(G, 4, 8), 0, 0, -32));
  /* Punktabwehr: zwei kleine Augenkuppeln an den Flanken */
  for (const s of [-1, 1]) { const d = mesh(geo('sPd', () => new THREE.SphereGeometry(1.3, 16, 10, 0, TAU, 0, Math.PI / 2)), G.stoneDark); d.position.set(s * 7.4, 2.4, -6); g.add(d); const l = mesh(geo('sPdE', () => new THREE.SphereGeometry(0.45, 10, 8)), G.iris, false); l.position.set(s * 7.4, 3.3, -5.2); g.add(l); }
  return g;
});
/* Leuchtlinie als dünner Stab zwischen zwei Punkten */
function limbLine(G, a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
  const m = mesh(geo('gline', () => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)), G.line, false); m.scale.set(r, l, r); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); return m;
}

/* ======================================================================== DER WÄCHTER – schlafende Riesenmaschine */
register('warden', M => {
  const G = gm(M), g = new THREE.Group();
  /* Leib: breiter, geduckter Keil – Schultern vorn, verjüngt zum Schwanz */
  g.add(lathe([[0, -62], [3.5, -60], [8.5, -54], [13.5, -43], [18, -27], [21.5, -9], [23.5, 7], [23.6, 19], [21, 29], [16.5, 36]], G.stoneBig, 56, 0.56, 1.25));
  for (const [z, R] of [[-27, 18.05], [7, 23.55]]) { const l = lineRing(G, R, 0.16, 72); l.scale.set(1.25, 0.56, 1); l.position.z = z; g.add(l); }
  /* Rückenpanzer: vier überlappende Schalen, nach hinten kleiner */
  [[20, 19, 6.5, 14, 9.8], [3, 20, 7, 14, 10.4], [-15, 18, 6.2, 13, 8.8], [-32, 14, 5, 11.5, 6.4]].forEach(([z, sx, sy, sz, y]) => { const sh = shell(G, sx, sy, sz); sh.position.set(0, y, z); sh.rotation.x = -0.08; g.add(sh); });
  /* Schulterkuppeln */
  for (const s of [-1, 1]) { const sh = shell(G, 11, 8, 12, G.stoneDark); sh.position.set(s * 25, 4, 22); sh.rotation.z = -s * 0.8; g.add(sh); const sp = mesh(geo('wSpike', () => new THREE.ConeGeometry(2.2, 12, 8).rotateX(-Math.PI / 2)), G.stone); sp.position.set(s * 31, 9, 14); sp.rotation.set(-0.35, -s * 0.5, 0); g.add(sp); }
  /* Hals und Kopf, tief zwischen den Schultern, mit halb geschlossenem Auge und Helmkamm */
  const neck = band(15, 4.5, 1.8, G.stoneRing, 56); neck.scale.set(1.1, 0.7, 1); neck.position.set(0, 0, 38); g.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.5, 46); head.scale.setScalar(1.22);
  head.add(lathe([[0, -8], [10, -7], [12.5, -3], [12.6, 2], [11.2, 6], [8.6, 8.5]], G.stone, 48, 0.8));
  head.add(at(eye(G, 7.4, { lid: true }), 0, 0, 7.5));
  head.add(at(mesh(geo('wBrow', () => new THREE.CapsuleGeometry(2, 14, 4, 16).rotateZ(Math.PI / 2)), G.stoneDark), 0, 8.2, 5));
  const crest = mesh(geo('wCrest', () => { const p = new THREE.Shape([new THREE.Vector2(6, 0), new THREE.Vector2(2, 5), new THREE.Vector2(-8, 9), new THREE.Vector2(-22, 10), new THREE.Vector2(-12, 5.5), new THREE.Vector2(-6, 0)]); const x = new THREE.ExtrudeGeometry(p, { depth: 1.6, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.5, bevelSegments: 3 }); x.rotateY(-Math.PI / 2); x.translate(0.8, 0, 0); return x; }), G.stoneFlat);
  crest.position.set(0, 7.5, 0); head.add(crest);
  head.add(limbLine(G, [0, 7.5 + 5.1, 2], [0, 7.5 + 9.1, -8], 0.22)); head.add(limbLine(G, [0, 7.5 + 9.1, -8], [0, 7.5 + 10.1, -22], 0.22));
  for (const s of [-1, 1]) head.add(limb(G, [s * 7.5, -5.5, -1], [s * 4.8, -8, 10], 3.4, 2.6, G.stoneDark));
  g.add(head);
  /* Lanze unter dem Kopf, eingezogen */
  g.add(at(lance(G, 26, 2.2), 0, -13.5, 36));
  /* drei Rückenaugen (Strahler) in den Fugen der Schalen */
  for (const [x, y, z] of [[-11, 13, -6], [11, 13, -6], [0, 17.5, 12]]) { const e = eye(G, 2.1); e.position.set(x, y, z); e.rotation.x = -0.6; g.add(e); }
  /* gefaltete Arme: Oberarm nach hinten, Unterarm nach vorn bis unter den Kopf, Klauen */
  for (const s of [-1, 1]) {
    const sh = [s * 27, -1, 22], el = [s * 35, -6, -6], wr = [s * 21, -11, 44];
    g.add(limb(G, sh, el, 6, 5)); g.add(at(mesh(geo('wElbow', () => new THREE.SphereGeometry(4, 16, 10)), G.stoneDark), ...el));
    g.add(limb(G, el, wr, 5, 4.4)); g.add(limbLine(G, [el[0] + s * 2.4, el[1] + 0.5, el[2]], [wr[0] + s * 2.2, wr[1] + 0.5, wr[2]], 0.22));
    g.add(at(mesh(geo('wHand', () => new THREE.SphereGeometry(3.4, 16, 10)), G.stoneDark), ...wr));
    for (let k = -1; k <= 1; k++) g.add(limb(G, wr, [wr[0] - s * (2 + k * 2.6), wr[1] - 2.5 + Math.abs(k) * 1.5, wr[2] + 9 - Math.abs(k) * 2], 1.6, 1.3, G.stone));
  }
  /* zwei schwere Ringe, gekippt, langsam kreisend – wie Fesseln um den Schläfer */
  [[42, 6, 5, 2, 0.28, 0.05], [33, -30, 4, 1.6, -0.22, -0.04]].forEach(([R, z, w, t, tilt, sp]) => {
    const p = new THREE.Group(); p.position.z = z; p.rotation.x = tilt; const s = new THREE.Group(); s.userData.spin = { axis: 'z', speed: sp };
    s.add(band(R, w, t, G.stoneRing, 96)); s.add(lineRing(G, R + t + 0.05, 0.16, 96)); s.add(lineRing(G, R - t - 0.05, 0.12, 96));
    for (let k = 0; k < 4; k++) { const n = mesh(geo('wRingNode', () => new THREE.BoxGeometry(3, 3, 3)), G.stoneDark); const a = k / 4 * TAU + 0.4; n.position.set(Math.cos(a) * (R + t), Math.sin(a) * (R + t), 0); n.rotation.z = a + Math.PI / 4; s.add(n); const e = mesh(geo('wRingE', () => new THREE.OctahedronGeometry(0.9, 0)), G.iris, false); e.position.set(Math.cos(a) * (R + t + 2), Math.sin(a) * (R + t + 2), 0); s.add(e); }
    p.add(s); g.add(p);
  });
  /* Herz am Heck: Öffnung mit glühendem Kern */
  g.add(at(band(7.5, 3, 1.4, G.stoneRing, 48), 0, 0, -60));
  const hc = mesh(geo('wHeart', () => new THREE.IcosahedronGeometry(3.6, 1)), G.iris, false); hc.position.z = -60; hc.userData.pulse = { amp: 0.06, speed: 0.8 }; g.add(hc);
  g.add(at(halo(G, 24), 0, 0, -61));
  g.add(at(field(G, 6.5, 9), 0, 0, -62));
  /* Punktabwehr: zwei Kuppeln auf den Schultern */
  for (const s of [-1, 1]) { const d = mesh(geo('wPd', () => new THREE.SphereGeometry(2.2, 16, 10, 0, TAU, 0, Math.PI / 2)), G.stoneDark); d.position.set(s * 17, 12.4, 30); g.add(d); const l = mesh(geo('wPdE', () => new THREE.SphereGeometry(0.8, 10, 8)), G.iris, false); l.position.set(s * 17, 14.2, 31); g.add(l); }
  return g;
});
export { gm, band, lineRing, lance, eye, halo, limb, limbLine, shell, lathe as glathe, geo };
