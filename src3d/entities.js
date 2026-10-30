/* =====================================================================
   Rift Armada 3D – Schiffe, Stationen, Wracks, Bauvorschau.
   Schiffe werden INSTANZIERT: je (Typ, Spielerfarbe) ein gebackenes Vorlagenmodell (bake, Sprites liegend);
   jedes sichtbare Mesh der Vorlage bekommt ein InstancedMesh je Variante (normal | wreck für Wracks/Derelicts),
   dessen Instanzmatrizen jeden Frame aus Schiffslage × Knotenlage der Vorlage entstehen. animate() läuft einmal
   je Vorlage (alle Schiffe eines Typs drehen Antennen im Gleichtakt – unauffällig), Triebwerksflammen skalieren
   je Instanz mit v / speed, Positionslichter blinken über die Sichtbarkeit des Vorlagenknotens. Hunderte Jäger
   kosten so dieselben Draw-Calls wie ein einzelner. Je Instanz eine Farbe (instanceColor): Treffer blitzen auf,
   Ionennebel flackert violett, Säure grünlich, Ruhende golden, Wracks verblassen ins Dunkel.
   Stationen sind Einzelmodelle (gebacken, Sprites zur Kamera), neu gebaut bei Stufe/Rolle/Farbe/Bauzustand.
   Bau: Variante »ghost« (halbdurchsichtig, Teamfarbe), Y-Skalierung mit prog, Ring am Boden. Geschützköpfe
   (userData.aim) folgen aimA, Superwaffe über setCharge, Werft zeigt das entstehende Schiff im Bauplatz (berth)
   mit Deckkraft 0,15 + 0,6·qp. Andockplätze bleiben leer (die Frachter stehen als echte Schiffe daneben).
   Zustände (Spec): derelict dunkel ohne Flammen, dormant golden, invuln goldener Ring, dome Schildkuppel
   (Ellipsoid, Fresnel), marked/truce/para/boarding als Marker aus overlay.js. Rauch ab 60 % Schaden und Funken
   ab 30 % kommen über effects.spawn (falls vorhanden). Das Spiel wird nie beschrieben.
   ===================================================================== */
import * as THREE from 'three';
import { BUILD, BUILDB, mats, animate, bake, keepFor, flameTime, applyAim, applyCharge, farGeometry, farMaterial, cloneMat, cloneStation } from './models/kit.js';
import SDATA from './models/stations.json';
import SHIPJ from './models/ships.json';
import { S, CAM_DIR } from './scene.js';
import { inView, CAM } from './camera.js';
import { ring, disc, line } from './overlay.js';

/* Fernmodelle (ein Mesh mit Vertexfarben + Flammen) unterhalb dieser Zoomstufen, je Detailstufe */
const FAR_SHIP = [1.6, 1.05, 0.8], FAR_STATION = [1.2, 0.85, 0.7];
const TAU = Math.PI * 2;
const E = { tpl: new Map(), sets: new Map(), stations: new Map(), prev: new Map(), domes: [], domeN: 0, domeMat: null, ghost: new Map(), ghostCur: [], ruins: new Map(), fx: null, pcol: null, root: null };
const M4 = new THREE.Matrix4(), M4b = new THREE.Matrix4(), POS = new THREE.Vector3(), SCL = new THREE.Vector3(1, 1, 1), EUL = new THREE.Euler(0, 0, 0, 'YZX'), QUAT = new THREE.Quaternion(), COL = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1), TINT = { ion: new THREE.Color(), acid: new THREE.Color(0.75, 1.05, 0.6), gold: new THREE.Color(1.15, 1.0, 0.7) };
export function setEffects(fx) { E.fx = fx; }

export function initEntities() {
  E.root = new THREE.Group(); E.root.name = 'entities'; S.scene.add(E.root);
  E.domeMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#8fe3ff') }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uT; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5); float a = 0.05 + 0.55 * f + 0.06 * sin(uT * 6.0); gl_FragColor = vec4(uCol * (0.6 + 0.8 * f), a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

/* ------------------------------------------------------------ Materialvarianten (zwischengespeichert je Material) */
const VAR = new WeakMap();
function variant(m, kind, tint) {
  const key = kind + (tint ? '|' + tint : ''); let byKind = VAR.get(m); if (!byKind) VAR.set(m, byKind = {});
  if (byKind[key]) return byKind[key];
  const c = cloneMat(m);
  /* 'inst': eigener Klon für InstancedMesh – teilen sich Instanz- und Einzel-Meshes ein Material, prüft three.js bei
     jedem Wechsel das Shaderprogramm neu (getParameters/getProgram je Bild) */
  if (kind === 'inst') { byKind[key] = c; return c; }
  if (kind === 'wreck') {
    if (c.color) c.color.multiplyScalar(c.isMeshBasicMaterial ? 0.12 : 0.4);
    if (c.emissiveIntensity !== undefined) c.emissiveIntensity *= 0.08;
    if (c.vertexColors && c.isMeshBasicMaterial) c.color.setScalar(0.12);
    c.metalness = c.metalness !== undefined ? Math.min(c.metalness, 0.5) : undefined; if (c.roughness !== undefined) c.roughness = Math.max(c.roughness, 0.7);
  } else if (kind === 'ghost') {
    c.transparent = true; c.opacity = 0.5; c.depthWrite = false;
    if (tint && c.color) { COL.set(tint); c.color.lerp(COL, 0.55); }
    if (c.emissive && tint) { c.emissive.set(tint); c.emissiveIntensity = 0.3; }
  }
  byKind[key] = c; return c;
}
/* alle Materialien eines Baums ersetzen (eigene Klone, wenn own = true, für Deckkraft je Objekt) */
function remat(root, kind, tint, own) { const mine = []; root.traverse(o => { if (o.material) { let m = variant(o.material, kind, tint); if (own) { m = m.clone(); mine.push(m); } o.material = m; } }); return mine; }

/* ------------------------------------------------------------ Schiffe: Vorlagen und Instanzmengen */
function buildShip(def, color) {
  const fn = BUILD[def.id], M = mats(def.f, color);
  let g;
  if (fn) g = fn(M, def);
  else { g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.3, def.len * 0.15, def.len), M.hull2)); }
  g.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return g;
}
function tplOf(def, color) {
  const key = def.id + '|' + (color || '');
  let t = E.tpl.get(key); if (t) return t;
  const root = bake(buildShip(def, color), { face: 'up', keep: keepFor('ship', S.detail), flames: true });
  const parts = [];
  root.traverse(o => {
    if (o.isMesh && !o.isInstancedMesh) parts.push({ node: o, geo: o.geometry, mat: o.material, flame: !!(o.material.userData && o.material.userData.isFlame), shadow: o.castShadow !== false && !o.material.transparent, order: o.renderOrder });
    else if (o.isSprite || o.isPoints || o.isLine || o.isInstancedMesh) o.visible = false;
  });
  root.updateMatrixWorld(true);
  t = { key, root, parts, def, color, t: -1, farParts: null }; E.tpl.set(key, t); return t;
}
/* Fernmodell erst bei Bedarf (aus einem frischen, ungebackenen Aufbau; kleine Teile fallen weg) + die Flammen */
function farPartsOf(t) {
  if (!t.farParts) { const farGeo = farGeometry(buildShip(t.def, t.color), Math.max(1.2, t.def.len * 0.03)); t.farParts = [{ node: t.root, geo: farGeo, mat: null, flame: false, shadow: true, order: 0, far: true }].concat(t.parts.filter(p => p.flame)); }
  return t.farParts;
}
function setOf(tpl, kind, far) {
  const key = tpl.key + '|' + kind + (far ? '|far' : '');
  let s = E.sets.get(key); if (s) return s;
  s = { tpl, kind, far: !!far, parts: far ? farPartsOf(tpl) : tpl.parts, n: 0, cap: 0, ims: [], last: 0 };
  grow(s, 16); E.sets.set(key, s); return s;
}
function grow(s, cap) {
  const old = s.ims, keep = Math.min(s.n, s.cap);
  s.ims = []; s.cap = cap;
  s.parts.forEach((p, j) => {
    const mat = variant(p.far ? farMaterial(s.kind) : s.kind === 'wreck' ? variant(p.mat, 'wreck') : p.mat, 'inst');
    /* Flammen: eigene Geometrie je Menge mit Streckfaktor je Instanz (iFlame) */
    let geo = p.geo; if (p.flame) { geo = p.geo.clone(); geo.setAttribute('iFlame', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage)); }
    const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.castShadow = p.shadow && S.detail >= 2; im.receiveShadow = true; im.renderOrder = p.order; im.count = 0;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, WHITE); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    /* schon in diesem Frame gesetzte Instanzen übernehmen */
    if (old[j] && keep) { im.instanceMatrix.array.set(old[j].instanceMatrix.array.subarray(0, keep * 16)); if (old[j].instanceColor) im.instanceColor.array.set(old[j].instanceColor.array.subarray(0, keep * 3)); if (p.flame) geo.attributes.iFlame.array.set(old[j].geometry.attributes.iFlame.array.subarray(0, keep)); }
    im.visible = false; im.name = 'ships:' + s.kind; E.root.add(im);
    s.ims.push(im);
  });
  for (const im of old) { E.root.remove(im); if (im.geometry.attributes.iFlame) im.geometry.dispose(); im.dispose(); }
}
/* eine Instanz (Schiff oder Wrack) anfügen: Lage M4, Farbe COL, Flammenfaktor k (−1 = keine Flammen) */
function push(s, k, tint) {
  if (s.n >= s.cap) grow(s, s.cap * 2);
  const i = s.n++, parts = s.parts;
  for (let j = 0; j < parts.length; j++) {
    const p = parts[j], im = s.ims[j];
    if (!p.node.visible) { M4b.makeScale(0, 0, 0); im.setMatrixAt(i, M4b); continue; }
    M4b.multiplyMatrices(M4, p.node.matrixWorld);
    if (p.flame) im.geometry.attributes.iFlame.setX(i, k < 0 ? 0 : 0.2 + k);
    im.setMatrixAt(i, M4b); im.setColorAt(i, tint);
  }
}
function finish() {
  for (const s of E.sets.values()) {
    const n = s.n;
    for (const im of s.ims) { im.count = n; im.visible = n > 0; if (n) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; if (im.geometry.attributes.iFlame) im.geometry.attributes.iFlame.needsUpdate = true; } }
    s.n = 0;
  }
}
/* Schiffsdefinition außerhalb von g.ships: Spieldaten (global SHIPS), sonst ships.json */
function shipDef(id) { if (typeof SHIPS !== 'undefined' && SHIPS[id]) return SHIPS[id]; const d = SHIPJ.ships.find(s => s.id === id); return d || null; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

/* ------------------------------------------------------------ Stationen */
const FACS = ['alliance', 'mars', 'legion', 'nexus', 'brood', 'guardian'];
function bdefOf(f, role) { return SDATA.bldgs.find(d => d.f === f && d.id === role) || SDATA.bldgs.find(d => d.id === role); }
/* Stationsvorlage je (Fraktion, Rolle, Stufe, Farbe): einmal gebaut und gebacken, je Station nur geklont
   (cloneStation: Geometrien geteilt, eigene Uniforms für Zielwinkel und Ladung). Vorher wurde jede Station – und
   bei Fertigstellung und Ausbau erneut – komplett neu gebaut (15–450 ms je Station). */
const STPL = new Map();
function stationTpl(f, def, lv, color, spec) {
  const key = f + '|' + (def.id || def.role) + (spec ? ':' + spec : '') + '|' + lv + '|' + color;
  let T = STPL.get(key); if (T) return T;
  /* Fassung 22: Turmzweige haben eigene Modelle (f:turret:flak …) */
  const fn = (spec && BUILDB[f + ':' + (def.id || def.role) + ':' + spec]) || BUILDB[f + ':' + def.id] || BUILDB[f + ':' + def.role], M = mats(f, color);
  if (fn) T = fn(M, def, lv);
  else { T = new THREE.Group(); T.add(new THREE.Mesh(new THREE.CylinderGeometry(def.r, def.r, def.r * 0.3, 24, 1), M.hull2)); }
  bake(T, { face: 'cam', faceDir: CAM_DIR, keep: keepFor('station', S.detail), flames: true, station: true });
  T.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; if (o.isMesh && o.material.transparent) o.castShadow = false; });
  STPL.set(key, T); return T;
}
function buildStation(f, def, lv, color, spec) { return cloneStation(stationTpl(f, def, lv, color, spec)); }
function stationKey(b, color) { return (b.def.f || b.f) + '|' + b.role + (b.spec ? ':' + b.spec : '') + '|' + b.lv + '|' + color + '|' + (b.done ? 1 : 0); }
/* Eintrag je Station; Voll- und Fernmodell entstehen erst, wenn sie gebraucht werden */
function stationEntry(b, color) { return { m: null, far: null, key: stationKey(b, color), f: b.def.f || b.f, def: b.def, lv: b.lv, spec: b.spec || '', color, done: b.done, berth: null, berthType: '', berthMats: null, berthM: null, charge: -1, aimA: undefined }; }
function fullStation(e) {
  if (e.m) return e.m;
  const m = buildStation(e.f, e.def, e.lv, e.color, e.spec);
  if (!e.done) remat(m, 'ghost', e.color, false);
  m.traverse(o => { if (o.userData.berth && !e.berth) e.berth = o; });
  m.visible = false; E.root.add(m); e.m = m; e.charge = -1; e.aimA = undefined;
  return m;
}
const FARST = new Map();
function farStation(e) {
  if (e.far) return e.far;
  const key = e.f + '|' + e.def.id + (e.spec ? ':' + e.spec : '') + '|' + e.lv + '|' + e.color;
  let geo = FARST.get(key);
  if (!geo) { const fn = (e.spec && BUILDB[e.f + ':' + e.def.id + ':' + e.spec]) || BUILDB[e.f + ':' + e.def.id], M = mats(e.f, e.color); const raw = fn ? fn(M, e.def, e.lv) : new THREE.Group(); geo = farGeometry(raw, Math.max(1.5, e.def.r * 0.03)); FARST.set(key, geo); }
  const m = new THREE.Mesh(geo, farMaterial('normal')); m.castShadow = S.detail >= 2; m.receiveShadow = true; m.visible = false; E.root.add(m); e.far = m;
  return m;
}
function dropStation(e) { if (e.m) E.root.remove(e.m); if (e.far) E.root.remove(e.far); }
/* Schiff im Bauplatz der Werft (eigene halbdurchsichtige Materialien je Werft) */
function berthShip(e, type, def, color) {
  if (e.berthType === type) return;
  if (e.berthM) { e.berth.remove(e.berthM); e.berthM = null; e.berthMats = null; }
  e.berthType = type;
  if (!type || !e.berth || !def) return;
  const m = tplOf(def, color).root.clone(true);
  m.traverse(o => { if (o.isSprite || o.isPoints || (o.material && o.material.userData.isFlame)) o.visible = false; o.castShadow = false; });
  e.berthMats = remat(m, 'ghost', '', true);
  const max = (e.berth.userData.berth && e.berth.userData.berth.len) || 60, k = Math.min(1, max / def.len);
  m.scale.setScalar(k); e.berth.add(m); e.berthM = m;
}

/* ------------------------------------------------------------ Vorbauen im Leerlauf
   Nach setGame kommen alle Schiffstypen der beteiligten Fraktionen (in Spielerfarbe) und ihre Stationen (Stufe 1)
   in eine Warteschlange; prebuild() baut im Leerlauf (requestIdleCallback, index.js) jeweils eine Vorlage, solange
   Zeit bleibt. So entsteht der Ruck beim ersten Auftauchen eines Typs nicht mitten im Gefecht. */
const PRE = [], LATER = [];
export function queuePrebuild(g) {
  const pcol = id => { const p = g.players[id]; return p && (p.color || (p.F && p.F.team)) || '#d8d0bd'; };
  PRE.length = 0;
  const seen = new Set();
  for (const p of g.players) {
    if (!p || p.neutral) continue;
    const f = p.faction, col = pcol(p.id); if (seen.has(f + col)) continue; seen.add(f + col);
    const list = typeof SHIPS !== 'undefined' ? Object.values(SHIPS).filter(d => d.f === f) : SHIPJ.ships.filter(d => d.f === f);
    for (const d of list) if (d.id && BUILD[d.id]) PRE.push(() => { const t = tplOf(d, col); warm(setOf(t, 'normal', false).ims.concat(d.role === 'fighter' ? [] : setOf(t, 'wreck', false).ims)); });
    for (const d of SDATA.bldgs) if (d.f === f && BUILDB[f + ':' + d.id]) PRE.push(() => { const T = stationTpl(f, d, 1, col), G = cloneStation(T); remat(G, 'ghost', col, false); warm([T, G]); });
    LATER.push([f, col]);
  }
  /* zuletzt die Stufen 2 und 3 (Ausbau kommt erst im Lauf der Partie) */
  for (const [f, col] of LATER) for (const lv of [2, 3]) for (const d of SDATA.bldgs) if (d.f === f && BUILDB[f + ':' + d.id]) PRE.push(() => warm([stationTpl(f, d, lv, col)]));
  LATER.length = 0;
}
/* Shader der Objekte im Hintergrund übersetzen (compileAsync nutzt KHR_parallel_shader_compile, falls vorhanden):
   sonst übersetzt three.js beim ersten Zeichnen synchron – unter Windows/ANGLE oft 50–200 ms je Programm */
export function warm(list) {
  const r = S.renderer; if (!r || !r.compileAsync) return;
  for (const o of list) {
    /* compile() geht nur über sichtbare Objekte: alles kurz sichtbar machen */
    const hid = []; o.traverse(c => { if (!c.visible) { hid.push(c); c.visible = true; } });
    try { r.compileAsync(o, S.camera, S.scene).catch(() => {}); } catch (e) { /* ältere Fassung */ }
    for (const c of hid) c.visible = false;
  }
}
export function prebuild(deadline) { let n = 0; while (PRE.length && (n === 0 || deadline() > 12)) { const fn = PRE.shift(); try { fn(); } catch (e) { /* Modell fehlt */ } n++; } return PRE.length; }

/* ------------------------------------------------------------ Bauvorschau */
/* Bauvorschau nach dem Rendern wieder ausblenden (ghost() wird vor frame() aufgerufen) */
/* Fassung 22: mehrere Vorschauen je Frame (Reihe): slot = Nummer des Platzes */
export function hideGhost() { for (const m of E.ghostCur) m.visible = false; E.ghostCur.length = 0; }
export function ghost(f, role, lv, x, y, ok, color, slot) {
  const key = f + '|' + role + '|' + (lv || 1) + '|' + (ok ? 1 : 0) + '|' + (slot | 0);
  let m = E.ghost.get(key);
  if (!m) {
    const def = bdefOf(f, role); if (!def) return;
    m = buildStation(f, def, lv || 1, color); remat(m, 'ghost', ok ? '#7dff9a' : '#ff5b47', false);
    m.traverse(o => { o.castShadow = false; if (o.material && o.material.userData.isFlame) o.visible = false; }); m.visible = false; E.root.add(m); E.ghost.set(key, m);
  }
  m.position.set(x, 0.5, y); m.visible = true; E.ghostCur.push(m);
}

/* ------------------------------------------------------------ Fassung 22: Ruinen zerstörter Stationen
   Klon der Station in der Wrack-Variante (dunkel, ohne Leuchten), gekippt und gestaucht, sinkt beim Bergen und Verfallen
   ab; Glut als kleine Scheiben aus overlay.js. */
function ruinStep(w, g, color, t) {
  let m = E.ruins.get(w.id);
  if (!m) {
    const def = bdefOf(w.f, w.role); if (!def) return;
    m = buildStation(w.f, def, w.lv || 1, color); remat(m, 'wreck', '', false);
    m.traverse(o => { if (o.isSprite || o.isPoints || (o.material && o.material.userData && o.material.userData.isFlame)) o.visible = false; });
    const k = (w.id % 5) / 5;
    m.rotation.set(0.12 + 0.1 * k, w.ang || 0, -0.1 + 0.15 * k); m.scale.set(1, 0.55, 1);
    E.root.add(m); E.ruins.set(w.id, m);
  }
  const fade = Math.max(0, Math.min(1, (w.until - g.time) / 20)) * Math.max(0.35, Math.min(1, w.sal0 ? w.sal / w.sal0 : 1));
  m.visible = true; m.position.set(w.x, -(1 - fade) * w.r * 0.8 - 2, w.y);
  if (fade > 0.3) for (let i = 0; i < 3; i++) { const a = w.id * 1.7 + i * 2.1, d = w.r * (0.25 + 0.2 * i); disc(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 2.5 + Math.sin(t * 3 + i + w.id) * 0.8, '#ff8a3a', 0.35 + 0.25 * Math.sin(t * 2.3 + i * 1.9)); }
}

/* ------------------------------------------------------------ Schildkuppeln */
function dome(x, y, r, t) {
  let d = E.domes[E.domeN];
  if (!d) { d = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), E.domeMat); d.renderOrder = 6; E.root.add(d); E.domes.push(d); }
  d.visible = true; d.position.set(x, 0, y); d.scale.set(r, r * 0.6, r); E.domeMat.uniforms.uT.value = t; E.domeN++;
}

/* ------------------------------------------------------------ Fassung 22: Schildwälle
   Senkrechte, additive Fläche je stehendem Wall zwischen den Feldenden (wx1,wy1)→(wx2,wy2): Fresnel-artiger Saum oben
   und unten, wandernde Waben, Stärke nach Feldenergie, Treffer blitzen kurz auf. Pool aus Meshes (eigene Uniforms). */
const WALLH = 26, WALLS = { list: [], n: 0, geo: null };
const WALL_COL = { alliance: '#8fe3ff', mars: '#ffb070', legion: '#ffd27a', nexus: '#eadcff', brood: '#b4ff3c' };
function wallMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#8fe3ff') }, uTeam: { value: new THREE.Color('#ffffff') }, uT: { value: 0 }, uK: { value: 1 }, uHit: { value: 0 }, uL: { value: 100 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform vec3 uTeam; uniform float uT; uniform float uK; uniform float uHit; uniform float uL; varying vec2 vUv;\n' +
      'void main() { float x = vUv.x * uL / 9.0, y = vUv.y * ' + WALLH + '.0 / 9.0; vec2 h = vec2(x - uT * 0.6, y + 0.5 * mod(floor(x - uT * 0.6), 2.0)); vec2 f = abs(fract(h) - 0.5); float hex = smoothstep(0.42, 0.5, max(f.x, f.y));\n' +
      'float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.75, vUv.y); float rim = smoothstep(0.85, 1.0, vUv.y) + smoothstep(0.1, 0.0, vUv.y) * 0.6; float ends = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);\n' +
      'float a = (0.10 + 0.22 * uK + hex * (0.25 + 0.35 * uK)) * edge * ends + rim * 0.5 * ends + uHit * 0.45 * edge; vec3 c = mix(uCol, uTeam, rim * 0.5) * (1.0 + hex * 0.8 + uHit * 1.5);\n' +
      'gl_FragColor = vec4(c * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}
function wallField(b, col, gtime, t) {
  if (!WALLS.geo) { WALLS.geo = new THREE.PlaneGeometry(1, 1); WALLS.geo.translate(0.5, 0.5, 0); }
  let m = WALLS.list[WALLS.n];
  if (!m) { m = new THREE.Mesh(WALLS.geo, wallMat()); m.renderOrder = 7; m.frustumCulled = false; E.root.add(m); WALLS.list.push(m); }
  WALLS.n++;
  const dx = b.wx2 - b.wx1, dy = b.wy2 - b.wy1, L = Math.hypot(dx, dy), u = m.material.uniforms;
  m.visible = true; m.position.set(b.wx1, 0.5, b.wy1); m.rotation.set(0, -Math.atan2(dy, dx), 0); m.scale.set(L, WALLH, 1);
  /* Bodenband, damit das Feld auch aus Blickrichtung längs der Wand gut zu sehen ist */
  const fc = WALL_COL[b.def.f] || '#8fe3ff', k = b.fhpMax ? Math.max(0, Math.min(1, b.fhp / b.fhpMax)) : 1;
  line(b.wx1, b.wy1, b.wx2, b.wy2, fc, 12, { alpha: 0.18 + 0.2 * k }); line(b.wx1, b.wy1, b.wx2, b.wy2, '#ffffff', 2.5, { alpha: 0.55 + 0.3 * k }); line(b.wx1, b.wy1, b.wx2, b.wy2, col, 6, { alpha: 0.3, dash: 8, march: true });
  u.uCol.value.set(fc); u.uTeam.value.set(col); u.uT.value = t; u.uL.value = L; u.uK.value = b.fhpMax ? Math.max(0, Math.min(1, b.fhp / b.fhpMax)) : 1; u.uHit.value = Math.max(0, 1 - (gtime - (b.fhitT || -9)) / 0.25);
}

/* ------------------------------------------------------------ je Frame */
export function updateEntities(g, dt, t, view) {
  const fx = E.fx && typeof E.fx.spawn === 'object' ? E.fx.spawn : null, det = S.detail;
  const pcol = view.pcol, vis = view.visible, seen = view.vp < 0 ? () => true : view.seen, vp = view.vp, farShips = CAM.zoom < FAR_SHIP[S.detail], farSt = CAM.zoom < FAR_STATION[S.detail];
  E.domeN = 0; flameTime(t);
  /* Vorlagen animieren (einmal je Typ und Farbe) */
  for (const tp of E.tpl.values()) { if (tp.t !== t) { animate(tp.root, t, dt); tp.root.updateMatrixWorld(true); tp.t = t; } }
  /* Schiffe */
  for (const u of g.ships) {
    if (u.dead || !vis(u)) continue;
    const def = u.def, R = Math.max(def.len * 0.7, def.r * 1.6);
    if (!inView(u.x, u.y, R, 10)) continue;
    /* je Schiff gemerkt: Farbe, Vorlage, Instanzmengen (keine Schlüssel-Zeichenketten je Bild), Kurs und Rollen */
    const col = pcol(u.owner);
    let pv = E.prev.get(u.id);
    if (!pv || pv.col !== col || pv.def !== def) { pv = { ang: u.ang, roll: pv ? pv.roll : 0, col, def, tp: tplOf(def, col), sets: [null, null, null, null] }; E.prev.set(u.id, pv); }
    const si = (u.derelict ? 1 : 0) + (farShips ? 2 : 0), set = pv.sets[si] || (pv.sets[si] = setOf(pv.tp, u.derelict ? 'wreck' : 'normal', farShips));
    /* Lage: schweben, rollen in Kurven (aus der Kursänderung) */
    const da = dt > 0 ? angDiff(u.ang, pv.ang) / dt : 0; pv.ang = u.ang;
    const rollT = def.role === 'fighter' || def.swarm ? -da * 0.12 : -da * 0.22; pv.roll += (Math.max(-0.4, Math.min(0.4, rollT)) - pv.roll) * Math.min(1, dt * 6);
    const hover = u.derelict ? -1.5 : Math.sin(t * 1.1 + u.id * 0.7) * (def.len < 40 ? 0.5 : 0.9);
    const yOff = (def.id === 'warden' && u.asleep) ? 20 : 0;
    POS.set(u.x, hover + yOff, u.y); EUL.set(0, Math.PI / 2 - u.ang, u.derelict ? Math.sin(u.id) * 0.25 : pv.roll); QUAT.setFromEuler(EUL); SCL.set(1, 1, 1);
    M4.compose(POS, QUAT, SCL);
    /* Flammen: Fahrt, G-Rausch, Sprint; keine bei Wracks und Ruhenden */
    let k = -1;
    if (!u.derelict && !u.dormant) { const boost = u.abT && u.abT.grush > 0 ? 1.8 : u.sprint > 0 ? 1.4 : 1; k = Math.min(1.6, u.v / Math.max(1, def.speed)) * boost; }
    /* Farbe je Instanz */
    COL.copy(WHITE);
    const hitAgo = g.time - (u.hitT || -9); if (hitAgo >= 0 && hitAgo < 0.12 && !u.derelict) COL.setScalar(1 + 1.2 * (1 - hitAgo / 0.12));
    if (u.ion) { const f = 0.75 + 0.25 * Math.sin(t * 23 + u.id); COL.multiply(TINT.ion.setRGB(0.8 * f + 0.2, 0.7 * f + 0.2, 1.1)); }
    if (u.acid) COL.multiply(TINT.acid);
    if (u.dormant) COL.multiply(TINT.gold);
    if (u.cloak || (u.abT && u.abT.cloak > 0)) { const f = 0.3 + 0.12 * Math.sin(t * 7 + u.id); COL.multiply(TINT.ion.setRGB(f * 0.8, f * 1.1, f * 1.6)); }
    push(set, k, COL);
    if (def.role === 'fighter') continue;
    /* Schaden: Funken ab 30 %, Rauch ab 60 % */
    const dmg = u.derelict || def.swarm ? 0 : 1 - u.hull / u.hullMax;
    if (fx && det > 0 && dmg > 0.3 && Math.random() < (dmg > 0.6 ? 0.08 : 0.03) * (det === 2 ? 1 : 0.5)) {
      const a = Math.random() * TAU, d = Math.random() * def.r * 0.6, px = u.x + Math.cos(a) * d, py = u.y + Math.sin(a) * d;
      if (dmg > 0.6 && fx.smoke) fx.smoke(px, py, def.r * 0.35, 1); else if (fx.spark) fx.spark(px, py, 2, 40, '#ffd27a');
    }
    if (u.derelict && fx && fx.spark && det > 1 && Math.random() < 0.03) fx.spark(u.x + (Math.random() - 0.5) * def.r, u.y + (Math.random() - 0.5) * def.r, 2, 30, '#ffd27a');
    /* Zustände */
    if (u.dormant) disc(u.x, u.y, def.r * 1.8, '#ffd27a', 0.14 + 0.08 * Math.sin(t * 2 + u.id));
    if (u.dome > 0) dome(u.x, u.y, def.r * 1.5 + 6, t);
    if (u.abT && u.abT.invuln > 0) { ring(u.x, u.y, def.r * 1.4 + 4, '#ffe6a0', 2.5, { alpha: 0.6 + 0.3 * Math.sin(t * 10) }); disc(u.x, u.y, def.r * 2.2, '#ffd27a', 0.12); }
    if (u.truce > 0) ring(u.x, u.y, def.r + 4, '#ffffff', 1, { dash: 3, alpha: 0.5 });
    if (u.jamT > g.time) { const a0 = -t * 4 + u.id; for (let i = 0; i < 3; i++) ring(u.x, u.y, def.r + 5, '#c9a0ff', 1.5, { a0: a0 + i * TAU / 3, a1: a0 + i * TAU / 3 + 0.9, alpha: 0.7 }); }   /* Fassung 22: gestört */
    if (u.marked > g.time) { const r = def.r + 9, a0 = t * 2; for (let i = 0; i < 4; i++) ring(u.x, u.y, r, '#ffb86b', 2, { a0: a0 + i * Math.PI / 2, a1: a0 + i * Math.PI / 2 + 0.8 }); }
    if (u.para) { const n = Math.min(4, u.para.n); for (let i = 0; i < n; i++) { const a = t * 2 + i * TAU / n; ring(u.x, u.y, def.r * 0.8, '#ff9ad6', 3, { a0: a - 0.12, a1: a + 0.12 }); } }
    if (u.boarding > 0) { const n = Math.min(8, Math.ceil(u.boarding / 12)), c = pcol(u.boardBy); for (let i = 0; i < n; i++) { const a = t * 3 + i * TAU / n; ring(u.x, u.y, def.r * 0.7, c, 2.5, { a0: a - 0.1, a1: a + 0.1 }); } }
    if (u.cocoon) { const kk = 1 - u.cocoon.t / u.cocoon.t0, r = def.r * 1.3 + 4; disc(u.x, u.y, r * 1.1, '#6f4d85', 0.6); ring(u.x, u.y, r * 0.7, '#d6ff6a', 2, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * kk }); }
  }
  if ((E.sweep = (E.sweep || 0) + 1) % 30 === 0) for (const id of E.prev.keys()) { const u = g.byId.get(id); if (!u || u.dead) E.prev.delete(id); }
  /* Wracks */
  const ruinLive = new Set();
  for (const w of g.wrecks) {
    if (w.ruin) { if (seen(w.x, w.y) && inView(w.x, w.y, w.r * 1.4, w.r * 0.6)) { ruinLive.add(w.id); ruinStep(w, g, pcol(w.owner), t); } continue; } /* Fassung 22 */
    if (!seen(w.x, w.y) || !inView(w.x, w.y, 60, 5)) continue;
    const u = g.byId.get(w.id), def = (u && u.def) || (typeof SHIPS !== 'undefined' && SHIPS[w.type]); if (!def) continue;
    const set = setOf(tplOf(def, pcol(w.owner)), 'wreck', farShips), left = w.until - g.time, kf = Math.max(0.05, Math.min(1, left / 20));
    POS.set(w.x, -2, w.y); EUL.set(Math.cos(w.id) * 0.12, Math.PI / 2 - (w.ang + Math.sin(w.id) * 0.3), Math.sin(w.id) * 0.3); QUAT.setFromEuler(EUL); SCL.set(1, 1, 1); M4.compose(POS, QUAT, SCL);
    COL.setScalar(kf); push(set, -1, COL);
  }
  finish();
  for (const [id, m] of E.ruins) if (!ruinLive.has(id)) { if (g.wrecks.some(w => w.id === id && w.ruin)) m.visible = false; else { E.root.remove(m); E.ruins.delete(id); } }
  for (let i = E.domeN; i < E.domes.length; i++) E.domes[i].visible = false;
  /* Stationen */
  const live = new Set();
  for (const b of g.bldgs) {
    if (b.dead) continue;
    live.add(b.id);
    const col = pcol(b.owner), key = stationKey(b, col);
    let e = E.stations.get(b.id);
    if (!e || e.key !== key) { if (e) dropStation(e); e = stationEntry(b, col); E.stations.set(b.id, e); }
    const sh = seen(b.x, b.y) && inView(b.x, b.y, b.def.r * 1.4, b.def.r * 0.6);
    if (!sh) { if (e.m) e.m.visible = false; if (e.far) e.far.visible = false; continue; }
    /* fern und fertig: Fernmodell (ein Draw-Call), sonst Vollmodell */
    const useFar = farSt && b.done, m = useFar ? farStation(e) : fullStation(e);
    if (useFar) { if (e.m) e.m.visible = false; } else if (e.far) e.far.visible = false;
    m.visible = true; m.position.set(b.x, 0, b.y);
    const v = vis(b);
    if (useFar) {
      if (b.upg) ring(b.x, b.y, b.def.r + 6, '#ffffff', 2, { dash: 4, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * (b.upg.prog || 0) });
      if (b.role === 'super' && v) ring(b.x, b.y, b.def.r + 4, '#ffb86b', 3, { alpha: 0.55, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * Math.min(1, b.charge || 0) });
      continue;
    }
    if (!b.done) {
      m.scale.set(1, 0.08 + 0.92 * b.prog, 1);
      ring(b.x, b.y, b.def.r, '#c8dcff', 1.5, { dash: 6, alpha: 0.5 });
      ring(b.x, b.y, b.def.r, col, 3, { a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * b.prog });
      if (b.bld && v && fx && fx.spark && det > 0 && Math.random() < 0.25) fx.spark(b.x + (Math.random() - 0.5) * b.def.r, b.y + (Math.random() - 0.5) * b.def.r, 1, 30, '#ffe9a0');
      animate(m, t, dt);
      continue;
    }
    m.scale.set(1, 1, 1);
    /* Geschütze, Ladung, Werft */
    if (b.aimA !== undefined && b.aimA !== e.aimA) { e.aimA = b.aimA; applyAim(m, b.aimA); }
    if (b.role === 'super' && Math.abs((b.charge || 0) - e.charge) > 0.004) { e.charge = b.charge || 0; applyCharge(m, Math.min(1, e.charge)); }
    if (b.role === 'yard' && e.berth) {
      const q0 = b.q && b.q.length ? b.q[0].id : '';
      let def = null; if (q0) { const any = g.ships.find(u => u.type === q0); def = any ? any.def : shipDef(q0); }
      berthShip(e, def ? q0 : '', def, col);
      if (e.berthMats) { const op = 0.15 + 0.6 * (b.qp || 0); for (const mm of e.berthMats) mm.opacity = op; }
    }
    if (b.upg) ring(b.x, b.y, b.def.r + 6, '#ffffff', 2, { dash: 4, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * (b.upg.prog || 0) });
    if (b.role === 'super' && v) { const full = b.charge >= 1; ring(b.x, b.y, b.def.r + 4, '#ffb86b', 3, { alpha: full ? 0.6 + 0.3 * Math.sin(t * 5) : 0.55, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * Math.min(1, b.charge || 0) }); if (full && b.owner === vp) disc(b.x, b.y, b.def.r * 1.6, '#ffb070', 0.14 + 0.08 * Math.sin(t * 4)); }
    if (b.give > 0 && v) ring(b.x, b.y, b.def.r * 1.15, '#8fe3ff', 2, { alpha: 0.18 });
    if (b.role === 'spore' && v) { const lv = b.def.lv[b.lv - 1], r = lv && lv.aura; if (r) { disc(b.x, b.y, r, '#b4ff3c', 0.13); ring(b.x, b.y, r, '#b4ff3c', 1, { dash: 5, alpha: 0.3 }); } }
    if (b.boarding > 0 && v) { const n = Math.min(10, Math.ceil(b.boarding / 12)), c = pcol(b.boardBy); for (let i = 0; i < n; i++) { const a = t * 2.5 + i * TAU / n; ring(b.x, b.y, b.def.r * 0.6, c, 3, { a0: a - 0.08, a1: a + 0.08 }); } }
    if (v && fx && det > 1 && b.hull < b.hullMax * 0.5 && Math.random() < 0.12) { if (fx.smoke) fx.smoke(b.x + (Math.random() - 0.5) * b.def.r, b.y + (Math.random() - 0.5) * b.def.r, 14, 1); if (fx.spark && Math.random() < 0.3) fx.spark(b.x, b.y, 2, 50, '#ffd27a'); }
    animate(m, t, dt);
  }
  for (const [id, e] of E.stations) if (!live.has(id)) { dropStation(e); E.stations.delete(id); }
  /* Fassung 22: Schildwälle (stehend: Feld; eigener ohne Feld: gestrichelte Linie) */
  WALLS.n = 0;
  for (const b of g.bldgs) {
    if (b.dead || b.role !== 'wall' || !b.done) continue;
    const a = b.link ? g.byId.get(b.link) : null; if (!a || a.dead) continue;
    const mx = (b.x + a.x) / 2, my = (b.y + a.y) / 2;
    if (!seen(mx, my) || !inView(mx, my, Math.hypot(a.x - b.x, a.y - b.y) / 2 + 40, 30)) continue;
    if (b.up) wallField(b, pcol(b.owner), g.time, t);
    else if (b.owner === vp) line(b.x, b.y, a.x, a.y, '#ffffff', 1.5, { dash: 1, alpha: 0.3 });
  }
  for (let i = WALLS.n; i < WALLS.list.length; i++) WALLS.list[i].visible = false;
  void FACS;
}
export function clearEntities() {
  if (!E.root) return;
  for (const s of E.sets.values()) for (const im of s.ims) { E.root.remove(im); im.dispose(); }
  E.sets.clear(); E.tpl.clear(); E.prev.clear(); FARST.clear(); STPL.clear(); PRE.length = 0;
  for (const e of E.stations.values()) dropStation(e); E.stations.clear();
  for (const m of E.ghost.values()) E.root.remove(m); E.ghost.clear(); E.ghostCur.length = 0;
  for (const m of E.ruins.values()) E.root.remove(m); E.ruins.clear();
  for (const m of WALLS.list) { E.root.remove(m); m.material.dispose(); } WALLS.list.length = 0; WALLS.n = 0;
}
export function disposeEntities() { clearEntities(); if (E.root) { S.scene.remove(E.root); E.root = null; } }
export const _E = E;
export function entityStats() { let sets = 0, inst = 0; for (const s of E.sets.values()) { sets++; inst += s.ims.length; } return { tpl: E.tpl.size, sets, ims: inst, stations: E.stations.size, pre: PRE.length }; }
