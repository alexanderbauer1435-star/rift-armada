/* =====================================================================
   THE BROOD – Nester (Stationen). Formensprache wie die Schiffe: nasses, geädertes Fleisch unter glänzendem violettem
   Chitin, Knochenstacheln, Trauben säuregrüner Augen, leuchtende Blasen; nichts aus Metall, alles atmet.
   Jedes Nest wächst aus einer gemeinsamen Nesthaut (flache Fleischlinse mit Lappenrand und erhabenen Adern), darauf
   steht EIN großes Organ, dessen Umriss die Aufgabe verrät – von oben auf einen Blick unterscheidbar:
     Schwarmherz  rotes Herz mit Herzkammern, Kranzadern und Aderbögen, die in die Haut tauchen, Tentakelkranz
     Brutgrube    lange, offene Fruchtschote mit aufgeklappten Hälften, Fruchtwasser, Nabelschnüre zum Schiff, Eier
     Verdauung    durchscheinende Magensäcke voller Erzbrocken, Schlundtrichter mit Zähnen (je Grazer einer), Darmschlingen
     Brutkammer   Traube praller grüner Nährblasen um ein helles Kernorgan, Speiseadern
     Cortex       Gehirn mit Windungen und Furchen, Kleinhirn, Nervenstränge, Augenstiele
     Säurekrater  Chitinvulkan mit Säuresee, aus dem ein Spuckerkopf ragt
     Pheromon     hoher Stiel mit Fühlerfedern (wie ein Nachtfalter) und rosa Duftknollen, die langsam glimmen
     Sporennest   blasse Boviste mit Poren und Scheitelöffnung, darüber eine kreisende Sporenwolke
     Brutsturm    Mutterleib im Knochenkorb, umringt von Eiern, die mit der Ladung nacheinander aufleuchten
     Membranwall  zwei Knochenhauer als Torbogen mit Flughaut, Emitterblase am Scheitel
     Sinnesknospe riesiges Auge unter Chitinhaube auf geringeltem Stiel, Hörsegel am Fuß
   Die Nesthaut bekommt je Rolle eigene Lappen (o.petal): Kleeblatt beim Pheromonknoten, Blüte bei der Brutkammer,
   Dreilappen bei der Verdauung, Oval beim Cortex, schmal und länglich beim Membranwall.
   Teamfarbe: Leuchtadern in der Nesthaut, Kranzadern, Nervenknoten, Duftkerne, Fühlerspitzen. Säuregrün bleibt die
   Grundfarbe (Augen, Säure, Nährsaft). Mitte im Ursprung, oben +Y, Grundfläche im Kreis d.r.
   ===================================================================== */
import * as THREE from 'three';
import { registerB, mesh, rng } from '../kit.js';
import { X, Geo, Bag, place, T, addColor, sphG, coneG, domeG, tubeC, sweep, horn, pulseG, sacAt, eye, spike, fang, maw, tentacle, membrane, spitTube, vent, veinCanvas, ctex, tintC, I0 } from '../factions/brood.js';

const TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z), lerp = (a, b, t) => a + (b - a) * t;
const cl = t => Math.min(1, Math.max(0, t)), sm = (a, b, t) => { t = cl((t - a) / (b - a)); return t * t * (3 - 2 * t); };
const MIR = new THREE.Matrix4().makeScale(-1, 1, 1);

/* ------------------------------------------------------------ Zusatzmaterialien der Nester (je Materialsatz einmal) */
const XS = new WeakMap();
function XB(M) {
  let s = XS.get(M); if (s) return s;
  const x = X(M), team = M.trim.emissive.clone(), tc = `${team.r * 255 | 0},${team.g * 255 | 0},${team.b * 255 | 0}`, oc = M.flesh.bumpMap.image, bump = M.flesh.bumpMap;
  const skinV = ctex(veinCanvas(43, 8, 5.5, '#14040f', tc, 6), true);
  const fineV = ctex(veinCanvas(47, 16, 1.7, '#000', tc), true);
  const redV = ctex(veinCanvas(53, 14, 2.6, '#000', '120,10,40'), true);
  const sacT = ctex(veinCanvas(5, 16, 3.6, '#d4d4d4', '30,30,30'), true);
  const swirl = ctex(veinCanvas(61, 22, 5, '#9a9a9a', '255,255,255'), true);
  const std = o => new THREE.MeshStandardMaterial(Object.assign({ bumpMap: bump, bumpScale: 1, metalness: 0.04, vertexColors: true }, o));
  s = {
    /* Nesthaut: dunkles Violett, Adern in Teamfarbe */
    skin: std({ map: ctex(tintC(oc, '#55305f', 1.2), true), roughness: 0.4, emissive: '#ffffff', emissiveMap: skinV, emissiveIntensity: 0.42 }),
    /* Herzmuskel: tiefrot, nass glänzend */
    heart: std({ map: ctex(tintC(oc, '#b8304c', 1.0), true), roughness: 0.2, emissive: '#ffffff', emissiveMap: redV, emissiveIntensity: 0.5 }),
    /* venöse Gefäße: blauviolett */
    vein: std({ map: ctex(tintC(oc, '#5c3488', 1.05), true), roughness: 0.22, emissive: '#16062a', emissiveIntensity: 1 }),
    /* Hirnrinde: blassrosa, feine Teamadern */
    brain: std({ map: ctex(tintC(oc, '#dc98b0', 0.8), true), roughness: 0.3, bumpScale: 0.7, emissive: '#ffffff', emissiveMap: fineV, emissiveIntensity: 0.35 }),
    /* Pilzhaut der Boviste: blass, trocken */
    fungus: std({ map: ctex(tintC(oc, '#d6c6cc', 0.65), true), roughness: 0.78, bumpScale: 1.8 }),
    /* Eischale: lederig, hell */
    shell: std({ map: ctex(tintC(oc, '#d8cca6', 0.7), true), roughness: 0.32, emissive: '#1c260a', emissiveIntensity: 1 }),
    /* Säuresee, Fruchtwasser, Pfützen: spiegelnd, mäßig leuchtend */
    pool: new THREE.MeshStandardMaterial({ color: '#2f7a14', roughness: 0.05, metalness: 0.3, emissive: '#62e82a', emissiveMap: swirl, emissiveIntensity: 0.75, vertexColors: true }),
    amnion: new THREE.MeshStandardMaterial({ color: '#7a3a70', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.72, depthWrite: false, emissive: '#c05aa0', emissiveMap: swirl, emissiveIntensity: 0.45 }),
    /* Nährblasen, Duftknollen, leuchtende Eier – gedämpfter als die Schiffsblasen, damit Trauben nicht überstrahlen */
    nutr: (() => { const m = x.sac.clone(); m.emissiveIntensity = 0.78; m.opacity = 0.93; return m; })(),
    pink: (() => { const m = x.sacPink.clone(); m.emissiveIntensity = 0.55; m.opacity = 0.8; m.depthWrite = false; return m; })(),
    lit: new THREE.MeshStandardMaterial({ color: '#8cf050', roughness: 0.2, metalness: 0, emissive: '#a6ff4a', emissiveMap: sacT, emissiveIntensity: 0.6 }),
    /* Magenwand: durchscheinend rosaviolett */
    stomach: new THREE.MeshStandardMaterial({ color: '#c06aa8', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, emissive: '#ffffff', emissiveMap: fineV, emissiveIntensity: 0.35 }),
    /* Mutterleib: durchscheinend, Adern */
    womb: (() => { const m = x.womb.clone(); m.opacity = 0.5; m.emissiveIntensity = 0.7; return m; })(),
    nerve: std({ map: ctex(tintC(oc, '#e6d2b4', 0.6), true), roughness: 0.3, bumpScale: 0.5, emissive: '#2a1a10', emissiveIntensity: 1 }),
    team: x.glow, acid: M.acid,
    teamSoft: new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(1.15) }),
    spore: new THREE.MeshBasicMaterial({ color: new THREE.Color('#d8ff8a').multiplyScalar(1.35) })
  };
  XS.set(M, s); return s;
}

/* ------------------------------------------------------------ Rauschen und Geometrie */
/* Gradientenrauschen (Perlin) in 3D, Werte etwa −1…1. Nulllinien ergeben gewundene Furchen (Hirnwindungen). */
function perlin(seed) {
  const G = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  const h = (x, y, z) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed + 7, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return G[((n ^ (n >>> 16)) >>> 0) % 12]; };
  const f = t => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, z) => {
    const X0 = Math.floor(x), Y0 = Math.floor(y), Z0 = Math.floor(z), fx = x - X0, fy = y - Y0, fz = z - Z0, u = f(fx), v = f(fy), w = f(fz);
    const d = (i, j, k) => { const g = h(X0 + i, Y0 + j, Z0 + k); return g[0] * (fx - i) + g[1] * (fy - j) + g[2] * (fz - k); };
    return lerp(lerp(lerp(d(0, 0, 0), d(1, 0, 0), u), lerp(d(0, 1, 0), d(1, 1, 0), u), v), lerp(lerp(d(0, 0, 1), d(1, 0, 1), u), lerp(d(0, 1, 1), d(1, 1, 1), u), v), w);
  };
}
/* Kugelgitter mit Formfunktion fn(d, u, v) → [Punkt, Farbe]; d Einheitsrichtung, v = 0 unten … 1 oben */
function ball(nu, nv, fn, ru = 3, rv = 2) {
  return new Geo().grid(nu, nv, (u, v) => {
    const th = u * TAU, ph = v * Math.PI, sp = Math.sin(ph), d = V(sp * Math.cos(th), -Math.cos(ph), sp * Math.sin(th)), [p, c] = fn(d, u, v);
    return [p.x, p.y, p.z, c, u * ru, v * rv];
  }, { wrap: true }).build();
}
/* Drehkörper um Y aus [[r, y, farbe], …] (außen von unten nach oben, oben nach innen), weich schattiert */
function latheC(pr, seg = 24, ru = 3) {
  let L = 0; const acc = [0]; for (let i = 1; i < pr.length; i++) acc.push(L += Math.hypot(pr[i][0] - pr[i - 1][0], pr[i][1] - pr[i - 1][1]));
  return new Geo().grid(seg, pr.length - 1, (u, v) => { const k = Math.round(v * (pr.length - 1)), [r, y, c] = pr[k], a = u * TAU; return [Math.cos(a) * r, y, Math.sin(a) * r, c ?? 1, u * ru, acc[k] / 12]; }, { wrap: true }).build();
}
/* Matrix: Gruppe/Geometrie bei p, lokales +Y entlang dir (Biegung bend), Skalierung */
const at3 = (p, dir, bend, sx, sy = sx, sz = sx) => place(p, dir, bend, sx, sy, sz);
/* Punkt auf einem Kreis in der XZ-Ebene (Winkel a von +X nach +Z) */
const ring = (a, r, y = 0) => V(Math.cos(a) * r, y, Math.sin(a) * r);
/* flache Scheibe (oben sichtbar) */
const discG = (n = 24) => { const g = new THREE.CircleGeometry(1, n); g.rotateX(-Math.PI / 2); return addColor(g, () => 1); };
/* Geometrie-Cache der Nester */
const GC = {}; const cg = (k, f) => GC[k] || (GC[k] = f());

/* ------------------------------------------------------------ Nesthaut */
/* Flache Fleischlinse mit unregelmäßigem Lappenrand: oben leicht gewölbt, unten bauchig (das Nest schwebt), verzweigte
   erhabene Adern vom Zentrum nach außen; atmet kaum merklich. Liefert { g, top(x, z) } – top ist die Höhe der Oberseite. */
function nestSkin(M, R, o = {}) {
  const s = XB(M), x = X(M), q = rng(o.seed || 7), g = new THREE.Group(), B = new Bag();
  const sx = o.sx ?? 1, sz = o.sz ?? 1, hT = o.h ?? R * 0.07, hB = o.hb ?? R * 0.2;
  const lobes = []; for (let i = 0; i < 6; i++) lobes.push([2 + (q() * 6 | 0), q() * TAU, 0.018 + q() * 0.035]);
  /* o.petal = [Anzahl, Tiefe, Phase]: ausgeprägte Lappen je Rolle (Kleeblatt, Blüte …), damit nicht jedes Nest auf
     derselben runden Haut steht; normiert, so dass der Rand den Radius R nicht überschreitet */
  const [pk, pa, pp] = o.petal || [0, 0, 0];
  const edge = a => { let k = 1; for (const [n, p, A] of lobes) k += A * Math.sin(n * a + p); return R * k * (1 + pa * Math.cos(pk * (a - pp))) / (1 + pa); };
  const swell = (px, pz) => hT * 0.22 * (Math.sin(px / R * 7.1 + 1.3) * Math.sin(pz / R * 6.3 - 0.4) + 0.5 * Math.sin((px + pz) / R * 11));
  const top = (px, pz) => { const a = Math.atan2(pz / sz, px / sx), rho = Math.min(1, Math.hypot(px / sx, pz / sz) / edge(a)); return hT * Math.sqrt(Math.max(0, 1 - Math.pow(rho, 5))) + swell(px, pz) * (1 - rho * rho); };
  B.add(new Geo().grid(o.nu || 72, 26, (u, v) => {
    const a = u * TAU, ph = v * Math.PI, c = Math.cos(ph), rho = Math.pow(Math.sin(ph), 0.4), e = edge(a), px = Math.cos(a) * rho * e * sx, pz = Math.sin(a) * rho * e * sz;
    const py = c >= 0 ? c * hT + swell(px, pz) * (1 - rho * rho) : c * hB * (1 + 0.18 * Math.sin(a * 5 + 1)) * (1 + 0.1 * Math.sin(a * 11));
    const col = c >= 0 ? lerp(1.05, 0.55, Math.pow(rho, 3)) : lerp(0.5, 0.25, -c);
    return [px, py, pz, col, px / 36, pz / 36];
  }, { wrap: true, flip: true }).build(), s.skin, I0);
  /* Adern: Hauptstränge mit je einem Seitenast */
  const nV = o.veins ?? 7, w0 = R * 0.018 * (o.vw ?? 1), r0 = o.r0 ?? 0.18;
  const vein = (a, rr, w, steps, stepL) => {
    const pts = [];
    for (let k = 0; k < steps; k++) { const px = Math.cos(a) * rr * sx, pz = Math.sin(a) * rr * sz; pts.push([px, top(px, pz) + w * 0.15, pz]); a += (q() - 0.5) * 0.32; rr += stepL; if (rr > edge(a) * 0.95) break; }
    if (pts.length > 2) B.add(tubeC(pts, w, w * 0.28, x.gum, Math.max(6, pts.length * 2), 6, 0, [0.95, 0.6, 0.75], [0.55, 0.3, 0.45]).geometry, x.gum, I0);
    return pts;
  };
  for (let i = 0; i < nV; i++) {
    const a = i / nV * TAU + (q() - 0.5) * 0.5, pts = vein(a, R * r0, w0, 10, R * 0.085);
    if (pts.length > 4) { const p = pts[2 + (q() * 2 | 0)], aa = Math.atan2(p[2] / sz, p[0] / sx) + (q() < 0.5 ? -1 : 1) * (0.35 + q() * 0.3); vein(aa, Math.hypot(p[0] / sx, p[2] / sz), w0 * 0.6, 6, R * 0.07); }
  }
  B.flush(g);
  const pg = new THREE.Group(); pg.add(g); pg.userData.pulse = { amp: 0.006, speed: 0.55, base: 1 };
  return { g: pg, top, edge };
}

/* ------------------------------------------------------------ gemeinsame Teile */
/* Säurespucker-Kopf: Fleischknolle unter Chitinhaube mit Dornenkamm, Augen, Speirohre nach +Z. o.n leichte Rohre
   nebeneinander, o.big ein schweres Rohr (mittig, über den leichten), o.glands Säuredrüsen am Hinterkopf.
   Die Gruppe ist der Geschützkopf (aim) und dreht um Y. */
function spitHead(M, s, o = {}) {
  const x = X(M), g = new THREE.Group(), B = new Bag(), n = o.n ?? 1, big = !!o.big;
  B.add(sphG(16, 11), x.flesh, T(0, 0, -s * 0.15, s, s * 0.8, s * 1.12));
  B.add(domeG(), x.chitin, T(0, s * 0.06, -s * 0.28, s * 1.07, s * 0.92, s * 1.18));
  for (let i = 0; i < 3; i++) { const z = s * (0.2 - i * 0.42); spike(B, M, V(0, s * 0.92 - i * s * 0.06, z), V(0, 1, -0.7), s * (0.7 - i * 0.1), s * 0.14, false); }
  for (const sg of [-1, 1]) {
    spike(B, M, V(sg * s * 0.95, s * 0.2, -s * 0.5), V(sg, 0.25, -0.6), s * 0.6, s * 0.13, false);
    for (let i = 0; i < 2; i++) eye(B, M, V(sg * s * (0.66 - i * 0.14), s * (0.36 + i * 0.13), s * (0.7 - i * 0.14)), V(sg * 0.6, 0.5, 0.6).normalize(), s * (0.16 - i * 0.04), false, false);
  }
  B.flush(g);
  for (let i = 0; i < n; i++) { const t = spitTube(M, s * 0.28, s * 1.4, { teeth: 7 }); t.position.set((i - (n - 1) / 2) * s * 0.7, -s * 0.18, s * 0.6); g.add(t); }
  if (big) { const t = spitTube(M, s * 0.4, s * 2.0, { teeth: 9 }); t.position.set(0, n ? s * 0.42 : -s * 0.05, s * (n ? 0.4 : 0.62)); t.rotation.x = n ? -0.08 : 0; g.add(t); }
  if (o.glands ?? big) for (const sg of [-1, 1]) sacAt(g, x.sac, V(sg * s * 0.62, s * 0.35, -s * 0.98), s * 0.4, [1, 0.85, 1.25], 0.07, 1.6 + sg * 0.3, 12);
  g.userData.aim = { phase: o.phase || 0 };
  return g;
}
/* Fleischhügel als Sockel (Drehkörper), Höhe h, Radius r */
function mound(B, M, p, r, h, mat) {
  const pr = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pr.push([r * (1 - 0.55 * Math.pow(t, 1.6)) * (i === 6 ? 0.01 : 1), h * Math.sin(t * Math.PI / 2), lerp(0.5, 1.05, t)]); }
  B.add(cg('mound', () => latheC(pr.map(([a, b, c]) => [a / r, b / h, c]), 16)), mat || X(M).flesh, T(p.x, p.y, p.z, r, h, r));
}
/* Tentakel, der am Nestrand aufsteigt und sich nach außen krümmt (schwingt um Y) */
function rimTentacle(M, top, a, r, len, w, o = {}) {
  const c = Math.cos(a), s = Math.sin(a), y = top(c * r, s * r) - w * 0.3, up = o.up ?? 0.6, cu = o.curl ?? 1;
  const pts = [[c * r, y, s * r], [c * (r + len * 0.25), y + len * up * 0.5, s * (r + len * 0.25)], [c * (r + len * 0.55), y + len * up * 0.75, s * (r + len * 0.55)], [c * (r + len * 0.85), y + len * up * 0.5 * cu, s * (r + len * 0.85)], [c * (r + len * (1 - 0.1 * cu)), y + len * up * 0.12, s * (r + len * (1 - 0.1 * cu))]];
  const side = V(-s, 0, c).multiplyScalar(len * 0.12 * (o.twist ?? 1)); pts[3][0] += side.x; pts[3][2] += side.z; pts[4][0] += side.x * 1.6; pts[4][2] += side.z * 1.6;
  return tentacle(M, V(...pts[0]), pts, w, Object.assign({ amp: 0.14, speed: 0.7, phase: a * 3, seg: 14, rad: 7, wob: 0.1, tip: o.tip, tipR: w * 0.55 }, o));
}

/* ===================================================================== SÄUREKRATER */
/* Chitinvulkan: steiler Kegel mit Knochenzähnen am Rand, innen ein Säuresee, aus dem der Spuckerkopf ragt (zielt).
   Funktionsmerkmal: Ring mit grünem See und Speirohren, die auf das Ziel zeigen.
   Stufe I ein Rohr; II zwei Rohre, Panzerplatten am Hang; III zwei Rohre plus schwerer Nebenkopf, Dornenkranz, Säureläufe. */
registerB('brood', 'turret', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(17 + lv);
  const { g: skin } = nestSkin(M, R * 0.9, { seed: 21 + lv, veins: 6, h: R * 0.06 }); g.add(skin);
  /* Kegel: flacher, beuliger Hang, wulstiger Rand, steile Innenwand, See */
  const rb = R * 0.8, rr = R * 0.43, hh = R * (0.27 + lv * 0.015), lake = hh * 0.55;
  const pr = [[rb, 0.2, 0.42], [rb * 0.9, hh * 0.2, 0.5], [lerp(rb, rr, 0.5), hh * 0.58, 0.66], [rr * 1.22, hh * 0.9, 0.8], [rr * 1.08, hh * 1.02, 0.95], [rr * 0.94, hh * 0.98, 0.85], [rr * 0.84, hh * 0.8, 0.5], [rr * 0.78, lake, 0.25], [0.01, lake - 0.3, 0.2]];
  const cone = latheC(pr, 32), cp = cone.attributes.position;
  /* Beulen im Hang (Lavawülste) */
  for (let i = 0; i < cp.count; i++) { const px = cp.getX(i), py = cp.getY(i), pz = cp.getZ(i), r = Math.hypot(px, pz); if (r < rr * 0.9 || py < 0.3) continue; const k = 1 + 0.06 * Math.sin(Math.atan2(pz, px) * 7 + py * 0.6) * sm(rr, rb, r) * (1 - sm(rb * 0.9, rb, r)); cp.setX(i, px * k); cp.setZ(i, pz * k); }
  cone.computeVertexNormals(); B.add(cone, x.chitin, I0);
  B.add(discG(28), s.pool, T(0, lake + 0.12, 0, rr * 0.8, 1, rr * 0.8));
  /* Knochenzähne am Rand, nach außen geneigt, unregelmäßig */
  const nT = 6 + lv * 2;
  for (let i = 0; i < nT; i++) { const a = i / nT * TAU + 0.3 + (q() - 0.5) * 0.3, p = ring(a, rr * 1.12, hh * 0.98); fang(B, M, p, ring(a, 0.9, 1), ring(a, 1, 0), R * (0.1 + q() * 0.07), R * 0.03, false); }
  /* Stufe II: Panzerschuppen am Hang mit Dorn */
  if (lv >= 2) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.6, p = ring(a, lerp(rb, rr, 0.42), hh * 0.5); B.add(domeG(), x.chitin, at3(p, ring(a, 0.9, 1), ring(a, 0, 1), R * 0.13, R * 0.05, R * 0.17)); spike(B, M, ring(a, lerp(rb, rr, 0.38), hh * 0.58), ring(a, 1, 0.9), R * 0.15, R * 0.035, false); }
  /* Stufe III: Säure läuft über den Rand */
  if (lv >= 3) for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 1.1, pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, r = lerp(rr * 1.18, rb * 0.92, t), y = t < 0.2 ? hh * 1.02 : lerp(hh * 0.95, 0.4, (t - 0.2) / 0.8); pts.push([Math.cos(a + t * 0.12) * r, y + 0.15, Math.sin(a + t * 0.12) * r]); } B.add(tubeC(pts, R * 0.02, R * 0.012, s.acid, 12, 5).geometry, s.acid, I0); B.add(sphG(7, 5), s.pool, T(Math.cos(a + 0.12) * rb * 0.95, 0.5, Math.sin(a + 0.12) * rb * 0.95, R * 0.06, R * 0.012, R * 0.06)); }
  /* Hals aus dem See */
  horn(B, M, [[0, lake - 0.5, 0], [0, lake + R * 0.12, -R * 0.02], [0, hh + R * 0.12, -R * 0.03]], R * 0.12, 0.9, { sym: false, mat: x.flesh, c0: 0.5, c1: 0.9, rad: 10, seg: 6 });
  B.flush(g);
  const head = spitHead(M, R * (lv >= 3 ? 0.21 : 0.18), { n: lv >= 2 ? 2 : 1, big: lv >= 3 }); head.position.y = hh + R * 0.16; g.add(head);
  return g;
});


/* ------------------------------------------------------------ weitere Bausteine */
/* beulige Knolle (Ellipsoid mit Rauschen); Farbe hell oben, dunkel unten */
function blob(nu, nv, rx, ry, rz, amp = 0.06, seed = 1, f = 1.8, c0 = 0.5, c1 = 1.1) {
  const pn = perlin(seed);
  return ball(nu, nv, d => { const k = 1 + amp * pn(d.x * f + seed, d.y * f, d.z * f); return [V(d.x * rx * k, d.y * ry * k, d.z * rz * k), lerp(c0, c1, d.y * 0.5 + 0.5)]; });
}
/* Augapfel: helle Lederhaut, grüne Iris, dunkle Pupille; blickt nach +Z */
function eyeball(M, r) {
  const x = X(M), s = XB(M), g = new THREE.Group(), B = new Bag();
  const capG = (k, th) => cg('cap' + k, () => { const c = new THREE.SphereGeometry(1, 14, 4, 0, TAU, 0, th); c.rotateX(Math.PI / 2); return addColor(c, () => 1); });
  B.add(sphG(12, 8), s.shell, T(0, 0, 0, r)); B.add(capG('i', 0.85), x.acid, T(0, 0, 0, r * 1.03)); B.add(capG('p', 0.32), x.socket, T(0, 0, 0, r * 1.06));
  B.flush(g); return g;
}
/* Augenstiel: wächst bei root aus der Haut, krümmt sich nach außen (Richtung a), Auge am Ende; dreht sich suchend um Y */
function eyeStalk(M, root, a, len, r, phase = 0) {
  const g = new THREE.Group(), c = Math.cos(a), s = Math.sin(a); g.position.copy(root);
  const pts = [[0, -0.5, 0], [c * len * 0.1, len * 0.45, s * len * 0.1], [c * len * 0.38, len * 0.86, s * len * 0.38], [c * len * 0.62, len * 0.98, s * len * 0.62]];
  g.add(tubeC(pts, r * 0.62, r * 0.36, X(M).flesh, 12, 7, 0.08, 0.5, 1.0));
  B2(g, b => horn(b, M, [[c * r * 0.4, len * 0.55, s * r * 0.4], [c * len * 0.25, len * 0.9, s * len * 0.25], [c * len * 0.42, len * 1.05, s * len * 0.42]], r * 0.22, 0.2, { sym: false, rad: 5, seg: 6 }));
  const e = eyeball(M, r * 0.85); e.position.set(c * len * 0.7, len * 0.97, s * len * 0.7); e.lookAt(c * len * 2.2, len * 2.6, s * len * 2.2); g.add(e);
  g.userData.sway = { axis: 'y', amp: 0.35, speed: 0.28, phase, base: 0 };
  return g;
}
/* kleiner Beutel für ein paar statische Teile direkt in eine Gruppe */
function B2(g, fill) { const b = new Bag(); fill(b); b.flush(g); }
/* Gefäß / Strang: Röhre entlang Punkten, Radius r0 → r1, Wurzel am Ende verdickt (taucht in die Haut), Ringwülste */
function vessel(B, M, pts, r0, r1, mat, o = {}) {
  const rf = v => lerp(r0, r1, v) * (1 + (o.root ?? 0.7) * sm(0.86, 1, v)) * (1 + 0.05 * Math.sin(v * 31 + (o.seed || 0)));
  B.add(sweep(pts, rf, o.nu ?? 12, o.nv ?? 26, o.c0 ?? 0.8, o.c1 ?? 0.6, 6).build(), mat, I0);
  const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  if (o.bands) { const tor = cg('band', () => { const t = new THREE.TorusGeometry(1, 0.2, 6, 16); t.rotateX(Math.PI / 2); return addColor(t, () => [1.25, 1.0, 1.25]); }); for (const v of o.bands) { const p = c.getPointAt(v), tg = c.getTangentAt(v), r = rf(v); B.add(tor, X(M).chitin, place(p, tg, null, r * 1.07, r * 1.5, r * 1.07)); } }
  if (o.spikes) for (const v of o.spikes) { const p = c.getPointAt(v), r = rf(v); spike(B, M, p.clone().add(V(0, r * 0.85, 0)), V(0, 1, 0).addScaledVector(c.getTangentAt(v), -0.6), r * 1.3, r * 0.26, false); }
  return c;
}
/* Ei im Fleischkelch: Schale, darüber (etwas größer) die leuchtende Schale für die Ladung; Kelch mit Zipfeln */
function egg(B, M, p, r, h, o = {}) {
  const s = XB(M), x = X(M), eg = cg('egg', () => blob(16, 12, 1, 1, 1, 0.035, 9, 2.2, 0.75, 1.15));
  B.add(eg, s.shell, T(p.x, p.y + h * 0.82, p.z, r, h, r));
  const cup = cg('cup', () => latheC([[1.25, -0.1, 0.45], [1.35, 0.25, 0.7], [1.15, 0.6, 0.95], [0.95, 0.72, 1.0], [0.82, 0.6, 0.6]], 18));
  B.add(cup, o.cupMat || x.flesh, T(p.x, p.y, p.z, r, h * 0.7, r));
  if (o.lit) { const m = mesh(eg, s.lit, false); m.position.set(p.x, p.y + h * 0.84, p.z); m.scale.set(r * 1.05, h * 1.04, r * 1.05); m.userData.chargeAt = o.lit; return m; }
}

/* ===================================================================== SCHWARMHERZ */
/* Riesiges, schräg stehendes Herz: zwei rote Kammern mit Kammerfurche und Kranzfurche, darin Kranzadern in Teamfarbe,
   violette Vorhöfe obenauf, gewaltige Gefäßbögen (Aorta, Lungenstamm, Hohlvenen), die in die Nesthaut tauchen, Augen,
   Tentakelkranz am Rand. Das Herz schlägt langsam. Funktionsmerkmal: das schlagende Herz mit Aderbögen – größtes Nest.
   Stufe I unbewaffnet, 5 Gefäße, 6 Tentakel; II zwei Säurespucker, 6. Gefäß, Chitinschuppen am Herzrücken, Dornen auf der
   Aorta, 9 Tentakel; III vier Spucker + zwei schwere, Knochenkrone aus sechs Rippen ums Herz, Säuredrüsen, 12 Tentakel. */
function heartGeo(Rm, Lh, seed) {
  const pn = perlin(seed), gth = t => Math.PI / 2 + 0.55 * t;
  const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  return ball(60, 44, (d, u) => {
    const t = d.y, th = u * TAU, w = Math.sqrt(Math.max(0, 1 - t * t)) * (t < 0 ? 1 + 0.36 * t : 1) * (0.86 + 0.14 * t);
    const gr = Math.exp(-((Math.min(ad(th, gth(t)), ad(th, gth(t) + Math.PI + 0.4)) / 0.15) ** 2)) * sm(-0.97, -0.6, t) * (1 - sm(0.5, 0.66, t));
    const av = Math.exp(-(((t - 0.6) / 0.06) ** 2));
    const k = (1 - 0.085 * gr - 0.07 * av) * (1 + 0.013 * Math.sin(th * 15 + t * 9)) * (1 + 0.035 * pn(d.x * 2.1, d.y * 2.1, d.z * 2.1));
    const c = lerp(0.62, 1.12, sm(-1, 0.5, t)) * (1 - 0.45 * gr - 0.4 * av);
    return [V(Math.cos(th) * w * Rm * k, t * Lh * (t > 0 ? 0.88 : 1), Math.sin(th) * w * Rm * 0.84 * k), c];
  });
}
registerB('brood', 'base', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(51 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.86, { seed: 55, veins: 11, h: R * 0.05, hb: R * 0.16, vw: 1.2 }); g.add(skin);
  /* Herz */
  const Rm = 21, Lh = 24, A = V(-0.28, 1, -0.2).normalize(), Hc = V(1.5, 25, 1.5);
  const hg = new THREE.Group(), HB = new Bag(); hg.position.copy(Hc); hg.quaternion.setFromUnitVectors(V(0, 1, 0), A);
  HB.add(heartGeo(Rm, Lh, 3), s.heart, I0);
  const hW = t => Math.sqrt(Math.max(0, 1 - t * t)) * (t < 0 ? 1 + 0.36 * t : 1) * (0.86 + 0.14 * t);
  const hP = (t, th, k = 1) => V(Math.cos(th) * hW(t) * Rm * k, t * Lh * (t > 0 ? 0.88 : 1), Math.sin(th) * hW(t) * Rm * 0.84 * k);
  const cor = (pts, r0, r1) => HB.add(tubeC(pts.map(p => [p.x, p.y, p.z]), r0, r1, s.team, Math.max(8, pts.length * 2), 5).geometry, s.team, I0);
  /* Kranzadern: vorn und hinten in der Kammerfurche, Ring in der Kranzfurche, Seitenäste */
  for (const off of [0, Math.PI + 0.4]) { const pts = []; for (let i = 0; i <= 12; i++) { const t = lerp(0.58, -0.86, i / 12); pts.push(hP(t, Math.PI / 2 + 0.55 * t + off, 0.94)); } cor(pts, 0.55, 0.22); }
  { const pts = []; for (let i = 0; i <= 26; i++) pts.push(hP(0.6, Math.PI / 2 + 0.33 + i / 26 * TAU * 0.92, 0.95)); cor(pts, 0.5, 0.38); }
  for (const [t0, sg] of [[0.35, 1], [0.1, -1], [-0.15, 1], [0.25, -1], [-0.35, -1], [-0.05, 1]]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = t0 - i * 0.07, th = Math.PI / 2 + 0.55 * t0 + sg * i * 0.15; pts.push(hP(t, th, 1.02)); } cor(pts, 0.33, 0.12); }
  /* Vorhöfe */
  HB.add(blob(26, 18, 10, 8.2, 9.6, 0.09, 5, 1.6, 0.55, 1.05), s.vein, T(-8.5, Lh * 0.8, -4));
  HB.add(blob(26, 18, 10.4, 8.8, 9.3, 0.09, 8, 1.6, 0.55, 1.05), s.vein, T(8.2, Lh * 0.72, -2));
  /* Augen auf der Vorderwand */
  const eyes = [[0.42, 2.55, 1.15], [0.3, 2.75, 0.95], [0.5, 2.85, 0.8], [0.15, 0.95, 0.9], [0.28, 0.75, 0.75], [0.05, 2.95, 0.8], [0.38, 3.25, 0.7]].slice(0, 3 + (lv - 1) * 2);
  for (const [t, th, r] of eyes) { const p = hP(t, th, 0.99), n = p.clone().setY(p.y * 0.3).normalize(); eye(HB, M, p, n, r * 1.3, false, false); }
  /* Stufe II: Chitinschuppen am Herzrücken */
  if (lv >= 2) for (const [t, th] of [[0.2, -1.2], [0.15, -1.95], [-0.15, -1.55], [-0.4, -1.3]]) { const p = hP(t, th, 0.98), n = p.clone().setY(p.y * 0.25).normalize(); HB.add(domeG(), x.chitin, place(p, n, V(0, -1, 0), 7, 2.2, 8.8)); spike(HB, M, hP(t, th, 1.08), n.clone().add(V(0, 0.4, 0)), 4.2, 0.9, false); }
  HB.flush(hg);
  hg.userData.pulse = { amp: 0.03, speed: 1.35, base: 1 }; g.add(hg);
  hg.updateMatrix(); const W = p => p.clone().applyMatrix4(hg.matrix);
  /* Gefäßbögen in die Haut: [Winkel, Scheitelhöhe, Landeradius, Startpunkt am Herz (lokal), Material, Radius] */
  const vs = [[Math.PI, 60, 40, V(-2, Lh * 0.9, 3), s.heart, 3.4], [Math.PI / 3, 52, 38, V(3, Lh * 0.84, 6), s.vein, 2.6], [Math.PI * 2 / 3, 51, 39, V(-3, Lh * 0.86, 6), s.vein, 2.5], [Math.PI * 5 / 3, 48, 39, V(7, Lh * 0.7, -6), s.vein, 2.7], [Math.PI * 4 / 3, 47, 38, V(-7, Lh * 0.75, -7), s.vein, 2.6]];
  if (lv >= 2) vs.push([0.1, 46, 40, V(11, Lh * 0.55, 1), s.heart, 2.3]);
  vs.forEach(([a, hm, rl, st, mat, rv], i) => {
    const S = W(st), out = ring(a, 1), y0 = top(Math.cos(a) * rl, Math.sin(a) * rl);
    const pts = [[S.x, S.y, S.z], [S.x + out.x * 3, hm - 4, S.z + out.z * 3], [Math.cos(a) * rl * 0.55, hm, Math.sin(a) * rl * 0.55], [Math.cos(a) * rl * 0.82, hm * 0.62, Math.sin(a) * rl * 0.82], [Math.cos(a) * rl * 0.97, y0 + 6, Math.sin(a) * rl * 0.97], [Math.cos(a) * rl, y0 - 1.5, Math.sin(a) * rl]];
    vessel(B, M, pts, rv, rv * 0.85, mat, { bands: lv >= 2 ? [0.3, 0.55, 0.75] : [0.45, 0.72], spikes: lv >= 2 && i < 3 ? [0.3, 0.4, 0.5] : null, seed: i, root: 0.9 });
    mound(B, M, V(Math.cos(a) * rl, y0 - 0.6, Math.sin(a) * rl), rv * 2.4, rv * 1.1, mat);
  });
  /* Stufe III: Knochenkrone (sechs Rippen ums Herz), Säuredrüsen am Herzfuß */
  if (lv >= 3) for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, y0 = top(Math.cos(a) * 30, Math.sin(a) * 30); horn(B, M, [[Math.cos(a) * 31, y0 - 1, Math.sin(a) * 31], [Math.cos(a) * 33, y0 + 16, Math.sin(a) * 33], [Math.cos(a) * 30, y0 + 36, Math.sin(a) * 30], [Math.cos(a + 0.1) * 33, y0 + 52, Math.sin(a + 0.1) * 33]], 2.6, 0.06, { sym: false, rad: 8, seg: 14 }); spike(B, M, ring(a, 32.8, y0 + 20), ring(a, 1, 0.3), 5, 0.9, false); }
  B.flush(g);
  if (lv >= 3) for (const a of [0.9, 2.5, 4.2, 5.6]) sacAt(g, x.sac, ring(a, 23, top(Math.cos(a) * 23, Math.sin(a) * 23) + 3), 3.4, [1, 0.8, 1.2], 0.05, 1.2 + a * 0.1, 14);
  /* Tentakelkranz */
  const nT = [0, 6, 9, 12][lv];
  for (let i = 0; i < nT; i++) { const a = (lv === 2 ? [15, 75, 135, 195, 255, 315, 45, 165, 285][i] : lv === 1 ? 15 + i * 60 : 15 + i * 30) * Math.PI / 180; g.add(rimTentacle(M, top, a, R * 0.74, R * 0.24, 2.4, { tip: s.teamSoft, up: 0.55 + (i % 3) * 0.1, twist: i % 2 ? 1 : -1 })); }
  /* Säurespucker auf Fleischhügeln */
  const guns = lv === 2 ? [[Math.PI / 2, 0], [Math.PI * 1.5, 0]] : lv === 3 ? [[Math.PI / 2, 1], [Math.PI * 1.5, 1], [Math.PI / 6, 0], [Math.PI * 5 / 6, 0], [Math.PI * 7 / 6, 0], [Math.PI * 11 / 6, 0]] : [];
  const GB = new Bag();
  guns.forEach(([a, hv], i) => { const p = ring(a, R * 0.64), y0 = top(p.x, p.z); mound(GB, M, V(p.x, y0 - 0.5, p.z), hv ? 7.5 : 6, hv ? 6 : 4.5, x.chitin); const h = spitHead(M, hv ? 5.4 : 4.2, { n: hv ? 0 : 1, big: !!hv, phase: i * 0.9 }); h.position.set(p.x, y0 + (hv ? 8 : 6.2), p.z); h.rotation.y = Math.PI / 2 - a; h.userData.aim.base = Math.PI / 2 - a; g.add(h); });
  GB.flush(g);
  return g;
});

/* ===================================================================== BRUTGRUBE */
/* Lange, offene Fruchtschote: Chitinwanne mit Fleischlippe, innen rotes Brutfleisch und leuchtendes Fruchtwasser, darin
   liegt das wachsende Schiff (Bauplatz, Bug +Z); die beiden Schotenhälften sind nach außen aufgeklappt (Innenseite
   nach oben), Nabelschnüre hängen ins Fruchtwasser, Eiergelege an beiden Enden. Funktionsmerkmal: die einzige
   längliche Form – eine aufgeklappte Schote mit Schiff darin. Stufen: Länge 64 / 80 / 94 (Liegeplatz für Schiffe bis 55 /
   75 / 98); II Knochenrippen und Dornen auf den Schoten, 4 Nabelschnüre, Hebammen-Tentakel am Bug; III zweites, kleines
   Schotenpaar am Heck, Knochenbögen über den Enden, 6 Nabelschnüre, große Gelege. */
registerB('brood', 'yard', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(31 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.95, { seed: 33 + lv, sx: 0.8, sz: 1, veins: 9, h: R * 0.04, hb: R * 0.14 }); g.add(skin);
  const Lp = [0, 64, 80, 92][lv], W = [0, 13.5, 15, 17.5][lv], yr = [0, 15, 16.5, 19][lv], yf = 2.6, yb = 1.4;
  const f = v => Math.sin(Math.PI * cl(v)), Z = v => (v - 0.5) * Lp;
  const rimY = v => lerp(yb + 1, yr, Math.pow(f(v), 0.5)), floorY = v => lerp(rimY(v) - 0.6, yf, Math.pow(f(v), 0.35)), wi = v => W * Math.pow(f(v), 0.55);
  /* Innenwanne (Brutfleisch) */
  B.add(new Geo().grid(22, 44, (u, v) => { const ph = u * Math.PI, ry = rimY(v); return [-Math.cos(ph) * wi(v), ry - Math.sin(ph) * (ry - floorY(v)), Z(v), [lerp(1.0, 0.45, Math.sin(ph)), lerp(0.8, 0.35, Math.sin(ph)), lerp(0.9, 0.4, Math.sin(ph))], u * 4, v * Lp / 12]; }).build(), x.gum, I0);
  /* Außenwände (Chitin, bauchig bis unter die Haut) */
  for (const sg of [-1, 1]) B.add(new Geo().grid(10, 44, (u, v) => { const e = Math.sin(u * Math.PI / 2), ry = rimY(v); return [sg * (wi(v) + 1 + 6 * e * Math.pow(f(v), 0.3)), ry - (ry - yb + 2) * (1 - Math.cos(u * Math.PI / 2)), Z(v), lerp(1.15, 0.45, u), u * 2, v * Lp / 12]; }, { flip: sg < 0 }).build(), x.chitin, I0);
  /* Fleischlippe am Rand */
  for (const sg of [-1, 1]) { const pts = []; for (let i = 0; i <= 18; i++) { const v = i / 18; pts.push([sg * (wi(v) + 0.6), rimY(v) + 0.35, Z(v)]); } B.add(tubeC(pts, 1.25, 1.25, x.flesh, 36, 8, 0.12, 0.85, 0.85).geometry, x.flesh, I0); }
  /* Fruchtwasser */
  const yF = yf + (yr - yf) * 0.34, hw = v => { const ry = rimY(v), k = (ry - yF) / Math.max(0.01, ry - floorY(v)); return Math.abs(k) >= 1 ? 0 : Math.sqrt(1 - k * k) * wi(v) * 0.985; };
  const fl = mesh(new Geo().grid(12, 40, (u, v) => [(u * 2 - 1) * hw(v), yF, Z(v), 1, u * 2, v * 6]).build(), s.amnion, false); fl.renderOrder = 2; g.add(fl);
  /* Schotenhälften: Innenseite (Fleisch, oben) und Chitin-Außenseite, Randwulst; aufgeklappt, Rand hochgebogen */
  const flap = (sg, v0, v1, Wf, a0, a1, ribs) => {
    const Lf = (v1 - v0) * Lp, fv = v => Math.pow(Math.sin(Math.PI * cl(v)), 0.75), vt = v => lerp(v0, v1, v);
    const P = (u, v, dn = 0) => { const Wl = Wf * fv(v), rho = Wl / (a1 - a0), al = lerp(a0, a1, u), o = rho * (Math.sin(al) - Math.sin(a0)), h = rho * (Math.cos(a0) - Math.cos(al)); return V(sg * (wi(vt(v)) + 1.6 + o - dn * Math.sin(al) * 0.6), rimY(vt(v)) + 0.5 + h - dn * Math.cos(al) * 0.6, Z(vt(v))); };
    B.add(new Geo().grid(10, 30, (u, v) => { const p = P(u, v); return [p.x, p.y, p.z, lerp(0.75, 1.2, u) * (1 - 0.25 * Math.pow(Math.abs(v - 0.5) * 2, 3)), u * 2, v * Lf / 10]; }, { flip: sg < 0 }).build(), x.flesh, I0);
    B.add(new Geo().grid(8, 24, (u, v) => { const p = P(u, v, 1); return [p.x, p.y, p.z, lerp(0.5, 1.0, u), u * 2, v * Lf / 10]; }, { flip: sg > 0 }).build(), x.chitin, I0);
    const ed = []; for (let i = 0; i <= 20; i++) { const p = P(1, i / 20, 0.5); ed.push([p.x, p.y, p.z]); } B.add(tubeC(ed, 0.75, 0.75, x.chitin, 40, 6, 0, [1.3, 1.05, 1.3], [1.3, 1.05, 1.3]).geometry, x.chitin, I0);
    if (ribs) for (let i = 1; i < ribs; i++) { const v = i / ribs, pts = []; for (let k = 0; k <= 6; k++) { const p = P(k / 6 * 0.96, v, -0.25); pts.push([p.x, p.y, p.z]); } horn(B, M, pts, 0.55, 0.5, { sym: false, rad: 5, seg: 10, c0: 0.8, c1: 1.15 }); const tip = P(1, v, 0.5); spike(B, M, tip, V(sg * 0.7, 1, 0), 2.6 + (i % 2) * 1.2, 0.5, false); }
    return P;
  };
  for (const sg of [-1, 1]) flap(sg, 0.06, 0.94, [0, 15, 16.5, 18][lv], -0.2, 1.15, lv >= 2 ? 7 : 0);
  if (lv >= 3) for (const sg of [-1, 1]) flap(sg, 0.0, 0.22, 7, 0.9, 2.0, 0);
  /* Nabelschnüre ins Fruchtwasser */
  const nC = [0, 2, 4, 6][lv];
  for (let i = 0; i < nC; i++) { const sg = i % 2 ? 1 : -1, v = 0.5 + ((i >> 1) - (nC / 2 - 1) / 2) * 0.17 + (nC === 2 ? 0 : 0), z = Z(v), w = wi(v), ry = rimY(v); B.add(tubeC([[sg * w * 0.92, ry - 2.2, z], [sg * w * 0.6, ry + 2.5, z + 1.5], [sg * w * 0.25, yF + 3.5, z + 3], [sg * 2.2, yF - 1.5, z + 4.5]], 1.05, 0.8, x.flesh, 16, 7, 0.15, 0.7, 1.0).geometry, x.flesh, I0); }
  /* Eiergelege an den Enden */
  const nE = [0, 2, 3, 5][lv];
  for (const end of [-1, 1]) for (let i = 0; i < nE; i++) { const a = (end > 0 ? Math.PI / 2 : -Math.PI / 2) + (i - (nE - 1) / 2) * 0.42, rr = Lp / 2 + 3.5 + (i % 2) * 2.2, p = V(Math.cos(a) * rr * 0.62, 0, Math.sin(a) * rr); p.y = top(p.x, p.z) - 0.3; egg(B, M, p, 2.4 + q() * 0.5, 3.1 + q() * 0.6); }
  /* Stufe II: Hebammen-Tentakel am Bug; III: Knochenbögen über den Enden */
  if (lv >= 2) for (const sg of [-1, 1]) { const z0 = Lp / 2 - 4; g.add(tentacle(M, V(sg * 3, rimY(0.95), z0), [[sg * 3, rimY(0.95), z0], [sg * 6, rimY(0.95) + 7, z0 - 1], [sg * 4.5, rimY(0.9) + 10, z0 - 7], [sg * 1.5, rimY(0.85) + 7, z0 - 10]], 1.3, { amp: 0.15, speed: 0.6, phase: sg, tip: s.team, tipR: 0.6, seg: 14, rad: 7 })); }
  if (lv >= 3) for (const v of [0.12, 0.88]) { const z = Z(v), w = wi(v) + 1, ry = rimY(v); horn(B, M, [[-w, ry - 1, z], [-w * 0.6, ry + 9, z], [w * 0.6, ry + 9, z], [w, ry - 1, z]], 1.1, 0.7, { sym: false, rad: 6, seg: 14, pw: 1 }); spike(B, M, V(0, ry + 9.6, z), V(0, 1, v > 0.5 ? 0.4 : -0.4), 4, 0.8, false); }
  B.flush(g);
  /* Liegeplatz (Bug +Z) */
  const berth = new THREE.Group(); berth.position.set(0, yF + (lv >= 3 ? 3.2 : 2.2), 0); berth.userData.berth = { len: [0, 55, 75, 98][lv] }; g.add(berth);
  return g;
});

/* ===================================================================== VERDAUUNGSKAMMER */
/* Durchscheinender, gelappter Magensack voller Erz- und Eisbrocken, die langsam umgewälzt werden; am Boden ein
   Säuresee; Chitinbänder (Peristaltik), Schließmuskel obenauf. Je Andockplatz ein Schlund: Muskelrohr mit Zahnkranz,
   in den der Grazer seinen Kopf steckt. Zwischen den Schlünden Darmschlingen auf der Haut. Funktionsmerkmal: Magen mit
   sichtbarem Erz und Zahntrichter mit Grazern. Stufen: 1 / 2 / 3 Schlünde, Magen bekommt je Schlund einen Lappen; III
   Dornenkranz um den Schließmuskel und Gallenblasen. */
registerB('brood', 'refinery', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(71 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.86, { seed: 73, veins: 8, h: R * 0.05, petal: [3, 0.14, -Math.PI / 2 + 0.25] }); g.add(skin);
  const a0 = -Math.PI / 2 + 0.25, gul = []; for (let i = 0; i < lv; i++) gul.push(a0 + i * TAU / 3);
  const Sc = V(0, 11.5, 0), S0 = 11.5, Sy = 10.5;
  const lobe = d => { let k = 1; for (const a of gul) { const c = d.x * Math.cos(a) + d.z * Math.sin(a); k += 0.3 * Math.pow(Math.max(0, c), 2) * (1 - Math.abs(d.y)); } return k; };
  const pn = perlin(13);
  const sg = ball(40, 26, (d) => { const k = lobe(d) * (1 + 0.03 * pn(d.x * 3, d.y * 3, d.z * 3)), yy = d.y < 0 ? d.y * 0.85 : d.y; return [V(d.x * S0 * k, yy * Sy, d.z * S0 * k), 1]; });
  const st = mesh(sg, s.stomach, false); st.position.copy(Sc); st.renderOrder = 3;
  const stp = new THREE.Group(); stp.add(st); stp.userData.pulse = { amp: 0.015, speed: 0.8, base: 1 }; g.add(stp);
  const surf = (d) => { d = d.clone().normalize(); const k = lobe(d); return V(d.x * S0 * k, (d.y < 0 ? d.y * 0.85 : d.y) * Sy, d.z * S0 * k).add(Sc); };
  /* Inhalt: Säuresee und Brocken (drehen sich langsam) */
  B.add(blob(22, 10, 1, 1, 1, 0.05, 3), s.pool, T(Sc.x, Sc.y - Sy * 0.62, Sc.z, S0 * 0.8, Sy * 0.25, S0 * 0.8));
  const ch = new THREE.Group(), CB = new Bag(), ico = cg('ico', () => addColor(new THREE.IcosahedronGeometry(1, 0), () => 1));
  for (let i = 0; i < 8 + lv * 3; i++) { const a = q() * TAU, r = q() * S0 * 0.62, p = V(Math.cos(a) * r, -Sy * 0.42 + q() * Sy * 0.75, Math.sin(a) * r), sz = 1.4 + q() * 1.8; const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(q() * 3, q() * 3, q() * 3)).scale(V(sz * (0.8 + q() * 0.5), sz * (0.6 + q() * 0.5), sz)).setPosition(p); CB.add(ico, i % 3 ? x.rock : x.ice, m); }
  CB.flush(ch); ch.position.copy(Sc); ch.userData.spin = { axis: 'y', speed: 0.12 }; g.add(ch);
  /* Peristaltik-Bänder (Chitin) und Längsmuskeln */
  for (const el of [-0.45, 0.05, 0.5]) { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, c = Math.sqrt(1 - el * el); pts.push(surf(V(Math.cos(a) * c, el, Math.sin(a) * c)).toArray()); } B.add(tubeC(pts, 0.55, 0.55, x.chitin, 80, 6, 0, [1.2, 1, 1.2], [1.2, 1, 1.2]).geometry, x.chitin, I0); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2, pts = []; for (let k = 0; k <= 10; k++) { const el = lerp(-0.85, 0.92, k / 10), c = Math.sqrt(1 - el * el); pts.push(surf(V(Math.cos(a) * c, el, Math.sin(a) * c)).multiplyScalar(1).toArray()); } B.add(tubeC(pts, 0.35, 0.3, x.flesh, 20, 5, 0, 0.7, 1.0).geometry, x.flesh, I0); }
  /* Schließmuskel obenauf */
  const tp = surf(V(0, 1, 0));
  B.add(cg('sph', () => latheC([[3.6, -0.8, 0.6], [3.8, 0.4, 0.9], [2.8, 1.4, 1.1], [1.2, 1.6, 0.5], [0.3, 0.9, 0.2], [0.01, 0.6, 0.15]], 20)), x.flesh, T(tp.x, tp.y - 0.3, tp.z, 1.1));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; B.add(tubeC([[Math.cos(a) * 3.5, 0.6, Math.sin(a) * 3.5], [Math.cos(a) * 1.8, 1.7, Math.sin(a) * 1.8], [Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5]], 0.45, 0.2, x.gum, 6, 5).geometry, x.gum, T(tp.x, tp.y, tp.z, 1.1)); }
  if (lv >= 3) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; spike(B, M, V(tp.x + Math.cos(a) * 4.6, tp.y - 0.5, tp.z + Math.sin(a) * 4.6), ring(a, 0.7, 1), 3.6, 0.6, false); }
  /* Schlünde mit Andockplatz */
  const lipR = 7.6, lipD = 23.5, lipY = 9.2;
  gul.forEach((a, i) => {
    const o = ring(a, 1), lip = ring(a, lipD, lipY), st0 = surf(o.clone().setY(-0.05)).addScaledVector(o, -4);
    const pts = [[st0.x, st0.y, st0.z], [o.x * 16, lipY + 0.6, o.z * 16], [o.x * (lipD - 0.4), lipY, o.z * (lipD - 0.4)]];
    B.add(sweep(pts, v => lerp(4.6, lipR * 1.02, Math.pow(v, 1.6)) * (1 + 0.1 * Math.pow(Math.max(0, Math.sin(v * Math.PI * 5)), 2)), 18, 18, 0.65, 1.0, 5).build(), x.flesh, I0);
    for (const v of [0.35, 0.65]) { const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p))), p = c.getPointAt(v), r = lerp(4.6, lipR, Math.pow(v, 1.6)); B.add(cg('band', () => { const t = new THREE.TorusGeometry(1, 0.2, 6, 16); t.rotateX(Math.PI / 2); return addColor(t, () => [1.25, 1.0, 1.25]); }), x.chitin, place(p, c.getTangentAt(v), null, r * 1.08, r * 1.6, r * 1.08)); }
    for (const sgn of [-1, 1]) { const side = V(-o.z, 0, o.x).multiplyScalar(sgn); spike(B, M, lip.clone().addScaledVector(side, lipR * 1.05).add(V(0, 2.5, 0)), side.clone().add(V(0, 1, 0)).addScaledVector(o, 0.5), 4.2, 0.75, false); }
    mound(B, M, V(o.x * 18, top(o.x * 18, o.z * 18) - 0.5, o.z * 18), 7.5, lipY - 4.5, x.flesh);
    const m = maw(M, lipR, lipR * 0.9, 7, { teeth: 12, rows: 2, tl: 0.42, glow: 0.22, lip: 0.16, seed: i + 3 }); m.position.copy(lip); m.rotation.y = Math.PI / 2 - a; g.add(m);
    const dk = new THREE.Group(); dk.position.copy(lip).addScaledVector(o, 10.5).add(V(0, -0.6, 0)); dk.rotation.y = Math.atan2(-o.x, -o.z); dk.userData.dock = true; g.add(dk);
  });
  /* Darmschlingen in den Lücken zwischen den Schlünden, Säurepfützen */
  const gaps = lv === 1 ? [[a0 + Math.PI, 1.0]] : lv === 2 ? [[a0 + Math.PI / 3, 0.55], [a0 + Math.PI * 4 / 3, 1.0]] : [0, 1, 2].map(i => [a0 + Math.PI / 3 + i * TAU / 3, 0.55]);
  gaps.forEach(([b, k], gi) => {
    const pts = [], n = Math.round(lerp(18, 30, k)); for (let i = 0; i <= n; i++) { const t = i / n, rr = lerp(13, 31, t), a = b + Math.sin(t * Math.PI * (k > 0.8 ? 4.5 : 3)) * (0.5 * k + 0.1) * (1 - 0.3 * t); pts.push([Math.cos(a) * rr, top(Math.cos(a) * rr, Math.sin(a) * rr) + 1.6, Math.sin(a) * rr]); }
    B.add(tubeC(pts, 2.3, 1.9, x.flesh, n * 3, 8, 0.12, 0.75, 0.95).geometry, x.flesh, I0);
    const e = pts[pts.length - 1]; B.add(sphG(12, 8), x.flesh, T(e[0], e[1], e[2], 2.4));
    const pp = ring(b + 0.35, 20); B.add(discG(18), s.pool, T(pp.x, top(pp.x, pp.z) + 0.08, pp.z, 2.6 + gi * 0.4, 1, 1.8));
  });
  B.flush(g);
  if (lv >= 3) for (const [a, r] of [[a0 + Math.PI / 3 + 0.5, 17], [a0 + Math.PI + 0.5, 17]]) sacAt(g, s.nutr, ring(a, r, top(Math.cos(a) * r, Math.sin(a) * r) + 2.5), 2.6, [1, 0.85, 1.1], 0.06, 1.3, 12);
  return g;
});

/* ===================================================================== BRUTKAMMER */
/* Nährsaft-Organ: ein helles Kernorgan (Drüse) in einem Knochenkelch, umringt von einer Traube praller grüner
   Nährblasen auf kurzen Stielen; Speiseadern laufen vom Kern in jede Blase, alles pumpt (Blasen gegenphasig zum Kern).
   Funktionsmerkmal: die einzige Traube leuchtender Blasen. Stufen: 5 / 8 / 11 Blasen (II zweite Reihe und Knochen-
   spangen, III dritte Reihe oben, Dornen am Kelch, zwei kleine Nebenkerne). */
registerB('brood', 'reactor', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(81 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.9, { seed: 83, veins: 7, h: R * 0.07, hb: R * 0.22, nu: 60, petal: [5, 0.17, 0] }); g.add(skin);
  const Kc = V(0, 10.5, 0), Kr = 5.2;
  /* Kelch */
  B.add(cg('calyx', () => latheC([[1.9, 0, 0.5], [1.75, 0.35, 0.7], [1.2, 0.75, 0.95], [1.05, 1.0, 1.1], [0.8, 0.9, 0.5], [0.01, 0.6, 0.4]], 22)), x.flesh, T(0, 0.5, 0, 5.2, 7.5, 5.2));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, pts = []; for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([Math.cos(a + t * 0.3) * lerp(8.5, 4.6, t), lerp(1, 10.5, t), Math.sin(a + t * 0.3) * lerp(8.5, 4.6, t)]); } horn(B, M, pts, 0.75, 0.3, { sym: false, rad: 6, seg: 8 }); if (lv >= 3) spike(B, M, V(...pts[4]), ring(a + 0.25, 0.5, 1), 2.4, 0.4, false); }
  /* Blasen */
  const rows = [[5, 14.5, 7.5, 3.9, 0], [8, 20.5, 5.0, 3.0, 0.4], [11, 12.5, 15, 2.3, 0.2]];
  const nR = lv;
  for (let ri = 0; ri < nR; ri++) {
    const [n, rr, y, br, a0] = rows[ri];
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU + (q() - 0.5) * 0.15, p = ring(a, rr * (1 + (q() - 0.5) * 0.08), y + (q() - 0.5) * 1.5);
      const root = ri === 2 ? V(0, 13, 0) : V(p.x * 0.35, top(p.x * 0.35, p.z * 0.35) + 0.5, p.z * 0.35);
      const mid = ri === 2 ? V(p.x * 0.5, y + 1.5, p.z * 0.5) : V(p.x * 0.75, lerp(root.y, p.y, 0.6) - 0.6, p.z * 0.75);
      B.add(tubeC([root.toArray(), mid.toArray(), p.toArray()], 0.9, 0.6, x.flesh, 10, 6, 0.1, 0.55, 0.95).geometry, x.flesh, I0);
      /* Speiseader (Teamfarbe) vom Kern in die Blase */
      B.add(tubeC([[Kc.x, Kc.y - 1, Kc.z], [p.x * 0.5, lerp(Kc.y, p.y, 0.5) + 1.2, p.z * 0.5], [p.x * 0.9, p.y + 0.3, p.z * 0.9]], 0.3, 0.2, s.teamSoft, 8, 4).geometry, s.teamSoft, I0);
      /* Blase mit Chitinhaube */
      const sc = sacAt(g, s.nutr, p, br, [1, 1.15, 1], 0.07, 0.9 + ri * 0.25, 14); sc.userData.pulse.phase = i;
      const cap = mesh(domeG(), x.chitin, false); cap.scale.set(br * 0.78, br * 0.5, br * 0.78); cap.position.set(0, br * 0.78, 0); sc.add(cap);
      if (ri >= 1) spike(B, M, V(p.x, p.y + br * 1.25, p.z), V(p.x * 0.05, 1, p.z * 0.05), br * 0.6, br * 0.12, false);
    }
  }
  /* Stufe III: zwei Nebenkerne */
  if (lv >= 3) for (const a of [1.2, 4.3]) { const p = ring(a, 24, top(Math.cos(a) * 24, Math.sin(a) * 24)); mound(B, M, V(p.x, p.y - 0.3, p.z), 3.6, 2.4); const c = mesh(sphG(14, 10), x.core, false); c.position.set(p.x, p.y + 3.2, p.z); c.scale.setScalar(2.2); c.userData.pulse = { amp: 0.1, speed: 1.3, base: 2.2 }; g.add(c); const sh = mesh(sphG(14, 10), s.nutr); sh.position.copy(c.position); sh.scale.setScalar(2.9); g.add(sh); }
  B.flush(g);
  /* Kern: leuchtende Drüse, pumpt */
  const core = mesh(sphG(16, 12), x.core, false); core.position.copy(Kc); core.userData.pulse = { amp: 0.14, speed: 1.1, base: Kr * 0.78 }; g.add(core);
  const hull = mesh(blob(24, 16, 1, 1.12, 1, 0.05, 4, 2), s.nutr); hull.position.copy(Kc); hull.scale.setScalar(Kr); hull.userData.pulse = { amp: 0.05, speed: 1.1, base: Kr }; g.add(hull);
  return g;
});

/* ===================================================================== CORTEX */
/* Gehirn: zwei Großhirnhälften mit tiefer Längsfurche und gewundenen Windungen (Rauschen-Nulllinien), hinten ein
   gefurchtes Kleinhirn, unten der Hirnstamm, der in die Haut taucht. Funktionsmerkmal: die Hirnwindungen und die
   Augenstiele. Stufe I nacktes Hirn mit einem Augenstiel; II Nervenstränge aus dem Hirn zu Nervenknoten (Teamfarbe) in
   der Haut, 3 Augenstiele, Chitinspange über der Furche; III Augenkranz (8 Augen auf Stielen) um das Hirn, Knochen-
   stachelkranz, weitere Nervenstränge. */
function brainGeo(seed) {
  const pn = perlin(seed), pf = perlin(seed + 5);
  return ball(72, 48, (d, u, v) => {
    const g = pn(d.x * 3.4, d.y * 3.4, d.z * 3.4) + 0.45 * pf(d.x * 6.5, d.y * 6.5, d.z * 6.5);
    const sul = Math.pow(1 - Math.min(1, Math.abs(g) / 0.22), 1.4) * (0.5 + 0.5 * sm(-0.9, -0.3, d.y));
    const fis = Math.exp(-((d.x / 0.1) ** 2)) * sm(-0.6, 0.0, d.y);
    const kk = 1 - 0.11 * sul - 0.13 * fis;
    return [V(d.x * 1.0 * kk + 0.05 * Math.sign(d.x || 1) * (1 - fis), (d.y * 0.72 + 0.1 * d.y * d.y) * kk, d.z * 1.22 * kk), lerp(0.6, 1.1, d.y * 0.5 + 0.5) * (1 - 0.5 * sul - 0.5 * fis)];
  }, 6, 3);
}
registerB('brood', 'lab', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(91 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.9, { seed: 93, veins: 8, h: R * 0.06, hb: R * 0.2, petal: [2, 0.12, Math.PI / 2] }); g.add(skin);
  const Bc = V(0, 13.5, 1), Bs = 17.5;
  const br = new THREE.Group(); br.position.copy(Bc); br.rotation.x = -0.12;
  const cx = mesh(cg('brain', () => brainGeo(3)), s.brain); cx.scale.setScalar(Bs); br.add(cx);
  /* Kleinhirn (quer gefurcht) hinten unten */
  const cb = mesh(cg('cereb', () => ball(40, 20, d => { const k = 1 - 0.09 * Math.pow(Math.abs(Math.sin(d.y * 11 + d.x * 2)), 0.6); return [V(d.x * 1.0 * k, d.y * 0.55 * k, d.z * 0.7 * k), lerp(0.55, 1.0, d.y * 0.5 + 0.5)]; }, 4, 2)), s.brain);
  cb.position.set(0, -Bs * 0.42, -Bs * 0.9); cb.scale.setScalar(Bs * 0.5); br.add(cb);
  br.userData.pulse = { amp: 0.012, speed: 0.7, base: 1 }; g.add(br);
  /* Hirnstamm in die Haut */
  B.add(sweep([[0, Bc.y - Bs * 0.5, -3], [0, Bc.y - Bs * 0.75, -6], [0, top(0, -9) - 0.5, -9]], v => lerp(5.5, 4.2, v) * (1 + 0.6 * sm(0.8, 1, v)), 14, 8, 0.6, 0.75, 6).build(), x.flesh, I0);
  /* Hirnhautlappen am Fuß (Fleisch um den Stamm) */
  mound(B, M, V(0, top(0, -8) - 0.4, -8), 10, 3.2);
  /* Nervenstränge zu Nervenknoten */
  const nerves = lv === 1 ? [] : lv === 2 ? [[0.5, 26], [2.4, 25], [4.0, 27]] : [[0.5, 26], [1.5, 27], [2.4, 25], [3.3, 27], [4.0, 27], [5.2, 26]];
  for (const [a, rr] of nerves) {
    const o = ring(a, 1), st = V(o.x * Bs * 0.85, Bc.y - Bs * 0.1 + (q() - 0.5) * 4, o.z * Bs * 1.0 + 1), e = ring(a + 0.1, rr); e.y = top(e.x, e.z) + 0.3;
    B.add(tubeC([st.toArray(), [o.x * Bs * 1.05, Bc.y - Bs * 0.45, o.z * Bs * 1.2 + 1], [e.x * 0.85, e.y + 2.5, e.z * 0.85], e.toArray()], 1.1, 0.7, s.nerve, 14, 6, 0.12, 0.8, 1.0).geometry, s.nerve, I0);
    mound(B, M, V(e.x, e.y - 0.3, e.z), 3.4, 1.8, x.flesh);
    const k = mesh(sphG(10, 7), s.teamSoft, false); k.position.set(e.x, e.y + 1.4, e.z); k.scale.setScalar(1.3); k.userData.pulse = { amp: 0.12, speed: 0.9, base: 1.3 }; g.add(k);
  }
  /* Chitinspange über der Längsfurche (ab II), Stachelkranz (III) */
  if (lv >= 2) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, z = lerp(-0.9, 1.0, t); pts.push([0, Bc.y + Bs * 0.78 * Math.sqrt(Math.max(0.02, 1 - z * z * 0.9)) + 0.6, Bc.z + z * Bs * 1.0]); } horn(B, M, pts, 1.3, 0.5, { sym: false, mat: x.chitin, c0: [1.3, 1.05, 1.3], c1: [1.3, 1.05, 1.3], rad: 7, seg: 12, pw: 1 }); for (const t of [0.3, 0.55, 0.8]) spike(B, M, V(0, pts[Math.round(t * 10)][1] + 0.5, pts[Math.round(t * 10)][2]), V(0, 1, -0.4), 3.4, 0.6, false); }
  if (lv >= 3) for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.3, p = ring(a, Bs * 1.08, Bc.y - Bs * 0.2); spike(B, M, p, ring(a, 1, 0.35), 4 + (i % 2) * 1.5, 0.6, false); }
  B.flush(g);
  /* Augenstiele */
  const st = lv === 1 ? [[0.9, 24]] : lv === 2 ? [[0.9, 24], [-0.7, 24], [3.6, 23]] : [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i / 8 * TAU + 0.4, 24 + (i % 2) * 2]);
  st.forEach(([a, rr], i) => { const p = ring(a, rr); p.y = top(p.x, p.z) - 0.2; g.add(eyeStalk(M, p, a, lv >= 3 ? 7.5 : 8.5, 2.1, i * 0.8)); });
  return g;
});

/* ===================================================================== PHEROMONKNOTEN */
/* Signalturm: hoher, gegliederter Fleischstiel mit Chitinringen, oben eine Krone aus gefiederten Fühlern (wie ein
   Nachtfalter), am Stiel rosa Duftknollen, die rhythmisch glimmen (langsame Pulsgruppen, kein Blinken), unten ein
   Wurzelkranz. Funktionsmerkmal: das einzige hohe, dünne Nest mit Fühlerkrone. Stufen: 2 / 3 / 4 Knollen, Stiel 24 /
   30 / 36 hoch, Fühler 2 / 4 / 6, III Nebenstiel. */
function feather(M, len, w, n = 7) {
  const g = new THREE.Group(), B = new Bag(), x = X(M);
  const pts = [[0, 0, 0], [0, len * 0.45, len * 0.12], [0, len * 0.8, len * 0.3], [0, len, len * 0.45]];
  B.add(tubeC(pts, w * 0.22, w * 0.08, x.chitin, 10, 5, 0, [1.3, 1.05, 1.3], [1.4, 1.1, 1.4]).geometry, x.chitin, I0);
  const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  for (let i = 1; i <= n; i++) { const t = i / (n + 1), p = c.getPointAt(t), tg = c.getTangentAt(t), l = w * (1 - 0.6 * Math.pow(t, 2)) * 1.2; for (const sg of [-1, 1]) { const dir = V(sg, 0.15, 0).addScaledVector(tg, 0.35).normalize(); B.add(tubeC([p.toArray(), p.clone().addScaledVector(dir, l * 0.5).toArray(), p.clone().addScaledVector(dir, l).add(V(0, -l * 0.15, 0)).toArray()], w * 0.07, w * 0.02, x.bone, 4, 4, 0, 0.9, 1.2).geometry, x.bone, I0); } }
  B.flush(g);
  const tip = mesh(sphG(7, 5), XB(M).teamSoft, false); tip.position.copy(c.getPointAt(1)); tip.scale.setScalar(w * 0.14); g.add(tip);
  return g;
}
registerB('brood', 'relay', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(41 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.88, { seed: 45, veins: 6, h: R * 0.08, hb: R * 0.25, nu: 54, petal: [3, 0.3, 0.4] }); g.add(skin);
  const H = [0, 18, 22, 26][lv], r0 = 4.2;
  const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.sin(t * 2.2) * 1.6, lerp(-0.5, H, t), Math.cos(t * 1.7) * 1.2 - 1.2]); }
  const rf = v => lerp(r0, 1.8, Math.pow(v, 0.8)) * (1 + 0.1 * Math.pow(Math.max(0, Math.sin(v * Math.PI * 9)), 2)) * (1 + 0.9 * sm(0.93, 1, 1 - v));
  const stalk = new THREE.Group();
  B2(stalk, b => {
    b.add(sweep(pts, rf, 14, 36, 0.55, 1.0, 6).build(), x.flesh, I0);
    const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p))), tor = cg('band', () => { const t = new THREE.TorusGeometry(1, 0.2, 6, 16); t.rotateX(Math.PI / 2); return addColor(t, () => [1.25, 1.0, 1.25]); });
    for (let i = 1; i <= 4; i++) { const v = i / 5, p = c.getPointAt(v), tg = c.getTangentAt(v), r = rf(v); b.add(tor, x.chitin, place(p, tg, null, r * 1.08, r * 1.3, r * 1.08)); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + i; spike(b, M, p.clone().add(ring(a, r * 1.05)), ring(a, 1, 0.9), r * 0.9, r * 0.2, false); } }
    /* Wurzelkranz */
    for (let i = 0; i < 6; i++) { const a = 0.4 + (i >> 1) * TAU / 3 + (i % 2 ? 0.32 : -0.32), e = ring(a, 10 + q() * 3);   /* je Lappen zwei Wurzeln */ e.y = top(e.x, e.z) - 0.4; b.add(tubeC([[Math.cos(a) * r0 * 0.5, 2.2, Math.sin(a) * r0 * 0.5 - 1.2], [Math.cos(a) * 6, 1.4, Math.sin(a) * 6 - 0.6], e.toArray()], 1.3, 0.5, x.flesh, 8, 6, 0.1, 0.6, 0.9).geometry, x.flesh, I0); }
    /* Krone: Fühler */
    const e = c.getPointAt(1), tg = c.getTangentAt(1), nF = lv * 2;
    b.add(sphG(12, 8), x.chitin, T(e.x, e.y, e.z, 2.6, 2.2, 2.6));
    for (let i = 0; i < nF; i++) { const a = i / nF * TAU + (lv === 1 ? Math.PI / 2 : 0), f = feather(M, [0, 9, 10, 11][lv], 5, 6); f.position.copy(e).add(ring(a, 1.2)); f.quaternion.setFromUnitVectors(V(0, 1, 0), ring(a, 1, 0.35).normalize()); f.rotateY(0); f.userData.sway = { axis: 'z', amp: 0.08, speed: 0.5, phase: i, base: 0 }; stalk.add(f); }
    /* Duftknollen am Stiel: Chitinkelch, rosa Knolle mit Teamkern */
    const nK = lv + 1;
    for (let i = 0; i < nK; i++) { const v = lerp(0.3, 0.86, i / Math.max(1, nK - 1)), a = i * 2.3 + 0.6, p = c.getPointAt(v), r = rf(v), o = ring(a, 1), kp = p.clone().add(o.clone().multiplyScalar(r + 2.4)), kr = 2.6 - i * 0.2; b.add(tubeC([p.clone().add(o.clone().multiplyScalar(r * 0.6)).toArray(), p.clone().add(o.clone().multiplyScalar(r + 1)).add(V(0, -0.6, 0)).toArray(), kp.clone().add(V(0, -kr * 0.5, 0)).toArray()], 1.1, 0.8, x.flesh, 6, 6, 0, 0.6, 0.9).geometry, x.flesh, I0); b.add(cg('cup', () => latheC([[1.25, -0.1, 0.45], [1.35, 0.25, 0.7], [1.15, 0.6, 0.95], [0.95, 0.72, 1.0], [0.82, 0.6, 0.6]], 18)), x.chitin, T(kp.x, kp.y - kr * 0.9, kp.z, kr * 0.75, kr * 0.9, kr * 0.75)); const sc = sacAt(stalk, s.pink, kp, kr, [1, 1.2, 1], 0.12, 0.45 + i * 0.07, 14); sc.userData.pulse.phase = i * 1.3; const k = mesh(sphG(8, 6), s.teamSoft, false); k.scale.setScalar(kr * 0.42); k.userData.pulse = { amp: 0.45, speed: 0.45 + i * 0.07, base: kr * 0.42 }; sc.add(k); }
  });
  stalk.userData.sway = { axis: 'z', amp: 0.025, speed: 0.4, phase: lv, base: 0 }; g.add(stalk);
  if (lv >= 3) { const p2 = V(-9, 0, 7); const sub = new THREE.Group(); sub.position.set(p2.x, top(p2.x, p2.z) - 0.5, p2.z); B2(sub, b => { b.add(sweep([[0, 0, 0], [1.5, 6, -1], [3.5, 10, -2]], v => lerp(2.2, 1.0, v) * (1 + 0.7 * sm(0.9, 1, 1 - v)), 10, 14, 0.55, 1.0, 6).build(), x.flesh, I0); }); const sc = sacAt(sub, s.pink, V(4, 11.5, -2.3), 1.9, [1, 1.2, 1], 0.12, 0.6, 12); const k = mesh(sphG(8, 6), s.teamSoft, false); k.scale.setScalar(0.8); k.userData.pulse = { amp: 0.45, speed: 0.6, base: 0.8 }; sc.add(k); sub.userData.sway = { axis: 'x', amp: 0.04, speed: 0.5, phase: 2, base: 0 }; g.add(sub); }
  B.flush(g);
  return g;
});

/* ===================================================================== SPORENNEST */
/* Bovist-Kolonie: ein großer blasser Pilzbauch mit Scheitelöffnung (leuchtend grüner Schlund) und dunklen Poren
   in Ringen, Fleischwülste am Fuß; kleinere Boviste daneben; darüber kreist eine Wolke aus Sporen (orbit + bob),
   Funktionsmerkmal: Pilzform plus schwebende Sporenwolke.
   Stufen: 1 / 2 / 3 Boviste, Sporen 10 / 16 / 24, III Knochenkranz um den großen Bovist, Sporenschlote. */
function puffball(M, r, seed) {
  const s = XB(M), x = X(M), g = new THREE.Group(), B = new Bag(), pn = perlin(seed);
  const geo = ball(44, 30, d => { const po = Math.max(0, Math.sin(d.y * 14) * 0.5 + 0.5) * Math.pow(Math.max(0, Math.sin(Math.atan2(d.z, d.x) * 9 + d.y * 3) * 0.5 + 0.5), 8) * sm(-0.5, 0.2, d.y) * (1 - sm(0.8, 0.95, d.y)); const k = (1 + 0.05 * pn(d.x * 2.5 + seed, d.y * 2.5, d.z * 2.5) - 0.12 * po) * (1 - 0.5 * sm(0.88, 1, d.y)); return [V(d.x * k, (d.y * 0.86 + 0.1) * k * (d.y < 0 ? 0.9 : 1), d.z * k), lerp(0.55, 1.1, d.y * 0.5 + 0.5) * (1 - 0.7 * po)]; }, 4, 2);
  B.add(geo, s.fungus, T(0, 0, 0, r));
  /* Scheitelöffnung: Trichter und Leuchtschlund */
  B.add(cg('ost', () => latheC([[0.5, 0.0, 0.3], [0.52, 0.5, 0.5], [0.62, 0.85, 0.9], [0.5, 1.0, 1.1], [0.3, 0.8, 0.6], [0.01, 0.55, 0.3]], 18)), x.gum, T(0, r * 0.82, 0, r * 0.7, r * 0.32, r * 0.7));
  B.add(discG(16), s.pool, T(0, r * 1.02, 0, r * 0.22, 1, r * 0.22));
  /* Fußwülste */
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + seed; B.add(sphG(10, 7), x.flesh, T(Math.cos(a) * r * 0.78, -r * 0.3, Math.sin(a) * r * 0.78, r * 0.3, r * 0.22, r * 0.36)); }
  B.flush(g);
  g.userData.pulse = { amp: 0.02, speed: 0.6, base: 1 };
  return g;
}
registerB('brood', 'spore', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(61 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.9, { seed: 63, veins: 7, h: R * 0.07, hb: R * 0.22, nu: 60, petal: [6, 0.1, 0.3] }); g.add(skin);
  const big = [0, 11, 12, 13][lv], pb = puffball(M, big, 1); pb.position.set(lv === 1 ? 0 : -3, top(0, 0) + big * 0.35, lv === 1 ? 0 : 2); g.add(pb);
  const subs = lv === 1 ? [] : lv === 2 ? [[12, -8, 6.5]] : [[12, -8, 6.5], [-6, -15, 5]];
  subs.forEach(([px, pz, r], i) => { const p = puffball(M, r, 3 + i); p.position.set(px, top(px, pz) + r * 0.3, pz); g.add(p); });
  /* Sporen: Kugelchen in Kreisbahnen auf mehreren Höhen, mit leichtem Heben und Senken */
  const nS = [0, 10, 16, 24][lv];
  for (let i = 0; i < nS; i++) {
    const piv = new THREE.Group(), lvl = i % 3, r = lerp(9, R * 0.95, q()), y = big * 1.2 + 3 + lvl * 4 + q() * 5;
    piv.position.copy(pb.position); piv.userData.orbit = { r, speed: (lvl % 2 ? 1 : -1) * (0.09 + q() * 0.12), phase: q() * TAU, y, wob: 1.6 + q() * 1.5, flat: 0.85 };
    const sp = mesh(sphG(7, 5), s.spore, false); sp.scale.setScalar(0.42 + q() * 0.45); piv.add(sp); g.add(piv);
  }
  /* Stufe III: Knochenkranz um den großen Bovist, Sporenschlote */
  if (lv >= 3) { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2, p = ring(a, big * 1.02).add(pb.position); p.y = top(p.x, p.z) - 0.3; spike(B, M, p, ring(a, 0.8, 1), 5 + (i % 2) * 1.5, 0.75, false); } for (const [a, rr] of [[0.4, 20], [2.2, 19], [4.6, 21]]) { const v = vent(M, 6, 1.4, 1.2, a * 10 | 0); const p = ring(a, rr); v.position.set(p.x, top(p.x, p.z) - 0.2, p.z); v.rotation.y = -a + Math.PI / 2; g.add(v); } }
  if (lv === 1) for (const a of [1.2, 3.4, 5.3]) { const p = ring(a, 17); p.y = top(p.x, p.z) - 0.3; B.add(blob(14, 10, 1, 0.6, 1, 0.08, a * 10 | 0), s.fungus, T(p.x, p.y, p.z, 3.2)); }
  B.flush(g);
  return g;
});

/* ===================================================================== BRUTSTURM */
/* Mutterleib: riesige durchscheinende Gebärblase mit rotem Kern (wächst mit der Ladung) in einem Knochenkorb aus
   Rippen, Chitinbänder; Kranz aus Eiern in Fleischkelchen, die mit der Ladung nacheinander aufleuchten (chargeAt);
   dicke Tentakel, die den Kranz umgreifen; Augenkranz am Leib. Funktionsmerkmal: Eierkranz um einen Leib.
   Stufen: 8 / 11 / 14 Eier, Rippen 6 / 8 / 10, Tentakel 4 / 6 / 8, III Knochenstacheln auf den Rippen, Augen. */
registerB('brood', 'super', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(101 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.86, { seed: 105, veins: 10, h: R * 0.05, hb: R * 0.17, vw: 1.1 }); g.add(skin);
  const Wc = V(0, 16, 0), Wr = 16, Wy = 15;
  /* Knochenkorb */
  const nR = [0, 6, 8, 10][lv];
  for (let i = 0; i < nR; i++) { const a = i / nR * TAU + 0.15, pts = []; for (let k = 0; k <= 7; k++) { const t = k / 7, ph = lerp(-0.2, 1.3, t), rr = Wr * 1.06 * Math.cos(ph) + 0.5, y = Wc.y + Wy * 1.06 * Math.sin(ph); pts.push([Math.cos(a) * Math.max(rr, 1.5), Math.max(y, top(Math.cos(a) * rr, Math.sin(a) * rr) - 1), Math.sin(a) * Math.max(rr, 1.5)]); } horn(B, M, pts, 1.4, 0.3, { sym: false, rad: 7, seg: 14, pw: 0.6 }); if (lv >= 3) for (const t of [0.35, 0.6]) spike(B, M, V(...pts[Math.round(t * 7)]), ring(a, 1, 0.6), 3.6, 0.65, false); }
  for (const ph of [0.1, 0.55]) { const pts = []; for (let i = 0; i <= 36; i++) { const a = i / 36 * TAU, rr = Wr * 1.03 * Math.cos(ph); pts.push([Math.cos(a) * rr, Wc.y + Wy * 1.03 * Math.sin(ph), Math.sin(a) * rr]); } B.add(tubeC(pts, 0.8, 0.8, x.chitin, 72, 6, 0, [1.25, 1.0, 1.25], [1.25, 1.0, 1.25]).geometry, x.chitin, I0); }
  /* Fleischsockel unter dem Leib */
  B.add(cg('calyx', () => latheC([[1.9, 0, 0.5], [1.75, 0.35, 0.7], [1.2, 0.75, 0.95], [1.05, 1.0, 1.1], [0.8, 0.9, 0.5], [0.01, 0.6, 0.4]], 22)), x.flesh, T(0, 0.3, 0, 11, 8.5, 11));
  /* Augen am Leib (III) */
  if (lv >= 3) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.4, p = ring(a, Wr * 0.92, Wc.y + Wy * 0.35); eye(B, M, p, ring(a, 1, 0.4).normalize(), 1.1, false, false); }
  /* Eierkranz */
  const nE = [0, 8, 11, 14][lv], Er = R * 0.67, lits = [];
  for (let i = 0; i < nE; i++) { const a = i / nE * TAU + Math.PI / 2, p = ring(a, Er + (i % 2) * 2.5); p.y = top(p.x, p.z) - 0.4; const er = 3.6 + (i % 2) * 0.4; const m = egg(B, M, p, er, er * 1.3, { lit: (i + 0.5) / nE }); lits.push(m); }
  B.flush(g);
  for (const m of lits) g.add(m);
  /* Tentakel, zwischen den Eiern nach außen */
  const nT = [0, 4, 6, 8][lv];
  for (let i = 0; i < nT; i++) { const a = i / nT * TAU + Math.PI / nT + Math.PI / 2, root = ring(a, Wr * 0.75, Wc.y - Wy * 0.55), pts = [root.toArray(), ring(a, Wr * 1.1, Wc.y - Wy * 0.45).toArray(), ring(a, Er - 4, Wc.y - Wy * 0.1).toArray(), ring(a + 0.12, Er + 5, Wc.y - Wy * 0.6 + 3).toArray(), ring(a + 0.25, Er + 11, top(Math.cos(a + 0.25) * (Er + 11), Math.sin(a + 0.25) * (Er + 11)) + 4).toArray()]; g.add(tentacle(M, root, pts, 2.4, { amp: 0.1, speed: 0.6, phase: i * 1.1, seg: 16, rad: 8, wob: 0.1, tip: s.teamSoft, tipR: 1.0 })); }
  /* Leib: Kern (charge) und Hülle */
  const core = mesh(sphG(18, 12), x.core, false); core.position.copy(Wc); core.scale.setScalar(Wr * 0.72); core.userData.charge = true; core.userData.chargeBase = Wr * 0.72; g.add(core);
  const inner = mesh(blob(22, 16, 1, 0.95, 1, 0.08, 7, 2, 0.5, 1.0), s.heart); inner.position.copy(Wc); inner.scale.setScalar(Wr * 0.42); inner.userData.pulse = { amp: 0.06, speed: 1.2, base: Wr * 0.42 }; g.add(inner);
  const womb = mesh(blob(36, 24, 1, Wy / Wr, 1, 0.04, 11, 1.8), s.womb, false); womb.position.copy(Wc); womb.scale.setScalar(Wr); womb.renderOrder = 4; womb.userData.pulse = { amp: 0.02, speed: 0.8, base: Wr }; g.add(womb);
  return g;
});

/* ===================================================================== MEMBRANWALL (Schildwall) */
/* Zwei mächtige Knochenhauer wachsen aus Fleischhügeln an den Enden einer länglichen Nesthaut (Längsachse X) und
   krümmen sich zueinander; dazwischen spannt sich eine durchscheinende, geäderte Flughaut, aus der das Feld wächst (das
   Feld selbst zeichnet entities.js). Oben in der Mitte hängt die Emitterblase (säuregrün, pulsiert). Funktionsmerkmal:
   ein Torbogen mit Haut – kein anderes Nest ist so breit und flach.
   Stufen: I Bogen und Haut; II Knochenrippen in der Haut, Dornen auf den Hauern, Augen am Fuß; III zweites, kleineres
   Hauerpaar außen, Tentakel mit Teamspitzen, Säuredrüsen an den Hügeln, größere Emitterblase. Eigenes Modell statt
   des allgemeinen aus extra22.js. */
registerB('brood', 'wall', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag();
  const { g: skin, top } = nestSkin(M, R * 0.86, { seed: 121, sx: 1, sz: 0.55, veins: 6, h: R * 0.05, hb: R * 0.16, nu: 48 }); g.add(skin);
  const xo = R * 0.6, H = 15 + lv * 1.5;
  /* Hauer: Punktlisten von außen unten zur Mitte oben */
  const tusk = sg => [[sg * xo, top(sg * xo, 0) - 1, 0], [sg * (xo + 1), H * 0.45, 0.4], [sg * xo * 0.72, H * 0.88, 0.6], [sg * xo * 0.28, H, 0.3]];
  for (const sg of [-1, 1]) {
    const pts = tusk(sg); mound(B, M, V(sg * xo, top(sg * xo, 0) - 0.5, 0), 4.6, 3.8, x.chitin);
    horn(B, M, pts, 2.2, 0.12, { sym: false, rad: 9, seg: 16 });
    if (lv >= 2) { const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p))); for (const t of [0.3, 0.5, 0.68]) { const p = c.getPointAt(t); spike(B, M, p.clone().add(V(sg * 1.2, 0.6, 0)), V(sg, 0.8, 0.2), 3.2, 0.6, false); } for (let i = 0; i < 2; i++) eye(B, M, V(sg * (xo - 2.4), top(sg * xo, 0) + 2.6 + i * 1.3, 2.6 - i * 0.5), V(sg * 0.3, 0.4, 1).normalize(), 0.75 - i * 0.15, false, false); }
  }
  /* Flughaut zwischen den Hauern (Ebene z ≈ 0), unten am Haut-Saum, oben am Bogen, leicht nach hinten durchhängend */
  const L = new THREE.CatmullRomCurve3(tusk(-1).map(p => V(...p))), Rr = new THREE.CatmullRomCurve3(tusk(1).map(p => V(...p)));
  const mg = new Geo().grid(16, 10, (u, v) => {
    /* u: links → rechts über den Bogen, v: Saum unten → Bogen oben */
    const tL = 0.15 + 0.85 * u, a = u < 0.5 ? L.getPointAt(Math.min(1, u * 2 * 0.98 + 0.02)) : Rr.getPointAt(Math.min(1, (1 - u) * 2 * 0.98 + 0.02));
    const by = top((u - 0.5) * 2 * xo * 0.9, 0) + 0.4, bx = (u - 0.5) * 2 * xo * 0.92, k = Math.sin(Math.PI * v), py = lerp(by, a.y - 0.4, v), px = lerp(bx, a.x * 0.97, v);
    void tL; return [px, py, -1.4 * k * Math.sin(Math.PI * u) + 0.3, lerp(0.75, 1.25, v), u * 3, v * 2];
  }).build();
  const mm = mesh(mg, x.membrane, false); mm.renderOrder = 3; const mp = new THREE.Group(); mp.add(mm); mp.userData.pulse = { amp: 0.012, speed: 0.7, base: 1 }; g.add(mp);
  /* Stufe II: Knochenrippen in der Haut */
  if (lv >= 2) for (const u of [0.3, 0.5, 0.7]) { const bx = (u - 0.5) * 2 * xo * 0.92, a = u < 0.5 ? L.getPointAt(u * 2 * 0.98 + 0.02) : Rr.getPointAt((1 - u) * 2 * 0.98 + 0.02); horn(B, M, [[bx, top(bx, 0) - 0.5, 0.2], [lerp(bx, a.x, 0.5), lerp(top(bx, 0), a.y, 0.5), -0.5], [a.x * 0.97, a.y - 0.6, 0.2]], 0.6, 0.35, { sym: false, rad: 5, seg: 8 }); }
  /* Stufe III: äußere Hauer, Säuredrüsen */
  if (lv >= 3) for (const sg of [-1, 1]) { const x0 = sg * R * 0.8; horn(B, M, [[x0, top(x0, 0) - 1, -2], [x0 * 1.02, 6, -2.5], [x0 * 0.92, 11, -2]], 1.4, 0.1, { sym: false, rad: 7, seg: 10 }); horn(B, M, [[x0 * 0.95, top(x0, 0) - 1, 2.5], [x0, 5, 3], [x0 * 0.9, 9, 2.5]], 1.1, 0.1, { sym: false, rad: 7, seg: 10 }); }
  B.flush(g);
  if (lv >= 3) for (const sg of [-1, 1]) { sacAt(g, s.nutr, V(sg * (xo - 3.5), top(sg * xo, 0) + 2.2, -3), 1.6, [1, 0.85, 1.2], 0.08, 1.4 + sg * 0.2, 10); g.add(tentacle(M, V(sg * xo * 0.9, top(sg * xo, 0) + 1, 2), [[sg * xo * 0.9, top(sg * xo, 0) + 1, 2], [sg * xo * 0.7, 4, 5], [sg * xo * 0.45, 3.5, 7]], 0.9, { amp: 0.2, speed: 0.7, phase: sg, tip: s.teamSoft, tipR: 0.6, seg: 10, rad: 6 })); }
  /* Emitterblase am Scheitel */
  const er = 2.2 + lv * 0.35, ep = V(0, H + 0.2, 0.4);
  const sc = sacAt(g, s.nutr, ep, er, [1, 1.2, 1], 0.1, 1.8, 14); const k = mesh(sphG(10, 7), s.teamSoft, false); k.scale.setScalar(er * 0.4); sc.add(k);
  return g;
});

/* ===================================================================== SINNESKNOSPE (Frühwarnstation) */
/* Ein riesiges Auge auf einem dicken, geringelten Fleischstiel, unter einer Chitinhaube mit Lidwulst; das Auge sucht
   langsam den Horizont ab (schwenkt um Y). Um den Fuß stehen Hörsegel – Knochenfächer mit geäderter Haut –, die sich
   leicht wiegen. Klar anders als der Pheromonknoten (dünner Stiel mit Fühlerfedern): ein großes Auge mit Segeln.
   Stufen: I Auge, zwei Hörsegel; II drei Segel, drei kleine Augenstiele am Fuß, Dornen auf der Haube; III vier Segel,
   sechs Augenstiele, Nebenauge am Stiel, Leuchtblasen am Fuß. Eigenes Modell statt des allgemeinen aus extra22.js. */
registerB('brood', 'radar', (M, d, lv) => {
  const R = d.r, g = new THREE.Group(), x = X(M), s = XB(M), B = new Bag(), q = rng(131 + lv);
  const { g: skin, top } = nestSkin(M, R * 0.88, { seed: 133, veins: 7, h: R * 0.07, hb: R * 0.22, nu: 56, petal: [4, 0.18, Math.PI / 4] }); g.add(skin);
  const H = 15 + lv * 1.5, er = 5.2 + lv * 0.5;
  /* Stiel mit Chitinringen */
  const pts = [[0, -0.5, 0], [0.8, H * 0.35, -0.6], [-0.4, H * 0.7, -0.8], [0, H, -0.6]];
  const rf = v => lerp(4.4, 2.6, v) * (1 + 0.08 * Math.pow(Math.max(0, Math.sin(v * Math.PI * 8)), 2)) * (1 + 0.8 * sm(0.9, 1, 1 - v));
  B.add(sweep(pts, rf, 14, 26, 0.55, 1.0, 6).build(), x.flesh, I0);
  const c = new THREE.CatmullRomCurve3(pts.map(p => V(...p))), tor = cg('band', () => { const t = new THREE.TorusGeometry(1, 0.2, 6, 16); t.rotateX(Math.PI / 2); return addColor(t, () => [1.25, 1.0, 1.25]); });
  for (const v of [0.3, 0.55, 0.78]) { const p = c.getPointAt(v); B.add(tor, x.chitin, place(p, c.getTangentAt(v), null, rf(v) * 1.08, rf(v) * 1.4, rf(v) * 1.08)); }
  if (lv >= 3) eye(B, M, c.getPointAt(0.45).add(V(rf(0.45) * 0.9, 0, 0.6)), V(1, 0.3, 0.4).normalize(), 1.1, false, false);
  /* Hörsegel um den Fuß */
  const nS = lv + 1;
  for (let i = 0; i < nS; i++) {
    const a = [-Math.PI / 4, -Math.PI * 3 / 4, Math.PI / 4, Math.PI * 3 / 4][i], o = ring(a, 1), sd = V(-o.z, 0, o.x), r0 = ring(a, 6.5);   /* erst die hinteren Lappen, dann die vorderen */ r0.y = top(r0.x, r0.z) - 0.3;
    const L = 11 + lv * 1.5, st = [-0.6, 0, 0.6].map(k => { const dir = o.clone().multiplyScalar(1.1).add(V(0, 1, 0)).addScaledVector(sd, k).normalize(); return [r0.toArray(), r0.clone().addScaledVector(dir, L * 0.55).add(V(0, 0.6, 0)).toArray(), r0.clone().addScaledVector(dir, L).toArray()]; });
    g.add(membrane(M, st, { r: 0.35, nv: 6, nu: 5, seg: 8, rad: 5, sag: 0.2, tips: s.teamSoft, tipR: 0.45, sway: { axis: 'y', amp: 0.12, speed: 0.6, phase: i * 1.7 } }));
  }
  B.flush(g);
  /* Auge unter der Haube, schwenkt suchend */
  const head = new THREE.Group(); head.position.set(...c.getPointAt(1).toArray()); head.position.y += er * 0.55; g.add(head);
  const look = new THREE.Group(); look.rotation.x = -0.35; head.add(look);
  /* großes Auge: feiner aufgelöst als eyeball(), Iris und Pupille mit Abstand (kein Durchstechen) */
  B2(look, b => { b.add(sphG(22, 16), s.shell, T(0, 0, 0, er)); const cap = (k, th, n) => cg('bcap' + k, () => { const c = new THREE.SphereGeometry(1, n, 6, 0, TAU, 0, th); c.rotateX(Math.PI / 2); return addColor(c, () => 1); }); b.add(cap('i', 0.7, 24), x.acid, T(0, 0, 0, er * 1.035)); b.add(cap('p', 0.28, 16), x.socket, T(0, 0, 0, er * 1.06)); });
  const HB = new Bag();
  HB.add(domeG(), x.chitin, T(0, er * 0.15, -er * 0.25, er * 1.18, er * 1.0, er * 1.22));
  HB.add(cg('lid', () => { const t = new THREE.TorusGeometry(1, 0.16, 6, 20, Math.PI); addColor(t, () => [1.2, 0.95, 1.2]); return t; }), x.flesh, T(0, er * 0.08, er * 0.62, er * 0.95, er * 0.95, er * 0.6));
  if (lv >= 2) for (let i = 0; i < 3; i++) spike(HB, M, V(0, er * (1.05 - i * 0.12), -er * (0.15 + i * 0.4)), V(0, 1, -0.8), er * (0.55 - i * 0.08), er * 0.11, false);
  for (const sg of [-1, 1]) spike(HB, M, V(sg * er * 1.05, er * 0.2, -er * 0.4), V(sg, 0.3, -0.5), er * 0.5, er * 0.1, false);
  HB.flush(look);
  head.userData.sway = { axis: 'y', amp: 0.7, speed: 0.22, phase: 0, base: 0 };
  /* Augenstiele und Leuchtblasen am Fuß */
  const nE = [0, 3, 6][lv - 1];
  for (let i = 0; i < nE; i++) { const a = i / nE * TAU + 0.5, p = ring(a, 11 + (i % 2) * 2); p.y = top(p.x, p.z) - 0.2; g.add(eyeStalk(M, p, a, 5.5 + (i % 2), 1.4, i * 0.9)); }
  if (lv >= 3) for (const a of [1.2, 3.3, 5.4]) { const p = ring(a, 7.5); p.y = top(p.x, p.z) + 1.2; sacAt(g, s.nutr, p, 1.5, [1, 0.85, 1.1], 0.08, 1.2 + a * 0.1, 10); }
  return g;
});
