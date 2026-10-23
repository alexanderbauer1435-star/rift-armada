/* Bildschirmtests Runde 3: Legion und Nexus im Übungsplatz, Tore, Ruinen, Stätten, Archivwahl, Verschmelzen, Übernahme.
   Aufruf: node tools/shot3.js build/Rift-Armada-05.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-05.html');
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
  check('setup shows all factions and opponent choice', await page.evaluate(() => document.querySelectorAll('#facCards .card').length === PLAYABLE.length && document.querySelectorAll('#slots .slot').length === 8));
  await shot('90-setup');
  await page.click('#mBack'); await page.waitForTimeout(200);
  /* Legion im Übungsplatz */
  await page.evaluate(() => { RA.MENU.faction = 'legion'; RA.MENU.oppF = 'nexus'; RA.MENU.slots = null; });
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('legion sandbox started vs nexus', await page.evaluate(() => RA.UI.P.faction === 'legion' && RA.UI.g.players[1].faction === 'nexus'));
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); R.cam.z = 0.9; R.center(b.x, b.y); });
  await shot('91-legion-base');
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const list = ['herald', 'paladin', 'bastion', 'inquisitor', 'reliquary', 'basilica', 'sovereign', 'sanctum', 'zealot', 'oracle', 'restorer', 'gleaner']; list.forEach((t, i) => { const u = addShip(g, t, me, b.x + 150 + (i % 4) * 110, b.y + 320 + (i / 4 | 0) * 110, 0); u.auto = false; }); RA.step(30 * 8); const fs = g.ships.find(u => u.type === 'sovereign'); setSel([fs]); R.cam.z = 1.1; R.center(b.x + 320, b.y + 430); });
  check('hero names and drones present', await page.evaluate(() => { const g = RA.UI.g; const p = g.ships.find(u => u.type === 'paladin'); return !!p.hero && p.hangar.n >= 1 && document.querySelector('#selCard').textContent.indexOf('Seraph') >= 0; }));
  await shot('92-legion-fleet');
  /* Tor antippen */
  await page.evaluate(() => { const g = RA.UI.g, gt = g.gates[0]; R.cam.z = 1; R.center(gt.x, gt.y); });
  await page.waitForTimeout(200);
  const gs = await page.evaluate(() => { const gt = RA.UI.g.gates[0]; return R.w2s(gt.x, gt.y); });
  await page.evaluate(() => desel());
  await page.touchscreen.tap(gs.x, gs.y); await page.waitForTimeout(400);
  check('tap selects gate and shows card', await page.evaluate(() => RA.UI.selS === RA.UI.g.gates[0].id && document.querySelector('#selCard').textContent.indexOf('Sprungtor') >= 0));
  await shot('93-gate-card');
  /* Tor aktivieren: Relikte geben, Schiffe hinstellen, Modi wählen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, gt = g.gates[0]; RA.UI.P.relics = 5; const a = addShip(g, 'paladin', me, gt.x + 150, gt.y, 0), b = addShip(g, 'paladin', me, gt.x + 150, gt.y + 60, 0); a.auto = b.auto = false; a.stance = b.stance = 2; RA.step(30 * 24); selSite(gt); });
  check('gate activated with relics', await page.evaluate(() => { const gt = RA.UI.g.gates[0]; return gt.owner === RA.UI.me && gt.state === 'active' && RA.UI.P.relics === 2; }));
  const modeBtns = await page.evaluate(() => [...document.querySelectorAll('#cmds .key')].map(b => b.textContent));
  check('gate mode buttons shown (' + modeBtns.join('|') + ')', modeBtns.some(t => t.indexOf('Lanze') >= 0));
  await page.evaluate(() => { issue({ t: 'gate', id: RA.UI.g.gates[0].id, mode: 'lance' }); RA.step(30 * 10); hudSel(); });
  check('lance mode charging', await page.evaluate(() => RA.UI.g.gates[0].mode === 'lance' && RA.UI.g.gates[0].charge > 0));
  await shot('94-gate-lance');
  /* Ruine und Stätte */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, ru = g.sites.find(s => s.kind === 'ruin'); const u = addShip(g, 'bastion', me, ru.x + ru.r + 60, ru.y, 0); u.auto = false; u.o = { t: 'hold' }; u.hold = true; u.hx = u.x; u.hy = u.y; window.__ru = u.id; selSite(ru); R.cam.z = 1.2; R.center(ru.x, ru.y); RA.step(30 * 5); hudSel(); });
  check('ruin card shows progress', await page.evaluate(() => { const ru = RA.UI.g.sites.find(s => s.kind === 'ruin'); return ru.prog > 0 && document.querySelector('#selCard').textContent.indexOf('Ruine') >= 0; }));
  await shot('95-ruin');
  await page.evaluate(() => { RA.step(30 * 10); });
  const ruSt = await page.evaluate(() => { const g = RA.UI.g, ru = g.sites.find(s => s.kind === 'ruin'); const h = g.ships.find(u => u.type === 'herald' && !u.dead); return JSON.stringify({ prog: ru.prog, sc: ru.scanned, by: ru.by, pr: presence(g, ru.x, ru.y, ru.r + 110), h: h ? [Math.round(hyp(h.x - ru.x, h.y - ru.y)), h.o && h.o.t] : null }); });
  check('ruin scanned ' + ruSt, JSON.parse(ruSt).sc);
  await page.evaluate(() => { const g = RA.UI.g, ci = g.sites.find(s => s.kind === 'citadel'); selSite(ci); R.cam.z = 0.9; R.center(ci.x, ci.y); });
  await shot('96-citadel');
  /* Archiv: Dialog */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, ar = g.sites.find(s => s.kind === 'archive'); for (let i = 0; i < 3; i++) { const u = addShip(g, 'bastion', me, ar.x + ar.r + 80, ar.y + i * 60 - 60, 0); u.auto = false; } RA.step(30 * 50); });
  await page.waitForTimeout(900);
  check('archive dialog opened with three techs', await page.evaluate(() => !document.getElementById('doctrine').hidden && document.querySelectorAll('.dcard').length === 3 && RA.UI.etechMode));
  await shot('97-archive');
  await page.evaluate(() => document.querySelectorAll('.dcard')[0].click());
  await page.waitForTimeout(150);
  await page.click('#docConfirm'); await page.waitForTimeout(300);
  check('erbauer tech chosen', await page.evaluate(() => !!RA.UI.P.etech && document.getElementById('doctrine').hidden));
  /* Nexus im Übungsplatz */
  await page.evaluate(() => { toMenu(); RA.MENU.faction = 'nexus'; RA.MENU.oppF = 'legion'; RA.MENU.slots = null; });
  await page.waitForTimeout(300);
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); R.cam.z = 0.9; R.center(b.x, b.y); const s = g.ships.find(u => u.owner === me && u.def.build); setSel([s]); });
  check('nexus base connected, net shown for builder', await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me; return g.bldgs.filter(b => b.owner === me).every(b => !b.off); }));
  await shot('98-nexus-base');
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const sh = [0, 1, 2].map(i => { const u = addShip(g, 'shard', me, b.x + 300 + i * 30, b.y + 300, 0); u.auto = false; return u; }); const extra = ['prism', 'monolith', 'binder', 'mirror', 'facet', 'lattice', 'conduit', 'spire', 'harvester']; extra.forEach((t, i) => { const u = addShip(g, t, me, b.x + 420 + (i % 3) * 130, b.y + 420 + (i / 3 | 0) * 120, 0); u.auto = false; }); RA.step(30); setSel(sh); R.cam.z = 1.1; R.center(b.x + 450, b.y + 450); });
  const mergeBtn = await page.evaluate(() => [...document.querySelectorAll('#cmds .key.ab')].findIndex(b => b.textContent.indexOf('Verschmelzen') >= 0));
  check('merge button for three shards', mergeBtn >= 0);
  await shot('99-nexus-fleet');
  await page.evaluate(() => useAbility('merge'));
  await page.waitForTimeout(200);
  check('shards merged into prism', await page.evaluate(() => RA.UI.g.ships.filter(u => !u.dead && u.type === 'prism' && u.owner === RA.UI.me).length === 2));
  /* Übernahme per Taste und Ziel */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.ships.find(u => u.type === 'binder'); const bs = g.bldgs.find(x => x.owner === me && x.role === 'base'); b.x = bs.x - 500; b.y = bs.y - 400; b.hx = b.x; b.hy = b.y; const v = addShip(g, 'paladin', 1 - me, b.x + 100, b.y, Math.PI); v.stance = 2; v.hull = v.hullMax * 0.15; v.shield = 0; v.o = { t: 'hold' }; v.hold = true; window.__tgt = v.id; setSel([b]); R.cam.z = 1.2; R.center(b.x + 50, b.y); RA.step(5); });
  check('target alive for bind', await page.evaluate(() => { const t = RA.UI.g.byId.get(window.__tgt); return !!t && !t.dead; }));
  await page.evaluate(() => useAbility('bind'));
  check('bind target mode', await page.evaluate(() => RA.UI.mode === 'abt' && RA.UI.abId === 'bind'));
  const ts = await page.evaluate(() => { const t = RA.UI.g.byId.get(window.__tgt); return R.w2s(t.x, t.y); });
  await page.touchscreen.tap(ts.x, ts.y); await page.waitForTimeout(450);
  check('tap captures the paladin', await page.evaluate(() => RA.UI.g.byId.get(window.__tgt).owner === RA.UI.me));
  await shot('100-bind');
  /* Flackerndes Tor: zweiter Spieler Karte? Übungsplatz-Karte hat ein totes Tor; prüfe Minikarte-Icons */
  check('minimap renders', await page.evaluate(() => { R.drawMini(); return true; }));
  /* Speichern und laden mit Runde-3-Zustand */
  const okSave = await page.evaluate(() => saveNow());
  check('save works', okSave);
  await page.evaluate(() => toMenu()); await page.waitForTimeout(300);
  await page.evaluate(() => continueGame()); await page.waitForTimeout(800);
  check('load restores sites and gates', await page.evaluate(() => RA.UI.g && RA.UI.g.sites.length > 0 && RA.UI.g.gates.length > 0 && RA.UI.g.byId.get(RA.UI.g.sites[0].id) === RA.UI.g.sites[0]));
  await page.evaluate(() => { RA.step(60); });
  await page.waitForTimeout(300);
  /* Hauptmenü mit Hintergrundgefecht neuer Fraktionen */
  await page.evaluate(() => toMenu());
  await page.waitForTimeout(1500);
  await shot('101-menu-attract');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
