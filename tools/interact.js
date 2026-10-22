/* Bedienungstest: Tippen, Ziehen, Bauen über echte Zeigerereignisse im Handyformat */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-01.html');
const OUT = path.resolve(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [], fails = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(500);
  await page.click('#mSkirm'); await page.click('#mStart'); await page.waitForTimeout(1000);
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(120); };
  const screenOf = async pred => page.evaluate(pred => { const g = RA.UI.g, me = RA.UI.me, fn = new Function('u', 'me', 'return ' + pred), u = g.ships.find(x => !x.dead && fn(x, me)); const s = R.w2s(u.x, u.y); return { x: s.x, y: s.y, id: u.id }; }, pred);
  /* 1. Tippen auf eigenes Kampfschiff wählt es */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, u = g.ships.find(x => x.owner === me && armed(x)); R.cam.z = 1; R.center(u.x, u.y); });
  let s = await screenOf('u.owner === me && armed(u)');
  await tap(s.x, s.y);
  check('tap selects own warship', await page.evaluate(id => RA.UI.sel.has(id), s.id));
  /* 2. Tippen auf freien Raum: Bewegungsbefehl */
  await tap(s.x + 150, s.y + 40);
  check('tap on empty space orders move', await page.evaluate(id => { const u = RA.UI.g.byId.get(id); return u.o.t === 'move'; }, s.id));
  /* 3. Ziehen verschiebt die Kamera */
  const cam0 = await page.evaluate(() => R.cam.x);
  await page.touchscreen.tap(400, 200); // Tippen leert nichts (freier Raum mit Auswahl = Bewegung) – danach Auswahl leeren
  await page.evaluate(() => desel());
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x0, y0, x1, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
  };
  await swipe(400, 200, 250, 200);
  const cam1 = await page.evaluate(() => R.cam.x);
  check('swipe pans camera (' + Math.round(cam0) + ' → ' + Math.round(cam1) + ')', cam1 > cam0 + 50);
  /* 4. Zwei Finger: Zoom */
  const z0 = await page.evaluate(() => R.cam.z);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 350, y: 200 }, { x: 450, y: 200 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 350 - i * 12, y: 200 }, { x: 450 + i * 12, y: 200 }] });
  await page.waitForTimeout(100);
  await page.evaluate(() => pinchApply());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  const z1 = await page.evaluate(() => R.cam.z);
  check('pinch zooms in (' + z0.toFixed(2) + ' → ' + z1.toFixed(2) + ')', z1 > z0 * 1.2);
  await page.evaluate(() => { R.cam.z = 1; R.clampCam(); });
  /* 5. Auswahlrahmen über Taste »Auswahl« */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); R.center(b.x, b.y); });
  const btn = await page.$('#cmds .key');
  await btn.tap();
  await page.waitForTimeout(100);
  await swipe(60, 80, 760, 330);
  const nSel = await page.evaluate(() => RA.UI.sel.size);
  check('box select picks ships (' + nSel + ')', nSel >= 1);
  await page.evaluate(() => { if (RA.UI.boxMode) toggleBox(); desel(); });
  /* 6. Bauen: Bauschiff wählen, Reaktor, Platz tippen, bestätigen */
  s = await screenOf('u.owner === me && u.def.build');
  await page.evaluate(id => { const u = RA.UI.g.byId.get(id); R.center(u.x, u.y); }, s.id);
  s = await screenOf('u.owner === me && u.def.build');
  await tap(s.x, s.y);
  check('tap selects builder', await page.evaluate(id => RA.UI.sel.has(id), s.id));
  const items = await page.$$('#items .item');
  check('build menu shows items (' + items.length + ')', items.length >= 3);
  await items[1].tap(); await page.waitForTimeout(150);
  check('place mode after tapping Reaktor', await page.evaluate(() => RA.UI.mode === 'place' && RA.UI.place.role === 'reactor'));
  await tap(s.x + 140, s.y - 60);
  const ok = await page.evaluate(() => RA.UI.place && RA.UI.place.ok);
  const nB0 = await page.evaluate(() => RA.UI.g.bldgs.length);
  const confirm = await page.$('#cmds .key.arm');
  if (confirm) await confirm.tap();
  await page.waitForTimeout(150);
  const nB1 = await page.evaluate(() => RA.UI.g.bldgs.length);
  check('placing reactor works (ok=' + ok + ')', nB1 === nB0 + 1);
  await page.screenshot({ path: path.join(OUT, '20-after-place.png') });
  /* 7. Langes Drücken auf eine Taste zeigt die Erklärung */
  const yardBtn = await page.$('#items .item');
  const bb = await yardBtn.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }] });
  await page.waitForTimeout(600);
  const tipVisible = await page.evaluate(() => !document.getElementById('tip').hidden);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.screenshot({ path: path.join(OUT, '21-tooltip.png') });
  check('long press shows tooltip', tipVisible);
  /* 8. Gruppe speichern und wählen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me; setSel(g.ships.filter(u => u.owner === me && armed(u))); grpAssign(1); desel(); grpSelect(1); });
  check('group 1 assign/select', await page.evaluate(() => RA.UI.sel.size >= 1));
  /* 9. Doppeltippen wählt alle des Typs */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); for (let i = 0; i < 3; i++) addShip(g, BUILDER[g.players[me].faction], me, b.x + 150 + i * 40, b.y + 120, 0); R.center(b.x + 150, b.y + 120); desel(); });
  s = await screenOf('u.owner === me && u.def.build && u.o.t === "idle"');
  await tap(s.x, s.y); await tap(s.x, s.y);
  const nT = await page.evaluate(() => RA.UI.sel.size);
  check('double tap selects all of type (' + nT + ')', nT >= 3);
  /* 10. Pause, Speichern, Fortsetzen */
  await page.evaluate(() => setPaused(true));
  const saved = await page.evaluate(() => !!readSave());
  check('pause saves game', saved);
  await page.evaluate(() => { toMenu(); });
  await page.waitForTimeout(300);
  const contVisible = await page.evaluate(() => !document.getElementById('mCont').hidden);
  check('continue button visible', contVisible);
  await page.click('#mCont'); await page.waitForTimeout(800);
  check('continue restores game', await page.evaluate(() => !RA.UI.attract && RA.UI.g.bldgs.some(b => b.role === 'reactor')));
  await page.screenshot({ path: path.join(OUT, '22-continued.png') });
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILURES: ' + fails.length : 'ALL INTERACTIONS OK');
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
