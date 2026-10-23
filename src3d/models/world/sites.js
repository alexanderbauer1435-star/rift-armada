/* =====================================================================
   ERBAUER-STÄTTEN UND SPRUNGTORE – Bauwerke der verschwundenen Erbauer auf der Karte (map.js SITE_DEF, gates).
   Formensprache wie Wächter-Schiffe (factions/guardian.js) und Siegel (stations/seal.js): geschliffener grüngrauer
   Stein mit Fasen, eingeschnittene Glyphenfugen, die mintgrün glühen, schwebende Ringe, Augen, Obelisken.
   Jede Stätte: Mitte im Ursprung, oben +Y, Grundfläche im Kreis mit Radius o.r. M = mats('guardian'), M.trim ist beim
   Sprungtor die Spielerfarbe der Emitter.
     ruin     – zerbrochene Plattform mit Relikten (o.scanned: erloschen), Trümmerlage je o.seed
     citadel  – Festung: sechs Bastionen im Kranz, Mauer, drehender Glyphenring, Trommel mit Kuppel, Auge im Oculus
     archive  – Wissensspeicher: Scheibe mit acht Spitzen, Glaskugel mit Astrolabium-Ringen, Kern
     warden   – Sockel des schlafenden Wächters: zehneckige Platte mit Schacht, Leitungen, Ring, vier Klammern;
                leere Group mit userData.berth = { len: 120 } in der Mitte (dort liegt das Schiff »warden«)
     forge    – Sternenschmiede: vier Schmiedearme mit Düsen, gefesseltes Sternfragment (warm), drehende Ringe
     gate     – Sprungtor: Ring mit acht Emittern, drehendes Glyphenband, Wirbel; Zustände siehe dort
   Alle Geometrien werden zwischengespeichert (geo), Materialien je M (wm). Animation nur ruhig: langsame Ringe,
   sanftes Pulsen (Gruppen mit userData.pulse, damit die Maße der Teile erhalten bleiben).
   ===================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { registerW, mesh, at, rng, hull, setCharge } from '../kit.js';
import { gm, band, lineRing, eye, halo, limb, limbLine, glathe, geo } from '../factions/guardian.js';
import { flat, obelisk, sm } from '../stations/seal.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------ Helfer */
/* Drehkörper um Y mit harten Kanten (soft: weich), eigener Texturwiederholung (su rundum, sv Profil) und wahlweise
   Teilumfang. Profil [[r, y], …] so, dass die Außenseite links der Laufrichtung liegt (Normale = (dy, −dr)). */
function rev(key, prof, mat, seg = 64, su = 4, sv = 1, o = {}) {
  const g = geo('srev|' + key, () => {
    const pts = []; prof.forEach(([r, y], i) => { const v = new THREE.Vector2(Math.max(r, 0.001), y); pts.push(v); if (!o.soft && i > 0 && i < prof.length - 1) pts.push(v.clone()); });
    const l = new THREE.LatheGeometry(pts, seg, o.phi0 || 0, o.phiLen || TAU), uv = l.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return l;
  });
  return mesh(g, mat);
}
/* gefaster Steinblock (zwischengespeichert je Maß); uvk = Texturmaßstab */
function slab(w, h, d, mat, f = Math.min(w, h, d) * 0.18, uvk = 1) {
  return mesh(geo(`sslab|${w}|${h}|${d}|${f}|${uvk}`, () => { const b = new RoundedBoxGeometry(w, h, d, 1, f), uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvk, uv.getY(i) * uvk); return b; }), mat);
}
/* einfacher Block ohne Fase (12 Dreiecke) für Zinnen und Kleinteile */
function blk(w, h, d, mat) { return mesh(geo(`sblk|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat); }
/* Teilring (Band um Z) über den Winkel arc, wie band() */
function arcBand(R, w, t, mat, seg, arc) {
  return mesh(geo(`sarc|${R}|${w}|${t}|${seg}|${arc}`, () => new THREE.LatheGeometry([new THREE.Vector2(R - t, -w / 2), new THREE.Vector2(R + t * 0.6, -w / 2), new THREE.Vector2(R + t, -w * 0.3), new THREE.Vector2(R + t, w * 0.3), new THREE.Vector2(R + t * 0.6, w / 2), new THREE.Vector2(R - t, w / 2), new THREE.Vector2(R - t, -w / 2)], seg, 0, arc).rotateX(Math.PI / 2)), mat);
}
/* Leuchtfuge als Teilkreis in der XZ-Ebene */
function arcLine(mat, R, t, seg, arc) { return mesh(geo(`sarcl|${R}|${t}|${seg}|${arc}`, () => new THREE.TorusGeometry(R, t, 3, seg, arc).rotateX(Math.PI / 2)), mat, false); }
/* flache Platte aus einer Umrissform (XZ-Ebene), Fase rundum, Oberkante bei y = top; Welt-UV (Material wide) */
function plate(key, shape, depth, bevel, top, mat, curveSeg = 48) {
  return mesh(geo('splate|' + key, () => { const x = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: curveSeg }); x.rotateX(Math.PI / 2); x.translate(0, top - bevel, 0); return x; }), mat);
}
/* kleiner Leuchtkristall (Oktaeder), gestreckt */
function gem(mat, s, sy = 1.7) { const m = mesh(geo('sgem', () => new THREE.OctahedronGeometry(1, 0)), mat, false); m.scale.set(s, s * sy, s); return m; }
/* Hülle mit sanftem Pulsen um die eigene Mitte (animate skaliert die Gruppe, nicht das Teil) */
function pulsed(o, amp, speed) { const g = new THREE.Group(); g.userData.pulse = { amp, speed }; g.add(o); return g; }
/* Glyphenplatte auf einer Fläche: erhabene Steinplatte mit Leuchtfuge, längs +Z */
function glyphSlab(G, w, d, mat = G.stone) { const g = new THREE.Group(); g.add(slab(w, 1.4, d, mat, 0.4, 0.6)); g.add(at(mesh(geo(`sgl|${d}`, () => new THREE.BoxGeometry(0.32, 0.3, d * 0.7)), G.line, false), 0, 0.75, 0)); return g; }
/* Scheibe (Einheitskreis, flach in XZ) für Wirbel */
const DISC = () => geo('sdisc', () => new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2));
/* drehender Glyphenring in der XZ-Ebene: Steinband, zwei Fugen, n Knoten (dunkle Steine, jeder every-te leuchtend) */
function glyphRing(G, R, w, t, n, speed, seg = 72, every = 2) {
  const s = new THREE.Group(); s.userData.spin = { axis: 'y', speed };
  s.add(flat(band(R, w, t, G.stoneRing, seg))); s.add(flat(lineRing(G, R - t - 0.1, 0.12, seg))); s.add(flat(lineRing(G, R + t + 0.1, 0.12, seg)));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, x = Math.cos(a) * (R + t + 0.3), z = Math.sin(a) * (R + t + 0.3);
    if (i % every) { const b = blk(1.4, Math.round(w * 15) / 10, 1.1, G.stoneDark); b.position.set(x, 0, z); b.rotation.y = -a; s.add(b); }
    else { const e = gem(G.iris, w * 0.32, 1.5); e.position.set(x, 0, z); s.add(e); }
  }
  return s;
}
/* sparsames Auge (für Nebenaugen): Fassung, Linse, Iris mit Pupille, Lichthof – blickt +Z */
function eyeLite(G, r) {
  const g = new THREE.Group();
  g.add(at(band(r * 1.06, r * 0.4, r * 0.1, G.stoneDark, 24), 0, 0, r * 0.3));
  const b = mesh(geo('seyeBall', () => new THREE.SphereGeometry(1, 14, 9)), G.lens); b.scale.setScalar(r); g.add(b);
  const ir = new THREE.Group(); ir.position.z = r * 0.86; ir.scale.setScalar(r); ir.userData.pulse = { amp: 0.05, speed: 1.4, base: r };
  ir.add(mesh(geo('seyeIris', () => new THREE.TorusGeometry(0.5, 0.07, 5, 24)), G.iris, false));
  const pu = mesh(geo('seyePupil', () => new THREE.SphereGeometry(1, 8, 6)), G.iris, false); pu.scale.set(0.22, 0.22, 0.1); pu.position.z = 0.1; ir.add(pu);
  g.add(ir); g.add(at(halo(G, r * 3.5), 0, 0, r * 1.05));
  return g;
}

/* ------------------------------------------------------------ Materialien */
const WM = new WeakMap();
function wm(M) {
  let W = WM.get(M); if (W) return W;
  const G = gm(M), S = sm(M), C = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const dimmed = (m, k) => { const d = m.clone(); d.emissiveIntensity = k; return d; };
  /* Stein mit weiter Texturwiederholung für große Flächen mit Welt-UV (Extrusionen) */
  const wide = G.stoneFlat.clone(); for (const k of ['map', 'bumpMap', 'emissiveMap']) { wide[k] = G.stoneFlat[k].clone(); wide[k].repeat.set(0.022, 0.022); wide[k].needsUpdate = true; } wide.emissiveIntensity = 0.8;
  const vortex = (col, k) => { const m = S.vortex.clone(); m.color = C(col, k); return m; };
  const sprite = (src, col, k, op = 1) => { const m = src.clone(); m.color = C(col, k); m.opacity = op; return m; };
  W = {
    G, S, wide,
    /* Ruine: Glyphen glimmen nur noch (dim) oder sind erloschen (dead); dead auch für das tote Tor */
    dim: { stone: dimmed(G.stone, 0.4), stoneDark: dimmed(G.stoneDark, 0.3), flat: dimmed(wide, 0.35), line: new THREE.MeshBasicMaterial({ color: C('#6fa88a', 0.55) }), iris: G.iris },
    dead: { stone: dimmed(G.stone, 0.08), stoneDark: dimmed(G.stoneDark, 0.06), flat: dimmed(wide, 0.07), ring: dimmed(G.stoneRing, 0.1), line: new THREE.MeshBasicMaterial({ color: C('#2e3d36', 0.7) }), iris: new THREE.MeshStandardMaterial({ color: '#223029', metalness: 0.6, roughness: 0.4 }) },
    /* Archiv: Erbauerglas */
    glass: new THREE.MeshStandardMaterial({ color: '#bfead6', metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.3, emissive: '#1f6e4a', emissiveIntensity: 0.2, depthWrite: false }),
    /* Schmiede: Sternfragment warm, Koronen, Hitzeglühen */
    star: new THREE.MeshBasicMaterial({ color: C('#fff0cc', 1.35) }),
    heat: new THREE.MeshBasicMaterial({ color: C('#ff9a4a', 1.5) }),
    coronaW: sprite(G.halo, '#fff0d0', 0.8), corona: sprite(G.halo, '#ff9a40', 0.9, 0.6),
    glowCone: new THREE.MeshBasicMaterial({ map: G.halo.map, color: C('#ffb060', 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    /* Tor: Wirbel je Betriebsart, Emitter je Zustand, Ladering der Lanze */
    vortexB: S.vortex, vortexB2: S.vortex2,
    vortexF: vortex('#9ff0c0', 0.3), vortexF2: vortex('#c8fff0', 0.18),
    vortexA: vortex('#ffc46a', 1.0), vortexA2: vortex('#ffe6b8', 0.55),
    vortexR: vortex('#ff7446', 1.05), vortexR2: vortex('#ffb28e', 0.55),
    haloA: sprite(G.halo, '#ffc46a', 0.8), haloR: sprite(G.halo, '#ff7a46', 0.9),
    emitOn: dimmed(M.trim, 0.9), emitDim: new THREE.MeshStandardMaterial({ color: '#1a2622', metalness: 0.6, roughness: 0.4, emissive: '#9ff0c0', emissiveIntensity: 0.4 }), emitDead: G.deep,
    lanceSeg: new THREE.MeshBasicMaterial({ color: C('#ff8a5a', 2.0) }), lanceCore: new THREE.MeshBasicMaterial({ color: C('#ffd0b0', 1.6) })
  };
  WM.set(M, W); return W;
}

/* ======================================================================== RUINE
   Zerbrochene Erbauer-Plattform: ein großes und ein kleines, abgesacktes Bruchstück der alten Scheibe mit gezackten
   Bruchkanten, lose Trümmerplatten, ein halber Glyphenring, ein stehender, ein gestürzter und ein abgebrochener
   Obelisk. Ungescannt pulsieren drei Relikte (Leuchtpunkte) und die Glyphen glimmen schwach; gescannt ist alles
   erloschen. Trümmerlage je o.seed. */
registerW('ruin', (M, o) => {
  const W = wm(M), G = W.G, P = o.scanned ? W.dead : W.dim, seed = o.seed || 1, r = rng(seed * 7919 + 12345), g = new THREE.Group();
  r(); r(); r();
  const a0 = r() * TAU, arc = TAU * (0.4 + r() * 0.1), key = seed + '|' + (o.scanned ? 1 : 0);
  /* Bruchstück: Tortenstück mit erodiertem Rand und gezackten Bruchkanten (Form im Weltmaß, Fase rundum) */
  const fragment = (R, a, len, ri) => {
    const sh = new THREE.Shape(), N = Math.max(6, Math.round(len * 8));
    for (let i = 0; i <= N; i++) { const t = i / N, rr = R - (i > 0 && i < N ? r() * 2.2 : 0); sh[i ? 'lineTo' : 'moveTo'](Math.cos(a + len * t) * rr, Math.sin(a + len * t) * rr); }
    for (let k = 1; k <= 5; k++) { const t = k / 6, rr = R - t * (R - ri), aa = a + len + (r() - 0.4) * 0.22; sh.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
    for (let i = 0; i <= 5; i++) { const aa = a + len - len * i / 5; sh.lineTo(Math.cos(aa) * ri, Math.sin(aa) * ri); }
    for (let k = 1; k < 5; k++) { const t = k / 5, rr = ri + t * (R - ri), aa = a - (r() - 0.4) * 0.22; sh.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
    sh.closePath(); return sh;
  };
  g.add(plate('ruinA|' + key, fragment(30, a0, arc, 5), 6, 1.4, 2.2, P.flat, 6));
  const a1 = a0 + arc + 0.45 + r() * 0.3, len1 = 0.9 + r() * 0.5;
  const fb = plate('ruinB|' + key, fragment(29, a1, len1, 13), 6, 1.4, 2.2, P.flat, 6); fb.position.y = -2.2; fb.rotation.set(Math.cos(a1 + len1 / 2) * 0.1, 0, -Math.sin(a1 + len1 / 2) * 0.1); fb.position.x = Math.cos(a1 + len1 / 2) * 2.5; fb.position.z = Math.sin(a1 + len1 / 2) * 2.5; g.add(fb);
  /* abgebrochener Sockelstumpf darunter */
  g.add(rev('ruinKeel', [[0, -13], [9, -10], [17, -6.5], [21, -4], [0, -4]], P.stoneDark, 24, 2, 1));
  /* halber Glyphenring am Rand des großen Stücks, leicht gekippt; dazu ein Stück Leuchtfuge */
  const ring = new THREE.Group(); ring.position.y = 4.2; ring.rotation.set(0.05, -(a0 + 0.1), 0.04);
  ring.add(flat(arcBand(23, 2.4, 1.2, P.stone, 40, arc - 0.35))); ring.add(at(arcLine(P.line, 24.4, 0.14, 40, arc * 0.55), 0, 0.4, 0));
  g.add(ring);
  /* Obelisken: stehend (am Rand), abgebrochener Stumpf, gestürzt quer über den Trümmern */
  const pal = { stone: P.stone, stoneDark: P.stoneDark, line: P.line, iris: P.iris };
  const am = a0 + arc * 0.28; const ob = obelisk(pal, 17, 3.2); ob.position.set(Math.cos(am) * 20, 2.2, Math.sin(am) * 20); ob.rotation.set(0.06, -am, -0.05); g.add(ob);
  const as = a0 + arc * 0.76; const st = mesh(geo('ruinStump', () => { const c = new THREE.CylinderGeometry(3.3, 3.9, 9, 4, 1).rotateY(Math.PI / 4).translate(0, 4.5, 0), p = c.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 8.9) p.setY(i, 6.5 + Math.sin(p.getX(i) * 1.7 + p.getZ(i) * 0.9) * 2.2); c.computeVertexNormals(); return c; }), P.stone);
  st.position.set(Math.cos(as) * 20, 2.2, Math.sin(as) * 20); st.rotation.y = -as; g.add(st);
  g.add(at(mesh(geo('ruinFoot', () => new THREE.CylinderGeometry(4.6, 5.4, 2.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0)), P.stoneDark), st.position.x, 2.2, st.position.z, 0, -as, 0));
  g.add(at(limbLine(P, [st.position.x, 3.5, st.position.z], [st.position.x, 7.5, st.position.z], 0.14), 0, 0, 0));
  const af = a1 + len1 / 2; const fo = obelisk(pal, 14, 2.8); fo.position.set(Math.cos(af) * 10, 0.4, Math.sin(af) * 10); fo.rotation.set(0, -af - 0.5, Math.PI / 2 - 0.12); g.add(fo);
  /* Trümmerplatten auf der fehlenden Seite, schräg und halb versunken, zwei mit Restglimmen */
  for (let i = 0; i < 7; i++) {
    const a = a0 + arc + 0.2 + (TAU - arc - 0.4) * r(), d = 8 + r() * 20, w = 6 + r() * 9, dd = 5 + r() * 7;
    const s = slab(Math.round(w), 2.2, Math.round(dd), i % 3 === 0 ? P.stoneDark : P.stone, 0.5, 0.5);
    s.position.set(Math.cos(a) * d, -1.4 + r() * 2, Math.sin(a) * d); s.rotation.set((r() - 0.5) * 0.6, r() * TAU, (r() - 0.5) * 0.6); g.add(s);
    if (i < 2) { const l = mesh(geo('ruinSlabL', () => new THREE.BoxGeometry(0.3, 0.3, 4)), P.line, false); l.position.set(0, 1.2, 0.5); s.add(l); }
  }
  /* kleine Brocken */
  for (let i = 0; i < 8; i++) { const a = r() * TAU, d = 6 + r() * 25, b = mesh(geo('ruinBit', () => new THREE.OctahedronGeometry(1, 0)), P.stoneDark); b.scale.set(1 + r() * 1.6, 0.8 + r(), 1 + r() * 2.2); b.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); b.rotation.set(r(), r() * TAU, r()); g.add(b); }
  /* Relikte: drei Leuchtpunkte in Steinfassungen auf dem großen Stück (ungescannt pulsierend, gescannt dunkel) */
  for (let i = 0; i < 3; i++) {
    const a = a0 + arc * (0.15 + i * 0.33), d = 11 + (i % 2) * 5, x = Math.cos(a) * d, z = Math.sin(a) * d;
    g.add(at(mesh(geo('ruinSock', () => new THREE.CylinderGeometry(1.8, 2.2, 1.2, 8).translate(0, 0.6, 0)), P.stoneDark), x, 2.2, z));
    const e = gem(P.iris, 0.9, 1.6); g.add(at(o.scanned ? e : pulsed(e, 0.22, 1.1 + i * 0.25), x, 4.3, z));
    if (!o.scanned) g.add(at(halo(G, 7), x, 4.5, z));
  }
  return g;
});

/* ======================================================================== ZITADELLE
   Festung der Erbauer: runde Plattform mit Kiel, sechs zwölfeckige Bastionen im Kranz (drei mit Wachauge, drei mit
   Schießscharten), Zinnen, Haube und Spitzobelisk auf jeder, Ringmauer, Strebebögen zur zentralen Trommel mit
   Fensterkranz, Kuppel mit Rippen und Oculus, darin das Auge; darüber schwebt ein drehender Glyphenring. */
registerW('citadel', M => {
  const W = wm(M), G = W.G, g = new THREE.Group();
  g.add(rev('citPlat', [[0, -9], [52, -11], [66, -7], [70, -2], [70, 2], [68, 4], [0, 4]], G.stoneBig, 72, 5, 1));
  g.add(rev('citKeel', [[0, -36], [14, -32], [30, -24], [46, -15], [52, -11], [0, -11]], G.stoneDark, 36, 4, 1));
  g.add(at(pulsed(gem(G.iris, 2.4, 1.8), 0.07, 0.8), 0, -38, 0)); g.add(at(halo(G, 16), 0, -38, 0));
  g.add(at(flat(lineRing(G, 68.6, 0.26, 72)), 0, 3.1, 0));
  g.add(at(flat(lineRing(G, 36.4, 0.22, 48)), 0, -22, 0));
  /* Ringmauer mit Fuge, dahinter die Stufe zur Trommel */
  g.add(at(flat(band(52, 6, 2.2, G.stoneRing, 72)), 0, 7, 0)); g.add(at(flat(lineRing(G, 54.3, 0.14, 72)), 0, 7.5, 0));
  g.add(rev('citStep', [[0, 4], [38, 4], [40, 7], [37, 9.5], [0, 9.5]], G.stone, 56, 4, 0.4));
  g.add(at(flat(lineRing(G, 38.4, 0.18, 56)), 0, 8.2, 0));
  /* Trommel: Fensterkranz aus 16 Leuchtschlitzen, Fugen oben und unten */
  g.add(rev('citDrum', [[0, 9.5], [29, 9.5], [30, 12.5], [30, 30], [28, 33.5], [0, 33.5]], G.stoneBig, 48, 4, 1));
  for (const y of [12.8, 30]) g.add(at(flat(lineRing(G, 30.3, 0.16, 48)), 0, y, 0));
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, w = mesh(geo('citWin', () => new THREE.BoxGeometry(1.1, 7.5, 0.7)), G.line, false); w.position.set(Math.cos(a) * 30.2, 21, Math.sin(a) * 30.2); w.rotation.y = -a; g.add(w); }
  /* Kuppel mit acht Steinrippen und Oculus, darin das Auge, nach oben blickend */
  g.add(rev('citDome', [[28, 33.5], [27.2, 38], [23.5, 44], [17, 49], [10, 52.5], [0, 53.5]], G.stone, 48, 4, 0.8, { soft: true }));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8, c = Math.cos(a), s = Math.sin(a); g.add(limb(G, [c * 28.6, 33, s * 28.6], [c * 10.6, 52.4, s * 10.6], 2.4, 2.4, G.stoneDark)); }
  g.add(at(flat(band(10, 3.2, 1.6, G.stoneRing, 40)), 0, 53, 0)); g.add(at(flat(lineRing(G, 11.7, 0.14, 40)), 0, 53.6, 0));
  const ey = eye(G, 6.2); ey.position.y = 50.5; ey.rotation.x = -Math.PI / 2; g.add(ey);
  /* schwebender Glyphenring über der Kuppel, mit zwölf Steinen */
  const ring = glyphRing(G, 44, 3.2, 1.5, 12, 0.06, 72, 3); ring.position.y = 42; g.add(ring);
  /* sechs Bastionen: zwölfeckiger Turm, Zinnen, dunkle Haube mit Glutfuge, Spitzobelisk; abwechselnd Wachauge/Scharten */
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6, p = new THREE.Group(); p.rotation.y = -a; p.position.y = 4;
    const b = new THREE.Group(); b.position.x = 53;
    b.add(rev('citBast', [[0, 0], [12.5, 0], [13.2, 2.5], [12, 5], [11.5, 20], [12.4, 22], [12.4, 24.5], [0, 24.5]], G.stone, 12, 2, 0.6));
    b.add(at(flat(lineRing(G, 12.6, 0.14, 12)), 0, 22.4, 0)); b.add(at(flat(lineRing(G, 12.1, 0.14, 12)), 0, 5, 0));
    for (let k = 0; k < 12; k += 2) { const ka = k / 12 * TAU + Math.PI / 12, m = blk(3, 3.2, 2.4, G.stoneDark); m.position.set(Math.cos(ka) * 11.2, 26, Math.sin(ka) * 11.2); m.rotation.y = -ka; b.add(m); }
    b.add(at(rev('citCap', [[8.8, 0], [8.2, 2], [6.2, 4], [3.2, 5.3], [0, 5.6]], G.stoneDark, 24, 2, 0.5, { soft: true }), 0, 24.4, 0));
    b.add(at(flat(lineRing(G, 8.5, 0.12, 24)), 0, 25.2, 0));
    const sp = obelisk(G, 11, 2.2); sp.position.y = 29.6; b.add(sp);
    if (i % 2 === 0) { const e = eyeLite(G, 3); e.position.set(11.6, 13.5, 0); e.rotation.set(-0.2, Math.PI / 2, 0); b.add(e); }
    else for (const k of [-1, 0, 1]) { const w = mesh(geo('citSlit', () => new THREE.BoxGeometry(0.7, 5, 1)), G.line, false); w.position.set(12.3, 13.5, k * 3.6); b.add(w); }
    /* Glyphenfuge außen am Turm und ein Strebebogen zur Trommel */
    b.add(limbLine(G, [12.6, 3, 4.5], [11.9, 19, 4.5], 0.16));
    p.add(b);
    p.add(limb(G, [30, 24, 0], [42, 20.5, 0], 2.6, 2.6, G.stoneDark)); p.add(limbLine(G, [30.5, 25.6, 0], [41.5, 22.2, 0], 0.16));
    /* Glyphenplatte auf dem Vorhof zwischen den Bastionen */
    const q = new THREE.Group(); q.rotation.y = -(a + Math.PI / 6); q.add(at(glyphSlab(G, 9, 14), 61, 0.7, 0, 0, Math.PI / 2, 0)); p.add(q);
    g.add(p);
  }
  return g;
});

/* ======================================================================== ARCHIV
   Wissensspeicher: flache Scheibe mit acht Steindornen am Rand (Leuchtkante, Kristall an der Spitze), dazwischen
   Lesepulte und Radialfugen; in der Mitte auf einem Sockel die Kugel aus Erbauerglas mit dem Kern und zwei inneren
   Ringen, außen drei kreisende Glyphenringe in verschiedenen Neigungen wie ein Astrolabium. */
registerW('archive', M => {
  const W = wm(M), G = W.G, g = new THREE.Group();
  g.add(rev('arcPlat', [[0, -7], [44, -9], [56, -5], [58, -1], [58, 2], [56, 4], [0, 4]], G.stoneBig, 96, 5, 1));
  g.add(rev('arcKeel', [[0, -28], [12, -24], [30, -16], [44, -9], [0, -9]], G.stoneDark, 48, 4, 1));
  g.add(at(pulsed(gem(G.iris, 1.8, 1.8), 0.07, 0.9), 0, -29.5, 0)); g.add(at(halo(G, 12), 0, -29.5, 0));
  g.add(at(flat(lineRing(G, 56.6, 0.24, 96)), 0, 3.1, 0)); g.add(at(flat(lineRing(G, 22, 0.18, 64)), 0, 4.2, 0)); g.add(at(flat(lineRing(G, 38, 0.18, 96)), 0, 4.2, 0));
  /* acht Spitzen: geschwungene Steinklingen am Rand, nach außen und oben, Leuchtkante und Kristall an der Spitze */
  const FIN = geo('arcFin', () => { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(14, 0), new THREE.Vector2(19.5, 4), new THREE.Vector2(16, 9), new THREE.Vector2(9, 17), new THREE.Vector2(4, 11), new THREE.Vector2(2, 4)]); const x = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.5, bevelSegments: 2 }); x.translate(0, 0, -1.3); return x; });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, p = new THREE.Group(); p.rotation.y = -a; p.position.y = 4;
    p.add(at(slab(16, 2.4, 7, G.stoneDark, 0.6, 0.6), 50, 1.2, 0));
    const fin = mesh(FIN, G.stoneFlat); fin.position.set(42.5, 1.8, 0); p.add(fin);
    p.add(limbLine(G, [61.5, 6.2, 0], [52.5, 18.4, 0], 0.16)); p.add(limbLine(G, [44.5, 4.5, 0], [61.2, 5.8, 0], 0.14));
    p.add(at(pulsed(gem(G.iris, 0.8, 1.6), 0.1, 1.3 + i * 0.1), 51.5, 19.8, 0, 0, 0, 0.6)); p.add(at(halo(G, 6), 51.5, 19.8, 0));
    /* Lesepult dazwischen: schräge Glyphentafel auf einem Steinfuß, Radialfuge nach innen */
    const q = new THREE.Group(); q.rotation.y = -(a + Math.PI / 8); q.position.y = 4;
    q.add(at(slab(2.4, 4, 2.4, G.stoneDark, 0.3), 40, 2, 0)); const tab = slab(6, 0.9, 4.4, G.stoneLite, 0.25, 0.5); tab.position.set(40, 4.4, 0); tab.rotation.z = 0.55; q.add(tab);
    q.add(at(mesh(geo('arcTabL', () => new THREE.BoxGeometry(4.2, 0.25, 0.3)), G.line, false), 40.2, 4.95, 0, 0, 0, 0.55));
    q.add(limbLine(G, [23, 0.25, 0], [36, 0.25, 0], 0.14)); q.add(limbLine(G, [44, 0.25, 0], [55, 0.25, 0], 0.14));
    g.add(p); g.add(q);
  }
  /* Sockel mit Fuge, Tragering unter der Kugel, vier Halter */
  g.add(rev('arcPed', [[0, 4], [15, 4], [16.5, 7], [13, 10], [12, 16], [13, 19], [0, 19]], G.stone, 48, 3, 0.6));
  g.add(at(flat(lineRing(G, 13.2, 0.16, 48)), 0, 17.5, 0));
  g.add(at(flat(band(16.8, 2.4, 1.3, G.stoneRing, 64)), 0, 21.5, 0));
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4, c = Math.cos(a), s = Math.sin(a); g.add(limb(G, [c * 12, 18, s * 12], [c * 17, 21.5, s * 17], 1.8, 1.8, G.stoneDark)); }
  /* Glaskugel mit Kern und zwei inneren Wissensringen */
  const sph = mesh(geo('arcSphere', () => new THREE.SphereGeometry(1, 40, 26)), W.glass, false); sph.scale.setScalar(20); sph.position.y = 34; sph.renderOrder = 6; g.add(sph);
  const core = mesh(geo('arcCore', () => new THREE.IcosahedronGeometry(1, 1)), G.iris, false); core.scale.setScalar(4.6); g.add(at(pulsed(core, 0.08, 1.2), 0, 34, 0));
  const ch = halo(G, 24); ch.position.y = 34; ch.renderOrder = 3; g.add(ch);
  for (const [R, tx, tz, sp] of [[9, 0.5, 0.3, 0.5], [13.5, -0.9, 0.6, -0.35]]) { const p = new THREE.Group(); p.position.y = 34; p.rotation.set(tx, 0, tz); const s = new THREE.Group(); s.userData.spin = { axis: 'y', speed: sp }; s.add(flat(lineRing(G, R, 0.2, 48))); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU, e = gem(G.irisSoft, 0.6, 1.4); e.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); s.add(e); } p.add(s); g.add(p); }
  /* Astrolabium: drei Glyphenringe außen, verschieden geneigt und gegenläufig */
  for (const [R, w, t, tx, tz, sp, n] of [[24, 2.2, 1.0, 0.32, 0.1, 0.1, 8], [27.5, 2.0, 0.9, 1.05, 0.6, -0.14, 6], [31, 1.8, 0.8, -0.75, -1.1, 0.08, 6]]) {
    const p = new THREE.Group(); p.position.y = 34; p.rotation.set(tx, 0, tz); p.add(glyphRing(G, R, w, t, n, sp, 72, 2)); g.add(p);
  }
  return g;
});

/* ======================================================================== WÄCHTER-SOCKEL
   Sockel des schlafenden Wächters (Schiff »warden«, Länge 120): zehneckige Platte mit Schacht in der Mitte, in dem die
   Fesselringe der Maschine hängen; Glyphenleitungen, die von den Ecken zur Mitte führen und schwach pulsieren; ein
   Steinring; vier Klammern, die über den Schachtrand greifen. Die Maschine liegt im berth bei y = 20, ihre Ringe reichen
   bis y ≈ −24 in den Schacht (Boden bei −30). */
registerW('warden', M => {
  const W = wm(M), G = W.G, g = new THREE.Group();
  /* Platte: Zehneck mit abwechselnd weiter und naher Ecke, rundes Loch (Schacht) */
  const shape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, R = i % 2 ? 77 : 84; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R, Math.sin(a) * R); } shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 50, 0, TAU, true); shape.holes.push(hole);
  g.add(plate('wdPlat', shape, 11, 2, 2.5, W.wide, 64));
  /* Schacht (Innenwand und Boden), Kiel darunter; am Boden Glyphenkreise und der Energiekern der Wiege */
  g.add(rev('wdPit', [[50, 2.6], [50, -27], [46, -30], [0, -30]], G.stoneDark, 64, 4, 1));
  g.add(rev('wdKeel', [[0, -56], [20, -49], [40, -38], [50, -29], [53, -16], [53, -10.5], [0, -10.5]], G.stoneDark, 48, 4, 1));
  for (const R of [14, 28, 42]) g.add(at(flat(lineRing(G, R, 0.2, 72)), 0, -29.6, 0));
  g.add(at(pulsed(gem(G.iris, 3, 1.4), 0.06, 0.6), 0, -27, 0)); g.add(at(halo(G, 26), 0, -26, 0));
  g.add(at(flat(lineRing(G, 50.6, 0.2, 64)), 0, 2.2, 0));
  /* Steinring auf der Platte mit Fugen und zehn Knoten */
  g.add(at(flat(band(66, 2.6, 1.6, G.stoneRing, 96)), 0, 3.4, 0));
  for (const R of [63.8, 68.3]) g.add(at(flat(lineRing(G, R, 0.14, 96)), 0, 3.2, 0));
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 10, n = slab(3.6, 4.2, 3, G.stoneDark, 0.4); n.position.set(Math.cos(a) * 66, 4.2, Math.sin(a) * 66); n.rotation.y = -a; g.add(n); }
  /* Leitungen: Glyphenbahnen von jeder Ecke zum Schacht, pulsieren schwach (Gruppe skaliert um ihre Mitte) */
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU, c = Math.cos(a), s = Math.sin(a);
    for (const [r0, r1] of i % 2 ? [[52, 62]] : [[52, 62], [70, 80]]) {
      const p = new THREE.Group(); p.position.set(c * (r0 + r1) / 2, 2.75, s * (r0 + r1) / 2); p.rotation.y = -a; p.userData.pulse = { amp: 0.05, speed: 0.6 + (i % 3) * 0.2 };
      p.add(mesh(geo(`wdLine|${r1 - r0}`, () => new THREE.BoxGeometry(r1 - r0, 0.3, 1.1)), G.line, false)); g.add(p);
    }
    if (i % 2 === 0) g.add(at(pulsed(gem(G.irisSoft, 1.1, 1.4), 0.08, 0.7), c * 80, 3.4, s * 80));
    else g.add(at(slab(5, 2.6, 5, G.stoneDark, 0.5), c * 72, 3.6, s * 72, 0, -a, 0));
  }
  /* vier Klammern: Fußblock, Arm über den Schachtrand, Gelenk, Klaue mit Kristall – halten die Maschine */
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, p = new THREE.Group(); p.rotation.y = -a;
    p.add(at(slab(13, 6, 15, G.stoneDark, 1), 73, 5.5, 0));
    p.add(at(glyphSlab(G, 7, 9), 73, 8.7, 0));
    p.add(limb(G, [72, 8, 0], [56, 26, 0], 6, 5)); p.add(limbLine(G, [71, 11.5, 0], [57, 28.8, 0], 0.2));
    p.add(at(mesh(geo('wdElbow', () => new THREE.SphereGeometry(3.6, 16, 10)), G.stoneDark), 56, 26, 0));
    p.add(limb(G, [56, 26, 0], [47.5, 22.5, 0], 3.6, 3)); p.add(limb(G, [56, 26, 0], [50, 30, 0], 2.6, 2.4, G.stoneDark));
    p.add(at(pulsed(gem(G.iris, 1, 1.6), 0.08, 0.9 + i * 0.15), 47, 22.5, 0, 0, 0, Math.PI / 2)); p.add(at(halo(G, 7), 47, 22.5, 0));
    g.add(p);
  }
  /* Liegeplatz der Maschine */
  const berth = new THREE.Group(); berth.position.y = 20; berth.userData.berth = { len: 120 }; g.add(berth);
  return g;
});

/* ======================================================================== STERNENSCHMIEDE
   Vier massive Schmiedearme mit Düsen nach außen (Glutadern, Lüftungsschlitze, glühender Kragen und Mündung), Nabe mit
   Kiel, vier Halter mit zwei festen Fesselreifen um das Sternfragment – ein warm leuchtender, pulsierender Brocken mit
   Korona – sowie zwei gegenläufig drehende Glyphenringe darum. */
registerW('forge', M => {
  const W = wm(M), G = W.G, H = { line: W.heat }, g = new THREE.Group();
  g.add(rev('fgHub', [[0, -8], [30, -10], [36, -5], [36, 3], [33, 6], [0, 6]], G.stoneBig, 72, 4, 1));
  g.add(rev('fgKeel', [[0, -32], [12, -28], [24, -19], [30, -10], [0, -10]], G.stoneDark, 48, 4, 1));
  g.add(at(pulsed(gem(W.heat, 2, 1.8), 0.07, 1), 0, -33.5, 0)); { const h = new THREE.Sprite(W.corona); h.scale.setScalar(14); h.position.y = -33.5; g.add(h); }
  g.add(at(flat(lineRing(G, 34.6, 0.22, 72)), 0, 4.6, 0)); g.add(at(flat(lineRing(G, 20, 0.18, 64)), 0, 6.2, 0));
  /* vier Arme auf den Diagonalen: Steinrumpf, Firstbalken, Glutadern, Schlitze, Kragen, Düsenglocke, Glühkegel */
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4, p = new THREE.Group(); p.rotation.y = -a; const arm = new THREE.Group(); arm.rotation.y = Math.PI / 2; arm.position.y = 8;
    arm.add(hull([[16, 22, 14, 3.5], [28, 24, 16, 4], [44, 19, 13, 3.5], [54, 15, 10.5, 3], [58, 12, 8.5, 2.5]], G.stoneBig));
    arm.add(at(slab(5, 2.2, 24, G.stoneDark, 0.5, 0.7), 0, 8.2, 34)); arm.add(at(glyphSlab(G, 6, 7), 0, 7.9, 21));
    for (const s of [-1, 1]) {
      arm.add(limbLine(H, [s * 6.5, 7.6, 24], [s * 5, 6.4, 50], 0.2));
      for (let k = 0; k < 3; k++) arm.add(at(blk(0.8, 3, 1.4, G.deep), s * 9.6 - s * k * 0.45, 0.5, 40 + k * 3));
    }
    arm.add(at(band(8.6, 4, 1.8, G.stoneDark, 32), 0, 0, 51)); arm.add(at(lineRing(H, 10.5, 0.16, 32), 0, 0, 51));
    arm.add(at(glathe([[6.5, 0], [8.2, 2.5], [10, 5.5], [11, 8]], G.stoneDark, 28), 0, 0, 56));
    const d = mesh(geo('fgDisc', () => new THREE.CircleGeometry(6.2, 24)), W.heat, false); d.position.z = 57; arm.add(d);
    const cone = new THREE.Mesh(geo('fgCone', () => new THREE.CylinderGeometry(7, 2.5, 8, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 4)), W.glowCone); cone.position.z = 58; cone.renderOrder = 2; arm.add(cone);
    const h = new THREE.Sprite(W.corona); h.scale.setScalar(16); h.position.z = 61; arm.add(h);
    p.add(arm); g.add(p);
    /* Glyphenplatte und Halter zwischen den Armen */
    const q = new THREE.Group(); q.rotation.y = -(a + Math.PI / 4);
    q.add(at(glyphSlab(G, 8, 11), 30, 6.7, 0, 0, Math.PI / 2, 0));
    q.add(at(slab(7, 3, 7, G.stoneDark, 0.6), 21, 7.5, 0)); q.add(limb(G, [21, 8, 0], [14.6, 25, 0], 3.2, 3)); q.add(limbLine(G, [22.2, 9.5, 0], [16, 25, 0], 0.16));
    g.add(q);
  }
  /* zwei feste Fesselreifen (stehend, gekreuzt) um das Sternfragment */
  for (const ry of [0, Math.PI / 2]) { const r = band(14, 2, 0.9, G.stoneRing, 48); r.position.y = 26; r.rotation.y = ry; g.add(r); const l = lineRing(G, 15, 0.12, 48); l.position.y = 26; l.rotation.y = ry; g.add(l); }
  /* Sternfragment: warm leuchtender, kantiger Brocken, pulsierend, zwei Koronen (weißwarm, orange) */
  const star = mesh(geo('fgStar', () => new THREE.IcosahedronGeometry(1, 1)), W.star, false); star.scale.set(7.5, 8.5, 7); g.add(at(pulsed(star, 0.05, 1.3), 0, 26, 0));
  const c1 = new THREE.Sprite(W.coronaW); c1.scale.setScalar(26); c1.position.y = 26; g.add(c1);
  const c2 = new THREE.Sprite(W.corona); c2.scale.setScalar(52); c2.position.y = 26; c2.userData.pulse = { amp: 0.06, speed: 0.9, base: 52 }; g.add(c2);
  /* Glyphenringe: innen schneller, außen langsam gegenläufig */
  const r1 = glyphRing(G, 20, 2.2, 1, 6, 0.2, 64, 2); r1.position.y = 26; g.add(r1);
  const r2 = glyphRing(G, 34, 2.6, 1.3, 8, -0.07, 96, 2); r2.position.y = 36; g.add(r2);
  return g;
});

/* ======================================================================== SPRUNGTOR
   Ring aus Stein (Band mit Fugen) mit acht Emitterblöcken, darüber ein drehendes Glyphenband, unten acht Finnen, innen
   das Wirbelfeld aus zwei gegenläufigen Spiralscheiben (wie beim Siegel). Zustände (o.state):
     dead    – dunkel: Stein ohne Glyphenglühen, Fugen erloschen, Emitter aus, Band steht fast still, kein Wirbel
     flicker – schwacher, unruhig pulsierender Wirbel (zwei Scheiben mit verschiedenem Takt), Emitter schwach
     active  – Emitter in Spielerfarbe (M.trim), Band dreht schneller, Wirbel je Betriebsart (o.mode):
               bridge mintgrün · lock bernstein · lance rot-orange mit Ladering (16 Segmente, chargeAt 0…1) und
               Ladekern (userData.charge; setCharge(root, o.charge) skaliert ihn) */
registerW('gate', (M, o) => {
  const W = wm(M), G = W.G, g = new THREE.Group(), state = o.state || 'dead', mode = o.mode || 'bridge', active = state === 'active', dead = state === 'dead';
  const L = dead ? Object.assign({}, G, { line: W.dead.line, iris: W.dead.iris, stoneRing: W.dead.ring, stoneDark: W.dead.stoneDark }) : G;
  const emit = active ? W.emitOn : dead ? W.emitDead : W.emitDim;
  /* Ring mit Fugen innen und außen */
  g.add(flat(band(46, 9, 4.5, L.stoneRing, 96)));
  g.add(at(flat(lineRing(L, 41.3, 0.2, 96)), 0, 2.6, 0)); g.add(at(flat(lineRing(L, 51.2, 0.2, 96)), 0, 0, 0)); g.add(at(flat(lineRing(L, 43, 0.14, 96)), 0, -4.6, 0));
  /* acht Emitterblöcke: Block auf dem Ring, Leuchtplatte oben, Linse zur Mitte, Finne darunter */
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, p = new THREE.Group(); p.rotation.y = -a;
    p.add(at(slab(12, 11, 9, L.stoneDark, 1.2), 50, 0.5, 0));
    p.add(at(slab(6, 1.3, 5, emit, 0.3), 50, 6.6, 0));
    p.add(at(slab(2.2, 5, 4, emit, 0.5), 42.8, 0.5, 0));
    if (active) p.add(at(halo(G, 9), 41.5, 0.5, 0));
    p.add(at(slab(7, 6, 3, L.stoneDark, 0.6), 48, -7.5, 0));
    p.add(limbLine(L, [44.5, -5.2, 0], [55, -5.2, 0], 0.14));
    g.add(p);
  }
  /* Glyphenband über dem Ring: 16 Knoten, dreht je Zustand */
  const speed = dead ? 0.008 : state === 'flicker' ? 0.04 : mode === 'bridge' ? 0.3 : mode === 'lock' ? 0.12 : 0.2;
  const gb = glyphRing(L, 46, 1.6, 1.2, 16, speed, 96, 2); gb.position.y = 5.5; g.add(gb);
  /* Wirbel: zwei gegenläufige Spiralscheiben im Ring, Lichthof darüber */
  if (!dead) {
    const fl = state === 'flicker', [m1, m2] = fl ? [W.vortexF, W.vortexF2] : mode === 'lock' ? [W.vortexA, W.vortexA2] : mode === 'lance' ? [W.vortexR, W.vortexR2] : [W.vortexB, W.vortexB2];
    const v1 = mesh(DISC(), m1, false); v1.scale.setScalar(fl ? 34 : 40); v1.position.y = -1.2; v1.userData.spin = { axis: 'y', speed: active ? -0.5 : -0.25 }; v1.renderOrder = 3; g.add(v1);
    const v2 = mesh(DISC(), m2, false); v2.scale.setScalar(fl ? 25 : 31); v2.position.y = 0.6; v2.rotation.y = 1; v2.userData.spin = { axis: 'y', speed: active ? 0.3 : 0.15 }; v2.renderOrder = 3; g.add(v2);
    if (fl) { v1.userData.pulse = { amp: 0.18, speed: 1.9, base: 34 }; v2.userData.pulse = { amp: 0.14, speed: 2.7, base: 25 }; }
    const vh = new THREE.Sprite((mode === 'lock' && active ? W.haloA : mode === 'lance' && active ? W.haloR : G.halo).clone()); vh.scale.setScalar(active ? 60 : 32); vh.position.y = 1.5; vh.material.opacity = active ? 0.4 : 0.15; g.add(vh);
  }
  /* Lanze: Ladering aus 16 Segmenten (gestaffelt ab Ladung i/16) und Ladekern in der Mitte */
  if (active && mode === 'lance') {
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, s = mesh(geo('gtSeg', () => new THREE.BoxGeometry(6.5, 1.5, 2.2)), W.lanceSeg, false); s.position.set(Math.cos(a) * 56, 5.4, Math.sin(a) * 56); s.rotation.y = -a + Math.PI / 2; s.userData.chargeAt = i / 16; g.add(s); }
    const core = mesh(geo('gtCore', () => new THREE.IcosahedronGeometry(1, 2)), W.lanceCore, false); core.position.y = 2.5; core.userData.charge = true; core.userData.chargeBase = 8; g.add(core);
    const ch = new THREE.Sprite(W.haloR); ch.position.y = 3; ch.userData.charge = true; ch.userData.chargeBase = 46; g.add(ch);
    setCharge(g, o.charge || 0);
  }
  return g;
});
