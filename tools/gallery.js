/* Galerie: alle Schiffe und Stationen groß nebeneinander, zum Beurteilen der Zeichnungen */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-02.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900; cv.style.position = 'fixed'; cv.style.inset = '0'; cv.style.zIndex = '99'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#070a14'; ctx.fillRect(0, 0, 1200, 900);
    const types = Object.keys(SHIPS);
    let x = 20, y = 60;
    ctx.font = '13px sans-serif';
    for (const t of types) {
      const def = SHIPS[t], s = 3, c = shipSprite(t, def.f, FACTIONS[def.f].team, s), w = c.width / s * 2;
      if (x + w > 1180) { x = 20; y += 200; }
      ctx.drawImage(c, x, y, w, w);
      ctx.fillStyle = '#fff'; ctx.fillText(def.name + ' (' + def.len + ')', x, y + w + 14);
      x += w + 20;
    }
    y += 220; x = 20;
    for (const f of ['alliance', 'mars']) for (const role of Object.keys(BLDG[f])) {
      for (let lv = 1; lv <= 3; lv++) {
        const r = BLDG[f][role].r, sz = r * 2.4;
        if (x + sz > 1180) { x = 20; y += 150; }
        ctx.save(); ctx.translate(x + sz / 2, y + sz / 2); ctx.scale(1.0, 1.0); drawBldg(ctx, role, f, lv, FACTIONS[f].team, 1.3, null); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.fillText(role + ' ' + lv, x, y + sz + 12);
        x += sz + 10;
      }
    }
  });
  await page.screenshot({ path: 'tools/shots/60-gallery.png' });
  await browser.close();
})();
