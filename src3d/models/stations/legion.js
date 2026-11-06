/* =====================================================================
   GOLDEN LEGION – Stationen. Formensprache: wiederhergestellte Erbauer-Festungen als Kathedralen im All, wie die
   Schiffe der Legion: Elfenbeinmauern, schwere Goldgesimse, Spitzhelm-Türme mit Fialen, Strebepfeiler und
   Strebebögen, Spitzbogen- und Rosenfenster aus leuchtendem Buntglas, Heiligenscheine, Banner und Lichtlanzen.
   Jedes Gebäude steht auf einer goldgefassten Plattform – achteckig (Thronhalle, Werft, Schrein, Sunbreaker), sonst
   mit eigenem Umriss je Rolle (Sechseck, Raute, Dreieck, Fünfeck, gestrecktes Sechseck, kleine runde Nabe) – (dunkelvioletter Boden mit Goldintarsien und
   Erbauer-Runen, Zierfialen an den Ecken, darunter ein umgekehrter Kronenkiel mit Erbauer-Kristall). Ein Lichtband
   in der Spielerfarbe (M.trim) läuft innen am Plattformrand um, dazu Wappen und Bannerränder in Spielerfarbe.
   Mitte im Ursprung, oben +Y, Grundfläche im Kreis d.r. Jedes Gebäude wird je Materialsatz und Stufe einmal gebaut,
   statische Teile je Material zusammengefasst (bake) und danach nur noch geklont.
   ===================================================================== */
import * as THREE from 'three';
import { registerB, mesh, at, hull, loft, tube, navLight, uvScale } from '../kit.js';
import { G, xm, archPts, v2, scaleUV, glassRow, row, rose, pinnacle, spire, buttress, pier, lance, halo, banner, crest, censer, pd, glowSprite, crane, cherubModel, bake, urnGeo } from '../factions/legion.js';

const PI = Math.PI, TAU = PI * 2;

/* ------------------------------------------------------------ Zusatzmaterialien der Stationen (je Materialsatz) */
const XB = new WeakMap();
function cvs(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
/* Bodenintarsie der Plattform: 1 Bildbreite = 2 · Plattformradius, Bildmitte = Gebäudemitte, Bild nach unten = +Z.
   lines = true zeichnet nur die leuchtenden Goldlinien (für das Leuchten) */
function floorCanvas(lines, n = 8) {
  return cvs(1024, 1024, (x, w) => {
    const c = w / 2, oct = (rr, rot = 0) => { x.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU + rot; x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } };
    if (!lines) {
      const g = x.createRadialGradient(c * 0.8, c * 0.8, 0, c, c, c); g.addColorStop(0, '#5e3a78'); g.addColorStop(1, '#2b1846'); x.fillStyle = g; x.fillRect(0, 0, w, w);
      /* Steinplatten: konzentrische Achtecke und Speichen */
      x.strokeStyle = 'rgba(14,9,26,0.85)'; x.lineWidth = 2;
      for (let k = 1; k < 16; k++) { oct(c * k / 16); x.stroke(); }
      for (let i = 0; i < 32; i++) { const a = i / 32 * TAU + PI / 32; x.beginPath(); x.moveTo(c + Math.cos(a) * c * 0.12, c + Math.sin(a) * c * 0.12); x.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); x.stroke(); }
      /* leichte Fleckung */
      let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,70,140' : '10,6,20'},${0.08 + r() * 0.1})`; const px = r() * w, py = r() * w, pr = 6 + r() * 26; x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill(); }
    } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, w); }
    const gold = lines ? '#ffd88a' : '#d9aa3c';
    x.strokeStyle = gold; x.fillStyle = gold;
    /* Goldfassungen */
    x.lineWidth = 5; oct(c * 0.9); x.stroke(); x.lineWidth = 2.5; oct(c * 0.865); x.stroke();
    x.lineWidth = 4; oct(c * 0.7); x.stroke(); x.lineWidth = 2; oct(c * 0.675); x.stroke();
    x.lineWidth = 3; for (let i = 0; i < n; i++) { const a = i / n * TAU; x.beginPath(); x.moveTo(c + Math.cos(a) * c * 0.7, c + Math.sin(a) * c * 0.7); x.lineTo(c + Math.cos(a) * c * 0.865, c + Math.sin(a) * c * 0.865); x.stroke(); }
    /* Runenring zwischen den Fassungen: kleine Zeichen aus Strichen und Rauten */
    let s2 = 31; const q = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
    x.lineWidth = 2.2;
    for (let i = 0; i < 96; i++) {
      const a = (i + 0.5) / 96 * TAU, rr = c * 0.782; if (i % 12 === 5 || i % 12 === 6) continue;
      x.save(); x.translate(c + Math.cos(a) * rr, c + Math.sin(a) * rr); x.rotate(a + PI / 2);
      const k = q() * 4 | 0;
      x.beginPath();
      if (k === 0) { x.moveTo(0, -11); x.lineTo(0, 11); x.moveTo(-6, -4); x.lineTo(6, -4); }
      else if (k === 1) { x.moveTo(0, -11); x.lineTo(6, 0); x.lineTo(0, 11); x.lineTo(-6, 0); x.closePath(); }
      else if (k === 2) { x.moveTo(-6, -10); x.lineTo(-6, 10); x.lineTo(6, 10); x.moveTo(0, -10); x.lineTo(0, 4); }
      else { x.arc(0, 0, 7, PI * 0.2, PI * 1.8); x.moveTo(0, -11); x.lineTo(0, 11); }
      x.stroke(); x.restore();
    }
    /* Sonnenzeichen an den acht Speichen */
    for (let i = 0; i < n; i++) { const a = i / n * TAU + PI / n, px = c + Math.cos(a) * c * 0.782, py = c + Math.sin(a) * c * 0.782; x.beginPath(); x.arc(px, py, 9, 0, TAU); x.fill(); for (let k = 0; k < 8; k++) { const b = k / 8 * TAU; x.beginPath(); x.moveTo(px + Math.cos(b) * 12, py + Math.sin(b) * 12); x.lineTo(px + Math.cos(b) * 19, py + Math.sin(b) * 19); x.stroke(); } }
    /* innerer Stern (meist vom Gebäude verdeckt) */
    x.lineWidth = 3; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(a) * c * (i % 2 ? 0.3 : 0.5), c + Math.sin(a) * c * (i % 2 ? 0.3 : 0.5)); x.stroke(); }
  });
}
/* Banner in Spielerfarbe: Karmesinfeld, Rand und Sonnenzeichen in Spielerfarbe (bei Gold wie die Schiffsbanner) */
function bannerCanvas(team) {
  return cvs(128, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5a0a14'); g.addColorStop(0.5, '#8e1424'); g.addColorStop(1, '#5a0a14');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, h); x.lineTo(w / 2, h * 0.8); x.lineTo(0, h); x.closePath(); x.fill();
    x.strokeStyle = team; x.lineWidth = 9; x.beginPath(); x.moveTo(6, 5); x.lineTo(w - 6, 5); x.lineTo(w - 6, h - 13); x.lineTo(w / 2, h * 0.8 - 7); x.lineTo(6, h - 13); x.closePath(); x.stroke();
    x.fillStyle = team; x.fillRect(0, 0, w, 22);
    x.beginPath(); x.arc(w / 2, 96, 17, 0, TAU); x.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 19, 96 + Math.sin(a) * 19); x.lineTo(w / 2 + Math.cos(a + 0.12) * 32, 96 + Math.sin(a + 0.12) * 32); x.lineTo(w / 2 + Math.cos(a + 0.25) * 19, 96 + Math.sin(a + 0.25) * 19); x.fill(); }
    x.fillRect(w / 2 - 3, 128, 6, 54); x.fillRect(w / 2 - 15, 142, 30, 6);
  });
}
/* Dachschindeln (Schuppen) in dunklem Goldbronze */
function roofCanvas() {
  return cvs(256, 256, (x, w) => {
    x.fillStyle = '#3a2814'; x.fillRect(0, 0, w, w);
    const n = 8, sw = w / n; let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const cx = i * sw + (j % 2 ? sw / 2 : 0), cy = j * sw, v = 0.75 + r() * 0.35;
      const g = x.createLinearGradient(0, cy - sw * 0.2, 0, cy + sw); g.addColorStop(0, `rgb(${170 * v | 0},${128 * v | 0},${66 * v | 0})`); g.addColorStop(1, `rgb(${92 * v | 0},${64 * v | 0},${30 * v | 0})`);
      x.fillStyle = g; x.beginPath(); x.moveTo(cx - sw / 2, cy); x.lineTo(cx - sw / 2, cy + sw * 0.45); x.arc(cx, cy + sw * 0.45, sw / 2, PI, 0, true); x.lineTo(cx + sw / 2, cy); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(30,18,6,0.9)'; x.lineWidth = 2; x.stroke();
    }
  });
}
/* Buntglas der Kuppel: 16 Bahnen mit Lanzettfenstern (Mosaik, vorwiegend Gold und Bernstein, Akzente Violett,
   Karmesin, Blau), darüber Rundfenster, oben Strahlen; u läuft um die Kuppel, v nach oben */
function domeCanvas() {
  return cvs(1024, 512, (x, w, h) => {
    x.fillStyle = '#0d0805'; x.fillRect(0, 0, w, h);
    const cols = ['#ffcf6a', '#ffb347', '#ffe2a0', '#ffcf6a', '#c9a0ff', '#8a5bd6', '#ff6a5a', '#6ab0ff', '#ffb347'];
    let s = 13; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cw = w / 16;
    for (let c = 0; c < 16; c++) {
      const x0 = c * cw, xm = x0 + cw / 2, lw = cw * 0.62, top = h * 0.36, bot = h * 0.97;
      x.save(); x.beginPath(); x.moveTo(xm - lw / 2, bot); x.lineTo(xm - lw / 2, top + lw * 0.6); x.quadraticCurveTo(xm - lw / 2, top, xm, top - lw * 0.25); x.quadraticCurveTo(xm + lw / 2, top, xm + lw / 2, top + lw * 0.6); x.lineTo(xm + lw / 2, bot); x.closePath(); x.clip();
      for (let yy = top - lw; yy < bot; yy += 9) for (let xx = xm - lw / 2; xx < xm + lw / 2; xx += 9) { x.fillStyle = cols[r() * cols.length | 0]; x.globalAlpha = 0.55 + r() * 0.45; x.fillRect(xx + 1, yy + 1, 7.5, 7.5); }
      x.restore(); x.globalAlpha = 1;
      x.strokeStyle = '#0d0805'; x.lineWidth = 4; x.beginPath(); x.moveTo(xm, bot); x.lineTo(xm, top + 10); x.stroke();
      for (const yy of [0.55, 0.75]) { x.beginPath(); x.moveTo(xm - lw / 2, h * yy); x.lineTo(xm + lw / 2, h * yy); x.stroke(); }
      /* Rundfenster */
      const ry = h * 0.2, rr = cw * 0.3;
      x.fillStyle = c % 2 ? '#c9a0ff' : '#ff6a5a'; x.beginPath(); x.arc(xm, ry, rr, 0, TAU); x.fill();
      x.fillStyle = '#ffcf6a'; x.beginPath(); x.arc(xm, ry, rr * 0.45, 0, TAU); x.fill();
      x.strokeStyle = '#0d0805'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; x.beginPath(); x.moveTo(xm + Math.cos(a) * rr * 0.45, ry + Math.sin(a) * rr * 0.45); x.lineTo(xm + Math.cos(a) * rr, ry + Math.sin(a) * rr); x.stroke(); }
      /* Strahlen zum Scheitel */
      x.fillStyle = '#ffd98a'; x.fillRect(xm - 3, 0, 6, h * 0.07);
    }
  });
}
function xb(M) {
  let B = XB.get(M); if (B) return B;
  const team = M.trim.color.clone(), add = (col, k, o) => new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(col).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, o));
  const fl = floorCanvas(false), fg = floorCanvas(true);
  const bt = ctex(bannerCanvas('#' + team.getHexString())); bt.wrapS = bt.wrapT = THREE.ClampToEdgeWrapping;
  const domeTex = ctex(domeCanvas()); domeTex.wrapS = THREE.RepeatWrapping;
  const rt = ctex(roofCanvas()); rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
  B = {
    floor: new THREE.MeshStandardMaterial({ map: ctex(fl), emissiveMap: ctex(fg), emissive: '#ffc35a', emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.45, bumpMap: M.hull.bumpMap, bumpScale: 0.25 }),
    floorN: {},
    violet: new THREE.MeshStandardMaterial({ color: '#2c2346', metalness: 0.75, roughness: 0.38, bumpMap: M.hull.bumpMap, bumpScale: 0.4 }),
    team: new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(1.35) }),
    teamSoft: new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(1.1) }),
    banner: new THREE.MeshStandardMaterial({ map: bt, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.75, emissive: '#3a0610', emissiveIntensity: 0.6 }),
    dome: new THREE.MeshStandardMaterial({ color: '#2a1d12', metalness: 0.4, roughness: 0.25, emissiveMap: domeTex, emissive: '#ffffff', emissiveIntensity: 1.0 }),
    roof: new THREE.MeshStandardMaterial({ map: rt, metalness: 0.7, roughness: 0.38, bumpMap: rt, bumpScale: 0.8 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#fff0c8', metalness: 1, roughness: 0.1, emissive: '#c88a2a', emissiveIntensity: 0.35 }),
    sun: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb84a').multiplyScalar(1.7) }),
    sunCore: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1c8').multiplyScalar(2.2) }),
    corona: add('#ffb347', 1.2, { opacity: 0.35 }),
    shield: add('#ffd98a', 0.7, { opacity: 0.12 }),
    beam: add('#ffd27a', 1.2, { opacity: 0.3 }),
    rib: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(1.5) })
  };
  XB.set(M, B); return B;
}

/* Bodenmaterial für eine Plattform mit n Ecken (Intarsien folgen dem Umriss), je Materialsatz zwischengespeichert */
function floorMat(M, n) {
  const B = xb(M); if (n === 8) return B.floor;
  return B.floorN[n] || (B.floorN[n] = new THREE.MeshStandardMaterial({ map: ctex(floorCanvas(false, n)), emissiveMap: ctex(floorCanvas(true, n)), emissive: '#ffc35a', emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.45, bumpMap: M.hull.bumpMap, bumpScale: 0.25 }));
}

/* ------------------------------------------------------------ Grundformen */
/* Prisma/Stumpf aus einem Vieleck in der XZ-Ebene: Deckfläche bei y0, Grundfläche bei y1 auf k1 zur Mitte verkleinert */
function prism(poly, y0, y1, k1, mat, o = {}) {
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
  const sc = k => poly.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
  const m = loft([{ z: -y0, pts: sc(o.k0 || 1) }, { z: -y1, pts: sc(k1) }], mat, { capStart: !!o.top, capEnd: o.bottom !== false, uv: o.uv || 1 / 30 });
  m.geometry.rotateX(PI / 2); m.geometry.computeVertexNormals();
  return m;
}
/* Kasten und Zylinder mit Texturmaßstab nach Größe (gleich große Platten auf großen und kleinen Teilen), geteilt */
function blk(w, h, d, mat) { const k = Math.max(0.12, Math.max(w, h, d) / 36); return mesh(G('Lx' + w + ',' + h + ',' + d, () => uvScale(new THREE.BoxGeometry(w, h, d), k)), mat); }
function cyG(rt, rb, h, seg = 8, t0 = PI / 8, dy = 0) { return G('Ly' + [rt, rb, h, seg, t0, dy].join(','), () => uvScale(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, t0), Math.max(0.1, PI * (rt + rb) / 36), Math.max(0.1, h / 36)).translate(0, dy, 0)); }
function cy(rt, rb, h, mat, seg = 8, t0 = PI / 8, dy = 0) { return mesh(cyG(rt, rb, h, seg, t0, dy), mat); }
/* Apothem (Abstand Mitte–Seitenfläche) eines achteckigen Kegelstumpfs mit Radius rb unten, rt oben, Höhe h, bei y */
const apo = (rt, rb, h, y) => (rb + (rt - rb) * y / h) * Math.cos(PI / 8);
/* Balken zwischen zwei Punkten (w × h Querschnitt) */
function rod(a, b, w, h, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = blk(w, h, L, mat); m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); return m;
}
/* Achteck (Ecken bei k · 45°, Ecke auf +X und +Z) */
const octPoly = (R, rot = 0, n = 8) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU + rot; return [Math.cos(a) * R, Math.sin(a) * R]; });
/* konvexes Vieleck an der Geraden x = c abschneiden (keep > 0: x ≥ c behalten) */
function clipX(poly, c, keep) {
  const out = [], inside = p => (p[0] - c) * keep >= -1e-6;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) { const t = (c - p[0]) / (q[0] - p[0]); out.push([c, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
/* Wandquerschnitt einer Halle (Satteldach), Fuß bei y = 0 */
const hallSec = (w, h, roof) => [[w / 2, 0], [w / 2, h], [0, h + roof], [-w / 2, h], [-w / 2, 0]];

/* ------------------------------------------------------------ Plattform */
/* Goldgefasste Achteckplattform (Radius r = d.r): Boden mit Intarsien, Elfenbeinkante mit Goldgesims, Lichtband in
   Spielerfarbe, Eckfialen auf Pfeilerfüßen, darunter ein umgekehrter Kronenkiel (Bronze, Violett, Goldrippen) mit
   Erbauer-Kristall. o.slot = Breite einer durchgehenden Dockrinne entlang Z (Werft): dann zwei Plattformhälften.
   Damit nicht jede Station auf derselben Scheibe steht: o.n = Eckenzahl (3 Dreieck, 4 Raute, 6, 12, 16 fast rund),
   o.k = Größe relativ zu r, o.sz = Stauchung quer (Z) für langgestreckte Plattformen (Bodenbild wird mitgestaucht). */
function platform(M, r, o = {}) {
  const g = new THREE.Group(), B = xb(M), X = xm(M), n = o.n || 8, sz = o.sz || 1, R = r * (o.k || 0.97), t1 = r * 0.05, rim = r * 0.045;
  const full = octPoly(R, 0, n).map(([x, z]) => [x, z * sz]);
  const parts = o.slot ? [clipX(full, o.slot / 2, 1), clipX(full, -o.slot / 2, -1)] : [full];
  for (const P of parts) {
    /* Boden */
    const inner = P.map(([x, z]) => { const k = (Math.hypot(x, z) - rim) / Math.hypot(x, z); return o.slot ? [x * (Math.abs(x) - rim > o.slot / 2 ? 1 : 1), z] : [x * k, z * k]; });
    const shp = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
    const fg = new THREE.ShapeGeometry(shp); const uv = fg.attributes.uv, pp = fg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / (2 * R) + 0.5, pp.getY(i) / (2 * R * sz) + 0.5);
    fg.rotateX(-PI / 2); g.add(mesh(fg, floorMat(M, n)));
    /* Kante, Kiel */
    g.add(prism(P, 0, -t1, 1, M.hull));
    g.add(prism(P, -t1, -t1 * 1.6, 0.94, M.gold));
    g.add(prism(P, -t1 * 1.6, -r * 0.2, 0.6, M.hull2));
    g.add(prism(P, -r * 0.2, -r * 0.34, 0.22, B.violet, { k0: 0.6 }));
    /* Gesims, Lichtband, Eckfialen, Kielrippen */
    let cx = 0, cz = 0; for (const [x, z] of P) { cx += x; cz += z; } cx /= P.length; cz /= P.length;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], cut = o.slot && Math.abs(a[0]) < o.slot / 2 + 0.01 && Math.abs(b[0]) < o.slot / 2 + 0.01;
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx), nx = -dz / L, nz = dx / L;
      /* Innennormale zeigt zur Mitte */
      const sgn = ((cx - a[0]) * nx + (cz - a[1]) * nz) > 0 ? 1 : -1;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      g.add(at(blk(L, r * 0.022, rim, M.gold), mx + nx * sgn * rim * 0.5, r * 0.011, mz + nz * sgn * rim * 0.5, 0, ang, 0));
      if (!cut) g.add(at(blk(L * 0.86, r * 0.006, r * 0.012, B.team), mx + nx * sgn * rim * 1.45, r * 0.004, mz + nz * sgn * rim * 1.45, 0, ang, 0));
      /* Leuchte in der Kantenmitte */
      if (!cut && L > r * 0.4) { g.add(at(blk(r * 0.05, r * 0.03, r * 0.05, M.gold), mx + nx * sgn * rim * 0.5, r * 0.03, mz + nz * sgn * rim * 0.5, 0, ang, 0)); g.add(at(mesh(G('Lpl' + r, () => new THREE.OctahedronGeometry(r * 0.022, 0)), B.team, false), mx + nx * sgn * rim * 0.5, r * 0.065, mz + nz * sgn * rim * 0.5)); }
      g.add(rod([a[0], -t1 * 1.6, a[1]], [cx + (a[0] - cx) * 0.6, -r * 0.2, cz + (a[1] - cz) * 0.6], r * 0.025, r * 0.025, M.gold));
      g.add(rod([cx + (a[0] - cx) * 0.6, -r * 0.2, cz + (a[1] - cz) * 0.6], [cx + (a[0] - cx) * 0.22, -r * 0.34, cz + (a[1] - cz) * 0.22], r * 0.02, r * 0.02, M.gold));
    }
    P.forEach(([x, z], ci) => {
      if (n > 8 && ci % 2) return;   /* viele Ecken: Fialen nur auf jeder zweiten */
      const big = o.slot && Math.abs(Math.abs(x) - o.slot / 2) < 0.01;
      const s = big ? 1.4 : 1;
      const k = 1 - r * 0.05 * s / Math.hypot(x, z), px = x * k, pz = z * k;
      g.add(at(cy(r * 0.042 * s, r * 0.05 * s, r * 0.05, M.hull, 8, 0, r * 0.025), px, 0, pz));
      g.add(at(mesh(G('Lcg' + r + s, () => new THREE.CylinderGeometry(r * 0.05 * s, r * 0.05 * s, r * 0.012, 8)), M.gold), px, r * 0.05, pz));
      g.add(at(pinnacle(M, r * 0.035 * s, r * 0.15 * s), px, r * 0.056, pz));
    });
    /* Kristall unter dem Kiel */
    const cr = mesh(G('Lkc' + r, () => new THREE.OctahedronGeometry(1, 0).scale(r * 0.05, r * 0.13, r * 0.05)), X.crystal);
    cr.position.set(cx * 0.22, -r * 0.4, cz * 0.22); g.add(cr);
  }
  return g;
}

/* ------------------------------------------------------------ Bauteile */
/* Dachfläche mit Schindeln (Kasten, Textur je 5 Einheiten wiederholt), Breite sl quer, Länge L entlang Z */
function roofSlab(M, sl, L, th = 0.3) {
  const geo = G('Lrs' + sl.toFixed(2) + ',' + L.toFixed(2) + ',' + th, () => { const b = new THREE.BoxGeometry(sl, th, L); const uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sl / 5, uv.getY(i) * L / 5); return b; });
  return mesh(geo, xb(M).roof);
}
/* gotische Halle entlang +Z von z0 bis z1: Wände, Satteldach, Goldfirst, Traufgesims, Fenster, Giebel mit Rose */
function hallZ(M, z0, z1, w, h, roof, o = {}) {
  const g = new THREE.Group(), L = z1 - z0;
  g.add(loft([{ z: z0, pts: hallSec(w, h, roof) }, { z: z1, pts: hallSec(w, h, roof) }], M.hull, { uv: 1 / 30 }));
  /* Dach: Schindelflächen, Goldfirst, Traufen */
  { const ang0 = Math.atan2(roof, w / 2), sl0 = Math.hypot(roof, w / 2) + 0.5; for (const s of [-1, 1]) g.add(at(roofSlab(M, sl0, L + 0.6), s * (w / 4 + 0.1), h + roof / 2 + 0.12, (z0 + z1) / 2, 0, 0, -s * ang0)); }
  g.add(at(blk(w * 0.08, w * 0.08, L + 0.4, M.gold), 0, h + roof, (z0 + z1) / 2, 0, 0, PI / 4));
  for (const s of [-1, 1]) g.add(at(blk(0.5, 0.6, L + 0.2, M.gold), s * (w / 2 + 0.1), h - 0.1, (z0 + z1) / 2));
  for (const s of [-1, 1]) g.add(at(blk(0.4, 0.5, L, M.hull2), s * (w / 2 + 0.05), 0.4, (z0 + z1) / 2));
  /* Dachrippen (Goldleisten quer über das Dach) */
  const ang = Math.atan2(roof, w / 2), sl = Math.hypot(roof, w / 2);
  const nR = o.ribs !== undefined ? o.ribs : Math.max(1, Math.round(L / 7));
  for (let i = 1; i < nR; i++) { const z = z0 + L * i / nR; for (const s of [-1, 1]) g.add(at(blk(sl + 0.4, 0.22, 0.4, M.gold), s * (w / 4 + 0.1), h + roof / 2 + 0.34, z, 0, 0, -s * ang)); }
  /* Fenster */
  if (o.win !== false) { const n = Math.max(1, Math.round(L / 7)), ww = Math.min(2.6, L / n * 0.4), wh = h * 0.55; const list = row(n, z0 + L / n / 2, z1 - L / n / 2, h * 0.2, ww, wh); for (const s of [-1, 1]) { const gr = glassRow(M, list, 0.25); gr.position.x = s * (w / 2 + 0.07); if (s < 0) gr.scale.x = -1; g.add(gr); } }
  /* Giebel: Rose und Fiale */
  if (o.rose !== false) {
    const rr = Math.min(w * 0.3, h * 0.42), ro = rose(M, rr, 8); ro.position.set(0, h * 0.62, z1 + 0.06); g.add(ro);
    g.add(at(blk(w * 0.9, 0.6, 0.6, M.gold), 0, h * 0.15, z1 + 0.2));
    for (const s of [-1, 1]) g.add(rod([s * (w / 2 + 0.3), h - 0.3, z1 + 0.2], [0, h + roof + 0.3, z1 + 0.2], 0.6, 0.6, M.gold));
    g.add(at(pinnacle(M, 0.6, 4.5), 0, h + roof - 0.3, z1));
  }
  return g;
}
/* Lanzenkopf (dreht um Y, Lanzen nach +Z): Drehkranz, Elfenbeingehäuse mit Goldkanten, Wappen hinten, Lanze(n) */
function lanceHead(M, s, o = {}) {
  const g = new THREE.Group(), B = xb(M);
  g.add(mesh(G('Lhd' + s, () => new THREE.CylinderGeometry(s * 1.15, s * 1.3, s * 0.45, 8).translate(0, s * 0.22, 0)), M.gold));
  g.add(at(hull([[-s * 1.3, s * 1.9, s * 1.0, s * 0.35], [s * 0.4, s * 2.0, s * 1.15, s * 0.35], [s * 1.4, s * 0.9, s * 0.7, s * 0.2]], M.hull), 0, s * 0.95, 0));
  g.add(at(hull([[-s * 1.0, s * 1.2, s * 0.5, s * 0.15], [s * 0.6, s * 1.1, s * 0.5, s * 0.15]], M.gold), 0, s * 1.55, 0));
  g.add(at(blk(s * 0.16, s * 0.16, s * 2.2, B.team), 0, s * 1.85, -s * 0.2));
  for (const sx of [-1, 1]) { g.add(at(blk(s * 0.12, s * 0.9, s * 2.4, M.gold), sx * s * 1.0, s * 0.95, -s * 0.1)); g.add(at(pinnacle(M, s * 0.16, s * 1.2), sx * s * 0.8, s * 1.4, -s * 1.15)); }
  const c = crest(M, s * 0.42); c.position.set(0, s * 1.0, -s * 1.42); c.rotation.y = PI; g.add(c);
  const n = o.n || 1, len = o.len || s * 4.2, lr = o.lr || s * 0.22;
  for (let i = 0; i < n; i++) { const l = lance(M, len, lr, o.rings || 2); l.position.set((i - (n - 1) / 2) * s * 0.9, s * (o.ly || 0.95), s * 0.9); g.add(l); }
  if (o.sub) { const l = lance(M, len * 0.7, lr * 0.7, 1); l.position.set(0, s * 1.75, s * 0.6); g.add(l); }
  g.userData.aim = { phase: o.phase || 0 };
  return g;
}
/* Bastionsturm (Achteckschaft mit Lanzettfenstern, Goldbändern, Maschikuli-Kranz und Fialen); Kopf obenauf bei y = h */
function bastionTower(M, rt, h, o = {}) {
  const g = new THREE.Group(), k = rt + ',' + h;
  g.add(cy(rt * 0.92, rt * 1.08, h, M.hull, 8, PI / 8, h / 2));
  g.add(cy(rt * 1.25, rt * 1.35, h * 0.12, M.hull2, 8, PI / 8, h * 0.06));
  for (const y of [0.12, 0.55]) g.add(at(mesh(G('Lbb' + rt, () => new THREE.CylinderGeometry(rt * 1.08, rt * 1.08, rt * 0.14, 8, 1, false, PI / 8)), M.gold), 0, h * y, 0));
  /* Maschikuli-Kranz */
  g.add(at(cy(rt * 1.3, rt * 0.95, rt * 0.45, M.hull), 0, h - rt * 0.12, 0));
  g.add(at(mesh(G('Lbg' + rt, () => new THREE.CylinderGeometry(rt * 1.34, rt * 1.34, rt * 0.16, 8, 1, false, PI / 8)), M.gold), 0, h + rt * 0.1, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(at(pinnacle(M, rt * 0.13, rt * 0.75), Math.cos(a) * rt * 1.24, h + rt * 0.16, Math.sin(a) * rt * 1.24)); }
  /* Lanzetten */
  const wg = G('Lbw' + k, () => { const ww = rt * 0.34, wh = Math.min(h * 0.32, rt * 1.6); return scaleUV(new THREE.ShapeGeometry(new THREE.Shape(v2(archPts(ww, wh))), 3), 0.3).translate(0, h * 0.62, apo(rt * 0.92, rt * 1.08, h, h * 0.62 + wh / 2) + 0.08); });
  for (let i = 0; i < 4; i++) g.add(at(mesh(wg, M.stained, false), 0, 0, 0, 0, i * PI / 2 + PI / 4, 0));
  if (o.buttress) for (let i = 0; i < 4; i++) { const a = i * PI / 2 + (o.brot || 0); const p = new THREE.Group(); p.add(at(pier(M, rt * 0.36, h * 0.42, rt * 0.5), rt * 1.75, 0, 0)); p.add(buttress(M, [rt * 1.75, h * 0.42], [rt * 0.98, h * 0.62], rt * 0.1)); p.rotation.y = a; g.add(p); }
  return g;
}

/* ------------------------------------------------------------ Register */
const KEYS = ['aim', 'charge', 'chargeAt', 'berth', 'dock'];
/* Materialsatz der Stationen: wie der der Schiffe, aber mit mattierterem Gold – die großen waagerechten Goldflächen
   (Gesimse, Plattformrand, Dächer) würden sonst das Hauptlicht als weiße Blendflecke spiegeln */
const MX = new WeakMap();
function stationMats(M) {
  let X = MX.get(M); if (X) return X;
  X = Object.create(M); X.gold = M.gold.clone(); X.gold.roughness = 0.5; X.gold.metalness = 0.9;
  MX.set(M, X); return X;
}
function regB(role, fn) {
  const C = new WeakMap();
  registerB('legion', role, (M0, d, lv) => {
    const M = stationMats(M0);
    let c = C.get(M); if (!c) C.set(M, c = {});
    if (!c[lv]) {
      const g = fn(M, d, lv);
      /* Kennzeichen vor dem Zusammenfassen schützen */
      g.traverse(o => { if (KEYS.some(k => o.userData[k] !== undefined)) o.userData.keep = true; });
      c[lv] = bake(g);
    }
    return c[lv].clone();
  });
}

/* =================================================================== Gebäude */

/* THRONHALLE – Herz der Basis, Kathedralen-Festung: Kreuzgrundriss aus vier Hallen mit Rosenfenstern um einen
   achteckigen Tambour mit gerippter Buntglaskuppel, Laterne und drehendem Heiligenschein (Thronkuppel); Ecktürme.
   Stufe I unbewaffnet. Stufe II: zwei Lanzenbastionen (gegenüberliegende Diagonalen) mit Strebebogenbrücken,
   Strebewerk an den Hallen, höhere Ecktürme. Stufe III: vier Lanzenbastionen, Ringmauer mit Zinnen, schwere Lanze
   auf der Kuppel, Punktverteidigung an den Giebeln, Cherubim kreisen. */
regB('base', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r));
  const rd = 13.5, hd = 26, ap = rd * Math.cos(PI / 8);
  /* Tambour mit Obergaden-Fenstern; Flächen bei k · 45° (dort setzen die Arme an), Ecken dazwischen */
  g.add(cy(rd, rd * 1.04, hd, M.hull, 8, PI / 8, hd / 2));
  g.add(at(mesh(G('Ltc', () => new THREE.CylinderGeometry(rd * 1.08, rd * 1.08, 1.2, 8, 1, false, PI / 8)), M.gold), 0, hd, 0));
  g.add(at(mesh(G('Ltd', () => new THREE.CylinderGeometry(rd * 1.06, rd * 1.06, 0.6, 8, 1, false, PI / 8)), M.gold), 0, 18.6, 0));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const wa = apo(rd, rd * 1.04, hd, 22.2) + 0.08, gr = glassRow(M, [[-1.6, 19.6, 2, 5.2], [1.6, 19.6, 2, 5.2]], 0.25); gr.position.set(Math.cos(a) * wa, 0, Math.sin(a) * wa); gr.rotation.y = -a; g.add(gr);
    const ca = a + PI / 8; g.add(at(pinnacle(M, 0.9, 6), Math.cos(ca) * rd * 1.02, hd + 0.5, Math.sin(ca) * rd * 1.02));
  }
  /* Kuppel: Buntglas mit Goldrippen (Spitzkuppel) */
  const prof = []; { const rb = rd * 0.95, rho = rb * 1.4, th = Math.acos((rho - rb) / rho); for (let i = 0; i <= 8; i++) { const t = i / 8 * th; prof.push([Math.max(0.001, (rb - rho) + rho * Math.cos(t)), rho * Math.sin(t)]); } }
  const dH = prof[8][1], dy = hd + 0.6;
  g.add(at(mesh(G('Ldm', () => new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 16)), B.dome, false), 0, dy, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; const rib = mesh(G('Ldr', () => tube(prof.slice(0, 8).map(([x, y]) => [x * 1.02 + 0.12, y + 0.1, 0]), 0.5, 0.32, M.gold, 8, 4).geometry), M.gold); rib.position.y = dy; rib.rotation.y = -a; g.add(rib); }
  g.add(at(mesh(G('Ldb', () => new THREE.TorusGeometry(rd * 0.96, 0.75, 4, 16).rotateX(PI / 2)), M.gold), 0, dy + 0.3, 0));
  /* Laterne */
  const ly = dy + dH - 1.2;
  g.add(at(mesh(G('Llb', () => new THREE.CylinderGeometry(3.1, 3.4, 0.8, 8)), M.gold), 0, ly, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(at(blk(0.5, 3.4, 0.5, M.gold), Math.cos(a) * 2.5, ly + 2, Math.sin(a) * 2.5)); }
  g.add(at(mesh(G('Lla', () => new THREE.SphereGeometry(1.2, 10, 8)), M.glow, false), 0, ly + 2, 0));
  g.add(at(mesh(G('Llr', () => new THREE.CylinderGeometry(3.1, 3.1, 0.6, 8)), M.gold), 0, ly + 3.9, 0));
  if (lv < 3) { g.add(at(mesh(G('Llc', () => new THREE.ConeGeometry(3, 3.4, 8).translate(0, 1.7, 0)), M.gold), 0, ly + 4.2, 0)); g.add(at(pinnacle(M, 0.6, 5), 0, ly + 7, 0)); }
  /* Heiligenschein über der Kuppel */
  const hl = halo(M, lv >= 2 ? 11 : 9.5, 20); hl.rotation.x = -PI / 2; hl.position.y = ly + (lv >= 3 ? 15 : 12); g.add(hl);
  /* vier Hallen (Kreuzarme) */
  const armL = lv >= 2 ? 40 : 37;
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.add(hallZ(M, ap - 1, armL, 15, 12, 6, { ribs: 4 }));
    /* Strebepfeiler (ab Stufe II mit Strebebögen) */
    for (const s of [-1, 1]) for (const z of [21, 32]) {
      const p = pier(M, 1.6, 9, 2.4); p.position.set(s * 10.4, 0, z); arm.add(p);
      if (lv >= 2) { const fb = buttress(M, [10.4, 9], [7.6, 11.4], 0.45); fb.scale.x = s; fb.position.z = z; arm.add(fb); }
      else arm.add(at(blk(2.4, 1.2, 1.4, M.hull), s * 9, 7.6, z));
    }
    /* Banner an der Giebelwand */
    for (const s of [-1, 1]) { const bn = banner(M, 2.2, 7.5, k + s); bn.children[0].material = B.banner; bn.position.set(s * 5.4, 11.4, armL + 0.7); bn.rotation.y = PI / 2; arm.add(bn); }
    if (lv >= 3) { const t = pd(M, 1.5); t.position.set(0, 18.4, armL - 3.5); t.userData.aim = { phase: k * 1.7, base: 0 }; arm.add(t); }
    arm.rotation.y = k * PI / 2; g.add(arm);
  }
  /* Ecktürme zwischen den Armen */
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2, rr = rd + 6.5, t = spire(M, 3, lv >= 2 ? 20 : 16, lv >= 2 ? 12 : 10);
    t.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); g.add(t);
  }
  /* Lanzenbastionen mit Strebebogenbrücken zu den Ecktürmen */
  const nT = lv >= 3 ? 4 : lv >= 2 ? 2 : 0, tr = r * 0.72;
  for (let k = 0; k < nT; k++) {
    const a = PI / 4 + k * (nT === 2 ? PI : PI / 2), x = Math.cos(a) * tr, z = Math.sin(a) * tr;
    const tw = bastionTower(M, 5.2, 18, { buttress: true, brot: PI / 4 - a }); tw.position.set(x, 0, z); g.add(tw);
    const h2 = lanceHead(M, 3, { len: 16, lr: 0.75, phase: k * 1.3 }); h2.userData.aim.base = PI / 2 - a; h2.position.set(x, 18.3, z); g.add(h2);
  }
  /* Stufe III: Ringmauer mit Zinnen und Ecktürmchen, schwere Lanze auf der Kuppel, Cherubim */
  if (lv >= 3) {
    const P = octPoly(tr / Math.cos(PI / 8), PI / 8);
    for (let i = 0; i < 8; i++) {
      const a = P[i], b = P[(i + 1) % 8], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      const wall = new THREE.Group(), diag = i % 2 === 0;
      wall.add(at(blk(L - 3, 6, 2.6, M.hull), 0, 3, 0)); wall.add(at(blk(L - 3, 0.7, 3.2, M.gold), 0, 6, 0)); wall.add(at(blk(L - 3, 0.5, 3, M.hull2), 0, 0.6, 0));
      for (let j = 0; j < Math.floor((L - 4) / 2.4); j++) { const xx = -L / 2 + 2.6 + j * 2.4; if (diag && Math.abs(xx) < 7) continue; wall.add(at(blk(1.2, 1.5, 2.6, M.hull), xx, 7.1, 0)); }
      wall.position.set(mx, 0, mz); wall.rotation.y = ang; g.add(wall);
    }
    for (const [x, z] of P) { g.add(at(cy(2.7, 3, 10, M.hull, 8, 0, 5), x, 0, z)); g.add(at(mesh(G('Lwg', () => new THREE.CylinderGeometry(3.1, 3.1, 0.6, 8)), M.gold), x, 10, z)); g.add(at(mesh(G('Lwr', () => new THREE.ConeGeometry(3.1, 6, 8).translate(0, 3, 0)), M.gold), x, 10.3, z)); }
    const hv = lanceHead(M, 3.6, { len: 26, lr: 1.2, rings: 3, phase: 0.5, sub: true }); hv.position.y = ly + 4.2; g.add(hv);
    const T = bake(cherubModel(M));
    for (let i = 0; i < 4; i++) { const c = T.clone(); c.scale.setScalar(0.5); const ph = i / 4 * TAU + 0.4; c.userData.orbit = { r: r * 0.86, speed: 0.22 * (i % 2 ? -1 : 1), y: 30 + (i % 2) * 6, phase: ph, wob: 1.5 }; c.position.set(Math.cos(ph) * r * 0.86, 30, Math.sin(ph) * r * 0.86); g.add(c); }
  }
  return g;
});

/* ------------------------------------------------------------ weitere Bauteile */
/* Achteckhaus: Elfenbeinwände mit Sockel- und Gesimsband, Lanzettfenster je Seite, Dach als Schindelpyramide mit
   Goldgraten und Fiale (o.roof = false ohne Dach, o.gold = true Golddach). Fuß bei y = 0, Umkreisradius R. */
function octHouse(M, R, h, o = {}) {
  const g = new THREE.Group(), ap = R * Math.cos(PI / 8), fw = 2 * R * Math.sin(PI / 8);
  g.add(cy(R, R * 1.03, h, M.hull, 8, PI / 8, h / 2));
  g.add(cy(R * 1.08, R * 1.1, h * 0.08, M.hull2, 8, PI / 8, h * 0.04));
  g.add(at(cy(R * 1.07, R * 1.07, Math.max(0.5, h * 0.06), M.gold), 0, h, 0));
  g.add(at(cy(R * 1.05, R * 1.05, 0.35, M.gold), 0, h * 0.14, 0));
  const nW = o.nw || (fw > 9 ? 2 : 1), ww = Math.min(fw * 0.26, h * 0.3), wh = h * (o.whk || 0.5), wa = apo(R, R * 1.03, h, h * 0.28 + wh / 2) + 0.08;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    if (o.skip && o.skip.includes(i)) continue;
    const gr = glassRow(M, row(nW, -fw * 0.2, fw * 0.2, h * 0.28, ww, wh), 0.22); gr.position.set(Math.cos(a) * wa, 0, Math.sin(a) * wa); gr.rotation.y = -a; g.add(gr);
    if (o.pinn !== false) g.add(at(pinnacle(M, R * 0.08, R * 0.5), Math.cos(a + PI / 8) * R * 1.02, h + 0.2, Math.sin(a + PI / 8) * R * 1.02));
  }
  if (o.roof !== false) {
    const rh = o.rh || R * 0.9, k = R + ',' + rh;
    g.add(at(mesh(G('Loc' + k, () => uvScale(new THREE.ConeGeometry(R * 1.02, rh, 8, 1, false, PI / 8), R / 5, rh / 5).translate(0, rh / 2, 0)), o.gold ? M.gold : xb(M).roof), 0, h + 0.3, 0));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; g.add(rod([Math.cos(a) * R * 1.04, h + 0.3, Math.sin(a) * R * 1.04], [0, h + rh + 0.4, 0], 0.4, 0.4, M.gold)); }
    g.add(at(pinnacle(M, R * 0.1, R * 0.7), 0, h + rh + 0.1, 0));
  }
  return g;
}
/* Spitzbogen als Rohr (Ebene X-Y, Füße bei y = 0 und x = ±w/2) */
function archTube(M, w, h, r, mat) {
  const geo = G('Lat' + [w, h, r].join(','), () => { const pts = archPts(w, h, 6).slice(2).sort((a, b) => a[0] - b[0]); const q = [[-w / 2, 0, 0], ...pts.map(([x, y]) => [x, y, 0]), [w / 2, 0, 0]].filter((p, i, A) => i === 0 || Math.abs(p[0] - A[i - 1][0]) > 0.01 || Math.abs(p[1] - A[i - 1][1]) > 0.01); return tube(q, r, r * 0.8, M.hull, 24, 6).geometry; });
  return mesh(geo, mat || M.hull);
}
/* Schildpylon: Vierkantpfeiler mit Goldbändern und Kristallspitze (Fuß bei y = 0), Leuchtring pulsiert */
function pylon(M, h, w = 1.3) {
  const g = new THREE.Group(), X = xm(M);
  g.add(mesh(G('Lpy' + h + ',' + w, () => uvScale(new THREE.CylinderGeometry(w * 0.45, w, h, 4, 1).rotateY(PI / 4), w / 9, h / 9).translate(0, h / 2, 0)), M.hull));
  for (const y of [0.18, 0.55, 0.88]) g.add(at(mesh(G('Lpb' + w, () => new THREE.CylinderGeometry(w * 0.92, w * 0.95, w * 0.3, 4).rotateY(PI / 4)), M.gold), 0, h * y, 0));
  const c = mesh(G('Lpc' + w, () => new THREE.OctahedronGeometry(1, 0).scale(w * 0.7, w * 1.5, w * 0.7)), X.crystal); c.position.y = h + w * 1.2; g.add(c);
  const r = mesh(G('Lpr' + w, () => new THREE.TorusGeometry(w * 1.2, w * 0.09, 4, 16).rotateX(PI / 2)), M.glowSoft, false); r.position.y = h + w * 1.2; r.userData.pulse = { amp: 0.07, speed: 1.6 }; g.add(r);
  return g;
}
/* Monstranz-Strahlenkranz: Goldring mit Strahlen (Ebene X-Z, liegend), dreht langsam */
function sunburst(M, r, rays = 16, speed = 0.1) {
  const g = new THREE.Group();
  g.add(mesh(G('Lsb' + r, () => new THREE.TorusGeometry(r, r * 0.05, 5, 32).rotateX(PI / 2)), M.gold));
  const ray = G('Lsr' + r, () => new THREE.ConeGeometry(r * 0.06, r * 0.5, 4).translate(0, r * 0.25, 0).rotateX(PI / 2));
  for (let i = 0; i < rays; i++) { const a = i / rays * TAU, m = mesh(ray, M.gold); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.y = -a + PI / 2; if (i % 2) m.scale.set(0.7, 0.7, 0.55); g.add(m); }
  g.userData.spin = { axis: 'y', speed }; return g;
}
/* Banner in Spielerfarbe (Material der Stationen) */
function tbanner(M, w, h, phase) { const b = banner(M, w, h, phase); b.children[0].material = xb(M).banner; return b; }

/* RELIQUIENWERFT – offene Bauhalle: die Plattform ist durch eine Dockrinne geteilt, auf beiden Pieren liegt eine
   Galerie (gotische Halle mit Fenstern und Rose), darüber spannen Spitzbögen aus Elfenbein und Gold das Gerüst
   über das Schiff; Fialen an den Bogenfüßen, Kräne auf den Galeriedächern. Stufe I: 3 Bögen, ein Kran (Schiffe bis
   55). Stufe II: breitere Rinne, 5 Bögen mit Heilstrahlen, zwei Kräne, Türme am Heckende (bis 75). Stufe III: 6
   Bögen, vier Türme, Reliquienschrein mit Heiligenschein über dem Bug (bis 90). */
regB('yard', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M);
  const L = [55, 75, 90][lv - 1], slot = [26, 30, 52][lv - 1], gx = [17.5, 20.5, 31.5][lv - 1], gw = [7, 8, 8][lv - 1], gh = [7, 8, 9][lv - 1], gr = [3.4, 3.8, 4][lv - 1], gl = [40, 52, 56][lv - 1];
  g.add(platform(M, r, { slot }));
  /* Dockbecken: abgesenkter Boden in der Rinne mit Goldkante und Leuchtleiste in Spielerfarbe */
  { const R = r * 0.97, mid = clipX(clipX(octPoly(R), slot / 2, -1), -slot / 2, 1), by = -r * 0.05 * 1.6 - 1.2;
    g.add(prism(mid, by, by - 1.2, 1, M.gold, { top: true })); g.add(prism(mid.map(([x, z]) => [x * 0.93, z * 0.96]), by + 0.3, by, 1, xb(M).violet, { top: true }));
    for (let i = 0; i < 5; i++) g.add(at(blk(slot * 0.9, 0.12, 0.5, M.gold), 0, by + 0.32, -R * 0.7 + i * R * 0.35));
    for (const s of [-1, 1]) g.add(at(blk(0.5, 0.3, R * 1.5, xb(M).teamSoft), s * (slot / 2 - 0.4), by + 0.45, 0)); }
  const berth = new THREE.Group(); berth.position.set(0, [4, 7, 9][lv - 1], 0); berth.userData.berth = { len: L }; g.add(berth);
  /* Galerien */
  for (const s of [-1, 1]) { const h = hallZ(M, -gl / 2, gl / 2, gw, gh, gr, { ribs: 0 }); h.position.x = s * gx; if (s < 0) h.rotation.y = PI; g.add(h); }
  /* Bögen */
  const top = gh + gr, nA = [3, 5, 6][lv - 1], ah = [11, 15, 19][lv - 1], zs = Array.from({ length: nA }, (_, i) => -gl / 2 + 5 + (gl - 10) * i / (nA - 1));
  zs.forEach((z, i) => {
    const a = archTube(M, gx * 2, ah, 0.7, i % 2 ? M.gold : M.hull); a.position.set(0, top, z); g.add(a);
    for (const s of [-1, 1]) { g.add(at(blk(2.2, 1.4, 2.2, M.gold), s * gx, top + 0.5, z)); g.add(at(pinnacle(M, 0.5, 3.4), s * gx, top + 1.1, z)); }
    if (lv >= 2 && i < nA - 1) {
      const zm = (z + zs[i + 1]) / 2, y = top + ah - 2;
      g.add(at(blk(1.2, 0.5, zs[i + 1] - z, M.gold), 0, top + ah - 0.3, zm));
      const b = mesh(G('Lyb' + lv, () => new THREE.ConeGeometry(2.2, top + ah - 8, 10, 1, true).translate(0, -(top + ah - 8) / 2, 0)), xb(M).beam, false); b.position.set(0, y, zm); g.add(b);
      g.add(at(mesh(G('Lye', () => new THREE.CylinderGeometry(0.7, 1.1, 1.2, 8)), M.gold), 0, y + 0.3, zm));
    }
  });
  /* Kräne */
  const c1 = crane(M, 6, 12, 0); c1.position.set(gx, top, gl / 2 - 6); c1.rotation.y = 0.35; g.add(c1);
  if (lv >= 2) { const c2 = crane(M, 6, 12, 2); c2.position.set(-gx, top, -gl / 2 + 8); c2.rotation.y = PI - 0.35; g.add(c2); }
  /* Türme an den Enden */
  const tz = gl / 2 + 5;
  if (lv >= 2) for (const s of [-1, 1]) { const t = spire(M, 2.4, 12, 9); t.position.set(s * gx, 0, -tz); g.add(t); }
  if (lv >= 3) for (const s of [-1, 1]) { const t = spire(M, 2.4, 12, 9); t.position.set(s * gx, 0, tz); g.add(t); }
  else for (const s of [-1, 1]) g.add(at(pinnacle(M, 0.9, 6), s * gx, 0, tz));
  /* Reliquienschrein mit Heiligenschein (Stufe III): hängt im Bogen über dem Bug */
  if (lv >= 3) {
    const sh = new THREE.Group(), z = zs[nA - 1];
    sh.add(at(blk(3, 3, 3, M.gold), 0, 0, 0)); sh.add(at(mesh(G('Lys', () => new THREE.ConeGeometry(2.2, 2.4, 4).rotateY(PI / 4)), M.gold), 0, 2.6, 0));
    const rel = mesh(G('Lyr', () => new THREE.OctahedronGeometry(1, 0).scale(0.9, 1.6, 0.9)), X.crystal); rel.position.y = -3.2; rel.userData.spin = { axis: 'y', speed: 0.7 }; sh.add(rel);
    sh.add(at(glowSprite(M, 8), 0, -3.2, 0));
    const hl = halo(M, 4, 14); hl.position.set(0, 0, -0.2); sh.add(hl);
    sh.position.set(0, top + ah - 5.5, z); g.add(sh);
  }
  /* Banner und Leuchten an den Pieren */
  for (const s of [-1, 1]) for (const z of [-gl / 2 + 4, gl / 2 - 4]) { const bn = tbanner(M, 1.8, 6, z); bn.position.set(s * (gx + gw / 2 + 0.3), gh - 0.5, z); g.add(bn); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.add(at(navLight(M, 0.5, 'light', 0.35 + i * 0.03), s * (slot / 2 + 1), 1.2, -gl / 2 + 4 + i * (gl - 8) / 3));
  return g;
});

/* SCHATZKAMMER – Verarbeitungshalle als goldgedeckter Achteckbau mit Buntglas; Andockarme als Elfenbeinpiere mit
   Goldgeländer, am Ende eine Dockplattform mit vier Pylonen (Frachter liegt quer). Stufe I: Halle, ein Arm,
   Erzurnen am Sockel. Stufe II: zwei Arme, Seitenkapellen (Schatztruhen), Räucherlaternen. Stufe III: drei Arme,
   höhere Kuppel mit Heiligenschein, Urnenkranz auf Sockeln, Banner. */
regB('refinery', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r, { n: 12, k: 0.56 }));   /* kleine runde Nabe, die Piers ragen frei ins All */
  const R = 11, h = lv >= 3 ? 13 : 11;
  g.add(octHouse(M, R, h, { gold: true, rh: lv >= 3 ? 12 : 9, nw: 2 }));
  g.add(at(cy(R * 1.25, R * 1.3, 1.6, M.hull2, 8, PI / 8, 0.8), 0, 0, 0));
  g.add(at(cy(R * 1.22, R * 1.22, 0.4, M.gold), 0, 1.6, 0));
  /* Laterne auf der Kuppel */
  const ty = h + 0.3 + (lv >= 3 ? 12 : 9);
  g.add(at(mesh(G('Lrl', () => new THREE.SphereGeometry(1.1, 10, 8)), M.glow, false), 0, ty + 1.4, 0));
  if (lv >= 3) { const hl = halo(M, 7, 16); hl.rotation.x = -PI / 2; hl.position.y = ty + 6; g.add(hl); }
  /* Andockarme */
  const nD = lv, angs = Array.from({ length: nD }, (_, i) => PI / 2 + i / nD * TAU);
  for (const a of angs) {
    const arm = new THREE.Group();
    /* Pier */
    arm.add(at(blk(13, 1.6, 6, M.hull), R + 6, 0.8, 0)); arm.add(at(blk(13, 0.4, 6.6, M.gold), R + 6, 1.7, 0));
    for (const s of [-1, 1]) { arm.add(at(blk(13, 0.9, 0.3, M.gold), R + 6, 2.3, s * 3.2)); for (let i = 0; i < 4; i++) arm.add(at(pinnacle(M, 0.3, 2), R + 1.5 + i * 3.2, 1.9, s * 3.2)); }
    /* Rohr (Erzleitung) über dem Pier, Teamlicht */
    arm.add(at(mesh(G('Lrp', () => new THREE.CylinderGeometry(0.9, 0.9, 14, 8).rotateZ(PI / 2)), M.hull2), R + 6, 3.4, 0));
    for (let i = 0; i < 3; i++) arm.add(at(mesh(G('Lrr', () => new THREE.TorusGeometry(1.0, 0.18, 4, 10).rotateY(PI / 2)), M.gold), R + 2.5 + i * 4.5, 3.4, 0));
    /* Dockplattform */
    const dx = R + 17;
    const pad = new THREE.Group(); pad.position.x = dx;
    pad.add(prism(octPoly(10.5), 0, -1.4, 0.9, M.hull, { top: true })); pad.add(prism(octPoly(10.6), 0.5, 0, 1, M.gold, { top: true }));
    pad.add(mesh(G('Lrd', () => new THREE.RingGeometry(6.5, 7.2, 24).rotateX(-PI / 2).translate(0, 0.56, 0)), B.teamSoft, false));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pad.add(at(pylon(M, 7, 1.0), sx * 7.5, 0.5, sz * 8)); }
    for (const sz of [-1, 1]) { pad.add(at(blk(0.3, 0.3, 14, M.gold), 0, 0.7, sz * 9.5)); }
    const dock = new THREE.Group(); dock.position.set(0, 5.5, 0); dock.userData.dock = true; pad.add(dock);
    arm.add(pad);
    arm.rotation.y = -a; g.add(arm);
  }
  /* Erzurnen am Sockel (zwischen den Armen), Stufe III Urnenkranz auf Sockeln */
  const uN = lv >= 3 ? 8 : 4, uR = lv >= 3 ? 18.2 : R + 4;
  for (let i = 0; i < uN; i++) {
    const a = PI / 2 + (i + 0.5) / uN * TAU; if (angs.some(b => Math.abs(((a - b + PI) % TAU + TAU) % TAU - PI) < (lv < 3 ? 0.6 : 0.3))) continue;
    const u = new THREE.Group(); u.position.set(Math.cos(a) * uR, 0, Math.sin(a) * uR);
    if (lv >= 3) { u.add(at(cy(2.0, 2.3, 2, M.hull, 8, PI / 8, 1), 0, 0, 0)); u.add(at(cy(2.6, 2.6, 0.3, M.gold), 0, 2, 0)); }
    const urn = mesh(urnGeo(), M.hull); urn.scale.setScalar(1.1); urn.position.y = (lv >= 3 ? 2 : 0) + 3.3; u.add(urn);
    for (const y of [-1.6, 1.6]) u.add(at(mesh(G('Lru' + y, () => new THREE.TorusGeometry(y < 0 ? 2.3 : 1.75, 0.18, 4, 14).rotateX(PI / 2)), M.gold), 0, urn.position.y + y * 1.1, 0));
    u.add(at(mesh(G('Lrg', () => new THREE.CylinderGeometry(0.8, 0.8, 0.5, 10)), M.glow, false), 0, urn.position.y + 3.3, 0));
    g.add(u);
  }
  /* Stufe II: Seitenkapellen (Schatztruhen) mit Golddeckel, Räucherlaternen */
  if (lv >= 2) for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2; if (angs.some(b => Math.abs(((a - b + PI) % TAU + TAU) % TAU - PI) < 0.5)) continue;
    const c = new THREE.Group(); c.position.set(Math.cos(a) * (R + 4.5), 0, Math.sin(a) * (R + 4.5)); c.rotation.y = -a;
    c.add(at(blk(6, 4.5, 7, M.hull), 0, 2.25, 0)); c.add(at(blk(6.4, 0.5, 7.4, M.gold), 0, 4.6, 0));
    c.add(at(mesh(G('Lrc', () => uvScale(new THREE.CylinderGeometry(3.4, 3.4, 7, 8, 1, false, 0, PI).rotateZ(PI / 2).rotateX(PI / 2), 0.5, 0.5)), M.gold), 0, 4.8, 0, 0, 0, 0));
    c.add(at(blk(0.3, 0.3, 7.6, B.team), 0, 8.1, 0));
    const gr = glassRow(M, [[-1.6, 0.8, 1.0, 2.6], [1.6, 0.8, 1.0, 2.6]], 0.18); gr.position.set(3.07, 0, 0); c.add(gr);
    const cs = censer(M, 2.2); cs.position.set(4.5, 7.5, 0); c.add(cs);
    g.add(c);
  }
  if (lv >= 3) for (const a of angs) { const b = PI / 2 + a - PI / 2 + PI / nD; const bn = tbanner(M, 2, 7, b); bn.position.set(Math.cos(b) * (R + 2.5), h + 1, Math.sin(b) * (R + 2.5)); bn.rotation.y = -b + PI / 2; g.add(bn); }
  return g;
});

/* SONNENKERN – Monstranz: achteckiger Goldsockel mit Spitzbogenöffnungen, darüber in vier Goldklauen das glühende
   Sonnenfragment mit Strahlenkranz und Korona; Gyroskopringe kreisen. Stufe I: Sockel, Kern, ein Ring. Stufe II:
   vier Schildpylonen mit Kristallen, zweiter Ring, Goldstrahlenkranz. Stufe III: acht Pylonen mit Strebebögen zum
   Sockel, dritter Ring, großer liegender Strahlenkranz, Heiligenschein über dem Kern. */
regB('reactor', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r, { n: 6 }));
  /* Sockel */
  g.add(cy(9, 10, 6, M.hull, 8, PI / 8, 3)); g.add(at(cy(9.7, 9.7, 0.6, M.gold), 0, 6, 0)); g.add(at(cy(10.4, 10.6, 0.8, M.gold), 0, 0.4, 0));
  g.add(cy(5.6, 7, 3.5, M.gold, 8, PI / 8, 7.9)); g.add(at(cy(4.4, 4.6, 1.5, M.hull), 0, 10.4, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, ap = apo(9, 10, 6, 3.4) + 0.08; const gr = glassRow(M, [[-1.5, 1.4, 1.3, 3.4], [1.5, 1.4, 1.3, 3.4]], 0.2); gr.position.set(Math.cos(a) * ap, 0, Math.sin(a) * ap); gr.rotation.y = -a; g.add(gr); g.add(at(pinnacle(M, 0.55, 3.2), Math.cos(a + PI / 8) * 9.6, 6.2, Math.sin(a + PI / 8) * 9.6)); }
  /* Klauen und Kern */
  const cy0 = 17.5, cr = 4.2;
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; const claw = mesh(G('Lcl', () => tube([[4.2, 10.4, 0], [6.5, 14, 0], [5.2, 18.5, 0], [3.4, 20.6, 0]], 0.55, 0.3, M.gold, 10, 5).geometry), M.gold); claw.rotation.y = -a; g.add(claw); }
  const core = mesh(G('Lco', () => new THREE.SphereGeometry(cr, 20, 14)), B.sun, false); core.position.y = cy0; core.userData.pulse = { amp: 0.05, speed: 1.4 }; g.add(core);
  g.add(at(glowSprite(M, 13), 0, cy0, 0));
  /* Gyroskopringe */
  const nR = lv;
  for (let i = 0; i < nR; i++) { const pv = new THREE.Group(); const rg = mesh(G('Lgy' + i, () => new THREE.TorusGeometry(cr + 1.6 + i * 1.3, 0.3, 5, 36)), i === 1 ? B.rib : M.gold); rg.rotation.x = [0.3, 1.25, 0.8][i]; rg.rotation.z = [0, 0.4, -0.9][i]; pv.add(rg); pv.position.y = cy0; pv.userData.spin = { axis: ['y', 'x', 'z'][i], speed: [0.5, -0.35, 0.28][i] }; g.add(pv); }
  /* Pylonen */
  if (lv >= 2) {
    const nP = lv >= 3 ? 8 : 4, pr = lv >= 3 ? 19 : 17;
    for (let i = 0; i < nP; i++) {
      const a = PI / 4 + i / nP * TAU, p = pylon(M, 10, 1.4); p.position.set(Math.cos(a) * pr, 0, Math.sin(a) * pr); g.add(p);
      if (lv >= 3) { const fb = buttress(M, [pr - 0.5, 9], [8.3, 11.2], 0.4); fb.rotation.y = -a; g.add(fb); }
      else g.add(at(blk(pr - 8, 1.2, 2.4, M.hull), (pr + 8) / 2 * Math.cos(a), 0.6, (pr + 8) / 2 * Math.sin(a), 0, -a, 0));
    }
    const sb = sunburst(M, lv >= 3 ? 9.5 : 8, 16, 0.12); sb.position.y = cy0; g.add(sb);
  }
  if (lv >= 3) {
    const sb2 = sunburst(M, 15, 24, -0.06); sb2.position.y = 12.5; g.add(sb2);
    const sb3 = sunburst(M, 5.5, 12, 0.2); sb3.position.y = cy0 + 6.5; g.add(sb3);
  }
  return g;
});

/* ARCHIVTURM – Bibliothek: achteckiger Sockelbau mit zwei Fensterreihen, darauf der hohe Archivturm mit Rosen-
   fenstern auf vier Seiten und Spitzhelm; Sensorkrone aus Goldnadeln mit Lichtern. Stufe I: Sockel, Turm.
   Stufe II: höherer Turm, vier Ecktürmchen mit Strebebögen, Astrolab-Ring. Stufe III: Turm noch höher,
   Armillarsphäre über dem Helm, Räucherlaternen, Banner, zweiter Ring. */
regB('lab', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M);
  g.add(platform(M, r, { n: 4 }));   /* Raute, Ecken auf den Achsen (dort liegen ab Stufe II die Bibliotheksflügel) */
  const R = 11.5, hb = 8;
  g.add(octHouse(M, R, hb, { roof: false, nw: 2, whk: 0.45 }));
  /* zweites Geschoss (Fensterreihe) */
  g.add(cy(R * 0.86, R * 0.9, 5, M.hull, 8, PI / 8, hb + 2.5)); g.add(at(cy(R * 0.93, R * 0.93, 0.5, M.gold), 0, hb + 5, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, ap = apo(R * 0.86, R * 0.9, 5, 2.4) + 0.08; const gr = glassRow(M, row(3, -2.3, 2.3, hb + 1, 1.0, 2.6), 0.18); gr.position.set(Math.cos(a) * ap, 0, Math.sin(a) * ap); gr.rotation.y = -a; g.add(gr); }
  /* Turm */
  const rt = 6, ht = [15, 21, 27][lv - 1], y0 = hb + 5, roofH = 13;
  const tw = spire(M, rt, ht, roofH); tw.position.y = y0; g.add(tw);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; const ro = rose(M, 2.7, 8); ro.position.set(Math.cos(a) * (apo(rt * 0.9, rt, ht, ht * 0.72) + 0.12), y0 + ht * 0.72, Math.sin(a) * (rt * 0.95 * Math.cos(PI / 8) + 0.1)); ro.rotation.y = PI / 2 - a; g.add(ro); }
  /* Sensorkrone: Goldnadeln um den Helm */
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, hh = i % 2 ? 5 : 8; const n = mesh(G('Lln' + hh, () => new THREE.CylinderGeometry(0.08, 0.22, hh, 5).translate(0, hh / 2, 0)), M.gold); n.position.set(Math.cos(a) * rt * 0.6, y0 + ht + roofH * 0.55, Math.sin(a) * rt * 0.6); n.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(n); const tip = navLight(M, 0.28, 'light', 0.3 + i * 0.03); tip.position.set(Math.cos(a) * (rt * 0.6 + hh * 0.3), y0 + ht + roofH * 0.55 + hh * 0.95, Math.sin(a) * (rt * 0.6 + hh * 0.3)); g.add(tip); }
  /* Ecktürmchen mit Strebebögen */
  if (lv >= 2) for (let i = 0; i < 4; i++) { const a = i * PI / 2; const t = spire(M, 1.6, 7, 6); t.position.set(Math.cos(a) * 9.5, y0, Math.sin(a) * 9.5); g.add(t); const fb = buttress(M, [9.5, y0 + 7], [rt + 0.3, y0 + 11], 0.35); fb.rotation.y = -a; g.add(fb); }
  /* Bibliotheksflügel zu den Rautenecken: Stufe II zwei (±X), Stufe III vier; Kopfwand mit Fialen */
  const nWing = lv >= 3 ? 4 : lv >= 2 ? 2 : 0;
  for (let i = 0; i < nWing; i++) {
    const w = new THREE.Group(); w.rotation.y = i * PI / 2 + PI / 2;
    w.add(hallZ(M, R * 0.86, R + 10.5, 7, 6, 3.4, { ribs: 2, rose: false }));
    w.add(at(blk(7.4, 6.6, 1.2, M.hull), 0, 3.3, R + 10.9)); w.add(at(blk(7.8, 0.5, 1.6, M.gold), 0, 6.6, R + 10.9));
    w.add(at(pinnacle(M, 0.7, 5), 0, 6.8, R + 10.9)); for (const s of [-1, 1]) w.add(at(pinnacle(M, 0.45, 3.2), s * 3.5, 6.8, R + 10.9));
    g.add(w);
  }
  /* Astrolab-Ringe um den Turm */
  if (lv >= 2) { const pv = new THREE.Group(); const rg = mesh(G('Lla1', () => new THREE.TorusGeometry(8.5, 0.35, 5, 40)), M.gold); rg.rotation.x = PI / 2 + 0.25; pv.add(rg); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; pv.add(at(navLight(M, 0.35, 'light', 0.3 + i * 0.05), Math.cos(a) * 8.5, Math.sin(a) * 8.5 * Math.sin(0.25) * -1, Math.sin(a) * 8.5 * Math.cos(0.25))); } pv.position.y = y0 + ht * 0.45; pv.userData.spin = { axis: 'y', speed: 0.25 }; g.add(pv); }
  if (lv >= 3) {
    const pv = new THREE.Group(); const rg = mesh(G('Lla2', () => new THREE.TorusGeometry(7.5, 0.3, 5, 40)), xb(M).rib); rg.rotation.x = PI / 2 - 0.35; pv.add(rg); pv.position.y = y0 + ht * 0.2; pv.userData.spin = { axis: 'y', speed: -0.18 }; g.add(pv);
    /* Armillarsphäre */
    const ast = new THREE.Group(); ast.add(mesh(G('Las', () => new THREE.SphereGeometry(1.1, 12, 8)), M.glow, false));
    for (let i = 0; i < 2; i++) { const rr = mesh(G('Lar' + i, () => new THREE.TorusGeometry(2.6 + i * 0.8, 0.16, 4, 28)), M.gold); const q = new THREE.Group(); q.add(rr); rr.rotation.x = i ? 1.2 : 0.3; q.userData.spin = { axis: i ? 'y' : 'x', speed: 0.6 - i * 0.25 }; ast.add(q); }
    ast.position.y = y0 + ht + roofH + 5.5; g.add(ast);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; g.add(at(blk(4, 0.5, 0.6, M.gold), Math.cos(a) * (R * 0.9 + 1.5), hb + 4.5, Math.sin(a) * (R * 0.9 + 1.5), 0, -a, 0)); const cs = censer(M, 2.2); cs.position.set(Math.cos(a) * (R * 0.9 + 3.3), hb + 4.3, Math.sin(a) * (R * 0.9 + 3.3)); g.add(cs); }
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; const bn = tbanner(M, 1.8, 6.5, i); bn.position.set(Math.cos(a) * (R + 0.6), hb - 0.5, Math.sin(a) * (R + 0.6)); bn.rotation.y = -a + PI / 2; g.add(bn); }
  }
  return g;
});

/* LANZENBASTION – Geschützturm: Bastionsturm (Achteck, Maschikuli-Kranz, Fialen) auf dem Sockel, darauf der
   drehbare Lanzenkopf mit Wappen. Stufe I: eine Lichtlanze. Stufe II: zwei Lanzen, vier Strebepfeiler mit
   Strebebögen. Stufe III: schwere Lanze mit kleiner Lanze darüber, höherer Turm, Zinnenring, Teamlichter. */
regB('turret', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r;
  g.add(platform(M, r, { n: 12, k: 0.82 }));
  const rt = 5.4, h = [8, 9, 10.5][lv - 1];
  g.add(bastionTower(M, rt, h, { buttress: lv >= 2, brot: PI / 4 }));
  if (lv >= 3) { const P = octPoly(12.5, PI / 8); for (let i = 0; i < 8; i++) { const a = P[i], b = P[(i + 1) % 8], L = Math.hypot(b[0] - a[0], b[1] - a[1]); const w = new THREE.Group(); w.add(at(blk(L - 1.5, 2, 1.4, M.hull), 0, 1, 0)); w.add(at(blk(L - 1.5, 0.3, 1.6, M.gold), 0, 2, 0)); for (let j = 0; j < 3; j++) w.add(at(blk(0.9, 0.9, 1.4, M.hull), -L / 2 + 1.6 + j * (L - 3.2) / 2, 2.5, 0)); w.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); w.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); g.add(w); } }
  /* Stufe II: niedrige Goldbrüstung mit Fialen um den Turmfuß */
  if (lv === 2) { g.add(at(mesh(G('Ltpb', () => new THREE.TorusGeometry(11.5, 0.45, 3, 16).rotateX(PI / 2)), M.gold), 0, 1.1, 0)); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; g.add(at(cy(0.6, 0.75, 1.4, M.hull, 6, 0, 0.7), Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5)); g.add(at(pinnacle(M, 0.4, 2.6), Math.cos(a) * 11.5, 1.4, Math.sin(a) * 11.5)); } }
  const head = lv >= 3 ? lanceHead(M, 2.9, { len: 18, lr: 0.9, rings: 3, sub: true }) : lanceHead(M, 2.6, { n: lv, len: 14, lr: 0.6 });
  head.position.y = h + rt * 0.2; g.add(head);
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; g.add(at(navLight(M, 0.45, 'light', 0.3 + i * 0.02), Math.cos(a) * 14, 0.8, Math.sin(a) * 14)); }
  return g;
});

/* ÄGIS-SCHREIN – Schrein mit Schutzkuppel: achteckige Kapelle mit Buntglas und Golddach, darüber der liegende
   Heiligenschein-Emitter (drehender Strahlenkranz); Schildpylonen mit Kristallen rundum. Stufe I: Kapelle, vier
   Pylonen, ein Heiligenschein. Stufe II: acht Pylonen, Lichtrippen zwischen den Kristallen, größerer Schein.
   Stufe III: zarte Schildkuppel, zweiter gegenläufiger Schein, Banner, Strebebögen zur Kapelle. */
regB('shield', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r));
  g.add(octHouse(M, 7.5, 8, { gold: true, rh: 7, nw: 1, whk: 0.55 }));
  const ty = 8 + 0.3 + 7;
  g.add(at(mesh(G('Lsl', () => new THREE.SphereGeometry(1.1, 10, 8)), M.glow, false), 0, ty + 1.3, 0));
  /* Heiligenschein-Emitter */
  const hl = halo(M, lv >= 2 ? 7 : 5.5, 16); hl.rotation.x = -PI / 2; hl.position.y = ty + 5; g.add(hl);
  if (lv >= 3) { const h2 = halo(M, 9.5, 20); h2.rotation.x = -PI / 2; h2.position.y = ty + 8; h2.children[1].userData.spin.speed = -0.09; g.add(h2); }
  /* Pylonen */
  const nP = lv >= 2 ? 8 : 4, pr = 16, ph = 9, pts = [];
  for (let i = 0; i < nP; i++) {
    const a = PI / 4 + i / nP * TAU, x = Math.cos(a) * pr, z = Math.sin(a) * pr;
    const p = pylon(M, ph, 1.3); p.position.set(x, 0, z); g.add(p); pts.push([x, ph + 1.56, z]);
    if (lv >= 3) { const fb = buttress(M, [pr - 0.6, ph * 0.7], [8.1, 8.4], 0.35); fb.rotation.y = -a; g.add(fb); }
    else g.add(at(blk(pr - 8.5, 1.2, 2, M.hull), (pr + 8.3) / 2 * Math.cos(a), 0.6, (pr + 8.3) / 2 * Math.sin(a), 0, -a, 0));
  }
  /* Lichtrippen zwischen den Kristallen (Stufe II), Schildkuppel (Stufe III) */
  if (lv >= 2) for (let i = 0; i < nP; i++) { const a = pts[i], b = pts[(i + 1) % nP]; const rib = mesh(G('Lsr' + i + lv, () => tube([a, [(a[0] + b[0]) / 2, a[1] + 2.2, (a[2] + b[2]) / 2], b], 0.14, 0.14, M.glowSoft, 10, 4).geometry), M.glowSoft, false); g.add(rib); }
  if (lv >= 3) { const dome = mesh(G('Lsd', () => new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, PI / 2)), B.shield, false); dome.scale.set(17.5, 20, 17.5); dome.position.y = 1; g.add(dome); }
  if (lv >= 3) for (let i = 0; i < 4; i++) { const a = i * PI / 2; const bn = tbanner(M, 1.6, 5.5, i); bn.position.set(Math.cos(a) * 8.2, 7.4, Math.sin(a) * 8.2); bn.rotation.y = -a + PI / 2; g.add(bn); }
  return g;
});

/* BANNERTURM – schlanker Turm mit Spitzhelm, an Goldrahen hängen Banner in Spielerfarbe; Wappen an der Turmbasis.
   Stufe I: Turm mit einer Rahe, zwei Banner. Stufe II: höherer Turm, zwei Rahen, vier Banner, Leuchtring.
   Stufe III: drei Rahen, sechs Banner, Heiligenschein-Krone, Räucherlaternen am Sockel. */
regB('relay', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, B = xb(M);
  g.add(platform(M, r, { n: 3 }));   /* Dreieck: Spitze auf +X, Ecktürme ab Stufe II auf den Ecken */
  g.add(cy(5.5, 6.2, 3, M.hull, 8, PI / 8, 1.5)); g.add(at(cy(6, 6, 0.4, M.gold), 0, 3, 0));
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; const c = crest(M, 1.1); c.position.set(Math.cos(a) * 5.3, 1.6, Math.sin(a) * 5.3); c.rotation.y = PI / 2 - a; g.add(c); }
  const ht = [15, 20, 25][lv - 1], tw = spire(M, 2.8, ht, 9.5); tw.position.y = 3; g.add(tw);
  const nY = lv, ys = Array.from({ length: nY }, (_, i) => 3 + ht * (0.92 - i * 0.3));
  ys.forEach((y, i) => {
    const a = i * PI / 2;
    const yard = new THREE.Group(); yard.rotation.y = a;
    yard.add(at(blk(15, 0.55, 0.55, M.gold), 0, 0, 0)); for (const s of [-1, 1]) { yard.add(at(mesh(G('Lrk', () => new THREE.ConeGeometry(0.5, 1.8, 6).rotateZ(-PI / 2)), M.gold), s * 8.2, 0, 0, 0, s > 0 ? 0 : PI, 0)); yard.add(at(navLight(M, 0.3, 'light', 0.3), s * 9.1, 0, 0)); const bn = tbanner(M, 3, 9, i + s); bn.position.set(s * 5.2, -0.3, 0); bn.rotation.y = PI / 2; yard.add(bn); }
    yard.position.y = y; g.add(yard);
  });
  /* Ecktürme auf den Dreieckspitzen (Stufe II) mit Strebebögen zum Turm, Stufe III mit Bannern und Kristallen */
  if (lv >= 2) for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, cx = Math.cos(a) * 12.5, cz = Math.sin(a) * 12.5, t = spire(M, 1.7, lv >= 3 ? 10 : 7.5, 6);
    t.position.set(cx, 0, cz); g.add(t);
    const fb = buttress(M, [12.5, lv >= 3 ? 9 : 6.5], [3.4, 3 + ht * 0.35], 0.35); fb.rotation.y = -a; g.add(fb);
    if (lv >= 3) { const bn = tbanner(M, 1.6, 5.5, i); bn.position.set(Math.cos(a) * 10.6, 8.5, Math.sin(a) * 10.6); bn.rotation.y = -a + PI / 2; g.add(bn); }
  }
  if (lv >= 3) { const hl = halo(M, 5.5, 16); hl.rotation.x = -PI / 2; hl.position.y = 3 + ht + 12; g.add(hl); }
  if (lv >= 2) { const rg = mesh(G('Lrlr', () => new THREE.TorusGeometry(5.5, 0.22, 5, 32).rotateX(PI / 2)), B.teamSoft, false); rg.position.y = 3 + ht * 0.3; rg.userData.pulse = { amp: 0.04, speed: 1.2 }; g.add(rg); }
  if (lv >= 3) { const sb = sunburst(M, 4.2, 12, 0.1); sb.position.y = 3 + ht * 0.62; g.add(sb); for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; g.add(at(blk(3.6, 0.5, 0.5, M.gold), Math.cos(a) * 7, 3.6, Math.sin(a) * 7, 0, -a, 0)); const cs = censer(M, 1.8); cs.position.set(Math.cos(a) * 8.6, 3.4, Math.sin(a) * 8.6); g.add(cs); } }
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + PI / 3; g.add(at(navLight(M, 0.45, 'light', 0.3 + i * 0.02), Math.cos(a) * 8.2, 0.8, Math.sin(a) * 8.2)); }
  return g;
});

/* SUNBREAKER – Superwaffe: in der Mitte ein Altar (Goldstufen mit Spitzbogenöffnungen), darüber in vier Klauen
   das Sonnenfragment (wächst mit der Ladung, Korona); rundum der Spiegelkranz: Hohlspiegel auf Goldgabeln, zur
   Mitte geneigt, deren Strahlen zum Kern nacheinander aufleuchten (chargeAt). Stufe I: 8 Spiegel. Stufe II:
   10 Spiegel, vier Spitztürme innen. Stufe III: 12 Spiegel, Ring aus Fialen außen, großer Heiligenschein über
   dem Kern. */
regB('super', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r));
  /* Altar */
  g.add(cy(12, 13, 2.2, M.hull, 8, PI / 8, 1.1)); g.add(at(cy(12.6, 12.6, 0.5, M.gold), 0, 2.2, 0));
  g.add(cy(8.5, 9.5, 5, M.hull, 8, PI / 8, 4.7)); g.add(at(cy(9.2, 9.2, 0.5, M.gold), 0, 7.2, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, ap = apo(8.5, 9.5, 5, 2.6) + 0.08; const gr = glassRow(M, [[0, 3, 2, 3.6]], 0.2); gr.position.set(Math.cos(a) * ap, 0, Math.sin(a) * ap); gr.rotation.y = -a; g.add(gr); g.add(at(pinnacle(M, 0.6, 3.5), Math.cos(a + PI / 8) * 12.2, 2.4, Math.sin(a + PI / 8) * 12.2)); }
  g.add(cy(5, 6.5, 3, M.gold, 8, PI / 8, 8.9));
  const cy0 = 20;
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; const claw = mesh(G('Lscl', () => tube([[5, 10.2, 0], [8.5, 15, 0], [7, 21, 0], [4.5, 24.5, 0]], 0.7, 0.35, M.gold, 10, 5).geometry), M.gold); claw.rotation.y = -a; g.add(claw); }
  /* Sonnenfragment (wächst mit der Ladung) */
  const core = mesh(G('Lsco', () => new THREE.SphereGeometry(1, 22, 16)), B.sun, false); core.position.y = cy0; core.userData.charge = true; core.userData.chargeBase = 6; g.add(core);
  const core2 = mesh(G('Lsco2', () => new THREE.SphereGeometry(1, 14, 10)), B.sunCore, false); core2.position.y = cy0; core2.userData.charge = true; core2.userData.chargeBase = 3.5; g.add(core2);
  const cor = glowSprite(M, 1); cor.position.y = cy0; cor.userData.charge = true; cor.userData.chargeBase = 34; g.add(cor);
  const sb = sunburst(M, 8.5, 20, 0.15); sb.position.y = cy0; g.add(sb);
  /* Spiegelkranz */
  const nM = [8, 10, 12][lv - 1], mr = 37, mh = 11, mR = 6.5;
  const dishG = G('Lsdh', () => { const s = new THREE.SphereGeometry(mR * 1.6, 20, 8, 0, TAU, 0, Math.asin(mR / (mR * 1.6))); s.translate(0, -mR * 1.6 * Math.cos(Math.asin(1 / 1.6)), 0); s.rotateX(PI); return s; });
  const backG = G('Lsdb', () => new THREE.CylinderGeometry(mR * 1.02, mR * 0.8, 0.9, 20, 1));
  for (let i = 0; i < nM; i++) {
    const a = i / nM * TAU + PI / nM, x = Math.cos(a) * mr, z = Math.sin(a) * mr;
    const m = new THREE.Group(); m.position.set(x, 0, z); m.rotation.y = -a;
    /* Gabel */
    m.add(at(cy(2.8, 3.4, 2, M.hull, 8, PI / 8, 1), 0, 0, 0)); m.add(at(cy(3.1, 3.1, 0.4, M.gold), 0, 2, 0));
    for (const s of [-1, 1]) { m.add(at(blk(0.9, mh, 0.9, M.hull), 0, mh / 2 + 2, s * mR * 0.9)); m.add(at(blk(1.1, 0.4, 1.1, M.gold), 0, mh + 2, s * mR * 0.9)); m.add(at(pinnacle(M, 0.35, 2.4), 0, mh + 2.2, s * mR * 0.9)); }
    m.add(at(blk(0.8, 0.8, mR * 1.8, M.gold), 0, mh + 1, 0));
    /* Spiegel: zur Mitte und nach oben zum Kern geneigt (Kern bei Höhe cy0 in Abstand mr) */
    const tilt = Math.atan2(cy0 - (mh + 1), mr);
    const dish = new THREE.Group(); dish.position.y = mh + 1; dish.rotation.z = PI / 2 - tilt;
    dish.add(mesh(dishG, B.mirror)); dish.add(at(mesh(backG, M.gold), 0, -0.55, 0));
    const spot = mesh(G('Lsds', () => new THREE.CircleGeometry(mR * 0.3, 16).rotateX(-PI / 2)), M.glowSoft, false); spot.position.y = 0.25; spot.userData.chargeAt = (i + 1) / (nM + 1); dish.add(spot);
    m.add(dish);
    /* Strahl zum Kern */
    const L = Math.hypot(mr, cy0 - (mh + 1));
    const beam = mesh(G('Lsbm' + L.toFixed(1), () => new THREE.CylinderGeometry(0.35, 0.9, L, 8, 1, true).translate(0, L / 2, 0)), B.beam, false);
    beam.position.y = mh + 1.4; beam.rotation.z = (PI / 2 - tilt); beam.userData.chargeAt = (i + 1) / (nM + 1); m.add(beam);
    g.add(m);
  }
  g.add(at(mesh(G('Lsri', () => new THREE.TorusGeometry(mr, 0.6, 6, 48).rotateX(PI / 2)), M.gold), 0, 1.2, 0));
  g.add(at(mesh(G('Lsro', () => new THREE.RingGeometry(mr - 2.2, mr + 2.2, 48).rotateX(-PI / 2)), B.violet), 0, 0.3, 0));
  /* Stufe II: Spitztürme innen; Stufe III: Fialenring außen, Heiligenschein */
  if (lv >= 2) for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; const t = spire(M, 2.4, 13, 10); t.position.set(Math.cos(a) * 22, 0, Math.sin(a) * 22); g.add(t); }
  if (lv >= 3) {
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + PI / 16; g.add(at(cy(1.1, 1.3, 2.5, M.hull, 6, 0, 1.25), Math.cos(a) * 47, 0, Math.sin(a) * 47)); g.add(at(pinnacle(M, 0.5, 4), Math.cos(a) * 47, 2.5, Math.sin(a) * 47)); }
    const hl = halo(M, 13, 24); hl.rotation.x = -PI / 2; hl.position.y = cy0 + 13; g.add(hl);
    const rg = mesh(G('Lsrg', () => new THREE.TorusGeometry(46, 0.25, 4, 64).rotateX(PI / 2)), B.teamSoft, false); rg.position.y = 1.0; g.add(rg);
  }
  return g;
});

/* ------------------------------------------------------------ eigene Modelle für Seherturm und Ägiswall
   extra22.js trägt die allgemeinen (verkleinertes Relais) nur ein, wenn eine Fraktion kein eigenes Modell hat. */

/* SEHERTURM – Frühwarnstation: Fünfeck-Plattform, achteckiges Sockelhaus, schlanker Schaft mit Rosen, oben auf
   einer Goldgabel das drehende „Seherauge“: ein großer Hohlspiegel mit Goldrand, im Brennpunkt ein Kristall.
   Stufe I: Spiegel 6,5. Stufe II: Spiegel 7,5, fünf Schildpylonen auf den Ecken. Stufe III: Spiegel 8,5,
   Strahlenkranz um den Schaft, Strebebögen von den Pylonen zum Schaft, Heiligenschein über dem Auge, Banner. */
regB('radar', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M);
  g.add(platform(M, r, { n: 5 }));
  const hb = 6, ht = [13, 16, 19][lv - 1], y1 = hb + ht, mR = [6.5, 7.5, 8.5][lv - 1];
  /* Sockelhaus: Achteckstumpf mit Gold-Gesims, Lanzetten auf vier Seiten */
  g.add(cy(6.2, 6.6, hb, M.hull, 8, PI / 8, hb / 2)); g.add(at(cy(6.7, 6.7, 0.5, M.gold), 0, hb, 0));
  for (let i = 0; i < 4; i++) { const a = i * PI / 2, wa = apo(6.2, 6.6, hb, 3) + 0.08; const gr = glassRow(M, [[0, 1.2, 1.6, 3.2]], 0.2); gr.position.set(Math.cos(a) * wa, 0, Math.sin(a) * wa); gr.rotation.y = -a; g.add(gr); }
  /* Schaft */
  g.add(cy(2.8, 3.4, ht, M.hull, 8, PI / 8, hb + ht / 2));
  for (const f of [0.08, 0.5, 0.92]) g.add(at(cy(3.5, 3.5, 0.5, M.gold), 0, hb + ht * f, 0));
  for (let i = 0; i < 2; i++) { const a = i * PI + PI / 8; const ro = rose(M, 1.5, 8); ro.position.set(Math.cos(a) * 3.15, hb + ht * 0.7, Math.sin(a) * 3.15); ro.rotation.y = PI / 2 - a; g.add(ro); }
  g.add(at(cy(4.4, 3.2, 1.4, M.hull), 0, y1 + 0.7, 0)); g.add(at(cy(4.6, 4.6, 0.4, M.gold), 0, y1 + 1.5, 0));
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; g.add(at(pinnacle(M, 0.3, 2), Math.cos(a) * 4.2, y1 + 1.6, Math.sin(a) * 4.2)); }
  /* Seherauge: dreht um Y */
  const eye = new THREE.Group(); eye.position.y = y1 + 1.7; eye.userData.spin = { axis: 'y', speed: 0.4 }; g.add(eye);
  eye.add(at(cy(2.2, 2.6, 1.2, M.gold), 0, 0.6, 0));
  for (const s of [-1, 1]) { eye.add(at(blk(0.8, mR * 0.9 + 1.2, 1.0, M.gold), s * (mR + 0.7), mR * 0.45 + 0.6, 0)); eye.add(at(blk(1.1, 0.4, 1.3, M.gold), s * (mR + 0.7), mR * 0.9 + 1.2, 0)); }
  eye.add(rod([-(mR + 0.7), 1.0, 0], [mR + 0.7, 1.0, 0], 0.7, 0.7, M.gold));
  const mir = new THREE.Group(); mir.position.y = mR * 0.9 + 0.4; mir.rotation.x = PI / 2 - 0.4; eye.add(mir);
  const capG = G('Lrdm' + mR, () => { const Rs = mR * 1.6, th = Math.asin(1 / 1.6), s = new THREE.SphereGeometry(Rs, 16, 4, 0, TAU, 0, th); s.translate(0, -Rs * Math.cos(th), 0); s.scale(1, -1, 1); const nn = s.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i)); return s; });
  mir.add(mesh(capG, B.mirror));   /* gespiegelt statt gedreht: die hohle Seite ist Vorderseite */
  mir.add(at(mesh(G('Lrdb' + mR, () => new THREE.CylinderGeometry(mR * 1.0, mR * 0.7, 0.8, 16)), M.gold), 0, -0.5, 0));
  mir.add(mesh(G('Lrdr' + mR, () => new THREE.TorusGeometry(mR, mR * 0.05, 3, 24).rotateX(PI / 2)), M.gold));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + PI / 2; mir.add(rod([Math.cos(a) * mR * 0.95, 0, Math.sin(a) * mR * 0.95], [0, mR * 0.75, 0], 0.22, 0.22, M.gold)); }
  const cr = mesh(G('Lrdc', () => new THREE.OctahedronGeometry(1, 0).scale(0.8, 1.5, 0.8)), X.crystal); cr.position.y = mR * 0.8; mir.add(cr);
  mir.add(at(glowSprite(M, 5), 0, mR * 0.8, 0));
  /* Stufe II: Pylonen auf den Ecken */
  const P = octPoly(r * 0.97 * 0.74, 0, 5);
  if (lv >= 2) {
    for (const [x, z] of P) { const p = pylon(M, lv >= 3 ? 9 : 7, 1.1); p.position.set(x, 0, z); g.add(p); }
  }
  /* Stufe III: Strahlenkranz, Strebebögen, Heiligenschein, Banner */
  if (lv >= 3) {
    const sb = sunburst(M, 5.5, 12, 0.12); sb.position.y = hb + ht * 0.38; g.add(sb);
    P.forEach(([x, z], i) => { const a = i / 5 * TAU, fb = buttress(M, [Math.hypot(x, z) - 0.5, 7.5], [3.4, hb + ht * 0.3], 0.35); fb.rotation.y = -a; g.add(fb); });
    const hl = halo(M, 4.5, 16); hl.rotation.x = -PI / 2; hl.position.y = y1 + mR * 2 + 4; g.add(hl);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; const bn = tbanner(M, 1.6, 4.6, i); bn.position.set(Math.cos(a) * 7.0, hb - 0.4, Math.sin(a) * 7.0); bn.rotation.y = -a + PI / 2; g.add(bn); }
  }
  return g;
});

/* ÄGISWALL – Schildwall: langgestreckte Sechseck-Plattform, darauf eine Kapellenmauer mit Buntglas zwischen zwei
   Bastionstürmen mit Kristallkronen; ein Spitzbogen aus Gold verbindet die Turmköpfe, in ihm hängt der Emitter-
   kristall (pulsiert). Das Feld selbst zeichnet entities.js. Stufe II: höhere Türme, Strebepfeiler mit Strebebögen,
   Banner an der Mauer. Stufe III: Heiligenschein um den Kristall, Fialenkamm auf der Mauer, höchste Türme. */
regB('wall', (M, d, lv) => {
  const g = new THREE.Group(), r = d.r, X = xm(M), B = xb(M), ph = [8, 9.5, 11][lv - 1], tx = 8.2;
  g.add(platform(M, r, { n: 6, sz: 0.62 }));
  /* Kapellenmauer */
  g.add(at(blk(2 * tx - 3, 4.6, 3.2, M.hull), 0, 2.3, 0)); g.add(at(blk(2 * tx - 2.6, 0.5, 3.8, M.gold), 0, 4.7, 0)); g.add(at(blk(2 * tx - 2.6, 0.5, 3.6, M.hull2), 0, 0.3, 0));
  for (const s of [-1, 1]) { const gr = glassRow(M, row(4, -5, 5, 1.0, 1.1, 2.6), 0.2); gr.position.z = s * 1.67; gr.rotation.y = -s * PI / 2; g.add(gr); }
  g.add(at(blk(2 * tx - 4, 0.15, 0.3, B.team), 0, 4.98, 1.4));
  /* Bastionstürme mit Kristallkronen */
  for (const s of [-1, 1]) {
    const t = bastionTower(M, 2.3, ph); t.position.x = s * tx; g.add(t);
    const c = mesh(G('Lwc', () => new THREE.OctahedronGeometry(1, 0).scale(1.0, 2.0, 1.0)), X.crystal); c.position.set(s * tx, ph + 2.6, 0); g.add(c);
    const rg = mesh(G('Lwr2', () => new THREE.TorusGeometry(1.7, 0.14, 4, 16).rotateX(PI / 2)), M.glowSoft, false); rg.position.set(s * tx, ph + 2.6, 0); rg.userData.pulse = { amp: 0.07, speed: 1.6 }; g.add(rg);
  }
  /* Spitzbogen zwischen den Türmen, darin der Emitterkristall */
  const ah = 6 + lv;
  g.add(at(archTube(M, 2 * tx, ah, 0.45, M.gold), 0, ph + 0.3, 0));
  const ey = ph + 0.3 + ah - 3.2;
  g.add(rod([0, ph + 0.3 + ah - 0.4, 0], [0, ey + 1.8, 0], 0.18, 0.18, M.gold));
  const em = mesh(G('Lwe', () => new THREE.OctahedronGeometry(1, 0).scale(1.1, 1.9, 1.1)), X.crystal); em.position.y = ey; em.userData.pulse = { amp: 0.1, speed: 2.4 }; g.add(em);
  g.add(at(glowSprite(M, 6), 0, ey, 0));
  /* Stufe II: Strebepfeiler mit Strebebögen an den Turmaußenseiten, Banner */
  if (lv >= 2) for (const s of [-1, 1]) {
    const p = pier(M, 1.2, ph * 0.55, 1.6); p.position.x = s * (tx + 5); g.add(p);
    const fb = buttress(M, [tx + 5, ph * 0.55], [tx + 2.3, ph * 0.85], 0.32); fb.scale.x = s; g.add(fb);
    const bn = tbanner(M, 1.5, 4.2, s); bn.position.set(s * 3.2, 4.4, 1.9); g.add(bn);
  }
  /* Stufe III: Heiligenschein um den Kristall, Fialenkamm */
  if (lv >= 3) {
    const hl = halo(M, 2.6, 12); hl.position.y = ey; g.add(hl);
    for (let i = 0; i < 5; i++) g.add(at(pinnacle(M, 0.35, 2.2), -5 + i * 2.5, 4.95, 0));
  }
  return g;
});
