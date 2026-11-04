/* Prüfung Fassung 24: Maus – Linksklick ins Leere, mit kleinem Verrutschen und über einem Fels/Feld hebt die Auswahl
   auf; Linksklick auf eigenes Schiff wählt. node tools/desel24.js build/rift-armada.html */
const { chromium } = require('playwright'); const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1200, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
  await p.waitForTimeout(1500);
  const sel = () => p.evaluate(() => UI.sel.size + (UI.selB ? 1 : 0));
  const setup = () => p.evaluate(() => { UI.speed = 0.0001; const g = UI.g, mine = g.ships.filter(u => u.owner === UI.me); setSel(mine); const u = mine[0]; R.center(u.x, u.y); const s = R.w2s ? R.w2s(u.x, u.y) : null; return { n: mine.length, s }; });
  const out = [];
  let st = await setup(); await p.waitForTimeout(300);
  const empty = await p.evaluate(() => { for (let k = 0; k < 400; k++) { const x = 100 + Math.random() * 1000, y = 120 + Math.random() * 450, w = R.s2w(x, y); if (!pickAt(w.x, w.y) && !nearWreck(UI.g, w.x, w.y, 200)) return { x, y }; } return null; });
  await p.mouse.click(empty.x, empty.y); await p.waitForTimeout(200); out.push(['Klick ins Leere', st.n, await sel()]);
  st = await setup(); await p.waitForTimeout(200);
  await p.mouse.move(empty.x, empty.y); await p.mouse.down(); await p.mouse.move(empty.x + 9, empty.y + 4, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(200); out.push(['Klick mit Verrutschen', st.n, await sel()]);
  const ok = out.every(([, n, s]) => n > 0 && s === 0) && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'Maus-Abwahl: ' + out.map(([t, n, s]) => t + ' ' + n + '→' + s).join(', ') + (errs.length ? ' Fehler ' + errs[0] : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
