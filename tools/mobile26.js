/* Handy-Durchgang Fassung 26: echte Erstöffnung (ohne Testschalter) und die wichtigsten Seiten mit Touch in typischen
   Formaten. Meldet zu kleine Tippflächen (< 40 px), Bedienelemente außerhalb des Bildes und abgeschnittene Texte;
   schreibt Bilder nach tools/shots/mobile26/. node tools/mobile26.js [build/rift-armada.html] [lang] [nur=name,…] */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), LANG = process.argv[3] || 'de', ONLY = (process.argv[4] || '').split(',').filter(Boolean);
const OUT = path.join(__dirname, 'shots', 'mobile26');
const VP = [['quer-klein', 740, 360], ['quer-gross', 915, 412], ['hoch-klein', 360, 740], ['hoch-gross', 412, 915], ['tablet', 1280, 800]].filter(v => !ONLY.length || ONLY.includes(v[0]));
const MIN = 38;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let total = 0; const errs = [];
  for (const [name, w, h] of VP) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(l => { try { if (!localStorage.getItem('ra.prefs')) localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: l, vol: 0, mus: 0, gfxUser: true }, menu: {} })); } catch (e) {} }, LANG);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    const shot = n => p.screenshot({ path: path.join(OUT, name + '-' + n + '.jpg'), type: 'jpeg', quality: 80 });
    const scan = where => p.evaluate(({ where, MIN }) => {
      const bad = [], vw = innerWidth, vh = innerHeight;
      const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || e.hidden || +s.opacity === 0) return false; } return true; };
      const top = el => { const r = el.getBoundingClientRect(), x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return t && (t === el || el.contains(t) || t.contains(el)); };
      const scrolls = el => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/auto|scroll/.test(s.overflowY + s.overflowX)) return true; } return false; };
      document.querySelectorAll('button, .key, .cmd, select, input, [role=button], .tab, .chip').forEach(el => {
        if (!vis(el) || el.disabled) return; const r = el.getBoundingClientRect(), sc = scrolls(el);
        const lab = (el.textContent.trim() || el.title || el.id || el.className).replace(/\s+/g, ' ').slice(0, 40) + (el.id ? ' #' + el.id : '');
        const outside = r.right > vw + 2 || r.left < -2 || r.bottom > vh + 2 || r.top < -2;
        if (outside && !sc) { bad.push(where + ': AUSSERHALB ' + lab + ' (' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ')'); return; }
        if (outside || !top(el)) return;
        /* wirksame Tippfläche: von der Mitte nach außen tasten (unsichtbare Ränder zählen mit) */
        const hit = (dx, dy) => { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; let n = 0; for (let k = 1; k < 40; k++) { const x = cx + dx * k * 2, y = cy + dy * k * 2; if (x < 0 || y < 0 || x >= vw || y >= vh) { n = k; break; } const t = document.elementFromPoint(x, y); if (!(t && (t === el || el.contains(t)))) break; n = k; } return n * 2; };
        const hw = hit(-1, 0) + hit(1, 0), hh = hit(0, -1) + hit(0, 1);
        if (el.tagName === 'INPUT' && el.type === 'range' ? r.height < 20 : Math.min(hw, hh) < MIN && !(el.tagName === 'INPUT' && /checkbox|radio/.test(el.type) && el.closest('label'))) bad.push(where + ': KLEIN ' + lab + ' ' + hw + '×' + hh);
        const s = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 3 && !/auto|scroll/.test(s.overflowX) && el.textContent.trim().length > 2) bad.push(where + ': ABGESCHNITTEN ' + lab);
      });
      return bad;
    }, { where, MIN });
    const res = [];
    await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1200); await shot('01-start');
    await p.waitForFunction(() => { const e = document.getElementById('boot'); return !e || getComputedStyle(e).display === 'none'; }, null, { timeout: 40000 }).catch(() => res.push('Startbild verschwindet nicht'));
    await p.waitForTimeout(800); await shot('02-erststart'); res.push(...await scan('Erststart'));
    /* was auch immer der Erststart zeigt: danach ins Hauptmenü */
    await p.evaluate(() => { try { localStorage.setItem('ra.seen', '1'); document.querySelectorAll('.ovl:not([hidden])').forEach(o => { o.hidden = true; }); menuPage('home'); } catch (e) {} }); await p.waitForTimeout(300);
    await shot('03-menue'); res.push(...await scan('Hauptmenü'));
    await p.evaluate(() => menuPage('setup')); await p.waitForTimeout(400); await shot('04-gefecht'); res.push(...await scan('Gefecht'));
    await p.evaluate(() => menuPage('camp')); await p.waitForTimeout(400); await shot('05-kampagne'); res.push(...await scan('Kampagne'));
    await p.evaluate(() => { menuPage('home'); document.getElementById('mSettings').click(); }); await p.waitForTimeout(400); await shot('06-einstellungen'); res.push(...await scan('Einstellungen'));
    await p.evaluate(() => { try { closeSettings(); } catch (e) {} document.getElementById('mHelp').click(); }); await p.waitForTimeout(400); await shot('07-hilfe'); res.push(...await scan('Hilfe'));
    await p.evaluate(() => { document.querySelectorAll('.ovl:not([hidden])').forEach(o => { o.hidden = true; }); document.getElementById('mFeedback').click(); }); await p.waitForTimeout(300); await shot('08-rueckmeldung'); res.push(...await scan('Rückmeldung'));
    await p.evaluate(() => { document.getElementById('fbWin').hidden = true; window.__RA_TEST = 1; MENU.faction = 'alliance'; MENU.slots = null; document.getElementById('mSandbox').click(); }); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('#hintCard').forEach(o => { o.hidden = true; }); }); await shot('09-spiel'); res.push(...await scan('Spiel'));
    await p.evaluate(() => { const g = UI.g; const us = g.ships.filter(s => s.owner === UI.me && !s.dead && !s.def.cargo); UI.sel.clear(); for (const u of us) UI.sel.add(u.id); hudSel(); }); await p.waitForTimeout(500); await shot('10-flotte'); res.push(...await scan('Spiel: Flotte'));
    await p.evaluate(() => { const g = UI.g; const y = g.bldgs.find(b => b.owner === UI.me && b.role === 'yard') || g.bldgs.find(b => b.owner === UI.me); if (y) { UI.sel.clear(); UI.selB = y.id; hudSel(); } }); await p.waitForTimeout(500); await shot('11-station'); res.push(...await scan('Spiel: Station'));
    await p.evaluate(() => setPaused(true)); await p.waitForTimeout(300); await shot('12-pause'); res.push(...await scan('Pause'));
    const u = [...new Set(res)]; total += u.length; console.log('== ' + name + ' ' + w + '×' + h + ': ' + u.length); for (const l of u) console.log('  ' + l);
    await ctx.close();
  }
  if (errs.length) console.log('SEITENFEHLER\n' + errs.join('\n'));
  console.log(total || errs.length ? total + ' BEFUNDE' : 'ALL OK'); await b.close();
})();
