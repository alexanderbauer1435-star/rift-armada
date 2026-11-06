/* Bildprüfung Fassung 25 Schatten: Basis mit Schiffen, Schatten aus und an (vereinfachte Schattenwerfer).
   node tools/shadow25shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto', hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(3000);
  await p.evaluate(() => {
    const g = UI.g, me = UI.me; for (const q of g.players) q.nob = true;
    const b = g.bldgs.find(x => x.owner === me && x.role === 'base');
    addBldg(g, 'lab', me, b.x + 150, b.y + 180, true); addBldg(g, 'reactor', me, b.x - 150, b.y + 180, true);
    const ids = ['bulwark', 'aegis', 'haven', 'lancer'];
    ids.forEach((id, k) => { const u = addShip(g, id, me, b.x - 60 + k * 50, b.y + 40 + (k % 2) * 40, 0); u.o = { t: 'hold' }; });
    for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1;
    UI.speed = 0.0001; R.center(b.x, b.y + 90); R.cam.z = 1.5; window.__B = b;
  });
  const res = [];
  for (const on of [false, true]) {
    await p.evaluate(on => RA3D.setGfx({ shadows: on }), on); await p.waitForTimeout(3500);
    res.push((on ? 'an' : 'aus') + ': ' + await p.evaluate(() => { const s = RA3D.stats(); return Math.round(s.tris / 1000) + 'k Dreiecke, ' + s.calls + ' Aufrufe'; }));
    await p.screenshot({ path: `${OUT}/shadow25-${on ? 'on' : 'off'}.jpg`, type: 'jpeg', quality: 90 });
  }
  const ok = !errs.length; console.log((ok ? 'OK   ' : 'FAIL ') + 'Schatten ' + res.join(' / ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
