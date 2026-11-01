/* Bildprüfung Fassung 23: Feuermodus Lahmlegen (Knopf), manövrierunfähiges Schiff (treibt, Ring, Restzeit), gekapertes
   Schiff auf dem Weg zur Werft, Rollensymbole im Werftmenü – 2D und 3D. node tools/crip23shot.js build/Rift-Armada-22.html */
const { chromium } = require('playwright');
const F = process.argv[2] || 'build/rift-armada.html';
(async () => {
  let fail = 0;
  require('fs').mkdirSync('tools/shots', { recursive: true });
  for (const gfx of ['2d', '3d']) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx, lang: 'de', vol: 0, mus: 0 }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, gfx);
    await p.goto('file://' + require('path').resolve(F), { timeout: 180000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'mars', human: true, team: 0 }, { faction: 'alliance', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u);
      for (const q of g.players) q.nob = true;
      const yard = g.bldgs.find(b => b.owner === 0 && b.role === 'yard') || addBldg(g, 'yard', 0, 900, 1500, true);
      const war = Object.values(SHIPS).find(d => d.f === 'mars' && d.role === 'war' && d.cls === 'm' && !d.marines && !d.art && !d.hidden).id;
      const a = [0, 1, 2].map(i => addShip(g, war, 0, 1500, 1500 + i * 70, 0));
      const t = addShip(g, 'bulwark', 1, 1800, 1560, Math.PI); t.stance = 2;
      const t2 = addShip(g, 'bulwark', 0, 1500, 1800, 0); cripple(g, t2, 1); captureEntity(g, t2, 0, 0);
      const t3 = addShip(g, 'aegis', 1, 1700, 1850, 0); t3.owner = 1; cripple(g, t3, 0); captureEntity(g, t3, 1, 0);
      for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
      g.reveals.push({ x: 1600, y: 1600, r: 1400, owner: 0, until: 1e9 });
      setSel(a); hudCmds(); toggleFireMode();
      return { t: t.id, a: a.map(u => u.id), fm: a.every(u => u.fm === 1) };
    });
    await p.evaluate(i => { issue({ t: 'attack', u: i.a, e: i.t }); R.center(1650, 1650); R.cam.z = 1.1; }, info);
    let st = null;
    for (let k = 0; k < 30 && !(st && st.crip); k++) st = await p.evaluate(id => { const g = UI.g, u = g.byId.get(id); for (let i = 0; i < 100 && !u.crip && !u.dead; i++) { stepGame(g); g.ev.length = 0; } return { crip: !!u.crip, dead: u.dead, hull: Math.round(u.hull / u.hullMax * 100) }; }, info.t);
    await p.evaluate(id => { UI.speed = 1; const u = UI.g.byId.get(id); UI.selB = 0; setSel([u]); }, info.t);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: 'tools/shots/crip23-' + gfx + '.png' });
    const btn = await p.evaluate(() => { setSel(UI.g.ships.filter(u => u.owner === UI.me && !u.dead && armed(u) && !u.limp)); hudCmds(); return [...document.querySelectorAll('#cmds button')].map(b => b.textContent.trim()).join(' | '); });
    /* Werftmenü mit Rollensymbolen */
    await p.evaluate(() => { const y = UI.g.bldgs.find(b => b.owner === UI.me && b.role === 'yard'); UI.sel.clear(); UI.selB = y.id; hudSel(); });
    await p.waitForTimeout(600);
    await p.screenshot({ path: 'tools/shots/roles23-' + gfx + '.png' });
    const roles = await p.evaluate(() => document.querySelectorAll('.item .role').length);
    const ok = info.fm && st && st.crip && !st.dead && /Lahmlegen/.test(btn) && roles > 5 && !errs.length;
    console.log((ok ? 'OK   ' : 'FAIL ') + gfx + ': Feuermodus ' + info.fm + ', Ziel lahm ' + (st && st.crip) + ' (Hülle ' + (st && st.hull) + ' %), Knöpfe: ' + btn.slice(0, 120) + ', Rollensymbole ' + roles + (errs.length ? ', Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
    if (!ok) fail++;
    await b.close();
  }
  console.log(fail ? fail + ' FEHLER' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
