/* Nebelzonen im echten Spiel (3D): node tools/nebshot.js → tools/shots/neb-<map>.png */
const { chromium } = require('playwright'); const path = require('path');
const file = path.join(__dirname, '..', 'build', 'rift-armada.html'), OUT = path.join(__dirname, 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0 }, menu: {} })); } catch (e) {} });
  const errs = [];
  for (const id of ['crown', 'ashfall']) {
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + file); await page.waitForTimeout(800);
    await page.evaluate(id => { window.__RA_TEST = 1; MENU.map = id; MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); }, id);
    await page.waitForTimeout(2500);
    await page.evaluate(() => { UI.speed = 0; const g = UI.g; for (const v of g.players[UI.me].explored || []) {} const n = g.map.nebs.find(o => o.kind === 'ion') || g.map.nebs[0]; if (n) R.center(n.x, n.y); R.zoomAt(500, 300, 0.7); g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 99999, owner: UI.me, until: 9999 }); UI.speed = 1; });
    await page.waitForTimeout(1500); await page.evaluate(() => { UI.speed = 0; }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, 'neb-' + id + '.png') }); console.log('neb-' + id, await page.evaluate(() => UI.g.map.nebs.map(n => n.kind).join(',')));
    await page.close();
  }
  console.log(errs.length ? 'FEHLER ' + errs.join('\n') : 'keine Fehler'); await b.close();
})();
