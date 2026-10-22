/* Bildschirmtests im Handyformat: Seite laden, Fehler sammeln, Schritte ausführen, Screenshots schreiben.
   Aufruf: node tools/shot.js build/Rift-Armada-01.html [szenario] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-01.html'), scen = process.argv[3] || 'all';
const OUT = path.resolve(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(800);
  const shot = async n => { await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  await shot('01-menu');
  await page.click('#mSkirm'); await page.waitForTimeout(300);
  await shot('02-setup');
  await page.click('#mStart'); await page.waitForTimeout(1200);
  await shot('03-game-start');
  /* Bauschiff wählen und Baumenü zeigen */
  await page.evaluate(() => { const g = RA.UI.g, u = g.ships.find(x => x.owner === RA.UI.me && x.def.build); RA.UI.sel.clear(); RA.UI.sel.add(u.id); RA.UI.selB = 0; hudSel(); R.center(u.x, u.y); });
  await page.waitForTimeout(300);
  await shot('04-build-menu');
  /* Werft bauen lassen und 90 Sekunden vorspulen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, u = g.ships.find(x => x.owner === me && x.def.build), b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const s = aiSpot(g, me, 'yard', b.x, b.y, 150, 320); RA.issue({ t: 'build', u: [u.id], role: 'yard', x: s.x, y: s.y }); RA.step(30 * 45); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, y = g.bldgs.find(x => x.owner === me && x.role === 'yard'); if (y) { RA.UI.selB = y.id; RA.UI.sel.clear(); hudSel(); R.center(y.x, y.y); } });
  await page.waitForTimeout(300);
  await shot('05-yard');
  /* Kampf: Flotten aufeinander loslassen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, foe = 1 - me, s = g.players[me].start, f = g.players[foe].start; const cx = (s.x + f.x) / 2, cy = (s.y + f.y) / 2; const A = [], B = []; const la = me === 0 ? ['lancer', 'lancer', 'wren', 'bulwark'] : ['hedgehog', 'hedgehog', 'needle', 'spear']; const lb = me === 0 ? ['hedgehog', 'hedgehog', 'needle', 'spear', 'hammer'] : ['lancer', 'lancer', 'wren', 'bulwark', 'haven']; la.forEach((t, i) => A.push(addShip(g, t, me, cx - 300, cy + i * 50 - 100, 0))); lb.forEach((t, i) => B.push(addShip(g, t, foe, cx + 300, cy + i * 50 - 100, Math.PI))); cmdMove(g, A, cx + 200, cy, true, 'wedge'); cmdMove(g, B, cx - 200, cy, true, 'wedge'); RA.UI.sel.clear(); for (const u of A) RA.UI.sel.add(u.id); hudSel(); R.cam.z = 1; R.center(cx, cy); RA.step(30 * 4); });
  await page.waitForTimeout(400);
  await shot('06-battle');
  await page.evaluate(() => { RA.step(30 * 3); });
  await page.waitForTimeout(300);
  await shot('07-battle2');
  await page.evaluate(() => { RA.UI.showRange = true; RA.step(5); });
  await page.waitForTimeout(200);
  await shot('08-ranges');
  /* Pause und Einstellungen */
  await page.evaluate(() => setPaused(true)); await page.waitForTimeout(200); await shot('09-pause');
  await page.evaluate(() => { setPaused(false); });
  /* Stufen der Gebäude: alle Stationen auf Stufe 3 */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const roles = ['refinery', 'reactor', 'lab', 'turret', g.players[me].faction === 'alliance' ? 'shield' : 'flak', 'relay']; let i = 0; for (const r of roles) { const s = aiSpot(g, me, r, b.x, b.y, 170, 360); if (s) { const nb = addBldg(g, r, me, s.x, s.y, true); nb.lv = 1 + (i % 3); nb.hullMax = nb.def.lv[nb.lv - 1].hull; nb.hull = nb.hullMax; recalcPower(g, me); } i++; } const y = g.bldgs.find(x => x.owner === me && x.role === 'yard'); if (y) { y.lv = 3; y.done = true; y.prog = 1; } b.lv = 3; R.cam.z = 0.8; R.center(b.x, b.y); RA.UI.sel.clear(); RA.UI.selB = b.id; hudSel(); RA.step(10); });
  await page.waitForTimeout(400);
  await shot('10-base-lv3');
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); b.lv = 1; RA.step(10); });
  await page.waitForTimeout(300);
  await shot('11-base-lv1');
  await page.evaluate(() => { R.cam.z = 0.3; R.clampCam(); });
  await page.waitForTimeout(300);
  await shot('12-overview');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
