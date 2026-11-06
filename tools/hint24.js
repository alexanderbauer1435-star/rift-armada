/* Prüfung Fassung 24 Spielerlebnis: Trümmerfeld als Staubwolke (Bild), Antippen im Feld erklärt es,
   Erstkontakt-Hinweise erscheinen einmal (Trümmerfeld, Lahmlegen) und bleiben danach aus.
   node tools/hint24.js build/rift-armada.html [ordner] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /RA3D/.test(t)) && !/KHR_parallel/.test(t)) errs.push(t); });
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto' }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  let d = null;
  for (const map of ['shattered', 'arena', 'crossroads', 'test']) for (const seed of [4, 7, 11]) {
    if (d) break;
    await p.evaluate(o => beginGame({ map: o.map, seed: o.seed, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'), { map, seed });
    await p.waitForTimeout(800);
    d = await p.evaluate(() => { const m = UI.g.map; return m.debris && m.debris.length ? Object.assign({ map: m.name || '' }, m.debris[0]) : null; });
  }
  if (!d) { console.log('FAIL keine Karte mit Trümmerfeld'); console.log('1 FEHLER'); await b.close(); process.exit(1); }
  await p.waitForTimeout(2000);
  const out = [];
  /* 1) Bild: Feld von nahem, eigenes Schiff darin → Hinweis "Trümmerfeld" */
  await p.evaluate(d => { const g = UI.g; for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1; g.reveals.push({ x: d.x, y: d.y, r: 2500, owner: 0, until: 1e9 });
    const u = g.ships.find(s => s.owner === 0 && s.def.role !== 'fighter'); u.x = d.x; u.y = d.y; u.lx = u.x; u.ly = u.y; setIdle(u); setSel([]); UI.speed = 1; R.center(d.x, d.y); R.cam.z = Math.min(1.4, 300 / d.r); }, d);
  await p.waitForTimeout(3500);
  const h1 = await p.evaluate(() => ({ cur: UI.hintCur, vis: !document.getElementById('hintCard').hidden, txt: document.getElementById('hintT').textContent }));
  out.push(['Hinweis Trümmerfeld', h1.cur === 'debris' && h1.vis]);
  await p.screenshot({ path: OUT + '/hint24-debris.jpg', type: 'jpeg', quality: 90 });
  /* 2) OK schließt; Hinweis kommt nicht wieder */
  await p.click('#hintOk'); await p.waitForTimeout(1500);
  const h2 = await p.evaluate(() => ({ cur: UI.hintCur, vis: !document.getElementById('hintCard').hidden, seen: !!(SET.seenTips || {}).debris }));
  out.push(['OK schließt, gemerkt', !h2.vis && h2.seen && h2.cur !== 'debris']);
  /* 3) Antippen im Feld ohne Auswahl → Erklärung */
  const info = await p.evaluate(d => { setSel([]); UI.selB = 0; const g = UI.g; for (const u of g.ships) if (u.owner === 0 && Math.hypot(u.x - d.x, u.y - d.y) < d.r) { u.x = d.x + d.r * 3; u.lx = u.x; }
    for (let k = 0; k < 60; k++) { const a = k * 0.7, rr = d.r * 0.5 * (k % 5) / 5, x = d.x + Math.cos(a) * rr, y = d.y + Math.sin(a) * rr; if (!pickAt(x, y) && !nearWreck(g, x, y, 60) && inDebris(g.map, x, y)) { const s = R.w2s(x, y); tap(s.x, s.y); return document.getElementById('info').textContent; } } return ''; }, d);
  out.push(['Antippen erklärt Feld', /Trümmerfeld/.test(info)]);
  /* 4) Lahmlegen-Hinweis kommt über das Ereignis, zweites Mal nicht */
  const h4 = await p.evaluate(() => { UI.hintQ = []; UI.consume([{ t: 'crippled', owner: 1, by: 0, name: 'Hammer', x: 0, y: 0, id: 1 }]); const a = UI.hintCur; hintNext(); UI.consume([{ t: 'crippled', owner: 1, by: 0, name: 'Hammer', x: 0, y: 0, id: 1 }]); return [a, UI.hintCur]; });
  out.push(['Lahmlegen einmalig', h4[0] === 'crippled' && h4[1] !== 'crippled']);
  /* 5) Aus in den Einstellungen → nichts */
  const h5 = await p.evaluate(() => { SET.hints = false; SET.seenTips = {}; hint('wreck'); const r = UI.hintCur; SET.hints = true; return r; });
  out.push(['Einstellung aus', h5 !== 'wreck']);
  const ok = out.every(o => o[1]) && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Spielerlebnis (' + d.map + '): ' + out.map(o => o[0] + (o[1] ? ' ✓' : ' ✗')).join(', ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
