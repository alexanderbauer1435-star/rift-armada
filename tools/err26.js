/* Prüfung Fassung 26: Fehlerprotokoll. Ein Laufzeitfehler wird lokal erfasst (ohne Pfade, gleiche gezählt), der Hinweis
   erscheint einmal, das Rückmeldungsfenster hängt das Protokoll an, nach dem Leeren ist es weg. Versionsname steht im Menü.
   node tools/err26.js build/rift-armada.html */
const { chromium } = require('playwright'); const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 740, height: 360 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  const out = [];
  out.push(['Versionsname im Menü', /Fassung \d+\.\d+\.\d+/.test(await p.evaluate(() => document.getElementById('vers').textContent))]);
  out.push(['Protokoll anfangs leer', (await p.evaluate(() => __raErr.list().length)) === 0]);
  await p.evaluate(() => { for (let i = 0; i < 3; i++) setTimeout(() => { const o = null; o.kaputt(); }, 10 * i); Promise.reject(new Error('Testabweisung')); });
  await p.waitForTimeout(600);
  const l = await p.evaluate(() => __raErr.list());
  out.push(['Fehler erfasst und gezählt', l.length === 2 && l.some(q => q.n === 3 && /kaputt|null/.test(q.m)) && l.some(q => /Testabweisung/.test(q.m))]);
  out.push(['keine Pfade im Protokoll', !/file:\/\/|\/home\//.test(JSON.stringify(l))]);
  out.push(['Hinweis sichtbar (einmal)', (await p.evaluate(() => document.querySelectorAll('#errHint').length)) === 1]);
  await p.evaluate(() => document.getElementById('ehYes').click()); await p.waitForTimeout(200);
  const w = await p.evaluate(() => ({ open: !document.getElementById('fbWin').hidden, note: document.getElementById('fbErr').textContent, txt: fbText(fbCurrent()) }));
  out.push(['Rückmeldung offen mit Protokollhinweis', w.open && /2 Einträge/.test(w.note)]);
  out.push(['Bericht enthält Protokoll und Version', /Fehlerprotokoll:/.test(w.txt) && /3× /.test(w.txt) && /Fassung \d+\.\d+\.\d+/.test(w.txt)]);
  const fit = await p.evaluate(() => { const r = document.querySelector('#fbWin .win').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 || document.querySelector('#fbWin .win').scrollHeight > 0; });
  out.push(['Fenster passt aufs Handy', fit]);
  await p.evaluate(() => { const o = null; setTimeout(() => o.nochmal(), 0); }); await p.waitForTimeout(200);
  out.push(['kein zweiter Hinweis in der Sitzung', (await p.evaluate(() => document.querySelectorAll('#errHint').length)) === 0]);
  await p.evaluate(() => document.getElementById('fbClear').click());
  out.push(['Leeren löscht das Protokoll', (await p.evaluate(() => __raErr.list().length)) === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'OK   ' : 'FAIL ') + n); if (!ok) bad++; }
  if (bad) console.log(JSON.stringify(l), JSON.stringify(w));
  console.log(bad ? bad + ' FEHLER' : 'ALL OK'); await b.close(); process.exit(bad ? 1 : 0);
})();
