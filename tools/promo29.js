/* Action-Trailer (Fassung 29): nimmt die Szenen Bild für Bild auf. Zwei Arten:
   - Kinoszenen (cine): freie Kamera dicht an den Schiffen, ohne Bedienleisten. Die Kamera des Spiels wird dafür von außen
     umgelenkt (RA3D._.S.camera), dazu ein Sternenhimmel rundum, weil der Himmel des Spiels nur unter der Karte liegt.
   - Spielszenen (hud): normale Spielansicht; das 3D-Bild kommt direkt aus der Zeichenfläche, die Bedienleisten als
     durchsichtiges Bildschirmfoto darüber (ein Bildschirmfoto mit 3D-Fläche kostet ohne Grafikkarte viele Sekunden).
   node tools/promo29.js <build.html> [szenen|all] → tools/promo/a-<szene>/0000.jpg (und 0000.png für die Leisten)
   Umgebung: FRAMES=n nur n Bilder, STRIDE=k nur jedes k-te Bild zeichnen (Probe), DPR=1.5 für 1920×1080 */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html');
const ONLY = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null;
const OUT = path.join(__dirname, 'promo'), FPS = 30, W = 1280, H = 720, DPR = +(process.env.DPR || 1), STRIDE = +(process.env.STRIDE || 1);
const CLEAN = '#app > *:not(#view3d):not(#view), #fpsBox, #hintCard, #toasts, #errHint, #perfHint { display: none !important; } #view { opacity: 0 !important; }';
const HUDCSS = 'html, body, #app { background: transparent !important; } canvas#view3d { visibility: hidden !important; } #fpsBox, #hintCard, #toasts, #errHint, #perfHint, #vers { display: none !important; }';

/* läuft in der Seite: Kinokamera, Sternenhimmel, Hilfen */
function pageInit() {
  window.__cine = null;
  window.__rev = () => { const g = UI.g, me = UI.me; for (let i = 0; i < g.players[me].explored.length; i++) g.players[me].explored[i] = 1; g.reveals.push({ x: g.map.w / 2, y: g.map.h / 2, r: 99999, owner: me, until: 1e9 }); };
  window.__fwd = n => { const g = UI.g; for (let i = 0; i < n; i++) { stepGame(g); g.ev.length = 0; } };
  window.__ez = t => t * t * (3 - 2 * t);
  window.__mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  /* Kamera: p = Ort [x, Höhe, y], t = Blickziel, fov in Grad, roll in rad; setzt auch die Spielkamera (Schatten, Sichtprüfung) */
  window.__cam = (p, t, fov, roll) => { window.__cine = { p, t, fov: fov || 35, roll: roll || 0, near: 4 }; R.center(t[0], t[2]); R.cam.z = Math.max(0.6, Math.min(3, 1142 / Math.max(120, Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2])))); };
  window.__cineInit = () => {
    const _ = RA3D._, c = _.S.camera, T = _.THREE; if (c.__cine) return; c.__cine = 1;
    const la = c.lookAt.bind(c); let nr = c.near;
    Object.defineProperty(c, 'near', { get: () => window.__cine ? window.__cine.near : nr, set: v => { nr = v; }, configurable: true });
    /* Sterne auf einer Kugel um die Kamera */
    const N = 7000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3); let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, a = rnd() * 6.2832, r = Math.sqrt(1 - u * u), b = Math.pow(rnd(), 3) * 0.85 + 0.15, w = rnd();
      pos[i * 3] = r * Math.cos(a) * 18000; pos[i * 3 + 1] = u * 18000; pos[i * 3 + 2] = r * Math.sin(a) * 18000;
      col[i * 3] = b * (w < 0.2 ? 1 : 0.82); col[i * 3 + 1] = b * 0.88; col[i * 3 + 2] = b * (w > 0.7 ? 1 : 0.86); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const dome = new T.Group(); dome.add(new T.Points(geo, new T.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false, transparent: true })));
    /* ferne Nebelschleier */
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const tex = new T.CanvasTexture(cv);
    [[0.3, 0.12, 1.0, 0x2b5d9c, 11000, 0.2], [0.75, 0.2, 1.3, 0x5a2f8f, 9000, 0.16], [2.2, 0.05, 0.9, 0x1f7f72, 10000, 0.13], [3.6, 0.25, 1.1, 0x8a4a2a, 8000, 0.1], [4.6, -0.05, 1.4, 0x2b4a9c, 12000, 0.17], [5.4, 0.3, 1.0, 0x6a2f6f, 9000, 0.12]].forEach(([a, e, k, hex, sz, op]) => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, color: hex, opacity: op, transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending })); sp.position.set(Math.cos(a) * Math.cos(e) * 16000, Math.sin(e) * 16000, Math.sin(a) * Math.cos(e) * 16000); sp.scale.set(sz * k, sz, 1); dome.add(sp); });
    dome.renderOrder = -50; dome.visible = false; _.S.scene.add(dome); window.__dome = dome;
    for (const nm of ['sky', 'fog']) { const o = _.S.scene.getObjectByName(nm); if (o) o.visible = false; }   /* Himmelsebene und Nebel-des-Krieges-Platten hätten von der Seite sichtbare Kanten */
    /* die großen Befehlskreise der Flaggschiffe gehören zur Bedienung, nicht ins Kinobild */
    const rg = RA3D.ring, dc = RA3D.disc; RA3D.ring = function (x, y, r) { if (r === FCMD_AURA || r === FCMD_R) return; return rg.apply(RA3D, arguments); }; RA3D.disc = function (x, y, r) { if (r === FCMD_R) return; return dc.apply(RA3D, arguments); };   /* die Himmelsebene des Spiels hätte von der Seite eine sichtbare Kante */
    c.lookAt = (x2, y2, z2) => { const q = window.__cine; dome.visible = !!q; if (!q) return la(x2, y2, z2); c.position.set(q.p[0], q.p[1], q.p[2]); dome.position.copy(c.position); c.fov = q.fov; la(q.t[0], q.t[1], q.t[2]); if (q.roll) c.rotateZ(q.roll); };
  };
  /* Zeichnen aussetzen (Probe: Zwischenbilder nur rechnen) */
  const fr = RA3D.frame.bind(RA3D); RA3D.frame = function (g, dt, time, view) { if (window.__skip) return; return fr(g, dt, time, view); };
}

async function scene(b, name, steps, sec, opt) {
  if (ONLY && !ONLY.includes(name)) return;
  opt = opt || {};
  const dir = path.join(OUT, (process.env.PREFIX || 'a-') + name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  /* Spielansicht: die Seite läuft mit 1,5-facher Dichte, damit die Bedienleisten in 1920×1080 scharf sind; dem Spiel
     wird Dichte 1 gemeldet, die 3D-Fläche bleibt also bei 1280×720 (sonst kostet jedes Bild mehr als das Doppelte) */
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: opt.hud ? 1.5 : DPR });
  if (opt.hud) await ctx.addInitScript(() => { Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install();
  await ctx.addInitScript(() => { window.__rafMs = 1500; window.__q = []; window.requestAnimationFrame = cb => { if (window.__grab) { window.__q.push(cb); return 0; } return setTimeout(() => cb(performance.now()), window.__rafMs); }; window.__tick = shot => { const q = window.__q; window.__q = []; const t = performance.now(); for (const cb of q) cb(t); if (!shot) return null; const c = document.querySelector('canvas#view3d'); return c ? c.toDataURL('image/jpeg', 0.93) : null; }; window.cancelAnimationFrame = id => clearTimeout(id); });
  await ctx.addInitScript(q => { window.__RA_TEST = true; try { localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'en', vol: 0, mus: 0, gfxUser: true, qual: q, hints: false, slowmo: false }, menu: {} })); localStorage.setItem('ra.seen', '1'); } catch (e) {} }, process.env.QUAL || 'ultra');
  await p.goto('file://' + F, { timeout: 180000 });
  await p.clock.runFor(2500);
  await p.evaluate(`(${pageInit})()`);
  for (const s of steps) { if (typeof s === 'number') await p.clock.runFor(s); else await p.evaluate(`(${s})()`); }
  await p.addStyleTag({ content: opt.hud ? HUDCSS : CLEAN });
  await p.evaluate(cine => { if (UI.g) window.__rev(); if (cine) window.__cineInit(); }, !opt.hud);
  await p.clock.runFor(600);
  await p.evaluate(f => { window.__rafMs = 1000 / f; }, FPS); await p.clock.runFor(1000); await p.evaluate(() => { window.__grab = true; }); await p.clock.runFor(1600);
  await p.evaluate(() => { if (!window.__q.length) throw new Error('kein Bildtakt'); }).catch(() => { throw new Error(name + ': kein Bildtakt ' + errs.join(' / ')); });
  const total = Math.round(sec * FPS), n = Math.min(total, +(process.env.FRAMES || 0) || total), t0 = Date.now(); let made = 0;
  for (let i = 0; i < n; i++) {
    const draw = i % STRIDE === 0;
    if (opt.each) await p.evaluate(`window.__skip = ${!draw}; (${opt.each})(${i}, ${total})`); else await p.evaluate(`window.__skip = ${!draw}`);
    await p.clock.runFor(1000 / FPS);
    const d = await p.evaluate(s => window.__tick(s), draw);
    if (!draw) continue;
    if (!d) throw new Error('kein Bild'); const base = path.join(dir, String(i).padStart(4, '0'));
    fs.writeFileSync(base + '.jpg', Buffer.from(d.split(',')[1], 'base64')); made++;
    if (opt.hud) await p.screenshot({ path: base + '.png', type: 'png', omitBackground: true });
  }
  console.log('a-' + name + ': ' + made + ' Bilder, ' + ((Date.now() - t0) / Math.max(1, made) / 1000).toFixed(1) + ' s je Bild' + (errs.length ? ' FEHLER ' + errs.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}

const SCENES = require(process.env.SCENES ? path.resolve(process.env.SCENES) : './promo29_scenes.js');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const s of SCENES) await scene(b, s.name, s.steps, s.sec, s.opt);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
