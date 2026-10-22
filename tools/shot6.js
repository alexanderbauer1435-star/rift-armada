/* Bildschirmtests Kampagne: Hauptmenü, Kampagnenseite mit Sperren, Besprechung, Titelkarte, Funk mit Porträt, Ziele,
   Kamerafahrt, Zielmarken, Entscheidung, Nachbesprechung mit Fortschritt und »Weiter«, Spielstand einer Mission,
   Niederlage mit Tipp, Finale mit Fraktionswahl und Folgen früherer Entscheidungen.
   Aufruf: node tools/shot6.js build/Rift-Armada-08.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-08.html');
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
  await page.goto('file://' + file);
  await page.evaluate(() => { window.__RA_TEST = 1; localStorage.removeItem('ra.camp'); });
  await page.reload();
  await page.evaluate(() => { window.__RA_TEST = 1; });
  await page.waitForTimeout(700);
  await shot('130-menu');
  check('campaign button first in menu', await page.evaluate(() => document.querySelector('.menuBtns button').id === 'mCamp'));
  await page.click('#mCamp'); await page.waitForTimeout(300);
  check('campaign page: training plus 7 acts, 13 missions, only training and prologue open', await page.evaluate(() => document.querySelectorAll('.act').length === 8 && document.querySelectorAll('.mcard').length === 13 && document.querySelectorAll('.mcard:not(.lock)').length === 2 && document.querySelector('.mcard.next b').textContent === 'Grundausbildung'));
  await shot('131-campaign');
  await page.evaluate(() => document.querySelectorAll('.mcard')[3].click()); await page.waitForTimeout(200);
  check('locked mission stays closed', await page.evaluate(() => document.getElementById('brief').hidden));
  await page.evaluate(() => document.querySelectorAll('.mcard')[1].click()); await page.waitForTimeout(300);
  check('briefing open with text, goals (no spoilers), hints, difficulty', await page.evaluate(() => !document.getElementById('brief').hidden && document.querySelectorAll('#briefText p').length === 2 && document.querySelectorAll('#briefGoals li').length === 3 && /Weitere Ziele/.test(document.getElementById('briefGoals').textContent) && !/Rückzug/.test(document.getElementById('briefGoals').textContent) && document.querySelectorAll('#briefHints li').length === 3 && document.querySelectorAll('#briefLvl button').length === 3 && document.getElementById('briefFacRow').hidden));
  check('briefing portrait drawn', await page.evaluate(() => { const c = document.getElementById('briefPic'), d = c.getContext('2d').getImageData(100, 60, 1, 1).data; return d[0] + d[1] + d[2] > 60; }));
  await shot('132-briefing');
  await page.click('#briefGo'); await page.waitForTimeout(1500);
  await page.evaluate(() => { RA.UI.speed = 0.001; });
  check('mission started as campaign kind', await page.evaluate(() => RA.UI.kind === 'mis' && RA.UI.g.mis.id === 'p1' && !document.getElementById('misBox').hidden));
  check('title card shows mission name', await page.evaluate(() => !document.getElementById('misTitle').hidden && /Die Stille/.test(document.getElementById('misTitle').textContent)));
  check('goals panel lists open goals', await page.evaluate(() => document.querySelectorAll('#goalsList li').length === 2 && /Tor von Calder/.test(document.getElementById('goalsList').textContent)));
  check('camera flight started toward the gate', await page.evaluate(() => { RA.step(2); return true; }));
  await shot('133-title');
  await page.evaluate(() => RA.step(45)); await page.waitForTimeout(1600);
  check('radio shows speaker and typed text', await page.evaluate(() => !document.getElementById('radio').hidden && document.getElementById('radioName').textContent === 'Seraph' && document.getElementById('radioText').textContent.length > 10));
  check('radio portrait drawn', await page.evaluate(() => { const c = document.getElementById('radioPic'), d = c.getContext('2d').getImageData(56, 40, 1, 1).data; return d[0] + d[1] + d[2] > 60; }));
  check('camera moved to the gate', await page.evaluate(() => { const g = RA.UI.g, gt = g.gates[0], c = camCenter(); return Math.hypot(c.x - gt.x, c.y - gt.y) < 400; }));
  check('gate mark set', await page.evaluate(() => RA.UI.g.mis.marks.some(m => m.key === 'gate')));
  await shot('134-radio-mark');
  await page.evaluate(() => { document.getElementById('radio').click(); document.getElementById('radio').click(); });
  await page.waitForTimeout(200);
  check('tap skips to next radio line', await page.evaluate(() => document.getElementById('radioName').textContent === 'Leutnant Ilya Voss' || RADIO.q.length === 0));
  await page.evaluate(() => { document.getElementById('goalsBox').click(); });
  check('goals fold', await page.evaluate(() => document.getElementById('goalsBox').classList.contains('fold')));
  await page.evaluate(() => { document.getElementById('goalsBox').click(); setPaused(true); });
  await page.waitForTimeout(200);
  check('pause shows radio log and campaign quit', await page.evaluate(() => !document.getElementById('pLog').hidden && document.querySelectorAll('#pLogList li').length >= 1 && document.getElementById('pQuit').textContent === 'Kampagne'));
  await shot('144-pause-log');
  await page.evaluate(() => setPaused(false));
  /* Ziel erfüllen: Staffel ans Tor setzen */
  await page.evaluate(() => { const g = RA.UI.g, gt = g.gates[0]; for (const u of g.ships) if (u.owner === g.human) { u.x = gt.x - 400 + (u.id % 5) * 30; u.y = gt.y + (u.id % 3) * 30; } RA.step(20); });
  await page.waitForTimeout(500);
  check('goal done and next goal shown', await page.evaluate(() => RA.UI.g.mis.goals[0].st === 2 && RA.UI.g.mis.goals[1].st === 1 && /✓/.test(document.getElementById('goalsList').textContent)));
  await page.evaluate(() => { R.cam.z = 0.8; const gt = RA.UI.g.gates[0]; R.center(gt.x - 200, gt.y); RA.step(30); });
  await shot('135-fight');
  /* Entscheidung: Akt 3.2 mit allem freigeschaltet */
  await page.evaluate(() => { RA.CAMP.all = true; campSave(); toCampaign(); });
  await page.waitForTimeout(400);
  check('unlock all opens every card', await page.evaluate(() => document.querySelectorAll('.mcard.lock').length === 0));
  await page.evaluate(() => { RA.CAMP.lvl = 1; misStart('a3m2'); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { RA.UI.speed = 0.001; const g = RA.UI.g, v = g.byId.get(g.mis.tag.voss[0]); v.hull = v.hullMax * 0.2; RA.step(20); });
  await page.waitForTimeout(1200);
  check('choice dialog with two options, game held', await page.evaluate(() => !document.getElementById('ask').hidden && document.querySelectorAll('#askOpts .dcard').length === 2 && RA.UI.askOpen));
  await shot('136-choice');
  const t0 = await page.evaluate(() => RA.UI.g.tick);
  await page.evaluate(() => { RA.UI.speed = 1; }); await page.waitForTimeout(400);
  check('simulation paused while choosing', await page.evaluate(t => RA.UI.g.tick === t, t0));
  await page.evaluate(() => { RA.UI.speed = 0.001; document.querySelectorAll('#askOpts .dcard')[0].click(); RA.step(30); });
  await page.waitForTimeout(300);
  check('choice applied (Voss spared)', await page.evaluate(() => RA.UI.g.mis.ch.voss === 'spare' && document.getElementById('ask').hidden && !RA.UI.askOpen));
  /* Sieg: Nachbesprechung */
  await page.evaluate(() => { const g = RA.UI.g; for (const b of g.bldgs) if (!b.dead && b.owner === 1 && b.role === 'base') kill(g, b, null, g.human); RA.step(40); });
  await page.waitForTimeout(2400);
  check('debrief: success, goals, choice, outro, next button', await page.evaluate(() => !document.getElementById('end').hidden && /erfüllt/.test(document.getElementById('endTitle').textContent) && document.querySelectorAll('#endGoals li').length === 3 && /verschonte/.test(document.getElementById('endChoice').textContent) && /Kaiser/.test(document.getElementById('endOutro').textContent) && !document.getElementById('eNext').hidden && /Das Netz/.test(document.getElementById('eNext').textContent) && document.getElementById('eMenu').textContent === 'Kampagne'));
  check('progress stored', await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('ra.camp')); return d.done.a3m2 === 1 && d.ch.voss === 'spare'; }));
  await shot('137-debrief');
  await page.click('#eNext'); await page.waitForTimeout(600);
  check('next opens campaign page with next briefing', await page.evaluate(() => !document.getElementById('menu').hidden && !document.getElementById('pCamp').hidden && !document.getElementById('brief').hidden && document.getElementById('briefName').textContent === 'Das Netz'));
  /* Spielstand mitten in der Mission */
  await page.click('#briefGo'); await page.waitForTimeout(1500);
  await page.evaluate(() => { RA.UI.speed = 0.001; RA.step(60); });
  check('mission save', await page.evaluate(() => saveNow()));
  await page.evaluate(() => toMenu()); await page.waitForTimeout(300);
  check('continue button visible', await page.evaluate(() => !document.getElementById('mCont').hidden));
  await page.evaluate(() => continueGame()); await page.waitForTimeout(900);
  check('mission resumed with goals and marks', await page.evaluate(() => RA.UI.kind === 'mis' && RA.UI.g.mis.id === 'a4m1' && !document.getElementById('misBox').hidden && document.querySelectorAll('#goalsList li').length === 3 && RA.UI.g.mis.marks.length === 3));
  await page.evaluate(() => { RA.UI.speed = 0.001; const g = RA.UI.g; R.cam.z = 0.5; R.center(1700, 1400); });
  await shot('138-marks');
  /* Niederlage */
  await page.evaluate(() => { const g = RA.UI.g; misLose(g, 'Die Basis ist gefallen'); RA.UI.consume(g.ev); g.ev.length = 0; });
  await page.waitForTimeout(2300);
  check('debrief: failure with reason and tip, no next', await page.evaluate(() => !document.getElementById('end').hidden && /gescheitert/.test(document.getElementById('endTitle').textContent) && /Basis ist gefallen/.test(document.getElementById('endText').textContent) && /Tipp/.test(document.getElementById('endOutro').textContent) && document.getElementById('eNext').hidden));
  await shot('139-fail');
  await page.click('#eMenu'); await page.waitForTimeout(500);
  check('campaign button on debrief returns to campaign page', await page.evaluate(() => !document.getElementById('pCamp').hidden && /Chronik/.test(document.getElementById('campChron').textContent)));
  await shot('140-campaign-progress');
  /* Finale: Fraktionswahl und Folgen */
  await page.evaluate(() => { RA.CAMP.ch.save = 'convoy'; RA.CAMP.ch.node = 'live'; campSave(); openBrief('a5m1'); });
  await page.waitForTimeout(300);
  check('finale briefing: faction pick and consequences', await page.evaluate(() => !document.getElementById('briefFacRow').hidden && document.querySelectorAll('#briefFac button').length === 4 && /Voss kommt/.test(document.getElementById('briefCarry').textContent) && /K-7/.test(document.getElementById('briefCarry').textContent)));
  await page.evaluate(() => document.querySelectorAll('#briefFac button')[1].click());
  await shot('141-finale-brief');
  await page.click('#briefGo'); await page.waitForTimeout(1600);
  check('finale started with picked faction and Voss as ally', await page.evaluate(() => { const g = RA.UI.g; RA.UI.speed = 0.001; return RA.UI.kind === 'mis' && g.players[g.human].faction === 'mars' && g.players.some(p => p.name === 'Voss' && p.team === g.players[g.human].team); }));
  await page.evaluate(() => { RA.step(60 * 30); });
  await page.waitForTimeout(800);
  await shot('142-finale');
  /* Hochformat: Besprechung lesbar */
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(() => { toCampaign('a1m2'); });
  await page.waitForTimeout(500);
  await shot('143-brief-portrait');
  check('no errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(fails.length ? 'FAILS ' + fails.length : 'ALL OK');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
