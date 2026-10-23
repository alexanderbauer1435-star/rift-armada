/* 3D im echten Spiel: startet ein Gefecht mit Grafik 3D, prüft Fehler, Projektion (Tippen trifft Schiffe), Balken, Umschalten 2D/3D,
   und rendert Bilder nach tools/shots/g3d-*.png.  node tools/game3d.js [build/Rift-Armada-NN.html] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'build', 'rift-armada.html');
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 }, locale: 'de-DE', hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0 }, menu: {} })); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [], fails = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const check = (n, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + n); if (!ok) fails.push(n); };
  await page.goto('file://' + file); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  check('3D aktiv', await page.evaluate(() => R.mode3d === true && !document.getElementById('view3d').hidden));
  await page.evaluate(() => { MENU.map = 'haven'; MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
  await page.waitForTimeout(2500);
  check('Partie läuft in 3D', await page.evaluate(() => !!UI.g && R.mode3d));
  await page.evaluate(() => { UI.speed = 0; const g = UI.g, me = UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); R.center(b.x, b.y); });
  await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, 'g3d-01-base.png') });
  /* Tippen auf ein Schiff: Projektion und Auswahl */
  const hit = await page.evaluate(() => { const g = UI.g, me = UI.me, u = g.ships.find(x => x.owner === me && x.def.role !== 'fighter'); const q = R.w2s(u.x, u.y); return { id: u.id, x: q.x, y: q.y, s: q.s }; });
  await page.touchscreen.tap(hit.x, hit.y); await page.waitForTimeout(300);
  check('Tippen trifft das Schiff (Projektion)', await page.evaluate(id => UI.sel.has(id), hit.id));
  await page.screenshot({ path: path.join(OUT, 'g3d-02-sel.png') });
  /* Bauvorschau */
  await page.evaluate(() => { const g = UI.g, me = UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); UI.sel.clear(); UI.mode = 'place'; UI.place = { role: 'yard', x: b.x + 180, y: b.y + 40, ok: true }; });
  await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, 'g3d-03-place.png') });
  await page.evaluate(() => { UI.mode = 'normal'; UI.place = null; });
  /* Kampf: Gegner heranholen, laufen lassen */
  await page.evaluate(() => { const g = UI.g, me = UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); for (let i = 0; i < 5; i++) { const u = addShip(g, i % 2 ? 'hammer' : 'spear', 1, b.x + 420 + i * 40, b.y - 200 + i * 60, Math.PI); u.o = { t: 'amove', x: b.x, y: b.y }; } for (let i = 0; i < 4; i++) { const u = addShip(g, 'lancer', me, b.x + 200, b.y - 100 + i * 50, 0); u.o = { t: 'amove', x: b.x + 400, y: b.y - 100 }; } UI.speed = 1; });
  await page.waitForTimeout(6000); await page.evaluate(() => { UI.speed = 0; }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'g3d-04-fight.png') });
  const st = await page.evaluate(() => RA3D.stats ? RA3D.stats() : null); console.log('stats', JSON.stringify(st));
  /* Zoom weit und Minikarte */
  await page.evaluate(() => { R.zoomAt(500, 300, 0.4); }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, 'g3d-05-far.png') });
  /* Umschalten auf 2D und zurück */
  await page.evaluate(() => { SET.gfx = '2d'; applySet(); }); await page.waitForTimeout(400);
  check('2D-Umschaltung', await page.evaluate(() => !R.mode3d && document.getElementById('view3d').hidden));
  await page.screenshot({ path: path.join(OUT, 'g3d-06-2d.png') });
  await page.evaluate(() => { SET.gfx = '3d'; applySet(); }); await page.waitForTimeout(400);
  check('zurück auf 3D', await page.evaluate(() => R.mode3d));
  /* Pause/Speichern/Laden in 3D */
  await page.evaluate(() => { saveNow(); });
  check('Speichern in 3D', await page.evaluate(() => !!readSave()));
  check('keine Fehler', errs.length === 0);
  if (errs.length) console.log([...new Set(errs)].slice(0, 8).join('\n'));
  console.log(fails.length ? 'FAILS ' + fails.length : 'ALL OK');
  await b.close();
})();
