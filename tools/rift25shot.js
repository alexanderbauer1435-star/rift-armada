/* Bildprüfung Fassung 25 Risstore: schlafende Tore von Anfang an sichtbar, vor der Welle erwachend, Schiffe treten
   nacheinander aus der Tormitte. 2D und 3D. node tools/rift25shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; let ok = true; const errs = [];
  for (const gfx of ['2d', '3d']) {
    const p = await b.newPage({ viewport: { width: 900, height: 500 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
    await p.addInitScript(g => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: g, lang: 'de', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); }, gfx);
    await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => { toMenu(); MENU.mode = 'survival'; MENU.faction = 'alliance'; });
    await p.waitForTimeout(300); await p.click('#mWaves'); await p.waitForTimeout(200); await p.click('#mStart'); await p.waitForTimeout(3000);
    const r0 = await p.evaluate(() => { const g = UI.g, W = g.wave; for (let i = 0; i < g.players[UI.me].explored.length; i++) g.players[UI.me].explored[i] = 1; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 9000, owner: UI.me, until: 1e9 }); W.next = 10.5; UI.speed = 1; return { n: W.rifts.length }; });
    await p.waitForFunction(() => UI.g.wave.soon && UI.g.wave.soon.length, null, { timeout: 60000 });
    const soon = await p.evaluate(() => { const W = UI.g.wave, r = (W.soon || [])[0] || W.rifts[0]; R.center(r.x, r.y + 60); R.cam.z = 1.1; return { soon: (W.soon || []).length, x: r.x, y: r.y }; });
    await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/rift25-${gfx}-wach.jpg`, type: 'jpeg', quality: 88 });
    await p.evaluate(() => { UI.g.wave.next = 0.05; });
    await p.waitForFunction(() => UI.g.wave.ids.length >= 3, null, { timeout: 90000 }); await p.waitForTimeout(500);
    const st = await p.evaluate(s => { const W = UI.g.wave; return { phase: W.phase, q: W.q.length, ids: W.ids.length, near: W.ids.map(id => UI.g.byId.get(id)).filter(u => u && Math.hypot(u.x - s.x, u.y - s.y) < 260).length }; }, soon);
    await p.screenshot({ path: `${OUT}/rift25-${gfx}-welle.jpg`, type: 'jpeg', quality: 88 });
    const good = r0.n >= 2 && soon.soon >= 1 && st.phase === 'wave' && st.ids >= 1 && st.near >= 1; ok = ok && good;
    res.push(gfx + ': ' + r0.n + ' Tore, ' + soon.soon + ' erwacht, ' + st.ids + ' ausgetreten (' + st.near + ' am Tor), ' + st.q + ' warten ' + (good ? '✓' : '✗'));
    await p.close();
  }
  ok = ok && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Risstore ' + res.join(' · ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
