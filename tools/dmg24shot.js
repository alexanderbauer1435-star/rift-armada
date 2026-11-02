/* Bildprüfung Fassung 24: Schadensstufen 0–4, zerbrochenes Wrack, Einsprung – 3D. node tools/dmg24shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D|THREE/.test(t)) && !/KHR_parallel_shader_compile/.test(t)) errs.push(t); });
  await p.addInitScript(() => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
    const id = Object.values(SHIPS).find(d => d.f === 'alliance' && d.role === 'war' && d.cls === 'l' && !d.hidden).id;
    const hp = [1, 0.7, 0.45, 0.22, 0.07], us = hp.map((h, i) => { const u = addShip(g, id, 0, 1300 + i * 120, 1500, -Math.PI / 2); u.hull = u.hullMax * h; u.shield = 0; return u; });
    const vid = Object.values(SHIPS).find(d => d.f === 'mars' && d.role === 'war' && d.cls === 'l' && !d.hidden && !d.resurrect && !d.hero).id; const v = addShip(g, vid, 1, 1540, 1720, 0.4); for (let i = 0; i < 20 && !v.dead; i++) { v.crip = 0; damage(g, v, 1e5, 'kin', null, 0, 1540, 1720); }
    for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
    g.reveals.push({ x: 1500, y: 1600, r: 1400, owner: 0, until: 1e9 });
    for (const q of g.players) q.nob = true; UI.speed = 0.0001; R.center(1540, 1580); R.cam.z = 1.25;
    return { id, wrecks: g.wrecks.length };
  });
  await p.waitForTimeout(5000);
  await p.screenshot({ path: OUT + '/dmg24-stages.jpg', quality: 90, type: 'jpeg' });
  await p.evaluate(() => { R.center(1560, 1720); R.cam.z = 2.0; UI.speed = 1; }); await p.waitForTimeout(7000);
  await p.screenshot({ path: OUT + '/dmg24-wreck.jpg', quality: 90, type: 'jpeg' });
  const ok = info.wrecks > 0 && !errs.length; console.log((ok ? 'OK   ' : 'FAIL ') + 'Schadensstufen und zerbrochenes Wrack ' + JSON.stringify(info) + (errs.length ? ' Fehler: ' + errs.slice(0, 4).join(' / ') : '')); console.log(ok ? 'ALL OK' : '1 FEHLER');
  await b.close(); process.exit(info.wrecks > 0 && !errs.length ? 0 : 1);
})();
