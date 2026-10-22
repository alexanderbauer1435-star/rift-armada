/* Schaubilder für die Grafik: Gefecht mit Explosionen, Stationen beider Fraktionen nah, Planet und Nebel.
   Aufruf: node tools/showcase.js build/Rift-Armada-04.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-04.html');
const OUT = path.resolve(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(500);
  const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  for (const f of ['alliance', 'mars']) {
    await page.evaluate(f => { RA.MENU.faction = f; RA.MENU.map = 'haven'; }, f);
    await page.click('#mSkirm'); await page.click('#mStart'); await page.waitForTimeout(900);
    await page.evaluate(() => { RA.UI.speed = 0.001; desel(); });
    /* Basis mit allen Stationen auf Stufe 3 */
    await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const roles = ['yard', 'refinery', 'reactor', 'lab', 'turret', g.players[me].faction === 'alliance' ? 'shield' : 'flak', 'relay', 'super']; for (const r of roles) { const s = aiSpot(g, me, r, b.x, b.y, 170, 420); if (s) { const nb = addBldg(g, r, me, s.x, s.y, true); nb.lv = 3; nb.hullMax = nb.def.lv[2].hull; nb.hull = nb.hullMax; nb.charge = 0.7; recalcPower(g, me); } } b.lv = 3; R.cam.z = 1.0; R.center(b.x, b.y); RA.step(30); });
    await shot('80-base-' + f);
    /* Gefecht nahe am Eismond mit Explosionen */
    await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, foe = 1 - me; const n = g.nodes.find(q => q.kind === 'ice'); const cx = n.x + 300, cy = n.y; const A = [], B = []; const la = g.players[me].faction === 'alliance' ? ['lancer', 'lancer', 'wren', 'bulwark', 'archipelago', 'reckoning'] : ['hedgehog', 'hedgehog', 'needle', 'spear', 'olympus', 'hammer']; const lb = g.players[foe].faction === 'alliance' ? ['lancer', 'lancer', 'wren', 'bulwark', 'haven', 'aegis'] : ['hedgehog', 'hedgehog', 'needle', 'spear', 'hammer', 'wasp']; la.forEach((t, i) => { const u = addShip(g, t, me, cx - 260 + (i % 3) * 40, cy + (i >> 1) * 70 - 90, 0); u.auto = true; A.push(u); }); lb.forEach((t, i) => { const u = addShip(g, t, foe, cx + 260 - (i % 3) * 40, cy + (i >> 1) * 70 - 90, Math.PI); B.push(u); }); cmdMove(g, A, cx + 200, cy, true, 'wedge'); cmdMove(g, B, cx - 200, cy, true, 'wedge'); R.cam.z = 1.15; R.center(cx, cy); RA.step(30 * 5); });
    await shot('81-battle-' + f);
    await page.evaluate(() => { RA.step(30 * 4); });
    await shot('82-battle2-' + f);
    await page.evaluate(() => { RA.step(30 * 5); });
    await shot('83-battle3-' + f);
    await page.evaluate(() => toMenu());
    await page.waitForTimeout(300);
  }
  /* Planet und Nebel: Blick in die Ecke der Karte */
  await page.evaluate(() => { RA.MENU.faction = 'alliance'; });
  await page.click('#mSkirm'); await page.click('#mStart'); await page.waitForTimeout(900);
  await page.evaluate(() => { RA.UI.speed = 0.001; const g = RA.UI.g; R.cam.z = 0.7; R.center(g.map.w * 0.8, g.map.h * 0.25); });
  await shot('84-planet');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
