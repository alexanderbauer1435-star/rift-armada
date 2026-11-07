/* Prüfung Fassung 25 Startbild: erscheint sofort, Schiffe der Startfraktion fliegen, Balken erreicht 100 %, danach
   verschwindet es und das Menü ist bedienbar. Ohne __RA_TEST (sonst wird es übersprungen).
   node tools/boot25.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = []; let ok = true; const errs = [];
  for (const [w, h, nm] of [[900, 420, 'quer'], [400, 820, 'hoch']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
    const t0 = Date.now(); p.goto('file://' + F, { timeout: 180000 }).catch(() => {});
    await p.waitForSelector('#boot', { timeout: 30000 });
    await p.waitForTimeout(1600); await p.screenshot({ path: `${OUT}/boot25-${nm}-1.jpg`, type: 'jpeg', quality: 85 });
    await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/boot25-${nm}-2.jpg`, type: 'jpeg', quality: 85 });
    const pct = await p.evaluate(() => { const e = document.getElementById('bootPct'); return e ? e.textContent : 'weg'; });
    let gone = false; try { await p.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 }); gone = true; } catch (e) { /* unten */ }
    const ms = Date.now() - t0;
    const menu = await p.evaluate(() => !!document.getElementById('mStart') && !document.getElementById('menu').hidden);
    const good = gone && menu && ms < 15000; ok = ok && good;
    res.push(`${nm}: Balken ${pct}, weg nach ${(ms / 1000).toFixed(1)} s, Menü ${menu ? 'da' : 'fehlt'} ${good ? '✓' : '✗'}`);
    await p.close();
  }
  ok = ok && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Startbild ' + res.join(' · ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
