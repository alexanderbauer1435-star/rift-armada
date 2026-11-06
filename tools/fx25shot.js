/* Bildprüfung Fassung 25 Effekte: Triebwerksbänder und Lichthöfe einer fahrenden Flotte (ohne Bloom), Explosion eines
   großen Schiffs (Druckwelle, Nachexplosionen, glühende Trümmer). node tools/fx25shot.js build/rift-armada.html [ordner] */
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
    RA3D.setAuto(false); RA3D.setQuality({ bloom: false });
    const g = UI.g, me = UI.me; for (const q of g.players) q.nob = true;
    const b = g.bldgs.find(x => x.owner === me && x.role === 'base'), x0 = b.x + 300, y0 = b.y - 200;
    const ids = ['lancer', 'bulwark', 'aegis', 'reckoning', 'haven', 'wren'], us = [];
    for (let k = 0; k < 12; k++) { const u = addShip(g, ids[k % ids.length], me, x0 + (k % 4) * 70, y0 + ((k / 4) | 0) * 80, 0); us.push(u); }
    for (const u of us) { u.o = { t: 'move', x: u.x + 1400, y: u.y + 300 }; u.path = null; u.v = u.def.speed; }
    for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: x0, y: y0, r: 4000, owner: me, until: 1e9 });
    window.__U = us; UI.speed = 1; R.cam.z = 1.1;
  });
  for (let i = 0; i < 12; i++) { await p.evaluate(() => { const u = __U[1]; R.center(u.x + 60, u.y + 40); }); await p.waitForTimeout(500); }
  await p.screenshot({ path: OUT + '/fx25-trails.jpg', type: 'jpeg', quality: 90 });
  /* großes Schiff zerstören */
  const at = await p.evaluate(() => { const u = __U.find(q => q.def.cls === 'l') || __U[4]; UI.speed = 0.35; R.center(u.x, u.y); R.cam.z = 1.4; kill(UI.g, u, null, 1); return u.def.id; });
  await p.waitForTimeout(450); await p.screenshot({ path: OUT + '/fx25-boom1.jpg', type: 'jpeg', quality: 90 });
  await p.waitForTimeout(900); await p.screenshot({ path: OUT + '/fx25-boom2.jpg', type: 'jpeg', quality: 90 });
  await p.waitForTimeout(2500); await p.screenshot({ path: OUT + '/fx25-boom3.jpg', type: 'jpeg', quality: 90 });
  const ok = !errs.length; console.log((ok ? 'OK   ' : 'FAIL ') + 'Effekte (' + at + ')' + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
