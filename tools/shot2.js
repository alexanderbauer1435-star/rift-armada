/* Bildschirmtests Runde 2 im Handyformat: Übungsplatz, Fähigkeiten, Subsystem-Ziel, Doktrin, Entern, Superwaffen,
   Flaggschiffe, neue Schiffe. Aufruf: node tools/shot2.js build/Rift-Armada-03.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-03.html');
const OUT = path.resolve(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [], fails = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const shot = async n => { await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(600);
  await shot('20-menu');
  /* Übungsplatz starten (Alliance) */
  await page.evaluate(() => { RA.MENU.faction = 'alliance'; RA.MENU.oppF = 'mars'; RA.MENU.slots = null; });
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('sandbox started', await page.evaluate(() => RA.UI.kind === 'sandbox' && RA.UI.g.opts.sandbox === true));
  check('sandbox: all techs, yard III, lab III', await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, P = g.players[me]; return Object.keys(P.tech).length === TECH[P.faction].length && g.bldgs.some(b => b.owner === me && b.role === 'yard' && b.lv === 3) && g.bldgs.some(b => b.owner === me && b.role === 'lab' && b.lv === 3); }));
  await shot('21-sandbox');
  /* Doktrin über die Basis öffnen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); selBldg(b); R.center(b.x, b.y); });
  await page.waitForTimeout(300);
  const docBtn = await page.evaluate(() => [...document.querySelectorAll('#cmds .key')].findIndex(b => b.textContent.indexOf('Doktrin') >= 0));
  check('doctrine button on base', docBtn >= 0);
  await page.evaluate(() => openDoctrine());
  await page.waitForTimeout(300);
  check('doctrine dialog open with 3 cards', await page.evaluate(() => !document.getElementById('doctrine').hidden && document.querySelectorAll('.dcard').length === 3));
  await shot('22-doctrine');
  await page.evaluate(() => document.querySelectorAll('.dcard')[2].click());
  await page.waitForTimeout(200);
  await page.click('#docConfirm'); await page.waitForTimeout(300);
  check('doctrine chosen: hardline', await page.evaluate(() => RA.UI.P.doctrine === 'hardline' && document.getElementById('doctrine').hidden));
  /* Werft: Flaggschiff und Doktrin-Schiff in der Liste */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, y = g.bldgs.find(x => x.owner === me && x.role === 'yard'); selBldg(y); R.center(y.x, y.y); });
  await page.waitForTimeout(300);
  const items = await page.evaluate(() => [...document.querySelectorAll('#items .item')].map(b => ({ nm: b.querySelector('.nm').textContent, off: b.classList.contains('off'), lock: (b.querySelector('.lock') || {}).textContent || '' })));
  check('yard lists Archipelago buildable', items.some(i => i.nm === 'Archipelago' && !i.off));
  check('yard lists Reckoning buildable, Aegis locked', items.some(i => i.nm === 'Reckoning' && !i.off) && items.some(i => i.nm === 'Aegis' && i.off));
  await shot('23-yard-flagship');
  /* Flaggschiff und Begleiter aufstellen, Fähigkeiten-Tasten */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const fs = addShip(g, 'archipelago', me, b.x + 260, b.y + 120, 0); const l = addShip(g, 'lancer', me, b.x + 300, b.y + 60, 0); const l2 = addShip(g, 'reckoning', me, b.x + 300, b.y + 180, 0); fs.auto = false; l.auto = false; l2.auto = false; RA.UI.sel.clear(); RA.UI.sel.add(fs.id); RA.UI.selB = 0; hudSel(); R.cam.z = 1.1; R.center(fs.x, fs.y); RA.step(5); });
  await page.waitForTimeout(300);
  const abBtns = await page.evaluate(() => [...document.querySelectorAll('#cmds .key.ab')].map(b => b.textContent));
  check('flagship shows 3 ability buttons (' + abBtns.join(' | ') + ')', abBtns.length === 3);
  check('commander on card', await page.evaluate(() => document.querySelector('#selCard .cmdr') !== null && document.querySelector('#selCard .subs') !== null));
  await shot('24-flagship-card');
  /* Fähigkeit per Taste zünden: Feldwerft */
  const fy = await page.$('#cmds .key.ab');
  await fy.tap(); await page.waitForTimeout(300);
  check('ability fired via button', await page.evaluate(() => { const u = RA.UI.g.byId.get([...RA.UI.sel][0]); return u.abcd.fieldyard > 0 && u.abT.fieldyard > 0; }));
  check('button shows cooldown', await page.evaluate(() => document.querySelector('#cmds .key.ab').classList.contains('cd')));
  /* Subsystem-Ziel: Gegner aufstellen, Ziel-Taste durchschalten, angreifen */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, fs = g.byId.get([...RA.UI.sel][0]); const t = addShip(g, 'olympus', 1 - me, fs.x + 330, fs.y, Math.PI); t.stance = 2; t.hold = true; window.__tgt = t.id; RA.step(2); });
  await page.evaluate(() => { cycleSub(); });
  check('sub aim cycles to drive', await page.evaluate(() => RA.UI.subAim === 'drive'));
  await page.evaluate(() => { const g = RA.UI.g, t = g.byId.get(window.__tgt); order(selShips(), t, t.x, t.y); RA.step(30 * 6); });
  await page.waitForTimeout(300);
  const subInfo = await page.evaluate(() => { const t = RA.UI.g.byId.get(window.__tgt); const u = RA.UI.g.byId.get([...RA.UI.sel][0]); if (!t || !u) return { o: 'gone' }; return { o: u.o.t, sub: u.o.sub, drive: +t.sub.drive.toFixed(2), wpn: +t.sub.wpn.toFixed(2), hull: Math.round(t.hull) }; });
  check('attack order carries subsystem, drive damaged ' + JSON.stringify(subInfo), subInfo.o === 'attack' && subInfo.sub === 'drive' && subInfo.drive < 1);
  await shot('25-subsystem-attack');
  /* Mars-Seite: Entern und Massetreiber im Übungsplatz */
  await page.evaluate(() => { toMenu(); RA.MENU.faction = 'mars'; RA.MENU.oppF = 'alliance'; RA.MENU.slots = null; });
  await page.waitForTimeout(300);
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const b1 = addShip(g, 'boarder', me, b.x + 640, b.y + 100, 0); const b2 = addShip(g, 'dropship', me, b.x + 640, b.y + 160, 0); b1.auto = b2.auto = false; b1.stance = b2.stance = 2; const t = addShip(g, 'lancer', 1 - me, b.x + 820, b.y + 130, Math.PI); t.stance = 2; t.hold = true; t.crew = 12; t.shield = 0; window.__tgt = t.id; RA.UI.sel.clear(); RA.UI.sel.add(b1.id); RA.UI.sel.add(b2.id); RA.UI.selB = 0; hudSel(); R.cam.z = 1.1; R.center(b.x + 730, b.y + 130); RA.step(20); });
  await page.waitForTimeout(300);
  const boardBtn = await page.evaluate(() => [...document.querySelectorAll('#cmds .key.ab')].findIndex(b => b.textContent.indexOf('Entern') >= 0));
  check('board button present', boardBtn >= 0);
  await page.evaluate(() => useAbility('board'));
  check('board mode entered', await page.evaluate(() => RA.UI.mode === 'board'));
  const ts = await page.evaluate(() => { const t = RA.UI.g.byId.get(window.__tgt); return R.w2s(t.x, t.y); });
  await page.touchscreen.tap(ts.x, ts.y); await page.waitForTimeout(450);
  const bi = await page.evaluate(() => ({ mode: RA.UI.mode, ords: selShips().map(u => u.o.t), info: document.getElementById('info').textContent, hit: (() => { const t = RA.UI.g.byId.get(window.__tgt); const h = pickAt(t.x, t.y); return h ? h.type + ':' + h.owner : null; })(), ts: (() => { const t = RA.UI.g.byId.get(window.__tgt); return R.w2s(t.x, t.y); })() }));
  check('tap target issues board order ' + JSON.stringify(bi) + ' tapped ' + JSON.stringify(ts), bi.ords.every(o => o === 'board'));
  await page.evaluate(() => { RA.step(30 * 25); });
  await page.waitForTimeout(300);
  check('lancer captured by marines', await page.evaluate(() => RA.UI.g.byId.get(window.__tgt).owner === RA.UI.me));
  await shot('26-boarding');
  /* Massetreiber bauen (sofort), laden, Ziel wählen, feuern */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const s = aiSpot(g, me, 'super', b.x, b.y, 170, 420); const md = addBldg(g, 'super', me, s.x, s.y, true); md.charge = 1; recalcPower(g, me); selBldg(md); R.cam.z = 0.9; R.center(md.x, md.y); RA.step(2); });
  await page.waitForTimeout(300);
  check('super building card shows ready', await page.evaluate(() => document.querySelector('#selCard').textContent.indexOf('Bereit') >= 0));
  await shot('27-massdriver');
  await page.evaluate(() => startSuper());
  check('super target mode', await page.evaluate(() => RA.UI.mode === 'super'));
  const tgt = await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me; const d = g.ships.find(u => !u.dead && u.owner !== me && u.dummy); R.center(d.x, d.y); return R.w2s(d.x, d.y); });
  await page.touchscreen.tap(tgt.x, tgt.y); await page.waitForTimeout(200);
  check('target set', await page.evaluate(() => !!RA.UI.superTgt));
  await shot('28-super-target');
  await page.evaluate(() => confirmSuper());
  check('strike launched', await page.evaluate(() => RA.UI.g.strikes.length === 1));
  await page.evaluate(() => { RA.step(30 * 2); });
  await page.waitForTimeout(200);
  await shot('29-strike-flight');
  const before = await page.evaluate(() => RA.UI.P.stats.kills);
  await page.evaluate(() => { RA.step(30 * 2); });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => RA.UI.P.stats.kills);
  check('strike kills dummies (kills ' + before + ' → ' + after + ')', after > before);
  await shot('30-strike-impact');
  /* Alliance Exodus-Tor */
  await page.evaluate(() => { toMenu(); RA.MENU.faction = 'alliance'; RA.MENU.oppF = 'mars'; RA.MENU.slots = null; });
  await page.waitForTimeout(300);
  await page.click('#mSandbox'); await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'); const s = aiSpot(g, me, 'super', b.x, b.y, 170, 420); const gate = addBldg(g, 'super', me, s.x, s.y, true); gate.charge = 1; gate.lv = 3; for (let i = 0; i < 4; i++) { const u = addShip(g, ['lancer', 'bulwark', 'aegis', 'wren'][i], me, gate.x + 90 + i * 30, gate.y - 60 + i * 40, 0); u.auto = false; } recalcPower(g, me); selBldg(gate); R.cam.z = 0.8; R.center(gate.x, gate.y); RA.step(2); });
  await page.waitForTimeout(300);
  await shot('31-exodus-gate');
  await page.evaluate(() => { startSuper(); const g = RA.UI.g; RA.UI.superTgt = { x: g.map.w / 2, y: g.map.h / 2 }; confirmSuper(); RA.step(3); R.center(g.map.w / 2, g.map.h / 2); });
  await page.waitForTimeout(300);
  check('exodus moved ships to center', await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me; return g.ships.filter(u => !u.dead && u.owner === me && armed(u) && Math.hypot(u.x - g.map.w / 2, u.y - g.map.h / 2) < 200).length >= 4; }));
  await shot('32-exodus-arrival');
  /* Neue Schiffe in einer Reihe */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, cx = g.map.w / 2, cy = g.map.h / 2 - 260; const list = ['archipelago', 'aegis', 'beacon', 'reckoning', 'olympus', 'boarder', 'longshot', 'dropship', 'wasp']; list.forEach((t, i) => { const u = addShip(g, t, SHIPS[t].f === 'alliance' ? me : 1 - me, cx - 400 + i * 100, cy, 0); u.stance = 2; u.hold = true; u.auto = false; }); R.cam.z = 1.4; R.center(cx, cy); RA.step(2); });
  await page.waitForTimeout(300);
  await shot('33-new-ships');
  /* Wrack und Neubesatzung */
  await page.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, u = g.ships.find(x => x.owner === me && x.type === 'lancer'); u.sub.life = 0; u.crew = 1; RA.step(40); setSel([u]); R.cam.z = 1.3; R.center(u.x, u.y); });
  await page.waitForTimeout(300);
  const dcard = await page.evaluate(() => { const u = RA.UI.g.byId.get([...RA.UI.sel][0]); return { card: document.querySelector('#selCard').textContent.slice(0, 80), der: u && u.derelict, crew: u && u.crew, dead: u && u.dead, life: u && u.sub.life }; });
  check('derelict shown on card ' + JSON.stringify(dcard), dcard.card.indexOf('Wrack') >= 0);
  await shot('34-derelict');
  /* Speichern und laden mit Runde-2-Zustand */
  const okSave = await page.evaluate(() => { RA.UI.kind = 'sandbox'; return saveNow(); });
  check('save works with round-2 state', okSave);
  await page.evaluate(() => { toMenu(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => continueGame());
  await page.waitForTimeout(800);
  check('load restores sandbox with reveals/strikes arrays', await page.evaluate(() => RA.UI.g && Array.isArray(RA.UI.g.reveals) && Array.isArray(RA.UI.g.strikes) && RA.UI.kind === 'sandbox'));
  await shot('35-loaded');
  await page.evaluate(() => { RA.step(60); });
  await page.waitForTimeout(200);
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
