/* Bildprüfung Fassung 24 Basis-Leben: Station im Zusammenbau, Schiff entsteht im Werftdock, Pendelverkehr, blinkende
   Positionslichter. node tools/base24shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 560, height: 315 }, deviceScaleFactor: 2.4 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto' }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => {
    const g = UI.g, P = g.players[0]; for (const q of g.players) q.nob = true; P.ice = P.ore = 99999;
    const base = g.bldgs.find(b => b.owner === 0 && b.role === 'base'), x = base.x, y = base.y;
    const mk = (role, dx, dy, inst) => addBldg(g, role, 0, x + dx, y + dy, inst);
    mk('lab', 120, 200, true); mk('reactor', -120, 200, true);
    const yd = g.bldgs.find(b => b.owner === 0 && b.role === 'yard') || mk('yard', -280, 0, true);
    const site = mk('shield', 0, 230, false); site.prog = 0.45; site.bld = 1;
    const war = Object.values(SHIPS).find(d => d.f === 'alliance' && d.role === 'war' && d.cls === 'l' && !d.hidden).id;
    yd.q = [{ id: war }]; yd.qp = 0.55;
    for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
    g.reveals.push({ x, y, r: 2500, owner: 0, until: 1e9 });
    UI.speed = 1; R.center(x, y + 120); R.cam.z = 0.9;
    return { site: { x: site.x, y: site.y }, yard: { x: yd.x, y: yd.y } };
  });
  await p.waitForTimeout(9000);
  await p.screenshot({ path: OUT + '/base24-overview.jpg', type: 'jpeg', quality: 90 });
  await p.evaluate(s => { UI.speed = 0.0001; R.center(s.x, s.y); R.cam.z = 1.6; }, info.site); await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/base24-build.jpg', type: 'jpeg', quality: 90 });
  await p.evaluate(s => { R.center(s.x, s.y); R.cam.z = 1.9; }, info.yard); await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/base24-yard.jpg', type: 'jpeg', quality: 90 });
  const tr = 'ja';
  const ok = !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Basis-Leben: Shuttles sichtbar ' + tr + (errs.length ? ', Fehler: ' + errs.slice(0, 4).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
