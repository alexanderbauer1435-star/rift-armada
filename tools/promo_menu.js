/* Werbefilm: Standbilder der Einsatzseite (englisch), quer und hoch. node tools/promo_menu.js build/rift-armada.html → tools/promo/menu-h.jpg */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, w, h] of [['h', 1280, 720]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 }); const p = await ctx.newPage(); p.on('pageerror', e => console.log('FEHLER', e.message));
    await ctx.addInitScript(() => { window.__RA_TEST = true; try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'en', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} });
    await p.goto('file://' + path.resolve(process.argv[2]), { timeout: 180000 }); await p.waitForTimeout(2500);
    await p.evaluate(() => { CAMP.st = Object.assign(CAMP.st || {}, { e1: 3, e2: 2, e3: 3, e4: 1 }); toMenu(); }); await p.waitForTimeout(1500); await p.evaluate(() => { document.getElementById('mSort').click(); });
    await p.waitForTimeout(2000); await p.screenshot({ path: path.join(__dirname, 'promo', 'menu-' + tag + '.jpg'), type: 'jpeg', quality: 93 });
    await ctx.close();
  }
  await b.close();
})();
