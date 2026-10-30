/* Fassung 22 – Spielhilfen im Browser (Handy hochkant 412×860 mit Fingerereignissen, dazu Querformat 1280×720 für Bilder):
   1. Warteschlange ×5: Doppeltippen reiht 5 ein, Tippen auf die Zahl nimmt eines heraus, Rechtsklick ebenso, Umschalt-Klick 5
   2. Sammeln bei Gruppe: Einstellung, aktive Gruppe, neues Kampfschiff tritt bei und fliegt hin
   3. Pause mit Befehlen: Knopf, Banner, Takt steht, Auswahl und Befehle gehen, Befehle im Takt der Pause, Wiederholung gleich
   4. Zeitlupe: Vorgabe aus, eingeschaltet bei Großgefecht im Bild 0,5×, Anzeige, danach zurück; nie im Mehrspieler
   5. Untätig-Hinweise: Frachter, Werft, Bauschiff; Tippen wählt (Werft mit Bauliste), erneutes Tippen geht weiter
   Aufruf: NODE_PATH=tools/node_modules node tools/play22.js build/Rift-Armada-22.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-22.html');
const OUT = path.resolve(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const errors = [], fails = [];
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const open = async (vp, touch) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: touch ? 2 : 1, hasTouch: !!touch, isMobile: !!touch, locale: 'de-DE' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
    await page.goto('file://' + file);
    await page.evaluate(() => { window.__RA_TEST = 1; });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const sandbox = async page => { await page.evaluate(() => { RA.MENU.faction = 'alliance'; RA.MENU.slots = null; }); await page.click('#mSandbox'); await page.waitForTimeout(1200); };
  const shot = async (page, n) => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const ev = (page, fn, arg) => page.evaluate(fn, arg);

  /* ================= Hochkant, Finger ================= */
  let { ctx, page } = await open({ width: 412, height: 860 }, true);
  await sandbox(page);
  check('Vorgaben: Pause mit Befehlen an, Zeitlupe aus, Sammeln aus', await ev(page, () => RA.SET.apause === true && RA.SET.slowmo === false && RA.SET.grally === false));
  check('Schnellpause-Knopf sichtbar (allein)', await ev(page, () => !$('bQPause').hidden && !$('bPause').hidden));

  /* ---- 1. Warteschlange ×5 ---- */
  await ev(page, () => { const g = RA.UI.g, y = g.bldgs.find(b => b.owner === RA.UI.me && b.role === 'yard' && b.done); RA.UI.yardId = y.id; selBldg(y); R.center(y.x, y.y); hudBuild(true); });
  const itemBox = async k => { for (let i = 0; i < 10; i++) { const el = await page.$('#items .item[data-k="item:' + k + '"]'); const b = el ? await el.boundingBox().catch(() => null) : null; if (b) return b; await page.waitForTimeout(30); } console.log('kein Eintrag', k, await page.evaluate(() => ({ selB: RA.UI.selB, build: $('build').hidden, items: $('items').children.length }))); return null; };
  const qOf = (k) => ev(page, k => { const y = RA.UI.g.byId.get(RA.UI.yardId); return y.q.filter(q => q.id === k).length; }, k);
  let bb = await itemBox('wren');
  check('Werft zeigt Bauliste', !!bb);
  /* zwei Tipper kurz hintereinander (das Bauteil wird dazwischen neu gezeichnet, steht aber an derselben Stelle) */
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(250);
  check('Doppeltippen reiht 5 ein (' + await qOf('wren') + ')', await qOf('wren') === 5);
  check('Zahl am Schiff zeigt 5', await ev(page, () => { const q = document.querySelector('#items .item[data-k="item:wren"] .q'); return q && q.textContent === '5'; }));
  await shot(page, 'play22-01-queue-portrait');
  let qb = null; for (let i = 0; i < 20 && !qb; i++) { const el = await page.$('#items .item[data-k="item:wren"] .q'); qb = el ? await el.boundingBox().catch(() => null) : null; }
  await page.touchscreen.tap(qb.x + qb.width / 2, qb.y + qb.height / 2);
  await page.waitForTimeout(500);
  check('Tippen auf die Zahl nimmt eines heraus (' + await qOf('wren') + ')', await qOf('wren') === 4);
  bb = await itemBox('wren');
  await page.mouse.click(bb.x + bb.width / 2, bb.y + 8, { button: 'right' });
  await page.waitForTimeout(300);
  check('Rechtsklick nimmt eines heraus (' + await qOf('wren') + ')', await qOf('wren') === 3);
  /* einfaches Tippen: genau eines */
  await ev(page, () => { const y = RA.UI.g.byId.get(RA.UI.yardId); for (let i = y.q.length - 1; i >= 0; i--) RA.issue({ t: 'cancel', b: y.id, i }); hudBuild(true); });
  await page.waitForTimeout(500);
  bb = await itemBox('lancer');
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(600);
  check('einfaches Tippen reiht genau eines ein (' + await qOf('lancer') + ')', await qOf('lancer') === 1);
  bb = await itemBox('wren');
  await page.keyboard.down('Shift'); await page.mouse.click(bb.x + bb.width / 2, bb.y + 8); await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  check('Umschalt-Klick reiht so viele ein, wie Platz ist (' + await qOf('wren') + ' + 1 lancer)', await qOf('wren') === 4);
  /* Kommandopunkte begrenzen */
  await ev(page, () => { const y = RA.UI.g.byId.get(RA.UI.yardId); for (let i = y.q.length - 1; i >= 0; i--) RA.issue({ t: 'cancel', b: y.id, i }); const P = RA.UI.P; P.cpMax = P.cpUse + P.queued + 2; hudBuild(true); });
  await page.waitForTimeout(300);
  check('×5 achtet auf Kommandopunkte (' + await ev(page, () => plMaxTrain(RA.UI.g.byId.get(RA.UI.yardId), SHIPS.wren, 5)) + ')', await ev(page, () => plMaxTrain(RA.UI.g.byId.get(RA.UI.yardId), SHIPS.wren, 5)) === 2);
  await ev(page, () => { recalcCp(RA.UI.g, RA.UI.me); desel(); });

  /* ---- 2. Sammeln bei Gruppe (Einstellung über das Pausenmenü) ---- */
  await page.tap('#bPause'); await page.waitForTimeout(200);
  await page.tap('#pSettings'); await page.waitForTimeout(200);
  check('Einstellungen zeigen die drei neuen Zeilen', await ev(page, () => ['sGrally', 'sApause', 'sSlowmo'].every(id => $(id).children.length === 2)));
  await shot(page, 'play22-02-settings-portrait');
  await page.tap('#sGrally button:first-child'); await page.waitForTimeout(100);
  await page.tap('#sClose'); await page.tap('#pResume'); await page.waitForTimeout(200);
  check('Sammeln bei Gruppe eingeschaltet und gespeichert', await ev(page, () => RA.SET.grally === true && JSON.parse(localStorage.getItem('ra.prefs')).set.grally === true));
  await ev(page, () => { const g = RA.UI.g, y = g.byId.get(RA.UI.yardId); const a = addShip(g, 'lancer', RA.UI.me, y.x + 420, y.y - 160, 0), b = addShip(g, 'lancer', RA.UI.me, y.x + 470, y.y - 160, 0); setSel([a, b]); });
  /* Gruppe 2 speichern (lange drücken) */
  const g2 = await (await page.$('.grp[data-g="2"]')).boundingBox();
  await page.evaluate(() => { const e = document.querySelector('.grp[data-g="2"]'); const o = { pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true, button: 0 }; e.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => e.dispatchEvent(new PointerEvent('pointerup', o)), 600); });
  await page.waitForTimeout(900);
  check('Gruppe 2 gespeichert und aktiv (Befehl grally)', await ev(page, () => RA.UI.grpAct === 2 && RA.UI.P.grally === 2 && document.querySelector('.grp[data-g="2"]').classList.contains('act')));
  await page.touchscreen.tap(g2.x + g2.width / 2, g2.y + g2.height / 2); await page.waitForTimeout(150);
  check('Tippen auf Gruppe 2 wählt sie', await ev(page, () => RA.UI.sel.size === 2));
  await ev(page, () => { RA.issue({ t: 'train', b: RA.UI.yardId, id: 'wren' }); RA.UI.g.ev.length = 0; });
  const born = await ev(page, () => { const g = RA.UI.g; for (let i = 0; i < 30 * 60; i++) { stepGame(g); for (const e of g.ev) if (e.t === 'ready' && e.owner === RA.UI.me) { const u = g.byId.get(e.id); g.ev.length = 0; return { grp: u.grp, o: u.o.t, type: u.type }; } g.ev.length = 0; } return null; });
  check('neues Kampfschiff tritt Gruppe 2 bei und fliegt hin (' + JSON.stringify(born) + ')', born && born.grp === 2 && born.o === 'amove');
  await ev(page, () => hudGroups());
  await shot(page, 'play22-03-group-portrait');

  /* ---- 3. Pause mit Befehlen (frische Partie, nur echte Befehle, damit die Wiederholung passt) ---- */
  await ev(page, () => beginGame(RA.UI.opts, 'sandbox'));
  await page.waitForTimeout(1500);
  await page.tap('#bQPause'); await page.waitForTimeout(200);
  const t0 = await ev(page, () => RA.UI.g.tick);
  check('Schnellpause: aktiv, Banner sichtbar, kein Vollbild-Menü', await ev(page, () => RA.UI.apause === true && !$('apBanner').hidden && $('pause').hidden && $('bQPause').classList.contains('on')));
  await page.waitForTimeout(700);
  check('Simulation steht (Takt ' + t0 + ')', await ev(page, () => RA.UI.g.tick) === t0);
  await ev(page, () => { const g = RA.UI.g, me = RA.UI.me, u = g.ships.find(x => !x.dead && x.owner === me && x.def.build); R.cam.z = 1; R.center(u.x, u.y); });
  await page.waitForTimeout(200);
  const sp = await ev(page, () => { const g = RA.UI.g, me = RA.UI.me, u = g.ships.find(x => !x.dead && x.owner === me && x.def.build); const s = R.w2s(u.x, u.y); return { x: s.x, y: s.y, id: u.id }; });
  await page.touchscreen.tap(sp.x, sp.y); await page.waitForTimeout(450);
  check('in der Pause: Tippen wählt ein Schiff', await ev(page, id => RA.UI.sel.has(id), sp.id));
  await page.touchscreen.tap(sp.x + 110, sp.y - 90); await page.waitForTimeout(450);
  const lg = await ev(page, id => { const g = RA.UI.g, L0 = g.log; return { o: g.byId.get(id).o.t, tick: g.tick, lastT: L0[L0.length - 2], last: L0[L0.length - 1].t }; }, sp.id);
  check('in der Pause: Befehl angenommen und im Takt der Pause verbucht (' + JSON.stringify(lg) + ')', lg.o === 'move' && lg.tick === t0 && lg.lastT === t0 && lg.last === 'move');
  /* Werft in der Pause: zwei Schiffe einreihen */
  await ev(page, () => { const g = RA.UI.g, y = g.bldgs.find(b => b.owner === RA.UI.me && b.role === 'yard' && b.done); selBldg(y); hudBuild(true); });
  bb = await itemBox('lancer');
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(500);
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(500);
  check('Takt steht weiter (' + await ev(page, () => RA.UI.g.tick) + ')', await ev(page, () => RA.UI.g.tick) === t0);
  await ev(page, () => desel());
  await shot(page, 'play22-04-apause-portrait');
  /* Wiederholung: dieselben Befehle im selben Takt ergeben denselben Zustand */
  const rp = await ev(page, () => { const g = RA.UI.g; RA.step(600); const h = stateHash(g), T = g.tick; const r = rpCreate(g.opts, JSON.parse(JSON.stringify(g.log))); while (r.tick < T) { rpStep(r); r.ev.length = 0; } return { h, hr: stateHash(r), T, n: g.log.length / 2 }; });
  check('Wiederholung gleich nach Befehlen in der Pause (' + rp.n + ' Befehle, Takt ' + rp.T + ')', rp.h === rp.hr);
  await page.tap('#apBanner'); await page.waitForTimeout(500);
  check('Banner antippen setzt fort, Takt läuft', await ev(page, t => !RA.UI.apause && $('apBanner').hidden && RA.UI.g.tick > t, rp.T));
  /* Menüpause bleibt eigenständig */
  await page.tap('#bPause'); await page.waitForTimeout(200);
  check('Pausenmenü bleibt eigener Knopf', await ev(page, () => RA.UI.paused && !$('pause').hidden && !RA.UI.apause));
  await page.tap('#pResume'); await page.waitForTimeout(200);
  /* Taste Q */
  await page.keyboard.press('q'); await page.waitForTimeout(100);
  const kq = await ev(page, () => RA.UI.apause);
  await page.keyboard.press('q'); await page.waitForTimeout(100);
  check('Taste Q schaltet die Pause mit Befehlen', kq === true && await ev(page, () => !RA.UI.apause));
  /* Einstellung aus: Knopf weg */
  await ev(page, () => { RA.SET.apause = false; plQpUpdate(); });
  check('Einstellung aus: Schnellpause verschwindet', await ev(page, () => $('bQPause').hidden));
  await ev(page, () => { RA.SET.apause = true; plQpUpdate(); });

  /* ---- 5. Untätig-Hinweise (in der Pause mit Befehlen: der Spieler hält an und sieht nach, wer nichts tut) ---- */
  await page.tap('#bQPause');
  await ev(page, () => { const g = RA.UI.g, me = RA.UI.me; const hs = g.ships.filter(u => !u.dead && u.owner === me && u.def.cargo); RA.issue({ t: 'stop', u: hs.map(u => u.id) }); RA.UI.nHaul = hs.length; const bl = g.ships.filter(u => !u.dead && u.owner === me && u.def.build); RA.issue({ t: 'stop', u: bl.map(u => u.id) }); const y = g.bldgs.find(b => b.owner === me && b.role === 'yard'); for (let i = y.q.length - 1; i >= 0; i--) RA.issue({ t: 'cancel', b: y.id, i }); desel(); });
  await page.waitForTimeout(2600);
  const idle = await ev(page, () => ({ vis: !$('idle').hidden, txt: $('idle').textContent, n: document.querySelectorAll('#idle .idC').length }));
  check('Untätig-Hinweise sichtbar: ' + idle.txt, idle.vis && /Untätig/.test(idle.txt) && new RegExp(await ev(page, () => RA.UI.nHaul) + ' Frachter').test(idle.txt) && /1 Werft/.test(idle.txt) && /Bauschiff/.test(idle.txt));
  await shot(page, 'play22-05-idle-portrait');
  await page.tap('#idle .idC[data-k="yard"]'); await page.waitForTimeout(200);
  check('Tippen auf Werft wählt sie und öffnet die Bauliste', await ev(page, () => { const b = RA.UI.g.byId.get(RA.UI.selB); return b && b.role === 'yard' && !$('build').hidden && document.querySelectorAll('#items .item').length > 2; }));
  await ev(page, () => { R.cam.x += 900; R.clampCam(); });
  await page.tap('#idle .idC[data-k="yard"]'); await page.waitForTimeout(200);
  check('erneutes Tippen: Kamera auf der Werft', await ev(page, () => { const b = RA.UI.g.byId.get(RA.UI.selB); const c = hpCenter(); return b && Math.hypot(c.x - b.x, c.y - b.y) < 60; }));
  await page.tap('#idle .idC[data-k="cargo"]'); await page.waitForTimeout(200);
  const s1 = await ev(page, () => [...RA.UI.sel]);
  await page.tap('#idle .idC[data-k="cargo"]'); await page.waitForTimeout(200);
  const s2 = await ev(page, () => [...RA.UI.sel]);
  await page.tap('#idle .idC[data-k="cargo"]'); await page.waitForTimeout(200);
  const s3 = await ev(page, () => [...RA.UI.sel]);
  check('Frachter: erst alle, dann einzeln der Reihe nach (' + s1.length + ', ' + s2 + ', ' + s3 + ')', s1.length >= 2 && s2.length === 1 && s3.length === 1 && s2[0] !== s3[0]);
  await ev(page, () => { RA.setLang('en'); RA.langRefresh(); });
  await page.waitForTimeout(300);
  const en = await ev(page, () => $('idle').textContent);
  check('englisch: ' + en, /Idle:/.test(en) && /\d freighters/.test(en) && /1 shipyard/.test(en));
  await ev(page, () => { RA.setLang('de'); RA.langRefresh(); });
  await page.tap('#apBanner');
  await page.waitForTimeout(1500);
  await ev(page, () => { const g = RA.UI.g, me = RA.UI.me; for (const u of g.ships) if (!u.dead && u.owner === me && u.def.build) u.dead = true; const y = g.bldgs.find(b => b.owner === me && b.role === 'yard'); RA.issue({ t: 'train', b: y.id, id: 'wren' }); });
  await page.waitForTimeout(1300);
  check('nichts untätig: Hinweise verborgen', await ev(page, () => $('idle').hidden));
  await ctx.close();

  /* ================= Querformat: Zeitlupe und Bilder ================= */
  ({ ctx, page } = await open({ width: 1280, height: 720 }, false));
  await sandbox(page);
  check('Zeitlupe aus (Vorgabe): Großgefecht ohne Zeitlupe', true);
  const battle = () => ev(page, () => {
    const g = RA.UI.g, me = RA.UI.me, foe = g.players.find(p => p.id !== me && !p.neutral).id, cx = g.map.w / 2 - 150, cy = g.map.h / 2 + 600;
    const tough = u => { u.hull = u.hullMax = 1e6; return u; };
    for (let i = 0; i < 9; i++) { tough(addShip(g, 'lancer', me, cx - 140 + (i % 3) * 40, cy - 60 + ((i / 3) | 0) * 50, 0)); tough(addShip(g, 'lancer', foe, cx + 140 + (i % 3) * 40, cy - 60 + ((i / 3) | 0) * 50, Math.PI)); }
    R.cam.z = 1.1; R.center(cx, cy); RA.UI.battle = { cx, cy, foe };
  });
  await battle();
  await page.waitForTimeout(3500);
  check('Zeitlupe aus: Tempo bleibt 1 (' + (await ev(page, () => RA.UI.slowmo || 1)).toFixed(2) + ')', await ev(page, () => (RA.UI.slowmo || 1) > 0.99 && $('slowTag').hidden));
  await ev(page, () => { RA.SET.slowmo = true; });
  let sm = 1;
  for (let i = 0; i < 20 && sm > 0.55; i++) { await page.waitForTimeout(300); sm = await ev(page, () => RA.UI.slowmo || 1); }
  const nf = await ev(page, () => plFighters());
  check('Zeitlupe an: Großgefecht im Bild → ' + sm.toFixed(2) + '× (' + nf + ' kämpfen)', sm < 0.6 && sm >= 0.49);
  check('Anzeige »Zeitlupe« sichtbar', await ev(page, () => !$('slowTag').hidden));
  await page.click('#bQPause'); await page.waitForTimeout(150);
  await shot(page, 'play22-06-slowmo-apause-landscape');
  await page.click('#bQPause');
  /* Gefecht vorbei */
  await ev(page, () => { const g = RA.UI.g, B = RA.UI.battle; for (const u of g.ships) if (!u.dead && u.owner === B.foe && Math.hypot(u.x - B.cx, u.y - B.cy) < 700) { u.dead = true; g.deadFlag = true; } });
  sm = 0;
  for (let i = 0; i < 30 && sm < 0.99; i++) { await page.waitForTimeout(300); sm = await ev(page, () => RA.UI.slowmo || 1); }
  check('nach dem Gefecht wieder 1× (' + sm.toFixed(2) + ')', sm >= 0.99 && await ev(page, () => $('slowTag').hidden));
  check('im Mehrspieler nie: Zeitlupe und Pause mit Befehlen gesperrt', await ev(page, () => { const k = RA.UI.kind; RA.UI.kind = 'mp'; const r = !plSlowOk() && !plApOk(); RA.UI.kind = k; return r; }));
  /* Bilder: Werft mit Warteschlange, Untätig-Hinweise */
  await ev(page, () => { const g = RA.UI.g, me = RA.UI.me, y = g.bldgs.find(b => b.owner === me && b.role === 'yard'); for (let i = 0; i < 3; i++) RA.issue({ t: 'train', b: y.id, id: 'wren' }); RA.issue({ t: 'train', b: y.id, id: 'lancer' }); const hs = g.ships.filter(u => !u.dead && u.owner === me && u.def.cargo); RA.issue({ t: 'stop', u: [hs[0].id] }); selBldg(y); R.center(y.x, y.y); hudBuild(true); });
  await page.waitForTimeout(1300);
  await shot(page, 'play22-07-queue-idle-landscape');
  await page.click('#bPause'); await page.click('#pSettings'); await page.waitForTimeout(200);
  await shot(page, 'play22-08-settings-landscape');
  await ctx.close();

  await browser.close();
  if (errors.length) { console.log(errors.slice(0, 10).join('\n')); }
  check('keine Fehler auf der Seite (' + errors.length + ')', !errors.length);
  console.log(fails.length ? fails.length + ' FAIL' : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
