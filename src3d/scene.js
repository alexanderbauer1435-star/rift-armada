/* =====================================================================
   Rift Armada 3D – Bühne: WebGL-Renderer, Szene, Licht, Umgebung, Nachbearbeitung, Detailstufen und die
   ADAPTIVE AUFLÖSUNG. Licht und Ton sind vom Hangar (probe3d/hangar.js) übernommen: warmes Hauptlicht von rechts
   vorn oben, kühles Gegenlicht, schwaches warmes Aufhelllicht von unten, Hemisphäre, weiches Raumumfeld (PMREM).

   Auflösung (Render-Skalierung = Pixel je CSS-Pixel der WebGL-Leinwand) regelt der Renderer selbst:
   - Obergrenze max = min(Geräte-DPR, 2, √(2,2 MP / CSS-Fläche)) – ein großer PC-Bildschirm rendert höchstens
     ~2,2 Megapixel; Detail 1 (»Sparsam«) zusätzlich höchstens 1,25. Untergrenze 0,5 (nie unter 1, solange max ≥ 1
     und die Bildzeit reicht – die Regelung senkt nur bei gemessener Not).
   - Startwert min(max, 1,75): ein Handy mit DPR 2,75 startet scharf, ein PC mit DPR 1 bei 1.
   - Stufenleiter (unten → oben): Skalierung 0,5 … max in Schritten × 1,15, darüber »max + Bloom« (nur Detail 2).
     Gemessen wird der Abstand der Bildaufrufe (gleitender Mittelwert, Ausreißer > 250 ms verworfen, nach jeder
     Änderung 1 s Ruhe). Höchstens alle 2 s ein Schritt: langsamer als 20,5 ms → eine Stufe runter; schneller als
     17,8 ms → eine Stufe rauf. Hysterese: eine Stufe, die sich als zu langsam erwiesen hat, bleibt 20 s gesperrt
     (bei Wiederholung doppelt so lange). Brachte ein Schritt nach unten nichts (Bildtakt durch das Gerät begrenzt,
     z. B. Energiesparen mit 30 Hz), wird er zurückgenommen und die Regelung senkt 30 s nicht weiter (bei
     Wiederholung doppelt so lange, höchstens 4 min).
   - Bloom (Stärke 0,5, Radius 0,4, Schwelle 1,25) nur auf der obersten Stufe, mit einem Viertel der Auflösung; die
     Shader für den Bloom-Weg werden vorher im Hintergrund übersetzt (compileAsync), damit das Zuschalten nicht ruckelt.
   - Schatten: entfallen (Bildvergleich Detail 2 mit/ohne: in der Draufsicht ohne Boden kaum sichtbar, kosten aber
     einen zweiten Durchgang mit allen Draw-Calls und erzwingen beim Umschalten die Neuübersetzung aller Shader).
   - MSAA (Kontext-Eigenschaft, nicht umschaltbar): nur bei Geräte-DPR < 1,5 (PC-Bildschirme, Skalierung ≤ 1); bei
     hoher Pixeldichte ist die Skalierung meist ≥ 1,5 und Kantenglättung unnötig. Der Bloom-Weg nutzt dann ein
     Ziel mit 4 Abtastungen. Kein FXAA (kostet bei niedriger Skalierung gerade dort, wo Reserve fehlt).
   - Punktgrößen (Sterne) hängen an der Skalierung (onScale), damit sie bei jeder Stufe gleich groß wirken.
   Alle Module teilen sich den Zustand S; Q ist der Zustand der Regelung (RA3D.quality() zeigt ihn).
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const TILT = 0.95, FOV = 35;
/* Blickrichtung der Kamera auf den Boden (fest, siehe camera.js): Quads, die »zur Kamera« schauen, nutzen sie */
export const CAM_DIR = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));

export const S = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, canvas: null,
  detail: 1, ultra: false, want: 1, cssW: 2, cssH: 2, dpr: 1, time: 0, g: null, vp: -1, view: null,
  key: null, rim: null, fill: null, hemi: null, pmrem: null, ok: false, info: { calls: 0, tris: 0 }
};
/* Regelung: dev = Geräte-DPR, scale = aktuelle Skalierung, level = Stufe in steps, bloom = Bloom an */
const MP_MAX = 2.2e6, S_MIN = 0.5, STEP = 1.15, SLOW = 20.5, FAST = 17.8, HOLD = 2000, SETTLE = 1000;
export const Q = {
  auto: true, dev: 1, scale: 1, max: 1, start: 1, steps: [1], level: 0, top: 0, bloom: false, bloomReady: false, bloomWant: false, msaa: true,
  ema: 0, n: 0, last: 0, changed: 0, block: {}, blockT: {}, floorUntil: 0, probe: null, init: false
};
const SCALE_CB = [];
export function onScale(fn) { SCALE_CB.push(fn); fn(Q.scale); }

export function supported() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; }
}

/* Fassung 24: Leistungsklasse der Grafikeinheit (vor dem Anlegen des Kontexts geprüft, weil die Kantenglättung eine
   Eigenschaft des Kontexts ist). »low« = sehr einfache oder alte Karten und Software-Rasterung: ohne Kantenglättung,
   Auflösung höchstens 1, Start bei 0,85, kein Bloom. */
const WEAK = /GT ?7[1-4]0|GT ?6[1-4]0|GT ?5[2-4]0|GT ?4[2-4]0|GeForce (8|9)\d00|GeForce 210|GT ?1030|Radeon (HD [5-8]\d{3}|R[57] 2\d0)|Intel\(R\) HD Graphics( [2-5]\d{2,3})?(?!\s*6)|GMA|Mali-(4|T[67])|Adreno \(TM\) [3-5]\d\d|PowerVR|swiftshader|llvmpipe|softpipe|basic render/i;
function gpuProbe() {
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return ''; const x = gl.getExtension('WEBGL_debug_renderer_info'); const n = String((x && gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return n; } catch (e) { return ''; }
}
export function initScene(canvas, opts = {}) {
  Q.dev = Math.max(0.5, window.devicePixelRatio || 1);
  S.gpu = gpuProbe(); S.low = WEAK.test(S.gpu) && !(typeof window !== 'undefined' && window.__RA_TEST);
  Q.msaa = Q.dev < 1.5 && !S.low;
  try {
    S.canvas = canvas;
    /* preserveDrawingBuffer nur für Prüfbilder (Playwright liest sonst einen unfertigen Puffer) */
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.msaa, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  } catch (e) { console.warn('RA3D: WebGL nicht verfügbar', e); return false; }
  const r = S.renderer;
  r.setPixelRatio(1); r.setClearColor('#020308', 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = false;
  r.autoClear = true;
  S.scene = new THREE.Scene();
  S.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 40000);
  S.scene.add(S.camera);
  /* Umgebung für Reflexe (Metall, Glas, Kristall) */
  S.pmrem = new THREE.PMREMGenerator(r);
  try { S.scene.environment = S.pmrem.fromScene(new RoomEnvironment(), 0.04).texture; S.scene.environmentIntensity = 0.3; } catch (e) { console.warn('RA3D: Umgebung', e); }
  /* Licht wie im Hangar; die Richtungsleuchten folgen in camera.js dem Zielpunkt (ohne Schatten, siehe oben) */
  S.key = new THREE.DirectionalLight('#fff1dc', 2.6); S.key.position.set(120, 160, 90); S.scene.add(S.key); S.scene.add(S.key.target);
  S.rim = new THREE.DirectionalLight('#6fa8ff', 1.6); S.rim.position.set(-140, 60, -160); S.scene.add(S.rim); S.scene.add(S.rim.target);
  S.fill = new THREE.DirectionalLight('#ffb070', 0.5); S.fill.position.set(-60, -40, 120); S.scene.add(S.fill); S.scene.add(S.fill.target);
  S.hemi = new THREE.HemisphereLight('#3a4a7a', '#120a18', 0.55); S.scene.add(S.hemi);
  /* Nachbearbeitung (nur für Bloom): Ziel mit MSAA, wenn der Kontext MSAA hat; Bloom mit einem Viertel der Auflösung */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.msaa ? 4 : 0 });
  S.composer = new EffectComposer(r, rt); S.composer.addPass(new RenderPass(S.scene, S.camera));
  S.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.25);
  const bs = S.bloom.setSize.bind(S.bloom); S.bloom.setSize = (w, h) => bs(Math.max(16, Math.round(w / 2)), Math.max(16, Math.round(h / 2)));
  /* Fassung 24: ungültige oder überlaufende Farbwerte (NaN/Inf aus additiven Effekten im Halbfloat-Ziel) vor dem Bloom
     abfangen – sonst verschmiert der Bloom sie zu einem grauen Schleier über das ganze Bild */
  S.clean = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = clamp(c, 0.0, 48.0); }' });
  S.composer.addPass(S.clean); S.composer.addPass(S.bloom); S.composer.addPass(new OutputPass());
  S.ok = true;
  setDetail(S.detail);
  return true;
}

/* Grenzen und Stufenleiter aus Fläche, Geräte-DPR und Detailstufe */
function limits() {
  const area = Math.max(1, S.cssW * S.cssH), capMP = Math.sqrt(MP_MAX / area);
  /* Fassung 24 »Ultra«: volle Gerätepixel (bis DPR 3, höchstens ~4,5 MP), Start ganz oben mit Bloom */
  let max = S.ultra ? Math.min(Q.dev, 3, Math.sqrt(4.5e6 / Math.max(1, S.cssW * S.cssH))) : Math.min(Q.dev, 2, capMP);
  if (S.detail < 2) max = Math.min(max, 1.25);
  if (S.low) max = Math.min(max, 1);
  if (S.detail < 1) max = Math.min(max, 1);
  max = Math.max(S_MIN, max);
  const steps = []; for (let s = max; s > S_MIN * 1.001; s /= STEP) steps.unshift(+s.toFixed(3)); steps.unshift(S_MIN);
  if (steps.length > 1 && steps[1] - steps[0] < 0.04) steps.splice(1, 1);
  Q.max = max; Q.steps = steps; Q.top = steps.length - 1 + (S.detail >= 2 && !S.low ? 1 : 0);
  Q.start = S.low ? Math.min(max, 0.85) : S.ultra ? max : Math.min(max, 1.75);
}
function levelOf(scale) { let best = 0; for (let i = 0; i < Q.steps.length; i++) if (Q.steps[i] <= scale + 1e-3) best = i; return best; }
/* Stufe anwenden: Skalierung und Bloom */
function apply(level, now) {
  level = Math.max(0, Math.min(Q.top, level));
  Q.level = level; Q.changed = now || performance.now(); Q.n = 0;
  const sc = Q.steps[Math.min(level, Q.steps.length - 1)];
  Q.bloomWant = level >= Q.steps.length;
  if (Q.bloomWant && !Q.bloomReady) prewarmBloom();
  Q.bloom = Q.bloomWant && Q.bloomReady;
  if (Math.abs(sc - Q.scale) > 1e-3 || S.dpr !== sc) setScale(sc);
}
function setScale(sc) {
  Q.scale = sc; S.dpr = sc;
  if (!S.ok) return;
  S.renderer.setPixelRatio(sc); S.renderer.setSize(S.cssW, S.cssH, false);
  S.composer.setPixelRatio(sc); S.composer.setSize(S.cssW, S.cssH);
  S.camera.aspect = S.cssW / S.cssH; S.camera.updateProjectionMatrix();
  for (const fn of SCALE_CB) fn(sc);
}
/* Shader für den Bloom-Weg (Rendern in ein Ziel: ohne Tone-Mapping im Material) im Hintergrund übersetzen */
function prewarmBloom() {
  if (Q.probe) return;
  const r = S.renderer; if (!r) { Q.bloomReady = true; return; }
  try {
    r.setRenderTarget(S.composer.readBuffer);
    Q.probe = r.compileAsync(S.scene, S.camera).then(() => { Q.bloomReady = true; Q.probe = null; if (Q.bloomWant) Q.bloom = true; }, () => { Q.bloomReady = true; Q.probe = null; });
  } catch (e) { Q.bloomReady = true; Q.probe = null; }
  r.setRenderTarget(null);
}
/* Szene neu (setGame): Bloom-Shader neu vorbereiten, Messung ruhen lassen */
export function sceneChanged() { Q.bloomReady = false; Q.bloom = false; Q.changed = performance.now(); Q.n = 0; if (Q.bloomWant) prewarmBloom(); }

/* Größe der Leinwand (CSS-Pixel) und Geräte-DPR. Die Skalierung bleibt erhalten (nur auf die neuen Grenzen geklemmt). */
export function resize(cssW, cssH, dev) {
  S.cssW = Math.max(2, cssW | 0); S.cssH = Math.max(2, cssH | 0);
  if (dev) Q.dev = Math.max(0.5, Math.min(4, dev));
  limits();
  if (!S.ok) return;
  if (!Q.init) { Q.init = true; apply(S.ultra && !S.low ? Q.top : levelOf(Q.start)); return; }
  const want = Q.bloomWant ? Q.top : levelOf(Math.min(Q.scale, Q.max));
  Q.scale = -1; apply(Math.min(want, Q.top));
}

export function setDetail(d) {
  const was = S.ultra; S.want = d | 0; S.ultra = (d | 0) >= 3;
  S.detail = Math.max(0, Math.min(2, d | 0));
  if (!S.ok) return;
  limits();
  if (!Q.init) return;
  const want = S.ultra || Q.bloomWant ? Q.top : levelOf(Math.min(Q.scale, Q.max)); if (S.ultra !== was) Q.block = {};
  Q.scale = -1; apply(Math.min(want, Q.top));
}

/* Regelung je Bild: Abstand der Aufrufe messen, höchstens alle 2 s eine Stufe ändern */
export function adapt(now) {
  const dt = now - Q.last; Q.last = now;
  if (!Q.auto || !(dt > 0) || dt > 250) return;
  if (now - Q.changed < SETTLE) return;
  Q.ema = Q.n ? Q.ema * 0.9 + dt * 0.1 : dt; Q.n++;
  if (Q.n < 30 || now - Q.changed < HOLD) return;
  /* letzter Schritt nach unten brachte nichts → zurück und eine Weile nicht weiter senken */
  if (Q.down && Q.ema > Q.down.ema * 0.92) { const back = Q.down.from; Q.down = null; Q.floorT = Math.min(240000, (Q.floorT || 15000) * 2); Q.floorUntil = now + Q.floorT; Q.floor = back; apply(back, now); return; }
  Q.down = null;
  if (Q.ema > SLOW && Q.level > 0 && !(now < Q.floorUntil && Q.level <= Q.floor)) {
    const from = Q.level; Q.block[from] = now + (Q.blockT[from] = Math.min(160000, (Q.blockT[from] || 10000) * 2));
    Q.down = { from, ema: Q.ema }; apply(from - 1, now);
  } else if (Q.ema < FAST && Q.level < Q.top && !(Q.block[Q.level + 1] > now)) apply(Q.level + 1, now);
}
/* Test- und Einstellhaken: auto an/aus, feste Skalierung, Bloom */
export function setQuality(o) {
  if (o.auto !== undefined) Q.auto = !!o.auto;
  if (o.scale !== undefined) { Q.bloomWant = false; Q.bloom = false; setScale(Math.max(0.25, Math.min(3, o.scale))); Q.level = levelOf(Q.scale); }
  if (o.bloom !== undefined) { Q.bloomWant = !!o.bloom; if (Q.bloomWant && !Q.bloomReady) prewarmBloom(); Q.bloom = Q.bloomWant && Q.bloomReady; }
}
export const _Q = Q;
export function quality() { return { auto: Q.auto, scale: +Q.scale.toFixed(3), max: +Q.max.toFixed(3), level: Q.level, top: Q.top, bloom: Q.bloom, msaa: Q.msaa, ema: +Q.ema.toFixed(1), MP: +(S.cssW * S.cssH * Q.scale * Q.scale / 1e6).toFixed(2), steps: Q.steps }; }

/* Bild zeichnen: über den Composer nur mit Bloom, sonst direkt */
export function render() {
  if (!S.ok) return;
  const info = S.renderer.info; info.autoReset = false; info.reset();
  if (Q.bloom) S.composer.render(); else S.renderer.render(S.scene, S.camera);
  S.info.calls = info.render.calls; S.info.tris = info.render.triangles;
}

export function disposeScene() {
  if (!S.ok) return;
  S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (S.pmrem) S.pmrem.dispose();
  S.composer.dispose(); S.renderer.dispose();
  S.ok = false; S.scene = null; S.renderer = null; Q.init = false;
}
