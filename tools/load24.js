/* Prüfung Fassung 24: Ladebildschirm vor der Schlacht – erscheint, zeigt Fortschritt, baut alle Vorlagen vorab,
   gibt das Spiel danach frei. node tools/load24.js build/rift-armada.html */
const { chromium } = require('playwright'); const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 560 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto' }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(2000);
  const t0 = Date.now();
  await p.evaluate(() => launch(() => beginGame({ map: 'arena', seed: 5, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 1, team: 1 }, { faction: 'brood', ai: 1, team: 2 }] }, 'skirmish')));
  let seen = false, pct = [], shot = false;
  for (let i = 0; i < 600; i++) {
    const s = await p.evaluate(() => { const B = document.getElementById('boot'), fly = !!(B && B.style.display !== 'none' && !B.classList.contains('out')); return { vis: !document.getElementById('loading').hidden || fly, loading: !!UI.loading, pct: fly ? document.getElementById('bootPct').textContent : document.getElementById('loadPct').textContent, t: UI.g ? UI.g.time : -1, left: 0 }; });   /* Fassung 25: Vorbeiflug statt Fenster */
    if (s.vis && s.loading) { seen = true; pct.push(s.pct); if (!shot && parseInt(s.pct) > 20) { shot = true; await p.screenshot({ path: 'tools/shots/load24.jpg', type: 'jpeg', quality: 85 }); } }
    if (seen && !s.vis && !s.loading) break;
    await p.waitForTimeout(250);
  }
  const ms = Date.now() - t0, g0 = await p.evaluate(() => UI.g.time); await p.waitForTimeout(2000); const g1 = await p.evaluate(() => UI.g.time);
  const ok = seen && pct.length > 1 && g1 > g0 && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Ladebildschirm: sichtbar ' + seen + ', Fortschritt ' + [...new Set(pct)].slice(0, 6).join(' → ') + ' … ' + pct[pct.length - 1] + ', Dauer ' + (ms / 1000).toFixed(1) + ' s, Spiel läuft danach ' + (g1 > g0) + (errs.length ? ', Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
