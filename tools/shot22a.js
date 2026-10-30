/* Bildprüfung Fassung 22: Tasten Begleiten / Rückzug / Rollen, Rangboni auf der Auswahlkarte, Begleiten per Antippen,
   Schadenssymbole über Schiffen (2D und 3D), Einstellung »Schadenssymbole«.
   Aufruf: NODE_PATH=tools/node_modules node tools/shot22a.js build/Rift-Armada-22.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = path.resolve(__dirname, 'shots');
(async () => {
  const fails = [];
  const check = (n, c) => { console.log((c ? 'OK   ' : 'FAIL ') + n); if (!c) fails.push(n); };
  for (const gfx of ['2d', '3d']) {
    /* 2D ohne GL-Schalter (sonst bleibt die 2D-Leinwand leer), 3D mit Software-GL */
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const ctx = await b.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { const d = JSON.parse(localStorage.getItem('ra.prefs') || '{}'); d.set = Object.assign(d.set || {}, { gfx, lang: 'de' }); localStorage.setItem('ra.prefs', JSON.stringify(d)); } catch (e) {} }, gfx);
    await p.goto('file://' + F, { timeout: 120000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'mars', human: true, team: 0 }, { faction: 'alliance', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1200);
    const shot = async n => { await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, n + '-' + gfx + '.png'), timeout: 120000 }); console.log('shot', n + '-' + gfx); };
    await p.evaluate(() => {
      UI.speed = 0.001;
      const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u);
      const cx = 1600, cy = 1600;
      const mk = (t, o, x, y, a) => addShip(g, t, o, cx + x, cy + y, a);
      const v = mk('hammer', 0, -60, 0, 0); v.kills = 9; gainXp(g, v, 0);
      const e1 = mk('spear', 0, -160, -80, 0), e2 = mk('needle', 0, -160, 80, 0); e1.kills = 3; gainXp(g, e1, 0);
      const f1 = mk('lancer', 1, 260, -60, Math.PI), f2 = mk('bulwark', 1, 260, 60, Math.PI);
      /* Schäden an Subsystemen: gelb unter 60 %, rot unter 30 % */
      e1.sub.drive = 0.45; e1.sub.wpn = 0.2; e2.sub.sensor = 0.5; f1.sub.shield = 0.25; f1.sub.drive = 0.55; f2.sub.wpn = 0.4; f2.sub.sensor = 0.15; v.sub.shield = 0.5;
      for (const u of [e1, e2, f1, f2, v]) u.hull = u.hullMax * 0.55;
      for (const u of [f1, f2]) { u.stance = 2; u.o = { t: 'hold' }; u.hold = true; }
      for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
      g.reveals.push({ x: cx, y: cy, r: 900, owner: 0, until: 1e9 });
      R.cam.z = 1.0; R.center(cx + 60, cy + 40);
      setSel([v, e1, e2]); hudSel(); hudCmds(true);
      window.__t = { v: v.id, e: [e1.id, e2.id] };
    });
    await p.evaluate(() => RA.step(2));
    const keys = await p.evaluate(() => [...document.querySelectorAll('#cmds button')].map(b => b.dataset.k || ''));
    check(gfx + ': Tasten Rückzug, Begleiten und Formation in der Leiste', ['cmd:Rückzug', 'cmd:Begleiten', 'cmd:Keil'].every(k => keys.indexOf(k) >= 0));
    check(gfx + ': Schadenssymbole an', await p.evaluate(() => dmgIconsOn() && !!dmgIcons(UI.g.byId.get(window.__t.e[0]))));
    await shot('220-cmds-dmg');
    /* Formation durchschalten bis »Rollen« */
    await p.evaluate(() => { cycleForm(); cycleForm(); hudCmds(true); });
    check(gfx + ': Formation Rollen', await p.evaluate(() => UI.form === 'roles' && !!document.querySelector('#cmds button[data-k="cmd:Rollen"]')));
    /* Rückzug-Schalter */
    await p.evaluate(() => { toggleAutoRet(); hudCmds(true); });
    await p.evaluate(() => RA.step(1));
    check(gfx + ': Rückzug je Schiff an, Taste leuchtet', await p.evaluate(() => selShips().every(u => u.autoRet) && document.querySelector('#cmds button[data-k="cmd:Rückzug"]').classList.contains('on')));
    /* Begleiten: Taste, dann das Flaggschiff antippen */
    await p.evaluate(() => { setSel(window.__t.e.map(id => UI.g.byId.get(id))); hudCmds(true); startEscort(); });
    check(gfx + ': Begleitmodus aktiv', await p.evaluate(() => UI.mode === 'escort'));
    await p.evaluate(() => { const v = UI.g.byId.get(window.__t.v), q = R.w2s(v.x, v.y); tap(q.x, q.y); RA.step(20); });
    check(gfx + ': Begleiter folgen dem Hammer', await p.evaluate(() => window.__t.e.every(id => { const u = UI.g.byId.get(id); return u.o.t === 'escort' && u.o.tid === window.__t.v; })));
    /* Auswahlkarte mit Rangboni */
    await p.evaluate(() => { setSel([UI.g.byId.get(window.__t.v)]); hudSel(); RA.step(1); });
    const rk = await p.evaluate(() => { const el = document.querySelector('#selCard .sub.rank'); return el ? el.textContent : ''; });
    check(gfx + ': Rangboni auf der Auswahlkarte: ' + rk, /★★/.test(rk) && /Nachladen/.test(rk) && /Streuung/.test(rk));
    await p.evaluate(() => { R.cam.z = 1.1; const v = UI.g.byId.get(window.__t.v); R.center(v.x + 40, v.y + 40); });
    await shot('221-rank-escort');
    if (gfx === '2d') {
      /* Einstellung */
      await p.evaluate(() => { document.getElementById('pSettings').click(); });
      await p.waitForTimeout(300);
      check('Einstellung Schadenssymbole vorhanden', await p.evaluate(() => document.querySelectorAll('#sDmg button').length === 2));
      await p.evaluate(() => { document.getElementById('settings').querySelector('.win').scrollTop = 1e4; });
      await shot('222-settings');
      await p.evaluate(() => { document.querySelectorAll('#sDmg button')[1].click(); closeSettings(); });
      check('Schadenssymbole abschaltbar', await p.evaluate(() => !dmgIconsOn()));
      await p.evaluate(() => { document.querySelectorAll('#sDmg button')[0].click(); });
      check('und wieder an', await p.evaluate(() => dmgIconsOn()));
      /* Englisch */
      await p.evaluate(() => { setLang('en'); langRefresh(); setSel([UI.g.byId.get(window.__t.v)]); hudSel(); hudCmds(true); RA.step(1); });
      const en = await p.evaluate(() => document.querySelector('#selCard .sub.rank').textContent + ' | ' + [...document.querySelectorAll('#cmds small')].map(s => s.textContent).join(','));
      check('Englisch: ' + en, /reload/.test(en) && /Escort/.test(en) && /Retreat/.test(en));
      await shot('223-english');
      await p.evaluate(() => { setLang('de'); langRefresh(); });
    }
    check(gfx + ': keine Fehler ' + errs.join(' | '), errs.length === 0);
    await b.close();
  }
  console.log(fails.length ? 'FAILS ' + fails.length : 'ALL OK'); process.exit(fails.length ? 1 : 0);
})();
