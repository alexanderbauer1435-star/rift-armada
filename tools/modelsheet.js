/* Modellbogen: Fotostudio mit dem Spiel-Renderer (gleiche Lichter, Umgebung, Materialien). Jedes Schiff und jede
   Station (Stufe 1–3) formatfüllend, dazu je Fraktion eine Aufstellung aller Schiffe im gleichen Maßstab.
   node tools/modelsheet.js build/rift-armada.html <ordner> [fraktionen]  → <ordner>/<fraktion>/*.png + index.json
   Tafeln: python3 tools/modelsheet.py <ordner> */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const F = path.resolve(process.argv[2] || 'build/rift-armada.html'), OUT = process.argv[3] || 'tools/shots/sheet';
const FACS = (process.argv[4] || 'alliance,mars,legion,nexus,brood').split(',');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 480 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.prefs', JSON.stringify({ set: { gfx: '3d', lang: 'de', vol: 0, mus: 0, gfxUser: true, qual: 'auto' }, menu: {} })); localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + F, { timeout: 180000 }); await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const { THREE, S } = RA3D._;
    const sc = new THREE.Scene(); sc.environment = S.scene.environment; sc.environmentIntensity = S.scene.environmentIntensity || 0.3;
    for (const l of [S.key, S.rim, S.fill]) { const c = new THREE.DirectionalLight(l.color, l.intensity); c.position.copy(l.position).normalize().multiplyScalar(500); sc.add(c); }
    sc.add(new THREE.HemisphereLight(S.hemi.color, S.hemi.groundColor, S.hemi.intensity));
    const cam = new THREE.PerspectiveCamera(30, 1, 1, 50000), dir = new THREE.Vector3(0, Math.sin(1.0), Math.cos(1.0)).normalize();
    window.__studio = (obj, fit, W = 480, H = 480) => {
      sc.add(obj); obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj), sp = box.getBoundingSphere(new THREE.Sphere());
      const R = fit || sp.radius, d = W > H ? R / (Math.tan(cam.fov * Math.PI / 360) * W / H) * 1.06 : R / Math.sin(cam.fov * Math.PI / 360) * 1.08;
      cam.position.copy(sp.center).addScaledVector(dir, d); cam.lookAt(sp.center); cam.near = d * 0.05; cam.far = d * 4; cam.updateProjectionMatrix();
      const r = S.renderer, old = new THREE.Vector2(); r.getSize(old); const pr = r.getPixelRatio();
      cam.aspect = W / H; cam.updateProjectionMatrix(); r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor('#05070f', 1); r.setRenderTarget(null); r.render(sc, cam);
      const url = r.domElement.toDataURL('image/png');
      r.setPixelRatio(pr); r.setSize(old.x, old.y, false); sc.remove(obj); return url;
    };
  });
  const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  const index = {};
  for (const f of FACS) {
    const dir = path.join(OUT, f); fs.mkdirSync(dir, { recursive: true });
    const list = await p.evaluate(f => ({
      ships: Object.values(SHIPS).filter(d => d.f === f && !d.hidden).map(d => ({ id: d.id, name: d.name, cls: d.cls, role: d.role, r: d.r, len: d.len })),
      st: Object.entries(BLDG[f]).map(([role, d]) => ({ id: role, name: d.name, r: d.r, lvs: d.lv.length }))
    }), f);
    index[f] = list;
    for (const s of list.ships) {
      const url = await p.evaluate(([f, id]) => { const { BUILD, mats, THREE } = RA3D._; const fn = BUILD[id]; if (!fn) return null; const g = fn(mats(f), SHIPS[id]); g.rotation.y = 0.75; return __studio(g); }, [f, s.id]);
      if (url) save(path.join(dir, 's-' + s.id + '.png'), url); else s.missing = 1;
    }
    /* Aufstellung im gleichen Maßstab, nach Größe sortiert */
    const lu = await p.evaluate(([f, ids]) => { const { BUILD, mats, THREE } = RA3D._; const grp = new THREE.Group(); let x = 0; const items = ids.map(id => ({ id, r: SHIPS[id].len || SHIPS[id].r * 2 })).sort((a, b) => a.r - b.r);
      const w = items.reduce((s, it) => s + Math.max(14, SHIPS[it.id].r * 2.3), 0);
      for (const it of items) { const g = BUILD[it.id] && BUILD[it.id](mats(f), SHIPS[it.id]); if (!g) continue; const sw = Math.max(14, SHIPS[it.id].r * 2.3); g.rotation.y = 0; g.position.set(x - w / 2 + sw / 2, 0, 0); x += sw; grp.add(g); }
      return __studio(grp, null, 1200, 420); }, [f, list.ships.filter(s => !s.missing).map(s => s.id)]);
    save(path.join(dir, 'lineup.png'), lu);
    for (const s of list.st) for (let lv = 1; lv <= Math.min(3, s.lvs); lv++) {
      const url = await p.evaluate(([f, role, lv]) => { const { BUILDB, mats } = RA3D._; const d = Object.assign({}, BLDG[f][role], { id: role, role, f }); const fn = BUILDB[f + ':' + role]; if (!fn) return null; try { return __studio(fn(mats(f), d, lv)); } catch (e) { return 'ERR' + e.message; } }, [f, s.id, lv]);
      if (url && url.startsWith('data:')) save(path.join(dir, 'b-' + s.id + '-' + lv + '.png'), url); else { s.err = (s.err || '') + ' L' + lv + ':' + (url || 'kein Modell'); }
    }
    console.log(f + ': ' + list.ships.length + ' Schiffe, ' + list.st.length + ' Stationen' + list.st.filter(s => s.err).map(s => ' [' + s.id + s.err + ']').join(''));
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  if (errs.length) console.log('FEHLER ' + errs.slice(0, 3).join(' / '));
  await b.close();
})();
