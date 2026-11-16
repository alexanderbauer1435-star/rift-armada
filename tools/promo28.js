/* Werbefilm Fassung 28: nimmt Spielszenen Bild für Bild auf (Playwright-Uhr; ohne Grafikkarte dauert ein Bild mehrere
   Sekunden), quer 1280×720 und hoch 720×1280, ohne eingebrannte Schrift – Titel und Zeilen setzt tools/promo28.py
   beim Zusammenbau. node tools/promo28.js <build.html> <h|v> [szenen] [probe]
   → tools/promo/<h|v>-<szene>/0000.jpg … (15 Bilder je Sekunde) */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OR = process.argv[3] || 'h';
const ONLY = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null, PROBE = process.argv[5] === 'probe';
const OUT = path.join(__dirname, 'promo'), FPS = +(process.env.FPS || 30), V = OR === 'v', W = V ? 720 : 1280, H = V ? 1280 : 720;
const CLEAN = '#app > *:not(#view3d):not(#view), #fpsBox, #hintCard, #toasts, #errHint, #perfHint { display: none !important; } #view { opacity: 0 !important; }';

async function scene(b, name, steps, sec, opt) {
  if (ONLY && !ONLY.includes(name)) return;
  opt = opt || {};
  const dir = path.join(OUT, OR + '-' + name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  /* Bildtakt drosseln: unter der Playwright-Uhr liefe requestAnimationFrame alle 16 ms, jedes Bild kostet ohne Grafikkarte
     Sekunden. Im Aufbau ein Bild je halbe Sekunde, bei der Aufnahme genau eines je aufgenommenem Bild. */
  await ctx.addInitScript(() => { window.__rafMs = 1500; window.__q = []; window.requestAnimationFrame = cb => { if (window.__grab) { window.__q.push(cb); return 0; } return setTimeout(() => cb(performance.now()), window.__rafMs); }; window.__tick = () => { const q = window.__q; window.__q = []; const t = performance.now(); for (const cb of q) cb(t); const c = document.querySelector('canvas#view3d'); return c ? c.toDataURL('image/jpeg', 0.93) : null; }; window.cancelAnimationFrame = id => clearTimeout(id); });
  await ctx.addInitScript(q => { window.__RA_TEST = true; try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'en', vol: 0, mus: 0, gfxUser: true, qual: q, hints: false, slowmo: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, process.env.QUAL || 'ultra');
  await p.goto('file://' + F, { timeout: 180000 });
  await p.clock.runFor(2500);
  for (const s of steps) { if (typeof s === 'number') await p.clock.runFor(s); else await p.evaluate(`(${s})(${V})`); }
  if (!opt.hud) await p.addStyleTag({ content: CLEAN });
  await p.evaluate(() => { window.__rev = () => { const g = UI.g, me = UI.me; for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 99999, owner: me, until: 1e9 }); }; if (UI.g) window.__rev(); });
  await p.clock.runFor(600);
  await p.evaluate(([f, gr]) => { window.__rafMs = 1000 / f; }, [FPS, 0]); await p.clock.runFor(1000); await p.evaluate(() => { window.__grab = true; }); await p.clock.runFor(1600); await p.evaluate(() => { if (!window.__q.length) throw new Error('kein Bildtakt'); }).catch(e => { throw new Error(name + ': kein Bildtakt ' + errs.join(' / ')); }); await p.clock.runFor(1000);
  const n = PROBE ? 3 : +(process.env.FRAMES || 0) || Math.round(sec * FPS), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const k = PROBE ? Math.round(i * (sec * FPS - 1) / 2) : i;
    if (PROBE && i) await p.clock.runFor((sec * 1000) / 2 - 1000 / FPS);
    if (opt.each) await p.evaluate(`(${opt.each})(${k}, ${Math.round(sec * FPS)}, ${V})`);
    const ta = Date.now(); await p.clock.runFor(1000 / FPS); const tb = Date.now();
    if (process.env.PROF) process.stdout.write('run ' + (tb - ta) + ' ');
    const fn = path.join(dir, String(i).padStart(4, '0') + '.jpg');
    if (opt.hud) { await p.evaluate(() => { window.__tick(); }); await p.screenshot({ path: fn, type: 'jpeg', quality: 92 }); }
    else { const d = await p.evaluate(() => window.__tick()); if (!d) throw new Error('kein Bild'); fs.writeFileSync(fn, Buffer.from(d.split(',')[1], 'base64')); }
    if (process.env.PROF) console.log('shot ' + (Date.now() - tb));
  }
  console.log(OR + '-' + name + ': ' + n + ' Bilder, ' + ((Date.now() - t0) / n / 1000).toFixed(1) + ' s je Bild' + (errs.length ? ' FEHLER ' + errs.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}
const ease = 't => t * t * (3 - 2 * t)';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  /* Risstor: die Brood bricht durch, Verteidiger davor */
  await scene(b, 'rift', [
    () => { toMenu(); MENU.mode = 'survival'; MENU.faction = 'mars'; document.getElementById('mWaves').click(); }, 400,
    () => { document.getElementById('mStart').click(); }, 3500,
    v => { const g = UI.g, W = g.wave; W.n = 7; W.next = 10.4; for (let i = 0; i < 4000 && !(W.soon && W.soon.length); i++) { stepGame(g); g.ev.length = 0; }
      const r = W.soon[0], me = UI.me, tg = { x: g.map.w / 2, y: g.map.h / 2 }, a = Math.atan2(tg.y - r.y, tg.x - r.x);
      ['hammer', 'spear', 'hedgehog', 'spear', 'hedgehog', 'needle', 'needle'].forEach((id, k) => { const b2 = a + (k - 3) * 0.3, d = 300 + (k % 2) * 55; const u = addShip(g, id, me, r.x + Math.cos(b2) * d, r.y + Math.sin(b2) * d, b2 + Math.PI); u.o = { t: 'hold' }; });
      window.__R = { x: r.x, y: r.y, a }; R.center(r.x + Math.cos(a) * 150, r.y + Math.sin(a) * 150); R.cam.z = v ? 1.2 : 1.3; W.next = 0.9; UI.speed = 1; }
  ], 6, { each: (i, n, v) => { const t = i / n, q = window.__R, d = (v ? 250 : 140) + t * 30; R.cam.z = (v ? 1.2 : 1.3) + t * 0.2; R.center(q.x + Math.cos(q.a) * d, q.y + Math.sin(q.a) * d); } });

  /* Große Schlacht: Allianz gegen Mars */
  await scene(b, 'battle', [
    () => { beginGame({ map: 'expanse', seed: 7, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'); }, 3000,
    v => { const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
      const cx = g.map.w / 2, cy = g.map.h / 2 + 520, A = [], M = [];
      const put = (arr, list, side) => list.forEach((id, k) => arr.push(addShip(g, id, side, cx + (side ? 1 : -1) * (330 + (k % 4) * 70), cy - 300 + ((k / 4) | 0) * 130 + (k % 2) * 34, side ? Math.PI : 0)));
      put(A, ['archipelago', 'haven', 'bulwark', 'bulwark', 'aegis', 'lancer', 'lancer', 'lancer', 'reckoning', 'wren', 'wren', 'wren', 'lancer', 'bulwark', 'wren', 'wren', 'lancer', 'lancer'], 0);
      put(M, ['olympus', 'hammer', 'hammer', 'spear', 'spear', 'hedgehog', 'hedgehog', 'needle', 'needle', 'needle', 'longshot', 'longshot', 'spear', 'hedgehog', 'needle', 'wasp', 'needle', 'spear'], 1);
      execCmd(g, { t: 'move', am: 1, p: 0, u: A.map(u => u.id), x: cx + 500, y: cy }); execCmd(g, { t: 'move', am: 1, p: 1, u: M.map(u => u.id), x: cx - 500, y: cy });
      const near = () => { for (const u of g.ships) for (const w of g.ships) if (!u.dead && !w.dead && g.tm[u.owner] !== g.tm[w.owner] && Math.hypot(u.x - w.x, u.y - w.y) < 400) return true; return false; };
      for (let i = 0; i < 3000 && !near(); i++) { stepGame(g); g.ev.length = 0; } for (let i = 0; i < 50; i++) { stepGame(g); g.ev.length = 0; }
      window.__C = { x: cx, y: cy }; UI.speed = 0.7; R.cam.z = v ? 0.8 : 1.0; R.center(cx, cy); }
  ], 8, { each: (i, n, v) => { const t = i / n, g = UI.g; let sx = 0, sy = 0, k = 0; for (const u of g.ships) if (!u.dead) { sx += u.x; sy += u.y; k++; } R.cam.z = (v ? 0.8 : 1.0) + t * 0.5; if (k) R.center(sx / k + (t - 0.5) * 120, sy / k); } });

  /* Sprungtor: Flotte der Legion tritt aus */
  await scene(b, 'gate', [
    () => { beginGame({ map: 'twingates', seed: 4, pace: 'tactical', players: [{ faction: 'legion', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'); }, 3000,
    v => { const g = UI.g, me = UI.me, gt = g.gates[0], pair = g.byId.get(gt.pair);
      for (const x of [gt, pair]) { x.state = 'active'; x.owner = me; x.mode = 'bridge'; }
      ['basilica', 'herald', 'herald', 'paladin', 'zealot', 'sovereign', 'herald', 'paladin', 'zealot'].forEach((id, k) => { const u = addShip(g, id, me, gt.x - 130 - k * 55, gt.y + (k % 2 ? 45 : -45), 0); u.o = { t: 'move', x: gt.x + 10, y: gt.y }; u.path = null; });
      window.__P = { x: pair.x, y: pair.y };
      for (let i = 0; i < 6000 && !g.ships.some(u => u.owner === me && Math.hypot(u.x - pair.x, u.y - pair.y) < 420); i++) { stepGame(g); g.ev.length = 0; }
      for (let i = 0; i < 4000 && g.ships.some(u => u.owner === me && Math.hypot(u.x - gt.x, u.y - gt.y) < 500 && u.x < gt.x - 190); i += 0) { break; }
      R.center(pair.x + 60, pair.y); R.cam.z = v ? 1.15 : 1.5; UI.speed = 0.8; }
  ], 6, { each: (i, n, v) => { const t = i / n, q = window.__P; R.cam.z = (v ? 1.15 : 1.5) - t * 0.2; R.center(q.x + 60 + t * 90, q.y); } });

  /* Drei Fraktionen: Legion, Brood, Nexus */
  await scene(b, 'factions', [
    () => { beginGame({ map: 'expanse', seed: 9, pace: 'tactical', players: [{ faction: 'legion', human: true, team: 0 }, { faction: 'brood', ai: 0, team: 1 }, { faction: 'nexus', ai: 0, team: 2 }] }, 'skirmish'); }, 3000,
    v => { const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
      const cx = g.map.w / 2, cy = g.map.h / 2 + 520, fl = [];
      [[['sovereign', 'basilica', 'paladin', 'paladin', 'inquisitor', 'herald', 'herald', 'zealot', 'zealot'], 0, -1, 0], [['matriarch', 'leviathan', 'ravager', 'ravager', 'spitter', 'spitter', 'acidmaw', 'swarm', 'swarm', 'ravager'], 1, 1, -0.75], [['facet', 'monolith', 'prism', 'prism', 'spire', 'lattice', 'shard', 'shard', 'prism'], 2, 1, 0.75]].forEach(([t, o, sx, sy]) => { const arr = []; const an = o === 0 ? Math.PI : o === 1 ? -1.05 : 1.05, ox = cx + Math.cos(an) * 520, oy = cy + Math.sin(an) * 430; t.forEach((id, i) => arr.push(addShip(g, id, o, ox + Math.cos(an) * ((i % 3) * 70) - Math.sin(an) * (((i / 3) | 0) - 1) * 80, oy + Math.sin(an) * ((i % 3) * 70) + Math.cos(an) * (((i / 3) | 0) - 1) * 80, an + Math.PI))); fl.push(arr); });
      fl.forEach((arr, o) => execCmd(g, { t: 'move', am: 1, p: o, u: arr.map(u => u.id), x: cx, y: cy }));
      const near = () => { for (const u of g.ships) for (const w of g.ships) if (!u.dead && !w.dead && g.tm[u.owner] !== g.tm[w.owner] && Math.hypot(u.x - w.x, u.y - w.y) < 400) return true; return false; };
      for (let i = 0; i < 3000 && !near(); i++) { stepGame(g); g.ev.length = 0; } for (let i = 0; i < 50; i++) { stepGame(g); g.ev.length = 0; }
      let mx = 0, my = 0, mk = 0; for (const u of g.ships) if (!u.dead) { mx += u.x; my += u.y; mk++; } window.__C = { x: mx / mk, y: my / mk }; UI.speed = 0.7; R.cam.z = v ? 0.85 : 1.0; R.center(mx / mk, my / mk); }
  ], 7, { each: (i, n, v) => { const t = i / n, g = UI.g; let sx = 0, sy = 0, k = 0; for (const u of g.ships) if (!u.dead) { sx += u.x; sy += u.y; k++; if (u.def.flag && FCMD[u.def.f]) u.abT[FCMD[u.def.f].ab] = 0; }   /* ohne die großen Befehlsringe der Flaggschiffe */ R.cam.z = (v ? 0.85 : 1.0) + t * 0.4; if (k) { const q = window.__C; q.x += (sx / k - q.x) * 0.08; q.y += (sy / k - q.y) * 0.08; R.center(q.x, q.y); } } });

  /* Großkampfschiffe nah: Nexus gegen Brood, der Leviathan fällt */
  await scene(b, 'capital', [
    () => { beginGame({ map: 'expanse', seed: 7, pace: 'tactical', players: [{ faction: 'nexus', human: true, team: 0 }, { faction: 'brood', ai: 0, team: 1 }] }, 'skirmish'); }, 3000,
    v => { const g = UI.g, me = UI.me, foe = 1 - me, cx = g.map.w / 2, cy = g.map.h / 2 + 520; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
      const a = addShip(g, 'facet', me, cx - 130, cy + 30, 0), b2 = addShip(g, 'monolith', me, cx - 200, cy - 80, 0), s1 = addShip(g, 'spire', me, cx - 230, cy + 120, 0), c = addShip(g, 'leviathan', foe, cx + 120, cy - 30, Math.PI), d = addShip(g, 'matriarch', foe, cx + 210, cy + 90, Math.PI), r1 = addShip(g, 'ravager', foe, cx + 160, cy - 140, Math.PI);
      c.hull = c.hullMax * 0.2; d.hull = d.hullMax * 0.6; b2.hull = b2.hullMax * 0.5;
      for (const u of [a, b2, s1]) u.o = { t: 'attack', id: c.id, hold: 1 }; for (const u of [c, d, r1]) u.o = { t: 'attack', id: a.id, hold: 1 };
      execCmd(g, { t: 'attack', p: me, u: [a.id, b2.id, s1.id], e: c.id }); execCmd(g, { t: 'attack', p: foe, u: [c.id, d.id, r1.id], e: a.id });
      window.__C = { x: cx, y: cy }; R.center(cx + 20, cy); R.cam.z = v ? 1.25 : 1.6; UI.speed = 0.6; }
  ], 7, { each: (i, n, v) => { const t = i / n, q = window.__C; R.cam.z = (v ? 1.25 : 1.6) + t * 0.2; R.center(q.x + 20 + t * 50, q.y - 10); } });

  /* Belagerung: Catapults beschießen die Türme (Einsatz 6) */
  await scene(b, 'siege', [
    () => { misStart('e6'); }, 3000,
    v => { const g = UI.g, M = g.mis, def = MISSIONS.e6; for (let i = 0; i < 20 * 20; i++) { stepGame(g); g.ev.length = 0; if (i % 30 === 0) def.auto(g, M); }
      window.__auto = () => def.auto(g, M); R.center(1900, 1100); R.cam.z = v ? 0.62 : 0.8; UI.speed = 1; }
  ], 5, { each: (i, n, v) => { const t = i / n; if (i % 8 === 0) window.__auto(); R.cam.z = (v ? 0.62 : 0.8) + t * 0.12; R.center(1750 + t * 260, 1100); } });

  /* Basis mit Bedienleisten: zeigt die echte Oberfläche */
  await scene(b, 'base', [
    () => { MENU.map = 'crown'; MENU.size = 'normal'; MENU.slots = [{ f: 'brood', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); }, 3000,
    v => { const g = UI.g, me = UI.me; UI.speed = 0; g.players[me].ai = aiInit(3); for (let i = 0; i < 460 / STEP && !g.over; i++) stepGame(g); g.ev.length = 0; g.players[me].ai = null;
      for (const s of g.bldgs) if (s.owner === me && !s.dead) s.lv = Math.max(s.lv || 1, 2 + (s.id % 2));
      const y = g.bldgs.find(x => x.owner === me && x.role === 'yard') || g.bldgs.find(x => x.owner === me), bs = g.bldgs.find(x => x.owner === me && x.role === 'base');
      UI.sel.clear(); UI.selB = y.id; hudSel(); window.__B = { x: bs.x, y: bs.y }; R.center(bs.x, bs.y); R.cam.z = v ? 0.9 : 1.2; UI.speed = 1; }
  ], 5, { hud: true, each: (i, n, v) => { const t = i / n, q = window.__B; R.cam.z = (v ? 0.9 : 1.2) + t * 0.15; R.center(q.x - 60 + t * 120, q.y + 10); } });

  await b.close();
})();
