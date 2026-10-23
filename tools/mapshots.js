/* Kartenvorschauen aus dem Menü: node tools/mapshots.js → tools/shots/map-<id>.png (Vorschau-Leinwand groß gerendert) */
const { chromium } = require('playwright'); const fs = require('fs'); fs.mkdirSync(__dirname + '/shots', { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 900 }, locale: 'de-DE' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../build/rift-armada.html'); await p.waitForTimeout(800);
  const ids = await p.evaluate(() => Object.keys(MAPS).filter(k => !MAPS[k].hidden));
  for (const id of ids) for (const np of await p.evaluate(id => MAPS[id].np, id)) {
    await p.evaluate(([id, np]) => { const m = generateMap(id, np, 7); const cv = document.createElement('canvas'); cv.id = 'shot'; cv.width = Math.round(860 * Math.min(1, m.w / m.h)); cv.height = Math.round(860 * Math.min(1, m.h / m.w)); cv.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99;background:#000'; document.body.appendChild(cv); mapLayout(cv, m, {}); }, [id, np]);
    const el = await p.$('#shot'); await el.screenshot({ path: __dirname + '/shots/map-' + id + '-' + np + '.png' }); await p.evaluate(() => document.getElementById('shot').remove());
    console.log('map-' + id + '-' + np + '.png');
  }
  /* Menü mit Vorschau */
  await p.setViewportSize({ width: 430, height: 900 });
  await p.evaluate(() => { showPage('setup'); }).catch(() => {});
  await p.waitForTimeout(300); await p.screenshot({ path: __dirname + '/shots/menu-map.png' });
  console.log(errs.length ? 'FEHLER: ' + errs.join('\n') : 'keine Fehler'); await b.close();
})();
