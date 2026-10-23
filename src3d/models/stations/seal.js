/* =====================================================================
   DAS SIEGEL – Erbauer-Tor in der Kartenmitte (Quarantine Line), das nie geöffnet werden darf. Gehört niemandem,
   alle halten es gemeinsam. Formensprache der Erbauer-Wächter (factions/guardian.js): geschliffener grüngrauer Stein,
   eingeschnittene Glyphen, die mintgrün glühen, langsam kreisende Ringe, ein einziges Auge.
   Aufbau: schwere Ringplattform mit Kiel darunter; in der Mitte ein Schacht, darin der Wirbel des Tors (verriegelt);
   über dem Wirbel der Torring und vier Riegel, die in der Mitte an einem Schloss mit halb geschlossenem Auge enden;
   acht Obelisken am Rand. Stufe II: zweiter, gegenläufiger Glyphenring und zwei Lanzentürme auf Obelisken.
   Stufe III: vier Lanzentürme (zwei davon schwere Lanzen), zwei Abwehraugen, Bögen zwischen den Obelisken.
   Kennzeichen sealLight: Lichter, die im Spiel mit der Hülle schwächer werden (rot unter einem Drittel).
   ===================================================================== */
import * as THREE from 'three';
import { registerB, mesh, at } from '../kit.js';
import { gm, band, lineRing, lance, eye, halo, limb, limbLine } from '../factions/guardian.js';

const TAU = Math.PI * 2;
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
/* Drehkörper um Y mit harten Kanten und eigener Texturwiederholung (su rundum, sv Profil) */
function rev(key, prof, mat, seg = 64, su = 4, sv = 1) {
  const g = geo('rev|' + key, () => {
    const pts = []; prof.forEach(([r, y], i) => { const v = new THREE.Vector2(Math.max(r, 0.001), y); pts.push(v); if (i > 0 && i < prof.length - 1) pts.push(v.clone()); });
    const l = new THREE.LatheGeometry(pts, seg), uv = l.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return l;
  });
  return mesh(g, mat);
}
/* Ring der Wächter (band liegt um die Z-Achse) flach in die XZ-Ebene legen */
function flat(o) { const g = new THREE.Group(); o.rotation.x = Math.PI / 2; g.add(o); return g; }
/* Wirbel des Tors: Spiralarme auf dunklem Grund (Leuchtkarte, additiv) */
let VTEX = null;
function vortexTex() {
  if (VTEX) return VTEX;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(190,255,225,0.85)'); g.addColorStop(0.45, 'rgba(90,220,160,0.28)'); g.addColorStop(1, 'rgba(40,120,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.lineCap = 'round';
  for (let arm = 0; arm < 5; arm++) for (let k = 0; k < 3; k++) {
    x.strokeStyle = `rgba(200,255,230,${0.55 - k * 0.15})`; x.lineWidth = 9 - k * 3; x.beginPath();
    for (let i = 0; i <= 80; i++) { const t = i / 80, a = arm / 5 * TAU + t * 4.2 + k * 0.08, r = 14 + t * 236; x.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); }
    x.globalAlpha = 1; x.stroke();
  }
  const fade = x.createRadialGradient(256, 256, 120, 256, 256, 256); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = fade; x.fillRect(0, 0, 512, 512);
  VTEX = new THREE.CanvasTexture(c); VTEX.colorSpace = THREE.SRGBColorSpace; return VTEX;
}
const SM = new WeakMap();
function sm(M) {
  let S = SM.get(M); if (S) return S;
  const G = gm(M);
  S = {
    G,
    vortex: new THREE.MeshBasicMaterial({ map: vortexTex(), color: new THREE.Color('#9ff0c0').multiplyScalar(1.05), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    vortex2: new THREE.MeshBasicMaterial({ map: vortexTex(), color: new THREE.Color('#c8fff0').multiplyScalar(0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  };
  SM.set(M, S); return S;
}
/* Obelisk: verjüngter Vierkant aus Stein, Glyphenlinie auf der Innenseite, Lichtkristall oben (sealLight) */
function obelisk(G, h, w) {
  const g = new THREE.Group();
  const body = mesh(geo('ob|' + h + '|' + w, () => { const b = new THREE.CylinderGeometry(w * 0.55, w, h, 4, 1); b.rotateY(Math.PI / 4); b.translate(0, h / 2, 0); const uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * h / 22); return b; }), G.stone);
  g.add(body);
  const cap = mesh(geo('obCap|' + w, () => new THREE.ConeGeometry(w * 0.55 * Math.SQRT2 * 0.72, w * 1.6, 4).rotateY(Math.PI / 4).translate(0, w * 0.8, 0)), G.stoneDark); cap.position.y = h; g.add(cap);
  g.add(limbLine(G, [-w * 0.72, 1.5, 0], [-w * 0.42, h - 2, 0], 0.16));
  const foot = mesh(geo('obFoot|' + w, () => new THREE.CylinderGeometry(w * 1.25, w * 1.45, 2.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0)), G.stoneDark); g.add(foot);
  const gem = mesh(geo('obGem', () => new THREE.OctahedronGeometry(1.5, 0)), G.iris, false); gem.scale.set(1, 1.6, 1); gem.position.set(-w * 0.62, h * 0.72, 0); gem.userData.sealLight = true; gem.userData.pulse = { amp: 0.06, speed: 1.1 }; g.add(gem);
  return g;
}
/* Lanzenturm der Erbauer auf einem Obelisken: Sockelring, schwenkbarer Kopf mit Lanze (Bug +Z) */
function wardTurret(G, heavy, phase) {
  const g = new THREE.Group();
  g.add(rev('wtBase' + (heavy ? 'H' : ''), heavy ? [[0, 0], [5.4, 0], [5.8, 1.6], [4.6, 3.2], [0, 3.4]] : [[0, 0], [4.4, 0], [4.8, 1.4], [3.8, 2.8], [0, 3]], G.stoneDark, 24, 2, 0.4));
  const head = new THREE.Group(); head.position.y = 3; head.userData.aim = { phase };
  head.add(rev('wtHead' + (heavy ? 'H' : ''), heavy ? [[0, 0], [4.4, 0], [4.8, 2.2], [3.2, 4.6], [0, 5.2]] : [[0, 0], [3.5, 0], [3.8, 1.8], [2.6, 3.8], [0, 4.2]], G.stone, 20, 2, 0.5));
  const ln = lance(G, heavy ? 17 : 11, heavy ? 1.25 : 0.85); ln.position.set(0, heavy ? 2.4 : 2, heavy ? 2 : 1.6); head.add(ln);
  const e = eye(G, heavy ? 1.6 : 1.2); e.position.set(0, heavy ? 4.6 : 3.7, -0.6); e.rotation.x = -0.9; head.add(e);
  g.add(head);
  return g;
}
registerB('guardian', 'seal', (M, d, lv) => {
  const S = sm(M), G = S.G, g = new THREE.Group();
  /* Ringplattform: Innenrand 50 (Schacht), Außenrand 77, gefaste Kanten; darunter der Kiel bis zum Schachtboden */
  g.add(rev('plat', [[50, -10], [64, -12.5], [73, -8.5], [77, -2.5], [77, 3], [74, 6], [55, 6], [51, 3.5], [50, -10]], G.stoneBig, 96, 5, 1));
  g.add(rev('keel', [[0, -50], [9, -46], [16, -38], [26, -30], [36, -22], [46, -14], [50, -10.5], [50, -7], [0, -7]], G.stoneDark, 64, 5, 1.2));
  /* Kielspitze mit Glutkern und Glyphenringen am Kiel */
  const kg = mesh(geo('keelGem', () => new THREE.OctahedronGeometry(3, 0)), G.iris, false); kg.scale.set(1, 1.8, 1); kg.position.y = -53; kg.userData.pulse = { amp: 0.08, speed: 0.9 }; g.add(kg);
  g.add(at(halo(G, 18), 0, -53, 0));
  for (const [y, R] of [[-22, 36.2], [-38, 16.2]]) g.add(at(flat(lineRing(G, R, 0.22, 64)), 0, y, 0));
  /* Glutfugen auf der Plattform: Außenkante und Schachtrand */
  g.add(at(flat(lineRing(G, 75.2, 0.3, 96)), 0, 4.6, 0));
  g.add(at(flat(lineRing(G, 53, 0.26, 72)), 0, 5.9, 0));
  /* Platten zwischen den Obelisken: erhabene Steinplatten mit Inschriftfuge */
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * TAU, p = new THREE.Group(); p.rotation.y = -a;
    p.add(at(mesh(geo('slab', () => { const b = new THREE.BoxGeometry(12, 1.6, 22); const uv = b.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.6, uv.getY(k) * 0.6); return b; }), G.stone), 64, 6.8, 0));
    p.add(at(mesh(geo('slabLine', () => new THREE.BoxGeometry(0.35, 0.3, 16)), G.line, false), 64, 7.7, 0));
    g.add(p);
  }
  /* Schachtboden: Wirbel aus zwei gegenläufigen Spiralscheiben, darunter dunkler Grund */
  g.add(at(rev('floor', [[0, -7.2], [50, -7.2], [50, -6.8], [0, -6.8]], G.deep, 48, 1, 1), 0, 0, 0));
  const v1 = mesh(geo('vdisc', () => new THREE.CircleGeometry(48, 64).rotateX(-Math.PI / 2)), S.vortex, false); v1.position.y = -5.6; v1.userData.spin = { axis: 'y', speed: -0.35 }; v1.renderOrder = 3; g.add(v1);
  const v2 = mesh(geo('vdisc', () => new THREE.CircleGeometry(48, 64).rotateX(-Math.PI / 2)), S.vortex2, false); v2.position.y = -3.8; v2.scale.setScalar(0.78); v2.rotation.y = 1; v2.userData.spin = { axis: 'y', speed: 0.22 }; v2.renderOrder = 3; g.add(v2);
  const vh = halo(G, 70); vh.position.y = -2; vh.material = vh.material.clone(); vh.material.opacity = 0.45; vh.userData.sealLight = true; g.add(vh);
  /* Torring über dem Wirbel: Steinband mit 20 Glyphenknoten, dreht langsam */
  const tr = new THREE.Group(); tr.position.y = 1; tr.userData.spin = { axis: 'y', speed: 0.05 };
  tr.add(flat(band(44, 6, 2.6, G.stoneRing, 72)));
  tr.add(at(flat(lineRing(G, 41.2, 0.2, 72)), 0, 2.2, 0)); tr.add(at(flat(lineRing(G, 41.2, 0.2, 72)), 0, -2.2, 0));
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, n = mesh(geo('trNode', () => new THREE.BoxGeometry(3.2, 7.4, 2.2)), G.stoneDark); n.position.set(Math.cos(a) * 46.8, 0, Math.sin(a) * 46.8); n.rotation.y = -a; tr.add(n); if (i % 2 === 0) { const l = mesh(geo('trNodeL', () => new THREE.BoxGeometry(0.5, 4.6, 0.4)), G.line, false); l.position.set(Math.cos(a) * 48, 0, Math.sin(a) * 48); l.rotation.y = -a; tr.add(l); } }
  g.add(tr);
  /* vier Riegel vom Torring zum Schloss, dreht kaum merklich */
  const bars = new THREE.Group(); bars.position.y = 4.5; bars.userData.spin = { axis: 'y', speed: 0.02 };
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    bars.add(limb(G, [ca * 10, 0, sa * 10], [ca * 45, 0, sa * 45], 5.2, 3.6, G.stone));
    bars.add(limbLine(G, [ca * 12, 1.9, sa * 12], [ca * 43, 1.9, sa * 43], 0.2));
    /* Klammer am Ring */
    const cl = mesh(geo('clamp', () => new THREE.BoxGeometry(8, 6, 7)), G.stoneDark); cl.position.set(ca * 45, -0.5, sa * 45); cl.rotation.y = -a; bars.add(cl);
  }
  g.add(bars);
  /* Schloss in der Mitte: Steintrommel mit dem halb geschlossenen Auge, das nach oben blickt */
  g.add(rev('lock', [[0, -4], [12, -4], [13, 0], [12.6, 4.5], [10.5, 8], [7, 9.6], [0, 9.8]], G.stone, 40, 3, 0.6));
  g.add(at(flat(lineRing(G, 12.9, 0.22, 48)), 0, 1.5, 0));
  const ey = eye(G, 5.6, { lid: true }); ey.position.y = 8.6; ey.rotation.x = -Math.PI / 2; ey.userData.sealLight = true; g.add(ey);
  /* acht Obelisken am Rand, leicht nach innen geneigt; auf Stufe III höher */
  const oh = lv >= 3 ? 34 : 28, tur = lv >= 3 ? [0, 2, 4, 6] : lv >= 2 ? [0, 4] : [];
  const tops = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, p = new THREE.Group(); p.rotation.y = -a;
    const ob = obelisk(G, tur.includes(i) ? oh - 8 : oh, 4.2); ob.position.set(65.5, 6, 0); ob.rotation.z = 0.07; p.add(ob);
    if (tur.includes(i)) { const t = wardTurret(G, lv >= 3 && i % 4 === 2, i * 1.3); t.scale.setScalar(1.45); t.position.set(65.5 - (oh - 8) * 0.07, 6 + oh - 8 + 0.3, 0); p.add(t); }
    tops.push([Math.cos(a) * (65.5 - oh * 0.07), 6 + oh + 4, Math.sin(a) * (65.5 - oh * 0.07)]);
    g.add(p);
  }
  /* Stufe II: zweiter Glyphenring über der Plattform, gegenläufig, mit Kristallknoten */
  if (lv >= 2) {
    const r2 = new THREE.Group(); r2.position.y = 14; r2.userData.spin = { axis: 'y', speed: -0.08 };
    r2.add(flat(band(57.5, 2.4, 1.1, G.stoneRing, 96))); r2.add(flat(lineRing(G, 58.8, 0.16, 96)));
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.26, n = mesh(geo('r2Node', () => new THREE.OctahedronGeometry(1.4, 0)), G.iris, false); n.position.set(Math.cos(a) * 59.6, 0, Math.sin(a) * 59.6); r2.add(n); }
    /* Halter: vier dünne Steinarme von der Plattform zum Ring */
    g.add(r2);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 8; g.add(limb(G, [Math.cos(a) * 54, 6, Math.sin(a) * 54], [Math.cos(a) * 57, 12.6, Math.sin(a) * 57], 1.4, 1.4, G.stoneDark)); }
  }
  /* Stufe III: schwebende Krone über dem Schloss (Glyphenring mit acht Steinen), Lichtkristalle über den Obelisken,
     zwei Abwehraugen auf der Plattform */
  if (lv >= 3) {
    const cr = new THREE.Group(); cr.position.y = 26; cr.userData.spin = { axis: 'y', speed: 0.12 };
    cr.add(flat(band(17, 2, 0.9, G.stoneRing, 64))); cr.add(flat(lineRing(G, 18.1, 0.14, 64)));
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, st = mesh(geo('crStone', () => new THREE.OctahedronGeometry(1, 0)), k % 2 ? G.iris : G.stoneDark); st.scale.set(1.6, 3.4, 1.6); st.position.set(Math.cos(a) * 19.5, 0, Math.sin(a) * 19.5); cr.add(st); }
    cr.userData.bob = { amp: 1.2, speed: 0.5, y0: 26 }; g.add(cr);
    g.add(at(halo(G, 26), 0, 26, 0));
    for (let i = 0; i < 8; i++) { if (tur.includes(i)) continue; const T = tops[i], c = mesh(geo('obFloat', () => new THREE.OctahedronGeometry(1.8, 0)), G.iris, false); c.scale.set(1, 1.7, 1); c.position.set(T[0], T[1] + 3, T[2]); c.userData.bob = { amp: 0.8, speed: 0.7, y0: T[1] + 3 }; c.userData.sealLight = true; g.add(c); g.add(at(halo(G, 10), T[0], T[1] + 3, T[2])); }
    for (const a of [Math.PI / 8 + Math.PI / 2, Math.PI / 8 + Math.PI * 1.5]) {
      const pd = new THREE.Group(); pd.position.set(Math.cos(a) * 64, 7.6, Math.sin(a) * 64);
      pd.add(mesh(geo('pdDome', () => new THREE.SphereGeometry(3.2, 16, 8, 0, TAU, 0, Math.PI / 2)), G.stoneDark));
      const e = eye(G, 1.3); e.position.y = 2.6; e.rotation.x = -1.1; const h = new THREE.Group(); h.userData.aim = { phase: a * 2 }; h.add(e); pd.add(h);
      g.add(pd);
    }
  }
  return g;
});
/* Helfer für die Erbauer-Stätten (world/sites.js) */
export { flat, vortexTex, obelisk, sm };
