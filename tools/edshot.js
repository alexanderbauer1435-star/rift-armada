/* Karteneditor im Browser: öffnen, Werkzeuge per Touch bedienen, speichern, in der Gefechtswahl finden, Partie starten.
   node tools/edshot.js [build/rift-armada.html] → tools/shots/editor-*.png */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'rift-armada.html'));
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader'] });
  const fails = [], errors = [];
  const check = (name, c) => { console.log((c ? 'OK   ' : 'FAIL ') + name); if (!c) fails.push(name); };
  for (const [tag, vp, lang] of [['land', { width: 800, height: 380 }, 'de-DE'], ['port', { width: 412, height: 860 }, 'en-US']]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: lang });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(tag + ' PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' CONSOLE ' + m.text()); });
    await page.goto('file://' + file);
    await page.evaluate(() => { window.__RA_TEST = 1; });
    await page.waitForTimeout(600);
    if (tag === 'land') await page.screenshot({ path: path.join(OUT, 'editor-home-' + tag + '.png') });
    if (tag === 'port') await page.evaluate(() => { SET.lang = 'en'; setLang('en'); langRefresh(); });
    await page.tap('#mEditor'); await page.waitForTimeout(400);
    check(tag + ': editor opens', await page.evaluate(() => !$('edWin').hidden && UI.paused));
    /* Neue Karte für 4 Spieler aus der Vorlage */
    await page.selectOption('#edNp', '4'); await page.waitForTimeout(100);
    await page.tap('#edMaps'); await page.waitForTimeout(150);
    await page.click('#edPanel .edBtns .key:nth-child(2)'); await page.waitForTimeout(400);
    const cv = await page.$('#edCv'), bb = await cv.boundingBox();
    const w2s = async (x, y) => page.evaluate(([x, y]) => { const v = ED.view, r = $('edCv').getBoundingClientRect(); return { x: r.left + v.ox + x * v.z, y: r.top + v.oy + y * v.z }; }, [x, y]);
    const tool = async id => { await page.tap('#edTools .key[data-t="' + id + '"]'); await page.waitForTimeout(60); };
    const cdp = await ctx.newCDPSession(page);
    const drag = async (a, b, n) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      for (let i = 1; i <= (n || 8); i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / (n || 8), y: a.y + (b.y - a.y) * i / (n || 8), id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120);
    };
    const tapW = async (x, y) => { const p = await w2s(x, y); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(120); };
    const cnt = k => page.evaluate(k => ED.L[k] ? (Array.isArray(ED.L[k]) ? ED.L[k].length : 1) : 0, k);
    /* Gürtel ziehen (Symmetrie: vier Kopien), Felswand, Ionennebel tippen, Festung in der Mitte, Torpaar */
    await tool('bl'); await drag(await w2s(1950, 1650), await w2s(3050, 1650));
    check(tag + ': belt drag places 4 symmetric belts', await cnt('bl') === 4);
    await tool('wl'); await drag(await w2s(700, 700), await w2s(1300, 1300));
    check(tag + ': wall drag places 4 walls', await cnt('wl') === 4);
    await tool('ion'); await tapW(1650, 1650);
    check(tag + ': ion nebula tap', await cnt('ion') === 4);
    await tool('ash'); await drag(await w2s(1950, 3050), await w2s(2100, 3050));
    check(tag + ': ash cloud drag radius', await page.evaluate(() => ED.L.ash.length === 4 && ED.L.ash[0][2] >= 120 && ED.L.ash[0][2] <= 200));
    await tool('del'); await tapW(2500, 2500);
    check(tag + ': erase great site of the template', await cnt('gs') === 0);
    await tool('ft'); await tapW(2500, 2500);
    check(tag + ': fortress placed', await page.evaluate(() => Array.isArray(ED.L.ft)));
    await tool('gt'); await drag(await w2s(1500, 1100), await w2s(3500, 3900));
    check(tag + ': gate pairs (symmetric)', await cnt('gt') >= 2);
    /* Entfernen: die Festung wieder weg, dann rückgängig */
    await tool('del'); await tapW(2500, 2500);
    check(tag + ': erase fortress', await page.evaluate(() => !ED.L.ft));
    await page.tap('#edUndo'); await page.waitForTimeout(150);
    check(tag + ': undo restores fortress', await page.evaluate(() => Array.isArray(ED.L.ft)));
    /* Zwei Finger: Zoom */
    const z0 = await page.evaluate(() => ED.view.z), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 40 - i * 8, y: cy, id: 1 }, { x: cx + 40 + i * 8, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150);
    const z1 = await page.evaluate(() => ED.view.z);
    check(tag + ': pinch zooms (' + z0.toFixed(3) + ' → ' + z1.toFixed(3) + ')', z1 > z0 * 1.4);
    await page.tap('#edFitB'); await page.waitForTimeout(500);
    const stat = await page.evaluate(() => [$('edStat').className, $('edStat').textContent]);
    check(tag + ': validation line (' + stat[1] + ')', stat[0] === 'ok' || stat[0] === 'bad');
    await page.fill('#edName', tag === 'land' ? 'Kreuzweg' : 'Crossroads');
    await page.screenshot({ path: path.join(OUT, 'editor-' + tag + '.png') });
    /* Speichern, Code */
    await page.tap('#edMaps'); await page.waitForTimeout(150);
    await page.click('#edPanel .edBtns .key.arm'); await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, 'editor-panel-' + tag + '.png') });
    const code = await page.evaluate(() => $('edCode').value);
    check(tag + ': saved and code (' + code.length + ' chars)', await page.evaluate(() => edList().length === 1 && edMapIds(4).length === 1) && /^RA1:/.test(code));
    /* Code übernehmen (gleiche Karte) */
    await page.fill('#edImp', code); await page.click('#edImpGo'); await page.waitForTimeout(300);
    check(tag + ': import code', await page.evaluate(() => $('edPanel').hidden && ED.L.bl.length === 4 && ED.id === null));
    await page.tap('#edX'); await page.waitForTimeout(200);
    check(tag + ': editor closes', await page.evaluate(() => $('edWin').hidden && !UI.paused));
    /* Gefecht: Karte in der Liste, Vorschau, Start */
    await page.evaluate(() => { MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }, { f: 'legion', lvl: 2, team: 0 }, { f: 'nexus', lvl: 2, team: 0 }].concat(Array.from({ length: 4 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.mode = 'skirmish'; });
    await page.tap('#mSkirm'); await page.waitForTimeout(300);
    const id = await page.evaluate(() => edMapIds(4)[0]);
    const btn = await page.$$('#mapSeg button'); await btn[btn.length - 1].evaluate(b => b.click()); await page.waitForTimeout(300);
    check(tag + ': custom map selectable in skirmish list', await page.evaluate(id => MENU.map === id && UI.prevMap && UI.prevMap.name === MAPS[id].name, id));
    await page.evaluate(() => $('rowPrev').scrollIntoView());
    await page.screenshot({ path: path.join(OUT, 'editor-skirmish-' + tag + '.png') });
    await page.evaluate(() => $('mStart').click()); await page.waitForTimeout(1500);
    check(tag + ': game starts on custom map', await page.evaluate(() => UI.g && UI.g.opts.custom && UI.g.map.id === 'custom' && UI.g.players.length >= 4 && !!UI.g.map.fort));
    await page.evaluate(() => RA.step(300));
    await page.evaluate(() => saveNow());
    check(tag + ': save carries layout', await page.evaluate(() => { const d = readSave(); return !!(d && d.game.opts.custom && d.game.opts.custom.bl.length === 4); }));
    await ctx.close();
  }
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  console.log(fails.length || errors.length ? 'FAILS ' + (fails.length + errors.length) : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
