/* =====================================================================
   Rift Armada 3D – Nebel des Krieges. Die Spielsicht liefert eine kleine 2D-Leinwand (ein Pixel je VIS = 64
   Einheiten; Alpha: 235 unbekannt, 120 erkundet, 0 sichtbar; siehe render.js fogUpdate). Sie wird als Textur auf
   eine Ebene bei Y = 40 über der Karte gelegt (deckt auch hohe Modelle ab), linear gefiltert, ohne Tiefentest und
   als letztes gezeichnet (Reihenfolge 100). Außerhalb der Karte liegt ein dunkler Rahmen (vier Platten, Deckkraft
   0,92 wie in 2D). Die Textur wird jeden Frame als geändert gemeldet (klein, kostet nichts); gibt es keine Leinwand
   (Beobachter, vp < 0), bleiben Ebene und Rahmen unsichtbar.
   ===================================================================== */
import * as THREE from 'three';
import { S, Q } from './scene.js';

const F = { group: null, plane: null, tex: null, canvas: null, border: [] };
const Y = 40, VIS = 64;

export function initFog(g) {
  disposeFog();
  const grp = new THREE.Group(); grp.name = 'fog'; grp.renderOrder = 100;
  const w = g.vw * VIS, h = g.vh * VIS;
  const geo = new THREE.PlaneGeometry(w, h); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  /* Fassung 24: Abdunkeln im Bloom-Weg (lineare Mischung) an die sRGB-Mischung angleichen, sonst wirkt der Nebel heller */
  const lin = { value: 0 }; F.lin = lin;
  const darken = m => { m.onBeforeCompile = sh => { sh.uniforms.uLin = lin; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLin;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = mix(gl_FragColor.a, 1.0 - pow(max(1.0 - gl_FragColor.a, 0.0), 2.2), uLin);'); }; m.customProgramCacheKey = () => 'fogLin'; return m; };
  darken(mat);
  F.plane = new THREE.Mesh(geo, mat); F.plane.position.set(w / 2, Y, h / 2); F.plane.renderOrder = 100; F.plane.frustumCulled = false; F.plane.visible = false;
  grp.add(F.plane);
  /* Rahmen außerhalb der Karte */
  const far = 6000, bm = darken(new THREE.MeshBasicMaterial({ color: '#020308', transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  const mw = g.map.w, mh = g.map.h;
  const slab = (x, z, sw, sh) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh).rotateX(-Math.PI / 2), bm); q.position.set(x, Y, z); q.renderOrder = 100; q.frustumCulled = false; grp.add(q); F.border.push(q); };
  slab(mw / 2, -far / 2, mw + far * 2, far); slab(mw / 2, mh + far / 2, mw + far * 2, far); slab(-far / 2, mh / 2, far, mh); slab(mw + far / 2, mh / 2, far, mh);
  F.group = grp; S.scene.add(grp);
}
export function updateFog(view) {
  if (!F.group) return;
  const cv = view && view.fog;
  const on = !!cv && view.vp >= 0;
  F.plane.visible = on; for (const b of F.border) b.visible = on; if (F.lin) F.lin.value = Q.bloom || Q.rt ? 1 : 0;
  if (!on) return;
  if (F.canvas !== cv) {
    if (F.tex) F.tex.dispose();
    F.canvas = cv; F.tex = new THREE.CanvasTexture(cv); F.tex.colorSpace = THREE.SRGBColorSpace; F.tex.minFilter = THREE.LinearFilter; F.tex.magFilter = THREE.LinearFilter; F.tex.generateMipmaps = false; F.tex.wrapS = F.tex.wrapT = THREE.ClampToEdgeWrapping;
    F.plane.material.map = F.tex; F.plane.material.needsUpdate = true;
  }
  F.tex.needsUpdate = true;
}
export function disposeFog() {
  if (!F.group) return;
  S.scene.remove(F.group); F.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (F.tex) F.tex.dispose();
  F.group = null; F.plane = null; F.tex = null; F.canvas = null; F.border.length = 0;
}
