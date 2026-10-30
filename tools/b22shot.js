/* Bildprüfung Fassung 22 (Stationen Teil 1): Schildwall mit Feld unter Beschuss, Turmzweige Flak/Schwer/Störsender,
   Frühwarnstation, Reparaturdock – je Fraktion in 2D und 3D. node tools/b22shot.js build/Rift-Armada-22.html [Fraktionen] */
const { chromium } = require('playwright');
const F = process.argv[2] || 'build/rift-armada.html', FACS = (process.argv[3] || 'alliance,mars,legion,nexus,brood').split(',');
(async () => {
  let fail = 0;
  require('fs').mkdirSync('tools/shots', { recursive: true });
  for (const gfx of ['2d', '3d']) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { const d = JSON.parse(localStorage.getItem('ra.prefs') || '{}'); d.set = Object.assign(d.set || {}, { gfx, lang: 'de' }); localStorage.setItem('ra.prefs', JSON.stringify(d)); } catch (e) {} }, gfx);
    await p.goto('file://' + require('path').resolve(F), { timeout: 180000 }); await p.waitForTimeout(1500);
    for (const f of FACS) {
      await p.evaluate(f => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: f, human: true, team: 0 }, { faction: f === 'mars' ? 'alliance' : 'mars', ai: 0, team: 1 }] }, 'skirmish'), f);
      await p.waitForTimeout(1200);
      const info = await p.evaluate(() => {
        const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const b of g.bldgs.slice()) removeBldg(g, b);
        for (const q of g.players) q.nob = true;
        const lv = (b, n, sp) => { b.lv = n; if (sp) b.spec = sp; const l = lvOf(b); b.hull = b.hullMax = l.hull; b.shieldMax = l.shield; b.shield = l.shield; b.wcd = l.wpn.map(() => 0); return b; };
        addBldg(g, 'reactor', 0, 1300, 1250, true); addBldg(g, 'reactor', 0, 1300, 1380, true); addBldg(g, 'reactor', 0, 1300, 1510, true);
        const t1 = lv(addBldg(g, 'turret', 0, 1600, 1350, true), 2, 'flak'), t2 = lv(addBldg(g, 'turret', 0, 1600, 1750, true), 3, 'heavy');
        lv(addBldg(g, 'turret', 0, 1720, 1660, true), 2, 'jam'); addBldg(g, 'turret', 0, 1450, 1880, true);
        const w = addBldg(g, 'wall', 0, 1600, 1550, true); w.link = t1.id; w.fhpMax = lvOf(w).field; w.fhp = w.fhpMax * 0.7; w.fdown = 0;
        const w2 = addBldg(g, 'wall', 0, 1600, 2050, true); w2.link = t2.id; w2.fhpMax = lvOf(w2).field; w2.fhp = w2.fhpMax; w2.fdown = 0;
        lv(addBldg(g, 'radar', 0, 1330, 1720, true), 2); addBldg(g, 'dock', 0, 1320, 1950, true);
        recalcPower(g, 0); g.wallDirty = 1;
        const hurt = addShip(g, BUILDER[g.players[0].faction] ? Object.values(SHIPS).find(d => d.f === g.players[0].faction && d.role === 'war' && d.cls === 'm' && !d.hidden).id : 'lancer', 0, 1300, 2010, 0); hurt.hull = hurt.hullMax * 0.4; hurt.stance = 2;
        for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
        g.reveals.push({ x: 1700, y: 1650, r: 900, owner: 0, until: 1e9 });
        const foe = g.players[1].faction, list = Object.values(SHIPS).filter(d => d.f === foe && d.role === 'war' && !d.hidden && !d.art && d.cls === 's' && d.wpn.length);
        const ids = []; for (let i = 0; i < 5; i++) { const u = addShip(g, list[i % list.length].id, 1, 1990, 1450 + i * 90, Math.PI); ids.push(u.id); }
        execCmd(g, { t: 'hold', p: 1, u: ids, on: true });
        for (let k = 0; k < 150; k++) { stepGame(g); UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
        UI.selB = t2.id; R.cam.z = 0.95; R.center(1650, 1700);
        return { up: g.wallL.length, fhp: Math.round(w.fhp), jam: g.ships.filter(u => u.jamT > g.time).length };
      });
      await p.waitForTimeout(600);
      await p.screenshot({ path: 'tools/shots/b22-' + f + '-' + gfx + '.png' });
      const ok = errs.length === 0 && info.up === 2; if (!ok) fail++;
      console.log((ok ? 'OK   ' : 'FAIL ') + gfx + ' ' + f + ': Wälle ' + info.up + ', Feld ' + info.fhp + ', gestört ' + info.jam + (errs.length ? ' Fehler: ' + errs.join(' | ') : ''));
      errs.length = 0;
    }
    await p.close(); await b.close();
  } console.log(fail ? 'FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
