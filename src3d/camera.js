/* =====================================================================
   Rift Armada 3D – Kamera. Die Spiel-UI denkt in »Pixel je Einheit« (Zoom) und einem Weltpunkt in der
   Bildschirmmitte; hier wird daraus eine Perspektivkamera (FOV 35°) mit fester Neigung TILT = 0,95 rad über der
   Bodenebene, die von größerem Welt-y (unten auf dem Bildschirm) auf den Zielpunkt schaut. Der Abstand ist so
   gewählt, dass die Bodenebene in der Bildschirmmitte quer (Welt-x) genau `zoom` Pixel je Einheit misst
   (k = 1 in der Formel der Spec); in Welt-y erscheint der Boden um sin(TILT) gestaucht.
   project/unproject rechnen zwischen Welt (x, y) und CSS-Pixeln; unproject schneidet den Sehstrahl mit Y = 0 und
   klammert Strahlen über dem Horizont auf 60 Kameraabstände. shake(k) lässt die Kamera ~0,5 s zittern.
   Außerdem: Sichtkegel (Frustum) für das Aussortieren; die Leuchten folgen dem Zielpunkt (ohne Schatten).
   ===================================================================== */
import * as THREE from 'three';
import { S, TILT, FOV, resize } from './scene.js';

export const CAM = { cx: 0, cy: 0, zoom: 1, dist: 1000, shakeK: 0, shakeT: 0, frustum: new THREE.Frustum(), tanHalf: Math.tan(FOV / 2 * Math.PI / 180), sx: 0, sy: 0, sz: 0 };
const M = new THREE.Matrix4(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), SPH = new THREE.Sphere();
const KEY_DIR = new THREE.Vector3(120, 160, 90).normalize(), RIM_DIR = new THREE.Vector3(-140, 60, -160).normalize(), FILL_DIR = new THREE.Vector3(-60, -40, 120).normalize();

export function setCam(cx, cy, zoom, cssW, cssH, dpr) {
  /* Größe geändert, ohne dass resize() kam: nachziehen (die Skalierung regelt scene.js, dpr wird hier nicht gebraucht) */
  if (cssW && cssH && ((cssW | 0) !== S.cssW || (cssH | 0) !== S.cssH)) resize(cssW, cssH);
  void dpr;
  CAM.cx = cx; CAM.cy = cy; CAM.zoom = Math.max(0.05, zoom);
  CAM.dist = cssH / (2 * CAM.tanHalf * CAM.zoom);
  place();
}
/* Kamera aus Zielpunkt, Abstand und Wackeln aufstellen; Matrizen und Sichtkegel aktualisieren */
function place() {
  const c = S.camera; if (!c) return;
  const d = CAM.dist, ty = CAM.cy;
  c.position.set(CAM.cx + CAM.sx, Math.sin(TILT) * d + CAM.sy, ty + Math.cos(TILT) * d + CAM.sz);
  c.up.set(0, 1, 0); c.lookAt(CAM.cx + CAM.sx, CAM.sy, ty + CAM.sz);
  c.near = Math.max(1, d * 0.12); c.far = Math.max(12000, d * 6 + 30000);
  c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  M.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); CAM.frustum.setFromProjectionMatrix(M);
  /* Leuchten folgen dem Zielpunkt (nur die Richtung zählt) */
  const T = V2.set(CAM.cx, 0, ty), L = S.key;
  L.target.position.copy(T); L.position.copy(KEY_DIR).multiplyScalar(1600).add(T);
  /* Fassung 25: Schattenkamera deckt den sichtbaren Ausschnitt ab (Breite aus Abstand und Seitenverhältnis) */
  if (L.castShadow) { const sc = L.shadow.camera, h = d * Math.tan(c.fov * Math.PI / 360) * Math.max(1, c.aspect) * 1.25 + 120; if (Math.abs(sc.right - h) > h * 0.05) { sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.updateProjectionMatrix(); } }
  S.rim.target.position.copy(T); S.rim.position.copy(RIM_DIR).multiplyScalar(1000).add(T);
  S.fill.target.position.copy(T); S.fill.position.copy(FILL_DIR).multiplyScalar(1000).add(T);
}
/* je Bild: Wackeln abklingen lassen und neu aufstellen */
export function updateCamera(dt) {
  if (CAM.shakeT > 0) {
    CAM.shakeT = Math.max(0, CAM.shakeT - dt);
    const a = CAM.shakeK * (CAM.shakeT / 0.5);
    CAM.sx = (Math.random() - 0.5) * a; CAM.sy = (Math.random() - 0.5) * a * 0.5; CAM.sz = (Math.random() - 0.5) * a;
    if (CAM.shakeT === 0) { CAM.sx = CAM.sy = CAM.sz = 0; CAM.shakeK = 0; }
  }
  place();
}
export function shake(k) { if (!(k > 0)) return; CAM.shakeK = Math.max(CAM.shakeK * (CAM.shakeT / 0.5), k); CAM.shakeT = 0.5; }

/* Welt (x, y) → Bildschirm; s = Pixel je Einheit an dieser Stelle; null hinter der Kamera */
export function project(x, y, h = 0) {
  const c = S.camera; if (!c) return null;
  V.set(x, h, y).applyMatrix4(c.matrixWorldInverse);
  const depth = -V.z; if (depth <= c.near * 0.5) return null;
  const s = S.cssH / (2 * CAM.tanHalf * depth);
  V.applyMatrix4(c.projectionMatrix);
  return { x: (V.x + 1) * 0.5 * S.cssW, y: (1 - V.y) * 0.5 * S.cssH, s };
}
/* Bildschirm → Weltpunkt auf der Bodenebene */
export function unproject(sx, sy) {
  const c = S.camera; if (!c) return { x: sx, y: sy };
  V.set(sx / S.cssW * 2 - 1, 1 - sy / S.cssH * 2, 0.5).unproject(c);
  V.sub(c.position).normalize();
  const o = c.position, tmax = CAM.dist * 60;
  let t = V.y < -1e-6 ? -o.y / V.y : tmax; if (t > tmax) t = tmax;
  return { x: o.x + V.x * t, y: o.z + V.z * t };
}
/* Kugel um (x, y) mit Radius r (Höhe h über dem Boden) im Sichtkegel? */
export function inView(x, y, r, h = 0) { SPH.center.set(x, h, y); SPH.radius = r; return CAM.frustum.intersectsSphere(SPH); }
