/* Mehrspieler mit eigener Karte: nur das eröffnende Gerät hat die Karte gespeichert. Der Mitspieler bekommt das Layout mit
   den Lobby-Einstellungen, sieht die Vorschau und spielt dieselbe Karte im Gleichschritt.
   node tools/edmp.js build/rift-armada.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'rift-armada.html'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
  const mk = async () => { const c = await browser.newContext({ viewport: { width: 800, height: 380 }, hasTouch: true, isMobile: true, locale: 'de-DE' }); return c.newPage(); };
  const A = await mk(), B = await mk(), errors = [], fails = [];
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errors.push(n + ' PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(n + ' CONSOLE ' + m.text()); }); }
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const wait = async (p, fn, ms) => { try { await p.waitForFunction(fn, null, { timeout: ms }); return true; } catch (e) { return false; } };
  for (const p of [A, B]) { await p.goto('file://' + file); await p.evaluate(() => { window.__RA_TEST = 1; }); await p.waitForTimeout(500); }
  /* A: eigene Karte für zwei Spieler speichern */
  const id = await A.evaluate(() => { const L = customDefault(2, 4000); L.n = 'Duell am Gürtel'; L.bl.push([1400, 2000, 2600, 2000]); L.ion.push([2000, 1300, 200], [2000, 2700, 200]); edStore([{ id: 'cu_mptest', L }]); edRegisterAll(); return edMapIds(2)[0]; });
  check('host has the custom map ' + id, id === 'cu_mptest');
  check('guest does not have it', await B.evaluate(() => !MAPS.cu_mptest));
  /* verbinden */
  await A.click('#mMp'); await A.waitForTimeout(200); await A.click('#mpHost');
  await wait(A, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'offer', 15000);
  const offer = await A.evaluate(() => document.getElementById('mpOwn').value);
  await B.click('#mMp'); await B.waitForTimeout(200); await B.click('#mpJoin'); await B.waitForTimeout(150); await B.fill('#mpIn1', offer);
  await wait(B, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'answer', 15000);
  await A.fill('#mpIn2', await B.evaluate(() => document.getElementById('mpOwn').value));
  check('connected', await wait(A, () => RA.NET.hello && RA.MPU.pane === 'lobby', 20000) && await wait(B, () => RA.NET.hello && RA.MPU.pane === 'lobby', 20000));
  /* zwei Menschen, eigene Karte wählen */
  /* Lobby für bis zu acht: Gastgeber und Gast belegen zwei Plätze, »Jeder für sich« */
  await A.evaluate(() => { const b = [...document.querySelectorAll('#mpPreset button')].find(x => /Jeder für sich/.test(x.textContent)); if (b) b.click(); });
  await wait(A, () => RA.MPL.slots.filter(q => q.t === 'h').length === 2, 8000);
  await A.evaluate(() => { [...document.querySelectorAll('#mpMap button')].find(x => /Duell am Gürtel/.test(x.textContent)).click(); });
  check('guest receives the layout and shows it in the lobby', await wait(B, () => RA.MPL.map === 'cu_mptest' && MAPS.cu_mptest && MAPS.cu_mptest.layout.bl.length === 1 && /Duell am Gürtel/.test(document.getElementById('mpMapInfo').textContent), 8000));
  await wait(A, () => !document.getElementById('mpStart').disabled, 5000);
  await A.click('#mpStart');
  check('both in the game', await wait(A, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000) && await wait(B, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000));
  const ma = await A.evaluate(() => [RA.UI.g.map.name, RA.UI.g.map.w, RA.UI.g.map.rocks.length, RA.UI.g.map.nebs.length].join('/')), mb = await B.evaluate(() => [RA.UI.g.map.name, RA.UI.g.map.w, RA.UI.g.map.rocks.length, RA.UI.g.map.nebs.length].join('/'));
  check('same custom map on both devices (' + ma + ' | ' + mb + ')', ma === mb && /^Duell am Gürtel\/4000/.test(ma));
  await A.waitForTimeout(10000);
  const hA = await A.evaluate(() => ({ t: RA.UI.g.tick, ok: RA.NET.okHash, sy: RA.NET.syncs })), hB = await B.evaluate(() => ({ t: RA.UI.g.tick, ok: RA.NET.okHash, sy: RA.NET.syncs }));
  console.log('     ticks', hA.t, hB.t, 'hash ok', hA.ok, hB.ok, 'syncs', hA.sy, hB.sy);
  check('lockstep hashes agree without resync', hA.t > 150 && hA.ok >= 1 && hA.sy === 0 && hB.sy === 0);
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  console.log(fails.length || errors.length ? 'FAILS ' + (fails.length + errors.length) : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
