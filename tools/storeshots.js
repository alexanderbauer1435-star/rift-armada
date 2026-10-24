/* Store-Bilder (9:16, 1080×1920) in 3D, Deutsch und Englisch: node tools/storeshots.js → store/graphics/shot-<n>-<lang>.png
   1 Menü, 2 Basis, 3 Raumschlacht, 4 Kartenwahl mit Vorschau */
const { chromium } = require('playwright'); const path = require('path');
const file = path.join(__dirname, '..', 'build', 'rift-armada.html'), OUT = path.join(__dirname, '..', 'store', 'graphics');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const lang of ['de', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, locale: lang === 'de' ? 'de-DE' : 'en-US', hasTouch: true, isMobile: true });
    await ctx.addInitScript(l => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: l, vol: 0, mus: 0 }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, lang);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(lang + ': ' + e.message));
    await p.goto('file://' + file); await p.waitForTimeout(1200);
    const shot = async n => { await p.evaluate(() => { try { FX.list.length = 0; document.querySelectorAll('#info,.toast,#toast').forEach(e => { e.hidden = true; e.style.display = 'none'; }); } catch (e) {} }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, `shot-${n}-${lang}.png`) }); console.log(`shot-${n}-${lang}.png`); };
    await shot(1);
    await p.evaluate(() => { menuPage('setup'); MENU.map = 'crown'; setupRender(); const r = document.getElementById('rowPrev'); if (r) r.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(500); await shot(4);
    await p.evaluate(() => { window.__RA_TEST = 1; MENU.map = 'crown'; MENU.size = 'normal'; MENU.slots = [{ f: 'brood', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
    await p.waitForTimeout(3000);
    /* Basis: beide Seiten spielen 7 Minuten als KI (schnell ohne Bild), dann die eigene Basis zeigen */
    await p.evaluate(() => { const g = UI.g, me = UI.me; UI.speed = 0; g.players[me].ai = aiInit(3); for (let i = 0; i < 420 / STEP && !g.over; i++) stepGame(g); g.events.length = 0; const b = g.bldgs.find(x => x.owner === me && x.role === 'base'); let cx = 0, cy = 0, n = 0; for (const o of g.bldgs) if (o.owner === me && !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 700) { cx += o.x; cy += o.y; n++; } R.center(cx / n, cy / n); UI.speed = 1; });
    await p.waitForTimeout(2500); await p.evaluate(() => { UI.speed = 0; }); await p.waitForTimeout(1200); await shot(2);
    /* Schlacht: die Flotten beider Seiten in der Mitte aufeinandertreffen lassen */
    await p.evaluate(() => { const g = UI.g, cx = g.map.w / 2, cy = g.map.h / 2; let k = 0; for (const u of g.ships) { if (u.dead || u.def.role === 'builder' || u.def.role === 'tanker' || u.def.node || !u.def.wpn || !u.def.wpn.length) continue; const s = u.owner === UI.me ? -1 : 1; k++; u.x = cx + s * (90 + (k * 37) % 170); u.y = cy + ((k * 61) % 360) - 180; u.o = { t: 'amove', x: cx - s * 500, y: cy }; u.path = null; } for (let i = 0; i < 3 / STEP; i++) stepGame(g); g.events.length = 0; R.center(cx, cy); UI.speed = 1; });
    await p.waitForTimeout(3500);
    await p.evaluate(() => { UI.speed = 0; }); await p.waitForTimeout(800); await shot(3);
    await ctx.close();
  }
  console.log(errs.length ? 'FEHLER\n' + errs.join('\n') : 'keine Fehler'); await b.close();
})();
