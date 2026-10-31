/* Textlängen je Sprache: node tools/textfit.js [build/Rift-Armada-22.html] [de,en,fr,es,it,pt,pl]
   Öffnet auf einem kleinen Querformat-Handy (740×360) Hauptmenü, Gefechtsmenü, Kampagne, Einstellungen, Hilfe und das Spiel mit
   gewählter Flotte und Werft und meldet Knöpfe und Beschriftungen, deren Text über den Rand ragt oder abgeschnitten wird. */
const { chromium } = require('playwright'); const path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'rift-armada.html'));
const LANGS = (process.argv[3] || 'de,en,fr,es,it,pt,pl').split(',');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const all = {}; let errs = 0;
  for (const lang of LANGS) {
    const ctx = await b.newContext({ viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(l => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: l, vol: 0, mus: 0 }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, lang);
    const p = await ctx.newPage(); p.on('pageerror', e => { errs++; console.log(lang, 'FEHLER', e.message); });
    await p.goto('file://' + file); await p.waitForTimeout(1000);
    const scan = where => p.evaluate(where => {
      const bad = [];
      const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden) return false; } return true; };
      document.querySelectorAll('button, .lbl, .chip, h2, h3, .tab, label, .seg button, .cmd, .key').forEach(el => {
        if (!vis(el) || !el.textContent.trim()) return;
        const s = getComputedStyle(el);
        const over = el.scrollWidth > el.clientWidth + 3 && s.overflowX !== 'auto' && s.overflowX !== 'scroll';
        const r = el.getBoundingClientRect(), vw = innerWidth;
        const out = r.right > vw + 2 || r.left < -2;
        if (over || out) bad.push(where + ': ' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) + (out ? ' [außerhalb]' : ' [abgeschnitten ' + el.scrollWidth + '>' + el.clientWidth + ']'));
      });
      return bad;
    }, where);
    const res = [];
    res.push(...await scan('Hauptmenü'));
    await p.evaluate(() => menuPage('setup')); await p.waitForTimeout(300); res.push(...await scan('Gefecht'));
    await p.evaluate(() => menuPage('camp')); await p.waitForTimeout(300); res.push(...await scan('Kampagne'));
    await p.evaluate(() => menuPage('home')); await p.evaluate(() => { const b = document.getElementById('mSettings') || document.querySelector('[id*=Settings]'); if (b) b.click(); }); await p.waitForTimeout(300); res.push(...await scan('Einstellungen'));
    await p.evaluate(() => { try { closeSettings(); } catch (e) {} });
    await p.evaluate(() => { window.__RA_TEST = 1; MENU.faction = 'alliance'; MENU.slots = null; }); await p.click('#mSandbox'); await p.waitForTimeout(1500);
    await p.evaluate(() => { const g = UI.g; const us = g.ships.filter(s => s.owner === UI.me && !s.dead && !s.def.cargo); UI.sel.clear(); for (const u of us) UI.sel.add(u.id); hudSel(); });
    await p.waitForTimeout(400); res.push(...await scan('Spiel: Flotte'));
    await p.evaluate(() => { const g = UI.g; const y = g.bldgs.find(b => b.owner === UI.me && b.role === 'yard') || g.bldgs.find(b => b.owner === UI.me); if (y) { UI.sel.clear(); UI.selB = y.id; hudSel(); } });
    await p.waitForTimeout(400); res.push(...await scan('Spiel: Station'));
    await p.evaluate(() => setPaused(true)); await p.waitForTimeout(300); res.push(...await scan('Pause'));
    all[lang] = [...new Set(res)];
    console.log('== ' + lang + ': ' + all[lang].length); for (const r of all[lang]) console.log('   ' + r);
    await ctx.close();
  }
  await b.close();
  console.log(errs ? 'Seitenfehler: ' + errs : 'keine Seitenfehler');
})();
