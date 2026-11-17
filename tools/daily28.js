/* Prüfung Fassung 28: Tageseinsatz, Serie, Bestzeit, Erfahrung für Einsätze. Die Uhr wird im Browser verstellt.
   node tools/daily28.js [build/rift-armada.html] → tools/shots/daily28-*.jpg */
const { chromium } = require('playwright'); const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__RA_TEST = true;
    /* verstellbare Uhr: window.__dayOff Tage Versatz */
    const RD = Date; window.__dayOff = +(localStorage.getItem('test.dayOff') || 0);
    function FD(...a) { if (!a.length) return new RD(RD.now() + window.__dayOff * 864e5); return new RD(...a); }
    FD.now = () => RD.now() + window.__dayOff * 864e5; FD.UTC = RD.UTC; FD.parse = RD.parse; FD.prototype = RD.prototype; window.Date = FD;
    if (!localStorage.getItem('ra.prefs')) localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0, gfxUser: true, hints: false }, menu: {} })); localStorage.setItem('ra.seen', '1');
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  const out = [], shot = n => p.screenshot({ path: path.join(__dirname, 'shots', 'daily28-' + n + '.jpg'), type: 'jpeg', quality: 82 });
  const playDaily = async (win) => {
    await p.evaluate(() => { toMenu(); menuPage('home'); document.getElementById('mDaily').click(); }); await p.waitForTimeout(400);
    const br = await p.evaluate(() => ({ open: !document.getElementById('brief').hidden, mut: (document.querySelector('#briefText .dailyMut') || {}).textContent || '', name: document.getElementById('briefName').textContent }));
    await p.evaluate(() => document.getElementById('briefGo').click());
    await p.waitForFunction(() => typeof UI !== 'undefined' && UI.g && UI.g.mis && UI.g.time > 1 && !UI.endShown, null, { timeout: 60000 });
    /* Gegner sind nicht in jedem Einsatz Spieler 1, und in zweien (e2, e5) ist zu Beginn noch keiner da – dann gilt die Prüfung als bestanden */
    const st = await p.evaluate(() => ({ mut: UI.g.mis.mut, sd: UI.g.opts.sdaily, id: UI.g.mis.id, own: UI.g.ships.filter(u => u.owner === UI.g.human && !u.convoy).length, foe: (() => { const g = UI.g, e = g.ships.filter(u => !u.dead && g.tm[u.owner] !== g.tm[g.human]); return e.every(u => u.mt) ? 1 : 0; })() }));
    if (win) { await p.evaluate(() => { misWin(UI.g); UI.speed = 4; }); await p.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 30000 }); await p.waitForTimeout(300); }
    return { br, st };
  };
  await shot('1-menue');
  const h0 = await p.evaluate(() => ({ txt: document.getElementById('mDaily').textContent, q: sortieDaily(), vis: document.getElementById('mDaily').getBoundingClientRect().height > 20 }));
  out.push(['Karte im Hauptmenü: Tageseinsatz, offen', h0.vis && /Tageseinsatz/.test(h0.txt) && /noch/.test(h0.txt) && !/Serie/.test(h0.txt)]);
  const r1 = await playDaily(true); await shot('2-ende');
  out.push(['Besprechung nennt die Erschwernis', r1.br.open && /Tageseinsatz/.test(r1.br.mut)]);
  out.push(['Partie trägt Erschwernis und Tag', r1.st.mut === h0.q.mut && r1.st.sd === h0.q.day && r1.st.id === h0.q.id && (h0.q.mut === 'lean' || r1.st.foe === 1)]);
  const e1 = await p.evaluate(() => ({ prog: document.getElementById('endProg').textContent, hid: document.getElementById('endProg').hidden, d: JSON.parse(localStorage.getItem('ra.prog')), bt: JSON.parse(localStorage.getItem('ra.camp')).bt }));
  out.push(['Ende: Tageseinsatz geschafft, Serie 1 Tag, Erfahrung', !e1.hid && /Tageseinsatz geschafft/.test(e1.prog) && /Serie: 1 Tag/.test(e1.prog) && e1.d.xp >= 210 && e1.d.badges.sortie]);
  out.push(['Bestzeit gespeichert', e1.bt[h0.q.id] > 0]);
  await p.evaluate(() => { toMenu(); menuPage('home'); }); await p.waitForTimeout(300); await shot('3-erledigt');
  const h1 = await p.evaluate(() => ({ txt: document.getElementById('mDaily').textContent, done: document.getElementById('mDaily').classList.contains('done') }));
  out.push(['Karte: erledigt mit Sternen und Serie', h1.done && /✓/.test(h1.txt) && /Serie: 1 Tag/.test(h1.txt)]);
  const xpA = e1.d.xp; await playDaily(true);
  const e2 = await p.evaluate(() => JSON.parse(localStorage.getItem('ra.prog')));
  out.push(['zweiter Sieg am selben Tag: keine zweite Tagesprämie, Serie bleibt 1', e2.streak.n === 1 && e2.xp - xpA < 200]);
  /* nächster Tag */
  await p.evaluate(() => { try { toMenu(); } catch (e) {} localStorage.setItem('test.dayOff', '1'); }); await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(2500);
  const h2 = await p.evaluate(() => ({ txt: document.getElementById('mDaily').textContent, q: sortieDaily(), done: document.getElementById('mDaily').classList.contains('done') }));
  out.push(['nächster Tag: anderer Einsatz, offen, Serie steht noch', h2.q.id !== h0.q.id && !h2.done && /Serie: 1 Tag/.test(h2.txt)]);
  await playDaily(true);
  const e3 = await p.evaluate(() => ({ d: JSON.parse(localStorage.getItem('ra.prog')), prog: document.getElementById('endProg').textContent }));
  out.push(['Serie 2 Tage', e3.d.streak.n === 2 && /Serie: 2 Tage/.test(e3.prog)]);
  /* zwei Tage Pause → Serie reißt */
  await p.evaluate(() => { try { toMenu(); } catch (e) {} localStorage.setItem('test.dayOff', '4'); }); await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(2500);
  const h3 = await p.evaluate(() => ({ txt: document.getElementById('mDaily').textContent, n: progStreak() }));
  out.push(['nach Pause: Serie gerissen', h3.n === 0 && !/Serie/.test(h3.txt)]);
  await playDaily(true);
  const e4 = await p.evaluate(() => JSON.parse(localStorage.getItem('ra.prog')));
  out.push(['neue Serie beginnt bei 1, längste bleibt 2', e4.streak.n === 1 && e4.streak.best === 2]);
  /* gewöhnlicher Einsatz gibt Erfahrung, aber keine Tagesprämie; Karte zeigt Bestzeit */
  await p.evaluate(() => { toMenu(); menuPage('sort'); }); await p.waitForTimeout(300); await shot('4-einsaetze');
  const sp = await p.evaluate(() => ({ cards: document.getElementById('sortList').textContent, daily: document.getElementById('sortDaily').textContent }));
  out.push(['Einsatzseite: Tageskarte und Bestzeit auf der Karte', /Tageseinsatz/.test(sp.daily) && /Bestzeit \d+:\d\d/.test(sp.cards)]);
  await p.evaluate(() => { document.getElementById('pgClose'); document.getElementById('mProfile').click(); }); await p.waitForTimeout(300); await shot('5-profil');
  const pf = await p.evaluate(() => ({ s: document.getElementById('pgStreak').textContent, b: document.getElementById('pgBadges').textContent }));
  out.push(['Profil: Serie und neue Abzeichen', /Serie: 1 Tag/.test(pf.s) && /längste Serie: 2/.test(pf.s) && /Im Einsatz/.test(pf.b) && /Drei am Stück/.test(pf.b)]);
  out.push(['keine Seitenfehler', errs.length === 0]);
  let bad = 0; for (const [n, ok] of out) { console.log((ok ? 'OK   ' : 'FAIL ') + n); if (!ok) bad++; }
  if (bad) console.log(JSON.stringify({ h0, r1, e1: { prog: e1.prog, xp: e1.d.xp, st: e1.d.streak }, h1, h2, h3, sp, pf, errs }).slice(0, 2500));
  console.log(bad ? bad + ' FEHLER' : 'ALL OK'); await b.close(); process.exit(bad ? 1 : 0);
})();
