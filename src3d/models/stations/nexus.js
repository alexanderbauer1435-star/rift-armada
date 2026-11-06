/* =====================================================================
   THE NEXUS – Stationen. Formensprache der abgenommenen Schiffe: nichts ist gebaut, alles ist gewachsen. Facettierte,
   teils durchscheinende Kristalle (violett-weiß), Obsidian als tragender Kristall, helle Lichtkerne, Leuchtkanten,
   schwebende Splitter, Lichtfäden und geometrische Ringe (Dreieck, Sechseck) in Spielerfarbe.
   Jede Station steht auf einem Kristallsockel: Splitterkranz nach außen (leicht abfallend), Sechskant-Scholle mit
   Leuchtkanten, Wurzelkristalle nach unten (die Stationen schweben), schwacher Feldschein. Leuchtanker in Spielerfarbe am
   Sockelrand mit Lichtfäden zur Mitte zeigen, dass die Station am Netz des Kernknotens hängt.
   Darauf wächst je Rolle ein eigener Umriss, der von oben (Spielkamera ~55°) auf einen Blick lesbar bleibt:
     Kernknoten  Säulenkrone um ein Herz im Lichtgitter, waagrechte Ringe (1/2/3), Strahler ab Stufe II
     Wachskammer Rippenkelch längs der Liegestelle, Samenkern am Heck, Tor am Bug
     Verdichter  Trichterblüte mit Wirbelringen und Linsen, Andockzangen für Harvester (1/2/3)
     Resonator   Stimmgabeln aus Kristall um einen hellen Kern, schwingen sanft
     Facettenkammer  Dreikant-Prisma mit Dreiecksringen, Spiegelfacetten kreisen darum
     Kristallwacht  Obsidiansäule mit Strahlerkopf (Prismen brechen den Strahl)
     Hüllenprisma  Facettenkuppel mit Leuchtgitter, Emitterprismen
     Netzknoten  Gitterknoten mit Ringen, Fäden zu Ankern in alle Richtungen, kreisende Lichtpunkte
     Resonanz    Kristallkrone, Resonanzringe und Kronenadern leuchten nacheinander mit der Ladung auf
     Gitterwall  zwei Obelisken mit leuchtendem Wandgitter dazwischen, schwebender Emitter
     Lauschkristall  hoher Stamm mit schräger, drehender Kristallschüssel
   Grundrisse je Rolle verschieden (Sockelform): Kernknoten und Resonanz rund, Wachskammer längliches Sechseck,
   Verdichter Achteck, Resonator Sechseck, Facettenkammer Dreieck, Kristallwacht Raute, Hüllenprisma Zwölfeck,
   Netzknoten drei schwebende Dreiecksschollen, Gitterwall schmales Sechseck, Lauschkristall Fünfeck.
   Stufen fügen sichtbare Teile hinzu (Kristalle, Ringe, schwebende Splitter, hellere Kerne), nicht nur Größe.
   Bewegung ruhig: langsames Drehen und Kreisen, sanftes Pulsieren und Schwingen, kein Blinken.
   Mitte im Ursprung, +Y oben, Grundfläche im Kreis mit Radius d.r.
   ===================================================================== */
import * as THREE from 'three';
import { registerB, rng, mesh, lathe, loft, ngon } from '../kit.js';
import { rim, xm, geo, gem, gemEdges, facetCols, fragGeo, frameGeo, nodesGeo, beam, ring, spinning, core, orbiters, tri } from '../factions/nexus.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180, UPV = [0, 1, 0];
const q = v => Math.round(v * 2) / 2;                          /* Maße runden, damit sich Geometrien im Zwischenspeicher teilen */
const P = (a, d, y = 0) => [Math.cos(a) * d, y, Math.sin(a) * d];   /* Punkt auf Kreis (Winkel a in der XZ-Ebene) */
const unit = d => { const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };
const dirE = (a, e) => [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];   /* Richtung: Winkel a, Höhe e */

/* ------------------------------------------------------------ Lage */
/* lokale +Z-Achse in Richtung d drehen; lokale X-Achse bleibt waagrecht (flache Klingen liegen flach) */
function orient(o, d) { o.rotation.set(-Math.atan2(d[1], Math.hypot(d[0], d[2])), Math.atan2(d[0], d[2]), 0, 'YXZ'); return o; }
function put(o, x, y, z) { o.position.set(x, y, z); return o; }
/* Kristall vom Fuß F aus in Richtung d wachsen lassen (Länge L, Radius r, o = gem-Optionen) */
function grow(L, r, mat, o, F, d, shadow = true) {
  const u = unit(d), m = gem(q(L), q(r), mat, o, shadow);
  m.position.set(F[0] + u[0] * L / 2, F[1] + u[1] * L / 2, F[2] + u[2] * L / 2);
  return orient(m, u);
}
/* passende Leuchtkanten (nur für Kristalle ohne Verdrehung, tw = 0) */
function growEdges(X, L, r, o, F, d, mat, rad, every = 1) {
  const u = unit(d), m = gemEdges(X, q(L), q(r), o, mat, rad, every);
  m.position.set(F[0] + u[0] * L / 2, F[1] + u[1] * L / 2, F[2] + u[2] * L / 2);
  return orient(m, u);
}
/* Oktaeder mit Facettenfarben (für die Kristallmaterialien mit Vertexfarben) */
const octaC = () => geo('octaC', () => facetCols(new THREE.OctahedronGeometry(1, 0), 17, 0.7));
const octaB = () => geo('octa', () => new THREE.OctahedronGeometry(1, 0));
function octa(mat, sx, sy = sx, sz = sx, shadow = true) { const m = mesh(mat.vertexColors ? octaC() : octaB(), mat, shadow); m.scale.set(sx, sy, sz); return m; }
/* waagrechter Ring (liegt in der XZ-Ebene) */
function hring(R, t, mat, n = 48, rs = 3, y = 0) { const r = ring(q(R), q(t), mat, n, rs); r.rotation.x = Math.PI / 2; r.position.y = y; return r; }
/* Halbring (Bogen über der X-Achse, Ebene XY) */
function arch(R, t, mat, seg = 16) { return mesh(geo(`arch|${q(R)}|${q(t)}|${seg}`, () => new THREE.TorusGeometry(q(R), q(t), 4, seg, Math.PI)), mat, false); }
/* kleiner Lichthof als Sprite */
function halo(mat, s) { const h = new THREE.Sprite(mat); h.scale.setScalar(s); return h; }

/* ------------------------------------------------------------ Stationsmaterialien (je Spielerfarbe einmal) */
const SC = new WeakMap();
function sm(M) {
  let S = SC.get(M); if (S) return S;
  const X = xm(M), tc = M.trim.color, add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const ground = X.field.clone(); ground.color = new THREE.Color('#7c4cff').multiplyScalar(0.4);
  S = {
    team: new THREE.MeshBasicMaterial({ color: tc.clone().multiplyScalar(2.1) }),                        /* Ankerlicht in Spielerfarbe */
    teamHalo: new THREE.SpriteMaterial(Object.assign({ map: X.halo.map, color: tc.clone().multiplyScalar(0.75) }, add)),
    ground,                                                                                               /* Feldschein unter dem Sockel */
    thread: new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color('#a47cff').multiplyScalar(1.5), opacity: 0.55 }, add)),  /* Lichtfaden */
    /* Kristallband in Spielerfarbe (volle Ringe statt Linien) und dunkles Kuppelglas, durch das der Kern scheint */
    band: rim(new THREE.MeshStandardMaterial({ color: tc.clone().lerp(new THREE.Color('#ffffff'), 0.25), metalness: 0.3, roughness: 0.2, emissive: tc, emissiveIntensity: 0.45, flatShading: true, envMapIntensity: 1.5 }), tc.clone().multiplyScalar(0.8), 2.6),
    dome: rim(new THREE.MeshStandardMaterial({ color: '#7a62c8', metalness: 0.35, roughness: 0.15, transparent: true, opacity: 0.42, emissive: '#3a1e98', emissiveIntensity: 0.3, flatShading: true, envMapIntensity: 1.2, vertexColors: true, depthWrite: false }), new THREE.Color('#9a74ff').multiplyScalar(0.9), 2.4, 0.45),
    teamVein: new THREE.MeshBasicMaterial({ color: tc.clone().multiplyScalar(1.6) })                                        /* Leuchtadern in Spielerfarbe */
  };
  SC.set(M, S); return S;
}

/* ------------------------------------------------------------ Kristallband: voller Ring mit sechskantigem Querschnitt (Breite t, Höhe h) */
function band(R, h, t, mat, seg = 48, y = 0) {
  const m = mesh(geo(`band|${q(R)}|${q(h)}|${q(t)}|${seg}`, () => lathe([[R - t, -h / 2], [R + t * 0.3, -h / 2], [R + t, 0], [R + t * 0.3, h / 2], [R - t, h / 2], [R - t * 1.3, 0], [R - t, -h / 2]], mat, seg).geometry), mat);
  m.position.y = y; return m;
}
/* Kristallcluster: Büschel aus schräg wachsenden Kristallen und Splittern an einem Punkt (Fuß F), Größe s */
function cluster(X, F, s, seed, n = 7) {
  const g = new THREE.Group(), r = rng(seed * 31 + 7); g.position.set(...F);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * s * 1.2, L = s * (1.2 + r() * 2.2), e = (32 + r() * 50) * DEG, k = r();
    g.add(grow(L, L * (0.16 + r() * 0.08), k < 0.3 ? X.dark : k < 0.6 ? X.cry : X.cryS, { n: 4 + (i % 3), tf: 0.5, tb: 0.15, tw: 0.5 }, [Math.cos(a) * d, -L * 0.2, Math.sin(a) * d], dirE(a, e)));
  }
  for (let i = 0; i < 3; i++) { const f = mesh(fragGeo(seed + i), X.cryS); f.scale.setScalar(s * 0.45); f.position.set((r() - 0.5) * s * 2, s * 0.25, (r() - 0.5) * s * 2); f.rotation.set(r() * 3, r() * 3, 0); g.add(f); }
  return g;
}
/* Kristallinsel: massive facettierte Scholle, oben flach, unten zur Spitze auslaufend. Grundriss sh = { n, irr, rot, sx }:
   n Ecken (14 = fast rund und unregelmäßig, 3–8 = klares Vieleck je Rolle, damit nicht jede Station auf derselben
   runden Scholle steht), irr Unregelmäßigkeit, rot Drehung der ersten Ecke, sx Stauchung quer (länglicher Grundriss). */
const SH0 = { n: 14, irr: 0.1, rot: 0.1, sx: 1 };
function shapeOf(o) { return Object.assign({}, SH0, o.shape ? { irr: 0.03, rot: 0 } : {}, o.shape || {}); }
function shapeKey(sh) { return `${sh.n}|${sh.irr}|${sh.rot.toFixed(3)}|${sh.sx}`; }
function shapePts(R, seed, sh, k) {
  const r = rng(seed * 53 + 1), f = []; for (let i = 0; i < sh.n; i++) f.push(1 - sh.irr + r() * sh.irr);
  return ngon(sh.n, 1, 1, sh.rot).map(([x, z], i) => [x * k * R * f[i] * sh.sx, z * k * R * f[i]]);
}
/* Randabstand des Grundrisses in Richtung a (Anteil von R): für Klingen, Kristalle und Cluster am Rand */
function edgeK(sh, a) {
  const c = Math.cos(a), s = -Math.sin(a), a2 = Math.atan2(s, c / sh.sx), st = TAU / sh.n, t = ((a2 - sh.rot) % st + st) % st - st / 2;   /* Welt-Z = −Grundriss-Y */
  return Math.cos(st / 2) / Math.cos(t) / Math.hypot(c / sh.sx, s);
}
/* Weltwinkel der Ecken des Grundrisses */
const cornerA = s0 => { const sh = shapeOf({ shape: s0 }), r = []; for (let i = 0; i < sh.n; i++) { const a = sh.rot + i / sh.n * TAU; r.push(Math.atan2(-Math.sin(a), Math.cos(a) * sh.sx)); } return r; };
function islandGeo(R, seed, sh = SH0) {
  return geo(`island|${q(R)}|${seed}|${shapeKey(sh)}`, () => {
    const sec = (y, k) => ({ z: y, pts: shapePts(R, seed, sh, k) });
    const g = loft([sec(-R * 0.42, 0.03), sec(-R * 0.24, 0.5), sec(-R * 0.08, 0.9), sec(R * 0.03, 0.965), sec(R * 0.1, 0.84)], null, { uv: 1 / 24 }).geometry;
    g.rotateX(-Math.PI / 2); return facetCols(g, seed + 5, 0.5);
  });
}
function islandRim(R, seed, y, rad, sh = SH0) {
  const pts = shapePts(R, seed, sh, 0.965).map(([x, z]) => [x, y, -z]), ed = []; for (let i = 0; i < sh.n; i++) ed.push([i, (i + 1) % sh.n]);
  return frameGeo(`islandRim|${q(R)}|${seed}|${rad}|${shapeKey(sh)}`, pts, ed, rad, 5);
}

/* ------------------------------------------------------------ Kristallsockel
   Massive Kristallinsel aus Obsidian (füllt die Grundfläche bis 0,97·R), Leuchtkante in Spielerfarbe und Lichtadern
   zur Mitte, darauf eine helle Kristallplatte (o.plate·R). Zweischichtiger Kranz: große flache Klingen zeigen nach
   außen (Spitzen bis 0,98·R), dahinter aufrechte Splitter; Kristallcluster (o.clusters) sitzen auf dem Rand der Insel.
   Darunter Wurzelkristalle (die Stationen schweben). Feldschein o.glow (0 = keiner), Splitterwolke o.cloud (Anzahl). */
function socket(M, X, S, R, seed, o = {}) {
  const g = new THREE.Group(), r = rng(seed * 97 + 13), n = o.n || 9, a0 = o.a0 || 0, top = R * 0.1, poly = !!o.shape, sh = shapeOf(o);
  const K = a => poly ? edgeK(sh, a) : 1;   /* Randabstand je Richtung (Vieleck) */
  g.position.y = -top;   /* Oberkante der Insel liegt bei y = 0 */
  g.add(mesh(islandGeo(R, seed, sh), X.dark));
  g.add(mesh(islandRim(R, seed, R * 0.03, Math.max(0.12, R * 0.009), sh), S.teamVein, false));
  for (let i = 0; i < 7; i++) { const a = a0 + i / 7 * TAU + 0.3; g.add(beam(X, P(a, R * 0.2, top + 0.15), P(a, R * 0.88 * K(a), top + 0.15), Math.max(0.08, R * 0.004), S.thread)); }
  const pn = poly && sh.n <= 8 ? sh.n : 6, po = { n: pn, sq: 1, tf: 0.1, tb: 0.5, tw: 0, wb: 0.92, wf: 0.97 }, PL = q(R * 0.1), PR = q(R * (o.plate || 0.4));
  const pl = gem(PL, PR, X.cry, po); pl.rotation.x = -Math.PI / 2; pl.position.y = top + PL * 0.35; pl.scale.x = poly ? sh.sx : 1; g.add(pl);
  const pe = gemEdges(X, PL, PR, po, X.vein, Math.max(0.1, R * 0.005)); pe.rotation.x = -Math.PI / 2; pe.position.y = pl.position.y; pe.scale.x = pl.scale.x; g.add(pe);
  /* Klingenkranz: rund – Klingen ringsum; Vieleck – je Ecke eine große Klinge mit zwei kleinen daneben (betont den Grundriss) */
  const blades = poly ? cornerA(sh).flatMap(c => [[c, 1.15], [c - 0.17 * TAU / sh.n, 0.6], [c + 0.17 * TAU / sh.n, 0.6]]) : Array.from({ length: n }, () => [null, 1]);
  blades.forEach(([a, k], i) => {
    if (a === null) a = a0 + (i + (r() - 0.5) * 0.4) / n * TAU;
    const reach = R * (0.9 + r() * 0.08) * K(a), L = R * (0.42 + r() * 0.16) * (o.len || 1) * k * (poly ? 0.75 : 1), w = R * (0.08 + r() * 0.03) * Math.sqrt(k), e = (4 + r() * 12) * DEG;
    const F = P(a, reach - Math.cos(e) * L, top - R * 0.02 + Math.sin(e) * L * 0.3);
    g.add(grow(L, w, i % 3 === 2 ? X.dark : i % 3 ? X.cryS : X.cry, { n: 4, sq: 0.4, tf: 0.46, tb: 0.16, tw: 0.5 }, F, dirE(a, -e)));
  });
  const nu = o.up ?? n;
  for (let i = 0; i < nu; i++) {
    const a = a0 + (i + 0.5 + (r() - 0.5) * 0.3) / nu * TAU, L = R * (0.16 + r() * 0.12), e = (30 + r() * 28) * DEG;
    g.add(grow(L, L * 0.2, i % 2 ? X.cryS : X.cry, { n: 4 + (i % 2), tf: 0.5, tb: 0.2, tw: 0.5 }, P(a, R * (o.upAt || 0.74) * (0.95 + r() * 0.1) * K(a), top - R * 0.03), dirE(a, e)));
  }
  const nc = o.clusters ?? 6;
  for (let i = 0; i < nc; i++) { const a = a0 + (i + 0.5) / nc * TAU + (o.ca || 0); g.add(cluster(X, P(a, R * (o.cAt || 0.66) * K(a), top - R * 0.01), R * 0.075, seed * 7 + i, 6)); }
  /* Wurzeln */
  g.add(grow(R * 0.5, R * 0.14, X.dark, { n: 6, tf: 0.6, tb: 0.1, tw: 0.5 }, [0, -R * 0.3, 0], [0, -1, 0]));
  for (let i = 0; i < 5; i++) { const a = a0 + i / 5 * TAU + 0.5; g.add(grow(R * 0.4, R * 0.08, i % 2 ? X.dark : X.cryS, { n: 5, tf: 0.55, tb: 0.15, tw: 0.5 }, P(a, R * 0.3 * K(a), -R * 0.12), [Math.cos(a) * 0.7, -1, Math.sin(a) * 0.7])); }
  if (o.glow !== 0) { const gd = mesh(geo('hexdisc', () => new THREE.CircleGeometry(1, 6).rotateZ(Math.PI / 2)), S.ground, false); gd.rotation.x = -Math.PI / 2; gd.scale.setScalar(R * (o.glow || 0.5)); gd.position.y = top + PL * 0.8; g.add(gd); }
  /* feine Splitterwolke: kleine Kristalle treiben langsam um den Sockel */
  const nw = o.cloud ?? 8;
  if (nw) { g.add(orbiters(M, X, { axis: 'y', n: nw, r: R * 0.82, y: top + R * 0.12, size: R * 0.028, speed: 0.07, seed: seed + 3, wob: R * 0.05, flat: 0.95 })); g.add(orbiters(M, X, { axis: 'y', n: Math.round(nw * 0.6), r: R * 0.55, y: top + R * 0.2, size: R * 0.02, speed: -0.09, seed: seed + 9, wob: R * 0.04, mat: X.cry })); }
  g.userData.edgeK = K;
  return g;
}

/* ------------------------------------------------------------ Leuchtanker
   Netzknoten am Sockelrand: kleiner Dreikant, darüber ein Knoten in Spielerfarbe mit Sechseckring; ein Lichtfaden läuft
   zur Nabe des Gebäudes (hub = [Radius, Höhe]). s = Maßstab. */
function anchors(M, X, S, g, angles, dist, s, hub) {
  for (const a of angles) {
    const [x, , z] = P(a, dist), ny = s * 3.5;
    g.add(grow(s * 3.2, s * 0.55, X.cryS, { n: 3, sq: 1, tw: 0, tf: 0.5, tb: 0.12 }, [x, -s * 0.5, z], UPV));
    g.add(put(octa(S.team, s * 0.42, s * 0.72, s * 0.42, false), x, ny, z));
    g.add(put(halo(S.teamHalo, s * 4), x, ny, z));
    g.add(put(hring(s * 1.15, s * 0.09, M.trim, 6, 3), x, ny, z));
    if (hub) g.add(beam(X, [x, ny, z], P(a, hub[0], hub[1]), s * 0.07, S.thread));
  }
}

/* ------------------------------------------------------------ Waffen (Köpfe drehen um Y, Strahler zeigen nach +Z) */
/* Emitter: Kristall nach +Z mit Lichtader, an der Spitze drei kleine Prismen, die den Strahl brechen, und ein Lichtkern.
   tri3 = Dreikant-Emitter mit Leuchtkanten (Prisma-/Facettenstrahl). */
function emitter(M, X, s, tri3) {
  const g = new THREE.Group(), L = 7 * s, rr = (tri3 ? 1.2 : 0.85) * s;
  const o = tri3 ? { n: 3, sq: 1, tw: 0, tf: 0.4, tb: 0.2, rot: -30 * DEG } : { n: 6, tf: 0.42, tb: 0.22, tw: 0.6 };
  g.add(put(gem(q(L), q(rr), X.cry, o), 0, 0, L * 0.28));
  g.add(put(gem(q(L * 0.78), q(0.28 * s), X.vein, { n: 4, tf: 0.42, tw: 0 }, false), 0, 0, L * 0.3));
  if (tri3) g.add(put(gemEdges(X, q(L), q(rr), o, X.veinHot, Math.max(0.05, 0.06 * s)), 0, 0, L * 0.28));
  tri(g, () => { const p = gem(q(2 * s), q(0.3 * s), X.cryS, { n: 3, sq: 1, tw: 0, tf: 0.5, tb: 0.3 }); p.position.set(0, rr * 0.95, L * 0.72); p.rotation.x = -0.3; return p; });
  g.add(put(core(M, X, 0.3 * s, 2.4 * s, 0.12, X.haloW), 0, 0, L * 0.8));
  return g;
}
/* Geschützkopf: Gelenkkristall, Sechseckring in Spielerfarbe, Emitter nebeneinander (list: [x, s, tri3]), Gegengewicht */
function beamHead(M, X, s, list, phase) {
  const h = new THREE.Group(); h.userData.aim = { phase };
  const j = mesh(fragGeo(5), X.dark); j.scale.set(1.4 * s, 1.0 * s, 1.5 * s); h.add(j);
  h.add(hring(1.8 * s, 0.14 * s, M.trim, 6, 3));
  h.add(grow(3.4 * s, 0.75 * s, X.dark, { n: 4, tf: 0.5, tb: 0.2, tw: 0 }, [0, 0.3 * s, -0.6 * s], [0, 0.3, -1]));
  for (const [x, es, t3] of list) h.add(put(emitter(M, X, es, t3), x, 0.35 * s, 0.4 * s));
  return h;
}
/* Kristall-PD: kleiner Kopf, drei kurze Splitter im Dreieck nach +Z, drehen sich langsam um die Schussachse */
function pdHead(M, X, s, phase) {
  const h = new THREE.Group(); h.userData.aim = { phase };
  const j = mesh(fragGeo(2), X.dark); j.scale.setScalar(0.85 * s); h.add(j);
  const cl = new THREE.Group();
  tri(cl, () => { const p = gem(q(2.8 * s), q(0.32 * s), X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0 }); p.position.set(0, 0.6 * s, 0); return p; });
  cl.add(core(M, X, 0.22 * s, 1.8 * s, 0.15, X.haloW));
  h.add(spinning(cl, 'z', 0.7, 1.4 * s));
  return h;
}
/* Facettenstrahl: großer Dreikant-Emitter, drei Spiegelfacetten fächern um ihn nach vorn auf */
function facetHead(M, X, s, phase) {
  const h = new THREE.Group(); h.userData.aim = { phase };
  const j = mesh(fragGeo(6), X.dark); j.scale.set(1.6 * s, 1.1 * s, 1.8 * s); h.add(j);
  h.add(hring(2.2 * s, 0.16 * s, M.trim, 3, 3));
  h.add(put(emitter(M, X, s * 1.25, true), 0, 0, 0.6 * s));
  const tile = geo('hextile', () => new THREE.CylinderGeometry(1.6, 1.6, 0.3, 6));
  tri(h, () => { const t = mesh(tile, X.mirror); t.scale.set(0.75 * s, 1, 1.3 * s); t.position.set(0, 2.2 * s, 2.6 * s); t.rotation.x = 0.55; return t; });
  return h;
}
/* Sockel eines Geschützes: Obsidianpfeiler mit zwei Seitensplittern, oben Platz für den Kopf (Höhe h) */
function pylon(X, x, z, h, s, a = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const po = { n: 4, tf: 0.16, tb: 0.3, tw: 0, sq: 1, rot: 45 * DEG };
  g.add(grow(h + 1, 1.25 * s, X.dark, po, [0, -1, 0], UPV));
  g.add(growEdges(X, h + 1, 1.25 * s, po, [0, -1, 0], UPV, X.vein, 0.08 * s));
  for (const k of [-1, 1]) g.add(grow(h * 0.75, 0.6 * s, X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0.5 }, [Math.cos(a + k * 1.3) * 0.8 * s, -0.5, Math.sin(a + k * 1.3) * 0.8 * s], [Math.cos(a + k * 1.3) * 0.35, 1, Math.sin(a + k * 1.3) * 0.35]));
  return g;
}

/* ======================================================================== KERNKNOTEN – Herz des Netzes
   Massiver Herzkristall (durchscheinender Achtkant mit Adern in Spielerfarbe), darin der große Lichtkern und eine
   Lichtsäule; ein Lichtgitter dreht sich darum. Säulenkrone aus zwölf Kristallen (sechs große, sechs mittlere) auf
   einem Obsidianring, sechs Leuchtanker mit Fäden zum Herzen. I: ein Kristallband (Spielerfarbe); II: zweites Band
   aus hellem Kristall gegenläufig, zwei Kristallstrahler auf Pfeilern am Außenrand, kreisende Splitter; III: breites
   Band am Sockelrand mit zwölf aufrechten Kristallen, drei Strahler, Facettenstrahl über dem Herzen, zwei Kristall-PD,
   zwölf kleine Kronenkristalle. Unbewaffnet auf Stufe I. */
registerB('nexus', 'base', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), hy = 24;
  g.add(socket(M, X, S, R, 1, { n: 14, plate: 0.5, up: 10, upAt: 0.8, clusters: 6, cAt: 0.7, ca: 0.3 }));
  /* Herzkristall */
  const ho = { n: 8, tf: 0.3, tb: 0.1, tw: 0, sq: 1, wb: 0.9, wf: 0.95 }, HL = 48, HR = 15 + lv;
  g.add(grow(HL, HR, X.cry, ho, [0, -3, 0], UPV)); g.add(growEdges(X, HL, HR, ho, [0, -3, 0], UPV, S.teamVein, 0.3));
  g.add(grow(34, 3.2, X.vein, { n: 6, tw: 0, tf: 0.3, tb: 0.2 }, [0, 4, 0], UPV, false));
  g.add(put(core(M, X, 4.5 + lv * 0.5, 30 + lv * 5, 0.05), 0, hy, 0));
  const cp = [[22, 0, 0], [-22, 0, 0], [0, 28, 0], [0, -24, 0], [0, 0, 22], [0, 0, -22]], ce = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
  const cage = new THREE.Group(); cage.add(mesh(frameGeo('nxbaseCage', cp, ce, 0.4), X.beam, false)); cage.add(mesh(nodesGeo('nxbaseCage', cp, 1.4), M.core, false)); cage.position.y = hy;
  g.add(spinning(cage, 'y', -0.1));
  /* Obsidianring als Fuß der Krone, Säulenkrone */
  g.add(band(28, 4, 3, X.dark, 12, 1.5));
  const pil = { n: 5, tf: 0.3, tb: 0.12, tw: 0, sq: 0.9 };
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, big = i % 2 === 0, L = big ? 40 : 26, rr = big ? 5 : 3.4, F = P(a, big ? 30 : 27, -1), dv = [Math.cos(a) * 0.22, 1, Math.sin(a) * 0.22];
    g.add(grow(L, rr, big ? X.cry : X.cryS, pil, F, dv)); if (big) g.add(growEdges(X, L, rr, pil, F, dv, X.veinHot, 0.14, 1));
    g.add(beam(X, [F[0] * 0.55, hy - 4, F[2] * 0.55], [F[0] * 1.1, 14, F[2] * 1.1], 0.2, S.thread));
  }
  if (lv >= 3) for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; g.add(grow(14, 2.2, X.cryS, { n: 4, tf: 0.45, tb: 0.15, tw: 0.5 }, P(a, 33, -1), [Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45])); }
  /* Bänder */
  g.add(spinning(band(40, 2.6, 2, S.band, 48, 5), 'y', 0.05));
  if (lv >= 2) { g.add(spinning(band(49, 2, 1.6, X.cryS, 48, 2.5), 'y', -0.04)); g.add(hring(49, 0.3, X.beam, 48, 3, 2.5)); }
  if (lv >= 3) {
    const outer = new THREE.Group(); outer.add(band(58, 3.2, 2.4, S.band, 48, 1.2));
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; outer.add(grow(7, 1.3, X.cry, { n: 4, tf: 0.5, tb: 0.15, tw: 0.5 }, P(a, 58, 2), UPV)); }
    g.add(spinning(outer, 'y', 0.03));
  }
  anchors(M, X, S, g, [0, 1, 2, 3, 4, 5].map(i => i / 6 * TAU), 54, 2.4, [26, 6]);
  /* Waffen */
  if (lv >= 2) {
    const at = (lv === 2 ? [30, 210] : [30, 150, 270]).map(a => a * DEG);
    at.forEach((a, i) => { const [x, , z] = P(a, 45); g.add(pylon(X, x, z, 12, 2.4, a)); g.add(put(beamHead(M, X, 2.2, [[0, 2.1, true]], i * 2.1), x, 13.8, z)); g.add(beam(X, [x * 0.65, 12, z * 0.65], [x, 10, z], 0.2, S.thread)); });
    g.add(orbiters(M, X, { axis: 'y', n: 7, r: 44, y: 20, size: 1.8, speed: 0.1, seed: 2, wob: 2.5 }));
  }
  if (lv >= 3) {
    g.add(put(facetHead(M, X, 2.2, 1), 0, hy + 23, 0));
    [90, 330].forEach((a, k) => { const [x, , z] = P(a * DEG, 45); g.add(pylon(X, x, z, 8, 1.6, a * DEG)); g.add(put(pdHead(M, X, 2, k * 3 + 0.5), x, 10, z)); });
  }
  return g;
});

/* ======================================================================== WACHSKAMMER – Kristallschiffe wachsen in einem Rippenkelch
   Liegestelle längs Z (Bug +Z) über einem durchscheinenden Nährbett (flacher Kristall mit Lichtader); zu beiden Seiten
   massive Obsidianwälle mit Adern in Spielerfarbe, aus denen Rippen wachsen (aufrecht, oben einwärts gekrümmt, mit
   Knöcheln); am Heck der Samenkern in einem Kelch, am Bug ein Tor aus zwei Dreikantpfeilern. I: drei Rippenpaare,
   Liegestelle 55. II: vier Paare, Wachstumsbogen als Kristallband, Kielsplitter, 80. III: fünf Paare, äußere
   Kelchblätter, zwei Bögen, zweiter Kern, 110. */
registerB('nexus', 'yard', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group();
  const BL = [55, 80, 110][lv - 1], by = [15, 21, 24][lv - 1], nr = lv + 2, ax = [0.6, 0.7, 0.76][lv - 1] * R, az = 0.86 * R;
  g.add(socket(M, X, S, R, 2, { shape: { n: 6, sx: 0.85, rot: Math.PI / 2 }, up: 8, plate: 0.3, glow: 0, clusters: 4, ca: Math.PI / 4, cAt: 0.72 }));
  /* Nährbett und Wälle */
  const bed = gem(q(az * 1.7), q(ax * 0.55), X.cry, { n: 6, sq: 0.22, tf: 0.2, tb: 0.2, tw: 0 }); bed.position.y = 1.2; g.add(bed);
  g.add(grow(az * 1.5, 1.2, X.vein, { n: 4, tw: 0 }, [0, 1.6, -az * 0.75], [0, 0, 1], false));
  const wo = { n: 6, sq: 0.8, tf: 0.2, tb: 0.2, tw: 0, wb: 0.9, wf: 0.9 }, WL = q(az * 1.45), WR = q(4.5 + lv * 0.6);
  for (const sg of [-1, 1]) { const F = [sg * (ax + 1), 1.5, -WL / 2]; g.add(grow(WL, WR, X.dark, wo, F, [0, 0, 1])); g.add(growEdges(X, WL, WR, wo, F, [0, 0, 1], S.teamVein, 0.16, 2)); }
  /* Rippen */
  const ro = { n: 4, tf: 0.38, tb: 0.12, tw: 0, sq: 0.7 };
  for (let i = 0; i < nr; i++) {
    const zf = -0.62 + 1.12 * i / (nr - 1), z = zf * az, xr = ax * (0.92 + 0.08 * Math.sqrt(1 - zf * zf)), k = 0.85 + 0.15 * Math.sqrt(1 - zf * zf), H = (15 + lv * 4) * k;
    for (const sg of [-1, 1]) {
      const F = [sg * xr, WR * 0.8, z], d1 = [-sg * 0.08, 1, -zf * 0.12], L1 = H * 0.75;
      g.add(grow(L1, 2.6 + lv * 0.3, i % 2 ? X.cryS : X.cry, ro, F, d1));
      g.add(growEdges(X, L1, 2.6 + lv * 0.3, ro, F, d1, X.vein, 0.1, 2));
      const u = unit(d1), K = [F[0] + u[0] * L1 * 0.9, F[1] + u[1] * L1 * 0.9, F[2] + u[2] * L1 * 0.9];
      const kn = mesh(fragGeo(i + (sg > 0 ? 3 : 0)), X.dark); kn.scale.setScalar(2 + lv * 0.25); kn.position.set(...K); kn.rotation.set(i, sg, 0); g.add(kn);
      g.add(grow(H * 0.65, 1.7 + lv * 0.15, X.cryS, { n: 4, tf: 0.55, tb: 0.15, tw: 0.5 }, K, [-sg * 0.8, 1, -zf * 0.2]));
      if (lv >= 3) g.add(grow(H * 0.55, 1.8, X.dark, { n: 4, sx: 0.5, tf: 0.5, tb: 0.2, tw: 0 }, [sg * (xr + 2), 0, z], [sg * 0.3, 1, 0]));
    }
  }
  /* Samenkern am Heck */
  const zs = -Math.min(BL / 2 + 1, 0.78 * R), sy = by * 0.75;
  g.add(grow(10, 5, X.dark, { n: 6, tf: 0.3, tb: 0.1, tw: 0, sq: 1 }, [0, 0, zs], UPV));
  g.add(put(core(M, X, 2 + lv * 0.4, 14 + lv * 3, 0.07), 0, sy, zs));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; g.add(grow(12 + lv * 2, 2.2, X.cry, { n: 5, tf: 0.45, tb: 0.15, tw: 0.5 }, [Math.cos(a) * 3.5, 1, zs + Math.sin(a) * 3.5], [Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45])); }
  const sr = ring(4.5 + lv * 0.5, 0.6, S.band, 6, 6); sr.position.set(0, sy, zs); g.add(spinning(sr, 'z', 0.3));
  g.add(beam(X, [0, sy, zs], [0, by * 0.85, zs + 9], 0.35, X.beam));
  /* Tor am Bug */
  const zb = 0.66 * az, gx = ax * 0.55, to = { n: 3, sq: 1, tw: 0, tf: 0.4, tb: 0.1 }, TL = 16 + lv * 2;
  for (const sg of [-1, 1]) { const F = [sg * gx, 0, zb], dv = [sg * 0.15, 1, 0.12]; g.add(grow(TL, 3, X.cry, to, F, dv)); g.add(growEdges(X, TL, 3, to, F, dv, S.teamVein, 0.1)); }
  anchors(M, X, S, g, [Math.PI / 2 - 0.5, Math.PI / 2 + 0.5, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6], R * 0.76, 1.9, null);
  /* Wachstumsbögen über der Liegestelle (Kristallbänder) */
  if (lv >= 2) {
    const zz = lv === 2 ? [6] : [-12, 14];
    for (const z of zz) { const a = mesh(geo(`archB|${q(ax * 0.86)}`, () => new THREE.TorusGeometry(q(ax * 0.86), 1.1, 6, 22, Math.PI)), S.band); a.position.set(0, 1, z); a.userData.sway = { axis: 'z', amp: 0.03, speed: 0.5, phase: z }; g.add(a); }
    for (let i = 0; i < 2 + lv; i++) { const z = (-0.5 + i / (1 + lv)) * az * 1.1; g.add(grow(7, 1.4, X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0.5 }, [0, 1, z], [0, 1, 0.5])); }
  }
  if (lv >= 3) g.add(put(core(M, X, 1.4, 10, 0.1, X.haloW), 0, by * 1.9, -6));
  const b = new THREE.Group(); b.position.set(0, by, 0); b.userData.berth = { len: BL }; g.add(b);
  return g;
});

/* ======================================================================== VERDICHTER – Trichterblüte mit Linsen und Andockzangen
   Obsidiantrommel als Fuß, darauf ein voller durchscheinender Kristalltrichter (achtkantig, Adern in Spielerfarbe),
   außen von Klingen umstanden; innen drehen Wirbelringe um den glühenden Kern, darüber schweben Linsen. Harvester
   liegen mit dem Bug zur Mitte in Zangen auf Obsidiankonsolen über dem Trichterrand. I: ein Andockplatz, zwei
   Speicherkristalle. II: zwei, zweite Linse, mehr Klingen. III: drei, dritte Linse, verdichtete Splitter kreisen,
   Kristallband in Spielerfarbe am Sockelrand. */
registerB('nexus', 'refinery', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group();
  g.add(socket(M, X, S, R, 3, { shape: { n: 8, rot: Math.PI / 8 }, up: 8, plate: 0.42, clusters: 3, ca: Math.PI / 6 }));
  g.add(grow(8, 10, X.dark, { n: 8, tf: 0.15, tb: 0.15, tw: 0, sq: 1 }, [0, -1, 0], UPV));
  const fun = mesh(geo('nxfunnel', () => facetCols(lathe([[3, 2], [8, 4], [15, 11], [21, 19], [22.5, 21], [19, 20], [12, 11], [6, 5], [3, 2]], null, 8).geometry, 9, 0.6)), X.cry); fun.rotation.y = Math.PI / 8; g.add(fun);
  g.add(mesh(geo('nxfunnelE', () => { const pts = [], ed = []; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; [[8, 4], [15, 11], [21, 19], [22.5, 21]].forEach(([r, y], j) => { pts.push([Math.cos(a) * r * 1.01, y, Math.sin(a) * r * 1.01]); if (j) ed.push([pts.length - 2, pts.length - 1]); }); } for (let k = 0; k < 8; k++) ed.push([k * 4 + 3, ((k + 1) % 8) * 4 + 3]); return frameGeo('nxfunnelE', pts, ed, 0.14, 4); }), S.teamVein, false));
  const nb = [6, 8, 10][lv - 1], fe = 50 * DEG, FL = 19 + lv;
  for (let i = 0; i < nb; i++) { const a = i / nb * TAU + 0.2; g.add(grow(FL, 3.2, i % 2 ? X.cryS : X.dark, { n: 4, sq: 0.4, tf: 0.38, tb: 0.12, tw: 0 }, P(a, 6, 3), dirE(a, fe))); }
  [[4, 6, 0.9], [8, 10, -0.7], [13, 15.5, 0.5]].forEach(([r, y, sp]) => g.add(spinning(hring(r, 0.35, X.beam, 6, 4, y), 'y', sp)));
  g.add(put(core(M, X, 2.2 + lv * 0.3, 14 + lv * 2, 0.1), 0, 7, 0));
  const lens = (r, y, sp) => { const l = new THREE.Group(); l.position.y = y; l.add(octa(X.cry, r, r * 0.3, r)); l.add(band(r * 0.95, 0.5, 0.45, S.band, 4)); l.userData.spin = { axis: 'y', speed: sp }; return l; };
  g.add(lens(9, 26, 0.3));
  if (lv >= 2) g.add(lens(6, 32, -0.45));
  if (lv >= 3) g.add(lens(4, 37, 0.6));
  g.add(beam(X, [0, 7, 0], [0, 26 + (lv - 1) * 5.5, 0], 0.5, X.beamSoft));
  /* Andockplätze */
  const da = [[-Math.PI / 2], [0, Math.PI], [-Math.PI / 2, -Math.PI / 2 + TAU / 3, -Math.PI / 2 + 2 * TAU / 3]][lv - 1], dr = 28, dy = 17;
  for (const a of da) {
    const [x, , z] = P(a, dr), yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
    const c = new THREE.Group(); c.position.set(x, dy, z); c.rotation.y = yaw; g.add(c);
    const pedo = { n: 6, tf: 0.15, tb: 0.3, tw: 0, sq: 1 };
    c.add(grow(dy - 4, 4, X.dark, pedo, [0, -dy, 0], UPV)); c.add(growEdges(X, dy - 4, 4, pedo, [0, -dy, 0], UPV, X.vein, 0.1, 2));
    const con = gem(3, 9, X.dark, { n: 6, tf: 0.2, tb: 0.5, tw: 0, sq: 1 }); con.rotation.x = -Math.PI / 2; con.position.y = -5.5; c.add(con);
    for (const sg of [-1, 1]) {
      c.add(grow(17, 1.8, X.cryS, { n: 4, tf: 0.5, tb: 0.15, tw: 0 }, [sg * 8, -5, -3], [-sg * 0.3, 1, 0.25]));
      c.add(grow(10, 1.4, X.dark, { n: 4, sx: 0.5, tf: 0.5, tb: 0.2, tw: 0 }, [sg * 8.5, -5, 6], [sg * 0.2, 1, 0.3]));
    }
    c.add(spinning(ring(7, 0.55, S.band, 6, 6), 'z', 0.25, -1));
    g.add(beam(X, P(a, dr - 1, dy - 7), [0, 7, 0], 0.22, S.thread));
    const k = new THREE.Group(); k.position.set(x, dy, z); k.rotation.y = yaw; k.userData.dock = true; g.add(k);
  }
  const sa = lv === 1 ? [-Math.PI / 2 + TAU / 3, -Math.PI / 2 + 2 * TAU / 3] : lv === 2 ? [Math.PI / 2, -Math.PI / 2] : da.map(a => a + Math.PI / 3);
  for (const a of sa) {
    const L = lv === 3 ? 15 : 19, F = P(a, 22, 0), dv = dirE(a, 64 * DEG);
    g.add(grow(L, 4.4, X.cry, { n: 6, tf: 0.3, tb: 0.25, tw: 0.5 }, F, dv));
    const u = unit(dv); for (let k = 0; k < 3; k++) { const f = mesh(fragGeo(k + 1), X.vein, false); f.scale.setScalar(1.1); f.position.set(F[0] + u[0] * L * (0.35 + k * 0.15), F[1] + u[1] * L * (0.35 + k * 0.15), F[2] + u[2] * L * (0.35 + k * 0.15)); f.rotation.set(k, k * 2, 0); g.add(f); }
  }
  if (lv >= 3) { g.add(orbiters(M, X, { axis: 'y', n: 7, r: 17, y: 21, size: 0.6, speed: 0.35, seed: 6, wob: 1.4, mat: X.veinHot })); g.add(spinning(band(35, 2, 1.6, S.band, 48, 1.5), 'y', 0.05)); }
  anchors(M, X, S, g, da.map(a => a + Math.PI), 33, 1.6, null);
  return g;
});

/* ======================================================================== RESONATOR – Stimmgabeln um einen hellen Kern
   Obsidiantrommel trägt einen durchscheinenden Sechskant-Kristall mit Adern in Spielerfarbe, in dem der Kern glüht;
   ringsum stehen massive Kristall-Stimmgabeln (zwei Zinken, Bügel als Kristallband), die sanft schwingen. I: zwei
   Gabeln, ein Band. II: drei Gabeln, zweites Band gegenläufig, Splitterkrone. III: drei Gabeln + drei Einzelzinken,
   breites Band am Sockelrand, Lichtbögen vom Kern zu den Zinken, kreisende Funken. */
registerB('nexus', 'reactor', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), cy = 13;
  g.add(socket(M, X, S, R, 4, { shape: { n: 6 }, up: 6, plate: 0.4, clusters: 3 }));
  g.add(grow(6, 8.5, X.dark, { n: 6, tf: 0.2, tb: 0.2, tw: 0, sq: 1 }, [0, -1, 0], UPV));
  const bo = { n: 6, tf: 0.32, tb: 0.1, tw: 0, sq: 1, wb: 0.9, wf: 0.92 }, BL = 22, BR = 6.5 + lv * 0.4;
  g.add(grow(BL, BR, X.cry, bo, [0, 3, 0], UPV)); g.add(growEdges(X, BL, BR, bo, [0, 3, 0], UPV, S.teamVein, 0.16));
  g.add(put(core(M, X, 2.6 + lv * 0.35, 16 + lv * 3, 0.1), 0, cy, 0));
  g.add(spinning(band(BR + 2.5, 1.6, 1.1, S.band, 6, cy), 'y', 0.4));
  if (lv >= 2) g.add(spinning(band(BR + 5, 1, 0.8, X.cryS, 48, cy + 2), 'y', -0.3));
  if (lv >= 3) g.add(spinning(band(23, 1.8, 1.4, S.band, 48, 1), 'y', 0.1));
  const nF = lv === 1 ? 2 : 3, fa = lv === 1 ? [0, Math.PI] : [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3], TL = 17 + lv * 2, tips = [];
  fa.forEach((a, i) => {
    const f = new THREE.Group(); f.rotation.y = -a; g.add(f);
    const k = new THREE.Group(); k.position.x = 15; k.userData.sway = { axis: 'z', amp: 0.025, speed: 1.3, phase: i * 2 }; f.add(k);
    k.add(grow(7, 3.2, X.dark, { n: 6, tf: 0.3, tb: 0.1, tw: 0, sq: 1 }, [0, -1, 0], UPV));
    for (const sx of [-1, 1]) { k.add(grow(TL, 1.9, X.cry, { n: 4, tf: 0.3, tb: 0.1, tw: 0 }, [sx * 3.4, 5, 0], [sx * 0.05, 1, 0])); k.add(put(octa(X.veinHot, 0.6, 1.2, 0.6, false), sx * (3.4 + 0.05 * TL), 5 + TL + 0.5, 0)); }
    k.add(grow(TL * 0.7, 0.5, X.vein, { n: 4, tw: 0 }, [0, 5.5, 0], UPV, false));
    const u = mesh(geo('forkArch', () => new THREE.TorusGeometry(3.4, 1.0, 6, 10, Math.PI)), S.band); u.rotation.z = Math.PI; u.position.y = 5.5; k.add(u);
    tips.push(P(a, 15, 5 + TL));
  });
  if (lv >= 2) { const cr = new THREE.Group(); cr.position.y = cy + 9; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; cr.add(grow(6, 1.1, X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0 }, P(a, 1.5, 0), [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5])); } g.add(spinning(cr, 'y', 0.4)); }
  if (lv >= 3) {
    fa.forEach(a0 => { const a = a0 + Math.PI / 3; g.add(grow(16, 1.6, X.cryS, { n: 4, tf: 0.35, tb: 0.1, tw: 0 }, P(a, 19, 0), [Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12])); });
    for (const t of tips) g.add(beam(X, [0, cy, 0], t, 0.16, X.beamSoft));
    g.add(orbiters(M, X, { axis: 'y', n: 5, r: BR + 4, y: cy + 4, size: 0.4, speed: 0.9, seed: 5, wob: 1.5, mat: X.veinHot }));
  }
  anchors(M, X, S, g, fa.map(a => a + Math.PI / nF), 25, 1.4, [BR, 6]);
  return g;
});

/* ======================================================================== FACETTENKAMMER – Prisma mit Spiegelfacetten
   Obsidiantrommel mit drei Stützkristallen, darauf ein massives aufrechtes Dreikant-Prisma (Leuchtkanten in
   Spielerfarbe, Lichtader, Kern); dicke Dreiecksbänder drehen sich darum; Spiegelfacetten (Sechseckplatten mit
   Leuchtsaum) schweben auf einem Karussell, Lichtstrahlen brechen sich zwischen Prisma und Facetten. I: drei Facetten,
   ein Band. II: zweites Band gegenläufig, drei kleine Facetten oben, Strahlen. III: drittes Band, Krone über dem Prisma
   (umgekehrtes Prisma mit Kern), äußerer Kranz aus sechs kleinen Facetten. */
registerB('nexus', 'lab', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group();
  const lsh = { n: 3, rot: Math.PI / 2 }; g.add(socket(M, X, S, R, 5, { shape: lsh, up: 6, upAt: 0.6, plate: 0.38, clusters: 3, cAt: 0.5, ca: Math.PI / 3 }));
  g.add(grow(6, 9, X.dark, { n: 6, tf: 0.2, tb: 0.2, tw: 0, sq: 1 }, [0, -1, 0], UPV));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; g.add(grow(12, 2.4, X.dark, { n: 4, tf: 0.5, tb: 0.1, tw: 0 }, P(a, 8.5, 1), [-Math.cos(a) * 0.55, 1, -Math.sin(a) * 0.55])); }
  const PL = 28 + lv * 2, pr = { n: 3, sq: 1, tf: 0.22, tb: 0.06, tw: 0, rot: -30 * DEG }, PR = 7.5;
  g.add(grow(PL, PR, X.cry, pr, [0, 2, 0], UPV)); g.add(growEdges(X, PL, PR, pr, [0, 2, 0], UPV, S.teamVein, 0.18));
  g.add(grow(PL * 0.8, 2, X.vein, { n: 3, sq: 1, tw: 0, tf: 0.3 }, [0, 3, 0], UPV, false));
  g.add(put(core(M, X, 1.8 + lv * 0.2, 12, 0.1, X.haloW), 0, PL * 0.5, 0));
  g.add(spinning(hring(11, 1, S.band, 3, 6, 12), 'y', 0.18));
  if (lv >= 2) g.add(spinning(hring(14, 0.8, X.cryS, 3, 6, 20), 'y', -0.24));
  if (lv >= 3) g.add(spinning(hring(17, 1, S.band, 3, 6, 6), 'y', 0.1));
  const tile = geo('hextileT', () => new THREE.CylinderGeometry(1.6, 1.6, 0.6, 6));
  const facet = (sc, F, nrm) => { const f = new THREE.Group(); f.position.set(...F); const n = unit(nrm); f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...n)); const t = mesh(tile, X.mirror); t.scale.set(sc, 1, sc); f.add(t); const r = ring(q(sc * 1.62), q(0.08 * sc + 0.1), X.beam, 6, 4); r.rotation.x = Math.PI / 2; f.add(r); f.add(put(octa(X.veinHot, 0.18 * sc, 0.4 * sc, 0.18 * sc, false), 0, 0.4 * sc, 0)); return f; };
  const car = new THREE.Group(); car.userData.spin = { axis: 'y', speed: 0.1 };
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, F = P(a, 20, 14); car.add(facet(4, F, [-Math.cos(a), 1.1, -Math.sin(a)])); if (lv >= 2) car.add(beam(X, F, [0, 16, 0], 0.15, X.beamSoft)); }
  g.add(car);
  if (lv >= 2) { const c2 = new THREE.Group(); c2.userData.spin = { axis: 'y', speed: -0.16 }; for (let i = 0; i < 3; i++) { const a = (i + 0.5) / 3 * TAU, F = P(a, 13, 26); c2.add(facet(2.4, F, [-Math.cos(a), 0.6, -Math.sin(a)])); c2.add(beam(X, F, [0, 24, 0], 0.1, X.beamSoft)); } g.add(c2); }
  if (lv >= 3) {
    const cap = new THREE.Group(); cap.position.y = PL + 6; cap.add(grow(10, 4, X.cry, pr, [0, 5, 0], [0, -1, 0])); cap.add(put(core(M, X, 1, 8, 0.15, X.haloW), 0, 1.5, 0)); cap.userData.spin = { axis: 'y', speed: 0.3 }; g.add(cap);
    const c3 = new THREE.Group(); c3.userData.spin = { axis: 'y', speed: 0.06 }; for (let i = 0; i < 6; i++) { const a = (i + 0.25) / 6 * TAU; c3.add(facet(1.8, P(a, 27, 6), [Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4])); } g.add(c3);
  }
  anchors(M, X, S, g, cornerA(lsh), 27, 1.5, [PR, 8]);
  return g;
});

/* ======================================================================== KRISTALLWACHT – Obsidiansäule mit Strahlerkopf
   Rautensockel (Ecken in den vier Hauptrichtungen) mit vier schräg nach außen stehenden Wachkristallen an den Ecken –
   von oben ein klares Kreuz, das sich von den runden Stationen abhebt. Obsidiantrommel mit Adern in Spielerfarbe und
   sechs stämmigen Stützkristallen, darauf eine hohe Dreikant-Säule mit Leuchtkanten; oben dreht der Kopf (aim).
   I: ein Emitter, niedrige Eckkristalle. II: zwei Emitter, Kristallband um die Säule, Eckkristalle höher mit
   Lichtspitzen, Sechseckring schwebt unter dem Kopf. III: großer Prisma-Emitter, Spire-Emitter und Kristall-PD, hohe
   Eckwächter mit Lichtfäden zum Kopf und Nebenkristallen, Splitterkranz um den Kopf. */
registerB('nexus', 'turret', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), hy = 10 + lv * 1.5, tsh = { n: 4 };
  g.add(socket(M, X, S, R, 6, { shape: tsh, up: 0, plate: 0.45, clusters: 0, cloud: 5 }));
  const dro = { n: 6, tf: 0.25, tb: 0.15, tw: 0, sq: 1 };
  g.add(grow(6, 7, X.dark, dro, [0, -1, 0], UPV)); g.add(growEdges(X, 6, 7, dro, [0, -1, 0], UPV, S.teamVein, 0.1));
  const so = { n: 3, sq: 1, tf: 0.12, tb: 0.05, tw: 0, rot: -30 * DEG };
  g.add(grow(hy - 3, 3.5, X.dark, so, [0, 3, 0], UPV)); g.add(growEdges(X, hy - 3, 3.5, so, [0, 3, 0], UPV, X.veinHot, 0.1));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6, big = i % 2 === 0; g.add(grow(big ? 10 : 7, big ? 1.9 : 1.4, big ? X.cryS : X.cry, { n: 4, tf: 0.45, tb: 0.15, tw: 0.5 }, P(a, big ? 8.5 : 7, 0), [-Math.cos(a) * 0.45, 1, -Math.sin(a) * 0.45])); }
  /* Eckwächter: Obsidian mit Leuchtkanten, je Stufe höher */
  const WL = [6, 9, 12][lv - 1], wo = { n: 4, sq: 0.8, tf: 0.4, tb: 0.1, tw: 0 };
  for (const a of cornerA(tsh)) {
    const F = P(a, 12.5, -0.5), dv = [Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35];
    g.add(grow(WL, 1.7, X.dark, wo, F, dv)); g.add(growEdges(X, WL, 1.7, wo, F, dv, S.teamVein, 0.08));
    const u = unit(dv), T = [F[0] + u[0] * WL, F[1] + u[1] * WL, F[2] + u[2] * WL];
    if (lv >= 2) g.add(put(octa(X.veinHot, 0.5, 1, 0.5, false), T[0], T[1] + 0.6, T[2]));
    if (lv >= 3) {
      g.add(beam(X, T, [0, hy + 2, 0], 0.1, S.thread));
      for (const k of [-1, 1]) { const b = a + k * 0.45; g.add(grow(5, 0.9, X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0.5 }, P(b, 11, 0), [Math.cos(b) * 0.4, 1, Math.sin(b) * 0.4])); }
    }
  }
  if (lv >= 2) { g.add(spinning(band(5.5, 1.2, 0.8, S.band, 6, hy - 3), 'y', 0.4)); g.add(spinning(hring(7.5, 0.3, X.beam, 6, 3, hy - 0.5), 'y', -0.3)); }
  const list = lv === 1 ? [[0, 2.2, false]] : lv === 2 ? [[-2.5, 1.9, false], [2.5, 1.9, false]] : [[0.6, 2.2, true], [4.4, 1.5, false]];
  const h = beamHead(M, X, 2.3, list, 0.3); h.position.y = hy + 2; g.add(h);
  if (lv >= 3) { const pd = pdHead(M, X, 1.4, 0); pd.userData.aim = null; pd.position.set(-4, 0.7, 1); h.add(pd); g.add(orbiters(M, X, { axis: 'y', n: 4, r: 8, y: hy + 4, size: 0.6, speed: 0.4, seed: 3, wob: 0.8 })); }
  return g;
});

/* ======================================================================== HÜLLENPRISMA – Facettenkuppel
   Obsidiantrommel mit Kristallband als Fuß, darauf eine dunkle, durchscheinende Facettenkuppel (Dreiecksfacetten,
   Leuchtkanten in Spielerfarbe), in der der Schildkern deutlich glüht; massive Emitterprismen neigen sich zur Kuppel.
   I: Kuppel, drei Emitter. II: größere Kuppel, sechs Emitter, Band in Spielerfarbe. III: noch größer, Spitzenkristall,
   schräger Lichtring, kreisende Schildfacetten. */
/* Kuppelpunkte: k Lagen zu n Ecken, jede zweite Lage um eine halbe Facette verdreht, oben ein Scheitel */
function domePts(Rd, H, n, k, sc = 1) {
  const L = [];
  for (let j = 0; j < k; j++) { const f = j / k * Math.PI / 2, rr = Rd * Math.cos(f) * sc, row = []; for (let m = 0; m < n; m++) { const a = m / n * TAU + (j % 2) * Math.PI / n; row.push([Math.cos(a) * rr, H * Math.sin(f) * sc, Math.sin(a) * rr]); } L.push(row); }
  return { L, top: [0, H * sc, 0] };
}
/* Dreiecke zwischen zwei Lagen: Zickzack, damit nur gleichmäßige Dreiecksfacetten entstehen (wie eine Geodäte) */
function domeTris(n, k, cb) {
  for (let j = 0; j < k; j++) for (let m = 0; m < n; m++) {
    const m1 = (m + 1) % n;
    if (j === k - 1) { cb([j, m], [j, m1], 'top'); continue; }
    if (j % 2 === 0) { cb([j, m], [j, m1], [j + 1, m]); cb([j + 1, m], [j, m1], [j + 1, m1]); }
    else { cb([j, m], [j + 1, m1], [j + 1, m]); cb([j, m], [j, m1], [j + 1, m1]); }
  }
}
function domeGeo(Rd, H, n, k) {
  return geo(`nxdome|${Rd}|${H}|${n}|${k}`, () => {
    const { L, top } = domePts(Rd, H, n, k), pos = [], uv = [], V = p => p === 'top' ? top : L[p[0]][p[1]];
    domeTris(n, k, (a, b, c) => {
      let A = V(a), B = V(b), C = V(c);
      const e1 = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]), e2 = new THREE.Vector3(C[0] - A[0], C[1] - A[1], C[2] - A[2]), nn = e1.cross(e2);
      const mx = (A[0] + B[0] + C[0]) / 3, my = (A[1] + B[1] + C[1]) / 3 + H * 0.3, mz = (A[2] + B[2] + C[2]) / 3;
      if (nn.x * mx + nn.y * my + nn.z * mz < 0) [B, C] = [C, B];
      for (const p of [A, B, C]) { pos.push(...p); uv.push(p[0] / 16, p[2] / 16); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    return facetCols(g, 23, 0.72);
  });
}
function domeFrame(Rd, H, n, k, rad) {
  const { L, top } = domePts(Rd, H, n, k, 1.008), pts = [], idx = {}, ed = [], seen = new Set();
  const I = p => { const key = p === 'top' ? 'top' : p.join(','); if (idx[key] === undefined) { idx[key] = pts.length; pts.push(p === 'top' ? top : L[p[0]][p[1]]); } return idx[key]; };
  const E = (a, b) => { const i = I(a), j = I(b), key = Math.min(i, j) + '-' + Math.max(i, j); if (!seen.has(key)) { seen.add(key); ed.push([i, j]); } };
  domeTris(n, k, (a, b, c) => { E(a, b); E(b, c); E(c, a); });
  return frameGeo(`nxdome|${Rd}|${H}|${n}|${k}|${rad}`, pts, ed, rad, 4);
}
registerB('nexus', 'shield', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), Rd = 11 + lv * 2, H = Rd * 0.8;
  g.add(socket(M, X, S, R, 7, { shape: { n: 12, irr: 0 }, up: 0, plate: 0.5, clusters: 3, cAt: 0.74 }));
  const dro = { n: 8, tf: 0.2, tb: 0.2, tw: 0, sq: 1 };
  g.add(grow(5, Rd + 1, X.dark, dro, [0, -1.5, 0], UPV)); g.add(growEdges(X, 5, Rd + 1, dro, [0, -1.5, 0], UPV, X.vein, 0.1, 2));
  g.add(grow(8, 3.5, X.dark, { n: 6, tf: 0.5, tb: 0.1, tw: 0 }, [0, 2, 0], UPV));
  g.add(put(core(M, X, 2.4 + lv * 0.5, 14 + lv * 3, 0.08), 0, H * 0.5, 0));
  g.add(spinning(hring(3.5, 0.35, X.beam, 6, 4, H * 0.5), 'y', 0.5));
  const dm = mesh(domeGeo(Rd, H, 8, 3), S.dome); dm.position.y = 3; dm.renderOrder = 1; g.add(dm);
  g.add(put(mesh(domeFrame(Rd, H, 8, 3, 0.2), S.teamVein, false), 0, 3, 0));
  g.add(band(Rd + 0.6, 1.6, 1.1, lv >= 2 ? S.band : X.cryS, 8, 3));
  const ne = lv === 1 ? 3 : 6;
  for (let i = 0; i < ne; i++) {
    const a = i / ne * TAU + Math.PI / 2, big = i % 2 === 0 || ne === 3, L = big ? 11 + lv * 1.5 : 8, F = P(a, Rd + 4, 0), dv = [-Math.cos(a) * 0.3, 1, -Math.sin(a) * 0.3], o = { n: 3, sq: 1, tw: 0, tf: 0.4, tb: 0.1 };
    g.add(grow(L, big ? 2.4 : 1.6, big ? X.cry : X.cryS, o, F, dv)); if (big) g.add(growEdges(X, L, 2.4, o, F, dv, S.teamVein, 0.1));
    g.add(grow(4, 2, X.dark, { n: 6, tf: 0.3, tb: 0.2, tw: 0 }, [F[0], -1, F[2]], UPV));
    const u = unit(dv); g.add(put(octa(X.veinHot, 0.4, 0.8, 0.4, false), F[0] + u[0] * (L + 0.7), F[1] + u[1] * (L + 0.7), F[2] + u[2] * (L + 0.7)));
  }
  if (lv >= 3) {
    g.add(grow(10, 2, X.cry, { n: 3, sq: 1, tw: 0, tf: 0.45, tb: 0.2 }, [0, H + 2.5, 0], UPV));
    g.add(put(core(M, X, 0.7, 6, 0.15, X.haloW), 0, H + 13, 0));
    const tr = band(Rd + 3.5, 0.8, 0.6, X.cryS, 48); tr.rotation.x = -0.35; const tp = new THREE.Group(); tp.position.y = H * 0.5 + 3; tp.add(tr); tp.userData.spin = { axis: 'y', speed: 0.2 }; g.add(tp);
    const tile = geo('hextileT', () => new THREE.CylinderGeometry(1.6, 1.6, 0.6, 6)), piv = new THREE.Group(); piv.position.y = 8;
    for (let i = 0; i < 4; i++) { const w = new THREE.Group(), t = mesh(tile, X.mirror); t.scale.set(1.1, 1, 1.1); t.rotation.z = 1.2; w.add(t); const a = i / 4 * TAU; w.userData.orbit = { r: 22.5, speed: 0.15, phase: a, wob: 1.2 }; w.position.set(Math.cos(a) * 22.5, 0, Math.sin(a) * 22.5); piv.add(w); }
    g.add(piv);
  }
  anchors(M, X, S, g, [0, 1, 2].map(i => i / 3 * TAU + Math.PI / 2 + Math.PI / 3), 22.5, 1.3, [Rd * 0.85, 4]);
  return g;
});

/* ======================================================================== NETZKNOTEN – Gitterknoten über schwebenden Schollen
   Kein geschlossener Sockel: eine kleine Sechskant-Scholle in der Mitte und drei dreieckige Außenschollen (Spitze
   nach außen), die frei schweben und nur durch Lichtfäden verbunden sind – von oben ein lockeres Dreigestirn, das
   sich von allen übrigen Stationen abhebt. Über der Mitte der schwebende Knotenkristall (großer durchscheinender
   Oktaeder mit Kern) in einem drehenden Oktaedergitter; schräge Kristallbänder (Anzahl = Stufe) kreisen darum.
   I: drei Außenschollen mit Ankern. II: drei kleine Zwischenschollen mit Ankern, zweites Band. III: Netzring
   verbindet alle Anker, Antennenkristall über dem Knoten, mehr Splitter auf den Schollen. */
/* Kleine schwebende Scholle (Radius Rs) mit Leuchtkante, Wurzelkristall und nc Splittern zur Seite a */
function islet(M, X, S, Rs, seed, a, sh, nc) {
  const g = new THREE.Group(), r = rng(seed * 11 + 3), top = Rs * 0.1;
  g.add(put(mesh(islandGeo(Rs, seed, sh), X.dark), 0, -top, 0));
  g.add(put(mesh(islandRim(Rs, seed, Rs * 0.03, 0.14, sh), S.teamVein, false), 0, -top, 0));
  g.add(grow(Rs * 0.7, Rs * 0.16, X.dark, { n: 5, tf: 0.6, tb: 0.1, tw: 0.5 }, [0, -Rs * 0.2, 0], [0, -1, 0]));
  for (let i = 0; i < nc; i++) { const b = a + (i - (nc - 1) / 2) * 0.9 + (r() - 0.5) * 0.3, L = Rs * (0.5 + r() * 0.35); g.add(grow(L, L * 0.2, i % 2 ? X.cryS : X.cry, { n: 4, tf: 0.5, tb: 0.2, tw: 0.5 }, P(b, Rs * 0.45, -0.3), dirE(b, (45 + r() * 25) * DEG))); }
  return g;
}
registerB('nexus', 'relay', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), ny = 10 + lv;
  /* Mittelscholle und Außenschollen (Ecke nach außen) */
  g.add(islet(M, X, S, R * 0.34, 81, 0, { n: 6, irr: 0.03, rot: 0, sx: 1 }, 0));
  const big = [0, 1, 2].map(i => i / 3 * TAU + Math.PI / 2), sm2 = big.map(a => a + Math.PI / 3);
  const tsh = a => ({ n: 3, irr: 0.03, rot: -a, sx: 1 });
  big.forEach((a, i) => { const s = islet(M, X, S, R * 0.3, 82 + i, a, tsh(a), lv >= 3 ? 3 : 2); s.position.set(...P(a, R * 0.64, -0.6)); g.add(s); g.add(beam(X, P(a, R * 0.3, 0.2), P(a, R * 0.45, -0.2), 0.12, S.thread)); });
  if (lv >= 2) sm2.forEach((a, i) => { const s = islet(M, X, S, R * 0.18, 86 + i, a, tsh(a), lv >= 3 ? 2 : 1); s.position.set(...P(a, R * 0.6, -1.2)); g.add(s); });
  g.add(orbiters(M, X, { axis: 'y', n: 6, r: R * 0.5, y: 1.5, size: R * 0.025, speed: 0.08, seed: 8, wob: 0.8 }));
  /* Fuß und Knoten */
  const so = { n: 6, sq: 1, tf: 0.35, tb: 0.1, tw: 0 };
  g.add(grow(8, 3.6, X.dark, so, [0, -1, 0], UPV)); g.add(growEdges(X, 8, 3.6, so, [0, -1, 0], UPV, S.teamVein, 0.1));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; g.add(grow(9, 1.6, X.cryS, { n: 4, tf: 0.5, tb: 0.1, tw: 0.5 }, P(a, 5, 0), [-Math.cos(a) * 0.4, 1, -Math.sin(a) * 0.4])); }
  g.add(beam(X, [0, 5, 0], [0, ny - 3, 0], 0.4, X.beam));
  const nd = new THREE.Group(); nd.position.y = ny;
  const oc = octa(X.cry, 4, 5.5, 4); nd.add(spinning(oc, 'y', 0.4)); nd.add(core(M, X, 1.5 + lv * 0.2, 10, 0.1));
  const cp = [[7, 0, 0], [-7, 0, 0], [0, 8.5, 0], [0, -8, 0], [0, 0, 7], [0, 0, -7]], ce = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
  const cage = new THREE.Group(); cage.add(mesh(frameGeo('nxrelayCage', cp, ce, 0.16), X.beam, false)); cage.add(mesh(nodesGeo('nxrelayCage', cp, 0.55), S.team, false));
  nd.add(spinning(cage, 'y', -0.25)); g.add(nd);
  for (let i = 0; i < lv; i++) { const r = band(9.5 + i * 2, 0.7, 0.5, i === 1 ? X.cryS : S.band, 32); r.rotation.x = (i % 2 ? -0.22 : 0.22); const p = new THREE.Group(); p.position.y = ny; p.add(r); p.userData.spin = { axis: 'y', speed: i % 2 ? -0.35 : 0.3 }; g.add(p); }
  /* Anker auf den Schollen, Fäden zum Knoten */
  anchors(M, X, S, g, big, R * 0.68, 1.35, null);
  for (const a of big) g.add(beam(X, [0, ny, 0], P(a, R * 0.68, 4.7), 0.14, X.beamSoft));
  if (lv >= 2) { anchors(M, X, S, g, sm2, R * 0.62, 0.9, null); for (const a of sm2) g.add(beam(X, [0, ny, 0], P(a, R * 0.62, 3.2), 0.09, S.thread)); }
  if (lv >= 3) {
    const all = [...big.map(a => [a, R * 0.68, 4.7]), ...sm2.map(a => [a, R * 0.62, 3.2])].sort((p, r) => ((p[0] % TAU) + TAU) % TAU - ((r[0] % TAU) + TAU) % TAU);
    for (let i = 0; i < 6; i++) { const [a1, d1, y1] = all[i], [a2, d2, y2] = all[(i + 1) % 6]; g.add(beam(X, P(a1, d1, y1), P(a2, d2, y2), 0.1, S.thread)); }
    g.add(grow(7, 1.2, X.cryS, { n: 3, sq: 1, tw: 0, tf: 0.45, tb: 0.15 }, [0, ny + 5, 0], UPV)); g.add(put(octa(S.team, 0.6, 1, 0.6, false), 0, ny + 12.5, 0));
  }
  g.add(orbiters(M, X, { axis: 'y', n: 2 + lv, r: 13, y: ny + 3, size: 0.45, speed: 0.4, seed: 7, wob: 1.6, mat: X.veinHot }));
  return g;
});

/* ======================================================================== RESONANZ – Kristallkrone, Resonanzringe
   Breite Obsidiantrommel mit Adern in Spielerfarbe, darauf eine durchscheinende Kristallschale, in der mit der Ladung
   der Resonanzkern wächst (charge). Acht massive Kronenkristalle (hell und Obsidian im Wechsel) neigen sich nach
   außen; mit der Ladung leuchten nacheinander ihre Adern und die Resonanzbänder (volle Kristallringe) auf (chargeAt),
   die Bänder pulsieren langsam. I: Krone, drei Bänder. II: vier kreisende Resonanzknoten, Fokuskristalle über dem
   Kern. III: zweite Krone aus kleinen Kristallen, viertes Band, drehender Strichkranz in Spielerfarbe. */
registerB('nexus', 'super', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), cy = 22;
  g.add(socket(M, X, S, R, 9, { n: 14, up: 8, plate: 0.46, clusters: 4, ca: Math.PI / 8 }));
  const po = { n: 8, tf: 0.25, tb: 0.1, tw: 0, sq: 1, wf: 0.8 };
  g.add(grow(14, 12, X.dark, po, [0, -2, 0], UPV)); g.add(growEdges(X, 14, 12, po, [0, -2, 0], UPV, S.teamVein, 0.22));
  const bowl = mesh(geo('nxbowl', () => facetCols(lathe([[2, 9], [7, 10], [11, 15], [12.5, 19], [11, 18.5], [9, 15], [5.5, 11.5], [2, 11], [2, 9]], null, 8).geometry, 4, 0.6)), X.cry); bowl.rotation.y = Math.PI / 8; g.add(bowl);
  g.add(band(12.5, 1.4, 1, S.band, 8, 19));
  const ce = 36 * DEG, CL = 40, co = { n: 5, tf: 0.34, tb: 0.1, tw: 0, sq: 0.8 };
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + Math.PI / 8, F = P(a, 13, 4), dv = dirE(a, ce), dark = i % 2 === 1;
    g.add(grow(CL, 6, dark ? X.dark : X.cry, co, F, dv));
    const ed = growEdges(X, CL, 6, co, F, dv, dark ? X.veinHot : S.teamVein, 0.18, dark ? 1 : 2); g.add(ed);
    const v = grow(CL * 0.8, 1.4, X.veinHot, { n: 4, tw: 0, tf: 0.34 }, [F[0] + dv[0] * 2, F[1] + dv[1] * 2, F[2] + dv[2] * 2], dv, false);
    v.userData.chargeAt = 0.1 + i * 0.09; g.add(v);
    if (dark) ed.userData.chargeAt = 0.1 + i * 0.09;
    g.add(grow(10, 3.2, X.dark, { n: 6, tf: 0.5, tb: 0.1, tw: 0 }, P(a, 14, -1), [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5]));
  }
  if (lv >= 3) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(grow(22, 3, i % 2 ? X.cryS : X.cry, { n: 4, tf: 0.4, tb: 0.12, tw: 0.5 }, P(a, 17, 2), dirE(a, 52 * DEG))); }
  const ch = new THREE.Group(); ch.position.y = cy; ch.userData.charge = true; ch.add(core(M, X, 6.5, 44, 0.05)); g.add(ch);
  g.add(spinning(hring(9, 0.5, X.beam, 6, 4, cy), 'y', 0.3));
  const rr = lv >= 3 ? [17, 25, 33, 41] : [18, 28, 38];
  rr.forEach((r, k) => { const y = 4 + (r - 13) * Math.tan(ce) + 7, m = band(r, 1.4 + k * 0.15, 1 + k * 0.1, k % 2 ? S.band : X.cryS, 48, y); m.userData.chargeAt = 0.2 + k * (0.6 / rr.length); m.userData.pulse = { amp: 0.02, speed: 1.1 + k * 0.2 }; g.add(m); g.add(hring(r, 0.25, X.beam, 48, 3, y)); });
  if (lv >= 2) {
    const piv = new THREE.Group(); piv.position.y = 38;
    for (let i = 0; i < 4; i++) { const w = new THREE.Group(); w.add(core(M, X, 1.6, 11, 0.12)); w.add(octa(X.cry, 2, 2.8, 2)); w.add(hring(3.2, 0.3, S.band, 3, 4)); const a = i / 4 * TAU; w.userData.orbit = { r: 26, speed: 0.15, phase: a, wob: 1.5 }; w.position.set(Math.cos(a) * 26, 0, Math.sin(a) * 26); piv.add(w); }
    g.add(piv);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 6; g.add(grow(12, 2, X.cryS, { n: 3, sq: 1, tw: 0, tf: 0.5, tb: 0.15 }, P(a, 11, 48), [-Math.cos(a) * 0.4, -1, -Math.sin(a) * 0.4])); }
  }
  if (lv >= 3) { const dash = new THREE.Group(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; dash.add(grow(6, 1, S.band, { n: 4, tf: 0.5, tb: 0.5, tw: 0 }, P(a, 50, 0), UPV)); } g.add(spinning(dash, 'y', 0.05)); g.add(spinning(band(50, 1.2, 0.9, X.cryS, 48, 1), 'y', 0.05)); }
  anchors(M, X, S, g, [0, 1, 2].map(i => i / 3 * TAU), 46, 2, [14, 10]);
  return g;
});

/* ======================================================================== GITTERWALL – Feldemitter (Schildwall)
   Länglicher Sechskantsockel (Längsachse Z), an beiden Enden ein Obsidian-Obelisk (Dreikant, Leuchtkanten in
   Spielerfarbe), dazwischen ein leuchtendes Gitter aus Lichtstreben mit Knoten – das Wandgitter, aus dem das Feld
   wächst (das Feld selbst zeichnet entities.js). Über der Mitte schwebt der Emitterkristall mit hellem Kern.
   I: zwei Gitterreihen. II: dritte Reihe, Sechseckringe drehen um die Obelisken, Stützkristalle an den Flanken.
   III: höhere Obelisken mit Lichtspitzen und zweitem Ring, Dreiecksring um den Emitter, kreisende Splitter.
   Eigenes Modell statt des allgemeinen aus extra22.js (das nur Fraktionen ohne eigenes Modell bedient). */
registerB('nexus', 'wall', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, root = new THREE.Group(), g = new THREE.Group(), zo = R * 0.6, OL = 15 + lv * 3, ey = 14 + lv * 2.5;
  g.add(socket(M, X, S, R, 11, { shape: { n: 6, sx: 0.5, rot: Math.PI / 2 }, up: 0, plate: 0.25, clusters: 0, cloud: 4, glow: 0.3 }));
  const oo = { n: 3, sq: 1, tf: 0.3, tb: 0.06, tw: 0, rot: -30 * DEG };
  for (const sg of [-1, 1]) {
    const F = [0, -0.5, sg * zo];
    g.add(grow(4, 3.4, X.dark, { n: 6, tf: 0.3, tb: 0.2, tw: 0, sq: 1 }, [0, -1, sg * zo], UPV));
    g.add(grow(OL, 2.4, X.dark, oo, F, UPV)); g.add(growEdges(X, OL, 2.4, oo, F, UPV, S.teamVein, 0.12));
    if (lv >= 2) {
      const r1 = spinning(hring(3.6, 0.3, S.band, 6, 3, OL * 0.45), 'y', 0.4 * sg); r1.position.z = sg * zo; g.add(r1);
      for (const sx of [-1, 1]) g.add(grow(7, 1.2, X.cryS, { n: 4, tf: 0.5, tb: 0.2, tw: 0.5 }, [sx * 2, 0, sg * zo], [sx * 0.6, 1, sg * 0.2]));
    }
    if (lv >= 3) { g.add(put(octa(X.veinHot, 0.6, 1.2, 0.6, false), 0, OL + 0.4, sg * zo)); const r2 = spinning(hring(3, 0.25, X.beam, 6, 3, OL * 0.75), 'y', -0.5 * sg); r2.position.z = sg * zo; g.add(r2); }
  }
  /* Wandgitter zwischen den Obelisken: Reihen, Zickzackstreben, Knoten */
  const rows = lv >= 2 ? [3, 7.5, 12] : [3.5, 10], cols = 5, pts = [], ed = [];
  rows.forEach((y, j) => {
    for (let i = 0; i < cols; i++) {
      pts.push([0, y, -zo + 2 + i / (cols - 1) * (zo - 2) * 2]); const k = pts.length - 1;
      if (i) ed.push([k - 1, k]);
      if (j) { ed.push([k, k - cols]); if ((i + j) % 2 === 0 && i < cols - 1) ed.push([k, k - cols + 1]); if ((i + j) % 2 === 1 && i > 0) ed.push([k, k - cols - 1]); }
    }
  });
  const key = 'nxwall' + rows.length;
  g.add(mesh(frameGeo(key, pts, ed, 0.22), X.beam, false)); g.add(mesh(nodesGeo(key, pts, 0.6), S.team, false));
  /* Emitter */
  const em = new THREE.Group(); em.position.y = ey; g.add(em);
  em.add(spinning(octa(X.cry, 2.4, 4, 2.4), 'y', 0.5)); em.add(core(M, X, 1.3 + lv * 0.2, 11, 0.12));
  g.add(beam(X, [0, rows[rows.length - 1], 0], [0, ey - 3.5, 0], 0.25, X.beamSoft));
  if (lv >= 3) { em.add(spinning(hring(5, 0.4, S.band, 3, 4), 'y', 0.6)); g.add(orbiters(M, X, { axis: 'y', n: 4, r: 7, y: ey, size: 0.5, speed: 0.5, seed: 12, wob: 1, mat: X.veinHot })); }
  /* gebaut längs Z, gedreht auf die Längsachse X (wie die übrigen Schildwälle) */
  g.rotation.y = Math.PI / 2; root.add(g);
  return root;
});

/* ======================================================================== LAUSCHKRISTALL – Frühwarnstation
   Fünfecksockel, darauf ein hoher fünfkantiger Obsidianstamm mit Leuchtkanten, oben ein schräg gestellter Fächer aus
   flachen Kristallblättern (eine Kristallschüssel), der sich langsam dreht; in der Mitte ein Lichtkern, davor eine
   Empfangsnadel mit Spitze in Spielerfarbe. Klar anders als der Netzknoten: hoch, mit großer flacher Schüssel.
   I: sechs Blätter. II: neun Blätter, gegenläufiger Sechseckring unter der Schüssel, drei Horchnadeln am Fuß.
   III: zwölf Blätter mit Leuchtkanten, zweiter Ring, kreisende Splitter auf weiter Bahn. */
registerB('nexus', 'radar', (M, d, lv) => {
  const X = xm(M), S = sm(M), R = d.r, g = new THREE.Group(), rsh = { n: 5, rot: Math.PI / 2 }, sy = 17 + lv * 1.5;
  g.add(socket(M, X, S, R, 12, { shape: rsh, up: 5, upAt: 0.6, plate: 0.32, clusters: 2, cAt: 0.55, cloud: 5 }));
  const so = { n: 5, sq: 1, tf: 0.1, tb: 0.1, tw: 0 };
  g.add(grow(5, 6, X.dark, { n: 5, tf: 0.3, tb: 0.2, tw: 0, sq: 1 }, [0, -1, 0], UPV));
  g.add(grow(sy, 2.4, X.dark, so, [0, 0, 0], UPV)); g.add(growEdges(X, sy, 2.4, so, [0, 0, 0], UPV, S.teamVein, 0.1));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; g.add(grow(9, 1.5, X.cry, { n: 4, tf: 0.45, tb: 0.15, tw: 0 }, P(a, 4.5, 0), [-Math.cos(a) * 0.25, 1, -Math.sin(a) * 0.25])); }
  /* Schüssel: Drehteller (Y) mit schräg gestelltem Fächer */
  const dk = new THREE.Group(); dk.position.y = sy; dk.userData.spin = { axis: 'y', speed: 0.35 }; g.add(dk);
  const tilt = new THREE.Group(); tilt.rotation.x = 0.55; dk.add(tilt);
  const np = [6, 9, 12][lv - 1], PL = 9 + lv, po = { n: 4, sq: 0.3, tf: 0.4, tb: 0.1, tw: 0 };
  for (let i = 0; i < np; i++) {
    const a = i / np * TAU, F = P(a, 1.5, 0), dv = dirE(a, 32 * DEG);
    tilt.add(grow(PL, 2.2, i % 2 ? X.cryS : X.cry, po, F, dv));
    if (lv >= 3 || i % 2 === 0) tilt.add(growEdges(X, PL, 2.2, po, F, dv, S.teamVein, 0.08, 2));
  }
  tilt.add(band(PL * 0.86, 0.6, 0.5, S.band, 24, PL * 0.53));
  tilt.add(core(M, X, 1.4 + lv * 0.15, 9, 0.12));
  tilt.add(grow(7, 0.5, X.veinHot, { n: 4, tf: 0.5, tb: 0.1, tw: 0 }, [0, 0, 0], UPV, false)); tilt.add(put(octa(S.team, 0.6, 1, 0.6, false), 0, 7.6, 0));
  if (lv >= 2) {
    g.add(spinning(hring(6.5, 0.45, S.band, 6, 3, sy - 3), 'y', -0.5));
    for (const a of cornerA(rsh).filter((_, i) => i % 2 === 0).slice(0, 3)) { const F = P(a, 13, 0); g.add(grow(10 + lv, 0.8, X.cryS, { n: 3, sq: 1, tf: 0.5, tb: 0.1, tw: 0 }, F, UPV)); g.add(put(octa(X.veinHot, 0.35, 0.7, 0.35, false), F[0], 11 + lv, F[2])); g.add(beam(X, [F[0], 10 + lv, F[2]], [0, sy - 3, 0], 0.08, S.thread)); }
  }
  if (lv >= 3) {
    /* Nebenschüssel auf einem Seitenarm, dreht gegenläufig */
    const sa = 0.3, [sx, , sz] = P(sa, 11), ny2 = sy * 0.55;
    g.add(grow(10, 0.9, X.dark, { n: 4, tf: 0.2, tb: 0.1, tw: 0 }, [0, ny2 - 4, 0], [sx, 4, sz]));
    const d2 = new THREE.Group(); d2.position.set(sx, ny2 + 1, sz); d2.userData.spin = { axis: 'y', speed: -0.6 }; g.add(d2);
    const t2 = new THREE.Group(); t2.rotation.x = 0.7; d2.add(t2);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; t2.add(grow(6.5, 1.5, i % 2 ? X.cryS : X.cry, po, P(a, 0.8, 0), dirE(a, 32 * DEG))); }
    t2.add(core(M, X, 0.8, 5, 0.15)); t2.add(band(5.4, 0.4, 0.35, S.band, 16, 3.4));
    g.add(spinning(hring(7, 0.3, X.beam, 6, 3, sy - 6), 'y', 0.4)); g.add(orbiters(M, X, { axis: 'y', n: 5, r: R * 0.8, y: sy * 0.6, size: 0.7, speed: 0.12, seed: 14, wob: 2 })); }
  anchors(M, X, S, g, cornerA(rsh).filter((_, i) => i % 2 === 1), R * 0.68, 1.2, [2.4, 6]);
  return g;
});
