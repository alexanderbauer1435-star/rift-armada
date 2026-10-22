/* Galerie Fassung 4: alle Schiffe groß vor Nebelhintergrund (zum Beurteilen der Veredelung) */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-04.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 700; cv.style.position = 'fixed'; cv.style.inset = '0'; cv.style.zIndex = '99'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#0a0d1a'; ctx.fillRect(0, 0, 1200, 700);
    const types = Object.keys(SHIPS).filter(t => t !== 'fighter');
    let x = 20, y = 30;
    ctx.font = '13px sans-serif';
    for (const t of types) {
      const def = SHIPS[t], s = 3, c = shipSprite(t, def.f, FACTIONS[def.f].team, s), w = c.width / s * 1.6;
      if (x + w > 1180) { x = 20; y += 150; }
      ctx.drawImage(c, x, y, w, w);
      ctx.fillStyle = '#fff'; ctx.fillText(def.name, x, y + w + 12);
      x += w + 10;
    }
  });
  await page.screenshot({ path: path.resolve(__dirname, 'shots/70-gallery4.png') });
  await browser.close();
})();
