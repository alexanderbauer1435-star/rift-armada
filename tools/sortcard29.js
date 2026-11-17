const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let bad = 0;
  for (const [w, h] of [[1280, 720], [720, 1280], [800, 360], [360, 800]]) for (const lang of ['en', 'de', 'pl']) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await ctx.addInitScript(l => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: l, vol: 0, mus: 0, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); }, lang);
    await p.goto('file://' + path.resolve(process.argv[2] || 'build/rift-armada.html')); await p.waitForTimeout(1500);
    await p.evaluate(() => { for (const id of SORTIES) { CAMP.st[id] = 2; CAMP.bt[id] = 388; } toMenu(); }); await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('mSort').click()); await p.waitForTimeout(600);
    const n = await p.evaluate(() => { let k = 0; for (const c of document.querySelectorAll('.scard')) { const s = c.querySelector('.st').getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(c.querySelector('small')); for (const q of r.getClientRects()) if (q.right > s.left + 1 && q.left < s.right && q.bottom > s.top + 1 && q.top < s.bottom) { k++; break; } } return k + '/' + document.querySelectorAll('.scard').length; });
    console.log(w + 'x' + h, lang, n); if (!n.startsWith('0/') || n === '0/0') bad++; await ctx.close(); }
  console.log(bad ? 'FEHLER' : 'ok'); await b.close(); })();
