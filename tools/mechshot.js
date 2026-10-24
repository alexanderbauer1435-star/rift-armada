/* Neue Mechaniken im Bild (3D): getarnter Wren, Wrack mit Bergungsring bei gewählten Frachtern, Haltung Vorsichtig.
   node tools/mechshot.js → tools/shots/mech-*.png */
const { chromium } = require('playwright'); const path = require('path');
const file = path.join(__dirname, '..', 'build', 'rift-armada.html'), OUT = path.join(__dirname, 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0 }, menu: {} })); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__RA_TEST = 1; MENU.map = 'expanse'; MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const g = UI.g, me = UI.me, s = g.players[me].start; UI.speed = 0;
    for (const pl of g.players) for (let i = 0; i < pl.explored.length; i++) pl.explored[i] = 1;
    const x = s.x + 520, y = s.y + 300;
    const w = addShip(g, 'wren', me, x, y, 0.3); abilityUse(g, w, 'cloak');
    const l = addShip(g, 'lancer', me, x + 120, y + 60, 0.3); l.stance = 3;
    for (const t of ['hammer', 'spear', 'needle']) { const v = addShip(g, t, 1 - me, x + 60 + Math.random() * 120, y - 140 + Math.random() * 60, 1); kill(g, v, null, me); }
    const tk = g.ships.filter(u => u.owner === me && u.def.cargo); setSel(tk);
    R.center(x + 60, y - 30); R.zoomAt(500, 300, 1.4); UI.speed = 1;
  });
  await p.waitForTimeout(1500); await p.evaluate(() => { UI.speed = 0; }); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'mech-1.png') });
  await p.evaluate(() => { const g = UI.g, l = g.ships.find(u => u.owner === UI.me && u.stance === 3); setSel([l]); });
  await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, 'mech-2.png') });
  console.log(errs.join('\n') || 'keine Fehler'); await b.close();
})();
