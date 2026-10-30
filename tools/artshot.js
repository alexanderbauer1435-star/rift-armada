/* Bildprüfung Belagerungsartillerie (Fassung 21): alle fünf Typen beschießen einen Turm, 2D und 3D */
const { chromium } = require('playwright');
const F = process.argv[2] || 'build/rift-armada.html';
(async () => {
  let fail = 0;
  for (const gfx of ['2d', '3d']) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { const d = JSON.parse(localStorage.getItem('ra.prefs') || '{}'); d.set = Object.assign(d.set || {}, { gfx, lang: 'de' }); localStorage.setItem('ra.prefs', JSON.stringify(d)); } catch (e) {} }, gfx);
    await p.goto('file://' + require('path').resolve(F)); await p.waitForTimeout(1500);
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1200);
    const n = await p.evaluate(() => {
      const g = UI.g; for (const u of g.ships.slice()) if (u.owner !== 0 || u.def.art) removeShip(g, u); for (const b of g.bldgs.slice()) if (b.owner === 1) { b.hull = 0; removeBldg(g, b); }
      const t = addBldg(g, 'turret', 1, 1500, 1500, true); const t2 = addBldg(g, 'turret', 1, 1500, 1800, true);
      for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
      const ids = []; ['catapult', 'mortar', 'ballista', 'lodestar', 'boomer'].forEach((k, i) => { const u = addShip(g, k, 0, 2350, 1350 + i * 90, Math.PI); ids.push(u.id); });
      execCmd(g, { t: 'attack', p: 0, u: ids, e: t.id });
      for (let k = 0; k < 330; k++) { stepGame(g); UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
      R.cam.z = 1.1; R.center(2150, 1600); return g.proj.filter(q => q.kind === 'art').length;
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'tools/shots/art-' + gfx + '.png' });
    const ok = errs.length === 0; if (!ok) fail++;
    console.log((ok ? 'OK   ' : 'FAIL ') + gfx + ': ' + n + ' Granaten im Flug, Fehler: ' + errs.join(' | '));
    await p.close(); await b.close();
  } console.log(fail ? 'FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
