/* =====================================================================
   Rift Armada – 3D-Effekte: GPU-Puffer. Alle Partikel und Linien liegen in wenigen instanzierten Puffern, je einer je
   Darstellungsart (ein Draw-Call je Puffer und Frame):
   - SpriteBuf   zur Kamera gedrehte Quads mit Atlas (Glühen, Feuerball, Rauch, Lichtpunkt, Stern); additiv oder deckend
   - QuadBuf     dünne Quads zwischen zwei Punkten, Breite zur Kamera gedreht (Strahlen, Geschosse, Funken, Linien)
   - RingBuf     flache Ringe am Boden (Druckwellen, Markierungen)
   - ChunkBuf    kleine beleuchtete Körper über instanceMatrix (Trümmer, Massegeschosse, Torpedokörper)
   - DomeBuf     Halbkugeln mit Fresnel und Trefferfleck (Schildtreffer)
   - DiscBuf     Bodenscheiben mit Mustern je Modus (Sporenteppich, Riss, Eruption, Wirbel, Brutsturm)
   Jeder Puffer wird je Frame neu gefüllt: begin() → write…() → flush(). Koordinaten sind Three-Welt (x, Höhe, z).
   Bildschirmmaß: alle Größen sind Welteinheiten, gehen also mit Zoom und Render-Skalierung mit. Damit bei kleiner
   Render-Auflösung (Skalierung 0,6) nichts flimmert, klammern die Shader Breiten/Größen unter einer Mindestpixelzahl
   (SCREEN.uMinPx, in Pixeln des Render-Ziels) und senken dafür die Deckkraft (gleiche Lichtmenge, kein Unterpixel-Flackern).
   Die Höhe des Render-Ziels liest onBeforeRender selbst (Composer-Ziel oder Zeichenpuffer).
   ===================================================================== */
let T = null;
export function useThree(three) { T = three; }

/* ------------------------------------------------------------ Atlas (8 Kacheln à 128 px, weiße Form + Alpha) */
export const TILE = { glow: 0, fire: 1, smoke: 2, dot: 3, star: 4, puff: 5, ember: 6, blank: 7 };
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
export function makeAtlas() {
  const N = 8, S = 128, c = document.createElement('canvas'); c.width = S * N; c.height = S;
  const x = c.getContext('2d');
  const rad = (cx, cy, r, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); for (const [k, a] of stops) g.addColorStop(k, 'rgba(255,255,255,' + a + ')'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  const tile = (i, fn) => { x.save(); x.beginPath(); x.rect(i * S, 0, S, S); x.clip(); fn(i * S + S / 2, S / 2); x.restore(); };
  /* weiches Glühen */
  tile(TILE.glow, (cx, cy) => rad(cx, cy, 62, [[0, 1], [0.25, 0.55], [0.6, 0.12], [1, 0]]));
  /* Feuerball: Kern mit unregelmäßigen Lappen, damit Explosionen Form haben */
  tile(TILE.fire, (cx, cy) => { const r = seeded(77); x.globalCompositeOperation = 'lighter'; rad(cx, cy, 30, [[0, 0.9], [0.6, 0.5], [1, 0]]); for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = 10 + r() * 28, rr = 14 + r() * 18; rad(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, [[0, 0.8], [0.55, 0.45], [0.85, 0.1], [1, 0]]); } x.globalCompositeOperation = 'source-over'; });
  /* Rauch: weiche, lappige Wolke */
  tile(TILE.smoke, (cx, cy) => { const r = seeded(913); rad(cx, cy, 44, [[0, 0.5], [0.7, 0.2], [1, 0]]); for (let i = 0; i < 11; i++) { const a = r() * 6.283, d = 8 + r() * 26, rr = 22 + r() * 18; rad(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, [[0, 0.4], [0.6, 0.15], [1, 0]]); } });
  /* harter Lichtpunkt mit kleinem Hof */
  tile(TILE.dot, (cx, cy) => rad(cx, cy, 60, [[0, 1], [0.22, 1], [0.34, 0.45], [0.6, 0.1], [1, 0]]));
  /* Stern/Glint: vier Strahlen und Kern */
  tile(TILE.star, (cx, cy) => { x.globalCompositeOperation = 'lighter'; for (let k = 0; k < 2; k++) { x.save(); x.translate(cx, cy); x.rotate(k * Math.PI / 2); const g = x.createLinearGradient(-62, 0, 62, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(-62, 0); x.lineTo(0, -4); x.lineTo(62, 0); x.lineTo(0, 4); x.closePath(); x.fill(); x.restore(); } rad(cx, cy, 30, [[0, 1], [0.3, 0.5], [1, 0]]); x.globalCompositeOperation = 'source-over'; });
  /* kleine runde Wolke (Druckwelle am Boden, Nachglühen) */
  tile(TILE.puff, (cx, cy) => { const r = seeded(41); rad(cx, cy, 50, [[0, 0.8], [0.6, 0.35], [1, 0]]); for (let i = 0; i < 6; i++) { const a = r() * 6.283, d = 18 + r() * 18, rr = 16 + r() * 14; rad(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, [[0, 0.5], [1, 0]]); } });
  /* Glutkorn (Sporen, Funkenstaub) */
  tile(TILE.ember, (cx, cy) => rad(cx, cy, 50, [[0, 1], [0.12, 0.9], [0.3, 0.3], [1, 0]]));
  const t = new T.CanvasTexture(c); t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------ gemeinsames */
/* gemeinsame Bildschirm-Uniforms aller Effekt-Shader */
export const SCREEN = { uViewH: { value: 720 }, uMinPx: { value: 1.25 } };
let vsz = null;
/* Höhe des aktuellen Render-Ziels in Pixeln (Composer-Puffer bzw. Zeichenpuffer) vor dem Zeichnen übernehmen */
function trackViewport(obj) {
  obj.onBeforeRender = (renderer) => {
    const rt = renderer.getRenderTarget();
    if (rt) SCREEN.uViewH.value = rt.height;
    else { if (!vsz) vsz = new T.Vector2(); renderer.getDrawingBufferSize(vsz); SCREEN.uViewH.value = vsz.y; }
  };
}
function dyn(arr, size) { const a = new T.InstancedBufferAttribute(arr, size); a.setUsage(T.DynamicDrawUsage); return a; }
function upload(attr, n, size) { attr.clearUpdateRanges(); attr.addUpdateRange(0, n * size); attr.needsUpdate = true; }
function planeGeo() {
  const g = new T.InstancedBufferGeometry(), p = new T.PlaneGeometry(1, 1);
  g.setAttribute('position', p.attributes.position); g.setAttribute('uv', p.attributes.uv); g.setIndex(p.index);
  return g;
}
function mesh(geo, mat, order) { const m = new T.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = order; m.matrixAutoUpdate = false; trackViewport(m); return m; }

/* ------------------------------------------------------------ Sprites */
const SPR_VERT = `
attribute vec3 iPos; attribute vec4 iCol; attribute vec4 iPar;
uniform float uTiles; uniform float uViewH; uniform float uMinPx;
varying vec2 vUv; varying vec4 vCol; varying float vOcc;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  /* Pixel je Welteinheit an dieser Tiefe; der sichtbare Kern eines Sprites ist etwa die halbe Kachel */
  float ppu = projectionMatrix[1][1] * 0.5 * uViewH / max(0.001, -mv.z);
  float px = iPar.x * ppu * 0.5, k = clamp(px / (uMinPx * 1.6), 0.02, 1.0);
  float size = iPar.x / k;
  float c = cos(iPar.y), s = sin(iPar.y);
  mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * size;
  gl_Position = projectionMatrix * mv;
  vUv = vec2((uv.x + iPar.z) / uTiles, uv.y); vCol = vec4(iCol.rgb, iCol.a * k * k); vOcc = iPar.w;
}`;
/* mode: 'add' additiv (Glühen), 'normal' deckend (Rauch), 'premul' vormultipliert: occ 0 = additiv, 1 = deckend (Feuer, das abkühlt) */
const SPR_FRAG = `
uniform sampler2D uMap; uniform float uPremul; varying vec2 vUv; varying vec4 vCol; varying float vOcc;
void main() {
  vec4 t = texture2D(uMap, vUv); float a = t.a * vCol.a;
  if (uPremul > 0.5) gl_FragColor = vec4(vCol.rgb * t.r * a, a * vOcc);
  else gl_FragColor = vec4(vCol.rgb * t.r, a);
  if (a < 0.003) discard;
}`;
export class SpriteBuf {
  constructor(cap, atlas, mode, order) {
    this.cap = cap; this.n = 0;
    if (mode === true) mode = 'add'; else if (mode === false) mode = 'normal';
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.par = new Float32Array(cap * 4);
    const g = planeGeo();
    g.setAttribute('iPos', this.aPos = dyn(this.pos, 3)); g.setAttribute('iCol', this.aCol = dyn(this.col, 4)); g.setAttribute('iPar', this.aPar = dyn(this.par, 4));
    const mat = new T.ShaderMaterial({ uniforms: { uMap: { value: atlas }, uTiles: { value: 8 }, uPremul: { value: mode === 'premul' ? 1 : 0 }, uViewH: SCREEN.uViewH, uMinPx: SCREEN.uMinPx }, vertexShader: SPR_VERT, fragmentShader: SPR_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: mode === 'add' ? T.AdditiveBlending : mode === 'premul' ? T.CustomBlending : T.NormalBlending });
    if (mode === 'premul') { mat.blendEquation = T.AddEquation; mat.blendSrc = T.OneFactor; mat.blendDst = T.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = T.OneFactor; mat.blendDstAlpha = T.OneMinusSrcAlphaFactor; }
    this.mesh = mesh(g, mat, order); this.geo = g;
  }
  begin() { this.n = 0; }
  /* x, h, z Welt; size Kantenlänge; rot rad; tile Atlas-Kachel; r g b linear; a Deckkraft; occ Deckung (nur 'premul') */
  write(x, h, z, size, rot, tile, r, g, b, a, occ = 0) {
    if (this.n >= this.cap || a <= 0.002 || size <= 0.01) return;
    const i = this.n++, p = i * 3, q = i * 4, c = i * 4;
    this.pos[p] = x; this.pos[p + 1] = h; this.pos[p + 2] = z;
    this.par[q] = size; this.par[q + 1] = rot; this.par[q + 2] = tile; this.par[q + 3] = occ;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a;
  }
  flush() { const n = this.n; this.geo.instanceCount = n; this.mesh.visible = n > 0; if (n) { upload(this.aPos, n, 3); upload(this.aCol, n, 4); upload(this.aPar, n, 4); } }
}

/* ------------------------------------------------------------ Quads zwischen zwei Punkten (Strahlen, Funken, Linien) */
const QUAD_VERT = `
attribute vec3 iA; attribute vec3 iB; attribute vec4 iCol; attribute vec2 iW;
uniform float uViewH; uniform float uMinPx;
varying vec2 vUv; varying vec4 vCol; varying float vMode;
void main() {
  float k = position.x + 0.5;
  vec3 p = mix(iA, iB, k);
  vec3 d = iB - iA; float L = length(d); d = L > 0.0001 ? d / L : vec3(1.0, 0.0, 0.0);
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = cross(d, toCam); float sl = length(side); side = sl > 0.0001 ? side / sl : vec3(0.0, 1.0, 0.0);
  vec4 cp = projectionMatrix * viewMatrix * vec4(p, 1.0);
  float ppu = projectionMatrix[1][1] * 0.5 * uViewH / max(0.001, cp.w);
  float kw = clamp(iW.x * ppu / uMinPx, 0.02, 1.0);
  p += side * position.y * iW.x / kw;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vUv = uv; vCol = vec4(iCol.rgb, iCol.a * kw); vMode = iW.y;
}`;
const QUAD_FRAG = `
varying vec2 vUv; varying vec4 vCol; varying float vMode;
void main() {
  float c = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = c * c * (3.0 - 2.0 * c); a *= a;
  float along = 1.0;
  if (vMode > 0.5 && vMode < 1.5) along = vUv.x * vUv.x;          /* Schweif: A verblasst, B hell */
  else if (vMode > 1.5 && vMode < 2.5) along = sin(vUv.x * 3.14159); /* beide Enden weich */
  else if (vMode > 2.5) along = 0.6 + 0.4 * vUv.x;                  /* leichter Verlauf */
  gl_FragColor = vec4(vCol.rgb, vCol.a * a * along);
  if (gl_FragColor.a < 0.003) discard;
}`;
export const QMODE = { flat: 0, tail: 1, soft: 2, grad: 3 };
export class QuadBuf {
  constructor(cap, order) {
    this.cap = cap; this.n = 0;
    this.a = new Float32Array(cap * 3); this.b = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.w = new Float32Array(cap * 2);
    const g = planeGeo();
    g.setAttribute('iA', this.aA = dyn(this.a, 3)); g.setAttribute('iB', this.aB = dyn(this.b, 3)); g.setAttribute('iCol', this.aCol = dyn(this.col, 4)); g.setAttribute('iW', this.aW = dyn(this.w, 2));
    const mat = new T.ShaderMaterial({ uniforms: { uViewH: SCREEN.uViewH, uMinPx: SCREEN.uMinPx }, vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide });
    this.mesh = mesh(g, mat, order); this.geo = g;
  }
  begin() { this.n = 0; }
  write(ax, ah, az, bx, bh, bz, w, mode, r, g, b, a) {
    if (this.n >= this.cap || a <= 0.002) return;
    const i = this.n++, p = i * 3, c = i * 4, q = i * 2;
    this.a[p] = ax; this.a[p + 1] = ah; this.a[p + 2] = az; this.b[p] = bx; this.b[p + 1] = bh; this.b[p + 2] = bz;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a; this.w[q] = w; this.w[q + 1] = mode;
  }
  flush() { const n = this.n; this.geo.instanceCount = n; this.mesh.visible = n > 0; if (n) { upload(this.aA, n, 3); upload(this.aB, n, 3); upload(this.aCol, n, 4); upload(this.aW, n, 2); } }
}

/* ------------------------------------------------------------ Ringe am Boden */
const RING_VERT = `
attribute vec2 ak; attribute vec3 iC; attribute vec2 iR; attribute vec4 iCol;
uniform float uViewH; uniform float uMinPx;
varying float vK; varying vec4 vCol;
void main() {
  vec3 dir = vec3(cos(ak.x), 0.0, sin(ak.x));
  vec4 cm = projectionMatrix * viewMatrix * vec4(iC + dir * iR.x, 1.0);
  float ppu = projectionMatrix[1][1] * 0.5 * uViewH / max(0.001, cm.w);
  float k = clamp(iR.y * ppu / (uMinPx * 1.4), 0.02, 1.0);
  float rr = iR.x + (ak.y - 0.5) * iR.y / k;
  gl_Position = projectionMatrix * viewMatrix * vec4(iC + dir * rr, 1.0);
  vK = ak.y; vCol = vec4(iCol.rgb, iCol.a * k);
}`;
const RING_FRAG = `
varying float vK; varying vec4 vCol;
void main() { float c = 1.0 - abs(vK * 2.0 - 1.0); c = c * c * (3.0 - 2.0 * c); gl_FragColor = vec4(vCol.rgb, vCol.a * c); if (gl_FragColor.a < 0.003) discard; }`;
export class RingBuf {
  constructor(cap, order) {
    this.cap = cap; this.n = 0;
    const SEG = 72, ak = [], idx = [];
    for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2; ak.push(a, 0, a, 1); if (i < SEG) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    g.setAttribute('ak', new T.Float32BufferAttribute(ak, 2)); g.setIndex(idx);
    this.c = new Float32Array(cap * 3); this.r = new Float32Array(cap * 2); this.col = new Float32Array(cap * 4);
    g.setAttribute('iC', this.aC = dyn(this.c, 3)); g.setAttribute('iR', this.aR = dyn(this.r, 2)); g.setAttribute('iCol', this.aCol = dyn(this.col, 4));
    const mat = new T.ShaderMaterial({ uniforms: { uViewH: SCREEN.uViewH, uMinPx: SCREEN.uMinPx }, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.DoubleSide });
    this.mesh = mesh(g, mat, order); this.geo = g;
  }
  begin() { this.n = 0; }
  write(x, h, z, radius, width, r, g, b, a) {
    if (this.n >= this.cap || a <= 0.002) return;
    const i = this.n++, p = i * 3, c = i * 4, q = i * 2;
    this.c[p] = x; this.c[p + 1] = h; this.c[p + 2] = z; this.r[q] = radius; this.r[q + 1] = width;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a;
  }
  flush() { const n = this.n; this.geo.instanceCount = n; this.mesh.visible = n > 0; if (n) { upload(this.aC, n, 3); upload(this.aR, n, 2); upload(this.aCol, n, 4); } }
}

/* ------------------------------------------------------------ beleuchtete Körper (Trümmer, Masse, Torpedos) */
const CHUNK_VERT = `
attribute float iGlow; attribute vec3 iCol;
varying vec3 vN; varying float vGlow; varying vec3 vCol;
void main() {
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(instanceMatrix) * normal); vGlow = iGlow; vCol = iCol;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CHUNK_FRAG = `
uniform vec3 uLight; varying vec3 vN; varying float vGlow; varying vec3 vCol;
void main() {
  vec3 n = normalize(vN);
  float l = 0.22 + 0.78 * max(0.0, dot(n, uLight)) + 0.15 * max(0.0, dot(n, vec3(0.0, 1.0, 0.0)));
  vec3 glow = vec3(1.7, 0.75, 0.2) * vGlow;
  gl_FragColor = vec4(vCol * l + glow, 1.0);
}`;
/* unregelmäßiger Brocken: Dodekaeder mit verschobenen Ecken */
function chunkGeo(seed, flat) {
  const r = seeded(seed), g = new T.DodecahedronGeometry(1, 0), p = g.attributes.position;
  const sx = 1 + r() * 0.8, sy = flat ? 0.45 + r() * 0.3 : 0.7 + r() * 0.6, sz = 1.2 + r() * 0.9;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * sx * (0.85 + r() * 0.3), p.getY(i) * sy * (0.85 + r() * 0.3), p.getZ(i) * sz * (0.85 + r() * 0.3));
  g.computeVertexNormals(); return g;
}
export class ChunkBuf {
  constructor(cap, kind, order) {
    this.cap = cap; this.n = 0;
    const geo = kind === 'capsule' ? new T.CapsuleGeometry(1, 3.2, 3, 8).rotateX(Math.PI / 2) : chunkGeo(kind === 'rock' ? 5 : 3, kind === 'debris');
    this.glow = new Float32Array(cap); this.col = new Float32Array(cap * 3);
    geo.setAttribute('iGlow', this.aGlow = dyn(this.glow, 1)); geo.setAttribute('iCol', this.aCol = dyn(this.col, 3));
    const mat = new T.ShaderMaterial({ uniforms: { uLight: { value: new T.Vector3(0.5, 0.75, 0.4).normalize() } }, vertexShader: CHUNK_VERT, fragmentShader: CHUNK_FRAG });
    this.mesh = new T.InstancedMesh(geo, mat, cap); trackViewport(this.mesh); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.M = new T.Matrix4(); this.P = new T.Vector3(); this.Q = new T.Quaternion(); this.E = new T.Euler(); this.S = new T.Vector3();
  }
  begin() { this.n = 0; }
  write(x, h, z, rx, ry, rz, sx, sy, sz, glow, r, g, b) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.E.set(rx, ry, rz); this.Q.setFromEuler(this.E); this.P.set(x, h, z); this.S.set(sx, sy, sz);
    this.M.compose(this.P, this.Q, this.S); this.mesh.setMatrixAt(i, this.M);
    this.glow[i] = glow; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  flush() { const n = this.n; this.mesh.count = n; this.mesh.visible = n > 0; if (n) { this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, n * 16); this.mesh.instanceMatrix.needsUpdate = true; upload(this.aGlow, n, 1); upload(this.aCol, n, 3); } }
}

/* ------------------------------------------------------------ Schildkuppeln */
const DOME_VERT = `
attribute vec3 iHit; attribute vec4 iCol;
varying vec3 vN; varying vec3 vP; varying vec3 vHit; varying vec4 vCol;
void main() {
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(instanceMatrix) * normal); vP = wp.xyz; vHit = iHit; vCol = iCol;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const DOME_FRAG = `
uniform float uRip;
varying vec3 vN; varying vec3 vP; varying vec3 vHit; varying vec4 vCol;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vP);
  float fres = pow(1.0 - max(0.0, dot(n, v)), 2.5);
  /* Fassung 24: vHit.y = Alter 0…1 des Treffers; uRip = 1 (Ultra): Welle läuft vom Treffpunkt über die Kuppel */
  vec3 hd = normalize(vec3(vHit.x, 0.2, vHit.z)); float age = vHit.y, cd = dot(n, hd);
  float spot = pow(max(0.0, cd), 16.0);
  float ad = acos(clamp(cd, -1.0, 1.0)), front = age * 2.6;
  float r1 = (ad - front) * 6.0, r2 = (ad - front * 0.6) * 8.0;
  float rip = uRip * (exp(-r1 * r1) + 0.45 * exp(-r2 * r2)) * (1.0 - age);
  float az = atan(n.z, n.x), el = asin(clamp(n.y, -1.0, 1.0));
  float grid = smoothstep(0.86, 1.0, max(abs(sin(az * 9.0)), abs(sin(el * 9.0)))) * 0.22 * (0.3 + spot + rip * 3.0);
  float a = (fres * 0.4 + spot * 0.9 * (1.0 - uRip * 0.35) + grid + rip * 0.8 + 0.04) * vCol.a;
  vec3 c = vCol.rgb * (0.75 + 0.35 * spot + 0.2 * fres + 0.5 * rip);
  /* Deckel: Beitrag je Kanal ≤ 0,55 (additiv über hellen Rümpfen/Wracks bleibt er unter der Bloom-Schwelle 1,25) */
  float m = max(max(c.r, c.g), c.b) * a; if (m > 0.55) a *= 0.55 / m;
  gl_FragColor = vec4(c, a);
  if (gl_FragColor.a < 0.003) discard;
}`;
export class DomeBuf {
  constructor(cap, order) {
    this.cap = cap; this.n = 0;
    const geo = new T.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    this.hit = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4);
    geo.setAttribute('iHit', this.aHit = dyn(this.hit, 3)); geo.setAttribute('iCol', this.aCol = dyn(this.col, 4));
    const mat = new T.ShaderMaterial({ uniforms: { uRip: { value: 0 } }, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, side: T.FrontSide });
    this.mesh = new T.InstancedMesh(geo, mat, cap); trackViewport(this.mesh); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.M = new T.Matrix4(); this.P = new T.Vector3(); this.Q = new T.Quaternion(); this.S = new T.Vector3();
  }
  begin() { this.n = 0; }
  write(x, h, z, r, hx, hy, hz, cr, cg, cb, a) {
    if (this.n >= this.cap || a <= 0.002) return;
    const i = this.n++;
    this.P.set(x, h, z); this.S.set(r, r * 0.78, r); this.M.compose(this.P, this.Q, this.S); this.mesh.setMatrixAt(i, this.M);
    this.hit[i * 3] = hx; this.hit[i * 3 + 1] = hy; this.hit[i * 3 + 2] = hz;
    this.col[i * 4] = cr; this.col[i * 4 + 1] = cg; this.col[i * 4 + 2] = cb; this.col[i * 4 + 3] = a;
  }
  flush() { const n = this.n; this.mesh.count = n; this.mesh.visible = n > 0; if (n) { this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, n * 16); this.mesh.instanceMatrix.needsUpdate = true; upload(this.aHit, n, 3); upload(this.aCol, n, 4); } }
}

/* ------------------------------------------------------------ Bodenscheiben mit Mustern */
export const DMODE = { spores: 0, rift: 1, flare: 2, vortex: 3, storm: 4, glow: 5 };
const DISC_VERT = `
attribute float iMode; attribute vec4 iCol; attribute vec2 iPar;
varying vec2 vUv; varying float vMode; varying vec4 vCol; varying vec2 vPar;
void main() {
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vUv = uv * 2.0 - 1.0; vMode = iMode; vCol = iCol; vPar = iPar;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const DISC_FRAG = `
uniform float uTime;
varying vec2 vUv; varying float vMode; varying vec4 vCol; varying vec2 vPar;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = vUv; float d = length(q); float ang = atan(q.y, q.x); float t = uTime; float ph = vPar.y; float k = vPar.x;
  vec3 col = vCol.rgb; float a = 0.0;
  int m = int(vMode + 0.5);
  if (m == 0) {
    /* Sporenteppich: weiche grüne Scheibe mit treibenden Flecken und ausgefranstem Rand (k = Restzeit 0…1) */
    float e = d * 1.22 + 0.07 * sin(ang * 7.0 + t * 0.6 + ph) + 0.05 * sin(ang * 13.0 - t * 0.4 + ph * 3.0);
    float n = noise(q * 4.0 + vec2(t * 0.08, -t * 0.05) + ph) * 0.6 + noise(q * 9.0 - vec2(t * 0.05, t * 0.07)) * 0.4;
    a = (1.0 - smoothstep(0.5, 1.0, e)) * (0.25 + 0.75 * n * n) * 0.28 * k;
    col = mix(vec3(0.3, 0.7, 0.1), vec3(0.75, 1.0, 0.3), n);
  } else if (m == 1) {
    /* Riss: längliche Wunde – dunkler Spalt, grün glühende Ränder, violetter Hof. k = 0,8 ruhig, 1,6 Welle */
    float kk = min(k, 1.3);
    float wob = (0.1 + 0.2 * sin(acos(clamp(abs(q.x) * 1.3, 0.0, 1.0)))) * (1.0 + 0.18 * sin(t * 3.0 + q.x * 5.0 + ph));
    float lenf = 1.0 - smoothstep(0.74, 0.78, abs(q.x));
    float slit = (1.0 - smoothstep(wob * 0.85, wob, abs(q.y))) * lenf;
    float rim = (1.0 - smoothstep(0.0, 0.035, abs(abs(q.y) - wob))) * lenf * (0.55 + 0.45 * abs(sin(t * 3.0 + ph)));
    float core = (1.0 - smoothstep(0.0, wob * 0.5, abs(q.y))) * lenf * (0.25 + 0.2 * sin(t * 5.0 + q.x * 8.0)) * smoothstep(0.78, 0.4, abs(q.x));
    float halo = (1.0 - smoothstep(0.05, 1.0, d)) * 0.16 * min(k, 1.1);
    vec3 green = vec3(0.4, 0.95, 0.18) * min(kk, 1.0);
    col = mix(vec3(0.3, 0.1, 0.45), vec3(0.04, 0.015, 0.07), slit);
    col += green * rim * 0.7 + green * core * 0.45;
    a = max(halo, slit * 0.96); a = max(a, rim * 0.95);
  } else if (m == 2) {
    /* Eruption: brennende Scheibe – gelbweißer Kern, orange, dunkelroter Saum, flackernder Rand. k = Restdauer 0…1 */
    float e = d * 1.2 + 0.035 * sin(ang * 9.0 + t * 7.0 + ph) + 0.03 * sin(ang * 17.0 - t * 11.0 + ph) + 0.1 * noise(q * 6.0 + t * 0.9) + 0.05 * noise(q * 14.0 - t * 1.3);
    float fl = 0.92 + 0.08 * sin(t * 23.0 + ph) + 0.04 * sin(t * 41.0);
    vec3 c = mix(vec3(1.55, 1.35, 0.85), vec3(1.15, 0.42, 0.08), smoothstep(0.05, 0.45, e));
    c = mix(c, vec3(0.42, 0.06, 0.01), smoothstep(0.45, 0.85, e));
    c *= 0.6 + 0.8 * noise(q * 5.0 - t * 0.6 + ph);
    col = c * fl; a = (1.0 - smoothstep(0.75, 1.0, e)) * (0.55 + 0.45 * k) * 0.85;
  } else if (m == 3) {
    /* Wirbel (Exodus): blau-weiße Spirale, dreht sich */
    float sp = sin(ang * 3.0 - 7.0 * log(d + 0.06) + t * 6.0 + ph);
    float band = smoothstep(0.3, 0.95, sp);
    float rad = (1.0 - smoothstep(0.5, 1.0, d)) * (0.3 + 0.7 * (1.0 - d));
    col = mix(vec3(0.35, 0.7, 1.0), vec3(1.1, 1.25, 1.4), smoothstep(0.5, 0.0, d));
    a = (band * rad * 0.65 + (1.0 - smoothstep(0.0, 0.16, d)) * 0.8) * k;
  } else if (m == 4) {
    /* Brutsturm: grün-violetter Ausbruch mit laufenden Speichen */
    float spokes = 0.5 + 0.5 * sin(ang * 6.0 + t * 4.0 + ph - d * 6.0);
    float n = noise(q * 5.0 + t * 0.4);
    col = mix(vec3(0.7, 1.0, 0.25), vec3(0.5, 0.2, 0.7), smoothstep(0.2, 0.9, d + 0.2 * n));
    a = (1.0 - smoothstep(0.3, 1.0, d)) * (0.3 + 0.7 * spokes) * k * 0.6;
  } else {
    /* weiches Leuchten am Boden */
    a = (1.0 - smoothstep(0.0, 1.0, d)) * k;
  }
  gl_FragColor = vec4(col, a * vCol.a);
  if (gl_FragColor.a < 0.003) discard;
}`;
export class DiscBuf {
  constructor(cap, order) {
    this.cap = cap; this.n = 0;
    const geo = new T.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
    this.mode = new Float32Array(cap); this.col = new Float32Array(cap * 4); this.par = new Float32Array(cap * 2);
    geo.setAttribute('iMode', this.aMode = dyn(this.mode, 1)); geo.setAttribute('iCol', this.aCol = dyn(this.col, 4)); geo.setAttribute('iPar', this.aPar = dyn(this.par, 2));
    this.mat = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.NormalBlending, side: T.DoubleSide });
    this.mesh = new T.InstancedMesh(geo, this.mat, cap); trackViewport(this.mesh); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.M = new T.Matrix4(); this.P = new T.Vector3(); this.Q = new T.Quaternion(); this.E = new T.Euler(); this.S = new T.Vector3();
  }
  begin(time) { this.n = 0; this.mat.uniforms.uTime.value = time; }
  /* x, h, z Mitte; rx, rz Halbachsen; rot Drehung um Y; mode DMODE; k Stärke 0…1 (Bedeutung je Modus); ph Phase */
  write(x, h, z, rx, rz, rot, mode, k, ph, r, g, b, a) {
    if (this.n >= this.cap || a <= 0.002) return;
    const i = this.n++;
    this.E.set(0, rot, 0); this.Q.setFromEuler(this.E); this.P.set(x, h, z); this.S.set(rx, 1, rz);
    this.M.compose(this.P, this.Q, this.S); this.mesh.setMatrixAt(i, this.M);
    this.mode[i] = mode; this.par[i * 2] = k; this.par[i * 2 + 1] = ph;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  }
  flush() { const n = this.n; this.mesh.count = n; this.mesh.visible = n > 0; if (n) { this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, n * 16); this.mesh.instanceMatrix.needsUpdate = true; upload(this.aMode, n, 1); upload(this.aCol, n, 4); upload(this.aPar, n, 2); } }
}
