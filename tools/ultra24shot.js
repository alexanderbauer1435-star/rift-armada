/* Prüfung Fassung 24: Qualität »Ultra« (volle Auflösung, Bloom, feinere Modelle) und Bildratenanzeige. node tools/ultra24shot.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 506 }, deviceScaleFactor: 2.5 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'ultra', fps: true }, menu: {} })); localStorage.setItem('ra.seen', '1'); window.__RA_TEST = true; } catch (e) {} });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#sQual button, #sFps button')].map(b => b.textContent));
  await p.evaluate(() => beginGame({ map: 'arena', seed: 3, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(4000);
  const tris = async () => p.evaluate(() => { const g = UI.g, y = g.bldgs.find(b => b.owner === 0); R.center(y.x, y.y); R.cam.z = 1.6; return 0; });
  await tris(); await p.waitForTimeout(3500);
  const u = await p.evaluate(() => ({ q: RA3D.quality(), st: RA3D.stats(), fps: document.getElementById('fpsBox').textContent, vis: !document.getElementById('fpsBox').hidden, detail: R.detail }));
  await p.screenshot({ path: OUT + '/ultra24-on.jpg', type: 'jpeg', quality: 90 });
  await p.evaluate(() => { SET.qual = 'auto'; SET.fps = false; applySet(); }); await p.waitForTimeout(3500);
  const h = await p.evaluate(() => ({ q: RA3D.quality(), st: RA3D.stats(), vis: !document.getElementById('fpsBox').hidden, detail: R.detail }));
  await p.screenshot({ path: OUT + '/ultra24-high.jpg', type: 'jpeg', quality: 90 });
  const ok = rows.join('|').includes('Ultra') && rows.length >= 5 && u.detail === 3 && u.q.bloom !== undefined && u.q.scale > h.q.scale && u.vis && /FPS/.test(u.fps) && !h.vis && h.detail === 2 && u.st.tris > h.st.tris && !errs.length;
  if (!ok) console.log(JSON.stringify({ hv: h.vis, hd: h.detail, ud: u.detail, uv: u.vis, errs }));
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Ultra: Skalierung ' + u.q.scale + ' (Hoch ' + h.q.scale + '), Bloom ' + u.q.bloom + ', Dreiecke ' + u.st.tris + ' (Hoch ' + h.st.tris + '), Anzeige »' + u.fps + '«, Knöpfe ' + rows.join('/') + (errs.length ? ', Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
