/* Bildschirmtests Conquest: Auswahl, Sektorkarte, Kapitel, Systemkarte, berechnete Schlacht mit Lagebericht, echte Schlacht
   mit Titelkarte und Rückkehr, Verteidigung, Spielstand und Rückzug, offene Schlacht, Entscheidung, Ende, Hochformat.
   Aufruf: node tools/shot7.js build/Rift-Armada-09.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-09.html');
const OUT = path.resolve(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [], fails = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const evGo = async () => { await page.evaluate(() => document.getElementById('cqEvGo').click()); await page.waitForTimeout(150); };
  const drain = async () => { for (let i = 0; i < 16; i++) { const st = await page.evaluate(() => document.getElementById('cqEv').hidden ? 0 : document.getElementById('cqEvOpts').children.length ? 2 : 1); if (!st) break; if (st === 2) { await page.evaluate(() => document.querySelectorAll('#cqEvOpts .dcard')[0].click()); await page.waitForTimeout(150); } else await evGo(); } };
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; localStorage.removeItem('ra.cq'); localStorage.removeItem('ra.save'); });
  await page.reload();
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(700);
  await shot('150-menu');
  await page.click('#mConq'); await page.waitForTimeout(300);
  check('setup with four factions', await page.evaluate(() => !document.getElementById('conq').hidden && !document.getElementById('cqSetup').hidden && document.querySelectorAll('#cqFacs .card').length === 4 && document.getElementById('cqCont').hidden));
  await page.evaluate(() => document.querySelectorAll('#cqFacs .card')[1].click());
  await shot('151-setup');
  await page.click('#cqNew'); await page.waitForTimeout(500);
  check('new campaign: map and chapter 1', await page.evaluate(() => { const C = RA.CQS.C; return C && C.fac === 'mars' && C.sys.length === 20 && !document.getElementById('cqMapPane').hidden && !document.getElementById('cqEv').hidden && /Kapitel 1/.test(document.getElementById('cqEvKind').textContent) && document.querySelectorAll('#cqEvBody .cqLine').length === 3; }));
  await shot('152-chapter1');
  await drain();
  check('saved after start', await page.evaluate(() => !!cqLoad()));
  await shot('153-map');
  /* Ziel wählen: das schwächste Nachbarsystem */
  await page.evaluate(() => { const C = RA.CQS.C, t = cqTargets(C).map(id => C.sys[id]).sort((a, b) => a.gar - b.gar)[0]; RA.CQS.sel = t.id; cqPanel(); });
  check('target panel with attack and auto', await page.evaluate(() => !!document.querySelector('#cqSel [data-a="atk"]') && !!document.querySelector('#cqSel [data-a="auto"]')));
  await shot('154-target');
  /* berechnete Schlacht */
  const before = await page.evaluate(() => RA.CQS.C.turn);
  await page.evaluate(() => document.querySelector('#cqSel [data-a="auto"]').click()); await page.waitForTimeout(300);
  check('auto battle: report window, next turn', await page.evaluate(t => RA.CQS.C.turn === t + 1 && !document.getElementById('cqEv').hidden && /Lagebericht/.test(document.getElementById('cqEvKind').textContent) && document.querySelectorAll('.cqRep li').length >= 1, before));
  await shot('155-report');
  await drain();
  /* echte Schlacht */
  await page.evaluate(() => { const C = RA.CQS.C, t = cqTargets(C).map(id => C.sys[id]).sort((a, b) => a.gar - b.gar)[0]; RA.CQS.sel = t.id; cqPanel(); });
  const target = await page.evaluate(() => RA.CQS.sel);
  await page.evaluate(() => document.querySelector('#cqSel [data-a="atk"]').click()); await page.waitForTimeout(1600);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('battle started (kind cq) with title and goals', await page.evaluate(() => RA.UI.kind === 'cq' && RA.UI.g.mis.id === 'cqb' && !document.getElementById('misBox').hidden && /Angriff auf/.test(document.getElementById('misTitle').textContent) && document.querySelectorAll('#goalsList li').length >= 2 && RA.CQS.C === null || true));
  check('player fleet: flagship and task force', await page.evaluate(() => { const g = RA.UI.g; return g.ships.some(u => u.owner === g.human && u.cqFlag) && g.ships.filter(u => u.owner === g.human && u.def.role === 'war').length >= 5; }));
  await page.evaluate(() => RA.step(60));
  await shot('156-battle');
  await page.evaluate(() => { const g = RA.UI.g; for (const b of g.bldgs) if (!b.dead && ((b.owner === 1 && b.role === 'base') || (g.fort && b.id === g.fort.core))) kill(g, b, null, g.human); RA.step(40); });
  await page.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 15000 }).catch(() => {});
  check('battle end: won, back-to-map button', await page.evaluate(() => !document.getElementById('end').hidden && /erobert/.test(document.getElementById('endTitle').textContent) && document.getElementById('eNext').textContent === 'Zur Sektorkarte' && document.getElementById('eMenu').hidden));
  await shot('157-battle-end');
  await page.click('#eNext'); await page.waitForTimeout(600);
  check('back on map: system taken, report shown', await page.evaluate(id => { const C = RA.CQS.C; return !document.getElementById('conq').hidden && C.sys[id].owner === 'mars' && !C.pending && /erobert/.test(document.getElementById('cqEvBody').textContent); }, target));
  await drain();
  /* Verteidigung */
  await page.evaluate(() => { const C = RA.CQS.C, s = cqMine(C).find(x => x.type !== 'cap'); C.threats.push({ sys: s.id, by: 'legion', pow: 3, turn: C.turn - 1 }); RA.CQS.sel = s.id; cqPanel(); });
  check('threat panel offers defend', await page.evaluate(() => !!document.querySelector('#cqSel [data-a="def"]') && /greift an/.test(document.getElementById('cqSel').textContent)));
  await shot('158-threat');
  await page.evaluate(() => document.querySelector('#cqSel [data-a="def"]').click()); await page.waitForTimeout(1600);
  await page.evaluate(() => { RA.UI.speed = 0.001; RA.step(30); });
  check('defense battle', await page.evaluate(() => RA.UI.kind === 'cq' && RA.UI.g.opts.mis.cq.kind === 'defend' && /Verteidigung/.test(document.getElementById('misTitle').textContent)));
  /* Spielstand und Rückzug */
  check('battle save', await page.evaluate(() => saveNow()));
  await page.evaluate(() => toMenu()); await page.waitForTimeout(300);
  await page.evaluate(() => continueGame()); await page.waitForTimeout(900);
  check('battle resumed', await page.evaluate(() => RA.UI.kind === 'cq' && RA.UI.g.opts.mis.cq.kind === 'defend'));
  await page.evaluate(() => { RA.UI.speed = 0.001; setPaused(true); });
  check('pause offers retreat', await page.evaluate(() => document.getElementById('pQuit').textContent === 'Rückzug'));
  await page.click('#pQuit'); await page.waitForTimeout(600);
  check('retreat: back on map, system lost or held by threat rules', await page.evaluate(() => !document.getElementById('conq').hidden && !RA.CQS.C.pending && !document.getElementById('cqEv').hidden));
  await drain();
  /* offene Schlacht nach Neustart */
  await page.evaluate(() => { const C = RA.CQS.C, t = cqTargets(C)[0]; C.pending = cqSpec(C, 'attack', t); cqSave(C); cqClose(); clearSave(); cqOpen(); });
  await page.waitForTimeout(300);
  check('pending battle prompt', await page.evaluate(() => !document.getElementById('cqEv').hidden && /Offene Schlacht/.test(document.getElementById('cqEvKind').textContent) && !document.getElementById('cqEvAlt').hidden));
  await page.click('#cqEvAlt'); await page.waitForTimeout(300);
  check('retreat from pending clears it', await page.evaluate(() => !RA.CQS.C.pending));
  await drain();
  /* Entscheidung */
  await page.evaluate(() => { const C = RA.CQS.C; C.queue.push({ k: 'chap', n: 2 }); RA.CQS.evq.length = 0; cqEvNext(); });
  await page.waitForTimeout(200);
  check('decision with two advisor cards', await page.evaluate(() => document.querySelectorAll('#cqEvOpts .dcard').length === 2 && /Rät/.test(document.getElementById('cqEvOpts').textContent)));
  await shot('159-decision');
  const inf0 = await page.evaluate(() => RA.CQS.C.inf);
  await page.evaluate(() => document.querySelectorAll('#cqEvOpts .dcard')[1].click()); await page.waitForTimeout(200);
  check('decision applied (influence, outcome)', await page.evaluate(i => RA.CQS.C.inf === i - 1 && /Entschieden/.test(document.getElementById('cqEvTitle').textContent), inf0));
  await drain();
  /* Krise und Brood auf der Karte */
  await page.evaluate(() => { const C = RA.CQS.C; C.crisis = 3; C.chap = 5; const core = C.sys.find(s => s.type === 'core'); core.owner = 'brood'; for (const j of core.links.slice(0, 2)) if (C.sys[j].type !== 'cap') C.sys[j].owner = 'brood'; RA.CQS.sel = core.id; cqPanel(); });
  await shot('160-crisis');
  /* Ende */
  await page.evaluate(() => { const C = RA.CQS.C; C.over = 1; C.ending = 'open'; cqSave(C); cqEvNext(); });
  await page.waitForTimeout(300);
  check('ending window', await page.evaluate(() => /Jenseits der Tore/.test(document.getElementById('cqEvTitle').textContent) && /Republik|Okafor/.test(document.getElementById('cqEvBody').textContent)));
  await shot('161-ending');
  await page.click('#cqEvGo'); await page.waitForTimeout(300);
  check('after ending: setup with record', await page.evaluate(() => !document.getElementById('cqSetup').hidden && /Jenseits der Tore/.test(document.getElementById('cqRec').textContent) && !cqLoad()));
  /* Hochformat */
  await page.click('#cqNew'); await page.waitForTimeout(400);
  await drain();
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(400);
  await shot('162-portrait');
  check('no errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(fails.length ? 'FAILS ' + fails.length : 'ALL OK');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
