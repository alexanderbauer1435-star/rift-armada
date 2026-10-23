/* =====================================================================
   THE ALLIANCE – Formensprache Halo (UNSC): lange, kantige Rümpfe aus geschichteter Panzerung, Hammerkopf-Bug mit
   Spinal-Kanone (MAC-Mündung), gestufte Aufbauten mit Brückenturm und Fensterschlitzen, Raketenbatterien (Archer),
   Punktverteidigung, Triebwerksblöcke mit vielen runden Düsen und blauweißem Glühen. Hellgraue Hülle, dunkle
   Panzerplatten, blaue Teamfarbe als Bänder, Kennungen »ACS-…« in Weiß. Kein Star-Trek-Element.
   Bug +Z, oben +Y, Länge = data len.
   ===================================================================== */
import * as THREE from 'three';
import { register, box, cyl, sphere, at, mirror, engine, turret, antenna, dish, navLight, strip, decal, greebles, platesRow, mesh, loft, uvScale } from '../kit.js';

/* ------------------------------------------------------------ Materialien */
const C = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
function fx(M) {
  if (M._halo) return M._halo;
  const std = (col, met, rough, src = M.hull) => new THREE.MeshStandardMaterial({ map: src.map, bumpMap: src.bumpMap, bumpScale: 0.7, color: col, metalness: met, roughness: rough });
  M._halo = {
    hull: std('#b4bcc5', 0.45, 0.55),
    armor: std('#7a8490', 0.55, 0.5),
    olive: std('#939a84', 0.4, 0.6),
    dark: new THREE.MeshStandardMaterial({ color: '#23292f', metalness: 0.75, roughness: 0.4 }),
    glowE: new THREE.MeshBasicMaterial({ color: C('#b8e4ff', 2.6) }),
    bore: new THREE.MeshBasicMaterial({ color: C('#6fc8ff', 2.4) }),
    slit: new THREE.MeshBasicMaterial({ color: C('#cfeaff', 1.15) }),
    amber: new THREE.MeshBasicMaterial({ color: C('#ffc070', 2) }),
    hangar: new THREE.MeshBasicMaterial({ color: C('#9fdcff', 1.4) }),
    shield: new THREE.MeshBasicMaterial({ color: C('#3f9cff', 1.5) }),
    lance: new THREE.MeshBasicMaterial({ color: C('#9ff0c0', 2.6) }),
    red: new THREE.MeshStandardMaterial({ color: '#a8261d', metalness: 0.4, roughness: 0.4, emissive: '#4a0c08', emissiveIntensity: 0.5 })
  };
  return M._halo;
}

/* ------------------------------------------------------------ Halo-Bausteine */
/* Querschnitt: Rechteck w × h, oben kleine Fase tc, unten große Fase bc (Rumpf läuft zum Kiel zusammen) */
function hsec(w, h, tc, bc, dy = 0) {
  tc = Math.min(tc, w / 2 - 0.01, h / 2 - 0.01); bc = Math.min(bc, w / 2 - 0.01, h - tc - 0.02);
  return [[w / 2, -h / 2 + bc], [w / 2, h / 2 - tc], [w / 2 - tc, h / 2], [-w / 2 + tc, h / 2], [-w / 2, h / 2 - tc], [-w / 2, -h / 2 + bc], [-w / 2 + bc * 0.8, -h / 2], [w / 2 - bc * 0.8, -h / 2]].map(([x, y]) => [x, y + dy]);
}
/* kantiger Rumpf: prof [[z, w, h, tc?, bc?, dy?], …] von hinten nach vorn */
function hl(prof, mat, opts) { return loft(prof.map(([z, w, h, tc, bc, dy]) => ({ z, pts: hsec(w, h, tc ?? Math.min(w, h) * 0.12, bc ?? h * 0.32, dy || 0) })), mat, opts); }
/* MAC-Mündung im Bug: dunkler Rahmen, tief drinnen blaues Glühen. Schaut nach +Z */
function bore(M, w, h) {
  const F = fx(M), g = new THREE.Group();
  g.add(at(box(w * 1.35, h * 1.35, 1.2, F.armor, Math.min(w, h) * 0.12), 0, 0, -0.4));
  g.add(at(box(w, h, 0.6, F.dark, 0.05), 0, 0, 0.05));
  const glow = box(w * 0.7, h * 0.7, 0.3, F.bore, 0.05); glow.position.z = -0.1; glow.userData.pulse = { amp: 0.06, speed: 2.5 }; g.add(glow);
  for (const sx of [-1, 1]) g.add(at(box(w * 0.08, h * 1.1, 0.4, F.hull, 0.03), sx * w * 0.42, 0, 0.2));
  return g;
}
/* Triebwerksblock: cols × rows runde Düsen in einem gepanzerten Gehäuse, Mündung bei z = 0 nach −Z */
function engines(M, cols, rows, r, dx, dy, plume = r * 4, housing = true) {
  const F = fx(M), g = new THREE.Group();
  if (housing) g.add(at(box(cols * dx + r * 0.8, rows * dy + r * 0.8, r * 2.2, F.armor, r * 0.3), 0, 0, r * 1.1));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const e = engine(M, r, r * 1.4, plume, F.glowE); e.position.set((i - (cols - 1) / 2) * dx, (j - (rows - 1) / 2) * dy, 0); g.add(e); }
  return g;
}
/* gestufter Aufbau mit Fensterschlitzen: steps [[w, h, d, dz], …] von unten nach oben */
function tower(M, steps, mat) {
  const F = fx(M), g = new THREE.Group(); let y = 0;
  for (const [w, h, d, dz] of steps) {
    g.add(at(box(w, h, d, mat || F.hull, Math.min(w, h) * 0.12), 0, y + h / 2, dz || 0));
    const sl = strip(M, w * 0.8, h * 0.12, 0.15, F.slit); sl.position.set(0, y + h * 0.62, (dz || 0) + d / 2 + 0.05); g.add(sl);
    for (const sx of [-1, 1]) { const s2 = strip(M, 0.12, h * 0.1, d * 0.7, F.slit); s2.position.set(sx * (w / 2 + 0.05), y + h * 0.62, dz || 0); g.add(s2); }
    y += h;
  }
  g.userData.top = y;
  return g;
}
/* Raketenbatterie (Archer): Platte mit Klappenraster */
function archer(M, w, d, n = 4, m = 3) {
  const F = fx(M), g = new THREE.Group(); g.add(box(w, 0.8, d, F.armor, 0.15));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const h = box(w / n * 0.62, 0.2, d / m * 0.62, F.dark, 0.04); h.position.set(-w / 2 + w / n * (i + 0.5), 0.46, -d / 2 + d / m * (j + 0.5)); g.add(h); }
  return g;
}
/* Punktverteidigung (kleiner Drehturm mit Gatling) */
function pdc(M, s = 1) {
  const F = fx(M), g = new THREE.Group();
  g.add(at(cyl(s * 0.9, s * 0.9, s * 0.5, F.dark, 10), 0, 0, 0, Math.PI / 2));
  g.add(at(box(s * 1.2, s * 0.8, s * 1.3, F.armor, s * 0.15), 0, s * 0.55, 0));
  g.add(at(cyl(s * 0.22, s * 0.22, s * 1.8, F.dark, 8), 0, s * 0.55, s * 1.4));
  g.userData.turret = true; return g;
}
/* Schildemitter-Feld (Spielmechanik Schildverbund): Rahmen mit leuchtendem Gitter, Normale +X */
function emitter(M, d, h) {
  const F = fx(M), g = new THREE.Group(); g.add(box(0.8, h, d, F.armor, 0.2));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.add(at(box(0.2, h * 0.32, d * 0.18, F.shield, 0.03), 0.45, -h * 0.2 + j * h * 0.42, -d * 0.36 + i * d * 0.24));
  return g;
}
function num(g, txt, x, y, z, s, side = 1) { const d = decal(txt, s * 4.2, s, '#e9eef4'); d.position.set(x, y, z); d.rotation.y = side * Math.PI / 2; g.add(d); }
function band(M, len, h, x, y, z) { const b = box(0.2, h, len, M.trim, 0.06); b.position.set(x, y, z); return b; }
function lights(g, M, x, y, z) { g.add(at(navLight(M, 0.35, 'red'), -x, y, z)); g.add(at(navLight(M, 0.35, 'green'), x, y, z)); }

/* ================================================================== Schiffe */

/* Fregatte LANCER – wie die Paris-Klasse: schlanker Rumpf, breiter Hammerkopf-Bug mit MAC, Aufbau hinten */
register('lancer', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-19, 6.4, 5.6], [-8, 7.4, 6], [5, 6.6, 5.4, 0.6, 1.8, -0.2], [11, 5.6, 4.6, 0.5, 1.5, -0.3]], F.hull));
  /* Hammerkopf */
  g.add(hl([[10, 10.5, 4.6, 0.5, 1.4, 0.3], [16.5, 11, 4.4, 0.5, 1.3, 0.3], [19.2, 8.4, 3.2, 0.4, 0.9, 0.2]], F.hull));
  g.add(at(box(11.4, 0.7, 5, F.armor, 0.2), 0, 2.6, 15));
  const b = bore(M, 2.2, 1.6); b.position.set(0, 0.2, 19.3); g.add(b);
  for (const sx of [-1, 1]) { const b2 = bore(M, 1, 0.7); b2.position.set(sx * 3.4, 0.4, 19); g.add(b2); }
  /* Panzerplatten und Bänder */
  for (const sx of [-1, 1]) { const pl = platesRow(M, 3, 0.5, 3.2, 5, 0.5, F.armor); pl.position.set(sx * 3.45, 0.4, -6); g.add(pl); g.add(band(M, 14, 0.6, sx * 3.75, 1.9, -2)); }
  /* Aufbau, Brücke, Rückenflossen */
  const tw = tower(M, [[4.6, 1.8, 10, 0], [3.4, 1.6, 5, -1.5]]); tw.position.set(0, 2.8, -9); g.add(tw);
  for (const sx of [-1, 1]) { const fin = box(0.5, 3.4, 5, F.armor, 0.15); fin.position.set(sx * 1.6, 4.6, -16); fin.rotation.z = -sx * 0.2; g.add(fin); }
  g.add(at(antenna(M, 3.4, 0.12), 0.8, 6.2, -10));
  g.add(at(pdc(M, 0.8), 0, 2.8, 4)); g.add(at(pdc(M, 0.7), 0, -2.6, 2, Math.PI));
  for (const sx of [-1, 1]) { const a = archer(M, 2.2, 4, 2, 3); a.position.set(sx * 2.2, 2.75, 7); g.add(a); }
  const e = engines(M, 2, 2, 1.2, 2.6, 2.4, 5); e.position.set(0, 0, -19); g.add(e);
  num(g, 'ACS-417', 3.3, -0.8, 4, 1.1);
  lights(g, M, 5.6, 1.6, 17);
  return g;
});

/* Korvette WREN – Aufklärer wie ein Prowler: flacher, dunkler Tarnkeil, Sensormast, schräge Heckflossen */
register('wren', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-13, 7, 2.8, 0.3, 1.1], [-4, 8.6, 3.2, 0.3, 1.2], [6, 6, 2.8, 0.3, 1], [13, 1.2, 1, 0.2, 0.3]], F.armor));
  g.add(hl([[-12, 4, 1.4, 0.3, 0.4, 1.6], [4, 3.4, 1.2, 0.3, 0.4, 1.5], [9, 1.6, 0.8, 0.2, 0.3, 1.3]], F.dark));
  g.add(at(box(2.2, 0.5, 2.6, F.slit, 0.15), 0, 2.15, 6, -0.2));
  /* Kanten mit Teamfarbe */
  for (const sx of [-1, 1]) { const e = box(0.2, 0.2, 14, M.trim, 0.05); e.position.set(sx * 3.9, 0.3, -2); e.rotation.y = -sx * 0.12; g.add(e); }
  /* Sensormast mit drehender Schüssel */
  g.add(at(box(0.5, 2.6, 0.5, F.dark, 0.1), 0, 2.6, -5));
  const d = dish(M, 1.2); d.position.set(0, 3.6, -5); g.add(d);
  for (const sx of [-1, 1]) { const fin = box(0.3, 2.6, 4, F.armor, 0.1); fin.position.set(sx * 2.8, 1.6, -11); fin.rotation.z = -sx * 0.45; g.add(fin); }
  /* flache Schlitzdüsen */
  for (const sx of [-1, 1]) { g.add(at(box(2.6, 0.9, 1, F.dark, 0.2), sx * 1.8, 0, -13)); const s = box(2.2, 0.5, 0.2, F.glowE, 0.05); s.position.set(sx * 1.8, 0, -13.55); g.add(s); }
  num(g, 'ACS-82', 3.5, 0, 0, 0.8);
  return g;
});

/* Bauschiff PATHFINDER – wie ein großer Pelican: kastiger Rumpf, Kanzel vorn, Heckausleger, vier Schwenktriebwerke,
   Baukran und Greifarme */
register('pathfinder', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-8, 6, 5, 0.6, 1.4], [6, 6.6, 5.4, 0.6, 1.6], [11, 5, 4.4, 0.5, 1.4, -0.3], [14, 3.4, 2.8, 0.4, 0.8, -0.5]], F.olive));
  const cp = box(3.6, 1.2, 2.6, F.slit, 0.3); cp.position.set(0, 1.4, 12.4); cp.rotation.x = -0.45; g.add(cp);
  g.add(at(box(4.2, 0.4, 3.4, F.dark, 0.1), 0, 2.15, 11.5, -0.45));
  /* Heckausleger */
  g.add(hl([[-17, 2, 2, 0.3, 0.6, 1.4], [-8, 3, 2.6, 0.3, 0.7, 1.2]], F.olive));
  g.add(at(box(0.4, 3.6, 3, F.armor, 0.1), 0, 3.4, -16)); for (const sx of [-1, 1]) g.add(at(box(3, 0.3, 2, F.armor, 0.1), sx * 1.6, 2, -16));
  /* Stummelflügel mit vier Triebwerksgondeln */
  for (const sx of [-1, 1]) {
    g.add(at(box(5, 0.8, 4, F.armor, 0.2), sx * 5, 1, 1));
    for (const z of [5, -3]) { const pod = new THREE.Group(); pod.add(at(cyl(1.2, 1.2, 4, F.hull, 12), 0, 0, 0)); const e = engine(M, 0.9, 1.2, 3, F.glowE); e.position.z = -2; pod.add(e); pod.add(at(box(2.6, 0.2, 0.3, M.trim, 0.05), 0, 1.2, 1)); pod.position.set(sx * 7.6, 1, z); pod.rotation.x = 0.25; g.add(pod); }
  }
  /* Baukran oben, Greifarme unter der Nase, Arbeitslichter */
  const crane = new THREE.Group(); crane.add(at(cyl(0.8, 0.8, 0.8, F.dark, 12), 0, 0, 0, Math.PI / 2)); crane.add(at(box(0.7, 0.7, 10, F.armor, 0.15), 0, 0.6, 4, -0.18)); crane.add(at(box(0.2, 3, 0.2, F.dark, 0.05), 0, -0.6, 8.8)); crane.add(at(box(1.6, 0.4, 1.6, M.trim, 0.1), 0, -2.2, 8.8));
  crane.position.set(0, 2.9, -4); crane.userData.sway = { axis: 'y', amp: 0.45, speed: 0.4 }; g.add(crane);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.add(at(box(0.8, 0.8, 5, F.armor, 0.2), 0, 0, 2.5)); arm.add(at(box(0.7, 0.7, 4, F.dark, 0.2), 0, -1, 6, -0.45)); arm.add(at(box(1.6, 0.4, 0.9, F.amber, 0.1), 0, -2.2, 7.6));
    arm.position.set(sx * 2, -2.2, 6); arm.rotation.y = -sx * 0.1; arm.userData.sway = { axis: 'x', amp: 0.08, speed: 0.7, phase: sx }; g.add(arm);
  }
  for (const [x, y, z] of [[-3, 2.8, 8], [3, 2.8, 8], [0, -2.6, 13]]) g.add(at(navLight(M, 0.3, 'light', 0.6), x, y, z));
  num(g, 'ACS-B12', 3.35, 0, 0, 1.0);
  return g;
});

/* Frachter HAULER – Schlepper mit Kabine, Rückgrat und vier gerippten Containern */
register('hauler', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[8, 5, 4.4, 0.5, 1.3], [12, 4.6, 4, 0.5, 1.2], [15, 3, 2.6, 0.4, 0.8]], F.hull));
  g.add(at(box(3, 0.8, 1.2, F.slit, 0.2), 0, 1.3, 13.6, -0.4));
  g.add(at(box(1.8, 1.8, 26, F.armor, 0.3), 0, 0, -4));
  for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) {
    const c = new THREE.Group(); c.add(box(3, 3.4, 8, i ? F.olive : F.hull, 0.2));
    for (let k = 0; k < 5; k++) c.add(at(box(3.2, 3.6, 0.3, F.armor, 0.05), 0, 0, -3.6 + k * 1.8));
    c.add(at(box(0.1, 0.5, 6.6, M.trim, 0.04), sx * 1.55, 1.1, 0));
    c.position.set(sx * 2.5, 0, -9 + i * 9); g.add(c);
  }
  const e = engines(M, 2, 1, 1.3, 3, 2, 5); e.position.set(0, 0, -17); g.add(e);
  lights(g, M, 2.6, 1.6, 14);
  num(g, 'ACS-H3', 2.55, 0.8, 11, 0.9);
  return g;
});

/* Kreuzer BULWARK – wie ein Halcyon-Kreuzer: langer, geschichteter Panzerrumpf, Hammerbug, Doppelaufbau,
   Schildemitter-Felder an den Flanken (Schildverbund), Archer-Batterien, Hangarschlitz unten */
register('bulwark', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-28, 10, 8, 0.8, 3], [-10, 12, 9, 0.8, 3.2], [12, 11, 8.4, 0.8, 3], [20, 9, 7, 0.6, 2.6, -0.3]], F.hull));
  g.add(hl([[19, 13, 6.6, 0.6, 2, 0.2], [26, 13.4, 6, 0.6, 1.8, 0.2], [28.6, 10, 4.4, 0.5, 1.2, 0.1]], F.hull));
  const b = bore(M, 3, 2.2); b.position.set(0, 0.4, 28.7); g.add(b);
  g.add(at(box(13.6, 0.8, 7, F.armor, 0.25), 0, 3.4, 23.5));
  /* Panzergürtel und Schildemitter */
  for (const sx of [-1, 1]) {
    const pl = platesRow(M, 5, 0.6, 4.2, 5, 0.6, F.armor); pl.position.set(sx * 6.1, 0.4, -8); g.add(pl);
    for (const z of [-18, 8]) { const em = emitter(M, 5, 3); em.position.set(sx * 6.3, 0.6, z); em.scale.x = sx; g.add(em); }
    g.add(band(M, 32, 0.7, sx * 6.05, 3, -4));
  }
  /* Doppelaufbau */
  const t1 = tower(M, [[8, 2.4, 16, 0], [6, 2.2, 9, -2], [4, 2, 4, -1]]); t1.position.set(0, 4.5, -12); g.add(t1);
  const t2 = tower(M, [[6, 1.8, 8, 0]]); t2.position.set(0, 4.5, 6); g.add(t2);
  g.add(at(antenna(M, 4.5, 0.15), 1.4, 11, -13)); const d = dish(M, 1.8); d.position.set(-1.6, 11, -14); g.add(d);
  for (const z of [12, -2]) { const t = turret(M, 1.8, 2, 2.6, F.armor); t.position.set(0, z > 0 ? 6.3 : 4.5, z === 12 ? 12 : -2); g.add(t); }
  for (const sx of [-1, 1]) { const a = archer(M, 3, 8, 2, 4); a.position.set(sx * 4, 4.4, -4); g.add(a); for (const z of [16, -24]) g.add(at(pdc(M, 0.9), sx * 5, 4.4, z)); }
  g.add(at(box(7, 1, 16, F.hangar, 0.2), 0, -4.05, 2));
  const e = engines(M, 3, 2, 1.6, 3.4, 3.2, 6); e.position.set(0, 0, -28); g.add(e);
  num(g, 'ACS-1102', 6.45, -1.6, 14, 1.6);
  lights(g, M, 6.8, 3.2, 26);
  return g;
});

/* Träger HAVEN – wie die Infinity: gespaltener Bug mit leuchtendem Hangar dazwischen, Flugdeck, Brückenturm,
   großer Triebwerksblock */
register('haven', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-40, 18, 10, 1, 3.6], [-26, 23, 11.5, 1, 4], [4, 23, 11, 1, 4], [12, 19, 10, 1, 3.4]], F.hull));
  for (const sx of [-1, 1]) {
    const p = loft([{ z: 10, pts: hsec(7.4, 10, 0.8, 3.2, 0).map(([x, y]) => [x + sx * 5.8, y]) }, { z: 30, pts: hsec(6.2, 8, 0.7, 2.6, 0.4).map(([x, y]) => [x + sx * 6.2, y]) }, { z: 41, pts: hsec(3, 3.4, 0.4, 1, 1).map(([x, y]) => [x + sx * 6.6, y]) }], F.hull);
    g.add(p);
    g.add(at(box(0.3, 1, 26, M.trim, 0.08), sx * 9.45, 2, 22, 0, -sx * 0.02));
    const pl = platesRow(M, 3, 0.6, 3.6, 6, 0.6, F.armor); pl.position.set(sx * 9.2, -0.6, 22); pl.rotation.y = -sx * 0.02; g.add(pl);
  }
  g.add(at(box(5.4, 7, 1, F.hangar, 0.3), 0, -0.2, 11.6));
  for (let i = 0; i < 6; i++) g.add(at(strip(M, 4.6, 0.12, 0.3, F.bore), 0, -3.4, 14 + i * 4));
  /* Flanken: Panzer, Hangarlichter, Archer */
  for (const sx of [-1, 1]) {
    const pl = platesRow(M, 5, 0.7, 4.4, 7, 0.8, F.armor); pl.position.set(sx * 11.6, 0.4, -12); g.add(pl);
    g.add(band(M, 40, 0.9, sx * 11.55, 3.4, -10));
    const a = archer(M, 6, 12, 3, 6); a.position.set(sx * 6.4, 5.9, -14); g.add(a);
    for (let k = 0; k < 3; k++) g.add(at(box(0.4, 2.2, 3.6, F.amber, 0.1), sx * 11.55, -3, 4 - k * 9));
    for (const z of [6, -30]) g.add(at(pdc(M, 1.1), sx * 9, 5.5, z));
  }
  /* Brückenturm */
  const tw = tower(M, [[7, 3, 14, 0], [5, 2.6, 8, -1.5], [3.6, 2.4, 4, -1]]); tw.position.set(0, 5.5, -22); g.add(tw);
  g.add(at(antenna(M, 6, 0.2), 1.4, 13.5, -24)); const d = dish(M, 2.2); d.position.set(-1.6, 13.5, -26); g.add(d);
  const e = engines(M, 4, 2, 2, 4.4, 4.2, 9); e.position.set(0, 0, -40); g.add(e);
  for (const sx of [-1, 1]) { const e2 = engines(M, 1, 2, 1.6, 3, 3.6, 7); e2.position.set(sx * 10.4, 0, -38); g.add(e2); }
  num(g, 'ACS HAVEN', 11.75, -0.8, -24, 3);
  lights(g, M, 9.9, 4.4, 40);
  return g;
});

/* Jäger – wie eine Longsword: breiter Nurflügler mit langer Nase und Doppeltriebwerk */
register('fighter', M => {
  const g = new THREE.Group(), F = fx(M);
  const shape = new THREE.Shape([new THREE.Vector2(0, 6.2), new THREE.Vector2(1.2, 3), new THREE.Vector2(6, -2.6), new THREE.Vector2(6, -4.2), new THREE.Vector2(2, -4.6), new THREE.Vector2(1.2, -6), new THREE.Vector2(-1.2, -6), new THREE.Vector2(-2, -4.6), new THREE.Vector2(-6, -4.2), new THREE.Vector2(-6, -2.6), new THREE.Vector2(-1.2, 3)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1 }); geo.rotateX(Math.PI / 2); geo.translate(0, 0.35, 0); uvScale(geo, 1 / 20);
  g.add(mesh(geo, F.hull));
  g.add(at(box(1.6, 0.9, 5, F.armor, 0.3), 0, 0.6, 0));
  g.add(at(box(1, 0.4, 1.6, F.slit, 0.15), 0, 1.05, 2.4, -0.2));
  for (const sx of [-1, 1]) { const e = engine(M, 0.6, 0.8, 2.4, F.glowE); e.position.set(sx * 1, 0.4, -6); g.add(e); g.add(at(box(0.15, 0.15, 3, M.trim, 0.04), sx * 5.4, 0.6, -3.4)); }
  return g;
});

/* Flaggschiff ARCHIPELAGO – Super-Träger: riesiger Hammerbug mit schwerer MAC, gestufte Aufbauten mit hohem
   Kommandoturm, Flankenbatterien, Feldwerft-Gerüst unter dem Bauch, Triebwerkswand */
register('archipelago', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-43, 16, 10, 1, 3.4], [-28, 20, 12, 1, 4], [8, 19, 11.4, 1, 3.8], [22, 15, 10, 0.8, 3.2, -0.4]], F.hull));
  /* Hammerbug */
  g.add(hl([[20, 24, 9, 0.8, 2.6, 0.4], [36, 25, 8.6, 0.8, 2.4, 0.4], [43, 19, 6.4, 0.6, 1.6, 0.3]], F.hull));
  const b = bore(M, 5, 3.4); b.position.set(0, 0.6, 43.1); g.add(b);
  for (const sx of [-1, 1]) { const b2 = bore(M, 1.8, 1.2); b2.position.set(sx * 6, 0.8, 42.8); g.add(b2); }
  g.add(at(box(25, 1, 14, F.armor, 0.3), 0, 4.8, 31));
  /* Flanken: Sponsons mit Archer und Türmen, Panzergürtel, Bänder */
  for (const sx of [-1, 1]) {
    { const sp = hl([[-30, 5, 6, 0.5, 1.6], [10, 5.4, 6.4, 0.5, 1.8], [16, 3, 4, 0.4, 1]], F.armor); sp.position.set(sx * 12, -0.8, 0); g.add(sp); }
    const a = archer(M, 4, 16, 2, 8); a.position.set(sx * 12, 2.8, -8); g.add(a);
    for (const z of [8, -20]) { const t = turret(M, 1.6, 2, 2.4, F.armor); t.position.set(sx * 12, 2.4, z); g.add(t); }
    const pl = platesRow(M, 6, 0.7, 4.6, 6, 0.7, F.armor); pl.position.set(sx * 12.5, 4.4, 12); g.add(pl);
    g.add(band(M, 60, 1, sx * 12.55, 6.4, 6));
    for (const z of [30, -38]) g.add(at(pdc(M, 1.2), sx * 9, 5.6, z));
  }
  /* gestufte Aufbauten und Kommandoturm */
  const t1 = tower(M, [[12, 3, 34, 0], [9, 3, 22, -4], [7, 3, 12, -6]]); t1.position.set(0, 5.6, -12); g.add(t1);
  const ct = tower(M, [[5, 3.4, 6, 0], [4, 3, 4.4, 0], [5.4, 2, 5, 0.4]]); ct.position.set(0, 14.6, -20); g.add(ct);
  g.add(at(antenna(M, 8, 0.25), 1.8, 23.4, -21)); g.add(at(antenna(M, 6, 0.2), -1.8, 23.4, -19)); const d = dish(M, 2.6); d.position.set(0, 14.6, -8); g.add(d);
  for (const z of [16, 0]) { const t = turret(M, 2.4, 3, 2.8, F.armor); t.position.set(0, z ? 5.6 : 8.6, z ? 16 : 2); g.add(t); }
  /* Feldwerft unter dem Bauch */
  const yard = new THREE.Group();
  for (let k = 0; k < 5; k++) { const fr = new THREE.Group(); for (const sx of [-1, 1]) fr.add(at(box(1, 7, 1, F.armor, 0.2), sx * 7, -3.5, 0)); fr.add(at(box(15, 1, 1, F.armor, 0.2), 0, -7, 0)); fr.add(at(strip(M, 13, 0.3, 0.4, F.bore), 0, -6.4, 0.6)); fr.add(at(navLight(M, 0.35, 'light', 0.4), sx0(k) * 7, -7.6, 0)); fr.position.z = 12 - k * 8; yard.add(fr); }
  for (const sx of [-1, 1]) yard.add(at(box(0.8, 0.8, 36, F.dark, 0.2), sx * 7, -7, -4));
  yard.position.y = -5.8; g.add(yard);
  /* Triebwerkswand */
  const e = engines(M, 4, 2, 2.4, 4.8, 4.8, 10); e.position.set(0, 0, -43); g.add(e);
  for (const sx of [-1, 1]) { const e2 = engines(M, 1, 2, 2, 3.6, 4, 8); e2.position.set(sx * 12, -0.8, -30); g.add(e2); }
  num(g, 'ACS ARCHIPELAGO', 12.55, 1.2, 30, 2.6);
  lights(g, M, 12.6, 4.6, 42);
  return g;
});
function sx0(k) { return k % 2 ? 1 : -1; }

/* AEGIS (Charter Guard) – Zerstörer mit Schildkuppel-Projektor: gepanzerter Ring auf dem Rücken, darin der
   leuchtende Kern, drehende Ringsegmente */
register('aegis', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-26, 9, 7, 0.8, 2.6], [-8, 11, 8, 0.8, 2.8], [12, 10, 7.4, 0.7, 2.6, -0.3], [20, 8, 6, 0.6, 2, -0.5]], F.hull));
  g.add(hl([[18, 11, 5.6, 0.6, 1.8, 0], [24, 11.4, 5, 0.6, 1.6, 0], [26.4, 8.4, 3.6, 0.5, 1, 0]], F.hull));
  const b = bore(M, 2.4, 1.8); b.position.set(0, 0.2, 26.5); g.add(b);
  /* Projektor: gepanzerte Ringschale, Kern, drehende Segmentringe */
  const pr = new THREE.Group();
  pr.add(at(cyl(5.4, 6, 2.6, F.armor, 8), 0, 0, 0, Math.PI / 2));
  const core = sphere(3.2, F.shield, 20, 14); core.position.y = 2.2; core.userData.pulse = { amp: 0.08, speed: 3 }; pr.add(core);
  const cage = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, seg = box(1.2, 4.6, 0.9, F.hull, 0.2); seg.position.set(Math.cos(a) * 4.6, 2.6, Math.sin(a) * 4.6); seg.rotation.y = -a; cage.add(seg); }
  cage.userData.spin = { axis: 'y', speed: 0.5 }; pr.add(cage);
  const ring = mesh(new THREE.TorusGeometry(5.8, 0.35, 6, 6), M.trim, false); ring.rotation.x = Math.PI / 2; ring.position.y = 4.9; const rp = new THREE.Group(); rp.add(ring); rp.userData.spin = { axis: 'y', speed: -0.3 }; pr.add(rp);
  pr.position.set(0, 4.6, -4); g.add(pr);
  for (const sx of [-1, 1]) { const em = emitter(M, 5, 3); em.position.set(sx * 5.6, 0.6, 6); em.scale.x = sx; g.add(em); g.add(band(M, 26, 0.6, sx * 5.55, 2.8, -6)); const pl = platesRow(M, 3, 0.5, 3.6, 5, 0.5, F.armor); pl.position.set(sx * 5.4, 0.2, -16); g.add(pl); }
  const tw = tower(M, [[5, 2, 8, 0], [3.6, 1.8, 4, -1]]); tw.position.set(0, 3.6, -18); g.add(tw);
  for (const z of [12, 18]) g.add(at(pdc(M, 0.9), 0, 3.4, z));
  const e = engines(M, 3, 2, 1.4, 3, 2.8, 5); e.position.set(0, 0, -26); g.add(e);
  num(g, 'ACS-C7', 5.75, -1.4, 12, 1.4);
  lights(g, M, 5.8, 2.6, 24);
  return g;
});

/* BEACON (Explorer Corps) – Sensor-Vorposten: langer schmaler Rumpf, große Sensorschüssel vorn,
   Antennenfeld, seitliche Sensorausleger mit Lichtern, unbewaffnet */
register('beacon', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-15, 4.6, 4, 0.5, 1.2], [4, 5, 4.2, 0.5, 1.3], [10, 3.6, 3.2, 0.4, 1, -0.2]], F.hull));
  const dd = new THREE.Group(); const dsh = mesh(new THREE.SphereGeometry(4.2, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), F.armor); dsh.rotation.x = Math.PI / 2; dd.add(dsh);
  const feed = mesh(new THREE.ConeGeometry(0.25, 3.4, 6), F.dark); feed.rotation.x = Math.PI / 2; feed.position.z = 2; dd.add(feed); dd.add(at(navLight(M, 0.3, 'light', 0.5), 0, 0, 3.7));
  const piv = new THREE.Group(); piv.add(dd); piv.position.set(0, 0.4, 12); piv.userData.sway = { axis: 'y', amp: 0.35, speed: 0.3 }; g.add(piv);
  g.add(at(box(2, 2, 2, F.armor, 0.3), 0, 0.4, 10.4));
  /* Antennenfeld */
  for (let i = 0; i < 4; i++) g.add(at(antenna(M, 2.4 + (i % 2) * 1.4, 0.1), (i % 2 ? 1 : -1) * 1.2, 2.1, -10 + i * 3.4));
  /* Sensorausleger */
  for (const sx of [-1, 1]) {
    const boom = new THREE.Group(); boom.add(box(9, 0.6, 1, F.armor, 0.15)); boom.add(at(box(1, 0.4, 6, F.dark, 0.1), sx * 4.4, 0, 0));
    for (let i = 0; i < 4; i++) boom.add(at(navLight(M, 0.22, 'light', 0.3 + i * 0.1), sx * 4.4, 0.35, -2.4 + i * 1.6));
    boom.position.set(sx * 6.2, 0.4, -4); g.add(boom);
  }
  const tw = tower(M, [[3.4, 1.6, 5, 0]]); tw.position.set(0, 2.1, 2); g.add(tw);
  const e = engines(M, 2, 1, 1.1, 2.4, 2, 4); e.position.set(0, 0, -15); g.add(e);
  for (const sx of [-1, 1]) g.add(band(M, 16, 0.5, sx * 2.55, 1, -4));
  num(g, 'ACS-E1', 2.55, -0.6, 2, 0.9);
  return g;
});

/* RECKONING (Hardliners) – Fregatte mit Kinn-Bug und Erbauer-Lanze als Spinal-Kanone, dunkle Panzerung,
   rote Streifen der Hardliner */
register('reckoning', M => {
  const g = new THREE.Group(), F = fx(M);
  g.add(hl([[-28, 10, 7, 0.8, 2.4], [-12, 13, 8.4, 0.8, 2.8], [8, 11, 7.6, 0.8, 2.6], [18, 7, 5.4, 0.6, 1.8, -0.8], [24, 3, 2.6, 0.3, 0.8, -1.6]], F.armor));
  const tw = tower(M, [[7, 2.4, 18, 0], [5, 2, 8, -3], [3.4, 1.8, 4, -2]], F.hull); tw.position.set(0, 4.2, -12); g.add(tw);
  /* Lanze unter dem Kiel */
  const barrel = cyl(1.4, 1.1, 46, F.dark, 12); barrel.position.set(0, -4.6, 4); g.add(barrel);
  for (let i = 0; i < 8; i++) { g.add(at(box(3.4, 2.8, 1.4, i % 2 ? F.armor : F.hull, 0.3), 0, -4.6, -16 + i * 5)); g.add(at(mesh(new THREE.TorusGeometry(1.6, 0.18, 6, 20), F.lance, false), 0, -4.6, -13.5 + i * 5)); }
  const tip = sphere(1, F.lance, 12, 8); tip.position.set(0, -4.6, 27.4); tip.userData.pulse = { amp: 0.25, speed: 4 }; g.add(tip);
  const mz = mesh(new THREE.CylinderGeometry(2.2, 1.4, 3, 8, 1, true), F.dark); mz.rotation.x = Math.PI / 2; mz.position.set(0, -4.6, 27); g.add(mz);
  for (const sx of [-1, 1]) { const a = archer(M, 3.6, 8, 2, 4); a.position.set(sx * 3.8, 3.7, -18); g.add(a); const pl = platesRow(M, 3, 0.6, 3.6, 6, 0.6, F.hull); pl.position.set(sx * 6.6, 0.4, -6); g.add(pl); g.add(at(box(0.3, 1.2, 30, F.red, 0.1), sx * 6.25, 2.2, -6)); }
  for (const [x, z] of [[0, 10], [-3.6, -4], [3.6, -4]]) { const t = turret(M, 1.3, 2, 2.2, F.hull); t.position.set(x, x ? 3.8 : 3.6, z); g.add(t); }
  const e = engines(M, 2, 2, 1.6, 3.4, 3.2, 6); e.position.set(0, 0, -28); g.add(e);
  num(g, 'ACS-H66', 6.45, -1, 8, 1.5);
  return g;
});

/* für die Stationen (stations/alliance.js) */
export { fx, hsec, hl, bore, engines, tower, archer, pdc, emitter, num, band, lights };
