/* =====================================================================
   Rift Armada 3D – Sofort-Primitive am Boden: Kreise und Bögen (ring), Linien (line) und gefüllte Scheiben (disc).
   Die Spiel-UI (Auswahl, Reichweiten, Bauvorschau) und der Kern selbst (Baufortschritt, Ausbau, Ladung der
   Superwaffe, Abbau-Ringe, Zustände der Schiffe) übergeben sie jeden Frame neu; am Ende des Frames wird geleert.
   Alles landet als flache Dreiecke (Bänder in Pixelbreite, Fächer für Scheiben) in EINEM dynamischen Puffer mit
   Farbe + Deckkraft je Ecke → ein Draw-Call je Frame. Entscheidungen: Y = 0,5 über dem Boden, ohne Tiefentest
   (Marker sollen nie in Modellen verschwinden), Reihenfolge 50 (vor dem Nebel des Krieges, der bei 100 liegt);
   Breiten sind CSS-Pixel und werden über die örtliche Pixeldichte (project().s) in Welteinheiten umgerechnet.
   Strichelung: opts.dash = Strichlänge in Pixeln (true = 6), opts.march lässt die Striche wandern.
   ===================================================================== */
import * as THREE from 'three';
import { S, Q } from './scene.js';
import { project } from './camera.js';

const Y = 0.5, TAU = Math.PI * 2;
const O = { mesh: null, geo: null, pos: null, col: null, cap: 0, n: 0, tmp: new THREE.Color() };

export function initOverlay() {
  alloc(24000);
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'attribute vec4 col; varying vec4 vCol; void main() { vCol = col; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    /* Fassung 24: im Bloom-Weg (lineares Ziel) mischt die Karte linear – halbtransparente Flächen wirkten dort etwa dreimal
       so hell (grauer Schleier); uLin = 1 gleicht die Deckkraft an die sRGB-Mischung des direkten Wegs an */
    uniforms: { uLin: { value: 0 } },
    fragmentShader: 'uniform float uLin; varying vec4 vCol; void main() { gl_FragColor = vCol; gl_FragColor.a = mix(vCol.a, pow(max(vCol.a, 0.0), 2.2), uLin);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide
  });
  O.mesh = new THREE.Mesh(O.geo, mat); O.mesh.frustumCulled = false; O.mesh.renderOrder = 50; O.mesh.name = 'overlay';
  S.scene.add(O.mesh);
}
function alloc(cap) {
  O.cap = cap; O.pos = new Float32Array(cap * 3); O.col = new Float32Array(cap * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(O.pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('col', new THREE.BufferAttribute(O.col, 4).setUsage(THREE.DynamicDrawUsage));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  if (O.geo) { O.geo.dispose(); }
  O.geo = g; if (O.mesh) O.mesh.geometry = g;
}
function need(k) { if (O.n + k > O.cap) { const p = O.pos, c = O.col, n = O.n; alloc(Math.max(O.cap * 2, O.n + k + 1024)); O.pos.set(p.subarray(0, n * 3)); O.col.set(c.subarray(0, n * 4)); } }
function vert(x, z, r, g, b, a) { const i = O.n++; O.pos[i * 3] = x; O.pos[i * 3 + 1] = Y; O.pos[i * 3 + 2] = z; O.col[i * 4] = r; O.col[i * 4 + 1] = g; O.col[i * 4 + 2] = b; O.col[i * 4 + 3] = a; }
/* Viereck aus zwei Dreiecken: Punkte in Laufrichtung (a0 b0) → (a1 b1) */
function quad(ax, az, bx, bz, cx, cz, dx, dz, r, g, b, a) { need(6); vert(ax, az, r, g, b, a); vert(bx, bz, r, g, b, a); vert(cx, cz, r, g, b, a); vert(ax, az, r, g, b, a); vert(cx, cz, r, g, b, a); vert(dx, dz, r, g, b, a); }
function rgb(color) { const c = O.tmp; if (typeof color === 'string' && color.startsWith('rgba')) { const m = color.match(/[\d.]+/g); c.setRGB(m[0] / 255, m[1] / 255, m[2] / 255, THREE.SRGBColorSpace); return [c.r, c.g, c.b, +m[3]]; } c.set(color || '#ffffff'); return [c.r, c.g, c.b, 1]; }
/* Pixeldichte an einer Stelle (Pixel je Einheit) */
function px(x, y) { const p = project(x, y); return p ? p.s : 0; }

/* Kreis oder Bogen (a0…a1, Winkel wie im Spiel: 0 = +x, im Uhrzeigersinn auf dem Bildschirm) */
export function ring(x, y, r, color, width = 1.5, opts) {
  const s = px(x, y); if (!s || !(r > 0)) return;
  const [cr, cg, cb, ca] = rgb(color), a = (opts && opts.alpha !== undefined ? opts.alpha : 1) * ca;
  const w = Math.max(0.3, width / s), a0 = opts && opts.a0 !== undefined ? opts.a0 : 0, a1 = opts && opts.a1 !== undefined ? opts.a1 : a0 + TAU;
  const rp = r * s, n = Math.max(10, Math.min(160, Math.round(rp / 4 * Math.abs(a1 - a0) / TAU * 2 + 8)));
  const dash = opts && opts.dash ? (opts.dash === true ? 6 : opts.dash) / s : 0, off = opts && opts.march ? S.time * 25 / s : 0;
  const ri = r - w / 2, ro = r + w / 2, step = (a1 - a0) / n;
  let acc = off, c0 = Math.cos(a0), s0 = Math.sin(a0);
  for (let i = 0; i < n; i++) {
    const t = a0 + (i + 1) * step, c1 = Math.cos(t), s1 = Math.sin(t), len = Math.abs(step) * r;
    const on = !dash || (Math.floor(acc / dash) % 2 === 0); acc += len;
    if (on) quad(x + c0 * ri, y + s0 * ri, x + c0 * ro, y + s0 * ro, x + c1 * ro, y + s1 * ro, x + c1 * ri, y + s1 * ri, cr, cg, cb, a);
    c0 = c1; s0 = s1;
  }
}
/* Linie von (x0, y0) nach (x1, y1) in Pixelbreite */
export function line(x0, y0, x1, y1, color, width = 1.5, opts) {
  const s = px((x0 + x1) / 2, (y0 + y1) / 2); if (!s) return;
  const [cr, cg, cb, ca] = rgb(color), a = (opts && opts.alpha !== undefined ? opts.alpha : 1) * ca;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1e-3) return;
  const w = Math.max(0.3, width / s), nx = -dy / L * w / 2, ny = dx / L * w / 2;
  const dash = opts && opts.dash ? (opts.dash === true ? 6 : opts.dash) / s : 0, off = opts && opts.march ? S.time * 30 / s : 0;
  if (!dash) { quad(x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 - nx, y1 - ny, x1 + nx, y1 + ny, cr, cg, cb, a); return; }
  const ux = dx / L, uy = dy / L; let t = -(off % (dash * 2));
  for (; t < L; t += dash * 2) { const t0 = Math.max(0, t), t1 = Math.min(L, t + dash); if (t1 <= t0) continue; const ax = x0 + ux * t0, ay = y0 + uy * t0, bx = x0 + ux * t1, by = y0 + uy * t1; quad(ax + nx, ay + ny, ax - nx, ay - ny, bx - nx, by - ny, bx + nx, by + ny, cr, cg, cb, a); }
}
/* gefüllte Scheibe */
export function disc(x, y, r, color, alpha = 0.2) {
  const s = px(x, y); if (!s || !(r > 0)) return;
  const [cr, cg, cb, ca] = rgb(color), a = alpha * ca, n = Math.max(12, Math.min(96, Math.round(r * s / 4)));
  need(n * 3);
  for (let i = 0; i < n; i++) { const t0 = i / n * TAU, t1 = (i + 1) / n * TAU; vert(x, y, cr, cg, cb, a); vert(x + Math.cos(t0) * r, y + Math.sin(t0) * r, cr, cg, cb, a); vert(x + Math.cos(t1) * r, y + Math.sin(t1) * r, cr, cg, cb, a); }
}
/* am Ende des Frames: Puffer hochladen und leeren */
export function flushOverlay() {
  if (O.mesh) O.mesh.material.uniforms.uLin.value = Q.bloom || Q.rt ? 1 : 0;
  const g = O.geo; if (!g) return;
  g.setDrawRange(0, O.n);
  if (O.n) { const p = g.attributes.position, c = g.attributes.col; p.clearUpdateRanges(); c.clearUpdateRanges(); p.addUpdateRange(0, O.n * 3); c.addUpdateRange(0, O.n * 4); p.needsUpdate = true; c.needsUpdate = true; }
  O.mesh.visible = O.n > 0;
  O.n = 0;
}
