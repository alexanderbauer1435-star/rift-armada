/* Bildprüfung Fassung 25: Fähigkeiten in eigener Leiste über der Befehlsleiste, auch bei vielen gewählten Schiffen
   sichtbar ohne Scrollen. node tools/abil25shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const res = []; let ok = true; const errs = [];
  for (const [w, h, nm] of [[780, 360, 'quer'], [400, 800, 'hoch']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
    await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1200);
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'mars', human: true, team: 0 }, { faction: 'alliance', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const g = UI.g, me = UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'), us = [];
      for (const id of ['olympus', 'hammer', 'spear', 'needle', 'hedgehog', 'longshot']) us.push(addShip(g, id, me, b.x + 200 + us.length * 30, b.y, 0));
      setSel(us); hudSel(); hudCmds(true); R.center(b.x + 260, b.y);
      const ab = document.getElementById('abils'), r = ab.getBoundingClientRect(), keys = ab.querySelectorAll('.key.ab').length;
      const inView = [...ab.querySelectorAll('.key')].every(k => { const q = k.getBoundingClientRect(); return q.right <= innerWidth + 1 && q.left >= -1 && q.bottom <= innerHeight + 1 && q.top >= 0; });
      const cmdAb = document.querySelectorAll('#cmds .key.ab').length;
      return { keys, inView, cmdAb, vis: !ab.hidden };
    });
    const good = r.vis && r.keys >= 2 && r.inView && r.cmdAb === 0; ok = ok && good;
    res.push(nm + ': ' + r.keys + ' Fähigkeiten ' + (good ? '✓' : '✗ ' + JSON.stringify(r)));
    await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/abil25-${nm}.png` }); await p.close();
  }
  ok = ok && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Fähigkeitsleiste ' + res.join(', ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
