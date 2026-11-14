/* Prüfung Fassung 27: Einsätze. Menütaste öffnet die Seite mit sechs Karten, Karte öffnet die Besprechung ohne
   Schwierigkeitswahl, Start läuft; ein gewonnener Einsatz schreibt Sterne, die Karte zeigt sie, »Einsätze« führt zurück.
   node tools/sort27.js [build/rift-armada.html] → tools/shots/sort27-*.jpg */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__RA_TEST = true; if (!localStorage.getItem('ra.prefs')) localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  const out = [], shot = n => p.screenshot({ path: path.join(__dirname, 'shots', 'sort27-' + n + '.jpg'), type: 'jpeg', quality: 82 });
  await p.evaluate(() => document.getElementById('mSort').click()); await p.waitForTimeout(400); await shot('1-seite');
  const pg = await p.evaluate(() => ({ vis: !document.getElementById('pSort').hidden, n: document.querySelectorAll('#sortList .scard').length, sum: document.getElementById('sortSum').textContent, fit: [...document.querySelectorAll('#sortList .scard')].every(c => c.scrollWidth <= c.clientWidth + 2) }));
  out.push(['Seite mit sechs Karten, 0 von 18 Sternen', pg.vis && pg.n === 6 && /0 von 18/.test(pg.sum) && pg.fit]);
  await p.evaluate(() => document.querySelectorAll('#sortList .scard')[2].click()); await p.waitForTimeout(400); await shot('2-besprechung');
  const br = await p.evaluate(() => ({ open: !document.getElementById('brief').hidden, lvl: document.getElementById('briefLvl').parentElement.hidden, name: document.getElementById('briefName').textContent, goals: document.querySelectorAll('#briefGoals li').length }));
  out.push(['Besprechung Kopfjagd ohne Schwierigkeitswahl, drei Ziele', br.open && br.lvl && br.name === 'Kopfjagd' && br.goals === 3]);
  await p.evaluate(() => document.getElementById('briefGo').click());
  await p.waitForFunction(() => typeof UI !== 'undefined' && UI.g && UI.g.mis && UI.g.mis.id === 'e3' && UI.g.time > 1, null, { timeout: 60000 }); await p.waitForTimeout(1500); await shot('3-spiel');
  const hud = await p.evaluate(() => ({ goals: document.querySelectorAll('#goalsList li').length, title: document.getElementById('misTitle').textContent, lvl: UI.g.mis.lvl }));
  out.push(['Einsatz läuft auf Normal, Ziele im Bild', hud.goals === 3 && hud.lvl === 2 && /Kopfjagd/.test(hud.title)]);
  /* Sieg herbeiführen: Zielschiff zerstören */
  await p.evaluate(() => { const g = UI.g, o = g.byId.get(g.mis.f.oly); kill(g, o, null, g.human); UI.speed = 4; });
  await p.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 30000 }); await p.waitForTimeout(400); await shot('4-ende');
  const en = await p.evaluate(() => ({ txt: document.getElementById('endText').textContent, menu: document.getElementById('eMenu').textContent, next: document.getElementById('eNext').textContent, nextHidden: document.getElementById('eNext').hidden, st: JSON.parse(localStorage.getItem('ra.camp')).st }));
  out.push(['Ende zeigt drei Sterne und speichert sie', /★★★/.test(en.txt) && en.st.e3 === 3]);
  out.push(['Tasten: Einsätze und Weiter: Überfall', en.menu === 'Einsätze' && !en.nextHidden && /Überfall/.test(en.next)]);
  await p.evaluate(() => document.getElementById('eMenu').click()); await p.waitForTimeout(600); await shot('5-zurueck');
  const bk = await p.evaluate(() => ({ vis: !document.getElementById('pSort').hidden, sum: document.getElementById('sortSum').textContent, full: document.querySelectorAll('#sortList .scard.full').length, camp: [...document.querySelectorAll('#campActs .act')].length }));
  out.push(['zurück auf der Einsatzseite: 3 von 18, Karte voll', bk.vis && /3 von 18/.test(bk.sum) && bk.full === 1]);
  await p.evaluate(() => { menuPage('camp'); }); await p.waitForTimeout(300);
  const cp = await p.evaluate(() => ({ acts: [...document.querySelectorAll('#campActs .act h3')].map(h => h.textContent).join('|') }));
  out.push(['Kampagnenseite zeigt die Einsätze nicht', !/Einsätze/.test(cp.acts)]);
  /* Englisch: Karte und Ziele übersetzt */
  await p.evaluate(() => { setLang('en'); menuPage('sort'); }); await p.waitForTimeout(400);
  const enl = await p.evaluate(() => document.getElementById('sortList').textContent + document.getElementById('sortSum').textContent);
  out.push(['Englisch übersetzt', /Blockade Runner/.test(enl) && /3 of 18 stars/.test(enl) && !/Einsatz|Sterne/.test(enl)]);
  out.push(['keine Seitenfehler', errs.length === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'OK   ' : 'FAIL ') + n); if (!ok) bad++; }
  if (bad) console.log(JSON.stringify({ pg, br, hud, en, bk, cp, errs }).slice(0, 1500));
  console.log(bad ? bad + ' FEHLER' : 'ALL OK'); await b.close(); process.exit(bad ? 1 : 0);
})();
