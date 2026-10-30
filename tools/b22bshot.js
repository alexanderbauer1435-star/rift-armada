/* Bildprüfung Fassung 22 – Gebäude Teil 2: Verbindungen (Netz, Raffinerie, Schild), Andocklichter, Ruine, Fundament,
   Reihe in der Bauvorschau, Abreißen über die Taste; 2D und 3D */
const { chromium } = require('playwright');
const F = process.argv[2] || 'build/rift-armada.html';
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
  require('fs').mkdirSync('tools/shots', { recursive: true });
  for (const gfx of ['2d', '3d']) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: gfx === '3d' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(gfx => { try { const d = JSON.parse(localStorage.getItem('ra.prefs') || '{}'); d.set = Object.assign(d.set || {}, { gfx, lang: 'de' }); localStorage.setItem('ra.prefs', JSON.stringify(d)); } catch (e) {} }, gfx);
    await p.goto('file://' + require('path').resolve(F), { timeout: 180000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => beginGame({ map: 'expanse', seed: 4, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish'));
    await p.waitForTimeout(1500);
    /* Szene: Raffinerie III mit Frachtern, Schildgenerator, Turm, Reaktor als Ruine, abgerissener Turm (Fundament) */
    const info = await p.evaluate(() => {
      const g = UI.g, P = g.players[0], s = P.start; P.ice = P.ore = 20000;
      const free = (role, avoid, from, d0) => { const c = from || s; for (let d = d0 || 170; d < 460; d += 25) for (let a = 0; a < 6.28; a += 0.15) { const x = Math.round(c.x + Math.cos(a) * d), y = Math.round(c.y + Math.sin(a) * d); if (!canPlace(g, 0, role, x, y) && !avoid.some(q => Math.hypot(q.x - x, q.y - y) < 130)) return { x, y }; } return null; };
      const ref = g.bldgs.find(b => b.owner === 0 && b.role === 'refinery'); ref.lv = 3; ref.hullMax = ref.hull = lvOf(ref).hull;
      const used = [ref, s];
      const sh = free('shield', used); const S = addBldg(g, 'shield', 0, sh.x, sh.y, true); used.push(S);
      const tu = free('turret', used, S, 120); const T = addBldg(g, 'turret', 0, tu.x, tu.y, true); used.push(T);
      const re = free('reactor', used); const Rc = addBldg(g, 'reactor', 0, re.x, re.y, true); used.push(Rc);
      const t2 = free('turret', used); const T2 = addBldg(g, 'turret', 0, t2.x, t2.y, true); used.push(T2);
      const rl = free('relay', used, null, 380); if (rl) addBldg(g, 'relay', 0, rl.x, rl.y, true);
      recalcPower(g, 0);
      for (let i = 0; i < 4; i++) { const u = addShip(g, 'hauler', 0, ref.x + 260 + i * 30, ref.y + 80 - i * 40, 0); u.cargo = u.def.cargo; u.ckind = 'ice'; u.o = { t: 'return', nid: 0 }; }
      for (let k = 0; k < 150; k++) { stepGame(g); UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
      kill(g, Rc, null, 1);
      const r1 = issue({ t: 'sell', b: T2.id });
      for (let k = 0; k < 20; k++) { stepGame(g); UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
      selBldg(ref); R.cam.z = 0.9; R.center(ref.x, ref.y);
      return { ref: ref.id, docks: ref.docks, max: lvOf(ref).docks, shield: S.id, ruin: g.wrecks.some(w => w.ruin), found: g.found.length, sell: r1, card: $('selCard').textContent };
    });
    ok(info.ruin && info.found === 1 && info.sell == null, gfx + ': Ruine und Fundament liegen');
    ok(/Andockplätze \d\/4/.test(info.card), gfx + ': Karte zeigt ' + (info.card.match(/Andockplätze \d\/4/) || ['?'])[0]);
    await p.waitForTimeout(600);
    await p.screenshot({ path: 'tools/shots/b22b-ref-' + gfx + '.png' });
    /* Schildgenerator gewählt */
    await p.evaluate(id => { const S = UI.g.byId.get(id); selBldg(S); R.center(S.x, S.y); }, info.shield);
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'tools/shots/b22b-shield-' + gfx + '.png' });
    /* Ruine und Fundament nah */
    await p.evaluate(() => { const g = UI.g, w = g.wrecks.find(q => q.ruin), f = g.found[0]; desel(); R.cam.z = 1.4; R.center((w.x + f.x) / 2, (w.y + f.y) / 2); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'tools/shots/b22b-ruin-' + gfx + '.png' });
    /* Reihe: Bauschiff wählen, Turm platzieren, Reihe an, Endpunkt setzen */
    const row = await p.evaluate(() => {
      const g = UI.g, bu = g.ships.find(u => u.owner === 0 && u.def.build), s = g.players[0].start;
      setSel([bu]); startPlace('turret');
      let best = null;
      for (let a = 0; a < 6.28 && !best; a += 0.1) { const x = s.x + Math.cos(a) * 250, y = s.y + Math.sin(a) * 250, x2 = s.x + Math.cos(a) * 250 + Math.cos(a + 1.57) * 300, y2 = s.y + Math.sin(a) * 250 + Math.sin(a + 1.57) * 300; UI.place.row = false; UI.place.x = x; UI.place.y = y; checkPlace(); if (!UI.place.ok) continue; toggleRow(); UI.place.x = x2; UI.place.y = y2; checkPlace(); if (UI.place.n >= 4) best = { x, y, x2, y2 }; else toggleRow(); }
      R.cam.z = 0.8; if (best) R.center((best.x + best.x2) / 2, (best.y + best.y2) / 2);
      return { n: UI.place.n, pts: UI.place.pts.length, btn: [...document.querySelectorAll('#cmds .key small')].map(e => e.textContent).join(','), bu: bu.id };
    });
    ok(row.n >= 4, gfx + ': Reihe mit ' + row.n + ' von ' + row.pts + ' Plätzen, Tasten: ' + row.btn);
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'tools/shots/b22b-row-' + gfx + '.png' });
    const q = await p.evaluate(id => { confirmPlace(); const u = UI.g.byId.get(id); return { bq: u.bq ? u.bq.length : 0, o: u.o.t }; }, row.bu);
    ok(q.o === 'build' && q.bq === row.n - 1, gfx + ': Reihe in der Bauliste (' + q.bq + ' wartend)');
    /* Abreißen über die Taste: zweimal tippen */
    const dm = await p.evaluate(id => {
      const g = UI.g, T = g.bldgs.find(b => b.owner === 0 && b.role === 'shield'); selBldg(T); hudCmds(true);
      const btn = () => [...document.querySelectorAll('#cmds .key')].find(e => e.dataset.k === 'cmd:Abreißen' || e.dataset.k === 'cmd:Sicher?');
      const ice0 = g.players[0].ice, fire = el => { el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })); };
      const b1 = btn(); if (!b1) return { err: 'keine Taste' }; fire(b1); const lab = btn() && btn().dataset.k; fire(btn());
      return { dead: T.dead, back: g.players[0].ice - ice0, lab, toast: $('toasts') ? $('toasts').textContent : '' };
    });
    ok(dm.dead && dm.back > 0 && dm.lab === 'cmd:Sicher?', gfx + ': Abreißen mit zweitem Tippen (+' + dm.back + ' Eis, ' + (dm.err || dm.lab) + ')');
    ok(errs.length === 0, gfx + ': keine Fehler ' + errs.slice(0, 3).join(' | '));
    await p.close(); await b.close();
  }
  console.log(fail ? fail + ' FAILS' : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
