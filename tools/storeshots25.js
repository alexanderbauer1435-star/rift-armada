/* Store-Bilder Fassung 25 (quer, 1920×1080, Ultra, ohne Bedienleisten – sprachneutral; die Überschriften setzt
   tools/storecaps25.py je Sprache darauf). node tools/storeshots25.js [build/rift-armada.html] [nur=1,2,…]
   → store/graphics/raw25/scene-<n>.png
   1 Raumschlacht · 2 Basis · 3 Sprungtor · 4 Brood aus dem Risstor · 5 Großkampfschiffe mit Schäden und Triebwerksspuren */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'rift-armada.html')), OUT = path.join(__dirname, '..', 'store', 'graphics', 'raw25');
const ONLY = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
const want = n => !ONLY.length || ONLY.includes(n);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  async function page() {
    const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'ultra', hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
    await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
    return p;
  }
  const clean = p => p.addStyleTag({ content: 'body > *:not(#view3d):not(#view) { display: none !important; }' });
  const shot = async (p, n) => { await p.evaluate(() => { try { FX.list.length = 0; } catch (e) {} }); await p.screenshot({ path: path.join(OUT, `scene-${n}.png`) }); console.log('Bild ' + n); };
  const reveal = p => p.evaluate(() => { const g = UI.g, me = UI.me; for (const q of g.players) q.nob = true; for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 99999, owner: me, until: 1e9 }); });

  /* 1 Raumschlacht: Allianz gegen Mars, Strahlen, Torpedos, Explosionen */
  if (want(1)) {
    const p = await page();
    await p.evaluate(() => beginGame({ map: 'haven', seed: 7, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(3000); await reveal(p); await clean(p);
    await p.evaluate(() => {
      const g = UI.g, me = UI.me, foe = 1 - me, cx = g.map.w / 2, cy = g.map.h / 2;
      const A = ['haven', 'bulwark', 'aegis', 'lancer', 'lancer', 'reckoning', 'wren', 'wren', 'beacon', 'bulwark'], M = ['olympus', 'hammer', 'spear', 'hedgehog', 'needle', 'needle', 'longshot', 'spear', 'hammer', 'wasp'];
      A.forEach((id, k) => { const u = addShip(g, id, me, cx - 230 - (k % 4) * 55, cy - 140 + ((k / 4) | 0) * 120 + (k % 2) * 30, 0); u.o = { t: 'amove', x: cx + 400, y: cy }; });
      M.forEach((id, k) => { const u = addShip(g, id, foe, cx + 230 + (k % 4) * 55, cy - 140 + ((k / 4) | 0) * 120 + (k % 2) * 30, Math.PI); u.o = { t: 'amove', x: cx - 400, y: cy }; });
      R.center(cx, cy + 20); R.cam.z = 1.15; UI.speed = 1;
    });
    await p.waitForTimeout(9000);
    await p.evaluate(() => { const g = UI.g; R.center(g.map.w / 2, g.map.h / 2 + 20); });
    await p.waitForTimeout(600); await shot(p, 1); await p.close();
  }
  /* 2 Basis nach sieben Minuten KI-Spiel, Stationen auf Stufe 2–3 */
  if (want(2)) {
    const p = await page();
    await p.evaluate(() => { MENU.map = 'crown'; MENU.size = 'normal'; MENU.slots = [{ f: 'brood', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
    await p.waitForTimeout(2500);
    await p.evaluate(() => { const g = UI.g, me = UI.me; UI.speed = 0; g.players[me].ai = aiInit(3); for (let i = 0; i < 480 / STEP && !g.over; i++) stepGame(g); g.events.length = 0; for (const s of g.bldgs) if (s.owner === me && !s.dead) s.lv = Math.max(s.lv || 1, 2 + (s.id % 2)); });
    await reveal(p); await clean(p);
    await p.evaluate(() => { const g = UI.g, me = UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); R.center(b.x + 60, b.y + 40); R.cam.z = 0.95; UI.speed = 1; });
    await p.waitForTimeout(8000); await shot(p, 2); await p.close();
  }
  /* 3 Sprungtor: Flotte fliegt durch, am Partnertor treten Schiffe aus */
  if (want(3)) {
    const p = await page();
    await p.evaluate(() => beginGame({ map: 'twingates', seed: 4, pace: 'tactical', players: [{ faction: 'legion', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(3000); await reveal(p); await clean(p);
    await p.evaluate(() => {
      const g = UI.g, me = UI.me, gt = g.gates[0], pair = g.byId.get(gt.pair);
      for (const x of [gt, pair]) { x.state = 'active'; x.owner = me; x.mode = 'bridge'; }
      const ids = ['basilica', 'herald', 'herald', 'gleaner', 'herald', 'sovereign'];
      ids.forEach((id, k) => { const u = addShip(g, id, me, gt.x - 200 - k * 90, gt.y + (k % 2 ? 40 : -40), 0); u.o = { t: 'move', x: gt.x + 10, y: gt.y }; u.path = null; });
      window.__P = pair; R.center(pair.x + 80, pair.y); R.cam.z = 1.25; UI.speed = 1;
    });
    await p.waitForFunction(() => UI.g.ships.filter(u => u.owner === UI.me && Math.hypot(u.x - __P.x, u.y - __P.y) < 260).length >= 3, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(150); await shot(p, 3); await p.close();
  }
  /* 4 Wellenmodus: Risstor offen, die Brood tritt aus, Verteidiger davor */
  if (want(4)) {
    const p = await page();
    await p.evaluate(() => { toMenu(); MENU.mode = 'survival'; MENU.faction = 'mars'; });
    await p.waitForTimeout(300); await p.click('#mWaves'); await p.waitForTimeout(200); await p.click('#mStart'); await p.waitForTimeout(3000);
    await reveal(p); await clean(p);
    await p.evaluate(() => { const W = UI.g.wave; W.n = 6; W.next = 10.5; UI.speed = 1; });
    await p.waitForFunction(() => UI.g.wave.soon && UI.g.wave.soon.length, null, { timeout: 60000 });
    await p.evaluate(() => {
      const g = UI.g, W = g.wave, r = W.soon[0], me = UI.me, tg = { x: g.map.w / 2, y: g.map.h / 2 }, a = Math.atan2(tg.y - r.y, tg.x - r.x);
      ['hammer', 'spear', 'hedgehog', 'needle', 'spear'].forEach((id, k) => { const u = addShip(g, id, me, r.x + Math.cos(a) * (330 + (k % 2) * 60) + Math.sin(a) * (k - 2) * 70, r.y + Math.sin(a) * (330 + (k % 2) * 60) - Math.cos(a) * (k - 2) * 70, a + Math.PI); u.o = { t: 'hold' }; });
      window.__R = r; R.center(r.x + Math.cos(a) * 170, r.y + Math.sin(a) * 170); R.cam.z = 1.0; W.next = 0.05;
    });
    await p.waitForFunction(() => UI.g.wave.ids.length >= 5, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(1200); await shot(p, 4); await p.close();
  }
  /* 5 Großkampfschiffe nah: Schadensstufen, Triebwerksspuren, Lichthöfe */
  if (want(5)) {
    const p = await page();
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'nexus', human: true, team: 0 }, { faction: 'brood', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(3000); await reveal(p); await clean(p);
    await p.evaluate(() => {
      const g = UI.g, me = UI.me, foe = 1 - me, cx = g.map.w / 2, cy = g.map.h / 2;
      const a = addShip(g, 'facet', me, cx - 160, cy + 30, 0), b = addShip(g, 'monolith', me, cx - 260, cy - 80, 0), c = addShip(g, 'leviathan', foe, cx + 170, cy - 20, Math.PI), d = addShip(g, 'matriarch', foe, cx + 260, cy + 110, Math.PI);
      c.hull = c.def.hull * 0.3; d.hull = d.def.hull * 0.55; b.hull = b.def.hull * 0.5;
      for (const u of [a, b]) u.o = { t: 'attack', id: c.id }; for (const u of [c, d]) u.o = { t: 'attack', id: a.id };
      R.center(cx + 20, cy + 10); R.cam.z = 1.9; UI.speed = 0.6;
    });
    await p.waitForTimeout(7000); await shot(p, 5); await p.close();
  }
  console.log(errs.length ? 'FEHLER\n' + errs.slice(0, 5).join('\n') : 'keine Fehler'); await b.close();
})();
