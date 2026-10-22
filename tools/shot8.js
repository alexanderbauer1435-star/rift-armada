/* Bildschirmtests Feinschliff: Hinweis auf die Ausbildung im Hauptmenü, Ausbildung mit hervorgehobenen Tasten (Auswahl,
   Baumenü, Minikarte), Abschluss; Schadensbilder, Wrackhälften, Stationsexplosion.
   Aufruf: node tools/shot8.js build/Rift-Armada-10.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-10.html');
const OUT = path.resolve(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [], fails = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; localStorage.clear(); });
  await page.reload();
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(700);
  check('new player hint with tutorial button', await page.evaluate(() => !document.getElementById('mNote').hidden && !!document.getElementById('mTut')));
  await shot('170-menu-hint');
  await page.click('#mTut'); await page.waitForTimeout(300);
  check('tutorial briefing opens', await page.evaluate(() => !document.getElementById('brief').hidden && document.getElementById('briefName').textContent === 'Grundausbildung' && /Ausbildung/.test(document.getElementById('briefAct').textContent)));
  check('campaign shows training act first and highlighted', await page.evaluate(() => /Ausbildung/.test(document.querySelector('.act h3').textContent) && document.querySelector('.mcard.next b').textContent === 'Grundausbildung'));
  await page.click('#briefGo'); await page.waitForTimeout(1500);
  await page.evaluate(() => { RA.UI.speed = 0.001; RA.step(60); });
  await page.waitForTimeout(400);
  check('tutorial running, step 1, radio', await page.evaluate(() => RA.UI.g.mis.id === 'tut' && RA.UI.g.mis.goals[0].st === 1 && !document.getElementById('radio').hidden));
  await shot('171-tut-start');
  /* die Schritte der Reihe nach erledigen, wie mit dem Finger */
  const act = {
    move: () => { const g = RA.UI.g, w = g.ships.find(u => u.owner === 0 && u.type === 'wren'); RA.issue({ t: 'move', u: [w.id], x: 1050, y: 700 }); },
    shoot: () => { const g = RA.UI.g, w = g.ships.find(u => u.owner === 0 && u.type === 'wren'), t = g.ships.find(u => u.owner === 1 && !u.dead); if (w && t) RA.issue({ t: 'attack', u: [w.id], e: t.id }); },
    group: () => { const g = RA.UI.g; RA.issue({ t: 'move', u: g.ships.filter(u => u.owner === 0 && u.type === 'lancer').map(u => u.id), x: 1350, y: 1350 }); },
    amove: () => { const g = RA.UI.g; RA.issue({ t: 'move', u: g.ships.filter(u => u.owner === 0 && (u.type === 'lancer' || u.type === 'wren')).map(u => u.id), x: 2100, y: 1150, am: true }); },
    mini: () => {}
  };
  let cur = 'move', sawGroup = false, sawMini = false;
  for (let i = 0; i < 80 && cur !== 'yard'; i++) {
    cur = await page.evaluate(() => { const q = RA.UI.g.mis.goals.find(x => x.st === 1); return q ? q.id : 'none'; });
    if (cur === 'group' && !sawGroup) { sawGroup = true; check('step 3: group, Auswahl highlighted', await page.evaluate(() => { hudUpdate(); const el = document.querySelector('.tutHL'); return !!el && el.dataset.k === 'cmd:Auswahl'; })); await shot('172-tut-highlight'); }
    if (cur === 'mini' && !sawMini) { sawMini = true; check('step 5: minimap highlighted', await page.evaluate(() => { hudUpdate(); return document.getElementById('mini').classList.contains('tutHL'); })); await shot('173-tut-mini'); }
    if (process.env.DBG) console.log('cur', cur, await page.evaluate(() => RA.UI.g.time.toFixed(1) + ' k' + RA.UI.g.mis.f.k + ' next' + RA.UI.g.mis.t.next));
    if (act[cur]) await page.evaluate(act[cur]);
    await page.evaluate(() => RA.step(90)); await page.waitForTimeout(60);
  }
  check('reached the building step', cur === 'yard' && sawGroup && sawMini);
  /* Bauschiff wählen: das Baumenü zeigt die Werft hervorgehoben */
  await page.evaluate(() => { const g = RA.UI.g, b = g.ships.find(u => u.owner === 0 && u.type === 'pathfinder'); setSel([b]); RA.UI.tab = 'eco'; hudBuild(true); hudUpdate(); });
  check('step 6: yard item (or its tab) highlighted with builder selected', cur === 'yard' && await page.evaluate(() => { const el = document.querySelector('.tutHL'); return !!el && /item:yard|tab:/.test(el.dataset.k); }));
  await shot('174-tut-build');
  check('no errors', errors.length === 0);
  /* Schadensbilder: Gefecht auf dem Übungsplatz */
  await page.evaluate(() => {
    RA.beginGame({ map: 'test', seed: 3, players: [{ faction: 'alliance', human: true }, { faction: 'mars', ai: 0 }], res: { ice: 0, ore: 0 } }, 'sandbox');
    RA.UI.speed = 0.001;
    const g = RA.UI.g, cx = 1600, cy = 1600;
    ['lancer', 'bulwark', 'archipelago', 'lancer'].forEach((t, i) => addShip(g, t, 0, cx - 150, cy - 120 + i * 70, 0));
    ['hedgehog', 'hammer', 'spear', 'needle'].forEach((t, i) => addShip(g, t, 1, cx + 150, cy - 120 + i * 70, Math.PI));
    for (const u of g.ships) if (Math.hypot(u.x - cx, u.y - cy) < 400) u.hull = u.hullMax * (0.2 + (u.id % 4) * 0.12);
  });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { RA.step(10); document.getElementById('toasts').textContent = ''; R.cam.z = 1.5; R.center(1600, 1600); }); await page.waitForTimeout(100); }
  check('damaged ships drawn, hulks after big deaths', await page.evaluate(() => typeof drawDamage === 'function' && FX.list.some(o => o.k === 'smoke' || o.k === 'spark')));
  await shot('175-damage');
  await page.evaluate(() => { const g = RA.UI.g; const b = g.ships.find(u => !u.dead && u.type === 'hammer'); if (b) kill(g, b, null, 0); RA.step(3); R.cam.z = 1.4; R.center(b.x, b.y); });
  await page.waitForTimeout(300);
  check('wreck halves after a big ship dies', await page.evaluate(() => FX.list.some(o => o.k === 'hulk')));
  await shot('176-hulk');
  check('no errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(fails.length ? 'FAILS ' + fails.length : 'ALL OK');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
