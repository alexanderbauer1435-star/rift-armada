/* =====================================================================
   Rift Armada 3D – Bühne: WebGL-Renderer, Szene, Licht, Umgebung, Nachbearbeitung (Bloom nur bei Detail 2),
   Detailstufen und Größenanpassung. Licht und Ton sind vom Hangar (probe3d/hangar.js) übernommen, damit die
   abgenommenen Modelle im Spiel genauso aussehen: warmes Hauptlicht von rechts vorn oben, kühles Gegenlicht,
   schwaches warmes Aufhelllicht von unten, Hemisphäre und ein weiches Raumumfeld (PMREM) für Reflexe.
   Entscheidungen (die Spec lässt sie offen):
   - Tone-Mapping ACES, Belichtung 1,0; Bloom (Stärke 0,5, Radius 0,4, Schwelle 1,25) nur bei Detail 2.
   - Schatten nur bei Detail 2: eine Richtungsleuchte mit 2048er Karte, die der Kamera folgt (camera.js).
   - Pixelverhältnis: Detail 0 höchstens 1, Detail 1 höchstens 1,5, Detail 2 höchstens 2.
   Alle Module teilen sich den Zustand S.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const TILT = 0.95, FOV = 35;
/* Blickrichtung der Kamera auf den Boden (fest, siehe camera.js): Quads, die »zur Kamera« schauen, nutzen sie */
export const CAM_DIR = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));

export const S = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, canvas: null,
  detail: 1, cssW: 2, cssH: 2, dpr: 1, time: 0, g: null, vp: -1, view: null,
  key: null, rim: null, fill: null, hemi: null, pmrem: null, ok: false, info: { calls: 0, tris: 0 }
};
const DPR_MAX = [1, 1.5, 2];

export function supported() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; }
}

export function initScene(canvas, opts = {}) {
  try {
    S.canvas = canvas;
    /* preserveDrawingBuffer nur für Prüfbilder (Playwright liest sonst einen unfertigen Puffer) */
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  } catch (e) { console.warn('RA3D: WebGL nicht verfügbar', e); return false; }
  const r = S.renderer;
  r.setPixelRatio(1); r.setClearColor('#020308', 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = false; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.autoClear = true;
  S.scene = new THREE.Scene();
  S.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 40000);
  S.scene.add(S.camera);
  /* Umgebung für Reflexe (Metall, Glas, Kristall) */
  S.pmrem = new THREE.PMREMGenerator(r);
  try { S.scene.environment = S.pmrem.fromScene(new RoomEnvironment(), 0.04).texture; S.scene.environmentIntensity = 0.3; } catch (e) { console.warn('RA3D: Umgebung', e); }
  /* Licht wie im Hangar; die Richtungsleuchten folgen in camera.js dem Zielpunkt */
  S.key = new THREE.DirectionalLight('#fff1dc', 2.6); S.key.position.set(120, 160, 90); S.key.shadow.mapSize.set(2048, 2048);
  Object.assign(S.key.shadow.camera, { left: -600, right: 600, top: 600, bottom: -600, near: 10, far: 3000 }); S.key.shadow.bias = -0.0004; S.key.shadow.normalBias = 0.5;
  S.scene.add(S.key); S.scene.add(S.key.target);
  S.rim = new THREE.DirectionalLight('#6fa8ff', 1.6); S.rim.position.set(-140, 60, -160); S.scene.add(S.rim); S.scene.add(S.rim.target);
  S.fill = new THREE.DirectionalLight('#ffb070', 0.5); S.fill.position.set(-60, -40, 120); S.scene.add(S.fill); S.scene.add(S.fill.target);
  S.hemi = new THREE.HemisphereLight('#3a4a7a', '#120a18', 0.55); S.scene.add(S.hemi);
  /* Nachbearbeitung: Bloom (nur Detail 2) */
  S.composer = new EffectComposer(r); S.composer.addPass(new RenderPass(S.scene, S.camera));
  S.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.25); S.composer.addPass(S.bloom); S.composer.addPass(new OutputPass());
  S.ok = true;
  setDetail(S.detail);
  return true;
}

export function resize(cssW, cssH, dpr) {
  S.cssW = Math.max(2, cssW | 0); S.cssH = Math.max(2, cssH | 0); S.dpr = Math.min(dpr || 1, DPR_MAX[S.detail]);
  if (!S.ok) return;
  S.renderer.setPixelRatio(S.dpr); S.renderer.setSize(S.cssW, S.cssH, false);
  S.composer.setSize(S.cssW, S.cssH); S.bloom.resolution.set(S.cssW / 2, S.cssH / 2);
  S.camera.aspect = S.cssW / S.cssH; S.camera.updateProjectionMatrix();
}

export function setDetail(d) {
  S.detail = Math.max(0, Math.min(2, d | 0));
  if (!S.ok) return;
  S.renderer.shadowMap.enabled = S.detail >= 2; S.key.castShadow = S.detail >= 2;
  if (S.detail >= 2) S.renderer.shadowMap.needsUpdate = true;
  resize(S.cssW, S.cssH, S.dpr);
}

/* Bild zeichnen: über den Composer (Bloom) bei Detail 2, sonst direkt */
export function render() {
  if (!S.ok) return;
  const info = S.renderer.info; info.autoReset = false; info.reset();
  if (S.detail >= 2) S.composer.render(); else S.renderer.render(S.scene, S.camera);
  S.info.calls = info.render.calls; S.info.tris = info.render.triangles;
}

export function disposeScene() {
  if (!S.ok) return;
  S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (S.pmrem) S.pmrem.dispose();
  S.composer.dispose(); S.renderer.dispose();
  S.ok = false; S.scene = null; S.renderer = null;
}
