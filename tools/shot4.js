/* Bildschirmtests Runde 4: The Brood im Übungsplatz – Nest, Flotte, Mutation, Wrack fressen, Sporen, Säure, Brutsturm, Spielstand.
   Aufruf: node tools/shot4.js build/Rift-Armada-06.html */
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
  await page.click('#mSkirm'); await page.waitForTimeout(300);
  check('setup shows five factions', await page.evaluate(() => document.querySelectorAll('#facCards .card').length === 5 && document.querySelectorAll('#slots .slot').length === 8));
  await shot('110-setup5');
  await page.click('#mBack'); await page.waitForTimeout(200);
  await page.evaluate(() => { RA.MENU.faction = 'brood'; RA.MENU.oppF = 'mars'; RA.MENU.slots = null; });
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('brood sandbox started', await page.evaluate(() => RA.UI.P.faction === 'brood' && RA.UI.g.players[1].faction === 'mars'));
  check('resource bar shows biomass only', await page.evaluate(() => document.getElementById('resOre').hidden && document.getElementById('resIce').classList.contains('bio')));
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const s = aiSpot(g, me, 'spore', b.x, b.y, 200, 420); if (s) addBldg(g, 'spore', me, s.x, s.y, true); const t = aiSpot(g, me, 'turret', b.x, b.y, 200, 420); if (t) addBldg(g, 'turret', me, t.x, t.y, true); const q = aiSpot(g, me, 'super', b.x, b.y, 220, 460); if (q) { const sb = addBldg(g, 'super', me, q.x, q.y, true); sb.charge = 1; } recalcPower(g, me); R.cam.z = 0.8; R.center(b.x, b.y); });
  await page.waitForTimeout(300);
  await shot('111-brood-nest');
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const list = ['larva', 'swarm', 'spitter', 'ravager', 'leech', 'sporer', 'acidmaw', 'leviathan', 'matriarch', 'broodmother', 'plaguebearer', 'behemoth', 'seeder', 'grazer']; list.forEach((t, i) => { const u = addShip(g, t, me, b.x + 150 + (i % 5) * 120, b.y + 320 + (i / 5 | 0) * 130, 0); u.auto = false; u.o = { t: 'hold' }; u.hold = true; }); RA.step(10); const m = g.ships.find(u => u.type === 'matriarch'); setSel([m]); R.cam.z = 1; R.center(b.x + 380, b.y + 440); });
  check('matriarch card shows commander and abilities', await page.evaluate(() => document.querySelector('#selCard').textContent.indexOf('Matriarch') >= 0 && [...document.querySelectorAll('#cmds .key.ab')].length >= 3));
  await shot('112-brood-fleet');
  /* Larve mutieren */
  await page.evaluate(() => { const g = RA.UI.g; const l = g.ships.find(u => u.type === 'larva'); setSel([l]); });
  const mutBtns = await page.evaluate(() => [...document.querySelectorAll('#cmds .key.ab')].map(b => b.textContent));
  check('larva shows four mutation buttons (' + mutBtns.join('|') + ')', mutBtns.filter(t => /Schwarm|Spitter|Ravager|Leech/.test(t)).length === 4);
  const bio0 = await page.evaluate(() => RA.UI.P.ice);
  await page.evaluate(() => useAbility('mutRav'));
  await page.waitForTimeout(200);
  check('larva in cocoon and biomass paid', await page.evaluate(() => { const l = RA.UI.g.ships.find(u => u.type === 'larva'); return !!l.cocoon; }) && (await page.evaluate(() => RA.UI.P.ice)) < bio0);
  await page.evaluate(() => { const g = RA.UI.g; const l = g.ships.find(u => u.type === 'larva'); R.cam.z = 1.4; R.center(l.x, l.y); });
  await shot('113-cocoon');
  await page.evaluate(() => { RA.step(30 * 9); });
  check('larva became ravager', await page.evaluate(() => { const g = RA.UI.g; return !g.ships.some(u => u.type === 'larva' && !u.dead) && g.ships.filter(u => u.type === 'ravager' && !u.dead && u.owner === RA.UI.me).length === 2; }));
  /* Grazer frisst ein Wrack */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, gz = g.ships.filter(u => u.type === 'grazer' && u.owner === me).pop(); const w = addShip(g, 'hedgehog', 1 - me, gz.x + 160, gz.y, 0); makeDerelict(g, w); window.__w = w.id; setSel([gz]); R.cam.z = 1.2; R.center(gz.x + 80, gz.y); });
  const ws = await page.evaluate(() => { const w = RA.UI.g.byId.get(window.__w); return R.w2s(w.x, w.y); });
  await page.touchscreen.tap(ws.x, ws.y); await page.waitForTimeout(300);
  check('tap on wreck gives eat order', await page.evaluate(() => { const gz = RA.UI.g.ships.find(u => u.type === 'grazer' && u.o.t === 'eat'); return !!gz; }));
  await page.evaluate(() => { RA.step(30 * 6); });
  await shot('114-eat');
  check('grazer gained cargo from the wreck', await page.evaluate(() => { const gz = RA.UI.g.ships.find(u => u.type === 'grazer' && u.owner === RA.UI.me && (u.cargo > 20 || u.o.t === 'return')); return !!gz; }));
  /* Sporenteppich und Säure im Gefecht */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, sp = g.ships.find(u => u.type === 'sporer'); useAbilityFor(sp); function useAbilityFor(u) { setSel([u]); useAbility('carpet'); } for (let i = 0; i < 3; i++) { const v = addShip(g, 'hedgehog', 1 - me, sp.x + 220, sp.y + i * 60 - 60, Math.PI); v.stance = 0; } const sps = g.ships.filter(u => u.owner === me && (u.type === 'spitter' || u.type === 'acidmaw' || u.type === 'swarm')); for (const u of sps) { u.hold = false; } issue({ t: 'move', u: sps.map(u => u.id), x: sp.x + 200, y: sp.y, am: 1 }); R.cam.z = 1; R.center(sp.x + 120, sp.y); RA.step(30 * 4); });
  await page.waitForTimeout(300);
  check('spore carpet present and acid applied', await page.evaluate(() => RA.UI.g.spores.length > 0 && (RA.UI.g.ships.some(u => u.owner !== RA.UI.me && u.acid) || RA.UI.P.stats.kills > 0)));
  await shot('115-spores-acid');
  /* Brutsturm */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, sb = g.bldgs.find(x => x.owner === me && x.role === 'super'); selBldg(sb); });
  await page.evaluate(() => startSuper());
  check('super target mode', await page.evaluate(() => RA.UI.mode === 'super'));
  const tgt = await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me; const d = g.ships.find(u => !u.dead && u.owner !== me && u.dummy); R.center(d.x, d.y); return R.w2s(d.x, d.y); });
  await page.touchscreen.tap(tgt.x, tgt.y); await page.waitForTimeout(200);
  await page.evaluate(() => confirmSuper());
  await page.evaluate(() => { RA.step(20); });
  await page.waitForTimeout(300);
  check('broodstorm spawned temporary swarms', await page.evaluate(() => RA.UI.g.ships.filter(u => !u.dead && u.owner === RA.UI.me && u.until > 0).length >= 8));
  await shot('116-broodstorm');
  /* Spielstand */
  check('save works with brood state', await page.evaluate(() => saveNow()));
  await page.evaluate(() => toMenu()); await page.waitForTimeout(300);
  await page.evaluate(() => continueGame()); await page.waitForTimeout(800);
  check('load restores brood game', await page.evaluate(() => RA.UI.g && RA.UI.P.faction === 'brood' && RA.UI.g.spores !== undefined && RA.UI.g.ships.some(u => u.def.swarm)));
  await page.evaluate(() => { RA.step(60); });
  await page.waitForTimeout(300);
  /* Gegner Brood: Alliance-Sicht auf Brood-Flotte */
  await page.evaluate(() => { toMenu(); RA.MENU.faction = 'alliance'; RA.MENU.oppF = 'brood'; RA.MENU.slots = null; });
  await page.waitForTimeout(300);
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; const g = RA.UI.g, cx = g.map.w / 2, cy = g.map.h / 2; R.cam.z = 1.1; R.center(cx, cy); });
  await shot('117-brood-dummies');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
