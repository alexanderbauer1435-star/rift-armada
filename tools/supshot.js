/* Bildprüfung Unterstützer (Fassung 22): alle 15 Minenleger, Reparaturschiffe und Truppentransporter in Reihen, eigene
   Minenfelder, ein entdecktes feindliches Minenfeld (roter Warnkreis), Reparaturstrahlen auf beschädigte Schiffe und eine
   Station, ein Enterversuch. 2D und 3D: tools/shots/sup-2d.png, sup-3d.png (+ Nahaufnahme sup-*-near.png). */
const { chromium } = require('playwright');
const F = process.argv[2] || 'build/rift-armada.html';
(async () => {
  let fail = 0;
  for (const gfx of (process.argv[3] || '2d,3d').split(',')) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { const d = JSON.parse(localStorage.getItem('ra.prefs') || '{}'); d.set = Object.assign(d.set || {}, { gfx, lang: 'de' }); localStorage.setItem('ra.prefs', JSON.stringify(d)); } catch (e) {} }, gfx);
    await p.goto('file://' + require('path').resolve(F), { timeout: 120000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof beginGame === 'function' && typeof UI !== 'undefined', null, { timeout: 120000 }); await p.waitForTimeout(3000);
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1200);
    p.setDefaultTimeout(300000);
    const info = await p.evaluate(() => {
      const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u);
      const rows = [['tripwire', 'caltrop', 'censer', 'geode', 'clutch'], ['mender', 'anvil', 'hospitaller', 'lumen', 'nurse'], ['envoy', 'breacher', 'templar', 'assimilator', 'parasitepod']];
      const X0 = 1300, Y0 = 1250, out = [];
      /* die Schiffe gehören je nach Fraktion verschiedenen Spielern? – alle Spieler 0, Zeichnung nach Typ (Fraktion aus den Daten) */
      rows.forEach((r, j) => r.forEach((id, i) => { const u = addShip(g, id, 0, X0 + i * 110, Y0 + j * 120, 0); u.stance = 2; u.o = { t: 'hold' }; u.hold = true; out.push(u); }));
      /* beschädigte Ziele für die Reparatur: je ein Lancer unter jedem Reparaturschiff, dazu eine Station */
      for (let i = 0; i < 5; i++) { const t = addShip(g, 'lancer', 0, X0 + i * 110 + 30, Y0 + 120 + 70, 0); t.hull = t.hullMax * 0.4; t.stance = 2; t.o = { t: 'hold' }; t.hold = true; }
      const st = addBldg(g, 'turret', 0, X0 + 620, Y0 + 120, true); st.hull = st.hullMax * 0.5;
      /* eigene Minenfelder: die Minenleger legen */
      for (let k = 0; k < 6; k++) { stepGame(g); }
      for (const u of out.slice(0, 5)) abilityUse(g, u, 'mines');
      /* feindliches Feld in der Nähe eines eigenen Schiffs (entdeckt) */
      const foeL = addShip(g, 'caltrop', 1, X0 + 200, Y0 - 140, 0); layMines(g, foeL); removeShip(g, foeL);
      const scout = addShip(g, 'wren', 0, X0 + 200, Y0 - 140 + 135, 0); scout.stance = 2; scout.o = { t: 'hold' }; scout.hold = true;
      for (let k = 0; k < 120; k++) { stepGame(g); UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
      R.cam.z = 1.0; R.center(X0 + 260, Y0 + 90);
      return { mines: g.mines.length, seenFoe: g.mines.filter(m => m.owner === 1 && mineSeen(g, 0, m)).length, heals: g.ships.filter(u => u.heals && u.heals.length).length };
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'tools/shots/sup-' + gfx + '.png', timeout: 300000 });
    await p.evaluate(() => { R.cam.z = 2.2; R.center(1300 + 220, 1250 + 60); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'tools/shots/sup-' + gfx + '-near.png', timeout: 300000 });
    await p.evaluate(() => { R.center(1300 + 220, 1250 + 240); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'tools/shots/sup-' + gfx + '-troop.png', timeout: 300000 });
    const ok = errs.length === 0 && info.mines >= 18 && info.seenFoe >= 1 && info.heals >= 4; if (!ok) fail++;
    console.log((ok ? 'OK   ' : 'FAIL ') + gfx + ': ' + JSON.stringify(info) + ' Fehler: ' + errs.join(' | '));
    await p.close(); await b.close();
  } console.log(fail ? 'FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
