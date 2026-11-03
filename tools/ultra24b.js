/* Bildprüfung Fassung 24 »Ultra«-Ausbau: Gefechtslicht, Schildwellen, Gasriese, Eisdunst. node tools/ultra24b.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { try { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'ultra' }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => beginGame({ map: 'arena', seed: 7, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(3000);
  const info = await p.evaluate(() => {
    const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
    const cx = g.map.w / 2, cy = g.map.h / 2, pick = (f, c) => Object.values(SHIPS).filter(d => d.f === f && d.role === 'war' && d.cls === c && !d.hidden && !d.marines && d.wpn.some(w => w.kind !== 'pd' && !w.art)).map(d => d.id);
    const A = [], M = []; [['alliance', 0, A], ['mars', 1, M]].forEach(([f, o, arr]) => { const m = pick(f, 'm'), l = pick(f, 'l'); for (let i = 0; i < 6; i++) arr.push(addShip(g, m[i % m.length], o, cx + (o ? 160 : -160), cy - 200 + i * 80, o ? Math.PI : 0)); for (let i = 0; i < 2; i++) arr.push(addShip(g, l[i % l.length], o, cx + (o ? 280 : -280), cy - 80 + i * 160, o ? Math.PI : 0)); });
    for (const u of M) u.hull = u.hullMax * 0.25;
    for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
    g.reveals.push({ x: cx, y: cy, r: 3000, owner: 0, until: 1e9 });
    execCmd(g, { t: 'amove', p: 0, u: A.map(u => u.id), x: cx + 400, y: cy }); execCmd(g, { t: 'amove', p: 1, u: M.map(u => u.id), x: cx - 400, y: cy });
    for (let i = 0; i < 2000 && !g.ships.some(u => u.hull < u.hullMax * 0.97 && u.owner === 0); i++) { stepGame(g); g.ev.length = 0; }
    UI.speed = 1; R.center(cx, cy); R.cam.z = 1.2;
    const ice = g.nodes.filter(n => n.kind === 'ice').sort((a, b) => b.r - a.r)[0];
    return { cx, cy, ice: ice ? { x: ice.x, y: ice.y, r: ice.r } : null, w: g.map.w, h: g.map.h, q: RA3D.quality() };
  });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: OUT + '/ultra24b-battle.jpg', type: 'jpeg', quality: 90 });
  const lights = await p.evaluate(() => { let n = 0, on = 0; RA3D._scene ? 0 : 0; return { n, on }; });
  if (info.ice) { await p.evaluate(i => { UI.speed = 0.0001; R.center(i.x, i.y); R.cam.z = 1.4; }, info.ice); await p.waitForTimeout(3000); await p.screenshot({ path: OUT + '/ultra24b-ice.jpg', type: 'jpeg', quality: 90 }); }
  await p.evaluate(i => { R.center(i.w * 0.95, i.h * 0.1); R.cam.z = 0.35; }, info); await p.waitForTimeout(3500);
  await p.screenshot({ path: OUT + '/ultra24b-giant.jpg', type: 'jpeg', quality: 90 });
  const ok = !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Ultra-Ausbau: ' + JSON.stringify(info.q.scale) + ', Eis ' + JSON.stringify(info.ice) + (errs.length ? ', Fehler: ' + errs.slice(0, 4).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); void lights; await b.close(); process.exit(ok ? 0 : 1);
})();
