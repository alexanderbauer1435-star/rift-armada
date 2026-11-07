/* Prüfung Fassung 25: KI-Partien im Browser mit dem kompletten Spielskript (Bedienung, Grafik usw. geladen) – fängt
   Namenskollisionen und Fehler, die in den reinen Simulationstests (ohne ui.js) unsichtbar bleiben.
   Zwei KI-Spieler je Karte 14 Spielminuten, danach: kein Fehler, mindestens ein Großangriff gestartet.
   node tools/aibrowser25.js build/rift-armada.html */
const { chromium } = require('playwright'); const path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '2d', lang: 'de', vol: 0, mus: 0 }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(1500);
  const res = []; let ok = true;
  for (const [map, f0, f1] of [['crown', 'alliance', 'brood'], ['haven', 'mars', 'nexus'], ['arena', 'legion', 'mars']]) {
    const r = await p.evaluate(([map, f0, f1]) => {
      MENU.map = map; MENU.size = 'normal'; MENU.slots = [{ f: f1, lvl: 3, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = f0; startSkirmish();
      const g = UI.g; UI.speed = 0; g.players[UI.me].ai = aiInit(3); let atk = 0;
      try { for (let i = 0; i < 840 / STEP && !g.over; i++) { stepGame(g); for (const q of g.players) if (q.ai && q.ai.atk) atk |= 1 << q.id; } } catch (e) { return { err: (e.stack || e.message).split('\n').slice(0, 3).join(' | ') }; }
      return { atk, t: Math.round(g.time), over: !!g.over };
    }, [map, f0, f1]);
    const good = !r.err && r.atk; ok = ok && good;
    res.push(`${map} (${f0}–${f1}): ` + (r.err ? 'Fehler ' + r.err : `${r.t} s, Angriffe ${r.atk ? 'ja' : 'nein'}`) + (good ? ' ✓' : ' ✗'));
  }
  ok = ok && !errs.length;
  console.log((ok ? 'OK   ' : 'FAIL ') + 'KI im Browser: ' + res.join(' · ') + (errs.length ? ' Fehler: ' + errs.slice(0, 3).join(' / ') : ''));
  console.log(ok ? 'ALL OK' : '1 FEHLER'); await b.close(); process.exit(ok ? 0 : 1);
})();
