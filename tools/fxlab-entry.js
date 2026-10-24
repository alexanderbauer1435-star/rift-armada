/* =====================================================================
   Effekt-Labor für den 3D-Renderer: kleine Szene mit Kamera wie im Spiel (Neigung 0,95 rad, FOV 35, ~600 Einheiten
   Abstand), Platzhalter-Körpern als Schiffe und Station, Bloom wie im Kern. Spielt Szenarien aus Ereignissen und
   Zuständen (Strahlen, Geschosse, Flares, Sporen, Risse) mit festem Zeitschritt ab; window.FXLAB.run(name, t) stellt
   den Zustand zur Zeit t her und zeichnet ein Standbild. Bündeln: siehe tools/fxlab.js.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mats } from '../src3d/models/kit.js';
import * as FX from '../src3d/effects/index.js';

const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
/* Sternenhimmel */
{
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const x = c.getContext('2d');
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#05070f'); g.addColorStop(0.5, '#0b1026'); g.addColorStop(1, '#04060d'); x.fillStyle = g; x.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 40; i++) { const cx = r() * 2048, cy = 250 + r() * 520, rr = 80 + r() * 260, gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr); const col = r() < 0.6 ? '110,60,170' : '40,110,170'; gr.addColorStop(0, `rgba(${col},${0.04 + r() * 0.06})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(220,230,255,${0.2 + r() * 0.8})`; x.fillRect(r() * 2048, r() * 1024, r() < 0.03 ? 2 : 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t;
}
const key = new THREE.DirectionalLight('#fff1dc', 2.4); key.position.set(120, 160, 90); scene.add(key);
const rim = new THREE.DirectionalLight('#6fa8ff', 1.4); rim.position.set(-140, 60, -160); scene.add(rim);
scene.add(new THREE.HemisphereLight('#3a4a7a', '#120a18', 0.5));
/* dezentes Bodengitter zur Orientierung (im Spiel nicht vorhanden) */
{
  const g = new THREE.GridHelper(1600, 32, '#1a2748', '#101a30'); g.material.transparent = true; g.material.opacity = 0.35; g.position.y = -0.2; scene.add(g);
}
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.25); composer.addPass(bloom); composer.addPass(new OutputPass());
const SCALE = +(new URLSearchParams(location.search).get('scale') || window.FXLAB_SCALE || 1); renderer.setPixelRatio(SCALE); composer.setPixelRatio(SCALE); FX.setPixelRatio(SCALE);
function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); bloom.resolution.set(w / 2, h / 2); }
window.addEventListener('resize', resize); resize();
function setCam(cx, cy, dist) { const tilt = 0.95; camera.position.set(cx, Math.sin(tilt) * dist, cy + Math.cos(tilt) * dist); camera.lookAt(cx, 0, cy); }
setCam(0, 0, 600);

/* ------------------------------------------------------------ Platzhalter-Körper */
const M = mats('alliance'), MB = mats('brood', '#8be04a');
const bodies = new THREE.Group(); scene.add(bodies);
function shipBody(x, y, ang, len, m) {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.BoxGeometry(len * 0.35, len * 0.16, len), m.hull); h.position.y = len * 0.08; g.add(h);
  const b = new THREE.Mesh(new THREE.ConeGeometry(len * 0.17, len * 0.4, 8), m.hull2); b.rotation.x = Math.PI / 2; b.position.set(0, len * 0.08, len * 0.6); g.add(b);
  const e = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.08, len * 0.1, len * 0.2, 10), m.glow); e.rotation.x = Math.PI / 2; e.position.set(0, len * 0.08, -len * 0.52); g.add(e);
  g.position.set(x, 0, y); g.rotation.y = Math.PI / 2 - ang; bodies.add(g); return g;
}
function stationBody(x, y, r, m) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, r * 0.5, 10), m.hull2)).position.y = r * 0.25;
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.3, r * 0.9, 8), m.hull); t.position.y = r * 0.9; g.add(t);
  g.position.set(x, 0, y); bodies.add(g); return g;
}

/* ------------------------------------------------------------ Attrappe des Spielzustands */
const W_BEAM = { kind: 'beam', w: 2.2 }, W_LANCE = { kind: 'beam', w: 2.8, col: '#d9b8ff' }, W_PRISM = { kind: 'beam', w: 2.6, col: '#f3e6ff', split: 3 }, W_WARD = { kind: 'beam', w: 5, col: '#b8ffd8' };
function mkG() {
  const g = { time: 0, byId: new Map(), ships: [], bldgs: [], proj: [], strikes: [], flares: [], spores: [], wave: null, map: { w: 2000, h: 2000 }, players: [{ faction: 'alliance', color: '#5fb8ff' }, { faction: 'brood', color: '#8be04a' }, { faction: 'legion', color: '#f2c14e' }] };
  const add = o => { g.byId.set(o.id, o); (o.k === 2 ? g.bldgs : g.ships).push(o); return o; };
  add({ k: 1, id: 1, x: -170, y: 60, ang: -0.3, v: 0, owner: 0, def: { r: 14, len: 38, wpn: [W_BEAM, W_BEAM] }, beams: null, dead: false });
  add({ k: 1, id: 2, x: 150, y: -40, ang: Math.PI + 0.4, v: 0, owner: 1, shield: 100, def: { r: 14, len: 36, wpn: [] }, dead: false });
  add({ k: 1, id: 3, x: 60, y: 120, ang: 2.5, v: 0, owner: 1, shield: 0, derelict: true, def: { r: 10, len: 26, wpn: [] }, dead: false });
  add({ k: 1, id: 4, x: 220, y: 90, ang: 1.8, v: 0, owner: 1, def: { r: 10, len: 26, wpn: [] }, dead: false });
  add({ k: 2, id: 5, x: -200, y: -140, lv: 2, owner: 2, def: { r: 40, lv: [{ wpn: [W_LANCE] }, { wpn: [W_LANCE, W_PRISM] }] }, beams: null, dead: false });
  add({ k: 1, id: 6, x: -40, y: -60, ang: 0.6, v: 0, owner: 0, def: { r: 20, len: 56, wpn: [W_PRISM, W_WARD] }, beams: null, dead: false });
  return g;
}
const VIEW = { vp: -1, detail: 2, pcol: o => G.players[o].color, visible: () => true, seen: () => true, shake: () => {} };
let G = mkG();
function buildBodies() {
  while (bodies.children.length) bodies.remove(bodies.children[0]);
  for (const s of G.ships) shipBody(s.x, s.y, s.ang, s.def.len, s.owner === 1 ? MB : M);
  for (const b of G.bldgs) stationBody(b.x, b.y, b.def.r, M);
}

/* ------------------------------------------------------------ Szenarien: { at, ev } oder { at, do(g) }; step(g, dt) je Schritt */
const proj = (kind, x, y, ang, sp, col, owner = 0) => ({ kind, x, y, ang, sp, r: 4, col, owner, life: 5 });
const SC = {
  beams: {
    ev: [{ at: 0, do: g => { g.byId.get(1).beams = [{ tid: 2, t: 0.16, extra: null }, { tid: 3, t: 0.16, extra: null }]; g.byId.get(5).beams = [{ tid: 2, t: 0.16, extra: null }, { tid: 3, t: 0.16, extra: [4] }]; g.byId.get(6).beams = [{ tid: 4, t: 0.16, extra: [3, 2] }, { tid: 2, t: 0.16, extra: null }]; } },
      { at: 0.1, ev: { t: 'hit', x: 150, y: -40, kind: 'beam' } }, { at: 0.3, ev: { t: 'shield', x: 150, y: -40, r: 18, ang: Math.PI + 0.3, owner: 1 } }],
    times: [0.4, 1.2]
  },
  proj: {
    ev: [{ at: 0, do: g => { g.proj.push(proj('kin', -200, 100, -0.2, 820, '#ffd27a'), proj('kin', -180, 130, -0.2, 820, '#9ff'), proj('rail', -240, 20, 0.05, 1600, null), proj('torp', -150, -40, 0.3, 240, null), proj('torp', -120, -70, 0.25, 240, null), proj('acid', 200, 140, Math.PI + 0.6, 480, '#b4ff3c', 1), proj('acid', 230, 110, Math.PI + 0.7, 480, '#b4ff3c', 1), proj('rock', 240, -160, Math.PI - 0.5, 300, null), proj('kin', 180, 40, Math.PI - 0.1, 600, '#b4ff3c', 1)); g.proj[g.proj.length - 1].kind = 'bite'; } },
      { at: 0, ev: { t: 'shot', x: -240, y: 20, kind: 'rail', owner: 0, ang: 0.05 } }, { at: 0, ev: { t: 'shot', x: -200, y: 100, kind: 'kin', owner: 0, ang: -0.2, big: true } }],
    step: (g, dt) => { for (const q of g.proj) { q.x += Math.cos(q.ang) * q.sp * dt; q.y += Math.sin(q.ang) * q.sp * dt; } },
    times: [0.08, 0.22, 0.4]
  },
  hits: {
    ev: [{ at: 0, ev: { t: 'hit', x: -160, y: 60, kind: 'kin' } }, { at: 0, ev: { t: 'hit', x: -80, y: 60, kind: 'beam' } }, { at: 0, ev: { t: 'hit', x: 0, y: 60, kind: 'rail' } }, { at: 0, ev: { t: 'hit', x: 80, y: 60, kind: 'torp' } }, { at: 0, ev: { t: 'hit', x: 160, y: 60, kind: 'acid' } }, { at: 0, ev: { t: 'hit', x: 240, y: 60, kind: 'torpdie' } },
      { at: 0, ev: { t: 'shield', x: -120, y: -60, r: 18, ang: 0.4, owner: 0 } }, { at: 0, ev: { t: 'shield', x: 0, y: -60, r: 24, ang: -1.2, owner: 1 } }, { at: 0, ev: { t: 'shield', x: 120, y: -60, r: 18, ang: 2.5, owner: 2 } }, { at: 0, ev: { t: 'shdown', x: 220, y: -60, r: 18 } },
      { at: 0, ev: { t: 'pd', x: -200, y: -160, tx: -120, ty: -120 } }, { at: 0, ev: { t: 'pd', x: -200, y: -160, tx: -150, ty: -100 } }],
    times: [0.04, 0.12, 0.25]
  },
  dieS: { ev: [{ at: 0, ev: { t: 'die', x: 0, y: 0, r: 14, big: false, owner: 0, type: 'lancer', ang: 0 } }], times: [0.08, 0.25, 0.5, 1.0] },
  dieB: { ev: [{ at: 0, ev: { t: 'die', x: 0, y: 0, r: 28, big: true, owner: 1, type: 'haven', ang: 0 } }], times: [0.1, 0.35, 0.8, 1.8] },
  bdie: { ev: [{ at: 0, ev: { t: 'bdie', x: 0, y: 0, r: 60, owner: 2 } }], times: [0.15, 0.5, 1.1, 2.4] },
  strike: { ev: [{ at: 0, ev: { t: 'strike', x: 0, y: 0, r: 150, owner: 0 } }], times: [0.1, 0.4, 1.0, 2.2] },
  massfly: { ev: [{ at: 0, do: g => { g.strikes.push({ x: 100, y: 0, sx: -400, sy: 200, r: 150, t: 3.5 }); } }], step: (g, dt) => { for (const s of g.strikes) s.t -= dt; }, times: [0.8, 1.8] },
  flare: { ev: [{ at: 0, do: g => { g.flares.push({ x: 0, y: 0, r: 200, t: 10, t0: 10 }); } }], step: (g, dt) => { for (const f of g.flares) f.t -= dt; }, times: [0.6, 3] },
  world: { ev: [{ at: 0, do: g => { g.spores.push({ x: -150, y: 40, r: 140, t: 20 }); g.wave = { phase: 'wave', open: [{ x: 220, y: -100 }] }; } }], times: [1, 3] },
  gate: { ev: [{ at: 0, ev: { t: 'gateLance', fx: -380, fy: -240, x: 20, y: 10 } }, { at: 0.2, ev: { t: 'lance', x: 250, y: 160, tx: 120, ty: 60 } }], times: [0.1, 0.45, 1.2] },
  exodus: { ev: [{ at: 0, ev: { t: 'superfire', kind: 'exodus', x: 0, y: 0 } }, { at: 0.3, ev: { t: 'exodus', x: -170, y: 60, r: 14, to: 1 } }, { at: 0.5, ev: { t: 'exodus', x: 150, y: -40, r: 14, to: 0 } }], times: [0.25, 0.8, 1.5] },
  brood: { ev: [{ at: 0, ev: { t: 'superfire', kind: 'broodstorm', x: 0, y: 0, r: 180 } }], times: [0.3, 1.0, 2.0] },
  rings: { ev: [{ at: 0, ev: { t: 'built', x: -200, y: -120, owner: 0 } }, { at: 0, ev: { t: 'jump', x: -60, y: -120, r: 14 } }, { at: 0, ev: { t: 'breach', x: 120, y: -120, r: 40 } }, { at: 0, ev: { t: 'resurrect', x: -180, y: 100 } }, { at: 0, ev: { t: 'bound', fx: -40, fy: 160, x: 60, y: 100 } }, { at: 0, ev: { t: 'devour', x: 200, y: 100, tx: 260, ty: 160, r: 14 } }, { at: 0, ev: { t: 'hatch', x: 240, y: 0, r: 12 } }, { at: 0, ev: { t: 'dormant', x: 0, y: 20 } }], times: [0.3, 0.8] },
  /* Lasttest: viele Explosionen, Geschosse und Strahlen zugleich – prüft Verdrängung im Vorrat und die Rechenzeit */
  stress: {
    ev: [{ at: 0, do: g => { for (let i = 0; i < 160; i++) g.proj.push(proj(['kin', 'kin', 'acid', 'torp', 'rail'][i % 5], -300 + Math.random() * 600, -200 + Math.random() * 400, Math.random() * 6.28, 300, i % 5 === 2 ? '#b4ff3c' : '#ffd27a', i % 2)); g.byId.get(1).beams = [{ tid: 2, t: 1, extra: null }, { tid: 3, t: 1, extra: null }]; g.byId.get(6).beams = [{ tid: 4, t: 1, extra: [3, 2] }, null]; } },
      ...Array.from({ length: 40 }, (_, i) => ({ at: i * 0.05, ev: { t: 'die', x: -280 + Math.random() * 560, y: -180 + Math.random() * 360, r: 10 + Math.random() * 20, big: i % 3 === 0, owner: i % 2 } })),
      { at: 0.5, ev: { t: 'bdie', x: 0, y: 0, r: 60, owner: 2 } }, { at: 0.8, ev: { t: 'strike', x: 150, y: 80, r: 150 } }],
    step: (g, dt) => { for (const q of g.proj) { q.x += Math.cos(q.ang) * q.sp * dt; q.y += Math.sin(q.ang) * q.sp * dt; } },
    times: [1.0, 2.0]
  },
  /* Dauerfeuer auf Schilde: Kuppel muss ruhig bleiben (Auffrischen statt Stapeln); das herrenlose Schiff (id 3) bekommt keine Kuppel */
  shieldfire: {
    ev: [{ at: 0, do: g => { g.byId.get(1).beams = [{ tid: 2, t: 1, extra: null }, { tid: 3, t: 1, extra: null }]; g.byId.get(6).beams = [{ tid: 2, t: 1, extra: null }, null]; } }],
    step: (g, dt) => { const n = Math.round(g.time * 60); if (n % 2 === 0) { for (const id of [2, 3]) { const t = g.byId.get(id), a = id === 2 ? Math.PI - 0.6 + Math.sin(g.time * 5) * 0.4 : -2.4; FX.event({ t: 'shield', x: t.x, y: t.y, r: t.def.r * 1.25, ang: a, owner: t.owner }, g, VIEW); } } },
    times: [0.5, 1.5]
  },
  damage: { ev: [], step: (g, dt) => { if (Math.random() < 10 * dt) FX.spawn.smoke(-170, 60, 10, 2); if (Math.random() < 6 * dt) FX.spawn.spark(150, -40, 3, 50, '#ffd27a'); }, times: [1.5, 3] }
};
let inited = false;
function run(name, t) {
  const sc = SC[name]; if (!sc) throw new Error('kein Szenario ' + name);
  if (!inited) { FX.init(scene, THREE, mats, undefined); inited = true; }
  FX.clear(); G = mkG(); buildBodies();
  let time = 0, cpu = 0, frames = 0; const dt = 1 / 60, ev = sc.ev.slice();
  while (time < t - 1e-6) {
    for (let i = 0; i < ev.length; i++) if (ev[i].at <= time + 1e-6) { const q = ev.splice(i--, 1)[0]; if (q.ev) FX.event(q.ev, G, VIEW); else q.do(G); }
    if (sc.step) sc.step(G, dt);
    time += dt; G.time = time;
    const t0 = performance.now(); FX.frame(G, dt, time, VIEW, camera); cpu += performance.now() - t0; frames++;
  }
  composer.render();
  return Object.assign(FX.stats(), { cpuMs: +(cpu / Math.max(1, frames)).toFixed(2) });
}
window.FXLAB = { run, setCam, setDetail: d => FX.setDetail(d), list: Object.keys(SC), times: n => SC[n].times };
