/* 3D-Prüfbilder: lädt tools/shot3d.html (Simulation + src/render3d.js) in Chromium mit SwiftShader, baut eine Partie
   mit Schiffen und Stationen aller Fraktionen, lässt sie laufen und rendert mehrere Ansichten nach tools/shots/3d-*.png.
   node tools/shot3d.js [--bundle pfad] [--detail n] [--cross]   (Vorbild: probe3d/sheet.js)
   Meldet Fehler der Seite, Draw-Calls, Dreiecke und Frame-Zeit je Ansicht sowie die Projektionsprobe (unproject∘project). */
const { chromium } = require('./node_modules/playwright');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const bundle = opt('--bundle', ''), detail = +opt('--detail', 1), cross = args.includes('--cross'), only = opt('--only', '');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : ''))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  if (bundle) await p.route('**/src/render3d.js', r => r.fulfill({ path: path.resolve(bundle), contentType: 'application/javascript' }));
  await p.goto('file://' + path.join(__dirname, 'shot3d.html')); await p.waitForTimeout(300);
  const ok = await p.evaluate(() => RA3D.supported() && RA3D.init(document.getElementById('view3d')));
  if (!ok) { console.log('RA3D.init fehlgeschlagen'); console.log(errs.join('\n')); await b.close(); process.exit(1); }
  const P = await p.evaluate(d => { RA3D.setDetail(d); const pts = T3.setup(); T3.step(90); return pts; }, detail);
  const shot = async (name, cx, cy, zoom, o) => {
    if (only && !name.includes(only)) return;
    const st = await p.evaluate(([cx, cy, zoom, o, cross]) => { const r = T3.render(cx, cy, zoom, o); T3.cross(cross); r.proj = +T3.checkProj().toFixed(2); return r; }, [cx, cy, zoom, o || {}, cross]);
    await p.screenshot({ path: path.join(__dirname, 'shots', '3d-' + name + '.png') });
    console.log(`3d-${name}.png  zoom ${zoom}  calls ${st.calls}  tris ${st.tris}  ${st.ms} ms/frame  proj ${st.proj}px  Sets ${st.sets}/${st.ims}  Stationen ${st.stations}`);
  };
  await shot('base', P.base.x, P.base.y, 1, { frames: 4 });
  await shot('close', P.yard.x, P.yard.y, 2, { frames: 4 });
  await shot('far', P.base.x + Math.cos(P.base.ang) * 500, P.base.y + Math.sin(P.base.ang) * 500, 0.5, { frames: 4 });
  await shot('guests', P.guests.x, P.guests.y, 1.3, { frames: 4 });
  /* Kampf: weiterlaufen lassen, bis die Flotten aufeinandertreffen */
  await p.evaluate(() => T3.step(360));
  await shot('fight', P.fight.x, P.fight.y, 1.2, { frames: 6, tick: true });
  /* Beobachter ohne Nebel, Gegnerbasis */
  await p.evaluate(() => T3.setVp(-1));
  await shot('foe', P.foe.x, P.foe.y, 1, { frames: 4 });
  await shot('map', P.base.x + Math.cos(P.base.ang) * 900, P.base.y + Math.sin(P.base.ang) * 900, 0.35, { frames: 4 });
  /* Leistung: ~150 Schiffe und ~40 Stationen im Bild (Beobachter), Zoom 1 */
  await p.evaluate(P => {
    const g = T3.g, s = P.base; const ids = ['lancer', 'wren', 'bulwark', 'haven', 'aegis', 'fighter', 'fighter', 'olympus', 'needle', 'paladin', 'monolith', 'shard', 'ravager', 'swarm', 'spitter'];
    for (let i = 0; i < 150; i++) { const u = addShip(g, ids[i % ids.length], i % 2, s.x + (i % 15 - 7) * 70, s.y - 450 + Math.floor(i / 15) * 70, i * 0.4); u.o = { t: 'hold' }; u.hold = true; u.v = u.def.speed * 0.6; }
    const roles = ['yard', 'lab', 'reactor', 'relay', 'turret', 'refinery'];
    for (let i = 0; i < 40; i++) { const b = addBldg(g, roles[i % roles.length], i % 2, s.x - 560 + (i % 8) * 160, s.y + 150 + Math.floor(i / 8) * 150, true); b.lv = 1 + i % 3; }
    updateVision(g);
  }, P);
  await shot('load', P.base.x, P.base.y - 100, 1, { frames: 20 });
  await shot('load-far', P.base.x, P.base.y - 100, 0.5, { frames: 10 });
  console.log(errs.length ? 'FEHLER:\n' + [...new Set(errs)].slice(0, 12).join('\n') : 'keine Fehler');
  await b.close();
})();
