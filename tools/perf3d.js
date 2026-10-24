/* Leistungsmessung des 3D-Renderers im echten Spiel (Chromium headless, SwiftShader = Rasterung auf der CPU).
   node tools/perf3d.js [build/rift-armada.html] [--w 1920 --h 1080 --dpr 1] [--tag name] [--qual auto|low] [--secs 6] [--auto]
   Szene: Haven, Alliance gegen Mars, ~60 Schiffe im Kampf vor der eigenen Basis, 25 Stationen, Zoom 1.
   Gemessen (Hauptfaden, performance.now): JS-Zeit je Bild von R.frame gesamt, davon RA3D.frame, Rest = 2D-Teil
   (Überlagerungen, Balken, Texte); Abschnitte im Renderer, falls RA3D.prof vorhanden; Draw-Calls, Dreiecke,
   gerenderte Megapixel. Dazu »mit Finish«: einzelne Bilder mit gl.finish() – unter SwiftShader ein Maß für die
   Pixelarbeit (Auflösung, Bloom, Schatten, MSAA), nicht für eine echte GPU.
   Ohne --auto wird die automatische Regelung (falls vorhanden) angehalten, damit vorher/nachher vergleichbar ist.
   Bild: tools/shots/perf-<tag>.png */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : path.join(__dirname, '..', 'build', 'rift-armada.html'));
const W = +opt('--w', 1920), H = +opt('--h', 1080), DPR = +opt('--dpr', 1), tag = opt('--tag', 'pc'), qual = opt('--qual', 'auto'), secs = +opt('--secs', 6), auto = args.includes('--auto');
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, locale: 'de-DE', hasTouch: DPR > 1, isMobile: DPR > 1 });
  await ctx.addInitScript(q => { try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, qual: q }, menu: {} })); } catch (e) {} }, qual);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.setDefaultTimeout(240000); await page.goto('file://' + file, { waitUntil: 'domcontentloaded', timeout: 240000 }); await page.waitForFunction(() => typeof R !== 'undefined' && R.cv && typeof startSkirmish === 'function', null, { timeout: 240000 }); await page.waitForTimeout(800);
  await page.evaluate(auto => { window.__RA_TEST = 1; if (!auto && RA3D.setAuto) RA3D.setAuto(false); }, auto);
  /* feste Stufe für Vergleiche: --scale x, --bloom */
  const fixScale = opt('--scale', ''), fixBloom = args.includes('--bloom');
  const fix = () => page.evaluate(([sc, bl]) => { if (RA3D.setQuality) { if (sc) RA3D.setQuality({ scale: +sc }); if (bl) RA3D.setQuality({ bloom: true }); } }, [fixScale, fixBloom]);
  /* Vorbauen abwarten (Leerlauf-Warteschlange des Renderers), wie im echten Spiel vor dem ersten Gefecht */
  const waitPre = async () => { if (args.includes('--nopre')) return; const t0 = Date.now(); await page.waitForFunction(() => !RA3D.stats || RA3D.stats().pre === undefined || (UI.g && RA3D.stats().pre === 0), null, { timeout: 900000 }); return Date.now() - t0; };
  await page.evaluate(() => { MENU.map = 'haven'; MENU.slots = [{ f: 'mars', lvl: 2, team: 0 }].concat(Array.from({ length: 6 }, () => ({ f: 'off', lvl: 2, team: 0 }))); MENU.faction = 'alliance'; startSkirmish(); });
  await page.waitForTimeout(2000);
  const preMs = await waitPre(); await fix();
  await page.evaluate(() => { window.__np0 = RA3D._ ? RA3D._.S.renderer.info.programs.length : 0; });
  /* Szene: Stationen um die Basis, zwei Flotten, Kampf */
  await page.evaluate(() => {
    const g = UI.g, me = UI.me, foe = 1 - me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'), dir = g.players[me].start.ang;
    const roles = ['yard', 'lab', 'reactor', 'reactor', 'relay', 'turret', 'turret', 'shield', 'turret', 'reactor', 'relay'];
    let n = g.bldgs.filter(x => !x.dead).length, i = 0;
    while (n < 25) { const a = dir + 1.2 + i * 0.55, r = 260 + (i % 3) * 120; const ow = i % 4 === 3 ? foe : me, ro = roles[i % roles.length]; const s = addBldg(g, BLDG[g.players[ow].faction][ro] ? ro : 'turret', ow, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, true); s.lv = 1 + (i % 3); i++; n++; }
    const fx = b.x + Math.cos(dir) * 520, fy = b.y + Math.sin(dir) * 520;
    const mine = ['lancer', 'wren', 'bulwark', 'aegis', 'beacon', 'reckoning', 'haven', 'fighter'], theirs = ['spear', 'hammer', 'needle', 'hedgehog', 'olympus', 'longshot', 'wasp'];
    for (let k = 0; k < 30; k++) { const u = addShip(g, mine[k % mine.length], me, b.x + Math.cos(dir) * 200 + (k % 6) * 40 - 100, b.y + Math.sin(dir) * 200 + ((k / 6) | 0) * 40 - 100, dir); u.o = { t: 'amove', x: fx + 300, y: fy }; }
    for (let k = 0; k < 30; k++) { const u = addShip(g, theirs[k % theirs.length], foe, fx + 380 + (k % 6) * 45, fy - 120 + ((k / 6) | 0) * 50, dir + Math.PI); u.o = { t: 'amove', x: b.x, y: b.y }; }
    R.cam.z = 1; R.center(b.x + Math.cos(dir) * 330, b.y + Math.sin(dir) * 330); UI.speed = 1;
    window.__P = { calls: [], rf: [], ra: [], prof: {}, np0: window.__np0 };
  });
  /* Messung im laufenden Spiel: R.frame und RA3D.frame umwickeln; erst aufwärmen (neue Schiffstypen bauen ihre
     Vorlagen, Shader werden übersetzt), dann zurücksetzen und messen */
  await page.evaluate(() => {
    const P = window.__P, rf = R.frame, ra = RA3D.frame;
    let inner = 0;
    RA3D.frame = function () { const t0 = performance.now(); const r = ra.apply(this, arguments); inner = performance.now() - t0; return r; };
    R.frame = function () { inner = 0; const t0 = performance.now(); const r = rf.apply(this, arguments); P.rf.push(performance.now() - t0); P.ra.push(inner); (P.np || (P.np = [])).push(RA3D._ ? RA3D._.S.renderer.info.programs.length : 0); if (RA3D.prof) (P.pf || (P.pf = [])).push(JSON.stringify(RA3D.prof, (k, v) => typeof v === 'number' ? Math.round(v) : v)); if (RA3D.stats) P.calls.push(RA3D.stats().calls); if (RA3D.prof) for (const k in RA3D.prof) P.prof[k] = (P.prof[k] || 0) + RA3D.prof[k]; return r; };
    P.unwrap = () => { R.frame = rf; RA3D.frame = ra; };
  });
  await page.waitForFunction(() => window.__P.rf.length >= 20, null, { timeout: 600000 });
  const warm = await page.evaluate(() => { const P = window.__P, a = P.rf.slice(); P.rf.length = 0; P.ra.length = 0; P.calls.length = 0; P.prof = {}; const pf = P.pf || []; P.pf = []; return { first_ms: +a[0].toFixed(0), max_ms: +Math.max(...a).toFixed(0), slow: a.map((v, i) => [Math.round(v), pf[i], (P.np || [])[i]]).filter(x => x[0] > 200), progStart: P.np0 }; });
  const prof = args.includes('--cpuprofile') ? await page.context().newCDPSession(page) : null;
  if (prof) { await prof.send('Profiler.enable'); await prof.send('Profiler.setSamplingInterval', { interval: 200 }); await prof.send('Profiler.start'); }
  const loop = +opt('--loop', 0);
  if (loop) {
    /* Schleife: Spielschritt + Bild direkt aufrufen (rAF-Takt von SwiftShader spielt keine Rolle); die Regelung
       bekommt dabei einen Takt von 16,7 ms vorgespielt, damit sie nicht wegen der Schleife umschaltet */
    await page.evaluate(n => { const g = UI.g; for (let i = 0; i < n; i++) { stepGame(g); if (g.ev.length) { UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; } R.frame(1 / 60, 1 / 60); } }, loop);
  } else {
    await page.waitForTimeout(secs * 1000);
    await page.waitForFunction(n => window.__P.rf.length >= n, +opt('--frames', 30), { timeout: 900000 });
  }
  if (prof) {
    /* Selbstzeit je Funktion (Top 25) */
    const { profile } = await prof.send('Profiler.stop'); const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
    const tot = new Map(); profile.samples.forEach((id, i) => tot.set(id, (tot.get(id) || 0) + (dt[i] || 0)));
    for (const [id, us] of tot) { const n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + ' @' + n.callFrame.lineNumber + ':' + n.callFrame.columnNumber; self.set(k, (self.get(k) || 0) + us); }
    const all = [...self.values()].reduce((a, b) => a + b, 0);
    console.log('PROFIL (Selbstzeit, ms gesamt / Anteil):'); [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28).forEach(([k, v]) => console.log('  ' + (v / 1000).toFixed(0).padStart(6) + ' ms ' + (100 * v / all).toFixed(1).padStart(5) + '%  ' + k));
  }
  const progs = await page.evaluate(() => {
    if (!RA3D._) return [];
    /* je neuem Programm: Unterschied zum ähnlichsten schon vorhandenen (Stellen im Schlüssel) */
    const all = RA3D._.S.renderer.info.programs, old = all.slice(0, window.__np0).map(p => p.cacheKey.split(','));
    return all.slice(window.__np0).map(p => { const k = p.cacheKey.split(','); let best = null, bd = 1e9; for (const o of old) { if (o.length !== k.length) continue; let d = 0; for (let i = 0; i < k.length; i++) if (o[i] !== k[i]) d++; if (d < bd) { bd = d; best = o; } } const diff = best ? k.map((v, i) => v !== best[i] ? i + ':' + best[i] + '→' + v : null).filter(Boolean).join(' ') : 'neu'; return p.name + ' [' + k.length + '] ' + diff; });
  });
  if (args.includes('--progs')) console.log('NEUE PROGRAMME:\n' + progs.join('\n'));
  const res = await page.evaluate(() => {
    const P = window.__P; P.unwrap();
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }, mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p90 = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.9)] : 0; };
    const cv = document.getElementById('view3d'), n = P.rf.length;
    const prof = {}; for (const k in P.prof) prof[k] = +(P.prof[k] / n).toFixed(2);
    const out = { frames: n, R_frame_med: +med(P.rf).toFixed(2), R_frame_mean: +mean(P.rf).toFixed(2), R_frame_p90: +p90(P.rf).toFixed(2), RA3D_frame_med: +med(P.ra).toFixed(2), RA3D_frame_mean: +mean(P.ra).toFixed(2), part2D_mean: +(mean(P.rf) - mean(P.ra)).toFixed(2), calls_med: med(P.calls), px3d: cv.width + 'x' + cv.height, MP3d: +(cv.width * cv.height / 1e6).toFixed(2), cv2d: R.cv.width + 'x' + R.cv.height, detail: R.detail, prof };
    if (RA3D.quality) out.quality = RA3D.quality();
    const st = RA3D.stats ? RA3D.stats() : {}; out.tris = st.tris; out.ships = UI.g.ships.filter(u => !u.dead).length; out.bldgs = UI.g.bldgs.filter(x => !x.dead).length;
    return out;
  });
  /* einzelne Bilder mit gl.finish (Pixelarbeit unter SwiftShader) */
  const fin = await page.evaluate(() => {
    UI.speed = 0; const gl = document.getElementById('view3d').getContext('webgl2'); const t = [];
    for (let i = 0; i < 6; i++) { const t0 = performance.now(); R.frame(1 / 60, 1 / 60); gl.finish(); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b); return +t[3].toFixed(1);
  });
  res.withFinish_ms = fin; res.warmup = warm; res.prebuild_wait_ms = preMs;
  const ev = opt('--eval', ''); if (ev) res.eval = await page.evaluate(fs.readFileSync(ev, 'utf8'));
  await page.screenshot({ path: path.join(OUT, 'perf-' + tag + '.png') });
  console.log(tag + ' ' + JSON.stringify(res));
  if (errs.length) console.log('FEHLER:\n' + [...new Set(errs)].slice(0, 8).join('\n'));
  await b.close();
})();
