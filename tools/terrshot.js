/* Fassung 22 – Bildtest Kartenleben: Zufallskarte im Gefecht-Menü, wandernde Gefahren, sprengbare Felsen (angeschlagen,
   gesprengt, Markierung), neutrale Station mit Fortschrittsring, Schiff in Deckung (Auswahlkarte), Minikarte.
   node tools/terrshot.js build/Rift-Armada-22.html [2d|3d] → tools/shots/terr-<gfx>-*.png */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'rift-armada.html')), gfx = process.argv[3] || '2d', OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const args = ['--no-sandbox'].concat(gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 }, locale: 'de-DE' });
  await ctx.addInitScript(g => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: g, lang: 'de', vol: 0, mus: 0 }, menu: {} })); } catch (e) {} }, gfx);
  const errs = [], shot = async (page, n) => { await page.screenshot({ path: path.join(OUT, 'terr-' + gfx + '-' + n + '.png') }); console.log('terr-' + gfx + '-' + n); };
  const start = async (map, extra) => {
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + file, { timeout: 180000 }); await page.waitForTimeout(800);
    await page.evaluate(([map, extra]) => { window.__RA_TEST = 1; Object.assign(MENU, { map, haz: 'on', mode: 'skirmish' }, extra || {}); MENU.slots = [{ f: 'mars', lvl: 1, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); }, [map, extra]);
    await page.waitForTimeout(2200);
    await page.evaluate(() => { const g = UI.g; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 99999, owner: UI.me, until: 99999 }); });
    return page;
  };
  const look = (page, x, y, z) => page.evaluate(([x, y, z]) => { R.center(x, y); R.zoomAt(500, 300, z); }, [x, y, z]);
  const run = async (page, s) => { await page.evaluate(() => { UI.speed = 1; }); await page.waitForTimeout(s * 1000); await page.evaluate(() => { UI.speed = 0; }); await page.waitForTimeout(400); };

  /* 1. Gefecht-Menü: Zufallskarte mit Gefahrenbahnen in der Vorschau */
  {
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + file, { timeout: 180000 }); await page.waitForTimeout(800);
    await page.evaluate(() => { Object.assign(MENU, { map: 'random', haz: 'on', mode: 'skirmish', mseed: 4242 }); MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }, { f: 'nexus', lvl: 2, team: 0 }, { f: 'legion', lvl: 2, team: 0 }].concat(Array.from({ length: 4 }, () => ({ f: 'off', lvl: 2, team: 0 }))); menuPage('setup'); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const el = document.getElementById('rowHaz'); if (el) el.scrollIntoView(); });
    await page.waitForTimeout(300); await shot(page, 'setup');
    const s1 = await page.evaluate(() => { const a = JSON.stringify(UI.prevMap.nodes.map(n => [Math.round(n.x), Math.round(n.y)])); document.getElementById('randRoll').click(); const b = JSON.stringify(UI.prevMap.nodes.map(n => [Math.round(n.x), Math.round(n.y)])); return [a !== b, document.getElementById('randInfo').textContent, document.getElementById('rowRand').hidden]; });
    console.log('Neu würfeln ändert die Vorschau:', s1[0], '·', s1[1], '· Zeile verborgen:', s1[2]);
    await page.evaluate(() => { const el = document.getElementById('mapPrev'); if (el) el.scrollIntoView(); }); await page.waitForTimeout(300); await shot(page, 'setup2');
    await page.close();
  }
  /* 2. Open Expanse mit Ionensturm und Gravitationsschacht */
  {
    const page = await start('expanse');
    await run(page, 1);
    const hz = await page.evaluate(() => UI.g.hazards.map(h => [h.kind, Math.round(h.x), Math.round(h.y)]));
    console.log('Gefahren:', JSON.stringify(hz));
    for (const [k, x, y] of hz) {
      await page.evaluate(([x, y]) => { const g = UI.g; for (let i = 0; i < 3; i++) { const u = addShip(g, 'lancer', UI.me, x - 300 + i * 60, y + 220, -1.2); u.o = { t: 'hold' }; u.hold = true; } }, [x, y]);
      await look(page, x, y, 0.55); await run(page, 1.2); await shot(page, 'haz-' + k);
    }
    /* Neutrale Station: Schiff daneben, Fortschrittsring */
    const st = await page.evaluate(() => { const g = UI.g, s = g.sites.find(q => OUTPOST[q.kind]); for (let i = 0; i < 3; i++) { const u = addShip(g, 'reckoning', UI.me, s.x + s.r + 70 + i * 40, s.y + 30, Math.PI); u.o = { t: 'hold' }; u.hold = true; } return [s.x, s.y, s.kind]; });
    await look(page, st[0], st[1], 1.2); await run(page, 6); await shot(page, 'outpost-' + st[2]);
    await page.evaluate(() => { UI.speed = 8; }); await page.waitForTimeout(1800); await page.evaluate(() => { UI.speed = 0; }); await page.waitForTimeout(300);
    const own = await page.evaluate(() => { const s = UI.g.sites.find(q => OUTPOST[q.kind]); selSite(s); return s.owner; });
    await page.waitForTimeout(300); await shot(page, 'outpost-owned');
    console.log('Station übernommen:', own === 0 ? 'ja' : 'nein (' + own + ')');
    /* Trümmerfeld: Schiff in Deckung gewählt */
    const d = await page.evaluate(() => { const g = UI.g, d = g.map.debris[0], u = addShip(g, 'reckoning', UI.me, d.x, d.y, 0.4); u.o = { t: 'hold' }; u.hold = true; UI.gTmp = u.id; return [d.x, d.y]; });
    await look(page, d[0], d[1], 1.0); await run(page, 0.5);
    const cov = await page.evaluate(() => { const u = UI.g.byId.get(UI.gTmp); setSel([u]); hudSel(); return [u.cov, document.getElementById('selCard').textContent.indexOf('In Deckung') >= 0]; });
    await page.waitForTimeout(300); await shot(page, 'cover');
    console.log('In Deckung:', cov[0], '· Karte zeigt »In Deckung«:', cov[1]);
    await page.close();
  }
  /* 3. Maelstrom: Felspfropfen angeschlagen, einer gesprengt, Erzbrocken, Markierung bei gewählten Kampfschiffen */
  {
    const page = await start('maelstrom');
    const p = await page.evaluate(() => {
      const g = UI.g, plugs = g.rocks.filter(e => e.plug), p0 = plugs[0], gap = plugs.filter(e => Math.hypot(e.x - p0.x, e.y - p0.y) < 260);
      gap.forEach((e, i) => { if (i === 0) damage(g, e, 1e6, 'kin', null, UI.me, e.x, e.y); else damage(g, e, e.hpMax * (0.25 + 0.2 * i), 'kin', null, UI.me, e.x, e.y); });
      const sm = g.rocks.filter(e => !e.plug && !e.dead).slice(0, 6); for (const e of sm) damage(g, e, e.hpMax * 0.7, 'kin', null, UI.me, e.x, e.y);
      const us = []; for (let i = 0; i < 3; i++) { const u = addShip(g, 'reckoning', UI.me, p0.x + 160 + i * 50, p0.y + 140, 2.5); u.o = { t: 'hold' }; u.hold = true; us.push(u); }
      setSel(us); return [p0.x, p0.y, sm.length ? sm[0].x : 0, sm.length ? sm[0].y : 0];
    });
    await look(page, p[0], p[1], 1.3); await run(page, 0.6); await shot(page, 'plugs');
    await look(page, p[2], p[3], 1.6); await run(page, 0.3); await shot(page, 'cracks');
    /* Angriffsbefehl auf den nächsten Pfropfen über die Bedienung */
    const r = await page.evaluate(() => { const g = UI.g, e = g.rocks.find(q => q.plug && !q.dead); order(selShips(), e, e.x, e.y); return [e.id, e.x, e.y]; });
    await look(page, r[1], r[2], 1.0); await run(page, 4); await shot(page, 'attack');
    await page.evaluate(() => { UI.speed = 8; }); await page.waitForTimeout(2500); await page.evaluate(() => { UI.speed = 0; }); await page.waitForTimeout(300);
    console.log('Fels nach Angriffsbefehl gesprengt:', await page.evaluate(id => !UI.g.byId.get(id), r[0]));
    await shot(page, 'blasted');
    await page.close();
  }
  console.log(errs.length ? 'FEHLER ' + errs.join('\n') : 'keine Fehler'); await b.close();
})();
