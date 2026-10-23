/* =====================================================================
   THE ALLIANCE – Stationen. Formensprache wie die Schiffe (Halo/UNSC): militärische Orbitalanlagen aus geschichteten,
   kantigen Panzerplatten (hellgrau/grau, olivgraue Akzente), achteckige Naben statt runder Kuppeln, gestufte Aufbauten
   mit Fensterschlitzen, Gittergerüste, Andockklammern, Punktverteidigung (PDC), Archer-Raketenfelder, Antennen und
   Radarschüsseln. Weiße Kennungen »ODP-…«. Die Teamfarbe (M.trim) liegt als Streifen auf den Decks und Flanken, damit
   man die Gebäude eines Spielers auch von oben erkennt.
   Lesbarkeit aus der Spielkamera (~55° von oben): jede Station hat einen klaren Umriss und ein eigenes Leuchtelement
   (Reaktor blau hinter Panzerschlitzen, Raffinerie bernsteinfarbene Schmelze, Schild tiefblaue Emitterfelder,
   Exodus-Tor blauweißes Portalfeld). Positionslichter ruhig und langsam.
   Mitte im Ursprung, oben +Y, Grundfläche im Kreis d.r. Zum Schluss verschmilzt bake() alle unbewegten Teile je
   Material zu einem Mesh: eine Station kostet so nur wenige Zeichenaufrufe (Android).
   ===================================================================== */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { registerB, mesh, at, blk, cyl, lathe, antenna, strip, decal, windows } from '../kit.js';
import { fx, hl, bore, pdc } from '../factions/alliance.js';

const PI = Math.PI, TAU = PI * 2;
const C = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/* ------------------------------------------------------------ Materialien */
/* Schiffsmaterialien (fx) plus Stationsmaterialien: Geschützmetall, Beschleunigerschiene, Reaktorkern, Kuppelglas,
   Portalfeld des Exodus-Tors (Wirbeltextur, additiv) */
function sm(M) {
  if (M._ast) return M._ast;
  const F = fx(M), std = (col, met, rough) => new THREE.MeshStandardMaterial({ map: M.hull.map, bumpMap: M.hull.bumpMap, bumpScale: 0.7, color: col, metalness: met, roughness: rough });
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  { const x = cv.getContext('2d'), c = 256;
    const gr = x.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(225,242,255,0.95)'); gr.addColorStop(0.18, 'rgba(150,212,255,0.8)'); gr.addColorStop(0.55, 'rgba(60,140,255,0.5)'); gr.addColorStop(0.9, 'rgba(40,100,240,0.3)'); gr.addColorStop(1, 'rgba(40,100,240,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    x.lineCap = 'round';
    for (let arm = 0; arm < 6; arm++) for (let k = 0; k < 3; k++) {
      x.strokeStyle = `rgba(${200 + k * 20},${230 + k * 8},255,${0.22 - k * 0.05})`; x.lineWidth = 14 - k * 4; x.beginPath();
      for (let i = 0; i <= 60; i++) { const t = i / 60, a = arm / 6 * TAU + t * 3.4 + k * 0.08, r = 20 + t * 225; x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
      x.stroke();
    }
    for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(190,230,255,0.18)'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, 70 + i * 45, 0, TAU); x.stroke(); }
  }
  const pt = new THREE.CanvasTexture(cv); pt.colorSpace = THREE.SRGBColorSpace;
  M._ast = Object.assign({}, F, {
    gun: std('#59616b', 0.6, 0.45),
    team: new THREE.MeshStandardMaterial({ color: M.trim.color, metalness: 0.15, roughness: 0.75, emissive: M.trim.color, emissiveIntensity: 0.3 }),
    rail: new THREE.MeshBasicMaterial({ color: C('#4aa8ff', 1.5) }),
    core: new THREE.MeshBasicMaterial({ color: C('#7fd0ff', 1.9) }),
    coreHot: new THREE.MeshBasicMaterial({ color: C('#d8f2ff', 2.2) }),
    dome: new THREE.MeshStandardMaterial({ color: '#1d4f8a', metalness: 0.3, roughness: 0.2, emissive: '#2a7dff', emissiveIntensity: 0.55 }),
    field: new THREE.MeshBasicMaterial({ map: pt, color: C('#ffffff', 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    off: new THREE.MeshStandardMaterial({ color: '#1a2a3c', metalness: 0.6, roughness: 0.3, emissive: '#0a2a55', emissiveIntensity: 0.4 })
  });
  return M._ast;
}

/* ------------------------------------------------------------ Bausteine */
/* Fasenkasten: Quader mit abgeschrägten Kanten und Ecken (44 Dreiecke statt ~300 bei box), Box-Projektion der Platten-
   textur; Geometrie je Maß zwischengespeichert */
const GEO = new Map();
function cbGeo(w, h, d, c) {
  c = Math.max(0.02, Math.min(c, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const key = [w, h, d, c].map(v => v.toFixed(2)).join('|');
  let g = GEO.get(key); if (g) return g;
  const p = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) p.push(
    new THREE.Vector3(x * w / 2, y * (h / 2 - c), z * (d / 2 - c)), new THREE.Vector3(x * (w / 2 - c), y * h / 2, z * (d / 2 - c)), new THREE.Vector3(x * (w / 2 - c), y * (h / 2 - c), z * d / 2));
  g = new ConvexGeometry(p);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = new Float32Array(pos.count * 2), o = (w * 7.3 + h * 3.1 + d * 5.7) % 1;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i)), x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
    uv[i * 2] = u / 30 + o; uv[i * 2 + 1] = v / 30 + o * 0.7;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  GEO.set(key, g); return g;
}
function cb(w, h, d, mat, c = Math.min(w, h, d) * 0.16) { return mesh(cbGeo(w, h, d, c), mat); }
/* Lampe: kleines Ikosaeder; blink = Takte je Sekunde (langsam halten) */
const LG = {};
function lamp(M, r, col = 'light', blink = 0) {
  const m = mesh(LG[r] || (LG[r] = new THREE.IcosahedronGeometry(r, 0)), typeof col === 'string' ? M[col] : col, false);
  if (blink) m.userData.blink = blink; return m;
}
/* Leuchtschlitz (Fenster) als flacher Quader */
function slit(F, w, h, d) { return strip(null, w, h, d, F.slit); }
/* Fensterreihe aus kurzen Schlitzen (Maßstab: einzelne Fenster statt Leuchtbalken), entlang X oder Z */
function slits(F, len, h, axis = 'x', seg = 2.2, fill = 0.62) {
  const g = new THREE.Group(), n = Math.max(1, Math.round(len / seg)), s = len / n;
  for (let i = 0; i < n; i++) { if (i % 5 === 3) continue; const c = -len / 2 + s * (i + 0.5); g.add(axis === 'x' ? at(slit(F, s * fill, h, 0.12), c, 0, 0) : at(slit(F, 0.12, h, s * fill), 0, 0, c)); }
  return g;
}
/* Balken zwischen zwei Punkten (Gitter, Streben) */
const ZA = new THREE.Vector3(0, 0, 1);
function beam(mat, a, b, t, t2 = t) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const m = blk(t, t2, len, mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(ZA, dir.normalize()); return m;
}
/* Objekt auf Kreisbahn setzen: Winkel a (0 = +X, π/2 = +Z), Radius r; lokales +Z zeigt nach außen */
function rad(o, a, r, y = 0) { o.position.set(Math.cos(a) * r, y, Math.sin(a) * r); o.rotation.y = PI / 2 - a; return o; }
/* Gittermast entlang Z: Querschnitt w × h, Felder etwa bay lang; Gurte, Rahmen, Diagonalen in Seiten und Deck */
function truss(mat, len, w, h, bay, t = 0.5, top = true) {
  const g = new THREE.Group(), n = Math.max(1, Math.round(len / bay)), b = len / n;
  for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) g.add(at(blk(t * 1.5, t * 1.5, len + t, mat), x, y, 0));
  for (let i = 0; i <= n; i++) {
    const z = -len / 2 + i * b;
    for (const y of [-h / 2, h / 2]) g.add(at(blk(w, t, t, mat), 0, y, z));
    for (const x of [-w / 2, w / 2]) g.add(at(blk(t, h, t, mat), x, 0, z));
  }
  for (let i = 0; i < n; i++) {
    const z0 = -len / 2 + i * b, z1 = z0 + b, s = i % 2 ? 1 : -1;
    for (const x of [-w / 2, w / 2]) g.add(beam(mat, [x, -h / 2 * s, z0], [x, h / 2 * s, z1], t * 0.7));
    if (top) g.add(beam(mat, [-w / 2 * s, h / 2, z0], [w / 2 * s, h / 2, z1], t * 0.7));
  }
  return g;
}
/* Deckplatten: Raster flacher Panzerplatten (geschichtete Halo-Optik) auf der Fläche x0..x1 × z0..z1 in Höhe y */
function deck(F, g, x0, x1, z0, z1, y, nx, nz, seed = 1, gap = 0.5) {
  const w = (x1 - x0) / nx, d = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const k = (i * 7 + j * 3 + seed) % 5, h = 0.35 + (k % 3) * 0.15, mat = k === 0 ? F.olive : k === 3 ? F.hull : F.armor;
    g.add(at(cb(w - gap, h, d - gap, mat, 0.18), x0 + w * (i + 0.5), y + h / 2, z0 + d * (j + 0.5)));
  }
}
/* kleine Aufbauten aus einfachen Quadern (12 Dreiecke) */
function greeb(F, g, x0, x1, z0, z1, y, n, seed = 1, s = 1) {
  let q = seed * 9301 + 49297;
  const r = () => (q = (q * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const w = s * (0.5 + r()), d = s * (0.5 + r() * 1.5), h = s * (0.25 + r() * 0.6); g.add(at(blk(w, h, d, r() < 0.35 ? F.dark : r() < 0.5 ? F.olive : F.armor), x0 + r() * (x1 - x0), y + h / 2, z0 + r() * (z1 - z0))); }
}
/* Teamstreifen (Spielerfarbe), matt, damit das Streiflicht von oben nicht überstrahlt */
function tb(M, w, h, d) { return mesh(new THREE.BoxGeometry(w, h, d), sm(M).team); }
/* Kennung auf dem Deck (von oben lesbar), Schriftzeile entlang X, gedreht um ry */
function numTop(g, txt, x, y, z, s, ry = 0) { const d = decal(txt, s * 4.2, s, '#e9eef4'); d.rotation.set(-PI / 2, 0, ry); d.position.set(x, y, z); g.add(d); return d; }
/* Kennung an einer Wand, Normale +Z (für rad()-Gruppen) */
function numZ(g, txt, x, y, z, s) { const d = decal(txt, s * 4.2, s, '#e9eef4'); d.rotation.set(0, 0, 0); d.position.set(x, y, z); g.add(d); return d; }
/* Mast mit Querstreben und langsamem Licht (kit.antenna, Blinken gedrosselt) */
function mast(M, h, r) { const a = antenna(M, h, r); a.traverse(o => { if (o.userData.blink) o.userData.blink = 0.3; }); return a; }
/* Parabolschüssel (facettiert): Drehteller, Gabel, Schale mit Rand, Speisehorn auf drei Streben. Achse um tilt aus der
   Senkrechten nach +Z geneigt. Kopf = Group (für sway/spin) */
function dishT(M, r, tilt = 0.75, seg = 14) {
  const F = fx(M), g = new THREE.Group(), th = r * 0.06, a = 0.3 / r, prof = [];
  for (let i = 0; i <= 4; i++) { const x = Math.max(0.01, r * i / 4); prof.push([x, a * x * x - th]); }
  for (let i = 4; i >= 0; i--) { const x = Math.max(0.01, r * i / 4); prof.push([x, a * x * x]); }
  g.add(at(cyl(r * 0.2, r * 0.26, r * 0.22, F.dark, 10), 0, r * 0.11, 0, -PI / 2));
  for (const s of [-1, 1]) g.add(at(cb(r * 0.09, r * 0.5, r * 0.24, F.armor, r * 0.03), s * r * 0.2, r * 0.42, 0));
  const t = new THREE.Group(); t.position.y = r * 0.58; t.rotation.x = tilt; g.add(t);
  t.add(at(cb(r * 0.34, r * 0.16, r * 0.34, F.dark, r * 0.04), 0, -r * 0.06, 0));
  t.add(lathe(prof, F.hull, seg));
  const f = r * 0.75;
  for (let i = 0; i < 3; i++) { const b = i / 3 * TAU; t.add(beam(F.dark, [Math.cos(b) * r * 0.92, a * r * r * 0.85, Math.sin(b) * r * 0.92], [0, f, 0], r * 0.035)); }
  t.add(at(cyl(r * 0.07, r * 0.1, r * 0.22, F.dark, 8), 0, f, 0, -PI / 2));
  t.add(at(lamp(M, r * 0.05, 'light'), 0, f + r * 0.13, 0));
  return g;
}
/* Strahlgeschütz (Lanze): Drehring, gepanzertes Keilgehäuse, n Läufe mit Spulenringen und blauer Mündung.
   Kopf = Group mit userData.aim (Läufe nach +Z). s ≈ halbe Gehäusebreite; heavy = schwere Ausführung */
function lance(M, s, n = 1, heavy = false, phase = 0, lk = 0) {
  const F = fx(M), g = new THREE.Group();
  g.add(at(cyl(s * 1.15, s * 1.3, s * 0.5, F.dark, 12), 0, s * 0.25, 0, -PI / 2));
  const head = new THREE.Group(); head.position.y = s * 0.5; head.userData.aim = { phase }; g.add(head);
  const w = s * (n > 1 ? 2.3 : 1.9) * (heavy ? 1.12 : 1), hh = s * (heavy ? 1.25 : 1.05);
  head.add(hl([[-s * 1.25, w * 0.92, hh * 0.9, s * 0.15, s * 0.3, hh * 0.45], [s * 0.4, w, hh, s * 0.15, s * 0.35, hh * 0.5], [s * 1.2, w * 0.8, hh * 0.62, s * 0.12, s * 0.2, hh * 0.31]], F.hull));
  head.add(at(cb(w * 0.75, s * 0.18, s * 1.3, F.armor, s * 0.05), 0, hh + s * 0.09, -s * 0.15));
  head.add(at(tb(M, w * 0.8, s * 0.1, s * 0.22), 0, hh + s * 0.2, -s * 0.15));
  for (const sx of [-1, 1]) {
    head.add(at(cb(s * 0.2, hh * 0.7, s * 1.6, F.armor, s * 0.05), sx * (w / 2 + s * 0.08), hh * 0.45, -s * 0.2));
    head.add(at(slit(F, s * 0.06, s * 0.1, s * 0.9), sx * (w / 2 + s * 0.2), hh * 0.62, -s * 0.2));
  }
  const len = s * (lk || (heavy ? 3.9 : 3.2)), br = s * (heavy ? 0.3 : 0.22), y0 = hh * 0.48;
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? (i - (n - 1) / 2) * w * 0.48 : 0, z0 = s * 0.9;
    head.add(at(cyl(br, br * 0.85, len, F.dark, 8), x, y0, z0 + len / 2));
    head.add(at(cb(br * 3.2, br * 3, s * 0.8, F.armor, br * 0.5), x, y0, z0 + s * 0.3));
    for (let k = 0; k < (heavy ? 4 : 3); k++) head.add(at(cyl(br * 1.3, br * 1.3, len * 0.04, k % 2 ? F.armor : F.hull, 8), x, y0, z0 + len * (0.3 + k * 0.17)));
    head.add(at(cyl(br * 1.25, br * 1.4, s * 0.3, F.armor, 8), x, y0, z0 + len - s * 0.1));
    head.add(at(cyl(br * 0.6, br * 0.6, s * 0.12, F.rail, 8), x, y0, z0 + len + s * 0.06));
    if (heavy) head.add(at(strip(null, br * 0.8, br * 0.5, len * 0.5, F.bore), x, y0 + br * 1.05, z0 + len * 0.55));
  }
  return g;
}
/* Punktverteidigung mit Zielkennzeichen */
function pdcA(M, s, phase) { const p = pdc(M, s); p.userData.aim = { phase }; return p; }
/* Archer-Raketenfeld, sparsam: Platte und Klappenraster aus einfachen Quadern */
function archerS(M, w, d, n, m) {
  const F = fx(M), g = new THREE.Group(); g.add(at(cb(w, 0.7, d, F.armor, 0.15), 0, 0.35, 0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) g.add(at(blk(w / n * 0.66, 0.16, d / m * 0.66, F.dark), -w / 2 + w / n * (i + 0.5), 0.76, -d / 2 + d / m * (j + 0.5)));
  return g;
}
/* Schildemitter-Feld (wie bei den Schiffen), sparsam: Rahmen mit tiefblauem Gitter, Normale +Z */
function emitterS(M, w, h, cols = 4, rows = 2) {
  const F = fx(M), g = new THREE.Group(); g.add(at(cb(w, h, 0.7, F.armor, 0.15), 0, 0, 0));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.add(at(blk(w / cols * 0.72, h / rows * 0.7, 0.2, F.shield), -w / 2 + w / cols * (i + 0.5), -h / 2 + h / rows * (j + 0.5), 0.38));
  return g;
}

/* ------------------------------------------------------------ Verschmelzen */
/* Alle Meshes ohne Animation werden je Material zu einem Mesh zusammengefasst (Lage relativ zur Wurzel). Teilbäume mit
   Kennzeichen (aim, spin, pulse, charge …) bleiben beweglich und werden in sich verschmolzen. */
const LIVE = ['flame', 'blink', 'spin', 'pulse', 'orbit', 'bob', 'sway', 'aim', 'charge', 'chargeAt', 'berth', 'dock'];
const isLive = o => LIVE.some(k => o.userData[k] !== undefined && o.userData[k] !== false);
function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), buckets = new Map();
  const walk = o => {
    for (const c of [...o.children]) {
      if (isLive(c)) { bake(c); continue; }
      if (c.isMesh && !c.children.length && !c.material.transparent) { let b = buckets.get(c.material); if (!b) buckets.set(c.material, b = { list: [], shadow: false }); b.list.push(c); b.shadow ||= c.castShadow; }
      else walk(c);
    }
  };
  walk(root);
  const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [mat, b] of buckets) {
    if (b.list.length < 2) continue;
    let cnt = 0; for (const o of b.list) cnt += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    const P = new Float32Array(cnt * 3), N = new Float32Array(cnt * 3), U = new Float32Array(cnt * 2); let k = 0;
    for (const o of b.list) {
      const gg = o.geometry; if (!gg.attributes.normal) gg.computeVertexNormals();
      m4.multiplyMatrices(inv, o.matrixWorld); n3.getNormalMatrix(m4);
      const flip = m4.determinant() < 0, pos = gg.attributes.position, nor = gg.attributes.normal, uv = gg.attributes.uv, idx = gg.index, n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) for (let j = 0; j < 3; j++) {
        const vi = idx ? idx.getX(i + (flip ? [0, 2, 1][j] : j)) : i + (flip ? [0, 2, 1][j] : j);
        v.fromBufferAttribute(pos, vi).applyMatrix4(m4); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
        v.fromBufferAttribute(nor, vi).applyMatrix3(n3).normalize(); N[k * 3] = v.x; N[k * 3 + 1] = v.y; N[k * 3 + 2] = v.z;
        if (uv) { U[k * 2] = uv.getX(vi); U[k * 2 + 1] = uv.getY(vi); }
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.computeBoundingSphere();
    root.add(mesh(geo, mat, b.shadow));
    for (const o of b.list) o.parent.remove(o);
  }
  const prune = o => { for (const c of [...o.children]) { prune(c); if (!c.isMesh && !c.children.length && !isLive(c)) o.remove(c); } };
  prune(root);
  return root;
}
/* registrieren mit anschließendem Verschmelzen */
function reg(role, fn) { registerB('alliance', role, (M, d, lv) => bake(fn(M, d, lv))); }

/* ================================================================== Kommandobasis
   Orbitalverteidigungsplattform (Vorbild Cairo): achteckige Panzernabe mit gestuftem Kommandoturm (Brücke mit
   Fensterband, Antennen, Radar), vier gepanzerte Arme – an ±X Hangarmodule mit leuchtender Hangaröffnung, an ±Z
   Andockrahmen –, dazwischen Versorgungsmodule mit Tanks. Teamstreifen auf den Armdecks.
   Stufe I unbewaffnet. Stufe II: achteckiger Außenring aus Panzergängen mit Plattformen an den Diagonalen, zwei
   Lanzentürme. Stufe III: vier Türme, schwere MAC (dunkler Rechtecklauf mit blauer Beschleunigerschiene) auf einem
   Drehkranz um den Turm, vier PDC, Archer-Felder auf den Andockarmen, Schildemitter am Außenring. */
reg('base', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M);
  /* Nabe */
  g.add(lathe([[0.01, -20], [8, -18], [16, -12], [23, -6], [26, -4], [26, 3.5], [24.5, 5], [20, 5], [20, 8], [17, 9.5], [0.01, 9.5]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[25.8, -3.4], [26.7, -2.8], [26.7, 1.2], [25.8, 1.8], [25.8, -3.4]], F.armor, 8, { phi0: PI / 8 }));
  g.add(lathe([[16.2, -12.6], [17.2, -12], [23.6, -6.4], [22.6, -7], [16.2, -12.6]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(1.2, 2.4, 8, F.dark, 8), 0, -23, 0, -PI / 2)); g.add(at(lamp(M, 0.6, 'red', 0.3), 0, -27.2, 0));
  g.add(at(cb(11, 0.5, 11, F.armor, 1.5), 0, 9.75, 0));
  for (let k = 0; k < 8; k++) {
    const a = k * PI / 4, f = new THREE.Group(); rad(f, a, 0); g.add(f);
    f.add(at(slits(F, 9, 0.38), 0, 6.9, 18.5)); f.add(at(slits(F, 6, 0.3, 'x', 1.6), 0, 6.1, 18.5));
    f.add(at(cb(12, 0.5, 3.4, k % 2 ? F.armor : F.olive, 0.15), 0, 5.25, 22.1));
    f.add(at(tb(M, 11, 0.2, 0.9), 0, 5.55, 24));
    if (k % 2) { f.add(at(slits(F, 12, 0.35), 0, 2.2, 24.1)); f.add(at(slits(F, 12, 0.35, 'x', 1.8), 0, 0.9, 24.1)); f.add(at(windows(M, 13, 1.2), 0, -1.4, 24.15)); }
    f.add(at(lamp(M, 0.35, 'light'), 0, 9.8, 16.8));
    f.add(at(blk(2.4, 0.6, 1.6, F.dark), 3.5, 10.3, 13)); f.add(at(blk(1.2, 0.9, 2.2, F.armor), -3, 10.4, 13.5));
  }
  /* Kommandoturm */
  const T = new THREE.Group(); T.position.y = 10; g.add(T);
  T.add(at(cb(15, 6, 15, F.hull, 2.8), 0, 3, 0));
  T.add(at(cb(11.5, 5.2, 11.5, F.armor, 2), 0, 8.6, 0));
  T.add(at(cb(15.5, 3, 9.5, F.hull, 1), 0, 12.7, 0));
  T.add(at(cb(7, 2.6, 6, F.hull, 1), 0, 15.5, -0.5));
  T.add(at(cb(16, 0.4, 10, F.armor, 0.15), 0, 14.4, 0));
  T.add(at(tb(M, 15, 0.2, 0.9), 0, 14.7, 4.3)); T.add(at(tb(M, 15, 0.2, 0.9), 0, 14.7, -4.3));
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Group(); f.rotation.y = k * PI / 2; T.add(f);
    f.add(at(slits(F, 9, 0.35), 0, 4.3, 7.52)); f.add(at(slits(F, 9, 0.35, 'x', 1.5), 0, 2.5, 7.52));
    f.add(at(slits(F, 7, 0.3, 'x', 1.4), 0, 9.6, 5.77));
    f.add(at(tb(M, 10, 0.6, 0.2), 0, 0.9, 7.55));
  }
  for (const s of [-1, 1]) { T.add(at(slits(F, 13.5, 0.6, 'x', 1.1, 0.8), 0, 13, s * 4.78)); T.add(at(slits(F, 7.5, 0.6, 'z', 1.1, 0.8), s * 7.78, 13, 0)); T.add(at(slit(F, 5, 0.3, 0.12), 0, 15.9, s * 3 - 0.5)); }
  T.add(at(mast(M, 11, 0.22), 1.6, 16.8, -1.6)); T.add(at(mast(M, 7, 0.18), -1.8, 16.8, 0.8));
  const rd = dishT(M, 2.6, 0.8); rd.position.set(-5.2, 14.6, -2.2); rd.userData.spin = { axis: 'y', speed: 0.35 }; T.add(rd);
  T.add(at(lamp(M, 0.4, 'red', 0.25), 7.6, 14.3, 4.6)); T.add(at(lamp(M, 0.4, 'green', 0.25), -7.6, 14.3, 4.6));
  /* Arme */
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2, hang = k % 2 === 0, A = new THREE.Group(); rad(A, a, 0); g.add(A);
    A.add(hl([[17, 13, 9, 1, 3, -0.5], [45, 13, 9, 1, 3, -0.5]], F.hull));
    deck(F, A, -3.9, 3.9, 20, 43, 4, 2, 4, k);
    for (const s of [-1, 1]) {
      A.add(at(tb(M, 1, 0.22, 26), s * 4.95, 4.1, 31));
      for (let i = 0; i < 3; i++) A.add(at(cb(0.5, 4.6, 7.4, i % 2 ? F.olive : F.armor, 0.12), s * 6.7, -1.4, 23 + i * 8));
      A.add(at(slits(F, 21, 0.35, 'z'), s * 6.56, 2.6, 31)); A.add(at(slits(F, 21, 0.3, 'z', 1.5), s * 6.56, 1.75, 31));
    }
    for (let i = 0; i < 4; i++) A.add(at(cb(11, 1, 1.4, F.armor, 0.2), 0, -5.2, 21 + i * 7));
    if (hang) {
      /* Hangarmodul */
      A.add(at(cb(22, 13, 12, F.hull, 1.5), 0, 0.5, 50));
      A.add(at(cb(19, 1, 9, F.armor, 0.3), 0, 7.4, 49.5));
      A.add(at(cb(15.5, 8, 0.8, F.dark, 0.2), 0, -0.6, 56));
      A.add(at(mesh(new THREE.BoxGeometry(13.5, 5.6, 0.2), F.hangar, false), 0, -0.8, 56.3));
      for (let i = 0; i < 3; i++) A.add(at(blk(13.6, 0.25, 0.3, F.dark), 0, -2.6 + i * 1.8, 56.45));
      A.add(at(tb(M, 16, 0.6, 0.2), 0, 4.4, 56.15));
      for (const s of [-1, 1]) {
        A.add(at(cb(1.4, 14, 13, F.armor, 0.3), s * 11.3, 0.5, 50));
        A.add(at(tb(M, 0.25, 1, 11), s * 12.05, 4.6, 50));
        A.add(at(slits(F, 8, 0.35, 'z'), s * 12.05, 2.6, 50));
        A.add(at(lamp(M, 0.4, s > 0 ? 'green' : 'red', 0.3), s * 8.4, 3.8, 56.4));
      }
      numTop(A, 'ODP-2207', 0, 7.95, 49.5, 2.6, k === 0 ? PI / 2 : -PI / 2);
      greeb(F, A, -9, -4, 45.5, 54, 7.9, 4, k + 3, 0.9);
    } else {
      /* Andockmodul mit Andockrahmen (Plattform, Portal mit Klammerbacken, Leitlichter) */
      A.add(at(cb(17, 10, 8, F.hull, 1.2), 0, -0.5, 48));
      A.add(at(cb(14, 1, 6, F.olive, 0.25), 0, 4.9, 48));
      A.add(at(tb(M, 12, 0.2, 0.9), 0, 5.5, 50.2));
      A.add(at(cyl(3, 3, 1.6, F.armor, 12), 0, -0.5, 52.6)); A.add(at(cyl(2.1, 2.1, 0.3, F.dark, 12), 0, -0.5, 53.4));
      const pl = truss(F.dark, 10, 12, 1.2, 3.4, 0.35); pl.position.set(0, -4.4, 57); A.add(pl);
      A.add(at(cb(13.6, 0.4, 9, F.armor, 0.1), 0, -3.6, 57.2));
      for (const s of [-1, 1]) {
        A.add(at(cb(1.6, 9, 1.8, F.armor, 0.3), s * 6.4, -0.4, 61.2));
        A.add(at(cb(2.6, 1.4, 2.4, F.hull, 0.3), s * 5.4, -0.5, 61.2));
        A.add(at(lamp(M, 0.32, F.amber), s * 4.2, -0.5, 61.3));
        for (let i = 0; i < 3; i++) A.add(at(lamp(M, 0.22, 'green'), s * 6.3, -3.2, 53.6 + i * 3));
        A.add(at(slits(F, 5, 0.35, 'z'), s * 8.56, 1.5, 48));
      }
      A.add(at(cb(14.4, 1.4, 1.8, F.armor, 0.3), 0, 4.3, 61.2));
      A.add(at(tb(M, 10, 0.4, 0.2), 0, 4.3, 62.15));
    }
  }
  /* Versorgungsmodule mit Tanks an den Diagonalen */
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2, V = new THREE.Group(); rad(V, a, 0); g.add(V);
    V.add(at(cb(10, 7, 9, F.armor, 1), 0, -1.5, 28));
    V.add(at(cb(8, 1, 7, F.hull, 0.3), 0, 2.4, 28));
    for (const z of [26.3, 29.7]) {
      V.add(at(cyl(1.4, 1.4, 7, k % 2 ? F.olive : F.hull, 10), 0, 4.3, z, 0, PI / 2));
      for (const x of [-2.2, 2.2]) V.add(at(cyl(1.55, 1.55, 0.5, F.dark, 10), x, 4.3, z, 0, PI / 2));
    }
    V.add(at(slits(F, 7, 0.3), 0, 0.6, 32.56));
    V.add(at(lamp(M, 0.3, 'light'), 3.6, 3.2, 31.6));
  }
  if (lv >= 2) {
    /* Außenring aus Panzergängen, Plattformen an den Diagonalen */
    const R = 50, segL = 2 * R * Math.sin(PI / 8), rm = R * Math.cos(PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * PI / 4, S = new THREE.Group(); rad(S, a, rm); g.add(S);
      S.add(at(cb(segL, 3.6, 4.4, F.hull, 0.6), 0, 0, 0));
      S.add(at(cb(segL * 0.86, 0.5, 3, k % 2 ? F.armor : F.olive, 0.15), 0, 2.05, 0));
      S.add(at(tb(M, segL * 0.7, 0.18, 0.8), 0, 2.4, 0));
      for (const z of [2.24, -2.24]) S.add(at(slits(F, segL * 0.6, 0.3), 0, 0.5, z));
      for (const s of [-1, 1]) S.add(at(cb(segL * 0.3, 2.4, 0.5, F.armor, 0.1), s * segL * 0.22, -0.4, 2.4));
      if (lv >= 3) for (const s of [-1, 1]) { const e = emitterS(M, 6, 2.2, 3, 1); e.position.set(s * segL * 0.22, -0.4, 2.85); S.add(e); }
      S.add(at(lamp(M, 0.3, 'light'), 0, 1.9, 2.3));
    }
    for (let k = 0; k < 4; k++) {
      const a = PI / 4 + k * PI / 2, J = new THREE.Group(); rad(J, a, R); g.add(J);
      J.add(lathe([[0.01, -4.5], [5, -5], [7.2, -2.6], [7.2, 1.6], [6.2, 2.6], [0.01, 2.6]], F.armor, 8, { phi0: PI / 8 }));
      J.add(at(tb(M, 8, 0.2, 0.8), 0, 2.7, -4.6));
      J.add(at(lamp(M, 0.4, k % 2 ? 'red' : 'green', 0.22), 0, -1, 7.3));
      /* Gitterverbindung zum Versorgungsmodul */
      const tr = truss(F.dark, 11, 2.2, 2.2, 3.6, 0.35); tr.position.set(0, -1, -13); J.add(tr);
      const armed = lv >= 3 || k % 2 === 0;
      if (armed) { const t = lance(M, 3, 2, false, k * 1.7); t.position.y = 2.6; J.add(t); }
      else { J.add(at(cb(6, 1.2, 6, F.hull, 0.4), 0, 3.2, 0)); greeb(F, J, -2.5, 2.5, -2.5, 2.5, 3.8, 4, k + 11, 0.8); }
    }
  }
  if (lv >= 3) {
    /* schwere MAC auf Drehkranz um den Turm */
    const mac = new THREE.Group(); mac.position.y = 9.5; mac.userData.aim = { phase: 0.6 }; g.add(mac);
    mac.add(lathe([[11, 0], [15.6, 0], [15.6, 1.4], [14.8, 2.2], [11, 2.2], [11, 0]], F.armor, 16));
    for (let i = 0; i < 12; i++) { const b = i / 12 * TAU; mac.add(at(blk(1.4, 0.5, 2.6, i % 3 ? F.dark : F.hull), Math.sin(b) * 13.3, 2.4, Math.cos(b) * 13.3, 0, b)); }
    mac.add(hl([[9, 10, 6, 0.6, 1.4, 5.2], [20, 10, 6.6, 0.6, 1.6, 5.5], [24, 8.4, 5.4, 0.5, 1.3, 5.6]], F.hull));
    mac.add(at(cb(8, 0.6, 9, F.armor, 0.2), 0, 9.05, 15.5));
    mac.add(at(tb(M, 7.4, 0.2, 1), 0, 9.45, 12.5)); mac.add(at(tb(M, 0.6, 0.2, 7), 0, 9.45, 16.5));
    for (const s of [-1, 1]) { mac.add(at(slits(F, 8, 0.4, 'z'), s * 5.05, 6.8, 15)); mac.add(at(cb(1.2, 4.6, 10, F.armor, 0.3), s * 5.4, 4.8, 15)); }
    mac.add(hl([[23, 5.4, 5.2, 0.6, 1, 5.6], [56, 4.6, 4.6, 0.5, 0.9, 5.6]], F.gun));
    for (let i = 0; i < 6; i++) mac.add(at(cb(6.4, 6.2, 1.3, i % 2 ? F.hull : F.armor, 0.5), 0, 5.6, 27 + i * 5.2));
    mac.add(at(mesh(new THREE.BoxGeometry(0.8, 0.25, 30), F.rail, false), 0, 8.05, 41));
    for (const s of [-1, 1]) mac.add(at(mesh(new THREE.BoxGeometry(0.25, 0.6, 26), F.rail, false), s * 2.45, 5.6, 42));
    const b = bore(M, 3, 3); b.position.set(0, 5.6, 56.4); mac.add(b);
    /* PDC auf den Endmodulen, Archer auf den Andockarmen */
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2, P = new THREE.Group(); rad(P, a, 0); g.add(P);
      const p = pdcA(M, 1.3, k * 2.1); p.position.set(5.5, k % 2 === 0 ? 7.9 : 5.4, k % 2 === 0 ? 46 : 46.2); P.add(p);
      if (k % 2) for (const s of [-1, 1]) { const ar = archerS(M, 3.2, 9, 2, 4); ar.position.set(s * 2, 4.6, 31.5); P.add(ar); }
    }
  }
  return g;
});

/* ------------------------------------------------------------ weitere Bausteine */
/* hin- und herfahrendes Teil entlang Z (Portalkran): bob wirkt auf eine um 90° gekippte Achse */
function slide(o, z, amp, speed) {
  const P = new THREE.Group(); P.position.z = z; P.rotation.x = PI / 2;
  const B = new THREE.Group(); B.userData.bob = { amp, speed, y0: 0 }; P.add(B);
  const W = new THREE.Group(); W.rotation.x = -PI / 2; W.add(o); B.add(W);
  return P;
}
/* stehender Tank: kantiger Zylinder (10 Seiten) mit Panzerbändern, Teamring, Ventilplatte */
function tank(M, r, h, mat) {
  const F = fx(M), g = new THREE.Group();
  g.add(lathe([[0.01, -h / 2], [r * 0.62, -h / 2], [r, -h / 2 + r * 0.38], [r, h / 2 - r * 0.38], [r * 0.62, h / 2], [0.01, h / 2]], mat, 10));
  for (const y of [-h * 0.22, h * 0.12]) g.add(lathe([[r - 0.05, y - 0.45], [r + 0.28, y - 0.3], [r + 0.28, y + 0.3], [r - 0.05, y + 0.45], [r - 0.05, y - 0.45]], F.armor, 10));
  g.add(lathe([[r - 0.05, h * 0.3 - 0.3], [r + 0.18, h * 0.3 - 0.25], [r + 0.18, h * 0.3 + 0.25], [r - 0.05, h * 0.3 + 0.3], [r - 0.05, h * 0.3 - 0.3]], sm(M).team, 10));
  g.add(at(cb(r * 0.9, 0.5, r * 0.9, F.armor, 0.15), 0, h / 2 + 0.15, 0));
  g.add(at(blk(0.5, 1.1, 0.5, F.dark), r * 0.25, h / 2 + 0.8, r * 0.1)); g.add(at(blk(0.9, 0.4, 0.4, F.dark), -r * 0.2, h / 2 + 0.6, -r * 0.2));
  return g;
}
/* Kühlflügel entlang +Z ab z = 0: Rückgrat, dunkle Platte mit hellen Rippen, blaue Leitung */
function radWing(M, len, w) {
  const F = sm(M), g = new THREE.Group();
  g.add(at(cb(1.8, 1.8, len, F.armor, 0.35), 0, 0, len / 2));
  for (const s of [-1, 1]) {
    g.add(at(cb(w / 2 - 0.8, 0.3, len - 1, F.dark, 0.08), s * (w / 4 + 0.5), 0, len / 2 + 0.3));
    const n = Math.round(len / 1.5);
    for (let i = 0; i < n; i++) g.add(at(blk(w / 2 - 1.1, 0.22, 0.32, F.hull), s * (w / 4 + 0.5), 0.24, 1.2 + i * (len - 1.8) / n));
    g.add(at(blk(0.3, 0.5, len - 1, F.armor), s * (w / 2 + 0.05), 0.05, len / 2 + 0.3));
  }
  g.add(at(mesh(new THREE.BoxGeometry(0.4, 0.2, len - 2), F.rail, false), 0, 0.95, len / 2));
  return g;
}

/* ================================================================== Werft
   Orbitaldock wie über Reach: zwei Seitenwände aus Gittermasten mit gepanzerten Pylonen, Laufschienen oben, darauf
   Portalkräne (Brücke mit Teamstreifen, Laufkatze, Arbeitslicht), die über das Schiff fahren. Hinten der Kopfbau mit
   Leitstand, Fensterbändern zum Dock, Mast und Radar. Andockarme mit Klammerbacken halten das Schiff, Bodenrippen
   bilden das Trockendock. Stufen: Rahmen 68/82/96 lang (Bauplatz 55/75/90), Kräne 1/2/3, Andockarme 2/3/4 je Seite;
   ab Stufe II Fertigungsmodule außen, Stufe III zusätzlich Kühlflügel und Flutlichtmasten. */
reg('yard', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M);
  const L = [0, 76, 86, 92][lv], W = [0, 13, 16, 18][lv], yb = [0, -10, -12, -16][lv], yt = [0, 8, 9, 10][lv];
  const z0 = -L / 2 + 8, z1 = L / 2, zl = z1 - z0, zc = (z0 + z1) / 2, hh = yt - yb, ym = (yt + yb) / 2;
  /* Seitenwände */
  for (const s of [-1, 1]) {
    const x = s * (W + 2.5);
    const tr = truss(F.armor, zl, 5, hh, 8, 0.55, false); tr.position.set(x, ym, zc); g.add(tr);
    g.add(at(cb(2.6, 0.9, zl, F.armor, 0.25), x, yt + 0.45, zc));
    g.add(at(tb(M, 0.2, 0.5, zl - 2), x + s * 1.35, yt + 0.45, zc));
    for (let z = z0 + 3; z < z1 - 1; z += 10) g.add(at(lamp(M, 0.3, 'light'), x + s * 2.7, yt + 0.3, z));
    const np = lv + 1;
    for (let i = 0; i < np; i++) {
      const z = z0 + 4 + i * (zl - 8) / (np - 1);
      g.add(at(cb(6.4, hh, 4.6, F.hull, 0.8), x, ym, z));
      g.add(at(cb(7, 2.4, 5.2, F.armor, 0.4), x, yb + 1.4, z));
      g.add(at(cb(7, 1.4, 5.2, F.olive, 0.3), x, yt - 1.2, z));
      for (const fx2 of [-1, 1]) for (let k = 0; k < 3; k++) g.add(at(slits(F, 3.2, 0.3, 'z', 1.05), x + fx2 * 3.26, yt - 3.2 - k * 1.3, z));
      g.add(at(tb(M, 0.2, hh * 0.45, 0.9), x + s * 3.26, ym - 1, z));
      g.add(at(lamp(M, 0.35, i === np - 1 ? 'green' : 'light', i === np - 1 ? 0.25 : 0), x + s * 3.3, yb + 2.9, z + 2.4));
    }
    /* Andockarme mit Klammerbacken */
    const na = lv + 1, al = [0, 4.5, 6.5, 2.5][lv];
    for (let i = 0; i < na; i++) {
      const z = z0 + 9 + (i + 0.5) * (zl - 18) / na;
      g.add(at(cb(al + 1.2, 1.3, 1.8, F.armor, 0.3), s * (W - al / 2 + 0.6), 0, z));
      g.add(at(cb(0.9, 2.8, 3.6, F.dark, 0.2), s * (W - al), 0, z));
      g.add(at(lamp(M, 0.25, F.amber), s * (W - al + 0.3), 1.6, z));
      g.add(at(cyl(0.35, 0.35, 6, F.olive, 6), s * (W - 0.4), -2.2, z, 0, 0));
    }
  }
  /* Trockendock: Bodenrippen, Kielträger, Stapelblöcke */
  for (let z = z0 + 5; z < z1 - 2; z += 11) { g.add(at(cb(2 * W + 9, 1.4, 2, F.armor, 0.3), 0, yb - 0.2, z)); g.add(at(cb(3, 1.6, 3.4, F.olive, 0.3), 0, yb + 1.3, z)); }
  g.add(at(cb(2.2, 1.2, zl, F.dark, 0.3), 0, yb - 1.2, zc));
  /* Kopfbau mit Leitstand */
  const zr = -L / 2 + 4;
  g.add(at(cb(2 * W + 12, hh + 2, 8, F.hull, 1), 0, ym, zr));
  for (const s of [-1, 1]) g.add(at(cb(3, hh + 3, 9, F.armor, 0.6), s * (W + 5.2), ym, zr));
  for (let i = 0; i < 3; i++) g.add(at(slits(F, 2 * W, 0.35), 0, yt - 1.8 - i * 1.5, zr + 4.06));
  g.add(at(windows(M, 2 * W - 2, 1.6), 0, ym - 2, zr + 4.08));
  g.add(at(mesh(new THREE.BoxGeometry(2 * W - 4, 4, 0.2), F.hangar, false), 0, yb + 4, zr + 4.06));
  for (let i = 0; i < 4; i++) g.add(at(blk(2 * W - 3.8, 0.3, 0.3, F.dark), 0, yb + 2.4 + i * 1.1, zr + 4.2));
  deck(F, g, -W - 3.5, W + 3.5, zr - 3.4, zr + 3.4, yt + 1, 4, 2, lv);
  g.add(at(tb(M, 2 * W + 10, 0.4, 0.25), 0, yt - 0.6, zr + 4.06)); g.add(at(tb(M, 2 * W + 10, 0.4, 0.25), 0, yt - 0.6, zr - 4.06));
  const ct = new THREE.Group(); ct.position.set(-W * 0.35, yt + 1.6, zr - 0.4); g.add(ct);
  ct.add(at(cb(10, 4, 6, F.armor, 0.8), 0, 2, 0)); ct.add(at(cb(12, 2.2, 5, F.hull, 0.5), 0, 5.1, 0.3));
  ct.add(at(slits(F, 11, 0.55, 'x', 1.1, 0.8), 0, 5.2, 2.86)); ct.add(at(slits(F, 8, 0.3), 0, 2.8, 3.06));
  ct.add(at(tb(M, 11, 0.2, 0.8), 0, 6.3, 2)); ct.add(at(mast(M, 8, 0.18), 2.4, 6.2, -1)); ct.add(at(mast(M, 5, 0.14), -3, 6.2, -1.2));
  const rd = dishT(M, 2.2, 0.7); rd.position.set(W * 0.7 + 2, yt + 1.6, zr - 0.5); rd.userData.spin = { axis: 'y', speed: 0.3 }; g.add(rd);
  numTop(g, 'ACS-DOCK 4', W * 0.32, yt + 1.75, zr + 1.6, 1.7);
  { const n = decal('ACS-DOCK 4', 12, 2.6, '#e9eef4'); n.rotation.set(0, PI, 0); n.position.set(0, ym + 2, zr - 4.1); g.add(n); }
  /* Portalkräne: Höhe über dem höchsten Schiff der Stufe; Fahrbereiche meiden Brückentürme */
  const yc = [0, 13, 19, 27][lv], cranes = [[], [[12, 12]], [[18, 11], [-12, 7]], [[26, 11], [-1, 8], [-32, 5]]][lv];
  cranes.forEach(([cz, amp], i) => {
    const c = new THREE.Group();
    for (const s of [-1, 1]) {
      c.add(at(cb(3.4, 2, 5.6, F.hull, 0.4), s * (W + 2.5), yt + 1.9, 0));
      c.add(at(tb(M, 0.2, 0.7, 4), s * (W + 4.25), yt + 1.9, 0));
      for (const dz of [-1.9, 1.9]) c.add(beam(F.armor, [s * (W + 2.5), yt + 2.8, dz], [s * (W + 2.5), yc + 0.2, dz * 0.35], 0.9));
      c.add(at(lamp(M, 0.3, 'light'), s * (W + 4.3), yt + 2.6, 2.4));
    }
    c.add(at(cb(2 * W + 9, 2.4, 3.2, F.armor, 0.4), 0, yc + 1.2, 0));
    c.add(at(cb(2 * W + 6, 0.5, 2.2, F.olive, 0.1), 0, yc + 2.6, 0));
    for (const dz of [-1.62, 1.62]) c.add(at(tb(M, 2 * W + 6, 0.8, 0.2), 0, yc + 1.4, dz));
    for (let i = 0; i < 4; i++) c.add(at(blk(0.6, 0.5, 3.4, F.dark), (i - 1.5) * W * 0.5, yc + 2.6, 0));
    const tx = (i % 2 ? -1 : 1) * W * 0.3;
    c.add(at(cb(4.4, 2.6, 4.8, F.hull, 0.5), tx, yc - 0.4, 0));
    c.add(at(blk(0.4, 2.4, 0.4, F.dark), tx, yc - 2.8, 0)); c.add(at(cb(2, 0.8, 2, F.olive, 0.2), tx, yc - 4.2, 0));
    c.add(at(lamp(M, 0.35, F.amber), tx, yc - 4.8, 0));
    g.add(slide(c, cz, amp, 0.16 + i * 0.03));
  });
  /* Fertigungsmodule außen (ab Stufe II), Kühlflügel und Flutlichtmasten (Stufe III) */
  if (lv >= 2) for (const s of [-1, 1]) {
    const nm = lv === 2 ? 2 : 3, x = s * (W + 8.6);
    for (let i = 0; i < nm; i++) {
      const z = zc + (i - (nm - 1) / 2) * (lv === 2 ? 26 : 24);
      g.add(at(cb(7.2, 9, 14, F.hull, 1), x, -1, z));
      g.add(at(cb(6, 0.6, 12, i % 2 ? F.olive : F.armor, 0.2), x, 3.8, z));
      g.add(at(slits(F, 11, 0.35, 'z'), x + s * 3.66, 1.6, z)); g.add(at(slits(F, 11, 0.3, 'z', 1.6), x + s * 3.66, 0.4, z));
      g.add(at(tb(M, 0.2, 0.7, 12), x + s * 3.66, -2.6, z));
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 3, 6), F.amber, false), x + s * 3.62, -1.6 - 2.2, z));
      greeb(F, g, x - 2.4, x + 2.4, z - 5, z + 5, 4.1, 5, i + lv * 3 + (s > 0 ? 7 : 0), 1);
      if (lv >= 3 && i !== 1) { const r = radWing(M, 7, 5); r.position.set(x + s * 3.6, -1, z); r.rotation.y = s * PI / 2; g.add(r); }
    }
  }
  if (lv >= 3) for (const s of [-1, 1]) for (const z of [z1 - 2, z0 + 2]) { g.add(at(blk(0.5, 8, 0.5, F.dark), s * (W + 2.5), yt + 4.9, z)); g.add(at(cb(1.6, 0.8, 1.6, F.armor, 0.2), s * (W + 2.5), yt + 9, z)); g.add(at(lamp(M, 0.45, 'light'), s * (W + 2.5), yt + 9.6, z)); }
  /* Bauplatz: Bug +Z */
  const bt = new THREE.Group(); bt.position.set(0, 0, zc); bt.userData.berth = { len: [0, 55, 75, 90][lv] }; g.add(bt);
  return g;
});

/* ================================================================== Raffinerie
   Industriestation: achteckige Verarbeitungsnabe mit Schmelzblock (bernsteinfarbene Schlitze, glühender Rost oben,
   Schornsteine), ringsum Tankfelder aus kantigen Tanks mit Panzerbändern, Andockarme mit Förderleitung, Klammerkopf
   und zwei Klammerbacken, die über den angedockten Frachter greifen (Frachter quer zum Arm). Stufen: 1/2/3
   Andockplätze, Tankfelder 2×2 / 4×2 / 3×3, Stufe I mit Erzbunker, Stufe III mit Ringleitung und höherer Schmelze. */
reg('refinery', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M), n = d.lv[lv - 1].docks || lv;
  g.add(lathe([[0.01, -13], [5, -12], [10, -7], [11, -5], [11, 3.5], [9.5, 5], [0.01, 5]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[10.8, -4.4], [11.6, -3.8], [11.6, 1], [10.8, 1.6], [10.8, -4.4]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(1, 2, 5, F.dark, 8), 0, -15, 0, -PI / 2));
  for (let k = 0; k < 8; k++) { const f = new THREE.Group(); rad(f, k * PI / 4 + PI / 8, 0); g.add(f); f.add(at(slits(F, 6, 0.3), 0, 2.2, 10.2)); f.add(at(tb(M, 6.5, 0.18, 0.7), 0, 5.1, 8.7)); }
  /* Schmelzblock */
  const sh = lv >= 3 ? 7.5 : 5.5, yt = 5 + sh;
  g.add(at(cb(11, sh, 11, F.armor, 1.5), 0, 5 + sh / 2, 0));
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Group(); f.rotation.y = k * PI / 2; g.add(f);
    for (let i = 0; i < (lv >= 3 ? 3 : 2); i++) f.add(at(strip(null, 7, 0.4, 0.12, F.amber), 0, 6.6 + i * 1.6, 5.52));
    f.add(at(cb(9, 0.6, 1.2, F.hull, 0.2), 0, yt + 0.3, 4.6));
  }
  g.add(at(mesh(new THREE.BoxGeometry(6.6, 0.2, 6.6), F.amber, false), 0, yt + 0.05, 0));
  for (let i = -1; i <= 1; i++) { g.add(at(blk(7.6, 0.5, 0.6, F.dark), 0, yt + 0.4, i * 2.2)); g.add(at(blk(0.6, 0.5, 7.6, F.dark), i * 2.2, yt + 0.45, 0)); }
  const st = lv >= 3 ? [[-3.6, -3.6], [3.6, 3.6]] : [[-3.6, -3.6]];
  for (const [x, z] of st) { g.add(at(cyl(1.3, 1.6, 7, F.hull, 10), x, yt + 3.5, z, -PI / 2)); g.add(at(cyl(1.6, 1.6, 0.6, F.dark, 10), x, yt + 6.8, z, -PI / 2)); g.add(at(lamp(M, 0.3, 'red', 0.2), x + 1.4, yt + 6.9, z)); }
  /* Andockarme: Frachter quer zum Arm, Mitte bei r = 31 */
  const dockA = []; for (let i = 0; i < n; i++) dockA.push(i * TAU / n);
  for (const a of dockA) {
    const D = new THREE.Group(); rad(D, a, 0); g.add(D);
    D.add(hl([[10, 4.4, 3.6, 0.4, 1, -1], [24, 4, 3.2, 0.4, 0.9, -1]], F.armor));
    D.add(at(tb(M, 0.7, 0.2, 12), -0.9, 0.85, 17));
    D.add(at(cyl(0.7, 0.7, 14, F.olive, 8), 1.4, 0.95, 17)); for (let i = 0; i < 3; i++) D.add(at(cyl(0.95, 0.95, 0.5, F.dark, 8), 1.4, 0.95, 12 + i * 5));
    D.add(at(cb(9, 6.4, 3.4, F.hull, 0.6), 0, -1, 25.4));
    D.add(at(cb(9.4, 0.8, 3.8, F.armor, 0.2), 0, 2.4, 25.4));
    D.add(at(cb(6, 1.8, 0.6, F.dark, 0.2), 0, -1.4, 27.2)); D.add(at(mesh(new THREE.BoxGeometry(5, 0.7, 0.2), F.amber, false), 0, -1.4, 27.5));
    for (const s of [-1, 1]) {
      D.add(at(cb(1.5, 4, 1.4, F.armor, 0.3), s * 6.5, 1.2, 26.6));
      D.add(at(cb(1.5, 1.2, 8.4, F.armor, 0.3), s * 6.5, 2.8, 30.6));
      D.add(at(cb(2, 1, 1.6, F.dark, 0.2), s * 6.5, 2.4, 34.4));
      D.add(at(lamp(M, 0.3, F.amber), s * 6.5, 3.6, 33.8));
    }
    D.add(at(lamp(M, 0.3, 'green', 0.25), 3.6, 2.9, 27.2));
    const k = new THREE.Group(); k.position.set(0, -1, 31); k.rotation.y = PI / 2; k.userData.dock = true; D.add(k);
  }
  /* Tankfelder zwischen den Andockarmen */
  const fields = n === 1 ? [[2 * PI / 3, 2], [4 * PI / 3, 2]] : n === 2 ? [[PI / 3, 2], [2 * PI / 3, 2], [4 * PI / 3, 2], [5 * PI / 3, 2]] : [[PI / 3, 3], [PI, 3], [5 * PI / 3, 3]];
  fields.forEach(([a, m], j) => {
    const T = new THREE.Group(); rad(T, a, n === 2 ? 20.5 : 19.5); g.add(T);
    for (let i = 0; i < m; i++) {
      const x = (i - (m - 1) / 2) * 9.2, t = tank(M, 4.1, 12, (i + j) % 2 ? F.olive : F.hull); t.position.set(x, -1, 0); T.add(t);
      T.add(at(cb(1.6, 1.6, 6, F.armor, 0.3), x * 0.7, -4, -5.5));
      T.add(at(cyl(0.6, 0.6, 7, F.dark, 6), x * 0.6, 2.5, -5));
    }
    T.add(at(cb(m * 9.2, 1.2, 2, F.armor, 0.3), 0, -6.2, 0));
    T.add(at(lamp(M, 0.3, 'light'), 0, 5.6, 0));
  });
  if (n === 1) {
    /* Erzbunker: offener Trichterkasten mit Rost und Förderband zur Nabe */
    const B = new THREE.Group(); rad(B, PI, 0); g.add(B);
    B.add(at(cb(12, 8, 10, F.hull, 1), 0, -1.5, 19));
    for (const s of [-1, 1]) { B.add(at(cb(1, 3.4, 10.4, F.armor, 0.2), s * 6, 3.4, 19, 0, 0, -s * 0.28)); B.add(at(cb(12.4, 3.4, 1, F.armor, 0.2), 0, 3.4, 19 + s * 5, s * 0.28, 0, 0)); }
    B.add(at(mesh(new THREE.BoxGeometry(8, 0.2, 8), F.amber, false), 0, 2.9, 19));
    for (let i = -1; i <= 1; i++) B.add(at(blk(8.6, 0.4, 0.5, F.dark), 0, 3.3, 19 + i * 2.6));
    B.add(at(blk(0.5, 0.4, 8.6, F.dark), 0, 3.35, 19));
    B.add(at(cb(3, 2, 9, F.olive, 0.4), 0, 2, 11)); B.add(at(blk(2.2, 0.3, 8, F.dark), 0, 3.1, 11));
    B.add(at(slits(F, 9, 0.35), 0, 0.3, 24.06)); B.add(at(tb(M, 10, 0.6, 0.2), 0, -3.5, 24.06));
    B.add(at(lamp(M, 0.3, 'light'), 5.6, 5.6, 14.2));
  }
  if (lv >= 3) {
    /* Ringleitung */
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 0.9, 6, 24), F.olive); ring.rotation.x = PI / 2; ring.position.y = -5.5; ring.castShadow = true; g.add(ring);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.13, c = new THREE.Group(); rad(c, a, 26, -5.5); c.add(cb(1.4, 2.4, 2.4, F.armor, 0.3)); g.add(c); }
  }
  numTop(g, 'ACS-RF 9', 0, 5.2, -7.6, 1.6);
  return g;
});

/* ================================================================== Reaktor
   Fusionsreaktorblock: achteckiger Panzersockel, darauf der Einschlussbehälter – acht Panzerpfeiler, zwischen
   denen der blaue Kern durch Schlitze leuchtet, oben ein Rost über dem hellsten Kernpunkt (von oben gut sichtbar).
   Kühlflügel als Kreuz. Stufen: I zwei Kühlflügel und vier Kühlmitteltanks, II vier Flügel und Leitungsrahmen,
   III längere Flügel, höherer Kern, vier Kondensatortürme mit leuchtender Krone und ein drehender Magnetring. */
reg('reactor', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M);
  g.add(lathe([[0.01, -11], [7, -10], [15, -5], [17, -3], [17, 1], [15.5, 2.2], [0.01, 2.2]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[16.8, -2.6], [17.6, -2], [17.6, 0.6], [16.8, 1.2], [16.8, -2.6]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(1, 2, 5, F.dark, 8), 0, -13, 0, -PI / 2));
  for (let k = 0; k < 8; k++) {
    const f = new THREE.Group(); rad(f, k * PI / 4, 0); g.add(f);
    f.add(at(cb(9.5, 0.45, 3.4, k % 2 ? F.armor : F.olive, 0.12), 0, 2.4, 12.4));
    f.add(at(tb(M, 10, 0.18, 0.7), 0, 2.3, 14.9));
    f.add(at(slits(F, 9, 0.3), 0, -0.6, 15.75));
  }
  /* Einschlussbehälter */
  const cH = lv >= 3 ? 15 : 12.5, yT = 2.2 + cH;
  const core = cyl(4.3, 4.3, cH, F.core, 12); at(core, 0, 2.2 + cH / 2, 0, -PI / 2); g.add(core);
  for (let k = 0; k < 8; k++) {
    const p = new THREE.Group(); rad(p, k * PI / 4 + PI / 8, 6.3, 2.2 + cH / 2); g.add(p);
    p.add(cb(2.9, cH, 2.5, F.armor, 0.5)); p.add(at(cb(3.1, cH * 0.5, 0.5, F.hull, 0.12), 0, 0, 1.3));
    p.add(at(blk(0.2, cH * 0.3, 0.12, F.dark), 0, cH * 0.1, 1.6));
  }
  g.add(lathe([[4.4, 2.2], [8.6, 2.2], [8.6, 4.4], [7.6, 5], [4.4, 5], [4.4, 2.2]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[4.4, yT - 1.6], [8.4, yT - 1.6], [8.4, yT + 0.2], [7.4, yT + 1], [4.4, yT + 1], [4.4, yT - 1.6]], F.hull, 8, { phi0: PI / 8 }));
  const hot = cyl(2.4, 2.4, 0.3, F.coreHot, 12); at(hot, 0, yT + 0.2, 0, -PI / 2); hot.userData.pulse = { amp: 0.06, speed: 1.3 }; g.add(hot);
  for (let i = 0; i < 2; i++) { const b = blk(9, 0.5, 0.7, F.dark); b.position.y = yT + 1.1; b.rotation.y = PI / 4 + i * PI / 2; g.add(b); }
  g.add(at(lamp(M, 0.4, 'red', 0.2), 6.2, yT + 1.4, 0)); g.add(at(lamp(M, 0.4, 'red', 0.2), -6.2, yT + 1.4, 0));
  /* Kühlflügel */
  const wings = lv >= 2 ? [0, PI / 2, PI, 3 * PI / 2] : [0, PI], wl = lv >= 3 ? 13.5 : 11.5;
  for (const a of wings) { const r = radWing(M, wl, 7.5); rad(r, a, 15.2, 0.4); g.add(r); const c = cb(3, 3, 3, F.armor, 0.5); rad(c, a, 15.2, 0.6); g.add(c); }
  if (lv === 1) for (const a of [PI / 2, 3 * PI / 2]) { const o = new THREE.Group(); rad(o, a, 12, 4); g.add(o); o.add(at(cyl(1.6, 1.6, 7, F.olive, 10), 0, 0, 0, 0, PI / 2)); for (const x of [-2.6, 2.6]) o.add(at(cyl(1.8, 1.8, 0.5, F.dark, 10), x, 0, 0, 0, PI / 2)); o.add(at(cb(6, 1.6, 2, F.armor, 0.3), 0, -1.6, 0)); }
  if (lv >= 2) for (let k = 0; k < 4; k++) {
    /* Leitungsrahmen an den Diagonalen */
    const o = new THREE.Group(); rad(o, PI / 4 + k * PI / 2, 0); g.add(o);
    o.add(at(cyl(0.7, 0.7, 6, F.olive, 8), 0, 3.4, 11)); o.add(at(cb(2.4, 2.4, 2.4, F.armor, 0.4), 0, 3.4, 14.4));
    if (lv >= 3) {
      o.add(at(cb(3.6, 9, 3.6, F.armor, 0.6), 0, 6.7, 14.6));
      o.add(at(mesh(new THREE.BoxGeometry(3.8, 0.6, 3.8), F.rail, false), 0, 9.5, 14.6));
      o.add(at(cb(2.6, 1, 2.6, F.hull, 0.3), 0, 11.7, 14.6));
      o.add(at(slits(F, 2.6, 0.3), 0, 6, 16.45));
    }
  }
  if (lv >= 3) {
    /* drehender Magnetring */
    const mr = new THREE.Group(); mr.position.y = 2.2 + cH * 0.62; mr.userData.spin = { axis: 'y', speed: 0.35 }; g.add(mr);
    mr.add(lathe([[9.4, -0.5], [10.8, -0.5], [10.8, 0.5], [9.4, 0.5], [9.4, -0.5]], F.armor, 12));
    for (let k = 0; k < 6; k++) { const b = new THREE.Group(); rad(b, k * TAU / 6, 10.1); b.add(cb(2.2, 2, 2, F.hull, 0.4)); b.add(at(mesh(new THREE.BoxGeometry(1.4, 1.2, 0.2), F.rail, false), 0, 0, -1.05)); mr.add(b); }
  }
  numTop(g, 'ACS-R 31', 0, 2.65, -12.4, 1.4);
  return g;
});

/* ================================================================== Labor
   Sensor- und Forschungsstation: achteckiger Sockel mit Laborringen (Fensterbänder), darauf eine große
   Parabolschüssel auf Drehteller, die langsam schwenkt. Stufe I: eine große Schüssel, Antennenmast, zwei
   Sensorausleger mit Lichtern. Stufe II: drei Schüsseln auf Auslegern dazu, Rechenmodul, Antennenfeld.
   Stufe III: drehender Sensorring mit vier Phasenfeldern (blau) um den Sockel und eine hohe Kommandokanzel. */
reg('lab', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M);
  g.add(lathe([[0.01, -10], [6, -9], [13, -4], [14.5, -2.5], [14.5, 2], [13, 3.4], [0.01, 3.4]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[14.3, -2], [15.1, -1.5], [15.1, 0.8], [14.3, 1.3], [14.3, -2]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(0.9, 1.8, 5, F.dark, 8), 0, -12, 0, -PI / 2));
  for (let k = 0; k < 8; k++) {
    const f = new THREE.Group(); rad(f, k * PI / 4, 0); g.add(f);
    f.add(at(windows(M, 8, 1.1), 0, -1.2, 13.42)); f.add(at(slits(F, 7, 0.3), 0, 0.3, 13.42));
    f.add(at(cb(8, 0.45, 3, k % 2 ? F.olive : F.armor, 0.12), 0, 3.6, 10.6)); f.add(at(tb(M, 8.5, 0.18, 0.7), 0, 3.5, 12.6));
  }
  /* Laborturm und Hauptschüssel */
  g.add(at(cb(9, 4, 9, F.armor, 1.2), 0, 5.4, 0)); g.add(at(cb(10, 0.5, 10, F.hull, 0.3), 0, 7.6, 0));
  for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.rotation.y = k * PI / 2; g.add(f); f.add(at(slits(F, 6, 0.35, 'x', 1.2), 0, 5.6, 4.52)); }
  const big = dishT(M, lv >= 3 ? 7.5 : 8, 0.7, 16); big.position.y = 7.85; big.userData.sway = { axis: 'y', amp: 0.6, speed: 0.12, phase: 1 }; g.add(big);
  g.add(at(mast(M, 10, 0.2), -6.2, 3.8, -6.2));
  /* Sensorausleger */
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); rad(o, s > 0 ? PI / 4 : 5 * PI / 4, 13, 0.5); g.add(o);
    o.add(at(cb(2, 1.4, 12, F.armor, 0.3), 0, 0, 6)); o.add(at(cb(1.2, 0.8, 7, F.dark, 0.15), 0, 0.9, 7.5));
    for (let i = 0; i < 4; i++) o.add(at(lamp(M, 0.25, 'light'), 0, 1.55, 5 + i * 1.8));
    o.add(at(cb(3, 2.2, 2.2, F.hull, 0.4), 0, 0.2, 12.4)); o.add(at(tb(M, 3.1, 0.3, 0.2), 0, 0.2, 13.55));
  }
  if (lv >= 2) {
    /* drei Schüsseln auf Auslegern */
    for (let i = 0; i < 3; i++) {
      const a = PI / 2 + i * TAU / 3 + (i ? 0 : 0), o = new THREE.Group(); rad(o, a, 0); g.add(o);
      o.add(at(cb(4, 2.4, 14, F.hull, 0.5), 0, 1.6, 12)); o.add(at(tb(M, 0.3, 0.2, 10), 1.6, 2.9, 12)); o.add(at(slits(F, 8, 0.3, 'z'), -2.05, 1.8, 12));
      o.add(at(cb(5, 1.4, 5, F.armor, 0.5), 0, 3.4, 19.5)); o.add(at(slits(F, 3.6, 0.3), 0, 3.5, 22.05));
      const dd = dishT(M, 4.2, 0.85, 12); dd.position.set(0, 4.1, 19.5); dd.rotation.y = 0.4; dd.userData.sway = { axis: 'y', amp: 0.5, speed: 0.1 + i * 0.03, phase: i * 2 }; o.add(dd);
      o.add(at(lamp(M, 0.3, 'red', 0.2), 2.3, 4.3, 21.5));
    }
    /* Rechenmodul und Antennenfeld */
    g.add(at(cb(6, 3, 5, F.olive, 0.5), 7.5, 4.9, -5)); g.add(at(slits(F, 4, 0.3), 7.5, 5.4, -2.45)); g.add(at(cb(6.4, 0.4, 5.4, F.armor, 0.1), 7.5, 6.6, -5));
    for (let i = 0; i < 3; i++) g.add(at(mast(M, 4 + (i % 2) * 2, 0.12), 6 + i * 1.5, 6.8, -6.5 + i * 1.3));
  }
  if (lv >= 3) {
    /* Sensorring mit Phasenfeldern, dreht langsam; Kommandokanzel */
    const ring = new THREE.Group(); ring.position.y = -3.5; ring.userData.spin = { axis: 'y', speed: 0.12 }; g.add(ring);
    ring.add(lathe([[22, -0.7], [24, -0.7], [24, 0.7], [22, 0.7], [22, -0.7]], F.armor, 16));
    for (let k = 0; k < 4; k++) { const b = new THREE.Group(); rad(b, k * PI / 2 + PI / 4, 23); ring.add(b); b.add(cb(6, 3.6, 1.6, F.hull, 0.4)); const e = emitterS(M, 5, 2.4, 4, 2); e.position.z = 0.9; b.add(e); b.add(at(lamp(M, 0.3, 'light'), 0, 2.2, 0)); }
    for (let k = 0; k < 4; k++) { const b = new THREE.Group(); rad(b, k * PI / 2, 23); ring.add(b); b.add(cb(2.4, 2, 2.4, F.armor, 0.4)); b.add(at(lamp(M, 0.3, k % 2 ? 'red' : 'green', 0.2), 0, 1.3, 0)); }
    for (let k = 0; k < 4; k++) { const b = beam(F.dark, [Math.cos(k * PI / 2 + PI / 8) * 14, -1.5, Math.sin(k * PI / 2 + PI / 8) * 14], [Math.cos(k * PI / 2 + PI / 8) * 22, -3.5, Math.sin(k * PI / 2 + PI / 8) * 22], 0.8); g.add(b); }
    const T = new THREE.Group(); T.position.set(-7.5, 3.4, 6); g.add(T);
    T.add(at(cb(5, 7, 5, F.armor, 0.8), 0, 3.5, 0)); T.add(at(cb(6.4, 2.4, 6.4, F.hull, 0.6), 0, 8.2, 0)); T.add(at(cb(5, 0.5, 5, F.olive, 0.2), 0, 9.6, 0));
    for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.rotation.y = k * PI / 2; T.add(f); f.add(at(slits(F, 5, 0.5, 'x', 1.1, 0.8), 0, 8.3, 3.22)); f.add(at(tb(M, 5.5, 0.4, 0.2), 0, 6.5, 3.22)); }
    T.add(at(mast(M, 5, 0.14), 1.8, 9.8, -1.8));
  }
  numTop(g, 'ACS-LAB 2', 0, 3.6, -10.8, 1.4);
  return g;
});

/* ================================================================== Lanzenturm
   Gepanzerter Geschützturm auf einem achteckigen Pylon: Panzersockel mit Fensterschlitzen und Teamband, darauf
   der Drehkopf (lance) mit Strahlwaffen-Läufen und blauen Mündungen. Stufe I: ein Lauf, Zielschüssel.
   Stufe II: zwei Läufe, Kondensatorblöcke (blau) rund um den Pylon. Stufe III: zwei schwere Läufe mit Spulenring,
   vier Kondensatoren, Panzerkranz mit Schildemittern. */
reg('turret', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M), s = [0, 3.4, 3.6, 4.1][lv];
  g.add(lathe([[0.01, -10], [4.5, -9.5], [11, -4.5], [13, -2.5], [13, 1.5], [12, 2.5], [7.5, 2.5], [7.5, 4.4], [6.2, 5], [0.01, 5]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[12.8, -2], [13.6, -1.6], [13.6, 0.6], [12.8, 1], [12.8, -2]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(0.9, 1.8, 4.5, F.dark, 8), 0, -12, 0, -PI / 2));
  for (let k = 0; k < 8; k++) {
    const f = new THREE.Group(); rad(f, k * PI / 4, 0); g.add(f);
    f.add(at(slits(F, 6, 0.3, 'x', 1.3), 0, -0.4, 12.02)); f.add(at(cb(6.8, 0.4, 3.4, k % 2 ? F.olive : F.armor, 0.1), 0, 2.7, 9.6)); f.add(at(tb(M, 7.2, 0.18, 0.7), 0, 2.6, 11.5));
    if (k % 2) f.add(at(cb(2.2, 1.2, 1.6, F.dark, 0.2), 2.4, 3.5, 9.4));
  }
  /* Munitions-/Kondensatorblöcke */
  const nc = lv === 1 ? 0 : lv === 2 ? 2 : 4;
  for (let k = 0; k < nc; k++) {
    const o = new THREE.Group(); rad(o, k * TAU / nc + (nc === 2 ? PI / 2 : PI / 4), 0); g.add(o);
    o.add(at(cb(4.6, 5, 4.6, F.armor, 0.6), 0, 5.4, 11.4)); o.add(at(mesh(new THREE.BoxGeometry(4.8, 0.5, 4.8), F.rail, false), 0, 6.2, 11.4)); o.add(at(cb(3.8, 0.8, 3.8, F.hull, 0.2), 0, 8.3, 11.4));
    o.add(at(cyl(0.5, 0.5, 6, F.olive, 6), 0, 3.4, 7.5)); o.add(at(lamp(M, 0.25, 'light'), 1.7, 8.9, 12.7));
  }
  if (lv >= 3) for (let k = 0; k < 4; k++) { const e = emitterS(M, 4.6, 2, 3, 1); rad(e, k * PI / 2, 13.2, -0.6); g.add(e); }
  if (lv === 1) { for (let k = 0; k < 2; k++) { const o = new THREE.Group(); rad(o, PI / 2 + k * PI, 0); g.add(o); o.add(at(cb(5, 1.6, 4, F.armor, 0.4), 0, 3.6, 10.2)); o.add(at(cb(4.2, 0.5, 3.2, F.olive, 0.1), 0, 4.65, 10.2)); o.add(at(tb(M, 4.4, 0.2, 0.4), 0, 4.75, 12.1)); } const dd = dishT(M, 1.9, 0.8, 10); dd.position.set(-5.4, 2.9, -8.2); dd.userData.spin = { axis: 'y', speed: 0.4 }; g.add(dd); g.add(at(mast(M, 5, 0.14), 5.6, 2.9, -8)); }
  else g.add(at(mast(M, 6, 0.16), 0, 2.5, -10.4));
  const t = lance(M, s, lv >= 2 ? 2 : 1, lv >= 3, 0.3, lv >= 3 ? 3.9 : 4); t.position.y = 5; g.add(t);
  numZ(g, 'ODP-' + (10 + lv), 0, 0.9, 12.1, 1.1);
  return g;
});

/* ================================================================== Schildgenerator
   Emitterturm: achteckiger Panzersockel, Generatorblock mit tiefblauen Emitterfeldern an allen Seiten, darauf eine
   facettierte Schildkuppel (dunkelblau) unter einem Panzerkäfig, auf der Spitze ein pulsierender Emitterkern.
   Stufe I: Turm mit vier Feldern. Stufe II: drehender Emitterring mit sechs Platten, vier Außenemitter auf
   Auslegern. Stufe III: zweiter gegenläufiger Ring, acht Außenemitter, Kuppel größer. */
reg('shield', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M);
  g.add(lathe([[0.01, -10], [5.5, -9.5], [13, -4], [15.5, -2.5], [15.5, 1.5], [14.5, 2.6], [0.01, 2.6]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[15.3, -2], [16.1, -1.5], [16.1, 0.6], [15.3, 1.1], [15.3, -2]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(0.9, 1.7, 4.5, F.dark, 8), 0, -11.8, 0, -PI / 2));
  for (let k = 0; k < 8; k++) {
    const f = new THREE.Group(); rad(f, k * PI / 4, 0); g.add(f);
    f.add(at(slits(F, 7, 0.3, 'x', 1.3), 0, -0.4, 14.33)); f.add(at(cb(7.8, 0.4, 3.6, k % 2 ? F.olive : F.armor, 0.1), 0, 2.8, 11.6)); f.add(at(tb(M, 8.2, 0.18, 0.7), 0, 2.7, 13.7));
  }
  /* Generatorblock mit Emitterfeldern, Pufferbänke an den Diagonalen */
  const bh = 7;
  g.add(at(cb(9, bh, 9, F.armor, 1), 0, 2.6 + bh / 2, 0));
  for (let k = 0; k < 4; k++) { const e = emitterS(M, 6.5, 4.2, 4, 3); e.position.set(0, 2.6 + bh / 2, 0); e.rotation.y = k * PI / 2; e.translateZ(4.75); g.add(e); }
  g.add(at(cb(10.5, 0.8, 10.5, F.hull, 0.3), 0, 2.6 + bh + 0.4, 0));
  for (let k = 0; k < 4; k++) { const o = new THREE.Group(); rad(o, k * PI / 2 + PI / 4, 0); g.add(o); o.add(at(cb(3.6, 2.2, 4.4, F.armor, 0.4), 0, 3.7, 9.2)); o.add(at(mesh(new THREE.BoxGeometry(2.4, 0.3, 3), F.rail, false), 0, 4.85, 9.2)); for (let i = 0; i < 3; i++) o.add(at(blk(3.8, 0.4, 0.5, F.dark), 0, 4.9, 8 + i * 1.2)); o.add(at(cyl(0.5, 0.5, 4, F.olive, 6), 0, 3.4, 6.2)); }
  /* Kuppel mit Käfig und Kern */
  const dr = lv >= 3 ? 5.2 : 4.4, yd = 2.6 + bh + 0.8;
  const dome = lathe([[0.01, 0], [dr, 0], [dr * 0.92, dr * 0.42], [dr * 0.66, dr * 0.78], [dr * 0.3, dr * 0.96], [0.01, dr]], F.dome, 8, { phi0: PI / 8 }); dome.position.y = yd; g.add(dome);
  for (let k = 0; k < 8; k++) { const b = new THREE.Group(); rad(b, k * PI / 4 + PI / 8, 0, yd); g.add(b); b.add(beam(F.armor, [0, 0.2, dr * 1.02], [0, dr * 0.84, dr * 0.5], 0.7, 0.5)); b.add(at(cb(1.6, 1.2, 1.6, F.armor, 0.3), 0, 0.5, dr * 1.02)); }
  g.add(lathe([[dr * 0.42, yd + dr * 0.86], [dr * 0.5, yd + dr * 0.92], [dr * 0.42, yd + dr * 0.98], [dr * 0.42, yd + dr * 0.86]], F.hull, 8, { phi0: PI / 8 }));
  const core = mesh(new THREE.IcosahedronGeometry(dr * 0.28, 1), F.core, false); core.position.y = yd + dr * 1.1; core.userData.pulse = { amp: 0.12, speed: 1.6 }; g.add(core);
  g.add(at(lamp(M, 0.3, 'red', 0.2), 4.9, yd + 0.4, 4.9));
  /* Emitterringe */
  const rings = lv === 1 ? [] : lv === 2 ? [[8.6, 0.25, 6]] : [[8.6, 0.25, 6], [10.8, -0.18, 8]];
  rings.forEach(([rr, sp, n], j) => {
    const R = new THREE.Group(); R.position.y = yd + 1.4 + j * 2.6; R.userData.spin = { axis: 'y', speed: sp }; g.add(R);
    R.add(lathe([[rr - 0.4, -0.3], [rr + 0.4, -0.3], [rr + 0.4, 0.3], [rr - 0.4, 0.3], [rr - 0.4, -0.3]], F.armor, 12));
    for (let k = 0; k < n; k++) { const b = new THREE.Group(); rad(b, k * TAU / n, rr); R.add(b); b.add(cb(2.6, 2.2, 1, F.hull, 0.3)); b.add(at(mesh(new THREE.BoxGeometry(2, 1.5, 0.2), F.shield, false), 0, 0, -0.6)); }
  });
  /* Außenemitter auf Auslegern (Stufe II vier, Stufe III acht, weiter außen) */
  const no = lv === 1 ? 0 : lv === 2 ? 4 : 8, ro = lv >= 3 ? 21.5 : 19;
  for (let k = 0; k < no; k++) {
    const o = new THREE.Group(); rad(o, k * TAU / no + PI / no, 0); g.add(o);
    o.add(at(cb(2.6, 2, ro - 10, F.armor, 0.4), 0, 3.6, (ro + 11) / 2 - 1.5)); o.add(at(cb(3.4, 5.4, 2.6, F.hull, 0.5), 0, 5.6, ro));
    o.add(at(mesh(new THREE.BoxGeometry(2.4, 3.6, 0.2), F.shield, false), 0, 6.2, ro - 1.35));
    o.add(at(cb(3.8, 0.6, 3, F.olive, 0.15), 0, 8.6, ro)); o.add(at(tb(M, 3.5, 0.3, 0.2), 0, 4, ro + 1.35)); o.add(at(lamp(M, 0.3, 'light'), 0, 9.2, ro));
    for (const sx of [-1, 1]) o.add(at(cb(0.5, 1.4, 1.6, F.dark, 0.1), sx * 1.95, 3, ro - 3.4));
  }
  numTop(g, 'ACS-SG ' + lv, 0, 2.85, -9.8, 1.2);
  return g;
});

/* ================================================================== Kommandorelais
   Kommunikationsmast: kleiner achteckiger Sockel mit Funkraum, darauf ein hoher Gittermast mit Plattformen,
   Richtfunkschüsseln und Dipolantennen, oben ein langsames rotes Warnlicht. Stufe I: Mast mit einer Schüssel und
   zwei Auslegern. Stufe II: höherer Mast, zweite Plattform mit zwei weiteren Schüsseln, Antennenkranz.
   Stufe III: dritte Plattform mit großer Schüssel, drehender Datenring mit Teamfarbe. */
reg('relay', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M), H = [0, 9, 12, 15][lv];
  g.add(lathe([[0.01, -8], [5, -7.5], [11, -3], [12.5, -2], [12.5, 1], [11.5, 2], [0.01, 2]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[12.3, -1.6], [13, -1.2], [13, 0.4], [12.3, 0.8], [12.3, -1.6]], F.armor, 8, { phi0: PI / 8 }));
  g.add(at(cyl(0.7, 1.4, 3.5, F.dark, 8), 0, -9.4, 0, -PI / 2));
  for (let k = 0; k < 8; k++) { const f = new THREE.Group(); rad(f, k * PI / 4, 0); g.add(f); f.add(at(slits(F, 6, 0.3, 'x', 1.2), 0, -0.4, 11.55)); f.add(at(cb(6.4, 0.4, 2.8, k % 2 ? F.olive : F.armor, 0.1), 0, 2.2, 9.4)); f.add(at(tb(M, 6.6, 0.18, 0.6), 0, 2.1, 11.1)); }
  /* Funkraum */
  g.add(at(cb(8, 3.2, 8, F.armor, 0.8), 0, 3.6, 0)); g.add(at(cb(9, 0.5, 9, F.hull, 0.2), 0, 5.4, 0));
  for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.rotation.y = k * PI / 2; g.add(f); f.add(at(slits(F, 6, 0.35, 'x', 1.1), 0, 3.8, 4.02)); f.add(at(tb(M, 7, 0.4, 0.2), 0, 2.7, 4.02)); }
  /* Gittermast mit Plattformen */
  const m = truss(F.armor, H, 3, 3, 3, 0.3); m.rotation.x = -PI / 2; m.position.y = 5.6 + H / 2; g.add(m);
  g.add(at(cb(4.2, 1, 4.2, F.olive, 0.2), 0, 6, 0));
  const plats = lv === 1 ? [[H * 0.7, 2.4]] : lv === 2 ? [[H * 0.42, 2.6], [H * 0.86, 2.2]] : [[H * 0.3, 2.6], [H * 0.6, 2.2], [H * 0.92, 3]];
  plats.forEach(([y, dr], j) => {
    const yy = 5.6 + y;
    g.add(at(cb(5.4, 0.6, 5.4, F.hull, 0.2), 0, yy, 0)); g.add(at(tb(M, 5.6, 0.2, 0.3), 0, yy, 2.75)); g.add(at(tb(M, 5.6, 0.2, 0.3), 0, yy, -2.75));
    const nd = j === plats.length - 1 && lv >= 3 ? 1 : 2;
    for (let i = 0; i < nd; i++) { const dd = dishT(M, dr, 1.1, 10); const a = j * 1.1 + i * PI; dd.position.set(Math.cos(a) * 2.6, yy + 0.3, Math.sin(a) * 2.6); dd.userData.sway = { axis: 'y', base: -a + PI / 2, amp: 0.4, speed: 0.1 + j * 0.03, phase: j }; g.add(dd); }
    if (nd === 1) { g.add(at(cb(2.4, 1.4, 2.4, F.armor, 0.3), -2.4, yy + 1, 0)); g.add(at(lamp(M, 0.3, 'green', 0.2), -2.4, yy + 2, 0)); }
  });
  /* Dipol-Ausleger und Richtfunkschüsseln am Sockel */
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); rad(o, s > 0 ? PI / 2 : 3 * PI / 2, 0); g.add(o);
    o.add(at(cb(1.6, 1, 11, F.armor, 0.2), 0, 3, 9)); o.add(at(cb(2.4, 1.6, 2.4, F.hull, 0.3), 0, 3.2, 14.6)); o.add(at(tb(M, 2.6, 0.3, 0.2), 0, 3.2, 15.85));
    for (let i = 0; i < 4; i++) o.add(at(blk(0.18, 2.6 + i * 0.5, 0.18, F.dark), 0, 4.8 + i * 0.25, 6.5 + i * 2));
    o.add(at(lamp(M, 0.22, 'light'), 0, 4.3, 14.6));
  }
  for (const s of [-1, 1]) { const dd = dishT(M, 2.2, 0.9, 10); dd.position.set(s * 7.4, 2.6, 0); dd.rotation.y = s * PI / 2; dd.userData.sway = { axis: 'y', base: s * PI / 2, amp: 0.3, speed: 0.08, phase: s }; g.add(dd); }
  if (lv >= 2) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, r = 2.2, y = 5.6 + H * 0.15; g.add(at(blk(0.15, 3, 0.15, F.dark), Math.cos(a) * r, y + 1.5, Math.sin(a) * r)); g.add(beam(F.dark, [Math.cos(a) * 1.5, y, Math.sin(a) * 1.5], [Math.cos(a) * r, y, Math.sin(a) * r], 0.15)); }
  if (lv >= 3) { const R = new THREE.Group(); R.position.y = 5.6 + H * 0.76; R.userData.spin = { axis: 'y', speed: 0.3 }; g.add(R); R.add(lathe([[4.2, -0.25], [5, -0.25], [5, 0.25], [4.2, 0.25], [4.2, -0.25]], F.team, 12)); for (let k = 0; k < 3; k++) { const b = new THREE.Group(); rad(b, k * TAU / 3, 4.6); R.add(b); b.add(cb(1.2, 1, 0.8, F.hull, 0.2)); } }
  g.add(at(cb(1.6, 1, 1.6, F.armor, 0.2), 0, 5.6 + H + 0.5, 0)); g.add(at(lamp(M, 0.45, 'red', 0.25), 0, 5.6 + H + 1.4, 0));
  g.add(at(blk(0.2, 3, 0.2, F.dark), 0, 5.6 + H + 2.5, 0)); g.add(at(lamp(M, 0.25, 'light'), 0, 5.6 + H + 4.1, 0));
  numTop(g, 'ACS-CR ' + lv, 0, 2.25, -7.4, 0.9);
  return g;
});

/* ================================================================== Exodus-Tor
   Riesiges Slipspace-Portal: liegender Achteckring aus Panzersegmenten (Fensterschlitze, Teamstreifen) und acht
   Emitterblöcken an den Ecken, deren blaue Emitter nacheinander aufleuchten (chargeAt). In der Mitte das
   blauweiße Portalfeld (Wirbeltextur, additiv; charge skaliert es mit der Ladung), darunter die Nabe mit Reaktor
   und vier Streben. Stufe I: Ring, Emitter, Nabe, zwei Kontrollmodule. Stufe II: innerer gegenläufig drehender
   Fokussierring, vier Kontrollmodule, Antennen. Stufe III: äußerer Panzerkranz mit Kondensatortürmen, drei
   Feldlagen, Teamring. */
reg('super', (M, d, lv) => {
  const g = new THREE.Group(), F = sm(M), R = 43, segL = 2 * R * Math.sin(PI / 8), rm = R * Math.cos(PI / 8);
  /* Ringsegmente */
  for (let k = 0; k < 8; k++) {
    const S = new THREE.Group(); rad(S, (k + 0.5) * PI / 4, rm); g.add(S);
    S.add(at(cb(segL - 4, 4.6, 7, F.hull, 0.8), 0, 0, 0));
    S.add(at(cb(segL - 6, 0.6, 5, k % 2 ? F.armor : F.olive, 0.15), 0, 2.6, 0));
    S.add(at(tb(M, segL - 8, 0.2, 1.2), 0, 2.95, 1.2));
    for (const z of [3.56, -3.56]) S.add(at(slits(F, segL - 8, 0.35), 0, 0.6, z));
    S.add(at(cb(segL - 8, 2, 1.2, F.armor, 0.3), 0, -2.6, -3.2));
    S.add(at(mesh(new THREE.BoxGeometry(segL - 10, 0.6, 0.2), F.rail, false), 0, -0.4, -3.6)).userData.chargeAt = (k + 0.5) / 8;
    S.add(at(lamp(M, 0.35, 'light'), 0, 3.3, -2.6));
    greeb(F, S, -segL / 2 + 5, segL / 2 - 5, -1.6, 2, 2.9, 4, k + 20, 1.1);
  }
  /* Emitterblöcke an den Ecken */
  for (let k = 0; k < 8; k++) {
    const E = new THREE.Group(); rad(E, k * PI / 4, R); g.add(E);
    E.add(at(cb(9, 7, 9, F.armor, 1), 0, 0, 0)); E.add(at(cb(7, 0.8, 7, F.hull, 0.3), 0, 3.9, 0));
    E.add(at(cb(3.4, 6, 2.2, F.hull, 0.5), 0, 2, -5.4)); E.add(at(slits(F, 2.4, 0.3), 0, 1, -6.52));
    const em = mesh(new THREE.BoxGeometry(2.4, 3.6, 0.3), F.hangar, false); em.position.set(0, 3.4, -6.6); em.userData.chargeAt = k / 8; E.add(em);
    const off = mesh(new THREE.BoxGeometry(2.6, 3.8, 0.2), F.off, false); off.position.set(0, 3.4, -6.5); E.add(off);
    E.add(at(cb(2, 1, 4, F.dark, 0.2), 0, 4.8, -4.6));
    E.add(at(tb(M, 7.2, 0.3, 0.2), 0, 2.4, 4.56));
    E.add(at(lamp(M, 0.4, k % 2 ? 'red' : 'green', 0.2), 0, 4.6, 3.6));
    if (lv >= 3) { E.add(at(cb(3, 5, 3, F.armor, 0.5), 0, 6.5, 2)); E.add(at(mesh(new THREE.BoxGeometry(3.2, 0.6, 3.2), F.rail, false), 0, 7.6, 2)); E.add(at(cb(2.4, 0.6, 2.4, F.hull, 0.2), 0, 9.2, 2)); }
  }
  /* Nabe mit Reaktor, Streben zum Ring */
  g.add(lathe([[0.01, -14], [4, -13], [8, -8], [9, -6], [9, -2], [8, -1], [0.01, -1]], F.hull, 8, { phi0: PI / 8 }));
  g.add(lathe([[8.8, -5.6], [9.5, -5.2], [9.5, -2.8], [8.8, -2.4], [8.8, -5.6]], F.armor, 8, { phi0: PI / 8 }));
  const hc = cyl(3, 3, 7, F.core, 10); at(hc, 0, -5, 0, -PI / 2); g.add(hc);
  for (let k = 0; k < 8; k++) { const p = new THREE.Group(); rad(p, k * PI / 4 + PI / 8, 3.9, -5); g.add(p); p.add(cb(1.6, 7, 1.6, F.armor, 0.3)); }
  g.add(at(cyl(1, 1.8, 4, F.dark, 8), 0, -16, 0, -PI / 2));
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, s = new THREE.Group(); rad(s, a, 0); g.add(s);
    const tr = truss(F.armor, 29, 3, 3, 5.2, 0.4); tr.position.set(0, -3.5, 23.5); s.add(tr);
    s.add(at(cb(4, 4, 3, F.hull, 0.5), 0, -3.5, 9.5)); s.add(at(tb(M, 0.2, 0.5, 22), 1.7, -2.2, 23));
  }
  /* Kontrollmodule auf dem Ring */
  const nm = lv >= 2 ? 4 : 2;
  for (let k = 0; k < nm; k++) {
    const a = (nm === 2 ? PI / 2 : PI / 4) + k * TAU / nm + (nm === 2 ? 0 : 0), S = new THREE.Group(); rad(S, nm === 2 ? a : (k + 0.5) * PI / 4 * 2 + PI / 8, rm); g.add(S);
    S.add(at(cb(10, 4, 4.5, F.hull, 0.6), 0, 4.8, 0.8)); S.add(at(cb(8, 0.5, 3.5, F.olive, 0.2), 0, 7, 0.8));
    S.add(at(slits(F, 8, 0.5, 'x', 1.1, 0.8), 0, 5.4, -1.52)); S.add(at(slits(F, 8, 0.3), 0, 5.4, 3.1));
    S.add(at(mast(M, 6, 0.15), 3.6, 7.2, 0.8));
    if (lv >= 2) { const dd = dishT(M, 2, 0.8, 10); dd.position.set(-3, 7.2, 0.8); dd.userData.spin = { axis: 'y', speed: 0.3 }; S.add(dd); }
  }
  { const N = new THREE.Group(); rad(N, 3 * PI / 8, rm); g.add(N); numTop(N, 'EXODUS 01', 0, 3.02, 0, 2.2); }
  /* Portalfeld */
  const field = new THREE.Group(); field.userData.charge = true; g.add(field);
  const nl = lv >= 3 ? 3 : 2;
  for (let i = 0; i < nl; i++) { const f = mesh(new THREE.CircleGeometry(33 - i * 5, 32), F.field, false); f.rotation.x = -PI / 2; f.position.y = 0.4 + i * 0.5; f.userData.spin = { axis: 'z', speed: (i % 2 ? -0.25 : 0.18) * (1 + i * 0.4) }; field.add(f); }
  const fl = mesh(new THREE.CircleGeometry(29, 32), F.field, false); fl.rotation.x = PI / 2; fl.position.y = -0.3; fl.userData.spin = { axis: 'z', speed: -0.2 }; field.add(fl);
  if (lv >= 2) {
    /* Fokussierring, gegenläufig */
    const FR = new THREE.Group(); FR.position.y = 1.8; FR.userData.spin = { axis: 'y', speed: -0.12 }; g.add(FR);
    FR.add(lathe([[30.5, -0.6], [33, -0.6], [33, 0.6], [30.5, 0.6], [30.5, -0.6]], F.armor, 16));
    for (let k = 0; k < 8; k++) { const b = new THREE.Group(); rad(b, k * PI / 4 + PI / 8, 31.7); FR.add(b); b.add(cb(3.6, 2.4, 2.4, F.hull, 0.4)); const e = mesh(new THREE.BoxGeometry(2.4, 1.4, 0.2), F.hangar, false); e.position.z = -1.3; e.userData.chargeAt = 0.5 + k / 16; b.add(e); b.add(at(mesh(new THREE.BoxGeometry(2.6, 1.6, 0.12), F.off, false), 0, 0, -1.25)); }
  }
  if (lv >= 3) {
    /* äußerer Panzerkranz mit Teamring */
    g.add(lathe([[R + 5.4, -1.2], [R + 7.6, -1.2], [R + 7.6, 0.6], [R + 5.4, 0.6], [R + 5.4, -1.2]], F.armor, 16));
    g.add(lathe([[R + 6, 0.6], [R + 7, 0.6], [R + 7, 1], [R + 6, 1], [R + 6, 0.6]], F.team, 16));
    for (let k = 0; k < 16; k++) { const b = new THREE.Group(); rad(b, (k + 0.5) * PI / 8, R + 6.5, -0.3); g.add(b); b.add(cb(2.4, 2.2, 3, F.hull, 0.3)); if (k % 2) b.add(at(lamp(M, 0.3, 'light'), 0, 1.4, 0)); }
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * PI / 4; g.add(beam(F.dark, [Math.cos(a) * (rm + 3.5), -0.3, Math.sin(a) * (rm + 3.5)], [Math.cos(a) * (R + 5.4), -0.3, Math.sin(a) * (R + 5.4)], 1)); }
  }
  return g;
});
