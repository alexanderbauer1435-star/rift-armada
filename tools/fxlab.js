/* Effekt-Labor: bündelt tools/fxlab-entry.js (esbuild), rendert jedes Szenario zu mehreren Zeitpunkten mit SwiftShader
   und fügt die Standbilder je Szenario zu einem Kontaktbogen tools/shots/fx-<name>.png zusammen.
   node tools/fxlab.js [szenario …]  (ohne Argument: alle); FXLAB_DETAIL=0|1|2 setzt die Detailstufe */
const { chromium } = require('/home/claude/rift-armada/tools/node_modules/playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BUNDLE = process.env.FXLAB_BUNDLE || '/tmp/claude-0/-home-claude/a33b1f6a-f7a9-59b2-afb5-376789a8d49a/scratchpad/fxlab.bundle.js';
fs.mkdirSync(path.dirname(BUNDLE), { recursive: true }); fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
execSync(`${ROOT}/tools/node_modules/.bin/esbuild ${ROOT}/tools/fxlab-entry.js --bundle --minify --format=iife --loader:.json=json --outfile=${BUNDLE} --log-level=warning`, { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_PATH: ROOT + '/tools/node_modules' }) });
const only = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, 'fxlab.html')); await p.addScriptTag({ path: BUNDLE }); await p.waitForTimeout(600);
  if (process.env.FXLAB_DETAIL) await p.evaluate(d => window.FXLAB.setDetail(d), +process.env.FXLAB_DETAIL);
  const list = await p.evaluate(() => window.FXLAB.list);
  for (const name of list) {
    if (only.length && !only.includes(name)) continue;
    const times = await p.evaluate(n => window.FXLAB.times(n), name);
    const shots = [], stats = [];
    for (const t of times) {
      const st = await p.evaluate(([n, t]) => window.FXLAB.run(n, t), [name, t]);
      await p.waitForTimeout(80);
      shots.push(await p.screenshot()); stats.push(`t=${t}s: ${st.particles} Partikel, ${st.drawCalls} Draw-Calls, ${st.cpuMs} ms CPU/Frame (spr ${st.spr}, quad ${st.quad}, smoke ${st.smoke}, chunk ${st.chunk}, ring ${st.ring}, disc ${st.disc}, dome ${st.dome})`);
    }
    const cols = shots.length > 2 ? 2 : shots.length, rows = Math.ceil(shots.length / cols);
    const html = '<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:2px">' + shots.map((s, i) => '<div style="position:relative"><img style="width:100%;display:block" src="data:image/png;base64,' + s.toString('base64') + '"><div style="position:absolute;left:6px;top:4px;color:#fff;font:12px monospace;background:rgba(0,0,0,.5);padding:2px 5px">' + name + ' ' + stats[i] + '</div></div>').join('') + '</body>';
    const q = await (await b.newContext({ viewport: { width: 900 * cols, height: 560 * rows } })).newPage(); await q.setContent(html); await q.waitForTimeout(150);
    const out = path.join(__dirname, 'shots', 'fx-' + name + '.png'); await q.screenshot({ path: out, fullPage: true }); await q.close();
    console.log(out + '\n  ' + stats.join('\n  '));
  }
  console.log(errs.length ? 'FEHLER:\n' + [...new Set(errs)].join('\n') : 'keine Fehler');
  await b.close();
})();
