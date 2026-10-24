/* =====================================================================
   Rift Armada 3D – die Karte: Sternenhimmel, Felsen (instanziert je Grundform), Vorkommen (Eismonde, Erz),
   Asteroidenfelder (alle Felder zu wenigen Puffern verschmolzen), Nebelzonen, Aschenebel am Rand, Erbauer-
   Stätten und Sprungtore (je Zustand neu gebaut). Spielkoordinaten x → X, y → Z, Modelle auf Y = 0.
   Entscheidungen:
   - Himmel: zwei große Ebenen UNTER dem Boden (Y = −2600 mit Nebelschwaden und feinen Sternen, Y = −900 mit
     wenigen hellen Sternen) statt einer Himmelstextur – die Perspektive gibt so von selbst Parallaxe beim
     Schwenken (≈ 0,3 und 0,55 bei Zoom 1), dazu ein Gasriese am Rand. Alles kachelt nahtlos.
   - Felder: über 60 Felder → keine Splitterwolken, nur Staub (Spec). Die langsamen Drehungen der Staubschleier
     entfallen (eingebacken), damit alle Felder der Karte zusammen ≈ 10 Draw-Calls kosten.
   - Nebelzonen: BUILDW.neb gibt es nicht → drei weiche Scheiben je Zone (violett = Ion, rotbraun = Asche), die
     wie in 2D langsam treiben.
   - Erschöpfte Vorkommen schrumpfen auf 80 %; Abbau-Ringe, Fortschritts- und Besitzringe der Stätten kommen
     aus overlay.js.
   ===================================================================== */
import * as THREE from 'three';
import { BUILDW, mats, animate, bake, applyCharge, rng, keepFor } from './models/kit.js';
import { S, CAM_DIR, onScale } from './scene.js';
import { CAM, inView } from './camera.js';
import { ring } from './overlay.js';

const EDGE = 110, TAU = Math.PI * 2;
const W = { root: null, sky: null, anim: null, nodes: [], nebs: [], sites: new Map(), gates: new Map(), fieldsN: 0, map: null };

/* ------------------------------------------------------------ Himmel
   Tiefe Ebene (Y = −2600) mit Nebelschwaden, darüber Sterne als Punkte in fester Pixelgröße (ohne Größen-
   dämpfung) in zwei Tiefen: viele feine bei −2600, wenige helle mit weichem Hof bei −900. Punkte bleiben bei jedem
   Zoom scharf, die Perspektive liefert die Parallaxe. Dazu ein Gasriese neben der Karte, weit hinten. */
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function skyDeep() {
  return canvas(1024, 1024, (x, w, h) => {
    const r = rng(11);
    /* Wie in Armada 2: fast schwarzer Raum, nur hier und da eine schwache Nebelschwade */
    x.fillStyle = '#020308'; x.fillRect(0, 0, w, h);
    /* Nebelschwaden, an den Rändern wiederholt, damit die Kachel nahtlos bleibt (kein Verlauf: der wäre eine Naht) */
    for (let i = 0; i < 9; i++) {
      const cx = r() * w, cy = r() * h, rr = 160 + r() * 300, t = r(), col = t < 0.45 ? '70,50,120' : t < 0.8 ? '30,70,100' : '110,60,45', al = 0.03 + r() * 0.04;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { const gr = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(cx + ox - rr, cy + oy - rr, rr * 2, rr * 2); }
    }
  });
}
function dotCanvas() { return canvas(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }); }
/* Sternpunkte: n Stück über ext × ext um (cx, cz) in Höhe y; Farben weiß/blau/warm mit Helligkeit */
function stars(n, ext, cx, y, cz, seed, size, map, bright) {
  const r = rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos[i * 3] = cx + (r() - 0.5) * ext; pos[i * 3 + 1] = y; pos[i * 3 + 2] = cz + (r() - 0.5) * ext;
    const t = r(), b = bright * (0.35 + r() * 0.65);
    c.set(t < 0.1 ? '#aac8ff' : t < 0.18 ? '#ffdcb4' : t < 0.22 ? '#ffb4a0' : '#e6ecff').multiplyScalar(b);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: map || null, transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false });
  /* Punktgröße in Bildpunkten der Leinwand: mit der Render-Skalierung mitführen (gleich groß in CSS-Pixeln, mindestens
     1 Bildpunkt – sonst flimmern feine Sterne bei kleiner Skalierung) */
  onScale(sc => { m.size = Math.max(1, size * sc); });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9; return p;
}
/* Gasriese: Bänder, Beleuchtung von links oben, Ring (alles innerhalb der Leinwand) */
function planetCanvas(seed) {
  return canvas(512, 512, (x, S, _h) => {
    const r = rng(seed), cx = 256, cy = 256, pr = 108, cols = seed % 2 ? [[210, 150, 90], [150, 90, 60], [240, 200, 150]] : [[120, 150, 200], [70, 90, 150], [190, 210, 230]];
    const ringF = (front) => { x.save(); x.translate(cx, cy); x.scale(1, 0.28); x.beginPath(); x.arc(0, 0, pr * 2.1, front ? 0 : Math.PI, front ? Math.PI : TAU); x.arc(0, 0, pr * 1.35, front ? Math.PI : TAU, front ? 0 : Math.PI, true); x.closePath(); const g = x.createRadialGradient(0, 0, pr * 1.35, 0, 0, pr * 2.1); g.addColorStop(0, 'rgba(220,210,190,0.5)'); g.addColorStop(0.5, 'rgba(230,220,200,0.55)'); g.addColorStop(1, 'rgba(200,190,170,0)'); x.fillStyle = g; x.fill(); x.restore(); };
    ringF(false);
    x.save(); x.beginPath(); x.arc(cx, cy, pr, 0, TAU); x.clip();
    x.fillStyle = `rgb(${cols[1].join(',')})`; x.fillRect(0, 0, S, S);
    for (let yy = -pr; yy < pr; yy += 3) { const t = 0.5 + 0.5 * Math.sin(yy * 0.07 + r() * 0.6) * Math.sin(yy * 0.023), ca = cols[0], cb = cols[2]; x.fillStyle = `rgba(${(ca[0] + (cb[0] - ca[0]) * t) | 0},${(ca[1] + (cb[1] - ca[1]) * t) | 0},${(ca[2] + (cb[2] - ca[2]) * t) | 0},${0.5 + r() * 0.4})`; const w = Math.sqrt(1 - (yy / pr) ** 2) * pr; x.fillRect(cx - w, cy + yy, w * 2, 3.2); }
    const lg = x.createRadialGradient(cx - pr * 0.5, cy - pr * 0.5, pr * 0.1, cx, cy, pr * 1.05); lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(0.45, 'rgba(255,255,255,0)'); lg.addColorStop(0.75, 'rgba(0,0,20,0.45)'); lg.addColorStop(1, 'rgba(0,0,20,0.92)'); x.fillStyle = lg; x.fillRect(0, 0, S, S);
    x.restore();
    ringF(true);
  });
}
function buildSky(map) {
  const g = new THREE.Group(); g.name = 'sky';
  const ext = Math.max(map.w, map.h) + 18000, cx = map.w / 2, cz = map.h / 2;
  const t1 = new THREE.CanvasTexture(skyDeep()); t1.colorSpace = THREE.SRGBColorSpace; t1.wrapS = t1.wrapT = THREE.RepeatWrapping; t1.repeat.set(ext / 2200, ext / 2200); t1.anisotropy = 4;
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(ext, ext).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t1, depthWrite: false, fog: false })); p1.position.set(cx, -2600, cz); p1.renderOrder = -10; p1.frustumCulled = false; g.add(p1);
  const dot = new THREE.CanvasTexture(dotCanvas());
  /* wenige, kleine, gedämpfte Sterne – kein Glitzern, keine helle Nahschicht */
  g.add(stars(Math.round(ext * ext / 90000), ext, cx, -2590, cz, 23, 1.0, null, 0.45));
  g.add(stars(Math.round(ext * ext / 900000), ext, cx, -2580, cz, 29, 1.6, null, 0.6));
  void dot;
  /* Gasriese weit hinten, rechts oben neben der Karte */
  const t3 = new THREE.CanvasTexture(planetCanvas(map.id === 'ashfall' ? 3 : 2)); t3.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t3, transparent: true, depthWrite: false, fog: false }));
  pl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), CAM_DIR); pl.scale.setScalar(1700); pl.position.set(map.w * 1.12, -2500, -map.h * 0.12); pl.renderOrder = -9; g.add(pl);
  return g;
}

/* ------------------------------------------------------------ Kartenobjekte */
function buildW(o, M) {
  const fn = BUILDW[o.kind];
  if (fn) return fn(M || mats('guardian'), o);
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, o.r * 0.3, 24, 1), new THREE.MeshStandardMaterial({ color: '#765', wireframe: true }))); return g;
}
function put(parent, g, x, y, ry) { g.position.set(x, 0, y); g.rotation.y = ry || 0; parent.add(g); return g; }
function shadows(g) { g.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; }); return g; }
const NEB_MAT = {};
function nebMat(kind) {
  if (NEB_MAT[kind]) return NEB_MAT[kind];
  /* weiche Scheibe (quadratisch auslaufend), additiv: leuchtender Schleier statt grauem Deckel */
  const c = canvas(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(0.7, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const t = new THREE.CanvasTexture(c);
  return NEB_MAT[kind] = new THREE.MeshBasicMaterial({ map: t, color: kind === 'ash' ? '#7a3020' : '#4a3fb8', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}

export function buildWorld(g) {
  disposeWorld();
  const map = g.map, root = new THREE.Group(); root.name = 'world'; W.root = root; W.map = map;
  W.sky = buildSky(map); root.add(W.sky);
  const anim = new THREE.Group(); anim.name = 'anim'; root.add(anim); W.anim = anim;
  const M = mats('guardian');
  /* Felsen: je Grundform ein InstancedMesh; Lage und Stauchung aus dem Modell, Platz und Drehung aus der Karte */
  const byGeo = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  map.rocks.forEach((o, i) => {
    const m = buildW({ kind: 'rock', r: o.r, seed: o.seed || i }, M); let child = null; m.traverse(c => { if (c.isMesh && !child) child = c; }); if (!child) return;
    m.position.set(o.x, 0, o.y); m.rotation.y = -(o.ang || 0); m.updateMatrixWorld(true);
    let e = byGeo.get(child.geometry); if (!e) byGeo.set(child.geometry, e = { mat: child.material, list: [] }); e.list.push(child.matrixWorld.clone());
  });
  for (const [geo, e] of byGeo) { const im = new THREE.InstancedMesh(geo, e.mat, e.list.length); e.list.forEach((mw, i) => im.setMatrixAt(i, mw)); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = 'rocks'; root.add(im); }
  /* Vorkommen */
  W.nodes = [];
  g.nodes.forEach((n, i) => {
    const m = bake(buildW({ kind: n.kind, r: n.r, seed: n.seed || i * 131 + 7, big: n.r > 70 }, M), { face: 'cam', faceDir: CAM_DIR, keep: keepFor('world', S.detail) });
    shadows(m); put(anim, m, n.x, n.y, -(n.ang || 0)); W.nodes.push({ n, m, dead: false });
  });
  /* Felder: alle zusammen verschmelzen (Staub je Material, Splitter je Feld, Stäubchen gesamt) */
  W.fieldsN = map.fields.length;
  if (map.fields.length) {
    const fg = new THREE.Group();
    map.fields.forEach((f, i) => { const m = buildW({ kind: 'field', r: f.r, seed: i * 17 + 1 }, M); if (map.fields.length > 60) m.traverse(o => { if (o.isInstancedMesh) o.visible = false; }); put(fg, m, f.x, f.y); });
    bake(fg, { face: 'cam', faceDir: CAM_DIR, drop: ['spin'] }); fg.name = 'fields'; root.add(fg);
  }
  /* Nebelzonen */
  W.nebs = [];
  (map.nebs || []).forEach((n, i) => {
    if (BUILDW.neb) { const m = buildW({ kind: 'neb', neb: n.kind, r: n.r, seed: n.seed || i * 37 + 5 }, M); m.name = 'neb'; put(anim, m, n.x, n.y); W.nebs.push({ n, m }); return; }
    const grp = new THREE.Group(); grp.position.set(n.x, -3, n.y);
    const pg = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(pg, nebMat(n.kind)); d.scale.setScalar(n.r * (1 - k * 0.22)); d.position.y = k * 0.4; d.renderOrder = 1; grp.add(d); }
    root.add(grp); W.nebs.push({ n, grp });
  });
  /* Aschenebel am Rand (Schwaden eingefroren, Streifen je Material verschmolzen) */
  if (BUILDW.ash) { const a = buildW({ kind: 'ash', r: EDGE, w: map.w, h: map.h, seed: 1 }, M); bake(a, { face: 'cam', faceDir: CAM_DIR, drop: ['pulse', 'bob', 'sway'] }); put(root, a, map.w / 2, map.h / 2); a.name = 'ash'; }
  S.scene.add(root);
}
/* Stätte / Tor je Zustand (Schlüssel) bauen; wird bei Änderung ersetzt */
function siteKey(st) { return st.kind + '|' + (st.scanned ? 1 : 0) + '|' + (st.done ? 1 : 0); }
function gateKey(gt, col) { return gt.state + '|' + gt.mode + '|' + col; }
function siteModel(st, i) {
  const m = bake(buildW({ kind: st.kind, r: st.r, seed: st.seed !== undefined ? st.seed : i * 31 + 3, scanned: st.scanned }, mats('guardian')), { face: 'cam', faceDir: CAM_DIR, keep: keepFor('world', S.detail) });
  return shadows(m);
}
function gateModel(gt, col) {
  const m = bake(buildW({ kind: 'gate', r: gt.r, state: gt.state, mode: gt.mode || 'bridge', charge: gt.charge || 0 }, mats('guardian', col)), { face: 'cam', faceDir: CAM_DIR, keep: keepFor('world', S.detail), station: true });
  applyCharge(m, gt.charge || 0);
  return shadows(m);
}
export function updateWorld(g, dt, t, view) {
  if (!W.root) return;
  const pcol = o => (o >= 0 && view.pcol(o)) || '#9ff0c0';
  /* Vorkommen: Erschöpfung, Abbau-Ringe */
  for (const e of W.nodes) {
    const n = e.n, dead = n.amount <= 0;
    if (dead !== e.dead) { e.dead = dead; e.m.scale.setScalar(dead ? 0.8 : 1); }
    if (n.miners && view.visible(n) && inView(n.x, n.y, n.r + 20)) ring(n.x, n.y, n.r + 10, n.kind === 'ice' ? '#8fe3ff' : '#ffb86b', 1.5, { dash: 5, march: true, alpha: 0.4 });
  }
  /* Nebelzonen treiben */
  /* Nebelmodelle (BUILDW.neb): nur im Bild sichtbar und animiert */
  for (const e of W.nebs) if (e.m) e.m.visible = inView(e.n.x, e.n.y, e.n.r * 1.2, 20);
  for (const e of W.nebs) if (e.grp) { const n = e.n, tt = t * 0.15 + n.x * 0.01; e.grp.children.forEach((d, k) => { d.position.x = Math.cos(tt + k * 2.1) * n.r * 0.18; d.position.z = Math.sin(tt * 1.3 + k * 2.1) * n.r * 0.18; }); }
  /* Stätten */
  const seen = view.vp < 0 ? () => true : view.seen;
  g.sites.forEach((st, i) => {
    let e = W.sites.get(st.id);
    const key = siteKey(st);
    if (!e || e.key !== key) { if (e) { W.anim.remove(e.m); } e = { m: siteModel(st, i), key }; put(W.anim, e.m, st.x, st.y, 0); W.sites.set(st.id, e); }
    e.m.visible = seen(st.x, st.y) && inView(st.x, st.y, st.r + 60, 20);
    if (!e.m.visible) return;
    if (st.prog > 0 && !st.done) ring(st.x, st.y, st.r + 10, pcol(st.by), 3, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * st.prog });
    if (st.owner >= 0 && st.kind !== 'ruin') ring(st.x, st.y, st.r + 6, pcol(st.owner), 1.5, { dash: 6, alpha: 0.8 });
  });
  /* Tore: Zustand, Betriebsart, Besitzerfarbe und Ladung */
  for (const gt of g.gates) {
    let e = W.gates.get(gt.id);
    const col = gt.owner >= 0 ? view.pcol(gt.owner) : '', key = gateKey(gt, col);
    if (!e || e.key !== key) { if (e) W.anim.remove(e.m); e = { m: gateModel(gt, col || undefined), key, charge: -1 }; put(W.anim, e.m, gt.x, gt.y, 0); W.gates.set(gt.id, e); }
    e.m.visible = seen(gt.x, gt.y) && inView(gt.x, gt.y, gt.r + 60, 20);
    if (!e.m.visible) continue;
    if (Math.abs((gt.charge || 0) - e.charge) > 0.005) { e.charge = gt.charge || 0; applyCharge(e.m, e.charge); }
    if (gt.prog > 0) ring(gt.x, gt.y, gt.r + 14, pcol(gt.by), 3, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * gt.prog });
  }
  /* Animation (nur was im Bild ist) */
  for (const e of W.nodes) e.m.visible = inView(e.n.x, e.n.y, e.n.r * 1.2, e.n.r * 0.5);
  for (const c of W.anim.children) if (c.visible) animate(c, t, dt);
  void CAM;
}
export function disposeWorld() {
  if (!W.root) return;
  S.scene.remove(W.root);
  W.root = null; W.sky = null; W.anim = null; W.nodes = []; W.nebs = []; W.sites.clear(); W.gates.clear();
}
