/* Szenen des Action-Trailers (tools/promo29.js). Jede Szene: Schritte zum Aufbau (laufen in der Seite; Zahlen sind
   Wartezeiten in ms), Dauer in Sekunden, opt.each(i, n) je Bild, opt.hud für Spielansicht mit Bedienleisten.
   Kamera der Kinoszenen: __cam([x, Höhe, y], [Ziel x, Höhe, y], Öffnungswinkel, Rollwinkel). */
const game = (map, seed, fs) => `() => { beginGame({ map: '${map}', seed: ${seed}, pace: 'tactical', players: [${fs.map((f, i) => `{ faction: '${f}', ${i ? 'ai: 0' : 'human: true'}, team: ${i} }`).join(', ')}] }, 'skirmish'); }`;
/* gemeinsamer Anfang: Startschiffe weg, niemand verliert ohne Basis; Hilfen zum Aufstellen */
const prep = () => { const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
  window.__put = (o, list, x, y, ang) => list.map(([id, dx, dy]) => addShip(g, id, o, x + Math.cos(ang) * dx - Math.sin(ang) * dy, y + Math.sin(ang) * dx + Math.cos(ang) * dy, ang));
  window.__near = d => { for (const u of g.ships) for (const w of g.ships) if (!u.dead && !w.dead && g.tm[u.owner] !== g.tm[w.owner] && Math.hypot(u.x - w.x, u.y - w.y) < d) return true; return false; };
  window.__mid = o => { let x = 0, y = 0, k = 0; for (const u of g.ships) if (!u.dead && (o < 0 || u.owner === o)) { x += u.x; y += u.y; k++; } return k ? { x: x / k, y: y / k } : null; };
  window.__norings = () => { for (const u of g.ships) if (u.def.flag && FCMD[u.def.f]) u.abT[FCMD[u.def.f].ab] = 0; }; };
const S = [];

/* K1 Das Tor erlischt: aktiv → flackert → tot, langsame Fahrt darauf zu, zwei Wachschiffe davor */
S.push({ name: 'k1gate', sec: 5, steps: [game('twingates', 4, ['alliance', 'mars']), 3000, prep, () => {
  const g = UI.g, gt = g.gates[3], pr = g.byId.get(gt.pair); window.__G = [gt, pr]; for (const x of [gt, pr]) { x.state = 'active'; x.owner = 0; x.mode = 'bridge'; }
  __put(0, [['lancer', -150, -70], ['wren', -190, 40], ['wren', -120, 90]], gt.x, gt.y, 0).forEach(u => { u.o = { t: 'hold' }; }); __fwd(40); UI.speed = 1;
} ], opt: { each: (i, n) => { const [gt, pr] = __G, t = i / n, st = t < 0.4 ? 'active' : t < 0.78 ? 'flicker' : 'dead'; gt.state = pr.state = st; if (st === 'dead') gt.owner = pr.owner = -1;
  const a = 2.5 - t * 0.3, d = 430 - __ez(t) * 190; __cam([gt.x + Math.cos(a) * d, 215 - t * 70, gt.y + Math.sin(a) * d], [gt.x, 0, gt.y], 36, 0.03); } } });

/* K2 Vorbeiflug: Flaggschiff der Allianz zieht dicht an der Kamera vorbei, Geleit dahinter */
S.push({ name: 'k2flyby', sec: 4.5, steps: [game('expanse', 7, ['alliance', 'mars']), 3000, prep, () => {
  const g = UI.g, cx = 1100, cy = 3350;
  const A = __put(0, [['archipelago', 0, 0], ['bulwark', -90, -70], ['bulwark', -90, 70], ['aegis', -180, 0], ['lancer', -40, -130], ['lancer', -40, 130], ['haven', -290, -60], ['reckoning', -270, 80], ['wren', 60, -90], ['wren', 60, 90], ['lancer', -200, -150], ['lancer', -200, 150]], cx, cy, 0);
  execCmd(g, { t: 'move', p: 0, u: A.map(u => u.id), x: cx + 3000, y: cy }); __fwd(90);
  window.__F = A[0]; UI.speed = 1; const f = A[0]; window.__K = { x: f.x + 105, y: f.y + 47 };
} ], opt: { each: (i, n) => { const f = __F, k = __K, t = i / n; __cam([k.x, 12 + t * 5, k.y], [f.x + 14, 6, f.y], 44, -0.07 + t * 0.06); } } });

/* K3 Trümmerfeld: zerbrochene Station im Trümmerfeld der Karte, treibende Wracks mit glühenden Bruchkanten, Suchschiffe dahinter */
S.push({ name: 'k3debris', sec: 5, steps: [game('expanse', 7, ['alliance', 'mars']), 3000, prep, () => {
  const g = UI.g, cx = 2000, cy = 3073, wr = o => g.wrecks.push(Object.assign({ owner: 0, id: g.nextId++, sal: 100, sal0: 100 }, o));
  wr({ ruin: 1, x: cx + 30, y: cy - 30, ang: 0.6, role: 'base', f: 'alliance', lv: 2, r: 64, until: g.time + 900 });
  wr({ ruin: 1, x: cx + 200, y: cy - 150, ang: 2.1, role: 'yard', f: 'alliance', lv: 1, r: 50, until: g.time + 900 });
  wr({ ruin: 1, x: cx - 90, y: cy - 150, ang: 1.2, role: 'turret', f: 'alliance', lv: 1, r: 20, until: g.time + 900 });
  [['bulwark', -120, 95, 0.4, 8], ['archipelago', 60, 110, 2.6, 11], ['haven', -200, -60, 1.1, 30], ['lancer', -40, 150, 4.0, 40], ['aegis', 170, 30, 5.2, 7], ['wren', -150, 160, 0.9, 50], ['lancer', 90, -110, 3.3, 50], ['reckoning', 250, 130, 0.2, 10], ['wren', 10, 190, 2.2, 60], ['bulwark', -230, 60, 3.9, 13], ['lancer', -90, 30, 1.9, 45], ['wren', 130, 170, 5.0, 55], ['aegis', -20, -120, 0.7, 12], ['lancer', 220, -40, 2.9, 35]]
    .forEach(([type, dx, dy, ang, age]) => wr({ x: cx + dx, y: cy + dy, ang, type, until: g.time + 120 - age }));
  const A = __put(0, [['archipelago', 0, 0], ['lancer', -50, -80], ['lancer', -50, 80], ['bulwark', -120, 0]], cx + 430, cy + 150, Math.PI);
  execCmd(g, { t: 'move', p: 0, u: A.map(u => u.id), x: cx + 120, y: cy + 150 }); window.__C = { x: cx, y: cy }; UI.speed = 0.45;
  /* die Staubscheibe des Trümmerfelds ist für den Blick von oben gemalt; von der Seite wäre sie eine graue Platte */
  const db = RA3D._.S.scene.getObjectByName('debris'); if (db) db.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) { o.visible = false; o.material.opacity = 0; } });
} ], opt: { each: (i, n) => { const c = __C, t = i / n; __cam([c.x - 255 + t * 95, 58 - t * 14, c.y + 190 + t * 30], [c.x + 20, 6, c.y + 10], 40, 0.05 - t * 0.04); } } });

/* K4 Der Riss öffnet sich, die Brood quillt heraus; Kamera fährt zurück und steigt */
S.push({ name: 'k4rift', sec: 5, steps: [() => { toMenu(); MENU.mode = 'survival'; MENU.faction = 'alliance'; document.getElementById('mWaves').click(); }, 400, () => { document.getElementById('mStart').click(); }, 3500, () => {
  const g = UI.g, W = g.wave; W.n = 7; W.next = 10.4; for (let i = 0; i < 4000 && !(W.soon && W.soon.length); i++) { stepGame(g); g.ev.length = 0; }
  const r = W.soon[0], me = UI.me, a = Math.atan2(g.map.h / 2 - r.y, g.map.w / 2 - r.x);
  ['archipelago', 'bulwark', 'bulwark', 'lancer', 'aegis', 'lancer', 'wren'].forEach((id, k) => { const b2 = a + (k - 3) * 0.26, d = 330 + (k % 2) * 60; const u = addShip(g, id, me, r.x + Math.cos(b2) * d, r.y + Math.sin(b2) * d, b2 + Math.PI); u.o = { t: 'hold' }; });
  window.__R = { x: r.x, y: r.y, a }; W.next = 1.2; UI.speed = 1;
} ], opt: { each: (i, n) => { const q = __R, t = i / n, e = __ez(t), d = 240 + e * 290, b = q.a + 0.5 - t * 0.25;
  if (i > 24 && i % 5 === 0) waveEmerge(UI.g, { t: ['ravager', 'swarm', 'spitter', 'larva', 'swarm', 'acidmaw', 'ravager', 'larva', 'leviathan', 'swarm', 'spitter', 'larva'][(i / 5 | 0) % 12], x: q.x, y: q.y });
  __cam([q.x + Math.cos(b) * d, 125 + e * 120, q.y + Math.sin(b) * d], [q.x + Math.cos(q.a) * (20 + e * 100), 4, q.y + Math.sin(q.a) * (20 + e * 100)], 42, 0.04); } } });

/* K5 Schwarm gegen Linie: Kamera fliegt tief von der Allianz durch das Gefecht auf die Brood zu */
S.push({ name: 'k5clash', sec: 5, steps: [game('expanse', 7, ['alliance', 'brood']), 3000, prep, () => {
  const g = UI.g, cx = 1100, cy = 3350;
  const A = __put(0, [['archipelago', 0, 0], ['bulwark', 60, -90], ['bulwark', 60, 90], ['aegis', -70, -50], ['lancer', 110, -170], ['lancer', 110, 170], ['haven', -120, 60], ['reckoning', 40, 0], ['wren', 150, -40], ['wren', 150, 40], ['lancer', 90, -250], ['lancer', 90, 250], ['bulwark', 20, 180], ['wren', 140, 120]], cx - 330, cy, 0);
  const B = __put(1, [['matriarch', 0, 0], ['leviathan', 50, -110], ['behemoth', 50, 110], ['ravager', 110, -40], ['ravager', 110, 40], ['ravager', 120, -160], ['ravager', 120, 160], ['spitter', 30, -200], ['spitter', 30, 200], ['acidmaw', -40, -70], ['acidmaw', -40, 70], ['swarm', 150, 0], ['swarm', 150, -90], ['swarm', 150, 90], ['larva', 170, -30], ['larva', 170, 30], ['larva', 170, -130], ['larva', 170, 130], ['swarm', 140, 220], ['swarm', 140, -220]], cx + 330, cy, Math.PI);
  execCmd(g, { t: 'move', am: 1, p: 0, u: A.map(u => u.id), x: cx + 400, y: cy }); execCmd(g, { t: 'move', am: 1, p: 1, u: B.map(u => u.id), x: cx - 400, y: cy });
  for (let i = 0; i < 3000 && !__near(380); i++) __fwd(1); __fwd(30); UI.speed = 0.6;
} ], opt: { each: (i, n) => { __norings(); const a = __mid(0), b = __mid(1), t = i / n; if (!a || !b) return; const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s = -0.55 + __ez(t) * 1.15, w = Math.sin(t * 3.1) * 42;
  const px = a.x + dx * s - uy * w, py = a.y + dy * s + ux * w; __cam([px, 34 - t * 16, py], [px + ux * 170 - uy * 20, 4, py + uy * 170 + ux * 20], 46, Math.sin(t * 4) * 0.09); } } });

/* K6a Mars: Schlachtlinie feuert Breitseiten, Kamera schaut die Linie entlang */
S.push({ name: 'k6mars', sec: 2.6, steps: [game('expanse', 7, ['mars', 'alliance']), 3000, prep, () => {
  const g = UI.g, cx = 1100, cy = 3350;
  const M = __put(0, [['olympus', 0, 0], ['hammer', 0, 110], ['hammer', 0, -110], ['spear', 0, 220], ['spear', 0, -220], ['spear', 0, 320], ['hedgehog', -50, 60], ['hedgehog', -50, -60]], cx, cy, 0);
  const T = __put(1, [['bulwark', 0, 0], ['bulwark', 0, 120], ['bulwark', 0, -120], ['aegis', 30, 240], ['haven', 60, -230], ['lancer', -30, 60], ['lancer', -30, -60]], cx + 330, cy, Math.PI);
  for (const u of M.concat(T)) u.o = { t: 'hold' }; for (const u of T) { u.hullMax *= 3; u.hull = u.hullMax; } __fwd(50); window.__C = { x: cx, y: cy }; UI.speed = 0.6;
} ], opt: { each: (i, n) => { __norings(); const c = __C, t = i / n; __cam([c.x - 52 + t * 14, 20 + t * 4, c.y - 215 + t * 40], [c.x + 55, 6, c.y + 60], 44, -0.05); } } });

/* K6b Legion: Flaggschiff mit Geleit kommt frontal auf die Kamera zu */
S.push({ name: 'k6legion', sec: 2.6, steps: [game('expanse', 7, ['legion', 'mars']), 3000, prep, () => {
  const g = UI.g, cx = 1100, cy = 3350;
  const A = __put(0, [['sovereign', 0, 0], ['paladin', 40, -70], ['paladin', 40, 70], ['basilica', -110, -90], ['bastion', -100, 90], ['herald', 90, -30], ['herald', 90, 30], ['zealot', -30, -150], ['zealot', -30, 150], ['inquisitor', -200, 0]], cx, cy, 0);
  execCmd(g, { t: 'move', p: 0, u: A.map(u => u.id), x: cx + 3000, y: cy }); __fwd(90); window.__F = A[0]; UI.speed = 1; window.__K = { x: A[0].x + 250, y: A[0].y - 24 };
} ], opt: { each: (i, n) => { const f = __F, k = __K, t = i / n; __cam([k.x, 10 + t * 2, k.y + t * 6], [f.x, 9, f.y], 26, 0.03); } } });

/* K6c Nexus: Kristallschiffe treten aus dem Tor */
S.push({ name: 'k6nexus', sec: 2.8, steps: [game('twingates', 4, ['nexus', 'mars']), 3000, prep, () => {
  const g = UI.g, gt = g.gates[0], pr = g.byId.get(gt.pair); for (const x of [gt, pr]) { x.state = 'active'; x.owner = 0; x.mode = 'bridge'; }
  ['facet', 'prism', 'prism', 'monolith', 'spire', 'shard', 'shard', 'colossus', 'prism'].forEach((id, k) => { const u = addShip(g, id, 0, gt.x - 130 - k * 60, gt.y + (k % 2 ? 45 : -45), 0); u.o = { t: 'move', x: gt.x + 10, y: gt.y }; u.path = null; });
  window.__P = pr; for (let i = 0; i < 6000 && !g.ships.some(u => u.owner === 0 && Math.hypot(u.x - pr.x, u.y - pr.y) < 300); i++) __fwd(1); UI.speed = 0.8;
} ], opt: { each: (i, n) => { const q = __P, t = i / n; __cam([q.x + 175 - t * 20, 30 + t * 6, q.y + 150 - t * 25], [q.x + 20, 10, q.y], 40, -0.04); } } });

/* K7 Die Station fällt: drei Flotten und der Schwarm an einer Basis, sie bricht auseinander, die Kamera stürzt hinein */
S.push({ name: 'k7fall', sec: 6, steps: [game('expanse', 7, ['alliance', 'brood', 'mars', 'legion']), 3000, prep, () => {
  const g = UI.g, bs = g.bldgs.find(b => b.owner === 0 && b.role === 'base'); bs.lv = 3; window.__B = bs; for (const b of g.bldgs.slice()) if (b.owner === 0 && b !== bs) removeBldg(g, b); const cx = bs.x + 20, cy = bs.y + 30;
  const D = __put(0, [['archipelago', 0, 0], ['bulwark', 30, -80], ['bulwark', 30, 80], ['lancer', 70, -30], ['lancer', 70, 30], ['aegis', -40, 60], ['wren', 90, 0]], cx + 150, cy + 60, 0.6);
  const B = __put(1, [['matriarch', 0, 0], ['leviathan', 40, -100], ['ravager', 100, -30], ['ravager', 100, 30], ['spitter', 20, 120], ['acidmaw', -30, 60], ['swarm', 130, 0], ['swarm', 130, -80], ['swarm', 130, 80], ['larva', 150, 40], ['larva', 150, -40], ['ravager', 110, 110]], cx + 620, cy + 260, Math.PI + 0.4);
  const M = __put(2, [['olympus', 0, 0], ['hammer', 30, -100], ['spear', 80, -40], ['spear', 80, 40], ['hedgehog', 40, 100], ['needle', 110, 0], ['needle', 110, 70]], cx + 240, cy + 640, -1.9);
  const Lg = __put(3, [['sovereign', 0, 0], ['basilica', 30, 100], ['paladin', 90, -40], ['paladin', 90, 40], ['herald', 120, 0], ['zealot', 60, -110]], cx + 660, cy - 150, 2.8);
  for (const u of D) u.o = { t: 'hold' };
  [B, M, Lg].forEach((arr, k) => execCmd(g, { t: 'move', am: 1, p: k + 1, u: arr.map(u => u.id), x: cx + 60, y: cy + 60 }));
  for (let i = 0; i < 3000 && !__near(360); i++) __fwd(1); __fwd(130); bs.hull = bs.hullMax * 0.5; UI.speed = 0.7;
  /* Kamera sitzt hinter dem größten Angreifer und schaut über ihn hinweg auf die Station */
  /* Mars kommt von einer Seite, auf der kein Eisbrocken die Sicht auf die Station verdeckt */
  const far = u => !u.dead && Math.hypot(u.x - bs.x, u.y - bs.y) > 260, big = (a, b) => b.def.r - a.def.r; window.__A0 = g.ships.filter(u => u.owner === 2 && far(u)).sort(big)[0] || g.ships.filter(u => u.owner !== 0 && far(u)).sort(big)[0]; window.__D = D; window.__K = null;
} ], opt: { each: (i, n) => { __norings(); const b = __B, g = UI.g, t = i / n, k = Math.round(n * 0.4), f = __A0;
  if (i === k) { damage(g, b, 1e7, 'kin', null, 1, b.x + 80, b.y + 40, null, true); UI.speed = 0.3; }
  if (i === k + 14 && __D[1] && !__D[1].dead) damage(g, __D[1], 1e7, 'kin', null, 1, b.x, b.y, null, true);
  if (i === k + 30 && __D[0] && !__D[0].dead) damage(g, __D[0], 1e7, 'kin', null, 1, b.x, b.y, null, true);
  const L = Math.hypot(f.x - b.x, f.y - b.y) || 1, ux = (f.x - b.x) / L, uy = (f.y - b.y) / L, p = Math.min(1, t / 0.4);
  if (i <= k || !__K) window.__K = [f.x + ux * (125 - p * 25) - uy * 34, 44 - p * 6, f.y + uy * (125 - p * 25) + ux * 34];
  const e = t < 0.4 ? 0 : __ez((t - 0.4) / 0.6), q = __K, end = [b.x + ux * 60 - uy * 10, 16, b.y + uy * 60 + ux * 10];
  __cam(__mix(q, end, e), [b.x, 12, b.y], 40 + e * 6, 0.04 + e * 0.14); } } });

/* ------------------------------------------------------------------ Spielansicht mit Bedienleisten */
/* S1 Basisbau: fertige Basis der Allianz, Werft gewählt */
S.push({ name: 's1base', sec: 5, steps: [() => { MENU.map = 'crown'; MENU.size = 'normal'; MENU.slots = [{ f: 'brood', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); }, 3000, () => {
  const g = UI.g, me = UI.me; UI.speed = 0; g.players[me].ai = aiInit(3); for (let i = 0; i < 460 / STEP && !g.over; i++) stepGame(g); g.ev.length = 0; g.players[me].ai = null;
  for (const s of g.bldgs) if (s.owner === me && !s.dead) s.lv = Math.max(s.lv || 1, 2 + (s.id % 2));
  const y = g.bldgs.find(x => x.owner === me && x.role === 'yard') || g.bldgs.find(x => x.owner === me), bs = g.bldgs.find(x => x.owner === me && x.role === 'base');
  UI.sel.clear(); UI.selB = y.id; hudSel(); window.__B = { x: bs.x, y: bs.y }; R.center(bs.x, bs.y); R.cam.z = 1.2; UI.speed = 1;
} ], opt: { hud: true, each: (i, n) => { const t = i / n, q = __B; R.cam.z = 1.2 + t * 0.15; R.center(q.x - 60 + t * 120, q.y + 10); } } });

/* S2 Flotte befehligen: Flotte wählen, Angriffsbefehl, Gefecht */
S.push({ name: 's2cmd', sec: 6, steps: [game('expanse', 7, ['alliance', 'mars']), 3000, prep, () => {
  const g = UI.g, cx = g.map.w / 2, cy = g.map.h / 2 + 520;
  const A = __put(0, [['archipelago', 0, 0], ['haven', -80, 90], ['bulwark', 60, -70], ['bulwark', 60, 70], ['aegis', -60, -80], ['lancer', 110, -140], ['lancer', 110, 140], ['lancer', 120, 0], ['reckoning', -10, 150], ['wren', 150, -60], ['wren', 150, 60], ['wren', 140, -200], ['lancer', 30, -160], ['bulwark', -40, 0]], cx - 230, cy, 0);
  const M = __put(1, [['olympus', 0, 0], ['hammer', 50, -100], ['hammer', 50, 100], ['spear', 110, -40], ['spear', 110, 40], ['hedgehog', 90, -170], ['hedgehog', 90, 170], ['needle', 150, 0], ['needle', 150, -90], ['needle', 150, 90], ['longshot', -50, -60], ['longshot', -50, 60], ['spear', 100, 230], ['wasp', 140, -230]], cx + 300, cy, Math.PI);
  for (const u of A.concat(M)) u.o = { t: 'hold' }; window.__A = A.map(u => u.id); window.__T = { x: cx + 300, y: cy }; __fwd(20); UI.sel.clear(); UI.selB = 0; hudSel(); R.cam.z = 0.95; R.center(cx - 120, cy); UI.speed = 1.2;
} ], opt: { hud: true, each: (i, n) => { __norings(); const g = UI.g, t = i / n; if (i === 22) { UI.sel.clear(); for (const id of __A) UI.sel.add(id); hudSel(); }
  if (i === 48) { execCmd(g, { t: 'move', am: 1, p: 0, u: __A, x: __T.x, y: __T.y }); execCmd(g, { t: 'move', am: 1, p: 1, u: g.ships.filter(u => u.owner === 1).map(u => u.id), x: __T.x - 500, y: __T.y }); }
  const a = __mid(0), b = __mid(1); if (a && b) { const k = 0.25 + t * 0.25; R.center(a.x + (b.x - a.x) * k, a.y); } R.cam.z = 0.95 + t * 0.25; } } });

/* S3 Fraktionen im Kampf: Legion (Spieler) gegen Brood und Nexus */
S.push({ name: 's3fac', sec: 3.6, steps: [game('expanse', 9, ['legion', 'brood', 'nexus']), 3000, prep, () => {
  const g = UI.g, cx = g.map.w / 2, cy = g.map.h / 2 + 520, fl = [];
  [[['sovereign', 'basilica', 'paladin', 'paladin', 'inquisitor', 'herald', 'herald', 'zealot', 'zealot'], Math.PI], [['matriarch', 'leviathan', 'ravager', 'ravager', 'spitter', 'spitter', 'acidmaw', 'swarm', 'swarm', 'ravager'], -1.05], [['facet', 'monolith', 'prism', 'prism', 'spire', 'lattice', 'shard', 'shard', 'prism'], 1.05]].forEach(([t, an], o) => { const ox = cx + Math.cos(an) * 520, oy = cy + Math.sin(an) * 430;
    fl.push(t.map((id, i) => addShip(g, id, o, ox + Math.cos(an) * ((i % 3) * 70) - Math.sin(an) * (((i / 3) | 0) - 1) * 80, oy + Math.sin(an) * ((i % 3) * 70) + Math.cos(an) * (((i / 3) | 0) - 1) * 80, an + Math.PI))); });
  fl.forEach((arr, o) => execCmd(g, { t: 'move', am: 1, p: o, u: arr.map(u => u.id), x: cx, y: cy }));
  for (let i = 0; i < 3000 && !__near(400); i++) __fwd(1); __fwd(110); const m = __mid(-1); window.__C = { x: m.x, y: m.y }; UI.sel.clear(); for (const u of fl[0]) if (!u.dead) UI.sel.add(u.id); hudSel(); UI.speed = 0.7; R.cam.z = 1.1; R.center(m.x, m.y);
} ], opt: { hud: true, each: (i, n) => { __norings(); const t = i / n, m = __mid(-1), q = __C; if (m) { q.x += (m.x - q.x) * 0.08; q.y += (m.y - q.y) * 0.08; R.center(q.x, q.y); } R.cam.z = 1.1 + t * 0.25; } } });

/* S4 Sprungtor: die Flotte der Legion tritt hinter den feindlichen Linien aus */
S.push({ name: 's4jump', sec: 4, steps: [game('twingates', 4, ['legion', 'mars']), 3000, prep, () => {
  const g = UI.g, me = UI.me, gt = g.gates[0], pr = g.byId.get(gt.pair); for (const x of [gt, pr]) { x.state = 'active'; x.owner = me; x.mode = 'bridge'; }
  const A = ['basilica', 'herald', 'herald', 'paladin', 'zealot', 'sovereign', 'herald', 'paladin', 'zealot'].map((id, k) => { const u = addShip(g, id, me, gt.x - 130 - k * 55, gt.y + (k % 2 ? 45 : -45), 0); u.o = { t: 'move', x: gt.x + 10, y: gt.y }; u.path = null; return u; });
  window.__P = { x: pr.x, y: pr.y }; for (let i = 0; i < 6000 && !g.ships.some(u => u.owner === me && Math.hypot(u.x - pr.x, u.y - pr.y) < 420); i++) __fwd(1);
  UI.sel.clear(); for (const u of A) UI.sel.add(u.id); hudSel(); R.center(pr.x + 60, pr.y); R.cam.z = 1.45; UI.speed = 0.8;
} ], opt: { hud: true, each: (i, n) => { const t = i / n, q = __P; R.cam.z = 1.45 - t * 0.15; R.center(q.x + 60 + t * 70, q.y); } } });

/* S5 Artillerie: Catapults der Allianz beschießen Geschütztürme aus der Ferne */
S.push({ name: 's5arty', sec: 2.8, steps: [game('expanse', 7, ['alliance', 'mars']), 3000, prep, () => {
  const g = UI.g, cx = g.map.w / 2, cy = g.map.h / 2 + 520;
  const C = __put(0, [['catapult', 0, -70], ['catapult', 0, 0], ['catapult', 0, 70], ['bulwark', 80, -40], ['bulwark', 80, 40], ['lancer', 110, 0]], cx - 250, cy, 0);
  const T = [[0, -90], [40, 0], [0, 90], [110, -40], [110, 50]].map(([dx, dy]) => { const b = addBldg(g, 'turret', 1, cx + 330 + dx, cy + dy, true); b.hullMax *= 2; b.hull = b.hullMax; return b; });
  C.forEach((u, k) => { if (u.def.art) execCmd(g, { t: 'attack', p: 0, u: [u.id], e: T[k % T.length].id }); else u.o = { t: 'hold' }; });
  for (let i = 0; i < 1500 && !g.proj.length; i++) __fwd(1); __fwd(25); UI.sel.clear(); for (const u of C) if (u.def.art) UI.sel.add(u.id); hudSel(); window.__C = { x: cx + 40, y: cy }; R.center(cx + 40, cy); R.cam.z = 1.25; UI.speed = 0.8;
} ], opt: { hud: true, each: (i, n) => { const t = i / n, q = __C; R.cam.z = 1.25 + t * 0.12; R.center(q.x + t * 60, q.y); } } });

/* S6 Großkampfschiffe: Nexus gegen Brood aus der Nähe */
S.push({ name: 's6cap', sec: 2.8, steps: [game('expanse', 7, ['nexus', 'brood']), 3000, prep, () => {
  const g = UI.g, me = UI.me, foe = 1 - me, cx = g.map.w / 2, cy = g.map.h / 2 + 520;
  const a = addShip(g, 'facet', me, cx - 130, cy + 30, 0), b2 = addShip(g, 'monolith', me, cx - 200, cy - 80, 0), s1 = addShip(g, 'spire', me, cx - 230, cy + 120, 0), c = addShip(g, 'leviathan', foe, cx + 120, cy - 30, Math.PI), d = addShip(g, 'matriarch', foe, cx + 210, cy + 90, Math.PI), r1 = addShip(g, 'ravager', foe, cx + 160, cy - 140, Math.PI);
  c.hull = c.hullMax * 0.2; d.hull = d.hullMax * 0.6; b2.hull = b2.hullMax * 0.5;
  execCmd(g, { t: 'attack', p: me, u: [a.id, b2.id, s1.id], e: c.id }); execCmd(g, { t: 'attack', p: foe, u: [c.id, d.id, r1.id], e: a.id }); __fwd(40);
  UI.sel.clear(); for (const u of [a, b2, s1]) UI.sel.add(u.id); hudSel(); window.__C = { x: cx, y: cy }; R.center(cx + 20, cy); R.cam.z = 1.6; UI.speed = 0.6;
} ], opt: { hud: true, each: (i, n) => { __norings(); const t = i / n, q = __C; R.cam.z = 1.6 + t * 0.15; R.center(q.x + 20 + t * 30, q.y - 10); } } });

/* S7 Überleben: Wellen aus dem Riss */
S.push({ name: 's7waves', sec: 3.2, steps: [() => { toMenu(); MENU.mode = 'survival'; MENU.faction = 'mars'; document.getElementById('mWaves').click(); }, 400, () => { document.getElementById('mStart').click(); }, 3500, () => {
  const g = UI.g, W = g.wave; W.n = 7; W.next = 10.4; for (let i = 0; i < 4000 && !(W.soon && W.soon.length); i++) { stepGame(g); g.ev.length = 0; }
  const r = W.soon[0], me = UI.me, a = Math.atan2(g.map.h / 2 - r.y, g.map.w / 2 - r.x);
  ['hammer', 'spear', 'hedgehog', 'spear', 'hedgehog', 'needle', 'needle', 'olympus', 'longshot'].forEach((id, k) => { const b2 = a + (k - 4) * 0.24, d = 300 + (k % 2) * 55; const u = addShip(g, id, me, r.x + Math.cos(b2) * d, r.y + Math.sin(b2) * d, b2 + Math.PI); u.o = { t: 'hold' }; });
  window.__R = { x: r.x, y: r.y, a }; W.next = 0.3; __fwd(70); R.center(r.x + Math.cos(a) * 150, r.y + Math.sin(a) * 150); R.cam.z = 1.25; UI.speed = 1;
} ], opt: { hud: true, each: (i, n) => { const t = i / n, q = __R, d = 150 + t * 20; R.cam.z = 1.25 + t * 0.15; R.center(q.x + Math.cos(q.a) * d, q.y + Math.sin(q.a) * d); } } });

module.exports = S;
