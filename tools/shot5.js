/* Bildschirmtests Wellen: Modus-Auswahl, Quarantine Line mit KI-Verbündeten, Siegel, Risse, Wellenanzeige, Belohnungskarten,
   Rift Survival mit Rekord am Ende. Aufruf: node tools/shot5.js build/Rift-Armada-06.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-06.html');
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
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(600);
  await page.click('#mWaves'); await page.waitForTimeout(300);
  check('waves button opens setup in Quarantine mode', await page.evaluate(() => RA.MENU.mode === 'quarantine' && !document.getElementById('rowAllies').hidden && document.getElementById('rowMap').hidden));
  await page.evaluate(() => { RA.MENU.faction = 'alliance'; RA.MENU.allies = 2; RA.MENU.allyLvl = 2; setupRender(); });
  await shot('120-setup-quarantine');
  await page.click('#mStart'); await page.waitForTimeout(1500);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('quarantine started with seal and two allies', await page.evaluate(() => { const g = RA.UI.g; return g.opts.mode === 'quarantine' && g.bldgs.some(b => b.role === 'seal') && g.players.filter(p => p.ai && p.team === 0).length === 2 && g.threat >= 0; }));
  check('wave counter in top bar', await page.evaluate(() => !document.getElementById('resWave').hidden && /Welle 1/.test(document.getElementById('rWave').textContent)));
  await page.evaluate(() => { const g = RA.UI.g, s = g.bldgs.find(b => b.role === 'seal'); R.cam.z = 0.55; R.center(s.x, s.y); });
  await shot('121-seal-ring');
  await page.evaluate(() => { const g = RA.UI.g, s = g.bldgs.find(b => b.role === 'seal'); selBldg(s); R.cam.z = 1.2; R.center(s.x, s.y); });
  check('seal card', await page.evaluate(() => document.querySelector('#selCard').textContent.indexOf('Siegel') >= 0));
  await shot('122-seal');
  /* Welle starten */
  await page.evaluate(() => { const g = RA.UI.g; g.wave.next = 0.2; RA.step(30); });
  await page.waitForTimeout(500);
  check('wave 1 running', await page.evaluate(() => RA.UI.g.wave.phase === 'wave' && RA.UI.g.wave.n === 1 && RA.UI.g.wave.open.length >= 1));
  await page.evaluate(() => { const g = RA.UI.g, r = g.wave.open[0]; desel(); R.cam.z = 0.9; R.center(r.x, r.y); RA.step(20); });
  await shot('123-rift');
  /* Welle beenden: Gegner töten */
  await page.evaluate(() => { const g = RA.UI.g; for (let k = 0; k < 40 && g.wave.q.length; k++) RA.step(30); for (const id of g.wave.ids) { const u = g.byId.get(id); if (u && !u.dead) kill(g, u, null, -1); } RA.step(70); });
  await page.waitForTimeout(1200);
  check('reward dialog with three cards', await page.evaluate(() => !document.getElementById('doctrine').hidden && RA.UI.rewardMode && document.querySelectorAll('.dcard').length === 3));
  await shot('124-reward');
  await page.evaluate(() => document.querySelectorAll('.dcard')[0].click()); await page.waitForTimeout(150);
  await page.click('#docConfirm'); await page.waitForTimeout(300);
  check('reward taken', await page.evaluate(() => !RA.UI.P.rewardAsk && RA.UI.P.rewards.length === 1 && document.getElementById('doctrine').hidden));
  check('save and load in wave mode', await page.evaluate(() => saveNow()));
  await page.evaluate(() => toMenu()); await page.waitForTimeout(300);
  await page.evaluate(() => continueGame()); await page.waitForTimeout(800);
  check('loaded wave state', await page.evaluate(() => RA.UI.g.wave && RA.UI.g.wave.cleared === 1 && RA.UI.kind === 'waves' && RA.UI.g.threat >= 0));
  /* Survival: sofort verlieren, Rekord */
  await page.evaluate(() => { toMenu(); RA.MENU.mode = 'survival'; RA.MENU.faction = 'mars'; });
  await page.waitForTimeout(300);
  await page.click('#mWaves'); await page.waitForTimeout(200);
  check('survival setup', await page.evaluate(() => RA.MENU.mode === 'survival' && document.getElementById('rowAllies').hidden));
  await page.click('#mStart'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = RA.UI.g; RA.UI.speed = 0.001; g.wave.cleared = 3; for (const b of g.bldgs) if (!b.dead && b.owner === RA.UI.me) kill(g, b, null, -1); for (const u of g.ships) if (!u.dead && u.owner === RA.UI.me) kill(g, u, null, -1); RA.step(90); });
  await page.waitForTimeout(2500);
  check('end screen shows waves survived and record', await page.evaluate(() => !document.getElementById('end').hidden && /3 Wellen/.test(document.getElementById('endTitle').textContent) && bestWave('mars') === 3));
  await shot('125-survival-end');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
