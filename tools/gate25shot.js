/* Bildprüfung Fassung 25 Sprungtore: aktives Tor (Horizont, Lauflicht, Funken), Durchflug mit Eintritt und Austritt am
   Partnertor. 3D und 2D. node tools/gate25shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; let ok = true; const errs = [];
  for (const gfx of ['3d', '2d']) {
    const p = await b.newPage({ viewport: { width: 900, height: 500 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
    await p.addInitScript(g => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: g, lang: 'de', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); }, gfx);
    await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => beginGame({ map: 'twingates', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(3000);
    const gi = await p.evaluate(() => {
      const g = UI.g, me = UI.me; for (const q of g.players) q.nob = true;
      for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 9000, owner: me, until: 1e9 });
      const gt = g.gates[0], pair = g.byId.get(gt.pair); gt.state = 'active'; gt.owner = me; gt.mode = 'bridge'; pair.state = 'active'; pair.owner = me; pair.mode = 'bridge';
      const u = addShip(g, 'bulwark', me, gt.x - 260, gt.y, 0); u.o = { t: 'move', x: gt.x + 10, y: gt.y }; u.path = null;
      window.__G = { gt, pair, id: u.id }; UI.speed = 1; R.center(gt.x - 60, gt.y); R.cam.z = 1.3;
      return { n: g.gates.length };
    });
    await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/gate25-${gfx}-aktiv.jpg`, type: 'jpeg', quality: 88 });
    /* warten bis das Schiff am Partnertor ist */
    let moved = false;
    try { await p.waitForFunction(() => { const u = UI.g.byId.get(__G.id); return u && Math.hypot(u.x - __G.pair.x, u.y - __G.pair.y) < 140; }, null, { timeout: 120000 }); moved = true; } catch (e) { /* unten gemeldet */ }
    await p.evaluate(() => { R.center(__G.pair.x + 40, __G.pair.y); });
    await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/gate25-${gfx}-austritt.jpg`, type: 'jpeg', quality: 88 });
    ok = ok && moved; res.push(gfx + ': ' + gi.n + ' Tore, Durchflug ' + (moved ? '✓' : '✗'));
    await p.close();
  }
  ok = ok && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Sprungtore ' + res.join(' · ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
