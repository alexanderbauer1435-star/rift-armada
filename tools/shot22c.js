/* Fassung 22: Bildschirmtest Nachrüsten an der Werft (Tasten, Fortschritt, Marken) und Flottenbefehl des Flaggschiffs
   (Ring in 2D und 3D). Aufruf: node tools/shot22c.js build/Rift-Armada-22.html [3d] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/rift-armada.html');
const D3 = process.argv[3] === '3d';
const OUT = path.resolve(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const args = D3 ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--no-sandbox'];
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  await ctx.addInitScript(d3 => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: d3 ? '3d' : '2d', lang: 'de', vol: 0, mus: 0 }, menu: {} })); } catch (e) { /* egal */ } }, D3);
  const page = await ctx.newPage();
  const errors = [], fails = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const pre = D3 ? '22c-3d-' : '22c-';
  const shot = async n => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, pre + n + '.png') }); console.log('shot', pre + n); };
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    RA.beginGame({ map: 'test', seed: 3, players: [{ faction: 'mars', human: true }, { faction: 'alliance', ai: 0 }], res: { ice: 9000, ore: 9000 } }, 'sandbox');
    RA.UI.speed = 0.001;
    const g = RA.UI.g, me = RA.UI.me;
    for (const u of g.ships.slice()) if (u.owner !== me || u.def.role === 'war') removeShip(g, u);
    const y = addBldg(g, 'yard', me, 1300, 1500, true); y.lv = 2; const l = lvOf(y); y.hull = y.hullMax = l.hull;
    recalcPower(g, me); recalcCp(g, me);
    const h = addShip(g, 'hammer', me, 1300 + y.def.r + 70, 1500, 0); h.id22 = 1;
    R.center(1400, 1500);
    setSel([h]);
  });
  await page.evaluate(() => RA.step(10));
  check('Taste »Nachrüsten« erscheint nahe der Werft', await page.evaluate(() => { hudCmds(true); return !!document.querySelector('[data-k="cmd:Nachrüsten"]'); }));
  await shot('01-refit-key');
  const tapK = async k => { const p = await page.evaluate(k => { const el = document.querySelector('[data-k="cmd:' + k + '"]'); const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, k); await page.touchscreen.tap(p[0], p[1]); await page.waitForTimeout(200); };
  await tapK('Nachrüsten');
  check('Untermenü mit vier Nachrüstungen', await page.evaluate(() => ['Panzerung', 'Waffen', 'Antrieb', 'Sensoren', 'Zurück'].every(k => !!document.querySelector('[data-k="cmd:' + k + '"]'))));
  await shot('01-refit-buttons');
  /* Panzerung über die Taste */
  await tapK('Panzerung');
  check('Tippen startet die Nachrüstung', await page.evaluate(() => { const u = RA.UI.g.ships.find(x => x.id22); return !!(u.rfq && u.rfq.id === 'armor'); }));
  await page.evaluate(() => RA.step(150)); await page.evaluate(() => hudUpdate());
  check('Karte zeigt den Fortschritt', await page.evaluate(() => /Nachrüstung: Panzerung \d+ %/.test(document.getElementById('selCard').textContent)));
  await shot('02-refit-progress');
  await page.evaluate(() => { const g = RA.UI.g, u = g.ships.find(x => x.id22); for (let i = 0; i < 40 * 30 && u.rfq; i++) RA.step(1); RA.issue({ t: 'refit', u: [u.id], id: 'wpn' }); for (let i = 0; i < 40 * 30 && u.rfq; i++) RA.step(1); hudUpdate(); });
  check('zwei Marken auf der Karte, Tasten gesperrt', await page.evaluate(() => { const u = RA.UI.g.ships.find(x => x.id22); hudSel(); hudCmds(true); const m = document.querySelector('#selCard .rfm'); return u.rf.length === 2 && m && m.textContent === '⛨✶' && document.querySelector('[data-k="cmd:Antrieb"]').classList.contains('off'); }));
  await page.evaluate(() => { const u = RA.UI.g.ships.find(x => x.id22); RA.UI.g.ships.forEach(x => { if (x.id22) { x.hull *= 0.8; } }); });
  await shot('03-refit-marks');
  /* Flaggschiff: Flottenbefehl mit Ring */
  await page.evaluate(() => {
    const g = RA.UI.g, me = RA.UI.me;
    const f = addShip(g, 'olympus', me, 1900, 1500, 0); f.auto = false; f.id22f = 1;
    for (let i = 0; i < 6; i++) addShip(g, ['hammer', 'spear', 'hedgehog'][i % 3], me, 1750 + (i % 3) * 120, 1350 + Math.floor(i / 3) * 300, 0);
    R.cam.z = Math.min(R.cam.z, 0.5); R.center(1900, 1500);
    setSel([f]);
  });
  check('Auswahl wechseln beendet das Untermenü', await page.evaluate(() => RA.UI.mode === 'normal'));
  await page.evaluate(() => RA.step(20));
  check('Taste »Breitseite« (Salve) am Olympus', await page.evaluate(() => { hudCmds(true); return !!document.querySelector('[data-k="cmd:Breitseite"]') && [...document.querySelectorAll('#cmds .key.ab small')].some(e => e.textContent === 'Salve'); }));
  await page.evaluate(() => { const f = RA.UI.g.ships.find(x => x.id22f); RA.issue({ t: 'ab', u: [f.id], id: 'fcBroad' }); RA.step(8); hudUpdate(); });
  check('Befehl wirkt auf die Flotte, Karte zeigt ihn', await page.evaluate(() => { const g = RA.UI.g; return g.ships.filter(u => u.owner === RA.UI.me && u.fcT > 0).length >= 7 && /Flottenbefehl: Breitseite/.test(document.getElementById('selCard').textContent); }));
  await shot('04-fleet-command');
  await page.evaluate(() => { RA.step(30 * 16); hudUpdate(); });
  check('Befehl nach 15 s vorbei', await page.evaluate(() => RA.UI.g.ships.every(u => !(u.fcT > 0))));
  await shot('05-aura-only');
  check('keine Fehler', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
  console.log(fails.length ? fails.length + ' FAILS' : 'ALL OK'); process.exit(fails.length ? 1 : 0);
})();
