/* Trailer für den Store: nimmt Szenen Bild für Bild auf (Playwright-Uhr, damit 3D auch ohne GPU flüssig wird) und
   schreibt JPEG-Folgen nach tools/trailer/<szene>/. Danach tools/trailer.sh setzt das Video zusammen.
   node tools/trailer.js build/rift-armada.html [szenen] */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = path.join(__dirname, 'trailer'), FPS = 30;
const CAP_CSS = `#cap{position:fixed;left:0;right:0;top:9%;text-align:center;z-index:99;pointer-events:none;font-family:"Barlow Condensed",sans-serif;font-weight:600;color:#fff;letter-spacing:.06em;text-shadow:0 2px 12px #000,0 0 30px rgba(0,0,0,.8)}
#cap b{display:block;font-size:44px;text-transform:uppercase}#cap i{display:block;font-style:normal;font-size:22px;color:#8fe3ff;letter-spacing:.12em;margin-top:6px}`;

async function scene(b, name, gfx, setup, sec, cap, sub, opt) {
  if (ONLY && !ONLY.includes(name)) return;
  const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  await ctx.addInitScript(gfx => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx, lang: 'en', vol: 0, mus: 0, gfxUser: true, slowmo: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, gfx);
  await p.goto('file://' + F, { timeout: 180000 });
  await p.clock.runFor(2500);
  await p.evaluate(setup.toString().startsWith('async') ? `(${setup})()` : `(${setup})()`);
  await p.addStyleTag({ content: CAP_CSS });
  if (cap) await p.evaluate(([c, s]) => { const d = document.createElement('div'); d.id = 'cap'; d.innerHTML = '<b>' + c + '</b>' + (s ? '<i>' + s + '</i>' : ''); document.body.appendChild(d); }, [cap, sub || '']);
  if (opt && opt.hideHud) await p.evaluate(() => { for (const id of ['hud', 'mini', 'top', 'bottom']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } document.querySelectorAll('#toasts, .toast').forEach(e => e.style.display = 'none'); });
  await p.clock.runFor(400);
  const n = Math.round(sec * FPS);
  for (let i = 0; i < n; i++) {
    if (opt && opt.each) await p.evaluate(opt.each, i);
    await p.clock.runFor(1000 / FPS);
    await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  console.log(name + ': ' + n + ' Bilder' + (errs.length ? ' FEHLER ' + errs.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  /* 1. Große Schlacht: Allianz gegen Mars, Kamera fährt langsam mit */
  await scene(b, 'battle', '3d', () => {
    beginGame({ map: 'arena', seed: 7, pace: 'tactical', players: [{ faction: 'alliance', human: true, team: 0 }, { faction: 'mars', ai: 0, team: 1 }] }, 'skirmish');
    const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
    const cx = g.map.w / 2, cy = g.map.h / 2;
    const pick = (f, c) => Object.values(SHIPS).filter(d => d.f === f && d.role === 'war' && d.cls === c && !d.hidden && !d.marines && d.wpn.some(w => w.kind !== 'pd' && !w.art)).map(d => d.id);
    const A = [], M = [];
    const lay = (f, side, arr) => { const m = pick(f, 'm'), s = pick(f, 's'), l = pick(f, 'l'); let k = 0;
      for (let i = 0; i < 6; i++) arr.push(addShip(g, s[i % s.length], side, cx + (side ? 420 : -420) + (i % 2) * 40 * (side ? 1 : -1), cy - 250 + i * 100, side ? Math.PI : 0));
      for (let i = 0; i < 5; i++) arr.push(addShip(g, m[(k++) % m.length], side, cx + (side ? 560 : -560), cy - 220 + i * 110, side ? Math.PI : 0));
      for (let i = 0; i < 2; i++) arr.push(addShip(g, l[i % l.length], side, cx + (side ? 720 : -720), cy - 110 + i * 220, side ? Math.PI : 0)); };
    lay('alliance', 0, A); lay('mars', 1, M);
    for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
    g.reveals.push({ x: cx, y: cy, r: 2200, owner: 0, until: 1e9 });
    execCmd(g, { t: 'amove', p: 0, u: A.map(u => u.id), x: cx + 500, y: cy });
    execCmd(g, { t: 'amove', p: 1, u: M.map(u => u.id), x: cx - 500, y: cy });
    UI.speed = 1; R.cam.z = 0.62; R.center(cx - 120, cy);
  }, 7, 'Command the Armada', 'Real-time fleet battles in full 3D', { hideHud: true, each: i => { R.cam.z = 0.62 + i * 0.0012; R.center(UI.g.map.w / 2 - 120 + i * 0.6, UI.g.map.h / 2); } });

  /* 2. Fünf Fraktionen: Brood gegen Legion und Nexus */
  await scene(b, 'factions', '3d', () => {
    beginGame({ map: 'arena', seed: 9, pace: 'tactical', players: [{ faction: 'legion', human: true, team: 0 }, { faction: 'brood', ai: 0, team: 1 }, { faction: 'nexus', ai: 0, team: 2 }] }, 'skirmish');
    const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
    const cx = g.map.w / 2, cy = g.map.h / 2;
    const ids = f => Object.values(SHIPS).filter(d => d.f === f && d.role === 'war' && (d.cls === 'm' || d.cls === 'l') && !d.hidden && d.wpn.some(w => w.kind !== 'pd' && !w.art)).map(d => d.id);
    const fl = [];
    [['legion', 0, -1, 0], ['brood', 1, 1, -0.6], ['nexus', 2, 1, 0.6]].forEach(([f, o, sx, sy]) => { const t = ids(f), arr = []; for (let i = 0; i < 7; i++) arr.push(addShip(g, t[i % t.length], o, cx + sx * (520 + (i % 3) * 70), cy + sy * 420 + (i - 3) * 85, sx > 0 ? Math.PI : 0)); fl.push(arr); });
    for (const q of g.players) for (let i = 0; i < q.explored.length; i++) q.explored[i] = 1;
    g.reveals.push({ x: cx, y: cy, r: 2200, owner: 0, until: 1e9 });
    fl.forEach((arr, o) => execCmd(g, { t: 'amove', p: o, u: arr.map(u => u.id), x: cx, y: cy }));
    R.cam.z = 0.66; R.center(cx, cy);
  }, 6, 'Five Factions', 'Alliance · Mars · Golden Legion · Nexus · Brood', { hideHud: true, each: i => { R.cam.z = 0.66 + i * 0.0015; } });

  /* 3. Lahmlegen und Entern */
  await scene(b, 'board', '3d', () => {
    beginGame({ map: 'test', seed: 4, pace: 'tactical', players: [{ faction: 'mars', human: true, team: 0 }, { faction: 'alliance', ai: 0, team: 1 }] }, 'skirmish');
    const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true;
    const war = Object.values(SHIPS).find(d => d.f === 'mars' && d.role === 'war' && d.cls === 'm' && !d.marines && !d.art && !d.hidden).id;
    const a = [0, 1, 2].map(i => addShip(g, war, 0, 1450, 1480 + i * 70, 0));
    const t = addShip(g, 'archipelago', 1, 1750, 1550, Math.PI); t.stance = 2;
    const tr = addShip(g, 'dropship', 0, 1350, 1700, 0);
    for (let i = 0; i < g.players[0].explored.length; i++) g.players[0].explored[i] = 1;
    g.reveals.push({ x: 1600, y: 1600, r: 1400, owner: 0, until: 1e9 });
    setSel(a); toggleFireMode(); issue({ t: 'attack', u: a.map(u => u.id), e: t.id });
    /* bis kurz vor dem Ausfall vorspulen, dann filmen */
    for (let i = 0; i < 4000 && !t.crip; i++) { stepGame(g); if (Math.max(t.sub.drive, t.sub.wpn, t.sub.shield) < 0.3) break; g.ev.length = 0; }
    window.__tr = { t: t.id, tr: tr.id }; R.cam.z = 1.05; R.center(1640, 1600); UI.speed = 1;
  }, 9, 'Disable. Board. Capture.', 'Shoot out engines, weapons and shields – then send in the marines', { hideHud: true, each: i => { const g = UI.g, t = g.byId.get(window.__tr.t); if (t && t.crip && !window.__tr.sent) { window.__tr.sent = 1; issue({ t: 'board', u: [window.__tr.tr], e: t.id }); } if (window.__tr.sent) UI.speed = 3; if (t) R.center(t.x - 60, t.y + 20); } });

  /* 4. Basis bauen: Werft mit Rollensymbolen */
  await scene(b, 'base', '3d', () => {
    beginGame({ map: 'shattered', seed: 3, pace: 'tactical', players: [{ faction: 'nexus', human: true, team: 0 }, { faction: 'mars', ai: 2, team: 1 }] }, 'skirmish');
    const g = UI.g, P = g.players[0]; P.ice = 9000; P.ore = 9000;
    for (let i = 0; i < 1800; i++) { stepGame(g); g.ev.length = 0; }
    const y = g.bldgs.find(b => b.owner === 0 && b.role === 'yard') || g.bldgs.find(b => b.owner === 0);
    UI.sel.clear(); UI.selB = y.id; hudSel(); R.cam.z = 0.85; R.center(y.x + 120, y.y + 60);
  }, 5, 'Build Your Base', 'Stations, research, doctrines and superweapons', { each: i => { R.cam.z = 0.85 + i * 0.001; } });
  await b.close();
})();
