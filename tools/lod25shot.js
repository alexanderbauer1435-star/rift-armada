/* Bildprüfung Fassung 25 Detailstufen: dieselbe Schlacht mit vollen Modellen und mit Stufen nach Bildschirmgröße,
   dazu Dreiecke und Zeichenaufrufe. node tools/lod25shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto', hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { MENU.map = 'haven'; MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const g = UI.g, me = UI.me, foe = 1 - me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'), dir = g.players[me].start.ang;
    const fx = b.x + Math.cos(dir) * 420, fy = b.y + Math.sin(dir) * 420;
    const mine = ['lancer', 'wren', 'bulwark', 'aegis', 'beacon', 'reckoning', 'haven'], theirs = ['spear', 'hammer', 'needle', 'hedgehog', 'olympus', 'longshot', 'wasp'];
    for (let k = 0; k < 21; k++) { const u = addShip(g, mine[k % mine.length], me, fx - 160 + (k % 7) * 55, fy - 80 + ((k / 7) | 0) * 60, 0); u.o = { t: 'hold' }; }
    for (let k = 0; k < 21; k++) { const u = addShip(g, theirs[k % theirs.length], foe, fx - 160 + (k % 7) * 55, fy + 130 + ((k / 7) | 0) * 60, Math.PI); u.o = { t: 'hold' }; }
    for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: fx, y: fy, r: 3000, owner: me, until: 1e9 });
    window.__C = { x: fx, y: fy + 70 }; UI.speed = 0.0001;
  });
  const res = [];
  for (const z of [1.6, 0.9, 0.5]) for (const mode of ['full', 'auto']) {
    await p.evaluate(([z, mode]) => { RA3D.setGfx({ lod: mode }); R.cam.z = z; R.center(__C.x, __C.y); }, [z, mode]);
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => RA3D.stats());
    res.push(`Zoom ${z} ${mode}: ${Math.round(st.tris / 1000)}k Dreiecke, ${st.calls} Aufrufe, Stufen ${st.lod.join('/')}`);
    await p.screenshot({ path: `${OUT}/lod25-z${z}-${mode}.jpg`, type: 'jpeg', quality: 90 });
  }
  console.log(res.join('\n'));
  const ok = !errs.length; console.log((ok ? 'OK   ' : 'FAIL ') + 'Detailstufen' + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
